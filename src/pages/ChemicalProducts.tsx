import React from 'react'
import {
  CHEMICAL_PRODUCT_CATEGORIES,
  CHEMICAL_PRODUCT_CATEGORY_LABELS,
  CHEMICAL_PRODUCT_HAZARD_CLASSES,
  CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS,
  CHEMICAL_PRODUCT_PHYSICAL_STATES,
  CHEMICAL_PRODUCT_PHYSICAL_STATE_LABELS,
  CHEMICAL_PRODUCT_STATUSES,
  CHEMICAL_PRODUCT_STATUS_LABELS,
  CHEMICAL_PRODUCT_STORAGE_CONDITIONS,
  CHEMICAL_PRODUCT_STORAGE_CONDITION_LABELS,
  getNextChemicalCode,
  loadChemicalProductRecords,
  saveChemicalProductRecords
} from '../chemical-products/chemical-product.mock'
import type {
  ChemicalProduct,
  ChemicalProductCategory,
  ChemicalProductHazardClass,
  ChemicalProductPhysicalState,
  ChemicalProductStatus,
  ChemicalProductStorageCondition
} from '../chemical-products/chemical-product.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import type { Supplier } from '../supplier-management/supplier-management.types'
import { loadStockItems } from '../storage'
import type { StockItem } from '../types'

type FilterValue = 'all'
type CategoryFilter = ChemicalProductCategory | FilterValue
type HazardFilter = ChemicalProductHazardClass | FilterValue
type StatusFilter = ChemicalProductStatus | FilterValue
type PanelMode = 'detail' | 'form'

type ChemicalProductInitialData = {
  suppliers: Supplier[]
  stockItems: StockItem[]
  chemicalProducts: ChemicalProduct[]
}

type ChemicalProductFormState = {
  chemicalCode: string
  name: string
  brand: string
  supplierId: string
  stockItemId: string
  category: ChemicalProductCategory | ''
  hazardClass: ChemicalProductHazardClass | ''
  physicalState: ChemicalProductPhysicalState
  storageCondition: ChemicalProductStorageCondition
  usageArea: string
  requiredPPE: string
  msdsDocumentNumber: string
  usageInstruction: string
  status: ChemicalProductStatus
  notes: string
}

const createId = () => `chemical_product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusClass = (status: ChemicalProductStatus) => {
  if(status === 'ACTIVE') return 'success'
  if(status === 'DISCONTINUED') return 'danger-pill'
  return 'muted-pill'
}

const getHazardClass = (hazardClass: ChemicalProductHazardClass) => {
  if(hazardClass === 'NONE') return 'success'
  if(hazardClass === 'CORROSIVE' || hazardClass === 'TOXIC' || hazardClass === 'FLAMMABLE') return 'danger-pill'
  if(hazardClass === 'IRRITANT' || hazardClass === 'OXIDIZER') return 'warning-pill'
  return 'muted-pill'
}

const loadInitialData = (): ChemicalProductInitialData => {
  const suppliers = loadSupplierManagementRecords()
  const stockItems = loadStockItems()
  const chemicalProducts = loadChemicalProductRecords(suppliers, stockItems)

  return {
    suppliers,
    stockItems,
    chemicalProducts
  }
}

const getSupplierLabel = (supplierId: string, supplierMap: Map<string, Supplier>) => {
  if(!supplierId) return '-'
  const supplier = supplierMap.get(supplierId)
  return supplier ? supplier.name : 'Supplier bulunamadı'
}

const getStockItemLabel = (stockItemId: string, stockItemMap: Map<string, StockItem>) => {
  if(!stockItemId) return '-'
  const stockItem = stockItemMap.get(stockItemId)
  return stockItem ? stockItem.name : 'Stock Item bulunamadı'
}

const createEmptyForm = (records: ChemicalProduct[]): ChemicalProductFormState => ({
  chemicalCode: getNextChemicalCode(records),
  name: '',
  brand: '',
  supplierId: '',
  stockItemId: '',
  category: 'DETERGENT',
  hazardClass: 'NONE',
  physicalState: 'LIQUID',
  storageCondition: 'ROOM_TEMPERATURE',
  usageArea: '',
  requiredPPE: '',
  msdsDocumentNumber: '',
  usageInstruction: '',
  status: 'ACTIVE',
  notes: ''
})

const createFormFromRecord = (record: ChemicalProduct): ChemicalProductFormState => ({
  chemicalCode: record.chemicalCode,
  name: record.name,
  brand: record.brand,
  supplierId: record.supplierId,
  stockItemId: record.stockItemId,
  category: record.category,
  hazardClass: record.hazardClass,
  physicalState: record.physicalState,
  storageCondition: record.storageCondition,
  usageArea: record.usageArea,
  requiredPPE: record.requiredPPE,
  msdsDocumentNumber: record.msdsDocumentNumber,
  usageInstruction: record.usageInstruction,
  status: record.status,
  notes: record.notes
})

const validateForm = (
  form: ChemicalProductFormState,
  records: ChemicalProduct[],
  editingRecordId = ''
) => {
  if(!form.chemicalCode.trim()) return 'Chemical Code zorunludur.'
  if(!form.name.trim()) return 'Name zorunludur.'
  if(!form.category) return 'Category zorunludur.'
  if(!form.hazardClass) return 'Hazard Class zorunludur.'

  const normalizedCode = toSearchText(form.chemicalCode)
  const hasDuplicateCode = records.some(record => (
    record.id !== editingRecordId && toSearchText(record.chemicalCode) === normalizedCode
  ))
  if(hasDuplicateCode) return 'Chemical Code benzersiz olmalıdır.'

  return ''
}

const createPayload = (
  form: ChemicalProductFormState,
  existingRecord: ChemicalProduct | null
): ChemicalProduct => {
  const now = new Date().toISOString()

  return {
    id: existingRecord?.id || createId(),
    chemicalCode: form.chemicalCode.trim(),
    name: form.name.trim(),
    brand: form.brand.trim(),
    supplierId: form.supplierId,
    stockItemId: form.stockItemId,
    category: form.category || 'DETERGENT',
    hazardClass: form.hazardClass || 'NONE',
    physicalState: form.physicalState,
    storageCondition: form.storageCondition,
    usageArea: form.usageArea.trim(),
    requiredPPE: form.requiredPPE.trim(),
    msdsDocumentNumber: form.msdsDocumentNumber.trim(),
    usageInstruction: form.usageInstruction.trim(),
    status: form.status,
    notes: form.notes.trim(),
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now
  }
}

export default function ChemicalProducts(){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<ChemicalProduct[]>(initialData.chemicalProducts)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('detail')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<ChemicalProductFormState>(() => createEmptyForm(initialData.chemicalProducts))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')
  const [hazardFilter, setHazardFilter] = React.useState<HazardFilter>('all')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const { suppliers, stockItems } = initialData
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: ChemicalProduct[]) => {
    setRecords(nextRecords)
    saveChemicalProductRecords(nextRecords)
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const searchFields = [
        record.chemicalCode,
        record.name,
        record.brand
      ]
      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesCategory = categoryFilter === 'all' || record.category === categoryFilter
      const matchesHazard = hazardFilter === 'all' || record.hazardClass === hazardFilter
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesCategory && matchesHazard && matchesSupplier && matchesStatus
    })
  }, [categoryFilter, hazardFilter, records, search, statusFilter, supplierFilter])

  const activeCount = records.filter(record => record.status === 'ACTIVE').length
  const hazardousCount = records.filter(record => record.hazardClass !== 'NONE').length
  const linkedStockCount = records.filter(record => record.stockItemId).length
  const msdsCount = records.filter(record => record.msdsDocumentNumber).length

  const startCreate = () => {
    setForm(createEmptyForm(records))
    setEditingRecordId('')
    setFormError('')
    setPanelMode('form')
  }

  const startEdit = (record: ChemicalProduct) => {
    setForm(createFormFromRecord(record))
    setEditingRecordId(record.id)
    setSelectedRecordId(record.id)
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setForm(createEmptyForm(records))
    setEditingRecordId('')
    setFormError('')
    setPanelMode('detail')
  }

  const submitForm = () => {
    const validationError = validateForm(form, records, editingRecordId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const existingRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId) || null
      : null
    const payload = createPayload(form, existingRecord)
    const nextRecords = existingRecord
      ? records.map(record => record.id === payload.id ? payload : record)
      : [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setForm(createEmptyForm(nextRecords))
    setEditingRecordId('')
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="chemical-product-page">
      <div className="page-header">
        <div>
          <h2>Kimyasal Ürünler</h2>
          <p className="muted">Temizlik, dezenfeksiyon, hijyen ve bakım kimyasallarını güvenli kullanım bilgileriyle yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startCreate}>Kimyasal Ürün Oluştur</button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Aktif</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tehlikeli</span>
          <strong>{hazardousCount}</strong>
        </div>
        <div className="metric-card">
          <span>Stock Item Bağlı</span>
          <strong>{linkedStockCount}</strong>
        </div>
        <div className="metric-card">
          <span>MSDS</span>
          <strong>{msdsCount}</strong>
        </div>
      </div>

      <div className="product-layout chemical-product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Kimyasal Ürün Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="chemical-product-toolbar">
            <input
              type="search"
              placeholder="Chemical Code, Name veya Brand ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as CategoryFilter)}>
              <option value="all">Tüm Category</option>
              {CHEMICAL_PRODUCT_CATEGORIES.map(category => (
                <option key={category} value={category}>{CHEMICAL_PRODUCT_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
            <select value={hazardFilter} onChange={event => setHazardFilter(event.target.value as HazardFilter)}>
              <option value="all">Tüm Hazard</option>
              {CHEMICAL_PRODUCT_HAZARD_CLASSES.map(hazardClass => (
                <option key={hazardClass} value={hazardClass}>{CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS[hazardClass]}</option>
              ))}
            </select>
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Supplier</option>
              <option value="">Supplier Yok</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm Status</option>
              {CHEMICAL_PRODUCT_STATUSES.map(status => (
                <option key={status} value={status}>{CHEMICAL_PRODUCT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap chemical-product-table-wrap">
            <table className="data-table chemical-product-table">
              <thead>
                <tr>
                  <th>Chemical Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Hazard Class</th>
                  <th>Supplier</th>
                  <th>Storage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun kimyasal ürün bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setPanelMode('detail')
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(record.id)
                      setPanelMode('detail')
                    }}
                  >
                    <td data-label="Chemical Code"><strong>{record.chemicalCode}</strong></td>
                    <td data-label="Name">
                      <strong>{record.name}</strong>
                      <span>{record.brand || '-'}</span>
                    </td>
                    <td data-label="Category">{CHEMICAL_PRODUCT_CATEGORY_LABELS[record.category]}</td>
                    <td data-label="Hazard Class">
                      <span className={`status-pill ${getHazardClass(record.hazardClass)}`}>
                        {CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS[record.hazardClass]}
                      </span>
                    </td>
                    <td data-label="Supplier">{getSupplierLabel(record.supplierId, supplierMap)}</td>
                    <td data-label="Storage">{CHEMICAL_PRODUCT_STORAGE_CONDITION_LABELS[record.storageCondition]}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${getStatusClass(record.status)}`}>
                        {CHEMICAL_PRODUCT_STATUS_LABELS[record.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side chemical-product-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <div>
                  <h3>{editingRecordId ? 'Kimyasal Ürün Düzenle' : 'Kimyasal Ürün Oluştur'}</h3>
                  <p className="muted">{form.chemicalCode}</p>
                </div>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <ChemicalProductForm
                form={form}
                suppliers={suppliers}
                stockItems={stockItems}
                onChange={setForm}
                onSubmit={submitForm}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <ChemicalProductDetailPanel
              record={selectedRecord}
              supplierMap={supplierMap}
              stockItemMap={stockItemMap}
              onCreate={startCreate}
              onEdit={startEdit}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function ChemicalProductForm({
  form,
  suppliers,
  stockItems,
  onChange,
  onSubmit,
  onCancel
}: {
  form: ChemicalProductFormState
  suppliers: Supplier[]
  stockItems: StockItem[]
  onChange: (form: ChemicalProductFormState) => void
  onSubmit: () => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form chemical-product-form" onSubmit={event => event.preventDefault()}>
      <div className="chemical-product-form-section">
        <h4>Kimlik Bilgileri</h4>
        <div className="chemical-product-form-grid">
          <div className="form-field">
            <label>Chemical Code</label>
            <input value={form.chemicalCode} onChange={event => onChange({ ...form, chemicalCode: event.target.value })} required />
          </div>
          <div className="form-field">
            <label>Name</label>
            <input value={form.name} onChange={event => onChange({ ...form, name: event.target.value })} required />
          </div>
          <div className="form-field">
            <label>Brand</label>
            <input value={form.brand} onChange={event => onChange({ ...form, brand: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={form.status} onChange={event => onChange({ ...form, status: event.target.value as ChemicalProductStatus })}>
              {CHEMICAL_PRODUCT_STATUSES.map(status => (
                <option key={status} value={status}>{CHEMICAL_PRODUCT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="chemical-product-form-section">
        <h4>Sınıflandırma</h4>
        <div className="chemical-product-form-grid">
          <div className="form-field">
            <label>Category</label>
            <select value={form.category} onChange={event => onChange({ ...form, category: event.target.value as ChemicalProductCategory | '' })} required>
              <option value="">Category seçin</option>
              {CHEMICAL_PRODUCT_CATEGORIES.map(category => (
                <option key={category} value={category}>{CHEMICAL_PRODUCT_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Hazard Class</label>
            <select value={form.hazardClass} onChange={event => onChange({ ...form, hazardClass: event.target.value as ChemicalProductHazardClass | '' })} required>
              <option value="">Hazard seçin</option>
              {CHEMICAL_PRODUCT_HAZARD_CLASSES.map(hazardClass => (
                <option key={hazardClass} value={hazardClass}>{CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS[hazardClass]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Physical State</label>
            <select value={form.physicalState} onChange={event => onChange({ ...form, physicalState: event.target.value as ChemicalProductPhysicalState })}>
              {CHEMICAL_PRODUCT_PHYSICAL_STATES.map(physicalState => (
                <option key={physicalState} value={physicalState}>{CHEMICAL_PRODUCT_PHYSICAL_STATE_LABELS[physicalState]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Storage Condition</label>
            <select value={form.storageCondition} onChange={event => onChange({ ...form, storageCondition: event.target.value as ChemicalProductStorageCondition })}>
              {CHEMICAL_PRODUCT_STORAGE_CONDITIONS.map(storageCondition => (
                <option key={storageCondition} value={storageCondition}>{CHEMICAL_PRODUCT_STORAGE_CONDITION_LABELS[storageCondition]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="chemical-product-form-section">
        <h4>İlişkiler</h4>
        <div className="chemical-product-form-grid">
          <div className="form-field">
            <label>Supplier</label>
            <select value={form.supplierId} onChange={event => onChange({ ...form, supplierId: event.target.value })}>
              <option value="">Supplier seçilmedi</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Linked Stock Item</label>
            <select value={form.stockItemId} onChange={event => onChange({ ...form, stockItemId: event.target.value })}>
              <option value="">Stock Item seçilmedi</option>
              {stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="chemical-product-form-section">
        <h4>Güvenli Kullanım</h4>
        <div className="chemical-product-form-grid">
          <div className="form-field">
            <label>Usage Area</label>
            <input value={form.usageArea} onChange={event => onChange({ ...form, usageArea: event.target.value })} />
          </div>
          <div className="form-field">
            <label>Required PPE</label>
            <input value={form.requiredPPE} onChange={event => onChange({ ...form, requiredPPE: event.target.value })} />
          </div>
          <div className="form-field chemical-product-form-wide">
            <label>MSDS Number</label>
            <input value={form.msdsDocumentNumber} onChange={event => onChange({ ...form, msdsDocumentNumber: event.target.value })} />
          </div>
          <div className="form-field chemical-product-form-wide">
            <label>Usage Instruction</label>
            <textarea rows={4} value={form.usageInstruction} onChange={event => onChange({ ...form, usageInstruction: event.target.value })} />
          </div>
          <div className="form-field chemical-product-form-wide">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={event => onChange({ ...form, notes: event.target.value })} />
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="button" onClick={onSubmit}>Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function ChemicalProductDetailPanel({
  record,
  supplierMap,
  stockItemMap,
  onCreate,
  onEdit
}: {
  record: ChemicalProduct | null
  supplierMap: Map<string, Supplier>
  stockItemMap: Map<string, StockItem>
  onCreate: () => void
  onEdit: (record: ChemicalProduct) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Kimyasal Ürün Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir kimyasal ürün seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Kimyasal Ürün Oluştur</button>
      </section>
    )
  }

  return (
    <>
      <section className="card chemical-product-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.chemicalCode}</h3>
            <p className="muted">{record.name}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {CHEMICAL_PRODUCT_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="chemical-product-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn primary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
        </div>
      </section>

      <section className="card chemical-product-detail-card">
        <h3>Detay</h3>
        <div className="chemical-product-detail-grid">
          <div><span>Chemical Code</span><strong>{record.chemicalCode}</strong></div>
          <div><span>Name</span><strong>{record.name}</strong></div>
          <div><span>Brand</span><strong>{record.brand || '-'}</strong></div>
          <div><span>Supplier</span><strong>{getSupplierLabel(record.supplierId, supplierMap)}</strong></div>
          <div><span>Linked Stock Item</span><strong>{getStockItemLabel(record.stockItemId, stockItemMap)}</strong></div>
          <div><span>Category</span><strong>{CHEMICAL_PRODUCT_CATEGORY_LABELS[record.category]}</strong></div>
          <div><span>Hazard Class</span><strong>{CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS[record.hazardClass]}</strong></div>
          <div><span>Physical State</span><strong>{CHEMICAL_PRODUCT_PHYSICAL_STATE_LABELS[record.physicalState]}</strong></div>
          <div><span>Storage Condition</span><strong>{CHEMICAL_PRODUCT_STORAGE_CONDITION_LABELS[record.storageCondition]}</strong></div>
          <div><span>Usage Area</span><strong>{record.usageArea || '-'}</strong></div>
          <div><span>Required PPE</span><strong>{record.requiredPPE || '-'}</strong></div>
          <div><span>MSDS Number</span><strong>{record.msdsDocumentNumber || '-'}</strong></div>
          <div><span>Status</span><strong>{CHEMICAL_PRODUCT_STATUS_LABELS[record.status]}</strong></div>
          <div><span>Updated</span><strong>{formatDateTime(record.updatedAt)}</strong></div>
        </div>
      </section>

      <section className="card chemical-product-detail-card">
        <h3>Usage Instruction</h3>
        <p className="chemical-product-notes">{record.usageInstruction || '-'}</p>
      </section>

      <section className="card chemical-product-detail-card">
        <h3>Notes</h3>
        <p className="chemical-product-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}
