import React from 'react'
import { DeliveryNotePrintService } from '../delivery-notes/delivery-note-print.service'
import {
  DELIVERY_NOTE_STATUS_LABELS,
  DELIVERY_NOTE_STATUSES,
  DeliveryNoteService
} from '../delivery-notes/delivery-note.service'
import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteHistoryAction,
  DeliveryNoteStatus
} from '../delivery-notes/delivery-note.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
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

const getStatusClass = (status: DeliveryNoteStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'READY' || status === 'PRINTED' || status === 'LOADED') return 'info-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: DeliveryNoteHistoryAction) => {
  const labels: Record<DeliveryNoteHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    PRINTED: 'Yazdirildi',
    PDF: 'PDF',
    EXCEL: 'Excel',
    LOADED: 'Yuklendi',
    DELIVERED: 'Teslim Edildi',
    CANCELLED: 'Iptal',
    VALIDATION: 'Validation'
  }

  return labels[action] || action
}

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getDeliveryNoteTotalQuantity = (record: DeliveryNote) => (
  record.items.reduce((total, item) => total + item.quantity, 0)
)

const getDeliveryNoteTotalBoxes = (record: DeliveryNote) => (
  record.items.reduce((total, item) => total + item.boxCount, 0)
)

const getDeliveryNoteTotalPallets = (record: DeliveryNote) => (
  record.items.reduce((total, item) => total + item.palletCount, 0)
)

const getDeliveryNoteTotalCost = (record: DeliveryNote) => (
  record.items.reduce((total, item) => total + item.totalCost, 0)
)

const getDeliveryNotePlanLabel = (plan: ShipmentPlanRecord) => (
  `${plan.shipmentPlanNo} - ${formatDate(plan.planDate)}`
)

const getActionDisabled = (
  record: DeliveryNote | null,
  status: DeliveryNoteStatus
) => {
  if(!record) return true
  if(record.status === 'DELIVERED' || record.status === 'CANCELLED') return true
  if(record.status === status) return true
  return false
}

export default function DeliveryNotes({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<DeliveryNote[]>(() => DeliveryNoteService.list(sourceData))
  const [filters, setFilters] = React.useState<DeliveryNoteFilters>(() => DeliveryNoteService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [selectedPlanId, setSelectedPlanId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const filteredRecords = React.useMemo(() => DeliveryNoteService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => DeliveryNoteService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const branchOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.branchId, name: record.branchName }))), [records])
  const warehouseOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.warehouseId, name: record.warehouseName }))), [records])
  const customerOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.customerId, name: record.customerName }))), [records])
  const vehicleOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.vehicleId, name: `${record.vehicleNo} ${record.vehiclePlate}`.trim() }))), [records])
  const planOptions = React.useMemo(() => {
    const activePlanIds = new Set(records.filter(record => record.status !== 'CANCELLED').map(record => record.shipmentPlanId))
    return sourceData.shipmentPlans
      .filter(plan => plan.status !== 'CANCELLED')
      .filter(plan => !activePlanIds.has(plan.id))
      .filter(plan => DeliveryNoteService.createLineSources(plan.id, sourceData).length > 0)
      .slice(0, 20)
  }, [records, sourceData])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    if(selectedPlanId && planOptions.some(plan => plan.id === selectedPlanId)) return
    setSelectedPlanId(planOptions[0]?.id || '')
  }, [planOptions, selectedPlanId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = DeliveryNoteService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof DeliveryNoteFilters>(key: TKey, value: DeliveryNoteFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const createFromPlan = () => {
    if(!selectedPlanId){
      setMessage({ type: 'error', text: 'Sevkiyat plani secilmedi.' })
      return
    }

    try{
      const record = DeliveryNoteService.addFromShipmentPlan(selectedPlanId, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.deliveryNoteNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Irsaliye olusturulamadi.' })
    }
  }

  const changeStatus = (status: DeliveryNoteStatus) => {
    if(!selectedRecord) return
    try{
      const record = DeliveryNoteService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.deliveryNoteNo} ${DELIVERY_NOTE_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<DeliveryNoteHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') DeliveryNotePrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') DeliveryNotePrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['delivery-notes'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = DeliveryNoteService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.deliveryNoteNo} Excel export edildi.`
          : `${record.deliveryNoteNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="shipment-page delivery-note-page">
      <div className="page-header">
        <div>
          <h2>Irsaliyeler</h2>
          <p className="muted">Sevkiyat, lot, uretim, depo, arac, Excel Engine ve Cost Engine verilerinden kurumsal delivery note read modeli.</p>
        </div>
        <div className="delivery-note-header-actions">
          <select value={selectedPlanId} onChange={event => setSelectedPlanId(event.target.value)}>
            {planOptions.length === 0 && <option value="">Uygun plan yok</option>}
            {planOptions.map(plan => (
              <option key={plan.id} value={plan.id}>{getDeliveryNotePlanLabel(plan)}</option>
            ))}
          </select>
          <button className="primary-button" type="button" onClick={createFromPlan} disabled={!selectedPlanId}>
            Irsaliye Olustur
          </button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid delivery-note-card-grid">
        <div className="metric-card">
          <span>Bugunku Irsaliye</span>
          <strong>{formatNumber(statistics.todayNotes)}</strong>
        </div>
        <div className="metric-card">
          <span>Hazir</span>
          <strong>{formatNumber(statistics.readyNotes)}</strong>
        </div>
        <div className="metric-card">
          <span>Teslim Edilen</span>
          <strong>{formatNumber(statistics.deliveredNotes)}</strong>
        </div>
        <div className="metric-card">
          <span>Iptal</span>
          <strong>{formatNumber(statistics.cancelledNotes)}</strong>
        </div>
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{formatNumber(statistics.pendingNotes)}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout delivery-note-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Delivery Note Listesi</h3>
              <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} irsaliye listeleniyor.</p>
            </div>
            <button className="btn" type="button" onClick={() => setFilters(DeliveryNoteService.createDefaultFilters())}>Sifirla</button>
          </div>

          <div className="delivery-note-toolbar">
            <input
              type="search"
              placeholder="Irsaliye No, musteri, lot veya urun ara"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as DeliveryNoteFilters['status'])}>
              <option value="all">Tum Durumlar</option>
              {DELIVERY_NOTE_STATUSES.map(status => (
                <option key={status} value={status}>{DELIVERY_NOTE_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value="all">Tum Subeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value="all">Tum Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.customerId} onChange={event => updateFilter('customerId', event.target.value)}>
              <option value="all">Tum Musteriler</option>
              {customerOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.vehicleId} onChange={event => updateFilter('vehicleId', event.target.value)}>
              <option value="all">Tum Araclar</option>
              {vehicleOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <input
              type="search"
              placeholder="Sofor"
              value={filters.driverName}
              onChange={event => updateFilter('driverName', event.target.value)}
            />
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table delivery-note-table">
              <thead>
                <tr>
                  <th>Irsaliye No</th>
                  <th>Tarih</th>
                  <th>Musteri</th>
                  <th>Sube</th>
                  <th>Arac</th>
                  <th>Durum</th>
                  <th>Toplam Kalem</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    aria-selected={selectedRecord?.id === record.id}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setMessage(null)
                    }}
                  >
                    <td data-label="Irsaliye No">
                      <strong>{record.deliveryNoteNo}</strong>
                      <span className="muted">{record.shipmentPlanNo}</span>
                    </td>
                    <td data-label="Tarih">{formatDate(record.date)}</td>
                    <td data-label="Musteri">{record.customerName}</td>
                    <td data-label="Sube">{record.branchName}</td>
                    <td data-label="Arac">
                      <strong>{record.vehicleNo}</strong>
                      <span className="muted">{record.vehiclePlate || record.driverName}</span>
                    </td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{DELIVERY_NOTE_STATUS_LABELS[record.status]}</span></td>
                    <td data-label="Toplam Kalem">{formatNumber(record.items.length)}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun irsaliye bulunamadi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side shipment-side">
          {selectedRecord ? (
            <section className="card shipment-detail-card delivery-note-detail-card">
              <div className="section-header compact">
                <div>
                  <h3>{selectedRecord.deliveryNoteNo}</h3>
                  <p className="muted">{selectedRecord.customerName} - {formatDate(selectedRecord.date)}</p>
                </div>
                <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{DELIVERY_NOTE_STATUS_LABELS[selectedRecord.status]}</span>
              </div>

              <div className="delivery-note-output-actions">
                <button className="btn" type="button" onClick={() => recordOutput('PRINTED')}>A4 Yazdir</button>
                <button className="btn" type="button" onClick={() => recordOutput('PDF')}>PDF</button>
                <button className="btn" type="button" onClick={() => recordOutput('EXCEL')}>Excel Export</button>
              </div>

              <div className="delivery-note-status-actions">
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'READY')} onClick={() => changeStatus('READY')}>Hazir</button>
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'LOADED')} onClick={() => changeStatus('LOADED')}>Yuklendi</button>
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'DELIVERED')} onClick={() => changeStatus('DELIVERED')}>Teslim</button>
                <button className="btn danger" type="button" disabled={getActionDisabled(selectedRecord, 'CANCELLED')} onClick={() => changeStatus('CANCELLED')}>Iptal</button>
              </div>

              <div className="shipment-form-section">
                <h4>Irsaliye Bilgileri</h4>
                <div className="shipment-detail-grid delivery-note-detail-grid">
                  <div><span>Sube</span><strong>{selectedRecord.branchName}</strong></div>
                  <div><span>Depo</span><strong>{selectedRecord.warehouseName}</strong></div>
                  <div><span>Musteri</span><strong>{selectedRecord.customerName}</strong></div>
                  <div><span>Arac</span><strong>{selectedRecord.vehicleNo} {selectedRecord.vehiclePlate}</strong></div>
                  <div><span>Sofor</span><strong>{selectedRecord.driverName}</strong></div>
                  <div><span>Sevkiyat Plani</span><strong>{selectedRecord.shipmentPlanNo}</strong></div>
                </div>
              </div>

              <div className="shipment-form-section">
                <h4>Urunler ve Lotlar</h4>
                <div className="delivery-note-item-list">
                  {selectedRecord.items.map(item => (
                    <div className="delivery-note-item-row" key={item.id}>
                      <div>
                        <strong>{item.productName}</strong>
                        <span>{item.lotNo} - {item.palletNo}</span>
                      </div>
                      <div className="delivery-note-item-metrics">
                        <div><span>Miktar</span><strong>{formatQuantity(item.quantity, item.unit)}</strong></div>
                        <div><span>Koli</span><strong>{formatNumber(item.boxCount, 2)}</strong></div>
                        <div><span>Palet</span><strong>{formatNumber(item.palletCount, 2)}</strong></div>
                        <div><span>Net</span><strong>{formatQuantity(item.netWeight, 'kg')}</strong></div>
                        <div><span>Brut</span><strong>{formatQuantity(item.grossWeight, 'kg')}</strong></div>
                        <div><span>Cost</span><strong>{formatCurrency(item.totalCost)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shipment-form-section">
                <h4>Sevkiyat Bilgisi</h4>
                <div className="shipment-detail-grid delivery-note-detail-grid">
                  <div><span>Sevkiyat</span><strong>{selectedRecord.shipmentNo || '-'}</strong></div>
                  <div><span>Toplam Kalem</span><strong>{formatNumber(selectedRecord.items.length)}</strong></div>
                  <div><span>Toplam Miktar</span><strong>{formatNumber(getDeliveryNoteTotalQuantity(selectedRecord), 2)}</strong></div>
                  <div><span>Toplam Koli</span><strong>{formatNumber(getDeliveryNoteTotalBoxes(selectedRecord), 2)}</strong></div>
                  <div><span>Toplam Palet</span><strong>{formatNumber(getDeliveryNoteTotalPallets(selectedRecord), 2)}</strong></div>
                  <div><span>Toplam Maliyet</span><strong>{formatCurrency(getDeliveryNoteTotalCost(selectedRecord))}</strong></div>
                </div>
                <p className="shipment-notes">{selectedRecord.description}</p>
              </div>

              <div className="shipment-form-section">
                <h4>Istatistik</h4>
                <div className="shipment-detail-grid delivery-note-detail-grid">
                  <div><span>Toplam Irsaliye</span><strong>{formatNumber(statistics.totalNotes)}</strong></div>
                  <div><span>Toplam Urun</span><strong>{formatNumber(statistics.totalProducts)}</strong></div>
                  <div><span>Toplam Koli</span><strong>{formatNumber(statistics.totalBoxes, 2)}</strong></div>
                  <div><span>Toplam Palet</span><strong>{formatNumber(statistics.totalPallets, 2)}</strong></div>
                  <div><span>Teslim Orani</span><strong>{formatPercent(statistics.deliveryRate)}</strong></div>
                  <div><span>Toplam Cost</span><strong>{formatCurrency(statistics.totalCost)}</strong></div>
                </div>
              </div>

              <div className="shipment-form-section">
                <h4>Gecmis</h4>
                <div className="delivery-note-history-list">
                  {[...selectedRecord.history].reverse().map(history => (
                    <div key={history.id}>
                      <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
                      <span>{formatDateTime(history.createdAt)}</span>
                      <p>{history.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="card shipment-detail-card">
              <p className="shipment-empty-state">Irsaliye kaydi bulunamadi.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
