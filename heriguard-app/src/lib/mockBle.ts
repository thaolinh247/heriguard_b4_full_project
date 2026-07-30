import { Image } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { useDeviceStore, type CameraImage } from "@/store/deviceStore";
import { usePatrolStore } from "@/store/patrolStore";
import { useDetectionStore, type DetectionEvent } from "@/store/detectionStore";
import { useAlertStore } from "@/store/alertStore";
import type { RobotState, MapMarker, SensorReading } from "@/types/robot";

let intervalId: ReturnType<typeof setInterval> | null = null;
let patrolTimer: ReturnType<typeof setInterval> | null = null;
let mockDistanceX2 = 0;

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

const MOCK_IMAGE_MODULES = [
  require("@/assets/images/heritage-cracks/crack-1.jpg"),
  require("@/assets/images/heritage-cracks/crack-2.jpg"),
  require("@/assets/images/heritage-cracks/crack-3.jpg"),
  require("@/assets/images/heritage-cracks/crack-4.jpg"),
  require("@/assets/images/heritage-cracks/crack-5.jpg"),
  require("@/assets/images/heritage-cracks/crack-6.jpg"),
  require("@/assets/images/heritage-cracks/crack-7.jpg"),
];

let resolvedUris: string[] | null = null;
let mockImageIndex = 0;

function getMockUri(): string {
  if (!resolvedUris) {
    resolvedUris = MOCK_IMAGE_MODULES.map((mod) => Image.resolveAssetSource(mod).uri);
  }
  const uri = resolvedUris[mockImageIndex % resolvedUris.length];
  mockImageIndex++;
  return uri;
}

function generateMockImage(temp: number, humidity: number): CameraImage {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN");
  const dateStr = now.toLocaleDateString("vi-VN");
  return {
    id: `mock-${Date.now()}`,
    uri: getMockUri(),
    timestamp: `${dateStr} ${timeStr}`,
    temp,
    humidity,
    detections: Math.random() > 0.7
      ? [{ label: "crack", confidence: randomInRange(0.6, 0.95) }]
      : undefined,
  };
}

const LABELS = ["crack_small", "crack_large", "moss", "mold", "stain"];

function generateMockMapMarker(distX2: number): MapMarker {
  const hasIssue = Math.random() > 0.6;
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

function generateMockDetection(
  patrolId: string,
  distX2: number,
  temp: number,
  humidity: number,
  imageUri?: string
): DetectionEvent | null {
  if (Math.random() > 0.5) return null;
  const label = LABELS[Math.floor(Math.random() * LABELS.length)];
  const confidence = randomInRange(0.55, 0.95);
  return {
    id: `det-${Date.now()}-${distX2}`,
    patrolId,
    label,
    confidence,
    boundingBox: {
      x: Math.floor(Math.random() * 300) + 50,
      y: Math.floor(Math.random() * 200) + 30,
      width: Math.floor(Math.random() * 100) + 40,
      height: Math.floor(Math.random() * 60) + 20,
    },
    temperature: temp,
    humidity,
    distanceX2: distX2,
    timestamp: new Date().toISOString(),
    imageUri,
  };
}

const STATE_CYCLE: RobotState[] = [
  "patrol_move", "inspect_wide",
  "inspect_close", "inspect_scan_low", "inspect_scan_high",
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
        const img = generateMockImage(temp, humidity);
        deviceStore.addImage(img);
      }
    }, 3000);
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
}

export function startMockPatrol() {
  let patrolStore = usePatrolStore.getState();
  if (patrolStore.patrolling) return;
  const patrolId = `patrol-${Date.now()}`;
  patrolStore.startPatrol();
  useDeviceStore.getState().setPatrolActive(true);
  mockDistanceX2 = 0;

  patrolTimer = setInterval(() => {
    const marker = generateMockMapMarker(mockDistanceX2);
    const temp = marker.temperature;
    const humidity = marker.humidity;
    mockDistanceX2++;
    patrolStore = usePatrolStore.getState();
    patrolStore.addMarker(marker);

    const sensor: SensorReading = {
      timestamp: new Date().toISOString(),
      temperature: temp,
      humidity,
    };
    patrolStore.addSensorLog(sensor);

    // Generate mock image with possible detection
    if (Math.random() > 0.3) {
      const img = generateMockImage(temp, humidity);
      const deviceStore = useDeviceStore.getState();
      deviceStore.addImage(img);

      const detection = generateMockDetection(patrolId, mockDistanceX2 - 1, temp, humidity, img.uri);
      if (detection) {
        useDetectionStore.getState().addDetection(detection);

        // Attach detection to image
        const updatedImg = { ...img, detections: [{ label: detection.label, confidence: detection.confidence }] };
        deviceStore.addImage(updatedImg);

        // Auto-trigger alert via alertStore
        useAlertStore.getState().triggerFromDetection(detection);
      }
    }

    if (mockDistanceX2 >= 12) {
      stopMockPatrol();
      patrolStore.endPatrol();
      useDeviceStore.getState().setPatrolActive(false);
      useDeviceStore.getState().setRobotState("idle");
    }
  }, 4000);
}

export function stopMockPatrol() {
  if (patrolTimer) {
    clearInterval(patrolTimer);
    patrolTimer = null;
  }
}

export function mockSendCommand(cmd: string): boolean {
  switch (cmd) {
    case "P":
      startMockPatrol();
      return true;
    case "X":
      stopMockPatrol();
      const patrolStore = usePatrolStore.getState();
      if (patrolStore.patrolling) {
        patrolStore.endPatrol();
      }
      useDeviceStore.getState().setPatrolActive(false);
      useDeviceStore.getState().setRobotState("idle");
      return true;
    case "C":
      const deviceStore = useDeviceStore.getState();
      const temp = useDashboardStore.getState().currentTemp ?? 0;
      const humidity = useDashboardStore.getState().currentHumidity ?? 0;
      deviceStore.addImage(generateMockImage(temp, humidity));
      return true;
    default:
      return false;
  }
}
