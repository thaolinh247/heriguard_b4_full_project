import type { CrackSeverity, NodeImage, PatrolSession, ShotKind } from "@/types/robot";

/**
 * Comparison engine — find previous patrol's same-node image + compute delta
 */

export interface ComparisonInput {
    current: NodeImage;
    previous: NodeImage | null;
    previousPatrol: PatrolSession | null;
}

export interface ComparisonOutput {
    hasPrevious: boolean;
    isFirstVisit: boolean; // Lần đầu tại node này
    previousImage: NodeImage | null;
    deltaAreaPercent: number; // % change: (current - prev) / prev * 100
    deltaConfidence: number; // Absolute change in confidence
    deltaTemperature: number;
    deltaHumidity: number;
    trend: "increasing" | "stable" | "decreasing";
    summary: string;
}

/**
 * Find previous patrol's image of same node + shot kind
 * Match criteria:
 *   - Same nodeX2
 *   - Same shotKind
 *   - pan/tilt within ±10 degree (optional, for now exact match is fine)
 */
export function findPreviousImage(
    currentImage: NodeImage,
    previousPatrol: PatrolSession | null
): NodeImage | null {
    if (!previousPatrol?.images || previousPatrol.images.length === 0) {
        return null;
    }

    // Find matching image: same node + same shot kind
    const candidates = previousPatrol.images.filter(
        (img) =>
            img.nodeX2 === currentImage.nodeX2 &&
            img.shotKind === currentImage.shotKind
    );

    if (candidates.length === 0) {
        return null;
    }

    // Prefer image with matching pan/tilt (within ±10°), else take latest
    const panTarget = currentImage.pan ?? 90;
    const tiltTarget = currentImage.tilt ?? 90;

    const closeMatch = candidates.find(
        (img) =>
            Math.abs((img.pan ?? 90) - panTarget) <= 10 &&
            Math.abs((img.tilt ?? 90) - tiltTarget) <= 10
    );

    return closeMatch ?? candidates[candidates.length - 1];
}

/**
 * Compute delta between current and previous image
 * Returns: area change %, confidence delta, temp/humidity delta
 */
export function computeNodeDelta(
    current: NodeImage,
    previous: NodeImage | null
): Omit<ComparisonOutput, "hasPrevious" | "isFirstVisit" | "previousImage" | "summary"> {
    if (!previous || !previous.analysis || !current.analysis) {
        return {
            deltaAreaPercent: 0,
            deltaConfidence: 0,
            deltaTemperature: 0,
            deltaHumidity: 0,
            trend: "stable",
        };
    }

    const prevArea = previous.analysis.crackArea ?? 0;
    const currArea = current.analysis.crackArea ?? 0;

    const deltaArea = prevArea > 0 ? ((currArea - prevArea) / prevArea) * 100 : 0;

    const prevConf = previous.detection?.confidence ?? 0;
    const currConf = current.detection?.confidence ?? 0;
    const deltaConf = currConf - prevConf;

    const deltaTempC = current.temperature - previous.temperature;
    const deltaHumidity = current.humidity - previous.humidity;

    // Determine trend
    let trend: "increasing" | "stable" | "decreasing" = "stable";
    if (deltaArea > 5) {
        trend = "increasing";
    } else if (deltaArea < -5) {
        trend = "decreasing";
    }

    return {
        deltaAreaPercent: Math.round(deltaArea * 10) / 10, // 1 decimal
        deltaConfidence: Math.round(deltaConf * 100) / 100,
        deltaTemperature: Math.round(deltaTempC * 10) / 10,
        deltaHumidity: Math.round(deltaHumidity * 10) / 10,
        trend,
    };
}

/**
 * Generate comparison summary for UI
 */
function generateComparisonSummary(output: Omit<ComparisonOutput, "summary">): string {
    if (output.isFirstVisit) {
        if (!output.previousImage || !output.previousImage.detection) {
            return "✅ Lần đầu — không có dấu hiệu";
        } else {
            return "⚠️ Lần đầu — có dấu hiệu";
        }
    }

    if (!output.hasPrevious) {
        return "❓ Không tìm thấy ảnh trước cùng loại";
    }

    const { deltaAreaPercent, trend } = output;

    if (trend === "increasing") {
        return `📈 Tăng ${Math.abs(deltaAreaPercent).toFixed(1)}% — cần chú ý`;
    } else if (trend === "decreasing") {
        return `📉 Giảm ${Math.abs(deltaAreaPercent).toFixed(1)}%`;
    } else {
        return `➡️ Ổn định`;
    }
}

/**
 * Full comparison workflow: find previous + compute delta + generate output
 */
export function compareNodeImages(input: ComparisonInput): ComparisonOutput {
    const hasPrevious = !!input.previous || !!input.previousPatrol;
    const isFirstVisit = !input.previous && !input.previousPatrol;

    const delta = computeNodeDelta(input.current, input.previous);

    const summary = generateComparisonSummary({
        ...delta,
        hasPrevious,
        isFirstVisit,
        previousImage: input.previous,
    });

    return {
        hasPrevious,
        isFirstVisit,
        previousImage: input.previous,
        ...delta,
        summary,
    };
}

/**
 * Check if should escalate alert based on trend over multiple patrols
 * Called when reviewing history: if 2+ patrols show growing trend → escalate
 */
export function shouldEscalateForConsecutiveGrowth(
    patrols: PatrolSession[],
    nodeX2: number,
    shotKind: ShotKind,
    minConsecutiveGrowths: number = 2
): boolean {
    if (patrols.length < minConsecutiveGrowths) {
        return false;
    }

    let growthCount = 0;

    for (let i = 1; i < patrols.length; i++) {
        const current = findNodeImageInPatrol(patrols[i], nodeX2, shotKind);
        const previous = findNodeImageInPatrol(patrols[i - 1], nodeX2, shotKind);

        if (!current || !previous) {
            growthCount = 0; // Reset if gap in data
            continue;
        }

        const currArea = current.analysis?.crackArea ?? 0;
        const prevArea = previous.analysis?.crackArea ?? 0;

        if (currArea > prevArea) {
            growthCount++;
        } else {
            growthCount = 0; // Reset if not growing
        }

        if (growthCount >= minConsecutiveGrowths) {
            return true; // Escalate
        }
    }

    return false;
}

/**
 * Get timeline of area changes across patrols for a specific node + shot
 * Used to render chart in UI
 */
export interface TimelinePoint {
    patrolId: string;
    timestamp: string; // ISO string of patrol start
    area: number;
    severity: CrackSeverity;
}

export function getNodeTimeline(
    patrols: PatrolSession[],
    nodeX2: number,
    shotKind: ShotKind
): TimelinePoint[] {
    return patrols
        .map((patrol) => {
            const image = findNodeImageInPatrol(patrol, nodeX2, shotKind);
            if (!image) return null;

            return {
                patrolId: patrol.id,
                timestamp: patrol.startTime,
                area: image.analysis?.crackArea ?? 0,
                severity: image.analysis?.severity ?? ("low" as CrackSeverity),
            };
        })
        .filter((p): p is TimelinePoint => p !== null);
}

/**
 * Helper: find image of specific node + shot kind in a patrol
 */
function findNodeImageInPatrol(
    patrol: PatrolSession,
    nodeX2: number,
    shotKind: ShotKind
): NodeImage | null {
    return (
        patrol.images?.find((img) => img.nodeX2 === nodeX2 && img.shotKind === shotKind) ??
        null
    );
}
