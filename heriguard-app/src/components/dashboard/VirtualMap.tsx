import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { Colors, Font } from "@/constants/theme";
import type { MapMarker } from "@/types/robot";

const guardMap = require("../../../assets/images/guard.png");

function markerTooltip(marker: MapMarker): string[] {
  const issues: string[] = [];
  if (marker.hasCrackLarge) issues.push("Nứt lớn");
  if (marker.hasCrackSmall) issues.push("Nứt nhỏ");
  if (marker.hasMoss) issues.push("Rêu");
  if (marker.hasMold) issues.push("Mốc");
  if (marker.hasStain) issues.push("Ố màu");
  if (marker.hasLowIssue) issues.push("Vấn đề nhẹ");
  if (marker.hasHighIssue) issues.push("Vấn đề nghiêm trọng");
  return issues.length > 0 ? issues : ["An toàn"];
}

const DOT_SIZE = 16;
const HALF_DOT = DOT_SIZE / 2;

export function VirtualMap() {
  const currentMapMarkers = usePatrolStore((s) => s.currentMapMarkers);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (currentMapMarkers.length === 0) {
    return (
      <PlaqueCard label="Bản đồ mô phỏng">
        <Text style={styles.empty}>Chưa có dữ liệu tuần tra</Text>
      </PlaqueCard>
    );
  }

  // Một marker cho mỗi điểm dừng của robot — giữ marker mới nhất nếu cùng vị trí
  const markers: MapMarker[] = [...currentMapMarkers].reverse().filter(
    (m, i, arr) => arr.findIndex((x) => x.distanceX2 === m.distanceX2) === i
  );

  const maxDist = Math.max(...markers.map((m) => m.distanceX2), 1);

  return (
    <PlaqueCard label="Bản đồ mô phỏng">
      <View style={styles.mapArea}>
        {/* Ảnh guard làm bản đồ nền */}
        <View style={styles.imageClip}>
          <Image source={guardMap} style={styles.mapImage} resizeMode="cover" />
        </View>

        {/* Đường tuần tra */}
        <View style={styles.path} />

        {/* Điểm dừng của robot */}
        {markers.map((marker) => {
          const leftPct = Math.min(
            92,
            Math.max(8, (marker.distanceX2 / maxDist) * 100)
          );
          const isSelected = selectedIdx === marker.distanceX2;
          return (
            <TouchableOpacity
              key={marker.distanceX2}
              style={[styles.marker, { left: `${leftPct}%` }]}
              onPress={() => setSelectedIdx(isSelected ? null : marker.distanceX2)}
              activeOpacity={0.6}
            >
              <Text style={styles.distLabel}>
                {(marker.distanceX2 * 0.5).toFixed(1)}m
              </Text>
              <View style={styles.dot}>
                {marker.confidence > 0 && (
                  <Text style={styles.confBadge}>{marker.confidence}%</Text>
                )}
              </View>
              {isSelected && (
                <View style={[styles.tooltip, { borderColor: Colors.lacquer }]}>
                  {markerTooltip(marker).map((t, j) => (
                    <Text key={j} style={styles.tooltipText}>{t}</Text>
                  ))}
                  <Text style={styles.tooltipSub}>
                    {marker.temperature.toFixed(1)}°C / {marker.humidity.toFixed(1)}%
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>
          Điểm robot dừng ({markers.length}) — chạm để xem chi tiết
        </Text>
      </View>
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
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
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.lacquer,
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
  tooltip: {
    position: "absolute",
    bottom: 30,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    minWidth: 84,
    alignItems: "center",
    zIndex: 10,
    shadowColor: Colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    fontFamily: Font.bold,
    fontSize: 10,
    color: Colors.ink,
  },
  tooltipSub: {
    fontFamily: Font.regular,
    fontSize: 9,
    color: Colors.inkSoft,
    marginTop: 2,
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
    backgroundColor: Colors.lacquer,
  },
  legendText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
  },
});