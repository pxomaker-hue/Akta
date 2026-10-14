import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader, SlidingTabs } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface Challenge {
  id: number
  name: string
  type: string
  target_value: number
  duration: string
}

interface ChallengeWithProgress {
  challenge: Challenge
  progress: {
    challenge_id: number
    current: number
    target: number
    percentage: number
    completed: boolean
    days_remaining?: number
  } | null
}

interface Milestone {
  id: number
  name: string
  type: string
  threshold: number
  unlocked_at?: number
  progress: number
}

function FocusChallenges() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'challenges' | 'milestones'>('challenges')
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChallengeData()
    const interval = setInterval(loadChallengeData, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadChallengeData() {
    try {
      const [challengesData, milestonesData, streakData] = await Promise.all([
        window.electron.ipc.invoke('get-active-challenges'),
        window.electron.ipc.invoke('get-milestones'),
        window.electron.ipc.invoke('get-streak'),
      ])
      setChallenges(challengesData)
      setMilestones(milestonesData)
      setStreak(streakData)
    } catch (error) {
      console.error('Error loading challenge data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader title={t('focusChallenges.title', '🏆 Défis Focus')} icon={<Icon name="award" size={18} />} />

      {/* Streak Header */}
      <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">{t('focusChallenges.currentStreak', '🔥 Streak Actuelle')}</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{tf(t('focusChallenges.streakDays', '{{n}} jours'), { n: streak })}</p>
          </div>
          <div className="text-right text-xs text-orange-600 dark:text-orange-400">
            <p>{t('focusChallenges.keepGoing', 'Garde la série ! 💪')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-4">
        <SlidingTabs
          tabs={[
            { id: 'challenges' as const, label: t('focusChallenges.activeTab', 'Défis Actifs'), icon: <Icon name="target" size={14} /> },
            { id: 'milestones' as const, label: t('focusChallenges.milestonesTab', 'Jalons'), icon: <Icon name="star" size={14} /> },
          ]}
          activeId={tab as 'challenges' | 'milestones'}
          onChange={(id) => setTab(id as 'challenges' | 'milestones')}
        />
      </div>

      {/* Challenges Tab */}
      {tab === 'challenges' && (
        <div className="space-y-3">
          {challenges.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">{t('focusChallenges.noActiveChallenge', 'Aucun défi actif')}</p>
          ) : (
            challenges.map((item) => (
              <div key={item.challenge.id} className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{item.challenge.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{item.challenge.description}</p>
                  </div>
                  {item.progress?.completed && <span className="text-lg">✅</span>}
                </div>

                {item.progress && (
                  <>
                    <div className="flex items-center justify-between mb-2 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.progress.current} / {item.progress.target}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {Math.round(item.progress.percentage)}%
                        {item.progress.days_remaining !== undefined && item.progress.days_remaining !== null && (
                          <> • {tf(t('focusChallenges.daysRemaining', '{{n}}j restants'), { n: item.progress.days_remaining })}</>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          item.progress.completed
                            ? 'bg-emerald-500'
                            : item.progress.percentage > 75
                              ? 'bg-blue-500'
                              : item.progress.percentage > 50
                                ? 'bg-amber-500'
                                : 'bg-indigo-500'
                        }`}
                        style={{ width: `${item.progress.percentage}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {tab === 'milestones' && (
        <div className="space-y-2">
          {milestones.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">{t('focusChallenges.noMilestone', 'Aucun jalon')}</p>
          ) : (
            milestones.map((milestone) => {
              const progressPercent = Math.min((milestone.progress / milestone.threshold) * 100, 100)
              const typeLabel = milestone.type === 'time' ? t('focusChallenges.hoursType', 'Heures de focus') : t('focusChallenges.sessionsType', 'Sessions complétées')

              return (
                <div
                  key={milestone.id}
                  className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group relative"
                >
                  {/* Custom Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-3 min-w-max border border-gray-200 dark:border-slate-700">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                        {milestone.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {typeLabel}
                      </p>
                      <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                        <div className="flex justify-between gap-3">
                          <span>{t('focusChallenges.progress', 'Progrès:')}</span>
                          <span className="font-medium">{milestone.progress} / {milestone.threshold}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>{t('focusChallenges.completeness', 'Complétude:')}</span>
                          <span className="font-medium">{Math.round(progressPercent)}%</span>
                        </div>
                        {milestone.unlocked_at && (
                          <div className="flex justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t border-gray-200 dark:border-slate-700 mt-1">
                            <span>{t('focusChallenges.unlocked', '✓ Débloqué!')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between cursor-help">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-lg">{milestone.unlocked_at ? '🏆' : '🔒'}</span>
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${milestone.unlocked_at ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                          {milestone.name}
                        </p>
                        <div className="w-32 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              milestone.unlocked_at ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {milestone.progress} / {milestone.threshold}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </Card>
  )
}

export default FocusChallenges
