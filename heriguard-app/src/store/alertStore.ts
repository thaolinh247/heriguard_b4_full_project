import { create } from "zustand";
import type { Alert } from "@/types/robot";

import type { DetectionEvent } from "./detectionStore";

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (alert: Alert) => void;
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  triggerFromDetection: (detection: DetectionEvent) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
    })),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (state.alerts.find((a) => a.id === id && !a.read) ? 1 : 0)),
    })),
  dismissAll: () => set({ alerts: [], unreadCount: 0 }),
  markAsRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  clearAll: () => set({ alerts: [], unreadCount: 0 }),
  triggerFromDetection: (detection) => {
    const { alerts } = get();
    const duplicate = alerts.some(
      (a) => a.type === `detect_${detection.label}` && a.timestamp === detection.timestamp
    );
    if (duplicate) return;
    get().addAlert({
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: `detect_${detection.label}`,
      message: `Phát hiện ${detection.label} tại vị trí ${(detection.distanceX2 * 0.5).toFixed(1)}m — độ tin cậy ${(detection.confidence * 100).toFixed(0)}%`,
      timestamp: detection.timestamp,
      read: false,
    });
  },
}));
