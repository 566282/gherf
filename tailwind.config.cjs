/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#132a13',
        mint: '#ecf39e',
        moss: '#4f772d',
        amber: '#f9c74f',
        slate: '#1b263b',
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 20px 40px -20px rgba(19, 42, 19, 0.35)',
      },
    },
  },
  plugins: [],
};