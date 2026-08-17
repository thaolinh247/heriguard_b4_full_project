import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { sendCommand } from "@/lib/ble";
import { mockSendCommand } from "@/lib/mockBle";
import { useDeviceStore } from "@/store/deviceStore";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Font } from "@/constants/theme";

export function ControlPanel() {
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);
  const patrolActive = useDeviceStore((s) => s.patrolActive);
  const mockMode = useSettingsStore((s) => s.mockMode);

  const isConnected = connectionStatus === "connected";
  const canControl = isConnected || mockMode;
  const canStart = canControl && !patrolActive;

  const handleCommand = async (cmd: string) => {
    if (!canControl) return;
    // Ưu tiên BLE thật khi đã kết nối thiết bị; mock chỉ dùng khi chưa kết nối
    const ok = mockMode && !isConnected ? mockSendCommand(cmd) : await sendCommand(cmd);
    if (!ok) {
      Alert.alert(
        "Không gửi được lệnh",
        "Kiểm tra kết nối BLE với robot (Cài đặt → Quét thiết bị) rồi thử lại."
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
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
          style={[styles.btn, styles.btnCapture, !canControl && styles.btnDisabled]}
          onPress={() => handleCommand("N")}
          disabled={!canControl}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, styles.btnTextCapture]}>Chụp + Nhận diện</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btn, styles.btnStop, !canControl && styles.btnDisabled]}
        onPress={() => handleCommand("X")}
        disabled={!canControl}
        activeOpacity={0.7}
      >
        <Text style={styles.btnTextStop}>DỪNG KHẨN CẤP</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  topRow: {
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
    flex: 1,
    backgroundColor: Colors.gold,
  },
  btnStop: {
    width: "100%",
    backgroundColor: Colors.lacquer,
    paddingVertical: 14,
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
    fontSize: 14,
    letterSpacing: 1,
    color: Colors.paper,
  },
});
