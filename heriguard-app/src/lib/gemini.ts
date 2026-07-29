import type { GeminiAnalysis, GeminiFinding } from "@/types/gemini";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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
  "recommendations": [
    "khuyến nghị hành động cụ thể"
  ]
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
    // Web: blob URL → fetch → base64
    if (uri.startsWith("blob:") || uri.startsWith("http")) {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Native: file:// URI → expo-file-system
    const fs = await import("expo-file-system");
    const legacy = await import("expo-file-system/legacy");
    const base64 = await legacy.readAsStringAsync(uri, {
      encoding: fs.EncodingType.Base64,
    });
    return base64;
  } catch {
    return null;
  }
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
    recommendations: parsed.recommendations ?? [],
  };
}
