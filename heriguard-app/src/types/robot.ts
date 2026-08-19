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
  type: "crack_high" | "crack_increased" | "disconnected" | `detect_${string}`;
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

export type PatrolCommand = "P" | "X" | "C" | "N" | "S" | "F" | "G" | "T" | "W";

// ── Shot kind (camera angle/distance) ──────────────────────────
export type ShotKind = 0 | 1 | 2 | 3;
export const SHOT_KIND_LABELS: Record<ShotKind, string> = {
  0: "Ảnh rộng",
  1: "Ảnh cận thấp",
  2: "Ảnh cận cao",
  3: "Tùy chỉnh",
};

// ── Phase 2A: Node Image (linked to patrol + node) ─────────────
export interface DetectionInImage {
  label: string;
  confidence: number;
  bbox?: BoundingBox;
}

export interface ImageAnalysis {
  severity: CrackSeverity;
  crackArea?: number; // Percentage of image
  crackCount?: number;
  findings: string;
}

export interface NodeImage {
  uri: string;
  frameId: number;
  nodeX2: number; // 0 = node 0 (0m), 1 = node 0.5m, 2 = node 1m, etc
  shotKind: ShotKind;
  pan?: number; // 0-180, 90 = center
  tilt?: number; // 0-180, 90 = straight
  timestamp: string; // ISO string
  temperature: number;
  humidity: number;
  laserDistance?: number; // mm
  detection?: DetectionInImage | null;
  analysis?: ImageAnalysis | null;
}

// ── Phase 2B: Detection Event ──────────────────────────────────
export interface DetectionEvent {
  id: string;
  timestamp: string;
  nodeX2: number;
  shotKind: ShotKind;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  temperature: number;
  humidity: number;
}

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

// ── Phase 3: Patrol Session (persistent, with manifest) ────────
export interface PatrolSession {
  id: string;
  startTime: string;
  endTime?: string;
  // Core data
  images: NodeImage[];
  mapMarkers: MapMarker[];
  detections: DetectionEvent[];
  sensorLogs: SensorReading[];
  // Legacy (kept for compatibility)
  imageUris?: string[];
}
