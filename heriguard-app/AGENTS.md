# HERI-GUARD Companion App - Agent Instructions

## Project Overview

Bạn là kỹ sư React Native + Expo, đang xây dựng **ứng dụng di động đồng hành** cho robot bảo tồn di sản **HERI-GUARD** (WRO 2026, đội NovaCulture).
Robot HERI-GUARD tuần tra di tích, dùng camera Edge-AI phát hiện vết nứt và cảm biến đo nhiệt độ/độ ẩm. Ứng dụng này:

- Kết nối với robot qua **Bluetooth (BLE)**
- Nhận **hình ảnh** và **dữ liệu cảm biến** (nhiệt độ, độ ẩm, mức pin) từ robot
- Nhận **kết quả phân tích vết nứt** (mức độ, vị trí, độ tin cậy) từ AI Edge trên robot
- Lưu trữ dữ liệu từng lần tuần tra để **so sánh theo thời gian**
- Hiển thị **dashboard**, **lịch sử tuần tra**, **biểu đồ xu hướng**, và **cảnh báo**
- UI phù hợp với ban quản lý di tích / chuyên gia bảo tồn — nghiêm túc nhưng thân thiện

App là **cầu nối giữa robot và người quản lý di tích** — ưu tiên độ tin cậy dữ liệu và trải nghiệm rõ ràng.

---

## Expo & React Native Version

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

- **Expo SDK**: 57
- **React**: 19.2.3
- **React Native**: 0.86.0
- **Expo Router**: ~57.0.8 (typed routes enabled)
- **TypeScript**: strict mode

---

## Tech Stack

Sử dụng stack sau:

| Tool | Purpose | Status |
|------|---------|--------|
| Expo SDK 57 | Framework | Installed |
| React Native 0.86 | UI framework | Installed |
| TypeScript (strict) | Type safety | Installed |
| Expo Router | Navigation | Installed |
| NativeWind / Tailwind CSS | Styling | **Cần cài** |
| Zustand | State management | **Cần cài** |
| AsyncStorage | Persist config | **Cần cài** |
| expo-file-system | Save images from robot | **Cần cài** |
| react-native-ble-plx | BLE communication (secondary) | **Cần cài** |
| expo-notifications | Local alerts | **Cần cài** |
| Chart library | Biểu đồ temp/humidity | **Cần chọn** (xem Dashboard UI) |
| MQTT client | Nhận dữ liệu realtime từ robot | **Cần cài** |

**KHÔNG dùng**: Clerk, Stream, database server, video call.
**Không thêm thư viện lớn** nếu không có lý do rõ ràng — xin phép trước khi thêm.

---

## Project Structure

```
heriguard-app/
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Root layout (Stack)
│   │   ├── index.tsx                # Home/Dashboard
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx          # Tab navigator
│   │   │   ├── index.tsx            # Dashboard tab
│   │   │   ├── history.tsx          # Lịch sử tuần tra
│   │   │   ├── alerts.tsx           # Danh sách cảnh báo
│   │   │   └── settings.tsx         # Cài đặt
│   │   ├── device/
│   │   │   ├── scan.tsx             # Quét & ghép nối BLE
│   │   │   └── connect.tsx          # Trạng thái kết nối
│   │   ├── patrol/
│   │   │   └── [id].tsx             # Chi tiết một lần tuần tra
│   │   └── detection/
│   │       └── [id].tsx             # Chi tiết vết nứt (ảnh + xu hướng)
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── ConnectionBar.tsx    # Dot + text trạng thái MQTT
│   │   │   ├── StatusCard.tsx       # Ảnh hiện trường + OSD + Temp/Humidity
│   │   │   ├── EnvChart.tsx         # Line chart dual Y-axis
│   │   │   ├── RiskBadge.tsx        # Badge màu theo risk level
│   │   │   ├── AIAnalysisPanel.tsx  # Text phân tích + nút trigger
│   │   │   └── TopBar.tsx           # Brand + station meta
│   │   └── shared/
│   │       ├── Card.tsx             # Card wrapper (plaque style)
│   │       └── EmptyState.tsx       # Empty state placeholder
│   ├── constants/
│   │   ├── images.ts               # Import ảnh tập trung
│   │   └── theme.ts                # Color tokens + typography
│   ├── data/
│   │   ├── alertThresholds.ts      # Ngưỡng cảnh báo
│   │   └── severityLevels.ts       # Severity levels
│   ├── hooks/
│   │   ├── useMQTT.ts              # MQTT subscribe/publish
│   │   └── useDashboard.ts         # Dashboard data orchestration
│   ├── lib/
│   │   ├── ble.ts                  # BLE scan, connect, subscribe
│   │   ├── mqtt.ts                 # MQTT client wrapper
│   │   ├── dataParser.ts           # Parse packet từ robot
│   │   ├── fileStorage.ts          # Lưu/đọc ảnh bằng expo-file-system
│   │   └── cn.ts                   # Class name merge utility
│   ├── store/
│   │   ├── deviceStore.ts          # Trạng thái kết nối
│   │   ├── dashboardStore.ts       # Temp, humidity, chart data
│   │   ├── patrolStore.ts          # Lịch sử tuần tra
│   │   ├── detectionStore.ts       # Vết nứt, trends
│   │   ├── alertStore.ts           # Cảnh báo
│   │   └── settingsStore.ts        # Cấu hình app
│   └── types/
│       ├── robot.ts                # RobotPacket, CrackDetection
│       └── dashboard.ts            # ChartDataPoint, RiskLevel
├── assets/
│   └── images/
├── app.json
├── package.json
└── tsconfig.json
```

### Quy tắc thư mục

- **`src/app/`** — Chỉ route và screen. Screen compose component + gọi hook/store, không chứa logic nghiệp vụ phức tạp.
- **`components/`** — Chỉ tạo khi được dùng lại ở nhiều nơi hoặc giúp screen dễ đọc hơn.
- **`lib/`** — Helper functions, BLE logic, data parsing. Toàn bộ code BLE phải nằm trong `lib/ble.ts`.
- **`store/`** — Zustand stores cho state toàn cục.
- **`data/`** — Nội dung tĩnh, hardcode (ngưỡng cảnh báo, severity levels...).

---

## Cấu trúc thư mục hiện tại

Project đang ở trạng thái Expo template mới tạo. Chưa có:
- NativeWind/Tailwind
- Zustand
- BLE library
- Components, hooks, stores

Cần setup từng phần khi bắt đầu build feature.

---

## Communication (WiFi/MQTT + BLE)

### Kênh giao tiếp chính: WiFi/MQTT

Robot dùng **WiFi (ESP32-S3 trên Mini R4)** để gửi dữ liệu lên app qua **MQTT**. Đây là kênh chính vì:
- Tốc độ đủ nhanh cho ảnh JPEG + sensor data realtime
- Mini R4 có WiFi tích hợp sẵn
- MQTT nhẹ, phù hợp IoT

### Kênh BLE (dự phòng)

BLE dùng cho:
- Ghép nối thiết bị (discovery, pairing)
- Gửi lệnh từ app → robot (start patrol, stop, config)
- Nhận dữ liệu nhỏ (crack detection results) khi WiFi không khả dụng

### MQTT Topics

| Topic | Dữ liệu | Direction |
|-------|---------|-----------|
| `heriguard/temp` | Nhiệt độ (°C) | Robot → App |
| `heriguard/humidity` | Độ ẩm (%) | Robot → App |
| `heriguard/sensor` | Packet sensor đầy đủ (JSON) | Robot → App |
| `heriguard/camera` | Ảnh JPEG (base64 hoặc binary) | Robot → App |
| `heriguard/alert` | Cảnh báo (JSON) | Robot → App |
| `heriguard/status` | Trạng thái robot (pin, uptime) | Robot → App |
| `heriguard/command` | Lệnh từ app (start, stop, config) | App → Robot |

---

## Hardware Reference (Robot HERI-GUARD)

Robot dùng **MATRIX Mini R4** (Arduino UNO R4 WiFi). App cần hiểu hardware để parse dữ liệu đúng.

### Cảm biến & dữ liệu robot gửi

| Sensor | Dữ liệu | Đơn vị | Giới hạn |
|--------|---------|--------|----------|
| Laser V2 (I2C) | Khoảng cách | mm | 21-1999mm, 50Hz |
| Line Tracer V2 (I2C) | Lỗi đường line | float | -4.5 to 4.5 |
| DHT MS-011 (D1) | Nhiệt độ | °C | 0-50°C ±2°C |
| DHT MS-011 (D1) | Độ ẩm | % | 20-90% ±5% |
| M-Vision Cam (UART) | Vết nứt | label, confidence | AI Edge processing |
| Pin (built-in) | Mức pin | % | 0-100% |

### Robot Packet Format

Robot gửi dữ liệu qua **MQTT** (channel chính) dạng JSON:

```ts
type RobotPacket = {
  patrolId: string;           // ID phiên tuần tra
  timestamp: string;          // ISO timestamp
  imageUri?: string;          // URL/base64 ảnh JPEG (qua MQTT heriguard/camera)
  temperature: number;        // °C từ DHT
  humidity: number;           // % từ DHT
  distance?: number;          // mm từ Laser
  crackDetections: CrackDetection[];
  batteryLevel: number;       // %
};

type CrackDetection = {
  id: string;
  severity: "low" | "medium" | "high";
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;         // 0-1
};
```

### Lưu ý truyền dữ liệu

**MQTT (channel chính):**
- Sensor data (temp, humidity, distance) gửi dạng đơn lẻ topic, mỗi giá trị một topic
- Ảnh gửi qua topic `heriguard/camera` dạng base64 (JPEG, ~50-100KB)
- Packet đầy đủ gửi qua `heriguard/sensor` dạng JSON

**BLE (dự phòng):**
- Ảnh có thể gửi thành **nhiều chunk** do giới hạn BLE MTU (~512 bytes). Cần logic `reassemble` trước khi lưu thành file hoàn chỉnh
- Xử lý mất kết nối / timeout mềm mại — hiển thị trạng thái rõ ràng
- Không block UI thread khi nhận dữ liệu lớn

**Cả hai channel:**
- Nếu không có robot thật, dùng **mock service** trong `lib/mqtt.ts` và `lib/ble.ts` để dev

---

## BLE Communication (`lib/ble.ts`) — SECONDARY

Toàn bộ code BLE nằm trong `lib/ble.ts`, không rải rác trong screen/component.

### Responsibilities (BLE secondary)

1. Quét thiết bị BLE (`startScan`)
2. Kết nối / ngắt kết nối (`connect`, `disconnect`)
3. Gửi lệnh từ app → robot (start patrol, stop, config)
4. Nhận crack detection results nhỏ (nếu WiFi không khả dụng)
5. Mock mode cho dev không có robot thật

### Trạng thái kết nối

Hiển thị rõ ràng trong UI:
- `idle` → Đang quét / Chưa kết nối
- `scanning` → Đang quét thiết bị
- `connecting` → Đang kết nối
- `connected` → Đã kết nối
- `disconnected` → Mất kết nối (có nút thử lại)

---

## MQTT Communication (`lib/mqtt.ts`) — PRIMARY

Toàn bộ code MQTT nằm trong `lib/mqtt.ts`.

### Responsibilities (MQTT primary)

1. Kết nối MQTT broker
2. Subscribe các topic sensor (`heriguard/temp`, `heriguard/humidity`, etc.)
3. Nhận packet sensor realtime
4. Nhận ảnh từ robot (`heriguard/camera`)
5. Publish lệnh từ app → robot (`heriguard/command`)
6. Mock mode cho dev không có robot thật

### Mock MQTT Service

Khi dev không có robot thật, dùng mock trong `lib/mqtt.ts`:
- Giả lập data theo schedule (mỗi 1-2s push temp/humidity mới)
- Random data hợp lý (nhiệt độ 25-35°C, độ hum 50-80%)
- Random crack detection event
- Bật/tắt qua `settingsStore.mockMode`

---

## Styling Rules (RẤT QUAN TRỌNG)

### NativeWind / Tailwind

**Chưa cài đặt.** Cần cài khi bắt đầu build UI.

Khi đã cài:
- Dùng `className` cho hầu hết styling
- Không dùng `StyleSheet.create()` trừ khi className không hỗ trợ
- Kiểm tra version NativeWind trong `package.json` trước khi code — không dùng API từ version khác

### StyleSheet / Inline Style exceptions

Dùng `StyleSheet` hoặc inline style khi:

| Component | Lý do |
|-----------|-------|
| SafeAreaView | className không hỗ trợ |
| KeyboardAvoidingView | Prop `behavior` không hỗ trợ className |
| Modal | Prop `visible`, `transparent` |
| Animated.View | Giá trị animated |
| Style động (runtime) | Màu theo mức độ vết nứt |
| Platform-specific shadow | Khác nhau iOS/Android |

### UI Quality Standard

App phải cảm giác:
- Chuyên nghiệp, đáng tin cậy (công cụ giám sát di sản)
- Rõ ràng, dễ đọc số liệu
- Mobile-first, gần sát design tham khảo

Sử dụng:
- Card bo góc, shadow nhẹ
- Badge/màu cảnh báo theo severity: low (xanh lá), medium (vàng), high (đỏ)
- Empty state thân thiện: "Chưa có lần tuần tra nào"
- Vùng chạm lớn, dễ bấm (>=44pt)
- Animation đơn giản khi hữu ích

### Pixel-Perfect Rule

Khi có ảnh thiết kế PHẢI:
- Khớp layout chính xác
- Khớp spacing, padding
- Khớp cỡ chữ, phân cấp typography
- Khớp màu sắc chính xác
- Khớp border radius, shadow
- Không làm "gần đúng"

---

## Dashboard UI Design System (TỪ dashboard.html)

UI mobile app phải tái tạo giao diện từ `dashboard.html` với các thành phần sau.

### Color Tokens

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--cream` | `#F2F7F1` | Background page |
| `--paper` | `#FFFFFF` | Card/plaque background |
| `--ink` | `#2A2420` | Text chính |
| `--ink-soft` | `#6b6258` | Text phụ, timestamp |
| `--lacquer` | `#B23A2E` | Nhiệt độ, cảnh báo cao, hover nút |
| `--lacquer-dark` | `#8C2C22` | Temp value, pressed state |
| `--jade` | `#2F6F62` | Độ ẩm, trạng thái online, an toàn |
| `--jade-light` | `#DCEDE7` | Background camera frame, alternating stripe |
| `--gold` | `#C99A3E` | Decor corners, badge "cần chú ý" |
| `--gold-light` | `#F3E6C4` | Background OSD, accent nhẹ |
| `--line` | `rgba(42,36,32,0.16)` | Border, divider |

### Typography

| Role | Font family | Style |
|------|-------------|-------|
| Display/Heading | `'Iowan Old Style', 'Palatino Linotype', Georgia, serif` | italic, 600 weight |
| Body | `'Segoe UI', 'Helvetica Neue', Arial, sans-serif` | normal |
| Monospace (số liệu, badge) | `'SFMono-Regular', Consolas, monospace` | 600 weight cho giá trị |

### Dashboard Layout (Mobile)

```
┌─────────────────────────────┐
│  TopBar                     │
│  ● HERI-GUARD              │
│  Subtitle + Station #01    │
├─────────────────────────────┤
│  ● Đã kết nối MQTT         │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ Camera Panel          │  │
│  │ ┌───────────────────┐ │  │
│  │ │  Ảnh hiện trường  │ │  │
│  │ │  ┌─────┐          │ │  │
│  │ │  │ OSD │ timestamp│ │  │
│  │ │  └─────┘          │ │  │
│  │ └───────────────────┘ │  │
│  │ ┌───────┐ ┌─────────┐│  │
│  │ │Nhiệt  │ │Độ ẩm    ││  │
│  │ │28.5°C │ │72.3%    ││  │
│  │ └───────┘ └─────────┘│  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Chart Panel           │  │
│  │  Biến động nhiệt độ  │  │
│  │  & độ ẩm             │  │
│  │  ┌─────────────────┐ │  │
│  │  │  Line chart      │ │  │
│  │  │  dual Y-axis     │ │  │
│  │  │  Temp ← │ → Hum  │ │  │
│  │  └─────────────────┘ │  │
│  │  ● Temp  ● Humidity  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ AI Panel              │  │
│  │ ┌──────────┐ [Phân    │  │
│  │ │ Badge    │  tích]   │  │
│  │ └──────────┘          │  │
│  │ > Phân tích text...   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Dashboard Components

#### 1. `ConnectionBar`
- Dot tròn 8px: `#2F6F62` (online), `#B23A2E` (offline)
- Text mono 12px hiển thị trạng thái MQTT
- Pulse animation khi online

#### 2. `StatusCard` (Camera Panel)
- Card nền `--paper`, border `--line`, có gold corner decoration
- Ảnh hiện trường: `aspect-ratio: 4/3`, nền `--jade-light`
- OSD overlay: `rgba(20,26,24,0.62)`, mono 11px, vị trí top-right
- Reading row: flex gap 18px, border-top dashed
  - Label: 11px uppercase mono, `--ink-soft`
  - Value: 26px mono 600, màu `--lacquer-dark` (temp) / `--jade` (humidity)

#### 3. `EnvChart` (Chart Panel)
- Line chart dual Y-axis
  - Trái: Nhiệt độ °C (màu `#B23A2E`)
  - Phải: Humidity % (màu `#2F6F62`)
- Max 50 data points, auto-shift khi đầy
- Legend row: swatch 10px tròn + text 12px
- `tension: 0.3`, `pointRadius: 2`, `animation: false`

#### 4. `RiskBadge`
- Badge mono 12px, padding 5px 12px, border-radius 14px
- Border 1px solid currentColor
- 3 trạng thái:
  - `An toàn`: màu `--jade` (#2F6F62)
  - `Cần chú ý`: màu `--gold` (#C99A3E)
  - `Cảnh báo`: màu `--lacquer` (#B23A2E)

#### 5. `AIAnalysisPanel`
- Full width card
- Header: flex giữa badge + nút "Phân tích ngay"
- Body: border-left 2px `--gold`, padding-left 16px
- Nút: bg `--ink`, color `--cream`, hover bg `--lacquer-dark`

#### 6. `TopBar`
- Brand: dot trạng thái + heading italic serif + subtitle
- Station meta: mono 12px, right aligned
- Bottom border 1px `--line`

### Risk Assessment Rules (từ dashboard.html)

```ts
function assessRisk(temp: number, humidity: number): RiskLevel {
  if (humidity > 75 || temp > 30) return "high";      // Cảnh báo
  if (humidity > 68 || temp > 28 || humidity < 45) return "medium"; // Cần chú ý
  return "low";                                         // An toàn
}
```

### Data Flow (Dashboard)

```
Robot (MQTT heriguard/temp, heriguard/humidity)
  → App receives via MQTT
  → Update chart (pushPoint, max 50 points)
  → Update current readings (temp, humidity)
  → Update risk badge (assessRisk)
  → User taps "Phân tích ngay" → rule-based analysis text
```

### Chart Library Selection

Cần chọn 1 trong 2 (xin phép trước khi cài):

| Library | Ưu điểm | Nhược điểm |
|---------|----------|------------|
| **react-native-chart-kit** | Nhẹ, đơn giản, dễ demo | Ít option tùy biến |
| **victory-native** | Mạnh, dual Y-axis tốt, animation đẹp | Nặng hơn, phức tạp hơn |

**Khuyến nghị**: `react-native-chart-kit` — đơn giản, đủ dùng cho dual-axis line chart, dễ giải thích trước giám khảo.

---

## State Management (Zustand)

Chưa cài đặt. Cần cài khi bắt đầu build feature.

### Store Schema

```ts
// deviceStore - trạng thái kết nối BLE
type DeviceStore = {
  device: BleDevice | null;
  connectionStatus: "idle" | "scanning" | "connecting" | "connected" | "disconnected";
  batteryLevel: number;
  connect: (device: BleDevice) => void;
  disconnect: () => void;
};

// dashboardStore - dữ liệu dashboard realtime
type DashboardStore = {
  currentTemp: number | null;
  currentHumidity: number | null;
  chartData: ChartDataPoint[];
  riskLevel: "low" | "medium" | "high" | null;
  updateSensor: (temp: number, humidity: number) => void;
  pushChartData: (point: ChartDataPoint) => void;
};

type ChartDataPoint = {
  time: string;     // HH:mm:ss
  temp: number;
  humidity: number;
};

// patrolStore - phiên tuần tra
type PatrolStore = {
  currentPatrol: Patrol | null;
  patrols: Patrol[];
  addPatrol: (patrol: Patrol) => void;
};

type Patrol = {
  id: string;
  startTime: string;
  endTime?: string;
  detections: CrackDetection[];
  sensorReadings: SensorReading[];
  imageUris: string[];  // URI từ expo-file-system, KHÔNG base64
};

// detectionStore - vết nứt
type DetectionStore = {
  detections: CrackDetection[];
  trends: CrackTrend[];
};

// alertStore - cảnh báo
type AlertStore = {
  alerts: Alert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
};

// settingsStore - cấu hình app
type SettingsStore = {
  mockMode: boolean;  // Bật/tắt mock BLE cho dev
  // ...
};
```

### AsyncStorage

Persist giữa các lần mở app:
- Lịch sử tuần tra (patrols)
- Cảnh báo (alerts)
- Cấu hình (settings)
- Thiết bị đã ghép nối (paired device ID)

---

## Image Handling

### Ảnh tĩnh (app assets)

Tập trung trong `constants/images.ts`:

```ts
import logo from "@/assets/images/logo.png";
import mascot from "@/assets/images/mascot.png";

export const images = { logo, mascot };
```

### Ảnh động (từ robot)

- Nhận qua **MQTT** (`heriguard/camera` topic) — ưu tiên vì nhanh hơn
- Nhận qua **BLE** (dự phòng, chậm hơn, cần chunking)
- Lưu bằng `expo-file-system` vào thư mục documents
- Chỉ lưu **đường dẫn URI** trong store/AsyncStorage
- **KHÔNG** lưu base64 trong state lâu dài (tốn bộ nhớ)
- Hiển thị progress indicator khi đang nhận ảnh

---

## Notifications

Dùng `expo-notifications` cho local notification khi:
- Phát hiện vết nứt severity high
- Severity tăng so với lần tuần tra trước
- Robot mất kết nối bất thường

Không cần backend — xử lý local cho bản demo.

---

## Data Content (`data/`)

Nội dung tĩnh, hardcode:

```ts
// data/alertThresholds.ts
export const ALERT_THRESHOLDS = {
  low: { maxConfidence: 0.5 },
  medium: { maxConfidence: 0.75 },
  high: { minConfidence: 0.75 },
} as const;

// data/severityLevels.ts
export const SEVERITY_LEVELS = {
  low: { label: "Thấp", color: "#22C55E", icon: "checkmark-circle" },
  medium: { label: "Trung bình", color: "#EAB308", icon: "warning" },
  high: { label: "Cao", color: "#EF4444", icon: "alert-circle" },
} as const;
```

---

## Code Conventions

- TypeScript nghiêm ngặt — **tránh `any`**
- Dùng `@/` path alias (maps to `./src/`)
- Component naming: PascalCase (`DeviceStatusCard`, `PatrolCard`)
- Hook naming: `use` prefix (`useBLE`, `usePatrol`)
- Store naming: `use` + Store name (`useDeviceStore`)
- File naming: kebab-case (`data-parser.ts`) hoặc camelCase (`dataParser.ts`) — nhưng phải consistent trong project

---

## Changelog (BẮT BUỘC)

- Mỗi lần thay đổi code/config/docs, phải **ghi lại vào `../CHANGELOG.md`** (thư mục gốc repo) — mục đang mở (Unreleased hoặc ngày hiện tại), ghi rõ: thay đổi gì, file nào, lý do.
- Không commit khi chưa cập nhật changelog.

## Development Workflow

### Feature Development

1. Đọc file này trước khi code
2. Xác định files cần thay đổi
3. Giữ thay đổi tập trung, đúng phạm vi
4. Không viết lại code không liên quan
5. Theo pattern đã có
6. Đảm bảo end-to-end (dùng mock data nếu chưa có robot)
7. Sửa lỗi trước khi hoàn tất

### Mock BLE Service

Khi dev không có robot thật, dùng mock trong `lib/ble.ts`:
- Giả lập packet data theo `RobotPacket` type
- Random data hợp lý (nhiệt độ 25-35°C, độ hum 50-80%...)
- Bật/tắt qua `settingsStore.mockMode`

### Build & Test

```bash
# Dev server
npx expo start

# Lint
npm run lint

# Type check (nếu có script)
npx tsc --noEmit
```

---

## Ràng buộc quan trọng

- **Không** dùng database server
- **Không** dùng Clerk/Stream
- **Không** tự ý cài thư viện mới khi chưa xin phép
- **WiFi/MQTT** là kênh giao tiếp CHÍNH với robot (sensor data + ảnh)
- **BLE** là kênh PHỤ (gửi lệnh, nhận data nhỏ khi WiFi không khả dụng)
- Ảnh từ robot lưu bằng `expo-file-system`, KHÔNG base64 trong state
- Sensor read interval >= 1s (DHT11 limitation)
- Motor speed: -100 to 100, Servo angle: 0-180
- Dashboard phải khớp design từ `dashboard.html` (pixel-perfect)

---

## Ghi nhớ

- Đây là dự án học tập/thi đấu — code phải dễ giải thích trước ban giám khảo
- Ưu tiên sự rõ ràng hơn over-engineering
- App là cầu nối giữa robot và người quản lý di tích
- Khi phân vân, hỏi người dùng trước khi code
