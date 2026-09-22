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
        // League branding — Liga Isleñitos de Bocas, pulled from the league
        // crest. Kept separate from `brand` (the club's own tangerine/cream
        // palette) so league pages read as visually distinct from club
        // pages — first used in the match-day flyer, now the shared source
        // of truth for it instead of ad hoc hex values.
        league: {
          navy:      '#0C2A3D',   // Primary background for league sections
          panel:     '#123A54',   // Lifted card/panel background within navy
          turquoise: '#22AEC4',   // Accent — U10 pill, secondary highlights, borders
          gold:      '#F4B32C',   // Accent — headings, U14 pill, primary highlights
          muted:     '#A9C2D0',   // Secondary body text on navy
        },
      },
    },
  },
  plugins: [],
};
export default config;
