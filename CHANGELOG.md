# CHANGELOG HERI-GUARD

Lịch sử thay đổi toàn bộ dự án (heriguard-app + heriguard-robot).

**Quy tắc:** Mỗi lần có thay đổi code/config/docs phải thêm mục mới vào đầu phần "Unreleased" (hoặc mục ngày tương ứng), ghi rõ: thay đổi gì, file nào, lý do.

## Unreleased

### 2026-08-13 — Sửa BLE + Camera M-Vision

**heriguard-robot `src/main.cpp`**
- Bỏ `BLE.setMTU(517)` — API không tồn tại trong ArduinoBLE 1.5.0 (bản dùng cho UNO R4 WiFi) → lỗi compile. MTU được set tự động trong `HCI.begin()`: `ATT.setMaxMtu(pktLen - 9)` = 242 (HCI pktLen 251 của ESP32-S3).
- `JPEG_CHUNK_PAYLOAD 506 → 200`: với MTU max 242, notification chỉ chở được 239B payload (242 - 3 ATT header); chunk 506B bị cắt cụt → ảnh không bao giờ reassemble. 200 + 6B header = 206B ≤ 239B.
- **Camera:** khôi phục luồng JPEG đúng protocol của firmware camera tùy chỉnh (`camera/main.py` — MicroPython gửi JPEG qua UART 921600, trigger `'C'`, frame `0xAA + length(2B BE) + data + checksum XOR`):
  - Giữ `Serial1.begin(921600)`; JPEG buffer 6000 (khớp QQVGA quality 60 ~3-6KB vừa RAM).
  - `captureJpegFromCam()` TIMEOUT 3000ms, guard `length > JPEG_BUF_SIZE`.
  - Lệnh `'C'` → capture + `sendJpegViaBle()` chunk 200B → LED vàng/vàng-xanh/đỏ-nháy theo kết quả.
- *(Ghi chú: đã thử nhầm hướng dùng `MiniR4.Vision.SmartCamReader()` protocol stock 115200 — không hợp vì camera đang chạy firmware JPEG tùy chỉnh; đã hủy.)*

**heriguard-app `src/lib/ble.ts`**
- Scan: lọc theo **service UUID** (không chỉ dựa vào `device.name`) — ArduinoBLE bỏ local name khỏi advertisement khi flags + 128-bit UUID + name > 31 byte → `device.name = null` trên Android → app không tìm thấy robot.
- Thêm `getBleState()`, `tryEnableBluetooth()`, `waitForPowerOn()`, `openLocationSettings()`.
- `startScan()` nhận callback `onError`, tự `stopDeviceScan()` khi lỗi.
- `handleDetectionData()`: confidence từ camera 0–100 → chuẩn hóa `/100` thành 0–1 (khớp mock).

**heriguard-app `src/app/device/scan.tsx`**
- Trước khi quét: kiểm tra quyền → tự bật Bluetooth → lỗi tiếng Việt rõ ràng khi Bluetooth tắt / Location tắt.
- Hiển thị nút "Mở Cài đặt Vị trí" khi lỗi Location; nút "Quét lại".

**heriguard-app `src/components/dashboard/ControlPanel.tsx`**
- Ưu tiên BLE thật khi đã kết nối thiết bị; mock chỉ dùng khi chưa kết nối (mockMode vẫn bật mặc định nhưng không nuốt lệnh điều khiển robot thật).
- Gửi lệnh fail → Alert "Không gửi được lệnh".

## 2026-08-12 (working copy, chưa commit)

### fix: xóa hardcoded API key trong settingsStore

**heriguard-app**
- `src/store/settingsStore.ts`: `geminiApiKey` lấy từ `DEFAULT_GEMINI_API_KEY` (config/apiKey), `geminiMockMode: false`.

### feat: nâng cấp AI, camera, BLE và dashboard (commit `74fa757`)

- App: request MTU 512 khi kết nối Android; scan lại tự động sau khi vào màn hình.
- Robot: chuyển sang dùng `MiniR4.Motion.getAccel()`; giảm `JPEG_BUF_SIZE` 60000 → 6000; timeout JPEG 3000 → 1000ms.
- Camera tab: bỏ hằng số OSD thừa.

## 2026-08-XX — Các commit trước

| Commit | Mô tả |
|---|---|
| `55c222a` | docs: cập nhật PLAN.md khớp trạng thái thực tế |
| `5fcaec2` | fix: xóa hardcoded API key trong settingsStore |
| `69bf072` | chore: gỡ expo-blob và xóa PLAN-BLE-CAMERA-AI.md |
| `74fa757` | feat: nâng cấp AI, camera, BLE và dashboard |
| `d9af414` | docs: Cập nhật PLAN.md — đồng bộ tiến độ thực tế |
| `2307c33` | Hoàn thiện app + AI crack detection + Gemini integration |
| `0027fcf` | feat: cập nhật app & firmware — AI, camera, BLE, dashboard components, patrol/detection stores |
| `9a46c49` | Initial commit — Heriguard B4 Full Project (app + robot firmware) |