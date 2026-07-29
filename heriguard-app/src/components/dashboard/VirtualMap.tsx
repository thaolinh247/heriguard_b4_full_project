import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { usePatrolStore } from "@/store/patrolStore";
import { Colors, Font } from "@/constants/theme";
import type { MapMarker } from "@/types/robot";

function markerColor(marker: MapMarker): string {
  if (marker.hasCrackLarge || marker.hasHighIssue) return Colors.lacquer;
  if (marker.hasCrackSmall || marker.hasMoss || marker.hasMold || marker.hasStain || marker.hasLowIssue) return Colors.gold;
  return Colors.jade;
}

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

export function VirtualMap() {
  const currentMapMarkers = usePatrolStore((s) => s.currentMapMarkers);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (currentMapMarkers.length === 0) {
    return (
      <PlaqueCard label="Bản đồ ảo">
        <Text style={styles.empty}>Chưa có dữ liệu tuần tra</Text>
      </PlaqueCard>
    );
  }

  const maxDist = Math.max(...currentMapMarkers.map((m) => m.distanceX2), 1);

  return (
    <PlaqueCard label="Bản đồ ảo">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {Array.from({ length: maxDist + 1 }, (_, i) => {
          const marker = currentMapMarkers.find((m) => m.distanceX2 === i);
          const isSelected = selectedIdx === i;
          return (
            <TouchableOpacity
              key={i}
              style={styles.markerCol}
              onPress={() => setSelectedIdx(isSelected ? null : i)}
              activeOpacity={0.6}
            >
              <View style={[styles.dot, { backgroundColor: marker ? markerColor(marker) : Colors.line }]}>
                {marker && marker.confidence > 0 && (
                  <Text style={styles.confBadge}>{marker.confidence}%</Text>
                )}
              </View>
              <View style={styles.line} />
              <Text style={styles.distLabel}>{i * 0.5}m</Text>
              {isSelected && marker && (
                <View style={[styles.tooltip, { borderColor: markerColor(marker) }]}>
                  {markerTooltip(marker).map((t, j) => (
                    <Text key={j} style={styles.tooltipText}>{t}</Text>
                  ))}
                  <Text style={styles.tooltipSub}>{marker.temperature.toFixed(1)}°C / {marker.humidity.toFixed(1)}%</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </PlaqueCard>
  );
}

const DOT_SIZE = 22;

const styles = StyleSheet.create({
  empty: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  scroll: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 0,
    alignItems: "flex-end",
  },
  markerCol: {
    alignItems: "center",
    width: 52,
    position: "relative",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  confBadge: {
    fontFamily: Font.bold,
    fontSize: 7,
    color: Colors.paper,
  },
  line: {
    width: 1,
    height: 18,
    backgroundColor: Colors.line,
  },
  distLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  tooltip: {
    position: "absolute",
    top: -52,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderRadius: 4,
    padding: 6,
    minWidth: 80,
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
});
