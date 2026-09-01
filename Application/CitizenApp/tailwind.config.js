const { colors, radius, fontSize } = require('./src/theme/tokens');

/**
 * NativeWind v2. Utilities here must exist in v2's RN mapping — no `blur-*`,
 * no `backdrop-*`, no `divide-*`.
 *
 * fontFamily is deliberately absent. expo-font is not installed, so naming
 * Poppins/Inter here produced classes that silently fell back to the system
 * face. Typography is owned by src/theme/type.ts, which resolves real
 * platform-installed faces via Platform.select.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      fontSize,
    },
  },
  plugins: [],
};
