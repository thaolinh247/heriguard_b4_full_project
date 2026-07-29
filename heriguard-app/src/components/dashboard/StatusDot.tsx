import { useEffect, useState } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

interface StatusDotProps {
  online: boolean;
  size?: number;
}

export function StatusDot({ online, size = 10 }: StatusDotProps) {
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (online) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [online, pulseAnim]);

  return (
    <View style={[styles.container, { width: size + 8, height: size + 8 }]}>
      <Animated.View
        style={[
          styles.outerRing,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            backgroundColor: online ? Colors.jade + "30" : Colors.lacquer + "30",
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: online ? Colors.jade : Colors.lacquer,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
  },
  dot: {
    position: "absolute",
  },
});
