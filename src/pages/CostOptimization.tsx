import React from 'react'
import {
  COST_OPTIMIZATION_CATEGORIES,
  COST_OPTIMIZATION_CATEGORY_LABELS,
  COST_OPTIMIZATION_PRIORITIES,
  COST_OPTIMIZATION_PRIORITY_LABELS,
  COST_OPTIMIZATION_RISKS,
  COST_OPTIMIZATION_RISK_LABELS,
  COST_OPTIMIZATION_STATUS_LABELS,
  CostOptimizationService
} from '../cost-optimization/cost-optimization.service'
import { CostPrintService } from '../cost-optimization/cost-print.service'
import type {
  CostHistoryAction,
  CostOptimizationFilters,
  CostOptimizationItem,
  CostOptimizationPriority,
  CostOptimizationReport,
  CostOptimizationReportCreateInput,
  CostOptimizationRisk,
  CostOptimizationStatus
} from '../cost-optimization/cost-optimization.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CostOptimizationRow = {
  report: CostOptimizationReport
  item: CostOptimizationItem
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

const getRiskClass = (risk: CostOptimizationRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: CostOptimizationPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: CostOptimizationStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: CostHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'ANALYZED') return 'Analiz Edildi'
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
  report: CostOptimizationReport | null,
  status: Extract<CostOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

export default function CostOptimization({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<CostOptimizationReport[]>(() => CostOptimizationService.list(sourceData))
  const [filters, setFilters] = React.useState<CostOptimizationFilters>(() => CostOptimizationService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CostOptimizationReportCreateInput>(() => CostOptimizationService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => CostOptimizationService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<CostOptimizationRow[]>(() => (
    filteredReports.flatMap(report => report.items.map(item => ({ report, item })))
  ), [filteredReports])
  const statistics = React.useMemo(() => CostOptimizationService.statistics(reports), [reports])
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
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productId, name: item.productName || item.relatedEntityName })))
  ]), [reports, sourceData])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productionLineId, name: item.productionLineName })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode || item.machineId} / ${item.machineName || item.relatedEntityName}`
  })))), [reports])
  const supplierOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.suppliers.map(supplier => ({ id: supplier.id, name: supplier.name })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.supplierId, name: item.supplierName || item.supplierId })))
  ]), [reports, sourceData])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = CostOptimizationService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof CostOptimizationFilters>(key: TKey, value: CostOptimizationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CostOptimizationReportCreateInput>(key: TKey, value: CostOptimizationReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = CostOptimizationService.add(form, sourceData, userName)
      const firstItemId = report.items[0]?.id || ''
      refreshReports(firstItemId)
      setForm(CostOptimizationService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} maliyet optimizasyon raporu olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Maliyet optimizasyon raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<CostOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = CostOptimizationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${COST_OPTIMIZATION_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Maliyet optimizasyon durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<CostHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') CostPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') CostPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['cost-optimization'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = CostOptimizationService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel export edildi.`
          : `${report.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Maliyet optimizasyon çıktısı alınamadı.' })
    }
  }

  return (
    <div className="cost-optimization-page">
      <div className="page-header">
        <div>
          <h2>Maliyet Optimizasyonu</h2>
          <p className="muted">Planlama, tahminleme, öneri, yapay zeka analizi, satın alma, fire ve reçete maliyeti verilerinden analiz modeli tasarruf fırsatları üretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid cost-optimization-metric-grid">
        <div className="metric-card success">
          <span>Toplam Tasarruf</span>
          <strong>{formatCurrency(statistics.totalSaving)}</strong>
          <small>{formatNumber(rows.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Maliyetler</span>
          <strong>{formatNumber(statistics.criticalCosts)}</strong>
          <small>CRITICAL veya URGENT</small>
        </div>
        <div className="metric-card warning">
          <span>En Buyuk Alan</span>
          <strong>{statistics.largestSavingLabel}</strong>
          <small>Tasarruf siralamasi</small>
        </div>
        <div className="metric-card">
          <span>Yillik Kazanc</span>
          <strong>{formatCurrency(statistics.expectedAnnualGain)}</strong>
          <small>Aylik {formatCurrency(statistics.expectedMonthlyGain)}</small>
        </div>
        <div className="metric-card">
          <span>ROI / Güven Skoru</span>
          <strong>{formatPercent(statistics.averageRoi)}</strong>
          <small>{formatNumber(statistics.averageConfidence, 1)} güven</small>
        </div>
      </div>

      <section className="card cost-optimization-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Maliyet Optimizasyon Raporu</h3>
            <p className="muted">Sadece analiz ve oneri uretir; satin alma, stok, uretim, recete veya muhasebe kaydi olusturmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
        </div>
        <div className="cost-optimization-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as CostOptimizationReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {COST_OPTIMIZATION_CATEGORIES.map(category => <option key={category} value={category}>{COST_OPTIMIZATION_CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field cost-optimization-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Maliyet optimizasyon notu" />
          </label>
        </div>
      </section>

      <section className="card cost-optimization-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} maliyet kalemi listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(CostOptimizationService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="cost-optimization-filter-grid">
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value as CostOptimizationFilters['category'])}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {COST_OPTIMIZATION_CATEGORIES.map(category => <option key={category} value={category}>{COST_OPTIMIZATION_CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Oncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as CostOptimizationFilters['priority'])}>
              <option value={ALL_FILTER}>Tum Oncelikler</option>
              {COST_OPTIMIZATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{COST_OPTIMIZATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as CostOptimizationFilters['risk'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {COST_OPTIMIZATION_RISKS.map(risk => <option key={risk} value={risk}>{COST_OPTIMIZATION_RISK_LABELS[risk]}</option>)}
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
            <span>Urun</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Urunler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Hat</span>
            <select value={filters.productionLineId} onChange={event => updateFilter('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Hatlar</option>
              {lineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Makine</span>
            <select value={filters.machineId} onChange={event => updateFilter('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Makineler</option>
              {machineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
          <label className="form-field cost-optimization-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, ürün, tedarikçi, hat, makine, maliyet nedeni" />
          </label>
        </div>
      </section>

      <div className="cost-optimization-chart-grid">
        <BarChartCard title="Kategori Dagilimi" rows={statistics.categoryRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Urun Bazli" rows={statistics.productRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Tedarikçi Bazlı" rows={statistics.supplierRows} />
        <LineChartCard series={statistics.monthlyTrend} />
        <LineChartCard series={statistics.yearlyTrend} />
      </div>

      <div className="product-layout cost-optimization-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Optimizasyon Listesi</h3>
              <p className="muted">Firsatlar uygulanmaz; manuel karar icin tasarruf, ROI, risk ve confidence verisi uretir.</p>
            </div>
            <span className="status-pill">{formatCurrency(statistics.totalSaving)} potansiyel</span>
          </div>
          <div className="table-wrap cost-optimization-table-wrap">
            <table className="data-table cost-optimization-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Kategori</th>
                  <th>Firsat</th>
                  <th>Kaynak</th>
                  <th>Tasarruf</th>
                  <th>ROI</th>
                  <th>Risk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun maliyet firsati bulunamadi.</td></tr>
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
                    <td data-label="Kategori"><strong>{COST_OPTIMIZATION_CATEGORY_LABELS[row.item.category]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Firsat"><strong>{row.item.title}</strong><span>{row.item.relatedEntityName}</span></td>
                    <td data-label="Kaynak"><strong>{row.item.sourceModule}</strong><span>{row.item.sourceNo}</span></td>
                    <td data-label="Tasarruf">{formatCurrency(row.item.savingPotential)}</td>
                    <td data-label="ROI">{formatPercent(row.item.roiEstimate)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{COST_OPTIMIZATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.report.status)}`}>{COST_OPTIMIZATION_STATUS_LABELS[row.report.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side cost-optimization-side">
          {selectedRow && selectedReport ? (
            <CostOptimizationDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card cost-optimization-detail-card">
              <h3>Maliyet Detayi</h3>
              <p className="muted">Detay gormek icin bir maliyet firsati secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function CostOptimizationDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: CostOptimizationItem
  onOutput: (action: Extract<CostHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<CostOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: CostOptimizationReport
}){
  const opportunity = report.opportunities.find(record => record.itemId === item.id)

  return (
    <>
      <section className="card cost-optimization-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{COST_OPTIMIZATION_CATEGORY_LABELS[item.category]} / {item.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getPriorityClass(item.priority)}`}>{COST_OPTIMIZATION_PRIORITY_LABELS[item.priority]}</span>
        </div>

        <div className="cost-optimization-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="cost-optimization-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arsivle</button>
        </div>

        <div className="cost-optimization-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Kategori</span><strong>{COST_OPTIMIZATION_CATEGORY_LABELS[item.category]}</strong></div>
          <div><span>Toplam Maliyet</span><strong>{formatCurrency(item.totalCost)}</strong></div>
          <div><span>Optimize Maliyet</span><strong>{formatCurrency(item.optimizedCost)}</strong></div>
          <div><span>Aylik Kazanc</span><strong>{formatCurrency(item.expectedMonthlyGain)}</strong></div>
          <div><span>Yillik Kazanc</span><strong>{formatCurrency(item.expectedAnnualGain)}</strong></div>
          <div><span>ROI</span><strong>{formatPercent(item.roiEstimate)}</strong></div>
          <div><span>Güven Skoru</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Risk Skoru</span><strong>{formatNumber(item.riskScore, 1)}</strong></div>
          <div><span>Kaynak</span><strong>{item.sourceModule}</strong></div>
        </div>
        <p className="cost-optimization-notes">{item.reason}</p>
      </section>

      <section className="card cost-optimization-detail-card">
        <h3>Firsat ve Etki</h3>
        <div className="cost-optimization-opportunity-list">
          <div>
            <strong>{opportunity?.title || item.title}</strong>
            <span>{opportunity?.description || item.description}</span>
          </div>
          <div>
            <strong>{item.action}</strong>
            <span>{item.expectedImpact}</span>
          </div>
        </div>
      </section>

      <section className="card cost-optimization-detail-card">
        <h3>Ilgili Moduller</h3>
        <div className="cost-optimization-module-list">
          <div>
            <strong>{item.relatedModules.join(', ') || '-'}</strong>
            <span>{item.productName || item.machineName || item.supplierName || item.relatedEntityName}</span>
          </div>
        </div>
      </section>

      <section className="card cost-optimization-detail-card">
        <h3>History</h3>
        <div className="cost-optimization-history-list">
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
            <strong>{formatCurrency(point.value)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
