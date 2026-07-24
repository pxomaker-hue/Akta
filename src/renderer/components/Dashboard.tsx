import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Activity, Category, WorkSession } from '../../shared/types'
import { computeDeepWorkSessions } from '../../shared/deepwork'
import { DESIGN } from '../../shared/design'
import CategoryIcon from './CategoryIcon'
import TimelineV2, { getTodayStart, formatDayLabel } from './TimelineV2'
import LiveSessionStat from './LiveSessionStat'
import { Card, CardHeader, CardGrid, Stat, Icon } from './UI'

const DAY_MS = 24 * 60 * 60 * 1000

interface DashboardProps {
  activities: Activity[]
  categories: Category[]
  onUpdate?: () => void
  onOpenFocusMode?: () => void
  isFocusActive?: boolean
}

function Dashboard({ activities, categories, onUpdate, onOpenFocusMode, isFocusActive = false }: DashboardProps) {
  // Jour affiché, partagé avec la Timeline (contrôlée par ce state) pour que les stats du dashboard
  // et le graphique restent toujours synchronisés sur la même journée.
  const [dayStart, setDayStart] = useState(() => getTodayStart())
  const [daySessions, setDaySessions] = useState<WorkSession[]>([])

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        // Fenêtre large : le jour sélectionné peut être bien plus ancien qu'"aujourd'hui"
        const data = await window.electron.ipc.invoke('get-sessions', 30)
        setDaySessions((data as WorkSession[]).filter((s) => s.start_time >= dayStart && s.start_time < dayStart + DAY_MS))
      } catch (error) {
        console.error('Error fetching sessions:', error)
      }
    }
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [dayStart])

  // Activités du jour actuellement affiché (et non de la fenêtre entière remontée par App.tsx) :
  // c'est ce qui garde les stats du dashboard cohérentes avec ce que montre la Timeline juste en dessous.
  const dayActivities = useMemo(
    () => activities.filter((a) => a.start_time >= dayStart && a.start_time < dayStart + DAY_MS),
    [activities, dayStart]
  )
  const isTodayOrYesterday = dayStart === getTodayStart() || dayStart === getTodayStart() - DAY_MS

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((cat) => map.set(cat.id, cat))
    return map
  }, [categories])

  const categoryStats = useMemo(() => {
    const stats = new Map<
      number,
      {
        id: number
        name: string
        color: string
        totalSeconds: number
        billable: boolean
        count: number
      }
    >()

    dayActivities.forEach((activity) => {
      if (activity.category_id) {
        const category = categoryMap.get(activity.category_id)
        if (!category) return

        const existing = stats.get(activity.category_id) || {
          id: activity.category_id,
          name: category.name,
          color: category.color,
          totalSeconds: 0,
          billable: category.billable_default,
          count: 0,
        }

        existing.totalSeconds += activity.duration_seconds
        existing.count += 1

        stats.set(activity.category_id, existing)
      }
    })

    return Array.from(stats.values()).sort((a, b) => b.totalSeconds - a.totalSeconds)
  }, [dayActivities, categoryMap])

  const projectStats = useMemo(() => {
    const stats = new Map<number, { id: number; name: string; color: string; totalSeconds: number }>()
    daySessions.forEach((session) => {
      if (!session.project_id || !session.project_name) return
      const seconds = session.duration_seconds || Math.floor((Date.now() - session.start_time) / 1000)
      const existing = stats.get(session.project_id) || {
        id: session.project_id,
        name: session.project_name,
        color: session.project_color || '#6366f1',
        totalSeconds: 0,
      }
      existing.totalSeconds += seconds
      stats.set(session.project_id, existing)
    })
    return Array.from(stats.values()).sort((a, b) => b.totalSeconds - a.totalSeconds)
  }, [daySessions])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  const totalSeconds = dayActivities.reduce((sum, a) => sum + a.duration_seconds, 0)
  const categorizedSeconds = categoryStats.reduce((sum, stat) => sum + stat.totalSeconds, 0)
  const billableSeconds = categoryStats.filter((s) => s.billable).reduce((sum, s) => sum + s.totalSeconds, 0)
  const deepWorkSessions = computeDeepWorkSessions(dayActivities, categoryMap)

  const barChartData = categoryStats.map((stat) => ({
    name: stat.name,
    hours: Math.round((stat.totalSeconds / 3600) * 10) / 10,
    color: stat.color,
  }))

  const billableStats = useMemo(() => {
    let billableSeconds = 0
    let personalSeconds = 0

    categoryStats.forEach((stat) => {
      if (stat.billable) billableSeconds += stat.totalSeconds
      else personalSeconds += stat.totalSeconds
    })

    return [
      { name: 'Facturable', value: Math.round(billableSeconds / 3600), color: DESIGN.colors.secondary },
      { name: 'Personnel', value: Math.round(personalSeconds / 3600), color: DESIGN.colors.primary },
    ]
  }, [categoryStats])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card gradient>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold accent-gradient-text">
                Ton tableau de bord
              </h2>
              {/* Rappelle sur quel jour portent les stats ci-dessous : sans ça, après avoir navigué
                  dans la Timeline, on peut croire à tort que les chiffres sont ceux d'aujourd'hui.
                  Même style que le titre (accent-gradient-text) : quasi la même taille sur
                  Aujourd'hui/Hier (le cas courant), un peu plus petit pour une date plus ancienne
                  (moins besoin d'insister visuellement dessus). */}
              <span className="text-gray-300 dark:text-slate-600 text-xl select-none" aria-hidden="true">•</span>
              <span className={`font-bold accent-gradient-text ${isTodayOrYesterday ? 'text-xl' : 'text-base'}`}>
                {formatDayLabel(dayStart)}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {formatTime(totalSeconds)} d'activité • {dayActivities.length} activités • {daySessions.length} session{daySessions.length !== 1 ? 's' : ''} active{daySessions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {onOpenFocusMode && (
            <button
              onClick={onOpenFocusMode}
              title={isFocusActive ? 'Session Mode Focus en cours' : 'Démarrer une session Mode Focus'}
              className="group flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <span className="relative w-16 h-16 flex items-center justify-center">
                {/* Onde lumineuse qui émane de l'icône, rythme battement de coeur, uniquement
                    quand une session est active (même depuis un autre onglet que Mode Focus) */}
                {isFocusActive && (
                  <span className="absolute inset-0 rounded-full accent-gradient-bg animate-focus-glow-ring" aria-hidden="true" />
                )}
                <span
                  className={`relative w-16 h-16 rounded-full accent-gradient-bg flex items-center justify-center text-white shadow-md group-hover:brightness-110 group-hover:scale-105 transition-all ${
                    isFocusActive ? 'animate-focus-heartbeat' : ''
                  }`}
                >
                  <Icon name="target" size={26} />
                </span>
              </span>
              <span className="text-xs font-medium text-gray-600 dark:text-slate-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Mode Focus
              </span>
            </button>
          )}
        </div>
      </Card>

      {/* Timeline - Flux du jour */}
      <TimelineV2 activities={activities} categories={categories} onUpdate={onUpdate} dayStart={dayStart} onDayChange={setDayStart} />

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat
          label="Temps total"
          value={formatTime(totalSeconds)}
          icon={<Icon name="clock" size={18} />}
          gradient="from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20"
        />
        <LiveSessionStat sessions={daySessions} />
        <Stat
          label="Catégorisé"
          value={`${Math.round((categorizedSeconds / totalSeconds) * 100)}%`}
          icon={<Icon name="chart-pie" size={18} />}
          gradient="from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/20"
        />
        <Stat
          label="Facturable"
          value={formatTime(billableSeconds)}
          icon={<Icon name="briefcase" size={18} />}
          gradient="from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20"
        />
        <Stat
          label="Deep Work"
          value={deepWorkSessions.length}
          icon={<Icon name="target" size={18} />}
          subtext="sessions"
          gradient="from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader title="Temps par catégorie" icon={<Icon name="chart-bar" size={18} />} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px'
                }}
                formatter={(value: number) => [
                  <span key="value" style={{ color: '#fff', fontWeight: '500' }}>{value}h</span>
                ]}
                labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}
                wrapperStyle={{ color: '#fff' }}
              />
              <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader title="Facturable vs Personnel" icon={<Icon name="chart-pie" size={18} />} />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={billableStats} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} ${value}h`} outerRadius={80} fill="#8884d8" dataKey="value">
                {billableStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${value}h`}
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px'
                }}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                wrapperStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top catégories */}
      {categoryStats.length > 0 && (
        <Card>
          <CardHeader title="Catégories les plus actives" icon={<Icon name="trophy" size={18} />} />
          <div className="space-y-3">
            {categoryStats.slice(0, 5).map((stat, idx) => (
              <div key={stat.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold accent-gradient-bg text-white flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stat.color }}
                      />
                      <p className="font-medium text-gray-900 dark:text-white truncate">{stat.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.count} activités</p>
                  </div>
                </div>
                <p className="text-right font-semibold text-gray-900 dark:text-white ml-4 flex-shrink-0">{formatTime(stat.totalSeconds)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Temps par projet */}
      {projectStats.length > 0 && (
        <Card>
          <CardHeader title="Temps par projet" icon={<Icon name="folder" size={18} />} />
          <div className="space-y-3">
            {projectStats.map((stat) => (
              <div key={stat.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
                  <p className="font-medium text-gray-900 dark:text-white truncate">{stat.name}</p>
                </div>
                <p className="text-right font-semibold text-gray-900 dark:text-white ml-4 flex-shrink-0">{formatTime(stat.totalSeconds)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default Dashboard
