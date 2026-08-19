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
      dayDetails: [],
      insights: ["Thu thập thêm dữ liệu qua các lần tuần tra để có đánh giá chính xác."],
      recommendations: ["Tiếp tục tuần tra định kỳ để xây dựng cơ sở dữ liệu xu hướng."],
    };
  }

  // dayDetails: NGÀY 3 (mới nhất) → NGÀY 1 (cũ nhất)
  const dayDetails = points
    .map((p, i) => ({
      day: `NGÀY ${points.length - i}`,
      date: p.timestamp.slice(0, 10),
      temp: p.temp,
      humidity: p.humidity,
      detections: p.detections.length,
      severity:
        p.detections.length === 0
          ? "Sạch"
          : p.detections.every((d) => d.confidence >= 0.75)
            ? "Cao"
            : p.detections.some((d) => d.confidence >= 0.6)
              ? "Trung bình"
              : "Thấp",
      note:
        p.detections.length === 0
          ? "Không phát hiện dấu hiệu hư hại."
          : `Phát hiện ${p.detections.length} dấu hiệu (${p.detections.map((d) => `${d.label} ${(d.confidence * 100).toFixed(0)}%`).join(", ")}).`,
    }))
    .reverse();

  const avgTemp = points.reduce((s, p) => s + p.temp, 0) / points.length;
  const avgHum = points.reduce((s, p) => s + p.humidity, 0) / points.length;
  const firstTemp = points[0].temp;
  const lastTemp = points[points.length - 1].temp;
  const firstHum = points[0].humidity;
  const lastHum = points[points.length - 1].humidity;
  const tempDelta = lastTemp - firstTemp;
  const humDelta = lastHum - firstHum;
  const detectionCount = points.filter((p) => p.detections.length > 0).length;
  const detectionRatio = detectionCount / points.length;
  const totalDetections = points.reduce((s, p) => s + p.detections.length, 0);
  const avgDetectionsPerPoint = totalDetections / points.length;

  const tempRising = tempDelta > 2;
  const tempFalling = tempDelta < -2;
  const humRising = humDelta > 5;
  const humFalling = humDelta < -5;

  let direction: TrendAnalysis["direction"] = "stable";
  let summary = "";
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (detectionRatio > 0.6 && humRising) {
    direction = "deteriorating";
    summary = `Phát hiện hư hại gia tăng nghiêm trọng — ${detectionRatio > 0.8 ? "hầu hết" : "hơn 60%"} các điểm kiểm tra có dấu hiệu bất thường. Độ ẩm tăng ${humDelta.toFixed(1)}% qua ${points.length} ngày, tạo điều kiện thuận lợi cho nấm mốc, rêu và phong hóa bề mặt. Nhiệt độ trung bình ${avgTemp.toFixed(1)}°C nằm trong ngưỡng加速 hư hại kết cấu.`;
    insights.push(`Tần suất phát hiện hư hại ${(detectionRatio * 100).toFixed(0)}% (${detectionCount}/${points.length} ngày) — xu hướng đang xấu đi.`);
    insights.push(`Độ ẩm tăng liên tục từ ${firstHum}% lên ${lastHum}% (+${humDelta.toFixed(1)}%) — vượt ngưỡng 70% an toàn cho bảo quản.`);
    insights.push(`Tổng cộng ${totalDetections} phát hiện qua ${points.length} ngày, trung bình ${avgDetectionsPerPoint.toFixed(1)} phát hiện/điểm kiểm tra.`);
    insights.push("Kết hợp nhiệt độ và độ ẩm cao tạo \"vòng xoáy xuống cấp\": ẩm → nứt → thấm nước → nứt rộng hơn.");
    recommendations.push("KHẨN: Giảm độ ẩm khu vực di tích xuống dưới 65% bằng máy hút ẩm hoặc thông gió.");
    recommendations.push("Tăng tần suất tuần tra lên 2-3 lần/ngày để theo dõi tốc độ lan rộng.");
    recommendations.push("Phun protective coating lên bề mặt nứt để ngăn nước xâm nhập.");
    recommendations.push("Liên hệ chuyên gia bảo tồn trong vòng 48 giờ để đánh giá kết cấu.");
  } else if (detectionRatio > 0.3 || tempRising || humRising) {
    direction = "deteriorating";
    summary = `Xu hướng không tích cực — phát hiện hư hại ở ${(detectionRatio * 100).toFixed(0)}% các điểm kiểm tra. ${tempRising ? `Nhiệt độ tăng ${tempDelta.toFixed(1)}°C,加速 quá trình lão hóa vật liệu.` : ""} ${humRising ? `Độ ẩm tăng ${humDelta.toFixed(1)}%, tạo môi trường cho vi sinh vật.` : ""} Cần theo dõi chặt chẽ để ngăn chặn sớm.`;
    insights.push(`Phát hiện hư hại ở ${detectionCount}/${points.length} ngày (${(detectionRatio * 100).toFixed(0)}%).`);
    if (tempRising) insights.push(`Nhiệt độ: ${firstTemp}°C → ${lastTemp}°C (+${tempDelta.toFixed(1)}°C). Nhiệt độ cao加速 quá trình oxy hóa và phân hủy kết cấu.`);
    if (humRising) insights.push(`Độ ẩm: ${firstHum}% → ${lastHum}% (+${humDelta.toFixed(1)}%). Độ ẩm >70% là môi trường lý tưởng cho nấm mốc.`);
    insights.push(`Trung bình ${avgDetectionsPerPoint.toFixed(1)} phát hiện/điểm kiểm tra.`);
    recommendations.push("Theo dõi các điểm phát hiện hư hại, đánh giá mức độ lan rộng hàng ngày.");
    recommendations.push("Kiểm tra hệ thống thoát nước và thông gió khu vực di tích.");
    recommendations.push("Chuẩn bị biện pháp can thiệp sớm nếu xu hướng tiếp tục xấu đi.");
  } else if (tempFalling && humFalling && detectionRatio < 0.2) {
    direction = "improving";
    summary = `Các chỉ số cải thiện tích cực qua ${points.length} ngày giám sát. Nhiệt độ giảm ${Math.abs(tempDelta).toFixed(1)}°C, độ ẩm giảm ${Math.abs(humDelta).toFixed(1)}% — môi trường đang trở nên thuận lợi hơn cho bảo quản. Tần suất phát hiện hư hại thấp (${(detectionRatio * 100).toFixed(0)}%), cho thấy các biện pháp hiện tại đang phát huy hiệu quả.`;
    insights.push(`Nhiệt độ: ${firstTemp}°C → ${lastTemp}°C (giảm ${Math.abs(tempDelta).toFixed(1)}°C) — trong ngưỡng an toàn.`);
    insights.push(`Độ ẩm: ${firstHum}% → ${lastHum}% (giảm ${Math.abs(humDelta).toFixed(1)}%) — thấp hơn ngưỡng 70%.`);
    insights.push(`Chỉ ${(detectionRatio * 100).toFixed(0)}% ngày có phát hiện — ди tích đang ổn định.`);
    recommendations.push("Duy trì tần suất tuần tra hiện tại.");
    recommendations.push("Tiếp tục giám sát các chỉ số môi trường để phát hiện bất thường sớm.");
    recommendations.push("Ghi nhận kết quả tích cực làm baseline cho so sánh tương lai.");
  } else {
    direction = "stable";
    summary = `Dữ liệu qua ${points.length} ngày tương đối ổn định, không có biến động bất thường. Nhiệt độ trung bình ${avgTemp.toFixed(1)}°C và độ ẩm ${avgHum.toFixed(1)}% nằm trong ngưỡng an toàn cho bảo quản di tích. ${detectionRatio > 0.2 ? "Có một số phát hiện nhỏ cần theo dõi." : "Không phát hiện hư hại đáng kể."}`;
    insights.push(`Nhiệt độ dao động quanh ${avgTemp.toFixed(1)}°C (dao động ±${(Math.max(...points.map(p => p.temp)) - Math.min(...points.map(p => p.temp))).toFixed(1)}°C) — ổn định.`);
    insights.push(`Độ ẩm trung bình ${avgHum.toFixed(1)}% (dao động ±${(Math.max(...points.map(p => p.humidity)) - Math.min(...points.map(p => p.humidity))).toFixed(1)}%) — trong ngưỡng.`);
    if (detectionRatio > 0.2) {
      insights.push(`Có phát hiện ở ${detectionCount}/${points.length} ngày — cần theo dõi định kỳ.`);
    }
    recommendations.push("Tiếp tục tuần tra định kỳ để duy trì giám sát.");
    recommendations.push("Xem xét lắp đặt cảm biến môi trường cố định cho các khu vực nhạy cảm.");
  }

  return {
    direction,
    summary,
    tempTrend: tempRising ? `Tăng: ${firstTemp}°C → ${lastTemp}°C (+${tempDelta.toFixed(1)}°C)` : tempFalling ? `Giảm: ${firstTemp}°C → ${lastTemp}°C (${tempDelta.toFixed(1)}°C)` : `Ổn định: ~${avgTemp.toFixed(1)}°C (dao động ${(Math.max(...points.map(p => p.temp)) - Math.min(...points.map(p => p.temp))).toFixed(1)}°C)`,
    humidityTrend: humRising ? `Tăng: ${firstHum}% → ${lastHum}% (+${humDelta.toFixed(1)}%)` : humFalling ? `Giảm: ${firstHum}% → ${lastHum}% (${humDelta.toFixed(1)}%)` : `Ổn định: ~${avgHum.toFixed(1)}% (dao động ${(Math.max(...points.map(p => p.humidity)) - Math.min(...points.map(p => p.humidity))).toFixed(1)}%)`,
    detectionTrend: detectionRatio > 0.5 ? `Tăng: ${(detectionRatio * 100).toFixed(0)}% ngày có phát hiện (${totalDetections} phát hiện)` : detectionRatio > 0.2 ? `Rải rác: ${detectionCount}/${points.length} ngày, cần theo dõi` : `Thấp: chỉ ${(detectionRatio * 100).toFixed(0)}% ngày có phát hiện`,
    dayDetails,
    insights,
    recommendations,
  };
}
