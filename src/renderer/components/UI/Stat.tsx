interface StatProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  gradient?: string
  subtext?: string
}

export function Stat({ label, value, icon, gradient = 'from-gray-50/80 to-white dark:from-slate-900 dark:to-slate-800/50', subtext }: StatProps) {
  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br ${gradient} border border-gray-200/70 dark:border-slate-700/70 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white mt-2 tabular-nums tracking-tight">{value}</p>
          {subtext && <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">{subtext}</p>}
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
