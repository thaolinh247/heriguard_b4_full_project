import { useState } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { useSettingsStore } from "@/store/settingsStore";
import { useDeviceStore } from "@/store/deviceStore";
import { startMockBle, stopMockBle } from "@/lib/mockBle";
import { Colors, Font } from "@/constants/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const mockMode = useSettingsStore((s) => s.mockMode);
  const bleDeviceName = useSettingsStore((s) => s.bleDeviceName);
  const stationId = useSettingsStore((s) => s.stationId);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const geminiMockMode = useSettingsStore((s) => s.geminiMockMode);
  const setMockMode = useSettingsStore((s) => s.setMockMode);
  const setGeminiApiKey = useSettingsStore((s) => s.setGeminiApiKey);
  const setGeminiMockMode = useSettingsStore((s) => s.setGeminiMockMode);
  const connectionStatus = useDeviceStore((s) => s.connectionStatus);

  const [editingKey, setEditingKey] = useState(false);

  const handleToggleMock = (enabled: boolean) => {
    setMockMode(enabled);
    if (enabled) {
      startMockBle();
    } else {
      stopMockBle();
    }
  };

  const handleScan = () => {
    router.push("/device/scan" as any);
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    idle: { text: "Chưa kết nối", color: Colors.inkSoft },
    scanning: { text: "Đang quét...", color: Colors.gold },
    connecting: { text: "Đang kết nối...", color: Colors.gold },
    connected: { text: "Đã kết nối", color: Colors.jade },
    disconnected: { text: "Mất kết nối", color: Colors.lacquer },
  };

  const status = statusLabel[connectionStatus] ?? statusLabel.idle;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cài đặt</Text>
      <Text style={styles.subtitle}>Cấu hình kết nối và AI</Text>

      {/* Connection */}
      <PlaqueCard label="Kết nối BLE" style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Trạng thái</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.fieldValue, { color: status.color }]}>
              {status.text}
            </Text>
          </View>
        </View>
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
        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
          <Text style={styles.scanButtonText}>Quét thiết bị</Text>
        </TouchableOpacity>
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
            onValueChange={handleToggleMock}
            trackColor={{ false: Colors.line, true: Colors.jadeLight }}
            thumbColor={mockMode ? Colors.jade : Colors.inkSoft}
          />
        </View>
      </PlaqueCard>

      {/* Gemini AI */}
      <PlaqueCard label="Gemini AI" style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>API Key</Text>
          {editingKey ? (
            <TextInput
              style={styles.input}
              value={geminiApiKey}
              onChangeText={setGeminiApiKey}
              placeholder="Nhập Gemini API Key..."
              placeholderTextColor={Colors.inkSoft}
              secureTextEntry
              autoFocus
              onBlur={() => setEditingKey(false)}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingKey(true)}>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {geminiApiKey
                  ? `••••${geminiApiKey.slice(-4)}`
                  : "Chưa thiết lập — chạm để nhập"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.fieldLabel}>Dùng AI mô phỏng</Text>
            <Text style={styles.fieldHint}>
              {geminiMockMode
                ? "Phân tích bằng dữ liệu mẫu"
                : "Gọi Gemini API thật (cần key)"}
            </Text>
          </View>
          <Switch
            value={geminiMockMode}
            onValueChange={setGeminiMockMode}
            trackColor={{ false: Colors.line, true: Colors.jadeLight }}
            thumbColor={geminiMockMode ? Colors.jade : Colors.inkSoft}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  scanButton: {
    backgroundColor: Colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  scanButtonText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.cream,
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.ink,
    backgroundColor: Colors.cream,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
