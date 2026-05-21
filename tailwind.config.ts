import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: { DEFAULT: "#111111", 2: "#161616", 3: "#1C1C1C" },
        border: { DEFAULT: "rgba(255,255,255,0.06)", strong: "rgba(255,255,255,0.10)" },
        text: { primary: "#EDEDED", secondary: "#A1A1A1", muted: "#525252" },
        accent: { DEFAULT: "#00D4AA", dim: "rgba(0,212,170,0.12)", glow: "rgba(0,212,170,0.25)" },
        danger: "#EF4444",
        warning: "#F59E0B",
        success: "#22C55E",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        pulse2: "pulse2 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin 8s linear infinite",
        blink: "blink 1.2s step-end infinite",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulse2: { "0%,100%": { opacity: "0.4" }, "50%": { opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
    },
  },
  plugins: [],
};

export default config;
