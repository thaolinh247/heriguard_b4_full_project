#pragma once
#include <stdint.h>

/**
 * RobotUtils — Thư viện hàm tiện ích tái sử dụng cho robot WRO.
 *
 * Tất cả hàm trong namespace này KHÔNG phụ thuộc vào bất kỳ
 * thư viện hardware cụ thể nào (MatrixMiniR4, WiFi...).
 * Có thể dùng lại trong mọi chương trình Arduino/PlatformIO.
 * (Tham khảo: WRO 2026 B3)
 */
namespace RobotUtils {

// ─── CLAMP / GIỚI HẠN GIÁ TRỊ ───────────────────────────────────────────────

/// Giới hạn giá trị nguyên trong khoảng [lo, hi].
int   clampInt(int v, int lo, int hi);

/// Giới hạn giá trị thực trong khoảng [lo, hi].
float clampFloat(float v, float lo, float hi);


// ─── MOTOR / ĐỘNG CƠ ─────────────────────────────────────────────────────────

/**
 * Giới hạn tốc độ thay đổi của động cơ để tránh giật cục.
 * @param target   Giá trị mục tiêu
 * @param current  Giá trị hiện tại
 * @param maxStep  Bước thay đổi tối đa mỗi vòng lặp
 * @return         Giá trị mới, không vượt quá maxStep so với current
 */
int limitStep(int target, int current, int maxStep);


// ─── TÍN HIỆU / SIGNAL ───────────────────────────────────────────────────────

/**
 * Đặt về 0 nếu giá trị nhỏ hơn ngưỡng (deadband).
 * Dùng để lọc nhiễu nhỏ của cảm biến.
 */
float deadband(float value, float threshold);

/**
 * Bộ lọc trung bình hàm mũ (Exponential Moving Average).
 * alpha gần 1 → phản ứng nhanh; alpha gần 0 → lọc mạnh.
 * Công thức: filtered = filtered + alpha * (newSample - filtered)
 */
float exponentialFilter(float filtered, float newSample, float alpha);


// ─── THỜI GIAN / TIME ────────────────────────────────────────────────────────

/**
 * Tính dt (giây) giữa 2 mốc thời gian ms.
 * Nếu dt <= 0 (overflow hoặc lần đầu chạy), trả về fallbackLoopMs / 1000.
 */
float computeDtSec(uint32_t nowMs, uint32_t lastMs, uint32_t fallbackLoopMs);

/**
 * Kiểm tra xem đã trôi qua durationMs kể từ startMs chưa.
 */
bool isElapsed(uint32_t nowMs, uint32_t startMs, uint32_t durationMs);


// ─── TOÁN HỌC / MATH ─────────────────────────────────────────────────────────

/**
 * Ánh xạ tuyến tính từ khoảng [inLo, inHi] sang [outLo, outHi].
 * Tương đương Arduino map() nhưng cho kiểu float.
 */
float mapFloat(float value, float inLo, float inHi, float outLo, float outHi);

/**
 * Nội suy tuyến tính giữa a và b theo tham số t ∈ [0, 1].
 */
float lerp(float a, float b, float t);


// ─── MẢNG CẢM BIẾN / SENSOR ARRAY ───────────────────────────────────────────

/**
 * Đếm số phần tử trong mảng raw values[0..count-1] vượt ngưỡng threshold.
 * Dùng để đếm số cảm biến đang nhận tín hiệu line.
 */
uint8_t countAboveThreshold(const uint8_t values[], uint8_t count, uint8_t threshold);

/**
 * Tính vị trí trọng tâm có trọng số (weighted centroid) từ một dải cảm biến.
 * Trả về vị trí sensor (1-based) tính theo trọng số cường độ.
 * Trả về 0 nếu không có cảm biến nào vượt ngưỡng.
 *
 * @param values          Mảng giá trị raw 10 cảm biến (0-based index)
 * @param startSensorId   ID cảm biến đầu (1-based, ví dụ 1)
 * @param endSensorId     ID cảm biến cuối (1-based, ví dụ 6)
 * @param activeThreshold Ngưỡng tối thiểu để cảm biến được tính
 */
float weightedCentroid(const uint8_t values[], uint8_t startSensorId,
                       uint8_t endSensorId, uint8_t activeThreshold);


// ─── SERVO STEP CONTROL (non-blocking, bám từng bước + phát hiện kẹt) ────────

/**
 * Kết quả trả về từ servoStepTick() mỗi vòng loop.
 */
enum class ServoStepStatus : uint8_t {
  Idle,           ///< Servo đang không di chuyển
  Stepping,       ///< Đang tiến từng bước về phía target
  Reached,        ///< Đã đến target thành công
  StuckBackedOff, ///< Phát hiện kẹt — đã command quay về lastSafeAngle
};

/**
 * Toàn bộ trạng thái nội bộ của bộ điều khiển servo từng bước.
 * Không phụ thuộc hardware — thuần logic thời gian.
 */
struct ServoStepState {
  uint16_t currentAngle;    ///< Góc đang được command (tăng/giảm dần về target)
  uint16_t targetAngle;     ///< Góc đích cuối cùng
  uint16_t lastSafeAngle;   ///< Góc của bước trước — fallback khi kẹt
  uint32_t stepStartMs;     ///< millis() lúc bắt đầu bước hiện tại
  uint32_t totalStartMs;    ///< millis() lúc bắt đầu toàn bộ lệnh di chuyển
  uint32_t stepIntervalMs;  ///< Khoảng nghỉ tối thiểu giữa 2 bước (ms)
  uint32_t totalTimeoutMs;  ///< Timeout toàn bộ motion — vượt qua = phát hiện kẹt
  uint8_t  stepDeg;         ///< Số độ mỗi bước (khuyến nghị 2–3°)
  bool     isMoving;        ///< Đang trong quá trình di chuyển
  bool     isStuck;         ///< Đã phát hiện kẹt, chưa reset
};

/**
 * Khởi tạo state về vị trí home với các tham số bước mặc định.
 * Gọi một lần trong setup().
 *
 * @param homeAngle       Góc khởi đầu (và fallback cuối cùng nếu stuck)
 * @param stepDeg         Số độ mỗi bước (khuyến nghị 2–3)
 * @param stepIntervalMs  Thời gian chờ mỗi bước — đủ để servo travel vật lý
 */
void servoStepInit(ServoStepState& s, uint16_t homeAngle,
                   uint8_t stepDeg, uint32_t stepIntervalMs);

/**
 * Bắt đầu lệnh di chuyển đến targetAngle.
 * Nếu servo đang stuck, phải gọi servoStepReset() trước.
 * Không gọi setAngle trực tiếp — để servoStepTick() xử lý.
 *
 * @param totalTimeoutMs  Timeout toàn bộ motion (ms). Nếu quá thời gian này
 *                        mà chưa đến target → coi là kẹt, backoff.
 */
void servoStepBegin(ServoStepState& s, uint16_t targetAngle,
                    uint32_t totalTimeoutMs, uint32_t nowMs);

/**
 * Phiên bản an toàn của servoStepBegin: kiểm tra isStuck trước khi bắt đầu.
 * Nếu servo đang stuck, không làm gì và trả false.
 * Gọi servoStepReset() để giải phóng trạng thái stuck trước khi dùng lại.
 *
 * @return true nếu lệnh được chấp nhận; false nếu servo đang stuck
 */
bool servoStepBeginSafe(ServoStepState& s, uint16_t targetAngle,
                        uint32_t totalTimeoutMs, uint32_t nowMs);

/**
 * Tick non-blocking — gọi mỗi vòng loop().
 *
 * Logic nội bộ:
 *  1. Nếu chưa hết stepIntervalMs → giữ góc hiện tại, trả Stepping
 *  2. Hết step: đánh dấu currentAngle là safe, tiến thêm stepDeg về target
 *  3. Nếu totalTimeout vượt → backoff về lastSafeAngle, trả StuckBackedOff
 *  4. Nếu đến target → trả Reached
 *
 * @param outAngle  [out] Góc cần set cho servo hardware (có giá trị khi ≠ Idle)
 * @return          ServoStepStatus mô tả hành động cần thực hiện
 */
ServoStepStatus servoStepTick(ServoStepState& s, uint32_t nowMs, uint16_t& outAngle);

/**
 * Xóa trạng thái stuck/moving để cho phép lệnh mới.
 * Không thay đổi currentAngle.
 */
void servoStepReset(ServoStepState& s);

// ─── TURN BY ANGLE ────────────────────────────────────────────────────────────

enum class TurnDirection : uint8_t {
  Left  = 0,
  Right = 1,
};

/**
 * Cấu hình xoay robot tại chỗ — tất cả tham số có thể hiệu chỉnh tại runtime.
 */
struct TurnConfig {
  TurnDirection direction    = TurnDirection::Right;
  float         targetDeg    = 90.0f;   ///< Góc cần xoay (luôn dương, độ)
  int           fullSpeed    = 40;      ///< % tốc độ khi xa đích
  int           slowSpeed    = 18;      ///< % tốc độ khi vào vùng giảm tốc
  float         decelZoneDeg = 20.0f;   ///< Bắt đầu giảm tốc khi còn bao nhiêu °
  float         toleranceDeg = 3.0f;    ///< Sai số chấp nhận → dừng
  uint32_t      timeoutMs    = 3000;    ///< Timeout an toàn tối đa (ms)
};

/**
 * Callbacks cung cấp tầng phần cứng cho turnByAngle.
 * Tách biệt hoàn toàn logic xoay khỏi hardware cụ thể.
 */
struct TurnHardware {
  void  (*setMotors)(int leftSpeed, int rightSpeed); ///< Điều khiển 2 bánh
  float (*readYawDeg)();                              ///< Đọc góc Yaw (°, có dấu, tính từ lúc reset)
  void  (*resetYaw)();                               ///< Reset bộ tích phân Yaw về 0
};

/**
 * Xoay robot tại chỗ đến góc targetDeg. Blocking — trả về khi đến đích hoặc timeout.
 * Motor dừng hoàn toàn khi hàm trả về.
 *
 * Thuật toán:
 *  1. Gọi hw.resetYaw() để về 0
 *  2. Vòng lặp: đọc |Yaw|, tính remaining = targetDeg - |Yaw|
 *  3. Nếu remaining ≤ toleranceDeg → dừng (thành công)
 *  4. Nếu remaining ≤ decelZoneDeg → chạy slowSpeed; ngược lại fullSpeed
 *  5. Nếu vượt timeoutMs → dừng (fallback an toàn)
 *
 * @param cfg  Cấu hình xoay (hướng, góc, tốc độ, decel zone, tolerance, timeout)
 * @param hw   Callbacks hardware (setMotors + readYawDeg + resetYaw)
 */
void turnByAngle(const TurnConfig& cfg, const TurnHardware& hw);

} // namespace RobotUtils