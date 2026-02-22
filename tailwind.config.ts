import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        border: "var(--color-border)"
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "18px",
        pill: "999px"
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.4,0,0.2,1)"
      }
    }
  },
  plugins: []
};

export default config;
