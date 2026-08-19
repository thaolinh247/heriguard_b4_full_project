import type { NodeImage, PatrolSession, CrackSeverity, DetectionInImage } from "@/types/robot";
import type { TrendDataPoint } from "@/types/gemini";

/**
 * ─────────────────────────────────────────────────────────────
 * DAY SUMMARY — lịch sử theo ngày tại 1 điểm chụp
 *
 * - Gộp ảnh của node điểm chụp từ mọi lần tuần tra
 * - Mỗi ngày = 2 cụm ảnh (sáng/chiều theo giờ chụp)
 * - Mỗi ngày kết thúc bằng 1 AI tổng hợp tình hình tại đó
 *   (rule-based, tiếng Việt — chạy offline, không cần API key)
 * - Xuất 1 điểm dữ liệu/ngày cho AI xu hướng (Gemini/mock)
 * ─────────────────────────────────────────────────────────────
 */

export interface DayCluster {
  id: string;
  label: string;
  images: NodeImage[];
  temperature: number;
  humidity: number;
  detectionCount: number;
  worstSeverity: CrackSeverity | null;
}

export interface DayBlock {
  dayKey: string;
  dateLabel: string;
  relativeLabel: string;
  clusters: DayCluster[];
  detectionCount: number;
  worstSeverity: CrackSeverity | null;
  avgAreaPercent: number | null;
  summary: string;
}

const SEVERITY_ORDER: Record<CrackSeverity, number> = { low: 0, medium: 1, high: 2 };
const SEVERITY_TEXT: Record<CrackSeverity, string> = {
  low: "mức thấp",
  medium: "mức trung bình",
  high: "mức cao",
};

function worstOf(images: NodeImage[]): CrackSeverity | null {
  let worst: CrackSeverity | null = null;
  for (const img of images) {
    const s = img.analysis?.severity ?? null;
    if (s && (worst === null || SEVERITY_ORDER[s] > SEVERITY_ORDER[worst])) worst = s;
  }
  return worst;
}

function avgArea(images: NodeImage[]): number | null {
  const areas = images
    .map((i) => i.analysis?.crackArea)
    .filter((a): a is number => a != null);
  if (areas.length === 0) return null;
  return areas.reduce((s, a) => s + a, 0) / areas.length;
}

function avgOf(images: NodeImage[], key: "temperature" | "humidity"): number {
  if (images.length === 0) return 0;
  return images.reduce((s, i) => s + i[key], 0) / images.length;
}

function detectOf(image: NodeImage): DetectionInImage | null {
  return image.detection ?? null;
}

/** Đổi ISO → chuỗi ngày YYYY-MM-DD (theo giờ địa phương) */
function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function relativeLabel(dayKey: string): string {
  const today = dayKeyOf(new Date().toISOString());
  const d1 = new Date(`${dayKey}T00:00:00`);
  const d0 = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((d0.getTime() - d1.getTime()) / 86400_000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return `${diffDays} ngày trước`;
}

function dateLabelOf(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00`);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Tách ảnh một ngày thành 2 cụm: sáng (<12h) và chiều (>=12h) */
function splitIntoClusters(dayKey: string, images: NodeImage[]): DayCluster[] {
  const sorted = [...images].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const morning = sorted.filter((i) => new Date(i.timestamp).getHours() < 12);
  const afternoon = sorted.filter((i) => new Date(i.timestamp).getHours() >= 12);

  const make = (label: string, group: NodeImage[]): DayCluster | null => {
    if (group.length === 0) return null;
    return {
      id: `${dayKey}-${label}`,
      label,
      images: group,
      temperature: avgOf(group, "temperature"),
      humidity: avgOf(group, "humidity"),
      detectionCount: group.filter((i) => detectOf(i)).length,
      worstSeverity: worstOf(group),
    };
  };

  const clusters = [make("Cụm sáng", morning), make("Cụm chiều", afternoon)].filter(
    (c): c is DayCluster => c !== null
  );

  // Chưa đủ 2 cụm (vd real chỉ chụp 1 lần) → tách đôi theo thời gian
  if (clusters.length === 1 && sorted.length >= 2) {
    const mid = Math.ceil(sorted.length / 2);
    const first = make("Cụm 1", sorted.slice(0, mid));
    const second = make("Cụm 2", sorted.slice(mid));
    return [first, second].filter((c): c is DayCluster => c !== null);
  }
  return clusters;
}

/** AI tổng hợp ngày (rule-based, tiếng Việt) */
export function summarizeDay(
  dayKey: string,
  clusters: DayCluster[],
  previous: DayBlock | null
): string {
  const allImages = clusters.flatMap((c) => c.images);
  const detections = allImages.filter((i) => detectOf(i));
  const area = avgArea(allImages);
  const temp = avgOf(allImages, "temperature");
  const hum = avgOf(allImages, "humidity");
  const worst = worstOf(allImages);

  const envParts: string[] = [];
  if (temp > 35) envParts.push("nhiệt độ cao (>35°C)");
  if (hum > 80) envParts.push("độ ẩm cao (>80%) — nguy cơ nấm mốc");
  if (hum < 40) envParts.push("độ ẩm thấp (<40%) — nguy cơ co ngót kết cấu");

  if (detections.length === 0) {
    const env = envParts.length > 0 ? ` Lưu ý môi trường: ${envParts.join(", ")}.` : " Môi trường trong ngưỡng an toàn.";
    return `Ngày ${dateLabelOf(dayKey)}: không phát hiện dấu hiệu hư hại tại điểm chụp${env}`;
  }

  const worstText = worst ? `${SEVERITY_TEXT[worst]}` : "chưa đánh giá";
  const areaText = area != null ? `Diện tích nứt ước tính trung bình ${area.toFixed(1)}% khung hình (${clusters.length} cụm, ${detections.length} ảnh có dấu hiệu).` : `${detections.length} ảnh có dấu hiệu.`;

  let trendText = "";
  if (previous) {
    const prevArea = avgArea(previous.clusters.flatMap((c) => c.images));
    if (area != null && prevArea != null) {
      const delta = area - prevArea;
      if (delta > 1.5) trendText = `So với hôm trước, diện tích tăng +${delta.toFixed(1)}% — xu hướng nứt lan rộng, cần theo dõi.`;
      else if (delta < -1.5) trendText = `So với hôm trước, diện tích giảm ${delta.toFixed(1)}% — tình trạng cải thiện.`;
      else trendText = `So với hôm trước, diện tích ổn định (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%).`;
    } else if ((previous.worstSeverity ?? null) === null) {
      trendText = "Hôm trước không phát hiện dấu hiệu — đây là lần đầu xuất hiện, cần theo dõi sát.";
    }
  } else {
    trendText = "Chưa có dữ liệu ngày trước để so sánh — đây là mốc nền cho theo dõi tiếp.";
  }

  const env = envParts.length > 0 ? ` Môi trường: ${envParts.join(", ")}.` : "";
  return `Ngày ${dateLabelOf(dayKey)}: phát hiện dấu hiệu hư hại ${worstText}. ${areaText} ${trendText}${env}`;
}

/**
 * Dựng lịch sử theo ngày cho 1 điểm chụp từ mọi lần tuần tra.
 * Mới nhất trước. Mỗi ngày: 2 cụm ảnh + AI tổng hợp cuối ngày.
 */
export function buildDayBlocks(
  patrols: PatrolSession[],
  nodeX2: number
): DayBlock[] {
  // Gom ảnh của đúng node điểm chụp
  const images = patrols
    .flatMap((p) => p.images)
    .filter((i) => i.nodeX2 === nodeX2);

  // Nhóm theo ngày
  const byDay = new Map<string, NodeImage[]>();
  for (const img of images) {
    const key = dayKeyOf(img.timestamp);
    const list = byDay.get(key) ?? [];
    list.push(img);
    byDay.set(key, list);
  }

  const dayKeys = [...byDay.keys()].sort().reverse(); // mới nhất trước

  const blocks: DayBlock[] = [];
  for (const dayKey of dayKeys) {
    const clusters = splitIntoClusters(dayKey, byDay.get(dayKey) ?? []);
    if (clusters.length === 0) continue;
    const previous = blocks.at(-1) ?? null;
    const area = avgArea(clusters.flatMap((c) => c.images));
    blocks.push({
      dayKey,
      dateLabel: dateLabelOf(dayKey),
      relativeLabel: relativeLabel(dayKey),
      clusters,
      detectionCount: clusters.reduce((s, c) => s + c.detectionCount, 0),
      worstSeverity: worstOf(clusters.flatMap((c) => c.images)) ?? null,
      avgAreaPercent: area,
      summary: summarizeDay(dayKey, clusters, previous),
    });
  }

  return blocks;
}

/** Điểm dữ liệu cho AI xu hướng: 1 ngày = 1 điểm, sắp theo ngày tăng dần (cũ → mới) */
export function blocksToTrendPoints(blocks: DayBlock[]): TrendDataPoint[] {
  return [...blocks]
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((b) => {
      const all = b.clusters.flatMap((c) => c.images);
      const temp = avgOf(all, "temperature");
      const humidity = avgOf(all, "humidity");
      const detections = all
        .map((i) => detectOf(i))
        .filter((d): d is DetectionInImage => d !== null)
        .map((d) => ({ label: d.label, confidence: d.confidence }));
      return { timestamp: `${b.dayKey}T12:00:00.000Z`, temp, humidity, detections };
    });
}

/** Số ngày có dữ liệu thực (để hiển thị trên thư mục) */
export function countDayBlocks(patrols: PatrolSession[], nodeX2: number): number {
  const days = new Set<string>();
  for (const p of patrols) {
    for (const img of p.images) {
      if (img.nodeX2 === nodeX2) days.add(dayKeyOf(img.timestamp));
    }
  }
  return days.size;
}