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
        'hot-pink': '#F4607A',
        'flamingo-blush': '#F4849A',
        'deep-jungle': '#1A3D1F',
        'tropical-leaf': '#4A8C3F',
        'warm-wood': '#8B5E3C',
        'dark-bg': '#0F2410',
      },
      fontFamily: {
        heading: ['Righteous', 'cursive'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
