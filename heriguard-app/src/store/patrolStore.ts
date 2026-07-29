import { create } from "zustand";
import type { MapMarker, PatrolSession, SensorReading } from "@/types/robot";

interface PatrolStore {
  patrolling: boolean;
  currentSession: PatrolSession | null;
  currentMapMarkers: MapMarker[];
  patrols: PatrolSession[];
  startPatrol: () => void;
  addMarker: (marker: MapMarker) => void;
  addSensorLog: (reading: SensorReading) => void;
  endPatrol: () => void;
  clearHistory: () => void;
}

export const usePatrolStore = create<PatrolStore>((set, get) => ({
  patrolling: false,
  currentSession: null,
  currentMapMarkers: [],
  patrols: [],

  startPatrol: () => {
    const session: PatrolSession = {
      id: `patrol-${Date.now()}`,
      startTime: new Date().toISOString(),
      mapMarkers: [],
      imageUris: [],
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

  endPatrol: () => {
    const { currentSession } = get();
    if (!currentSession) return;
    const session: PatrolSession = {
      ...currentSession,
      endTime: new Date().toISOString(),
    };
    set((state) => ({
      patrolling: false,
      currentSession: null,
      patrols: [session, ...state.patrols],
    }));
  },

  clearHistory: () => set({ patrols: [] }),
}));
