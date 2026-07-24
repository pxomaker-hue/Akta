import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader, SlidingTabs } from './UI'

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
      <CardHeader title="🏆 Défis Focus" icon={<Icon name="award" size={18} />} />

      {/* Streak Header */}
      <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">🔥 Streak Actuelle</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{streak} jours</p>
          </div>
          <div className="text-right text-xs text-orange-600 dark:text-orange-400">
            <p>Garde la série ! 💪</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-4">
        <SlidingTabs
          tabs={[
            { id: 'challenges' as const, label: 'Défis Actifs', icon: <Icon name="target" size={14} /> },
            { id: 'milestones' as const, label: 'Jalons', icon: <Icon name="star" size={14} /> },
          ]}
          activeId={tab as 'challenges' | 'milestones'}
          onChange={(id) => setTab(id as 'challenges' | 'milestones')}
        />
      </div>

      {/* Challenges Tab */}
      {tab === 'challenges' && (
        <div className="space-y-3">
          {challenges.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">Aucun défi actif</p>
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
                        {item.progress.days_remaining && ` • ${item.progress.days_remaining}j restants`}
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
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">Aucun jalon</p>
          ) : (
            milestones.map((milestone) => {
              const progressPercent = Math.min((milestone.progress / milestone.threshold) * 100, 100)
              const tooltipText = `${milestone.name}\n${milestone.progress} / ${milestone.threshold} ${milestone.type === 'time' ? 'heures' : 'sessions'}\n${Math.round(progressPercent)}% complété${milestone.unlocked_at ? '\n✓ Débloqué!' : ''}`

              return (
                <div
                  key={milestone.id}
                  className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-help"
                  title={tooltipText}
                >
                  <div className="flex items-center justify-between">
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
