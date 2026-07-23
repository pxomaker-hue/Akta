import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { MascotMood } from '../components/Mascot'
import type { Category, Project } from '../../shared/types'

type SessionState = 'stopped' | 'running' | 'paused'
type CategoryOverride = 'focus' | 'distraction'

interface TrackingStatus {
  isIdle: boolean
  sessionState: SessionState
  sessionStartTime: number | null
  pausedMs: number
  currentApp: string | null
  billableOverride: boolean | null
  categoryOverrides: Record<number, CategoryOverride>
  projectId: number | null
  phaseId: number | null
}

interface LiveSessionValue {
  status: TrackingStatus | null
  elapsed: number
  busy: boolean
  categories: Category[]
  projects: Project[]
  setCategoryOverride: (categoryId: number, value: CategoryOverride | null) => Promise<void>
  setSessionProject: (projectId: number | null, phaseId: number | null) => Promise<void>
  runAction: (channel: string) => Promise<void>
  toggleBillable: (billable: boolean) => Promise<void>
  isRunning: boolean
  isPaused: boolean
  isStopped: boolean
  looksPaused: boolean
  mood: MascotMood
}

const LiveSessionContext = createContext<LiveSessionValue | null>(null)

// Centralise l'état de la session live (polling du statut, compteur local, catégories) en un seul
// endroit, pour que la mascotte (header) et la pill de contrôle (barre de nav) restent synchronisées
// sans dupliquer les appels IPC.
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TrackingStatus | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const tickRef = useRef<number | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await window.electron.ipc.invoke('get-categories')
        setCategories(data)
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()

    const fetchProjects = async () => {
      try {
        const data = await window.electron.ipc.invoke('get-projects')
        setProjects(data)
      } catch (error) {
        console.error('Error fetching projects:', error)
      }
    }
    fetchProjects()
  }, [])

  const setCategoryOverride = async (categoryId: number, value: CategoryOverride | null) => {
    if (!status) return
    const next = { ...status.categoryOverrides }
    if (value === null) delete next[categoryId]
    else next[categoryId] = value
    setBusy(true)
    try {
      const updated = await window.electron.ipc.invoke('set-session-category-overrides', next)
      setStatus(updated)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await window.electron.ipc.invoke('get-tracking-status')
        setStatus(data)
      } catch (error) {
        console.error('Error fetching tracking status:', error)
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)

    // Rafraîchit immédiatement si la session a été pilotée via le raccourci clavier global
    // (sinon il faudrait attendre jusqu'à 5s pour voir l'état à jour)
    window.electron.ipc.on('tracking-status-changed', fetchStatus)

    return () => {
      clearInterval(interval)
      window.electron.ipc.off('tracking-status-changed', fetchStatus)
    }
  }, [])

  // Fait tourner un compteur local fluide entre deux fetchs
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)

    if (status?.sessionState === 'running' && status.sessionStartTime) {
      const update = () =>
        setElapsed(Math.floor((Date.now() - (status.sessionStartTime as number) - status.pausedMs) / 1000))
      update()
      tickRef.current = window.setInterval(update, 1000)
    } else if (status?.sessionState === 'paused' && status.sessionStartTime) {
      setElapsed(Math.floor((Date.now() - status.sessionStartTime - status.pausedMs) / 1000))
    } else {
      setElapsed(0)
    }

    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [status?.sessionState, status?.sessionStartTime, status?.pausedMs])

  const runAction = async (channel: string) => {
    setBusy(true)
    try {
      const updated = await window.electron.ipc.invoke(channel)
      setStatus(updated)
    } finally {
      setBusy(false)
    }
  }

  const setSessionProject = async (projectId: number | null, phaseId: number | null) => {
    setBusy(true)
    try {
      const updated = await window.electron.ipc.invoke('set-session-project', projectId, phaseId)
      setStatus(updated)
    } finally {
      setBusy(false)
    }
  }

  const toggleBillable = async (billable: boolean) => {
    setBusy(true)
    try {
      const updated = await window.electron.ipc.invoke('set-session-billable', billable)
      setStatus(updated)
    } finally {
      setBusy(false)
    }
  }

  const isRunning = status ? status.sessionState === 'running' && !status.isIdle : false
  const isPaused = status?.sessionState === 'paused'
  const isStopped = status ? status.sessionState === 'stopped' : true
  const looksPaused = !!status && (isPaused || (status.sessionState === 'running' && status.isIdle))
  const mood: MascotMood = isStopped ? 'sleepy' : looksPaused ? 'neutral' : 'happy'

  return (
    <LiveSessionContext.Provider
      value={{
        status,
        elapsed,
        busy,
        categories,
        projects,
        setCategoryOverride,
        setSessionProject,
        runAction,
        toggleBillable,
        isRunning,
        isPaused,
        isStopped,
        looksPaused,
        mood,
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  )
}

export function useLiveSession(): LiveSessionValue {
  const ctx = useContext(LiveSessionContext)
  if (!ctx) throw new Error('useLiveSession doit être utilisé dans un LiveSessionProvider')
  return ctx
}
