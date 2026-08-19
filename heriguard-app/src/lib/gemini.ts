import type { GeminiAnalysis, GeminiFinding, TrendAnalysis, TrendDataPoint } from "@/types/gemini";
import type { DayCluster } from "@/lib/daySummary";

const API_BASE = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

function buildPrompt(
  temp: number | null,
  humidity: number | null,
  detections: { label: string; confidence: number }[],
  markers: { temperature: number; humidity: number; flags: number }[]
): string {
  return `Bạn là chuyên gia AI phân tích bảo tồn di tích văn hóa. Hãy phân tích dữ liệu tuần tra từ robot HERI-GUARD.

DỮ LIỆU MÔI TRƯỜNG:
- Nhiệt độ: ${temp !== null ? temp + "°C" : "không có dữ liệu"}
- Độ ẩm: ${humidity !== null ? humidity + "%" : "không có dữ liệu"}

PHÁT HIỆN TỪ CAMERA:
${detections.length === 0 ? "Không có phát hiện nào." : detections.map((d) => `- ${d.label} (độ tin cậy: ${(d.confidence * 100).toFixed(0)}%)`).join("\n")}

BẢN ĐỒ CÁC ĐIỂM ĐÃ KIỂM TRA:
${markers.length === 0 ? "Chưa có điểm kiểm tra nào." : markers.map((m, i) => `- Điểm ${i}: ${m.temperature}°C, ${m.humidity}%, flags=${m.flags}`).join("\n")}

Hãy phân tích ẢNH ĐÍNH KÈM và tổng hợp với dữ liệu trên.

Trả về JSON hợp lệ (KHÔNG markdown, KHÔNG code block, chỉ JSON thuần) theo cấu trúc:
{
  "severity": "low | medium | high",
  "summary": "tóm tắt ngắn 1-2 câu về tình trạng",
  "findings": [
    { "type": "crack | moss | mold | stain | erosion | environment", "description": "mô tả chi tiết", "confidence": 0-100 }
  ],
  "envAssessment": "đánh giá tác động môi trường đến di tích",
  "correlations": [
    "các mối liên hệ giữa môi trường và hư hại"
  ],
  "conditionAssessment": {
    "severity": "Tốt | Cần theo dõi | Nguy hiểm",
    "assessment": "đánh giá tổng thể tình trạng dựa trên phân tích, có cần hỗ trợ không",
    "needsSupport": true/false
  }
}`;
}

export async function analyzeWithGemini(
  apiKey: string,
  imageBase64: string | null,
  temp: number | null,
  humidity: number | null,
  detections: { label: string; confidence: number }[],
  markers: { temperature: number; humidity: number; flags: number }[]
): Promise<GeminiAnalysis> {
  const parts: Part[] = [
    { text: buildPrompt(temp, humidity, detections, markers) },
  ];

  if (imageBase64) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: imageBase64 },
    });
  }

  const response = await fetch(`${API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: empty response");

  return parseResponse(text);
}

export async function imageToBase64(uri: string): Promise<string | null> {
  try {
    // blob: → web-only, use fetch (no RN Blob warning on web)
    if (uri.startsWith("blob:")) {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }

    const legacyFs = await import("expo-file-system/legacy");

    // http: → download to temp then read (avoids RN Blob warning)
    if (uri.startsWith("http")) {
      const dest = legacyFs.cacheDirectory + "gemini_" + Date.now() + ".jpg";
      const dl = await legacyFs.downloadAsync(uri, dest);
      const base64 = await legacyFs.readAsStringAsync(dl.uri, {
        encoding: legacyFs.EncodingType.Base64,
      });
      await legacyFs.deleteAsync(dest, { idempotent: true });
      return base64;
    }

    // file: → read directly
    const base64 = await legacyFs.readAsStringAsync(uri, {
      encoding: legacyFs.EncodingType.Base64,
    });
    return base64;
  } catch {
    return null;
  }
}

function buildTrendPrompt(context: string | null, points: TrendDataPoint[]): string {
  const data = points.map((p, i) => {
    const det = p.detections.length === 0
      ? "không phát hiện"
      : p.detections.map((d) => `${d.label} (tin cậy ${(d.confidence * 100).toFixed(0)}%)`).join(", ");
    return `- Ngày ${i + 1} (${p.timestamp.slice(0, 10)}): nhiệt độ ${p.temp.toFixed(1)}°C, độ ẩm ${p.humidity.toFixed(1)}%, phát hiện: ${det}`;
  }).join("\n");

  const avgTemp = points.reduce((s, p) => s + p.temp, 0) / points.length;
  const avgHum = points.reduce((s, p) => s + p.humidity, 0) / points.length;
  const firstTemp = points[0].temp;
  const lastTemp = points[points.length - 1].temp;
  const firstHum = points[0].humidity;
  const lastHum = points[points.length - 1].humidity;

  return `Bạn là chuyên gia AI phân tích xu hướng bảo tồn di tích văn hóa. Hãy phân tích CHI TIẾT XU HƯỚNG dữ liệu tuần tra từ robot HERI-GUARD tại ${context ?? "điểm chụp"}.

ĐỊA ĐIỂM: ${context ?? "Không xác định"} (di tích bảo tồn — giám sát vết nứt + môi trường)

DỮ LIỆU LỊCH SỬ THEO NGÀY (${points.length} điểm, NGÀY 3 = mới nhất):
${data}

TÓM TẮT CHỈ SỐ:
- Nhiệt độ: trung bình ${avgTemp.toFixed(1)}°C, thay đổi từ ${firstTemp.toFixed(1)}°C → ${lastTemp.toFixed(1)}°C
- Độ ẩm: trung bình ${avgHum.toFixed(1)}%, thay đổi từ ${firstHum.toFixed(1)}% → ${lastHum.toFixed(1)}%
- Ngưỡng an toàn bảo quản: nhiệt độ <35°C, độ ẩm 40–75%

Hãy phân tích sâu:
1. Xu hướng tổng thể (cải thiện / ổn định / xuống cấp) — giải thích bằng số liệu cụ thể
2. Nhiệt độ, độ ẩm biến động ra sao qua các ngày, có bất thường so với ngưỡng an toàn không
3. Phát hiện hư hại (vết nứt, rêu, mốc…) tăng/giảm/ổn định — so sánh từng ngày
4. Mối liên hệ giữa môi trường và mức độ hư hại
5. Mức độ rủi ro cho công tác bảo tồn + khuyến nghị hành động cụ thể

Trả về JSON hợp lệ (KHÔNG markdown, KHÔNG code block, chỉ JSON thuần) theo cấu trúc:
{
  "direction": "improving | stable | deteriorating",
  "summary": "tóm tắt 3-4 câu chi tiết về xu hướng tổng thể, có gắn số liệu",
  "tempTrend": "đánh giá xu hướng nhiệt độ chi tiết: giá trị từng ngày, tăng/giảm bao nhiêu độ, có vượt ngưỡng 35°C không",
  "humidityTrend": "đánh giá xu hướng độ ẩm chi tiết: giá trị từng ngày, tăng/giảm bao nhiêu %, so với ngưỡng 75% thế nào",
  "detectionTrend": "xu hướng phát hiện hư hại chi tiết: từng ngày có bao nhiêu ảnh phát hiện, mức độ nặng nhẹ, lan rộng ra sao",
  "dayDetails": [
    { "day": "NGÀY 3", "date": "ngày tháng (YYYY-MM-DD)", "temp": 27.5, "humidity": 67.8, "detections": 2, "severity": "Thấp/Trung bình/Cao", "note": "nhận xét ngắn 1 câu cho ngày này" }
  ],
  "insights": ["nhận định chuyên sâu 1", "nhận định chuyên sâu 2", "nhận định chuyên sâu 3", "nhận định chuyên sâu 4"],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2", "khuyến nghị 3", "khuyến nghị 4"]
}`;
}

export async function analyzeTrendsWithGemini(
  apiKey: string,
  context: string | null,
  points: TrendDataPoint[]
): Promise<TrendAnalysis> {
  const parts: Part[] = [
    { text: buildTrendPrompt(context, points) },
  ];

  const response = await fetch(`${API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: empty response");

  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  const parsed = JSON.parse(cleaned);

  return {
    direction: parsed.direction ?? "stable",
    summary: parsed.summary ?? "",
    tempTrend: parsed.tempTrend ?? "",
    humidityTrend: parsed.humidityTrend ?? "",
    detectionTrend: parsed.detectionTrend ?? "",
    dayDetails: (parsed.dayDetails ?? []).map((d: {
      day?: string; date?: string; temp?: number; humidity?: number;
      detections?: number; severity?: string; note?: string;
    }) => ({
      day: d.day ?? "—",
      date: d.date ?? "",
      temp: d.temp ?? 0,
      humidity: d.humidity ?? 0,
      detections: d.detections ?? 0,
      severity: d.severity ?? "",
      note: d.note ?? "",
    })),
    insights: parsed.insights ?? [],
    recommendations: parsed.recommendations ?? [],
  };
}

function parseResponse(text: string): GeminiAnalysis {
  // Loại bỏ markdown code block nếu có
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  const parsed = JSON.parse(cleaned);

  return {
    severity: parsed.severity ?? "low",
    summary: parsed.summary ?? "",
    findings: (parsed.findings ?? []).map((f: GeminiFinding) => ({
      type: f.type ?? "unknown",
      description: f.description ?? "",
      confidence: f.confidence ?? 0,
    })),
    envAssessment: parsed.envAssessment ?? "",
    correlations: parsed.correlations ?? [],
    conditionAssessment: parsed.conditionAssessment ?? {
      severity: "Không xác định",
      assessment: "Không đủ dữ liệu để đánh giá.",
      needsSupport: false,
    },
  };
}

function buildDaySummaryPrompt(
  dayKey: string,
  clusters: DayCluster[],
  previousSummary: string | null
): string {
  const allImages = clusters.flatMap((c) => c.images);
  const detections = allImages.filter((i) => i.detection);
  const temp = allImages.length > 0 ? allImages.reduce((s, i) => s + i.temperature, 0) / allImages.length : 0;
  const hum = allImages.length > 0 ? allImages.reduce((s, i) => s + i.humidity, 0) / allImages.length : 0;
  const areas = allImages.map((i) => i.analysis?.crackArea).filter((a): a is number => a != null);
  const avgArea = areas.length > 0 ? areas.reduce((s, a) => s + a, 0) / areas.length : null;

  const detectionList = detections.length === 0
    ? "Không phát hiện hư hại."
    : detections.map((i) => {
        const d = i.detection!;
        const a = i.analysis;
        return `- Ảnh ${i.shotKind === 0 ? "rộng" : "cận"}: ${d.label} (tin cậy ${(d.confidence * 100).toFixed(0)}%)${a ? `, severity=${a.severity}, diện tích nứt ~${a.crackArea!.toFixed(1)}%` : ""}`;
      }).join("\n");

  return `Bạn là chuyên gia AI phân tích bảo tồn di tích văn hóa HERI-GUARD. Hãy phân tích chi tiết dữ liệu tại 1 điểm chụp trong 1 ngày.

NGÀY: ${dayKey}
ĐIỂM CHỤP: Node (khoảng cách 0.5m hoặc 1.0m từ trạm gốc)

DỮ LIỆU MÔI TRƯỜNG:
- Nhiệt độ trung bình: ${temp.toFixed(1)}°C
- Độ ẩm trung bình: ${hum.toFixed(1)}%
- Số ảnh chụp: ${allImages.length} (rộng + cận)
${avgArea != null ? `- Diện tích nứt ước tính trung bình: ${avgArea.toFixed(1)}%` : ""}

PHÁT HIỆN TỪ CAMERA (${detections.length} ảnh có phát hiện):
${detectionList}

Cụm sáng: ${clusters.find(c => c.label.includes("sáng"))?.images.length ?? 0} ảnh
Cụm chiều: ${clusters.find(c => c.label.includes("chiều"))?.images.length ?? 0} ảnh
${previousSummary ? `\nTÌNH TRẠNG NGÀY TRƯỚC:\n${previousSummary}` : "\nĐây là ngày đầu tiên có dữ liệu — chưa có cơ sở so sánh."}

Hãy viết BẢN PHÂN TÍCH CHI TIẾT (5-8 câu) bao gồm:
1. Tổng quan tình trạng tại điểm chụp ngày hôm nay
2. Đánh giá mức độ nghiêm trọng của các phát hiện
3. Phân tích mối liên hệ giữa môi trường (nhiệt độ, độ ẩm) và hư hại
4. So sánh với ngày trước (nếu có)
5. Khuyến nghị hành động cụ thể

Trả về JSON hợp lệ (KHÔNG markdown, KHÔNG code block, chỉ JSON thuần):
{
  "summary": "Bản phân tích chi tiết 5-8 câu tiếng Việt"
}`;
}

export async function analyzeDaySummaryWithGemini(
  apiKey: string,
  dayKey: string,
  clusters: DayCluster[],
  previousSummary: string | null
): Promise<string> {
  const parts: Part[] = [
    { text: buildDaySummaryPrompt(dayKey, clusters, previousSummary) },
  ];

  // Thêm ảnh đầu tiên nếu có (để Gemini phân tích visual)
  const firstImage = clusters[0]?.images[0];
  if (firstImage?.uri) {
    try {
      const base64 = await imageToBase64(firstImage.uri);
      if (base64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
      }
    } catch { /* skip image */ }
  }

  const response = await fetch(`${API_BASE}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: empty response");

  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  const parsed = JSON.parse(cleaned);
  return parsed.summary ?? text;
}
