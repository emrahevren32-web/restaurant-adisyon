import React from 'react'
import { calculateOrderOriginalTotal, formatCurrency, isRevenueBill, roundCurrency } from '../../billing'
import { calculateRecipeCost } from '../RecipeForm'
import { ClosedBill, Product, ProductCategory, Recipe, StockItem } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type TopSellingProductsSortKey = 'salesQty' | 'totalRevenue' | 'grossProfit' | 'salesShare'
export type TopSellingProductsSortDirection = 'asc' | 'desc'

type SaleEvent = {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  salesQty: number
  totalRevenue: number
  unitRecipeCost: number
  totalCost: number
  saleDate: string
}

export type TopSellingProductsReportRow = {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  salesQty: number
  totalRevenue: number
  averageUnitPrice: number
  totalCost: number
  grossProfit: number
  salesShare: number
}

export type TopSellingProductsSummary = {
  salesQty: number
  totalRevenue: number
  grossProfit: number
}

export type TopSellingProductsReportResult = {
  rows: TopSellingProductsReportRow[]
  kpis: ReportKpi[]
  topTenSummary: TopSellingProductsSummary
}

type UseTopSellingProductsReportArgs = {
  closedBills: ClosedBill[]
  products: Product[]
  productCategories: ProductCategory[]
  recipes: Recipe[]
  stockItems: StockItem[]
  filters: ReportFiltersValue
  sortKey: TopSellingProductsSortKey
  sortDirection: TopSellingProductsSortDirection
}

type TopSellingProductsReportProps = {
  report: TopSellingProductsReportResult
  sortKey: TopSellingProductsSortKey
  sortDirection: TopSellingProductsSortDirection
  onSortKeyChange: (sortKey: TopSellingProductsSortKey) => void
  onSortDirectionChange: (sortDirection: TopSellingProductsSortDirection) => void
}

const sortOptions: { value: TopSellingProductsSortKey; label: string }[] = [
  { value: 'salesQty', label: 'Satış adedine göre' },
  { value: 'totalRevenue', label: 'Toplam ciroya göre' },
  { value: 'grossProfit', label: 'Brüt kara göre' },
  { value: 'salesShare', label: 'Satış payına göre' }
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
}: Pick<UseTopSellingProductsReportArgs, 'closedBills' | 'products' | 'productCategories' | 'recipes' | 'stockItems'>) => {
  const productMap = buildProductMap(products)
  const categoryMap = buildCategoryMap(productCategories)
  const recipeCostMap = buildRecipeCostMap(recipes, stockItems)

  return closedBills.flatMap<SaleEvent>(bill => {
    if(!isRevenueBill(bill)) return []

    return bill.orders
      .filter(order => !order.isGift)
      .map<SaleEvent | undefined>(order => {
        const salesQty = Number(order.qty)
        if(!Number.isFinite(salesQty) || salesQty <= 0) return undefined

        const product = productMap.get(order.productId)
        const category = product ? categoryMap.get(product.categoryId) : undefined
        const totalRevenue = roundCurrency(calculateOrderOriginalTotal(order, products))
        if(totalRevenue <= 0) return undefined

        const unitRecipeCost = recipeCostMap.get(order.productId) || 0
        const totalCost = roundCurrency(unitRecipeCost * salesQty)

        return {
          productId: order.productId,
          productName: product?.name || order.productName || 'Ürün',
          categoryId: product?.categoryId || '',
          categoryName: category?.name || 'Kategori yok',
          salesQty,
          totalRevenue,
          unitRecipeCost,
          totalCost,
          saleDate: bill.timestamp
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
  const totalSalesQty = events.reduce((sum, event) => sum + event.salesQty, 0)
  const rowMap = events.reduce<Map<string, Omit<TopSellingProductsReportRow, 'salesShare' | 'averageUnitPrice' | 'grossProfit'>>>((acc, event) => {
    const existing = acc.get(event.productId)

    if(existing){
      acc.set(event.productId, {
        ...existing,
        salesQty: existing.salesQty + event.salesQty,
        totalRevenue: roundCurrency(existing.totalRevenue + event.totalRevenue),
        totalCost: roundCurrency(existing.totalCost + event.totalCost)
      })
      return acc
    }

    acc.set(event.productId, {
      productId: event.productId,
      productName: event.productName,
      categoryId: event.categoryId,
      categoryName: event.categoryName,
      salesQty: event.salesQty,
      totalRevenue: event.totalRevenue,
      totalCost: event.totalCost
    })

    return acc
  }, new Map())

  return [...rowMap.values()].map<TopSellingProductsReportRow>(row => {
    const grossProfit = roundCurrency(row.totalRevenue - row.totalCost)

    return {
      ...row,
      averageUnitPrice: row.salesQty > 0 ? roundCurrency(row.totalRevenue / row.salesQty) : 0,
      grossProfit,
      salesShare: totalSalesQty > 0 ? (row.salesQty / totalSalesQty) * 100 : 0
    }
  })
}

const compareRows = (
  first: TopSellingProductsReportRow,
  second: TopSellingProductsReportRow,
  sortKey: TopSellingProductsSortKey,
  sortDirection: TopSellingProductsSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  const result = (first[sortKey] - second[sortKey]) * directionMultiplier
  if(result !== 0) return result

  return first.productName.localeCompare(second.productName, 'tr-TR')
}

const getTopRowsBySalesQty = (rows: TopSellingProductsReportRow[]) => {
  return [...rows]
    .sort((first, second) => second.salesQty - first.salesQty || second.totalRevenue - first.totalRevenue || first.productName.localeCompare(second.productName, 'tr-TR'))
    .slice(0, 10)
}

const buildTopTenSummary = (rows: TopSellingProductsReportRow[]): TopSellingProductsSummary => {
  const topTenRows = getTopRowsBySalesQty(rows)

  return {
    salesQty: topTenRows.reduce((sum, row) => sum + row.salesQty, 0),
    totalRevenue: roundCurrency(topTenRows.reduce((sum, row) => sum + row.totalRevenue, 0)),
    grossProfit: roundCurrency(topTenRows.reduce((sum, row) => sum + row.grossProfit, 0))
  }
}

const buildKpis = (rows: TopSellingProductsReportRow[], topTenSummary: TopSellingProductsSummary): ReportKpi[] => {
  const totalSalesQty = rows.reduce((sum, row) => sum + row.salesQty, 0)
  const soldProductCount = rows.length
  const topSellingProduct = getTopRowsBySalesQty(rows)[0]
  const highestRevenueProduct = [...rows].sort((first, second) => second.totalRevenue - first.totalRevenue || second.salesQty - first.salesQty)[0]
  const averageSalesQty = soldProductCount > 0 ? totalSalesQty / soldProductCount : 0
  const topTenShare = totalSalesQty > 0 ? (topTenSummary.salesQty / totalSalesQty) * 100 : 0

  return [
    { label: 'Toplam Satılan Ürün Adedi', value: formatNumber(totalSalesQty), detail: 'İkram hariç ürün adetleri' },
    { label: 'Satışı Olan Ürün Sayısı', value: formatNumber(soldProductCount), detail: 'Filtrelenen benzersiz ürünler' },
    {
      label: 'En Çok Satan Ürün',
      value: topSellingProduct?.productName || '-',
      detail: topSellingProduct ? `${formatNumber(topSellingProduct.salesQty)} adet` : 'Satış yok'
    },
    {
      label: 'En Çok Ciro Üreten Ürün',
      value: highestRevenueProduct?.productName || '-',
      detail: highestRevenueProduct ? formatCurrency(highestRevenueProduct.totalRevenue) : 'Satış yok'
    },
    { label: 'Ortalama Satış Adedi', value: formatNumber(averageSalesQty), detail: 'Satışı olan ürün başına' },
    { label: 'İlk 10 Ürünün Toplam Payı (%)', value: formatPercent(topTenShare), detail: 'İlk 10 satış adedi / toplam adet' }
  ]
}

export const useTopSellingProductsReport = (args: UseTopSellingProductsReportArgs): TopSellingProductsReportResult => {
  return React.useMemo(() => {
    const events = applyFilters(buildSaleEvents(args), args.filters)
    const unsortedRows = buildRows(events)
    const topTenSummary = buildTopTenSummary(unsortedRows)
    const rows = unsortedRows.sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(unsortedRows, topTenSummary),
      topTenSummary
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

const getSortLabel = (sortKey: TopSellingProductsSortKey, sortDirection: TopSellingProductsSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Satış adedine göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportTopSellingProductsReportCsv = ({
  report,
  filters,
  productCategories,
  products,
  sortKey,
  sortDirection
}: {
  report: TopSellingProductsReportResult
  filters: ReportFiltersValue
  productCategories: ProductCategory[]
  products: Product[]
  sortKey: TopSellingProductsSortKey
  sortDirection: TopSellingProductsSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'En Çok Satan Ürünler Raporu']),
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
    csvLine(['Top 10 Özeti']),
    csvLine(['İlk 10 ürün toplam satış adedi', formatNumber(report.topTenSummary.salesQty)]),
    csvLine(['İlk 10 ürün toplam ciro', formatCurrency(report.topTenSummary.totalRevenue)]),
    csvLine(['İlk 10 ürün toplam kar', formatCurrency(report.topTenSummary.grossProfit)]),
    '',
    csvLine([
      'Sıra',
      'Ürün',
      'Kategori',
      'Satış Adedi',
      'Toplam Ciro',
      'Ortalama Birim Fiyat',
      'Toplam Maliyet',
      'Brüt Kar',
      'Satış Payı %'
    ]),
    ...report.rows.map((row, index) => csvLine([
      index + 1,
      row.productName,
      row.categoryName,
      formatNumber(row.salesQty),
      formatCurrency(row.totalRevenue),
      formatCurrency(row.averageUnitPrice),
      formatCurrency(row.totalCost),
      formatCurrency(row.grossProfit),
      formatPercent(row.salesShare)
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `en-cok-satan-urunler-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function TopSellingProductsReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: TopSellingProductsReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>En Çok Satan Ürünler</h3>
          <p className="muted">Kapalı adisyonlardaki ürün satış adedi, ciro, maliyet ve satış payı kırılımı.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-panel-grid three top-selling-summary-grid">
        <div className="report-panel">
          <h4>İlk 10 Satış Adedi</h4>
          <strong>{formatNumber(report.topTenSummary.salesQty)}</strong>
          <p className="muted small-text">Satış adedine göre ilk 10 ürün</p>
        </div>
        <div className="report-panel">
          <h4>İlk 10 Toplam Ciro</h4>
          <strong>{formatCurrency(report.topTenSummary.totalRevenue)}</strong>
          <p className="muted small-text">İlk 10 ürünün brüt satış cirosu</p>
        </div>
        <div className="report-panel">
          <h4>İlk 10 Toplam Kar</h4>
          <strong>{formatCurrency(report.topTenSummary.grossProfit)}</strong>
          <p className="muted small-text">Ciro - reçete maliyeti</p>
        </div>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} ürün listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as TopSellingProductsSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as TopSellingProductsSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table top-selling-products-report-table">
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Satış Adedi</th>
              <th>Toplam Ciro</th>
              <th>Ortalama Birim Fiyat</th>
              <th>Toplam Maliyet</th>
              <th>Brüt Kar</th>
              <th>Satış Payı %</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-cell">Bu filtrelere uygun ürün satışı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map((row, index) => (
              <tr key={row.productId}>
                <td>{index + 1}</td>
                <td><strong>{row.productName}</strong></td>
                <td>{row.categoryName}</td>
                <td>{formatNumber(row.salesQty)}</td>
                <td>{formatCurrency(row.totalRevenue)}</td>
                <td>{formatCurrency(row.averageUnitPrice)}</td>
                <td>{formatCurrency(row.totalCost)}</td>
                <td>{formatCurrency(row.grossProfit)}</td>
                <td>{formatPercent(row.salesShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
