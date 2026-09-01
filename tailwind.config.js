/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stage: {
          bg: '#0a0a14',
          card: '#121224',
          accent: '#ff2a85',
          neon: '#00f0ff',
          gold: '#ffd700',
          purple: '#8b5cf6',
          dark: '#06060c'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        jp: ['"Noto Sans JP"', '"Hiragino Sans"', '"Meiryo"', 'sans-serif']
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'marquee': 'marquee 25s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(255, 42, 133, 0.6)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 240, 255, 0.8)' },
        },
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      }
    },
  },
  plugins: [],
}
