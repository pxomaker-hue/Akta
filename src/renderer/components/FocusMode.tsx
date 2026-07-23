import { useEffect, useRef, useState } from 'react'
import Mascot, { type MascotMood } from './Mascot'
import FocusHistory from './FocusHistory'
import FocusCoaching from './FocusCoaching'
import FocusChallenges from './FocusChallenges'
import { Icon, Card } from './UI'
import type { FocusSession } from '../../shared/types'

const QUICK_DURATIONS = [15, 25, 45, 90]

type FocusMode = 'simple' | 'chained'

interface FocusModeProps {
  onBack?: () => void
}

// Sons synthétisés à la volée (Web Audio API) : pas de fichier audio à embarquer, et volume/tonalité
// faciles à ajuster. Chaque échec est silencieux — un son manqué ne doit jamais casser le flux.
function playTone(freq: number, duration: number, delay = 0, volume = 0.16) {
  setTimeout(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
      osc.onended = () => ctx.close()
    } catch (error) {
      console.warn('Could not play sound:', error)
    }
  }, delay)
}

// Deux notes ascendantes discrètes : signale un changement de phase (session <-> pause)
function playTransitionChime() {
  playTone(659.25, 0.18) // E5
  playTone(783.99, 0.25, 150) // G5
}

// Petite fanfare à quatre notes : signale la fin complète d'une session (ou d'une chaîne)
function playCompletionChime() {
  playTone(523.25, 0.15) // C5
  playTone(659.25, 0.15, 130) // E5
  playTone(783.99, 0.3, 260) // G5
  playTone(1046.5, 0.45, 420) // C6
}

function notify(title: string, body: string) {
  window.electron.ipc.invoke('show-notification', title, body).catch((error) => {
    console.warn('Could not show notification:', error)
  })
}

function FocusMode({ onBack }: FocusModeProps) {
  // Mode selection
  const [focusMode, setFocusMode] = useState<FocusMode>('simple')

  // Simple mode
  const [duration, setDuration] = useState(25)

  // Chained mode (Pomodoro technique)
  const [numSessions, setNumSessions] = useState(4)
  const [sessionDuration, setSessionDuration] = useState(25)
  const [pauseDuration, setPauseDuration] = useState(5)
  const [longPauseDuration, setLongPauseDuration] = useState(15)

  const [blockedApps, setBlockedApps] = useState<string[]>([])
  const [newBlockedApp, setNewBlockedApp] = useState('')
  const [current, setCurrent] = useState<FocusSession | null>(null)
  const [timeLeft, setTimeLeft] = useState(duration * 60)
  const [justCompleted, setJustCompleted] = useState(false)
  const [phaseBump, setPhaseBump] = useState(false)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [busy, setBusy] = useState(false)
  const completingRef = useRef(false)
  const phaseKeyRef = useRef<string | null>(null)

  const isActive = !!current

  const loadCurrent = async () => {
    try {
      const session = await window.electron.ipc.invoke('get-current-focus-session')
      setCurrent(session)
      if (session) {
        setBlockedApps(JSON.parse(session.blocked_apps))
        setDuration(Math.round(session.planned_duration / 60))
      }
    } catch (error) {
      console.error('Error loading current focus session:', error)
    }
  }

  const loadHistory = async () => {
    try {
      // Fenêtre large (pas juste 7 jours) : l'historique doit pouvoir remonter loin, avec
      // pagination côté UI plutôt qu'un filtre serveur restrictif.
      const data = await window.electron.ipc.invoke('get-focus-sessions', 90)
      setSessions(data)
    } catch (error) {
      console.error('Error loading focus history:', error)
    }
  }

  useEffect(() => {
    loadCurrent()
    loadHistory()
  }, [])

  // Le process principal clôture lui-même une session arrivée à échéance (utile si cet onglet
  // n'était pas ouvert au moment T) et prévient déjà par notification OS — ici on se contente de
  // rafraîchir l'état local et de jouer le son, sans notifier une seconde fois.
  useEffect(() => {
    const handleAutoCompleted = () => {
      if (completingRef.current) return
      completingRef.current = true
      setCurrent(null)
      setJustCompleted(true)
      playCompletionChime()
      setTimeout(() => setJustCompleted(false), 4000)
      loadHistory()
    }

    // Handle session started from FocusCoaching recommendations
    const handleSessionStarted = (session: any) => {
      setCurrent(session)
      if (session.blocked_apps) {
        setBlockedApps(JSON.parse(session.blocked_apps))
      }
      completingRef.current = false
    }

    window.electron.ipc.on('focus-session-completed', handleAutoCompleted)
    window.electron.ipc.on('focus-session-started', handleSessionStarted)
    return () => {
      window.electron.ipc.off('focus-session-completed', handleAutoCompleted)
      window.electron.ipc.off('focus-session-started', handleSessionStarted)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleComplete = async (sessionId: number) => {
    try {
      await window.electron.ipc.invoke('end-focus-session', sessionId)
    } finally {
      setCurrent(null)
      setJustCompleted(true)
      playCompletionChime()
      notify(
        'Akta — Session terminée !',
        focusMode === 'chained'
          ? `Bravo, tu as bouclé tes ${numSessions} sessions de concentration !`
          : 'Ta session de concentration est terminée, bien joué !'
      )
      setTimeout(() => setJustCompleted(false), 4000)
      await loadHistory()
    }
  }

  // Calcule l'état du Pomodoro (quelle session, pause ou focus)
  const calculatePomodoroState = (elapsedSeconds: number) => {
    let remaining = elapsedSeconds
    let sessionNum = 1
    let isBreak = false

    while (sessionNum <= numSessions) {
      if (remaining < sessionDuration * 60) {
        // On est dans une session focus
        return { sessionNum, isBreak: false, timeInPhase: remaining }
      }
      remaining -= sessionDuration * 60

      if (sessionNum < numSessions) {
        if (remaining < pauseDuration * 60) {
          // On est dans une pause
          return { sessionNum, isBreak: true, timeInPhase: remaining }
        }
        remaining -= pauseDuration * 60
      }
      sessionNum++
    }

    return { sessionNum: numSessions, isBreak: false, timeInPhase: sessionDuration * 60 }
  }

  // Décompte basé sur l'horloge réelle (le timer local ne se perd pas si on change d'onglet)
  useEffect(() => {
    if (!current) {
      setTimeLeft(focusMode === 'simple' ? duration * 60 : numSessions * sessionDuration * 60 + (numSessions - 1) * pauseDuration * 60)
      return
    }
    completingRef.current = false

    const tick = () => {
      try {
        // Always calculate from current.start_time to avoid drift
        const now = Date.now()
        const elapsedMs = now - current.start_time
        const elapsedSec = Math.floor(elapsedMs / 1000)
        const remaining = Math.max(current.planned_duration - elapsedSec, 0)

        setTimeLeft(remaining)

        // Only trigger completion once
        if (remaining <= 0 && !completingRef.current) {
          completingRef.current = true
          handleComplete(current.id)
        }
      } catch (error) {
        console.error('Timer tick error:', error)
      }
    }

    // Run immediately on mount, then every second
    tick()
    const interval = setInterval(tick, 1000)

    return () => clearInterval(interval)
  }, [current, focusMode, duration, numSessions, sessionDuration, pauseDuration])

  // Calcule l'état Pomodoro en temps réel
  const getPomodoroState = () => {
    if (!current || focusMode !== 'chained') return null
    const elapsed = Math.floor((Date.now() - current.start_time) / 1000)
    return calculatePomodoroState(elapsed)
  }

  const pomodoroState = getPomodoroState()

  // Détecte les transitions de phase (session -> pause, pause -> session) pour jouer un son et
  // notifier — sans se déclencher au tout premier rendu d'une session (ce n'est pas une transition).
  useEffect(() => {
    if (!isActive || focusMode !== 'chained' || !pomodoroState) {
      phaseKeyRef.current = null
      return
    }
    const key = `${pomodoroState.sessionNum}-${pomodoroState.isBreak}`
    if (phaseKeyRef.current === null) {
      phaseKeyRef.current = key
      return
    }
    if (phaseKeyRef.current !== key) {
      phaseKeyRef.current = key
      playTransitionChime()
      setPhaseBump(true)
      setTimeout(() => setPhaseBump(false), 400)
      notify(
        pomodoroState.isBreak ? 'Akta — Pause !' : 'Akta — Au travail !',
        pomodoroState.isBreak
          ? `Session ${pomodoroState.sessionNum}/${numSessions} terminée. Petite pause de ${pauseDuration} min.`
          : `Pause terminée, direction la session ${pomodoroState.sessionNum}/${numSessions} !`
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoroState?.sessionNum, pomodoroState?.isBreak, isActive, focusMode])

  // Temps restant dans la phase en cours (session ou pause) — c'est ce qu'on affiche en grand en
  // mode chaîné, pas le temps restant sur toute la chaîne, sinon le décompte de pause ne "descend" pas.
  const phaseDurationSec = pomodoroState ? (pomodoroState.isBreak ? pauseDuration * 60 : sessionDuration * 60) : 0
  const phaseTimeLeft = pomodoroState ? Math.max(phaseDurationSec - pomodoroState.timeInPhase, 0) : 0
  const displayTime = isActive && focusMode === 'chained' && pomodoroState ? phaseTimeLeft : timeLeft
  const completedSessions = pomodoroState ? (pomodoroState.isBreak ? pomodoroState.sessionNum : pomodoroState.sessionNum - 1) : 0
  const totalElapsedSec = current ? Math.max(current.planned_duration - timeLeft, 0) : 0

  const mascotMood: MascotMood = justCompleted ? 'celebrate' : isActive ? (pomodoroState?.isBreak ? 'sleepy' : 'focused') : 'neutral'
  const mascotMessage = justCompleted
    ? 'Session terminée !'
    : isActive && focusMode === 'chained' && pomodoroState
      ? pomodoroState.isBreak
        ? `Pause bien méritée! ${pomodoroState.sessionNum}/${numSessions}`
        : `Session ${pomodoroState.sessionNum}/${numSessions} - Reste concentré!`
      : isActive
        ? 'Reste concentré, tu gères'
        : undefined

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleAddBlockedApp = () => {
    const trimmed = newBlockedApp.trim()
    if (trimmed && !blockedApps.includes(trimmed)) {
      setBlockedApps([...blockedApps, trimmed])
    }
    setNewBlockedApp('')
  }

  const handleRemoveBlockedApp = (app: string) => {
    setBlockedApps(blockedApps.filter((a) => a !== app))
  }

  const handleStart = async () => {
    setBusy(true)
    try {
      let sessionDurationSec: number
      if (focusMode === 'simple') {
        sessionDurationSec = duration * 60
      } else {
        sessionDurationSec = numSessions * sessionDuration + (numSessions - 1) * pauseDuration
        sessionDurationSec = sessionDurationSec * 60
      }

      const session = await window.electron.ipc.invoke('start-focus-session', sessionDurationSec, blockedApps)

      // Set the session immediately without extra IPC call
      if (session) {
        setCurrent(session)
        setBlockedApps(blockedApps)
        completingRef.current = false
      } else {
        console.error('Failed to start focus session: no session returned')
      }
    } catch (error) {
      console.error('Error starting focus session:', error)
      alert('Erreur au démarrage de la session. Réessaye ?')
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    if (!current) return
    setBusy(true)
    try {
      await window.electron.ipc.invoke('end-focus-session', current.id)
      setCurrent(null)
      await loadHistory()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors mb-2"
            >
              <span aria-hidden>←</span>
              Retour au tableau de bord
            </button>
          )}
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <Icon name="target" size={22} className="accent-text flex-shrink-0" />
            <span className="accent-gradient-text">Mode focus</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Bloque les applis qui te distraient et reste concentré sur une durée définie.
          </p>
        </div>

        {/* Timer */}
        <div
          data-focus-timer
          className={`rounded-2xl p-10 mb-6 bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 flex items-center justify-center shadow-xl transition-all duration-300 ${
            phaseBump ? 'scale-105' : 'scale-100'
          } ${justCompleted ? 'ring-2 ring-green-400 ring-offset-4 dark:ring-offset-slate-900' : ''}`}
        >
          <div className="flex-1 text-center">
            {isActive && focusMode === 'chained' && pomodoroState && (
              <div className="mb-4">
                <span
                  key={`${pomodoroState.sessionNum}-${pomodoroState.isBreak}`}
                  className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold text-indigo-700 dark:text-indigo-200 animate-pop-in backdrop-blur-sm ${
                    pomodoroState.isBreak ? 'bg-white/30' : 'bg-white/25'
                  }`}
                >
                  {pomodoroState.isBreak ? '☕ PAUSE' : '🎯 FOCUS'} • Session {pomodoroState.sessionNum}/{numSessions}
                </span>
              </div>
            )}
            <div key={displayTime} className="text-8xl font-mono font-black text-white mb-3 tabular-nums tracking-tighter drop-shadow-lg">
              {formatTime(displayTime)}
            </div>
            <p className="text-white/90 text-base font-medium">
              {isActive
                ? focusMode === 'chained'
                  ? pomodoroState?.isBreak
                    ? `Détente • ${pauseDuration}m`
                    : `Concentration • ${sessionDuration}m`
                  : 'Temps restant'
                : 'Prêt à démarrer'}
            </p>
          </div>
          <Mascot mood={mascotMood} size={96} background="white" />
        </div>

        {/* Stats de la chaîne : sessions terminées, temps écoulé, temps total restant */}
        {isActive && focusMode === 'chained' && pomodoroState && (
          <div className="grid grid-cols-3 gap-3 mb-8 text-center">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg py-3">
              <p key={completedSessions} className="text-lg font-bold accent-text animate-pop-in">
                {completedSessions}/{numSessions}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">terminées</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg py-3">
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono tabular-nums">{formatTime(totalElapsedSec)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">écoulé au total</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg py-3">
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100 font-mono tabular-nums">{formatTime(timeLeft)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">restant au total</p>
            </div>
          </div>
        )}

        {mascotMessage && (
          <p className="text-center text-sm font-medium text-gray-600 dark:text-slate-400 -mt-4 mb-8">{mascotMessage}</p>
        )}

        {!isActive && (
          <div className="mb-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => setFocusMode('simple')}
              className={`p-4 rounded-lg font-medium transition-all duration-150 active:scale-[0.97] ${
                focusMode === 'simple'
                  ? 'accent-gradient-bg text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <Icon name="clock" size={16} />
                <span>Simple</span>
              </div>
              <p className="text-xs opacity-75 mt-1">Un timer unique</p>
            </button>
            <button
              onClick={() => setFocusMode('chained')}
              className={`p-4 rounded-lg font-medium transition-all duration-150 active:scale-[0.97] ${
                focusMode === 'chained'
                  ? 'accent-gradient-bg text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                <Icon name="refresh" size={16} />
                <span>Chaîné</span>
              </div>
              <p className="text-xs opacity-75 mt-1">Sessions + pauses</p>
            </button>
          </div>
        )}

        {/* Réglages : hauteur fixe partagée entre les deux modes, pour que passer de l'un à l'autre
            ne fasse pas sauter le reste de la page (bouton démarrer, encart apps bloquées, etc.) */}
        {!isActive && (
          <div className="mb-6 min-h-[180px] flex flex-col justify-center">
            {focusMode === 'simple' ? (
              <div key="simple" className="animate-fade-in-scale">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Durée de la session</label>
                <div className="flex gap-2">
                  {QUICK_DURATIONS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDuration(mins)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-90 ${
                        duration === mins
                          ? 'accent-gradient-bg text-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key="chained" className="space-y-6 border border-gray-200 dark:border-slate-700 rounded-lg p-4 animate-fade-in-scale">
                <div className="grid grid-cols-3 gap-4">
                  {/* Nombre de sessions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sessions</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNumSessions(Math.max(1, numSessions - 1))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        −
                      </button>
                      <span key={numSessions} className="text-xl font-bold text-center flex-1 animate-pop-in">
                        {numSessions}
                      </span>
                      <button
                        onClick={() => setNumSessions(Math.min(10, numSessions + 1))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Durée session focus */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Focus (min)</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSessionDuration(Math.max(5, sessionDuration - 5))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        −
                      </button>
                      <span key={sessionDuration} className="text-xl font-bold text-center flex-1 animate-pop-in">
                        {sessionDuration}
                      </span>
                      <button
                        onClick={() => setSessionDuration(Math.min(60, sessionDuration + 5))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Durée pause */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pause (min)</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPauseDuration(Math.max(1, pauseDuration - 1))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        −
                      </button>
                      <span key={pauseDuration} className="text-xl font-bold text-center flex-1 animate-pop-in">
                        {pauseDuration}
                      </span>
                      <button
                        onClick={() => setPauseDuration(Math.min(30, pauseDuration + 1))}
                        className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-transform duration-100 active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Résumé */}
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded p-3 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong>{numSessions} sessions</strong> de {sessionDuration}m
                    + <strong>{numSessions - 1} pauses</strong> de {pauseDuration}m
                    = <strong className="text-accent">{numSessions * sessionDuration + (numSessions - 1) * pauseDuration}m total</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Apps bloquées */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Apps à bloquer pendant la session</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newBlockedApp}
              onChange={(e) => setNewBlockedApp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBlockedApp()}
              placeholder="ex : Discord, Slack, Chrome"
              disabled={isActive}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:opacity-50"
            />
            <button
              onClick={handleAddBlockedApp}
              disabled={isActive || !newBlockedApp.trim()}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-95"
            >
              Ajouter
            </button>
          </div>

          {blockedApps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockedApps.map((app) => (
                <div
                  key={app}
                  className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm animate-pop-in"
                >
                  {app}
                  {!isActive && (
                    <button
                      onClick={() => handleRemoveBlockedApp(app)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contrôles */}
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={busy}
            className="w-full accent-gradient-bg hover:brightness-110 text-white font-bold py-4 px-6 rounded-xl transition-all duration-150 active:scale-[0.98] text-lg disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Icon name="play" size={20} />
            Démarrer la session focus
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={busy}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-150 active:scale-[0.98] text-lg disabled:opacity-50 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Icon name="stop-circle" size={20} />
            Arrêter
          </button>
        )}

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Note :</strong> pendant le mode focus, les apps bloquées sont automatiquement minimisées dès qu'elles passent au premier plan.
          </p>
        </div>
      </Card>

      <FocusHistory sessions={sessions} onDelete={loadHistory} />

      <FocusCoaching />

      <FocusChallenges />
    </div>
  )
}

export default FocusMode
