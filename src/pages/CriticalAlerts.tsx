import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
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
import { AlertPrintService } from '../critical-alerts/alert-print.service'
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVELS,
  ALERT_PRIORITY_LABELS,
  ALERT_STATUS_LABELS,
  ALERT_STATUSES,
  CriticalAlertService
} from '../critical-alerts/critical-alert.service'
import type {
  AlertHistoryAction,
  AlertLevel,
  AlertStatus,
  CriticalAlert,
  CriticalAlertFilters
} from '../critical-alerts/critical-alert.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
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

const formatMinutes = (value: number) => `${formatNumber(value)} dk`
const formatScore = (value: number) => formatNumber(value, 1)

const getLevelClass = (level: AlertLevel) => {
  if(level === 'CRITICAL') return 'danger-pill'
  if(level === 'HIGH') return 'warning-pill'
  if(level === 'WARNING') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: AlertStatus) => {
  if(status === 'ACTIVE') return 'danger-pill'
  if(status === 'ACKNOWLEDGED') return 'warning-pill'
  if(status === 'RESOLVED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: AlertHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'EVALUATED') return 'Degerlendirildi'
  if(action === 'ACKNOWLEDGED') return 'Goruldu'
  if(action === 'RESOLVED') return 'Kapatildi'
  if(action === 'DISMISSED') return 'Yok Sayildi'
  if(action === 'PRINTED') return 'Yazdirildi'
  if(action === 'PDF') return 'PDF'
  return 'Excel'
}

const uniqueOptions = (
  options: Array<{ id: string; name: string }>
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getActionDisabled = (
  alert: CriticalAlert | null,
  status: Extract<AlertStatus, 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>
) => {
  if(!alert) return true
  if(alert.status === 'RESOLVED' || alert.status === 'DISMISSED') return true
  return alert.status === status
}

export default function CriticalAlerts({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [alerts, setAlerts] = React.useState<CriticalAlert[]>(() => CriticalAlertService.list(sourceData))
  const [filters, setFilters] = React.useState<CriticalAlertFilters>(() => CriticalAlertService.createDefaultFilters())
  const [selectedAlertId, setSelectedAlertId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const filteredAlerts = React.useMemo(() => CriticalAlertService.filter(alerts, filters), [alerts, filters])
  const statistics = React.useMemo(() => CriticalAlertService.statistics(alerts), [alerts])
  const selectedAlert = filteredAlerts.find(alert => alert.id === selectedAlertId)
    || alerts.find(alert => alert.id === selectedAlertId)
    || filteredAlerts[0]
    || alerts[0]
    || null
  const branchOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...alerts.map(alert => ({ id: alert.branchId, name: alert.branchName || alert.branchId }))
  ]), [alerts, sourceData])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...alerts.map(alert => ({ id: alert.productionLineId, name: alert.productionLineName || alert.productionLineId }))
  ]), [alerts, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(alerts.map(alert => ({
    id: alert.machineId,
    name: `${alert.machineCode || alert.machineId} / ${alert.machineName || alert.relatedEntityName}`
  }))), [alerts])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...alerts.map(alert => ({ id: alert.employeeId, name: alert.employeeName || alert.employeeId }))
  ]), [alerts])
  const urgentPriorityCount = alerts.filter(alert => alert.status !== 'RESOLVED' && alert.status !== 'DISMISSED' && alert.priority === 'URGENT').length

  React.useEffect(() => {
    if(selectedAlertId && alerts.some(alert => alert.id === selectedAlertId)) return
    setSelectedAlertId(filteredAlerts[0]?.id || alerts[0]?.id || '')
  }, [alerts, filteredAlerts, selectedAlertId])

  const refreshAlerts = (targetAlertId?: string) => {
    const nextAlerts = CriticalAlertService.list(sourceData)
    setAlerts(nextAlerts)
    if(targetAlertId) setSelectedAlertId(targetAlertId)
  }

  const updateFilter = <TKey extends keyof CriticalAlertFilters>(key: TKey, value: CriticalAlertFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const changeStatus = (status: Extract<AlertStatus, 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>) => {
    if(!selectedAlert) return
    try{
      const alert = CriticalAlertService.updateStatus(selectedAlert.id, status, sourceData, userName)
      refreshAlerts(alert.id)
      setMessage({ type: 'success', text: `${alert.alertNo} ${ALERT_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Alarm durumu guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<AlertHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedAlert) return

    try{
      if(action === 'PRINTED') AlertPrintService.openPrintWindow(selectedAlert, 'A4')
      if(action === 'PDF') AlertPrintService.openPrintWindow(selectedAlert, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['critical-alerts'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedAlert.id],
          userName
        })
      }

      const alert = CriticalAlertService.recordOutput(selectedAlert.id, action, sourceData, userName)
      refreshAlerts(alert.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${alert.alertNo} Excel export edildi.`
          : `${alert.alertNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Alarm ciktisi alinamadi.' })
    }
  }

  return (
    <div className="critical-alerts-page">
      <div className="page-header">
        <div>
          <h2>Kritik Alarmlar</h2>
          <p className="muted">Karar Destek Merkezi; planlama, kalite, stok, lot, HACCP, sevkiyat ve bakım analiz modeli sinyallerinden alarm üretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid critical-alerts-metric-grid">
        <div className="metric-card">
          <span>Toplam Alarm</span>
          <strong>{formatNumber(statistics.totalAlerts)}</strong>
          <small>{formatNumber(filteredAlerts.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Aktif Alarm</span>
          <strong>{formatNumber(statistics.activeAlerts)}</strong>
          <small>{formatNumber(urgentPriorityCount)} acil oncelik</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik</span>
          <strong>{formatNumber(statistics.criticalAlerts)}</strong>
          <small>CRITICAL seviye</small>
        </div>
        <div className="metric-card warning">
          <span>Bugunku Alarm</span>
          <strong>{formatNumber(statistics.todayAlerts)}</strong>
          <small>AL analiz modeli değerlendirmesi</small>
        </div>
        <div className="metric-card success">
          <span>Ortalama Risk</span>
          <strong>{formatScore(statistics.averageRiskScore)}</strong>
          <small>0-100 risk skoru</small>
        </div>
      </div>

      <section className="card critical-alerts-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredAlerts.length)} / {formatNumber(alerts.length)} alarm listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(CriticalAlertService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="critical-alerts-filter-grid">
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value as CriticalAlertFilters['category'])}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {ALERT_CATEGORIES.map(category => <option key={category} value={category}>{ALERT_CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Seviye</span>
            <select value={filters.level} onChange={event => updateFilter('level', event.target.value as CriticalAlertFilters['level'])}>
              <option value={ALL_FILTER}>Tum Seviyeler</option>
              {ALERT_LEVELS.map(level => <option key={level} value={level}>{ALERT_LEVEL_LABELS[level]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as CriticalAlertFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {ALERT_STATUSES.map(status => <option key={status} value={status}>{ALERT_STATUS_LABELS[status]}</option>)}
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
          <label className="form-field critical-alerts-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Alarm no, kaynak, urun, lot, makine, oneri" />
          </label>
        </div>
      </section>

      <div className="critical-alerts-chart-grid">
        <BarChartCard title="Kategori Bazli" rows={statistics.categoryRows} />
        <BarChartCard title="Seviye Bazli" rows={statistics.levelRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout critical-alerts-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Kritik Alarm Listesi</h3>
              <p className="muted">Alarmlar analiz modeli sonucudur; otomatik stok, üretim veya operasyon kaydı oluşturmaz.</p>
            </div>
            <span className="status-pill">{formatScore(statistics.averageRiskScore)} risk</span>
          </div>
          <div className="table-wrap critical-alerts-table-wrap">
            <table className="data-table critical-alerts-table">
              <thead>
                <tr>
                  <th>Alarm No</th>
                  <th>Seviye</th>
                  <th>Kategori</th>
                  <th>Kaynak</th>
                  <th>Varlik</th>
                  <th>Risk</th>
                  <th>Tekrar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun critical alert bulunamadi.</td></tr>
                )}
                {filteredAlerts.map(alert => (
                  <tr
                    key={alert.id}
                    aria-selected={selectedAlert?.id === alert.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedAlertId(alert.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedAlertId(alert.id)
                    }}
                  >
                    <td data-label="Alarm No"><strong>{alert.alertNo}</strong><span>{formatDateTime(alert.createdAt)}</span></td>
                    <td data-label="Seviye"><span className={`status-pill ${getLevelClass(alert.level)}`}>{ALERT_LEVEL_LABELS[alert.level]}</span></td>
                    <td data-label="Kategori"><strong>{ALERT_CATEGORY_LABELS[alert.category]}</strong><span>{ALERT_PRIORITY_LABELS[alert.priority]}</span></td>
                    <td data-label="Kaynak"><strong>{alert.sourceModule}</strong><span>{alert.sourceNo || '-'}</span></td>
                    <td data-label="Varlik"><strong>{alert.relatedEntityName || '-'}</strong><span>{alert.lotNo || alert.machineCode || alert.branchName || '-'}</span></td>
                    <td data-label="Risk">{formatScore(alert.riskScore)}</td>
                    <td data-label="Tekrar">{formatNumber(alert.repeatCount)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(alert.status)}`}>{ALERT_STATUS_LABELS[alert.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side critical-alerts-side">
          {selectedAlert ? (
            <CriticalAlertDetailPanel
              alert={selectedAlert}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card critical-alerts-detail-card">
              <h3>Alarm Detayi</h3>
              <p className="muted">Detay gormek icin bir critical alert secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function CriticalAlertDetailPanel({
  alert,
  onOutput,
  onStatusChange
}: {
  alert: CriticalAlert
  onOutput: (action: Extract<AlertHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<AlertStatus, 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>) => void
}){
  return (
    <>
      <section className="card critical-alerts-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{alert.alertNo}</h3>
            <p className="muted">{getDecisionSourceModuleLabel(alert.sourceModule)} / {alert.sourceNo || alert.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getLevelClass(alert.level)}`}>{ALERT_LEVEL_LABELS[alert.level]}</span>
        </div>

        <div className="critical-alerts-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="critical-alerts-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(alert, 'ACKNOWLEDGED')} onClick={() => onStatusChange('ACKNOWLEDGED')}>Goruldu</button>
          <button className="btn" type="button" disabled={getActionDisabled(alert, 'RESOLVED')} onClick={() => onStatusChange('RESOLVED')}>Kapat</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(alert, 'DISMISSED')} onClick={() => onStatusChange('DISMISSED')}>Yok Say</button>
        </div>

        <div className="critical-alerts-detail-grid">
          <div><span>Kategori</span><strong>{ALERT_CATEGORY_LABELS[alert.category]}</strong></div>
          <div><span>Durum</span><strong>{ALERT_STATUS_LABELS[alert.status]}</strong></div>
          <div><span>Oncelik</span><strong>{ALERT_PRIORITY_LABELS[alert.priority]}</strong></div>
          <div><span>Risk Skoru</span><strong>{formatScore(alert.riskScore)}</strong></div>
          <div><span>Impact</span><strong>{formatScore(alert.impactScore)}</strong></div>
          <div><span>Sure</span><strong>{formatMinutes(alert.durationMinutes)}</strong></div>
          <div><span>Tekrar</span><strong>{formatNumber(alert.repeatCount)}</strong></div>
          <div><span>Ilk Tespit</span><strong>{formatDate(alert.firstDetectedAt)}</strong></div>
          <div><span>Son Tespit</span><strong>{formatDate(alert.lastDetectedAt)}</strong></div>
          <div><span>Lot</span><strong>{alert.lotNo || '-'}</strong></div>
          <div><span>Hat</span><strong>{alert.productionLineName || '-'}</strong></div>
          <div><span>Makine</span><strong>{alert.machineCode || alert.machineName || '-'}</strong></div>
        </div>
        <p className="critical-alerts-notes">{alert.description || alert.title}</p>
      </section>

      <section className="card critical-alerts-detail-card">
        <h3>Alarm Nedeni</h3>
        <div className="critical-alerts-recommendation-list">
          <div>
            <strong>{alert.reason}</strong>
            <span>{getDecisionEntityTypeLabel(alert.relatedEntityType)} / {alert.relatedEntityName || '-'}</span>
          </div>
        </div>
      </section>

      <section className="card critical-alerts-detail-card">
        <h3>Karar Destek Önerisi</h3>
        <div className="critical-alerts-recommendation-list">
          <div>
            <strong>{alert.recommendedAction}</strong>
            <span>{alert.expectedImpact}</span>
          </div>
        </div>
      </section>

      <section className="card critical-alerts-detail-card">
        <h3>History</h3>
        <div className="critical-alerts-history-list">
          {[...alert.history].reverse().map(history => (
            <div key={history.id}>
              <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
              <span>{formatDateTime(history.createdAt)}</span>
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
