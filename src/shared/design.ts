// Palette Akta - Moderne, vibrant, productif

export const DESIGN = {
  // Couleurs primaires
  colors: {
    primary: 'var(--accent-primary, #6366f1)',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',

    accent: '#f59e0b',       // Amber chaud
    accentLight: '#fbbf24',
    accentDark: '#d97706',

    secondary: 'var(--accent-secondary, #06b6d4)',
    secondaryLight: '#22d3ee',
    secondaryDark: '#0891b2',

    // Neutres
    dark: '#1e1b4b',
    light: '#f8fafc',
    gray: '#64748b',
    grayLight: '#e2e8f0',

    // Statuts
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
  },

  // Catégories avec couleurs + icônes
  categories: {
    développement: {
      color: '#6366f1',
      lightColor: '#e0e7ff',
      name: 'Développement',
      icon: 'code',
    },
    communication: {
      color: '#06b6d4',
      lightColor: '#cffafe',
      name: 'Communication',
      icon: 'chat',
    },
    'navigation web': {
      color: '#f59e0b',
      lightColor: '#fef3c7',
      name: 'Navigation web',
      icon: 'globe',
    },
    design: {
      color: '#d946ef',
      lightColor: '#f3e8ff',
      name: 'Design',
      icon: 'palette',
    },
    bureautique: {
      color: '#06b6d4',
      lightColor: '#cffafe',
      name: 'Bureautique',
      icon: 'document',
    },
    divertissement: {
      color: '#ec4899',
      lightColor: '#fce7f3',
      name: 'Divertissement',
      icon: 'gamepad',
    },
  },

  // Ombres
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(99, 102, 241, 0.3)',
  },

  // Animations
  transitions: {
    fast: '150ms ease-in-out',
    base: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },
} as const

export function getCategoryColor(categoryName: string): string {
  const name = categoryName.toLowerCase()
  const category = (DESIGN.categories as Record<string, any>)[name]
  return category?.color || DESIGN.colors.primary
}

export function getCategoryLightColor(categoryName: string): string {
  const name = categoryName.toLowerCase()
  const category = (DESIGN.categories as Record<string, any>)[name]
  return category?.lightColor || DESIGN.colors.primaryLight
}
