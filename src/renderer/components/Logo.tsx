import { useId } from 'react'

interface LogoProps {
  size?: number
}

// Même dessin dans l'en-tête, la barre de titre et le widget.
// Seuls la palette et le fond suivent le thème ; le pulse reste blanc et respire seul.
function Logo({ size = 44 }: LogoProps) {
  // IDs uniques : plusieurs logos peuvent coexister dans le même document (ex. onboarding).
  const uid = useId().replace(/:/g, '')
  const borderId = `${uid}-border`
  const ringId = `${uid}-ring`
  const leftId = `${uid}-left`
  const rightId = `${uid}-right`

  const pulse = 'M 28 82 H 54 L 58 86 L 64 71 L 71 91 L 76 82 H 100'

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
        <linearGradient id={borderId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #06b6d4)" />
        </linearGradient>
        <linearGradient id={ringId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="100%" stopColor="var(--accent-secondary, #06b6d4)" />
        </linearGradient>
        <linearGradient id={leftId} x1="0" y1="1" x2="0.8" y2="0">
          <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--accent-primary, #6366f1) 86%, white)" />
        </linearGradient>
        <linearGradient id={rightId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--accent-primary, #6366f1) 60%, white)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--accent-primary, #6366f1) 52%, white)" />
        </linearGradient>
      </defs>

      {/* Fond contrasté selon le thème ; liseré sans halo extérieur. */}
      <rect className="akta-logo__background" width="128" height="128" rx="28" />
      <rect x="1.5" y="1.5" width="125" height="125" rx="26.5"
        fill="none" stroke={`url(#${borderId})`} strokeWidth="2" />

      {/* Progression : suit l'accentuation, sans animation. */}
      <path d="M 30 88 A 41.5 41.5 0 1 1 98 88"
        fill="none" stroke={`url(#${ringId})`} strokeWidth="7" strokeLinecap="round" />
      <circle className="akta-logo__dot" cx="92" cy="35" r="5.2" strokeWidth="1.2" />

      {/* A : couleur primaire à gauche, nuance plus claire de la MÊME teinte à droite. */}
      <path d="M 36 100 L 64 47" fill="none" stroke={`url(#${leftId})`}
        strokeWidth="16" strokeLinecap="round" />
      <path d="M 64 47 L 92 100" fill="none" stroke={`url(#${rightId})`}
        strokeWidth="16" strokeLinecap="round" />

      {/* Sur fond clair, une fine sous-couche sombre donne du contraste au blanc. */}
      <path className="akta-logo__pulse-contrast" d={pulse} fill="none"
        strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="akta-logo__pulse">
        <path className="akta-logo__pulse-glow" d={pulse} fill="none"
          stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pulse} fill="none" stroke="white" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export default Logo
