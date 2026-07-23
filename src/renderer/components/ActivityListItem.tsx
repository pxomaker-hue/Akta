import { useState } from 'react'
import type { Activity, Category } from '../../shared/types'
import { DESIGN } from '../../shared/design'
import CategoryIcon from './CategoryIcon'
import TagBadges from './TagBadges'
import { Badge, Icon, Dropdown } from './UI'

interface Tag {
  id: number
  name: string
  color: string
}

interface ActivityListItemProps {
  activity: Activity
  categories: Category[]
  tags?: Tag[]
  allTags?: Tag[]
  onCategoryChange: () => void
  onTagsChange?: () => void
}

function ActivityListItem({ activity, categories, tags = [], allTags = [], onCategoryChange, onTagsChange }: ActivityListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const isSameCalendarDay = (msA: number, msB: number) => {
    const a = new Date(msA)
    const b = new Date(msB)
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }
  const isToday = (ms: number) => isSameCalendarDay(ms, Date.now())
  const formatTimeOnly = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const formatDateOnly = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const selectedCategory = activity.category_id ? categories.find((c) => c.id === activity.category_id) : null

  const handleCategoryChange = async (categoryId: number | null) => {
    setIsUpdating(true)
    try {
      await window.electron.ipc.invoke('update-activity-category', activity.id, categoryId)
      onCategoryChange()
    } catch (error) {
      console.error('Error updating category:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    setIsUpdating(true)
    try {
      await window.electron.ipc.invoke('delete-activity', activity.id)
      onCategoryChange()
    } catch (error) {
      console.error('Error deleting activity:', error)
      setIsUpdating(false)
    }
  }

  const handleToggleBillable = async () => {
    setIsUpdating(true)
    try {
      await window.electron.ipc.invoke('update-activity-billable', activity.id, !activity.billable)
      onCategoryChange()
    } catch (error) {
      console.error('Error updating billable status:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:shadow-md ${
        selectedCategory
          ? `bg-gradient-to-r from-white dark:from-gray-800 border-l-4`
          : 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800 border-gray-200 dark:border-gray-700'
      }`}
      style={selectedCategory ? { borderLeftColor: selectedCategory.color } : {}}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icône catégorie */}
          {selectedCategory && (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${selectedCategory.color}20` }}>
              <CategoryIcon categoryName={selectedCategory.name} size={20} color={selectedCategory.color} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">{activity.app_name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{activity.window_title}</p>

            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              {activity.end_time && !isSameCalendarDay(activity.start_time, activity.end_time) ? (
                // L'activité s'étend sur plusieurs jours : plage de dates puis plage d'heures,
                // affichées séparément pour rester lisibles (concaténer date+heure sur chaque borne
                // est redondant et brouille la lecture).
                <>
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    {formatDateOnly(activity.start_time)} → {formatDateOnly(activity.end_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="clock" size={12} />
                    {formatTimeOnly(activity.start_time)} → {formatTimeOnly(activity.end_time)}
                  </span>
                </>
              ) : (
                <>
                  {!isToday(activity.start_time) && (
                    <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">{formatDateOnly(activity.start_time)}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon name="clock" size={12} />
                    {formatTimeOnly(activity.start_time)}
                  </span>
                  {activity.end_time && <span>→ {formatTimeOnly(activity.end_time)}</span>}
                </>
              )}
              <span className="ml-auto font-medium text-gray-700 dark:text-gray-200">{formatDuration(activity.duration_seconds)}</span>
            </div>

            {/* Tags */}
            {(tags.length > 0 || allTags.length > 0) && (
              <div className="mt-3">
                <TagBadges
                  activityId={activity.id}
                  tags={tags}
                  allTags={allTags}
                  onTagsChange={onTagsChange}
                  editable={true}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0 w-40">
          <Dropdown
            value={activity.category_id ? String(activity.category_id) : ''}
            onChange={(v) => handleCategoryChange(v ? Number(v) : null)}
            disabled={isUpdating}
            placeholder="Catégoriser"
            options={[
              { value: '', label: 'Catégoriser' },
              ...categories.map((category) => ({ value: String(category.id), label: category.name, color: category.color })),
            ]}
          />

          {selectedCategory && (
            <button
              onClick={handleToggleBillable}
              disabled={isUpdating}
              title="Cliquer pour changer le statut facturable"
              className="disabled:opacity-50 w-full flex justify-center"
            >
              <Badge variant={activity.billable ? 'primary' : 'neutral'} icon={<Icon name="briefcase" size={12} />}>
                {activity.billable ? 'Facturable' : 'Personnel'}
              </Badge>
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={isUpdating}
            title="Supprimer cette activité"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
          >
            <Icon name="trash" size={13} />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

export default ActivityListItem
