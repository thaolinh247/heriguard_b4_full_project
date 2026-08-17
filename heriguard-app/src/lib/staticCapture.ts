import { analyzeCrackOnDevice } from "@/ml/crack";
import { analyzeNodeImage } from "@/lib/analyze";
import { savePatrolImageFromFile, updatePatrolJson } from "@/lib/fileStorage";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useAlertStore } from "@/store/alertStore";
import { useDashboardStore } from "@/store/dashboardStore";
import type {
  DetectionEvent,
  NodeImage,
  PatrolSession,
  SensorReading,
} from "@/types/robot";

/**
 * ─────────────────────────────────────────────────────────────
 * STATIC CAPTURE — lệnh 'N' (Chụp & Nhận diện)
 *
 * Robot chỉ chụp ảnh và gửi về (KHÔNG detect trên robot).
 * App chạy model nhận diện ngay trên thiết bị; nếu ảnh đạt
 * ngưỡng tối thiểu thì lưu ảnh + nhiệt độ/độ ẩm tại điểm đó,
 * phân tích như tuần tra bình thường rồi đưa vào lịch sử.
 * Nếu ảnh sạch → không lưu (chỉ hiện trên carousel).
 * ─────────────────────────────────────────────────────────────
 */

export interface StaticCaptureOutcome {
  saved: boolean;
  reason: "saved" | "clean" | "error";
  nodeImage?: NodeImage;
  session?: PatrolSession;
  error?: string;
}

export async function saveStaticCaptureFromUri(
  sourceUri: string,
  nodeX2: number,
  temp: number,
  humidity: number
): Promise<StaticCaptureOutcome> {
  // 1) Nhận diện ảnh robot gửi lên bằng model trên app
  let result;
  try {
    result = await analyzeCrackOnDevice(sourceUri);
  } catch (error) {
    console.warn("[StaticCapture] AI failed:", error);
    return {
      saved: false,
      reason: "error",
      error: error instanceof Error ? error.message : "AI thất bại",
    };
  }

  // 2) Không đạt ngưỡng → ảnh sạch, không lưu
  if (!result.isCrack) {
    return { saved: false, reason: "clean" };
  }

  // 3) Đạt ngưỡng → dựng detection (bbox QQVGA 160×120) + phân tích
  const now = new Date().toISOString();
  const box = result.boxes[0];
  const bbox = box
    ? { x: box.x * 160, y: box.y * 120, width: box.w * 160, height: box.h * 120 }
    : undefined;
  const detection = {
    label: "crack_small",
    confidence: result.confidence,
    bbox,
  };
  const analysis = analyzeNodeImage({
    detection,
    temperature: temp,
    humidity,
    timestamp: now,
  });

  // 4) Lưu ảnh vào node folder + ghi manifest (tạo patrol mới 1 ảnh)
  const patrolId = `capture-${Date.now()}`;
  const nodeImageData: Omit<NodeImage, "uri"> = {
    frameId: 0,
    nodeX2,
    shotKind: 0,
    pan: 90,
    tilt: 90,
    timestamp: now,
    temperature: temp,
    humidity,
    detection,
    analysis,
  };

  const nodeImage = await savePatrolImageFromFile(
    patrolId,
    nodeX2,
    0,
    0,
    sourceUri,
    nodeImageData
  );

  // 5) Đồng bộ: phát hiện + sensor log + session đầy đủ
  const detectionEvent: DetectionEvent = {
    id: `detect-${Date.now()}`,
    timestamp: now,
    nodeX2,
    shotKind: 0,
    label: detection.label,
    confidence: result.confidence,
    bbox: bbox ?? { x: 0, y: 0, width: 1, height: 1 },
    temperature: temp,
    humidity,
  };
  const sensorLog: SensorReading = { timestamp: now, temperature: temp, humidity };

  const session: PatrolSession = {
    id: patrolId,
    startTime: now,
    endTime: now,
    images: [nodeImage],
    mapMarkers: [],
    detections: [detectionEvent],
    sensorLogs: [sensorLog],
  };

  try {
    await updatePatrolJson(patrolId, session);
  } catch (error) {
    console.warn("[StaticCapture] manifest update failed:", error);
  }

  // 6) Đưa vào store: lịch sử tuần tra + danh sách phát hiện + cảnh báo
  usePatrolStore.getState().addCompletedPatrol(session);
  useDetectionStore.getState().addDetection({
    id: detectionEvent.id,
    patrolId,
    label: detectionEvent.label,
    confidence: result.confidence,
    boundingBox: bbox,
    temperature: temp,
    humidity,
    distanceX2: nodeX2,
    timestamp: now,
    imageUri: nodeImage.uri,
  });
  useAlertStore.getState().addAlert({
    id: `detect-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: "detect_capture",
    message: `📷 Chụp tại node ${nodeX2} (${(nodeX2 * 0.5).toFixed(1)}m): phát hiện ${detection.label} — độ tin cậy ${(result.confidence * 100).toFixed(1)}%, đã lưu ảnh + nhiệt độ/độ ẩm`,
    timestamp: now,
    read: false,
  });

  console.log(
    `[StaticCapture] Saved node ${nodeX2} (crack ${(result.confidence * 100).toFixed(1)}%) → ${patrolId}`
  );
  return { saved: true, reason: "saved", nodeImage, session };
}

/**
 * Đọc nhiệt độ/độ ẩm mới nhất hoặc mặc định an toàn
 */
export function currentEnv(): { temp: number; humidity: number } {
  const { currentTemp, currentHumidity } = useDashboardStore.getState();
  return {
    temp: currentTemp ?? 0,
    humidity: currentHumidity ?? 0,
  };
}