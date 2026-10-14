import { useEffect, useMemo, useState } from 'react'
import type { WorkSession, Project, ProjectPhase } from '../../shared/types'
import { Card, CardHeader, Icon, Badge, Dropdown, confirmDialog } from './UI'
import { getTodayStart } from './TimelineV2'
import { useTranslation, localeTag } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

const DAY_MS = 24 * 60 * 60 * 1000

interface AppBreakdown {
  app_name: string
  duration_seconds: number
  billable_seconds: number
  count: number
}

interface SessionPause {
  id: number
  start_time: number
  end_time: number | null
  duration_seconds: number
}

function SessionsList() {
  const { t, language } = useTranslation()
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [breakdown, setBreakdown] = useState<AppBreakdown[]>([])
  const [billableSeconds, setBillableSeconds] = useState(0)
  const [pauses, setPauses] = useState<SessionPause[]>([])
  const [pausedSeconds, setPausedSeconds] = useState(0)
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftProjectId, setDraftProjectId] = useState<string>('')
  const [draftPhaseId, setDraftPhaseId] = useState<string>('')
  const [draftPhases, setDraftPhases] = useState<ProjectPhase[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [dateFilterStart, setDateFilterStart] = useState('')
  const [dateFilterEnd, setDateFilterEnd] = useState('')
  const [selectedSessions, setSelectedSessions] = useState<Set<number>>(new Set())
  const [bulkProjectId, setBulkProjectId] = useState<string>('')
  const [bulkPhaseId, setBulkPhaseId] = useState<string>('')
  const [bulkBillable, setBulkBillable] = useState<'unchanged' | 'true' | 'false'>('unchanged')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  const loadSessions = async () => {
    try {
      // Fenêtre large : les sessions importées/synchronisées peuvent dater de bien avant hier
      const data = await window.electron.ipc.invoke('get-sessions', 30)
      setSessions(data)
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    try {
      const data = await window.electron.ipc.invoke('get-projects')
      setProjects(data)
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  useEffect(() => {
    loadSessions()
    loadProjects()
    const interval = setInterval(loadSessions, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  // Recharge les phases disponibles à chaque changement de projet sélectionné (édition de session OU édition en masse)
  useEffect(() => {
    const projectIdToLoad = draftProjectId || bulkProjectId
    if (!projectIdToLoad) {
      setDraftPhases([])
      return
    }
    let cancelled = false
    window.electron.ipc
      .invoke('get-project-phases', Number(projectIdToLoad))
      .then((data: ProjectPhase[]) => {
        if (!cancelled) setDraftPhases(data)
      })
      .catch((error: unknown) => {
        console.error('Error loading project phases:', error)
        if (!cancelled) setDraftPhases([])
      })
    return () => {
      cancelled = true
    }
  }, [draftProjectId, bulkProjectId])

  const handleToggleBillable = async (session: WorkSession) => {
    setUpdatingId(session.id)
    try {
      await window.electron.ipc.invoke('update-session-billable', session.id, !session.billable)
      await loadSessions()
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (session: WorkSession) => {
    if (!(await confirmDialog(t('sessionsList.confirmDelete', 'Supprimer cette session ? Les activités associées ne seront pas supprimées.'), { danger: true }))) return
    setDeletingId(session.id)
    try {
      await window.electron.ipc.invoke('delete-session', session.id)
      await loadSessions()
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpand = async (session: WorkSession) => {
    if (expandedId === session.id) {
      setExpandedId(null)
      setDraftLabel('')
      setDraftProjectId('')
      setDraftPhaseId('')
      return
    }
    setExpandedId(session.id)
    setDraftLabel(session.label || '')
    setDraftProjectId(session.project_id ? String(session.project_id) : '')
    setDraftPhaseId(session.phase_id ? String(session.phase_id) : '')
    setLoadingBreakdown(true)
    try {
      const data = await window.electron.ipc.invoke('get-session-activities', session.id)
      setBreakdown(data.apps || [])
      setBillableSeconds(data.billableSeconds || 0)
      setPauses(data.pauses || [])
      setPausedSeconds(data.pausedSeconds || 0)
    } catch (error) {
      console.error('Error loading session breakdown:', error)
      setBreakdown([])
      setBillableSeconds(0)
      setPauses([])
      setPausedSeconds(0)
    } finally {
      setLoadingBreakdown(false)
    }
  }

  const handleSaveDetails = async (session: WorkSession) => {
    try {
      await window.electron.ipc.invoke(
        'update-session-details',
        session.id,
        draftLabel.trim() || null,
        draftProjectId ? Number(draftProjectId) : null,
        draftPhaseId ? Number(draftPhaseId) : null
      )
      await loadSessions()
    } catch (error) {
      console.error('Error saving session details:', error)
    }
  }

  const formatTime = (ms: number) => new Date(ms).toLocaleTimeString(localeTag(language), { hour: '2-digit', minute: '2-digit' })
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }
  const toLocalDateString = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Clients référencés par au moins un projet (clé naturelle : les sessions n'ont pas de client_id
  // direct, seulement via leur projet)
  const clientsWithProjects = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string }>()
    for (const p of projects) {
      if (p.client_id && p.client_name) {
        map.set(p.client_id, { id: p.client_id, name: p.client_name, color: p.client_color || '#9ca3af' })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  const projectIdToClientId = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of projects) {
      if (p.client_id) map.set(p.id, p.client_id)
    }
    return map
  }, [projects])

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (projectFilter && String(s.project_id ?? '') !== projectFilter) return false
      if (clientFilter) {
        const sessionClientId = s.project_id ? projectIdToClientId.get(s.project_id) : null
        if (String(sessionClientId ?? '') !== clientFilter) return false
      }
      if (dateFilterStart || dateFilterEnd) {
        const sessionDate = new Date(s.start_time).setHours(0, 0, 0, 0)
        if (dateFilterStart) {
          const startDate = new Date(dateFilterStart).setHours(0, 0, 0, 0)
          if (sessionDate < startDate) return false
        }
        if (dateFilterEnd) {
          const endDate = new Date(dateFilterEnd).setHours(23, 59, 59, 999)
          if (sessionDate > endDate) return false
        }
      }
      return true
    })
  }, [sessions, projectFilter, clientFilter, dateFilterStart, dateFilterEnd, projectIdToClientId])

  const todayStart = getTodayStart()
  const todaysSessions = filteredSessions.filter((s) => s.start_time >= todayStart)
  const olderSessions = filteredSessions.filter((s) => s.start_time < todayStart)
  const isSessionsFiltered = !!projectFilter || !!clientFilter || !!dateFilterStart || !!dateFilterEnd

  // Préfixe la date pour une session antérieure à aujourd'hui : sans ça, une heure isolée
  // devient ambiguë dès qu'on affiche plusieurs jours d'historique ensemble.
  const formatSessionTime = (ms: number) => {
    const time = formatTime(ms)
    if (ms >= todayStart) return time
    const date = new Date(ms).toLocaleDateString(localeTag(language), { day: '2-digit', month: '2-digit' })
    return `${date} ${time}`
  }

  const handleBulkUpdate = async () => {
    if (selectedSessions.size === 0) return
    setIsBulkUpdating(true)
    try {
      const sessionIds = Array.from(selectedSessions)
      for (const sessionId of sessionIds) {
        const session = sessions.find(s => s.id === sessionId)
        if (!session) continue
        const projectId = bulkProjectId ? Number(bulkProjectId) : session.project_id
        const phaseId = bulkPhaseId ? Number(bulkPhaseId) : session.phase_id
        const billable = bulkBillable === 'unchanged' ? session.billable : bulkBillable === 'true'
        await window.electron.ipc.invoke('update-session-details', sessionId, session.label || null, projectId || null, phaseId || null)
        if (bulkBillable !== 'unchanged') {
          await window.electron.ipc.invoke('update-session-billable', sessionId, billable)
        }
      }
      await loadSessions()
      setSelectedSessions(new Set())
      setBulkProjectId('')
      setBulkPhaseId('')
      setBulkBillable('unchanged')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const renderSession = (session: WorkSession) => {
    const isOpen = session.end_time === null
    const durationSeconds = isOpen ? Math.floor((nowTick - session.start_time) / 1000) : session.duration_seconds
    const isExpanded = expandedId === session.id
    const isSelected = selectedSessions.has(session.id)
    return (
      <div key={session.id} className="rounded-lg bg-gray-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                const newSelected = new Set(selectedSessions)
                if (e.target.checked) newSelected.add(session.id)
                else newSelected.delete(session.id)
                setSelectedSessions(newSelected)
              }}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
            />
            <button onClick={() => toggleExpand(session)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <Icon name={isExpanded ? 'chart-bar' : 'clock'} size={14} className="text-gray-400 flex-shrink-0" />
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
                  {session.label || `${formatSessionTime(session.start_time)}${!isOpen && session.end_time ? ` → ${formatTime(session.end_time)}` : ` (${t('sessionsList.inProgress', 'en cours')})`}`}
                  {session.project_name && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: `${session.project_color}20`, color: session.project_color || undefined }}
                    >
                      {session.project_name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.label ? `${formatSessionTime(session.start_time)}${!isOpen && session.end_time ? ` → ${formatTime(session.end_time)}` : ` (${t('sessionsList.inProgress', 'en cours')})`} • ` : ''}
                  {formatDuration(durationSeconds)}
                </p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onClick={() => handleToggleBillable(session)} disabled={updatingId === session.id} className="disabled:opacity-50">
              <Badge variant={session.billable ? 'primary' : 'neutral'} icon={<Icon name="briefcase" size={12} />}>
                {session.billable ? t('sessionsList.billable', 'Facturable') : t('sessionsList.personal', 'Personnel')}
              </Badge>
            </button>
            {!isOpen && (
              <button
                onClick={() => handleDelete(session)}
                disabled={deletingId === session.id}
                title={t('sessionsList.deleteTitle', 'Supprimer cette session')}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <Icon name="trash" size={13} />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-slate-700 space-y-3">
            {/* Nom + projet + phase */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder={t('sessionsList.namePlaceholder', 'Nom de la session (ex : Rédaction proposition)')}
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              <Dropdown
                value={draftProjectId}
                onChange={(v) => {
                  setDraftProjectId(v)
                  setDraftPhaseId('')
                }}
                className="w-40 flex-shrink-0"
                placeholder={t('sessionsList.noProject', 'Aucun projet')}
                options={[
                  { value: '', label: t('sessionsList.noProject', 'Aucun projet') },
                  ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color })),
                ]}
              />
              {draftProjectId && draftPhases.length > 0 && (
                <Dropdown
                  value={draftPhaseId}
                  onChange={setDraftPhaseId}
                  className="w-36 flex-shrink-0"
                  placeholder={t('sessionsList.noPhase', 'Aucune phase')}
                  options={[
                    { value: '', label: t('sessionsList.noPhase', 'Aucune phase') },
                    ...draftPhases.map((ph) => ({ value: String(ph.id), label: ph.name, color: ph.color })),
                  ]}
                />
              )}
              <button
                onClick={() => handleSaveDetails(session)}
                className="px-3 py-1.5 text-sm rounded-lg accent-gradient-bg text-white font-medium hover:brightness-110 transition-all flex-shrink-0"
              >
                {t('sessionsList.save', 'Enregistrer')}
              </button>
            </div>

            {/* Temps actif / temps total / dont pause */}
            {!loadingBreakdown && pausedSeconds > 0 && (() => {
              const totalSeconds = isOpen ? durationSeconds : session.duration_seconds + pausedSeconds
              const activeSeconds = isOpen ? Math.max(durationSeconds - pausedSeconds, 0) : session.duration_seconds
              return (
                <div className="flex items-center gap-3 text-xs bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300">
                    <Icon name="clock" size={12} className="text-emerald-500" />
                    <strong>{formatDuration(activeSeconds)}</strong> {t('sessionsList.active', 'actif')}
                  </span>
                  <span className="text-gray-400 dark:text-slate-500">•</span>
                  <span className="text-gray-700 dark:text-slate-300">
                    <strong>{formatDuration(totalSeconds)}</strong> {t('sessionsList.total', 'au total')}
                  </span>
                  <span className="text-gray-400 dark:text-slate-500">•</span>
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    {t('sessionsList.includingPrefix', 'dont')} <strong>{formatDuration(pausedSeconds)}</strong> {t('sessionsList.includingPauseSuffix', 'de pause')}
                  </span>
                </div>
              )
            })()}

            {/* Détail par application + pauses, dans l'ordre chronologique */}
            {loadingBreakdown ? (
              <div className="flex justify-center py-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
              </div>
            ) : breakdown.length === 0 && pauses.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-2">{t('sessionsList.noActivityInSession', 'Aucune activité enregistrée pendant cette session.')}</p>
            ) : (
              <div className="space-y-1.5">
                {breakdown.map((app) => (
                  <div key={app.app_name} className="flex items-center justify-between text-xs">
                    <span className="text-gray-700 dark:text-slate-300 truncate">{app.app_name}</span>
                    <span className="text-gray-500 dark:text-slate-400 flex-shrink-0 ml-2">{formatDuration(app.duration_seconds)}</span>
                  </div>
                ))}
                {pauses.map((pause) => (
                  <div key={`pause-${pause.id}`} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 truncate">
                      <Icon name="clock" size={11} />
                      {t('sessionsList.pauseWord', 'Pause')}{pause.end_time === null ? ` (${t('sessionsList.inProgress', 'en cours')})` : ''}
                    </span>
                    <span className="text-amber-500 dark:text-amber-400 flex-shrink-0 ml-2">{formatDuration(pause.duration_seconds)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Montant facturable de la session (facturable + projet + taux horaire renseigné) */}
            {!loadingBreakdown && !!session.billable && session.project_id && session.project_hourly_rate && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200 dark:border-slate-700">
                <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-slate-300">
                  <Icon name="dollar" size={12} className="accent-text" />
                  {tf(t('sessionsList.totalBillable', 'Total facturable ({{duration}} × {{rate}} €/h)'), {
                    duration: formatDuration(billableSeconds),
                    rate: session.project_hourly_rate,
                  })}
                </span>
                <span className="font-semibold accent-text">
                  {((billableSeconds / 3600) * session.project_hourly_rate).toFixed(2)} €
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader title={t('sessionsList.title', 'Sessions actives')} icon={<Icon name="target" size={18} />} />
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{t('sessionsList.noneRecorded', 'Aucune session enregistrée pour le moment.')}</p>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('sessionsList.title', 'Sessions actives')}
        icon={<Icon name="target" size={18} />}
        subtitle={tf(
          filteredSessions.length === 1 ? t('sessionsList.countSingular', '{{n}} session') : t('sessionsList.countPlural', '{{n}} sessions'),
          { n: filteredSessions.length }
        )}
      />

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Dropdown
          value={clientFilter}
          onChange={setClientFilter}
          className="w-40"
          placeholder={t('sessionsList.allClients', 'Tous les clients')}
          options={[{ value: '', label: t('sessionsList.allClients', 'Tous les clients') }, ...clientsWithProjects.map((c) => ({ value: String(c.id), label: c.name, color: c.color }))]}
        />
        <Dropdown
          value={projectFilter}
          onChange={setProjectFilter}
          className="w-40"
          placeholder={t('sessionsList.allProjects', 'Tous les projets')}
          options={[{ value: '', label: t('sessionsList.allProjects', 'Tous les projets') }, ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color }))]}
        />
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input
              type="date"
              value={dateFilterStart}
              onChange={(e) => setDateFilterStart(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              placeholder={t('sessionsList.dateFrom', 'De')}
            />
            <Icon name="calendar" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-gray-400">—</span>
          <div className="relative">
            <input
              type="date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              placeholder={t('sessionsList.dateTo', 'À')}
            />
            <Icon name="calendar" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {isSessionsFiltered && (
          <button
            onClick={() => {
              setProjectFilter('')
              setClientFilter('')
              setDateFilterStart('')
              setDateFilterEnd('')
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="x" size={12} />
            {t('sessionsList.resetFilters', 'Réinitialiser les filtres')}
          </button>
        )}
      </div>

      {/* Édition en masse */}
      {selectedSessions.size > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
              {tf(
                selectedSessions.size === 1 ? t('sessionsList.selectedSingular', '{{n}} session sélectionnée') : t('sessionsList.selectedPlural', '{{n}} sessions sélectionnées'),
                { n: selectedSessions.size }
              )}
            </span>
            <button
              onClick={() => setSelectedSessions(new Set())}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('sessionsList.deselectAll', 'Désélectionner tout')}
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Dropdown
              value={bulkProjectId}
              onChange={setBulkProjectId}
              placeholder={t('sessionsList.projectUnchanged', 'Projet (inchangé)')}
              options={[{ value: '', label: t('sessionsList.projectUnchanged', 'Projet (inchangé)') }, ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color }))]}
            />
            {bulkProjectId && (
              <Dropdown
                value={bulkPhaseId}
                onChange={setBulkPhaseId}
                placeholder={t('sessionsList.phaseUnchanged', 'Phase (inchangée)')}
                options={[{ value: '', label: t('sessionsList.phaseUnchanged', 'Phase (inchangée)') }, ...draftPhases.map((ph) => ({ value: String(ph.id), label: ph.name, color: ph.color }))]}
              />
            )}
            <Dropdown
              value={bulkBillable}
              onChange={(v) => setBulkBillable(v as 'unchanged' | 'true' | 'false')}
              placeholder={t('sessionsList.billable', 'Facturable')}
              options={[
                { value: 'unchanged', label: t('sessionsList.billableUnchanged', 'Facturable (inchangé)') },
                { value: 'true', label: `✓ ${t('sessionsList.billable', 'Facturable')}` },
                { value: 'false', label: `○ ${t('sessionsList.notBillable', 'Non facturable')}` },
              ]}
            />
            <button
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isBulkUpdating ? t('sessionsList.updating', 'Mise à jour...') : t('sessionsList.apply', 'Appliquer')}
            </button>
          </div>
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{t('sessionsList.noMatch', 'Aucune session ne correspond à ce filtre.')}</p>
      ) : (
        <div className="space-y-4">
          {todaysSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-1">{t('timeline.today', "Aujourd'hui")}</p>
              <div className="space-y-2">{todaysSessions.map(renderSession)}</div>
            </div>
          )}
          {olderSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 px-1 pt-1 border-t border-gray-100 dark:border-slate-800">
                {t('sessionsList.previousSessions', 'Sessions précédentes')}
              </p>
              <div className="space-y-2">{olderSessions.map(renderSession)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default SessionsList
