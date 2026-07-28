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
        heading: ['var(--font-barlow-condensed)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary:     '#F26522',   // Tangerine — CTAs, headings, accents
          primaryDeep: '#B84F1D',   // Tangerine Deep — hover, display numbers, eyebrow labels on light
          accent:      '#FFB627',   // Amber — accent only, small areas
          ink:         '#141311',   // Near-black — dark sections only (nav, homepage CTA band)
          charcoal:    '#211F1C',   // Lifted dark panels (within dark sections)
          cream:       '#FBF7F2',   // Primary page background
          creamAlt:    '#F7F1E9',   // Alternate section banding / neutral fills
          tint:        '#FCEFE4',   // Pale highlight card background
          line:        '#E7DFD5',   // Borders, dividers on light backgrounds
          muted:       '#6E665B',   // Secondary body text on light
          mutedWarm:   '#8A8175',   // Muted labels, sub-copy
          mutedLight:  '#C9BFB2',   // Muted text on dark sections
          white:       '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
export default config;
