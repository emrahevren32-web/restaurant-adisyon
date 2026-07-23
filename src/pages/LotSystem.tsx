import React from 'react'
import {
  INVENTORY_LOT_STATUS_LABELS,
  LOT_SYSTEM_STATUSES,
  createProductionInventoryLotRecord,
  getNextLotSystemNo,
  getProductionOrderLineLotUnit,
  getProductionOrderLineProductId,
  isProductionInventoryLot,
  loadLotSystemInventoryLotRecords,
  saveInventoryLotRecords,
  validateInventoryLotManagementInput
} from '../inventory-lots/inventory-lot.mock'
import type {
  InventoryLotManagementInput,
  InventoryLotProductReference
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot, InventoryLotStatus } from '../inventory-lots/inventory-lot.types'
import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadIntermediateProducts } from '../intermediate-products/intermediate-product.mock'
import type { IntermediateProduct } from '../intermediate-products/intermediate-product.types'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import { loadProductionWorkOrders } from '../production-work-orders/production-work-order.mock'
import type {
  ProductionWorkOrder,
  ProductionWorkOrderLine
} from '../production-work-orders/production-work-order.types'
import { loadBranches, loadStockItems } from '../storage'
import type { Branch, StockItem, StockUnit, User } from '../types'

type FilterValue = 'all'
type StatusFilter = InventoryLotStatus | FilterValue

type LotSystemInitialData = {
  branches: Branch[]
  inventoryLots: InventoryLot[]
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  stockItems: StockItem[]
}

type LotFormMode = 'create' | 'edit'

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

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

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const getStatusClass = (status: InventoryLotStatus) => {
  if(status === 'ACTIVE' || status === 'RELEASED') return 'success'
  if(status === 'PLANNED') return 'info-pill'
  if(status === 'QUARANTINE') return 'warning-pill'
  if(status === 'EXPIRED' || status === 'DISPOSED') return 'danger-pill'
  return 'muted-pill'
}

const getWarehouseLabel = (warehouseId: string, branchMap: Map<string, Branch>) => (
  branchMap.get(warehouseId)?.name || 'Warehouse bulunamadı'
)

const getProductionOrderLabel = (
  productionOrderId: string,
  productionOrderMap: Map<string, ProductionWorkOrder>
) => {
  const order = productionOrderMap.get(productionOrderId)
  return order ? order.workOrderNo : 'Production Order bulunamadı'
}

const findLineByProductId = (
  order: ProductionWorkOrder | null,
  productId: string,
  productRefs: InventoryLotProductReference[]
) => (
  order?.lines.find(line => getProductionOrderLineProductId(line, productRefs) === productId) || null
)

const findLineAcrossOrders = (
  productId: string,
  productionOrders: ProductionWorkOrder[],
  productRefs: InventoryLotProductReference[]
) => {
  for(const order of productionOrders){
    const line = findLineByProductId(order, productId, productRefs)
    if(line) return line
  }

  return null
}

const getProductLabel = (
  productId: string,
  productMap: Map<string, InventoryLotProductReference>,
  productionOrders: ProductionWorkOrder[],
  productRefs: InventoryLotProductReference[]
) => (
  productMap.get(productId)?.name
  || findLineAcrossOrders(productId, productionOrders, productRefs)?.productName
  || 'Product bulunamadı'
)

const getWarehouseForOrder = (
  order: ProductionWorkOrder | null,
  branches: Branch[]
) => (
  branches.find(branch => toSearchText(branch.name) === toSearchText(order?.branch || ''))
  || branches[0]
  || null
)

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

const loadInitialData = (): LotSystemInitialData => {
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

  return {
    branches,
    inventoryLots,
    productRefs,
    productionOrders,
    stockItems
  }
}

const createEmptyForm = (
  records: InventoryLot[],
  productionOrders: ProductionWorkOrder[],
  branches: Branch[],
  productRefs: InventoryLotProductReference[]
): InventoryLotManagementInput => {
  const order = productionOrders.find(item => item.status !== 'İptal') || productionOrders[0] || null
  const line = order?.lines[0] || null
  const productionDate = todayKey()
  const warehouse = getWarehouseForOrder(order, branches)

  return {
    lotNo: getNextLotSystemNo(records, productionDate),
    productionOrderId: order?.id || '',
    productId: line ? getProductionOrderLineProductId(line, productRefs) : '',
    warehouseId: warehouse?.id || '',
    productionDate,
    expiryDate: addDays(productionDate, 7),
    quantity: line?.quantity || 1,
    unit: line ? getProductionOrderLineLotUnit(line, productRefs) : 'adet',
    status: 'ACTIVE',
    notes: ''
  }
}

const createFormFromLot = (lot: InventoryLot): InventoryLotManagementInput => ({
  lotNo: lot.lotNo,
  productionOrderId: lot.productionOrderId,
  productId: lot.productId,
  warehouseId: lot.warehouseId,
  productionDate: lot.productionDate,
  expiryDate: lot.expiryDate,
  quantity: lot.quantity,
  unit: lot.unit,
  status: lot.status,
  notes: lot.notes
})

export default function LotSystem({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [productionDateFilter, setProductionDateFilter] = React.useState('')
  const [expiryDateFilter, setExpiryDateFilter] = React.useState('')
  const [formMode, setFormMode] = React.useState<LotFormMode>('create')
  const [form, setForm] = React.useState<InventoryLotManagementInput>(() => (
    createEmptyForm(initialData.inventoryLots, initialData.productionOrders, initialData.branches, initialData.productRefs)
  ))
  const [formError, setFormError] = React.useState('')

  const { branches, productRefs, productionOrders } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const productMap = React.useMemo(() => new Map(productRefs.map(product => [product.id, product])), [productRefs])
  const productionOrderMap = React.useMemo(() => (
    new Map(productionOrders.map(order => [order.id, order]))
  ), [productionOrders])

  const productionLots = React.useMemo(() => (
    records.filter(isProductionInventoryLot)
  ), [records])

  const selectedRecord = React.useMemo(() => (
    productionLots.find(record => record.id === selectedRecordId) || productionLots[0] || null
  ), [productionLots, selectedRecordId])

  const selectedOrder = productionOrderMap.get(form.productionOrderId) || null
  const selectedOrderLines = selectedOrder?.lines || []

  React.useEffect(() => {
    if(selectedRecordId && productionLots.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(productionLots[0]?.id || '')
  }, [productionLots, selectedRecordId])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return productionLots.filter(record => {
      const productionOrder = productionOrderMap.get(record.productionOrderId)
      const productLabel = getProductLabel(record.productId, productMap, productionOrders, productRefs)
      const searchFields = [
        record.lotNo,
        productLabel,
        productionOrder?.workOrderNo || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
      const matchesProductionDate = !productionDateFilter || record.productionDate === productionDateFilter
      const matchesExpiryDate = !expiryDateFilter || record.expiryDate === expiryDateFilter

      return matchesSearch && matchesStatus && matchesWarehouse && matchesProductionDate && matchesExpiryDate
    })
  }, [
    expiryDateFilter,
    productionDateFilter,
    productionLots,
    productionOrderMap,
    productMap,
    productRefs,
    productionOrders,
    search,
    statusFilter,
    warehouseFilter
  ])

  const plannedCount = productionLots.filter(record => record.status === 'PLANNED').length
  const activeCount = productionLots.filter(record => record.status === 'ACTIVE').length
  const releasedCount = productionLots.filter(record => record.status === 'RELEASED').length
  const quarantineCount = productionLots.filter(record => record.status === 'QUARANTINE').length

  const commitRecords = (nextRecords: InventoryLot[]) => {
    setRecords(nextRecords)
    saveInventoryLotRecords(nextRecords)
  }

  const startCreate = () => {
    setFormMode('create')
    setFormError('')
    setForm(createEmptyForm(records, productionOrders, branches, productRefs))
  }

  const startEdit = (lot: InventoryLot) => {
    setFormMode('edit')
    setFormError('')
    setSelectedRecordId(lot.id)
    setForm(createFormFromLot(lot))
  }

  const handleOrderChange = (productionOrderId: string) => {
    const order = productionOrderMap.get(productionOrderId) || null
    const line = order?.lines[0] || null
    const warehouse = getWarehouseForOrder(order, branches)

    setForm(prev => ({
      ...prev,
      productionOrderId,
      productId: line ? getProductionOrderLineProductId(line, productRefs) : '',
      warehouseId: warehouse?.id || prev.warehouseId,
      quantity: line?.quantity || prev.quantity,
      unit: line ? getProductionOrderLineLotUnit(line, productRefs) : prev.unit
    }))
  }

  const handleProductChange = (productId: string) => {
    const line = findLineByProductId(selectedOrder, productId, productRefs)

    setForm(prev => ({
      ...prev,
      productId,
      quantity: line?.quantity || prev.quantity,
      unit: line ? getProductionOrderLineLotUnit(line, productRefs) : prev.unit
    }))
  }

  const handleProductionDateChange = (productionDate: string) => {
    setForm(prev => ({
      ...prev,
      productionDate,
      expiryDate: prev.expiryDate && prev.expiryDate >= productionDate ? prev.expiryDate : addDays(productionDate, 7),
      lotNo: formMode === 'create' ? getNextLotSystemNo(records, productionDate) : prev.lotNo
    }))
  }

  const saveForm = () => {
    const validationError = validateInventoryLotManagementInput(form, records, formMode === 'edit' ? selectedRecord?.id || '' : '')
    if(validationError){
      setFormError(validationError)
      return
    }

    const nextLot = createProductionInventoryLotRecord(
      form,
      productRefs,
      formMode === 'edit' ? selectedRecord || undefined : undefined
    )
    const nextRecords = formMode === 'edit' && selectedRecord
      ? records.map(record => record.id === selectedRecord.id ? nextLot : record)
      : [nextLot, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextLot.id)
    setFormMode('edit')
    setForm(createFormFromLot(nextLot))
    setFormError('')
  }

  const updateStatus = (lot: InventoryLot, status: InventoryLotStatus) => {
    const nextLot = createProductionInventoryLotRecord(
      {
        ...createFormFromLot(lot),
        status
      },
      productRefs,
      lot
    )

    commitRecords(records.map(record => record.id === lot.id ? nextLot : record))
    setSelectedRecordId(lot.id)
    if(formMode === 'edit' && form.lotNo === lot.lotNo) setForm(createFormFromLot(nextLot))
  }

  return (
    <div className="lot-system-page">
      <div className="page-header">
        <div>
          <h2>Lot Sistemi</h2>
          <p className="muted">Üretim emri kaynaklı batch takibini, depo ilişkisini ve SKT yaşam döngüsünü yönetin.</p>
        </div>
        <div className="lot-system-header-actions">
          <span className="muted">Operatör: {currentUser.fullName}</span>
          <button className="btn primary" type="button" onClick={startCreate}>Yeni Lot</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Planlandı</span>
          <strong>{plannedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Serbest</span>
          <strong>{releasedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Karantina</span>
          <strong>{quarantineCount}</strong>
        </div>
      </div>

      <div className="product-layout lot-system-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Lot Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="lot-system-toolbar">
            <input
              type="search"
              placeholder="Lot No, Product veya Production Order ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {LOT_SYSTEM_STATUSES.map(status => (
                <option key={status} value={status}>{INVENTORY_LOT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Warehouse</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <input
              type="date"
              aria-label="Production Date filtresi"
              value={productionDateFilter}
              onChange={event => setProductionDateFilter(event.target.value)}
            />
            <input
              type="date"
              aria-label="Expiry Date filtresi"
              value={expiryDateFilter}
              onChange={event => setExpiryDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap lot-system-table-wrap">
            <table className="data-table lot-system-table">
              <thead>
                <tr>
                  <th>Lot No</th>
                  <th>Product</th>
                  <th>Production Order</th>
                  <th>Warehouse</th>
                  <th>Production Date</th>
                  <th>Expiry Date</th>
                  <th>Quantity</th>
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
                    <td data-label="Product">{getProductLabel(record.productId, productMap, productionOrders, productRefs)}</td>
                    <td data-label="Production Order">{getProductionOrderLabel(record.productionOrderId, productionOrderMap)}</td>
                    <td data-label="Warehouse">{getWarehouseLabel(record.warehouseId, branchMap)}</td>
                    <td data-label="Production Date">{formatDate(record.productionDate)}</td>
                    <td data-label="Expiry Date">{formatDate(record.expiryDate)}</td>
                    <td data-label="Quantity">{formatQuantity(record.quantity, record.unit)}</td>
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

        <aside className="product-side lot-system-side">
          <LotDetailPanel
            lot={selectedRecord}
            branchMap={branchMap}
            productMap={productMap}
            productRefs={productRefs}
            productionOrderMap={productionOrderMap}
            productionOrders={productionOrders}
            onEdit={startEdit}
            onStatusChange={updateStatus}
          />
          <LotFormPanel
            branches={branches}
            form={form}
            formError={formError}
            formMode={formMode}
            productRefs={productRefs}
            productionOrders={productionOrders}
            selectedOrderLines={selectedOrderLines}
            onCancel={startCreate}
            onChange={setForm}
            onOrderChange={handleOrderChange}
            onProductChange={handleProductChange}
            onProductionDateChange={handleProductionDateChange}
            onSave={saveForm}
          />
        </aside>
      </div>
    </div>
  )
}

function LotDetailPanel({
  lot,
  branchMap,
  productMap,
  productRefs,
  productionOrderMap,
  productionOrders,
  onEdit,
  onStatusChange
}: {
  lot: InventoryLot | null
  branchMap: Map<string, Branch>
  productMap: Map<string, InventoryLotProductReference>
  productRefs: InventoryLotProductReference[]
  productionOrderMap: Map<string, ProductionWorkOrder>
  productionOrders: ProductionWorkOrder[]
  onEdit: (lot: InventoryLot) => void
  onStatusChange: (lot: InventoryLot, status: InventoryLotStatus) => void
}){
  if(!lot){
    return (
      <section className="card lot-system-detail-card">
        <div className="section-header compact">
          <h3>Lot Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir lot seçin.</p>
      </section>
    )
  }

  const productionOrder = productionOrderMap.get(lot.productionOrderId) || null

  return (
    <>
      <section className="card lot-system-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{lot.lotNo}</h3>
            <p className="muted">{getProductLabel(lot.productId, productMap, productionOrders, productRefs)}</p>
          </div>
          <span className={`status-pill ${getStatusClass(lot.status)}`}>
            {INVENTORY_LOT_STATUS_LABELS[lot.status]}
          </span>
        </div>
        <div className="lot-system-side-actions">
          <select value={lot.status} onChange={event => onStatusChange(lot, event.target.value as InventoryLotStatus)}>
            {LOT_SYSTEM_STATUSES.map(status => (
              <option key={status} value={status}>{INVENTORY_LOT_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={() => onEdit(lot)}>Düzenle</button>
        </div>
      </section>

      <section className="card lot-system-detail-card">
        <h3>Detay</h3>
        <div className="lot-system-detail-grid">
          <div><span>Production Order</span><strong>{productionOrder?.workOrderNo || '-'}</strong></div>
          <div><span>Product</span><strong>{getProductLabel(lot.productId, productMap, productionOrders, productRefs)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot.warehouseId, branchMap)}</strong></div>
          <div><span>Production Date</span><strong>{formatDate(lot.productionDate)}</strong></div>
          <div><span>Expiry Date</span><strong>{formatDate(lot.expiryDate)}</strong></div>
          <div><span>Quantity</span><strong>{formatQuantity(lot.quantity, lot.unit)}</strong></div>
          <div><span>Unit</span><strong>{lot.unit}</strong></div>
          <div><span>Status</span><strong>{INVENTORY_LOT_STATUS_LABELS[lot.status]}</strong></div>
        </div>
      </section>

      <section className="card lot-system-detail-card">
        <h3>Notlar</h3>
        <p className="lot-system-notes">{lot.notes || '-'}</p>
      </section>
    </>
  )
}

function LotFormPanel({
  branches,
  form,
  formError,
  formMode,
  productRefs,
  productionOrders,
  selectedOrderLines,
  onCancel,
  onChange,
  onOrderChange,
  onProductChange,
  onProductionDateChange,
  onSave
}: {
  branches: Branch[]
  form: InventoryLotManagementInput
  formError: string
  formMode: LotFormMode
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  selectedOrderLines: ProductionWorkOrderLine[]
  onCancel: () => void
  onChange: React.Dispatch<React.SetStateAction<InventoryLotManagementInput>>
  onOrderChange: (productionOrderId: string) => void
  onProductChange: (productId: string) => void
  onProductionDateChange: (productionDate: string) => void
  onSave: () => void
}){
  return (
    <section className="card lot-system-form">
      <div className="section-header compact">
        <div>
          <h3>{formMode === 'edit' ? 'Lot Düzenle' : 'Lot Oluştur'}</h3>
          <p className="muted">Production Order, Product ve Warehouse ilişkileri ID üzerinden tutulur.</p>
        </div>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <div className="lot-system-form-grid">
        <label className="form-field">
          <span>Lot No</span>
          <input
            value={form.lotNo}
            onChange={event => onChange(prev => ({ ...prev, lotNo: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Status</span>
          <select value={form.status} onChange={event => onChange(prev => ({ ...prev, status: event.target.value as InventoryLotStatus }))}>
            {LOT_SYSTEM_STATUSES.map(status => (
              <option key={status} value={status}>{INVENTORY_LOT_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="form-field lot-system-form-wide">
          <span>Production Order</span>
          <select value={form.productionOrderId} onChange={event => onOrderChange(event.target.value)}>
            {productionOrders.map(order => (
              <option key={order.id} value={order.id}>{order.workOrderNo} - {order.branch}</option>
            ))}
          </select>
        </label>
        <label className="form-field lot-system-form-wide">
          <span>Product</span>
          <select value={form.productId} onChange={event => onProductChange(event.target.value)}>
            {selectedOrderLines.map(line => {
              const productId = getProductionOrderLineProductId(line, productRefs)
              return <option key={line.id} value={productId}>{line.productName}</option>
            })}
          </select>
        </label>
        <label className="form-field">
          <span>Warehouse</span>
          <select value={form.warehouseId} onChange={event => onChange(prev => ({ ...prev, warehouseId: event.target.value }))}>
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Unit</span>
          <select value={form.unit} onChange={event => onChange(prev => ({ ...prev, unit: event.target.value as StockUnit }))}>
            {STOCK_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Production Date</span>
          <input
            type="date"
            value={form.productionDate}
            onChange={event => onProductionDateChange(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Expiry Date</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={event => onChange(prev => ({ ...prev, expiryDate: event.target.value }))}
          />
        </label>
        <label className="form-field lot-system-form-wide">
          <span>Quantity</span>
          <input
            min="0"
            step="0.001"
            type="number"
            value={form.quantity}
            onChange={event => onChange(prev => ({ ...prev, quantity: Number(event.target.value) }))}
          />
        </label>
        <label className="form-field lot-system-form-wide">
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={event => onChange(prev => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </div>

      <div className="lot-system-side-actions">
        <button className="btn primary" type="button" onClick={onSave}>
          {formMode === 'edit' ? 'Güncelle' : 'Oluştur'}
        </button>
        {formMode === 'edit' && (
          <button className="btn secondary" type="button" onClick={onCancel}>Yeni Lot</button>
        )}
      </div>
    </section>
  )
}
