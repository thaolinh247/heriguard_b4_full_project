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

export interface TrendAnalysis {
  direction: "improving" | "stable" | "deteriorating";
  summary: string;
  tempTrend: string;
  humidityTrend: string;
  detectionTrend: string;
  insights: string[];
  recommendations: string[];
}
