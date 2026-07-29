export interface GeminiFinding {
  type: string;
  description: string;
  confidence: number;
}

export interface GeminiAnalysis {
  severity: "low" | "medium" | "high";
  summary: string;
  findings: GeminiFinding[];
  envAssessment: string;
  correlations: string[];
  recommendations: string[];
}
