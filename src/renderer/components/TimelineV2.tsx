import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { Activity, Category, WorkSession } from '../../shared/types'
import { computeDeepWorkSessions } from '../../shared/deepwork'
import { DESIGN } from '../../shared/design'
import { Icon } from './UI'
import { useTranslation, localeTag, type Language } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface TimelineV2Props {
  activities: Activity[]
  categories: Category[]
  onUpdate?: () => void
  // Jour affiché (minuit local, en ms) et son setter — contrôlé par le parent (Dashboard) pour que
  // ses propres stats restent synchronisées avec le jour actuellement visible dans la Timeline.
  dayStart: number
  onDayChange: (dayStart: number) => void
}

export function getTodayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const DAY_MS_MODULE = 24 * 60 * 60 * 1000

// Partagé avec le Dashboard : les deux doivent utiliser exactement le même libellé pour que
// l'encart de stats reste clairement identifiable comme portant sur le même jour que la Timeline.
export function formatDayLabel(ms: number, t: (key: string, defaultValue?: string) => string, language: Language): string {
  if (ms === getTodayStart()) return t('timeline.today', "Aujourd'hui")
  if (ms === getTodayStart() - DAY_MS_MODULE) return t('timeline.yesterday', 'Hier')
  return new Date(ms).toLocaleDateString(localeTag(language), { weekday: 'long', day: 'numeric', month: 'long' })
}

const DAY_MS = 24 * 60 * 60 * 1000
const UNCATEGORIZED_COLOR = '#9ca3af'
const VIEW_W = 1000
const VIEW_H = 250

// Bandes verticales
const APPS_TOP = 0
const APPS_BASE = 108
const APPS_MAX_HEIGHT = 100

const LIVE_BAND_TOP = APPS_BASE + 2
const LIVE_BAND_H = 14

const ECG_BASE = 180
const ECG_MAX_LIFT = 34

const SESSIONS_TOP = 212
const SESSIONS_H = 24

const MIN_HOURS_VISIBLE = 0.25
const MAX_HOURS_VISIBLE = 24

const PRESETS = [4, 8, 12, 24] as const

function pickHourStep(hoursVisible: number): number {
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 4, 6, 12, 24]
  const target = hoursVisible / 6
  return steps.reduce((best, step) => (Math.abs(step - target) < Math.abs(best - target) ? step : best))
}

function computePresetView(hours: number): { start: number; hours: number } {
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60
  if (hours >= 24) return { start: 0, hours: 24 }
  // Centre la fenêtre visible sur l'heure actuelle
  const start = Math.min(24 - hours, Math.max(0, nowHour - hours / 2))
  return { start, hours }
}

function TimelineV2({ activities, categories, onUpdate, dayStart, onDayChange }: TimelineV2Props) {
  const { t, language } = useTranslation()
  const [hovered, setHovered] = useState<Activity | null>(null)
  const [hoveredSession, setHoveredSession] = useState<number | null>(null)
  const [updatingSession, setUpdatingSession] = useState<number | null>(null)
  const initialView = useMemo(() => computePresetView(4), [])
  const [viewStart, setViewStart] = useState(initialView.start)
  const [hoursVisible, setHoursVisible] = useState(initialView.hours)
  const [activePreset, setActivePreset] = useState<number | null>(4)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragState = useRef<{ startX: number; startViewStart: number } | null>(null)
  const animFrame = useRef<number | null>(null)
  const viewStateRef = useRef({ viewStart, hoursVisible })

  const isViewingToday = dayStart >= getTodayStart()
  // En changeant de jour, on repasse sur la vue 24h : sinon le zoom/pan reste calé sur la plage
  // horaire du jour précédent (ex : "10h30-14h" aujourd'hui), et si le jour visé n'a eu de
  // l'activité qu'à d'autres heures (le soir, par ex.), le graphique paraît vide à tort.
  const goToPreviousDay = () => {
    onDayChange(dayStart - DAY_MS)
    selectPreset(24)
  }
  const goToNextDay = () => {
    if (isViewingToday) return
    onDayChange(Math.min(dayStart + DAY_MS, getTodayStart()))
    selectPreset(24)
  }
  const goToToday = () => {
    onDayChange(getTodayStart())
    selectPreset(24)
  }

  /* ---------- Statut de la session live (start/pause/stop) ---------- */
  const [liveStatus, setLiveStatus] = useState<{
    sessionState: 'stopped' | 'running' | 'paused'
    sessionStartTime: number | null
  } | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  // Sessions de travail persistées (entités réelles en base, comptabilisables et facturables)
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [hoveredWorkSession, setHoveredWorkSession] = useState<number | null>(null)
  const [updatingWorkSession, setUpdatingWorkSession] = useState<number | null>(null)

  // Pauses de toutes les sessions du jour (live et passées) — utilisé à la fois par la courbe de flow
  // et par l'affichage des segments de pause sur la timeline, pour que l'historique reste visible
  // même une fois la session terminée (et pas seulement pendant qu'elle est en cours).
  const [dayPauses, setDayPauses] = useState<{ id: number; start_time: number; end_time: number | null }[]>([])

  const fetchWorkSessions = useCallback(async () => {
    try {
      // Fenêtre large (pas juste "aujourd'hui") pour que la navigation vers les jours précédents
      // ait des données à afficher sans repartir chercher côté serveur à chaque clic.
      const data: WorkSession[] = await window.electron.ipc.invoke('get-sessions', 30)
      setWorkSessions(data)
    } catch (error) {
      console.error('Error fetching work sessions:', error)
    }
  }, [])

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await window.electron.ipc.invoke('get-tracking-status')
        setLiveStatus(data)
      } catch (error) {
        console.error('Error fetching live status:', error)
      }
    }
    const fetchDayPauses = async () => {
      try {
        const data = await window.electron.ipc.invoke('get-pauses-in-range', dayStart, dayStart + DAY_MS)
        setDayPauses(data || [])
      } catch (error) {
        console.error('Error fetching day pauses:', error)
      }
    }
    fetchLive()
    fetchWorkSessions()
    fetchDayPauses()
    const interval = setInterval(() => {
      fetchLive()
      fetchWorkSessions()
      fetchDayPauses()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchWorkSessions, dayStart])

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  // Reste centré sur l'heure actuelle tant que l'utilisateur n'a pas zoomé/glissé manuellement
  useEffect(() => {
    if (activePreset === null) return
    const { start } = computePresetView(activePreset)
    setViewStart(start)
  }, [activePreset])

  const animateTo = useCallback((targetStart: number, targetHours: number) => {
    if (animFrame.current) cancelAnimationFrame(animFrame.current)
    const { viewStart: fromStart, hoursVisible: fromHours } = viewStateRef.current
    const startTime = performance.now()
    const duration = 260
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = easeOutCubic(t)
      setViewStart(fromStart + (targetStart - fromStart) * eased)
      setHoursVisible(fromHours + (targetHours - fromHours) * eased)
      if (t < 1) {
        animFrame.current = requestAnimationFrame(step)
      } else {
        animFrame.current = null
      }
    }
    animFrame.current = requestAnimationFrame(step)
  }, [])

  useEffect(() => {
    viewStateRef.current = { viewStart, hoursVisible }
  }, [viewStart, hoursVisible])

  useEffect(() => {
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [])

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((cat) => map.set(cat.id, cat))
    return map
  }, [categories])

  const nowMs = nowTick

  const todaysActivities = useMemo(() => {
    return activities
      .filter((a) => a.start_time >= dayStart && a.start_time < dayStart + DAY_MS)
      .sort((a, b) => a.start_time - b.start_time)
  }, [activities, dayStart])

  const windowStartMs = dayStart + viewStart * 60 * 60 * 1000
  const windowMs = hoursVisible * 60 * 60 * 1000
  const timeToX = useCallback((ms: number) => ((ms - windowStartMs) / windowMs) * VIEW_W, [windowStartMs, windowMs])

  const clampX = (x: number) => Math.min(VIEW_W, Math.max(0, x))

  /* ---------- Bande 1 : logiciels / sessions (barres) ---------- */
  const appBars = useMemo(() => {
    const maxDuration = Math.max(...todaysActivities.map((a) => a.duration_seconds), 1)
    return todaysActivities.map((activity) => {
      const category = activity.category_id ? categoryMap.get(activity.category_id) : null
      const color = category?.color || UNCATEGORIZED_COLOR
      const x = timeToX(activity.start_time)
      const width = Math.max(timeToX(activity.start_time + activity.duration_seconds * 1000) - x, 3)
      const heightRatio = Math.min(activity.duration_seconds / Math.max(maxDuration, 30 * 60), 1)
      const height = 6 + heightRatio * APPS_MAX_HEIGHT
      return { activity, x, width, height, color, y: APPS_BASE - height }
    })
  }, [todaysActivities, categoryMap, timeToX])

  /* ---------- Bande 2 : courbe de flow — échantillonnage temporel continu, x toujours croissant ---------- */
  // Toutes les 2 minutes, on regarde si on est en train de "focus" (dans une activité, catégorie non-distraction,
  // hors pause de session) : la hauteur monte tant que ce focus est ininterrompu, et retombe en douceur (pas un
  // mur vertical) dès qu'il y a une pause, une appli distraction ou un trou d'inactivité entre deux activités.
  const FLOW_SAMPLE_MS = 2 * 60 * 1000
  const FLOW_STREAK_CAP_MS = 12 * 60 * 1000
  const FLOW_DECAY = 0.6

  const isTimeInPause = useCallback(
    (t: number) => dayPauses.some((p) => t >= p.start_time && t < (p.end_time ?? nowTick)),
    [dayPauses, nowTick]
  )

  // Sessions triées par début, avec leurs surcharges de catégories parsées une seule fois
  const sessionsWithOverrides = useMemo(() => {
    return workSessions
      .map((s) => {
        let overrides: Record<number, 'focus' | 'distraction'> = {}
        if (s.category_overrides) {
          try {
            overrides = JSON.parse(s.category_overrides)
          } catch {
            overrides = {}
          }
        }
        return { start: s.start_time, end: s.end_time ?? nowTick, overrides }
      })
      .sort((a, b) => a.start - b.start)
  }, [workSessions, nowTick])

  const findSessionOverridesAt = useCallback(
    (t: number) => sessionsWithOverrides.find((s) => t >= s.start && t <= s.end)?.overrides ?? null,
    [sessionsWithOverrides]
  )

  const flowSamples = useMemo(() => {
    const sorted = [...todaysActivities].sort((a, b) => a.start_time - b.start_time)
    let cursor = 0
    const findActivityAt = (t: number) => {
      // avance le curseur tant que l'activité courante est terminée avant t (les activités sont triées par début)
      while (cursor < sorted.length - 1 && sorted[cursor].start_time + sorted[cursor].duration_seconds * 1000 < t && sorted[cursor + 1].start_time <= t) {
        cursor++
      }
      const a = sorted[cursor]
      if (!a) return null
      if (t >= a.start_time && t <= a.start_time + a.duration_seconds * 1000) return a
      return null
    }

    const points: { t: number; y: number }[] = []
    let streakMs = 0
    const endT = Math.min(nowMs, dayStart + DAY_MS)
    for (let t = dayStart; t <= endT; t += FLOW_SAMPLE_MS) {
      const activity = findActivityAt(t)
      const category = activity?.category_id ? categoryMap.get(activity.category_id) : null
      const globalDistraction = !!category?.is_distraction
      // La surcharge de la session couvrant cet instant prime sur la règle globale de la catégorie
      const sessionOverrides = activity?.category_id ? findSessionOverridesAt(t) : null
      const override = sessionOverrides && activity?.category_id ? sessionOverrides[activity.category_id] : undefined
      const distraction = override === 'distraction' ? true : override === 'focus' ? false : globalDistraction
      const paused = isTimeInPause(t)
      const focused = !!activity && !distraction && !paused

      if (focused) {
        streakMs = Math.min(streakMs + FLOW_SAMPLE_MS, FLOW_STREAK_CAP_MS)
      } else {
        streakMs *= FLOW_DECAY
        if (streakMs < 1000) streakMs = 0
      }

      const ratio = streakMs / FLOW_STREAK_CAP_MS
      points.push({ t, y: ECG_BASE - ratio * ECG_MAX_LIFT })
    }
    return points
  }, [todaysActivities, categoryMap, isTimeInPause, findSessionOverridesAt, dayStart, nowMs])

  const nowY = flowSamples.length > 0 ? flowSamples[flowSamples.length - 1].y : ECG_BASE

  const ecgPathD = useMemo(() => {
    const nowX = clampX(timeToX(nowMs))
    if (flowSamples.length === 0) {
      return `M 0 ${ECG_BASE} L ${VIEW_W} ${ECG_BASE}`
    }
    // Coordonnées non-clampées ici : le SVG (viewBox + overflow hidden) coupe déjà naturellement
    // tout ce qui sort du cadre visible. Clamper chaque point le déformerait au lieu de le couper
    // (tous les points hors-champ s'écrasaient sur le bord gauche, créant un amas au lieu d'une courbe).
    let d = `M ${timeToX(flowSamples[0].t)} ${flowSamples[0].y}`
    for (let i = 1; i < flowSamples.length; i++) {
      d += ` L ${timeToX(flowSamples[i].t)} ${flowSamples[i].y}`
    }
    // redescend à la baseline à l'instant présent, puis plat pour le futur (inconnu) jusqu'au bord droit visible
    d += ` L ${nowX} ${flowSamples[flowSamples.length - 1].y}`
    d += ` L ${nowX} ${ECG_BASE}`
    d += ` L ${VIEW_W} ${ECG_BASE}`
    return d
  }, [flowSamples, timeToX, nowMs])

  /* ---------- Barres translucides des sessions de travail (entités persistées) ---------- */
  const workSessionBars = useMemo(() => {
    return workSessions
      .filter((s) => s.start_time >= dayStart && s.start_time < dayStart + DAY_MS)
      .map((s) => {
        const isOpen = s.end_time === null
        const x = clampX(timeToX(s.start_time))
        const xEnd = clampX(timeToX(isOpen ? nowTick : (s.end_time as number)))
        const isPaused = isOpen && liveStatus?.sessionState === 'paused'
        return {
          session: s,
          x,
          width: Math.max(xEnd - x, 2),
          isLive: isOpen,
          isPaused,
          billable: !!s.billable,
        }
      })
  }, [workSessions, timeToX, nowTick, dayStart, liveStatus])

  /* ---------- Segments de pause différenciés, superposés sur la barre de chaque session (live ou passée) ---------- */
  const pauseSegments = useMemo(() => {
    return dayPauses.map((p) => {
      const x = clampX(timeToX(p.start_time))
      const xEnd = clampX(timeToX(p.end_time ?? nowTick))
      return { id: p.id, x, width: Math.max(xEnd - x, 2), isOngoing: p.end_time === null }
    })
  }, [dayPauses, timeToX, nowTick])

  const handleToggleWorkSessionBillable = async (bar: (typeof workSessionBars)[number]) => {
    setUpdatingWorkSession(bar.session.id)
    try {
      await window.electron.ipc.invoke('update-session-billable', bar.session.id, !bar.billable)
      await fetchWorkSessions()
      onUpdate?.()
    } catch (error) {
      console.error('Error toggling work session billable:', error)
    } finally {
      setUpdatingWorkSession(null)
    }
  }

  const currentX = useMemo(() => timeToX(nowMs), [timeToX, nowMs])
  const isNowVisible = currentX >= 0 && currentX <= VIEW_W

  /* ---------- Bande 3 : sessions actives (deep work) ---------- */
  const activityById = useMemo(() => {
    const map = new Map<number, Activity>()
    todaysActivities.forEach((a) => map.set(a.id, a))
    return map
  }, [todaysActivities])

  const sessionBands = useMemo(() => {
    return computeDeepWorkSessions(todaysActivities).map((session, idx) => {
      const category = categoryMap.get(session.category_id)
      const color = category?.color || DESIGN.colors.primary
      const x = timeToX(session.start_time)
      const width = Math.max(timeToX(session.end_time) - x, 2)
      const firstActivity = activityById.get(session.activity_ids[0])
      const billable = !!firstActivity?.billable
      return { id: idx, x, width, color, duration: session.duration_seconds, activityIds: session.activity_ids, billable }
    })
  }, [todaysActivities, timeToX, categoryMap, activityById])

  const handleToggleSessionBillable = async (band: (typeof sessionBands)[number]) => {
    setUpdatingSession(band.id)
    try {
      await window.electron.ipc.invoke('update-activities-billable', band.activityIds, !band.billable)
      onUpdate?.()
    } catch (error) {
      console.error('Error updating session billable status:', error)
    } finally {
      setUpdatingSession(null)
    }
  }

  const hourStep = pickHourStep(hoursVisible)
  const hourMarkers = useMemo(() => {
    const markers: number[] = []
    const start = Math.ceil(viewStart / hourStep) * hourStep
    for (let h = start; h <= viewStart + hoursVisible; h += hourStep) {
      markers.push(Math.round(h * 100) / 100)
    }
    return markers
  }, [viewStart, hoursVisible, hourStep])

  const clampView = useCallback((newStart: number, newHoursVisible: number) => {
    const clampedHours = Math.min(MAX_HOURS_VISIBLE, Math.max(MIN_HOURS_VISIBLE, newHoursVisible))
    const clampedStart = Math.min(24 - clampedHours, Math.max(0, newStart))
    return { start: clampedStart, hours: clampedHours }
  }, [])

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = (e.clientX - rect.left) / rect.width
    const hourUnderCursor = viewStart + ratio * hoursVisible
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8
    const newHoursVisible = hoursVisible * zoomFactor
    const newStart = hourUnderCursor - ratio * newHoursVisible
    const { start, hours } = clampView(newStart, newHoursVisible)
    setActivePreset(null)
    animateTo(start, hours)
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (animFrame.current) {
      cancelAnimationFrame(animFrame.current)
      animFrame.current = null
    }
    setActivePreset(null)
    dragState.current = { startX: e.clientX, startViewStart: viewStart }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.current) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const deltaX = e.clientX - dragState.current.startX
    const deltaHours = -(deltaX / rect.width) * hoursVisible
    const { start } = clampView(dragState.current.startViewStart + deltaHours, hoursVisible)
    setViewStart(start)
  }

  const stopDrag = () => {
    dragState.current = null
  }

  const selectPreset = (hours: number) => {
    const { start } = computePresetView(hours)
    setActivePreset(hours)
    animateTo(start, hours)
  }

  const formatTime = (ms: number) => new Date(ms).toLocaleTimeString(localeTag(language), { hour: '2-digit', minute: '2-digit' })
  const formatHourLabel = (h: number) => {
    const hh = Math.floor(h) % 24
    const mm = Math.round((h % 1) * 60)
    return mm === 0 ? `${hh}h` : `${hh}h${mm.toString().padStart(2, '0')}`
  }
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Icon name="chart-line" size={20} className="accent-text" />
            <span className="accent-gradient-text">{t('timeline.yourFlow', 'Ton flow')}</span>
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousDay}
              title={t('timeline.previousDay', 'Jour précédent')}
              className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-slate-300 min-w-[7rem] text-center capitalize">{formatDayLabel(dayStart, t, language)}</span>
            <button
              onClick={goToNextDay}
              disabled={isViewingToday}
              title={t('timeline.nextDay', 'Jour suivant')}
              className="p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {!isViewingToday && (
              <button
                onClick={goToToday}
                className="ml-1 text-xs px-2.5 py-1 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                {t('timeline.today', "Aujourd'hui")}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-full p-1">
          {PRESETS.map((hours) => (
            <button
              key={hours}
              onClick={() => selectPreset(hours)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                activePreset === hours
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              {hours}h
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="relative">
          <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-72 cursor-grab active:cursor-grabbing"
          style={{ overflow: 'hidden' }}
          preserveAspectRatio="none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          <defs>
            <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={DESIGN.colors.primary} stopOpacity="1" />
              <stop offset="100%" stopColor={DESIGN.colors.secondary} stopOpacity="1" />
            </linearGradient>

            {/* Comète lumineuse qui parcourt la ligne ECG */}
            <linearGradient id="pulseComet" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="45%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.95" />
              <stop offset="55%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>

            <mask id="pulseMask">
              <rect x={-VIEW_W} y={0} width={VIEW_W * 3} height={VIEW_H} fill="url(#pulseComet)">
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from="0 0"
                  to={`${VIEW_W * 2} 0`}
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              </rect>
            </mask>
          </defs>

          {/* Grille horaire (toute hauteur) */}
          {hourMarkers.map((h) => (
            <line
              key={h}
              x1={timeToX(dayStart + h * 60 * 60 * 1000)}
              y1={APPS_TOP}
              x2={timeToX(dayStart + h * 60 * 60 * 1000)}
              y2={SESSIONS_TOP + SESSIONS_H}
              stroke="currentColor"
              strokeWidth={1}
              className="text-gray-100 dark:text-slate-700"
            />
          ))}

          {/* ---- Bande 1 : logiciels / sessions ---- */}
          {appBars.map((bar) => (
            <rect
              key={bar.activity.id}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={Math.min(4, bar.width / 2)}
              ry={4}
              fill={bar.color}
              opacity={hovered?.id === bar.activity.id ? 1 : 0.75}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHovered(bar.activity)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <line x1={0} y1={APPS_BASE} x2={VIEW_W} y2={APPS_BASE} stroke="currentColor" strokeWidth={1} className="text-gray-200 dark:text-slate-600" />

          {/* Barres des sessions de travail : entités persistées, cliquables pour marquer facturable */}
          {workSessionBars.map((bar) => (
            <rect
              key={bar.session.id}
              x={bar.x}
              y={LIVE_BAND_TOP}
              width={bar.width}
              height={LIVE_BAND_H}
              rx={6}
              ry={6}
              fill={DESIGN.colors.primary}
              opacity={
                updatingWorkSession === bar.session.id
                  ? 0.2
                  : bar.billable
                  ? 0.9
                  : bar.isLive
                  ? bar.isPaused
                    ? 0.25
                    : 0.45
                  : 0.3
              }
              stroke={bar.billable ? 'white' : 'none'}
              strokeWidth={bar.billable ? 1 : 0}
              className={`cursor-pointer transition-opacity ${bar.isLive && !bar.isPaused ? 'animate-pulse' : ''}`}
              onClick={() => handleToggleWorkSessionBillable(bar)}
              onMouseEnter={() => setHoveredWorkSession(bar.session.id)}
              onMouseLeave={() => setHoveredWorkSession(null)}
            />
          ))}

          {/* Segments de pause (couleur différenciée) superposés sur la barre de la session live */}
          {pauseSegments.map((seg) => (
            <rect
              key={`pause-${seg.id}`}
              x={seg.x}
              y={LIVE_BAND_TOP}
              width={seg.width}
              height={LIVE_BAND_H}
              rx={4}
              ry={4}
              fill="#f59e0b"
              opacity={seg.isOngoing ? 0.95 : 0.8}
              className={seg.isOngoing ? 'animate-pulse' : ''}
              pointerEvents="none"
            />
          ))}

          {/* ---- Bande 2 : ligne ECG continue et pulsante ---- */}
          <line x1={0} y1={ECG_BASE} x2={VIEW_W} y2={ECG_BASE} stroke="currentColor" strokeWidth={1} className="text-gray-200 dark:text-slate-600" strokeDasharray="4,4" />

          {/* Trace de base, toujours visible */}
          <path d={ecgPathD} fill="none" stroke="url(#ecgGradient)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.55} />

          {/* Comète lumineuse qui parcourt la ligne (effet pulsation) */}
          <path
            d={ecgPathD}
            fill="none"
            stroke="url(#ecgGradient)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            mask="url(#pulseMask)"
          />

          {/* Repère "maintenant" (ligne uniquement — le point est rendu en HTML pour rester parfaitement rond) */}
          {isNowVisible && (
            <line x1={currentX} y1={APPS_TOP} x2={currentX} y2={SESSIONS_TOP + SESSIONS_H} stroke="currentColor" strokeWidth={1.5} className="text-indigo-500" strokeDasharray="3,3" opacity={0.6} />
          )}

          {/* ---- Bande 3 : sessions actives (cliquer pour marquer facturable) ---- */}
          <rect x={0} y={SESSIONS_TOP} width={VIEW_W} height={SESSIONS_H} rx={8} ry={8} className="fill-gray-100 dark:fill-slate-800" />
          {sessionBands.map((band) => (
            <g key={band.id}>
              <rect
                x={band.x}
                y={SESSIONS_TOP}
                width={band.width}
                height={SESSIONS_H}
                rx={8}
                ry={8}
                fill={band.color}
                opacity={updatingSession === band.id ? 0.4 : band.billable ? 0.95 : 0.35}
                stroke={band.billable ? 'white' : band.color}
                strokeWidth={band.billable ? 1.5 : 1}
                strokeDasharray={band.billable ? undefined : '3,2'}
                className="cursor-pointer transition-opacity"
                onClick={() => handleToggleSessionBillable(band)}
                onMouseEnter={() => setHoveredSession(band.id)}
                onMouseLeave={() => setHoveredSession(null)}
              />
              {band.billable && band.width > 20 && (
                <text
                  x={band.x + band.width / 2}
                  y={SESSIONS_TOP + SESSIONS_H / 2 + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="white"
                  pointerEvents="none"
                >
                  $
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Point "maintenant" en HTML pur — reste parfaitement rond quel que soit l'étirement du SVG */}
        {isNowVisible && (
          <div
            className="absolute pointer-events-none transition-[top] duration-700 ease-out"
            style={{
              left: `${(currentX / VIEW_W) * 100}%`,
              top: `${(nowY / VIEW_H) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ width: 10, height: 10, backgroundColor: 'var(--accent-primary)' }}
            />
            <span className="relative block rounded-full" style={{ width: 10, height: 10, backgroundColor: 'var(--accent-primary)' }} />
          </div>
        )}
        </div>

        {/* Labels heures */}
        <div className="relative h-4 -mt-1 text-xs text-gray-500 dark:text-slate-400">
          {hourMarkers.map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(timeToX(dayStart + h * 60 * 60 * 1000) / VIEW_W) * 100}%` }}>
              {formatHourLabel(h)}
            </span>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 flex items-center gap-1">
          {t('timeline.hint', 'Molette pour zoomer, glisser pour naviguer • Clique sur une session pour la marquer facturable')}
          <Icon name="briefcase" size={12} className="inline" />
        </p>

        {/* Tooltip session de travail */}
        {hoveredWorkSession !== null && (
          <div className="mt-3 flex items-center gap-3 text-sm bg-gradient-to-r from-gray-900 to-gray-800 dark:from-slate-950 dark:to-slate-900 rounded-lg p-3 border border-gray-700 dark:border-slate-700 shadow-lg">
            {(() => {
              const bar = workSessionBars.find((b) => b.session.id === hoveredWorkSession)
              if (!bar) return null
              const durationSec = bar.isLive
                ? Math.floor((nowTick - bar.session.start_time) / 1000)
                : bar.session.duration_seconds
              return (
                <>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${bar.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-white font-medium">
                    {tf(
                      bar.isLive
                        ? t('timeline.sessionLiveOf', 'Session en cours de {{duration}}')
                        : t('timeline.sessionOf', 'Session de {{duration}}'),
                      { duration: formatDuration(durationSec) }
                    )}
                  </span>
                  <span className={`ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${bar.billable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                    <Icon name="briefcase" size={11} />
                    {bar.billable ? t('timeline.billable', 'Facturable') : t('timeline.notBillable', 'Non facturable')}
                  </span>
                </>
              )
            })()}
          </div>
        )}

        {/* Tooltip session active */}
        {hoveredSession !== null && (
          <div className="mt-3 flex items-center gap-3 text-sm bg-gradient-to-r from-gray-900 to-gray-800 dark:from-slate-950 dark:to-slate-900 rounded-lg p-3 border border-gray-700 dark:border-slate-700 shadow-lg">
            {(() => {
              const band = sessionBands.find((b) => b.id === hoveredSession)
              if (!band) return null
              return (
                <>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: band.color }} />
                  <span className="text-white font-medium">{tf(t('timeline.sessionOf', 'Session de {{duration}}'), { duration: formatDuration(band.duration) })}</span>
                  <span className={`ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${band.billable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                    <Icon name="briefcase" size={11} />
                    {band.billable ? t('timeline.billable', 'Facturable') : t('timeline.notBillable', 'Non facturable')}
                  </span>
                </>
              )
            })()}
          </div>
        )}

        {/* Tooltip */}
        {hovered && (
          <div className="mt-4 flex items-center gap-4 text-sm bg-gradient-to-r from-gray-900 to-gray-800 dark:from-slate-950 dark:to-slate-900 rounded-lg p-4 border border-gray-700 dark:border-slate-700 shadow-lg">
            <div
              className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white/20"
              style={{
                backgroundColor: hovered.category_id ? categoryMap.get(hovered.category_id)?.color || UNCATEGORIZED_COLOR : UNCATEGORIZED_COLOR,
              }}
            />
            <div className="flex-1">
              <p className="font-semibold text-white">{hovered.app_name}</p>
              <p className="text-gray-400 text-xs truncate">{hovered.window_title}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-gray-200 font-medium">{formatTime(hovered.start_time)}</p>
              <p className="text-gray-400 text-xs">{formatDuration(hovered.duration_seconds)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelineV2
