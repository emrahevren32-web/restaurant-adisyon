import React from 'react'
import {
  PURCHASE_ORDER_NEXT_STATUS,
  PURCHASE_ORDER_NEXT_STATUS_LABELS,
  PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_LABELS,
  calculatePurchaseOrderLineTotals,
  calculatePurchaseOrderTotals,
  getNextPurchaseOrderNo,
  getPurchaseOrderSourceQuotations,
  getWinningSupplierIds,
  hasPurchaseOrderForApproval,
  isPurchaseOrderTerminalStatus,
  loadPurchaseOrderRecords,
  savePurchaseOrderRecords
} from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/purchase-order.types'
import {
  PURCHASE_APPROVAL_STATUS_LABELS,
  loadPurchaseApprovalRecords
} from '../purchase-approvals/purchase-approval.mock'
import type { PurchaseApproval } from '../purchase-approvals/purchase-approval.types'
import {
  DEFAULT_RFQ_CURRENCY,
  loadRequestForQuotationRecords
} from '../request-for-quotations/request-for-quotation.mock'
import type { RequestForQuotationRecord, SupplierQuotation } from '../request-for-quotations/request-for-quotation.types'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import {
  loadBranches,
  loadStockItems
} from '../storage'
import type { Branch, StockItem, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = PurchaseOrderStatus | FilterValue
type PanelMode = 'detail' | 'form'

type PurchaseOrderFormState = {
  orderNo: string
  approvalId: string
  supplierId: string
  orderDate: string
  expectedDeliveryDate: string
  paymentTerm: string
  currency: string
  notes: string
}

type PurchaseOrderInitialData = {
  stockItems: StockItem[]
  branches: Branch[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  approvalRecords: PurchaseApproval[]
  orderRecords: PurchaseOrder[]
}

const DEFAULT_PAYMENT_TERM = '30 gün'
const DEFAULT_DELIVERY_OFFSET_DAYS = 3

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + Math.max(0, days))
  return date.toLocaleDateString('sv-SE')
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatCurrency = (value: number, currency = DEFAULT_RFQ_CURRENCY) => {
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

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: PurchaseOrderStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'CANCELLED') return 'danger-pill'
  if(status === 'SENT' || status === 'CONFIRMED' || status === 'PARTIALLY_RECEIVED') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): PurchaseOrderInitialData => {
  const stockItems = loadStockItems()
  const branches = loadBranches()
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const orderRecords = loadPurchaseOrderRecords(approvalRecords, rfqRecords)

  return {
    stockItems,
    branches,
    purchaseRequests,
    suppliers,
    supplierProducts,
    rfqRecords,
    approvalRecords,
    orderRecords
  }
}

const getPurchaseRequestLabel = (
  purchaseRequestId: string,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const purchaseRequest = purchaseRequestMap.get(purchaseRequestId)
  return purchaseRequest ? `${purchaseRequest.requestNo} · ${purchaseRequest.title}` : 'Purchase Request bulunamadı'
}

const getRfqLabel = (rfqId: string, rfqMap: Map<string, RequestForQuotationRecord>) => {
  const rfq = rfqMap.get(rfqId)
  return rfq ? rfq.rfqNo : 'RFQ bulunamadı'
}

const getApprovalLabel = (approvalId: string, approvalMap: Map<string, PurchaseApproval>) => {
  const approval = approvalMap.get(approvalId)
  return approval ? approval.approvalNo : 'Approval bulunamadı'
}

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => {
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const getBranchLabel = (branchId: string, branches: Branch[]) => (
  branches.find(branch => branch.id === branchId)?.name || 'Şube bulunamadı'
)

const getApprovalRfq = (
  approval: PurchaseApproval | null | undefined,
  rfqMap: Map<string, RequestForQuotationRecord>
) => (
  approval ? rfqMap.get(approval.rfqId) || null : null
)

const getAvailableApprovals = (
  approvals: PurchaseApproval[],
  records: PurchaseOrder[],
  rfqMap: Map<string, RequestForQuotationRecord>
) => (
  approvals.filter(approval => (
    approval.status === 'APPROVED'
    && !hasPurchaseOrderForApproval(records, approval.id)
    && getWinningSupplierIds(getApprovalRfq(approval, rfqMap)).length > 0
  ))
)

const createEmptyForm = (
  records: PurchaseOrder[],
  approvals: PurchaseApproval[],
  rfqMap: Map<string, RequestForQuotationRecord>
): PurchaseOrderFormState => {
  const approval = getAvailableApprovals(approvals, records, rfqMap)[0] || null
  const rfq = getApprovalRfq(approval, rfqMap)
  const supplierId = getWinningSupplierIds(rfq)[0] || ''
  const totals = calculatePurchaseOrderTotals(rfq, supplierId)
  const today = getTodayKey()

  return {
    orderNo: getNextPurchaseOrderNo(records),
    approvalId: approval?.id || '',
    supplierId,
    orderDate: today,
    expectedDeliveryDate: addDays(today, DEFAULT_DELIVERY_OFFSET_DAYS),
    paymentTerm: DEFAULT_PAYMENT_TERM,
    currency: totals.currency,
    notes: ''
  }
}

const validateForm = (
  form: PurchaseOrderFormState,
  approvals: PurchaseApproval[],
  rfqMap: Map<string, RequestForQuotationRecord>,
  records: PurchaseOrder[]
) => {
  const approval = approvals.find(record => record.id === form.approvalId)
  if(!approval) return 'Approval zorunludur.'
  if(approval.status !== 'APPROVED') return 'Sadece onaylanmış Purchase Approval kayıtlarından PO oluşturulabilir.'
  if(hasPurchaseOrderForApproval(records, approval.id)) return 'Aynı Approval için ikinci Purchase Order oluşturulamaz.'
  if(!form.supplierId) return 'Supplier zorunludur.'

  const rfq = getApprovalRfq(approval, rfqMap)
  const totals = calculatePurchaseOrderTotals(rfq, form.supplierId)
  if(totals.itemCount === 0) return 'Sipariş kalemi boş olamaz.'

  return ''
}

const createOrderPayload = (
  form: PurchaseOrderFormState,
  approval: PurchaseApproval,
  rfq: RequestForQuotationRecord,
  currentUser: User
): PurchaseOrder => {
  const now = new Date().toISOString()
  const totals = calculatePurchaseOrderTotals(rfq, form.supplierId)

  return {
    id: createId('purchase_order'),
    orderNo: form.orderNo,
    approvalId: approval.id,
    rfqId: rfq.id,
    purchaseRequestId: approval.purchaseRequestId,
    supplierId: form.supplierId,
    orderDate: form.orderDate,
    expectedDeliveryDate: form.expectedDeliveryDate,
    status: 'DRAFT',
    paymentTerm: form.paymentTerm.trim() || DEFAULT_PAYMENT_TERM,
    currency: totals.currency || form.currency,
    subtotal: totals.subtotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    notes: form.notes.trim(),
    createdBy: getUserName(currentUser),
    createdAt: now,
    updatedAt: now
  }
}

export default function PurchaseOrders({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<PurchaseOrder[]>(initialData.orderRecords)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const {
    approvalRecords,
    branches,
    purchaseRequests,
    rfqRecords,
    supplierProducts,
    suppliers,
    stockItems
  } = initialData

  const rfqMap = React.useMemo(() => new Map(rfqRecords.map(rfq => [rfq.id, rfq])), [rfqRecords])
  const approvalMap = React.useMemo(() => new Map(approvalRecords.map(approval => [approval.id, approval])), [approvalRecords])
  const purchaseRequestMap = React.useMemo(() => new Map(purchaseRequests.map(request => [request.id, request])), [purchaseRequests])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const supplierProductMap = React.useMemo(() => new Map(supplierProducts.map(product => [product.id, product])), [supplierProducts])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])

  const [form, setForm] = React.useState<PurchaseOrderFormState>(() => createEmptyForm(
    initialData.orderRecords,
    initialData.approvalRecords,
    new Map(initialData.rfqRecords.map(rfq => [rfq.id, rfq]))
  ))

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: PurchaseOrder[]) => {
    setRecords(nextRecords)
    savePurchaseOrderRecords(nextRecords)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const supplier = supplierMap.get(record.supplierId)
      const rfq = rfqMap.get(record.rfqId)
      const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)
      const searchFields = [
        record.orderNo,
        supplier?.name || '',
        supplier?.tradeName || '',
        rfq?.rfqNo || '',
        purchaseRequest?.requestNo || '',
        purchaseRequest?.title || ''
      ]
      const branchId = rfq?.branchId || purchaseRequest?.branchId || ''

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesBranch = branchFilter === 'all' || branchId === branchFilter

      return matchesSearch && matchesStatus && matchesSupplier && matchesBranch
    })
  }, [branchFilter, purchaseRequestMap, records, rfqMap, search, statusFilter, supplierFilter, supplierMap])

  const draftCount = records.filter(record => record.status === 'DRAFT').length
  const activeCount = records.filter(record => (
    record.status === 'SENT'
    || record.status === 'CONFIRMED'
    || record.status === 'PARTIALLY_RECEIVED'
  )).length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const grandTotal = records.reduce((total, record) => total + record.grandTotal, 0)

  const startCreate = () => {
    setForm(createEmptyForm(records, approvalRecords, rfqMap))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(records, approvalRecords, rfqMap))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: PurchaseOrder) => {
    setSelectedRecordId(record.id)
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormApproval = (approvalId: string) => {
    const approval = approvalMap.get(approvalId)
    const rfq = getApprovalRfq(approval, rfqMap)
    const supplierId = getWinningSupplierIds(rfq)[0] || ''
    const totals = calculatePurchaseOrderTotals(rfq, supplierId)

    setForm(current => ({
      ...current,
      approvalId,
      supplierId,
      currency: totals.currency
    }))
  }

  const updateFormSupplier = (supplierId: string) => {
    const approval = approvalMap.get(form.approvalId)
    const rfq = getApprovalRfq(approval, rfqMap)
    const totals = calculatePurchaseOrderTotals(rfq, supplierId)

    setForm(current => ({
      ...current,
      supplierId,
      currency: totals.currency
    }))
  }

  const submitOrder = () => {
    const validationError = validateForm(form, approvalRecords, rfqMap, records)
    if(validationError){
      setFormError(validationError)
      return
    }

    const approval = approvalMap.get(form.approvalId)
    const rfq = getApprovalRfq(approval, rfqMap)
    if(!approval || !rfq){
      setFormError('Approval veya RFQ bulunamadı.')
      return
    }

    const payload = createOrderPayload(form, approval, rfq, currentUser)
    const nextRecords = [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(nextRecords, approvalRecords, rfqMap))
    setFormError('')
    setPanelMode('detail')
  }

  const updateOrderStatus = (order: PurchaseOrder, status: PurchaseOrderStatus) => {
    const nextOrder: PurchaseOrder = {
      ...order,
      status,
      updatedAt: new Date().toISOString()
    }

    commitRecords(records.map(record => record.id === order.id ? nextOrder : record))
    setSelectedRecordId(order.id)
  }

  const advanceOrderStatus = (order: PurchaseOrder) => {
    const nextStatus = PURCHASE_ORDER_NEXT_STATUS[order.status]
    if(!nextStatus) return
    updateOrderStatus(order, nextStatus)
  }

  const cancelOrder = (order: PurchaseOrder) => {
    if(!confirm('Bu satın alma siparişi iptal edilsin mi?')) return
    updateOrderStatus(order, 'CANCELLED')
  }

  return (
    <div className="purchase-order-page">
      <div className="page-header">
        <div>
          <h2>Satın Alma Siparişleri</h2>
          <p className="muted">Onaylanmış Purchase Approval kayıtlarından resmi satın alma siparişleri oluşturun.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Purchase Order Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Taslak</span>
          <strong>{draftCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Süreç</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Sipariş</span>
          <strong>{formatCurrency(grandTotal)}</strong>
        </div>
      </div>

      <div className="product-layout purchase-order-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Sipariş Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="purchase-order-toolbar">
            <input
              type="search"
              placeholder="Sipariş no, supplier, Purchase Request veya RFQ ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {PURCHASE_ORDER_STATUSES.map(status => (
                <option key={status} value={status}>{PURCHASE_ORDER_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

          <div className="table-wrap purchase-order-table-wrap">
            <table className="data-table purchase-order-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Supplier</th>
                  <th>Purchase Request</th>
                  <th>RFQ</th>
                  <th>Sipariş Tarihi</th>
                  <th>Teslim Tarihi</th>
                  <th>Toplam</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun satın alma siparişi bulunamadı.</td></tr>
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
                    <td data-label="Sipariş No"><strong>{record.orderNo}</strong></td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Purchase Request">{getPurchaseRequestLabel(record.purchaseRequestId, purchaseRequestMap)}</td>
                    <td data-label="RFQ">{getRfqLabel(record.rfqId, rfqMap)}</td>
                    <td data-label="Sipariş Tarihi">{formatDate(record.orderDate)}</td>
                    <td data-label="Teslim Tarihi">{formatDate(record.expectedDeliveryDate)}</td>
                    <td data-label="Toplam"><strong>{formatCurrency(record.grandTotal, record.currency)}</strong></td>
                    <td data-label="Durum">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {PURCHASE_ORDER_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side purchase-order-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>Purchase Order Oluştur</h3>
                  <p className="muted">{form.orderNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <PurchaseOrderForm
                form={form}
                records={records}
                approvals={approvalRecords}
                rfqMap={rfqMap}
                purchaseRequestMap={purchaseRequestMap}
                supplierMap={supplierMap}
                onApprovalChange={updateFormApproval}
                onSupplierChange={updateFormSupplier}
                onChange={setForm}
                onSubmit={submitOrder}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <PurchaseOrderDetailPanel
              order={selectedRecord}
              approvalMap={approvalMap}
              branches={branches}
              purchaseRequestMap={purchaseRequestMap}
              rfqMap={rfqMap}
              supplierMap={supplierMap}
              supplierProductMap={supplierProductMap}
              stockItemMap={stockItemMap}
              onCreate={startCreate}
              onAdvance={advanceOrderStatus}
              onCancel={cancelOrder}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function PurchaseOrderForm({
  form,
  records,
  approvals,
  rfqMap,
  purchaseRequestMap,
  supplierMap,
  onApprovalChange,
  onSupplierChange,
  onChange,
  onSubmit,
  onCancel
}: {
  form: PurchaseOrderFormState
  records: PurchaseOrder[]
  approvals: PurchaseApproval[]
  rfqMap: Map<string, RequestForQuotationRecord>
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  supplierMap: Map<string, Supplier>
  onApprovalChange: (approvalId: string) => void
  onSupplierChange: (supplierId: string) => void
  onChange: (form: PurchaseOrderFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const selectedApproval = approvals.find(approval => approval.id === form.approvalId) || null
  const selectedRfq = getApprovalRfq(selectedApproval, rfqMap)
  const winnerSupplierIds = getWinningSupplierIds(selectedRfq)
  const totals = calculatePurchaseOrderTotals(selectedRfq, form.supplierId)

  return (
    <form className="stacked-form purchase-order-form" onSubmit={event => event.preventDefault()}>
      <div className="purchase-order-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="purchase-order-form-grid">
          <div className="form-field">
            <label>Sipariş No</label>
            <input value={form.orderNo} readOnly />
          </div>
          <div className="form-field">
            <label>Approval</label>
            <select value={form.approvalId} onChange={event => onApprovalChange(event.target.value)} required>
              <option value="">Approval seçin</option>
              {approvals.filter(approval => approval.status === 'APPROVED').map(approval => {
                const rfq = getApprovalRfq(approval, rfqMap)
                const purchaseRequest = purchaseRequestMap.get(approval.purchaseRequestId)
                const hasPo = hasPurchaseOrderForApproval(records, approval.id)
                const hasItems = getWinningSupplierIds(rfq).length > 0

                return (
                  <option key={approval.id} value={approval.id} disabled={hasPo || !hasItems}>
                    {approval.approvalNo} · {rfq?.rfqNo || 'RFQ bulunamadı'} · {purchaseRequest?.title || 'Purchase Request bulunamadı'}{hasPo ? ' · PO var' : ''}{!hasItems ? ' · Kalem yok' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="form-field">
            <label>Supplier</label>
            <select value={form.supplierId} onChange={event => onSupplierChange(event.target.value)} required>
              <option value="">Supplier seçin</option>
              {winnerSupplierIds.map(supplierId => (
                <option key={supplierId} value={supplierId}>{getSupplierLabel(supplierId, supplierMap)}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Para Birimi</label>
            <input value={totals.currency || form.currency} readOnly />
          </div>
          <div className="form-field">
            <label>Sipariş Tarihi</label>
            <input type="date" value={form.orderDate} onChange={event => onChange({ ...form, orderDate: event.target.value })} required />
          </div>
          <div className="form-field">
            <label>Teslim Tarihi</label>
            <input type="date" value={form.expectedDeliveryDate} onChange={event => onChange({ ...form, expectedDeliveryDate: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Vade</label>
            <input value={form.paymentTerm} onChange={event => onChange({ ...form, paymentTerm: event.target.value })} placeholder="30 gün" />
          </div>
          <div className="form-field">
            <label>Toplam</label>
            <input value={formatCurrency(totals.grandTotal, totals.currency)} readOnly />
          </div>
        </div>
      </div>

      <div className="purchase-order-form-section">
        <h4>Sipariş Özeti</h4>
        <div className="purchase-order-form-summary">
          <div><span>Sipariş Kalemi</span><strong>{totals.itemCount}</strong></div>
          <div><span>Ara Toplam</span><strong>{formatCurrency(totals.subtotal, totals.currency)}</strong></div>
          <div><span>Vergi</span><strong>{formatCurrency(totals.taxTotal, totals.currency)}</strong></div>
          <div><span>Genel Toplam</span><strong>{formatCurrency(totals.grandTotal, totals.currency)}</strong></div>
        </div>
      </div>

      <div className="purchase-order-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Notlar</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Purchase Order Oluştur</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function PurchaseOrderDetailPanel({
  order,
  approvalMap,
  branches,
  purchaseRequestMap,
  rfqMap,
  supplierMap,
  supplierProductMap,
  stockItemMap,
  onCreate,
  onAdvance,
  onCancel
}: {
  order: PurchaseOrder | null
  approvalMap: Map<string, PurchaseApproval>
  branches: Branch[]
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  rfqMap: Map<string, RequestForQuotationRecord>
  supplierMap: Map<string, Supplier>
  supplierProductMap: Map<string, SupplierProduct>
  stockItemMap: Map<string, StockItem>
  onCreate: () => void
  onAdvance: (order: PurchaseOrder) => void
  onCancel: (order: PurchaseOrder) => void
}){
  if(!order){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Sipariş Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir satın alma siparişi seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Purchase Order Oluştur</button>
      </section>
    )
  }

  const approval = approvalMap.get(order.approvalId) || null
  const rfq = rfqMap.get(order.rfqId) || null
  const purchaseRequest = purchaseRequestMap.get(order.purchaseRequestId) || null
  const supplier = supplierMap.get(order.supplierId) || null
  const sourceQuotations = getPurchaseOrderSourceQuotations(rfq, order.supplierId)
  const nextStatusLabel = PURCHASE_ORDER_NEXT_STATUS_LABELS[order.status]
  const canCancel = !isPurchaseOrderTerminalStatus(order.status)
  const branchId = rfq?.branchId || purchaseRequest?.branchId || ''

  return (
    <>
      <section className="card purchase-order-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{order.orderNo}</h3>
            <p className="muted">{supplier?.name || 'Supplier bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(order.status)}`}>
            {PURCHASE_ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="purchase-order-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          {nextStatusLabel && <button className="btn primary" type="button" onClick={() => onAdvance(order)}>{nextStatusLabel}</button>}
          {canCancel && <button className="btn" type="button" onClick={() => onCancel(order)}>İptal Et</button>}
        </div>
      </section>

      <section className="card purchase-order-detail-card">
        <h3>Detay</h3>
        <div className="purchase-order-detail-grid">
          <div><span>Supplier</span><strong>{supplier?.name || 'Supplier bulunamadı'}</strong></div>
          <div><span>Purchase Request</span><strong>{getPurchaseRequestLabel(order.purchaseRequestId, purchaseRequestMap)}</strong></div>
          <div><span>RFQ</span><strong>{getRfqLabel(order.rfqId, rfqMap)}</strong></div>
          <div><span>Approval</span><strong>{getApprovalLabel(order.approvalId, approvalMap)}</strong></div>
          <div><span>Approval Durumu</span><strong>{approval ? PURCHASE_APPROVAL_STATUS_LABELS[approval.status] : '-'}</strong></div>
          <div><span>Şube</span><strong>{branchId ? getBranchLabel(branchId, branches) : '-'}</strong></div>
          <div><span>Sipariş Tarihi</span><strong>{formatDate(order.orderDate)}</strong></div>
          <div><span>Teslim Tarihi</span><strong>{formatDate(order.expectedDeliveryDate)}</strong></div>
          <div><span>Vade</span><strong>{order.paymentTerm || '-'}</strong></div>
          <div><span>Created By</span><strong>{order.createdBy || '-'}</strong></div>
          <div><span>Ara Toplam</span><strong>{formatCurrency(order.subtotal, order.currency)}</strong></div>
          <div><span>Vergi</span><strong>{formatCurrency(order.taxTotal, order.currency)}</strong></div>
          <div><span>Genel Toplam</span><strong>{formatCurrency(order.grandTotal, order.currency)}</strong></div>
          <div><span>Kalem</span><strong>{sourceQuotations.length}</strong></div>
        </div>
      </section>

      <section className="card purchase-order-detail-card">
        <div className="section-header compact">
          <h3>Sipariş Kalemleri</h3>
          <span className="status-pill">{sourceQuotations.length} kalem</span>
        </div>
        <div className="table-wrap purchase-order-lines-wrap">
          <table className="data-table purchase-order-lines-table">
            <thead>
              <tr>
                <th>Kalem</th>
                <th>Birim Fiyat</th>
                <th>Miktar</th>
                <th>Vergi</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {sourceQuotations.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">Sipariş kalemi bulunamadı.</td></tr>
              )}
              {sourceQuotations.map(quotation => (
                <PurchaseOrderLineRow
                  key={quotation.id}
                  quotation={quotation}
                  purchaseRequest={purchaseRequest}
                  supplierProductMap={supplierProductMap}
                  stockItemMap={stockItemMap}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card purchase-order-detail-card">
        <h3>Notlar</h3>
        <p className="purchase-order-notes">{order.notes || '-'}</p>
      </section>
    </>
  )
}

function PurchaseOrderLineRow({
  quotation,
  purchaseRequest,
  supplierProductMap,
  stockItemMap
}: {
  quotation: SupplierQuotation
  purchaseRequest: PurchaseRequestRecord | null
  supplierProductMap: Map<string, SupplierProduct>
  stockItemMap: Map<string, StockItem>
}){
  const requestItem = purchaseRequest?.items.find(item => item.id === quotation.purchaseRequestItemId)
  const stockItem = requestItem ? stockItemMap.get(requestItem.stockItemId) : undefined
  const supplierProduct = supplierProductMap.get(quotation.supplierProductId)
  const lineTotals = calculatePurchaseOrderLineTotals(quotation)

  return (
    <tr>
      <td data-label="Kalem">
        <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
        <span>{supplierProduct?.supplierProductName || 'Supplier Product yok'}</span>
      </td>
      <td data-label="Birim Fiyat">{formatCurrency(quotation.unitPrice, quotation.currency)}</td>
      <td data-label="Miktar">{formatQuantity(quotation.quantity, requestItem?.unit || 'adet')}</td>
      <td data-label="Vergi">
        <strong>{formatCurrency(lineTotals.taxTotal, quotation.currency)}</strong>
        <span>%{quotation.taxRate.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
      </td>
      <td data-label="Toplam"><strong>{formatCurrency(lineTotals.grandTotal, quotation.currency)}</strong></td>
    </tr>
  )
}
