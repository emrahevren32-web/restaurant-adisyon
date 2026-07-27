import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { GoodsReceiptPrintService } from '../goods-receipts/goods-receipt-print.service'
import {
  GOODS_RECEIPT_MANAGEMENT_STATUSES,
  GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS,
  GoodsReceiptService
} from '../goods-receipts/goods-receipt.service'
import type {
  GoodsReceiptFilters,
  GoodsReceiptHistoryAction,
  GoodsReceiptInspection,
  GoodsReceiptInspectionCriterionStatus,
  GoodsReceiptInspectionResult,
  GoodsReceiptManagementStatus,
  GoodsReceiptRecord
} from '../goods-receipts/goods-receipt.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

const CRITERION_OPTIONS: Array<{ value: GoodsReceiptInspectionCriterionStatus; label: string }> = [
  { value: 'PASS', label: 'Uygun' },
  { value: 'WARNING', label: 'Kosullu' },
  { value: 'FAIL', label: 'Uygun Degil' }
]

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

const normalizeManagementStatus = (
  status: GoodsReceiptRecord['status']
): GoodsReceiptManagementStatus => {
  if(GOODS_RECEIPT_MANAGEMENT_STATUSES.includes(status as GoodsReceiptManagementStatus)){
    return status as GoodsReceiptManagementStatus
  }
  if(status === 'COMPLETED' || status === 'RECEIVED') return 'ACCEPTED'
  if(status === 'PARTIALLY_RECEIVED') return 'PARTIAL_ACCEPTED'
  if(status === 'DRAFT') return 'WAITING'
  return 'WAITING'
}

const getStatusLabel = (status: GoodsReceiptRecord['status']) => (
  GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[normalizeManagementStatus(status)]
)

const getStatusClass = (status: GoodsReceiptRecord['status']) => {
  const normalizedStatus = normalizeManagementStatus(status)
  if(normalizedStatus === 'ACCEPTED') return 'success'
  if(normalizedStatus === 'PARTIAL_ACCEPTED' || normalizedStatus === 'INSPECTING') return 'warning-pill'
  if(normalizedStatus === 'REJECTED' || normalizedStatus === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getInspectionClass = (result: GoodsReceiptInspectionResult | undefined) => {
  if(result === 'PASS') return 'success'
  if(result === 'CONDITIONAL') return 'warning-pill'
  if(result === 'FAIL') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: GoodsReceiptHistoryAction) => {
  const labels: Record<GoodsReceiptHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    INSPECTION_STARTED: 'Kontrol Basladi',
    INSPECTION_COMPLETED: 'Kontrol Kaydedildi',
    ACCEPTED: 'Kabul Edildi',
    PARTIAL_ACCEPTED: 'Kismi Kabul',
    REJECTED: 'Reddedildi',
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
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getPurchaseOrderLabel = (order: PurchaseOrder) => (
  `${order.orderNo} - ${formatDate(order.expectedDeliveryDate || order.orderDate)}`
)

const getRecordTotalCost = (record: GoodsReceiptRecord) => (
  record.items.reduce((total, item) => total + (item.totalCost || 0), 0)
)

const getRecordTotalQuantity = (record: GoodsReceiptRecord) => (
  record.items.reduce((total, item) => total + item.receivedQuantity, 0)
)

const getRecordTotalAccepted = (record: GoodsReceiptRecord) => (
  record.items.reduce((total, item) => total + item.acceptedQuantity, 0)
)

const getRecordTotalRejected = (record: GoodsReceiptRecord) => (
  record.items.reduce((total, item) => total + item.rejectedQuantity, 0)
)

const getActionDisabled = (
  record: GoodsReceiptRecord | null,
  status: GoodsReceiptManagementStatus
) => {
  if(!record) return true
  const currentStatus = normalizeManagementStatus(record.status)
  if(currentStatus === 'CANCELLED') return true
  if(currentStatus === status) return true
  return false
}

export default function GoodsReceipts({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [records, setRecords] = React.useState<GoodsReceiptRecord[]>(() => GoodsReceiptService.list(sourceData))
  const [filters, setFilters] = React.useState<GoodsReceiptFilters>(() => GoodsReceiptService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = React.useState('')
  const [inspectionDraft, setInspectionDraft] = React.useState<GoodsReceiptInspection | null>(null)
  const [message, setMessage] = React.useState<Message | null>(null)
  const filteredRecords = React.useMemo(() => GoodsReceiptService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => GoodsReceiptService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const supplierOptions = React.useMemo(() => uniqueOptions(records.map(record => ({
    id: record.supplierId,
    name: record.supplierName || record.supplierId
  }))), [records])
  const warehouseOptions = React.useMemo(() => uniqueOptions(records.map(record => ({
    id: record.warehouseId,
    name: record.warehouseName || record.warehouseId
  }))), [records])
  const purchaseOrderOptions = React.useMemo(() => (
    GoodsReceiptService.getReceivablePurchaseOrders(records, sourceData).slice(0, 20)
  ), [records, sourceData])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    setInspectionDraft(selectedRecord?.inspection || null)
  }, [selectedRecord?.id, selectedRecord?.inspection])

  React.useEffect(() => {
    if(selectedPurchaseOrderId && purchaseOrderOptions.some(order => order.id === selectedPurchaseOrderId)) return
    setSelectedPurchaseOrderId(purchaseOrderOptions[0]?.id || '')
  }, [purchaseOrderOptions, selectedPurchaseOrderId])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = GoodsReceiptService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof GoodsReceiptFilters>(key: TKey, value: GoodsReceiptFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateInspectionDraft = <TKey extends keyof GoodsReceiptInspection>(key: TKey, value: GoodsReceiptInspection[TKey]) => {
    setInspectionDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const createFromPurchaseOrder = () => {
    if(!selectedPurchaseOrderId){
      setMessage({ type: 'error', text: 'Purchase Order secilmedi.' })
      return
    }

    try{
      const record = GoodsReceiptService.addFromPurchaseOrder(selectedPurchaseOrderId, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.receiptNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Mal kabul olusturulamadi.' })
    }
  }

  const saveInspection = () => {
    if(!selectedRecord || !inspectionDraft) return

    try{
      const record = GoodsReceiptService.updateInspection(selectedRecord.id, inspectionDraft, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.receiptNo} inspection kaydi guncellendi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Inspection kaydedilemedi.' })
    }
  }

  const changeStatus = (status: GoodsReceiptManagementStatus) => {
    if(!selectedRecord) return
    try{
      const record = GoodsReceiptService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.receiptNo} ${GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<GoodsReceiptHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') GoodsReceiptPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') GoodsReceiptPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['goods-receipts'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = GoodsReceiptService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.receiptNo} Excel export edildi.`
          : `${record.receiptNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="shipment-page goods-receipt-page">
      <div className="page-header">
        <div>
          <h2>Mal Kabul</h2>
          <p className="muted">PO, supplier, depo, lot, kalite, HACCP, Excel Engine ve Cost Engine verilerinden kurumsal Goods Receipt read modeli.</p>
        </div>
        <div className="goods-receipt-header-actions">
          <select value={selectedPurchaseOrderId} onChange={event => setSelectedPurchaseOrderId(event.target.value)}>
            {purchaseOrderOptions.length === 0 && <option value="">Uygun PO yok</option>}
            {purchaseOrderOptions.map(order => (
              <option key={order.id} value={order.id}>{getPurchaseOrderLabel(order)}</option>
            ))}
          </select>
          <button className="primary-button" type="button" onClick={createFromPurchaseOrder} disabled={!selectedPurchaseOrderId}>
            Mal Kabul Olustur
          </button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid goods-receipt-card-grid">
        <div className="metric-card">
          <span>Bugunku Mal Kabul</span>
          <strong>{formatNumber(statistics.todayReceipts)}</strong>
        </div>
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{formatNumber(statistics.waitingReceipts)}</strong>
        </div>
        <div className="metric-card">
          <span>Kabul</span>
          <strong>{formatNumber(statistics.acceptedReceipts)}</strong>
        </div>
        <div className="metric-card">
          <span>Red</span>
          <strong>{formatNumber(statistics.rejectedReceipts)}</strong>
        </div>
        <div className="metric-card">
          <span>Kismi Kabul</span>
          <strong>{formatNumber(statistics.partialAcceptedReceipts)}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout goods-receipt-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Goods Receipt Listesi</h3>
              <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} mal kabul listeleniyor.</p>
            </div>
            <button className="btn" type="button" onClick={() => setFilters(GoodsReceiptService.createDefaultFilters())}>Sifirla</button>
          </div>

          <div className="goods-receipt-toolbar">
            <input
              type="search"
              placeholder="Mal kabul no, supplier, lot veya urun ara"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as GoodsReceiptFilters['status'])}>
              <option value="all">Tum Durumlar</option>
              {GOODS_RECEIPT_MANAGEMENT_STATUSES.map(status => (
                <option key={status} value={status}>{GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value="all">Tum Supplier</option>
              {supplierOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value="all">Tum Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </div>

          <div className="table-wrap goods-receipt-table-wrap">
            <table className="data-table goods-receipt-table">
              <thead>
                <tr>
                  <th>Mal Kabul No</th>
                  <th>Tarih</th>
                  <th>Supplier</th>
                  <th>Depo</th>
                  <th>Durum</th>
                  <th>Toplam Kalem</th>
                  <th>Toplam Maliyet</th>
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
                    <td data-label="Mal Kabul No">
                      <strong>{record.receiptNo}</strong>
                      <span className="muted">{record.purchaseOrderNo || record.purchaseOrderId}</span>
                    </td>
                    <td data-label="Tarih">{formatDate(record.receiptDate)}</td>
                    <td data-label="Supplier">{record.supplierName || record.supplierId}</td>
                    <td data-label="Depo">{record.warehouseName || record.warehouseId}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{getStatusLabel(record.status)}</span></td>
                    <td data-label="Toplam Kalem">{formatNumber(record.items.length)}</td>
                    <td data-label="Toplam Maliyet">{formatCurrency(getRecordTotalCost(record))}</td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun mal kabul bulunamadi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side goods-receipt-side">
          {selectedRecord ? (
            <section className="card goods-receipt-detail-card">
              <div className="section-header compact">
                <div>
                  <h3>{selectedRecord.receiptNo}</h3>
                  <p className="muted">{selectedRecord.supplierName || selectedRecord.supplierId} - {formatDate(selectedRecord.receiptDate)}</p>
                </div>
                <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{getStatusLabel(selectedRecord.status)}</span>
              </div>

              <div className="goods-receipt-output-actions">
                <button className="btn" type="button" onClick={() => recordOutput('PRINTED')}>Yazdir</button>
                <button className="btn" type="button" onClick={() => recordOutput('PDF')}>PDF</button>
                <button className="btn" type="button" onClick={() => recordOutput('EXCEL')}>Excel</button>
              </div>

              <div className="goods-receipt-status-actions">
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'INSPECTING')} onClick={() => changeStatus('INSPECTING')}>Kontrol</button>
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'ACCEPTED')} onClick={() => changeStatus('ACCEPTED')}>Kabul</button>
                <button className="btn" type="button" disabled={getActionDisabled(selectedRecord, 'PARTIAL_ACCEPTED')} onClick={() => changeStatus('PARTIAL_ACCEPTED')}>Kismi</button>
                <button className="btn danger" type="button" disabled={getActionDisabled(selectedRecord, 'REJECTED')} onClick={() => changeStatus('REJECTED')}>Red</button>
                <button className="btn danger" type="button" disabled={getActionDisabled(selectedRecord, 'CANCELLED')} onClick={() => changeStatus('CANCELLED')}>Iptal</button>
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Mal Kabul Bilgileri</h4>
                <div className="goods-receipt-detail-grid">
                  <div><span>Purchase Order</span><strong>{selectedRecord.purchaseOrderNo || selectedRecord.purchaseOrderId}</strong></div>
                  <div><span>Supplier</span><strong>{selectedRecord.supplierName || selectedRecord.supplierId}</strong></div>
                  <div><span>Depo</span><strong>{selectedRecord.warehouseName || selectedRecord.warehouseId}</strong></div>
                  <div><span>Arac</span><strong>{selectedRecord.vehiclePlate || '-'}</strong></div>
                  <div><span>Teslim Eden</span><strong>{selectedRecord.deliveredBy || '-'}</strong></div>
                  <div><span>Teslim Alan</span><strong>{selectedRecord.receivedByName || selectedRecord.receivedBy}</strong></div>
                </div>
                <p className="goods-receipt-notes">{selectedRecord.description || selectedRecord.notes || '-'}</p>
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Urunler ve Lotlar</h4>
                <div className="goods-receipt-item-list">
                  {selectedRecord.items.map(item => (
                    <div className="goods-receipt-item-row" key={item.id}>
                      <div>
                        <strong>{item.productName || item.stockItemName || item.stockItemId}</strong>
                        <span>{item.lotNo || item.lotId || '-'} - {item.batchNo || '-'}</span>
                      </div>
                      <div className="goods-receipt-item-metrics">
                        <div><span>Miktar</span><strong>{formatQuantity(item.receivedQuantity, item.unit)}</strong></div>
                        <div><span>Kabul</span><strong>{formatQuantity(item.acceptedQuantity, item.unit)}</strong></div>
                        <div><span>Red</span><strong>{formatQuantity(item.rejectedQuantity, item.unit)}</strong></div>
                        <div><span>Net</span><strong>{formatQuantity(item.netWeight || 0, 'kg')}</strong></div>
                        <div><span>Brut</span><strong>{formatQuantity(item.grossWeight || 0, 'kg')}</strong></div>
                        <div><span>Cost</span><strong>{formatCurrency(item.totalCost || 0)}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Kontroller</h4>
                {inspectionDraft && (
                  <div className="goods-receipt-inspection-grid">
                    <label>
                      <span>Sicaklik (C)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={inspectionDraft.temperatureC}
                        onChange={event => updateInspectionDraft('temperatureC', Number(event.target.value))}
                      />
                    </label>
                    <CriterionSelect label="Ambalaj" value={inspectionDraft.packagingCheck} onChange={value => updateInspectionDraft('packagingCheck', value)} />
                    <CriterionSelect label="Etiket" value={inspectionDraft.labelCheck} onChange={value => updateInspectionDraft('labelCheck', value)} />
                    <CriterionSelect label="SKT" value={inspectionDraft.expiryCheck} onChange={value => updateInspectionDraft('expiryCheck', value)} />
                    <CriterionSelect label="Lot" value={inspectionDraft.lotCheck} onChange={value => updateInspectionDraft('lotCheck', value)} />
                    <CriterionSelect label="Gorsel" value={inspectionDraft.visualCheck} onChange={value => updateInspectionDraft('visualCheck', value)} />
                    <CriterionSelect label="Hijyen" value={inspectionDraft.hygieneCheck} onChange={value => updateInspectionDraft('hygieneCheck', value)} />
                    <label>
                      <span>HACCP Sicaklik Kaydi</span>
                      <input value={inspectionDraft.haccpTemperatureRecord} onChange={event => updateInspectionDraft('haccpTemperatureRecord', event.target.value)} />
                    </label>
                    <label className="goods-receipt-form-wide">
                      <span>Duzeltici Faaliyet Notu</span>
                      <textarea value={inspectionDraft.correctiveActionNote} onChange={event => updateInspectionDraft('correctiveActionNote', event.target.value)} />
                    </label>
                    <label className="goods-receipt-form-wide">
                      <span>Kontrol Notu</span>
                      <textarea value={inspectionDraft.notes} onChange={event => updateInspectionDraft('notes', event.target.value)} />
                    </label>
                    <div className="goods-receipt-inspection-result">
                      <span>Sonuc</span>
                      <strong><em className={`status-pill ${getInspectionClass(selectedRecord.inspection?.result)}`}>{selectedRecord.inspection?.result || '-'}</em></strong>
                    </div>
                    <button className="primary-button" type="button" onClick={saveInspection}>Inspection Kaydet</button>
                  </div>
                )}
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Lot, Kalite ve HACCP</h4>
                <div className="goods-receipt-lot-list">
                  {selectedRecord.items.map(item => (
                    <div key={`${item.id}-trace`}>
                      <strong>{item.lotNo || item.lotId || '-'}</strong>
                      <span>{item.productName || item.stockItemName || item.stockItemId}</span>
                      <p>Quality: {item.qualitySampleNo || '-'} | HACCP: {item.haccpPlanName || selectedRecord.inspection?.haccpTemperatureRecord || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Istatistik</h4>
                <div className="goods-receipt-detail-grid">
                  <div><span>Toplam Mal Kabul</span><strong>{formatNumber(statistics.totalReceipts)}</strong></div>
                  <div><span>Toplam Urun</span><strong>{formatNumber(statistics.totalProducts)}</strong></div>
                  <div><span>Toplam Supplier</span><strong>{formatNumber(statistics.totalSuppliers)}</strong></div>
                  <div><span>Red Orani</span><strong>{formatPercent(statistics.rejectionRate)}</strong></div>
                  <div><span>Kabul Orani</span><strong>{formatPercent(statistics.acceptanceRate)}</strong></div>
                  <div><span>Secili Cost</span><strong>{formatCurrency(getRecordTotalCost(selectedRecord))}</strong></div>
                  <div><span>Secili Miktar</span><strong>{formatNumber(getRecordTotalQuantity(selectedRecord), 2)}</strong></div>
                  <div><span>Kabul / Red</span><strong>{formatNumber(getRecordTotalAccepted(selectedRecord), 2)} / {formatNumber(getRecordTotalRejected(selectedRecord), 2)}</strong></div>
                </div>
              </div>

              <div className="goods-receipt-detail-section">
                <h4>Gecmis</h4>
                <div className="goods-receipt-history-list">
                  {[...(selectedRecord.history || [])].reverse().map(history => (
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
            <section className="card goods-receipt-detail-card">
              <p className="goods-receipt-notes">Mal kabul kaydi bulunamadi.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function CriterionSelect({
  label,
  value,
  onChange
}: {
  label: string
  value: GoodsReceiptInspectionCriterionStatus
  onChange: (value: GoodsReceiptInspectionCriterionStatus) => void
}){
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value as GoodsReceiptInspectionCriterionStatus)}>
        {CRITERION_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}
