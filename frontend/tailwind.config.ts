// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          darkGreen: '#0F4C3A',  // Main brand green
          lightGreen: '#E9F4EE', // Soft green banner background
          cream: '#FAF9F5',      // Main body background
          navy: '#0C1C2C',       // Dark blue stats section
          textMuted: '#5F6972',  // Secondary grey text
        }
      },
      fontFamily: {
        serif: ['Georgia', 'serif'], // Elegant titles
        sans: ['Inter', 'sans-serif'], // Clean modern body
      }
    },
  },
  plugins: [],
} satisfies Config