import { useState } from 'react'
import { Icon } from './UI'

interface CategoryFormProps {
  onCategoryCreated: () => void
}

function CategoryForm({ onCategoryCreated }: CategoryFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [billable, setBillable] = useState(false)
  const [isDistraction, setIsDistraction] = useState(false)
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword))
  }

  const predefinedColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Le nom de la catégorie est requis')
      return
    }

    setIsLoading(true)
    try {
      await window.electron.ipc.invoke('create-category', name, color, billable, keywords, isDistraction)
      setName('')
      setColor('#3b82f6')
      setBillable(false)
      setIsDistraction(false)
      setKeywords([])
      onCategoryCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création de la catégorie')
      console.error('Error creating category:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow p-6 border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Icon name="plus" size={18} className="accent-text" />
        Créer une nouvelle catégorie
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Input */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nom de la catégorie
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex : Développement, Réunions, Apprentissage"
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Couleur
          </label>
          <div className="flex gap-2 flex-wrap">
            {predefinedColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-all ${color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-300 dark:border-slate-600'}`}
                style={{ backgroundColor: c }}
                disabled={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Billable Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="billable"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            disabled={isLoading}
          />
          <label htmlFor="billable" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Marquer les activités de cette catégorie comme facturables par défaut
          </label>
        </div>

        {/* Distraction Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isDistraction"
            checked={isDistraction}
            onChange={(e) => setIsDistraction(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500 cursor-pointer"
            disabled={isLoading}
          />
          <label htmlFor="isDistraction" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Distraction — jamais facturable, même durant une session facturable, avec rappel de focus
          </label>
        </div>

        {/* Auto-categorization Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mots-clés (auto-catégorisation)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Les activités dont le nom d'app ou le titre contient un de ces mots seront catégorisées automatiquement.
          </p>
          <div className="flex gap-2 mb-2">
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
              placeholder="ex : vscode, figma, slack"
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddKeyword}
              disabled={isLoading || !newKeyword.trim()}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              Ajouter
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <div
                  key={keyword}
                  className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-3 py-1 rounded-full text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <Icon name="alert" size={14} />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full accent-gradient-bg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all"
        >
          {isLoading ? 'Création...' : 'Créer la catégorie'}
        </button>
      </form>
    </div>
  )
}

export default CategoryForm
