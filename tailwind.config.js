// La palette "indigo" suit la couleur d'accent choisie dans les réglages (--accent-primary) :
// les classes indigo-* existantes s'adaptent donc au thème sans toucher chaque composant.
// À l'accent par défaut (#6366f1 = indigo-500), le rendu reste quasiment identique.
const accentShade = (mix) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === '1'
    ? mix
    : `color-mix(in srgb, ${mix} calc(${opacityValue} * 100%), transparent)`
const tint = (pct) => accentShade(`color-mix(in srgb, var(--accent-primary) ${pct}%, white)`)
const shade = (pct) => accentShade(`color-mix(in srgb, var(--accent-primary) ${pct}%, black)`)

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: {
          50: tint(7),
          100: tint(14),
          200: tint(28),
          300: tint(50),
          400: tint(75),
          500: accentShade('var(--accent-primary)'),
          600: shade(88),
          700: shade(74),
          800: shade(58),
          900: shade(44),
          950: shade(28),
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
