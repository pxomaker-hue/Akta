import { BrowserWindow, Notification } from 'electron'
import { execFile } from 'child_process'
import { isFocusSessionOnBreak } from './focus-mode'
import { debugLog } from './log'

let mainWindow: BrowserWindow | null = null
let blockedApps: string[] = []
let isActive = false
let lastNotifiedApp: string | null = null

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win
}

export function activateBlocking(apps: string[]) {
  blockedApps = apps.map((a) => a.trim().toLowerCase()).filter((a) => a.length > 0)
  isActive = true
  lastNotifiedApp = null
}

export function deactivateBlocking() {
  isActive = false
  blockedApps = []
  lastNotifiedApp = null
}

export function isBlockingActive() {
  return isActive
}

function matchesBlockedApp(appName: string, windowTitle: string = ''): boolean {
  const appLower = appName.toLowerCase()
  const titleLower = windowTitle.toLowerCase()

  // Priority 1: Check windowTitle first (like project detection)
  if (titleLower) {
    // Sens unique : le titre/le nom d'appli doit CONTENIR l'entrée bloquée. L'inverse
    // (`blocked.includes(title)`) bloquait par erreur toute fenêtre au titre court contenu dans
    // une entrée (ex : appli "Code" bloquée parce que "visual studio code" est dans la liste).
    const titleMatch = blockedApps.some((blocked) => titleLower.includes(blocked))
    if (titleMatch) {
      return true
    }
  }

  // Priority 2: Fallback to appName
  return blockedApps.some((blocked) => appLower.includes(blocked))
}

// Lancer PowerShell (+ compilation Add-Type) coûte ~0,5 s de CPU : une seule minimisation à la fois,
// et pas plus d'une toutes les 3 s, au lieu d'un nouveau process à chaque poll de 2 s.
const MINIMIZE_COOLDOWN_MS = 3000
let minimizeInFlight = false
let lastMinimizeAt = 0

// Minimise la fenêtre actuellement au premier plan via l'API Win32
function minimizeForegroundWindow() {
  const now = Date.now()
  if (minimizeInFlight || now - lastMinimizeAt < MINIMIZE_COOLDOWN_MS) return
  minimizeInFlight = true
  lastMinimizeAt = now

  const script =
    '$sig=\'[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\';' +
    "Add-Type -MemberDefinition $sig -Name Win32 -Namespace Native;" +
    '$hwnd = [Native.Win32]::GetForegroundWindow();' +
    '[Native.Win32]::ShowWindow($hwnd, 6) | Out-Null'

  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (error) => {
    minimizeInFlight = false
    if (error) {
      console.error('Erreur lors de la minimisation de la fenêtre:', error)
    }
  })
}

export function checkBlocking(appName: string, windowTitle: string = '') {
  if (!isActive) return
  if (isFocusSessionOnBreak()) return // pas de blocage pendant les pauses d'une session chaînée
  if (!matchesBlockedApp(appName, windowTitle)) {
    lastNotifiedApp = null
    return
  }

  debugLog(`[FocusBlocking] Blocked app: "${appName}" (title: "${windowTitle}")`)
  minimizeForegroundWindow()

  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }

  if (lastNotifiedApp !== appName && Notification.isSupported()) {
    new Notification({
      title: 'Mode focus',
      body: `${appName} est bloqué pendant ta session de concentration.`,
    }).show()
    lastNotifiedApp = appName
  }
}
