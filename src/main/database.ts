import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'akta.db')
  db = new Database(dbPath)

  // Activer les clés étrangères
  db.pragma('foreign_keys = ON')
  // WAL : évite la corruption en cas d'accès concurrent par plusieurs process
  db.pragma('journal_mode = WAL')

  createTables()
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Base de données non initialisée')
  }
  return db
}

function createTables() {
  if (!db) return

  // Table catégories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      billable_default INTEGER NOT NULL,
      match_rules TEXT NOT NULL DEFAULT '[]',
      is_distraction INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Migration : ajoute la colonne si la table existait déjà sans elle
  try {
    db.exec(`ALTER TABLE categories ADD COLUMN is_distraction INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // colonne déjà présente
  }
  try {
    // Date de dernière modification, utilisée par la fusion de synchro pour trancher entre deux
    // versions concurrentes d'une même catégorie (la plus récente gagne).
    db.exec(`ALTER TABLE categories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE categories SET updated_at = ${Date.now()} WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }

  // Table activités
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      window_title TEXT NOT NULL,
      category_id INTEGER,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_seconds INTEGER NOT NULL,
      billable INTEGER,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `)

  // Table clients — pour la gestion de projet interne
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER NOT NULL
    )
  `)

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE clients SET updated_at = created_at WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }

  // Table projets — gestion de projet interne, pour rattacher les sessions actives
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER NOT NULL,
      client_id INTEGER,
      hourly_rate REAL,
      status TEXT NOT NULL DEFAULT 'active',
      hour_goal REAL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `)

  // Migration : ajoute les colonnes si la table existait déjà sans elles
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN client_id INTEGER REFERENCES clients(id)`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN hourly_rate REAL`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN hour_goal REAL`)
  } catch {
    // colonne déjà présente
  }
  try {
    // Budget total du projet (par opposition à hour_goal, qui est un rythme MENSUEL) : "40h de
    // forfait pour ce dossier", pour déclencher une alerte de dépassement une fois consommé.
    db.exec(`ALTER TABLE projects ADD COLUMN budget_hours REAL`)
  } catch {
    // colonne déjà présente
  }
  try {
    // Budget en montant fixe (forfait en €), alternative à budget_hours pour les missions au forfait
    db.exec(`ALTER TABLE projects ADD COLUMN budget_amount REAL`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN deadline INTEGER`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE projects SET updated_at = created_at WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE projects ADD COLUMN keywords TEXT`)
  } catch {
    // colonne déjà présente
  }

  // Table des phases/sous-tâches d'un projet (ex : Esquisse, PC, DCE, Chantier) — permet de
  // ventiler le temps d'un même projet plus finement qu'un simple total.
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `)

  try {
    db.exec(`ALTER TABLE project_phases ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE project_phases SET updated_at = created_at WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }

  // Table sessions de travail (start/pause/stop) — entités persistées, comptabilisables et facturables
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      billable INTEGER,
      label TEXT,
      project_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `)

  // Migration : ajoute les colonnes si la table existait déjà sans elles
  try {
    db.exec(`ALTER TABLE work_sessions ADD COLUMN label TEXT`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE work_sessions ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
  } catch {
    // colonne déjà présente
  }
  try {
    // Surcharges de catégories propres à cette session (JSON : { [categoryId]: 'focus' | 'distraction' })
    db.exec(`ALTER TABLE work_sessions ADD COLUMN category_overrides TEXT`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE work_sessions ADD COLUMN phase_id INTEGER REFERENCES project_phases(id)`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE work_sessions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE work_sessions SET updated_at = start_time WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }

  // Table des pauses au sein d'une session de travail (manuelles ou dues à l'inactivité)
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
    )
  `)

  // Table sessions focus
  db.exec(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      planned_duration INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      blocked_apps TEXT NOT NULL DEFAULT '[]'
    )
  `)

  try {
    db.exec(`ALTER TABLE focus_sessions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE focus_sessions SET updated_at = start_time WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE focus_sessions ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
  } catch {
    // colonne déjà présente
  }
  try {
    db.exec(`ALTER TABLE focus_sessions ADD COLUMN phase_id INTEGER REFERENCES project_phases(id)`)
  } catch {
    // colonne déjà présente
  }

  // Table paramètres utilisateur
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Table défis focus (leaderboard, milestones, streaks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS focus_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      duration TEXT NOT NULL,
      reward_points INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER,
      active INTEGER NOT NULL DEFAULT 1
    )
  `)

  // Progression des défis par jour
  db.exec(`
    CREATE TABLE IF NOT EXISTS challenge_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL REFERENCES focus_challenges(id),
      date INTEGER NOT NULL,
      value INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Streaks et milestones personnels
  db.exec(`
    CREATE TABLE IF NOT EXISTS focus_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      unlocked_at INTEGER,
      progress INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Table tags
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER NOT NULL
    )
  `)

  try {
    db.exec(`ALTER TABLE tags ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`)
    db.exec(`UPDATE tags SET updated_at = created_at WHERE updated_at = 0`)
  } catch {
    // colonne déjà présente
  }

  // Table des suppressions ("tombstones") pour la synchro entre machines : sans ça, une entité
  // supprimée localement mais encore présente dans le fichier de synchro (car pas encore vue par les
  // autres machines) serait réimportée à chaque fusion au lieu de rester supprimée.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      entity_type TEXT NOT NULL,
      natural_key TEXT NOT NULL,
      deleted_at INTEGER NOT NULL,
      PRIMARY KEY (entity_type, natural_key)
    )
  `)

  // Table exclusions d'inactivité (apps/fenêtres où on ne bouge pas mais on est actif)
  db.exec(`
    CREATE TABLE IF NOT EXISTS inactivity_exclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_pattern TEXT,
      title_pattern TEXT,
      description TEXT,
      created_at INTEGER NOT NULL,
      CHECK (app_pattern IS NOT NULL OR title_pattern IS NOT NULL)
    )
  `)

  // Table liaison activités-tags
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_tags (
      activity_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (activity_id, tag_id),
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `)

  // Créer indices pour performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time);
    CREATE INDEX IF NOT EXISTS idx_activities_category_id ON activities(category_id);
    CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_work_sessions_start_time ON work_sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_activity_tags_activity ON activity_tags(activity_id);
    CREATE INDEX IF NOT EXISTS idx_activity_tags_tag ON activity_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_session_pauses_session_id ON session_pauses(session_id);
  `)

  seedDefaultCategories()
  seedDefaultSettings()
}

interface DefaultCategory {
  name: string
  color: string
  billable: boolean
  keywords: string[]
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Développement',
    color: '#3b82f6',
    billable: true,
    keywords: ['code', 'vscode', 'visual studio', 'terminal', 'powershell', 'cmd', 'github', 'gitlab', 'git', 'intellij', 'pycharm', 'webstorm', 'sublime', 'vim', 'docker', 'node', 'npm'],
  },
  {
    name: 'Communication',
    color: '#10b981',
    billable: false,
    keywords: ['slack', 'discord', 'teams', 'zoom', 'outlook', 'gmail', 'mail', 'whatsapp', 'messenger', 'skype'],
  },
  {
    name: 'Navigation web',
    color: '#f59e0b',
    billable: false,
    keywords: ['chrome', 'firefox', 'edge', 'safari', 'brave', 'opera'],
  },
  {
    name: 'Design',
    color: '#8b5cf6',
    billable: true,
    keywords: ['figma', 'photoshop', 'illustrator', 'sketch', 'canva', 'xd', 'indesign', 'affinity'],
  },
  {
    name: 'Bureautique',
    color: '#06b6d4',
    billable: true,
    keywords: ['word', 'excel', 'powerpoint', 'notion', 'docs', 'sheets', 'pdf', 'acrobat', 'onenote', 'obsidian'],
  },
  {
    name: 'Divertissement',
    color: '#ec4899',
    billable: false,
    keywords: ['youtube', 'netflix', 'spotify', 'crunchyroll', 'steam', 'twitch', 'prime video', 'disney'],
  },
]

function seedDefaultCategories() {
  if (!db) return

  const existsStmt = db.prepare('SELECT 1 FROM categories WHERE name = ?')
  const insertStmt = db.prepare(`
    INSERT INTO categories (name, color, billable_default, match_rules, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const category of DEFAULT_CATEGORIES) {
    if (existsStmt.get(category.name)) continue
    const matchRules = category.keywords.map((keyword) => ({ type: 'app_name', keyword }))
    insertStmt.run(category.name, category.color, category.billable ? 1 : 0, JSON.stringify(matchRules), Date.now())
  }
}

function seedDefaultSettings() {
  if (!db) return

  const defaults: Record<string, string> = {
    theme: 'dark',
    language: 'fr',
    idle_timeout: '180',
    notifications_deep_work: 'true',
    notifications_distraction: 'true',
    onboarding_completed: 'false',
    focus_coaching_mode: 'tdah',
  }

  const insertStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaults)) {
    insertStmt.run(key, value)
  }
}

export function getSetting(key: string): string | null {
  if (!db) return null
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  const result = stmt.get(key) as any
  return result ? result.value : null
}

export function setSetting(key: string, value: string): void {
  if (!db) return
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  stmt.run(key, value)
}

export function getAllSettings(): Record<string, string> {
  if (!db) return {}
  const stmt = db.prepare('SELECT key, value FROM settings')
  const rows = stmt.all() as any[]
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

export function createTag(name: string, color: string = '#6366f1'): number {
  if (!db) throw new Error('Database not initialized')
  const now = Date.now()
  const stmt = db.prepare('INSERT INTO tags (name, color, created_at, updated_at) VALUES (?, ?, ?, ?)')
  const result = stmt.run(name, color, now, now)
  return Number(result.lastInsertRowid)
}

export function getTags(): any[] {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM tags ORDER BY name')
  return stmt.all() as any[]
}

export function getTagsByActivity(activityId: number): any[] {
  if (!db) return []
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    JOIN activity_tags at ON t.id = at.tag_id
    WHERE at.activity_id = ?
    ORDER BY t.name
  `)
  return stmt.all(activityId) as any[]
}

// Récupère les tags de plusieurs activités en une seule requête (évite le N+1 côté renderer
// quand la liste d'activités s'allonge — un aller-retour IPC par activité devient très coûteux)
export function getTagsForActivities(activityIds: number[]): Record<number, any[]> {
  if (!db || activityIds.length === 0) return {}
  const placeholders = activityIds.map(() => '?').join(',')
  const stmt = db.prepare(`
    SELECT at.activity_id as activity_id, t.* FROM tags t
    JOIN activity_tags at ON t.id = at.tag_id
    WHERE at.activity_id IN (${placeholders})
    ORDER BY t.name
  `)
  const rows = stmt.all(...activityIds) as any[]
  const result: Record<number, any[]> = {}
  for (const row of rows) {
    const { activity_id, ...tag } = row
    if (!result[activity_id]) result[activity_id] = []
    result[activity_id].push(tag)
  }
  return result
}

export function addTagToActivity(activityId: number, tagId: number): void {
  if (!db) return
  const stmt = db.prepare('INSERT OR IGNORE INTO activity_tags (activity_id, tag_id) VALUES (?, ?)')
  stmt.run(activityId, tagId)
}

export function removeTagFromActivity(activityId: number, tagId: number): void {
  if (!db) return
  const stmt = db.prepare('DELETE FROM activity_tags WHERE activity_id = ? AND tag_id = ?')
  stmt.run(activityId, tagId)
}

export function deleteTag(tagId: number): void {
  if (!db) return
  const tag = db.prepare('SELECT name FROM tags WHERE id = ?').get(tagId) as any
  if (tag) recordSyncTombstone('tag', tag.name)
  db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
}

export function createWorkSession(startTime: number): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare('INSERT INTO work_sessions (start_time, end_time, duration_seconds, billable, updated_at) VALUES (?, NULL, 0, NULL, ?)')
  const result = stmt.run(startTime, startTime)
  return Number(result.lastInsertRowid)
}

// ---- Pauses d'une session de travail ----

export function createSessionPause(sessionId: number, startTime: number): number {
  if (!db) throw new Error('Database not initialized')
  const stmt = db.prepare('INSERT INTO session_pauses (session_id, start_time, end_time, duration_seconds) VALUES (?, ?, NULL, 0)')
  const result = stmt.run(sessionId, startTime)
  return Number(result.lastInsertRowid)
}

export function endSessionPause(pauseId: number, endTime: number): void {
  if (!db) return
  const pause = db.prepare('SELECT start_time FROM session_pauses WHERE id = ?').get(pauseId) as any
  if (!pause) return
  const durationSeconds = Math.max(Math.floor((endTime - pause.start_time) / 1000), 0)
  db.prepare('UPDATE session_pauses SET end_time = ?, duration_seconds = ? WHERE id = ?').run(endTime, durationSeconds, pauseId)
}

export function getSessionPauses(sessionId: number): any[] {
  if (!db) return []
  return db.prepare('SELECT * FROM session_pauses WHERE session_id = ? ORDER BY start_time ASC').all(sessionId) as any[]
}

// Toutes les pauses (toutes sessions confondues) chevauchant une plage donnée — utilisé par la courbe de flow
export function getPausesInRange(startMs: number, endMs: number): any[] {
  if (!db) return []
  const stmt = db.prepare(`
    SELECT sp.* FROM session_pauses sp
    JOIN work_sessions ws ON sp.session_id = ws.id
    WHERE ws.start_time <= ? AND (ws.end_time IS NULL OR ws.end_time >= ?)
    ORDER BY sp.start_time ASC
  `)
  return stmt.all(endMs, startMs) as any[]
}

export function getSessionPausedSeconds(sessionId: number, nowMs: number): number {
  if (!db) return 0
  const pauses = getSessionPauses(sessionId)
  let total = 0
  for (const p of pauses) {
    total += p.end_time !== null ? p.duration_seconds : Math.max(Math.floor((nowMs - p.start_time) / 1000), 0)
  }
  return total
}

// ---- Clients ----

export function createClient(name: string, color: string = '#6366f1'): number {
  if (!db) throw new Error('Database not initialized')
  const now = Date.now()
  const stmt = db.prepare('INSERT INTO clients (name, color, created_at, updated_at) VALUES (?, ?, ?, ?)')
  const result = stmt.run(name, color, now, now)
  return Number(result.lastInsertRowid)
}

export function getClients(): any[] {
  if (!db) return []
  return db.prepare('SELECT * FROM clients ORDER BY name').all() as any[]
}

export function deleteClient(clientId: number): void {
  if (!db) return
  const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(clientId) as any
  if (client) recordSyncTombstone('client', client.name)
  db.prepare('DELETE FROM clients WHERE id = ?').run(clientId)
}

// ---- Projets ----

export function createProject(
  name: string,
  color: string = '#6366f1',
  clientId: number | null = null,
  hourlyRate: number | null = null,
  hourGoal: number | null = null,
  budgetHours: number | null = null,
  budgetAmount: number | null = null,
  deadline: number | null = null,
  keywords: string | null = null
): number {
  if (!db) throw new Error('Database not initialized')
  const now = Date.now()
  const stmt = db.prepare(
    'INSERT INTO projects (name, color, created_at, client_id, hourly_rate, status, hour_goal, budget_hours, budget_amount, deadline, updated_at, keywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const result = stmt.run(name, color, now, clientId, hourlyRate, 'active', hourGoal, budgetHours, budgetAmount, deadline, now, keywords)
  return Number(result.lastInsertRowid)
}

export function updateProject(
  projectId: number,
  name: string,
  color: string,
  clientId: number | null,
  hourlyRate: number | null,
  status: string,
  hourGoal: number | null,
  budgetHours: number | null = null,
  budgetAmount: number | null = null,
  deadline: number | null = null
): void {
  if (!db) return
  const stmt = db.prepare(
    'UPDATE projects SET name = ?, color = ?, client_id = ?, hourly_rate = ?, status = ?, hour_goal = ?, budget_hours = ?, budget_amount = ?, deadline = ?, updated_at = ? WHERE id = ?'
  )
  stmt.run(name, color, clientId, hourlyRate, status, hourGoal, budgetHours, budgetAmount, deadline, Date.now(), projectId)
}

export function getProjects(): any[] {
  if (!db) return []
  return db
    .prepare(
      `SELECT p.*, c.name AS client_name, c.color AS client_color
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       ORDER BY p.status ASC, p.name ASC`
    )
    .all() as any[]
}

export function getProjectById(projectId: number): any | null {
  if (!db) return null
  return (
    (db
      .prepare(
        `SELECT p.*, c.name AS client_name, c.color AS client_color
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = ?`
      )
      .get(projectId) as any) || null
  )
}

export function deleteProject(projectId: number): void {
  if (!db) return
  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId) as any
  if (project) recordSyncTombstone('project', project.name)
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
}

// ---- Phases de projet ----

export function createProjectPhase(projectId: number, name: string, color: string = '#6366f1'): number {
  if (!db) throw new Error('Database not initialized')
  const now = Date.now()
  const stmt = db.prepare('INSERT INTO project_phases (project_id, name, color, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
  const result = stmt.run(projectId, name, color, 'active', now, now)
  return Number(result.lastInsertRowid)
}

export function getProjectPhases(projectId: number): any[] {
  if (!db) return []
  return db.prepare('SELECT * FROM project_phases WHERE project_id = ? ORDER BY status ASC, created_at ASC').all(projectId) as any[]
}

export function updateProjectPhase(phaseId: number, name: string, color: string, status: string): void {
  if (!db) return
  db.prepare('UPDATE project_phases SET name = ?, color = ?, status = ?, updated_at = ? WHERE id = ?').run(name, color, status, Date.now(), phaseId)
}

export function deleteProjectPhase(phaseId: number): void {
  if (!db) return
  const phase = db
    .prepare(`SELECT ph.name AS phase_name, p.name AS project_name FROM project_phases ph JOIN projects p ON p.id = ph.project_id WHERE ph.id = ?`)
    .get(phaseId) as any
  if (phase) recordSyncTombstone('project_phase', `${phase.project_name}::${phase.phase_name}`)
  db.prepare('DELETE FROM project_phases WHERE id = ?').run(phaseId)
}

// Heures facturables cumulées sur les sessions rattachées à une phase donnée (même logique que
// getProjectBillableSeconds, mais filtrée sur work_sessions.phase_id)
export function getPhaseBillableSeconds(phaseId: number): number {
  if (!db) return 0
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(a.duration_seconds), 0) AS total
    FROM activities a
    JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
    WHERE ws.phase_id = ? AND a.billable = 1
  `)
  const row = stmt.get(Date.now(), phaseId) as any
  return row?.total || 0
}

// Heures facturables (source de vérité : activities.billable) accumulées dans les sessions d'un projet,
// depuis une date donnée (0 = depuis toujours). Sert au calcul du montant estimé et de l'objectif d'heures.
export function getProjectBillableSeconds(projectId: number, sinceMs: number): number {
  if (!db) return 0
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(a.duration_seconds), 0) AS total
    FROM activities a
    JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
    WHERE ws.project_id = ? AND a.billable = 1 AND a.start_time >= ?
  `)
  const row = stmt.get(Date.now(), projectId, sinceMs) as any
  return row?.total || 0
}

// Répartition du temps facturable par projet sur une plage donnée (pour le graphique "temps par
// projet" des Rapports) — même logique de jointure que getProjectBillableSeconds, mais regroupée.
export function getProjectTimeBreakdown(startMs: number, endMs: number): any[] {
  if (!db) return []
  const stmt = db.prepare(`
    SELECT p.id AS project_id, p.name, p.color, p.hourly_rate,
           COALESCE(SUM(a.duration_seconds), 0) AS seconds
    FROM activities a
    JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
    JOIN projects p ON p.id = ws.project_id
    WHERE a.billable = 1 AND a.start_time >= ? AND a.start_time < ?
    GROUP BY p.id
    ORDER BY seconds DESC
  `)
  return stmt.all(Date.now(), startMs, endMs) as any[]
}

export function updateSessionDetails(sessionId: number, label: string | null, projectId: number | null, phaseId: number | null = null): void {
  if (!db) return
  const stmt = db.prepare('UPDATE work_sessions SET label = ?, project_id = ?, phase_id = ?, updated_at = ? WHERE id = ?')
  stmt.run(label, projectId, phaseId, Date.now(), sessionId)
}

// Rattache la session en cours à un projet (et éventuellement une phase) sans toucher à son label —
// utilisé par le sélecteur de projet de la pill de suivi, distinct de l'éditeur complet (label inclus)
// de l'historique des sessions
export function updateSessionProject(sessionId: number, projectId: number | null, phaseId: number | null): void {
  if (!db) return
  db.prepare('UPDATE work_sessions SET project_id = ?, phase_id = ?, updated_at = ? WHERE id = ?').run(projectId, phaseId, Date.now(), sessionId)
}

// Surcharges de catégories propres à une session (focus/distraction ponctuels pour ce contexte de travail)
export function updateSessionCategoryOverrides(sessionId: number, overridesJson: string): void {
  if (!db) return
  db.prepare('UPDATE work_sessions SET category_overrides = ?, updated_at = ? WHERE id = ?').run(overridesJson, Date.now(), sessionId)
}

export function endWorkSession(sessionId: number, endTime: number, durationSeconds: number): void {
  if (!db) return
  const stmt = db.prepare('UPDATE work_sessions SET end_time = ?, duration_seconds = ?, updated_at = ? WHERE id = ?')
  stmt.run(endTime, durationSeconds, Date.now(), sessionId)
}

export function getWorkSessionById(sessionId: number): any | null {
  if (!db) return null
  const stmt = db.prepare('SELECT * FROM work_sessions WHERE id = ?')
  return (stmt.get(sessionId) as any) || null
}

// Cascade un statut facturable sur une plage d'activités, en excluant TOUJOURS les catégories "distraction"
// (une distraction n'est jamais facturable, même si la session englobante l'est).
export function setActivitiesBillableInRange(startMs: number, endMs: number, billable: boolean): void {
  if (!db) return

  const nonDistractionStmt = db.prepare(`
    UPDATE activities SET billable = ?
    WHERE start_time >= ? AND start_time <= ?
      AND (category_id IS NULL OR category_id NOT IN (SELECT id FROM categories WHERE is_distraction = 1))
  `)
  nonDistractionStmt.run(billable ? 1 : 0, startMs, endMs)

  const distractionStmt = db.prepare(`
    UPDATE activities SET billable = 0
    WHERE start_time >= ? AND start_time <= ?
      AND category_id IN (SELECT id FROM categories WHERE is_distraction = 1)
  `)
  distractionStmt.run(startMs, endMs)
}

// Marque la session facturable (indicateur en cache) ET cascade la même valeur sur toutes ses activités
// — activities.billable reste la seule source de vérité pour les totaux d'argent, jamais sommée deux fois.
export function updateWorkSessionBillable(sessionId: number, billable: boolean): void {
  if (!db) return
  const session = getWorkSessionById(sessionId)
  if (!session) return

  const stmt = db.prepare('UPDATE work_sessions SET billable = ?, updated_at = ? WHERE id = ?')
  stmt.run(billable ? 1 : 0, Date.now(), sessionId)

  const rangeEnd = session.end_time ?? Date.now()
  setActivitiesBillableInRange(session.start_time, rangeEnd, billable)
}

export function getWorkSessions(sinceMs: number): any[] {
  if (!db) return []
  const stmt = db.prepare(`
    SELECT ws.*, p.name AS project_name, p.color AS project_color, p.hourly_rate AS project_hourly_rate,
           ph.name AS phase_name, ph.color AS phase_color
    FROM work_sessions ws
    LEFT JOIN projects p ON p.id = ws.project_id
    LEFT JOIN project_phases ph ON ph.id = ws.phase_id
    WHERE ws.start_time >= ?
    ORDER BY ws.start_time DESC
  `)
  return stmt.all(sinceMs) as any[]
}

// Activités appartenant à la plage temporelle d'une session (pour l'historique condensé par application)
export function getActivitiesInRange(startMs: number, endMs: number): any[] {
  if (!db) return []
  const stmt = db.prepare('SELECT * FROM activities WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC')
  return stmt.all(startMs, endMs) as any[]
}

export function deleteWorkSession(sessionId: number): void {
  if (!db) return
  const session = db.prepare('SELECT start_time FROM work_sessions WHERE id = ?').get(sessionId) as any
  if (session) recordSyncTombstone('work_session', String(session.start_time))
  db.prepare('DELETE FROM work_sessions WHERE id = ?').run(sessionId)
}

// Secondes réellement facturables (activities.billable = 1) sur la plage exacte d'une session donnée
export function getSessionBillableSeconds(sessionId: number): number {
  if (!db) return 0
  const session = getWorkSessionById(sessionId)
  if (!session) return 0
  const rangeEnd = session.end_time ?? Date.now()
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) AS total
    FROM activities
    WHERE start_time >= ? AND start_time <= ? AND billable = 1
  `)
  const row = stmt.get(session.start_time, rangeEnd) as any
  return row?.total || 0
}

// Toutes les sessions rattachées à un projet (pour l'affichage détaillé dans l'onglet Projets)
export function getSessionsForProject(projectId: number): any[] {
  if (!db) return []
  const stmt = db.prepare(`
    SELECT ws.*, ph.name AS phase_name, ph.color AS phase_color
    FROM work_sessions ws
    LEFT JOIN project_phases ph ON ph.id = ws.phase_id
    WHERE ws.project_id = ?
    ORDER BY ws.start_time DESC
  `)
  return stmt.all(projectId) as any[]
}

export function exportData(): string {
  if (!db) throw new Error('Database not initialized')

  const activities = db.prepare('SELECT * FROM activities').all() as any[]
  const categories = db.prepare('SELECT * FROM categories').all() as any[]
  const tags = db.prepare('SELECT * FROM tags').all() as any[]
  const activityTags = db.prepare('SELECT * FROM activity_tags').all() as any[]
  const settings = db.prepare('SELECT * FROM settings').all() as any[]
  const clients = db.prepare('SELECT * FROM clients').all() as any[]
  const projects = db.prepare('SELECT * FROM projects').all() as any[]
  const workSessions = db.prepare('SELECT * FROM work_sessions').all() as any[]
  const sessionPauses = db.prepare('SELECT * FROM session_pauses').all() as any[]
  const focusSessions = db.prepare('SELECT * FROM focus_sessions').all() as any[]

  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    data: {
      activities,
      categories: categories.map((c) => ({
        ...c,
        match_rules: c.match_rules ? JSON.parse(c.match_rules) : [],
      })),
      tags,
      activityTags,
      settings,
      clients,
      projects,
      workSessions,
      sessionPauses,
      focusSessions,
    },
  }

  return JSON.stringify(backup, null, 2)
}

export function importData(jsonData: string): { imported: number; errors: string[] } {
  if (!db) throw new Error('Database not initialized')

  try {
    const backup = JSON.parse(jsonData)

    if (!backup.data) {
      throw new Error('Format de sauvegarde invalide')
    }

    const errors: string[] = []
    let imported = 0

    // Import categories
    try {
      const catStmt = db.prepare(`
        INSERT OR REPLACE INTO categories (id, name, color, billable_default, match_rules)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const cat of backup.data.categories || []) {
        catStmt.run(
          cat.id,
          cat.name,
          cat.color,
          cat.billable_default,
          JSON.stringify(cat.match_rules || [])
        )
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des catégories: ${e}`)
    }

    // Import tags
    try {
      const tagStmt = db.prepare('INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
      for (const tag of backup.data.tags || []) {
        tagStmt.run(tag.id, tag.name, tag.color, tag.created_at)
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des tags: ${e}`)
    }

    // Import clients (avant projects, qui les référencent)
    try {
      const clientStmt = db.prepare('INSERT OR REPLACE INTO clients (id, name, color, created_at) VALUES (?, ?, ?, ?)')
      for (const client of backup.data.clients || []) {
        clientStmt.run(client.id, client.name, client.color, client.created_at)
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des clients: ${e}`)
    }

    // Import projects
    try {
      const projectStmt = db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, color, created_at, client_id, hourly_rate, status, hour_goal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const project of backup.data.projects || []) {
        projectStmt.run(
          project.id,
          project.name,
          project.color,
          project.created_at,
          project.client_id,
          project.hourly_rate,
          project.status,
          project.hour_goal
        )
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des projets: ${e}`)
    }

    // Import activities
    try {
      const actStmt = db.prepare(`
        INSERT OR REPLACE INTO activities (id, app_name, window_title, category_id, start_time, end_time, duration_seconds, billable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const act of backup.data.activities || []) {
        actStmt.run(
          act.id,
          act.app_name,
          act.window_title,
          act.category_id,
          act.start_time,
          act.end_time,
          act.duration_seconds,
          act.billable
        )
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des activités: ${e}`)
    }

    // Import activity tags
    try {
      const atStmt = db.prepare('INSERT OR IGNORE INTO activity_tags (activity_id, tag_id) VALUES (?, ?)')
      for (const at of backup.data.activityTags || []) {
        atStmt.run(at.activity_id, at.tag_id)
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des liens activité-tags: ${e}`)
    }

    // Import work sessions (avant les pauses, qui les référencent)
    try {
      const sessionStmt = db.prepare(`
        INSERT OR REPLACE INTO work_sessions (id, start_time, end_time, duration_seconds, billable, label, project_id, category_overrides)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const session of backup.data.workSessions || []) {
        sessionStmt.run(
          session.id,
          session.start_time,
          session.end_time,
          session.duration_seconds,
          session.billable,
          session.label,
          session.project_id,
          session.category_overrides ?? null
        )
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des sessions de travail: ${e}`)
    }

    // Import session pauses
    try {
      const pauseStmt = db.prepare(`
        INSERT OR REPLACE INTO session_pauses (id, session_id, start_time, end_time, duration_seconds)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const pause of backup.data.sessionPauses || []) {
        pauseStmt.run(pause.id, pause.session_id, pause.start_time, pause.end_time, pause.duration_seconds)
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des pauses de session: ${e}`)
    }

    // Import focus sessions
    try {
      const focusStmt = db.prepare(`
        INSERT OR REPLACE INTO focus_sessions (id, start_time, end_time, planned_duration, completed, blocked_apps)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const focusSession of backup.data.focusSessions || []) {
        focusStmt.run(
          focusSession.id,
          focusSession.start_time,
          focusSession.end_time,
          focusSession.planned_duration,
          focusSession.completed,
          focusSession.blocked_apps ?? '[]'
        )
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des sessions Mode Focus: ${e}`)
    }

    // Import settings
    try {
      const setStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      for (const setting of backup.data.settings || []) {
        setStmt.run(setting.key, setting.value)
        imported++
      }
    } catch (e) {
      errors.push(`Erreur lors de l'import des paramètres: ${e}`)
    }

    return { imported, errors }
  } catch (e) {
    throw new Error(`Erreur lors du parsing du backup: ${e}`)
  }
}

// ---- Synchronisation entre machines (fichier partagé, ex : sur un NAS) ----
//
// Contrairement à exportData/importData (utilisés pour les sauvegardes manuelles, où l'id fait foi
// et où un INSERT OR REPLACE est donc correct), la synchro doit fusionner les données de deux machines
// distinctes dont les id auto-incrémentés n'ont aucun rapport entre eux. On matche donc chaque table sur
// une clé naturelle (nom, ou start_time+app_name pour les activités) et on retrouve/insère l'id local
// correspondant, avant de réécrire les références (category_id, project_id, tag_id...).

export type SyncEntityType = 'category' | 'tag' | 'client' | 'project' | 'project_phase' | 'work_session' | 'focus_session'

// Enregistre (ou met à jour) la trace de suppression d'une entité, pour que la fusion de synchro
// sache qu'elle ne doit pas la réimporter tant qu'une autre machine n'a pas une version plus récente
// (auquel cas ce serait un ré-ajout volontaire, pas une résurrection accidentelle).
export function recordSyncTombstone(entityType: SyncEntityType, naturalKey: string, deletedAt: number = Date.now()): void {
  if (!db) return
  db.prepare(
    `INSERT INTO sync_tombstones (entity_type, natural_key, deleted_at) VALUES (?, ?, ?)
     ON CONFLICT(entity_type, natural_key) DO UPDATE SET deleted_at = excluded.deleted_at`
  ).run(entityType, naturalKey, deletedAt)
}

export function exportSyncData(): string {
  if (!db) throw new Error('Database not initialized')

  // Purge les tombstones trop anciens : au-delà de 90 jours, on considère que toutes les machines ont
  // eu l'occasion de synchroniser la suppression au moins une fois — inutile de les garder indéfiniment.
  const tombstoneCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM sync_tombstones WHERE deleted_at < ?').run(tombstoneCutoff)

  const categories = db.prepare('SELECT * FROM categories').all() as any[]
  const tags = db.prepare('SELECT * FROM tags').all() as any[]
  const clients = db.prepare('SELECT * FROM clients').all() as any[]
  const projects = db.prepare('SELECT * FROM projects').all() as any[]
  const projectPhases = db.prepare('SELECT * FROM project_phases').all() as any[]
  const activities = db.prepare('SELECT * FROM activities').all() as any[]
  const activityTags = db.prepare('SELECT * FROM activity_tags').all() as any[]
  const workSessions = db.prepare('SELECT * FROM work_sessions').all() as any[]
  const sessionPauses = db.prepare('SELECT * FROM session_pauses').all() as any[]
  const focusSessions = db.prepare('SELECT * FROM focus_sessions').all() as any[]
  const tombstones = db.prepare('SELECT * FROM sync_tombstones').all() as any[]

  return JSON.stringify(
    {
      syncVersion: 2,
      exportDate: new Date().toISOString(),
      data: {
        categories: categories.map((c) => ({ ...c, match_rules: c.match_rules ? JSON.parse(c.match_rules) : [] })),
        tags,
        clients,
        projects,
        projectPhases,
        activities,
        activityTags,
        workSessions,
        sessionPauses,
        focusSessions,
        tombstones,
      },
    },
    null,
    2
  )
}

export function importSyncDataMerge(jsonData: string): { imported: number; skipped: number; errors: string[] } {
  if (!db) throw new Error('Database not initialized')

  const backup = JSON.parse(jsonData)
  if (!backup.data) throw new Error('Format de synchronisation invalide')

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  const remoteTombstones: { entity_type: SyncEntityType; natural_key: string; deleted_at: number }[] = backup.data.tombstones || []

  const run = db.transaction(() => {
    if (!db) return

    // Fusionne d'abord tous les tombstones distants dans sync_tombstones (garde le plus récent par
    // clé) — indépendamment de ce qui suit, pour que isTombstoned() ci-dessous voie l'union complète
    // (local ∪ distant) et pas seulement ce que cette machine avait déjà supprimé elle-même.
    for (const tomb of remoteTombstones) {
      recordSyncTombstone(tomb.entity_type, tomb.natural_key, tomb.deleted_at)
    }

    // Une entité distante est ignorée si elle a été supprimée localement (ou ailleurs, via un
    // tombstone déjà connu) APRÈS sa dernière modification connue — sinon elle serait réimportée
    // alors qu'on l'a supprimée exprès. Si elle a été modifiée APRÈS la suppression (ré-ajout
    // volontaire), son updated_at dépasse le tombstone et elle passe normalement.
    const isTombstoned = (type: SyncEntityType, key: string, remoteUpdatedAt: number): boolean => {
      const row = db!.prepare('SELECT deleted_at FROM sync_tombstones WHERE entity_type = ? AND natural_key = ?').get(type, key) as any
      return !!row && row.deleted_at >= remoteUpdatedAt
    }

    // Une entité supprimée ailleurs n'apparaît plus du tout dans backup.data.* (elle n'existe plus
    // là-bas) — isTombstoned() ne suffit donc pas à la faire disparaître ici : il faut explicitement
    // supprimer toute copie locale encore présente et plus ancienne que le tombstone reçu.
    const deleteStale = (
      findLocal: () => { id: number; updated_at: number } | undefined,
      deleteLocal: (id: number) => void,
      deletedAt: number
    ) => {
      const local = findLocal()
      if (local && (local.updated_at ?? 0) < deletedAt) deleteLocal(local.id)
    }

    for (const tomb of remoteTombstones) {
      try {
        switch (tomb.entity_type) {
          case 'category':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM categories WHERE name = ?').get(tomb.natural_key) as any,
              (id) => db!.prepare('DELETE FROM categories WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          case 'tag':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM tags WHERE name = ?').get(tomb.natural_key) as any,
              (id) => db!.prepare('DELETE FROM tags WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          case 'client':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM clients WHERE name = ?').get(tomb.natural_key) as any,
              (id) => db!.prepare('DELETE FROM clients WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          case 'project':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM projects WHERE name = ?').get(tomb.natural_key) as any,
              (id) => db!.prepare('DELETE FROM projects WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          case 'project_phase': {
            const [projectName, phaseName] = tomb.natural_key.split('::')
            deleteStale(
              () =>
                db!
                  .prepare(
                    `SELECT ph.id, ph.updated_at FROM project_phases ph JOIN projects p ON p.id = ph.project_id WHERE p.name = ? AND ph.name = ?`
                  )
                  .get(projectName, phaseName) as any,
              (id) => db!.prepare('DELETE FROM project_phases WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          }
          case 'work_session':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM work_sessions WHERE start_time = ?').get(Number(tomb.natural_key)) as any,
              (id) => db!.prepare('DELETE FROM work_sessions WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
          case 'focus_session':
            deleteStale(
              () => db!.prepare('SELECT id, updated_at FROM focus_sessions WHERE start_time = ?').get(Number(tomb.natural_key)) as any,
              (id) => db!.prepare('DELETE FROM focus_sessions WHERE id = ?').run(id),
              tomb.deleted_at
            )
            break
        }
      } catch (e) {
        errors.push(`Suppression distante (${tomb.entity_type} "${tomb.natural_key}"): ${e}`)
      }
    }

    // ---- Catégories (clé naturelle : name) ----
    const categoryIdMap = new Map<number, number>() // id distant -> id local
    const findCategory = db.prepare('SELECT id, updated_at FROM categories WHERE name = ?')
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, color, billable_default, match_rules, is_distraction, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const updateCategory = db.prepare(
      'UPDATE categories SET color = ?, billable_default = ?, match_rules = ?, is_distraction = ?, updated_at = ? WHERE id = ?'
    )
    for (const cat of backup.data.categories || []) {
      try {
        const remoteUpdatedAt = cat.updated_at ?? 0
        if (isTombstoned('category', cat.name, remoteUpdatedAt)) {
          skipped++
          continue
        }
        const existing = findCategory.get(cat.name) as any
        if (existing) {
          categoryIdMap.set(cat.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateCategory.run(cat.color, cat.billable_default, JSON.stringify(cat.match_rules || []), cat.is_distraction ? 1 : 0, remoteUpdatedAt, existing.id)
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertCategory.run(cat.name, cat.color, cat.billable_default, JSON.stringify(cat.match_rules || []), cat.is_distraction ? 1 : 0, remoteUpdatedAt)
          categoryIdMap.set(cat.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Catégorie "${cat.name}": ${e}`)
      }
    }

    // ---- Tags (clé naturelle : name) ----
    const tagIdMap = new Map<number, number>()
    const findTag = db.prepare('SELECT id, updated_at FROM tags WHERE name = ?')
    const insertTag = db.prepare('INSERT INTO tags (name, color, created_at, updated_at) VALUES (?, ?, ?, ?)')
    const updateTag = db.prepare('UPDATE tags SET color = ?, updated_at = ? WHERE id = ?')
    for (const tag of backup.data.tags || []) {
      try {
        const remoteUpdatedAt = tag.updated_at ?? tag.created_at ?? 0
        if (isTombstoned('tag', tag.name, remoteUpdatedAt)) {
          skipped++
          continue
        }
        const existing = findTag.get(tag.name) as any
        if (existing) {
          tagIdMap.set(tag.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateTag.run(tag.color, remoteUpdatedAt, existing.id)
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertTag.run(tag.name, tag.color, tag.created_at, remoteUpdatedAt)
          tagIdMap.set(tag.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Tag "${tag.name}": ${e}`)
      }
    }

    // ---- Clients (clé naturelle : name) ----
    const clientIdMap = new Map<number, number>()
    const findClient = db.prepare('SELECT id, updated_at FROM clients WHERE name = ?')
    const insertClient = db.prepare('INSERT INTO clients (name, color, created_at, updated_at) VALUES (?, ?, ?, ?)')
    const updateClient = db.prepare('UPDATE clients SET color = ?, updated_at = ? WHERE id = ?')
    for (const client of backup.data.clients || []) {
      try {
        const remoteUpdatedAt = client.updated_at ?? client.created_at ?? 0
        if (isTombstoned('client', client.name, remoteUpdatedAt)) {
          skipped++
          continue
        }
        const existing = findClient.get(client.name) as any
        if (existing) {
          clientIdMap.set(client.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateClient.run(client.color, remoteUpdatedAt, existing.id)
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertClient.run(client.name, client.color, client.created_at, remoteUpdatedAt)
          clientIdMap.set(client.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Client "${client.name}": ${e}`)
      }
    }

    // ---- Projets (clé naturelle : name) ----
    const projectIdMap = new Map<number, number>()
    const findProject = db.prepare('SELECT id, updated_at FROM projects WHERE name = ?')
    const insertProject = db.prepare(
      'INSERT INTO projects (name, color, created_at, client_id, hourly_rate, status, hour_goal, budget_hours, budget_amount, deadline, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const updateProjectStmt = db.prepare(
      'UPDATE projects SET color = ?, client_id = ?, hourly_rate = ?, status = ?, hour_goal = ?, budget_hours = ?, budget_amount = ?, deadline = ?, updated_at = ? WHERE id = ?'
    )
    for (const project of backup.data.projects || []) {
      try {
        const remoteUpdatedAt = project.updated_at ?? project.created_at ?? 0
        if (isTombstoned('project', project.name, remoteUpdatedAt)) {
          skipped++
          continue
        }
        const localClientId = project.client_id ? clientIdMap.get(project.client_id) ?? null : null
        const existing = findProject.get(project.name) as any
        if (existing) {
          projectIdMap.set(project.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateProjectStmt.run(
              project.color,
              localClientId,
              project.hourly_rate,
              project.status,
              project.hour_goal,
              project.budget_hours ?? null,
              project.budget_amount ?? null,
              project.deadline ?? null,
              remoteUpdatedAt,
              existing.id
            )
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertProject.run(
            project.name,
            project.color,
            project.created_at,
            localClientId,
            project.hourly_rate,
            project.status,
            project.hour_goal,
            project.budget_hours ?? null,
            project.budget_amount ?? null,
            project.deadline ?? null,
            remoteUpdatedAt
          )
          projectIdMap.set(project.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Projet "${project.name}": ${e}`)
      }
    }

    // ---- Phases de projet (clé naturelle : nom du projet + nom de la phase) ----
    const phaseIdMap = new Map<number, number>()
    const findParentProjectName = db.prepare('SELECT name FROM projects WHERE id = ?')
    const findPhase = db.prepare(`
      SELECT ph.id, ph.updated_at FROM project_phases ph
      JOIN projects p ON p.id = ph.project_id
      WHERE p.name = ? AND ph.name = ?
    `)
    const insertPhase = db.prepare(
      'INSERT INTO project_phases (project_id, name, color, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const updatePhase = db.prepare('UPDATE project_phases SET color = ?, status = ?, updated_at = ? WHERE id = ?')
    for (const phase of backup.data.projectPhases || []) {
      try {
        const localProjectId = projectIdMap.get(phase.project_id)
        if (!localProjectId) continue // projet parent non importé (tombstoné ou en erreur ci-dessus)
        const parentProject = findParentProjectName.get(localProjectId) as any
        const naturalKey = `${parentProject.name}::${phase.name}`
        const remoteUpdatedAt = phase.updated_at ?? phase.created_at ?? 0
        if (isTombstoned('project_phase', naturalKey, remoteUpdatedAt)) {
          skipped++
          continue
        }
        const existing = findPhase.get(parentProject.name, phase.name) as any
        if (existing) {
          phaseIdMap.set(phase.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updatePhase.run(phase.color, phase.status, remoteUpdatedAt, existing.id)
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertPhase.run(localProjectId, phase.name, phase.color, phase.status, phase.created_at, remoteUpdatedAt)
          phaseIdMap.set(phase.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Phase "${phase.name}": ${e}`)
      }
    }

    // ---- Sessions de travail (clé naturelle : start_time) ----
    const sessionIdMap = new Map<number, number>()
    const findSession = db.prepare('SELECT id, updated_at FROM work_sessions WHERE start_time = ?')
    const insertSession = db.prepare(
      'INSERT INTO work_sessions (start_time, end_time, duration_seconds, billable, label, project_id, phase_id, category_overrides, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const updateSessionStmt = db.prepare(
      'UPDATE work_sessions SET end_time = ?, duration_seconds = ?, billable = ?, label = ?, project_id = ?, phase_id = ?, category_overrides = ?, updated_at = ? WHERE id = ?'
    )
    for (const session of backup.data.workSessions || []) {
      try {
        const remoteUpdatedAt = session.updated_at ?? session.start_time ?? 0
        if (isTombstoned('work_session', String(session.start_time), remoteUpdatedAt)) {
          skipped++
          continue
        }
        const localProjectId = session.project_id ? projectIdMap.get(session.project_id) ?? null : null
        const localPhaseId = session.phase_id ? phaseIdMap.get(session.phase_id) ?? null : null
        const existing = findSession.get(session.start_time) as any
        if (existing) {
          sessionIdMap.set(session.id, existing.id)
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateSessionStmt.run(
              session.end_time,
              session.duration_seconds,
              session.billable,
              session.label,
              localProjectId,
              localPhaseId,
              session.category_overrides ?? null,
              remoteUpdatedAt,
              existing.id
            )
            imported++
          } else {
            skipped++
          }
        } else {
          const result = insertSession.run(
            session.start_time,
            session.end_time,
            session.duration_seconds,
            session.billable,
            session.label,
            localProjectId,
            localPhaseId,
            session.category_overrides ?? null,
            remoteUpdatedAt
          )
          sessionIdMap.set(session.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Session du ${new Date(session.start_time).toLocaleString('fr-FR')}: ${e}`)
      }
    }

    // ---- Pauses de session (clé naturelle : session locale + start_time — pas de tombstone dédié,
    // elles suivent leur session parente : supprimée via tombstone, ses pauses partent en cascade) ----
    const findPause = db.prepare('SELECT id FROM session_pauses WHERE session_id = ? AND start_time = ?')
    const insertPause = db.prepare(
      'INSERT INTO session_pauses (session_id, start_time, end_time, duration_seconds) VALUES (?, ?, ?, ?)'
    )
    for (const pause of backup.data.sessionPauses || []) {
      const localSessionId = sessionIdMap.get(pause.session_id)
      if (!localSessionId) continue // session parente non importée (tombstonée ou en erreur ci-dessus)
      try {
        const existing = findPause.get(localSessionId, pause.start_time) as any
        if (existing) {
          skipped++
        } else {
          insertPause.run(localSessionId, pause.start_time, pause.end_time, pause.duration_seconds)
          imported++
        }
      } catch (e) {
        errors.push(`Pause de session: ${e}`)
      }
    }

    // ---- Sessions Mode Focus (clé naturelle : start_time) ----
    const findFocusSession = db.prepare('SELECT id, updated_at FROM focus_sessions WHERE start_time = ?')
    const insertFocusSession = db.prepare(
      'INSERT INTO focus_sessions (start_time, end_time, planned_duration, completed, blocked_apps, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const updateFocusSession = db.prepare(
      'UPDATE focus_sessions SET end_time = ?, planned_duration = ?, completed = ?, blocked_apps = ?, updated_at = ? WHERE id = ?'
    )
    for (const focusSession of backup.data.focusSessions || []) {
      try {
        const remoteUpdatedAt = focusSession.updated_at ?? focusSession.start_time ?? 0
        if (isTombstoned('focus_session', String(focusSession.start_time), remoteUpdatedAt)) {
          skipped++
          continue
        }
        const existing = findFocusSession.get(focusSession.start_time) as any
        if (existing) {
          if (remoteUpdatedAt > (existing.updated_at ?? 0)) {
            updateFocusSession.run(
              focusSession.end_time,
              focusSession.planned_duration,
              focusSession.completed,
              focusSession.blocked_apps ?? '[]',
              remoteUpdatedAt,
              existing.id
            )
            imported++
          } else {
            skipped++
          }
        } else {
          insertFocusSession.run(
            focusSession.start_time,
            focusSession.end_time,
            focusSession.planned_duration,
            focusSession.completed,
            focusSession.blocked_apps ?? '[]',
            remoteUpdatedAt
          )
          imported++
        }
      } catch (e) {
        errors.push(`Session Mode Focus du ${new Date(focusSession.start_time).toLocaleString('fr-FR')}: ${e}`)
      }
    }

    // ---- Activités (clé naturelle : start_time + app_name) — pas de tombstone : volume trop élevé
    // pour un suivi individuel, la suppression en masse depuis les Paramètres reste locale à chaque
    // machine plutôt que de se propager activité par activité. ----
    const activityIdMap = new Map<number, number>()
    const findActivity = db.prepare('SELECT id FROM activities WHERE start_time = ? AND app_name = ?')
    const insertActivity = db.prepare(
      'INSERT INTO activities (app_name, window_title, category_id, start_time, end_time, duration_seconds, billable) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const act of backup.data.activities || []) {
      try {
        const existing = findActivity.get(act.start_time, act.app_name) as any
        const localCategoryId = act.category_id ? categoryIdMap.get(act.category_id) ?? null : null
        if (existing) {
          activityIdMap.set(act.id, existing.id)
          skipped++
        } else {
          const result = insertActivity.run(act.app_name, act.window_title, localCategoryId, act.start_time, act.end_time, act.duration_seconds, act.billable)
          activityIdMap.set(act.id, Number(result.lastInsertRowid))
          imported++
        }
      } catch (e) {
        errors.push(`Activité "${act.app_name}" @ ${act.start_time}: ${e}`)
      }
    }

    // ---- Liaisons activité-tag (rewrite via les correspondances trouvées ci-dessus) ----
    const insertActivityTag = db.prepare('INSERT OR IGNORE INTO activity_tags (activity_id, tag_id) VALUES (?, ?)')
    for (const at of backup.data.activityTags || []) {
      const localActivityId = activityIdMap.get(at.activity_id)
      const localTagId = tagIdMap.get(at.tag_id)
      if (localActivityId && localTagId) {
        try {
          insertActivityTag.run(localActivityId, localTagId)
        } catch (e) {
          errors.push(`Liaison activité/tag: ${e}`)
        }
      }
    }
  })

  run()

  return { imported, skipped, errors }
}

// ---- Export CSV (tableur / comptabilité) ----

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportActivitiesCSV(): string {
  if (!db) throw new Error('Database not initialized')

  const rows = db
    .prepare(
      `SELECT a.*, c.name AS category_name
       FROM activities a
       LEFT JOIN categories c ON c.id = a.category_id
       ORDER BY a.start_time ASC`
    )
    .all() as any[]

  const header = ['Date', 'Heure début', 'Heure fin', 'Durée (min)', 'Application', 'Titre de fenêtre', 'Catégorie', 'Facturable']
  const lines = [header.map(csvEscape).join(',')]

  for (const row of rows) {
    const start = new Date(row.start_time)
    const end = row.end_time ? new Date(row.end_time) : null
    lines.push(
      [
        csvEscape(start.toLocaleDateString('fr-FR')),
        csvEscape(start.toLocaleTimeString('fr-FR')),
        csvEscape(end ? end.toLocaleTimeString('fr-FR') : ''),
        csvEscape(Math.round(row.duration_seconds / 60)),
        csvEscape(row.app_name),
        csvEscape(row.window_title),
        csvEscape(row.category_name || 'Non catégorisé'),
        csvEscape(row.billable === 1 ? 'Oui' : row.billable === 0 ? 'Non' : ''),
      ].join(',')
    )
  }

  // BOM UTF-8 pour qu'Excel détecte correctement l'encodage des accents
  return '﻿' + lines.join('\r\n')
}

// Sessions d'un projet, pour l'export comptable/facturation (une ligne par session)
export function exportProjectSessionsCSV(projectId: number): string {
  if (!db) throw new Error('Database not initialized')
  const project = getProjectById(projectId)
  if (!project) throw new Error('Projet introuvable')

  const rows = getSessionsForProject(projectId)
  const header = ['Date', 'Heure début', 'Heure fin', 'Phase', 'Session', 'Durée facturable (h)', 'Facturable', 'Montant (€)']
  const lines = [header.map(csvEscape).join(',')]

  for (const row of rows) {
    const start = new Date(row.start_time)
    const end = row.end_time ? new Date(row.end_time) : null
    const billableSeconds = getSessionBillableSeconds(row.id)
    const hours = billableSeconds / 3600
    const amount = project.hourly_rate ? hours * project.hourly_rate : null
    lines.push(
      [
        csvEscape(start.toLocaleDateString('fr-FR')),
        csvEscape(start.toLocaleTimeString('fr-FR')),
        csvEscape(end ? end.toLocaleTimeString('fr-FR') : ''),
        csvEscape(row.phase_name || ''),
        csvEscape(row.label || ''),
        csvEscape(hours.toFixed(2)),
        csvEscape(row.billable === 1 ? 'Oui' : row.billable === 0 ? 'Non' : ''),
        csvEscape(amount !== null ? amount.toFixed(2) : ''),
      ].join(',')
    )
  }

  return '﻿' + lines.join('\r\n')
}

// Toutes les sessions (tous projets confondus) démarrées dans une plage donnée, pour l'export
// comptable mensuel
// Sessions (tous projets confondus) démarrées dans une plage donnée, avec projet/client rattachés —
// source commune pour l'export CSV et l'export PDF mensuels
export function getWorkSessionsWithProjectInRange(startMs: number, endMs: number): any[] {
  if (!db) return []
  return db
    .prepare(
      `SELECT ws.*, p.name AS project_name, p.hourly_rate AS project_hourly_rate, c.name AS client_name
       FROM work_sessions ws
       LEFT JOIN projects p ON p.id = ws.project_id
       LEFT JOIN clients c ON c.id = p.client_id
       WHERE ws.start_time >= ? AND ws.start_time < ?
       ORDER BY ws.start_time ASC`
    )
    .all(startMs, endMs) as any[]
}

export function exportMonthlyCSV(startMs: number, endMs: number): string {
  if (!db) throw new Error('Database not initialized')
  const rows = getWorkSessionsWithProjectInRange(startMs, endMs)
  const header = ['Date', 'Heure début', 'Heure fin', 'Client', 'Projet', 'Session', 'Durée facturable (h)', 'Facturable', 'Montant (€)']
  const lines = [header.map(csvEscape).join(',')]

  for (const row of rows) {
    const start = new Date(row.start_time)
    const end = row.end_time ? new Date(row.end_time) : null
    const billableSeconds = getSessionBillableSeconds(row.id)
    const hours = billableSeconds / 3600
    const amount = row.project_hourly_rate ? hours * row.project_hourly_rate : null
    lines.push(
      [
        csvEscape(start.toLocaleDateString('fr-FR')),
        csvEscape(start.toLocaleTimeString('fr-FR')),
        csvEscape(end ? end.toLocaleTimeString('fr-FR') : ''),
        csvEscape(row.client_name || ''),
        csvEscape(row.project_name || ''),
        csvEscape(row.label || ''),
        csvEscape(hours.toFixed(2)),
        csvEscape(row.billable === 1 ? 'Oui' : row.billable === 0 ? 'Non' : ''),
        csvEscape(amount !== null ? amount.toFixed(2) : ''),
      ].join(',')
    )
  }

  return '﻿' + lines.join('\r\n')
}

// Inactivity exclusions management
export function addInactivityExclusion(appPattern: string | null, titlePattern: string | null, description?: string): number {
  if (!appPattern && !titlePattern) {
    throw new Error('Au moins un pattern (app ou title) est requis')
  }
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO inactivity_exclusions (app_pattern, title_pattern, description, created_at)
    VALUES (?, ?, ?, ?)
  `)
  const result = stmt.run(appPattern, titlePattern, description || null, Date.now())
  return Number(result.lastInsertRowid)
}

export function removeInactivityExclusion(id: number): void {
  const db = getDatabase()
  const stmt = db.prepare('DELETE FROM inactivity_exclusions WHERE id = ?')
  stmt.run(id)
}

export function getInactivityExclusions(): any[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM inactivity_exclusions ORDER BY created_at DESC')
  return stmt.all() as any[]
}

export function isAppExcludedFromInactivityDetection(appName: string, windowTitle: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare('SELECT id FROM inactivity_exclusions LIMIT 1')
  // Quick check if table has any exclusions
  if (!stmt.get()) return false

  const exclusions = db.prepare('SELECT app_pattern, title_pattern FROM inactivity_exclusions').all() as any[]

  for (const exclusion of exclusions) {
    // Check app pattern (case-insensitive substring match)
    if (exclusion.app_pattern) {
      if (appName.toLowerCase().includes(exclusion.app_pattern.toLowerCase())) {
        return true
      }
    }
    // Check title pattern (case-insensitive substring match)
    if (exclusion.title_pattern) {
      if (windowTitle.toLowerCase().includes(exclusion.title_pattern.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

export function getSessionsWithoutProjectToday() {
  if (!db) return []

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const stmt = db.prepare(`
    SELECT id, start_time, end_time FROM work_sessions
    WHERE project_id IS NULL
      AND start_time >= ?
      AND start_time < ?
    ORDER BY start_time DESC
  `)
  return stmt.all(startOfDay.getTime(), endOfDay.getTime()) as any[]
}

export function getProjectsWithBudgetOrDeadlineIssues() {
  if (!db) return []

  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const stmt = db.prepare(`
    SELECT id, name, budget_hours, budget_amount, deadline, hourly_rate FROM projects
    WHERE (budget_hours IS NOT NULL AND budget_hours > 0)
       OR (budget_amount IS NOT NULL AND budget_amount > 0)
       OR (deadline IS NOT NULL)
  `)
  const projects = stmt.all() as any[]

  const issues = []
  for (const p of projects) {
    // Calculate total billable seconds for this project
    const billingStmt = db.prepare(`
      SELECT COALESCE(SUM(a.duration_seconds), 0) AS total_seconds
      FROM activities a
      JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
      WHERE ws.project_id = ? AND a.billable = 1
    `)
    const billing = billingStmt.get(Date.now(), p.id) as any
    const totalHours = (billing?.total_seconds || 0) / 3600

    // Budget hours exceeded
    if (p.budget_hours && totalHours >= p.budget_hours) {
      issues.push({ type: 'budget_hours', projectId: p.id, projectName: p.name })
    }

    // Budget amount exceeded
    if (p.budget_amount && p.hourly_rate) {
      const amount = totalHours * p.hourly_rate
      if (amount >= p.budget_amount) {
        issues.push({ type: 'budget_amount', projectId: p.id, projectName: p.name })
      }
    }

    // Deadline issues
    if (p.deadline) {
      const deadline = new Date(p.deadline)
      if (deadline < now) {
        issues.push({ type: 'deadline_passed', projectId: p.id, projectName: p.name, deadline })
      } else if (deadline <= threeDaysFromNow) {
        issues.push({ type: 'deadline_soon', projectId: p.id, projectName: p.name, deadline })
      }
    }
  }

  return issues
}

export function getBudgetPredictions() {
  if (!db) return []

  const stmt = db.prepare(`
    SELECT id, name, budget_hours, budget_amount, hourly_rate FROM projects
    WHERE (budget_hours IS NOT NULL AND budget_hours > 0)
       OR (budget_amount IS NOT NULL AND budget_amount > 0)
  `)
  const projects = stmt.all() as any[]

  const predictions = []
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  for (const p of projects) {
    // Calculate total billable seconds for this project
    const totalStmt = db.prepare(`
      SELECT COALESCE(SUM(a.duration_seconds), 0) AS total_seconds
      FROM activities a
      JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
      WHERE ws.project_id = ? AND a.billable = 1
    `)
    const totalBilling = totalStmt.get(now, p.id) as any
    const totalHours = (totalBilling?.total_seconds || 0) / 3600

    // Calculate hours in last 7 days for velocity calculation
    const recentStmt = db.prepare(`
      SELECT COALESCE(SUM(a.duration_seconds), 0) AS total_seconds
      FROM activities a
      JOIN work_sessions ws ON a.start_time >= ws.start_time AND a.start_time <= COALESCE(ws.end_time, ?)
      WHERE ws.project_id = ? AND a.billable = 1 AND a.start_time >= ?
    `)
    const recentBilling = recentStmt.get(now, p.id, sevenDaysAgo) as any
    const recentHours = (recentBilling?.total_seconds || 0) / 3600
    const hoursPerDay = recentHours / 7

    // Budget hours prediction
    if (p.budget_hours && hoursPerDay > 0) {
      const remainingHours = p.budget_hours - totalHours
      const daysUntilBudget = remainingHours > 0 ? remainingHours / hoursPerDay : 0
      const estimatedDate = new Date(now + daysUntilBudget * 24 * 60 * 60 * 1000)

      predictions.push({
        projectId: p.id,
        projectName: p.name,
        type: 'hours',
        currentUsage: totalHours,
        budgetLimit: p.budget_hours,
        percentUsed: (totalHours / p.budget_hours) * 100,
        velocityPerDay: hoursPerDay,
        daysUntilBudget: Math.max(0, daysUntilBudget),
        estimatedDate: daysUntilBudget > 0 ? estimatedDate.toISOString().split('T')[0] : 'Atteint',
      })
    }

    // Budget amount prediction
    if (p.budget_amount && p.hourly_rate && hoursPerDay > 0) {
      const totalAmount = totalHours * p.hourly_rate
      const remainingAmount = p.budget_amount - totalAmount
      const amountPerDay = hoursPerDay * p.hourly_rate
      const daysUntilBudget = remainingAmount > 0 ? remainingAmount / amountPerDay : 0
      const estimatedDate = new Date(now + daysUntilBudget * 24 * 60 * 60 * 1000)

      predictions.push({
        projectId: p.id,
        projectName: p.name,
        type: 'amount',
        currentUsage: totalAmount,
        budgetLimit: p.budget_amount,
        percentUsed: (totalAmount / p.budget_amount) * 100,
        velocityPerDay: amountPerDay,
        daysUntilBudget: Math.max(0, daysUntilBudget),
        estimatedDate: daysUntilBudget > 0 ? estimatedDate.toISOString().split('T')[0] : 'Atteint',
      })
    }
  }

  return predictions
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
