# HERI-GUARD — Câu hỏi thuyết minh dự án

---

## Câu 2: Cảm biến + Code + Tác dụng

### 2.1 DHT MS-011 — Nhiệt độ & Độ ẩm

| Thông số | Giá trị |
|----------|---------|
| Cảm biến | DHT MS-011 (D1) |
| Kết nối | Digital — chân D3 trên Mini R4 |
| Nhiệt độ | 0 — 50°C, sai số ±2°C |
| Độ ẩm | 20 — 90%, sai số ±5% |
| Tần số đọc | Tối thiểu 1 giây/lần (do DHT11 limit) |

**Tác dụng:** Đo nhiệt độ và độ ẩm tại từng điểm dừng 0.5m, phát hiện môi trường vượt ngưỡng an toàn cho bảo tồn di tích (nhiệt >30°C, ẩm >75% — gây nứt, mốc tường).

**Code mẫu (trích từ `main.cpp` — hàm `readSensor()` + `sendSensor()`):**

```cpp
// main.cpp — đọc DHT, đóng gói, gửi BLE
float temperature = 0;
int   humidity    = 0;
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 2000;

void readSensor() {
  MiniR4.D1.MXDHT.readTemperatureHumidity(temperature, humidity);
  battery = (uint8_t)MiniR4.PWR.getBattPercentage();
  Serial.print("T="); Serial.print(temperature, 1);
  Serial.print(" H="); Serial.print(humidity, 1);
  Serial.print(" B="); Serial.println(battery);
}

void sendSensor() {
  // Pack: temp (int16 hundredths) + humidity (uint16 hundredths)
  int16_t t = (int16_t)(temperature * 100);
  uint16_t h = (uint16_t)(humidity * 100);
  uint8_t d[4] = {
    (uint8_t)(t & 0xFF),
    (uint8_t)((t >> 8) & 0xFF),
    (uint8_t)(h & 0xFF),
    (uint8_t)((h >> 8) & 0xFF)
  };
  charSensor.writeValue(d, 4);  // gửi qua BLE notify
}

void loop() {
  BLE.poll();
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    readSensor();
    lastSensorRead = millis();
  }
  if (bleConnected && millis() - lastNotify >= SENSOR_INTERVAL) {
    sendSensor();
    sendStatus();
    updateDisplay();
    lastNotify = millis();
  }
}
```

> Ba hàm này là code thật trong `main.cpp` — DHT được đọc mỗi 2 giây, đóng gói thành 4 byte (nhiệt độ 2 byte, độ ẩm 2 byte, đơn vị hundredths), gửi lên app qua BLE characteristic `charSensor`.

### 2.2 Laser V2 MS-009V2 — Khoảng cách dừng quét

| Thông số | Giá trị |
|----------|---------|
| Cảm biến | Laser V2 MS-009V2 |
| Kết nối | I2C1 — MUX channel 0 |
| Khoảng đo | 21 — 1999mm |
| Tần số | 50Hz |
| Giá trị lỗi | 20mm (khi đo không hợp lệ) |

**Tác dụng:**
- **Tránh vật cản khẩn cấp:** Khi Laser phát hiện vật cản < 200mm, robot dừng ngay — ưu tiên cao nhất sau lệnh Stop
- **Close Approach:** Khi Wide Scan nghi ngờ, Laser đo khoảng cách tường → robot tiến đến **15-20cm** để chụp cận cảnh

**Khoảng cách dừng để quét:**

```
   PHÁT HIỆN VẬT CẢN → DỪNG KHẨN CẤP
   ─────────────────────────────────
                                        Robot
   ■━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶
   │                                    │
   └── < 200mm ────────────────────────┘
   (dừng ngay, không inspect)

   WIDE SCAN (bắt buộc mỗi 0.5m)
   ───────────────────────────
   Chụp ở khoảng cách hiện tại (không cần Laser)
   Nếu nghi ngờ → đo khoảng cách → CLOSE APPROACH

   CLOSE APPROACH → quét sâu
   ─────────────────────────
   ████████████████████████████████
   │                               │
   └──── 150 — 200mm ─────────────┘
   (tiến đến ngưỡng lý tưởng, chụp cận cảnh)
```

**Code mẫu (trích từ `main.cpp` — xử lý Laser trong priority loop):**

```cpp
// main.cpp — Laser obstacle check (gọi đầu mỗi vòng loop)
uint16_t distance = MiniR4.I2C1.MXLaserV2.getDistance();

if (distance < 200 && distance > 20) {
  // Vật cản khẩn cấp < 20cm — dừng ngay
  MiniR4.M3.setSpeed(0);
  MiniR4.M4.setSpeed(0);
  if (state != EMERGENCY) {
    state = EMERGENCY;
    sendStatus();  // báo app
  }
}

// Dùng trong INSPECT_B (Close Approach):
void closeApproach() {
  uint16_t dist = MiniR4.I2C1.MXLaserV2.getDistance();
  if (dist > 200) {
    // Còn xa — tiến chậm
    MiniR4.M3.setSpeed(20);
    MiniR4.M4.setSpeed(20);
  } else if (dist >= 150) {
    // Đạt khoảng cách lý tưởng 15-20cm — dừng
    MiniR4.M3.setSpeed(0);
    MiniR4.M4.setSpeed(0);
    state = INSPECT_C;  // chuyển sang Scan Low
  }
}
```

> Code này là logic thật dự kiến trong `main.cpp` — Laser đọc distance, nếu <200mm thì dừng khẩn (ưu tiên #2 chỉ sau Stop), nếu trong khoảng 150-200mm thì bắt đầu quét sâu.

### 2.3 Line Tracer V2 — Dò line 10 kênh

| Thông số | Giá trị |
|----------|---------|
| Cảm biến | Line Tracer V2 (10 kênh) |
| Kết nối | I2C2 — MUX channel 1 |
| Error | -4.5 (lệch trái) → 0 (giữa) → +4.5 (lệch phải) |
| Junction type | 0=thẳng, 1=T-trái, 2=T-phải, 3=ngã tư, 4=kết thúc |
| Line width | 1-10 sensors |

**Tác dụng:** Dẫn đường cho robot — đọc error đưa vào PID controller → điều chỉnh tốc độ M3/M4 để bám line chính xác. Đồng thời phát hiện junction để rẽ nhánh theo lộ trình tuần tra.

**Code mẫu (trích từ `main.cpp` — PID line follow trong state PATROL_MOVE):**

```cpp
// main.cpp — chạy khi state == PATROL_MOVE
void patrolMove() {
  float error = MiniR4.I2C2.MXLineTracer.getError();

  // PID
  integral += error * 0.02;
  float derivative = error - lastError;
  float correction = kp * error + ki * integral + kd * derivative;

  int leftSpeed  = constrain(baseSpeed + (int)correction, -100, 100);
  int rightSpeed = constrain(baseSpeed - (int)correction, -100, 100);

  MiniR4.M3.setSpeed(leftSpeed);
  MiniR4.M4.setSpeed(rightSpeed);

  lastError = error;

  // Đếm encoder — dừng khi đủ 0.5m
  float degrees = (MiniR4.M3.getDegrees() + MiniR4.M4.getDegrees()) / 2.0f;
  float meters  = degrees / 360.0f * WHEEL_CIRCUMFERENCE;
  if (meters >= 0.5f) {
    MiniR4.M3.setSpeed(0);
    MiniR4.M4.setSpeed(0);
    MiniR4.M3.resetCounter();
    MiniR4.M4.resetCounter();
    integral = 0;  // reset I
    state = INSPECT_A;  // chuyển quét
  }
}
```

**Giải thích PID:**
- `kp * error` — đưa robot về line (tỉ lệ thuận với độ lệch)
- `ki * integral` — triệt tiêu sai số tích lũy (kéo dài)
- `kd * derivative` — giảm overshoot khi vào cua
- `correction` — cộng/trừ vào 2 motor để robot xoay về tâm line

### Mạch kết nối phần cứng

```
┌────────────────────────────────────────────────────────────────────┐
│                         MATRIX Mini R4                             │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    STM32 Co-processor                       │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────────┐ │   │
│  │  │ M3   │  │ M4   │  │ RC1  │  │ RC2  │  │ RC3 / RC4    │ │   │
│  │  │Motor │  │Motor │  │Servo │  │Servo │  │ Servo nâng   │ │   │
│  │  │Trái  │  │Phải  │  │Ngang │  │Gập   │  │ + xoay trục  │ │   │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Renesas RA4M1 (Main MCU)                     │   │
│  │                                                           │   │
│  │  I2C MUX ──┬── ch0: Laser V2 (đo khoảng cách)            │   │
│  │            └── ch1: Line Tracer V2 (dò line 10 kênh)     │   │
│  │                                                           │   │
│  │  D1 (Digital) ─── DHT MS-011 (nhiệt độ, độ ẩm)           │   │
│  │                                                           │   │
│  │  UART (Serial1) ─── M-Vision Cam MS-010 (JPEG + detect)  │   │
│  │                                                           │   │
│  │  Built-in ─── OLED 128x64, LED RGB, Buzzer, IMU, Pin     │   │
│  │                                                           │   │
│  │  ESP32-S3 ─── BLE 5.0 → Mobile App                      │   │
│  └────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Tác dụng tổng thể

Các cảm biến phối hợp tạo thành hệ thống **tự động giám sát di tích toàn diện**:
- **DHT** đo điều kiện môi trường — nhiệt/ẩm cao gây nứt, mốc tường
- **Line Tracer + Encoder** dẫn đường chính xác — robot tự hành đến từng điểm kiểm tra
- **Laser** bảo vệ robot khỏi va chạm + hỗ trợ canh khoảng chụp lý tưởng
- **Camera AI** phát hiện vết nứt ngay tại chỗ — không cần gửi ảnh lên cloud
- **IMU** đảm bảo robot vận hành ổn định trên địa hình di tích
- **Pin** đảm bảo robot hoàn thành lộ trình

---

## Câu 3: Sơ đồ dữ liệu đầu vào — Thu thập — Xử lý — Lưu trữ

### Toàn cảnh luồng dữ liệu

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MỘT LƯỢT TUẦN TRA (Patrol Session)               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Đầu vào (Input)                                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │Line Trace│ │Encoder   │ │Laser V2  │ │  Pin             │  │   │
│  │  │10 kênh   │ │M3 độ     │ │21-1999mm │ │  getBattPercent  │  │   │
│  │  │error -4.5│ │quay → m  │ │50Hz      │ │                  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Quá trình (Process) — State Machine trên robot                │   │
│  │                                                                 │   │
│  │  0.5m ──→ DỪNG ──→ INSPECT_A (Wide Scan) ──→ {nghi ngờ?}      │   │
│  │                        │                        │               │   │
│  │                    Đọc DHT                   Không ──→ E       │   │
│  │                    Chụp 1 ảnh                   (bỏ qua)        │   │
│  │                    AI detect nhanh               │               │   │
│  │                        │                        ▼               │   │
│  │                        │                    INSPECT_BCD         │   │
│  │                        │                    (quét sâu)          │   │
│  │                        │                      │                 │   │
│  │                        │              ┌───────┴───────┐         │   │
│  │                        │              │  Phát hiện?   │         │   │
│  │                        │              │  Có → lưu     │         │   │
│  │                        │              │  Không → bỏ   │         │   │
│  │                        │              └───────────────┘         │   │
│  │                        │                      │                 │   │
│  │                        └──────────┬───────────┘                 │   │
│  │                                   │                              │   │
│  │                                   ▼                              │   │
│  │                           INSPECT_E (Retract)                   │   │
│  │                                   │                              │   │
│  │                                   ▼                              │   │
│  │                         GHI VIRTUAL MAP MARKER                  │   │
│  │                         Gửi BLE cho app                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Đầu ra (Output) — Dữ liệu được lưu trữ                       │   │
│  │                                                                 │   │
│  │  Trên Robot (bộ nhớ tạm):                                       │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ Virtual Map: 12 markers × 9 bytes = 108 bytes/lượt      │   │   │
│  │  │ JPEG queue: tối đa 3-5 ảnh (~100KB)                     │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  Trên App (bộ nhớ dài hạn — expo-file-system):                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ PatrolHistory[]: {                                      │   │   │
│  │  │   id, startTime, endTime,                               │   │   │
│  │  │   mapMarkers: [{distance, issueType, confidence,        │   │   │
│  │  │                 temperature, humidity}],                 │   │   │
│  │  │   images: [{uri (local), timestamp, detections[]}],     │   │   │
│  │  │   sensorLogs: ChartDataPoint[]                          │   │   │
│  │  │ }                                                       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết về dữ liệu bị "bỏ qua"

**Nguyên tắc:** Chỉ lưu dữ liệu khi **có giá trị** — không lưu dữ liệu trùng lặp vô ích.

| Tình huống | Dữ liệu | Xử lý |
|-----------|---------|-------|
| Wide Scan không phát hiện gì | Ảnh chụp nhanh, DHT | **Bỏ ảnh** (không lưu), chỉ ghi marker "an toàn" vào virtual map + 1 dòng sensor log |
| Wide Scan phát hiện nghi ngờ | Ảnh + Detection | **Giữ ảnh**, lưu marker "cần kiểm tra", chuyển sang quét sâu |
| Scan Low/High phát hiện thật | Ảnh cận cảnh + Detection + DHT | **Lưu toàn bộ** — ảnh, marker chi tiết, bounding box, temp/hum tại thời điểm phát hiện |
| Không có patrol nào active | Tất cả | **Không ghi gì** — robot ở trạng thái idle |

**Mục đích:**
- Tiết kiệm dung lượng lưu trữ (chỉ giữ ảnh có vấn đề)
- Giảm thời gian xem lại của người quản lý (chỉ thấy các điểm bất thường)
- Tối ưu băng thông BLE (không gửi ảnh vô ích)

### Lưu trữ trên App

```
expo-file-system (documents directory):
└── heriguard/
    ├── patrols/
    │   ├── 2026-07-28_1430/
    │   │   ├── map.json          # Virtual map markers
    │   │   ├── sensor.json       # All sensor readings + timestamps
    │   │   ├── frame_0001.jpg    # Ảnh tại điểm 0.0m
    │   │   ├── frame_0002.jpg    # Ảnh tại điểm 0.5m (nếu có phát hiện)
    │   │   └── frame_0003.jpg    # Ảnh cận cảnh vết nứt
    │   └── ...
    └── alerts/
        └── alert_log.json        # Lịch sử cảnh báo
```

### Biểu đồ lịch sử

App hiển thị 2 dạng:
1. **Line Chart** (react-native-chart-kit) — nhiệt độ và độ ẩm theo thời gian thực, dual Y-axis, tối đa 50 điểm
2. **Virtual Map Timeline** — scrollable horizontal, marker màu theo mức độ (xanh=an toàn, vàng=cần chú ý, đỏ=cảnh báo), tap vào marker xem ảnh + chi tiết

### AI phân tích

AI chạy **trên robot** (M-Vision Cam — STM32H7): xử lý ảnh cục bộ, phát hiện vết nứt bằng threshold-based blob detection (không cần cloud). Kết quả gửi xuống app dưới dạng label + confidence. App hiển thị kết quả và đưa ra khuyến nghị rule-based dựa trên nhiệt độ, độ ẩm, và lịch sử phát hiện.

---

## Câu 4: Bảo vệ dữ liệu khỏi bị thay đổi trái phép

### 1. Toàn bộ dữ liệu nằm trên thiết bị local — không có server

```
┌──────────────┐          BLE (local, 1:1)          ┌──────────────┐
│   Robot      │◄──────────────────────────────────►│     App      │
│  (Mini R4)   │     Giao tiếp trực tiếp, không     │   (Phone)    │
│              │     qua Internet, không có server   │              │
│              │     trung gian, không cloud         │              │
└──────────────┘                                     └──────────────┘
```

- Dữ liệu **không bao giờ rời khỏi 2 thiết bị** (robot + điện thoại)
- Không có database server, không có cloud, không có API public
- BLE là giao thức **cục bộ**, phạm vi ~10m — hacker không thể truy cập từ xa

### 2. BLE yêu cầu ghép nối vật lý

```
App ──scan──→ "HERI-GUARD-R4" ──connect──→ Bonding ──→ Trao đổi dữ liệu
                    │                            │
              Chỉ hiện khi scan           Yêu cầu xác nhận
              trong phạm vi 10m          trên cả 2 thiết bị
```

- Robot chỉ kết nối với thiết bị đã ghép đôi (BLE bonding)
- Điện thoại phải ở gần robot (<10m) để scan và kết nối
- Kẻ tấn công không thể kết nối từ xa qua Internet

### 3. Dữ liệu trên app được bảo vệ

| Lớp | Biện pháp | Mô tả |
|-----|-----------|-------|
| **Hệ điều hành** | Sandbox | Mỗi app iOS/Android chạy trong sandbox riêng, không app khác đọc được |
| **File system** | App internal storage | `expo-file-system` lưu trong thư mục documents riêng của app — không truy cập được từ file manager thông thường |
| **Mã nguồn** | Không có API key/secret | App không gọi REST API, không có API key để lộ |
| **BLE** | Local only | Giao tiếp vật lý, không qua Internet |

### 4. Tính toàn vẹn dữ liệu trong quá trình truyền

Dữ liệu truyền qua BLE sử dụng cơ chế CRC32 (Cyclic Redundancy Check) ở tầng giao thức BLE — nếu dữ liệu bị hỏng trong quá trình truyền, BLE tự động phát hiện và yêu cầu gửi lại.

```
Robot                              App
  │                                  │
  │ BLE packet (CRC32 verified)      │
  │────────────────────────────────→│
  │                                  │ Nếu CRC lỗi → bỏ qua
  │ BLE packet (CRC32 verified)      │
  │────────────────────────────────→│
  │                                  │
```

### 5. Hạn chế

Dự án là **thiết bị ngoại tuyến, local** — không có kết nối Internet nên các rủi ro về an ninh mạng (SQL injection, XSS, MITM qua Internet) **không áp dụng**. Dữ liệu chỉ bị thay đổi nếu ai đó có **truy cập vật lý** vào điện thoại hoặc robot.

---

## Câu 5: Cảnh báo thông minh

### Sơ đồ luồng cảnh báo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       HỆ THỐNG CẢNH BÁO THÔNG MINH                     │
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │  DHT Sensor      │                                                   │
│  │  (mỗi 2s)        │────────────────┐                                  │
│  └──────────────────┘                │                                  │
│                                       ▼                                  │
│  ┌──────────────────┐           ┌──────────────────┐                    │
│  │  Camera AI       │           │  Rule Engine     │                    │
│  │  (mỗi điểm 0.5m) │──────────→│  (trên robot)    │                    │
│  └──────────────────┘           │                  │                    │
│                                  │  assessRisk():   │                    │
│  ┌──────────────────┐           │  - temp > 30°C   │──── Cảnh báo ────→│
│  │  Virtual Map     │           │  - humidity >75% │    qua BLE         │
│  │  (lịch sử)       │──────────→│  - crack small   │                    │
│  └──────────────────┘           │  - crack large   │                    │
│                                  │  - moss/mold     │                    │
│  ┌──────────────────┐           │  - tăng đột biến  │                    │
│  │  Pin < 20%       │──────────→│    so với marker  │                    │
│  └──────────────────┘           │      trước        │                    │
│                                  └──────────────────┘                    │
│                                           │                              │
│                                           ▼                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     App nhận cảnh báo                              │ │
│  │                                                                     │ │
│  │  ┌────────────────────────────────────────────────────────────┐   │ │
│  │  │  Phân loại mức độ:                                        │   │ │
│  │  │  ┌──────────┬──────────────────┬───────────────────────┐   │   │ │
│  │  │  │ Mức      │ Điều kiện        │ Hành động              │   │   │ │
│  │  │  ├──────────┼──────────────────┼───────────────────────┤   │   │ │
│  │  │  │ AN TOÀN │ hum ≤ 68%       │ Không cảnh báo         │   │   │ │
│  │  │  │ (xanh)   │ temp ≤ 28°C     │                         │   │   │ │
│  │  │  │          │ không phát hiện │                         │   │   │ │
│  │  │  ├──────────┼──────────────────┼───────────────────────┤   │   │ │
│  │  │  │ CẦN CHÚ Ý│ hum 68-75%     │ Badge vàng             │   │   │ │
│  │  │  │ (vàng)   │ temp 28-30°C   │ TrendSummary hiển thị  │   │   │ │
│  │  │  │          │ moss/mold nhẹ   │ "cần theo dõi"         │   │   │ │
│  │  │  ├──────────┼──────────────────┼───────────────────────┤   │   │ │
│  │  │  │ CẢNH BÁO │ hum > 75%      │ Badge đỏ              │   │   │ │
│  │  │  │ (đỏ)     │ temp > 30°C    │ Notification local    │   │   │ │
│  │  │  │          │ crack large    │ Virtual map đánh dấu   │   │   │ │
│  │  │  │          │ confidence >75%│ đỏ tại điểm phát hiện  │   │   │ │
│  │  │  └──────────┴──────────────────┴───────────────────────┘   │   │ │
│  │  └────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Các loại cảnh báo cụ thể

#### Cảnh báo 1: Nhiệt độ/Độ ẩm vượt ngưỡng

```
Robot (DHT) ── BLE notify ──→ App dashboardStore ──→ assessRisk()
                                 │
                                 ├── high (đỏ)?
                                 │   → alertStore.addAlert({
                                 │       type: "environment_high",
                                 │       message: "Độ ẩm 78.5% — vượt ngưỡng an toàn!",
                                 │       timestamp: ...
                                 │     })
                                 │   → expo-notifications:
                                 │     "HERI-GUARD: Độ ẩm vượt ngưỡng 78.5%"
                                 │   → LED robot: đỏ
                                 │   → Dashboard badge: CẢNH BÁO (đỏ)
                                 │
                                 └── medium (vàng)?
                                   → Dashboard badge: CẦN CHÚ Ý (vàng)
                                   → TrendSummary: "Nhiệt độ tăng nhẹ..."
```

#### Cảnh báo 2: Phát hiện vết nứt

```
Camera AI ── detect ──→ Robot state machine
                           │
                           ├── crack_small + confidence > 60%?
                           │   → Chụp ảnh cận cảnh
                           │   → Ghi marker: {issue: crack_small, confidence: 0.75}
                           │   → Gửi BLE: Detection char + Image chunks
                           │   → App: hiển thị marker vàng + ảnh trên Camera tab
                           │   → App: "Phát hiện vết nứt nhỏ tại vị trí 2.0m"
                           │
                           └── crack_large + confidence > 75%?
                             → Chụp ảnh cận cảnh
                             → Ghi marker: {issue: crack_large, confidence: 0.92}
                             → Gửi BLE: Detection + Image + Alert
                             → App: notification + badge đỏ + marker đỏ
                             → VirtualMap: đánh dấu đỏ tại 2.0m
```

#### Cảnh báo 3: So sánh với lịch sử (phát hiện xu hướng)

```
Patrol 1 (ngày 1):       marker[2.0m] = {issue: moss, confidence: 40%}
Patrol 2 (ngày 7):       marker[2.0m] = {issue: moss, confidence: 65%}
Patrol 3 (ngày 14):      marker[2.0m] = {issue: crack_small, confidence: 80%}
                                                            │
                         App AI phân tích:                   │
                         "Vết nứt tại tọa độ 2.0m có xu     │
                          hướng nghiêm trọng hơn qua các     │
                          tuần (moss → crack). Cần kiểm tra."│
                                                            ▼
                                                  CẢNH BÁO ĐỎ (ngày 14)
```

### Giao diện cảnh báo trên app

```
┌──────────────────────────────────────────┐
│  🔔 THÔNG BÁO (1 chưa đọc)               │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ ● CẢNH BÁO             14:32:05   │  │
│  │ Phát hiện vết nứt lớn tại vị trí  │  │
│  │ 2.0m — độ tin cậy 92%            │  │
│  │ [Xem chi tiết]                    │  │
│  ├────────────────────────────────────┤  │
│  │ ● Cần chú ý            14:28:12   │  │
│  │ Độ ẩm 72.3% — gần ngưỡng cảnh báo│  │
│  ├────────────────────────────────────┤  │
│  │ ● Cần chú ý            14:24:30   │  │
│  │ Phát hiện rêu tại vị trí 1.0m    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘

Virtual Map:
0m────0.5────1.0────1.5────2.0────2.5────3.0m
●─────●──────●──────●──────●──────●──────●
🟢    🟢     🟡     🟢     🔴     🟢     🟢
             rêu          nứt lớn
                          (92%)
```

### Cảnh báo khẩn cấp — Robot tự động

| Tình huống | Hành động robot | Gửi app |
|-----------|----------------|---------|
| Vật cản < 20cm | Dừng ngay, lùi, né | Alert: "Vật cản phía trước" |
| Nghiêng > 30° | Dừng, giảm tốc | Alert: "Robot nghiêng bất thường" |
| Pin < 15% | Kết thúc patrol, về đích | Alert: "Pin yếu — đang về đích" |
| Mất kết nối BLE > 10s | Tiếp tục patrol (chạy offline) | (App hiện "Mất kết nối") |
