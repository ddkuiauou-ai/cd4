/**
 * @type {import('tailwindcss').Config}
 */
export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Korean Stock Market Standards
        "market-up": "oklch(45.2% 0.313 25.86)", // Red for price up/profit (#D60000)
        "market-down": "oklch(42.1% 0.194 258.34)", // Blue for price down/loss (#0066CC)
        "market-neutral": "oklch(54.9% 0.040 258.18)", // Gray for unchanged (#6B7280)

        // Professional UI Base Colors (Office/Quant Style)
        "text-primary": "oklch(20.4% 0.005 258.34)", // Near-black for main text (#111111)
        "text-secondary": "oklch(49.0% 0.005 258.34)", // Medium gray for descriptions (#666666)
        "bg-subtle": "oklch(98.4% 0.002 258.34)", // Off-white for card backgrounds (#FBFBFB)
        "border-light": "oklch(91.8% 0.003 258.34)", // Light gray for borders/dividers (#E5E5E5)
        inactive: "oklch(83.2% 0.003 258.34)", // Disabled elements (#CCCCCC)

        // Brand Accent Colors (Limited Use - Logo Based)
        "brand-accent-1": "oklch(47.8% 0.209 31.68)", // Orange-red for button hover only (#d83d1e)
        "brand-accent-2": "oklch(76.5% 0.162 82.48)", // Warm yellow for badges only (#f5aa0d)
        "brand-deep": "oklch(14.2% 0.037 35.83)", // Deep brown for logo text only (#1c0d04)
        "brand-sub": "oklch(53.4% 0.049 75.96)", // Muted brown for logo zones only (#907946)

        // Dark Mode Support
        "dark-bg": "oklch(23.4% 0.005 258.34)", // #1a1a1a
        "dark-text": "oklch(96.8% 0.002 258.34)", // #f5f5f5
        "dark-card": "oklch(28.6% 0.005 258.34)", // #262626
        "dark-border": "oklch(38.2% 0.005 258.34)", // #404040
      },
      fontFamily: {
        // fontFamily 추가
        serif: ["Noto Serif KR", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: ["@tailwindcss/postcss"],
};
