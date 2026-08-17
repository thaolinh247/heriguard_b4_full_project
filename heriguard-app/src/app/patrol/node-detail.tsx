import { View, Text, ScrollView, StyleSheet, Image } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { getNodeStorageDir } from "@/lib/fileStorage";
import {
  findPreviousImage,
  computeNodeDelta,
  getNodeTimeline,
  shouldEscalateForConsecutiveGrowth,
  type TimelinePoint,
} from "@/lib/compare";
import { SHOT_KIND_LABELS, type ShotKind, type NodeImage } from "@/types/robot";
import { Colors, Font } from "@/constants/theme";

const LABEL_COLORS: Record<string, string> = {
  crack_small: Colors.gold,
  crack_large: Colors.lacquer,
  moss: Colors.jade,
  mold: "#8E8E93",
  stain: "#6B4F8A",
};

function severityColor(severity?: string): string {
  if (severity === "high") return Colors.lacquer;
  if (severity === "medium") return Colors.gold;
  return Colors.jade;
}

function ImageCompareCard({
  title,
  image,
  timeframe,
}: {
  title: string;
  image: NodeImage | null;
  timeframe: string;
}) {
  if (!image) {
    return (
      <View style={styles.compareCard}>
        <Text style={styles.compareCardTitle}>{title}</Text>
        <View style={[styles.compareImage, styles.compareEmpty]}>
          <Text style={styles.compareEmptyText}>Chưa có ảnh</Text>
        </View>
        <Text style={styles.compareTime}>{timeframe}</Text>
      </View>
    );
  }

  const detection = image.detection;
  const severity = image.analysis?.severity;

  return (
    <View style={styles.compareCard}>
      <Text style={styles.compareCardTitle}>{title}</Text>
      {image.uri ? (
        <Image source={{ uri: image.uri }} style={styles.compareImage} resizeMode="cover" />
      ) : (
        <View style={[styles.compareImage, styles.compareEmpty]} />
      )}
      <View style={styles.compareMeta}>
        {detection && (
          <View style={styles.detectionRow}>
            <View
              style={[styles.labelDot, { backgroundColor: LABEL_COLORS[detection.label] ?? Colors.inkSoft }]}
            />
            <Text style={styles.detectionText}>
              {detection.label.replace("_", " ")} {(detection.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        )}
        {image.analysis && (
          <Text style={[styles.severityText, { color: severityColor(severity) }]}>
            {severity === "high" ? "CAO" : severity === "medium" ? "TRUNG BÌNH" : "THẤP"} ·{" "}
            {(image.analysis.crackArea ?? 0).toFixed(1)}%
          </Text>
        )}
      </View>
      <Text style={styles.compareTime}>{timeframe}</Text>
    </View>
  );
}

export default function NodeDetailScreen() {
  const { node, patrolId } = useLocalSearchParams<{ node: string; patrolId: string }>();
  const patrols = usePatrolStore((s) => s.patrols);
  const nodeX2 = Number(node ?? 0);

  const currentPatrol = patrols.find((p) => p.id === patrolId);
  // Previous patrol = right after current in newest-first list
  const currentIdx = currentPatrol ? patrols.findIndex((p) => p.id === currentPatrol.id) : -1;
  const prevPatrol = currentIdx >= 0 ? patrols[currentIdx + 1] ?? null : null;

  const currentImages = (currentPatrol?.images ?? []).filter((i) => i.nodeX2 === nodeX2);
  const sortedCurrent = [...currentImages].sort((a, b) => b.frameId - a.frameId);
  const currentWide = sortedCurrent.find((i) => i.shotKind === 0) ?? sortedCurrent[0];

  const previousWide = currentWide ? findPreviousImage(currentWide, prevPatrol) : null;
  const delta = currentWide ? computeNodeDelta(currentWide, previousWide) : null;

  const shotForTimeline: ShotKind = (currentWide?.shotKind ?? 0) as ShotKind;
  const timeline: TimelinePoint[] = getNodeTimeline(patrols, nodeX2, shotForTimeline);
  const escalating = shouldEscalateForConsecutiveGrowth(patrols, nodeX2, shotForTimeline);
  const maxArea = Math.max(...timeline.map((p) => p.area), 1);

  const shots = [...new Set(currentImages.map((i) => i.shotKind))] as ShotKind[];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Node {nodeX2}</Text>
        <Text style={styles.subtitle}>
          Vị trí {(nodeX2 * 0.5).toFixed(1)}m — so sánh giữa các lần tuần tra
        </Text>

        {currentWide && (
          <View style={styles.compareRow}>
            <ImageCompareCard
              title="Lần trước"
              image={previousWide}
              timeframe={prevPatrol ? new Date(prevPatrol.startTime).toLocaleDateString("vi-VN") : "—"}
            />
            <ImageCompareCard
              title="Gần nhất"
              image={currentWide}
              timeframe={
                currentPatrol ? new Date(currentPatrol.startTime).toLocaleDateString("vi-VN") : "—"
              }
            />
          </View>
        )}

        {delta && currentWide && (
          <PlaqueCard label="So sánh" style={styles.deltaCard}>
            <View style={styles.deltaRow}>
              <View style={styles.deltaItem}>
                <Text style={[styles.deltaValue, { color: delta.trend === "increasing" ? Colors.lacquer : Colors.jade }]}>
                  {delta.trend === "increasing"
                    ? `▲ +${Math.abs(delta.deltaAreaPercent).toFixed(1)}%`
                    : delta.trend === "decreasing"
                      ? `▼ -${Math.abs(delta.deltaAreaPercent).toFixed(1)}%`
                      : "➡ 0%"}
                </Text>
                <Text style={styles.deltaLabel}>Diện tích</Text>
              </View>
              <View style={styles.deltaDivider} />
              <View style={styles.deltaItem}>
                <Text style={styles.deltaValue}>
                  {delta.deltaConfidence >= 0 ? "+" : ""}
                  {delta.deltaConfidence.toFixed(2)}
                </Text>
                <Text style={styles.deltaLabel}>Độ tin cậy</Text>
              </View>
              <View style={styles.deltaDivider} />
              <View style={styles.deltaItem}>
                <Text style={styles.deltaValue}>
                  {delta.deltaTemperature >= 0 ? "+" : ""}
                  {delta.deltaTemperature.toFixed(1)}°C
                </Text>
                <Text style={styles.deltaLabel}>Nhiệt độ</Text>
              </View>
            </View>
            <Text style={[styles.summaryText, { color: delta.trend === "increasing" ? Colors.lacquer : Colors.jade }]}>
              {delta.trend === "increasing"
                ? "Vết nứt đang mở rộng — cần chú ý"
                : delta.trend === "decreasing"
                  ? "Vết nứt thu nhỏ — ổn"
                  : "Trạng thái ổn định"}
            </Text>
          </PlaqueCard>
        )}

        <PlaqueCard label="Xu hướng" style={styles.timelineCard}>
          {timeline.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có dữ liệu so sánh</Text>
          ) : (
            <>
              <View style={styles.timelineRow}>
                {timeline.map((p, i) => (
                  <View key={`${p.patrolId}-${i}`} style={styles.timelineCol}>
                    <Text style={styles.timelineValue}>{p.area.toFixed(1)}%</Text>
                    <View
                      style={[
                        styles.timelineBar,
                        { height: Math.max(8, (p.area / maxArea) * 80), backgroundColor: severityColor(p.severity) },
                      ]}
                    />
                    <Text style={styles.timelineLabel}>
                      Lần {i + 1}
                      {"\n"}
                      {new Date(p.timestamp).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                    </Text>
                  </View>
                ))}
              </View>
              {escalating && (
                <Text style={styles.escalateText}>
                  ⚠ Diện tích tăng liên tiếp qua {timeline.length} lần tuần tra — nên kiểm tra trực tiếp
                </Text>
              )}
            </>
          )}
        </PlaqueCard>

        {shots.length > 1 && (
          <PlaqueCard label="Các góc chụp" style={styles.shotsCard}>
            <View style={styles.shotsRow}>
              {shots.map((k) => (
                <View key={k} style={styles.shotChip}>
                  <Text style={styles.shotChipText}>{SHOT_KIND_LABELS[k]}</Text>
                  <Text style={styles.shotChipCount}>
                    {currentImages.filter((i) => i.shotKind === k).length} ảnh
                  </Text>
                </View>
              ))}
            </View>
          </PlaqueCard>
        )}

        <PlaqueCard label="Lưu trữ tại node" style={styles.storageCard}>
          <Text style={styles.storagePath}>{getNodeStorageDir(patrolId, nodeX2)}</Text>
          <Text style={styles.storageDetail}>
            {currentImages.length} ảnh trong tuần tra này · shot_{currentWide?.shotKind ?? 0}_0000.jpg …
            — mỗi node một thư mục riêng, giữ nguyên qua các lần tuần tra để so sánh
          </Text>
        </PlaqueCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  content: { padding: 16, paddingTop: 52 },
  title: { fontFamily: Font.bold, fontSize: 20, color: Colors.ink, marginBottom: 2 },
  subtitle: { fontFamily: Font.regular, fontSize: 12, color: Colors.inkSoft, marginBottom: 16 },
  compareRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  compareCard: { flex: 1, backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.line, borderRadius: 2, padding: 10 },
  compareCardTitle: { fontFamily: Font.bold, fontSize: 11, color: Colors.ink, marginBottom: 6 },
  compareImage: { width: "100%", height: 110, backgroundColor: Colors.jadeLight, borderRadius: 2 },
  compareEmpty: { alignItems: "center", justifyContent: "center" },
  compareEmptyText: { fontFamily: Font.regular, fontSize: 10, color: Colors.inkSoft },
  compareMeta: { marginTop: 6, gap: 2 },
  detectionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  detectionText: { fontFamily: Font.regular, fontSize: 9, color: Colors.ink },
  severityText: { fontFamily: Font.bold, fontSize: 9 },
  compareTime: { fontFamily: Font.regular, fontSize: 9, color: Colors.inkSoft, marginTop: 4 },
  deltaCard: { padding: 14, marginBottom: 14 },
  deltaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  deltaItem: { alignItems: "center" },
  deltaValue: { fontFamily: Font.bold, fontSize: 18, fontWeight: "600", color: Colors.ink },
  deltaLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginTop: 2,
  },
  deltaDivider: { width: 1, height: 30, backgroundColor: Colors.line },
  summaryText: { fontFamily: Font.bold, fontSize: 12, textAlign: "center", marginTop: 10 },
  timelineCard: { padding: 14, marginBottom: 14 },
  timelineRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  timelineCol: { flex: 1, alignItems: "center", gap: 3 },
  timelineValue: { fontFamily: Font.regular, fontSize: 9, color: Colors.inkSoft },
  timelineBar: { width: "100%", maxWidth: 34, borderRadius: 2 },
  timelineLabel: {
    fontFamily: Font.regular,
    fontSize: 8,
    color: Colors.inkSoft,
    textAlign: "center",
  },
  escalateText: { fontFamily: Font.bold, fontSize: 10, color: Colors.lacquer, marginTop: 10, textAlign: "center" },
  shotsCard: { padding: 14 },
  shotsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  shotChip: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  shotChipText: { fontFamily: Font.bold, fontSize: 10, color: Colors.ink },
  shotChipCount: { fontFamily: Font.regular, fontSize: 9, color: Colors.inkSoft },
  storageCard: { padding: 14, marginTop: 14 },
  storagePath: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    backgroundColor: Colors.jadeLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  storageDetail: { fontFamily: Font.regular, fontSize: 10, color: Colors.inkSoft, marginTop: 8, lineHeight: 15 },
  emptyText: { fontFamily: Font.regular, fontSize: 11, color: Colors.inkSoft, textAlign: "center", paddingVertical: 12 },
});