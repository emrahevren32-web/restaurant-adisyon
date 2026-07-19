import React from 'react'
import {
  QUALITY_CONTROL_DECISIONS,
  QUALITY_CONTROL_DECISION_LABELS,
  QUALITY_CONTROL_STATUSES,
  QUALITY_CONTROL_STATUS_LABELS,
  applyCompletedQualityControlsToInventoryLots,
  applyQualityDecisionToLot,
  getNextQualityControlNo,
  hasActiveQualityControl,
  loadQualityControlRecords,
  saveQualityControlRecords
} from '../quality-controls/quality-control.mock'
import type {
  QualityControl,
  QualityControlDecision,
  QualityControlStatus
} from '../quality-controls/quality-control.types'
import {
  INVENTORY_LOT_STATUS_LABELS,
  getInventoryLotExpiryLabel,
  getInventoryLotExpirySignal,
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
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Supplier } from '../supplier-management/supplier-management.types'
import {
  loadBranches,
  loadStockItems
} from '../storage'
import type { Branch, StockItem, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type DecisionFilter = QualityControlDecision | FilterValue
type StatusFilter = QualityControlStatus | FilterValue
type PanelMode = 'detail' | 'form'

type QualityControlFormState = {
  qcNo: string
  inventoryLotId: string
  inspectionDate: string
  inspector: string
  sampleQuantity: number
  decision: QualityControlDecision | ''
  status: QualityControlStatus
  notes: string
}

type QualityControlInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  suppliers: Supplier[]
  purchaseRequests: PurchaseRequestRecord[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
  qualityControls: QualityControl[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const normalizeQuantity = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getDecisionLabel = (decision: QualityControlDecision | '') => (
  decision ? QUALITY_CONTROL_DECISION_LABELS[decision] : '-'
)

const getDecisionClass = (decision: QualityControlDecision | '') => {
  if(decision === 'APPROVED') return 'success'
  if(decision === 'REJECTED') return 'danger-pill'
  if(decision === 'QUARANTINE') return 'warning-pill'
  return 'muted-pill'
}

const getStatusClass = (status: QualityControlStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'IN_PROGRESS') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): QualityControlInitialData => {
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

  return {
    branches,
    stockItems,
    suppliers,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
    inventoryLots: syncedInventoryLots,
    qualityControls
  }
}

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => {
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const getStockItemLabel = (stockItemId: string, stockItemMap: Map<string, StockItem>) => {
  const stockItem = stockItemMap.get(stockItemId)
  return stockItem ? stockItem.name : 'Stock Item bulunamadı'
}

const getWarehouseLabel = (warehouseId: string, branchMap: Map<string, Branch>) => {
  const branch = branchMap.get(warehouseId)
  return branch ? branch.name : 'Warehouse bulunamadı'
}

const getLotLabel = (inventoryLotId: string, lotMap: Map<string, InventoryLot>) => {
  const lot = lotMap.get(inventoryLotId)
  return lot ? lot.lotNo : 'Lot bulunamadı'
}

const getGoodsReceiptLabel = (goodsReceiptId: string, receiptMap: Map<string, GoodsReceiptRecord>) => {
  const receipt = receiptMap.get(goodsReceiptId)
  return receipt ? receipt.receiptNo : 'Goods Receipt bulunamadı'
}

const getPurchaseOrder = (
  lot: InventoryLot | null,
  receiptMap: Map<string, GoodsReceiptRecord>,
  purchaseOrderMap: Map<string, PurchaseOrder>
) => {
  if(!lot) return null
  const receipt = receiptMap.get(lot.goodsReceiptId)
  return receipt ? purchaseOrderMap.get(receipt.purchaseOrderId) || null : null
}

const getRequestLabel = (
  purchaseRequestId: string,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const request = purchaseRequestMap.get(purchaseRequestId)
  return request ? `${request.requestNo} · ${request.title}` : 'Purchase Request bulunamadı'
}

const getSampleFallback = (lot: InventoryLot | null) => (
  lot ? roundQuantity(Math.min(lot.remainingQuantity, Math.max(0.001, lot.remainingQuantity * 0.02))) : 0
)

const createEmptyForm = (
  records: QualityControl[],
  inventoryLots: InventoryLot[],
  currentUser: User
): QualityControlFormState => {
  const lot = inventoryLots.find(item => !hasActiveQualityControl(records, item.id)) || null

  return {
    qcNo: getNextQualityControlNo(records),
    inventoryLotId: lot?.id || '',
    inspectionDate: getTodayKey(),
    inspector: getUserName(currentUser),
    sampleQuantity: getSampleFallback(lot),
    decision: '',
    status: 'PENDING',
    notes: ''
  }
}

const validateForm = (
  form: QualityControlFormState,
  records: QualityControl[],
  inventoryLots: InventoryLot[]
) => {
  const lot = inventoryLots.find(item => item.id === form.inventoryLotId)
  if(!lot) return 'Inventory Lot zorunludur.'
  if(hasActiveQualityControl(records, lot.id)) return 'Bu lot için aktif Quality Control kaydı zaten var.'
  if(!Number.isFinite(form.sampleQuantity)) return 'Sample Quantity geçerli sayı olmalıdır.'
  if(form.sampleQuantity < 0) return 'Sample Quantity negatif olamaz.'
  if(form.sampleQuantity > lot.remainingQuantity) return 'Sample Quantity, Remaining Quantity değerinden büyük olamaz.'
  if(form.status === 'COMPLETED' && !form.decision) return 'Decision seçilmeden Completed olamaz.'

  return ''
}

const createQualityControlPayload = (
  form: QualityControlFormState,
  lot: InventoryLot
): QualityControl => {
  const now = new Date().toISOString()

  return {
    id: createId('quality_control'),
    qcNo: form.qcNo,
    inventoryLotId: lot.id,
    goodsReceiptId: lot.goodsReceiptId,
    stockItemId: lot.stockItemId,
    supplierId: lot.supplierId,
    warehouseId: lot.warehouseId,
    inspectionDate: form.inspectionDate,
    inspector: form.inspector.trim() || 'Kalite Kontrol',
    sampleQuantity: form.sampleQuantity,
    decision: form.decision,
    status: form.status,
    notes: form.notes.trim(),
    createdAt: now,
    updatedAt: now
  }
}

export default function QualityControls({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<QualityControl[]>(initialData.qualityControls)
  const [inventoryLots, setInventoryLots] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<QualityControlFormState>(() => createEmptyForm(
    initialData.qualityControls,
    initialData.inventoryLots,
    currentUser
  ))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [decisionFilter, setDecisionFilter] = React.useState<DecisionFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [stockItemFilter, setStockItemFilter] = React.useState('all')

  const {
    branches,
    goodsReceipts,
    purchaseOrders,
    purchaseRequests,
    stockItems,
    suppliers
  } = initialData

  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const receiptMap = React.useMemo(() => new Map(goodsReceipts.map(receipt => [receipt.id, receipt])), [goodsReceipts])
  const purchaseOrderMap = React.useMemo(() => new Map(purchaseOrders.map(order => [order.id, order])), [purchaseOrders])
  const purchaseRequestMap = React.useMemo(() => new Map(purchaseRequests.map(request => [request.id, request])), [purchaseRequests])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: QualityControl[]) => {
    setRecords(nextRecords)
    saveQualityControlRecords(nextRecords)
  }, [])

  const commitInventoryLots = React.useCallback((nextLots: InventoryLot[]) => {
    setInventoryLots(nextLots)
    saveInventoryLotRecords(nextLots)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const lot = lotMap.get(record.inventoryLotId)
      const stockItem = stockItemMap.get(record.stockItemId)
      const supplier = supplierMap.get(record.supplierId)
      const searchFields = [
        record.qcNo,
        lot?.lotNo || '',
        stockItem?.name || '',
        stockItem?.sku || '',
        supplier?.name || '',
        supplier?.tradeName || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesDecision = decisionFilter === 'all' || record.decision === decisionFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
      const matchesStockItem = stockItemFilter === 'all' || record.stockItemId === stockItemFilter

      return matchesSearch && matchesDecision && matchesStatus && matchesSupplier && matchesWarehouse && matchesStockItem
    })
  }, [decisionFilter, lotMap, records, search, statusFilter, stockItemFilter, stockItemMap, supplierFilter, supplierMap, warehouseFilter])

  const approvedCount = records.filter(record => record.decision === 'APPROVED').length
  const rejectedCount = records.filter(record => record.decision === 'REJECTED').length
  const quarantineCount = records.filter(record => record.decision === 'QUARANTINE').length
  const activeCount = records.filter(record => record.status !== 'COMPLETED').length

  const startCreate = () => {
    setForm(createEmptyForm(records, inventoryLots, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(records, inventoryLots, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormLot = (inventoryLotId: string) => {
    const lot = inventoryLots.find(item => item.id === inventoryLotId) || null
    setForm(current => ({
      ...current,
      inventoryLotId,
      sampleQuantity: getSampleFallback(lot)
    }))
  }

  const applyCompletedDecision = (
    qualityControl: QualityControl,
    decision: QualityControlDecision
  ) => {
    const lot = lotMap.get(qualityControl.inventoryLotId)
    if(!lot) return

    const now = new Date().toISOString()
    const nextQualityControl: QualityControl = {
      ...qualityControl,
      decision,
      status: 'COMPLETED',
      updatedAt: now
    }
    const nextLot = applyQualityDecisionToLot(lot, decision)

    commitRecords(records.map(record => record.id === qualityControl.id ? nextQualityControl : record))
    commitInventoryLots(inventoryLots.map(item => item.id === nextLot.id ? nextLot : item))
    setSelectedRecordId(nextQualityControl.id)
  }

  const submitQualityControl = () => {
    const validationError = validateForm(form, records, inventoryLots)
    if(validationError){
      setFormError(validationError)
      return
    }

    const lot = lotMap.get(form.inventoryLotId)
    if(!lot){
      setFormError('Inventory Lot bulunamadı.')
      return
    }

    const payload = createQualityControlPayload(form, lot)
    const nextRecords = [payload, ...records]
    const nextInventoryLots = payload.status === 'COMPLETED' && payload.decision
      ? inventoryLots.map(item => item.id === lot.id ? applyQualityDecisionToLot(item, payload.decision as QualityControlDecision) : item)
      : inventoryLots

    commitRecords(nextRecords)
    if(nextInventoryLots !== inventoryLots) commitInventoryLots(nextInventoryLots)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(nextRecords, nextInventoryLots, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="quality-control-page">
      <div className="page-header">
        <div>
          <h2>Kalite Kontrol</h2>
          <p className="muted">Inventory Lot kayıtlarının kalite kararlarını yönetin ve lot kullanım durumunu güncelleyin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Quality Control Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Kabul</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Red</span>
          <strong>{rejectedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Karantina</span>
          <strong>{quarantineCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Kontrol</span>
          <strong>{activeCount}</strong>
        </div>
      </div>

      <div className="product-layout quality-control-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Kalite Kontrol Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="quality-control-toolbar">
            <input
              type="search"
              placeholder="QC No, Lot No, Stock Item veya Supplier ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={decisionFilter} onChange={event => setDecisionFilter(event.target.value as DecisionFilter)}>
              <option value="all">Tüm Kararlar</option>
              {QUALITY_CONTROL_DECISIONS.map(decision => (
                <option key={decision} value={decision}>{QUALITY_CONTROL_DECISION_LABELS[decision]}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Statüler</option>
              {QUALITY_CONTROL_STATUSES.map(status => (
                <option key={status} value={status}>{QUALITY_CONTROL_STATUS_LABELS[status]}</option>
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
            <select value={stockItemFilter} onChange={event => setStockItemFilter(event.target.value)}>
              <option value="all">Tüm Stock Item</option>
              {stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
            </select>
          </div>

          <div className="table-wrap quality-control-table-wrap">
            <table className="data-table quality-control-table">
              <thead>
                <tr>
                  <th>QC No</th>
                  <th>Lot No</th>
                  <th>Stock Item</th>
                  <th>Supplier</th>
                  <th>Inspector</th>
                  <th>Decision</th>
                  <th>Status</th>
                  <th>Inspection Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun kalite kontrol kaydı bulunamadı.</td></tr>
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
                    <td data-label="QC No"><strong>{record.qcNo}</strong></td>
                    <td data-label="Lot No">{getLotLabel(record.inventoryLotId, lotMap)}</td>
                    <td data-label="Stock Item">{getStockItemLabel(record.stockItemId, stockItemMap)}</td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Inspector">{record.inspector || '-'}</td>
                    <td data-label="Decision">
                      <span className={`status-pill ${getDecisionClass(record.decision)}`}>
                        {getDecisionLabel(record.decision)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {QUALITY_CONTROL_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                    <td data-label="Inspection Date">{formatDate(record.inspectionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side quality-control-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Quality Control Oluştur</h3>
                  <p className="muted">{form.qcNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <QualityControlForm
                form={form}
                records={records}
                inventoryLots={inventoryLots}
                lotMap={lotMap}
                supplierMap={supplierMap}
                stockItemMap={stockItemMap}
                branchMap={branchMap}
                onLotChange={updateFormLot}
                onChange={setForm}
                onSubmit={submitQualityControl}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <QualityControlDetailPanel
              record={selectedRecord}
              lotMap={lotMap}
              receiptMap={receiptMap}
              purchaseOrderMap={purchaseOrderMap}
              purchaseRequestMap={purchaseRequestMap}
              supplierMap={supplierMap}
              stockItemMap={stockItemMap}
              branchMap={branchMap}
              onCreate={startCreate}
              onDecision={applyCompletedDecision}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function QualityControlForm({
  form,
  records,
  inventoryLots,
  lotMap,
  supplierMap,
  stockItemMap,
  branchMap,
  onLotChange,
  onChange,
  onSubmit,
  onCancel
}: {
  form: QualityControlFormState
  records: QualityControl[]
  inventoryLots: InventoryLot[]
  lotMap: Map<string, InventoryLot>
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  branchMap: Map<string, Branch>
  onLotChange: (inventoryLotId: string) => void
  onChange: (form: QualityControlFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const selectedLot = lotMap.get(form.inventoryLotId) || null

  return (
    <form className="stacked-form quality-control-form" onSubmit={event => event.preventDefault()}>
      <div className="quality-control-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="quality-control-form-grid">
          <div className="form-field">
            <label>QC No</label>
            <input value={form.qcNo} readOnly />
          </div>
          <div className="form-field">
            <label>Inventory Lot</label>
            <select value={form.inventoryLotId} onChange={event => onLotChange(event.target.value)} required>
              <option value="">Lot seçin</option>
              {inventoryLots.map(lot => {
                const disabled = hasActiveQualityControl(records, lot.id)

                return (
                  <option key={lot.id} value={lot.id} disabled={disabled}>
                    {lot.lotNo} · {getStockItemLabel(lot.stockItemId, stockItemMap)}{disabled ? ' · Aktif QC var' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Stock Item</label>
            <input value={selectedLot ? getStockItemLabel(selectedLot.stockItemId, stockItemMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Supplier</label>
            <input value={selectedLot ? getSupplierLabel(selectedLot.supplierId, supplierMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Warehouse</label>
            <input value={selectedLot ? getWarehouseLabel(selectedLot.warehouseId, branchMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Remaining Quantity</label>
            <input value={selectedLot ? formatQuantity(selectedLot.remainingQuantity, selectedLot.unit) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Inspection Date</label>
            <input type="date" value={form.inspectionDate} onChange={event => onChange({ ...form, inspectionDate: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Inspector</label>
            <input value={form.inspector} onChange={event => onChange({ ...form, inspector: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Sample Quantity</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={Number.isNaN(form.sampleQuantity) ? '' : form.sampleQuantity}
              onChange={event => onChange({ ...form, sampleQuantity: normalizeQuantity(event.target.value) })}
            />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={form.status} onChange={event => onChange({ ...form, status: event.target.value as QualityControlStatus })}>
              {QUALITY_CONTROL_STATUSES.map(status => (
                <option key={status} value={status}>{QUALITY_CONTROL_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Decision</label>
            <select value={form.decision} onChange={event => onChange({ ...form, decision: event.target.value as QualityControlDecision | '' })}>
              <option value="">Karar seçin</option>
              {QUALITY_CONTROL_DECISIONS.map(decision => (
                <option key={decision} value={decision}>{QUALITY_CONTROL_DECISION_LABELS[decision]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="quality-control-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Notlar</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Quality Control Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function QualityControlDetailPanel({
  record,
  lotMap,
  receiptMap,
  purchaseOrderMap,
  purchaseRequestMap,
  supplierMap,
  stockItemMap,
  branchMap,
  onCreate,
  onDecision
}: {
  record: QualityControl | null
  lotMap: Map<string, InventoryLot>
  receiptMap: Map<string, GoodsReceiptRecord>
  purchaseOrderMap: Map<string, PurchaseOrder>
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  branchMap: Map<string, Branch>
  onCreate: () => void
  onDecision: (qualityControl: QualityControl, decision: QualityControlDecision) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Kalite Kontrol Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir kalite kontrol kaydı seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Quality Control Oluştur</button>
      </section>
    )
  }

  const lot = lotMap.get(record.inventoryLotId) || null
  const receipt = lot ? receiptMap.get(lot.goodsReceiptId) || null : null
  const purchaseOrder = getPurchaseOrder(lot, receiptMap, purchaseOrderMap)
  const purchaseRequest = purchaseOrder ? purchaseRequestMap.get(purchaseOrder.purchaseRequestId) || null : null
  const canComplete = record.status !== 'COMPLETED'

  return (
    <>
      <section className="card quality-control-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.qcNo}</h3>
            <p className="muted">{lot?.lotNo || 'Lot bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {QUALITY_CONTROL_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="quality-control-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          {canComplete && <button className="btn primary" type="button" onClick={() => onDecision(record, 'APPROVED')}>Kabul</button>}
          {canComplete && <button className="btn" type="button" onClick={() => onDecision(record, 'REJECTED')}>Red</button>}
          {canComplete && <button className="btn" type="button" onClick={() => onDecision(record, 'QUARANTINE')}>Karantina</button>}
        </div>
      </section>

      <section className="card quality-control-detail-card">
        <h3>Detay</h3>
        <div className="quality-control-detail-grid">
          <div><span>Inventory Lot</span><strong>{lot?.lotNo || '-'}</strong></div>
          <div><span>Lot Durumu</span><strong>{lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}</strong></div>
          <div><span>Goods Receipt</span><strong>{record.goodsReceiptId ? getGoodsReceiptLabel(record.goodsReceiptId, receiptMap) : '-'}</strong></div>
          <div><span>Purchase Order</span><strong>{purchaseOrder?.orderNo || '-'}</strong></div>
          <div><span>Purchase Request</span><strong>{purchaseRequest ? getRequestLabel(purchaseRequest.id, purchaseRequestMap) : '-'}</strong></div>
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(record.warehouseId, branchMap)}</strong></div>
          <div><span>Stock Item</span><strong>{getStockItemLabel(record.stockItemId, stockItemMap)}</strong></div>
          <div><span>Production Date</span><strong>{lot ? formatDate(lot.productionDate) : '-'}</strong></div>
          <div><span>Expiry Date</span><strong>{lot ? formatDate(lot.expiryDate) : '-'}</strong></div>
          <div><span>SKT Uyarısı</span><strong>{lot ? getInventoryLotExpiryLabel(getInventoryLotExpirySignal(lot)) : '-'}</strong></div>
          <div><span>Received Quantity</span><strong>{lot ? formatQuantity(lot.receivedQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Remaining Quantity</span><strong>{lot ? formatQuantity(lot.remainingQuantity, lot.unit) : '-'}</strong></div>
          <div><span>Sample Quantity</span><strong>{lot ? formatQuantity(record.sampleQuantity, lot.unit) : record.sampleQuantity}</strong></div>
          <div><span>Decision</span><strong>{getDecisionLabel(record.decision)}</strong></div>
          <div><span>Inspector</span><strong>{record.inspector || '-'}</strong></div>
        </div>
      </section>

      <section className="card quality-control-detail-card">
        <h3>Notlar</h3>
        <p className="quality-control-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
