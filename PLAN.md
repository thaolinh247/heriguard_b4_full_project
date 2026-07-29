# HERI-GUARD — Kế hoạch dự án tổng thể

> **Đội NovaCulture — WRO 2026 Future Engineers**

---

## 1. Giới thiệu

HERI-GUARD là hệ thống robot tuần tra tự hành kết hợp ứng dụng di động, giám sát môi trường và phát hiện hư hại di tích văn hóa. Robot tự động dò line, dừng mỗi **0.5m** để quét camera AI 2 tầng (Wide Scan → Close Scan nếu nghi ngờ), gửi dữ liệu cảm biến + ảnh + bản đồ ảo lên app qua **BLE 5.0**.

### Kênh giao tiếp duy nhất: BLE

Robot và app giao tiếp trực tiếp qua BLE 5.0, không cần WiFi router — phù hợp di tích xa, không có hạ tầng mạng.

```
Robot (Mini R4)  ←─── BLE 5.0 ───→  App (Expo/React Native)
   BLE Server                      BLE Client
   - Notify: sensor, camera,       - Subscribe: sensor, camera,
     detection, status               detection, status
   - Write handler:                 - Write: command (start/stop/
     command từ app                   capture/speed)
```

---

## 2. Kiến trúc hệ thống

### 2.1 Tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HERI-GUARD Robot                           │
│                                                                     │
│  ┌──────────┐  UART    ┌────────────────────┐  I2C  ┌───────────┐ │
│  │M-Vision  │─────────→│  MATRIX Mini R4    │──────→│Line Tracer│ │
│  │Cam       │ 921600   │  (ESP32-S3)        │       │V2 (10CH)  │ │
│  │(OpenMV)  │          │                    │  I2C  └───────────┘ │
│  │          │          │  State machine:    │──────→┌───────────┐ │
│  │- JPEG    │          │  PATROL_MOVE       │       │Laser V2   │ │
│  │- Crack   │          │  INSPECT_A (Wide)  │       │(21-1999mm)│ │
│  │  detect  │          │  INSPECT_BCD (Sâu) │       └───────────┘ │
│  └──────────┘          │  INSPECT_E (Retract)│                     │
│                        │                    │  D1   ┌───────────┐ │
│                        │  Encoder → 0.5m    │──────→│DHT MS-011 │ │
│                        │  PID line follow    │       │(Temp/Hum) │ │
│                        │  Servo RC1-4        │       └───────────┘ │
│                        │  BLE Server         │                     │
│                        └─────────┬──────────┘                     │
│                                  │ BLE 5.0                         │
└──────────────────────────────────┼─────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        HERI-GUARD Mobile App                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  BLE Layer: scan → connect → subscribe notifies → write cmds │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Dashboard │ │Camera    │ │Biểu đồ  │ │AI Phân  │ │Cài đặt  │ │
│  │- Control │ │- Ảnh     │ │- Line   │ │tích     │ │- BLE    │ │
│  │  panel   │ │  JPEG    │ │  chart  │ │- Xu     │ │  scan   │ │
│  │- State   │ │- OSD     │ │- Bảng   │ │  hướng  │ │- Mock   │ │
│  │  indicator│ │- Marker  │ │  dữ liệu│ │- Đề    │ │  mode   │ │
│  │- Bản đồ  │ │          │ │         │ │  xuất   │ │          │ │
│  │  ảo      │ │          │ │         │ │          │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 BLE Service & Characteristics

```
Service: 12345678-1234-5678-1234-56789abcdef0
├── Camera Data   (NOTIFY) ...def1  — JPEG chunks: [frameId2][idx2][total2][data]
├── Detection     (NOTIFY) ...def2  — [label][confidence]
├── Sensor Data   (NOTIFY) ...def3  — [temp_lo][temp_hi][hum_lo][hum_hi] (hundredths)
├── Command       (WRITE) ...def4   — 'C'apture / 'P'atrol / 'X'stop / 'S'peed
├── Status        (NOTIFY) ...def5  — [battery][rssi][state]
└── Map Data      (NOTIFY) ...def6  — [distance_marker][issue_type][confidence][temp][hum]
```

> **Ghi chú:** `Map Data` (char ...def6) là characteristic **mới** — gửi từng marker trên bản đồ ảo mỗi khi robot inspect xong 1 điểm 0.5m. Cần thêm ở cả firmware và app.

---

## 3. Logic vận hành (State Machine)

### 3.1 State Machine tổng thể

```
PATROL_MOVE
  (line follow PID + đếm encoder)
       │
       ▼ (đi đủ 0.5m → dừng)
INSPECT_A — WIDE_SCAN (bắt buộc)
  - Chụp 1 ảnh, AI detect nhanh
  - Đọc DHT → gửi Sensor Data
  - Đọc Laser (nếu vật cản → RETREAT)
       │
       ├── Không nghi ngờ ──────────┐
       │                            │
       ▼ Có nghi ngờ                │
INSPECT_B — CLOSE_APPROACH          │
  - Laser đo khoảng cách            │
  - Tiến đến 15-20cm                │
       │                            │
       ▼                            │
INSPECT_C — SCAN_LOW                │
  - RC3 hạ cam, RC4 xoay góc thấp   │
  - RC1 pan trái → giữa → phải      │
  - Mỗi vị trí: chụp + AI detect    │
  - Nếu phát hiện thật: chụp cận    │
    → gửi Detection + ảnh + DHT     │
       │                            │
       ▼                            │
INSPECT_D — SCAN_HIGH               │
  - RC3 nâng cam, RC4 xoay góc cao  │
  - RC1 pan trái → giữa → phải      │
  - Mỗi vị trí: chụp + AI detect    │
       │                            │
       ▼                            ▼
INSPECT_E — RETRACT (chung cả 2 nhánh)
  - RC2 gập camera về vị trí an toàn
  - Căn lại line (đọc Line Tracer)
  - Ghi marker vào virtual map queue
       │
       ▼
PATROL_MOVE (tiếp tục đến 0.5m kế)
```

### 3.2 Cấu trúc virtual map marker

```cpp
struct MapMarker {
  uint8_t distance_x2;  // 0.0m → 0, 0.5m → 1, 1.0m → 2, ... (tính bằng nửa mét)
  uint8_t flags;        // bit0:low_issue, bit1:high_issue, bit2:moss, bit3:mold, bit4:stain, bit5:crack_small, bit6:crack_large
  uint8_t confidence;   // 0-100
  int16_t temperature;  // hundredths °C
  uint16_t humidity;    // hundredths %
  uint16_t timestamp;   // seconds since start
};
// Kích thước: 9 bytes/marker → gửi qua Map Data characteristic
```

### 3.3 Priority loop (main loop)

```
Vòng lặp chính (~20-50ms mỗi cycle):
  1. Nhận lệnh 'X' Stop từ app → dừng ngay, ưu tiên tuyệt đối
  2. Laser phát hiện vật cản → dừng/né
  3. IMU nghiêng bất thường → giảm tốc
  ---
  4. State == PATROL_MOVE  → line follow PID, encoder đủ 0.5m → INSPECT_A
  5. State == INSPECT_A    → wide scan → có nghi? BCD : E
  6. State trong {B, C, D} → mỗi cycle 1 sub-step, chia nhỏ
  7. State == INSPECT_E    → retract → PATROL_MOVE
  ---
  8. Queue ảnh → gửi vài chunk/cycle (không block)
  9. Gửi Sensor/Status định kỳ ~2-5s
  10. Nhận lệnh mới 'C'/'P'/'S' → xử lý
```

### 3.4 Ước tính thời gian

| Thành phần | Thời gian |
|-----------|-----------|
| Di chuyển 0.5m (line follow) | ~1-2s |
| Wide Scan (mỗi điểm) | ~1s |
| Close + Scan Low + High | ~5-8s |
| **Track 6m = 12 điểm dừng** | |
| 12 × (1-2s + 1s) + 2-3 × (5-8s) | **≈ 40-60s** |

---

## 4. Chức năng & Công việc cần làm

### 4.1 Robot — Firmware (`heriguard-b4/src/main.cpp`)

| # | Chức năng | Mô tả | Việc cần làm |
|---|-----------|-------|-------------|
| 1 | BLE Server | 6 characteristics, advertise "HERI-GUARD-R4" | ✅ Đã viết cơ bản. Cần thêm charMapData (...def6) |
| 2 | DHT sensor | Đọc nhiệt/ẩm mỗi 2s | ✅ Đã có. Cần tích hợp vào INSPECT_A (đọc thêm tại điểm phát hiện) |
| 3 | Battery monitor | Đọc pin, gửi status | ✅ Đã có. Cần gửi kèm state hiện tại |
| 4 | Command handler | Nhận 'C'/'P'/'X'/'S' | ✅ Đã viết cơ bản. Cần xử lý state transition |
| 5 | **State machine** | PATROL_MOVE → A → BCD → E | ⬜ **Phải viết mới** — hàm `runStateMachine()` gọi trong loop |
| 6 | **Line following PID** | Đọc Line Tracer error, PID → M3/M4 | ⬜ **Phải viết mới** — `MiniR4.I2C2.MXLineTracer.getError()` |
| 7 | **Encoder đếm 0.5m** | `MiniR4.M3.getDegrees()` → quy đổi mét | ⬜ **Phải viết mới** — cần calibrate PPR/RPM |
| 8 | **Junction detection** | `getJunctionType()` → rẽ | ⬜ **Phải viết mới** |
| 9 | **Wide Scan (INSPECT_A)** | Chụp ảnh AI detect nhanh, đọc DHT | ⬜ **Phải viết mới** |
| 10 | **Close Approach (B)** | Laser đo khoảng, tiến 15-20cm | ⬜ **Phải viết mới** |
| 11 | **Scan Low (C)** | RC3 hạ cam, RC4 góc thấp, RC1 pan 3 vị trí | ⬜ **Phải viết mới** |
| 12 | **Scan High (D)** | RC3 nâng cam, RC4 góc cao, RC1 pan 3 vị trí | ⬜ **Phải viết mới** |
| 13 | **Servo control** | RC1 (ngang), RC2 (gập), RC3 (nâng), RC4 (xoay) | ⬜ **Phải viết mới** — cần `setAngle()` |
| 14 | **Retract (E)** | Gập camera, căn line | ⬜ **Phải viết mới** |
| 15 | **Laser obstacle** | `MXLaserV2.getDistance()` → dừng/né | ⬜ **Phải viết mới** |
| 16 | **IMU** | `Motion.getAccelY()` → giữ thăng bằng, phát hiện nghiêng | ⬜ **Phải viết mới** |
| 17 | **Virtual map** | Ghi marker sau mỗi inspect, gửi BLE | ⬜ **Phải viết mới** |
| 18 | **Camera JPEG chunk** | Nhận JPEG UART → chunk → notify | ⬜ Chờ Phase 3 |
| 19 | **SmartCam detection** | Đọc detection từ camera | ⬜ Chờ Phase 3 |
| 20 | **OLED display** | Hiển thị state, sensor, BLE status | ✅ Đã có. Cần thêm state |
| 21 | **Buzzer/LED** | Âm thanh + đèn theo state | ✅ Đã có cơ bản |

### 4.2 App — Mobile (`heriguard-app/src/`)

| # | Chức năng | File | Việc cần làm |
|---|-----------|------|-------------|
| 1 | BLE scan + connect | `lib/ble.ts` | ✅ Đã có. Cần thêm subscribe charMapData |
| 2 | Sensor data receive | `lib/ble.ts` → `dashboardStore` | ✅ Đã có |
| 3 | Camera chunk reassembly | `lib/ble.ts` | ✅ Đã có |
| 4 | Status data (battery + state) | `lib/ble.ts` → `deviceStore` | ⬜ **Sửa** — cần parse robot state byte |
| 5 | **Map data handler** | `lib/ble.ts` → `patrolStore` | ⬜ **Phải viết mới** — parse MapMarker, cập nhật virtual map |
| 6 | **ControlPanel component** | `components/dashboard/ControlPanel.tsx` | ⬜ **Phải tạo mới** — 3 nút Start/Capture/Stop |
| 7 | **StateIndicator component** | `components/dashboard/StateIndicator.tsx` | ⬜ **Phải tạo mới** — badge trạng thái robot |
| 8 | **VirtualMap component** | `components/dashboard/VirtualMap.tsx` | ⬜ **Phải tạo mới** — trực quan hóa map markers |
| 9 | **patrolStore** | `store/patrolStore.ts` | ⬜ **Phải tạo mới** — patrol state, virtual map data |
| 10 | **deviceStore sửa** | `store/deviceStore.ts` | ⬜ **Sửa** — thêm `robotState`, `patrolActive` |
| 11 | **Dashboard sửa** | `app/(tabs)/index.tsx` | ⬜ **Sửa** — thêm ControlPanel + StateIndicator + VirtualMap |
| 12 | **Camera tab sửa** | `app/(tabs)/camera.tsx` | ⬜ **Sửa** — thêm markers từ virtual map lên ảnh |
| 13 | **History tab sửa** | `app/(tabs)/history.tsx` | ⬜ **Sửa** — hiển thị patrol history từ patrolStore |
| 14 | **AI tab sửa** | `app/(tabs)/ai.tsx` | ⬜ **Sửa** — thêm phân tích dựa trên virtual map data |
| 15 | **Settings tab** | `app/(tabs)/settings.tsx` | ✅ Đã có BLE mock mode |
| 16 | **Mock BLE sửa** | `lib/mockBle.ts` | ⬜ **Sửa** — mock thêm robot state + virtual map |
| 17 | **Types sửa** | `types/robot.ts` | ⬜ **Sửa** — thêm `RobotState`, `MapMarker`, `PatrolSession` |
| 18 | **Alert system** | `store/alertStore.ts` | ✅ Đã có store. Cần kết nối detection → alert |
| 19 | **Notification** | — | ⬜ TODO — expo-notifications khi high risk |
| 20 | **BLE detection char** | `lib/ble.ts` | ⬜ **Cần thêm** — subscribe CHAR_DETECTION |

### 4.3 Camera — OpenMV Script (`main.py` trên M-Vision Cam)

| # | Chức năng | Việc cần làm |
|---|-----------|-------------|
| 1 | Chụp JPEG + gửi UART | ⬜ **Phải viết mới** — `img.compress(quality=80)`, header + checksum |
| 2 | AI crack detection | ⬜ **Phải viết mới** — `find_blobs()`, gửi bounding box |
| 3 | Tăng baud 921600 | ⬜ Cấu hình UART |
| 4 | Trigger từ Mini R4 (TX) | ⬜ Nhận tín hiệu từ UART để chụp theo yêu cầu |

---

## 5. Các bước thực hiện (Phases)

### Phase 1: BLE Foundation + Sensor (3-4 ngày)

Trọng tâm: BLE server, sensor data, command handler cơ bản, app dashboard.

#### Firmware

| Task | File | Chi tiết |
|------|------|----------|
| BLE server | `src/main.cpp` | Service + 6 characteristics, advertise |
| DHT sensor | `src/main.cpp` | Đọc mỗi 2s, gửi notify |
| Battery | `src/main.cpp` | `getBattPercentage()` → status char |
| Command handler | `src/main.cpp` | 'C','P','X','S' → switch case, state machine hook |
| OLED | `src/main.cpp` | State + sensor + BLE status |
| LED/Buzzer | `src/main.cpp` | Connect/disconnect, state change |

#### App

| Task | File | Chi tiết |
|------|------|----------|
| BLE scan/connect | `src/lib/ble.ts` | ✅ Đã có. Kiểm thử với robot thật |
| Sensor data | `src/lib/ble.ts` → `dashboardStore` | ✅ Đã có |
| ControlPanel | `src/components/dashboard/ControlPanel.tsx` | **Tạo mới**: nút Start (gửi 'P'), Capture ('C'), Stop ('X' — nổi bật, đỏ) |
| StateIndicator | `src/components/dashboard/StateIndicator.tsx` | **Tạo mới**: badge trạng thái robot với màu sắc |
| Device store sửa | `src/store/deviceStore.ts` | Thêm `robotState: RobotState`, `patrolActive` |
| Robot types | `src/types/robot.ts` | Thêm `RobotState`, `PatrolCommand` |
| Dashboard sửa | `src/app/(tabs)/index.tsx` | Thêm ControlPanel + StateIndicator vào layout |
| Mock BLE sửa | `src/lib/mockBle.ts` | Mock state transitions, command responses |

#### Kiểm thử

- App kết nối BLE với robot
- App gửi 'P' → robot nhận, in serial
- App nhận sensor data, dashboard update
- App gửi 'X' → robot dừng
- Mock mode hoạt động offline

---

### Phase 2: Patrol + State Machine (5-6 ngày)

Trọng tâm: Line following, encoder, PID, state machine 5 bước, virtual map.

#### Firmware

| Task | File | Chi tiết |
|------|------|----------|
| Line Tracer init | `src/main.cpp` | `MXLineTracer.begin()` + `getError()` + `getAllSensors()` |
| PID controller | `src/main.cpp` | `error → kp*e + ki*∫e + kd*Δe → M3/M4.setSpeed()` |
| Motor calibration | `src/main.cpp` | `setPPR_RPM(390, 180)`, encoder deg → meter |
| Encoder 0.5m | `src/main.cpp` | `getDegrees()`, quy đổi, reset khi đạt mốc |
| Junction detection | `src/main.cpp` | `getJunctionType()`: 0=straight, 1=T-left, 2=T-right, 3=cross, 4=end |
| Junction handling | `src/main.cpp` | Rẽ trái/phải khi gặp junction theo lộ trình |
| State machine | `src/main.cpp` | Hàm `runStateMachine()` — switch state, sub-steps |
| INSPECT_A | `src/main.cpp` | Wide scan: chụp ảnh + DHT + AI detect → quyết định |
| INSPECT_E | `src/main.cpp` | Retract: gập cam, căn line |
| Laser obstacle | `src/main.cpp` | `getDistance()` < 200mm → dừng |
| Virtual map | `src/main.cpp` | Ghi `MapMarker` → gửi qua charMapData |
| IMU | `src/main.cpp` | `Motion.getAccelY()` — nghiêng? giảm tốc |
| Servo base | `src/main.cpp` | `RC1.begin()` ... `setAngle()`, home position |

#### App

| Task | File | Chi tiết |
|------|------|----------|
| patrolStore | `src/store/patrolStore.ts` | **Tạo mới**: `patrols[]`, `currentMapMarkers[]`, `addMarker()`, `startPatrol()`, `endPatrol()` |
| Map data handler | `src/lib/ble.ts` | Subscribe charMapData, parse → patrolStore |
| VirtualMap | `src/components/dashboard/VirtualMap.tsx` | **Tạo mới**: scrollable timeline, markers màu theo severity |
| StateIndicator | — | ✅ Đã tạo ở Phase 1, refine UI |
| Dashboard sửa | `src/app/(tabs)/index.tsx` | Thêm VirtualMap card |
| Device store sửa | `src/store/deviceStore.ts` | Thêm `robotState` update từ status char |
| Types sửa | `src/types/robot.ts` | Thêm `MapMarker`, `PatrolSession` |
| Mock BLE sửa | `src/lib/mockBle.ts` | Mock virtual map data |

#### Kiểm thử

- Robot chạy line thẳng, dừng đúng 0.5m
- State machine tuần tự: PATROL_MOVE → INSPECT_A → RETRACT
- App nhận map markers, hiển thị trên VirtualMap
- Laser phát hiện vật cản → dừng
- Gặp junction → rẽ đúng hướng

---

### Phase 3: Scan Low/High + Servo (3-4 ngày)

Trọng tâm: Servo pan/tilt, 2-level scan, crack detection.

#### Firmware

| Task | File | Chi tiết |
|------|------|----------|
| INSPECT_B | `src/main.cpp` | Close approach: laser đọc khoảng, tiến 15-20cm |
| INSPECT_C | `src/main.cpp` | Scan Low: RC3=45°, RC4=0°, RC1 pan 3 vị trí |
| INSPECT_D | `src/main.cpp` | Scan High: RC3=135°, RC4=180°, RC1 pan 3 vị trí |
| Servo angles | `src/main.cpp` | Calibrate RC1-RC4, home position cho retract |
| SmartCamReader | `src/main.cpp` | `MiniR4.Vision.SmartCamReader()` — label + confidence |
| Detection send | `src/main.cpp` | Gửi detection qua charDetection + kèm ảnh |

#### App

| Task | File | Chi tiết |
|------|------|----------|
| Detection handler | `src/lib/ble.ts` | Subscribe charDetection, parse |
| Detection store | `src/store/detectionStore.ts` | **Tạo mới** (hoặc mở rộng patrolStore) |
| AI tab sửa | `src/app/(tabs)/ai.tsx` | Thêm phân tích dựa trên detection từ robot |
| Camera tab sửa | `src/app/(tabs)/camera.tsx` | Hiển thị bounding box trên ảnh |
| History tab | `src/app/(tabs)/history.tsx` | Thêm filter theo phát hiện |

#### Kiểm thử

- Servo pan/tilt đúng góc
- Wide Scan → nghi ngờ → Close Approach → Scan Low/High
- App nhận detection + ảnh
- AI tab phân tích detection

---

### Phase 4: Camera JPEG + UART (3-4 ngày)

Trọng tâm: M-Vision Cam UART, JPEG chunk, BLE notify.

#### Firmware

| Task | File | Chi tiết |
|------|------|----------|
| Camera UART | `src/main.cpp` | Serial1 921600 baud, nhận JPEG |
| JPEG chunker | `src/main.cpp` | Chia JPEG → [frameId][idx][total][payload] |
| BLE notify chunks | `src/main.cpp` | Gửi tuần tự qua charCamera, queue không block |
| CRC check | `src/main.cpp` | Verify checksum từ camera |

#### Camera Script (OpenMV)

| Task | File | Chi tiết |
|------|------|----------|
| JPEG send | `main.py` | `sensor.snapshot()` → `compress()` → UART write |
| Crack detect | `main.py` | `find_blobs()` → bounding box → UART |
| UART 921600 | `main.py` | `UART(3, 921600)` |

#### App

| Task | File | Chi tiết |
|------|------|----------|
| JPEG reassembly | `src/lib/ble.ts` | ✅ Đã có. Kiểm thử với robot thật |
| File storage | `src/lib/fileStorage.ts` | Lưu JPEG bằng expo-file-system |
| Camera tab | `src/app/(tabs)/camera.tsx` | ✅ Đã có carousel. Cần load từ file system |

#### Kiểm thử

- Camera chụp JPEG, gửi UART → Mini R4 nhận
- Mini R4 chunk → BLE → app nhận → hiển thị
- End-to-end: patrol → detect → chụp → gửi → hiển thị

---

### Phase 5: Alert + Notification (1-2 ngày)

#### App

| Task | File | Chi tiết |
|------|------|----------|
| Alert system | `src/store/alertStore.ts` | ✅ Đã có. Kết nối với detection store |
| Local notification | `src/hooks/useNotification.ts` | `expo-notifications` khi high risk |
| Alert tab | `src/app/(tabs)/alerts.tsx` | **Tạo mới** (hoặc thêm trong history) |

---

### Phase 6: Testing + Demo (2-3 ngày)

| Task | Chi tiết |
|------|----------|
| Test line follow 6m track | Robot chạy hết track, dừng đúng 0.5m |
| Test state machine | Tất cả state transitions đúng |
| Test camera + detection | Phát hiện vết nứt thật, gửi ảnh |
| Test app control | Start/Stop/Capture từ app |
| Test virtual map | Map markers hiển thị đúng vị trí |
| Test end-to-end | 1 lượt tuần tra hoàn chỉnh |
| Demo prep | Video, slides, presentation |

---

### Phase 7: Gemini AI Integration (1-2 ngày)

Trọng tâm: Tích hợp Gemini 1.5 Flash phân tích ảnh + sensor data tổng hợp.

#### App

| Task | File | Chi tiết |
|------|------|----------|
| Gemini types | `src/types/gemini.ts` | ✅ Đã tạo — `GeminiAnalysis`, `GeminiFinding` |
| Gemini API lib | `src/lib/gemini.ts` | ✅ Đã tạo — REST API, gửi ảnh base64 + prompt, parse JSON response |
| Mock Gemini | `src/lib/mockGemini.ts` | ✅ Đã tạo — 3 kịch bản: low (an toàn), medium (rêu), high (nứt + mốc) |
| Settings store | `src/store/settingsStore.ts` | ✅ Đã sửa — thêm `geminiApiKey`, `geminiMockMode` |
| AI tab | `src/app/(tabs)/ai.tsx` | ✅ Đã sửa — thay rule-based bằng gọi Gemini, hiển thị severity badge + findings + correlations + recommendations |

#### Kiểm thử

- [ ] Mock mode: hiển thị 3 kịch bản phân tích
- [ ] Gemini thật: gửi ảnh + sensor → nhận kết quả JSON
- [ ] Ảnh không có: vẫn phân tích được dựa trên sensor data
- [ ] Loading state: ActivityIndicator khi đợi API
- [ ] Error state: hiển thị lỗi nếu API fail
- [ ] AI tab hiển thị đúng: severity badge, findings, env assessment, correlations, recommendations

---

## 6. Tổng hợp files thay đổi

### 6.1 Firmware — `heriguard-b4/`

| File | Thay đổi |
|------|---------|
| `src/main.cpp` | **Viết lại toàn bộ** — thêm state machine, PID, encoder, servo, virtual map, camera UART |
| `platformio.ini` | ✅ Đã sửa — thêm ArduinoBLE, bỏ PubSubClient |
| `PLAN.md` | File này |

### 6.2 App — `heriguard-app/src/`

| File | Thay đổi |
|------|---------|
| **`store/patrolStore.ts`** | **Mới** — patrol state, virtual map markers, patrol history |
| **`store/detectionStore.ts`** | **Mới** — detections list, trends |
| **`components/dashboard/ControlPanel.tsx`** | **Mới** — Start/Capture/Stop buttons, gọi `sendCommand()` |
| **`components/dashboard/StateIndicator.tsx`** | **Mới** — badge + dot theo robot state |
| **`components/dashboard/VirtualMap.tsx`** | **Mới** — timeline markers theo distance |
| **`lib/fileStorage.ts`** | **Mới** — lưu JPEG bằng expo-file-system |
| **`hooks/useNotification.ts`** | **Mới** — local notification khi alert |
| `store/deviceStore.ts` | **Sửa** — thêm `robotState`, `patrolActive` |
| `lib/ble.ts` | **Sửa** — thêm subscribe charDetection + charMapData |
| `lib/mockBle.ts` | **Sửa** — mock state + map data |
| `types/robot.ts` | **Sửa** — thêm `RobotState`, `MapMarker`, `PatrolSession` |
| `app/(tabs)/index.tsx` | **Sửa** — thêm ControlPanel + StateIndicator + VirtualMap |
| `app/(tabs)/camera.tsx` | **Sửa** — bounding box overlay, markers từ map |
| `app/(tabs)/ai.tsx` | **Sửa** — phân tích dựa trên detection thật |
| `app/(tabs)/history.tsx` | **Sửa** — patrol history + filter |
| `app/(tabs)/settings.tsx` | **Sửa** — thêm BLE scan UI |
| **`types/gemini.ts`** | **Mới** — `GeminiAnalysis`, `GeminiFinding` types |
| **`lib/gemini.ts`** | **Mới** — Gemini 1.5 Flash REST API wrapper |
| **`lib/mockGemini.ts`** | **Mới** — 3 kịch bản mock cho dev offline |
| `store/settingsStore.ts` | **Sửa** — thêm `geminiApiKey`, `geminiMockMode` |
| `app/(tabs)/ai.tsx` | **Sửa** — tích hợp Gemini API, hiển thị kết quả có cấu trúc |

### 6.3 Camera — OpenMV Script

| File | Thay đổi |
|------|---------|
| `main.py` (trên M-Vision Cam) | **Mới** — JPEG capture, crack detection, UART 921600 |

### 6.4 Gemini AI — Phân tích tổng hợp (MỚI)

| File | Thay đổi |
|------|---------|
| `src/types/gemini.ts` | **Mới** — `GeminiAnalysis`, `GeminiFinding` types |
| `src/lib/gemini.ts` | **Mới** — Gemini 1.5 Flash REST API wrapper, gửi ảnh + sensor data |
| `src/lib/mockGemini.ts` | **Mới** — Mock 3 kịch bản (low/medium/high severity) cho dev offline |
| `src/store/settingsStore.ts` | **Sửa** — thêm `geminiApiKey`, `geminiMockMode` |
| `src/app/(tabs)/ai.tsx` | **Sửa** — thay rule-based bằng Gemini API, hiển thị findings + correlations + recommendations |

---

## 7. UI Layout (Dashboard với ControlPanel)

```
┌─────────────────────────────────────┐
│  TopBar: ● HERI-GUARD  Trạm #01   │
├─────────────────────────────────────┤
│  StateIndicator: [ĐANG TUẦN TRA]   │
│  ● Đã kết nối BLE                   │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  ControlPanel                 │  │
│  │  ┌──────────┐ ┌──────────┐   │  │
│  │  │Bắt đầu   │ │Chụp ảnh  │   │  │
│  │  │tuần tra  │ │(Capture) │   │  │
│  │  └──────────┘ └──────────┘   │  │
│  │  ┌──────────────────────────┐│  │
│  │  │   DỪNG KHẨN CẤP          ││  │
│  │  │   (Stop - màu đỏ, lớn)   ││  │
│  │  └──────────────────────────┘│  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  CameraCard (ảnh hiện trường)       │
├─────────────────────────────────────┤
│  VirtualMap (timeline 0.5m)         │
│  0m──●──0.5──●──1.0──●──1.5──●──2.0│
│       an toàn  moss   an toàn crack │
├─────────────────────────────────────┤
│  MiniChart (xu hướng temp/hum)      │
├─────────────────────────────────────┤
│  TrendSummary (nhận định)           │
└─────────────────────────────────────┘
```

### Nút trên ControlPanel (chi tiết)

| Nút | Lệnh | Màu | Kích thước | Hành vi |
|-----|------|-----|-----------|---------|
| **Bắt đầu tuần tra** | `P` | `jade` (#2F6F62) | Medium | Gửi 'P' → đổi thành "Đang tuần tra..." (disabled) |
| **Chụp ảnh** | `C` | `gold` (#C99A3E) | Medium | Gửi 'C' → chụp ảnh hiện tại |
| **DỪNG KHẨN CẤP** | `X` | `lacquer` (#B23A2E) | **Lớn, full width** | Gửi 'X' → robot dừng ngay, icon cảnh báo |

### StateIndicator colors

| State | Label | Màu |
|-------|-------|-----|
| `idle` | Sẵn sàng | Xám |
| `patrol_move` | Đang di chuyển | Xanh dương |
| `inspect_wide` | Đang quét rộng | Vàng |
| `inspect_close` | Đang quét sâu | Cam |
| `emergency` | Khẩn cấp | Đỏ (nhấp nháy) |
| `retreat` | Đang lùi | Đỏ |

---

## 8. Timeline tổng thể

```
Tuần 1: BLE Foundation + Sensor      ████████░░░░░░░░░░░░░░
         (Phase 1)
Tuần 2-3: Patrol + State Machine     ░░░░████████████░░░░░░
         (Phase 2)
Tuần 3-4: Scan Low/High + Servo     ░░░░░░░░░░████████░░░░
         (Phase 3)
Tuần 4-5: Camera JPEG + UART        ░░░░░░░░░░░░░░████████
         (Phase 4)
Tuần 5: Alert + Notification         ░░░░░░░░░░░░░░░░░░████
         (Phase 5)
Tuần 6: Testing + Demo              ░░░░░░░░░░░░░░░░░░░░████
          (Phase 6)
Tuần 6-7: Gemini AI Integration     ░░░░░░░░░░░░░░░░░░░░░░████
          (Phase 7)
```

---

## 9. Rủi ro & Giải pháp

| Rủi ro | Giải pháp |
|--------|-----------|
| ArduinoBLE không tương thích MatrixMiniR4 | Dùng ESP32-S3 direct firmware, giao tiếp SPI giữa RA4M1 và ESP32-S3 |
| BLE MTU hạn chế (20 bytes) | Gọi `BLE.setMTU(517)` ở đầu setup; fallback chunk nhỏ hơn nếu không được |
| JPEG ~20KB = 40+ chunks | Queue gửi chunks mỗi cycle, không block loop |
| Camera UART mất sync | Header byte + checksum để resync |
| PID line follow không ổn định | Calibrate Line Tracer threshold, tuning PID |
| Encoder sai số tích lũy | Reset encoder mỗi 0.5m, dùng IMU hỗ trợ |
| Thời gian vượt 2 phút | Tinh chỉnh ngưỡng Wide Scan (giảm dương tính giả), tối ưu tốc độ move |
| Pin low giữa chừng | Cảnh báo app khi <20%, về đích tự động |

---

## 10. Phụ lục: Giao thức BLE chi tiết

### Sensor Data (...def3) — Robot → App

```
Byte 0-1: temperature (int16, hundredths °C)   VD: 2850 = 28.50°C
Byte 2-3: humidity (uint16, hundredths %)      VD: 7230 = 72.30%
```

### Status (...def5) — Robot → App

```
Byte 0: battery (%)          0-100
Byte 1: rssi (dBm)           0 = unknown
Byte 2: robot_state          0=idle, 1=patrol_move, 2=inspect_wide,
                             3=inspect_close, 4=inspect_scan_low,
                             5=inspect_scan_high, 6=retract, 7=emergency
Byte 3: patrol_active        0=stopped, 1=active
```

### Map Data (...def6) — Robot → App (gửi sau mỗi inspect)

```
Byte 0: distance_x2          số nửa mét (0=0m, 1=0.5m, 2=1.0m, ...)
Byte 1: flags                bit field: 0=low_issue,1=high_issue,2=moss,
                             3=mold,4=stain,5=crack_small,6=crack_large
Byte 2: confidence           0-100
Byte 3-4: temperature        int16 hundredths °C
Byte 5-6: humidity           uint16 hundredths %
Byte 7-8: timestamp          uint16 seconds since patrol start
```

### Camera Chunk (...def1) — Robot → App

```
Byte 0-1: frameId (uint16)       tăng dần mỗi ảnh
Byte 2-3: chunkIndex (uint16)    0-based
Byte 4-5: totalChunks (uint16)   tổng số chunk
Byte 6+:  JPEG payload
```

### Detection (...def2) — Robot → App

```
Byte 0: label                   0=crack_small, 1=crack_large, 2=moss,
                                 3=mold, 4=stain
Byte 1: confidence              0-100
Byte 2-3: bounding_box_x        center x (pixels, 0-640)
Byte 4-5: bounding_box_y        center y (pixels, 0-480)
Byte 6-7: bounding_box_w        width (pixels)
Byte 8-9: bounding_box_h        height (pixels)
```

### Command (...def4) — App → Robot

```
Byte 0: cmd_char
  'P' = Start Patrol
  'X' = Stop (khẩn cấp)
  'C' = Capture (chụp ảnh ngay)
  'S' = Set Speed  [speed_left, speed_right]  (bytes 1-2)
```
