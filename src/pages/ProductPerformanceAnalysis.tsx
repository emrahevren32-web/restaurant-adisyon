import React from 'react'
import { ClosedBill, Order, Product, ProductCategory, Recipe, StockItem } from '../types'
import {
  loadCategories,
  loadClosed,
  loadProducts,
  loadRecipes,
  loadStockItems
} from '../storage'
import { formatCurrency, getOrderUnitPrice, isRevenueBill, roundCurrency } from '../billing'
import { isCriticalStock } from '../criticalStock'
import {
  formatNutritionValue,
  formatProductAllergens,
  hasNutritionInfo
} from '../productNutrition'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type ProductPerformanceRow = {
  product: Product
  categoryName: string
  salesQty: number
  revenue: number
  orderCount: number
  averageSaleAmount: number
  estimatedRecipeCost: number
  estimatedGrossProfit: number
  lastSaleDate: string
  previousSalesQty: number
}

type CategoryPerformanceRow = {
  categoryId: string
  categoryName: string
  productCount: number
  salesQty: number
  revenue: number
  sharePercent: number
}

type ProductRiskItem = {
  productName: string
  detail: string
  value: React.ReactNode
}

const LOW_SALES_THRESHOLD = 2

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

const addDays = (dateKey: string, dayCount: number) => {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + dayCount)
  return getLocalDateKey(date)
}

const getDaysBetween = (startDate: string, endDate: string) => {
  if(!startDate || !endDate) return 0

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
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

const getPreviousRange = (startDate: string, endDate: string) => {
  const dayCount = getDaysBetween(startDate, endDate)
  if(dayCount <= 0) return { startDate: '', endDate: '' }

  const previousEndDate = addDays(startDate, -1)
  return {
    startDate: addDays(previousEndDate, -(dayCount - 1)),
    endDate: previousEndDate
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')
const sumMoney = (values: number[]) => roundCurrency(values.reduce((sum, value) => sum + value, 0))

const getBillDateKey = (bill: ClosedBill) => getLocalDateKey(bill.timestamp)

const getRangeBills = (bills: ClosedBill[], startDate: string, endDate: string) => {
  return bills.filter(bill => isDateInRange(getBillDateKey(bill), startDate, endDate))
}

const getProductCategoryName = (categoryMap: Map<string, ProductCategory>, product: Product) => {
  return categoryMap.get(product.categoryId)?.name || 'Kategori yok'
}

const getActiveRecipeMap = (recipes: Recipe[]) => {
  const map = new Map<string, Recipe>()

  recipes
    .filter(recipe => recipe.active && !recipe.deletedAt)
    .sort((first, second) => (second.recipeVersion || second.version || 0) - (first.recipeVersion || first.version || 0))
    .forEach(recipe => {
      if(!map.has(recipe.productId)) map.set(recipe.productId, recipe)
    })

  return map
}

const getOrderBaseTotal = (order: Order, products: Product[]) => {
  if(order.isGift) return 0
  return roundCurrency(getOrderUnitPrice(order, products) * Math.max(0, Number(order.qty) || 0))
}

const getBillOrderLines = (bill: ClosedBill, products: Product[]) => {
  const baseTotals = bill.orders.map(order => getOrderBaseTotal(order, products))
  const billSubtotal = baseTotals.reduce((sum, value) => sum + value, 0)

  return bill.orders.map((order, index) => {
    const qty = order.isGift ? 0 : Math.max(0, Number(order.qty) || 0)
    const baseTotal = baseTotals[index]
    const revenue = billSubtotal > 0
      ? roundCurrency((baseTotal / billSubtotal) * bill.total)
      : baseTotal

    return {
      order,
      qty,
      revenue
    }
  }).filter(line => line.qty > 0)
}

const buildSalesMap = (bills: ClosedBill[], products: Product[]) => {
  return bills.reduce<Map<string, {
    salesQty: number
    revenue: number
    orderCount: number
    lastSaleDate: string
  }>>((map, bill) => {
    getBillOrderLines(bill, products).forEach(line => {
      const current = map.get(line.order.productId) || {
        salesQty: 0,
        revenue: 0,
        orderCount: 0,
        lastSaleDate: ''
      }
      const billDate = getBillDateKey(bill)

      current.salesQty += line.qty
      current.revenue = roundCurrency(current.revenue + line.revenue)
      current.orderCount += 1
      current.lastSaleDate = current.lastSaleDate && current.lastSaleDate > billDate ? current.lastSaleDate : billDate
      map.set(line.order.productId, current)
    })

    return map
  }, new Map())
}

const buildProductRows = ({
  products,
  categories,
  recipes,
  currentBills,
  previousBills,
  allBills
}: {
  products: Product[]
  categories: ProductCategory[]
  recipes: Recipe[]
  currentBills: ClosedBill[]
  previousBills: ClosedBill[]
  allBills: ClosedBill[]
}): ProductPerformanceRow[] => {
  const categoryMap = new Map(categories.map(category => [category.id, category]))
  const activeRecipeMap = getActiveRecipeMap(recipes)
  const currentSalesMap = buildSalesMap(currentBills, products)
  const previousSalesMap = buildSalesMap(previousBills, products)
  const allSalesMap = buildSalesMap(allBills, products)

  return products.map(product => {
    const currentSales = currentSalesMap.get(product.id)
    const previousSales = previousSalesMap.get(product.id)
    const allSales = allSalesMap.get(product.id)
    const recipeCost = activeRecipeMap.get(product.id)?.costSnapshot?.totalCost || 0
    const salesQty = currentSales?.salesQty || 0
    const revenue = currentSales?.revenue || 0
    const estimatedRecipeCost = roundCurrency(recipeCost * salesQty)

    return {
      product,
      categoryName: getProductCategoryName(categoryMap, product),
      salesQty,
      revenue,
      orderCount: currentSales?.orderCount || 0,
      averageSaleAmount: salesQty > 0 ? roundCurrency(revenue / salesQty) : 0,
      estimatedRecipeCost,
      estimatedGrossProfit: roundCurrency(revenue - estimatedRecipeCost),
      lastSaleDate: allSales?.lastSaleDate || '',
      previousSalesQty: previousSales?.salesQty || 0
    }
  })
}

const buildCategoryRows = (rows: ProductPerformanceRow[], categories: ProductCategory[]) => {
  const totalRevenue = sumMoney(rows.map(row => row.revenue))
  const categoryMap = new Map(categories.map(category => [category.id, category]))
  const groupedRows = new Map<string, CategoryPerformanceRow>()

  rows.forEach(row => {
    const categoryId = row.product.categoryId
    const current = groupedRows.get(categoryId) || {
      categoryId,
      categoryName: categoryMap.get(categoryId)?.name || row.categoryName,
      productCount: 0,
      salesQty: 0,
      revenue: 0,
      sharePercent: 0
    }

    current.productCount += 1
    current.salesQty += row.salesQty
    current.revenue = roundCurrency(current.revenue + row.revenue)
    groupedRows.set(categoryId, current)
  })

  return Array.from(groupedRows.values())
    .map(row => ({
      ...row,
      sharePercent: totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 100) : 0
    }))
    .sort((first, second) => {
      const revenueDiff = second.revenue - first.revenue
      if(revenueDiff !== 0) return revenueDiff
      return first.categoryName.localeCompare(second.categoryName, 'tr-TR')
    })
}

const sortByProductName = (first: ProductPerformanceRow, second: ProductPerformanceRow) => {
  return first.product.name.localeCompare(second.product.name, 'tr-TR')
}

const getTopProduct = (rows: ProductPerformanceRow[], getValue: (row: ProductPerformanceRow) => number) => {
  return [...rows].sort((first, second) => {
    const diff = getValue(second) - getValue(first)
    if(diff !== 0) return diff
    return sortByProductName(first, second)
  })[0]
}

const getRecipeStockRiskDetail = ({
  productId,
  recipeMap,
  stockItemMap
}: {
  productId: string
  recipeMap: Map<string, Recipe>
  stockItemMap: Map<string, StockItem>
}) => {
  const recipe = recipeMap.get(productId)
  if(!recipe) return 'Aktif reçete yok'

  const criticalItems = recipe.items.filter(item => {
    const stockItem = stockItemMap.get(item.stockItemId)
    return stockItem ? isCriticalStock(stockItem) : false
  })

  if(criticalItems.length > 0) return `${formatNumber(criticalItems.length)} kritik stok bileşeni`
  if((recipe.costSnapshot?.missingCostItemCount || 0) > 0) return `${formatNumber(recipe.costSnapshot?.missingCostItemCount || 0)} maliyet eksiği`
  return `Tahmini maliyet ${formatCurrency(recipe.costSnapshot?.totalCost || 0)}`
}

const getNoSaleDayCount = (lastSaleDate: string, todayKey: string) => {
  if(!lastSaleDate) return Number.POSITIVE_INFINITY
  return getDaysBetween(addDays(lastSaleDate, 1), todayKey)
}

const toRiskItems = (rows: ProductPerformanceRow[], todayKey: string, recipeMap: Map<string, Recipe>, stockItemMap: Map<string, StockItem>) => {
  const lowSellingItems: ProductRiskItem[] = rows
    .filter(row => row.salesQty > 0 && row.salesQty <= LOW_SALES_THRESHOLD)
    .sort((first, second) => first.salesQty - second.salesQty || first.revenue - second.revenue || sortByProductName(first, second))
    .slice(0, 5)
    .map(row => ({
      productName: row.product.name,
      detail: `${formatNumber(row.salesQty)} satış / ${getRecipeStockRiskDetail({ productId: row.product.id, recipeMap, stockItemMap })}`,
      value: formatCurrency(row.revenue)
    }))

  const noSale30Items: ProductRiskItem[] = rows
    .filter(row => getNoSaleDayCount(row.lastSaleDate, todayKey) >= 30)
    .sort((first, second) => {
      const firstDays = getNoSaleDayCount(first.lastSaleDate, todayKey)
      const secondDays = getNoSaleDayCount(second.lastSaleDate, todayKey)
      if(secondDays !== firstDays) return secondDays - firstDays
      return sortByProductName(first, second)
    })
    .slice(0, 5)
    .map(row => {
      const dayCount = getNoSaleDayCount(row.lastSaleDate, todayKey)
      return {
        productName: row.product.name,
        detail: row.lastSaleDate ? `Son satış ${row.lastSaleDate}` : 'Hiç satış almadı',
        value: Number.isFinite(dayCount) ? `${formatNumber(dayCount)} gün` : 'Yok'
      }
    })

  const decliningItems: ProductRiskItem[] = rows
    .filter(row => row.previousSalesQty > 0 && row.salesQty < row.previousSalesQty)
    .sort((first, second) => (second.previousSalesQty - second.salesQty) - (first.previousSalesQty - first.salesQty) || sortByProductName(first, second))
    .slice(0, 5)
    .map(row => ({
      productName: row.product.name,
      detail: `Önceki ${formatNumber(row.previousSalesQty)} / mevcut ${formatNumber(row.salesQty)}`,
      value: `-${formatNumber(row.previousSalesQty - row.salesQty)}`
    }))

  return {
    lowSellingItems,
    noSale30Items,
    decliningItems
  }
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

function RiskList({ title, items, emptyText }: { title: string; items: ProductRiskItem[]; emptyText: string }){
  return (
    <section className="card product-risk-card">
      <div className="section-header compact">
        <h3>{title}</h3>
        <span className={`status-pill ${items.length > 0 ? 'warning-pill' : 'success'}`}>
          {items.length > 0 ? `${formatNumber(items.length)} ürün` : 'Temiz'}
        </span>
      </div>
      <div className="current-report-mini-list">
        {items.length === 0 && <p className="muted">{emptyText}</p>}
        {items.map(item => (
          <div className="current-report-mini-row" key={item.productName}>
            <div>
              <strong>{item.productName}</strong>
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

export default function ProductPerformanceAnalysis(){
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [categories] = React.useState<ProductCategory[]>(() => loadCategories())
  const [closedBills] = React.useState<ClosedBill[]>(() => loadClosed())
  const [recipes] = React.useState<Recipe[]>(() => loadRecipes())
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])
  const previousRange = React.useMemo(() => getPreviousRange(range.startDate, range.endDate), [range.endDate, range.startDate])
  const revenueBills = React.useMemo(() => closedBills.filter(isRevenueBill), [closedBills])
  const currentBills = React.useMemo(() => getRangeBills(revenueBills, range.startDate, range.endDate), [range.endDate, range.startDate, revenueBills])
  const previousBills = React.useMemo(() => getRangeBills(revenueBills, previousRange.startDate, previousRange.endDate), [previousRange.endDate, previousRange.startDate, revenueBills])
  const activeRecipeMap = React.useMemo(() => getActiveRecipeMap(recipes), [recipes])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])

  const productRows = React.useMemo(() => buildProductRows({
    products,
    categories,
    recipes,
    currentBills,
    previousBills,
    allBills: revenueBills
  }), [categories, currentBills, previousBills, products, recipes, revenueBills])
  const categoryRows = React.useMemo(() => buildCategoryRows(productRows, categories), [categories, productRows])

  const soldProductRows = productRows.filter(row => row.salesQty > 0)
  const noSaleProductRows = productRows.filter(row => row.salesQty === 0)
  const topSellingRows = [...soldProductRows]
    .sort((first, second) => second.salesQty - first.salesQty || second.revenue - first.revenue || sortByProductName(first, second))
    .slice(0, 10)
  const topRevenueRows = [...soldProductRows]
    .sort((first, second) => second.revenue - first.revenue || second.salesQty - first.salesQty || sortByProductName(first, second))
    .slice(0, 10)
  const leastSellingRows = [...soldProductRows]
    .sort((first, second) => first.salesQty - second.salesQty || first.revenue - second.revenue || sortByProductName(first, second))
    .slice(0, 10)
  const totalSalesQty = productRows.reduce((sum, row) => sum + row.salesQty, 0)
  const totalRevenue = sumMoney(productRows.map(row => row.revenue))
  const topSellingProduct = getTopProduct(soldProductRows, row => row.salesQty)
  const topRevenueProduct = getTopProduct(soldProductRows, row => row.revenue)
  const mostActiveCategory = [...categoryRows].sort((first, second) => {
    const salesDiff = second.salesQty - first.salesQty
    if(salesDiff !== 0) return salesDiff
    return second.revenue - first.revenue
  })[0]
  const riskItems = React.useMemo(() => toRiskItems(productRows, todayKey, activeRecipeMap, stockItemMap), [activeRecipeMap, productRows, stockItemMap, todayKey])
  const nutritionInfoProducts = React.useMemo(() => products.filter(product => hasNutritionInfo(product)), [products])
  const allergenProducts = React.useMemo(() => products.filter(product => product.allergens.length > 0), [products])
  const allergenFreeProducts = React.useMemo(() => products.filter(product => product.allergens.length === 0), [products])
  const nutritionReportRows = React.useMemo(() => {
    return [...products]
      .sort((first, second) => second.calories - first.calories || first.name.localeCompare(second.name, 'tr-TR'))
      .slice(0, 12)
  }, [products])

  return (
    <div className="product-performance-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Ürün Performans Analizleri</h2>
          <p className="muted">Ürün satış ve performans verilerini analiz edin.</p>
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
            <p className="muted">Seçili tarih aralığı değiştiğinde tüm ürün, kategori ve risk analizleri güncellenir.</p>
          </div>
          <div className="toolbar-controls product-performance-filters">
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
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Ürün" value={formatNumber(products.length)} detail={`${formatNumber(products.filter(product => product.active).length)} aktif ürün`} />
        <KpiCard label="Satış Yapan Ürün" value={formatNumber(soldProductRows.length)} detail={`${formatNumber(noSaleProductRows.length)} ürün satış almadı`} />
        <KpiCard label="En Çok Satan Ürün" value={topSellingProduct?.product.name || '-'} detail={topSellingProduct ? `${formatNumber(topSellingProduct.salesQty)} satış` : 'Kayıt yok'} />
        <KpiCard label="En Çok Kazandıran Ürün" value={topRevenueProduct?.product.name || '-'} detail={topRevenueProduct ? formatCurrency(topRevenueProduct.revenue) : 'Kayıt yok'} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid product-performance-extra-grid">
        <KpiCard compact label="Toplam Satış Adedi" value={formatNumber(totalSalesQty)} detail={range.label} />
        <KpiCard compact label="Toplam Ürün Cirosu" value={formatCurrency(totalRevenue)} detail={`${formatNumber(currentBills.length)} kapanan adisyon`} />
        <KpiCard compact label="En Aktif Kategori" value={mostActiveCategory?.categoryName || '-'} detail={mostActiveCategory ? `${formatNumber(mostActiveCategory.salesQty)} satış` : 'Kayıt yok'} />
        <KpiCard compact label="Satış Yapmayan Ürün" value={formatNumber(noSaleProductRows.length)} detail={`${formatNumber(products.length)} toplam ürün`} />
        <KpiCard compact label="Besin Bilgili Ürün" value={formatNumber(nutritionInfoProducts.length)} detail={`${formatNumber(products.length)} toplam ürün`} />
        <KpiCard compact label="Alerjen İçermez" value={formatNumber(allergenFreeProducts.length)} detail={`${formatNumber(allergenProducts.length)} alerjenli ürün`} />
      </div>

      <section className="card product-nutrition-report-card">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Besin ve Alerjen Özeti</h3>
            <p className="muted">Ürün detayında tanımlanan besin değerleri ve alerjen etiketleri.</p>
          </div>
          <span className="status-pill info-pill">{formatNumber(nutritionReportRows.length)} ürün</span>
        </div>
        <div className="table-wrap">
          <table className="data-table product-nutrition-report-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Porsiyon</th>
                <th>Kalori</th>
                <th>Protein / Karbonhidrat / Yağ</th>
                <th>Alerjenler</th>
              </tr>
            </thead>
            <tbody>
              {nutritionReportRows.length === 0 && <tr><td className="empty-cell" colSpan={5}>Ürün kaydı yok.</td></tr>}
              {nutritionReportRows.map(product => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong></td>
                  <td>{product.servingSize || '-'}</td>
                  <td>{formatNutritionValue(product.calories, 'kcal')}</td>
                  <td>
                    {formatNutritionValue(product.protein, 'g')} / {formatNutritionValue(product.carbohydrate, 'g')} / {formatNutritionValue(product.fat, 'g')}
                  </td>
                  <td>{formatProductAllergens(product.allergens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="product-performance-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>En Çok Satan Ürünler</h3>
              <p className="muted">İlk 10 ürün satış adedine göre sıralanır.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(topSellingRows.length)} ürün</span>
          </div>
          <div className="table-wrap">
            <table className="data-table product-performance-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Satış Adedi</th>
                  <th>Ciro</th>
                  <th>Sipariş Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {topSellingRows.length === 0 && <tr><td className="empty-cell" colSpan={4}>Satış kaydı yok.</td></tr>}
                {topSellingRows.map(row => (
                  <tr key={row.product.id}>
                    <td><strong>{row.product.name}</strong><div className="muted small-text">{row.categoryName}</div></td>
                    <td>{formatNumber(row.salesQty)}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>{formatNumber(row.orderCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>En Çok Kazandıran Ürünler</h3>
              <p className="muted">İlk 10 ürün toplam ciroya göre sıralanır.</p>
            </div>
            <span className="status-pill success">{formatCurrency(topRevenueRows.reduce((sum, row) => sum + row.revenue, 0))}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table product-performance-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Toplam Ciro</th>
                  <th>Satış Adedi</th>
                  <th>Ortalama Satış Tutarı</th>
                </tr>
              </thead>
              <tbody>
                {topRevenueRows.length === 0 && <tr><td className="empty-cell" colSpan={4}>Satış kaydı yok.</td></tr>}
                {topRevenueRows.map(row => (
                  <tr key={row.product.id}>
                    <td>
                      <strong>{row.product.name}</strong>
                      <div className="muted small-text">
                        Tahmini brüt kazanç {formatCurrency(row.estimatedGrossProfit)}
                      </div>
                    </td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>{formatNumber(row.salesQty)}</td>
                    <td>{formatCurrency(row.averageSaleAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="product-performance-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>En Az Satan Ürünler</h3>
              <p className="muted">Satış alan ürünler içinde son 10 ürün.</p>
            </div>
            <span className="status-pill warning-pill">{formatNumber(leastSellingRows.length)} ürün</span>
          </div>
          <div className="table-wrap">
            <table className="data-table product-performance-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Satış Adedi</th>
                  <th>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {leastSellingRows.length === 0 && <tr><td className="empty-cell" colSpan={3}>Satış kaydı yok.</td></tr>}
                {leastSellingRows.map(row => (
                  <tr key={row.product.id}>
                    <td><strong>{row.product.name}</strong><div className="muted small-text">{row.categoryName}</div></td>
                    <td>{formatNumber(row.salesQty)}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Kategori Analizi</h3>
              <p className="muted">Kategori bazında ürün sayısı, satış ve ciro payı.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(categoryRows.length)} kategori</span>
          </div>
          <div className="table-wrap">
            <table className="data-table product-category-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Ürün Sayısı</th>
                  <th>Satış Adedi</th>
                  <th>Toplam Ciro</th>
                  <th>Kategori Payı %</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.length === 0 && <tr><td className="empty-cell" colSpan={5}>Kategori verisi yok.</td></tr>}
                {categoryRows.map(row => (
                  <tr key={row.categoryId}>
                    <td><strong>{row.categoryName}</strong></td>
                    <td>{formatNumber(row.productCount)}</td>
                    <td>{formatNumber(row.salesQty)}</td>
                    <td>{formatCurrency(row.revenue)}</td>
                    <td>%{formatNumber(row.sharePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Satış Yapmayan Ürünler</h3>
            <p className="muted">Seçili aralıkta hiç sipariş almamış ürünler.</p>
          </div>
          <span className={`status-pill ${noSaleProductRows.length > 0 ? 'warning-pill' : 'success'}`}>
            {formatNumber(noSaleProductRows.length)} ürün
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table product-no-sale-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Kategori</th>
                <th>Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {noSaleProductRows.length === 0 && <tr><td className="empty-cell" colSpan={3}>Seçili aralıkta satış yapmayan ürün yok.</td></tr>}
              {noSaleProductRows.slice(0, 15).map(row => (
                <tr key={row.product.id}>
                  <td><strong>{row.product.name}</strong></td>
                  <td>{row.categoryName}</td>
                  <td>{formatCurrency(row.product.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="product-risk-grid">
        <RiskList
          title="Düşük Satışlı Ürünler"
          items={riskItems.lowSellingItems}
          emptyText="Düşük satış eşiğinde ürün bulunmuyor."
        />
        <RiskList
          title="30 Gündür Satış Almayan Ürünler"
          items={riskItems.noSale30Items}
          emptyText="Son 30 gün içinde satış almayan ürün bulunmuyor."
        />
        <RiskList
          title="Satış Düşüşü Yaşayan Ürünler"
          items={riskItems.decliningItems}
          emptyText="Önceki aralığa göre satış düşüşü yok."
        />
      </section>
    </div>
  )
}
