import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader } from './UI'

interface FocusCoachingData {
  analysis: {
    deepWorkScore: number
    focusQuality: 'excellent' | 'good' | 'fair' | 'poor'
    streakDays: number
    totalDeepWorkMinutes: number
    completionRate: number
    averageSessionDuration: number
  }
  pattern: {
    bestHours: number[]
    worstHours: number[]
    peakHour: number | null
    consistency: number
  }
  recommendations: Array<{
    type: 'cycle' | 'break' | 'timing' | 'streak' | 'practice'
    priority: 'high' | 'medium' | 'low'
    message: string
    action?: string
  }>
  optimalCycle: {
    duration: number
    reason: string
  }
  sessionCount: number
}

function FocusCoaching() {
  const [coaching, setCoaching] = useState<FocusCoachingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'tdah' | 'standard'>('tdah')

  useEffect(() => {
    loadMode()
  }, [])

  useEffect(() => {
    loadCoaching()
    const interval = setInterval(loadCoaching, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [mode])

  async function loadMode() {
    try {
      const data = await window.electron.ipc.invoke('get-setting', 'focus_coaching_mode')
      setMode((data || 'tdah') as 'tdah' | 'standard')
    } catch (error) {
      console.error('Error loading focus coaching mode:', error)
    }
  }

  async function loadCoaching() {
    try {
      const data = await window.electron.ipc.invoke('get-focus-coaching', 7)
      setCoaching(data)
    } catch (error) {
      console.error('Error loading focus coaching:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !coaching) {
    return (
      <div className="text-center py-6">
        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const { analysis, pattern, recommendations, optimalCycle } = coaching

  const getQualityIcon = () => {
    switch (analysis.focusQuality) {
      case 'excellent': return '✨'
      case 'good': return '👍'
      case 'fair': return '⚡'
      case 'poor': return '📉'
    }
  }

  const getQualityColor = () => {
    switch (analysis.focusQuality) {
      case 'excellent': return 'text-green-600 dark:text-green-400'
      case 'good': return 'text-blue-600 dark:text-blue-400'
      case 'fair': return 'text-yellow-600 dark:text-yellow-400'
      case 'poor': return 'text-red-600 dark:text-red-400'
    }
  }

  const priorityIcon = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  }

  return (
    <Card>
      <CardHeader
        title="Focus Coaching"
        icon={<Icon name="activity" size={16} />}
        subtitle={mode === 'tdah' ? '🧠 Mode TDAH' : '⏱️ Mode Standard'}
      />

      <div className="space-y-4">
        {/* Deep Work Score */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{getQualityIcon()}</span>
                <span className="text-sm font-medium text-gray-600 dark:text-slate-400">Deep Work Score</span>
              </div>
              <div className={`text-3xl font-bold ${getQualityColor()}`}>
                {analysis.deepWorkScore}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-slate-500">
              <div>{analysis.completionRate.toFixed(0)}% complétées</div>
              <div>{analysis.streakDays} jours 🔥</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                analysis.focusQuality === 'excellent'
                  ? 'bg-green-500'
                  : analysis.focusQuality === 'good'
                    ? 'bg-blue-500'
                    : analysis.focusQuality === 'fair'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
              }`}
              style={{ width: `${analysis.deepWorkScore}%` }}
            />
          </div>
        </div>

        {/* Key Metrics - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Total Focus</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {(analysis.totalDeepWorkMinutes / 60).toFixed(1)}h
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Session Moy</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {Math.round(analysis.averageSessionDuration / 60)}m
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Meilleure Heure</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {pattern.peakHour !== null ? `${pattern.peakHour}h` : '—'}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">Régularité</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {pattern.consistency}%
            </div>
          </div>
        </div>

        {/* Optimal Cycle Recommendation */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Cycle Optimal</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {Math.round(optimalCycle.duration / 60)}m
              </div>
            </div>
            <div className="text-xs text-indigo-700 dark:text-indigo-300 text-right max-w-xs">
              {optimalCycle.reason}
            </div>
          </div>
        </div>

        {/* Recommendations (TDAH mode only) */}
        {mode === 'tdah' && recommendations.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <div className="text-xs font-semibold text-gray-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
              💡 Recommandations
            </div>
            <div className="space-y-2.5">
              {recommendations.slice(0, 3).map((rec, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border-l-4 border-transparent p-3 bg-white dark:bg-slate-800 text-sm"
                  style={{
                    borderLeftColor:
                      rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#eab308' : '#10b981',
                  }}
                >
                  <div className="flex gap-2.5 items-start mb-2">
                    <span className="text-base flex-shrink-0 mt-0.5">{priorityIcon[rec.priority]}</span>
                    <span className="text-gray-900 dark:text-white flex-1 leading-snug">{rec.message}</span>
                  </div>
                  {rec.action && (rec.action === 'start-session' || rec.action === 'start-18min-cycle') && (
                    <button
                      onClick={() => {
                        let duration = optimalCycle.duration
                        if (rec.action === 'start-18min-cycle') {
                          duration = 18 * 60
                        }

                        window.electron.ipc.invoke('start-focus-session', duration, [])
                          .then(() => {
                            setTimeout(() => {
                              document.querySelector('[data-focus-timer]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }, 100)
                          })
                          .catch((err) => console.error('Failed to start session:', err))
                      }}
                      className="text-xs px-3 py-1.5 bg-[var(--accent-primary)] hover:brightness-110 text-white rounded-full transition-all font-medium inline-flex items-center gap-1"
                    >
                      ▶ Lancer
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Productivity Timeline (TDAH mode only) */}
        {mode === 'tdah' && pattern.bestHours.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
            <div className="text-xs font-semibold text-gray-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
              ⏰ Heures Optimales
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {Array.from({ length: 24 }).map((_, h) => {
                const isBest = pattern.bestHours.includes(h)
                const isWorst = pattern.worstHours.includes(h)
                return (
                  <div
                    key={h}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-default ${
                      isBest
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700'
                        : isWorst
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400'
                    }`}
                    title={isBest ? 'Meilleure heure' : isWorst ? 'Pire heure' : 'Normal'}
                  >
                    {h}h
                  </div>
                )
              })}
            </div>

            {pattern.peakHour !== null && (
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                <span className="font-medium">💡 Insight:</span> Tu es le plus productif vers <span className="font-semibold">{pattern.peakHour}h</span>. Bloque ce créneau pour du travail profond.
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default FocusCoaching
