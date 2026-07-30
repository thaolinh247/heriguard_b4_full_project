import type { GeminiAnalysis, TrendAnalysis, TrendDataPoint } from "@/types/gemini";

const MOCK_SCENARIOS: GeminiAnalysis[] = [
  {
    severity: "low",
    summary: "Không phát hiện vấn đề nghiêm trọng. Môi trường di tích ổn định.",
    findings: [
      { type: "environment", description: "Nhiệt độ và độ ẩm trong ngưỡng an toàn.", confidence: 95 },
    ],
    envAssessment: "Nhiệt độ 27.5°C và độ ẩm 65% phù hợp cho bảo quản di tích gạch đá. Không có nguy cơ ngưng tụ hơi nước.",
    correlations: [],
    conditionAssessment: {
      severity: "Tốt",
      assessment: "Di tích ở tình trạng ổn định, không có dấu hiệu xuống cấp. Môi trường duy trì trong ngưỡng bảo quản an toàn.",
      needsSupport: false,
    },
  },
  {
    severity: "medium",
    summary: "Phát hiện dấu hiệu rêu phát triển khu vực góc thấp tường. Độ ẩm cao cần theo dõi.",
    findings: [
      { type: "moss", description: "Mảng rêu nhỏ (khoảng 5x5cm) ở chân tường phía Bắc.", confidence: 78 },
      { type: "environment", description: "Độ ẩm trung bình 73% trong 30 phút gần nhất.", confidence: 90 },
    ],
    envAssessment: "Độ ẩm 73% ở ngưỡng ranh giới cho nấm mốc phát triển. Kết hợp với nhiệt độ 28.5°C tạo môi trường thuận lợi cho vi sinh vật.",
    correlations: [
      "Rêu phát triển ở chân tường + độ ẩm >70%: khả năng thấm hút nước từ nền móng",
      "Nhiệt độ 28.5°C + độ ẩm 73%: chỉ số thoải mái nhiệt cao, có thể ảnh hưởng đến kết cấu gỗ nếu có",
    ],
    conditionAssessment: {
      severity: "Cần theo dõi",
      assessment: "Tình trạng di tích có dấu hiệu xuống cấp nhẹ. Rêu phát triển và độ ẩm cao cần được kiểm soát để tránh hư hại lan rộng. Khuyến nghị can thiệp sớm.",
      needsSupport: true,
    },
  },
  {
    severity: "high",
    summary: "PHÁT HIỆN KHẨN: Vết nứt lớn trên bề mặt tường, kết hợp độ ẩm cao kéo dài — cần can thiệp ngay.",
    findings: [
      { type: "crack", description: "Vết nứt dạng đường thẳng dài ~15cm, rộng ~2mm trên tường chính diện.", confidence: 91 },
      { type: "environment", description: "Độ ẩm vượt ngưỡng 78%, kéo dài.", confidence: 95 },
      { type: "mold", description: "Mốc đen xuất hiện rải rác quanh vết nứt.", confidence: 67 },
    ],
    envAssessment: "Độ ẩm 78% tạo điều kiện cho nước xâm nhập qua vết nứt, đẩy nhanh quá trình phong hóa. Nhiệt độ 31°C tăng tốc phản ứng hóa học trên bề mặt đá.",
    correlations: [
      "Vết nứt + độ ẩm cao: nước thấm vào cấu trúc bên trong, nguy cơ bong tróc mảng lớn",
      "Mốc đen quanh vết nứt cho thấy tình trạng ẩm kéo dài hơn 48 giờ",
      "Nhiệt độ >30°C + độ ẩm >75%: chỉ số nguy hiểm cho đá sa thạch",
    ],
    conditionAssessment: {
      severity: "Nguy hiểm",
      assessment: "Di tích đang trong tình trạng xuống cấp nghiêm trọng. Vết nứt kết hợp độ ẩm cao đe dọa kết cấu chịu lực của tường. Cần có chuyên gia bảo tồn can thiệp khẩn cấp.",
      needsSupport: true,
    },
  },
];

export function mockAnalyze(
  temp: number | null,
  humidity: number | null,
  detections: { label: string; confidence: number }[]
): GeminiAnalysis {
  const hasHighRisk = detections.some(
    (d) => (d.label === "crack_large" || d.label === "mold") && d.confidence > 0.75
  );
  const hasMediumRisk = detections.some((d) =>
    ["crack_small", "moss", "stain"].includes(d.label)
  );
  const envRisk = (humidity ?? 50) > 75 || (temp ?? 25) > 30;

  if (hasHighRisk || (envRisk && hasMediumRisk)) {
    return { ...MOCK_SCENARIOS[2] };
  }
  if (hasMediumRisk || envRisk) {
    return { ...MOCK_SCENARIOS[1] };
  }
  return { ...MOCK_SCENARIOS[0] };
}

export function mockTrendAnalyze(points: TrendDataPoint[]): TrendAnalysis {
  if (points.length < 2) {
    return {
      direction: "stable",
      summary: "Chưa đủ dữ liệu để đánh giá xu hướng. Cần ít nhất 2 điểm dữ liệu.",
      tempTrend: "Không đủ dữ liệu.",
      humidityTrend: "Không đủ dữ liệu.",
      detectionTrend: "Không đủ dữ liệu.",
      insights: ["Thu thập thêm dữ liệu qua các lần tuần tra để có đánh giá chính xác."],
      recommendations: ["Tiếp tục tuần tra định kỳ để xây dựng cơ sở dữ liệu xu hướng."],
    };
  }

  const avgTemp = points.reduce((s, p) => s + p.temp, 0) / points.length;
  const avgHum = points.reduce((s, p) => s + p.humidity, 0) / points.length;
  const firstTemp = points[0].temp;
  const lastTemp = points[points.length - 1].temp;
  const firstHum = points[0].humidity;
  const lastHum = points[points.length - 1].humidity;
  const detectionCount = points.filter((p) => p.detections.length > 0).length;
  const detectionRatio = detectionCount / points.length;

  const tempRising = lastTemp > firstTemp + 2;
  const tempFalling = lastTemp < firstTemp - 2;
  const humRising = lastHum > firstHum + 5;
  const humFalling = lastHum < firstHum - 5;

  let direction: TrendAnalysis["direction"] = "stable";
  let summary = "";
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (detectionRatio > 0.6 && humRising) {
    direction = "deteriorating";
    summary = "Phát hiện hư hại gia tăng kết hợp độ ẩm tăng cao — di tích đang xuống cấp nhanh.";
    insights.push("Tần suất phát hiện hư hại >60% cho thấy di tích đang trong giai đoạn xuống cấp chủ động.");
    insights.push("Độ ẩm tăng tạo điều kiện cho nấm mốc và bong tróc bề mặt.");
    recommendations.push("Cần can thiệp bảo tồn khẩn cấp. Giảm độ ẩm khu vực di tích.");
    recommendations.push("Tăng tần suất tuần tra lên mỗi 2 giờ để theo dõi sát.");
  } else if (detectionRatio > 0.3 || tempRising || humRising) {
    direction = "deteriorating";
    summary = "Xu hướng không tích cực — cần theo dõi chặt chẽ.";
    insights.push(`Phát hiện hư hại ở ${(detectionRatio * 100).toFixed(0)}% các điểm kiểm tra.`);
    if (tempRising) insights.push(`Nhiệt độ có xu hướng tăng (${firstTemp}°C → ${lastTemp}°C), có thể ảnh hưởng đến kết cấu.`);
    if (humRising) insights.push(`Độ ẩm tăng (${firstHum}% → ${lastHum}%), nguy cơ nấm mốc và phong hóa.`);
    recommendations.push("Theo dõi các điểm phát hiện hư hại, đánh giá mức độ lan rộng.");
    recommendations.push("Kiểm tra hệ thống thoát nước và thông gió khu vực di tích.");
  } else if (tempFalling && humFalling && detectionRatio < 0.2) {
    direction = "improving";
    summary = "Các chỉ số cải thiện tích cực — di tích đang trong trạng thái ổn định.";
    insights.push("Nhiệt độ và độ ẩm giảm, môi trường thuận lợi cho bảo quản.");
    insights.push("Tần suất phát hiện hư hại thấp, cho thấy các biện pháp bảo tồn đang phát huy hiệu quả.");
    recommendations.push("Duy trì tần suất tuần tra hiện tại.");
    recommendations.push("Tiếp tục giám sát các chỉ số môi trường để phát hiện bất thường sớm.");
  } else {
    direction = "stable";
    summary = "Dữ liệu tương đối ổn định, không có biến động bất thường.";
    insights.push(`Nhiệt độ dao động quanh mức ${avgTemp.toFixed(1)}°C — trong ngưỡng an toàn.`);
    insights.push(`Độ ẩm dao động quanh mức ${avgHum.toFixed(1)}% — cần tiếp tục theo dõi.`);
    recommendations.push("Tiếp tục tuần tra định kỳ để duy trì giám sát.");
    recommendations.push("Xem xét lắp đặt cảm biến môi trường cố định cho các khu vực nhạy cảm.");
  }

  return {
    direction,
    summary,
    tempTrend: tempRising ? `Tăng (${firstTemp}°C → ${lastTemp}°C)` : tempFalling ? `Giảm (${firstTemp}°C → ${lastTemp}°C)` : `Ổn định (~${avgTemp.toFixed(1)}°C)`,
    humidityTrend: humRising ? `Tăng (${firstHum}% → ${lastHum}%)` : humFalling ? `Giảm (${firstHum}% → ${lastHum}%)` : `Ổn định (~${avgHum.toFixed(1)}%)`,
    detectionTrend: detectionRatio > 0.5 ? "Tăng — nhiều phát hiện hư hại" : detectionRatio > 0.2 ? "Rải rác — cần theo dõi" : "Thấp — di tích ổn định",
    insights,
    recommendations,
  };
}
