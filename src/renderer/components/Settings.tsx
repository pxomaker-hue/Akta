import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import type { useAccentColor } from '../hooks/useAccentColor'
import BackupRestore from './BackupRestore'
import { Icon, SlidingTabs, Dropdown, confirmDialog } from './UI'
import SyncSettings from './SyncSettings'
import UpdateSettings from './UpdateSettings'
import InactivityExclusionsManager from './InactivityExclusionsManager'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface SettingsState {
  theme: string
  language: string
  idle_timeout: string
  notifications_deep_work: string
  notifications_distraction: string
  focus_coaching_mode: string
  close_action?: string
}

interface SettingsProps {
  accentColor: ReturnType<typeof useAccentColor>
  onReplayOnboarding?: () => void
}

function Settings({ accentColor, onReplayOnboarding }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'settings' | 'inactivity' | 'backup'>('settings')
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deleteAllResult, setDeleteAllResult] = useState<number | null>(null)
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [isUpdatingLaunchAtStartup, setIsUpdatingLaunchAtStartup] = useState(false)
  const { t } = useTranslation()
  const { accentId, setAccent, presets } = accentColor

  useEffect(() => {
    loadSettings()
    loadLaunchAtStartup()
  }, [])

  async function loadLaunchAtStartup() {
    try {
      const enabled = await window.electron.ipc.invoke('get-launch-at-startup')
      setLaunchAtStartup(!!enabled)
    } catch (error) {
      console.error('Error loading launch-at-startup setting:', error)
    }
  }

  async function toggleLaunchAtStartup() {
    const next = !launchAtStartup
    setIsUpdatingLaunchAtStartup(true)
    try {
      await window.electron.ipc.invoke('set-launch-at-startup', next)
      setLaunchAtStartup(next)
    } catch (error) {
      console.error('Error updating launch-at-startup setting:', error)
    } finally {
      setIsUpdatingLaunchAtStartup(false)
    }
  }

  async function loadSettings() {
    try {
      const data = await window.electron.ipc.invoke('get-all-settings')
      setSettings(data as SettingsState)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateSetting(key: string, value: string) {
    try {
      await window.electron.ipc.invoke('set-setting', key, value)
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null))
    } catch (error) {
      console.error('Error updating setting:', error)
    }
  }

  async function handleDeleteAllActivities() {
    if (!(await confirmDialog(t('settings.confirmDeleteAll', 'Supprimer TOUTES les activités enregistrées depuis le début ? Cette action est irréversible.'), { danger: true }))) return
    if (
      !(await confirmDialog(t('settings.confirmDeleteAllFinal', "Dernière confirmation : toutes tes données d'activité seront définitivement perdues. Continuer ?"), {
        danger: true,
        confirmLabel: t('settings.confirmDeleteAllLabel', 'Oui, tout supprimer'),
      }))
    )
      return

    setIsDeletingAll(true)
    setDeleteAllResult(null)
    try {
      const deleted = await window.electron.ipc.invoke('delete-all-activities')
      setDeleteAllResult(deleted)
    } catch (error) {
      console.error('Error deleting all activities:', error)
    } finally {
      setIsDeletingAll(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <SlidingTabs
          tabs={[
            { id: 'settings' as const, label: t('tabs.settings'), icon: <Icon name="settings" size={16} /> },
            { id: 'inactivity' as const, label: t('settings.inactivityTab', 'Inactivité'), icon: <Icon name="clock" size={16} /> },
            { id: 'backup' as const, label: t('settings.backupTab', 'Sauvegarde'), icon: <Icon name="save" size={16} /> },
          ]}
          activeId={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'settings' && (
        <>
          {/* Affichage */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-4">{t('settings.display')}</h3>

        <div className="space-y-4">
          {/* Thème */}
          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.theme')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.light')} / {t('settings.dark')}</p>
            </div>
            <Dropdown
              value={settings.theme}
              onChange={(v) => updateSetting('theme', v)}
              className="w-40"
              options={[
                { value: 'light', label: t('settings.light') },
                { value: 'dark', label: t('settings.dark') },
                { value: 'auto', label: t('settings.auto') },
              ]}
            />
          </div>

          {/* Langue */}
          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.language')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.french')} / {t('settings.english')} / {t('settings.german')}</p>
            </div>
            <Dropdown
              value={settings.language}
              onChange={(v) => updateSetting('language', v)}
              className="w-40"
              options={[
                { value: 'fr', label: t('settings.french') },
                { value: 'en', label: t('settings.english') },
                { value: 'de', label: t('settings.german') },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Couleur d'accent */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Icon name="palette" size={18} className="accent-text" />
          {t('settings.accentColor', "Couleur d'accent")}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('settings.accentColorHint', "Personnalise la teinte principale utilisée dans toute l'application.")}</p>
        <div className="flex gap-3 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setAccent(preset.id)}
              title={preset.name}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                accentId === preset.id ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
            />
          ))}
        </div>
      </div>

      {/* Raccourcis clavier globaux */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-1">{t('settings.globalShortcuts', 'Raccourcis clavier globaux')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t('settings.globalShortcutsHint', "Fonctionnent même si Akta n'est pas au premier plan (réduit dans le tray).")}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <span className="text-gray-700 dark:text-slate-300">{t('settings.shortcutStartPauseResume', 'Démarrer / Mettre en pause / Reprendre')}</span>
            <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">Alt+Shift+S</kbd>
          </div>
          <div className="flex items-center justify-between text-sm p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
            <span className="text-gray-700 dark:text-slate-300">{t('settings.shortcutStop', 'Arrêter la session')}</span>
            <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">Alt+Shift+X</kbd>
          </div>
        </div>
      </div>

      {/* Démarrage */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-4">{t('settings.startup', 'Démarrage')}</h3>
        <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={launchAtStartup}
            onChange={toggleLaunchAtStartup}
            disabled={isUpdatingLaunchAtStartup}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{t('settings.launchAtStartup', 'Lancer Akta au démarrage de Windows')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.launchAtStartupHint', "L'application démarre automatiquement (réduite dans le tray) à l'ouverture de session.")}</p>
          </div>
        </label>

        {onReplayOnboarding && (
          <button
            onClick={onReplayOnboarding}
            className="mt-2 w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left"
          >
            <Icon name="refresh" size={16} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.replayOnboarding', "Revoir l'introduction")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.replayOnboardingHint', 'Reparcourt la présentation des fonctionnalités affichée au premier lancement.')}</p>
            </div>
          </button>
        )}
      </div>

      {/* Fermeture */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-4">{t('settings.closeSection', "Fermeture de l'application")}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 -mt-2">
          {t('settings.closeSectionHint', 'Comportement du bouton de fermeture de la fenêtre. Si tu as coché "Se souvenir de mon choix" dans la modale, change-le ici.')}
        </p>
        <div className="space-y-1">
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="radio"
              checked={!settings.close_action || settings.close_action === 'ask'}
              onChange={() => updateSetting('close_action', 'ask')}
              className="w-4 h-4 text-indigo-600"
            />
            <p className="font-medium text-gray-900 dark:text-white">{t('settings.closeAlwaysAsk', 'Toujours demander')}</p>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="radio"
              checked={settings.close_action === 'minimize'}
              onChange={() => updateSetting('close_action', 'minimize')}
              className="w-4 h-4 text-indigo-600"
            />
            <p className="font-medium text-gray-900 dark:text-white">{t('settings.closeAlwaysMinimize', 'Toujours réduire en arrière-plan')}</p>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="radio"
              checked={settings.close_action === 'quit'}
              onChange={() => updateSetting('close_action', 'quit')}
              className="w-4 h-4 text-indigo-600"
            />
            <p className="font-medium text-gray-900 dark:text-white">{t('settings.closeAlwaysQuit', 'Toujours quitter')}</p>
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-4">{t('settings.notifications')}</h3>

        <div className="space-y-3">
          {/* Deep Work */}
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications_deep_work === 'true'}
              onChange={(e) => updateSetting('notifications_deep_work', e.target.checked.toString())}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.deepwork')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.deepwork.desc')}</p>
            </div>
          </label>

          {/* Distraction */}
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications_distraction === 'true'}
              onChange={(e) => updateSetting('notifications_distraction', e.target.checked.toString())}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.distraction')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.distraction.desc')}</p>
            </div>
          </label>
        </div>
      </div>

      {/* Focus Coaching Mode */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold accent-gradient-text mb-4">🧠 {t('focusCoaching.title', 'Focus Coaching')}</h3>

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="radio"
              checked={settings.focus_coaching_mode === 'tdah'}
              onChange={() => updateSetting('focus_coaching_mode', 'tdah')}
              className="w-4 h-4 text-indigo-600"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.tdahMode', 'Mode TDAH')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.tdahModeDesc', 'Micro-cycles de 15-20 min, streaks, gamification, notifications encourageantes')}</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <input
              type="radio"
              checked={settings.focus_coaching_mode === 'standard'}
              onChange={() => updateSetting('focus_coaching_mode', 'standard')}
              className="w-4 h-4 text-indigo-600"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{t('settings.standardMode', 'Mode Standard')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.standardModeDesc', 'Pomodoro classique (25/45 min), recommandations simples et discrètes')}</p>
            </div>
          </label>
        </div>
      </div>

      <SyncSettings />

      {/* Zone de danger */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 border border-red-200 dark:border-red-900/40">
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
          <Icon name="alert" size={18} />
          {t('settings.dangerZone', 'Zone de danger')}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t('settings.dangerZoneHint', 'Supprime définitivement toutes les activités enregistrées, depuis le tout début du suivi. Les catégories, tags et paramètres sont conservés.')}
        </p>
        <button
          onClick={handleDeleteAllActivities}
          disabled={isDeletingAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          <Icon name="trash" size={16} />
          {isDeletingAll ? t('settings.deletingInProgress', 'Suppression en cours...') : t('settings.deleteAllActivities', 'Effacer toutes les activités')}
        </button>

        {deleteAllResult !== null && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Icon name="check" size={14} />
            {tf(
              deleteAllResult === 1
                ? t('settings.deletedResultSingular', '{{n}} activité supprimée.')
                : t('settings.deletedResultPlural', '{{n}} activités supprimées.'),
              { n: deleteAllResult }
            )}
          </p>
        )}
      </div>

      <UpdateSettings />

      {/* À propos */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>{t('settings.version')}</strong> • {t('settings.description')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          {t('settings.autosave')}
        </p>
      </div>
        </>
      )}

      {tab === 'inactivity' && (
        <div className="space-y-6">
          {/* Détection d'inactivité */}
          <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold accent-gradient-text mb-4">{t('settings.tracking')}</h3>

            <div className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('settings.idle')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.idle.desc')}</p>
                </div>
                <span className="text-sm font-bold accent-text">{settings.idle_timeout}s</span>
              </div>
              <input
                type="range"
                min="60"
                max="600"
                step="30"
                value={settings.idle_timeout}
                onChange={(e) => updateSetting('idle_timeout', e.target.value)}
                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>{tf(t('settings.minutesShort', '{{n}} min'), { n: 1 })}</span>
                <span>{tf(t('settings.minutesShort', '{{n}} min'), { n: 10 })}</span>
              </div>
            </div>
          </div>

          {/* Exclusions d'inactivité */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6 border border-gray-200 dark:border-slate-700">
            <InactivityExclusionsManager />
          </div>
        </div>
      )}

      {tab === 'backup' && <BackupRestore />}
    </div>
  )
}

export default Settings
