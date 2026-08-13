function browserOnly(): void {
  if (typeof document === "undefined" || typeof navigator === "undefined") {
    throw new Error("Tính năng này hiện được tối ưu cho bản web trên điện thoại.");
  }
}

export async function captureFromCamera(): Promise<string> {
  browserOnly();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ camera. Hãy chọn ảnh từ máy.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });

  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 250));

    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context || side === 0) throw new Error("Camera chưa trả về khung hình.");
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      640,
      640,
    );
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export function chooseImageFile(): Promise<string> {
  browserOnly();
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("Bạn chưa chọn ảnh."));
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Không đọc được ảnh đã chọn."));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
