import React from 'react'
import {
  SHIPMENT_WAYBILL_STATUSES,
  SHIPMENT_WAYBILL_STATUS_LABELS,
  getNextShipmentWaybillNo,
  getShipmentWaybillTotalQuantity,
  loadShipmentWaybillRecords,
  saveShipmentWaybillRecords
} from '../shipment-waybills/shipment-waybill.mock'
import {
  getShipmentWaybillDeliveryLine,
  validateShipmentWaybill
} from '../shipment-waybills/shipment-waybill.service'
import type {
  ShipmentWaybillItem,
  ShipmentWaybillRecord,
  ShipmentWaybillStatus
} from '../shipment-waybills/shipment-waybill.types'
import {
  SHIPMENT_RETURN_CONDITION_LABELS,
  SHIPMENT_RETURN_TYPE_LABELS,
  loadShipmentReturnRecords
} from '../shipment-returns/shipment-return.mock'
import {
  createShipmentReturnDeliverySources,
  type ShipmentReturnDeliveryLineSource,
  type ShipmentReturnDeliverySource,
  type ShipmentReturnDeliveryStopSource
} from '../shipment-returns/shipment-return.service'
import type { ShipmentReturnItem, ShipmentReturnRecord } from '../shipment-returns/shipment-return.types'
import { loadShipmentPlanRecords } from '../shipment-plans/shipment-plan.mock'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import { loadShipmentVehicleRecords } from '../shipment-vehicles/shipment-vehicle.mock'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import { loadShipmentPalletRecords } from '../shipment-pallets/shipment-pallet.mock'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import { loadShipmentWorkOrderRecords } from '../shipment-work-orders/shipment-work-order.mock'
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
type StatusFilter = ShipmentWaybillStatus | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentWaybillInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  pallets: ShipmentPalletRecord[]
  vehicles: ShipmentVehicleRecord[]
  plans: ShipmentPlanRecord[]
  deliverySources: ShipmentReturnDeliverySource[]
  deliveryStops: ShipmentReturnDeliveryStopSource[]
  deliveryLines: ShipmentReturnDeliveryLineSource[]
  returns: ShipmentReturnRecord[]
  waybills: ShipmentWaybillRecord[]
}

type WaybillFormItemState = {
  id: string
  deliveryStopId: string
  returnItemId: string
  stockItemId: string
  inventoryLotId: string
  quantity: string
  unit: StockUnit
  notes: string
}

type WaybillFormState = {
  waybillNo: string
  shipmentPlanId: string
  deliveryId: string
  vehicleId: string
  issueDate: string
  status: ShipmentWaybillStatus
  driverName: string
  notes: string
  items: WaybillFormItemState[]
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

const getStatusClass = (status: ShipmentWaybillStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'ISSUED' || status === 'IN_TRANSIT') return 'info-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentWaybillInitialData => {
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
  const waybills = loadShipmentWaybillRecords(plans, vehicles, pallets, returns)

  return {
    branches,
    stockItems,
    inventoryLots,
    pallets,
    vehicles,
    plans,
    deliverySources: deliveryData.deliveries,
    deliveryStops: deliveryData.stops,
    deliveryLines: deliveryData.lines,
    returns,
    waybills
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
) => `${line.deliveryStopId}::${line.stockItemId}::${line.inventoryLotId}`

const findDeliveryLineForFormItem = (
  item: Pick<WaybillFormItemState, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => getShipmentWaybillDeliveryLine({
  deliveryStopId: item.deliveryStopId,
  stockItemId: item.stockItemId,
  inventoryLotId: item.inventoryLotId
}, deliveryLines)

const getReturnItemMap = (
  returns: ShipmentReturnRecord[]
) => new Map(returns.flatMap(record => (
  record.items.map(item => [item.id, item] as const)
)))

const getReturnRecordByItemId = (
  returnItemId: string,
  returns: ShipmentReturnRecord[]
) => returns.find(record => record.items.some(item => item.id === returnItemId)) || null

const getReturnItemsForDelivery = (
  deliveryId: string,
  returns: ShipmentReturnRecord[]
) => returns
  .filter(record => record.deliveryId === deliveryId)
  .flatMap(record => record.items)

const getReturnItemLabel = (
  returnItem: ShipmentReturnItem,
  returns: ShipmentReturnRecord[],
  stockItemMap: Map<string, StockItem>
) => {
  const returnRecord = getReturnRecordByItemId(returnItem.id, returns)
  return `${returnRecord?.returnNo || 'Return'} - ${getStockItemLabel(returnItem.stockItemId, stockItemMap)}`
}

const createFormItem = (
  line: ShipmentReturnDeliveryLineSource | null,
  returnItem: ShipmentReturnItem | null = null
): WaybillFormItemState => ({
  id: createId('shipment_waybill_form_item'),
  deliveryStopId: returnItem?.deliveryStopId || line?.deliveryStopId || '',
  returnItemId: returnItem?.id || '',
  stockItemId: returnItem?.stockItemId || line?.stockItemId || '',
  inventoryLotId: returnItem?.inventoryLotId || line?.inventoryLotId || '',
  quantity: String(returnItem?.quantity || line?.deliveredQuantity || 1),
  unit: returnItem?.unit || line?.unit || 'adet',
  notes: returnItem ? 'Return Item bağlantısı eklendi.' : ''
})

const createInitialItemsForDelivery = (
  deliveryId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => {
  const lines = getDeliveryLinesForDelivery(deliveryId, deliveryStops, deliveryLines)
  return lines.slice(0, Math.min(3, lines.length)).map(line => createFormItem(line))
}

const createEmptyForm = (
  records: ShipmentWaybillRecord[],
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
): WaybillFormState => {
  const firstDelivery = deliveries[0] || null

  return {
    waybillNo: getNextShipmentWaybillNo(records),
    shipmentPlanId: firstDelivery?.shipmentPlanId || '',
    deliveryId: firstDelivery?.id || '',
    vehicleId: firstDelivery?.vehicleId || '',
    issueDate: getTodayKey(),
    status: 'DRAFT',
    driverName: firstDelivery?.driverName || '',
    notes: '',
    items: firstDelivery
      ? createInitialItemsForDelivery(firstDelivery.id, deliveryStops, deliveryLines)
      : []
  }
}

const createFormFromRecord = (record: ShipmentWaybillRecord): WaybillFormState => ({
  waybillNo: record.waybillNo,
  shipmentPlanId: record.shipmentPlanId,
  deliveryId: record.deliveryId,
  vehicleId: record.vehicleId,
  issueDate: record.issueDate,
  status: record.status,
  driverName: record.driverName,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    deliveryStopId: item.deliveryStopId,
    returnItemId: item.returnItemId,
    stockItemId: item.stockItemId,
    inventoryLotId: item.inventoryLotId,
    quantity: String(item.quantity),
    unit: item.unit,
    notes: item.notes
  }))
})

const createWaybillPayload = (
  form: WaybillFormState,
  existingRecord?: ShipmentWaybillRecord
): ShipmentWaybillRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_waybill')
  const items = form.items.map((item): ShipmentWaybillItem => ({
    id: item.id || createId('shipment_waybill_item'),
    waybillId: id,
    deliveryStopId: item.deliveryStopId,
    returnItemId: item.returnItemId,
    stockItemId: item.stockItemId,
    inventoryLotId: item.inventoryLotId,
    quantity: Number(item.quantity),
    unit: item.unit,
    notes: item.notes.trim()
  }))

  return {
    id,
    waybillNo: form.waybillNo,
    shipmentPlanId: form.shipmentPlanId,
    deliveryId: form.deliveryId,
    vehicleId: form.vehicleId,
    issueDate: form.issueDate,
    status: form.status,
    driverName: form.driverName.trim(),
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    items
  }
}

export default function ShipmentWaybills({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentWaybillRecord[]>(initialData.waybills)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<WaybillFormState>(() => createEmptyForm(
    initialData.waybills,
    initialData.deliverySources,
    initialData.deliveryStops,
    initialData.deliveryLines
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [vehicleFilter, setVehicleFilter] = React.useState('all')
  const [issueDateFilter, setIssueDateFilter] = React.useState('')

  const {
    branches,
    stockItems,
    inventoryLots,
    vehicles,
    plans,
    deliverySources,
    deliveryStops,
    deliveryLines,
    returns
  } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const vehicleMap = React.useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle])), [vehicles])
  const planMap = React.useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const deliveryMap = React.useMemo(() => new Map(deliverySources.map(delivery => [delivery.id, delivery])), [deliverySources])
  const deliveryStopMap = React.useMemo(() => new Map(deliveryStops.map(stop => [stop.id, stop])), [deliveryStops])
  const returnItemMap = React.useMemo(() => getReturnItemMap(returns), [returns])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const planOptions = React.useMemo(() => (
    plans.filter(plan => deliverySources.some(delivery => delivery.shipmentPlanId === plan.id))
  ), [deliverySources, plans])
  const formDeliveryOptions = React.useMemo(() => (
    deliverySources.filter(delivery => delivery.shipmentPlanId === form.shipmentPlanId)
  ), [deliverySources, form.shipmentPlanId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const vehicle = vehicleMap.get(record.vehicleId)
      const searchFields = [
        record.waybillNo,
        getShipmentPlanLabel(record.shipmentPlanId, planMap),
        vehicle?.vehicleNo || '',
        vehicle?.plateNumber || ''
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesVehicle = vehicleFilter === 'all' || record.vehicleId === vehicleFilter
      const matchesIssueDate = !issueDateFilter || record.issueDate === issueDateFilter

      return matchesSearch && matchesStatus && matchesVehicle && matchesIssueDate
    })
  }, [issueDateFilter, planMap, records, search, statusFilter, vehicleFilter, vehicleMap])

  const draftCount = records.filter(record => record.status === 'DRAFT').length
  const issuedCount = records.filter(record => record.status === 'ISSUED' || record.status === 'IN_TRANSIT').length
  const deliveredCount = records.filter(record => record.status === 'DELIVERED').length
  const totalItemCount = records.reduce((total, record) => total + record.items.length, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentWaybillRecord[]) => {
    setRecords(nextRecords)
    saveShipmentWaybillRecords(nextRecords, plans, deliverySources, deliveryStops, deliveryLines, returns)
  }, [deliveryLines, deliverySources, deliveryStops, plans, returns])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, deliverySources, deliveryStops, deliveryLines))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentWaybillRecord) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const handleShipmentPlanChange = (shipmentPlanId: string) => {
    const delivery = deliverySources.find(record => record.shipmentPlanId === shipmentPlanId) || null
    const plan = planMap.get(shipmentPlanId) || null

    setForm(prev => ({
      ...prev,
      shipmentPlanId,
      deliveryId: delivery?.id || '',
      vehicleId: delivery?.vehicleId || plan?.vehicleId || '',
      driverName: delivery?.driverName || plan?.driverName || '',
      items: delivery ? createInitialItemsForDelivery(delivery.id, deliveryStops, deliveryLines) : []
    }))
  }

  const handleDeliveryChange = (deliveryId: string) => {
    const delivery = deliveryMap.get(deliveryId) || null
    setForm(prev => ({
      ...prev,
      deliveryId,
      shipmentPlanId: delivery?.shipmentPlanId || prev.shipmentPlanId,
      vehicleId: delivery?.vehicleId || '',
      driverName: delivery?.driverName || '',
      items: delivery ? createInitialItemsForDelivery(delivery.id, deliveryStops, deliveryLines) : []
    }))
  }

  const updateFormItem = (
    itemId: string,
    patch: Partial<WaybillFormItemState>
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
      returnItemId: '',
      stockItemId: firstLine?.stockItemId || '',
      inventoryLotId: firstLine?.inventoryLotId || '',
      quantity: String(firstLine?.deliveredQuantity || 1),
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
      returnItemId: '',
      stockItemId: line?.stockItemId || '',
      inventoryLotId: line?.inventoryLotId || '',
      quantity: String(line?.deliveredQuantity || 1),
      unit: line?.unit || 'adet'
    })
  }

  const handleReturnItemChange = (
    itemId: string,
    returnItemId: string
  ) => {
    if(!returnItemId){
      updateFormItem(itemId, { returnItemId: '' })
      return
    }

    const returnItem = returnItemMap.get(returnItemId) || null
    updateFormItem(itemId, {
      returnItemId,
      deliveryStopId: returnItem?.deliveryStopId || '',
      stockItemId: returnItem?.stockItemId || '',
      inventoryLotId: returnItem?.inventoryLotId || '',
      quantity: String(returnItem?.quantity || 1),
      unit: returnItem?.unit || 'adet'
    })
  }

  const addFormItem = () => {
    const lines = getDeliveryLinesForDelivery(form.deliveryId, deliveryStops, deliveryLines)
    const nextLine = lines[form.items.length % Math.max(1, lines.length)] || null
    setForm(prev => ({
      ...prev,
      items: [...prev.items, createFormItem(nextLine)]
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
    const nextRecord = createWaybillPayload(form, existingRecord)
    const validationError = validateShipmentWaybill(
      nextRecord,
      plans,
      vehicles,
      deliverySources,
      deliveryStops,
      deliveryLines,
      returns,
      existingRecord
    )

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
    setMessage({ type: 'success', text: `${nextRecord.waybillNo} kaydedildi.` })
  }

  const updateRecordStatus = (record: ShipmentWaybillRecord, status: ShipmentWaybillStatus) => {
    const nextRecord: ShipmentWaybillRecord = {
      ...record,
      status,
      updatedAt: new Date().toISOString()
    }
    const validationError = validateShipmentWaybill(
      nextRecord,
      plans,
      vehicles,
      deliverySources,
      deliveryStops,
      deliveryLines,
      returns,
      record
    )

    if(validationError){
      setMessage({ type: 'error', text: validationError })
      return
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setMessage({ type: 'success', text: `${record.waybillNo} durumu güncellendi.` })
  }

  return (
    <div className="shipment-page shipment-waybill-page">
      <div className="page-header">
        <div>
          <h2>İrsaliye Süreci</h2>
          <p className="muted">Tamamlanan sevkiyatların resmi sevk evraklarını, delivery ve return referanslarıyla yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          İrsaliye Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Taslak</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="metric-card">
          <span>Sevkte</span>
          <strong>{issuedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Teslim</span>
          <strong>{deliveredCount}</strong>
        </div>
        <div className="metric-card">
          <span>Waybill Item</span>
          <strong>{totalItemCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Waybill Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-waybill-toolbar">
            <input
              type="search"
              placeholder="Waybill No, shipment plan veya vehicle ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_WAYBILL_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_WAYBILL_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={vehicleFilter} onChange={event => setVehicleFilter(event.target.value)}>
              <option value="all">Tüm Vehicle</option>
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNo} - {vehicle.plateNumber}</option>
              ))}
            </select>
            <input
              type="date"
              value={issueDateFilter}
              onChange={event => setIssueDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table shipment-waybill-table">
              <thead>
                <tr>
                  <th>Waybill No</th>
                  <th>Shipment Plan</th>
                  <th>Vehicle</th>
                  <th>Issue Date</th>
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
                    <td data-label="Waybill No">
                      <strong>{record.waybillNo}</strong>
                      <span className="muted">{formatQuantity(getShipmentWaybillTotalQuantity(record), record.items[0]?.unit || 'adet')}</span>
                    </td>
                    <td data-label="Shipment Plan">{getShipmentPlanLabel(record.shipmentPlanId, planMap)}</td>
                    <td data-label="Vehicle">{getVehicleLabel(record.vehicleId, vehicleMap)}</td>
                    <td data-label="Issue Date">{formatDate(record.issueDate)}</td>
                    <td data-label="Item Count">{record.items.length}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_WAYBILL_STATUS_LABELS[record.status]}</span>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>Filtrelere uygun Waybill bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'İrsaliye Düzenle' : 'Yeni İrsaliye'}</h3>
                    <p className="muted">Shipment Plan seçin, delivery satırlarını resmi irsaliye kalemlerine bağlayın.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Waybill No</span>
                      <input value={form.waybillNo} disabled />
                    </label>
                    <label>
                      <span>Shipment Plan</span>
                      <select
                        value={form.shipmentPlanId}
                        onChange={event => handleShipmentPlanChange(event.target.value)}
                        disabled={Boolean(editingRecordId)}
                      >
                        <option value="">Shipment Plan seçiniz</option>
                        {planOptions.map(plan => (
                          <option key={plan.id} value={plan.id}>{plan.shipmentPlanNo}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Delivery</span>
                      <select
                        value={form.deliveryId}
                        onChange={event => handleDeliveryChange(event.target.value)}
                        disabled={Boolean(editingRecordId)}
                      >
                        <option value="">Delivery seçiniz</option>
                        {formDeliveryOptions.map(delivery => (
                          <option key={delivery.id} value={delivery.id}>
                            {delivery.deliveryNo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Issue Date</span>
                      <input
                        type="date"
                        value={form.issueDate}
                        onChange={event => setForm(prev => ({ ...prev, issueDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentWaybillStatus }))}
                      >
                        {SHIPMENT_WAYBILL_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_WAYBILL_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
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
                    <h4>Waybill Item</h4>
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
                      const lineOptions = item.deliveryStopId
                        ? getDeliveryLinesForStop(item.deliveryStopId, deliveryLines)
                        : getDeliveryLinesForDelivery(form.deliveryId, deliveryStops, deliveryLines)
                      const returnItemOptions = getReturnItemsForDelivery(form.deliveryId, returns)
                      const selectedReturnItem = item.returnItemId ? returnItemMap.get(item.returnItemId) || null : null

                      return (
                        <div className="shipment-item-editor" key={item.id}>
                          <label>
                            <span>Delivery Stop</span>
                            <select
                              value={item.deliveryStopId}
                              onChange={event => handleDeliveryStopChange(item.id, event.target.value)}
                              disabled={Boolean(item.returnItemId)}
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
                            <span>Return Item</span>
                            <select
                              value={item.returnItemId}
                              onChange={event => handleReturnItemChange(item.id, event.target.value)}
                            >
                              <option value="">Return bağlantısı yok</option>
                              {returnItemOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                  {getReturnItemLabel(option, returns, stockItemMap)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Stock Item</span>
                            <select
                              value={line ? getDeliveryLineOptionValue(line) : ''}
                              onChange={event => handleDeliveredItemChange(item.id, event.target.value)}
                              disabled={Boolean(item.returnItemId)}
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
                            <span>Unit</span>
                            <input value={item.unit} disabled />
                          </label>
                          <label className="shipment-form-wide">
                            <span>Notes</span>
                            <input
                              value={item.notes}
                              onChange={event => updateFormItem(item.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. waybill item</span>
                            <strong>
                              Delivery Limit: {line ? formatQuantity(line.deliveredQuantity, line.unit) : '-'}
                              {' - '}
                              Return: {selectedReturnItem ? formatQuantity(selectedReturnItem.quantity, selectedReturnItem.unit) : '-'}
                            </strong>
                            <span>
                              Stop: {getDeliveryStopLabel(item.deliveryStopId, deliveryStopMap, branchMap)}
                              {' - '}
                              Return Type: {selectedReturnItem ? SHIPMENT_RETURN_TYPE_LABELS[selectedReturnItem.returnType] : '-'}
                              {' - '}
                              Condition: {selectedReturnItem ? SHIPMENT_RETURN_CONDITION_LABELS[selectedReturnItem.condition] : '-'}
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
                      <p className="muted shipment-empty-state">Bu irsaliye için Waybill Item kaydı yok.</p>
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
                    <h3>{selectedRecord.waybillNo}</h3>
                    <p className="muted">{getShipmentPlanLabel(selectedRecord.shipmentPlanId, planMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_WAYBILL_STATUS_LABELS[selectedRecord.status]}
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
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentWaybillStatus)}
                    >
                      {SHIPMENT_WAYBILL_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_WAYBILL_STATUS_LABELS[status]}</option>
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
                    <span>Waybill No</span>
                    <strong>{selectedRecord.waybillNo}</strong>
                  </div>
                  <div>
                    <span>Shipment Plan</span>
                    <strong>{getShipmentPlanLabel(selectedRecord.shipmentPlanId, planMap)}</strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>{getDeliveryLabel(selectedRecord.deliveryId, deliveryMap, planMap)}</strong>
                  </div>
                  <div>
                    <span>Vehicle</span>
                    <strong>{getVehicleLabel(selectedRecord.vehicleId, vehicleMap)}</strong>
                  </div>
                  <div>
                    <span>Issue Date</span>
                    <strong>{formatDate(selectedRecord.issueDate)}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{selectedRecord.driverName || '-'}</strong>
                  </div>
                  <div>
                    <span>Item Count</span>
                    <strong>{selectedRecord.items.length}</strong>
                  </div>
                  <div>
                    <span>Total Quantity</span>
                    <strong>{formatQuantity(getShipmentWaybillTotalQuantity(selectedRecord), selectedRecord.items[0]?.unit || 'adet')}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Waybill Item List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kayıt</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.items.map(item => {
                    const returnItem = item.returnItemId ? returnItemMap.get(item.returnItemId) || null : null
                    const returnRecord = item.returnItemId ? getReturnRecordByItemId(item.returnItemId, returns) : null
                    const deliveryLine = getShipmentWaybillDeliveryLine(item, deliveryLines)

                    return (
                      <div className="shipment-product-row" key={item.id}>
                        <div>
                          <strong>{getStockItemLabel(item.stockItemId, stockItemMap)}</strong>
                          <span>{getInventoryLotLabel(item.inventoryLotId, lotMap)}</span>
                        </div>
                        <div>
                          <span>{returnRecord?.returnNo || 'Return yok'}</span>
                          <strong>{formatQuantity(item.quantity, item.unit)}</strong>
                        </div>
                        <p>
                          Delivery Stop: {getDeliveryStopLabel(item.deliveryStopId, deliveryStopMap, branchMap)}
                          {' - '}
                          Delivery Limit: {deliveryLine ? formatQuantity(deliveryLine.deliveredQuantity, deliveryLine.unit) : '-'}
                          {' - '}
                          Return Item: {returnItem ? `${SHIPMENT_RETURN_TYPE_LABELS[returnItem.returnType]} / ${SHIPMENT_RETURN_CONDITION_LABELS[returnItem.condition]}` : '-'}
                          {' - '}
                          {item.notes || '-'}
                        </p>
                      </div>
                    )
                  })}
                  {selectedRecord.items.length === 0 && (
                    <p className="muted shipment-empty-state">Bu Waybill için item kaydı yok.</p>
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
              <p className="muted shipment-empty-state">Waybill kaydı bulunamadı.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
