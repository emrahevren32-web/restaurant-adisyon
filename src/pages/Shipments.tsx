import React from 'react'
import {
  SHIPMENT_PRIORITIES,
  SHIPMENT_PRIORITY_LABELS,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  getNextShipmentNo,
  loadShipmentRecords,
  saveShipmentRecords
} from '../shipments/shipment.mock'
import type {
  ShipmentItem,
  ShipmentPriority,
  ShipmentRecord,
  ShipmentStatus
} from '../shipments/shipment.types'
import {
  INVENTORY_LOT_STATUS_LABELS,
  loadInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import { loadBranches, loadStockItems } from '../storage'
import type { Branch, StockItem, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = ShipmentStatus | FilterValue
type PriorityFilter = ShipmentPriority | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
}

type ShipmentFormItemState = {
  id: string
  inventoryLotId: string
  quantity: string
  notes: string
}

type ShipmentFormState = {
  shipmentNo: string
  shipmentDate: string
  plannedDeliveryDate: string
  sourceWarehouseId: string
  destinationBranchId: string
  destinationWarehouseId: string
  status: ShipmentStatus
  priority: ShipmentPriority
  notes: string
  items: ShipmentFormItemState[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

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

const getStatusClass = (status: ShipmentStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'SHIPPED') return 'info-pill'
  if(status === 'PICKING' || status === 'READY' || status === 'PLANNED') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getPriorityClass = (priority: ShipmentPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'info-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentInitialData => {
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
  const shipments = loadShipmentRecords(inventoryLots, branches)

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments
  }
}

const getBranchLabel = (branchId: string, branchMap: Map<string, Branch>, fallback = 'Kayıt bulunamadı') => {
  const branch = branchMap.get(branchId)
  return branch ? branch.name : fallback
}

const getStockItemLabel = (stockItemId: string, stockItemMap: Map<string, StockItem>) => {
  const stockItem = stockItemMap.get(stockItemId)
  return stockItem ? stockItem.name : 'Stock Item bulunamadı'
}

const getLotLabel = (
  inventoryLotId: string,
  lotMap: Map<string, InventoryLot>,
  stockItemMap: Map<string, StockItem>
) => {
  const lot = lotMap.get(inventoryLotId)
  if(!lot) return 'Inventory Lot bulunamadı'
  return `${lot.lotNo} · ${getStockItemLabel(lot.stockItemId, stockItemMap)}`
}

const getDestinationLabel = (record: ShipmentRecord, branchMap: Map<string, Branch>) => {
  const branchLabel = record.destinationBranchId
    ? getBranchLabel(record.destinationBranchId, branchMap)
    : ''
  const warehouseLabel = record.destinationWarehouseId
    ? getBranchLabel(record.destinationWarehouseId, branchMap)
    : ''

  if(branchLabel && warehouseLabel) return `${branchLabel} / ${warehouseLabel}`
  return branchLabel || warehouseLabel || 'Hedef seçilmemiş'
}

const getAvailableLots = (inventoryLots: InventoryLot[], sourceWarehouseId = '') => (
  inventoryLots.filter(lot => (
    lot.remainingQuantity > 0
    && lot.status === 'ACTIVE'
    && (!sourceWarehouseId || lot.warehouseId === sourceWarehouseId)
  ))
)

const createFormItem = (lot: InventoryLot | null): ShipmentFormItemState => ({
  id: createId('shipment_form_item'),
  inventoryLotId: lot?.id || '',
  quantity: lot ? String(Math.min(lot.remainingQuantity, 1)) : '',
  notes: ''
})

const createEmptyForm = (
  records: ShipmentRecord[],
  branches: Branch[],
  inventoryLots: InventoryLot[]
): ShipmentFormState => {
  const firstLot = getAvailableLots(inventoryLots)[0] || inventoryLots.find(lot => lot.remainingQuantity > 0) || null
  const sourceWarehouseId = firstLot?.warehouseId || branches[0]?.id || ''
  const destinationBranch = branches.find(branch => branch.id !== sourceWarehouseId) || branches[0] || null

  return {
    shipmentNo: getNextShipmentNo(records),
    shipmentDate: getTodayKey(),
    plannedDeliveryDate: addDays(getTodayKey(), 1),
    sourceWarehouseId,
    destinationBranchId: destinationBranch?.id || '',
    destinationWarehouseId: '',
    status: 'DRAFT',
    priority: 'NORMAL',
    notes: '',
    items: firstLot ? [createFormItem(firstLot)] : []
  }
}

const createFormFromRecord = (record: ShipmentRecord): ShipmentFormState => ({
  shipmentNo: record.shipmentNo,
  shipmentDate: record.shipmentDate,
  plannedDeliveryDate: record.plannedDeliveryDate,
  sourceWarehouseId: record.sourceWarehouseId,
  destinationBranchId: record.destinationBranchId,
  destinationWarehouseId: record.destinationWarehouseId,
  status: record.status,
  priority: record.priority,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    inventoryLotId: item.inventoryLotId,
    quantity: String(item.quantity),
    notes: item.notes
  }))
})

const validateForm = (
  form: ShipmentFormState,
  lotMap: Map<string, InventoryLot>
) => {
  if(!form.sourceWarehouseId) return 'Source Warehouse zorunludur.'
  if(!form.destinationBranchId && !form.destinationWarehouseId) return 'Hedef şube veya depo seçilmelidir.'
  if(form.plannedDeliveryDate && form.shipmentDate && form.plannedDeliveryDate < form.shipmentDate){
    return 'Planned Delivery, Shipment Date öncesinde olamaz.'
  }
  if(form.items.length === 0) return 'En az bir Shipment Item bulunmalıdır.'

  for(const [index, item] of form.items.entries()){
    const lot = lotMap.get(item.inventoryLotId)
    const quantity = Number(item.quantity)

    if(!lot) return `${index + 1}. satır için Inventory Lot zorunludur.`
    if(lot.warehouseId !== form.sourceWarehouseId){
      return `${index + 1}. satırdaki lot, Source Warehouse ile aynı depoda olmalıdır.`
    }
    if(!Number.isFinite(quantity) || quantity <= 0){
      return `${index + 1}. satır quantity 0'dan büyük olmalıdır.`
    }
    if(quantity > lot.remainingQuantity){
      return `${index + 1}. satır quantity, lot remaining quantity değerini geçemez.`
    }
  }

  return ''
}

const createShipmentPayload = (
  form: ShipmentFormState,
  lotMap: Map<string, InventoryLot>,
  currentUser: User,
  existingRecord?: ShipmentRecord
): ShipmentRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment')

  return {
    id,
    shipmentNo: form.shipmentNo,
    shipmentDate: form.shipmentDate,
    plannedDeliveryDate: form.plannedDeliveryDate,
    sourceWarehouseId: form.sourceWarehouseId,
    destinationBranchId: form.destinationBranchId,
    destinationWarehouseId: form.destinationWarehouseId,
    status: form.status,
    priority: form.priority,
    notes: form.notes.trim(),
    createdBy: existingRecord?.createdBy || getUserName(currentUser),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    items: form.items.map((item): ShipmentItem => {
      const lot = lotMap.get(item.inventoryLotId)

      return {
        id: item.id || createId('shipment_item'),
        shipmentId: id,
        inventoryLotId: item.inventoryLotId,
        stockItemId: lot?.stockItemId || '',
        quantity: Number(item.quantity),
        unit: lot?.unit || 'adet',
        notes: item.notes.trim()
      }
    })
  }
}

export default function Shipments({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentRecord[]>(initialData.shipments)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<ShipmentFormState>(() => createEmptyForm(
    initialData.shipments,
    initialData.branches,
    initialData.inventoryLots
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const { branches, inventoryLots, stockItems } = initialData

  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const sourceWarehouseIds = React.useMemo(() => (
    Array.from(new Set(inventoryLots.map(lot => lot.warehouseId).filter(Boolean)))
  ), [inventoryLots])
  const sourceWarehouses = React.useMemo(() => (
    branches.filter(branch => sourceWarehouseIds.includes(branch.id))
  ), [branches, sourceWarehouseIds])
  const visibleSourceWarehouses = sourceWarehouses.length > 0 ? sourceWarehouses : branches

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const availableLotsForForm = React.useMemo(() => (
    getAvailableLots(inventoryLots, form.sourceWarehouseId)
  ), [form.sourceWarehouseId, inventoryLots])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const destinationLabel = getDestinationLabel(record, branchMap)
      const searchFields = [
        record.shipmentNo,
        destinationLabel,
        getBranchLabel(record.destinationBranchId, branchMap, ''),
        getBranchLabel(record.destinationWarehouseId, branchMap, '')
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter
      const matchesWarehouse = warehouseFilter === 'all'
        || record.sourceWarehouseId === warehouseFilter
        || record.destinationWarehouseId === warehouseFilter
      const matchesBranch = branchFilter === 'all' || record.destinationBranchId === branchFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesWarehouse && matchesBranch
    })
  }, [branchFilter, branchMap, priorityFilter, records, search, statusFilter, warehouseFilter])

  const plannedCount = records.filter(record => (
    record.status === 'PLANNED'
    || record.status === 'PICKING'
    || record.status === 'READY'
  )).length
  const shippedCount = records.filter(record => record.status === 'SHIPPED').length
  const deliveredCount = records.filter(record => record.status === 'DELIVERED').length
  const itemCount = records.reduce((total, record) => total + record.items.length, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentRecord[]) => {
    setRecords(nextRecords)
    saveShipmentRecords(nextRecords)
  }, [])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, branches, inventoryLots))
    setEditingRecordId('')
    setFormError('')
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentRecord) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const updateFormItem = (
    itemId: string,
    patch: Partial<ShipmentFormItemState>
  ) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, ...patch } : item)
    }))
  }

  const addFormItem = () => {
    const selectedLotIds = new Set(form.items.map(item => item.inventoryLotId))
    const nextLot = availableLotsForForm.find(lot => !selectedLotIds.has(lot.id)) || availableLotsForForm[0] || null
    setForm(prev => ({
      ...prev,
      items: [...prev.items, createFormItem(nextLot)]
    }))
  }

  const removeFormItem = (itemId: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  const handleSourceWarehouseChange = (sourceWarehouseId: string) => {
    const nextLot = getAvailableLots(inventoryLots, sourceWarehouseId)[0] || null
    setForm(prev => ({
      ...prev,
      sourceWarehouseId,
      items: nextLot ? [createFormItem(nextLot)] : []
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const error = validateForm(form, lotMap)
    if(error){
      setFormError(error)
      return
    }

    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextRecord = createShipmentPayload(form, lotMap, currentUser, existingRecord)
    const nextRecords = existingRecord
      ? records.map(record => record.id === existingRecord.id ? nextRecord : record)
      : [nextRecord, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setPanelMode('detail')
    setEditingRecordId('')
    setFormError('')
  }

  const updateRecordStatus = (record: ShipmentRecord, status: ShipmentStatus) => {
    const nextRecord = {
      ...record,
      status,
      updatedAt: new Date().toISOString()
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
  }

  return (
    <div className="shipment-page">
      <div className="page-header">
        <div>
          <h2>Sevkiyatlar</h2>
          <p className="muted">Merkez depo, üretim, şube ve depo arası sevkiyat emirlerini lot bazında planlayın.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          Sevkiyat Emri Oluştur
        </button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Planlı Akış</span>
          <strong>{plannedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Sevk Edilen</span>
          <strong>{shippedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Teslim Edilen</span>
          <strong>{deliveredCount}</strong>
        </div>
        <div className="metric-card">
          <span>Shipment Item</span>
          <strong>{itemCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Sevkiyat Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-toolbar">
            <input
              type="search"
              placeholder="Shipment No veya hedef ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}>
              <option value="all">Tüm Öncelikler</option>
              {SHIPMENT_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{SHIPMENT_PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Warehouse</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Branch</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table">
              <thead>
                <tr>
                  <th>Shipment No</th>
                  <th>Source Warehouse</th>
                  <th>Destination</th>
                  <th>Shipment Date</th>
                  <th>Planned Delivery</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    aria-selected={selectedRecord?.id === record.id}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setPanelMode('detail')
                      setFormError('')
                    }}
                  >
                    <td data-label="Shipment No">
                      <strong>{record.shipmentNo}</strong>
                      <span className="muted">{record.items.length} kalem</span>
                    </td>
                    <td data-label="Source Warehouse">{getBranchLabel(record.sourceWarehouseId, branchMap)}</td>
                    <td data-label="Destination">{getDestinationLabel(record, branchMap)}</td>
                    <td data-label="Shipment Date">{formatDate(record.shipmentDate)}</td>
                    <td data-label="Planned Delivery">{formatDate(record.plannedDeliveryDate)}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_STATUS_LABELS[record.status]}</span>
                    </td>
                    <td data-label="Priority">
                      <span className={`status-pill ${getPriorityClass(record.priority)}`}>{SHIPMENT_PRIORITY_LABELS[record.priority]}</span>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun sevkiyat bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side shipment-side">
          {panelMode === 'form' ? (
            <form className="panel-form shipment-form" onSubmit={handleSubmit}>
              <section className="card shipment-detail-card">
                <div className="section-header">
                  <div>
                    <h3>{editingRecordId ? 'Sevkiyat Düzenle' : 'Yeni Sevkiyat'}</h3>
                    <p className="muted">Lot bazlı sevkiyat planını oluşturun.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Shipment No</span>
                      <input value={form.shipmentNo} disabled />
                    </label>
                    <label>
                      <span>Shipment Date</span>
                      <input
                        type="date"
                        value={form.shipmentDate}
                        onChange={event => setForm(prev => ({ ...prev, shipmentDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Planned Delivery</span>
                      <input
                        type="date"
                        value={form.plannedDeliveryDate}
                        onChange={event => setForm(prev => ({ ...prev, plannedDeliveryDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Source Warehouse</span>
                      <select
                        value={form.sourceWarehouseId}
                        onChange={event => handleSourceWarehouseChange(event.target.value)}
                      >
                        <option value="">Seçiniz</option>
                        {visibleSourceWarehouses.map(branch => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Destination Branch</span>
                      <select
                        value={form.destinationBranchId}
                        onChange={event => setForm(prev => ({ ...prev, destinationBranchId: event.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {branches.map(branch => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Destination Warehouse</span>
                      <select
                        value={form.destinationWarehouseId}
                        onChange={event => setForm(prev => ({ ...prev, destinationWarehouseId: event.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {branches.map(branch => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentStatus }))}
                      >
                        {SHIPMENT_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={form.priority}
                        onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as ShipmentPriority }))}
                      >
                        {SHIPMENT_PRIORITIES.map(priority => (
                          <option key={priority} value={priority}>{SHIPMENT_PRIORITY_LABELS[priority]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="shipment-form-wide">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>
                  </div>
                </div>

                <div className="shipment-form-section">
                  <div className="shipment-item-section-header">
                    <h4>Shipment Items</h4>
                    <button className="ghost-button" type="button" onClick={addFormItem}>
                      Kalem Ekle
                    </button>
                  </div>
                  <div className="shipment-item-editor-list">
                    {form.items.map((item, index) => {
                      const selectedLot = lotMap.get(item.inventoryLotId)

                      return (
                        <div className="shipment-item-editor" key={item.id}>
                          <label>
                            <span>Inventory Lot</span>
                            <select
                              value={item.inventoryLotId}
                              onChange={event => {
                                const lot = lotMap.get(event.target.value)
                                updateFormItem(item.id, {
                                  inventoryLotId: event.target.value,
                                  quantity: lot ? String(Math.min(lot.remainingQuantity, Number(item.quantity) || 1)) : item.quantity
                                })
                              }}
                            >
                              <option value="">Lot seçiniz</option>
                              {availableLotsForForm.map(lot => (
                                <option key={lot.id} value={lot.id}>
                                  {lot.lotNo} · {getStockItemLabel(lot.stockItemId, stockItemMap)} · {formatQuantity(lot.remainingQuantity, lot.unit)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Quantity</span>
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.quantity}
                              onChange={event => updateFormItem(item.id, { quantity: event.target.value })}
                            />
                          </label>
                          <label className="shipment-item-notes">
                            <span>Notes</span>
                            <input
                              value={item.notes}
                              onChange={event => updateFormItem(item.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. kalem</span>
                            <strong>{selectedLot ? `${getStockItemLabel(selectedLot.stockItemId, stockItemMap)} · ${formatQuantity(selectedLot.remainingQuantity, selectedLot.unit)}` : 'Lot seçilmedi'}</strong>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => removeFormItem(item.id)}
                            disabled={form.items.length <= 1}
                          >
                            Kaldır
                          </button>
                        </div>
                      )
                    })}
                    {form.items.length === 0 && (
                      <p className="muted shipment-empty-state">Seçili kaynak depoda sevk edilebilir lot bulunmuyor.</p>
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {editingRecordId ? 'Kaydet' : 'Oluştur'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setPanelMode('detail')
                      setEditingRecordId('')
                      setFormError('')
                    }}
                  >
                    Vazgeç
                  </button>
                </div>
              </section>
            </form>
          ) : selectedRecord ? (
            <>
              <section className="card shipment-detail-card">
                <div className="section-header">
                  <div>
                    <h3>{selectedRecord.shipmentNo}</h3>
                    <p className="muted">{getDestinationLabel(selectedRecord, branchMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-side-actions">
                  <button className="primary-button" type="button" onClick={() => openEditForm(selectedRecord)}>
                    Düzenle
                  </button>
                  <label>
                    <span>Durum</span>
                    <select
                      value={selectedRecord.status}
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentStatus)}
                    >
                      {SHIPMENT_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Detay</h3>
                </div>
                <div className="shipment-detail-grid">
                  <div>
                    <span>Shipment Date</span>
                    <strong>{formatDate(selectedRecord.shipmentDate)}</strong>
                  </div>
                  <div>
                    <span>Planned Delivery</span>
                    <strong>{formatDate(selectedRecord.plannedDeliveryDate)}</strong>
                  </div>
                  <div>
                    <span>Source Warehouse</span>
                    <strong>{getBranchLabel(selectedRecord.sourceWarehouseId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Destination Branch</span>
                    <strong>{selectedRecord.destinationBranchId ? getBranchLabel(selectedRecord.destinationBranchId, branchMap) : '-'}</strong>
                  </div>
                  <div>
                    <span>Destination Warehouse</span>
                    <strong>{selectedRecord.destinationWarehouseId ? getBranchLabel(selectedRecord.destinationWarehouseId, branchMap) : '-'}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong>{SHIPMENT_PRIORITY_LABELS[selectedRecord.priority]}</strong>
                  </div>
                  <div>
                    <span>Created By</span>
                    <strong>{selectedRecord.createdBy}</strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>{formatDate(selectedRecord.updatedAt)}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Product List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kalem</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.items.map(item => {
                    const lot = lotMap.get(item.inventoryLotId)

                    return (
                      <div className="shipment-product-row" key={item.id}>
                        <div>
                          <strong>{getLotLabel(item.inventoryLotId, lotMap, stockItemMap)}</strong>
                          <span>{getStockItemLabel(item.stockItemId, stockItemMap)}</span>
                        </div>
                        <div>
                          <span>{lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}</span>
                          <strong>{formatQuantity(item.quantity, item.unit)}</strong>
                        </div>
                        <p>{item.notes || '-'}</p>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Notes</h3>
                </div>
                <p className="shipment-notes">{selectedRecord.notes || '-'}</p>
              </section>
            </>
          ) : (
            <section className="card shipment-detail-card">
              <p className="muted">Henüz sevkiyat kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
