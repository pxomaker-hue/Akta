import { getDatabase } from './database'

interface ProductivityMetrics {
  score: number
  dailyAverage: number
  focusTime: number
  distractionTime: number
  deepWorkSessions: number
}

interface OptimalTime {
  hour: number
  day: string
  activities: number
  totalDuration: number
}

interface MonthComparison {
  month: string
  totalActivities: number
  totalDuration: number
  focusedTime: number
  productivity: number
}

interface WeekTrend {
  week: number
  date: string
  productivity: number
  activities: number
  focusTime: number
}

export function getProductivityScore(limitDays: number = 7): ProductivityMetrics {
  const db = getDatabase()
  const now = Date.now()
  const startTime = now - limitDays * 24 * 60 * 60 * 1000

  // Total activities et durée
  const activitiesStmt = db.prepare(`
    SELECT COUNT(*) as count, SUM(duration_seconds) as total_duration
    FROM activities
    WHERE start_time >= ?
  `)
  const activitiesData = activitiesStmt.get(startTime) as any

  // Deep work sessions (> 30 min consecutive in same category)
  const deepWorkStmt = db.prepare(`
    SELECT COUNT(DISTINCT DATE(start_time / 1000, 'unixepoch')) as deep_work_sessions
    FROM activities
    WHERE start_time >= ? AND duration_seconds >= 1800 AND category_id IS NOT NULL
  `)
  const deepWorkData = deepWorkStmt.get(startTime) as any

  // Focused time (activities with category)
  const focusedStmt = db.prepare(`
    SELECT SUM(duration_seconds) as focused_time
    FROM activities
    WHERE start_time >= ? AND category_id IS NOT NULL
  `)
  const focusedData = focusedStmt.get(startTime) as any

  // Distraction time (without category)
  const distractionStmt = db.prepare(`
    SELECT SUM(duration_seconds) as distraction_time
    FROM activities
    WHERE start_time >= ? AND category_id IS NULL
  `)
  const distractionData = distractionStmt.get(startTime) as any

  const totalDuration = activitiesData.total_duration || 0
  const focusedTime = focusedData.focused_time || 0
  const distractionTime = distractionData.distraction_time || 0

  // Productivity score: (focused / total) * 100
  const score = totalDuration > 0 ? Math.round((focusedTime / totalDuration) * 100) : 0
  const dailyAverage = Math.round(totalDuration / limitDays / 3600)

  return {
    score,
    dailyAverage,
    focusTime: Math.round(focusedTime / 3600),
    distractionTime: Math.round(distractionTime / 3600),
    deepWorkSessions: deepWorkData.deep_work_sessions || 0,
  }
}

export function getOptimalTimes(): OptimalTime[] {
  const db = getDatabase()
  const now = Date.now()
  const startTime = now - 30 * 24 * 60 * 60 * 1000 // Last 30 days

  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time / 1000, 'unixepoch') AS INTEGER) as hour,
      CASE strftime('%w', start_time / 1000, 'unixepoch')
        WHEN '0' THEN 'Dimanche'
        WHEN '1' THEN 'Lundi'
        WHEN '2' THEN 'Mardi'
        WHEN '3' THEN 'Mercredi'
        WHEN '4' THEN 'Jeudi'
        WHEN '5' THEN 'Vendredi'
        WHEN '6' THEN 'Samedi'
      END as day,
      COUNT(*) as activities,
      SUM(duration_seconds) as total_duration
    FROM activities
    WHERE start_time >= ?
    GROUP BY hour, day
    ORDER BY total_duration DESC
    LIMIT 20
  `)

  const results = stmt.all(startTime) as any[]
  return results.map((r) => ({
    hour: r.hour,
    day: r.day,
    activities: r.activities,
    totalDuration: r.total_duration,
  }))
}

export function getMonthComparison(): MonthComparison[] {
  const db = getDatabase()
  const now = new Date()

  const results: MonthComparison[] = []

  // Last 4 months
  for (let i = 3; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1)

    const startTime = date.getTime()
    const endTime = nextDate.getTime()

    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_activities,
        SUM(duration_seconds) as total_duration,
        SUM(CASE WHEN category_id IS NOT NULL THEN duration_seconds ELSE 0 END) as focused_time
      FROM activities
      WHERE start_time >= ? AND start_time < ?
    `)

    const data = stmt.get(startTime, endTime) as any
    const totalDuration = data.total_duration || 0
    const focusedTime = data.focused_time || 0
    const productivity = totalDuration > 0 ? Math.round((focusedTime / totalDuration) * 100) : 0

    results.push({
      month: date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
      totalActivities: data.total_activities || 0,
      totalDuration: Math.round(totalDuration / 3600),
      focusedTime: Math.round(focusedTime / 3600),
      productivity,
    })
  }

  return results
}

export function getWeekTrends(): WeekTrend[] {
  const db = getDatabase()
  const now = new Date()
  const results: WeekTrend[] = []

  // Last 4 weeks
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - i * 7)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const startTime = weekStart.getTime()
    const endTime = weekEnd.getTime()

    const stmt = db.prepare(`
      SELECT
        COUNT(*) as activities,
        SUM(duration_seconds) as total_duration,
        SUM(CASE WHEN category_id IS NOT NULL THEN duration_seconds ELSE 0 END) as focused_time
      FROM activities
      WHERE start_time >= ? AND start_time < ?
    `)

    const data = stmt.get(startTime, endTime) as any
    const totalDuration = data.total_duration || 0
    const focusedTime = data.focused_time || 0
    const productivity = totalDuration > 0 ? Math.round((focusedTime / totalDuration) * 100) : 0

    results.push({
      week: i,
      date: weekStart.toLocaleDateString('fr-FR'),
      productivity,
      activities: data.activities || 0,
      focusTime: Math.round(focusedTime / 3600),
    })
  }

  return results.reverse()
}
