import { create } from "zustand";
import type {
  MapMarker,
  PatrolSession,
  SensorReading,
  NodeImage,
  DetectionEvent,
} from "@/types/robot";
import {
  updatePatrolJson,
  loadPersistedPatrols,
} from "@/lib/fileStorage";
import { shouldEscalateForConsecutiveGrowth } from "@/lib/compare";
import { useAlertStore } from "@/store/alertStore";

interface PatrolStore {
  // State
  patrolling: boolean;
  currentSession: PatrolSession | null;
  currentMapMarkers: MapMarker[];
  patrols: PatrolSession[];
  isLoadingHistory: boolean;

  // Actions
  importPatrols: (patrols: PatrolSession[]) => void;
  addCompletedPatrol: (session: PatrolSession) => void;
  startPatrol: () => void;
  addMarker: (marker: MapMarker) => void;
  addSensorLog: (reading: SensorReading) => void;
  addNodeImage: (image: NodeImage) => void;
  addDetectionEvent: (detection: DetectionEvent) => void;
  endPatrol: () => Promise<void>;
  clearHistory: () => void;
  loadPersistedHistory: () => Promise<void>;
}

export const usePatrolStore = create<PatrolStore>((set, get) => ({
  patrolling: false,
  currentSession: null,
  currentMapMarkers: [],
  patrols: [],
  isLoadingHistory: false,

  // ── Merge patrols mẫu (seed demo), sắp mới nhất lên đầu ──
  importPatrols: (patrols) =>
    set((state) => {
      const merged = [...patrols, ...state.patrols].sort((a, b) =>
        b.startTime.localeCompare(a.startTime)
      );
      return { patrols: merged };
    }),

  // Phiên 1 ảnh từ lệnh 'N' (Chụp & Nhận diện) — robot không tuần tra
  addCompletedPatrol: (session) =>
    set((state) => ({
      patrols: [session, ...state.patrols].sort((a, b) =>
        b.startTime.localeCompare(a.startTime)
      ),
    })),

  startPatrol: () => {
    const session: PatrolSession = {
      id: `patrol-${Date.now()}`,
      startTime: new Date().toISOString(),
      images: [],
      mapMarkers: [],
      detections: [],
      sensorLogs: [],
    };
    set({ patrolling: true, currentSession: session, currentMapMarkers: [] });
  },

  addMarker: (marker) => {
    set((state) => {
      const markers = [...state.currentMapMarkers, marker];
      const session = state.currentSession
        ? { ...state.currentSession, mapMarkers: markers }
        : null;
      return { currentMapMarkers: markers, currentSession: session };
    });
  },

  addSensorLog: (reading) => {
    set((state) => {
      if (!state.currentSession) return {};
      const session = {
        ...state.currentSession,
        sensorLogs: [...state.currentSession.sensorLogs, reading],
      };
      return { currentSession: session };
    });
  },

  addNodeImage: (image) => {
    set((state) => {
      if (!state.currentSession) return {};
      const session = {
        ...state.currentSession,
        images: [...state.currentSession.images, image],
      };
      return { currentSession: session };
    });
  },

  addDetectionEvent: (detection) => {
    set((state) => {
      if (!state.currentSession) return {};
      const session = {
        ...state.currentSession,
        detections: [...state.currentSession.detections, detection],
      };
      return { currentSession: session };
    });
  },

  endPatrol: async () => {
    const { currentSession } = get();
    if (!currentSession) return;

    const session: PatrolSession = {
      ...currentSession,
      endTime: new Date().toISOString(),
    };

    // Persist to disk (patrol.json)
    try {
      await updatePatrolJson(session.id, {
        endTime: session.endTime,
        images: session.images,
        mapMarkers: session.mapMarkers,
        detections: session.detections,
        sensorLogs: session.sensorLogs,
      });
      console.log(`[PatrolStore] Patrol ${session.id} persisted to disk`);
    } catch (error) {
      console.warn(`[PatrolStore] Failed to persist patrol:`, error);
    }

    set((state) => ({
      patrolling: false,
      currentSession: null,
      patrols: [session, ...state.patrols],
    }));

    // ── Trend alert: escalate nếu 2+ lần tuần tra liên tiếp tăng ──
    const { patrols: allPatrols } = get();
    const nodeShotPairs = session.images
      .filter((img) => img.analysis?.crackArea != null)
      .map((img) => ({ nodeX2: img.nodeX2, shotKind: img.shotKind }));

    for (const pair of nodeShotPairs) {
      const escalating = shouldEscalateForConsecutiveGrowth(
        allPatrols,
        pair.nodeX2,
        pair.shotKind
      );
      if (escalating) {
        const latest = allPatrols[0]?.images.find(
          (img) => img.nodeX2 === pair.nodeX2 && img.shotKind === pair.shotKind
        );
        const area = latest?.analysis?.crackArea?.toFixed(1) ?? "?";
        useAlertStore.getState().addAlert({
          id: `trend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "crack_increased",
          message: `⚠ Node ${pair.nodeX2} (${(pair.nodeX2 * 0.5).toFixed(1)}m): vết nứt tăng liên tiếp qua ${allPatrols.length} lần tuần tra — diện tích hiện tại ~${area}%`,
          timestamp: new Date().toISOString(),
          read: false,
        });
        console.log(
          `[PatrolStore] Trend alert: node ${pair.nodeX2} tăng liên tiếp sau ${allPatrols.length} lần tuần tra`
        );
      }
    }
  },

  clearHistory: () => set({ patrols: [] }),

  loadPersistedHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const patrols = await loadPersistedPatrols();
      console.log(`[PatrolStore] Loaded ${patrols.length} persisted patrols`);
      set({ patrols });
    } catch (error) {
      console.warn(`[PatrolStore] Failed to load persisted patrols:`, error);
    } finally {
      set({ isLoadingHistory: false });
    }
  },
}));

