import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Device } from "react-native-ble-plx";
import { Colors, Font } from "@/constants/theme";
import { requestBlePermissions, startScan, stopScan, connectToDevice } from "@/lib/ble";

export default function ScanScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDeviceFound = useCallback((device: Device) => {
    setDevices((prev) => {
      const exists = prev.some((d) => d.id === device.id);
      return exists ? prev : [...prev, device];
    });
  }, []);

  const handleScan = useCallback(async () => {
    setError(null);
    setDevices([]);
    const granted = await requestBlePermissions();
    if (!granted) {
      setError("Cần cấp quyền Bluetooth để quét thiết bị.");
      return;
    }
    setScanning(true);
    startScan(onDeviceFound);
    setTimeout(() => setScanning(false), 15000);
  }, [onDeviceFound]);

  useEffect(() => {
    handleScan();
    return () => {
      stopScan();
    };
  }, []);

  const handleConnect = async (device: Device) => {
    setConnectingId(device.id);
    setError(null);
    stopScan();
    const ok = await connectToDevice(device);
    if (ok) {
      router.back();
    } else {
      setConnectingId(null);
      setError(`Không thể kết nối tới ${device.name ?? "HERI-GUARD"}. Thử lại.`);
    }
  };

  const renderDevice = ({ item }: { item: Device }) => {
    const isConnecting = item.id === connectingId;
    return (
      <TouchableOpacity
        style={styles.deviceRow}
        onPress={() => handleConnect(item)}
        disabled={isConnecting}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name ?? "HERI-GUARD"}</Text>
          <Text style={styles.deviceId}>ID: {item.id.slice(0, 20)}…</Text>
        </View>
        {isConnecting ? (
          <ActivityIndicator size="small" color={Colors.jade} />
        ) : (
          <Text style={styles.connectText}>Kết nối</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quét thiết bị</Text>
        <Text style={styles.subtitle}>
          {scanning ? "Đang tìm robot HERI-GUARD…" : `${devices.length} thiết bị tìm thấy`}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {scanning && devices.length === 0 && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.jade} />
          <Text style={styles.loadingText}>Đang quét…</Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !scanning ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Không tìm thấy thiết bị nào.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleScan}>
                <Text style={styles.retryBtnText}>Quét lại</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {!scanning && devices.length > 0 && (
        <TouchableOpacity style={styles.rescanBtn} onPress={handleScan}>
          <Text style={styles.rescanBtnText}>Quét lại</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 20,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  errorBar: {
    margin: 16,
    padding: 10,
    backgroundColor: Colors.lacquer,
    borderRadius: 2,
  },
  errorText: {
    fontFamily: Font.regular,
    fontSize: 12,
    color: Colors.paper,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.inkSoft,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.paper,
    padding: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontFamily: Font.bold,
    fontSize: 14,
    color: Colors.ink,
  },
  deviceId: {
    fontFamily: Font.regular,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  connectText: {
    fontFamily: Font.bold,
    fontSize: 12,
    color: Colors.jade,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    gap: 16,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: 13,
    color: Colors.inkSoft,
  },
  retryBtn: {
    backgroundColor: Colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 2,
  },
  retryBtnText: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.paper,
  },
  rescanBtn: {
    margin: 16,
    backgroundColor: Colors.ink,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: "center",
  },
  rescanBtnText: {
    fontFamily: Font.bold,
    fontSize: 13,
    color: Colors.paper,
  },
});
