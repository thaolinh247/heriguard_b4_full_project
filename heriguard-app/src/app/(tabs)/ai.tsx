import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

const LABEL_NAMES: Record<string, string> = {
  crack_small: "Nứt nhỏ",
  crack_large: "Nứt lớn",
  moss: "Rêu",
  mold: "Mốc",
  stain: "Ố màu",
};

function generateDetectionSummary(
  trends: { label: string; count: number; avgConfidence: number }[]
): string {
  if (trends.length === 0) return "Chưa có phát hiện hư hại nào từ camera.";
  const lines = trends.map(
    (t) =>
      `${LABEL_NAMES[t.label] ?? t.label}: ${t.count} lần (độ tin cậy TB ${(t.avgConfidence * 100).toFixed(0)}%)`
  );
  return lines.join("\n");
}

function generateEnvironmentAnalysis(
  temp: number | null,
  humidity: number | null,
  chartData: { temp: number; humidity: number }[]
): string {
  if (temp === null || humidity === null || chartData.length < 3) {
    return "Chưa đủ dữ liệu để phân tích môi trường.";
  }
  const recent = chartData.slice(-6);
  const avgTemp = recent.reduce((s, d) => s + d.temp, 0) / recent.length;
  const avgHum = recent.reduce((s, d) => s + d.humidity, 0) / recent.length;
  const tempV = Math.max(...recent.map((d) => d.temp)) - Math.min(...recent.map((d) => d.temp));
  const humV = Math.max(...recent.map((d) => d.humidity)) - Math.min(...recent.map((d) => d.humidity));

  let text = `Nhiệt độ TB: ${avgTemp.toFixed(1)}°C, biên độ ${tempV.toFixed(1)}°C. `;
  text += `Độ ẩm TB: ${avgHum.toFixed(1)}%, biên độ ${humV.toFixed(1)}%. `;
  if (avgTemp > 30) text += "Nhiệt độ vượt ngưỡng an toàn (>30°C). ";
  if (avgHum > 75) text += "Độ ẩm vượt ngưỡng an toàn (>75%). ";
  if (avgHum > 68 && avgHum <= 75) text += "Độ ẩm ở mức cần theo dõi (68-75%). ";
  if (text.endsWith(". ")) text = text.slice(0, -2) + ".";
  return text;
}

function generateRecommendation(
  detections: { label: string; confidence: number }[],
  temp: number | null,
  humidity: number | null,
  markers: { flags: number }[]
): string {
  const hasCrack = detections.some((d) => d.label === "crack_large" || d.label === "crack_small");
  const highConfCrack = detections.some(
    (d) => (d.label === "crack_large" || d.label === "crack_small") && d.confidence > 0.75
  );
  const hasMoss = detections.some((d) => d.label === "moss" || d.label === "mold");
  const envWarning = (temp ?? 0) > 30 || (humidity ?? 0) > 75;
  const mapIssues = markers.filter((m) => m.flags > 0).length;

  const recs: string[] = [];
  if (highConfCrack) recs.push("KHẨN: Phát hiện vết nứt lớn với độ tin cậy cao. Cần kiểm tra ngay.");
  if (hasCrack) recs.push("Phát hiện vết nứt tại hiện trường. Theo dõi diễn biến qua các phiên tuần tra tiếp theo.");
  if (hasMoss) recs.push("Phát hiện rêu/mốc — dấu hiệu độ ẩm cao kéo dài. Cần cải thiện thông gió.");
  if (envWarning) recs.push("Môi trường vượt ngưỡng an toàn. Xem xét điều chỉnh điều kiện bảo quản.");
  if (mapIssues > 2) recs.push(`Có ${mapIssues} vị trí có dấu hiệu bất thường trên bản đồ tuần tra.`);

  if (recs.length === 0) {
    recs.push("Không phát hiện vấn đề nghiêm trọng. Tiếp tục theo dõi định kỳ.");
  }
  return recs.join("\n\n");
}

export default function AIScreen() {
  const [loading, setLoading] = useState(false);
  const [fullAnalysis, setFullAnalysis] = useState<string | null>(null);

  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const chartData = useDashboardStore((s) => s.chartData);
  const markers = usePatrolStore((s) => s.currentMapMarkers);
  const detections = useDetectionStore((s) => s.detections);
  const trends = useDetectionStore((s) => s.getTrends());

  const envAnalysis = generateEnvironmentAnalysis(temp, humidity, chartData);
  const detSummary = generateDetectionSummary(trends);

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      const rec = generateRecommendation(
        detections.map((d) => ({ label: d.label, confidence: d.confidence })),
        temp,
        humidity,
        markers
      );
      setFullAnalysis(rec);
      setLoading(false);
    }, 1200);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Phân tích</Text>

      {/* Detection summary */}
      <PlaqueCard label="Phát hiện hư hại" style={styles.card}>
        <View style={styles.bodyGold}>
          <Text style={styles.bodyText}>{detSummary}</Text>
        </View>
      </PlaqueCard>

      {/* Environment analysis */}
      <PlaqueCard label="Môi trường" style={styles.card}>
        <View style={styles.bodyJade}>
          <Text style={styles.bodyText}>{envAnalysis}</Text>
        </View>
      </PlaqueCard>

      {/* Trends section */}
      {trends.length > 0 && (
        <PlaqueCard label="Xu hướng dài hạn" style={styles.card}>
          <View style={styles.trendList}>
            {trends.map((t, i) => (
              <View key={i} style={styles.trendRow}>
                <View style={styles.trendDot} />
                <View style={styles.trendInfo}>
                  <Text style={styles.trendLabel}>{LABEL_NAMES[t.label] ?? t.label}</Text>
                  <Text style={styles.trendMeta}>
                    {t.count} lần · độ tin cậy {(t.avgConfidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </PlaqueCard>
      )}

      {/* Analyze button */}
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

      {/* Full analysis */}
      <PlaqueCard label="Khuyến nghị" style={styles.card}>
        <View style={styles.bodyGold}>
          {loading && !fullAnalysis ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.inkSoft} />
              <Text style={styles.loadingText}>Đang phân tích…</Text>
            </View>
          ) : (
            <Text style={styles.bodyText}>
              {fullAnalysis ?? 'Nhấn "Phân tích lại" để AI đánh giá tổng hợp dữ liệu.'}
            </Text>
          )}
        </View>
      </PlaqueCard>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Phân tích dựa trên dữ liệu cảm biến và phát hiện từ robot. Không phải kết luận chuyên môn chính thức.
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
  card: {
    padding: 12,
  },
  bodyGold: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  bodyJade: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.jade,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  bodyText: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ink,
  },
  trendList: {
    gap: 8,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.jade,
  },
  trendInfo: {
    flex: 1,
  },
  trendLabel: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.ink,
  },
  trendMeta: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 1,
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
