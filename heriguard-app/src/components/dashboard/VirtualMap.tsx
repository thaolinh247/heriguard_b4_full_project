import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { CAPTURE_POINTS } from "@/constants/capturePoints";
import { Colors, Font } from "@/constants/theme";
import type { MapMarker } from "@/types/robot";

const guardMap = require("../../../assets/images/guard.png");

const DOT_SIZE = 16;
const HALF_DOT = DOT_SIZE / 2;

// Bản đồ: hiển thị 2 điểm chụp cố định
const MAX_DIST = Math.max(5, ...CAPTURE_POINTS.map((p) => p.nodeX2));

function distToLeftPct(distanceX2: number): `${number}%` {
  return `${Math.min(92, Math.max(8, (distanceX2 / MAX_DIST) * 100))}%`;
}

export function VirtualMap() {
  const router = useRouter();
  const patrols = usePatrolStore((s) => s.patrols);

  // Lấy marker từ lần tuần tra gần nhất cho điểm chụp
  const latestPatrol = patrols.length > 0 ? patrols[0] : null;
  const markerForPoint = (nodeX2: number): MapMarker | null =>
    latestPatrol?.mapMarkers.find((m) => m.distanceX2 === nodeX2) ?? null;

  return (
    <PlaqueCard label="Bản đồ mô phỏng">
      <View style={styles.mapArea}>
        {/* Ảnh guard làm bản đồ nền */}
        <View style={styles.imageClip}>
          <Image source={guardMap} style={styles.mapImage} resizeMode="cover" />
        </View>

        {/* Đường tuần tra */}
        <View style={styles.path} />

        {/* 2 ĐIỂM CHỤP cố định — điểm dừng duy nhất */}
        {CAPTURE_POINTS.map((point) => {
          const marker = markerForPoint(point.nodeX2);
          const confidence = marker ? marker.confidence : 0;
          return (
            <TouchableOpacity
              key={`point-${point.id}`}
              style={[
                styles.marker,
                { left: distToLeftPct(point.nodeX2) },
              ]}
              onPress={() =>
                router.push({ pathname: "/capture-point/[id]", params: { id: point.id } })
              }
              activeOpacity={0.6}
            >
              <Text style={styles.distLabel}>{point.distanceLabel}</Text>
              <View
                style={[
                  styles.pointDot,
                  !marker && styles.pointDotEmpty,
                ]}
              >
                {confidence > 0 && (
                  <Text style={styles.confBadge}>{confidence}%</Text>
                )}
              </View>
              <Text style={styles.pointTag}>ĐC{point.id}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: Colors.gold }]} />
        <Text style={styles.legendText}>Điểm chụp — điểm dừng cố định (chạm để xem)</Text>
      </View>
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  mapArea: {
    height: 190,
    borderRadius: 4,
    position: "relative",
  },
  imageClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: Colors.jadeLight,
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  path: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(42,36,32,0.28)",
    transform: [{ translateY: -1 }],
  },
  marker: {
    position: "absolute",
    top: "50%",
    alignItems: "center",
    transform: [{ translateX: -HALF_DOT }, { translateY: -13 }],
    zIndex: 2,
  },
  pointDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.gold,
    borderWidth: 2,
    borderColor: Colors.paper,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  pointDotEmpty: {
    backgroundColor: Colors.goldLight,
    borderColor: Colors.gold,
    borderWidth: 2,
  },
  pointTag: {
    fontFamily: Font.bold,
    fontSize: 8,
    color: Colors.gold,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  confBadge: {
    fontFamily: Font.bold,
    fontSize: 7,
    color: Colors.paper,
  },
  distLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    color: Colors.inkSoft,
    marginBottom: 1,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
  },
});