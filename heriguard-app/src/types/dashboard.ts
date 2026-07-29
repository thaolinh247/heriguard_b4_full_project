import type { RiskLevel } from "@/constants/theme";

export interface ChartDataPoint {
  time: string;
  temp: number;
  humidity: number;
}

export interface DashboardState {
  currentTemp: number | null;
  currentHumidity: number | null;
  chartData: ChartDataPoint[];
  riskLevel: RiskLevel | null;
  bleConnected: boolean;
  lastUpdate: string | null;
  updateSensor: (temp: number, humidity: number) => void;
  pushChartData: (point: ChartDataPoint) => void;
  setBleConnected: (connected: boolean) => void;
  reset: () => void;
}
