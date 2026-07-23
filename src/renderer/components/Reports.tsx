import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { Activity, Category } from '../../shared/types'
import { computeDeepWorkSessions } from '../../shared/deepwork'
import CategoryIcon from './CategoryIcon'
import { Card, CardHeader, Stat, Icon } from './UI'
import { downloadBase64File, downloadTextFile } from '../utils/download'

interface ReportsProps {
  categories: Category[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

interface ProjectBreakdown {
  project_id: number
  name: string
  color: string
  hourly_rate: number | null
  seconds: number
}

function Reports({ categories }: ReportsProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [dayRefresh, setDayRefresh] = useState(0)
  const [projectBreakdown, setProjectBreakdown] = useState<ProjectBreakdown[]>([])
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    load()
  }, [])

  // Recalculate at midnight to refresh daily reports
  useEffect(() => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const timeUntilMidnight = tomorrow.getTime() - now.getTime()

    const timeout = setTimeout(() => {
      setDayRefresh(prev => prev + 1)
    }, timeUntilMidnight)

    return () => clearTimeout(timeout)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await window.electron.ipc.invoke('get-activities', 14)
      setActivities(data)
    } finally {
      setLoading(false)
    }
  }

  function getExportMonthRange(): [number, number] {
    const [y, m] = exportMonth.split('-').map(Number)
    return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()]
  }

  async function exportMonthCsv() {
    try {
      const [start, end] = getExportMonthRange()
      const csv = await window.electron.ipc.invoke('export-monthly-csv', start, end)
      downloadTextFile(csv, `akta-rapport-${exportMonth}.csv`, 'text/csv')
    } catch (error) {
      console.error('Error exporting monthly CSV:', error)
    }
  }

  async function exportMonthPdf() {
    try {
      const [start, end] = getExportMonthRange()
      const base64 = await window.electron.ipc.invoke('export-monthly-pdf', start, end)
      downloadBase64File(base64, `akta-rapport-${exportMonth}.pdf`, 'application/pdf')
    } catch (error) {
      console.error('Error exporting monthly PDF:', error)
    }
  }

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((c) => map.set(c.id, c))
    return map
  }, [categories])

  const todayStart = useMemo(() => startOfDay(Date.now()), [dayRefresh])
  const weekStart = todayStart - 6 * DAY_MS
  const prevWeekStart = weekStart - 7 * DAY_MS
  const prevWeekEnd = weekStart

  useEffect(() => {
    window.electron.ipc
      .invoke('get-project-time-breakdown', weekStart, todayStart + DAY_MS)
      .then((data: ProjectBreakdown[]) => setProjectBreakdown(data))
      .catch((error: unknown) => {
        console.error('Error loading project time breakdown:', error)
        setProjectBreakdown([])
      })
  }, [weekStart, todayStart])

  const thisWeek = useMemo(() => activities.filter((a) => a.start_time >= weekStart), [activities, weekStart])
  const lastWeek = useMemo(
    () => activities.filter((a) => a.start_time >= prevWeekStart && a.start_time < prevWeekEnd),
    [activities, prevWeekStart, prevWeekEnd]
  )

  const sumTotal = (list: Activity[]) => list.reduce((s, a) => s + a.duration_seconds, 0)
  const sumBillable = (list: Activity[]) =>
    list.reduce((s, a) => {
      if (a.category_id && categoryMap.get(a.category_id)?.billable_default) return s + a.duration_seconds
      return s
    }, 0)
  const sumDeepWork = (list: Activity[]) => computeDeepWorkSessions(list).reduce((s, sess) => s + sess.duration_seconds, 0)

  const totalThisWeek = sumTotal(thisWeek)
  const totalLastWeek = sumTotal(lastWeek)
  const billableThisWeek = sumBillable(thisWeek)
  const deepWorkThisWeek = sumDeepWork(thisWeek)
  const deepWorkLastWeek = sumDeepWork(lastWeek)

  const trendPct = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const dailyData = useMemo(() => {
    const days: { label: string; hours: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dayStartMs = todayStart - i * DAY_MS
      const dayEndMs = dayStartMs + DAY_MS
      const dayActivities = activities.filter((a) => a.start_time >= dayStartMs && a.start_time < dayEndMs)
      const totalSeconds = sumTotal(dayActivities)
      const label = new Date(dayStartMs).toLocaleDateString('fr-FR', { weekday: 'short' })
      days.push({ label, hours: Math.round((totalSeconds / 3600) * 10) / 10 })
    }
    return days
  }, [activities, todayStart])

  const topCategories = useMemo(() => {
    const stats = new Map<number, { name: string; color: string; seconds: number }>()
    thisWeek.forEach((a) => {
      if (!a.category_id) return
      const cat = categoryMap.get(a.category_id)
      if (!cat) return
      const existing = stats.get(a.category_id) || { name: cat.name, color: cat.color, seconds: 0 }
      existing.seconds += a.duration_seconds
      stats.set(a.category_id, existing)
    })
    return Array.from(stats.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5)
  }, [thisWeek, categoryMap])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const timeTrend = trendPct(totalThisWeek, totalLastWeek)
  const deepWorkTrend = trendPct(deepWorkThisWeek, deepWorkLastWeek)

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          label="Temps cette semaine"
          value={formatTime(totalThisWeek)}
          icon={<Icon name="chart-bar" size={18} />}
          gradient="from-indigo-50/80 to-indigo-100/60 dark:from-indigo-900/20 dark:to-indigo-800/10"
          subtext={`${timeTrend >= 0 ? '▲' : '▼'} ${Math.abs(timeTrend)}% vs semaine dernière`}
        />
        <Stat
          label="Deep Work"
          value={formatTime(deepWorkThisWeek)}
          icon={<Icon name="target" size={18} />}
          gradient="from-rose-50/80 to-rose-100/60 dark:from-rose-900/20 dark:to-rose-800/10"
          subtext={`${deepWorkTrend >= 0 ? '▲' : '▼'} ${Math.abs(deepWorkTrend)}% vs semaine dernière`}
        />
        <Stat
          label="Temps facturable"
          value={formatTime(billableThisWeek)}
          icon={<Icon name="briefcase" size={18} />}
          gradient="from-cyan-50/80 to-cyan-100/60 dark:from-cyan-900/20 dark:to-cyan-800/10"
          subtext={`${totalThisWeek > 0 ? Math.round((billableThisWeek / totalThisWeek) * 100) : 0}% du temps`}
        />
      </div>

      {/* Répartition hebdomadaire */}
      <Card>
        <CardHeader title="Répartition des 7 derniers jours" icon={<Icon name="chart-line" size={18} />} />
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} label={{ value: 'Heures', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid #475569',
                borderRadius: '0.75rem',
                color: '#f1f5f9',
              }}
              formatter={(value) => `${value}h`}
            />
            <Bar dataKey="hours" fill="var(--accent-primary)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Top catégories */}
      {topCategories.length > 0 && (
        <Card>
          <CardHeader title="Top catégories de la semaine" icon={<Icon name="trophy" size={18} />} />
          <div className="space-y-3">
            {topCategories.map((cat, idx) => (
              <div key={cat.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                  <CategoryIcon categoryName={cat.name} size={16} color={cat.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{cat.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">#{idx + 1} catégorie</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatTime(cat.seconds)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top projets */}
      {projectBreakdown.length > 0 && (
        <Card>
          <CardHeader title="Temps par projet cette semaine" icon={<Icon name="folder" size={18} />} />
          <div className="space-y-3">
            {projectBreakdown.slice(0, 5).map((proj) => {
              const share = projectBreakdown[0].seconds > 0 ? (proj.seconds / projectBreakdown[0].seconds) * 100 : 0
              const amount = proj.hourly_rate ? ((proj.seconds / 3600) * proj.hourly_rate).toFixed(2) : null
              return (
                <div key={proj.project_id} className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{proj.name}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white flex-shrink-0">
                      {formatTime(proj.seconds)}
                      {amount && <span className="text-gray-400 dark:text-slate-500 font-normal"> · {amount} €</span>}
                    </p>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, backgroundColor: proj.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {thisWeek.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Pas encore assez de données pour générer un rapport.</p>
          </div>
        </Card>
      )}

      {/* Export comptable mensuel */}
      <Card>
        <CardHeader title="Export mensuel" icon={<Icon name="download" size={18} />} subtitle="Toutes sessions, tous projets confondus" />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <button
            onClick={exportMonthCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white font-medium hover:brightness-95 dark:hover:brightness-110 transition-all"
          >
            <Icon name="download" size={14} /> CSV
          </button>
          <button
            onClick={exportMonthPdf}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg accent-gradient-bg text-white font-medium hover:brightness-110 transition-all"
          >
            <Icon name="download" size={14} /> PDF
          </button>
        </div>
      </Card>
    </div>
  )
}

export default Reports
