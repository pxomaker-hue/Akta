import type { Activity } from './types'

export interface DeepWorkSession {
  start_time: number
  end_time: number
  duration_seconds: number
  category_id: number
  activity_ids: number[]
}

const GAP_TOLERANCE_MS = 3 * 60 * 1000 // petites coupures tolérées dans une même session
const MIN_DEEP_WORK_SECONDS = 15 * 60 // 15 min minimum pour compter comme deep work

export function computeDeepWorkSessions(activities: Activity[]): DeepWorkSession[] {
  const categorized = activities
    .filter((a) => a.category_id !== null && a.end_time !== null)
    .sort((a, b) => a.start_time - b.start_time)

  const sessions: DeepWorkSession[] = []
  let current: DeepWorkSession | null = null

  for (const activity of categorized) {
    if (current && current.category_id === activity.category_id && activity.start_time - current.end_time <= GAP_TOLERANCE_MS) {
      current.end_time = activity.end_time as number
      current.duration_seconds += activity.duration_seconds
      current.activity_ids.push(activity.id)
    } else {
      if (current && current.duration_seconds >= MIN_DEEP_WORK_SECONDS) sessions.push(current)
      current = {
        start_time: activity.start_time,
        end_time: activity.end_time as number,
        duration_seconds: activity.duration_seconds,
        category_id: activity.category_id as number,
        activity_ids: [activity.id],
      }
    }
  }

  if (current && current.duration_seconds >= MIN_DEEP_WORK_SECONDS) sessions.push(current)

  return sessions
}
