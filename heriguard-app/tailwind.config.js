/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#F2F7F1",
        paper: "#FFFFFF",
        ink: {
          DEFAULT: "#2A2420",
          soft: "#6b6258",
        },
        lacquer: {
          DEFAULT: "#B23A2E",
          dark: "#8C2C22",
        },
        jade: {
          DEFAULT: "#2F6F62",
          light: "#DCEDE7",
        },
        gold: {
          DEFAULT: "#C99A3E",
          light: "#F3E6C4",
        },
      },
      fontFamily: {
        helvetica: ["Helvetica"],
        "helvetica-bold": ["Helvetica-Bold"],
        "helvetica-oblique": ["Helvetica-Oblique"],
        "helvetica-light": ["Helvetica-Light"],
      },
    },
  },
  plugins: [],
};
