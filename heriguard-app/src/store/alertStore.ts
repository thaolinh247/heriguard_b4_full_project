import { create } from "zustand";
import type { Alert } from "@/types/robot";

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (alert: Alert) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  clearAll: () => set({ alerts: [], unreadCount: 0 }),
}));
