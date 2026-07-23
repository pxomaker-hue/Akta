import { useEffect, useState } from 'react'
import { Icon, confirmDialog } from './UI'

function SyncSettings() {
  const [syncPath, setSyncPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pickInfo, setPickInfo] = useState<{ mode: 'existing' | 'new'; alreadyExists: boolean; existingDate: string | null } | null>(null)

  const loadPath = async () => {
    try {
      const path = await window.electron.ipc.invoke('get-sync-file-path')
      setSyncPath(path || null)
    } catch (error) {
      console.error('Error loading sync file path:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPath()
  }, [])

  // "Se connecter à un fichier existant" : ne fusionne jamais rien tout de suite, c'est sans risque.
  const handlePickExisting = async () => {
    setBusy(true)
    setPickInfo(null)
    try {
      const picked = await window.electron.ipc.invoke('pick-sync-file-existing')
      if (picked) {
        setSyncPath(picked.path)
        setPickInfo({ mode: 'existing', alreadyExists: picked.alreadyExists, existingDate: picked.existingDate })
      }
    } finally {
      setBusy(false)
    }
  }

  // "Créer un nouveau fichier" : si un fichier existe déjà à cet emplacement, on écrase carrément
  // son contenu avec les données de cette machine (au lieu de fusionner au premier clic de synchro,
  // ce qui ramènerait l'ancien contenu au lieu de repartir à zéro) — donc confirmation obligatoire.
  const handlePickNew = async () => {
    setBusy(true)
    setPickInfo(null)
    try {
      const picked = await window.electron.ipc.invoke('pick-sync-file-new')
      if (!picked) return

      if (picked.alreadyExists) {
        const confirmed = await confirmDialog(
          `Un fichier de synchronisation existe déjà à cet emplacement${
            picked.existingDate ? ` (créé/modifié le ${new Date(picked.existingDate).toLocaleString('fr-FR')})` : ''
          }. Continuer remplacera son contenu par les données de cette machine — ce que contenait l'ancien fichier sera perdu.`,
          { danger: true, confirmLabel: 'Écraser' }
        )
        if (!confirmed) return
      }

      await window.electron.ipc.invoke('create-new-sync-file', picked.path)
      setSyncPath(picked.path)
      setPickInfo({ mode: 'new', alreadyExists: picked.alreadyExists, existingDate: picked.existingDate })
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!(await confirmDialog('Désactiver la synchronisation ? Le fichier partagé ne sera plus mis à jour depuis cette machine.'))) return
    setBusy(true)
    try {
      await window.electron.ipc.invoke('clear-sync-file-path')
      setSyncPath(null)
      setPickInfo(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-bold accent-gradient-text mb-1 flex items-center gap-2">
        <Icon name="refresh" size={18} className="accent-text" />
        Synchronisation entre ordinateurs
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Optionnel : pointe vers un fichier sur un dossier partagé (NAS, disque réseau...) pour combiner tes données entre plusieurs machines. Chaque appli garde sa propre base en local — seul un fichier de synchro est lu/écrit, à la demande, via l'icône dans la barre de nav.
      </p>

      {pickInfo?.mode === 'existing' && pickInfo.alreadyExists && (
        <div className="flex items-start gap-2.5 mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Icon name="check" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Un fichier de synchronisation existe déjà à cet emplacement
            {pickInfo.existingDate && ` (créé/modifié le ${new Date(pickInfo.existingDate).toLocaleString('fr-FR')})`}.
            Rien n'a été écrasé — au premier clic sur l'icône de synchro, ses données seront{' '}
            <strong>fusionnées</strong> avec celles de cette machine, pas remplacées.
          </p>
        </div>
      )}

      {pickInfo?.mode === 'new' && (
        <div className="flex items-start gap-2.5 mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Icon name="check" size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Nouveau fichier de synchronisation créé avec les données de cette machine
            {pickInfo.alreadyExists ? ' — l\'ancien contenu à cet emplacement a été remplacé.' : '.'}
          </p>
        </div>
      )}

      {syncPath ? (
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-800/60">
          <div className="min-w-0 mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Fichier de synchronisation</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white truncate" title={syncPath}>{syncPath}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePickExisting}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              Se connecter à un autre fichier existant
            </button>
            <button
              onClick={handlePickNew}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              Créer un nouveau fichier
            </button>
            <button
              onClick={handleClear}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
            >
              Désactiver
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handlePick('pick-sync-file-existing')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <Icon name="folder" size={16} />
            Se connecter à un fichier déjà existant
          </button>
          <button
            onClick={() => handlePick('pick-sync-file-new')}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg accent-gradient-bg hover:brightness-110 disabled:opacity-50 text-white text-sm font-medium transition-all"
          >
            <Icon name="plus" size={16} />
            Créer un nouveau fichier de synchro
          </button>
        </div>
      )}
    </div>
  )
}

export default SyncSettings
