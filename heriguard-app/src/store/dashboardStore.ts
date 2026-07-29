import { create } from "zustand";
import type { RiskLevel } from "@/constants/theme";
import type { ChartDataPoint, DashboardState } from "@/types/dashboard";

const MAX_CHART_POINTS = 50;

function assessRisk(temp: number, humidity: number): RiskLevel {
  if (humidity > 75 || temp > 30) return "high";
  if (humidity > 68 || temp > 28 || humidity < 45) return "medium";
  return "low";
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  currentTemp: null,
  currentHumidity: null,
  chartData: [],
  riskLevel: null,
  bleConnected: false,
  lastUpdate: null,

  updateSensor: (temp: number, humidity: number) => {
    const risk = assessRisk(temp, humidity);
    const now = new Date().toLocaleTimeString("vi-VN");
    set({
      currentTemp: temp,
      currentHumidity: humidity,
      riskLevel: risk,
      lastUpdate: now,
    });
    get().pushChartData({ time: now, temp, humidity });
  },

  pushChartData: (point: ChartDataPoint) => {
    set((state) => {
      const newData = [...state.chartData, point];
      if (newData.length > MAX_CHART_POINTS) {
        newData.shift();
      }
      return { chartData: newData };
    });
  },

  setBleConnected: (connected: boolean) => set({ bleConnected: connected }),

  reset: () =>
    set({
      currentTemp: null,
      currentHumidity: null,
      chartData: [],
      riskLevel: null,
      lastUpdate: null,
    }),
}));
