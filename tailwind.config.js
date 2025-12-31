/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./features/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#00C897',       // Mint Teal
        background: '#FFFFFF',    // Clean White
        surface: '#F8F9FB',       // Off-White
        text: {
          main: '#2D3436',        // Charcoal
        },
        danger: '#FF7675',        // Soft Coral (Relapse)
        success: '#FDCB6E',       // Golden Sun
      },
    },
  },
  plugins: [],
}
