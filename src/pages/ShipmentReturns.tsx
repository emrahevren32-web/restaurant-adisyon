import React from 'react'
import {
  SHIPMENT_RETURN_CONDITIONS,
  SHIPMENT_RETURN_CONDITION_LABELS,
  SHIPMENT_RETURN_STATUSES,
  SHIPMENT_RETURN_STATUS_LABELS,
  SHIPMENT_RETURN_TYPES,
  SHIPMENT_RETURN_TYPE_LABELS,
  getNextShipmentReturnNo,
  getShipmentReturnTotalQuantity,
  loadShipmentReturnRecords,
  saveShipmentReturnRecords
} from '../shipment-returns/shipment-return.mock'
import {
  createShipmentReturnDeliverySources,
  getShipmentReturnDeliveredQuantity,
  getShipmentReturnLineKey,
  getShipmentReturnPriorQuantity,
  validateShipmentReturn,
  type ShipmentReturnDeliveryLineSource,
  type ShipmentReturnDeliverySource,
  type ShipmentReturnDeliveryStopSource
} from '../shipment-returns/shipment-return.service'
import type {
  ShipmentReturnCondition,
  ShipmentReturnItem,
  ShipmentReturnRecord,
  ShipmentReturnStatus,
  ShipmentReturnType
} from '../shipment-returns/shipment-return.types'
import { loadShipmentPlanRecords } from '../shipment-plans/shipment-plan.mock'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import { loadShipmentVehicleRecords } from '../shipment-vehicles/shipment-vehicle.mock'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import { loadShipmentPalletRecords } from '../shipment-pallets/shipment-pallet.mock'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import { loadShipmentWorkOrderRecords } from '../shipment-work-orders/shipment-work-order.mock'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import { loadInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadShipmentRecords } from '../shipments/shipment.mock'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import { loadBranches, loadStockItems } from '../storage'
import type { Branch, StockItem, StockUnit, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = ShipmentReturnStatus | FilterValue
type ReturnTypeFilter = ShipmentReturnType | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentReturnInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  workOrders: ShipmentWorkOrderRecord[]
  pallets: ShipmentPalletRecord[]
  vehicles: ShipmentVehicleRecord[]
  plans: ShipmentPlanRecord[]
  deliverySources: ShipmentReturnDeliverySource[]
  deliveryStops: ShipmentReturnDeliveryStopSource[]
  deliveryLines: ShipmentReturnDeliveryLineSource[]
  returns: ShipmentReturnRecord[]
}

type ReturnFormItemState = {
  id: string
  deliveryStopId: string
  stockItemId: string
  inventoryLotId: string
  returnType: ShipmentReturnType
  quantity: string
  unit: StockUnit
  reason: string
  condition: ShipmentReturnCondition
  notes: string
}

type ReturnFormState = {
  returnNo: string
  deliveryId: string
  shipmentPlanId: string
  vehicleId: string
  returnDate: string
  status: ShipmentReturnStatus
  driverName: string
  notes: string
  items: ReturnFormItemState[]
}

type Message = {
  type: 'success' | 'error'
  text: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const formatQuantity = (value: number, unit: StockUnit = 'adet') => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getStatusClass = (status: ShipmentReturnStatus) => {
  if(status === 'APPROVED' || status === 'CLOSED') return 'success'
  if(status === 'COLLECTED' || status === 'RECEIVED') return 'info-pill'
  if(status === 'REJECTED') return 'danger-pill'
  return 'muted-pill'
}

const getConditionClass = (condition: ShipmentReturnCondition) => {
  if(condition === 'GOOD') return 'success'
  if(condition === 'DAMAGED' || condition === 'BROKEN' || condition === 'EXPIRED') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentReturnInitialData => {
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
  const vehicles = loadShipmentVehicleRecords(pallets)
  const plans = loadShipmentPlanRecords(vehicles, pallets, workOrders)
  const deliveryData = createShipmentReturnDeliverySources(plans, vehicles, pallets)
  const returns = loadShipmentReturnRecords(plans, vehicles, pallets)

  return {
    branches,
    stockItems,
    inventoryLots,
    workOrders,
    pallets,
    vehicles,
    plans,
    deliverySources: deliveryData.deliveries,
    deliveryStops: deliveryData.stops,
    deliveryLines: deliveryData.lines,
    returns
  }
}

const getBranchLabel = (
  branchId: string,
  branchMap: Map<string, Branch>,
  fallback = 'Branch bulunamadı'
) => {
  const branch = branchMap.get(branchId)
  return branch ? branch.name : fallback
}

const getStockItemLabel = (
  stockItemId: string,
  stockItemMap: Map<string, StockItem>
) => {
  const stockItem = stockItemMap.get(stockItemId)
  return stockItem ? stockItem.name : 'Stock Item bulunamadı'
}

const getInventoryLotLabel = (
  inventoryLotId: string,
  lotMap: Map<string, InventoryLot>
) => {
  const lot = lotMap.get(inventoryLotId)
  return lot ? lot.lotNo : 'Inventory Lot bulunamadı'
}

const getVehicleLabel = (
  vehicleId: string,
  vehicleMap: Map<string, ShipmentVehicleRecord>
) => {
  const vehicle = vehicleMap.get(vehicleId)
  if(!vehicle) return 'Vehicle bulunamadı'
  return `${vehicle.vehicleNo} - ${vehicle.plateNumber || vehicle.vehicleName || 'Araç'}`
}

const getShipmentPlanLabel = (
  shipmentPlanId: string,
  planMap: Map<string, ShipmentPlanRecord>
) => {
  const plan = planMap.get(shipmentPlanId)
  return plan ? plan.shipmentPlanNo : 'Shipment Plan bulunamadı'
}

const getDeliveryLabel = (
  deliveryId: string,
  deliveryMap: Map<string, ShipmentReturnDeliverySource>,
  planMap: Map<string, ShipmentPlanRecord>
) => {
  const delivery = deliveryMap.get(deliveryId)
  if(!delivery) return 'Delivery bulunamadı'
  return `${delivery.deliveryNo} - ${getShipmentPlanLabel(delivery.shipmentPlanId, planMap)}`
}

const getDeliveryStopLabel = (
  deliveryStopId: string,
  deliveryStopMap: Map<string, ShipmentReturnDeliveryStopSource>,
  branchMap: Map<string, Branch>
) => {
  const stop = deliveryStopMap.get(deliveryStopId)
  if(!stop) return 'Delivery Stop bulunamadı'
  return `${stop.stopOrder}. ${getBranchLabel(stop.branchId, branchMap)}`
}

const getDeliveryLinesForDelivery = (
  deliveryId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => {
  const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === deliveryId).map(stop => stop.id))
  return deliveryLines.filter(line => stopIds.has(line.deliveryStopId))
}

const getDeliveryLinesForStop = (
  deliveryStopId: string,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => deliveryLines.filter(line => line.deliveryStopId === deliveryStopId)

const getDeliveryLineOptionValue = (
  line: ShipmentReturnDeliveryLineSource
) => getShipmentReturnLineKey({
  deliveryStopId: line.deliveryStopId,
  stockItemId: line.stockItemId,
  inventoryLotId: line.inventoryLotId
})

const findDeliveryLineForFormItem = (
  item: Pick<ReturnFormItemState, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => deliveryLines.find(line => (
  line.deliveryStopId === item.deliveryStopId
  && line.stockItemId === item.stockItemId
  && line.inventoryLotId === item.inventoryLotId
)) || null

const createFormItem = (
  line: ShipmentReturnDeliveryLineSource | null,
  records: ShipmentReturnRecord[],
  ignoredReturnId = ''
): ReturnFormItemState => {
  const deliveredQuantity = line?.deliveredQuantity || 1
  const priorQuantity = line
    ? getShipmentReturnPriorQuantity({
      deliveryStopId: line.deliveryStopId,
      stockItemId: line.stockItemId,
      inventoryLotId: line.inventoryLotId
    }, records, ignoredReturnId)
    : 0
  const remainingQuantity = Math.max(0.001, deliveredQuantity - priorQuantity)

  return {
    id: createId('shipment_return_form_item'),
    deliveryStopId: line?.deliveryStopId || '',
    stockItemId: line?.stockItemId || '',
    inventoryLotId: line?.inventoryLotId || '',
    returnType: 'PRODUCT',
    quantity: String(Math.min(remainingQuantity, Math.max(0.001, deliveredQuantity * 0.05))),
    unit: line?.unit || 'adet',
    reason: '',
    condition: 'UNKNOWN',
    notes: ''
  }
}

const createInitialItemsForDelivery = (
  deliveryId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[],
  records: ShipmentReturnRecord[],
  ignoredReturnId = ''
) => {
  const lines = getDeliveryLinesForDelivery(deliveryId, deliveryStops, deliveryLines)
  return lines.slice(0, Math.min(2, lines.length)).map(line => createFormItem(line, records, ignoredReturnId))
}

const createEmptyForm = (
  records: ShipmentReturnRecord[],
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
): ReturnFormState => {
  const firstDelivery = deliveries[0] || null

  return {
    returnNo: getNextShipmentReturnNo(records),
    deliveryId: firstDelivery?.id || '',
    shipmentPlanId: firstDelivery?.shipmentPlanId || '',
    vehicleId: firstDelivery?.vehicleId || '',
    returnDate: getTodayKey(),
    status: 'OPEN',
    driverName: firstDelivery?.driverName || '',
    notes: '',
    items: firstDelivery
      ? createInitialItemsForDelivery(firstDelivery.id, deliveryStops, deliveryLines, records)
      : []
  }
}

const createFormFromRecord = (record: ShipmentReturnRecord): ReturnFormState => ({
  returnNo: record.returnNo,
  deliveryId: record.deliveryId,
  shipmentPlanId: record.shipmentPlanId,
  vehicleId: record.vehicleId,
  returnDate: record.returnDate,
  status: record.status,
  driverName: record.driverName,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    deliveryStopId: item.deliveryStopId,
    stockItemId: item.stockItemId,
    inventoryLotId: item.inventoryLotId,
    returnType: item.returnType,
    quantity: String(item.quantity),
    unit: item.unit,
    reason: item.reason,
    condition: item.condition,
    notes: item.notes
  }))
})

const createReturnPayload = (
  form: ReturnFormState,
  existingRecord?: ShipmentReturnRecord
): ShipmentReturnRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_return')
  const items = form.items.map((item): ShipmentReturnItem => ({
    id: item.id || createId('shipment_return_item'),
    returnId: id,
    deliveryStopId: item.deliveryStopId,
    stockItemId: item.stockItemId,
    inventoryLotId: item.inventoryLotId,
    returnType: item.returnType,
    quantity: Number(item.quantity),
    unit: item.unit,
    reason: item.reason.trim(),
    condition: item.condition,
    notes: item.notes.trim()
  }))

  return {
    id,
    returnNo: form.returnNo,
    deliveryId: form.deliveryId,
    shipmentPlanId: form.shipmentPlanId,
    vehicleId: form.vehicleId,
    returnDate: form.returnDate,
    status: form.status,
    driverName: form.driverName.trim(),
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    items
  }
}

export default function ShipmentReturns({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentReturnRecord[]>(initialData.returns)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<ReturnFormState>(() => createEmptyForm(
    initialData.returns,
    initialData.deliverySources,
    initialData.deliveryStops,
    initialData.deliveryLines
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [returnTypeFilter, setReturnTypeFilter] = React.useState<ReturnTypeFilter>('all')
  const [returnDateFilter, setReturnDateFilter] = React.useState('')

  const {
    branches,
    stockItems,
    inventoryLots,
    pallets,
    vehicles,
    plans,
    deliverySources,
    deliveryStops,
    deliveryLines
  } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const vehicleMap = React.useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle])), [vehicles])
  const planMap = React.useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const deliveryMap = React.useMemo(() => new Map(deliverySources.map(delivery => [delivery.id, delivery])), [deliverySources])
  const deliveryStopMap = React.useMemo(() => new Map(deliveryStops.map(stop => [stop.id, stop])), [deliveryStops])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const delivery = deliveryMap.get(record.deliveryId)
      const vehicle = vehicleMap.get(record.vehicleId)
      const searchFields = [
        record.returnNo,
        delivery?.deliveryNo || '',
        getShipmentPlanLabel(record.shipmentPlanId, planMap),
        vehicle?.vehicleNo || '',
        vehicle?.plateNumber || ''
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesReturnType = returnTypeFilter === 'all' || record.items.some(item => item.returnType === returnTypeFilter)
      const matchesReturnDate = !returnDateFilter || record.returnDate === returnDateFilter

      return matchesSearch && matchesStatus && matchesReturnType && matchesReturnDate
    })
  }, [deliveryMap, planMap, records, returnDateFilter, returnTypeFilter, search, statusFilter, vehicleMap])

  const openCount = records.filter(record => record.status === 'OPEN').length
  const collectedCount = records.filter(record => record.status === 'COLLECTED' || record.status === 'RECEIVED').length
  const approvedCount = records.filter(record => record.status === 'APPROVED' || record.status === 'CLOSED').length
  const totalItemCount = records.reduce((total, record) => total + record.items.length, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentReturnRecord[]) => {
    setRecords(nextRecords)
    saveShipmentReturnRecords(nextRecords, deliverySources, deliveryStops, deliveryLines)
  }, [deliveryLines, deliverySources, deliveryStops])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, deliverySources, deliveryStops, deliveryLines))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentReturnRecord) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const handleDeliveryChange = (deliveryId: string) => {
    const delivery = deliveryMap.get(deliveryId) || null
    setForm(prev => ({
      ...prev,
      deliveryId,
      shipmentPlanId: delivery?.shipmentPlanId || '',
      vehicleId: delivery?.vehicleId || '',
      driverName: delivery?.driverName || '',
      items: delivery
        ? createInitialItemsForDelivery(delivery.id, deliveryStops, deliveryLines, records, editingRecordId)
        : []
    }))
  }

  const updateFormItem = (
    itemId: string,
    patch: Partial<ReturnFormItemState>
  ) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, ...patch } : item)
    }))
  }

  const handleDeliveryStopChange = (
    itemId: string,
    deliveryStopId: string
  ) => {
    const firstLine = getDeliveryLinesForStop(deliveryStopId, deliveryLines)[0] || null
    updateFormItem(itemId, {
      deliveryStopId,
      stockItemId: firstLine?.stockItemId || '',
      inventoryLotId: firstLine?.inventoryLotId || '',
      unit: firstLine?.unit || 'adet'
    })
  }

  const handleDeliveredItemChange = (
    itemId: string,
    optionValue: string
  ) => {
    const line = deliveryLines.find(item => getDeliveryLineOptionValue(item) === optionValue) || null
    updateFormItem(itemId, {
      deliveryStopId: line?.deliveryStopId || '',
      stockItemId: line?.stockItemId || '',
      inventoryLotId: line?.inventoryLotId || '',
      unit: line?.unit || 'adet'
    })
  }

  const addFormItem = () => {
    const lines = getDeliveryLinesForDelivery(form.deliveryId, deliveryStops, deliveryLines)
    const nextLine = lines[form.items.length % Math.max(1, lines.length)] || null
    setForm(prev => ({
      ...prev,
      items: [...prev.items, createFormItem(nextLine, records, editingRecordId)]
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
    const nextRecord = createReturnPayload(form, existingRecord)
    const validationError = validateShipmentReturn(nextRecord, deliverySources, deliveryStops, deliveryLines, records)

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
    setMessage({ type: 'success', text: `${nextRecord.returnNo} kaydedildi.` })
  }

  const updateRecordStatus = (record: ShipmentReturnRecord, status: ShipmentReturnStatus) => {
    const nextRecord: ShipmentReturnRecord = {
      ...record,
      status,
      updatedAt: new Date().toISOString()
    }
    const validationError = validateShipmentReturn(nextRecord, deliverySources, deliveryStops, deliveryLines, records)

    if(validationError){
      setMessage({ type: 'error', text: validationError })
      return
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setMessage({ type: 'success', text: `${record.returnNo} durumu güncellendi.` })
  }

  return (
    <div className="shipment-page shipment-return-page">
      <div className="page-header">
        <div>
          <h2>İade Süreci</h2>
          <p className="muted">Teslimatı tamamlanan sevkiyatlarda ürün, palet ve ekipman iadelerini teslim noktası bazında kaydedin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          İade Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Açık</span>
          <strong>{openCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplanan</span>
          <strong>{collectedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylanan</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Return Item</span>
          <strong>{totalItemCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Return Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-return-toolbar">
            <input
              type="search"
              placeholder="Return No, delivery veya vehicle ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_RETURN_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_RETURN_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={returnTypeFilter} onChange={event => setReturnTypeFilter(event.target.value as ReturnTypeFilter)}>
              <option value="all">Tüm Return Type</option>
              {SHIPMENT_RETURN_TYPES.map(type => (
                <option key={type} value={type}>{SHIPMENT_RETURN_TYPE_LABELS[type]}</option>
              ))}
            </select>
            <input
              type="date"
              value={returnDateFilter}
              onChange={event => setReturnDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table shipment-return-table">
              <thead>
                <tr>
                  <th>Return No</th>
                  <th>Delivery</th>
                  <th>Vehicle</th>
                  <th>Return Date</th>
                  <th>Item Count</th>
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
                    <td data-label="Return No">
                      <strong>{record.returnNo}</strong>
                      <span className="muted">{formatQuantity(getShipmentReturnTotalQuantity(record), record.items[0]?.unit || 'adet')}</span>
                    </td>
                    <td data-label="Delivery">{getDeliveryLabel(record.deliveryId, deliveryMap, planMap)}</td>
                    <td data-label="Vehicle">{getVehicleLabel(record.vehicleId, vehicleMap)}</td>
                    <td data-label="Return Date">{formatDate(record.returnDate)}</td>
                    <td data-label="Item Count">{record.items.length}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_RETURN_STATUS_LABELS[record.status]}</span>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>Filtrelere uygun Return bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'İade Düzenle' : 'Yeni İade'}</h3>
                    <p className="muted">Tamamlanan delivery kaydını seçin ve iade kalemlerini teslim edilen miktarlar içinde girin.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Return No</span>
                      <input value={form.returnNo} disabled />
                    </label>
                    <label>
                      <span>Delivery</span>
                      <select value={form.deliveryId} onChange={event => handleDeliveryChange(event.target.value)}>
                        <option value="">Delivery seçiniz</option>
                        {deliverySources.map(delivery => (
                          <option key={delivery.id} value={delivery.id}>
                            {delivery.deliveryNo} - {getShipmentPlanLabel(delivery.shipmentPlanId, planMap)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Return Date</span>
                      <input
                        type="date"
                        value={form.returnDate}
                        onChange={event => setForm(prev => ({ ...prev, returnDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentReturnStatus }))}
                      >
                        {SHIPMENT_RETURN_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_RETURN_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span>Shipment Plan</span>
                      <strong>{getShipmentPlanLabel(form.shipmentPlanId, planMap)}</strong>
                    </div>
                    <div>
                      <span>Vehicle</span>
                      <strong>{getVehicleLabel(form.vehicleId, vehicleMap)}</strong>
                    </div>
                    <label>
                      <span>Driver</span>
                      <input
                        value={form.driverName}
                        onChange={event => setForm(prev => ({ ...prev, driverName: event.target.value }))}
                      />
                    </label>
                    <div>
                      <span>Created By</span>
                      <strong>{currentUser.fullName || currentUser.username}</strong>
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
                    <h4>Return Item</h4>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={addFormItem}
                      disabled={!form.deliveryId}
                    >
                      Item Ekle
                    </button>
                  </div>
                  <div className="shipment-item-editor-list">
                    {form.items.map((item, index) => {
                      const line = findDeliveryLineForFormItem(item, deliveryLines)
                      const stopOptions = deliveryStops.filter(stop => stop.deliveryId === form.deliveryId)
                      const lineOptions = getDeliveryLinesForStop(item.deliveryStopId, deliveryLines)
                      const deliveredQuantity = line
                        ? getShipmentReturnDeliveredQuantity({
                          deliveryStopId: item.deliveryStopId,
                          stockItemId: item.stockItemId,
                          inventoryLotId: item.inventoryLotId
                        }, deliveryLines)
                        : 0
                      const priorQuantity = line
                        ? getShipmentReturnPriorQuantity({
                          deliveryStopId: item.deliveryStopId,
                          stockItemId: item.stockItemId,
                          inventoryLotId: item.inventoryLotId
                        }, records, editingRecordId)
                        : 0
                      const availableQuantity = Math.max(0, deliveredQuantity - priorQuantity)

                      return (
                        <div className="shipment-item-editor" key={item.id}>
                          <label>
                            <span>Delivery Stop</span>
                            <select
                              value={item.deliveryStopId}
                              onChange={event => handleDeliveryStopChange(item.id, event.target.value)}
                            >
                              <option value="">Stop seçiniz</option>
                              {stopOptions.map(stop => (
                                <option key={stop.id} value={stop.id}>
                                  {stop.stopOrder}. {getBranchLabel(stop.branchId, branchMap)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Stock Item</span>
                            <select
                              value={line ? getDeliveryLineOptionValue(line) : ''}
                              onChange={event => handleDeliveredItemChange(item.id, event.target.value)}
                            >
                              <option value="">Stock Item seçiniz</option>
                              {lineOptions.map(option => (
                                <option key={option.id} value={getDeliveryLineOptionValue(option)}>
                                  {getStockItemLabel(option.stockItemId, stockItemMap)} - {getInventoryLotLabel(option.inventoryLotId, lotMap)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Inventory Lot</span>
                            <input value={getInventoryLotLabel(item.inventoryLotId, lotMap)} disabled />
                          </label>
                          <label>
                            <span>Return Type</span>
                            <select
                              value={item.returnType}
                              onChange={event => updateFormItem(item.id, { returnType: event.target.value as ShipmentReturnType })}
                            >
                              {SHIPMENT_RETURN_TYPES.map(type => (
                                <option key={type} value={type}>{SHIPMENT_RETURN_TYPE_LABELS[type]}</option>
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
                          <label>
                            <span>Condition</span>
                            <select
                              value={item.condition}
                              onChange={event => updateFormItem(item.id, { condition: event.target.value as ShipmentReturnCondition })}
                            >
                              {SHIPMENT_RETURN_CONDITIONS.map(condition => (
                                <option key={condition} value={condition}>{SHIPMENT_RETURN_CONDITION_LABELS[condition]}</option>
                              ))}
                            </select>
                          </label>
                          <label className="shipment-form-wide">
                            <span>Reason</span>
                            <input
                              value={item.reason}
                              onChange={event => updateFormItem(item.id, { reason: event.target.value })}
                            />
                          </label>
                          <label className="shipment-form-wide">
                            <span>Notes</span>
                            <input
                              value={item.notes}
                              onChange={event => updateFormItem(item.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. return item</span>
                            <strong>
                              Teslim: {line ? formatQuantity(deliveredQuantity, line.unit) : '-'}
                              {' - '}
                              Kalan limit: {line ? formatQuantity(availableQuantity, line.unit) : '-'}
                            </strong>
                            <span>
                              Stop: {getDeliveryStopLabel(item.deliveryStopId, deliveryStopMap, branchMap)}
                              {' - '}
                              Unit: {item.unit}
                            </span>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => removeFormItem(item.id)}
                          >
                            Kaldır
                          </button>
                        </div>
                      )
                    })}
                    {form.items.length === 0 && (
                      <p className="muted shipment-empty-state">Bu iade için Return Item kaydı yok.</p>
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
                    <h3>{selectedRecord.returnNo}</h3>
                    <p className="muted">{getDeliveryLabel(selectedRecord.deliveryId, deliveryMap, planMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_RETURN_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-side-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => openEditForm(selectedRecord)}
                  >
                    Düzenle
                  </button>
                  <label>
                    <span>Durum</span>
                    <select
                      value={selectedRecord.status}
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentReturnStatus)}
                    >
                      {SHIPMENT_RETURN_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_RETURN_STATUS_LABELS[status]}</option>
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
                    <span>Return No</span>
                    <strong>{selectedRecord.returnNo}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{getDeliveryLabel(selectedRecord.deliveryId, deliveryMap, planMap)}</strong>
                  </div>
                  <div>
                    <span>Shipment Plan</span>
                    <strong>{getShipmentPlanLabel(selectedRecord.shipmentPlanId, planMap)}</strong>
                  </div>
                  <div>
                    <span>Vehicle</span>
                    <strong>{getVehicleLabel(selectedRecord.vehicleId, vehicleMap)}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{selectedRecord.driverName || '-'}</strong>
                  </div>
                  <div>
                    <span>Return Date</span>
                    <strong>{formatDate(selectedRecord.returnDate)}</strong>
                  </div>
                  <div>
                    <span>Item Count</span>
                    <strong>{selectedRecord.items.length}</strong>
                  </div>
                  <div>
                    <span>Total Quantity</span>
                    <strong>{formatQuantity(getShipmentReturnTotalQuantity(selectedRecord), selectedRecord.items[0]?.unit || 'adet')}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Return Item List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kayıt</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.items.map(item => {
                    const deliveredQuantity = getShipmentReturnDeliveredQuantity(item, deliveryLines)

                    return (
                      <div className="shipment-product-row" key={item.id}>
                        <div>
                          <strong>{getStockItemLabel(item.stockItemId, stockItemMap)}</strong>
                          <span>{getInventoryLotLabel(item.inventoryLotId, lotMap)}</span>
                        </div>
                        <div>
                          <span className={`status-pill ${getConditionClass(item.condition)}`}>
                            {SHIPMENT_RETURN_CONDITION_LABELS[item.condition]}
                          </span>
                          <strong>{formatQuantity(item.quantity, item.unit)}</strong>
                        </div>
                        <p>
                          Delivery Stop: {getDeliveryStopLabel(item.deliveryStopId, deliveryStopMap, branchMap)}
                          {' - '}
                          Type: {SHIPMENT_RETURN_TYPE_LABELS[item.returnType]}
                          {' - '}
                          Delivered Limit: {formatQuantity(deliveredQuantity, item.unit)}
                          {' - '}
                          Reason: {item.reason}
                          {' - '}
                          {item.notes || '-'}
                        </p>
                      </div>
                    )
                  })}
                  {selectedRecord.items.length === 0 && (
                    <p className="muted shipment-empty-state">Bu Return için item kaydı yok.</p>
                  )}
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Notes</h3>
                </div>
                <p className="shipment-notes">{selectedRecord.notes || 'Not girilmedi.'}</p>
              </section>
            </>
          ) : (
            <section className="card shipment-detail-card">
              <p className="muted shipment-empty-state">Return kaydı bulunamadı.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
