import React from 'react'
import {
  CriticalStockEvent,
  Product,
  Recipe,
  StockCategory,
  StockExpiryLot,
  StockExpiryStatus,
  StockItem,
  StockMovement,
  StockWasteRecord
} from '../types'
import {
  loadCriticalStockEvents,
  loadProducts,
  loadRecipes,
  loadStockCategories,
  loadStockExpiryLots,
  loadStockItems,
  loadStockMovements,
  loadStockWasteRecords
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'
import { formatStockQuantity, getCriticalRiskRatio, getCriticalShortage, isCriticalStock, isOutOfStock } from '../criticalStock'
import {
  formatExpiryDate,
  formatExpiryStatusLabel,
  getDaysUntilExpiry,
  getExpiryStatus,
  getExpiryStatusClass,
  getExpiryWarningDays,
  isExpiryTracked,
  normalizeExpiryDateKey
} from '../expiryStock'
import { getStockConsumptionUnitCost } from '../stockCost'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type CriticalStockRow = {
  item: StockItem
  currentQty: number
  minQty: number
  shortage: number
  statusLabel: string
  statusClassName: string
  riskRatio: number
}

type ExpiryRiskRow = {
  lot: StockExpiryLot
  item?: StockItem
  expiryDateKey: string
  daysUntilExpiry: number | null
  status: StockExpiryStatus
  statusLabel: string
  statusClassName: string
}

type WasteAnalysisRow = {
  stockItemId: string
  stockItemName: string
  unit: StockItem['unit']
  qty: number
  cost: number
  count: number
}

type MovementSummary = {
  entryCount: number
  entryValue: number
  exitCount: number
  exitValue: number
  wasteCount: number
  wasteValue: number
  netValue: number
}

type RiskListItem = {
  id: string
  title: string
  detail: string
  value: React.ReactNode
}

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getWeekStart = (today: Date) => {
  const date = new Date(today)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return getLocalDateKey(date)
}

const getMonthStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
}

const getYearStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), 0, 1))
}

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const getRangeDates = ({
  mode,
  customStartDate,
  customEndDate,
  today
}: {
  mode: DateRangeMode
  customStartDate: string
  customEndDate: string
  today: Date
}) => {
  const todayKey = getLocalDateKey(today)

  if(mode === 'today') return { startDate: todayKey, endDate: todayKey, label: 'Bugün' }
  if(mode === 'week') return { startDate: getWeekStart(today), endDate: todayKey, label: 'Bu hafta' }
  if(mode === 'month') return { startDate: getMonthStart(today), endDate: todayKey, label: 'Bu ay' }
  if(mode === 'year') return { startDate: getYearStart(today), endDate: todayKey, label: 'Bu yıl' }

  return {
    startDate: customStartDate,
    endDate: customEndDate,
    label: customStartDate || customEndDate ? 'Özel tarih aralığı' : 'Özel tarih'
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const getStockCategoryName = (categoryMap: Map<string, StockCategory>, item?: StockItem) => {
  if(!item) return 'Kategori yok'
  return categoryMap.get(item.categoryId)?.name || 'Kategori yok'
}

const matchesCategory = (item: StockItem | undefined, categoryId: string) => {
  return categoryId === 'all' || item?.categoryId === categoryId
}

const getMovementDateKey = (movement: StockMovement) => {
  return getLocalDateKey(movement.movementDate || movement.createdAt)
}

const getWasteDateKey = (record: StockWasteRecord) => {
  return getLocalDateKey(record.occurredAt || record.createdAt)
}

const getEventDateKey = (event: CriticalStockEvent) => {
  return getLocalDateKey(event.timestamp)
}

const getMovementValue = (movement: StockMovement, stockItemMap: Map<string, StockItem>) => {
  if(Number.isFinite(Number(movement.totalCost))) return Math.abs(Number(movement.totalCost))

  const unitCost = Number.isFinite(Number(movement.unitCost))
    ? Number(movement.unitCost)
    : getStockConsumptionUnitCost(stockItemMap.get(movement.stockItemId))

  return roundCurrency(Math.abs(Number(movement.qty) || 0) * Math.max(0, unitCost))
}

const getMovementNetValue = (movement: StockMovement, stockItemMap: Map<string, StockItem>) => {
  const value = getMovementValue(movement, stockItemMap)
  if(movement.type === 'Giriş') return value
  if(movement.type === 'Çıkış') return -value
  if(movement.type === 'Sayım Düzeltme'){
    const difference = (Number(movement.nextQty) || 0) - (Number(movement.previousQty) || 0)
    const unitCost = getStockConsumptionUnitCost(stockItemMap.get(movement.stockItemId))
    return roundCurrency(difference * unitCost)
  }
  return 0
}

const buildCriticalRows = (items: StockItem[]): CriticalStockRow[] => {
  return items
    .filter(isCriticalStock)
    .map(item => {
      const outOfStock = isOutOfStock(item)

      return {
        item,
        currentQty: item.currentQty,
        minQty: item.minQty,
        shortage: getCriticalShortage(item),
        statusLabel: outOfStock ? 'Tükendi' : 'Kritik',
        statusClassName: outOfStock ? 'danger-pill' : 'warning-pill',
        riskRatio: getCriticalRiskRatio(item)
      }
    })
    .sort((first, second) => {
      const outDiff = Number(isOutOfStock(second.item)) - Number(isOutOfStock(first.item))
      if(outDiff !== 0) return outDiff

      const riskDiff = second.riskRatio - first.riskRatio
      if(riskDiff !== 0) return riskDiff

      const shortageDiff = second.shortage - first.shortage
      if(shortageDiff !== 0) return shortageDiff

      return first.item.name.localeCompare(second.item.name, 'tr-TR')
    })
}

const buildExpiryRows = ({
  lots,
  stockItemMap,
  categoryId,
  startDate,
  endDate,
  today
}: {
  lots: StockExpiryLot[]
  stockItemMap: Map<string, StockItem>
  categoryId: string
  startDate: string
  endDate: string
  today: Date
}): ExpiryRiskRow[] => {
  return lots
    .map(lot => {
      const item = stockItemMap.get(lot.stockItemId)
      const expiryDateKey = normalizeExpiryDateKey(lot.expiryDate) || ''
      const warningDays = getExpiryWarningDays(item)
      const status = getExpiryStatus(lot, warningDays, today)
      const daysUntilExpiry = getDaysUntilExpiry(lot.expiryDate, today)

      return {
        lot,
        item,
        expiryDateKey,
        daysUntilExpiry,
        status,
        statusLabel: formatExpiryStatusLabel(status),
        statusClassName: getExpiryStatusClass(status)
      }
    })
    .filter(row => {
      if(!row.item?.active || !isExpiryTracked(row.item) || row.lot.remainingQty <= 0) return false
      if(!matchesCategory(row.item, categoryId)) return false
      if(row.status !== 'near_expiry' && row.status !== 'expired') return false
      if(!row.expiryDateKey) return false
      if(row.status === 'expired') return !endDate || row.expiryDateKey <= endDate
      return true
    })
    .sort((first, second) => {
      const statusDiff = (first.status === 'expired' ? 0 : 1) - (second.status === 'expired' ? 0 : 1)
      if(statusDiff !== 0) return statusDiff

      const firstDays = first.daysUntilExpiry ?? Number.POSITIVE_INFINITY
      const secondDays = second.daysUntilExpiry ?? Number.POSITIVE_INFINITY
      if(firstDays !== secondDays) return firstDays - secondDays

      return first.lot.stockItemName.localeCompare(second.lot.stockItemName, 'tr-TR')
    })
}

const buildWasteRows = (records: StockWasteRecord[], stockItemMap: Map<string, StockItem>): WasteAnalysisRow[] => {
  const groupedRows = records.reduce<Map<string, WasteAnalysisRow>>((map, record) => {
    const stockItem = stockItemMap.get(record.stockItemId)
    const current = map.get(record.stockItemId) || {
      stockItemId: record.stockItemId,
      stockItemName: record.stockItemName,
      unit: stockItem?.unit || record.unit,
      qty: 0,
      cost: 0,
      count: 0
    }

    current.qty += Math.max(0, Number(record.qty) || 0)
    current.cost = roundCurrency(current.cost + Math.max(0, Number(record.estimatedTotalCost) || 0))
    current.count += 1
    map.set(record.stockItemId, current)
    return map
  }, new Map())

  return Array.from(groupedRows.values()).sort((first, second) => {
    const costDiff = second.cost - first.cost
    if(costDiff !== 0) return costDiff

    const qtyDiff = second.qty - first.qty
    if(qtyDiff !== 0) return qtyDiff

    return first.stockItemName.localeCompare(second.stockItemName, 'tr-TR')
  })
}

const buildMovementSummary = (movements: StockMovement[], stockItemMap: Map<string, StockItem>): MovementSummary => {
  return movements.reduce<MovementSummary>((summary, movement) => {
    const value = getMovementValue(movement, stockItemMap)
    const netValue = getMovementNetValue(movement, stockItemMap)

    if(movement.type === 'Giriş'){
      summary.entryCount += 1
      summary.entryValue = roundCurrency(summary.entryValue + value)
    }

    if(movement.type === 'Çıkış'){
      summary.exitCount += 1
      summary.exitValue = roundCurrency(summary.exitValue + value)
    }

    if(movement.source === 'Fire' || movement.reason === 'Fire'){
      summary.wasteCount += 1
      summary.wasteValue = roundCurrency(summary.wasteValue + value)
    }

    summary.netValue = roundCurrency(summary.netValue + netValue)
    return summary
  }, {
    entryCount: 0,
    entryValue: 0,
    exitCount: 0,
    exitValue: 0,
    wasteCount: 0,
    wasteValue: 0,
    netValue: 0
  })
}

const getActiveRecipeMap = (recipes: Recipe[]) => {
  return recipes
    .filter(recipe => recipe.active && !recipe.deletedAt)
    .sort((first, second) => (second.recipeVersion || second.version || 0) - (first.recipeVersion || first.version || 0))
}

const recipeMatchesCategory = (recipe: Recipe, stockItemMap: Map<string, StockItem>, categoryId: string) => {
  if(categoryId === 'all') return true
  return recipe.items.some(item => stockItemMap.get(item.stockItemId)?.categoryId === categoryId)
}

const isRecipeRisky = (recipe: Recipe, stockItemMap: Map<string, StockItem>, expiryRiskStockIds: Set<string>) => {
  return recipe.items.some(item => {
    const stockItem = stockItemMap.get(item.stockItemId)
    if(!stockItem) return true
    if(isCriticalStock(stockItem) || isOutOfStock(stockItem)) return true
    if(expiryRiskStockIds.has(stockItem.id)) return true
    return getStockConsumptionUnitCost(stockItem) <= 0
  })
}

const getProductName = (products: Product[], recipe: Recipe) => {
  return products.find(product => product.id === recipe.productId)?.name || recipe.productName || recipe.name
}

function KpiCard({ label, value, detail, compact = false }: KpiCardProps){
  return (
    <div className={`metric-card dashboard-kpi-card ${compact ? 'compact compact-metric-card' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function RiskList({ title, items, emptyText }: { title: string; items: RiskListItem[]; emptyText: string }){
  return (
    <section className="card stock-risk-card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
        </div>
        <span className={`status-pill ${items.length > 0 ? 'warning-pill' : 'success'}`}>
          {items.length > 0 ? `${formatNumber(items.length)} kayıt` : 'Temiz'}
        </span>
      </div>
      <div className="current-report-mini-list">
        {items.length === 0 && <p className="muted">{emptyText}</p>}
        {items.map(item => (
          <div className="current-report-mini-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <div>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function StockRiskCenter(){
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [stockCategories] = React.useState<StockCategory[]>(() => loadStockCategories())
  const [movements] = React.useState<StockMovement[]>(() => loadStockMovements())
  const [expiryLots] = React.useState<StockExpiryLot[]>(() => loadStockExpiryLots())
  const [recipes] = React.useState<Recipe[]>(() => loadRecipes())
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [criticalEvents] = React.useState<CriticalStockEvent[]>(() => loadCriticalStockEvents())
  const [wasteRecords] = React.useState<StockWasteRecord[]>(() => loadStockWasteRecords())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState('all')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])
  const stockCategoryMap = React.useMemo(() => new Map(stockCategories.map(category => [category.id, category])), [stockCategories])

  const categoryItems = React.useMemo(() => {
    return stockItems.filter(item => matchesCategory(item, categoryFilter))
  }, [categoryFilter, stockItems])
  const activeCategoryItems = categoryItems.filter(item => item.active)
  const filteredMovements = React.useMemo(() => {
    return movements.filter(movement => {
      const item = stockItemMap.get(movement.stockItemId)
      return matchesCategory(item, categoryFilter) && isDateInRange(getMovementDateKey(movement), range.startDate, range.endDate)
    })
  }, [categoryFilter, movements, range.endDate, range.startDate, stockItemMap])
  const filteredWasteRecords = React.useMemo(() => {
    return wasteRecords.filter(record => {
      const item = stockItemMap.get(record.stockItemId)
      return record.status === 'active'
        && matchesCategory(item, categoryFilter)
        && isDateInRange(getWasteDateKey(record), range.startDate, range.endDate)
    })
  }, [categoryFilter, range.endDate, range.startDate, stockItemMap, wasteRecords])
  const thisMonthWasteRecords = React.useMemo(() => {
    return wasteRecords.filter(record => {
      const item = stockItemMap.get(record.stockItemId)
      return record.status === 'active'
        && matchesCategory(item, categoryFilter)
        && isDateInRange(getWasteDateKey(record), monthStart, todayKey)
    })
  }, [categoryFilter, monthStart, stockItemMap, todayKey, wasteRecords])
  const filteredCriticalEvents = React.useMemo(() => {
    return criticalEvents.filter(event => {
      const item = stockItemMap.get(event.stockItemId)
      return matchesCategory(item, categoryFilter) && isDateInRange(getEventDateKey(event), range.startDate, range.endDate)
    })
  }, [categoryFilter, criticalEvents, range.endDate, range.startDate, stockItemMap])

  const criticalRows = React.useMemo(() => buildCriticalRows(activeCategoryItems), [activeCategoryItems])
  const outOfStockItems = activeCategoryItems.filter(isOutOfStock)
  const totalStockValue = roundCurrency(activeCategoryItems.reduce((sum, item) => {
    return sum + Math.max(0, item.currentQty) * getStockConsumptionUnitCost(item)
  }, 0))
  const expiryRows = React.useMemo(() => buildExpiryRows({
    lots: expiryLots,
    stockItemMap,
    categoryId: categoryFilter,
    startDate: range.startDate,
    endDate: range.endDate,
    today
  }), [categoryFilter, expiryLots, range.endDate, range.startDate, stockItemMap, today])
  const expiryRiskStockIds = React.useMemo(() => new Set(expiryRows.map(row => row.lot.stockItemId)), [expiryRows])
  const wasteRows = React.useMemo(() => buildWasteRows(filteredWasteRecords, stockItemMap), [filteredWasteRecords, stockItemMap])
  const movementSummary = React.useMemo(() => buildMovementSummary(filteredMovements, stockItemMap), [filteredMovements, stockItemMap])
  const activeRecipes = React.useMemo(() => getActiveRecipeMap(recipes), [recipes])
  const riskyRecipes = React.useMemo(() => {
    return activeRecipes.filter(recipe => {
      return recipeMatchesCategory(recipe, stockItemMap, categoryFilter)
        && isRecipeRisky(recipe, stockItemMap, expiryRiskStockIds)
    })
  }, [activeRecipes, categoryFilter, expiryRiskStockIds, stockItemMap])

  const wasteProductCount = wasteRows.length
  const thisMonthWasteCost = roundCurrency(thisMonthWasteRecords.reduce((sum, record) => sum + Math.max(0, record.estimatedTotalCost || 0), 0))
  const almostOutItems = activeCategoryItems
    .filter(item => item.minQty > 0 && item.currentQty > 0 && item.currentQty <= item.minQty)
    .sort((first, second) => getCriticalRiskRatio(second) - getCriticalRiskRatio(first) || first.name.localeCompare(second.name, 'tr-TR'))
  const highWasteRows = wasteRows.filter(row => row.count > 0).slice(0, 5)
  const riskyRecipeItems: RiskListItem[] = riskyRecipes.slice(0, 5).map(recipe => ({
    id: recipe.id,
    title: getProductName(products, recipe),
    detail: `${formatNumber(recipe.items.length)} üretim tanımı bileşeni`,
    value: recipe.items.some(item => {
      const stockItem = stockItemMap.get(item.stockItemId)
      return stockItem ? isOutOfStock(stockItem) : true
    }) ? 'Tükenen bileşen' : 'Riskli'
  }))
  const riskListItems = {
    almostOut: almostOutItems.slice(0, 5).map<RiskListItem>(item => ({
      id: item.id,
      title: item.name,
      detail: `Minimum seviye ${formatStockQuantity(item.minQty, item.unit)}`,
      value: formatStockQuantity(item.currentQty, item.unit)
    })),
    critical: criticalRows.slice(0, 5).map<RiskListItem>(row => ({
      id: row.item.id,
      title: row.item.name,
      detail: `${getStockCategoryName(stockCategoryMap, row.item)} / eksik ${formatStockQuantity(row.shortage, row.item.unit)}`,
      value: row.statusLabel
    })),
    expiry: expiryRows.slice(0, 5).map<RiskListItem>(row => ({
      id: row.lot.id,
      title: row.lot.stockItemName,
      detail: `${row.lot.lotCode} / Geçerlilik ${formatExpiryDate(row.lot.expiryDate)}`,
      value: row.daysUntilExpiry === null ? '-' : `${formatNumber(row.daysUntilExpiry)} gün`
    })),
    waste: highWasteRows.map<RiskListItem>(row => ({
      id: row.stockItemId,
      title: row.stockItemName,
      detail: `${formatStockQuantity(row.qty, row.unit)} / ${formatNumber(row.count)} işlem`,
      value: formatCurrency(row.cost)
    })),
    recipes: riskyRecipeItems
  }

  return (
    <div className="stock-risk-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Stok ve Risk Merkezi</h2>
          <p className="muted">Stok durumunu ve operasyonel riskleri analiz edin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">{range.label}</span>
          <span className="dashboard-date-pill">{range.startDate || '-'} / {range.endDate || '-'}</span>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Tarih aralığı ve kategori değiştiğinde stok hareketleri, geçerlilik, kayıp ve risk analizleri güncellenir.</p>
          </div>
          <div className="toolbar-controls stock-risk-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input
              type="date"
              value={rangeMode === 'custom' ? customStartDate : range.startDate}
              onChange={event => setCustomStartDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <input
              type="date"
              value={rangeMode === 'custom' ? customEndDate : range.endDate}
              onChange={event => setCustomEndDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
              <option value="all">Tüm kategoriler</option>
              {stockCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Stok Kalemi" value={formatNumber(categoryItems.length)} detail={`${formatNumber(activeCategoryItems.length)} aktif stok kartı`} />
        <KpiCard label="Kritik Stok Sayısı" value={formatNumber(criticalRows.length)} detail={`${formatNumber(filteredCriticalEvents.length)} kritik geçiş kaydı`} />
        <KpiCard label="Geçerlilik Riski Olan Ürün" value={formatNumber(expiryRiskStockIds.size)} detail={`${formatNumber(expiryRows.length)} riskli lot`} />
        <KpiCard label="Kayıplı Ürün" value={formatNumber(wasteProductCount)} detail={`${formatNumber(filteredWasteRecords.length)} kayıp kaydı`} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid stock-risk-extra-grid">
        <KpiCard compact label="Toplam Stok Değeri" value={formatCurrency(totalStockValue)} detail="Mevcut miktar x tüketim maliyeti" />
        <KpiCard compact label="Tükenen Ürün" value={formatNumber(outOfStockItems.length)} detail="Stok miktarı 0 veya altında" />
        <KpiCard compact label="Bu Ay Kayıp" value={formatCurrency(thisMonthWasteCost)} detail={`${formatNumber(thisMonthWasteRecords.length)} kayıp kaydı`} />
        <KpiCard compact label="Riskli Üretim Tanımı Sayısı" value={formatNumber(riskyRecipes.length)} detail="Kritik, geçerlilik veya maliyet riski" />
      </div>

      <section className="stock-risk-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Kritik Stoklar</h3>
              <p className="muted">İlk 10 kritik ürün mevcut miktar ve minimum seviyeye göre sıralanır.</p>
            </div>
            <span className={`status-pill ${criticalRows.length > 0 ? 'warning-pill' : 'success'}`}>
              {formatNumber(criticalRows.length)} kritik
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table stock-risk-critical-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Mevcut Miktar</th>
                  <th>Minimum Seviye</th>
                  <th>Eksik Miktar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {criticalRows.length === 0 && <tr><td className="empty-cell" colSpan={5}>Kritik stok bulunmuyor.</td></tr>}
                {criticalRows.slice(0, 10).map(row => (
                  <tr key={row.item.id}>
                    <td><strong>{row.item.name}</strong><div className="muted small-text">{getStockCategoryName(stockCategoryMap, row.item)}</div></td>
                    <td>{formatStockQuantity(row.currentQty, row.item.unit)}</td>
                    <td>{formatStockQuantity(row.minQty, row.item.unit)}</td>
                    <td>{formatStockQuantity(row.shortage, row.item.unit)}</td>
                    <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Geçerlilik Risk Merkezi</h3>
              <p className="muted">Yaklaşan, geçmiş ve riskli lotlar seçili tarih aralığına göre listelenir.</p>
            </div>
            <span className={`status-pill ${expiryRows.length > 0 ? 'danger-pill' : 'success'}`}>
              {formatNumber(expiryRows.length)} lot
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table stock-risk-expiry-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Lot</th>
                  <th>Geçerlilik</th>
                  <th>Kalan Gün</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {expiryRows.length === 0 && <tr><td className="empty-cell" colSpan={5}>Geçerlilik riski olan lot bulunmuyor.</td></tr>}
                {expiryRows.slice(0, 12).map(row => (
                  <tr key={row.lot.id}>
                    <td><strong>{row.lot.stockItemName}</strong><div className="muted small-text">{row.item ? getStockCategoryName(stockCategoryMap, row.item) : '-'}</div></td>
                    <td>{row.lot.lotCode}</td>
                    <td>{formatExpiryDate(row.lot.expiryDate)}</td>
                    <td>{row.daysUntilExpiry === null ? '-' : formatNumber(row.daysUntilExpiry)}</td>
                    <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="stock-risk-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Kayıp Analizi</h3>
              <p className="muted">En çok kayıp veren ürünler miktar, maliyet ve işlem sayısıyla izlenir.</p>
            </div>
            <span className="status-pill warning-pill">{formatCurrency(wasteRows.reduce((sum, row) => sum + row.cost, 0))}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table stock-risk-waste-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Kayıp Miktarı</th>
                  <th>Kayıp Maliyeti</th>
                  <th>İşlem Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {wasteRows.length === 0 && <tr><td className="empty-cell" colSpan={4}>Seçili aralıkta kayıp kaydı yok.</td></tr>}
                {wasteRows.slice(0, 10).map(row => (
                  <tr key={row.stockItemId}>
                    <td><strong>{row.stockItemName}</strong></td>
                    <td>{formatStockQuantity(row.qty, row.unit)}</td>
                    <td>{formatCurrency(row.cost)}</td>
                    <td>{formatNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Stok Hareket Özeti</h3>
              <p className="muted">Giriş, çıkış, kayıp ve net değişim maliyet etkisine göre özetlenir.</p>
            </div>
            <span className={`status-pill ${movementSummary.netValue >= 0 ? 'success' : 'danger-pill'}`}>
              Net {formatCurrency(movementSummary.netValue)}
            </span>
          </div>
          <div className="financial-summary-values stock-risk-movement-values">
            <div>
              <span>Giriş</span>
              <strong>{formatCurrency(movementSummary.entryValue)}</strong>
              <p className="muted small-text">{formatNumber(movementSummary.entryCount)} işlem</p>
            </div>
            <div>
              <span>Çıkış</span>
              <strong>{formatCurrency(movementSummary.exitValue)}</strong>
              <p className="muted small-text">{formatNumber(movementSummary.exitCount)} işlem</p>
            </div>
            <div>
              <span>Kayıp</span>
              <strong>{formatCurrency(movementSummary.wasteValue)}</strong>
              <p className="muted small-text">{formatNumber(movementSummary.wasteCount)} kayıp hareketi</p>
            </div>
            <div>
              <span>Net Değişim</span>
              <strong>{formatCurrency(movementSummary.netValue)}</strong>
              <p className="muted small-text">{range.label}</p>
            </div>
          </div>
        </section>
      </section>

      <section className="stock-risk-list-grid">
        <RiskList
          title="Tükenmek Üzere Olanlar"
          items={riskListItems.almostOut}
          emptyText="Tükenmek üzere olan stok kalemi yok."
        />
        <RiskList
          title="Kritik Stoklar"
          items={riskListItems.critical}
          emptyText="Kritik stok riski bulunmuyor."
        />
        <RiskList
          title="Geçerlilik Riski Olanlar"
          items={riskListItems.expiry}
          emptyText="Yaklaşan veya geçmiş geçerlilik riski yok."
        />
        <RiskList
          title="Yüksek Kayıplı Ürünler"
          items={riskListItems.waste}
          emptyText="Seçili aralıkta yüksek kayıp kaydı yok."
        />
        <RiskList
          title="Riskli Üretim Tanımları"
          items={riskListItems.recipes}
          emptyText="Kritik üretim tanımı bileşeni bulunmuyor."
        />
      </section>
    </div>
  )
}
