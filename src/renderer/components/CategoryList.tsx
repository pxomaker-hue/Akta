import { useState } from 'react'
import type { Category } from '../../shared/types'
import { Icon, confirmDialog } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface CategoryListProps {
  categories: Category[]
  onUpdate: () => void
}

const PREDEFINED_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
]

function CategoryList({ categories, onUpdate }: CategoryListProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState('')
  const [draftBillable, setDraftBillable] = useState(false)
  const [draftKeywords, setDraftKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [isApplying, setIsApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const startEditing = (category: Category) => {
    setEditingId(category.id)
    setDraftName(category.name)
    setDraftColor(category.color)
    setDraftBillable(category.billable_default)
    setDraftKeywords([...new Set(category.match_rules.map((r) => r.keyword))])
    setNewKeyword('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDraftName('')
    setDraftColor('')
    setDraftBillable(false)
    setDraftKeywords([])
    setNewKeyword('')
  }

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim()
    if (trimmed && !draftKeywords.includes(trimmed)) {
      setDraftKeywords([...draftKeywords, trimmed])
    }
    setNewKeyword('')
  }

  const saveChanges = async (categoryId: number) => {
    const pending = newKeyword.trim()
    const finalKeywords = pending && !draftKeywords.includes(pending) ? [...draftKeywords, pending] : draftKeywords

    setIsSaving(true)
    try {
      await Promise.all([
        window.electron.ipc.invoke('update-category', categoryId, draftName, draftColor, draftBillable),
        window.electron.ipc.invoke('update-category-keywords', categoryId, finalKeywords),
      ])
      setEditingId(null)
      setNewKeyword('')
      onUpdate()
    } catch (error) {
      console.error('Error saving category:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (!(await confirmDialog(tf(t('categoryList.confirmDelete', 'Supprimer la catégorie "{{name}}" ?'), { name: category.name }), { danger: true }))) return
    setIsDeleting(category.id)
    try {
      await window.electron.ipc.invoke('delete-category', category.id)
      onUpdate()
    } catch (error) {
      console.error('Error deleting category:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const handleApplyAutoCategorization = async () => {
    setIsApplying(true)
    setApplyResult(null)
    try {
      const updated = await window.electron.ipc.invoke('apply-auto-categorization')
      setApplyResult(updated)
      onUpdate()
    } finally {
      setIsApplying(false)
    }
  }

  const handleToggleDistraction = async (category: Category) => {
    await window.electron.ipc.invoke('update-category-distraction', category.id, !category.is_distraction)
    onUpdate()
  }

  if (categories.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow p-6 mt-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon name="folder" size={18} className="accent-text" />
          {t('categoryList.title', 'Catégories existantes')}
        </h3>
        <button
          onClick={handleApplyAutoCategorization}
          disabled={isApplying}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 accent-gradient-bg hover:brightness-110 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex-shrink-0"
        >
          <Icon name="refresh" size={13} className={isApplying ? 'animate-spin' : ''} />
          {isApplying ? t('categoryList.applying', 'Application...') : t('categoryList.recategorize', 'Recatégoriser')}
        </button>
      </div>

      {applyResult !== null && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1.5">
          <Icon name="check" size={14} />
          {tf(
            applyResult === 1
              ? t('categoryList.applyResultSingular', '{{n}} activité catégorisée automatiquement.')
              : t('categoryList.applyResultPlural', '{{n}} activités catégorisées automatiquement.'),
            { n: applyResult }
          )}
        </p>
      )}

      <div className="space-y-3">
        {categories.map((category) => (
          <div key={category.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
            {editingId === category.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('categoryList.name', 'Nom')}</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('categoryForm.colorLabel', 'Couleur')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {PREDEFINED_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraftColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${draftColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-300 dark:border-slate-600'}`}
                        style={{ backgroundColor: c }}
                        disabled={isSaving}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`billable-${category.id}`}
                    checked={draftBillable}
                    onChange={(e) => setDraftBillable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    disabled={isSaving}
                  />
                  <label htmlFor={`billable-${category.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    {t('categoryList.billableDefault', 'Facturable par défaut')}
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`distraction-${category.id}`}
                    checked={category.is_distraction}
                    onChange={(e) => handleToggleDistraction(category)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500 cursor-pointer"
                    disabled={isSaving}
                  />
                  <label htmlFor={`distraction-${category.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    {t('categoryList.distractionShort', 'Distraction — jamais facturable')}
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('categoryForm.keywordsLabel', 'Mots-clés (auto-catégorisation)')}</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddKeyword()
                          }
                        }}
                        placeholder={t('categoryForm.keywordsPlaceholder', 'ex : vscode, figma, slack')}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        disabled={isSaving}
                      />
                      <button
                        onClick={handleAddKeyword}
                        disabled={!newKeyword.trim() || isSaving}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded font-medium disabled:opacity-50 transition-colors"
                      >
                        {t('categoryForm.add', 'Ajouter')}
                      </button>
                    </div>
                    {draftKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {draftKeywords.map((keyword) => (
                          <div
                            key={keyword}
                            className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-2 py-0.5 rounded-full text-xs"
                          >
                            {keyword}
                            <button
                              onClick={() => setDraftKeywords(draftKeywords.filter((k) => k !== keyword))}
                              className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
                              disabled={isSaving}
                            >
                              <Icon name="x" size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => saveChanges(category.id)}
                    disabled={isSaving}
                    className="flex-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? t('categoryList.saving', 'Enregistrement...') : t('projectManager.save', 'Enregistrer')}
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    disabled={isSaving || isDeleting === category.id}
                    className="px-3 py-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="trash" size={12} className="mr-1 inline" />
                    {t('activityListItem.delete', 'Supprimer')}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="px-3 py-2 text-xs bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded font-medium hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                  >
                    {t('projectManager.cancel', 'Annuler')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
                    <span className="font-medium text-gray-900 dark:text-white truncate">{category.name}</span>
                    {category.is_distraction && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex-shrink-0">
                        <Icon name="alert" size={9} />
                        {t('liveSession.distractionOverride', 'Distraction')}
                      </span>
                    )}
                    {category.billable_default && !category.is_distraction && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
                        💰
                        {t('sessionsList.billable', 'Facturable')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEditing(category)}
                      className="p-1.5 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                      title={t('categoryList.editTitle', 'Éditer')}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                </div>

                {category.match_rules.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[...new Set(category.match_rules.map((rule) => rule.keyword))].map((keyword) => (
                      <span
                        key={keyword}
                        className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CategoryList
