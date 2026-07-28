import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import { PlanningPrintService } from '../production-planning/planning-print.service'
import {
  PRODUCTION_PLAN_PRIORITY_LABELS,
  PRODUCTION_PLAN_STATUSES,
  PRODUCTION_PLAN_STATUS_LABELS,
  PRODUCTION_PLAN_TYPES,
  PRODUCTION_PLAN_TYPE_LABELS,
  ProductionPlanningService
} from '../production-planning/production-planning.service'
import type {
  ProductionPlan,
  ProductionPlanCreateInput,
  ProductionPlanningFilters,
  ProductionPlanningHistoryAction,
  ProductionPlanStatus
} from '../production-planning/production-planning.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreatePlanState = ProductionPlanCreateInput

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

const getEndDateForType = (
  planType: CreatePlanState['planType'],
  planDate: string
) => {
  if(planType === 'MONTHLY') return addDays(planDate, 29)
  if(planType === 'WEEKLY') return addDays(planDate, 6)
  return planDate
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

const getStatusClass = (status: ProductionPlanStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'READY' || status === 'PREPARING') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: ProductionPlanningHistoryAction) => {
  const labels: Record<ProductionPlanningHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    PREPARING: 'Hazirlaniyor',
    READY: 'Hazir',
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
  branchId: string,
  facilityId: string,
  userName: string
): CreatePlanState => {
  const today = getTodayKey()

  return {
    planType: 'DAILY',
    planDate: today,
    startDate: today,
    endDate: today,
    branchId,
    facilityId,
    shift: 'Sabah',
    responsiblePerson: userName,
    description: ''
  }
}

const getActionDisabled = (
  plan: ProductionPlan | null,
  status: ProductionPlanStatus
) => {
  if(!plan) return true
  if(plan.status === 'CANCELLED') return true
  return plan.status === status
}

export default function ProductionPlanning({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const branchOptions = React.useMemo(() => sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })), [sourceData])
  const facilityId = React.useMemo(() => (
    sourceData.branches.find(branch => branch.name.toLocaleLowerCase('tr-TR').includes('uretim'))?.id
    || branchOptions[0]?.id
    || ALL_FILTER
  ), [branchOptions, sourceData])
  const [records, setRecords] = React.useState<ProductionPlan[]>(() => ProductionPlanningService.list(sourceData))
  const [filters, setFilters] = React.useState<ProductionPlanningFilters>(() => ProductionPlanningService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreatePlanState>(() => createInitialForm(ALL_FILTER, facilityId, userName))
  const filteredRecords = React.useMemo(() => ProductionPlanningService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => ProductionPlanningService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const shiftOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.shift, name: record.shift }))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = ProductionPlanningService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof ProductionPlanningFilters>(key: TKey, value: ProductionPlanningFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreatePlanState>(key: TKey, value: CreatePlanState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'planType'){
        next.endDate = getEndDateForType(value as CreatePlanState['planType'], prev.planDate)
      }
      if(key === 'planDate'){
        next.startDate = value as string
        next.endDate = getEndDateForType(prev.planType, value as string)
      }
      return next
    })
  }

  const createPlan = () => {
    try{
      const record = ProductionPlanningService.add(form, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(form.branchId, form.facilityId, userName))
      setMessage({ type: 'success', text: `${record.planNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Uretim plani olusturulamadi.' })
    }
  }

  const changeStatus = (status: ProductionPlanStatus) => {
    if(!selectedRecord) return
    try{
      const record = ProductionPlanningService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.planNo} ${PRODUCTION_PLAN_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ProductionPlanningHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') PlanningPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') PlanningPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['production-planning'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = ProductionPlanningService.recordOutput(selectedRecord.id, action, sourceData, userName)
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
    <div className="production-planning-page">
      <div className="page-header">
        <div>
          <h2>Uretim Planlama</h2>
          <p className="muted">Production Orders, recete, stok, depo, sevkiyat talebi, fire, kapasite ve forecast sinyallerini tek planlama read-modelinde birlestirir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid production-planning-metric-grid">
        <div className="metric-card">
          <span>Bugunku Plan</span>
          <strong>{formatNumber(statistics.todayPlans)}</strong>
          <small>Bugun tarihli planlar</small>
        </div>
        <div className="metric-card">
          <span>Toplam Plan</span>
          <strong>{formatNumber(statistics.totalPlans)}</strong>
          <small>{formatNumber(statistics.totalProducts)} urun</small>
        </div>
        <div className="metric-card warning">
          <span>Bekleyen Plan</span>
          <strong>{formatNumber(statistics.pendingPlans)}</strong>
          <small>Taslak / hazirlaniyor</small>
        </div>
        <div className="metric-card">
          <span>Onaylanan</span>
          <strong>{formatNumber(statistics.approvedPlans)}</strong>
          <small>Hazir planlardan onay</small>
        </div>
        <div className="metric-card">
          <span>Revize Edilen</span>
          <strong>{formatNumber(statistics.revisedPlans)}</strong>
          <small>Kapasite {formatPercent(statistics.capacityUsagePercent)}</small>
        </div>
      </div>

      <section className="card production-planning-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Uretim Plani</h3>
            <p className="muted">Mevcut verilerden plan read-modeli uretir; otomatik uretim emri, makine/personel planlama veya AI optimizasyonu eklemez.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.planDate || !form.responsiblePerson} onClick={createPlan}>Plan Olustur</button>
        </div>
        <div className="production-planning-create-grid">
          <label className="form-field">
            <span>Plan Turu</span>
            <select value={form.planType} onChange={event => updateForm('planType', event.target.value as CreatePlanState['planType'])}>
              {PRODUCTION_PLAN_TYPES.map(type => <option key={type} value={type}>{PRODUCTION_PLAN_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
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
            <span>Sube</span>
            <select value={form.branchId} onChange={event => updateForm('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Subeler</option>
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Uretim Tesisi</span>
            <select value={form.facilityId} onChange={event => updateForm('facilityId', event.target.value)}>
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Vardiya</span>
            <select value={form.shift} onChange={event => updateForm('shift', event.target.value)}>
              {['Sabah', 'Aksam', 'Gece', 'Haftalik', 'Aylik', 'Acil'].map(shift => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field production-planning-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Planlama notu" />
          </label>
        </div>
      </section>

      <section className="card production-planning-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} uretim plani listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(ProductionPlanningService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="production-planning-filter-grid">
          <label className="form-field">
            <span>Plan Turu</span>
            <select value={filters.planType} onChange={event => updateFilter('planType', event.target.value as ProductionPlanningFilters['planType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {PRODUCTION_PLAN_TYPES.map(type => <option key={type} value={type}>{PRODUCTION_PLAN_TYPE_LABELS[type]}</option>)}
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
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value)}>
              <option value={ALL_FILTER}>Tum Vardiyalar</option>
              {shiftOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as ProductionPlanningFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {PRODUCTION_PLAN_STATUSES.map(status => <option key={status} value={status}>{PRODUCTION_PLAN_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Plan no, urun, sube, sorumlu" />
          </label>
        </div>
      </section>

      <div className="production-planning-chart-grid">
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Urun Bazli" rows={statistics.productRows} />
        <BarChartCard title="Plan Turu" rows={statistics.typeRows} />
        <BarChartCard title="Durum Bazli" rows={statistics.statusRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout production-planning-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Production Plan Listesi</h3>
              <p className="muted">Planlar mevcut veri kaynaklarindan hesaplanir; bu fazda otomatik uretim emri olusturulmaz.</p>
            </div>
            <span className="status-pill">{formatQuantity(statistics.totalProduction)}</span>
          </div>
          <div className="table-wrap production-planning-table-wrap">
            <table className="data-table production-planning-table">
              <thead>
                <tr>
                  <th>Plan No</th>
                  <th>Tarih</th>
                  <th>Tur</th>
                  <th>Sube / Tesis</th>
                  <th>Vardiya</th>
                  <th>Urun</th>
                  <th>Uretilecek</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun uretim plani bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => (
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
                    <td data-label="Tur">{PRODUCTION_PLAN_TYPE_LABELS[record.planType]}</td>
                    <td data-label="Sube / Tesis"><strong>{record.branchName}</strong><span>{record.facilityName}</span></td>
                    <td data-label="Vardiya">{record.shift}</td>
                    <td data-label="Urun">{formatNumber(record.items.length)}</td>
                    <td data-label="Uretilecek">{formatQuantity(record.items.reduce((total, item) => total + item.produceQuantity, 0))}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{PRODUCTION_PLAN_STATUS_LABELS[record.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side production-planning-side">
          {selectedRecord ? (
            <ProductionPlanDetailPanel
              plan={selectedRecord}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card production-planning-detail-card">
              <h3>Plan Detayi</h3>
              <p className="muted">Detay gormek icin bir uretim plani secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ProductionPlanDetailPanel({
  onOutput,
  onStatusChange,
  plan
}: {
  onOutput: (action: Extract<ProductionPlanningHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: ProductionPlanStatus) => void
  plan: ProductionPlan
}){
  const totalProduce = plan.items.reduce((total, item) => total + item.produceQuantity, 0)
  const totalMinutes = plan.items.reduce((total, item) => total + item.estimatedMinutes, 0)
  const averageCapacity = plan.items.length > 0
    ? plan.items.reduce((total, item) => total + item.capacityUsagePercent, 0) / plan.items.length
    : 0

  return (
    <>
      <section className="card production-planning-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{plan.planNo}</h3>
            <p className="muted">{PRODUCTION_PLAN_TYPE_LABELS[plan.planType]} / {plan.branchName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(plan.status)}`}>{PRODUCTION_PLAN_STATUS_LABELS[plan.status]}</span>
        </div>

        <div className="production-planning-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="production-planning-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'PREPARING')} onClick={() => onStatusChange('PREPARING')}>Hazirla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'READY')} onClick={() => onStatusChange('READY')}>Hazir</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'APPROVED')} onClick={() => onStatusChange('APPROVED')}>Onayla</button>
          <button className="btn" type="button" disabled={getActionDisabled(plan, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(plan, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="production-planning-detail-grid">
          <div><span>Plan Tarihi</span><strong>{formatDate(plan.planDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(plan.startDate)} - {formatDate(plan.endDate)}</strong></div>
          <div><span>Sube</span><strong>{plan.branchName}</strong></div>
          <div><span>Uretim Tesisi</span><strong>{plan.facilityName}</strong></div>
          <div><span>Vardiya</span><strong>{plan.shift}</strong></div>
          <div><span>Sorumlu</span><strong>{plan.responsiblePerson}</strong></div>
          <div><span>Toplam Uretim</span><strong>{formatQuantity(totalProduce)}</strong></div>
          <div><span>Tahmini Sure</span><strong>{formatNumber(totalMinutes)} dk</strong></div>
          <div><span>Kapasite</span><strong>{formatPercent(averageCapacity)}</strong></div>
          <div><span>Revizyon</span><strong>{formatNumber(plan.revisionNo)}</strong></div>
        </div>
        <p className="production-planning-notes">{plan.description || '-'}</p>
      </section>

      <section className="card production-planning-detail-card">
        <h3>Urunler ve Receteler</h3>
        <div className="production-planning-list">
          {plan.items.map(item => (
            <div className="production-planning-list-row" key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>{item.productCode} / {item.recipeName}</span>
              </div>
              <em>{formatQuantity(item.produceQuantity, item.unit)}</em>
              <span className={`status-pill ${item.priority === 'CRITICAL' ? 'danger-pill' : item.priority === 'HIGH' ? 'warning-pill' : 'muted-pill'}`}>{PRODUCTION_PLAN_PRIORITY_LABELS[item.priority]}</span>
              <p>{item.productionLineName} / {formatNumber(item.estimatedMinutes)} dk / kapasite {formatPercent(item.capacityUsagePercent)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card production-planning-detail-card">
        <h3>Talep Analizi</h3>
        <div className="production-planning-list">
          {plan.demands.slice(0, 8).map(demand => (
            <div className="production-planning-list-row" key={demand.id}>
              <div>
                <strong>{demand.productName}</strong>
                <span>Forecast {formatQuantity(demand.forecastQuantity, demand.unit)} / Sube {formatQuantity(demand.branchDemandQuantity, demand.unit)}</span>
              </div>
              <em>{formatQuantity(demand.totalDemand, demand.unit)}</em>
              <span>Fire {formatQuantity(demand.wasteAllowanceQuantity, demand.unit)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card production-planning-detail-card">
        <h3>Stok Analizi</h3>
        <div className="production-planning-list">
          {plan.supplies.slice(0, 8).map(supply => (
            <div className="production-planning-list-row" key={supply.id}>
              <div>
                <strong>{supply.productName}</strong>
                <span>Stok {formatQuantity(supply.currentStock, supply.unit)} / Bekleyen {formatQuantity(supply.pendingProduction, supply.unit)}</span>
              </div>
              <em>{formatQuantity(supply.shortageQuantity, supply.unit)}</em>
              <span>Min {formatQuantity(supply.minimumStock, supply.unit)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card production-planning-detail-card">
        <h3>Oneriler</h3>
        <div className="production-planning-recommendation-list">
          {plan.recommendations.length === 0 && <div className="empty-cell">Oneri bulunmuyor.</div>}
          {plan.recommendations.map((recommendation, index) => (
            <div key={`${plan.id}_recommendation_${index + 1}`}>
              <strong>{recommendation}</strong>
              <span>PlanningRecommendationService</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card production-planning-detail-card">
        <h3>History</h3>
        <div className="production-planning-history-list">
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
