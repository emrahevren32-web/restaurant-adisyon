import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { CapacityPrintService } from '../capacity-planning/capacity-print.service'
import {
  CAPACITY_DEFAULT_SHIFT_OPTIONS,
  CAPACITY_PLAN_STATUSES,
  CAPACITY_PLAN_STATUS_LABELS,
  CAPACITY_RISK_LABELS,
  CapacityPlanningService
} from '../capacity-planning/capacity-planning.service'
import type {
  CapacityHistoryAction,
  CapacityPlan,
  CapacityPlanCreateInput,
  CapacityPlanningFilters,
  CapacityPlanStatus
} from '../capacity-planning/capacity-planning.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreatePlanState = CapacityPlanCreateInput

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

const getStatusClass = (status: CapacityPlanStatus) => {
  if(status === 'APPROVED' || status === 'ANALYZED') return 'success'
  if(status === 'PREPARING' || status === 'REVISED') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: CapacityHistoryAction) => {
  const labels: Record<CapacityHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    PREPARING: 'Hazirlaniyor',
    ANALYZED: 'Analiz Edildi',
    APPROVED: 'Onaylandi',
    REVISED: 'Revize Edildi',
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
): CreatePlanState => {
  const today = getTodayKey()

  return {
    planDate: today,
    startDate: today,
    endDate: today,
    productionLineId: ALL_FILTER,
    workCenterId: ALL_FILTER,
    shift: 'Sabah',
    responsiblePerson: userName,
    description: ''
  }
}

const getActionDisabled = (
  plan: CapacityPlan | null,
  status: CapacityPlanStatus
) => {
  if(!plan) return true
  if(plan.status === 'CANCELLED') return true
  return plan.status === status
}

export default function CapacityPlanning({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const lineOptions = React.useMemo(() => sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })), [sourceData])
  const workCenterOptions = React.useMemo(() => uniqueOptions(sourceData.productionLines.map(line => {
    const workCenter = CapacityPlanningService.calculation.getWorkCenterForLine(line)
    return {
      id: workCenter.workCenterId,
      name: workCenter.workCenterName
    }
  })), [sourceData])
  const [records, setRecords] = React.useState<CapacityPlan[]>(() => CapacityPlanningService.list(sourceData))
  const [filters, setFilters] = React.useState<CapacityPlanningFilters>(() => CapacityPlanningService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreatePlanState>(() => createInitialForm(userName))
  const filteredRecords = React.useMemo(() => CapacityPlanningService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => CapacityPlanningService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const shiftOptions = React.useMemo(() => uniqueOptions([
    ...CAPACITY_DEFAULT_SHIFT_OPTIONS.map(shift => ({ id: shift, name: shift })),
    ...records.map(record => ({ id: record.shift, name: record.shift }))
  ]), [records])
  const machineOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.machineCapacities.map(machine => ({
    id: machine.machineId,
    name: `${machine.machineCode} / ${machine.machineName}`
  })))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = CapacityPlanningService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof CapacityPlanningFilters>(key: TKey, value: CapacityPlanningFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreatePlanState>(key: TKey, value: CreatePlanState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'planDate'){
        next.startDate = value as string
        next.endDate = value as string
      }
      if(key === 'shift' && value === 'Haftalik'){
        next.endDate = addDays(next.startDate, 6)
      }
      if(key === 'shift' && value === 'Aylik'){
        next.endDate = addDays(next.startDate, 29)
      }
      return next
    })
  }

  const createPlan = () => {
    try{
      const record = CapacityPlanningService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName))
      setMessage({ type: 'success', text: `${record.capacityPlanNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Kapasite plani olusturulamadi.' })
    }
  }

  const changeStatus = (status: CapacityPlanStatus) => {
    if(!selectedRecord) return
    try{
      const record = CapacityPlanningService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.capacityPlanNo} ${CAPACITY_PLAN_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<CapacityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') CapacityPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') CapacityPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['capacity-planning'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = CapacityPlanningService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.capacityPlanNo} Excel export edildi.`
          : `${record.capacityPlanNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="capacity-planning-page">
      <div className="page-header">
        <div>
          <h2>Kapasite Planlama</h2>
          <p className="muted">Production Planning, Production Orders, hatlar, makineler, work center, vardiya ve maintenance sinyallerinden gercek kapasite read-modeli uretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid capacity-planning-metric-grid">
        <div className="metric-card">
          <span>Bugunku Kapasite</span>
          <strong>{formatNumber(statistics.todayPlans)}</strong>
          <small>Bugun tarihli planlar</small>
        </div>
        <div className="metric-card">
          <span>Doluluk</span>
          <strong>{formatPercent(statistics.utilizationPercent)}</strong>
          <small>{formatMinutes(statistics.usedCapacityMinutes)} yuk</small>
        </div>
        <div className="metric-card">
          <span>Bos Kapasite</span>
          <strong>{formatMinutes(statistics.idleCapacityMinutes)}</strong>
          <small>{formatMinutes(statistics.totalCapacityMinutes)} toplam</small>
        </div>
        <div className="metric-card warning">
          <span>Darbogaz</span>
          <strong>{formatNumber(statistics.bottleneckCount)}</strong>
          <small>{formatMinutes(statistics.overloadMinutes)} asiri yuk</small>
        </div>
        <div className="metric-card danger">
          <span>Bakim Kapali</span>
          <strong>{formatNumber(statistics.maintenanceClosedLines)}</strong>
          <small>Hat / makine etkisi</small>
        </div>
      </div>

      <section className="card capacity-planning-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Kapasite Plani</h3>
            <p className="muted">Mevcut plan ve operasyon verilerinden analiz kaydi uretir; otomatik vardiya, makine siralama veya optimizasyon yapmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.planDate || !form.responsiblePerson} onClick={createPlan}>Plan Olustur</button>
        </div>
        <div className="capacity-planning-create-grid">
          <label className="form-field">
            <span>Plan Tarihi</span>
            <input type="date" value={form.planDate} onChange={event => updateForm('planDate', event.target.value)} />
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
              {CAPACITY_DEFAULT_SHIFT_OPTIONS.map(shift => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Uretim Hatti</span>
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
          <label className="form-field capacity-planning-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Kapasite analiz notu" />
          </label>
        </div>
      </section>

      <section className="card capacity-planning-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} kapasite plani listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(CapacityPlanningService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="capacity-planning-filter-grid">
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
            <span>Work Center</span>
            <select value={filters.workCenterId} onChange={event => updateFilter('workCenterId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Work Center</option>
              {workCenterOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value)}>
              <option value={ALL_FILTER}>Tum Vardiyalar</option>
              {shiftOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as CapacityPlanningFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {CAPACITY_PLAN_STATUSES.map(status => <option key={status} value={status}>{CAPACITY_PLAN_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field capacity-planning-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Plan no, hat, makine, work center" />
          </label>
        </div>
      </section>

      <div className="capacity-planning-chart-grid">
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Work Center Bazli" rows={statistics.workCenterRows} />
        <BarChartCard title="Durum Bazli" rows={statistics.statusRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout capacity-planning-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Capacity Plan Listesi</h3>
              <p className="muted">Planlar mevcut veri kaynaklarindan hesaplanir; bu fazda otomatik kapasite optimizasyonu yapilmaz.</p>
            </div>
            <span className="status-pill">{formatPercent(statistics.utilizationPercent)}</span>
          </div>
          <div className="table-wrap capacity-planning-table-wrap">
            <table className="data-table capacity-planning-table">
              <thead>
                <tr>
                  <th>Plan No</th>
                  <th>Tarih</th>
                  <th>Hat</th>
                  <th>Work Center</th>
                  <th>Vardiya</th>
                  <th>Kapasite</th>
                  <th>Doluluk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun kapasite plani bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => {
                  const availableMinutes = record.productionCapacities.reduce((total, capacity) => total + capacity.availableMinutes, 0)
                  const loadMinutes = record.productionCapacities.reduce((total, capacity) => total + capacity.totalLoadMinutes, 0)
                  const bottleneckCount = record.productionCapacities.filter(capacity => capacity.bottleneck).length
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
                      <td data-label="Plan No"><strong>{record.capacityPlanNo}</strong><span>{record.sourceType}</span></td>
                      <td data-label="Tarih"><strong>{formatDate(record.planDate)}</strong><span>{formatDate(record.startDate)} - {formatDate(record.endDate)}</span></td>
                      <td data-label="Hat">{record.productionLineName}</td>
                      <td data-label="Work Center">{record.workCenterName}</td>
                      <td data-label="Vardiya">{record.shift}</td>
                      <td data-label="Kapasite"><strong>{formatMinutes(loadMinutes)}</strong><span>{formatMinutes(availableMinutes)} kullanilabilir</span></td>
                      <td data-label="Doluluk"><strong>{formatPercent(availableMinutes > 0 ? loadMinutes / availableMinutes * 100 : 0)}</strong><span>{formatNumber(bottleneckCount)} darbogaz</span></td>
                      <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{CAPACITY_PLAN_STATUS_LABELS[record.status]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side capacity-planning-side">
          {selectedRecord ? (
            <CapacityPlanDetailPanel
              plan={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card capacity-planning-detail-card">
              <h3>Plan Detayi</h3>
              <p className="muted">Detay gormek icin bir kapasite plani secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function CapacityPlanDetailPanel({
  onOutput,
  onStatusChange,
  plan
}: {
  onOutput: (action: Extract<CapacityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: CapacityPlanStatus) => void
  plan: CapacityPlan
}){
  const totalAvailable = plan.productionCapacities.reduce((total, capacity) => total + capacity.availableMinutes, 0)
  const totalLoad = plan.productionCapacities.reduce((total, capacity) => total + capacity.totalLoadMinutes, 0)
  const totalIdle = plan.productionCapacities.reduce((total, capacity) => total + capacity.idleMinutes, 0)
  const totalOverload = plan.productionCapacities.reduce((total, capacity) => total + capacity.overloadMinutes, 0)
  const bottleneckCount = plan.productionCapacities.filter(capacity => capacity.bottleneck).length

  return (
    <>
      <section className="card capacity-planning-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{plan.capacityPlanNo}</h3>
            <p className="muted">{plan.productionLineName} / {plan.workCenterName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(plan.status)}`}>{CAPACITY_PLAN_STATUS_LABELS[plan.status]}</span>
        </div>

        <div className="capacity-planning-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="capacity-planning-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'PREPARING')} onClick={() => onStatusChange('PREPARING')}>Hazirla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'ANALYZED')} onClick={() => onStatusChange('ANALYZED')}>Analiz</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'APPROVED')} onClick={() => onStatusChange('APPROVED')}>Onayla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(plan, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="capacity-planning-detail-grid">
          <div><span>Plan Tarihi</span><strong>{formatDate(plan.planDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(plan.startDate)} - {formatDate(plan.endDate)}</strong></div>
          <div><span>Vardiya</span><strong>{plan.shift}</strong></div>
          <div><span>Sorumlu</span><strong>{plan.responsiblePerson}</strong></div>
          <div><span>Kullanilabilir</span><strong>{formatMinutes(totalAvailable)}</strong></div>
          <div><span>Toplam Yuk</span><strong>{formatMinutes(totalLoad)}</strong></div>
          <div><span>Bos Kapasite</span><strong>{formatMinutes(totalIdle)}</strong></div>
          <div><span>Asiri Yuk</span><strong>{formatMinutes(totalOverload)}</strong></div>
          <div><span>Doluluk</span><strong>{formatPercent(totalAvailable > 0 ? totalLoad / totalAvailable * 100 : 0)}</strong></div>
          <div><span>Darbogaz</span><strong>{formatNumber(bottleneckCount)}</strong></div>
        </div>
        <p className="capacity-planning-notes">{plan.description || '-'}</p>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>Hat Analizi</h3>
        <div className="capacity-planning-list">
          {plan.productionCapacities.map(capacity => (
            <div className="capacity-planning-list-row" key={capacity.id}>
              <div>
                <strong>{capacity.productionLineName}</strong>
                <span>{capacity.productionLineCode} / {capacity.workCenterName} / {capacity.lineStatus}</span>
              </div>
              <em>{formatPercent(capacity.utilizationPercent)}</em>
              <span className={`status-pill ${capacity.riskLevel === 'CRITICAL' ? 'danger-pill' : capacity.riskLevel === 'HIGH' ? 'warning-pill' : 'muted-pill'}`}>{CAPACITY_RISK_LABELS[capacity.riskLevel]}</span>
              <p>{formatMinutes(capacity.totalLoadMinutes)} yuk / {formatMinutes(capacity.availableMinutes)} kullanilabilir / {formatNumber(capacity.machineCount)} makine</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>Makine Analizi</h3>
        <div className="capacity-planning-list">
          {plan.machineCapacities.map(machine => (
            <div className="capacity-planning-list-row" key={machine.id}>
              <div>
                <strong>{machine.machineCode} / {machine.machineName}</strong>
                <span>{machine.productionLineName} / {machine.maintenanceClosed ? 'Bakim Kapali' : machine.active ? 'Aktif' : 'Pasif'}</span>
              </div>
              <em>{formatPercent(machine.utilizationPercent)}</em>
              <span>{formatMinutes(machine.overloadMinutes)} asiri</span>
              <p>{formatMinutes(machine.totalLoadMinutes)} yuk / {formatMinutes(machine.availableMinutes)} kullanilabilir / maintenance {formatMinutes(machine.maintenanceMinutes)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>Work Center Analizi</h3>
        <div className="capacity-planning-list">
          {plan.workCenterCapacities.map(workCenter => (
            <div className="capacity-planning-list-row" key={workCenter.id}>
              <div>
                <strong>{workCenter.workCenterName}</strong>
                <span>{formatNumber(workCenter.lineCount)} hat / {formatNumber(workCenter.machineCount)} makine</span>
              </div>
              <em>{formatPercent(workCenter.utilizationPercent)}</em>
              <span>{formatNumber(workCenter.bottleneckCount)} darbogaz</span>
              <p>{formatMinutes(workCenter.totalLoadMinutes)} yuk / {formatMinutes(workCenter.availableMinutes)} kullanilabilir</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>Plan Yukleri</h3>
        <div className="capacity-planning-list">
          {plan.items.slice(0, 10).map(item => (
            <div className="capacity-planning-list-row" key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>{item.sourceNo} / {item.recipeName}</span>
              </div>
              <em>{formatMinutes(item.totalLoadMinutes)}</em>
              <span>{item.machineCode}</span>
              <p>Uretim {formatMinutes(item.plannedProductionMinutes)} / setup {formatMinutes(item.setupMinutes)} / temizlik {formatMinutes(item.cleaningMinutes)} / depo {formatMinutes(item.warehousePreparationMinutes)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>Oneriler</h3>
        <div className="capacity-planning-recommendation-list">
          {plan.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {plan.recommendations.map((recommendation, index) => (
            <div key={`${plan.id}_recommendation_${index + 1}`}>
              <strong>{recommendation}</strong>
              <span>CapacityCalculationService</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card capacity-planning-detail-card">
        <h3>History</h3>
        <div className="capacity-planning-history-list">
          {[...plan.history].reverse().map(history => (
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
