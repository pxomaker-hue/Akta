import activeWin from 'active-win'
import { screen, powerMonitor } from 'electron'
import { getDatabase, createWorkSession, endWorkSession, updateWorkSessionBillable, getWorkSessions, setActivitiesBillableInRange, createSessionPause, endSessionPause, updateSessionCategoryOverrides, updateSessionProject, getSetting, isAppExcludedFromInactivityDetection } from './database'
import { checkBlocking, isBlockingActive } from './blocker'
import { findMatchingCategory, findMatchingProject } from './categorizer'
import { getActiveWindowInfo } from './window-detector'
import { recordSwitch, maybeNudgeDistraction, notifyDeepWorkMilestone, notifyDistractionDuringSession } from './coach'
import type { Activity } from '../shared/types'
import { debugLog } from './log'

const POLL_INTERVAL = 2000 // ms
const DEFAULT_IDLE_TIMEOUT = 3 * 60 * 1000 // 3 minutes default
const DEEP_WORK_MILESTONE_MINUTES = 25
// Revenir sur une appli quittée depuis moins de 2 minutes prolonge son activité au lieu d'en créer une nouvelle
const APP_CONTINUITY_GRACE_MS = 2 * 60 * 1000
// Écart maximal crédité entre deux polls. Au-delà (mise en veille, process gelé…), l'écart n'est pas
// du temps passé sur l'appli : sans ce plafond, une activité reprenait toute la durée de la veille.
const MAX_POLL_GAP_MS = 10 * 1000

// Idle timeout configuration
let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT

// Relit le délai d'inactivité depuis les paramètres — appelé quand l'utilisateur le modifie, pour
// qu'il s'applique immédiatement au lieu d'attendre le prochain redémarrage de l'app.
export function refreshIdleTimeout() {
  idleTimeoutMs = getIdleTimeout()
}

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
    lastMousePosition = screen.getCursorScreenPoint()
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

// Arrêt / déconnexion du système : clôt la session et les activités en cours sans arrêter le
// polling — si l'arrêt est annulé, le suivi reprend normalement au poll suivant.
export function flushForShutdown() {
  stopSession()
  closeAllActivitiesNow(Date.now())
  currentWindow = null
}

// Calcule la durée active (hors pauses) et clôture la session de travail en base
function finalizeCurrentWorkSession(now: number = Date.now()) {
  if (currentWorkSessionId === null || currentSessionStartTime === null) return
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

  // Détection d'activité réelle (clavier + souris) avant toute chose
  refreshInputActivity()

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
      accumulateUntil(currentOpenActivity, now)

      // Vérifier si le titre a changé (onglet différent dans un navigateur)
      debugLog(`[TitleChangeCheck] Old title: "${currentOpenActivity.windowTitle}", New title: "${newWindow.title}", Same? ${currentOpenActivity.windowTitle === newWindow.title}`)
      if (currentOpenActivity.windowTitle !== newWindow.title) {
        debugLog(`[TitleChangeCheck] Title changed! Checking categorization...`)
        const newCategory = findMatchingCategory(newWindow.app, newWindow.title)
        const newCategoryId = newCategory?.id ?? null
        debugLog(`[TitleChangeCheck] Old category ID: ${currentTitleCategory}, New category ID: ${newCategoryId}, Same? ${newCategoryId === currentTitleCategory}`)

        // Si la catégorie changerait
        if (newCategoryId !== currentTitleCategory) {
          const timeSinceLastTitleChange = now - lastTitleChangeTime
          debugLog(
            `[TitleChange] Catégorie changerait de ${currentTitleCategory} à ${newCategoryId} (durée: ${timeSinceLastTitleChange}ms)`
          )

          if (timeSinceLastTitleChange < 20000) {
            // Moins de 20 secondes : recatégoriser l'activité en cours
            debugLog(`[TitleChange] < 20s, recatégorisant l'activité`)
            if (newCategory) {
              currentOpenActivity.isDistraction = newCategory.isDistraction
              const db = getDatabase()
              const stmt = db.prepare('UPDATE activities SET category_id = ? WHERE id = ?')
              stmt.run(newCategory.id, currentOpenActivity.id)
            }
          } else {
            // 20+ secondes : créer une nouvelle activité
            debugLog(`[TitleChange] >= 20s, créant une nouvelle activité`)
            // Même appli : l'ancienne activité ne peut pas être "reprise", on la clôt directement
            // (la mettre en attente l'aurait fait écraser dans la Map, indexée par nom d'appli)
            finalizeActivity(currentOpenActivity, now)
            currentOpenActivity = null
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
  // Une seule activité en attente par appli : une éventuelle précédente est close, sinon elle
  // était écrasée dans la Map et restait ouverte en base (end_time NULL)
  const previous = backgroundedActivities.get(currentOpenActivity.appName)
  if (previous && previous !== currentOpenActivity) {
    finalizeActivity(previous, previous.backgroundedAt ?? now)
  }
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
// `now` peut être dans le passé (début réel d'une inactivité) : le temps crédité après cet instant
// est alors retiré, pour ne pas compter le délai d'inactivité comme du temps passé sur l'appli.
function closeAllActivitiesNow(now: number) {
  if (currentOpenActivity) {
    if (currentOpenActivity.lastActiveAt > now) {
      const overshoot = (currentOpenActivity.lastActiveAt - now) / 1000
      currentOpenActivity.accumulatedSeconds = Math.max(currentOpenActivity.accumulatedSeconds - overshoot, 0)
    }
    finalizeActivity(currentOpenActivity, now)
    currentOpenActivity = null
  }
  for (const activity of backgroundedActivities.values()) {
    finalizeActivity(activity, Math.min(activity.backgroundedAt ?? now, now))
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

// Ajoute à l'activité le temps écoulé depuis le dernier poll, plafonné (voir MAX_POLL_GAP_MS)
function accumulateUntil(activity: OpenActivity, now: number) {
  const delta = Math.min(Math.max(now - activity.lastActiveAt, 0), MAX_POLL_GAP_MS)
  activity.accumulatedSeconds += delta / 1000
  activity.lastActiveAt = now
}

// Rafraîchit lastInputTime à partir des vrais signaux d'activité de l'utilisateur.
// powerMonitor.getSystemIdleTime() couvre clavier ET souris au niveau de l'OS : avec la seule
// position du curseur, quelqu'un qui tapait sans toucher la souris passait inactif au bout du délai.
// Les exclusions d'inactivité (vidéo, tuto…) maintiennent l'utilisateur actif tant que la fenêtre
// exclue est au premier plan.
function refreshInputActivity() {
  const now = Date.now()

  if (currentWindow && isAppExcludedFromInactivityDetection(currentWindow.app, currentWindow.title)) {
    lastInputTime = now
    return
  }

  try {
    const idleMs = powerMonitor.getSystemIdleTime() * 1000
    lastInputTime = Math.max(lastInputTime, now - idleMs)
    return
  } catch (error) {
    // Repli sur la position de la souris si l'API système n'est pas disponible
  }

  if (!mouseTrackingEnabled) return
  try {
    const currentPos = screen.getCursorScreenPoint()
    if (currentPos.x !== lastMousePosition.x || currentPos.y !== lastMousePosition.y) {
      lastInputTime = now
      lastMousePosition = currentPos
    }
  } catch (error) {
    console.warn('Mouse tracking error:', error)
    mouseTrackingEnabled = false
  }
}

// Passe en inactif à l'instant `at` (dernière action réelle de l'utilisateur, pas l'instant de la
// détection) : la pause de session et la clôture des activités démarrent là, pour ne pas facturer
// le délai d'inactivité lui-même.
function enterIdle(at: number) {
  if (isIdle) return
  isIdle = true
  if (sessionState === 'running') {
    sessionState = 'paused'
    pausedAt = Math.max(at, currentSessionStartTime ?? at)
    pausedByIdle = true
    enterPause(pausedAt)
  }
  closeAllActivitiesNow(at)
  currentWindow = null
}

function exitIdle(now: number) {
  if (!isIdle) return
  isIdle = false
  if (sessionState === 'paused' && pausedByIdle) {
    totalPausedMs += now - (pausedAt ?? now)
    pausedAt = null
    pausedByIdle = false
    sessionState = 'running'
    exitPause(now)
  }
}

// Unique source de vérité pour isIdle, dans les deux sens. lastInputTime n'est rafraîchi que par
// de vrais signaux (clavier/souris via l'OS, changement d'appli) — donc le simple fait qu'une
// fenêtre garde le focus n'empêche pas l'inactivité de se déclencher, ni ne la fait sortir en boucle.
function checkIdleStatus() {
  const now = Date.now()
  const shouldBeIdle = now - lastInputTime > idleTimeoutMs
  if (shouldBeIdle && !isIdle) enterIdle(lastInputTime)
  else if (!shouldBeIdle && isIdle) exitIdle(now)
}

// Mise en veille / verrouillage de session : l'utilisateur est parti, on passe immédiatement en
// inactif (sinon le temps de veille était compté au réveil, faute de poll pendant la veille).
export function handleSystemAway() {
  const now = Date.now()
  if (currentOpenActivity) accumulateUntil(currentOpenActivity, now)
  enterIdle(now)
  // Le retour ne sera détecté que sur une nouvelle action réelle
  lastInputTime = now - idleTimeoutMs - 1
}

// Ouvre une nouvelle activité (nouvelle appli jamais vue récemment, ou grâce de 2 min expirée)
function openNewActivity(appName: string, windowTitle: string, startTime: number, isBoundarySplit = false): OpenActivity {
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
  // (une simple découpe à une borne de session n'est pas un changement d'appli)
  if (!isBoundarySplit) {
    recordSwitch()
    if (!isBlockingActive()) {
      maybeNudgeDistraction()
    }
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
// La durée enregistrée est le temps réellement accumulé : l'ancien plancher de 5 s gonflait chaque
// passage éclair sur une appli (et donc le temps facturable). Une activité restée sous la seconde
// (ex : découpe pile à une borne de session) est simplement supprimée.
function finalizeActivity(activity: OpenActivity, endTime: number) {
  const db = getDatabase()
  if (activity.accumulatedSeconds < 1) {
    db.prepare('DELETE FROM activities WHERE id = ?').run(activity.id)
    return
  }
  const durationSeconds = Math.floor(activity.accumulatedSeconds)
  const stmt = db.prepare('UPDATE activities SET end_time = ?, duration_seconds = ?, window_title = ? WHERE id = ?')
  stmt.run(endTime, durationSeconds, activity.windowTitle, activity.id)
}

export function updateLastInputTime() {
  lastInputTime = Date.now()
}

export function getCurrentWorkSessionId(): number | null {
  return currentWorkSessionId
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

// Coupe l'activité en cours à une borne de session (démarrage, pause, reprise, arrêt) : la partie
// avant la borne est close, et une nouvelle activité repart à `reopenAt` avec le statut facturable
// du nouvel état. Sans ça, une activité ouverte continuait d'accumuler du temps (facturable) pendant
// les pauses et après l'arrêt, et le temps d'une activité commencée avant le démarrage était perdu.
// Les activités en délai de grâce sont closes aussi, pour qu'un retour dessus ne traverse pas la borne.
function splitActivitiesAtBoundary(now: number, reopenAt: number = now) {
  for (const activity of backgroundedActivities.values()) {
    finalizeActivity(activity, activity.backgroundedAt ?? now)
  }
  backgroundedActivities.clear()

  if (!currentOpenActivity || isIdle) return
  const { appName, windowTitle } = currentOpenActivity
  accumulateUntil(currentOpenActivity, now)
  finalizeActivity(currentOpenActivity, now)
  currentOpenActivity = openNewActivity(appName, windowTitle, reopenAt, true)
}

// Démarre une nouvelle session de suivi (repart de zéro)
// Map to track project detection per work session
const workSessionDetectionMap = new Map<number, { interval: NodeJS.Timeout; detected: boolean }>()

export function startSession() {
  // Une seule session à la fois : un second démarrage (double clic, fenêtre/tray pas encore à jour)
  // créait une session de plus sans clore la première, et le temps était compté deux fois.
  if (sessionState !== 'stopped') return
  const now = Date.now()
  sessionState = 'running'
  currentSessionStartTime = now
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
  splitActivitiesAtBoundary(now)

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
  splitActivitiesAtBoundary(pausedAt)
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
  splitActivitiesAtBoundary(now)
}

// Start continuous project detection for work sessions
function startWorkSessionDetection(workSessionId: number) {
  // Only start detection if no project is already assigned
  if (currentProjectId) {
    debugLog(`[WorkSessionDetection] Session ${workSessionId}: Project already assigned, skipping detection`)
    return
  }

  const interval = setInterval(async () => {
    try {
      const state = workSessionDetectionMap.get(workSessionId)
      // Stop if already detected or session was removed
      if (!state || state.detected || currentProjectId) return

      const windowInfo = await getActiveWindowInfo()
      if (windowInfo) {
        debugLog(`[WorkSessionDetection] Session ${workSessionId}: Scanning - App: "${windowInfo.appName}", Window: "${windowInfo.windowTitle}"`)
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
            // Projet verrouillé : plus besoin d'interroger la fenêtre active toutes les 5 s
            clearInterval(currentState.interval)
          }
          debugLog(`[WorkSessionDetection] Session ${workSessionId}: ✓ LOCKED - Project ${match.projectId}${match.phaseId ? `, Phase ${match.phaseId}` : ' (no phase)'}`)
        }
      }
    } catch (detectError) {
      console.warn(`[WorkSessionDetection] Warning in session ${workSessionId}:`, detectError)
    }
  }, 5000) // Check every 5 seconds

  workSessionDetectionMap.set(workSessionId, { interval, detected: false })
  debugLog(`[WorkSessionDetection] Started detection for session ${workSessionId}`)
}

// Stop work session detection when manually assigning project (user override)
export function stopWorkSessionDetection(workSessionId: number) {
  const state = workSessionDetectionMap.get(workSessionId)
  if (state) {
    clearInterval(state.interval)
    workSessionDetectionMap.delete(workSessionId)
    debugLog(`[WorkSessionDetection] Stopped detection for session ${workSessionId}`)
  }
}

// Arrête complètement la session en cours (le prochain démarrage repartira à zéro).
// Ne coupe pas le suivi général des activités : celui-ci continue en arrière-plan comme toujours.
export function stopSession() {
  if (sessionState === 'stopped') return
  // Stop work session detection before finalizing
  if (currentWorkSessionId) {
    stopWorkSessionDetection(currentWorkSessionId)
  }
  const now = Date.now()
  finalizeCurrentWorkSession(now)
  sessionState = 'stopped'
  currentSessionStartTime = null
  pausedAt = null
  pausedByIdle = false
  totalPausedMs = 0
  sessionBillableOverride = null
  currentCategoryOverrides = {}
  currentProjectId = null
  currentPhaseId = null
  // La suite repart 1 ms après la fin de session (et avec les règles hors session) : les totaux
  // incluent les activités dont start_time <= end_time, la partie après l'arrêt n'en fait pas partie.
  splitActivitiesAtBoundary(now, now + 1)
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
