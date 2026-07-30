import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { loadEmployees } from '../storage'
import {
  BottleneckAnalysisService,
  BOTTLENECK_REPORT_STATUSES,
  BOTTLENECK_REPORT_STATUS_LABELS,
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_RISK_LEVELS,
  BOTTLENECK_TYPE_LABELS
} from '../bottleneck-analysis/bottleneck-analysis.service'
import { BottleneckPrintService } from '../bottleneck-analysis/bottleneck-print.service'
import type {
  BottleneckAnalysisFilters,
  BottleneckHistoryAction,
  BottleneckReport,
  BottleneckReportCreateInput,
  BottleneckReportStatus,
  BottleneckRiskLevel
} from '../bottleneck-analysis/bottleneck-analysis.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateReportState = BottleneckReportCreateInput

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

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

const getStatusClass = (status: BottleneckReportStatus) => {
  if(status === 'READY' || status === 'ANALYZED') return 'success'
  if(status === 'REVISED') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getRiskClass = (risk: BottleneckRiskLevel) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getHistoryLabel = (action: BottleneckHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'UPDATED') return 'Guncellendi'
  if(action === 'ANALYZED') return 'Analiz Edildi'
  if(action === 'READY') return 'Hazir'
  if(action === 'REVISED') return 'Revize'
  if(action === 'CANCELLED') return 'Iptal'
  if(action === 'PRINTED') return 'Yazdirildi'
  if(action === 'PDF') return 'PDF'
  if(action === 'EXCEL') return 'Excel'
  return 'Validation'
}

const uniqueOptions = (
  options: Array<{ id: string; name: string }>
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createInitialForm = (
  userName: string
): CreateReportState => ({
  reportDate: getTodayKey(),
  startDate: getTodayKey(),
  endDate: getTodayKey(),
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  workCenterId: ALL_FILTER,
  riskLevel: ALL_FILTER,
  responsiblePerson: userName,
  description: ''
})

const getActionDisabled = (
  report: BottleneckReport | null,
  status: BottleneckReportStatus
) => {
  if(!report) return true
  if(report.status === 'CANCELLED') return true
  return report.status === status
}

export default function BottleneckAnalysis({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<BottleneckReport[]>(() => BottleneckAnalysisService.list(sourceData))
  const [filters, setFilters] = React.useState<BottleneckAnalysisFilters>(() => BottleneckAnalysisService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreateReportState>(() => createInitialForm(userName))
  const filteredRecords = React.useMemo(() => BottleneckAnalysisService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => BottleneckAnalysisService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...records.flatMap(record => record.items.map(item => ({ id: item.productionLineId, name: item.productionLineName })))
  ]), [records, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode || item.machineId} / ${item.machineName || item.entityName}`
  })))), [records])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...records.flatMap(record => record.items.map(item => ({ id: item.employeeId, name: item.employeeName })))
  ]), [records])
  const workCenterOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.items.map(item => ({
    id: item.workCenterId,
    name: item.workCenterName
  })))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = BottleneckAnalysisService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof BottleneckAnalysisFilters>(key: TKey, value: BottleneckAnalysisFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateReportState>(key: TKey, value: CreateReportState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'reportDate'){
        next.startDate = value as string
        next.endDate = value as string
      }
      return next
    })
  }

  const setWeeklyRange = () => {
    setForm(prev => ({ ...prev, endDate: addDays(prev.startDate, 6) }))
  }

  const createReport = () => {
    try{
      const record = BottleneckAnalysisService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName))
      setMessage({ type: 'success', text: `${record.reportNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Bottleneck report olusturulamadi.' })
    }
  }

  const changeStatus = (status: BottleneckReportStatus) => {
    if(!selectedRecord) return
    try{
      const record = BottleneckAnalysisService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.reportNo} ${BOTTLENECK_REPORT_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<BottleneckHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') BottleneckPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') BottleneckPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['bottleneck-analysis'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = BottleneckAnalysisService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.reportNo} Excel export edildi.`
          : `${record.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="bottleneck-analysis-page">
      <div className="page-header">
        <div>
          <h2>Darbogaz Analizi</h2>
          <p className="muted">Production Planning, Capacity Planning, Machine Scheduling ve Workforce Planning ciktilarindan uretim darbogazlarini read-model olarak analiz eder.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid bottleneck-analysis-metric-grid">
        <div className="metric-card">
          <span>Toplam Darbogaz</span>
          <strong>{formatNumber(statistics.totalBottlenecks)}</strong>
          <small>{formatNumber(statistics.averageRiskScore, 1)} ortalama risk</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Darbogaz</span>
          <strong>{formatNumber(statistics.criticalBottlenecks)}</strong>
          <small>{formatNumber(statistics.highRiskBottlenecks)} yuksek risk</small>
        </div>
        <div className="metric-card">
          <span>En Yogun Hat</span>
          <strong>{statistics.topLineName}</strong>
          <small>{formatMinutes(statistics.totalWorkingMinutes)} calisma</small>
        </div>
        <div className="metric-card warning">
          <span>En Yogun Makine</span>
          <strong>{statistics.topMachineName}</strong>
          <small>{formatMinutes(statistics.totalWaitingMinutes)} bekleme</small>
        </div>
        <div className="metric-card">
          <span>Risk Dagilimi</span>
          <strong>{formatNumber(statistics.riskRows.length)}</strong>
          <small>{formatMinutes(statistics.totalSetupMinutes)} setup</small>
        </div>
      </div>

      <section className="card bottleneck-analysis-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Darbogaz Raporu</h3>
            <p className="muted">Mevcut planlama verilerini analiz eder; otomatik optimizasyon, yeniden planlama veya cizelge degisikligi yapmaz.</p>
          </div>
          <div className="bottleneck-analysis-header-actions">
            <button className="btn" type="button" onClick={setWeeklyRange}>Haftalik</button>
            <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
          </div>
        </div>
        <div className="bottleneck-analysis-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Baslangic</span>
            <input type="date" value={form.startDate} onChange={event => updateForm('startDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitis</span>
            <input type="date" value={form.endDate} onChange={event => updateForm('endDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={form.riskLevel} onChange={event => updateForm('riskLevel', event.target.value as BottleneckRiskLevel | 'all')}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {BOTTLENECK_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{BOTTLENECK_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Hat</span>
            <select value={form.productionLineId} onChange={event => updateForm('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Hatlar</option>
              {lineOptions.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Makine</span>
            <select value={form.machineId} onChange={event => updateForm('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Makineler</option>
              {machineOptions.map(machine => <option key={machine.id} value={machine.id}>{machine.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Personel</span>
            <select value={form.employeeId} onChange={event => updateForm('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Personel</option>
              {employeeOptions.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Work Center</span>
            <select value={form.workCenterId} onChange={event => updateForm('workCenterId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Work Center</option>
              {workCenterOptions.map(workCenter => <option key={workCenter.id} value={workCenter.id}>{workCenter.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field bottleneck-analysis-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Darbogaz analiz notu" />
          </label>
        </div>
      </section>

      <section className="card bottleneck-analysis-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} rapor listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(BottleneckAnalysisService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="bottleneck-analysis-filter-grid">
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
            <span>Work Center</span>
            <select value={filters.workCenterId} onChange={event => updateFilter('workCenterId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Work Center</option>
              {workCenterOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.riskLevel} onChange={event => updateFilter('riskLevel', event.target.value as BottleneckAnalysisFilters['riskLevel'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {BOTTLENECK_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{BOTTLENECK_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field bottleneck-analysis-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, makine, hat, personel" />
          </label>
        </div>
      </section>

      <div className="bottleneck-analysis-chart-grid">
        <BarChartCard title="Risk Dagilimi" rows={statistics.riskRows} />
        <BarChartCard title="Tur Bazli" rows={statistics.typeRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <BarChartCard title="Work Center Bazli" rows={statistics.workCenterRows} />
        <LineChartCard series={statistics.monthlyTrend} />
        <LineChartCard series={statistics.riskTrend} />
      </div>

      <div className="product-layout bottleneck-analysis-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Bottleneck Report Listesi</h3>
              <p className="muted">Raporlar mevcut read-model verilerinden hesaplanir; bu fazda optimizasyon uygulanmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.averageRiskScore, 1)}</span>
          </div>
          <div className="table-wrap bottleneck-analysis-table-wrap">
            <table className="data-table bottleneck-analysis-table">
              <thead>
                <tr>
                  <th>Rapor No</th>
                  <th>Tarih</th>
                  <th>Hat / Makine</th>
                  <th>Kritik</th>
                  <th>Toplam</th>
                  <th>Risk</th>
                  <th>Bekleme</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun bottleneck report bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => {
                  const criticalCount = record.items.filter(item => item.riskLevel === 'CRITICAL').length
                  const maxRisk = Math.max(0, ...record.items.map(item => item.riskScore))
                  const waitingMinutes = record.items.reduce((total, item) => total + item.waitingMinutes, 0)
                  return (
                    <tr
                      key={record.id}
                      aria-selected={selectedRecord?.id === record.id}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedRecordId(record.id)
                        setMessage(null)
                      }}
                      onKeyDown={event => {
                        if(event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelectedRecordId(record.id)
                      }}
                    >
                      <td data-label="Rapor No"><strong>{record.reportNo}</strong><span>{record.sourceType}</span></td>
                      <td data-label="Tarih"><strong>{formatDate(record.reportDate)}</strong><span>{formatDate(record.startDate)} - {formatDate(record.endDate)}</span></td>
                      <td data-label="Hat / Makine"><strong>{record.productionLineName}</strong><span>{record.machineCode || record.machineName}</span></td>
                      <td data-label="Kritik">{formatNumber(criticalCount)}</td>
                      <td data-label="Toplam">{formatNumber(record.items.length)}</td>
                      <td data-label="Risk">{formatNumber(maxRisk, 1)}</td>
                      <td data-label="Bekleme">{formatMinutes(waitingMinutes)}</td>
                      <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{BOTTLENECK_REPORT_STATUS_LABELS[record.status]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side bottleneck-analysis-side">
          {selectedRecord ? (
            <BottleneckReportDetailPanel
              report={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card bottleneck-analysis-detail-card">
              <h3>Rapor Detayi</h3>
              <p className="muted">Detay gormek icin bir bottleneck report secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function BottleneckReportDetailPanel({
  onOutput,
  onStatusChange,
  report
}: {
  onOutput: (action: Extract<BottleneckHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: BottleneckReportStatus) => void
  report: BottleneckReport
}){
  const criticalCount = report.items.filter(item => item.riskLevel === 'CRITICAL').length
  const averageRisk = report.items.length > 0 ? report.items.reduce((total, item) => total + item.riskScore, 0) / report.items.length : 0
  const waitingMinutes = report.items.reduce((total, item) => total + item.waitingMinutes, 0)
  const setupMinutes = report.items.reduce((total, item) => total + item.setupMinutes, 0)
  const cleaningMinutes = report.items.reduce((total, item) => total + item.cleaningMinutes, 0)

  return (
    <>
      <section className="card bottleneck-analysis-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{report.productionLineName} / {report.machineName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{BOTTLENECK_REPORT_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="bottleneck-analysis-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="bottleneck-analysis-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ANALYZED')} onClick={() => onStatusChange('ANALYZED')}>Analiz</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'READY')} onClick={() => onStatusChange('READY')}>Hazir</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(report, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="bottleneck-analysis-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong></div>
          <div><span>Toplam</span><strong>{formatNumber(report.items.length)}</strong></div>
          <div><span>Kritik</span><strong>{formatNumber(criticalCount)}</strong></div>
          <div><span>Ortalama Risk</span><strong>{formatNumber(averageRisk, 1)}</strong></div>
          <div><span>Bekleme</span><strong>{formatMinutes(waitingMinutes)}</strong></div>
          <div><span>Setup</span><strong>{formatMinutes(setupMinutes)}</strong></div>
          <div><span>Temizlik</span><strong>{formatMinutes(cleaningMinutes)}</strong></div>
          <div><span>Revizyon</span><strong>{formatNumber(report.revisionNo)}</strong></div>
        </div>
        <p className="bottleneck-analysis-notes">{report.description || '-'}</p>
      </section>

      <section className="card bottleneck-analysis-detail-card">
        <h3>Darbogaz Listesi</h3>
        <div className="bottleneck-analysis-list">
          {report.items.slice(0, 14).map(item => (
            <div className="bottleneck-analysis-list-row" key={item.id}>
              <div>
                <strong>{item.entityName}</strong>
                <span>{BOTTLENECK_TYPE_LABELS[item.bottleneckType]} / {item.productionLineName || item.machineCode || item.employeeName}</span>
              </div>
              <em>{formatNumber(item.riskScore, 1)}</em>
              <span className={`status-pill ${getRiskClass(item.riskLevel)}`}>{BOTTLENECK_RISK_LABELS[item.riskLevel]}</span>
              <p>{formatPercent(item.utilizationPercent)} doluluk / {formatMinutes(item.waitingMinutes)} bekleme / {formatMinutes(item.setupMinutes)} setup</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card bottleneck-analysis-detail-card">
        <h3>Risk Analizi</h3>
        <div className="bottleneck-analysis-list">
          {report.constraints.slice(0, 10).map(constraint => (
            <div className="bottleneck-analysis-list-row" key={constraint.id}>
              <div>
                <strong>{constraint.entityName}</strong>
                <span>{constraint.constraintType} / {constraint.sourceNo}</span>
              </div>
              <em>{formatPercent(constraint.utilizationPercent)}</em>
              <span className={`status-pill ${getRiskClass(constraint.riskLevel)}`}>{BOTTLENECK_RISK_LABELS[constraint.riskLevel]}</span>
              <p>{formatMinutes(constraint.workingMinutes)} calisma / {formatMinutes(constraint.idleMinutes)} bos</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card bottleneck-analysis-detail-card">
        <h3>Nedenler</h3>
        <div className="bottleneck-analysis-list">
          {report.reasons.slice(0, 12).map(reason => (
            <div className="bottleneck-analysis-list-row" key={reason.id}>
              <div>
                <strong>{reason.label}</strong>
                <span>{BOTTLENECK_TYPE_LABELS[reason.type]}</span>
              </div>
              <em>{formatNumber(reason.value, 1)} {reason.unit}</em>
              <span>{formatPercent(reason.impactPercent)}</span>
              <p>{reason.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card bottleneck-analysis-detail-card">
        <h3>Oneriler</h3>
        <div className="bottleneck-analysis-recommendation-list">
          {report.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {report.recommendations.map((recommendation, index) => (
            <div key={`${report.id}_recommendation_${index + 1}`}>
              <strong>{recommendation}</strong>
              <span>BottleneckCalculationService</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card bottleneck-analysis-detail-card">
        <h3>History</h3>
        <div className="bottleneck-analysis-history-list">
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
