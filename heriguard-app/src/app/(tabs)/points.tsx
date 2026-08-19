import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { CAPTURE_POINTS, type CapturePoint } from "@/constants/capturePoints";
import { buildDayBlocks } from "@/lib/daySummary";
import { hasDemoPatrols, useDemoBlocks } from "@/lib/sim/demoView";
import { Colors, Font } from "@/constants/theme";
import type { CrackSeverity } from "@/types/robot";

const SEVERITY_COLOR: Record<CrackSeverity, string> = {
  low: Colors.jade,
  medium: Colors.gold,
  high: Colors.lacquer,
};

function PointFolderCard({ point }: { point: CapturePoint }) {
  const router = useRouter();
  const patrols = usePatrolStore((s) => s.patrols);
  const isDemo = hasDemoPatrols(patrols);
  // Chế độ demo: dữ liệu mẫu CỐ ĐỊNH (3 ngày × 2 ảnh) — không đụng store
  const demoBlocks = useDemoBlocks(point.nodeX2, isDemo);
  const blocks = isDemo ? (demoBlocks ?? []) : buildDayBlocks(patrols, point.nodeX2);
  const latest = blocks[0] ?? null;
  const totalImages = blocks.reduce(
    (s, b) => s + b.clusters.reduce((c, cl) => c + cl.images.length, 0),
    0
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.folderCard, pressed && { opacity: 0.85 }]}
      onPress={() =>
        router.push({ pathname: "/capture-point/[id]", params: { id: point.id } })
      }
    >
      <PlaqueCard style={styles.folderInner}>
        <View style={styles.folderHeader}>
          <View style={styles.folderTitleRow}>
            <View style={styles.folderNumber}>
              <Text style={styles.folderNumberText}>{point.id}</Text>
            </View>
            <View style={styles.folderTitleBlock}>
              <Text style={styles.folderTitle}>{point.label}</Text>
              <Text style={styles.folderDist}>
                {point.distanceLabel} · {point.description}
              </Text>
            </View>
          </View>
          <View style={styles.folderArrow}>
            <Text style={styles.folderArrowText}>›</Text>
          </View>
        </View>

        <View style={styles.folderStats}>
          <View style={styles.folderStat}>
            <Text style={styles.folderStatValue}>{blocks.length}</Text>
            <Text style={styles.folderStatLabel}>ngày</Text>
          </View>
          <View style={styles.folderStatDivider} />
          <View style={styles.folderStat}>
            <Text style={styles.folderStatValue}>{totalImages}</Text>
            <Text style={styles.folderStatLabel}>ảnh</Text>
          </View>
          <View style={styles.folderStatDivider} />
          <View style={styles.folderStat}>
            <Text style={styles.folderStatValue}>
              {latest?.detectionCount ?? 0}
            </Text>
            <Text style={styles.folderStatLabel}>phát hiện</Text>
          </View>
        </View>

        {isDemo && !demoBlocks ? (
          <View style={styles.folderLatest}>
            <Text style={styles.folderEmptyText}>Đang tải dữ liệu mẫu…</Text>
          </View>
        ) : latest ? (
          <View style={styles.folderLatest}>
            <View
              style={[
                styles.folderBadge,
                {
                  backgroundColor: latest.worstSeverity
                    ? SEVERITY_COLOR[latest.worstSeverity]
                    : Colors.jade,
                },
              ]}
            >
              <Text style={styles.folderBadgeText}>
                {latest.worstSeverity === "high"
                  ? "Cảnh báo"
                  : latest.worstSeverity === "medium"
                    ? "Cần chú ý"
                    : "An toàn"}
              </Text>
            </View>
            <Text style={styles.folderLatestText} numberOfLines={2}>
              {latest.summary}
            </Text>
          </View>
        ) : (
          <View style={styles.folderEmpty}>
            <Text style={styles.folderEmptyText}>
              Chưa có dữ liệu — chờ robot chụp tại điểm dừng {point.distanceLabel}
            </Text>
          </View>
        )}
      </PlaqueCard>
    </Pressable>
  );
}

export default function PointsScreen() {
  const patrols = usePatrolStore((s) => s.patrols);
  const isDemo = hasDemoPatrols(patrols);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Điểm chụp</Text>
      <Text style={styles.subtitle}>
        2 điểm dừng cố định — mỗi ngày robot chụp ảnh + dữ liệu môi trường
      </Text>

      {isDemo && (
        <Text style={styles.demoHint}>
          Đang hiển thị dữ liệu mẫu cố định: 3 ngày × 2 ảnh (wide + zoom) cho mỗi điểm chụp
        </Text>
      )}

      {CAPTURE_POINTS.map((point) => (
        <PointFolderCard key={point.id} point={point} />
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Robot tự chụp ảnh khi dừng tại 2 điểm — dữ liệu tích lũy theo ngày
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
  demoHint: {
    fontFamily: Font.regular,
    fontSize: 10,
    fontStyle: "italic",
    color: Colors.jade,
    backgroundColor: Colors.jadeLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
  },
  folderCard: {
    borderRadius: 2,
  },
  folderInner: {
    padding: 12,
  },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  folderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  folderNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  folderNumberText: {
    fontFamily: Font.bold,
    fontSize: 16,
    color: Colors.paper,
  },
  folderTitleBlock: {
    flex: 1,
  },
  folderTitle: {
    fontFamily: Font.bold,
    fontSize: 15,
    color: Colors.ink,
  },
  folderDist: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  folderArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.jadeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  folderArrowText: {
    fontFamily: Font.regular,
    fontSize: 20,
    color: Colors.jade,
    lineHeight: 22,
  },
  folderStats: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 10,
  },
  folderStat: {
    flex: 1,
    alignItems: "center",
  },
  folderStatValue: {
    fontFamily: Font.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  folderStatLabel: {
    fontFamily: Font.regular,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.inkSoft,
    marginTop: 1,
  },
  folderStatDivider: {
    width: 1,
    height: 26,
    backgroundColor: Colors.line,
  },
  folderLatest: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    gap: 6,
  },
  folderBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  folderBadgeText: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.paper,
  },
  folderLatestText: {
    fontFamily: Font.regular,
    fontSize: 11,
    lineHeight: 17,
    color: Colors.ink,
  },
  folderEmpty: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  folderEmptyText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
    fontStyle: "italic",
    lineHeight: 17,
  },
  footer: {
    marginTop: 4,
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    letterSpacing: 0.3,
    textAlign: "center",
  },
});
