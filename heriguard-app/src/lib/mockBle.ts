import { useDashboardStore } from "@/store/dashboardStore";
import { useDeviceStore, type CameraImage } from "@/store/deviceStore";

let intervalId: ReturnType<typeof setInterval> | null = null;

function randomInRange(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function generateMockImage(temp: number, humidity: number): CameraImage {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN");
  const dateStr = now.toLocaleDateString("vi-VN");
  return {
    id: `mock-${Date.now()}`,
    uri: `https://picsum.photos/320/240?random=${Date.now()}`,
    timestamp: `${dateStr} ${timeStr}`,
    temp,
    humidity,
    detections: Math.random() > 0.7
      ? [{ label: "crack", confidence: randomInRange(0.6, 0.95) }]
      : undefined,
  };
}

export function startMockBle() {
  const { connectionStatus } = useDeviceStore.getState();
  if (connectionStatus === "connected") return;

  const deviceStore = useDeviceStore.getState();
  deviceStore.setConnectionStatus("connecting");

  setTimeout(() => {
    deviceStore.setDeviceName("HERI-GUARD-01");
    deviceStore.setDeviceId("AA:BB:CC:DD:EE:FF");
    deviceStore.setConnectionStatus("connected");
    deviceStore.setBatteryLevel(randomInRange(70, 98));
    useDashboardStore.getState().setBleConnected(true);

    intervalId = setInterval(() => {
      const temp = randomInRange(24, 34);
      const humidity = randomInRange(45, 82);

      useDashboardStore.getState().updateSensor(temp, humidity);
      useDeviceStore.getState().setBatteryLevel(randomInRange(70, 98));

      if (Math.random() > 0.6) {
        const img = generateMockImage(temp, humidity);
        useDeviceStore.getState().addImage(img);
      }
    }, 2000);
  }, 1200);
}

export function stopMockBle() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  useDashboardStore.getState().setBleConnected(false);
  const deviceStore = useDeviceStore.getState();
  deviceStore.setConnectionStatus("disconnected");
  deviceStore.setDeviceName(null);
  deviceStore.setDeviceId(null);
  deviceStore.setBatteryLevel(0);
}
