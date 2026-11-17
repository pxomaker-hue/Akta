import { useEffect, useMemo, useState } from 'react'

// Vrai quand la classe .dark est posée sur <html> (voir useTheme) ; suit les changements en direct.
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setIsDark(root.classList.contains('dark')))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

// Style commun des graphiques recharts (grille, axes, infobulle), adapté au thème clair/sombre.
// À étaler sur les composants : <CartesianGrid {...chart.grid} />, <XAxis {...chart.axis} />,
// <Tooltip {...chart.tooltip} />.
export function useChartTheme() {
  const isDark = useIsDark()
  return useMemo(() => {
    const text = isDark ? '#f1f5f9' : '#111827'
    const muted = isDark ? '#94a3b8' : '#6b7280'
    return {
      isDark,
      grid: { strokeDasharray: '3 3', stroke: isDark ? '#334155' : '#e5e7eb' },
      axis: { stroke: muted, tick: { fill: muted, fontSize: 12 }, style: { fontSize: '12px' } },
      tooltip: {
        contentStyle: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
          borderRadius: '0.75rem',
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          color: text,
        },
        labelStyle: { color: text, fontWeight: 600, marginBottom: '4px' },
        itemStyle: { color: text },
        cursor: { fill: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.15)' },
      },
      // Libellés dessinés directement sur le graphique (ex. parts d'un camembert)
      labelFill: text,
    }
  }, [isDark])
}
