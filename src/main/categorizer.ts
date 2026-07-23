import { getDatabase } from './database'

interface CategoryRow {
  id: number
  billable_default: number
  match_rules: string
  is_distraction: number
}

interface MatchResult {
  id: number
  billable: boolean
  isDistraction: boolean
}

interface ProjectMatchResult {
  projectId: number
  phaseId?: number
}

interface ProjectRow {
  id: number
  name: string
  keywords: string
}

interface PhaseRow {
  id: number
  name: string
}

export function findMatchingCategory(appName: string, windowTitle: string): MatchResult | null {
  const db = getDatabase()
  const rows = db.prepare('SELECT id, billable_default, match_rules, is_distraction FROM categories').all() as CategoryRow[]

  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  // Priority 1: Match windowTitle first
  for (const row of rows) {
    let rules: { type: string; keyword: string }[] = []
    try {
      rules = JSON.parse(row.match_rules || '[]')
    } catch {
      continue
    }

    for (const rule of rules) {
      const keyword = rule.keyword?.toLowerCase().trim()
      if (!keyword) continue
      if (titleLower.includes(keyword)) {
        return { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction }
      }
    }
  }

  // Priority 2: Fallback to appName
  for (const row of rows) {
    let rules: { type: string; keyword: string }[] = []
    try {
      rules = JSON.parse(row.match_rules || '[]')
    } catch {
      continue
    }

    for (const rule of rules) {
      const keyword = rule.keyword?.toLowerCase().trim()
      if (!keyword) continue
      if (appLower.includes(keyword)) {
        return { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction }
      }
    }
  }

  return null
}

export function findMatchingProject(appName: string, windowTitle: string): ProjectMatchResult | null {
  const db = getDatabase()
  const projects = db.prepare('SELECT id, name, keywords FROM projects WHERE keywords IS NOT NULL AND keywords != ""').all() as ProjectRow[]

  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  // Priority 1: Match windowTitle first
  for (const project of projects) {
    const keywords = project.keywords ? project.keywords.split(',').map((k) => k.trim().toLowerCase()).filter((k) => k) : []
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        // Try to find a matching phase by name in the window title
        const phases = db.prepare('SELECT id, name FROM project_phases WHERE project_id = ?').all(project.id) as PhaseRow[]
        for (const phase of phases) {
          if (titleLower.includes(phase.name.toLowerCase())) {
            return { projectId: project.id, phaseId: phase.id }
          }
        }
        // No phase matched, return just the project
        return { projectId: project.id }
      }
    }
  }

  // Priority 2: Fallback to appName
  for (const project of projects) {
    const keywords = project.keywords ? project.keywords.split(',').map((k) => k.trim().toLowerCase()).filter((k) => k) : []
    for (const keyword of keywords) {
      if (appLower.includes(keyword)) {
        return { projectId: project.id }
      }
    }
  }

  return null
}
