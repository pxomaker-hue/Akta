interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  icon?: React.ReactNode
}

export function Badge({ children, variant = 'primary', icon }: BadgeProps) {
  const variants = {
    primary: 'bg-indigo-50/80 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50',
    success: 'bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50',
    warning: 'bg-amber-50/80 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50',
    danger: 'bg-red-50/80 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/50',
    neutral: 'bg-gray-100/80 dark:bg-gray-700/30 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-600/50',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${variants[variant]}`}>
      {icon}
      {children}
    </span>
  )
}
