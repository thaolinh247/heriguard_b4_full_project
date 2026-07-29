import { View, Text } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors } from "@/constants/theme";

export function TopBar() {
  const bleConnected = useDashboardStore((s) => s.bleConnected);
  const lastUpdate = useDashboardStore((s) => s.lastUpdate);
  const stationId = useSettingsStore((s) => s.stationId);

  return (
    <View className="flex-row justify-between items-end flex-wrap gap-4 pb-5 mb-7 border-b border-line">
      <View className="flex-row items-center gap-3">
        <View
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: bleConnected ? Colors.jade : Colors.lacquer }}
        />
        <View>
          <Text
            className="text-2xl font-semibold"
            style={{ fontFamily: "Iowan Old Style", fontStyle: "italic", color: Colors.ink }}
          >
            HERI-GUARD
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: Colors.inkSoft }}>
            Hệ thống giám sát môi trường bảo tồn di tích
          </Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-xs font-mono" style={{ color: Colors.inkSoft }}>
          Trạm quan trắc{" "}
          <Text className="font-semibold" style={{ color: Colors.ink }}>
            {stationId}
          </Text>
        </Text>
        <Text className="text-xs font-mono" style={{ color: Colors.inkSoft }}>
          Cập nhật lúc{" "}
          <Text className="font-semibold" style={{ color: Colors.ink }}>
            {lastUpdate ?? "—"}
          </Text>
        </Text>
      </View>
    </View>
  );
}
