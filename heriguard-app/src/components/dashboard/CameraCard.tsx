import { View, Text, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDashboardStore } from "@/store/dashboardStore";
import { useDeviceStore } from "@/store/deviceStore";
import { useCountUp } from "@/hooks/useCountUp";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

export function CameraCard() {
  const router = useRouter();
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const lastUpdate = useDashboardStore((s) => s.lastUpdate);
  const latestImage = useDeviceStore((s) => s.latestImage);

  const displayTemp = useCountUp(temp, 600);
  const displayHumidity = useCountUp(humidity, 600);
  const hasRealImage = latestImage?.uri && latestImage.uri.length > 0;

  return (
    <PlaqueCard label="Ghi hình hiện trường" style={styles.card}>
      <View style={styles.touchable} onTouchEnd={() => router.push("/(tabs)/camera")}>
        {/* Camera frame */}
        <View style={styles.frame}>
          {hasRealImage ? (
            <Image source={{ uri: latestImage.uri }} style={styles.image} resizeMode="cover" />
          ) : (
            <Image
              source={require("@/assets/images/heritage-cracks/crack-1.jpg")}
              style={styles.image}
              resizeMode="cover"
            />
          )}
          {/* OSD overlay */}
          <View style={styles.osd}>
            <Text style={styles.osdText}>{latestImage?.timestamp ?? lastUpdate ?? "—"}</Text>
          </View>
          {/* Detection badges */}
          {latestImage?.detections && latestImage.detections.length > 0 && (
            <View style={styles.detectOverlay}>
              {latestImage.detections.map((d, i) => (
                <View key={i} style={[styles.detectBadge, { backgroundColor: d.confidence > 0.75 ? Colors.lacquer : Colors.gold }]}>
                  <Text style={styles.detectText}>{d.label} {Math.round(d.confidence * 100)}%</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Readings */}
        <View style={styles.readings}>
          <View style={styles.reading}>
            <Text style={styles.readingLabel}>NHIỆT ĐỘ</Text>
            <Text style={[styles.readingValue, { color: Colors.lacquerDark }]}>
              {temp !== null ? `${displayTemp.toFixed(1)}°C` : "—"}
            </Text>
          </View>
          <View style={styles.readingDivider} />
          <View style={styles.reading}>
            <Text style={styles.readingLabel}>ĐỘ ẨM</Text>
            <Text style={[styles.readingValue, { color: Colors.jade }]}>
              {humidity !== null ? `${displayHumidity.toFixed(1)}%` : "—"}
            </Text>
          </View>
        </View>
      </View>
    </PlaqueCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  touchable: {},
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: Colors.jadeLight,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  osd: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(20,26,24,0.62)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
  },
  osdText: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.cream,
    letterSpacing: 0.3,
  },
  detectOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    gap: 4,
  },
  detectBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  detectText: {
    fontFamily: Font.bold,
    fontSize: 8,
    color: Colors.paper,
  },
  readings: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  reading: {
    flex: 1,
    alignItems: "center",
  },
  readingDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.line,
  },
  readingLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.inkSoft,
  },
  readingValue: {
    fontFamily: Font.bold,
    fontSize: 20,
    marginTop: 2,
  },
});
