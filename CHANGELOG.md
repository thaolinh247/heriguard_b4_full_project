# CHANGELOG HERI-GUARD

Lịch sử thay đổi toàn bộ dự án (heriguard-app + heriguard-robot).

**Quy tắc:** Mỗi lần có thay đổi code/config/docs phải thêm mục mới vào đầu phần "Unreleased" (hoặc mục ngày tương ứng), ghi rõ: thay đổi gì, file nào, lý do.

## Unreleased

### 2026-08-16 — Hoàn thiện port B3: junction rẽ 90° + xử lý mất line

**heriguard-robot `src/main.cpp`** (tiếp theo port B3)
- `updateJunctionCounters()` giờ trả về type junction vừa latch (1=trái, 2=phải).
- **Mới `handleJunction()`**: khi PATROL_MOVE gặp junction xác nhận (2 frame liên tiếp) → dừng, `turnToAngle()` rẽ vuông góc 90° theo IMU (B3 turnByAngle) → reset encoder + PID + runtime → tiếp tục đo 0.5m. Gọi từ `followRightEdgeStep()`.
- **Xử lý mất line**: `isLineLostBySensorRule()` (active < 2 sensor, ngưỡng LINE_THRESHOLD=30); 3 frame liên tiếp → dừng + log; mất > 3s → `EMERGENCY` + BLE status. Reset state trong `resetFollowRuntime()`.
- (Không port `pt_can_vuong_goc` — bàn 6m thẳng không có line cắt ngang; robot tự thẳng hàng với line.)

**Kiểm tra**: `pio run` SUCCESS.

### 2026-08-17 — AI chạy được trên máy thật + logic 'N' (robot chỉ chụp, app nhận diện) + mục "Lưu trữ theo node"

**Lý do**: user báo (1) AI không chạy trên máy thật (camera báo lỗi, ảnh mẫu không nhận diện — model chỉ chạy web), (2) muốn đổi logic "Chụp & Nhận diện": robot chỉ chụp, app nhận diện, nếu đạt ngưỡng thì lưu ảnh + nhiệt độ/độ ẩm tại node rồi phân tích như tuần tra, (3) cần thấy rõ phần lưu trữ theo node + so sánh giữa các lần tuần tra.

**heriguard-app**
- `src/ml/crack.ts`: port `loadGrayImage()` sang native — dùng `expo-image-manipulator` (resize 320×320 = lưới 5×5 ô 64×64) + `jpeg-js` (decode JPEG → grayscale) + `buffer`; giữ đường web (canvas). Hết lỗi "Bản thử nghiệm model cần chạy trên web" → camera/ảnh mẫu/gallery nhận diện được ngay trên máy thật.
- `src/lib/staticCapture.ts` (mới): luồng lệnh 'N' mới — nhận ảnh robot gửi → chạy `analyzeCrackOnDevice` → không đạt ngưỡng: chỉ hiện trên carousel (không lưu); đạt ngưỡng: lưu ảnh vào `patrols/{id}/node_{x}/` + nhiệt độ/độ ẩm tại điểm + phân tích như tuần tra bình thường + đồng bộ patrolStore/detectionStore/alertStore.
- `src/store/patrolStore.ts`: thêm `addCompletedPatrol()` — tạo phiên 1 ảnh từ lệnh 'N', đưa vào lịch sử.
- `src/lib/mockBle.ts`: lệnh 'N' giờ chụp ảnh asset thật của node và chạy **đúng model** (thay detection giả 0.72 cố định); kết quả nhận diện hiện trên carousel.
- `src/lib/ble.ts`: ảnh nhận khi **không có tuần tra** (lệnh 'N' thật) → `saveStaticCaptureFromUri()` thay vì chỉ bỏ vào imageHistory.
- `src/app/(tabs)/history.tsx`: thêm mục **"Lưu trữ theo node"** ở đầu tab — mỗi node 1 thẻ: ảnh từng lần tuần tra ngang hàng (thumbnail kèm ngày + mức severity), Δ diện tích vết nứt so lần trước, chạm vào mở `node-detail` so sánh chi tiết.
- `src/store/dashboardStore.ts`: `updateSensor()` chặn giá trị 0/NaN (DHT lỗi gửi 0 → không đè dữ liệu cũ).
- Cài thư viện (đã xin phép user): `expo-image-manipulator`, `jpeg-js`, `buffer`.

**heriguard-robot `src/main.cpp`**
- Lệnh `'N'` đổi thành **capture-only**: robot chỉ chụp JPEG + gửi nhiệt độ/độ ẩm + gửi ảnh qua BLE, KHÔNG còn detect trên robot (bỏ `readDetectionFromCam`, detection 12 byte, map marker) — model nhận diện chạy trên app.
- `readSensor()`: nếu DHT đọc lỗi hoặc giá trị ngoài phạm vi → **giữ giá trị hợp lệ gần nhất** (`lastGoodTemp`/`lastGoodHum`) thay vì trả 0 → app không "mất dữ liệu" nhiệt/ẩm.

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi; `pio run` SUCCESS (RAM 69.4%, Flash 47.5%).

### 2026-08-16 — Port tầng di chuyển + khởi động robot từ WRO 2026 B3

**heriguard-robot**
- **Mới `include/utils.h` + `src/utils.cpp`**: copy nguyên bộ `RobotUtils` từ B3 (không phụ thuộc hardware) — clamp, limitStep, deadband, exponentialFilter, servo step control (non-blocking, detect kẹt), `turnByAngle()` (xoay theo IMU với decel zone + timeout).
- **`src/main.cpp` — di chuyển thay bằng B3**:
  - Motor: `setTankRaw()`/`setTankSmoothed()` (mượt, giới hạn ±30/lần), `stopRobot()`, polarity `INVERT_LEFT=false` (M3), `INVERT_RIGHT=true` (M4).
  - PID chuẩn B3: KP=18, KI=0.002, KD=2, integral limit 8, filter alpha 0.45, deadband 0.05, base 46/min 24, max correction 72 — thay PID cũ (kp=1.5, integral không giới hạn).
  - Line sensor chuyển sang **I2C0** (`MXLineTracer.getAllSensors`) đúng robot thật (trước dùng I2C2), threshold 30; `computeZoneFollowError` bám cạnh phải (kênh 1-6, target 3.5).
  - Junction detection two-gate (width≥8 + kênh 9&10 cho cạnh phải) + `updateJunctionCounters` latch/debounce + còi — trong `patrolMove()` mỗi loop 1 bước `followRightEdgeStep()`.
  - `driveForwardCm()` (encoder M3, bánh 6.5cm), `followLineUntilLaserBelow()` (bám line tới khi laser < 200mm — dùng trong INSPECT_B thay while-loop cũ), `turnToAngle()` qua IMU Roll (board gắn đứng).
  - Khoảng cách 0.5m vẫn dùng trung bình encoder M3+M4; thêm fail-safe 15s/đoạn.
- **Khởi động**: `initRobot()` theo B3 — `MiniR4.begin()`, `PWR.setBattCell(2)`, LineTracer I2C0 + setThreshold(30), Laser I2C1, `Motion.begin()`, `initServosToHome()` (camera home: pan 90/fold 0/tilt 90/twist 90) + delay 400ms, `resetPid()`.
- `checkObstacle()` chỉ trigger khi `PATROL_MOVE` (trước trigger cả lúc INSPECT_B tiến tới tường ở 200mm → kẹt EMERGENCY); `handleJunction()` cũ bỏ (thay bằng junction counters).
- Giữ nguyên: BLE 1 service 6 chars, protocol 10-byte JPEG header / 12-byte detection, camera `'C'`/`'D'`, lệnh `P/X/C/N/S`, map marker 9 byte.

**Kiểm tra**: `pio run` SUCCESS (RAM 69.4%, Flash 47.5%).

### 2026-08-16 — Kịch bản demo app (DEMO-SCRIPT.md)

- Thêm `DEMO-SCRIPT.md` (gốc repo): kịch bản 3 chặng cho giám khảo WRO 2026 — (1) so sánh & lưu trữ theo node từ dữ liệu mẫu, (2) tuần tra trực tiếp qua mock/BLE, (3) edge AI 97.28% trên điện thoại không cần mạng — kèm checklist chuẩn bị, bản rút gọn 4 phút, và câu chốt trình bày.

### 2026-08-16 — Tái cấu trúc giả lập app: seed dữ liệu mẫu tự động + ảnh lưu node thật + camera/thư viện native

**Lý do**: user chưa thấy được compare & lưu trữ tại node (mock lưu ảnh 1×1 px, compare chỉ hiện sau 2+ tuần tra cùng node, History trống khi mở app), và camera hiện chỉ là web-view không chụp được trên máy thật.

**heriguard-app**
- `src/lib/fileStorage.ts`: thêm `savePatrolImageFromFile()` (copy JPEG asset thật vào `patrols/{id}/node_{x}/` thay vì base64 1×1) + `getNodeStorageDir()` (đường dẫn hiển thị UI).
- `src/lib/sim/simMedia.ts` (mới): ánh xạ node → ảnh asset ổn định (node 0–2 = bề mặt sạch wall/column, node 3+ = ảnh nứt heritage-cracks/wall-crack); `resolveSimUri()` dùng `expo-asset` để có file URI thật cho `copyAsync`.
- `src/lib/sim/seedDemoData.ts` (mới): tự sinh **3 lần tuần tra mẫu** (14/7/1 ngày trước), mỗi lần 7 node, diện tích nứt tăng dần theo thời gian (bbox rộng dần) → mở app là thấy ngay: History → chi tiết tuần tra → so sánh Δ → biểu đồ xu hướng → cảnh báo leo thang; đồng bộ `patrolStore.importPatrols()` + `detectionStore` + `alertStore` (4 cảnh báo trend node 3–6).
- `src/store/patrolStore.ts`: thêm action `importPatrols()` (merge + sắp mới nhất trước) cho seed.
- `src/app/_layout.tsx`: khởi động load lịch sử → nếu trống và chưa có demo trên đĩa thì `seedDemoData()` tự động.
- `src/app/patrol/node-detail.tsx`: thẻ "Lưu trữ tại node" hiển thị đường dẫn thư mục node thật trên đĩa.
- `src/lib/mockBle.ts`: mock patrol giờ lưu **JPEG thật** từ assets vào node folder (hết ảnh 1×1); detection/bbox vẫn tăng dần theo số lần tuần tra.
- `src/app/crack-recognition.tsx`: thay web-view bằng **camera native** (`expo-camera` `CameraView` + `takePictureAsync`) và **thư viện ảnh** (`expo-image-picker`) — chụp máy thật hoặc chọn ảnh từ gallery; giữ nguyên MLP 97.28% phân tích on-device + ảnh mẫu.
- Xóa file web-only: `src/lib/browser-camera.ts`, `src/components/BrowserCameraPreview.tsx` (đã thay bằng native).
- `app.json`: cài plugin `expo-camera` + `expo-image-picker` (bản quyền camera/thư viện tiếng Việt) + `CAMERA`, `READ_MEDIA_IMAGES`.
- Cài thư viện: `expo-camera`, `expo-image-picker` (SDK 57, đã xin phép user).

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi.

### 2026-08-16 — Hủy Plan "phương án B" (port MLP 97.28% lên M-Vision) — blocker lưu trữ

- **Lý do hủy**: khảo sát camera (GĐ 0) cho thấy flash trống chỉ **101 KB** (firmware chiếm gần hết 2 MB), không có khe SD → `crack_w.bin` (405 KB) không thể nạp. Thí nghiệm fp8/fp4 trên PC: fp8 giữ nguyên dung lượng (405 KB), fp4 còn 207 KB — đều vượt 101 KB; chỉ model ít trọng số hơn (≤ ~80 KB) mới vừa, nhưng pipeline huấn luyện không tồn tại trên git (branch `feature/edge-ai-recognition` chỉ chứa `crack-model.ts` nhúng + ảnh mẫu).
- **Đã revert**: xóa branch `feature/mvision-mlp-model`; xóa `PLAN-EDGE-AI-MVISION-MODEL.md`, `camera/model.py`, `camera/crack_w.bin`, `camera/crack_meta.json`, toàn bộ `tools/` (export/ground-truth/parity/quant-test); hoàn nguyên `.gitignore` + 2 mục changelog của plan B. Giữ nguyên toàn bộ Phase A/B/C, lệnh 'N', VirtualMap, mock BLE.
- **Hướng thay thế (đang đề xuất)**: chạy đúng model 97.28% (crack-model.ts) **trên app** với khung hình thật từ robot qua BLE/MQTT — điện thoại tắt mạng vẫn chạy (edge AI cục bộ), camera giữ heuristic (bbox + JPEG).

### 2026-08-16 — Lệnh test tĩnh 'N' (test camera/edge-AI không cần robot di chuyển)

**heriguard-robot `src/main.cpp`**
- `handleCommand()`: thêm lệnh `'N'` = static inspect — chụp JPEG + gọi edge-AI `'D'` + gửi detection 12 byte + map marker ngay khi robot đứng yên trên bàn (không cần Start Patrol). Dùng để test nhanh camera/edge-AI khi chưa có bàn chạy line.
- `sendDetectionViaBle()`: điền đúng temp/humidity vào 4 byte cuối (trước đây để 0 → app phải fallback sang dashboard).

**heriguard-app**
- `src/components/dashboard/ControlPanel.tsx`: nút "Chụp ảnh" → gửi `'N'`, đổi nhãn "Chụp + Nhận diện" — bấm 1 phát là thấy ảnh + detection, không cần chạy tuần tra.
- `src/lib/mockBle.ts`: `mockSendCommand()` trả `boolean` (sửa bug có sẵn: mock mode bấm nút luôn hiện alert "Không gửi được lệnh" vì `void` → `!ok` luôn đúng); thêm case `'N'` — mock thêm ảnh + detection giả (crack_small 72%).

**Kiểm tra**: firmware `pio run` SUCCESS; app `tsc --noEmit` 0 lỗi, `expo lint` 0 lỗi (1 warning có sẵn trong BrowserCameraPreview.tsx, không liên quan).

### 2026-08-16 — Bản đồ mô phỏng: ảnh guard làm nền + chấm đỏ điểm dừng

**heriguard-app**
- `src/components/dashboard/VirtualMap.tsx`: thay bản đồ dải chấm ngang cũ bằng **bản đồ mô phỏng** — dùng ảnh `assets/images/guard.png` làm nền bản đồ (resizeMode cover), vẽ đường tuần tra ngang qua giữa, và **chấm đỏ (`Colors.lacquer`) tại từng điểm robot dừng** (marker theo `distanceX2`, tỷ lệ theo quãng đường tối đa). Chạm vào chấm xem tooltip chi tiết (vấn đề, nhiệt độ/độ ẩm). Thêm chú thích dưới bản đồ; dedupe marker trùng vị trí.
- **Kiểm tra**: `tsc --noEmit` 0 lỗi, `expo lint` 0 lỗi mới.

### 2026-08-16 — Phase B+C: Firmware Edge-AI thật + protocol 10/12-byte + UI chi tiết tuần tra

**heriguard-robot `src/main.cpp`**
- **Detection thật thay mock**: `inspectWide()` bỏ `random()` — gọi `captureJpegFromCam()` + `readDetectionFromCam()` (lệnh `'D'` lên camera), có issue → INSPECT_B, sạch → INSPECT_E. Gửi cờ MOSS/MOLD/STAIN/CRACK qua map marker tương ứng.
- **Bật INSPECT_B/C/D** trong `runStateMachine()` (trước bị comment): chụp cận khi pan phải/trái — `inspectCloseApproach()`, `inspectScanLow()`, `inspectScanHigh()` (mỗi vị trí capture + detect + send). Thêm `inspectRetractFull()`.
- **Servo điều khiển camera**: define `SERVO_PAN_L/C/R` (45/90/135), `SERVO_TILT_LOW/HIGH/HOME` (45/135/90), `SERVO_TWIST_*`, hàm `servoHome()` (gọi khi bắt đầu tuần tra) + `servoPan()`.
- **Header JPEG 10 byte** (trước 6): `frameId(2)+nodeX2(1)+shotKind(1)+pan(1)+tilt(1)+chunkIdx(2)+totalChunks(2)` — app hết phải suy đoán node.
- **Detection char 12 byte** (trước 10): `label(1)+confidence(1)+nodeX2(1)+shotKind(1)+bbox(4)+temp(2)+humidity(2)` qua `sendDetectionViaBle()`; `sendMapMarker()` nay nhận cờ 8-bit.
- **Junction**: thêm `handleJunction()` (rẽ phải vuông góc theo cảm biến dừng) — chưa gọi trong `patrolMove()` (để dành bước tiếp theo).
- `MAX_DETECTIONS = 8` — camera trả tối đa 8 kết quả.

**heriguard-robot `camera/main.py`**
- Lệnh `'D'` phân loại **5 label**: crack_small/crack_large (eccentricity > 0.6 + diện tích), moss/mold/stain (3 ngưỡng màu riêng) — giảm false positive do bóng/rêu/nấm mốc. Trả `0xDD + count + N×6 byte [x,y,w,h,label,confidence]` (bbox QQVGA ÷4).

**heriguard-app**
- `src/lib/ble.ts`: `handleCameraChunk()` parse header 10 byte (nodeX2/shotKind/pan/tilt **từ firmware**); `handleDetectionData()` parse 12 byte — bbox ×4 về 640x480, temp/humid từ packet (fallback dashboardStore). Detection được đưa vào `patrolStore.addDetectionEvent()` + alert khi confidence cao.
- **Mới `src/app/patrol/[id].tsx`**: màn chi tiết tuần tra — card tổng quan, NodeCard từng node (badge severity, ảnh node, detection meta, delta vs tuần tra trước, TimelineChart, cảnh báo escalation), điều hướng tới node-detail.
- **Mới `src/app/patrol/node-detail.tsx`**: so sánh ảnh trước/sau (ImageCompareCard), deltaCard (deltaArea %, confidence, nhiệt độ), timeline chart, chip góc chụp (SHOT_KIND_LABELS).
- `src/app/(tabs)/history.tsx`: thêm **patrol list với node summaries** — tên + ngày, số node/ảnh, chấm severity, dòng cảnh báo node có dấu hiệu; chạm vào → `/patrol/{id}`.
- `src/store/patrolStore.ts`: `endPatrol()` chạy `shouldEscalateForConsecutiveGrowth()` cho từng node/shot → `useAlertStore.addAlert({ type: "crack_increased" })` khi diện tích tăng liên tiếp qua các tuần tra.
- **Kiểm tra**: `tsc --noEmit` 0 lỗi (regenerate typed routes cho 2 route patrol mới), `expo lint` 0 lỗi (dọn import thừa trong `[id].tsx` — useEffect, SHOT_KIND_LABELS, RiskColors, biến timelineAll), firmware `pio run` SUCCESS 0 warning.

### 2026-08-15 — Phase A: Node-based image storage + patrol persistence + comparison

**heriguard-app** (toàn bộ phía app, không cần đổi firmware)

- **Mới `src/lib/analyze.ts`**: phân tích 1 ảnh đơn — kết hợp detection Edge-AI (confidence + bbox area) với môi trường (temp/humidity/laser) → severity (low/medium/high) + findings tiếng Việt. `shouldEscalateForTrend()` cho logic cảnh báo.
- **Mới `src/lib/compare.ts`**: so sánh cùng node giữa các lần tuần tra — `findPreviousImage()` (khớp nodeX2 + shotKind), `computeNodeDelta()` (deltaArea %, deltaConfidence, delta temp/hum, trend), `getNodeTimeline()` (chuỗi thời gian cho chart), `shouldEscalateForConsecutiveGrowth()` (cảnh báo tăng liên tiếp).
- **Mới `src/types/robot.ts`**: `NodeImage` (uri, frameId, nodeX2, shotKind, pan/tilt, detection, analysis), `DetectionEvent` (link detection → node + shot), mở rộng `PatrolSession` với `images[]`, `detections[]`, giữ `imageUris[]` tương thích ngược. Thêm `SHOT_KIND_LABELS`, `CrackSeverity`.
- **Mới `src/lib/fileStorage.ts`**: `savePatrolImage()` → lưu ảnh vào `Documents/heriguard/patrols/{id}/node_{nodeX2}/shot_{kind}_{frameId}.jpg` + cập nhật `patrol.json` manifest; `readPatrolJson()`, `updatePatrolJson()`, `listPatrolDirs()`, `loadPersistedPatrols()`.
- **`src/store/patrolStore.ts`**: `addNodeImage()`, `addDetectionEvent()`, `endPatrol()` (ghi patrol.json lên đĩa), `loadPersistedHistory()` (đọc tất cả tuần tra khi khởi động app → dữ liệu sống sót qua restart).
- **`src/lib/ble.ts`**: `handleCameraChunk()` lưu ảnh theo node + cập nhật patrol khi tuần tra đang chạy (fallback legacy khi không có patrol); `handleDetectionData()` tạo `DetectionEvent` gắn nodeX2/shotKind.
- **`src/lib/mockBle.ts`**: mock có tính lặp lại — cùng node = cùng URI ảnh qua các tuần tra, detection tăng dần theo số tuần tra (demo xu hướng vết nứt, ~43% tăng).
- **`src/app/_layout.tsx`**: gọi `loadPersistedHistory()` khi app khởi động.
- **Sửa lỗi TS**: type predicate `TimelinePoint` (severity dùng `CrackSeverity`), `NodeImage.detection/analysis` cho phép `null` (khớp JSON khi persist), bỏ import thừa, bỏ `as any` trong mockBle. Regenerate typed routes (fix lỗi sẵn có `router.push("/crack-recognition")`).
- Docs mới: `QUICK-START.md` (hướng dẫn test), `PHASE-A-COMPLETION.md`, `PHASE-A-TESTING.md`, `EDGE-AI-ASSESSMENT.md`.

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