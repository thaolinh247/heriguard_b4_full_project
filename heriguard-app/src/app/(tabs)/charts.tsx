import { useState } from "react";
import { View, Text, ScrollView, Dimensions, TouchableOpacity, StyleSheet } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

const screenWidth = Dimensions.get("window").width;
type TimeFilter = "6h" | "24h" | "7d";

const FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "6h", label: "6 giờ" },
  { key: "24h", label: "24 giờ" },
  { key: "7d", label: "7 ngày" },
];

export default function ChartsScreen() {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("6h");
  const chartData = useDashboardStore((s) => s.chartData);

  const labels = chartData.map((d) => d.time);
  const tempData = chartData.map((d) => d.temp);
  const humData = chartData.map((d) => d.humidity);

  const hasData = chartData.length > 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Biểu đồ & Lịch sử</Text>

      {/* Time filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[styles.pill, activeFilter === f.key && styles.pillActive]}
          >
            <Text style={[styles.pillText, activeFilter === f.key && styles.pillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main chart */}
      <PlaqueCard label="Nhiệt độ & Độ ẩm" style={styles.chartCard}>
        {hasData ? (
          <LineChart
            data={{
              labels: labels.filter((_, i) => i % Math.max(1, Math.floor(labels.length / 6)) === 0 || i === labels.length - 1),
              datasets: [
                {
                  data: tempData,
                  color: () => Colors.lacquer,
                  strokeWidth: 2,
                },
                {
                  data: humData,
                  color: () => Colors.jade,
                  strokeWidth: 2,
                },
              ],
              legend: ["Nhiệt độ (°C)", "Độ ẩm (%)"],
            }}
            width={screenWidth - 64}
            height={220}
            chartConfig={{
              backgroundColor: Colors.paper,
              backgroundGradientFrom: Colors.paper,
              backgroundGradientTo: Colors.paper,
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(42,36,32,${opacity})`,
              labelColor: () => Colors.inkSoft,
              propsForDots: {
                r: "2",
                strokeWidth: "1",
                stroke: Colors.ink,
              },
              propsForBackgroundLines: {
                strokeDasharray: "4 4",
                stroke: Colors.line,
              },
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>Chưa đủ dữ liệu để vẽ biểu đồ</Text>
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.lacquer }]} />
            <Text style={styles.legendText}>Nhiệt độ (°C)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.jade }]} />
            <Text style={styles.legendText}>Độ ẩm (%)</Text>
          </View>
        </View>
      </PlaqueCard>

      {/* Recent readings table */}
      <PlaqueCard label="Bản ghi gần nhất" style={styles.tableCard}>
        {/* Header */}
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeader, { flex: 2 }]}>Thời gian</Text>
          <Text style={[styles.tableHeader, { flex: 1, textAlign: "right" }]}>°C</Text>
          <Text style={[styles.tableHeader, { flex: 1, textAlign: "right" }]}>%</Text>
        </View>

        {/* Rows */}
        {chartData.length > 0 ? (
          chartData
            .slice(-8)
            .reverse()
            .map((row, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{row.time}</Text>
                <Text style={[styles.tableCellTemp, { flex: 1 }]}>{row.temp.toFixed(1)}</Text>
                <Text style={[styles.tableCellHum, { flex: 1 }]}>{row.humidity.toFixed(1)}</Text>
              </View>
            ))
        ) : (
          <Text style={styles.emptyTableText}>Chưa có bản ghi</Text>
        )}
      </PlaqueCard>
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
    gap: 14,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.paper,
  },
  pillActive: {
    backgroundColor: Colors.jade,
    borderColor: Colors.jade,
  },
  pillText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  pillTextActive: {
    color: Colors.paper,
  },
  chartCard: {
    padding: 12,
  },
  chart: {
    marginLeft: -20,
    borderRadius: 0,
  },
  emptyChart: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.inkSoft,
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
  },
  tableCard: {
    padding: 12,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  tableRowAlt: {
    backgroundColor: Colors.cream + "60",
  },
  tableHeader: {
    fontFamily: Font.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: Colors.inkSoft,
    textTransform: "uppercase",
  },
  tableCell: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.ink,
  },
  tableCellTemp: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.lacquerDark,
    textAlign: "right",
  },
  tableCellHum: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.jade,
    textAlign: "right",
  },
  emptyTableText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 16,
  },
});
