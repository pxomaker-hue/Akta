import { useEffect, useState } from 'react'
import type { FocusSession } from '../../shared/types'
import { Icon, confirmDialog } from './UI'

interface FocusHistoryProps {
  sessions: FocusSession[]
  onDelete?: () => void
}

const PAGE_SIZE = 30

function FocusHistory({ sessions, onDelete }: FocusHistoryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Revient à la première page si la liste change de taille (nouvelle session, filtre, etc.),
  // sinon on peut se retrouver avec une page qui ne correspond plus à rien
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [sessions.length])

  const isToday = (ms: number) => {
    const d = new Date(ms)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }

  const formatTime = (ms: number) => {
    const time = new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (isToday(ms)) return time
    const date = new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    return `${date} ${time}`
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours === 0) return `${minutes}m`
    return `${hours}h ${minutes}m`
  }

  const handleDelete = async (session: FocusSession) => {
    if (!(await confirmDialog('Supprimer cette session focus de l\'historique ?', { danger: true }))) return
    setDeletingId(session.id)
    try {
      await window.electron.ipc.invoke('delete-focus-session', session.id)
      onDelete?.()
    } catch (error) {
      console.error('Error deleting focus session:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-gray-200/50 dark:border-slate-700/50 p-6 text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Aucune session focus pour le moment. Démarre une session pour voir l'historique.</p>
      </div>
    )
  }

  const visibleSessions = sessions.slice(0, visibleCount)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-gray-200/50 dark:border-slate-700/50 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon name="clock" size={18} className="accent-text" />
          Historique des sessions focus
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Heure de début</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Durée</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Prévue</th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Statut</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Apps bloquées</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700 dark:text-gray-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {visibleSessions.map((session) => {
              const actualDuration = session.end_time ? Math.floor((session.end_time - session.start_time) / 1000) : 0
              const isCompleted = session.completed && actualDuration >= session.planned_duration
              const blockedApps = JSON.parse(session.blocked_apps)

              return (
                <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <td className="py-3 px-6 text-gray-900 dark:text-white whitespace-nowrap">{formatTime(session.start_time)}</td>
                  <td className="py-3 px-6 text-gray-900 dark:text-white">
                    {actualDuration > 0 ? formatDuration(actualDuration) : 'En cours'}
                  </td>
                  <td className="py-3 px-6 text-gray-600 dark:text-gray-400">{formatDuration(session.planned_duration)}</td>
                  <td className="py-3 px-6 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isCompleted
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                          : session.end_time
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      }`}
                    >
                      {isCompleted ? 'Terminée' : session.end_time ? 'Partielle' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-6">
                    {blockedApps.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {blockedApps.slice(0, 2).map((app: string) => (
                          <span key={app} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                            {app}
                          </span>
                        ))}
                        {blockedApps.length > 2 && <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">+{blockedApps.length - 2}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-right">
                    {!session.end_time ? null : (
                      <button
                        onClick={() => handleDelete(session)}
                        disabled={deletingId === session.id}
                        title="Supprimer cette session"
                        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sessions.length > visibleCount && (
        <div className="text-center p-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Voir plus ({sessions.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  )
}

export default FocusHistory
