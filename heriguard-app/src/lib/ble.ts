import { BleManager, State, type Device } from "react-native-ble-plx";
import { Platform, PermissionsAndroid, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { useDeviceStore } from "@/store/deviceStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { usePatrolStore } from "@/store/patrolStore";
import {
  ROBOT_STATE_VALUES,
  type RobotState,
  type MapMarker,
  type NodeImage,
  type ShotKind,
  type DetectionEvent,
} from "@/types/robot";
import { savePatrolImage } from "@/lib/fileStorage";
import { saveStaticCaptureFromUri } from "@/lib/staticCapture";

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const CHAR_CAMERA_DATA = "12345678-1234-5678-1234-56789abcdef1";
const CHAR_DETECTION = "12345678-1234-5678-1234-56789abcdef2";
const CHAR_SENSOR_DATA = "12345678-1234-5678-1234-56789abcdef3";
const CHAR_COMMAND = "12345678-1234-5678-1234-56789abcdef4";
const CHAR_STATUS = "12345678-1234-5678-1234-56789abcdef5";
const CHAR_MAP_DATA = "12345678-1234-5678-1234-56789abcdef6";

let manager: BleManager | null = null;

function getManager(): BleManager | null {
  if (!manager) {
    try {
      manager = new BleManager();
    } catch {
      manager = null;
    }
  }
  return manager;
}

// ── Helpers ─────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout sau ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function mapBleError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.toLowerCase();
  if (m.includes("timeout")) {
    return "Kết nối quá lâu (timeout). Kiểm tra khoảng cách và bật lại robot.";
  }
  if (m.includes("not connected")) {
    return "Không truy cập được robot — thiết bị có thể đã tắt hoặc rời khỏi phạm vi BLE. Kiểm tra LED robot rồi thử lại.";
  }
  if (m.includes("cancel")) {
    return "Kết nối bị huỷ bởi hệ thống. Hãy quên thiết bị HERI-GUARD trong Cài đặt Bluetooth rồi thử lại.";
  }
  if (m.includes("service") && m.includes("not found")) {
    return "Không tìm thấy service trên robot. Hãy xoá thiết bị cũ trong Bluetooth rồi quét lại.";
  }
  if (m.includes("disconnect") || m.includes("connection") || m.includes("device")) {
    return "Kết nối bị rớt. Hãy thử lại; nếu vẫn lỗi, rút nguồn robot vài giây rồi bật lại.";
  }
  if (m.includes("permission")) {
    return "Chưa được cấp quyền Bluetooth. Hãy cấp quyền rồi thử lại.";
  }
  return msg;
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
}

// Thiết bị đã kết nối gần nhất — dùng để tự kết nối lại khi mở app
const LAST_DEVICE_KEY = "heriguard:lastDevice";

async function saveLastDevice(device: Device) {
  try {
    await AsyncStorage.setItem(
      LAST_DEVICE_KEY,
      JSON.stringify({
        id: device.id,
        name: device.name ?? device.localName ?? "HERI-GUARD",
      })
    );
  } catch {
    // không quan trọng — chỉ dùng để auto-reconnect
  }
}

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

// ── Adapter state ────────────────────────────────────────────
export async function getBleState(): Promise<State | null> {
  const m = getManager();
  if (!m) return null;
  try {
    return await m.state();
  } catch {
    return null;
  }
}

async function waitForPowerOn(timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await getBleState();
    if (state === "PoweredOn") return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export async function tryEnableBluetooth(): Promise<boolean> {
  const m = getManager();
  if (!m) return false;
  try {
    const state = await m.state();
    if (state === "PoweredOn") return true;
    if (state === "PoweredOff") {
      await m.enable();
      return await waitForPowerOn();
    }
    return false;
  } catch {
    return false;
  }
}

// ── Scan ─────────────────────────────────────────────────────
let isScanning = false;

const SERVICE_UUID_SHORT = SERVICE_UUID.replace(/-/g, "").toUpperCase();

// ArduinoBLE bỏ local name khỏi advertisement nếu không đủ 31 byte
// (flags + 128-bit service UUID + name > 31B), nên device.name có thể
// là null trên Android. Luôn match theo service UUID như fallback.
function isHeriGuardDevice(device: Device): boolean {
  const name = device.name ?? device.localName ?? "";
  if (name.includes("HERI-GUARD")) return true;

  const uuids = [...(device.serviceUUIDs ?? []), ...(device.overflowServiceUUIDs ?? [])];
  return uuids.some(
    (uuid) =>
      uuid &&
      uuid.replace(/-/g, "").toUpperCase().startsWith(SERVICE_UUID_SHORT.slice(0, 8))
  );
}

export function startScan(
  onDeviceFound: (device: Device) => void,
  onError?: (message: string) => void
) {
  if (isScanning) return;
  const m = getManager();
  if (!m) return;

  isScanning = true;
  useDeviceStore.getState().setConnectionStatus("scanning");

  m.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
    if (error) {
      console.warn("BLE scan error:", error.message);
      m.stopDeviceScan();
      isScanning = false;
      onError?.(error.message);
      return;
    }
    if (device && isHeriGuardDevice(device)) {
      onDeviceFound(device);
    }
  }).catch(() => { });

  setTimeout(() => {
    m.stopDeviceScan();
    isScanning = false;
  }, 15000);
}

export async function openLocationSettings(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
  } catch {
    Linking.openSettings();
  }
}

export function stopScan() {
  const m = getManager();
  if (!m) return;
  m.stopDeviceScan();
  isScanning = false;
}

// ── Connect ──────────────────────────────────────────────────
let connectedDevice: Device | null = null;
let unsubscribers: (() => void)[] = [];

// Camera chunk reassembly
let cameraChunks: number[][] = [];
let cameraExpectedChunks = 0;
let cameraFrameId = 0;

function bytesToBase64Chunked(bytes: number[]): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function saveJpegBytes(jpegBytes: number[], frameId: number): Promise<string> {
  const root = new Directory(Paths.document, "heriguard", "camera", "frames");
  // createDirectory("") sai API — create() với intermediates tạo đủ chuỗi
  // heriguard/camera/frames, idempotent để gọi lại nhiều lần không lỗi
  root.create({ intermediates: true, idempotent: true });
  const name = `frame_${String(frameId).padStart(4, "0")}.jpg`;
  let file: File;
  try {
    file = root.createFile(name, "image/jpeg");
  } catch {
    // frameId lặp lại (firmware reset) — xoá file cũ rồi tạo mới
    new File(root, name).delete();
    file = root.createFile(name, "image/jpeg");
  }
  const base64 = bytesToBase64Chunked(jpegBytes);
  const fs = await import("expo-file-system");
  const legacy = await import("expo-file-system/legacy");
  await legacy.writeAsStringAsync(file.uri, base64, { encoding: fs.EncodingType.Base64 });
  return file.uri;
}

function handleCameraChunk(data: number[]) {
  // Chunk format (firmware Phase B): [frameId(2), nodeX2(1), shotKind(1), pan(1), tilt(1), chunkIdx(2), totalChunks(2), ...payload]
  if (data.length < 10) return;
  const frameId = data[0] | (data[1] << 8);
  const nodeX2 = data[2];
  const shotKindRaw = data[3];
  const pan = data[4];
  const tilt = data[5];
  const chunkIndex = data[6] | (data[7] << 8);
  const totalChunks = data[8] | (data[9] << 8);
  const payload = data.slice(10);

  if (frameId !== cameraFrameId) {
    cameraChunks = [];
    cameraFrameId = frameId;
    cameraExpectedChunks = totalChunks;
  }

  cameraChunks[chunkIndex] = payload;

  const receivedCount = cameraChunks.filter((c) => c !== undefined).length;
  if (receivedCount === cameraExpectedChunks && cameraExpectedChunks > 0) {
    const jpegBytes = cameraChunks.flat();
    const base64 = bytesToBase64Chunked(jpegBytes);

    // Get current patrol and environment data
    const patrolStore = usePatrolStore.getState();
    const dashboardStore = useDashboardStore.getState();
    const temp = dashboardStore.currentTemp ?? 0;
    const humidity = dashboardStore.currentHumidity ?? 0;
    const currentPatrol = patrolStore.currentSession;

    if (!currentPatrol) {
      // Lệnh 'N' (Chụp & Nhận diện): robot chỉ gửi ảnh. App chạy AI —
      // nếu đạt ngưỡng → lưu ảnh + nhiệt độ/độ ẩm tại node + phân tích.
      const store = useDeviceStore.getState();
      saveJpegBytes(jpegBytes, cameraFrameId)
        .then(async (uri) => {
          const outcome = await saveStaticCaptureFromUri(uri, nodeX2, temp, humidity);
          store.addImage({
            id: `ble-${cameraFrameId}`,
            uri,
            timestamp: new Date().toLocaleTimeString("vi-VN"),
            temp,
            humidity,
            detections: outcome.nodeImage?.detection
              ? [
                  {
                    label: outcome.nodeImage.detection.label,
                    confidence: outcome.nodeImage.detection.confidence,
                  },
                ]
              : undefined,
          });
          if (outcome.reason === "error") {
            console.warn("[BLE] Static capture AI failed:", outcome.error);
          }
        })
        .catch((error) => console.warn("[BLE] Static capture save failed:", error));
      return;
    }

    // nodeX2, shotKind, pan, tilt giờ đến trực tiếp từ firmware (header 10 byte)
    const shotKind: ShotKind = (shotKindRaw as ShotKind) <= 3 ? (shotKindRaw as ShotKind) : 0;
    const node: number = nodeX2;

    // Create NodeImage object
    const nodeImageData: Omit<NodeImage, "uri"> = {
      frameId,
      nodeX2: node,
      shotKind,
      pan,
      tilt,
      timestamp: new Date().toISOString(),
      temperature: temp,
      humidity,
    };

    // Save to disk and update patrol manifest
    savePatrolImage(currentPatrol.id, node, shotKind, frameId, base64, nodeImageData)
      .then((nodeImage) => {
        // Add to patrolStore
        patrolStore.addNodeImage(nodeImage);
        console.log(
          `[BLE] Image saved: node ${node}, shot ${shotKind}, pan ${pan}, tilt ${tilt}, frame ${frameId}`
        );
      })
      .catch((error) => {
        console.warn("[BLE] Failed to save image:", error);
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
  const store = useDeviceStore.getState();
  store.setBatteryLevel(data[0]);
  store.setRssi(data[1] ?? 0);

  // Byte 2: robot_state, Byte 3: patrol_active
  if (data.length >= 4) {
    const stateVal = data[2];
    const robotState: RobotState = ROBOT_STATE_VALUES[stateVal] ?? "idle";
    store.setRobotState(robotState);
    store.setPatrolActive(data[3] === 1);
  }
}

function handleDetectionData(data: number[]) {
  // Detection format (Phase B): [label(1), confidence(1), nodeX2(1), shotKind(1), x(1), y(1), w(1), h(1), temp_lo, temp_hi, hum_lo, hum_hi(4)]
  if (data.length < 12) return;
  const label = data[0];
  const rawConfidence = data[1];
  const rawNodeX2 = data[2];
  const rawShotKind = data[3];
  const bboxX = data[4];
  const bboxY = data[5];
  const bboxW = data[6];
  const bboxH = data[7];
  const tempRaw = (data[8] | (data[9] << 8)) / 100;
  const humidityRaw = (data[10] | (data[11] << 8)) / 100;

  const labelNames: Record<number, string> = {
    0: "crack_small",
    1: "crack_large",
    2: "moss",
    3: "mold",
    4: "stain",
  };
  const detectionLabel = labelNames[label] ?? "unknown";
  const confidence = rawConfidence / 100;

  // Get current patrol
  const patrolStore = usePatrolStore.getState();
  const dashboardStore = useDashboardStore.getState();
  const currentPatrol = patrolStore.currentSession;

  if (!currentPatrol) {
    console.warn(
      "[BLE] Detection received but no active patrol — storing in legacy imageHistory"
    );
    // Fallback: store in deviceStore (legacy behavior)
    const store = useDeviceStore.getState();
    store.addImage({
      id: `detect-${Date.now()}`,
      uri: "",
      timestamp: new Date().toLocaleTimeString("vi-VN"),
      temp: dashboardStore.currentTemp ?? 0,
      humidity: dashboardStore.currentHumidity ?? 0,
      detections: [{ label: detectionLabel, confidence }],
    });
    return;
  }

  // nodeX2 + shotKind giờ đến trực tiếp từ firmware
  const nodeX2 = rawNodeX2;
  const shotKind: ShotKind = (rawShotKind as ShotKind) <= 3 ? (rawShotKind as ShotKind) : 0;
  const temp = tempRaw !== 0 ? tempRaw : (dashboardStore.currentTemp ?? 0);
  const humidity = humidityRaw !== 0 ? humidityRaw : (dashboardStore.currentHumidity ?? 0);

  const detectionEvent: DetectionEvent = {
    id: `detection-${Date.now()}`,
    timestamp: new Date().toISOString(),
    nodeX2,
    shotKind,
    label: detectionLabel,
    confidence,
    bbox: {
      x: bboxX * 4, // QQVGA 160x120 → 640x480
      y: bboxY * 4,
      width: bboxW * 4,
      height: bboxH * 4,
    },
    temperature: temp,
    humidity,
  };

  // Add to patrol
  patrolStore.addDetectionEvent(detectionEvent);
  console.log(
    `[BLE] Detection: node ${nodeX2}, shot ${shotKind}, ${detectionLabel} (${confidence * 100}%)`
  );
}

function handleMapMarker(data: number[]) {
  if (data.length < 9) return;
  const flags = data[1];
  const marker: MapMarker = {
    distanceX2: data[0],
    flags,
    hasLowIssue: (flags & 0x01) !== 0,
    hasHighIssue: (flags & 0x02) !== 0,
    hasMoss: (flags & 0x04) !== 0,
    hasMold: (flags & 0x08) !== 0,
    hasStain: (flags & 0x10) !== 0,
    hasCrackSmall: (flags & 0x20) !== 0,
    hasCrackLarge: (flags & 0x40) !== 0,
    confidence: data[2],
    temperature: (data[3] | (data[4] << 8)) / 100,
    humidity: (data[5] | (data[6] << 8)) / 100,
    timestamp: data[7] | (data[8] << 8),
  };
  usePatrolStore.getState().addMarker(marker);
  // Lưu nhiệt độ/độ ẩm tại điểm kiểm tra vào phiên tuần tra — BLE thật
  // trước đây chỉ thêm marker, phiên tuần tra không bao giờ có sensor log
  usePatrolStore
    .getState()
    .addSensorLog({
      timestamp: new Date().toISOString(),
      temperature: marker.temperature,
      humidity: marker.humidity,
    });
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

  // Monitor TRỰC TIẾP — không gating qua read. Nếu read thất bại (ví dụ
  // charCamera 512 bytes, long read lỗi trên Android), monitor sẽ không bao
  // giờ được gọi → app không nhận bất kỳ notification nào (ảnh, sensor,
  // status, detection, map marker).
  device.monitorCharacteristicForService(SERVICE_UUID, charUuid, (error, characteristic) => {
    if (error || !characteristic?.value || !active) return;
    if (error) console.warn("BLE monitor error for", charUuid, error);
    const bytes = parseCharacteristicData(characteristic.value);
    onData(bytes);
  });

  return () => {
    active = false;
  };
}

// BleErrorCode (react-native-ble-plx) — dùng để phân biệt lỗi thay vì
// so khớp chuỗi message, vì message có thể khác nhau giữa Android/tạo mới
const BLE_EC_DEVICE_ALREADY_CONNECTED = 5;
const BLE_EC_DEVICE_NOT_CONNECTED = 6;

function isBleErrorCode(error: unknown, code: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    (error as { errorCode?: unknown }).errorCode === code
  );
}

// Chống hai luồng connect chạy song song (auto-reconnect + người dùng bấm
// Kết nối trong scan screen). Luồng thứ hai nếu chạy cùng lúc sẽ huỷ kết nối
// của luồng thứ nhất → báo lỗi "Device is not connected".
let connectInFlight: Promise<ConnectResult> | null = null;

export function connectToDevice(device: Device): Promise<ConnectResult> {
  if (connectInFlight) return connectInFlight;
  connectInFlight = doConnectToDevice(device).finally(() => {
    connectInFlight = null;
  });
  return connectInFlight;
}

async function doConnectToDevice(device: Device): Promise<ConnectResult> {
  const store = useDeviceStore.getState();
  store.setConnectionStatus("connecting");

  try {
    let connected: Device;
    try {
      if (await device.isConnected()) {
        // Đã kết nối rồi (ví dụ: toggle mock bật/tắt không reset kết nối thật) —
        // dùng thẳng device hiện tại. connect() lại trên device đã connected sẽ
        // báo lỗi và nếu gọi cancelConnection() sẽ giết luôn kết nối đang sống.
        connected = device;
      } else {
        connected = await withTimeout(device.connect({ timeout: 10000 }), 12000);
      }
    } catch (connectError) {
      // isConnected có thể bị stale (kết nối rớt mà Android chưa báo event,
      // hoặc device object cũ sau reload). Nếu thực tế vẫn connected theo
      // Android (errorCode 5 = already connected) → dùng thẳng, KHÔNG cancel.
      if (isBleErrorCode(connectError, BLE_EC_DEVICE_ALREADY_CONNECTED)) {
        connected = device;
      } else {
        throw connectError;
      }
    }

    // Discover — kết nối có thể rớt ngay sau khi connect() resolve
    // ("Device is not connected": chip robot reset, hết pin, quá xa...).
    // Thử kết nối lại từ đầu 1 lần trước khi báo lỗi.
    try {
      await withTimeout(connected.discoverAllServicesAndCharacteristics(), 10000);
    } catch (discoverError) {
      const dropped =
        isBleErrorCode(discoverError, BLE_EC_DEVICE_NOT_CONNECTED) ||
        isBleErrorCode(discoverError, 2); // OperationTimedOut
      if (!dropped) throw discoverError;

      console.warn("BLE discover failed, retrying connect once:", discoverError);
      await connected.cancelConnection().catch(() => { });
      connected = await withTimeout(device.connect({ timeout: 10000 }), 12000);
      await withTimeout(connected.discoverAllServicesAndCharacteristics(), 10000);
    }

    if (Platform.OS === "android") {
      // Không await — requestMTU có thể treo vĩnh viễn trên một số máy Android
      connected.requestMTU(512).catch(() => {
        // MTU thất bại không ảnh hưởng lệnh điều khiển; hoạt động ở MTU 242 mặc định
      });
    }

    connectedDevice = connected;
    store.setDeviceName(connected.name ?? "HERI-GUARD");
    store.setDeviceId(connected.id);
    store.setConnectionStatus("connected");

    unsubscribers = [
      subscribeToCharacteristic(connected, CHAR_CAMERA_DATA, handleCameraChunk),
      subscribeToCharacteristic(connected, CHAR_SENSOR_DATA, handleSensorData),
      subscribeToCharacteristic(connected, CHAR_STATUS, handleStatusData),
      subscribeToCharacteristic(connected, CHAR_DETECTION, handleDetectionData),
      subscribeToCharacteristic(connected, CHAR_MAP_DATA, handleMapMarker),
    ];

    // Listen for disconnect
    const disconnectSub = connected.onDisconnected(() => {
      disconnect();
    });
    unsubscribers.push(() => disconnectSub.remove());

    useDashboardStore.getState().setBleConnected(true);
    saveLastDevice(connected);
    return { ok: true };
  } catch (error) {
    console.warn("BLE connect error:", error);
    // Dọn connection dang dở để không "mắc kẹt" ở trạng thái connecting
    try {
      await device.cancelConnection();
    } catch {
      // ignore
    }
    store.setConnectionStatus("disconnected");
    return { ok: false, error: mapBleError(error) };
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
    connectedDevice.cancelConnection().catch(() => { });
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

  // ble-plx yêu cầu giá trị Base64 hợp lệ — ký tự trần như "C"/"P"
  // sẽ bị Android từ chối ("invalid data format")
  const cmdBytes = [command.charCodeAt(0), ...(payload ?? [])];
  const binary = String.fromCharCode(...cmdBytes);
  const cmdBase64 = btoa(binary);

  try {
    await connectedDevice.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_COMMAND,
      cmdBase64
    );
    return true;
  } catch (error) {
    console.warn("sendCommand failed:", command, error);
    return false;
  }
}

// ── Auto-reconnect ───────────────────────────────────────────
// Tự kết nối lại thiết bị đã ghép lần trước (khi mở lại app).
// Trả về false nếu không có thiết bị đã lưu / không thể kết nối.
export async function tryReconnectLastDevice(): Promise<boolean> {
  const m = getManager();
  if (!m) return false;

  const { connectionStatus } = useDeviceStore.getState();
  if (
    connectionStatus === "connected" ||
    connectionStatus === "connecting" ||
    connectionStatus === "scanning"
  ) {
    return false;
  }
  // Đã có kết nối BLE thật đang chạy (ví dụ toggle mock bật/tắt
  // không được reset state) — không kết nối lại làm gì
  if (useDashboardStore.getState().bleConnected) return true;

  let saved: { id?: string; name?: string } | null = null;
  try {
    const raw = await AsyncStorage.getItem(LAST_DEVICE_KEY);
    if (!raw) return false;
    saved = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!saved?.id) return false;

  let devices: Device[] = [];
  try {
    devices = await withTimeout(m.devices([saved.id]), 5000);
  } catch {
    return false;
  }
  const device = devices[0];
  if (!device) return false;

  const result = await connectToDevice(device);
  return result.ok;
}
