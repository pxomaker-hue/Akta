import { BrowserWindow, Notification } from 'electron'
import { execFile } from 'child_process'

let mainWindow: BrowserWindow | null = null
let blockedApps: string[] = []
let isActive = false
let lastNotifiedApp: string | null = null

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win
}

export function activateBlocking(apps: string[]) {
  blockedApps = apps.map((a) => a.toLowerCase())
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
    const titleMatch = blockedApps.some((blocked) => titleLower.includes(blocked) || blocked.includes(titleLower))
    if (titleMatch) {
      return true
    }
  }

  // Priority 2: Fallback to appName
  return blockedApps.some((blocked) => appLower.includes(blocked) || blocked.includes(appLower))
}

// Minimise la fenêtre actuellement au premier plan via l'API Win32
function minimizeForegroundWindow() {
  const script =
    '$sig=\'[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\';' +
    "Add-Type -MemberDefinition $sig -Name Win32 -Namespace Native;" +
    '$hwnd = [Native.Win32]::GetForegroundWindow();' +
    '[Native.Win32]::ShowWindow($hwnd, 6) | Out-Null'

  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (error) => {
    if (error) {
      console.error('Erreur lors de la minimisation de la fenêtre:', error)
    }
  })
}

export function checkBlocking(appName: string, windowTitle: string = '') {
  if (!isActive) return
  if (!matchesBlockedApp(appName, windowTitle)) {
    lastNotifiedApp = null
    return
  }

  console.log(`[FocusBlocking] Blocked app: "${appName}" (title: "${windowTitle}")`)
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
