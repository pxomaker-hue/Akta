import { Notification } from 'electron'
import path from 'path'
import { getDatabase } from './database'
import { mt, mtf } from './i18n'

const ICON_PATH = path.join(__dirname, '../../../assets/icon.png')

const SWITCH_WINDOW_MS = 5 * 60 * 1000
const SWITCH_THRESHOLD = 8
const NUDGE_COOLDOWN_MS = 20 * 60 * 1000

// TDAH-optimized defaults
const TDAH_OPTIMAL_CYCLE = 18 * 60 * 1000 // 18 minutes (shorter than Pomodoro for TDAH)
const TDAH_BREAK = 4 * 60 * 1000 // 4 minutes break
const DEEP_WORK_MIN_MINUTES = 15 // minimum continuous focus to count as deep work

let switchTimestamps: number[] = []
let lastDistractionNudge = 0

export function recordSwitch() {
  const now = Date.now()
  switchTimestamps.push(now)
  switchTimestamps = switchTimestamps.filter((t) => now - t <= SWITCH_WINDOW_MS)
}

export function maybeNudgeDistraction() {
  const now = Date.now()
  if (switchTimestamps.length < SWITCH_THRESHOLD) return
  if (now - lastDistractionNudge < NUDGE_COOLDOWN_MS) return

  lastDistractionNudge = now
  if (Notification.isSupported()) {
    new Notification({
      title: mt('coach', 'scatteredTitle'),
      body: mtf('coach', 'scatteredAppSwitchBody', { count: switchTimestamps.length }),
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyDeepWorkMilestone(minutes: number, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : encourageant et gamifié
    const messageKeys = ['deepWorkMsg1', 'deepWorkMsg2', 'deepWorkMsg3', 'deepWorkMsg4']
    const key = messageKeys[Math.floor(Math.random() * messageKeys.length)]
    new Notification({
      title: mt('coach', 'streakTitle'),
      body: mtf('coach', key, { minutes }),
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : discret
    new Notification({
      title: mt('coach', 'genericTitle'),
      body: mtf('coach', 'focusMinutesBody', { minutes }),
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyMilestoneUnlocked(milestoneName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée
    new Notification({
      title: mt('coach', 'milestoneUnlockedTdahTitle'),
      body: mtf('coach', 'milestoneUnlockedTdahBody', { name: milestoneName }),
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : notification simple
    new Notification({
      title: mt('coach', 'milestoneUnlockedStandardTitle'),
      body: milestoneName,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyChallengeCompleted(challengeName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée avec récompense
    const bodyKeys = ['challengeCompletedTdahBody1', 'challengeCompletedTdahBody2', 'challengeCompletedTdahBody3']
    const key = bodyKeys[Math.floor(Math.random() * bodyKeys.length)]
    new Notification({
      title: mt('coach', 'challengeCompletedTdahTitle'),
      body: mtf('coach', key, { name: challengeName }),
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : notification simple
    new Notification({
      title: mt('coach', 'challengeCompletedStandardTitle'),
      body: challengeName,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyDistractionDuringSession(appName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : ludique et motivant
    const messageKeys = ['distraction1', 'distraction2', 'distraction3']
    const key = messageKeys[Math.floor(Math.random() * messageKeys.length)]
    new Notification({
      title: mt('coach', 'driftingTitle'),
      body: mtf('coach', key, { app: appName }),
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : discret
    new Notification({
      title: mt('coach', 'genericTitle'),
      body: mtf('coach', 'onAppBody', { app: appName }),
      icon: ICON_PATH,
    }).show()
  }
}

export function notifySessionCompleted(duration: number, streakDays: number, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée
    const minutes = Math.round(duration / 60)
    const bodyKeys = ['sessionDone1', 'sessionDone2', 'sessionDone3']
    const key = bodyKeys[Math.floor(Math.random() * bodyKeys.length)]
    new Notification({
      title: mt('coach', 'focusSessionCompletedTdahTitle'),
      body: mtf('coach', key, { minutes, days: streakDays }),
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : simple
    new Notification({
      title: mt('coach', 'focusSessionCompletedStandardTitle'),
      body: mtf('coach', 'focusSessionCompletedStandardBody', { minutes: Math.round(duration / 60) }),
      icon: ICON_PATH,
    }).show()
  }
}

export interface FocusAnalysis {
  deepWorkScore: number // 0-100: continuité du focus
  focusQuality: 'excellent' | 'good' | 'fair' | 'poor'
  streakDays: number
  totalDeepWorkMinutes: number
  completionRate: number // % de sessions terminées
  averageSessionDuration: number // in seconds
  sessionsToday: number // nombre de sessions aujourd'hui
  billableMinutesToday: number // minutes facturables aujourd'hui
  personalMinutesToday: number // minutes personnelles aujourd'hui
}

export interface ProductivityPattern {
  bestHours: number[] // 0-23: heures les plus productives
  worstHours: number[]
  peakHour: number | null
  consistency: number // 0-100: régularité des sessions
}

export interface CoachingRecommendation {
  type: 'cycle' | 'break' | 'timing' | 'streak' | 'practice'
  priority: 'high' | 'medium' | 'low'
  message: string
  action?: string
}

export function analyzeFocusQuality(sessions: any[]): FocusAnalysis {
  if (sessions.length === 0) {
    return {
      deepWorkScore: 0,
      focusQuality: 'poor',
      streakDays: 0,
      totalDeepWorkMinutes: 0,
      completionRate: 0,
      averageSessionDuration: 0,
      sessionsToday: 0,
      billableMinutesToday: 0,
      personalMinutesToday: 0,
    }
  }

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  // Filter to last 7 days
  const recentSessions = sessions.filter((s) => s.start_time >= sevenDaysAgo)

  // Calculate completion rate
  const completed = recentSessions.filter((s) => s.completed).length
  const completionRate = recentSessions.length > 0 ? (completed / recentSessions.length) * 100 : 0

  // Calculate average session duration
  const avgDuration =
    recentSessions.reduce((sum: number, s: any) => {
      const duration = (s.end_time ? s.end_time - s.start_time : s.planned_duration * 1000) / 1000
      return sum + duration
    }, 0) / (recentSessions.length || 1)

  // Calculate deep work minutes (continuous focus > 15 min)
  const deepWorkMinutes = recentSessions.reduce((sum: number, s: any) => {
    const duration = (s.end_time ? s.end_time - s.start_time : s.planned_duration * 1000) / 1000 / 60
    return sum + (duration >= DEEP_WORK_MIN_MINUTES ? duration : 0)
  }, 0)

  // Calculate deep work score (based on completion, consistency, and duration)
  let deepWorkScore = completionRate * 0.4 + Math.min(100, (deepWorkMinutes / 120) * 100) * 0.4 + Math.min(100, (recentSessions.length / 7) * 100) * 0.2

  const focusQuality =
    deepWorkScore >= 80 ? 'excellent' : deepWorkScore >= 60 ? 'good' : deepWorkScore >= 40 ? 'fair' : 'poor'

  // Calculate streak (consecutive days with sessions)
  let streakDays = 0
  const dayMs = 24 * 60 * 60 * 1000
  const sessionsByDay = new Map<number, boolean>()
  for (const s of recentSessions) {
    const day = Math.floor((s.start_time - sevenDaysAgo) / dayMs)
    sessionsByDay.set(day, true)
  }
  for (let day = Math.floor((now - sevenDaysAgo) / dayMs); day >= 0; day--) {
    if (sessionsByDay.has(day)) streakDays++
    else break
  }

  // Sessions today
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const sessionsToday = recentSessions.filter((s) => s.start_time >= todayStart.getTime() && s.start_time < todayEnd.getTime()).length

  // Billable/Personal minutes today
  const db = getDatabase()
  const activitiesToday = db
    .prepare(
      `SELECT billable, duration_seconds FROM activities
       WHERE start_time >= ? AND start_time < ?`
    )
    .all(todayStart.getTime(), todayEnd.getTime()) as any[]

  const billableMinutesToday = Math.round(
    activitiesToday.filter((a) => a.billable).reduce((sum: number, a: any) => sum + a.duration_seconds, 0) / 60
  )
  const personalMinutesToday = Math.round(
    activitiesToday.filter((a) => !a.billable).reduce((sum: number, a: any) => sum + a.duration_seconds, 0) / 60
  )

  return {
    deepWorkScore: Math.round(deepWorkScore),
    focusQuality,
    streakDays,
    totalDeepWorkMinutes: Math.round(deepWorkMinutes),
    completionRate: Math.round(completionRate),
    averageSessionDuration: Math.round(avgDuration),
    sessionsToday,
    billableMinutesToday,
    personalMinutesToday,
  }
}

export function getProductivityPattern(sessions: any[], windowDays: number = 7): ProductivityPattern {
  const hourActivity = new Map<number, { count: number; completed: number }>()

  for (let h = 0; h < 24; h++) {
    hourActivity.set(h, { count: 0, completed: 0 })
  }

  for (const s of sessions) {
    const hour = new Date(s.start_time).getHours()
    const data = hourActivity.get(hour)!
    data.count++
    if (s.completed) data.completed++
  }

  // Sort by completion rate
  const hourScores: Array<[number, number]> = []
  for (let h = 0; h < 24; h++) {
    const data = hourActivity.get(h)!
    const score = data.count > 0 ? data.completed / data.count : 0
    hourScores.push([h, score * 100])
  }

  hourScores.sort((a, b) => b[1] - a[1])

  const bestHours = hourScores.slice(0, 3).map((h) => h[0])
  const worstHours = hourScores.slice(-3).map((h) => h[0]).reverse()
  const peakHour = bestHours.length > 0 ? bestHours[0] : null

  // Régularité : proportion des derniers jours (fenêtre du coaching) avec au moins une session.
  // Un écart-type sur la répartition par heure était utilisé avant, mais avec peu de sessions
  // réparties sur des heures différentes (le cas normal en usage léger), la majorité des 24 cases
  // horaires restent à 0 et le coefficient de variation explose systématiquement — le score
  // retombait quasi toujours à 0%, même pour un usage tout à fait régulier.
  const dayMs = 24 * 60 * 60 * 1000
  const daysWithSessions = new Set<number>()
  for (const s of sessions) {
    daysWithSessions.add(Math.floor(s.start_time / dayMs))
  }
  const consistency = windowDays > 0 ? Math.round(Math.min(daysWithSessions.size / windowDays, 1) * 100) : 0

  return {
    bestHours,
    worstHours,
    peakHour,
    consistency: Math.round(consistency),
  }
}

export function getCoachingRecommendations(analysis: FocusAnalysis, pattern: ProductivityPattern): CoachingRecommendation[] {
  const recommendations: CoachingRecommendation[] = []

  // Recommendation 1: Focus quality
  if (analysis.focusQuality === 'poor') {
    recommendations.push({
      type: 'cycle',
      priority: 'high',
      message: mt('coach', 'scatteredAdviceBody'),
      action: 'start-18min-cycle',
    })
  } else if (analysis.focusQuality === 'fair') {
    recommendations.push({
      type: 'practice',
      priority: 'medium',
      message: mt('coach', 'improvingAdviceBody'),
      action: 'consistency',
    })
  }

  // Recommendation 2: Timing
  if (pattern.peakHour !== null) {
    recommendations.push({
      type: 'timing',
      priority: 'high',
      message: mtf('coach', 'recoPeakHour', { hour: pattern.peakHour }),
      action: `schedule-${pattern.peakHour}`,
    })
  }

  // Recommendation 3: Sessions today (FIXED - now checks sessionsToday)
  if (analysis.sessionsToday === 0) {
    recommendations.push({
      type: 'streak',
      priority: 'high',
      message: mt('coach', 'noSessionTodayBody'),
      action: 'start-session',
    })
  } else if (analysis.streakDays >= 3) {
    recommendations.push({
      type: 'streak',
      priority: 'medium',
      message: mtf('coach', 'recoStreak', { days: analysis.streakDays }),
    })
  }

  // Recommendation 4: Work-Life Balance
  const totalToday = analysis.billableMinutesToday + analysis.personalMinutesToday
  if (totalToday > 0) {
    const billablePercent = Math.round((analysis.billableMinutesToday / totalToday) * 100)
    if (billablePercent > 80) {
      recommendations.push({
        type: 'break',
        priority: 'high',
        message: mtf('coach', 'recoBillableHigh', { percent: billablePercent }),
      })
    } else if (billablePercent > 60) {
      recommendations.push({
        type: 'break',
        priority: 'medium',
        message: mtf('coach', 'recoBillableBalanced', { percent: billablePercent, rest: 100 - billablePercent }),
      })
    }
  }

  // Recommendation 5: Worst hours warning
  if (pattern.worstHours.length > 0) {
    const now = new Date()
    const currentHour = now.getHours()
    if (pattern.worstHours.includes(currentHour)) {
      recommendations.push({
        type: 'timing',
        priority: 'medium',
        message: mt('coach', 'recoWorstHour'),
      })
    }
  }

  // Recommendation 6: Session duration
  if (analysis.averageSessionDuration > 45 * 60 && analysis.focusQuality !== 'excellent') {
    recommendations.push({
      type: 'break',
      priority: 'medium',
      message: mtf('coach', 'recoLongSession', { minutes: Math.round(analysis.averageSessionDuration / 60) }),
      action: 'break-strategy',
    })
  }

  // Recommendation 7: Momentum builder
  if (analysis.sessionsToday > 0 && analysis.sessionsToday <= 2) {
    recommendations.push({
      type: 'practice',
      priority: 'low',
      message: mtf('coach', analysis.sessionsToday > 1 ? 'recoMomentumPlural' : 'recoMomentumSingular', { count: analysis.sessionsToday }),
      action: 'start-session',
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

// Paliers de durée, du plus court au plus long — la durée moyenne réelle sert de point de départ,
// puis plusieurs autres signaux (taux de complétion, régularité, heure actuelle) font monter ou
// descendre d'un palier plutôt que de se fier à la seule moyenne brute, qui peut être trompeuse
// (ex : une moyenne "correcte" alors que la moitié des sessions sont abandonnées en route).
const CYCLE_TIERS = [
  { maxAvgDuration: 15 * 60, duration: 12 * 60, labelKey: 'cycleShort' },
  { maxAvgDuration: 20 * 60, duration: 18 * 60, labelKey: 'cycleTdah' },
  { maxAvgDuration: 30 * 60, duration: 25 * 60, labelKey: 'cyclePomodoro' },
  { maxAvgDuration: Infinity, duration: 45 * 60, labelKey: 'cycleLong' },
] as const

export function getOptimalCycleDuration(
  analysis: FocusAnalysis,
  pattern: ProductivityPattern
): { duration: number; breakDuration: number; reason: string } {
  let tierIndex = CYCLE_TIERS.findIndex((t) => analysis.averageSessionDuration < t.maxAvgDuration)
  if (tierIndex === -1) tierIndex = CYCLE_TIERS.length - 1

  const adjustments: string[] = []

  // Le taux de complétion pèse plus lourd que la durée moyenne brute : une moyenne correcte peut
  // cacher beaucoup de sessions arrêtées avant la fin.
  if (analysis.completionRate < 50 && tierIndex > 0) {
    tierIndex -= 1
    adjustments.push(mtf('coach', 'adjustLowCompletion', { percent: analysis.completionRate }))
  } else if (analysis.completionRate >= 85 && analysis.focusQuality !== 'poor' && tierIndex < CYCLE_TIERS.length - 1) {
    tierIndex += 1
    adjustments.push(mtf('coach', 'adjustHighCompletion', { percent: analysis.completionRate }))
  }

  // Peu de régularité récente : mieux vaut un cycle facile à démarrer pour construire l'habitude
  // plutôt que viser long et risquer l'abandon.
  if (pattern.consistency < 40 && tierIndex > 0) {
    tierIndex -= 1
    adjustments.push(mt('coach', 'adjustLowConsistency'))
  }

  // Heure actuelle historiquement difficile : on vise plus court, quitte à enchaîner les cycles.
  const currentHour = new Date().getHours()
  if (pattern.worstHours.includes(currentHour) && tierIndex > 0) {
    tierIndex -= 1
    adjustments.push(mt('coach', 'adjustWorstHour'))
  }

  tierIndex = Math.max(0, Math.min(CYCLE_TIERS.length - 1, tierIndex))
  const tier = CYCLE_TIERS[tierIndex]
  const label = mt('coach', tier.labelKey)

  // Pause ~20% du temps de focus (base Pomodoro), plancher 3 min / plafond 15 min, arrondie à la minute.
  const breakDuration = Math.round(Math.min(15 * 60, Math.max(3 * 60, tier.duration * 0.2)) / 60) * 60

  const reason = adjustments.length > 0 ? `${label} (${adjustments.join(', ')})` : label

  return { duration: tier.duration, breakDuration, reason }
}
