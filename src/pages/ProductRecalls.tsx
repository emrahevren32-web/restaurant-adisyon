import React from 'react'
import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import {
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
  PRODUCT_RECALL_REASONS,
  PRODUCT_RECALL_RISK_LEVEL_LABELS,
  PRODUCT_RECALL_RISK_LEVELS,
  PRODUCT_RECALL_STATUS_LABELS,
  PRODUCT_RECALL_STATUSES,
  createProductRecallRecord,
  getNextProductRecallNo,
  loadProductRecallRecords,
  saveProductRecallRecords,
  validateProductRecallInput
} from '../product-recalls/product-recall.mock'
import type { ProductRecallInput } from '../product-recalls/product-recall.mock'
import type {
  ProductRecall,
  ProductRecallReason,
  ProductRecallRiskLevel,
  ProductRecallStatus
} from '../product-recalls/product-recall.types'
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
type RecallStatusFilter = ProductRecallStatus | FilterValue
type RecallRiskFilter = ProductRecallRiskLevel | FilterValue
type RecallReasonFilter = ProductRecallReason | FilterValue
type RecallFormMode = 'create' | 'edit'

type ProductRecallInitialData = {
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

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: ProductRecallStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'OPEN') return 'info-pill'
  if(status === 'UNDER_INVESTIGATION' || status === 'IN_PROGRESS') return 'warning-pill'
  if(status === 'CANCELLED') return 'muted-pill'
  return 'muted-pill'
}

const getRiskClass = (riskLevel: ProductRecallRiskLevel) => {
  if(riskLevel === 'CRITICAL') return 'danger-pill'
  if(riskLevel === 'HIGH') return 'warning-pill'
  if(riskLevel === 'MEDIUM') return 'info-pill'
  return 'muted-pill'
}

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

const getAvailableLots = (inventoryLots: InventoryLot[]) => {
  const productionLots = inventoryLots.filter(isProductionInventoryLot)
  return productionLots.length > 0 ? productionLots : inventoryLots
}

const getProductLabel = (
  lot: InventoryLot | null,
  productMap: Map<string, InventoryLotProductReference>,
  stockItemMap: Map<string, StockItem>
) => {
  if(!lot) return 'Product bulunamadı'
  return productMap.get(lot.productId)?.name
    || stockItemMap.get(lot.stockItemId)?.name
    || 'Product bulunamadı'
}

const getProductionOrderLabel = (
  lot: InventoryLot | null,
  productionOrderMap: Map<string, ProductionWorkOrder>
) => {
  if(!lot?.productionOrderId) return '-'
  return productionOrderMap.get(lot.productionOrderId)?.workOrderNo || 'Production Order bulunamadı'
}

const getWarehouseLabel = (lot: InventoryLot | null, branchMap: Map<string, Branch>) => {
  if(!lot) return '-'
  return branchMap.get(lot.warehouseId)?.name || 'Warehouse bulunamadı'
}

const getLotQuantity = (lot: InventoryLot | null) => (
  lot?.remainingQuantity || lot?.quantity || lot?.receivedQuantity || 1
)

const getRelatedSamples = (
  recall: ProductRecall | null,
  qualitySamples: QualitySample[]
) => (
  recall ? qualitySamples.filter(sample => sample.inventoryLotId === recall.inventoryLotId) : []
)

const getRelatedWitnessSamples = (
  relatedSamples: QualitySample[],
  witnessSamples: WitnessSample[]
) => {
  const sampleIds = new Set(relatedSamples.map(sample => sample.id))
  return witnessSamples.filter(sample => sampleIds.has(sample.qualitySampleId))
}

const loadInitialData = (): ProductRecallInitialData => {
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
  const qualitySamples = loadQualitySampleRecords(inventoryLots)
  const witnessSamples = loadWitnessSampleRecords(qualitySamples)
  const recalls = loadProductRecallRecords(inventoryLots)

  return {
    branches,
    inventoryLots,
    productRefs,
    productionOrders,
    qualitySamples,
    recalls,
    stockItems,
    witnessSamples
  }
}

const createEmptyForm = (
  recalls: ProductRecall[],
  inventoryLots: InventoryLot[],
  currentUser: User
): ProductRecallInput => {
  const lot = getAvailableLots(inventoryLots)[0] || null
  const affectedQuantity = Math.max(0.001, Math.round(getLotQuantity(lot) * 0.1 * 1000) / 1000)

  return {
    recallNo: getNextProductRecallNo(recalls),
    inventoryLotId: lot?.id || '',
    reason: 'OTHER',
    riskLevel: 'MEDIUM',
    status: 'OPEN',
    affectedQuantity,
    unit: lot?.unit || 'adet',
    reportedDate: todayKey(),
    resolvedDate: '',
    description: '',
    createdBy: getUserName(currentUser)
  }
}

const createFormFromRecall = (recall: ProductRecall): ProductRecallInput => ({
  recallNo: recall.recallNo,
  inventoryLotId: recall.inventoryLotId,
  reason: recall.reason,
  riskLevel: recall.riskLevel,
  status: recall.status,
  affectedQuantity: recall.affectedQuantity,
  unit: recall.unit,
  reportedDate: recall.reportedDate,
  resolvedDate: recall.resolvedDate,
  description: recall.description,
  createdBy: recall.createdBy
})

export default function ProductRecalls({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ProductRecall[]>(initialData.recalls)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<RecallStatusFilter>('all')
  const [riskFilter, setRiskFilter] = React.useState<RecallRiskFilter>('all')
  const [reasonFilter, setReasonFilter] = React.useState<RecallReasonFilter>('all')
  const [reportedDateFilter, setReportedDateFilter] = React.useState('')
  const [formMode, setFormMode] = React.useState<RecallFormMode>('create')
  const [form, setForm] = React.useState<ProductRecallInput>(() => (
    createEmptyForm(initialData.recalls, initialData.inventoryLots, currentUser)
  ))
  const [formError, setFormError] = React.useState('')

  const { branches, inventoryLots, productRefs, productionOrders, qualitySamples, stockItems, witnessSamples } = initialData
  const availableLots = React.useMemo(() => getAvailableLots(inventoryLots), [inventoryLots])
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const productMap = React.useMemo(() => new Map(productRefs.map(product => [product.id, product])), [productRefs])
  const productionOrderMap = React.useMemo(() => (
    new Map(productionOrders.map(order => [order.id, order]))
  ), [productionOrders])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])

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
      const lot = lotMap.get(record.inventoryLotId) || null
      const productLabel = getProductLabel(lot, productMap, stockItemMap)
      const searchFields = [
        record.recallNo,
        lot?.lotNo || '',
        productLabel
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesRisk = riskFilter === 'all' || record.riskLevel === riskFilter
      const matchesReason = reasonFilter === 'all' || record.reason === reasonFilter
      const matchesReportedDate = !reportedDateFilter || record.reportedDate === reportedDateFilter

      return matchesSearch && matchesStatus && matchesRisk && matchesReason && matchesReportedDate
    })
  }, [lotMap, productMap, reasonFilter, records, reportedDateFilter, riskFilter, search, statusFilter, stockItemMap])

  const openCount = records.filter(record => record.status === 'OPEN').length
  const investigationCount = records.filter(record => record.status === 'UNDER_INVESTIGATION').length
  const progressCount = records.filter(record => record.status === 'IN_PROGRESS').length
  const criticalCount = records.filter(record => record.riskLevel === 'CRITICAL').length

  const commitRecords = (nextRecords: ProductRecall[]) => {
    setRecords(nextRecords)
    saveProductRecallRecords(nextRecords)
  }

  const startCreate = () => {
    setFormMode('create')
    setFormError('')
    setForm(createEmptyForm(records, inventoryLots, currentUser))
  }

  const startEdit = (record: ProductRecall) => {
    setFormMode('edit')
    setFormError('')
    setSelectedRecordId(record.id)
    setForm(createFormFromRecall(record))
  }

  const handleLotChange = (inventoryLotId: string) => {
    const lot = lotMap.get(inventoryLotId) || null
    const affectedQuantity = Math.max(0.001, Math.round(getLotQuantity(lot) * 0.1 * 1000) / 1000)

    setForm(prev => ({
      ...prev,
      inventoryLotId,
      affectedQuantity: prev.affectedQuantity > 0 ? prev.affectedQuantity : affectedQuantity,
      unit: lot?.unit || prev.unit
    }))
  }

  const saveForm = () => {
    const validationError = validateProductRecallInput(
      form,
      lotMap,
      records,
      formMode === 'edit' ? selectedRecord?.id || '' : ''
    )
    if(validationError){
      setFormError(validationError)
      return
    }

    const nextRecord = createProductRecallRecord(
      form,
      formMode === 'edit' ? selectedRecord || undefined : undefined
    )
    const nextRecords = formMode === 'edit' && selectedRecord
      ? records.map(record => record.id === selectedRecord.id ? nextRecord : record)
      : [nextRecord, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setFormMode('edit')
    setForm(createFormFromRecall(nextRecord))
    setFormError('')
  }

  const updateStatus = (record: ProductRecall, status: ProductRecallStatus) => {
    const nextRecord = createProductRecallRecord({ ...createFormFromRecall(record), status }, record)
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    if(formMode === 'edit' && form.recallNo === record.recallNo) setForm(createFormFromRecall(nextRecord))
  }

  return (
    <div className="product-recall-page">
      <div className="page-header">
        <div>
          <h2>Recall Management</h2>
          <p className="muted">Kalite problemi tespit edilen lotlar için geri çağırma sürecini yönetin.</p>
        </div>
        <div className="product-recall-header-actions">
          <span className="muted">Created By: {getUserName(currentUser)}</span>
          <button className="btn primary" type="button" onClick={startCreate}>Yeni Recall</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Açık</span>
          <strong>{openCount}</strong>
        </div>
        <div className="metric-card">
          <span>İncelemede</span>
          <strong>{investigationCount}</strong>
        </div>
        <div className="metric-card">
          <span>Devam Ediyor</span>
          <strong>{progressCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kritik Risk</span>
          <strong>{criticalCount}</strong>
        </div>
      </div>

      <div className="product-layout product-recall-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Recall Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="product-recall-toolbar">
            <input
              type="search"
              placeholder="Recall No, Lot No veya Product ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as RecallStatusFilter)}>
              <option value="all">Tüm Status</option>
              {PRODUCT_RECALL_STATUSES.map(status => (
                <option key={status} value={status}>{PRODUCT_RECALL_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={riskFilter} onChange={event => setRiskFilter(event.target.value as RecallRiskFilter)}>
              <option value="all">Tüm Risk Level</option>
              {PRODUCT_RECALL_RISK_LEVELS.map(riskLevel => (
                <option key={riskLevel} value={riskLevel}>{PRODUCT_RECALL_RISK_LEVEL_LABELS[riskLevel]}</option>
              ))}
            </select>
            <select value={reasonFilter} onChange={event => setReasonFilter(event.target.value as RecallReasonFilter)}>
              <option value="all">Tüm Reason</option>
              {PRODUCT_RECALL_REASONS.map(reason => (
                <option key={reason} value={reason}>{PRODUCT_RECALL_REASON_LABELS[reason]}</option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Reported Date filtresi"
              value={reportedDateFilter}
              onChange={event => setReportedDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap product-recall-table-wrap">
            <table className="data-table product-recall-table">
              <thead>
                <tr>
                  <th>Recall No</th>
                  <th>Lot No</th>
                  <th>Product</th>
                  <th>Reason</th>
                  <th>Risk Level</th>
                  <th>Reported Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun recall kaydı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const lot = lotMap.get(record.inventoryLotId) || null

                  return (
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
                      <td data-label="Recall No"><strong>{record.recallNo}</strong></td>
                      <td data-label="Lot No">{lot?.lotNo || 'Lot bulunamadı'}</td>
                      <td data-label="Product">{getProductLabel(lot, productMap, stockItemMap)}</td>
                      <td data-label="Reason">{PRODUCT_RECALL_REASON_LABELS[record.reason]}</td>
                      <td data-label="Risk Level">
                        <span className={`status-pill ${getRiskClass(record.riskLevel)}`}>
                          {PRODUCT_RECALL_RISK_LEVEL_LABELS[record.riskLevel]}
                        </span>
                      </td>
                      <td data-label="Reported Date">{formatDate(record.reportedDate)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {PRODUCT_RECALL_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side product-recall-side">
          <ProductRecallDetailPanel
            branchMap={branchMap}
            lotMap={lotMap}
            productMap={productMap}
            productionOrderMap={productionOrderMap}
            qualitySamples={qualitySamples}
            record={selectedRecord}
            stockItemMap={stockItemMap}
            witnessSamples={witnessSamples}
            onEdit={startEdit}
            onStatusChange={updateStatus}
          />
          <ProductRecallFormPanel
            availableLots={availableLots}
            form={form}
            formError={formError}
            formMode={formMode}
            productMap={productMap}
            stockItemMap={stockItemMap}
            onCancel={startCreate}
            onChange={setForm}
            onLotChange={handleLotChange}
            onSave={saveForm}
          />
        </aside>
      </div>
    </div>
  )
}

function ProductRecallDetailPanel({
  branchMap,
  lotMap,
  productMap,
  productionOrderMap,
  qualitySamples,
  record,
  stockItemMap,
  witnessSamples,
  onEdit,
  onStatusChange
}: {
  branchMap: Map<string, Branch>
  lotMap: Map<string, InventoryLot>
  productMap: Map<string, InventoryLotProductReference>
  productionOrderMap: Map<string, ProductionWorkOrder>
  qualitySamples: QualitySample[]
  record: ProductRecall | null
  stockItemMap: Map<string, StockItem>
  witnessSamples: WitnessSample[]
  onEdit: (record: ProductRecall) => void
  onStatusChange: (record: ProductRecall, status: ProductRecallStatus) => void
}){
  if(!record){
    return (
      <section className="card product-recall-detail-card">
        <div className="section-header compact">
          <h3>Recall Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir recall kaydı seçin.</p>
      </section>
    )
  }

  const lot = lotMap.get(record.inventoryLotId) || null
  const relatedSamples = getRelatedSamples(record, qualitySamples)
  const relatedWitnessSamples = getRelatedWitnessSamples(relatedSamples, witnessSamples)

  return (
    <>
      <section className="card product-recall-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.recallNo}</h3>
            <p className="muted">{lot?.lotNo || 'Lot bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {PRODUCT_RECALL_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="product-recall-side-actions">
          <select value={record.status} onChange={event => onStatusChange(record, event.target.value as ProductRecallStatus)}>
            {PRODUCT_RECALL_STATUSES.map(status => (
              <option key={status} value={status}>{PRODUCT_RECALL_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
        </div>
      </section>

      <section className="card product-recall-detail-card">
        <h3>Detay</h3>
        <div className="product-recall-detail-grid">
          <div><span>Inventory Lot</span><strong>{lot?.lotNo || 'Lot bulunamadı'}</strong></div>
          <div><span>Production Order</span><strong>{getProductionOrderLabel(lot, productionOrderMap)}</strong></div>
          <div><span>Product</span><strong>{getProductLabel(lot, productMap, stockItemMap)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot, branchMap)}</strong></div>
          <div><span>Reason</span><strong>{PRODUCT_RECALL_REASON_LABELS[record.reason]}</strong></div>
          <div><span>Risk Level</span><strong>{PRODUCT_RECALL_RISK_LEVEL_LABELS[record.riskLevel]}</strong></div>
          <div><span>Affected Quantity</span><strong>{formatQuantity(record.affectedQuantity, record.unit)}</strong></div>
          <div><span>Reported Date</span><strong>{formatDate(record.reportedDate)}</strong></div>
          <div><span>Resolved Date</span><strong>{formatDate(record.resolvedDate)}</strong></div>
          <div><span>Created By</span><strong>{record.createdBy}</strong></div>
          <div><span>Status</span><strong>{PRODUCT_RECALL_STATUS_LABELS[record.status]}</strong></div>
        </div>
      </section>

      <section className="card product-recall-detail-card">
        <h3>Description</h3>
        <p className="product-recall-notes">{record.description || '-'}</p>
      </section>

      <section className="card product-recall-detail-card">
        <h3>İlgili Numuneler</h3>
        <div className="product-recall-related-list">
          {relatedSamples.length === 0 && <p className="muted">Bu lot için ilişkili numune bulunamadı.</p>}
          {relatedSamples.map(sample => (
            <div key={sample.id} className="product-recall-related-row">
              <strong>{sample.sampleNo}</strong>
              <span>{QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType]} · {formatDate(sample.sampleDate)} · {QUALITY_SAMPLE_STATUS_LABELS[sample.status]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card product-recall-detail-card">
        <h3>İlgili Şahit Numuneler</h3>
        <div className="product-recall-related-list">
          {relatedWitnessSamples.length === 0 && <p className="muted">Bu lot için ilişkili şahit numune bulunamadı.</p>}
          {relatedWitnessSamples.map(sample => (
            <div key={sample.id} className="product-recall-related-row">
              <strong>{sample.witnessNo}</strong>
              <span>{sample.storageLocation} · {formatDate(sample.storageEndDate)} · {WITNESS_SAMPLE_STATUS_LABELS[sample.status]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function ProductRecallFormPanel({
  availableLots,
  form,
  formError,
  formMode,
  productMap,
  stockItemMap,
  onCancel,
  onChange,
  onLotChange,
  onSave
}: {
  availableLots: InventoryLot[]
  form: ProductRecallInput
  formError: string
  formMode: RecallFormMode
  productMap: Map<string, InventoryLotProductReference>
  stockItemMap: Map<string, StockItem>
  onCancel: () => void
  onChange: React.Dispatch<React.SetStateAction<ProductRecallInput>>
  onLotChange: (inventoryLotId: string) => void
  onSave: () => void
}){
  return (
    <section className="card product-recall-form">
      <div className="section-header compact">
        <div>
          <h3>{formMode === 'edit' ? 'Recall Düzenle' : 'Recall Oluştur'}</h3>
          <p className="muted">Recall kaydı yalnızca Inventory Lot ID ile ilişkilendirilir.</p>
        </div>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <div className="product-recall-form-grid">
        <label className="form-field">
          <span>Recall No</span>
          <input
            value={form.recallNo}
            onChange={event => onChange(prev => ({ ...prev, recallNo: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Status</span>
          <select value={form.status} onChange={event => onChange(prev => ({ ...prev, status: event.target.value as ProductRecallStatus }))}>
            {PRODUCT_RECALL_STATUSES.map(status => (
              <option key={status} value={status}>{PRODUCT_RECALL_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="form-field product-recall-form-wide">
          <span>Inventory Lot</span>
          <select value={form.inventoryLotId} onChange={event => onLotChange(event.target.value)}>
            {availableLots.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNo} - {getProductLabel(lot, productMap, stockItemMap)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Reason</span>
          <select value={form.reason} onChange={event => onChange(prev => ({ ...prev, reason: event.target.value as ProductRecallReason }))}>
            {PRODUCT_RECALL_REASONS.map(reason => (
              <option key={reason} value={reason}>{PRODUCT_RECALL_REASON_LABELS[reason]}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Risk Level</span>
          <select value={form.riskLevel} onChange={event => onChange(prev => ({ ...prev, riskLevel: event.target.value as ProductRecallRiskLevel }))}>
            {PRODUCT_RECALL_RISK_LEVELS.map(riskLevel => (
              <option key={riskLevel} value={riskLevel}>{PRODUCT_RECALL_RISK_LEVEL_LABELS[riskLevel]}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Affected Quantity</span>
          <input
            min="0"
            step="0.001"
            type="number"
            value={form.affectedQuantity}
            onChange={event => onChange(prev => ({ ...prev, affectedQuantity: Number(event.target.value) }))}
          />
        </label>
        <label className="form-field">
          <span>Unit</span>
          <select value={form.unit} onChange={event => onChange(prev => ({ ...prev, unit: event.target.value as StockUnit }))}>
            {STOCK_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Reported Date</span>
          <input
            type="date"
            value={form.reportedDate}
            onChange={event => onChange(prev => ({
              ...prev,
              reportedDate: event.target.value,
              resolvedDate: prev.resolvedDate && prev.resolvedDate < event.target.value ? event.target.value : prev.resolvedDate
            }))}
          />
        </label>
        <label className="form-field">
          <span>Resolved Date</span>
          <input
            type="date"
            value={form.resolvedDate}
            onChange={event => onChange(prev => ({ ...prev, resolvedDate: event.target.value }))}
          />
        </label>
        <label className="form-field product-recall-form-wide">
          <span>Created By</span>
          <input
            value={form.createdBy}
            onChange={event => onChange(prev => ({ ...prev, createdBy: event.target.value }))}
          />
        </label>
        <label className="form-field product-recall-form-wide">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={event => onChange(prev => ({ ...prev, description: event.target.value }))}
          />
        </label>
      </div>

      <div className="product-recall-side-actions">
        <button className="btn primary" type="button" onClick={onSave}>
          {formMode === 'edit' ? 'Güncelle' : 'Oluştur'}
        </button>
        {formMode === 'edit' && (
          <button className="btn secondary" type="button" onClick={onCancel}>Yeni Recall</button>
        )}
      </div>
    </section>
  )
}
