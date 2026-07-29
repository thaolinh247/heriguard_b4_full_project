import { Text } from "react-native";
import { useDashboardStore } from "@/store/dashboardStore";
import { RiskColors, RiskLabels } from "@/constants/theme";

export function RiskBadge() {
  const riskLevel = useDashboardStore((s) => s.riskLevel);

  const label = riskLevel ? RiskLabels[riskLevel] : "Chờ dữ liệu…";
  const color = riskLevel ? RiskColors[riskLevel] : "#6b6258";

  return (
    <Text
      className="text-xs font-mono px-3 py-1.5 rounded-full border"
      style={{ color, borderColor: color }}
    >
      {label}
    </Text>
  );
}
