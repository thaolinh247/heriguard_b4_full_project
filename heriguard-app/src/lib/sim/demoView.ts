import { useEffect, useState } from "react";
import type { CrackSeverity, DetectionInImage, NodeImage, PatrolSession } from "@/types/robot";
import type { DayBlock, DayCluster } from "@/lib/daySummary";
import { analyzeNodeImage } from "@/lib/analyze";
import { summarizeDay } from "@/lib/daySummary";
import { resolveWideUriForNode, resolveZoomUri } from "@/lib/sim/simMedia";

/**
 * ─────────────────────────────────────────────────────────────
 * DEMO VIEW — dữ liệu mẫu CỐ ĐỊNH (deterministic, không đổi)
 *
 * Cấu trúc demo:
 *   - 3 NGÀY, mỗi ngày đúng 2 ảnh:
 *       • 1 ảnh WIDE: CỐ ĐỊNH theo điểm chụp (dùng chung mọi ngày)
 *       • 1 ảnh ZOOM:  khác nhau mỗi ngày (crack-low/medium/high)
 *   - NGÀY 3 = mới nhất (1 ngày trước), NGÀY 2 = 7 ngày trước,
 *     NGÀY 1 = cũ nhất (14 ngày trước)
 *
 * Tình trạng 2 điểm chụp KHÁC NHAU (theo ngày 3 → ngày 1):
 *   Điểm chụp 1: Trung bình → Thấp → Trung bình
 *   Điểm chụp 2: Thấp → Trung bình → Cao
 *   Nhiệt độ/độ ẩm tăng theo severity (tình trạng ảnh nặng hơn → môi trường bất lợi hơn).
 *
 * KHÔNG đọc store, KHÔNG lưu đĩa, KHÔNG đổi theo phiên chạy.
 * Dùng làm nguồn dữ liệu khi app có patrol demo (id bắt đầu "demo-").
 * ─────────────────────────────────────────────────────────────
 */

// NGÀY 3 = mới nhất (1 ngày trước), NGÀY 1 = cũ nhất (14 ngày trước)
const DAYS_AGO = [1, 7, 14]; // index 0=ngày 3, 1=ngày 2, 2=ngày 1

// Severity theo điểm chụp: [ngày 3, ngày 2, ngày 1]
const POINT_SEVERITY: Record<number, CrackSeverity[]> = {
  1: ["medium", "low", "medium"], // Điểm chụp 1: Trung bình → Thấp → Trung bình
  2: ["low", "medium", "high"], // Điểm chụp 2: Thấp → Trung bình → Cao
};

// Nhiệt độ/độ ẩm CỐ ĐỊNH theo severity — khớp tình trạng ảnh
const SEV_TEMP: Record<CrackSeverity, number> = { low: 26.2, medium: 27.9, high: 29.6 };
const SEV_HUM: Record<CrackSeverity, number> = { low: 61.8, medium: 67.8, high: 73.8 };

// Thông số detection để analyzeNodeImage() ra đúng severity mong muốn
const SEV_CONF: Record<CrackSeverity, number> = { low: 0.52, medium: 0.62, high: 0.78 };
const SEV_BBOX: Record<CrackSeverity, { w: number; h: number }> = {
  low: { w: 8, h: 5 }, // area ~0.2% → low
  medium: { w: 16, h: 10 }, // area ~0.8% + conf>=0.6 → medium
  high: { w: 42, h: 24 }, // area >=5% + conf>=0.75 → high
};

function isoDaysAgo(days: number, hourOffset = 8): string {
  const d = new Date(Date.now() - days * 86400_000 + hourOffset * 3_600_000);
  return d.toISOString();
}

function dateLabelOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function relativeLabel(dayKey: string): string {
  const todayIso = new Date().toISOString();
  const d = new Date(dayKey + "T00:00:00");
  const t = new Date(todayIso.slice(0, 10) + "T00:00:00");
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86400_000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return `${diffDays} ngày trước`;
}

interface BuiltDay {
  dayKey: string;
  images: [NodeImage, NodeImage]; // [wide, zoom]
  cluster: DayCluster;
}

let buildCache = new Map<number, Promise<BuiltDay[]>>();

/**
 * Dựng 3 ngày demo CỐ ĐỊNH cho 1 điểm chụp (nodeX2).
 * Kết quả không đổi qua mọi lần gọi (cache theo nodeX2).
 */
export function buildDemoDays(nodeX2: number): Promise<BuiltDay[]> {
  let cached = buildCache.get(nodeX2);
  if (cached) return cached;

  cached = (async () => {
    const wideUri = await resolveWideUriForNode(nodeX2);
    const days: BuiltDay[] = [];

    for (let i = 0; i < 3; i++) {
      const severity = POINT_SEVERITY[nodeX2]?.[i] ?? "medium";
      const zoomUri = await resolveZoomUri(i);
      const temp = SEV_TEMP[severity];
      const humidity = SEV_HUM[severity];

      const wideTime = isoDaysAgo(DAYS_AGO[i], 8);
      const zoomTime = isoDaysAgo(DAYS_AGO[i], 15);
      const dayKey = wideTime.slice(0, 10);

      const mkDetection = (zoom: boolean): DetectionInImage => {
        const size = SEV_BBOX[severity];
        const scale = zoom ? 1.6 : 1;
        return {
          label: "crack_small",
          confidence: SEV_CONF[severity],
          bbox: {
            x: 34 + nodeX2 * 4,
            y: 26 + nodeX2 * 3,
            width: size.w * scale,
            height: size.h * scale,
          },
        };
      };

      const wideDetection = mkDetection(false);
      const zoomDetection = mkDetection(true);
      const wideAnalysis = analyzeNodeImage({
        detection: wideDetection,
        temperature: temp,
        humidity,
        timestamp: wideTime,
      });
      const zoomAnalysis = analyzeNodeImage({
        detection: zoomDetection,
        temperature: temp,
        humidity,
        timestamp: zoomTime,
      });

      const wide: NodeImage = {
        frameId: i * 1000 + nodeX2 * 10 + 0,
        nodeX2,
        shotKind: 0,
        pan: 90,
        tilt: 90,
        timestamp: wideTime,
        temperature: temp,
        humidity,
        detection: wideDetection,
        analysis: wideAnalysis,
        uri: wideUri,
      };
      const zoom: NodeImage = {
        frameId: i * 1000 + nodeX2 * 10 + 2,
        nodeX2,
        shotKind: 2,
        pan: 85,
        tilt: 75,
        timestamp: zoomTime,
        temperature: temp,
        humidity,
        detection: zoomDetection,
        analysis: zoomAnalysis,
        uri: zoomUri,
      };

      days.push({
        dayKey,
        images: [wide, zoom],
        cluster: {
          id: `${dayKey}-demo`,
          label: "Cụm chụp trong ngày",
          images: [wide, zoom],
          temperature: temp,
          humidity,
          detectionCount: 2,
          worstSeverity: severity,
        },
      });
    }
    return days;
  })();

  buildCache.set(nodeX2, cached);
  return cached;
}

/** Dựng DayBlock[] (mới nhất trước) — tương thích buildDayBlocks() hiện có */
export async function buildDemoDayBlocks(nodeX2: number): Promise<DayBlock[]> {
  const days = await buildDemoDays(nodeX2);
  const blocks: DayBlock[] = [];
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const previous = blocks.at(-1) ?? null;
    blocks.push({
      dayKey: day.dayKey,
      dateLabel: dateLabelOf(day.dayKey),
      relativeLabel: relativeLabel(day.dayKey),
      clusters: [day.cluster],
      detectionCount: 2,
      worstSeverity: day.cluster.worstSeverity,
      avgAreaPercent:
        day.images
          .map((img) => img.analysis?.crackArea)
          .filter((a): a is number => a != null)
          .reduce((s, a) => s + a, 0) / 2,
      summary: summarizeDay(day.dayKey, [day.cluster], previous),
    });
  }
  return blocks;
}

/** Có đang dùng dữ liệu demo không (bất kỳ patrol id bắt đầu "demo-") */
export function hasDemoPatrols(patrols: PatrolSession[]): boolean {
  return patrols.some((p) => p.id.startsWith("demo-"));
}

/** Hook: tải DayBlock[] demo cố định cho điểm chụp (null khi chưa xong) */
export function useDemoBlocks(nodeX2: number, enabled: boolean): DayBlock[] | null {
  const [blocks, setBlocks] = useState<DayBlock[] | null>(null);
  useEffect(() => {
    if (!enabled) {
      setBlocks(null);
      return;
    }
    let cancel = false;
    buildDemoDayBlocks(nodeX2).then((b) => {
      if (!cancel) setBlocks(b);
    });
    return () => {
      cancel = true;
    };
  }, [nodeX2, enabled]);
  return blocks;
}