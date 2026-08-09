import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { loadEmployees } from '../storage'
import {
  ContinuousImprovementService,
  IMPROVEMENT_AREAS,
  IMPROVEMENT_AREA_LABELS,
  IMPROVEMENT_PRIORITIES,
  IMPROVEMENT_PRIORITY_LABELS,
  IMPROVEMENT_REPORT_STATUS_LABELS,
  IMPROVEMENT_REPORT_STATUSES,
  IMPROVEMENT_RISK_LABELS,
  IMPROVEMENT_RISK_LEVELS
} from '../continuous-improvement/continuous-improvement.service'
import { ImprovementPrintService } from '../continuous-improvement/improvement-print.service'
import type {
  ContinuousImprovementFilters,
  ImprovementArea,
  ImprovementHistoryAction,
  ImprovementPriority,
  ImprovementReport,
  ImprovementReportCreateInput,
  ImprovementReportStatus,
  ImprovementRiskLevel
} from '../continuous-improvement/continuous-improvement.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateReportState = ImprovementReportCreateInput

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

const getStatusClass = (status: ImprovementReportStatus) => {
  if(status === 'READY' || status === 'ANALYZED') return 'success'
  if(status === 'REVISED') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getRiskClass = (risk: ImprovementRiskLevel) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: ImprovementPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
}

const getHistoryLabel = (action: ImprovementHistoryAction) => {
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
  area: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  responsiblePerson: userName,
  description: ''
})

const getActionDisabled = (
  report: ImprovementReport | null,
  status: ImprovementReportStatus
) => {
  if(!report) return true
  if(report.status === 'CANCELLED') return true
  return report.status === status
}

export default function ContinuousImprovement({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<ImprovementReport[]>(() => ContinuousImprovementService.list(sourceData))
  const [filters, setFilters] = React.useState<ContinuousImprovementFilters>(() => ContinuousImprovementService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreateReportState>(() => createInitialForm(userName))
  const filteredRecords = React.useMemo(() => ContinuousImprovementService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => ContinuousImprovementService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...records.flatMap(record => record.opportunities.map(opportunity => ({ id: opportunity.productionLineId, name: opportunity.productionLineName })))
  ]), [records, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.opportunities.map(opportunity => ({
    id: opportunity.machineId,
    name: `${opportunity.machineCode || opportunity.machineId} / ${opportunity.machineName || opportunity.entityName}`
  })))), [records])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...records.flatMap(record => record.opportunities.map(opportunity => ({ id: opportunity.employeeId, name: opportunity.employeeName })))
  ]), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = ContinuousImprovementService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof ContinuousImprovementFilters>(key: TKey, value: ContinuousImprovementFilters[TKey]) => {
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

  const setMonthlyRange = () => {
    setForm(prev => ({ ...prev, endDate: addDays(prev.startDate, 29) }))
  }

  const createReport = () => {
    try{
      const record = ContinuousImprovementService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName))
      setMessage({ type: 'success', text: `${record.reportNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Improvement report olusturulamadi.' })
    }
  }

  const changeStatus = (status: ImprovementReportStatus) => {
    if(!selectedRecord) return
    try{
      const record = ContinuousImprovementService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.reportNo} ${IMPROVEMENT_REPORT_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ImprovementHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') ImprovementPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') ImprovementPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['continuous-improvement'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = ContinuousImprovementService.recordOutput(selectedRecord.id, action, sourceData, userName)
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
    <div className="continuous-improvement-page">
      <div className="page-header">
        <div>
          <h2>Iyilestirme Firsatlari</h2>
          <p className="muted">Planning, scheduling, workforce ve Bottleneck Analysis ciktilarindan read-model iyilestirme onerileri uretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid continuous-improvement-metric-grid">
        <div className="metric-card">
          <span>Toplam Firsat</span>
          <strong>{formatNumber(statistics.totalOpportunities)}</strong>
          <small>{formatNumber(statistics.averageBenefitScore, 1)} ortalama fayda</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Firsatlar</span>
          <strong>{formatNumber(statistics.criticalOpportunities)}</strong>
          <small>{formatNumber(statistics.urgentRecommendations)} acil oneri</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Kazanc</span>
          <strong>{formatMinutes(statistics.expectedGainMinutes)}</strong>
          <small>Read-model tahmini</small>
        </div>
        <div className="metric-card warning">
          <span>Oncelikli Iyilestirme</span>
          <strong>{statistics.topPriorityLabel}</strong>
          <small>{formatNumber(statistics.priorityRows.length)} oncelik kirilimi</small>
        </div>
      </div>

      <section className="card continuous-improvement-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Improvement Raporu</h3>
            <p className="muted">Mevcut verileri analiz eder; otomatik optimizasyon, yeniden planlama veya personel atama yapmaz.</p>
          </div>
          <div className="continuous-improvement-header-actions">
            <button className="btn" type="button" onClick={setMonthlyRange}>Aylik</button>
            <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
          </div>
        </div>
        <div className="continuous-improvement-create-grid">
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
            <span>Alan</span>
            <select value={form.area} onChange={event => updateForm('area', event.target.value as ImprovementArea | 'all')}>
              <option value={ALL_FILTER}>Tum Alanlar</option>
              {IMPROVEMENT_AREAS.map(area => <option key={area} value={area}>{IMPROVEMENT_AREA_LABELS[area]}</option>)}
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
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field continuous-improvement-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Iyilestirme analiz notu" />
          </label>
        </div>
      </section>

      <section className="card continuous-improvement-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} rapor listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(ContinuousImprovementService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="continuous-improvement-filter-grid">
          <label className="form-field">
            <span>Alan</span>
            <select value={filters.area} onChange={event => updateFilter('area', event.target.value as ContinuousImprovementFilters['area'])}>
              <option value={ALL_FILTER}>Tum Alanlar</option>
              {IMPROVEMENT_AREAS.map(area => <option key={area} value={area}>{IMPROVEMENT_AREA_LABELS[area]}</option>)}
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
            <span>Oncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as ContinuousImprovementFilters['priority'])}>
              <option value={ALL_FILTER}>Tum Oncelikler</option>
              {IMPROVEMENT_PRIORITIES.map(priority => <option key={priority} value={priority}>{IMPROVEMENT_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.riskLevel} onChange={event => updateFilter('riskLevel', event.target.value as ContinuousImprovementFilters['riskLevel'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {IMPROVEMENT_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{IMPROVEMENT_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field continuous-improvement-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, makine, hat, personel, oneri" />
          </label>
        </div>
      </section>

      <div className="continuous-improvement-chart-grid">
        <BarChartCard title="Alan Bazli" rows={statistics.areaRows} />
        <BarChartCard title="Oncelik Bazli" rows={statistics.priorityRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <BarChartCard title="Departman Bazli" rows={statistics.departmentRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout continuous-improvement-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Improvement Report Listesi</h3>
              <p className="muted">Raporlar mevcut read-model verilerinden oneriler uretir; bu fazda hicbir aksiyon otomatik uygulanmaz.</p>
            </div>
            <span className="status-pill">{formatMinutes(statistics.expectedGainMinutes)}</span>
          </div>
          <div className="table-wrap continuous-improvement-table-wrap">
            <table className="data-table continuous-improvement-table">
              <thead>
                <tr>
                  <th>Rapor No</th>
                  <th>Tarih</th>
                  <th>Alan</th>
                  <th>Kritik</th>
                  <th>Toplam</th>
                  <th>Kazanc</th>
                  <th>Oncelik</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun improvement report bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => {
                  const criticalCount = record.opportunities.filter(opportunity => opportunity.riskLevel === 'CRITICAL').length
                  const expectedGain = record.opportunities.reduce((total, opportunity) => total + opportunity.expectedGainMinutes, 0)
                  const topPriority = [...record.opportunities].sort((first, second) => second.expectedBenefitScore - first.expectedBenefitScore)[0]?.priority || 'NORMAL'
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
                      <td data-label="Alan"><strong>{record.area === ALL_FILTER ? 'Tum Alanlar' : IMPROVEMENT_AREA_LABELS[record.area]}</strong><span>{record.productionLineName}</span></td>
                      <td data-label="Kritik">{formatNumber(criticalCount)}</td>
                      <td data-label="Toplam">{formatNumber(record.opportunities.length)}</td>
                      <td data-label="Kazanc">{formatMinutes(expectedGain)}</td>
                      <td data-label="Oncelik"><span className={`status-pill ${getPriorityClass(topPriority)}`}>{IMPROVEMENT_PRIORITY_LABELS[topPriority]}</span></td>
                      <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{IMPROVEMENT_REPORT_STATUS_LABELS[record.status]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side continuous-improvement-side">
          {selectedRecord ? (
            <ImprovementReportDetailPanel
              report={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card continuous-improvement-detail-card">
              <h3>Rapor Detayi</h3>
              <p className="muted">Detay gormek icin bir improvement report secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ImprovementReportDetailPanel({
  onOutput,
  onStatusChange,
  report
}: {
  onOutput: (action: Extract<ImprovementHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: ImprovementReportStatus) => void
  report: ImprovementReport
}){
  const criticalCount = report.opportunities.filter(opportunity => opportunity.riskLevel === 'CRITICAL').length
  const urgentCount = report.opportunities.filter(opportunity => opportunity.priority === 'URGENT').length
  const expectedGain = report.opportunities.reduce((total, opportunity) => total + opportunity.expectedGainMinutes, 0)
  const averageBenefit = report.opportunities.length > 0
    ? report.opportunities.reduce((total, opportunity) => total + opportunity.expectedBenefitScore, 0) / report.opportunities.length
    : 0
  const waitingMinutes = report.opportunities.reduce((total, opportunity) => total + opportunity.waitingMinutes, 0)
  const setupMinutes = report.opportunities.reduce((total, opportunity) => total + opportunity.setupMinutes, 0)

  return (
    <>
      <section className="card continuous-improvement-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{report.area === ALL_FILTER ? 'Tum Alanlar' : IMPROVEMENT_AREA_LABELS[report.area]} / {report.productionLineName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(report.status)}`}>{IMPROVEMENT_REPORT_STATUS_LABELS[report.status]}</span>
        </div>

        <div className="continuous-improvement-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="continuous-improvement-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ANALYZED')} onClick={() => onStatusChange('ANALYZED')}>Analiz</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'READY')} onClick={() => onStatusChange('READY')}>Hazir</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(report, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="continuous-improvement-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong></div>
          <div><span>Toplam Firsat</span><strong>{formatNumber(report.opportunities.length)}</strong></div>
          <div><span>Kritik</span><strong>{formatNumber(criticalCount)}</strong></div>
          <div><span>Acil</span><strong>{formatNumber(urgentCount)}</strong></div>
          <div><span>Fayda Skoru</span><strong>{formatNumber(averageBenefit, 1)}</strong></div>
          <div><span>Kazanc</span><strong>{formatMinutes(expectedGain)}</strong></div>
          <div><span>Bekleme</span><strong>{formatMinutes(waitingMinutes)}</strong></div>
          <div><span>Setup</span><strong>{formatMinutes(setupMinutes)}</strong></div>
          <div><span>Revizyon</span><strong>{formatNumber(report.revisionNo)}</strong></div>
        </div>
        <p className="continuous-improvement-notes">{report.description || '-'}</p>
      </section>

      <section className="card continuous-improvement-detail-card">
        <h3>Iyilestirme Listesi</h3>
        <div className="continuous-improvement-list">
          {report.opportunities.slice(0, 14).map(opportunity => (
            <div className="continuous-improvement-list-row" key={opportunity.id}>
              <div>
                <strong>{opportunity.entityName}</strong>
                <span>{IMPROVEMENT_AREA_LABELS[opportunity.area]} / {opportunity.productionLineName || opportunity.machineCode || opportunity.employeeName}</span>
              </div>
              <em>{formatMinutes(opportunity.expectedGainMinutes)}</em>
              <span className={`status-pill ${getPriorityClass(opportunity.priority)}`}>{IMPROVEMENT_PRIORITY_LABELS[opportunity.priority]}</span>
              <p>{opportunity.summary} / Fayda {formatNumber(opportunity.expectedBenefitScore, 1)} / Risk {IMPROVEMENT_RISK_LABELS[opportunity.riskLevel]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card continuous-improvement-detail-card">
        <h3>Risk ve Fayda</h3>
        <div className="continuous-improvement-list">
          {report.opportunities.slice(0, 10).map(opportunity => (
            <div className="continuous-improvement-list-row" key={`${opportunity.id}_risk`}>
              <div>
                <strong>{opportunity.summary}</strong>
                <span>{opportunity.sourceType} / {opportunity.sourceNo}</span>
              </div>
              <em>{formatPercent(opportunity.expectedGainPercent)}</em>
              <span className={`status-pill ${getRiskClass(opportunity.riskLevel)}`}>{IMPROVEMENT_RISK_LABELS[opportunity.riskLevel]}</span>
              <p>{formatMinutes(opportunity.waitingMinutes)} bekleme / {formatMinutes(opportunity.idleMinutes)} bos / {formatPercent(opportunity.utilizationPercent)} doluluk</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card continuous-improvement-detail-card">
        <h3>Oneriler</h3>
        <div className="continuous-improvement-recommendation-list">
          {report.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {report.recommendations.slice(0, 12).map(recommendation => (
            <div key={recommendation.id}>
              <strong>{recommendation.title}</strong>
              <span>{recommendation.action} / {recommendation.ownerRole} / {IMPROVEMENT_PRIORITY_LABELS[recommendation.priority]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card continuous-improvement-detail-card">
        <h3>History</h3>
        <div className="continuous-improvement-history-list">
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
