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
          primary: '#D8405F',   // Bocas Pink — primary buttons, hero sections
          secondary: '#30407E', // Bocas Blue — nav, headings, backgrounds
          gold: '#AC8D4E',      // Sand Gold — accents, highlights
          teal: '#579BA6',      // Sea Teal — secondary buttons, outlines
          white: '#FFFFFF',
          black: '#111111',
        },
      },
    },
  },
  plugins: [],
};
export default config;
