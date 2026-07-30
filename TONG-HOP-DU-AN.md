# TỔNG HỢP DỰ ÁN HERI-GUARD

> **HERI-GUARD** — Robot tự động tuần tra giám sát bảo tồn di sản văn hóa  
> Đội thi **NovaCulture** — Cuộc thi **WRO 2026 Future Engineers**

---

## 1. TỔNG QUAN

Hệ thống gồm 2 phần chính:

| Phần | Công nghệ | Chức năng |
|---|---|---|
| **Robot tuần tra** (`heriguard-robot/`) | Arduino UNO R4 WiFi + OpenMV Camera | Di chuyển theo line, dừng mỗi 0.5m, chụp ảnh, đo cảm biến, phát hiện vết nứt, gửi dữ liệu qua BLE |
| **App điện thoại** (`heriguard-app/`) | React Native / Expo | Kết nối BLE, nhận dữ liệu real-time, hiển thị dashboard, phân tích AI (Gemini), lưu trữ local |

**Nguyên tắc:** Toàn bộ dữ liệu lưu local trên thiết bị di động — không có cloud, không có server.

---

## 2. KIẾN TRÚC HỆ THỐNG

```
┌──────────────────────┐         BLE 5.0         ┌──────────────────────┐
│   ROBOT (Peripheral) │ ◄──────────────────────► │  APP (Central)       │
│                      │   1 Service, 6 Chars     │                      │
│  ┌────────────────┐  │                          │  ┌────────────────┐  │
│  │  State Machine  │  │                          │  │  Zustand Store │  │
│  │  (5 states)     │──│── Camera Data (NOTIFY)──►│  │  6 stores     │──│── UI Screens
│  │                 │──│── Detection (NOTIFY)────►│  │               │  │
│  │  PID Line Follow│  │── Sensor Data (NOTIFY)──►│  │  lib/ble.ts   │  │
│  │  Encoder 0.5m   │  │── Status (NOTIFY)───────►│  │  lib/gemini.ts │  │
│  │  Servo Camera   │──│── Map Data (NOTIFY)─────►│  │  lib/file...  │  │
│  │  DHT + Laser    │  │── Command (WRITE)◄───────│  │  mockBle.ts   │  │
│  └────────────────┘  │                          │  └────────────────┘  │
│  ┌────────────────┐  │                          │                      │
│  │ OpenMV Camera   │  │                          │  Google Gemini      │
│  │ (UART 921600)   │──│ (chụp ảnh JPEG + phát    │  1.5 Flash API      │
│  │                 │  │  hiện vết nứt)           │  (phân tích ảnh)    │
│  └────────────────┘  │                          │                      │
└──────────────────────┘                          └──────────────────────┘
```

---

## 3. CÔNG NGHỆ SỬ DỤNG

### 3.1. Mobile App (`heriguard-app/`)

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **Expo SDK** | 57.0.8 | Framework React Native |
| **React** | 19.2.3 | Thư viện UI |
| **React Native** | 0.86.0 | Framework di động |
| **TypeScript** | 6.0.3 | Kiểu dữ liệu tĩnh (strict mode) |
| **Expo Router** | 57.0.8 | Điều hướng dạng file |
| **NativeWind** | 4.2.6 | Tailwind CSS cho RN |
| **Tailwind CSS** | ~3.4 | CSS utility-first |
| **Zustand** | 5.0.14 | Quản lý state toàn cục |
| **react-native-ble-plx** | 3.5.1 | Giao tiếp BLE |
| **react-native-chart-kit** | 7.0.2 | Biểu đồ đường |
| **react-native-svg** | 15.15.4 | Vẽ đồ họa SVG |
| **react-native-reanimated** | 4.5.0 | Animation |
| **react-native-gesture-handler** | 2.32.0 | Xử lý cử chỉ |
| **expo-file-system** | 57.0.1 | Lưu file ảnh |
| **expo-notifications** | 57.0.7 | Thông báo local |
| **expo-font** | 57.0.1 | Load font chữ |
| **@react-native-async-storage/async-storage** | 2.2.0 | Lưu trữ local bền vững |
| **uuid** | 14.0.1 | Tạo ID duy nhất |

### 3.2. Robot Firmware (`heriguard-robot/`)

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **Board** | uno_r4_wifi | Arduino UNO R4 WiFi (MCU Renesas RA4M1 + ESP32-S3) |
| **Framework** | Arduino | Platform C++ |
| **MatrixMiniR4** | 1.2.2 | Thư viện phần cứng (động cơ, servo, cảm biến, OLED) |
| **ArduinoBLE** | 1.3.6 | BLE stack |
| **DHT sensor library** | 1.4.4 | Cảm biến nhiệt/ẩm DHT |
| **Adafruit Unified Sensor** | 1.1.9 | Abstraction driver cảm biến |

### 3.3. Camera (`heriguard-robot/camera/`)

| Công nghệ | Mục đích |
|---|---|
| **OpenMV** (MicroPython) | Xử lý ảnh trên M-Vision Camera |
| **STM32H7** @ 480MHz | Vi xử lý camera |
| **OV7725 / MT9M114** | Cảm biến hình ảnh 640x480 VGA |
| **UART 921600 baud** | Giao tiếp với MCU chính |

### 3.4. AI Analysis

| Công nghệ | Mục đích |
|---|---|
| **Google Gemini 1.5 Flash** | Phân tích ảnh + dữ liệu cảm biến, đánh giá tình trạng di sản |
| **Prompt tiếng Việt** | Ngữ cảnh bảo tồn di sản văn hóa |

---

## 4. LOGIC VẬN HÀNH

### 4.1. State Machine Robot (5 trạng thái)

```
IDLE (chờ lệnh từ app)
  │
  │ App gửi 'P' (Start Patrol)
  ▼
PATROL_MOVE ──── PID line follow, encoder đếm 0.5m ────► Kiểm tra chướng ngại vật
  │                                                         │
  │ Đạt 0.5m                                                 │ Có vật cản
  ▼                                                         ▼
INSPECT_A (Quét rộng)                                  EMERGENCY (Dừng khẩn)
  - Chụp 1 ảnh JPEG
  - Đọc DHT (nhiệt + độ ẩm)
  - AI crack detection
  - Đo Laser (khoảng cách)
  │
  ├── Không nghi ngờ ────────────────► INSPECT_E (Thu camera, align line) ──► PATROL_MOVE
  └── Có nghi ngờ ──► INSPECT_B (Tiếp cận gần 15-20cm)
                         │
                         ▼
                    INSPECT_C (Quét thấp)
                      Servo hạ camera, pan trái → phải
                      Chụp + detect tại mỗi vị trí
                         │
                         ▼
                    INSPECT_D (Quét cao)
                      Servo nâng camera, pan trái → phải
                      Chụp + detect tại mỗi vị trí
                         │
                         ▼
                    INSPECT_E (Thu camera, align line)
                         │
                         ▼
                    PATROL_MOVE (tiếp 0.5m tiếp theo)
```

- Track 6m = 12 điểm dừng, thời gian ước tính ~40-60 giây.

### 4.2. Dữ liệu BLE — 1 Service, 6 Characteristics

| Characteristic | UUID | Hướng | Định dạng | Mô tả |
|---|---|---|---|---|
| Camera Data | `charCamera` | NOTIFY | Chunk JPEG (6-byte header + payload 506 byte) | Ảnh chụp tại điểm kiểm tra |
| Detection Data | `charDetection` | NOTIFY | 10 byte: label, confidence, x, y, w, h | Kết quả phát hiện vết nứt/rêu/mốc |
| Sensor Data | `charSensor` | NOTIFY | 4 byte: int16 temp (hundredths) + uint16 humidity (hundredths) | Nhiệt độ và độ ẩm |
| Command | `charCommand` | WRITE | 1 byte ASCII: 'P', 'X', 'C', 'S' | Điều khiển robot |
| Status | `charStatus` | NOTIFY | 4 byte: battery%, RSSI, robot state, patrol active | Trạng thái robot |
| Map Data | `charMapData` | NOTIFY | 9 byte: distance, flags, confidence, temp, humidity, timestamp | Marker bản đồ ảo |

### 4.3. Định dạng Map Marker (9 byte)

```
Byte 0-1: distance_x2 (uint16, đơn vị 0.5m)
Byte 2:   flags (bitfield)
          bit0 = low_issue    bit1 = high_issue
          bit2 = moss         bit3 = mold
          bit4 = stain        bit5 = crack_small
          bit6 = crack_large  bit7 = (dự phòng)
Byte 3:   confidence (uint8, 0-100%)
Byte 4:   temp (int8, °C)
Byte 5:   humidity (uint8, %)
Byte 6-8: timestamp (3 byte, epoch seconds offset)
```

### 4.4. Camera JPEG Chunking

JPEG từ OpenMV được chia thành các chunk 512 byte (6 byte header + 506 byte payload) để truyền qua BLE:

```
Header (6 byte):
  - frameId (2 byte): ID khung hình
  - chunkIndex (2 byte): thứ tự chunk
  - totalChunks (2 byte): tổng số chunk
Payload (506 byte): dữ liệu JPEG
```

### 4.5. Luồng dữ liệu trong App

```
BLE Notification
  ▼
lib/ble.ts ──► handleSensorData() ──► dashboardStore.updateSensor() ──► assessRisk()
                                                                    ──► EnvChart, RiskBadge
                                                                    ──► TrendSummary
  ▼
lib/ble.ts ──► handleCameraChunk() ──► reassemble JPEG ──► fileStorage.save()
                                                         ──► deviceStore.imageHistory
  ▼
lib/ble.ts ──► handleMapMarker() ──► patrolStore.currentMapMarkers ──► VirtualMap
  ▼
lib/ble.ts ──► handleDetectionData() ──► deviceStore.detection ──► detectionStore
```

### 4.6. Hệ thống Alert (3 mức)

| Mức | Điều kiện | Hành động |
|---|---|---|
| **LOW** (An toàn) | humidity ≤ 68%, temp ≤ 28°C, không có detection | Không alert |
| **MEDIUM** (Cần chú ý) | humidity 68-75%, temp 28-30°C, rêu/mốc | Badge vàng, trend summary |
| **HIGH** (Cảnh báo) | humidity > 75%, temp > 30°C, crack lớn, confidence > 75% | Badge đỏ, notification, marker đỏ |

### 4.7. AI Analysis (Gemini)

- App gửi ảnh JPEG (base64) + dữ liệu cảm biến + lịch sử detection
- Gemini 1.5 Flash trả về JSON cấu trúc:
  - `severity`: low / medium / high
  - `summary`: mô tả tổng quan
  - `findings[]`: mảng phát hiện chi tiết
  - `envAssessment`: đánh giá môi trường
  - `correlations[]`: tương quan giữa các yếu tố
  - `recommendations[]`: khuyến nghị xử lý
- Có chế độ mock (3 kịch bản: low/medium/high) để phát triển offline

### 4.8. Cấu trúc lưu trữ

```
expo-file-system (documents directory)/
└── heriguard/
    ├── patrols/
    │   ├── YYYY-MM-DD_HHmmss/
    │   │   ├── map.json          # Map markers (mỗi 0.5m)
    │   │   ├── sensor.json       # Dữ liệu cảm biến theo thời gian
    │   │   ├── frame_0001.jpg    # Ảnh chụp
    │   │   └── ...
    │   └── ...
    └── alerts/
        └── alert_log.json        # Lịch sử alert
```

**Nguyên tắc lưu trữ:** Điểm an toàn chỉ lưu 1 marker + 1 dòng sensor. Điểm nghi ngờ/nguy hiểm lưu đầy đủ ảnh + detection + marker chi tiết.

---

## 5. THUẬT NGỮ

### 5.1. Thuật ngữ chung

| Thuật ngữ | Ý nghĩa |
|---|---|
| **HERI-GUARD** | Heritage Guard — tên dự án |
| **NovaCulture** | Tên đội thi |
| **WRO 2026 Future Engineers** | Cuộc thi robot quốc tế |
| **MATRIX Mini R4** | Board Arduino UNO R4 WiFi (ESP32-S3 + Renesas RA4M1) |
| **M-Vision Cam MS-010** | Module camera OpenMV (STM32H7, 640x480, hardware JPEG) |
| **DHT MS-011** | Cảm biến nhiệt độ/độ ẩm |
| **Laser V2 MS-009V2** | Cảm biến laser đo khoảng cách (21-1999mm, 50Hz) |
| **Line Tracer V2** | Cảm biến line follow 10 kênh (I2C) |
| **PID** | Proportional-Integral-Derivative — bộ điều khiển bám line |

### 5.2. Trạng thái robot

| Trạng thái | Mô tả |
|---|---|
| **IDLE** | Chờ lệnh từ app |
| **PATROL_MOVE** | Đang di chuyển dọc line |
| **INSPECT_A** | Quét rộng (bắt buộc mỗi 0.5m) |
| **INSPECT_B** | Tiếp cận gần khi phát hiện nghi ngờ |
| **INSPECT_C** | Quét góc thấp |
| **INSPECT_D** | Quét góc cao |
| **INSPECT_E** | Thu camera, căn chỉnh lại line |
| **EMERGENCY** | Dừng khẩn cấp (chướng ngại vật, nghiêng, pin yếu) |

### 5.3. Linh kiện robot

| Ký hiệu | Tên | Chức năng |
|---|---|---|
| **M3** | Motor trái | DC motor có encoder |
| **M4** | Motor phải | DC motor có encoder |
| **RC1** | Servo Pan | Quay camera trái/phải |
| **RC2** | Servo Fold | Gập camera (cất/gấp) |
| **RC3** | Servo Tilt | Nâng/hạ camera |
| **RC4** | Servo Twist | Xoay camera góc nghiêng |

### 5.4. Dữ liệu và UI

| Thuật ngữ | Ý nghĩa |
|---|---|
| **MapMarker** | Cấu trúc 9 byte đại diện 1 điểm kiểm tra trên bản đồ ảo |
| **Virtual Map** | Timeline hiển thị các marker theo khoảng cách 0.5m, tô màu theo mức độ |
| **Severity levels** | `low` (An toàn), `medium` (Cần chú ý), `high` (Cảnh báo) |
| **PatrolSession** | Một phiên tuần tra hoàn chỉnh |
| **BLE Chunking** | Kỹ thuật chia nhỏ dữ liệu JPEG để gửi qua BLE |
| **Mock mode** | Chế độ giả lập dữ liệu BLE để phát triển offline |
| **assessRisk()** | Hàm rule-based đánh giá mức độ nguy hiểm |
| **GeminiAnalysis** | Output cấu trúc từ Gemini: severity, findings, recommendations |

### 5.5. Flags trên MapMarker

| Flag | Bit | Ý nghĩa |
|---|---|---|
| low_issue | 0 | Vấn đề nhẹ |
| high_issue | 1 | Vấn đề nghiêm trọng |
| moss | 2 | Phát hiện rêu |
| mold | 3 | Phát hiện mốc |
| stain | 4 | Phát hiện ố màu |
| crack_small | 5 | Vết nứt nhỏ |
| crack_large | 6 | Vết nứt lớn |

---

## 6. KIẾN TRÚC PHẦN MỀM

### 6.1. App Structure (Expo Router)

```
src/app/
├── _layout.tsx            # Stack navigator root
├── (tabs)/
│   ├── _layout.tsx        # Bottom tab navigator (6 tabs)
│   ├── index.tsx          # Dashboard (trang chủ)
│   ├── camera.tsx         # Camera (carousel ảnh)
│   ├── charts.tsx         # Charts (biểu đồ nhiệt/ẩm)
│   ├── ai.tsx             # AI Analysis (Gemini)
│   ├── history.tsx        # History (bảng dữ liệu tuần tra)
│   └── settings.tsx       # Settings (BLE, mock, Gemini config)
```

### 6.2. Component Tree

```
Screen (app/) ──► Components (components/) ──► Store (store/) ──► Lib (lib/)
                                                      │
                                                      ▼
                                                types/ (TypeScript types)
```

### 6.3. Stores (Zustand) — 6 store

| Store | State chính |
|---|---|
| **deviceStore** | BLE connection, robot state, battery, images, detection |
| **dashboardStore** | Nhiệt độ, độ ẩm, chart data, risk level |
| **patrolStore** | Patrol sessions, map markers, sensor logs |
| **detectionStore** | Detection events, trends |
| **alertStore** | Alert list, unread count |
| **settingsStore** | Mock mode, Gemini config, station ID |

### 6.4. Lib Layer

| File | Chức năng |
|---|---|
| `lib/ble.ts` | Quét, kết nối, subscribe, gửi lệnh, ráp chunk JPEG |
| `lib/gemini.ts` | Google Gemini API wrapper |
| `lib/fileStorage.ts` | Lưu/đọc ảnh, dữ liệu tuần tra |
| `lib/cn.ts` | Merge class names (clsx + twMerge) |
| `lib/mockBle.ts` | Mock BLE với dữ liệu ngẫu nhiên |
| `lib/mockGemini.ts` | 3 kịch bản mock AI analysis |

---

## 7. PATTERNS & NGUYÊN TẮC

1. **State Machine** — Firmware dùng enum-based state machine với `runStateMachine()` dispatch
2. **Priority Loop** — `loop()`: stop cmd > obstacle > IMU > state machine > sensor (2s) > BLE notify (2s)
3. **BLE Client-Server** — Robot = Peripheral, App = Central, 1:1 direct connection
4. **File-Based Routing** — Expo Router: `src/app/` mirrors navigation
5. **Component Composition** — Screens ghép components từ `components/`, logic trong stores/lib
6. **Binary Protocol over BLE** — Không dùng JSON, dùng binary compact cho tốc độ
7. **Mock/Real Switch** — `settingsStore.mockMode` toggle giữa thật và giả lập
8. **Event-Driven Data Flow** — BLE notify → store update → UI re-render
9. **Design System** — Color tokens: cream, paper, ink, lacquer, jade, gold
10. **Data Integrity** — XOR checksum JPEG (camera→MCU), CRC32 BLE

---

## 8. CẤU TRÚC THƯ MỤC

```
heriguard_b4_full_project/
├── heriguard-app/           # Mobile App (React Native / Expo)
│   ├── src/
│   │   ├── app/             # Expo Router screens
│   │   ├── components/      # UI components
│   │   │   ├── dashboard/   # Dashboard components
│   │   │   └── shared/      # Shared components
│   │   ├── constants/       # theme.ts (màu sắc, font)
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Services (BLE, Gemini, File, Mock)
│   │   ├── store/           # Zustand stores
│   │   └── types/           # TypeScript types
│   ├── assets/              # Ảnh, font
│   └── (config files)
│
├── heriguard-robot/         # Robot Firmware (PlatformIO)
│   ├── src/
│   │   └── main.cpp         # Firmware chính
│   ├── camera/
│   │   └── main.py          # OpenMV script
│   └── platformio.ini
│
├── PLAN.md                  # Kế hoạch tổng thể (6+1 phases)
├── PLAN-BLE-CAMERA-AI.md    # Kế hoạch chi tiết BLE + Camera + AI
├── ques.md                  # Q&A cuộc thi
└── TONG-HOP-DU-AN.md        # File này
```

---

## 9. MỤC TIÊU & GIỚI HẠN

- **Bảo tồn di sản:** Phát hiện sớm nứt, rêu, mốc, biến động nhiệt/ẩm
- **Chi phí thấp:** Hardware Arduino + cảm biến giá rẻ
- **Không cần internet:** Tất cả xử lý local, BLE trực tiếp
- **AI hỗ trợ:** Gemini phân tích ảnh chuyên sâu
- **Phạm vi BLE:** ~10m trong nhà (đủ cho khu vực nhỏ)
- **Lưu trữ:** Chỉ lưu local, không đồng bộ cloud