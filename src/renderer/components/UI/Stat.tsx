interface StatProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  gradient?: string
  subtext?: string
}

export function Stat({ label, value, icon, gradient = 'from-indigo-50/80 to-indigo-100/60 dark:from-indigo-900/20 dark:to-indigo-800/10', subtext }: StatProps) {
  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br ${gradient} border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {subtext && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{subtext}</p>}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 accent-text bg-white/60 dark:bg-white/5">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
