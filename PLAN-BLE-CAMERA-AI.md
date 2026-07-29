# HERI-GUARD Plan: BLE + Camera AI

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                     HERI-GUARD Robot                        │
│                                                             │
│  ┌──────────────┐  JST/UART  ┌────────────────────────┐   │
│  │ M-Vision Cam │ ─────────→ │ MATRIX Mini R4          │   │
│  │ (OpenMV)     │  921600    │ (ESP32-S3)              │   │
│  │              │  baud      │                         │   │
│  │ - Chụp JPEG  │            │ - Nhận JPEG (UART)      │   │
│  │ - Detect     │            │ - Chunk JPEG (512B)      │   │
│  │ - 640×480    │            │ - BLE Server             │   │
│  │ - HW JPEG    │            │ - DHT sensor             │   │
│  └──────────────┘            │ - Battery monitor        │   │
│                              └────────────┬────────────┘   │
│                                           │                │
│                                           │ BLE 5.0        │
│                                           │ ~2 Mbps        │
│                                           │ MTU 512B       │
└───────────────────────────────────────────┼────────────────┘
                                            │
                                            │ Không dây
                                            │ Không cần WiFi router
                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mobile App (React Native)                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 BLE Layer                            │   │
│  │  - Scan → Discover "HERI-GUARD"                     │   │
│  │  - Connect → GATT Services                          │   │
│  │  - Subscribe → Camera/Detection/Status chars         │   │
│  │  - Write → Command char (start/stop/config)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Camera Tab   │  │ Dashboard    │  │ AI Analysis  │     │
│  │ - Ảnh JPEG  │  │ - Temp/Hum   │  │ - Google     │     │
│  │   từ BLE     │  │   từ BLE     │  │   Vision API │     │
│  │ - Reassemble │  │ - Chart      │  │   (free)     │     │
│  │ - OSD        │  │ - Risk badge │  │ - Kết quả    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Phần cứng

### M-Vision Camera MS-010

| Thông số | Giá trị |
|----------|---------|
| Processor | STM32H7, 480 MHz |
| Camera sensor | OV7725 / MT9M114 |
| Max resolution | 640×480 (VGA) |
| Flash | 2 MB (≥100 KB user) |
| SRAM | 1 MB |
| Hardware JPEG codec | Có — nén JPEG trên chip |
| Giao tiếp | UART (PH2.0-4P) + USB Type-C |
| microSD | Hỗ trợ lên tới 32 GB |
| Nguồn | 5V, 200-350mA |

### MATRIX Mini R4

| Thông số | Giá trị |
|----------|---------|
| MCU | Arduino UNO R4 WiFi (ESP32-S3) |
| WiFi | Có (không dùng cho BLE mode) |
| BLE | Có — ESP32-S3 tích hợp |
| DHT sensor | MS-011 (D1) |
| Camera port | UART (Serial1, 921600 baud) |
| Battery monitor | `MiniR4.PWR.getBattPercentage()` |

### Kết nối phần cứng

```
M-Vision Camera ──JST cable──→ Mini R4 UART port
                                     │
                                     │ BLE 5.0 (wireless)
                                     ▼
                                Phone (App)
```

---

## BLE Service UUIDs

```
Service: 12345678-1234-5678-1234-56789abcdef0
│
├── Camera Data (Notify)
│   UUID: ...def1
│   MTU: 512 bytes
│   Dữ liệu: JPEG chunks
│   Format: [0xCC][pkt# 2B][total 2B][data 506B][CRC16 2B]
│
├── Detection Data (Notify)
│   UUID: ...def2
│   Format: JSON {"label":"crack","confidence":0.92,"x":120,"y":80,"w":200,"h":15}
│
├── Sensor Data (Notify)
│   UUID: ...def3
│   Format: JSON {"temp":28.5,"humidity":72.3,"battery":85}
│
├── Command (Write)
│   UUID: ...def4
│   Format: {"cmd":"capture"} | {"cmd":"start_patrol"} | {"cmd":"stop"}
│
└── Status (Read)
    UUID: ...def5
    Format: {"uptime":3600,"battery":85,"firmware":"1.0.0"}
```

---

## BLE Chunking Protocol — Gửi ảnh JPEG

### Packet format

```
Byte:  [0]     [1-2]    [3-4]    [5-510]      [511-512]
Field: Header  PktNum   Total    JPEG Data     CRC16
       0xCC    uint16   uint16   uint8[506]    uint16
```

### Flow gửi 1 ảnh (~20KB JPEG)

```
Mini R4                           Phone
  │                                 │
  │ ── [0xCC][0001][0028][data] ──→ │  Chunk 1
  │ ← ──────────── ACK ─────────── │  (optional)
  │ ── [0xCC][0002][0028][data] ──→ │  Chunk 2
  │ ← ──────────── ACK ─────────── │
  │         ...                     │
  │ ── [0xCC][0028][0028][data] ──→ │  Chunk 40 (last)
  │                                 │
  │                    Phone: reassemble → save JPEG → display
```

### Tốc độ thực tế

| Ảnh | Chunks | BLE 5.0 (2Mbps) | BLE 4.2 (1Mbps) |
|-----|--------|-----------------|-----------------|
| QVGA 10KB | ~20 | ~0.5s | ~1s |
| VGA 20KB | ~40 | ~1s | ~2s |
| VGA 25KB | ~50 | ~1.25s | ~2.5s |

---

## Firmware

### M-Vision Camera (OpenMV script)

File: `main.py` trên camera

```python
import sensor, image, time, struct
from machine import UART

uart = UART(3, 921600, timeout=1000)
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.VGA)
sensor.skip_frames(time=2000)

CRACK_THRESHOLD = [(0, 30, -20, 20, -20, 20)]

def send_detection(x, y, w, h, confidence):
    packet = struct.pack('BBBBf', 0xDD, x & 0xFF, y & 0xFF, w & 0xFF, confidence)
    uart.write(packet)

while True:
    img = sensor.snapshot()
    cracks = img.find_blobs(CRACK_THRESHOLD, pixels_threshold=50, area_threshold=100)
    for c in cracks:
        send_detection(c.x(), c.y(), c.w(), c.h(), c.pixels()/(c.w()*c.h()))

    img.compress(quality=80)
    jpeg = img.bytearray()
    length = len(jpeg)
    header = bytes([0xAA, (length>>8)&0xFF, length&0xFF])
    checksum = 0xAA ^ ((length>>8)&0xFF) ^ (length&0xFF)
    for b in jpeg:
        checksum ^= b
    uart.write(header)
    uart.write(jpeg)
    uart.write(bytes([checksum&0xFF]))
    time.sleep_ms(1000)
```

### MCU Firmware (Mini R4 — main.cpp)

Thay đổi trong `main.cpp`:

| Thêm | Chi tiết |
|------|----------|
| BLE Server | Tạo BLE service + 5 characteristics |
| JPEG chunker | Chia JPEG 506 bytes/chunk + CRC16 |
| BLE notify | Gửi chunks qua notify |
| UART handler | Nhận JPEG + detection từ camera |
| DHT read | Giữ nguyên (2s interval) |
| Battery monitor | `MiniR4.PWR.getBattPercentage()` |
| Command handler | Nhận lệnh từ app qua BLE write |

---

## Mobile App

### Files tạo mới

| File | Nội dung |
|------|----------|
| `src/lib/ble.ts` | BLE scan, connect, disconnect, subscribe, chunk reassembly |
| `src/lib/fileStorage.ts` | Save JPEG base64 → file system |
| `src/lib/aiAnalysis.ts` | Google Cloud Vision API wrapper (free tier) |
| `src/lib/mockBle.ts` | Mock BLE data cho demo offline |
| `src/store/cameraStore.ts` | Images[], detections[], addImage() |
| `src/store/detectionStore.ts` | Detections[], trends[] |

### Files sửa

| File | Thay đổi |
|------|----------|
| `src/store/dashboardStore.ts` | `mqttConnected` → `bleConnected` |
| `src/store/deviceStore.ts` | Thêm `bleDevice`, `isScanning`, `scan()`, `connect()` |
| `src/store/settingsStore.ts` | Xóa `mqttBroker`, thêm `bleDeviceId` |
| `src/app/(tabs)/_layout.tsx` | Hiện camera/charts/ai tabs (bỏ `href: false`) |
| `src/app/(tabs)/index.tsx` | BLE connection bar thay MQTT |
| `src/app/(tabs)/camera.tsx` | Hiển thị ảnh thật từ BLE + OSD |
| `src/app/(tabs)/ai.tsx` | Gọi Google Vision API phân tích ảnh |
| `src/app/(tabs)/settings.tsx` | BLE scan + connect UI |
| `src/app/(tabs)/history.tsx` | Thêm image thumbnails |
| `src/lib/mockMqtt.ts` | Đổi thành `mockBle.ts` |
| `src/types/dashboard.ts` | `mqttConnected` → `bleConnected` |

---

## AI Phân tích — Google Cloud Vision (Free)

### Setup

| Bước | Chi tiết |
|------|----------|
| 1 | Tạo Google Cloud account |
| 2 | Enable Cloud Vision API |
| 3 | Tạo API key |
| 4 | Free tier: 1000 units/tháng |

### Phân tích di tích

Gửi ảnh JPEG base64 lên Google Vision API với:
- `LABEL_DETECTION`: detect "crack", "moss", "moisture", "damage"
- `OBJECT_LOCALIZATION`: bounding box vị trí phát hiện

### Kết quả trả về

```typescript
interface HeritageAnalysis {
  labels: { description: string; score: number }[];
  cracks: { x: number; y: number; w: number; h: number; confidence: number }[];
  summary: string;
  severity: 'low' | 'medium' | 'high';
}
```

### Severity mapping

| Issue | Severity |
|-------|----------|
| crack, structural damage | HIGH |
| moss, moisture, erosion | MEDIUM |
| none | LOW |

---

## Tabs Layout

```
6 tabs, tất cả đều hiện trong tab bar:

Trang chủ | Camera | Biểu đồ | AI | Lịch sử | Cài đặt
```

---

## Implementation Phases

### Phase 1: BLE Foundation (3-4 ngày)

| Task | File |
|------|------|
| BLE service lib | `src/lib/ble.ts` |
| BLE store | `src/store/deviceStore.ts` |
| Mock BLE | `src/lib/mockBle.ts` |
| Settings BLE UI | `src/app/(tabs)/settings.tsx` |
| Rename mqtt→ble | `dashboardStore.ts`, `types/dashboard.ts` |

### Phase 2: Camera Integration (3-4 ngày)

| Task | File |
|------|------|
| Camera store | `src/store/cameraStore.ts` |
| File storage | `src/lib/fileStorage.ts` |
| JPEG reassembly | `src/lib/ble.ts` |
| Camera tab | `src/app/(tabs)/camera.tsx` |
| CameraCard | `src/components/dashboard/CameraCard.tsx` |

### Phase 3: AI Integration (2-3 ngày)

| Task | File |
|------|------|
| AI lib | `src/lib/aiAnalysis.ts` |
| Mock AI | `src/lib/mockAiAnalysis.ts` |
| Detection store | `src/store/detectionStore.ts` |
| AI tab | `src/app/(tabs)/ai.tsx` |
| Severity badges | `src/components/dashboard/RiskBadge.tsx` |

### Phase 4: Charts + History (1-2 ngày)

| Task | File |
|------|------|
| Charts tab | `src/app/(tabs)/charts.tsx` |
| History tab | `src/app/(tabs)/history.tsx` |
| Tab layout | `src/app/(tabs)/_layout.tsx` |

### Phase 5: Firmware (2-3 ngày)

| Task | File |
|------|------|
| Camera script | `main.py` (OpenMV) |
| MCU BLE server | `main.cpp` (Mini R4) |
| MCU UART handler | `main.cpp` |
| Test end-to-end | — |

### Phase 6: Testing + Demo (1-2 ngày)

| Task | Chi tiết |
|------|----------|
| Mock mode test | App chạy offline với mock data |
| BLE test | Kết nối thật với robot |
| AI test | Gửi ảnh lên Google Vision |
| Demo preparation | Video, slides, presentation |

---

## Dependencies

| Package | Đã có | Dùng cho |
|---------|-------|----------|
| `react-native-ble-plx` | ✅ | BLE communication |
| `expo-file-system` | ✅ | Lưu JPEG |
| `expo-notifications` | ✅ | Local alerts |
| `zustand` | ✅ | State management |
| `react-native-chart-kit` | ✅ | Charts |
| `react-native-svg` | ✅ | Chart rendering |

Không cần cài thêm thư viện nào.

---

## Chi phí

| Item | Chi phí |
|------|---------|
| Google Cloud Vision | $0 (1000 units/tháng free) |
| BLE | $0 (hardware tích hợp) |
| OpenMV IDE | $0 (open source) |
| **Tổng** | **$0** |
