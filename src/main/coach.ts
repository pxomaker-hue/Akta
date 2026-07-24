import { Notification } from 'electron'
import path from 'path'
import { getDatabase } from './database'

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
      title: 'Akta — Un peu dispersé ?',
      body: `Tu as changé d'application ${switchTimestamps.length} fois en 5 minutes. Une session focus pourrait aider.`,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyDeepWorkMilestone(minutes: number, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : encourageant et gamifié
    const messages = [
      `🔥 Incroyable ! ${minutes} minutes de concentration pure !`,
      `⭐ Vous dominez ! ${minutes}min c'est du lourd !`,
      `💪 Impressionnant ! Continuez cette énergie !`,
      `🎯 En feu ! ${minutes}min de deep work pur !`,
    ]
    const msg = messages[Math.floor(Math.random() * messages.length)]
    new Notification({
      title: 'Akta — 🏆 Streak en cours !',
      body: msg,
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : discret
    new Notification({
      title: 'Akta',
      body: `${minutes} minutes de concentration.`,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyMilestoneUnlocked(milestoneName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée
    new Notification({
      title: '🏆 Jalon Débloqué !',
      body: `${milestoneName} — Vous êtes une légende ! 🌟`,
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : notification simple
    new Notification({
      title: 'Jalon débloqué',
      body: milestoneName,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyChallengeCompleted(challengeName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée avec récompense
    const celebrations = [
      `🎊 ${challengeName} COMPLÉTÉ ! Vous êtes une MACHINE !`,
      `🚀 WOW ! ${challengeName} — Bravo champion !`,
      `⚡ BOOM ! ${challengeName} — Vous êtes inarrêtable !`,
    ]
    const msg = celebrations[Math.floor(Math.random() * celebrations.length)]
    new Notification({
      title: '🏅 Défi Complété !',
      body: msg,
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : notification simple
    new Notification({
      title: 'Défi complété',
      body: challengeName,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifyDistractionDuringSession(appName: string, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : ludique et motivant
    const messages = [
      `Hé ho ! 👀 Tu driftes sur "${appName}" — Retour au focus ?`,
      `⚠️ Dodo alerte ! "${appName}" c'est pendant la pause, pas pendant la session !`,
      `🎮 J'ai vu ça ! On se refocalise champion ?`,
    ]
    const msg = messages[Math.floor(Math.random() * messages.length)]
    new Notification({
      title: 'Akta — Petit écart ?',
      body: msg,
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : discret
    new Notification({
      title: 'Akta',
      body: `Vous êtes sur ${appName}.`,
      icon: ICON_PATH,
    }).show()
  }
}

export function notifySessionCompleted(duration: number, streakDays: number, mode: 'tdah' | 'standard' = 'tdah') {
  if (!Notification.isSupported()) return

  if (mode === 'tdah') {
    // Mode TDAH : célébration gamifiée
    const celebrations = [
      `🎉 Session terminée ! ${Math.round(duration / 60)} minutes de pure CONCENTRATION !`,
      `⭐ Champion ! Streak à ${streakDays} jours !`,
      `🏆 Vous êtes en FEU ! Session complétée avec succès !`,
    ]
    const msg = celebrations[Math.floor(Math.random() * celebrations.length)]
    new Notification({
      title: '✅ Focus Session Complétée !',
      body: msg,
      icon: ICON_PATH,
    }).show()
  } else {
    // Mode Standard : simple
    new Notification({
      title: 'Session complétée',
      body: `${Math.round(duration / 60)} minutes.`,
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

export function getProductivityPattern(sessions: any[]): ProductivityPattern {
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

  // Consistency: standard deviation of sessions per hour
  const totalSessions = sessions.length
  const avgPerHour = totalSessions / 24
  const variance = Array.from(hourActivity.values()).reduce((sum, data) => {
    return sum + Math.pow(data.count - avgPerHour, 2)
  }, 0) / 24
  const stdDev = Math.sqrt(variance)
  const consistency = Math.max(0, 100 - (stdDev / avgPerHour) * 100)

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
      message: 'Ton focus est dispersé. Essaie des micro-cycles de 18 min (optimisé pour le TDAH) au lieu de 25.',
      action: 'start-18min-cycle',
    })
  } else if (analysis.focusQuality === 'fair') {
    recommendations.push({
      type: 'practice',
      priority: 'medium',
      message: 'Ton focus s\'améliore ! Continue avec des sessions régulières chaque jour.',
      action: 'consistency',
    })
  }

  // Recommendation 2: Timing
  if (pattern.peakHour !== null) {
    recommendations.push({
      type: 'timing',
      priority: 'high',
      message: `Tu es le plus productif vers ${pattern.peakHour}h. Bloque ce créneau pour du focus intense.`,
      action: `schedule-${pattern.peakHour}`,
    })
  }

  // Recommendation 3: Sessions today (FIXED - now checks sessionsToday)
  if (analysis.sessionsToday === 0) {
    recommendations.push({
      type: 'streak',
      priority: 'high',
      message: 'Tu n\'as pas lancé de session focus aujourd\'hui. Une petite session de 15 min pour démarrer ?',
      action: 'start-session',
    })
  } else if (analysis.streakDays >= 3) {
    recommendations.push({
      type: 'streak',
      priority: 'medium',
      message: `C\'est ${analysis.streakDays} jours d'affilée ! 🔥 Continue la série.`,
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
        message: `Tu as ${billablePercent}% de travail pro aujourd'hui. N'oublie pas de décompresser un peu !`,
      })
    } else if (billablePercent > 60) {
      recommendations.push({
        type: 'break',
        priority: 'medium',
        message: `Bonne répartition ! ${billablePercent}% pro, ${100 - billablePercent}% perso. Bien dosé !`,
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
        message: `C'est historiquement une mauvaise heure pour toi. Reste vigilant ou prends une pause recharge.`,
      })
    }
  }

  // Recommendation 6: Session duration
  if (analysis.averageSessionDuration > 45 * 60 && analysis.focusQuality !== 'excellent') {
    recommendations.push({
      type: 'break',
      priority: 'medium',
      message: `Tes sessions durent ${Math.round(analysis.averageSessionDuration / 60)} min en moyenne. Les micro-cycles de 18 min pourraient mieux te convenir !`,
      action: 'break-strategy',
    })
  }

  // Recommendation 7: Momentum builder
  if (analysis.sessionsToday > 0 && analysis.sessionsToday <= 2) {
    recommendations.push({
      type: 'practice',
      priority: 'low',
      message: `Tu as ${analysis.sessionsToday} session${analysis.sessionsToday > 1 ? 's' : ''} aujourd'hui. Une de plus pour la victoire ? 💪`,
      action: 'start-session',
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function getOptimalCycleDuration(analysis: FocusAnalysis): { duration: number; reason: string } {
  // TDAH-optimized: shorter cycles with regular breaks
  if (analysis.averageSessionDuration < 15 * 60) {
    return { duration: 12 * 60, reason: 'Tu as du mal à tenir 15 min. Essaie 12 min pour commencer.' }
  }
  if (analysis.averageSessionDuration < 20 * 60) {
    return { duration: 18 * 60, reason: 'Cycle de 18 min — optimal pour le TDAH' }
  }
  if (analysis.averageSessionDuration < 30 * 60) {
    return { duration: 25 * 60, reason: 'Pomodoro classique, tu as la capacité' }
  }
  return { duration: 45 * 60, reason: 'Tu peux faire des sessions plus longues. Essaie 45 min.' }
}
