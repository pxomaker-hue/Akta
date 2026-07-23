import { BrowserWindow } from 'electron'
import { getProjectById, getSessionsForProject, getSessionBillableSeconds } from './database'

interface ReportRow {
  date: string
  time: string
  label: string
  hours: string
  amount: string
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(2)
}

function buildReportHtml(title: string, subtitle: string, rows: ReportRow[], totalHours: string, totalAmount: string | null): string {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.time)}</td>
      <td>${escapeHtml(r.label)}</td>
      <td class="num">${escapeHtml(r.hours)} h</td>
      <td class="num">${escapeHtml(r.amount)}</td>
    </tr>`
    )
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .subtitle { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; border-bottom: 2px solid #1f2937; padding: 6px 4px; }
  td { padding: 6px 4px; border-bottom: 1px solid #e5e7eb; }
  .num { text-align: right; }
  tfoot td { border-top: 2px solid #1f2937; border-bottom: none; font-weight: bold; padding-top: 10px; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">${escapeHtml(subtitle)}</div>
  <table>
    <thead><tr><th>Date</th><th>Heure</th><th>Session</th><th class="num">Durée</th><th class="num">Montant</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:20px">Aucune session sur cette période.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3"></td><td class="num">${escapeHtml(totalHours)} h</td><td class="num">${totalAmount ? escapeHtml(totalAmount) : ''}</td></tr></tfoot>
  </table>
</body>
</html>`
}

async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
  } finally {
    win.destroy()
  }
}

export async function generateProjectPDF(projectId: number): Promise<Buffer> {
  const project = getProjectById(projectId)
  if (!project) throw new Error('Projet introuvable')

  const sessions = getSessionsForProject(projectId)
  let totalSeconds = 0
  let totalAmount = 0
  const rows: ReportRow[] = sessions.map((s: any) => {
    const billableSeconds = getSessionBillableSeconds(s.id)
    const amount = project.hourly_rate ? (billableSeconds / 3600) * project.hourly_rate : 0
    totalSeconds += billableSeconds
    totalAmount += amount
    const start = new Date(s.start_time)
    return {
      date: start.toLocaleDateString('fr-FR'),
      time: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      label: s.label || s.phase_name || '—',
      hours: formatHours(billableSeconds),
      amount: project.hourly_rate ? `${amount.toFixed(2)} €` : '',
    }
  })

  const subtitle = `${project.client_name ? project.client_name + ' • ' : ''}Export généré le ${new Date().toLocaleDateString('fr-FR')}`
  const html = buildReportHtml(project.name, subtitle, rows, formatHours(totalSeconds), project.hourly_rate ? `${totalAmount.toFixed(2)} €` : null)
  return htmlToPdfBuffer(html)
}

export async function generateMonthlyPDF(monthStartMs: number, monthEndMs: number, sessions: any[]): Promise<Buffer> {
  let totalSeconds = 0
  let totalAmount = 0
  const rows: ReportRow[] = sessions.map((s: any) => {
    const billableSeconds = getSessionBillableSeconds(s.id)
    const amount = s.project_hourly_rate ? (billableSeconds / 3600) * s.project_hourly_rate : 0
    totalSeconds += billableSeconds
    totalAmount += amount
    const start = new Date(s.start_time)
    return {
      date: start.toLocaleDateString('fr-FR'),
      time: start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      label: `${s.project_name || 'Sans projet'}${s.label ? ' — ' + s.label : ''}`,
      hours: formatHours(billableSeconds),
      amount: amount ? `${amount.toFixed(2)} €` : '',
    }
  })

  const monthLabel = new Date(monthStartMs).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const subtitle = `Export généré le ${new Date().toLocaleDateString('fr-FR')}`
  const html = buildReportHtml(`Rapport — ${monthLabel}`, subtitle, rows, formatHours(totalSeconds), totalAmount ? `${totalAmount.toFixed(2)} €` : null)
  return htmlToPdfBuffer(html)
}
