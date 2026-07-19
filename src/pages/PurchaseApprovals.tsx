import React from 'react'
import {
  PURCHASE_APPROVAL_STATUSES,
  PURCHASE_APPROVAL_STATUS_LABELS,
  getNextPurchaseApprovalNo,
  hasActivePurchaseApproval,
  hasWinningQuotation,
  loadPurchaseApprovalRecords,
  savePurchaseApprovalRecords
} from '../purchase-approvals/purchase-approval.mock'
import type { PurchaseApproval, PurchaseApprovalStatus } from '../purchase-approvals/purchase-approval.types'
import {
  DEFAULT_RFQ_CURRENCY,
  REQUEST_FOR_QUOTATION_STATUS_LABELS,
  loadRequestForQuotationRecords
} from '../request-for-quotations/request-for-quotation.mock'
import type { RequestForQuotationRecord, SupplierQuotation } from '../request-for-quotations/request-for-quotation.types'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestItem, PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
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
type StatusFilter = PurchaseApprovalStatus | FilterValue
type PanelMode = 'detail' | 'form'

type ApprovalFormState = {
  approvalNo: string
  rfqId: string
  approvalNote: string
}

type ApprovalInitialData = {
  stockItems: StockItem[]
  branches: Branch[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  approvalRecords: PurchaseApproval[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

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

const getStatusClass = (status: PurchaseApprovalStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'REJECTED') return 'danger-pill'
  if(status === 'REVISION_REQUIRED') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): ApprovalInitialData => {
  const stockItems = loadStockItems()
  const branches = loadBranches()
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)

  return { stockItems, branches, purchaseRequests, suppliers, supplierProducts, rfqRecords, approvalRecords }
}

const getApprovalActor = (approval: PurchaseApproval) => {
  if(approval.status === 'APPROVED') return approval.approvedBy || '-'
  if(approval.status === 'REJECTED') return approval.rejectedBy || '-'
  if(approval.status === 'REVISION_REQUIRED') return approval.revisionRequestedBy || '-'
  return '-'
}

const getApprovalDate = (approval: PurchaseApproval) => (
  approval.approvalDate ? formatDate(approval.approvalDate) : '-'
)

const getRfqLabel = (rfqId: string, rfqMap: Map<string, RequestForQuotationRecord>) => {
  const rfq = rfqMap.get(rfqId)
  return rfq ? rfq.rfqNo : 'RFQ bulunamadı'
}

const getPurchaseRequestLabel = (
  purchaseRequestId: string,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => {
  const purchaseRequest = purchaseRequestMap.get(purchaseRequestId)
  return purchaseRequest ? `${purchaseRequest.requestNo} · ${purchaseRequest.title}` : 'Purchase Request bulunamadı'
}

const getBranchLabel = (branchId: string, branches: Branch[]) => (
  branches.find(branch => branch.id === branchId)?.name || 'Şube bulunamadı'
)

const getWinningQuotations = (rfq: RequestForQuotationRecord | null) => (
  rfq ? rfq.quotations.filter(quotation => quotation.isWinner) : []
)

const getWinningTotal = (quotations: SupplierQuotation[]) => (
  quotations.reduce((total, quotation) => total + quotation.totalPrice, 0)
)

const createEmptyForm = (
  records: PurchaseApproval[],
  rfqRecords: RequestForQuotationRecord[]
): ApprovalFormState => {
  const eligibleRfq = rfqRecords.find(hasWinningQuotation)

  return {
    approvalNo: getNextPurchaseApprovalNo(records),
    rfqId: eligibleRfq?.id || '',
    approvalNote: ''
  }
}

const validateForm = (
  form: ApprovalFormState,
  rfqRecords: RequestForQuotationRecord[],
  approvalRecords: PurchaseApproval[]
) => {
  const rfq = rfqRecords.find(record => record.id === form.rfqId)
  if(!rfq) return 'RFQ zorunludur.'
  if(!hasWinningQuotation(rfq)) return 'Kazanan teklif olmayan RFQ onaya gönderilemez.'
  if(hasActivePurchaseApproval(approvalRecords, rfq.id)) return 'Aynı RFQ için aktif onay süreci zaten var.'

  return ''
}

const createApprovalPayload = (
  form: ApprovalFormState,
  rfq: RequestForQuotationRecord
): PurchaseApproval => {
  const now = new Date().toISOString()

  return {
    id: createId('purchase_approval'),
    approvalNo: form.approvalNo,
    rfqId: rfq.id,
    purchaseRequestId: rfq.purchaseRequestId,
    status: 'PENDING',
    approvalDate: '',
    approvedBy: '',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: form.approvalNote.trim(),
    rejectionReason: '',
    revisionReason: '',
    createdAt: now,
    updatedAt: now
  }
}

export default function PurchaseApprovals({ currentUser }: Props){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<PurchaseApproval[]>(initialData.approvalRecords)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [form, setForm] = React.useState<ApprovalFormState>(() => createEmptyForm(initialData.approvalRecords, initialData.rfqRecords))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [approverFilter, setApproverFilter] = React.useState('all')

  const { branches, purchaseRequests, rfqRecords, supplierProducts, suppliers, stockItems } = initialData
  const rfqMap = React.useMemo(() => new Map(rfqRecords.map(rfq => [rfq.id, rfq])), [rfqRecords])
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

  const commitRecords = React.useCallback((nextRecords: PurchaseApproval[]) => {
    setRecords(nextRecords)
    savePurchaseApprovalRecords(nextRecords)
  }, [])

  const approverOptions = React.useMemo(() => {
    return Array.from(new Set(records.map(getApprovalActor).filter(actor => actor && actor !== '-')))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [records])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const rfq = rfqMap.get(record.rfqId)
      const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)
      const actor = getApprovalActor(record)
      const searchFields = [
        record.approvalNo,
        rfq?.rfqNo || '',
        purchaseRequest?.requestNo || '',
        purchaseRequest?.title || '',
        purchaseRequest?.requester || ''
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesBranch = branchFilter === 'all' || rfq?.branchId === branchFilter
      const matchesApprover = approverFilter === 'all' || actor === approverFilter

      return matchesSearch && matchesStatus && matchesBranch && matchesApprover
    })
  }, [approverFilter, branchFilter, purchaseRequestMap, records, rfqMap, search, statusFilter])

  const pendingCount = records.filter(record => record.status === 'PENDING').length
  const approvedCount = records.filter(record => record.status === 'APPROVED').length
  const rejectedCount = records.filter(record => record.status === 'REJECTED').length
  const revisionCount = records.filter(record => record.status === 'REVISION_REQUIRED').length

  const startCreate = () => {
    setForm(createEmptyForm(records, rfqRecords))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(records, rfqRecords))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: PurchaseApproval) => {
    setSelectedRecordId(record.id)
    setFormError('')
    setPanelMode('detail')
  }

  const submitApproval = () => {
    const validationError = validateForm(form, rfqRecords, records)
    if(validationError){
      setFormError(validationError)
      return
    }

    const rfq = rfqMap.get(form.rfqId)
    if(!rfq){
      setFormError('RFQ bulunamadı.')
      return
    }

    const payload = createApprovalPayload(form, rfq)
    const nextRecords = [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(nextRecords, rfqRecords))
    setFormError('')
    setPanelMode('detail')
  }

  const updateApprovalStatus = (
    approval: PurchaseApproval,
    status: PurchaseApprovalStatus
  ) => {
    const actor = getUserName(currentUser)
    const today = new Date().toLocaleDateString('sv-SE')
    const promptLabel = status === 'APPROVED'
      ? 'Onay notu'
      : status === 'REJECTED'
        ? 'Red nedeni'
        : 'Revizyon nedeni'
    const reason = prompt(`${promptLabel}:`, '') || ''
    const nextApproval: PurchaseApproval = {
      ...approval,
      status,
      approvalDate: today,
      approvedBy: status === 'APPROVED' ? actor : '',
      rejectedBy: status === 'REJECTED' ? actor : '',
      revisionRequestedBy: status === 'REVISION_REQUIRED' ? actor : '',
      approvalNote: status === 'APPROVED' ? reason : approval.approvalNote,
      rejectionReason: status === 'REJECTED' ? reason : '',
      revisionReason: status === 'REVISION_REQUIRED' ? reason : '',
      updatedAt: new Date().toISOString()
    }

    commitRecords(records.map(record => record.id === approval.id ? nextApproval : record))
    setSelectedRecordId(nextApproval.id)
  }

  return (
    <div className="purchase-approval-page">
      <div className="page-header">
        <div>
          <h2>Satın Alma Onayları</h2>
          <p className="muted">RFQ sonunda seçilen kazanan teklifleri onay sürecine alın.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Onaya Gönder</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylanan</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Reddedilen</span>
          <strong>{rejectedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Revizyon</span>
          <strong>{revisionCount}</strong>
        </div>
      </div>

      <div className="product-layout purchase-approval-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Onay Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="purchase-approval-toolbar">
            <input
              type="search"
              placeholder="Onay no, RFQ, Purchase Request veya talep eden ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {PURCHASE_APPROVAL_STATUSES.map(status => (
                <option key={status} value={status}>{PURCHASE_APPROVAL_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={approverFilter} onChange={event => setApproverFilter(event.target.value)}>
              <option value="all">Tüm Onaylayanlar</option>
              {approverOptions.map(actor => <option key={actor} value={actor}>{actor}</option>)}
            </select>
          </div>

          <div className="table-wrap purchase-approval-table-wrap">
            <table className="data-table purchase-approval-table">
              <thead>
                <tr>
                  <th>Onay No</th>
                  <th>RFQ No</th>
                  <th>Purchase Request</th>
                  <th>Talep Eden</th>
                  <th>Onay Durumu</th>
                  <th>Onaylayan</th>
                  <th>Onay Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun satın alma onayı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const rfq = rfqMap.get(record.rfqId)
                  const purchaseRequest = purchaseRequestMap.get(record.purchaseRequestId)

                  return (
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
                      <td data-label="Onay No"><strong>{record.approvalNo}</strong></td>
                      <td data-label="RFQ No">{rfq?.rfqNo || 'RFQ bulunamadı'}</td>
                      <td data-label="Purchase Request">{purchaseRequest ? `${purchaseRequest.requestNo} · ${purchaseRequest.title}` : 'Purchase Request bulunamadı'}</td>
                      <td data-label="Talep Eden">{purchaseRequest?.requester || '-'}</td>
                      <td data-label="Onay Durumu">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {PURCHASE_APPROVAL_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td data-label="Onaylayan">{getApprovalActor(record)}</td>
                      <td data-label="Onay Tarihi">{getApprovalDate(record)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side purchase-approval-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>RFQ Onaya Gönder</h3>
                  <p className="muted">{form.approvalNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <ApprovalForm
                form={form}
                rfqRecords={rfqRecords}
                purchaseRequestMap={purchaseRequestMap}
                approvals={records}
                onChange={setForm}
                onSubmit={submitApproval}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <ApprovalDetailPanel
              approval={selectedRecord}
              branches={branches}
              purchaseRequestMap={purchaseRequestMap}
              rfqMap={rfqMap}
              supplierMap={supplierMap}
              supplierProductMap={supplierProductMap}
              stockItemMap={stockItemMap}
              onCreate={startCreate}
              onApprove={approval => updateApprovalStatus(approval, 'APPROVED')}
              onReject={approval => updateApprovalStatus(approval, 'REJECTED')}
              onRevision={approval => updateApprovalStatus(approval, 'REVISION_REQUIRED')}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function ApprovalForm({
  form,
  rfqRecords,
  purchaseRequestMap,
  approvals,
  onChange,
  onSubmit,
  onCancel
}: {
  form: ApprovalFormState
  rfqRecords: RequestForQuotationRecord[]
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  approvals: PurchaseApproval[]
  onChange: (form: ApprovalFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  const eligibleRfqs = rfqRecords.filter(hasWinningQuotation)

  return (
    <form className="stacked-form purchase-approval-form" onSubmit={event => event.preventDefault()}>
      <div className="purchase-approval-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="purchase-approval-form-grid">
          <div className="form-field">
            <label>Onay No</label>
            <input value={form.approvalNo} readOnly />
          </div>
          <div className="form-field">
            <label>RFQ</label>
            <select value={form.rfqId} onChange={event => onChange({ ...form, rfqId: event.target.value })} required>
              <option value="">RFQ seçin</option>
              {eligibleRfqs.map(rfq => {
                const purchaseRequest = purchaseRequestMap.get(rfq.purchaseRequestId)
                const disabled = hasActivePurchaseApproval(approvals, rfq.id)

                return (
                  <option key={rfq.id} value={rfq.id} disabled={disabled}>
                    {rfq.rfqNo} · {purchaseRequest?.title || 'Purchase Request bulunamadı'}{disabled ? ' · Aktif onay var' : ''}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="purchase-approval-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Onay Notu</label>
          <textarea rows={4} value={form.approvalNote} onChange={event => onChange({ ...form, approvalNote: event.target.value })} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Onaya Gönder</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function ApprovalDetailPanel({
  approval,
  branches,
  purchaseRequestMap,
  rfqMap,
  supplierMap,
  supplierProductMap,
  stockItemMap,
  onCreate,
  onApprove,
  onReject,
  onRevision
}: {
  approval: PurchaseApproval | null
  branches: Branch[]
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
  rfqMap: Map<string, RequestForQuotationRecord>
  supplierMap: Map<string, Supplier>
  supplierProductMap: Map<string, SupplierProduct>
  stockItemMap: Map<string, StockItem>
  onCreate: () => void
  onApprove: (approval: PurchaseApproval) => void
  onReject: (approval: PurchaseApproval) => void
  onRevision: (approval: PurchaseApproval) => void
}){
  if(!approval){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Onay Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir satın alma onayı seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Onaya Gönder</button>
      </section>
    )
  }

  const rfq = rfqMap.get(approval.rfqId) || null
  const purchaseRequest = purchaseRequestMap.get(approval.purchaseRequestId) || null
  const winners = getWinningQuotations(rfq)
  const totalAmount = getWinningTotal(winners)
  const canTakeAction = approval.status === 'PENDING'

  return (
    <>
      <section className="card purchase-approval-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{approval.approvalNo}</h3>
            <p className="muted">{rfq?.rfqNo || 'RFQ bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(approval.status)}`}>
            {PURCHASE_APPROVAL_STATUS_LABELS[approval.status]}
          </span>
        </div>
        <div className="purchase-approval-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          {canTakeAction && <button className="btn primary" type="button" onClick={() => onApprove(approval)}>Onayla</button>}
          {canTakeAction && <button className="btn" type="button" onClick={() => onReject(approval)}>Reddet</button>}
          {canTakeAction && <button className="btn" type="button" onClick={() => onRevision(approval)}>Revizyona Gönder</button>}
        </div>
      </section>

      <section className="card purchase-approval-detail-card">
        <h3>Detay</h3>
        <div className="purchase-approval-detail-grid">
          <div><span>Purchase Request</span><strong>{approval.purchaseRequestId ? getPurchaseRequestLabel(approval.purchaseRequestId, purchaseRequestMap) : '-'}</strong></div>
          <div><span>RFQ</span><strong>{approval.rfqId ? getRfqLabel(approval.rfqId, rfqMap) : '-'}</strong></div>
          <div><span>RFQ Durumu</span><strong>{rfq ? REQUEST_FOR_QUOTATION_STATUS_LABELS[rfq.status] : '-'}</strong></div>
          <div><span>Şube</span><strong>{rfq ? getBranchLabel(rfq.branchId, branches) : '-'}</strong></div>
          <div><span>Talep Eden</span><strong>{purchaseRequest?.requester || '-'}</strong></div>
          <div><span>Toplam Kalem</span><strong>{winners.length}</strong></div>
          <div><span>Toplam Tutar</span><strong>{formatCurrency(totalAmount)}</strong></div>
          <div><span>Onay Tarihi</span><strong>{getApprovalDate(approval)}</strong></div>
        </div>
      </section>

      <section className="card purchase-approval-detail-card">
        <div className="section-header compact">
          <h3>Kazanan Teklifler</h3>
          <span className="status-pill">{winners.length} teklif</span>
        </div>
        <div className="purchase-approval-winner-list">
          {winners.length === 0 && <p className="muted">Kazanan teklif bulunmuyor.</p>}
          {winners.map(winner => {
            const supplier = supplierMap.get(winner.supplierId)
            const supplierProduct = supplierProductMap.get(winner.supplierProductId)
            const requestItem = purchaseRequest?.items.find(item => item.id === winner.purchaseRequestItemId)
            const stockItem = requestItem ? stockItemMap.get(requestItem.stockItemId) : undefined

            return (
              <div className="purchase-approval-winner-row" key={winner.id}>
                <div>
                  <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
                  <span>{supplier?.name || 'Supplier bulunamadı'} · {supplierProduct?.supplierProductName || 'Supplier Product yok'}</span>
                  <span>{requestItem ? formatQuantity(winner.quantity, requestItem.unit) : formatQuantity(winner.quantity, 'adet')} · {formatCurrency(winner.unitPrice, winner.currency)} / birim</span>
                </div>
                <strong>{formatCurrency(winner.totalPrice, winner.currency)}</strong>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card purchase-approval-detail-card">
        <h3>Notlar</h3>
        <div className="purchase-approval-notes">
          <p><strong>Onay Notu</strong><span>{approval.approvalNote || '-'}</span></p>
          <p><strong>Red Nedeni</strong><span>{approval.rejectionReason || '-'}</span></p>
          <p><strong>Revizyon Nedeni</strong><span>{approval.revisionReason || '-'}</span></p>
        </div>
      </section>
    </>
  )
}
