import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

function generateTrendSummary(
  temp: number | null,
  humidity: number | null,
  chartData: { temp: number; humidity: number }[]
): string {
  if (temp === null || humidity === null || chartData.length < 3) {
    return "Đang thu thập dữ liệu từ trạm quan trắc…";
  }

  const recent = chartData.slice(-6);
  const avgTemp = recent.reduce((s, d) => s + d.temp, 0) / recent.length;
  const avgHum = recent.reduce((s, d) => s + d.humidity, 0) / recent.length;

  const tempDiff = temp - avgTemp;
  const humDiff = humidity - avgHum;

  if (Math.abs(tempDiff) < 0.5 && Math.abs(humDiff) < 2) {
    return "Các chỉ số ổn định, không có biến động bất thường so với phiên gần nhất.";
  }

  const parts: string[] = [];

  if (tempDiff > 1) {
    parts.push(`Nhiệt độ tăng nhẹ ${(tempDiff).toFixed(1)}°C`);
  } else if (tempDiff < -1) {
    parts.push(`Nhiệt độ giảm nhẹ ${Math.abs(tempDiff).toFixed(1)}°C`);
  }

  if (humDiff > 3) {
    parts.push(`Độ ẩm tăng ${humDiff.toFixed(1)}%`);
  } else if (humDiff < -3) {
    parts.push(`Độ ẩm giảm ${Math.abs(humDiff).toFixed(1)}%`);
  }

  return parts.length > 0
    ? parts.join(", ") + " so với trung bình phiên trước."
    : "Các chỉ số dao động trong biên độ nhỏ, không có dấu hiệu bất thường.";
}

export function TrendSummary() {
  const router = useRouter();
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const chartData = useDashboardStore((s) => s.chartData);

  const summary = generateTrendSummary(temp, humidity, chartData);

  return (
    <PlaqueCard label="Nhận định xu hướng" style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push("/(tabs)/ai")}
        style={styles.touchable}
      >
        <View style={styles.body}>
          <Text style={styles.text}>{summary}</Text>
        </View>
        <Text style={styles.tapHint}>Xem phân tích chi tiết →</Text>
      </TouchableOpacity>
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  touchable: {},
  body: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ink,
  },
  tapHint: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.gold,
    textAlign: "right",
    marginTop: 8,
  },
});
