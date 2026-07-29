import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { Colors, RiskLabels, type RiskLevel } from "@/constants/theme";

function generateAnalysis(temp: number | null, humidity: number | null, risk: RiskLevel | null): string {
  if (temp === null || humidity === null) {
    return "Chưa có dữ liệu cảm biến.";
  }

  let msg = `Nhiệt độ hiện tại: ${temp.toFixed(1)}°C, độ ẩm: ${humidity.toFixed(1)}%. `;
  msg += `Mức đánh giá: ${risk ? RiskLabels[risk] : "—"}. `;

  if (risk === "high") {
    msg += "Điều kiện ngoài ngưỡng an toàn cho di tích. Cần kiểm tra hệ thống thông gió/làm mát và giảm độ ẩm.";
  } else if (risk === "medium") {
    msg += "Điều kiện gần ngưỡng, cần theo dõi sát và chuẩn bị biện pháp điều hòa.";
  } else {
    msg += "Điều kiện nằm trong ngưỡng an toàn cho bảo tồn di tích.";
  }

  return msg;
}

export function AIAnalysisPanel() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const temp = useDashboardStore((s) => s.currentTemp);
  const humidity = useDashboardStore((s) => s.currentHumidity);
  const riskLevel = useDashboardStore((s) => s.riskLevel);

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      const result = generateAnalysis(temp, humidity, riskLevel);
      setAnalysis(result);
      setLoading(false);
    }, 800);
  };

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
        Nhận định
      </Text>

      {/* Header */}
      <View className="flex-row justify-between items-center gap-3 flex-wrap mt-1">
        <Text
          className="text-xs font-mono px-3 py-1.5 rounded-full border"
          style={{
            color: riskLevel ? Colors[riskLevel === "high" ? "lacquer" : riskLevel === "medium" ? "gold" : "jade"] : Colors.inkSoft,
            borderColor: riskLevel ? Colors[riskLevel === "high" ? "lacquer" : riskLevel === "medium" ? "gold" : "jade"] : Colors.inkSoft,
          }}
        >
          {riskLevel ? RiskLabels[riskLevel] : "Chờ dữ liệu…"}
        </Text>
        <TouchableOpacity
          onPress={handleAnalyze}
          disabled={loading}
          className="px-4 py-2.5 rounded-sm"
          style={{
            backgroundColor: loading ? Colors.ink + "80" : Colors.ink,
          }}
        >
          <Text className="text-sm font-semibold" style={{ color: Colors.cream }}>
            {loading ? "Đang phân tích…" : "Phân tích ngay"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Analysis body */}
      <View className="mt-4 pl-4 border-l-2 min-h-12" style={{ borderColor: Colors.gold }}>
        {loading ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={Colors.inkSoft} />
            <Text className="text-sm italic" style={{ color: Colors.inkSoft }}>
              Đang phân tích…
            </Text>
          </View>
        ) : (
          <Text className="text-sm" style={{ color: Colors.ink }}>
            {analysis ?? "Chờ nhận dữ liệu cảm biến để đánh giá điều kiện môi trường."}
          </Text>
        )}
      </View>
    </View>
  );
}
