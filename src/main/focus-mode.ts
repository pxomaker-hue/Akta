import { getDatabase, recordSyncTombstone } from './database'
import type { FocusSession } from '../shared/types'

export function startFocusSession(
  plannedDuration: number,
  blockedApps: string[],
  projectId?: number,
  phaseId?: number,
  mode: 'simple' | 'chained' = 'simple',
  numSessions: number = 4,
  sessionDuration: number = 25,
  pauseDuration: number = 5
): FocusSession {
  const db = getDatabase()
  const startTime = Date.now()

  const stmt = db.prepare(`
    INSERT INTO focus_sessions (start_time, planned_duration, completed, blocked_apps, updated_at, project_id, phase_id, mode, num_sessions, session_duration, pause_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    startTime,
    plannedDuration,
    0,
    JSON.stringify(blockedApps),
    startTime,
    projectId || null,
    phaseId || null,
    mode,
    numSessions,
    sessionDuration,
    pauseDuration
  )
  const sessionId = Number(result.lastInsertRowid)

  // Return the complete session object to avoid a second DB query
  return {
    id: sessionId,
    start_time: startTime,
    end_time: null,
    planned_duration: plannedDuration,
    completed: false,
    blocked_apps: blockedApps,
    mode,
    num_sessions: numSessions,
    session_duration: sessionDuration,
    pause_duration: pauseDuration,
  } as unknown as FocusSession
}

export function endFocusSession(sessionId: number): boolean {
  const db = getDatabase()
  const endTime = Date.now()

  const getStmt = db.prepare('SELECT planned_duration, start_time FROM focus_sessions WHERE id = ?')
  const session = getStmt.get(sessionId) as any

  if (!session) {
    return false
  }

  // Check if session was completed (duration >= planned)
  const actualDuration = Math.floor((endTime - session.start_time) / 1000)
  const isCompleted = actualDuration >= session.planned_duration

  const updateStmt = db.prepare(`
    UPDATE focus_sessions
    SET end_time = ?, completed = ?, updated_at = ?
    WHERE id = ?
  `)

  updateStmt.run(endTime, isCompleted ? 1 : 0, endTime, sessionId)
  return true
}

export function getFocusSessions(limitDays: number = 7): FocusSession[] {
  const db = getDatabase()
  const daysMs = limitDays * 24 * 60 * 60 * 1000
  const cutoffTime = Date.now() - daysMs

  const stmt = db.prepare(`
    SELECT * FROM focus_sessions
    WHERE start_time >= ?
    ORDER BY start_time DESC
  `)

  return stmt.all(cutoffTime) as FocusSession[]
}

export function getCurrentFocusSession(): FocusSession | null {
  const db = getDatabase()

  const stmt = db.prepare(`
    SELECT * FROM focus_sessions
    WHERE end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `)

  return (stmt.get() as FocusSession) || null
}

export function deleteFocusSession(sessionId: number): void {
  const db = getDatabase()
  const session = db.prepare('SELECT start_time FROM focus_sessions WHERE id = ?').get(sessionId) as any
  if (session) recordSyncTombstone('focus_session', String(session.start_time))
  db.prepare('DELETE FROM focus_sessions WHERE id = ?').run(sessionId)
}

// Détermine si la session chaînée en cours est actuellement dans une phase de pause (plutôt que
// de concentration). Recalculé côté process principal (même logique que calculatePomodoroState
// dans FocusMode.tsx) pour que le blocage d'applis puisse s'en servir indépendamment de la fenêtre
// de rendu — sinon rien ne désactive le blocage pendant les pauses des sessions chaînées.
export function isFocusSessionOnBreak(): boolean {
  const session = getCurrentFocusSession()
  if (!session || session.mode !== 'chained') return false

  const numSessions = session.num_sessions || 4
  const sessionDurationSec = (session.session_duration || 25) * 60
  const pauseDurationSec = (session.pause_duration || 5) * 60

  let remaining = Math.floor((Date.now() - session.start_time) / 1000)
  let sessionNum = 1

  while (sessionNum <= numSessions) {
    if (remaining < sessionDurationSec) return false // en cours de session focus
    remaining -= sessionDurationSec

    if (sessionNum < numSessions) {
      if (remaining < pauseDurationSec) return true // en cours de pause
      remaining -= pauseDurationSec
    }
    sessionNum++
  }

  return false
}

// Clôture automatiquement la session focus en cours si sa durée prévue est dépassée. Nécessaire
// car la détection de fin vivait uniquement dans le composant FocusMode côté renderer (son propre
// setInterval) : si l'utilisateur quittait cet onglet avant l'échéance, plus rien ne surveillait
// l'expiration (ni le blocage d'apps, ni la notification, ni l'icône Mode Focus) tant qu'il n'y
// revenait pas. Appelé depuis un intervalle du process principal, qui tourne toujours.
export function checkAutoCompleteFocusSession(): FocusSession | null {
  const session = getCurrentFocusSession()
  if (!session) return null
  const elapsedMs = Date.now() - session.start_time
  if (elapsedMs < session.planned_duration * 1000) return null
  endFocusSession(session.id)
  return session
}
