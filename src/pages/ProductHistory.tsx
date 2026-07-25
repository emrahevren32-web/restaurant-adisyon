import React from 'react'
import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import {
  INVENTORY_LOT_STATUS_LABELS,
  isProductionInventoryLot,
  loadLotSystemInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLotProductReference } from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadIntermediateProducts } from '../intermediate-products/intermediate-product.mock'
import type { IntermediateProduct } from '../intermediate-products/intermediate-product.types'
import { loadProductionWorkOrders } from '../production-work-orders/production-work-order.mock'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import {
  PRODUCT_RECALL_REASON_LABELS,
  PRODUCT_RECALL_RISK_LEVEL_LABELS,
  PRODUCT_RECALL_STATUS_LABELS,
  loadProductRecallRecords
} from '../product-recalls/product-recall.mock'
import type { ProductRecall } from '../product-recalls/product-recall.types'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import {
  QUALITY_SAMPLE_STATUS_LABELS,
  QUALITY_SAMPLE_TYPE_LABELS,
  loadQualitySampleRecords
} from '../quality-samples/quality-sample.mock'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import {
  PRODUCT_HISTORY_EVENT_TYPES,
  PRODUCT_HISTORY_EVENT_TYPE_CLASS_NAMES,
  PRODUCT_HISTORY_EVENT_TYPE_LABELS,
  buildProductHistoryTimeline,
  normalizeProductHistorySearchText
} from '../product-history/product-history.service'
import type {
  ProductHistoryBuildResult,
  ProductHistoryEvent,
  ProductHistoryEventType
} from '../product-history/product-history.types'
import { loadBranches, loadStockItems } from '../storage'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Branch, StockItem, StockUnit, User } from '../types'
import {
  WITNESS_SAMPLE_STATUS_LABELS,
  loadWitnessSampleRecords
} from '../witness-samples/witness-sample.mock'
import type { WitnessSample } from '../witness-samples/witness-sample.types'

type FilterValue = 'all'
type EventTypeFilter = ProductHistoryEventType | FilterValue

type ProductHistoryInitialData = {
  branches: Branch[]
  inventoryLots: InventoryLot[]
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  qualitySamples: QualitySample[]
  recalls: ProductRecall[]
  stockItems: StockItem[]
  witnessSamples: WitnessSample[]
}

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const toSearchText = (value: string) => normalizeProductHistorySearchText(value)

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (quantity: number, unit: string) => (
  `${quantity.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const createProductRefs = (
  finalProducts: FinalProduct[],
  intermediateProducts: IntermediateProduct[],
  stockItems: StockItem[]
): InventoryLotProductReference[] => {
  const stockItemByName = new Map(stockItems.map(item => [toSearchText(item.name), item]))
  const seenIds = new Set<string>()

  const fromProduct = (product: FinalProduct | IntermediateProduct): InventoryLotProductReference => {
    const stockItem = stockItemByName.get(toSearchText(product.name))
    return {
      id: product.id,
      name: product.name,
      unit: normalizeUnit(product.unit),
      stockItemId: stockItem?.id
    }
  }

  return [...finalProducts.map(fromProduct), ...intermediateProducts.map(fromProduct)]
    .filter(product => {
      if(seenIds.has(product.id)) return false
      seenIds.add(product.id)
      return true
    })
}

const getTraceableLots = (inventoryLots: InventoryLot[]) => {
  const productionLots = inventoryLots.filter(isProductionInventoryLot)
  return productionLots.length > 0 ? productionLots : inventoryLots
}

const filterRecordsByLotIds = <TRecord,>(
  records: TRecord[],
  lotIds: Set<string>,
  getLotId: (record: TRecord) => string
) => records.filter(record => lotIds.has(getLotId(record)))

const loadInitialData = (): ProductHistoryInitialData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const productionOrders = loadProductionWorkOrders()
  const finalProducts = loadFinalProducts()
  const intermediateProducts = loadIntermediateProducts()
  const productRefs = createProductRefs(finalProducts, intermediateProducts, stockItems)
  const inventoryLots = loadLotSystemInventoryLotRecords(goodsReceipts, productionOrders, branches, productRefs)
  const traceableLots = getTraceableLots(inventoryLots)
  const traceableLotIds = new Set(traceableLots.map(lot => lot.id))
  const qualitySamples = filterRecordsByLotIds(
    loadQualitySampleRecords(inventoryLots),
    traceableLotIds,
    sample => sample.inventoryLotId
  )
  const sampleIds = new Set(qualitySamples.map(sample => sample.id))
  const witnessSamples = loadWitnessSampleRecords(qualitySamples)
    .filter(sample => sampleIds.has(sample.qualitySampleId))
  const recalls = filterRecordsByLotIds(
    loadProductRecallRecords(inventoryLots),
    traceableLotIds,
    recall => recall.inventoryLotId
  )

  return {
    branches,
    inventoryLots: traceableLots,
    productRefs,
    productionOrders,
    qualitySamples,
    recalls,
    stockItems,
    witnessSamples
  }
}

const buildTimeline = (initialData: ProductHistoryInitialData) => (
  buildProductHistoryTimeline({
    productionOrders: initialData.productionOrders,
    inventoryLots: initialData.inventoryLots,
    qualitySamples: initialData.qualitySamples,
    witnessSamples: initialData.witnessSamples,
    recalls: initialData.recalls,
    products: initialData.productRefs,
    stockItems: initialData.stockItems
  })
)

const getEventClassName = (eventType: ProductHistoryEventType) => (
  PRODUCT_HISTORY_EVENT_TYPE_CLASS_NAMES[eventType]
)

const getWarehouseLabel = (
  lot: InventoryLot | null,
  branchMap: Map<string, Branch>
) => (
  lot ? branchMap.get(lot.warehouseId)?.name || 'Warehouse bulunamadı' : '-'
)

const getContextEvents = (
  selectedEvent: ProductHistoryEvent | null,
  events: ProductHistoryEvent[]
) => {
  if(!selectedEvent) return []
  if(selectedEvent.inventoryLotId){
    return events.filter(event => (
      event.inventoryLotId === selectedEvent.inventoryLotId
      || (
        selectedEvent.productionOrderId
        && event.eventType === 'PRODUCTION_ORDER'
        && event.productionOrderId === selectedEvent.productionOrderId
      )
    ))
  }
  if(selectedEvent.productionOrderId){
    return events.filter(event => event.productionOrderId === selectedEvent.productionOrderId)
  }
  if(selectedEvent.productIds.length > 0){
    const productIds = new Set(selectedEvent.productIds)
    return events.filter(event => event.productIds.some(productId => productIds.has(productId)))
  }
  return [selectedEvent]
}

export default function ProductHistory({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const timeline = React.useMemo(() => buildTimeline(initialData), [initialData])
  const [selectedEventId, setSelectedEventId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>('all')
  const [productFilter, setProductFilter] = React.useState('all')
  const [startDateFilter, setStartDateFilter] = React.useState('')
  const [endDateFilter, setEndDateFilter] = React.useState('')

  const visibleEvents = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return timeline.events.filter(event => {
      const matchesSearch = !normalizedSearch || event.searchText.includes(normalizedSearch)
      const matchesEventType = eventTypeFilter === 'all' || event.eventType === eventTypeFilter
      const matchesProduct = productFilter === 'all' || event.productIds.includes(productFilter)
      const matchesStartDate = !startDateFilter || event.dateKey >= startDateFilter
      const matchesEndDate = !endDateFilter || event.dateKey <= endDateFilter

      return matchesSearch && matchesEventType && matchesProduct && matchesStartDate && matchesEndDate
    })
  }, [endDateFilter, eventTypeFilter, productFilter, search, startDateFilter, timeline.events])

  const selectedEvent = React.useMemo(() => (
    visibleEvents.find(event => event.id === selectedEventId) || visibleEvents[0] || null
  ), [selectedEventId, visibleEvents])

  React.useEffect(() => {
    if(selectedEventId && visibleEvents.some(event => event.id === selectedEventId)) return
    setSelectedEventId(visibleEvents[0]?.id || '')
  }, [selectedEventId, visibleEvents])

  const productionOrderEventCount = timeline.events.filter(event => event.eventType === 'PRODUCTION_ORDER').length
  const lotEventCount = timeline.events.filter(event => event.eventType === 'LOT_CREATED').length
  const sampleEventCount = timeline.events.filter(event => event.eventType === 'SAMPLE_COLLECTED').length
  const witnessEventCount = timeline.events.filter(event => event.eventType === 'WITNESS_SAMPLE_CREATED').length
  const recallEventCount = timeline.events.filter(event => event.eventType === 'RECALL_OPENED').length

  return (
    <div className="product-history-page">
      <div className="page-header">
        <div>
          <h2>Ürün Geçmişi</h2>
          <p className="muted">Production Order, Lot, Numune, Şahit Numune ve Recall olaylarını tek timeline üzerinde izleyin.</p>
        </div>
        <div className="product-history-header-actions">
          <span className="muted">Viewed By: {getUserName(currentUser)}</span>
        </div>
      </div>

      <div className="metric-grid product-history-metrics">
        <div className="metric-card">
          <span>Production Order</span>
          <strong>{productionOrderEventCount}</strong>
        </div>
        <div className="metric-card">
          <span>Inventory Lot</span>
          <strong>{lotEventCount}</strong>
        </div>
        <div className="metric-card">
          <span>Quality Sample</span>
          <strong>{sampleEventCount}</strong>
        </div>
        <div className="metric-card">
          <span>Witness Sample</span>
          <strong>{witnessEventCount}</strong>
        </div>
        <div className="metric-card">
          <span>Recall</span>
          <strong>{recallEventCount}</strong>
        </div>
      </div>

      <div className="product-layout product-history-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Traceability Timeline</h3>
              <p className="muted">{visibleEvents.length} olay gösteriliyor.</p>
            </div>
          </div>

          <div className="product-history-toolbar">
            <input
              type="search"
              placeholder="Production Order, Lot, Product, Sample veya Recall ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={eventTypeFilter} onChange={event => setEventTypeFilter(event.target.value as EventTypeFilter)}>
              <option value="all">Tüm Olay Türleri</option>
              {PRODUCT_HISTORY_EVENT_TYPES.map(eventType => (
                <option key={eventType} value={eventType}>{PRODUCT_HISTORY_EVENT_TYPE_LABELS[eventType]}</option>
              ))}
            </select>
            <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
              <option value="all">Tüm Ürünler</option>
              {timeline.productOptions.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Başlangıç tarihi"
              value={startDateFilter}
              onChange={event => setStartDateFilter(event.target.value)}
            />
            <input
              type="date"
              aria-label="Bitiş tarihi"
              value={endDateFilter}
              onChange={event => setEndDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap product-history-table-wrap">
            <table className="data-table product-history-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Olay Türü</th>
                  <th>Referans No</th>
                  <th>Ürün</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.length === 0 && (
                  <tr><td colSpan={6} className="empty-cell">Bu filtrelere uygun timeline olayı bulunamadı.</td></tr>
                )}
                {visibleEvents.map(event => (
                  <tr
                    key={event.id}
                    className={selectedEvent?.id === event.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => setSelectedEventId(event.id)}
                    onKeyDown={keyboardEvent => {
                      if(keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return
                      keyboardEvent.preventDefault()
                      setSelectedEventId(event.id)
                    }}
                  >
                    <td data-label="Tarih">{formatDate(event.dateKey)}</td>
                    <td data-label="Saat"><strong>{event.timeKey}</strong></td>
                    <td data-label="Olay Türü">
                      <span className={`product-history-event-pill ${getEventClassName(event.eventType)}`}>
                        {PRODUCT_HISTORY_EVENT_TYPE_LABELS[event.eventType]}
                      </span>
                    </td>
                    <td data-label="Referans No"><strong>{event.referenceNo}</strong></td>
                    <td data-label="Ürün">{event.productName}</td>
                    <td data-label="Açıklama">{event.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side product-history-side">
          <ProductHistoryDetailPanel
            branchMap={new Map(initialData.branches.map(branch => [branch.id, branch]))}
            event={selectedEvent}
            timeline={timeline}
          />
        </aside>
      </div>
    </div>
  )
}

function ProductHistoryDetailPanel({
  branchMap,
  event,
  timeline
}: {
  branchMap: Map<string, Branch>
  event: ProductHistoryEvent | null
  timeline: ProductHistoryBuildResult
}){
  if(!event){
    return (
      <section className="card product-history-detail-card">
        <div className="section-header compact">
          <h3>Timeline Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir timeline olayı seçin.</p>
      </section>
    )
  }

  const productionOrder = event.productionOrderId
    ? timeline.index.productionOrderMap.get(event.productionOrderId) || null
    : null
  const lot = event.inventoryLotId
    ? timeline.index.lotMap.get(event.inventoryLotId) || null
    : null
  const sample = event.qualitySampleId
    ? timeline.index.sampleMap.get(event.qualitySampleId) || null
    : null
  const witnessSample = event.witnessSampleId
    ? timeline.index.witnessSampleMap.get(event.witnessSampleId) || null
    : null
  const recall = event.recallId
    ? timeline.index.recallMap.get(event.recallId) || null
    : null
  const relatedSamples = lot ? timeline.index.samplesByLotId.get(lot.id) || [] : []
  const relatedWitnessSamples = relatedSamples.flatMap(relatedSample => (
    timeline.index.witnessSamplesBySampleId.get(relatedSample.id) || []
  ))
  const relatedRecalls = lot ? timeline.index.recallsByLotId.get(lot.id) || [] : []
  const contextEvents = getContextEvents(event, timeline.events)

  return (
    <>
      <section className="card product-history-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{event.referenceNo}</h3>
            <p className="muted">{event.productName}</p>
          </div>
          <span className={`product-history-event-pill ${getEventClassName(event.eventType)}`}>
            {PRODUCT_HISTORY_EVENT_TYPE_LABELS[event.eventType]}
          </span>
        </div>
      </section>

      <section className="card product-history-detail-card">
        <h3>Detay</h3>
        <div className="product-history-detail-grid">
          <div><span>Ürün</span><strong>{event.productName}</strong></div>
          <div><span>Production Order</span><strong>{productionOrder?.workOrderNo || event.productionOrderNo || '-'}</strong></div>
          <div><span>Inventory Lot</span><strong>{lot?.lotNo || event.lotNo || '-'}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot, branchMap)}</strong></div>
          <div><span>Quality Sample</span><strong>{sample?.sampleNo || event.sampleNo || '-'}</strong></div>
          <div><span>Witness Sample</span><strong>{witnessSample?.witnessNo || event.witnessNo || '-'}</strong></div>
          <div><span>Recall</span><strong>{recall?.recallNo || event.recallNo || '-'}</strong></div>
          <div><span>Tarih</span><strong>{formatDate(event.dateKey)} {event.timeKey}</strong></div>
        </div>
      </section>

      <ProductHistorySourcePanel
        lot={lot}
        productionOrder={productionOrder}
        recall={recall}
        sample={sample}
        witnessSample={witnessSample}
      />

      <section className="card product-history-detail-card">
        <h3>İlişkili Kayıtlar</h3>
        <div className="product-history-related-list">
          <div className="product-history-related-row">
            <strong>{relatedSamples.length}</strong>
            <span>Quality Sample</span>
          </div>
          <div className="product-history-related-row">
            <strong>{relatedWitnessSamples.length}</strong>
            <span>Witness Sample</span>
          </div>
          <div className="product-history-related-row">
            <strong>{relatedRecalls.length}</strong>
            <span>Recall</span>
          </div>
        </div>
      </section>

      <section className="card product-history-detail-card">
        <h3>Timeline</h3>
        <div className="product-history-timeline-list">
          {contextEvents.map(contextEvent => (
            <div
              key={contextEvent.id}
              className={`product-history-timeline-item ${getEventClassName(contextEvent.eventType)} ${contextEvent.id === event.id ? 'active' : ''}`}
            >
              <span>{contextEvent.timeKey}</span>
              <strong>{contextEvent.referenceNo}</strong>
              <small>{PRODUCT_HISTORY_EVENT_TYPE_LABELS[contextEvent.eventType]}</small>
              <p>{contextEvent.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function ProductHistorySourcePanel({
  lot,
  productionOrder,
  recall,
  sample,
  witnessSample
}: {
  lot: InventoryLot | null
  productionOrder: ProductionWorkOrder | null
  recall: ProductRecall | null
  sample: QualitySample | null
  witnessSample: WitnessSample | null
}){
  return (
    <section className="card product-history-detail-card">
      <h3>Kaynak Kayıt</h3>
      <div className="product-history-source-list">
        {productionOrder && (
          <div className="product-history-source-row">
            <strong>{productionOrder.workOrderNo}</strong>
            <span>{productionOrder.status} · {productionOrder.lines.length} ürün satırı · {formatDate(productionOrder.deliveryDate)}</span>
          </div>
        )}
        {lot && (
          <div className="product-history-source-row">
            <strong>{lot.lotNo}</strong>
            <span>{INVENTORY_LOT_STATUS_LABELS[lot.status]} · {formatQuantity(lot.quantity, lot.unit)} · SKT {formatDate(lot.expiryDate)}</span>
          </div>
        )}
        {sample && (
          <div className="product-history-source-row">
            <strong>{sample.sampleNo}</strong>
            <span>{QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType]} · {QUALITY_SAMPLE_STATUS_LABELS[sample.status]} · {formatDate(sample.sampleDate)}</span>
          </div>
        )}
        {witnessSample && (
          <div className="product-history-source-row">
            <strong>{witnessSample.witnessNo}</strong>
            <span>{WITNESS_SAMPLE_STATUS_LABELS[witnessSample.status]} · {witnessSample.storageLocation} · {formatDate(witnessSample.storageEndDate)}</span>
          </div>
        )}
        {recall && (
          <div className="product-history-source-row">
            <strong>{recall.recallNo}</strong>
            <span>{PRODUCT_RECALL_REASON_LABELS[recall.reason]} · {PRODUCT_RECALL_RISK_LEVEL_LABELS[recall.riskLevel]} · {PRODUCT_RECALL_STATUS_LABELS[recall.status]}</span>
          </div>
        )}
      </div>
    </section>
  )
}
