# CHANGELOG HERI-GUARD

Lịch sử thay đổi toàn bộ dự án (heriguard-app + heriguard-robot).

**Quy tắc:** Mỗi lần có thay đổi code/config/docs phải thêm mục mới vào đầu phần "Unreleased" (hoặc mục ngày tương ứng), ghi rõ: thay đổi gì, file nào, lý do.

## Unreleased

### 2026-08-13 — Fix LED không sáng (sai API setColor) + log lỗi DHT

**heriguard-robot `src/main.cpp`**
- **LED không bao giờ sáng từ đầu** — `MiniR4.LED.setColor(r, g, b, brightness)` là call sai: API thư viện MatrixMiniR4 là `setColor(idx, r, g, b)` với `idx` ∈ {1, 2} (2 LED WS2812B). Truyền tham số thứ nhất = 0 → `setColor` trả `false`, LED không đổi màu (xanh lá lúc kết nối trước đây thực ra chưa từng sáng — chỉ có còi). Thêm helper `setLedColor(r, g, b)` set cả 2 LED, thay toàn bộ 9 call cũ: xanh dương nhấp nháy khi chưa kết nối, xanh lá + còi khi connect, đỏ flash khi capture fail.
- `readSensor()`: in lỗi DHT ra serial (`getErrorString`: 253 timeout / 254 checksum) — nếu `T=0.0 H=0` thì biết ngay sensor MS-011 chưa gắn/đấu dây ở cổng D1 thay vì đoán mò.

### 2026-08-13 — Fix lưu ảnh JPEG từ robot (expo-file-system new API)

**heriguard-app `src/lib/ble.ts`**
- `saveJpegBytes()`: thay `root.createDirectory("")` (sai API — báo "child name must be a single path segment") bằng `root.create({ intermediates: true, idempotent: true })` — tạo đủ chuỗi `heriguard/camera/frames` và an toàn khi gọi lại.
- Thêm fallback khi `createFile` lỗi do file trùng tên (frameId lặp lại sau khi firmware reset): xoá file cũ rồi tạo mới — trước đây promise throw "Uncaught" và ảnh không hiển thị.

### 2026-08-13 — Fix lỗi kết nối "Device is not connected" khi auto-reconnect / scan

**heriguard-app `src/lib/ble.ts`**
- `connectToDevice()` → tách `doConnectToDevice()` + single-flight: nếu một luồng connect đang chạy (auto-reconnect ở dashboard + người dùng bấm Kết nối ở scan screen), lời gọi sau dùng chung promise đó. Trước đây hai luồng chạy song song, kết nối của luồng đầu bị luồng sau hủy → "BLE connect error: Device ... is not connected" khi discover service trên connection đã chết.
- `await device.isConnected()` (không phải property — ble-plx trả `Promise<boolean>`); vẫn giữ nguyên tắc không gọi `connect()` trên device đã connected.
- Bắt lỗi connect báo "already connected" (errorCode 5) → dùng thẳng device, KHÔNG `cancelConnection()` (trước đây sẽ giết kết nối đang sống).
- Discover thất bại với "not connected" (errorCode 6) / timeout (errorCode 2) → tự hủy kết nối rớt rồi `connect()` + discover lại 1 lần trước khi báo lỗi — xử lý trường hợp robot reset/hết pin/ra ngoài phạm vi ngay sau khi connect() resolve.
- `mapBleError()`: thêm message rõ ràng cho "not connected": robot tắt / ngoài phạm vi.

### 2026-08-13 — Fix ảnh camera + sensor không về app (mock off / BLE thật)

**heriguard-app `src/lib/ble.ts`**
- `subscribeToCharacteristic()`: monitor TRỰC TIẾP, bỏ gating qua `readCharacteristicForService().then(monitor)`. Trước đây nếu lần read đầu thất bại (điển hình charCamera 512B — long read dễ lỗi trên Android), `monitorCharacteristicForService` không bao giờ được gọi và lỗi bị `.catch(() => {})` nuốt im lặng → app **không nhận bất kỳ notification nào**: không ảnh, không sensor, không status. Nguyên nhân gốc của cả 2 lỗi "Chụp ảnh không gửi ảnh về" và "tắt mock thì nhiệt độ/độ ẩm không được ghi nhận".
- `connectToDevice()`: nếu `device.isConnected` đã đúng thì dùng thẳng device, không gọi `connect()` lại. Trước đây khi toggle mock OFF (settings gọi `stopMockBle()` reset state thành "disconnected" dù BLE thật vẫn sống), HomeScreen chạy `tryReconnectLastDevice()` → `connect()` trên device đã connected → lỗi → `cancelConnection()` **giết chết kết nối thật đang hoạt động** → sensor ngừng chảy.
- `tryReconnectLastDevice()`: guard sớm — nếu `bleConnected` trong dashboardStore đã true thì trả về true ngay (không kết nối lại làm gì).
- `handleMapMarker()`: thêm `addSensorLog()` (nhiệt độ/độ ẩm tại marker) vào phiên tuần tra — trước đây tuần tra BLE thật chỉ thêm marker, sensor log không bao giờ được ghi → lịch sử tuần tra trống dữ liệu nhiệt độ/độ ẩm.

**heriguard-robot `src/main.cpp`**
- `captureJpegFromCam()`: flush hết byte rác trong `Serial1` trước khi gửi trigger `'C'` — banner "CAM READY" lúc camera khởi động hoặc dữ liệu cũ còn trong buffer làm header `0xAA` sai → "bad header" → capture fail.
- `sendJpegViaBle()`: `delay(5)` → `delay(25)` giữa các chunk 206B — 5ms quá nhanh, Android thả notification khi GATT queue bận → thiếu chunk → app không bao giờ ghép đủ frame → ảnh không hiển thị.

### 2026-08-13 — Fix gửi lệnh BLE thất bại (invalid data format)

**heriguard-app `src/lib/ble.ts`**
- `sendCommand()`: mã hoá lệnh sang **Base64** trước khi `writeCharacteristicWithResponseForService` — ble-plx/Android từ chối chuỗi trần (`BleError: Cannot write ... invalid data format: C`). Nguyên nhân khiến nút "Bắt đầu tuần tra / Chụp ảnh / Dừng" bấm nhưng robot không nhận lệnh dù đã kết nối thành công (LED xanh lá).


### 2026-08-13 — Firmware: LED nhấp nháy xanh dương khi chưa kết nối BLE

**heriguard-robot `src/main.cpp`**
- Khi chưa kết nối BLE: LED RGB nhấp nháy màu xanh dương (chu kỳ 500ms, non-blocking bằng `millis()`) — người dùng biết robot đang chờ ghép nối.
- Khi kết nối thành công: đã có sẵn âm thanh còi (880Hz → 1100Hz) + LED chuyển xanh lá (`onBLEConnected`); giữ nguyên.
- Khi mất kết nối: LED về xanh dương và tiếp tục nhấp nháy (`onBLEDisconnected`).

### 2026-08-13 — Sửa lỗi kết nối BLE app (không lên LED xanh / không gửi được lệnh)

**heriguard-app `src/lib/ble.ts`**
- `connectToDevice()`: thêm timeout cho `device.connect()` (12s) và `discoverAllServicesAndCharacteristics()` (10s) — trước đây có thể kẹt vĩnh viễn ở trạng thái "connecting" khi Android không trả lời → mọi nút điều khiển chết âm thầm.
- `requestMTU(512)` không còn `await` — trên một số máy Android lời gọi này treo không bao giờ resolve; thất bại MTU chỉ giảm kích thước gói, không ảnh hưởng lệnh điều khiển.
- Lỗi kết nối giờ trả về message tiếng Việt rõ ràng (`mapBleError`): timeout, bị rớt, service không tìm thấy, lỗi cache/bond — màn hình quét hiển thị lý do thật thay vì "Thử lại" chung chung.
- `disconnect()` khi connect thất bại giữa chừng: `cancelConnection()` dọn kết nối dang dở.
- Thêm `tryReconnectLastDevice()` + lưu thiết bị cuối vào AsyncStorage (`heriguard:lastDevice`) → khi mở lại app, tự kết nối lại robot đã ghép, không phải quét lại từ đầu.
- `sendCommand()`: log lỗi thật (`console.warn`) để dễ debug khi write thất bại.

**heriguard-app `src/app/device/scan.tsx`**
- Hiển thị đúng lỗi kết nối trả về từ `connectToDevice()` (khớp kiểu trả về mới).

**heriguard-app `src/app/(tabs)/index.tsx`**
- Thanh trạng thái kết nối hiển thị đúng trạng thái thật: "Chưa kết nối BLE — vào Cài đặt để quét" / "Đang kết nối…" / "Đã kết nối BLE — {tên}" (trước đây luôn hiện "Đang kết nối…" khi chưa kết nối → gây hiểu nhầm).
- Khi không bật mock mode: tự gọi `tryReconnectLastDevice()` lúc mở dashboard.
- Không gọi `stopMockBle()` khi đang dùng BLE thật (trước đây cleanup có thể ghi đè trạng thái kết nối thật thành "disconnected").

**heriguard-app `src/components/dashboard/ControlPanel.tsx`**
- Nút điều khiển khả dụng khi `isConnected || mockMode`: khôi phục chế độ demo mock khi chưa có robot, đồng thời giữ ưu tiên BLE thật khi đã kết nối.
- Cảnh báo gửi lệnh thất bại có hướng dẫn: "Kiểm tra kết nối BLE với robot (Cài đặt → Quét thiết bị)".


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