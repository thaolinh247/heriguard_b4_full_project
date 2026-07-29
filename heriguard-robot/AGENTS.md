# HERI-GUARD - Agent Instructions

## Project Overview
Hệ thống Robot Tuần tra Tự hành HERI-GUARD
- Robot tự hành đi theo line, thu thập dữ liệu môi trường
- Camera pan/tilt quan sát đa chiều, phát hiện vết nứt
- Truyền dữ liệu lên server qua WiFi/MQTT
- Web dashboard theo dõi real-time

## Hardware Specs
- **MCU**: MATRIX Mini R4 (Arduino UNO R4 WiFi)
- **Motors**: M3 (trái), M4 (phải) - DC motor + encoder
- **Servos**: RC1 (ngang), RC2 (gập cam), RC3 (nâng cam), RC4 (xoay trục)
- **Sensors**:
  - I2C1: Laser Sensor V2 MS-009V2 (21-1999mm, 50Hz)
  - I2C2: Line Tracer V2 (10CH, weight-based error -4.5 to 4.5)
  - D1: DHT MS-011 (Temp 0-50°C ±2°C, Humidity 20-90% ±5%)
  - UART (Serial1, 9600): M-Vision Cam MS-010 (crack detection, color tracking)
- **Built-in**: OLED 128x64, LED RGB, Buzzer, 6-axis IMU, WiFi (ESP32-S3)

## Pin Mapping
| Port | Component | Arduino Pin | API |
|------|-----------|-------------|-----|
| M3 | Motor trai | STM32 controlled | `MiniR4.M3.setSpeed(-100~100)` |
| M4 | Motor phai | STM32 controlled | `MiniR4.M4.setSpeed(-100~100)` |
| M1 | (reserved) | STM32 controlled | `MiniR4.M1` |
| M2 | (reserved) | STM32 controlled | `MiniR4.M2` |
| RC1 | Servo ngang | STM32 controlled | `MiniR4.RC1.setAngle(0~180)` |
| RC2 | Servo gap cam | STM32 controlled | `MiniR4.RC2.setAngle(0~180)` |
| RC3 | Servo nang cam | STM32 controlled | `MiniR4.RC3.setAngle(0~180)` |
| RC4 | Servo xoay truc | STM32 controlled | `MiniR4.RC4.setAngle(0~180)` |
| I2C1 | Laser V2 | MUX ch 0 | `MiniR4.I2C1.MXLaserV2.getDistance()` |
| I2C2 | Line Tracer | MUX ch 1 | `MiniR4.I2C2.MXLineTracer.getError()` |
| D1 | DHT MS-011 | D3 (digital) | `dht.readTemperature()` |
| UART | M-Vision Cam | Serial1 | `MiniR4.Vision.SmartCamReader()` |

## Project Structure
```
heriguard-b4/
├── src/
│   └── main.cpp                # Main firmware (PlatformIO)
├── include/
├── lib/
├── test/
├── platformio.ini              # PlatformIO config
├── web/                        # Next.js web dashboard (future)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
└── AGENTS.md                   # This file
```

## Development Environment
- **IDE**: PlatformIO (VS Code) or Arduino IDE v2.x
- **Board**: `uno_r4_wifi` (Renesas RA)
- **Framework**: Arduino
- **Required Libraries** (platformio.ini):
  - `MatrixMiniR4@^1.2.2` - motor, servo, IMU, OLED, LED, Buzzer
  - `PubSubClient` - MQTT client
  - `ArduinoJson` - JSON serialization
  - `DHT sensor library` (adafruit) - cho MS-011
  - `WiFiS3` - built-in WiFi (no need to add)

## MatrixMiniR4 API Quick Reference

### Motor (DC with encoder)
```cpp
MiniR4.M3.setSpeed(speed);      // -100 to 100 (PID controlled)
MiniR4.M3.setPower(power);      // -100 to 100 (raw PWM)
MiniR4.M3.setReverse(true);     // reverse direction
MiniR4.M3.setPPR_RPM(390, 180); // encoder PPR, max RPM
MiniR4.M3.setFixSpeedPID(kp, ki, kd);
MiniR4.M3.getCounter();         // encoder count
MiniR4.M3.getDegrees();         // rotation degrees
MiniR4.M3.resetCounter();
MiniR4.M3.setBrake(true);       // brake mode
MiniR4.M3.rotateFor(speed, degree); // non-blocking rotate
MiniR4.M3.ChkRotateEnd(isEnd);  // check rotation done
```

### Servo (RC)
```cpp
MiniR4.RC1.begin();             // init servo
MiniR4.RC1.setAngle(angle);     // 0-180 degrees
MiniR4.RC1.setHWDir(true);      // hardware direction
```

### Line Tracer V2 (I2C)
```cpp
MiniR4.I2C2.MXLineTracer.begin();
float err = MiniR4.I2C2.MXLineTracer.getError(); // -4.5 to 4.5
uint8_t sensors[10];
MiniR4.I2C2.MXLineTracer.getAllSensors(sensors);
uint8_t jt = MiniR4.I2C2.MXLineTracer.getJunctionType(); // 0-4
MiniR4.I2C2.MXLineTracer.getLineWidth(); // 1-10 sensors
MiniR4.I2C2.MXLineTracer.setThreshold(30);
MiniR4.I2C2.MXLineTracer.startCalibration();
MiniR4.I2C2.MXLineTracer.endCalibration();
MiniR4.I2C2.MXLineTracer.isOnline(); // bool
```

### Laser Sensor V2 (I2C)
```cpp
MiniR4.I2C1.MXLaserV2.begin();
uint16_t dist = MiniR4.I2C1.MXLaserV2.getDistance(); // mm (20 if invalid)
MiniR4.I2C1.MXLaserV2.startContinuous(100); // ms interval
MiniR4.I2C1.MXLaserV2.readRangeContinuousMillimeters();
MiniR4.I2C1.MXLaserV2.stopContinuous();
```

### M-Vision Cam (UART)
```cpp
MiniR4.Vision.Begin(); // 9600 baud
unsigned int data[16];
int result = MiniR4.Vision.SmartCamReader(data, 500); // timeout ms
// result > 0 = valid, data[0] = label, data[1] = confidence
// result: -1=timeout, -2=incomplete, -3=checksum fail
```

### OLED Display
```cpp
MiniR4.OLED.clearDisplay();
MiniR4.OLED.setTextSize(1);
MiniR4.OLED.setTextColor(SSD1306_WHITE);
MiniR4.OLED.setCursor(x, y);
MiniR4.OLED.println("text");
MiniR4.OLED.print(value);
MiniR4.OLED.display();
```

### IMU (6-axis Motion)
```cpp
MiniR4.Motion.begin();
MiniR4.Motion.resetIMUValues();
float ax = MiniR4.Motion.getAccelX();
float ay = MiniR4.Motion.getAccelY();
float az = MiniR4.Motion.getAccelZ();
float gx = MiniR4.Motion.getGyroX();
float gy = MiniR4.Motion.getGyroY();
float gz = MiniR4.Motion.getGyroZ();
```

### Other
```cpp
MiniR4.Buzzer.Tone(freq, duration); // Hz, ms
MiniR4.LED.setColor(r, g, b);      // 0-255
MiniR4.BTN_UP.getState();           // bool
MiniR4.BTN_DOWN.getState();         // bool
MiniR4.PWR.getBattVoltage();        // float V
MiniR4.PWR.getBattPercentage();     // float %
MiniR4.PWR.setBattCell(2);         // set cell count
MiniR4.WiFi.begin(ssid, pass);     // WiFiS3
```

## Code Conventions
- Firmware: Arduino C++, use `MiniR4` global object
- Web: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- MQTT Topics: `heriguard/sensor`, `heriguard/alert`, `heriguard/camera`, `heriguard/status`
- JSON format for all MQTT messages
- Sensor read interval: >=1 second (DHT11 limitation)
- Servo angle range: 0-180 degrees
- Motor speed: -100 to 100 (percentage)

## Build & Upload (PlatformIO)
```bash
# Build
pio run

# Upload
pio run --target upload

# Serial monitor
pio device monitor
```

## Build & Upload (Arduino IDE)
```
1. Select Board: Arduino UNO R4 WiFi
2. Select Port: COMx
3. Upload
```

## Testing Checklist
- [ ] Test each motor individually (M1-M4)
- [ ] Test each servo (RC1-RC4) angle limits
- [ ] Calibrate Line Tracer V2
- [ ] Test Laser V2 distance reading
- [ ] Test DHT MS-011 temperature/humidity
- [ ] Test M-Vision Cam UART communication
- [ ] Test WiFi connection and reconnection
- [ ] Test MQTT publish/subscribe
- [ ] Test OLED display updates
- [ ] Test IMU readings
- [ ] Test button inputs (BTN_UP, BTN_DOWN)
- [ ] Test battery voltage monitoring
- [ ] End-to-end patrol test
