/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        mango: {
          400: '#ffb347',
          500: '#FF9A44',
          600: '#ff7b00',
        },
        peach: {
          300: '#ffbca5',
          500: '#FF8A5C',
        },
      },
    },
  },
  plugins: [],
}
