import { create } from "zustand";

export type ConnectionStatus = "idle" | "scanning" | "connecting" | "connected" | "disconnected";

export interface CameraImage {
  id: string;
  uri: string;
  timestamp: string;
  temp: number;
  humidity: number;
  detections?: { label: string; confidence: number }[];
}

interface DeviceState {
  deviceName: string | null;
  deviceId: string | null;
  connectionStatus: ConnectionStatus;
  batteryLevel: number;
  rssi: number;
  latestImage: CameraImage | null;
  imageHistory: CameraImage[];
  setDeviceName: (name: string | null) => void;
  setDeviceId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setBatteryLevel: (level: number) => void;
  setRssi: (rssi: number) => void;
  addImage: (image: CameraImage) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  deviceName: null,
  deviceId: null,
  connectionStatus: "idle",
  batteryLevel: 0,
  rssi: 0,
  latestImage: null,
  imageHistory: [],
  setDeviceName: (name) => set({ deviceName: name }),
  setDeviceId: (id) => set({ deviceId: id }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setBatteryLevel: (level) => set({ batteryLevel: level }),
  setRssi: (rssi) => set({ rssi }),
  addImage: (image) =>
    set((state) => ({
      latestImage: image,
      imageHistory: [image, ...state.imageHistory].slice(0, 50),
    })),
}));
