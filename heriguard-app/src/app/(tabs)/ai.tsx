import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from "react-native";
import { useDeviceStore } from "@/store/deviceStore";
import { useSettingsStore } from "@/store/settingsStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";
import { analyzeWithGemini, analyzeTrendsWithGemini, imageToBase64 } from "@/lib/gemini";
import { mockAnalyze, mockTrendAnalyze } from "@/lib/mockGemini";
import type { GeminiAnalysis, TrendAnalysis, TrendDataPoint } from "@/types/gemini";

type ImageAnalysis = {
  loading: boolean;
  error: string | null;
  result: GeminiAnalysis | null;
};

type TrendState = {
  loading: boolean;
  error: string | null;
  result: TrendAnalysis | null;
};

const SEVERITY_UI: Record<string, { label: string; color: string }> = {
  low: { label: "An toàn", color: Colors.jade },
  medium: { label: "Cần chú ý", color: Colors.gold },
  high: { label: "Cảnh báo", color: Colors.lacquer },
};

const DIRECTION_UI: Record<string, { label: string; color: string }> = {
  improving: { label: "Cải thiện", color: Colors.jade },
  stable: { label: "Ổn định", color: Colors.gold },
  deteriorating: { label: "Xuống cấp", color: Colors.lacquer },
};

export default function AIScreen() {
  const imageHistory = useDeviceStore((s) => s.imageHistory);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const geminiMockMode = useSettingsStore((s) => s.geminiMockMode);
  const [analyses, setAnalyses] = useState<Record<string, ImageAnalysis>>({});
  const [trend, setTrend] = useState<TrendState>({ loading: false, error: null, result: null });

  const images = imageHistory;

  const getImageAnalysis = (imgId: string) =>
    analyses[imgId] ?? { loading: false, error: null, result: null };

  const handleAnalyze = async (img: (typeof images)[number]) => {
    setAnalyses((prev) => ({
      ...prev,
      [img.id]: { loading: true, error: null, result: null },
    }));

    try {
      const detectionList = (img.detections ?? []).map((d) => ({
        label: d.label,
        confidence: d.confidence,
      }));

      let result: GeminiAnalysis;

      if (geminiMockMode || !geminiApiKey) {
        await new Promise((r) => setTimeout(r, 1200));
        result = mockAnalyze(img.temp, img.humidity, detectionList);
      } else {
        let imageBase64: string | null = null;
        if (img.uri) {
          try {
            imageBase64 = await imageToBase64(img.uri);
          } catch {}
        }
        result = await analyzeWithGemini(
          geminiApiKey,
          imageBase64,
          img.temp,
          img.humidity,
          detectionList,
          []
        );
      }

      setAnalyses((prev) => ({
        ...prev,
        [img.id]: { loading: false, error: null, result },
      }));
    } catch (e) {
      setAnalyses((prev) => ({
        ...prev,
        [img.id]: {
          loading: false,
          error: e instanceof Error ? e.message : "Lỗi kết nối AI",
          result: null,
        },
      }));
    }
  };

  const handleTrendAnalysis = async () => {
    setTrend({ loading: true, error: null, result: null });

    try {
      const points: TrendDataPoint[] = images.map((img) => ({
        timestamp: img.timestamp,
        temp: img.temp,
        humidity: img.humidity,
        detections: (img.detections ?? []).map((d) => ({
          label: d.label,
          confidence: d.confidence,
        })),
      }));

      let result: TrendAnalysis;

      if (geminiMockMode || !geminiApiKey) {
        await new Promise((r) => setTimeout(r, 1500));
        result = mockTrendAnalyze(points);
      } else {
        result = await analyzeTrendsWithGemini(geminiApiKey, points);
      }

      setTrend({ loading: false, error: null, result });
    } catch (e) {
      setTrend({
        loading: false,
        error: e instanceof Error ? e.message : "Lỗi phân tích xu hướng",
        result: null,
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Phân tích</Text>
      <Text style={styles.subtitle}>
        Phân tích từng ảnh + nhận định xu hướng đa điểm
      </Text>

      {/* Trend Analysis Section */}
      {images.length >= 2 && (
        <PlaqueCard label="Phân tích xu hướng" style={styles.card}>
          {images.length >= 2 && (
            <TouchableOpacity
              onPress={handleTrendAnalysis}
              disabled={trend.loading}
              style={[styles.trendBtn, trend.loading && styles.analyzeBtnDisabled]}
            >
              {trend.loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={Colors.paper} />
                  <Text style={styles.analyzeBtnText}>Đang phân tích xu hướng…</Text>
                </View>
              ) : (
                <Text style={styles.analyzeBtnText}>
                  {trend.result ? "Phân tích lại xu hướng" : "Phân tích xu hướng"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {trend.error && (
            <View style={[styles.bodyLacquer, { marginTop: 10 }]}>
              <Text style={styles.errorText}>{trend.error}</Text>
            </View>
          )}

          {trend.result && (
            <View style={{ marginTop: 10, gap: 10 }}>
              {/* Direction badge */}
              {(() => {
                const dir = DIRECTION_UI[trend.result.direction];
                return (
                  <View style={[styles.severityBar, { backgroundColor: dir.color }]}>
                    <Text style={styles.severityText}>{dir.label}</Text>
                  </View>
                );
              })()}

              {/* Summary */}
              <View style={styles.bodyGold}>
                <Text style={styles.bodyText}>{trend.result.summary}</Text>
              </View>

              {/* Trends */}
              <View style={styles.trendGrid}>
                <View style={styles.trendGridItem}>
                  <Text style={styles.trendLabel}>Nhiệt độ</Text>
                  <Text style={styles.trendValue}>{trend.result.tempTrend}</Text>
                </View>
                <View style={styles.trendGridItem}>
                  <Text style={styles.trendLabel}>Độ ẩm</Text>
                  <Text style={styles.trendValue}>{trend.result.humidityTrend}</Text>
                </View>
                <View style={[styles.trendGridItem, { borderBottomWidth: 0 }]}>
                  <Text style={styles.trendLabel}>Phát hiện</Text>
                  <Text style={styles.trendValue}>{trend.result.detectionTrend}</Text>
                </View>
              </View>

              {/* Insights */}
              {trend.result.insights.length > 0 && (
                <View style={styles.bodyJade}>
                  {trend.result.insights.map((ins, i) => (
                    <View key={i} style={styles.corrRow}>
                      <Text style={styles.corrBullet}>•</Text>
                      <Text style={styles.corrText}>{ins}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendations */}
              {trend.result.recommendations.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Khuyến nghị</Text>
                  <View style={styles.bodyGold}>
                    {trend.result.recommendations.map((rec, i) => (
                      <View key={i} style={styles.corrRow}>
                        <Text style={styles.corrBullet}>▸</Text>
                        <Text style={styles.corrText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </PlaqueCard>
      )}

      {images.length === 0 ? (
        <PlaqueCard label="Hướng dẫn" style={styles.card}>
          <Text style={styles.bodyText}>
            Chưa có ảnh nào từ robot. Khi có ảnh, bạn có thể chọn từng ảnh để phân tích
            với AI — mỗi ảnh sẽ được đánh giá riêng dựa trên dữ liệu cảm biến tại thời điểm chụp.
          </Text>
        </PlaqueCard>
      ) : (
        images.map((img) => {
          const analysis = getImageAnalysis(img.id);
          const sev = analysis.result ? SEVERITY_UI[analysis.result.severity] : null;

          return (
            <View key={img.id} style={styles.imageBlock}>
              {/* Image */}
              <PlaqueCard label={img.timestamp} style={styles.card}>
                <Image
                  source={{ uri: img.uri }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />

                {/* Sensor data for this image */}
                <View style={styles.imgDataRow}>
                  <View style={styles.imgDataItem}>
                    <Text style={styles.imgDataLabel}>Nhiệt độ</Text>
                    <Text style={[styles.imgDataValue, { color: Colors.lacquerDark }]}>
                      {img.temp.toFixed(1)}°C
                    </Text>
                  </View>
                  <View style={styles.imgDataDivider} />
                  <View style={styles.imgDataItem}>
                    <Text style={styles.imgDataLabel}>Độ ẩm</Text>
                    <Text style={[styles.imgDataValue, { color: Colors.jade }]}>
                      {img.humidity.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* Detections on this image */}
                {img.detections && img.detections.length > 0 && (
                  <View style={styles.detectionRow}>
                    {img.detections.map((det, di) => (
                      <View
                        key={di}
                        style={[
                          styles.detectionBadge,
                          { backgroundColor: det.confidence > 0.75 ? Colors.lacquer : Colors.gold },
                        ]}
                      >
                        <Text style={styles.detectionBadgeText}>
                          {det.label} {(det.confidence * 100).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Analyze button */}
                <TouchableOpacity
                  onPress={() => handleAnalyze(img)}
                  disabled={analysis.loading}
                  style={[styles.analyzeBtn, analysis.loading && styles.analyzeBtnDisabled]}
                >
                  {analysis.loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={Colors.paper} />
                      <Text style={styles.analyzeBtnText}>Đang phân tích…</Text>
                    </View>
                  ) : (
                    <Text style={styles.analyzeBtnText}>
                      {analysis.result ? "Phân tích lại" : "Phân tích ảnh này"}
                    </Text>
                  )}
                </TouchableOpacity>
              </PlaqueCard>

              {/* Analysis error */}
              {analysis.error && (
                <PlaqueCard label="Lỗi" style={styles.card}>
                  <View style={styles.bodyLacquer}>
                    <Text style={styles.errorText}>{analysis.error}</Text>
                  </View>
                </PlaqueCard>
              )}

              {/* Analysis result */}
              {analysis.result && (
                <>
                  {/* Severity badge */}
                  {sev && (
                    <View style={[styles.severityBar, { backgroundColor: sev.color }]}>
                      <Text style={styles.severityText}>{sev.label}</Text>
                    </View>
                  )}

                  {/* Summary */}
                  <PlaqueCard label="Đánh giá tổng quan" style={styles.card}>
                    <View style={styles.bodyGold}>
                      <Text style={styles.bodyText}>{analysis.result.summary}</Text>
                    </View>
                  </PlaqueCard>

                  {/* Findings */}
                  {analysis.result.findings.length > 0 && (
                    <PlaqueCard label="Kết quả phân tích" style={styles.card}>
                      <View style={styles.bodyGold}>
                        {analysis.result.findings.map((f, i) => (
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
                      <Text style={styles.bodyText}>{analysis.result.envAssessment}</Text>
                    </View>
                  </PlaqueCard>

                  {/* Correlations */}
                  {analysis.result.correlations.length > 0 && (
                    <PlaqueCard label="Liên kết dữ liệu" style={styles.card}>
                      <View style={styles.bodyGold}>
                        {analysis.result.correlations.map((c, i) => (
                          <View key={i} style={styles.corrRow}>
                            <Text style={styles.corrBullet}>•</Text>
                            <Text style={styles.corrText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    </PlaqueCard>
                  )}

                  {/* Condition assessment — replaces recommendations */}
                  <PlaqueCard label="Đánh giá tình trạng" style={styles.card}>
                    <View
                      style={[
                        styles.conditionBar,
                        {
                          backgroundColor: analysis.result.conditionAssessment.needsSupport
                            ? Colors.lacquer
                            : Colors.jade,
                        },
                      ]}
                    >
                      <Text style={styles.conditionSeverity}>
                        {analysis.result.conditionAssessment.severity}
                      </Text>
                      <Text style={styles.conditionNeeds}>
                        {analysis.result.conditionAssessment.needsSupport
                          ? "Cần hỗ trợ"
                          : "Không cần hỗ trợ"}
                      </Text>
                    </View>
                    <View style={styles.bodyGold}>
                      <Text style={styles.bodyText}>
                        {analysis.result.conditionAssessment.assessment}
                      </Text>
                    </View>
                  </PlaqueCard>
                </>
              )}
            </View>
          );
        })
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
  imageBlock: {
    gap: 10,
  },
  thumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 2,
    marginBottom: 6,
    backgroundColor: Colors.jadeLight,
  },
  imgDataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  imgDataItem: {
    flex: 1,
    alignItems: "center",
  },
  imgDataLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.inkSoft,
  },
  imgDataValue: {
    fontFamily: Font.bold,
    fontSize: 16,
    marginTop: 2,
  },
  imgDataDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.line,
  },
  detectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  detectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  detectionBadgeText: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.paper,
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
    fontSize: 13,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 2,
  },
  severityText: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.paper,
    letterSpacing: 0.5,
  },
  conditionBar: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
  },
  conditionSeverity: {
    fontFamily: Font.bold,
    fontSize: 15,
    color: Colors.paper,
  },
  conditionNeeds: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.paper,
    marginTop: 2,
    opacity: 0.85,
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
  trendBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: "center",
  },
  trendGrid: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    backgroundColor: Colors.paper,
  },
  trendGridItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  trendLabel: {
    fontFamily: Font.regular,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.inkSoft,
  },
  trendValue: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.ink,
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  sectionLabel: {
    fontFamily: Font.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.inkSoft,
    marginBottom: 4,
  },
});
