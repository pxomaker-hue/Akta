import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity, FocusSession, ProjectPhase } from '../../shared/types'
import { LiveSessionProvider, useLiveSession } from '../contexts/LiveSessionContext'
import { useTheme } from '../hooks/useTheme'
import { useAccentColor } from '../hooks/useAccentColor'
import { useTranslation } from '../hooks/useTranslation'
import { Icon, Dropdown } from './UI'
import Logo from './Logo'

// Reprend exactement la charte des Card/Stat de l'app (bordure + dégradé subtil) plutôt que
// d'inventer une variante : ce popup doit avoir l'air d'un morceau d'Akta, pas d'un widget à part.
const CARD_CLASS =
  'rounded-xl border border-gray-200/50 dark:border-slate-700/50 bg-gradient-to-br from-white via-gray-50/80 to-gray-100/60 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-900/40 shadow-sm'

// Petit aperçu ouvert au clic sur l'icône du tray (fenêtre Electron séparée, chargée avec
// ?widget=tray) : voir/piloter la session en cours sans faire remonter toute la fenêtre principale.
function TrayWidgetInner() {
  useTheme()
  useAccentColor()
  const { t } = useTranslation()
  const {
    status,
    elapsed,
    busy,
    runAction,
    toggleBillable,
    isRunning,
    isPaused,
    isStopped,
    categories,
    projects,
    setCategoryOverride,
    setSessionProject,
  } = useLiveSession()

  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [pinned, setPinned] = useState(false)
  const [todayActivities, setTodayActivities] = useState<Activity[]>([])
  const [focusNow, setFocusNow] = useState(Date.now())
  const [showOverridePanel, setShowOverridePanel] = useState(false)
  const [sessionPhases, setSessionPhases] = useState<ProjectPhase[]>([])

  const contentRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electron.ipc.invoke('get-tray-widget-pinned').then(setPinned).catch(() => {})
  }, [])

  useEffect(() => {
    const loadFocus = () => {
      window.electron.ipc.invoke('get-current-focus-session').then(setFocusSession).catch(() => {})
    }
    loadFocus()
    const interval = setInterval(loadFocus, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!focusSession) return
    const tick = setInterval(() => setFocusNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [focusSession])

  useEffect(() => {
    const loadToday = () => {
      window.electron.ipc.invoke('get-activities', 1).then(setTodayActivities).catch(() => {})
    }
    loadToday()
    const interval = setInterval(loadToday, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!status?.projectId) {
      setSessionPhases([])
      return
    }
    window.electron.ipc
      .invoke('get-project-phases', status.projectId)
      .then(setSessionPhases)
      .catch(() => setSessionPhases([]))
  }, [status?.projectId])

  // La fenêtre Electron n'a pas de taille fixe idéale (le panneau de réglages ou la carte Focus
  // peuvent apparaître/disparaître) : on mesure le contenu réel et on redimensionne la fenêtre
  // en conséquence, plutôt que de garder une hauteur figée qui laisse un vide en bas.
  useEffect(() => {
    const measure = () => {
      const height =
        4 + (headerRef.current?.offsetHeight || 0) + (contentRef.current?.scrollHeight || 0) + (footerRef.current?.offsetHeight || 0)
      window.electron.ipc.invoke('resize-tray-widget', height).catch(() => {})
    }
    const ro = new ResizeObserver(measure)
    if (contentRef.current) ro.observe(contentRef.current)
    measure()
    return () => ro.disconnect()
  }, [])

  const todayTotals = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const relevant = todayActivities.filter((a) => a.start_time >= todayStart.getTime())
    const total = relevant.reduce((sum, a) => sum + a.duration_seconds, 0)
    const billable = relevant.filter((a) => a.billable).reduce((sum, a) => sum + a.duration_seconds, 0)
    return { total, billable }
  }, [todayActivities])

  const togglePin = async () => {
    const next = !pinned
    setPinned(next)
    await window.electron.ipc.invoke('set-tray-widget-pinned', next)
  }

  const hideWidget = () => {
    window.electron.ipc.invoke('hide-tray-widget').catch(() => {})
  }

  const openMainWindow = () => {
    window.electron.ipc.invoke('show-main-window').catch(() => {})
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatShort = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  const focusTimeLeft = focusSession
    ? Math.max(Math.floor(focusSession.planned_duration - (focusNow - focusSession.start_time) / 1000), 0)
    : 0
  const focusProgress = focusSession
    ? Math.min(((focusSession.planned_duration - focusTimeLeft) / focusSession.planned_duration) * 100, 100)
    : 0

  const hasOverrides = Object.keys(status?.categoryOverrides || {}).length > 0 || !!status?.projectId

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-white overflow-hidden select-none animate-fade-in-scale">
      {/* Fine bande d'accent en haut : signature visuelle discrète, cohérente avec le reste de l'app */}
      <div className="h-1 accent-gradient-bg flex-shrink-0" />

      {/* Zone de drag : seul moyen de déplacer une fenêtre sans bordure/barre de titre */}
      <div ref={headerRef} className="flex items-center gap-2.5 px-3.5 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0" style={dragStyle}>
        <Logo size={26} />
        <span className="text-sm font-bold accent-gradient-text flex-1">Akta</span>
        <button
          onClick={togglePin}
          title={pinned ? t('trayWidget.unpin', 'Désépingler (se referme au clic ailleurs)') : t('trayWidget.pin', 'Épingler (widget flottant permanent)')}
          style={{ ...noDragStyle, ...(pinned ? { color: 'var(--accent-primary)', backgroundColor: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' } : undefined) }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="pin" size={14} />
        </button>
        <button
          onClick={hideWidget}
          title={t('common.close', 'Fermer')}
          style={noDragStyle}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div ref={contentRef} className="p-3 space-y-2.5">
          {/* Session de travail */}
          <div className={`${CARD_CLASS} p-3.5`}>
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isRunning ? 'bg-emerald-500 animate-pulse' : isPaused ? 'bg-amber-500' : 'bg-gray-400'
                }`}
              />
              <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide flex-1">
                {isStopped ? t('trayWidget.trackingStopped', 'Suivi arrêté') : isPaused ? t('trayWidget.paused', 'En pause') : status?.isIdle ? t('trayWidget.idle', 'Inactif') : t('trayWidget.activeSession', 'Session active')}
              </span>
              {!isStopped && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowOverridePanel((v) => !v)}
                    title={t('trayWidget.configureSession', 'Configurer le projet et les catégories focus / distraction de cette session')}
                    style={hasOverrides ? { backgroundColor: 'var(--accent-primary)' } : undefined}
                    className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                      hasOverrides
                        ? 'text-white'
                        : showOverridePanel
                          ? 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400'
                    }`}
                  >
                    <Icon name="target" size={12} />
                  </button>
                  <button
                    onClick={() => toggleBillable(!status?.billableOverride)}
                    disabled={busy}
                    title={status?.billableOverride ? t('trayWidget.billableOverrideOn', 'Facturable — cliquer pour marquer non facturable') : t('trayWidget.billableOverrideOff', 'Marquer cette session comme facturable')}
                    className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                      status?.billableOverride
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v10M9 9.5a2 2 0 0 1 2-1.5h1.5a2 2 0 0 1 0 4H11a2 2 0 0 0 0 4h1.5a2 2 0 0 0 2-1.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div key={isStopped ? 'stopped' : 'active'} className="mb-3 text-center animate-pop-in">
              <p className="text-3xl font-mono font-black tabular-nums leading-none text-gray-900 dark:text-white">
                {isStopped ? '—' : formatDuration(elapsed)}
              </p>
              {!isStopped && status?.currentApp && (
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 truncate">{status.currentApp}</p>
              )}
            </div>

            <div className="flex gap-1.5">
              {isStopped ? (
                <button
                  onClick={() => runAction('start-session')}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg accent-gradient-bg text-white hover:brightness-110 transition-all disabled:opacity-50 active:scale-[0.97]"
                >
                  <Icon name="play" size={11} />
                  {t('trayWidget.start', 'Démarrer')}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => runAction(isPaused ? 'resume-session' : 'pause-session')}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 active:scale-[0.97]"
                  >
                    <Icon name={isPaused ? 'play' : 'pause'} size={11} />
                    {isPaused ? t('trayWidget.resume', 'Reprendre') : t('trayWidget.pauseButton', 'Pause')}
                  </button>
                  <button
                    onClick={() => runAction('stop-session')}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 active:scale-[0.97]"
                  >
                    <Icon name="stop-circle" size={11} />
                    {t('trayWidget.stop', 'Arrêter')}
                  </button>
                </>
              )}
            </div>

            {/* Réglages projet / phase / catégories pour la session en cours */}
            {!isStopped && showOverridePanel && (
              <div className="mt-3 pt-3 border-t border-gray-200/70 dark:border-slate-700/50 space-y-2.5 animate-fade-in-scale">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{t('trayWidget.project', 'Projet')}</p>
                  <div className="flex gap-1.5">
                    <Dropdown
                      value={status?.projectId ? String(status.projectId) : ''}
                      onChange={(v) => setSessionProject(v ? Number(v) : null, null)}
                      disabled={busy}
                      className="flex-1 min-w-0"
                      placeholder={t('trayWidget.noProject', 'Aucun projet')}
                      options={[{ value: '', label: t('trayWidget.noProject', 'Aucun projet') }, ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color }))]}
                    />
                    {status?.projectId && sessionPhases.length > 0 && (
                      <Dropdown
                        value={status.phaseId ? String(status.phaseId) : ''}
                        onChange={(v) => setSessionProject(status.projectId, v ? Number(v) : null)}
                        disabled={busy}
                        className="w-24 flex-shrink-0"
                        placeholder={t('trayWidget.phase', 'Phase')}
                        options={[{ value: '', label: t('trayWidget.noPhase', 'Aucune phase') }, ...sessionPhases.map((ph) => ({ value: String(ph.id), label: ph.name, color: ph.color }))]}
                      />
                    )}
                  </div>
                </div>

                {categories.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      {t('trayWidget.categoriesForSession', 'Catégories (pour cette session)')}
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {categories.map((cat) => {
                        const override = status?.categoryOverrides?.[cat.id]
                        return (
                          <div key={cat.id} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-slate-300 min-w-0 truncate">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="truncate">{cat.name}</span>
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setCategoryOverride(cat.id, override === 'focus' ? null : 'focus')}
                                disabled={busy}
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
                                  override === 'focus'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                }`}
                              >
                                {t('trayWidget.focus', 'Focus')}
                              </button>
                              <button
                                onClick={() => setCategoryOverride(cat.id, override === 'distraction' ? null : 'distraction')}
                                disabled={busy}
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
                                  override === 'distraction'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                }`}
                              >
                                {t('trayWidget.distraction', 'Distraction')}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mode Focus, si actif */}
          {focusSession && (
            <div
              className="rounded-xl border p-3.5 animate-fade-in-scale"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 10%, transparent), color-mix(in srgb, var(--accent-secondary) 8%, transparent))',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="target" size={13} className="accent-text" />
                <span className="text-xs font-semibold accent-text">{t('trayWidget.focusModeActive', 'Mode Focus en cours')}</span>
              </div>
              <p className="text-2xl font-mono font-black tabular-nums accent-gradient-text leading-none mb-2 text-center">
                {formatDuration(focusTimeLeft)}
              </p>
              <div className="w-full h-1.5 rounded-full bg-white/50 dark:bg-black/20 overflow-hidden">
                <div className="h-full accent-gradient-bg transition-all" style={{ width: `${focusProgress}%` }} />
              </div>
            </div>
          )}

          {/* Résumé du jour */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`${CARD_CLASS} py-2.5 text-center`}>
              <p className="text-base font-bold text-gray-900 dark:text-white">{formatShort(todayTotals.total)}</p>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{t('trayWidget.trackedToday', "Suivi aujourd'hui")}</p>
            </div>
            <div className={`${CARD_CLASS} py-2.5 text-center`}>
              <p className="text-base font-bold accent-text">{formatShort(todayTotals.billable)}</p>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{t('trayWidget.billable', 'Facturable')}</p>
            </div>
          </div>
        </div>
      </div>

      <div ref={footerRef} className="p-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
        <button
          onClick={openMainWindow}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
        >
          <Icon name="laptop" size={12} />
          {t('trayWidget.openAkta', 'Ouvrir Akta')}
        </button>
      </div>
    </div>
  )
}

function TrayWidget() {
  return (
    <LiveSessionProvider>
      <TrayWidgetInner />
    </LiveSessionProvider>
  )
}

export default TrayWidget
