import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  SHIPMENT_OPTIMIZATION_PRIORITIES,
  SHIPMENT_OPTIMIZATION_PRIORITY_LABELS,
  SHIPMENT_OPTIMIZATION_RISKS,
  SHIPMENT_OPTIMIZATION_RISK_LABELS,
  SHIPMENT_OPTIMIZATION_STATUS_LABELS,
  SHIPMENT_OPTIMIZATION_TYPES,
  SHIPMENT_OPTIMIZATION_TYPE_LABELS,
  ShipmentOptimizationService
} from '../shipment-optimization/shipment-optimization.service'
import type {
  ShipmentOptimizationAlternative,
  ShipmentOptimizationFilters,
  ShipmentOptimizationHistoryAction,
  ShipmentOptimizationItem,
  ShipmentOptimizationLinkedEntity,
  ShipmentOptimizationPriority,
  ShipmentOptimizationReport,
  ShipmentOptimizationReportCreateInput,
  ShipmentOptimizationRisk,
  ShipmentOptimizationStatus
} from '../shipment-optimization/shipment-optimization.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type ShipmentOptimizationRow = {
  report: ShipmentOptimizationReport
  item: ShipmentOptimizationItem
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

const getRiskClass = (risk: ShipmentOptimizationRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: ShipmentOptimizationPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: ShipmentOptimizationStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: ShipmentOptimizationHistoryAction) => {
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
  report: ShipmentOptimizationReport | null,
  status: Extract<ShipmentOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

const joinLinked = (
  items: ShipmentOptimizationLinkedEntity[]
) => items.map(item => item.no || item.name).filter(Boolean).join(', ')

const joinAlternatives = (
  items: ShipmentOptimizationAlternative[]
) => items.map(item => item.name).filter(Boolean).join(', ')

const mapRowsForOutput = (
  rows: ShipmentOptimizationRow[]
) => rows.map(row => ({
  'Öneri No': row.item.recommendationNo,
  'Rapor No': row.report.reportNo,
  'Öneri Türü': SHIPMENT_OPTIMIZATION_TYPE_LABELS[row.item.recommendationType],
  'Sevkiyat Planı': row.item.shipmentPlanNo,
  'Sevkiyat No': row.item.shipmentNo,
  Araç: [row.item.vehicleNo, row.item.vehiclePlate, row.item.vehicleName].filter(Boolean).join(' / '),
  'Araç Tipi': row.item.vehicleType,
  Şoför: row.item.driverName,
  Şube: row.item.branchName,
  'Teslimat Bölgesi': row.item.deliveryRegion,
  'Planlanan Başlangıç': formatDateTime(row.item.plannedDepartureAt),
  'Planlanan Bitiş': formatDateTime(row.item.plannedArrivalAt),
  'Durak Sayısı': row.item.stopCount,
  'Araç Doluluk (%)': row.item.currentVehicleUtilizationPercent,
  Risk: SHIPMENT_OPTIMIZATION_RISK_LABELS[row.item.risk],
  Öncelik: SHIPMENT_OPTIMIZATION_PRIORITY_LABELS[row.item.priority],
  Confidence: row.item.confidenceScore,
  'Beklenen Süre Kazancı (dk)': row.item.expectedTimeGainMinutes,
  'Beklenen Yakıt Tasarrufu (lt)': row.item.expectedFuelSavingLiters,
  'Beklenen Maliyet Tasarrufu': row.item.expectedCostSaving,
  'Oluşturulma Tarihi': formatDateTime(row.item.createdAt),
  'Analiz Gerekçesi': row.item.reason,
  'Analiz Sonucu': row.item.analysisResult,
  'Risk Açıklaması': row.item.riskExplanation,
  'Önerilen Aksiyon': row.item.recommendedAction,
  'Etkilenen Sevkiyatlar': joinLinked(row.item.affectedShipments),
  'Alternatif Araçlar': joinAlternatives(row.item.alternativeVehicles),
  'Alternatif Teslimat Planı': joinAlternatives(row.item.alternativeDeliveryPlan)
}))

const createFilteredOutputFileName = (suffix = 'filtreli') => (
  `sevkiyat-optimizasyonu-${suffix}-${new Date().toLocaleDateString('sv-SE')}.xlsx`
)

const exportRowsToExcel = (
  rows: ShipmentOptimizationRow[],
  suffix?: string
) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'shipments',
    moduleLabel: 'Sevkiyat Optimizasyonu',
    sheetName: 'Sevkiyat Optimizasyonu',
    fileNamePrefix: `sevkiyat-optimizasyonu-${suffix || 'filtreli'}`,
    fileName: createFilteredOutputFileName(suffix),
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const createFilteredPrintHtml = (
  rows: ShipmentOptimizationRow[],
  mode: 'A4' | 'PDF'
) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Sevkiyat Optimizasyonu - Filtreli Liste</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1320px; margin:0 auto; padding:22px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
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
        <h1>Sevkiyat Optimizasyonu - Filtreli Liste</h1>
        <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : `${rows.length} öneri`)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Öneri No</th><th>Öneri</th><th>Sevkiyat No</th><th>Araç</th><th>Şoför</th><th>Şube</th><th>Bölge</th><th>Risk</th><th>Öncelik</th><th>Confidence</th><th>Süre</th><th>Yakıt</th><th>Maliyet</th><th>Tarih</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.item.recommendationNo)}</td>
            <td>${escapeHtml(SHIPMENT_OPTIMIZATION_TYPE_LABELS[row.item.recommendationType])}</td>
            <td>${escapeHtml(row.item.shipmentNo || row.item.shipmentPlanNo || '-')}</td>
            <td>${escapeHtml([row.item.vehicleNo, row.item.vehiclePlate].filter(Boolean).join(' / ') || '-')}</td>
            <td>${escapeHtml(row.item.driverName || '-')}</td>
            <td>${escapeHtml(row.item.branchName || '-')}</td>
            <td>${escapeHtml(row.item.deliveryRegion || '-')}</td>
            <td>${escapeHtml(SHIPMENT_OPTIMIZATION_RISK_LABELS[row.item.risk])}</td>
            <td>${escapeHtml(SHIPMENT_OPTIMIZATION_PRIORITY_LABELS[row.item.priority])}</td>
            <td>${escapeHtml(formatNumber(row.item.confidenceScore, 1))}</td>
            <td>${escapeHtml(`${formatNumber(row.item.expectedTimeGainMinutes, 0)} dk`)}</td>
            <td>${escapeHtml(`${formatNumber(row.item.expectedFuelSavingLiters, 1)} lt`)}</td>
            <td>${escapeHtml(formatCurrency(row.item.expectedCostSaving))}</td>
            <td>${escapeHtml(formatDateTime(row.item.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`

const openFilteredPrintWindow = (
  rows: ShipmentOptimizationRow[],
  mode: 'A4' | 'PDF'
) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900')
  if(!popup) throw new Error('Çıktı penceresi açılamadı. Tarayıcı pop-up iznini kontrol edin.')
  popup.document.write(createFilteredPrintHtml(rows, mode))
  popup.document.close()
  popup.focus()
  popup.print()
}

export default function ShipmentOptimization({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(() => loadKpiSourceData(), [])
  const [reports, setReports] = React.useState<ShipmentOptimizationReport[]>(() => ShipmentOptimizationService.list(sourceData))
  const [filters, setFilters] = React.useState<ShipmentOptimizationFilters>(() => ShipmentOptimizationService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false)
  const [form, setForm] = React.useState<ShipmentOptimizationReportCreateInput>(() => ShipmentOptimizationService.createDefaultInput(userName))
  const analysisTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if(analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current)
  }, [])

  const filteredReports = React.useMemo(
    () => ShipmentOptimizationService.filter(reports, filters),
    [filters, reports]
  )
  const rows = React.useMemo(
    () => filteredReports.flatMap(report => report.items.map(item => ({ report, item }))),
    [filteredReports]
  )
  const statistics = React.useMemo(
    () => ShipmentOptimizationService.statistics(filteredReports),
    [filteredReports]
  )
  const selectedRow = React.useMemo(
    () => rows.find(row => row.item.id === selectedItemId) || rows[0] || null,
    [rows, selectedItemId]
  )
  const selectedReport = selectedRow?.report || null

  const branchOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.branchId, name: item.branchName || item.branchId })))
  ]), [reports, sourceData])
  const vehicleOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.shipmentVehicles.map(vehicle => ({
      id: vehicle.id,
      name: [vehicle.vehicleNo, vehicle.plateNumber, vehicle.vehicleName].filter(Boolean).join(' / ')
    })),
    ...reports.flatMap(report => report.items.map(item => ({
      id: item.vehicleId,
      name: [item.vehicleNo, item.vehiclePlate, item.vehicleName].filter(Boolean).join(' / ') || item.vehicleId
    })))
  ]), [reports, sourceData])
  const driverOptions = React.useMemo(() => uniqueOptions(
    reports.flatMap(report => report.items.map(item => ({ id: item.driverName, name: item.driverName })))
  ), [reports])
  const regionOptions = React.useMemo(() => uniqueOptions(
    reports.flatMap(report => report.items.map(item => ({ id: item.deliveryRegion, name: item.deliveryRegion })))
  ), [reports])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = ShipmentOptimizationService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof ShipmentOptimizationFilters>(key: TKey, value: ShipmentOptimizationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof ShipmentOptimizationReportCreateInput>(key: TKey, value: ShipmentOptimizationReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    if(analysisTimerRef.current !== null) window.clearTimeout(analysisTimerRef.current)
    setIsAnalyzing(true)
    setMessage(null)
    analysisTimerRef.current = window.setTimeout(() => {
      try{
        const report = ShipmentOptimizationService.add(form, sourceData, userName)
        const firstItemId = report.items[0]?.id || ''
        refreshReports(firstItemId)
        setForm(ShipmentOptimizationService.createDefaultInput(userName))
        setMessage({ type: 'success', text: `${report.reportNo} sevkiyat optimizasyon raporu oluşturuldu.` })
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sevkiyat optimizasyon raporu oluşturulamadı.' })
      } finally {
        setIsAnalyzing(false)
        analysisTimerRef.current = null
      }
    }, 120)
  }

  const changeStatus = (status: Extract<ShipmentOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = ShipmentOptimizationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${SHIPMENT_OPTIMIZATION_STATUS_LABELS[status]} durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sevkiyat optimizasyon durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ShipmentOptimizationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport || !selectedRow) return

    try{
      const outputRows = [selectedRow]
      if(action === 'EXCEL') exportRowsToExcel(outputRows, selectedReport.reportNo.toLocaleLowerCase('tr-TR'))
      if(action === 'PRINTED') openFilteredPrintWindow(outputRows, 'A4')
      if(action === 'PDF') openFilteredPrintWindow(outputRows, 'PDF')

      const report = ShipmentOptimizationService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel çıktısına aktarıldı.`
          : `${report.reportNo} çıktı penceresinde açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sevkiyat optimizasyon çıktısı alınamadı.' })
    }
  }

  const outputFilteredRows = (action: 'PRINTED' | 'PDF' | 'EXCEL') => {
    try{
      if(action === 'EXCEL') exportRowsToExcel(rows)
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
    <div className="shipment-optimization-page">
      <div className="page-header">
        <div>
          <h2>Sevkiyat Optimizasyonu</h2>
          <p className="muted">Karar Destek Motoru yalnızca analiz ve öneri üretir; sevkiyat oluşturmaz, gerçek sevkiyat planını değiştirmez, araç ataması veya muhasebe kaydı yapmaz.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}
      {isAnalyzing && (
        <div className="shipment-optimization-loading" role="status" aria-live="polite">
          <span />
          <strong>Sevkiyat sinyalleri analiz ediliyor</strong>
          <small>Plan, araç kapasitesi, rota, müşteri teslim saati ve soğuk zincir verileri birlikte değerlendiriliyor.</small>
        </div>
      )}

      <div className="metric-grid shipment-optimization-metric-grid">
        <div className="metric-card">
          <span>Toplam Sevkiyat Önerisi</span>
          <strong>{formatNumber(statistics.totalRecommendations)}</strong>
          <small>Filtrelenmiş liste</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Sevkiyat Riski</span>
          <strong>{formatNumber(statistics.criticalShipmentRisks)}</strong>
          <small>Kritik riskli öneri</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Yakıt Tasarrufu</span>
          <strong>{formatNumber(statistics.expectedFuelSavingLiters, 1)} lt</strong>
          <small>Rota ve araç senaryoları</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Süre Kazancı</span>
          <strong>{formatNumber(statistics.expectedTimeGainMinutes, 0)} dk</strong>
          <small>Teslimat sırası optimizasyonu</small>
        </div>
        <div className="metric-card warning">
          <span>Ortalama Araç Doluluk Oranı</span>
          <strong>{formatPercent(statistics.averageVehicleUtilizationPercent)}</strong>
          <small>Mevcut doluluk ortalaması</small>
        </div>
        <div className="metric-card">
          <span>Güven Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Confidence ortalaması</small>
        </div>
      </div>

      <section className="card shipment-optimization-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Optimizasyon Raporu</h3>
            <p className="muted">Sevkiyat planları, araç kapasiteleri, teslimat rotaları, müşteri teslim saatleri, soğuk zincir, üretim ve depo sinyallerinden karar destek raporu üretir.</p>
          </div>
          <span className="status-pill warning-pill">Sadece öneri</span>
        </div>
        <div className="shipment-optimization-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as ShipmentOptimizationReportCreateInput['scope'])}>
              <option value="all">Tüm Öneriler</option>
              {SHIPMENT_OPTIMIZATION_TYPES.map(type => <option key={type} value={type}>{SHIPMENT_OPTIMIZATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field shipment-optimization-wide">
            <span>Açıklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Opsiyonel rapor notu" />
          </label>
          <div className="shipment-optimization-filter-actions">
            <button className="btn primary" type="button" disabled={isAnalyzing} onClick={createReport}>{isAnalyzing ? 'Analiz Sürüyor' : 'Öneri Üret'}</button>
          </div>
        </div>
      </section>

      <section className="card shipment-optimization-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler ve Çıktılar</h3>
            <p className="muted">Excel, PDF, yazdır ve filtrelenmiş liste çıktıları gerçek sevkiyat veya araç ataması oluşturmaz.</p>
          </div>
          <div className="shipment-optimization-filter-actions">
            <button className="btn" type="button" onClick={() => outputFilteredRows('EXCEL')}>Excel</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PDF')}>PDF</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PRINTED')}>Yazdır</button>
            <button className="btn" type="button" onClick={() => setFilters(ShipmentOptimizationService.createDefaultFilters())}>Temizle</button>
          </div>
        </div>
        <div className="shipment-optimization-filter-grid">
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Araç</span>
            <select value={filters.vehicleId} onChange={event => updateFilter('vehicleId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Araçlar</option>
              {vehicleOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Şoför</span>
            <select value={filters.driverName} onChange={event => updateFilter('driverName', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şoförler</option>
              {driverOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Bölge</span>
            <select value={filters.deliveryRegion} onChange={event => updateFilter('deliveryRegion', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Bölgeler</option>
              {regionOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as ShipmentOptimizationFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {SHIPMENT_OPTIMIZATION_RISKS.map(risk => <option key={risk} value={risk}>{SHIPMENT_OPTIMIZATION_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as ShipmentOptimizationFilters['priority'])}>
              <option value={ALL_FILTER}>Tüm Öncelikler</option>
              {SHIPMENT_OPTIMIZATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{SHIPMENT_OPTIMIZATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Öneri Türü</span>
            <select value={filters.recommendationType} onChange={event => updateFilter('recommendationType', event.target.value as ShipmentOptimizationFilters['recommendationType'])}>
              <option value={ALL_FILTER}>Tüm Öneriler</option>
              {SHIPMENT_OPTIMIZATION_TYPES.map(type => <option key={type} value={type}>{SHIPMENT_OPTIMIZATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field shipment-optimization-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Öneri no, sevkiyat, araç, şoför, şube, bölge, risk açıklaması" />
          </label>
        </div>
      </section>

      <div className="shipment-optimization-chart-grid">
        <BarChartCard title="Bölge Bazlı Sevkiyat" rows={statistics.regionShipmentRows} />
        <BarChartCard title="Araç Doluluk Oranı" rows={statistics.vehicleUtilizationRows} />
        <BarChartCard title="Yakıt Tasarrufu" rows={statistics.fuelSavingRows} />
        <BarChartCard title="Teslim Süresi Analizi" rows={statistics.deliveryTimeRows} />
        <BarChartCard title="Sevkiyat Riskleri" rows={statistics.riskRows} />
        <LineChartCard series={statistics.dailyTrend} />
        <BarChartCard title="Araç Kullanım Dağılımı" rows={statistics.vehicleTypeRows} />
        <BarChartCard title="Beklenen Maliyet Tasarrufu" rows={statistics.costSavingRows} />
      </div>

      <div className="product-layout shipment-optimization-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Satırlar karar destek çıktısıdır; gerçek sevkiyat planı, araç ataması veya muhasebe kaydı otomatik oluşmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(rows.length)} öneri</span>
          </div>
          <div className="table-wrap shipment-optimization-table-wrap">
            <table className="data-table shipment-optimization-table">
              <thead>
                <tr>
                  <th>Öneri No</th>
                  <th>Öneri Türü</th>
                  <th>Sevkiyat No</th>
                  <th>Araç</th>
                  <th>Şoför</th>
                  <th>Şube</th>
                  <th>Teslimat Bölgesi</th>
                  <th>Risk</th>
                  <th>Öncelik</th>
                  <th>Confidence</th>
                  <th>Beklenen Süre Kazancı</th>
                  <th>Beklenen Yakıt Tasarrufu</th>
                  <th>Beklenen Maliyet Tasarrufu</th>
                  <th>Oluşturulma Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={14}>Filtrelere uygun sevkiyat optimizasyon önerisi bulunamadı.</td></tr>
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
                    <td data-label="Öneri Türü"><strong>{SHIPMENT_OPTIMIZATION_TYPE_LABELS[row.item.recommendationType]}</strong><span>{row.item.expectedSavingSummary}</span></td>
                    <td data-label="Sevkiyat No"><strong>{row.item.shipmentNo || row.item.shipmentPlanNo || '-'}</strong><span>{formatDateTime(row.item.plannedDepartureAt)}</span></td>
                    <td data-label="Araç"><strong>{[row.item.vehicleNo, row.item.vehiclePlate].filter(Boolean).join(' / ') || '-'}</strong><span>{row.item.vehicleName || row.item.vehicleType}</span></td>
                    <td data-label="Şoför">{row.item.driverName || '-'}</td>
                    <td data-label="Şube">{row.item.branchName || '-'}</td>
                    <td data-label="Teslimat Bölgesi"><strong>{row.item.deliveryRegion || '-'}</strong><span>{formatNumber(row.item.stopCount)} durak</span></td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{SHIPMENT_OPTIMIZATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Öncelik"><span className={`status-pill ${getPriorityClass(row.item.priority)}`}>{SHIPMENT_OPTIMIZATION_PRIORITY_LABELS[row.item.priority]}</span></td>
                    <td data-label="Confidence">{formatNumber(row.item.confidenceScore, 1)}</td>
                    <td data-label="Beklenen Süre Kazancı">{formatNumber(row.item.expectedTimeGainMinutes, 0)} dk</td>
                    <td data-label="Beklenen Yakıt Tasarrufu">{formatNumber(row.item.expectedFuelSavingLiters, 1)} lt</td>
                    <td data-label="Beklenen Maliyet Tasarrufu">{formatCurrency(row.item.expectedCostSaving)}</td>
                    <td data-label="Oluşturulma Tarihi">{formatDateTime(row.item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side shipment-optimization-side">
          {selectedRow && selectedReport ? (
            <ShipmentOptimizationDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card shipment-optimization-detail-card">
              <h3>Öneri Detayı</h3>
              <p className="muted">Detay görüntülemek için bir sevkiyat optimizasyon önerisi seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ShipmentOptimizationDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: ShipmentOptimizationItem
  onOutput: (action: Extract<ShipmentOptimizationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<ShipmentOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: ShipmentOptimizationReport
}){
  return (
    <>
      <section className="card shipment-optimization-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{item.recommendationNo}</h3>
            <p className="muted">{SHIPMENT_OPTIMIZATION_TYPE_LABELS[item.recommendationType]} / {item.shipmentNo || item.shipmentPlanNo}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{SHIPMENT_OPTIMIZATION_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="shipment-optimization-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdır</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="shipment-optimization-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>İncele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arşivle</button>
        </div>

        <div className="shipment-optimization-detail-grid">
          <div><span>Sevkiyat</span><strong>{item.shipmentNo || item.shipmentPlanNo}</strong></div>
          <div><span>Araç</span><strong>{[item.vehicleNo, item.vehiclePlate].filter(Boolean).join(' / ') || '-'}</strong></div>
          <div><span>Şoför</span><strong>{item.driverName || '-'}</strong></div>
          <div><span>Şube</span><strong>{item.branchName || '-'}</strong></div>
          <div><span>Teslimat Bölgesi</span><strong>{item.deliveryRegion || '-'}</strong></div>
          <div><span>Planlanan Başlangıç</span><strong>{formatDateTime(item.plannedDepartureAt)}</strong></div>
          <div><span>Planlanan Bitiş</span><strong>{formatDateTime(item.plannedArrivalAt)}</strong></div>
          <div><span>Araç Doluluk</span><strong>{formatPercent(item.currentVehicleUtilizationPercent)} → {formatPercent(item.targetVehicleUtilizationPercent)}</strong></div>
          <div><span>Risk</span><strong>{SHIPMENT_OPTIMIZATION_RISK_LABELS[item.risk]} ({formatNumber(item.riskScore, 1)})</strong></div>
          <div><span>Öncelik</span><strong>{SHIPMENT_OPTIMIZATION_PRIORITY_LABELS[item.priority]}</strong></div>
          <div><span>Confidence</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Soğuk Zincir</span><strong>{item.coldChainRequired ? 'Gerekli' : 'Gerekli değil'}</strong></div>
        </div>
      </section>

      <DetailTextCard title="Analiz Gerekçesi" primary={item.reason} secondary={item.recommendedAction} />
      <DetailTextCard title="Risk Açıklaması" primary={item.riskExplanation} secondary={`Kaynak modüller: ${item.sourceModules.join(', ')}`} />
      <DetailTextCard title="Beklenen Tasarruf" primary={formatCurrency(item.expectedCostSaving)} secondary={`${formatNumber(item.expectedFuelSavingLiters, 1)} lt yakıt tasarrufu / ${formatNumber(item.expectedTimeGainMinutes, 0)} dk süre kazancı`} />
      <DetailTextCard title="Beklenen Süre Kazancı" primary={`${formatNumber(item.expectedTimeGainMinutes, 0)} dakika`} secondary={item.analysisResult} />
      <LinkedEntityCard title="Etkilenen Sevkiyatlar" items={item.affectedShipments} emptyText="Sevkiyat bağlantısı yok." />
      <AlternativeCard title="Alternatif Araçlar" items={item.alternativeVehicles} />
      <AlternativeCard title="Alternatif Teslimat Planı" items={item.alternativeDeliveryPlan} />

      <section className="card shipment-optimization-detail-card">
        <h3>İşlem Geçmişi</h3>
        <div className="shipment-optimization-history-list">
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
    <section className="card shipment-optimization-detail-card">
      <h3>{title}</h3>
      <p className="shipment-optimization-notes">{primary || '-'}</p>
      {secondary && <p className="shipment-optimization-notes muted-note">{secondary}</p>}
    </section>
  )
}

function LinkedEntityCard({
  emptyText,
  items,
  title
}: {
  emptyText: string
  items: ShipmentOptimizationLinkedEntity[]
  title: string
}){
  return (
    <section className="card shipment-optimization-detail-card">
      <h3>{title}</h3>
      <div className="shipment-optimization-module-list">
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
  items: ShipmentOptimizationAlternative[]
  title: string
}){
  return (
    <section className="card shipment-optimization-detail-card">
      <h3>{title}</h3>
      <div className="shipment-optimization-module-list">
        {items.length === 0 && <div><strong>Alternatif bulunamadı.</strong><span>-</span></div>}
        {items.map(item => (
          <div key={item.id}>
            <strong>{item.no ? `${item.no} / ${item.name}` : item.name}</strong>
            <span>{formatPercent(item.expectedUtilizationPercent)} hedef doluluk / {formatNumber(item.expectedTimeGainMinutes, 0)} dk / {formatNumber(item.expectedFuelSavingLiters, 1)} lt / {item.detail}</span>
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
