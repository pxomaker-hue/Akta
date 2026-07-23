import { useState } from 'react'
import type { Category } from '../../shared/types'
import { Icon, confirmDialog } from './UI'

interface CategoryManagerProps {
  categories: Category[]
  onUpdate: () => void
}

interface EditingCategory {
  id: number
  name: string
  color: string
  billable: boolean
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

function CategoryManager({ categories, onUpdate }: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<EditingCategory | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = (category: Category) => {
    setEditingId(category.id)
    setEditingData({
      id: category.id,
      name: category.name,
      color: category.color,
      billable: category.billable_default,
    })
  }

  const handleSave = async () => {
    if (!editingData) return
    setIsSaving(true)
    try {
      await window.electron.ipc.invoke('update-category', editingData.id, editingData.name, editingData.color, editingData.billable)
      setEditingId(null)
      setEditingData(null)
      onUpdate()
    } catch (error) {
      console.error('Error updating category:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    if (!(await confirmDialog(`Supprimer la catégorie "${category.name}" ?`, { danger: true }))) return
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

  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Aucune catégorie créée pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          {editingId === cat.id && editingData ? (
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isSaving}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
                <div className="flex gap-2">
                  {PREDEFINED_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingData({ ...editingData, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${editingData.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-300 dark:border-slate-600'}`}
                      style={{ backgroundColor: c }}
                      disabled={isSaving}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`billable-${cat.id}`}
                  checked={editingData.billable}
                  onChange={(e) => setEditingData({ ...editingData, billable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  disabled={isSaving}
                />
                <label htmlFor={`billable-${cat.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Facturable par défaut
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-2 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditingId(null)
                    setEditingData(null)
                  }}
                  disabled={isSaving}
                  className="px-3 py-2 text-xs bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{cat.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cat.is_distraction && <span className="inline-block mr-2">🚫 Distraction</span>}
                    {cat.billable_default && !cat.is_distraction && <span className="inline-block">💰 Facturable</span>}
                    {!cat.is_distraction && !cat.billable_default && <span className="inline-block">Personal</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(cat)}
                  className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Éditer"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={isDeleting === cat.id}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Supprimer"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export default CategoryManager
