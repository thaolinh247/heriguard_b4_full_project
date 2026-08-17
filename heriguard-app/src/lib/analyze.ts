import type {
    DetectionInImage,
    CrackSeverity,
} from "@/types/robot";

/**
 * Single image analysis — combine Edge-AI detection with environment data
 * Output: severity + findings ready for storage in patrol.json
 */

export interface AnalysisInput {
    detection?: DetectionInImage; // From camera/Edge-AI
    temperature: number;
    humidity: number;
    laserDistance?: number;
    timestamp: string;
}

export interface AnalysisOutput {
    severity: CrackSeverity;
    crackArea?: number; // 0-100, estimate from bbox
    crackCount?: number; // 1 if has detection
    findings: string;
}

/**
 * Compute crack severity based on confidence + bbox area
 * Heuristic mapping: confidence alone is insufficient, combine with geometry
 */
function computeSeverity(confidence: number, area?: number): CrackSeverity {
    // Confidence 0.7+ with area 5%+ = high risk
    if (confidence >= 0.75 && (area ?? 0) >= 5) {
        return "high";
    }
    // Confidence 0.6-0.75 or area 2-5% = medium
    if (confidence >= 0.6 || (area ?? 0) >= 2) {
        return "medium";
    }
    // Low confidence or small area = low (still baseline)
    return "low";
}

/**
 * Estimate bbox area as percentage of image (160x120 QQVGA)
 * bbox coords are in 0-160/0-120 pixel space
 */
function estimateBboxArea(bbox?: { width?: number; height?: number }): number {
    if (!bbox?.width || !bbox?.height) return 0;
    const imageArea = 160 * 120;
    const bboxArea = bbox.width * bbox.height;
    return (bboxArea / imageArea) * 100;
}

/**
 * Generate human-readable findings from detection + environment
 */
function generateFindings(
    detection: DetectionInImage | undefined,
    temp: number,
    humidity: number,
    laserDist?: number
): string {
    const parts: string[] = [];

    if (!detection) {
        parts.push("Không phát hiện vết nứt");
    } else {
        parts.push(`Phát hiện: ${detection.label} (${(detection.confidence * 100).toFixed(0)}%)`);

        if (detection.bbox) {
            const area = estimateBboxArea(detection.bbox);
            if (area > 5) {
                parts.push(`Diện tích ~${area.toFixed(1)}%`);
            }
        }
    }

    // Environment context
    if (temp > 35) {
        parts.push("🌡️ Nóng (>35°C)");
    } else if (temp < 5) {
        parts.push("❄️ Lạnh (<5°C)");
    }

    if (humidity > 80) {
        parts.push("💧 Ẩm cao (>80%)");
    }

    if (laserDist && laserDist < 150) {
        parts.push(`⚠️ Gần vật cản (${laserDist}mm)`);
    }

    return parts.join(" | ");
}

/**
 * Analyze single image: convert Edge-AI detection + environment → severity + analysis
 */
export function analyzeNodeImage(input: AnalysisInput): AnalysisOutput {
    const area = estimateBboxArea(input.detection?.bbox);
    const confidence = input.detection?.confidence ?? 0;

    const severity = computeSeverity(confidence, area);

    const findings = generateFindings(
        input.detection,
        input.temperature,
        input.humidity,
        input.laserDistance
    );

    return {
        severity,
        crackArea: area > 0 ? area : undefined,
        crackCount: input.detection ? 1 : undefined,
        findings,
    };
}

/**
 * Categorize severity for UI badge
 */
export function getSeverityLabel(severity: CrackSeverity): string {
    const labels: Record<CrackSeverity, string> = {
        low: "Thấp",
        medium: "Trung bình",
        high: "Cao",
    };
    return labels[severity];
}

export function getSeverityColor(severity: CrackSeverity): string {
    const colors: Record<CrackSeverity, string> = {
        low: "#10b981", // green
        medium: "#f59e0b", // amber
        high: "#ef4444", // red
    };
    return colors[severity];
}

/**
 * Check if should escalate alert based on trend
 * (to be used in compare.ts after comparing with previous patrol)
 */
export function shouldEscalateForTrend(
    currentSeverity: CrackSeverity,
    previousSeverity: CrackSeverity | null,
    growthPercentage: number,
    consecutiveGrowthCount: number
): boolean {
    // If no previous = not escalating (baseline)
    if (!previousSeverity) return false;

    // Escalate if high severity
    if (currentSeverity === "high") return true;

    // Escalate if growing for 2+ consecutive patrols
    if (growthPercentage > 0 && consecutiveGrowthCount >= 2) return true;

    // Escalate if large jump (>30%)
    if (growthPercentage > 30) return true;

    return false;
}
