#include "MatrixMiniR4.h"
#include <ArduinoBLE.h>

// ── BLE UUIDs (match app's ble.ts) ─────────────────────
#define SERVICE_UUID        "12345678-1234-5678-1234-56789abcdef0"
#define CHAR_CAMERA_UUID    "12345678-1234-5678-1234-56789abcdef1"
#define CHAR_DETECTION_UUID "12345678-1234-5678-1234-56789abcdef2"
#define CHAR_SENSOR_UUID    "12345678-1234-5678-1234-56789abcdef3"
#define CHAR_COMMAND_UUID   "12345678-1234-5678-1234-56789abcdef4"
#define CHAR_STATUS_UUID    "12345678-1234-5678-1234-56789abcdef5"

// ── BLE Objects ────────────────────────────────────────
BLEService heriguardService(SERVICE_UUID);

BLECharacteristic charCamera(CHAR_CAMERA_UUID,    BLERead | BLENotify, 512);
BLECharacteristic charDetection(CHAR_DETECTION_UUID, BLERead | BLENotify, 64);
BLECharacteristic charSensor(CHAR_SENSOR_UUID,    BLERead | BLENotify, 4);
BLECharacteristic charCommand(CHAR_COMMAND_UUID,   BLEWrite, 20);
BLECharacteristic charStatus(CHAR_STATUS_UUID,     BLERead | BLENotify, 4);

// ── State ──────────────────────────────────────────────
bool bleConnected = false;
float temperature = 0;
int   humidity    = 0;
uint8_t battery   = 0;

unsigned long lastSensorRead = 0;
unsigned long lastNotify     = 0;
const unsigned long SENSOR_INTERVAL = 2000;

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

// ── Setup ──────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  MiniR4.begin();
  MiniR4.OLED.begin();

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

  BLE.addService(heriguardService);

  charCommand.setEventHandler(BLEWritten, onCommandWritten);
  BLE.setEventHandler(BLEConnected,    onBLEConnected);
  BLE.setEventHandler(BLEDisconnected, onBLEDisconnected);

  BLE.advertise();

  MiniR4.LED.setColor(0, 0, 200, 100);
  Serial.println("HERI-GUARD BLE ready");
}

// ── Loop ───────────────────────────────────────────────
void loop() {
  BLE.poll();

  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    readSensor();
    lastSensorRead = now;
  }

  if (bleConnected && now - lastNotify >= SENSOR_INTERVAL) {
    sendSensor();
    sendStatus();
    updateDisplay();
    lastNotify = now;
  }
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
  // Pack: temp (int16 hundredths) + humidity (uint16 hundredths)
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
  uint8_t d[2] = { battery, 0 };
  charStatus.writeValue(d, 2);
}

// ── Camera ─────────────────────────────────────────────
void captureAndSendImage() {
  if (!bleConnected) return;

  // Read JPEG from M-Vision Cam via Serial1 (UART)
  // Camera must be configured to send JPEG data
  // For now: use a placeholder that sends a simple notification

  MiniR4.Vision.Begin();
  unsigned int visionData[16];
  int result = MiniR4.Vision.SmartCamReader(visionData, 500);

  if (result > 0) {
    // Send detection result: [label, confidence]
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
      break;
    case 'X':
      Serial.println("Cmd: STOP");
      MiniR4.M3.setSpeed(0);
      MiniR4.M4.setSpeed(0);
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
  MiniR4.OLED.print("BLE: ");
  MiniR4.OLED.println(bleConnected ? "ON" : "OFF");
  MiniR4.OLED.setCursor(0, 32);
  MiniR4.OLED.print("T: "); MiniR4.OLED.print(temperature, 1); MiniR4.OLED.println(" C");
  MiniR4.OLED.setCursor(0, 48);
  MiniR4.OLED.print("H: "); MiniR4.OLED.print(humidity, 1); MiniR4.OLED.println(" %");
  MiniR4.OLED.display();
}
