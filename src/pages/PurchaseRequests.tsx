import React from 'react'
import {
  PURCHASE_REQUEST_DEPARTMENT_LABELS,
  PURCHASE_REQUEST_DEPARTMENTS,
  PURCHASE_REQUEST_PRIORITIES,
  PURCHASE_REQUEST_PRIORITY_LABELS,
  PURCHASE_REQUEST_STATUSES,
  PURCHASE_REQUEST_STATUS_LABELS,
  getNextPurchaseRequestNo,
  loadPurchaseRequestRecords,
  savePurchaseRequestRecords
} from '../purchase-requests/purchase-request.mock'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestStatus
} from '../purchase-requests/purchase-request.types'
import {
  getActiveBranchId,
  loadBranches,
  loadStockItems
} from '../storage'
import type { Branch, StockItem, StockUnit, User } from '../types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = PurchaseRequestStatus | FilterValue
type DepartmentFilter = PurchaseRequestDepartment | FilterValue
type PriorityFilter = PurchaseRequestPriority | FilterValue
type PanelMode = 'detail' | 'form'

type PurchaseRequestItemFormState = {
  id: string
  stockItemId: string
  quantity: string
  unit: StockUnit | ''
  estimatedUnitPrice: string
  notes: string
}

type PurchaseRequestFormState = {
  requestNo: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  department: PurchaseRequestDepartment
  requester: string
  priority: PurchaseRequestPriority
  branchId: string
  notes: string
  items: PurchaseRequestItemFormState[]
}

type ItemFormField = keyof PurchaseRequestItemFormState
type RequestSaveMode = 'keep' | 'draft' | 'submit'

const DEFAULT_CURRENCY = 'TRY'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const normalizeNumberInput = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatCurrency = (value: number) => (
  `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`
)

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const roundPrice = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const calculateItemTotal = (quantity: string, estimatedUnitPrice: string) => {
  const parsedQuantity = normalizeNumberInput(quantity)
  const parsedPrice = normalizeNumberInput(estimatedUnitPrice)
  if(!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedPrice)) return 0
  return roundPrice(Math.max(0, parsedQuantity) * Math.max(0, parsedPrice))
}

const calculateRequestTotal = (request: Pick<PurchaseRequestRecord, 'items'>) => (
  roundPrice(request.items.reduce((total, item) => total + item.estimatedTotalPrice, 0))
)

const getStatusClass = (status: PurchaseRequestStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'REJECTED' || status === 'CANCELLED') return 'danger-pill'
  if(status === 'SUBMITTED') return 'warning-pill'
  return 'muted-pill'
}

const getPriorityClass = (priority: PurchaseRequestPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'LOW') return 'muted-pill'
  return 'success'
}

const getBranchLabel = (branchId: string, branches: Branch[]) => (
  branches.find(branch => branch.id === branchId)?.name || 'Şube bulunamadı'
)

const createEmptyItemForm = (stockItems: StockItem[]): PurchaseRequestItemFormState => {
  const stockItem = stockItems[0]

  return {
    id: createId('purchase_request_item_form'),
    stockItemId: stockItem?.id || '',
    quantity: '1',
    unit: stockItem?.unit || '',
    estimatedUnitPrice: '0',
    notes: ''
  }
}

const createEmptyForm = (
  records: PurchaseRequestRecord[],
  stockItems: StockItem[],
  branches: Branch[],
  currentUser: User
): PurchaseRequestFormState => {
  const activeBranchId = getActiveBranchId()
  const branchId = branches.some(branch => branch.id === activeBranchId)
    ? activeBranchId
    : branches[0]?.id || ''

  return {
    requestNo: getNextPurchaseRequestNo(records),
    title: '',
    description: '',
    requestDate: getTodayKey(),
    requiredDate: getTodayKey(),
    department: 'PRODUCTION',
    requester: currentUser.fullName || currentUser.username,
    priority: 'NORMAL',
    branchId,
    notes: '',
    items: [createEmptyItemForm(stockItems)]
  }
}

const createFormFromRecord = (record: PurchaseRequestRecord): PurchaseRequestFormState => ({
  requestNo: record.requestNo,
  title: record.title,
  description: record.description,
  requestDate: record.requestDate,
  requiredDate: record.requiredDate,
  department: record.department,
  requester: record.requester,
  priority: record.priority,
  branchId: record.branchId,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    stockItemId: item.stockItemId,
    quantity: String(item.quantity),
    unit: item.unit,
    estimatedUnitPrice: String(item.estimatedUnitPrice),
    notes: item.notes
  }))
})

const validateForm = (
  form: PurchaseRequestFormState,
  stockItems: StockItem[],
  branches: Branch[]
) => {
  if(!form.title.trim()) return 'Başlık zorunludur.'
  if(!form.department) return 'Departman zorunludur.'
  if(!form.requester.trim()) return 'Talep eden zorunludur.'
  if(!form.branchId || !branches.some(branch => branch.id === form.branchId)) return 'Şube zorunludur.'
  if(form.items.length === 0) return 'En az 1 adet talep kalemi bulunmalıdır.'

  for(const [index, item] of form.items.entries()){
    const rowNo = index + 1
    const quantity = normalizeNumberInput(item.quantity)
    const estimatedUnitPrice = normalizeNumberInput(item.estimatedUnitPrice)

    if(!item.stockItemId || !stockItems.some(stockItem => stockItem.id === item.stockItemId)){
      return `${rowNo}. kalemde Stock Item zorunludur.`
    }
    if(Number.isNaN(quantity) || quantity <= 0) return `${rowNo}. kalemde miktar 0'dan büyük olmalıdır.`
    if(Number.isNaN(estimatedUnitPrice) || estimatedUnitPrice < 0) return `${rowNo}. kalemde tahmini fiyat negatif olamaz.`
  }

  return ''
}

const createPayload = (
  form: PurchaseRequestFormState,
  stockItems: StockItem[],
  status: PurchaseRequestStatus,
  previousRecord?: PurchaseRequestRecord
): PurchaseRequestRecord => {
  const now = new Date().toISOString()
  const requestId = previousRecord?.id || createId('purchase_request')

  const items: PurchaseRequestItem[] = form.items.map((item, index) => {
    const stockItem = stockItems.find(record => record.id === item.stockItemId)
    const quantity = normalizeNumberInput(item.quantity)
    const estimatedUnitPrice = normalizeNumberInput(item.estimatedUnitPrice)

    return {
      id: item.id || `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
      requestId,
      stockItemId: item.stockItemId,
      quantity,
      unit: stockItem?.unit || item.unit || 'adet',
      estimatedUnitPrice,
      estimatedTotalPrice: roundPrice(quantity * estimatedUnitPrice),
      notes: item.notes.trim()
    }
  })

  return {
    id: requestId,
    requestNo: form.requestNo.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    requestDate: form.requestDate,
    requiredDate: form.requiredDate,
    department: form.department,
    requester: form.requester.trim(),
    priority: form.priority,
    status,
    branchId: form.branchId,
    notes: form.notes.trim(),
    createdAt: previousRecord?.createdAt || now,
    updatedAt: now,
    items
  }
}

export default function PurchaseRequests({ currentUser }: Props){
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [branches] = React.useState<Branch[]>(() => loadBranches())
  const [records, setRecords] = React.useState<PurchaseRequestRecord[]>(() => loadPurchaseRequestRecords(loadStockItems(), loadBranches()))
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<PurchaseRequestFormState>(() => createEmptyForm(loadPurchaseRequestRecords(loadStockItems(), loadBranches()), loadStockItems(), loadBranches(), currentUser))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [departmentFilter, setDepartmentFilter] = React.useState<DepartmentFilter>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: PurchaseRequestRecord[]) => {
    setRecords(nextRecords)
    savePurchaseRequestRecords(nextRecords)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const searchFields = [
        record.requestNo,
        record.title,
        record.requester,
        record.description
      ]

      const matchesSearch = !normalizedSearch
        || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesDepartment = departmentFilter === 'all' || record.department === departmentFilter
      const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter
      const matchesBranch = branchFilter === 'all' || record.branchId === branchFilter

      return matchesSearch && matchesStatus && matchesDepartment && matchesPriority && matchesBranch
    })
  }, [branchFilter, departmentFilter, priorityFilter, records, search, statusFilter])

  const totalEstimatedAmount = React.useMemo(() => (
    records.reduce((total, record) => total + calculateRequestTotal(record), 0)
  ), [records])
  const submittedCount = records.filter(record => record.status === 'SUBMITTED').length
  const urgentCount = records.filter(record => record.priority === 'URGENT').length

  const startCreate = () => {
    setEditingRecordId('')
    setForm(createEmptyForm(records, stockItems, branches, currentUser))
    setFormError('')
    setPanelMode('form')
  }

  const startEdit = (record: PurchaseRequestRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId(record.id)
    setForm(createFormFromRecord(record))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setEditingRecordId('')
    setForm(createEmptyForm(records, stockItems, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: PurchaseRequestRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId('')
    setFormError('')
    setPanelMode('detail')
  }

  const updateFormField = <K extends keyof PurchaseRequestFormState>(field: K, value: PurchaseRequestFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateItemField = (index: number, field: ItemFormField, value: PurchaseRequestItemFormState[ItemFormField]) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if(itemIndex !== index) return item
        if(field !== 'stockItemId') return { ...item, [field]: value }

        const stockItem = stockItemMap.get(String(value))
        return {
          ...item,
          stockItemId: String(value),
          unit: stockItem?.unit || ''
        }
      })
    }))
  }

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, createEmptyItemForm(stockItems)] }))
  }

  const removeItem = (index: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const saveRecord = (mode: RequestSaveMode) => {
    const validationError = validateForm(form, stockItems, branches)
    if(validationError){
      setFormError(validationError)
      return
    }

    const previousRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextStatus: PurchaseRequestStatus = mode === 'submit'
      ? 'SUBMITTED'
      : mode === 'draft'
        ? 'DRAFT'
        : previousRecord?.status || 'DRAFT'
    const payload = createPayload(form, stockItems, nextStatus, previousRecord)
    const nextRecords = previousRecord
      ? records.map(record => record.id === previousRecord.id ? payload : record)
      : [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setEditingRecordId('')
    setForm(createEmptyForm(nextRecords, stockItems, branches, currentUser))
    setFormError('')
    setPanelMode('detail')
  }

  const submitRecord = (record: PurchaseRequestRecord) => {
    const nextRecord: PurchaseRequestRecord = {
      ...record,
      status: 'SUBMITTED',
      updatedAt: new Date().toISOString()
    }
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  const cancelRecord = (record: PurchaseRequestRecord) => {
    if(!confirm(`${record.requestNo} talebi iptal edilecek. Emin misiniz?`)) return

    const nextRecord: PurchaseRequestRecord = {
      ...record,
      status: 'CANCELLED',
      updatedAt: new Date().toISOString()
    }
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(nextRecord.id)
  }

  const deleteRecord = (record: PurchaseRequestRecord) => {
    if(!confirm(`${record.requestNo} talebi silinecek. Emin misiniz?`)) return

    const nextRecords = records.filter(item => item.id !== record.id)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
    setEditingRecordId('')
    setPanelMode('detail')
  }

  return (
    <div className="purchase-request-page">
      <div className="page-header">
        <div>
          <h2>Satın Alma Talepleri</h2>
          <p className="muted">İşletme içi satın alma ihtiyaçlarını stok kartları üzerinden kayıt altına alın.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Yeni Talep</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Talep</span>
          <strong>{records.length}</strong>
        </div>
        <div className="metric-card">
          <span>Gönderilen</span>
          <strong>{submittedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Acil</span>
          <strong>{urgentCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tahmini Tutar</span>
          <strong>{formatCurrency(totalEstimatedAmount)}</strong>
        </div>
      </div>

      <div className="product-layout purchase-request-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Talep Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          {stockItems.length === 0 && (
            <div className="form-error purchase-request-warning">
              Satın alma talebi oluşturmak için önce Stock Management içinde en az bir stok kartı oluşturulmalıdır.
            </div>
          )}

          <div className="purchase-request-toolbar">
            <input
              type="search"
              placeholder="Talep no, başlık, talep eden veya açıklama ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {PURCHASE_REQUEST_STATUSES.map(status => (
                <option key={status} value={status}>{PURCHASE_REQUEST_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value as DepartmentFilter)}>
              <option value="all">Tüm Departmanlar</option>
              {PURCHASE_REQUEST_DEPARTMENTS.map(department => (
                <option key={department} value={department}>{PURCHASE_REQUEST_DEPARTMENT_LABELS[department]}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}>
              <option value="all">Tüm Öncelikler</option>
              {PURCHASE_REQUEST_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{PURCHASE_REQUEST_PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>

          <div className="table-wrap purchase-request-table-wrap">
            <table className="data-table purchase-request-table">
              <thead>
                <tr>
                  <th>Talep No</th>
                  <th>Başlık</th>
                  <th>Departman</th>
                  <th>Talep Eden</th>
                  <th>Talep Tarihi</th>
                  <th>İstenen Tarih</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>Kalem Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">Bu filtrelere uygun satın alma talebi bulunamadı.</td></tr>
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
                    <td data-label="Talep No"><strong>{record.requestNo}</strong></td>
                    <td data-label="Başlık">{record.title}</td>
                    <td data-label="Departman">{PURCHASE_REQUEST_DEPARTMENT_LABELS[record.department]}</td>
                    <td data-label="Talep Eden">{record.requester}</td>
                    <td data-label="Talep Tarihi">{formatDate(record.requestDate)}</td>
                    <td data-label="İstenen Tarih">{formatDate(record.requiredDate)}</td>
                    <td data-label="Öncelik">
                      <span className={`status-pill ${getPriorityClass(record.priority)}`}>
                        {PURCHASE_REQUEST_PRIORITY_LABELS[record.priority]}
                      </span>
                    </td>
                    <td data-label="Durum">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {PURCHASE_REQUEST_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                    <td data-label="Kalem Sayısı">{record.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side purchase-request-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>{editingRecordId ? 'Talep Düzenle' : 'Yeni Talep'}</h3>
                  <p className="muted">{form.requestNo}</p>
                </div>
                {editingRecordId && <span className="status-pill">Düzenleme</span>}
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <PurchaseRequestForm
                form={form}
                branches={branches}
                stockItems={stockItems}
                editing={Boolean(editingRecordId)}
                onChange={updateFormField}
                onItemChange={updateItemField}
                onAddItem={addItem}
                onRemoveItem={removeItem}
                onSave={saveRecord}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <PurchaseRequestDetailPanel
              record={selectedRecord}
              branches={branches}
              stockItemMap={stockItemMap}
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

function PurchaseRequestDetailPanel({
  record,
  branches,
  stockItemMap,
  onCreate,
  onEdit,
  onSubmit,
  onCancelRequest,
  onDelete
}: {
  record: PurchaseRequestRecord | null
  branches: Branch[]
  stockItemMap: Map<string, StockItem>
  onCreate: () => void
  onEdit: (record: PurchaseRequestRecord) => void
  onSubmit: (record: PurchaseRequestRecord) => void
  onCancelRequest: (record: PurchaseRequestRecord) => void
  onDelete: (record: PurchaseRequestRecord) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Talep Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir satın alma talebi seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Yeni Talep</button>
      </section>
    )
  }

  const requestTotal = calculateRequestTotal(record)
  const canSubmit = record.status === 'DRAFT'
  const canCancel = record.status !== 'CANCELLED' && record.status !== 'REJECTED'

  return (
    <>
      <section className="card purchase-request-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.requestNo}</h3>
            <p className="muted">{record.title}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {PURCHASE_REQUEST_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="purchase-request-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn primary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
          {canSubmit && <button className="btn" type="button" onClick={() => onSubmit(record)}>Gönder</button>}
          {canCancel && <button className="btn" type="button" onClick={() => onCancelRequest(record)}>İptal</button>}
          <button className="btn" type="button" onClick={() => onDelete(record)}>Sil</button>
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Talep Bilgileri</h3>
        <div className="purchase-request-detail-grid">
          <div><span>Başlık</span><strong>{record.title}</strong></div>
          <div><span>Şube</span><strong>{getBranchLabel(record.branchId, branches)}</strong></div>
          <div><span>Talep Tarihi</span><strong>{formatDate(record.requestDate)}</strong></div>
          <div><span>İstenen Tarih</span><strong>{formatDate(record.requiredDate)}</strong></div>
          <div><span>Açıklama</span><strong>{record.description || '-'}</strong></div>
          <div><span>Toplam Tahmini Tutar</span><strong>{formatCurrency(requestTotal)}</strong></div>
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Talep Eden</h3>
        <div className="purchase-request-detail-grid">
          <div><span>Talep Eden</span><strong>{record.requester}</strong></div>
          <div><span>Departman</span><strong>{PURCHASE_REQUEST_DEPARTMENT_LABELS[record.department]}</strong></div>
          <div><span>Öncelik</span><strong>{PURCHASE_REQUEST_PRIORITY_LABELS[record.priority]}</strong></div>
          <div><span>Durum</span><strong>{PURCHASE_REQUEST_STATUS_LABELS[record.status]}</strong></div>
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <div className="section-header compact">
          <h3>Talep Kalemleri</h3>
          <span className="status-pill">{record.items.length} kalem</span>
        </div>
        <div className="purchase-request-detail-items">
          {record.items.map(item => {
            const stockItem = stockItemMap.get(item.stockItemId)
            return (
              <div className="purchase-request-detail-item" key={item.id}>
                <div>
                  <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
                  <span>{formatQuantity(item.quantity, item.unit)} · {formatCurrency(item.estimatedUnitPrice)} / {item.unit}</span>
                </div>
                <strong>{formatCurrency(item.estimatedTotalPrice)}</strong>
                {item.notes && <p>{item.notes}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Notlar</h3>
        <p className="muted purchase-request-notes">{record.notes || 'Not bulunmuyor.'}</p>
      </section>
    </>
  )
}

function PurchaseRequestForm({
  form,
  branches,
  stockItems,
  editing,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSave,
  onCancel
}: {
  form: PurchaseRequestFormState
  branches: Branch[]
  stockItems: StockItem[]
  editing: boolean
  onChange: <K extends keyof PurchaseRequestFormState>(field: K, value: PurchaseRequestFormState[K]) => void
  onItemChange: (index: number, field: ItemFormField, value: PurchaseRequestItemFormState[ItemFormField]) => void
  onAddItem: () => void
  onRemoveItem: (index: number) => void
  onSave: (mode: RequestSaveMode) => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form purchase-request-form" onSubmit={event => event.preventDefault()}>
      <div className="purchase-request-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="purchase-request-form-grid">
          <div className="form-field">
            <label>Talep No</label>
            <input value={form.requestNo} readOnly />
          </div>
          <div className="form-field">
            <label>Şube</label>
            <select value={form.branchId} onChange={event => onChange('branchId', event.target.value)} required>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div className="form-field purchase-request-form-wide">
            <label>Başlık</label>
            <input value={form.title} onChange={event => onChange('title', event.target.value)} required />
          </div>
          <div className="form-field purchase-request-form-wide">
            <label>Açıklama</label>
            <textarea rows={3} value={form.description} onChange={event => onChange('description', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Talep Tarihi</label>
            <input type="date" value={form.requestDate} onChange={event => onChange('requestDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>İstenen Tarih</label>
            <input type="date" value={form.requiredDate} onChange={event => onChange('requiredDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Departman</label>
            <select value={form.department} onChange={event => onChange('department', event.target.value as PurchaseRequestDepartment)} required>
              {PURCHASE_REQUEST_DEPARTMENTS.map(department => (
                <option key={department} value={department}>{PURCHASE_REQUEST_DEPARTMENT_LABELS[department]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Öncelik</label>
            <select value={form.priority} onChange={event => onChange('priority', event.target.value as PurchaseRequestPriority)}>
              {PURCHASE_REQUEST_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{PURCHASE_REQUEST_PRIORITY_LABELS[priority]}</option>
              ))}
            </select>
          </div>
          <div className="form-field purchase-request-form-wide">
            <label>Talep Eden</label>
            <input value={form.requester} onChange={event => onChange('requester', event.target.value)} required />
          </div>
        </div>
      </div>

      <div className="purchase-request-form-section">
        <div className="section-header compact">
          <h4>Talep Kalemleri</h4>
          <button className="btn" type="button" onClick={onAddItem} disabled={stockItems.length === 0}>Kalem Ekle</button>
        </div>
        <div className="purchase-request-item-list">
          {form.items.map((item, index) => (
            <div className="purchase-request-item-row" key={item.id}>
              <div className="form-field purchase-request-item-stock">
                <label>Stock Item</label>
                <select value={item.stockItemId} onChange={event => onItemChange(index, 'stockItemId', event.target.value)} required>
                  <option value="">Stok kartı seçin</option>
                  {stockItems.map(stockItem => (
                    <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Miktar</label>
                <input min="0.000001" step="0.001" type="number" value={item.quantity} onChange={event => onItemChange(index, 'quantity', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Birim</label>
                <input value={item.unit} readOnly />
              </div>
              <div className="form-field">
                <label>Tahmini Birim Fiyat</label>
                <input min="0" step="0.01" type="number" value={item.estimatedUnitPrice} onChange={event => onItemChange(index, 'estimatedUnitPrice', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Tahmini Toplam</label>
                <input value={formatCurrency(calculateItemTotal(item.quantity, item.estimatedUnitPrice))} readOnly />
              </div>
              <div className="form-field purchase-request-item-note">
                <label>Not</label>
                <input value={item.notes} onChange={event => onItemChange(index, 'notes', event.target.value)} />
              </div>
              <button className="btn purchase-request-item-remove" type="button" onClick={() => onRemoveItem(index)}>Sil</button>
            </div>
          ))}
        </div>
      </div>

      <div className="purchase-request-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Not</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange('notes', event.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={() => onSave(editing ? 'keep' : 'draft')}>Kaydet</button>
        <button className="btn" type="button" onClick={() => onSave('submit')}>Gönder</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}
