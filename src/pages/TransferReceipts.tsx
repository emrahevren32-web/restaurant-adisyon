import React from 'react'
import {
  TRANSFER_RECEIPT_ITEM_STATUS_LABELS,
  TRANSFER_RECEIPT_RESULT_LABELS,
  TRANSFER_RECEIPT_RESULTS,
  TRANSFER_RECEIPT_STATUS_LABELS,
  TRANSFER_RECEIPT_STATUSES,
  canCreateTransferReceipt,
  createTransferReceiptFromExecution,
  loadTransferReceiptRecords,
  saveTransferReceiptRecords
} from '../transfer-receipts/transfer-receipt.mock'
import {
  cancelTransferReceipt,
  completeTransferReceipt,
  rejectTransferReceipt,
  startTransferReceiptInspection
} from '../transfer-receipts/transfer-receipt.service'
import type {
  TransferReceiptRecord,
  TransferReceiptResult,
  TransferReceiptStatus
} from '../transfer-receipts/transfer-receipt.types'
import type { TransferReceiptQuantityPatch } from '../transfer-receipts/transfer-receipt.service'
import {
  SHIPMENT_EXECUTION_STATUS_LABELS,
  loadShipmentExecutionRecords,
  saveShipmentExecutionRecords
} from '../shipment-executions/shipment-execution.mock'
import type { ShipmentExecutionRecord } from '../shipment-executions/shipment-execution.types'
import { loadShipmentRecords } from '../shipments/shipment.mock'
import type { ShipmentRecord } from '../shipments/shipment.types'
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
type StatusFilter = TransferReceiptStatus | FilterValue
type ResultFilter = TransferReceiptResult | 'none' | FilterValue

type TransferReceiptInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  inventoryLots: InventoryLot[]
  shipments: ShipmentRecord[]
  executions: ShipmentExecutionRecord[]
  receipts: TransferReceiptRecord[]
}

type QuantityInputMap = Record<string, {
  receivedQuantity: string
  missingQuantity: string
  extraQuantity: string
  damagedQuantity: string
  notes: string
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

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (user: User) => user.fullName || user.username

const getStatusClass = (status: TransferReceiptStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'INSPECTING') return 'warning-pill'
  if(status === 'REJECTED') return 'danger-pill'
  if(status === 'CANCELLED') return 'muted-pill'
  return 'info-pill'
}

const getResultClass = (result: TransferReceiptResult | '') => {
  if(result === 'SUCCESS') return 'success'
  if(result === 'PARTIAL') return 'warning-pill'
  if(result === 'REJECTED') return 'danger-pill'
  return 'muted-pill'
}

const loadInitialData = (): TransferReceiptInitialData => {
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
  const receipts = loadTransferReceiptRecords(executions)

  return {
    branches,
    stockItems,
    inventoryLots,
    shipments,
    executions,
    receipts
  }
}

const getBranchLabel = (branchId: string, branchMap: Map<string, Branch>, fallback = 'Kayıt bulunamadı') => {
  const branch = branchMap.get(branchId)
  return branch ? branch.name : fallback
}

const getDestinationWarehouseId = (shipment: ShipmentRecord | null) => (
  shipment?.destinationWarehouseId || shipment?.destinationBranchId || ''
)

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

const getExecutionShipment = (
  execution: ShipmentExecutionRecord | null,
  shipmentMap: Map<string, ShipmentRecord>
) => execution ? shipmentMap.get(execution.shipmentId) || null : null

const createQuantityInputs = (receipt: TransferReceiptRecord | null): QuantityInputMap => {
  if(!receipt) return {}

  return Object.fromEntries(receipt.items.map(item => [
    item.id,
    {
      receivedQuantity: String(item.receivedQuantity || item.expectedQuantity),
      missingQuantity: String(item.missingQuantity),
      extraQuantity: String(item.extraQuantity),
      damagedQuantity: String(item.damagedQuantity),
      notes: item.notes
    }
  ]))
}

const toQuantityPatch = (
  receipt: TransferReceiptRecord | null,
  quantityInputs: QuantityInputMap
): TransferReceiptQuantityPatch => {
  if(!receipt) return {}

  return Object.fromEntries(receipt.items.map(item => [
    item.id,
    {
      receivedQuantity: Number(quantityInputs[item.id]?.receivedQuantity || item.receivedQuantity || item.expectedQuantity),
      missingQuantity: Number(quantityInputs[item.id]?.missingQuantity || item.missingQuantity),
      extraQuantity: Number(quantityInputs[item.id]?.extraQuantity || item.extraQuantity),
      damagedQuantity: Number(quantityInputs[item.id]?.damagedQuantity || item.damagedQuantity),
      notes: quantityInputs[item.id]?.notes || item.notes
    }
  ]))
}

export default function TransferReceipts({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<TransferReceiptRecord[]>(initialData.receipts)
  const [executions, setExecutions] = React.useState<ShipmentExecutionRecord[]>(initialData.executions)
  const [inventoryLots, setInventoryLots] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [createExecutionId, setCreateExecutionId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [resultFilter, setResultFilter] = React.useState<ResultFilter>('all')
  const [quantityInputs, setQuantityInputs] = React.useState<QuantityInputMap>({})
  const [notes, setNotes] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)

  const { branches, shipments, stockItems } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const shipmentMap = React.useMemo(() => new Map(shipments.map(shipment => [shipment.id, shipment])), [shipments])
  const executionMap = React.useMemo(() => new Map(executions.map(execution => [execution.id, execution])), [executions])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])
  const selectedExecution = selectedRecord ? executionMap.get(selectedRecord.shipmentExecutionId) || null : null
  const selectedShipment = getExecutionShipment(selectedExecution, shipmentMap)

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  React.useEffect(() => {
    setQuantityInputs(createQuantityInputs(selectedRecord))
    setNotes(selectedRecord?.notes || '')
  }, [selectedRecord])

  const availableExecutions = React.useMemo(() => (
    executions.filter(execution => canCreateTransferReceipt(execution, records))
  ), [executions, records])

  React.useEffect(() => {
    if(createExecutionId && availableExecutions.some(execution => execution.id === createExecutionId)) return
    setCreateExecutionId(availableExecutions[0]?.id || '')
  }, [availableExecutions, createExecutionId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const execution = executionMap.get(record.shipmentExecutionId) || null
      const shipment = getExecutionShipment(execution, shipmentMap)
      const warehouseId = record.warehouseId || getDestinationWarehouseId(shipment)
      const branchId = record.branchId || shipment?.destinationBranchId || ''
      const searchFields = [
        record.receiptNo,
        shipment?.shipmentNo || ''
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesWarehouse = warehouseFilter === 'all' || warehouseId === warehouseFilter
      const matchesBranch = branchFilter === 'all' || branchId === branchFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesResult = resultFilter === 'all'
        || (resultFilter === 'none' && !record.result)
        || record.result === resultFilter

      return matchesSearch && matchesWarehouse && matchesBranch && matchesStatus && matchesResult
    })
  }, [branchFilter, executionMap, records, resultFilter, search, shipmentMap, statusFilter, warehouseFilter])

  const pendingCount = records.filter(record => record.status === 'PENDING').length
  const inspectingCount = records.filter(record => record.status === 'INSPECTING').length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const rejectedCount = records.filter(record => record.status === 'REJECTED').length

  const commitRecords = React.useCallback((nextRecords: TransferReceiptRecord[]) => {
    setRecords(nextRecords)
    saveTransferReceiptRecords(nextRecords)
  }, [])

  const commitExecutions = React.useCallback((nextExecutions: ShipmentExecutionRecord[]) => {
    setExecutions(nextExecutions)
    saveShipmentExecutionRecords(nextExecutions)
  }, [])

  const commitInventoryLots = React.useCallback((nextLots: InventoryLot[]) => {
    setInventoryLots(nextLots)
    saveInventoryLotRecords(nextLots)
  }, [])

  const updateQuantityInput = (
    itemId: string,
    field: keyof QuantityInputMap[string],
    value: string
  ) => {
    setQuantityInputs(prev => ({
      ...prev,
      [itemId]: {
        receivedQuantity: prev[itemId]?.receivedQuantity || '',
        missingQuantity: prev[itemId]?.missingQuantity || '',
        extraQuantity: prev[itemId]?.extraQuantity || '',
        damagedQuantity: prev[itemId]?.damagedQuantity || '',
        notes: prev[itemId]?.notes || '',
        [field]: value
      }
    }))
  }

  const createReceipt = () => {
    const execution = executions.find(item => item.id === createExecutionId)
    const shipment = getExecutionShipment(execution || null, shipmentMap)

    if(!execution || !shipment){
      setMessage({ type: 'error', text: 'Depoya kabul için uygun Shipment Execution bulunamadı.' })
      return
    }

    if(!canCreateTransferReceipt(execution, records)){
      setMessage({ type: 'error', text: 'Her Shipment Execution yalnızca bir Transfer Receipt oluşturabilir.' })
      return
    }

    const nextRecord = createTransferReceiptFromExecution({
      execution,
      records,
      warehouseId: getDestinationWarehouseId(shipment),
      branchId: shipment.destinationBranchId,
      receivedBy: getUserName(currentUser)
    })
    const nextRecords = [nextRecord, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setMessage({ type: 'success', text: `${nextRecord.receiptNo} oluşturuldu.` })
  }

  const commitReceiptUpdate = (
    nextRecord: TransferReceiptRecord,
    successMessage: string
  ) => {
    const nextRecords = records.map(record => record.id === nextRecord.id ? nextRecord : record)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setMessage({ type: 'success', text: successMessage })
  }

  const startInspection = () => {
    if(!selectedRecord){
      setMessage({ type: 'error', text: 'Transfer Receipt seçilmelidir.' })
      return
    }

    try{
      const nextRecord = startTransferReceiptInspection(selectedRecord, currentUser)
      commitReceiptUpdate(nextRecord, `${nextRecord.receiptNo} kontrol süreci başladı.`)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Kontrol başlatılamadı.' })
    }
  }

  const completeReceipt = () => {
    if(!selectedRecord || !selectedExecution || !selectedShipment){
      setMessage({ type: 'error', text: 'Transfer Receipt, Shipment Execution ve Shipment zorunludur.' })
      return
    }

    try{
      const result = completeTransferReceipt({
        receipt: selectedRecord,
        execution: selectedExecution,
        shipment: selectedShipment,
        inventoryLots,
        quantities: toQuantityPatch(selectedRecord, quantityInputs),
        notes,
        user: currentUser
      })

      commitInventoryLots(result.inventoryLots)
      commitExecutions(executions.map(execution => execution.id === result.execution.id ? result.execution : execution))
      commitReceiptUpdate(
        result.receipt,
        `${result.receipt.receiptNo} kabul işlemi tamamlandı. ${result.createdInventoryLots.length} kabul lotu oluşturuldu.`
      )
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Kabul işlemi tamamlanamadı.' })
    }
  }

  const rejectReceipt = () => {
    if(!selectedRecord || !selectedExecution){
      setMessage({ type: 'error', text: 'Transfer Receipt ve Shipment Execution zorunludur.' })
      return
    }

    try{
      const result = rejectTransferReceipt({
        receipt: selectedRecord,
        execution: selectedExecution,
        quantities: toQuantityPatch(selectedRecord, quantityInputs),
        notes,
        user: currentUser
      })

      commitExecutions(executions.map(execution => execution.id === result.execution.id ? result.execution : execution))
      commitReceiptUpdate(result.receipt, `${result.receipt.receiptNo} reddedildi.`)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Red işlemi tamamlanamadı.' })
    }
  }

  const cancelReceipt = () => {
    if(!selectedRecord){
      setMessage({ type: 'error', text: 'Transfer Receipt seçilmelidir.' })
      return
    }

    try{
      const nextRecord = cancelTransferReceipt(selectedRecord, currentUser)
      commitReceiptUpdate(nextRecord, `${nextRecord.receiptNo} iptal edildi.`)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'İptal işlemi tamamlanamadı.' })
    }
  }

  return (
    <div className="transfer-receipt-page">
      <div className="page-header">
        <div>
          <h2>Depoya Kabul</h2>
          <p className="muted">Gelen sevkiyatları hedef depo veya şube adına kontrol edip kabul/red sürecini kapatın.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kontrolde</span>
          <strong>{inspectingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Reddedilen</span>
          <strong>{rejectedCount}</strong>
        </div>
      </div>

      <div className="product-layout transfer-receipt-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Transfer Receipt Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="transfer-receipt-create-card">
            <select value={createExecutionId} onChange={event => setCreateExecutionId(event.target.value)}>
              {availableExecutions.length === 0 && <option value="">Uygun Shipment Execution yok</option>}
              {availableExecutions.map(execution => {
                const shipment = getExecutionShipment(execution, shipmentMap)

                return (
                  <option key={execution.id} value={execution.id}>
                    {execution.executionNo} · {shipment?.shipmentNo || 'Shipment bulunamadı'} · {getDestinationLabel(shipment, branchMap)}
                  </option>
                )
              })}
            </select>
            <button className="primary-button" type="button" onClick={createReceipt} disabled={availableExecutions.length === 0}>
              Receipt Oluştur
            </button>
          </div>

          <div className="transfer-receipt-toolbar">
            <input
              type="search"
              placeholder="Receipt No veya Shipment No ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
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
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {TRANSFER_RECEIPT_STATUSES.map(status => (
                <option key={status} value={status}>{TRANSFER_RECEIPT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={resultFilter} onChange={event => setResultFilter(event.target.value as ResultFilter)}>
              <option value="all">Tüm Sonuçlar</option>
              <option value="none">Sonuç Yok</option>
              {TRANSFER_RECEIPT_RESULTS.map(result => (
                <option key={result} value={result}>{TRANSFER_RECEIPT_RESULT_LABELS[result]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap transfer-receipt-table-wrap">
            <table className="data-table transfer-receipt-table">
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Shipment No</th>
                  <th>Warehouse</th>
                  <th>Receipt Date</th>
                  <th>Status</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(record => {
                  const execution = executionMap.get(record.shipmentExecutionId) || null
                  const shipment = getExecutionShipment(execution, shipmentMap)
                  const warehouseId = record.warehouseId || getDestinationWarehouseId(shipment)

                  return (
                    <tr
                      key={record.id}
                      aria-selected={selectedRecord?.id === record.id}
                      onClick={() => {
                        setSelectedRecordId(record.id)
                        setMessage(null)
                      }}
                    >
                      <td data-label="Receipt No">
                        <strong>{record.receiptNo}</strong>
                        <span className="muted">{record.items.length} kalem</span>
                      </td>
                      <td data-label="Shipment No">{shipment?.shipmentNo || 'Shipment bulunamadı'}</td>
                      <td data-label="Warehouse">{getBranchLabel(warehouseId, branchMap)}</td>
                      <td data-label="Receipt Date">{formatDate(record.receiptDate)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>{TRANSFER_RECEIPT_STATUS_LABELS[record.status]}</span>
                      </td>
                      <td data-label="Result">
                        <span className={`status-pill ${getResultClass(record.result)}`}>{record.result ? TRANSFER_RECEIPT_RESULT_LABELS[record.result] : '-'}</span>
                      </td>
                    </tr>
                  )
                })}
                {visibleRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={6}>Filtrelere uygun Transfer Receipt bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side transfer-receipt-side">
          {selectedRecord && selectedExecution && selectedShipment ? (
            <>
              <section className="card transfer-receipt-detail-card">
                <div className="section-header">
                  <div>
                    <h3>{selectedRecord.receiptNo}</h3>
                    <p className="muted">{selectedShipment.shipmentNo} · {getDestinationLabel(selectedShipment, branchMap)}</p>
                  </div>
                  <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>
                    {TRANSFER_RECEIPT_STATUS_LABELS[selectedRecord.status]}
                  </span>
                </div>
                <div className="transfer-receipt-action-grid">
                  {selectedRecord.status === 'PENDING' && (
                    <button className="primary-button" type="button" onClick={startInspection}>
                      Kontrole Başla
                    </button>
                  )}
                  {(selectedRecord.status === 'PENDING' || selectedRecord.status === 'INSPECTING') && (
                    <>
                      <button className="primary-button" type="button" onClick={completeReceipt}>
                        Kabul Et / Kapat
                      </button>
                      <button className="ghost-button" type="button" onClick={rejectReceipt}>
                        Red
                      </button>
                      <button className="ghost-button" type="button" onClick={cancelReceipt}>
                        İptal
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="card transfer-receipt-detail-card">
                <div className="section-header">
                  <h3>Detay</h3>
                </div>
                <div className="transfer-receipt-detail-grid">
                  <div>
                    <span>Shipment</span>
                    <strong>{selectedShipment.shipmentNo}</strong>
                  </div>
                  <div>
                    <span>Execution</span>
                    <strong>{selectedExecution.executionNo}</strong>
                  </div>
                  <div>
                    <span>Execution Status</span>
                    <strong>{SHIPMENT_EXECUTION_STATUS_LABELS[selectedExecution.status]}</strong>
                  </div>
                  <div>
                    <span>Warehouse</span>
                    <strong>{getBranchLabel(selectedRecord.warehouseId || getDestinationWarehouseId(selectedShipment), branchMap)}</strong>
                  </div>
                  <div>
                    <span>Branch</span>
                    <strong>{getBranchLabel(selectedRecord.branchId || selectedShipment.destinationBranchId, branchMap)}</strong>
                  </div>
                  <div>
                    <span>Received By</span>
                    <strong>{selectedRecord.receivedBy || '-'}</strong>
                  </div>
                  <div>
                    <span>Receipt Date</span>
                    <strong>{formatDate(selectedRecord.receiptDate)}</strong>
                  </div>
                  <div>
                    <span>Result</span>
                    <strong>{selectedRecord.result ? TRANSFER_RECEIPT_RESULT_LABELS[selectedRecord.result] : '-'}</strong>
                  </div>
                </div>
              </section>

              <section className="card transfer-receipt-detail-card">
                <div className="section-header">
                  <h3>Item List</h3>
                  <span className="status-pill muted-pill">{selectedRecord.items.length} kalem</span>
                </div>
                <div className="transfer-receipt-item-list">
                  {selectedRecord.items.map(item => {
                    const executionItem = selectedExecution.items.find(row => row.id === item.executionItemId)
                    const shipmentItem = executionItem ? selectedShipment.items.find(row => row.id === executionItem.shipmentItemId) : null
                    const lot = shipmentItem ? lotMap.get(shipmentItem.inventoryLotId) : null
                    const unit = shipmentItem?.unit || lot?.unit || ''
                    const input = quantityInputs[item.id]
                    const acceptedPreview = Math.max(0, Number(input?.receivedQuantity || 0) - Number(input?.damagedQuantity || 0))

                    return (
                      <div className="transfer-receipt-item-row" key={item.id}>
                        <div className="transfer-receipt-item-title">
                          <strong>{shipmentItem ? getStockItemLabel(shipmentItem.stockItemId, stockItemMap) : 'Shipment Item bulunamadı'}</strong>
                          <span>{lot ? `${lot.lotNo} · ${INVENTORY_LOT_STATUS_LABELS[lot.status]}` : 'Inventory Lot bulunamadı'}</span>
                        </div>
                        <div className="transfer-receipt-quantity-grid">
                          <div>
                            <span>Expected</span>
                            <strong>{formatQuantity(item.expectedQuantity, unit)}</strong>
                          </div>
                          <div>
                            <span>Received</span>
                            <strong>{formatQuantity(item.receivedQuantity, unit)}</strong>
                          </div>
                          <div>
                            <span>Missing</span>
                            <strong>{formatQuantity(item.missingQuantity, unit)}</strong>
                          </div>
                          <div>
                            <span>Extra</span>
                            <strong>{formatQuantity(item.extraQuantity, unit)}</strong>
                          </div>
                          <div>
                            <span>Damaged</span>
                            <strong>{formatQuantity(item.damagedQuantity, unit)}</strong>
                          </div>
                          <div>
                            <span>Accepted</span>
                            <strong>{formatQuantity(item.acceptedQuantity, unit)}</strong>
                          </div>
                        </div>
                        <div className="transfer-receipt-input-grid">
                          <label>
                            <span>Received Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={input?.receivedQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'receivedQuantity', event.target.value)}
                              disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                            />
                          </label>
                          <label>
                            <span>Missing Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={input?.missingQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'missingQuantity', event.target.value)}
                              disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                            />
                          </label>
                          <label>
                            <span>Extra Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={input?.extraQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'extraQuantity', event.target.value)}
                              disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                            />
                          </label>
                          <label>
                            <span>Damaged Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={input?.damagedQuantity || ''}
                              onChange={event => updateQuantityInput(item.id, 'damagedQuantity', event.target.value)}
                              disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                            />
                          </label>
                          <label>
                            <span>Accepted Preview</span>
                            <input value={formatQuantity(acceptedPreview, unit)} disabled />
                          </label>
                          <label>
                            <span>Item Notes</span>
                            <input
                              value={input?.notes || ''}
                              onChange={event => updateQuantityInput(item.id, 'notes', event.target.value)}
                              disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                            />
                          </label>
                        </div>
                        <span className={`status-pill ${item.status === 'ACCEPTED' ? 'success' : item.status === 'PARTIAL' || item.status === 'MISSING' || item.status === 'DAMAGED' ? 'warning-pill' : item.status === 'REJECTED' ? 'danger-pill' : 'muted-pill'}`}>
                          {TRANSFER_RECEIPT_ITEM_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="card transfer-receipt-detail-card">
                <div className="section-header">
                  <h3>Notes</h3>
                </div>
                <label className="transfer-receipt-notes-field">
                  <span>Receipt Notes</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    disabled={selectedRecord.status === 'COMPLETED' || selectedRecord.status === 'REJECTED' || selectedRecord.status === 'CANCELLED'}
                  />
                </label>
                <p className="transfer-receipt-notes">{selectedRecord.notes || '-'}</p>
              </section>
            </>
          ) : (
            <section className="card transfer-receipt-detail-card">
              <p className="muted">Henüz Transfer Receipt kaydı bulunmuyor.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
