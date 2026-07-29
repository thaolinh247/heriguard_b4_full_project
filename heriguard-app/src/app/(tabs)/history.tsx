import { View, Text, ScrollView, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors, Font } from "@/constants/theme";

const LABEL_COLORS: Record<string, string> = {
  crack_small: Colors.gold,
  crack_large: Colors.lacquer,
  moss: Colors.jade,
  mold: Colors.inkSoft,
  stain: "#6B4F8A",
};

export default function HistoryScreen() {
  const patrols = usePatrolStore((s) => s.patrols);
  const allDetections = useDetectionStore((s) => s.detections);
  const chartData = useDashboardStore((s) => s.chartData);

  const hasPatrolData = patrols.length > 0;

  const rows = hasPatrolData
    ? patrols.flatMap((p) =>
        p.sensorLogs.map((s, i) => {
          const det = allDetections.find(
            (d) => d.patrolId === p.id && d.timestamp === s.timestamp
          );
          return {
            id: `${p.id}-${i}`,
            time: new Date(s.timestamp).toLocaleTimeString("vi-VN"),
            temp: s.temperature,
            humidity: s.humidity,
            risk: (
              s.humidity > 75 || s.temperature > 30
                ? "high"
                : s.humidity > 68 || s.temperature > 28
                  ? "medium"
                  : "low"
            ) as "low" | "medium" | "high",
            detection: det,
          };
        })
      ).reverse()
    : chartData.length > 0
      ? chartData.slice().reverse().map((p, i) => ({
          id: String(i),
          time: p.time,
          temp: p.temp,
          humidity: p.humidity,
          risk: (
            p.humidity > 75 || p.temp > 30
              ? "high"
              : p.humidity > 68 || p.temp > 28
                ? "medium"
                : "low"
          ) as "low" | "medium" | "high",
          detection: null,
        }))
      : [];

  const summary = hasPatrolData
    ? {
        total: patrols.length,
        detections: allDetections.length,
        highConfidence: allDetections.filter((d) => d.confidence > 0.75).length,
      }
    : null;

  const RISK_DOT: Record<string, string> = {
    low: Colors.jade,
    medium: Colors.gold,
    high: Colors.lacquer,
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lịch sử đo</Text>
      <Text style={styles.subtitle}>Các lần tuần tra và phát hiện</Text>

      {summary && (
        <PlaqueCard label="Tổng quan" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.total}</Text>
              <Text style={styles.summaryLabel}>Lần tuần tra</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.detections}</Text>
              <Text style={styles.summaryLabel}>Phát hiện</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: Colors.lacquer }]}>
                {summary.highConfidence}
              </Text>
              <Text style={styles.summaryLabel}>Nguy cơ cao</Text>
            </View>
          </View>
        </PlaqueCard>
      )}

      <PlaqueCard label="Bảng dữ liệu" style={styles.tableCard}>
        <View style={styles.tableRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>Thời gian</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Nhiệt độ</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Độ ẩm</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: "center" }]}>Mức</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Phát hiện</Text>
        </View>
        <View style={styles.tableDivider} />

        {rows.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có dữ liệu tuần tra</Text>
        ) : (
          rows.map((row) => (
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
              <View style={{ flex: 1, alignItems: "center" }}>
                {row.detection ? (
                  <View
                    style={[
                      styles.badgeDot,
                      { backgroundColor: LABEL_COLORS[row.detection.label] ?? Colors.inkSoft },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </PlaqueCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {hasPatrolData
            ? `${rows.length} bản ghi từ ${patrols.length} lần tuần tra`
            : "Chế độ chờ — kết nối robot hoặc bật mô phỏng để có dữ liệu"}
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
  summaryCard: {
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryNumber: {
    fontFamily: Font.bold,
    fontSize: 22,
    fontWeight: "600",
    color: Colors.ink,
  },
  summaryLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.line,
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
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 24,
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
