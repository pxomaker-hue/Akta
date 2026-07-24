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

const BROWSER_KEYWORDS = new Set(['chrome', 'firefox', 'edge', 'safari', 'brave', 'opera'])

export function findMatchingCategory(appName: string, windowTitle: string): MatchResult | null {
  const db = getDatabase()
  const rows = db.prepare('SELECT id, name, billable_default, match_rules, is_distraction FROM categories').all() as any[]

  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  console.log(`[CategoryMatch] App: "${appName}", Title: "${windowTitle}"`)

  let browserMatch: { id: number; billable: boolean; isDistraction: boolean; name: string } | null = null

  // Priority 1: Match app_name (looking for native apps or browsers)
  for (const row of rows) {
    let rules: { type: string; keyword: string }[] = []
    try {
      rules = JSON.parse(row.match_rules || '[]')
    } catch {
      continue
    }

    const appNameRules = rules.filter((r) => r.type === 'app_name')
    if (appNameRules.length > 0) {
      console.log(`[CategoryMatch] Category "${row.name}": checking app_name rules [${appNameRules.map((r) => r.keyword).join(', ')}]`)
    }

    for (const rule of appNameRules) {
      const keyword = rule.keyword?.toLowerCase().trim()
      if (!keyword) continue
      if (appLower.includes(keyword)) {
        console.log(`[CategoryMatch] ✓ App match: "${keyword}" → "${row.name}"`)
        // If it's a browser, save it but continue looking for something more specific
        if (BROWSER_KEYWORDS.has(keyword)) {
          browserMatch = { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction, name: row.name }
          console.log(`[CategoryMatch] Browser detected (${keyword}), will check window_title for more specific content...`)
          break // Break inner loop to check next category
        } else {
          // Non-browser native app, return immediately
          return { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction }
        }
      }
    }
  }

  // Priority 2: If we found a browser, check window_title (excluding the browser keyword)
  if (browserMatch) {
    const browserAppName = appLower
    console.log(`[CategoryMatch] Checking window_title to find content (excluding browser)...`)

    for (const row of rows) {
      let rules: { type: string; keyword: string }[] = []
      try {
        rules = JSON.parse(row.match_rules || '[]')
      } catch {
        continue
      }

      const windowTitleRules = rules.filter((r) => r.type === 'window_title')
      if (windowTitleRules.length > 0) {
        console.log(`[CategoryMatch] Category "${row.name}": checking window_title rules [${windowTitleRules.map((r) => r.keyword).join(', ')}]`)
      }

      for (const rule of windowTitleRules) {
        const keyword = rule.keyword?.toLowerCase().trim()
        if (!keyword) continue
        // Skip the browser name itself to avoid false positives
        if (BROWSER_KEYWORDS.has(keyword)) continue
        if (titleLower.includes(keyword)) {
          console.log(`[CategoryMatch] ✓ Window title match: "${keyword}" → "${row.name}" (more specific than browser)`)
          return { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction }
        }
      }
    }

    // No specific content found, use the browser categorization
    console.log(`[CategoryMatch] No specific content found, using browser default → "${browserMatch.name}"`)
    return browserMatch
  }

  // Priority 3: If no app_name match at all, check window_title
  console.log(`[CategoryMatch] No app_name match, checking window_title...`)
  for (const row of rows) {
    let rules: { type: string; keyword: string }[] = []
    try {
      rules = JSON.parse(row.match_rules || '[]')
    } catch {
      continue
    }

    const windowTitleRules = rules.filter((r) => r.type === 'window_title')
    for (const rule of windowTitleRules) {
      const keyword = rule.keyword?.toLowerCase().trim()
      if (!keyword) continue
      if (titleLower.includes(keyword)) {
        console.log(`[CategoryMatch] ✓ Window title match: "${keyword}" → "${row.name}"`)
        return { id: row.id, billable: !!row.billable_default, isDistraction: !!row.is_distraction }
      }
    }
  }

  console.log(`[CategoryMatch] No match found`)
  return null
}

export function findMatchingProject(appName: string, windowTitle: string): ProjectMatchResult | null {
  const db = getDatabase()
  const projects = db.prepare("SELECT id, name, keywords FROM projects WHERE keywords IS NOT NULL AND keywords != ''").all() as ProjectRow[]

  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  console.log(`[ProjectMatch] Searching for match - App: "${appName}", Window: "${windowTitle}"`)
  console.log(`[ProjectMatch] Found ${projects.length} projects with keywords`)

  // Priority 1: Match windowTitle first
  for (const project of projects) {
    const keywords = project.keywords ? project.keywords.split(',').map((k) => k.trim().toLowerCase()).filter((k) => k) : []
    console.log(`[ProjectMatch] Project "${project.name}": keywords=[${keywords.join(', ')}]`)
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        console.log(`[ProjectMatch] ✓ Window title matches keyword "${keyword}"`)
        // Try to find a matching phase by keywords or name in the window title
        const phases = db.prepare('SELECT id, name, keywords FROM project_phases WHERE project_id = ?').all(project.id) as any[]
        for (const phase of phases) {
          // Priority 1: Check phase keywords
          const phaseKeywords = phase.keywords ? phase.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k) : []
          for (const phaseKeyword of phaseKeywords) {
            if (titleLower.includes(phaseKeyword)) {
              console.log(`[ProjectMatch] ✓ Phase "${phase.name}" matched by keyword "${phaseKeyword}"`)
              return { projectId: project.id, phaseId: phase.id }
            }
          }
          // Priority 2: Check phase name
          if (titleLower.includes(phase.name.toLowerCase())) {
            console.log(`[ProjectMatch] ✓ Phase "${phase.name}" matched by name`)
            return { projectId: project.id, phaseId: phase.id }
          }
        }
        // No phase matched, return just the project
        console.log(`[ProjectMatch] ✓ Project matched (no phase)`)
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
