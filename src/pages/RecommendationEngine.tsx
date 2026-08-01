import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { RecommendationPrintService } from '../recommendation-engine/recommendation-print.service'
import {
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_PRIORITY_LABELS,
  RECOMMENDATION_RISKS,
  RECOMMENDATION_RISK_LABELS,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TYPE_LABELS,
  RecommendationService
} from '../recommendation-engine/recommendation.service'
import type {
  RecommendationFilters,
  RecommendationHistoryAction,
  RecommendationItem,
  RecommendationPriority,
  RecommendationReport,
  RecommendationReportCreateInput,
  RecommendationRisk,
  RecommendationStatus
} from '../recommendation-engine/recommendation-engine.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber
} from '../kpi-reporting/kpi.utils'
import {
  getDecisionEntityTypeLabel,
  getDecisionSourceModuleLabel
} from '../decision-support/decision-support-ui.utils'
import { loadEmployees } from '../storage'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type RecommendationRow = {
  report: RecommendationReport
  item: RecommendationItem
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

const getRiskClass = (risk: RecommendationRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: RecommendationPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: RecommendationStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: RecommendationHistoryAction) => {
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
  report: RecommendationReport | null,
  status: Extract<RecommendationStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

export default function RecommendationEngine({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<RecommendationReport[]>(() => RecommendationService.list(sourceData))
  const [filters, setFilters] = React.useState<RecommendationFilters>(() => RecommendationService.createDefaultFilters())
  const [selectedItemId, setSelectedItemId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<RecommendationReportCreateInput>(() => RecommendationService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => RecommendationService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<RecommendationRow[]>(() => (
    filteredReports.flatMap(report => report.items.map(item => ({ report, item })))
  ), [filteredReports])
  const statistics = React.useMemo(() => RecommendationService.statistics(reports), [reports])
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
    ...reports.flatMap(report => report.items.map(item => ({ id: item.productionLineId, name: item.productionLineName })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode || item.machineId} / ${item.machineName || item.relatedEntityName}`
  })))), [reports])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...reports.flatMap(report => report.items.map(item => ({ id: item.employeeId, name: item.employeeName || item.employeeId })))
  ]), [reports])

  React.useEffect(() => {
    if(selectedItemId && rows.some(row => row.item.id === selectedItemId)) return
    setSelectedItemId(rows[0]?.item.id || '')
  }, [rows, selectedItemId])

  const refreshReports = (targetItemId?: string) => {
    const nextReports = RecommendationService.list(sourceData)
    setReports(nextReports)
    if(targetItemId) setSelectedItemId(targetItemId)
  }

  const updateFilter = <TKey extends keyof RecommendationFilters>(key: TKey, value: RecommendationFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof RecommendationReportCreateInput>(key: TKey, value: RecommendationReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = RecommendationService.add(form, sourceData, userName)
      const firstItemId = report.items[0]?.id || ''
      refreshReports(firstItemId)
      setForm(RecommendationService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} otomatik oneri raporu olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Öneri raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<RecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = RecommendationService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({ type: 'success', text: `${report.reportNo} ${RECOMMENDATION_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Öneri durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<RecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') RecommendationPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') RecommendationPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['recommendation-engine'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = RecommendationService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.items[0]?.id || selectedItemId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel export edildi.`
          : `${report.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Öneri çıktısı alınamadı.' })
    }
  }

  return (
    <div className="recommendation-engine-page">
      <div className="page-header">
        <div>
          <h2>Otomatik Oneriler</h2>
          <p className="muted">Tahminleme, kritik alarmlar, planlama, kapasite, stok, kalite ve KPI verilerinden analiz modeli karar önerileri üretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid recommendation-engine-metric-grid">
        <div className="metric-card">
          <span>Toplam Firsat</span>
          <strong>{formatNumber(statistics.totalRecommendations)}</strong>
          <small>{formatNumber(rows.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Oneriler</span>
          <strong>{formatNumber(statistics.criticalRecommendations)}</strong>
          <small>CRITICAL risk</small>
        </div>
        <div className="metric-card warning">
          <span>Bugunku Oneri</span>
          <strong>{formatNumber(statistics.todayRecommendations)}</strong>
          <small>Yeni hesaplanan</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Kazanc</span>
          <strong>{formatNumber(statistics.expectedTotalGain, 1)}</strong>
          <small>Fayda + kapasite + sure</small>
        </div>
        <div className="metric-card">
          <span>Güven Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Risk {formatNumber(statistics.averageRiskScore, 1)}</small>
        </div>
      </div>

      <section className="card recommendation-engine-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Öneri Raporu</h3>
            <p className="muted">Sadece analiz ve oneri olusturur; stok, satin alma, uretim, vardiya veya muhasebe kaydi olusturmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
        </div>
        <div className="recommendation-engine-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as RecommendationReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tum Oneriler</option>
              {RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field recommendation-engine-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Oneri analiz notu" />
          </label>
        </div>
      </section>

      <section className="card recommendation-engine-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} oneri listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(RecommendationService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="recommendation-engine-filter-grid">
          <label className="form-field">
            <span>Oneri Turu</span>
            <select value={filters.recommendationType} onChange={event => updateFilter('recommendationType', event.target.value as RecommendationFilters['recommendationType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {RECOMMENDATION_TYPES.map(type => <option key={type} value={type}>{RECOMMENDATION_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Oncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as RecommendationFilters['priority'])}>
              <option value={ALL_FILTER}>Tum Oncelikler</option>
              {RECOMMENDATION_PRIORITIES.map(priority => <option key={priority} value={priority}>{RECOMMENDATION_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as RecommendationFilters['risk'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {RECOMMENDATION_RISKS.map(risk => <option key={risk} value={risk}>{RECOMMENDATION_RISK_LABELS[risk]}</option>)}
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
            <span>Personel</span>
            <select value={filters.employeeId} onChange={event => updateFilter('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Personel</option>
              {employeeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field recommendation-engine-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, öneri, kaynak, ürün, stok, hat, makine, tedarikçi" />
          </label>
        </div>
      </section>

      <div className="recommendation-engine-chart-grid">
        <BarChartCard title="Oneri Turu" rows={statistics.typeRows} />
        <BarChartCard title="Oncelik Bazli" rows={statistics.priorityRows} />
        <BarChartCard title="Risk Bazli" rows={statistics.riskRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <BarChartCard title="Basari Potansiyeli" rows={statistics.successRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout recommendation-engine-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Oneri Listesi</h3>
              <p className="muted">Öneriler Karar Destek Merkezi ve KPI katmanına veri sağlar; otomatik uygulama yapmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.criticalRecommendations)} kritik</span>
          </div>
          <div className="table-wrap recommendation-engine-table-wrap">
            <table className="data-table recommendation-engine-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Tur</th>
                  <th>Oneri</th>
                  <th>Kaynak</th>
                  <th>Fayda</th>
                  <th>Risk</th>
                  <th>Oncelik</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun oneri bulunamadi.</td></tr>
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
                    <td data-label="Tur"><strong>{RECOMMENDATION_TYPE_LABELS[row.item.recommendationType]}</strong><span>{row.item.ownerRole}</span></td>
                    <td data-label="Oneri"><strong>{row.item.title}</strong><span>{row.item.relatedEntityName}</span></td>
                    <td data-label="Kaynak"><strong>{getDecisionSourceModuleLabel(row.item.sourceModule)}</strong><span>{row.item.sourceNo || getDecisionEntityTypeLabel(row.item.relatedEntityType)}</span></td>
                    <td data-label="Fayda">{formatNumber(row.item.expectedBenefitScore, 1)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.item.risk)}`}>{RECOMMENDATION_RISK_LABELS[row.item.risk]}</span></td>
                    <td data-label="Oncelik"><span className={`status-pill ${getPriorityClass(row.item.priority)}`}>{RECOMMENDATION_PRIORITY_LABELS[row.item.priority]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.report.status)}`}>{RECOMMENDATION_STATUS_LABELS[row.report.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side recommendation-engine-side">
          {selectedRow && selectedReport ? (
            <RecommendationDetailPanel
              item={selectedRow.item}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card recommendation-engine-detail-card">
              <h3>Oneri Detayi</h3>
              <p className="muted">Detay gormek icin bir oneri satiri secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function RecommendationDetailPanel({
  item,
  onOutput,
  onStatusChange,
  report
}: {
  item: RecommendationItem
  onOutput: (action: Extract<RecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<RecommendationStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: RecommendationReport
}){
  return (
    <>
      <section className="card recommendation-engine-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{RECOMMENDATION_TYPE_LABELS[item.recommendationType]} / {item.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getRiskClass(item.risk)}`}>{RECOMMENDATION_RISK_LABELS[item.risk]}</span>
        </div>

        <div className="recommendation-engine-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="recommendation-engine-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arsivle</button>
        </div>

        <div className="recommendation-engine-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Kapsam</span><strong>{report.scope === 'all' ? 'Tum Oneriler' : RECOMMENDATION_TYPE_LABELS[report.scope]}</strong></div>
          <div><span>Risk Skoru</span><strong>{formatNumber(item.riskScore, 1)}</strong></div>
          <div><span>Fayda Skoru</span><strong>{formatNumber(item.expectedBenefitScore, 1)}</strong></div>
          <div><span>Maliyet Etkisi</span><strong>{formatNumber(item.expectedCostImpact, 1)}</strong></div>
          <div><span>Kapasite Kazanci</span><strong>{formatNumber(item.expectedCapacityGain, 1)}</strong></div>
          <div><span>Sure Kazanci</span><strong>{formatNumber(item.expectedTimeGainMinutes, 1)} dk</strong></div>
          <div><span>Güven Skoru</span><strong>{formatNumber(item.confidenceScore, 1)}</strong></div>
          <div><span>Kaynak</span><strong>{item.sourceModule}</strong></div>
          <div><span>Ilgili Moduller</span><strong>{item.relatedModules.join(', ') || '-'}</strong></div>
        </div>
        <p className="recommendation-engine-notes">{item.reason}</p>
      </section>

      <section className="card recommendation-engine-detail-card">
        <h3>Oneri ve Etki</h3>
        <div className="recommendation-engine-recommendation-list">
          <div>
            <strong>{item.action}</strong>
            <span>{item.expectedImpact}</span>
          </div>
          <div>
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </div>
        </div>
      </section>

      <section className="card recommendation-engine-detail-card">
        <h3>History</h3>
        <div className="recommendation-engine-history-list">
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
            <strong>{formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
