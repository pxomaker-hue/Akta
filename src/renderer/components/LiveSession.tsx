import { useEffect, useRef, useState } from 'react'
import type { ProjectPhase } from '../../shared/types'
import { Icon, Dropdown } from './UI'
import { useLiveSession } from '../contexts/LiveSessionContext'

function LiveSession() {
  const {
    status,
    elapsed,
    busy,
    categories,
    projects,
    setCategoryOverride,
    setSessionProject,
    runAction,
    toggleBillable,
    isPaused,
    isStopped,
    looksPaused,
  } = useLiveSession()
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const categoryPanelRef = useRef<HTMLDivElement | null>(null)
  const categoryToggleRef = useRef<HTMLButtonElement | null>(null)
  const [sessionPhases, setSessionPhases] = useState<ProjectPhase[]>([])

  // Recharge les phases disponibles à chaque changement de projet rattaché à la session
  useEffect(() => {
    if (!status?.projectId) {
      setSessionPhases([])
      return
    }
    let cancelled = false
    window.electron.ipc
      .invoke('get-project-phases', status.projectId)
      .then((data: ProjectPhase[]) => {
        if (!cancelled) setSessionPhases(data)
      })
      .catch((error: unknown) => {
        console.error('Error loading project phases:', error)
        if (!cancelled) setSessionPhases([])
      })
    return () => {
      cancelled = true
    }
  }, [status?.projectId])

  useEffect(() => {
    if (!showCategoryPanel) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (categoryPanelRef.current?.contains(target)) return
      if (categoryToggleRef.current?.contains(target)) return
      setShowCategoryPanel(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCategoryPanel])

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!status) return null

  const isRunning = status.sessionState === 'running' && !status.isIdle

  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-full pl-4 pr-1.5 py-1.5 w-80 h-11 flex-shrink-0">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
          isRunning ? 'bg-emerald-500 animate-pulse' : looksPaused ? 'bg-amber-500' : 'bg-gray-400'
        }`}
      />

      <div key={status.sessionState} className="flex items-center gap-2 animate-pop-in min-w-0">
        {isStopped ? (
          <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">Suivi arrêté</span>
        ) : (
          <>
            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">{formatDuration(elapsed)}</span>
            <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
              {status.sessionState === 'paused' ? 'en pause' : status.isIdle ? 'inactif' : 'session active'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto relative">
        {!isStopped && (
          <button
            ref={categoryToggleRef}
            onClick={() => setShowCategoryPanel((v) => !v)}
            disabled={busy}
            title="Configurer le projet et les catégories focus / distraction de cette session"
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
              Object.keys(status.categoryOverrides || {}).length > 0 || status.projectId
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-white dark:bg-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
            }`}
          >
            <Icon name="target" size={13} />
          </button>
        )}

        {!isStopped && showCategoryPanel && (
          <div ref={categoryPanelRef} className="absolute top-9 right-0 z-[60] w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1">Projet</p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">Rattache cette session à un projet, sans attendre qu'elle se termine.</p>
            <div className="flex items-center gap-1.5 mb-3">
              <Dropdown
                value={status.projectId ? String(status.projectId) : ''}
                onChange={(v) => setSessionProject(v ? Number(v) : null, null)}
                disabled={busy}
                className="flex-1 min-w-0"
                placeholder="Aucun projet"
                options={[{ value: '', label: 'Aucun projet' }, ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color }))]}
              />
              {status.projectId && sessionPhases.length > 0 && (
                <Dropdown
                  value={status.phaseId ? String(status.phaseId) : ''}
                  onChange={(v) => setSessionProject(status.projectId, v ? Number(v) : null)}
                  disabled={busy}
                  className="w-28 flex-shrink-0"
                  placeholder="Phase"
                  options={[{ value: '', label: 'Aucune phase' }, ...sessionPhases.map((ph) => ({ value: String(ph.id), label: ph.name, color: ph.color }))]}
                />
              )}
            </div>

            <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-1 pt-2 border-t border-gray-100 dark:border-slate-700/50">
              Pour cette session
            </p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-3">
              Force une catégorie en focus ou en distraction, uniquement pour cette session (le réglage global des catégories n'est pas modifié).
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {categories.map((cat) => {
                const override = status.categoryOverrides?.[cat.id]
                return (
                  <div key={cat.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 min-w-0 truncate">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setCategoryOverride(cat.id, override === 'focus' ? null : 'focus')}
                        disabled={busy}
                        className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
                          override === 'focus'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        Focus
                      </button>
                      <button
                        onClick={() => setCategoryOverride(cat.id, override === 'distraction' ? null : 'distraction')}
                        disabled={busy}
                        className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
                          override === 'distraction'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        Distraction
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!isStopped && (
          <button
            onClick={() => toggleBillable(!status.billableOverride)}
            disabled={busy}
            title={status.billableOverride ? 'Session facturable — cliquer pour marquer non facturable' : 'Marquer cette session comme facturable'}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
              status.billableOverride
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-white dark:bg-slate-700 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-600'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v10M9 9.5a2 2 0 0 1 2-1.5h1.5a2 2 0 0 1 0 4H11a2 2 0 0 0 0 4h1.5a2 2 0 0 0 2-1.5" />
            </svg>
          </button>
        )}

        {isStopped && (
          <button
            onClick={() => runAction('start-session')}
            disabled={busy}
            title="Démarrer une session"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-transform duration-150 hover:scale-110 active:scale-90"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" key="play" className="animate-pop-in">
              <path d="M2 1.2 L10.5 6 L2 10.8 Z" />
            </svg>
          </button>
        )}

        {!isStopped && (
          <button
            onClick={() => runAction(isPaused ? 'resume-session' : 'pause-session')}
            disabled={busy || (status.sessionState === 'running' && status.isIdle)}
            title={isPaused ? 'Reprendre la session' : 'Mettre en pause'}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-transform duration-150 hover:scale-110 active:scale-90"
          >
            {isPaused ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" key="play" className="animate-pop-in">
                <path d="M2 1.2 L10.5 6 L2 10.8 Z" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" key="pause" className="animate-pop-in">
                <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
              </svg>
            )}
          </button>
        )}

        {!isStopped && (
          <button
            onClick={() => runAction('stop-session')}
            disabled={busy}
            title="Arrêter la session"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-transform duration-150 hover:scale-110 active:scale-90"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default LiveSession
