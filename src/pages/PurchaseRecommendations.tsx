import React from 'react'
import * as XLSX from 'xlsx'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber
} from '../kpi-reporting/kpi.utils'
import { getDecisionSourceModuleLabel } from '../decision-support/decision-support-ui.utils'
import { PurchaseRecommendationPrintService } from '../purchase-recommendations/purchase-recommendation-print.service'
import {
  PURCHASE_RECOMMENDATION_PRIORITIES,
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISKS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_STATUS_LABELS,
  PURCHASE_RECOMMENDATION_TYPES,
  PURCHASE_RECOMMENDATION_TYPE_LABELS,
  PurchaseRecommendationService
} from '../purchase-recommendations/purchase-recommendation.service'
import type {
  PurchaseRecommendationFilters,
  PurchaseRecommendationHistoryAction,
  PurchaseRecommendationItem,
  PurchaseRecommendationLinkedEntity,
  PurchaseRecommendationPriority,
  PurchaseRecommendationReport,
  PurchaseRecommendationReportCreateInput,
  PurchaseRecommendationRisk,
  PurchaseRecommendationStatus,
  PurchaseRecommendationSupplierOption
} from '../purchase-recommendations/purchase-recommendation.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type PurchaseRecommendationRow = {
  report: PurchaseRecommendationReport
  item: PurchaseRecommendationItem
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

const getRiskClass = (risk: PurchaseRecommendationRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: PurchaseRecommendationPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: PurchaseRecommendationStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: PurchaseRecommendationHistoryAction) => {
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
  report: PurchaseRecommendationReport | null,
  status: Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

const mapRowsForOutput = (rows: PurchaseRecommendationRow[]) => rows.map(row => ({
  'Öneri No': row.item.recommendationNo,
  'Rapor No': row.report.reportNo,
  'Öneri Türü': PURCHASE_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType],
  Ürün: row.item.stockItemName || row.item.productName || row.item.relatedEntityName,
  Kategori: row.item.categoryName,
  Depo: row.item.warehouseName,
  Şube: row.item.branchName,
  Tedarikçi: row.item.supplierName,
  'Alternatif Tedarikçi': row.item.alternativeSupplierName || row.item.alternativeSuppliers.map(option => option.supplierName).join(', '),
  'Önerilen Miktar': row.item.recommendedOrderQuantity,
  Risk: PURCHASE_RECOMMENDATION_RISK_LABELS[row.item.risk],
  Öncelik: PURCHASE_RECOMMENDATION_PRIORITY_LABELS[row.item.priority],
  Confidence: row.item.confidenceScore,
  'Beklenen Tasarruf': row.item.expectedSaving,
  'Oluşturulma Tarihi': formatDateTime(row.item.createdAt),
  Gerekçe: row.item.reason,
  'Analiz Sonucu': row.item.analysisResult,
  'Risk Açıklaması': row.item.riskExplanation,
  'Beklenen Kazanç': row.item.expectedGain
}))

const createFilteredOutputFileName = () => `satin-alma-onerileri-filtreli-${new Date().toLocaleDateString('sv-SE')}.xlsx`

const exportFilteredRowsToExcel = (rows: PurchaseRecommendationRow[]) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(mapRowsForOutput(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtreli Liste')
  XLSX.writeFile(workbook, createFilteredOutputFileName())
}

const createFilteredPrintHtml = (
  rows: PurchaseRecommendationRow[],
  mode: 'A4' | 'PDF'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Satın Alma Önerileri - Filtreli Liste</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1180px; margin:0 auto; padding:22px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:14px; margin-bottom:16px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
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
        <h1>Satın Alma Önerileri - Filtreli Liste</h1>
        <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : `${rows.length} öneri`)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Öneri No</th><th>Tür</th><th>Ürün</th><th>Depo</th><th>Şube</th><th>Tedarikçi</th><th>Miktar</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Tasarruf</th><th>Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.item.recommendationNo)}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType])}</td>
            <td>${escapeHtml(row.item.stockItemName || row.item.productName || row.item.relatedEntityName)}</td>
            <td>${escapeHtml(row.item.warehouseName || '-')}</td>
            <td>${escapeHtml(row.item.branchName || '-')}</td>
            <td>${escapeHtml(row.item.supplierName || row.item.alternativeSupplierName || '-')}</td>
            <td>${escapeHtml(formatNumber(row.item.recommendedOrderQuantity, 2))}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_RISK_LABELS[row.item.risk])}</td>
            <td>${escapeHtml(PURCHASE_RECOMMENDATION_PRIORITY_LABELS[row.item.priority])}</td>
            <td>${escapeHtml(formatNumber(row.item.confidenceScore, 1))}</td>
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
  rows: PurchaseRecommendationRow[],
  mode: 'A4' | 'PDF'
) => {
  const printWindow = window.open('', '_blank', 'width=1180,height=840')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createFilteredPrintHtml(rows, mode))
  printWindow.document.close()
}

export default function PurchaseRecommendations({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<PurchaseRecommendationReport[]>(() => PurchaseRecommendationService.list(sourceData))
  const [filters, setFilters] = React.useState<PurchaseRecommendationFilters>(() => PurchaseRecommendationService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<PurchaseRecommendationReportCreateInput>(() => PurchaseRecommendationService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => PurchaseRecommendationService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<PurchaseRecommendationRow[]>(() => (
    filteredReports.flatMap(report => report.items.map(item => ({ report, item })))
  ), [filteredReports])
  const statistics = React.useMemo(() => PurchaseRecommendationService.statistics(filteredReports), [filteredReports])
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
  const warehouseOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.warehouseId, name: item.warehouseName || item.warehouseId })))
  ]), [reports, sourceData])
  const categoryOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.categoryId,
    name: item.categoryName || item.categoryId
  })))), [reports])
  const productOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productRefs.map(product => ({ id: product.id, name: product.name })),
    ...sourceData.stockItems.map(item => ({ id: item.id, name: item.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.stockItemId || item.productId, name: item.stockItemName || item.productName || item.relatedEntityName })))
  ]), [reports, sourceData])
  const supplierOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.suppliers.map(supplier => ({ id: supplier.id, name: supplier.name })),
    ...reports.flatMap(report => report.items.flatMap(item => [
      { id: item.supplierId, name: item.supplierName || item.supplierId },
      { id: item.alternativeSupplierId, name: item.alternativeSupplierName || item.alternativeSupplierId },
      ...item.alternativeSuppliers.map(option => ({ id: option.supplierId, name: option.supplierName }))
    ]))
  ]), [reports, sourceData])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = PurchaseRecommendationService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof PurchaseRecommendationFilters>(key: TKey, value: PurchaseRecommendationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof PurchaseRecommendationReportCreateInput>(key: TKey, value: PurchaseRecommendationReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = PurchaseRecommendationService.add(form, sourceData, userName)
      const firstItemId = report.items[0]?.id || ''
      refreshReports(firstItemId)
      setForm(PurchaseRecommendationService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} satın alma öneri raporu oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Satın alma öneri raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = PurchaseRecommendationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${PURCHASE_RECOMMENDATION_STATUS_LABELS[status]} durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Satın alma öneri durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<PurchaseRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') PurchaseRecommendationPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') PurchaseRecommendationPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['purchase-recommendations'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = PurchaseRecommendationService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel çıktısı hazırlandı.`
          : `${report.reportNo} çıktı penceresi açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Satın alma öneri çıktısı alınamadı.' })
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
    <div className="purchase-recommendations-page">
      <div className="page-header">
        <div>
          <h2>Satın Alma Önerileri</h2>
          <p className="muted">Karar Destek Motoru yalnızca analiz ve öneri üretir; satın alma talebi, siparişi, stok hareketi veya muhasebe kaydı oluşturmaz.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid purchase-recommendations-metric-grid">
        <div className="metric-card">
          <span>Toplam Satın Alma Önerisi</span>
          <strong>{formatNumber(statistics.totalRecommendations)}</strong>
          <small>Filtrelenmiş liste</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Satın Alma</span>
          <strong>{formatNumber(statistics.criticalPurchases)}</strong>
          <small>Kritik risk veya acil öncelik</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Tasarruf</span>
          <strong>{formatCurrency(statistics.expectedSaving)}</strong>
          <small>{formatNumber(statistics.expectedSavingRows.length)} tasarruf kırılımı</small>
        </div>
        <div className="metric-card warning">
          <span>Alternatif Tedarikçi Sayısı</span>
          <strong>{formatNumber(statistics.alternativeSupplierCount)}</strong>
          <small>Aktif alternatifler</small>
        </div>
        <div className="metric-card">
          <span>Ortalama Risk</span>
          <strong>{formatNumber(statistics.averageRiskScore, 1)}</strong>
          <small>100 üzerinden</small>
        </div>
        <div className="metric-card success">
          <span>Confidence Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Ortalama güven</small>
        </div>
      </div>

      <section className="card purchase-recommendations-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Analiz Raporu</h3>
            <p className="muted">Read-model kaynaklarından manuel karar desteği raporu üretir.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Oluştur</button>
        </div>
        <div className="purchase-recommendations-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as PurchaseRecommendationReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tüm Öneriler</option>
              {PURCHASE_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PURCHASE_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field purchase-recommendations-wide">
            <span>Açıklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Satın alma analiz notu" />
          </label>
        </div>
      </section>

      <section className="card purchase-recommendations-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} satın alma önerisi listeleniyor.</p>
          </div>
          <div className="purchase-recommendations-filter-actions">
            <button className="btn" type="button" onClick={() => outputFilteredRows('EXCEL')}>Filtreli Excel</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PDF')}>Filtreli PDF</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PRINTED')}>Filtreli Yazdır</button>
            <button className="btn" type="button" onClick={() => setFilters(PurchaseRecommendationService.createDefaultFilters())}>Sıfırla</button>
          </div>
        </div>
        <div className="purchase-recommendations-filter-grid">
          <label className="form-field">
            <span>Öneri Türü</span>
            <select value={filters.recommendationType} onChange={event => updateFilter('recommendationType', event.target.value as PurchaseRecommendationFilters['recommendationType'])}>
              <option value={ALL_FILTER}>Tüm Türler</option>
              {PURCHASE_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PURCHASE_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as PurchaseRecommendationFilters['priority'])}>
              <option value={ALL_FILTER}>Tüm Öncelikler</option>
              {PURCHASE_RECOMMENDATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{PURCHASE_RECOMMENDATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as PurchaseRecommendationFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {PURCHASE_RECOMMENDATION_RISKS.map(risk => <option key={risk} value={risk}>{PURCHASE_RECOMMENDATION_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.categoryId} onChange={event => updateFilter('categoryId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Kategoriler</option>
              {categoryOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Tedarikçi</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Tedarikçiler</option>
              {supplierOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field purchase-recommendations-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Öneri no, ürün, tedarikçi, gerekçe veya analiz sonucu" />
          </label>
        </div>
      </section>

      <div className="purchase-recommendations-chart-grid">
        <BarChartCard title="Kategori Bazlı Öneriler" rows={statistics.categoryRows} />
        <BarChartCard title="Risk Dağılımı" rows={statistics.riskRows} />
        <BarChartCard title="Tedarikçi Bazlı Dağılım" rows={statistics.supplierRows} />
        <BarChartCard title="Beklenen Tasarruf" rows={statistics.expectedSavingRows} />
        <BarChartCard title="Kritik Ürünler" rows={statistics.criticalProductRows} />
        <LineChartCard series={statistics.dailyTrend} />
      </div>

      <div className="product-layout purchase-recommendations-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Satırlar karar desteği çıktısıdır; gerçek satın alma işlemi başlatılmaz.</p>
            </div>
            <span className="status-pill">{formatCurrency(statistics.expectedSaving)} tasarruf</span>
          </div>
          <div className="table-wrap purchase-recommendations-table-wrap">
            <table className="data-table purchase-recommendations-table">
              <thead>
                <tr>
                  <th>Öneri No</th>
                  <th>Öneri Türü</th>
                  <th>Ürün</th>
                  <th>Depo</th>
                  <th>Şube</th>
                  <th>Tedarikçi</th>
                  <th>Önerilen Miktar</th>
                  <th>Risk</th>
                  <th>Öncelik</th>
                  <th>Confidence</th>
                  <th>Beklenen Tasarruf</th>
                  <th>Oluşturulma Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={12}>Filtrelere uygun satın alma önerisi bulunamadı.</td></tr>
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
                    <td data-label="Öneri Türü"><strong>{PURCHASE_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Ürün"><strong>{row.item.stockItemName || row.item.productName || row.item.relatedEntityName}</strong><span>{row.item.categoryName}</span></td>
                    <td data-label="Depo"><strong>{row.item.warehouseName || '-'}</strong><span>{row.item.pendingOrderNos.length ? row.item.pendingOrderNos.join(', ') : getDecisionSourceModuleLabel(row.item.sourceModule)}</span></td>
                    <td data-label="Şube"><strong>{row.item.branchName || '-'}</strong><span>{formatDate(row.report.reportDate)}</span></td>
                    <td data-label="Tedarikçi"><strong>{row.item.supplierName || '-'}</strong><span>{row.item.alternativeSupplierName ? `Alternatif: ${row.item.alternativeSupplierName}` : '-'}</span></td>
                    <td data-label="Önerilen Miktar">{formatNumber(row.item.recommendedOrderQuantity, 2)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{PURCHASE_RECOMMENDATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Öncelik"><span className={`status-pill ${getPriorityClass(row.item.priority)}`}>{PURCHASE_RECOMMENDATION_PRIORITY_LABELS[row.item.priority]}</span></td>
                    <td data-label="Confidence">{formatNumber(row.item.confidenceScore, 1)}</td>
                    <td data-label="Beklenen Tasarruf">{formatCurrency(row.item.expectedSaving)}</td>
                    <td data-label="Oluşturulma Tarihi">{formatDateTime(row.item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side purchase-recommendations-side">
          {selectedRow && selectedReport ? (
            <PurchaseRecommendationDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card purchase-recommendations-detail-card">
              <h3>Öneri Detayı</h3>
              <p className="muted">Detay görüntülemek için bir satın alma önerisi seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function PurchaseRecommendationDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: PurchaseRecommendationItem
  onOutput: (action: Extract<PurchaseRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: PurchaseRecommendationReport
}){
  return (
    <>
      <section className="card purchase-recommendations-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{item.recommendationNo}</h3>
            <p className="muted">{PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType]} / {item.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{PURCHASE_RECOMMENDATION_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="purchase-recommendations-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdır</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="purchase-recommendations-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>İncele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arşivle</button>
        </div>

        <div className="purchase-recommendations-detail-grid">
          <div><span>Rapor No</span><strong>{report.reportNo}</strong></div>
          <div><span>Oluşturulma</span><strong>{formatDateTime(item.createdAt)}</strong></div>
          <div><span>Depo</span><strong>{item.warehouseName || '-'}</strong></div>
          <div><span>Şube</span><strong>{item.branchName || '-'}</strong></div>
          <div><span>Önerilen Miktar</span><strong>{formatNumber(item.recommendedOrderQuantity, 2)}</strong></div>
          <div><span>Mevcut / Min / Maks</span><strong>{formatNumber(item.currentStock, 2)} / {formatNumber(item.minimumStock, 2)} / {formatNumber(item.maximumStock, 2)}</strong></div>
          <div><span>Risk</span><strong>{PURCHASE_RECOMMENDATION_RISK_LABELS[item.risk]} ({formatNumber(item.riskScore, 1)})</strong></div>
          <div><span>Öncelik</span><strong>{PURCHASE_RECOMMENDATION_PRIORITY_LABELS[item.priority]}</strong></div>
          <div><span>Confidence</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Beklenen Tasarruf</span><strong>{formatCurrency(item.expectedSaving)}</strong></div>
          <div><span>Tedarikçi</span><strong>{item.supplierName || '-'}</strong></div>
          <div><span>Teslim Süresi</span><strong>{item.leadTimeDays ? `${formatNumber(item.leadTimeDays)} gün` : '-'}</strong></div>
        </div>
      </section>

      <DetailTextCard title="Gerekçe" primary={item.reason} />
      <DetailTextCard title="Analiz Sonucu" primary={item.analysisResult || item.description} secondary={item.action} />
      <DetailTextCard title="Risk Açıklaması" primary={item.riskExplanation} secondary={item.lotRiskSummary} />
      <DetailTextCard title="Beklenen Kazanç" primary={item.expectedGain} secondary={item.expectedImpact} />
      <LinkedEntityCard title="Etkilenen Üretim Emirleri" items={item.affectedProductionOrders} emptyText="Üretim emri bağlantısı yok." />
      <LinkedEntityCard title="Etkilenen Reçeteler" items={item.affectedRecipes} emptyText="Reçete bağlantısı yok." />
      <SupplierOptionCard items={item.alternativeSuppliers} />

      <section className="card purchase-recommendations-detail-card">
        <h3>İşlem Geçmişi</h3>
        <div className="purchase-recommendations-history-list">
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
    <section className="card purchase-recommendations-detail-card">
      <h3>{title}</h3>
      <p className="purchase-recommendations-notes">{primary || '-'}</p>
      {secondary && <p className="purchase-recommendations-notes muted-note">{secondary}</p>}
    </section>
  )
}

function LinkedEntityCard({
  emptyText,
  items,
  title
}: {
  emptyText: string
  items: PurchaseRecommendationLinkedEntity[]
  title: string
}){
  return (
    <section className="card purchase-recommendations-detail-card">
      <h3>{title}</h3>
      <div className="purchase-recommendations-module-list">
        {items.length === 0 && <div><strong>{emptyText}</strong><span>-</span></div>}
        {items.map(item => (
          <div key={`${item.id}:${item.no}`}>
            <strong>{item.no || item.name}</strong>
            <span>{item.name}{item.detail ? ` / ${item.detail}` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function SupplierOptionCard({ items }: { items: PurchaseRecommendationSupplierOption[] }){
  return (
    <section className="card purchase-recommendations-detail-card">
      <h3>Alternatif Tedarikçiler</h3>
      <div className="purchase-recommendations-module-list">
        {items.length === 0 && <div><strong>Alternatif tedarikçi yok.</strong><span>-</span></div>}
        {items.map(item => (
          <div key={item.supplierId}>
            <strong>{item.supplierName}</strong>
            <span>{formatCurrency(item.unitCost)} / {formatNumber(item.leadTimeDays)} gün / {formatNumber(item.performanceScore, 1)} performans / {formatNumber(item.savingPercent, 1)}% avantaj</span>
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
