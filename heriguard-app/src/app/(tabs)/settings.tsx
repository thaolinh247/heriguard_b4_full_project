import { View, Text, Switch, ScrollView, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Font } from "@/constants/theme";

export default function SettingsScreen() {
  const mockMode = useSettingsStore((s) => s.mockMode);
  const bleDeviceName = useSettingsStore((s) => s.bleDeviceName);
  const stationId = useSettingsStore((s) => s.stationId);
  const setMockMode = useSettingsStore((s) => s.setMockMode);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cài đặt</Text>
      <Text style={styles.subtitle}>Cấu hình kết nối và hiển thị</Text>

      {/* Connection */}
      <PlaqueCard label="Kết nối BLE" style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tên thiết bị</Text>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {bleDeviceName}
          </Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Mã trạm</Text>
          <Text style={styles.fieldValue}>{stationId}</Text>
        </View>
      </PlaqueCard>

      {/* Mock mode */}
      <PlaqueCard label="Chế độ mô phỏng" style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.fieldLabel}>Bật mô phỏng dữ liệu</Text>
            <Text style={styles.fieldHint}>
              {mockMode
                ? "Đang dùng dữ liệu giả lập"
                : "Sẽ kết nối BLE thật"}
            </Text>
          </View>
          <Switch
            value={mockMode}
            onValueChange={setMockMode}
            trackColor={{ false: Colors.line, true: Colors.jadeLight }}
            thumbColor={mockMode ? Colors.jade : Colors.inkSoft}
          />
        </View>
      </PlaqueCard>

      {/* About */}
      <PlaqueCard label="Thông tin" style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Ứng dụng</Text>
          <Text style={styles.fieldValue}>HERI-GUARD v1.0</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Đội thi</Text>
          <Text style={styles.fieldValue}>NovaCulture</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Cuộc thi</Text>
          <Text style={styles.fieldValue}>WRO 2026 — Future Engineers</Text>
        </View>
      </PlaqueCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>HERI-GUARD — NovaCulture Team</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    padding: 16,
    paddingTop: 52,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    marginBottom: 16,
  },
  card: {
    padding: 14,
    marginBottom: 14,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: Font.regular,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginBottom: 3,
  },
  fieldValue: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.ink,
  },
  fieldHint: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchText: {
    flex: 1,
    marginRight: 12,
  },
  footer: {
    marginTop: 8,
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 0.3,
  },
});
