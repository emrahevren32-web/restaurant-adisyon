import React from 'react'
import { GOODS_RECEIPT_STATUS_LABELS } from '../goods-receipts/goods-receipt.mock'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import { PURCHASE_ORDER_STATUS_LABELS } from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import {
  createProcurementAnalyticsView,
  loadProcurementAnalyticsSourceData
} from '../procurement-analytics/procurement-analytics.service'
import type {
  ProcurementAnalyticsFilters,
  ProcurementAnalyticsPeriodFilter,
  SupplierAnalyticsRow,
  SupplierPerformanceDistributionItem
} from '../procurement-analytics/procurement-analytics.types'
import {
  SUPPLIER_PERFORMANCE_LEVEL_LABELS,
  SUPPLIER_PERFORMANCE_PERIOD_LABELS,
  formatSupplierPerformanceScore
} from '../supplier-performances/supplier-performance.mock'
import { SUPPLIER_RETURN_STATUS_LABELS } from '../supplier-returns/supplier-return.mock'
import type { SupplierReturn } from '../supplier-returns/supplier-return.types'
import type { Branch } from '../types'

const ALL_FILTER_VALUE = 'all'
const DEFAULT_CURRENCY = 'TRY'

const PERIOD_FILTER_LABELS: Record<ProcurementAnalyticsPeriodFilter, string> = {
  ALL: 'Tüm Dönem',
  MONTHLY: SUPPLIER_PERFORMANCE_PERIOD_LABELS.MONTHLY,
  QUARTERLY: SUPPLIER_PERFORMANCE_PERIOD_LABELS.QUARTERLY,
  YEARLY: SUPPLIER_PERFORMANCE_PERIOD_LABELS.YEARLY
}

const PERIOD_FILTERS: ProcurementAnalyticsPeriodFilter[] = [
  'ALL',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
]

const formatDate = (value: string) => {
  if(!value) return '-'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatCurrency = (value: number, currency = DEFAULT_CURRENCY) => {
  try{
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  } catch {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  }
}

const getSupplierLabel = (
  supplierId: string,
  supplierMap: Map<string, { name: string }>
) => (
  supplierMap.get(supplierId)?.name || 'Supplier bulunamadı'
)

const getWarehouseLabel = (
  warehouseId: string,
  branchMap: Map<string, Branch>
) => (
  branchMap.get(warehouseId)?.name || 'Warehouse bulunamadı'
)

const getPurchaseOrderLabel = (
  purchaseOrderId: string,
  purchaseOrderMap: Map<string, PurchaseOrder>
) => (
  purchaseOrderMap.get(purchaseOrderId)?.orderNo || 'PO bulunamadı'
)

export default function ProcurementAnalytics(){
  const sourceData = React.useMemo(loadProcurementAnalyticsSourceData, [])
  const [filters, setFilters] = React.useState<ProcurementAnalyticsFilters>({
    supplierId: ALL_FILTER_VALUE,
    warehouseId: ALL_FILTER_VALUE,
    period: 'ALL'
  })

  const supplierMap = React.useMemo(() => (
    new Map(sourceData.suppliers.map(supplier => [supplier.id, supplier]))
  ), [sourceData.suppliers])
  const branchMap = React.useMemo(() => (
    new Map(sourceData.branches.map(branch => [branch.id, branch]))
  ), [sourceData.branches])
  const purchaseOrderMap = React.useMemo(() => (
    new Map(sourceData.purchaseOrders.map(order => [order.id, order]))
  ), [sourceData.purchaseOrders])
  const analyticsView = React.useMemo(() => (
    createProcurementAnalyticsView(sourceData, filters)
  ), [filters, sourceData])
  const summary = analyticsView.summary

  return (
    <div className="procurement-analytics-page">
      <div className="page-header">
        <div>
          <h2>Procurement Analytics</h2>
          <p className="muted">Satın alma, mal kabul, kalite, iade ve tedarikçi performansı KPI görünümü.</p>
        </div>
      </div>

      <section className="card procurement-analytics-filter-card">
        <div className="procurement-analytics-toolbar">
          <select
            value={filters.supplierId}
            onChange={event => setFilters({ ...filters, supplierId: event.target.value })}
          >
            <option value={ALL_FILTER_VALUE}>Tüm Supplier</option>
            {sourceData.suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <select
            value={filters.warehouseId}
            onChange={event => setFilters({ ...filters, warehouseId: event.target.value })}
          >
            <option value={ALL_FILTER_VALUE}>Tüm Warehouse</option>
            {sourceData.branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select
            value={filters.period}
            onChange={event => setFilters({ ...filters, period: event.target.value as ProcurementAnalyticsPeriodFilter })}
          >
            {PERIOD_FILTERS.map(period => (
              <option key={period} value={period}>{PERIOD_FILTER_LABELS[period]}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Supplier</span>
          <strong>{summary.totalSupplierCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Purchase Order</span>
          <strong>{summary.totalPurchaseOrderCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Goods Receipt</span>
          <strong>{summary.totalGoodsReceiptCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Quality Control</span>
          <strong>{summary.totalQualityControlCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Supplier Return</span>
          <strong>{summary.totalSupplierReturnCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ortalama Overall Supplier Score</span>
          <strong>{formatSupplierPerformanceScore(summary.averageOverallSupplierScore)}</strong>
        </div>
      </div>

      <div className="metric-grid procurement-analytics-kpi-grid">
        <div className="metric-card">
          <span>Satın Alma Hacmi</span>
          <strong>{formatCurrency(summary.purchaseVolume)}</strong>
        </div>
        <div className="metric-card">
          <span>Average Quality Score</span>
          <strong>{formatSupplierPerformanceScore(summary.averageQualityScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Average Delivery Score</span>
          <strong>{formatSupplierPerformanceScore(summary.averageDeliveryScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Average Return Score</span>
          <strong>{formatSupplierPerformanceScore(summary.averageReturnScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Kalite Başarı Oranı</span>
          <strong>{formatSupplierPerformanceScore(summary.qualitySuccessRate)}</strong>
        </div>
        <div className="metric-card">
          <span>İade Oranı</span>
          <strong>{formatSupplierPerformanceScore(summary.returnRate)}</strong>
        </div>
      </div>

      <div className="procurement-analytics-widget-grid">
        <SupplierPerformanceDistributionWidget
          distribution={analyticsView.supplierPerformanceDistribution}
          total={analyticsView.performanceRecords.length}
        />
        <SupplierRankingWidget
          title="Top 10 Supplier"
          rows={analyticsView.topSuppliers}
          supplierMap={supplierMap}
          valueLabel="Overall Score"
          valueSelector={row => formatSupplierPerformanceScore(row.score)}
        />
        <SupplierRankingWidget
          title="Bottom 10 Supplier"
          rows={analyticsView.bottomSuppliers}
          supplierMap={supplierMap}
          valueLabel="Overall Score"
          valueSelector={row => formatSupplierPerformanceScore(row.score)}
        />
        <SupplierRankingWidget
          title="Most Returned Suppliers"
          rows={analyticsView.mostReturnedSuppliers}
          supplierMap={supplierMap}
          valueLabel="Return Count"
          valueSelector={row => String(row.returnCount)}
        />
        <SupplierRankingWidget
          title="Highest Quality Suppliers"
          rows={analyticsView.highestQualitySuppliers}
          supplierMap={supplierMap}
          valueLabel="Average Quality Score"
          valueSelector={row => formatSupplierPerformanceScore(row.qualityScore)}
        />
        <RecentPurchaseOrdersWidget
          records={analyticsView.recentPurchaseOrders}
          supplierMap={supplierMap}
        />
        <RecentGoodsReceiptsWidget
          records={analyticsView.recentGoodsReceipts}
          supplierMap={supplierMap}
          purchaseOrderMap={purchaseOrderMap}
          branchMap={branchMap}
        />
        <RecentSupplierReturnsWidget
          records={analyticsView.recentSupplierReturns}
          supplierMap={supplierMap}
          branchMap={branchMap}
        />
      </div>
    </div>
  )
}

function SupplierPerformanceDistributionWidget({
  distribution,
  total
}: {
  distribution: SupplierPerformanceDistributionItem[]
  total: number
}){
  return (
    <section className="card procurement-analytics-widget">
      <div className="section-header compact">
        <h3>Supplier Performance Distribution</h3>
      </div>
      <div className="procurement-distribution-list">
        {distribution.map(item => {
          const percent = total > 0 ? (item.count / total) * 100 : 0

          return (
            <div key={item.level} className="procurement-distribution-row">
              <div>
                <strong>{SUPPLIER_PERFORMANCE_LEVEL_LABELS[item.level]}</strong>
                <span>{item.count} supplier</span>
              </div>
              <div className="procurement-distribution-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SupplierRankingWidget({
  title,
  rows,
  supplierMap,
  valueLabel,
  valueSelector
}: {
  title: string
  rows: SupplierAnalyticsRow[]
  supplierMap: Map<string, { name: string }>
  valueLabel: string
  valueSelector: (row: SupplierAnalyticsRow) => string
}){
  return (
    <section className="card procurement-analytics-widget">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="procurement-list-widget">
        {rows.length === 0 && <p className="muted">Kayıt bulunamadı.</p>}
        {rows.map((row, index) => (
          <div key={`${row.supplierId}_${index}`} className="procurement-list-row">
            <div>
              <strong>{getSupplierLabel(row.supplierId, supplierMap)}</strong>
              <span>{valueLabel}</span>
            </div>
            <strong>{valueSelector(row)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecentPurchaseOrdersWidget({
  records,
  supplierMap
}: {
  records: PurchaseOrder[]
  supplierMap: Map<string, { name: string }>
}){
  return (
    <section className="card procurement-analytics-widget procurement-analytics-wide-widget">
      <div className="section-header compact">
        <h3>Recent Purchase Orders</h3>
      </div>
      <div className="procurement-recent-list">
        {records.length === 0 && <p className="muted">Purchase Order bulunamadı.</p>}
        {records.map(record => (
          <div key={record.id} className="procurement-recent-row">
            <div>
              <strong>{record.orderNo}</strong>
              <span>{getSupplierLabel(record.supplierId, supplierMap)}</span>
            </div>
            <span>{formatDate(record.orderDate)}</span>
            <span>{formatCurrency(record.grandTotal, record.currency)}</span>
            <span className="status-pill muted-pill">{PURCHASE_ORDER_STATUS_LABELS[record.status]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecentGoodsReceiptsWidget({
  records,
  supplierMap,
  purchaseOrderMap,
  branchMap
}: {
  records: GoodsReceiptRecord[]
  supplierMap: Map<string, { name: string }>
  purchaseOrderMap: Map<string, PurchaseOrder>
  branchMap: Map<string, Branch>
}){
  return (
    <section className="card procurement-analytics-widget procurement-analytics-wide-widget">
      <div className="section-header compact">
        <h3>Recent Goods Receipts</h3>
      </div>
      <div className="procurement-recent-list">
        {records.length === 0 && <p className="muted">Goods Receipt bulunamadı.</p>}
        {records.map(record => (
          <div key={record.id} className="procurement-recent-row">
            <div>
              <strong>{record.receiptNo}</strong>
              <span>{getSupplierLabel(record.supplierId, supplierMap)} · {getPurchaseOrderLabel(record.purchaseOrderId, purchaseOrderMap)}</span>
            </div>
            <span>{formatDate(record.receiptDate)}</span>
            <span>{getWarehouseLabel(record.warehouseId, branchMap)}</span>
            <span className="status-pill muted-pill">{GOODS_RECEIPT_STATUS_LABELS[record.status]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecentSupplierReturnsWidget({
  records,
  supplierMap,
  branchMap
}: {
  records: SupplierReturn[]
  supplierMap: Map<string, { name: string }>
  branchMap: Map<string, Branch>
}){
  return (
    <section className="card procurement-analytics-widget procurement-analytics-wide-widget">
      <div className="section-header compact">
        <h3>Recent Supplier Returns</h3>
      </div>
      <div className="procurement-recent-list">
        {records.length === 0 && <p className="muted">Supplier Return bulunamadı.</p>}
        {records.map(record => (
          <div key={record.id} className="procurement-recent-row">
            <div>
              <strong>{record.supplierReturnNo}</strong>
              <span>{getSupplierLabel(record.supplierId, supplierMap)} · {getWarehouseLabel(record.warehouseId, branchMap)}</span>
            </div>
            <span>{formatDate(record.shipmentDate)}</span>
            <span>{record.trackingNumber || '-'}</span>
            <span className="status-pill muted-pill">{SUPPLIER_RETURN_STATUS_LABELS[record.status]}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
