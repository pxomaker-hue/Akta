import { app, BrowserWindow, ipcMain, Menu, Tray, dialog, nativeImage, nativeTheme, globalShortcut, Notification } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase, getDatabase, getSetting, setSetting, getAllSettings, createTag, getTags, getTagsByActivity, addTagToActivity, removeTagFromActivity, deleteTag, exportData, importData, exportActivitiesCSV, updateWorkSessionBillable, getWorkSessionById, getActivitiesInRange, deleteWorkSession, createProject, getProjects, deleteProject, updateProject, updateSessionDetails, createClient, getClients, deleteClient, getProjectBillableSeconds, getSessionBillableSeconds, getSessionsForProject, getSessionPauses, getSessionPausedSeconds, getPausesInRange, createProjectPhase, getProjectPhases, updateProjectPhase, deleteProjectPhase, getPhaseBillableSeconds, getProjectTimeBreakdown, exportProjectSessionsCSV, exportMonthlyCSV, getWorkSessionsWithProjectInRange, recordSyncTombstone, getSessionsWithoutProjectToday, getProjectsWithBudgetOrDeadlineIssues, getBudgetPredictions } from './database'
import { generateProjectPDF, generateMonthlyPDF } from './pdf-export'
import { startTracker, stopTracker, getRecentActivities, getCurrentActivityId, getTrackingStatus, startSession, pauseSession, resumeSession, stopSession, setSessionBillable, listWorkSessions, setSessionCategoryOverrides, setSessionProject, getCurrentWorkSessionDetails } from './tracker'
import { startFocusSession, endFocusSession, getFocusSessions, getCurrentFocusSession, deleteFocusSession, checkAutoCompleteFocusSession } from './focus-mode'
import { analyzeFocusQuality, getProductivityPattern, getCoachingRecommendations, getOptimalCycleDuration } from './coach'
import { setMainWindow, activateBlocking, deactivateBlocking } from './blocker'
import { findMatchingCategory } from './categorizer'
import { initializeChallenges, getActiveChallenges, getChallengeProgress, getCurrentStreak, getMilestones, unlockMilestone, getLeaderboard } from './challenges'
import { getProductivityScore, getOptimalTimes, getMonthComparison, getWeekTrends } from './analytics'
import { getSyncFilePath, setSyncFilePath, pickExistingSyncFile, pickNewSyncFile, createNewSyncFile, runSync } from './sync'
import { setUpdaterWindow, initAutoUpdater, checkForUpdatesManually } from './updater'
import type { Activity, Category } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// En dev, electron est lancé directement sur le fichier compilé (pas via "electron ."),
// donc le nom de l'app n'est pas déduit du package.json et userData tombe sur "Electron"
// au lieu de "Akta" — ce qui a causé deux bases de données distinctes. On force le nom ici,
// avant tout appel à app.getPath('userData').
app.setName('Akta')

const ICON_PATH = path.join(__dirname, '../../../assets/icon.png')

// Sans ceci, Windows affiche "Electron" comme expéditeur des notifications au lieu du nom de l'app
if (process.platform === 'win32') {
  app.setAppUserModelId('com.akta.app')
}

// Helper to build match rules: app-only keywords get just app_name, others get both window_title + app_name
const APP_ONLY_KEYWORDS = new Set([
  'chrome', 'firefox', 'edge', 'safari', 'brave', 'opera',
  'slack', 'discord', 'teams', 'zoom', 'outlook', 'gmail',
  'vscode', 'visual studio', 'terminal', 'powershell', 'cmd',
  'word', 'excel', 'powerpoint', 'notion',
  'figma', 'photoshop', 'illustrator', 'sketch', 'canva',
])

function buildMatchRules(keywords: string[]) {
  return keywords
    .filter((k) => k.trim())
    .flatMap((keyword) => {
      const trimmed = keyword.trim()
      const isAppOnly = APP_ONLY_KEYWORDS.has(trimmed.toLowerCase())
      if (isAppOnly) {
        return [{ type: 'app_name', keyword: trimmed }]
      } else {
        return [
          { type: 'window_title', keyword: trimmed },
          { type: 'app_name', keyword: trimmed },
        ]
      }
    })
}

// Empêche deux instances de tourner en même temps sur la même machine (deux trackers en
// parallèle corrompraient les statistiques et se disputeraient l'accès à la base SQLite).
// process.exit() est volontaire : app.quit() seul ne stoppe pas immédiatement l'exécution du
// script, qui continuerait sinon jusqu'à app.on('ready', ...) et créerait brièvement une
// fenêtre avant de se fermer.
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Un second lancement (double-clic sur le raccourci, etc.) arrive ici : on ramène la fenêtre
// existante au premier plan plutôt que de laisser une deuxième instance s'installer.
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }
})

function createWindow() {
  // Évite le flash blanc/noir au démarrage : on choisit un fond qui matche déjà le thème
  // avant même que le renderer ait chargé quoi que ce soit, et on ne montre la fenêtre
  // qu'une fois son contenu prêt à être peint (au lieu de l'afficher vide puis la remplir).
  const theme = getSetting('theme') || 'auto'
  const isDark = theme === 'dark' || (theme === 'auto' && nativeTheme.shouldUseDarkColors)
  const backgroundColor = isDark ? '#020617' : '#f9fafb'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // En dessous de ~900px, l'en-tête (logo + pill de suivi 320px + mascotte) ne tient plus et se
    // fait tronquer par le bord de la fenêtre — on empêche donc de descendre en dessous de ce seuil.
    minWidth: 950,
    minHeight: 600,
    icon: ICON_PATH,
    autoHideMenuBar: true,
    backgroundColor,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    // Lancée automatiquement au démarrage de Windows : reste réduite dans le tray plutôt que
    // d'afficher la fenêtre immédiatement — c'est le comportement attendu d'un lancement au boot.
    if (!app.getLoginItemSettings().wasOpenedAtLogin) {
      mainWindow?.show()
    }
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    const filePath = path.join(__dirname, '../../renderer/index.html')
    console.log('Loading file:', filePath)
    mainWindow.loadFile(filePath).catch((err) => {
      console.error('Failed to load file:', err)
    })
  }

  // Demande confirmation à la fermeture : quitter réellement ou réduire dans la barre système
  mainWindow.on('close', (event) => {
    if (isQuitting) return

    event.preventDefault()

    const choice = dialog.showMessageBoxSync(mainWindow as BrowserWindow, {
      type: 'question',
      buttons: ['Quitter', 'Réduire en arrière-plan', 'Annuler'],
      defaultId: 1,
      cancelId: 2,
      title: 'Fermer Akta',
      message: 'Que veux-tu faire ?',
      detail: 'Tu peux quitter complètement l\'application ou la garder active en arrière-plan (icône dans la zone de notification).',
    })

    if (choice === 0) {
      isQuitting = true
      app.quit()
    } else if (choice === 1) {
      mainWindow?.hide()
    }
    // choice === 2 (Annuler) : ne rien faire, la fenêtre reste ouverte
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  setMainWindow(mainWindow)
  setUpdaterWindow(mainWindow)
}

// Raccourcis clavier globaux : permettent de piloter une session sans faire remonter la fenêtre
// (pratique quand Akta tourne minimisé dans le tray)
function notifyGlobalAction(message: string) {
  if (Notification.isSupported()) {
    new Notification({ title: 'Akta', body: message }).show()
  }
}

function handleGlobalToggle() {
  const status = getTrackingStatus()
  if (status.sessionState === 'stopped') {
    startSession()
    notifyGlobalAction('Session démarrée')
  } else if (status.sessionState === 'running') {
    pauseSession()
    notifyGlobalAction('Session en pause')
  } else {
    resumeSession()
    notifyGlobalAction('Session reprise')
  }
  mainWindow?.webContents.send('tracking-status-changed')
}

function handleGlobalStop() {
  const status = getTrackingStatus()
  if (status.sessionState === 'stopped') return
  stopSession()
  notifyGlobalAction('Session arrêtée')
  mainWindow?.webContents.send('tracking-status-changed')
}

function registerGlobalShortcuts() {
  globalShortcut.register('Alt+Shift+S', handleGlobalToggle)
  globalShortcut.register('Alt+Shift+X', handleGlobalStop)
}

function formatSessionTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${secs}s`
}

function updateTrayMenu() {
  if (!tray) return

  const session = getCurrentWorkSessionDetails()
  const menuItems: any[] = []

  if (session) {
    const timeStr = formatSessionTime(session.elapsedSeconds)
    const statusIcon = session.isRunning ? '▶' : session.isPaused ? '⏸' : '⏹'
    menuItems.push({
      label: `${statusIcon} Session: ${timeStr}`,
      enabled: false,
    })

    if (session.currentApp) {
      menuItems.push({
        label: `   ${session.currentApp}`,
        enabled: false,
      })
    }

    menuItems.push({ type: 'separator' })

    if (session.isRunning) {
      menuItems.push({
        label: 'Pause',
        click: () => pauseSession(),
      })
    } else if (session.isPaused) {
      menuItems.push({
        label: 'Reprendre',
        click: () => resumeSession(),
      })
    }

    menuItems.push({
      label: 'Arrêter',
      click: () => stopSession(),
    })

    menuItems.push({ type: 'separator' })
  }

  menuItems.push({
    label: 'Afficher Akta',
    click: () => {
      mainWindow?.show()
      mainWindow?.focus()
    },
  })

  menuItems.push({ type: 'separator' })

  menuItems.push({
    label: 'Quitter',
    click: () => {
      isQuitting = true
      app.quit()
    },
  })

  const contextMenu = Menu.buildFromTemplate(menuItems)
  tray.setContextMenu(contextMenu)

  // Mettre à jour le tooltip
  const tooltip = session
    ? `Akta — ${formatSessionTime(session.elapsedSeconds)} (${session.isRunning ? 'en cours' : session.isPaused ? 'pause' : 'arrêtée'})`
    : 'Akta — Suivi d\'activité'
  tray.setToolTip(tooltip)
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)

  updateTrayMenu()

  // Mettre à jour le menu du tray toutes les secondes
  setInterval(() => {
    updateTrayMenu()
  }, 1000)

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

function checkSmartNotifications() {
  try {
    if (!Notification.isSupported()) return

    // 1. Sessions without project
    const sessionsWithoutProject = getSessionsWithoutProjectToday()
    if (sessionsWithoutProject.length > 0) {
      new Notification({
        title: 'Akta — Sessions sans projet',
        body: `Tu as ${sessionsWithoutProject.length} session(s) non attribuée(s) aujourd'hui. Assigne-les à un projet pour une meilleure facturation.`,
        icon: ICON_PATH,
      }).show()
    }

    // 2. Budget exceeded
    const issues = getProjectsWithBudgetOrDeadlineIssues()
    const budgetIssues = issues.filter(i => i.type.startsWith('budget'))
    const deadlineIssues = issues.filter(i => i.type.includes('deadline'))

    for (const issue of budgetIssues.slice(0, 2)) {
      if (issue.type === 'budget_hours') {
        new Notification({
          title: 'Akta — Budget dépassé',
          body: `Le projet "${issue.projectName}" a dépassé son budget en heures.`,
          icon: ICON_PATH,
        }).show()
      } else if (issue.type === 'budget_amount') {
        new Notification({
          title: 'Akta — Budget dépassé',
          body: `Le projet "${issue.projectName}" a dépassé son budget en montant.`,
          icon: ICON_PATH,
        }).show()
      }
    }

    // 3. Deadline issues
    for (const issue of deadlineIssues.slice(0, 2)) {
      if (issue.type === 'deadline_passed' && issue.deadline) {
        new Notification({
          title: 'Akta — Deadline passée',
          body: `La deadline du projet "${issue.projectName}" est passée.`,
          icon: ICON_PATH,
        }).show()
      } else if (issue.type === 'deadline_soon' && issue.deadline) {
        const daysLeft = Math.ceil((new Date(issue.deadline).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))
        new Notification({
          title: 'Akta — Deadline approche',
          body: `La deadline du projet "${issue.projectName}" est dans ${daysLeft} jour(s).`,
          icon: ICON_PATH,
        }).show()
      }
    }
  } catch (error) {
    console.error('Error in checkSmartNotifications:', error)
  }
}

app.on('ready', () => {
  // Supprime la barre de menu native (File/Edit/View...)
  Menu.setApplicationMenu(null)

  // Initialiser la base de données
  initDatabase()

  // Initialiser les défis focus
  initializeChallenges()

  // Démarrer le tracker d'activité
  startTracker()

  // Créer la fenêtre (continue even if it fails on headless systems)
  try {
    createWindow()
  } catch (error) {
    console.error('Failed to create window:', error)
  }

  // Icône dans la zone de notification (icônes cachées) — skip on headless
  try {
    createTray()
  } catch (error) {
    console.warn('Failed to create tray:', error)
  }

  // Raccourcis clavier globaux (start/pause/resume/stop, même fenêtre non focus)
  registerGlobalShortcuts()

  // Vérification des mises à jour (no-op en dev, actif seulement sur l'app installée)
  initAutoUpdater()

  // Configurer les handlers IPC
  setupIpcHandlers()

  // Clôture automatique d'une session Mode Focus arrivée à échéance, même si l'utilisateur a
  // quitté cet onglet (ou l'app est réduite dans le tray) : sinon le blocage d'apps restait actif
  // et rien ne prévenait (notification, icône Mode Focus) tant qu'on ne revenait pas sur l'onglet.
  setInterval(() => {
    const completed = checkAutoCompleteFocusSession()
    if (!completed) return

    deactivateBlocking()

    if (Notification.isSupported()) {
      new Notification({
        title: 'Akta — Session terminée !',
        body: 'Ta session de concentration est terminée, bien joué !',
        icon: ICON_PATH,
      }).show()
    }

    mainWindow?.webContents.send('focus-session-completed', completed)
  }, 3000)

  // Check smart notifications every hour (but with a small random offset to avoid thundering herd)
  const notificationCheckInterval = 60 * 60 * 1000 + Math.random() * 5 * 60 * 1000
  setInterval(() => {
    try {
      checkSmartNotifications()
    } catch (error) {
      console.error('Hourly check smart notifications error:', error)
    }
  }, notificationCheckInterval)

  // Also run on startup after a small delay to let DB settle
  setTimeout(() => {
    try {
      checkSmartNotifications()
    } catch (error) {
      console.error('Initial smart notifications check failed:', error)
    }
  }, 2000)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // La fenêtre peut être fermée (cachée) sans quitter l'app tant que le tray est actif
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('quit', () => {
  stopTracker()
  closeDatabase()
})

function setupIpcHandlers() {
  // Get recent activities
  ipcMain.handle('get-activities', async (event, limitDays: number = 7) => {
    try {
      return getRecentActivities(limitDays)
    } catch (error) {
      console.error('Error getting activities:', error)
      throw error
    }
  })

  // Get all categories
  ipcMain.handle('get-categories', async () => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('SELECT * FROM categories ORDER BY name')
      const categories = stmt.all() as any[]

      return categories.map((cat) => ({
        ...cat,
        match_rules: JSON.parse(cat.match_rules || '[]'),
        is_distraction: !!cat.is_distraction,
        billable_default: !!cat.billable_default,
      }))
    } catch (error) {
      console.error('Error getting categories:', error)
      throw error
    }
  })

  // Create category
  ipcMain.handle(
    'create-category',
    async (event, name: string, color: string, billable: boolean, keywords: string[] = [], isDistraction: boolean = false) => {
      try {
        const db = getDatabase()
        const stmt = db.prepare(`
        INSERT INTO categories (name, color, billable_default, match_rules, is_distraction, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

        const matchRules = buildMatchRules(keywords)
        const result = stmt.run(name, color, billable ? 1 : 0, JSON.stringify(matchRules), isDistraction ? 1 : 0, Date.now())
        return Number(result.lastInsertRowid)
      } catch (error) {
        console.error('Error creating category:', error)
        throw error
      }
    }
  )

  // Update category keywords (auto-categorization rules)
  ipcMain.handle('update-category-keywords', async (event, categoryId: number, keywords: string[]) => {
    try {
      const db = getDatabase()
      const matchRules = buildMatchRules(keywords)
      const stmt = db.prepare('UPDATE categories SET match_rules = ?, updated_at = ? WHERE id = ?')
      stmt.run(JSON.stringify(matchRules), Date.now(), categoryId)
      return true
    } catch (error) {
      console.error('Error updating category keywords:', error)
      throw error
    }
  })

  // Toggle si une catégorie est une "distraction" (jamais facturable, coaching de focus)
  ipcMain.handle('update-category-distraction', async (event, categoryId: number, isDistraction: boolean) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('UPDATE categories SET is_distraction = ?, updated_at = ? WHERE id = ?')
      stmt.run(isDistraction ? 1 : 0, Date.now(), categoryId)
      return true
    } catch (error) {
      console.error('Error updating category distraction flag:', error)
      throw error
    }
  })

  // Update category name, color, and billable status
  ipcMain.handle('update-category', async (event, categoryId: number, name: string, color: string, billable: boolean) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('UPDATE categories SET name = ?, color = ?, billable_default = ?, updated_at = ? WHERE id = ?')
      stmt.run(name, color, billable ? 1 : 0, Date.now(), categoryId)
      return true
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  })

  // Delete category
  ipcMain.handle('delete-category', async (event, categoryId: number) => {
    try {
      const db = getDatabase()
      const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId) as any
      if (category) recordSyncTombstone('category', category.name)
      db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId)
      return true
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  })

  // Retroactively apply category rules to uncategorized activities
  ipcMain.handle('apply-auto-categorization', async () => {
    try {
      const db = getDatabase()
      const uncategorized = db.prepare('SELECT id, app_name, window_title FROM activities WHERE category_id IS NULL').all() as any[]

      let updated = 0
      const updateStmt = db.prepare('UPDATE activities SET category_id = ?, billable = ? WHERE id = ?')

      for (const activity of uncategorized) {
        const match = findMatchingCategory(activity.app_name, activity.window_title)
        if (match) {
          updateStmt.run(match.id, match.billable ? 1 : 0, activity.id)
          updated++
        }
      }

      return updated
    } catch (error) {
      console.error('Error applying auto-categorization:', error)
      throw error
    }
  })

  // Delete a single activity
  ipcMain.handle('delete-activity', async (event, activityId: number) => {
    try {
      const db = getDatabase()
      db.prepare('DELETE FROM activities WHERE id = ?').run(activityId)
      return true
    } catch (error) {
      console.error('Error deleting activity:', error)
      throw error
    }
  })

  // Clean up invalid activities (Unknown app name, or leftover Akta self-tracking)
  ipcMain.handle('delete-invalid-activities', async () => {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        DELETE FROM activities
        WHERE app_name = 'Unknown'
           OR LOWER(app_name) LIKE '%akta%'
           OR LOWER(window_title) LIKE '%akta%'
      `)
      const result = stmt.run()
      return result.changes
    } catch (error) {
      console.error('Error cleaning up invalid activities:', error)
      throw error
    }
  })

  // Delete every uncategorized activity
  ipcMain.handle('delete-uncategorized-activities', async () => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('DELETE FROM activities WHERE category_id IS NULL')
      const result = stmt.run()
      return result.changes
    } catch (error) {
      console.error('Error deleting uncategorized activities:', error)
      throw error
    }
  })

  // Delete every activity recorded today
  ipcMain.handle('delete-today-activities', async () => {
    try {
      const db = getDatabase()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const stmt = db.prepare('DELETE FROM activities WHERE start_time >= ?')
      const result = stmt.run(todayStart.getTime())
      return result.changes
    } catch (error) {
      console.error('Error deleting today activities:', error)
      throw error
    }
  })

  // Delete every activity ever recorded (full reset)
  ipcMain.handle('delete-all-activities', async () => {
    try {
      const db = getDatabase()
      const result = db.prepare('DELETE FROM activities').run()
      return result.changes
    } catch (error) {
      console.error('Error deleting all activities:', error)
      throw error
    }
  })

  // Update activity category
  ipcMain.handle('update-activity-category', async (event, activityId: number, categoryId: number | null) => {
    try {
      const db = getDatabase()

      if (categoryId === null) {
        const stmt = db.prepare(`
          UPDATE activities
          SET category_id = NULL, billable = NULL
          WHERE id = ?
        `)
        stmt.run(activityId)
      } else {
        const catStmt = db.prepare('SELECT billable_default FROM categories WHERE id = ?')
        const category = catStmt.get(categoryId) as any

        if (!category) {
          throw new Error('Category not found')
        }

        const stmt = db.prepare(`
          UPDATE activities
          SET category_id = ?, billable = ?
          WHERE id = ?
        `)
        stmt.run(categoryId, category.billable_default, activityId)
      }

      return true
    } catch (error) {
      console.error('Error updating activity category:', error)
      throw error
    }
  })

  // Update activity billable status manually
  ipcMain.handle('update-activity-billable', async (event, activityId: number, billable: boolean) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('UPDATE activities SET billable = ? WHERE id = ?')
      stmt.run(billable ? 1 : 0, activityId)
      return true
    } catch (error) {
      console.error('Error updating activity billable status:', error)
      throw error
    }
  })

  // Update billable status for a whole session (multiple activities at once)
  ipcMain.handle('update-activities-billable', async (event, activityIds: number[], billable: boolean) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('UPDATE activities SET billable = ? WHERE id = ?')
      const updateMany = db.transaction((ids: number[]) => {
        for (const id of ids) {
          stmt.run(billable ? 1 : 0, id)
        }
      })
      updateMany(activityIds)
      return true
    } catch (error) {
      console.error('Error updating activities billable status:', error)
      throw error
    }
  })

  // Get current activity
  ipcMain.handle('get-current-activity', async () => {
    return getCurrentActivityId()
  })

  // Get live tracking status (session en cours, idle ou non)
  ipcMain.handle('get-tracking-status', async () => {
    return getTrackingStatus()
  })

  // Contrôle de la session active : démarrer / mettre en pause / reprendre / arrêter
  ipcMain.handle('start-session', async () => {
    startSession()
    return getTrackingStatus()
  })

  ipcMain.handle('pause-session', async () => {
    pauseSession()
    return getTrackingStatus()
  })

  ipcMain.handle('resume-session', async () => {
    resumeSession()
    return getTrackingStatus()
  })

  ipcMain.handle('stop-session', async () => {
    stopSession()
    return getTrackingStatus()
  })

  ipcMain.handle('set-session-billable', async (event, billable: boolean) => {
    setSessionBillable(billable)
    return getTrackingStatus()
  })

  // Surcharges focus/distraction propres à la session en cours (ex : "web" en distraction pour ce dossier client précis)
  ipcMain.handle('set-session-category-overrides', async (event, overrides: Record<number, 'focus' | 'distraction'>) => {
    setSessionCategoryOverrides(overrides)
    return getTrackingStatus()
  })

  // Rattache la session en cours à un projet (et éventuellement une phase), depuis la pill de suivi
  ipcMain.handle('set-session-project', async (event, projectId: number | null, phaseId: number | null) => {
    setSessionProject(projectId, phaseId)
    return getTrackingStatus()
  })

  // Liste les sessions de travail (entités persistées : start/pause/stop) depuis N jours
  ipcMain.handle('get-sessions', async (event, limitDays: number = 7) => {
    try {
      const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000
      return listWorkSessions(cutoff)
    } catch (error) {
      console.error('Error getting sessions:', error)
      throw error
    }
  })

  // Historique condensé (par application) des activités qui composent une session donnée
  ipcMain.handle('get-session-activities', async (event, sessionId: number) => {
    try {
      const session = getWorkSessionById(sessionId)
      if (!session) return { apps: [], billableSeconds: 0, pauses: [], pausedSeconds: 0 }
      const rangeEnd = session.end_time ?? Date.now()
      const activities = getActivitiesInRange(session.start_time, rangeEnd)

      const byApp = new Map<string, { app_name: string; duration_seconds: number; billable_seconds: number; count: number }>()
      for (const activity of activities) {
        const existing = byApp.get(activity.app_name) || {
          app_name: activity.app_name,
          duration_seconds: 0,
          billable_seconds: 0,
          count: 0,
        }
        existing.duration_seconds += activity.duration_seconds
        if (activity.billable) existing.billable_seconds += activity.duration_seconds
        existing.count += 1
        byApp.set(activity.app_name, existing)
      }

      const apps = Array.from(byApp.values()).sort((a, b) => b.duration_seconds - a.duration_seconds)
      const billableSeconds = getSessionBillableSeconds(sessionId)
      const pauses = getSessionPauses(sessionId).map((p) => ({
        id: p.id,
        start_time: p.start_time,
        end_time: p.end_time,
        duration_seconds: p.end_time !== null ? p.duration_seconds : Math.max(Math.floor((Date.now() - p.start_time) / 1000), 0),
      }))
      const pausedSeconds = getSessionPausedSeconds(sessionId, Date.now())

      return { apps, billableSeconds, pauses, pausedSeconds }
    } catch (error) {
      console.error('Error getting session activities:', error)
      throw error
    }
  })

  // Toutes les pauses chevauchant une plage donnée (utilisé par la courbe de flow, indépendamment d'une session précise)
  ipcMain.handle('get-pauses-in-range', async (event, startMs: number, endMs: number) => {
    try {
      return getPausesInRange(startMs, endMs)
    } catch (error) {
      console.error('Error getting pauses in range:', error)
      throw error
    }
  })

  // Sessions rattachées à un projet, avec le montant facturable calculé pour chacune
  ipcMain.handle('get-project-sessions', async (event, projectId: number) => {
    try {
      const sessions = getSessionsForProject(projectId)
      return sessions.map((s) => ({ ...s, billable_seconds: getSessionBillableSeconds(s.id) }))
    } catch (error) {
      console.error('Error getting project sessions:', error)
      throw error
    }
  })

  // Marque une session (passée ou en cours) comme facturable ou non, a posteriori
  ipcMain.handle('update-session-billable', async (event, sessionId: number, billable: boolean) => {
    try {
      updateWorkSessionBillable(sessionId, billable)
      return true
    } catch (error) {
      console.error('Error updating session billable status:', error)
      throw error
    }
  })

  // Supprime une session de travail terminée (garde ses activités intactes)
  ipcMain.handle('delete-session', async (event, sessionId: number) => {
    try {
      deleteWorkSession(sessionId)
      return true
    } catch (error) {
      console.error('Error deleting session:', error)
      throw error
    }
  })

  // Nomme une session et/ou l'attribue à un projet (et éventuellement une phase de ce projet)
  ipcMain.handle(
    'update-session-details',
    async (event, sessionId: number, label: string | null, projectId: number | null, phaseId: number | null = null) => {
      try {
        updateSessionDetails(sessionId, label, projectId, phaseId)
        return true
      } catch (error) {
        console.error('Error updating session details:', error)
        throw error
      }
    }
  )

  // Gestion de projets (interne à l'app, pour rattacher les sessions actives)
  ipcMain.handle(
    'create-project',
    async (
      event,
      name: string,
      color: string = '#6366f1',
      clientId: number | null = null,
      hourlyRate: number | null = null,
      hourGoal: number | null = null,
      budgetHours: number | null = null,
      budgetAmount: number | null = null,
      deadline: number | null = null,
      keywords: string | null = null
    ) => {
      try {
        return createProject(name, color, clientId, hourlyRate, hourGoal, budgetHours, budgetAmount, deadline, keywords)
      } catch (error) {
        console.error('Error creating project:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'update-project',
    async (
      event,
      projectId: number,
      name: string,
      color: string,
      clientId: number | null,
      hourlyRate: number | null,
      status: string,
      hourGoal: number | null,
      budgetHours: number | null = null,
      budgetAmount: number | null = null,
      deadline: number | null = null,
      keywords: string | null = null
    ) => {
      try {
        updateProject(projectId, name, color, clientId, hourlyRate, status, hourGoal, budgetHours, budgetAmount, deadline, keywords)
        return true
      } catch (error) {
        console.error('Error updating project:', error)
        throw error
      }
    }
  )

  // Répartition du temps facturable par projet sur une plage donnée (utilisé par le graphique des Rapports)
  ipcMain.handle('get-project-time-breakdown', async (event, startMs: number, endMs: number) => {
    try {
      return getProjectTimeBreakdown(startMs, endMs)
    } catch (error) {
      console.error('Error getting project time breakdown:', error)
      throw error
    }
  })

  // Heures facturables accumulées pour un projet (ce mois-ci + total), pour l'estimation de facturation
  ipcMain.handle('get-project-billing', async (event, projectId: number) => {
    try {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthSeconds = getProjectBillableSeconds(projectId, monthStart.getTime())
      const totalSeconds = getProjectBillableSeconds(projectId, 0)

      return { monthSeconds, totalSeconds }
    } catch (error) {
      console.error('Error getting project billing:', error)
      throw error
    }
  })

  ipcMain.handle('get-projects', async () => {
    try {
      return getProjects()
    } catch (error) {
      console.error('Error getting projects:', error)
      throw error
    }
  })

  ipcMain.handle('delete-project', async (event, projectId: number) => {
    try {
      deleteProject(projectId)
      return true
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  })

  // Phases de projet (ex : Esquisse, PC, DCE, Chantier) — permettent de ventiler le temps d'un projet
  ipcMain.handle('create-project-phase', async (event, projectId: number, name: string, color: string = '#6366f1', keywords: string | null = null) => {
    try {
      return createProjectPhase(projectId, name, color, keywords)
    } catch (error) {
      console.error('Error creating project phase:', error)
      throw error
    }
  })

  ipcMain.handle('get-project-phases', async (event, projectId: number) => {
    try {
      const phases = getProjectPhases(projectId)
      return phases.map((ph) => ({ ...ph, billable_seconds: getPhaseBillableSeconds(ph.id) }))
    } catch (error) {
      console.error('Error getting project phases:', error)
      throw error
    }
  })

  ipcMain.handle('update-project-phase', async (event, phaseId: number, name: string, color: string, status: string, keywords: string | null = null) => {
    try {
      updateProjectPhase(phaseId, name, color, status, keywords)
      return true
    } catch (error) {
      console.error('Error updating project phase:', error)
      throw error
    }
  })

  ipcMain.handle('delete-project-phase', async (event, phaseId: number) => {
    try {
      deleteProjectPhase(phaseId)
      return true
    } catch (error) {
      console.error('Error deleting project phase:', error)
      throw error
    }
  })

  // Clients
  ipcMain.handle('create-client', async (event, name: string, color: string = '#6366f1') => {
    try {
      return createClient(name, color)
    } catch (error) {
      console.error('Error creating client:', error)
      throw error
    }
  })

  ipcMain.handle('get-clients', async () => {
    try {
      return getClients()
    } catch (error) {
      console.error('Error getting clients:', error)
      throw error
    }
  })

  ipcMain.handle('delete-client', async (event, clientId: number) => {
    try {
      deleteClient(clientId)
      return true
    } catch (error) {
      console.error('Error deleting client:', error)
      throw error
    }
  })

  // Focus Mode handlers
  // Map to track which Focus Sessions created their own Work Sessions
  const focusSessionWorkSessionMap = new Map<number, boolean>()

  ipcMain.handle('start-focus-session', async (event, duration: number, blockedApps: string[], createWorkSession: boolean = false) => {
    try {
      // Check if a work session is already active
      const currentStatus = getTrackingStatus()
      const hasActiveWorkSession = currentStatus.sessionState === 'running' || currentStatus.sessionState === 'paused'

      // Track if we created a work session
      let didCreateWorkSession = false

      // If user wants to create a work session and none is active, start one
      if (createWorkSession && !hasActiveWorkSession) {
        console.log('[FocusMode] Creating work session for focus mode')
        startSession()
        didCreateWorkSession = true
      }

      const session = startFocusSession(duration, blockedApps)

      // Remember that this focus session created a work session
      if (didCreateWorkSession) {
        focusSessionWorkSessionMap.set(session.id, true)
      }

      try {
        activateBlocking(blockedApps)
      } catch (blockError) {
        console.warn('Warning: could not activate app blocking:', blockError)
      }

      // Notify all windows that a session was started
      if (mainWindow) {
        mainWindow.webContents.send('focus-session-started', session)
      }
      return session
    } catch (error) {
      console.error('Error starting focus session:', error)
      throw error
    }
  })

  ipcMain.handle('end-focus-session', async (event, sessionId: number) => {
    try {
      // Check if this focus session created a work session
      const didCreateWorkSession = focusSessionWorkSessionMap.get(sessionId)

      // If we created a work session, end it too
      if (didCreateWorkSession) {
        console.log('[FocusMode] Ending work session that was created by focus mode')
        stopSession()
      }

      // Clean up the map
      focusSessionWorkSessionMap.delete(sessionId)

      const result = endFocusSession(sessionId)
      deactivateBlocking()

      // Send notification for completed session
      if (result.completed) {
        const { notifySessionCompleted, getCurrentStreak } = await import('./coach')
        const streakDays = getCurrentStreak()
        const mode = await store.get('focus_coaching_mode', 'tdah')
        notifySessionCompleted(result.duration, streakDays, mode)
      }

      return result
    } catch (error) {
      console.error('Error ending focus session:', error)
      throw error
    }
  })

  ipcMain.handle('delete-focus-session', async (event, sessionId: number) => {
    try {
      deleteFocusSession(sessionId)
      return true
    } catch (error) {
      console.error('Error deleting focus session:', error)
      throw error
    }
  })

  ipcMain.handle('get-focus-sessions', async (event, limitDays: number = 7) => {
    try {
      return getFocusSessions(limitDays)
    } catch (error) {
      console.error('Error getting focus sessions:', error)
      throw error
    }
  })

  ipcMain.handle('get-current-focus-session', async () => {
    try {
      return getCurrentFocusSession()
    } catch (error) {
      console.error('Error getting current focus session:', error)
      throw error
    }
  })

  // Settings handlers
  ipcMain.handle('get-setting', async (event, key: string) => {
    try {
      return getSetting(key)
    } catch (error) {
      console.error('Error getting setting:', error)
      throw error
    }
  })

  ipcMain.handle('set-setting', async (event, key: string, value: string) => {
    try {
      setSetting(key, value)
      // Notify renderer of setting change
      if (mainWindow) {
        mainWindow.webContents.send('setting-changed', { key, value })
      }
      return true
    } catch (error) {
      console.error('Error setting setting:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-settings', async () => {
    try {
      return getAllSettings()
    } catch (error) {
      console.error('Error getting all settings:', error)
      throw error
    }
  })

  // Lancement au démarrage de Windows. On lit/écrit directement l'état géré par l'OS (via
  // app.getLoginItemSettings/setLoginItemSettings) plutôt qu'un simple booléen en base, pour ne
  // jamais désynchroniser l'interface de la réalité (ex : l'utilisateur désactive le raccourci
  // manuellement depuis le Gestionnaire des tâches > Démarrage).
  ipcMain.handle('get-launch-at-startup', async () => {
    try {
      return app.getLoginItemSettings().openAtLogin
    } catch (error) {
      console.error('Error getting launch-at-startup setting:', error)
      return false
    }
  })

  ipcMain.handle('set-launch-at-startup', async (event, enabled: boolean) => {
    try {
      app.setLoginItemSettings({ openAtLogin: enabled })
      return true
    } catch (error) {
      console.error('Error setting launch-at-startup:', error)
      throw error
    }
  })

  // Notification OS générique, déclenchable depuis le renderer (ex : transitions du Mode Focus)
  ipcMain.handle('show-notification', async (event, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: ICON_PATH }).show()
    }
  })

  // Analytics handlers
  ipcMain.handle('get-productivity-score', async (event, limitDays: number = 7) => {
    try {
      return getProductivityScore(limitDays)
    } catch (error) {
      console.error('Error getting productivity score:', error)
      throw error
    }
  })

  ipcMain.handle('get-optimal-times', async () => {
    try {
      return getOptimalTimes()
    } catch (error) {
      console.error('Error getting optimal times:', error)
      throw error
    }
  })

  ipcMain.handle('get-month-comparison', async () => {
    try {
      return getMonthComparison()
    } catch (error) {
      console.error('Error getting month comparison:', error)
      throw error
    }
  })

  ipcMain.handle('get-week-trends', async () => {
    try {
      return getWeekTrends()
    } catch (error) {
      console.error('Error getting week trends:', error)
      throw error
    }
  })

  // Tags handlers
  ipcMain.handle('create-tag', async (event, name: string, color: string = '#6366f1') => {
    try {
      return createTag(name, color)
    } catch (error) {
      console.error('Error creating tag:', error)
      throw error
    }
  })

  ipcMain.handle('get-tags', async () => {
    try {
      return getTags()
    } catch (error) {
      console.error('Error getting tags:', error)
      throw error
    }
  })

  ipcMain.handle('get-tags-by-activity', async (event, activityId: number) => {
    try {
      return getTagsByActivity(activityId)
    } catch (error) {
      console.error('Error getting tags by activity:', error)
      throw error
    }
  })

  ipcMain.handle('get-tags-for-activities', async (event, activityIds: number[]) => {
    try {
      const { getTagsForActivities } = await import('./database')
      return getTagsForActivities(activityIds)
    } catch (error) {
      console.error('Error getting tags for activities:', error)
      throw error
    }
  })

  ipcMain.handle('add-tag-to-activity', async (event, activityId: number, tagId: number) => {
    try {
      addTagToActivity(activityId, tagId)
      return true
    } catch (error) {
      console.error('Error adding tag to activity:', error)
      throw error
    }
  })

  ipcMain.handle('remove-tag-from-activity', async (event, activityId: number, tagId: number) => {
    try {
      removeTagFromActivity(activityId, tagId)
      return true
    } catch (error) {
      console.error('Error removing tag from activity:', error)
      throw error
    }
  })

  ipcMain.handle('delete-tag', async (event, tagId: number) => {
    try {
      deleteTag(tagId)
      return true
    } catch (error) {
      console.error('Error deleting tag:', error)
      throw error
    }
  })

  // Backup/Restore handlers
  ipcMain.handle('export-data', async () => {
    try {
      return exportData()
    } catch (error) {
      console.error('Error exporting data:', error)
      throw error
    }
  })

  // Mises à jour
  ipcMain.handle('check-for-updates', async () => {
    return checkForUpdatesManually()
  })

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('export-activities-csv', async () => {
    try {
      return exportActivitiesCSV()
    } catch (error) {
      console.error('Error exporting activities CSV:', error)
      throw error
    }
  })

  // Export comptable/facturation d'un projet (CSV, une ligne par session) ou d'un mois (tous projets)
  ipcMain.handle('export-project-csv', async (event, projectId: number) => {
    try {
      return exportProjectSessionsCSV(projectId)
    } catch (error) {
      console.error('Error exporting project CSV:', error)
      throw error
    }
  })

  ipcMain.handle('export-monthly-csv', async (event, startMs: number, endMs: number) => {
    try {
      return exportMonthlyCSV(startMs, endMs)
    } catch (error) {
      console.error('Error exporting monthly CSV:', error)
      throw error
    }
  })

  // Même chose en PDF (rapport imprimable) — retourné en base64, converti côté renderer en téléchargement
  ipcMain.handle('export-project-pdf', async (event, projectId: number) => {
    try {
      const buffer = await generateProjectPDF(projectId)
      return buffer.toString('base64')
    } catch (error) {
      console.error('Error exporting project PDF:', error)
      throw error
    }
  })

  ipcMain.handle('export-monthly-pdf', async (event, startMs: number, endMs: number) => {
    try {
      const sessions = getWorkSessionsWithProjectInRange(startMs, endMs)
      const buffer = await generateMonthlyPDF(startMs, endMs, sessions)
      return buffer.toString('base64')
    } catch (error) {
      console.error('Error exporting monthly PDF:', error)
      throw error
    }
  })

  ipcMain.handle('import-data', async (event, jsonData: string) => {
    try {
      const result = importData(jsonData)
      return result
    } catch (error) {
      console.error('Error importing data:', error)
      throw error
    }
  })

  // Synchronisation entre machines via un fichier partagé (ex : sur un NAS)
  ipcMain.handle('get-sync-file-path', async () => {
    return getSyncFilePath()
  })

  ipcMain.handle('pick-sync-file-existing', async () => {
    try {
      const picked = await pickExistingSyncFile(mainWindow)
      if (picked) setSyncFilePath(picked.path)
      return picked
    } catch (error) {
      console.error('Error picking existing sync file:', error)
      throw error
    }
  })

  // N'ouvre que le dialogue de sélection : ne touche ni au chemin de synchro configuré ni au fichier
  // lui-même. C'est create-new-sync-file (déclenché après confirmation côté renderer si un fichier
  // existe déjà à cet emplacement) qui écrase réellement.
  ipcMain.handle('pick-sync-file-new', async () => {
    try {
      return await pickNewSyncFile(mainWindow)
    } catch (error) {
      console.error('Error picking new sync file:', error)
      throw error
    }
  })

  ipcMain.handle('create-new-sync-file', async (event, filePath: string) => {
    try {
      createNewSyncFile(filePath)
      return true
    } catch (error) {
      console.error('Error creating new sync file:', error)
      throw error
    }
  })

  ipcMain.handle('clear-sync-file-path', async () => {
    setSyncFilePath(null)
    return true
  })

  ipcMain.handle('run-sync', async () => {
    try {
      return await runSync()
    } catch (error) {
      console.error('Error running sync:', error)
      throw error
    }
  })

  // Inactivity exclusions management
  ipcMain.handle('get-inactivity-exclusions', async () => {
    try {
      const { getInactivityExclusions } = await import('./database')
      return getInactivityExclusions()
    } catch (error) {
      console.error('Error getting exclusions:', error)
      throw error
    }
  })

  ipcMain.handle('add-inactivity-exclusion', async (event, appPattern: string | null, titlePattern: string | null, description?: string) => {
    try {
      const { addInactivityExclusion } = await import('./database')
      const id = addInactivityExclusion(appPattern, titlePattern, description)
      return { id }
    } catch (error) {
      console.error('Error adding exclusion:', error)
      throw error
    }
  })

  ipcMain.handle('remove-inactivity-exclusion', async (event, id: number) => {
    try {
      const { removeInactivityExclusion } = await import('./database')
      removeInactivityExclusion(id)
      return true
    } catch (error) {
      console.error('Error removing exclusion:', error)
      throw error
    }
  })

  ipcMain.handle('get-budget-predictions', async () => {
    try {
      return getBudgetPredictions()
    } catch (error) {
      console.error('Error getting budget predictions:', error)
      throw error
    }
  })

  ipcMain.handle('get-focus-coaching', async (event, dayLimit: number = 7) => {
    try {
      const sessions = getFocusSessions(dayLimit)
      const analysis = analyzeFocusQuality(sessions)
      const pattern = getProductivityPattern(sessions)
      const recommendations = getCoachingRecommendations(analysis, pattern)
      const optimalCycle = getOptimalCycleDuration(analysis)

      return {
        analysis,
        pattern,
        recommendations,
        optimalCycle,
        sessionCount: sessions.length,
      }
    } catch (error) {
      console.error('Error getting focus coaching:', error)
      throw error
    }
  })

  // Challenges / Défis Focus
  ipcMain.handle('get-active-challenges', async () => {
    try {
      const challenges = getActiveChallenges()
      const progress = challenges.map((c) => ({
        challenge: c,
        progress: getChallengeProgress(c.id),
      }))
      return progress
    } catch (error) {
      console.error('Error getting active challenges:', error)
      throw error
    }
  })

  ipcMain.handle('get-streak', async () => {
    try {
      return getCurrentStreak()
    } catch (error) {
      console.error('Error getting streak:', error)
      throw error
    }
  })

  ipcMain.handle('get-milestones', async () => {
    try {
      return getMilestones()
    } catch (error) {
      console.error('Error getting milestones:', error)
      throw error
    }
  })

  ipcMain.handle('get-leaderboard', async (event, duration: 'weekly' | 'monthly' | 'all_time' = 'weekly') => {
    try {
      return getLeaderboard(duration)
    } catch (error) {
      console.error('Error getting leaderboard:', error)
      throw error
    }
  })
}
