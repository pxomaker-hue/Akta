import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'

type CloseAction = 'quit' | 'minimize' | 'cancel'

// Le process principal envoie 'request-close-confirmation' au clic sur le bouton de fermeture,
// sauf si l'utilisateur a déjà mémorisé un choix (Paramètres → Fermeture), auquel cas il agit
// directement sans jamais solliciter ce composant.
function AppCloseDialog() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [remember, setRemember] = useState(false)

  useEffect(() => {
    const handler = () => {
      setRemember(false)
      setVisible(true)
    }
    window.electron.ipc.on('request-close-confirmation', handler)
    return () => window.electron.ipc.off('request-close-confirmation', handler)
  }, [])

  const respond = (action: CloseAction) => {
    window.electron.ipc.invoke('close-confirmation-response', action, remember).catch(() => {})
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') respond('cancel')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, remember])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={() => respond('cancel')}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-sm p-5 animate-fade-in-scale"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{t('appCloseDialog.title', 'Fermer Akta')}</p>
        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mb-4">
          {t('appCloseDialog.description', "Tu peux quitter complètement l'application ou la garder active en arrière-plan (icône dans la zone de notification).")}
        </p>

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-600 dark:text-slate-400">{t('appCloseDialog.remember', 'Se souvenir de mon choix (modifiable dans Paramètres)')}</span>
        </label>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => respond('minimize')}
            className="w-full px-4 py-2 text-sm rounded-lg accent-gradient-bg text-white font-medium hover:brightness-110 transition-all"
          >
            {t('appCloseDialog.minimize', 'Réduire en arrière-plan')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => respond('cancel')}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              onClick={() => respond('quit')}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            >
              {t('appCloseDialog.quit', 'Quitter')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppCloseDialog
