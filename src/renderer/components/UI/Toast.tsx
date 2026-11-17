import { useEffect, useState } from 'react'
import Icon from './Icon'
import { useTranslation } from '../../hooks/useTranslation'

type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

let pushToast: ((item: Omit<ToastItem, 'id'>) => void) | null = null
let nextId = 1

// Petit retour visuel non bloquant après une action (export réussi, suppression impossible…).
// Avant, la plupart des échecs ne laissaient qu'une trace dans la console, invisible pour l'utilisateur.
export const toast = {
  success(message: string) {
    pushToast?.({ kind: 'success', message })
  },
  error(message: string) {
    pushToast?.({ kind: 'error', message })
  },
}

const DURATION_MS: Record<ToastKind, number> = { success: 3000, error: 6000 }

export function ToastHost() {
  const { t } = useTranslation()
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    pushToast = (item) => {
      const id = nextId++
      setItems((prev) => [...prev.slice(-2), { ...item, id }])
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), DURATION_MS[item.kind])
    }
    return () => {
      pushToast = null
    }
  }, [])

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id))

  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none" aria-live="polite" role="status">
      {items.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-start gap-3 p-3 rounded-xl shadow-lg border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 animate-fade-in-scale"
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.kind === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}
            aria-hidden="true"
          >
            <Icon name={item.kind === 'success' ? 'check' : 'alert'} size={14} />
          </span>
          <p className="flex-1 min-w-0 text-sm text-gray-700 dark:text-slate-200 pt-1 leading-snug">{item.message}</p>
          <button
            onClick={() => dismiss(item.id)}
            aria-label={t('common.close', 'Fermer')}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
