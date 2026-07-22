import React from 'react'
import {
  SHIPMENT_VEHICLE_STATUSES,
  SHIPMENT_VEHICLE_STATUS_LABELS,
  SHIPMENT_VEHICLE_TYPES,
  SHIPMENT_VEHICLE_TYPE_LABELS,
  getNextShipmentVehicleNo,
  loadShipmentVehicleRecords,
  saveShipmentVehicleRecords
} from '../shipment-vehicles/shipment-vehicle.mock'
import {
  calculateShipmentVehicleUtilization,
  canEditShipmentVehicle,
  markShipmentVehicleReady,
  resolveShipmentVehicleCapacity,
  validateShipmentVehicle
} from '../shipment-vehicles/shipment-vehicle.service'
import type {
  ShipmentVehicleLoad,
  ShipmentVehicleRecord,
  ShipmentVehicleStatus,
  ShipmentVehicleType
} from '../shipment-vehicles/shipment-vehicle.types'
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
type StatusFilter = ShipmentVehicleStatus | FilterValue
type TypeFilter = ShipmentVehicleType | FilterValue
type PanelMode = 'detail' | 'form'

type ShipmentVehicleInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  workOrders: ShipmentWorkOrderRecord[]
  pallets: ShipmentPalletRecord[]
  vehicles: ShipmentVehicleRecord[]
}

type VehicleFormLoadState = {
  id: string
  palletId: string
  notes: string
}

type VehicleFormState = {
  vehicleNo: string
  plateNumber: string
  vehicleName: string
  vehicleType: ShipmentVehicleType
  maxWeight: string
  status: ShipmentVehicleStatus
  driverName: string
  notes: string
  loads: VehicleFormLoadState[]
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

const formatPercent = (value: number) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%`
)

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getStatusClass = (status: ShipmentVehicleStatus) => {
  if(status === 'READY' || status === 'DELIVERED') return 'success'
  if(status === 'LOADING') return 'warning-pill'
  if(status === 'IN_TRANSIT') return 'info-pill'
  if(status === 'MAINTENANCE') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): ShipmentVehicleInitialData => {
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

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    workOrders,
    pallets,
    vehicles
  }
}

const getBranchLabel = (branchId: string, branchMap: Map<string, Branch>, fallback = 'Kayıt bulunamadı') => {
  const branch = branchMap.get(branchId)
  return branch ? branch.name : fallback
}

const getPalletLabel = (
  palletId: string,
  palletMap: Map<string, ShipmentPalletRecord>
) => {
  const pallet = palletMap.get(palletId)
  return pallet ? pallet.palletNo : 'Pallet bulunamadı'
}

const getWorkOrderLabel = (
  workOrderId: string,
  workOrderMap: Map<string, ShipmentWorkOrderRecord>
) => {
  const workOrder = workOrderMap.get(workOrderId)
  return workOrder ? workOrder.workOrderNo : 'Work Order bulunamadı'
}

const getAssignedVehicleForPallet = (
  palletId: string,
  vehicles: ShipmentVehicleRecord[],
  ignoredVehicleId = ''
) => vehicles.find(vehicle => (
  vehicle.id !== ignoredVehicleId
  && vehicle.loads.some(load => load.palletId === palletId)
))

const getAvailablePallets = (
  pallets: ShipmentPalletRecord[],
  vehicles: ShipmentVehicleRecord[],
  ignoredVehicleId = ''
) => pallets.filter(pallet => (
  pallet.status === 'READY'
  && !getAssignedVehicleForPallet(pallet.id, vehicles, ignoredVehicleId)
))

const createFormLoad = (
  pallet: ShipmentPalletRecord | null
): VehicleFormLoadState => ({
  id: createId('shipment_vehicle_form_load'),
  palletId: pallet?.id || '',
  notes: ''
})

const createEmptyForm = (
  records: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[]
): VehicleFormState => {
  const firstReadyPallet = getAvailablePallets(pallets, records)[0] || null

  return {
    vehicleNo: getNextShipmentVehicleNo(records),
    plateNumber: '',
    vehicleName: '',
    vehicleType: 'TRUCK',
    maxWeight: '2500',
    status: 'AVAILABLE',
    driverName: '',
    notes: '',
    loads: firstReadyPallet ? [createFormLoad(firstReadyPallet)] : []
  }
}

const createFormFromRecord = (record: ShipmentVehicleRecord): VehicleFormState => ({
  vehicleNo: record.vehicleNo,
  plateNumber: record.plateNumber,
  vehicleName: record.vehicleName,
  vehicleType: record.vehicleType,
  maxWeight: String(record.maxWeight),
  status: record.status,
  driverName: record.driverName,
  notes: record.notes,
  loads: record.loads.map(load => ({
    id: load.id,
    palletId: load.palletId,
    notes: load.notes
  }))
})

const createVehiclePayload = (
  form: VehicleFormState,
  palletMap: Map<string, ShipmentPalletRecord>,
  existingRecord?: ShipmentVehicleRecord
): ShipmentVehicleRecord => {
  const now = new Date().toISOString()
  const id = existingRecord?.id || createId('shipment_vehicle')
  const existingLoadMap = new Map((existingRecord?.loads || []).map(load => [load.id, load]))
  const loads = form.loads.map((load): ShipmentVehicleLoad => {
    const pallet = palletMap.get(load.palletId)
    const existingLoad = existingLoadMap.get(load.id)

    return {
      id: load.id || createId('shipment_vehicle_load'),
      vehicleId: id,
      palletId: load.palletId,
      loadedWeight: pallet?.grossWeight || existingLoad?.loadedWeight || 0,
      loadedAt: existingLoad?.loadedAt || now,
      notes: load.notes.trim()
    }
  })

  return resolveShipmentVehicleCapacity({
    id,
    vehicleNo: form.vehicleNo,
    plateNumber: form.plateNumber.trim(),
    vehicleName: form.vehicleName.trim(),
    vehicleType: form.vehicleType,
    maxWeight: Number(form.maxWeight),
    currentWeight: existingRecord?.currentWeight || 0,
    status: form.status,
    driverName: form.driverName.trim(),
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
    loads
  }, Array.from(palletMap.values()))
}

export default function ShipmentVehicles({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentVehicleRecord[]>(initialData.vehicles)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<VehicleFormState>(() => createEmptyForm(
    initialData.vehicles,
    initialData.pallets
  ))
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const { branches, pallets, workOrders } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const palletMap = React.useMemo(() => new Map(pallets.map(pallet => [pallet.id, pallet])), [pallets])
  const workOrderMap = React.useMemo(() => new Map(workOrders.map(workOrder => [workOrder.id, workOrder])), [workOrders])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const editingIgnoredVehicleId = editingRecordId || ''
  const availablePallets = React.useMemo(() => (
    getAvailablePallets(pallets, records, editingIgnoredVehicleId)
  ), [editingIgnoredVehicleId, pallets, records])
  const formLoadsForWeight = React.useMemo(() => (
    form.loads.map(load => ({
      loadedWeight: palletMap.get(load.palletId)?.grossWeight || 0
    }))
  ), [form.loads, palletMap])
  const formCurrentWeight = formLoadsForWeight.reduce((total, load) => total + load.loadedWeight, 0)
  const formMaxWeight = Number(form.maxWeight) || 0
  const formUtilization = calculateShipmentVehicleUtilization(formCurrentWeight, formMaxWeight)

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const searchFields = [
        record.vehicleNo,
        record.plateNumber,
        record.driverName
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesType = typeFilter === 'all' || record.vehicleType === typeFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesType && matchesStatus
    })
  }, [records, search, statusFilter, typeFilter])

  const availableCount = records.filter(record => record.status === 'AVAILABLE').length
  const loadingCount = records.filter(record => record.status === 'LOADING').length
  const readyCount = records.filter(record => record.status === 'READY').length
  const totalCurrentWeight = records.reduce((total, record) => total + record.currentWeight, 0)

  const commitRecords = React.useCallback((nextRecords: ShipmentVehicleRecord[]) => {
    setRecords(nextRecords)
    saveShipmentVehicleRecords(nextRecords, pallets)
  }, [pallets])

  const openCreateForm = () => {
    setForm(createEmptyForm(records, pallets))
    setEditingRecordId('')
    setFormError('')
    setMessage(null)
    setPanelMode('form')
  }

  const openEditForm = (record: ShipmentVehicleRecord) => {
    if(!canEditShipmentVehicle(record)){
      setMessage({ type: 'error', text: 'READY durumundaki araç değiştirilemez.' })
      return
    }

    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setFormError('')
    setMessage(null)
    setPanelMode('form')
    setSelectedRecordId(record.id)
  }

  const updateFormLoad = (
    loadId: string,
    patch: Partial<VehicleFormLoadState>
  ) => {
    setForm(prev => ({
      ...prev,
      loads: prev.loads.map(load => load.id === loadId ? { ...load, ...patch } : load)
    }))
  }

  const addFormLoad = () => {
    const selectedPalletIds = new Set(form.loads.map(load => load.palletId))
    const nextPallet = availablePallets.find(pallet => !selectedPalletIds.has(pallet.id)) || availablePallets[0] || null
    setForm(prev => ({
      ...prev,
      loads: [...prev.loads, createFormLoad(nextPallet)]
    }))
  }

  const removeFormLoad = (loadId: string) => {
    setForm(prev => ({
      ...prev,
      loads: prev.loads.filter(load => load.id !== loadId)
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined

    if(existingRecord && !canEditShipmentVehicle(existingRecord)){
      setFormError('READY durumundaki araç değiştirilemez.')
      return
    }

    const nextRecord = createVehiclePayload(form, palletMap, existingRecord)
    const validationError = validateShipmentVehicle(nextRecord, pallets, records)

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
    setMessage({ type: 'success', text: `${nextRecord.vehicleNo} kaydedildi.` })
  }

  const updateRecordStatus = (record: ShipmentVehicleRecord, status: ShipmentVehicleStatus) => {
    if(!canEditShipmentVehicle(record)){
      setMessage({ type: 'error', text: 'READY durumundaki araç değiştirilemez.' })
      return
    }

    const nextRecord = resolveShipmentVehicleCapacity({
      ...record,
      status,
      updatedAt: new Date().toISOString()
    }, pallets)
    const validationError = validateShipmentVehicle(nextRecord, pallets, records)

    if(validationError){
      setMessage({ type: 'error', text: validationError })
      return
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    setMessage({ type: 'success', text: `${record.vehicleNo} durumu güncellendi.` })
  }

  const markReady = (record: ShipmentVehicleRecord) => {
    try{
      const nextRecord = markShipmentVehicleReady(record, pallets, records)
      commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
      setSelectedRecordId(record.id)
      setMessage({ type: 'success', text: `${record.vehicleNo} sevkiyata hazır.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Araç READY yapılamadı.' })
    }
  }

  return (
    <div className="shipment-page shipment-vehicle-page">
      <div className="page-header">
        <div>
          <h2>Araç Planlama</h2>
          <p className="muted">READY paletleri sevkiyat araçlarına atayın, kapasite ve doluluk oranını takip edin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          Araç Oluştur
        </button>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Müsait</span>
          <strong>{availableCount}</strong>
        </div>
        <div className="metric-card">
          <span>Yükleniyor</span>
          <strong>{loadingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ready</span>
          <strong>{readyCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Yük</span>
          <strong>{formatWeight(totalCurrentWeight)}</strong>
        </div>
      </div>

      <div className="product-layout shipment-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Vehicle Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-vehicle-toolbar">
            <input
              type="search"
              placeholder="Vehicle No, plate veya driver ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TypeFilter)}>
              <option value="all">Tüm Vehicle Type</option>
              {SHIPMENT_VEHICLE_TYPES.map(type => (
                <option key={type} value={type}>{SHIPMENT_VEHICLE_TYPE_LABELS[type]}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_VEHICLE_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_VEHICLE_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap shipment-table-wrap">
            <table className="data-table shipment-table shipment-vehicle-table">
              <thead>
                <tr>
                  <th>Vehicle No</th>
                  <th>Plate</th>
                  <th>Vehicle Type</th>
                  <th>Driver</th>
                  <th>Current Weight</th>
                  <th>Capacity</th>
                  <th>Utilization %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(record => {
                  const utilization = calculateShipmentVehicleUtilization(record.currentWeight, record.maxWeight)

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
                      <td data-label="Vehicle No">
                        <strong>{record.vehicleNo}</strong>
                        <span className="muted">{record.loads.length} pallet</span>
                      </td>
                      <td data-label="Plate">{record.plateNumber || '-'}</td>
                      <td data-label="Vehicle Type">{SHIPMENT_VEHICLE_TYPE_LABELS[record.vehicleType]}</td>
                      <td data-label="Driver">{record.driverName || '-'}</td>
                      <td data-label="Current Weight">{formatWeight(record.currentWeight)}</td>
                      <td data-label="Capacity">{formatWeight(record.maxWeight)}</td>
                      <td data-label="Utilization %">{formatPercent(utilization)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>{SHIPMENT_VEHICLE_STATUS_LABELS[record.status]}</span>
                      </td>
                    </tr>
                  )
                })}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={8}>Filtrelere uygun Vehicle bulunamadı.</td>
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
                    <h3>{editingRecordId ? 'Araç Düzenle' : 'Yeni Araç'}</h3>
                    <p className="muted">Araç kapasitesini tanımlayın ve READY paletleri yük planına alın.</p>
                  </div>
                </div>

                {formError && <div className="form-error">{formError}</div>}

                <div className="shipment-form-section">
                  <h4>Genel Bilgiler</h4>
                  <div className="shipment-form-grid">
                    <label>
                      <span>Vehicle No</span>
                      <input value={form.vehicleNo} disabled />
                    </label>
                    <label>
                      <span>Plate Number</span>
                      <input
                        value={form.plateNumber}
                        onChange={event => setForm(prev => ({ ...prev, plateNumber: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Vehicle Name</span>
                      <input
                        value={form.vehicleName}
                        onChange={event => setForm(prev => ({ ...prev, vehicleName: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Vehicle Type</span>
                      <select
                        value={form.vehicleType}
                        onChange={event => setForm(prev => ({ ...prev, vehicleType: event.target.value as ShipmentVehicleType }))}
                      >
                        {SHIPMENT_VEHICLE_TYPES.map(type => (
                          <option key={type} value={type}>{SHIPMENT_VEHICLE_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Capacity</span>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={form.maxWeight}
                        onChange={event => setForm(prev => ({ ...prev, maxWeight: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={event => setForm(prev => ({ ...prev, status: event.target.value as ShipmentVehicleStatus }))}
                      >
                        {SHIPMENT_VEHICLE_STATUSES.map(status => (
                          <option key={status} value={status}>{SHIPMENT_VEHICLE_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Driver</span>
                      <input
                        value={form.driverName}
                        onChange={event => setForm(prev => ({ ...prev, driverName: event.target.value }))}
                      />
                    </label>
                    <div>
                      <span>Current Weight</span>
                      <strong>{formatWeight(formCurrentWeight)}</strong>
                    </div>
                    <div>
                      <span>Utilization</span>
                      <strong>{formatPercent(formUtilization)}</strong>
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
                    <h4>Vehicle Loads</h4>
                    <button className="ghost-button" type="button" onClick={addFormLoad}>
                      Pallet Ekle
                    </button>
                  </div>
                  <div className="shipment-item-editor-list">
                    {form.loads.map((load, index) => {
                      const pallet = palletMap.get(load.palletId)
                      const availableOptions = pallets.filter(item => (
                        item.id === load.palletId
                        || (
                          item.status === 'READY'
                          && !getAssignedVehicleForPallet(item.id, records, editingIgnoredVehicleId)
                        )
                      ))
                      const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) : null

                      return (
                        <div className="shipment-item-editor" key={load.id}>
                          <label>
                            <span>Pallet</span>
                            <select
                              value={load.palletId}
                              onChange={event => updateFormLoad(load.id, { palletId: event.target.value })}
                            >
                              <option value="">Pallet seçiniz</option>
                              {availableOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                  {option.palletNo} · {formatWeight(option.grossWeight)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Loaded Weight</span>
                            <input value={pallet ? formatWeight(pallet.grossWeight) : '-'} disabled />
                          </label>
                          <label className="shipment-form-wide">
                            <span>Load Notes</span>
                            <input
                              value={load.notes}
                              onChange={event => updateFormLoad(load.id, { notes: event.target.value })}
                            />
                          </label>
                          <div className="shipment-item-meta">
                            <span>{index + 1}. pallet</span>
                            <strong>{pallet ? `${pallet.palletNo} · ${getBranchLabel(pallet.warehouseId, branchMap)}` : 'Pallet seçilmedi'}</strong>
                            <span>
                              Status: {pallet ? SHIPMENT_PALLET_STATUS_LABELS[pallet.status] : '-'}
                              {' · '}
                              Work Order: {workOrder ? workOrder.workOrderNo : '-'}
                            </span>
                          </div>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => removeFormLoad(load.id)}
                          >
                            Kaldır
                          </button>
                        </div>
                      )
                    })}
                    {form.loads.length === 0 && (
                      <p className="muted shipment-empty-state">Yük planına alınmış Pallet yok.</p>
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
                    <h3>{selectedRecord.vehicleNo}</h3>
                    <p className="muted">{selectedRecord.plateNumber || selectedRecord.vehicleName || '-'}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_VEHICLE_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-side-actions shipment-vehicle-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => openEditForm(selectedRecord)}
                    disabled={!canEditShipmentVehicle(selectedRecord)}
                  >
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
                      onChange={event => updateRecordStatus(selectedRecord, event.target.value as ShipmentVehicleStatus)}
                      disabled={!canEditShipmentVehicle(selectedRecord)}
                    >
                      {SHIPMENT_VEHICLE_STATUSES.map(status => (
                        <option key={status} value={status}>{SHIPMENT_VEHICLE_STATUS_LABELS[status]}</option>
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
                    <span>Vehicle No</span>
                    <strong>{selectedRecord.vehicleNo}</strong>
                  </div>
                  <div>
                    <span>Plate Number</span>
                    <strong>{selectedRecord.plateNumber || '-'}</strong>
                  </div>
                  <div>
                    <span>Driver</span>
                    <strong>{selectedRecord.driverName || '-'}</strong>
                  </div>
                  <div>
                    <span>Vehicle Type</span>
                    <strong>{SHIPMENT_VEHICLE_TYPE_LABELS[selectedRecord.vehicleType]}</strong>
                  </div>
                  <div>
                    <span>Capacity</span>
                    <strong>{formatWeight(selectedRecord.maxWeight)}</strong>
                  </div>
                  <div>
                    <span>Current Weight</span>
                    <strong>{formatWeight(selectedRecord.currentWeight)}</strong>
                  </div>
                  <div>
                    <span>Utilization</span>
                    <strong>{formatPercent(calculateShipmentVehicleUtilization(selectedRecord.currentWeight, selectedRecord.maxWeight))}</strong>
                  </div>
                  <div>
                    <span>Loaded Pallets</span>
                    <strong>{selectedRecord.loads.length}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-detail-card">
                <div className="section-header">
                  <h3>Loaded Pallets</h3>
                  <span className="status-pill muted-pill">{selectedRecord.loads.length} kayıt</span>
                </div>
                <div className="shipment-product-list">
                  {selectedRecord.loads.map(load => {
                    const pallet = palletMap.get(load.palletId)
                    const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) : null

                    return (
                      <div className="shipment-product-row" key={load.id}>
                        <div>
                          <strong>{getPalletLabel(load.palletId, palletMap)}</strong>
                          <span>{workOrder ? getWorkOrderLabel(workOrder.id, workOrderMap) : '-'}</span>
                        </div>
                        <div>
                          <span>{pallet ? SHIPMENT_PALLET_STATUS_LABELS[pallet.status] : '-'}</span>
                          <strong>{formatWeight(load.loadedWeight)}</strong>
                        </div>
                        <p>
                          Warehouse: {pallet ? getBranchLabel(pallet.warehouseId, branchMap) : '-'}
                          {' · '}
                          Loaded At: {formatDate(load.loadedAt)}
                          {' · '}
                          {load.notes || '-'}
                        </p>
                      </div>
                    )
                  })}
                  {selectedRecord.loads.length === 0 && (
                    <p className="muted shipment-empty-state">Bu araçta yüklü Pallet yok.</p>
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
              <p className="muted">Henüz Vehicle kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
