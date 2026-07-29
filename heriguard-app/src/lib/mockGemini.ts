import type { GeminiAnalysis } from "@/types/gemini";

const MOCK_SCENARIOS: GeminiAnalysis[] = [
  {
    severity: "low",
    summary: "Không phát hiện vấn đề nghiêm trọng. Môi trường di tích ổn định.",
    findings: [
      { type: "environment", description: "Nhiệt độ và độ ẩm trong ngưỡng an toàn.", confidence: 95 },
    ],
    envAssessment: "Nhiệt độ 27.5°C và độ ẩm 65% phù hợp cho bảo quản di tích gạch đá. Không có nguy cơ ngưng tụ hơi nước.",
    correlations: [],
    recommendations: [
      "Tiếp tục theo dõi định kỳ 1 lần/tuần.",
      "Duy trì điều kiện môi trường hiện tại.",
    ],
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
    recommendations: [
      "Giảm độ ẩm xuống dưới 65% bằng máy hút ẩm hoặc tăng thông gió.",
      "Kiểm tra khả năng thấm nước tại chân tường phía Bắc.",
      "Xử lý mảng rêu bằng dung dịch chống nấm sinh học.",
      "Theo dõi lại sau 1 tuần để đánh giá tiến triển.",
    ],
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
    recommendations: [
      "KHẨN CẤP: Dán băng cảnh báo khu vực nguy hiểm.",
      "Chụp ảnh Macro vết nứt và gửi chuyên gia bảo tồn.",
      "Đo độ ẩm lõi tường bằng thiết bị chuyên dụng.",
      "Giảm độ ẩm môi trường xuống <60% trong 24 giờ.",
      "Gia cố tạm thời bằng vữa bảo tồn chuyên dụng.",
      "Lên lịch kiểm tra kết cấu toàn bộ tường trong vòng 72 giờ.",
    ],
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
