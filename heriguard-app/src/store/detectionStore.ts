import { create } from "zustand";

export interface DetectionEvent {
  id: string;
  patrolId: string;
  label: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  temperature: number;
  humidity: number;
  distanceX2: number;
  timestamp: string;
  imageUri?: string;
}

export interface DetectionTrend {
  label: string;
  count: number;
  avgConfidence: number;
  firstSeen: string;
  lastSeen: string;
}

function computeTrends(detections: DetectionEvent[]): DetectionTrend[] {
  const grouped: Record<string, DetectionEvent[]> = {};
  for (const d of detections) {
    if (!grouped[d.label]) grouped[d.label] = [];
    grouped[d.label].push(d);
  }
  return Object.entries(grouped).map(([label, items]) => ({
    label,
    count: items.length,
    avgConfidence: items.reduce((s, i) => s + i.confidence, 0) / items.length,
    firstSeen: items[items.length - 1].timestamp,
    lastSeen: items[0].timestamp,
  }));
}

interface DetectionState {
  detections: DetectionEvent[];
  trends: DetectionTrend[];
  addDetection: (detection: DetectionEvent) => void;
  addDetections: (detections: DetectionEvent[]) => void;
  getByPatrol: (patrolId: string) => DetectionEvent[];
  clear: () => void;
}

export const useDetectionStore = create<DetectionState>((set, get) => ({
  detections: [],
  trends: [],

  addDetection: (detection) =>
    set((state) => {
      const detections = [detection, ...state.detections];
      return { detections, trends: computeTrends(detections) };
    }),

  addDetections: (detections) =>
    set((state) => {
      const next = [...detections, ...state.detections];
      return { detections: next, trends: computeTrends(next) };
    }),

  getByPatrol: (patrolId) =>
    get().detections.filter((d) => d.patrolId === patrolId),

  clear: () => set({ detections: [], trends: [] }),
}));
