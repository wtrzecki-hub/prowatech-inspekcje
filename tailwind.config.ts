import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Shadcn / Radix base tokens ──────────────────────────────────────
        background: "#ffffff",
        foreground: "#0F1520",
        border: "#DDE3EA",
        input: "#DDE3EA",
        ring: "#259648",
        card: { DEFAULT: "#ffffff", foreground: "#0F1520" },
        muted: { DEFAULT: "#EEF1F5", foreground: "#5F6B7A" },
        accent: { DEFAULT: "#EEF1F5", foreground: "#0F1520" },
        secondary: { DEFAULT: "#EEF1F5", foreground: "#0F1520" },
        popover: { DEFAULT: "#ffffff", foreground: "#0F1520" },

        // ─── Brand / Primary ─────────────────────────────────────────────────
        // PRIMARY = #259648 (delikatnie jaśniejszy od logo #1F7F3A)
        // Zmiana jednolinijkowa: zaktualizuj primary-600 i ring powyżej.
        primary: {
          DEFAULT: "#259648",
          foreground: "#ffffff",
          50: "#F0F9F1",
          100: "#DCEFE0",
          500: "#2E9F4A",
          600: "#259648",
          700: "#1F7F3A",
          800: "#17632E",
        },

        // ─── Graphite (neutralne) ─────────────────────────────────────────────
        graphite: {
          50: "#F7F9FB",
          100: "#EEF1F5",
          200: "#DDE3EA",
          500: "#5F6B7A",
          800: "#1B2230",
          900: "#0F1520",
        },

        // ─── Szarości (backward compat) ──────────────────────────────────────
        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },

        // ─── Kolory semantyczne ───────────────────────────────────────────────
        success: {
          DEFAULT: "#2E9F4A",
          foreground: "#ffffff",
          50: "#F0F9F1",
          100: "#DCEFE0",
          800: "#14532D",
        },
        info: {
          DEFAULT: "#0284C7",
          foreground: "#ffffff",
          50: "#F0F9FF",
          100: "#E0F2FE",
          800: "#075985",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#ffffff",
          50: "#FFFBEB",
          100: "#FEF3C7",
          800: "#92400E",
        },
        danger: {
          DEFAULT: "#DC2626",
          foreground: "#ffffff",
          50: "#FEF2F2",
          100: "#FEE2E2",
          800: "#991B1B",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#ffffff",
          50: "#FEF2F2",
          100: "#FEE2E2",
          800: "#991B1B",
        },
      },

      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },

      boxShadow: {
        xs: "0 1px 2px rgba(15,23,32,0.04)",
        sm: "0 1px 3px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)",
        md: "0 4px 12px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)",
        lg: "0 12px 32px rgba(15,23,32,0.10), 0 2px 4px rgba(15,23,32,0.05)",
        focus: "0 0 0 4px rgba(37,150,72,0.22)",
      },

      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "Menlo", "monospace"],
      },

      keyframes: {
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-left": {
          from: { opacity: "0", transform: "translateX(10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-right": {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.3s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-left": "slide-left 0.3s ease-out",
        "slide-right": "slide-right 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
