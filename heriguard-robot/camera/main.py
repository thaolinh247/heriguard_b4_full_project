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
            # AI detection on-device: dark cracks + màu (moss/mold/stain)
            img = sensor.snapshot()
            results = []  # (x, y, w, h, label, confidence)

            # 1) Dark cracks (vết nứt — blob tối, dài/hẹp)
            dark_threshold = (0, 60, -32, 32, -32, 32)
            for b in img.find_blobs([dark_threshold], pixels_threshold=80, area_threshold=80, merge=True):
                if b.area() < 150 or b.w() < 4:
                    continue
                eccentricity = math.sqrt(1 - (b.h() / b.w())**2) if b.w() > 0 else 0
                if eccentricity > 0.6:
                    label = 1 if b.area() > 800 else 0  # crack_large / crack_small
                    confidence = min(0.95, 0.45 + (b.area() / 3200) + (eccentricity * 0.15))
                    results.append((b.cx()>>2, b.cy()>>2, b.w()>>2, b.h()>>2, label, int(confidence*100)))
                    img.draw_rectangle(b.rect(), color=(255, 0, 0))

            # 2) Moss (xanh rêu – bám trên đá)
            moss_threshold = (30, 90, -40, -5, 10, 45)
            for b in img.find_blobs([moss_threshold], pixels_threshold=120, area_threshold=120, merge=True):
                if b.area() < 180 or b.w() < 4:
                    continue
                # blob màu đồng đều → moss, bỏ qua vùng lẫn crack tối
                stats = img.get_statistics(roi=b.rect())
                if stats.l_mean() < 30:
                    continue  # quá tối -> crack đã xử lý
                confidence = min(0.9, 0.4 + (b.area() / 4000))
                results.append((b.cx()>>2, b.cy()>>2, b.w()>>2, b.h()>>2, 2, int(confidence*100)))
                img.draw_rectangle(b.rect(), color=(0, 255, 0))

            # 3) Mold (mốc trắng/xám)
            mold_threshold = (70, 130, -20, 20, -20, 20)
            for b in img.find_blobs([mold_threshold], pixels_threshold=150, area_threshold=150, merge=True):
                if b.area() < 200 or b.w() < 4:
                    continue
                confidence = min(0.9, 0.4 + (b.area() / 5000))
                results.append((b.cx()>>2, b.cy()>>2, b.w()>>2, b.h()>>2, 3, int(confidence*100)))
                img.draw_rectangle(b.rect(), color=(255, 255, 0))

            # 4) Stain (vết ố nâu/vàng)
            stain_threshold = (40, 110, 0, 50, -15, 35)
            for b in img.find_blobs([stain_threshold], pixels_threshold=150, area_threshold=150, merge=True):
                if b.area() < 200 or b.w() < 4:
                    continue
                confidence = min(0.9, 0.4 + (b.area() / 5000))
                results.append((b.cx()>>2, b.cy()>>2, b.w()>>2, b.h()>>2, 4, int(confidence*100)))
                img.draw_rectangle(b.rect(), color=(255, 165, 0))

            # Giới hạn số kết quả — tránh tràn buffer firmware (MAX_DETECTIONS=8)
            results = results[:8]
            count = len(results)
            uart.write(bytes([0xDD, count & 0xFF]))
            for r in results:
                packet = pack("<BBBBBB", r[0], r[1], r[2], r[3], r[4], r[5])
                uart.write(packet)
