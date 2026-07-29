import { View, Text, Dimensions, StyleSheet } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors } from "@/constants/theme";

const screenWidth = Dimensions.get("window").width;

export function EnvChart() {
  const chartData = useDashboardStore((s) => s.chartData);

  const labels = chartData.map((d) => d.time);
  const tempData = chartData.map((d) => d.temp);
  const humData = chartData.map((d) => d.humidity);

  const hasData = chartData.length > 0;

  return (
    <View className="bg-paper border border-line rounded-sm p-5 relative">
      {/* Gold corner decorations */}
      <View className="absolute -top-1 -left-1 w-2 h-2 rotate-45" style={{ backgroundColor: Colors.gold }} />
      <View className="absolute -bottom-1 -right-1 w-2 h-2 rotate-45" style={{ backgroundColor: Colors.gold }} />

      {/* Label */}
      <Text
        className="absolute -top-3 left-5 bg-paper px-2 text-xs font-mono uppercase tracking-widest"
        style={{ color: Colors.jade }}
      >
        Biến động nhiệt độ &amp; độ ẩm
      </Text>

      {/* Chart */}
      <View className="h-64 mt-2">
        {hasData ? (
          <LineChart
            data={{
              labels: labels.filter((_, i) => i % 5 === 0 || i === labels.length - 1),
              datasets: [
                {
                  data: tempData.length > 0 ? tempData : [0],
                  color: () => Colors.lacquer,
                  strokeWidth: 2,
                },
                {
                  data: humData.length > 0 ? humData : [0],
                  color: () => Colors.jade,
                  strokeWidth: 2,
                },
              ],
              legend: ["Nhiệt độ (°C)", "Độ ẩm (%)"],
            }}
            width={screenWidth - 60}
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
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm" style={{ color: Colors.inkSoft }}>
              Chưa có dữ liệu biểu đồ
            </Text>
          </View>
        )}
      </View>

      {/* Legend */}
      <View className="flex-row gap-4 mt-3">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: Colors.lacquer }} />
          <Text className="text-xs" style={{ color: Colors.inkSoft }}>
            Nhiệt độ (°C)
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: Colors.jade }} />
          <Text className="text-xs" style={{ color: Colors.inkSoft }}>
            Độ ẩm (%)
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    borderRadius: 2,
    marginLeft: -20,
  },
});
