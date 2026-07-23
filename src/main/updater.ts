import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

let mainWindowRef: BrowserWindow | null = null
let initialized = false

export function setUpdaterWindow(win: BrowserWindow) {
  mainWindowRef = win
}

function sendStatus(payload: Record<string, unknown>) {
  mainWindowRef?.webContents.send('update-status', payload)
}

// En dev (app non empaquetée), electron-updater n'a rien à vérifier et lèverait une erreur —
// toute la logique de mise à jour est donc no-op tant que l'app n'est pas installée via l'installeur.
export function initAutoUpdater() {
  if (initialized || !app.isPackaged) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ status: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ status: 'downloaded', version: info.version })

    dialog
      .showMessageBox(mainWindowRef ?? (undefined as any), {
        type: 'info',
        title: 'Mise à jour prête',
        message: `Akta ${info.version} a été téléchargée.`,
        detail: "Redémarrer maintenant pour l'installer ?",
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (error) => {
    sendStatus({ status: 'error', message: error.message })
  })

  // Vérification différée pour ne pas ralentir le démarrage de l'appli
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 10000)
}

export async function checkForUpdatesManually(): Promise<{ status: string }> {
  if (!app.isPackaged) {
    return { status: 'dev-mode' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { status: 'checking' }
  } catch (error: any) {
    return { status: 'error' }
  }
}
