import { View, Text, ScrollView, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors, Font } from "@/constants/theme";

const MOCK_HISTORY = [
  { id: "1", time: "14:32:05", temp: 28.3, humidity: 71.2, risk: "medium" as const },
  { id: "2", time: "14:28:12", temp: 28.1, humidity: 70.8, risk: "medium" as const },
  { id: "3", time: "14:24:30", temp: 27.9, humidity: 70.1, risk: "low" as const },
  { id: "4", time: "14:20:45", temp: 27.6, humidity: 69.5, risk: "low" as const },
  { id: "5", time: "14:16:18", temp: 27.4, humidity: 68.9, risk: "low" as const },
  { id: "6", time: "14:12:00", temp: 27.1, humidity: 68.2, risk: "low" as const },
  { id: "7", time: "14:08:33", temp: 26.8, humidity: 67.5, risk: "low" as const },
  { id: "8", time: "14:04:11", temp: 26.5, humidity: 66.8, risk: "low" as const },
];

const RISK_DOT: Record<string, string> = {
  low: Colors.jade,
  medium: Colors.gold,
  high: Colors.lacquer,
};

export default function HistoryScreen() {
  const chartData = useDashboardStore((s) => s.chartData);
  const history = chartData.length > 0
    ? chartData.slice().reverse().map((p, i) => ({
        id: String(i),
        time: p.time,
        temp: p.temp,
        humidity: p.humidity,
        risk: (p.humidity > 75 || p.temp > 30 ? "high" : p.humidity > 68 || p.temp > 28 ? "medium" : "low") as "low" | "medium" | "high",
      }))
    : MOCK_HISTORY;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lịch sử đo</Text>
      <Text style={styles.subtitle}>Các lần đo trước đây</Text>

      <PlaqueCard label="Bảng dữ liệu" style={styles.tableCard}>
        {/* Table header */}
        <View style={styles.tableRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>Thời gian</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Nhiệt độ</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Độ ẩm</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: "center" }]}>Mức</Text>
        </View>
        <View style={styles.tableDivider} />

        {/* Rows */}
        {history.map((row) => (
          <View key={row.id} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 1.5 }]}>{row.time}</Text>
            <Text style={[styles.tdNum, { flex: 1, color: Colors.lacquerDark }]}>
              {row.temp.toFixed(1)}°C
            </Text>
            <Text style={[styles.tdNum, { flex: 1, color: Colors.jade }]}>
              {row.humidity.toFixed(1)}%
            </Text>
            <View style={{ flex: 0.5, alignItems: "center" }}>
              <View style={[styles.riskDot, { backgroundColor: RISK_DOT[row.risk] }]} />
            </View>
          </View>
        ))}
      </PlaqueCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {chartData.length > 0
            ? `${chartData.length} bản ghi thời gian thực`
            : "Chế độ mô phỏng — dữ liệu mẫu"}
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
  tableCard: {
    padding: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  tableDivider: {
    height: 1,
    backgroundColor: Colors.line,
  },
  th: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.inkSoft,
  },
  td: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.ink,
  },
  tdNum: {
    fontFamily: Font.regular,
    fontSize: 11,
    textAlign: "right",
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  footer: {
    marginTop: 16,
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
