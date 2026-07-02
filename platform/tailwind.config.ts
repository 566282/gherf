import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1020',
        mist: '#E7EDF6',
        slate: '#1F2A44',
        ember: '#FF7A18',
        mint: '#00C48C',
      },
      boxShadow: {
        depth: '0 20px 60px rgba(11, 16, 32, 0.18)',
      },
      borderRadius: {
        card: '1.25rem',
      },
      backgroundImage: {
        hero: 'radial-gradient(circle at 20% 10%, rgba(255,122,24,0.35), transparent 50%), radial-gradient(circle at 80% 0%, rgba(0,196,140,0.25), transparent 45%), linear-gradient(160deg, #0b1020 0%, #1f2a44 45%, #0b1020 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
