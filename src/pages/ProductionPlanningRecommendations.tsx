import React from 'react'
import * as XLSX from 'xlsx'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { ProductionPlanningRecommendationPrintService } from '../production-planning-recommendations/production-planning-recommendation-print.service'
import {
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES,
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISKS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPES,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS,
  ProductionPlanningRecommendationService
} from '../production-planning-recommendations/production-planning-recommendation.service'
import type {
  ProductionPlanningRecommendationAlternative,
  ProductionPlanningRecommendationFilters,
  ProductionPlanningRecommendationHistoryAction,
  ProductionPlanningRecommendationItem,
  ProductionPlanningRecommendationLinkedEntity,
  ProductionPlanningRecommendationPriority,
  ProductionPlanningRecommendationReport,
  ProductionPlanningRecommendationReportCreateInput,
  ProductionPlanningRecommendationRisk,
  ProductionPlanningRecommendationStatus
} from '../production-planning-recommendations/production-planning-recommendation.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type ProductionPlanningRecommendationRow = {
  report: ProductionPlanningRecommendationReport
  item: ProductionPlanningRecommendationItem
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

const getRiskClass = (risk: ProductionPlanningRecommendationRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: ProductionPlanningRecommendationPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: ProductionPlanningRecommendationStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: ProductionPlanningRecommendationHistoryAction) => {
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
  report: ProductionPlanningRecommendationReport | null,
  status: Extract<ProductionPlanningRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

const joinLinked = (
  items: ProductionPlanningRecommendationLinkedEntity[]
) => items.map(item => item.no || item.name).filter(Boolean).join(', ')

const joinAlternatives = (
  items: ProductionPlanningRecommendationAlternative[]
) => items.map(item => item.name).filter(Boolean).join(', ')

const mapRowsForOutput = (
  rows: ProductionPlanningRecommendationRow[]
) => rows.map(row => ({
  'Öneri No': row.item.recommendationNo,
  'Rapor No': row.report.reportNo,
  'Öneri Türü': PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType],
  'Üretim Emri': row.item.workOrderNo,
  Ürün: row.item.productName,
  Reçete: row.item.recipeName,
  Hat: row.item.productionLineName,
  Makine: [row.item.machineCode, row.item.machineName].filter(Boolean).join(' / '),
  Şube: row.item.branchName,
  'Planlanan Başlangıç': formatDateTime(row.item.plannedStartAt),
  'Planlanan Bitiş': formatDateTime(row.item.plannedEndAt),
  Risk: PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[row.item.risk],
  Öncelik: PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[row.item.priority],
  Confidence: row.item.confidenceScore,
  'Beklenen Kazanç': row.item.expectedGain,
  'Kazanılacak Süre': row.item.expectedTimeGainMinutes,
  'Etkilenen İş Emirleri': joinLinked(row.item.affectedWorkOrders),
  'Oluşturulma Tarihi': formatDateTime(row.item.createdAt),
  Gerekçe: row.item.reason,
  'Analiz Sonucu': row.item.analysisResult,
  'Risk Açıklaması': row.item.riskExplanation,
  'Etkilenen Makineler': joinLinked(row.item.affectedMachines),
  'Etkilenen Personel': joinLinked(row.item.affectedPersonnel),
  'Alternatif Hatlar': joinAlternatives(row.item.alternativeLines),
  'Alternatif Makineler': joinAlternatives(row.item.alternativeMachines),
  'Lot / SKT': row.item.lotSktSummary,
  'HACCP Kritik Noktası': row.item.haccpCriticalPoint
}))

const createFilteredOutputFileName = () => `uretim-planlama-onerileri-filtreli-${new Date().toLocaleDateString('sv-SE')}.xlsx`

const exportFilteredRowsToExcel = (
  rows: ProductionPlanningRecommendationRow[]
) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(mapRowsForOutput(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtreli Liste')
  XLSX.writeFile(workbook, createFilteredOutputFileName())
}

const createFilteredPrintHtml = (
  rows: ProductionPlanningRecommendationRow[],
  mode: 'A4' | 'PDF'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Üretim Planlama Önerileri - Filtreli Liste</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1280px; margin:0 auto; padding:22px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:14px; margin-bottom:16px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th, td { border:1px solid #e5e7eb; padding:7px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    @media print {
      body { background:#fff; padding:0; }
      .sheet { border:0; border-radius:0; max-width:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Karar Destek Motoru</span>
        <h1>Üretim Planlama Önerileri - Filtreli Liste</h1>
        <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : `${rows.length} öneri`)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Öneri No</th><th>Tür</th><th>Üretim Emri</th><th>Ürün</th><th>Reçete</th><th>Hat</th><th>Makine</th><th>Şube</th><th>Başlangıç</th><th>Bitiş</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Kazanç</th><th>Süre</th><th>Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.item.recommendationNo)}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType])}</td>
            <td>${escapeHtml(row.item.workOrderNo || '-')}</td>
            <td>${escapeHtml(row.item.productName || '-')}</td>
            <td>${escapeHtml(row.item.recipeName || '-')}</td>
            <td>${escapeHtml(row.item.productionLineName || '-')}</td>
            <td>${escapeHtml([row.item.machineCode, row.item.machineName].filter(Boolean).join(' / ') || '-')}</td>
            <td>${escapeHtml(row.item.branchName || '-')}</td>
            <td>${escapeHtml(formatDateTime(row.item.plannedStartAt))}</td>
            <td>${escapeHtml(formatDateTime(row.item.plannedEndAt))}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[row.item.risk])}</td>
            <td>${escapeHtml(PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[row.item.priority])}</td>
            <td>${escapeHtml(formatNumber(row.item.confidenceScore, 1))}</td>
            <td>${escapeHtml(row.item.expectedGain)}</td>
            <td>${escapeHtml(`${formatNumber(row.item.expectedTimeGainMinutes, 0)} dk`)}</td>
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
  rows: ProductionPlanningRecommendationRow[],
  mode: 'A4' | 'PDF'
) => {
  const printWindow = window.open('', '_blank', 'width=1280,height=860')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createFilteredPrintHtml(rows, mode))
  printWindow.document.close()
}

export default function ProductionPlanningRecommendations({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<ProductionPlanningRecommendationReport[]>(() => ProductionPlanningRecommendationService.list(sourceData))
  const [filters, setFilters] = React.useState<ProductionPlanningRecommendationFilters>(() => ProductionPlanningRecommendationService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<ProductionPlanningRecommendationReportCreateInput>(() => ProductionPlanningRecommendationService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => ProductionPlanningRecommendationService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<ProductionPlanningRecommendationRow[]>(() => (
    filteredReports.flatMap(report => report.items.map(item => ({ report, item })))
  ), [filteredReports])
  const statistics = React.useMemo(() => ProductionPlanningRecommendationService.statistics(filteredReports), [filteredReports])
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
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productionLineId, name: item.productionLineName || item.productionLineId })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode || item.machineId} / ${item.machineName || '-'}`
  })))), [reports])
  const productOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productRefs.map(product => ({ id: product.id, name: product.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productId, name: item.productName || item.productId })))
  ]), [reports, sourceData])
  const recipeOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.recipeRecords.map(recipe => ({ id: recipe.id, name: `${recipe.code} / ${recipe.recipeName}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.recipeId, name: item.recipeName || item.recipeId })))
  ]), [reports, sourceData])
  const workOrderOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionOrders.map(order => ({ id: order.id, name: order.workOrderNo })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.workOrderId, name: item.workOrderNo || item.workOrderId })))
  ]), [reports, sourceData])
  const employeeOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.employeeId,
    name: item.employeeName || item.employeeId
  })))), [reports])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = ProductionPlanningRecommendationService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof ProductionPlanningRecommendationFilters>(key: TKey, value: ProductionPlanningRecommendationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof ProductionPlanningRecommendationReportCreateInput>(key: TKey, value: ProductionPlanningRecommendationReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = ProductionPlanningRecommendationService.add(form, sourceData, userName)
      const firstItemId = report.items[0]?.id || ''
      refreshReports(firstItemId)
      setForm(ProductionPlanningRecommendationService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} üretim planlama öneri raporu oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Üretim planlama öneri raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<ProductionPlanningRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = ProductionPlanningRecommendationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS[status]} durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Üretim planlama öneri durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ProductionPlanningRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') ProductionPlanningRecommendationPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') ProductionPlanningRecommendationPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['production-planning-recommendations'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = ProductionPlanningRecommendationService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel çıktısı hazırlandı.`
          : `${report.reportNo} çıktı penceresi açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Üretim planlama öneri çıktısı alınamadı.' })
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
    <div className="production-planning-recommendations-page">
      <div className="page-header">
        <div>
          <h2>Üretim Planlama Önerileri</h2>
          <p className="muted">Karar Destek Motoru yalnızca analiz ve öneri üretir; üretim emri, üretim planı, vardiya, makine planı, stok hareketi veya muhasebe kaydı oluşturmaz.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid production-planning-recommendations-metric-grid">
        <div className="metric-card">
          <span>Toplam Üretim Önerisi</span>
          <strong>{formatNumber(statistics.totalRecommendations)}</strong>
          <small>Filtrelenmiş liste</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Darboğaz</span>
          <strong>{formatNumber(statistics.criticalBottlenecks)}</strong>
          <small>CRITICAL darboğaz</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Kapasite Kazancı</span>
          <strong>{formatPercent(statistics.expectedCapacityGainPercent)}</strong>
          <small>{formatNumber(statistics.expectedCapacityGainMinutes, 0)} dk kapasite</small>
        </div>
        <div className="metric-card warning">
          <span>Geciken Üretim Sayısı</span>
          <strong>{formatNumber(statistics.delayedProductionCount)}</strong>
          <small>Erteleme / bekleme / durdurma</small>
        </div>
        <div className="metric-card">
          <span>Ortalama Hat Verimliliği</span>
          <strong>{formatPercent(statistics.averageLineEfficiency)}</strong>
          <small>Öneri sonrası hedef</small>
        </div>
        <div className="metric-card success">
          <span>Güven Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Confidence ortalaması</small>
        </div>
      </div>

      <section className="card production-planning-recommendations-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Analiz Raporu</h3>
            <p className="muted">Read-model kaynaklarından manuel karar desteği raporu üretir; gerçek üretim planını değiştirmez.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Oluştur</button>
        </div>
        <div className="production-planning-recommendations-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as ProductionPlanningRecommendationReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tüm Öneriler</option>
              {PRODUCTION_PLANNING_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field production-planning-recommendations-wide">
            <span>Açıklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Üretim planlama analiz notu" />
          </label>
        </div>
      </section>

      <section className="card production-planning-recommendations-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} üretim planlama önerisi listeleniyor.</p>
          </div>
          <div className="production-planning-recommendations-filter-actions">
            <button className="btn" type="button" onClick={() => outputFilteredRows('EXCEL')}>Filtreli Excel</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PDF')}>Filtreli PDF</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PRINTED')}>Filtreli Yazdır</button>
            <button className="btn" type="button" onClick={() => setFilters(ProductionPlanningRecommendationService.createDefaultFilters())}>Sıfırla</button>
          </div>
        </div>
        <div className="production-planning-recommendations-filter-grid">
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Üretim Emri</span>
            <select value={filters.workOrderId} onChange={event => updateFilter('workOrderId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Emirler</option>
              {workOrderOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as ProductionPlanningRecommendationFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {PRODUCTION_PLANNING_RECOMMENDATION_RISKS.map(risk => <option key={risk} value={risk}>{PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as ProductionPlanningRecommendationFilters['priority'])}>
              <option value={ALL_FILTER}>Tüm Öncelikler</option>
              {PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öneri Türü</span>
            <select value={filters.recommendationType} onChange={event => updateFilter('recommendationType', event.target.value as ProductionPlanningRecommendationFilters['recommendationType'])}>
              <option value={ALL_FILTER}>Tüm Türler</option>
              {PRODUCTION_PLANNING_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Personel</span>
            <select value={filters.employeeId} onChange={event => updateFilter('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Personel</option>
              {employeeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field production-planning-recommendations-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Öneri no, üretim emri, ürün, reçete, hat, makine, gerekçe" />
          </label>
        </div>
      </section>

      <div className="production-planning-recommendations-chart-grid">
        <BarChartCard title="Hat Bazlı Doluluk" rows={statistics.lineOccupancyRows} />
        <BarChartCard title="Makine Kullanım Oranı" rows={statistics.machineUtilizationRows} />
        <BarChartCard title="Kapasite Dağılımı" rows={statistics.capacityDistributionRows} />
        <BarChartCard title="Darboğaz Analizi" rows={statistics.bottleneckRows} />
        <BarChartCard title="Ürün Bazlı Üretim" rows={statistics.productProductionRows} />
        <LineChartCard series={statistics.dailyTrend} />
        <BarChartCard title="Beklenen Kapasite Kazancı" rows={statistics.expectedCapacityGainRows} />
        <BarChartCard title="Setup Süresi Kazancı" rows={statistics.setupGainRows} />
        <BarChartCard title="Fire Azalış Tahmini" rows={statistics.wasteReductionRows} />
      </div>

      <div className="product-layout production-planning-recommendations-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Satırlar karar destek çıktısıdır; gerçek üretim planı üzerinde otomatik değişiklik yapılmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.criticalBottlenecks)} kritik darboğaz</span>
          </div>
          <div className="table-wrap production-planning-recommendations-table-wrap">
            <table className="data-table production-planning-recommendations-table">
              <thead>
                <tr>
                  <th>Öneri No</th>
                  <th>Öneri Türü</th>
                  <th>Üretim Emri</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Hat</th>
                  <th>Makine</th>
                  <th>Şube</th>
                  <th>Planlanan Başlangıç</th>
                  <th>Planlanan Bitiş</th>
                  <th>Risk</th>
                  <th>Öncelik</th>
                  <th>Confidence</th>
                  <th>Beklenen Kazanç</th>
                  <th>Kazanılacak Süre</th>
                  <th>Etkilenen İş Emirleri</th>
                  <th>Oluşturulma Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={17}>Filtrelere uygun üretim planlama önerisi bulunamadı.</td></tr>
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
                    <td data-label="Öneri No"><strong>{row.item.recommendationNo}</strong><span>{row.report.reportNo}</span></td>
                    <td data-label="Öneri Türü"><strong>{PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Üretim Emri"><strong>{row.item.workOrderNo || '-'}</strong><span>{row.item.sourceNo}</span></td>
                    <td data-label="Ürün"><strong>{row.item.productName || '-'}</strong><span>{formatNumber(row.item.plannedQuantity, 1)} {row.item.unit}</span></td>
                    <td data-label="Reçete">{row.item.recipeName || '-'}</td>
                    <td data-label="Hat"><strong>{row.item.productionLineName || '-'}</strong><span>{formatPercent(row.item.currentLineUtilizationPercent)} doluluk</span></td>
                    <td data-label="Makine"><strong>{[row.item.machineCode, row.item.machineName].filter(Boolean).join(' / ') || '-'}</strong><span>{formatPercent(row.item.currentMachineUtilizationPercent)} kullanım</span></td>
                    <td data-label="Şube">{row.item.branchName || '-'}</td>
                    <td data-label="Planlanan Başlangıç">{formatDateTime(row.item.plannedStartAt)}</td>
                    <td data-label="Planlanan Bitiş">{formatDateTime(row.item.plannedEndAt)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Öncelik"><span className={`status-pill ${getPriorityClass(row.item.priority)}`}>{PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[row.item.priority]}</span></td>
                    <td data-label="Confidence">{formatNumber(row.item.confidenceScore, 1)}</td>
                    <td data-label="Beklenen Kazanç">{row.item.expectedGain}</td>
                    <td data-label="Kazanılacak Süre">{formatNumber(row.item.expectedTimeGainMinutes, 0)} dk</td>
                    <td data-label="Etkilenen İş Emirleri">{joinLinked(row.item.affectedWorkOrders) || '-'}</td>
                    <td data-label="Oluşturulma Tarihi">{formatDateTime(row.item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side production-planning-recommendations-side">
          {selectedRow && selectedReport ? (
            <ProductionPlanningRecommendationDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card production-planning-recommendations-detail-card">
              <h3>Öneri Detayı</h3>
              <p className="muted">Detay görüntülemek için bir üretim planlama önerisi seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ProductionPlanningRecommendationDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: ProductionPlanningRecommendationItem
  onOutput: (action: Extract<ProductionPlanningRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<ProductionPlanningRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: ProductionPlanningRecommendationReport
}){
  return (
    <>
      <section className="card production-planning-recommendations-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{item.recommendationNo}</h3>
            <p className="muted">{PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[item.recommendationType]} / {item.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="production-planning-recommendations-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdır</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="production-planning-recommendations-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>İncele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arşivle</button>
        </div>

        <div className="production-planning-recommendations-detail-grid">
          <div><span>Üretim Emri</span><strong>{item.workOrderNo || '-'}</strong></div>
          <div><span>Ürün</span><strong>{item.productName}</strong></div>
          <div><span>Reçete</span><strong>{item.recipeName || '-'}</strong></div>
          <div><span>Hat</span><strong>{item.productionLineName || '-'}</strong></div>
          <div><span>Makine</span><strong>{[item.machineCode, item.machineName].filter(Boolean).join(' / ') || '-'}</strong></div>
          <div><span>Şube</span><strong>{item.branchName || '-'}</strong></div>
          <div><span>Planlanan Başlangıç</span><strong>{formatDateTime(item.plannedStartAt)}</strong></div>
          <div><span>Planlanan Bitiş</span><strong>{formatDateTime(item.plannedEndAt)}</strong></div>
          <div><span>Risk</span><strong>{PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[item.risk]} ({formatNumber(item.riskScore, 1)})</strong></div>
          <div><span>Öncelik</span><strong>{PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[item.priority]}</strong></div>
          <div><span>Confidence</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Kapasite Kazancı</span><strong>{formatPercent(item.expectedCapacityGainPercent)} / {formatNumber(item.expectedCapacityGainMinutes, 0)} dk</strong></div>
        </div>
      </section>

      <DetailTextCard title="Gerekçe" primary={item.reason} secondary={item.action} />
      <DetailTextCard title="Analiz Sonucu" primary={item.analysisResult} secondary={`Kaynak modüller: ${item.sourceModules.join(', ')}`} />
      <DetailTextCard title="Risk Açıklaması" primary={item.riskExplanation} secondary={`${item.lotSktSummary} / ${item.haccpCriticalPoint}`} />
      <DetailTextCard title="Beklenen Kazanç" primary={item.expectedGain} secondary={item.expectedImpact} />
      <DetailTextCard title="Kazanılacak Süre" primary={`${formatNumber(item.expectedTimeGainMinutes, 0)} dk süre kazancı`} secondary={`Setup: ${formatNumber(item.setupTimeGainMinutes, 0)} dk / Fire azalışı: ${formatPercent(item.wasteReductionPercent)}`} />
      <LinkedEntityCard title="Etkilenen Üretim Emirleri" items={item.affectedWorkOrders} emptyText="Üretim emri bağlantısı yok." />
      <LinkedEntityCard title="Etkilenen Makineler" items={item.affectedMachines} emptyText="Makine bağlantısı yok." />
      <LinkedEntityCard title="Etkilenen Personel" items={item.affectedPersonnel} emptyText="Personel bağlantısı yok." />
      <AlternativeCard title="Alternatif Hatlar" items={item.alternativeLines} />
      <AlternativeCard title="Alternatif Makineler" items={item.alternativeMachines} />

      <section className="card production-planning-recommendations-detail-card">
        <h3>İşlem Geçmişi</h3>
        <div className="production-planning-recommendations-history-list">
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
    <section className="card production-planning-recommendations-detail-card">
      <h3>{title}</h3>
      <p className="production-planning-recommendations-notes">{primary || '-'}</p>
      {secondary && <p className="production-planning-recommendations-notes muted-note">{secondary}</p>}
    </section>
  )
}

function LinkedEntityCard({
  emptyText,
  items,
  title
}: {
  emptyText: string
  items: ProductionPlanningRecommendationLinkedEntity[]
  title: string
}){
  return (
    <section className="card production-planning-recommendations-detail-card">
      <h3>{title}</h3>
      <div className="production-planning-recommendations-module-list">
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
  items: ProductionPlanningRecommendationAlternative[]
  title: string
}){
  return (
    <section className="card production-planning-recommendations-detail-card">
      <h3>{title}</h3>
      <div className="production-planning-recommendations-module-list">
        {items.length === 0 && <div><strong>Alternatif bulunamadı.</strong><span>-</span></div>}
        {items.map(item => (
          <div key={item.id}>
            <strong>{item.code ? `${item.code} / ${item.name}` : item.name}</strong>
            <span>{formatPercent(item.currentUtilizationPercent)} mevcut / {formatPercent(item.expectedUtilizationPercent)} hedef / {formatNumber(item.availableMinutes, 0)} dk uygun / {item.reason}</span>
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
            <strong>{formatNumber(point.value)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
