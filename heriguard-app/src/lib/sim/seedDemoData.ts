import type {
  DetectionEvent,
  MapMarker,
  NodeImage,
  PatrolSession,
  SensorReading,
  ShotKind,
  CrackSeverity,
} from "@/types/robot";
import {
  savePatrolImageFromFile,
  writePatrolManifest,
} from "@/lib/fileStorage";
import { analyzeNodeImage } from "@/lib/analyze";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useAlertStore } from "@/store/alertStore";
import { resolveWideUriForNode, resolveZoomUri } from "@/lib/sim/simMedia";
import { CAPTURE_POINTS } from "@/constants/capturePoints";

/**
 * ─────────────────────────────────────────────────────────────
 * SEED DEMO DATA — 6 lần tuần tra mẫu (lưu vào ổ đĩa thật)
 * 3 ngày × 2 lần/ngày (sáng 8h + chiều 15h)
 *
 * Mỗi lần tuần tra tại điểm chụp tạo 1 ảnh:
 *   - Sáng (patrol index chẵn) → ảnh WIDE CỐ ĐỊNH theo điểm chụp
 *     (mỗi điểm chụp 1 ảnh wide dùng cho TẤT CẢ các ngày)
 *   - Chiều (patrol index lẻ)  → ảnh ZOOM theo dayIndex
 *     (3 ảnh vết nứt khác nhau, mỗi ngày 1 ảnh)
 *
 * Severity mapping (theo ngày 3 mới nhất → ngày 1 cũ nhất):
 *   Điểm chụp 1: ngày 3→Cần chú ý, ngày 2→An toàn, ngày 1→Cần chú ý
 *   Điểm chụp 2: ngày 3→An toàn, ngày 2→Cần chú ý, ngày 1→Cảnh báo
 * ─────────────────────────────────────────────────────────────
 */

let seedingInProgress: Promise<void> | null = null;

function isoDaysAgo(days: number, hourOffset = 0): string {
  const d = new Date(Date.now() - days * 86400_000 + hourOffset * 3_600_000);
  return d.toISOString();
}

/** Severity theo ngày cho từng capture point: [ngày 3 (mới nhất), ngày 2, ngày 1 (cũ nhất)] */
const SEVERITY_MAP: Record<number, CrackSeverity[]> = {
  // Điểm chụp 1 (node 1): Trung bình → Thấp → Trung bình
  1: ["medium", "low", "medium"],
  // Điểm chụp 2 (node 2): Thấp → Trung bình → Cao
  2: ["low", "medium", "high"],
};

// Nhiệt độ/độ ẩm theo severity — khớp tình trạng ảnh
const SEV_TEMP: Record<CrackSeverity, number> = { low: 26.2, medium: 27.9, high: 29.6 };
const SEV_HUM: Record<CrackSeverity, number> = { low: 61.8, medium: 67.8, high: 73.8 };

// Thông số detection để analyzeNodeImage() ra đúng severity mong muốn
const SEV_CONF: Record<CrackSeverity, number> = { low: 0.52, medium: 0.62, high: 0.78 };
const SEV_BBOX: Record<CrackSeverity, { w: number; h: number }> = {
  low: { w: 8, h: 5 }, // area ~0.2% → low
  medium: { w: 16, h: 10 }, // area ~0.8% + conf>=0.6 → medium
  high: { w: 42, h: 24 }, // area >=5% + conf>=0.75 → high
};

/** Patrol index → severity index (0=ngày 3, 1=ngày 2, 2=ngày 1) */
function severityForPatrol(capturePointId: number, patrolIndex: number): CrackSeverity {
  const dayIdx = Math.floor(patrolIndex / 2); // 0,0,1,1,2,2 → 0,1,2
  return SEVERITY_MAP[capturePointId][dayIdx];
}

function buildMarker(nodeX2: number, temp: number, humidity: number, timestamp: number): MapMarker {
  const hasIssue = nodeX2 === 1 || nodeX2 === 2;
  const flags = hasIssue ? 0x20 : 0;
  return {
    distanceX2: nodeX2,
    flags,
    hasLowIssue: false,
    hasHighIssue: false,
    hasMoss: false,
    hasMold: false,
    hasStain: false,
    hasCrackSmall: hasIssue,
    hasCrackLarge: false,
    confidence: hasIssue ? 55 + nodeX2 * 6 : 0,
    temperature: temp,
    humidity,
    timestamp,
  };
}

const CAPTURE_NODE_X2 = new Set(CAPTURE_POINTS.map((p) => p.nodeX2));

async function buildDemoPatrol(
  patrolIndex: number,
  daysAgo: number,
  hourOffset: number
): Promise<PatrolSession> {
  const id = `demo-v4-${patrolIndex + 1}`;
  const startTime = isoDaysAgo(daysAgo, hourOffset);
  const endTime = isoDaysAgo(daysAgo, hourOffset + 1);
  const isMorning = hourOffset < 12;

  const images: NodeImage[] = [];
  const sensorLogs: SensorReading[] = [];
  const mapMarkers: MapMarker[] = [];
  const detections: DetectionEvent[] = [];

  for (let nodeX2 = 0; nodeX2 < 7; nodeX2++) {
    // Xác định capture point + severity trước (dùng cho temp/humidity)
    const cp = CAPTURE_POINTS.find((p) => p.nodeX2 === nodeX2);
    const dayIndex = Math.floor(patrolIndex / 2); // 0,0,1,1,2,2 → 0,1,2 (ngày 3, ngày 2, ngày 1)
    const severity = severityForPatrol(cp?.id ?? 2, patrolIndex);
    // Nhiệt độ/độ ẩm theo severity — khớp tình trạng ảnh
    const temp = SEV_TEMP[severity] + nodeX2 * 0.2;
    const humidity = SEV_HUM[severity] + nodeX2 * 0.5;
    const timestamp = isoDaysAgo(daysAgo, hourOffset);

    sensorLogs.push({ timestamp, temperature: temp, humidity });
    mapMarkers.push(buildMarker(nodeX2, temp, humidity, nodeX2 * 180));

    if (!CAPTURE_NODE_X2.has(nodeX2)) continue;

    const sourceUri = isMorning
      ? await resolveWideUriForNode(nodeX2)
      : await resolveZoomUri(dayIndex);
    const shotKind: ShotKind = isMorning ? 0 : 2;
    const frameId = patrolIndex * 1000 + nodeX2 * 10 + shotKind;

    // Bbox + detection dựa vào severity (giống demoView)
    const zoomScale = shotKind === 0 ? 1 : 1.6;
    const size = SEV_BBOX[severity];
    const bbox = {
      x: 34 + nodeX2 * 4,
      y: 26 + nodeX2 * 3,
      width: size.w * zoomScale,
      height: size.h * zoomScale,
    };

    const detection = {
      label: "crack_small" as const,
      confidence: SEV_CONF[severity],
      bbox,
    };

    const analysis = analyzeNodeImage({
      detection,
      temperature: temp,
      humidity,
      timestamp,
    });

    const imageBase: Omit<NodeImage, "uri"> = {
      frameId,
      nodeX2,
      shotKind,
      pan: shotKind === 0 ? 90 : 85,
      tilt: shotKind === 0 ? 90 : 75,
      timestamp,
      temperature: temp,
      humidity,
      detection,
      analysis,
    };

    let nodeImage: NodeImage;
    try {
      nodeImage = await savePatrolImageFromFile(
        id, nodeX2, shotKind, frameId, sourceUri, imageBase
      );
    } catch (err) {
      console.warn(`[SeedDemo] copyAsync fail ${id} node ${nodeX2}:`, err);
      nodeImage = { ...imageBase, uri: sourceUri };
    }

    images.push(nodeImage);

    detections.push({
      id: `${id}-${nodeX2}`,
      timestamp,
      nodeX2,
      shotKind,
      label: detection.label,
      confidence: detection.confidence,
      bbox: detection.bbox,
      temperature: temp,
      humidity,
    });
  }

  return { id, startTime, endTime, images, mapMarkers, detections, sensorLogs };
}

/**
 * Tạo 6 lần tuần tra mẫu — đồng bộ lên store + lưu đĩa.
 * Idempotent: nếu patrol "demo-v4-*" đã tồn tại thì bỏ qua.
 * KHÔNG xóa bất kỳ dữ liệu nào đã có sẵn.
 */
export async function seedDemoData(): Promise<void> {
  if (seedingInProgress) return seedingInProgress;
  seedingInProgress = (async () => {
    const current = usePatrolStore.getState().patrols;
    if (current.some((p) => p.id.startsWith("demo-v4-"))) return;
    if (current.length > 0) return;

    const patrols = await Promise.all([
      buildDemoPatrol(0, 1, 8),    // NGÀY 3 (mới nhất) — sáng (wide)
      buildDemoPatrol(1, 1, 15),   // NGÀY 3 — chiều (zoom)
      buildDemoPatrol(2, 7, 8),    // NGÀY 2 — sáng (wide)
      buildDemoPatrol(3, 7, 15),   // NGÀY 2 — chiều (zoom)
      buildDemoPatrol(4, 14, 8),   // NGÀY 1 (cũ nhất) — sáng (wide)
      buildDemoPatrol(5, 14, 15),  // NGÀY 1 — chiều (zoom)
    ]);

    for (const p of patrols) {
      await writePatrolManifest(p.id, p);
    }

    usePatrolStore.getState().importPatrols(patrols);

    useDetectionStore
      .getState()
      .addDetections(
        patrols.flatMap((p) =>
          p.images
            .filter((i) => i.detection)
            .map((i) => ({
              id: `${p.id}-${i.frameId}`,
              patrolId: p.id,
              label: i.detection!.label,
              confidence: i.detection!.confidence,
              boundingBox: i.detection!.bbox,
              temperature: i.temperature,
              humidity: i.humidity,
              distanceX2: i.nodeX2,
              timestamp: i.timestamp,
              imageUri: i.uri,
            }))
        )
      );

    for (const point of CAPTURE_POINTS) {
      useAlertStore.getState().addAlert({
        id: `seed-trend-${point.nodeX2}`,
        type: "crack_increased",
        message: `⚠ ${point.label} (${point.distanceLabel}): diện tích nứt tăng liên tiếp qua 3 ngày — cần kiểm tra`,
        timestamp: isoDaysAgo(1, 15),
        read: false,
      });
    }

    console.log("[SeedDemo] Đã tạo 6 lần tuần tra mẫu (3 ngày × sáng=wide/chiều=zoom)");
  })();

  try {
    await seedingInProgress;
  } finally {
    seedingInProgress = null;
  }
}

/**
 * Đảm bảo dữ liệu mẫu cho lần cài mới:
 * Chỉ seed khi TRẠNG THÁI HOÀN TOÀN TRỐNG (chưa có patrol nào).
 * KHÔNG xóa, KHÔNG thay thế bất kỳ dữ liệu đã có.
 * Mọi thay đổi hiển thị về sau do demoView đảm nhiệm (không đụng store/đĩa).
 */
export async function ensureDemoSeedFresh(): Promise<void> {
  await usePatrolStore.getState().loadPersistedHistory();
  const current = usePatrolStore.getState().patrols;
  if (current.length > 0) return;
  await seedDemoData();
}
