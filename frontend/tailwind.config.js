/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgba(255, 255, 255, 0.08)',
        brand: {
          500: '#5A45FF',
          600: '#4835D8',
          sidebar: '#0B0F19',
        },
        terracotta: {
          50: '#FDF6F2',
          100: '#FBECE5',
          200: '#F7D6C8',
          300: '#EEB19A',
          400: '#E28666',
          500: '#D2643E',
          600: '#C4552D',
          700: '#A4411F',
          800: '#86361D',
          900: '#6E2F1B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
