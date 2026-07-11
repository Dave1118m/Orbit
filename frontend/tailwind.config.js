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
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

