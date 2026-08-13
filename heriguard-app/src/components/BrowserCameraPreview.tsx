import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Platform, View } from "react-native";

export interface BrowserCameraHandle { capture: () => string; stop: () => void; }
interface Props { onError: (message: string) => void; onReady?: () => void; }

export const BrowserCameraPreview = forwardRef<BrowserCameraHandle, Props>(function BrowserCameraPreview({ onError, onReady }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stop = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };

  useImperativeHandle(ref, () => ({
    stop,
    capture: () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) throw new Error("Camera chưa sẵn sàng.");
      const size = Math.min(video.videoWidth, video.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không tạo được khung chụp.");
      context.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, size, size);
      return canvas.toDataURL("image/jpeg", 0.9);
    },
  }));

  useEffect(() => {
    if (Platform.OS !== "web" || !navigator.mediaDevices?.getUserMedia) { onError("Trình duyệt không hỗ trợ camera."); return; }
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(async (stream) => {
      if (cancelled) return stream.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      onReady?.();
    }).catch((reason) => onError(reason instanceof Error ? reason.message : "Không mở được camera."));
    return () => { cancelled = true; stop(); };
  }, []);

  if (Platform.OS !== "web") return <View style={{ flex: 1 }} />;
  return (
    <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  );
});
