import { useEffect } from "react";
import { ScrollView, Text, View, Image, StyleSheet } from "react-native";
import { StatusDot } from "@/components/dashboard/StatusDot";
import { CameraCard } from "@/components/dashboard/CameraCard";
import { MiniChart } from "@/components/dashboard/MiniChart";
import { TrendSummary } from "@/components/dashboard/TrendSummary";
import { startMockBle, stopMockBle } from "@/lib/mockBle";
import { useDashboardStore } from "@/store/dashboardStore";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Font } from "@/constants/theme";

const logo = require("../../../assets/images/novaculture.jpg");

export default function HomeScreen() {
  const mockMode = useSettingsStore((s) => s.mockMode);
  const bleConnected = useDashboardStore((s) => s.bleConnected);
  const lastUpdate = useDashboardStore((s) => s.lastUpdate);
  const stationId = useSettingsStore((s) => s.stationId);

  useEffect(() => {
    if (mockMode) startMockBle();
    return () => stopMockBle();
  }, [mockMode]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={logo} style={styles.logo} resizeMode="cover" />
          <StatusDot online={bleConnected} />
          <View style={styles.brandText}>
            <Text style={styles.title}>HERI-GUARD</Text>
            <Text style={styles.subtitle}>Hệ thống giám sát môi trường bảo tồn di tích</Text>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaLine}>
            Trạm <Text style={styles.metaBold}>{stationId}</Text>
          </Text>
          <Text style={styles.metaLine}>
            {lastUpdate ?? "—"}
          </Text>
        </View>
      </View>

      {/* Connection bar */}
      <View style={styles.connBar}>
        <View style={[styles.connDot, { backgroundColor: bleConnected ? Colors.jade : Colors.lacquer }]} />
        <Text style={styles.connText}>
          {bleConnected ? "Đã kết nối BLE" : "Đang kết nối…"}
        </Text>
      </View>

      {/* Cards */}
      <View style={styles.cards}>
        <CameraCard />
        <MiniChart />
        <TrendSummary />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          HERI-GUARD — Dữ liệu thời gian thực qua BLE
        </Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 4,
  },
  brandText: {
    flex: 1,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  meta: {
    alignItems: "flex-end",
  },
  metaLine: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
  },
  metaBold: {
    fontFamily: Font.bold,
    color: Colors.ink,
  },
  connBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    letterSpacing: 0.3,
  },
  cards: {
    gap: 14,
  },
  footer: {
    marginTop: 24,
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
