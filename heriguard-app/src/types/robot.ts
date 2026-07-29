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
