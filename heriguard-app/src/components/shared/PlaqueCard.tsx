import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

interface PlaqueCardProps {
  label?: string;
  children: React.ReactNode;
  style?: object;
}

export function PlaqueCard({ label, children, style }: PlaqueCardProps) {
  return (
    <View style={[styles.card, style]}>
      {/* Gold corner dots */}
      <View style={styles.cornerTL} />
      <View style={styles.cornerBR} />

      {/* Tab label */}
      {label && (
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}

      {children}
    </View>
  );
}

const DOT_SIZE = 6;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 2,
    padding: 16,
    position: "relative",
  },
  cornerTL: {
    position: "absolute",
    top: -3,
    left: -3,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.gold,
  },
  cornerBR: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.gold,
  },
  labelWrap: {
    position: "absolute",
    top: -10,
    left: 14,
    backgroundColor: Colors.paper,
    paddingHorizontal: 6,
  },
  label: {
    fontFamily: "Helvetica",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.jade,
  },
});
