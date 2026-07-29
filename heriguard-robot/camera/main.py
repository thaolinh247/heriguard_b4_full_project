import sensor, image, time
from machine import UART

# UART: giao tiếp với Mini R4
uart = UART(3, 921600, timeout=1000)

# Camera: OV7725 / MT9M114
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)  # 320x240 (đủ cho detection, JPEG nhẹ)
sensor.skip_frames(time=2000)      # ổn định cảm biến

uart.write(b"HERI-GUARD CAM READY\r\n")

while True:
    img = sensor.snapshot()

    # Nén JPEG (quality 80, ~15-25KB)
    img.compress(quality=80)
    jpeg = img.bytearray()
    length = len(jpeg)

    # Header: 0xAA + length (2 bytes big-endian)
    header = bytes([0xAA, (length >> 8) & 0xFF, length & 0xFF])

    # Checksum: XOR toàn bộ header + data
    checksum = 0xAA ^ ((length >> 8) & 0xFF) ^ (length & 0xFF)
    for b in jpeg:
        checksum ^= b
    checksum &= 0xFF

    uart.write(header)
    uart.write(jpeg)
    uart.write(bytes([checksum]))

    time.sleep_ms(1000)
