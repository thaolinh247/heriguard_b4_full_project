export const Colors = {
  cream: "#F2F7F1",
  paper: "#FFFFFF",
  ink: "#2A2420",
  inkSoft: "#6b6258",
  lacquer: "#B23A2E",
  lacquerDark: "#8C2C22",
  jade: "#2F6F62",
  jadeLight: "#DCEDE7",
  gold: "#C99A3E",
  goldLight: "#F3E6C4",
  line: "rgba(42,36,32,0.16)",
} as const;

export const Font = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
  boldOblique: "Helvetica-BoldOblique",
  light: "Helvetica-Light",
  roundedBold: "Helvetica-Rounded-Bold",
  compressed: "Helvetica-Compressed",
} as const;

export const RiskColors = {
  low: Colors.jade,
  medium: Colors.gold,
  high: Colors.lacquer,
} as const;

export const RiskLabels = {
  low: "An toàn",
  medium: "Cần chú ý",
  high: "Cảnh báo",
} as const;

export type RiskLevel = keyof typeof RiskColors;
