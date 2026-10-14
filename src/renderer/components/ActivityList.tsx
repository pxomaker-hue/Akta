import { useState, useEffect, useCallback } from 'react'
import type { Activity, Category } from '../../shared/types'
import ActivityListItem from './ActivityListItem'
import { Icon, confirmDialog } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

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
  const { t } = useTranslation()
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<number | null>(null)
  const [isDeletingUncategorized, setIsDeletingUncategorized] = useState(false)
  const [isDeletingToday, setIsDeletingToday] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [activityTags, setActivityTags] = useState<Map<number, Tag[]>>(new Map())
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null | 'uncategorized'>(null)
  const [selectedBillableFilter, setSelectedBillableFilter] = useState<'professional' | 'personal' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDateStart, setSelectedDateStart] = useState('')
  const [selectedDateEnd, setSelectedDateEnd] = useState('')
  const [showFilters, setShowFilters] = useState<'date' | 'categories' | 'tags' | 'billable' | false>(false)
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
  }, [selectedTagFilter, selectedCategoryFilter, selectedBillableFilter, searchQuery, selectedDateStart, selectedDateEnd])

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
    const confirmMsg = tf(
      uncategorizedCount === 1
        ? t('activityList.confirmDeleteUncategorizedSingular', 'Supprimer {{n}} activité non catégorisée ?')
        : t('activityList.confirmDeleteUncategorizedPlural', 'Supprimer les {{n}} activités non catégorisées ?'),
      { n: uncategorizedCount }
    )
    if (!(await confirmDialog(confirmMsg, { danger: true }))) return
    setIsDeletingUncategorized(true)
    try {
      await window.electron.ipc.invoke('delete-uncategorized-activities')
      onActivityUpdate()
    } finally {
      setIsDeletingUncategorized(false)
    }
  }

  const handleDeleteToday = async () => {
    if (!(await confirmDialog(t('activityList.confirmDeleteToday', "Supprimer toutes les activités enregistrées aujourd'hui ? Cette action est irréversible."), { danger: true }))) return
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
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('activityList.loading', 'Chargement des activités...')}</p>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">{t('activityList.empty', 'Aucune activité pour le moment. Utilise ton ordinateur pour démarrer le suivi !')}</p>
        </div>
      </div>
    )
  }

  // Filtre par date, catégorie, tag, billable, puis par recherche texte (nom d'appli ou titre de fenêtre)
  const query = searchQuery.trim().toLowerCase()
  const filteredActivities = activities.filter((a) => {
    if (selectedDateStart || selectedDateEnd) {
      const activityDate = toLocalDateString(a.start_time)
      if (selectedDateStart && activityDate < selectedDateStart) return false
      if (selectedDateEnd && activityDate > selectedDateEnd) return false
    }
    if (selectedCategoryFilter !== null) {
      if (selectedCategoryFilter === 'uncategorized') {
        if (a.category_id) return false
      } else {
        if (a.category_id !== selectedCategoryFilter) return false
      }
    }
    if (selectedTagFilter) {
      const tags = activityTags.get(a.id) || []
      if (!tags.some((t) => t.id === selectedTagFilter)) return false
    }
    if (selectedBillableFilter) {
      if (selectedBillableFilter === 'professional' && !a.billable) return false
      if (selectedBillableFilter === 'personal' && a.billable) return false
    }
    if (query && !a.app_name.toLowerCase().includes(query) && !a.window_title.toLowerCase().includes(query)) {
      return false
    }
    return true
  })
  const isFiltered = !!selectedCategoryFilter || !!selectedTagFilter || !!selectedBillableFilter || !!query || !!selectedDateStart || !!selectedDateEnd

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('activityList.title', 'Activités récentes')}</h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isFiltered ? `${filteredActivities.length} / ${activities.length}` : activities.length} {t('activityList.activitiesWord', 'activités')}
        </span>
      </div>

      {/* Boutons de suppression */}
      {(hasInvalidActivities || uncategorizedCount > 0 || true) && (
        <div className="flex gap-1.5 flex-wrap">
          {hasInvalidActivities && (
            <button
              onClick={handleCleanup}
              disabled={isCleaning}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
            >
              <Icon name="alert" size={12} />
              {isCleaning ? t('activityList.cleaning', 'Nettoyage...') : t('activityList.clean', 'Nettoyer')}
            </button>
          )}

          {uncategorizedCount > 0 && (
            <button
              onClick={handleDeleteUncategorized}
              disabled={isDeletingUncategorized}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Icon name="trash" size={12} />
              {isDeletingUncategorized ? t('activityList.deleting', 'Suppression...') : tf(t('activityList.uncategorizedCount', 'Non catég. ({{n}})'), { n: uncategorizedCount })}
            </button>
          )}

          <button
            onClick={handleDeleteToday}
            disabled={isDeletingToday}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
          >
            <Icon name="trash" size={12} />
            {isDeletingToday ? t('activityList.deleting', 'Suppression...') : t('activityList.clearToday', 'Effacer du jour')}
          </button>

          {cleanResult !== null && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Icon name="check" size={12} />
              {tf(
                cleanResult === 1
                  ? t('activityList.deletedResultSingular', '{{n}} supprimée.')
                  : t('activityList.deletedResultPlural', '{{n}} supprimées.'),
                { n: cleanResult }
              )}
            </p>
          )}
        </div>
      )}

      {/* Recherche rapide */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('activityList.searchPlaceholder', 'Rechercher par application ou titre de fenêtre...')}
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

      {/* Pills de filtres */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('activityList.filters', 'Filtres :')}</span>

        {/* Date */}
        <button
          onClick={() => setShowFilters(showFilters === 'date' ? false : 'date')}
          className={`px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            selectedDateStart || selectedDateEnd
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          <Icon name="calendar" size={12} />
          {t('activityList.dateRange', 'Plage')} {(selectedDateStart || selectedDateEnd) && '✓'}
        </button>

        {/* Catégories */}
        {categories.length > 0 && (
          <button
            onClick={() => setShowFilters(showFilters === 'categories' ? false : 'categories')}
            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedCategoryFilter
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.categoriesFilter', 'Catégories')} {selectedCategoryFilter && '✓'}
          </button>
        )}

        {/* Tags */}
        {allTags.length > 0 && (
          <button
            onClick={() => setShowFilters(showFilters === 'tags' ? false : 'tags')}
            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedTagFilter
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.tagsFilter', 'Tags')} {selectedTagFilter && '✓'}
          </button>
        )}

        {/* Billable */}
        <button
          onClick={() => setShowFilters(showFilters === 'billable' ? false : 'billable')}
          className={`px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
            selectedBillableFilter
              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          {t('activityList.billableFilter', 'Facturation')} {selectedBillableFilter && '✓'}
        </button>
      </div>

      {/* Filtres expandables */}
      {showFilters === 'date' && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('activityList.dateFrom', 'De:')}</span>
            <input
              type="date"
              value={selectedDateStart}
              onChange={(e) => setSelectedDateStart(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
            {selectedDateStart && (
              <button
                onClick={() => setSelectedDateStart('')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t('activityList.dateTo', 'À:')}</span>
            <input
              type="date"
              value={selectedDateEnd}
              onChange={(e) => setSelectedDateEnd(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
            {selectedDateEnd && (
              <button
                onClick={() => setSelectedDateEnd('')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {showFilters === 'categories' && categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <button
            onClick={() => setSelectedCategoryFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedCategoryFilter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.all', 'Tous')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors`}
              style={{
                backgroundColor: selectedCategoryFilter === cat.id ? cat.color : `${cat.color}20`,
                color: selectedCategoryFilter === cat.id ? 'white' : cat.color,
              }}
            >
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => setSelectedCategoryFilter('uncategorized')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedCategoryFilter === 'uncategorized'
                ? 'bg-gray-400 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.uncategorizedOption', 'Non catégorisées')}
          </button>
        </div>
      )}

      {showFilters === 'tags' && allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <button
            onClick={() => setSelectedTagFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedTagFilter === null
                ? 'accent-gradient-bg text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.all', 'Tous')}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagFilter(selectedTagFilter === tag.id ? null : tag.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium text-white transition-all ${
                selectedTagFilter === tag.id ? 'ring-2 ring-offset-2 ring-gray-400 scale-105' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {showFilters === 'billable' && (
        <div className="flex gap-1.5 flex-wrap p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <button
            onClick={() => setSelectedBillableFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedBillableFilter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.all', 'Tous')}
          </button>
          <button
            onClick={() => setSelectedBillableFilter('professional')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedBillableFilter === 'professional'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.professionalOption', 'Professionnel')}
          </button>
          <button
            onClick={() => setSelectedBillableFilter('personal')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedBillableFilter === 'personal'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('activityList.personalOption', 'Personnel')}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filteredActivities.length === 0 && isFiltered ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('activityList.noMatch', 'Aucune activité ne correspond à ce filtre')}</p>
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
            {t('activityList.seeMore', 'Voir plus')} ({filteredActivities.length - visibleCount} {t('activityList.remaining', 'restantes')})
          </button>
        </div>
      )}
    </div>
  )
}

export default ActivityList
