import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { WastePredictionPrintService } from '../waste-predictions/waste-prediction-print.service'
import {
  WASTE_PREDICTION_PRIORITIES,
  WASTE_PREDICTION_PRIORITY_LABELS,
  WASTE_PREDICTION_RISKS,
  WASTE_PREDICTION_RISK_LABELS,
  WASTE_PREDICTION_STATUS_LABELS,
  WASTE_PREDICTION_TYPES,
  WASTE_PREDICTION_TYPE_LABELS,
  WastePredictionService
} from '../waste-predictions/waste-prediction.service'
import type {
  WastePredictionAlternative,
  WastePredictionFilters,
  WastePredictionHistoryAction,
  WastePredictionItem,
  WastePredictionLinkedEntity,
  WastePredictionPriority,
  WastePredictionReport,
  WastePredictionReportCreateInput,
  WastePredictionRisk,
  WastePredictionStatus
} from '../waste-predictions/waste-prediction.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type WastePredictionRow = {
  report: WastePredictionReport
  item: WastePredictionItem
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
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

const escapeHtml = (value: string | number | boolean) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const getRiskClass = (risk: WastePredictionRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: WastePredictionPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: WastePredictionStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: WastePredictionHistoryAction) => {
  if(action === 'CREATED') return 'Oluşturuldu'
  if(action === 'CALCULATED') return 'Hesaplandı'
  if(action === 'REVIEWED') return 'İncelendi'
  if(action === 'ARCHIVED') return 'Arşivlendi'
  if(action === 'PRINTED') return 'Yazdırıldı'
  if(action === 'PDF') return 'PDF'
  return 'Excel'
}

const uniqueOptions = (
  options: Array<{ id: string; name: string }>
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getActionDisabled = (
  report: WastePredictionReport | null,
  status: Extract<WastePredictionStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

const joinLinked = (
  items: WastePredictionLinkedEntity[]
) => items.map(item => item.no || item.name).filter(Boolean).join(', ')

const joinAlternatives = (
  items: WastePredictionAlternative[]
) => items.map(item => item.name).filter(Boolean).join(', ')

const mapRowsForOutput = (
  rows: WastePredictionRow[]
) => rows.map(row => ({
  'Öneri No': row.item.predictionNo,
  'Rapor No': row.report.reportNo,
  'Öneri Türü': WASTE_PREDICTION_TYPE_LABELS[row.item.predictionType],
  Ürün: row.item.productName,
  Reçete: row.item.recipeName,
  Hat: row.item.productionLineName,
  Makine: [row.item.machineCode, row.item.machineName].filter(Boolean).join(' / '),
  Şube: row.item.branchName,
  Lot: row.item.lotNo,
  Tedarikçi: row.item.supplierName,
  'Beklenen Fire (%)': row.item.expectedWastePercent,
  'Beklenen Fire (Kg)': row.item.expectedWasteKg,
  'Beklenen Fire Maliyeti': row.item.expectedWasteCost,
  Risk: WASTE_PREDICTION_RISK_LABELS[row.item.risk],
  Öncelik: WASTE_PREDICTION_PRIORITY_LABELS[row.item.priority],
  Confidence: row.item.confidenceScore,
  'Risk Nedeni': row.item.riskReason,
  'Beklenen Tasarruf': row.item.expectedSaving,
  'Oluşturulma Tarihi': formatDateTime(row.item.createdAt),
  'Tahmin Gerekçesi': row.item.forecastReason,
  'Analiz Sonucu': row.item.analysisResult,
  'Risk Açıklaması': row.item.riskExplanation,
  'Etkilenen Üretim Emirleri': joinLinked(row.item.affectedProductionOrders),
  'Etkilenen Lotlar': joinLinked(row.item.affectedLots),
  'Alternatif Reçeteler': joinAlternatives(row.item.alternativeRecipes),
  'Alternatif Tedarikçiler': joinAlternatives(row.item.alternativeSuppliers),
  'Lot SKT': row.item.lotExpiryDate,
  'HACCP Kritik Noktası': row.item.haccpCriticalPoint
}))

const createFilteredOutputFileName = () => `fire-tahmini-filtreli-${new Date().toLocaleDateString('sv-SE')}.xlsx`

const exportFilteredRowsToExcel = (
  rows: WastePredictionRow[]
) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'waste-predictions',
    moduleLabel: 'Fire Tahmini',
    sheetName: 'Filtreli Liste',
    fileNamePrefix: 'fire-tahmini-filtreli',
    fileName: createFilteredOutputFileName(),
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const createFilteredPrintHtml = (
  rows: WastePredictionRow[],
  mode: 'A4' | 'PDF'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Fire Tahmini - Filtreli Liste</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:${PRINT_THEME_COLORS.text}; font-family:Inter, Arial, sans-serif; background:${PRINT_THEME_COLORS.pageBackground}; }
    .sheet { max-width:1280px; margin:0 auto; padding:22px; border:1px solid ${PRINT_THEME_COLORS.border}; border-radius:8px; background:${PRINT_THEME_COLORS.background}; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid ${PRINT_THEME_COLORS.text}; padding-bottom:14px; margin-bottom:16px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    .muted { color:${PRINT_THEME_COLORS.textMuted}; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid ${PRINT_THEME_COLORS.border}; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th, td { border:1px solid ${PRINT_THEME_COLORS.borderSoft}; padding:7px; text-align:left; vertical-align:top; }
    th { background:${PRINT_THEME_COLORS.tableHeader}; font-weight:900; }
    @media print {
      body { background:${PRINT_THEME_COLORS.background}; padding:0; }
      .sheet { border:0; border-radius:0; max-width:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Karar Destek Motoru</span>
        <h1>Fire Tahmini - Filtreli Liste</h1>
        <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : `${rows.length} tahmin`)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Öneri No</th><th>Öneri</th><th>Ürün</th><th>Reçete</th><th>Hat</th><th>Makine</th><th>Şube</th><th>Lot</th><th>Fire %</th><th>Fire Kg</th><th>Maliyet</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Risk Nedeni</th><th>Tasarruf</th><th>Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.item.predictionNo)}</td>
            <td>${escapeHtml(WASTE_PREDICTION_TYPE_LABELS[row.item.predictionType])}</td>
            <td>${escapeHtml(row.item.productName || '-')}</td>
            <td>${escapeHtml(row.item.recipeName || '-')}</td>
            <td>${escapeHtml(row.item.productionLineName || '-')}</td>
            <td>${escapeHtml([row.item.machineCode, row.item.machineName].filter(Boolean).join(' / ') || '-')}</td>
            <td>${escapeHtml(row.item.branchName || '-')}</td>
            <td>${escapeHtml(row.item.lotNo || '-')}</td>
            <td>${escapeHtml(formatPercent(row.item.expectedWastePercent))}</td>
            <td>${escapeHtml(`${formatNumber(row.item.expectedWasteKg, 1)} kg`)}</td>
            <td>${escapeHtml(formatCurrency(row.item.expectedWasteCost))}</td>
            <td>${escapeHtml(WASTE_PREDICTION_RISK_LABELS[row.item.risk])}</td>
            <td>${escapeHtml(WASTE_PREDICTION_PRIORITY_LABELS[row.item.priority])}</td>
            <td>${escapeHtml(formatNumber(row.item.confidenceScore, 1))}</td>
            <td>${escapeHtml(row.item.riskReason)}</td>
            <td>${escapeHtml(formatCurrency(row.item.expectedSaving))}</td>
            <td>${escapeHtml(formatDateTime(row.item.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

const openFilteredPrintWindow = (
  rows: WastePredictionRow[],
  mode: 'A4' | 'PDF'
) => {
  const printWindow = window.open('', '_blank', 'width=1280,height=860')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createFilteredPrintHtml(rows, mode))
  printWindow.document.close()
}

export default function WastePrediction({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<WastePredictionReport[]>(() => WastePredictionService.list(sourceData))
  const [filters, setFilters] = React.useState<WastePredictionFilters>(() => WastePredictionService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<WastePredictionReportCreateInput>(() => WastePredictionService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => WastePredictionService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<WastePredictionRow[]>(() => (
    filteredReports.flatMap(report => report.items.map(item => ({ report, item })))
  ), [filteredReports])
  const statistics = React.useMemo(() => WastePredictionService.statistics(filteredReports), [filteredReports])
  const selectedRow = rows.find(row => row.item.id === selectedItemId)
    || rows[0]
    || null
  const selectedReport = selectedRow
    ? reports.find(report => report.id === selectedRow.report.id) || selectedRow.report
    : reports[0] || null
  const branchOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.branchId, name: item.branchName || item.branchId })))
  ]), [reports, sourceData])
  const productOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productRefs.map(product => ({ id: product.id, name: product.name })),
    ...sourceData.stockItems.map(item => ({ id: item.id, name: item.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productId, name: item.productName || item.productId })))
  ]), [reports, sourceData])
  const recipeOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.recipeRecords.map(recipe => ({ id: recipe.id, name: `${recipe.code} / ${recipe.recipeName}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.recipeId, name: item.recipeName || item.recipeId })))
  ]), [reports, sourceData])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productionLineId, name: item.productionLineName || item.productionLineId })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode || item.machineId} / ${item.machineName || '-'}`
  })))), [reports])
  const lotOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.inventoryLots.map(lot => ({ id: lot.id, name: `${lot.lotNo} / ${lot.expiryDate}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.lotId, name: item.lotNo || item.lotId })))
  ]), [reports, sourceData])
  const supplierOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.suppliers.map(supplier => ({ id: supplier.id, name: supplier.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.supplierId, name: item.supplierName || item.supplierId })))
  ]), [reports, sourceData])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = WastePredictionService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof WastePredictionFilters>(key: TKey, value: WastePredictionFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof WastePredictionReportCreateInput>(key: TKey, value: WastePredictionReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = WastePredictionService.add(form, sourceData, userName)
      const firstItemId = report.items[0]?.id || ''
      refreshReports(firstItemId)
      setForm(WastePredictionService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} fire tahmin raporu oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fire tahmin raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<WastePredictionStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = WastePredictionService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${WASTE_PREDICTION_STATUS_LABELS[status]} durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fire tahmin durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<WastePredictionHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') WastePredictionPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') WastePredictionPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['waste-predictions'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = WastePredictionService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel çıktısı hazırlandı.`
          : `${report.reportNo} çıktı penceresi açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fire tahmin çıktısı alınamadı.' })
    }
  }

  const outputFilteredRows = (action: 'PRINTED' | 'PDF' | 'EXCEL') => {
    try{
      if(action === 'EXCEL') exportFilteredRowsToExcel(rows)
      if(action === 'PRINTED') openFilteredPrintWindow(rows, 'A4')
      if(action === 'PDF') openFilteredPrintWindow(rows, 'PDF')
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${formatNumber(rows.length)} satırlık filtreli liste Excel çıktısına aktarıldı.`
          : `${formatNumber(rows.length)} satırlık filtreli liste çıktı penceresinde açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Filtreli liste çıktısı alınamadı.' })
    }
  }

  return (
    <div className="waste-predictions-page">
      <div className="page-header">
        <div>
          <h2>Fire Tahmini</h2>
          <p className="muted">Karar Destek Motoru yalnızca tahmin, analiz ve öneri üretir; gerçek fire kaydı, stok düşümü, üretim planı değişikliği, muhasebe kaydı veya kalite kaydı oluşturmaz.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid waste-predictions-metric-grid">
        <div className="metric-card">
          <span>Tahmini Toplam Fire</span>
          <strong>{formatNumber(statistics.totalExpectedWasteKg, 1)} kg</strong>
          <small>{formatNumber(statistics.totalPredictions)} tahmin</small>
        </div>
        <div className="metric-card danger">
          <span>Beklenen Fire Maliyeti</span>
          <strong>{formatCurrency(statistics.expectedWasteCost)}</strong>
          <small>Filtrelenmiş liste</small>
        </div>
        <div className="metric-card warning">
          <span>En Riskli Ürün</span>
          <strong>{statistics.mostRiskyProductName}</strong>
          <small>Ürün bazlı fire tahmini</small>
        </div>
        <div className="metric-card warning">
          <span>En Riskli Hat</span>
          <strong>{statistics.mostRiskyLineName}</strong>
          <small>Hat bazlı fire dağılımı</small>
        </div>
        <div className="metric-card success">
          <span>Ortalama Fire Oranı</span>
          <strong>{formatPercent(statistics.averageWastePercent)}</strong>
          <small>{formatNumber(statistics.criticalScenarioCount)} kritik senaryo</small>
        </div>
        <div className="metric-card">
          <span>Güven Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Confidence ortalaması</small>
        </div>
      </div>

      <section className="card waste-predictions-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Tahmin Raporu</h3>
            <p className="muted">Üretim, reçete, stok, kalite, tedarikçi, kapasite, makine, personel, lot/SKT ve geçmiş fire sinyallerinden karar destek raporu üretir.</p>
          </div>
          <span className="status-pill warning-pill">Sadece öneri</span>
        </div>
        <div className="waste-predictions-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as WastePredictionReportCreateInput['scope'])}>
              <option value="all">Tüm Tahminler</option>
              {WASTE_PREDICTION_TYPES.map(type => <option key={type} value={type}>{WASTE_PREDICTION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field waste-predictions-wide">
            <span>Açıklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Opsiyonel rapor notu" />
          </label>
          <div className="waste-predictions-filter-actions">
            <button className="btn primary" type="button" onClick={createReport}>Tahmin Üret</button>
          </div>
        </div>
      </section>

      <section className="card waste-predictions-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler ve Çıktılar</h3>
            <p className="muted">Excel, PDF, yazdır ve filtrelenmiş liste çıktıları gerçek fire veya stok hareketi oluşturmaz.</p>
          </div>
          <div className="waste-predictions-filter-actions">
            <button className="btn" type="button" onClick={() => outputFilteredRows('EXCEL')}>Excel</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PDF')}>PDF</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PRINTED')}>Yazdır</button>
            <button className="btn" type="button" onClick={() => setFilters(WastePredictionService.createDefaultFilters())}>Temizle</button>
          </div>
        </div>
        <div className="waste-predictions-filter-grid">
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Ürün</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Ürünler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Reçete</span>
            <select value={filters.recipeId} onChange={event => updateFilter('recipeId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Reçeteler</option>
              {recipeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Hat</span>
            <select value={filters.productionLineId} onChange={event => updateFilter('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Hatlar</option>
              {lineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Makine</span>
            <select value={filters.machineId} onChange={event => updateFilter('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Makineler</option>
              {machineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Lotlar</option>
              {lotOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tedarikçi</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Tedarikçiler</option>
              {supplierOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as WastePredictionFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {WASTE_PREDICTION_RISKS.map(risk => <option key={risk} value={risk}>{WASTE_PREDICTION_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as WastePredictionFilters['priority'])}>
              <option value={ALL_FILTER}>Tüm Öncelikler</option>
              {WASTE_PREDICTION_PRIORITIES.map(priority => <option key={priority} value={priority}>{WASTE_PREDICTION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field waste-predictions-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Öneri no, ürün, reçete, hat, makine, lot, risk nedeni" />
          </label>
        </div>
      </section>

      <div className="waste-predictions-chart-grid">
        <BarChartCard title="Ürün Bazlı Fire Tahmini" rows={statistics.productWasteRows} />
        <BarChartCard title="Hat Bazlı Fire Dağılımı" rows={statistics.lineWasteRows} />
        <BarChartCard title="Makine Bazlı Fire" rows={statistics.machineWasteRows} />
        <BarChartCard title="Fire Maliyet Analizi" rows={statistics.costRows} />
        <LineChartCard series={statistics.wasteTrend} />
        <BarChartCard title="Tedarikçi Bazlı Fire" rows={statistics.supplierWasteRows} />
        <BarChartCard title="Lot Bazlı Fire" rows={statistics.lotWasteRows} />
        <BarChartCard title="Fire Sebep Analizi" rows={statistics.reasonRows} />
        <BarChartCard title="Beklenen Tasarruf" rows={statistics.expectedSavingRows} />
      </div>

      <div className="product-layout waste-predictions-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Satırlar karar destek çıktısıdır; gerçek fire, stok veya üretim planı kaydı otomatik oluşmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(rows.length)} tahmin</span>
          </div>
          <div className="table-wrap waste-predictions-table-wrap">
            <table className="data-table waste-predictions-table">
              <thead>
                <tr>
                  <th>Öneri No</th>
                  <th>Öneri Türü</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Hat</th>
                  <th>Makine</th>
                  <th>Şube</th>
                  <th>Lot</th>
                  <th>Beklenen Fire (%)</th>
                  <th>Beklenen Fire (Kg)</th>
                  <th>Beklenen Fire Maliyeti</th>
                  <th>Risk</th>
                  <th>Öncelik</th>
                  <th>Confidence</th>
                  <th>Risk Nedeni</th>
                  <th>Beklenen Tasarruf</th>
                  <th>Oluşturulma Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={17}>Filtrelere uygun fire tahmini bulunamadı.</td></tr>
                )}
                {rows.map(row => (
                  <tr
                    key={row.item.id}
                    aria-selected={selectedRow?.item.id === row.item.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedItemId(row.item.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedItemId(row.item.id)
                    }}
                  >
                    <td data-label="Öneri No"><strong>{row.item.predictionNo}</strong><span>{row.report.reportNo}</span></td>
                    <td data-label="Öneri Türü"><strong>{WASTE_PREDICTION_TYPE_LABELS[row.item.predictionType]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Ürün"><strong>{row.item.productName || '-'}</strong><span>{formatNumber(row.item.plannedQuantity, 1)} {row.item.unit}</span></td>
                    <td data-label="Reçete"><strong>{row.item.recipeName || '-'}</strong><span>{row.item.recipeCode || '-'}</span></td>
                    <td data-label="Hat"><strong>{row.item.productionLineName || '-'}</strong><span>{formatPercent(row.item.lineEfficiencyPercent)} verimlilik</span></td>
                    <td data-label="Makine"><strong>{[row.item.machineCode, row.item.machineName].filter(Boolean).join(' / ') || '-'}</strong><span>{formatPercent(row.item.machineUtilizationPercent)} kullanım</span></td>
                    <td data-label="Şube">{row.item.branchName || '-'}</td>
                    <td data-label="Lot"><strong>{row.item.lotNo || '-'}</strong><span>{row.item.lotExpiryDate ? `${formatDate(row.item.lotExpiryDate)} SKT` : '-'}</span></td>
                    <td data-label="Beklenen Fire (%)">{formatPercent(row.item.expectedWastePercent)}</td>
                    <td data-label="Beklenen Fire (Kg)">{formatNumber(row.item.expectedWasteKg, 1)} kg</td>
                    <td data-label="Beklenen Fire Maliyeti">{formatCurrency(row.item.expectedWasteCost)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{WASTE_PREDICTION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Öncelik"><span className={`status-pill ${getPriorityClass(row.item.priority)}`}>{WASTE_PREDICTION_PRIORITY_LABELS[row.item.priority]}</span></td>
                    <td data-label="Confidence">{formatNumber(row.item.confidenceScore, 1)}</td>
                    <td data-label="Risk Nedeni">{row.item.riskReason || '-'}</td>
                    <td data-label="Beklenen Tasarruf">{formatCurrency(row.item.expectedSaving)}</td>
                    <td data-label="Oluşturulma Tarihi">{formatDateTime(row.item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side waste-predictions-side">
          {selectedRow && selectedReport ? (
            <WastePredictionDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card waste-predictions-detail-card">
              <h3>Öneri Detayı</h3>
              <p className="muted">Detay görüntülemek için bir fire tahmini seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function WastePredictionDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: WastePredictionItem
  onOutput: (action: Extract<WastePredictionHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<WastePredictionStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: WastePredictionReport
}){
  return (
    <>
      <section className="card waste-predictions-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{item.predictionNo}</h3>
            <p className="muted">{WASTE_PREDICTION_TYPE_LABELS[item.predictionType]} / {item.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{WASTE_PREDICTION_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="waste-predictions-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdır</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="waste-predictions-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>İncele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arşivle</button>
        </div>

        <div className="waste-predictions-detail-grid">
          <div><span>Ürün</span><strong>{item.productName}</strong></div>
          <div><span>Reçete</span><strong>{item.recipeName || '-'}</strong></div>
          <div><span>Hat</span><strong>{item.productionLineName || '-'}</strong></div>
          <div><span>Makine</span><strong>{[item.machineCode, item.machineName].filter(Boolean).join(' / ') || '-'}</strong></div>
          <div><span>Şube</span><strong>{item.branchName || '-'}</strong></div>
          <div><span>Lot</span><strong>{item.lotNo || '-'}</strong></div>
          <div><span>Beklenen Fire</span><strong>{formatPercent(item.expectedWastePercent)} / {formatNumber(item.expectedWasteKg, 1)} kg</strong></div>
          <div><span>Fire Maliyeti</span><strong>{formatCurrency(item.expectedWasteCost)}</strong></div>
          <div><span>Risk</span><strong>{WASTE_PREDICTION_RISK_LABELS[item.risk]} ({formatNumber(item.riskScore, 1)})</strong></div>
          <div><span>Öncelik</span><strong>{WASTE_PREDICTION_PRIORITY_LABELS[item.priority]}</strong></div>
          <div><span>Confidence</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Beklenen Tasarruf</span><strong>{formatCurrency(item.expectedSaving)}</strong></div>
        </div>
      </section>

      <DetailTextCard title="Tahmin Gerekçesi" primary={item.forecastReason} secondary={item.action} />
      <DetailTextCard title="Analiz Sonucu" primary={item.analysisResult} secondary={`Kaynak modüller: ${item.sourceModules.join(', ')}`} />
      <DetailTextCard title="Risk Açıklaması" primary={item.riskExplanation} secondary={`${item.qualitySignal} / ${item.haccpCriticalPoint}`} />
      <DetailTextCard title="Beklenen Fire" primary={`${formatPercent(item.expectedWastePercent)} oran / ${formatNumber(item.expectedWasteKg, 1)} kg`} secondary={`Planlanan miktar: ${formatNumber(item.plannedQuantity, 1)} ${item.unit} / Birim maliyet: ${formatCurrency(item.unitCost)}`} />
      <DetailTextCard title="Beklenen Fire Maliyeti" primary={formatCurrency(item.expectedWasteCost)} secondary={item.expectedImpact} />
      <DetailTextCard title="Beklenen Tasarruf" primary={formatCurrency(item.expectedSaving)} secondary="Bu tahmin stok düşümü veya muhasebe kaydı oluşturmaz." />
      <LinkedEntityCard title="Etkilenen Üretim Emirleri" items={item.affectedProductionOrders} emptyText="Üretim emri bağlantısı yok." />
      <LinkedEntityCard title="Etkilenen Lotlar" items={item.affectedLots} emptyText="Lot bağlantısı yok." />
      <AlternativeCard title="Alternatif Reçeteler" items={item.alternativeRecipes} />
      <AlternativeCard title="Alternatif Tedarikçiler" items={item.alternativeSuppliers} />

      <section className="card waste-predictions-detail-card">
        <h3>İşlem Geçmişi</h3>
        <div className="waste-predictions-history-list">
          {[...report.history].reverse().map(history => (
            <div key={history.id}>
              <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
              <span>{formatDateTime(history.createdAt)} / Rev {history.revisionNo}</span>
              <p>{history.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function DetailTextCard({
  primary,
  secondary,
  title
}: {
  primary: string
  secondary?: string
  title: string
}){
  return (
    <section className="card waste-predictions-detail-card">
      <h3>{title}</h3>
      <p className="waste-predictions-notes">{primary || '-'}</p>
      {secondary && <p className="waste-predictions-notes muted-note">{secondary}</p>}
    </section>
  )
}

function LinkedEntityCard({
  emptyText,
  items,
  title
}: {
  emptyText: string
  items: WastePredictionLinkedEntity[]
  title: string
}){
  return (
    <section className="card waste-predictions-detail-card">
      <h3>{title}</h3>
      <div className="waste-predictions-module-list">
        {items.length === 0 && <div><strong>{emptyText}</strong><span>-</span></div>}
        {items.map(item => (
          <div key={`${item.id}:${item.no}:${item.name}`}>
            <strong>{item.no || item.name}</strong>
            <span>{item.name}{item.detail ? ` / ${item.detail}` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function AlternativeCard({
  items,
  title
}: {
  items: WastePredictionAlternative[]
  title: string
}){
  return (
    <section className="card waste-predictions-detail-card">
      <h3>{title}</h3>
      <div className="waste-predictions-module-list">
        {items.length === 0 && <div><strong>Alternatif bulunamadı.</strong><span>-</span></div>}
        {items.map(item => (
          <div key={item.id}>
            <strong>{item.code ? `${item.code} / ${item.name}` : item.name}</strong>
            <span>{formatNumber(item.score, 1)} skor / {formatPercent(item.expectedWastePercent)} beklenen fire / {formatCurrency(item.expectedSaving)} tasarruf / {item.reason}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kırılım</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayıt bulunamadı.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{formatNumber(series.points.length)} gün</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.map(point => (
          <div className="kpi-line-point" key={point.dateKey}>
            <span style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%`, background: series.color }} />
            <strong>{formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
