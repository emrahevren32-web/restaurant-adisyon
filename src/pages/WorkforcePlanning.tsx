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
import { WorkforcePrintService } from '../workforce-planning/workforce-print.service'
import {
  WORKFORCE_DEPARTMENT_OPTIONS,
  WORKFORCE_PLAN_ITEM_STATUS_LABELS,
  WORKFORCE_PLAN_STATUSES,
  WORKFORCE_PLAN_STATUS_LABELS,
  WORKFORCE_SHIFT_OPTIONS,
  WorkforcePlanningService
} from '../workforce-planning/workforce-planning.service'
import type {
  WorkforceHistoryAction,
  WorkforcePlan,
  WorkforcePlanCreateInput,
  WorkforcePlanningFilters,
  WorkforcePlanStatus
} from '../workforce-planning/workforce-planning.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreatePlanState = WorkforcePlanCreateInput

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

const getStatusClass = (status: WorkforcePlanStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'READY' || status === 'PREPARING') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: WorkforceHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'UPDATED') return 'Guncellendi'
  if(action === 'PREPARING') return 'Hazirlaniyor'
  if(action === 'READY') return 'Hazir'
  if(action === 'APPROVED') return 'Onaylandi'
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
): CreatePlanState => ({
  planDate: getTodayKey(),
  startDate: getTodayKey(),
  endDate: getTodayKey(),
  employeeId: ALL_FILTER,
  department: ALL_FILTER,
  shiftName: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  responsiblePerson: userName,
  description: ''
})

const getActionDisabled = (
  plan: WorkforcePlan | null,
  status: WorkforcePlanStatus
) => {
  if(!plan) return true
  if(plan.status === 'CANCELLED') return true
  return plan.status === status
}

export default function WorkforcePlanning({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<WorkforcePlan[]>(() => WorkforcePlanningService.list(sourceData))
  const [filters, setFilters] = React.useState<WorkforcePlanningFilters>(() => WorkforcePlanningService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreatePlanState>(() => createInitialForm(userName))
  const filteredRecords = React.useMemo(() => WorkforcePlanningService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => WorkforcePlanningService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...records.flatMap(record => record.employeeAssignments.map(assignment => ({ id: assignment.employeeId, name: `${assignment.employeeCode} / ${assignment.employeeName}` })))
  ]), [records])
  const departmentOptions = React.useMemo(() => uniqueOptions([
    ...WORKFORCE_DEPARTMENT_OPTIONS.map(department => ({ id: department, name: department })),
    ...records.flatMap(record => record.items.map(item => ({ id: item.department, name: item.department })))
  ]), [records])
  const shiftOptions = React.useMemo(() => uniqueOptions([
    ...WORKFORCE_SHIFT_OPTIONS.map(shift => ({ id: shift, name: shift })),
    ...records.flatMap(record => record.shiftAssignments.map(assignment => ({ id: assignment.shiftName, name: assignment.shiftName })))
  ]), [records])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...records.flatMap(record => record.items.map(item => ({ id: item.productionLineId, name: item.productionLineName })))
  ]), [records, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(records.flatMap(record => record.items.map(item => ({
    id: item.machineId,
    name: `${item.machineCode} / ${item.machineName}`
  })))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = WorkforcePlanningService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof WorkforcePlanningFilters>(key: TKey, value: WorkforcePlanningFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreatePlanState>(key: TKey, value: CreatePlanState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'planDate'){
        next.startDate = value as string
        next.endDate = value as string
      }
      if(key === 'shiftName' && value === 'Haftalik') next.endDate = addDays(next.startDate, 6)
      if(key === 'shiftName' && value === 'Aylik') next.endDate = addDays(next.startDate, 29)
      return next
    })
  }

  const createPlan = () => {
    try{
      const record = WorkforcePlanningService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName))
      setMessage({ type: 'success', text: `${record.planNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Workforce plan olusturulamadi.' })
    }
  }

  const changeStatus = (status: WorkforcePlanStatus) => {
    if(!selectedRecord) return
    try{
      const record = WorkforcePlanningService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.planNo} ${WORKFORCE_PLAN_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<WorkforceHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') WorkforcePrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') WorkforcePrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['workforce-planning'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = WorkforcePlanningService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.planNo} Excel export edildi.`
          : `${record.planNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="workforce-planning-page">
      <div className="page-header">
        <div>
          <h2>Personel Planlama</h2>
          <p className="muted">Production Planning, Capacity Planning ve Machine Scheduling yukunu personel, vardiya, ekip ve uretim hatlari bazinda read-model olarak gosterir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid workforce-planning-metric-grid">
        <div className="metric-card">
          <span>Bugunku Personel</span>
          <strong>{formatNumber(statistics.todayPersonnel)}</strong>
          <small>{formatNumber(statistics.totalPlans)} aktif plan</small>
        </div>
        <div className="metric-card">
          <span>Aktif Personel</span>
          <strong>{formatNumber(statistics.activePersonnel)}</strong>
          <small>{formatNumber(statistics.totalPersonnel)} toplam personel</small>
        </div>
        <div className="metric-card">
          <span>Bos Personel</span>
          <strong>{formatNumber(statistics.idlePersonnel)}</strong>
          <small>{formatMinutes(statistics.totalIdleMinutes)} bos sure</small>
        </div>
        <div className="metric-card warning">
          <span>Vardiya Dolulugu</span>
          <strong>{formatPercent(statistics.shiftUtilizationPercent)}</strong>
          <small>{formatMinutes(statistics.totalWorkingMinutes)} calisma</small>
        </div>
        <div className="metric-card danger">
          <span>Eksik Personel</span>
          <strong>{formatNumber(statistics.missingPersonnel)}</strong>
          <small>{formatNumber(statistics.conflictCount)} cakisma</small>
        </div>
      </div>

      <section className="card workforce-planning-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Workforce Plan</h3>
            <p className="muted">Mevcut makine cizelgesi, personel ve vardiyalardan personel planlama read-modeli uretir; otomatik vardiya veya AI personel planlama yapmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.planDate || !form.responsiblePerson} onClick={createPlan}>Plan Olustur</button>
        </div>
        <div className="workforce-planning-create-grid">
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
            <select value={form.shiftName} onChange={event => updateForm('shiftName', event.target.value)}>
              <option value={ALL_FILTER}>Tum Vardiyalar</option>
              {shiftOptions.map(shift => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
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
            <span>Departman</span>
            <select value={form.department} onChange={event => updateForm('department', event.target.value)}>
              <option value={ALL_FILTER}>Tum Departmanlar</option>
              {departmentOptions.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
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
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field workforce-planning-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Personel planlama notu" />
          </label>
        </div>
      </section>

      <section className="card workforce-planning-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} plan listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(WorkforcePlanningService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="workforce-planning-filter-grid">
          <label className="form-field">
            <span>Personel</span>
            <select value={filters.employeeId} onChange={event => updateFilter('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Personel</option>
              {employeeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Departman</span>
            <select value={filters.department} onChange={event => updateFilter('department', event.target.value)}>
              <option value={ALL_FILTER}>Tum Departmanlar</option>
              {departmentOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shiftName} onChange={event => updateFilter('shiftName', event.target.value)}>
              <option value={ALL_FILTER}>Tum Vardiyalar</option>
              {shiftOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as WorkforcePlanningFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {WORKFORCE_PLAN_STATUSES.map(status => <option key={status} value={status}>{WORKFORCE_PLAN_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field workforce-planning-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Plan no, personel, departman, hat" />
          </label>
        </div>
      </section>

      <div className="workforce-planning-chart-grid">
        <BarChartCard title="Personel Kullanimi" rows={statistics.personnelRows} />
        <BarChartCard title="Vardiya Bazli" rows={statistics.shiftRows} />
        <BarChartCard title="Departman Bazli" rows={statistics.departmentRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout workforce-planning-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Workforce Plan Listesi</h3>
              <p className="muted">Personel ve vardiya plani mevcut verilerden hesaplanir; bu fazda otomatik atama olusturulmaz.</p>
            </div>
            <span className="status-pill">{formatPercent(statistics.shiftUtilizationPercent)}</span>
          </div>
          <div className="table-wrap workforce-planning-table-wrap">
            <table className="data-table workforce-planning-table">
              <thead>
                <tr>
                  <th>Plan No</th>
                  <th>Tarih</th>
                  <th>Personel</th>
                  <th>Departman / Vardiya</th>
                  <th>Hat / Makine</th>
                  <th>Gorev</th>
                  <th>Eksik</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun workforce plan bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => {
                  const assignedCount = record.items.filter(item => item.employeeId !== 'missing_employee').length
                  const missingCount = record.shiftAssignments.reduce((total, assignment) => total + assignment.missingEmployeeCount, 0)
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
                      <td data-label="Plan No"><strong>{record.planNo}</strong><span>{record.sourceType}</span></td>
                      <td data-label="Tarih"><strong>{formatDate(record.planDate)}</strong><span>{formatDate(record.startDate)} - {formatDate(record.endDate)}</span></td>
                      <td data-label="Personel"><strong>{record.employeeName}</strong><span>{formatNumber(assignedCount)} atama</span></td>
                      <td data-label="Departman / Vardiya"><strong>{record.department}</strong><span>{record.shiftName}</span></td>
                      <td data-label="Hat / Makine"><strong>{record.productionLineName}</strong><span>{record.machineCode || record.machineName}</span></td>
                      <td data-label="Gorev">{formatNumber(record.items.length)}</td>
                      <td data-label="Eksik">{formatNumber(missingCount)}</td>
                      <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{WORKFORCE_PLAN_STATUS_LABELS[record.status]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side workforce-planning-side">
          {selectedRecord ? (
            <WorkforcePlanDetailPanel
              plan={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card workforce-planning-detail-card">
              <h3>Plan Detayi</h3>
              <p className="muted">Detay gormek icin bir workforce plan secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function WorkforcePlanDetailPanel({
  onOutput,
  onStatusChange,
  plan
}: {
  onOutput: (action: Extract<WorkforceHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: WorkforcePlanStatus) => void
  plan: WorkforcePlan
}){
  const workingMinutes = plan.items.reduce((total, item) => total + item.workingMinutes, 0)
  const idleMinutes = plan.employeeAssignments.reduce((total, item) => total + item.idleMinutes, 0)
  const conflictCount = plan.items.filter(item => item.conflict).length
  const missingCount = plan.shiftAssignments.reduce((total, item) => total + item.missingEmployeeCount, 0)

  return (
    <>
      <section className="card workforce-planning-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{plan.planNo}</h3>
            <p className="muted">{plan.employeeName} / {plan.shiftName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(plan.status)}`}>{WORKFORCE_PLAN_STATUS_LABELS[plan.status]}</span>
        </div>

        <div className="workforce-planning-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="workforce-planning-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'PREPARING')} onClick={() => onStatusChange('PREPARING')}>Hazirla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'READY')} onClick={() => onStatusChange('READY')}>Hazir</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'APPROVED')} onClick={() => onStatusChange('APPROVED')}>Onayla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(plan, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="workforce-planning-detail-grid">
          <div><span>Plan Tarihi</span><strong>{formatDate(plan.planDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(plan.startDate)} - {formatDate(plan.endDate)}</strong></div>
          <div><span>Personel</span><strong>{plan.employeeName}</strong></div>
          <div><span>Departman</span><strong>{plan.department}</strong></div>
          <div><span>Calisma</span><strong>{formatMinutes(workingMinutes)}</strong></div>
          <div><span>Bos Sure</span><strong>{formatMinutes(idleMinutes)}</strong></div>
          <div><span>Eksik</span><strong>{formatNumber(missingCount)}</strong></div>
          <div><span>Cakisma</span><strong>{formatNumber(conflictCount)}</strong></div>
          <div><span>Revizyon</span><strong>{formatNumber(plan.revisionNo)}</strong></div>
        </div>
        <p className="workforce-planning-notes">{plan.description || '-'}</p>
      </section>

      <section className="card workforce-planning-detail-card">
        <h3>Personel Takvimi</h3>
        <div className="workforce-planning-list">
          {plan.employeeAssignments.map(assignment => (
            <div className="workforce-planning-list-row" key={assignment.id}>
              <div>
                <strong>{assignment.employeeName}</strong>
                <span>{assignment.department} / {assignment.shiftName}</span>
              </div>
              <em>{formatPercent(assignment.utilizationPercent)}</em>
              <span>{formatNumber(assignment.assignmentCount)} gorev</span>
              <p>{formatMinutes(assignment.totalWorkingMinutes)} calisma / {formatMinutes(assignment.idleMinutes)} bos / {formatNumber(assignment.conflictCount)} cakisma</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card workforce-planning-detail-card">
        <h3>Vardiya Takvimi</h3>
        <div className="workforce-planning-list">
          {plan.shiftAssignments.map(assignment => (
            <div className="workforce-planning-list-row" key={assignment.id}>
              <div>
                <strong>{assignment.shiftName} / {formatDate(assignment.workDate)}</strong>
                <span>{formatNumber(assignment.assignedEmployees)} atanmis / {formatNumber(assignment.activeEmployees)} aktif</span>
              </div>
              <em>{formatPercent(assignment.utilizationPercent)}</em>
              <span>{formatNumber(assignment.missingEmployeeCount)} eksik</span>
              <p>{formatMinutes(assignment.totalWorkingMinutes)} calisma / {formatMinutes(assignment.availableMinutes)} vardiya kapasitesi</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card workforce-planning-detail-card">
        <h3>Gorev Listesi</h3>
        <div className="workforce-planning-list">
          {plan.items.slice(0, 14).map(item => (
            <div className="workforce-planning-list-row" key={item.id}>
              <div>
                <strong>{item.employeeName}</strong>
                <span>{item.machineCode} / {item.productionLineName}</span>
              </div>
              <em>{formatTime(item.startAt)} - {formatTime(item.endAt)}</em>
              <span className={`status-pill ${item.conflict ? 'danger-pill' : item.status === 'ACTIVE' ? 'warning-pill' : 'muted-pill'}`}>{WORKFORCE_PLAN_ITEM_STATUS_LABELS[item.status]}</span>
              <p>{item.taskName} / {formatMinutes(item.workingMinutes)} / {item.conflictReason || item.department}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card workforce-planning-detail-card">
        <h3>Oneriler</h3>
        <div className="workforce-planning-recommendation-list">
          {plan.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {plan.recommendations.map((recommendation, index) => (
            <div key={`${plan.id}_recommendation_${index + 1}`}>
              <strong>{recommendation}</strong>
              <span>WorkforceCalculationService</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card workforce-planning-detail-card">
        <h3>History</h3>
        <div className="workforce-planning-history-list">
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
