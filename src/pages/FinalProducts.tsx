import React from 'react'
import {
  FINAL_PRODUCT_CATEGORIES,
  FINAL_PRODUCT_STATUSES,
  FINAL_PRODUCT_UNITS,
  loadFinalProducts,
  resolveFinalProductStatus,
  saveFinalProducts
} from '../final-products/final-product.mock'
import type {
  FinalProduct,
  FinalProductCategory,
  FinalProductStatus,
  FinalProductUnit
} from '../final-products/final-product.types'

type CategoryFilter = FinalProductCategory | 'all'
type StatusFilter = FinalProductStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type FinalProductFormState = {
  code: string
  name: string
  category: FinalProductCategory
  unit: FinalProductUnit
  minimumStock: string
  description: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

type StockTotals = Record<FinalProductUnit, number>

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatStock = (
  value: number,
  unit: FinalProductUnit
) => `${formatNumber(value)} ${unit}`

const createEmptyTotals = (): StockTotals => ({
  kg: 0,
  lt: 0,
  adet: 0,
  koli: 0,
  tepsi: 0
})

const formatStockTotals = (products: FinalProduct[]) => {
  const totals = products.reduce<StockTotals>((currentTotals, product) => ({
    ...currentTotals,
    [product.unit]: currentTotals[product.unit] + product.currentStock
  }), createEmptyTotals())

  return FINAL_PRODUCT_UNITS
    .filter(unit => totals[unit] > 0)
    .map(unit => `${formatNumber(totals[unit])} ${unit}`)
    .join(' / ') || '0'
}

const getStatusClass = (status: FinalProductStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Kritik') return 'warning-pill'
  return 'muted-pill'
}

const getNextProductCode = (products: FinalProduct[]) => {
  const maxNo = products.reduce((max, product) => {
    const match = product.code.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `SP-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (products: FinalProduct[]): FinalProductFormState => ({
  code: getNextProductCode(products),
  name: '',
  category: 'Genel',
  unit: 'kg',
  minimumStock: '0',
  description: ''
})

const createFormFromProduct = (product: FinalProduct): FinalProductFormState => ({
  code: product.code,
  name: product.name,
  category: product.category,
  unit: product.unit,
  minimumStock: String(product.minimumStock),
  description: product.description
})

const validateForm = (
  form: FinalProductFormState,
  products: FinalProduct[],
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

export default function FinalProducts(){
  const [products, setProducts] = React.useState<FinalProduct[]>(() => loadFinalProducts())
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedProductId, setSelectedProductId] = React.useState('fproduct_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingProductId, setEditingProductId] = React.useState('')
  const [form, setForm] = React.useState<FinalProductFormState>(() => createInitialForm(loadFinalProducts()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitProducts = React.useCallback((updater: React.SetStateAction<FinalProduct[]>) => {
    setProducts(prev => {
      const nextProducts = typeof updater === 'function'
        ? (updater as (current: FinalProduct[]) => FinalProduct[])(prev)
        : updater
      saveFinalProducts(nextProducts)
      return nextProducts
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('fproduct_toast'),
      text,
      tone
    })
  }, [])

  const visibleProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return products.filter(product => {
      const status = resolveFinalProductStatus(product)
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
  const activeProducts = products.filter(product => resolveFinalProductStatus(product) === 'Aktif').length
  const criticalProducts = products.filter(product => resolveFinalProductStatus(product) === 'Kritik').length

  const startNewProduct = () => {
    setPanelMode('form')
    setEditingProductId('')
    setForm(createInitialForm(products))
    setFormError('')
    setToast(null)
  }

  const startEditProduct = (product: FinalProduct) => {
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

  const updateForm = <TKey extends keyof FinalProductFormState>(
    key: TKey,
    value: FinalProductFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteProduct = (product: FinalProduct) => {
    if(!window.confirm('Bu son ürünü silmek istediğinize emin misiniz?')) return

    const nextProducts = products.filter(item => item.id !== product.id)
    commitProducts(nextProducts)
    setSelectedProductId(nextProducts[0]?.id || '')
    setPanelMode('summary')

    if(editingProductId === product.id){
      setEditingProductId('')
      setForm(createInitialForm(nextProducts))
      setFormError('')
    }

    showToast('Son ürün silindi.')
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
        setFormError('Düzenlenecek son ürün bulunamadı.')
        return
      }

      const draftProduct: FinalProduct = {
        ...existingProduct,
        code: normalizedCode,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        minimumStock,
        description: form.description.trim(),
        updatedAt: now
      }
      const updatedProduct: FinalProduct = {
        ...draftProduct,
        status: resolveFinalProductStatus(draftProduct)
      }

      commitProducts(prev => prev.map(product => product.id === updatedProduct.id ? updatedProduct : product))
      setSelectedProductId(updatedProduct.id)
      setPanelMode('summary')
      setEditingProductId('')
      setForm(createInitialForm(products))
      setFormError('')
      showToast('Son ürün güncellendi.')
      return
    }

    const draftProduct: FinalProduct = {
      id: createId('fproduct'),
      code: normalizedCode,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      currentStock: 0,
      minimumStock,
      status: 'Aktif',
      description: form.description.trim(),
      linkedIntermediateProducts: [],
      linkedPackaging: '',
      createdAt: now,
      updatedAt: now
    }
    const newProduct: FinalProduct = {
      ...draftProduct,
      status: resolveFinalProductStatus(draftProduct)
    }

    commitProducts(prev => [newProduct, ...prev])
    setSelectedProductId(newProduct.id)
    setPanelMode('summary')
    setForm(createInitialForm([newProduct, ...products]))
    setFormError('')
    showToast('Son ürün oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Son Ürün Düzenle' : 'Yeni Son Ürün'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form final-product-form" onSubmit={submitForm}>
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
            <select value={form.category} onChange={event => updateForm('category', event.target.value as FinalProductCategory)}>
              {FINAL_PRODUCT_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Birim</label>
            <select value={form.unit} onChange={event => updateForm('unit', event.target.value as FinalProductUnit)}>
              {FINAL_PRODUCT_UNITS.map(unit => (
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
            placeholder="Son ürün kullanım veya sevkiyat notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Son Ürün Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedProduct){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir son ürün seçin.</div>
        </section>
      )
    }

    const status = resolveFinalProductStatus(selectedProduct)

    return (
      <section className="card final-product-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedProduct.code}</h3>
            <p className="muted">{selectedProduct.name}</p>
          </div>
          <span className={`status-pill ${getStatusClass(status)}`}>{status}</span>
        </div>

        <div className="final-product-summary-grid">
          <div><span>Kod</span><strong>{selectedProduct.code}</strong></div>
          <div><span>Ad</span><strong>{selectedProduct.name}</strong></div>
          <div><span>Kategori</span><strong>{selectedProduct.category}</strong></div>
          <div><span>Birim</span><strong>{selectedProduct.unit}</strong></div>
          <div><span>Mevcut Stok</span><strong>{formatStock(selectedProduct.currentStock, selectedProduct.unit)}</strong></div>
          <div><span>Minimum Stok</span><strong>{formatStock(selectedProduct.minimumStock, selectedProduct.unit)}</strong></div>
          <div><span>Durum</span><strong>{status}</strong></div>
          <div><span>Açıklama</span><strong>{selectedProduct.description || '-'}</strong></div>
        </div>

        <div className="final-product-linked-list">
          <span className="small-label">Bağlı Ara Ürünler</span>
          <div>
            <strong>{selectedProduct.linkedIntermediateProducts.length > 0 ? selectedProduct.linkedIntermediateProducts.join(', ') : 'Henüz bağlı değil.'}</strong>
            <small>Ara ürün bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı Paketleme</span>
          <div>
            <strong>{selectedProduct.linkedPackaging || 'Henüz bağlı değil.'}</strong>
            <small>Paketleme bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="final-product-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditProduct(selectedProduct)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteProduct(selectedProduct)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="final-products-page">
      <div className="page-title">
        <div>
          <h2>Son Ürünler</h2>
          <p className="muted">Sevkiyata hazır son ürünleri kod, kategori, stok ve durum bazında takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`final-product-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Son Ürün</span>
          <strong>{totalProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Son Ürün</span>
          <strong>{activeProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Kritik Stok</span>
          <strong>{criticalProducts}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Stok</span>
          <strong>{formatStockTotals(products)}</strong>
        </div>
      </div>

      <div className="product-layout final-product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Son Ürün Listesi</h3>
              <p className="muted">{visibleProducts.length} son ürün gösteriliyor.</p>
            </div>
            <div className="final-product-toolbar">
              <button className="btn primary" type="button" onClick={startNewProduct}>Yeni Son Ürün</button>
              <input
                type="search"
                placeholder="Kod, ürün adı veya açıklama ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as CategoryFilter)}>
                <option value="all">Tüm kategoriler</option>
                {FINAL_PRODUCT_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {FINAL_PRODUCT_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table final-product-table">
              <colgroup>
                <col className="fproduct-col-code" />
                <col className="fproduct-col-name" />
                <col className="fproduct-col-category" />
                <col className="fproduct-col-unit" />
                <col className="fproduct-col-stock" />
                <col className="fproduct-col-minimum" />
                <col className="fproduct-col-status" />
                <col className="fproduct-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Son Ürün Adı</th>
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
                      <div className="final-product-empty-list">
                        <strong>Henüz son ürün bulunmuyor.</strong>
                        <span>İlk son ürünü oluşturmak için "Yeni Son Ürün" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewProduct}>Yeni Son Ürün</button>
                      </div>
                    </td>
                  </tr>
                )}
                {products.length > 0 && visibleProducts.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun son ürün bulunamadı.</td></tr>
                )}
                {visibleProducts.map(product => {
                  const status = resolveFinalProductStatus(product)

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

        <aside className="product-side final-product-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
