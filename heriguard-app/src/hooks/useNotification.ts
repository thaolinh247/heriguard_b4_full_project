import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useAlertStore } from "@/store/alertStore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotification() {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("alerts", {
          name: "Cảnh báo heriguard",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 100, 200],
        });
      }
    })();
  }, []);

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
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Phát hiện nguy cơ cao",
            body: latest.message,
            data: { alertId: latest.id },
            sound: "default",
          },
          trigger: null,
        });
      }
    });
    return unsub;
  }, []);
}
