import { useEffect, useState } from 'react'
import { Icon } from './UI'

type SyncResult =
  | { status: 'not-configured' }
  | { status: 'exported' }
  | { status: 'imported'; imported: number; skipped: number; errors: string[] }
  | { status: 'error'; message: string }

function SyncButton() {
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  useEffect(() => {
    window.electron.ipc
      .invoke('get-sync-file-path')
      .then((path) => setConfigured(!!path))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!result) return
    const timeout = setTimeout(() => setResult(null), 5000)
    return () => clearTimeout(timeout)
  }, [result])

  const handleSync = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res: SyncResult = await window.electron.ipc.invoke('run-sync')
      setResult(res)
      setConfigured(res.status !== 'not-configured')
    } catch (error: any) {
      setResult({ status: 'error', message: error?.message ?? String(error) })
    } finally {
      setBusy(false)
    }
  }

  const resultText = (() => {
    if (!result) return null
    switch (result.status) {
      case 'not-configured':
        return "Aucun fichier de synchronisation configuré — vas dans Paramètres pour en choisir un."
      case 'exported':
        return 'Données envoyées vers le fichier de synchronisation.'
      case 'imported':
        return `${result.imported} élément${result.imported !== 1 ? 's' : ''} récupéré${result.imported !== 1 ? 's' : ''} depuis le fichier de synchronisation.`
      case 'error':
        return `Erreur de synchronisation : ${result.message}`
    }
  })()

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={handleSync}
        disabled={busy}
        title={configured ? 'Synchroniser avec le fichier partagé' : 'Synchronisation non configurée (Paramètres)'}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          configured
            ? 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300'
            : 'bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
        }`}
      >
        <Icon name="refresh" size={16} className={busy ? 'animate-spin' : ''} />
      </button>

      {result && resultText && (
        <div
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-[60] w-64 text-xs rounded-xl shadow-xl border p-3 animate-fade-in-scale ${
            result.status === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200'
          }`}
        >
          {resultText}
        </div>
      )}
    </div>
  )
}

export default SyncButton
