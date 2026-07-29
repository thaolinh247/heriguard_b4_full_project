import { create } from "zustand";
import type { RobotState } from "@/types/robot";

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
  robotState: RobotState;
  patrolActive: boolean;
  latestImage: CameraImage | null;
  imageHistory: CameraImage[];
  setDeviceName: (name: string | null) => void;
  setDeviceId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setBatteryLevel: (level: number) => void;
  setRssi: (rssi: number) => void;
  setRobotState: (state: RobotState) => void;
  setPatrolActive: (active: boolean) => void;
  addImage: (image: CameraImage) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  deviceName: null,
  deviceId: null,
  connectionStatus: "idle",
  batteryLevel: 0,
  rssi: 0,
  robotState: "idle",
  patrolActive: false,
  latestImage: null,
  imageHistory: [],
  setDeviceName: (name) => set({ deviceName: name }),
  setDeviceId: (id) => set({ deviceId: id }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setBatteryLevel: (level) => set({ batteryLevel: level }),
  setRssi: (rssi) => set({ rssi }),
  setRobotState: (state) => set({ robotState: state }),
  setPatrolActive: (active) => set({ patrolActive: active }),
  addImage: (image) =>
    set((state) => ({
      latestImage: image,
      imageHistory: [image, ...state.imageHistory].slice(0, 50),
    })),
}));
