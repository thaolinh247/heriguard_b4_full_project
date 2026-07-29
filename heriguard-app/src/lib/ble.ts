import { BleManager, type Device } from "react-native-ble-plx";
import { Platform, PermissionsAndroid } from "react-native";
import { useDeviceStore } from "@/store/deviceStore";
import { useDashboardStore } from "@/store/dashboardStore";

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const CHAR_CAMERA_DATA = "12345678-1234-5678-1234-56789abcdef1";
const CHAR_SENSOR_DATA = "12345678-1234-5678-1234-56789abcdef3";
const CHAR_COMMAND = "12345678-1234-5678-1234-56789abcdef4";
const CHAR_STATUS = "12345678-1234-5678-1234-56789abcdef5";

const manager = new BleManager();

// ── Permissions ──────────────────────────────────────────────
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    const apiLevel = Platform.Version;
    if (apiLevel < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        { title: "Bluetooth Permission", message: "HERI-GUARD needs Bluetooth to connect to the robot.", buttonPositive: "Allow" }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    return (
      results["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED &&
      results["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED &&
      results["android.permission.ACCESS_FINE_LOCATION"] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  return true;
}

// ── Scan ─────────────────────────────────────────────────────
let isScanning = false;

export function startScan(onDeviceFound: (device: Device) => void) {
  if (isScanning) return;
  isScanning = true;

  useDeviceStore.getState().setConnectionStatus("scanning");

  manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      console.warn("BLE scan error:", error.message);
      isScanning = false;
      return;
    }
    if (device && device.name?.includes("HERI-GUARD")) {
      onDeviceFound(device);
    }
  });

  setTimeout(() => {
    manager.stopDeviceScan();
    isScanning = false;
  }, 15000);
}

export function stopScan() {
  manager.stopDeviceScan();
  isScanning = false;
}

// ── Connect ──────────────────────────────────────────────────
let connectedDevice: Device | null = null;
let unsubscribers: (() => void)[] = [];

// Camera chunk reassembly
let cameraChunks: number[][] = [];
let cameraExpectedChunks = 0;
let cameraFrameId = 0;

function handleCameraChunk(data: number[]) {
  // Chunk format: [frameId(2), chunkIndex(2), totalChunks(2), ...payload]
  if (data.length < 6) return;
  const frameId = data[0] | (data[1] << 8);
  const chunkIndex = data[2] | (data[3] << 8);
  const totalChunks = data[4] | (data[5] << 8);
  const payload = data.slice(6);

  if (frameId !== cameraFrameId) {
    cameraChunks = [];
    cameraFrameId = frameId;
    cameraExpectedChunks = totalChunks;
  }

  cameraChunks[chunkIndex] = payload;

  const receivedCount = cameraChunks.filter((c) => c !== undefined).length;
  if (receivedCount === cameraExpectedChunks && cameraExpectedChunks > 0) {
    const jpegBytes = cameraChunks.flat();
    const jpegData = new Uint8Array(jpegBytes);
    const blob = new Blob([jpegData], { type: "image/jpeg" });
    const uri = URL.createObjectURL(blob);

    const store = useDeviceStore.getState();
    const temp = useDashboardStore.getState().currentTemp ?? 0;
    const humidity = useDashboardStore.getState().currentHumidity ?? 0;

    store.addImage({
      id: `ble-${frameId}`,
      uri,
      timestamp: new Date().toLocaleTimeString("vi-VN"),
      temp,
      humidity,
    });

    cameraChunks = [];
    cameraExpectedChunks = 0;
  }
}

function handleSensorData(data: number[]) {
  if (data.length < 4) return;
  const temp = (data[0] | (data[1] << 8)) / 100;
  const humidity = (data[2] | (data[3] << 8)) / 100;
  useDashboardStore.getState().updateSensor(temp, humidity);
}

function handleStatusData(data: number[]) {
  if (data.length < 2) return;
  useDeviceStore.getState().setBatteryLevel(data[0]);
  useDeviceStore.getState().setRssi(data.length > 1 ? data[1] : 0);
}

function parseCharacteristicData(base64Value: string): number[] {
  const binary = atob(base64Value);
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    bytes.push(binary.charCodeAt(i));
  }
  return bytes;
}

function subscribeToCharacteristic(
  device: Device,
  charUuid: string,
  onData: (data: number[]) => void
): () => void {
  let active = true;

  device
    .readCharacteristicForService(SERVICE_UUID, charUuid)
    .then(() =>
      device.monitorCharacteristicForService(SERVICE_UUID, charUuid, (error, characteristic) => {
        if (error || !characteristic?.value || !active) return;
        const bytes = parseCharacteristicData(characteristic.value);
        onData(bytes);
      })
    )
    .catch(() => {});

  return () => {
    active = false;
  };
}

export async function connectToDevice(device: Device): Promise<boolean> {
  const store = useDeviceStore.getState();
  store.setConnectionStatus("connecting");

  try {
    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    connectedDevice = connected;
    store.setDeviceName(connected.name ?? "HERI-GUARD");
    store.setDeviceId(connected.id);
    store.setConnectionStatus("connected");

    unsubscribers = [
      subscribeToCharacteristic(connected, CHAR_CAMERA_DATA, handleCameraChunk),
      subscribeToCharacteristic(connected, CHAR_SENSOR_DATA, handleSensorData),
      subscribeToCharacteristic(connected, CHAR_STATUS, handleStatusData),
    ];

    // Listen for disconnect
    connected.onDisconnected(() => {
      disconnect();
    });

    useDashboardStore.getState().setBleConnected(true);
    return true;
  } catch (error) {
    console.warn("BLE connect error:", error);
    store.setConnectionStatus("disconnected");
    return false;
  }
}

// ── Disconnect ───────────────────────────────────────────────
export function disconnect() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  cameraChunks = [];
  cameraExpectedChunks = 0;
  cameraFrameId = 0;

  if (connectedDevice) {
    connectedDevice.cancelConnection().catch(() => {});
    connectedDevice = null;
  }

  const store = useDeviceStore.getState();
  store.setConnectionStatus("disconnected");
  store.setDeviceName(null);
  store.setDeviceId(null);
  store.setBatteryLevel(0);
  store.setRssi(0);

  useDashboardStore.getState().setBleConnected(false);
}

// ── Send Command ─────────────────────────────────────────────
export async function sendCommand(command: string, payload?: number[]): Promise<boolean> {
  if (!connectedDevice) return false;

  const cmdBytes = [command.charCodeAt(0), ...(payload ?? [])];
  const cmdStr = String.fromCharCode(...cmdBytes);

  try {
    await connectedDevice.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_COMMAND,
      cmdStr
    );
    return true;
  } catch {
    return false;
  }
}
