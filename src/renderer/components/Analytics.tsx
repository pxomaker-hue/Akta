import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, Stat, Icon } from './UI'

interface ProductivityMetrics {
  score: number
  dailyAverage: number
  focusTime: number
  distractionTime: number
  deepWorkSessions: number
}

interface MonthData {
  month: string
  totalActivities: number
  totalDuration: number
  focusedTime: number
  productivity: number
}

interface WeekData {
  week: number
  date: string
  productivity: number
  activities: number
  focusTime: number
}

interface OptimalTime {
  hour: number
  day: string
  activities: number
  totalDuration: number
}

function Analytics() {
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null)
  const [monthData, setMonthData] = useState<MonthData[]>([])
  const [weekData, setWeekData] = useState<WeekData[]>([])
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      const [metricsData, monthData, weekData, optimalData] = await Promise.all([
        window.electron.ipc.invoke('get-productivity-score', 7),
        window.electron.ipc.invoke('get-month-comparison'),
        window.electron.ipc.invoke('get-week-trends'),
        window.electron.ipc.invoke('get-optimal-times'),
      ])

      setMetrics(metricsData)
      setMonthData(monthData)
      setWeekData(weekData)
      setOptimalTimes(optimalData)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
  }

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-50/80 to-emerald-100/60 dark:from-emerald-900/20 dark:to-emerald-800/10'
    if (score >= 60) return 'from-amber-50/80 to-amber-100/60 dark:from-amber-900/20 dark:to-amber-800/10'
    return 'from-red-50/80 to-red-100/60 dark:from-red-900/20 dark:to-red-800/10'
  }

  return (
    <div className="space-y-8">
      {/* Séparateur de section */}
      <div className="flex items-center gap-3">
        <Icon name="brain" size={18} className="accent-text flex-shrink-0" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Analyses approfondies</h3>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>

      {/* Metrics principales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat
          label="Score global"
          value={`${metrics.score}%`}
          icon={<Icon name="target" size={18} />}
          gradient={getScoreGradient(metrics.score)}
        />
        <Stat
          label="Moyenne/jour"
          value={`${metrics.dailyAverage}h`}
          icon={<Icon name="calendar" size={18} />}
          gradient="from-indigo-50/80 to-indigo-100/60 dark:from-indigo-900/20 dark:to-indigo-800/10"
        />
        <Stat
          label="Focus"
          value={`${metrics.focusTime}h`}
          icon={<Icon name="brain" size={18} />}
          gradient="from-cyan-50/80 to-cyan-100/60 dark:from-cyan-900/20 dark:to-cyan-800/10"
        />
        <Stat
          label="Distraction"
          value={`${metrics.distractionTime}h`}
          icon={<Icon name="alert" size={18} />}
          gradient="from-amber-50/80 to-amber-100/60 dark:from-amber-900/20 dark:to-amber-800/10"
        />
        <Stat
          label="Deep Work"
          value={metrics.deepWorkSessions}
          icon={<Icon name="flame" size={18} />}
          subtext="sessions"
          gradient="from-rose-50/80 to-rose-100/60 dark:from-rose-900/20 dark:to-rose-800/10"
        />
      </div>

      {/* Tendances 4 semaines */}
      {weekData.length > 0 && (
        <Card>
          <CardHeader title="Tendances hebdomadaires" icon={<Icon name="chart-line" size={18} />} />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weekData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid #475569',
                  borderRadius: '0.75rem',
                  color: '#f1f5f9',
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '12px' }} />
              <Line type="monotone" dataKey="productivity" stroke="#6366f1" strokeWidth={2} name="Productivité %" dot={false} />
              <Line type="monotone" dataKey="focusTime" stroke="#06b6d4" strokeWidth={2} name="Focus (h)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Comparaison mensuelle */}
      {monthData.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Analyse mensuelle" icon={<Icon name="calendar" size={18} />} />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #475569',
                    borderRadius: '0.75rem',
                    color: '#f1f5f9',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '12px' }} />
                <Bar dataKey="totalDuration" fill="#6366f1" name="Durée (h)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="focusedTime" fill="#06b6d4" name="Focus (h)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tableau détaillé */}
          <Card>
            <CardHeader title="Détails mensuels" icon={<Icon name="chart-bar" size={18} />} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Mois</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Activités</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Durée (h)</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Focus (h)</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Productivité</th>
                  </tr>
                </thead>
                <tbody>
                  {monthData.map((month, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{month.month}</td>
                      <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">{month.totalActivities}</td>
                      <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">{month.totalDuration}</td>
                      <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">{month.focusedTime}</td>
                      <td className="text-right py-3 px-4">
                        <span
                          className="inline-block px-3 py-1 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: getScoreColor(month.productivity) }}
                        >
                          {month.productivity}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Heures optimales */}
      {optimalTimes.length > 0 && (
        <Card>
          <CardHeader title="Heures optimales" icon={<Icon name="clock" size={18} />} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optimalTimes.slice(0, 10).map((time, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {String(time.hour).padStart(2, '0')}:00 • {time.day}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{time.activities} activités</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold accent-text">
                      {Math.round(time.totalDuration / 3600)}h
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full accent-gradient-bg rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((time.totalDuration / 36000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default Analytics
