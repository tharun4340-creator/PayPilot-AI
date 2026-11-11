/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          50: '#F4F6FA',
          100: '#E6EAF2',
          200: '#C9D1E0',
          300: '#9AA7C0',
          400: '#6B7A99',
          500: '#4B5A78',
          600: '#34425F',
          700: '#233250',
          800: '#16233D',
          900: '#0F1A2E',
          950: '#0B1220',
        },
        pilot: {
          50: '#F1F0FE',
          100: '#E4E2FD',
          200: '#CBC7FB',
          300: '#A9A2F8',
          400: '#8A80F4',
          500: '#6F63EE',
          600: '#5B4BE0',
          700: '#4B3CC2',
          800: '#3E329C',
          900: '#2F2777',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,18,32,0.04), 0 4px 16px rgba(11,18,32,0.05)',
        pop: '0 12px 40px rgba(11,18,32,0.18)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        sheetUp: { from: { transform: 'translateY(24px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
      animation: {
        'fade-in': 'fadeIn 180ms ease-out',
        'sheet-up': 'sheetUp 200ms ease-out',
      },
    },
  },
  plugins: [],
};
