import React from 'react'
import { calculateOrderOriginalTotal, calculateProratedDiscountTotal, calculateSubtotal, formatCurrency, isRevenueBill, roundCurrency } from '../../billing'
import { calculateRecipeCost } from '../RecipeForm'
import { ClosedBill, Product, ProductCategory, Recipe, StockItem } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type ProductProfitabilitySortKey = 'salesQty' | 'salesRevenue' | 'totalCost' | 'grossProfit' | 'profitMargin'
export type ProductProfitabilitySortDirection = 'asc' | 'desc'

type SaleEvent = {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  salesQty: number
  salesRevenue: number
  unitRecipeCost: number
  totalCost: number
  saleDate: string
  saleTime: number
}

export type ProductProfitabilityReportRow = {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  salesQty: number
  salesRevenue: number
  totalCost: number
  grossProfit: number
  profitMargin: number
  lastSaleDate?: string
  lastSaleLabel: string
}

export type ProductProfitabilityReportResult = {
  rows: ProductProfitabilityReportRow[]
  kpis: ReportKpi[]
}

type UseProductProfitabilityReportArgs = {
  closedBills: ClosedBill[]
  products: Product[]
  productCategories: ProductCategory[]
  recipes: Recipe[]
  stockItems: StockItem[]
  filters: ReportFiltersValue
  sortKey: ProductProfitabilitySortKey
  sortDirection: ProductProfitabilitySortDirection
}

type ProductProfitabilityReportProps = {
  report: ProductProfitabilityReportResult
  sortKey: ProductProfitabilitySortKey
  sortDirection: ProductProfitabilitySortDirection
  onSortKeyChange: (sortKey: ProductProfitabilitySortKey) => void
  onSortDirectionChange: (sortDirection: ProductProfitabilitySortDirection) => void
}

const sortOptions: { value: ProductProfitabilitySortKey; label: string }[] = [
  { value: 'salesQty', label: 'Satış adedine göre' },
  { value: 'salesRevenue', label: 'Satış gelirine göre' },
  { value: 'totalCost', label: 'Toplam maliyete göre' },
  { value: 'grossProfit', label: 'Brüt kara göre' },
  { value: 'profitMargin', label: 'Kar marjına göre' }
]

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

const formatPercent = (value: number) => {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const getDateKey = (value?: string) => {
  if(!value) return ''

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('sv-SE')
}

const getTime = (value?: string) => {
  if(!value) return 0

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

const formatDateTime = (value?: string) => {
  if(!value) return '-'

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

const buildProductMap = (products: Product[]) => {
  return new Map(products.map(product => [product.id, product]))
}

const buildCategoryMap = (categories: ProductCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const buildRecipeCostMap = (recipes: Recipe[], stockItems: StockItem[]) => {
  const activeRecipes = recipes
    .filter(recipe => recipe.active && !recipe.deletedAt)
    .sort((first, second) => {
      const firstUpdated = getTime(first.updatedAt || first.createdAt)
      const secondUpdated = getTime(second.updatedAt || second.createdAt)
      return second.recipeVersion - first.recipeVersion || secondUpdated - firstUpdated
    })

  return activeRecipes.reduce<Map<string, number>>((acc, recipe) => {
    if(acc.has(recipe.productId)) return acc

    const snapshotCost = Number(recipe.costSnapshot?.totalCost)
    const recipeCost = Number.isFinite(snapshotCost) && snapshotCost >= 0
      ? snapshotCost
      : calculateRecipeCost(recipe.items, stockItems).totalCost

    acc.set(recipe.productId, roundCurrency(recipeCost))
    return acc
  }, new Map())
}

const getBillDiscountForLine = (bill: ClosedBill, lineOriginalTotal: number, billSubtotal: number) => {
  if(lineOriginalTotal <= 0 || billSubtotal <= 0) return 0

  if(bill.discount){
    return calculateProratedDiscountTotal(bill.discount, lineOriginalTotal, billSubtotal)
  }

  const discountTotal = Number(bill.discountTotal)
  if(Number.isFinite(discountTotal) && discountTotal > 0){
    return roundCurrency(Math.min(lineOriginalTotal, discountTotal * (lineOriginalTotal / billSubtotal)))
  }

  return 0
}

const matchesDateFilters = (saleDate: string, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const dateKey = getDateKey(saleDate)
  if(!dateKey) return false

  if(filters.startDate && dateKey < filters.startDate) return false
  if(filters.endDate && dateKey > filters.endDate) return false

  return true
}

const buildSaleEvents = ({
  closedBills,
  products,
  productCategories,
  recipes,
  stockItems
}: Pick<UseProductProfitabilityReportArgs, 'closedBills' | 'products' | 'productCategories' | 'recipes' | 'stockItems'>) => {
  const productMap = buildProductMap(products)
  const categoryMap = buildCategoryMap(productCategories)
  const recipeCostMap = buildRecipeCostMap(recipes, stockItems)

  return closedBills.flatMap<SaleEvent>(bill => {
    if(!isRevenueBill(bill)) return []

    const billSubtotal = calculateSubtotal(bill.orders, products)

    return bill.orders
      .filter(order => !order.isGift)
      .map<SaleEvent | undefined>(order => {
        const salesQty = Number(order.qty)
        if(!Number.isFinite(salesQty) || salesQty <= 0) return undefined

        const product = productMap.get(order.productId)
        const category = product ? categoryMap.get(product.categoryId) : undefined
        const lineOriginalTotal = calculateOrderOriginalTotal(order, products)
        if(lineOriginalTotal <= 0) return undefined

        const lineDiscount = getBillDiscountForLine(bill, lineOriginalTotal, billSubtotal)
        const salesRevenue = roundCurrency(Math.max(0, lineOriginalTotal - lineDiscount))
        const unitRecipeCost = recipeCostMap.get(order.productId) || 0
        const totalCost = roundCurrency(unitRecipeCost * salesQty)

        return {
          productId: order.productId,
          productName: product?.name || order.productName || 'Ürün',
          categoryId: product?.categoryId || '',
          categoryName: category?.name || 'Kategori yok',
          salesQty,
          salesRevenue,
          unitRecipeCost,
          totalCost,
          saleDate: bill.timestamp,
          saleTime: getTime(bill.timestamp)
        }
      })
      .filter((event): event is SaleEvent => Boolean(event))
  })
}

const applyFilters = (events: SaleEvent[], filters: ReportFiltersValue) => {
  const searchText = normalizeText(filters.search)

  return events
    .filter(event => matchesDateFilters(event.saleDate, filters))
    .filter(event => filters.categoryId === 'all' || event.categoryId === filters.categoryId)
    .filter(event => filters.stockItemId === 'all' || event.productId === filters.stockItemId)
    .filter(event => {
      if(!searchText) return true

      return normalizeText(event.productName).includes(searchText)
        || normalizeText(event.categoryName).includes(searchText)
    })
}

const buildRows = (events: SaleEvent[]) => {
  const rowMap = events.reduce<Map<string, ProductProfitabilityReportRow>>((acc, event) => {
    const existing = acc.get(event.productId)

    if(existing){
      const salesQty = existing.salesQty + event.salesQty
      const salesRevenue = roundCurrency(existing.salesRevenue + event.salesRevenue)
      const totalCost = roundCurrency(existing.totalCost + event.totalCost)
      const grossProfit = roundCurrency(salesRevenue - totalCost)
      const profitMargin = salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0
      const isLatest = event.saleTime > getTime(existing.lastSaleDate)

      acc.set(event.productId, {
        ...existing,
        salesQty,
        salesRevenue,
        totalCost,
        grossProfit,
        profitMargin,
        lastSaleDate: isLatest ? event.saleDate : existing.lastSaleDate,
        lastSaleLabel: isLatest ? formatDateTime(event.saleDate) : existing.lastSaleLabel
      })
      return acc
    }

    const grossProfit = roundCurrency(event.salesRevenue - event.totalCost)

    acc.set(event.productId, {
      productId: event.productId,
      productName: event.productName,
      categoryId: event.categoryId,
      categoryName: event.categoryName,
      salesQty: event.salesQty,
      salesRevenue: event.salesRevenue,
      totalCost: event.totalCost,
      grossProfit,
      profitMargin: event.salesRevenue > 0 ? (grossProfit / event.salesRevenue) * 100 : 0,
      lastSaleDate: event.saleDate,
      lastSaleLabel: formatDateTime(event.saleDate)
    })

    return acc
  }, new Map())

  return [...rowMap.values()]
}

const compareRows = (
  first: ProductProfitabilityReportRow,
  second: ProductProfitabilityReportRow,
  sortKey: ProductProfitabilitySortKey,
  sortDirection: ProductProfitabilitySortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  const result = first[sortKey] - second[sortKey]
  const directedResult = result * directionMultiplier
  if(directedResult !== 0) return directedResult

  return first.productName.localeCompare(second.productName, 'tr-TR')
}

const buildKpis = (rows: ProductProfitabilityReportRow[]): ReportKpi[] => {
  const totalSalesRevenue = roundCurrency(rows.reduce((sum, row) => sum + row.salesRevenue, 0))
  const totalProductCost = roundCurrency(rows.reduce((sum, row) => sum + row.totalCost, 0))
  const totalGrossProfit = roundCurrency(totalSalesRevenue - totalProductCost)
  const averageProfitMargin = totalSalesRevenue > 0 ? (totalGrossProfit / totalSalesRevenue) * 100 : 0
  const mostProfitableProduct = [...rows].sort((first, second) => second.grossProfit - first.grossProfit || second.salesRevenue - first.salesRevenue)[0]
  const highestMarginProduct = [...rows].sort((first, second) => second.profitMargin - first.profitMargin || second.grossProfit - first.grossProfit)[0]

  return [
    { label: 'Toplam Satış Geliri', value: formatCurrency(totalSalesRevenue), detail: 'Filtrelenen ürün satışları' },
    { label: 'Toplam Ürün Maliyeti', value: formatCurrency(totalProductCost), detail: 'Reçete maliyeti x satış adedi' },
    { label: 'Toplam Brüt Kar', value: formatCurrency(totalGrossProfit), detail: 'Satış geliri - ürün maliyeti' },
    { label: 'Ortalama Kar Marjı %', value: formatPercent(averageProfitMargin), detail: 'Toplam brüt kar / toplam gelir' },
    {
      label: 'En Karlı Ürün',
      value: mostProfitableProduct?.productName || '-',
      detail: mostProfitableProduct ? formatCurrency(mostProfitableProduct.grossProfit) : 'Satış yok'
    },
    {
      label: 'En Yüksek Kar Marjlı Ürün',
      value: highestMarginProduct?.productName || '-',
      detail: highestMarginProduct ? formatPercent(highestMarginProduct.profitMargin) : 'Satış yok'
    }
  ]
}

export const useProductProfitabilityReport = (args: UseProductProfitabilityReportArgs): ProductProfitabilityReportResult => {
  return React.useMemo(() => {
    const events = applyFilters(buildSaleEvents(args), args.filters)
    const rows = buildRows(events).sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.closedBills,
    args.products,
    args.productCategories,
    args.recipes,
    args.stockItems,
    args.filters,
    args.sortKey,
    args.sortDirection
  ])
}

const csvEscape = (value: string | number | undefined) => {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

const csvLine = (values: Array<string | number | undefined>) => {
  return values.map(csvEscape).join(',')
}

const getFilterLabel = <T extends { id: string; name?: string }>(
  value: string,
  items: T[],
  fallback: string,
  nameGetter = (item: T) => item.name || item.id
) => {
  if(value === 'all') return fallback
  const selected = items.find(item => item.id === value)
  return selected ? nameGetter(selected) : fallback
}

const getSortLabel = (sortKey: ProductProfitabilitySortKey, sortDirection: ProductProfitabilitySortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Brüt kara göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportProductProfitabilityReportCsv = ({
  report,
  filters,
  productCategories,
  products,
  sortKey,
  sortDirection
}: {
  report: ProductProfitabilityReportResult
  filters: ReportFiltersValue
  productCategories: ProductCategory[]
  products: Product[]
  sortKey: ProductProfitabilitySortKey
  sortDirection: ProductProfitabilitySortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Ürün Karlılık Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, productCategories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, products, 'Tüm ürünler')]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine(['KPI Özeti']),
    ...report.kpis.map(kpi => csvLine([kpi.label, kpi.value, kpi.detail])),
    '',
    csvLine([
      'Ürün',
      'Kategori',
      'Satış Adedi',
      'Satış Geliri',
      'Toplam Maliyet',
      'Brüt Kar',
      'Kar Marjı %',
      'Son Satış Tarihi'
    ]),
    ...report.rows.map(row => csvLine([
      row.productName,
      row.categoryName,
      formatNumber(row.salesQty),
      formatCurrency(row.salesRevenue),
      formatCurrency(row.totalCost),
      formatCurrency(row.grossProfit),
      formatPercent(row.profitMargin),
      row.lastSaleLabel
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `urun-karlilik-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ProductProfitabilityReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: ProductProfitabilityReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Ürün Karlılık Raporu</h3>
          <p className="muted">Kapalı adisyonlardaki ürün satış gelirleri, reçete maliyeti ve brüt kar kırılımı.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} ürün listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as ProductProfitabilitySortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as ProductProfitabilitySortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table product-profitability-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Satış Adedi</th>
              <th>Satış Geliri</th>
              <th>Toplam Maliyet</th>
              <th>Brüt Kar</th>
              <th>Kar Marjı %</th>
              <th>Son Satış Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">Bu filtrelere uygun ürün karlılığı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.productId}>
                <td><strong>{row.productName}</strong></td>
                <td>{row.categoryName}</td>
                <td>{formatNumber(row.salesQty)}</td>
                <td>{formatCurrency(row.salesRevenue)}</td>
                <td>{formatCurrency(row.totalCost)}</td>
                <td>{formatCurrency(row.grossProfit)}</td>
                <td>{formatPercent(row.profitMargin)}</td>
                <td>{row.lastSaleLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
