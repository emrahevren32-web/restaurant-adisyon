import React from 'react'
import {
  SUPPLIER_RETURN_STATUSES,
  SUPPLIER_RETURN_STATUS_LABELS,
  SUPPLIER_RETURN_TRANSPORT_METHODS,
  SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS,
  applyCompletedSupplierReturnsToInventoryLots,
  applyCompletedSupplierReturnsToReturnProcesses,
  canCreateSupplierReturnFromProcess,
  getNextSupplierReturnNo,
  hasSupplierReturnForProcess,
  loadSupplierReturnRecords,
  saveSupplierReturnRecords
} from '../supplier-returns/supplier-return.mock'
import type {
  SupplierReturn,
  SupplierReturnStatus,
  SupplierReturnTransportMethod
} from '../supplier-returns/supplier-return.types'
import {
  RETURN_PROCESS_STATUS_LABELS,
  RETURN_REASON_LABELS,
  loadReturnProcessRecords,
  saveReturnProcessRecords
} from '../return-processes/return-process.mock'
import type { ReturnProcess } from '../return-processes/return-process.types'
import {
  applyCompletedQualityControlsToInventoryLots,
  loadQualityControlRecords
} from '../quality-controls/quality-control.mock'
import {
  INVENTORY_LOT_STATUS_LABELS,
  loadInventoryLotRecords,
  saveInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Supplier } from '../supplier-management/supplier-management.types'
import { loadBranches, loadStockItems } from '../storage'
import type { Branch, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = SupplierReturnStatus | FilterValue
type TransportFilter = SupplierReturnTransportMethod | FilterValue
type PanelMode = 'detail' | 'form'

type SupplierReturnInitialData = {
  branches: Branch[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
  returnProcesses: ReturnProcess[]
  supplierReturns: SupplierReturn[]
}

type SupplierReturnFormState = {
  supplierReturnNo: string
  returnProcessId: string
  shipmentDate: string
  deliveryDate: string
  trackingNumber: string
  transportMethod: SupplierReturnTransportMethod | ''
  receiverName: string
  status: SupplierReturnStatus
  notes: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: SupplierReturnStatus) => {
  if(status === 'COMPLETED' || status === 'DELIVERED') return 'success'
  if(status === 'SHIPPED') return 'info-pill'
  if(status === 'PREPARING') return 'warning-pill'
  return 'danger-pill'
}

const loadInitialData = (): SupplierReturnInitialData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const inventoryLots = loadInventoryLotRecords(goodsReceipts)
  const qualityControls = loadQualityControlRecords(inventoryLots)
  const qualitySyncedLots = applyCompletedQualityControlsToInventoryLots(inventoryLots, qualityControls)
  const returnProcesses = loadReturnProcessRecords(qualityControls, qualitySyncedLots, goodsReceipts)
  const supplierReturns = loadSupplierReturnRecords(returnProcesses)
  const syncedReturnProcesses = applyCompletedSupplierReturnsToReturnProcesses(returnProcesses, supplierReturns)
  const syncedInventoryLots = applyCompletedSupplierReturnsToInventoryLots(qualitySyncedLots, syncedReturnProcesses, supplierReturns)

  if(qualitySyncedLots.some((lot, index) => lot !== inventoryLots[index])){
    saveInventoryLotRecords(qualitySyncedLots)
  }

  if(syncedReturnProcesses.some((record, index) => record !== returnProcesses[index])){
    saveReturnProcessRecords(syncedReturnProcesses)
  }

  if(syncedInventoryLots.some((lot, index) => lot !== qualitySyncedLots[index])){
    saveInventoryLotRecords(syncedInventoryLots)
  }

  return {
    branches,
    suppliers,
    purchaseOrders,
    goodsReceipts,
    inventoryLots: syncedInventoryLots,
    returnProcesses: syncedReturnProcesses,
    supplierReturns
  }
}

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => {
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const getWarehouseLabel = (warehouseId: string, branchMap: Map<string, Branch>) => {
  const branch = branchMap.get(warehouseId)
  return branch ? branch.name : 'Warehouse bulunamadı'
}

const getReturnProcessLabel = (
  returnProcessId: string,
  returnProcessMap: Map<string, ReturnProcess>
) => {
  const returnProcess = returnProcessMap.get(returnProcessId)
  return returnProcess ? returnProcess.returnNo : 'Return Process bulunamadı'
}

const getPurchaseOrderLabel = (
  purchaseOrderId: string,
  purchaseOrderMap: Map<string, PurchaseOrder>
) => {
  const purchaseOrder = purchaseOrderMap.get(purchaseOrderId)
  return purchaseOrder ? purchaseOrder.orderNo : 'Purchase Order bulunamadı'
}

const getGoodsReceiptLabel = (
  goodsReceiptId: string,
  receiptMap: Map<string, GoodsReceiptRecord>
) => {
  const receipt = receiptMap.get(goodsReceiptId)
  return receipt ? receipt.receiptNo : 'Goods Receipt bulunamadı'
}

const createEmptyForm = (
  returnProcesses: ReturnProcess[],
  supplierReturns: SupplierReturn[],
  currentUser: User
): SupplierReturnFormState => {
  const returnProcess = returnProcesses.find(record => (
    canCreateSupplierReturnFromProcess(record)
    && !hasSupplierReturnForProcess(supplierReturns, record.id)
  )) || null

  return {
    supplierReturnNo: getNextSupplierReturnNo(supplierReturns),
    returnProcessId: returnProcess?.id || '',
    shipmentDate: getTodayKey(),
    deliveryDate: '',
    trackingNumber: '',
    transportMethod: 'COMPANY_VEHICLE',
    receiverName: '',
    status: 'PREPARING',
    notes: `${getUserName(currentUser)} tarafından tedarikçi iade süreci oluşturuldu.`
  }
}

const validateForm = (
  form: SupplierReturnFormState,
  returnProcessMap: Map<string, ReturnProcess>,
  supplierReturns: SupplierReturn[]
) => {
  const returnProcess = returnProcessMap.get(form.returnProcessId)
  if(!returnProcess) return 'Return Process zorunludur.'
  if(!canCreateSupplierReturnFromProcess(returnProcess)){
    return 'Sadece APPROVED veya COMPLETED Return Process için Supplier Return başlatılabilir.'
  }
  if(hasSupplierReturnForProcess(supplierReturns, returnProcess.id)){
    return 'Bu Return Process için zaten Supplier Return oluşturulmuş.'
  }
  if(!form.shipmentDate.trim()) return 'Shipment Date zorunludur.'
  if(!form.transportMethod) return 'Transport Method zorunludur.'
  if(form.deliveryDate && form.deliveryDate < form.shipmentDate){
    return 'Teslim tarihi sevk tarihinden önce olamaz.'
  }

  return ''
}

const createSupplierReturnPayload = (
  form: SupplierReturnFormState,
  returnProcess: ReturnProcess,
  currentUser: User
): SupplierReturn => {
  const now = new Date().toISOString()

  return {
    id: createId('supplier_return'),
    supplierReturnNo: form.supplierReturnNo,
    returnProcessId: returnProcess.id,
    supplierId: returnProcess.supplierId,
    warehouseId: returnProcess.warehouseId,
    shipmentDate: form.shipmentDate,
    deliveryDate: form.deliveryDate,
    trackingNumber: form.trackingNumber.trim(),
    transportMethod: form.transportMethod || 'COMPANY_VEHICLE',
    receiverName: form.receiverName.trim(),
    status: form.status,
    notes: form.notes.trim(),
    createdBy: getUserName(currentUser),
    createdAt: now,
    updatedAt: now
  }
}

export default function SupplierReturns({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<SupplierReturn[]>(initialData.supplierReturns)
  const [returnProcesses, setReturnProcesses] = React.useState<ReturnProcess[]>(initialData.returnProcesses)
  const [inventoryLots, setInventoryLots] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<SupplierReturnFormState>(() => createEmptyForm(
    initialData.returnProcesses,
    initialData.supplierReturns,
    currentUser
  ))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [transportFilter, setTransportFilter] = React.useState<TransportFilter>('all')

  const {
    branches,
    goodsReceipts,
    purchaseOrders,
    suppliers
  } = initialData

  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const receiptMap = React.useMemo(() => new Map(goodsReceipts.map(receipt => [receipt.id, receipt])), [goodsReceipts])
  const purchaseOrderMap = React.useMemo(() => new Map(purchaseOrders.map(order => [order.id, order])), [purchaseOrders])
  const returnProcessMap = React.useMemo(() => new Map(returnProcesses.map(record => [record.id, record])), [returnProcesses])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: SupplierReturn[]) => {
    setRecords(nextRecords)
    saveSupplierReturnRecords(nextRecords)
  }, [])

  const commitReturnProcesses = React.useCallback((nextRecords: ReturnProcess[]) => {
    setReturnProcesses(nextRecords)
    saveReturnProcessRecords(nextRecords)
  }, [])

  const commitInventoryLots = React.useCallback((nextLots: InventoryLot[]) => {
    setInventoryLots(nextLots)
    saveInventoryLotRecords(nextLots)
  }, [])

  const syncCompletionEffects = React.useCallback((
    nextSupplierReturns: SupplierReturn[],
    sourceReturnProcesses = returnProcesses
  ) => {
    const nextReturnProcesses = applyCompletedSupplierReturnsToReturnProcesses(sourceReturnProcesses, nextSupplierReturns)
    const nextInventoryLots = applyCompletedSupplierReturnsToInventoryLots(inventoryLots, nextReturnProcesses, nextSupplierReturns)

    commitReturnProcesses(nextReturnProcesses)
    commitInventoryLots(nextInventoryLots)
  }, [commitInventoryLots, commitReturnProcesses, inventoryLots, returnProcesses])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const supplier = supplierMap.get(record.supplierId)
      const searchFields = [
        record.supplierReturnNo,
        record.trackingNumber,
        supplier?.name || '',
        supplier?.tradeName || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesTransport = transportFilter === 'all' || record.transportMethod === transportFilter

      return matchesSearch && matchesStatus && matchesSupplier && matchesTransport
    })
  }, [records, search, statusFilter, supplierFilter, supplierMap, transportFilter])

  const preparingCount = records.filter(record => record.status === 'PREPARING').length
  const shippedCount = records.filter(record => record.status === 'SHIPPED').length
  const deliveredCount = records.filter(record => record.status === 'DELIVERED').length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length

  const startCreate = () => {
    setForm(createEmptyForm(returnProcesses, records, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(returnProcesses, records, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const updateRecordStatus = (
    record: SupplierReturn,
    status: SupplierReturnStatus
  ) => {
    if(record.status === 'COMPLETED') return

    const now = new Date().toISOString()
    const nextRecord: SupplierReturn = {
      ...record,
      status,
      deliveryDate: status === 'COMPLETED' ? record.deliveryDate || getTodayKey() : record.deliveryDate,
      updatedAt: now
    }
    if(nextRecord.deliveryDate && nextRecord.deliveryDate < nextRecord.shipmentDate){
      setFormError('Teslim tarihi sevk tarihinden önce olamaz.')
      return
    }

    const nextRecords = records.map(item => item.id === record.id ? nextRecord : item)
    commitRecords(nextRecords)
    if(status === 'COMPLETED') syncCompletionEffects(nextRecords)
    setSelectedRecordId(record.id)
    setPanelMode('detail')
    setFormError('')
  }

  const submitSupplierReturn = () => {
    const validationError = validateForm(form, returnProcessMap, records)
    if(validationError){
      setFormError(validationError)
      return
    }

    const returnProcess = returnProcessMap.get(form.returnProcessId)
    if(!returnProcess){
      setFormError('Return Process bulunamadı.')
      return
    }

    const payload = createSupplierReturnPayload(form, returnProcess, currentUser)
    const nextRecords = [payload, ...records]

    commitRecords(nextRecords)
    if(payload.status === 'COMPLETED') syncCompletionEffects(nextRecords)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(returnProcesses, nextRecords, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="supplier-return-page">
      <div className="page-header">
        <div>
          <h2>Tedarikçi İade Süreci</h2>
          <p className="muted">Return Process kayıtlarının fiziksel sevk, teslim ve kapanış adımlarını yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Supplier Return Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Hazırlanıyor</span>
          <strong>{preparingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Sevk Edildi</span>
          <strong>{shippedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Teslim Edildi</span>
          <strong>{deliveredCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlandı</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <div className="product-layout supplier-return-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Supplier Return Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="supplier-return-toolbar">
            <input
              type="search"
              placeholder="Supplier Return No, Supplier veya Tracking Number ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SUPPLIER_RETURN_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_RETURN_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={transportFilter} onChange={event => setTransportFilter(event.target.value as TransportFilter)}>
              <option value="all">Tüm Taşıma</option>
              {SUPPLIER_RETURN_TRANSPORT_METHODS.map(method => (
                <option key={method} value={method}>{SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap supplier-return-table-wrap">
            <table className="data-table supplier-return-table">
              <thead>
                <tr>
                  <th>Supplier Return No</th>
                  <th>Supplier</th>
                  <th>Return No</th>
                  <th>Shipment Date</th>
                  <th>Delivery Date</th>
                  <th>Transport</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun tedarikçi iade kaydı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setPanelMode('detail')
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(record.id)
                      setPanelMode('detail')
                    }}
                  >
                    <td data-label="Supplier Return No"><strong>{record.supplierReturnNo}</strong></td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Return No">{getReturnProcessLabel(record.returnProcessId, returnProcessMap)}</td>
                    <td data-label="Shipment Date">{formatDate(record.shipmentDate)}</td>
                    <td data-label="Delivery Date">{formatDate(record.deliveryDate)}</td>
                    <td data-label="Transport">{SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS[record.transportMethod]}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {SUPPLIER_RETURN_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side supplier-return-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Supplier Return Oluştur</h3>
                  <p className="muted">{form.supplierReturnNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <SupplierReturnForm
                form={form}
                records={records}
                returnProcesses={returnProcesses}
                returnProcessMap={returnProcessMap}
                supplierMap={supplierMap}
                branchMap={branchMap}
                lotMap={lotMap}
                onChange={setForm}
                onSubmit={submitSupplierReturn}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <SupplierReturnDetailPanel
              record={selectedRecord}
              formError={formError}
              returnProcessMap={returnProcessMap}
              supplierMap={supplierMap}
              branchMap={branchMap}
              lotMap={lotMap}
              receiptMap={receiptMap}
              purchaseOrderMap={purchaseOrderMap}
              onCreate={startCreate}
              onStatusChange={updateRecordStatus}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function SupplierReturnForm({
  form,
  records,
  returnProcesses,
  returnProcessMap,
  supplierMap,
  branchMap,
  lotMap,
  onChange,
  onSubmit,
  onCancel
}: {
  form: SupplierReturnFormState
  records: SupplierReturn[]
  returnProcesses: ReturnProcess[]
  returnProcessMap: Map<string, ReturnProcess>
  supplierMap: Map<string, Supplier>
  branchMap: Map<string, Branch>
  lotMap: Map<string, InventoryLot>
  onChange: (form: SupplierReturnFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const selectedReturnProcess = returnProcessMap.get(form.returnProcessId) || null
  const selectedLot = selectedReturnProcess ? lotMap.get(selectedReturnProcess.inventoryLotId) || null : null

  return (
    <form className="stacked-form supplier-return-form" onSubmit={event => event.preventDefault()}>
      <div className="supplier-return-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="supplier-return-form-grid">
          <div className="form-field">
            <label>Supplier Return No</label>
            <input value={form.supplierReturnNo} readOnly />
          </div>
          <div className="form-field">
            <label>Return Process</label>
            <select value={form.returnProcessId} onChange={event => onChange({ ...form, returnProcessId: event.target.value })} required>
              <option value="">Return Process seçin</option>
              {returnProcesses.map(returnProcess => {
                const disabled = !canCreateSupplierReturnFromProcess(returnProcess)
                  || hasSupplierReturnForProcess(records, returnProcess.id)

                return (
                  <option key={returnProcess.id} value={returnProcess.id} disabled={disabled}>
                    {returnProcess.returnNo} · {RETURN_PROCESS_STATUS_LABELS[returnProcess.status]}{disabled ? ' · Uygun değil' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Supplier</label>
            <input value={selectedReturnProcess ? getSupplierLabel(selectedReturnProcess.supplierId, supplierMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Warehouse</label>
            <input value={selectedReturnProcess ? getWarehouseLabel(selectedReturnProcess.warehouseId, branchMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Return Quantity</label>
            <input value={selectedReturnProcess && selectedLot ? formatQuantity(selectedReturnProcess.returnQuantity, selectedLot.unit) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Lot Status</label>
            <input value={selectedLot ? INVENTORY_LOT_STATUS_LABELS[selectedLot.status] : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Shipment Date</label>
            <input type="date" value={form.shipmentDate} onChange={event => onChange({ ...form, shipmentDate: event.target.value })} required />
          </div>
          <div className="form-field">
            <label>Delivery Date</label>
            <input type="date" value={form.deliveryDate} onChange={event => onChange({ ...form, deliveryDate: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Transport Method</label>
            <select value={form.transportMethod} onChange={event => onChange({ ...form, transportMethod: event.target.value as SupplierReturnTransportMethod | '' })} required>
              <option value="">Taşıma seçin</option>
              {SUPPLIER_RETURN_TRANSPORT_METHODS.map(method => (
                <option key={method} value={method}>{SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Tracking Number</label>
            <input value={form.trackingNumber} onChange={event => onChange({ ...form, trackingNumber: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Receiver</label>
            <input value={form.receiverName} onChange={event => onChange({ ...form, receiverName: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={form.status} onChange={event => onChange({ ...form, status: event.target.value as SupplierReturnStatus })}>
              {SUPPLIER_RETURN_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_RETURN_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="supplier-return-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Notes</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Supplier Return Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function SupplierReturnDetailPanel({
  record,
  formError,
  returnProcessMap,
  supplierMap,
  branchMap,
  lotMap,
  receiptMap,
  purchaseOrderMap,
  onCreate,
  onStatusChange
}: {
  record: SupplierReturn | null
  formError: string
  returnProcessMap: Map<string, ReturnProcess>
  supplierMap: Map<string, Supplier>
  branchMap: Map<string, Branch>
  lotMap: Map<string, InventoryLot>
  receiptMap: Map<string, GoodsReceiptRecord>
  purchaseOrderMap: Map<string, PurchaseOrder>
  onCreate: () => void
  onStatusChange: (record: SupplierReturn, status: SupplierReturnStatus) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Tedarikçi İade Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir Supplier Return kaydı seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Supplier Return Oluştur</button>
      </section>
    )
  }

  const returnProcess = returnProcessMap.get(record.returnProcessId) || null
  const lot = returnProcess ? lotMap.get(returnProcess.inventoryLotId) || null : null
  const receipt = returnProcess ? receiptMap.get(returnProcess.goodsReceiptId) || null : null
  const purchaseOrder = returnProcess ? purchaseOrderMap.get(returnProcess.purchaseOrderId) || null : null
  const canTransition = record.status !== 'COMPLETED' && record.status !== 'CANCELLED'

  return (
    <>
      <section className="card supplier-return-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.supplierReturnNo}</h3>
            <p className="muted">{returnProcess?.returnNo || 'Return Process bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {SUPPLIER_RETURN_STATUS_LABELS[record.status]}
          </span>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="supplier-return-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          {canTransition && <button className="btn" type="button" onClick={() => onStatusChange(record, 'SHIPPED')}>Sevk Et</button>}
          {canTransition && <button className="btn" type="button" onClick={() => onStatusChange(record, 'DELIVERED')}>Teslim Alındı</button>}
          {canTransition && <button className="btn primary" type="button" onClick={() => onStatusChange(record, 'COMPLETED')}>Tamamla</button>}
          {canTransition && <button className="btn" type="button" onClick={() => onStatusChange(record, 'CANCELLED')}>İptal</button>}
        </div>
      </section>

      <section className="card supplier-return-detail-card">
        <h3>Detay</h3>
        <div className="supplier-return-detail-grid">
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Return Process</span><strong>{returnProcess?.returnNo || '-'}</strong></div>
          <div><span>Return Status</span><strong>{returnProcess ? RETURN_PROCESS_STATUS_LABELS[returnProcess.status] : '-'}</strong></div>
          <div><span>Return Reason</span><strong>{returnProcess ? RETURN_REASON_LABELS[returnProcess.returnReason] : '-'}</strong></div>
          <div><span>Purchase Order</span><strong>{returnProcess ? getPurchaseOrderLabel(returnProcess.purchaseOrderId, purchaseOrderMap) : '-'}</strong></div>
          <div><span>Goods Receipt</span><strong>{returnProcess ? getGoodsReceiptLabel(returnProcess.goodsReceiptId, receiptMap) : '-'}</strong></div>
          <div><span>Inventory Lot</span><strong>{lot?.lotNo || '-'}</strong></div>
          <div><span>Lot Status</span><strong>{lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}</strong></div>
          <div><span>Return Quantity</span><strong>{returnProcess && lot ? formatQuantity(returnProcess.returnQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Remaining Quantity</span><strong>{lot ? formatQuantity(lot.remainingQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(record.warehouseId, branchMap)}</strong></div>
          <div><span>Shipment Date</span><strong>{formatDate(record.shipmentDate)}</strong></div>
          <div><span>Delivery Date</span><strong>{formatDate(record.deliveryDate)}</strong></div>
          <div><span>Tracking Number</span><strong>{record.trackingNumber || '-'}</strong></div>
          <div><span>Receiver</span><strong>{record.receiverName || '-'}</strong></div>
          <div><span>Transport Method</span><strong>{SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS[record.transportMethod]}</strong></div>
          <div><span>Status</span><strong>{SUPPLIER_RETURN_STATUS_LABELS[record.status]}</strong></div>
          <div><span>Created By</span><strong>{record.createdBy || '-'}</strong></div>
        </div>
      </section>

      <section className="card supplier-return-detail-card">
        <h3>Notes</h3>
        <p className="supplier-return-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
