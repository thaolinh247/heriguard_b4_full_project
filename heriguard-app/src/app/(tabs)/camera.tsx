import { useState } from "react";
import { View, Text, Image, ScrollView, Dimensions, StyleSheet } from "react-native";
import { useDeviceStore } from "@/store/deviceStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { PlaqueCard } from "@/components/shared/PlaqueCard";
import { Colors, Font } from "@/constants/theme";

const screenWidth = Dimensions.get("window").width;

export default function CameraScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageHistory = useDeviceStore((s) => s.imageHistory);
  const latestImage = useDeviceStore((s) => s.latestImage);
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);

  const images = imageHistory.length > 0 ? imageHistory : [];
  const current = images[activeIndex];

  const slideWidth = screenWidth - 56;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Camera hiện trường</Text>
      <Text style={styles.subtitle}>Vuốt để xem lịch sử chụp</Text>

      <PlaqueCard label="Ảnh gần nhất" style={styles.carouselCard}>
        {images.length === 0 ? (
          <View style={styles.emptyFrame}>
            <Text style={styles.emptyText}>Chưa có ảnh từ robot</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
                setActiveIndex(index);
              }}
            >
              {images.map((img, i) => (
                <View key={img.id} style={[styles.slide, { width: slideWidth }]}>
                  <View style={styles.imageFrame}>
                    {img.uri ? (
                      <Image source={{ uri: img.uri }} style={styles.image} resizeMode="cover" />
                    ) : (
                      <View style={styles.noImage}>
                        <Text style={styles.noImageText}>Đang tải…</Text>
                      </View>
                    )}

                    {/* Detection bounding boxes */}
                    {img.detections?.map((det, di) => (
                      <View
                        key={di}
                        style={[
                          styles.bbox,
                          {
                            backgroundColor:
                              det.confidence > 0.75 ? "rgba(178,58,46,0.3)" : "rgba(201,154,62,0.3)",
                            borderColor:
                              det.confidence > 0.75 ? Colors.lacquer : Colors.gold,
                          },
                        ]}
                      >
                        <Text style={styles.bboxLabel}>
                          {det.label} {Math.round(det.confidence * 100)}%
                        </Text>
                      </View>
                    ))}

                    <View style={styles.osd}>
                      <Text style={styles.osdText}>{img.timestamp}</Text>
                    </View>
                  </View>

                  {/* Annotation plaque */}
                  <View style={styles.annotation}>
                    <View style={styles.annotationRow}>
                      <View style={styles.annotationItem}>
                        <Text style={styles.annotationLabel}>NHIỆT ĐỘ</Text>
                        <Text style={[styles.annotationValue, { color: Colors.lacquerDark }]}>
                          {i === 0 && temp !== null ? `${temp.toFixed(1)}°C` : `${img.temp.toFixed(1)}°C`}
                        </Text>
                      </View>
                      <View style={styles.annotationDivider} />
                      <View style={styles.annotationItem}>
                        <Text style={styles.annotationLabel}>ĐỘ ẨM</Text>
                        <Text style={[styles.annotationValue, { color: Colors.jade }]}>
                          {i === 0 && humidity !== null ? `${humidity.toFixed(1)}%` : `${img.humidity.toFixed(1)}%`}
                        </Text>
                      </View>
                    </View>
                    {img.detections && img.detections.length > 0 && (
                      <View style={styles.detectionRow}>
                        {img.detections.map((det, di) => (
                          <View
                            key={di}
                            style={[
                              styles.detectionBadge,
                              { backgroundColor: det.confidence > 0.75 ? Colors.lacquer : Colors.gold },
                            ]}
                          >
                            <Text style={styles.detectionBadgeText}>
                              {det.label} {Math.round(det.confidence * 100)}%
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.dots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          </>
        )}
      </PlaqueCard>

      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {current
            ? `Ảnh ${activeIndex + 1}/${images.length} — ${current.timestamp}`
            : "Chưa có ảnh"}
        </Text>
      </View>
    </ScrollView>
  );
}

const OSD_H = 16;
const OSD_W = 90;

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
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  emptyFrame: {
    aspectRatio: 4 / 3,
    borderRadius: 2,
    backgroundColor: Colors.jadeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.inkSoft,
    fontStyle: "italic",
  },
  bbox: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 2,
    top: "20%",
    left: "10%",
    width: "50%",
    height: "30%",
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  bboxLabel: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.paper,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 4,
    paddingVertical: 1,
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
  detectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  detectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  detectionBadgeText: {
    fontFamily: Font.bold,
    fontSize: 9,
    color: Colors.paper,
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
