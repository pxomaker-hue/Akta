import { useRef, useState } from 'react'
import { Icon } from './UI'

function BackupRestore() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [csvExportResult, setCsvExportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setIsExporting(true)
    setExportResult(null)
    try {
      const jsonData = await window.electron.ipc.invoke('export-data')

      // Create download
      const element = document.createElement('a')
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonData))
      element.setAttribute('download', `akta-backup-${new Date().toISOString().split('T')[0]}.json`)
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)

      setExportResult('ok:Sauvegarde téléchargée avec succès')
    } catch (error) {
      setExportResult(`err:Erreur lors de l'export: ${error}`)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportCsv() {
    setIsExportingCsv(true)
    setCsvExportResult(null)
    try {
      const csvData = await window.electron.ipc.invoke('export-activities-csv')

      const element = document.createElement('a')
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData))
      element.setAttribute('download', `akta-activites-${new Date().toISOString().split('T')[0]}.csv`)
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)

      setCsvExportResult('ok:Export CSV téléchargé avec succès')
    } catch (error) {
      setCsvExportResult(`err:Erreur lors de l'export CSV: ${error}`)
    } finally {
      setIsExportingCsv(false)
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const text = await file.text()
      const result = await window.electron.ipc.invoke('import-data', text)

      if (result.errors.length > 0) {
        setImportResult({
          success: false,
          message: `Importé ${result.imported} éléments avec ${result.errors.length} erreur(s):\n${result.errors.join('\n')}`,
        })
      } else {
        setImportResult({
          success: true,
          message: `Importé ${result.imported} éléments avec succès`,
        })
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: `Erreur lors de l'import: ${error}`,
      })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Export */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="save" size={18} className="accent-text" />
          Créer une sauvegarde
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Téléchargez un fichier contenant toutes vos données (activités, catégories, tags, paramètres).
        </p>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full px-4 py-2.5 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Icon name={isExporting ? 'refresh' : 'download'} size={16} className={isExporting ? 'animate-spin' : ''} />
          {isExporting ? 'Export en cours...' : 'Télécharger la sauvegarde'}
        </button>

        {exportResult && (
          <p className={`mt-3 text-sm flex items-center gap-1.5 ${exportResult.startsWith('ok:') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            <Icon name={exportResult.startsWith('ok:') ? 'check' : 'alert'} size={14} />
            {exportResult.slice(exportResult.indexOf(':') + 1)}
          </p>
        )}
      </div>

      {/* Export CSV */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="chart-bar" size={18} className="accent-text" />
          Exporter en CSV
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Exporte tes activités au format tableur (Excel, Google Sheets...) — pratique pour un comptable ou une analyse manuelle.
        </p>

        <button
          onClick={handleExportCsv}
          disabled={isExportingCsv}
          className="w-full px-4 py-2.5 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Icon name={isExportingCsv ? 'refresh' : 'download'} size={16} className={isExportingCsv ? 'animate-spin' : ''} />
          {isExportingCsv ? 'Export en cours...' : 'Télécharger le CSV des activités'}
        </button>

        {csvExportResult && (
          <p className={`mt-3 text-sm flex items-center gap-1.5 ${csvExportResult.startsWith('ok:') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            <Icon name={csvExportResult.startsWith('ok:') ? 'check' : 'alert'} size={14} />
            {csvExportResult.slice(csvExportResult.indexOf(':') + 1)}
          </p>
        )}
      </div>

      {/* Import */}
      <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Icon name="folder" size={18} className="accent-text" />
          Restaurer une sauvegarde
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Chargez un fichier de sauvegarde pour restaurer vos données. Les données existantes seront fusionnées/remplacées.
        </p>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={isImporting}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full px-4 py-2.5 rounded-lg accent-gradient-bg text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <Icon name={isImporting ? 'refresh' : 'upload'} size={16} className={isImporting ? 'animate-spin' : ''} />
            {isImporting ? 'Import en cours...' : 'Charger une sauvegarde'}
          </button>
        </div>

        {importResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              importResult.success
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}
          >
            <pre className="whitespace-pre-wrap font-mono text-xs">{importResult.message}</pre>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-4 border border-gray-200 dark:border-slate-700 flex items-start gap-2.5">
        <Icon name="alert" size={16} className="accent-text mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Les sauvegardes contiennent tout sauf les fichiers de configuration système. Elles sont au format JSON et peuvent être inspectées/éditées manuellement si besoin.
        </p>
      </div>
    </div>
  )
}

export default BackupRestore
