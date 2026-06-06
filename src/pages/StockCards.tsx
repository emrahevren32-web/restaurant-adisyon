import React from 'react'
import { StockCategory, StockExpiryEvent, StockExpiryLot, StockItem, StockUnit, User } from '../types'
import {
  addActionLog,
  applyStockMovement,
  loadCriticalStockEvents,
  loadStockCategories,
  loadStockExpiryEvents,
  loadStockExpiryLots,
  loadStockItems,
  loadStockMovements,
  recordCriticalStockTransition,
  saveStockCategories,
  saveStockItems
} from '../storage'
import StockItemForm, { StockItemFormValues } from '../components/StockItemForm'
import {
  formatStockQuantity,
  getCriticalRiskRatio,
  getCriticalShortage,
  isCriticalStock,
  isOutOfStock,
  sortCriticalStockFirst
} from '../criticalStock'
import {
  formatExpiryDate,
  formatExpiryQuantity,
  formatExpiryStatusLabel,
  getExpiryStatus,
  getExpiryStatusClass,
  getExpiryWarningDays,
  isExpiryTracked,
  sortLotsFefo
} from '../expiryStock'

type Props = { currentUser: User }
type StatusFilter = 'all' | 'active' | 'inactive' | 'critical' | 'out' | 'healthy' | 'expiry' | 'expiry-risk' | 'expired'
type UnitFilter = 'all' | StockUnit

const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const stockUnits: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const formatQuantity = formatStockQuantity

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

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

const formatLotEventType = (event: StockExpiryEvent) => {
  if(event.eventType === 'lot_created') return 'Oluşturuldu'
  if(event.eventType === 'lot_consumed') return 'Tüketildi'
  if(event.eventType === 'lot_returned') return 'Ters hareketle iade edildi'
  if(event.eventType === 'expired') return 'Tarihi geçti'
  if(event.eventType === 'near_expiry') return 'SKT yaklaşan uyarısı'
  if(event.eventType === 'allocation_missing') return 'Lot eşleşmesi yok'
  return 'Lot güncellendi'
}

const getConsumptionPercent = (lot: Pick<StockExpiryLot, 'initialQty' | 'remainingQty'>) => {
  if(lot.initialQty <= 0) return 0

  const consumedQty = Math.max(0, lot.initialQty - lot.remainingQty)
  return Math.min(100, Math.round((consumedQty / lot.initialQty) * 100))
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
  const [stockNotice, setStockNotice] = React.useState<{ type: 'success' | 'warning'; text: string } | null>(null)
  const [criticalEvents, setCriticalEvents] = React.useState(() => loadCriticalStockEvents())
  const [expiryLots, setExpiryLots] = React.useState(() => loadStockExpiryLots())
  const [expiryEvents, setExpiryEvents] = React.useState(() => loadStockExpiryEvents())
  const [lotPanelItem, setLotPanelItem] = React.useState<StockItem | null>(null)

  const canManageStock = currentUser.role === 'Admin'

  React.useEffect(() => {
    if(canManageStock) saveStockItems(items)
  }, [canManageStock, items])

  React.useEffect(() => {
    if(canManageStock) saveStockCategories(categories)
  }, [canManageStock, categories])

  const refreshCriticalEvents = React.useCallback(() => {
    setCriticalEvents(loadCriticalStockEvents())
  }, [])

  const refreshExpiryData = React.useCallback(() => {
    setExpiryLots(loadStockExpiryLots())
    setExpiryEvents(loadStockExpiryEvents())
  }, [])

  const showCriticalNotice = (event?: ReturnType<typeof recordCriticalStockTransition>) => {
    refreshCriticalEvents()
    if(!event){
      setStockNotice(null)
      return
    }

    setStockNotice({
      type: event.eventType === 'entered' ? 'warning' : 'success',
      text: event.eventType === 'entered'
        ? `${event.stockItemName} kritik stok seviyesine düştü.`
        : `${event.stockItemName} kritik stoktan çıktı.`
    })
  }

  React.useEffect(() => {
    if(canManageStock) return
    setEditingItem(null)
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }, [canManageStock])

  const categoryMap = React.useMemo(() => {
    return new Map(categories.map(category => [category.id, category]))
  }, [categories])

  const allExpiryLotsByStockId = React.useMemo(() => {
    return expiryLots.reduce<Record<string, typeof expiryLots>>((acc, lot) => {
      acc[lot.stockItemId] = [...(acc[lot.stockItemId] || []), lot]
      return acc
    }, {})
  }, [expiryLots])

  const expiryLotsByStockId = React.useMemo(() => {
    return expiryLots.reduce<Record<string, typeof expiryLots>>((acc, lot) => {
      if(lot.remainingQty <= 0) return acc
      acc[lot.stockItemId] = [...(acc[lot.stockItemId] || []), lot]
      return acc
    }, {})
  }, [expiryLots])

  const getItemExpirySummary = React.useCallback((item: StockItem) => {
    if(!isExpiryTracked(item)){
      return { tracked: false, status: null as ReturnType<typeof getExpiryStatus> | null, nextLot: null as typeof expiryLots[number] | null, activeLots: [] as typeof expiryLots }
    }

    const activeLots = sortLotsFefo(expiryLotsByStockId[item.id] || [])
    const warningDays = getExpiryWarningDays(item)
    const expiredLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'expired')
    const nearLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'near_expiry')
    const unknownLot = activeLots.find(lot => getExpiryStatus(lot, warningDays) === 'unknown')
    const nextLot = expiredLot || nearLot || activeLots[0] || null
    const status = expiredLot
      ? 'expired'
      : nearLot
        ? 'near_expiry'
        : unknownLot && activeLots.length === 1
          ? 'unknown'
          : activeLots.length > 0
            ? getExpiryStatus(nextLot || activeLots[0], warningDays)
            : 'unknown'

    return { tracked: true, status, nextLot, activeLots }
  }, [expiryLots, expiryLotsByStockId])

  const selectedLotRows = React.useMemo(() => {
    if(!lotPanelItem) return []

    return sortLotsFefo(allExpiryLotsByStockId[lotPanelItem.id] || []).map(lot => ({
      lot,
      status: getExpiryStatus(lot, getExpiryWarningDays(lotPanelItem)),
      events: expiryEvents
        .filter(event => event.lotId === lot.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }))
  }, [allExpiryLotsByStockId, expiryEvents, lotPanelItem])

  const selectedFefoLots = React.useMemo(() => {
    if(!lotPanelItem) return []

    const warningDays = getExpiryWarningDays(lotPanelItem)
    return sortLotsFefo(selectedLotRows
      .filter(row => {
        if(row.lot.remainingQty <= 0) return false

        const status = getExpiryStatus(row.lot, warningDays)
        return status === 'valid' || status === 'near_expiry' || status === 'unknown'
      })
      .map(row => row.lot))
  }, [lotPanelItem, selectedLotRows])

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
        || (statusFilter === 'out' && isOutOfStock(item))
        || (statusFilter === 'healthy' && item.active && !isCriticalStock(item))
        || (statusFilter === 'expiry' && isExpiryTracked(item))
        || (statusFilter === 'expiry-risk' && getItemExpirySummary(item).status === 'near_expiry')
        || (statusFilter === 'expired' && getItemExpirySummary(item).status === 'expired')
      const matchesUnit = unitFilter === 'all' || item.unit === unitFilter

      return matchesSearch && matchesCategory && matchesStatus && matchesUnit
    })
  }, [categoryFilter, categoryMap, getItemExpirySummary, items, search, statusFilter, unitFilter])
  const sortedVisibleItems = React.useMemo(() => sortCriticalStockFirst(visibleItems), [visibleItems])

  const activeItemCount = items.filter(item => item.active).length
  const inactiveItemCount = items.length - activeItemCount
  const criticalItemCount = items.filter(isCriticalStock).length
  const outOfStockCount = items.filter(isOutOfStock).length
  const healthyItemCount = items.filter(item => item.active && !isCriticalStock(item)).length
  const expiryTrackedItemCount = items.filter(isExpiryTracked).length
  const nearExpiryItemCount = items.filter(item => getItemExpirySummary(item).status === 'near_expiry').length
  const expiredItemCount = items.filter(item => getItemExpirySummary(item).status === 'expired').length
  const today = getLocalDateKey(new Date())
  const todayCriticalEnteredCount = criticalEvents.filter(event => event.eventType === 'entered' && getLocalDateKey(event.timestamp) === today).length
  const todayCriticalResolvedCount = criticalEvents.filter(event => event.eventType === 'resolved' && getLocalDateKey(event.timestamp) === today).length

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
      let criticalEvent: ReturnType<typeof recordCriticalStockTransition>

      if(qtyChanged){
        try {
          const movement = applyStockMovement({
            stockItemId: editingItem.id,
            type: 'Sayım Düzeltme',
            source: 'Sayım',
            reason: values.currentQty >= editingItem.currentQty ? 'Sayım Fazlası' : 'Sayım Eksiği',
            qty: values.currentQty,
            description: 'Stok kartı ekranından mevcut miktar düzeltmesi.',
            user: currentUser,
            criticalBeforeItem: editingItem,
            criticalStockTrigger: 'Stok Kartı Güncelleme'
          })
          criticalEvent = movement.criticalStockEvent
          setItems(loadStockItems())
          refreshExpiryData()
        } catch (error) {
          setPermissionError(error instanceof Error ? error.message : 'Stok miktarı güncellenemedi.')
          setItems(loadStockItems())
          refreshExpiryData()
          return
        }
      } else {
        criticalEvent = recordCriticalStockTransition({
          before: editingItem,
          after: updatedItem,
          user: currentUser,
          trigger: 'Stok Kartı Güncelleme',
          note: 'Stok kartı bilgileri güncellendi.'
        })
      }

      addActionLog({
        operationType: 'Stok kartı güncellendi',
        user: currentUser,
        description: `${editingItem.name} stok kartı güncellendi. Yeni ad: ${values.name}.`
      })
      setEditingItem(null)
      showCriticalNotice(criticalEvent)
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
          user: currentUser,
          skipCriticalStockCheck: true
        })
      } catch (error) {
        setPermissionError(error instanceof Error ? error.message : 'Başlangıç stok hareketi oluşturulamadı.')
      }
    }

    const finalItem = loadStockItems().find(stockItem => stockItem.id === item.id) || item
    recordCriticalStockTransition({
      after: finalItem,
      user: currentUser,
      trigger: 'Stok Kartı Oluşturma',
      note: 'Stok kartı oluşturuldu.'
    })

    setItems(loadStockItems())
    refreshExpiryData()
    addActionLog({
      operationType: 'Stok kartı oluşturuldu',
      user: currentUser,
      description: `${item.name} stok kartı oluşturuldu. Kritik seviye: ${formatQuantity(item.minQty, item.unit)}.${values.currentQty > 0 ? ` Başlangıç miktarı hareket kaydıyla eklendi: ${formatQuantity(values.currentQty, item.unit)}.` : ''}`
    })
    refreshCriticalEvents()
    setStockNotice({
      type: 'success',
      text: 'Stok kartı oluşturuldu. İlk stok girişinizi Stok Hareketleri ekranından yapabilirsiniz.'
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
    if(!item) return

    const nextItem = { ...item, active: !item.active, updatedAt: new Date().toISOString() }
    setItems(prev => prev.map(stockItem => stockItem.id === itemId ? nextItem : stockItem))

    addActionLog({
      operationType: item.active ? 'Stok kartı pasif yapıldı' : 'Stok kartı aktif yapıldı',
      user: currentUser,
      description: `${item.name} stok kartı ${item.active ? 'pasif' : 'aktif'} yapıldı.`
    })
    showCriticalNotice(recordCriticalStockTransition({
      before: item,
      after: nextItem,
      user: currentUser,
      trigger: item.active ? 'Stok Kartı Pasifleştirme' : 'Stok Kartı Aktifleştirme',
      note: `${item.name} stok kartı ${item.active ? 'pasif' : 'aktif'} yapıldı.`
    }))
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
          <p className="muted">Stok kartlarını oluşturun. Stok miktarı ve SKT girişleri Stok Hareketleri ekranından yapılır.</p>
        </div>
        <span className="status-pill success">Admin</span>
      </div>

      {permissionError && <div className="form-error">{permissionError}</div>}
      {stockNotice && <div className={`settings-message ${stockNotice.type}`}>{stockNotice.text}</div>}

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
          <p className="muted">Bugün giriş: {todayCriticalEnteredCount}</p>
        </div>
        <div className="metric-card">
          <span>Stokta Yok</span>
          <strong>{outOfStockCount}</strong>
          <p className="muted">Aktif kartlar</p>
        </div>
        <div className="metric-card">
          <span>SKT Takipli</span>
          <strong>{expiryTrackedItemCount}</strong>
          <p className="muted">Lot bazlı izlenir</p>
        </div>
        <div className="metric-card">
          <span>SKT Riski</span>
          <strong>{nearExpiryItemCount + expiredItemCount}</strong>
          <p className="muted">{expiredItemCount} tarihi geçmiş</p>
        </div>
        <div className="metric-card">
          <span>Sağlıklı Stok</span>
          <strong>{healthyItemCount}</strong>
          <p className="muted">Bugün çıkış: {todayCriticalResolvedCount}</p>
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
                <option value="out">Stokta yok</option>
                <option value="healthy">Sağlıklı stok</option>
                <option value="expiry">SKT takipli</option>
                <option value="expiry-risk">SKT yaklaşan</option>
                <option value="expired">SKT tarihi geçmiş</option>
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
            <table className="data-table stock-cards-table">
              <thead>
                <tr>
                  <th>Stok Kartı</th>
                  <th>Kategori</th>
                  <th>Birim</th>
                  <th>Mevcut</th>
                  <th>Kritik</th>
                  <th>Eksik</th>
                  <th>SKT</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-cell">Bu filtrelere uygun stok kartı bulunamadı.</td>
                  </tr>
                )}
                {sortedVisibleItems.map(item => {
                  const category = categoryMap.get(item.categoryId)
                  const critical = isCriticalStock(item)
                  const shortage = getCriticalShortage(item)
                  const riskRatio = getCriticalRiskRatio(item)
                  const expirySummary = getItemExpirySummary(item)

                  return (
                    <tr key={item.id} className={critical ? 'critical-stock-table-row' : undefined}>
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
                      <td>
                        <strong>{formatQuantity(item.currentQty, item.unit)}</strong>
                        {critical && (
                          <div className="critical-risk-bar" title="Kritik stok riski">
                            <span style={{ width: `${Math.max(12, Math.round(riskRatio * 100))}%` }} />
                          </div>
                        )}
                      </td>
                      <td>{formatQuantity(item.minQty, item.unit)}</td>
                      <td>{shortage > 0 ? formatQuantity(shortage, item.unit) : critical ? 'Eşik seviyesinde' : '-'}</td>
                      <td>
                        {!expirySummary.tracked ? (
                          <span className="status-pill muted-pill">Kapalı</span>
                        ) : (
                          <>
                            <span className={`status-pill ${getExpiryStatusClass(expirySummary.status || 'unknown')}`}>
                              {formatExpiryStatusLabel(expirySummary.status || 'unknown')}
                            </span>
                            <div className="muted small-text">
                              {expirySummary.nextLot
                                ? `${formatExpiryDate(expirySummary.nextLot.expiryDate)} · ${formatQuantity(expirySummary.nextLot.remainingQty, item.unit)}`
                                : 'Lot kaydı yok'}
                            </div>
                          </>
                        )}
                      </td>
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
                        <button className={`btn ${item.tracksExpiry ? 'lot-view-btn' : ''}`} onClick={() => setLotPanelItem(item)}>Lotları Gör</button>
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

      {lotPanelItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${lotPanelItem.name} lotları`}>
          <div className="stock-lot-modal">
            <div className="section-header">
              <div>
                <h3>{lotPanelItem.name} Lotları</h3>
                <p className="muted">
                  FEFO tüketim önceliği, kalan miktarlar ve lot bazlı işlem geçmişi.
                </p>
              </div>
              <button className="btn" type="button" onClick={() => setLotPanelItem(null)}>Kapat</button>
            </div>

            <div className="metric-grid report-metric-grid">
              <div className="metric-card">
                <span>Toplam Lot</span>
                <strong>{selectedLotRows.length}</strong>
                <p className="muted">{lotPanelItem.tracksExpiry ? 'SKT takibi aktif' : 'SKT takibi kapalı'}</p>
              </div>
              <div className="metric-card">
                <span>FEFO Adayı</span>
                <strong>{selectedFefoLots.length}</strong>
                <p className="muted">Tüketilebilir kalan lot</p>
              </div>
              <div className="metric-card">
                <span>Toplam Kalan</span>
                <strong>{formatExpiryQuantity(selectedLotRows.reduce((sum, row) => sum + row.lot.remainingQty, 0), lotPanelItem.unit)}</strong>
                <p className="muted">Lot bakiyeleri toplamı</p>
              </div>
            </div>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>FEFO Tüketim Önceliği</h4>
                <span className="status-pill">En yakın SKT önce</span>
              </div>
              <div className="lot-priority-list">
                {selectedFefoLots.length === 0 && <div className="empty-state">Tüketilebilir FEFO lotu bulunmuyor.</div>}
                {selectedFefoLots.map((lot, index) => (
                  <div className="lot-priority-row" key={lot.id}>
                    <div>
                      <strong>{index + 1}. Öncelikli Lot</strong>
                      <span>{lot.lotCode}</span>
                    </div>
                    <div>
                      <span>SKT</span>
                      <strong>{formatExpiryDate(lot.expiryDate)}</strong>
                    </div>
                    <div>
                      <span>Kalan</span>
                      <strong>{formatExpiryQuantity(lot.remainingQty, lot.unit)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>Lot Listesi</h4>
                <span className="status-pill">{selectedLotRows.length} lot</span>
              </div>
              <div className="table-wrap">
                <table className="data-table report-table">
                  <thead>
                    <tr>
                      <th>Lot No</th>
                      <th>SKT</th>
                      <th>Oluşturulma Tarihi</th>
                      <th>İlk Giriş Miktarı</th>
                      <th>Kalan Miktar</th>
                      <th>Tüketim</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLotRows.length === 0 && <tr><td colSpan={7} className="empty-cell">Bu stok kartı için lot kaydı yok.</td></tr>}
                    {selectedLotRows.map(({ lot, status }) => (
                      <tr key={lot.id}>
                        <td>
                          <strong>{lot.lotCode}</strong>
                          {(lot.supplierName || lot.invoiceNo) && (
                            <div className="muted small-text">
                              {[lot.supplierName && `Tedarikçi: ${lot.supplierName}`, lot.invoiceNo && `Fatura: ${lot.invoiceNo}`].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td>{formatExpiryDate(lot.expiryDate)}</td>
                        <td>{formatDateTime(lot.createdAt)}</td>
                        <td>{formatExpiryQuantity(lot.initialQty, lot.unit)}</td>
                        <td>{formatExpiryQuantity(lot.remainingQty, lot.unit)}</td>
                        <td>
                          <strong>%{getConsumptionPercent(lot)}</strong>
                          <div className="lot-consumption-bar" aria-label="Tüketim yüzdesi">
                            <span style={{ width: `${getConsumptionPercent(lot)}%` }} />
                          </div>
                        </td>
                        <td><span className={`status-pill ${getExpiryStatusClass(status)}`}>{formatExpiryStatusLabel(status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="lot-panel-section">
              <div className="section-header compact">
                <h4>Lot Hareket Geçmişi</h4>
              </div>
              <div className="lot-event-list">
                {selectedLotRows.length === 0 && <div className="empty-state">Lot hareket geçmişi yok.</div>}
                {selectedLotRows.map(({ lot, events }) => (
                  <details className="history-card lot-history-card" key={lot.id}>
                    <summary>
                      <span>
                        <strong>{lot.lotCode}</strong>
                        <small>{formatExpiryDate(lot.expiryDate)} · Kalan {formatExpiryQuantity(lot.remainingQty, lot.unit)}</small>
                      </span>
                      <span className="history-summary-values">
                        <strong>{events.length}</strong>
                        <small>olay</small>
                      </span>
                    </summary>
                    <div className="lot-event-rows">
                      {events.length === 0 && <div className="empty-state">Bu lot için olay kaydı yok.</div>}
                      {events.map(event => (
                        <div className="lot-event-row" key={event.id}>
                          <div>
                            <strong>{formatLotEventType(event)}</strong>
                            <span>{formatDateTime(event.timestamp)} · {event.trigger}</span>
                          </div>
                          <div>
                            <strong>{event.qty !== undefined ? formatExpiryQuantity(event.qty, event.unit) : '-'}</strong>
                            {event.note && <span>{event.note}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
