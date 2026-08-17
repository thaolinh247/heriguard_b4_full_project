import { Image } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { useDeviceStore, type CameraImage } from "@/store/deviceStore";
import { usePatrolStore } from "@/store/patrolStore";
import type { RobotState, MapMarker, SensorReading, NodeImage, ShotKind } from "@/types/robot";
import { savePatrolImageFromFile } from "@/lib/fileStorage";
import { analyzeNodeImage } from "@/lib/analyze";
import { resolveSimUri, getSimModuleForNode } from "@/lib/sim/simMedia";
import { saveStaticCaptureFromUri } from "@/lib/staticCapture";

let intervalId: ReturnType<typeof setInterval> | null = null;
let patrolTimer: ReturnType<typeof setInterval> | null = null;
let mockDistanceX2 = 0;

// Track patrol count for demo: increase bbox area per patrol to show trend
let mockPatrolCountGlobal = 0;

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

/**
 * Preview URI (sync) cho ảnh hiển thị tức thì trên carousel.
 * File URI (async) để lưu vào node folder dùng resolveSimUri.
 */
function getMockPreviewUri(nodeX2: number): string {
  return Image.resolveAssetSource(getSimModuleForNode(nodeX2)).uri;
}

function generateMockMapMarker(distX2: number): MapMarker {
  const hasIssue = distX2 >= 3 && Math.random() > 0.4; // Issues from node 3 onwards
  const issueType = Math.floor(Math.random() * 6);
  let flags = 0;
  if (hasIssue) {
    flags = 1 << issueType;
  }
  return {
    distanceX2: distX2,
    flags,
    hasLowIssue: hasIssue && (flags & 0x01) !== 0,
    hasHighIssue: hasIssue && (flags & 0x02) !== 0,
    hasMoss: hasIssue && (flags & 0x04) !== 0,
    hasMold: hasIssue && (flags & 0x08) !== 0,
    hasStain: hasIssue && (flags & 0x10) !== 0,
    hasCrackSmall: hasIssue && (flags & 0x20) !== 0,
    hasCrackLarge: hasIssue && (flags & 0x40) !== 0,
    confidence: hasIssue ? randomInRange(50, 95) : 0,
    temperature: randomInRange(24, 34),
    humidity: randomInRange(45, 82),
    timestamp: distX2 * 3,
  };
}

/**
 * Generate mock detection that grows over multiple patrols
 * Demo: same node shows increasing crack area
 */
function generateMockDetectionForNode(
  nodeX2: number,
  temp: number,
  humidity: number,
  patrolCount: number
): NodeImage["detection"] | null {
  if (nodeX2 < 3) {
    return null; // No detections for nodes 0-2
  }

  // Demo: growing trend — area increases with patrol count
  const baseArea = 2 + nodeX2 * 0.5; // 3%→3.5%→4%...
  const area = baseArea + patrolCount * 1.5; // +1.5% per patrol

  if (area < 1) {
    return null;
  }

  return {
    label: "crack_small",
    confidence: Math.min(0.95, 0.5 + area / 10 + patrolCount * 0.05),
    bbox: {
      x: 40 + patrolCount * 5,
      y: 30 + patrolCount * 3,
      width: 30 + patrolCount * 8,
      height: 20 + patrolCount * 5,
    },
  };
}

/**
 * Generate mock NodeImage for a patrol
 * Key: same node returns consistent image URI + detection grows over time
 */
async function generateMockNodeImage(
  patrolId: string,
  nodeX2: number,
  temp: number,
  humidity: number,
  patrolCount: number
): Promise<NodeImage> {
  const frameId = patrolCount * 100 + nodeX2; // Unique frame ID
  const shotKind: ShotKind = 0; // Wide

  // Create NodeImage with optional detection
  const detection = generateMockDetectionForNode(nodeX2, temp, humidity, patrolCount);

  const nodeImageData: Omit<NodeImage, "uri"> = {
    frameId,
    nodeX2,
    shotKind,
    pan: 90,
    tilt: 90,
    timestamp: new Date().toISOString(),
    temperature: temp,
    humidity,
    detection,
  };

  // Add analysis
  if (detection) {
    const analysis = analyzeNodeImage({
      detection,
      temperature: temp,
      humidity,
      timestamp: nodeImageData.timestamp,
    });
    nodeImageData.analysis = analysis;
  }

  // Save real JPEG from assets to node folder (patrols/{id}/node_{x}/)
  try {
    const sourceUri = await resolveSimUri(nodeX2);
    return await savePatrolImageFromFile(
      patrolId,
      nodeX2,
      shotKind,
      frameId,
      sourceUri,
      nodeImageData
    );
  } catch (error) {
    console.warn("[MockBLE] savePatrolImageFromFile failed:", error);
    // Fallback: preview URI (in-memory, không persist — vẫn xem được ngay)
    return { ...nodeImageData, uri: getMockPreviewUri(nodeX2) };
  }
}

const STATE_CYCLE: RobotState[] = [
  "patrol_move",
  "inspect_wide",
  "inspect_close",
  "inspect_scan_low",
  "inspect_scan_high",
  "retract",
];

let stateIndex = 0;

export function startMockBle() {
  const { connectionStatus } = useDeviceStore.getState();
  if (connectionStatus === "connected") return;

  const deviceStore = useDeviceStore.getState();
  deviceStore.setConnectionStatus("connecting");

  setTimeout(() => {
    deviceStore.setDeviceName("HERI-GUARD-01");
    deviceStore.setDeviceId("AA:BB:CC:DD:EE:FF");
    deviceStore.setConnectionStatus("connected");
    deviceStore.setBatteryLevel(randomInRange(70, 98));
    deviceStore.setRobotState("idle");
    deviceStore.setPatrolActive(false);
    useDashboardStore.getState().setBleConnected(true);

    stateIndex = 0;
    mockDistanceX2 = 0;

    intervalId = setInterval(() => {
      const temp = randomInRange(24, 34);
      const humidity = randomInRange(45, 82);

      useDashboardStore.getState().updateSensor(temp, humidity);
      deviceStore.setBatteryLevel(randomInRange(70, 98));

      if (deviceStore.patrolActive) {
        const nextState = STATE_CYCLE[stateIndex % STATE_CYCLE.length];
        stateIndex++;
        deviceStore.setRobotState(nextState);
      }

      if (Math.random() > 0.6) {
        // Generate legacy image (for non-patrol use)
        const img: CameraImage = {
          id: `mock-${Date.now()}`,
          uri: getMockPreviewUri(Math.floor(Math.random() * 7)),
          timestamp: new Date().toLocaleTimeString("vi-VN"),
          temp,
          humidity,
        };
        deviceStore.addImage(img);
      }
    }, 3000);

    console.log("[MockBLE] Started");
  }, 1200);
}

export function stopMockBle() {
  stopMockPatrol();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  stateIndex = 0;
  mockDistanceX2 = 0;
  useDashboardStore.getState().setBleConnected(false);
  const deviceStore = useDeviceStore.getState();
  deviceStore.setConnectionStatus("disconnected");
  deviceStore.setDeviceName(null);
  deviceStore.setDeviceId(null);
  deviceStore.setBatteryLevel(0);
  deviceStore.setRobotState("idle");
  deviceStore.setPatrolActive(false);
  console.log("[MockBLE] Stopped");
}

export async function startMockPatrol() {
  const patrolStore = usePatrolStore.getState();
  if (patrolStore.patrolling) return;

  patrolStore.startPatrol();
  useDeviceStore.getState().setPatrolActive(true);
  mockDistanceX2 = 0;

  const currentSession = patrolStore.currentSession;
  if (!currentSession) {
    console.warn("[MockBLE] Failed to start patrol");
    return;
  }

  console.log(`[MockBLE] Starting mock patrol ${mockPatrolCountGlobal + 1}`);

  patrolTimer = setInterval(async () => {
    const marker = generateMockMapMarker(mockDistanceX2);
    const temp = marker.temperature;
    const humidity = marker.humidity;

    // Add marker
    patrolStore.addMarker(marker);

    // Add sensor log
    const sensor: SensorReading = {
      timestamp: new Date().toISOString(),
      temperature: temp,
      humidity,
    };
    patrolStore.addSensorLog(sensor);

    // Generate mock NodeImage and save to patrol folder
    try {
      const nodeImage = await generateMockNodeImage(
        currentSession.id,
        mockDistanceX2,
        temp,
        humidity,
        mockPatrolCountGlobal
      );
      patrolStore.addNodeImage(nodeImage);
      console.log(`[MockBLE] Generated node ${mockDistanceX2} image`);
    } catch (error) {
      console.warn(`[MockBLE] Failed to generate node ${mockDistanceX2}:`, error);
    }

    mockDistanceX2++;

    // Stop after 6 nodes
    if (mockDistanceX2 >= 6) {
      stopMockPatrol();
      await patrolStore.endPatrol();
      mockPatrolCountGlobal++;
      useDeviceStore.getState().setPatrolActive(false);
      useDeviceStore.getState().setRobotState("idle");
      console.log(`[MockBLE] Patrol ${mockPatrolCountGlobal} completed`);
    }
  }, 3000);
}

export function stopMockPatrol() {
  if (patrolTimer) {
    clearInterval(patrolTimer);
    patrolTimer = null;
  }
}

/**
 * Mô phỏng lệnh 'N' (Chụp & Nhận diện): lấy ảnh asset thật của node,
 * chạy model nhận diện ngay trên thiết bị; đạt ngưỡng → lưu ảnh + nhiệt
 * độ/độ ẩm + phân tích (giống firmware khi gửi ảnh về app).
 */
async function runMockStaticCapture(nodeX2: number, temp: number, humidity: number) {
  const sourceUri = await resolveSimUri(nodeX2);
  const outcome = await saveStaticCaptureFromUri(sourceUri, nodeX2, temp, humidity);

  // Luôn thêm ảnh lên carousel để thấy kết quả nhận diện trên màn hình
  const deviceStore = useDeviceStore.getState();
  deviceStore.addImage({
    id: `mock-${Date.now()}`,
    uri: sourceUri,
    timestamp: new Date().toLocaleTimeString("vi-VN"),
    temp,
    humidity,
    detections: outcome.nodeImage?.detection
      ? [{ label: outcome.nodeImage.detection.label, confidence: outcome.nodeImage.detection.confidence }]
      : undefined,
  });

  if (outcome.reason === "clean") {
    console.log(`[MockBLE] 'N' node ${nodeX2}: sạch — không lưu (chỉ xem)`);
  }
}

export function mockSendCommand(cmd: string): boolean {
  switch (cmd) {
    case "P":
      startMockPatrol().catch((error) => console.warn("[MockBLE] startMockPatrol error:", error));
      return true;
    case "X":
      stopMockPatrol();
      const patrolStore = usePatrolStore.getState();
      if (patrolStore.patrolling) {
        patrolStore.endPatrol().catch((error) => console.warn("[MockBLE] endPatrol error:", error));
      }
      useDeviceStore.getState().setPatrolActive(false);
      useDeviceStore.getState().setRobotState("idle");
      return true;
    case "C": {
      const deviceStore = useDeviceStore.getState();
      const temp = useDashboardStore.getState().currentTemp ?? 0;
      const humidity = useDashboardStore.getState().currentHumidity ?? 0;
      const img: CameraImage = {
        id: `mock-${Date.now()}`,
        uri: getMockPreviewUri(Math.floor(Math.random() * 7)),
        timestamp: new Date().toLocaleTimeString("vi-VN"),
        temp,
        humidity,
      };
      deviceStore.addImage(img);
      return true;
    }
    case "N": {
      // Logic MỚI (theo yêu cầu): robot chỉ chụp + gửi ảnh, KHÔNG detect
      // trên robot. App tự chạy nhận diện; nếu đạt ngưỡng → lưu ảnh +
      // nhiệt độ/độ ẩm tại node + phân tích như tuần tra bình thường.
      const { currentTemp, currentHumidity } = useDashboardStore.getState();
      const nodeX2 = Math.floor(Math.random() * 7);
      const temp = currentTemp ?? 27;
      const humidity = currentHumidity ?? 60;
      // chạy ngầm (AI mất 1-2s); thêm ảnh vào carousel khi xong
      runMockStaticCapture(nodeX2, temp, humidity).catch((error) =>
        console.warn("[MockBLE] static capture failed:", error)
      );
      return true;
    }
    default:
      return false;
  }
}

