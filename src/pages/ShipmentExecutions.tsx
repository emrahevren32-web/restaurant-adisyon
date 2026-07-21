import React from 'react'
import {
  SHIPMENT_DELIVERY_RESULT_LABELS,
  SHIPMENT_DELIVERY_RESULTS,
  SHIPMENT_EXECUTION_ITEM_STATUS_LABELS,
  SHIPMENT_EXECUTION_STATUS_LABELS,
  SHIPMENT_EXECUTION_STATUSES,
  canCreateShipmentExecution,
  createShipmentExecutionFromShipment,
  loadShipmentExecutionRecords,
  saveShipmentExecutionRecords
} from '../shipment-executions/shipment-execution.mock'
import {
  cancelShipmentExecution,
  completeShipmentPacking,
  completeShipmentPicking,
  deliverShipmentExecution,
  shipShipmentExecution,
  startShipmentPacking,
  startShipmentPicking
} from '../shipment-executions/shipment-execution.service'
import type {
  ShipmentDeliveryResult,
  ShipmentExecutionRecord,
  ShipmentExecutionStatus
} from '../shipment-executions/shipment-execution.types'
import {
  SHIPMENT_STATUS_LABELS,
  loadShipmentRecords,
  saveShipmentRecords
} from '../shipments/shipment.mock'
import type { ShipmentRecord, ShipmentStatus } from '../shipments/shipment.types'
import {
  INVENTORY_LOT_STATUS_LABELS,
  loadInventoryLotRecords,
  saveInventoryLotRecords
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
type StatusFilter = ShipmentExecutionStatus | FilterValue
type DeliveryResultFilter = ShipmentDeliveryResult | 'none' | FilterValue

type ShipmentExecutionInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  executions: ShipmentExecutionRecord[]
}

type QuantityInputMap = Record<string, {
  pickedQuantity: string
  packedQuantity: string
  deliveredQuantity: string
}>

type Message = {
  type: 'success' | 'error'
  text: string
}

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalizedValue)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return formatDate(value)
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getStatusClass = (status: ShipmentExecutionStatus) => {
  if(status === 'DELIVERED') return 'success'
  if(status === 'SHIPPED' || status === 'PARTIALLY_DELIVERED') return 'info-pill'
  if(status === 'PICKING' || status === 'PACKING' || status === 'READY_TO_SHIP') return 'warning-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getShipmentStatusFromExecution = (status: ShipmentExecutionStatus): ShipmentStatus => {
  if(status === 'PICKING' || status === 'PACKING') return 'PICKING'
  if(status === 'READY_TO_SHIP') return 'READY'
  if(status === 'SHIPPED' || status === 'PARTIALLY_DELIVERED') return 'SHIPPED'
  if(status === 'DELIVERED') return 'DELIVERED'
  if(status === 'CANCELLED') return 'CANCELLED'
  return 'PLANNED'
}

const loadInitialData = (): ShipmentExecutionInitialData => {
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
  const executions = loadShipmentExecutionRecords(shipments)

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    executions
  }
}

const getBranchLabel = (branchId: string, branchMap: Map<string, Branch>, fallback = 'Kayıt bulunamadı') => {
  const branch = branchMap.get(branchId)
  return branch ? branch.name : fallback
}

const getDestinationLabel = (shipment: ShipmentRecord | null, branchMap: Map<string, Branch>) => {
  if(!shipment) return 'Shipment bulunamadı'
  const branchLabel = shipment.destinationBranchId
    ? getBranchLabel(shipment.destinationBranchId, branchMap)
    : ''
  const warehouseLabel = shipment.destinationWarehouseId
    ? getBranchLabel(shipment.destinationWarehouseId, branchMap)
    : ''

  if(branchLabel && warehouseLabel) return `${branchLabel} / ${warehouseLabel}`
  return branchLabel || warehouseLabel || 'Hedef seçilmemiş'
}

const getStockItemLabel = (stockItemId: string, stockItemMap: Map<string, StockItem>) => {
  const stockItem = stockItemMap.get(stockItemId)
  return stockItem ? stockItem.name : 'Stock Item bulunamadı'
}

const createQuantityInputs = (execution: ShipmentExecutionRecord | null): QuantityInputMap => {
  if(!execution) return {}

  return Object.fromEntries(execution.items.map(item => [
    item.id,
    {
      pickedQuantity: String(item.pickedQuantity || item.plannedQuantity),
      packedQuantity: String(item.packedQuantity || item.pickedQuantity || item.plannedQuantity),
      deliveredQuantity: String(item.deliveredQuantity || item.shippedQuantity)
    }
  ]))
}

export default function ShipmentExecutions({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ShipmentExecutionRecord[]>(initialData.executions)
  const [shipments, setShipments] = React.useState<ShipmentRecord[]>(initialData.shipments)
  const [inventoryLots, setInventoryLots] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [deliveryResultFilter, setDeliveryResultFilter] = React.useState<DeliveryResultFilter>('all')
  const [createShipmentId, setCreateShipmentId] = React.useState('')
  const [quantityInputs, setQuantityInputs] = React.useState<QuantityInputMap>({})
  const [deliveryNotes, setDeliveryNotes] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)

  const { branches, stockItems } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const shipmentMap = React.useMemo(() => new Map(shipments.map(shipment => [shipment.id, shipment])), [shipments])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])
  const selectedShipment = selectedRecord ? shipmentMap.get(selectedRecord.shipmentId) || null : null

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  React.useEffect(() => {
    setQuantityInputs(createQuantityInputs(selectedRecord))
    setDeliveryNotes(selectedRecord?.deliveryNotes || '')
  }, [selectedRecord])

  const availableShipments = React.useMemo(() => (
    shipments.filter(shipment => canCreateShipmentExecution(shipment, records))
  ), [records, shipments])

  React.useEffect(() => {
    if(createShipmentId && availableShipments.some(shipment => shipment.id === createShipmentId)) return
    setCreateShipmentId(availableShipments[0]?.id || '')
  }, [availableShipments, createShipmentId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const shipment = shipmentMap.get(record.shipmentId) || null
      const destinationLabel = getDestinationLabel(shipment, branchMap)
      const searchFields = [
        record.executionNo,
        shipment?.shipmentNo || '',
        destinationLabel
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesWarehouse = warehouseFilter === 'all'
        || shipment?.sourceWarehouseId === warehouseFilter
        || shipment?.destinationWarehouseId === warehouseFilter
      const matchesBranch = branchFilter === 'all' || shipment?.destinationBranchId === branchFilter
      const matchesDeliveryResult = deliveryResultFilter === 'all'
        || (deliveryResultFilter === 'none' && !record.deliveryResult)
        || record.deliveryResult === deliveryResultFilter

      return matchesSearch && matchesStatus && matchesWarehouse && matchesBranch && matchesDeliveryResult
    })
  }, [branchFilter, branchMap, deliveryResultFilter, records, search, shipmentMap, statusFilter, warehouseFilter])

  const pendingCount = records.filter(record => record.status === 'PENDING').length
  const activeCount = records.filter(record => (
    record.status === 'PICKING'
    || record.status === 'PACKING'
    || record.status === 'READY_TO_SHIP'
    || record.status === 'SHIPPED'
  )).length
  const partialCount = records.filter(record => record.status === 'PARTIALLY_DELIVERED').length
  const deliveredCount = records.filter(record => record.status === 'DELIVERED').length

  const commitRecords = React.useCallback((nextRecords: ShipmentExecutionRecord[]) => {
    setRecords(nextRecords)
    saveShipmentExecutionRecords(nextRecords)
  }, [])

  const commitShipments = React.useCallback((nextShipments: ShipmentRecord[]) => {
    setShipments(nextShipments)
    saveShipmentRecords(nextShipments)
  }, [])

  const commitInventoryLots = React.useCallback((nextLots: InventoryLot[]) => {
    setInventoryLots(nextLots)
    saveInventoryLotRecords(nextLots)
  }, [])

  const updateShipmentStatus = (shipment: ShipmentRecord, executionStatus: ShipmentExecutionStatus) => {
    const nextStatus = getShipmentStatusFromExecution(executionStatus)
    const now = new Date().toISOString()
    const nextShipments = shipments.map(item => (
      item.id === shipment.id
        ? { ...item, status: nextStatus, updatedAt: now }
        : item
    ))
    commitShipments(nextShipments)
  }

  const commitExecutionUpdate = (
    nextExecution: ShipmentExecutionRecord,
    successMessage: string
  ) => {
    const nextRecords = records.map(record => record.id === nextExecution.id ? nextExecution : record)
    commitRecords(nextRecords)
    setSelectedRecordId(nextExecution.id)
    if(selectedShipment) updateShipmentStatus(selectedShipment, nextExecution.status)
    setMessage({ type: 'success', text: successMessage })
  }

  const runAction = (
    action: () => ShipmentExecutionRecord,
    successMessage: string
  ) => {
    if(!selectedRecord){
      setMessage({ type: 'error', text: 'Shipment Execution seçilmelidir.' })
      return
    }

    try{
      const nextExecution = action()
      commitExecutionUpdate(nextExecution, successMessage)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })
    }
  }

  const createExecution = () => {
    const shipment = shipments.find(item => item.id === createShipmentId)
    if(!shipment){
      setMessage({ type: 'error', text: 'Execution oluşturmak için uygun Shipment bulunamadı.' })
      return
    }

    if(!canCreateShipmentExecution(shipment, records)){
      setMessage({ type: 'error', text: 'Her Shipment yalnızca bir Shipment Execution oluşturabilir.' })
      return
    }

    const nextRecord = createShipmentExecutionFromShipment(shipment, records, currentUser.fullName || currentUser.username)
    const nextRecords = [nextRecord, ...records]
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setMessage({ type: 'success', text: `${nextRecord.executionNo} oluşturuldu.` })
  }

  const getPickedQuantityPatch = () => Object.fromEntries((selectedRecord?.items || []).map(item => [
    item.id,
    Number(quantityInputs[item.id]?.pickedQuantity || item.plannedQuantity)
  ]))

  const getPackedQuantityPatch = () => Object.fromEntries((selectedRecord?.items || []).map(item => [
    item.id,
    Number(quantityInputs[item.id]?.packedQuantity || item.pickedQuantity)
  ]))

  const getDeliveredQuantityPatch = (fullDelivery: boolean) => Object.fromEntries((selectedRecord?.items || []).map(item => [
    item.id,
    fullDelivery
      ? item.shippedQuantity
      : Number(quantityInputs[item.id]?.deliveredQuantity || item.deliveredQuantity)
  ]))

  const runShipAction = () => {
    if(!selectedRecord || !selectedShipment){
      setMessage({ type: 'error', text: 'Shipment Execution ve Shipment zorunludur.' })
      return
    }

    try{
      const result = shipShipmentExecution({
        execution: selectedRecord,
        shipment: selectedShipment,
        inventoryLots,
        user: currentUser,
        warehouseLabel: warehouseId => getBranchLabel(warehouseId, branchMap)
      })

      commitInventoryLots(result.inventoryLots)
      commitExecutionUpdate(result.execution, `${selectedRecord.executionNo} sevkiyata başladı. ${result.movements.length} stok çıkış hareketi oluştu.`)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Sevkiyat başlatılamadı.' })
    }
  }

  const runDeliveryAction = (fullDelivery: boolean) => {
    if(!selectedRecord || !selectedShipment){
      setMessage({ type: 'error', text: 'Shipment Execution ve Shipment zorunludur.' })
      return
    }

    try{
      const result = deliverShipmentExecution({
        execution: selectedRecord,
        shipment: selectedShipment,
        inventoryLots,
        deliveredQuantities: getDeliveredQuantityPatch(fullDelivery),
        deliveryResult: fullDelivery ? 'SUCCESS' : 'PARTIAL',
        deliveryNotes,
        user: currentUser,
        warehouseLabel: warehouseId => getBranchLabel(warehouseId, branchMap)
      })

      commitInventoryLots(result.inventoryLots)
      commitExecutionUpdate(
        result.execution,
        `${selectedRecord.executionNo} teslim işlendi. ${result.movements.length} stok giriş hareketi ve ${result.createdInventoryLots.length} hedef lot oluştu.`
      )
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Teslim işlemi tamamlanamadı.' })
    }
  }

  const updateQuantityInput = (
    itemId: string,
    field: keyof QuantityInputMap[string],
    value: string
  ) => {
    setQuantityInputs(prev => ({
      ...prev,
      [itemId]: {
        pickedQuantity: prev[itemId]?.pickedQuantity || '',
        packedQuantity: prev[itemId]?.packedQuantity || '',
        deliveredQuantity: prev[itemId]?.deliveredQuantity || '',
        [field]: value
      }
    }))
  }

  return (
    <div className="shipment-execution-page">
      <div className="page-header">
        <div>
          <h2>Sevkiyat Operasyonu</h2>
          <p className="muted">Picking, packing, shipping ve teslim operasyonlarını stok etkisiyle yönetin.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Operasyonda</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kısmi Teslim</span>
          <strong>{partialCount}</strong>
        </div>
        <div className="metric-card">
          <span>Teslim Edilen</span>
          <strong>{deliveredCount}</strong>
        </div>
      </div>

      <div className="product-layout shipment-execution-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Execution Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="shipment-execution-create-card">
            <select value={createShipmentId} onChange={event => setCreateShipmentId(event.target.value)}>
              {availableShipments.length === 0 && <option value="">Uygun Shipment yok</option>}
              {availableShipments.map(shipment => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.shipmentNo} · {getDestinationLabel(shipment, branchMap)}
                </option>
              ))}
            </select>
            <button className="primary-button" type="button" onClick={createExecution} disabled={availableShipments.length === 0}>
              Execution Oluştur
            </button>
          </div>

          <div className="shipment-execution-toolbar">
            <input
              type="search"
              placeholder="Execution No, Shipment No veya hedef ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SHIPMENT_EXECUTION_STATUSES.map(status => (
                <option key={status} value={status}>{SHIPMENT_EXECUTION_STATUS_LABELS[status]}</option>
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
            <select value={deliveryResultFilter} onChange={event => setDeliveryResultFilter(event.target.value as DeliveryResultFilter)}>
              <option value="all">Tüm Teslim Sonuçları</option>
              <option value="none">Sonuç Yok</option>
              {SHIPMENT_DELIVERY_RESULTS.map(result => (
                <option key={result} value={result}>{SHIPMENT_DELIVERY_RESULT_LABELS[result]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap shipment-execution-table-wrap">
            <table className="data-table shipment-execution-table">
              <thead>
                <tr>
                  <th>Execution No</th>
                  <th>Shipment No</th>
                  <th>Source Warehouse</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Shipment Date</th>
                  <th>Delivered Date</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(record => {
                  const shipment = shipmentMap.get(record.shipmentId) || null

                  return (
                    <tr
                      key={record.id}
                      aria-selected={selectedRecord?.id === record.id}
                      onClick={() => {
                        setSelectedRecordId(record.id)
                        setMessage(null)
                      }}
                    >
                      <td data-label="Execution No">
                        <strong>{record.executionNo}</strong>
                        <span className="muted">{record.items.length} kalem</span>
                      </td>
                      <td data-label="Shipment No">{shipment?.shipmentNo || 'Shipment bulunamadı'}</td>
                      <td data-label="Source Warehouse">{shipment ? getBranchLabel(shipment.sourceWarehouseId, branchMap) : '-'}</td>
                      <td data-label="Destination">{getDestinationLabel(shipment, branchMap)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {SHIPMENT_EXECUTION_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td data-label="Shipment Date">{formatDate(shipment?.shipmentDate || '')}</td>
                      <td data-label="Delivered Date">{formatDateTime(record.deliveredAt)}</td>
                    </tr>
                  )
                })}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun Shipment Execution bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side shipment-execution-side">
          {selectedRecord && selectedShipment ? (
            <>
              <section className="card shipment-execution-detail-card">
                <div className="section-header">
                  <div>
                    <h3>{selectedRecord.executionNo}</h3>
                    <p className="muted">{selectedShipment.shipmentNo} · {getDestinationLabel(selectedShipment, branchMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {SHIPMENT_EXECUTION_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="shipment-execution-action-grid">
                  {selectedRecord.status === 'PENDING' && (
                    <button className="primary-button" type="button" onClick={() => runAction(
                      () => startShipmentPicking(selectedRecord, currentUser),
                      `${selectedRecord.executionNo} picking başladı.`
                    )}>
                      Başlat Picking
                    </button>
                  )}
                  {selectedRecord.status === 'PICKING' && (
                    <>
                      <button className="primary-button" type="button" onClick={() => runAction(
                        () => completeShipmentPicking(selectedRecord, currentUser, getPickedQuantityPatch()),
                        `${selectedRecord.executionNo} picking tamamlandı.`
                      )}>
                        Picking Tamamla
                      </button>
                      <button className="ghost-button" type="button" onClick={() => runAction(
                        () => startShipmentPacking(selectedRecord, currentUser),
                        `${selectedRecord.executionNo} packing başladı.`
                      )}>
                        Packing Başlat
                      </button>
                    </>
                  )}
                  {selectedRecord.status === 'PACKING' && (
                    <button className="primary-button" type="button" onClick={() => runAction(
                      () => completeShipmentPacking(selectedRecord, currentUser, getPackedQuantityPatch()),
                      `${selectedRecord.executionNo} packing tamamlandı.`
                    )}>
                      Packing Tamamla
                    </button>
                  )}
                  {selectedRecord.status === 'READY_TO_SHIP' && (
                    <button className="primary-button" type="button" onClick={runShipAction}>
                      Sevkiyatı Başlat
                    </button>
                  )}
                  {(selectedRecord.status === 'SHIPPED' || selectedRecord.status === 'PARTIALLY_DELIVERED') && (
                    <>
                      <button className="primary-button" type="button" onClick={() => runDeliveryAction(true)}>
                        Teslim Et
                      </button>
                      <button className="ghost-button" type="button" onClick={() => runDeliveryAction(false)}>
                        Kısmi Teslim
                      </button>
                    </>
                  )}
                  {['PENDING', 'PICKING', 'PACKING', 'READY_TO_SHIP'].includes(selectedRecord.status) && (
                    <button className="ghost-button" type="button" onClick={() => runAction(
                      () => cancelShipmentExecution(selectedRecord, currentUser),
                      `${selectedRecord.executionNo} iptal edildi.`
                    )}>
                      İptal
                    </button>
                  )}
                </div>
              </section>

              <section className="card shipment-execution-detail-card">
                <div className="section-header">
                  <h3>Detay</h3>
                </div>
                <div className="shipment-execution-detail-grid">
                  <div>
                    <span>Shipment</span>
                    <strong>{selectedShipment.shipmentNo}</strong>
                  </div>
                  <div>
                    <span>Shipment Status</span>
                    <strong>{SHIPMENT_STATUS_LABELS[selectedShipment.status]}</strong>
                  </div>
                  <div>
                    <span>Source Warehouse</span>
                    <strong>{getBranchLabel(selectedShipment.sourceWarehouseId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Destination</span>
                    <strong>{getDestinationLabel(selectedShipment, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Picked</span>
                    <strong>{selectedRecord.pickedBy || '-'} · {formatDateTime(selectedRecord.pickedAt)}</strong>
                  </div>
                  <div>
                    <span>Packed</span>
                    <strong>{selectedRecord.packedBy || '-'} · {formatDateTime(selectedRecord.packedAt)}</strong>
                  </div>
                  <div>
                    <span>Shipped</span>
                    <strong>{selectedRecord.shippedBy || '-'} · {formatDateTime(selectedRecord.shippedAt)}</strong>
                  </div>
                  <div>
                    <span>Delivered</span>
                    <strong>{selectedRecord.deliveredBy || '-'} · {formatDateTime(selectedRecord.deliveredAt)}</strong>
                  </div>
                  <div>
                    <span>Delivery Result</span>
                    <strong>{selectedRecord.deliveryResult ? SHIPMENT_DELIVERY_RESULT_LABELS[selectedRecord.deliveryResult] : '-'}</strong>
                  </div>
                </div>
              </section>

              <section className="card shipment-execution-detail-card">
                <div className="section-header">
                  <h3>Product List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kalem</span>
                </div>
                <div className="shipment-execution-item-list">
                  {selectedRecord.items.map(item => {
                    const shipmentItem = selectedShipment.items.find(row => row.id === item.shipmentItemId)
                    const lot = shipmentItem ? lotMap.get(shipmentItem.inventoryLotId) : null

                    return (
                      <div className="shipment-execution-item-row" key={item.id}>
                        <div className="shipment-execution-item-title">
                          <strong>{shipmentItem ? getStockItemLabel(shipmentItem.stockItemId, stockItemMap) : 'Shipment Item bulunamadı'}</strong>
                          <span>{lot ? `${lot.lotNo} · ${INVENTORY_LOT_STATUS_LABELS[lot.status]}` : 'Inventory Lot bulunamadı'}</span>
                        </div>
                        <div className="shipment-execution-quantity-grid">
                          <div>
                            <span>Planned</span>
                            <strong>{formatQuantity(item.plannedQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                          <div>
                            <span>Picked</span>
                            <strong>{formatQuantity(item.pickedQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                          <div>
                            <span>Packed</span>
                            <strong>{formatQuantity(item.packedQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                          <div>
                            <span>Shipped</span>
                            <strong>{formatQuantity(item.shippedQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                          <div>
                            <span>Delivered</span>
                            <strong>{formatQuantity(item.deliveredQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                          <div>
                            <span>Remaining</span>
                            <strong>{formatQuantity(item.remainingQuantity, shipmentItem?.unit || '')}</strong>
                          </div>
                        </div>
                        <div className="shipment-execution-input-grid">
                          <label>
                            <span>Picked Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={quantityInputs[item.id]?.pickedQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'pickedQuantity', event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Packed Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={quantityInputs[item.id]?.packedQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'packedQuantity', event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Delivered Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={quantityInputs[item.id]?.deliveredQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'deliveredQuantity', event.target.value)}
                            />
                          </label>
                        </div>
                        <span className={`status-pill ${item.status === 'DELIVERED' ? 'success' : item.status === 'PARTIAL' ? 'info-pill' : item.status === 'CANCELLED' ? 'danger-pill' : 'muted-pill'}`}>
                          {SHIPMENT_EXECUTION_ITEM_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="card shipment-execution-detail-card">
                <div className="section-header">
                  <h3>Delivery Information</h3>
                </div>
                <label className="shipment-execution-notes-field">
                  <span>Delivery Notes</span>
                  <textarea
                    rows={3}
                    value={deliveryNotes}
                    onChange={event => setDeliveryNotes(event.target.value)}
                  />
                </label>
                <p className="shipment-execution-notes">{selectedRecord.deliveryNotes || '-'}</p>
              </section>
            </>
          ) : (
            <section className="card shipment-execution-detail-card">
              <p className="muted">Henüz Shipment Execution kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
