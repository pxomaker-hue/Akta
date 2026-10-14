import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Activity, Category, Client } from '../shared/types'
import ActivityList from './components/ActivityList'
import Dashboard from './components/Dashboard'
import DailyStats from './components/DailyStats'
import SessionsList from './components/SessionsList'
import FocusMode from './components/FocusMode'
import CategoryForm from './components/CategoryForm'
import CategoryList from './components/CategoryList'
import TimelineV2, { getTodayStart } from './components/TimelineV2'
import Reports from './components/Reports'
import Analytics from './components/Analytics'
import Settings from './components/Settings'
import TagManager from './components/TagManager'
import ProjectManager from './components/ProjectManager'
import ClientManager from './components/ClientManager'
import BudgetPredictions from './components/BudgetPredictions'
import LiveSession from './components/LiveSession'
import LiveSessionMascot from './components/LiveSessionMascot'
import SyncButton from './components/SyncButton'
import Onboarding from './components/Onboarding'
import TitleBar from './components/TitleBar'
import AppCloseDialog from './components/AppCloseDialog'
import { LiveSessionProvider } from './contexts/LiveSessionContext'
import Logo from './components/Logo'
import { SlidingTabs, Card, Icon, ConfirmDialogHost } from './components/UI'
import { useTheme } from './hooks/useTheme'
import { useTranslation } from './hooks/useTranslation'
import { useAccentColor } from './hooks/useAccentColor'

declare global {
  interface Window {
    electron: {
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, listener: (...args: any[]) => void) => void
        once: (channel: string, listener: (...args: any[]) => void) => void
        off: (channel: string, listener: (...args: any[]) => void) => void
      }
    }
  }
}

type Tab = 'dashboard' | 'activities' | 'focus' | 'reports' | 'categories' | 'projects' | 'settings'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

function App() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  // Jour affiché dans la Timeline de l'onglet "Activités" (indépendant de celle du Dashboard)
  const [activitiesTabDayStart, setActivitiesTabDayStart] = useState(() => getTodayStart())
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isFocusActive, setIsFocusActive] = useState(false)
  // En dessous de 1090px, la barre d'onglets manque de place : le pack pill de suivi + raccourci
  // Mode Focus se déplace dans l'en-tête (à gauche de la mascotte) plutôt que de s'écraser contre
  // le bouton de synchro.
  const [isNarrowNav, setIsNarrowNav] = useState(() => window.innerWidth < 1090)
  const { theme, setTheme } = useTheme() // Initialize theme on app load
  const { t } = useTranslation() // Initialize translations
  const accentColor = useAccentColor() // Applique la couleur d'accent dès le démarrage (pas seulement dans Paramètres)

  useEffect(() => {
    loadData(true)

    // Reload activities every 5 seconds
    const interval = setInterval(() => loadData(false), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleResize = () => setIsNarrowNav(window.innerWidth < 1090)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Centralisé ici (pas dans Dashboard) : sert à la fois au bouton raccourci de l'en-tête et au
  // bouton du tableau de bord, sans dupliquer le polling.
  useEffect(() => {
    const fetchFocusStatus = async () => {
      try {
        const session = await window.electron.ipc.invoke('get-current-focus-session')
        setIsFocusActive(!!session)
      } catch (error) {
        console.error('Error fetching focus status:', error)
      }
    }
    fetchFocusStatus()
    const interval = setInterval(fetchFocusStatus, 3000)
    // Le process principal clôture lui-même une session arrivée à échéance (même si l'onglet Mode
    // Focus n'est pas ouvert) — on écoute cet événement pour éteindre l'icône tout de suite plutôt
    // que d'attendre jusqu'à 3s le prochain sondage.
    const handleCompleted = () => fetchFocusStatus()
    window.electron.ipc.on('focus-session-completed', handleCompleted)
    return () => {
      clearInterval(interval)
      window.electron.ipc.off('focus-session-completed', handleCompleted)
    }
  }, [])

  useEffect(() => {
    window.electron.ipc
      .invoke('get-setting', 'onboarding_completed')
      .then((value) => setShowOnboarding(value !== 'true'))
      .catch((error) => console.error('Error loading onboarding setting:', error))
  }, [])

  async function completeOnboarding() {
    setShowOnboarding(false)
    try {
      await window.electron.ipc.invoke('set-setting', 'onboarding_completed', 'true')
    } catch (error) {
      console.error('Error saving onboarding completion:', error)
    }
  }

  // showLoading=false pour les rafraîchissements silencieux en arrière-plan (poll périodique,
  // mise à jour après une action) : sinon le spinner remplace momentanément la liste à chaque fois,
  // ce qui fait s'effondrer la page et remonte le scroll en haut (très gênant avec une longue liste).
  async function loadData(showLoading: boolean) {
    try {
      if (showLoading) setLoading(true)

      const [activitiesData, categoriesData] = await Promise.all([
        // Fenêtre large (pas juste "aujourd'hui") pour que les données importées/synchronisées
        // depuis d'autres jours restent visibles rétroactivement dans la Timeline et le Dashboard,
        // qui filtrent ensuite eux-mêmes par jour sélectionné.
        window.electron.ipc.invoke('get-activities', 30),
        window.electron.ipc.invoke('get-categories'),
      ])

      setActivities(activitiesData)
      setCategories(categoriesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // DailyStats suppose une fenêtre "aujourd'hui" (son texte l'affirme explicitement) — on la fait
  // suivre le jour sélectionné dans la Timeline de cet onglet plutôt que la fenêtre large de 30 jours.
  const activitiesTabDayActivities = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000
    return activities.filter((a) => a.start_time >= activitiesTabDayStart && a.start_time < activitiesTabDayStart + DAY_MS)
  }, [activities, activitiesTabDayStart])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: t('tabs.dashboard') },
    { id: 'activities', label: t('tabs.activities') },
    { id: 'projects', label: t('tabs.projects', 'Projets') },
    { id: 'reports', label: t('tabs.reports', 'Stats') },
    { id: 'categories', label: t('tabs.categories', 'Catégories & Tags') },
    { id: 'settings', label: t('tabs.settings') },
  ]

  const focusButtonJsx = isFocusActive ? (
    <button
      onClick={() => setActiveTab('focus')}
      title={t('app.focusSessionActive', 'Session Mode Focus en cours — cliquer pour y accéder')}
      className="relative w-10 h-10 flex items-center justify-center flex-shrink-0"
    >
      <span className="absolute inset-0 rounded-full accent-gradient-bg animate-focus-glow-ring" aria-hidden="true" />
      <span className="relative w-10 h-10 rounded-full accent-gradient-bg flex items-center justify-center text-white shadow-md hover:brightness-110 transition-all animate-focus-heartbeat">
        <Icon name="target" size={16} />
      </span>
    </button>
  ) : null

  return (
    <LiveSessionProvider>
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-950">
      <TitleBar />
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Logo size={58} />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight accent-gradient-text leading-tight">
                {t('app.title')}
              </h1>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                {t('app.subtitle')}
              </p>
            </div>
          </div>
          {/* En dessous de 1090px, seule la pill de suivi rejoint la mascotte ici (centrée
              verticalement avec elle grâce à items-center du parent, collée avec juste un peu
              d'espace) — le bouton Mode Focus, lui, reste toujours ancré à côté du bouton de
              synchro dans la barre d'onglets. En mode large, la mascotte retrouve sa position
              d'origine : centrée dans une boîte w-80, alignée sur le même axe horizontal que la
              pill (elle aussi w-80, juste en dessous) — c'est ce même w-80 qui évite tout saut de
              mise en page si la mascotte apparaît/disparaît. En mode resserré, cette réservation
              est retirée pour que le petit espace gap-2 s'applique bien contre le visuel réel de
              la mascotte, et non contre une boîte invisible bien plus large. */}
          <div className="flex items-center gap-2">
            {isNarrowNav && <LiveSession />}
            <div className={isNarrowNav ? 'flex-shrink-0' : 'w-80 flex justify-center flex-shrink-0'}>
              <LiveSessionMascot />
            </div>
          </div>
        </div>
      </header>

      {/* Tabs (navbar) — reste fixe hors du flux de scroll, comme le header et la barre de titre :
          seul le contenu de <main> ci-dessous défile, avec sa propre scrollbar qui démarre donc
          juste en dessous plutôt que de couvrir toute la hauteur de la fenêtre. */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* gap-4 sur tout le conteneur (et non plus justify-between entre deux groupes) : ça
              garantit un espacement minimum constant entre chaque élément, y compris entre le
              bouton de synchro et le bouton Focus qui le suit directement — sinon justify-between
              pouvait les coller l'un à l'autre à mesure que la fenêtre rétrécit. */}
          <nav className="flex items-center gap-4" aria-label={t('app.tabsAriaLabel', 'Onglets')}>
            <SlidingTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

            {/* Theme Toggle Icon */}
            <button
              onClick={() => {
                const themes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto']
                const currentIndex = themes.indexOf(theme)
                const nextIndex = (currentIndex + 1) % themes.length
                setTheme(themes[nextIndex])
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full text-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
              title={tf(t('app.themeTooltip', 'Thème : {{theme}}'), {
                theme:
                  theme === 'light'
                    ? t('app.themeLight', 'clair')
                    : theme === 'dark'
                      ? t('app.themeDark', 'sombre')
                      : t('app.themeAuto', 'auto'),
              })}
            >
              {theme === 'light' && '☀️'}
              {theme === 'dark' && '🌙'}
              {theme === 'auto' && '🔄'}
            </button>

            <SyncButton />

            {/* Toujours ici, jamais dans l'en-tête : seule la pill se déplace en dessous de 1090px */}
            {focusButtonJsx}

            {!isNarrowNav && (
              <div className="ml-auto">
                <LiveSession />
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Content — seule cette zone défile, avec sa propre scrollbar (voir index.css pour son style) */}
      <div className="flex-1 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'activities' && (
          <div className="space-y-6">
            <TimelineV2
              activities={activities}
              categories={categories}
              onUpdate={() => loadData(false)}
              dayStart={activitiesTabDayStart}
              onDayChange={setActivitiesTabDayStart}
            />
            <SessionsList />
            <DailyStats activities={activitiesTabDayActivities} categories={categories} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityList activities={activities} categories={categories} loading={loading} onActivityUpdate={() => loadData(false)} />
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('app.activitiesSummary', 'Résumé de vos activités')}</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('activities.summary.total')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{activities.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('activities.summary.categories')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{categories.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('app.professional', 'Professionnel')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{activities.filter((a) => a.billable).length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('app.personal', 'Personnel')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{activities.filter((a) => !a.billable).length}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {activities.length > 0 && (
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: t('app.professional', 'Professionnel'), value: activities.filter((a) => a.billable).length },
                              { name: t('app.personal', 'Personnel'), value: activities.filter((a) => !a.billable).length }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell fill="#3b82f6" />
                            <Cell fill="#8b5cf6" />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                            formatter={(value: number, name: string, props: any) => [
                              <span key="value" style={{ color: '#000', fontWeight: '500' }}>{tf(t('app.activitiesCount', '{{count}} activités'), { count: value })}</span>,
                              <span key="name" style={{ color: '#666' }}>{props.payload.name}</span>
                            ]}
                            labelStyle={{ color: '#000' }}
                            wrapperStyle={{ color: '#000' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            activities={activities}
            categories={categories}
            onUpdate={() => loadData(false)}
            onOpenFocusMode={() => setActiveTab('focus')}
            isFocusActive={isFocusActive}
          />
        )}

        {activeTab === 'focus' && <FocusMode onBack={() => setActiveTab('dashboard')} />}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <Card gradient>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2.5">
                  <Icon name="layers" size={22} className="accent-text flex-shrink-0" />
                  <span className="accent-gradient-text">{t('app.reportsTitle', 'Rapports & Analyses')}</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {t('app.reportsDescription', "Ta semaine en un coup d'œil, puis une analyse plus approfondie de tes habitudes.")}
                </p>
              </div>
            </Card>

            <Reports categories={categories} />
            <Analytics />
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6 max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Form */}
              <div className="lg:col-span-1">
                <CategoryForm onCategoryCreated={() => loadData(false)} />
              </div>

              {/* Category List */}
              <div className="lg:col-span-1">
                <CategoryList categories={categories} onUpdate={() => loadData(false)} />
              </div>

              {/* Tag Manager */}
              <div className="lg:col-span-1">
                <TagManager />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6 max-w-5xl">
            <Card gradient>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2.5">
                  <Icon name="briefcase" size={22} className="accent-text flex-shrink-0" />
                  <span className="accent-gradient-text">{t('app.projectManagementTitle', 'Gestion de projet')}</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {t('app.projectManagementDescription', 'Organise tes sessions actives par client et par projet, avec un taux horaire pour préparer ta facturation.')}
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ClientManager onClientsLoaded={setClients} />
              <ProjectManager clients={clients} />
            </div>

            <div className="mt-6">
              <BudgetPredictions />
            </div>
          </div>
        )}

        {activeTab === 'settings' && <Settings accentColor={accentColor} onReplayOnboarding={() => setShowOnboarding(true)} />}
      </main>
      </div>

      <ConfirmDialogHost />
      <AppCloseDialog />
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
    </div>
    </LiveSessionProvider>
  )
}

export default App
