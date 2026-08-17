#include "MatrixMiniR4.h"
#include <ArduinoBLE.h>
#include "utils.h"
#include <math.h>

// ── BLE UUIDs (match app's ble.ts) ─────────────────────
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHAR_CAMERA_UUID    "12345678-1234-5678-1234-56789abcdef1"
#define CHAR_DETECTION_UUID "12345678-1234-5678-1234-56789abcdef2"
#define CHAR_SENSOR_UUID    "12345678-1234-5678-1234-56789abcdef3"
#define CHAR_COMMAND_UUID   "12345678-1234-5678-1234-56789abcdef4"
#define CHAR_STATUS_UUID    "12345678-1234-5678-1234-56789abcdef5"
#define CHAR_MAP_DATA_UUID  "12345678-1234-5678-1234-56789abcdef6"

// ── BLE Objects ────────────────────────────────────────
BLEService heriguardService(SERVICE_UUID);

BLECharacteristic charCamera(CHAR_CAMERA_UUID,    BLERead | BLENotify, 512);
BLECharacteristic charDetection(CHAR_DETECTION_UUID, BLERead | BLENotify, 64);
BLECharacteristic charSensor(CHAR_SENSOR_UUID,    BLERead | BLENotify, 4);
BLECharacteristic charCommand(CHAR_COMMAND_UUID,   BLEWrite, 20);
BLECharacteristic charStatus(CHAR_STATUS_UUID,     BLERead | BLENotify, 4);
BLECharacteristic charMapData(CHAR_MAP_DATA_UUID,  BLERead | BLENotify, 9);

// ── State Machine ──────────────────────────────────────
enum RobotState {
  IDLE = 0,
  PATROL_MOVE = 1,
  INSPECT_A = 2,
  INSPECT_B = 3,
  INSPECT_C = 4,
  INSPECT_D = 5,
  INSPECT_E = 6,
  EMERGENCY = 7,
};

RobotState robotState = IDLE;
bool patrolActive = false;
bool bleConnected = false;

// ── Sensor ─────────────────────────────────────────────
float temperature = 0;
int   humidity    = 0;
uint8_t battery   = 0;

// Giá trị hợp lệ gần nhất — nếu DHT lỗi, giữ giá trị cũ thay vì trả 0
// → app không "mất dữ liệu" khi MS-011 đọc lỗi thường xuyên
float lastGoodTemp = 27.0;
int   lastGoodHum  = 60;

unsigned long lastSensorRead = 0;
unsigned long lastNotify     = 0;
const unsigned long SENSOR_INTERVAL = 2000;

// ── LED (WS2812B x2, platform MiniR4) ───────────────────
// Lưu ý API: MiniR4.LED.setColor(idx, r, g, b) — idx phải là 1 hoặc 2.
void setLedColor(uint8_t r, uint8_t g, uint8_t b) {
  MiniR4.LED.setColor(1, r, g, b);
  MiniR4.LED.setColor(2, r, g, b);
}

const unsigned long LED_BLINK_INTERVAL = 1000;  // 1s mỗi trạng thái LED khi chưa kết nối
unsigned long lastBlinkTime = 0;
bool ledOn = false;
uint8_t ledPhase = 0;  // 0=đỏ, 1=xanh lá, 2=xanh dương (self-test lặp lại)

// ════════════════════════════════════════════════════════════
//  DI CHUYỂN — tham khảo trực tiếp WRO 2026 B3 (src/main.cpp)
// ════════════════════════════════════════════════════════════

constexpr int MOTOR_MIN = -100;
constexpr int MOTOR_MAX = 100;
constexpr int BASE_SPEED = 46;
constexpr int MIN_BASE_SPEED = 24;
constexpr int MAX_CORRECTION = 72;
constexpr int MAX_MOTOR_STEP_PER_LOOP = 30;
constexpr uint8_t LINE_THRESHOLD = 30;
constexpr bool INVERT_LEFT = false;   // M3
constexpr bool INVERT_RIGHT = true;   // M4
constexpr uint32_t LOOP_DT_MS = 3;
constexpr uint8_t JUNCTION_CONFIRM_FRAMES = 2;
constexpr uint32_t JUNCTION_REARM_MS = 140;
constexpr uint8_t EDGE_JUNCTION_MIN_WIDTH = 8;
constexpr uint8_t CUSTOM_JUNCTION_ACTIVE_THRESHOLD = 45;
constexpr uint8_t ZONE_FOLLOW_ACTIVE_THRESHOLD = 18;
constexpr uint8_t LINE_LOST_CONFIRM_FRAMES = 3;
constexpr uint32_t LINE_LOST_EMERGENCY_MS = 3000;  // mất line > 3s → EMERGENCY
constexpr uint16_t SERVO_HOME_ANGLE = 0;
constexpr uint16_t SERVO_4_HOME_ANGLE = 90;
constexpr uint16_t BUZZER_LEFT_FREQUENCY = 700;
constexpr uint16_t BUZZER_RIGHT_FREQUENCY = 1000;
constexpr uint32_t BUZZER_JUNCTION_DURATION_MS = 35;
constexpr int      FORWARD_SPEED         = 40;
constexpr float    WHEEL_DIAMETER_CM     = 6.5f;  // HIỆU CHỈNH: đo đường kính bánh xe (cm)

constexpr float PID_KP = 18.0f;
constexpr float PID_KI = 0.002f;
constexpr float PID_KD = 2.0f;
constexpr float PID_INTEGRAL_LIMIT = 8.0f;
constexpr float ERROR_FILTER_ALPHA = 0.45f;
constexpr float ERROR_DEADBAND = 0.05f;
constexpr float DERIVATIVE_LIMIT = 15.0f;

struct PidState {
  float integral = 0.0f;
  float prevError = 0.0f;
  float filteredError = 0.0f;
};

enum class FollowPidMode : uint8_t {
  LeftEdge = 0,
  RightEdge = 1,
};

struct FollowPidRuntime {
  uint8_t leftJunctionCount = 0;
  uint8_t rightJunctionCount = 0;
  uint8_t pendingJunctionType = 0;
  uint8_t pendingJunctionFrames = 0;
  uint32_t lastJunctionCountMs = 0;
  uint32_t junctionHoldUntilMs = 0;
  bool junctionLatched = false;
};

PidState gPid;
FollowPidMode gFollowMode = FollowPidMode::RightEdge;
FollowPidRuntime gFollowRt;
int gBaseSpeed = BASE_SPEED;
int gLastLeftMotorCommand = 0;
int gLastRightMotorCommand = 0;
unsigned long gLastLoopMs = 0;
uint8_t gLineLostFrames = 0;
unsigned long gLineLostSinceMs = 0;

// ── PID Line Following (từ B3) ─────────────────────────
// ── Encoder ────────────────────────────────────────────
#define WHEEL_CIRCUMFERENCE_M  (3.14159f * WHEEL_DIAMETER_CM / 100.0f)  // ~0.204m
#define DISTANCE_TARGET_M 0.5f        // meters per stop
#define MOVE_TIMEOUT_MS 15000UL       // fail-safe: 15s cho 1 đoạn 0.5m

// ── Laser ──────────────────────────────────────────────
#define OBSTACLE_THRESHOLD_MM 200

// ── Servo angles (RC1: pan, RC2: fold, RC3: tilt, RC4: twist) ──
#define SERVO_PAN_L     45    // RC1: Pan trái
#define SERVO_PAN_C     90    // RC1: Pan giữa (home)
#define SERVO_PAN_R     135   // RC1: Pan phải
#define SERVO_FOLD      0     // RC2: Gập cam (home)
#define SERVO_TILT_LOW  45    // RC3: Hạ cam (scan low)
#define SERVO_TILT_HIGH 135   // RC3: Nâng cam (scan high)
#define SERVO_TILT_HOME 90    // RC3: Home
#define SERVO_TWIST_LOW 0     // RC4: Góc thấp
#define SERVO_TWIST_HIGH 180  // RC4: Góc cao
#define SERVO_TWIST_HOME 90   // RC4: Home

// ── Virtual Map ────────────────────────────────────────
struct MapMarker {
  uint8_t distance_x2;
  uint8_t flags;
  uint8_t confidence;
  int16_t temperature_hundredths;
  uint16_t humidity_hundredths;
  uint16_t timestamp_seconds;
};

uint8_t markerDistanceCount = 0;
unsigned long patrolStartTime = 0;

// ── Camera JPEG Capture (M-Vision Cam, custom main.py) ──
// Camera MicroPython gửi JPEG qua UART 921600, trigger 'C':
// frame = 0xAA + length(2B BE) + data + checksum(XOR). QQVGA ~3-6KB.
// Detection qua trigger 'D': 0xDD + count + N×(x,y,w,h,label,confidence)
#define JPEG_BUF_SIZE 6000
#define JPEG_CHUNK_PAYLOAD 200  // MTU max 242 - 3 ATT - 10 header
#define CAM_TRIGGER 'C'
#define CAM_DETECT 'D'
#define MAX_DETECTIONS 8

uint8_t jpegBuffer[JPEG_BUF_SIZE];
uint16_t jpegLen = 0;
uint16_t frameId = 0;

// ── Camera context (nối vào header JPEG + detection BLE) ──
// nodeX2: 0 = 0m, 1 = 0.5m, 2 = 1.0m... (mỗi marker)
// shotKind: 0=wide(A), 1=close_low(C), 2=close_high(D), 3=manual
uint8_t camNodeX2 = 0;
uint8_t camShotKind = 0;
uint8_t camPan = 90;
uint8_t camTilt = 90;

struct CamDetection {
  uint8_t x, y, w, h;        // QQVGA 160x120 (x>>2 từ camera)
  uint8_t label;             // 0=crack_small,1=crack_large,2=moss,3=mold,4=stain
  uint8_t confidence;        // 0-100
};
CamDetection camDets[MAX_DETECTIONS];
uint8_t camDetCount = 0;

// ── Forward ────────────────────────────────────────────
void readSensor();
void sendSensor();
void sendStatus();
void updateDisplay();
bool captureJpegFromCam();
void sendJpegViaBle();
void handleCommand(uint8_t* buf, int len);
void onBLEConnected(BLEDevice central);
void onBLEDisconnected(BLEDevice central);
void onCommandWritten(BLEDevice central, BLECharacteristic characteristic);
void runStateMachine();
void patrolMove();
void inspectWide();
void inspectRetract();
void inspectCloseApproach();
void inspectScanLow();
void inspectScanHigh();
bool readDetectionFromCam();
void sendDetectionViaBle();
void sendMapMarker(uint8_t distX2, uint8_t flags, uint8_t conf);
bool checkObstacle();
void initRobot();
void setRcAngle(uint8_t id, uint16_t angle);
void initServosToHome();
void servoHome();
void servoPan(uint8_t angle);
int clampMotor(int value);
int limitMotorStep(int targetValue, int lastValue);
void setTankRaw(int left, int right);
void setTankSmoothed(int left, int right);
void stopRobot();
void resetPid();
float computeDtSec(uint32_t nowMs, uint32_t lastMs, uint32_t fallbackLoopMs);
float computePidCorrection(float error, float dtSec);
bool readLineSensors(uint8_t sensors[10]);
float getLineIntensity(uint8_t sensorValue);
float computeZoneFollowError(const uint8_t sensors[10], uint8_t startSensorId,
                             uint8_t endSensorId, float targetSensorId);
uint8_t computeLineWidthFromSensors(const uint8_t sensors[10]);
uint8_t detectRightEdgeJunctionTypeFromSensors(const uint8_t sensors[10]);
void playJunctionTone(uint8_t junctionType);
uint8_t updateJunctionCounters(uint8_t junctionType, FollowPidRuntime& runtime);
void followRightEdgeStep();
void handleJunction(uint8_t junctionType);
bool isLineLostBySensorRule(const uint8_t sensors[10]);
void driveForwardCm(int speed, float targetCm);
void turnMotors(int l, int r);
float readImuYaw();
void resetImuYaw();
void turnToAngle(RobotUtils::TurnDirection dir, float deg);
bool followLineUntilLaserBelow(FollowPidMode mode, uint16_t stopDistanceMm,
                               uint32_t timeoutMs, uint8_t stableFrames);
void resetFollowRuntime();

// ── Setup ──────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Self-test LED: đỏ → xanh → xanh dương lúc khởi động (mỗi màu 800ms).
  Serial.println("SELFTEST LED RED");
  setLedColor(200, 0, 0);
  delay(800);
  Serial.println("SELFTEST LED GREEN");
  setLedColor(0, 200, 0);
  delay(800);
  Serial.println("SELFTEST LED BLUE");
  setLedColor(0, 0, 200);
  delay(800);
  Serial.println("SELFTEST DONE");
  setLedColor(0, 0, 0);

  // Khởi động robot — giống WRO 2026 B3 (initRobot)
  initRobot();

  // UART cho M-Vision Cam (custom firmware, 921600 baud)
  Serial1.begin(921600);

  if (!BLE.begin()) {
    Serial.println("BLE init failed");
    setLedColor(255, 0, 0);
    while (1);
  }

  BLE.setLocalName("HERI-GUARD-R4");
  BLE.setAdvertisedService(heriguardService);

  heriguardService.addCharacteristic(charCamera);
  heriguardService.addCharacteristic(charDetection);
  heriguardService.addCharacteristic(charSensor);
  heriguardService.addCharacteristic(charCommand);
  heriguardService.addCharacteristic(charStatus);
  heriguardService.addCharacteristic(charMapData);

  BLE.addService(heriguardService);

  charCommand.setEventHandler(BLEWritten, onCommandWritten);
  BLE.setEventHandler(BLEConnected,    onBLEConnected);
  BLE.setEventHandler(BLEDisconnected, onBLEDisconnected);

  BLE.advertise();

  setLedColor(0, 0, 200);
  Serial.println("HERI-GUARD BLE ready");
}

// ── Khởi động robot (từ B3: initRobot) ─────────────────
void initRobot() {
  if (!MiniR4.begin()) {
    while (true) {
      delay(1000);
    }
  }

  MiniR4.PWR.setBattCell(2);
  MiniR4.I2C0.MXLineTracer.begin();
  MiniR4.I2C0.MXLineTracer.setThreshold(LINE_THRESHOLD);
  MiniR4.I2C1.MXLaserV2.begin();
  MiniR4.Motion.begin();  // IMU 6-axis cho turnByAngle
  initServosToHome();     // servo về vị trí camera home
  stopRobot();
  resetPid();
  resetFollowRuntime();
  Serial.println("Robot initialized (B3 movement lib)");
}

// ═════════ Mother control ═════════
int clampMotor(int value) {
  return constrain(value, MOTOR_MIN, MOTOR_MAX);
}

int limitMotorStep(int targetValue, int lastValue) {
  const int delta = constrain(targetValue - lastValue, -MAX_MOTOR_STEP_PER_LOOP, MAX_MOTOR_STEP_PER_LOOP);
  return clampMotor(lastValue + delta);
}

void setTankRaw(int left, int right) {
  const int leftOut = INVERT_LEFT ? -left : left;
  const int rightOut = INVERT_RIGHT ? -right : right;
  MiniR4.M3.setSpeed(clampMotor(leftOut));
  MiniR4.M4.setSpeed(clampMotor(rightOut));
  gLastLeftMotorCommand = clampMotor(left);
  gLastRightMotorCommand = clampMotor(right);
}

void setTankSmoothed(int left, int right) {
  const int limitedLeft = limitMotorStep(clampMotor(left), gLastLeftMotorCommand);
  const int limitedRight = limitMotorStep(clampMotor(right), gLastRightMotorCommand);
  setTankRaw(limitedLeft, limitedRight);
}

void stopRobot() {
  setTankRaw(0, 0);
}

// ═════════ PID (từ B3) ═════════
void resetPid() {
  gPid.integral = 0.0f;
  gPid.prevError = 0.0f;
  gPid.filteredError = 0.0f;
  gLastLeftMotorCommand = 0;
  gLastRightMotorCommand = 0;
}

void resetFollowRuntime() {
  gFollowRt = FollowPidRuntime();
  gLineLostFrames = 0;
  gLineLostSinceMs = 0;
}

float computeDtSec(uint32_t nowMs, uint32_t lastMs, uint32_t fallbackLoopMs) {
  float dtSec = static_cast<float>(nowMs - lastMs) / 1000.0f;
  if (dtSec <= 0.0f) {
    dtSec = static_cast<float>(fallbackLoopMs) / 1000.0f;
  }
  return dtSec;
}

float computePidCorrection(float error, float dtSec) {
  float rawError = error;
  if (fabsf(rawError) < ERROR_DEADBAND) {
    rawError = 0.0f;
  }

  gPid.filteredError += ERROR_FILTER_ALPHA * (rawError - gPid.filteredError);
  const float filteredError = gPid.filteredError;

  gPid.integral += rawError * dtSec;
  gPid.integral = constrain(gPid.integral, -PID_INTEGRAL_LIMIT, PID_INTEGRAL_LIMIT);

  float derivative = 0.0f;
  if (dtSec > 0.0001f) {
    derivative = (filteredError - gPid.prevError) / dtSec;
  }
  derivative = constrain(derivative, -DERIVATIVE_LIMIT, DERIVATIVE_LIMIT);

  gPid.prevError = filteredError;
  const float correction = PID_KP * rawError + PID_KI * gPid.integral + PID_KD * derivative;
  return constrain(correction, -MAX_CORRECTION, MAX_CORRECTION);
}

// ═════════ Line sensor (I2C0 — theo B3) ═════════
float getLineIntensity(uint8_t sensorValue) {
  const int intensity = 100 - sensorValue;
  return intensity > 0 ? static_cast<float>(intensity) : 0.0f;
}

bool readLineSensors(uint8_t sensors[10]) {
  return MiniR4.I2C0.MXLineTracer.getAllSensors(sensors);
}

float computeZoneFollowError(const uint8_t sensors[10],
                             uint8_t startSensorId,
                             uint8_t endSensorId,
                             float targetSensorId) {
  float weightedSum = 0.0f;
  float totalWeight = 0.0f;

  for (uint8_t sensorId = startSensorId; sensorId <= endSensorId; ++sensorId) {
    const float lineIntensity = getLineIntensity(sensors[sensorId - 1]);
    if (lineIntensity > ZONE_FOLLOW_ACTIVE_THRESHOLD) {
      weightedSum += lineIntensity * sensorId;
      totalWeight += lineIntensity;
    }
  }

  if (totalWeight <= 0.0f) {
    return 0.0f;  // không goi I2C: tra ve 0 de di thang, linelost se xu ly
  }

  const float position = weightedSum / totalWeight;
  return position - targetSensorId;
}

uint8_t computeLineWidthFromSensors(const uint8_t sensors[10]) {
  uint8_t count = 0;
  for (uint8_t i = 0; i < 10; ++i) {
    if (getLineIntensity(sensors[i]) > CUSTOM_JUNCTION_ACTIVE_THRESHOLD) {
      ++count;
    }
  }
  return count;
}

// Two-gate: width>=8 chống rung lắc + kênh 9&10 active → xác nhận cạnh phải
uint8_t detectRightEdgeJunctionTypeFromSensors(const uint8_t sensors[10]) {
  if (computeLineWidthFromSensors(sensors) < EDGE_JUNCTION_MIN_WIDTH) return 0;
  const bool ch9Active  = getLineIntensity(sensors[8]) > CUSTOM_JUNCTION_ACTIVE_THRESHOLD;
  const bool ch10Active = getLineIntensity(sensors[9]) > CUSTOM_JUNCTION_ACTIVE_THRESHOLD;
  return (ch9Active && ch10Active) ? 2 : 0;
}

// Two-gate: width>=8 + kênh 1-4 active >= 3 → cạnh trái
uint8_t detectLeftEdgeJunctionTypeFromSensors(const uint8_t sensors[10]) {
  if (computeLineWidthFromSensors(sensors) < EDGE_JUNCTION_MIN_WIDTH) return 0;
  uint8_t activeCount = 0;
  for (uint8_t i = 0; i < 4; ++i) {
    if (getLineIntensity(sensors[i]) > CUSTOM_JUNCTION_ACTIVE_THRESHOLD) {
      ++activeCount;
    }
  }
  return activeCount >= 3 ? 1 : 0;
}

void playJunctionTone(uint8_t junctionType) {
  switch (junctionType) {
    case 1:
      MiniR4.Buzzer.Tone(BUZZER_LEFT_FREQUENCY, BUZZER_JUNCTION_DURATION_MS);
      return;
    case 2:
      MiniR4.Buzzer.Tone(BUZZER_RIGHT_FREQUENCY, BUZZER_JUNCTION_DURATION_MS);
      return;
    default:
      return;
  }
}

// Đếm junction (B3): xác nhận cùng type qua JUNCTION_CONFIRM_FRAMES frame.
// Trả về type junction vừa latch (1=trái, 2=phải), 0 nếu không có gì mới.
uint8_t updateJunctionCounters(uint8_t junctionType, FollowPidRuntime& runtime) {
  const uint32_t now = millis();

  if (junctionType == 0 || junctionType == 4) {
    runtime.pendingJunctionType = 0;
    runtime.pendingJunctionFrames = 0;
    if (now - runtime.lastJunctionCountMs >= JUNCTION_REARM_MS) {
      runtime.junctionLatched = false;
    }
    return 0;
  }

  if (runtime.junctionLatched) {
    return 0;
  }

  // Xác nhận cùng 1 loại junction qua nhiều frame để tránh nhiễu
  if (runtime.pendingJunctionType == junctionType) {
    if (runtime.pendingJunctionFrames < 255) {
      ++runtime.pendingJunctionFrames;
    }
  } else {
    runtime.pendingJunctionType = junctionType;
    runtime.pendingJunctionFrames = 1;
  }

  if (runtime.pendingJunctionFrames < JUNCTION_CONFIRM_FRAMES) {
    return 0;
  }

  runtime.junctionLatched = true;
  runtime.lastJunctionCountMs = now;
  runtime.pendingJunctionType = 0;
  runtime.pendingJunctionFrames = 0;

  if (junctionType == 1) {
    if (runtime.leftJunctionCount < 255) {
      ++runtime.leftJunctionCount;
    }
    playJunctionTone(junctionType);
    return 1;
  }
  if (junctionType == 2) {
    if (runtime.rightJunctionCount < 255) {
      ++runtime.rightJunctionCount;
    }
    playJunctionTone(junctionType);
    return 2;
  }
  return 0;
}

// Rẽ vuông góc 90° tại junction (B3: đếm junction rồi xoay theo IMU)
void handleJunction(uint8_t junctionType) {
  if (robotState != PATROL_MOVE) return;

  stopRobot();
  Serial.print("Junction: ");
  Serial.println(junctionType == 1 ? "LEFT" : "RIGHT");

  turnToAngle(junctionType == 1 ? RobotUtils::TurnDirection::Left
                                : RobotUtils::TurnDirection::Right,
              90);

  // Sau khi rẽ: reset encoder + PID → đo 0.5m tiếp theo từ đây
  MiniR4.M3.resetCounter();
  MiniR4.M4.resetCounter();
  resetPid();
  resetFollowRuntime();
  gLastLoopMs = millis();
  Serial.println("Turned 90deg, continuing patrol");
}

// B3: mất line khi số sensor active < 2 (cùng ngưỡng LINE_THRESHOLD)
bool isLineLostBySensorRule(const uint8_t sensors[10]) {
  constexpr uint8_t kLostIntensityThreshold = 100u - LINE_THRESHOLD;  // = 70
  uint8_t activeCount = 0;
  for (uint8_t i = 0; i < 10; ++i) {
    if (getLineIntensity(sensors[i]) > kLostIntensityThreshold) {
      ++activeCount;
    }
  }
  return activeCount < 2;
}

// 1 bước bám cạnh phải (không blocking — gọi mỗi vòng loop)
void followRightEdgeStep() {
  const uint32_t now = millis();
  const float dtSec = computeDtSec(now, gLastLoopMs, LOOP_DT_MS);
  gLastLoopMs = now;

  uint8_t sensors[10] = {0};
  if (!readLineSensors(sensors)) {
    return;
  }

  // RIGHT_EDGE: kênh 1-6 bám line (target 3.5); kênh 8-10 + width>=8 → junction phải
  const float followError = computeZoneFollowError(sensors, 1, 6, 3.5f);
  const uint8_t junctionType = detectRightEdgeJunctionTypeFromSensors(sensors);
  const uint8_t latchedJunction = updateJunctionCounters(junctionType, gFollowRt);

  // Xác nhận junction mới → rẽ vuông góc rồi tiếp tục đo 0.5m (B3 A1.1)
  if (latchedJunction != 0) {
    handleJunction(latchedJunction);
    return;
  }

  // Mất line (B3 A1.4): 3 frame liên tiếp → dừng; mất > 3s → EMERGENCY
  if (isLineLostBySensorRule(sensors)) {
    if (gLineLostFrames < 255) ++gLineLostFrames;
  } else {
    gLineLostFrames = 0;
    gLineLostSinceMs = 0;
  }
  if (gLineLostFrames >= LINE_LOST_CONFIRM_FRAMES) {
    stopRobot();
    if (gLineLostSinceMs == 0) {
      gLineLostSinceMs = millis();
      Serial.println("Line lost — stopped");
    }
    if (millis() - gLineLostSinceMs >= LINE_LOST_EMERGENCY_MS) {
      robotState = EMERGENCY;
      if (bleConnected) sendStatus();
      Serial.println("Line lost too long — EMERGENCY");
    }
    return;
  }

  const float correction = computePidCorrection(followError, dtSec);
  const float turnDemand = fabsf(followError);
  int base = gBaseSpeed - static_cast<int>(turnDemand * 4.2f);
  base = constrain(base, MIN_BASE_SPEED, gBaseSpeed);

  const int left = static_cast<int>(base + correction);
  const int right = static_cast<int>(base - correction);
  setTankSmoothed(left, right);
}

// ═════════ Di chuyển thẳng theo encoder (từ B3) ═════════
void driveForwardCm(int speed, float targetCm) {
  const int driveSpeed = clampMotor(speed);
  const float distanceCm = fabsf(targetCm);
  if (driveSpeed == 0 || distanceCm <= 0.0f) {
    stopRobot();
    return;
  }

  const float circumCm  = 3.14159f * WHEEL_DIAMETER_CM;
  const float targetDeg = (distanceCm / circumCm) * 360.0f;
  MiniR4.M3.resetCounter();
  setTankRaw(driveSpeed, driveSpeed);
  const uint32_t startMs = millis();
  while (true) {
    if (millis() - startMs > 5000) break;  // timeout 5s
    if (fabsf(static_cast<float>(MiniR4.M3.getDegrees())) >= targetDeg) break;
    delay(2);
  }
  stopRobot();
}

// ═════════ Xoay tại chỗ theo IMU (từ B3 turnByAngle) ═════════
void turnMotors(int l, int r) { setTankRaw(l, r); }

float readImuYaw() {
  // Board gắn thẳng đứng: trục Roll là trục xoay (đã chỉnh trong B3)
  return static_cast<float>(MiniR4.Motion.getEuler(MiniR4Motion::AxisType::Roll));
}

void resetImuYaw() { MiniR4.Motion.resetIMUValues(); delay(100); }

const RobotUtils::TurnHardware gTurnHw = { turnMotors, readImuYaw, resetImuYaw };

void turnToAngle(RobotUtils::TurnDirection dir, float deg) {
  RobotUtils::TurnConfig cfg;
  cfg.direction    = dir;
  cfg.targetDeg    = deg;
  cfg.fullSpeed    = 40;
  cfg.slowSpeed    = 18;
  cfg.decelZoneDeg = 20.0f;
  cfg.toleranceDeg = 3.0f;
  cfg.timeoutMs    = 3000;
  RobotUtils::turnByAngle(cfg, gTurnHw);
  delay(150);
}

// ═════════ Bám line tới khi laser dưới ngưỡng (từ B3) ═════════
bool followLineUntilLaserBelow(FollowPidMode mode,
                               uint16_t stopDistanceMm,
                               uint32_t timeoutMs,
                               uint8_t stableFrames) {
  if (stopDistanceMm == 0 || timeoutMs == 0) {
    stopRobot();
    return false;
  }

  stableFrames = stableFrames == 0 ? 1 : stableFrames;
  const uint32_t loopDtMs = 15;
  const uint32_t startMs = millis();

  stopRobot();
  resetPid();

  delay(200);  // chờ robot ổn định sau khi dừng

  constexpr uint16_t LASER_INVALID_DISTANCE_MM = 20;
  uint8_t belowFrames = 0;

  while (true) {
    if (millis() - startMs >= timeoutMs) {
      break;
    }

    const uint32_t now = millis();
    if (now - gLastLoopMs < loopDtMs) {
      delay(2);
      continue;
    }
    gLastLoopMs = now;

    uint8_t sensors[10] = {0};
    if (!readLineSensors(sensors)) {
      continue;
    }

    float followError = 0.0f;
    switch (mode) {
      case FollowPidMode::LeftEdge:
        followError = computeZoneFollowError(sensors, 1, 5, 3.0f);
        break;
      case FollowPidMode::RightEdge:
      default:
        followError = computeZoneFollowError(sensors, 6, 10, 8.0f);
        break;
    }
    const float dtSec = static_cast<float>(loopDtMs) / 1000.0f;

    const float correction = computePidCorrection(followError, dtSec);
    int base = BASE_SPEED;
    base = constrain(base, MIN_BASE_SPEED, BASE_SPEED);

    const int left = base + static_cast<int>(correction);
    const int right = base - static_cast<int>(correction);
    setTankRaw(left, right);

    const uint16_t distanceMm = MiniR4.I2C1.MXLaserV2.getDistance();
    if (distanceMm > LASER_INVALID_DISTANCE_MM && distanceMm < stopDistanceMm) {
      if (belowFrames >= stableFrames) {
        stopRobot();
        return true;
      }
      belowFrames++;
    } else {
      belowFrames = 0;
    }
  }

  stopRobot();
  return false;
}

// ═════════ Servo (single dispatch point — từ B3 setRcAngle) ═════════
void setRcAngle(uint8_t id, uint16_t angle) {
  switch (id) {
    case 1: MiniR4.RC1.setAngle(angle); break;
    case 2: MiniR4.RC2.setAngle(angle); break;
    case 3: MiniR4.RC3.setAngle(angle); break;
    case 4: MiniR4.RC4.setAngle(angle); break;
    default: break;
  }
}

// Init KHÔNG dùng step-state vì chưa có encoder servo — gọi setRcAngle
// trực tiếp (blocking PWM) + delay cho servo về vị trí physical.
void initServosToHome() {
  setRcAngle(1, SERVO_PAN_C);
  setRcAngle(2, SERVO_FOLD);
  setRcAngle(3, SERVO_TILT_HOME);
  setRcAngle(4, SERVO_TWIST_HOME);
  delay(400);
}

void servoHome() {
  setRcAngle(1, SERVO_PAN_C);
  setRcAngle(2, SERVO_FOLD);
  setRcAngle(3, SERVO_TILT_HOME);
  setRcAngle(4, SERVO_TWIST_HOME);
}

void servoPan(uint8_t angle) {
  setRcAngle(1, angle);
  delay(300);  // Chờ servo tới vị trí
}

// ── Loop ───────────────────────────────────────────────
void loop() {
  BLE.poll();

  // LED khi CHƯA kết nối BLE: SELF-TEST lặp lại — xoay màu 1s mỗi pha
  if (!bleConnected) {
    unsigned long now = millis();
    if (now - lastBlinkTime >= LED_BLINK_INTERVAL) {
      lastBlinkTime = now;
      ledOn = !ledOn;
      if (ledOn) {
        if (ledPhase == 0) {
          setLedColor(200, 0, 0);
          Serial.println("LED PHASE RED");
        } else if (ledPhase == 1) {
          setLedColor(0, 200, 0);
          Serial.println("LED PHASE GREEN");
        } else {
          setLedColor(0, 0, 200);
          Serial.println("LED PHASE BLUE");
        }
        ledPhase = (ledPhase + 1) % 3;
      } else {
        setLedColor(0, 0, 0);
      }
    }
  }

  // Priority 2: Obstacle check — bên trong chỉ trigger khi PATROL_MOVE
  // (tránh xung đột với INSPECT_B tiến tới tường ở ngưỡng 200mm)
  checkObstacle();

  // Priority 3: IMU tilt check — nghiêng thì giảm tốc
  float ay = MiniR4.Motion.getAccel(MiniR4Motion::AxisType::Y);
  if (fabsf(ay) > 0.5 && robotState == PATROL_MOVE) {
    gBaseSpeed = 25;
  } else {
    gBaseSpeed = BASE_SPEED;
  }

  // Priority 4: State machine
  if (patrolActive) {
    runStateMachine();
  }

  // Sensor read every 2s
  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    readSensor();
    lastSensorRead = now;
  }

  // BLE notify every 2s
  if (bleConnected && now - lastNotify >= SENSOR_INTERVAL) {
    sendSensor();
    sendStatus();
    updateDisplay();
    lastNotify = now;
  }
}

// ── State Machine ──────────────────────────────────────
void runStateMachine() {
  switch (robotState) {
    case PATROL_MOVE:
      patrolMove();
      break;
    case INSPECT_A:
      inspectWide();
      break;
    case INSPECT_B:
      inspectCloseApproach();
      break;
    case INSPECT_C:
      inspectScanLow();
      break;
    case INSPECT_D:
      inspectScanHigh();
      break;
    case INSPECT_E:
      inspectRetract();
      break;
    default:
      break;
  }
}

// Bám cạnh phải bằng PID B3 — mỗi loop() 1 bước, dừng khi encoder đủ 0.5m
void patrolMove() {
  followRightEdgeStep();

  float degLeft = MiniR4.M3.getDegrees();
  float degRight = MiniR4.M4.getDegrees();
  float avgDeg = (degLeft + degRight) / 2.0f;
  float meters = avgDeg / 360.0f * WHEEL_CIRCUMFERENCE_M;

  if (meters >= DISTANCE_TARGET_M) {
    stopRobot();
    MiniR4.M3.resetCounter();
    MiniR4.M4.resetCounter();
    resetPid();
    resetFollowRuntime();
    robotState = INSPECT_A;
    Serial.print("Reached 0.5m, inspecting. dist=");
    Serial.println(markerDistanceCount);
  }
}

void inspectWide() {
  // Read DHT at inspection point
  readSensor();

  // Send sensor data
  if (bleConnected) {
    sendSensor();
  }

  uint8_t flags = 0;
  uint8_t confidence = 0;
  bool hasIssue = false;

  if (bleConnected) {
    // Auto-capture baseline wide shot for this node
    camNodeX2 = markerDistanceCount;
    camShotKind = 0;       // Wide (A)
    camPan = SERVO_PAN_C;
    camTilt = SERVO_TILT_HOME;
    if (captureJpegFromCam()) {
      sendJpegViaBle();
    }

    // Real Edge-AI detection on this node (từ camera, không phải random)
    if (readDetectionFromCam()) {
      hasIssue = true;
      for (uint8_t i = 0; i < camDetCount; i++) {
        const CamDetection &d = camDets[i];
        if (d.confidence > confidence) confidence = d.confidence;
        switch (d.label) {
          case 0: flags |= 0x20; break;                     // crack_small
          case 1: flags |= 0x40; break;                     // crack_large
          case 2: flags |= 0x04; break;                     // moss
          case 3: flags |= 0x08; break;                     // mold
          case 4: flags |= 0x10; break;                     // stain
        }
      }
      sendDetectionViaBle();
      Serial.print("Issue detected by camera, flags=");
      Serial.println(flags);
    } else {
      Serial.print("Node ");
      Serial.print(markerDistanceCount * 0.5);
      Serial.println("m: no issue (wide scan clean)");
    }
  }

  sendMapMarker(markerDistanceCount, flags, confidence);
  markerDistanceCount++;

  // Có nghi ngờ → INSPECT_B (close scan); sạch → retract rồi đi tiếp
  if (hasIssue) {
    robotState = INSPECT_B;
    return;
  }
  robotState = INSPECT_E;
}

void inspectRetract() {
  // Reset camera position (servo placeholder)
  setRcAngle(1, SERVO_PAN_C);
  setRcAngle(2, SERVO_FOLD);
  setRcAngle(3, SERVO_TILT_HOME);
  setRcAngle(4, SERVO_TWIST_HOME);

  delay(100);
  robotState = PATROL_MOVE;
}

// ── Virtual Map ────────────────────────────────────────
void sendMapMarker(uint8_t distX2, uint8_t flags, uint8_t conf) {
  if (!bleConnected) return;

  int16_t tHundredths = (int16_t)(temperature * 100);
  uint16_t hHundredths = (uint16_t)(humidity * 100);
  uint16_t elapsed = (uint16_t)((millis() - patrolStartTime) / 1000);

  uint8_t data[9];
  data[0] = distX2;
  data[1] = flags;
  data[2] = conf;
  data[3] = (uint8_t)(tHundredths & 0xFF);
  data[4] = (uint8_t)((tHundredths >> 8) & 0xFF);
  data[5] = (uint8_t)(hHundredths & 0xFF);
  data[6] = (uint8_t)((hHundredths >> 8) & 0xFF);
  data[7] = (uint8_t)(elapsed & 0xFF);
  data[8] = (uint8_t)((elapsed >> 8) & 0xFF);

  charMapData.writeValue(data, 9);
  Serial.print("Map marker sent: dist=");
  Serial.print(distX2 * 0.5);
  Serial.print("m flags=");
  Serial.print(flags);
  Serial.print(" conf=");
  Serial.println(conf);
}

// ── Obstacle ───────────────────────────────────────────
bool checkObstacle() {
  // Chỉ kiểm tra khi đang chạy — không cản INSPECT_B tiến tới tường
  if (robotState != PATROL_MOVE) {
    return false;
  }
  uint16_t distance = MiniR4.I2C1.MXLaserV2.getDistance();
  if (distance < OBSTACLE_THRESHOLD_MM && distance > 20) {
    stopRobot();
    if (robotState != EMERGENCY) {
      robotState = EMERGENCY;
      if (bleConnected) sendStatus();
      Serial.println("Obstacle! Emergency stop.");
    }
    return true;
  }
  return false;
}

// ── BLE Events ─────────────────────────────────────────
void onBLEConnected(BLEDevice central) {
  bleConnected = true;
  setLedColor(0, 200, 0);
  Serial.println("BLE connected");
  MiniR4.Buzzer.Tone(880, 100);
  delay(100);
  MiniR4.Buzzer.Tone(1100, 150);
}

void onBLEDisconnected(BLEDevice central) {
  bleConnected = false;
  setLedColor(0, 0, 200);
  Serial.println("BLE disconnected");
  if (patrolActive) {
    stopRobot();
  }
}

void onCommandWritten(BLEDevice central, BLECharacteristic characteristic) {
  uint8_t buf[20];
  int len = characteristic.readValue(buf, 20);
  if (len < 1) return;
  handleCommand(buf, len);
}

// ── Sensor ─────────────────────────────────────────────
void readSensor() {
  int dhtErr = MiniR4.D1.MXDHT.readTemperatureHumidity(temperature, humidity);
  if (dhtErr != 0 || temperature < -10 || temperature > 60 || humidity < 0 || humidity > 100) {
    // DHT lỗi hoặc giá trị vô lý → giữ giá trị gần nhất, không trả 0
    if (dhtErr != 0) {
      Serial.print("DHT: ");
      Serial.println(MiniR4.D1.MXDHT.getErrorString(dhtErr));
    } else {
      Serial.println("DHT: value out of range");
    }
    temperature = lastGoodTemp;
    humidity = lastGoodHum;
  } else {
    lastGoodTemp = temperature;
    lastGoodHum = humidity;
  }
  battery = (uint8_t)MiniR4.PWR.getBattPercentage();
  Serial.print("T="); Serial.print(temperature, 1);
  Serial.print(" H="); Serial.print(humidity, 1);
  Serial.print(" B="); Serial.println(battery);
}

void sendSensor() {
  int16_t t = (int16_t)(temperature * 100);
  uint16_t h = (uint16_t)(humidity * 100);
  uint8_t d[4] = {
    (uint8_t)(t & 0xFF),
    (uint8_t)((t >> 8) & 0xFF),
    (uint8_t)(h & 0xFF),
    (uint8_t)((h >> 8) & 0xFF)
  };
  charSensor.writeValue(d, 4);
}

void sendStatus() {
  uint8_t d[4] = {
    battery,
    0,
    (uint8_t)robotState,
    patrolActive ? 1 : 0
  };
  charStatus.writeValue(d, 4);
}

// ── Camera JPEG Capture ─────────────────────────────────
bool captureJpegFromCam() {
  if (!bleConnected) return false;

  // Dọn byte rác còn sót trong buffer (banner "CAM READY" hoặc frame cũ)
  while (Serial1.available()) {
    Serial1.read();
  }

  // Gửi trigger 'C' → camera chụp JPEG, gửi về UART
  Serial1.write(CAM_TRIGGER);

  unsigned long start = millis();
  const unsigned long TIMEOUT = 3000;

  // Đọc header: 0xAA + length (3 bytes)
  uint8_t header[3];
  int read = 0;
  while (read < 3) {
    if (Serial1.available()) {
      header[read++] = Serial1.read();
    } else if (millis() - start > TIMEOUT) {
      Serial.println("JPEG: header timeout");
      return false;
    }
  }

  if (header[0] != 0xAA) {
    Serial.print("JPEG: bad header 0x");
    Serial.println(header[0], HEX);
    return false;
  }

  uint16_t length = ((uint16_t)header[1] << 8) | header[2];
  if (length == 0 || length > JPEG_BUF_SIZE) {
    Serial.print("JPEG: bad length ");
    Serial.println(length);
    return false;
  }

  // Đọc JPEG data
  uint16_t idx = 0;
  while (idx < length) {
    if (Serial1.available()) {
      jpegBuffer[idx++] = Serial1.read();
    } else if (millis() - start > TIMEOUT) {
      Serial.print("JPEG: data timeout ");
      Serial.print(idx);
      Serial.print("/");
      Serial.println(length);
      return false;
    }
  }

  // Đọc + verify checksum
  while (millis() - start < TIMEOUT) {
    if (Serial1.available()) {
      uint8_t receivedChecksum = Serial1.read();

      uint8_t calcChecksum = 0xAA ^ header[1] ^ header[2];
      for (uint16_t i = 0; i < length; i++) {
        calcChecksum ^= jpegBuffer[i];
      }

      if (receivedChecksum != calcChecksum) {
        Serial.println("JPEG: checksum mismatch");
        return false;
      }

      jpegLen = length;
      Serial.print("JPEG: captured ");
      Serial.print(length);
      Serial.println(" bytes");
      return true;
    }
  }

  Serial.println("JPEG: checksum timeout");
  return false;
}

void sendJpegViaBle() {
  if (!bleConnected || jpegLen == 0) return;

  uint16_t totalChunks = (jpegLen + JPEG_CHUNK_PAYLOAD - 1) / JPEG_CHUNK_PAYLOAD;

  for (uint16_t i = 0; i < totalChunks; i++) {
    uint16_t offset = i * JPEG_CHUNK_PAYLOAD;
    uint16_t chunkSize = min((uint16_t)JPEG_CHUNK_PAYLOAD, jpegLen - offset);

    // Header 10 bytes: frameId(2) + nodeX2(1) + shotKind(1) + pan(1) + tilt(1) + chunkIdx(2) + totalChunks(2)
    uint8_t chunk[512];
    chunk[0] = frameId & 0xFF;
    chunk[1] = (frameId >> 8) & 0xFF;
    chunk[2] = camNodeX2;
    chunk[3] = camShotKind;
    chunk[4] = camPan;
    chunk[5] = camTilt;
    chunk[6] = i & 0xFF;
    chunk[7] = (i >> 8) & 0xFF;
    chunk[8] = totalChunks & 0xFF;
    chunk[9] = (totalChunks >> 8) & 0xFF;
    memcpy(chunk + 10, jpegBuffer + offset, chunkSize);

    charCamera.writeValue(chunk, 10 + chunkSize);
    delay(25);  // 25ms cho 200B/chunk ≈ 8KB/s — Android không thả packet
  }

  Serial.print("JPEG: sent ");
  Serial.print(totalChunks);
  Serial.print(" chunks via BLE (node=");
  Serial.print(camNodeX2);
  Serial.print(", shot=");
  Serial.print(camShotKind);
  Serial.println(")");

  frameId++;
  jpegLen = 0;
}

// ── Command Handler ────────────────────────────────────
void handleCommand(uint8_t* buf, int len) {
  char cmd = (char)buf[0];

  // Speed command
  if (cmd == 'S' && len >= 3) {
    int8_t speedLeft = (int8_t)buf[1];
    int8_t speedRight = (int8_t)buf[2];
    gBaseSpeed = max(abs(speedLeft), abs(speedRight));
    Serial.print("Cmd: SPEED set to ");
    Serial.println(gBaseSpeed);
    return;
  }

  switch (cmd) {
    case 'C':
      Serial.println("Cmd: CAPTURE JPEG");
      setLedColor(200, 200, 0);
      if (captureJpegFromCam()) {
        sendJpegViaBle();
        setLedColor(0, 200, 0);
      } else {
        setLedColor(200, 0, 0);
        delay(200);
        setLedColor(0, 200, 0);
        Serial.println("Cmd: CAPTURE FAILED");
      }
      break;

    case 'N':
      // Test tĩnh (bench): robot CHỈ chụp ảnh + gửi nhiệt độ/độ ẩm qua BLE.
      // KHÔNG detect trên robot — model nhận diện chạy trên APP: nếu ảnh đạt
      // ngưỡng, app lưu ảnh + nhiệt độ/độ ẩm tại node và phân tích như tuần tra.
      Serial.println("Cmd: STATIC CAPTURE (AI on app)");
      setLedColor(200, 200, 0);
      readSensor();
      if (bleConnected) sendSensor();
      {
        camNodeX2 = markerDistanceCount;
        camShotKind = 0;       // wide
        camPan = SERVO_PAN_C;
        camTilt = SERVO_TILT_HOME;
        bool ok = captureJpegFromCam();
        if (ok) sendJpegViaBle();
        setLedColor(ok ? 0 : 200, 200, 0);
        delay(150);
        setLedColor(0, 200, 0);
        Serial.println(ok ? "STATIC CAPTURE: sent to app" : "STATIC CAPTURE: failed");
      }
      break;

    case 'P':
      Serial.println("Cmd: START PATROL");
      if (!patrolActive) {
        patrolActive = true;
        robotState = PATROL_MOVE;
        markerDistanceCount = 0;
        patrolStartTime = millis();
        MiniR4.M3.resetCounter();
        MiniR4.M4.resetCounter();
        resetPid();
        resetFollowRuntime();
        gLastLoopMs = millis();
        servoHome();
        if (bleConnected) sendStatus();
      }
      break;

    case 'X':
      Serial.println("Cmd: STOP");
      stopRobot();
      patrolActive = false;
      robotState = IDLE;
      if (bleConnected) sendStatus();
      break;

    default:
      Serial.print("Cmd: unknown ");
      Serial.println(cmd);
      break;
  }
}

// ── INSPECT_B: Close Approach ──────────────────────────
// Laser đo khoảng → bám line tiến tới 15-20cm → chụp ảnh cận cảnh
void inspectCloseApproach() {
  const uint16_t dist = MiniR4.I2C1.MXLaserV2.getDistance();
  Serial.print("Close approach: dist=");
  Serial.println(dist);

  // Bám line tiến đến cách tường 15-20cm (PID B3 + laser threshold 200mm)
  if (dist > 250 && dist <= 1999) {
    followLineUntilLaserBelow(FollowPidMode::RightEdge, 200, 5000, 2);
  }
  stopRobot();

  // Căn lại line ngắn sau khi tiến (nếu lệch)
  uint8_t sensors[10] = {0};
  if (readLineSensors(sensors)) {
    const float err = computeZoneFollowError(sensors, 1, 6, 3.5f);
    if (fabsf(err) > 1.0f) {
      const int correction = constrain((int)(err * 15), -30, 30);
      setTankRaw(constrain(-correction, -30, 30), constrain(correction, -30, 30));
      delay(200);
      stopRobot();
    }
  }

  // Chụp ảnh cận cảnh (shotKind 3 = manual close-up)
  if (bleConnected) {
    camNodeX2 = markerDistanceCount > 0 ? markerDistanceCount - 1 : 0;
    camShotKind = 3;
    camPan = SERVO_PAN_C;
    camTilt = SERVO_TILT_LOW;
    if (captureJpegFromCam()) {
      sendJpegViaBle();
    }
  }
  robotState = INSPECT_C;
}

// ── INSPECT_C: Scan Low ────────────────────────────────
// RC3 hạ cam, RC4 góc thấp, RC1 pan 3 vị trí
void inspectScanLow() {
  setRcAngle(3, SERVO_TILT_LOW);    // Hạ cam
  setRcAngle(4, SERVO_TWIST_LOW);   // Góc thấp
  delay(500);

  // Pan: trái → giữa → phải
  uint8_t positions[] = {SERVO_PAN_L, SERVO_PAN_C, SERVO_PAN_R};
  for (int i = 0; i < 3; i++) {
    servoPan(positions[i]);
    if (bleConnected) {
      camNodeX2 = markerDistanceCount > 0 ? markerDistanceCount - 1 : 0;
      camShotKind = 1; // close low
      camPan = positions[i];
      camTilt = SERVO_TILT_LOW;
      if (captureJpegFromCam()) {
        sendJpegViaBle();
      }
      if (readDetectionFromCam()) {
        sendDetectionViaBle();
      }
    }
  }

  robotState = INSPECT_D;
}

// ── INSPECT_D: Scan High ───────────────────────────────
// RC3 nâng cam, RC4 góc cao, RC1 pan 3 vị trí
void inspectScanHigh() {
  setRcAngle(3, SERVO_TILT_HIGH);   // Nâng cam
  setRcAngle(4, SERVO_TWIST_HIGH);  // Góc cao
  delay(500);

  // Pan: trái → giữa → phải
  uint8_t positions[] = {SERVO_PAN_L, SERVO_PAN_C, SERVO_PAN_R};
  for (int i = 0; i < 3; i++) {
    servoPan(positions[i]);
    if (bleConnected) {
      camNodeX2 = markerDistanceCount > 0 ? markerDistanceCount - 1 : 0;
      camShotKind = 2; // close high
      camPan = positions[i];
      camTilt = SERVO_TILT_HIGH;
      if (captureJpegFromCam()) {
        sendJpegViaBle();
      }
      if (readDetectionFromCam()) {
        sendDetectionViaBle();
      }
    }
  }

  robotState = INSPECT_E;
}

// ── Camera AI Detection (từ camera 'D', không phải random) ──
// Camera gửi: 0xDD + count + N x [x,y,w,h,label,confidence] (6 bytes mỗi blob)
bool readDetectionFromCam() {
  if (!bleConnected) return false;

  // Dọn buffer như captureJpegFromCam()
  while (Serial1.available()) {
    Serial1.read();
  }

  Serial1.write(CAM_DETECT);

  unsigned long start = millis();
  const unsigned long TIMEOUT = 3000;

  // Đọc header: 0xDD + count
  uint8_t header[2];
  int read = 0;
  while (read < 2) {
    if (Serial1.available()) {
      header[read++] = Serial1.read();
    } else if (millis() - start > TIMEOUT) {
      Serial.println("DET: header timeout");
      return false;
    }
  }

  if (header[0] != 0xDD) {
    Serial.print("DET: bad header 0x");
    Serial.println(header[0], HEX);
    return false;
  }

  uint8_t count = header[1];
  if (count > MAX_DETECTIONS) {
    count = MAX_DETECTIONS;
  }
  camDetCount = 0;

  // Đọc từng detection: [x,y,w,h,label,confidence]
  for (uint8_t i = 0; i < count; i++) {
    uint8_t pkt[6];
    int pRead = 0;
    while (pRead < 6) {
      if (Serial1.available()) {
        pkt[pRead++] = Serial1.read();
      } else if (millis() - start > TIMEOUT) {
        Serial.print("DET: packet timeout ");
        Serial.print(i);
        Serial.print("/");
        Serial.println(count);
        return camDetCount > 0;
      }
    }
    CamDetection &d = camDets[camDetCount++];
    d.x = pkt[0];
    d.y = pkt[1];
    d.w = pkt[2];
    d.h = pkt[3];
    d.label = pkt[4];
    d.confidence = pkt[5];
  }

  Serial.print("DET: ");
  Serial.print(camDetCount);
  Serial.println(" detections from camera");
  return camDetCount > 0;
}

// ── Send Detection via BLE (12 bytes: label, confidence, nodeX2, shotKind, x, y, w, h, temp, hum) ──
void sendDetectionViaBle() {
  if (!bleConnected || camDetCount == 0) return;

  for (uint8_t i = 0; i < camDetCount; i++) {
    const CamDetection &d = camDets[i];
    int16_t tH = (int16_t)(temperature * 100);
    uint16_t hH = (uint16_t)(humidity * 100);
    uint8_t data[12] = {
      d.label,
      d.confidence,
      camNodeX2,
      camShotKind,
      d.x,
      d.y,
      d.w,
      d.h,
      (uint8_t)(tH & 0xFF),
      (uint8_t)((tH >> 8) & 0xFF),
      (uint8_t)(hH & 0xFF),
      (uint8_t)((hH >> 8) & 0xFF)
    };
    charDetection.writeValue(data, 12);
    Serial.print("DET BLE: label=");
    Serial.print(d.label);
    Serial.print(" conf=");
    Serial.print(d.confidence);
    Serial.print(" node=");
    Serial.print(camNodeX2);
    Serial.print(" shot=");
    Serial.println(camShotKind);
  }
}

// ── Display ────────────────────────────────────────────
void updateDisplay() {
  MiniR4.OLED.clearDisplay();
  MiniR4.OLED.setTextSize(1);
  MiniR4.OLED.setTextColor(SSD1306_WHITE);
  MiniR4.OLED.setCursor(0, 0);
  MiniR4.OLED.println("HERI-GUARD");
  MiniR4.OLED.setCursor(0, 16);
  MiniR4.OLED.print("State: ");
  MiniR4.OLED.println(robotState);
  MiniR4.OLED.setCursor(0, 32);
  MiniR4.OLED.print("T: "); MiniR4.OLED.print(temperature, 1); MiniR4.OLED.println(" C");
  MiniR4.OLED.setCursor(0, 48);
  MiniR4.OLED.print("H: "); MiniR4.OLED.print(humidity, 1); MiniR4.OLED.println(" %");
  MiniR4.OLED.display();
}