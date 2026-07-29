import { View, Text } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors } from "@/constants/theme";

export function ConnectionBar() {
  const connected = useDashboardStore((s) => s.bleConnected);

  return (
    <View className="flex-row items-center gap-2 mb-4">
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: connected ? Colors.jade : Colors.lacquer }}
      />
      <Text className="text-xs font-mono" style={{ color: Colors.inkSoft }}>
        {connected ? "BLE đã kết nối — HERI-GUARD-01" : "BLE đang kết nối lại…"}
      </Text>
    </View>
  );
}
