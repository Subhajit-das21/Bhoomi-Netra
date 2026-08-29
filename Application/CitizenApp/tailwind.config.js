/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: '#F0E6D2',
        navy: '#1F3A5C',
        rust: '#A8452F',
        gold: '#B8863B',
        ink: '#2B2118',
        clay: '#C97B5A',
        olive: '#6B7A4F',
      },
      fontFamily: {
        display: ['Poppins-SemiBold', 'sans-serif'],
        body: ['Inter-Regular', 'sans-serif'],
        mono: ['JetBrainsMono-Regular', 'monospace'],
      },
      borderRadius: {
        'soft': '12px',
        'softer': '16px',
      }
    },
  },
  plugins: [],
}
