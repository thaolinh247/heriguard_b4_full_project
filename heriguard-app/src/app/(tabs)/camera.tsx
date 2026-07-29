import { useState } from "react";
import { View, Text, Image, ScrollView, Dimensions, StyleSheet } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

const screenWidth = Dimensions.get("window").width;

const MOCK_IMAGES = [
  { id: "1", time: "14:32:05", temp: 28.3, humidity: 71.2 },
  { id: "2", time: "14:28:12", temp: 28.1, humidity: 70.8 },
  { id: "3", time: "14:24:30", temp: 27.9, humidity: 70.1 },
  { id: "4", time: "14:20:45", temp: 27.6, humidity: 69.5 },
  { id: "5", time: "14:16:18", temp: 27.4, humidity: 68.9 },
];

export default function CameraScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>Camera hiện trường</Text>
      <Text style={styles.subtitle}>Vuốt để xem lịch sử chụp</Text>

      {/* Image carousel */}
      <PlaqueCard label="Ảnh gần nhất" style={styles.carouselCard}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (screenWidth - 56));
            setActiveIndex(index);
          }}
        >
          {MOCK_IMAGES.map((img, i) => (
            <View key={img.id} style={[styles.slide, { width: screenWidth - 56 }]}>
              <View style={styles.imageFrame}>
                <Image
                  source={require("@/assets/images/tutorial-web.png")}
                  style={styles.image}
                  resizeMode="cover"
                />
                {/* OSD */}
                <View style={styles.osd}>
                  <Text style={styles.osdText}>{img.time}</Text>
                </View>
              </View>

              {/* Annotation plaque */}
              <View style={styles.annotation}>
                <View style={styles.annotationRow}>
                  <View style={styles.annotationItem}>
                    <Text style={styles.annotationLabel}>NHIỆT ĐỘ</Text>
                    <Text style={[styles.annotationValue, { color: Colors.lacquerDark }]}>
                      {i === 0 && temp !== null ? `${temp.toFixed(1)}°C` : `${img.temp}°C`}
                    </Text>
                  </View>
                  <View style={styles.annotationDivider} />
                  <View style={styles.annotationItem}>
                    <Text style={styles.annotationLabel}>ĐỘ ẨM</Text>
                    <Text style={[styles.annotationValue, { color: Colors.jade }]}>
                      {i === 0 && humidity !== null ? `${humidity.toFixed(1)}%` : `${img.humidity}%`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Dots indicator */}
        <View style={styles.dots}>
          {MOCK_IMAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      </PlaqueCard>

      {/* Capture info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Ảnh {activeIndex + 1}/{MOCK_IMAGES.length} — {MOCK_IMAGES[activeIndex].time}
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
  carouselCard: {
    padding: 10,
  },
  slide: {
    paddingHorizontal: 4,
  },
  imageFrame: {
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
  },
  annotation: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  annotationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  annotationItem: {
    flex: 1,
    alignItems: "center",
  },
  annotationDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.line,
  },
  annotationLabel: {
    fontFamily: Font.regular,
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.inkSoft,
  },
  annotationValue: {
    fontFamily: Font.bold,
    fontSize: 16,
    marginTop: 2,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.line,
  },
  dotActive: {
    backgroundColor: Colors.jade,
    width: 16,
  },
  infoBar: {
    marginTop: 12,
    alignItems: "center",
  },
  infoText: {
    fontFamily: Font.regular,
    fontSize: 11,
    color: Colors.inkSoft,
  },
});
