import { useEffect, useState } from 'react'
import type { Client, Project, ProjectPhase, WorkSession } from '../../shared/types'
import { Icon, Card, CardHeader, Dropdown, confirmDialog } from './UI'
import { downloadBase64File, downloadTextFile, slugify } from '../utils/download'
import { useTranslation, localeTag } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface ProjectManagerProps {
  clients: Client[]
  onProjectsLoaded?: (projects: Project[]) => void
}

interface Billing {
  monthSeconds: number
  totalSeconds: number
}

interface ProjectSession extends WorkSession {
  billable_seconds: number
}

interface PhaseWithBilling extends ProjectPhase {
  billable_seconds: number
}

function ProjectManager({ clients, onProjectsLoaded }: ProjectManagerProps) {
  const { t, language } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [billing, setBilling] = useState<Record<number, Billing>>({})
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newClientId, setNewClientId] = useState('')
  const [newRate, setNewRate] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newBudgetHours, setNewBudgetHours] = useState('')
  const [newBudgetAmount, setNewBudgetAmount] = useState('')
  const [newDeadline, setNewDeadline] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editKeywords, setEditKeywords] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editRate, setEditRate] = useState('')
  const [editGoal, setEditGoal] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'archived'>('active')
  const [editBudgetHours, setEditBudgetHours] = useState('')
  const [editBudgetAmount, setEditBudgetAmount] = useState('')
  const [editDeadline, setEditDeadline] = useState('')

  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null)
  const [projectSessions, setProjectSessions] = useState<ProjectSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [expandedPhasesId, setExpandedPhasesId] = useState<number | null>(null)
  const [phases, setPhases] = useState<PhaseWithBilling[]>([])
  const [loadingPhases, setLoadingPhases] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseColor, setNewPhaseColor] = useState('#6366f1')
  const [newPhaseKeywords, setNewPhaseKeywords] = useState('')
  const [newPhaseBudgetHours, setNewPhaseBudgetHours] = useState('')
  const [newPhaseBudgetAmount, setNewPhaseBudgetAmount] = useState('')
  const [newPhaseDeadline, setNewPhaseDeadline] = useState('')
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null)
  const [editPhaseName, setEditPhaseName] = useState('')
  const [editPhaseColor, setEditPhaseColor] = useState('#6366f1')
  const [editPhaseKeywords, setEditPhaseKeywords] = useState('')
  const [editPhaseStatus, setEditPhaseStatus] = useState<'active' | 'archived'>('active')
  const [editPhaseBudgetHours, setEditPhaseBudgetHours] = useState('')
  const [editPhaseBudgetAmount, setEditPhaseBudgetAmount] = useState('')
  const [editPhaseDeadline, setEditPhaseDeadline] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const data: Project[] = await window.electron.ipc.invoke('get-projects')
      setProjects(data)
      onProjectsLoaded?.(data)

      const billingEntries = await Promise.all(
        data.map(async (p) => {
          const result = await window.electron.ipc.invoke('get-project-billing', p.id)
          return [p.id, result] as const
        })
      )
      setBilling(Object.fromEntries(billingEntries))
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createProject() {
    if (!newName.trim()) return
    try {
      await window.electron.ipc.invoke(
        'create-project',
        newName,
        newColor,
        newClientId ? Number(newClientId) : null,
        newRate ? Number(newRate) : null,
        newGoal ? Number(newGoal) : null,
        newBudgetHours ? Number(newBudgetHours) : null,
        newBudgetAmount ? Number(newBudgetAmount) : null,
        newDeadline ? new Date(newDeadline).getTime() : null,
        newKeywords || null
      )
      setNewName('')
      setNewKeywords('')
      setNewColor('#6366f1')
      setNewClientId('')
      setNewRate('')
      setNewGoal('')
      setNewBudgetHours('')
      setNewBudgetAmount('')
      setNewDeadline('')
      await loadProjects()
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  function startEditing(project: Project) {
    setEditingId(project.id)
    setEditName(project.name)
    setEditKeywords(project.keywords || '')
    setEditClientId(project.client_id ? String(project.client_id) : '')
    setEditRate(project.hourly_rate !== null && project.hourly_rate !== undefined ? String(project.hourly_rate) : '')
    setEditGoal(project.hour_goal !== null && project.hour_goal !== undefined ? String(project.hour_goal) : '')
    setEditStatus(project.status)
    setEditBudgetHours(project.budget_hours !== null && project.budget_hours !== undefined ? String(project.budget_hours) : '')
    setEditBudgetAmount(project.budget_amount !== null && project.budget_amount !== undefined ? String(project.budget_amount) : '')
    setEditDeadline(project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : '')
  }

  async function saveEditing(project: Project) {
    try {
      await window.electron.ipc.invoke(
        'update-project',
        project.id,
        editName.trim() || project.name,
        project.color,
        editClientId ? Number(editClientId) : null,
        editRate ? Number(editRate) : null,
        editStatus,
        editGoal ? Number(editGoal) : null,
        editBudgetHours ? Number(editBudgetHours) : null,
        editBudgetAmount ? Number(editBudgetAmount) : null,
        editDeadline ? new Date(editDeadline).getTime() : null,
        editKeywords || null
      )
      setEditingId(null)
      await loadProjects()
    } catch (error) {
      console.error('Error updating project:', error)
    }
  }

  async function toggleArchive(project: Project) {
    const nextStatus = project.status === 'active' ? 'archived' : 'active'
    try {
      await window.electron.ipc.invoke(
        'update-project',
        project.id,
        project.name,
        project.color,
        project.client_id,
        project.hourly_rate,
        nextStatus,
        project.hour_goal,
        project.budget_hours,
        project.budget_amount,
        project.deadline
      )
      await loadProjects()
    } catch (error) {
      console.error('Error toggling project status:', error)
    }
  }

  async function toggleSessionsExpand(project: Project) {
    if (expandedProjectId === project.id) {
      setExpandedProjectId(null)
      return
    }
    setExpandedProjectId(project.id)
    setLoadingSessions(true)
    try {
      const data = await window.electron.ipc.invoke('get-project-sessions', project.id)
      setProjectSessions(data)
    } catch (error) {
      console.error('Error loading project sessions:', error)
      setProjectSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  async function loadPhases(projectId: number) {
    setLoadingPhases(true)
    try {
      const data = await window.electron.ipc.invoke('get-project-phases', projectId)
      setPhases(data)
    } catch (error) {
      console.error('Error loading project phases:', error)
      setPhases([])
    } finally {
      setLoadingPhases(false)
    }
  }

  async function togglePhasesExpand(project: Project) {
    if (expandedPhasesId === project.id) {
      setExpandedPhasesId(null)
      return
    }
    setExpandedPhasesId(project.id)
    setEditingPhaseId(null)
    setNewPhaseName('')
    setNewPhaseColor('#6366f1')
    setNewPhaseBudgetHours('')
    setNewPhaseBudgetAmount('')
    setNewPhaseDeadline('')
    await loadPhases(project.id)
  }

  async function createPhase(projectId: number) {
    if (!newPhaseName.trim()) return
    try {
      await window.electron.ipc.invoke(
        'create-project-phase',
        projectId,
        newPhaseName.trim(),
        newPhaseColor,
        newPhaseKeywords || null,
        newPhaseBudgetHours ? Number(newPhaseBudgetHours) : null,
        newPhaseBudgetAmount ? Number(newPhaseBudgetAmount) : null,
        newPhaseDeadline ? new Date(newPhaseDeadline).getTime() : null
      )
      setNewPhaseName('')
      setNewPhaseKeywords('')
      setNewPhaseColor('#6366f1')
      setNewPhaseBudgetHours('')
      setNewPhaseBudgetAmount('')
      setNewPhaseDeadline('')
      await loadPhases(projectId)
    } catch (error) {
      console.error('Error creating project phase:', error)
    }
  }

  function startEditingPhase(phase: PhaseWithBilling) {
    setEditingPhaseId(phase.id)
    setEditPhaseName(phase.name)
    setEditPhaseColor(phase.color)
    setEditPhaseKeywords(phase.keywords || '')
    setEditPhaseStatus(phase.status)
    setEditPhaseBudgetHours(phase.budget_hours !== null && phase.budget_hours !== undefined ? String(phase.budget_hours) : '')
    setEditPhaseBudgetAmount(phase.budget_amount !== null && phase.budget_amount !== undefined ? String(phase.budget_amount) : '')
    setEditPhaseDeadline(phase.deadline ? new Date(phase.deadline).toISOString().slice(0, 10) : '')
  }

  async function savePhase(phase: PhaseWithBilling, projectId: number) {
    try {
      await window.electron.ipc.invoke(
        'update-project-phase',
        phase.id,
        editPhaseName.trim() || phase.name,
        editPhaseColor,
        editPhaseStatus,
        editPhaseKeywords || null,
        editPhaseBudgetHours ? Number(editPhaseBudgetHours) : null,
        editPhaseBudgetAmount ? Number(editPhaseBudgetAmount) : null,
        editPhaseDeadline ? new Date(editPhaseDeadline).getTime() : null
      )
      setEditingPhaseId(null)
      await loadPhases(projectId)
    } catch (error) {
      console.error('Error updating project phase:', error)
    }
  }

  async function togglePhaseArchive(phase: PhaseWithBilling, projectId: number) {
    const nextStatus = phase.status === 'active' ? 'archived' : 'active'
    try {
      await window.electron.ipc.invoke(
        'update-project-phase',
        phase.id,
        phase.name,
        phase.color,
        nextStatus,
        phase.keywords || null,
        phase.budget_hours,
        phase.budget_amount,
        phase.deadline
      )
      await loadPhases(projectId)
    } catch (error) {
      console.error('Error toggling phase status:', error)
    }
  }

  async function deletePhase(phaseId: number, projectId: number) {
    if (
      !(await confirmDialog(t('projectManager.confirmDeletePhase', 'Supprimer cette phase ? Les sessions qui lui étaient rattachées ne seront plus associées à aucune phase.'), {
        danger: true,
      }))
    )
      return
    try {
      await window.electron.ipc.invoke('delete-project-phase', phaseId)
      await loadPhases(projectId)
    } catch (error) {
      console.error('Error deleting project phase:', error)
    }
  }

  async function exportProjectCsv(project: Project) {
    try {
      const csv = await window.electron.ipc.invoke('export-project-csv', project.id)
      downloadTextFile(csv, `akta-${slugify(project.name)}.csv`, 'text/csv')
    } catch (error) {
      console.error('Error exporting project CSV:', error)
    }
  }

  async function exportProjectPdf(project: Project) {
    try {
      const base64 = await window.electron.ipc.invoke('export-project-pdf', project.id)
      downloadBase64File(base64, `akta-${slugify(project.name)}.pdf`, 'application/pdf')
    } catch (error) {
      console.error('Error exporting project PDF:', error)
    }
  }

  async function deleteProject(projectId: number) {
    if (!(await confirmDialog(t('projectManager.confirmDeleteProject', 'Supprimer ce projet ? Les sessions qui lui étaient rattachées ne seront plus associées à aucun projet.'), { danger: true }))) return
    try {
      await window.electron.ipc.invoke('delete-project', projectId)
      await loadProjects()
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
  const clientOptions = [{ value: '', label: t('projectManager.noClient', 'Aucun client') }, ...clients.map((c) => ({ value: String(c.id), label: c.name, color: c.color }))]
  const statusOptions = [
    { value: 'active', label: t('projectManager.statusActive', 'Actif') },
    { value: 'archived', label: t('projectManager.statusArchived', 'Archivé') },
  ]

  const formatHours = (seconds: number) => (seconds / 3600).toFixed(1)
  const formatAmount = (seconds: number, rate: number | null) => {
    if (!rate) return null
    return ((seconds / 3600) * rate).toFixed(2)
  }
  const formatDateTime = (ms: number) =>
    new Date(ms).toLocaleDateString(localeTag(language), { day: '2-digit', month: '2-digit' }) +
    ' ' +
    new Date(ms).toLocaleTimeString(localeTag(language), { hour: '2-digit', minute: '2-digit' })

  const visibleProjects = projects.filter((p) => (showArchived ? true : p.status === 'active'))
  const archivedCount = projects.filter((p) => p.status === 'archived').length

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('projectManager.title', 'Projets')}
        icon={<Icon name="folder" size={18} />}
        subtitle={tf(
          visibleProjects.length === 1 ? t('projectManager.countSingular', '{{n}} projet') : t('projectManager.countPlural', '{{n}} projets'),
          { n: visibleProjects.length }
        )}
      />

      {/* Création */}
      <div className="space-y-3 mb-5 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createProject()}
          placeholder={t('projectManager.namePlaceholder', 'Nom du projet')}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />

        <input
          type="text"
          value={newKeywords}
          onChange={(e) => setNewKeywords(e.target.value)}
          placeholder={t('projectManager.keywordsPlaceholderLong', 'Mots-clefs (ex: Valros, APD) - séparés par virgules')}
          title={t('projectManager.keywordsTitle', "Mots-clefs pour l'auto-détection par nom de fenêtre")}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />

        <div className="flex gap-2">
          <Dropdown value={newClientId} onChange={setNewClientId} options={clientOptions} className="flex-1" placeholder={t('projectManager.noClient', 'Aucun client')} />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            placeholder={t('projectManager.ratePlaceholder', 'Taux €/h')}
            className="w-24 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder={t('projectManager.goalPlaceholder', 'Objectif h/mois')}
            className="w-28 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={newBudgetHours}
            onChange={(e) => setNewBudgetHours(e.target.value)}
            placeholder={t('projectManager.budgetHoursPlaceholder', 'Budget h (forfait)')}
            title={t('projectManager.budgetHoursTitle', 'Budget total en heures pour ce projet')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newBudgetAmount}
            onChange={(e) => setNewBudgetAmount(e.target.value)}
            placeholder={t('projectManager.budgetAmountPlaceholder', 'Budget € (forfait)')}
            title={t('projectManager.budgetAmountTitle', 'Budget total en euros pour ce projet')}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <input
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            title={t('projectManager.deadlineTitle', 'Échéance du projet')}
            className="w-36 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full transition-transform ${newColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onClick={createProject}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all flex-shrink-0"
          >
            {t('projectManager.create', 'Créer')}
          </button>
        </div>
      </div>

      {/* Liste */}
      {visibleProjects.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
          {showArchived ? t('projectManager.noProject', 'Aucun projet') : t('projectManager.noActiveProject', 'Aucun projet actif')}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleProjects.map((project) => {
            const stats = billing[project.id]
            const monthHours = stats ? stats.monthSeconds / 3600 : 0
            const goalProgress = project.hour_goal ? Math.min((monthHours / project.hour_goal) * 100, 100) : null
            const totalHours = stats ? stats.totalSeconds / 3600 : 0
            const totalAmount = project.hourly_rate ? totalHours * project.hourly_rate : null
            const budgetHoursProgress = project.budget_hours ? Math.min((totalHours / project.budget_hours) * 100, 100) : null
            const budgetHoursOver = project.budget_hours ? totalHours > project.budget_hours : false
            const budgetAmountProgress =
              project.budget_amount && totalAmount !== null ? Math.min((totalAmount / project.budget_amount) * 100, 100) : null
            const budgetAmountOver = project.budget_amount && totalAmount !== null ? totalAmount > project.budget_amount : false

            return (
              <div
                key={project.id}
                className={`p-3 rounded-lg border ${project.status === 'archived' ? 'opacity-60' : ''}`}
                style={{ borderColor: project.color, backgroundColor: `${project.color}10` }}
              >
                {editingId === project.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      placeholder={t('projectManager.keywordsPlaceholderShort', 'Mots-clefs (ex: Valros, APD)')}
                      title={t('projectManager.keywordsTitle', "Mots-clefs pour l'auto-détection par nom de fenêtre")}
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <Dropdown value={editClientId} onChange={setEditClientId} options={clientOptions} className="flex-1" placeholder={t('projectManager.noClient', 'Aucun client')} />
                      <Dropdown
                        value={editStatus}
                        onChange={(v) => setEditStatus(v as 'active' | 'archived')}
                        options={statusOptions}
                        className="w-32 flex-shrink-0"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        placeholder={t('projectManager.ratePlaceholder', 'Taux €/h')}
                        className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editGoal}
                        onChange={(e) => setEditGoal(e.target.value)}
                        placeholder={t('projectManager.goalPlaceholder', 'Objectif h/mois')}
                        className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editBudgetHours}
                        onChange={(e) => setEditBudgetHours(e.target.value)}
                        placeholder={t('projectManager.budgetHoursPlaceholder', 'Budget h (forfait)')}
                        title={t('projectManager.budgetHoursTitle', 'Budget total en heures pour ce projet')}
                        className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editBudgetAmount}
                        onChange={(e) => setEditBudgetAmount(e.target.value)}
                        placeholder={t('projectManager.budgetAmountPlaceholder', 'Budget € (forfait)')}
                        title={t('projectManager.budgetAmountTitle', 'Budget total en euros pour ce projet')}
                        className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        type="date"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        title={t('projectManager.deadlineTitle', 'Échéance du projet')}
                        className="w-36 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded font-medium">
                        {t('projectManager.cancel', 'Annuler')}
                      </button>
                      <button onClick={() => saveEditing(project)} className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">
                        {t('projectManager.save', 'Enregistrer')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                            {project.name}
                            {project.status === 'archived' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex-shrink-0">
                                {t('projectManager.statusArchived', 'Archivé')}
                              </span>
                            )}
                            {project.deadline && project.status === 'active' && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                  project.deadline < Date.now()
                                    ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300'
                                }`}
                              >
                                {project.deadline < Date.now() ? `${t('projectManager.overdue', 'En retard')} • ` : `${t('projectManager.deadline', 'Échéance')} `}
                                {new Date(project.deadline).toLocaleDateString(localeTag(language), { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {project.client_name || t('projectManager.noClient', 'Aucun client')}
                            {project.hourly_rate ? ` • ${project.hourly_rate} €/h` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => togglePhasesExpand(project)}
                          title={t('projectManager.projectPhases', 'Phases du projet')}
                          className={`text-gray-400 hover:accent-text transition-colors ${expandedPhasesId === project.id ? 'accent-text' : ''}`}
                        >
                          <Icon name="tag" size={13} />
                        </button>
                        <button
                          onClick={() => toggleArchive(project)}
                          title={project.status === 'active' ? t('projectManager.archive', 'Archiver') : t('projectManager.reactivate', 'Réactiver')}
                          className="text-gray-400 hover:accent-text transition-colors"
                        >
                          <Icon name="layers" size={13} />
                        </button>
                        <button onClick={() => startEditing(project)} className="text-gray-400 hover:accent-text transition-colors">
                          <Icon name="edit" size={13} />
                        </button>
                        <button onClick={() => deleteProject(project.id)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Facturation estimée */}
                    {stats && (stats.monthSeconds > 0 || stats.totalSeconds > 0) && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          {tf(t('projectManager.hoursThisMonth', '{{h}}h ce mois'), { h: formatHours(stats.monthSeconds) })}
                          {formatAmount(stats.monthSeconds, project.hourly_rate) && ` ≈ ${formatAmount(stats.monthSeconds, project.hourly_rate)} €`}
                        </span>
                        <button
                          onClick={() => toggleSessionsExpand(project)}
                          className="flex items-center gap-1 text-gray-400 dark:text-slate-500 hover:accent-text transition-colors"
                        >
                          {tf(t('projectManager.hoursTotal', '{{h}}h au total'), { h: formatHours(stats.totalSeconds) })}
                          {formatAmount(stats.totalSeconds, project.hourly_rate) && ` ≈ ${formatAmount(stats.totalSeconds, project.hourly_rate)} €`}
                          <Icon name={expandedProjectId === project.id ? 'x' : 'chart-bar'} size={11} />
                        </button>
                      </div>
                    )}

                    {/* Détail des sessions du projet */}
                    {expandedProjectId === project.id && (
                      <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-slate-700/50 space-y-1.5">
                        {loadingSessions ? (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                          </div>
                        ) : projectSessions.length === 0 ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 py-1">{t('projectManager.noSessionForProject', 'Aucune session rattachée à ce projet.')}</p>
                        ) : (
                          projectSessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-slate-300 truncate">
                                {session.label || formatDateTime(session.start_time)}
                                {session.end_time === null && ` (${t('sessionsList.inProgress', 'en cours')})`}
                              </span>
                              <span className="text-gray-500 dark:text-slate-400 flex-shrink-0 ml-2">
                                {formatHours(session.duration_seconds || Math.floor((Date.now() - session.start_time) / 1000))}h
                                {formatAmount(session.billable_seconds, project.hourly_rate) &&
                                  ` ≈ ${formatAmount(session.billable_seconds, project.hourly_rate)} €`}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Objectif d'heures */}
                    {goalProgress !== null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{tf(t('projectManager.goalProgress', 'Objectif : {{current}}h / {{goal}}h ce mois'), { current: monthHours.toFixed(1), goal: project.hour_goal ?? 0 })}</span>
                          <span>{Math.round(goalProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${goalProgress}%`, backgroundColor: project.color }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Budget forfaitaire (heures ou montant) */}
                    {budgetHoursProgress !== null && (
                      <div className="mt-2">
                        <div
                          className={`flex items-center justify-between text-xs mb-1 ${
                            budgetHoursOver ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <span>
                            {tf(t('projectManager.budgetHoursProgress', 'Budget : {{current}}h / {{budget}}h'), { current: totalHours.toFixed(1), budget: project.budget_hours ?? 0 })}
                            {budgetHoursOver ? ` • ${t('projectManager.overBudget', 'dépassé')}` : ''}
                          </span>
                          <span>{Math.round(budgetHoursProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${budgetHoursProgress}%`, backgroundColor: budgetHoursOver ? '#ef4444' : project.color }}
                          />
                        </div>
                      </div>
                    )}
                    {budgetAmountProgress !== null && (
                      <div className="mt-2">
                        <div
                          className={`flex items-center justify-between text-xs mb-1 ${
                            budgetAmountOver ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <span>
                            {tf(t('projectManager.budgetAmountProgress', 'Budget : {{current}} € / {{budget}} €'), { current: totalAmount?.toFixed(2) ?? '0', budget: project.budget_amount ?? 0 })}
                            {budgetAmountOver ? ` • ${t('projectManager.overBudget', 'dépassé')}` : ''}
                          </span>
                          <span>{Math.round(budgetAmountProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${budgetAmountProgress}%`, backgroundColor: budgetAmountOver ? '#ef4444' : project.color }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Phases du projet */}
                    {expandedPhasesId === project.id && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-slate-700/50 space-y-2">
                        {loadingPhases ? (
                          <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
                          </div>
                        ) : (
                          <>
                            {phases.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 py-1">{t('projectManager.noPhaseForProject', 'Aucune phase pour ce projet.')}</p>}
                            {phases.map((phase) =>
                              editingPhaseId === phase.id ? (
                                <div key={phase.id} className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={editPhaseName}
                                    onChange={(e) => setEditPhaseName(e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                  />
                                  <input
                                    type="text"
                                    value={editPhaseKeywords}
                                    onChange={(e) => setEditPhaseKeywords(e.target.value)}
                                    placeholder={t('projectManager.phaseKeywordsPlaceholder', 'Mots-clefs (ex: Esquisse, Étude)')}
                                    title={t('projectManager.keywordsTitle', "Mots-clefs pour l'auto-détection par nom de fenêtre")}
                                    className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                  />
                                  <div className="flex gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={editPhaseBudgetHours}
                                      onChange={(e) => setEditPhaseBudgetHours(e.target.value)}
                                      placeholder={t('projectManager.budgetHoursPlaceholderShort', 'Budget h')}
                                      title={t('projectManager.phaseBudgetHoursTitle', 'Budget en heures pour cette phase')}
                                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editPhaseBudgetAmount}
                                      onChange={(e) => setEditPhaseBudgetAmount(e.target.value)}
                                      placeholder={t('projectManager.budgetAmountPlaceholderShort', 'Budget €')}
                                      title={t('projectManager.phaseBudgetAmountTitle', 'Budget en euros pour cette phase')}
                                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="date"
                                      value={editPhaseDeadline}
                                      onChange={(e) => setEditPhaseDeadline(e.target.value)}
                                      title={t('projectManager.phaseDeadlineTitle', 'Échéance de cette phase')}
                                      className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                    <Dropdown
                                      value={editPhaseStatus}
                                      onChange={(v) => setEditPhaseStatus(v as 'active' | 'archived')}
                                      options={statusOptions}
                                      className="w-28 flex-shrink-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex gap-1 flex-shrink-0">
                                    {colors.map((color) => (
                                      <button
                                        key={color}
                                        onClick={() => setEditPhaseColor(color)}
                                        className={`w-4 h-4 rounded-full transition-transform ${editPhaseColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => savePhase(phase, project.id)}
                                    className="text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex-shrink-0"
                                    title={t('projectManager.save', 'Enregistrer')}
                                  >
                                    <Icon name="check" size={13} />
                                  </button>
                                  <button
                                    onClick={() => setEditingPhaseId(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                                    title={t('projectManager.cancel', 'Annuler')}
                                  >
                                    <Icon name="x" size={13} />
                                  </button>
                                  </div>
                                </div>
                              ) : (
                                (() => {
                                  const phaseHours = phase.billable_seconds / 3600
                                  const phaseAmount = project.hourly_rate ? phaseHours * project.hourly_rate : null
                                  const phaseBudgetHoursProgress = phase.budget_hours ? Math.min((phaseHours / phase.budget_hours) * 100, 100) : null
                                  const phaseBudgetHoursOver = phase.budget_hours ? phaseHours > phase.budget_hours : false
                                  const phaseBudgetAmountProgress =
                                    phase.budget_amount && phaseAmount !== null ? Math.min((phaseAmount / phase.budget_amount) * 100, 100) : null
                                  const phaseBudgetAmountOver = phase.budget_amount && phaseAmount !== null ? phaseAmount > phase.budget_amount : false

                                  return (
                                    <div key={phase.id} className={`text-xs ${phase.status === 'archived' ? 'opacity-60' : ''}`}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-1.5 min-w-0 text-gray-700 dark:text-slate-300">
                                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                                          <span className="truncate">{phase.name}</span>
                                          {phase.status === 'archived' && (
                                            <span className="text-[9px] px-1 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex-shrink-0">
                                              {t('projectManager.statusArchived', 'Archivé')}
                                            </span>
                                          )}
                                          {phase.deadline && phase.status === 'active' && (
                                            <span
                                              className={`text-[9px] px-1 py-0.5 rounded-full flex-shrink-0 ${
                                                phase.deadline < Date.now()
                                                  ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300'
                                              }`}
                                            >
                                              {phase.deadline < Date.now() ? `${t('projectManager.overdue', 'En retard')} • ` : ''}
                                              {new Date(phase.deadline).toLocaleDateString(localeTag(language), { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </span>
                                          )}
                                        </span>
                                        <span className="flex items-center gap-2 flex-shrink-0 text-gray-500 dark:text-slate-400">
                                          {formatHours(phase.billable_seconds)}h
                                          <button
                                            onClick={() => togglePhaseArchive(phase, project.id)}
                                            title={phase.status === 'active' ? t('projectManager.archive', 'Archiver') : t('projectManager.reactivate', 'Réactiver')}
                                            className="text-gray-400 hover:accent-text transition-colors"
                                          >
                                            <Icon name="layers" size={12} />
                                          </button>
                                          <button onClick={() => startEditingPhase(phase)} className="text-gray-400 hover:accent-text transition-colors">
                                            <Icon name="edit" size={12} />
                                          </button>
                                          <button
                                            onClick={() => deletePhase(phase.id, project.id)}
                                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                          >
                                            <Icon name="x" size={12} />
                                          </button>
                                        </span>
                                      </div>

                                      {phaseBudgetHoursProgress !== null && (
                                        <div className="mt-1.5">
                                          <div
                                            className={`flex items-center justify-between text-[10px] mb-0.5 ${
                                              phaseBudgetHoursOver ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                          >
                                            <span>
                                              {tf(t('projectManager.budgetHoursProgress', 'Budget : {{current}}h / {{budget}}h'), {
                                                current: phaseHours.toFixed(1),
                                                budget: phase.budget_hours ?? 0,
                                              })}
                                              {phaseBudgetHoursOver ? ` • ${t('projectManager.overBudget', 'dépassé')}` : ''}
                                            </span>
                                            <span>{Math.round(phaseBudgetHoursProgress)}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-500"
                                              style={{ width: `${phaseBudgetHoursProgress}%`, backgroundColor: phaseBudgetHoursOver ? '#ef4444' : phase.color }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {phaseBudgetAmountProgress !== null && (
                                        <div className="mt-1.5">
                                          <div
                                            className={`flex items-center justify-between text-[10px] mb-0.5 ${
                                              phaseBudgetAmountOver ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                          >
                                            <span>
                                              {tf(t('projectManager.budgetAmountProgress', 'Budget : {{current}} € / {{budget}} €'), {
                                                current: phaseAmount?.toFixed(2) ?? '0',
                                                budget: phase.budget_amount ?? 0,
                                              })}
                                              {phaseBudgetAmountOver ? ` • ${t('projectManager.overBudget', 'dépassé')}` : ''}
                                            </span>
                                            <span>{Math.round(phaseBudgetAmountProgress)}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all duration-500"
                                              style={{ width: `${phaseBudgetAmountProgress}%`, backgroundColor: phaseBudgetAmountOver ? '#ef4444' : phase.color }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()
                              )
                            )}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={newPhaseName}
                                  onChange={(e) => setNewPhaseName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && createPhase(project.id)}
                                  placeholder={t('projectManager.newPhasePlaceholder', 'Nouvelle phase (ex : Esquisse)')}
                                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                              </div>
                              <input
                                type="text"
                                value={newPhaseKeywords}
                                onChange={(e) => setNewPhaseKeywords(e.target.value)}
                                placeholder={t('projectManager.phaseKeywordsPlaceholder', 'Mots-clefs (ex: Esquisse, Étude)')}
                                title={t('projectManager.keywordsTitle', "Mots-clefs pour l'auto-détection par nom de fenêtre")}
                                className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                              />
                              <div className="flex gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={newPhaseBudgetHours}
                                  onChange={(e) => setNewPhaseBudgetHours(e.target.value)}
                                  placeholder={t('projectManager.budgetHoursPlaceholderShort', 'Budget h')}
                                  title={t('projectManager.phaseBudgetHoursTitle', 'Budget en heures pour cette phase')}
                                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newPhaseBudgetAmount}
                                  onChange={(e) => setNewPhaseBudgetAmount(e.target.value)}
                                  placeholder={t('projectManager.budgetAmountPlaceholderShort', 'Budget €')}
                                  title={t('projectManager.phaseBudgetAmountTitle', 'Budget en euros pour cette phase')}
                                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                                <input
                                  type="date"
                                  value={newPhaseDeadline}
                                  onChange={(e) => setNewPhaseDeadline(e.target.value)}
                                  title={t('projectManager.phaseDeadlineTitle', 'Échéance de cette phase')}
                                  className="w-28 flex-shrink-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex gap-1 flex-shrink-0">
                                {colors.map((color) => (
                                  <button
                                    key={color}
                                    onClick={() => setNewPhaseColor(color)}
                                    className={`w-4 h-4 rounded-full transition-transform ${newPhaseColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <button
                                onClick={() => createPhase(project.id)}
                                disabled={!newPhaseName.trim()}
                                className="px-2 py-1 text-xs rounded accent-gradient-bg text-white font-medium hover:brightness-110 disabled:opacity-50 transition-all flex-shrink-0"
                              >
                                {t('projectManager.add', 'Ajouter')}
                              </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Export comptable */}
                    {stats && stats.totalSeconds > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-slate-700/50 flex items-center gap-3 text-xs">
                        <span className="text-gray-400 dark:text-slate-500">{t('projectManager.export', 'Exporter :')}</span>
                        <button
                          onClick={() => exportProjectCsv(project)}
                          className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:accent-text transition-colors"
                        >
                          <Icon name="download" size={12} /> CSV
                        </button>
                        <button
                          onClick={() => exportProjectPdf(project)}
                          className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:accent-text transition-colors"
                        >
                          <Icon name="download" size={12} /> PDF
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {archivedCount > 0 && (
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="w-full mt-3 text-xs text-gray-500 dark:text-gray-400 hover:accent-text transition-colors"
        >
          {tf(
            archivedCount === 1
              ? showArchived
                ? t('projectManager.hideArchivedSingular', 'Masquer le {{n}} projet archivé')
                : t('projectManager.showArchivedSingular', 'Afficher le {{n}} projet archivé')
              : showArchived
                ? t('projectManager.hideArchivedPlural', 'Masquer les {{n}} projets archivés')
                : t('projectManager.showArchivedPlural', 'Afficher les {{n}} projets archivés'),
            { n: archivedCount }
          )}
        </button>
      )}
    </Card>
  )
}

export default ProjectManager
