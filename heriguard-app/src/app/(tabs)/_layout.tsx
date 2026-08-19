import { Tabs } from "expo-router";
import { Image } from "react-native";
import { Colors, Font } from "@/constants/theme";

const logo = require("../../../assets/images/novaculture.png");

function TabIcon() {
  return (
    <Image
      source={logo}
      style={{ width: 22, height: 22, borderRadius: 4 }}
      resizeMode="cover"
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.jade,
        tabBarInactiveTintColor: Colors.inkSoft,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: Font.regular,
          fontSize: 10,
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          backgroundColor: Colors.paper,
          borderTopColor: Colors.line,
          borderTopWidth: 1,
          height: 105,
          paddingBottom: 14,
          paddingTop: 6,
        },
        tabBarIcon: () => <TabIcon />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Trang chủ" }}
      />
      <Tabs.Screen
        name="camera"
        options={{ title: "Camera" }}
      />
      <Tabs.Screen
        name="charts"
        options={{ title: "Biểu đồ" }}
      />
      <Tabs.Screen
        name="points"
        options={{ title: "Điểm chụp" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Cài đặt" }}
      />
    </Tabs>
  );
}
