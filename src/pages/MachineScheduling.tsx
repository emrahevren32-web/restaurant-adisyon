import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { SchedulingPrintService } from '../machine-scheduling/scheduling-print.service'
import {
  MACHINE_SCHEDULE_ITEM_STATUS_LABELS,
  MACHINE_SCHEDULE_STATUSES,
  MACHINE_SCHEDULE_STATUS_LABELS,
  MACHINE_SCHEDULING_SHIFT_OPTIONS,
  MachineSchedulingService
} from '../machine-scheduling/machine-scheduling.service'
import type {
  MachineSchedule,
  MachineScheduleCreateInput,
  MachineSchedulingFilters,
  MachineScheduleStatus,
  SchedulingHistoryAction
} from '../machine-scheduling/machine-scheduling.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateScheduleState = MachineScheduleCreateInput

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

const formatTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

const formatMinutes = (value: number) => `${formatNumber(value)} dk`

const getStatusClass = (status: MachineScheduleStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'READY' || status === 'RUNNING' || status === 'PLANNED') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: SchedulingHistoryAction) => {
  const labels: Record<SchedulingHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    PLANNED: 'Planlandi',
    READY: 'Hazir',
    RUNNING: 'Calisiyor',
    COMPLETED: 'Tamamlandi',
    REVISED: 'Revize',
    CANCELLED: 'Iptal',
    PRINTED: 'Yazdirildi',
    PDF: 'PDF',
    EXCEL: 'Excel',
    VALIDATION: 'Validation'
  }

  return labels[action] || action
}

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name || record.id])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createInitialForm = (
  userName: string
): CreateScheduleState => {
  const today = getTodayKey()

  return {
    scheduleDate: today,
    startDate: today,
    endDate: today,
    machineId: ALL_FILTER,
    productionLineId: ALL_FILTER,
    workCenterId: ALL_FILTER,
    shift: 'Sabah',
    responsiblePerson: userName,
    description: ''
  }
}

const getActionDisabled = (
  schedule: MachineSchedule | null,
  status: MachineScheduleStatus
) => {
  if(!schedule) return true
  if(schedule.status === 'CANCELLED') return true
  return schedule.status === status
}

export default function MachineScheduling({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<MachineSchedule[]>(() => MachineSchedulingService.list(sourceData))
  const [filters, setFilters] = React.useState<MachineSchedulingFilters>(() => MachineSchedulingService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreateScheduleState>(() => createInitialForm(userName))
  const filteredRecords = React.useMemo(() => MachineSchedulingService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => MachineSchedulingService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const machineOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.timelines.map(timeline => ({
    id: timeline.machineId,
    name: `${timeline.machineCode} / ${timeline.machineName}`
  })))), [records])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...records.flatMap(record => record.timelines.map(timeline => ({ id: timeline.productionLineId, name: timeline.productionLineName })))
  ]), [records, sourceData])
  const workCenterOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.timelines.map(timeline => ({
    id: timeline.workCenterId,
    name: timeline.workCenterName
  })))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = MachineSchedulingService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof MachineSchedulingFilters>(key: TKey, value: MachineSchedulingFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateScheduleState>(key: TKey, value: CreateScheduleState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'scheduleDate'){
        next.startDate = value as string
        next.endDate = value as string
      }
      if(key === 'shift' && value === 'Haftalik') next.endDate = addDays(next.startDate, 6)
      if(key === 'shift' && value === 'Aylik') next.endDate = addDays(next.startDate, 29)
      return next
    })
  }

  const createSchedule = () => {
    try{
      const record = MachineSchedulingService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName))
      setMessage({ type: 'success', text: `${record.scheduleNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Makine cizelgesi olusturulamadi.' })
    }
  }

  const changeStatus = (status: MachineScheduleStatus) => {
    if(!selectedRecord) return
    try{
      const record = MachineSchedulingService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.scheduleNo} ${MACHINE_SCHEDULE_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<SchedulingHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') SchedulingPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') SchedulingPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['machine-scheduling'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = MachineSchedulingService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.scheduleNo} Excel export edildi.`
          : `${record.scheduleNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="machine-scheduling-page">
      <div className="page-header">
        <div>
          <h2>Makine Cizelgeleme</h2>
          <p className="muted">Production Planning ve Capacity Planning tarafindan hesaplanan isleri makine, hat, work center ve zaman cizelgesinde read-model olarak gosterir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid machine-scheduling-metric-grid">
        <div className="metric-card">
          <span>Bugunku Cizelge</span>
          <strong>{formatNumber(statistics.todaySchedules)}</strong>
          <small>{formatNumber(statistics.totalSchedules)} aktif cizelge</small>
        </div>
        <div className="metric-card">
          <span>Calisan Makineler</span>
          <strong>{formatNumber(statistics.runningMachines)}</strong>
          <small>{formatNumber(statistics.totalMachines)} toplam makine</small>
        </div>
        <div className="metric-card">
          <span>Bos Makineler</span>
          <strong>{formatNumber(statistics.idleMachines)}</strong>
          <small>Timeline bosluk analizi</small>
        </div>
        <div className="metric-card warning">
          <span>Bekleyen Isler</span>
          <strong>{formatNumber(statistics.pendingJobs)}</strong>
          <small>{formatMinutes(statistics.totalWaitingMinutes)} bekleme</small>
        </div>
        <div className="metric-card danger">
          <span>Cakismalar</span>
          <strong>{formatNumber(statistics.conflictCount)}</strong>
          <small>{formatMinutes(statistics.totalSetupMinutes)} setup</small>
        </div>
      </div>

      <section className="card machine-scheduling-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Makine Cizelgesi</h3>
            <p className="muted">Mevcut kapasite ve uretim planlarindan cizelge read-modeli uretir; AI scheduling, finite scheduling veya otomatik yeniden planlama yapmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.scheduleDate || !form.responsiblePerson} onClick={createSchedule}>Cizelge Olustur</button>
        </div>
        <div className="machine-scheduling-create-grid">
          <label className="form-field">
            <span>Cizelge Tarihi</span>
            <input type="date" value={form.scheduleDate} onChange={event => updateForm('scheduleDate', event.target.value)} />
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
            <span>Vardiya</span>
            <select value={form.shift} onChange={event => updateForm('shift', event.target.value)}>
              {MACHINE_SCHEDULING_SHIFT_OPTIONS.map(shift => <option key={shift} value={shift}>{shift}</option>)}
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
            <span>Hat</span>
            <select value={form.productionLineId} onChange={event => updateForm('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Hatlar</option>
              {lineOptions.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}
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
          <label className="form-field machine-scheduling-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Cizelgeleme notu" />
          </label>
        </div>
      </section>

      <section className="card machine-scheduling-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} cizelge listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(MachineSchedulingService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="machine-scheduling-filter-grid">
          <label className="form-field">
            <span>Makine</span>
            <select value={filters.machineId} onChange={event => updateFilter('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Makineler</option>
              {machineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Work Center</span>
            <select value={filters.workCenterId} onChange={event => updateFilter('workCenterId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Work Center</option>
              {workCenterOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as MachineSchedulingFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {MACHINE_SCHEDULE_STATUSES.map(status => <option key={status} value={status}>{MACHINE_SCHEDULE_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field machine-scheduling-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Plan no, makine, urun, hat" />
          </label>
        </div>
      </section>

      <div className="machine-scheduling-chart-grid">
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Setup Suresi" rows={statistics.setupRows} />
        <BarChartCard title="Durum Bazli" rows={statistics.statusRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout machine-scheduling-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Machine Schedule Listesi</h3>
              <p className="muted">Cizelgeler kapasite read-modelinden hesaplanir; bu fazda otomatik yeniden planlama yapilmaz.</p>
            </div>
            <span className="status-pill">{formatPercent(statistics.machineUtilizationPercent)}</span>
          </div>
          <div className="table-wrap machine-scheduling-table-wrap">
            <table className="data-table machine-scheduling-table">
              <thead>
                <tr>
                  <th>Plan No</th>
                  <th>Tarih</th>
                  <th>Makine</th>
                  <th>Hat / Work Center</th>
                  <th>Gorev</th>
                  <th>Calisma</th>
                  <th>Cakisma</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun makine cizelgesi bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => {
                  const workingMinutes = record.items.reduce((total, item) => total + item.totalWorkingMinutes, 0)
                  const conflictCount = record.items.filter(item => item.conflict).length
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
                      <td data-label="Plan No"><strong>{record.scheduleNo}</strong><span>{record.sourceType}</span></td>
                      <td data-label="Tarih"><strong>{formatDate(record.scheduleDate)}</strong><span>{formatDate(record.startDate)} - {formatDate(record.endDate)}</span></td>
                      <td data-label="Makine"><strong>{record.machineCode || 'Tum'}</strong><span>{record.machineName}</span></td>
                      <td data-label="Hat / Work Center"><strong>{record.productionLineName}</strong><span>{record.workCenterName}</span></td>
                      <td data-label="Gorev">{formatNumber(record.items.length)}</td>
                      <td data-label="Calisma">{formatMinutes(workingMinutes)}</td>
                      <td data-label="Cakisma">{formatNumber(conflictCount)}</td>
                      <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{MACHINE_SCHEDULE_STATUS_LABELS[record.status]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side machine-scheduling-side">
          {selectedRecord ? (
            <MachineScheduleDetailPanel
              schedule={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card machine-scheduling-detail-card">
              <h3>Cizelge Detayi</h3>
              <p className="muted">Detay gormek icin bir makine cizelgesi secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function MachineScheduleDetailPanel({
  onOutput,
  onStatusChange,
  schedule
}: {
  onOutput: (action: Extract<SchedulingHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: MachineScheduleStatus) => void
  schedule: MachineSchedule
}){
  const workingMinutes = schedule.items.reduce((total, item) => total + item.totalWorkingMinutes, 0)
  const setupMinutes = schedule.items.reduce((total, item) => total + item.setupMinutes, 0)
  const cleaningMinutes = schedule.items.reduce((total, item) => total + item.cleaningMinutes, 0)
  const waitingMinutes = schedule.items.reduce((total, item) => total + item.waitingMinutes, 0)
  const conflictCount = schedule.items.filter(item => item.conflict).length

  return (
    <>
      <section className="card machine-scheduling-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{schedule.scheduleNo}</h3>
            <p className="muted">{schedule.machineName} / {schedule.productionLineName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(schedule.status)}`}>{MACHINE_SCHEDULE_STATUS_LABELS[schedule.status]}</span>
        </div>

        <div className="machine-scheduling-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="machine-scheduling-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(schedule, 'PLANNED')} onClick={() => onStatusChange('PLANNED')}>Planla</button>
          <button className="btn" type="button" disabled={getActionDisabled(schedule, 'READY')} onClick={() => onStatusChange('READY')}>Hazir</button>
          <button className="btn" type="button" disabled={getActionDisabled(schedule, 'RUNNING')} onClick={() => onStatusChange('RUNNING')}>Calistir</button>
          <button className="btn" type="button" disabled={getActionDisabled(schedule, 'COMPLETED')} onClick={() => onStatusChange('COMPLETED')}>Tamamla</button>
          <button className="btn" type="button" disabled={getActionDisabled(schedule, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(schedule, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="machine-scheduling-detail-grid">
          <div><span>Cizelge Tarihi</span><strong>{formatDate(schedule.scheduleDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}</strong></div>
          <div><span>Makine</span><strong>{schedule.machineCode || 'Tum Makineler'}</strong></div>
          <div><span>Vardiya</span><strong>{schedule.shift}</strong></div>
          <div><span>Calisma</span><strong>{formatMinutes(workingMinutes)}</strong></div>
          <div><span>Setup</span><strong>{formatMinutes(setupMinutes)}</strong></div>
          <div><span>Temizlik</span><strong>{formatMinutes(cleaningMinutes)}</strong></div>
          <div><span>Bekleme</span><strong>{formatMinutes(waitingMinutes)}</strong></div>
          <div><span>Cakisma</span><strong>{formatNumber(conflictCount)}</strong></div>
          <div><span>Revizyon</span><strong>{formatNumber(schedule.revisionNo)}</strong></div>
        </div>
        <p className="machine-scheduling-notes">{schedule.description || '-'}</p>
      </section>

      <section className="card machine-scheduling-detail-card">
        <h3>Makine Timeline</h3>
        <div className="machine-scheduling-list">
          {schedule.timelines.map(timeline => (
            <div className="machine-scheduling-timeline-row" key={timeline.id}>
              <div>
                <strong>{timeline.machineCode} / {timeline.machineName}</strong>
                <span>{formatTime(timeline.availableStartAt)} - {formatTime(timeline.availableEndAt)} / {formatPercent(timeline.utilizationPercent)}</span>
              </div>
              <div className="machine-scheduling-timeline-track">
                {timeline.segments.length === 0 && <span className="empty-segment" />}
                {timeline.segments.map(segment => (
                  <span
                    className={segment.conflict ? 'conflict' : ''}
                    key={segment.id}
                    style={{ width: `${Math.max(6, (segment.durationMinutes / Math.max(1, timeline.availableMinutes)) * 100)}%` }}
                    title={`${segment.label} / ${formatMinutes(segment.durationMinutes)}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card machine-scheduling-detail-card">
        <h3>Is Kuyrugu</h3>
        <div className="machine-scheduling-list">
          {schedule.queues.map(queue => (
            <div className="machine-scheduling-list-row" key={queue.id}>
              <div>
                <strong>{queue.machineCode} / {queue.machineName}</strong>
                <span>{queue.productionLineName} / {queue.workCenterName}</span>
              </div>
              <em>{formatNumber(queue.itemCount)} is</em>
              <span>{formatPercent(queue.utilizationPercent)}</span>
              <p>{formatMinutes(queue.totalWorkingMinutes)} calisma / {formatMinutes(queue.totalWaitingMinutes)} bekleme / {formatNumber(queue.conflictCount)} cakisma</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card machine-scheduling-detail-card">
        <h3>Cizelge Satirlari</h3>
        <div className="machine-scheduling-list">
          {schedule.items.slice(0, 12).map(item => (
            <div className="machine-scheduling-list-row" key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>{item.machineCode} / {item.recipeName}</span>
              </div>
              <em>{formatTime(item.startAt)} - {formatTime(item.endAt)}</em>
              <span className={`status-pill ${item.conflict ? 'danger-pill' : item.status === 'READY' || item.status === 'RUNNING' ? 'warning-pill' : 'muted-pill'}`}>{MACHINE_SCHEDULE_ITEM_STATUS_LABELS[item.status]}</span>
              <p>Tahmini {formatMinutes(item.estimatedMinutes)} / setup {formatMinutes(item.setupMinutes)} / temizlik {formatMinutes(item.cleaningMinutes)} / bekleme {formatMinutes(item.waitingMinutes)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card machine-scheduling-detail-card">
        <h3>Oneriler</h3>
        <div className="machine-scheduling-recommendation-list">
          {schedule.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {schedule.recommendations.map((recommendation, index) => (
            <div key={`${schedule.id}_recommendation_${index + 1}`}>
              <strong>{recommendation}</strong>
              <span>SchedulingCalculationService</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card machine-scheduling-detail-card">
        <h3>History</h3>
        <div className="machine-scheduling-history-list">
          {[...schedule.history].reverse().map(history => (
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
