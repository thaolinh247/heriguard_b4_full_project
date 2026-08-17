#include "utils.h"
#include <Arduino.h>  // constrain(), millis()

namespace RobotUtils {

// ─── CLAMP ───────────────────────────────────────────────────────────────────

int clampInt(int v, int lo, int hi) {
  return constrain(v, lo, hi);
}

float clampFloat(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}


// ─── MOTOR ───────────────────────────────────────────────────────────────────

int limitStep(int target, int current, int maxStep) {
  const int delta = clampInt(target - current, -maxStep, maxStep);
  return current + delta;
}


// ─── SIGNAL ──────────────────────────────────────────────────────────────────

float deadband(float value, float threshold) {
  if (threshold < 0.0f) threshold = -threshold;
  if (value > -threshold && value < threshold) return 0.0f;
  return value;
}

float exponentialFilter(float filtered, float newSample, float alpha) {
  return filtered + alpha * (newSample - filtered);
}


// ─── TIME ─────────────────────────────────────────────────────────────────────

float computeDtSec(uint32_t nowMs, uint32_t lastMs, uint32_t fallbackLoopMs) {
  float dt = static_cast<float>(nowMs - lastMs) / 1000.0f;
  if (dt <= 0.0f) {
    dt = static_cast<float>(fallbackLoopMs) / 1000.0f;
  }
  return dt;
}

bool isElapsed(uint32_t nowMs, uint32_t startMs, uint32_t durationMs) {
  return (nowMs - startMs) >= durationMs;
}


// ─── MATH ─────────────────────────────────────────────────────────────────────

float mapFloat(float value, float inLo, float inHi, float outLo, float outHi) {
  if (inHi == inLo) return outLo;
  return outLo + (value - inLo) * (outHi - outLo) / (inHi - inLo);
}

float lerp(float a, float b, float t) {
  return a + clampFloat(t, 0.0f, 1.0f) * (b - a);
}


// ─── SENSOR ARRAY ─────────────────────────────────────────────────────────────

uint8_t countAboveThreshold(const uint8_t values[], uint8_t count, uint8_t threshold) {
  uint8_t n = 0;
  for (uint8_t i = 0; i < count; ++i) {
    if (values[i] > threshold) ++n;
  }
  return n;
}

float weightedCentroid(const uint8_t values[], uint8_t startSensorId,
                       uint8_t endSensorId, uint8_t activeThreshold) {
  float weightedSum = 0.0f;
  float totalWeight = 0.0f;

  for (uint8_t id = startSensorId; id <= endSensorId; ++id) {
    const float w = static_cast<float>(values[id - 1]);
    if (w > activeThreshold) {
      weightedSum += w * id;
      totalWeight += w;
    }
  }

  if (totalWeight <= 0.0f) return 0.0f;
  return weightedSum / totalWeight;
}


// ─── SERVO STEP CONTROL ───────────────────────────────────────────────────────

void servoStepInit(ServoStepState& s, uint16_t homeAngle,
                   uint8_t stepDeg, uint32_t stepIntervalMs) {
  s.currentAngle   = homeAngle;
  s.targetAngle    = homeAngle;
  s.lastSafeAngle  = homeAngle;
  s.stepStartMs    = 0;
  s.totalStartMs   = 0;
  s.stepIntervalMs = stepIntervalMs > 0 ? stepIntervalMs : 20;
  s.totalTimeoutMs = 0;
  s.stepDeg        = stepDeg > 0 ? stepDeg : 2;
  s.isMoving       = false;
  s.isStuck        = false;
}

void servoStepBegin(ServoStepState& s, uint16_t targetAngle,
                    uint32_t totalTimeoutMs, uint32_t nowMs) {
  s.targetAngle    = targetAngle;
  s.lastSafeAngle  = s.currentAngle;  // bước đầu tiên fallback về vị trí hiện tại
  s.totalStartMs   = nowMs;
  s.stepStartMs    = nowMs;
  s.totalTimeoutMs = totalTimeoutMs;
  s.isMoving       = true;
  s.isStuck        = false;
}

bool servoStepBeginSafe(ServoStepState& s, uint16_t targetAngle,
                        uint32_t totalTimeoutMs, uint32_t nowMs) {
  if (s.isStuck) return false;
  servoStepBegin(s, targetAngle, totalTimeoutMs, nowMs);
  return true;
}

ServoStepStatus servoStepTick(ServoStepState& s, uint32_t nowMs, uint16_t& outAngle) {
  if (!s.isMoving) {
    outAngle = s.currentAngle;
    return ServoStepStatus::Idle;
  }

  // ── Kiểm tra timeout toàn bộ motion trước ─────────────────────────────────
  if ((nowMs - s.totalStartMs) >= s.totalTimeoutMs) {
    s.isMoving     = false;
    s.isStuck      = true;
    s.currentAngle = s.lastSafeAngle;  // backoff về bước cuối cùng an toàn
    outAngle       = s.lastSafeAngle;
    return ServoStepStatus::StuckBackedOff;
  }

  // ── Chờ stepInterval trước khi tiến bước tiếp ─────────────────────────────
  if ((nowMs - s.stepStartMs) < s.stepIntervalMs) {
    outAngle = s.currentAngle;
    return ServoStepStatus::Stepping;
  }

  // ── Hết step interval: bước hiện tại coi là "safe", tiến tiếp ─────────────
  s.lastSafeAngle = s.currentAngle;

  if (s.currentAngle == s.targetAngle) {
    s.isMoving = false;
    outAngle   = s.currentAngle;
    return ServoStepStatus::Reached;
  }

  // Tiến stepDeg về phía target (không vượt qua target)
  if (s.targetAngle > s.currentAngle) {
    const uint16_t remaining = s.targetAngle - s.currentAngle;
    s.currentAngle += (s.stepDeg < remaining ? s.stepDeg : remaining);
  } else {
    const uint16_t remaining = s.currentAngle - s.targetAngle;
    s.currentAngle -= (s.stepDeg < remaining ? s.stepDeg : remaining);
  }

  s.stepStartMs = nowMs;
  outAngle      = s.currentAngle;
  return ServoStepStatus::Stepping;
}

void servoStepReset(ServoStepState& s) {
  s.isMoving = false;
  s.isStuck  = false;
}

// ─── TURN BY ANGLE ────────────────────────────────────────────────────────────

void turnByAngle(const TurnConfig& cfg, const TurnHardware& hw) {
  hw.resetYaw();

  const uint32_t startMs = millis();

  while (true) {
    if (millis() - startMs >= cfg.timeoutMs) {
      break;  // timeout — dừng an toàn
    }

    const float turned    = fabsf(hw.readYawDeg());
    const float remaining = cfg.targetDeg - turned;

    if (remaining <= cfg.toleranceDeg) {
      break;  // đã đến góc mục tiêu
    }

    const int spd = (remaining <= cfg.decelZoneDeg) ? cfg.slowSpeed : cfg.fullSpeed;

    if (cfg.direction == TurnDirection::Right) {
      hw.setMotors( spd, -spd);  // bánh trái tiến, bánh phải lùi → xoay phải
    } else {
      hw.setMotors(-spd,  spd);  // bánh trái lùi, bánh phải tiến → xoay trái
    }
  }

  hw.setMotors(0, 0);  // dừng động cơ sau khi xoay xong
}

} // namespace RobotUtils