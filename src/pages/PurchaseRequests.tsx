import React from 'react'
import {
  ApprovedAlternativeMaterialService
} from '../approved-alternative-materials/approved-alternative-material.service'
import {
  DEFAULT_PURCHASE_REQUEST_CURRENCY,
  PURCHASE_REQUEST_DEPARTMENT_LABELS,
  PURCHASE_REQUEST_DEPARTMENTS,
  PURCHASE_REQUEST_PRIORITIES,
  PURCHASE_REQUEST_PRIORITY_LABELS,
  PURCHASE_REQUEST_SOURCE_LABELS,
  PURCHASE_REQUEST_SOURCES,
  PURCHASE_REQUEST_STATUSES,
  PURCHASE_REQUEST_STATUS_LABELS
} from '../purchase-requests/purchase-request.mock'
import {
  createPurchaseRequestInputFromSuggestion,
  createPurchaseRequestRecordFromInput,
  loadPurchaseRequestServiceData,
  persistPurchaseRequestRecords,
  upsertPurchaseRequestRecord,
  type PurchaseRequestInput,
  type PurchaseRequestInputItem
} from '../purchase-requests/purchase-request.service'
import { calculatePurchaseRequestStatistics, calculatePurchaseRequestTotal } from '../purchase-requests/purchase-request-statistics.service'
import { createPurchaseRequestSuggestions } from '../purchase-requests/purchase-request-suggestion.service'
import {
  PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS,
  transitionPurchaseRequest
} from '../purchase-requests/purchase-request-workflow.service'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestReadModelContext,
  PurchaseRequestRecord,
  PurchaseRequestSource,
  PurchaseRequestStatus,
  PurchaseRequestSuggestion
} from '../purchase-requests/purchase-request.types'
import type { Branch, StockItem, User } from '../types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'

type Props = {
  currentUser: User
}

type FilterValue = 'all'
type StatusFilter = PurchaseRequestStatus | FilterValue
type SourceFilter = PurchaseRequestSource | FilterValue
type DepartmentFilter = PurchaseRequestDepartment | FilterValue
type PriorityFilter = PurchaseRequestPriority | FilterValue
type PanelMode = 'detail' | 'form'
type RequestSaveMode = 'keep' | 'draft' | 'submit'

type PurchaseRequestItemFormState = {
  id: string
  stockItemId: string
  requestedQuantity: string
  estimatedUnitPrice: string
  suggestedSupplierId: string
  notes: string
}

type PurchaseRequestFormState = {
  requestNo: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  requester: string
  department: PurchaseRequestDepartment
  warehouseId: string
  branchId: string
  source: PurchaseRequestSource
  priority: PurchaseRequestPriority
  notes: string
  items: PurchaseRequestItemFormState[]
}

type ItemFormField = keyof PurchaseRequestItemFormState

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getUserName = (user: User) => user.fullName || user.username

const normalizeNumberInput = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatCurrency = (value: number, currency = DEFAULT_PURCHASE_REQUEST_CURRENCY) => {
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

const getStatusClass = (status: PurchaseRequestStatus) => {
  if(status === 'APPROVED' || status === 'PURCHASE_ORDER_CREATED') return 'success'
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

const getStockItemLabel = (stockItemId: string, stockItemMap: Map<string, StockItem>) => (
  stockItemMap.get(stockItemId)?.name || 'Stok kartı bulunamadı'
)

const getCategoryLabel = (categoryId: string, context: PurchaseRequestReadModelContext) => (
  context.stockCategories.find(category => category.id === categoryId)?.name || '-'
)

const isSupplierSelectable = (supplier: Supplier) => (
  supplier.status === 'ACTIVE'
  && supplier.approvalStatus === 'APPROVED'
  && supplier.workingStatus !== 'STOPPED'
  && supplier.workingStatus !== 'ON_HOLD'
)

const getSupplierProductOptions = (
  stockItemId: string,
  context: PurchaseRequestReadModelContext,
  supplierMap: Map<string, Supplier>
) => (
  context.supplierProducts.filter(product => {
    const supplier = supplierMap.get(product.supplierId)
    return product.stockItemId === stockItemId
      && product.status === 'ACTIVE'
      && Boolean(supplier && isSupplierSelectable(supplier))
  })
)

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => (
  supplierMap.get(supplierId)?.name || 'Supplier bulunamadı'
)

const createEmptyItemForm = (context: PurchaseRequestReadModelContext): PurchaseRequestItemFormState => {
  const stockItem = context.stockItems.find(item => item.active) || context.stockItems[0]

  return {
    id: createId('purchase_request_item_form'),
    stockItemId: stockItem?.id || '',
    requestedQuantity: '1',
    estimatedUnitPrice: String(stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || stockItem?.averageCost || 0),
    suggestedSupplierId: '',
    notes: ''
  }
}

const createEmptyForm = (
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext,
  currentUser: User
): PurchaseRequestFormState => {
  const branch = context.branches.find(item => item.isActive) || context.branches[0]

  return {
    requestNo: records.length > 0
      ? `PR-${String(Math.max(...records.map(record => Number(record.requestNo.match(/PR-(\d+)$/)?.[1] || 0))) + 1).padStart(6, '0')}`
      : 'PR-000001',
    title: '',
    description: '',
    requestDate: getTodayKey(),
    requiredDate: getTodayKey(),
    requester: getUserName(currentUser),
    department: 'PRODUCTION',
    warehouseId: branch?.id || '',
    branchId: branch?.id || '',
    source: 'MANUAL',
    priority: 'NORMAL',
    notes: '',
    items: [createEmptyItemForm(context)]
  }
}

const createFormFromInput = (input: PurchaseRequestInput): PurchaseRequestFormState => ({
  requestNo: input.requestNo || '',
  title: input.title,
  description: input.description,
  requestDate: input.requestDate,
  requiredDate: input.requiredDate,
  requester: input.requester,
  department: input.department,
  warehouseId: input.warehouseId,
  branchId: input.branchId,
  source: input.source,
  priority: input.priority,
  notes: input.notes,
  items: input.items.map(item => ({
    id: item.id || createId('purchase_request_item_form'),
    stockItemId: item.stockItemId,
    requestedQuantity: String(item.requestedQuantity),
    estimatedUnitPrice: String(item.estimatedUnitPrice),
    suggestedSupplierId: item.suggestedSupplierId || '',
    notes: item.notes
  }))
})

const createFormFromRecord = (record: PurchaseRequestRecord): PurchaseRequestFormState => ({
  requestNo: record.requestNo,
  title: record.title,
  description: record.description,
  requestDate: record.requestDate,
  requiredDate: record.requiredDate,
  requester: record.requester,
  department: record.department,
  warehouseId: record.warehouseId,
  branchId: record.branchId,
  source: record.source,
  priority: record.priority,
  notes: record.notes,
  items: record.items.map(item => ({
    id: item.id,
    stockItemId: item.stockItemId,
    requestedQuantity: String(item.requestedQuantity || item.quantity),
    estimatedUnitPrice: String(item.estimatedUnitPrice),
    suggestedSupplierId: item.suggestedSupplierId || '',
    notes: item.notes
  }))
})

const createInputFromForm = (
  form: PurchaseRequestFormState,
  status?: PurchaseRequestStatus
): PurchaseRequestInput => ({
  requestNo: form.requestNo,
  title: form.title,
  description: form.description,
  requestDate: form.requestDate,
  requiredDate: form.requiredDate,
  requester: form.requester,
  department: form.department,
  warehouseId: form.warehouseId,
  branchId: form.branchId,
  source: form.source,
  priority: form.priority,
  status,
  notes: form.notes,
  items: form.items.map<PurchaseRequestInputItem>(item => ({
    id: item.id,
    stockItemId: item.stockItemId,
    requestedQuantity: normalizeNumberInput(item.requestedQuantity),
    estimatedUnitPrice: normalizeNumberInput(item.estimatedUnitPrice),
    suggestedSupplierId: item.suggestedSupplierId || undefined,
    source: form.source,
    notes: item.notes
  }))
})

const calculateFormItemTotal = (quantity: string, estimatedUnitPrice: string) => {
  const parsedQuantity = normalizeNumberInput(quantity)
  const parsedPrice = normalizeNumberInput(estimatedUnitPrice)
  if(!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedPrice)) return 0
  return roundMoney(Math.max(0, parsedQuantity) * Math.max(0, parsedPrice))
}

export default function PurchaseRequests({ currentUser }: Props){
  const initialData = React.useMemo(loadPurchaseRequestServiceData, [])
  const context = initialData.context
  const [records, setRecords] = React.useState<PurchaseRequestRecord[]>(initialData.records)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<PurchaseRequestFormState>(() => createEmptyForm(initialData.records, context, currentUser))
  const [formError, setFormError] = React.useState('')
  const [formWarnings, setFormWarnings] = React.useState<string[]>([])
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [warehouseFilter, setWarehouseFilter] = React.useState('all')
  const [departmentFilter, setDepartmentFilter] = React.useState<DepartmentFilter>('all')
  const [productFilter, setProductFilter] = React.useState('all')
  const [dateFilter, setDateFilter] = React.useState('')

  const stockItemMap = React.useMemo(() => new Map(context.stockItems.map(item => [item.id, item])), [context.stockItems])
  const supplierMap = React.useMemo(() => new Map(context.suppliers.map(supplier => [supplier.id, supplier])), [context.suppliers])
  const approvedAlternativeMaterialContext = React.useMemo(() => ({
    stockItems: context.stockItems,
    suppliers: context.suppliers,
    supplierProducts: context.supplierProducts
  }), [context.stockItems, context.supplierProducts, context.suppliers])
  const approvedAlternativeMaterialRecords = React.useMemo(() => (
    ApprovedAlternativeMaterialService.load(approvedAlternativeMaterialContext)
  ), [approvedAlternativeMaterialContext])
  const statistics = React.useMemo(() => calculatePurchaseRequestStatistics(records, context.stockItems), [context.stockItems, records])
  const suggestions = React.useMemo(() => createPurchaseRequestSuggestions(records, context), [context, records])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: PurchaseRequestRecord[]) => {
    setRecords(nextRecords)
    persistPurchaseRequestRecords(nextRecords)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records
      .filter(record => {
        const itemNames = record.items.map(item => getStockItemLabel(item.stockItemId, stockItemMap))
        const searchFields = [
          record.requestNo,
          record.title,
          record.requester,
          PURCHASE_REQUEST_DEPARTMENT_LABELS[record.department],
          PURCHASE_REQUEST_SOURCE_LABELS[record.source],
          getBranchLabel(record.branchId, context.branches),
          ...itemNames
        ]

        const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter
        const matchesSource = sourceFilter === 'all' || record.source === sourceFilter
        const matchesPriority = priorityFilter === 'all' || record.priority === priorityFilter
        const matchesBranch = branchFilter === 'all' || record.branchId === branchFilter
        const matchesWarehouse = warehouseFilter === 'all' || record.warehouseId === warehouseFilter
        const matchesDepartment = departmentFilter === 'all' || record.department === departmentFilter
        const matchesProduct = productFilter === 'all' || record.items.some(item => item.stockItemId === productFilter)
        const matchesDate = !dateFilter || record.requestDate === dateFilter

        return matchesSearch
          && matchesStatus
          && matchesSource
          && matchesPriority
          && matchesBranch
          && matchesWarehouse
          && matchesDepartment
          && matchesProduct
          && matchesDate
      })
      .sort((first, second) => second.requestDate.localeCompare(first.requestDate) || second.requestNo.localeCompare(first.requestNo))
  }, [branchFilter, context.branches, dateFilter, departmentFilter, priorityFilter, productFilter, records, search, sourceFilter, statusFilter, stockItemMap, warehouseFilter])

  const resetFormState = (nextRecords = records) => {
    setForm(createEmptyForm(nextRecords, context, currentUser))
    setFormError('')
    setFormWarnings([])
  }

  const startCreate = () => {
    setEditingRecordId('')
    resetFormState()
    setPanelMode('form')
  }

  const startFromSuggestion = (suggestion: PurchaseRequestSuggestion) => {
    setEditingRecordId('')
    setForm(createFormFromInput(createPurchaseRequestInputFromSuggestion(suggestion, records, currentUser)))
    setFormError('')
    setFormWarnings(suggestion.openRequestNos.length > 0 ? [`Açık talep var: ${suggestion.openRequestNos.join(', ')}`] : [])
    setPanelMode('form')
  }

  const startEdit = (record: PurchaseRequestRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId(record.id)
    setForm(createFormFromRecord(record))
    setFormError('')
    setFormWarnings([])
    setPanelMode('form')
  }

  const cancelForm = () => {
    setEditingRecordId('')
    resetFormState()
    setPanelMode('detail')
  }

  const selectRecord = (record: PurchaseRequestRecord) => {
    setSelectedRecordId(record.id)
    setEditingRecordId('')
    setFormError('')
    setFormWarnings([])
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
          estimatedUnitPrice: String(stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || stockItem?.averageCost || item.estimatedUnitPrice || 0),
          suggestedSupplierId: ''
        }
      })
    }))
  }

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, createEmptyItemForm(context)] }))
  }

  const removeItem = (index: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const saveRecord = (mode: RequestSaveMode) => {
    const previousRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const nextStatus: PurchaseRequestStatus = mode === 'submit'
      ? 'SUBMITTED'
      : mode === 'draft'
        ? 'DRAFT'
        : previousRecord?.status || 'DRAFT'

    try{
      const result = createPurchaseRequestRecordFromInput(
        createInputFromForm(form, nextStatus),
        records,
        context,
        getUserName(currentUser),
        previousRecord
      )
      const nextRecords = upsertPurchaseRequestRecord(records, result.record)

      commitRecords(nextRecords)
      setSelectedRecordId(result.record.id)
      setEditingRecordId('')
      resetFormState(nextRecords)
      setFormWarnings(result.validation.warnings)
      setPanelMode('detail')
    } catch(error){
      setFormError(error instanceof Error ? error.message : 'Purchase Request kaydedilemedi.')
    }
  }

  const transitionRecord = (record: PurchaseRequestRecord, status: PurchaseRequestStatus, note = '') => {
    try{
      const nextRecord = transitionPurchaseRequest(record, status, getUserName(currentUser), note)
      commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
      setSelectedRecordId(nextRecord.id)
    } catch(error){
      setFormError(error instanceof Error ? error.message : 'Workflow geçişi yapılamadı.')
    }
  }

  return (
    <div className="purchase-request-page">
      <div className="page-header">
        <div>
          <h2>Satın Alma Talepleri</h2>
          <p className="muted">Resmi Purchase Request kayıtları; stok, üretim, fire ve manuel ihtiyaç kaynaklarıyla yönetilir.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Yeni Talep</button>
      </div>

      <PurchaseRequestDashboard statistics={statistics} />

      <PurchaseRequestStatisticsPanel
        statistics={statistics}
        stockItemMap={stockItemMap}
      />

      <PurchaseRequestSuggestionPanel
        suggestions={suggestions}
        context={context}
        supplierMap={supplierMap}
        stockItemMap={stockItemMap}
        onCreate={startFromSuggestion}
      />

      <div className="product-layout purchase-request-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Talep Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          {context.stockItems.length === 0 && (
            <div className="form-error purchase-request-warning">
              Purchase Request oluşturmak için önce stok kartı oluşturulmalıdır.
            </div>
          )}

          <div className="purchase-request-toolbar">
            <input
              type="search"
              placeholder="Talep no, ürün, departman veya şube ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {PURCHASE_REQUEST_STATUSES.map(status => (
                <option key={status} value={status}>{PURCHASE_REQUEST_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as SourceFilter)}>
              <option value="all">Tüm Kaynaklar</option>
              {PURCHASE_REQUEST_SOURCES.map(source => (
                <option key={source} value={source}>{PURCHASE_REQUEST_SOURCE_LABELS[source]}</option>
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
              {context.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}>
              <option value="all">Tüm Depolar</option>
              {context.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value as DepartmentFilter)}>
              <option value="all">Tüm Departmanlar</option>
              {PURCHASE_REQUEST_DEPARTMENTS.map(department => (
                <option key={department} value={department}>{PURCHASE_REQUEST_DEPARTMENT_LABELS[department]}</option>
              ))}
            </select>
            <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
              <option value="all">Tüm Ürünler</option>
              {context.stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={event => setDateFilter(event.target.value)}
              aria-label="Tarih"
            />
          </div>

          <div className="table-wrap purchase-request-table-wrap">
            <table className="data-table purchase-request-table">
              <thead>
                <tr>
                  <th>Talep No</th>
                  <th>Talep Tarihi</th>
                  <th>Departman</th>
                  <th>Depo</th>
                  <th>Şube</th>
                  <th>Kaynak</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>Toplam Kalem</th>
                  <th>Tahmini Tutar</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={10} className="empty-cell">Bu filtrelere uygun Purchase Request bulunamadı.</td></tr>
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
                    <td data-label="Talep No">
                      <strong>{record.requestNo}</strong>
                      <span>{record.title}</span>
                    </td>
                    <td data-label="Talep Tarihi">{formatDate(record.requestDate)}</td>
                    <td data-label="Departman">{PURCHASE_REQUEST_DEPARTMENT_LABELS[record.department]}</td>
                    <td data-label="Depo">{getBranchLabel(record.warehouseId, context.branches)}</td>
                    <td data-label="Şube">{getBranchLabel(record.branchId, context.branches)}</td>
                    <td data-label="Kaynak">{PURCHASE_REQUEST_SOURCE_LABELS[record.source]}</td>
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
                    <td data-label="Toplam Kalem">{record.items.length}</td>
                    <td data-label="Tahmini Tutar"><strong>{formatCurrency(calculatePurchaseRequestTotal(record))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side purchase-request-side">
          {formError && panelMode === 'detail' && <div className="form-error">{formError}</div>}
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>{editingRecordId ? 'Talep Düzenle' : 'Yeni Talep'}</h3>
                  <p className="muted">{form.requestNo}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              {formWarnings.length > 0 && (
                <div className="purchase-request-warning-list">
                  {formWarnings.map(warning => <span key={warning}>{warning}</span>)}
                </div>
              )}
              <PurchaseRequestForm
                form={form}
                context={context}
                supplierMap={supplierMap}
                approvedAlternativeRecords={approvedAlternativeMaterialRecords}
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
              context={context}
              stockItemMap={stockItemMap}
              supplierMap={supplierMap}
              approvedAlternativeRecords={approvedAlternativeMaterialRecords}
              onCreate={startCreate}
              onEdit={startEdit}
              onTransition={transitionRecord}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function PurchaseRequestDashboard({
  statistics
}: {
  statistics: ReturnType<typeof calculatePurchaseRequestStatistics>
}){
  return (
    <div className="metric-grid purchase-request-dashboard-grid">
      <div className="metric-card">
        <span>Toplam Talep</span>
        <strong>{statistics.totalRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Bekleyen</span>
        <strong>{statistics.waitingRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Onay Bekleyen</span>
        <strong>{statistics.approvalWaitingRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Onaylanan</span>
        <strong>{statistics.approvedRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Reddedilen</span>
        <strong>{statistics.rejectedRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Acil Talepler</span>
        <strong>{statistics.urgentRequests}</strong>
      </div>
      <div className="metric-card">
        <span>Bugünkü Talepler</span>
        <strong>{statistics.todayRequests}</strong>
      </div>
    </div>
  )
}

function PurchaseRequestStatisticsPanel({
  statistics,
  stockItemMap
}: {
  statistics: ReturnType<typeof calculatePurchaseRequestStatistics>
  stockItemMap: Map<string, StockItem>
}){
  const maxSourceCount = Math.max(...statistics.sourceDistribution.map(item => item.count), 1)

  return (
    <section className="card purchase-request-statistics-card">
      <div className="section-header">
        <div>
          <h3>İstatistikler</h3>
          <p className="muted">Talep hacmi, maliyet ve kaynak kırılımları.</p>
        </div>
      </div>
      <div className="purchase-request-stat-grid">
        <div>
          <span>Toplam Satır</span>
          <strong>{statistics.totalLines}</strong>
        </div>
        <div>
          <span>Toplam Tahmini Maliyet</span>
          <strong>{formatCurrency(statistics.totalEstimatedCost)}</strong>
        </div>
        <div>
          <span>En Çok Talep Edilen Ürün</span>
          <strong>{stockItemMap.get(statistics.topRequestedProduct.stockItemId)?.name || statistics.topRequestedProduct.productName}</strong>
          <small>{formatQuantity(statistics.topRequestedProduct.quantity, stockItemMap.get(statistics.topRequestedProduct.stockItemId)?.unit || '')}</small>
        </div>
        <div>
          <span>En Çok Talep Oluşturan Departman</span>
          <strong>{PURCHASE_REQUEST_DEPARTMENT_LABELS[statistics.topRequestDepartment.department]}</strong>
          <small>{statistics.topRequestDepartment.count} talep</small>
        </div>
      </div>
      <div className="purchase-request-source-bars">
        {statistics.sourceDistribution.map(item => (
          <div className="purchase-request-source-row" key={item.source}>
            <strong>{PURCHASE_REQUEST_SOURCE_LABELS[item.source]}</strong>
            <div className="purchase-request-source-track">
              <span style={{ width: `${Math.max(6, (item.count / maxSourceCount) * 100)}%` }} />
            </div>
            <em>{item.count}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function PurchaseRequestSuggestionPanel({
  suggestions,
  context,
  supplierMap,
  stockItemMap,
  onCreate
}: {
  suggestions: PurchaseRequestSuggestion[]
  context: PurchaseRequestReadModelContext
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  onCreate: (suggestion: PurchaseRequestSuggestion) => void
}){
  return (
    <section className="card purchase-request-suggestion-card">
      <div className="section-header">
        <div>
          <h3>Otomatik Öneriler</h3>
          <p className="muted">{suggestions.length} öneri hazır.</p>
        </div>
      </div>
      <div className="purchase-request-suggestion-grid">
        {suggestions.slice(0, 8).map(suggestion => (
          <article className="purchase-request-suggestion" key={suggestion.id}>
            <div>
              <span className={`status-pill ${getPriorityClass(suggestion.priority)}`}>
                {PURCHASE_REQUEST_SOURCE_LABELS[suggestion.source]}
              </span>
              <h4>{getStockItemLabel(suggestion.stockItemId, stockItemMap)}</h4>
              <p>{suggestion.reason}</p>
            </div>
            <div className="purchase-request-suggestion-meta">
              <span>{formatQuantity(suggestion.requestedQuantity, suggestion.unit)}</span>
              <span>{formatCurrency(suggestion.estimatedTotalPrice)}</span>
              <span>{suggestion.suggestedSupplierId ? getSupplierLabel(suggestion.suggestedSupplierId, supplierMap) : 'Supplier önerisi yok'}</span>
              <span>{getBranchLabel(suggestion.warehouseId, context.branches)}</span>
            </div>
            {suggestion.openRequestNos.length > 0 && (
              <small>Açık PR: {suggestion.openRequestNos.join(', ')}</small>
            )}
            <button className="btn primary" type="button" onClick={() => onCreate(suggestion)}>Talep Aç</button>
          </article>
        ))}
        {suggestions.length === 0 && (
          <div className="empty-cell">Kritik stok, üretim veya fire kaynaklı otomatik öneri bulunamadı.</div>
        )}
      </div>
    </section>
  )
}

function PurchaseRequestDetailPanel({
  record,
  context,
  stockItemMap,
  supplierMap,
  approvedAlternativeRecords,
  onCreate,
  onEdit,
  onTransition
}: {
  record: PurchaseRequestRecord | null
  context: PurchaseRequestReadModelContext
  stockItemMap: Map<string, StockItem>
  supplierMap: Map<string, Supplier>
  approvedAlternativeRecords: ReturnType<typeof ApprovedAlternativeMaterialService.load>
  onCreate: () => void
  onEdit: (record: PurchaseRequestRecord) => void
  onTransition: (record: PurchaseRequestRecord, status: PurchaseRequestStatus, note?: string) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Talep Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir Purchase Request seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Yeni Talep</button>
      </section>
    )
  }

  const requestTotal = calculatePurchaseRequestTotal(record)
  const canEdit = record.status === 'DRAFT' || record.status === 'SUBMITTED'
  const canSubmit = record.status === 'DRAFT'
  const canApprove = record.status === 'SUBMITTED'
  const canReject = record.status === 'SUBMITTED'
  const canCancel = record.status === 'DRAFT' || record.status === 'SUBMITTED' || record.status === 'APPROVED'

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
          {canEdit && <button className="btn primary" type="button" onClick={() => onEdit(record)}>Düzenle</button>}
          {canSubmit && <button className="btn" type="button" onClick={() => onTransition(record, 'SUBMITTED')}>{PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS.SUBMITTED}</button>}
          {canApprove && <button className="btn" type="button" onClick={() => onTransition(record, 'APPROVED')}>{PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS.APPROVED}</button>}
          {canReject && <button className="btn danger" type="button" onClick={() => onTransition(record, 'REJECTED')}>{PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS.REJECTED}</button>}
          {canCancel && <button className="btn warning" type="button" onClick={() => onTransition(record, 'CANCELLED')}>{PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS.CANCELLED}</button>}
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Talep Bilgileri</h3>
        <div className="purchase-request-detail-grid">
          <div><span>Talebi Oluşturan</span><strong>{record.requester}</strong></div>
          <div><span>Departman</span><strong>{PURCHASE_REQUEST_DEPARTMENT_LABELS[record.department]}</strong></div>
          <div><span>Depo</span><strong>{getBranchLabel(record.warehouseId, context.branches)}</strong></div>
          <div><span>Şube</span><strong>{getBranchLabel(record.branchId, context.branches)}</strong></div>
          <div><span>Kaynak</span><strong>{PURCHASE_REQUEST_SOURCE_LABELS[record.source]}</strong></div>
          <div><span>Öncelik</span><strong>{PURCHASE_REQUEST_PRIORITY_LABELS[record.priority]}</strong></div>
          <div><span>Talep Tarihi</span><strong>{formatDate(record.requestDate)}</strong></div>
          <div><span>İstenen Tarih</span><strong>{formatDate(record.requiredDate)}</strong></div>
          <div><span>Toplam Kalem</span><strong>{record.items.length}</strong></div>
          <div><span>Tahmini Tutar</span><strong>{formatCurrency(requestTotal)}</strong></div>
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <div className="section-header compact">
          <h3>Ürün Listesi</h3>
          <span className="status-pill">{record.items.length} kalem</span>
        </div>
        <div className="purchase-request-detail-items">
          {record.items.map(item => (
            <PurchaseRequestDetailItem
              key={item.id}
              item={item}
              context={context}
              stockItemMap={stockItemMap}
              supplierMap={supplierMap}
              approvedAlternativeRecords={approvedAlternativeRecords}
            />
          ))}
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Talep Geçmişi</h3>
        <div className="purchase-request-timeline">
          {record.history.map(event => (
            <div key={event.id}>
              <strong>{event.description}</strong>
              <span>{event.actorName} · {formatDateTime(event.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>Notlar</h3>
        <p className="muted purchase-request-notes">{record.notes || 'Not bulunmuyor.'}</p>
      </section>

      <section className="card purchase-request-detail-card">
        <h3>İşlem Logu</h3>
        <div className="purchase-request-log-list">
          {record.actionLogs.map(log => (
            <div key={log.id}>
              <strong>{log.type}</strong>
              <span>{log.message}</span>
              <small>{log.actorName} · {formatDateTime(log.createdAt)}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function PurchaseRequestDetailItem({
  item,
  context,
  stockItemMap,
  supplierMap,
  approvedAlternativeRecords
}: {
  item: PurchaseRequestItem
  context: PurchaseRequestReadModelContext
  stockItemMap: Map<string, StockItem>
  supplierMap: Map<string, Supplier>
  approvedAlternativeRecords: ReturnType<typeof ApprovedAlternativeMaterialService.load>
}){
  const stockItem = stockItemMap.get(item.stockItemId)
  const approvedAlternatives = ApprovedAlternativeMaterialService.getForMaterial(
    item.stockItemId,
    approvedAlternativeRecords,
    {
      stockItems: context.stockItems,
      suppliers: context.suppliers,
      supplierProducts: context.supplierProducts
    },
    true
  )
  return (
    <div className="purchase-request-detail-item">
      <div>
        <strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong>
        <span>{getCategoryLabel(item.categoryId, context)} · {formatQuantity(item.requestedQuantity || item.quantity, item.unit)}</span>
        <span>Stok {formatQuantity(item.currentStock, item.unit)} · Minimum {formatQuantity(item.minimumStock, item.unit)}</span>
        {item.suggestedSupplierId && <span>{getSupplierLabel(item.suggestedSupplierId, supplierMap)}</span>}
        {approvedAlternatives.length > 0 && (
          <span>Onaylı muadil: {approvedAlternatives.slice(0, 3).map(record => record.alternativeMaterialName).join(', ')}</span>
        )}
      </div>
      <strong>{formatCurrency(item.estimatedTotalPrice)}</strong>
      {item.notes && <p>{item.notes}</p>}
    </div>
  )
}

function PurchaseRequestForm({
  form,
  context,
  supplierMap,
  approvedAlternativeRecords,
  editing,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSave,
  onCancel
}: {
  form: PurchaseRequestFormState
  context: PurchaseRequestReadModelContext
  supplierMap: Map<string, Supplier>
  approvedAlternativeRecords: ReturnType<typeof ApprovedAlternativeMaterialService.load>
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
            <label>Talep Tarihi</label>
            <input type="date" value={form.requestDate} onChange={event => onChange('requestDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>İstenen Tarih</label>
            <input type="date" value={form.requiredDate} onChange={event => onChange('requiredDate', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Kaynak</label>
            <select value={form.source} onChange={event => onChange('source', event.target.value as PurchaseRequestSource)}>
              {PURCHASE_REQUEST_SOURCES.map(source => (
                <option key={source} value={source}>{PURCHASE_REQUEST_SOURCE_LABELS[source]}</option>
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
          <div className="form-field">
            <label>Departman</label>
            <select value={form.department} onChange={event => onChange('department', event.target.value as PurchaseRequestDepartment)}>
              {PURCHASE_REQUEST_DEPARTMENTS.map(department => (
                <option key={department} value={department}>{PURCHASE_REQUEST_DEPARTMENT_LABELS[department]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Depo</label>
            <select value={form.warehouseId} onChange={event => onChange('warehouseId', event.target.value)}>
              {context.branches.filter(branch => branch.isActive).map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Şube</label>
            <select value={form.branchId} onChange={event => onChange('branchId', event.target.value)}>
              {context.branches.filter(branch => branch.isActive).map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
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
          <div className="form-field purchase-request-form-wide">
            <label>Talebi Oluşturan</label>
            <input value={form.requester} onChange={event => onChange('requester', event.target.value)} required />
          </div>
        </div>
      </div>

      <div className="purchase-request-form-section">
        <div className="section-header compact">
          <h4>Satırlar</h4>
          <button className="btn" type="button" onClick={onAddItem} disabled={context.stockItems.length === 0}>Kalem Ekle</button>
        </div>
        <div className="purchase-request-item-list">
          {form.items.map((item, index) => {
            const stockItem = context.stockItems.find(record => record.id === item.stockItemId)
            const supplierProductOptions = getSupplierProductOptions(item.stockItemId, context, supplierMap)
            const approvedAlternatives = ApprovedAlternativeMaterialService.getForMaterial(
              item.stockItemId,
              approvedAlternativeRecords,
              {
                stockItems: context.stockItems,
                suppliers: context.suppliers,
                supplierProducts: context.supplierProducts
              },
              true
            )
            const shouldShowAlternatives = Boolean(stockItem && (stockItem.currentQty <= 0 || supplierProductOptions.length === 0))

            return (
              <div className="purchase-request-item-row" key={item.id}>
                <div className="form-field purchase-request-item-stock">
                  <label>Ürün</label>
                  <select value={item.stockItemId} onChange={event => onItemChange(index, 'stockItemId', event.target.value)} required>
                    <option value="">Ürün seçin</option>
                    {context.stockItems.filter(stock => stock.active).map(stock => (
                      <option key={stock.id} value={stock.id}>{stock.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>İstenen Miktar</label>
                  <input min="0.000001" step="0.001" type="number" value={item.requestedQuantity} onChange={event => onItemChange(index, 'requestedQuantity', event.target.value)} />
                </div>
                <div className="form-field">
                  <label>Birim</label>
                  <input value={stockItem?.unit || ''} readOnly />
                </div>
                <div className="form-field">
                  <label>Mevcut Stok</label>
                  <input value={stockItem ? formatQuantity(stockItem.currentQty, stockItem.unit) : '-'} readOnly />
                </div>
                <div className="form-field">
                  <label>Minimum Stok</label>
                  <input value={stockItem ? formatQuantity(stockItem.minQty, stockItem.unit) : '-'} readOnly />
                </div>
                <div className="form-field">
                  <label>Tahmini Birim Fiyat</label>
                  <input min="0" step="0.01" type="number" value={item.estimatedUnitPrice} onChange={event => onItemChange(index, 'estimatedUnitPrice', event.target.value)} />
                </div>
                <div className="form-field">
                  <label>Tahmini Toplam</label>
                  <input value={formatCurrency(calculateFormItemTotal(item.requestedQuantity, item.estimatedUnitPrice))} readOnly />
                </div>
                <div className="form-field purchase-request-item-supplier">
                  <label>Supplier Önerisi</label>
                  <select value={item.suggestedSupplierId} onChange={event => onItemChange(index, 'suggestedSupplierId', event.target.value)}>
                    <option value="">Supplier yok</option>
                    {supplierProductOptions.map((product: SupplierProduct) => (
                      <option key={product.id} value={product.supplierId}>
                        {getSupplierLabel(product.supplierId, supplierMap)} · {product.supplierProductName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field purchase-request-item-note">
                  <label>Not</label>
                  <input value={item.notes} onChange={event => onItemChange(index, 'notes', event.target.value)} />
                </div>
                <button className="btn purchase-request-item-remove" type="button" onClick={() => onRemoveItem(index)}>Sil</button>
                {shouldShowAlternatives && (
                  <div className="purchase-request-approved-alternatives">
                    <div>
                      <strong>Onaylı Muadil Ürünler</strong>
                      <span>Otomatik seçim yapılmaz; satın alma ve kalite manuel değerlendirir.</span>
                    </div>
                    {approvedAlternatives.length === 0 ? (
                      <span className="status-pill danger-pill">Muadil bulunamadı</span>
                    ) : approvedAlternatives.slice(0, 4).map(record => (
                      <span className="status-pill success" key={record.id}>
                        {record.alternativeMaterialName} · {record.preferredSupplierName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
        <button className="btn" type="button" onClick={() => onSave('submit')}>Onaya Gönder</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}
