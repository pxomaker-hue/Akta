import { useId } from 'react'

interface LogoProps {
  size?: number
}

// Le A, l'orbite et le liseré réagissent aux deux variables d'accentuation.
// Le signal blanc garde sa forme et respire seul ; aucun effet sur le reste du symbole.
function Logo({ size = 44 }: LogoProps) {
  const uid = useId().replace(/:/g, '')
  const rimId = `${uid}-rim`
  const orbitId = `${uid}-orbit`
  const markId = `${uid}-mark`

  // Signal ECG volontairement simple, lisible même réduit en en-tête.
  const pulsePath = 'M 28 81 H 61 L 65 72 L 70 89 L 75 81 H 100'

  return (
    <svg
      className="akta-logo shrink-0"
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={rimId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="128" y2="128">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #06b6d4)" />
        </linearGradient>
        <linearGradient id={orbitId} gradientUnits="userSpaceOnUse" x1="27" y1="93" x2="105" y2="23">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #06b6d4)" />
        </linearGradient>
        <linearGradient id={markId} gradientUnits="userSpaceOnUse" x1="35" y1="75" x2="93" y2="75">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="42%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="54%" stopColor="color-mix(in srgb, var(--accent-primary, #6366f1) 72%, white)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--accent-primary, #6366f1) 60%, white)" />
        </linearGradient>
      </defs>

      <rect className="akta-logo__background" width="128" height="128" rx="29" />
      <rect x="1.5" y="1.5" width="125" height="125" rx="27"
        fill="none" stroke={`url(#${rimId})`} strokeWidth="2.6" />

      {/* Orbite et A arrondi : dessin statique, sans filtres ni animation. */}
      <path d="M 27.5 89 A 45 45 0 1 1 100.5 89"
        fill="none" stroke={`url(#${orbitId})`} strokeWidth="7.6" strokeLinecap="round" />
      <circle cx="94" cy="34" r="5.4" fill="white" />
      <path d="M 35 101 L 60 53 Q 64 45 68 53 L 93 101"
        fill="none" stroke={`url(#${markId})`} strokeWidth="17"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Le pulse, lui seul, respire. Sur fond clair un mince contraste le détache du blanc. */}
      <path className="akta-logo__pulse-contrast" d={pulsePath}
        fill="none" strokeWidth="6.1" strokeLinejoin="round" strokeLinecap="round" />
      <g className="akta-logo__pulse">
        <path className="akta-logo__pulse-halo" d={pulsePath}
          fill="none" stroke="white" strokeWidth="8"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d={pulsePath} fill="none" stroke="white"
          strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default Logo
