import React from 'react'
import {
  SHIPMENT_PALLET_STATUSES,
  SHIPMENT_PALLET_STATUS_LABELS,
  getNextShipmentPalletNo,
  loadShipmentPalletRecords,
  saveShipmentPalletRecords
} from '../shipment-pallets/shipment-pallet.mock'
import {
  calculateShipmentPalletGrossWeight,
  calculateShipmentPalletNetWeight,
  getWorkOrderItemPalletLimit,
  markShipmentPalletReady,
  resolveShipmentPalletWeights,
  validateShipmentPallet
} from '../shipment-pallets/shipment-pallet.service'
import type {
  ShipmentPalletItem,
  ShipmentPalletRecord,
  ShipmentPalletStatus
} from '../shipment-pallets/shipment-pallet.types'
import {
  SHIPMENT_WORK_ORDER_STATUS_LABELS,
  loadShipmentWorkOrderRecords
} from '../shipment-work-orders/shipment-work-order.mock'
import type {
  ShipmentWorkOrderItem,
  ShipmentWorkOrderRecord
} from '../shipment-work-orders/shipment-work-order.types'
import {
  INVENTORY_LOT_STATUS_LABELS,
  loadInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadShipmentRecords } from '../shipments/shipment.mock'
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
type StatusFilter = ShipmentPalletStatus | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentPalletInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  workOrders: ShipmentWorkOrderRecord[]
  pallets: ShipmentPalletRecord[]
}

type PalletFormItemState = {
  id: string
  workOrderItemId: string
  quantity: string
  notes: string
}

type PalletFormState = {
  palletNo: string
  workOrderId: string
  warehouseId: string
  status: ShipmentPalletStatus
  notes: string
  items: PalletFormItemState[]
}

type Message = {
  type: 'success' | 'error'
  text: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatWeight = (value: number) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} kg`
)

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: ShipmentPalletStatus) => {
  if(status === 'READY' || status === 'DELIVERED') return 'success'
  if(status === 'BUILDING' || status === 'LOADED') return 'warning-pill'
  if(status === 'SHIPPED') return 'info-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentPalletInitialData => {
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
  const pallets = loadShipmentPalletRecords(workOrders)

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    workOrders,
    pallets
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

const getWorkOrderLabel = (
  workOrderId: string,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
) => {
  const workOrder = workOrderMap.get(workOrderId)
  return workOrder ? workOrder.workOrderNo : 'Work Order bulunamadı'
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

const getPalletableWorkOrders = (
  workOrders: ShipmentWorkOrderRecord[]
) => workOrders.filter(workOrder => (
  !['DRAFT', 'WAITING_APPROVAL', 'CANCELLED'].includes(workOrder.status)
  && workOrder.items.some(item => getWorkOrderItemPalletLimit(item) > 0)
))

const getAllocatedQuantity = (
  workOrderItemId: string,
  pallets: ShipmentPalletRecord[],
  ignoredPalletId = ''
) => pallets.reduce((total, pallet) => {
  if(pallet.id === ignoredPalletId) return total
  return total + pallet.items
    .filter(item => item.workOrderItemId === workOrderItemId)
    .reduce((itemTotal, item) => itemTotal + item.quantity, 0)
}, 0)

const getRemainingQuantity = (
  item: ShipmentWorkOrderItem,
  pallets: ShipmentPalletRecord[],
  ignoredPalletId = ''
) => Math.max(0, getWorkOrderItemPalletLimit(item) - getAllocatedQuantity(item.id, pallets, ignoredPalletId))

const getAvailableWorkOrderItems = (
  workOrder: ShipmentWorkOrderRecord | null,
  pallets: ShipmentPalletRecord[],
  ignoredPalletId = ''
) => (
  (workOrder?.items || []).filter(item => getRemainingQuantity(item, pallets, ignoredPalletId) > 0)
)

const createFormItem = (
  workOrderItem: ShipmentWorkOrderItem | null,
  pallets: ShipmentPalletRecord[],
  ignoredPalletId = ''
): PalletFormItemState => {
  const remainingQuantity = workOrderItem
    ? getRemainingQuantity(workOrderItem, pallets, ignoredPalletId)
    : 0
  const quantity = workOrderItem ? Math.min(remainingQuantity || getWorkOrderItemPalletLimit(workOrderItem), 1) : 0

  return {
    id: createId('shipment_pallet_form_item'),
    workOrderItemId: workOrderItem?.id || '',
    quantity: workOrderItem ? String(quantity) : '',
    notes: ''
  }
}

const createEmptyForm = (
  records: ShipmentPalletRecord[],
  workOrders: ShipmentWorkOrderRecord[],
  pallets: ShipmentPalletRecord[]
): PalletFormState => {
  const firstWorkOrder = getPalletableWorkOrders(workOrders)[0] || workOrders[0] || null
  const firstItem = getAvailableWorkOrderItems(firstWorkOrder, pallets)[0] || firstWorkOrder?.items[0] || null

  return {
    palletNo: getNextShipmentPalletNo(records),
    workOrderId: firstWorkOrder?.id || '',
    warehouseId: firstWorkOrder?.sourceWarehouseId || '',
    status: 'BUILDING',
    notes: '',
    items: firstItem ? [createFormItem(firstItem, pallets)] : []
  }
}

const createFormFromRecord = (record: ShipmentPalletRecord): PalletFormState => ({
  palletNo: record.palletNo,
  workOrderId: record.workOrderId,
  warehouseId: record.warehouseId,
  status: record.status,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    workOrderItemId: item.workOrderItemId,
    quantity: String(item.quantity),
    notes: item.notes
  }))
})

const createPalletPayload = (
  form: PalletFormState,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>,
  currentUser: User,
  existingRecord?: ShipmentPalletRecord
): ShipmentPalletRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_pallet')
  const workOrder = workOrderMap.get(form.workOrderId) || null
  const itemMap = new Map((workOrder?.items || []).map(item => [item.id, item]))
  const items = form.items.map((item): ShipmentPalletItem => {
    const workOrderItem = itemMap.get(item.workOrderItemId)

    return {
      id: item.id || createId('shipment_pallet_item'),
      palletId: id,
      workOrderItemId: item.workOrderItemId,
      stockItemId: workOrderItem?.stockItemId || '',
      inventoryLotId: workOrderItem?.inventoryLotId || '',
      quantity: Number(item.quantity),
      unit: workOrderItem?.unit || 'adet',
      notes: item.notes.trim()
    }
  })

  return resolveShipmentPalletWeights({
    id,
    palletNo: form.palletNo,
    workOrderId: form.workOrderId,
    warehouseId: form.warehouseId,
    status: form.status,
    grossWeight: existingRecord?.grossWeight || 0,
    netWeight: existingRecord?.netWeight || 0,
    notes: form.notes.trim(),
    createdBy: existingRecord?.createdBy || getUserName(currentUser),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    items
  })
}

export default function ShipmentPallets({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentPalletRecord[]>(initialData.pallets)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<PalletFormState>(() => createEmptyForm(
    initialData.pallets,
    initialData.workOrders,
    initialData.pallets
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const { branches, inventoryLots, stockItems, workOrders } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const workOrderMap = React.useMemo(() => new Map(workOrders.map(workOrder => [workOrder.id, workOrder])), [workOrders])
  const palletableWorkOrders = React.useMemo(() => getPalletableWorkOrders(workOrders), [workOrders])
  const visibleWorkOrders = palletableWorkOrders.length > 0 ? palletableWorkOrders : workOrders

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const selectedFormWorkOrder = form.workOrderId ? workOrderMap.get(form.workOrderId) || null : null
  const editingIgnoredPalletId = editingRecordId || ''
  const availableWorkOrderItems = React.useMemo(() => (
    getAvailableWorkOrderItems(selectedFormWorkOrder, records, editingIgnoredPalletId)
  ), [editingIgnoredPalletId, records, selectedFormWorkOrder])
  const formItemsForWeight = React.useMemo(() => (
    form.items.map(item => {
      const workOrderItem = selectedFormWorkOrder?.items.find(record => record.id === item.workOrderItemId)
      return {
        quantity: Number(item.quantity) || 0,
        unit: workOrderItem?.unit || 'adet'
      }
    })
  ), [form.items, selectedFormWorkOrder])
  const formNetWeight = calculateShipmentPalletNetWeight(formItemsForWeight)
  const formGrossWeight = calculateShipmentPalletGrossWeight(formNetWeight, form.items.length > 0)

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const workOrder = workOrderMap.get(record.workOrderId)
      const searchFields = [
        record.palletNo,
        workOrder?.workOrderNo || '',
        workOrder?.title || ''
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesWarehouse && matchesStatus
    })
  }, [records, search, statusFilter, warehouseFilter, workOrderMap])

  const buildingCount = records.filter(record => record.status === 'EMPTY' || record.status === 'BUILDING').length
  const readyCount = records.filter(record => record.status === 'READY').length
  const inTransitCount = records.filter(record => record.status === 'LOADED' || record.status === 'SHIPPED').length
  const totalNetWeight = records.reduce((total, record) => total + record.netWeight, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentPalletRecord[]) => {
    setRecords(nextRecords)
    saveShipmentPalletRecords(nextRecords)
  }, [])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, workOrders, records))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentPalletRecord) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const handleWorkOrderChange = (workOrderId: string) => {
    const workOrder = workOrderMap.get(workOrderId) || null
    const firstItem = getAvailableWorkOrderItems(workOrder, records, editingIgnoredPalletId)[0] || workOrder?.items[0] || null

    setForm(prev => ({
      ...prev,
      workOrderId,
      warehouseId: workOrder?.sourceWarehouseId || '',
      items: firstItem ? [createFormItem(firstItem, records, editingIgnoredPalletId)] : []
    }))
  }

  const updateFormItem = (
    itemId: string,
    patch: Partial<PalletFormItemState>
  ) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, ...patch } : item)
    }))
  }

  const addFormItem = () => {
    const selectedItemIds = new Set(form.items.map(item => item.workOrderItemId))
    const nextItem = availableWorkOrderItems.find(item => !selectedItemIds.has(item.id)) || availableWorkOrderItems[0] || null
    setForm(prev => ({
      ...prev,
      items: [...prev.items, createFormItem(nextItem, records, editingIgnoredPalletId)]
    }))
  }

  const removeFormItem = (itemId: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextRecord = createPalletPayload(form, workOrderMap, currentUser, existingRecord)
    const validationError = validateShipmentPallet(nextRecord, workOrders, records)

    if(validationError){
      setFormError(validationError)
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
    setMessage({ type: 'success', text: `${nextRecord.palletNo} kaydedildi.` })
  }

  const updateRecordStatus = (record: ShipmentPalletRecord, status: ShipmentPalletStatus) => {
    const nextRecord = resolveShipmentPalletWeights({
      ...record,
      status,
      updatedAt: new Date().toISOString()
    })
    const validationError = validateShipmentPallet(nextRecord, workOrders, records)

    if(validationError){
      setMessage({ type: 'error', text: validationError })
      return
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setMessage({ type: 'success', text: `${record.palletNo} durumu güncellendi.` })
  }

  const markReady = (record: ShipmentPalletRecord) => {
    try{
      const nextRecord = markShipmentPalletReady(record, workOrders, records)
      commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
      setSelectedRecordId(record.id)
      setMessage({ type: 'success', text: `${record.palletNo} READY durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Pallet READY yapılamadı.' })
    }
  }

  return (
    <div className="shipment-page shipment-pallet-page">
      <div className="page-header">
        <div>
          <h2>Paletleme</h2>
          <p className="muted">Shipment Work Order ürünlerini paletlere dağıtın ve palet ağırlıklarını takip edin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          Palet Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Hazırlanan</span>
          <strong>{buildingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ready</span>
          <strong>{readyCount}</strong>
        </div>
        <div className="metric-card">
          <span>Yükleme Akışı</span>
          <strong>{inTransitCount}</strong>
        </div>
        <div className="metric-card">
          <span>Net Ağırlık</span>
          <strong>{formatWeight(totalNetWeight)}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Pallet Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-pallet-toolbar">
            <input
              type="search"
              placeholder="Pallet No veya Work Order ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Warehouse</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_PALLET_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_PALLET_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table">
              <thead>
                <tr>
                  <th>Pallet No</th>
                  <th>Work Order</th>
                  <th>Warehouse</th>
                  <th>Item Count</th>
                  <th>Net Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(record => {
                  const workOrder = workOrderMap.get(record.workOrderId)

                  return (
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
                      <td data-label="Pallet No">
                        <strong>{record.palletNo}</strong>
                        <span className="muted">{record.items.length} kalem</span>
                      </td>
                      <td data-label="Work Order">
                        <strong>{workOrder?.workOrderNo || 'Work Order bulunamadı'}</strong>
                        <span className="muted">{workOrder?.title || '-'}</span>
                      </td>
                      <td data-label="Warehouse">{getBranchLabel(record.warehouseId, branchMap)}</td>
                      <td data-label="Item Count">{record.items.length}</td>
                      <td data-label="Net Weight">{formatWeight(record.netWeight)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_PALLET_STATUS_LABELS[record.status]}</span>
                      </td>
                    </tr>
                  )
                })}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>Filtrelere uygun Pallet bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'Palet Düzenle' : 'Yeni Palet'}</h3>
                    <p className="muted">Work Order item miktarlarını palete dağıtın.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Pallet No</span>
                      <input value={form.palletNo} disabled />
                    </label>
                    <label>
                      <span>Work Order</span>
                      <select value={form.workOrderId} onChange={event => handleWorkOrderChange(event.target.value)}>
                        <option value="">Seçiniz</option>
                        {visibleWorkOrders.map(workOrder => (
                          <option key={workOrder.id} value={workOrder.id}>
                            {workOrder.workOrderNo} · {workOrder.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Warehouse</span>
                      <select
                        value={form.warehouseId}
                        onChange={event => setForm(prev => ({ ...prev, warehouseId: event.target.value }))}
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
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentPalletStatus }))}
                      >
                        {SHIPMENT_PALLET_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_PALLET_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span>Net Weight</span>
                      <strong>{formatWeight(formNetWeight)}</strong>
                    </div>
                    <div>
                      <span>Gross Weight</span>
                      <strong>{formatWeight(formGrossWeight)}</strong>
                    </div>
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
                    <h4>Pallet Items</h4>
                    <button className="ghost-button" type="button" onClick={addFormItem}>
                      Kalem Ekle
                    </button>
                  </div>
                  <div className="shipment-item-editor-list">
                    {form.items.map((item, index) => {
                      const workOrderItem = selectedFormWorkOrder?.items.find(record => record.id === item.workOrderItemId)
                      const availableOptions = selectedFormWorkOrder?.items.filter(record => (
                        record.id === item.workOrderItemId
                        || getRemainingQuantity(record, records, editingIgnoredPalletId) > 0
                      )) || []
                      const remainingQuantity = workOrderItem
                        ? getRemainingQuantity(workOrderItem, records, editingIgnoredPalletId)
                        : 0
                      const lot = workOrderItem ? lotMap.get(workOrderItem.inventoryLotId) : null

                      return (
                        <div className="shipment-item-editor" key={item.id}>
                          <label>
                            <span>Work Order Item</span>
                            <select
                              value={item.workOrderItemId}
                              onChange={event => {
                                const nextItem = selectedFormWorkOrder?.items.find(record => record.id === event.target.value) || null
                                updateFormItem(item.id, {
                                  workOrderItemId: event.target.value,
                                  quantity: nextItem ? String(Math.min(getRemainingQuantity(nextItem, records, editingIgnoredPalletId), Number(item.quantity) || 1)) : item.quantity
                                })
                              }}
                            >
                              <option value="">Item seçiniz</option>
                              {availableOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                  {getStockItemLabel(option.stockItemId, stockItemMap)} · {formatQuantity(getWorkOrderItemPalletLimit(option), option.unit)}
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
                          <label className="shipment-form-wide">
                            <span>Item Notes</span>
                            <input
                              value={item.notes}
                              onChange={event => updateFormItem(item.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. kalem</span>
                            <strong>
                              {workOrderItem
                                ? `${getStockItemLabel(workOrderItem.stockItemId, stockItemMap)} · ${getLotLabel(workOrderItem.inventoryLotId, lotMap, stockItemMap)}`
                                : 'Work Order Item seçilmedi'}
                            </strong>
                            <span>
                              Kalan: {workOrderItem ? formatQuantity(remainingQuantity, workOrderItem.unit) : '-'}
                              {' · '}
                              Lot: {lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}
                            </span>
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
                      <p className="muted shipment-empty-state">Seçili Work Order için paletlenebilir item bulunmuyor.</p>
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
                    <h3>{selectedRecord.palletNo}</h3>
                    <p className="muted">{getWorkOrderLabel(selectedRecord.workOrderId, workOrderMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_PALLET_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-side-actions shipment-pallet-actions">
                  <button className="primary-button" type="button" onClick={() => openEditForm(selectedRecord)}>
                    Düzenle
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => markReady(selectedRecord)}
                    disabled={selectedRecord.status === 'READY'}
                  >
                    READY Yap
                  </button>
                  <label>
                    <span>Durum</span>
                    <select
                      value={selectedRecord.status}
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentPalletStatus)}
                    >
                      {SHIPMENT_PALLET_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_PALLET_STATUS_LABELS[status]}</option>
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
                    <span>Pallet No</span>
                    <strong>{selectedRecord.palletNo}</strong>
                  </div>
                  <div>
                    <span>Work Order</span>
                    <strong>{getWorkOrderLabel(selectedRecord.workOrderId, workOrderMap)}</strong>
                  </div>
                  <div>
                    <span>Warehouse</span>
                    <strong>{getBranchLabel(selectedRecord.warehouseId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{SHIPMENT_PALLET_STATUS_LABELS[selectedRecord.status]}</strong>
                  </div>
                  <div>
                    <span>Net Weight</span>
                    <strong>{formatWeight(selectedRecord.netWeight)}</strong>
                  </div>
                  <div>
                    <span>Gross Weight</span>
                    <strong>{formatWeight(selectedRecord.grossWeight)}</strong>
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
                  <h3>Work Order</h3>
                </div>
                {(() => {
                  const workOrder = workOrderMap.get(selectedRecord.workOrderId)
                  return (
                    <div className="shipment-detail-grid">
                      <div>
                        <span>Work Order No</span>
                        <strong>{workOrder?.workOrderNo || '-'}</strong>
                      </div>
                      <div>
                        <span>Work Order Status</span>
                        <strong>{workOrder ? SHIPMENT_WORK_ORDER_STATUS_LABELS[workOrder.status] : '-'}</strong>
                      </div>
                      <div>
                        <span>Destination</span>
                        <strong>{workOrder ? getBranchLabel(workOrder.destinationBranchId, branchMap) : '-'}</strong>
                      </div>
                      <div>
                        <span>Planned Shipment</span>
                        <strong>{formatDate(workOrder?.plannedShipmentDate || '')}</strong>
                      </div>
                    </div>
                  )
                })()}
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Item List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kalem</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.items.map(item => {
                    const workOrder = workOrderMap.get(selectedRecord.workOrderId)
                    const workOrderItem = workOrder?.items.find(record => record.id === item.workOrderItemId)
                    const lot = lotMap.get(item.inventoryLotId)

                    return (
                      <div className="shipment-product-row" key={item.id}>
                        <div>
                          <strong>{getStockItemLabel(item.stockItemId, stockItemMap)}</strong>
                          <span>{getLotLabel(item.inventoryLotId, lotMap, stockItemMap)}</span>
                        </div>
                        <div>
                          <span>{lot ? INVENTORY_LOT_STATUS_LABELS[lot.status] : '-'}</span>
                          <strong>{formatQuantity(item.quantity, item.unit)}</strong>
                        </div>
                        <p>
                          Work Order Item: {workOrderItem ? formatQuantity(getWorkOrderItemPalletLimit(workOrderItem), workOrderItem.unit) : '-'}
                          {' · '}
                          Weight: {formatWeight(calculateShipmentPalletNetWeight([item]))}
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
                  <h3>Notes</h3>
                </div>
                <p className="shipment-notes">{selectedRecord.notes || '-'}</p>
              </section>
            </>
          ) : (
            <section className="card shipment-detail-card">
              <p className="muted">Henüz Pallet kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
