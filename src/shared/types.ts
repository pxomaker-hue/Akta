export interface Activity {
  id: number
  app_name: string
  window_title: string
  category_id: number | null
  start_time: number // milliseconds
  end_time: number | null
  duration_seconds: number
  billable: boolean | null
}

export interface Category {
  id: number
  name: string
  color: string
  billable_default: boolean
  match_rules: MatchRule[]
  is_distraction: boolean
}

export interface MatchRule {
  type: 'app_name' | 'window_title'
  keyword: string
}

export interface FocusSession {
  id: number
  start_time: number
  end_time: number | null
  planned_duration: number // seconds
  completed: boolean
  blocked_apps: string[] // JSON array of app names
  project_id?: number | null
  phase_id?: number | null
}

export interface ActivityWithCategory extends Activity {
  category?: Category | null
}

export interface WorkSession {
  id: number
  start_time: number
  end_time: number | null
  duration_seconds: number
  billable: boolean | null
  label: string | null
  project_id: number | null
  project_name?: string | null
  project_color?: string | null
  project_hourly_rate?: number | null
  phase_id?: number | null
  phase_name?: string | null
  phase_color?: string | null
  category_overrides?: string | null
}

export interface ProjectPhase {
  id: number
  project_id: number
  name: string
  color: string
  keywords?: string | null
  status: 'active' | 'archived'
  created_at: number
}

export interface Client {
  id: number
  name: string
  color: string
}

export interface Project {
  id: number
  name: string
  color: string
  keywords?: string | null
  client_id: number | null
  hourly_rate: number | null
  status: 'active' | 'archived'
  hour_goal: number | null
  budget_hours: number | null
  budget_amount: number | null
  deadline: number | null
  client_name?: string | null
  client_color?: string | null
}
