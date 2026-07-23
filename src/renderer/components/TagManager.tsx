import { useEffect, useState } from 'react'
import { Icon, confirmDialog } from './UI'

interface Tag {
  id: number
  name: string
  color: string
}

interface TagManagerProps {
  onTagsLoaded?: (tags: Tag[]) => void
}

function TagManager({ onTagsLoaded }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    try {
      const tagsData = await window.electron.ipc.invoke('get-tags')
      setTags(tagsData)
      onTagsLoaded?.(tagsData)
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return

    try {
      const tagId = await window.electron.ipc.invoke('create-tag', newTagName, newTagColor)
      setNewTagName('')
      setNewTagColor('#6366f1')
      await loadTags()
    } catch (error) {
      console.error('Error creating tag:', error)
    }
  }

  async function deleteTag(tagId: number) {
    if (!(await confirmDialog('Supprimer ce tag ?', { danger: true }))) return

    try {
      await window.electron.ipc.invoke('delete-tag', tagId)
      await loadTags()
    } catch (error) {
      console.error('Error deleting tag:', error)
    }
  }

  const colors = [
    '#6366f1', // Indigo
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
  ]

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Créer un tag */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="plus" size={18} className="accent-text" />
          Créer un tag
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nom</label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createTag()}
              placeholder="Entrer le nom du tag..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-10 h-10 rounded-full transition-transform ${newTagColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <button
            onClick={createTag}
            disabled={!newTagName.trim()}
            className="w-full px-4 py-2.5 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Créer le tag
          </button>
        </div>
      </div>

      {/* Liste des tags */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="tag" size={18} className="accent-text" />
          Tags ({tags.length})
        </h3>

        {tags.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">Aucun tag créé</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border hover:shadow-sm transition-shadow flex-shrink-0"
                style={{ borderColor: tag.color, backgroundColor: tag.color + '10' }}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{tag.name}</span>
                <button
                  onClick={() => deleteTag(tag.id)}
                  className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TagManager
