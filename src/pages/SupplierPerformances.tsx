import React from 'react'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import { loadInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import {
  applyCompletedQualityControlsToInventoryLots,
  loadQualityControlRecords
} from '../quality-controls/quality-control.mock'
import {
  loadQualityControlFormRecords,
  loadQualityControlTemplateRecords
} from '../quality-controls/quality-control-form.mock'
import type { QualityControlFormRecord } from '../quality-controls/quality-control-form.types'
import type { QualityControl } from '../quality-controls/quality-control.types'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import { loadReturnProcessRecords } from '../return-processes/return-process.mock'
import type { ReturnProcess } from '../return-processes/return-process.types'
import {
  loadSupplierManagementRecords
} from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type {
  Supplier,
  SupplierProduct
} from '../supplier-management/supplier-management.types'
import {
  SUPPLIER_PERFORMANCE_LEVEL_LABELS,
  SUPPLIER_PERFORMANCE_LEVELS,
  SUPPLIER_PERFORMANCE_PERIOD_LABELS,
  SUPPLIER_PERFORMANCE_PERIODS,
  calculateSupplierPerformances,
  formatSupplierPerformanceScore,
  loadSupplierPerformanceRecords,
  saveSupplierPerformanceRecords
} from '../supplier-performances/supplier-performance.mock'
import type {
  SupplierPerformance,
  SupplierPerformanceLevel,
  SupplierPerformancePeriod
} from '../supplier-performances/supplier-performance.types'
import { loadSupplierReturnRecords } from '../supplier-returns/supplier-return.mock'
import type { SupplierReturn } from '../supplier-returns/supplier-return.types'
import {
  loadBranches,
  loadStockItems
} from '../storage'
import type { Branch, StockItem } from '../types'

type FilterValue = 'all'
type LevelFilter = SupplierPerformanceLevel | FilterValue
type PeriodFilter = SupplierPerformancePeriod | FilterValue

type SupplierPerformanceInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  qualityControls: QualityControl[]
  qualityControlForms: QualityControlFormRecord[]
  returnProcesses: ReturnProcess[]
  supplierReturns: SupplierReturn[]
  performanceRecords: SupplierPerformance[]
}

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getLevelClass = (level: SupplierPerformanceLevel) => {
  if(level === 'EXCELLENT' || level === 'GOOD') return 'success'
  if(level === 'AVERAGE' || level === 'POOR') return 'warning-pill'
  return 'danger-pill'
}

const getSupplierLabel = (
  supplierId: string,
  supplierMap: Map<string, Supplier>
) => {
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const loadPerformanceSourceData = () => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const inventoryLots = loadInventoryLotRecords(goodsReceipts)
  const qualityControls = loadQualityControlRecords(inventoryLots)
  const qualitySyncedLots = applyCompletedQualityControlsToInventoryLots(inventoryLots, qualityControls)
  const qualityControlTemplates = loadQualityControlTemplateRecords()
  const qualityControlForms = loadQualityControlFormRecords(qualityControls, qualityControlTemplates)
  const returnProcesses = loadReturnProcessRecords(qualityControls, qualitySyncedLots, goodsReceipts)
  const supplierReturns = loadSupplierReturnRecords(returnProcesses)

  return {
    branches,
    stockItems,
    purchaseRequests,
    suppliers,
    supplierProducts,
    rfqRecords,
    purchaseOrders,
    goodsReceipts,
    qualityControls,
    qualityControlForms,
    returnProcesses,
    supplierReturns
  }
}

const loadInitialData = (): SupplierPerformanceInitialData => {
  const sourceData = loadPerformanceSourceData()
  const performanceRecords = loadSupplierPerformanceRecords(sourceData)

  return {
    ...sourceData,
    performanceRecords
  }
}

export default function SupplierPerformances(){
  const initialData = React.useMemo(loadInitialData, [])
  const [sourceData, setSourceData] = React.useState(initialData)
  const [records, setRecords] = React.useState<SupplierPerformance[]>(initialData.performanceRecords)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [levelFilter, setLevelFilter] = React.useState<LevelFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>('all')

  const { suppliers } = sourceData
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
      const supplier = supplierMap.get(record.supplierId)
      const searchFields = [
        supplier?.supplierCode || '',
        supplier?.name || '',
        supplier?.tradeName || ''
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesLevel = levelFilter === 'all' || record.performanceLevel === levelFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesPeriod = periodFilter === 'all' || record.period === periodFilter

      return matchesSearch && matchesLevel && matchesSupplier && matchesPeriod
    })
  }, [levelFilter, periodFilter, records, search, supplierFilter, supplierMap])

  const supplierCount = new Set(records.map(record => record.supplierId)).size
  const averageOverallScore = records.length > 0
    ? records.reduce((total, record) => total + record.overallScore, 0) / records.length
    : 0
  const reliableCount = records.filter(record => (
    record.performanceLevel === 'EXCELLENT' || record.performanceLevel === 'GOOD'
  )).length
  const criticalCount = records.filter(record => record.performanceLevel === 'CRITICAL').length

  const recalculatePerformance = () => {
    const nextSourceData = loadPerformanceSourceData()
    const nextRecords = calculateSupplierPerformances(nextSourceData)

    saveSupplierPerformanceRecords(nextRecords)
    setSourceData({
      ...nextSourceData,
      performanceRecords: nextRecords
    })
    setRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
  }

  return (
    <div className="supplier-performance-page">
      <div className="page-header">
        <div>
          <h2>Tedarikçi Performansı</h2>
          <p className="muted">Tedarikçilerin teslimat, kalite ve iade KPI performansını otomatik hesaplayın.</p>
        </div>
        <button className="btn primary" type="button" onClick={recalculatePerformance}>Performansı Yeniden Hesapla</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Supplier</span>
          <strong>{supplierCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ortalama Skor</span>
          <strong>{formatSupplierPerformanceScore(averageOverallScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Güvenilir</span>
          <strong>{reliableCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kritik</span>
          <strong>{criticalCount}</strong>
        </div>
      </div>

      <div className="product-layout supplier-performance-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Performans Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="supplier-performance-toolbar">
            <input
              type="search"
              placeholder="Supplier ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={levelFilter} onChange={event => setLevelFilter(event.target.value as LevelFilter)}>
              <option value="all">Tüm Seviyeler</option>
              {SUPPLIER_PERFORMANCE_LEVELS.map(level => (
                <option key={level} value={level}>{SUPPLIER_PERFORMANCE_LEVEL_LABELS[level]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value as PeriodFilter)}>
              <option value="all">Tüm Period</option>
              {SUPPLIER_PERFORMANCE_PERIODS.map(period => (
                <option key={period} value={period}>{SUPPLIER_PERFORMANCE_PERIOD_LABELS[period]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap supplier-performance-table-wrap">
            <table className="data-table supplier-performance-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Period</th>
                  <th>Purchase Orders</th>
                  <th>Quality Score</th>
                  <th>Delivery Score</th>
                  <th>Return Score</th>
                  <th>Overall Score</th>
                  <th>Performance Level</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun tedarikçi performansı bulunamadı.</td></tr>
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
                    <td data-label="Supplier">
                      <strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong>
                      <span>{supplierMap.get(record.supplierId)?.supplierCode || '-'}</span>
                    </td>
                    <td data-label="Period">{SUPPLIER_PERFORMANCE_PERIOD_LABELS[record.period]}</td>
                    <td data-label="Purchase Orders">{record.purchaseOrderCount}</td>
                    <td data-label="Quality Score">{formatSupplierPerformanceScore(record.qualityScore)}</td>
                    <td data-label="Delivery Score">{formatSupplierPerformanceScore(record.deliveryScore)}</td>
                    <td data-label="Return Score">{formatSupplierPerformanceScore(record.returnScore)}</td>
                    <td data-label="Overall Score"><strong>{formatSupplierPerformanceScore(record.overallScore)}</strong></td>
                    <td data-label="Performance Level">
                      <span className={`status-pill ${getLevelClass(record.performanceLevel)}`}>
                        {SUPPLIER_PERFORMANCE_LEVEL_LABELS[record.performanceLevel]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side supplier-performance-side">
          <SupplierPerformanceDetailPanel
            record={selectedRecord}
            supplierMap={supplierMap}
            onRecalculate={recalculatePerformance}
          />
        </aside>
      </div>
    </div>
  )
}

function SupplierPerformanceDetailPanel({
  record,
  supplierMap,
  onRecalculate
}: {
  record: SupplierPerformance | null
  supplierMap: Map<string, Supplier>
  onRecalculate: () => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Performans Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir tedarikçi performansı seçin.</p>
        <button className="btn primary" type="button" onClick={onRecalculate}>Performansı Yeniden Hesapla</button>
      </section>
    )
  }

  return (
    <>
      <section className="card supplier-performance-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{getSupplierLabel(record.supplierId, supplierMap)}</h3>
            <p className="muted">{SUPPLIER_PERFORMANCE_PERIOD_LABELS[record.period]}</p>
          </div>
          <span className={`status-pill ${getLevelClass(record.performanceLevel)}`}>
            {SUPPLIER_PERFORMANCE_LEVEL_LABELS[record.performanceLevel]}
          </span>
        </div>
        <button className="btn primary" type="button" onClick={onRecalculate}>Yeniden Hesapla</button>
      </section>

      <section className="card supplier-performance-detail-card">
        <h3>KPI Detayı</h3>
        <div className="supplier-performance-detail-grid">
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Purchase Orders</span><strong>{record.purchaseOrderCount}</strong></div>
          <div><span>Goods Receipts</span><strong>{record.goodsReceiptCount}</strong></div>
          <div><span>Quality Controls</span><strong>{record.qualityControlCount}</strong></div>
          <div><span>Approved QC</span><strong>{record.approvedQualityCount}</strong></div>
          <div><span>Rejected QC</span><strong>{record.rejectedQualityCount}</strong></div>
          <div><span>Supplier Returns</span><strong>{record.supplierReturnCount}</strong></div>
          <div><span>Average Quality Score</span><strong>{formatSupplierPerformanceScore(record.averageQualityScore)}</strong></div>
          <div><span>Delivery Score</span><strong>{formatSupplierPerformanceScore(record.deliveryScore)}</strong></div>
          <div><span>Return Score</span><strong>{formatSupplierPerformanceScore(record.returnScore)}</strong></div>
          <div><span>Overall Score</span><strong>{formatSupplierPerformanceScore(record.overallScore)}</strong></div>
          <div><span>Performance Level</span><strong>{SUPPLIER_PERFORMANCE_LEVEL_LABELS[record.performanceLevel]}</strong></div>
          <div><span>On Time Delivery</span><strong>{record.onTimeDeliveryCount}</strong></div>
          <div><span>Late Delivery</span><strong>{record.lateDeliveryCount}</strong></div>
          <div><span>Return Processes</span><strong>{record.returnProcessCount}</strong></div>
          <div><span>Calculated Date</span><strong>{formatDateTime(record.calculatedAt)}</strong></div>
        </div>
      </section>

      <section className="card supplier-performance-detail-card">
        <h3>Notes</h3>
        <p className="supplier-performance-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
