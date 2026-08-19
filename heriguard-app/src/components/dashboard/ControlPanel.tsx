import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { sendCommand } from "@/lib/ble";
import { useDeviceStore } from "@/store/deviceStore";
import { Colors, Font } from "@/constants/theme";

const SERVO_STEP = 15;

function signedByte(n: number): number {
  return n < 0 ? n + 256 : n;
}

export function ControlPanel() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const patrolActive = useDeviceStore((s) => s.patrolActive);

  const isConnected = connectionStatus === "connected";
  const canControl = isConnected;
  const canStart = canControl && !patrolActive;

  const handleCommand = async (cmd: string) => {
    if (!canControl) return;
    const ok = await sendCommand(cmd);
    if (!ok) {
      Alert.alert(
        "Không gửi được lệnh",
        "Kiểm tra kết nối BLE với robot (Cài đặt → Quét thiết bị) rồi thử lại."
      );
    }
  };

  const handleServo = async (cmd: string, step: number) => {
    if (!canControl) return;
    const ok = await sendCommand(cmd, [signedByte(step)]);
    if (!ok) {
      Alert.alert("Không gửi được lệnh servo", "Kiểm tra kết nối BLE.");
    }
  };

  return (
    <View style={styles.container}>
      {/* 3 nút điều khiển chính */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnStart, !canStart && styles.btnDisabled]}
          onPress={() => handleCommand("P")}
          disabled={!canStart}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, styles.btnTextStart]}>
            {patrolActive ? "Đang tuần tra…" : "Bắt đầu tuần tra"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnStop, !canControl && styles.btnDisabled]}
          onPress={() => handleCommand("X")}
          disabled={!canControl}
          activeOpacity={0.7}
        >
          <Text style={styles.btnTextStop}>Dừng</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.btnCapture, !canControl && styles.btnDisabled]}
        onPress={() => handleCommand("N")}
        disabled={!canControl}
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, styles.btnTextCapture]}>Chụp + Nhận diện</Text>
      </TouchableOpacity>

      {/* ── Servo D-pad ── */}
      <View style={styles.servoSection}>
        <Text style={styles.servoTitle}>Điều khiển camera</Text>

        {/* D-pad: Pan (RC4) ← →  |  Tilt (RC2) ↑ ↓ */}
        <View style={styles.dpadContainer}>
          {/* Tilt column (↑ ↓) */}
          <View style={styles.dpadCol}>
            <TouchableOpacity
              style={[styles.dpadBtn, !canControl && styles.btnDisabled]}
              onPress={() => handleServo("T", SERVO_STEP)}
              disabled={!canControl}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadArrow}>▲</Text>
              <Text style={styles.dpadLabel}>Nâng</Text>
            </TouchableOpacity>

            <View style={styles.dpadCenter}>
              <Text style={styles.dpadCenterText}>📷</Text>
            </View>

            <TouchableOpacity
              style={[styles.dpadBtn, !canControl && styles.btnDisabled]}
              onPress={() => handleServo("T", -SERVO_STEP)}
              disabled={!canControl}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadArrow}>▼</Text>
              <Text style={styles.dpadLabel}>Hạ</Text>
            </TouchableOpacity>
          </View>

          {/* Pan row (← →) */}
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={[styles.dpadBtn, !canControl && styles.btnDisabled]}
              onPress={() => handleServo("F", -SERVO_STEP)}
              disabled={!canControl}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadArrow}>◀</Text>
              <Text style={styles.dpadLabel}>Trái</Text>
            </TouchableOpacity>

            <View style={styles.dpadCenter}>
              <Text style={styles.dpadCenterText}>RC4</Text>
            </View>

            <TouchableOpacity
              style={[styles.dpadBtn, !canControl && styles.btnDisabled]}
              onPress={() => handleServo("F", SERVO_STEP)}
              disabled={!canControl}
              activeOpacity={0.6}
            >
              <Text style={styles.dpadArrow}>▶</Text>
              <Text style={styles.dpadLabel}>Phải</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Extra servo buttons: Fold (RC3) + Twist (RC1) */}
        <View style={styles.extraRow}>
          <View style={styles.extraGroup}>
            <Text style={styles.extraGroupLabel}>Gập cam (RC3)</Text>
            <View style={styles.extraButtons}>
              <TouchableOpacity
                style={[styles.extraBtn, !canControl && styles.btnDisabled]}
                onPress={() => handleServo("G", -SERVO_STEP)}
                disabled={!canControl}
                activeOpacity={0.6}
              >
                <Text style={styles.extraBtnText}>Mở</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.extraBtn, !canControl && styles.btnDisabled]}
                onPress={() => handleServo("G", SERVO_STEP)}
                disabled={!canControl}
                activeOpacity={0.6}
              >
                <Text style={styles.extraBtnText}>Gập</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.extraGroup}>
            <Text style={styles.extraGroupLabel}>Xoay trục (RC1)</Text>
            <View style={styles.extraButtons}>
              <TouchableOpacity
                style={[styles.extraBtn, !canControl && styles.btnDisabled]}
                onPress={() => handleServo("W", -SERVO_STEP)}
                disabled={!canControl}
                activeOpacity={0.6}
              >
                <Text style={styles.extraBtnText}>◀ Trái</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.extraBtn, !canControl && styles.btnDisabled]}
                onPress={() => handleServo("W", SERVO_STEP)}
                disabled={!canControl}
                activeOpacity={0.6}
              >
                <Text style={styles.extraBtnText}>Phải ▶</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  controlRow: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  btnStart: {
    flex: 1,
    backgroundColor: Colors.jade,
  },
  btnCapture: {
    width: "100%",
    backgroundColor: Colors.gold,
  },
  btnStop: {
    flex: 1,
    backgroundColor: Colors.lacquer,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontFamily: Font.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  btnTextStart: {
    color: Colors.paper,
  },
  btnTextCapture: {
    color: Colors.paper,
  },
  btnTextStop: {
    fontFamily: Font.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.paper,
  },

  // ── Servo D-pad ──
  servoSection: {
    marginTop: 8,
    backgroundColor: Colors.paper,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 12,
  },
  servoTitle: {
    fontFamily: Font.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: Colors.ink,
    marginBottom: 10,
    textAlign: "center",
  },
  dpadContainer: {
    alignItems: "center",
    gap: 4,
  },
  dpadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dpadCol: {
    alignItems: "center",
    gap: 4,
  },
  dpadBtn: {
    width: 60,
    height: 52,
    borderRadius: 8,
    backgroundColor: Colors.jadeLight,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dpadArrow: {
    fontSize: 18,
    color: Colors.jade,
  },
  dpadLabel: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  dpadCenter: {
    width: 60,
    height: 52,
    borderRadius: 8,
    backgroundColor: Colors.cream,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dpadCenterText: {
    fontSize: 18,
  },

  // Extra servo buttons
  extraRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  extraGroup: {
    flex: 1,
    alignItems: "center",
  },
  extraGroupLabel: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.inkSoft,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  extraButtons: {
    flexDirection: "row",
    gap: 4,
  },
  extraBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  extraBtnText: {
    fontFamily: Font.bold,
    fontSize: 11,
    color: Colors.ink,
  },
});
