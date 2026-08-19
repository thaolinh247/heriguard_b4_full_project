import type { ChartDataPoint } from "@/types/dashboard";

/**
 * ─────────────────────────────────────────────────────────────
 * DEMO CHART — dữ liệu biểu đồ nhiệt độ/độ ẩm CỐ ĐỊNH
 *
 * Chu kỳ 24 giờ (00:00 → 23:00), deterministic — không random:
 *   - Nhiệt độ: 25.0–30.0°C, đỉnh lúc 15h, thấp nhất lúc 3h
 *     (khớp dải SEV_TEMP trong demoView: 26.2–29.6°C)
 *   - Độ ẩm: 60–74%, đỉnh sáng sớm, thấp nhất buổi chiều
 *
 * Dùng khi chưa có dữ liệu thật (chưa kết nối robot) —
 * biểu đồ luôn có nội dung như phần Điểm chụp.
 * ─────────────────────────────────────────────────────────────
 */

function buildDemoChartPoints(): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const temp = 27.5 + 2.5 * Math.sin(((h - 9) / 24) * 2 * Math.PI);
    const humidity = 67 + 7 * Math.sin(((h - 15) / 24) * 2 * Math.PI);
    points.push({
      time: `${String(h).padStart(2, "0")}:00:00`,
      temp: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
    });
  }
  return points;
}

const DEMO_CHART_POINTS = buildDemoChartPoints();

/** Lấy 24 điểm dữ liệu mẫu cố định (00:00 → 23:00) */
export function getDemoChartPoints(): ChartDataPoint[] {
  return DEMO_CHART_POINTS;
}