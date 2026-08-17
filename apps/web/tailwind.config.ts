import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ghost: '#2a2a2a',
        stale: '#52525b',
        aging: '#f59e0b',
        live: '#10b981',
      },
    },
  },
  plugins: [],
};

export default config;
