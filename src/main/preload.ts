import { contextBridge, ipcRenderer } from 'electron'

// Liste blanche des canaux IPC accessibles au renderer. Sans elle, n'importe quel contenu chargé dans
// une fenêtre (page distante, injection) pouvait appeler n'importe quel canal du process principal.
// Le preload tourne en sandbox et ne peut pas importer d'autre fichier : la liste vit donc ici.
// ⚠️ Tout nouveau ipcMain.handle / webContents.send doit être ajouté ci-dessous.
const INVOKE_CHANNELS = new Set<string>([
  'add-inactivity-exclusion', 'add-tag-to-activity', 'apply-auto-categorization', 'check-for-updates',
  'clear-sync-file-path', 'close-confirmation-response', 'create-category', 'create-client',
  'create-new-sync-file', 'create-project', 'create-project-phase', 'create-tag', 'delete-activity',
  'delete-all-activities', 'delete-category', 'delete-client', 'delete-focus-session',
  'delete-invalid-activities', 'delete-project', 'delete-project-phase', 'delete-session', 'delete-tag',
  'delete-today-activities', 'delete-uncategorized-activities', 'end-focus-session', 'export-activities-csv',
  'export-data', 'export-monthly-csv', 'export-monthly-pdf', 'export-project-csv', 'export-project-pdf',
  'get-active-challenges', 'get-activities', 'get-all-settings', 'get-app-version', 'get-budget-predictions',
  'get-categories', 'get-clients', 'get-current-activity', 'get-current-focus-session',
  'get-current-work-session-details', 'get-focus-coaching', 'get-focus-sessions',
  'get-inactivity-exclusions', 'get-launch-at-startup', 'get-leaderboard', 'get-milestones',
  'get-month-comparison', 'get-optimal-times', 'get-pauses-in-range', 'get-productivity-score',
  'get-project-billing', 'get-project-phases', 'get-project-sessions', 'get-project-time-breakdown',
  'get-projects', 'get-session-activities', 'get-sessions', 'get-setting', 'get-streak',
  'get-sync-file-path', 'get-tags', 'get-tags-by-activity', 'get-tags-for-activities', 'get-tracking-status',
  'get-tray-widget-pinned', 'get-week-trends', 'hide-tray-widget', 'import-data', 'pause-session',
  'pick-sync-file-existing', 'pick-sync-file-new', 'remove-inactivity-exclusion', 'remove-tag-from-activity',
  'resize-tray-widget', 'resume-session', 'run-sync', 'set-launch-at-startup', 'set-session-billable',
  'set-session-category-overrides', 'set-session-project', 'set-setting', 'set-tray-widget-pinned',
  'show-main-window', 'show-notification', 'start-focus-session', 'start-session', 'stop-session',
  'update-activities-billable', 'update-activity-billable', 'update-activity-category', 'update-category',
  'update-category-distraction', 'update-category-keywords', 'update-project', 'update-project-phase',
  'update-session-billable', 'update-session-details', 'window-close', 'window-is-maximized',
  'window-maximize-toggle', 'window-minimize',
])

const EVENT_CHANNELS = new Set<string>([
  'focus-session-completed', 'focus-session-started', 'request-close-confirmation', 'setting-changed',
  'tracking-status-changed', 'update-status', 'window-maximized-changed',
])

// Chaque composant qui utilise useTranslation() écoute 'setting-changed' : au-delà de 10 écouteurs,
// Node affichait un faux avertissement de fuite mémoire. Les écouteurs sont bien retirés au démontage.
ipcRenderer.setMaxListeners(100)

function assertChannel(allowed: Set<string>, channel: string) {
  if (!allowed.has(channel)) throw new Error(`Canal IPC non autorisé : ${channel}`)
}

// Map du listener "public" (celui passé par le code renderer) vers le wrapper réellement
// enregistré auprès d'ipcRenderer (qui strip le premier argument `event`) — indispensable pour que
// off() retire le bon listener : sans ça, off(listener) ne matchait jamais rien puisque le wrapper
// enregistré par on() était une closure différente à chaque appel, et les listeners s'accumulaient
// indéfiniment à chaque montage de composant (fuite mémoire + MaxListenersExceededWarning).
const listenerWrappers = new WeakMap<(...args: any[]) => void, (event: unknown, ...args: any[]) => void>()

contextBridge.exposeInMainWorld('electron', {
  ipc: {
    invoke: (channel: string, ...args: any[]) => {
      if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Canal IPC non autorisé : ${channel}`))
      return ipcRenderer.invoke(channel, ...args)
    },
    on: (channel: string, listener: (...args: any[]) => void) => {
      assertChannel(EVENT_CHANNELS, channel)
      const wrapper = (event: unknown, ...args: any[]) => listener(...args)
      listenerWrappers.set(listener, wrapper)
      ipcRenderer.on(channel, wrapper)
    },
    once: (channel: string, listener: (...args: any[]) => void) => {
      assertChannel(EVENT_CHANNELS, channel)
      ipcRenderer.once(channel, (event, ...args) => listener(...args))
    },
    off: (channel: string, listener: (...args: any[]) => void) => {
      const wrapper = listenerWrappers.get(listener)
      if (wrapper) {
        ipcRenderer.off(channel, wrapper)
        listenerWrappers.delete(listener)
      }
    },
  },
})
