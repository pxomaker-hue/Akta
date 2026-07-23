import { useEffect, useMemo, useState } from 'react'
import type { Client, Project } from '../../shared/types'
import { Icon, Card, CardHeader, confirmDialog } from './UI'

interface ClientManagerProps {
  onClientsLoaded?: (clients: Client[]) => void
}

interface Billing {
  monthSeconds: number
  totalSeconds: number
}

function ClientManager({ onClientsLoaded }: ClientManagerProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [newClientColor, setNewClientColor] = useState('#6366f1')
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [billing, setBilling] = useState<Record<number, Billing>>({})
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null)

  useEffect(() => {
    loadClients()
    loadProjectsBilling()
  }, [])

  async function loadClients() {
    try {
      const data = await window.electron.ipc.invoke('get-clients')
      setClients(data)
      onClientsLoaded?.(data)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charge tous les projets + leur facturation, pour pouvoir agréger par client (un client n'a pas
  // de temps propre : c'est la somme du temps de tous ses projets)
  async function loadProjectsBilling() {
    try {
      const data: Project[] = await window.electron.ipc.invoke('get-projects')
      setProjects(data)
      const billingEntries = await Promise.all(
        data.map(async (p) => {
          const result = await window.electron.ipc.invoke('get-project-billing', p.id)
          return [p.id, result] as const
        })
      )
      setBilling(Object.fromEntries(billingEntries))
    } catch (error) {
      console.error('Error loading projects billing:', error)
    }
  }

  const clientStats = useMemo(() => {
    const map = new Map<
      number,
      { monthSeconds: number; totalSeconds: number; amount: number; projects: { id: number; name: string; color: string; totalSeconds: number; amount: number }[] }
    >()
    projects.forEach((p) => {
      if (!p.client_id) return
      const stats = billing[p.id]
      if (!stats) return
      const amount = p.hourly_rate ? (stats.totalSeconds / 3600) * p.hourly_rate : 0
      const existing = map.get(p.client_id) || { monthSeconds: 0, totalSeconds: 0, amount: 0, projects: [] }
      existing.monthSeconds += stats.monthSeconds
      existing.totalSeconds += stats.totalSeconds
      existing.amount += amount
      existing.projects.push({ id: p.id, name: p.name, color: p.color, totalSeconds: stats.totalSeconds, amount })
      map.set(p.client_id, existing)
    })
    return map
  }, [projects, billing])

  async function createClient() {
    if (!newClientName.trim()) return
    try {
      await window.electron.ipc.invoke('create-client', newClientName, newClientColor)
      setNewClientName('')
      setNewClientColor('#6366f1')
      await loadClients()
    } catch (error) {
      console.error('Error creating client:', error)
    }
  }

  async function deleteClient(clientId: number) {
    if (!(await confirmDialog('Supprimer ce client ? Les projets qui lui étaient rattachés ne seront plus associés à aucun client.', { danger: true }))) return
    try {
      await window.electron.ipc.invoke('delete-client', clientId)
      await loadClients()
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  function toggleExpand(clientId: number) {
    setExpandedClientId(expandedClientId === clientId ? null : clientId)
  }

  const formatHours = (seconds: number) => (seconds / 3600).toFixed(1)

  const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader title="Clients" icon={<Icon name="user" size={18} />} subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`} />

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createClient()}
          placeholder="Nom du client"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
        <button
          onClick={createClient}
          disabled={!newClientName.trim()}
          className="px-4 py-2 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 transition-all flex-shrink-0"
        >
          Ajouter
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => setNewClientColor(color)}
            className={`w-6 h-6 rounded-full transition-transform ${newClientColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {clients.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">Aucun client créé</p>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => {
            const stats = clientStats.get(client.id)
            const isExpanded = expandedClientId === client.id
            return (
              <div key={client.id} className="rounded-lg border" style={{ borderColor: client.color, backgroundColor: `${client.color}10` }}>
                <div className="flex items-center justify-between p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: client.color }} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{client.name}</span>
                    {stats && stats.projects.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex-shrink-0">
                        {stats.projects.length} projet{stats.projects.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteClient(client.id)}
                    className="text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>

                {stats && stats.totalSeconds > 0 && (
                  <div className="px-2.5 pb-2.5">
                    <button
                      onClick={() => toggleExpand(client.id)}
                      className="w-full flex items-center justify-between text-xs pt-2 border-t border-gray-200/50 dark:border-slate-700/50 text-gray-500 dark:text-gray-400 hover:accent-text transition-colors"
                    >
                      <span>
                        {formatHours(stats.monthSeconds)}h ce mois • {formatHours(stats.totalSeconds)}h au total
                        {stats.amount > 0 && ` ≈ ${stats.amount.toFixed(2)} €`}
                      </span>
                      <Icon name={isExpanded ? 'x' : 'chart-bar'} size={11} />
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {stats.projects
                          .sort((a, b) => b.totalSeconds - a.totalSeconds)
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 min-w-0 text-gray-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="truncate">{p.name}</span>
                              </span>
                              <span className="text-gray-500 dark:text-slate-400 flex-shrink-0 ml-2">
                                {formatHours(p.totalSeconds)}h{p.amount > 0 && ` ≈ ${p.amount.toFixed(2)} €`}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default ClientManager
