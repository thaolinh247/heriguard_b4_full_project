import { create } from "zustand";

interface SettingsState {
  mockMode: boolean;
  bleDeviceName: string;
  stationId: string;
  setMockMode: (enabled: boolean) => void;
  setBleDeviceName: (name: string) => void;
  setStationId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  mockMode: true,
  bleDeviceName: "HERI-GUARD-01",
  stationId: "#01",
  setMockMode: (enabled) => set({ mockMode: enabled }),
  setBleDeviceName: (name) => set({ bleDeviceName: name }),
  setStationId: (id) => set({ stationId: id }),
}));
