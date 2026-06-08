import React from 'react'
import { calculateSubtotal, formatCurrency, isRevenueBill, roundCurrency } from '../../billing'
import { ClosedBill, Product, TableState, User } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type SalesRevenueSortKey = 'date' | 'salesQty' | 'billAmount' | 'netTotal'
export type SalesRevenueSortDirection = 'asc' | 'desc'

export type SalesRevenueReportRow = {
  billId: string
  date: string
  dateLabel: string
  dateKey: string
  tableId: string
  tableName: string
  salesQty: number
  billAmount: number
  discountTotal: number
  netTotal: number
  userId?: string
  userName: string
}

export type SalesRevenuePeriodSummary = {
  label: string
  salesQty: number
  revenue: number
}

export type SalesRevenueReportResult = {
  rows: SalesRevenueReportRow[]
  kpis: ReportKpi[]
  periodSummaries: SalesRevenuePeriodSummary[]
}

type UseSalesRevenueReportArgs = {
  closedBills: ClosedBill[]
  products: Product[]
  users: User[]
  filters: ReportFiltersValue
  sortKey: SalesRevenueSortKey
  sortDirection: SalesRevenueSortDirection
}

type SalesRevenueReportProps = {
  report: SalesRevenueReportResult
  sortKey: SalesRevenueSortKey
  sortDirection: SalesRevenueSortDirection
  onSortKeyChange: (sortKey: SalesRevenueSortKey) => void
  onSortDirectionChange: (sortDirection: SalesRevenueSortDirection) => void
}

const sortOptions: { value: SalesRevenueSortKey; label: string }[] = [
  { value: 'date', label: 'Tarihe göre' },
  { value: 'salesQty', label: 'Satış adedine göre' },
  { value: 'billAmount', label: 'Adisyon tutarına göre' },
  { value: 'netTotal', label: 'Net tutara göre' }
]

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

const getDateKey = (value?: string | Date) => {
  if(!value) return ''

  const date = typeof value === 'string' ? new Date(value) : value
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

const getSalesQty = (bill: ClosedBill) => {
  return bill.orders.reduce((sum, order) => {
    if(order.isGift) return sum

    const qty = Number(order.qty)
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
  }, 0)
}

const getBillAmount = (bill: ClosedBill, products: Product[]) => {
  const subtotal = Number(bill.subtotal)
  if(Number.isFinite(subtotal) && subtotal >= 0) return roundCurrency(subtotal)

  return roundCurrency(calculateSubtotal(bill.orders, products))
}

const getDiscountTotal = (bill: ClosedBill, billAmount: number) => {
  const discountTotal = Number(bill.discountTotal)
  if(Number.isFinite(discountTotal) && discountTotal >= 0) return roundCurrency(discountTotal)

  return roundCurrency(Math.max(0, billAmount - Math.max(0, Number(bill.total) || 0)))
}

const buildUserMap = (users: User[]) => {
  return new Map(users.map(user => [user.id, user]))
}

const matchesDateFilters = (row: SalesRevenueReportRow, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true
  if(!row.dateKey) return false

  if(filters.startDate && row.dateKey < filters.startDate) return false
  if(filters.endDate && row.dateKey > filters.endDate) return false

  return true
}

const buildRows = (closedBills: ClosedBill[], products: Product[], users: User[]): SalesRevenueReportRow[] => {
  const userMap = buildUserMap(users)

  return closedBills
    .filter(isRevenueBill)
    .map(bill => {
      const billAmount = getBillAmount(bill, products)
      const netTotal = roundCurrency(Math.max(0, Number(bill.total) || 0))
      const user = bill.closedByUserId ? userMap.get(bill.closedByUserId) : undefined
      const dateKey = getDateKey(bill.timestamp)

      return {
        billId: bill.id,
        date: bill.timestamp,
        dateLabel: formatDateTime(bill.timestamp),
        dateKey,
        tableId: bill.tableId,
        tableName: bill.tableName || 'Masa yok',
        salesQty: getSalesQty(bill),
        billAmount,
        discountTotal: getDiscountTotal(bill, billAmount),
        netTotal,
        userId: bill.closedByUserId,
        userName: bill.closedByFullName || user?.fullName || user?.username || 'Kullanıcı yok'
      }
    })
}

const applyFilters = (rows: SalesRevenueReportRow[], filters: ReportFiltersValue) => {
  const searchText = normalizeText(filters.search)

  return rows
    .filter(row => matchesDateFilters(row, filters))
    .filter(row => filters.personnelId === 'all' || row.userId === filters.personnelId)
    .filter(row => filters.tableId === 'all' || row.tableId === filters.tableId)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.billId).includes(searchText)
        || normalizeText(row.userName).includes(searchText)
        || normalizeText(row.tableName).includes(searchText)
    })
}

const compareRows = (
  first: SalesRevenueReportRow,
  second: SalesRevenueReportRow,
  sortKey: SalesRevenueSortKey,
  sortDirection: SalesRevenueSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'date'){
    result = getTime(first.date) - getTime(second.date)
  } else {
    result = first[sortKey] - second[sortKey]
  }

  const directedResult = result * directionMultiplier
  if(directedResult !== 0) return directedResult

  return first.billId.localeCompare(second.billId, 'tr-TR')
}

const getUniqueDayCount = (rows: SalesRevenueReportRow[]) => {
  return new Set(rows.map(row => row.dateKey).filter(Boolean)).size
}

const getWeekStartKey = (date: Date) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return getDateKey(start)
}

const buildPeriodSummaries = (rows: SalesRevenueReportRow[]): SalesRevenuePeriodSummary[] => {
  const todayKey = getDateKey(new Date())
  const weekStartKey = getWeekStartKey(new Date())
  const monthKey = todayKey.slice(0, 7)

  const buildSummary = (label: string, predicate: (row: SalesRevenueReportRow) => boolean) => {
    const periodRows = rows.filter(predicate)
    return {
      label,
      salesQty: periodRows.reduce((sum, row) => sum + row.salesQty, 0),
      revenue: roundCurrency(periodRows.reduce((sum, row) => sum + row.netTotal, 0))
    }
  }

  return [
    buildSummary('Bugün', row => row.dateKey === todayKey),
    buildSummary('Bu Hafta', row => row.dateKey >= weekStartKey && row.dateKey <= todayKey),
    buildSummary('Bu Ay', row => row.dateKey.startsWith(monthKey))
  ]
}

const buildTopProductLabel = (rows: SalesRevenueReportRow[], closedBills: ClosedBill[], products: Product[]) => {
  const filteredBillIds = new Set(rows.map(row => row.billId))
  const productMap = new Map(products.map(product => [product.id, product]))
  const productQtyMap = closedBills
    .filter(isRevenueBill)
    .filter(bill => filteredBillIds.has(bill.id))
    .flatMap(bill => bill.orders.filter(order => !order.isGift))
    .reduce<Map<string, { name: string; qty: number }>>((acc, order) => {
      const qty = Number(order.qty)
      if(!Number.isFinite(qty) || qty <= 0) return acc

      const product = productMap.get(order.productId)
      const existing = acc.get(order.productId)
      acc.set(order.productId, {
        name: product?.name || order.productName || 'Ürün',
        qty: (existing?.qty || 0) + qty
      })
      return acc
    }, new Map())

  const topProduct = [...productQtyMap.values()]
    .sort((first, second) => second.qty - first.qty || first.name.localeCompare(second.name, 'tr-TR'))[0]

  return topProduct ? `${topProduct.name} (${formatNumber(topProduct.qty)})` : '-'
}

const buildKpis = (rows: SalesRevenueReportRow[], closedBills: ClosedBill[], products: Product[]): ReportKpi[] => {
  const totalSalesQty = rows.reduce((sum, row) => sum + row.salesQty, 0)
  const totalRevenue = roundCurrency(rows.reduce((sum, row) => sum + row.netTotal, 0))
  const billCount = rows.length
  const averageBill = billCount > 0 ? roundCurrency(totalRevenue / billCount) : 0
  const highestBill = [...rows].sort((first, second) => second.netTotal - first.netTotal)[0]
  const dayCount = getUniqueDayCount(rows)
  const dailyAverageRevenue = dayCount > 0 ? roundCurrency(totalRevenue / dayCount) : 0

  return [
    { label: 'Toplam Satış Adedi', value: formatNumber(totalSalesQty), detail: 'İkram hariç ürün adetleri' },
    { label: 'Toplam Ciro', value: formatCurrency(totalRevenue), detail: 'Tamamlanan adisyon net tutarı' },
    { label: 'Ortalama Adisyon Tutarı', value: formatCurrency(averageBill), detail: `${formatNumber(billCount)} adisyon` },
    {
      label: 'En Yüksek Adisyon',
      value: highestBill ? formatCurrency(highestBill.netTotal) : formatCurrency(0),
      detail: highestBill ? `${highestBill.tableName} · ${highestBill.billId}` : 'Adisyon yok'
    },
    { label: 'En Çok Satılan Ürün', value: buildTopProductLabel(rows, closedBills, products), detail: 'Filtrelenen adisyonlara göre' },
    { label: 'Günlük Ortalama Ciro', value: formatCurrency(dailyAverageRevenue), detail: `${formatNumber(dayCount)} satış günü` }
  ]
}

export const useSalesRevenueReport = (args: UseSalesRevenueReportArgs): SalesRevenueReportResult => {
  return React.useMemo(() => {
    const filteredRows = applyFilters(buildRows(args.closedBills, args.products, args.users), args.filters)
    const rows = filteredRows.sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(rows, args.closedBills, args.products),
      periodSummaries: buildPeriodSummaries(rows)
    }
  }, [
    args.closedBills,
    args.products,
    args.users,
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

const getFilterLabel = <T extends { id: string; name?: string; fullName?: string; username?: string }>(
  value: string,
  items: T[],
  fallback: string,
  nameGetter = (item: T) => item.name || item.fullName || item.username || item.id
) => {
  if(value === 'all') return fallback
  const selected = items.find(item => item.id === value)
  return selected ? nameGetter(selected) : fallback
}

const getSortLabel = (sortKey: SalesRevenueSortKey, sortDirection: SalesRevenueSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Net tutara göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportSalesRevenueReportCsv = ({
  report,
  filters,
  users,
  tables,
  sortKey,
  sortDirection
}: {
  report: SalesRevenueReportResult
  filters: ReportFiltersValue
  users: User[]
  tables: Pick<TableState, 'id' | 'name'>[]
  sortKey: SalesRevenueSortKey
  sortDirection: SalesRevenueSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Satış ve Ciro Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kullanıcı', getFilterLabel(filters.personnelId, users, 'Tüm kullanıcılar')]),
    csvLine(['Masa', getFilterLabel(filters.tableId, tables, 'Tüm masalar')]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine(['KPI Özeti']),
    ...report.kpis.map(kpi => csvLine([kpi.label, kpi.value, kpi.detail])),
    '',
    csvLine(['Dönem Özeti']),
    ...report.periodSummaries.map(summary => csvLine([summary.label, formatNumber(summary.salesQty), formatCurrency(summary.revenue)])),
    '',
    csvLine([
      'Tarih',
      'Adisyon No',
      'Masa',
      'Satış Adedi',
      'Adisyon Tutarı',
      'İndirim',
      'Net Tutar',
      'Kullanıcı'
    ]),
    ...report.rows.map(row => csvLine([
      row.dateLabel,
      row.billId,
      row.tableName,
      formatNumber(row.salesQty),
      formatCurrency(row.billAmount),
      formatCurrency(row.discountTotal),
      formatCurrency(row.netTotal),
      row.userName
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `satis-ciro-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function SalesRevenueReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: SalesRevenueReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Satış ve Ciro Raporu</h3>
          <p className="muted">Tamamlanan adisyonların satış adedi, ciro, indirim ve net tutar kırılımı.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-panel-grid three sales-period-summary-grid">
        {report.periodSummaries.map(summary => (
          <div className="report-panel" key={summary.label}>
            <h4>{summary.label}</h4>
            <div className="sales-period-values">
              <span>Satış Adedi</span>
              <strong>{formatNumber(summary.salesQty)}</strong>
            </div>
            <div className="sales-period-values">
              <span>Ciro</span>
              <strong>{formatCurrency(summary.revenue)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} adisyon listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as SalesRevenueSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as SalesRevenueSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table sales-revenue-report-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Adisyon No</th>
              <th>Masa</th>
              <th>Satış Adedi</th>
              <th>Adisyon Tutarı</th>
              <th>İndirim</th>
              <th>Net Tutar</th>
              <th>Kullanıcı</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">Bu filtrelere uygun satış ve ciro kaydı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.billId}>
                <td>{row.dateLabel}</td>
                <td>{row.billId}</td>
                <td>{row.tableName}</td>
                <td>{formatNumber(row.salesQty)}</td>
                <td>{formatCurrency(row.billAmount)}</td>
                <td>{formatCurrency(row.discountTotal)}</td>
                <td>{formatCurrency(row.netTotal)}</td>
                <td>{row.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
