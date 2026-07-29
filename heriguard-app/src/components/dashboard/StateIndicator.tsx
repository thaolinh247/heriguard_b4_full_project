import { View, Text, StyleSheet } from "react-native";
import { useDeviceStore } from "@/store/deviceStore";
import { Colors, Font, StateColors } from "@/constants/theme";
import { ROBOT_STATE_LABELS } from "@/types/robot";

export function StateIndicator() {
  const robotState = useDeviceStore((s) => s.robotState);
  const patrolActive = useDeviceStore((s) => s.patrolActive);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);

  const color = StateColors[robotState] ?? Colors.inkSoft;
  const label = ROBOT_STATE_LABELS[robotState] ?? "Không xác định";

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {patrolActive && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ĐANG TUẦN TRA</Text>
        </View>
      )}
      {connectionStatus !== "connected" && (
        <Text style={styles.disconnected}>
          {connectionStatus === "scanning" ? "Đang quét…" : "Chưa kết nối"}
        </Text>
      )}
    </View>
  );
}

const DOT_SIZE = 8;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  label: {
    fontFamily: Font.regular,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  badge: {
    backgroundColor: Colors.jade,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.paper,
    letterSpacing: 0.5,
  },
  disconnected: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    fontStyle: "italic",
  },
});
