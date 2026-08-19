import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { DayTrendCard } from "@/components/dashboard/DayTrendCard";
import { usePatrolStore } from "@/store/patrolStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCapturePoint } from "@/constants/capturePoints";
import {
  buildDayBlocks,
  blocksToTrendPoints,
} from "@/lib/daySummary";
import { analyzeDaySummaryWithGemini } from "@/lib/gemini";
import { hasDemoPatrols, useDemoBlocks } from "@/lib/sim/demoView";
import { Colors, Font } from "@/constants/theme";
import type { CrackSeverity } from "@/types/robot";
import type { DayBlock } from "@/lib/daySummary";
import { SHOT_KIND_LABELS } from "@/types/robot";

const SEVERITY_COLOR: Record<CrackSeverity, string> = {
  low: Colors.jade,
  medium: Colors.gold,
  high: Colors.lacquer,
};

const SEVERITY_LABEL: Record<CrackSeverity, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

/* ─── 1 NGÀY TỔNG QUAN ──────────────────────────────────────── */

function DayOverviewCard({
  block,
  dayNumber,
  previousSummary,
}: {
  block: DayBlock;
  dayNumber: number;
  previousSummary: string | null;
}) {
  const allImages = block.clusters.flatMap((c) => c.images);
  // Luôn hiển thị đúng 2 ảnh: 1 wide (shotKind=0) + 1 zoom (shotKind>=1), khác URI
  const sortedImages = [...allImages].sort((a, b) => a.shotKind - b.shotKind);
  const wideImage = sortedImages.find((i) => i.shotKind === 0)
    ?? sortedImages.find((i) => i.shotKind === 1)
    ?? sortedImages[0];
  const zoomImage = sortedImages.find(
    (i) => i.shotKind >= 1 && i !== wideImage && i.uri !== wideImage?.uri
  )
    ?? sortedImages.find((i) => i !== wideImage && i.uri !== wideImage?.uri);
  const displayImages: typeof allImages = [
    ...(wideImage ? [wideImage] : []),
    ...(zoomImage ? [zoomImage] : []),
  ];
  const area = block.avgAreaPercent;
  const severity = block.worstSeverity;
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiSummary = async () => {
    if (!geminiApiKey) {
      setAiError("Cần API key Gemini trong Cài đặt để dùng phân tích AI.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = await analyzeDaySummaryWithGemini(
        geminiApiKey,
        block.dayKey,
        block.clusters,
        previousSummary
      );
      setAiSummary(summary);
    } catch (e: any) {
      console.warn("[DayOverviewCard] AI summary failed:", e);
      setAiError(e?.message ?? "Lỗi API Gemini");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.overviewCard}>
      {/* Day badge */}
      <View style={styles.overviewBadge}>
        <Text style={styles.overviewBadgeText}>NGÀY {dayNumber}</Text>
      </View>

      {/* Ảnh: wide (di tích) + zoom (vết nứt) */}
      <View style={styles.overviewImageRow}>
        {displayImages.map((img) => (
          <View key={img.frameId} style={styles.overviewImageWrap}>
            {imgErrors[img.frameId] ? (
              <View style={[styles.overviewImage, styles.overviewImagePlaceholder]}>
                <Text style={styles.placeholderText}>{SHOT_KIND_LABELS[img.shotKind]}</Text>
              </View>
            ) : (
              <Image
                source={{ uri: img.uri }}
                style={styles.overviewImage}
                resizeMode="cover"
                onError={() => setImgErrors((prev) => ({ ...prev, [img.frameId]: true }))}
              />
            )}
            {/* Shot kind label */}
            <View style={styles.imageOverlay}>
              <Text style={styles.overlayTime}>{SHOT_KIND_LABELS[img.shotKind]}</Text>
            </View>
            {/* Severity indicator */}
            {img.analysis?.severity && (
              <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLOR[img.analysis.severity] }]}>
                <Text style={styles.severityDotText}>{SEVERITY_LABEL[img.analysis.severity]}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Data row */}
      <View style={styles.overviewDataRow}>
        <View style={styles.overviewDataItem}>
          <Text style={styles.overviewDataLabel}>NHIỆT ĐỘ</Text>
          <Text style={[styles.overviewDataValue, { color: Colors.lacquerDark }]}>
            {allImages.length > 0
              ? (allImages.reduce((s, i) => s + i.temperature, 0) / allImages.length).toFixed(1)
              : "—"}
            °C
          </Text>
        </View>
        <View style={styles.overviewDataDivider} />
        <View style={styles.overviewDataItem}>
          <Text style={styles.overviewDataLabel}>ĐỘ ẨM</Text>
          <Text style={[styles.overviewDataValue, { color: Colors.jade }]}>
            {allImages.length > 0
              ? (allImages.reduce((s, i) => s + i.humidity, 0) / allImages.length).toFixed(1)
              : "—"}
            %
          </Text>
        </View>
        <View style={styles.overviewDataDivider} />
        <View style={styles.overviewDataItem}>
          <Text style={styles.overviewDataLabel}>PHÁT HIỆN</Text>
          <Text style={[styles.overviewDataValue, { color: severity ? SEVERITY_COLOR[severity] : Colors.inkSoft }]}>
            {block.detectionCount > 0 ? `${block.detectionCount} ảnh` : "Sạch"}
          </Text>
        </View>
        {area != null && (
          <>
            <View style={styles.overviewDataDivider} />
            <View style={styles.overviewDataItem}>
              <Text style={styles.overviewDataLabel}>DIỆN TÍCH NỨT</Text>
              <Text style={[styles.overviewDataValue, { color: Colors.lacquer }]}>
                {area.toFixed(1)}%
              </Text>
            </View>
          </>
        )}
      </View>

      {/* AI summary */}
      <View style={styles.overviewSummary}>
        {aiSummary ? (
          <View style={styles.aiSummaryBox}>
            <Text style={styles.aiSummaryLabel}>Phân tích AI</Text>
            <Text style={styles.overviewSummaryText}>{aiSummary}</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleAiSummary}
              disabled={aiLoading}
              style={[styles.aiBtn, aiLoading && styles.aiBtnDisabled]}
            >
              {aiLoading ? (
                <View style={styles.aiLoadingRow}>
                  <ActivityIndicator size="small" color={Colors.paper} />
                  <Text style={styles.aiBtnText}>Đang phân tích…</Text>
                </View>
              ) : (
                <Text style={styles.aiBtnText}>Tóm tắt bằng AI</Text>
              )}
            </TouchableOpacity>
            {aiError && (
              <Text style={styles.aiErrorText}>{aiError}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

/* ─── MAIN SCREEN ───────────────────────────────────────────── */

export default function CapturePointScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pointId = Number(id);
  const point = getCapturePoint(pointId);
  const patrols = usePatrolStore((s) => s.patrols);

  // Chế độ demo: dữ liệu mẫu CỐ ĐỊNH (3 ngày × 2 ảnh wide/zoom) — không đụng store
  const isDemo = hasDemoPatrols(patrols);
  const demoBlocks = useDemoBlocks(point?.nodeX2 ?? 1, isDemo);

  if (!point) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: "Điểm chụp" }} />
        <View style={styles.content}>
          <Text style={styles.emptyText}>Không tìm thấy điểm chụp</Text>
        </View>
      </View>
    );
  }

  const blocks = isDemo ? (demoBlocks ?? []) : buildDayBlocks(patrols, point.nodeX2);
  const demoLoading = isDemo && demoBlocks === null;
  const trendPoints = blocksToTrendPoints(blocks);
  const hasData = blocks.length > 0;

  // Hiển thị tối đa 3 ngày gần nhất
  const displayBlocks = blocks.slice(0, 3);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: point.label }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📍</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{point.label}</Text>
            <Text style={styles.headerSubtitle}>
              {point.distanceLabel} · {point.description}
            </Text>
          </View>
        </View>

        {demoLoading ? (
          <View style={styles.demoLoading}>
            <ActivityIndicator color={Colors.jade} />
            <Text style={styles.demoLoadingText}>Đang tải dữ liệu mẫu…</Text>
          </View>
        ) : hasData ? (
          <>
            {/* Phân tích xu hướng theo ngày */}
            <DayTrendCard
              title="AI phân tích xu hướng theo ngày"
              points={trendPoints}
              context={`${point.label} (${point.distanceLabel})`}
              emptyText={
                displayBlocks.length < 2
                  ? "Cần ít nhất 2 ngày để phân tích xu hướng."
                  : "Nhấn nút để AI phân tích sự thay đổi theo ngày tại điểm chụp này."
              }
            />

            <Text style={styles.sectionTitle}>Lịch sử theo ngày</Text>
            <Text style={styles.sectionSubtitle}>
              Mỗi ngày 2 ảnh (wide di tích + zoom vết nứt) + dữ liệu môi trường
            </Text>

            {displayBlocks.map((block, i) => {
              const prevIdx = i + 1;
              const prevSummary = prevIdx < displayBlocks.length
                ? displayBlocks[prevIdx].summary
                : null;
              return (
                <DayOverviewCard
                  key={block.dayKey}
                  block={block}
                  dayNumber={displayBlocks.length - i}
                  previousSummary={prevSummary}
                />
              );
            })}
          </>
        ) : (
          <PlaqueCard label="Chưa có dữ liệu" style={styles.emptyCard}>
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📷</Text>
              <Text style={styles.emptyTitle}>Chưa có ảnh tại điểm này</Text>
              <Text style={styles.emptyDesc}>
                Khi robot dừng tại {point.distanceLabel}, M-Vision sẽ chụp 2 ảnh (rộng + chi tiết)
                kèm dữ liệu nhiệt độ/độ ẩm. Ảnh sẽ được lưu vào đây theo ngày.
              </Text>
              <Text style={[styles.emptyDesc, { marginTop: 8, fontStyle: "italic" }]}>
                Dữ liệu mẫu đã được tải sẵn để demo.
              </Text>
            </View>
          </PlaqueCard>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Điểm chụp cố định — robot tự chụp khi dừng, dữ liệu tích lũy theo ngày
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── STYLES ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    padding: 16,
    paddingTop: 12,
    gap: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 4,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    fontSize: 18,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Font.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  headerSubtitle: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.ink,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: -8,
  },

  // Day Overview Card
  overviewCard: {
    backgroundColor: Colors.paper,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: "hidden",
  },
  overviewBadge: {
    backgroundColor: Colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  overviewBadgeText: {
    fontFamily: Font.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.paper,
  },
  overviewImageRow: {
    flexDirection: "row",
    gap: 2,
    padding: 8,
    paddingBottom: 0,
  },
  overviewImageWrap: {
    flex: 1,
    position: "relative",
  },
  overviewImage: {
    width: "100%",
    height: 120,
    borderRadius: 4,
    backgroundColor: Colors.jadeLight,
  },
  overviewImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
  },
  imageOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(20,26,24,0.7)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  overlayTime: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.paper,
  },
  severityDot: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  severityDotText: {
    fontFamily: Font.bold,
    fontSize: 8,
    color: Colors.paper,
  },

  // Data row
  overviewDataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    marginTop: 8,
  },
  overviewDataItem: {
    flex: 1,
    alignItems: "center",
  },
  overviewDataLabel: {
    fontFamily: Font.regular,
    fontSize: 7,
    letterSpacing: 0.8,
    color: Colors.inkSoft,
  },
  overviewDataValue: {
    fontFamily: Font.bold,
    fontSize: 13,
    marginTop: 2,
  },
  overviewDataDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.line,
  },

  // Summary
  overviewSummary: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
  },
  overviewSummaryText: {
    fontFamily: Font.regular,
    fontSize: 11,
    lineHeight: 17,
    color: Colors.ink,
  },
  aiSummaryBox: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.jade,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  aiSummaryLabel: {
    fontFamily: Font.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.jade,
    marginBottom: 4,
  },
  aiBtn: {
    backgroundColor: Colors.ink,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center",
  },
  aiBtnDisabled: {
    opacity: 0.6,
  },
  aiBtnText: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.paper,
    letterSpacing: 0.3,
  },
  aiLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiErrorText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.lacquer,
    marginTop: 4,
  },

  // Empty state
  emptyCard: {
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.ink,
    marginBottom: 6,
  },
  emptyDesc: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    lineHeight: 18,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 0.3,
  },

  // Empty text (legacy)
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    fontStyle: "italic",
    lineHeight: 18,
    paddingVertical: 8,
  },

  // Demo loading
  demoLoading: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  demoLoadingText: {
    fontFamily: Font.regular,
    fontSize: 11,
    fontStyle: "italic",
    color: Colors.inkSoft,
  },
});
