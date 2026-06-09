import React from 'react'
import { calculateOrderOriginalTotal, formatCurrency, isRevenueBill, roundCurrency } from '../../billing'
import { calculateRecipeCost } from '../RecipeForm'
import { ClosedBill, Product, ProductCategory, Recipe, StockItem } from '../../types'
import { ReportFiltersValue, ReportLowSellingStatusFilter, reportLowSellingStatusOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type LowSellingProductsSortKey = 'salesQty' | 'totalRevenue' | 'grossProfit'
export type LowSellingProductsSortDirection = 'asc' | 'desc'
type LowSellingProductStatus = Exclude<ReportLowSellingStatusFilter, 'all'>

type SaleEvent = {
  productId: string
  salesQty: number
  totalRevenue: number
  saleDate: string
}

export type LowSellingProductsReportRow = {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  salesQty: number
  totalRevenue: number
  averageUnitPrice: number
  totalCost: number
  grossProfit: number
  status: LowSellingProductStatus
  statusLabel: string
  statusClassName: string
}

export type LowSellingProductsSummary = {
  unsoldCount: number
  unsoldCost: number
  riskyCount: number
  riskyCost: number
  lowPerformanceCount: number
  lowPerformanceCost: number
}

export type LowSellingProductsReportResult = {
  rows: LowSellingProductsReportRow[]
  kpis: ReportKpi[]
  summary: LowSellingProductsSummary
}

type UseLowSellingProductsReportArgs = {
  closedBills: ClosedBill[]
  products: Product[]
  productCategories: ProductCategory[]
  recipes: Recipe[]
  stockItems: StockItem[]
  filters: ReportFiltersValue
  sortKey: LowSellingProductsSortKey
  sortDirection: LowSellingProductsSortDirection
}

type LowSellingProductsReportProps = {
  report: LowSellingProductsReportResult
  sortKey: LowSellingProductsSortKey
  sortDirection: LowSellingProductsSortDirection
  onSortKeyChange: (sortKey: LowSellingProductsSortKey) => void
  onSortDirectionChange: (sortDirection: LowSellingProductsSortDirection) => void
}

const sortOptions: { value: LowSellingProductsSortKey; label: string }[] = [
  { value: 'salesQty', label: 'Satış adedine göre' },
  { value: 'totalRevenue', label: 'Toplam ciroya göre' },
  { value: 'grossProfit', label: 'Brüt kara göre' }
]

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
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

const buildSaleEvents = (closedBills: ClosedBill[], products: Product[], filters: ReportFiltersValue) => {
  return closedBills.flatMap<SaleEvent>(bill => {
    if(!isRevenueBill(bill) || !matchesDateFilters(bill.timestamp, filters)) return []

    return bill.orders
      .filter(order => !order.isGift)
      .map<SaleEvent | undefined>(order => {
        const salesQty = Number(order.qty)
        if(!Number.isFinite(salesQty) || salesQty <= 0) return undefined

        const totalRevenue = roundCurrency(calculateOrderOriginalTotal(order, products))
        if(totalRevenue <= 0) return undefined

        return {
          productId: order.productId,
          salesQty,
          totalRevenue,
          saleDate: bill.timestamp
        }
      })
      .filter((event): event is SaleEvent => Boolean(event))
  })
}

const getStatusMeta = (salesQty: number, averageSalesQty: number): Pick<LowSellingProductsReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(salesQty === 0){
    return { status: 'not-selling', statusLabel: 'Satılmıyor', statusClassName: 'danger-pill' }
  }

  if(salesQty <= 1){
    return { status: 'risky', statusLabel: 'Riskli', statusClassName: 'warning-pill' }
  }

  if(salesQty < averageSalesQty){
    return { status: 'low', statusLabel: 'Düşük Performans', statusClassName: 'info-pill' }
  }

  return { status: 'normal', statusLabel: 'Normal', statusClassName: 'success' }
}

const buildRows = ({
  closedBills,
  products,
  productCategories,
  recipes,
  stockItems,
  filters
}: Pick<UseLowSellingProductsReportArgs, 'closedBills' | 'products' | 'productCategories' | 'recipes' | 'stockItems' | 'filters'>) => {
  const categoryMap = buildCategoryMap(productCategories)
  const recipeCostMap = buildRecipeCostMap(recipes, stockItems)
  const saleEvents = buildSaleEvents(closedBills, products, filters)
  const salesByProduct = saleEvents.reduce<Map<string, { salesQty: number; totalRevenue: number }>>((acc, event) => {
    const existing = acc.get(event.productId)
    acc.set(event.productId, {
      salesQty: (existing?.salesQty || 0) + event.salesQty,
      totalRevenue: roundCurrency((existing?.totalRevenue || 0) + event.totalRevenue)
    })
    return acc
  }, new Map())
  const searchText = normalizeText(filters.search)
  const filteredProducts = products
    .filter(product => product.active)
    .filter(product => filters.categoryId === 'all' || product.categoryId === filters.categoryId)
    .filter(product => filters.stockItemId === 'all' || product.id === filters.stockItemId)
    .filter(product => {
      if(!searchText) return true
      const category = categoryMap.get(product.categoryId)

      return normalizeText(product.name).includes(searchText)
        || normalizeText(category?.name).includes(searchText)
    })

  const totalSalesQty = filteredProducts.reduce((sum, product) => {
    return sum + (salesByProduct.get(product.id)?.salesQty || 0)
  }, 0)
  const averageSalesQty = filteredProducts.length > 0 ? totalSalesQty / filteredProducts.length : 0

  return filteredProducts
    .map<LowSellingProductsReportRow>(product => {
      const category = categoryMap.get(product.categoryId)
      const sales = salesByProduct.get(product.id)
      const salesQty = sales?.salesQty || 0
      const totalRevenue = sales?.totalRevenue || 0
      const unitRecipeCost = recipeCostMap.get(product.id) || 0
      const totalCost = roundCurrency(unitRecipeCost * salesQty)
      const grossProfit = roundCurrency(totalRevenue - totalCost)
      const statusMeta = getStatusMeta(salesQty, averageSalesQty)

      return {
        productId: product.id,
        productName: product.name,
        categoryId: product.categoryId,
        categoryName: category?.name || 'Kategori yok',
        salesQty,
        totalRevenue,
        averageUnitPrice: salesQty > 0 ? roundCurrency(totalRevenue / salesQty) : 0,
        totalCost,
        grossProfit,
        ...statusMeta
      }
    })
    .filter(row => filters.lowSellingStatus === 'all' || row.status === filters.lowSellingStatus)
}

const compareRows = (
  first: LowSellingProductsReportRow,
  second: LowSellingProductsReportRow,
  sortKey: LowSellingProductsSortKey,
  sortDirection: LowSellingProductsSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  const result = (first[sortKey] - second[sortKey]) * directionMultiplier
  if(result !== 0) return result

  return first.productName.localeCompare(second.productName, 'tr-TR')
}

const buildSummary = (rows: LowSellingProductsReportRow[]): LowSellingProductsSummary => {
  const unsoldRows = rows.filter(row => row.salesQty === 0)
  const riskyRows = rows.filter(row => row.salesQty <= 1)
  const lowPerformanceRows = rows.filter(row => row.status === 'low')

  return {
    unsoldCount: unsoldRows.length,
    unsoldCost: roundCurrency(unsoldRows.reduce((sum, row) => sum + row.totalCost, 0)),
    riskyCount: riskyRows.length,
    riskyCost: roundCurrency(riskyRows.reduce((sum, row) => sum + row.totalCost, 0)),
    lowPerformanceCount: lowPerformanceRows.length,
    lowPerformanceCost: roundCurrency(lowPerformanceRows.reduce((sum, row) => sum + row.totalCost, 0))
  }
}

const buildKpis = (rows: LowSellingProductsReportRow[], summary: LowSellingProductsSummary): ReportKpi[] => {
  const soldProductCount = rows.filter(row => row.salesQty > 0).length
  const lowestSellingProduct = [...rows].sort((first, second) => first.salesQty - second.salesQty || first.productName.localeCompare(second.productName, 'tr-TR'))[0]

  return [
    { label: 'Satışı Olan Ürün Sayısı', value: formatNumber(soldProductCount), detail: 'Satış adedi 0 üstünde olan ürünler' },
    {
      label: 'En Az Satan Ürün',
      value: lowestSellingProduct?.productName || '-',
      detail: lowestSellingProduct ? `${formatNumber(lowestSellingProduct.salesQty)} adet` : 'Ürün yok'
    },
    { label: 'Hiç Satmayan Ürün Sayısı', value: formatNumber(summary.unsoldCount), detail: 'Satış adedi 0 olan ürünler' },
    { label: 'Düşük Performanslı Ürün Sayısı', value: formatNumber(summary.lowPerformanceCount), detail: 'Ortalamanın altında kalan ürünler' },
    { label: 'Riskli Ürün Sayısı', value: formatNumber(summary.riskyCount), detail: 'Satış adedi 1 veya altında' },
    { label: 'Düşük Performanslı Ürünlerin Toplam Maliyeti', value: formatCurrency(summary.lowPerformanceCost), detail: 'Düşük performanslı ürün satış maliyeti' }
  ]
}

export const useLowSellingProductsReport = (args: UseLowSellingProductsReportArgs): LowSellingProductsReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args).sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))
    const summary = buildSummary(rows)

    return {
      rows,
      kpis: buildKpis(rows, summary),
      summary
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

const getStatusFilterLabel = (value: ReportLowSellingStatusFilter) => {
  return reportLowSellingStatusOptions.find(option => option.value === value)?.label || 'Tüm durumlar'
}

const getSortLabel = (sortKey: LowSellingProductsSortKey, sortDirection: LowSellingProductsSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Satış adedine göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportLowSellingProductsReportCsv = ({
  report,
  filters,
  productCategories,
  products,
  sortKey,
  sortDirection
}: {
  report: LowSellingProductsReportResult
  filters: ReportFiltersValue
  productCategories: ProductCategory[]
  products: Product[]
  sortKey: LowSellingProductsSortKey
  sortDirection: LowSellingProductsSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'En Az Satan Ürünler Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, productCategories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, products, 'Tüm ürünler')]),
    csvLine(['Durum', getStatusFilterLabel(filters.lowSellingStatus)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine(['KPI Özeti']),
    ...report.kpis.map(kpi => csvLine([kpi.label, kpi.value, kpi.detail])),
    '',
    csvLine(['Özet Kartları']),
    csvLine(['Satılmayan Ürünler', report.summary.unsoldCount, formatCurrency(report.summary.unsoldCost)]),
    csvLine(['Riskli Ürünler', report.summary.riskyCount, formatCurrency(report.summary.riskyCost)]),
    csvLine(['Düşük Performanslı Ürünler', report.summary.lowPerformanceCount, formatCurrency(report.summary.lowPerformanceCost)]),
    '',
    csvLine([
      'Ürün',
      'Kategori',
      'Satış Adedi',
      'Toplam Ciro',
      'Ortalama Birim Fiyat',
      'Toplam Maliyet',
      'Brüt Kar',
      'Durum'
    ]),
    ...report.rows.map(row => csvLine([
      row.productName,
      row.categoryName,
      formatNumber(row.salesQty),
      formatCurrency(row.totalRevenue),
      formatCurrency(row.averageUnitPrice),
      formatCurrency(row.totalCost),
      formatCurrency(row.grossProfit),
      row.statusLabel
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `en-az-satan-urunler-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function LowSellingProductsReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: LowSellingProductsReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>En Az Satan Ürünler</h3>
          <p className="muted">Az satan, hiç satmayan ve düşük performanslı ürünlerin satış ve maliyet kırılımı.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-panel-grid three low-selling-summary-grid">
        <div className="report-panel">
          <h4>Satılmayan Ürünler</h4>
          <strong>{formatNumber(report.summary.unsoldCount)}</strong>
          <p className="muted small-text">Toplam maliyet: {formatCurrency(report.summary.unsoldCost)}</p>
        </div>
        <div className="report-panel">
          <h4>Riskli Ürünler</h4>
          <strong>{formatNumber(report.summary.riskyCount)}</strong>
          <p className="muted small-text">Toplam maliyet: {formatCurrency(report.summary.riskyCost)}</p>
        </div>
        <div className="report-panel">
          <h4>Düşük Performanslı Ürünler</h4>
          <strong>{formatNumber(report.summary.lowPerformanceCount)}</strong>
          <p className="muted small-text">Toplam maliyet: {formatCurrency(report.summary.lowPerformanceCost)}</p>
        </div>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} ürün listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as LowSellingProductsSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as LowSellingProductsSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table low-selling-products-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Satış Adedi</th>
              <th>Toplam Ciro</th>
              <th>Ortalama Birim Fiyat</th>
              <th>Toplam Maliyet</th>
              <th>Brüt Kar</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">Bu filtrelere uygun az satan ürün kaydı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.productId}>
                <td><strong>{row.productName}</strong></td>
                <td>{row.categoryName}</td>
                <td>{formatNumber(row.salesQty)}</td>
                <td>{formatCurrency(row.totalRevenue)}</td>
                <td>{formatCurrency(row.averageUnitPrice)}</td>
                <td>{formatCurrency(row.totalCost)}</td>
                <td>{formatCurrency(row.grossProfit)}</td>
                <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
