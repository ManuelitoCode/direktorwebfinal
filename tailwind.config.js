/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'jetbrains': ['JetBrains Mono', 'monospace'],
        'orbitron': ['Orbitron', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glitch': 'glitch 3s ease-in-out infinite',
        'fadeUp': 'fadeUp 1s ease-out forwards',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
};