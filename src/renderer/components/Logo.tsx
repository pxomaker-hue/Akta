interface LogoProps {
  size?: number
}

function Logo({ size = 44 }: LogoProps) {
  return (
    <div
      // dark:bg-slate-800 (et non -900) : le header est lui-même en slate-900, donc le fond de ce
      // badge devenait invisible dessus — seul le contour se distinguait encore.
      className="relative flex items-center justify-center rounded-2xl shadow-lg shrink-0 border border-gray-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-800"
      style={{ width: size, height: size }}
    >
      {/* Même silhouette de pouls que l'icône de l'appli (petit pic, creux relié, grand pic),
          rejouée en barres plutôt qu'un trait — mais ici en couleur d'accent dynamique, puisque
          contrairement à l'icône .exe (figée), ce logo suit le thème choisi dans l'appli. */}
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" className="animate-pulse">
        <rect x="2"  y="12.1" width="2" height="1.8" rx="1" fill="var(--accent-primary)" />
        <rect x="5"  y="12.1" width="2" height="1.8" rx="1" fill="var(--accent-primary)" />
        <rect x="8"  y="8.9"  width="2" height="4.1" rx="1" fill="var(--accent-primary)" />
        <rect x="11" y="12.1" width="2" height="6.3" rx="1" fill="var(--accent-primary)" />
        <rect x="14" y="5.0"  width="2" height="8.0" rx="1" fill="var(--accent-primary)" />
        <rect x="17" y="12.1" width="2" height="1.8" rx="1" fill="var(--accent-primary)" />
        <rect x="20" y="12.1" width="2" height="1.8" rx="1" fill="var(--accent-primary)" />
      </svg>
    </div>
  )
}

export default Logo
