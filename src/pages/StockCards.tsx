import React from 'react'
import { StockCategory, StockItem, StockUnit, User } from '../types'
import {
  addActionLog,
  applyStockMovement,
  loadStockCategories,
  loadStockItems,
  loadStockMovements,
  saveStockCategories,
  saveStockItems
} from '../storage'
import StockItemForm, { StockItemFormValues } from '../components/StockItemForm'

type Props = { currentUser: User }
type StatusFilter = 'all' | 'active' | 'inactive' | 'critical'
type UnitFilter = 'all' | StockUnit

const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const stockUnits: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const formatQuantity = (value: number, unit: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

const isCriticalStock = (item: StockItem) => {
  return item.active && item.currentQty <= item.minQty
}

export default function StockCards({ currentUser }: Props){
  const [items, setItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [categories, setCategories] = React.useState<StockCategory[]>(() => loadStockCategories())
  const [editingItem, setEditingItem] = React.useState<StockItem | null>(null)
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('active')
  const [unitFilter, setUnitFilter] = React.useState<UnitFilter>('all')
  const [newCategoryName, setNewCategoryName] = React.useState('')
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = React.useState('')
  const [categoryError, setCategoryError] = React.useState('')
  const [permissionError, setPermissionError] = React.useState('')

  const canManageStock = currentUser.role === 'Admin'

  React.useEffect(() => {
    if(canManageStock) saveStockItems(items)
  }, [canManageStock, items])

  React.useEffect(() => {
    if(canManageStock) saveStockCategories(categories)
  }, [canManageStock, categories])

  React.useEffect(() => {
    if(canManageStock) return
    setEditingItem(null)
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }, [canManageStock])

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map(category => [category.id, category]))
  }, [categories])

  const itemCountsByCategory = React.useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] || 0) + 1
      return acc
    }, {})
  }, [items])

  const activeCategories = React.useMemo(() => categories.filter(category => category.active), [categories])

  const selectableCategories = React.useMemo(() => {
    if(!editingItem) return activeCategories

    const currentCategory = categoryMap.get(editingItem.categoryId)
    if(!currentCategory || currentCategory.active) return activeCategories
    return [...activeCategories, currentCategory]
  }, [activeCategories, categoryMap, editingItem])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return items.filter(item => {
      const category = categoryMap.get(item.categoryId)
      const matchesSearch = !normalizedSearch
        || item.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.description || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.sku || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.barcode || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && item.active)
        || (statusFilter === 'inactive' && !item.active)
        || (statusFilter === 'critical' && isCriticalStock(item))
      const matchesUnit = unitFilter === 'all' || item.unit === unitFilter

      return matchesSearch && matchesCategory && matchesStatus && matchesUnit
    })
  }, [categoryFilter, categoryMap, items, search, statusFilter, unitFilter])

  const activeItemCount = items.filter(item => item.active).length
  const inactiveItemCount = items.length - activeItemCount
  const criticalItemCount = items.filter(isCriticalStock).length

  const assertCanManageStock = () => {
    if(canManageStock){
      setPermissionError('')
      return true
    }

    setPermissionError('Bu işlem için Admin yetkisi gereklidir.')
    return false
  }

  const saveItem = (values: StockItemFormValues) => {
    if(!assertCanManageStock()) return

    const now = new Date().toISOString()

    if(editingItem){
      const qtyChanged = values.currentQty !== editingItem.currentQty
      const updatedItem = {
        ...editingItem,
        ...values,
        currentQty: editingItem.currentQty,
        updatedAt: now
      }
      const nextItems = items.map(item => item.id === editingItem.id ? updatedItem : item)
      saveStockItems(nextItems)
      setItems(nextItems)

      if(qtyChanged){
        try {
          applyStockMovement({
            stockItemId: editingItem.id,
            type: 'Sayım Düzeltme',
            source: 'Sayım',
            reason: values.currentQty >= editingItem.currentQty ? 'Sayım Fazlası' : 'Sayım Eksiği',
            qty: values.currentQty,
            description: 'Stok kartı ekranından mevcut miktar düzeltmesi.',
            user: currentUser
          })
          setItems(loadStockItems())
        } catch (error) {
          setPermissionError(error instanceof Error ? error.message : 'Stok miktarı güncellenemedi.')
          setItems(loadStockItems())
          return
        }
      }

      addActionLog({
        operationType: 'Stok kartı güncellendi',
        user: currentUser,
        description: `${editingItem.name} stok kartı güncellendi. Yeni ad: ${values.name}.`
      })
      setEditingItem(null)
      return
    }

    const item: StockItem = {
      id: createId('stock'),
      ...values,
      currentQty: 0,
      createdAt: now,
      updatedAt: now
    }

    const nextItems = [item, ...items]
    saveStockItems(nextItems)

    if(values.currentQty > 0){
      try {
        applyStockMovement({
          stockItemId: item.id,
          type: 'Giriş',
          source: 'Manuel',
          reason: 'Satın Alma',
          qty: values.currentQty,
          description: 'Stok kartı oluşturulurken girilen başlangıç miktarı.',
          user: currentUser
        })
      } catch (error) {
        setPermissionError(error instanceof Error ? error.message : 'Başlangıç stok hareketi oluşturulamadı.')
      }
    }

    setItems(loadStockItems())
    addActionLog({
      operationType: 'Stok kartı oluşturuldu',
      user: currentUser,
      description: `${item.name} stok kartı oluşturuldu. Kritik seviye: ${formatQuantity(item.minQty, item.unit)}.${values.currentQty > 0 ? ` Başlangıç miktarı hareket kaydıyla eklendi: ${formatQuantity(values.currentQty, item.unit)}.` : ''}`
    })
  }

  const startEditItem = (item: StockItem) => {
    if(!assertCanManageStock()) return
    setEditingItem(item)
  }

  const deleteItem = (itemId: string) => {
    if(!assertCanManageStock()) return

    const item = items.find(stockItem => stockItem.id === itemId)
    if(!item) return

    if(loadStockMovements().some(movement => movement.stockItemId === itemId)){
      setPermissionError('Hareket geçmişi olan stok kartı silinemez. Kartı pasif yapabilirsiniz.')
      return
    }

    if(!confirm(`${item.name} stok kartı silinecek. Emin misiniz?`)) return

    setItems(prev => prev.filter(stockItem => stockItem.id !== itemId))
    if(editingItem?.id === itemId) setEditingItem(null)
    addActionLog({
      operationType: 'Stok kartı silindi',
      user: currentUser,
      description: `${item.name} stok kartı silindi.`
    })
  }

  const toggleItemStatus = (itemId: string) => {
    if(!assertCanManageStock()) return

    const item = items.find(stockItem => stockItem.id === itemId)
    setItems(prev => prev.map(stockItem => stockItem.id === itemId
      ? { ...stockItem, active: !stockItem.active, updatedAt: new Date().toISOString() }
      : stockItem
    ))

    if(item){
      addActionLog({
        operationType: item.active ? 'Stok kartı pasif yapıldı' : 'Stok kartı aktif yapıldı',
        user: currentUser,
        description: `${item.name} stok kartı ${item.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  const addCategory = (event: React.FormEvent) => {
    event.preventDefault()

    if(!assertCanManageStock()) return

    const name = newCategoryName.trim()

    if(!name){
      setCategoryError('Kategori adı zorunludur.')
      return
    }

    if(categories.some(category => category.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))){
      setCategoryError('Bu kategori zaten mevcut.')
      return
    }

    const category: StockCategory = {
      id: createId('stock_cat'),
      name,
      active: true,
      createdAt: new Date().toISOString()
    }

    setCategories(prev => [category, ...prev])
    setNewCategoryName('')
    setCategoryError('')
    addActionLog({
      operationType: 'Stok kategorisi oluşturuldu',
      user: currentUser,
      description: `${category.name} stok kategorisi oluşturuldu.`
    })
  }

  const startEditCategory = (category: StockCategory) => {
    if(!assertCanManageStock()) return

    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setCategoryError('')
  }

  const saveCategoryName = (event: React.FormEvent) => {
    event.preventDefault()

    if(!assertCanManageStock()) return

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
    setCategories(prev => prev.map(category => category.id === editingCategoryId
      ? { ...category, name, updatedAt: new Date().toISOString() }
      : category
    ))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setCategoryError('')

    if(oldCategory){
      addActionLog({
        operationType: 'Stok kategorisi güncellendi',
        user: currentUser,
        description: `${oldCategory.name} stok kategorisi ${name} olarak güncellendi.`
      })
    }
  }

  const toggleCategory = (categoryId: string) => {
    if(!assertCanManageStock()) return
    if(categoryId === DEFAULT_STOCK_CATEGORY_ID) return

    const category = categories.find(item => item.id === categoryId)
    setCategories(prev => prev.map(item => item.id === categoryId
      ? { ...item, active: !item.active, updatedAt: new Date().toISOString() }
      : item
    ))

    if(category){
      addActionLog({
        operationType: category.active ? 'Stok kategorisi pasif yapıldı' : 'Stok kategorisi aktif yapıldı',
        user: currentUser,
        description: `${category.name} stok kategorisi ${category.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  if(!canManageStock){
    return (
      <div className="stock-page">
        <section className="card">
          <h2>Yetkisiz Erişim</h2>
          <p className="muted">Stok kartları ekranını sadece Yönetici rolündeki kullanıcılar görebilir.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="stock-page">
      <div className="page-title">
        <div>
          <h2>Stok Kartları</h2>
          <p className="muted">Hammadde, hazır ürün ve ambalaj stoklarını kategori, birim ve kritik seviye bilgileriyle yönetin.</p>
        </div>
        <span className="status-pill success">Admin</span>
      </div>

      {permissionError && <div className="form-error">{permissionError}</div>}

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Stok Kartı</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Kart</span>
          <strong>{activeItemCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kritik Stok</span>
          <strong>{criticalItemCount}</strong>
        </div>
        <div className="metric-card">
          <span>Pasif Kart</span>
          <strong>{inactiveItemCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Stok Listesi</h3>
              <p className="muted">{visibleItems.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls stock-toolbar-controls">
              <input
                type="search"
                placeholder="Stok adı, kod, barkod veya kategori ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="active">Aktif kartlar</option>
                <option value="critical">Kritik stok</option>
                <option value="inactive">Pasif kartlar</option>
                <option value="all">Tüm durumlar</option>
              </select>
              <select value={unitFilter} onChange={event => setUnitFilter(event.target.value as UnitFilter)}>
                <option value="all">Tüm birimler</option>
                {stockUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stok Kartı</th>
                  <th>Kategori</th>
                  <th>Birim</th>
                  <th>Mevcut</th>
                  <th>Kritik</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-cell">Bu filtrelere uygun stok kartı bulunamadı.</td>
                  </tr>
                )}
                {visibleItems.map(item => {
                  const category = categoryMap.get(item.categoryId)
                  const critical = isCriticalStock(item)

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {(item.sku || item.barcode || item.description) && (
                          <div className="muted small-text">
                            {[item.sku && `Kod: ${item.sku}`, item.barcode && `Barkod: ${item.barcode}`, item.description]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td>{category?.name || 'Kategori yok'}</td>
                      <td>{item.unit}</td>
                      <td>{formatQuantity(item.currentQty, item.unit)}</td>
                      <td>{formatQuantity(item.minQty, item.unit)}</td>
                      <td>
                        {!item.active ? (
                          <span className="status-pill muted-pill">Pasif</span>
                        ) : critical ? (
                          <span className="status-pill danger-pill">Kritik</span>
                        ) : (
                          <span className="status-pill success">Aktif</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <button className="btn" onClick={() => startEditItem(item)}>Düzenle</button>
                        <button className="btn" onClick={() => toggleItemStatus(item.id)}>
                          {item.active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                        <button className="btn" onClick={() => deleteItem(item.id)}>Sil</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingItem ? 'Stok Kartı Düzenle' : 'Yeni Stok Kartı'}</h3>
              {editingItem && <span className="status-pill">Düzenleme</span>}
            </div>
            <StockItemForm
              categories={selectableCategories}
              item={editingItem}
              onSave={saveItem}
              onCancel={editingItem ? () => setEditingItem(null) : undefined}
            />
          </section>

          <section className="card">
            <div className="section-header compact">
              <h3>Stok Kategorileri</h3>
            </div>
            <form onSubmit={addCategory} className="inline-form">
              <input
                placeholder="Yeni kategori adı"
                value={newCategoryName}
                onChange={event => setNewCategoryName(event.target.value)}
              />
              <button className="btn primary" type="submit">Ekle</button>
            </form>
            {categoryError && <div className="form-error">{categoryError}</div>}

            <div className="category-list">
              {categories.map(category => (
                <div className="category-row" key={category.id}>
                  {editingCategoryId === category.id ? (
                    <form onSubmit={saveCategoryName} className="category-edit-form">
                      <input value={editingCategoryName} onChange={event => setEditingCategoryName(event.target.value)} />
                      <button className="btn primary" type="submit">Kaydet</button>
                      <button className="btn" type="button" onClick={() => setEditingCategoryId(null)}>İptal</button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{category.name}</strong>
                        <div className="muted small-text">{itemCountsByCategory[category.id] || 0} stok kartı</div>
                      </div>
                      <span className={`status-pill ${category.active ? 'success' : 'muted-pill'}`}>
                        {category.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <div className="row-actions">
                        <button className="btn" onClick={() => startEditCategory(category)}>Düzenle</button>
                        <button className="btn" disabled={category.id === DEFAULT_STOCK_CATEGORY_ID} onClick={() => toggleCategory(category.id)}>
                          {category.active ? 'Pasif Yap' : 'Aktif Yap'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
