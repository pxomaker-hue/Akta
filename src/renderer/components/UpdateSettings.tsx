import { useEffect, useState } from 'react'
import { Icon } from './UI'

type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'not-available' }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message?: string }
  | { status: 'dev-mode' }

function UpdateSettings() {
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateStatus>({ status: 'idle' })
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.electron.ipc.invoke('get-app-version').then(setVersion).catch(() => {})

    const handler = (payload: UpdateStatus) => {
      setUpdate(payload)
      if (payload.status !== 'checking') setChecking(false)
    }
    window.electron.ipc.on('update-status', handler)
    return () => window.electron.ipc.off('update-status', handler)
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    setUpdate({ status: 'checking' })
    try {
      const result = await window.electron.ipc.invoke('check-for-updates')
      if (result.status === 'dev-mode') {
        setUpdate({ status: 'dev-mode' })
        setChecking(false)
      }
      // sinon, le statut définitif arrive via l'événement 'update-status' (checking-for-update, etc.)
    } catch {
      setUpdate({ status: 'error' })
      setChecking(false)
    }
  }

  const statusText = (() => {
    switch (update.status) {
      case 'checking':
        return 'Vérification en cours...'
      case 'available':
        return `Version ${update.version} disponible, téléchargement en cours...`
      case 'not-available':
        return 'Tu as déjà la dernière version.'
      case 'downloading':
        return `Téléchargement... ${update.percent}%`
      case 'downloaded':
        return `Version ${update.version} téléchargée — redémarre l'appli pour l'installer.`
      case 'error':
        return "Erreur lors de la vérification des mises à jour."
      case 'dev-mode':
        return 'Les mises à jour ne sont vérifiées que sur une version installée (pas en dev).'
      default:
        return null
    }
  })()

  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
      <h3 className="text-lg font-bold accent-gradient-text mb-1 flex items-center gap-2">
        <Icon name="download" size={18} className="accent-text" />
        Mises à jour
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Version installée : <span className="font-mono">{version || '…'}</span>
      </p>

      <button
        onClick={handleCheck}
        disabled={checking}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
      >
        <Icon name="refresh" size={16} className={checking ? 'animate-spin' : ''} />
        Vérifier les mises à jour
      </button>

      {statusText && <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">{statusText}</p>}
    </div>
  )
}

export default UpdateSettings
