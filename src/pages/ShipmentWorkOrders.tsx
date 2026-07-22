import React from 'react'
import {
  SHIPMENT_WORK_ORDER_PRIORITIES,
  SHIPMENT_WORK_ORDER_PRIORITY_LABELS,
  SHIPMENT_WORK_ORDER_STATUSES,
  SHIPMENT_WORK_ORDER_STATUS_LABELS,
  getNextShipmentWorkOrderNo,
  loadShipmentWorkOrderRecords,
  saveShipmentWorkOrderRecords
} from '../shipment-work-orders/shipment-work-order.mock'
import {
  approveShipmentWorkOrder,
  canEditShipmentWorkOrder,
  cancelShipmentWorkOrder,
  completeShipmentWorkOrder,
  markShipmentWorkOrderReadyForPicking,
  startShipmentWorkOrderPicking,
  submitShipmentWorkOrderForApproval,
  validateShipmentWorkOrder
} from '../shipment-work-orders/shipment-work-order.service'
import type {
  ShipmentWorkOrderItem,
  ShipmentWorkOrderPriority,
  ShipmentWorkOrderRecord,
  ShipmentWorkOrderStatus
} from '../shipment-work-orders/shipment-work-order.types'
import {
  INVENTORY_LOT_STATUS_LABELS,
  loadInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import {
  SHIPMENT_PRIORITY_LABELS,
  SHIPMENT_STATUS_LABELS,
  loadShipmentRecords
} from '../shipments/shipment.mock'
import type { ShipmentRecord } from '../shipments/shipment.types'
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
type StatusFilter = ShipmentWorkOrderStatus | FilterValue
type PriorityFilter = ShipmentWorkOrderPriority | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentWorkOrderInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  workOrders: ShipmentWorkOrderRecord[]
}

type WorkOrderFormItemState = {
  id: string
  inventoryLotId: string
  requestedQuantity: string
  approvedQuantity: string
  pickedQuantity: string
  notes: string
}

type WorkOrderFormState = {
  workOrderNo: string
  title: string
  description: string
  requestDate: string
  plannedShipmentDate: string
  priority: ShipmentWorkOrderPriority
  sourceWarehouseId: string
  destinationBranchId: string
  shipmentIds: string[]
  notes: string
  items: WorkOrderFormItemState[]
}

type Message = {
  type: 'success' | 'error'
  text: string
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

const getStatusClass = (status: ShipmentWorkOrderStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'APPROVED' || status === 'READY_FOR_PICKING') return 'info-pill'
  if(status === 'WAITING_APPROVAL' || status === 'IN_PROGRESS') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getPriorityClass = (priority: ShipmentWorkOrderPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'info-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentWorkOrderInitialData => {
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
  const workOrders = loadShipmentWorkOrderRecords(inventoryLots, branches, shipments)

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    workOrders
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

const getAvailableLots = (inventoryLots: InventoryLot[], sourceWarehouseId = '') => (
  inventoryLots.filter(lot => (
    lot.remainingQuantity > 0
    && lot.status === 'ACTIVE'
    && (!sourceWarehouseId || lot.warehouseId === sourceWarehouseId)
  ))
)

const getShipmentLabel = (
  shipmentId: string,
  shipmentMap: Map<string, ShipmentRecord>
) => {
  const shipment = shipmentMap.get(shipmentId)
  return shipment ? shipment.shipmentNo : 'Shipment bulunamadı'
}

const createFormItem = (lot: InventoryLot | null): WorkOrderFormItemState => {
  const quantity = lot ? Math.min(lot.remainingQuantity, 1) : 0

  return {
    id: createId('shipment_work_order_form_item'),
    inventoryLotId: lot?.id || '',
    requestedQuantity: lot ? String(quantity) : '',
    approvedQuantity: lot ? String(quantity) : '',
    pickedQuantity: '0',
    notes: ''
  }
}

const createEmptyForm = (
  records: ShipmentWorkOrderRecord[],
  branches: Branch[],
  inventoryLots: InventoryLot[]
): WorkOrderFormState => {
  const firstLot = getAvailableLots(inventoryLots)[0] || inventoryLots.find(lot => lot.remainingQuantity > 0) || null
  const sourceWarehouseId = firstLot?.warehouseId || branches[0]?.id || ''
  const destinationBranch = branches.find(branch => branch.id !== sourceWarehouseId) || branches[0] || null

  return {
    workOrderNo: getNextShipmentWorkOrderNo(records),
    title: 'Şube sevkiyat talebi',
    description: '',
    requestDate: getTodayKey(),
    plannedShipmentDate: addDays(getTodayKey(), 1),
    priority: 'NORMAL',
    sourceWarehouseId,
    destinationBranchId: destinationBranch?.id || '',
    shipmentIds: [],
    notes: '',
    items: firstLot ? [createFormItem(firstLot)] : []
  }
}

const createFormFromRecord = (record: ShipmentWorkOrderRecord): WorkOrderFormState => ({
  workOrderNo: record.workOrderNo,
  title: record.title,
  description: record.description,
  requestDate: record.requestDate,
  plannedShipmentDate: record.plannedShipmentDate,
  priority: record.priority,
  sourceWarehouseId: record.sourceWarehouseId,
  destinationBranchId: record.destinationBranchId,
  shipmentIds: record.shipmentIds,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    inventoryLotId: item.inventoryLotId,
    requestedQuantity: String(item.requestedQuantity),
    approvedQuantity: String(item.approvedQuantity),
    pickedQuantity: String(item.pickedQuantity),
    notes: item.notes
  }))
})

const validateForm = (
  form: WorkOrderFormState,
  lotMap: Map<string, InventoryLot>,
  shipmentMap: Map<string, ShipmentRecord>
) => {
  if(!form.sourceWarehouseId) return 'Source Warehouse zorunludur.'
  if(!form.destinationBranchId) return 'Destination Branch zorunludur.'
  if(form.items.length === 0) return 'En az bir Work Order Item bulunmalıdır.'

  for(const [index, item] of form.items.entries()){
    const lot = lotMap.get(item.inventoryLotId)
    const requestedQuantity = Number(item.requestedQuantity)
    const approvedQuantity = Number(item.approvedQuantity)
    const pickedQuantity = Number(item.pickedQuantity)

    if(!lot) return `${index + 1}. satır için Inventory Lot zorunludur.`
    if(lot.warehouseId !== form.sourceWarehouseId){
      return `${index + 1}. satırdaki lot, Source Warehouse ile aynı depoda olmalıdır.`
    }
    if(!Number.isFinite(requestedQuantity) || requestedQuantity <= 0){
      return `${index + 1}. satır Requested Quantity 0'dan büyük olmalıdır.`
    }
    if(!Number.isFinite(approvedQuantity) || approvedQuantity < 0){
      return `${index + 1}. satır Approved Quantity geçerli olmalıdır.`
    }
    if(approvedQuantity > requestedQuantity){
      return `${index + 1}. satır Approved Quantity, Requested Quantity değerini geçemez.`
    }
    if(!Number.isFinite(pickedQuantity) || pickedQuantity < 0){
      return `${index + 1}. satır Picked Quantity geçerli olmalıdır.`
    }
    if(pickedQuantity > approvedQuantity){
      return `${index + 1}. satır Picked Quantity, Approved Quantity değerini geçemez.`
    }
  }

  for(const shipmentId of form.shipmentIds){
    const shipment = shipmentMap.get(shipmentId)
    if(!shipment) return 'Bağlı Shipment kaydı bulunamadı.'
    if(shipment.sourceWarehouseId !== form.sourceWarehouseId || shipment.destinationBranchId !== form.destinationBranchId){
      return 'Bağlı Shipment, Work Order warehouse ve destination branch bilgileriyle uyumlu olmalıdır.'
    }
  }

  return ''
}

const createWorkOrderPayload = (
  form: WorkOrderFormState,
  lotMap: Map<string, InventoryLot>,
  currentUser: User,
  existingRecord?: ShipmentWorkOrderRecord
): ShipmentWorkOrderRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_work_order')

  return {
    id,
    workOrderNo: form.workOrderNo,
    title: form.title.trim(),
    description: form.description.trim(),
    requestDate: form.requestDate,
    plannedShipmentDate: form.plannedShipmentDate,
    priority: form.priority,
    status: existingRecord?.status || 'DRAFT',
    sourceWarehouseId: form.sourceWarehouseId,
    destinationBranchId: form.destinationBranchId,
    shipmentIds: form.shipmentIds,
    createdBy: existingRecord?.createdBy || getUserName(currentUser),
    approvedBy: existingRecord?.approvedBy || '',
    approvedAt: existingRecord?.approvedAt || '',
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    items: form.items.map((item): ShipmentWorkOrderItem => {
      const lot = lotMap.get(item.inventoryLotId)

      return {
        id: item.id || createId('shipment_work_order_item'),
        workOrderId: id,
        stockItemId: lot?.stockItemId || '',
        inventoryLotId: item.inventoryLotId,
        requestedQuantity: Number(item.requestedQuantity),
        approvedQuantity: Number(item.approvedQuantity),
        pickedQuantity: Number(item.pickedQuantity),
        unit: lot?.unit || 'adet',
        notes: item.notes.trim()
      }
    })
  }
}

export default function ShipmentWorkOrders({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentWorkOrderRecord[]>(initialData.workOrders)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<WorkOrderFormState>(() => createEmptyForm(
    initialData.workOrders,
    initialData.branches,
    initialData.inventoryLots
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [linkShipmentId, setLinkShipmentId] = React.useState('')

  const { branches, inventoryLots, shipments, stockItems } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const shipmentMap = React.useMemo(() => new Map(shipments.map(shipment => [shipment.id, shipment])), [shipments])
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

  const compatibleShipmentsForForm = React.useMemo(() => (
    shipments.filter(shipment => (
      shipment.sourceWarehouseId === form.sourceWarehouseId
      && shipment.destinationBranchId === form.destinationBranchId
    ))
  ), [form.destinationBranchId, form.sourceWarehouseId, shipments])

  const availableShipmentLinksForForm = React.useMemo(() => (
    compatibleShipmentsForForm.filter(shipment => !form.shipmentIds.includes(shipment.id))
  ), [compatibleShipmentsForForm, form.shipmentIds])

  React.useEffect(() => {
    if(linkShipmentId && availableShipmentLinksForForm.some(shipment => shipment.id === linkShipmentId)) return
    setLinkShipmentId(availableShipmentLinksForForm[0]?.id || '')
  }, [availableShipmentLinksForForm, linkShipmentId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const destinationLabel = getBranchLabel(record.destinationBranchId, branchMap, '')
      const searchFields = [
        record.workOrderNo,
        record.title,
        destinationLabel
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.sourceWarehouseId === warehouseFilter
      const matchesBranch = branchFilter === 'all' || record.destinationBranchId === branchFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesWarehouse && matchesBranch
    })
  }, [branchFilter, branchMap, priorityFilter, records, search, statusFilter, warehouseFilter])

  const waitingCount = records.filter(record => record.status === 'DRAFT' || record.status === 'WAITING_APPROVAL').length
  const approvedCount = records.filter(record => record.status === 'APPROVED' || record.status === 'READY_FOR_PICKING').length
  const inProgressCount = records.filter(record => record.status === 'IN_PROGRESS').length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length

  const commitRecords = React.useCallback((nextRecords: ShipmentWorkOrderRecord[]) => {
    setRecords(nextRecords)
    saveShipmentWorkOrderRecords(nextRecords)
  }, [])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, branches, inventoryLots))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentWorkOrderRecord) => {
    if(!canEditShipmentWorkOrder(record)){
      setMessage({ type: 'error', text: 'COMPLETED olan Work Order düzenlenemez.' })
      return
    }

    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const updateFormItem = (
    itemId: string,
    patch: Partial<WorkOrderFormItemState>
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
      shipmentIds: [],
      items: nextLot ? [createFormItem(nextLot)] : []
    }))
  }

  const handleDestinationBranchChange = (destinationBranchId: string) => {
    setForm(prev => ({
      ...prev,
      destinationBranchId,
      shipmentIds: prev.shipmentIds.filter(shipmentId => {
        const shipment = shipmentMap.get(shipmentId)
        return shipment?.sourceWarehouseId === prev.sourceWarehouseId && shipment.destinationBranchId === destinationBranchId
      })
    }))
  }

  const addShipmentLink = () => {
    if(!linkShipmentId) return
    setForm(prev => ({
      ...prev,
      shipmentIds: prev.shipmentIds.includes(linkShipmentId)
        ? prev.shipmentIds
        : [...prev.shipmentIds, linkShipmentId]
    }))
  }

  const removeShipmentLink = (shipmentId: string) => {
    setForm(prev => ({
      ...prev,
      shipmentIds: prev.shipmentIds.filter(item => item !== shipmentId)
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const formValidationError = validateForm(form, lotMap, shipmentMap)
    if(formValidationError){
      setFormError(formValidationError)
      return
    }

    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined

    if(existingRecord && !canEditShipmentWorkOrder(existingRecord)){
      setFormError('COMPLETED olan Work Order düzenlenemez.')
      return
    }

    const nextRecord = createWorkOrderPayload(form, lotMap, currentUser, existingRecord)
    const recordValidationError = validateShipmentWorkOrder(nextRecord)
    if(recordValidationError){
      setFormError(recordValidationError)
      return
    }

    const nextRecords = existingRecord
      ? records.map(record => record.id === existingRecord.id ? nextRecord : record)
      : [nextRecord, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setPanelMode('detail')
    setEditingRecordId('')
    setFormError('')
    setMessage({ type: 'success', text: `${nextRecord.workOrderNo} kaydedildi.` })
  }

  const commitRecordUpdate = (
    nextRecord: ShipmentWorkOrderRecord,
    successMessage: string
  ) => {
    commitRecords(records.map(record => record.id === nextRecord.id ? nextRecord : record))
    setSelectedRecordId(nextRecord.id)
    setMessage({ type: 'success', text: successMessage })
  }

  const runRecordAction = (
    action: (record: ShipmentWorkOrderRecord) => ShipmentWorkOrderRecord,
    successMessage: (record: ShipmentWorkOrderRecord) => string
  ) => {
    if(!selectedRecord){
      setMessage({ type: 'error', text: 'Work Order seçilmelidir.' })
      return
    }

    try{
      const nextRecord = action(selectedRecord)
      commitRecordUpdate(nextRecord, successMessage(nextRecord))
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })
    }
  }

  return (
    <div className="shipment-page shipment-work-order-page">
      <div className="page-header">
        <div>
          <h2>İş Emirleri</h2>
          <p className="muted">Şube taleplerini lot bazlı lojistik iş emrine dönüştürün ve picking başlangıcını yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          İş Emri Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Onay Öncesi</span>
          <strong>{waitingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylı / Hazır</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Picking Akışı</span>
          <strong>{inProgressCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Work Order Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-toolbar">
            <input
              type="search"
              placeholder="Work Order No, title veya destination ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_WORK_ORDER_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_WORK_ORDER_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}>
              <option value="all">Tüm Öncelikler</option>
              {SHIPMENT_WORK_ORDER_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{SHIPMENT_WORK_ORDER_PRIORITY_LABELS[priority]}</option>
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
                  <th>Work Order No</th>
                  <th>Title</th>
                  <th>Warehouse</th>
                  <th>Destination</th>
                  <th>Planned Shipment</th>
                  <th>Priority</th>
                  <th>Status</th>
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
                      setMessage(null)
                    }}
                  >
                    <td data-label="Work Order No">
                      <strong>{record.workOrderNo}</strong>
                      <span className="muted">{record.items.length} kalem</span>
                    </td>
                    <td data-label="Title">{record.title}</td>
                    <td data-label="Warehouse">{getBranchLabel(record.sourceWarehouseId, branchMap)}</td>
                    <td data-label="Destination">{getBranchLabel(record.destinationBranchId, branchMap)}</td>
                    <td data-label="Planned Shipment">{formatDate(record.plannedShipmentDate)}</td>
                    <td data-label="Priority">
                      <span className={`status-pill ${getPriorityClass(record.priority)}`}>{SHIPMENT_WORK_ORDER_PRIORITY_LABELS[record.priority]}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_WORK_ORDER_STATUS_LABELS[record.status]}</span>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun Work Order bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'İş Emri Düzenle' : 'Yeni İş Emri'}</h3>
                    <p className="muted">Şube talebini lot ve miktar kırılımıyla hazırlayın.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Work Order No</span>
                      <input value={form.workOrderNo} disabled />
                    </label>
                    <label>
                      <span>Title</span>
                      <input
                        value={form.title}
                        onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Request Date</span>
                      <input
                        type="date"
                        value={form.requestDate}
                        onChange={event => setForm(prev => ({ ...prev, requestDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Planned Shipment Date</span>
                      <input
                        type="date"
                        value={form.plannedShipmentDate}
                        onChange={event => setForm(prev => ({ ...prev, plannedShipmentDate: event.target.value }))}
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
                        onChange={event => handleDestinationBranchChange(event.target.value)}
                      >
                        <option value="">Seçiniz</option>
                        {branches.map(branch => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        value={form.priority}
                        onChange={event => setForm(prev => ({ ...prev, priority: event.target.value as ShipmentWorkOrderPriority }))}
                      >
                        {SHIPMENT_WORK_ORDER_PRIORITIES.map(priority => (
                          <option key={priority} value={priority}>{SHIPMENT_WORK_ORDER_PRIORITY_LABELS[priority]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="shipment-form-wide">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                      />
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
                    <h4>Work Order Items</h4>
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
                                const quantity = lot ? Math.min(lot.remainingQuantity, Number(item.requestedQuantity) || 1) : 0
                                updateFormItem(item.id, {
                                  inventoryLotId: event.target.value,
                                  requestedQuantity: lot ? String(quantity) : item.requestedQuantity,
                                  approvedQuantity: lot ? String(Math.min(quantity, Number(item.approvedQuantity) || quantity)) : item.approvedQuantity
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
                            <span>Requested Qty</span>
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={item.requestedQuantity}
                              onChange={event => updateFormItem(item.id, { requestedQuantity: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Approved Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.approvedQuantity}
                              onChange={event => updateFormItem(item.id, { approvedQuantity: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Picked Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.pickedQuantity}
                              onChange={event => updateFormItem(item.id, { pickedQuantity: event.target.value })}
                            />
                          </label>
                          <label className="shipment-form-wide">
                            <span>Item Notes</span>
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
                      <p className="muted shipment-empty-state">Seçili kaynak depoda iş emrine alınabilecek lot bulunmuyor.</p>
                    )}
                  </div>
                </div>

                <div className="shipment-form-section">
                  <div className="shipment-item-section-header">
                    <h4>İlişkili Shipments</h4>
                    <span className="status-pill muted-pill">{form.shipmentIds.length} bağlı</span>
                  </div>
                  <div className="shipment-work-order-link-toolbar">
                    <select value={linkShipmentId} onChange={event => setLinkShipmentId(event.target.value)}>
                      {availableShipmentLinksForForm.length === 0 && <option value="">Uygun Shipment yok</option>}
                      {availableShipmentLinksForForm.map(shipment => (
                        <option key={shipment.id} value={shipment.id}>
                          {shipment.shipmentNo} · {SHIPMENT_STATUS_LABELS[shipment.status]} · {SHIPMENT_PRIORITY_LABELS[shipment.priority]}
                        </option>
                      ))}
                    </select>
                    <button className="ghost-button" type="button" onClick={addShipmentLink} disabled={!linkShipmentId}>
                      Bağla
                    </button>
                  </div>
                  <div className="shipment-product-list">
                    {form.shipmentIds.map(shipmentId => {
                      const shipment = shipmentMap.get(shipmentId)

                      return (
                        <div className="shipment-product-row" key={shipmentId}>
                          <div>
                            <strong>{getShipmentLabel(shipmentId, shipmentMap)}</strong>
                            <span>{shipment ? `${formatDate(shipment.shipmentDate)} · ${shipment.items.length} kalem` : '-'}</span>
                          </div>
                          <div>
                            <span>{shipment ? SHIPMENT_STATUS_LABELS[shipment.status] : '-'}</span>
                            <strong>{shipment ? SHIPMENT_PRIORITY_LABELS[shipment.priority] : '-'}</strong>
                          </div>
                          <button className="ghost-button" type="button" onClick={() => removeShipmentLink(shipmentId)}>
                            Kaldır
                          </button>
                        </div>
                      )
                    })}
                    {form.shipmentIds.length === 0 && (
                      <p className="muted shipment-empty-state">Bu Work Order için henüz Shipment bağlantısı yok.</p>
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
                    <h3>{selectedRecord.workOrderNo}</h3>
                    <p className="muted">{selectedRecord.title}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_WORK_ORDER_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-side-actions shipment-work-order-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => openEditForm(selectedRecord)}
                    disabled={!canEditShipmentWorkOrder(selectedRecord)}
                  >
                    Düzenle
                  </button>
                  {selectedRecord.status === 'DRAFT' && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => runRecordAction(submitShipmentWorkOrderForApproval, record => `${record.workOrderNo} onaya gönderildi.`)}
                    >
                      Onaya Gönder
                    </button>
                  )}
                  {(selectedRecord.status === 'DRAFT' || selectedRecord.status === 'WAITING_APPROVAL') && (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => runRecordAction(record => approveShipmentWorkOrder(record, currentUser), record => `${record.workOrderNo} onaylandı.`)}
                    >
                      Onayla
                    </button>
                  )}
                  {selectedRecord.status === 'APPROVED' && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => runRecordAction(markShipmentWorkOrderReadyForPicking, record => `${record.workOrderNo} toplama için hazırlandı.`)}
                    >
                      Toplamaya Hazırla
                    </button>
                  )}
                  {(selectedRecord.status === 'APPROVED' || selectedRecord.status === 'READY_FOR_PICKING') && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => runRecordAction(startShipmentWorkOrderPicking, record => `${record.workOrderNo} için picking başladı.`)}
                    >
                      Picking Başlat
                    </button>
                  )}
                  {(selectedRecord.status === 'IN_PROGRESS' || selectedRecord.status === 'READY_FOR_PICKING') && (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => runRecordAction(completeShipmentWorkOrder, record => `${record.workOrderNo} tamamlandı.`)}
                    >
                      Tamamla
                    </button>
                  )}
                  {selectedRecord.status !== 'COMPLETED' && selectedRecord.status !== 'CANCELLED' && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => runRecordAction(cancelShipmentWorkOrder, record => `${record.workOrderNo} iptal edildi.`)}
                    >
                      İptal
                    </button>
                  )}
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Detay</h3>
                </div>
                <div className="shipment-detail-grid">
                  <div>
                    <span>Title</span>
                    <strong>{selectedRecord.title}</strong>
                  </div>
                  <div>
                    <span>Priority</span>
                    <strong>{SHIPMENT_WORK_ORDER_PRIORITY_LABELS[selectedRecord.priority]}</strong>
                  </div>
                  <div>
                    <span>Request Date</span>
                    <strong>{formatDate(selectedRecord.requestDate)}</strong>
                  </div>
                  <div>
                    <span>Planned Shipment Date</span>
                    <strong>{formatDate(selectedRecord.plannedShipmentDate)}</strong>
                  </div>
                  <div>
                    <span>Warehouse</span>
                    <strong>{getBranchLabel(selectedRecord.sourceWarehouseId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Destination</span>
                    <strong>{getBranchLabel(selectedRecord.destinationBranchId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Created By</span>
                    <strong>{selectedRecord.createdBy}</strong>
                  </div>
                  <div>
                    <span>Approved By</span>
                    <strong>{selectedRecord.approvedBy || '-'}</strong>
                  </div>
                  <div>
                    <span>Approved At</span>
                    <strong>{formatDate(selectedRecord.approvedAt)}</strong>
                  </div>
                  <div>
                    <span>Linked Shipments</span>
                    <strong>{selectedRecord.shipmentIds.length}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Description</h3>
                </div>
                <p className="shipment-notes">{selectedRecord.description || '-'}</p>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Item List</h3>
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
                          <strong>{formatQuantity(item.approvedQuantity, item.unit)}</strong>
                        </div>
                        <p>
                          Requested: {formatQuantity(item.requestedQuantity, item.unit)}
                          {' · '}
                          Picked: {formatQuantity(item.pickedQuantity, item.unit)}
                          {' · '}
                          {item.notes || '-'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>İlişkili Shipments</h3>
                  <span className="status-pill muted-pill">{selectedRecord.shipmentIds.length} kayıt</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.shipmentIds.map(shipmentId => {
                    const shipment = shipmentMap.get(shipmentId)

                    return (
                      <div className="shipment-product-row" key={shipmentId}>
                        <div>
                          <strong>{getShipmentLabel(shipmentId, shipmentMap)}</strong>
                          <span>{shipment ? `${formatDate(shipment.shipmentDate)} · ${shipment.items.length} kalem` : '-'}</span>
                        </div>
                        <div>
                          <span>{shipment ? SHIPMENT_STATUS_LABELS[shipment.status] : '-'}</span>
                          <strong>{shipment ? SHIPMENT_PRIORITY_LABELS[shipment.priority] : '-'}</strong>
                        </div>
                        <p>{shipment ? getBranchLabel(shipment.destinationBranchId, branchMap) : '-'}</p>
                      </div>
                    )
                  })}
                  {selectedRecord.shipmentIds.length === 0 && (
                    <p className="muted shipment-empty-state">Bu Work Order henüz Shipment ile ilişkilendirilmedi.</p>
                  )}
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
              <p className="muted">Henüz Work Order kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
