import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09111f",
        mist: "#9aa7bd",
        glow: "#8fffd1",
        coral: "#ff8d7a",
        panel: "#0d1828"
      },
      boxShadow: {
        neon: "0 0 40px rgba(143, 255, 209, 0.14)"
      },
      fontFamily: {
        sans: [
          "var(--font-sans)"
        ]
      }
    }
  },
  plugins: []
};

export default config;

