import { useEffect, useState } from 'react'

interface Tag {
  id: number
  name: string
  color: string
}

interface TagBadgesProps {
  activityId: number
  tags?: Tag[]
  allTags?: Tag[]
  onTagsChange?: (tags: Tag[]) => void
  editable?: boolean
}

function TagBadges({ activityId, tags = [], allTags = [], onTagsChange, editable = false }: TagBadgesProps) {
  const [activityTags, setActivityTags] = useState<Tag[]>(tags)
  const [availableTags, setAvailableTags] = useState<Tag[]>(allTags)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (tags.length > 0) {
      setActivityTags(tags)
    }
  }, [tags])

  useEffect(() => {
    if (allTags.length > 0) {
      setAvailableTags(allTags)
    }
  }, [allTags])

  async function addTag(tag: Tag) {
    try {
      await window.electron.ipc.invoke('add-tag-to-activity', activityId, tag.id)
      const updated = [...activityTags, tag]
      setActivityTags(updated)
      onTagsChange?.(updated)
      setShowDropdown(false)
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  async function removeTag(tagId: number) {
    try {
      await window.electron.ipc.invoke('remove-tag-from-activity', activityId, tagId)
      const updated = activityTags.filter((t) => t.id !== tagId)
      setActivityTags(updated)
      onTagsChange?.(updated)
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  const unusedTags = availableTags.filter((t) => !activityTags.find((at) => at.id === t.id))

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Tags actuels */}
      {activityTags.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          {editable && (
            <button
              onClick={() => removeTag(tag.id)}
              className="ml-1 hover:opacity-70 font-bold"
              title="Retirer le tag"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {/* Bouton ajouter tag */}
      {editable && unusedTags.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-2 py-1 rounded-full text-sm font-medium border-2 border-dashed border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors"
          >
            + Ajouter
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-10">
              {unusedTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag)}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TagBadges
