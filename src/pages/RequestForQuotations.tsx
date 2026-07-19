import React from 'react'
import {
  DEFAULT_RFQ_CURRENCY,
  REQUEST_FOR_QUOTATION_STATUSES,
  REQUEST_FOR_QUOTATION_STATUS_LABELS,
  REQUEST_FOR_QUOTATION_SUPPLIER_STATUS_LABELS,
  calculateSupplierQuotationTotal,
  getNextRequestForQuotationNo,
  loadRequestForQuotationRecords,
  saveRequestForQuotationRecords
} from '../request-for-quotations/request-for-quotation.mock'
import type {
  RequestForQuotationRecord,
  RequestForQuotationStatus,
  RequestForQuotationSupplier,
  SupplierQuotation
} from '../request-for-quotations/request-for-quotation.types'
import {
  loadPurchaseRequestRecords
} from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestItem, PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import {
  loadSupplierManagementRecords
} from '../supplier-management/supplier-management.mock'
import {
  loadSupplierProductRecords
} from '../supplier-management/supplier-product-mapping.mock'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import {
  getActiveBranchId,
  loadBranches,
  loadStockItems
} from '../storage'
import type { Branch, StockItem, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = RequestForQuotationStatus | FilterValue
type PanelMode = 'detail' | 'form'
type SaveMode = 'draft' | 'send' | 'keep'

type RfqFormState = {
  rfqNo: string
  purchaseRequestId: string
  title: string
  description: string
  issueDate: string
  dueDate: string
  branchId: string
  createdBy: string
  notes: string
  supplierIds: string[]
}

type RfqInitialData = {
  stockItems: StockItem[]
  branches: Branch[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  records: RequestForQuotationRecord[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const normalizeNumberInput = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
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

const getStatusClass = (status: RequestForQuotationStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'CANCELLED') return 'danger-pill'
  if(status === 'SENT' || status === 'PARTIALLY_RECEIVED') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): RfqInitialData => {
  const stockItems = loadStockItems()
  const branches = loadBranches()
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const records = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)

  return { stockItems, branches, purchaseRequests, suppliers, supplierProducts, records }
}

const findSupplierProduct = (
  supplierProducts: SupplierProduct[],
  supplierId: string,
  stockItemId: string
) => (
  supplierProducts.find(product => product.supplierId === supplierId && product.stockItemId === stockItemId)
  || supplierProducts.find(product => product.supplierId === supplierId)
  || supplierProducts.find(product => product.stockItemId === stockItemId)
  || null
)

const getBranchLabel = (branchId: string, branches: Branch[]) => (
  branches.find(branch => branch.id === branchId)?.name || 'Şube bulunamadı'
)

const getRequestLabel = (purchaseRequestId: string, purchaseRequestMap: Map<string, PurchaseRequestRecord>) => {
  const purchaseRequest = purchaseRequestMap.get(purchaseRequestId)
  if(!purchaseRequest) return 'Purchase Request bulunamadı'
  return `${purchaseRequest.requestNo} · ${purchaseRequest.title}`
}

const getQuotationTotal = (quotation: Pick<SupplierQuotation, 'unitPrice' | 'quantity' | 'discount' | 'taxRate'>) => (
  calculateSupplierQuotationTotal(quotation)
)

const getWinnerCount = (record: RequestForQuotationRecord) => (
  record.quotations.filter(quotation => quotation.isWinner).length
)

const getWinnerTotal = (records: RequestForQuotationRecord[]) => (
  roundMoney(records.reduce((total, record) => (
    total + record.quotations
      .filter(quotation => quotation.isWinner)
      .reduce((rowTotal, quotation) => rowTotal + quotation.totalPrice, 0)
  ), 0))
)

const createEmptyForm = (
  records: RequestForQuotationRecord[],
  purchaseRequests: PurchaseRequestRecord[],
  suppliers: Supplier[],
  branches: Branch[],
  currentUser: User
): RfqFormState => {
  const purchaseRequest = purchaseRequests[0]
  const activeBranchId = getActiveBranchId()
  const branchId = purchaseRequest?.branchId
    || (branches.some(branch => branch.id === activeBranchId) ? activeBranchId : branches[0]?.id || '')

  return {
    rfqNo: getNextRequestForQuotationNo(records),
    purchaseRequestId: purchaseRequest?.id || '',
    title: purchaseRequest ? `${purchaseRequest.title} teklif süreci` : '',
    description: purchaseRequest?.description || '',
    issueDate: getTodayKey(),
    dueDate: getTodayKey(),
    branchId,
    createdBy: currentUser.fullName || currentUser.username,
    notes: '',
    supplierIds: suppliers.slice(0, Math.min(2, suppliers.length)).map(supplier => supplier.id)
  }
}

const createFormFromRecord = (record: RequestForQuotationRecord): RfqFormState => ({
  rfqNo: record.rfqNo,
  purchaseRequestId: record.purchaseRequestId,
  title: record.title,
  description: record.description,
  issueDate: record.issueDate,
  dueDate: record.dueDate,
  branchId: record.branchId,
  createdBy: record.createdBy,
  notes: record.notes,
  supplierIds: record.suppliers.map(supplier => supplier.supplierId)
})

const validateForm = (
  form: RfqFormState,
  purchaseRequests: PurchaseRequestRecord[],
  suppliers: Supplier[]
) => {
  if(!form.purchaseRequestId || !purchaseRequests.some(request => request.id === form.purchaseRequestId)){
    return 'Purchase Request zorunludur.'
  }
  if(form.supplierIds.length === 0 || !form.supplierIds.some(supplierId => suppliers.some(supplier => supplier.id === supplierId))){
    return 'En az 1 Supplier zorunludur.'
  }
  if(form.issueDate && form.dueDate && form.dueDate < form.issueDate){
    return 'Son teklif tarihi oluşturma tarihinden önce olamaz.'
  }

  return ''
}

const createSupplierLink = (
  rfqId: string,
  supplierId: string,
  index: number,
  previousSupplier?: RequestForQuotationSupplier,
  status: RequestForQuotationStatus = 'DRAFT'
): RequestForQuotationSupplier => ({
  id: previousSupplier?.id || `${rfqId}_supplier_${String(index + 1).padStart(2, '0')}`,
  rfqId,
  supplierId,
  status: previousSupplier?.status || (status === 'DRAFT' ? 'WAITING' : 'WAITING'),
  responseDate: previousSupplier?.responseDate || '',
  notes: previousSupplier?.notes || ''
})

const createQuotation = ({
  rfqId,
  supplierId,
  requestItem,
  supplierProduct,
  previousQuotation
}: {
  rfqId: string
  supplierId: string
  requestItem: PurchaseRequestItem
  supplierProduct: SupplierProduct | null
  previousQuotation?: SupplierQuotation
}): SupplierQuotation => {
  const unitPrice = previousQuotation?.unitPrice ?? requestItem.estimatedUnitPrice
  const quantity = previousQuotation?.quantity ?? requestItem.quantity
  const discount = previousQuotation?.discount ?? 0
  const taxRate = previousQuotation?.taxRate ?? 10

  return {
    id: previousQuotation?.id || `${rfqId}_quote_${supplierId}_${requestItem.id}`,
    rfqId,
    supplierId,
    purchaseRequestItemId: requestItem.id,
    supplierProductId: previousQuotation?.supplierProductId || supplierProduct?.id || '',
    unitPrice,
    quantity,
    discount,
    taxRate,
    totalPrice: getQuotationTotal({ unitPrice, quantity, discount, taxRate }),
    currency: previousQuotation?.currency || DEFAULT_RFQ_CURRENCY,
    deliveryDays: previousQuotation?.deliveryDays ?? supplierProduct?.leadTimeDays ?? 0,
    isWinner: previousQuotation?.isWinner || false,
    notes: previousQuotation?.notes || ''
  }
}

const normalizeWinners = (quotations: SupplierQuotation[]) => {
  const winnerByItem = new Set<string>()

  return quotations.map(quotation => {
    if(!quotation.isWinner) return quotation
    if(winnerByItem.has(quotation.purchaseRequestItemId)) return { ...quotation, isWinner: false }

    winnerByItem.add(quotation.purchaseRequestItemId)
    return quotation
  })
}

const resolveStatusAfterWinner = (
  record: RequestForQuotationRecord,
  quotations: SupplierQuotation[],
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
): RequestForQuotationStatus => {
  if(record.status === 'DRAFT' || record.status === 'CANCELLED') return record.status

  const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)
  if(!purchaseRequest) return record.status

  const winnerItemIds = new Set(quotations.filter(quotation => quotation.isWinner).map(quotation => quotation.purchaseRequestItemId))
  return purchaseRequest.items.every(item => winnerItemIds.has(item.id)) ? 'COMPLETED' : 'PARTIALLY_RECEIVED'
}

const createPayload = (
  form: RfqFormState,
  status: RequestForQuotationStatus,
  previousRecord: RequestForQuotationRecord | undefined,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>,
  supplierProducts: SupplierProduct[]
): RequestForQuotationRecord => {
  const now = new Date().toISOString()
  const rfqId = previousRecord?.id || createId('rfq')
  const purchaseRequest = purchaseRequestMap.get(form.purchaseRequestId)
  const supplierIds = Array.from(new Set(form.supplierIds.filter(Boolean)))
  const supplierLinks = supplierIds.map((supplierId, index) => (
    createSupplierLink(
      rfqId,
      supplierId,
      index,
      previousRecord?.suppliers.find(supplier => supplier.supplierId === supplierId),
      status
    )
  ))
  const quotations = purchaseRequest
    ? normalizeWinners(supplierIds.flatMap(supplierId => (
      purchaseRequest.items.map(requestItem => {
        const previousQuotation = previousRecord?.quotations.find(quotation => (
          quotation.supplierId === supplierId
          && quotation.purchaseRequestItemId === requestItem.id
        ))

        return createQuotation({
          rfqId,
          supplierId,
          requestItem,
          supplierProduct: findSupplierProduct(supplierProducts, supplierId, requestItem.stockItemId),
          previousQuotation
        })
      })
    )))
    : []

  return {
    id: rfqId,
    rfqNo: form.rfqNo.trim(),
    purchaseRequestId: form.purchaseRequestId,
    title: form.title.trim(),
    description: form.description.trim(),
    issueDate: form.issueDate,
    dueDate: form.dueDate,
    status,
    branchId: form.branchId,
    createdBy: form.createdBy.trim(),
    notes: form.notes.trim(),
    createdAt: previousRecord?.createdAt || now,
    updatedAt: now,
    suppliers: supplierLinks,
    quotations
  }
}

export default function RequestForQuotations({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<RequestForQuotationRecord[]>(initialData.records)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<RfqFormState>(() => createEmptyForm(initialData.records, initialData.purchaseRequests, initialData.suppliers, initialData.branches, currentUser))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const { branches, purchaseRequests, suppliers, supplierProducts, stockItems } = initialData
  const purchaseRequestMap = React.useMemo(() => new Map(purchaseRequests.map(request => [request.id, request])), [purchaseRequests])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const supplierProductMap = React.useMemo(() => new Map(supplierProducts.map(product => [product.id, product])), [supplierProducts])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: RequestForQuotationRecord[]) => {
    setRecords(nextRecords)
    saveRequestForQuotationRecords(nextRecords)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)
      const searchFields = [
        record.rfqNo,
        record.title,
        purchaseRequest?.requestNo || '',
        purchaseRequest?.title || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesBranch = branchFilter === 'all' || record.branchId === branchFilter

      return matchesSearch && matchesStatus && matchesBranch
    })
  }, [branchFilter, purchaseRequestMap, records, search, statusFilter])

  const sentCount = records.filter(record => record.status === 'SENT' || record.status === 'PARTIALLY_RECEIVED').length
  const completedCount = records.filter(record => record.status === 'COMPLETED').length
  const totalWinnerCount = records.reduce((total, record) => total + getWinnerCount(record), 0)

  const startCreate = () => {
    setEditingRecordId('')
    setForm(createEmptyForm(records, purchaseRequests, suppliers, branches, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const startEdit = (record: RequestForQuotationRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId(record.id)
    setForm(createFormFromRecord(record))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setEditingRecordId('')
    setForm(createEmptyForm(records, purchaseRequests, suppliers, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: RequestForQuotationRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId('')
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormField = <K extends keyof RfqFormState>(field: K, value: RfqFormState[K]) => {
    setForm(prev => {
      if(field !== 'purchaseRequestId') return { ...prev, [field]: value }

      const purchaseRequest = purchaseRequestMap.get(String(value))
      return {
        ...prev,
        purchaseRequestId: String(value),
        title: purchaseRequest ? `${purchaseRequest.title} teklif süreci` : prev.title,
        description: purchaseRequest?.description || prev.description,
        branchId: purchaseRequest?.branchId || prev.branchId
      }
    })
  }

  const toggleSupplier = (supplierId: string) => {
    setForm(prev => ({
      ...prev,
      supplierIds: prev.supplierIds.includes(supplierId)
        ? prev.supplierIds.filter(item => item !== supplierId)
        : [...prev.supplierIds, supplierId]
    }))
  }

  const saveRecord = (mode: SaveMode) => {
    const validationError = validateForm(form, purchaseRequests, suppliers)
    if(validationError){
      setFormError(validationError)
      return
    }

    const previousRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextStatus = mode === 'send'
      ? 'SENT'
      : mode === 'draft'
        ? 'DRAFT'
        : previousRecord?.status || 'DRAFT'
    const payload = createPayload(form, nextStatus, previousRecord, purchaseRequestMap, supplierProducts)
    const nextRecords = previousRecord
      ? records.map(record => record.id === previousRecord.id ? payload : record)
      : [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setEditingRecordId('')
    setForm(createEmptyForm(nextRecords, purchaseRequests, suppliers, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const submitRecord = (record: RequestForQuotationRecord) => {
    const nextRecord: RequestForQuotationRecord = {
      ...record,
      status: 'SENT',
      updatedAt: new Date().toISOString()
    }
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  const cancelRecord = (record: RequestForQuotationRecord) => {
    if(!confirm(`${record.rfqNo} iptal edilecek. Emin misiniz?`)) return

    const nextRecord: RequestForQuotationRecord = {
      ...record,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString()
    }
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  const deleteRecord = (record: RequestForQuotationRecord) => {
    if(!confirm(`${record.rfqNo} silinecek. Emin misiniz?`)) return

    const nextRecords = records.filter(item => item.id !== record.id)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
    setPanelMode('detail')
  }

  const updateQuotation = (
    record: RequestForQuotationRecord,
    quotationId: string,
    patch: Partial<Pick<SupplierQuotation, 'supplierProductId' | 'unitPrice' | 'discount' | 'taxRate' | 'deliveryDays' | 'notes'>>
  ) => {
    const updatedAt = new Date().toISOString()
    const nextQuotations = record.quotations.map(quotation => {
      if(quotation.id !== quotationId) return quotation

      const nextQuotation = {
        ...quotation,
        ...patch
      }
      return {
        ...nextQuotation,
        totalPrice: getQuotationTotal(nextQuotation)
      }
    })
    const updatedQuotation = nextQuotations.find(quotation => quotation.id === quotationId)
    const nextSuppliers = record.suppliers.map(supplier => (
      updatedQuotation && supplier.supplierId === updatedQuotation.supplierId
        ? { ...supplier, status: 'RESPONDED' as const, responseDate: updatedAt.slice(0, 10) }
        : supplier
    ))
    const nextStatus = record.status === 'SENT' ? 'PARTIALLY_RECEIVED' : record.status
    const nextRecord = {
      ...record,
      status: nextStatus,
      suppliers: nextSuppliers,
      quotations: nextQuotations,
      updatedAt
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  const selectWinner = (record: RequestForQuotationRecord, quotation: SupplierQuotation) => {
    const nextQuotations = record.quotations.map(item => (
      item.purchaseRequestItemId === quotation.purchaseRequestItemId
        ? { ...item, isWinner: item.id === quotation.id }
        : item
    ))
    const nextRecord: RequestForQuotationRecord = {
      ...record,
      status: resolveStatusAfterWinner(record, nextQuotations, purchaseRequestMap),
      quotations: nextQuotations,
      updatedAt: new Date().toISOString()
    }

    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  return (
    <div className="rfq-page">
      <div className="page-header">
        <div>
          <h2>Teklif Yönetimi</h2>
          <p className="muted">Purchase Request taleplerini birden fazla tedarikçiye gönderin ve fiyatları karşılaştırın.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Yeni RFQ</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam RFQ</span>
          <strong>{records.length}</strong>
        </div>
        <div className="metric-card">
          <span>Süreçte</span>
          <strong>{sentCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kazanan Teklif</span>
          <strong>{totalWinnerCount}</strong>
        </div>
      </div>

      <div className="product-layout rfq-layout">
        <div className="product-main rfq-main-stack">
          <section className="card">
            <div className="section-header">
              <div>
                <h3>RFQ Listesi</h3>
                <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
              </div>
            </div>

            {(purchaseRequests.length === 0 || suppliers.length === 0) && (
              <div className="form-error rfq-warning">
                RFQ oluşturmak için en az bir Purchase Request ve bir Supplier gereklidir.
              </div>
            )}

            <div className="rfq-toolbar">
              <input
                type="search"
                placeholder="RFQ no, Purchase Request veya başlık ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {REQUEST_FOR_QUOTATION_STATUSES.map(status => (
                  <option key={status} value={status}>{REQUEST_FOR_QUOTATION_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
                <option value="all">Tüm Şubeler</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>

            <div className="table-wrap rfq-table-wrap">
              <table className="data-table rfq-table">
                <thead>
                  <tr>
                    <th>RFQ No</th>
                    <th>Purchase Request</th>
                    <th>Oluşturma Tarihi</th>
                    <th>Son Teklif Tarihi</th>
                    <th>Tedarikçi Sayısı</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.length === 0 && (
                    <tr><td colSpan={6} className="empty-cell">Bu filtrelere uygun RFQ bulunamadı.</td></tr>
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
                      <td data-label="RFQ No"><strong>{record.rfqNo}</strong></td>
                      <td data-label="Purchase Request">{getRequestLabel(record.purchaseRequestId, purchaseRequestMap)}</td>
                      <td data-label="Oluşturma Tarihi">{formatDate(record.issueDate)}</td>
                      <td data-label="Son Teklif Tarihi">{formatDate(record.dueDate)}</td>
                      <td data-label="Tedarikçi Sayısı">{record.suppliers.length}</td>
                      <td data-label="Durum">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {REQUEST_FOR_QUOTATION_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <RfqComparison
            record={selectedRecord}
            purchaseRequest={selectedRecord ? purchaseRequestMap.get(selectedRecord.purchaseRequestId) || null : null}
            supplierMap={supplierMap}
            supplierProductMap={supplierProductMap}
            supplierProducts={supplierProducts}
            stockItemMap={stockItemMap}
            onQuotationChange={updateQuotation}
            onWinnerSelect={selectWinner}
          />
        </div>

        <aside className="product-side rfq-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>{editingRecordId ? 'RFQ Düzenle' : 'Yeni RFQ'}</h3>
                  <p className="muted">{form.rfqNo}</p>
                </div>
                {editingRecordId && <span className="status-pill">Düzenleme</span>}
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <RfqForm
                form={form}
                purchaseRequests={purchaseRequests}
                suppliers={suppliers}
                branches={branches}
                editing={Boolean(editingRecordId)}
                onChange={updateFormField}
                onToggleSupplier={toggleSupplier}
                onSave={saveRecord}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <RfqDetailPanel
              record={selectedRecord}
              branches={branches}
              purchaseRequestMap={purchaseRequestMap}
              supplierMap={supplierMap}
              onCreate={startCreate}
              onEdit={startEdit}
              onSubmit={submitRecord}
              onCancelRequest={cancelRecord}
              onDelete={deleteRecord}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function RfqComparison({
  record,
  purchaseRequest,
  supplierMap,
  supplierProductMap,
  supplierProducts,
  stockItemMap,
  onQuotationChange,
  onWinnerSelect
}: {
  record: RequestForQuotationRecord | null
  purchaseRequest: PurchaseRequestRecord | null
  supplierMap: Map<string, Supplier>
  supplierProductMap: Map<string, SupplierProduct>
  supplierProducts: SupplierProduct[]
  stockItemMap: Map<string, StockItem>
  onQuotationChange: (
    record: RequestForQuotationRecord,
    quotationId: string,
    patch: Partial<Pick<SupplierQuotation, 'supplierProductId' | 'unitPrice' | 'discount' | 'taxRate' | 'deliveryDays' | 'notes'>>
  ) => void
  onWinnerSelect: (record: RequestForQuotationRecord, quotation: SupplierQuotation) => void
}){
  if(!record || !purchaseRequest){
    return (
      <section className="card rfq-comparison-card">
        <div className="section-header compact">
          <h3>Fiyat Karşılaştırma</h3>
        </div>
        <p className="muted">Karşılaştırma için bir RFQ seçin.</p>
      </section>
    )
  }

  return (
    <section className="card rfq-comparison-card">
      <div className="section-header compact">
        <div>
          <h3>Fiyat Karşılaştırma</h3>
          <p className="muted">{purchaseRequest.items.length} ürün, {record.suppliers.length} tedarikçi.</p>
        </div>
        <span className="status-pill">{formatCurrency(getWinnerTotal([record]))}</span>
      </div>

      <div className="rfq-comparison-stack">
        {purchaseRequest.items.map(requestItem => {
          const stockItem = stockItemMap.get(requestItem.stockItemId)
          const itemQuotations = record.quotations.filter(quotation => quotation.purchaseRequestItemId === requestItem.id)

          return (
            <div className="rfq-comparison-group" key={requestItem.id}>
              <div className="rfq-comparison-title">
                <div>
                  <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
                  <span>{formatQuantity(requestItem.quantity, requestItem.unit)} talep edildi.</span>
                </div>
              </div>
              <div className="table-wrap rfq-comparison-table-wrap">
                <table className="data-table rfq-comparison-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Supplier Product</th>
                      <th>Birim Fiyat</th>
                      <th>İndirim</th>
                      <th>Vergi</th>
                      <th>Toplam</th>
                      <th>Teslim Süresi</th>
                      <th>Kazanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemQuotations.map(quotation => {
                      const supplier = supplierMap.get(quotation.supplierId)
                      const compatibleProducts = supplierProducts.filter(product => (
                        product.supplierId === quotation.supplierId
                        && product.stockItemId === requestItem.stockItemId
                      ))
                      const supplierProduct = supplierProductMap.get(quotation.supplierProductId)

                      return (
                        <tr key={quotation.id}>
                          <td data-label="Supplier"><strong>{supplier?.name || 'Supplier bulunamadı'}</strong></td>
                          <td data-label="Supplier Product">
                            <select
                              value={quotation.supplierProductId}
                              onChange={event => onQuotationChange(record, quotation.id, { supplierProductId: event.target.value })}
                            >
                              <option value="">Supplier Product yok</option>
                              {compatibleProducts.map(product => (
                                <option key={product.id} value={product.id}>{product.supplierProductName}</option>
                              ))}
                              {supplierProduct && !compatibleProducts.some(product => product.id === supplierProduct.id) && (
                                <option value={supplierProduct.id}>{supplierProduct.supplierProductName}</option>
                              )}
                            </select>
                          </td>
                          <td data-label="Birim Fiyat">
                            <input
                              min="0"
                              step="0.01"
                              type="number"
                              value={quotation.unitPrice}
                              onChange={event => onQuotationChange(record, quotation.id, { unitPrice: normalizeNumberInput(event.target.value) })}
                            />
                          </td>
                          <td data-label="İndirim">
                            <input
                              min="0"
                              max="100"
                              step="0.01"
                              type="number"
                              value={quotation.discount}
                              onChange={event => onQuotationChange(record, quotation.id, { discount: normalizeNumberInput(event.target.value) })}
                            />
                          </td>
                          <td data-label="Vergi">
                            <input
                              min="0"
                              step="0.01"
                              type="number"
                              value={quotation.taxRate}
                              onChange={event => onQuotationChange(record, quotation.id, { taxRate: normalizeNumberInput(event.target.value) })}
                            />
                          </td>
                          <td data-label="Toplam">{formatCurrency(quotation.totalPrice, quotation.currency)}</td>
                          <td data-label="Teslim Süresi">
                            <input
                              min="0"
                              step="1"
                              type="number"
                              value={quotation.deliveryDays}
                              onChange={event => onQuotationChange(record, quotation.id, { deliveryDays: normalizeNumberInput(event.target.value) })}
                            />
                          </td>
                          <td data-label="Kazanan">
                            <button
                              className={`btn ${quotation.isWinner ? 'primary' : ''}`}
                              type="button"
                              onClick={() => onWinnerSelect(record, quotation)}
                            >
                              {quotation.isWinner ? 'Kazanan' : 'Seç'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RfqDetailPanel({
  record,
  branches,
  purchaseRequestMap,
  supplierMap,
  onCreate,
  onEdit,
  onSubmit,
  onCancelRequest,
  onDelete
}: {
  record: RequestForQuotationRecord | null
  branches: Branch[]
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  supplierMap: Map<string, Supplier>
  onCreate: () => void
  onEdit: (record: RequestForQuotationRecord) => void
  onSubmit: (record: RequestForQuotationRecord) => void
  onCancelRequest: (record: RequestForQuotationRecord) => void
  onDelete: (record: RequestForQuotationRecord) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>RFQ Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir RFQ seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Yeni RFQ</button>
      </section>
    )
  }

  const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)
  const totalItems = purchaseRequest?.items.length || 0
  const winnerCount = getWinnerCount(record)
  const canSubmit = record.status === 'DRAFT'
  const canCancel = record.status !== 'CANCELLED'

  return (
    <>
      <section className="card rfq-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.rfqNo}</h3>
            <p className="muted">{record.title}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {REQUEST_FOR_QUOTATION_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="rfq-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn primary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
          {canSubmit && <button className="btn" type="button" onClick={() => onSubmit(record)}>Gönder</button>}
          {canCancel && <button className="btn" type="button" onClick={() => onCancelRequest(record)}>İptal</button>}
          <button className="btn" type="button" onClick={() => onDelete(record)}>Sil</button>
        </div>
      </section>

      <section className="card rfq-detail-card">
        <h3>RFQ Bilgileri</h3>
        <div className="rfq-detail-grid">
          <div><span>RFQ No</span><strong>{record.rfqNo}</strong></div>
          <div><span>Purchase Request</span><strong>{purchaseRequest ? `${purchaseRequest.requestNo} · ${purchaseRequest.title}` : 'Bulunamadı'}</strong></div>
          <div><span>Supplier Sayısı</span><strong>{record.suppliers.length}</strong></div>
          <div><span>Toplam Kalem</span><strong>{totalItems}</strong></div>
          <div><span>Durum</span><strong>{REQUEST_FOR_QUOTATION_STATUS_LABELS[record.status]}</strong></div>
          <div><span>Kazanan Teklif Sayısı</span><strong>{winnerCount}</strong></div>
          <div><span>Oluşturma Tarihi</span><strong>{formatDate(record.issueDate)}</strong></div>
          <div><span>Son Teklif Tarihi</span><strong>{formatDate(record.dueDate)}</strong></div>
          <div><span>Şube</span><strong>{getBranchLabel(record.branchId, branches)}</strong></div>
          <div><span>Oluşturan</span><strong>{record.createdBy}</strong></div>
        </div>
      </section>

      <section className="card rfq-detail-card">
        <h3>Supplier Durumları</h3>
        <div className="rfq-supplier-list">
          {record.suppliers.map(supplier => (
            <div key={supplier.id} className="rfq-supplier-row">
              <strong>{supplierMap.get(supplier.supplierId)?.name || 'Supplier bulunamadı'}</strong>
              <span>{REQUEST_FOR_QUOTATION_SUPPLIER_STATUS_LABELS[supplier.status]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card rfq-detail-card">
        <h3>Notlar</h3>
        <p className="muted rfq-notes">{record.notes || 'Not bulunmuyor.'}</p>
      </section>
    </>
  )
}

function RfqForm({
  form,
  purchaseRequests,
  suppliers,
  branches,
  editing,
  onChange,
  onToggleSupplier,
  onSave,
  onCancel
}: {
  form: RfqFormState
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  branches: Branch[]
  editing: boolean
  onChange: <K extends keyof RfqFormState>(field: K, value: RfqFormState[K]) => void
  onToggleSupplier: (supplierId: string) => void
  onSave: (mode: SaveMode) => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form rfq-form" onSubmit={event => event.preventDefault()}>
      <div className="rfq-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="rfq-form-grid">
          <div className="form-field">
            <label>RFQ No</label>
            <input value={form.rfqNo} readOnly />
          </div>
          <div className="form-field">
            <label>Şube</label>
            <select value={form.branchId} onChange={event => onChange('branchId', event.target.value)}>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Oluşturma Tarihi</label>
            <input type="date" value={form.issueDate} onChange={event => onChange('issueDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Son Teklif Tarihi</label>
            <input type="date" value={form.dueDate} onChange={event => onChange('dueDate', event.target.value)} />
          </div>
          <div className="form-field rfq-form-wide">
            <label>Başlık</label>
            <input value={form.title} onChange={event => onChange('title', event.target.value)} />
          </div>
          <div className="form-field rfq-form-wide">
            <label>Açıklama</label>
            <textarea rows={3} value={form.description} onChange={event => onChange('description', event.target.value)} />
          </div>
          <div className="form-field rfq-form-wide">
            <label>Oluşturan</label>
            <input value={form.createdBy} onChange={event => onChange('createdBy', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="rfq-form-section">
        <h4>Purchase Request Seçimi</h4>
        <div className="form-field">
          <label>Purchase Request</label>
          <select value={form.purchaseRequestId} onChange={event => onChange('purchaseRequestId', event.target.value)} required>
            <option value="">Purchase Request seçin</option>
            {purchaseRequests.map(request => (
              <option key={request.id} value={request.id}>{request.requestNo} · {request.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rfq-form-section">
        <h4>Tedarikçiler</h4>
        <div className="rfq-supplier-picker">
          {suppliers.map(supplier => (
            <label className="check-row" key={supplier.id}>
              <input
                type="checkbox"
                checked={form.supplierIds.includes(supplier.id)}
                onChange={() => onToggleSupplier(supplier.id)}
              />
              <span>{supplier.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rfq-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Not</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange('notes', event.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={() => onSave(editing ? 'keep' : 'draft')}>Kaydet</button>
        <button className="btn" type="button" onClick={() => onSave('send')}>Gönder</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}
