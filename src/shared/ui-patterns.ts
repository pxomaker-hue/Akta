// Patterns UI réutilisables pour le redesign Horizon-inspired

export const UI_PATTERNS = {
  // Card patterns
  card: {
    base: 'rounded-xl border shadow-lg transition-all hover:shadow-xl',
    light: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    gradient: 'bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-800 dark:to-gray-900',
  },

  // Button patterns
  button: {
    primary: 'px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-medium hover:from-indigo-700 hover:to-cyan-700 transition-all disabled:opacity-50',
    secondary: 'px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors',
    danger: 'px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/40',
  },

  // Header patterns
  header: {
    title: 'text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent',
    subtitle: 'text-sm text-gray-600 dark:text-gray-400',
  },

  // Badge patterns
  badge: {
    base: 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
    primary: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  },

  // Grid patterns
  grid: {
    cols2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    cols3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
    cols4: 'grid grid-cols-2 md:grid-cols-4 gap-3',
  },
} as const

export const GRADIENT_BACKGROUNDS = [
  'from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20',
  'from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/20',
  'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20',
  'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20',
  'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20',
  'from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/20',
] as const
