import { useEffect, useState } from 'react'
import { Icon, Card, CardHeader } from './UI'

interface Prediction {
  projectId: number
  projectName: string
  type: 'hours' | 'amount'
  currentUsage: number
  budgetLimit: number
  percentUsed: number
  velocityPerDay: number
  daysUntilBudget: number
  estimatedDate: string
}

function BudgetPredictions() {
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
        <CardHeader title="Budget — Prédictions" icon={<Icon name="trending-up" size={18} />} subtitle="Aucun projet avec budget" />
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">Créez un budget sur un projet pour voir les prédictions</p>
      </Card>
    )
  }

  // Group by project
  const grouped = new Map<number, Prediction[]>()
  for (const pred of predictions) {
    if (!grouped.has(pred.projectId)) {
      grouped.set(pred.projectId, [])
    }
    grouped.get(pred.projectId)!.push(pred)
  }

  return (
    <Card>
      <CardHeader title="Budget — Prédictions" icon={<Icon name="trending-up" size={18} />} subtitle={`${predictions.length} estimation(s)`} />

      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([projectId, projectPredictions]) => (
          <div key={projectId} className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
            <div className="font-medium text-gray-900 dark:text-white mb-2">
              {projectPredictions[0].projectName}
            </div>

            <div className="space-y-2 text-sm">
              {projectPredictions.map((pred, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-600 dark:text-slate-300">
                      {pred.type === 'hours' ? '⏱ Heures' : '💰 Montant'}
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
                    <div className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                      {pred.percentUsed.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}

              {projectPredictions.some((p) => p.daysUntilBudget >= 0) && (
                <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                  {projectPredictions.map((pred) => {
                    if (pred.daysUntilBudget < 0 || pred.estimatedDate === 'Atteint') return null

                    const icon = pred.daysUntilBudget <= 7 ? '🔴' : pred.daysUntilBudget <= 30 ? '🟡' : '🟢'
                    const velocityLabel = pred.type === 'hours' ? `${pred.velocityPerDay.toFixed(1)}h/jour` : `${pred.velocityPerDay.toFixed(2)}€/jour`

                    return (
                      <div key={`est-${pred.type}`} className="text-xs text-gray-600 dark:text-slate-400 flex items-center justify-between">
                        <span>
                          {icon} {pred.daysUntilBudget.toFixed(0)} j • {pred.estimatedDate}
                        </span>
                        <span>{velocityLabel}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default BudgetPredictions
