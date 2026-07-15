import React from 'react'
import {
  INTERMEDIATE_PRODUCT_CATEGORIES,
  INTERMEDIATE_PRODUCT_STATUSES,
  INTERMEDIATE_PRODUCT_UNITS,
  loadIntermediateProducts,
  resolveIntermediateProductStatus,
  saveIntermediateProducts
} from '../intermediate-products/intermediate-product.mock'
import type {
  IntermediateProduct,
  IntermediateProductCategory,
  IntermediateProductStatus,
  IntermediateProductUnit
} from '../intermediate-products/intermediate-product.types'

type CategoryFilter = IntermediateProductCategory | 'all'
type StatusFilter = IntermediateProductStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type IntermediateProductFormState = {
  code: string
  name: string
  category: IntermediateProductCategory
  unit: IntermediateProductUnit
  minimumStock: string
  description: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

type StockTotals = Record<IntermediateProductUnit, number>

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatStock = (
  value: number,
  unit: IntermediateProductUnit
) => `${formatNumber(value)} ${unit}`

const createEmptyTotals = (): StockTotals => ({
  kg: 0,
  lt: 0,
  adet: 0,
  koli: 0
})

const formatStockTotals = (products: IntermediateProduct[]) => {
  const totals = products.reduce<StockTotals>((currentTotals, product) => ({
    ...currentTotals,
    [product.unit]: currentTotals[product.unit] + product.currentStock
  }), createEmptyTotals())

  return INTERMEDIATE_PRODUCT_UNITS
    .filter(unit => totals[unit] > 0)
    .map(unit => `${formatNumber(totals[unit])} ${unit}`)
    .join(' / ') || '0'
}

const getStatusClass = (status: IntermediateProductStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Kritik') return 'warning-pill'
  return 'muted-pill'
}

const getNextProductCode = (products: IntermediateProduct[]) => {
  const maxNo = products.reduce((max, product) => {
    const match = product.code.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `AU-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (products: IntermediateProduct[]): IntermediateProductFormState => ({
  code: getNextProductCode(products),
  name: '',
  category: 'Genel',
  unit: 'kg',
  minimumStock: '0',
  description: ''
})

const createFormFromProduct = (product: IntermediateProduct): IntermediateProductFormState => ({
  code: product.code,
  name: product.name,
  category: product.category,
  unit: product.unit,
  minimumStock: String(product.minimumStock),
  description: product.description
})

const validateForm = (
  form: IntermediateProductFormState,
  products: IntermediateProduct[],
  editingProductId: string
) => {
  if(!form.code.trim()) return 'Kod zorunludur.'
  if(!form.name.trim()) return 'Ad zorunludur.'
  if(!form.minimumStock.trim()) return 'Minimum stok boş bırakılamaz.'

  const minimumStock = Number(form.minimumStock)
  if(!Number.isFinite(minimumStock)) return 'Minimum stok için geçerli bir sayı girilmelidir.'
  if(minimumStock < 0) return 'Minimum stok negatif olamaz.'

  const normalizedCode = form.code.trim().toLocaleLowerCase('tr-TR')
  const duplicateCode = products.some(product => (
    product.id !== editingProductId
    && product.code.trim().toLocaleLowerCase('tr-TR') === normalizedCode
  ))
  if(duplicateCode) return 'Bu kod zaten kullanılıyor.'

  return ''
}

export default function IntermediateProducts(){
  const [products, setProducts] = React.useState<IntermediateProduct[]>(() => loadIntermediateProducts())
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedProductId, setSelectedProductId] = React.useState('iproduct_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingProductId, setEditingProductId] = React.useState('')
  const [form, setForm] = React.useState<IntermediateProductFormState>(() => createInitialForm(loadIntermediateProducts()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitProducts = React.useCallback((updater: React.SetStateAction<IntermediateProduct[]>) => {
    setProducts(prev => {
      const nextProducts = typeof updater === 'function'
        ? (updater as (current: IntermediateProduct[]) => IntermediateProduct[])(prev)
        : updater
      saveIntermediateProducts(nextProducts)
      return nextProducts
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('iproduct_toast'),
      text,
      tone
    })
  }, [])

  const visibleProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return products.filter(product => {
      const status = resolveIntermediateProductStatus(product)
      const matchesSearch = !normalizedSearch
        || product.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || product.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || product.description.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, products, search, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form') return
    if(visibleProducts.some(product => product.id === selectedProductId)) return
    setSelectedProductId(visibleProducts[0]?.id || '')
  }, [panelMode, selectedProductId, visibleProducts])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedProduct = products.find(product => product.id === selectedProductId) || null
  const isEditing = Boolean(editingProductId)
  const totalProducts = products.length
  const activeProducts = products.filter(product => resolveIntermediateProductStatus(product) === 'Aktif').length
  const criticalProducts = products.filter(product => resolveIntermediateProductStatus(product) === 'Kritik').length

  const startNewProduct = () => {
    setPanelMode('form')
    setEditingProductId('')
    setForm(createInitialForm(products))
    setFormError('')
    setToast(null)
  }

  const startEditProduct = (product: IntermediateProduct) => {
    setSelectedProductId(product.id)
    setPanelMode('form')
    setEditingProductId(product.id)
    setForm(createFormFromProduct(product))
    setFormError('')
    setToast(null)
  }

  const cancelForm = () => {
    setPanelMode('summary')
    setEditingProductId('')
    setForm(createInitialForm(products))
    setFormError('')
  }

  const updateForm = <TKey extends keyof IntermediateProductFormState>(
    key: TKey,
    value: IntermediateProductFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteProduct = (product: IntermediateProduct) => {
    if(!window.confirm('Bu ara ürünü silmek istediğinize emin misiniz?')) return

    const nextProducts = products.filter(item => item.id !== product.id)
    commitProducts(nextProducts)
    setSelectedProductId(nextProducts[0]?.id || '')
    setPanelMode('summary')

    if(editingProductId === product.id){
      setEditingProductId('')
      setForm(createInitialForm(nextProducts))
      setFormError('')
    }

    showToast('Ara ürün silindi.')
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form, products, editingProductId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const minimumStock = Number(form.minimumStock)
    const normalizedCode = form.code.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingProduct = products.find(product => product.id === editingProductId)
      if(!existingProduct){
        setFormError('Düzenlenecek ara ürün bulunamadı.')
        return
      }

      const draftProduct: IntermediateProduct = {
        ...existingProduct,
        code: normalizedCode,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        minimumStock,
        description: form.description.trim(),
        updatedAt: now
      }
      const updatedProduct: IntermediateProduct = {
        ...draftProduct,
        status: resolveIntermediateProductStatus(draftProduct)
      }

      commitProducts(prev => prev.map(product => product.id === updatedProduct.id ? updatedProduct : product))
      setSelectedProductId(updatedProduct.id)
      setPanelMode('summary')
      setEditingProductId('')
      setForm(createInitialForm(products))
      setFormError('')
      showToast('Ara ürün güncellendi.')
      return
    }

    const draftProduct: IntermediateProduct = {
      id: createId('iproduct'),
      code: normalizedCode,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      currentStock: 0,
      minimumStock,
      status: 'Aktif',
      description: form.description.trim(),
      linkedRecipe: '',
      linkedFinalProducts: [],
      createdAt: now,
      updatedAt: now
    }
    const newProduct: IntermediateProduct = {
      ...draftProduct,
      status: resolveIntermediateProductStatus(draftProduct)
    }

    commitProducts(prev => [newProduct, ...prev])
    setSelectedProductId(newProduct.id)
    setPanelMode('summary')
    setForm(createInitialForm([newProduct, ...products]))
    setFormError('')
    showToast('Ara ürün oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Ara Ürün Düzenle' : 'Yeni Ara Ürün'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form intermediate-product-form" onSubmit={submitForm}>
        <div className="form-row">
          <div className="form-field">
            <label>Kod</label>
            <input value={form.code} onChange={event => updateForm('code', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Ad</label>
            <input value={form.name} onChange={event => updateForm('name', event.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Kategori</label>
            <select value={form.category} onChange={event => updateForm('category', event.target.value as IntermediateProductCategory)}>
              {INTERMEDIATE_PRODUCT_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Birim</label>
            <select value={form.unit} onChange={event => updateForm('unit', event.target.value as IntermediateProductUnit)}>
              {INTERMEDIATE_PRODUCT_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Minimum Stok</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={form.minimumStock}
            onChange={event => updateForm('minimumStock', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Ara ürün kullanım notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Ara Ürün Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedProduct){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir ara ürün seçin.</div>
        </section>
      )
    }

    const status = resolveIntermediateProductStatus(selectedProduct)

    return (
      <section className="card intermediate-product-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedProduct.code}</h3>
            <p className="muted">{selectedProduct.name}</p>
          </div>
          <span className={`status-pill ${getStatusClass(status)}`}>{status}</span>
        </div>

        <div className="intermediate-product-summary-grid">
          <div><span>Kod</span><strong>{selectedProduct.code}</strong></div>
          <div><span>Ad</span><strong>{selectedProduct.name}</strong></div>
          <div><span>Kategori</span><strong>{selectedProduct.category}</strong></div>
          <div><span>Birim</span><strong>{selectedProduct.unit}</strong></div>
          <div><span>Mevcut Stok</span><strong>{formatStock(selectedProduct.currentStock, selectedProduct.unit)}</strong></div>
          <div><span>Minimum Stok</span><strong>{formatStock(selectedProduct.minimumStock, selectedProduct.unit)}</strong></div>
          <div><span>Durum</span><strong>{status}</strong></div>
          <div><span>Açıklama</span><strong>{selectedProduct.description || '-'}</strong></div>
        </div>

        <div className="intermediate-product-linked-list">
          <span className="small-label">Bağlı Reçete</span>
          <div>
            <strong>{selectedProduct.linkedRecipe || 'Henüz bağlı değil.'}</strong>
            <small>Reçete bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı Son Ürünler</span>
          <div>
            <strong>{selectedProduct.linkedFinalProducts.length > 0 ? selectedProduct.linkedFinalProducts.join(', ') : 'Henüz bağlı değil.'}</strong>
            <small>Son ürün bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="intermediate-product-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditProduct(selectedProduct)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteProduct(selectedProduct)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="intermediate-products-page">
      <div className="page-title">
        <div>
          <h2>Ara Ürünler</h2>
          <p className="muted">Endüstriyel mutfak yarı mamullerini kod, kategori, stok ve durum bazında takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`intermediate-product-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Ara Ürün</span>
          <strong>{totalProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Ara Ürün</span>
          <strong>{activeProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Kritik Stok</span>
          <strong>{criticalProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Miktar</span>
          <strong>{formatStockTotals(products)}</strong>
        </div>
      </div>

      <div className="product-layout intermediate-product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Ara Ürün Listesi</h3>
              <p className="muted">{visibleProducts.length} ara ürün gösteriliyor.</p>
            </div>
            <div className="intermediate-product-toolbar">
              <button className="btn primary" type="button" onClick={startNewProduct}>Yeni Ara Ürün</button>
              <input
                type="search"
                placeholder="Kod, ad veya açıklama ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as CategoryFilter)}>
                <option value="all">Tüm kategoriler</option>
                {INTERMEDIATE_PRODUCT_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {INTERMEDIATE_PRODUCT_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table intermediate-product-table">
              <colgroup>
                <col className="iproduct-col-code" />
                <col className="iproduct-col-name" />
                <col className="iproduct-col-category" />
                <col className="iproduct-col-unit" />
                <col className="iproduct-col-stock" />
                <col className="iproduct-col-minimum" />
                <col className="iproduct-col-status" />
                <col className="iproduct-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ara Ürün Adı</th>
                  <th>Kategori</th>
                  <th>Birim</th>
                  <th>Mevcut Stok</th>
                  <th>Minimum Stok</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="intermediate-product-empty-list">
                        <strong>Henüz ara ürün bulunmuyor.</strong>
                        <span>İlk ara ürünü oluşturmak için "Yeni Ara Ürün" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewProduct}>Yeni Ara Ürün</button>
                      </div>
                    </td>
                  </tr>
                )}
                {products.length > 0 && visibleProducts.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun ara ürün bulunamadı.</td></tr>
                )}
                {visibleProducts.map(product => {
                  const status = resolveIntermediateProductStatus(product)

                  return (
                    <tr
                      key={product.id}
                      className={product.id === selectedProductId ? 'selected-row' : ''}
                      onClick={() => {
                        setSelectedProductId(product.id)
                        setPanelMode('summary')
                      }}
                    >
                      <td><strong>{product.code}</strong></td>
                      <td>
                        <strong>{product.name}</strong>
                        {product.description && <div className="muted small-text">{product.description}</div>}
                      </td>
                      <td>{product.category}</td>
                      <td>{product.unit}</td>
                      <td>{formatStock(product.currentStock, product.unit)}</td>
                      <td>{formatStock(product.minimumStock, product.unit)}</td>
                      <td><span className={`status-pill ${getStatusClass(status)}`}>{status}</span></td>
                      <td className="actions-cell">
                        <button
                          className="btn"
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            startEditProduct(product)
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          className="btn danger"
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            deleteProduct(product)
                          }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side intermediate-product-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
