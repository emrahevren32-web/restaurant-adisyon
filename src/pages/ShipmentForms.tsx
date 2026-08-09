import React from 'react'
import { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import { SHIPMENT_TEMPERATURE_STAGE_LABELS } from '../shipment-forms/shipment-checklist.service'
import {
  SHIPMENT_CHECKLIST_STATUS_LABELS,
  SHIPMENT_FORM_STATUSES,
  SHIPMENT_FORM_STATUS_LABELS,
  SHIPMENT_FORM_TYPES,
  SHIPMENT_FORM_TYPE_LABELS,
  ShipmentFormService
} from '../shipment-forms/shipment-form.service'
import { ShipmentPrintService } from '../shipment-forms/shipment-print.service'
import type {
  ShipmentForm,
  ShipmentFormCreateInput,
  ShipmentFormFilters,
  ShipmentFormStatus,
  ShipmentHistoryAction
} from '../shipment-forms/shipment-form.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateFormState = {
  deliveryNoteId: string
  formType: ShipmentFormCreateInput['formType']
  loadingDate: string
  deliveryDate: string
  description: string
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
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

const getStatusClass = (status: ShipmentFormStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'RETURNED' || status === 'CANCELLED') return 'danger-pill'
  if(status === 'LOADING' || status === 'ON_ROUTE') return 'warning-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: ShipmentHistoryAction) => {
  const labels: Record<ShipmentHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    PREPARING: 'Hazirlaniyor',
    LOADING: 'Yukleniyor',
    ON_ROUTE: 'Yolda',
    DELIVERED: 'Teslim Edildi',
    RETURNED: 'Iade',
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
  deliveryNoteId = ''
): CreateFormState => ({
  deliveryNoteId,
  formType: 'LOADING_CONTROL',
  loadingDate: getTodayKey(),
  deliveryDate: '',
  description: ''
})

const getActionDisabled = (
  record: ShipmentForm | null,
  status: ShipmentFormStatus
) => {
  if(!record) return true
  if(record.status === 'CANCELLED') return true
  return record.status === status
}

export default function ShipmentForms({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const deliveryNotes = React.useMemo(() => DeliveryNoteService.list(sourceData), [sourceData])
  const [records, setRecords] = React.useState<ShipmentForm[]>(() => ShipmentFormService.list(sourceData))
  const [filters, setFilters] = React.useState<ShipmentFormFilters>(() => ShipmentFormService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [form, setForm] = React.useState<CreateFormState>(() => createInitialForm(deliveryNotes[0]?.id || ''))
  const [message, setMessage] = React.useState<Message | null>(null)
  const filteredRecords = React.useMemo(() => ShipmentFormService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => ShipmentFormService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const vehicleOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.vehicleId, name: `${record.vehicleNo} ${record.vehiclePlate}`.trim() }))), [records])
  const driverOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.driverName, name: record.driverName }))), [records])
  const branchOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.branchId, name: record.branchName }))), [records])
  const warehouseOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.warehouseId, name: record.warehouseName }))), [records])
  const customerOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.customerId, name: record.customerName }))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    if(form.deliveryNoteId || deliveryNotes.length === 0) return
    setForm(prev => ({ ...prev, deliveryNoteId: deliveryNotes[0]?.id || '' }))
  }, [deliveryNotes, form.deliveryNoteId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = ShipmentFormService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof ShipmentFormFilters>(key: TKey, value: ShipmentFormFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateFormState>(key: TKey, value: CreateFormState[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createShipmentForm = () => {
    try{
      const record = ShipmentFormService.addFromDeliveryNote({
        deliveryNoteId: form.deliveryNoteId,
        formType: form.formType,
        loadingDate: form.loadingDate,
        deliveryDate: form.deliveryDate,
        description: form.description
      }, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(form.deliveryNoteId))
      setMessage({ type: 'success', text: `${record.formNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sevkiyat formu olusturulamadi.' })
    }
  }

  const changeStatus = (status: ShipmentFormStatus) => {
    if(!selectedRecord) return
    try{
      const record = ShipmentFormService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.formNo} ${SHIPMENT_FORM_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ShipmentHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') ShipmentPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') ShipmentPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['shipment-forms'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = ShipmentFormService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.formNo} Excel export edildi.`
          : `${record.formNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="shipment-forms-page">
      <div className="page-header">
        <div>
          <h2>Sevkiyat Formlari</h2>
          <p className="muted">Delivery Note, Shipment, Vehicle, Lot, Label, Quality ve HACCP verilerini operasyon formlarinda birlestirir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid shipment-forms-metric-grid">
        <div className="metric-card">
          <span>Bugunku Sevkiyat</span>
          <strong>{formatNumber(statistics.todayShipments)}</strong>
          <small>Bugun yuklenen formlar</small>
        </div>
        <div className="metric-card warning">
          <span>Yuklenen</span>
          <strong>{formatNumber(statistics.loaded)}</strong>
          <small>Yukleniyor / yolda</small>
        </div>
        <div className="metric-card">
          <span>Teslim Edilen</span>
          <strong>{formatNumber(statistics.delivered)}</strong>
          <small>Basari {formatPercent(statistics.deliverySuccessRate)}</small>
        </div>
        <div className="metric-card danger">
          <span>Iade</span>
          <strong>{formatNumber(statistics.returned)}</strong>
          <small>Iade orani {formatPercent(statistics.returnRate)}</small>
        </div>
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{formatNumber(statistics.pending)}</strong>
          <small>Taslak / hazirlaniyor</small>
        </div>
      </div>

      <section className="card shipment-forms-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Sevkiyat Formu</h3>
            <p className="muted">Delivery Note kaynakli read-model operasyon formu olusturur; GPS, IoT veya dijital imza eklemez.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.deliveryNoteId} onClick={createShipmentForm}>Form Olustur</button>
        </div>
        <div className="shipment-forms-create-grid">
          <label className="form-field">
            <span>Irsaliye</span>
            <select value={form.deliveryNoteId} onChange={event => updateForm('deliveryNoteId', event.target.value)}>
              {deliveryNotes.length === 0 && <option value="">Irsaliye yok</option>}
              {deliveryNotes.map(note => <option key={note.id} value={note.id}>{note.deliveryNoteNo}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Form Turu</span>
            <select value={form.formType} onChange={event => updateForm('formType', event.target.value as CreateFormState['formType'])}>
              {SHIPMENT_FORM_TYPES.map(type => <option key={type} value={type}>{SHIPMENT_FORM_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Yukleme Tarihi</span>
            <input type="date" value={form.loadingDate} onChange={event => updateForm('loadingDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Teslim Tarihi</span>
            <input type="date" value={form.deliveryDate} onChange={event => updateForm('deliveryDate', event.target.value)} />
          </label>
          <label className="form-field shipment-forms-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Operasyon notu" />
          </label>
        </div>
      </section>

      <section className="card shipment-forms-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} sevkiyat formu listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(ShipmentFormService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="shipment-forms-filter-grid">
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as ShipmentFormFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {SHIPMENT_FORM_STATUSES.map(status => <option key={status} value={status}>{SHIPMENT_FORM_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Form Turu</span>
            <select value={filters.formType} onChange={event => updateFilter('formType', event.target.value as ShipmentFormFilters['formType'])}>
              <option value={ALL_FILTER}>Tum Formlar</option>
              {SHIPMENT_FORM_TYPES.map(type => <option key={type} value={type}>{SHIPMENT_FORM_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Arac</span>
            <select value={filters.vehicleId} onChange={event => updateFilter('vehicleId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Araclar</option>
              {vehicleOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sofor</span>
            <select value={filters.driverName} onChange={event => updateFilter('driverName', event.target.value)}>
              <option value={ALL_FILTER}>Tum Soforler</option>
              {driverOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Musteri</span>
            <select value={filters.customerId} onChange={event => updateFilter('customerId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Musteriler</option>
              {customerOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Form, sevkiyat, irsaliye, arac, sofor" />
          </label>
        </div>
      </section>

      <div className="shipment-forms-chart-grid">
        <BarChartCard title="Arac Bazli" rows={statistics.vehicleRows} />
        <BarChartCard title="Sofor Bazli" rows={statistics.driverRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Durum Bazli" rows={statistics.statusRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout shipment-forms-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Shipment Form Listesi</h3>
              <p className="muted">Sevkiyat operasyon formlari read-model olarak izlenir; arac takip sistemi entegrasyonu bu fazda yoktur.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.totalShipments)} form</span>
          </div>
          <div className="table-wrap shipment-forms-table-wrap">
            <table className="data-table shipment-forms-table">
              <thead>
                <tr>
                  <th>Form No</th>
                  <th>Yukleme</th>
                  <th>Form Turu</th>
                  <th>Sevkiyat / Irsaliye</th>
                  <th>Arac</th>
                  <th>Sofor</th>
                  <th>Kalem</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun sevkiyat formu bulunamadi.</td></tr>
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
                    <td data-label="Form No"><strong>{record.formNo}</strong><span>{record.sourceType}</span></td>
                    <td data-label="Yukleme">{formatDate(record.loadingDate)}</td>
                    <td data-label="Form Turu"><strong>{SHIPMENT_FORM_TYPE_LABELS[record.formType]}</strong><span>{record.templateVersion}</span></td>
                    <td data-label="Sevkiyat / Irsaliye"><strong>{record.shipmentNo || '-'}</strong><span>{record.deliveryNoteNo || '-'}</span></td>
                    <td data-label="Arac"><strong>{record.vehicleNo}</strong><span>{record.vehiclePlate}</span></td>
                    <td data-label="Sofor">{record.driverName || '-'}</td>
                    <td data-label="Kalem">{formatNumber(record.items.length)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_FORM_STATUS_LABELS[record.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side shipment-forms-side">
          {selectedRecord ? (
            <ShipmentFormDetailPanel
              record={selectedRecord}
              onStatusChange={changeStatus}
              onOutput={recordOutput}
            />
          ) : (
            <section className="card shipment-forms-detail-card">
              <h3>Form Detayi</h3>
              <p className="muted">Detay gormek icin bir sevkiyat formu secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ShipmentFormDetailPanel({
  onOutput,
  onStatusChange,
  record
}: {
  onOutput: (action: Extract<ShipmentHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: ShipmentFormStatus) => void
  record: ShipmentForm
}){
  return (
    <>
      <section className="card shipment-forms-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.formNo}</h3>
            <p className="muted">{SHIPMENT_FORM_TYPE_LABELS[record.formType]} / {record.deliveryNoteNo}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_FORM_STATUS_LABELS[record.status]}</span>
        </div>

        <div className="shipment-forms-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="shipment-forms-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(record, 'PREPARING')} onClick={() => onStatusChange('PREPARING')}>Hazirla</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'LOADING')} onClick={() => onStatusChange('LOADING')}>Yukle</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'ON_ROUTE')} onClick={() => onStatusChange('ON_ROUTE')}>Yolda</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'DELIVERED')} onClick={() => onStatusChange('DELIVERED')}>Teslim</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'RETURNED')} onClick={() => onStatusChange('RETURNED')}>Iade</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="shipment-forms-detail-grid">
          <div><span>Sevkiyat</span><strong>{record.shipmentNo || '-'}</strong></div>
          <div><span>Irsaliye</span><strong>{record.deliveryNoteNo || '-'}</strong></div>
          <div><span>Arac</span><strong>{`${record.vehicleNo} ${record.vehiclePlate}`.trim()}</strong></div>
          <div><span>Sofor</span><strong>{record.driverName || '-'}</strong></div>
          <div><span>Depo / Sube</span><strong>{record.warehouseName} / {record.branchName}</strong></div>
          <div><span>Musteri</span><strong>{record.customerName || '-'}</strong></div>
          <div><span>Yukleme</span><strong>{formatDate(record.loadingDate)}</strong></div>
          <div><span>Teslim</span><strong>{formatDate(record.deliveryDate)}</strong></div>
        </div>
        <p className="shipment-forms-notes">{record.description || '-'}</p>
      </section>

      <section className="card shipment-forms-detail-card">
        <h3>Urunler</h3>
        <div className="shipment-forms-list">
          {record.items.map(item => (
            <div className="shipment-forms-list-row" key={item.id}>
              <div>
                <strong>{item.productName || item.stockItemName}</strong>
                <span>{item.lotNo} / {item.labelNo || 'Etiket yok'}</span>
              </div>
              <em>{formatQuantity(item.quantity, item.unit)}</em>
              <span>{formatNumber(item.boxCount)} koli / {formatNumber(item.palletCount)} palet</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card shipment-forms-detail-card">
        <h3>Checklist</h3>
        <div className="shipment-forms-list">
          {record.checklist.map(item => (
            <div className="shipment-forms-list-row" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <span className={`status-pill ${item.status === 'PASS' ? 'success' : item.status === 'FAIL' ? 'danger-pill' : 'warning-pill'}`}>{SHIPMENT_CHECKLIST_STATUS_LABELS[item.status]}</span>
              <span>{item.notes || (item.required ? 'Zorunlu' : 'Opsiyonel')}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card shipment-forms-detail-card">
        <h3>Temperature Logs</h3>
        <div className="shipment-forms-list">
          {record.temperatureLogs.map(log => (
            <div className="shipment-forms-list-row" key={log.id}>
              <div>
                <strong>{SHIPMENT_TEMPERATURE_STAGE_LABELS[log.stage]}</strong>
                <span>{formatDateTime(log.loggedAt)}</span>
              </div>
              <em>{formatNumber(log.temperatureC, 1)} C</em>
              <span className={`status-pill ${log.result === 'PASS' ? 'success' : log.result === 'FAIL' ? 'danger-pill' : 'warning-pill'}`}>{SHIPMENT_CHECKLIST_STATUS_LABELS[log.result]}</span>
              <p>{log.notes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card shipment-forms-detail-card">
        <h3>History</h3>
        <div className="shipment-forms-list">
          {[...record.history].reverse().map(history => (
            <div className="shipment-forms-list-row" key={history.id}>
              <div>
                <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
                <span>{formatDateTime(history.createdAt)}</span>
              </div>
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
