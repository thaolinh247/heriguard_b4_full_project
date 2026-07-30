import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useAlertStore } from "@/store/alertStore";

export function useNotification() {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = useAlertStore.subscribe((state) => {
      const latest = state.alerts[0];
      if (!latest || latest.id === lastIdRef.current || latest.read) return;
      const isHighRisk =
        latest.type.startsWith("detect_") &&
        (latest.message.includes("75%") ||
          latest.message.includes("80%") ||
          latest.message.includes("85%") ||
          latest.message.includes("90%") ||
          latest.message.includes("95%"));
      if (isHighRisk) {
        lastIdRef.current = latest.id;
        Alert.alert("Phát hiện nguy cơ cao", latest.message);
      }
    });
    return unsub;
  }, []);
}
