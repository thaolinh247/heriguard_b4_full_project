import type { GeminiAnalysis, GeminiFinding, TrendAnalysis, TrendDataPoint } from "@/types/gemini";

const API_BASE = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

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

function buildTrendPrompt(points: TrendDataPoint[]): string {
  const data = points.map((p, i) =>
    `[${i + 1}] ${p.timestamp} — ${p.temp}°C, ${p.humidity}%, phát hiện: ${p.detections.length === 0 ? "không" : p.detections.map(d => `${d.label}(${(d.confidence * 100).toFixed(0)}%)`).join(", ")}`
  ).join("\n");

  return `Bạn là chuyên gia AI phân tích xu hướng bảo tồn di tích văn hóa. Hãy phân tích XU HƯỚNG dữ liệu tuần tra từ robot HERI-GUARD dựa trên các điểm dữ liệu sau:

DỮ LIỆU LỊCH SỬ (${points.length} điểm):
${data}

Hãy đánh giá xu hướng tổng thể dựa trên sự thay đổi theo thời gian của nhiệt độ, độ ẩm và các phát hiện.

Trả về JSON hợp lệ (KHÔNG markdown, KHÔNG code block, chỉ JSON thuần) theo cấu trúc:
{
  "direction": "improving | stable | deteriorating",
  "summary": "tóm tắt 1-2 câu về xu hướng tổng thể",
  "tempTrend": "đánh giá xu hướng nhiệt độ (tăng/giảm/ổn định, bất thường không)",
  "humidityTrend": "đánh giá xu hướng độ ẩm (tăng/giảm/ổn định, bất thường không)",
  "detectionTrend": "xu hướng phát hiện hư hại (tăng/giảm/ổn định)",
  "insights": ["nhận định chuyên sâu 1", "nhận định chuyên sâu 2"],
  "recommendations": ["khuyến nghị 1", "khuyến nghị 2"]
}`;
}

export async function analyzeTrendsWithGemini(
  apiKey: string,
  points: TrendDataPoint[]
): Promise<TrendAnalysis> {
  const parts: Part[] = [
    { text: buildTrendPrompt(points) },
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
