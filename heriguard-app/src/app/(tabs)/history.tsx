import { View, Text, ScrollView, StyleSheet, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { computeNodeDelta } from "@/lib/compare";
import type { NodeImage } from "@/types/robot";
import { Colors, Font } from "@/constants/theme";

const LABEL_COLORS: Record<string, string> = {
  crack_small: Colors.gold,
  crack_large: Colors.lacquer,
  moss: Colors.jade,
  mold: Colors.inkSoft,
  stain: "#6B4F8A",
};

function severityColor(severity?: string): string {
  if (severity === "high") return Colors.lacquer;
  if (severity === "medium") return Colors.gold;
  return Colors.jade;
}

/**
 * Lưu trữ theo node: mỗi node 1 thẻ, ảnh từng lần tuần tra ngang hàng
 * kèm Δ so với lần trước (diện tích vết nứt). Chạm vào → so sánh chi tiết.
 */
interface NodeArchiveEntry {
  patrolId: string;
  patrolDate: Date;
  image: NodeImage;
}

function buildNodeArchive(patrols: ReturnType<typeof usePatrolStore.getState>["patrols"]) {
  const nodes = new Map<number, NodeArchiveEntry[]>();
  for (const patrol of patrols) {
    const seen = new Map<number, NodeImage>();
    // Ưu tiên shot wide (0), giữ 1 ảnh/node/lần tuần tra
    const sorted = [...patrol.images].sort((a, b) => {
      if (a.nodeX2 !== b.nodeX2) return a.nodeX2 - b.nodeX2;
      const kindDiff = (a.shotKind === 0 ? 0 : 1) - (b.shotKind === 0 ? 0 : 1);
      if (kindDiff !== 0) return kindDiff;
      return b.frameId - a.frameId;
    });
    for (const image of sorted) {
      if (seen.has(image.nodeX2)) continue;
      seen.set(image.nodeX2, image);
    }
    seen.forEach((image, nodeX2) => {
      const list = nodes.get(nodeX2) ?? [];
      list.push({ patrolId: patrol.id, patrolDate: new Date(patrol.startTime), image });
      nodes.set(nodeX2, list);
    });
  }
  // Node tăng dần, trong node: mới nhất trước
  for (const [, list] of nodes) list.sort((a, b) => b.patrolDate.getTime() - a.patrolDate.getTime());
  return [...nodes.entries()].sort((a, b) => a[0] - b[0]);
}

function DeltaLabel({ areaPercent }: { areaPercent: number }) {
  const increasing = areaPercent > 5;
  const decreasing = areaPercent < -5;
  const color = increasing ? Colors.lacquer : decreasing ? Colors.jade : Colors.inkSoft;
  const text = increasing
    ? `▲ +${Math.abs(areaPercent).toFixed(1)}%`
    : decreasing
      ? `▼ -${Math.abs(areaPercent).toFixed(1)}%`
      : "➡ 0%";
  return <Text style={[styles.deltaLabel, { color }]}>{text}</Text>;
}

export default function HistoryScreen() {
  const router = useRouter();
  const patrols = usePatrolStore((s) => s.patrols);
  const allDetections = useDetectionStore((s) => s.detections);
  const chartData = useDashboardStore((s) => s.chartData);

  const hasPatrolData = patrols.length > 0;

  const rows = hasPatrolData
    ? patrols.flatMap((p) =>
        p.sensorLogs.map((s, i) => {
          const det = allDetections.find(
            (d) => d.patrolId === p.id && d.timestamp === s.timestamp
          );
          return {
            id: `${p.id}-${i}`,
            time: new Date(s.timestamp).toLocaleTimeString("vi-VN"),
            temp: s.temperature,
            humidity: s.humidity,
            risk: (
              s.humidity > 75 || s.temperature > 30
                ? "high"
                : s.humidity > 68 || s.temperature > 28
                  ? "medium"
                  : "low"
            ) as "low" | "medium" | "high",
            detection: det,
          };
        })
      ).reverse()
    : chartData.length > 0
      ? chartData.slice().reverse().map((p, i) => ({
          id: String(i),
          time: p.time,
          temp: p.temp,
          humidity: p.humidity,
          risk: (
            p.humidity > 75 || p.temp > 30
              ? "high"
              : p.humidity > 68 || p.temp > 28
                ? "medium"
                : "low"
          ) as "low" | "medium" | "high",
          detection: null,
        }))
      : [];

  const summary = hasPatrolData
    ? {
        total: patrols.length,
        detections: allDetections.length,
        highConfidence: allDetections.filter((d) => d.confidence > 0.75).length,
      }
    : null;

  const RISK_DOT: Record<string, string> = {
    low: Colors.jade,
    medium: Colors.gold,
    high: Colors.lacquer,
  };

  const nodeArchive = buildNodeArchive(patrols);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lịch sử đo</Text>
      <Text style={styles.subtitle}>Các lần tuần tra và phát hiện</Text>

      {/* ── Lưu trữ theo node (so sánh các lần tuần tra cùng node) ── */}
      {nodeArchive.length > 0 && (
        <PlaqueCard label="Lưu trữ theo node" style={styles.archiveCard}>
          {nodeArchive.map(([nodeX2, entries]) => {
            const previous = entries[1] ?? null;
            const latest = entries[0]?.image ?? null;
            const delta = latest && previous ? computeNodeDelta(latest, previous.image) : null;
            const deltaArea = delta?.deltaAreaPercent ?? 0;
            return (
              <Pressable
                key={nodeX2}
                style={({ pressed }) => [styles.nodeItem, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  router.push(
                    `/patrol/node-detail?patrolId=${entries[0].patrolId}&node=${nodeX2}`
                  )
                }
              >
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeTitle}>Node {nodeX2}</Text>
                  <Text style={styles.nodeMeta}>
                    {(nodeX2 * 0.5).toFixed(1)}m · {entries.length} lần tuần tra
                  </Text>
                  {delta && <DeltaLabel areaPercent={deltaArea} />}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {entries.map((entry, index) => {
                    const isLatest = index === 0;
                    const prevEntry = entries[index + 1] ?? null;
                    const entryDelta = isLatest && prevEntry ? computeNodeDelta(entry.image, prevEntry.image) : null;
                    return (
                      <View key={`${entry.patrolId}-${nodeX2}`} style={styles.nodeShot}>
                        <View style={styles.nodeThumbWrap}>
                          {entry.image.uri && (
                            <Image
                              source={{ uri: entry.image.uri }}
                              style={styles.nodeThumb}
                              resizeMode="cover"
                            />
                          )}
                          <View
                            style={[
                              styles.nodeSeverityBar,
                              { backgroundColor: severityColor(entry.image.analysis?.severity) },
                            ]}
                          />
                        </View>
                        <Text style={styles.nodeShotDate}>
                          {isLatest ? "Mới nhất" : `Lần ${index + 1}`}
                          {"\n"}
                          {entry.patrolDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                        </Text>
                        {entryDelta && <DeltaLabel areaPercent={entryDelta.deltaAreaPercent} />}
                        {entry.image.detection && (
                          <Text style={styles.nodeShotDetect}>
                            {(entry.image.detection.confidence * 100).toFixed(0)}%
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </Pressable>
            );
          })}
        </PlaqueCard>
      )}

      {summary && (
        <PlaqueCard label="Tổng quan" style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.total}</Text>
              <Text style={styles.summaryLabel}>Lần tuần tra</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{summary.detections}</Text>
              <Text style={styles.summaryLabel}>Phát hiện</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: Colors.lacquer }]}>
                {summary.highConfidence}
              </Text>
              <Text style={styles.summaryLabel}>Nguy cơ cao</Text>
            </View>
          </View>
        </PlaqueCard>
      )}

      {/* ── Patrol list with node summaries (Phase C) ── */}
      {hasPatrolData && (
        <PlaqueCard label="Các lần tuần tra" style={styles.patrolCard}>
          {patrols.map((p) => {
            const nodeCount = new Set(p.images.map((i) => i.nodeX2)).size;
            const worstSeverity = [...p.images]
              .map((i) => i.analysis?.severity)
              .filter(Boolean)
              .sort((a, b) => (a === "high" ? 1 : a === "medium" ? 0 : -1) - (b === "high" ? 1 : b === "medium" ? 0 : -1))
              .at(-1);

            const issueNodes = [...new Set(p.detections.map((d) => d.nodeX2))];

            return (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.patrolItem, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/patrol/${p.id}`)}
              >
                <View style={styles.patrolRow}>
                  <Text style={styles.patrolName}>
                    Tuần tra {new Date(p.startTime).toLocaleDateString("vi-VN")}
                  </Text>
                  <View
                    style={[
                      styles.worstDot,
                      { backgroundColor: severityColor(worstSeverity as string | undefined) },
                    ]}
                  />
                </View>
                <Text style={styles.patrolTime}>
                  {new Date(p.startTime).toLocaleTimeString("vi-VN")} —{" "}
                  {p.endTime ? new Date(p.endTime).toLocaleTimeString("vi-VN") : "đang chạy"} ·{" "}
                  {nodeCount} node · {p.images.length} ảnh
                </Text>
                {issueNodes.length > 0 && (
                  <Text style={styles.patrolIssues}>
                    ⚠ Có dấu hiệu tại node {issueNodes.sort((a, b) => a - b).join(", ")}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </PlaqueCard>
      )}

      <PlaqueCard label="Bảng dữ liệu" style={styles.tableCard}>
        <View style={styles.tableRow}>
          <Text style={[styles.th, { flex: 1.5 }]}>Thời gian</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Nhiệt độ</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Độ ẩm</Text>
          <Text style={[styles.th, { flex: 0.5, textAlign: "center" }]}>Mức</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Phát hiện</Text>
        </View>
        <View style={styles.tableDivider} />

        {rows.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có dữ liệu tuần tra</Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 1.5 }]}>{row.time}</Text>
              <Text style={[styles.tdNum, { flex: 1, color: Colors.lacquerDark }]}>
                {row.temp.toFixed(1)}°C
              </Text>
              <Text style={[styles.tdNum, { flex: 1, color: Colors.jade }]}>
                {row.humidity.toFixed(1)}%
              </Text>
              <View style={{ flex: 0.5, alignItems: "center" }}>
                <View style={[styles.riskDot, { backgroundColor: RISK_DOT[row.risk] }]} />
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                {row.detection ? (
                  <View
                    style={[
                      styles.badgeDot,
                      { backgroundColor: LABEL_COLORS[row.detection.label] ?? Colors.inkSoft },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </PlaqueCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {hasPatrolData
            ? `${rows.length} bản ghi từ ${patrols.length} lần tuần tra — chạm vào tuần tra để xem chi tiết`
            : "Chế độ chờ — kết nối robot hoặc bật mô phỏng để có dữ liệu"}
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
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    marginBottom: 16,
  },
  archiveCard: {
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  nodeItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingBottom: 12,
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  nodeTitle: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.ink,
  },
  nodeMeta: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    flex: 1,
  },
  nodeShot: {
    alignItems: "center",
    marginRight: 10,
  },
  nodeThumbWrap: {
    width: 64,
    height: 48,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: Colors.jadeLight,
    position: "relative",
  },
  nodeThumb: {
    width: "100%",
    height: "100%",
  },
  nodeSeverityBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  nodeShotDate: {
    fontFamily: Font.regular,
    fontSize: 8,
    color: Colors.inkSoft,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 10,
  },
  nodeShotDetect: {
    fontFamily: Font.bold,
    fontSize: 8,
    color: Colors.lacquer,
    marginTop: 1,
  },
  deltaLabel: {
    fontFamily: Font.bold,
    fontSize: 9,
    marginTop: 2,
  },
  summaryCard: {
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryNumber: {
    fontFamily: Font.bold,
    fontSize: 22,
    fontWeight: "600",
    color: Colors.ink,
  },
  summaryLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.line,
  },
  patrolCard: {
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  patrolItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  patrolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  patrolName: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.ink,
  },
  patrolTime: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  patrolIssues: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.lacquer,
    marginTop: 2,
  },
  worstDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableCard: {
    padding: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  tableDivider: {
    height: 1,
    backgroundColor: Colors.line,
  },
  th: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.inkSoft,
  },
  td: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.ink,
  },
  tdNum: {
    fontFamily: Font.regular,
    fontSize: 11,
    textAlign: "right",
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: "center",
    paddingVertical: 24,
  },
  footer: {
    marginTop: 16,
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 0.3,
  },
});
