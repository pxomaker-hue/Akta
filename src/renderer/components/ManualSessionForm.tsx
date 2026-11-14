import { useEffect, useState } from 'react'
import type { Project, ProjectPhase } from '../../shared/types'
import { Dropdown, Icon } from './UI'
import { useTranslation } from '../hooks/useTranslation'

// Saisie manuelle d'une session oubliée (temps passé hors de l'ordinateur, oubli de démarrer le
// suivi…). Le main crée la session et une activité "Saisie manuelle" qui couvre sa durée, pour
// qu'elle soit comptée partout (heures, montants, exports) comme une session suivie.

const INPUT_CLASS =
  'px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]'

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "2026-11-14" + "09:30" → timestamp local
export function toTimestamp(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

interface ManualSessionFormProps {
  projects: Project[]
  onCreated: () => void
  onCancel: () => void
}

function ManualSessionForm({ projects, onCreated, onCancel }: ManualSessionFormProps) {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayString())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [label, setLabel] = useState('')
  const [projectId, setProjectId] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [billable, setBillable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPhaseId('')
    if (!projectId) {
      setPhases([])
      return
    }
    let cancelled = false
    window.electron.ipc
      .invoke('get-project-phases', Number(projectId))
      .then((data: ProjectPhase[]) => {
        if (!cancelled) setPhases(data)
      })
      .catch(() => {
        if (!cancelled) setPhases([])
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleSubmit = async () => {
    const startMs = toTimestamp(date, start)
    const endMs = toTimestamp(date, end)
    if (!(endMs > startMs)) {
      setError(t('manualSession.errorRange', "L'heure de fin doit être après l'heure de début."))
      return
    }
    if (endMs > Date.now()) {
      setError(t('manualSession.errorFuture', 'Impossible de saisir du temps dans le futur.'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await window.electron.ipc.invoke(
        'create-manual-session',
        startMs,
        endMs,
        label.trim() || null,
        projectId ? Number(projectId) : null,
        phaseId ? Number(phaseId) : null,
        billable
      )
      if (result?.ok) {
        onCreated()
      } else if (result?.error === 'overlap') {
        setError(t('manualSession.errorOverlap', 'Cette plage chevauche une session existante.'))
      } else {
        setError(t('manualSession.errorGeneric', "La session n'a pas pu être enregistrée."))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="sr-only" htmlFor="manual-date">{t('manualSession.date', 'Date')}</label>
        <input id="manual-date" type="date" value={date} max={todayString()} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
        <label className="sr-only" htmlFor="manual-start">{t('manualSession.start', 'Début')}</label>
        <input id="manual-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT_CLASS} />
        <span className="text-gray-400" aria-hidden="true">→</span>
        <label className="sr-only" htmlFor="manual-end">{t('manualSession.end', 'Fin')}</label>
        <input id="manual-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT_CLASS} />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('sessionsList.namePlaceholder', 'Nom de la session (ex : Rédaction proposition)')}
          aria-label={t('manualSession.label', 'Nom de la session')}
          className={`${INPUT_CLASS} flex-1 min-w-[12rem]`}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          className="w-44"
          placeholder={t('sessionsList.noProject', 'Aucun projet')}
          options={[{ value: '', label: t('sessionsList.noProject', 'Aucun projet') }, ...projects.map((p) => ({ value: String(p.id), label: p.name, color: p.color }))]}
        />
        {projectId && phases.length > 0 && (
          <Dropdown
            value={phaseId}
            onChange={setPhaseId}
            className="w-40"
            placeholder={t('sessionsList.noPhase', 'Aucune phase')}
            options={[{ value: '', label: t('sessionsList.noPhase', 'Aucune phase') }, ...phases.map((ph) => ({ value: String(ph.id), label: ph.name, color: ph.color }))]}
          />
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="w-4 h-4 rounded accent-[var(--accent-primary)]" />
          {t('sessionsList.billable', 'Facturable')}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
            {t('manualSession.cancel', 'Annuler')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded-lg accent-gradient-bg text-white font-medium hover:brightness-110 transition-all disabled:opacity-50"
          >
            {t('manualSession.add', 'Ajouter')}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <Icon name="alert" size={12} />
          {error}
        </p>
      )}
    </div>
  )
}

export default ManualSessionForm
