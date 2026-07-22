import React from 'react'
import {
  SHIPMENT_PLAN_STATUSES,
  SHIPMENT_PLAN_STATUS_LABELS,
  SHIPMENT_PLAN_STOP_STATUSES,
  SHIPMENT_PLAN_STOP_STATUS_LABELS,
  getNextShipmentPlanNo,
  loadShipmentPlanRecords,
  saveShipmentPlanRecords
} from '../shipment-plans/shipment-plan.mock'
import {
  getShipmentPlanActiveVehicleIds,
  isShipmentPlanActive,
  validateShipmentPlan
} from '../shipment-plans/shipment-plan.service'
import type {
  ShipmentPlanRecord,
  ShipmentPlanStatus,
  ShipmentPlanStop,
  ShipmentPlanStopStatus
} from '../shipment-plans/shipment-plan.types'
import { loadShipmentVehicleRecords } from '../shipment-vehicles/shipment-vehicle.mock'
import type { ShipmentVehicleLoad, ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import {
  SHIPMENT_PALLET_STATUS_LABELS,
  loadShipmentPalletRecords
} from '../shipment-pallets/shipment-pallet.mock'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import { loadShipmentWorkOrderRecords } from '../shipment-work-orders/shipment-work-order.mock'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import { loadInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
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
type StatusFilter = ShipmentPlanStatus | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentPlanInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  workOrders: ShipmentWorkOrderRecord[]
  pallets: ShipmentPalletRecord[]
  vehicles: ShipmentVehicleRecord[]
  plans: ShipmentPlanRecord[]
}

type PlanFormStopState = {
  id: string
  branchId: string
  vehicleLoadId: string
  stopOrder: string
  estimatedArrival: string
  estimatedDeparture: string
  status: ShipmentPlanStopStatus
  notes: string
}

type PlanFormState = {
  shipmentPlanNo: string
  vehicleId: string
  planDate: string
  plannedDepartureTime: string
  plannedArrivalTime: string
  plannedReturnTime: string
  status: ShipmentPlanStatus
  driverName: string
  notes: string
  stops: PlanFormStopState[]
}

type Message = {
  type: 'success' | 'error'
  text: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const formatWeight = (value: number) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} kg`
)

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatTime = (value: string) => value || '-'

const getStatusClass = (status: ShipmentPlanStatus) => {
  if(status === 'READY' || status === 'COMPLETED') return 'success'
  if(status === 'DEPARTED' || status === 'IN_PROGRESS') return 'info-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getStopStatusClass = (status: ShipmentPlanStopStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'ARRIVED') return 'info-pill'
  if(status === 'ON_ROUTE') return 'warning-pill'
  if(status === 'SKIPPED') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentPlanInitialData => {
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

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    workOrders,
    pallets,
    vehicles,
    plans
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

const getVehicleLabel = (
  vehicleId: string,
  vehicleMap: Map<string, ShipmentVehicleRecord>
) => {
  const vehicle = vehicleMap.get(vehicleId)
  if(!vehicle) return 'Vehicle bulunamadı'
  return `${vehicle.vehicleNo} - ${vehicle.plateNumber || vehicle.vehicleName || 'Araç'}`
}

const getWorkOrderLabel = (
  workOrderId: string,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
) => {
  const workOrder = workOrderMap.get(workOrderId)
  return workOrder ? `${workOrder.workOrderNo} - ${workOrder.title}` : 'Work Order bulunamadı'
}

const getVehicleLoadBranchId = (
  load: ShipmentVehicleLoad | null,
  palletMap: Map<string, ShipmentPalletRecord>,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
) => {
  if(!load) return ''
  const pallet = palletMap.get(load.palletId)
  const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) : null
  return workOrder?.destinationBranchId || ''
}

const getVehicleLoadLabel = (
  load: ShipmentVehicleLoad,
  palletMap: Map<string, ShipmentPalletRecord>
) => {
  const pallet = palletMap.get(load.palletId)
  return `${pallet?.palletNo || 'Pallet'} - ${formatWeight(load.loadedWeight)}`
}

const getAvailableVehicles = (
  vehicles: ShipmentVehicleRecord[],
  plans: ShipmentPlanRecord[],
  ignoredPlanId = ''
) => {
  const activeVehicleIds = getShipmentPlanActiveVehicleIds(plans, ignoredPlanId)
  return vehicles.filter(vehicle => (
    vehicle.status === 'READY'
    && vehicle.loads.length > 0
    && !activeVehicleIds.has(vehicle.id)
  ))
}

const createFormStop = (
  load: ShipmentVehicleLoad | null,
  stopOrder: number,
  palletMap: Map<string, ShipmentPalletRecord>,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
): PlanFormStopState => ({
  id: createId('shipment_plan_form_stop'),
  branchId: getVehicleLoadBranchId(load, palletMap, workOrderMap),
  vehicleLoadId: load?.id || '',
  stopOrder: String(stopOrder),
  estimatedArrival: '09:30',
  estimatedDeparture: '09:50',
  status: 'WAITING',
  notes: ''
})

const createInitialStopsForVehicle = (
  vehicle: ShipmentVehicleRecord | null,
  palletMap: Map<string, ShipmentPalletRecord>,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
) => {
  if(!vehicle || vehicle.loads.length === 0) return []
  const stopCount = Math.min(2, Math.max(1, vehicle.loads.length))
  return Array.from({ length: stopCount }, (_, index) => (
    createFormStop(vehicle.loads[index % vehicle.loads.length], index + 1, palletMap, workOrderMap)
  ))
}

const createEmptyForm = (
  records: ShipmentPlanRecord[],
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[],
  workOrders: ShipmentWorkOrderRecord[]
): PlanFormState => {
  const palletMap = new Map(pallets.map(pallet => [pallet.id, pallet]))
  const workOrderMap = new Map(workOrders.map(workOrder => [workOrder.id, workOrder]))
  const firstVehicle = getAvailableVehicles(vehicles, records)[0] || null

  return {
    shipmentPlanNo: getNextShipmentPlanNo(records),
    vehicleId: firstVehicle?.id || '',
    planDate: getTodayKey(),
    plannedDepartureTime: '08:30',
    plannedArrivalTime: '11:30',
    plannedReturnTime: '15:30',
    status: 'PLANNED',
    driverName: firstVehicle?.driverName || '',
    notes: '',
    stops: createInitialStopsForVehicle(firstVehicle, palletMap, workOrderMap)
  }
}

const createFormFromRecord = (record: ShipmentPlanRecord): PlanFormState => ({
  shipmentPlanNo: record.shipmentPlanNo,
  vehicleId: record.vehicleId,
  planDate: record.planDate,
  plannedDepartureTime: record.plannedDepartureTime,
  plannedArrivalTime: record.plannedArrivalTime,
  plannedReturnTime: record.plannedReturnTime,
  status: record.status,
  driverName: record.driverName,
  notes: record.notes,
  stops: record.stops
    .slice()
    .sort((first, second) => first.stopOrder - second.stopOrder)
    .map(stop => ({
      id: stop.id,
      branchId: stop.branchId,
      vehicleLoadId: stop.vehicleLoadId,
      stopOrder: String(stop.stopOrder),
      estimatedArrival: stop.estimatedArrival,
      estimatedDeparture: stop.estimatedDeparture,
      status: stop.status,
      notes: stop.notes
    }))
})

const createPlanPayload = (
  form: PlanFormState,
  existingRecord?: ShipmentPlanRecord
): ShipmentPlanRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_plan')
  const stops = form.stops.map((stop): ShipmentPlanStop => {
    return {
      id: stop.id || createId('shipment_plan_stop'),
      shipmentPlanId: id,
      branchId: stop.branchId,
      vehicleLoadId: stop.vehicleLoadId,
      stopOrder: Number(stop.stopOrder),
      estimatedArrival: stop.estimatedArrival,
      estimatedDeparture: stop.estimatedDeparture,
      status: stop.status,
      notes: stop.notes.trim()
    }
  })

  return {
    id,
    shipmentPlanNo: form.shipmentPlanNo,
    vehicleId: form.vehicleId,
    planDate: form.planDate,
    plannedDepartureTime: form.plannedDepartureTime,
    plannedArrivalTime: form.plannedArrivalTime,
    plannedReturnTime: form.plannedReturnTime,
    status: form.status,
    driverName: form.driverName.trim(),
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    stops
  }
}

export default function ShipmentPlans({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentPlanRecord[]>(initialData.plans)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<PlanFormState>(() => createEmptyForm(
    initialData.plans,
    initialData.vehicles,
    initialData.pallets,
    initialData.workOrders
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [vehicleFilter, setVehicleFilter] = React.useState('all')
  const [planDateFilter, setPlanDateFilter] = React.useState('')

  const { branches, pallets, vehicles, workOrders } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const palletMap = React.useMemo(() => new Map(pallets.map(pallet => [pallet.id, pallet])), [pallets])
  const vehicleMap = React.useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle])), [vehicles])
  const workOrderMap = React.useMemo(() => new Map(workOrders.map(workOrder => [workOrder.id, workOrder])), [workOrders])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const editingIgnoredPlanId = editingRecordId || ''
  const activeVehicleIds = React.useMemo(() => (
    getShipmentPlanActiveVehicleIds(records, editingIgnoredPlanId)
  ), [editingIgnoredPlanId, records])
  const selectedFormVehicle = form.vehicleId ? vehicleMap.get(form.vehicleId) || null : null
  const selectedFormVehicleLoads = selectedFormVehicle?.loads || []
  const vehicleOptions = React.useMemo(() => (
    vehicles.filter(vehicle => (
      vehicle.status === 'READY'
      && (
        vehicle.id === form.vehicleId
        || (vehicle.loads.length > 0 && !activeVehicleIds.has(vehicle.id))
      )
    ))
  ), [activeVehicleIds, form.vehicleId, vehicles])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const vehicle = vehicleMap.get(record.vehicleId)
      const searchFields = [
        record.shipmentPlanNo,
        vehicle?.vehicleNo || '',
        vehicle?.plateNumber || '',
        record.driverName
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesVehicle = vehicleFilter === 'all' || record.vehicleId === vehicleFilter
      const matchesPlanDate = !planDateFilter || record.planDate === planDateFilter

      return matchesSearch && matchesStatus && matchesVehicle && matchesPlanDate
    })
  }, [planDateFilter, records, search, statusFilter, vehicleFilter, vehicleMap])

  const plannedCount = records.filter(record => record.status === 'PLANNED').length
  const activeCount = records.filter(record => isShipmentPlanActive(record.status)).length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const totalStopCount = records.reduce((total, record) => total + record.stops.length, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentPlanRecord[]) => {
    setRecords(nextRecords)
    saveShipmentPlanRecords(nextRecords, vehicles, pallets, workOrders)
  }, [pallets, vehicles, workOrders])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, vehicles, pallets, workOrders))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentPlanRecord) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const handleVehicleChange = (vehicleId: string) => {
    const vehicle = vehicleMap.get(vehicleId) || null
    setForm(prev => ({
      ...prev,
      vehicleId,
      driverName: vehicle?.driverName || '',
      stops: createInitialStopsForVehicle(vehicle, palletMap, workOrderMap)
    }))
  }

  const updateFormStop = (
    stopId: string,
    patch: Partial<PlanFormStopState>
  ) => {
    setForm(prev => ({
      ...prev,
      stops: prev.stops.map(stop => stop.id === stopId ? { ...stop, ...patch } : stop)
    }))
  }

  const handleVehicleLoadChange = (
    stopId: string,
    vehicleLoadId: string
  ) => {
    const load = selectedFormVehicleLoads.find(item => item.id === vehicleLoadId) || null
    updateFormStop(stopId, {
      vehicleLoadId,
      branchId: getVehicleLoadBranchId(load, palletMap, workOrderMap)
    })
  }

  const addFormStop = () => {
    setForm(prev => {
      const vehicle = vehicleMap.get(prev.vehicleId) || null
      const loads = vehicle?.loads || []
      const nextOrder = Math.max(0, ...prev.stops.map(stop => Number(stop.stopOrder) || 0)) + 1
      const load = loads.length > 0 ? loads[prev.stops.length % loads.length] : null

      return {
        ...prev,
        stops: [...prev.stops, createFormStop(load, nextOrder, palletMap, workOrderMap)]
      }
    })
  }

  const removeFormStop = (stopId: string) => {
    setForm(prev => ({
      ...prev,
      stops: prev.stops.filter(stop => stop.id !== stopId)
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextRecord = createPlanPayload(form, existingRecord)
    const validationError = validateShipmentPlan(nextRecord, vehicles, records)

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
    setMessage({ type: 'success', text: `${nextRecord.shipmentPlanNo} kaydedildi.` })
  }

  const updateRecordStatus = (record: ShipmentPlanRecord, status: ShipmentPlanStatus) => {
    const nextRecord: ShipmentPlanRecord = {
      ...record,
      status,
      updatedAt: new Date().toISOString()
    }
    const validationError = validateShipmentPlan(nextRecord, vehicles, records)

    if(validationError){
      setMessage({ type: 'error', text: validationError })
      return
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setMessage({ type: 'success', text: `${record.shipmentPlanNo} durumu güncellendi.` })
  }

  return (
    <div className="shipment-page shipment-plan-page">
      <div className="page-header">
        <div>
          <h2>Sevkiyat Planı</h2>
          <p className="muted">READY araçları gerçek sevkiyat turuna dönüştürün, durak sırasını ve tahmini saatleri yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          Plan Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Planlandı</span>
          <strong>{plannedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Plan</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Stop</span>
          <strong>{totalStopCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Shipment Plan Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-plan-toolbar">
            <input
              type="search"
              placeholder="Shipment Plan No, vehicle veya driver ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_PLAN_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_PLAN_STATUS_LABELS[status]}</option>
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
              value={planDateFilter}
              onChange={event => setPlanDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table shipment-plan-table">
              <thead>
                <tr>
                  <th>Shipment Plan No</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Plan Date</th>
                  <th>Stop Count</th>
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
                    <td data-label="Shipment Plan No">
                      <strong>{record.shipmentPlanNo}</strong>
                      <span className="muted">{record.stops.length} stop</span>
                    </td>
                    <td data-label="Vehicle">{getVehicleLabel(record.vehicleId, vehicleMap)}</td>
                    <td data-label="Driver">{record.driverName || '-'}</td>
                    <td data-label="Plan Date">{formatDate(record.planDate)}</td>
                    <td data-label="Stop Count">{record.stops.length}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_PLAN_STATUS_LABELS[record.status]}</span>
                    </td>
                  </tr>
                ))}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>Filtrelere uygun Shipment Plan bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'Plan Düzenle' : 'Yeni Plan'}</h3>
                    <p className="muted">READY aracı seçin, Vehicle Load kayıtlarını teslim duraklarına bağlayın.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Shipment Plan No</span>
                      <input value={form.shipmentPlanNo} disabled />
                    </label>
                    <label>
                      <span>Vehicle</span>
                      <select value={form.vehicleId} onChange={event => handleVehicleChange(event.target.value)}>
                        <option value="">Vehicle seçiniz</option>
                        {vehicleOptions.map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.vehicleNo} - {vehicle.plateNumber} - {vehicle.driverName || 'Driver yok'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Plan Date</span>
                      <input
                        type="date"
                        value={form.planDate}
                        onChange={event => setForm(prev => ({ ...prev, planDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentPlanStatus }))}
                      >
                        {SHIPMENT_PLAN_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_PLAN_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Departure Time</span>
                      <input
                        type="time"
                        value={form.plannedDepartureTime}
                        onChange={event => setForm(prev => ({ ...prev, plannedDepartureTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Arrival Time</span>
                      <input
                        type="time"
                        value={form.plannedArrivalTime}
                        onChange={event => setForm(prev => ({ ...prev, plannedArrivalTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Return Time</span>
                      <input
                        type="time"
                        value={form.plannedReturnTime}
                        onChange={event => setForm(prev => ({ ...prev, plannedReturnTime: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Driver</span>
                      <input
                        value={form.driverName}
                        onChange={event => setForm(prev => ({ ...prev, driverName: event.target.value }))}
                      />
                    </label>
                    <div>
                      <span>Stop Count</span>
                      <strong>{form.stops.length}</strong>
                    </div>
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
                    <h4>Stop Listesi</h4>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={addFormStop}
                      disabled={!form.vehicleId}
                    >
                      Stop Ekle
                    </button>
                  </div>
                  <div className="shipment-item-editor-list">
                    {form.stops.map((stop, index) => {
                      const load = selectedFormVehicleLoads.find(item => item.id === stop.vehicleLoadId) || null
                      const pallet = load ? palletMap.get(load.palletId) || null : null
                      const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) || null : null

                      return (
                        <div className="shipment-item-editor" key={stop.id}>
                          <label>
                            <span>Branch</span>
                            <select
                              value={stop.branchId}
                              onChange={event => updateFormStop(stop.id, { branchId: event.target.value })}
                            >
                              <option value="">Branch seçiniz</option>
                              {branches.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Stop Order</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={stop.stopOrder}
                              onChange={event => updateFormStop(stop.id, { stopOrder: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Vehicle Load</span>
                            <select
                              value={stop.vehicleLoadId}
                              onChange={event => handleVehicleLoadChange(stop.id, event.target.value)}
                            >
                              <option value="">Load seçiniz</option>
                              {selectedFormVehicleLoads.map(option => (
                                <option key={option.id} value={option.id}>{getVehicleLoadLabel(option, palletMap)}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Estimated Arrival</span>
                            <input
                              type="time"
                              value={stop.estimatedArrival}
                              onChange={event => updateFormStop(stop.id, { estimatedArrival: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Estimated Departure</span>
                            <input
                              type="time"
                              value={stop.estimatedDeparture}
                              onChange={event => updateFormStop(stop.id, { estimatedDeparture: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Status</span>
                            <select
                              value={stop.status}
                              onChange={event => updateFormStop(stop.id, { status: event.target.value as ShipmentPlanStopStatus })}
                            >
                              {SHIPMENT_PLAN_STOP_STATUSES.map(status => (
                                <option key={status} value={status}>{SHIPMENT_PLAN_STOP_STATUS_LABELS[status]}</option>
                              ))}
                            </select>
                          </label>
                          <label className="shipment-form-wide">
                            <span>Stop Notes</span>
                            <input
                              value={stop.notes}
                              onChange={event => updateFormStop(stop.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. stop</span>
                            <strong>{pallet ? `${pallet.palletNo} - ${formatWeight(load?.loadedWeight || 0)}` : 'Vehicle Load seçilmedi'}</strong>
                            <span>
                              Branch: {getBranchLabel(stop.branchId, branchMap, '-')}
                              {' - '}
                              Work Order: {workOrder ? getWorkOrderLabel(workOrder.id, workOrderMap) : '-'}
                              {' - '}
                              Pallet Status: {pallet ? SHIPMENT_PALLET_STATUS_LABELS[pallet.status] : '-'}
                            </span>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => removeFormStop(stop.id)}
                          >
                            Kaldır
                          </button>
                        </div>
                      )
                    })}
                    {form.stops.length === 0 && (
                      <p className="muted shipment-empty-state">Bu plan için Stop kaydı yok.</p>
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
                    <h3>{selectedRecord.shipmentPlanNo}</h3>
                    <p className="muted">{getVehicleLabel(selectedRecord.vehicleId, vehicleMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_PLAN_STATUS_LABELS[selectedRecord.status]}
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
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentPlanStatus)}
                    >
                      {SHIPMENT_PLAN_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_PLAN_STATUS_LABELS[status]}</option>
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
                    <span>Shipment Plan No</span>
                    <strong>{selectedRecord.shipmentPlanNo}</strong>
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
                    <span>Plan Date</span>
                    <strong>{formatDate(selectedRecord.planDate)}</strong>
                  </div>
                  <div>
                    <span>Departure Time</span>
                    <strong>{formatTime(selectedRecord.plannedDepartureTime)}</strong>
                  </div>
                  <div>
                    <span>Arrival Time</span>
                    <strong>{formatTime(selectedRecord.plannedArrivalTime)}</strong>
                  </div>
                  <div>
                    <span>Return Time</span>
                    <strong>{formatTime(selectedRecord.plannedReturnTime)}</strong>
                  </div>
                  <div>
                    <span>Stop Count</span>
                    <strong>{selectedRecord.stops.length}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Stop Listesi</h3>
                  <span className="status-pill muted-pill">{selectedRecord.stops.length} kayıt</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.stops
                    .slice()
                    .sort((first, second) => first.stopOrder - second.stopOrder)
                    .map(stop => {
                      const vehicle = vehicleMap.get(selectedRecord.vehicleId)
                      const load = vehicle?.loads.find(item => item.id === stop.vehicleLoadId) || null
                      const pallet = load ? palletMap.get(load.palletId) || null : null
                      const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) || null : null

                      return (
                        <div className="shipment-product-row" key={stop.id}>
                          <div>
                            <strong>{stop.stopOrder}. {getBranchLabel(stop.branchId, branchMap)}</strong>
                            <span>{workOrder ? getWorkOrderLabel(workOrder.id, workOrderMap) : '-'}</span>
                          </div>
                          <div>
                            <span className={`status-pill ${getStopStatusClass(stop.status)}`}>
                              {SHIPMENT_PLAN_STOP_STATUS_LABELS[stop.status]}
                            </span>
                            <strong>{load ? formatWeight(load.loadedWeight) : '-'}</strong>
                          </div>
                          <p>
                            Vehicle Load: {load ? getVehicleLoadLabel(load, palletMap) : '-'}
                            {' - '}
                            Estimated Arrival: {formatTime(stop.estimatedArrival)}
                            {' - '}
                            Estimated Departure: {formatTime(stop.estimatedDeparture)}
                            {' - '}
                            {stop.notes || '-'}
                          </p>
                        </div>
                      )
                    })}
                  {selectedRecord.stops.length === 0 && (
                    <p className="muted shipment-empty-state">Bu Shipment Plan için Stop kaydı yok.</p>
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
              <p className="muted shipment-empty-state">Shipment Plan kaydı bulunamadı.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
