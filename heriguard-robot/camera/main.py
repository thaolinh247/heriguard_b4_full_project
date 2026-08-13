import sensor, image, time, math
from machine import UART
from struct import pack

# UART: giao tiếp với Mini R4 (921600 baud)
uart = UART(3, 921600, timeout=1000)

# Camera: OV7725 / MT9M114
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QQVGA)  # 160x120 (JPEG ~3-6KB, vừa RAM Mini R4 7KB)
sensor.skip_frames(time=2000)

uart.write(b"HERI-GUARD CAM READY\r\n")

while True:
    # Chờ trigger từ Mini R4
    if uart.any():
        cmd = uart.read(1)
        if cmd == b'C':
            # Chụp ảnh
            img = sensor.snapshot()

            # Nén JPEG quality 60 (giữ < 14KB vì RAM Mini R4)
            img.compress(quality=60)
            jpeg = img.bytearray()
            length = len(jpeg)

            # Header: 0xAA + length (2 bytes big-endian)
            header = bytes([0xAA, (length >> 8) & 0xFF, length & 0xFF])

            # Checksum: XOR header byte + toàn bộ data
            checksum = 0xAA ^ ((length >> 8) & 0xFF) ^ (length & 0xFF)
            for b in jpeg:
                checksum ^= b
            checksum &= 0xFF

            uart.write(header)
            uart.write(jpeg)
            uart.write(bytes([checksum]))

        elif cmd == b'D':
            # AI crack detection on-device
            img = sensor.snapshot()
            dark_threshold = (0, 60, -32, 32, -32, 32)
            blobs = img.find_blobs([dark_threshold], pixels_threshold=80, area_threshold=80, merge=True)
            cracks = []
            for b in blobs:
                if b.area() < 150 or b.w() < 4:
                    continue
                eccentricity = math.sqrt(1 - (b.h() / b.w())**2) if b.w() > 0 else 0
                if eccentricity > 0.6:
                    confidence = min(0.95, 0.45 + (b.area() / 3200) + (eccentricity * 0.15))
                    cracks.append({
                        "x": b.cx(), "y": b.cy(),
                        "w": b.w(), "h": b.h(),
                        "confidence": round(confidence, 2)
                    })
                    img.draw_rectangle(b.rect(), color=(255, 0, 0))
            count = len(cracks)
            uart.write(bytes([0xDD, count & 0xFF]))
            for c in cracks:
                packet = pack("<BBBBBB", c["x"]>>2, c["y"]>>2, c["w"]>>2, c["h"]>>2, int(c["confidence"]*100), 0)
                uart.write(packet)
