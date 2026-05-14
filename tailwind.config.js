/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D9488', // Tosca
          dark: '#0F766E',
          light: '#CCFBF1'
        },
        secondary: {
          DEFAULT: '#FBBF24', // Kuning
          dark: '#F59E0B'
        },
        dark: '#1E293B',
        light: '#F8FAFC'
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        heading: ['Poppins', 'sans-serif']
      }
    },
  },
  plugins: [],
}
