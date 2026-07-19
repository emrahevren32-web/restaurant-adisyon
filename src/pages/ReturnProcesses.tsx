import React from 'react'
import {
  RETURN_PROCESS_STATUSES,
  RETURN_PROCESS_STATUS_LABELS,
  RETURN_REASONS,
  RETURN_REASON_LABELS,
  getNextReturnProcessNo,
  getReturnableQuantityForLot,
  getReturnedQuantityForLot,
  isReturnProcessQuantityBlockingStatus,
  loadReturnProcessRecords,
  saveReturnProcessRecords
} from '../return-processes/return-process.mock'
import type {
  ReturnProcess,
  ReturnProcessStatus,
  ReturnReason
} from '../return-processes/return-process.types'
import {
  QUALITY_CONTROL_DECISION_LABELS,
  applyCompletedQualityControlsToInventoryLots,
  loadQualityControlRecords
} from '../quality-controls/quality-control.mock'
import type { QualityControl } from '../quality-controls/quality-control.types'
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
type StatusFilter = ReturnProcessStatus | FilterValue
type ReasonFilter = ReturnReason | FilterValue
type PanelMode = 'detail' | 'form'

type ReturnProcessInitialData = {
  branches: Branch[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
  qualityControls: QualityControl[]
  returnProcesses: ReturnProcess[]
}

type ReturnProcessFormState = {
  returnNo: string
  qualityControlId: string
  returnReason: ReturnReason
  returnQuantity: number
  status: ReturnProcessStatus
  notes: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const normalizeQuantity = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: ReturnProcessStatus) => {
  if(status === 'COMPLETED' || status === 'APPROVED') return 'success'
  if(status === 'PENDING' || status === 'DRAFT') return 'warning-pill'
  if(status === 'REJECTED' || status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): ReturnProcessInitialData => {
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
  const syncedInventoryLots = applyCompletedQualityControlsToInventoryLots(inventoryLots, qualityControls)

  if(syncedInventoryLots.some((lot, index) => lot !== inventoryLots[index])){
    saveInventoryLotRecords(syncedInventoryLots)
  }

  const returnProcesses = loadReturnProcessRecords(qualityControls, syncedInventoryLots, goodsReceipts)

  return {
    branches,
    suppliers,
    purchaseOrders,
    goodsReceipts,
    inventoryLots: syncedInventoryLots,
    qualityControls,
    returnProcesses
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

const getLotLabel = (inventoryLotId: string, lotMap: Map<string, InventoryLot>) => {
  const lot = lotMap.get(inventoryLotId)
  return lot ? lot.lotNo : 'Lot bulunamadı'
}

const getQualityControlLabel = (
  qualityControlId: string,
  qualityControlMap: Map<string, QualityControl>
) => {
  const qualityControl = qualityControlMap.get(qualityControlId)
  return qualityControl ? qualityControl.qcNo : 'QC bulunamadı'
}

const getGoodsReceiptLabel = (
  goodsReceiptId: string,
  receiptMap: Map<string, GoodsReceiptRecord>
) => {
  const receipt = receiptMap.get(goodsReceiptId)
  return receipt ? receipt.receiptNo : 'Goods Receipt bulunamadı'
}

const getPurchaseOrderLabel = (
  purchaseOrderId: string,
  purchaseOrderMap: Map<string, PurchaseOrder>
) => {
  const purchaseOrder = purchaseOrderMap.get(purchaseOrderId)
  return purchaseOrder ? purchaseOrder.orderNo : 'Purchase Order bulunamadı'
}

const getReturnableRejectedQualityControls = (
  qualityControls: QualityControl[],
  inventoryLots: InventoryLot[],
  returnProcesses: ReturnProcess[]
) => {
  const lotMap = new Map(inventoryLots.map(lot => [lot.id, lot]))

  return qualityControls.filter(qualityControl => {
    if(qualityControl.decision !== 'REJECTED') return false
    const lot = lotMap.get(qualityControl.inventoryLotId)
    return Boolean(lot && getReturnableQuantityForLot(returnProcesses, lot) > 0)
  })
}

const getDefaultReturnQuantity = (
  qualityControlId: string,
  qualityControlMap: Map<string, QualityControl>,
  lotMap: Map<string, InventoryLot>,
  returnProcesses: ReturnProcess[]
) => {
  const qualityControl = qualityControlMap.get(qualityControlId)
  const lot = qualityControl ? lotMap.get(qualityControl.inventoryLotId) || null : null
  if(!lot) return 0

  const returnableQuantity = getReturnableQuantityForLot(returnProcesses, lot)
  return roundQuantity(Math.min(returnableQuantity, Math.max(0.001, lot.remainingQuantity * 0.25)))
}

const createEmptyForm = (
  qualityControls: QualityControl[],
  inventoryLots: InventoryLot[],
  returnProcesses: ReturnProcess[],
  currentUser: User
): ReturnProcessFormState => {
  const returnableQualityControls = getReturnableRejectedQualityControls(qualityControls, inventoryLots, returnProcesses)
  const qualityControl = returnableQualityControls[0] || null
  const qualityControlMap = new Map(qualityControls.map(record => [record.id, record]))
  const lotMap = new Map(inventoryLots.map(lot => [lot.id, lot]))

  return {
    returnNo: getNextReturnProcessNo(returnProcesses),
    qualityControlId: qualityControl?.id || '',
    returnReason: 'QUALITY_FAILURE',
    returnQuantity: qualityControl
      ? getDefaultReturnQuantity(qualityControl.id, qualityControlMap, lotMap, returnProcesses)
      : 0,
    status: 'PENDING',
    notes: `${getUserName(currentUser)} tarafından kalite red süreci için oluşturuldu.`
  }
}

const validateForm = (
  form: ReturnProcessFormState,
  qualityControlMap: Map<string, QualityControl>,
  lotMap: Map<string, InventoryLot>,
  returnProcesses: ReturnProcess[]
) => {
  const qualityControl = qualityControlMap.get(form.qualityControlId)
  if(!qualityControl) return 'Quality Control zorunludur.'
  if(qualityControl.decision !== 'REJECTED') return 'Sadece REJECTED kararlı Quality Control kayıtları için iade süreci oluşturulabilir.'

  const lot = lotMap.get(qualityControl.inventoryLotId)
  if(!lot) return 'Inventory Lot bulunamadı.'
  if(!Number.isFinite(form.returnQuantity)) return 'Return Quantity geçerli sayı olmalıdır.'
  if(form.returnQuantity <= 0) return 'Return Quantity 0’dan büyük olmalıdır.'
  if(form.returnQuantity > lot.remainingQuantity) return 'Return Quantity, Remaining Quantity değerinden büyük olamaz.'

  const currentReturnedQuantity = getReturnedQuantityForLot(returnProcesses, lot.id)
  const nextReturnedQuantity = isReturnProcessQuantityBlockingStatus(form.status)
    ? currentReturnedQuantity + form.returnQuantity
    : currentReturnedQuantity

  if(nextReturnedQuantity > lot.remainingQuantity){
    return 'Aynı Lot için yapılan toplam iadeler Remaining Quantity değerini geçemez.'
  }

  return ''
}

const createReturnProcessPayload = (
  form: ReturnProcessFormState,
  qualityControl: QualityControl,
  lot: InventoryLot,
  receipt: GoodsReceiptRecord,
  currentUser: User
): ReturnProcess => {
  const now = new Date().toISOString()

  return {
    id: createId('return_process'),
    returnNo: form.returnNo,
    qualityControlId: qualityControl.id,
    inventoryLotId: lot.id,
    goodsReceiptId: receipt.id,
    purchaseOrderId: receipt.purchaseOrderId,
    supplierId: lot.supplierId,
    warehouseId: lot.warehouseId,
    returnReason: form.returnReason,
    returnQuantity: roundQuantity(form.returnQuantity),
    status: form.status,
    notes: form.notes.trim(),
    createdBy: getUserName(currentUser),
    createdAt: now,
    updatedAt: now
  }
}

export default function ReturnProcesses({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ReturnProcess[]>(initialData.returnProcesses)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<ReturnProcessFormState>(() => createEmptyForm(
    initialData.qualityControls,
    initialData.inventoryLots,
    initialData.returnProcesses,
    currentUser
  ))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [reasonFilter, setReasonFilter] = React.useState<ReasonFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')

  const {
    branches,
    goodsReceipts,
    inventoryLots,
    purchaseOrders,
    qualityControls,
    suppliers
  } = initialData

  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const receiptMap = React.useMemo(() => new Map(goodsReceipts.map(receipt => [receipt.id, receipt])), [goodsReceipts])
  const purchaseOrderMap = React.useMemo(() => new Map(purchaseOrders.map(order => [order.id, order])), [purchaseOrders])
  const qualityControlMap = React.useMemo(() => new Map(qualityControls.map(record => [record.id, record])), [qualityControls])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: ReturnProcess[]) => {
    setRecords(nextRecords)
    saveReturnProcessRecords(nextRecords)
  }, [])

  const rejectedQualityControls = React.useMemo(() => (
    qualityControls.filter(qualityControl => qualityControl.decision === 'REJECTED')
  ), [qualityControls])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const supplier = supplierMap.get(record.supplierId)
      const lot = lotMap.get(record.inventoryLotId)
      const searchFields = [
        record.returnNo,
        supplier?.name || '',
        supplier?.tradeName || '',
        lot?.lotNo || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesReason = reasonFilter === 'all' || record.returnReason === reasonFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter

      return matchesSearch && matchesStatus && matchesReason && matchesSupplier && matchesWarehouse
    })
  }, [lotMap, reasonFilter, records, search, statusFilter, supplierFilter, supplierMap, warehouseFilter])

  const pendingCount = records.filter(record => record.status === 'PENDING').length
  const approvedCount = records.filter(record => record.status === 'APPROVED').length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const returnQuantityTotal = records
    .filter(record => isReturnProcessQuantityBlockingStatus(record.status))
    .reduce((total, record) => total + record.returnQuantity, 0)

  const startCreate = () => {
    setForm(createEmptyForm(qualityControls, inventoryLots, records, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(qualityControls, inventoryLots, records, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormQualityControl = (qualityControlId: string) => {
    setForm(current => ({
      ...current,
      qualityControlId,
      returnQuantity: getDefaultReturnQuantity(qualityControlId, qualityControlMap, lotMap, records)
    }))
  }

  const updateRecordStatus = (
    record: ReturnProcess,
    status: ReturnProcessStatus
  ) => {
    const lot = lotMap.get(record.inventoryLotId)
    if(!lot) return

    const currentReturnedQuantity = getReturnedQuantityForLot(records, lot.id, record.id)
    const nextReturnedQuantity = isReturnProcessQuantityBlockingStatus(status)
      ? currentReturnedQuantity + record.returnQuantity
      : currentReturnedQuantity

    if(nextReturnedQuantity > lot.remainingQuantity){
      setFormError('Bu durum değişikliği toplam iade miktarını Remaining Quantity üzerine çıkarır.')
      return
    }

    const now = new Date().toISOString()
    const nextRecord = {
      ...record,
      status,
      updatedAt: now
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setPanelMode('detail')
    setFormError('')
  }

  const submitReturnProcess = () => {
    const validationError = validateForm(form, qualityControlMap, lotMap, records)
    if(validationError){
      setFormError(validationError)
      return
    }

    const qualityControl = qualityControlMap.get(form.qualityControlId)
    const lot = qualityControl ? lotMap.get(qualityControl.inventoryLotId) || null : null
    const receipt = lot ? receiptMap.get(lot.goodsReceiptId) || null : null
    if(!qualityControl || !lot || !receipt){
      setFormError('İade süreci ilişkili QC, Lot veya Goods Receipt kaydını bulamadı.')
      return
    }

    const payload = createReturnProcessPayload(form, qualityControl, lot, receipt, currentUser)
    const nextRecords = [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(qualityControls, inventoryLots, nextRecords, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="return-process-page">
      <div className="page-header">
        <div>
          <h2>Red ve İade Süreci</h2>
          <p className="muted">REJECTED kalite kararlarından tedarikçi iade süreçleri oluşturun ve takip edin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Return Process Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Rejected QC</span>
          <strong>{rejectedQualityControls.length}</strong>
        </div>
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylanan</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>İade Miktarı</span>
          <strong>{returnQuantityTotal.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</strong>
        </div>
      </div>

      <div className="product-layout return-process-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Return Process Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor. Tamamlanan: {completedCount}</p>
            </div>
          </div>

          <div className="return-process-toolbar">
            <input
              type="search"
              placeholder="Return No, Supplier veya Lot ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {RETURN_PROCESS_STATUSES.map(status => (
                <option key={status} value={status}>{RETURN_PROCESS_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={reasonFilter} onChange={event => setReasonFilter(event.target.value as ReasonFilter)}>
              <option value="all">Tüm Nedenler</option>
              {RETURN_REASONS.map(reason => (
                <option key={reason} value={reason}>{RETURN_REASON_LABELS[reason]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Warehouse</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

          <div className="table-wrap return-process-table-wrap">
            <table className="data-table return-process-table">
              <thead>
                <tr>
                  <th>Return No</th>
                  <th>Supplier</th>
                  <th>Lot</th>
                  <th>Quality Control</th>
                  <th>Reason</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun iade süreci bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const lot = lotMap.get(record.inventoryLotId)

                  return (
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
                      <td data-label="Return No"><strong>{record.returnNo}</strong></td>
                      <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                      <td data-label="Lot">{getLotLabel(record.inventoryLotId, lotMap)}</td>
                      <td data-label="Quality Control">{getQualityControlLabel(record.qualityControlId, qualityControlMap)}</td>
                      <td data-label="Reason">{RETURN_REASON_LABELS[record.returnReason]}</td>
                      <td data-label="Quantity">{lot ? formatQuantity(record.returnQuantity, lot.unit) : record.returnQuantity}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {RETURN_PROCESS_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td data-label="Date">{formatDate(record.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side return-process-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Return Process Oluştur</h3>
                  <p className="muted">{form.returnNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <ReturnProcessForm
                form={form}
                qualityControls={qualityControls}
                returnProcesses={records}
                qualityControlMap={qualityControlMap}
                lotMap={lotMap}
                supplierMap={supplierMap}
                receiptMap={receiptMap}
                purchaseOrderMap={purchaseOrderMap}
                onQualityControlChange={updateFormQualityControl}
                onChange={setForm}
                onSubmit={submitReturnProcess}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <ReturnProcessDetailPanel
              record={selectedRecord}
              formError={formError}
              qualityControlMap={qualityControlMap}
              lotMap={lotMap}
              receiptMap={receiptMap}
              purchaseOrderMap={purchaseOrderMap}
              supplierMap={supplierMap}
              branchMap={branchMap}
              returnProcesses={records}
              onCreate={startCreate}
              onStatusChange={updateRecordStatus}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function ReturnProcessForm({
  form,
  qualityControls,
  returnProcesses,
  qualityControlMap,
  lotMap,
  supplierMap,
  receiptMap,
  purchaseOrderMap,
  onQualityControlChange,
  onChange,
  onSubmit,
  onCancel
}: {
  form: ReturnProcessFormState
  qualityControls: QualityControl[]
  returnProcesses: ReturnProcess[]
  qualityControlMap: Map<string, QualityControl>
  lotMap: Map<string, InventoryLot>
  supplierMap: Map<string, Supplier>
  receiptMap: Map<string, GoodsReceiptRecord>
  purchaseOrderMap: Map<string, PurchaseOrder>
  onQualityControlChange: (qualityControlId: string) => void
  onChange: (form: ReturnProcessFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const rejectedQualityControls = qualityControls.filter(qualityControl => qualityControl.decision === 'REJECTED')
  const selectedQualityControl = qualityControlMap.get(form.qualityControlId) || null
  const selectedLot = selectedQualityControl ? lotMap.get(selectedQualityControl.inventoryLotId) || null : null
  const selectedReceipt = selectedLot ? receiptMap.get(selectedLot.goodsReceiptId) || null : null
  const returnableQuantity = selectedLot ? getReturnableQuantityForLot(returnProcesses, selectedLot) : 0

  return (
    <form className="stacked-form return-process-form" onSubmit={event => event.preventDefault()}>
      <div className="return-process-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="return-process-form-grid">
          <div className="form-field">
            <label>Return No</label>
            <input value={form.returnNo} readOnly />
          </div>
          <div className="form-field">
            <label>Quality Control</label>
            <select value={form.qualityControlId} onChange={event => onQualityControlChange(event.target.value)} required>
              <option value="">REJECTED QC seçin</option>
              {rejectedQualityControls.map(qualityControl => {
                const lot = lotMap.get(qualityControl.inventoryLotId)
                const disabled = lot ? getReturnableQuantityForLot(returnProcesses, lot) <= 0 : true

                return (
                  <option key={qualityControl.id} value={qualityControl.id} disabled={disabled}>
                    {qualityControl.qcNo}{lot ? ` · ${lot.lotNo}` : ''}{disabled ? ' · İade limiti dolu' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Supplier</label>
            <input value={selectedLot ? getSupplierLabel(selectedLot.supplierId, supplierMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Inventory Lot</label>
            <input value={selectedLot?.lotNo || ''} readOnly />
          </div>
          <div className="form-field">
            <label>Goods Receipt</label>
            <input value={selectedReceipt ? getGoodsReceiptLabel(selectedReceipt.id, receiptMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Purchase Order</label>
            <input value={selectedReceipt ? getPurchaseOrderLabel(selectedReceipt.purchaseOrderId, purchaseOrderMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Remaining Quantity</label>
            <input value={selectedLot ? formatQuantity(selectedLot.remainingQuantity, selectedLot.unit) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Returnable Quantity</label>
            <input value={selectedLot ? formatQuantity(returnableQuantity, selectedLot.unit) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Return Reason</label>
            <select value={form.returnReason} onChange={event => onChange({ ...form, returnReason: event.target.value as ReturnReason })}>
              {RETURN_REASONS.map(reason => (
                <option key={reason} value={reason}>{RETURN_REASON_LABELS[reason]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Return Quantity</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={Number.isNaN(form.returnQuantity) ? '' : form.returnQuantity}
              onChange={event => onChange({ ...form, returnQuantity: normalizeQuantity(event.target.value) })}
            />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={form.status} onChange={event => onChange({ ...form, status: event.target.value as ReturnProcessStatus })}>
              {RETURN_PROCESS_STATUSES.map(status => (
                <option key={status} value={status}>{RETURN_PROCESS_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="return-process-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Notes</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Return Process Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function ReturnProcessDetailPanel({
  record,
  formError,
  qualityControlMap,
  lotMap,
  receiptMap,
  purchaseOrderMap,
  supplierMap,
  branchMap,
  returnProcesses,
  onCreate,
  onStatusChange
}: {
  record: ReturnProcess | null
  formError: string
  qualityControlMap: Map<string, QualityControl>
  lotMap: Map<string, InventoryLot>
  receiptMap: Map<string, GoodsReceiptRecord>
  purchaseOrderMap: Map<string, PurchaseOrder>
  supplierMap: Map<string, Supplier>
  branchMap: Map<string, Branch>
  returnProcesses: ReturnProcess[]
  onCreate: () => void
  onStatusChange: (record: ReturnProcess, status: ReturnProcessStatus) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>İade Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir iade süreci seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Return Process Oluştur</button>
      </section>
    )
  }

  const qualityControl = qualityControlMap.get(record.qualityControlId) || null
  const lot = lotMap.get(record.inventoryLotId) || null
  const receipt = receiptMap.get(record.goodsReceiptId) || null
  const purchaseOrder = purchaseOrderMap.get(record.purchaseOrderId) || null
  const lotReturnedQuantity = lot ? getReturnedQuantityForLot(returnProcesses, lot.id) : 0
  const lotReturnableQuantity = lot ? getReturnableQuantityForLot(returnProcesses, lot, record.id) : 0

  return (
    <>
      <section className="card return-process-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.returnNo}</h3>
            <p className="muted">{lot?.lotNo || 'Lot bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {RETURN_PROCESS_STATUS_LABELS[record.status]}
          </span>
        </div>
        {formError && <div className="form-error">{formError}</div>}
        <div className="return-process-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn" type="button" onClick={() => onStatusChange(record, 'PENDING')}>Beklet</button>
          <button className="btn primary" type="button" onClick={() => onStatusChange(record, 'APPROVED')}>Onayla</button>
          <button className="btn" type="button" onClick={() => onStatusChange(record, 'COMPLETED')}>Tamamla</button>
          <button className="btn" type="button" onClick={() => onStatusChange(record, 'CANCELLED')}>İptal</button>
        </div>
      </section>

      <section className="card return-process-detail-card">
        <h3>Detay</h3>
        <div className="return-process-detail-grid">
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Purchase Order</span><strong>{purchaseOrder?.orderNo || '-'}</strong></div>
          <div><span>Goods Receipt</span><strong>{receipt?.receiptNo || '-'}</strong></div>
          <div><span>Inventory Lot</span><strong>{lot?.lotNo || '-'}</strong></div>
          <div><span>Lot Durumu</span><strong>{lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}</strong></div>
          <div><span>Quality Control</span><strong>{qualityControl?.qcNo || '-'}</strong></div>
          <div><span>QC Kararı</span><strong>{qualityControl?.decision ? QUALITY_CONTROL_DECISION_LABELS[qualityControl.decision] : '-'}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(record.warehouseId, branchMap)}</strong></div>
          <div><span>Return Quantity</span><strong>{lot ? formatQuantity(record.returnQuantity, lot.unit) : record.returnQuantity}</strong></div>
          <div><span>Remaining Quantity</span><strong>{lot ? formatQuantity(lot.remainingQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Lot Toplam İade</span><strong>{lot ? formatQuantity(lotReturnedQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Kalan İade Limiti</span><strong>{lot ? formatQuantity(lotReturnableQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Reason</span><strong>{RETURN_REASON_LABELS[record.returnReason]}</strong></div>
          <div><span>Status</span><strong>{RETURN_PROCESS_STATUS_LABELS[record.status]}</strong></div>
          <div><span>Created By</span><strong>{record.createdBy || '-'}</strong></div>
          <div><span>Date</span><strong>{formatDate(record.createdAt)}</strong></div>
        </div>
      </section>

      <section className="card return-process-detail-card">
        <h3>Notes</h3>
        <p className="return-process-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
