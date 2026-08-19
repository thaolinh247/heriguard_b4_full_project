export interface GeminiFinding {
  type: string;
  description: string;
  confidence: number;
}

export interface ConditionAssessment {
  severity: string;
  assessment: string;
  needsSupport: boolean;
}

export interface GeminiAnalysis {
  severity: "low" | "medium" | "high";
  summary: string;
  findings: GeminiFinding[];
  envAssessment: string;
  correlations: string[];
  conditionAssessment: ConditionAssessment;
}

export interface TrendDataPoint {
  timestamp: string;
  temp: number;
  humidity: number;
  detections: { label: string; confidence: number }[];
}

export interface TrendDayDetail {
  day: string; // tên ngày (VD: NGÀY 3)
  date: string; // ngày tháng
  temp: number;
  humidity: number;
  detections: number; // số ảnh phát hiện
  severity: string; // mức độ hư hại
  note: string; // nhận xét riêng cho ngày đó
}

export interface TrendAnalysis {
  direction: "improving" | "stable" | "deteriorating";
  summary: string;
  tempTrend: string;
  humidityTrend: string;
  detectionTrend: string;
  dayDetails: TrendDayDetail[];
  insights: string[];
  recommendations: string[];
}
