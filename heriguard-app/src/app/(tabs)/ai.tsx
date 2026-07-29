import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useSettingsStore } from "@/store/settingsStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font, RiskColors, RiskLabels, type RiskLevel } from "@/constants/theme";
import { analyzeWithGemini, imageToBase64 } from "@/lib/gemini";
import { mockAnalyze } from "@/lib/mockGemini";
import type { GeminiAnalysis } from "@/types/gemini";

const ANALYSIS_CACHE_KEY = "heriguard_analysis_cache";
let cachedAnalysis: GeminiAnalysis | null = null;

const SEVERITY_LABELS: Record<string, string> = {
  low: "An toàn",
  medium: "Cần chú ý",
  high: "Cảnh báo",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: Colors.jade,
  medium: Colors.gold,
  high: Colors.lacquer,
};

export default function AIScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);

  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const markers = usePatrolStore((s) => s.currentMapMarkers);
  const detections = useDetectionStore((s) => s.detections);
  const latestImage = useDeviceStore((s) => s.latestImage);
  const trends = useDetectionStore((s) => s.getTrends());

  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const geminiMockMode = useSettingsStore((s) => s.geminiMockMode);

  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const detectionList = detections.map((d) => ({
        label: d.label,
        confidence: d.confidence,
      }));

      const markerList = markers.map((m) => ({
        temperature: m.temperature,
        humidity: m.humidity,
        flags: m.flags,
      }));

      let result: GeminiAnalysis;

      if (geminiMockMode || !geminiApiKey) {
        // Mock mode
        await new Promise((r) => setTimeout(r, 1200));
        result = mockAnalyze(temp, humidity, detectionList);
      } else {
        // Gemini thật
        let imageBase64: string | null = null;
        if (latestImage?.uri) {
          try {
            imageBase64 = await imageToBase64(latestImage.uri);
          } catch {
            // Không có ảnh vẫn phân tích được
          }
        }

        result = await analyzeWithGemini(
          geminiApiKey,
          imageBase64,
          temp,
          humidity,
          detectionList,
          markerList
        );
      }

      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Phân tích</Text>
      <Text style={styles.subtitle}>
        {geminiMockMode || !geminiApiKey
          ? "Đang dùng chế độ mô phỏng"
          : "Đã kết nối Gemini AI"}
      </Text>

      {/* Latest image */}
      {latestImage && (
        <PlaqueCard label="Ảnh hiện trường" style={styles.card}>
          <Image
            source={{ uri: latestImage.uri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <Text style={styles.imageTimestamp}>{latestImage.timestamp}</Text>
        </PlaqueCard>
      )}

      {/* Classification trends */}
      {trends.length > 0 && (
        <PlaqueCard label="Phát hiện từ camera" style={styles.card}>
          <View style={styles.trendList}>
            {trends.map((t, i) => (
              <View key={i} style={styles.trendRow}>
                <View style={styles.trendDot} />
                <View style={styles.trendInfo}>
                  <Text style={styles.trendLabel}>{t.label}</Text>
                  <Text style={styles.trendMeta}>
                    {t.count} lần · độ tin cậy {(t.avgConfidence * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </PlaqueCard>
      )}

      {/* Environmental data */}
      <PlaqueCard label="Môi trường hiện tại" style={styles.card}>
        <View style={styles.envRow}>
          <View style={styles.envItem}>
            <Text style={styles.envValue}>{temp !== null ? `${temp.toFixed(1)}°` : "—"}</Text>
            <Text style={styles.envLabel}>Nhiệt độ</Text>
          </View>
          <View style={styles.envDivider} />
          <View style={styles.envItem}>
            <Text style={styles.envValue}>{humidity !== null ? `${humidity.toFixed(1)}%` : "—"}</Text>
            <Text style={styles.envLabel}>Độ ẩm</Text>
          </View>
        </View>
      </PlaqueCard>

      {/* Analyze button */}
      <TouchableOpacity
        onPress={handleAnalyze}
        disabled={loading}
        style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.paper} />
            <Text style={styles.analyzeBtnText}>Đang phân tích AI…</Text>
          </View>
        ) : (
          <Text style={styles.analyzeBtnText}>
            {analysis ? "Phân tích lại" : "Phân tích bằng AI"}
          </Text>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <PlaqueCard label="Lỗi" style={styles.card}>
          <View style={styles.bodyLacquer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </PlaqueCard>
      )}

      {/* Analysis result */}
      {analysis && !loading && (
        <>
          {/* Severity badge */}
          <View style={[styles.severityBar, { backgroundColor: SEVERITY_COLORS[analysis.severity] }]}>
            <Text style={styles.severityIcon}>
              {analysis.severity === "high" ? "⚠️" : analysis.severity === "medium" ? "⚡" : "✓"}
            </Text>
            <Text style={styles.severityText}>{SEVERITY_LABELS[analysis.severity]}</Text>
          </View>

          {/* Summary */}
          <PlaqueCard label="Đánh giá tổng quan" style={styles.card}>
            <View style={styles.bodyGold}>
              <Text style={styles.bodyText}>{analysis.summary}</Text>
            </View>
          </PlaqueCard>

          {/* Findings */}
          {analysis.findings.length > 0 && (
            <PlaqueCard label="Kết quả phân tích" style={styles.card}>
              <View style={styles.bodyGold}>
                {analysis.findings.map((f, i) => (
                  <View key={i} style={styles.findingRow}>
                    <Text style={styles.findingDot}>▸</Text>
                    <View style={styles.findingContent}>
                      <Text style={styles.findingText}>
                        <Text style={styles.findingType}>{f.type}</Text> — {f.description}
                      </Text>
                      {f.confidence > 0 && (
                        <View style={styles.confidenceBarOuter}>
                          <View
                            style={[
                              styles.confidenceBarInner,
                              { width: `${f.confidence}%` },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </PlaqueCard>
          )}

          {/* Environmental assessment */}
          <PlaqueCard label="Tác động môi trường" style={styles.card}>
            <View style={styles.bodyJade}>
              <Text style={styles.bodyText}>{analysis.envAssessment}</Text>
            </View>
          </PlaqueCard>

          {/* Correlations */}
          {analysis.correlations.length > 0 && (
            <PlaqueCard label="Liên kết dữ liệu" style={styles.card}>
              <View style={styles.bodyGold}>
                {analysis.correlations.map((c, i) => (
                  <View key={i} style={styles.corrRow}>
                    <Text style={styles.corrBullet}>•</Text>
                    <Text style={styles.corrText}>{c}</Text>
                  </View>
                ))}
              </View>
            </PlaqueCard>
          )}

          {/* Recommendations */}
          <PlaqueCard label="Khuyến nghị" style={styles.card}>
            <View style={styles.bodyLacquer}>
              {analysis.recommendations.map((r, i) => (
                <View key={i} style={styles.recRow}>
                  <Text style={styles.recNum}>{i + 1}.</Text>
                  <Text style={styles.recText}>{r}</Text>
                </View>
              ))}
            </View>
          </PlaqueCard>
        </>
      )}

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <PlaqueCard label="Hướng dẫn" style={styles.card}>
          <Text style={styles.bodyText}>
            Nhấn nút "Phân tích bằng AI" để Gemini phân tích tổng hợp ảnh hiện trường, dữ liệu cảm biến
            và các phát hiện từ robot. Kết quả bao gồm đánh giá mức độ nguy hiểm, các mối liên kết
            giữa môi trường và hư hại, cùng khuyến nghị xử lý.
          </Text>
        </PlaqueCard>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Phân tích dựa trên AI (Gemini). Không phải kết luận chuyên môn chính thức.
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
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginBottom: 2,
  },
  card: {
    padding: 12,
  },
  thumbnail: {
    width: "100%",
    height: 160,
    borderRadius: 2,
    marginBottom: 6,
    backgroundColor: Colors.jadeLight,
  },
  imageTimestamp: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    textAlign: "right",
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
  envRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  envItem: {
    alignItems: "center",
    flex: 1,
  },
  envValue: {
    fontFamily: Font.bold,
    fontSize: 26,
    color: Colors.ink,
  },
  envLabel: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  envDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.line,
  },
  analyzeBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 14,
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
  severityBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 2,
  },
  severityIcon: {
    fontSize: 16,
  },
  severityText: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.paper,
    letterSpacing: 0.5,
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
  bodyLacquer: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.lacquer,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  bodyText: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ink,
  },
  findingRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  findingDot: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.gold,
    lineHeight: 20,
  },
  findingContent: {
    flex: 1,
  },
  findingText: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ink,
  },
  findingType: {
    fontFamily: Font.bold,
    color: Colors.lacquer,
  },
  confidenceBarOuter: {
    height: 4,
    backgroundColor: Colors.jadeLight,
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  confidenceBarInner: {
    height: "100%",
    backgroundColor: Colors.jade,
    borderRadius: 2,
  },
  corrRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  corrBullet: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.gold,
    lineHeight: 20,
  },
  corrText: {
    fontFamily: Font.regular,
    fontSize: 12,
    lineHeight: 20,
    color: Colors.ink,
    flex: 1,
  },
  recRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  recNum: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.lacquer,
    lineHeight: 20,
    width: 16,
  },
  recText: {
    fontFamily: Font.regular,
    fontSize: 12,
    lineHeight: 20,
    color: Colors.ink,
    flex: 1,
  },
  errorText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.lacquer,
    lineHeight: 20,
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
