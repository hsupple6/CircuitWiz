/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
        },
        carbon: {
          black: '#000000',
          matte: '#0a0a0c',
          surface: '#111114',
          card: '#16161a',
          elevated: '#1c1c22',
          border: '#25252d',
          muted: '#3f3f4a',
          accent: 'rgb(var(--accent-400) / <alpha-value>)',
          'accent-dim': 'rgb(var(--accent-500) / <alpha-value>)',
          glow: 'rgb(var(--accent-glow) / 0.18)',
        },
        dark: {
          bg: '#000000',
          surface: '#0a0a0c',
          card: '#16161a',
          border: '#25252d',
          text: {
            primary: '#f4f4f5',
            secondary: '#a1a1aa',
            muted: '#71717a',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 28s linear infinite',
        'carbon-drift': 'carbonDrift 20s ease-in-out infinite alternate',
      },
      keyframes: {
        carbonDrift: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '100%': { transform: 'translate(2%, -2%) rotate(8deg)' },
        },
      },
    },
  },
  plugins: [],
}
