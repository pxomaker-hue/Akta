import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader } from './UI'
import { useTranslation } from '../hooks/useTranslation'

function tf(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)), text)
}

interface Prediction {
  projectId: number
  projectName: string
  phaseId?: number
  phaseName?: string
  type: 'hours' | 'amount'
  currentUsage: number
  budgetLimit: number
  percentUsed: number
  velocityPerDay: number
  daysUntilBudget: number
  estimatedDate: string
}

// Une prédiction "hours"/"amount" pour une entité (projet OU phase) donnée — factorisé pour être
// rendu identiquement au niveau projet et au niveau phase, seul le conteneur diffère.
function PredictionRow({ pred, t }: { pred: Prediction; t: (key: string, defaultValue?: string) => string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="text-gray-600 dark:text-slate-300">
          {pred.type === 'hours' ? `⏱ ${t('budgetPredictions.hours', 'Heures')}` : `💰 ${t('budgetPredictions.amount', 'Montant')}`}
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
          <div
            className={`h-1.5 rounded-full transition-all ${
              pred.percentUsed >= 100 ? 'bg-red-500' : pred.percentUsed >= 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(pred.percentUsed, 100)}%` }}
          />
        </div>
      </div>
      <div className="text-right ml-3 flex-shrink-0">
        <div className="font-mono text-xs text-gray-500 dark:text-slate-400">
          {pred.type === 'hours'
            ? `${pred.currentUsage.toFixed(1)}h / ${pred.budgetLimit.toFixed(1)}h`
            : `${pred.currentUsage.toFixed(2)}€ / ${pred.budgetLimit.toFixed(2)}€`}
        </div>
        <div className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">{pred.percentUsed.toFixed(0)}%</div>
      </div>
    </div>
  )
}

function PredictionEstimates({ preds, t }: { preds: Prediction[]; t: (key: string, defaultValue?: string) => string }) {
  if (!preds.some((p) => p.daysUntilBudget >= 0)) return null
  return (
    <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
      {preds.map((pred) => {
        if (pred.daysUntilBudget < 0 || pred.estimatedDate === 'Atteint') return null

        const icon = pred.daysUntilBudget <= 7 ? '🔴' : pred.daysUntilBudget <= 30 ? '🟡' : '🟢'
        const velocityLabel =
          pred.type === 'hours'
            ? tf(t('budgetPredictions.velocityHours', '{{n}}h/jour'), { n: pred.velocityPerDay.toFixed(1) })
            : tf(t('budgetPredictions.velocityAmount', '{{n}}€/jour'), { n: pred.velocityPerDay.toFixed(2) })

        return (
          <div key={`est-${pred.type}`} className="text-xs text-gray-600 dark:text-slate-400 flex items-center justify-between">
            <span>
              {icon} {tf(t('budgetPredictions.daysUntil', '{{n}} j'), { n: pred.daysUntilBudget.toFixed(0) })} • {pred.estimatedDate}
            </span>
            <span>{velocityLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

function BudgetPredictions() {
  const { t } = useTranslation()
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPredictions()
    const interval = setInterval(loadPredictions, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  async function loadPredictions() {
    try {
      const data = await window.electron.ipc.invoke('get-budget-predictions')
      setPredictions(data)
    } catch (error) {
      console.error('Error loading budget predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <Card>
        <CardHeader title={t('budgetPredictions.title', 'Budget — Prédictions')} icon={<Icon name="trending-up" size={18} />} subtitle={t('budgetPredictions.noBudgetProject', 'Aucun projet avec budget')} />
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">{t('budgetPredictions.createBudgetHint', 'Créez un budget sur un projet pour voir les prédictions')}</p>
      </Card>
    )
  }

  // Groupe par projet, puis à l'intérieur sépare les prédictions du projet lui-même de celles de
  // ses phases (elles-mêmes regroupées par phase) — même hiérarchie Projet > Phases que le reste.
  const grouped = new Map<number, { projectName: string; projectPreds: Prediction[]; phaseGroups: Map<number, { phaseName: string; preds: Prediction[] }> }>()
  for (const pred of predictions) {
    if (!grouped.has(pred.projectId)) {
      grouped.set(pred.projectId, { projectName: pred.projectName, projectPreds: [], phaseGroups: new Map() })
    }
    const group = grouped.get(pred.projectId)!
    if (pred.phaseId) {
      if (!group.phaseGroups.has(pred.phaseId)) {
        group.phaseGroups.set(pred.phaseId, { phaseName: pred.phaseName || '', preds: [] })
      }
      group.phaseGroups.get(pred.phaseId)!.preds.push(pred)
    } else {
      group.projectPreds.push(pred)
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('budgetPredictions.title', 'Budget — Prédictions')}
        icon={<Icon name="trending-up" size={18} />}
        subtitle={tf(
          predictions.length === 1 ? t('budgetPredictions.estimateCountSingular', '{{n}} estimation') : t('budgetPredictions.estimateCountPlural', '{{n}} estimations'),
          { n: predictions.length }
        )}
      />

      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([projectId, { projectName, projectPreds, phaseGroups }]) => (
          <div key={projectId} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <div className="font-medium text-gray-900 dark:text-white mb-2">{projectName}</div>

            {projectPreds.length > 0 && (
              <div className="space-y-2 text-sm">
                {projectPreds.map((pred, idx) => (
                  <PredictionRow key={idx} pred={pred} t={t} />
                ))}
                <PredictionEstimates preds={projectPreds} t={t} />
              </div>
            )}

            {phaseGroups.size > 0 && (
              <div className={`space-y-2.5 ${projectPreds.length > 0 ? 'mt-3 pt-3 border-t border-gray-200 dark:border-slate-700' : ''}`}>
                {Array.from(phaseGroups.entries()).map(([phaseId, { phaseName, preds }]) => (
                  <div key={phaseId} className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2.5">
                    <div className="text-xs font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                      <Icon name="tag" size={11} className="flex-shrink-0" />
                      {phaseName}
                    </div>
                    <div className="space-y-2 text-sm">
                      {preds.map((pred, idx) => (
                        <PredictionRow key={idx} pred={pred} t={t} />
                      ))}
                      <PredictionEstimates preds={preds} t={t} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

export default BudgetPredictions
