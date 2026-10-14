import { useEffect, useState } from 'react'
import Icon from './Icon'
import { useTranslation } from '../../hooks/useTranslation'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  message: string
  resolve: (value: boolean) => void
}

let currentSetter: ((state: PendingConfirm | null) => void) | null = null

// Remplace window.confirm() par une modale au style de l'appli. Retourne une Promise<boolean>
// comme le confirm() natif, pour rester un remplacement direct dans les call sites existants.
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!currentSetter) {
      // Le host n'est pas monté (ne devrait pas arriver) : on retombe sur le natif plutôt que de bloquer
      resolve(window.confirm(message))
      return
    }
    currentSetter({ message, resolve, ...options })
  })
}

export function ConfirmDialogHost() {
  const { t } = useTranslation()
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  useEffect(() => {
    currentSetter = setPending
    return () => {
      currentSetter = null
    }
  }, [])

  useEffect(() => {
    if (!pending) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handle(false)
      if (e.key === 'Enter') handle(true)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  if (!pending) return null

  const handle = (result: boolean) => {
    pending.resolve(result)
    setPending(null)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={() => handle(false)}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm p-5 animate-fade-in-scale"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              pending.danger
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Icon name="alert" size={16} />
          </div>
          <div className="min-w-0 pt-1">
            {pending.title && <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{pending.title}</p>}
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{pending.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => handle(false)}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            {pending.cancelLabel || t('common.cancel', 'Annuler')}
          </button>
          <button
            onClick={() => handle(true)}
            className={`px-4 py-2 text-sm rounded-lg text-white font-medium transition-colors ${
              pending.danger ? 'bg-red-500 hover:bg-red-600' : 'accent-gradient-bg hover:brightness-110'
            }`}
          >
            {pending.confirmLabel || t('common.confirm', 'Confirmer')}
          </button>
        </div>
      </div>
    </div>
  )
}
