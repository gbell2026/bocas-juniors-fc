import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-anton)', 'sans-serif'],
        body: ['var(--font-montserrat)', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: '#FF0055',   // Hot pink — primary buttons, left-border accents
          cyan:    '#00E5FF',   // Electric cyan — active states, labels, outlines, borders
          gold:    '#AC8D4E',   // Sand Gold — nav active underline (unchanged)
          dark:    '#0A0A0A',   // Near-black — page and nav backgrounds
          surface: '#111111',   // Dark card/section backgrounds
          border:  '#1E1E1E',   // Subtle dividers
          white:   '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
export default config;
