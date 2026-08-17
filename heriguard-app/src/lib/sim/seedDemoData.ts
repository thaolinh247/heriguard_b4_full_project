import type {
  DetectionEvent,
  MapMarker,
  NodeImage,
  PatrolSession,
  SensorReading,
  ShotKind,
} from "@/types/robot";
import {
  savePatrolImageFromFile,
  updatePatrolJson,
} from "@/lib/fileStorage";
import { analyzeNodeImage } from "@/lib/analyze";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore } from "@/store/detectionStore";
import { useAlertStore } from "@/store/alertStore";
import { resolveSimUri, isCrackNode } from "@/lib/sim/simMedia";

/**
 * ─────────────────────────────────────────────────────────────
 * SEED DEMO DATA — 3 lần tuần tra mẫu (lưu vào ổ đĩa thật)
 * Lần 1 (14 ngày trước) → Lần 2 (7 ngày) → Lần 3 (1 ngày)
 * Diện tích nứt tăng dần theo từng lần → demo so sánh + cảnh báo
 * ─────────────────────────────────────────────────────────────
 */

let seedingInProgress: Promise<void> | null = null;

function isoDaysAgo(days: number, hourOffset = 0): string {
  const d = new Date(Date.now() - days * 86400_000 + hourOffset * 3_600_000);
  return d.toISOString();
}

/** Bbox nứt theo node và lần tuần tra: rộng dần mỗi lần để demo trend (khung QQVGA 160×120) */
function bboxFor(patrolIndex: number, nodeX2: number) {
  const grow = patrolIndex * 7;
  return {
    x: 34 + nodeX2 * 4,
    y: 26 + nodeX2 * 3,
    width: 18 + nodeX2 * 3 + grow,
    height: 12 + nodeX2 * 2 + grow * 0.7,
  };
}

function buildImage(
  nodeX2: number,
  patrolIndex: number,
  temp: number,
  humidity: number,
  timestamp: string
): Omit<NodeImage, "uri"> {
  const frameId = patrolIndex * 1000 + nodeX2;
  const shotKind: ShotKind = 0;

  if (!isCrackNode(nodeX2)) {
    return {
      frameId,
      nodeX2,
      shotKind,
      pan: 90,
      tilt: 90,
      timestamp,
      temperature: temp,
      humidity,
      detection: null,
    };
  }

  const bbox = bboxFor(patrolIndex, nodeX2);
  const detection = {
    label: "crack_small" as const,
    confidence: Math.min(0.985, 0.87 + patrolIndex * 0.03 + nodeX2 * 0.008),
    bbox,
  };
  const analysis = analyzeNodeImage({
    detection,
    temperature: temp,
    humidity,
    timestamp,
  });

  return {
    frameId,
    nodeX2,
    shotKind,
    pan: 90,
    tilt: 90,
    timestamp,
    temperature: temp,
    humidity,
    detection,
    analysis,
  };
}

function buildMarker(nodeX2: number, temp: number, humidity: number, timestamp: number): MapMarker {
  const hasIssue = isCrackNode(nodeX2);
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

async function buildDemoPatrol(
  patrolIndex: number,
  daysAgo: number
): Promise<PatrolSession> {
  const id = `demo-${patrolIndex + 1}`;
  const startTime = isoDaysAgo(daysAgo, 8);
  const endTime = isoDaysAgo(daysAgo, 9);

  const images: NodeImage[] = [];
  const sensorLogs: SensorReading[] = [];
  const mapMarkers: MapMarker[] = [];
  const detections: DetectionEvent[] = [];

  for (let nodeX2 = 0; nodeX2 < 7; nodeX2++) {
    const temp = 25.4 + nodeX2 * 0.8 + patrolIndex * 0.4;
    const humidity = 58 + nodeX2 * 1.5 - patrolIndex * 1.2;
    const timestamp = isoDaysAgo(daysAgo, 8);
    const imageBase = buildImage(nodeX2, patrolIndex, temp, humidity, timestamp);

    const sourceUri = await resolveSimUri(nodeX2);
    const nodeImage = await savePatrolImageFromFile(
      id,
      nodeX2,
      imageBase.shotKind,
      imageBase.frameId,
      sourceUri,
      imageBase
    );
    images.push(nodeImage);

    sensorLogs.push({ timestamp, temperature: temp, humidity });
    mapMarkers.push(buildMarker(nodeX2, temp, humidity, nodeX2 * 180));

    if (imageBase.detection && imageBase.detection.bbox) {
      detections.push({
        id: `${id}-${nodeX2}`,
        timestamp,
        nodeX2,
        shotKind: 0,
        label: imageBase.detection.label,
        confidence: imageBase.detection.confidence,
        bbox: imageBase.detection.bbox,
        temperature: temp,
        humidity,
      });
    }
  }

  return { id, startTime, endTime, images, mapMarkers, detections, sensorLogs };
}

/**
 * Tạo 3 lần tuần tra mẫu — đồng bộ lên store + lưu đĩa.
 * Idempotent: nếu patrol "demo-2" đã tồn tại thì bỏ qua.
 */
export async function seedDemoData(): Promise<void> {
  if (seedingInProgress) return seedingInProgress;
  seedingInProgress = (async () => {
    const existing = usePatrolStore.getState().patrols;
    if (existing.some((p) => p.id.startsWith("demo-"))) return;

    const patrols = await Promise.all([
      buildDemoPatrol(0, 14),
      buildDemoPatrol(1, 7),
      buildDemoPatrol(2, 1),
    ]);

    // Lưu metadata mỗi patrol lên đĩa
    for (const p of patrols) {
      await updatePatrolJson(p.id, {
        startTime: p.startTime,
        endTime: p.endTime,
        mapMarkers: p.mapMarkers,
        detections: p.detections,
        sensorLogs: p.sensorLogs,
      });
    }

    // Đồng bộ lên store (newest first)
    usePatrolStore.getState().importPatrols(patrols);

    // Phát hiện → detectionStore (cho bảng lịch sử)
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

    // Cảnh báo xu hướng: node 3-6 tăng liên tiếp qua 3 lần
    for (const nodeX2 of [3, 4, 5, 6]) {
      useAlertStore.getState().addAlert({
        id: `seed-trend-${nodeX2}`,
        type: "crack_increased",
        message: `⚠ Node ${nodeX2} (${(nodeX2 * 0.5).toFixed(1)}m): diện tích nứt tăng liên tiếp qua 3 lần tuần tra — cần kiểm tra`,
        timestamp: isoDaysAgo(1, 9),
        read: false,
      });
    }

    console.log("[SeedDemo] Đã tạo 3 lần tuần tra mẫu (14/7/1 ngày trước)");
  })();

  try {
    await seedingInProgress;
  } finally {
    seedingInProgress = null;
  }
}

/** Xem có dữ liệu mẫu trên đĩa không (để không seed lại) */
export async function hasDemoData(): Promise<boolean> {
  const patrols = await import("@/lib/fileStorage").then((m) => m.loadPersistedPatrols());
  return patrols.some((p) => p.id.startsWith("demo-"));
}