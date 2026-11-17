// Formats de durée partagés (avant : une copie locale par composant, avec de petites variantes).

/** « 45m » ou « 2h 5m » ; showSeconds affiche « 42s » sous la minute. */
export function formatDuration(seconds: number, options: { showSeconds?: boolean } = {}): string {
  if (options.showSeconds && seconds < 60) return `${Math.floor(seconds)}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/** Chronomètre compact : « 12:07 » sous l'heure, « 1h 05m » au-delà. */
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Heures décimales à un chiffre : 5400 s → « 1.5 ». */
export function formatHoursDecimal(seconds: number): string {
  return (seconds / 3600).toFixed(1)
}
