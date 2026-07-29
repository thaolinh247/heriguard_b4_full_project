export type CrackSeverity = "low" | "medium" | "high";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CrackDetection {
  id: string;
  severity: CrackSeverity;
  boundingBox?: BoundingBox;
  confidence: number;
}

export interface RobotPacket {
  patrolId: string;
  timestamp: string;
  imageUri?: string;
  temperature: number;
  humidity: number;
  distance?: number;
  crackDetections: CrackDetection[];
  batteryLevel: number;
}

export interface SensorReading {
  timestamp: string;
  temperature: number;
  humidity: number;
  distance?: number;
}

export interface Patrol {
  id: string;
  startTime: string;
  endTime?: string;
  detections: CrackDetection[];
  sensorReadings: SensorReading[];
  imageUris: string[];
}

export interface Alert {
  id: string;
  type: "crack_high" | "crack_increased" | "disconnected";
  message: string;
  timestamp: string;
  read: boolean;
}

// ── Phase 1: Robot State ──────────────────────────────────────
export type RobotState =
  | "idle"
  | "patrol_move"
  | "inspect_wide"
  | "inspect_close"
  | "inspect_scan_low"
  | "inspect_scan_high"
  | "retract"
  | "emergency";

export const ROBOT_STATE_VALUES: Record<number, RobotState> = {
  0: "idle",
  1: "patrol_move",
  2: "inspect_wide",
  3: "inspect_close",
  4: "inspect_scan_low",
  5: "inspect_scan_high",
  6: "retract",
  7: "emergency",
};

export const ROBOT_STATE_LABELS: Record<RobotState, string> = {
  idle: "Sẵn sàng",
  patrol_move: "Đang di chuyển",
  inspect_wide: "Đang quét rộng",
  inspect_close: "Đang quét sâu",
  inspect_scan_low: "Quét thấp",
  inspect_scan_high: "Quét cao",
  retract: "Đang lùi",
  emergency: "Khẩn cấp",
};

export type PatrolCommand = "P" | "X" | "C" | "S";

// ── Phase 2: Map Marker ───────────────────────────────────────
export interface MapMarker {
  distanceX2: number;
  flags: number;
  hasLowIssue: boolean;
  hasHighIssue: boolean;
  hasMoss: boolean;
  hasMold: boolean;
  hasStain: boolean;
  hasCrackSmall: boolean;
  hasCrackLarge: boolean;
  confidence: number;
  temperature: number;
  humidity: number;
  timestamp: number;
}

export interface PatrolSession {
  id: string;
  startTime: string;
  endTime?: string;
  mapMarkers: MapMarker[];
  imageUris: string[];
  sensorLogs: SensorReading[];
}
