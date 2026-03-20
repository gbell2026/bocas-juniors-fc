import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: '#1a5276',   // REPLACE with actual club primary colour
          secondary: '#f39c12', // REPLACE with actual club secondary colour
          accent: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};
export default config;
