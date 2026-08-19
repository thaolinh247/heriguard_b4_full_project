import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";
import { analyzeTrendsWithGemini } from "@/lib/gemini";
import type { TrendAnalysis, TrendDataPoint } from "@/types/gemini";

const DIRECTION_UI: Record<string, { label: string; color: string }> = {
  improving: { label: "Cải thiện", color: Colors.jade },
  stable: { label: "Ổn định", color: Colors.gold },
  deteriorating: { label: "Xuống cấp", color: Colors.lacquer },
};

interface Props {
  points: TrendDataPoint[];
  title: string;
  emptyText: string;
  /** Tên điểm chụp để AI phân tích đúng ngữ cảnh */
  context?: string;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * AI phân tích sự thay đổi theo ngày — CHỈ dùng real Gemini API.
 * Không có mock fallback.
 * - Có API key: gọi `analyzeTrendsWithGemini` — phân tích chi tiết theo context
 * - Không có key: hiển thị hướng dẫn cấu hình trong Cài đặt
 * - Lỗi API: hiển thị lỗi rõ ràng, cho phép thử lại
 */
export function DayTrendCard({ points, title, emptyText, context }: Props) {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    result: TrendAnalysis | null;
  }>({ loading: false, error: null, result: null });
  const hasAutoRun = useRef(false);

  const doAnalyze = async () => {
    if (!geminiApiKey) {
      setState({
        loading: false,
        error: "Cần cấu hình API key Gemini trong Cài đặt để phân tích xu hướng.",
        result: null,
      });
      return;
    }
    setState({ loading: true, error: null, result: null });
    try {
      const result = await analyzeTrendsWithGemini(geminiApiKey, context ?? null, points);
      setState({ loading: false, error: null, result });
    } catch (e) {
      console.warn("[DayTrendCard] Gemini API failed:", e);
      const msg = e instanceof Error ? e.message : "Lỗi kết nối Gemini API";
      setState({ loading: false, error: msg, result: null });
    }
  };

  const handleAnalyze = () => doAnalyze();

  // Auto-run khi có đủ data và đã có API key — CHỈ dùng real Gemini
  useEffect(() => {
    if (
      points.length >= 2 &&
      geminiApiKey &&
      !hasAutoRun.current &&
      !state.result &&
      !state.loading
    ) {
      hasAutoRun.current = true;
      doAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, geminiApiKey]);

  const canAnalyze = points.length >= 2;
  const result = state.result;

  return (
    <PlaqueCard label={title} style={styles.card}>
      {!canAnalyze && result === null ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <>
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={state.loading}
            style={[styles.btn, state.loading && styles.btnDisabled]}
          >
            {state.loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Colors.paper} />
                <Text style={styles.btnText}>Đang phân tích…</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>
                {result ? "Phân tích lại" : "Phân tích"}
              </Text>
            )}
          </TouchableOpacity>

          {!geminiApiKey && result === null && (
            <Text style={styles.apiHint}>
              Nhập API key Gemini trong Cài đặt để phân tích xu hướng bằng AI thật.
            </Text>
          )}

          {state.error && (
            <View style={[styles.bodyLacquer, { marginTop: 10 }]}>
              <Text style={styles.errorText}>{state.error}</Text>
            </View>
          )}

          {result && (
            <View style={{ marginTop: 10, gap: 10 }}>
              {(() => {
                const dir = DIRECTION_UI[result.direction];
                return (
                  <View style={[styles.severityBar, { backgroundColor: dir.color }]}>
                    <Text style={styles.severityText}>{dir.label}</Text>
                  </View>
                );
              })()}

              <View style={styles.bodyGold}>
                <Text style={styles.bodyText}>{result.summary}</Text>
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Nhiệt độ</Text>
                  <Text style={styles.gridValue}>{result.tempTrend}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Độ ẩm</Text>
                  <Text style={styles.gridValue}>{result.humidityTrend}</Text>
                </View>
                <View style={[styles.gridItem, { borderBottomWidth: 0 }]}>
                  <Text style={styles.gridLabel}>Phát hiện</Text>
                  <Text style={styles.gridValue}>{result.detectionTrend}</Text>
                </View>
              </View>

              {result.dayDetails.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Từng ngày</Text>
                  <View style={styles.daysBox}>
                    {result.dayDetails.map((d, i) => (
                      <View
                        key={`${d.date}-${i}`}
                        style={[styles.dayRow, i < result.dayDetails.length - 1 && styles.dayRowBorder]}
                      >
                        <View style={styles.dayMeta}>
                          <Text style={styles.dayName}>
                            {d.day} <Text style={styles.dayDate}>{formatDate(d.date)}</Text>
                          </Text>
                          <View style={styles.dayChips}>
                            <Text style={styles.dayChipTemp}>{d.temp.toFixed(1)}°C</Text>
                            <Text style={styles.dayChipHum}>{d.humidity.toFixed(1)}%</Text>
                            {d.detections > 0 && (
                              <View style={styles.dayChipDet}>
                                <Text style={styles.dayChipDetText}>{d.detections} phát hiện</Text>
                              </View>
                            )}
                            {d.severity !== "" && (
                              <View style={styles.dayChipSev}>
                                <Text style={styles.dayChipSevText}>{d.severity}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {d.note !== "" && <Text style={styles.dayNote}>{d.note}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {result.insights.length > 0 && (
                <View style={styles.bodyJade}>
                  {result.insights.map((ins, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.rowText}>{ins}</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.recommendations.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Khuyến nghị</Text>
                  <View style={styles.bodyGold}>
                    {result.recommendations.map((rec, i) => (
                      <View key={i} style={styles.row}>
                        <Text style={styles.bullet}>▸</Text>
                        <Text style={styles.rowText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </>
      )}
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    fontStyle: "italic",
    lineHeight: 17,
  },
  btn: {
    backgroundColor: Colors.ink,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  apiHint: {
    fontFamily: Font.regular,
    fontSize: 10,
    fontStyle: "italic",
    color: Colors.inkSoft,
    marginTop: 8,
  },
  btnText: {
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
  errorText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.lacquer,
    lineHeight: 20,
  },
  grid: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    backgroundColor: Colors.paper,
  },
  gridItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  gridLabel: {
    fontFamily: Font.regular,
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.inkSoft,
  },
  gridValue: {
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
  row: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  bullet: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.gold,
    lineHeight: 20,
  },
  rowText: {
    fontFamily: Font.regular,
    fontSize: 12,
    lineHeight: 20,
    color: Colors.ink,
    flex: 1,
  },

  // Từng ngày chi tiết
  daysBox: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    backgroundColor: Colors.paper,
    overflow: "hidden",
  },
  dayRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  dayMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  dayName: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.ink,
  },
  dayDate: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
  },
  dayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  dayChipTemp: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.lacquerDark,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  dayChipHum: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.jade,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  dayChipDet: {
    borderRadius: 8,
    backgroundColor: Colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dayChipDetText: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.paper,
  },
  dayChipSev: {
    borderRadius: 8,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dayChipSevText: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.ink,
  },
  dayNote: {
    fontFamily: Font.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.inkSoft,
  },
});