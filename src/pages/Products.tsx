import React from 'react'
import { Product, ProductCategory, User } from '../types'
import { addActionLog, loadCategories, loadProducts, saveCategories, saveProducts } from '../storage'
import ProductForm, { ProductFormValues } from '../components/ProductForm'

type StatusFilter = 'all' | 'active' | 'inactive'
type Props = { currentUser: User }

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY'
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const createId = (prefix: string) => `${prefix}_${Date.now()}`

export default function Products({ currentUser }: Props){
  const [items, setItems] = React.useState<Product[]>(() => loadProducts())
  const [categories, setCategories] = React.useState<ProductCategory[]>(() => loadCategories())
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('active')
  const [newCategoryName, setNewCategoryName] = React.useState('')
  const [categoryError, setCategoryError] = React.useState('')
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = React.useState('')
  const [permissionError, setPermissionError] = React.useState('')

  const canManageCatalog = currentUser.role === 'Admin'

  React.useEffect(()=> {
    if(canManageCatalog) saveProducts(items)
  }, [canManageCatalog, items])
  React.useEffect(()=> {
    if(canManageCatalog) saveCategories(categories)
  }, [canManageCatalog, categories])
  React.useEffect(() => {
    if(canManageCatalog) return
    setEditingProduct(null)
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }, [canManageCatalog])

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map(category => [category.id, category]))
  }, [categories])

  const productCountsByCategory = React.useMemo(() => {
    return items.reduce<Record<string, number>>((acc, product) => {
      acc[product.categoryId] = (acc[product.categoryId] || 0) + 1
      return acc
    }, {})
  }, [items])

  const activeCategories = React.useMemo(() => categories.filter(category => category.active), [categories])

  const selectableCategories = React.useMemo(() => {
    if(!editingProduct) return activeCategories

    const currentCategory = categoryMap.get(editingProduct.categoryId)
    if(!currentCategory || currentCategory.active) return activeCategories
    return [...activeCategories, currentCategory]
  }, [activeCategories, categoryMap, editingProduct])

  const visibleProducts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return items.filter(product => {
      const category = categoryMap.get(product.categoryId)
      const matchesSearch = !normalizedSearch
        || product.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (product.description || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesCategory = categoryFilter === 'all' || product.categoryId === categoryFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && product.active)
        || (statusFilter === 'inactive' && !product.active)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, categoryMap, items, search, statusFilter])

  const activeProductCount = items.filter(product => product.active).length
  const inactiveProductCount = items.length - activeProductCount

  const assertCanManageCatalog = () => {
    if(canManageCatalog){
      setPermissionError('')
      return true
    }

    setPermissionError('Bu işlem için Admin yetkisi gereklidir.')
    return false
  }

  const startEditProduct = (product: Product) => {
    if(!assertCanManageCatalog()) return
    setEditingProduct(product)
  }

  const saveProduct = (values: ProductFormValues) => {
    if(!assertCanManageCatalog()) return

    const now = new Date().toISOString()

    if(editingProduct){
      setItems(prev => prev.map(product => product.id === editingProduct.id
        ? { ...product, ...values, updatedAt: now }
        : product
      ))
      addActionLog({
        operationType: 'Ürün güncellendi',
        user: currentUser,
        description: `${editingProduct.name} ürünü güncellendi. Yeni ad: ${values.name}, fiyat: ${formatCurrency(values.price)}.`
      })
      setEditingProduct(null)
      return
    }

    const product: Product = {
      id: createId('prd'),
      ...values,
      createdAt: now,
      updatedAt: now
    }

    setItems(prev => [product, ...prev])
    addActionLog({
      operationType: 'Ürün oluşturuldu',
      user: currentUser,
      description: `${product.name} ürünü ${formatCurrency(product.price)} fiyatıyla oluşturuldu.`
    })
  }

  const addCategory = (e: React.FormEvent) => {
    e.preventDefault()

    if(!assertCanManageCatalog()) return

    const name = newCategoryName.trim()

    if(!name){
      setCategoryError('Kategori adı zorunludur.')
      return
    }

    if(categories.some(category => category.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))){
      setCategoryError('Bu kategori zaten mevcut.')
      return
    }

    const category: ProductCategory = {
      id: createId('cat'),
      name,
      active: true,
      createdAt: new Date().toISOString()
    }

    setCategories(prev => [category, ...prev])
    setNewCategoryName('')
    setCategoryError('')
    addActionLog({
      operationType: 'Kategori oluşturuldu',
      user: currentUser,
      description: `${category.name} kategorisi oluşturuldu.`
    })
  }

  const startEditCategory = (category: ProductCategory) => {
    if(!assertCanManageCatalog()) return

    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setCategoryError('')
  }

  const saveCategoryName = (e: React.FormEvent) => {
    e.preventDefault()

    if(!assertCanManageCatalog()) return

    const name = editingCategoryName.trim()

    if(!editingCategoryId || !name){
      setCategoryError('Kategori adı zorunludur.')
      return
    }

    if(categories.some(category =>
      category.id !== editingCategoryId
      && category.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')
    )){
      setCategoryError('Bu kategori zaten mevcut.')
      return
    }

    const oldCategory = categories.find(category => category.id === editingCategoryId)
    setCategories(prev => prev.map(category => category.id === editingCategoryId ? { ...category, name } : category))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setCategoryError('')
    if(oldCategory){
      addActionLog({
        operationType: 'Kategori güncellendi',
        user: currentUser,
        description: `${oldCategory.name} kategorisi ${name} olarak güncellendi.`
      })
    }
  }

  const toggleCategory = (categoryId: string) => {
    if(!assertCanManageCatalog()) return
    if(categoryId === 'cat_general') return

    const category = categories.find(item => item.id === categoryId)
    setCategories(prev => prev.map(category => category.id === categoryId
      ? { ...category, active: !category.active }
      : category
    ))
    if(category){
      addActionLog({
        operationType: category.active ? 'Kategori pasif yapıldı' : 'Kategori aktif yapıldı',
        user: currentUser,
        description: `${category.name} kategorisi ${category.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  const toggleProductStatus = (productId: string) => {
    if(!assertCanManageCatalog()) return

    const product = items.find(item => item.id === productId)
    setItems(prev => prev.map(product => product.id === productId
      ? { ...product, active: !product.active, updatedAt: new Date().toISOString() }
      : product
    ))
    if(product){
      addActionLog({
        operationType: product.active ? 'Ürün pasif yapıldı' : 'Ürün aktif yapıldı',
        user: currentUser,
        description: `${product.name} ürünü ${product.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  return (
    <div className="products-page">
      <div className="page-title">
        <div>
          <h2>Ürün Yönetimi</h2>
          <p className="muted">Menüyü kategorilere ayırın, ürünleri düzenleyin ve satış durumlarını takip edin.</p>
        </div>
        {!canManageCatalog && <span className="status-pill">Görüntüleme Modu</span>}
      </div>

      {permissionError && <div className="form-error">{permissionError}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Ürün</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Ürün</span>
          <strong>{activeProductCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kategori</span>
          <strong>{categories.length}</strong>
        </div>
        <div className="metric-card">
          <span>Pasif Ürün</span>
          <strong>{inactiveProductCount}</strong>
        </div>
      </div>

      <div className={`product-layout ${canManageCatalog ? '' : 'read-only'}`}>
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Ürün Listesi</h3>
              <p className="muted">{visibleProducts.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls">
              <input
                type="search"
                placeholder="Ürün, açıklama veya kategori ara"
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
              <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as StatusFilter)}>
                <option value="active">Aktif ürünler</option>
                <option value="inactive">Pasif ürünler</option>
                <option value="all">Tüm durumlar</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Kategori</th>
                  <th>Fiyat</th>
                  <th>Durum</th>
                  {canManageCatalog && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visibleProducts.length === 0 && (
                  <tr>
                    <td colSpan={canManageCatalog ? 5 : 4} className="empty-cell">Bu filtrelere uygun ürün bulunamadı.</td>
                  </tr>
                )}
                {visibleProducts.map(product => {
                  const category = categoryMap.get(product.categoryId)

                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.description && <div className="muted small-text">{product.description}</div>}
                      </td>
                      <td>{category?.name || 'Kategori yok'}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        <span className={`status-pill ${product.active ? 'success' : 'muted-pill'}`}>
                          {product.active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      {canManageCatalog && (
                        <td className="actions-cell">
                          <button className="btn" onClick={()=>startEditProduct(product)}>Düzenle</button>
                          <button className="btn" onClick={()=>toggleProductStatus(product.id)}>
                            {product.active ? 'Pasif Yap' : 'Aktif Yap'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {canManageCatalog && <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}</h3>
              {editingProduct && <span className="status-pill">Düzenleme</span>}
            </div>
            <ProductForm
              categories={selectableCategories}
              product={editingProduct}
              onSave={saveProduct}
              onCancel={editingProduct ? ()=>setEditingProduct(null) : undefined}
            />
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Kategori Yönetimi</h3>
            </div>
            <form onSubmit={addCategory} className="inline-form">
              <input
                placeholder="Yeni kategori adı"
                value={newCategoryName}
                onChange={e=>setNewCategoryName(e.target.value)}
              />
              <button className="btn primary" type="submit">Ekle</button>
            </form>
            {categoryError && <div className="form-error">{categoryError}</div>}

            <div className="category-list">
              {categories.map(category => (
                <div className="category-row" key={category.id}>
                  {editingCategoryId === category.id ? (
                    <form onSubmit={saveCategoryName} className="category-edit-form">
                      <input value={editingCategoryName} onChange={e=>setEditingCategoryName(e.target.value)} />
                      <button className="btn primary" type="submit">Kaydet</button>
                      <button className="btn" type="button" onClick={()=>setEditingCategoryId(null)}>İptal</button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{category.name}</strong>
                        <div className="muted small-text">{productCountsByCategory[category.id] || 0} ürün</div>
                      </div>
                      <span className={`status-pill ${category.active ? 'success' : 'muted-pill'}`}>
                        {category.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <div className="row-actions">
                        <button className="btn" onClick={()=>startEditCategory(category)}>Düzenle</button>
                        <button className="btn" disabled={category.id === 'cat_general'} onClick={()=>toggleCategory(category.id)}>
                          {category.active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>}
      </div>
    </div>
  )
}
