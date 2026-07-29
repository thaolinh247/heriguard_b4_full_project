import { View, Text, Dimensions, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

const screenWidth = Dimensions.get("window").width;

export function MiniChart() {
  const router = useRouter();
  const chartData = useDashboardStore((s) => s.chartData);

  const labels = chartData.map((d) => d.time);
  const tempData = chartData.map((d) => d.temp);
  const humData = chartData.map((d) => d.humidity);

  const hasData = chartData.length > 2;

  return (
    <PlaqueCard label="Xu hướng 6–12 giờ" style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push("/(tabs)/charts")}
      >
        <View style={styles.chartWrap}>
          {hasData ? (
            <LineChart
              data={{
                labels: labels.filter((_, i) => i % Math.max(1, Math.floor(labels.length / 6)) === 0 || i === labels.length - 1),
                datasets: [
                  {
                    data: tempData,
                    color: () => Colors.lacquer,
                    strokeWidth: 1.5,
                  },
                  {
                    data: humData,
                    color: () => Colors.jade,
                    strokeWidth: 1.5,
                  },
                ],
              }}
              width={screenWidth - 64}
              height={120}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLines={false}
              withHorizontalLines={false}
              withDots={false}
              bezier
              chartConfig={{
                backgroundColor: "transparent",
                backgroundGradientFrom: Colors.paper,
                backgroundGradientTo: Colors.paper,
                decimalPlaces: 0,
                color: () => Colors.line,
                labelColor: () => Colors.inkSoft,
                propsForBackgroundLines: {
                  stroke: "transparent",
                },
              }}
              style={styles.chart}
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>Chưa đủ dữ liệu biểu đồ</Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.lacquer }]} />
            <Text style={styles.legendText}>Nhiệt độ</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.jade }]} />
            <Text style={styles.legendText}>Độ ẩm</Text>
          </View>
          <Text style={styles.tapHint}>Tap để xem chi tiết →</Text>
        </View>
      </TouchableOpacity>
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  chartWrap: {
    height: 130,
    overflow: "hidden",
    marginTop: 4,
  },
  chart: {
    marginLeft: -16,
    borderRadius: 0,
  },
  emptyChart: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  tapHint: {
    marginLeft: "auto",
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.gold,
  },
});
