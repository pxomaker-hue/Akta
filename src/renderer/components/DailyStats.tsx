import { useMemo } from 'react'
import type { Activity, Category } from '../../shared/types'
import { Card, CardHeader, Icon } from './UI'

interface DailyStatsProps {
  activities: Activity[]
  categories: Category[]
}

function DailyStats({ activities, categories }: DailyStatsProps) {
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((cat) => map.set(cat.id, cat))
    return map
  }, [categories])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const categoryStats = useMemo(() => {
    const stats = new Map<number, { name: string; color: string; duration: number }>()
    activities.forEach((activity) => {
      if (activity.category_id) {
        const cat = categoryMap.get(activity.category_id)
        if (!cat) return
        const existing = stats.get(activity.category_id) || { name: cat.name, color: cat.color, duration: 0 }
        existing.duration += activity.duration_seconds
        stats.set(activity.category_id, existing)
      }
    })
    return Array.from(stats.values()).sort((a, b) => b.duration - a.duration)
  }, [activities, categoryMap])

  const appStats = useMemo(() => {
    const stats = new Map<string, { name: string; duration: number }>()
    activities.forEach((activity) => {
      const existing = stats.get(activity.app_name) || { name: activity.app_name, duration: 0 }
      existing.duration += activity.duration_seconds
      stats.set(activity.app_name, existing)
    })
    return Array.from(stats.values())
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8)
  }, [activities])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Par Catégorie */}
      <Card>
        <CardHeader title="Temps par catégorie" icon={<Icon name="chart-pie" size={18} />} />
        {categoryStats.length > 0 ? (
          <div className="space-y-2">
            {categoryStats.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
                  <span className="text-sm text-gray-700 dark:text-slate-300">{stat.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatTime(stat.duration)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">Aucune activité catégorisée ce jour-là</p>
        )}
      </Card>

      {/* Par Application */}
      <Card>
        <CardHeader title="Applications utilisées" icon={<Icon name="laptop" size={18} />} />
        {appStats.length > 0 ? (
          <div className="space-y-2">
            {appStats.map((stat) => (
              <div key={stat.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{stat.name}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white ml-2">{formatTime(stat.duration)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">Aucune activité enregistrée ce jour-là</p>
        )}
      </Card>
    </div>
  )
}

export default DailyStats
