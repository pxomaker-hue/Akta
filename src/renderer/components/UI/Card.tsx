import React from 'react'

interface CardProps {
  children: React.ReactNode
  gradient?: boolean
  className?: string
}

export function Card({ children, gradient = true, className = '' }: CardProps) {
  const baseClass = 'rounded-2xl shadow-sm transition-shadow duration-200'
  const borderClass = 'border border-gray-200/70 dark:border-slate-700/70'
  const bgClass = gradient
    ? 'bg-gradient-to-br from-white via-white to-gray-50/90 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/60'
    : 'bg-white dark:bg-slate-900'

  return (
    <div className={`${baseClass} ${borderClass} ${bgClass} p-6 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className="accent-text flex items-center">{icon}</span>}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        {subtitle && <p className={`text-sm text-gray-600 dark:text-slate-400 mt-1.5 ${icon ? 'ml-7' : ''}`}>{subtitle}</p>}
      </div>
    </div>
  )
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
}
