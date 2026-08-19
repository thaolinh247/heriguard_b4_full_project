import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useNotification } from "@/hooks/useNotification";
import { ensureDemoSeedFresh } from "@/lib/sim/seedDemoData";
import "../../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useNotification();
  const [fontsLoaded] = useFonts({
    Helvetica: require("../../assets/helvetica-255/Helvetica.ttf"),
    "Helvetica-Bold": require("../../assets/helvetica-255/Helvetica-Bold.ttf"),
    "Helvetica-Oblique": require("../../assets/helvetica-255/Helvetica-Oblique.ttf"),
    "Helvetica-BoldOblique": require("../../assets/helvetica-255/Helvetica-BoldOblique.ttf"),
    "Helvetica-Light": require("../../assets/helvetica-255/helvetica-light-587ebe5a59211.ttf"),
    "Helvetica-Rounded-Bold": require("../../assets/helvetica-255/helvetica-rounded-bold-5871d05ead8de.otf"),
    "Helvetica-Compressed": require("../../assets/helvetica-255/helvetica-compressed-5871d14b6903a.otf"),
  });

  // Load persisted patrols + chỉ seed demo khi app hoàn toàn trống (lần cài mới)
  useEffect(() => {
    ensureDemoSeedFresh().catch((error) => {
      console.warn("[RootLayout] Failed to load persisted patrols:", error);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
