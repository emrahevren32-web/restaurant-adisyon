import React from 'react'
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
  PurchaseRecommendationPriority,
  PurchaseRecommendationReport,
  PurchaseRecommendationReportCreateInput,
  PurchaseRecommendationRisk,
  PurchaseRecommendationStatus
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
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'CALCULATED') return 'Hesaplandi'
  if(action === 'REVIEWED') return 'Incelendi'
  if(action === 'ARCHIVED') return 'Arsivlendi'
  if(action === 'PRINTED') return 'Yazdirildi'
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
  const statistics = React.useMemo(() => PurchaseRecommendationService.statistics(reports), [reports])
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
      { id: item.alternativeSupplierId, name: item.alternativeSupplierName || item.alternativeSupplierId }
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
      setMessage({ type: 'success', text: `${report.reportNo} satin alma onerisi raporu olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Satın alma öneri raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = PurchaseRecommendationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${PURCHASE_RECOMMENDATION_STATUS_LABELS[status]} durumuna alindi.` })
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
          ? `${report.reportNo} Excel export edildi.`
          : `${report.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Satın alma öneri çıktısı alınamadı.' })
    }
  }

  return (
    <div className="purchase-recommendations-page">
      <div className="page-header">
        <div>
          <h2>Satin Alma Onerileri</h2>
          <p className="muted">Tahminleme, maliyet optimizasyonu, yapay zeka analizi, kritik alarmlar, stok, mal kabul, fire ve tedarikçi verilerinden analiz modeli satın alma önerileri üretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid purchase-recommendations-metric-grid">
        <div className="metric-card">
          <span>Toplam Satin Alma Onerisi</span>
          <strong>{formatNumber(statistics.totalRecommendations)}</strong>
          <small>{formatNumber(rows.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Satin Alma</span>
          <strong>{formatNumber(statistics.criticalPurchases)}</strong>
          <small>CRITICAL veya URGENT</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Tasarruf</span>
          <strong>{formatCurrency(statistics.expectedSaving)}</strong>
          <small>Analitik avantaj</small>
        </div>
        <div className="metric-card warning">
          <span>Alternatif Tedarikci</span>
          <strong>{formatNumber(statistics.alternativeSupplierCount)}</strong>
          <small>Fiyat/kosul karsilastirma</small>
        </div>
        <div className="metric-card">
          <span>Risk / Güven Skoru</span>
          <strong>{formatNumber(statistics.averageRiskScore, 1)}</strong>
          <small>{formatNumber(statistics.averageConfidence, 1)} güven</small>
        </div>
      </div>

      <section className="card purchase-recommendations-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Satın Alma Öneri Raporu</h3>
            <p className="muted">Sadece öneri üretir; satın alma siparişi, stok hareketi veya tedarikçi siparişi oluşturmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
        </div>
        <div className="purchase-recommendations-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as PurchaseRecommendationReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tum Oneriler</option>
              {PURCHASE_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PURCHASE_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field purchase-recommendations-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Satin alma analiz notu" />
          </label>
        </div>
      </section>

      <section className="card purchase-recommendations-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} satin alma onerisi listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(PurchaseRecommendationService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="purchase-recommendations-filter-grid">
          <label className="form-field">
            <span>Oneri Turu</span>
            <select value={filters.recommendationType} onChange={event => updateFilter('recommendationType', event.target.value as PurchaseRecommendationFilters['recommendationType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {PURCHASE_RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{PURCHASE_RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Oncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as PurchaseRecommendationFilters['priority'])}>
              <option value={ALL_FILTER}>Tum Oncelikler</option>
              {PURCHASE_RECOMMENDATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{PURCHASE_RECOMMENDATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as PurchaseRecommendationFilters['risk'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {PURCHASE_RECOMMENDATION_RISKS.map(risk => <option key={risk} value={risk}>{PURCHASE_RECOMMENDATION_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Subeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.categoryId} onChange={event => updateFilter('categoryId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {categoryOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Urun / Stok</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Urunler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tedarikci</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Tedarikciler</option>
              {supplierOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field purchase-recommendations-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, ürün, stok, tedarikçi, neden, aksiyon" />
          </label>
        </div>
      </section>

      <div className="purchase-recommendations-chart-grid">
        <BarChartCard title="Kategori Dagilimi" rows={statistics.categoryRows} />
        <BarChartCard title="Oneri Turu" rows={statistics.typeRows} />
        <BarChartCard title="Urun Bazli" rows={statistics.productRows} />
        <BarChartCard title="Tedarikçi Bazlı" rows={statistics.supplierRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Risk Dagilimi" rows={statistics.riskRows} />
        <BarChartCard title="Oncelik Dagilimi" rows={statistics.priorityRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout purchase-recommendations-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Oneri Listesi</h3>
              <p className="muted">Satirlar satin alma karar destegi icindir; otomatik siparis olusturulmaz.</p>
            </div>
            <span className="status-pill">{formatCurrency(statistics.expectedSaving)} tasarruf</span>
          </div>
          <div className="table-wrap purchase-recommendations-table-wrap">
            <table className="data-table purchase-recommendations-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Tur</th>
                  <th>Urun / Stok</th>
                  <th>Tedarikci</th>
                  <th>Miktar</th>
                  <th>Tukenme</th>
                  <th>Tasarruf</th>
                  <th>Risk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={9}>Filtrelere uygun satin alma onerisi bulunamadi.</td></tr>
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
                    <td data-label="Rapor"><strong>{row.report.reportNo}</strong><span>{formatDate(row.report.reportDate)}</span></td>
                    <td data-label="Tur"><strong>{PURCHASE_RECOMMENDATION_TYPE_LABELS[row.item.recommendationType]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Urun / Stok"><strong>{row.item.stockItemName || row.item.productName}</strong><span>{row.item.categoryName}</span></td>
                    <td data-label="Tedarikçi"><strong>{row.item.supplierName || '-'}</strong><span>{row.item.alternativeSupplierName ? `Alternatif: ${row.item.alternativeSupplierName}` : getDecisionSourceModuleLabel(row.item.sourceModule)}</span></td>
                    <td data-label="Miktar">{formatNumber(row.item.recommendedOrderQuantity, 2)}</td>
                    <td data-label="Tukenme">{row.item.estimatedStockoutDate ? formatDate(row.item.estimatedStockoutDate) : '-'}</td>
                    <td data-label="Tasarruf">{formatCurrency(row.item.expectedSaving)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{PURCHASE_RECOMMENDATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.report.status)}`}>{PURCHASE_RECOMMENDATION_STATUS_LABELS[row.report.status]}</span></td>
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
              <h3>Oneri Detayi</h3>
              <p className="muted">Detay gormek icin bir satin alma onerisi secin.</p>
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
            <h3>{report.reportNo}</h3>
            <p className="muted">{PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType]} / {item.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getPriorityClass(item.priority)}`}>{PURCHASE_RECOMMENDATION_PRIORITY_LABELS[item.priority]}</span>
        </div>

        <div className="purchase-recommendations-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="purchase-recommendations-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arsivle</button>
        </div>

        <div className="purchase-recommendations-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Oneri Turu</span><strong>{PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType]}</strong></div>
          <div><span>Onerilen Miktar</span><strong>{formatNumber(item.recommendedOrderQuantity, 2)}</strong></div>
          <div><span>Kapsama Gunu</span><strong>{item.estimatedCoverageDays >= 999 ? '-' : formatNumber(item.estimatedCoverageDays, 1)}</strong></div>
          <div><span>Mevcut Stok</span><strong>{formatNumber(item.currentStock, 2)}</strong></div>
          <div><span>Minimum Stok</span><strong>{formatNumber(item.minimumStock, 2)}</strong></div>
          <div><span>Beklenen Maliyet</span><strong>{formatCurrency(item.expectedCost)}</strong></div>
          <div><span>Beklenen Tasarruf</span><strong>{formatCurrency(item.expectedSaving)}</strong></div>
          <div><span>Risk Skoru</span><strong>{formatNumber(item.riskScore, 1)}</strong></div>
          <div><span>Güven Skoru</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Kaynak</span><strong>{item.sourceModule}</strong></div>
          <div><span>Tukenme Tarihi</span><strong>{item.estimatedStockoutDate ? formatDate(item.estimatedStockoutDate) : '-'}</strong></div>
        </div>
        <p className="purchase-recommendations-notes">{item.reason}</p>
      </section>

      <section className="card purchase-recommendations-detail-card">
        <h3>Risk ve Kazanc</h3>
        <div className="purchase-recommendations-opportunity-list">
          <div>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </div>
          <div>
            <strong>{item.action}</strong>
            <span>{item.expectedImpact}</span>
          </div>
        </div>
      </section>

      <section className="card purchase-recommendations-detail-card">
        <h3>Ilgili Moduller</h3>
        <div className="purchase-recommendations-module-list">
          <div>
            <strong>{item.relatedModules.join(', ') || '-'}</strong>
            <span>{item.supplierName || item.alternativeSupplierName || item.stockItemName || item.relatedEntityName}</span>
          </div>
        </div>
      </section>

      <section className="card purchase-recommendations-detail-card">
        <h3>History</h3>
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

function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kirilim</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayit bulunamadi.</div>}
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
          <p className="muted">{formatNumber(series.points.length)} period</p>
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
