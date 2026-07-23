import { useEffect, useState } from 'react'
import { Icon, confirmDialog } from './UI'

interface Exclusion {
  id: number
  app_pattern: string | null
  title_pattern: string | null
  description: string | null
  created_at: number
}

function InactivityExclusionsManager() {
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [appPattern, setAppPattern] = useState('')
  const [titlePattern, setTitlePattern] = useState('')
  const [description, setDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    loadExclusions()
  }, [])

  async function loadExclusions() {
    try {
      setLoading(true)
      const data = await window.electron.ipc.invoke('get-inactivity-exclusions')
      setExclusions(data)
    } catch (error) {
      console.error('Error loading exclusions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!appPattern && !titlePattern) {
      alert('Au moins un pattern (app ou titre) est requis')
      return
    }

    setIsAdding(true)
    try {
      await window.electron.ipc.invoke('add-inactivity-exclusion',
        appPattern || null,
        titlePattern || null,
        description || undefined
      )
      setAppPattern('')
      setTitlePattern('')
      setDescription('')
      setShowForm(false)
      await loadExclusions()
    } catch (error) {
      console.error('Error adding exclusion:', error)
      alert('Erreur lors de l\'ajout de l\'exclusion')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(id: number) {
    if (!await confirmDialog('Supprimer cette exclusion d\'inactivité ?')) return

    try {
      await window.electron.ipc.invoke('remove-inactivity-exclusion', id)
      await loadExclusions()
    } catch (error) {
      console.error('Error deleting exclusion:', error)
      alert('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exclusions d'inactivité</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Applications/fenêtres où tu ne bouges pas mais où tu es actif (vidéos, tutos, etc.)
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium flex-shrink-0"
        >
          <Icon name="plus" size={16} />
          Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pattern d'application (ex: youtube, vlc, netflix)
            </label>
            <input
              type="text"
              value={appPattern}
              onChange={(e) => setAppPattern(e.target.value)}
              placeholder="youtube"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recherche insensible à la casse sur le nom de l'app</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pattern de titre de fenêtre (ex: "video")
            </label>
            <input
              type="text"
              value={titlePattern}
              onChange={(e) => setTitlePattern(e.target.value)}
              placeholder="video"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recherche insensible à la casse sur le titre</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optionnel)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Regarder des vidéos"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {isAdding ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {exclusions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Aucune exclusion d'inactivité configurée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exclusions.map((exclusion) => (
            <div
              key={exclusion.id}
              className="flex items-start justify-between p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 flex-wrap">
                  {exclusion.app_pattern && (
                    <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded font-mono">
                      app: {exclusion.app_pattern}
                    </span>
                  )}
                  {exclusion.title_pattern && (
                    <span className="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded font-mono">
                      title: {exclusion.title_pattern}
                    </span>
                  )}
                </div>
                {exclusion.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{exclusion.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(exclusion.id)}
                className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                title="Supprimer"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InactivityExclusionsManager
