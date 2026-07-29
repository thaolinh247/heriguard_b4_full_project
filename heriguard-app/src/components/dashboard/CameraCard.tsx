import { View, Text, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDashboardStore } from "@/store/dashboardStore";
import { useCountUp } from "@/hooks/useCountUp";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

export function CameraCard() {
  const router = useRouter();
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const lastUpdate = useDashboardStore((s) => s.lastUpdate);

  const displayTemp = useCountUp(temp, 600);
  const displayHumidity = useCountUp(humidity, 600);

  return (
    <PlaqueCard label="Ghi hình hiện trường" style={styles.card}>
      <View style={styles.touchable} onTouchEnd={() => router.push("/(tabs)/camera")}>
        {/* Camera frame */}
        <View style={styles.frame}>
          <Image
            source={require("@/assets/images/tutorial-web.png")}
            style={styles.image}
            resizeMode="cover"
          />
          {/* OSD overlay */}
          <View style={styles.osd}>
            <Text style={styles.osdText}>{lastUpdate ?? "—"}</Text>
          </View>
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
