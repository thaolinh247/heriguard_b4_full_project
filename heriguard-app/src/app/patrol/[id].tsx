import { View, Text, ScrollView, StyleSheet, Image, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import {
  findPreviousImage,
  computeNodeDelta,
  getNodeTimeline,
  shouldEscalateForConsecutiveGrowth,
  type TimelinePoint,
} from "@/lib/compare";
import { type ShotKind, type NodeImage } from "@/types/robot";
import { Colors, Font } from "@/constants/theme";

const LABEL_COLORS: Record<string, string> = {
  crack_small: Colors.gold,
  crack_large: Colors.lacquer,
  moss: Colors.jade,
  mold: "#8E8E93",
  stain: "#6B4F8A",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

function severityColor(severity?: string): string {
  if (severity === "high") return Colors.lacquer;
  if (severity === "medium") return Colors.gold;
  return Colors.jade;
}

function TimelineChart({
  points,
  escalating,
}: {
  points: TimelinePoint[];
  escalating: boolean;
}) {
  if (points.length === 0) {
    return (
      <Text style={styles.timelineEmpty}>Chưa có dữ liệu so sánh — lần đầu tại node này</Text>
    );
  }

  const maxArea = Math.max(...points.map((p) => p.area), 1);
  const maxBars = 6;
  const bars = points.slice(-maxBars);

  return (
    <View style={styles.timelineRow}>
      {bars.map((p, i) => {
        const height = Math.max(6, (p.area / maxArea) * 48);
        return (
          <View key={`${p.patrolId}-${i}`} style={styles.timelineCol}>
            <Text style={styles.timelineBarValue}>{p.area.toFixed(1)}%</Text>
            <View style={[styles.timelineBar, { height, backgroundColor: severityColor(p.severity) }]} />
            <Text style={styles.timelineBarLabel}>{i + 1}</Text>
          </View>
        );
      })}
      {escalating && (
        <Text style={styles.timelineEscalate}>⚠ Tăng liên tiếp {bars.length} lần</Text>
      )}
    </View>
  );
}

function NodeCard({
  nodeX2,
  images,
  allPatrols,
  currentPatrolId,
}: {
  nodeX2: number;
  images: NodeImage[];
  allPatrols: ReturnType<typeof usePatrolStore.getState>["patrols"];
  currentPatrolId: string;
}) {
  const router = useRouter();

  // Latest image = wide shot (prefer shotKind 0), else last
  const sorted = [...images].sort((a, b) => b.frameId - a.frameId);
  const latest = sorted.find((i) => i.shotKind === 0) ?? sorted[0];
  if (!latest) return null;

  const detection = latest.detection;
  const severity = latest.analysis?.severity;
  const crackArea = latest.analysis?.crackArea;

  // Previous patrol = the one right after current in newest-first list
  const currentIdx = allPatrols.findIndex((p) => p.id === currentPatrolId);
  const prevPatrol = currentIdx >= 0 ? allPatrols[currentIdx + 1] ?? null : null;
  const previous = findPreviousImage(latest, prevPatrol);
  const delta = computeNodeDelta(latest, previous);
  const shot = latest.shotKind as ShotKind;
  const timeline = getNodeTimeline(allPatrols, nodeX2, shot);
  const escalating = shouldEscalateForConsecutiveGrowth(allPatrols, nodeX2, shot);

  const isFirstVisit = timeline.length <= 1;

  return (
    <Pressable
      style={({ pressed }) => [styles.nodeCard, pressed && { opacity: 0.85 }]}
      onPress={() =>
        router.push({
          pathname: "/patrol/node-detail",
          params: { node: String(nodeX2), patrolId: currentPatrolId },
        })
      }
    >
      <View style={styles.nodeHeader}>
        <Text style={styles.nodeTitle}>Node {nodeX2} — {(nodeX2 * 0.5).toFixed(1)}m</Text>
        {severity && (
          <View style={[styles.severityBadge, { borderColor: severityColor(severity) }]}>
            <Text style={[styles.severityBadgeText, { color: severityColor(severity) }]}>
              {SEVERITY_LABELS[severity] ?? severity}
            </Text>
          </View>
        )}
      </View>

      {latest.uri ? (
        <Image source={{ uri: latest.uri }} style={styles.nodeImage} resizeMode="cover" />
      ) : (
        <View style={[styles.nodeImage, styles.nodeImageEmpty]} />
      )}

      {detection && (
        <View style={styles.nodeMeta}>
          <View style={[styles.labelDot, { backgroundColor: LABEL_COLORS[detection.label] ?? Colors.inkSoft }]} />
          <Text style={styles.nodeMetaText}>
            {detection.label.replace("_", " ")} — {(detection.confidence * 100).toFixed(0)}%
          </Text>
          <Text style={styles.nodeMetaText}>Diện tích ~{crackArea?.toFixed(1)}%</Text>
        </View>
      )}

      <View style={styles.deltaRow}>
        {isFirstVisit ? (
          <Text style={styles.deltaFirst}>Lần đầu tại node — thiết lập baseline</Text>
        ) : (
          <>
            <Text
              style={[
                styles.deltaText,
                { color: delta.trend === "increasing" ? Colors.lacquer : Colors.jade },
              ]}
            >
              {delta.trend === "increasing"
                ? `▲ ${Math.abs(delta.deltaAreaPercent).toFixed(1)}%`
                : delta.trend === "decreasing"
                  ? `▼ ${Math.abs(delta.deltaAreaPercent).toFixed(1)}%`
                  : "➡ Ổn định"}
            </Text>
            <Text style={styles.deltaDetail}>
              {delta.deltaTemperature >= 0 ? "+" : ""}
              {delta.deltaTemperature.toFixed(1)}°C · {delta.deltaHumidity >= 0 ? "+" : ""}
              {delta.deltaHumidity.toFixed(1)}%
            </Text>
          </>
        )}
      </View>

      <TimelineChart points={timeline} escalating={escalating} />

      <View style={styles.nodeFooter}>
        <Text style={styles.nodeFooterText}>{images.length} ảnh · nhiều góc</Text>
        <Text style={[styles.nodeFooterText, { color: Colors.jade }]}>Xem chi tiết ›</Text>
      </View>
    </Pressable>
  );
}

export default function PatrolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patrols = usePatrolStore((s) => s.patrols);
  const isLoading = usePatrolStore((s) => s.isLoadingHistory);
  const patrol = patrols.find((p) => p.id === id);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Đang tải dữ liệu tuần tra…</Text>
      </View>
    );
  }

  if (!patrol) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Không tìm thấy tuần tra</Text>
      </View>
    );
  }

  // Group images by node
  const nodes = [...new Set(patrol.images.map((i) => i.nodeX2))].sort((a, b) => a - b);

  const prevPatrol = patrols.find((p) => p.id !== patrol.id);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Chi tiết tuần tra</Text>
        <Text style={styles.subtitle}>
          {new Date(patrol.startTime).toLocaleString("vi-VN")} —{" "}
          {patrol.endTime
            ? new Date(patrol.endTime).toLocaleTimeString("vi-VN")
            : "đang diễn ra"}
        </Text>

        <PlaqueCard label="Tổng quan" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{nodes.length}</Text>
              <Text style={styles.summaryLabel}>Node</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{patrol.images.length}</Text>
              <Text style={styles.summaryLabel}>Ảnh</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{patrol.detections.length}</Text>
              <Text style={styles.summaryLabel}>Phát hiện</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: Colors.lacquer }]}>
                {patrol.detections.filter((d) => d.confidence > 0.75).length}
              </Text>
              <Text style={styles.summaryLabel}>Tin cậy cao</Text>
            </View>
          </View>
        </PlaqueCard>

        {nodes.length === 0 ? (
          <PlaqueCard label="Node">
            <Text style={styles.emptyText}>Tuần tra này chưa có ảnh nào</Text>
          </PlaqueCard>
        ) : (
          nodes.map((nodeX2) => (
            <NodeCard
              key={nodeX2}
              nodeX2={nodeX2}
              images={patrol.images.filter((i) => i.nodeX2 === nodeX2)}
              allPatrols={patrols}
              currentPatrolId={patrol.id}
            />
          ))
        )}

        <Text style={styles.footerText}>
          {prevPatrol
            ? "So sánh với tuần tra trước đó — chạm vào node để xem ảnh cận cảnh"
            : "Đây là tuần tra đầu tiên — các lần sau sẽ tự so sánh xu hướng"}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingTop: 52 },
  title: { fontFamily: Font.bold, fontSize: 20, color: Colors.ink, marginBottom: 2 },
  subtitle: { fontFamily: Font.regular, fontSize: 12, color: Colors.inkSoft, marginBottom: 16 },
  loadingText: { fontFamily: Font.regular, fontSize: 13, color: Colors.inkSoft },
  summaryCard: { padding: 14, marginBottom: 14 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryNumber: { fontFamily: Font.bold, fontSize: 20, fontWeight: "600", color: Colors.ink },
  summaryLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginTop: 2,
  },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.line },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 16,
  },
  nodeCard: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    padding: 14,
    marginBottom: 12,
  },
  nodeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  nodeTitle: { fontFamily: Font.bold, fontSize: 14, color: Colors.ink },
  severityBadge: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 2 },
  severityBadgeText: { fontFamily: Font.regular, fontSize: 11 },
  nodeImage: { width: "100%", height: 140, backgroundColor: Colors.jadeLight, borderRadius: 2, marginBottom: 8 },
  nodeImageEmpty: { alignItems: "center", justifyContent: "center" },
  nodeMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  labelDot: { width: 8, height: 8, borderRadius: 4 },
  nodeMetaText: { fontFamily: Font.regular, fontSize: 11, color: Colors.ink },
  deltaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  deltaFirst: { fontFamily: Font.regular, fontSize: 11, color: Colors.inkSoft },
  deltaText: { fontFamily: Font.bold, fontSize: 12 },
  deltaDetail: { fontFamily: Font.regular, fontSize: 10, color: Colors.inkSoft },
  timelineRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  timelineCol: { flex: 1, alignItems: "center", gap: 2 },
  timelineBarValue: { fontFamily: Font.regular, fontSize: 9, color: Colors.inkSoft },
  timelineBar: { width: "100%", maxWidth: 30, borderRadius: 2 },
  timelineBarLabel: { fontFamily: Font.regular, fontSize: 9, color: Colors.inkSoft },
  timelineEscalate: { fontFamily: Font.bold, fontSize: 10, color: Colors.lacquer },
  timelineEmpty: { fontFamily: Font.regular, fontSize: 10, color: Colors.inkSoft, marginBottom: 8 },
  nodeFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 8 },
  nodeFooterText: { fontFamily: Font.regular, fontSize: 10, color: Colors.inkSoft },
  footerText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 8,
  },
});