import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

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
    breakDuration: number
    reason: string
  }
  sessionCount: number
}

function FocusCoaching() {
  const { t } = useTranslation()
  const [coaching, setCoaching] = useState<FocusCoachingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'tdah' | 'standard'>('tdah')

  useEffect(() => {
    loadMode()
  }, [])

  useEffect(() => {
    loadCoaching()
    const interval = setInterval(loadCoaching, 2 * 60 * 1000) // Mise à jour toutes les 2 min
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

  const modeStyles = {
    tdah: {
      headerBg: 'from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30',
      accentColor: '#a855f7',
      borderColor: '#d8b4fe',
      darkBorderColor: '#7e22ce',
    },
    standard: {
      headerBg: 'from-blue-50 to-slate-50 dark:from-blue-950/30 dark:to-slate-950/30',
      accentColor: '#3b82f6',
      borderColor: '#93c5fd',
      darkBorderColor: '#1e40af',
    },
  }

  const currentMode = modeStyles[mode]

  return (
    <Card>
      <CardHeader
        title={t('focusCoaching.title', 'Focus Coaching')}
        icon={<Icon name="activity" size={16} />}
        subtitle={mode === 'tdah' ? t('focusCoaching.tdahSubtitle', '🧠 Mode TDAH (Optimisé courtes cycles)') : t('focusCoaching.standardSubtitle', '⏱️ Mode Standard (Pomodoro classique)')}
      />

      <div className="space-y-4">
        {/* Deep Work Score */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{getQualityIcon()}</span>
                <span className="text-sm font-medium text-gray-600 dark:text-slate-400">{t('focusCoaching.deepWorkScore', 'Deep Work Score')}</span>
              </div>
              <div className={`text-3xl font-bold ${getQualityColor()}`}>
                {analysis.deepWorkScore}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {analysis.streakDays > 0 ? '🔥' : '⭐'} {tf(t('focusCoaching.streakDays', '{{n}} jours'), { n: analysis.streakDays })}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                {tf(t('focusCoaching.completionRate', '{{pct}}% complétées'), { pct: analysis.completionRate.toFixed(0) })}
              </div>
              {analysis.sessionsToday > 0 && (
                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                  {tf(
                    analysis.sessionsToday > 1
                      ? t('focusCoaching.sessionsTodayPlural', "{{n}} sessions aujourd'hui")
                      : t('focusCoaching.sessionsTodaySingular', "{{n}} session aujourd'hui"),
                    { n: analysis.sessionsToday }
                  )}
                </div>
              )}
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
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{t('focusCoaching.totalFocus', 'Total Focus')}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {(analysis.totalDeepWorkMinutes / 60).toFixed(1)}h
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{t('focusCoaching.avgSession', 'Session Moy')}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {Math.round(analysis.averageSessionDuration / 60)}m
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{t('focusCoaching.bestHour', 'Meilleure Heure')}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {pattern.peakHour !== null ? `${pattern.peakHour}h` : '—'}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/50 p-3">
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{t('focusCoaching.consistency', 'Régularité')}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">
              {pattern.consistency}%
            </div>
          </div>
        </div>

        {/* Optimal Cycle Recommendation */}
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">{t('focusCoaching.optimalCycle', 'Cycle Optimal')}</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {Math.round(optimalCycle.duration / 60)}m
              </div>
              <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
                {tf(t('focusCoaching.plusBreak', '+ pause de {{m}}m'), { m: Math.round(optimalCycle.breakDuration / 60) })}
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
              {t('focusCoaching.recommendations', '💡 Recommandations')}
            </div>
            <div className={`space-y-2.5 ${recommendations.length > 4 ? 'max-h-80 overflow-y-auto' : ''}`}>
              {recommendations.map((rec, idx) => (
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
                      ▶ {t('focusCoaching.launch', 'Lancer')}
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
              {t('focusCoaching.optimalHours', '⏰ Heures Optimales')}
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
                    title={isBest ? t('focusCoaching.bestHourTitle', 'Meilleure heure') : isWorst ? t('focusCoaching.worstHourTitle', 'Pire heure') : t('focusCoaching.normalHourTitle', 'Normal')}
                  >
                    {h}h
                  </div>
                )
              })}
            </div>

            {pattern.peakHour !== null && (
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                <span className="font-medium">{t('focusCoaching.insightLabel', '💡 Insight:')}</span>{' '}
                {t('focusCoaching.insightPrefix', 'Tu es le plus productif vers')} <span className="font-semibold">{pattern.peakHour}h</span>.{' '}
                {t('focusCoaching.insightSuffix', 'Bloque ce créneau pour du travail profond.')}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export default FocusCoaching
