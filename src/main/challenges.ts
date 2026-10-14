import { getDatabase, getSetting } from './database'
import { notifyMilestoneUnlocked } from './coach'
import { translateMilestoneName, translateChallenge, mt } from './i18n'
import type { FocusSession } from '../shared/types'

export interface Challenge {
  id: number
  name: string
  type: 'sessions' | 'hours' | 'streak' | 'consistency'
  target_value: number
  duration: 'weekly' | 'monthly' | 'all_time'
  reward_points: number
  description?: string
  created_at: number
  start_date: number
  end_date?: number
  active: boolean
}

export interface Milestone {
  id: number
  name: string
  type: string
  threshold: number
  unlocked_at?: number
  progress: number
}

export interface ChallengeProgress {
  challenge_id: number
  current: number
  target: number
  percentage: number
  completed: boolean
  days_remaining?: number
}

// Défis prédéfinis
const DEFAULT_CHALLENGES = [
  {
    name: '💪 7-Jour Streak',
    type: 'streak',
    target: 7,
    duration: 'weekly',
    points: 50,
    description: '7 jours consécutifs avec au moins 1 session focus',
  },
  {
    name: '🔥 50h Deep Work',
    type: 'hours',
    target: 50,
    duration: 'monthly',
    points: 100,
    description: '50 heures de deep work dans le mois',
  },
  {
    name: '🎯 100 Sessions',
    type: 'sessions',
    target: 100,
    duration: 'monthly',
    points: 75,
    description: '100 sessions focus complétées',
  },
  {
    name: '⚡ Perfect Week',
    type: 'consistency',
    target: 7,
    duration: 'weekly',
    points: 150,
    description: 'Chaque jour de la semaine avec session focus',
  },
]

// Milestones prédéfinis
const DEFAULT_MILESTONES = [
  { name: '🌱 First Focus', type: 'first_session', threshold: 1 },
  { name: '🚀 Session 10', type: 'sessions', threshold: 10 },
  { name: '⭐ Session 50', type: 'sessions', threshold: 50 },
  { name: '🏆 Session 100', type: 'sessions', threshold: 100 },
  { name: '💎 Session 365', type: 'sessions', threshold: 365 },
  { name: '⏱️ 10h Deep Work', type: 'deep_work_hours', threshold: 10 },
  { name: '🎖️ 50h Deep Work', type: 'deep_work_hours', threshold: 50 },
  { name: '👑 100h Deep Work', type: 'deep_work_hours', threshold: 100 },
]

export function initializeChallenges() {
  const db = getDatabase()
  const now = Date.now()

  // Identité stable = (type, duration, target) / (type, threshold) plutôt que le nom affiché : ça
  // permet de traduire le nom sans jamais réinsérer un doublon pour les lignes déjà existantes.
  for (const challenge of DEFAULT_CHALLENGES) {
    const existing = db
      .prepare('SELECT id FROM focus_challenges WHERE type = ? AND duration = ? AND target_value = ?')
      .get(challenge.type, challenge.duration, challenge.target)
    if (!existing) {
      db.prepare(
        'INSERT INTO focus_challenges (name, type, target_value, duration, reward_points, description, created_at, start_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(challenge.name, challenge.type, challenge.target, challenge.duration, challenge.points, challenge.description, now, now, 1)
    }
  }

  // Créer les milestones par défaut
  for (const milestone of DEFAULT_MILESTONES) {
    const existing = db.prepare('SELECT id FROM focus_milestones WHERE type = ? AND threshold = ?').get(milestone.type, milestone.threshold)
    if (!existing) {
      db.prepare('INSERT INTO focus_milestones (name, type, threshold, progress) VALUES (?, ?, ?, ?)').run(milestone.name, milestone.type, milestone.threshold, 0)
    }
  }
}

export function getActiveChallenges(): Challenge[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM focus_challenges WHERE active = 1 ORDER BY duration, type').all() as Challenge[]
  return rows.map((row) => {
    const translated = translateChallenge(row.type, row.duration, row.target_value, { name: row.name, description: row.description })
    return { ...row, name: translated.name, description: translated.description ?? row.description }
  })
}

export function getChallengeProgress(challengeId: number): ChallengeProgress | null {
  const db = getDatabase()
  const challenge = db.prepare('SELECT * FROM focus_challenges WHERE id = ?').get(challengeId) as Challenge | undefined
  if (!challenge) return null

  const now = Date.now()
  let dateFilter = 0

  // Calculer la plage de dates selon la durée du défi
  if (challenge.duration === 'weekly') {
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000
    dateFilter = now - oneWeekMs
  } else if (challenge.duration === 'monthly') {
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000
    dateFilter = now - oneMonthMs
  }

  // Récupérer les sessions focus dans cette période
  let current = 0

  if (challenge.type === 'sessions') {
    const result = db.prepare('SELECT COUNT(*) as count FROM focus_sessions WHERE completed = 1 AND start_time >= ?').get(dateFilter) as any
    current = result.count
  } else if (challenge.type === 'hours') {
    const result = db.prepare('SELECT COALESCE(SUM(planned_duration), 0) as total FROM focus_sessions WHERE completed = 1 AND start_time >= ?').get(dateFilter) as any
    current = Math.floor(result.total / 3600) // convertir en heures
  } else if (challenge.type === 'streak') {
    current = getCurrentStreak()
  } else if (challenge.type === 'consistency') {
    current = getWeeklyConsistency()
  }

  const percentage = Math.min((current / challenge.target_value) * 100, 100)
  const daysRemaining = challenge.duration === 'weekly' ? 7 : challenge.duration === 'monthly' ? 30 : undefined

  return {
    challenge_id: challengeId,
    current,
    target: challenge.target_value,
    percentage,
    completed: current >= challenge.target_value,
    days_remaining: daysRemaining,
  }
}

export function getCurrentStreak(): number {
  const db = getDatabase()
  const oneDay = 24 * 60 * 60 * 1000

  let streak = 0
  let date = Math.floor(Date.now() / oneDay) * oneDay

  // Parcourir les jours en arrière pour compter la streak
  while (true) {
    const dayStart = date
    const dayEnd = date + oneDay
    const result = db.prepare('SELECT COUNT(*) as count FROM focus_sessions WHERE completed = 1 AND start_time >= ? AND start_time < ?').get(dayStart, dayEnd) as any

    if (result.count > 0) {
      streak++
      date -= oneDay
    } else {
      break
    }
  }

  return streak
}

export function getWeeklyConsistency(): number {
  const db = getDatabase()
  const oneDay = 24 * 60 * 60 * 1000
  const sevenDays = 7 * oneDay

  const daysWithSessions = new Set<number>()
  const sessions = db.prepare('SELECT start_time FROM focus_sessions WHERE completed = 1 AND start_time >= ?').all(Date.now() - sevenDays) as any[]

  for (const session of sessions) {
    const dayIndex = Math.floor(session.start_time / oneDay)
    daysWithSessions.add(dayIndex)
  }

  return daysWithSessions.size // nombre de jours uniques
}

export function getMilestones(): Milestone[] {
  const db = getDatabase()
  const rawMilestones = db.prepare('SELECT * FROM focus_milestones').all() as Milestone[]
  // Nom traduit dès la lecture : la notification de déblocage plus bas (notifyMilestoneUnlocked)
  // doit recevoir le libellé déjà traduit, pas le texte brut stocké en base.
  const milestones = rawMilestones.map((m) => ({ ...m, name: translateMilestoneName(m.type, m.threshold, m.name) }))

  // Mettre à jour le progrès pour chaque milestone
  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM focus_sessions WHERE completed = 1').get() as any
  const totalDeepWork = db.prepare('SELECT COALESCE(SUM(planned_duration), 0) as total FROM focus_sessions WHERE completed = 1').get() as any
  const deepWorkHours = Math.floor(totalDeepWork.total / 3600)

  const mode = (getSetting('focus_coaching_mode') as 'tdah' | 'standard') || 'tdah'

  return milestones.map((m) => {
    let progress = 0
    if (m.type === 'sessions' || m.type === 'first_session') {
      progress = Math.min(totalSessions.count, m.threshold)
    } else if (m.type === 'deep_work_hours') {
      progress = Math.min(deepWorkHours, m.threshold)
    }

    // Débloque le jalon dès que le seuil réel est atteint — auparavant le calcul de progression
    // ne suffisait pas à lui seul, unlockMilestone() n'était jamais appelée nulle part.
    let unlockedAt = m.unlocked_at
    const realValue = m.type === 'sessions' || m.type === 'first_session' ? totalSessions.count : m.type === 'deep_work_hours' ? deepWorkHours : progress
    if (!unlockedAt && realValue >= m.threshold) {
      const justUnlocked = unlockMilestone(m.id)
      if (justUnlocked) {
        unlockedAt = Date.now()
        notifyMilestoneUnlocked(m.name, mode)
      }
    }

    return {
      ...m,
      progress,
      unlocked_at: unlockedAt,
    }
  })
}

export function unlockMilestone(milestoneId: number): boolean {
  const db = getDatabase()
  const result = db.prepare('UPDATE focus_milestones SET unlocked_at = ? WHERE id = ? AND unlocked_at IS NULL').run(Date.now(), milestoneId)
  return (result.changes as number) > 0
}

export function getLeaderboard(duration: 'weekly' | 'monthly' | 'all_time' = 'weekly'): any[] {
  const db = getDatabase()

  const daysAgo = duration === 'weekly' ? 7 : duration === 'monthly' ? 30 : 365
  const cutoffTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000

  const stats = db
    .prepare(
      `SELECT
        COUNT(DISTINCT CASE WHEN completed = 1 THEN id END) as sessions_completed,
        COALESCE(SUM(CASE WHEN completed = 1 THEN planned_duration END), 0) as deep_work_seconds
      FROM focus_sessions
      WHERE start_time >= ?`
    )
    .get(cutoffTime) as any

  const deepWorkHours = Math.floor(stats.deep_work_seconds / 3600)
  const streak = getCurrentStreak()

  // Simple leaderboard pour l'utilisateur (pas multi-user pour l'instant)
  return [
    {
      rank: 1,
      name: mt('misc', 'you'),
      sessions: stats.sessions_completed,
      hours: deepWorkHours,
      streak,
      points: stats.sessions_completed * 10 + deepWorkHours * 5 + streak * 2,
    },
  ]
}
