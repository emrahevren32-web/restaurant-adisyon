import React from 'react'
import {
  GOODS_RECEIPT_STATUSES,
  GOODS_RECEIPT_STATUS_LABELS,
  applyGoodsReceiptStockQuantities,
  calculateGoodsReceiptStatus,
  calculatePurchaseOrderStatusAfterReceipt,
  getGoodsReceiptOrderLines,
  getGoodsReceiptTotalsByOrderItem,
  getNextGoodsReceiptNo,
  hasOverReceiptQuantity,
  loadGoodsReceiptRecords,
  saveGoodsReceiptRecords
} from '../goods-receipts/goods-receipt.mock'
import type {
  GoodsReceiptItem,
  GoodsReceiptRecord,
  GoodsReceiptStatus
} from '../goods-receipts/goods-receipt.types'
import {
  createInventoryLotsFromGoodsReceipt,
  getNextInventoryLotNo,
  loadInventoryLotRecords,
  saveInventoryLotRecords,
  validateInventoryLotCreateInputs
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLotCreateInput } from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import {
  PURCHASE_ORDER_STATUS_LABELS,
  loadPurchaseOrderRecords,
  savePurchaseOrderRecords
} from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import {
  loadBranches,
  loadStockItems,
  saveStockItems
} from '../storage'
import type { Branch, StockItem, StockUnit, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = GoodsReceiptStatus | FilterValue
type PanelMode = 'detail' | 'form'

type GoodsReceiptLotFormState = {
  id: string
  lotNo: string
  quantity: number
  productionDate: string
  expiryDate: string
  notes: string
}

type GoodsReceiptFormItemState = {
  purchaseOrderItemId: string
  stockItemId: string
  orderedQuantity: number
  receivedQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  unit: StockUnit
  notes: string
  lots: GoodsReceiptLotFormState[]
}

type GoodsReceiptFormState = {
  receiptNo: string
  purchaseOrderId: string
  supplierId: string
  warehouseId: string
  receiptDate: string
  receivedBy: string
  notes: string
  items: GoodsReceiptFormItemState[]
}

type GoodsReceiptInitialData = {
  branches: Branch[]
  stockItems: StockItem[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const normalizeQuantity = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const createLotFormId = () => `lot_form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: GoodsReceiptStatus) => {
  if(status === 'COMPLETED' || status === 'RECEIVED') return 'success'
  if(status === 'CANCELLED') return 'danger-pill'
  if(status === 'PARTIALLY_RECEIVED') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): GoodsReceiptInitialData => {
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

  return {
    branches,
    stockItems,
    purchaseRequests,
    suppliers,
    supplierProducts,
    rfqRecords,
    purchaseOrders,
    goodsReceipts,
    inventoryLots
  }
}

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => {
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const getPurchaseOrderLabel = (purchaseOrderId: string, purchaseOrderMap: Map<string, PurchaseOrder>) => {
  const purchaseOrder = purchaseOrderMap.get(purchaseOrderId)
  return purchaseOrder ? purchaseOrder.orderNo : 'Purchase Order bulunamadı'
}

const getWarehouseLabel = (warehouseId: string, branchMap: Map<string, Branch>) => {
  const branch = branchMap.get(warehouseId)
  return branch ? branch.name : 'Depo bulunamadı'
}

const getRequestLabel = (
  purchaseRequestId: string,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const purchaseRequest = purchaseRequestMap.get(purchaseRequestId)
  return purchaseRequest ? `${purchaseRequest.requestNo} · ${purchaseRequest.title}` : 'Purchase Request bulunamadı'
}

const getOrderWarehouseId = (
  purchaseOrder: PurchaseOrder | null | undefined,
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>,
  branches: Branch[]
) => {
  if(!purchaseOrder) return branches[0]?.id || ''
  const rfq = rfqMap.get(purchaseOrder.rfqId)
  const purchaseRequest = purchaseRequestMap.get(purchaseOrder.purchaseRequestId)
  return rfq?.branchId || purchaseRequest?.branchId || branches[0]?.id || ''
}

const isOrderCompletedByReceipts = (
  purchaseOrder: PurchaseOrder,
  receiptRecords: GoodsReceiptRecord[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
  return calculatePurchaseOrderStatusAfterReceipt(purchaseOrder, lines, receiptRecords) === 'COMPLETED'
}

const getReceivableOrders = (
  purchaseOrders: PurchaseOrder[],
  receiptRecords: GoodsReceiptRecord[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => (
  purchaseOrders.filter(order => (
    order.status !== 'CANCELLED'
    && order.status !== 'COMPLETED'
    && !isOrderCompletedByReceipts(order, receiptRecords, rfqMap, purchaseRequestMap)
    && getGoodsReceiptOrderLines(order, rfqMap, purchaseRequestMap).length > 0
  ))
)

const createFormItems = (
  purchaseOrder: PurchaseOrder | null,
  receiptRecords: GoodsReceiptRecord[],
  inventoryLots: InventoryLot[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
): GoodsReceiptFormItemState[] => {
  const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
  const previousTotals = purchaseOrder
    ? getGoodsReceiptTotalsByOrderItem(receiptRecords, purchaseOrder.id)
    : new Map()

  return lines.map((line, index) => {
    const previousAccepted = previousTotals.get(line.purchaseOrderItemId)?.acceptedQuantity || 0
    const remainingQuantity = roundQuantity(Math.max(0, line.orderedQuantity - previousAccepted))

    return {
      purchaseOrderItemId: line.purchaseOrderItemId,
      stockItemId: line.stockItemId,
      orderedQuantity: line.orderedQuantity,
      receivedQuantity: remainingQuantity,
      acceptedQuantity: remainingQuantity,
      rejectedQuantity: 0,
      unit: line.unit,
      notes: '',
      lots: remainingQuantity > 0
        ? [{
          id: createLotFormId(),
          lotNo: getNextInventoryLotNo(inventoryLots, index),
          quantity: remainingQuantity,
          productionDate: getTodayKey(),
          expiryDate: '',
          notes: ''
        }]
        : []
    }
  })
}

const createEmptyForm = (
  receiptRecords: GoodsReceiptRecord[],
  inventoryLots: InventoryLot[],
  purchaseOrders: PurchaseOrder[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>,
  branches: Branch[],
  currentUser: User
): GoodsReceiptFormState => {
  const purchaseOrder = getReceivableOrders(purchaseOrders, receiptRecords, rfqMap, purchaseRequestMap)[0] || null

  return {
    receiptNo: getNextGoodsReceiptNo(receiptRecords),
    purchaseOrderId: purchaseOrder?.id || '',
    supplierId: purchaseOrder?.supplierId || '',
    warehouseId: getOrderWarehouseId(purchaseOrder, rfqMap, purchaseRequestMap, branches),
    receiptDate: getTodayKey(),
    receivedBy: getUserName(currentUser),
    notes: '',
    items: createFormItems(purchaseOrder, receiptRecords, inventoryLots, rfqMap, purchaseRequestMap)
  }
}

const validateForm = (
  form: GoodsReceiptFormState,
  purchaseOrders: PurchaseOrder[],
  receiptRecords: GoodsReceiptRecord[],
  inventoryLots: InventoryLot[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const purchaseOrder = purchaseOrders.find(order => order.id === form.purchaseOrderId)
  if(!purchaseOrder) return 'Purchase Order zorunludur.'
  if(purchaseOrder.status === 'COMPLETED' || isOrderCompletedByReceipts(purchaseOrder, receiptRecords, rfqMap, purchaseRequestMap)){
    return 'Completed Purchase Order için tekrar Goods Receipt açılamaz.'
  }
  if(purchaseOrder.status === 'CANCELLED') return 'İptal edilmiş Purchase Order için Goods Receipt oluşturulamaz.'
  if(!form.warehouseId) return 'Depo zorunludur.'
  if(form.items.length === 0) return 'Sipariş kalemi bulunamadı.'

  const hasReceivedQuantity = form.items.some(item => item.receivedQuantity > 0 || item.acceptedQuantity > 0 || item.rejectedQuantity > 0)
  if(!hasReceivedQuantity) return 'En az bir kalemde teslim miktarı girilmelidir.'

  for(const item of form.items){
    if(!Number.isFinite(item.receivedQuantity) || !Number.isFinite(item.acceptedQuantity) || !Number.isFinite(item.rejectedQuantity)){
      return 'Miktar alanları geçerli sayı olmalıdır.'
    }
    if(item.receivedQuantity < 0 || item.acceptedQuantity < 0 || item.rejectedQuantity < 0){
      return 'Received Quantity negatif olamaz.'
    }
    if(item.acceptedQuantity > 0 && item.lots.length === 0){
      return 'Accepted Quantity için en az bir lot oluşturulmalıdır.'
    }
    if(item.lots.some(lot => !Number.isFinite(lot.quantity))){
      return 'Lot miktarları geçerli sayı olmalıdır.'
    }
    const lotQuantityTotal = roundQuantity(item.lots.reduce((total, lot) => total + lot.quantity, 0))
    if(roundQuantity(Math.abs(lotQuantityTotal - item.acceptedQuantity)) > 0.001){
      return 'Lot miktarları Accepted Quantity toplamına eşit olmalıdır.'
    }
    if(roundQuantity(item.acceptedQuantity + item.rejectedQuantity) > item.receivedQuantity){
      return 'Accepted + Rejected, Received Quantity değerini geçemez.'
    }
  }

  const lotValidationError = validateInventoryLotCreateInputs(createInventoryLotInputsFromForm(form), inventoryLots)
  if(lotValidationError) return lotValidationError

  return ''
}

const createInventoryLotInputsFromForm = (
  form: GoodsReceiptFormState
): InventoryLotCreateInput[] => (
  form.items.flatMap(item => (
    item.lots
      .filter(lot => lot.quantity > 0)
      .map(lot => ({
        lotNo: lot.lotNo,
        goodsReceiptItemId: item.purchaseOrderItemId,
        stockItemId: item.stockItemId,
        productionDate: lot.productionDate,
        expiryDate: lot.expiryDate,
        quantity: lot.quantity,
        unit: item.unit,
        notes: lot.notes
      }))
  ))
)

const createReceiptPayload = (
  form: GoodsReceiptFormState,
  purchaseOrder: PurchaseOrder,
  status: GoodsReceiptStatus
): GoodsReceiptRecord => {
  const now = new Date().toISOString()
  const receiptId = createId('goods_receipt')

  return {
    id: receiptId,
    receiptNo: form.receiptNo,
    purchaseOrderId: purchaseOrder.id,
    supplierId: purchaseOrder.supplierId,
    warehouseId: form.warehouseId,
    receiptDate: form.receiptDate,
    receivedBy: form.receivedBy.trim() || 'Mal Kabul',
    status,
    notes: form.notes.trim(),
    createdAt: now,
    updatedAt: now,
    items: form.items.map((item, index) => ({
      id: `${receiptId}_item_${String(index + 1).padStart(2, '0')}`,
      receiptId,
      purchaseOrderItemId: item.purchaseOrderItemId,
      stockItemId: item.stockItemId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      unit: item.unit,
      notes: item.notes.trim()
    }))
  }
}

export default function GoodsReceipts({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<GoodsReceiptRecord[]>(initialData.goodsReceipts)
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>(initialData.purchaseOrders)
  const [stockItems, setStockItems] = React.useState<StockItem[]>(initialData.stockItems)
  const [inventoryLots, setInventoryLots] = React.useState<InventoryLot[]>(initialData.inventoryLots)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [dateFilter, setDateFilter] = React.useState('')

  const {
    branches,
    purchaseRequests,
    rfqRecords,
    supplierProducts,
    suppliers
  } = initialData

  const rfqMap = React.useMemo(() => new Map(rfqRecords.map(rfq => [rfq.id, rfq])), [rfqRecords])
  const purchaseRequestMap = React.useMemo(() => new Map(purchaseRequests.map(request => [request.id, request])), [purchaseRequests])
  const purchaseOrderMap = React.useMemo(() => new Map(purchaseOrders.map(order => [order.id, order])), [purchaseOrders])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const supplierProductMap = React.useMemo(() => new Map(supplierProducts.map(product => [product.id, product])), [supplierProducts])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])

  const [form, setForm] = React.useState<GoodsReceiptFormState>(() => createEmptyForm(
    initialData.goodsReceipts,
    initialData.inventoryLots,
    initialData.purchaseOrders,
    new Map(initialData.rfqRecords.map(rfq => [rfq.id, rfq])),
    new Map(initialData.purchaseRequests.map(request => [request.id, request])),
    initialData.branches,
    currentUser
  ))

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: GoodsReceiptRecord[]) => {
    setRecords(nextRecords)
    saveGoodsReceiptRecords(nextRecords)
  }, [])

  const commitPurchaseOrders = React.useCallback((nextOrders: PurchaseOrder[]) => {
    setPurchaseOrders(nextOrders)
    savePurchaseOrderRecords(nextOrders)
  }, [])

  const commitStockItems = React.useCallback((nextItems: StockItem[]) => {
    setStockItems(nextItems)
    saveStockItems(nextItems)
  }, [])

  const commitInventoryLots = React.useCallback((nextLots: InventoryLot[]) => {
    setInventoryLots(nextLots)
    saveInventoryLotRecords(nextLots)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const purchaseOrder = purchaseOrderMap.get(record.purchaseOrderId)
      const supplier = supplierMap.get(record.supplierId)
      const searchFields = [
        record.receiptNo,
        purchaseOrder?.orderNo || '',
        supplier?.name || '',
        supplier?.tradeName || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
      const matchesDate = !dateFilter || record.receiptDate === dateFilter

      return matchesSearch && matchesStatus && matchesSupplier && matchesWarehouse && matchesDate
    })
  }, [dateFilter, purchaseOrderMap, records, search, statusFilter, supplierFilter, supplierMap, warehouseFilter])

  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const partialCount = records.filter(record => record.status === 'PARTIALLY_RECEIVED').length
  const receivedItemCount = records.reduce((total, record) => total + record.items.length, 0)
  const acceptedQuantityTotal = records.reduce((total, record) => (
    total + record.items.reduce((itemTotal, item) => itemTotal + item.acceptedQuantity, 0)
  ), 0)

  const startCreate = () => {
    setForm(createEmptyForm(records, inventoryLots, purchaseOrders, rfqMap, purchaseRequestMap, branches, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(records, inventoryLots, purchaseOrders, rfqMap, purchaseRequestMap, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: GoodsReceiptRecord) => {
    setSelectedRecordId(record.id)
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormPurchaseOrder = (purchaseOrderId: string) => {
    const purchaseOrder = purchaseOrders.find(order => order.id === purchaseOrderId) || null

    setForm(current => ({
      ...current,
      purchaseOrderId,
      supplierId: purchaseOrder?.supplierId || '',
      warehouseId: getOrderWarehouseId(purchaseOrder, rfqMap, purchaseRequestMap, branches),
      items: createFormItems(purchaseOrder, records, inventoryLots, rfqMap, purchaseRequestMap)
    }))
  }

  const updateFormItem = (
    purchaseOrderItemId: string,
    field: keyof Pick<GoodsReceiptFormItemState, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity' | 'notes'>,
    value: string
  ) => {
    setForm(current => ({
      ...current,
      items: current.items.map(item => {
        if(item.purchaseOrderItemId !== purchaseOrderItemId) return item
        if(field === 'notes') return { ...item, notes: value }

        const nextQuantity = normalizeQuantity(value)
        const nextItem = { ...item, [field]: nextQuantity }

        if(field === 'receivedQuantity'){
          const acceptedQuantity = Math.min(nextItem.acceptedQuantity, Math.max(0, nextQuantity))
          return {
            ...nextItem,
            acceptedQuantity,
            rejectedQuantity: Math.min(nextItem.rejectedQuantity, Math.max(0, nextQuantity - acceptedQuantity)),
            lots: item.lots.length <= 1
              ? item.lots.map(lot => ({ ...lot, quantity: acceptedQuantity }))
              : item.lots
          }
        }

        if(field === 'acceptedQuantity' && item.lots.length <= 1){
          return {
            ...nextItem,
            lots: item.lots.map(lot => ({ ...lot, quantity: Math.max(0, nextQuantity) }))
          }
        }

        return nextItem
      })
    }))
  }

  const addLotSplit = (purchaseOrderItemId: string) => {
    setForm(current => {
      const existingFormLotCount = current.items.reduce((total, item) => total + item.lots.length, 0)

      return {
        ...current,
        items: current.items.map(item => (
          item.purchaseOrderItemId === purchaseOrderItemId
            ? {
              ...item,
              lots: [
                ...item.lots,
                {
                  id: createLotFormId(),
                  lotNo: getNextInventoryLotNo(inventoryLots, existingFormLotCount),
                  quantity: 0,
                  productionDate: getTodayKey(),
                  expiryDate: '',
                  notes: ''
                }
              ]
            }
            : item
        ))
      }
    })
  }

  const removeLotSplit = (purchaseOrderItemId: string, lotId: string) => {
    setForm(current => ({
      ...current,
      items: current.items.map(item => (
        item.purchaseOrderItemId === purchaseOrderItemId
          ? { ...item, lots: item.lots.filter(lot => lot.id !== lotId) }
          : item
      ))
    }))
  }

  const updateLotSplit = (
    purchaseOrderItemId: string,
    lotId: string,
    field: keyof Omit<GoodsReceiptLotFormState, 'id'>,
    value: string
  ) => {
    setForm(current => ({
      ...current,
      items: current.items.map(item => (
        item.purchaseOrderItemId === purchaseOrderItemId
          ? {
            ...item,
            lots: item.lots.map(lot => (
              lot.id === lotId
                ? { ...lot, [field]: field === 'quantity' ? normalizeQuantity(value) : value }
                : lot
            ))
          }
          : item
      ))
    }))
  }

  const submitReceipt = () => {
    const validationError = validateForm(form, purchaseOrders, records, inventoryLots, rfqMap, purchaseRequestMap)
    if(validationError){
      setFormError(validationError)
      return
    }

    const purchaseOrder = purchaseOrderMap.get(form.purchaseOrderId)
    if(!purchaseOrder){
      setFormError('Purchase Order bulunamadı.')
      return
    }

    const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
    const previousTotals = getGoodsReceiptTotalsByOrderItem(records, purchaseOrder.id)
    const previewItems = form.items.map((item, index): GoodsReceiptItem => ({
      id: `preview_${index}`,
      receiptId: 'preview',
      purchaseOrderItemId: item.purchaseOrderItemId,
      stockItemId: item.stockItemId,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      unit: item.unit,
      notes: item.notes
    }))

    if(hasOverReceiptQuantity(lines, previousTotals, previewItems) && !confirm('Fazla teslim miktarı var. Devam edilsin mi?')){
      return
    }

    const status = calculateGoodsReceiptStatus(lines, previousTotals, previewItems)
    const payload = createReceiptPayload(form, purchaseOrder, status)
    const createdInventoryLots = createInventoryLotsFromGoodsReceipt(
      payload,
      createInventoryLotInputsFromForm(form),
      inventoryLots
    )
    const nextRecords = [payload, ...records]
    const nextStockItems = applyGoodsReceiptStockQuantities(stockItems, payload.items)
    const nextInventoryLots = [...createdInventoryLots, ...inventoryLots]
    const nextOrderStatus = calculatePurchaseOrderStatusAfterReceipt(purchaseOrder, lines, nextRecords)
    const nextPurchaseOrders = purchaseOrders.map(order => (
      order.id === purchaseOrder.id
        ? { ...order, status: nextOrderStatus, updatedAt: new Date().toISOString() }
        : order
    ))

    commitRecords(nextRecords)
    commitStockItems(nextStockItems)
    commitInventoryLots(nextInventoryLots)
    commitPurchaseOrders(nextPurchaseOrders)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(nextRecords, nextInventoryLots, nextPurchaseOrders, rfqMap, purchaseRequestMap, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="goods-receipt-page">
      <div className="page-header">
        <div>
          <h2>Mal Kabul</h2>
          <p className="muted">Purchase Order üzerinden gelen ürünlerin fiziksel depo girişini kaydedin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Mal Kabul Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kısmi Teslim</span>
          <strong>{partialCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Kalem</span>
          <strong>{receivedItemCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kabul Miktarı</span>
          <strong>{acceptedQuantityTotal.toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</strong>
        </div>
      </div>

      <div className="product-layout goods-receipt-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Mal Kabul Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="goods-receipt-toolbar">
            <input
              type="search"
              placeholder="Receipt no, Purchase Order veya supplier ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {GOODS_RECEIPT_STATUSES.map(status => (
                <option key={status} value={status}>{GOODS_RECEIPT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Depolar</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
          </div>

          <div className="table-wrap goods-receipt-table-wrap">
            <table className="data-table goods-receipt-table">
              <thead>
                <tr>
                  <th>Mal Kabul No</th>
                  <th>Purchase Order</th>
                  <th>Supplier</th>
                  <th>Depo</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                  <th>Toplam Kalem</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun mal kabul kaydı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => selectRecord(record)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      selectRecord(record)
                    }}
                  >
                    <td data-label="Mal Kabul No"><strong>{record.receiptNo}</strong></td>
                    <td data-label="Purchase Order">{getPurchaseOrderLabel(record.purchaseOrderId, purchaseOrderMap)}</td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Depo">{getWarehouseLabel(record.warehouseId, branchMap)}</td>
                    <td data-label="Tarih">{formatDate(record.receiptDate)}</td>
                    <td data-label="Durum">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {GOODS_RECEIPT_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                    <td data-label="Toplam Kalem"><strong>{record.items.length}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side goods-receipt-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Mal Kabul Oluştur</h3>
                  <p className="muted">{form.receiptNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <GoodsReceiptForm
                form={form}
                purchaseOrders={purchaseOrders}
                receiptRecords={records}
                branches={branches}
                rfqMap={rfqMap}
                purchaseRequestMap={purchaseRequestMap}
                supplierMap={supplierMap}
                stockItemMap={stockItemMap}
                onPurchaseOrderChange={updateFormPurchaseOrder}
                onChange={setForm}
                onItemChange={updateFormItem}
                onLotAdd={addLotSplit}
                onLotRemove={removeLotSplit}
                onLotChange={updateLotSplit}
                onSubmit={submitReceipt}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <GoodsReceiptDetailPanel
              record={selectedRecord}
              receiptRecords={records}
              branches={branches}
              purchaseOrderMap={purchaseOrderMap}
              purchaseRequestMap={purchaseRequestMap}
              rfqMap={rfqMap}
              supplierMap={supplierMap}
              supplierProductMap={supplierProductMap}
              stockItemMap={stockItemMap}
              onCreate={startCreate}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function GoodsReceiptForm({
  form,
  purchaseOrders,
  receiptRecords,
  branches,
  rfqMap,
  purchaseRequestMap,
  supplierMap,
  stockItemMap,
  onPurchaseOrderChange,
  onChange,
  onItemChange,
  onLotAdd,
  onLotRemove,
  onLotChange,
  onSubmit,
  onCancel
}: {
  form: GoodsReceiptFormState
  purchaseOrders: PurchaseOrder[]
  receiptRecords: GoodsReceiptRecord[]
  branches: Branch[]
  rfqMap: Map<string, RequestForQuotationRecord>
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  onPurchaseOrderChange: (purchaseOrderId: string) => void
  onChange: (form: GoodsReceiptFormState) => void
  onItemChange: (
    purchaseOrderItemId: string,
    field: keyof Pick<GoodsReceiptFormItemState, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity' | 'notes'>,
    value: string
  ) => void
  onLotAdd: (purchaseOrderItemId: string) => void
  onLotRemove: (purchaseOrderItemId: string, lotId: string) => void
  onLotChange: (
    purchaseOrderItemId: string,
    lotId: string,
    field: keyof Omit<GoodsReceiptLotFormState, 'id'>,
    value: string
  ) => void
  onSubmit: () => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form goods-receipt-form" onSubmit={event => event.preventDefault()}>
      <div className="goods-receipt-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="goods-receipt-form-grid">
          <div className="form-field">
            <label>Mal Kabul No</label>
            <input value={form.receiptNo} readOnly />
          </div>
          <div className="form-field">
            <label>Purchase Order</label>
            <select value={form.purchaseOrderId} onChange={event => onPurchaseOrderChange(event.target.value)} required>
              <option value="">Purchase Order seçin</option>
              {purchaseOrders.map(order => {
                const disabled = order.status === 'COMPLETED'
                  || order.status === 'CANCELLED'
                  || isOrderCompletedByReceipts(order, receiptRecords, rfqMap, purchaseRequestMap)
                  || getGoodsReceiptOrderLines(order, rfqMap, purchaseRequestMap).length === 0

                return (
                  <option key={order.id} value={order.id} disabled={disabled}>
                    {order.orderNo} · {getSupplierLabel(order.supplierId, supplierMap)} · {PURCHASE_ORDER_STATUS_LABELS[order.status]}{disabled ? ' · Kapalı' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Supplier</label>
            <input value={form.supplierId ? getSupplierLabel(form.supplierId, supplierMap) : ''} readOnly />
          </div>
          <div className="form-field">
            <label>Depo</label>
            <select value={form.warehouseId} onChange={event => onChange({ ...form, warehouseId: event.target.value })} required>
              <option value="">Depo seçin</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Tarih</label>
            <input type="date" value={form.receiptDate} onChange={event => onChange({ ...form, receiptDate: event.target.value })} required />
          </div>
          <div className="form-field">
            <label>Teslim Alan</label>
            <input value={form.receivedBy} onChange={event => onChange({ ...form, receivedBy: event.target.value })} />
          </div>
        </div>
      </div>

      <div className="goods-receipt-form-section">
        <div className="section-header compact">
          <h4>Sipariş Kalemleri</h4>
          <span className="status-pill">{form.items.length} kalem</span>
        </div>
        <div className="goods-receipt-item-editor-list">
          {form.items.length === 0 && <p className="muted">Purchase Order seçildiğinde kalemler burada görünür.</p>}
          {form.items.map(item => (
            <div className="goods-receipt-item-editor" key={item.purchaseOrderItemId}>
              <div className="goods-receipt-item-title">
                <strong>{stockItemMap.get(item.stockItemId)?.name || 'Stok kartı bulunamadı'}</strong>
                <span>Sipariş: {formatQuantity(item.orderedQuantity, item.unit)}</span>
              </div>
              <label>
                <span>Teslim Alınan</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={Number.isNaN(item.receivedQuantity) ? '' : item.receivedQuantity}
                  onChange={event => onItemChange(item.purchaseOrderItemId, 'receivedQuantity', event.target.value)}
                />
              </label>
              <label>
                <span>Kabul</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={Number.isNaN(item.acceptedQuantity) ? '' : item.acceptedQuantity}
                  onChange={event => onItemChange(item.purchaseOrderItemId, 'acceptedQuantity', event.target.value)}
                />
              </label>
              <label>
                <span>Red</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={Number.isNaN(item.rejectedQuantity) ? '' : item.rejectedQuantity}
                  onChange={event => onItemChange(item.purchaseOrderItemId, 'rejectedQuantity', event.target.value)}
                />
              </label>
              <label className="goods-receipt-item-note">
                <span>Not</span>
                <input value={item.notes} onChange={event => onItemChange(item.purchaseOrderItemId, 'notes', event.target.value)} />
              </label>
              <div className="goods-receipt-lot-split-panel">
                <div className="section-header compact">
                  <div>
                    <h4>Lot / Batch</h4>
                    <p className="muted">Kabul miktarı: {formatQuantity(item.acceptedQuantity, item.unit)}</p>
                  </div>
                  <button className="btn" type="button" onClick={() => onLotAdd(item.purchaseOrderItemId)}>Lot Ekle</button>
                </div>
                <div className="goods-receipt-lot-split-list">
                  {item.lots.length === 0 && <p className="muted">Bu kalem için lot satırı bulunmuyor.</p>}
                  {item.lots.map(lot => (
                    <div className="goods-receipt-lot-split-row" key={lot.id}>
                      <label>
                        <span>Lot No</span>
                        <input value={lot.lotNo} onChange={event => onLotChange(item.purchaseOrderItemId, lot.id, 'lotNo', event.target.value)} />
                      </label>
                      <label>
                        <span>Miktar</span>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={Number.isNaN(lot.quantity) ? '' : lot.quantity}
                          onChange={event => onLotChange(item.purchaseOrderItemId, lot.id, 'quantity', event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Production Date</span>
                        <input type="date" value={lot.productionDate} onChange={event => onLotChange(item.purchaseOrderItemId, lot.id, 'productionDate', event.target.value)} />
                      </label>
                      <label>
                        <span>Expiry Date</span>
                        <input type="date" value={lot.expiryDate} onChange={event => onLotChange(item.purchaseOrderItemId, lot.id, 'expiryDate', event.target.value)} />
                      </label>
                      <label className="goods-receipt-lot-note">
                        <span>Lot Notu</span>
                        <input value={lot.notes} onChange={event => onLotChange(item.purchaseOrderItemId, lot.id, 'notes', event.target.value)} />
                      </label>
                      <button className="btn" type="button" onClick={() => onLotRemove(item.purchaseOrderItemId, lot.id)}>Sil</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="goods-receipt-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Notlar</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Mal Kabul Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function GoodsReceiptDetailPanel({
  record,
  receiptRecords,
  branches,
  purchaseOrderMap,
  purchaseRequestMap,
  rfqMap,
  supplierMap,
  supplierProductMap,
  stockItemMap,
  onCreate
}: {
  record: GoodsReceiptRecord | null
  receiptRecords: GoodsReceiptRecord[]
  branches: Branch[]
  purchaseOrderMap: Map<string, PurchaseOrder>
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  rfqMap: Map<string, RequestForQuotationRecord>
  supplierMap: Map<string, Supplier>
  supplierProductMap: Map<string, SupplierProduct>
  stockItemMap: Map<string, StockItem>
  onCreate: () => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Mal Kabul Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir mal kabul kaydı seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Mal Kabul Oluştur</button>
      </section>
    )
  }

  const purchaseOrder = purchaseOrderMap.get(record.purchaseOrderId) || null
  const purchaseRequest = purchaseOrder ? purchaseRequestMap.get(purchaseOrder.purchaseRequestId) || null : null
  const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
  const totals = getGoodsReceiptTotalsByOrderItem(receiptRecords, record.purchaseOrderId)
  const warehouse = branches.find(branch => branch.id === record.warehouseId)

  return (
    <>
      <section className="card goods-receipt-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.receiptNo}</h3>
            <p className="muted">{getPurchaseOrderLabel(record.purchaseOrderId, purchaseOrderMap)}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {GOODS_RECEIPT_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="goods-receipt-side-actions">
          <button className="btn primary" type="button" onClick={onCreate}>Yeni</button>
        </div>
      </section>

      <section className="card goods-receipt-detail-card">
        <h3>Detay</h3>
        <div className="goods-receipt-detail-grid">
          <div><span>Purchase Order</span><strong>{getPurchaseOrderLabel(record.purchaseOrderId, purchaseOrderMap)}</strong></div>
          <div><span>PO Durumu</span><strong>{purchaseOrder ? PURCHASE_ORDER_STATUS_LABELS[purchaseOrder.status] : '-'}</strong></div>
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Depo</span><strong>{warehouse?.name || 'Depo bulunamadı'}</strong></div>
          <div><span>Tarih</span><strong>{formatDate(record.receiptDate)}</strong></div>
          <div><span>Teslim Alan</span><strong>{record.receivedBy || '-'}</strong></div>
          <div><span>Purchase Request</span><strong>{purchaseRequest ? getRequestLabel(purchaseRequest.id, purchaseRequestMap) : '-'}</strong></div>
          <div><span>Toplam Kalem</span><strong>{record.items.length}</strong></div>
        </div>
      </section>

      <section className="card goods-receipt-detail-card">
        <div className="section-header compact">
          <h3>Sipariş Kalemleri</h3>
          <span className="status-pill">{record.items.length} kalem</span>
        </div>
        <div className="table-wrap goods-receipt-lines-wrap">
          <table className="data-table goods-receipt-lines-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th>Sipariş</th>
                <th>Teslim Alınan</th>
                <th>Eksik</th>
                <th>Red</th>
                <th>Notlar</th>
              </tr>
            </thead>
            <tbody>
              {record.items.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">Mal kabul kalemi bulunamadı.</td></tr>
              )}
              {record.items.map(item => {
                const stockItem = stockItemMap.get(item.stockItemId)
                const supplierProduct = lines.find(line => line.purchaseOrderItemId === item.purchaseOrderItemId)?.supplierProductId
                const supplierProductName = supplierProduct
                  ? supplierProductMap.get(supplierProduct)?.supplierProductName
                  : ''
                const lineTotals = totals.get(item.purchaseOrderItemId)
                const missingQuantity = roundQuantity(Math.max(0, item.orderedQuantity - (lineTotals?.acceptedQuantity || 0)))

                return (
                  <tr key={item.id}>
                    <td data-label="Kalem">
                      <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
                      <span>{supplierProductName || 'Supplier Product yok'}</span>
                    </td>
                    <td data-label="Sipariş">{formatQuantity(item.orderedQuantity, item.unit)}</td>
                    <td data-label="Teslim Alınan">
                      <strong>{formatQuantity(item.receivedQuantity, item.unit)}</strong>
                      <span>Kabul: {formatQuantity(item.acceptedQuantity, item.unit)}</span>
                    </td>
                    <td data-label="Eksik">{formatQuantity(missingQuantity, item.unit)}</td>
                    <td data-label="Red">{formatQuantity(item.rejectedQuantity, item.unit)}</td>
                    <td data-label="Notlar">{item.notes || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card goods-receipt-detail-card">
        <h3>Notlar</h3>
        <p className="goods-receipt-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
