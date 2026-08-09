import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import type {
  ExcelExportScope,
  ExcelHistory,
  ExcelHistoryFilters,
  ExcelImportResult,
  ExcelJobStatus,
  ExcelModuleKey,
  ExcelOperationType
} from '../excel-engine/excel-engine.types'
import { formatNumber } from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

const ALL_FILTER = 'all'

const EXPORT_SCOPE_LABELS: Record<ExcelExportScope, string> = {
  ALL: 'Tam veri',
  FILTERED: 'Filtreli export',
  SELECTED: 'Secili kayitlar'
}

const OPERATION_LABELS: Record<ExcelOperationType, string> = {
  IMPORT: 'Import',
  EXPORT: 'Export',
  TEMPLATE: 'Template'
}

const STATUS_LABELS: Record<ExcelJobStatus, string> = {
  PENDING: 'Bekliyor',
  SUCCESS: 'Basarili',
  FAILED: 'Basarisiz'
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: ExcelJobStatus) => {
  if(status === 'FAILED') return 'danger-pill'
  if(status === 'PENDING') return 'warning-pill'
  return 'success'
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const createDefaultHistoryFilters = (): ExcelHistoryFilters => ({
  moduleKey: ALL_FILTER,
  userName: '',
  date: '',
  operationType: ALL_FILTER,
  status: ALL_FILTER
})

export default function ExcelCenter({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const [historyVersion, setHistoryVersion] = React.useState(0)
  const exportModuleOptions = React.useMemo(() => ExcelIntegrationService.listExportModules(), [])
  const importModuleOptions = React.useMemo(() => ExcelIntegrationService.listImportModules(), [])
  const [importModule, setImportModule] = React.useState<ExcelModuleKey>('raw-materials')
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [importResult, setImportResult] = React.useState<ExcelImportResult | null>(null)
  const [importLoading, setImportLoading] = React.useState(false)
  const [importMessage, setImportMessage] = React.useState('')
  const [exportModules, setExportModules] = React.useState<ExcelModuleKey[]>(['products'])
  const [exportScope, setExportScope] = React.useState<ExcelExportScope>('ALL')
  const [exportFilter, setExportFilter] = React.useState('')
  const [selectedRecordIds, setSelectedRecordIds] = React.useState<string[]>([])
  const [exportMessage, setExportMessage] = React.useState('')
  const [historyFilters, setHistoryFilters] = React.useState<ExcelHistoryFilters>(() => createDefaultHistoryFilters())
  const statistics = React.useMemo(() => ExcelIntegrationService.history.statistics(), [historyVersion])
  const history = React.useMemo(() => ExcelIntegrationService.history.filter(historyFilters), [historyFilters, historyVersion])
  const importTemplates = React.useMemo(() => ExcelIntegrationService.listImportTemplates(), [])
  const exportSummaries = React.useMemo(() => exportModuleOptions.map(moduleKey => ExcelIntegrationService.summarizeRows(moduleKey)), [exportModuleOptions, historyVersion])
  const selectionModule = exportModules[0] || 'products'
  const selectionDataSet = React.useMemo(() => ExcelIntegrationService.getDataSet(selectionModule, {
    moduleKeys: [selectionModule],
    scope: exportScope === 'SELECTED' ? 'FILTERED' : exportScope,
    filterText: exportFilter,
    selectedRecordIds: [],
    userName
  }), [exportFilter, exportScope, selectionModule, userName, historyVersion])

  const refreshHistory = () => setHistoryVersion(version => version + 1)

  const toggleExportModule = (moduleKey: ExcelModuleKey) => {
    setExportModules(prev => {
      const nextModules = prev.includes(moduleKey)
        ? prev.filter(item => item !== moduleKey)
        : [...prev, moduleKey]
      return nextModules.length > 0 ? nextModules : [moduleKey]
    })
    setSelectedRecordIds([])
  }

  const toggleSelectedRecord = (recordId: string) => {
    setSelectedRecordIds(prev => prev.includes(recordId)
      ? prev.filter(item => item !== recordId)
      : [...prev, recordId]
    )
  }

  const validateImportFile = async () => {
    if(!importFile){
      setImportMessage('Dosya secilmedi.')
      return
    }

    setImportLoading(true)
    setImportMessage('')

    try {
      const result = await ExcelIntegrationService.previewImport(importFile, importModule, userName)
      setImportResult(result)
      setImportMessage(result.job.message)
      refreshHistory()
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Excel dosyasi okunamadi.')
    } finally {
      setImportLoading(false)
    }
  }

  const commitImport = () => {
    if(!importResult) return
    const result = ExcelIntegrationService.commitImport(importResult, currentUser)
    setImportResult(result)
    setImportMessage(result.job.message)
    refreshHistory()
  }

  const runExport = () => {
    const result = ExcelIntegrationService.exportModules({
      moduleKeys: exportModules,
      scope: exportScope,
      filterText: exportFilter,
      selectedRecordIds,
      userName
    })
    setExportMessage(`${result.fileName} indirildi; ${formatNumber(result.recordCount)} kayit export edildi.`)
    refreshHistory()
  }

  const downloadTemplate = (moduleKey: ExcelModuleKey) => {
    const result = ExcelIntegrationService.downloadTemplate(moduleKey, userName)
    setExportMessage(`${result.fileName} sablonu indirildi.`)
    refreshHistory()
  }

  const updateHistoryFilter = <TKey extends keyof ExcelHistoryFilters>(key: TKey, value: ExcelHistoryFilters[TKey]) => {
    setHistoryFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="excel-center-page">
      <div className="page-header">
        <div>
          <h2>Excel Merkezi</h2>
          <p className="muted">Kritik ERP modulleri icin .xlsx import, export, sablon, validation ve history merkezi.</p>
        </div>
        <div className="excel-header-actions">
          <span className="status-pill success">XLSX Engine</span>
          <span className="muted">{userName}</span>
        </div>
      </div>

      <div className="metric-grid excel-card-grid">
        <div className="metric-card excel-card success"><span>Bugunku Import</span><strong>{formatNumber(statistics.todayImports)}</strong><small>Bugun kaydedilen import job</small></div>
        <div className="metric-card excel-card neutral"><span>Bugunku Export</span><strong>{formatNumber(statistics.todayExports)}</strong><small>Bugun alinan export job</small></div>
        <div className="metric-card excel-card neutral"><span>Toplam Islem</span><strong>{formatNumber(statistics.totalJobs)}</strong><small>History kaydi</small></div>
        <div className="metric-card excel-card danger"><span>Basarisiz Islem</span><strong>{formatNumber(statistics.failedJobs)}</strong><small>Validation veya islem hatasi</small></div>
        <div className="metric-card excel-card warning"><span>En Cok Export</span><strong>{statistics.mostExportedModule}</strong><small>Modul bazli export lideri</small></div>
      </div>

      <div className="excel-work-grid">
        <section className="card excel-panel">
          <div className="section-header compact">
            <div>
              <h3>Excel Import</h3>
              <p className="muted">Dosya, sablon, kolon ve veri kontrolleri sonrasi onizleme uretir.</p>
            </div>
            <span className="status-pill">{ExcelIntegrationService.getModuleLabel(importModule)}</span>
          </div>
          <div className="excel-import-grid">
            <label className="form-field">
              <span>Modul</span>
              <select value={importModule} onChange={event => {
                setImportModule(event.target.value as ExcelModuleKey)
                setImportResult(null)
                setImportMessage('')
              }}>
                {importModuleOptions.map(moduleKey => (
                  <option key={moduleKey} value={moduleKey}>{ExcelIntegrationService.getModuleLabel(moduleKey)}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Dosya</span>
              <input type="file" accept=".xlsx" onChange={event => {
                setImportFile(event.target.files?.[0] || null)
                setImportResult(null)
                setImportMessage('')
              }} />
            </label>
            <button className="btn" type="button" disabled={importLoading || !importFile} onClick={validateImportFile}>
              {importLoading ? 'Kontrol ediliyor' : 'Sablon Dogrula'}
            </button>
            <button className="btn" type="button" onClick={() => downloadTemplate(importModule)}>
              Excel Sablonunu Indir
            </button>
            <button className="btn primary" type="button" disabled={!importResult || importResult.validRows.length === 0 || importResult.committed} onClick={commitImport}>
              Ice Aktar
            </button>
          </div>

          <ImportStatus result={importResult} message={importMessage} />
          <ImportPreview result={importResult} />
        </section>

        <section className="card excel-panel">
          <div className="section-header compact">
            <div>
              <h3>Excel Export</h3>
              <p className="muted">Tek modul, coklu modul, filtreli, secili veya tam veri export eder.</p>
            </div>
            <span className="status-pill">{formatNumber(exportModules.length)} modul</span>
          </div>

          <div className="excel-export-modules">
            {exportModuleOptions.map(moduleKey => (
              <label className="excel-check-row" key={moduleKey}>
                <input type="checkbox" checked={exportModules.includes(moduleKey)} onChange={() => toggleExportModule(moduleKey)} />
                <span>{ExcelIntegrationService.getModuleLabel(moduleKey)}</span>
              </label>
            ))}
          </div>

          <div className="excel-export-controls">
            <label className="form-field">
              <span>Export Tipi</span>
              <select value={exportScope} onChange={event => {
                setExportScope(event.target.value as ExcelExportScope)
                setSelectedRecordIds([])
              }}>
                {(Object.keys(EXPORT_SCOPE_LABELS) as ExcelExportScope[]).map(scope => (
                  <option key={scope} value={scope}>{EXPORT_SCOPE_LABELS[scope]}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Filtre</span>
              <input value={exportFilter} onChange={event => setExportFilter(event.target.value)} placeholder="Urun, supplier, lot..." />
            </label>
            <button className="btn primary" type="button" onClick={runExport}>Export Al</button>
          </div>

          {exportScope === 'SELECTED' && (
            <div className="excel-selection-list">
              {selectionDataSet.rows.slice(0, 8).map(row => {
                const id = String(row.id || '')
                return (
                  <label className="excel-check-row" key={id}>
                    <input type="checkbox" checked={selectedRecordIds.includes(id)} onChange={() => toggleSelectedRecord(id)} />
                    <span>{String(row.name || row.productName || row.recipeName || row.supplierCode || row.requestNo || row.id)}</span>
                  </label>
                )
              })}
            </div>
          )}

          {exportMessage && <p className="excel-message">{exportMessage}</p>}
        </section>
      </div>

      <section className="card excel-panel">
        <div className="section-header compact">
          <div>
            <h3>Template Management</h3>
            <p className="muted">Bos Urun, Supplier, Recipe, Purchase Request ve Stok sablonlari .xlsx olarak uretilir.</p>
          </div>
        </div>
        <div className="excel-template-grid">
          {importTemplates.map(template => (
            <div className="excel-template-row" key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <span>{template.columns.filter(column => column.required).length} zorunlu kolon / {template.columns.length} toplam kolon</span>
              </div>
              <button className="btn" type="button" onClick={() => downloadTemplate(template.moduleKey)}>Sablon Indir</button>
            </div>
          ))}
        </div>
      </section>

      <div className="excel-insight-grid">
        <section className="card excel-panel">
          <div className="section-header compact">
            <div>
              <h3>Export Kapsami</h3>
              <p className="muted">Desteklenen modullerde anlik kayit sayisi.</p>
            </div>
          </div>
          <div className="excel-summary-list">
            {exportSummaries.map(summary => (
              <div className="excel-summary-row" key={summary.moduleKey}>
                <strong>{summary.moduleLabel}</strong>
                <span>{formatNumber(summary.rowCount)} kayit</span>
                <em>{summary.total}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="card excel-panel">
          <div className="section-header compact">
            <div>
              <h3>History</h3>
              <p className="muted">Kim, ne zaman, hangi modulde kac kayit import/export etti.</p>
            </div>
            <button className="btn" type="button" onClick={() => setHistoryFilters(createDefaultHistoryFilters())}>Sifirla</button>
          </div>
          <div className="excel-history-filter-grid">
            <label className="form-field">
              <span>Modul</span>
              <select value={historyFilters.moduleKey} onChange={event => updateHistoryFilter('moduleKey', event.target.value as ExcelHistoryFilters['moduleKey'])}>
                <option value={ALL_FILTER}>Tum Moduller</option>
                {exportModuleOptions.map(moduleKey => <option key={moduleKey} value={moduleKey}>{ExcelIntegrationService.getModuleLabel(moduleKey)}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Kullanici</span>
              <input value={historyFilters.userName} onChange={event => updateHistoryFilter('userName', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Tarih</span>
              <input type="date" value={historyFilters.date} onChange={event => updateHistoryFilter('date', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Islem</span>
              <select value={historyFilters.operationType} onChange={event => updateHistoryFilter('operationType', event.target.value as ExcelHistoryFilters['operationType'])}>
                <option value={ALL_FILTER}>Tum Islemler</option>
                {(Object.keys(OPERATION_LABELS) as ExcelOperationType[]).map(type => <option key={type} value={type}>{OPERATION_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Durum</span>
              <select value={historyFilters.status} onChange={event => updateHistoryFilter('status', event.target.value as ExcelHistoryFilters['status'])}>
                <option value={ALL_FILTER}>Tum Durumlar</option>
                {(Object.keys(STATUS_LABELS) as ExcelJobStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
              </select>
            </label>
          </div>
          <HistoryTable history={history} />
        </section>
      </div>
    </div>
  )
}

function ImportStatus({ message, result }: { message: string; result: ExcelImportResult | null }){
  if(!message && !result) return null
  const blockingErrorCount = result?.errors.filter(error => error.columnKey !== '__row__').length || 0
  const blankRowCount = result?.errors.filter(error => error.columnKey === '__row__').length || 0

  return (
    <div className="excel-import-status">
      <div><strong>Kolon Kontrolu</strong><span>{blockingErrorCount > 0 ? 'Hata var' : result ? 'Uygun' : '-'}</span></div>
      <div><strong>Veri Kontrolu</strong><span>{result ? `${formatNumber(result.validRows.length)} gecerli / ${formatNumber(result.invalidRows.length)} hatali` : '-'}</span></div>
      <div><strong>Bos Satir</strong><span>{formatNumber(blankRowCount)}</span></div>
      <div><strong>Sonuc</strong><span>{message}</span></div>
    </div>
  )
}

function ImportPreview({ result }: { result: ExcelImportResult | null }){
  if(!result) return null
  const previewRows = result.rows.slice(0, 6)
  const columns = Object.keys(previewRows[0] || {})

  return (
    <div className="excel-preview-grid">
      <div className="table-wrap excel-preview-table-wrap">
        <table className="data-table excel-preview-table">
          <thead>
            <tr>
              {columns.map(column => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {previewRows.length === 0 && <tr><td className="empty-cell">Onizleme kaydi yok.</td></tr>}
            {previewRows.map((row, index) => (
              <tr key={`${result.fileName}-${index}`}>
                {columns.map(column => <td key={column} data-label={column}>{String(row[column] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="excel-error-list">
        {result.errors.length === 0 && <div className="empty-cell">Validation hatasi yok.</div>}
        {result.errors.slice(0, 8).map(error => (
          <div key={`${error.rowNumber}-${error.columnKey}-${error.message}`}>
            <strong>{error.rowNumber > 0 ? `Satir ${error.rowNumber}` : 'Kolon'}</strong>
            <span>{error.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryTable({ history }: { history: ExcelHistory[] }){
  return (
    <div className="table-wrap excel-history-table-wrap">
      <table className="data-table excel-history-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Kullanici</th>
            <th>Islem</th>
            <th>Modul</th>
            <th>Kayit</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 && <tr><td colSpan={6} className="empty-cell">History kaydi bulunamadi.</td></tr>}
          {history.map(job => (
            <tr key={job.id}>
              <td data-label="Tarih">{formatDateTime(job.createdAt)}</td>
              <td data-label="Kullanici">{job.userName}</td>
              <td data-label="Islem">{OPERATION_LABELS[job.operationType]}</td>
              <td data-label="Modul">{job.moduleLabel}</td>
              <td data-label="Kayit">{formatNumber(job.recordCount)}</td>
              <td data-label="Durum"><span className={`status-pill ${getStatusClass(job.status)}`}>{STATUS_LABELS[job.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
