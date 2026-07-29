import { View, Text, Image } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors } from "@/constants/theme";

export function StatusCard() {
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const lastUpdate = useDashboardStore((s) => s.lastUpdate);

  return (
    <View className="bg-paper border border-line rounded-sm p-5 relative">
      {/* Gold corner decorations */}
      <View className="absolute -top-1 -left-1 w-2 h-2 rotate-45" style={{ backgroundColor: Colors.gold }} />
      <View className="absolute -bottom-1 -right-1 w-2 h-2 rotate-45" style={{ backgroundColor: Colors.gold }} />

      {/* Label */}
      <Text
        className="absolute -top-3 left-5 bg-paper px-2 text-xs font-mono uppercase tracking-widest"
        style={{ color: Colors.jade }}
      >
        Ghi hình hiện trường
      </Text>

      {/* Camera frame */}
      <View className="rounded-sm overflow-hidden aspect-[4/3] mb-4" style={{ backgroundColor: Colors.jadeLight }}>
        <Image
          source={require("@/assets/images/tutorial-web.png")}
          className="w-full h-full"
          resizeMode="cover"
        />
        {/* OSD overlay */}
        <View className="absolute top-2.5 right-2.5 px-2 py-1 rounded-sm" style={{ backgroundColor: "rgba(20,26,24,0.62)" }}>
          <Text className="text-xs font-mono" style={{ color: Colors.cream }}>
            {lastUpdate ?? "—"}
          </Text>
        </View>
      </View>

      {/* Readings row */}
      <View className="flex-row gap-4 pt-4 border-t border-dashed" style={{ borderColor: Colors.line }}>
        <View className="flex-1">
          <Text className="text-xs font-mono uppercase tracking-wider" style={{ color: Colors.inkSoft }}>
            Nhiệt độ hiện tại
          </Text>
          <Text className="text-2xl font-mono font-semibold mt-0.5" style={{ color: Colors.lacquerDark }}>
            {temp !== null ? `${temp.toFixed(1)}°C` : "—"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xs font-mono uppercase tracking-wider" style={{ color: Colors.inkSoft }}>
            Độ ẩm hiện tại
          </Text>
          <Text className="text-2xl font-mono font-semibold mt-0.5" style={{ color: Colors.jade }}>
            {humidity !== null ? `${humidity.toFixed(1)}%` : "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}
