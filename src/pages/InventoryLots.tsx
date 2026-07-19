import React from 'react'
import {
  INVENTORY_LOT_STATUSES,
  INVENTORY_LOT_STATUS_LABELS,
  getInventoryLotExpiryLabel,
  getInventoryLotExpirySignal,
  loadInventoryLotRecords,
  resolveInventoryLotStatus,
  saveInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot, InventoryLotStatus } from '../inventory-lots/inventory-lot.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import {
  PURCHASE_ORDER_STATUS_LABELS,
  loadPurchaseOrderRecords
} from '../purchase-orders/purchase-order.mock'
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
import type { Branch, StockItem } from '../types'

type FilterValue = 'all'
type StatusFilter = InventoryLotStatus | FilterValue
type ExpiryFilter = 'all' | 'expired' | 'near7' | 'near30' | 'no-expiry'

type InventoryLotInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  suppliers: Supplier[]
  purchaseRequests: PurchaseRequestRecord[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
}

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getStatusClass = (status: InventoryLotStatus) => {
  if(status === 'ACTIVE') return 'success'
  if(status === 'QUARANTINE') return 'warning-pill'
  if(status === 'BLOCKED' || status === 'EXPIRED') return 'danger-pill'
  return 'muted-pill'
}

const getExpiryClass = (lot: InventoryLot) => {
  const signal = getInventoryLotExpirySignal(lot)
  if(signal === 'EXPIRED') return 'danger-pill'
  if(signal === 'NEAR_7') return 'warning-pill'
  if(signal === 'NEAR_30') return 'muted-pill'
  return 'success'
}

const loadInitialData = (): InventoryLotInitialData => {
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

  return {
    branches,
    stockItems,
    suppliers,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
    inventoryLots
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

const getGoodsReceiptLabel = (goodsReceiptId: string, receiptMap: Map<string, GoodsReceiptRecord>) => {
  const receipt = receiptMap.get(goodsReceiptId)
  return receipt ? receipt.receiptNo : 'Goods Receipt bulunamadı'
}

const getPurchaseOrder = (
  lot: InventoryLot,
  receiptMap: Map<string, GoodsReceiptRecord>,
  purchaseOrderMap: Map<string, PurchaseOrder>
) => {
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

export default function InventoryLots(){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [stockItemFilter, setStockItemFilter] = React.useState('all')
  const [expiryFilter, setExpiryFilter] = React.useState<ExpiryFilter>('all')

  const { branches, goodsReceipts, purchaseOrders, purchaseRequests, stockItems, suppliers } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const receiptMap = React.useMemo(() => new Map(goodsReceipts.map(receipt => [receipt.id, receipt])), [goodsReceipts])
  const purchaseOrderMap = React.useMemo(() => new Map(purchaseOrders.map(order => [order.id, order])), [purchaseOrders])
  const purchaseRequestMap = React.useMemo(() => new Map(purchaseRequests.map(request => [request.id, request])), [purchaseRequests])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])

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
      const stockItem = stockItemMap.get(record.stockItemId)
      const supplier = supplierMap.get(record.supplierId)
      const expirySignal = getInventoryLotExpirySignal(record)
      const searchFields = [
        record.lotNo,
        stockItem?.name || '',
        stockItem?.sku || '',
        supplier?.name || '',
        supplier?.tradeName || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesStockItem = stockItemFilter === 'all' || record.stockItemId === stockItemFilter
      const matchesExpiry = expiryFilter === 'all'
        || (expiryFilter === 'expired' && expirySignal === 'EXPIRED')
        || (expiryFilter === 'near7' && expirySignal === 'NEAR_7')
        || (expiryFilter === 'near30' && expirySignal === 'NEAR_30')
        || (expiryFilter === 'no-expiry' && expirySignal === 'NO_EXPIRY')

      return matchesSearch && matchesStatus && matchesWarehouse && matchesSupplier && matchesStockItem && matchesExpiry
    })
  }, [expiryFilter, records, search, statusFilter, stockItemFilter, stockItemMap, supplierFilter, supplierMap, warehouseFilter])

  const activeCount = records.filter(record => record.status === 'ACTIVE').length
  const quarantineCount = records.filter(record => record.status === 'QUARANTINE').length
  const blockedCount = records.filter(record => record.status === 'BLOCKED').length
  const expiredCount = records.filter(record => record.status === 'EXPIRED').length

  const commitRecords = (nextRecords: InventoryLot[]) => {
    setRecords(nextRecords)
    saveInventoryLotRecords(nextRecords)
  }

  const updateStatus = (lot: InventoryLot, status: InventoryLotStatus) => {
    const resolvedStatus = resolveInventoryLotStatus(status, lot.remainingQuantity, lot.expiryDate)
    const nextLot: InventoryLot = {
      ...lot,
      status: resolvedStatus,
      updatedAt: new Date().toISOString()
    }

    commitRecords(records.map(record => record.id === lot.id ? nextLot : record))
    setSelectedRecordId(lot.id)
  }

  return (
    <div className="inventory-lot-page">
      <div className="page-header">
        <div>
          <h2>Lot / Batch Yönetimi</h2>
          <p className="muted">Goods Receipt kaynaklı lotları, SKT uyarılarını ve kullanıma uygunluk durumunu takip edin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Aktif</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Karantina</span>
          <strong>{quarantineCount}</strong>
        </div>
        <div className="metric-card">
          <span>Blokeli</span>
          <strong>{blockedCount}</strong>
        </div>
        <div className="metric-card">
          <span>SKT Geçmiş</span>
          <strong>{expiredCount}</strong>
        </div>
      </div>

      <div className="product-layout inventory-lot-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Lot Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="inventory-lot-toolbar">
            <input
              type="search"
              placeholder="Lot No, Stock Item veya Supplier ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {INVENTORY_LOT_STATUSES.map(status => (
                <option key={status} value={status}>{INVENTORY_LOT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Warehouse</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={stockItemFilter} onChange={event => setStockItemFilter(event.target.value)}>
              <option value="all">Tüm Stock Item</option>
              {stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
            </select>
            <select value={expiryFilter} onChange={event => setExpiryFilter(event.target.value as ExpiryFilter)}>
              <option value="all">Tüm SKT</option>
              <option value="expired">SKT Geçmiş</option>
              <option value="near7">7 Gün Kaldı</option>
              <option value="near30">30 Gün Kaldı</option>
              <option value="no-expiry">SKT Yok</option>
            </select>
          </div>

          <div className="table-wrap inventory-lot-table-wrap">
            <table className="data-table inventory-lot-table">
              <thead>
                <tr>
                  <th>Lot No</th>
                  <th>Stock Item</th>
                  <th>Supplier</th>
                  <th>Warehouse</th>
                  <th>Production Date</th>
                  <th>Expiry Date</th>
                  <th>Remaining Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun lot bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => setSelectedRecordId(record.id)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(record.id)
                    }}
                  >
                    <td data-label="Lot No"><strong>{record.lotNo}</strong></td>
                    <td data-label="Stock Item">{getStockItemLabel(record.stockItemId, stockItemMap)}</td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Warehouse">{getWarehouseLabel(record.warehouseId, branchMap)}</td>
                    <td data-label="Production Date">{formatDate(record.productionDate)}</td>
                    <td data-label="Expiry Date">
                      <strong>{formatDate(record.expiryDate)}</strong>
                      <span className={`status-pill ${getExpiryClass(record)}`}>{getInventoryLotExpiryLabel(getInventoryLotExpirySignal(record))}</span>
                    </td>
                    <td data-label="Remaining Qty">{formatQuantity(record.remainingQuantity, record.unit)}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {INVENTORY_LOT_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side inventory-lot-side">
          <InventoryLotDetailPanel
            lot={selectedRecord}
            receiptMap={receiptMap}
            purchaseOrderMap={purchaseOrderMap}
            purchaseRequestMap={purchaseRequestMap}
            supplierMap={supplierMap}
            stockItemMap={stockItemMap}
            branchMap={branchMap}
            onStatusChange={updateStatus}
          />
        </aside>
      </div>
    </div>
  )
}

function InventoryLotDetailPanel({
  lot,
  receiptMap,
  purchaseOrderMap,
  purchaseRequestMap,
  supplierMap,
  stockItemMap,
  branchMap,
  onStatusChange
}: {
  lot: InventoryLot | null
  receiptMap: Map<string, GoodsReceiptRecord>
  purchaseOrderMap: Map<string, PurchaseOrder>
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  branchMap: Map<string, Branch>
  onStatusChange: (lot: InventoryLot, status: InventoryLotStatus) => void
}){
  if(!lot){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Lot Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir lot seçin.</p>
      </section>
    )
  }

  const receipt = receiptMap.get(lot.goodsReceiptId) || null
  const purchaseOrder = getPurchaseOrder(lot, receiptMap, purchaseOrderMap)
  const purchaseRequest = purchaseOrder ? purchaseRequestMap.get(purchaseOrder.purchaseRequestId) || null : null
  const expirySignal = getInventoryLotExpirySignal(lot)

  return (
    <>
      <section className="card inventory-lot-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{lot.lotNo}</h3>
            <p className="muted">{getStockItemLabel(lot.stockItemId, stockItemMap)}</p>
          </div>
          <span className={`status-pill ${getStatusClass(lot.status)}`}>
            {INVENTORY_LOT_STATUS_LABELS[lot.status]}
          </span>
        </div>
        <div className="inventory-lot-side-actions">
          <select value={lot.status} onChange={event => onStatusChange(lot, event.target.value as InventoryLotStatus)}>
            {INVENTORY_LOT_STATUSES.map(status => (
              <option key={status} value={status}>{INVENTORY_LOT_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card inventory-lot-detail-card">
        <h3>Detay</h3>
        <div className="inventory-lot-detail-grid">
          <div><span>Purchase Order</span><strong>{purchaseOrder?.orderNo || '-'}</strong></div>
          <div><span>PO Durumu</span><strong>{purchaseOrder ? PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status] : '-'}</strong></div>
          <div><span>Goods Receipt</span><strong>{getGoodsReceiptLabel(lot.goodsReceiptId, receiptMap)}</strong></div>
          <div><span>Supplier</span><strong>{getSupplierLabel(lot.supplierId, supplierMap)}</strong></div>
          <div><span>Stock Item</span><strong>{getStockItemLabel(lot.stockItemId, stockItemMap)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot.warehouseId, branchMap)}</strong></div>
          <div><span>Purchase Request</span><strong>{purchaseRequest ? getRequestLabel(purchaseRequest.id, purchaseRequestMap) : '-'}</strong></div>
          <div><span>Received Quantity</span><strong>{formatQuantity(lot.receivedQuantity, lot.unit)}</strong></div>
          <div><span>Remaining Quantity</span><strong>{formatQuantity(lot.remainingQuantity, lot.unit)}</strong></div>
          <div><span>Production Date</span><strong>{formatDate(lot.productionDate)}</strong></div>
          <div><span>Expiry Date</span><strong>{formatDate(lot.expiryDate)}</strong></div>
          <div><span>SKT Uyarısı</span><strong>{getInventoryLotExpiryLabel(expirySignal)}</strong></div>
        </div>
      </section>

      <section className="card inventory-lot-detail-card">
        <h3>Notlar</h3>
        <p className="inventory-lot-notes">{lot.notes || '-'}</p>
      </section>
    </>
  )
}
