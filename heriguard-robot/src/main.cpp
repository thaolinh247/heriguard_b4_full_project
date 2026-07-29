#include "MatrixMiniR4.h"
#include <ArduinoBLE.h>

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
int stateCycleStep = 0;

// ── Sensor ─────────────────────────────────────────────
float temperature = 0;
int   humidity    = 0;
uint8_t battery   = 0;

unsigned long lastSensorRead = 0;
unsigned long lastNotify     = 0;
const unsigned long SENSOR_INTERVAL = 2000;

// ── PID Line Following ─────────────────────────────────
float kp = 1.5, ki = 0.05, kd = 0.3;
float lastError = 0, integral = 0;
int baseSpeed = 40;

#define WHEEL_CIRCUMFERENCE 0.215  // meters (calibrate for actual wheel)
#define DISTANCE_TARGET 0.5f        // meters per stop

// ── Encoder ────────────────────────────────────────────
float encoderTotalMeters = 0;

// ── Laser ──────────────────────────────────────────────
#define OBSTACLE_THRESHOLD_MM 200

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

// ── Camera chunking ────────────────────────────────────
#define JPEG_BUF_SIZE 60000
uint8_t jpegBuffer[JPEG_BUF_SIZE];
uint16_t jpegLen = 0;
uint16_t frameId = 0;

// ── Forward ────────────────────────────────────────────
void readSensor();
void sendSensor();
void sendStatus();
void updateDisplay();
void captureAndSendImage();
void handleCommand(uint8_t* buf, int len);
void onBLEConnected(BLEDevice central);
void onBLEDisconnected(BLEDevice central);
void onCommandWritten(BLEDevice central, BLECharacteristic characteristic);
void runStateMachine();
void patrolMove();
void inspectWide();
void inspectRetract();
void sendMapMarker(uint8_t distX2, uint8_t flags, uint8_t conf);
bool checkObstacle();
void initSensors();

// ── Setup ──────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  MiniR4.begin();
  MiniR4.OLED.begin();

  initSensors();

  if (!BLE.begin()) {
    Serial.println("BLE init failed");
    MiniR4.LED.setColor(255, 0, 0, 100);
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

  MiniR4.LED.setColor(0, 0, 200, 100);
  Serial.println("HERI-GUARD BLE ready");
}

void initSensors() {
  MiniR4.I2C2.MXLineTracer.begin();
  MiniR4.I2C1.MXLaserV2.begin();
  MiniR4.Motion.begin();
  MiniR4.M3.setPPR_RPM(390, 180);
  MiniR4.M4.setPPR_RPM(390, 180);
  MiniR4.RC1.begin();
  MiniR4.RC2.begin();
  MiniR4.RC3.begin();
  MiniR4.RC4.begin();
  Serial.println("Sensors initialized");
}

// ── Loop ───────────────────────────────────────────────
void loop() {
  BLE.poll();

  // Priority 1: Stop command already handled via BLE event
  // Priority 2: Obstacle check
  checkObstacle();

  // Priority 3: IMU tilt check
  float ay = MiniR4.Motion.getAccelY();
  if (abs(ay) > 0.5 && robotState == PATROL_MOVE) {
    baseSpeed = 25;
  } else {
    baseSpeed = 40;
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
    case INSPECT_E:
      inspectRetract();
      break;
    default:
      break;
  }
}

void patrolMove() {
  float error = MiniR4.I2C2.MXLineTracer.getError();

  integral += error * 0.02;
  float derivative = error - lastError;
  float correction = kp * error + ki * integral + kd * derivative;

  int leftSpeed  = constrain(baseSpeed + (int)correction, -100, 100);
  int rightSpeed = constrain(baseSpeed - (int)correction, -100, 100);

  MiniR4.M3.setSpeed(leftSpeed);
  MiniR4.M4.setSpeed(rightSpeed);
  lastError = error;

  float degLeft = MiniR4.M3.getDegrees();
  float degRight = MiniR4.M4.getDegrees();
  float avgDeg = (degLeft + degRight) / 2.0f;
  float meters = avgDeg / 360.0f * WHEEL_CIRCUMFERENCE;

  if (meters >= DISTANCE_TARGET) {
    MiniR4.M3.setSpeed(0);
    MiniR4.M4.setSpeed(0);
    MiniR4.M3.resetCounter();
    MiniR4.M4.resetCounter();
    integral = 0;
    lastError = 0;
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

  // Take a picture (camera placeholder)
  captureAndSendImage();

  // Create virtual map marker
  bool hasIssue = random(0, 10) > 6;
  uint8_t flags = 0;
  uint8_t confidence = 0;
  if (hasIssue) {
    int issueType = random(0, 6);
    flags = 1 << issueType;
    confidence = random(50, 96);
    Serial.print("Issue detected, flags=");
    Serial.println(flags);
  }

  sendMapMarker(markerDistanceCount, flags, confidence);
  markerDistanceCount++;

  // Transition to retract
  robotState = INSPECT_E;
}

void inspectRetract() {
  // Reset camera position (servo placeholder)
  MiniR4.RC1.setAngle(90);
  MiniR4.RC2.setAngle(0);
  MiniR4.RC3.setAngle(90);
  MiniR4.RC4.setAngle(90);

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
  uint16_t distance = MiniR4.I2C1.MXLaserV2.getDistance();
  if (distance < OBSTACLE_THRESHOLD_MM && distance > 20) {
    MiniR4.M3.setSpeed(0);
    MiniR4.M4.setSpeed(0);
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
  MiniR4.LED.setColor(0, 200, 0, 100);
  Serial.println("BLE connected");
  MiniR4.Buzzer.Tone(880, 100);
  delay(100);
  MiniR4.Buzzer.Tone(1100, 150);
}

void onBLEDisconnected(BLEDevice central) {
  bleConnected = false;
  MiniR4.LED.setColor(0, 0, 200, 100);
  Serial.println("BLE disconnected");
  if (patrolActive) {
    MiniR4.M3.setSpeed(0);
    MiniR4.M4.setSpeed(0);
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
  MiniR4.D1.MXDHT.readTemperatureHumidity(temperature, humidity);
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

// ── Camera ─────────────────────────────────────────────
void captureAndSendImage() {
  if (!bleConnected) return;

  MiniR4.Vision.Begin();
  unsigned int visionData[16];
  int result = MiniR4.Vision.SmartCamReader(visionData, 500);

  if (result > 0) {
    uint8_t d[2] = {
      (uint8_t)(visionData[0] & 0xFF),
      (uint8_t)(visionData[1] & 0xFF)
    };
    charDetection.writeValue(d, 2);

    Serial.print("Detection: label=");
    Serial.print(visionData[0]);
    Serial.print(" confidence=");
    Serial.println(visionData[1]);
  }
}

// ── Command Handler ────────────────────────────────────
void handleCommand(uint8_t* buf, int len) {
  char cmd = (char)buf[0];

  // Speed command
  if (cmd == 'S' && len >= 3) {
    int8_t speedLeft = (int8_t)buf[1];
    int8_t speedRight = (int8_t)buf[2];
    baseSpeed = max(abs(speedLeft), abs(speedRight));
    Serial.print("Cmd: SPEED set to ");
    Serial.println(baseSpeed);
    return;
  }

  switch (cmd) {
    case 'C':
      Serial.println("Cmd: CAPTURE");
      captureAndSendImage();
      MiniR4.LED.setColor(200, 200, 0, 100);
      delay(200);
      MiniR4.LED.setColor(0, 200, 0, 100);
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
        integral = 0;
        lastError = 0;
        if (bleConnected) sendStatus();
      }
      break;

    case 'X':
      Serial.println("Cmd: STOP");
      MiniR4.M3.setSpeed(0);
      MiniR4.M4.setSpeed(0);
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
