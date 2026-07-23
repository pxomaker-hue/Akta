import { dialog, BrowserWindow } from 'electron'
import fs from 'fs'
import { getSetting, setSetting, exportSyncData, importSyncDataMerge } from './database'

const SYNC_SETTING_KEY = 'sync_file_path'

export function getSyncFilePath(): string | null {
  return getSetting(SYNC_SETTING_KEY)
}

export function setSyncFilePath(filePath: string | null): void {
  setSetting(SYNC_SETTING_KEY, filePath ?? '')
}

export interface PickSyncFileResult {
  path: string
  alreadyExists: boolean
  existingDate: string | null
}

function describeExisting(filePath: string): PickSyncFileResult {
  try {
    const stat = fs.statSync(filePath)
    return { path: filePath, alreadyExists: true, existingDate: stat.mtime.toISOString() }
  } catch {
    return { path: filePath, alreadyExists: false, existingDate: null }
  }
}

// Se connecter à un fichier de synchro déjà créé par une autre machine (ex : deuxième ordinateur
// qui rejoint un partage NAS déjà en place).
export async function pickExistingSyncFile(win: BrowserWindow | null): Promise<PickSyncFileResult | null> {
  const result = await dialog.showOpenDialog(win ?? (undefined as any), {
    title: 'Sélectionner le fichier de synchronisation existant',
    filters: [{ name: 'Fichier de synchronisation Akta', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return describeExisting(result.filePaths[0])
}

// Créer un nouveau fichier de synchro (première machine à configurer le partage, ou remise à zéro
// volontaire). Ne fait qu'ouvrir le dialogue et décrire ce qui existe déjà à cet emplacement — c'est
// createNewSyncFile() qui écrase réellement, seulement après confirmation côté renderer.
export async function pickNewSyncFile(win: BrowserWindow | null): Promise<PickSyncFileResult | null> {
  const result = await dialog.showSaveDialog(win ?? (undefined as any), {
    title: 'Créer un nouveau fichier de synchronisation',
    defaultPath: 'akta-sync.json',
    filters: [{ name: 'Fichier de synchronisation Akta', extensions: ['json'] }],
    properties: ['createDirectory'],
  })
  if (result.canceled || !result.filePath) return null
  return describeExisting(result.filePath)
}

// Écriture atomique : fichier temporaire puis rename, pour éviter qu'une autre machine ne lise
// un fichier à moitié écrit si elle synchronise au même moment.
function writeSyncFileAtomic(filePath: string, content: string) {
  const tmpPath = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(tmpPath, content, 'utf8')
  fs.renameSync(tmpPath, filePath)
}

// Pointe la synchro sur ce fichier et écrase directement son contenu avec la base locale, sans
// jamais lire ce qu'il contenait avant — contrairement à runSync(), qui fusionne toujours. C'est le
// seul moyen de vraiment "repartir à zéro" sur un nom de fichier déjà existant (ex : reprendre un
// fichier de synchro obsolète) : le premier clic sur l'icône de synchro fusionnerait sinon son
// ancien contenu dans la base locale au lieu de le remplacer.
export function createNewSyncFile(filePath: string): void {
  setSyncFilePath(filePath)
  writeSyncFileAtomic(filePath, exportSyncData())
}

export type SyncResult =
  | { status: 'not-configured' }
  | { status: 'exported' }
  | { status: 'imported'; imported: number; skipped: number; errors: string[] }
  | { status: 'error'; message: string }

// Comparer les dates de modification pour décider "qui est le plus récent" est peu fiable : la base
// locale est retouchée à chaque démarrage de l'appli (migrations SQLite), même sans nouvelle donnée
// réelle — une base fraîchement installée sur une nouvelle machine paraîtrait donc "plus récente" que
// le fichier partagé et l'écraserait, alors qu'elle est en réalité vide. On fusionne donc toujours
// (import si le fichier existe, puis republication) plutôt que de choisir un sens : la fusion par clé
// naturelle est déjà non-destructrice, donc il n'y a aucun risque à toujours l'appliquer.
export async function runSync(): Promise<SyncResult> {
  const syncPath = getSyncFilePath()
  if (!syncPath) return { status: 'not-configured' }

  try {
    if (!fs.existsSync(syncPath)) {
      writeSyncFileAtomic(syncPath, exportSyncData())
      return { status: 'exported' }
    }

    const content = fs.readFileSync(syncPath, 'utf8')
    const result = importSyncDataMerge(content)
    // Republie immédiatement pour que les autres machines voient aussi les éventuelles données
    // qu'on vient d'apporter (le fichier reflète alors l'union des deux, jamais un simple écrasement)
    writeSyncFileAtomic(syncPath, exportSyncData())
    return { status: 'imported', ...result }
  } catch (error: any) {
    return { status: 'error', message: error?.message ?? String(error) }
  }
}
