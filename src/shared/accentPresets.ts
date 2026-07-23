export interface AccentPreset {
  id: string
  name: string
  primary: string
  secondary: string
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'indigo-cyan', name: 'Indigo & Cyan', primary: '#6366f1', secondary: '#06b6d4' },
  { id: 'violet-pink', name: 'Violet & Rose', primary: '#8b5cf6', secondary: '#ec4899' },
  { id: 'emerald-teal', name: 'Émeraude & Sarcelle', primary: '#10b981', secondary: '#14b8a6' },
  { id: 'rose-orange', name: 'Rose & Orange', primary: '#f43f5e', secondary: '#f97316' },
  { id: 'blue-sky', name: 'Bleu & Ciel', primary: '#3b82f6', secondary: '#0ea5e9' },
  { id: 'amber-red', name: 'Ambre & Rouge', primary: '#f59e0b', secondary: '#ef4444' },
]

export const DEFAULT_ACCENT_ID = 'indigo-cyan'

export function getAccentPreset(id: string | null | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) || ACCENT_PRESETS[0]
}
