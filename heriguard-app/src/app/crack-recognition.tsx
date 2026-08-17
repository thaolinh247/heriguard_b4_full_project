import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Asset } from "expo-asset";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Colors, Font } from "@/constants/theme";
import { images } from "@/constants/images";
import { analyzeCrackOnDevice, CRACK_TEST_ACCURACY, type CrackResult } from "@/ml/crack";

export default function CrackRecognitionScreen() {
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [result, setResult] = useState<CrackResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraLive, setCameraLive] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  async function run(nextUri: string) {
    setCameraLive(false);
    setUri(nextUri); setResult(null); setError(null); setBusy(true);
    try {
      setResult(await analyzeCrackOnDevice(nextUri));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể nhận diện ảnh này.");
    } finally {
      setBusy(false);
    }
  }

  async function captureCamera() {
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (!photo) throw new Error("Camera chưa sẵn sàng.");
      await run(photo.uri);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không mở được camera."); }
  }

  async function fromGallery() {
    setError(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (picked.canceled || !picked.assets[0]) return;
      await run(picked.assets[0].uri);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không đọc được ảnh."); }
  }

  async function fromSample() {
    const asset = Asset.fromModule(images.crackSamplePositive);
    if (!asset.localUri && !asset.uri) await asset.downloadAsync();
    await run(asset.localUri ?? asset.uri);
  }

  async function ensureCameraReady() {
    if (permission?.granted) return true;
    if (permission?.canAskAgain) {
      const next = await requestPermission();
      return next.granted;
    }
    setError("Chưa được cấp quyền camera — hãy bật quyền rồi thử lại.");
    return false;
  }

  async function onCapturePress() {
    if (cameraLive) {
      if (await ensureCameraReady()) await captureCamera();
    } else {
      setUri(null); setResult(null); setError(null); setCameraLive(true);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable testID="crack-back-button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>HERIGUARD · AI TẠI THIẾT BỊ</Text>
          <Text style={styles.title}>Nhận diện vết nứt</Text>
        </View>
      </View>

      <View style={styles.viewer}>
        {cameraLive ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        ) : uri ? (
          <>
            <Image source={{ uri }} style={styles.photo} contentFit="cover" />
            {result?.boxes.map((box, index) => (
              <View key={index} style={[styles.box, {
                left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                width: `${box.w * 100}%`, height: `${box.h * 100}%`,
              }]}>
                <Text style={styles.boxLabel}>{Math.round(box.confidence * 100)}%</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>⌖</Text>
            <Text style={styles.placeholderTitle}>Đưa bề mặt vào khung hình</Text>
            <Text style={styles.placeholderText}>Chụp gần, đủ sáng và giữ camera vuông góc với bề mặt.</Text>
          </View>
        )}
        {busy && <View style={styles.busy}><ActivityIndicator color={Colors.paper} /><Text style={styles.busyText}>Đang phân tích trên thiết bị…</Text></View>}
      </View>

      {result && (
        <View testID="crack-result-card" style={[styles.resultCard, result.isCrack ? styles.dangerCard : styles.safeCard]}>
          <View style={styles.resultTop}>
            <Text style={[styles.resultStatus, { color: result.isCrack ? Colors.lacquer : Colors.jade }]}>
              {result.isCrack ? "PHÁT HIỆN VẾT NỨT" : "KHÔNG PHÁT HIỆN VẾT NỨT"}
            </Text>
            <Text style={styles.confidence}>{(result.confidence * 100).toFixed(1)}%</Text>
          </View>
          <Text style={styles.resultDescription}>
            {result.isCrack ? "Cần kiểm tra trực tiếp các vùng được khoanh." : "Chưa thấy dấu hiệu đủ ngưỡng cảnh báo trong ảnh."}
          </Text>
          <View style={styles.metrics}>
            <View><Text style={styles.metricLabel}>THỜI GIAN</Text><Text style={styles.metricValue}>{result.tookMs} ms</Text></View>
            <View><Text style={styles.metricLabel}>VÙNG NGHI NGỜ</Text><Text style={styles.metricValue}>{result.boxes.length}</Text></View>
          </View>
        </View>
      )}

      {error && <View style={styles.errorCard}><Text style={styles.errorTitle}>Chưa thể dùng camera</Text><Text style={styles.errorText}>{error}</Text><Text style={styles.errorText}>Bạn vẫn có thể chọn ảnh hoặc chạy ảnh mẫu bên dưới.</Text></View>}

      <View style={styles.actions}>
        <Pressable testID="crack-capture-button" onPress={onCapturePress} style={[styles.button, styles.primaryButton]}>
          <Text style={styles.primaryText}>{cameraLive ? "Chụp & nhận diện" : "Mở lại camera"}</Text>
        </Pressable>
        <Pressable onPress={fromGallery} style={[styles.button, styles.secondaryButton]}><Text style={styles.secondaryText}>Thư viện ảnh</Text></Pressable>
      </View>
      <Pressable testID="crack-sample-button" onPress={fromSample} style={styles.sampleButton}>
        <Text style={styles.sampleTitle}>Chạy ảnh mẫu có vết nứt</Text>
        <Text style={styles.sampleText}>Ảnh thật lấy từ tập kiểm thử, dùng khi camera chưa được cấp quyền.</Text>
      </Pressable>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>NHẬN DIỆN NGAY TRÊN THIẾT BỊ</Text>
        <Text style={styles.noteText}>Độ chính xác tập test: {(CRACK_TEST_ACCURACY * 100).toFixed(1)}%. Kết quả dùng để hỗ trợ sàng lọc, không thay thế kiểm định kết cấu.</Text>
        <Text style={styles.noteText}>Khi đưa lên edge camera của kit robot, giao diện giữ nguyên; chỉ cần thay nguồn ảnh điện thoại bằng khung hình robot gửi về.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.cream },
  content: { padding: 16, paddingTop: 48, paddingBottom: 40, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.line },
  backText: { fontSize: 32, lineHeight: 32, color: Colors.ink },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: Font.bold, fontSize: 9, letterSpacing: 1.2, color: Colors.jade },
  title: { fontFamily: Font.bold, fontSize: 23, color: Colors.ink },
  viewer: { width: "100%", aspectRatio: 1, overflow: "hidden", backgroundColor: Colors.jadeLight, borderRadius: 12, position: "relative", borderWidth: 1, borderColor: Colors.line },
  camera: { width: "100%", height: "100%" },
  photo: { width: "100%", height: "100%" },
  placeholder: { flex: 1, padding: 42, alignItems: "center", justifyContent: "center" },
  placeholderIcon: { fontSize: 46, color: Colors.jade },
  placeholderTitle: { fontFamily: Font.bold, fontSize: 17, color: Colors.ink, marginTop: 8, textAlign: "center" },
  placeholderText: { fontFamily: Font.regular, fontSize: 12, color: Colors.inkSoft, textAlign: "center", marginTop: 6, lineHeight: 18 },
  busy: { position: "absolute", inset: 0, backgroundColor: "rgba(42,36,32,0.72)", alignItems: "center", justifyContent: "center", gap: 10 },
  busyText: { fontFamily: Font.bold, fontSize: 12, color: Colors.paper },
  box: { position: "absolute", borderWidth: 2, borderColor: Colors.lacquer, backgroundColor: "rgba(178,58,46,0.16)" },
  boxLabel: { alignSelf: "flex-start", backgroundColor: Colors.lacquer, color: Colors.paper, fontFamily: Font.bold, fontSize: 10, paddingHorizontal: 5, paddingVertical: 2 },
  resultCard: { padding: 15, borderRadius: 10, borderWidth: 1 },
  dangerCard: { backgroundColor: "#F9E8E5", borderColor: "rgba(178,58,46,.35)" },
  safeCard: { backgroundColor: Colors.jadeLight, borderColor: "rgba(47,111,98,.35)" },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  resultStatus: { fontFamily: Font.bold, fontSize: 13, letterSpacing: .4, flex: 1 },
  confidence: { fontFamily: Font.bold, fontSize: 22, color: Colors.ink },
  resultDescription: { fontFamily: Font.regular, fontSize: 12, color: Colors.inkSoft, marginTop: 5 },
  metrics: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.line, gap: 8 },
  metricLabel: { fontFamily: Font.bold, fontSize: 8, color: Colors.inkSoft },
  metricValue: { fontFamily: Font.bold, fontSize: 11, color: Colors.ink, marginTop: 2, maxWidth: 120 },
  errorCard: { backgroundColor: Colors.goldLight, borderRadius: 8, padding: 12 },
  errorTitle: { fontFamily: Font.bold, fontSize: 13, color: Colors.ink },
  errorText: { fontFamily: Font.regular, fontSize: 11, lineHeight: 16, color: Colors.inkSoft, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10 },
  button: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  primaryButton: { backgroundColor: Colors.jade },
  secondaryButton: { backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.jade },
  primaryText: { fontFamily: Font.bold, fontSize: 13, color: Colors.paper },
  secondaryText: { fontFamily: Font.bold, fontSize: 13, color: Colors.jade },
  sampleButton: { backgroundColor: Colors.paper, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: Colors.line },
  sampleTitle: { fontFamily: Font.bold, fontSize: 13, color: Colors.lacquer },
  sampleText: { fontFamily: Font.regular, fontSize: 11, lineHeight: 16, color: Colors.inkSoft, marginTop: 3 },
  note: { borderLeftWidth: 3, borderLeftColor: Colors.gold, paddingLeft: 12, marginTop: 2 },
  noteTitle: { fontFamily: Font.bold, fontSize: 9, letterSpacing: 1, color: Colors.ink },
  noteText: { fontFamily: Font.regular, fontSize: 11, lineHeight: 17, color: Colors.inkSoft, marginTop: 5 },
});