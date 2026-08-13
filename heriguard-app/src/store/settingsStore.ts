import { create } from "zustand";
import { DEFAULT_GEMINI_API_KEY } from "@/config/apiKey";

interface SettingsState {
  mockMode: boolean;
  bleDeviceName: string;
  stationId: string;
  geminiApiKey: string;
  geminiMockMode: boolean;
  setMockMode: (enabled: boolean) => void;
  setBleDeviceName: (name: string) => void;
  setStationId: (id: string) => void;
  setGeminiApiKey: (key: string) => void;
  setGeminiMockMode: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  mockMode: true,
  bleDeviceName: "HERI-GUARD-01",
  stationId: "#01",
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  geminiMockMode: false,
  setMockMode: (enabled) => set({ mockMode: enabled }),
  setBleDeviceName: (name) => set({ bleDeviceName: name }),
  setStationId: (id) => set({ stationId: id }),
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),
  setGeminiMockMode: (enabled) => set({ geminiMockMode: enabled }),
}));
