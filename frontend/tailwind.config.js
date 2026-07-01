/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        // Brand Colors (Exact Pantone)
        primary: {
          orange: "#f08300", // Pantone P 24-8 C - Primary CTAs, active borders
          green: "#13A538", // Pantone P 148-8 C - Success, confirmations
        },
        // Semantic Colors
        success: "#13A538",
        error: "#d32f2f",
        warning: "#f6a200",
        // Extended Gray Palette
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
          950: "#030712",
        },
      },
      borderRadius: {
        soft: "0.375rem", // 6px - Humanized soft corners
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
        // Arabic font support
        arabic: ["Noto Sans Arabic", "Arial", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.2s ease-out",
        "slide-down": "slideDown 0.2s ease-out",
        "slide-left": "slideLeft 0.2s ease-out",
        "slide-right": "slideRight 0.2s ease-out",
        "window-appear": "windowAppear 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideLeft: {
          "0%": { transform: "translateX(10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideRight: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        windowAppear: {
          "0%": { transform: "scale(0.95) translateY(-10px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
      },
      gridTemplateColumns: {
        14: "repeat(14, minmax(0, 1fr))",
        16: "repeat(16, minmax(0, 1fr))",
      },
      zIndex: {
        modal: "1000",
        dropdown: "1010",
        tooltip: "1020",
        notification: "1030",
        window: "1040",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
  // RTL support
  future: {
    hoverOnlyWhenSupported: true,
  },
};
