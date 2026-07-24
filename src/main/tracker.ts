import activeWin from 'active-win'
import robotjs from 'robotjs'
import { getDatabase, createWorkSession, endWorkSession, updateWorkSessionBillable, getWorkSessions, setActivitiesBillableInRange, createSessionPause, endSessionPause, updateSessionCategoryOverrides, updateSessionProject, getSetting, isAppExcludedFromInactivityDetection } from './database'
import { checkBlocking, isBlockingActive } from './blocker'
import { findMatchingCategory, findMatchingProject } from './categorizer'
import { getActiveWindowInfo } from './window-detector'
import { recordSwitch, maybeNudgeDistraction, notifyDeepWorkMilestone, notifyDistractionDuringSession } from './coach'
import type { Activity } from '../shared/types'

const POLL_INTERVAL = 2000 // ms
const DEFAULT_IDLE_TIMEOUT = 3 * 60 * 1000 // 3 minutes default
const MIN_ACTIVITY_DURATION = 5000 // 5 secondes minimum pour enregistrer
const DEEP_WORK_MILESTONE_MINUTES = 25
// Revenir sur une appli quittée depuis moins de 2 minutes prolonge son activité au lieu d'en créer une nouvelle
const APP_CONTINUITY_GRACE_MS = 2 * 60 * 1000

// Idle timeout configuration
let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT

// Get idle timeout from settings (in seconds)
function getIdleTimeout(): number {
  try {
    const settingValue = getSetting('idle_timeout')
    if (settingValue) {
      const seconds = parseInt(settingValue, 10)
      if (!isNaN(seconds) && seconds > 0) {
        return seconds * 1000
      }
    }
  } catch (e) {
    console.error('Error reading idle_timeout setting:', e)
  }
  return DEFAULT_IDLE_TIMEOUT
}

interface OpenActivity {
  id: number
  appName: string
  windowTitle: string
  accumulatedSeconds: number // temps réellement passé au premier plan (hors gaps)
  lastActiveAt: number // dernier instant où l'appli était au premier plan
  backgroundedAt: number | null // instant où elle est passée en arrière-plan (null = actuellement au premier plan)
  isDistraction: boolean
  distractionNotified: boolean // évite de spammer la notification pour la même activité
}

const DISTRACTION_NOTIFY_SECONDS = 20

let isTracking = false
let pollInterval: NodeJS.Timeout | null = null

let currentWindow: { app: string; title: string } | null = null
// Activité actuellement au premier plan
let currentOpenActivity: OpenActivity | null = null
// Activités récemment quittées, en attente (< 2 min) au cas où l'utilisateur y revienne
let backgroundedActivities: Map<string, OpenActivity> = new Map()
let lastInputTime = Date.now()
// Dernière appli OS réellement observée au premier plan, utilisée UNIQUEMENT pour détecter un vrai
// changement d'appli (signal d'activité). Distinct de `currentWindow`, que checkIdleStatus() remet à
// null quand elle détecte l'inactivité — comparer contre currentWindow ferait croire à un "changement
// d'appli" à chaque sortie d'inactivité alors que l'appli au premier plan n'a jamais bougé, ce qui
// relançait lastInputTime en boucle et empêchait tout vrai statut inactif de se maintenir.
let lastKnownForegroundApp: string | null = null

// Tracking des changements de titre de fenêtre pour recatégorisation intelligente
let lastTitleChangeTime = Date.now()
let currentTitleCategory: number | null = null

// Mouse tracking for real inactivity detection
let lastMousePosition = { x: 0, y: 0 }
let mouseTrackingEnabled = true

let isIdle = false

type SessionState = 'stopped' | 'running' | 'paused'
let sessionState: SessionState = 'stopped'
let currentSessionStartTime: number | null = null
let pausedAt: number | null = null
let pausedByIdle = false
let totalPausedMs = 0
let sessionBillableOverride: boolean | null = null
let currentWorkSessionId: number | null = null
let currentPauseId: number | null = null
let currentProjectId: number | null = null
let currentPhaseId: number | null = null

type CategoryOverride = 'focus' | 'distraction'
// Surcharges de catégories propres à la session en cours (ex : "web" ponctuellement en distraction
// pour ce dossier client, alors que ce n'est pas distraction par défaut)
let currentCategoryOverrides: Record<number, CategoryOverride> = {}

// Applique la surcharge de session (si définie pour cette catégorie) par-dessus la règle globale
function effectiveIsDistraction(categoryId: number | null, globalDistraction: boolean): boolean {
  if (categoryId === null) return globalDistraction
  const override = currentCategoryOverrides[categoryId]
  if (override === 'distraction') return true
  if (override === 'focus') return false
  return globalDistraction
}

export function setSessionCategoryOverrides(overrides: Record<number, CategoryOverride>) {
  currentCategoryOverrides = overrides
  if (currentWorkSessionId !== null) {
    updateSessionCategoryOverrides(currentWorkSessionId, JSON.stringify(currentCategoryOverrides))
  }
}

export function getSessionCategoryOverrides(): Record<number, CategoryOverride> {
  return currentCategoryOverrides
}

// Rattache la session en cours à un projet (et éventuellement une phase de ce projet), depuis le
// sélecteur de la pill de suivi — sans attendre la fin de la session comme le fait l'historique
export function setSessionProject(projectId: number | null, phaseId: number | null) {
  // Stop auto-detection if user manually assigns a project
  if (currentWorkSessionId && projectId !== null) {
    stopWorkSessionDetection(currentWorkSessionId)
  }
  currentProjectId = projectId
  currentPhaseId = phaseId
  if (currentWorkSessionId !== null) {
    updateSessionProject(currentWorkSessionId, projectId, phaseId)
  }
}

// Démarre une pause persistée (manuelle ou due à l'inactivité) sur la session de travail en cours
function enterPause(now: number) {
  if (currentWorkSessionId !== null) {
    currentPauseId = createSessionPause(currentWorkSessionId, now)
  }
}

// Clôture la pause persistée en cours, le cas échéant
function exitPause(now: number) {
  if (currentPauseId !== null) {
    endSessionPause(currentPauseId, now)
    currentPauseId = null
  }
}

let currentStreakCategoryId: number | null = null
let currentStreakStartTime: number | null = null
let deepWorkNotified = false

// Démarre le suivi général en arrière-plan (toujours actif, indépendant des "sessions actives")
// Les "sessions actives" (start/pause/stop) sont une couche facultative par-dessus, activée via startSession().
export function startTracker() {
  if (isTracking) return

  isTracking = true
  lastInputTime = Date.now()
  lastKnownForegroundApp = null
  isIdle = false
  sessionState = 'stopped'
  mouseTrackingEnabled = true

  // Initialize mouse position for inactivity detection
  try {
    lastMousePosition = robotjs.getMousePos()
  } catch (error) {
    console.warn('Could not initialize mouse tracking:', error)
    mouseTrackingEnabled = false
  }

  // Update idle timeout from settings
  idleTimeoutMs = getIdleTimeout()

  pollInterval = setInterval(async () => {
    try {
      await pollWindowActivity()
    } catch (error) {
      console.error('Erreur poll tracker:', error)
    }
  }, POLL_INTERVAL)

  console.log('Tracker d\'activité démarré')
}

export function stopTracker() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isTracking = false
  closeAllActivitiesNow(Date.now())
  finalizeCurrentWorkSession()
  console.log('Activity tracker stopped')
}

// Calcule la durée active (hors pauses) et clôture la session de travail en base
function finalizeCurrentWorkSession() {
  if (currentWorkSessionId === null || currentSessionStartTime === null) return
  const now = Date.now()
  let pausedMsSoFar = totalPausedMs
  if (sessionState === 'paused' && pausedAt !== null) {
    pausedMsSoFar += now - pausedAt
  }
  exitPause(now)
  const durationSeconds = Math.max(Math.floor((now - currentSessionStartTime - pausedMsSoFar) / 1000), 0)
  endWorkSession(currentWorkSessionId, now, durationSeconds)
  currentWorkSessionId = null
}

async function pollWindowActivity() {
  // Le suivi général (temps par application, avec la stratégie de continuité de 2 min) tourne
  // toujours en arrière-plan, indépendamment de l'état d'une "session active" (start/pause/stop).

  // Check for mouse movement first (real inactivity detection)
  checkMouseMovement()

  try {
    const window = await activeWin()

    if (!window) {
      // No active window (system idle)
      checkIdleStatus()
      return
    }

    const newWindow = {
      app: (window as any).owner?.name || 'Unknown',
      title: window.title || '',
    }
    const now = Date.now()

    // Akta lui-même ne doit pas être suivi (fausserait les statistiques), mais y naviguer reste
    // une preuve réelle de présence de l'utilisateur : ça compte pour l'inactivité.
    const isAktaWindow = newWindow.title.toLowerCase().includes('akta') || newWindow.app.toLowerCase().includes('akta')
    if (isAktaWindow) {
      if (lastKnownForegroundApp !== 'Akta') {
        lastInputTime = now
        lastKnownForegroundApp = 'Akta'
      }
      checkIdleStatus()
      if (currentOpenActivity) {
        backgroundCurrentActivity(now)
      }
      currentWindow = null
      sweepExpiredBackgroundedActivities(now)
      return
    }

    // Un changement d'application est un signal fiable d'activité réelle (l'utilisateur a dû
    // cliquer/alt-tabber). Un simple changement de titre dans la même appli ne compte pas : trop
    // de programmes changent leur titre tout seuls (compteur, notification, lecture vidéo).
    // On compare à lastKnownForegroundApp (et non currentWindow) : ce dernier est remis à null par
    // checkIdleStatus() dès que l'inactivité est détectée, ce qui ferait passer chaque sortie
    // d'inactivité pour un "changement d'appli" alors que l'appli au premier plan n'a jamais bougé —
    // et relancerait lastInputTime en boucle sans jamais laisser un vrai statut inactif se maintenir.
    const appChanged = lastKnownForegroundApp !== newWindow.app
    if (appChanged) {
      lastInputTime = now
      lastKnownForegroundApp = newWindow.app
    }

    // Appelé ici (après la mise à jour de lastInputTime ci-dessus) pour évaluer l'état inactif avec
    // la donnée la plus fraîche de ce cycle. checkIdleStatus() est l'unique source de vérité pour
    // isIdle, dans les deux sens (entrée ET sortie) — sinon, une fenêtre qui reste au premier plan
    // sans bouger repasserait "active" à chaque poll simplement parce qu'elle a le focus.
    checkIdleStatus()

    if (isIdle) {
      // Toujours inactif malgré la présence d'une fenêtre : on n'ouvre ni ne prolonge aucune
      // activité tant qu'aucun signal réel (souris, changement d'appli) n'a mis fin à l'inactivité.
      return
    }

    if (!currentWindow || currentWindow.app !== newWindow.app) {
      // Changement d'application (un changement de titre de fenêtre seul ne compte pas comme une coupure)
      handleAppSwitch(newWindow, now)
    } else if (currentOpenActivity) {
      // Même application : on continue d'accumuler le temps réellement passé dessus
      currentOpenActivity.accumulatedSeconds += (now - currentOpenActivity.lastActiveAt) / 1000
      currentOpenActivity.lastActiveAt = now

      // Vérifier si le titre a changé (onglet différent dans un navigateur)
      console.log(`[TitleChangeCheck] Old title: "${currentOpenActivity.windowTitle}", New title: "${newWindow.title}", Same? ${currentOpenActivity.windowTitle === newWindow.title}`)
      if (currentOpenActivity.windowTitle !== newWindow.title) {
        console.log(`[TitleChangeCheck] Title changed! Checking categorization...`)
        const newCategory = findMatchingCategory(newWindow.app, newWindow.title)
        const newCategoryId = newCategory?.id ?? null
        console.log(`[TitleChangeCheck] Old category ID: ${currentTitleCategory}, New category ID: ${newCategoryId}, Same? ${newCategoryId === currentTitleCategory}`)

        // Si la catégorie changerait
        if (newCategoryId !== currentTitleCategory) {
          const timeSinceLastTitleChange = now - lastTitleChangeTime
          console.log(
            `[TitleChange] Catégorie changerait de ${currentTitleCategory} à ${newCategoryId} (durée: ${timeSinceLastTitleChange}ms)`
          )

          if (timeSinceLastTitleChange < 20000) {
            // Moins de 20 secondes : recatégoriser l'activité en cours
            console.log(`[TitleChange] < 20s, recatégorisant l'activité`)
            if (newCategory) {
              currentOpenActivity.isDistraction = newCategory.isDistraction
              const db = getDatabase()
              const stmt = db.prepare('UPDATE activities SET category_id = ? WHERE id = ?')
              stmt.run(newCategory.id, currentOpenActivity.id)
            }
          } else {
            // 20+ secondes : créer une nouvelle activité
            console.log(`[TitleChange] >= 20s, créant une nouvelle activité`)
            backgroundCurrentActivity(now)
            const newActivity = openNewActivity(newWindow.app, newWindow.title, now)
            currentOpenActivity = newActivity
          }

          lastTitleChangeTime = now
          currentTitleCategory = newCategoryId
        }
      }

      currentOpenActivity.windowTitle = newWindow.title
      persistActivityProgress(currentOpenActivity)
    }

    // Coaching : rappel de focus si on traîne sur une catégorie "distraction" pendant une session active
    if (
      currentOpenActivity &&
      currentOpenActivity.isDistraction &&
      !currentOpenActivity.distractionNotified &&
      sessionState === 'running' &&
      currentOpenActivity.accumulatedSeconds >= DISTRACTION_NOTIFY_SECONDS
    ) {
      currentOpenActivity.distractionNotified = true
      notifyDistractionDuringSession(currentOpenActivity.appName)
    }

    currentWindow = newWindow
    checkBlocking(newWindow.app, newWindow.title)
    checkDeepWorkStreak()
    sweepExpiredBackgroundedActivities(now)
  } catch (error) {
    console.error('Error polling active window:', error)
  }
}

// Passe l'activité au premier plan en arrière-plan (grâce de 2 min avant clôture définitive)
function backgroundCurrentActivity(now: number) {
  if (!currentOpenActivity) return
  currentOpenActivity.backgroundedAt = now
  backgroundedActivities.set(currentOpenActivity.appName, currentOpenActivity)
  currentOpenActivity = null
}

// Gère un changement d'application : reprend une activité récemment quittée (<2 min) ou en ouvre une nouvelle
function handleAppSwitch(newWindow: { app: string; title: string }, now: number) {
  if (currentOpenActivity) {
    backgroundCurrentActivity(now)
  }

  const pending = backgroundedActivities.get(newWindow.app)
  if (pending && pending.backgroundedAt !== null && now - pending.backgroundedAt <= APP_CONTINUITY_GRACE_MS) {
    // Retour sur une appli quittée récemment : on prolonge l'activité existante au lieu d'en créer une nouvelle
    backgroundedActivities.delete(newWindow.app)
    pending.backgroundedAt = null
    pending.lastActiveAt = now
    pending.windowTitle = newWindow.title
    currentOpenActivity = pending
    persistActivityProgress(pending)
  } else {
    currentOpenActivity = openNewActivity(newWindow.app, newWindow.title, now)
  }
}

// Clôture définitivement toute activité (au premier plan et en attente de grâce) — utilisé pour pause/stop/idle/quit
function closeAllActivitiesNow(now: number) {
  if (currentOpenActivity) {
    finalizeActivity(currentOpenActivity, now)
    currentOpenActivity = null
  }
  for (const activity of backgroundedActivities.values()) {
    finalizeActivity(activity, activity.backgroundedAt ?? now)
  }
  backgroundedActivities.clear()
}

// Clôture les activités en attente dont le délai de grâce de 2 minutes est dépassé
function sweepExpiredBackgroundedActivities(now: number) {
  for (const [appName, activity] of backgroundedActivities) {
    if (activity.backgroundedAt !== null && now - activity.backgroundedAt > APP_CONTINUITY_GRACE_MS) {
      finalizeActivity(activity, activity.backgroundedAt)
      backgroundedActivities.delete(appName)
    }
  }
}

function checkDeepWorkStreak() {
  if (currentStreakCategoryId === null || currentStreakStartTime === null || deepWorkNotified) return

  const elapsedMinutes = (Date.now() - currentStreakStartTime) / 60000
  if (elapsedMinutes >= DEEP_WORK_MILESTONE_MINUTES) {
    deepWorkNotified = true
    notifyDeepWorkMilestone(DEEP_WORK_MILESTONE_MINUTES)
  }
}

// Check for mouse movement to detect real inactivity
function checkMouseMovement() {
  if (!mouseTrackingEnabled) return

  try {
    // Skip mouse tracking for excluded apps/windows
    if (currentWindow && isAppExcludedFromInactivityDetection(currentWindow.app, currentWindow.title)) {
      return
    }

    const currentPos = robotjs.getMousePos()
    if (currentPos.x !== lastMousePosition.x || currentPos.y !== lastMousePosition.y) {
      lastInputTime = Date.now()
      lastMousePosition = currentPos
    }
  } catch (error) {
    console.warn('Mouse tracking error:', error)
    mouseTrackingEnabled = false
  }
}

// Unique source de vérité pour isIdle, dans les deux sens. lastInputTime n'est rafraîchi que par
// de vrais signaux (mouvement de souris, changement d'appli) — donc le simple fait qu'une fenêtre
// garde le focus sans bouger n'empêche plus l'inactivité de se déclencher, et ne la fait plus sortir
// en boucle non plus.
function checkIdleStatus() {
  const timeSinceLastActivity = Date.now() - lastInputTime
  const shouldBeIdle = timeSinceLastActivity > idleTimeoutMs
  const now = Date.now()

  if (shouldBeIdle && !isIdle) {
    isIdle = true
    if (sessionState === 'running') {
      sessionState = 'paused'
      pausedAt = now
      pausedByIdle = true
      enterPause(pausedAt)
    }
    if (currentWindow) {
      closeAllActivitiesNow(now)
      currentWindow = null
    }
  } else if (!shouldBeIdle && isIdle) {
    isIdle = false
    if (sessionState === 'paused' && pausedByIdle) {
      totalPausedMs += now - (pausedAt ?? now)
      pausedAt = null
      pausedByIdle = false
      sessionState = 'running'
      exitPause(now)
    }
  }
}

// Ouvre une nouvelle activité (nouvelle appli jamais vue récemment, ou grâce de 2 min expirée)
function openNewActivity(appName: string, windowTitle: string, startTime: number): OpenActivity {
  const db = getDatabase()
  const match = findMatchingCategory(appName, windowTitle)

  // Initialiser le tracking du changement de titre pour recatégorisation intelligente
  lastTitleChangeTime = startTime
  currentTitleCategory = match?.id ?? null

  // Suivi du streak de deep work (même catégorie maintenue dans la durée)
  if (match && match.id === currentStreakCategoryId) {
    // streak continue, on ne réinitialise pas le départ
  } else {
    currentStreakCategoryId = match?.id ?? null
    currentStreakStartTime = match ? startTime : null
    deepWorkNotified = false
  }

  // Coaching anti-zapping (désactivé pendant une session focus, déjà gérée par le blocage)
  recordSwitch()
  if (!isBlockingActive()) {
    maybeNudgeDistraction()
  }

  // La surcharge de la session en cours (focus/distraction ponctuel pour ce dossier) prime sur la règle globale
  const isDistraction = effectiveIsDistraction(match?.id ?? null, !!match?.isDistraction)
  // Une distraction n'est jamais facturable, même si la session en cours l'est
  // Les activités créées pendant une pause ne sont jamais facturables non plus
  const isInPause = sessionState === 'paused' && currentPauseId !== null
  const billable = isInPause || isDistraction ? false : sessionBillableOverride !== null ? sessionBillableOverride : match ? match.billable : null

  const stmt = db.prepare(`
    INSERT INTO activities (app_name, window_title, start_time, duration_seconds, category_id, billable)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(appName, windowTitle, startTime, 0, match?.id ?? null, billable === null ? null : billable ? 1 : 0)

  return {
    id: Number(result.lastInsertRowid),
    appName,
    windowTitle,
    accumulatedSeconds: 0,
    lastActiveAt: startTime,
    backgroundedAt: null,
    isDistraction,
    distractionNotified: false,
  }
}

// Met à jour la durée accumulée (et le titre) d'une activité toujours ouverte, sans la clôturer
function persistActivityProgress(activity: OpenActivity) {
  const db = getDatabase()
  const stmt = db.prepare('UPDATE activities SET duration_seconds = ?, window_title = ? WHERE id = ?')
  stmt.run(Math.floor(activity.accumulatedSeconds), activity.windowTitle, activity.id)
}

// Clôture définitivement une activité avec sa durée réellement accumulée (hors gaps)
function finalizeActivity(activity: OpenActivity, endTime: number) {
  const db = getDatabase()
  const durationSeconds = Math.max(Math.floor(activity.accumulatedSeconds), Math.floor(MIN_ACTIVITY_DURATION / 1000))
  const stmt = db.prepare('UPDATE activities SET end_time = ?, duration_seconds = ?, window_title = ? WHERE id = ?')
  stmt.run(endTime, durationSeconds, activity.windowTitle, activity.id)
}

export function updateLastInputTime() {
  lastInputTime = Date.now()
}

export function getCurrentActivityId(): number | null {
  return currentOpenActivity?.id ?? null
}

export function getTrackingStatus() {
  const now = Date.now()
  let pausedMsSoFar = totalPausedMs
  if (sessionState === 'paused' && pausedAt !== null) {
    pausedMsSoFar += now - pausedAt
  }

  return {
    isIdle,
    sessionState,
    sessionStartTime: currentSessionStartTime,
    pausedMs: pausedMsSoFar,
    currentApp: currentWindow?.app ?? null,
    billableOverride: sessionBillableOverride,
    categoryOverrides: currentCategoryOverrides,
    projectId: currentProjectId,
    phaseId: currentPhaseId,
  }
}

export function getCurrentWorkSessionDetails() {
  if (sessionState === 'stopped' || currentSessionStartTime === null) {
    return null
  }

  const now = Date.now()
  let pausedMsSoFar = totalPausedMs
  if (sessionState === 'paused' && pausedAt !== null) {
    pausedMsSoFar += now - pausedAt
  }

  const elapsedMs = now - currentSessionStartTime - pausedMsSoFar
  const elapsedSeconds = Math.max(Math.floor(elapsedMs / 1000), 0)

  return {
    isRunning: sessionState === 'running',
    isPaused: sessionState === 'paused',
    elapsedSeconds,
    projectId: currentProjectId,
    phaseId: currentPhaseId,
    currentApp: currentWindow?.app ?? null,
  }
}

// Marque la session en cours (et toutes ses activités déjà enregistrées) comme facturable ou non
export function setSessionBillable(billable: boolean) {
  sessionBillableOverride = billable

  // updateWorkSessionBillable cascade déjà vers les activités (en excluant les catégories distraction)
  if (currentWorkSessionId !== null) {
    updateWorkSessionBillable(currentWorkSessionId, billable)
  } else if (currentSessionStartTime !== null) {
    setActivitiesBillableInRange(currentSessionStartTime, Date.now(), billable)
  }
}

// Démarre une nouvelle session de suivi (repart de zéro)
// Map to track project detection per work session
const workSessionDetectionMap = new Map<number, { interval: NodeJS.Timeout; detected: boolean }>()

export function startSession() {
  sessionState = 'running'
  currentSessionStartTime = Date.now()
  pausedAt = null
  pausedByIdle = false
  totalPausedMs = 0
  sessionBillableOverride = null
  isIdle = false
  lastInputTime = Date.now()
  currentPauseId = null
  currentCategoryOverrides = {}
  currentProjectId = null
  currentPhaseId = null
  currentWorkSessionId = createWorkSession(currentSessionStartTime)

  // Start continuous project detection for work sessions
  startWorkSessionDetection(currentWorkSessionId)
}

// Met la session en pause : le chrono de la session est figé, mais le suivi général des activités
// en arrière-plan continue normalement (on ne coupe pas le tracking, seulement la "session").
export function pauseSession() {
  if (sessionState !== 'running') return
  sessionState = 'paused'
  pausedAt = Date.now()
  pausedByIdle = false
  enterPause(pausedAt)
}

// Reprend la session après une pause manuelle (le chrono continue où il s'était arrêté)
export function resumeSession() {
  if (sessionState !== 'paused') return
  const now = Date.now()
  totalPausedMs += now - (pausedAt ?? now)
  pausedAt = null
  pausedByIdle = false
  sessionState = 'running'
  isIdle = false
  lastInputTime = now
  exitPause(now)
}

// Start continuous project detection for work sessions
function startWorkSessionDetection(workSessionId: number) {
  // Only start detection if no project is already assigned
  if (currentProjectId) {
    console.log(`[WorkSessionDetection] Session ${workSessionId}: Project already assigned, skipping detection`)
    return
  }

  const interval = setInterval(async () => {
    try {
      const state = workSessionDetectionMap.get(workSessionId)
      // Stop if already detected or session was removed
      if (!state || state.detected || currentProjectId) return

      const windowInfo = await getActiveWindowInfo()
      if (windowInfo) {
        console.log(`[WorkSessionDetection] Session ${workSessionId}: Scanning - App: "${windowInfo.appName}", Window: "${windowInfo.windowTitle}"`)
        const match = findMatchingProject(windowInfo.appName, windowInfo.windowTitle)
        if (match && match.projectId) {
          // Update work session with detected project and phase
          const db = getDatabase()
          db.prepare('UPDATE work_sessions SET project_id = ?, phase_id = ? WHERE id = ?').run(
            match.projectId,
            match.phaseId || null,
            workSessionId
          )
          // Update tracking state
          currentProjectId = match.projectId
          currentPhaseId = match.phaseId || null
          // Mark as detected (lock assignment)
          const currentState = workSessionDetectionMap.get(workSessionId)
          if (currentState) {
            currentState.detected = true
          }
          console.log(`[WorkSessionDetection] Session ${workSessionId}: ✓ LOCKED - Project ${match.projectId}${match.phaseId ? `, Phase ${match.phaseId}` : ' (no phase)'}`)
        }
      }
    } catch (detectError) {
      console.warn(`[WorkSessionDetection] Warning in session ${workSessionId}:`, detectError)
    }
  }, 5000) // Check every 5 seconds

  workSessionDetectionMap.set(workSessionId, { interval, detected: false })
  console.log(`[WorkSessionDetection] Started detection for session ${workSessionId}`)
}

// Stop work session detection when manually assigning project (user override)
export function stopWorkSessionDetection(workSessionId: number) {
  const state = workSessionDetectionMap.get(workSessionId)
  if (state) {
    clearInterval(state.interval)
    workSessionDetectionMap.delete(workSessionId)
    console.log(`[WorkSessionDetection] Stopped detection for session ${workSessionId}`)
  }
}

// Arrête complètement la session en cours (le prochain démarrage repartira à zéro).
// Ne coupe pas le suivi général des activités : celui-ci continue en arrière-plan comme toujours.
export function stopSession() {
  // Stop work session detection before finalizing
  if (currentWorkSessionId) {
    stopWorkSessionDetection(currentWorkSessionId)
  }
  finalizeCurrentWorkSession()
  sessionState = 'stopped'
  currentSessionStartTime = null
  pausedAt = null
  pausedByIdle = false
  totalPausedMs = 0
  sessionBillableOverride = null
  currentCategoryOverrides = {}
  currentProjectId = null
  currentPhaseId = null
}

// Liste les sessions de travail persistées depuis une date donnée
export function listWorkSessions(sinceMs: number) {
  return getWorkSessions(sinceMs)
}

export function getRecentActivities(limitDays: number = 7): Activity[] {
  const db = getDatabase()
  const daysMs = limitDays * 24 * 60 * 60 * 1000
  const cutoffTime = Date.now() - daysMs

  const stmt = db.prepare(`
    SELECT * FROM activities
    WHERE start_time >= ?
    ORDER BY start_time DESC
  `)

  return stmt.all(cutoffTime) as Activity[]
}
