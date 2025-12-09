import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        'ui-elements': '#1A1A1A',
        'accent': '#E50914',
        'accent-darker': '#CC0712',
      },
      fontFamily: {
        heading: ['var(--font-bebas-neue)'],
        body: ['var(--font-roboto)'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
      keyframes: {
        'pulse-once': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        }
      },
      animation: {
        'pulse-once': 'pulse-once 1s ease-in-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
};
export default config;
