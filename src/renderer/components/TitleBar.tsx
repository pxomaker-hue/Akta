import { useEffect, useState } from 'react'
import { Icon } from './UI'
import Logo from './Logo'
import { useTranslation } from '../hooks/useTranslation'

// Barre de titre custom : la fenêtre principale est créée sans cadre natif (frame: false) pour
// remplacer la barre Windows par quelque chose qui reprend le design de l'app plutôt qu'un
// bandeau système générique. La zone de drag (-webkit-app-region) est ce qui permet de déplacer
// la fenêtre sans bordure native — les boutons doivent explicitement s'en exclure (no-drag).
function TitleBar() {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electron.ipc.invoke('window-is-maximized').then(setIsMaximized).catch(() => {})
    const handler = (maximized: boolean) => setIsMaximized(maximized)
    window.electron.ipc.on('window-maximized-changed', handler)
    return () => window.electron.ipc.off('window-maximized-changed', handler)
  }, [])

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  const minimize = () => window.electron.ipc.invoke('window-minimize').catch(() => {})
  const toggleMaximize = () => window.electron.ipc.invoke('window-maximize-toggle').catch(() => {})
  const close = () => window.electron.ipc.invoke('window-close').catch(() => {})

  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center h-9 bg-white dark:bg-slate-900 select-none flex-shrink-0"
      style={dragStyle}
      onDoubleClick={toggleMaximize}
    >
      <div />

      {/* Colonnes latérales égales (1fr) : le logo+nom reste toujours vraiment centré dans la
          fenêtre, quelle que soit la largeur du bloc de boutons à droite. */}
      <div className="flex items-center gap-1.5 px-3 pointer-events-none">
        <Logo size={16} />
        <span className="text-xs font-bold accent-gradient-text tracking-wide">Akta</span>
      </div>

      <div className="flex items-center justify-self-end" style={noDragStyle}>
        <button
          onClick={minimize}
          title={t('titleBar.minimize', 'Réduire')}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name="minimize" size={12} />
        </button>
        <button
          onClick={toggleMaximize}
          title={isMaximized ? t('titleBar.restore', 'Restaurer') : t('titleBar.maximize', 'Agrandir')}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Icon name={isMaximized ? 'restore' : 'maximize'} size={11} />
        </button>
        <button
          onClick={close}
          title={t('common.close', 'Fermer')}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-slate-400 hover:bg-red-500 hover:text-white transition-colors"
        >
          <Icon name="x" size={13} />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
