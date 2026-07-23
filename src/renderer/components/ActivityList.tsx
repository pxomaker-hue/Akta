import { useState, useEffect, useCallback } from 'react'
import type { Activity, Category } from '../../shared/types'
import ActivityListItem from './ActivityListItem'
import { Icon, confirmDialog } from './UI'

interface Tag {
  id: number
  name: string
  color: string
}

interface ActivityListProps {
  activities: Activity[]
  categories: Category[]
  loading: boolean
  onActivityUpdate: () => void
}

function ActivityList({ activities, categories, loading, onActivityUpdate }: ActivityListProps) {
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<number | null>(null)
  const [isDeletingUncategorized, setIsDeletingUncategorized] = useState(false)
  const [isDeletingToday, setIsDeletingToday] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [activityTags, setActivityTags] = useState<Map<number, Tag[]>>(new Map())
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('') // format 'YYYY-MM-DD', vide = pas de filtre
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Date locale au format 'YYYY-MM-DD' (pas toISOString, qui bascule sur UTC et peut décaler le
  // jour selon le fuseau horaire — on veut la date telle que l'utilisateur la voit)
  const toLocalDateString = (ms: number) => {
    const d = new Date(ms)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const loadTags = useCallback(async () => {
    try {
      const [tags, tagsByActivity] = await Promise.all([
        window.electron.ipc.invoke('get-tags'),
        window.electron.ipc.invoke(
          'get-tags-for-activities',
          activities.map((a) => a.id)
        ),
      ])
      setAllTags(tags)

      const tagsMap = new Map<number, Tag[]>()
      for (const [activityId, activityTagsList] of Object.entries(tagsByActivity as Record<string, Tag[]>)) {
        tagsMap.set(Number(activityId), activityTagsList)
      }
      setActivityTags(tagsMap)
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }, [activities])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  // Revenir à la première page quand le filtre change, sinon on peut se retrouver avec une page
  // vide (visibleCount hérité d'une liste plus longue avant filtrage)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedTagFilter, searchQuery, selectedDate])

  const hasInvalidActivities = activities.some(
    (a) => a.app_name === 'Unknown' || a.app_name.toLowerCase().includes('akta') || a.window_title.toLowerCase().includes('akta')
  )
  const uncategorizedCount = activities.filter((a) => !a.category_id).length

  const handleCleanup = async () => {
    setIsCleaning(true)
    setCleanResult(null)
    try {
      const deleted = await window.electron.ipc.invoke('delete-invalid-activities')
      setCleanResult(deleted)
      onActivityUpdate()
    } finally {
      setIsCleaning(false)
    }
  }

  const handleDeleteUncategorized = async () => {
    if (!(await confirmDialog(`Supprimer les ${uncategorizedCount} activité${uncategorizedCount !== 1 ? 's' : ''} non catégorisée${uncategorizedCount !== 1 ? 's' : ''} ?`, { danger: true }))) return
    setIsDeletingUncategorized(true)
    try {
      await window.electron.ipc.invoke('delete-uncategorized-activities')
      onActivityUpdate()
    } finally {
      setIsDeletingUncategorized(false)
    }
  }

  const handleDeleteToday = async () => {
    if (!(await confirmDialog('Supprimer toutes les activités enregistrées aujourd\'hui ? Cette action est irréversible.', { danger: true }))) return
    setIsDeletingToday(true)
    try {
      await window.electron.ipc.invoke('delete-today-activities')
      onActivityUpdate()
    } finally {
      setIsDeletingToday(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Chargement des activités...</p>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Aucune activité pour le moment. Utilise ton ordinateur pour démarrer le suivi !</p>
        </div>
      </div>
    )
  }

  // Filtre par date, puis par tag, puis par recherche texte (nom d'appli ou titre de fenêtre)
  const query = searchQuery.trim().toLowerCase()
  const filteredActivities = activities.filter((a) => {
    if (selectedDate && toLocalDateString(a.start_time) !== selectedDate) return false
    if (selectedTagFilter) {
      const tags = activityTags.get(a.id) || []
      if (!tags.some((t) => t.id === selectedTagFilter)) return false
    }
    if (query && !a.app_name.toLowerCase().includes(query) && !a.window_title.toLowerCase().includes(query)) {
      return false
    }
    return true
  })
  const isFiltered = !!selectedTagFilter || !!query || !!selectedDate

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activités récentes</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isFiltered ? `${filteredActivities.length} / ${activities.length}` : activities.length} activités
        </span>
      </div>

      {/* Actions de nettoyage */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasInvalidActivities && (
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
          >
            <Icon name="alert" size={12} />
            {isCleaning ? 'Nettoyage...' : 'Nettoyer les entrées invalides'}
          </button>
        )}

        {uncategorizedCount > 0 && (
          <button
            onClick={handleDeleteUncategorized}
            disabled={isDeletingUncategorized}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <Icon name="trash" size={12} />
            {isDeletingUncategorized ? 'Suppression...' : `Supprimer les non catégorisées (${uncategorizedCount})`}
          </button>
        )}

        <button
          onClick={handleDeleteToday}
          disabled={isDeletingToday}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
        >
          <Icon name="trash" size={12} />
          {isDeletingToday ? 'Suppression...' : 'Effacer les activités du jour'}
        </button>
      </div>

      {cleanResult !== null && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Icon name="check" size={14} />
          {cleanResult} activité{cleanResult !== 1 ? 's' : ''} supprimée{cleanResult !== 1 ? 's' : ''}.
        </p>
      )}

      {/* Recherche + filtre par date */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par application ou titre de fenêtre..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <Icon name="calendar" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate('')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icon name="x" size={12} />
            Réinitialiser la date
          </button>
        )}
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Filtrer par tag :</span>
          <button
            onClick={() => setSelectedTagFilter(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedTagFilter === null
                ? 'accent-gradient-bg text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600'
            }`}
          >
            Tous
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium text-white transition-all ${
                selectedTagFilter === tag.id ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filteredActivities.length === 0 && isFiltered ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">Aucune activité ne correspond à ce filtre</p>
        ) : (
          filteredActivities.slice(0, visibleCount).map((activity) => (
          <ActivityListItem
            key={activity.id}
            activity={activity}
            categories={categories}
            tags={activityTags.get(activity.id) || []}
            allTags={allTags}
            onCategoryChange={onActivityUpdate}
            onTagsChange={loadTags}
          />
          ))
        )}
      </div>

      {filteredActivities.length > visibleCount && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Voir plus ({filteredActivities.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  )
}

export default ActivityList
