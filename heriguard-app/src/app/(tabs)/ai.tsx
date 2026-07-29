import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

function generateAITrend(
  temp: number | null,
  humidity: number | null,
  chartData: { temp: number; humidity: number; time: string }[]
): string {
  if (temp === null || humidity === null || chartData.length < 5) {
    return "Đang thu thập dữ liệu để phân tích xu hướng…";
  }

  const recent = chartData.slice(-10);
  const older = chartData.slice(-20, -10);

  if (older.length === 0) {
    return "Cần thêm dữ liệu lịch sử để phân tích xu hướng so với các phiên trước.";
  }

  const recentAvgTemp = recent.reduce((s, d) => s + d.temp, 0) / recent.length;
  const olderAvgTemp = older.reduce((s, d) => s + d.temp, 0) / older.length;
  const recentAvgHum = recent.reduce((s, d) => s + d.humidity, 0) / recent.length;
  const olderAvgHum = older.reduce((s, d) => s + d.humidity, 0) / older.length;

  const tempTrend = recentAvgTemp - olderAvgTemp;
  const humTrend = recentAvgHum - olderAvgHum;

  if (Math.abs(tempTrend) < 0.3 && Math.abs(humTrend) < 1.5) {
    return "Xu hướng ổn định — các chỉ số dao động trong biên độ hẹp, không có biến động đáng kể so với phiên trước.";
  }

  const parts: string[] = [];
  if (tempTrend > 0.5) parts.push(`nhiệt độ có xu hướng tăng ${(tempTrend).toFixed(1)}°C`);
  else if (tempTrend < -0.5) parts.push(`nhiệt độ có xu hướng giảm ${Math.abs(tempTrend).toFixed(1)}°C`);
  if (humTrend > 2) parts.push(`độ ẩm tăng ${(humTrend).toFixed(1)}%`);
  else if (humTrend < -2) parts.push(`độ ẩm giảm ${Math.abs(humTrend).toFixed(1)}%`);

  return parts.length > 0
    ? `So với phiên trước, ${parts.join(" và ")}.`
    : "Các chỉ số thay đổi nhẹ trong biên độ chấp nhận được.";
}

function generateAnalysis(
  temp: number | null,
  humidity: number | null,
  chartData: { temp: number; humidity: number }[]
): string {
  if (temp === null || humidity === null || chartData.length < 3) {
    return "Chưa đủ dữ liệu để phân tích. Vui lòng chờ robot thu thập thêm dữ liệu cảm biến.";
  }

  const recent = chartData.slice(-6);
  const avgTemp = recent.reduce((s, d) => s + d.temp, 0) / recent.length;
  const avgHum = recent.reduce((s, d) => s + d.humidity, 0) / recent.length;

  const tempVolatility = Math.max(...recent.map((d) => d.temp)) - Math.min(...recent.map((d) => d.temp));
  const humVolatility = Math.max(...recent.map((d) => d.humidity)) - Math.min(...recent.map((d) => d.humidity));

  let analysis = `Nhiệt độ trung bình phiên hiện tại: ${avgTemp.toFixed(1)}°C, độ ẩm: ${avgHum.toFixed(1)}%. `;

  if (tempVolatility > 3) {
    analysis += `Biến động nhiệt độ khá lớn (${tempVolatility.toFixed(1)}°C), `;
  } else {
    analysis += `Nhiệt độ ổn định (biên độ ${tempVolatility.toFixed(1)}°C), `;
  }

  if (humVolatility > 8) {
    analysis += `độ ẩm biến động mạnh (${humVolatility.toFixed(1)}%). `;
  } else {
    analysis += `độ ẩm ổn định (biên độ ${humVolatility.toFixed(1)}%). `;
  }

  analysis += "\n\nĐây là diễn giải từ mô hình AI dựa trên dữ liệu cảm biến, không phải kết luận chuyên môn chính thức. ";
  analysis += "Khuyến nghị đối chiếu với chuyên gia bảo tồn nếu nghi ngờ có vấn đề về điều kiện môi trường.";

  return analysis;
}

export default function AIScreen() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const chartData = useDashboardStore((s) => s.chartData);

  const trend = generateAITrend(temp, humidity, chartData);

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      const result = generateAnalysis(temp, humidity, chartData);
      setAnalysis(result);
      setLoading(false);
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Phân tích</Text>

      {/* Trend summary */}
      <PlaqueCard label="Tóm tắt xu hướng" style={styles.trendCard}>
        <View style={styles.trendBody}>
          <Text style={styles.trendText}>{trend}</Text>
        </View>
      </PlaqueCard>

      {/* Analysis button */}
      <TouchableOpacity
        onPress={handleAnalyze}
        disabled={loading}
        style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.paper} />
            <Text style={styles.analyzeBtnText}>Đang phân tích…</Text>
          </View>
        ) : (
          <Text style={styles.analyzeBtnText}>Phân tích lại</Text>
        )}
      </TouchableOpacity>

      {/* Analysis content */}
      <PlaqueCard label="Phân tích chi tiết" style={styles.analysisCard}>
        <View style={styles.analysisBody}>
          {loading && !analysis ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.inkSoft} />
              <Text style={styles.loadingText}>Đang phân tích dữ liệu…</Text>
            </View>
          ) : (
            <Text style={styles.analysisText}>
              {analysis ?? "Nhấn \"Phân tích lại\" để AI đánh giá dữ liệu cảm biến mới nhất."}
            </Text>
          )}
        </View>
      </PlaqueCard>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Đây là phân tích tham khảo dựa trên xu hướng dữ liệu, chưa có ngưỡng khoa học được xác nhận cho di tích cụ thể.
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
    gap: 14,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 4,
  },
  trendCard: {
    padding: 12,
  },
  trendBody: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.jade,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  trendText: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ink,
  },
  analyzeBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: "center",
  },
  analyzeBtnDisabled: {
    opacity: 0.6,
  },
  analyzeBtnText: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.paper,
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analysisCard: {
    padding: 12,
  },
  analysisBody: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    paddingLeft: 12,
    paddingVertical: 6,
    minHeight: 80,
  },
  analysisText: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 21,
    color: Colors.ink,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.inkSoft,
    fontStyle: "italic",
  },
  disclaimer: {
    marginTop: 4,
    padding: 12,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
  },
  disclaimerText: {
    fontFamily: Font.regular,
    fontSize: 11,
    lineHeight: 17,
    color: Colors.inkSoft,
    fontStyle: "italic",
  },
});
