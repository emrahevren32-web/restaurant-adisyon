import React from 'react'
import { calculateSubtotal, formatCurrency, isRevenueBill, roundCurrency } from '../../billing'
import { ClosedBill, Product, TableState, User } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type SalesTrendSortKey = 'date' | 'hour' | 'salesQty' | 'revenue'
export type SalesTrendSortDirection = 'asc' | 'desc'

type SalesTrendBillRow = {
  billId: string
  date: string
  dateKey: string
  dateLabel: string
  hour: number
  hourLabel: string
  tableId: string
  tableName: string
  userId?: string
  userName: string
  salesQty: number
  revenue: number
}

export type SalesTrendDetailRow = {
  rowId: string
  dateKey: string
  dateLabel: string
  hour: number
  hourLabel: string
  billCount: number
  salesQty: number
  revenue: number
  averageBill: number
}

export type SalesTrendSummaryRow = {
  label: string
  sortKey: string | number
  salesQty: number
  revenue: number
}

export type SalesTrendPeriodSummary = {
  label: string
  salesQty: number
  revenue: number
}

export type SalesTrendReportResult = {
  rows: SalesTrendDetailRow[]
  kpis: ReportKpi[]
  hourlyRows: SalesTrendSummaryRow[]
  dailyRows: SalesTrendSummaryRow[]
  weeklyRows: SalesTrendSummaryRow[]
  periodSummaries: SalesTrendPeriodSummary[]
}

type UseSalesTrendReportArgs = {
  closedBills: ClosedBill[]
  products: Product[]
  users: User[]
  filters: ReportFiltersValue
  sortKey: SalesTrendSortKey
  sortDirection: SalesTrendSortDirection
}

type SalesTrendReportProps = {
  report: SalesTrendReportResult
  sortKey: SalesTrendSortKey
  sortDirection: SalesTrendSortDirection
  onSortKeyChange: (sortKey: SalesTrendSortKey) => void
  onSortDirectionChange: (sortDirection: SalesTrendSortDirection) => void
}

const sortOptions: { value: SalesTrendSortKey; label: string }[] = [
  { value: 'date', label: 'Tarihe göre' },
  { value: 'hour', label: 'Saate göre' },
  { value: 'salesQty', label: 'Satış adedine göre' },
  { value: 'revenue', label: 'Ciroya göre' }
]

const weekDayLabels = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const orderedWeekDayLabels = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

const getDate = (value?: string | Date) => {
  if(!value) return undefined

  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? undefined : date
}

const getDateKey = (value?: string | Date) => {
  const date = getDate(value)
  if(!date) return ''

  return date.toLocaleDateString('sv-SE')
}

const getTime = (value?: string) => {
  const date = getDate(value)
  return date ? date.getTime() : 0
}

const getHour = (value?: string) => {
  const date = getDate(value)
  return date ? date.getHours() : 0
}

const formatDate = (value?: string | Date) => {
  const date = getDate(value)
  if(!date) return '-'

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatHour = (hour: number) => {
  return `${String(hour).padStart(2, '0')}:00`
}

const getSalesQty = (bill: ClosedBill) => {
  return bill.orders.reduce((sum, order) => {
    if(order.isGift) return sum

    const qty = Number(order.qty)
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
  }, 0)
}

const getBillRevenue = (bill: ClosedBill, products: Product[]) => {
  const total = Number(bill.total)
  if(Number.isFinite(total) && total >= 0) return roundCurrency(total)

  const subtotal = Number(bill.subtotal)
  if(Number.isFinite(subtotal) && subtotal >= 0) return roundCurrency(subtotal)

  return roundCurrency(calculateSubtotal(bill.orders, products))
}

const buildUserMap = (users: User[]) => {
  return new Map(users.map(user => [user.id, user]))
}

const matchesDateFilters = (dateKey: string, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true
  if(!dateKey) return false

  if(filters.startDate && dateKey < filters.startDate) return false
  if(filters.endDate && dateKey > filters.endDate) return false

  return true
}

const buildBillRows = (closedBills: ClosedBill[], products: Product[], users: User[]) => {
  const userMap = buildUserMap(users)

  return closedBills
    .filter(isRevenueBill)
    .map<SalesTrendBillRow>(bill => {
      const dateKey = getDateKey(bill.timestamp)
      const hour = getHour(bill.timestamp)
      const user = bill.closedByUserId ? userMap.get(bill.closedByUserId) : undefined

      return {
        billId: bill.id,
        date: bill.timestamp,
        dateKey,
        dateLabel: formatDate(bill.timestamp),
        hour,
        hourLabel: formatHour(hour),
        tableId: bill.tableId,
        tableName: bill.tableName || 'Masa yok',
        userId: bill.closedByUserId,
        userName: bill.closedByFullName || user?.fullName || user?.username || 'Kullanıcı yok',
        salesQty: getSalesQty(bill),
        revenue: getBillRevenue(bill, products)
      }
    })
}

const applyFilters = (rows: SalesTrendBillRow[], filters: ReportFiltersValue) => {
  const searchText = normalizeText(filters.search)

  return rows
    .filter(row => matchesDateFilters(row.dateKey, filters))
    .filter(row => filters.personnelId === 'all' || row.userId === filters.personnelId)
    .filter(row => filters.tableId === 'all' || row.tableId === filters.tableId)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.userName).includes(searchText)
        || normalizeText(row.tableName).includes(searchText)
    })
}

const buildDetailRows = (billRows: SalesTrendBillRow[]) => {
  const rowMap = billRows.reduce<Map<string, SalesTrendDetailRow>>((acc, row) => {
    const rowId = `${row.dateKey}_${row.hourLabel}`
    const existing = acc.get(rowId)

    if(existing){
      const billCount = existing.billCount + 1
      const salesQty = existing.salesQty + row.salesQty
      const revenue = roundCurrency(existing.revenue + row.revenue)

      acc.set(rowId, {
        ...existing,
        billCount,
        salesQty,
        revenue,
        averageBill: billCount > 0 ? roundCurrency(revenue / billCount) : 0
      })
      return acc
    }

    acc.set(rowId, {
      rowId,
      dateKey: row.dateKey,
      dateLabel: row.dateLabel,
      hour: row.hour,
      hourLabel: row.hourLabel,
      billCount: 1,
      salesQty: row.salesQty,
      revenue: row.revenue,
      averageBill: row.revenue
    })

    return acc
  }, new Map())

  return [...rowMap.values()]
}

const buildGroupedRows = (
  billRows: SalesTrendBillRow[],
  getKey: (row: SalesTrendBillRow) => string,
  getLabel: (row: SalesTrendBillRow) => string,
  getSortKey: (row: SalesTrendBillRow) => string | number
) => {
  const rowMap = billRows.reduce<Map<string, SalesTrendSummaryRow>>((acc, row) => {
    const key = getKey(row)
    const existing = acc.get(key)

    if(existing){
      acc.set(key, {
        ...existing,
        salesQty: existing.salesQty + row.salesQty,
        revenue: roundCurrency(existing.revenue + row.revenue)
      })
      return acc
    }

    acc.set(key, {
      label: getLabel(row),
      sortKey: getSortKey(row),
      salesQty: row.salesQty,
      revenue: row.revenue
    })

    return acc
  }, new Map())

  return [...rowMap.values()]
}

const buildHourlyRows = (billRows: SalesTrendBillRow[]) => {
  return buildGroupedRows(
    billRows,
    row => row.hourLabel,
    row => row.hourLabel,
    row => row.hour
  ).sort((first, second) => Number(first.sortKey) - Number(second.sortKey))
}

const buildDailyRows = (billRows: SalesTrendBillRow[]) => {
  return buildGroupedRows(
    billRows,
    row => row.dateKey,
    row => row.dateLabel,
    row => row.dateKey
  ).sort((first, second) => String(first.sortKey).localeCompare(String(second.sortKey)))
}

const buildWeeklyRows = (billRows: SalesTrendBillRow[]) => {
  const rowMap = billRows.reduce<Map<string, SalesTrendSummaryRow>>((acc, row) => {
    const date = getDate(row.date)
    const dayIndex = date?.getDay() ?? 0
    const label = weekDayLabels[dayIndex]
    const sortKey = label === 'Pazar' ? 6 : dayIndex - 1
    const existing = acc.get(label)

    acc.set(label, {
      label,
      sortKey,
      salesQty: (existing?.salesQty || 0) + row.salesQty,
      revenue: roundCurrency((existing?.revenue || 0) + row.revenue)
    })
    return acc
  }, new Map())

  return orderedWeekDayLabels.map((label, index) => {
    return rowMap.get(label) || { label, sortKey: index, salesQty: 0, revenue: 0 }
  })
}

const compareRows = (
  first: SalesTrendDetailRow,
  second: SalesTrendDetailRow,
  sortKey: SalesTrendSortKey,
  sortDirection: SalesTrendSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'date'){
    result = first.dateKey.localeCompare(second.dateKey)
  } else if(sortKey === 'hour'){
    result = first.hour - second.hour
  } else {
    result = first[sortKey] - second[sortKey]
  }

  const directedResult = result * directionMultiplier
  if(directedResult !== 0) return directedResult

  return first.dateKey.localeCompare(second.dateKey) || first.hour - second.hour
}

const getWeekStartKey = (date: Date) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return getDateKey(start)
}

const buildPeriodSummaries = (billRows: SalesTrendBillRow[]): SalesTrendPeriodSummary[] => {
  const todayKey = getDateKey(new Date())
  const weekStartKey = getWeekStartKey(new Date())
  const monthKey = todayKey.slice(0, 7)

  const buildSummary = (label: string, predicate: (row: SalesTrendBillRow) => boolean) => {
    const periodRows = billRows.filter(predicate)
    return {
      label,
      salesQty: periodRows.reduce((sum, row) => sum + row.salesQty, 0),
      revenue: roundCurrency(periodRows.reduce((sum, row) => sum + row.revenue, 0))
    }
  }

  return [
    buildSummary('Bugün', row => row.dateKey === todayKey),
    buildSummary('Bu Hafta', row => row.dateKey >= weekStartKey && row.dateKey <= todayKey),
    buildSummary('Bu Ay', row => row.dateKey.startsWith(monthKey))
  ]
}

const getTopSummary = (rows: SalesTrendSummaryRow[]) => {
  return [...rows].sort((first, second) => second.salesQty - first.salesQty || second.revenue - first.revenue)[0]
}

const getLowestSummary = (rows: SalesTrendSummaryRow[]) => {
  return [...rows]
    .filter(row => row.salesQty > 0 || row.revenue > 0)
    .sort((first, second) => first.salesQty - second.salesQty || first.revenue - second.revenue)[0]
}

const buildKpis = (billRows: SalesTrendBillRow[], hourlyRows: SalesTrendSummaryRow[], dailyRows: SalesTrendSummaryRow[]): ReportKpi[] => {
  const totalSalesQty = billRows.reduce((sum, row) => sum + row.salesQty, 0)
  const totalRevenue = roundCurrency(billRows.reduce((sum, row) => sum + row.revenue, 0))
  const busiestHour = getTopSummary(hourlyRows)
  const busiestDay = getTopSummary(dailyRows)
  const lowestDay = getLowestSummary(dailyRows)
  const dayCount = new Set(billRows.map(row => row.dateKey).filter(Boolean)).size
  const averageDailyRevenue = dayCount > 0 ? roundCurrency(totalRevenue / dayCount) : 0

  return [
    { label: 'Toplam Satış Adedi', value: formatNumber(totalSalesQty), detail: 'İkram hariç ürün adetleri' },
    { label: 'Toplam Ciro', value: formatCurrency(totalRevenue), detail: 'Filtrelenen tamamlanan adisyonlar' },
    {
      label: 'En Yoğun Saat',
      value: busiestHour?.label || '-',
      detail: busiestHour ? `${formatNumber(busiestHour.salesQty)} satış · ${formatCurrency(busiestHour.revenue)}` : 'Satış yok'
    },
    {
      label: 'En Yoğun Gün',
      value: busiestDay?.label || '-',
      detail: busiestDay ? `${formatNumber(busiestDay.salesQty)} satış · ${formatCurrency(busiestDay.revenue)}` : 'Satış yok'
    },
    {
      label: 'En Düşük Satış Günü',
      value: lowestDay?.label || '-',
      detail: lowestDay ? `${formatNumber(lowestDay.salesQty)} satış · ${formatCurrency(lowestDay.revenue)}` : 'Satış yok'
    },
    { label: 'Ortalama Günlük Ciro', value: formatCurrency(averageDailyRevenue), detail: `${formatNumber(dayCount)} satış günü` }
  ]
}

export const useSalesTrendReport = (args: UseSalesTrendReportArgs): SalesTrendReportResult => {
  return React.useMemo(() => {
    const billRows = applyFilters(buildBillRows(args.closedBills, args.products, args.users), args.filters)
    const hourlyRows = buildHourlyRows(billRows)
    const dailyRows = buildDailyRows(billRows)
    const weeklyRows = buildWeeklyRows(billRows)
    const rows = buildDetailRows(billRows).sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(billRows, hourlyRows, dailyRows),
      hourlyRows,
      dailyRows,
      weeklyRows,
      periodSummaries: buildPeriodSummaries(billRows)
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

const getSortLabel = (sortKey: SalesTrendSortKey, sortDirection: SalesTrendSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Ciroya göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportSalesTrendReportCsv = ({
  report,
  filters,
  users,
  tables,
  sortKey,
  sortDirection
}: {
  report: SalesTrendReportResult
  filters: ReportFiltersValue
  users: User[]
  tables: Pick<TableState, 'id' | 'name'>[]
  sortKey: SalesTrendSortKey
  sortDirection: SalesTrendSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Satış Trendleri ve Zaman Analizi Raporu']),
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
    csvLine(['Saatlik Satış Analizi']),
    csvLine(['Saat', 'Satış Adedi', 'Ciro']),
    ...report.hourlyRows.map(row => csvLine([row.label, formatNumber(row.salesQty), formatCurrency(row.revenue)])),
    '',
    csvLine(['Günlük Satış Analizi']),
    csvLine(['Gün', 'Satış Adedi', 'Ciro']),
    ...report.dailyRows.map(row => csvLine([row.label, formatNumber(row.salesQty), formatCurrency(row.revenue)])),
    '',
    csvLine(['Haftalık Analiz']),
    csvLine(['Gün', 'Satış Adedi', 'Ciro']),
    ...report.weeklyRows.map(row => csvLine([row.label, formatNumber(row.salesQty), formatCurrency(row.revenue)])),
    '',
    csvLine([
      'Tarih',
      'Saat',
      'Adisyon Sayısı',
      'Satış Adedi',
      'Ciro',
      'Ortalama Adisyon'
    ]),
    ...report.rows.map(row => csvLine([
      row.dateLabel,
      row.hourLabel,
      formatNumber(row.billCount),
      formatNumber(row.salesQty),
      formatCurrency(row.revenue),
      formatCurrency(row.averageBill)
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `satis-trendleri-zaman-analizi-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const MiniTrendTable = ({ rows, emptyText }: { rows: SalesTrendSummaryRow[]; emptyText: string }) => (
  <table className="mini-report-table">
    <thead>
      <tr>
        <th>Zaman</th>
        <th>Satış</th>
        <th>Ciro</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && (
        <tr>
          <td colSpan={3} className="empty-cell">{emptyText}</td>
        </tr>
      )}
      {rows.map(row => (
        <tr key={row.label}>
          <td>{row.label}</td>
          <td>{formatNumber(row.salesQty)}</td>
          <td>{formatCurrency(row.revenue)}</td>
        </tr>
      ))}
    </tbody>
  </table>
)

export default function SalesTrendReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: SalesTrendReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Satış Trendleri ve Zaman Analizi</h3>
          <p className="muted">Tamamlanan adisyonların saatlik, günlük ve haftalık satış yoğunluğu kırılımı.</p>
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

      <div className="report-panel-grid three sales-trend-analysis-grid">
        <div className="report-panel">
          <h4>Saatlik Satış Analizi</h4>
          <MiniTrendTable rows={report.hourlyRows} emptyText="Saatlik satış yok." />
        </div>
        <div className="report-panel">
          <h4>Günlük Satış Analizi</h4>
          <MiniTrendTable rows={report.dailyRows} emptyText="Günlük satış yok." />
        </div>
        <div className="report-panel">
          <h4>Haftalık Analiz</h4>
          <MiniTrendTable rows={report.weeklyRows} emptyText="Haftalık satış yok." />
        </div>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} zaman dilimi listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as SalesTrendSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as SalesTrendSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table sales-trend-report-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Saat</th>
              <th>Adisyon Sayısı</th>
              <th>Satış Adedi</th>
              <th>Ciro</th>
              <th>Ortalama Adisyon</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">Bu filtrelere uygun satış trendi bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.rowId}>
                <td>{row.dateLabel}</td>
                <td>{row.hourLabel}</td>
                <td>{formatNumber(row.billCount)}</td>
                <td>{formatNumber(row.salesQty)}</td>
                <td>{formatCurrency(row.revenue)}</td>
                <td>{formatCurrency(row.averageBill)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
