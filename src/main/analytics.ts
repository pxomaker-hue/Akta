import { getDatabase } from './database'
import { computeDeepWorkSessions } from '../shared/deepwork'
import type { Activity } from '../shared/types'

interface ProductivityMetrics {
  score: number
  dailyAverage: number
  focusTime: number
  distractionTime: number
  uncategorizedTime: number
  deepWorkSessions: number
}

interface OptimalTime {
  hour: number
  dayOfWeek: number
  activities: number
  distinctDays: number
  totalDuration: number
  avgDuration: number
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

  // Focus = catégorisé ET pas une catégorie "distraction" (avoir une catégorie ne suffit pas —
  // regarder des vidéos catégorisées "Divertissement" n'est pas du temps productif).
  const focusedStmt = db.prepare(`
    SELECT SUM(duration_seconds) as focused_time
    FROM activities
    WHERE start_time >= ? AND category_id IS NOT NULL
      AND category_id NOT IN (SELECT id FROM categories WHERE is_distraction = 1)
  `)
  const focusedData = focusedStmt.get(startTime) as any

  // Distraction = catégorisé ET catégorie marquée "distraction" (pas "sans catégorie", qui est
  // simplement du temps non classé, ni productif ni distrayant par défaut).
  const distractionStmt = db.prepare(`
    SELECT SUM(duration_seconds) as distraction_time
    FROM activities
    WHERE start_time >= ? AND category_id IN (SELECT id FROM categories WHERE is_distraction = 1)
  `)
  const distractionData = distractionStmt.get(startTime) as any

  const uncategorizedStmt = db.prepare(`
    SELECT SUM(duration_seconds) as uncategorized_time
    FROM activities
    WHERE start_time >= ? AND category_id IS NULL
  `)
  const uncategorizedData = uncategorizedStmt.get(startTime) as any

  const totalDuration = activitiesData.total_duration || 0
  const focusedTime = focusedData.focused_time || 0
  const distractionTime = distractionData.distraction_time || 0
  const uncategorizedTime = uncategorizedData.uncategorized_time || 0

  // Productivity score: (focused / total) * 100
  const score = totalDuration > 0 ? Math.round((focusedTime / totalDuration) * 100) : 0
  const dailyAverage = Math.round(totalDuration / limitDays / 3600)

  // Même définition du deep work que Reports.tsx (blocs continus d'une même catégorie ≥ 15 min,
  // tolérance 3 min) — auparavant ce chiffre comptait le nombre de JOURS distincts ayant eu une
  // seule activité ≥ 30 min, ce qui n'a rien à voir avec une "session" et ne correspondait à aucune
  // autre définition du deep work utilisée ailleurs dans l'app.
  const rawActivities = db.prepare(`SELECT * FROM activities WHERE start_time >= ?`).all(startTime) as Activity[]
  const deepWorkSessions = computeDeepWorkSessions(rawActivities).length

  return {
    score,
    dailyAverage,
    focusTime: Math.round(focusedTime / 3600),
    distractionTime: Math.round(distractionTime / 3600),
    uncategorizedTime: Math.round(uncategorizedTime / 3600),
    deepWorkSessions,
  }
}

export function getOptimalTimes(): OptimalTime[] {
  const db = getDatabase()
  const now = Date.now()
  const startTime = now - 30 * 24 * 60 * 60 * 1000 // Last 30 days

  const stmt = db.prepare(`
    SELECT
      CAST(strftime('%H', start_time / 1000, 'unixepoch') AS INTEGER) as hour,
      CAST(strftime('%w', start_time / 1000, 'unixepoch') AS INTEGER) as dayOfWeek,
      COUNT(*) as activities,
      COUNT(DISTINCT DATE(start_time / 1000, 'unixepoch')) as distinct_days,
      SUM(duration_seconds) as total_duration,
      AVG(duration_seconds) as avg_duration
    FROM activities
    WHERE start_time >= ?
    GROUP BY hour, dayOfWeek
    ORDER BY avg_duration DESC
  `)

  const rows = stmt.all(startTime) as any[]

  // Un classement par durée totale brute favorisait un unique bloc marathon isolé plutôt qu'un
  // vrai motif récurrent. On privilégie les créneaux vus sur au moins 2 jours différents (signal
  // de récurrence), avec repli sur l'ensemble si l'historique est encore trop court pour ça.
  const recurring = rows.filter((r) => r.distinct_days >= 2)
  const pool = recurring.length > 0 ? recurring : rows

  // Le nom du jour n'est pas résolu ici (SQLite n'a pas la langue de l'utilisateur) : le renderer
  // traduit dayOfWeek (0=dimanche..6=samedi, convention strftime('%w')) via son propre i18n.
  return pool.slice(0, 20).map((r) => ({
    hour: r.hour,
    dayOfWeek: r.dayOfWeek,
    activities: r.activities,
    distinctDays: r.distinct_days,
    totalDuration: r.total_duration,
    avgDuration: Math.round(r.avg_duration),
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
        SUM(CASE WHEN category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories WHERE is_distraction = 1) THEN duration_seconds ELSE 0 END) as focused_time
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
        SUM(CASE WHEN category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories WHERE is_distraction = 1) THEN duration_seconds ELSE 0 END) as focused_time
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
