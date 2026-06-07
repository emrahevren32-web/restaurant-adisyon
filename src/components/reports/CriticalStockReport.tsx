import React from 'react'
import { formatStockQuantity, getCriticalShortage, isCriticalStock, isOutOfStock } from '../../criticalStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockAverageCost, getStockCurrency, roundCost } from '../../stockCost'
import { CriticalStockEvent, StockCategory, StockItem, StockMovement, StockUnit } from '../../types'
import { ReportCriticalStatusFilter, ReportFiltersValue, reportCriticalStatusOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type CriticalStockSortKey = 'name' | 'currentQty' | 'minQty' | 'shortage' | 'estimatedValue'
export type CriticalStockSortDirection = 'asc' | 'desc'
type CriticalStockStatus = Exclude<ReportCriticalStatusFilter, 'all'>

export type CriticalStockReportRow = {
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  sku: string
  unit: StockUnit
  currentQty: number
  minQty: number
  shortage: number
  status: CriticalStockStatus
  statusLabel: string
  statusClassName: string
  lastMovementDate?: string
  lastMovementLabel: string
  sortTime: number
  averageCost: number
  estimatedValue: number
  currency: string
}

export type CriticalStockReportResult = {
  rows: CriticalStockReportRow[]
  kpis: ReportKpi[]
}

type UseCriticalStockReportArgs = {
  stockItems: StockItem[]
  categories: StockCategory[]
  movements: StockMovement[]
  criticalEvents: CriticalStockEvent[]
  filters: ReportFiltersValue
  sortKey: CriticalStockSortKey
  sortDirection: CriticalStockSortDirection
}

type CriticalStockReportProps = {
  report: CriticalStockReportResult
  sortKey: CriticalStockSortKey
  sortDirection: CriticalStockSortDirection
  onSortKeyChange: (sortKey: CriticalStockSortKey) => void
  onSortDirectionChange: (sortDirection: CriticalStockSortDirection) => void
}

const sortOptions: { value: CriticalStockSortKey; label: string }[] = [
  { value: 'name', label: 'Ürün adına göre' },
  { value: 'currentQty', label: 'Mevcut miktara göre' },
  { value: 'minQty', label: 'Kritik seviyeye göre' },
  { value: 'shortage', label: 'Eksik miktara göre' },
  { value: 'estimatedValue', label: 'Tahmini değere göre' }
]

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
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

const buildCategoryMap = (categories: StockCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const buildLastMovementMap = (movements: StockMovement[]) => {
  return movements.reduce<Map<string, StockMovement>>((acc, movement) => {
    const current = acc.get(movement.stockItemId)
    const movementTime = getTime(movement.movementDate || movement.createdAt)
    const currentTime = getTime(current?.movementDate || current?.createdAt)

    if(!current || movementTime > currentTime){
      acc.set(movement.stockItemId, movement)
    }

    return acc
  }, new Map())
}

const getCriticalStatus = (item: StockItem): Pick<CriticalStockReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(isOutOfStock(item)){
    return { status: 'out', statusLabel: 'Stok Yok', statusClassName: 'danger-pill' }
  }

  if(item.minQty > 0 && item.currentQty <= item.minQty * 0.5){
    return { status: 'very-critical', statusLabel: 'Çok Kritik', statusClassName: 'danger-pill' }
  }

  return { status: 'critical', statusLabel: 'Kritik', statusClassName: 'warning-pill' }
}

const compareRows = (
  first: CriticalStockReportRow,
  second: CriticalStockReportRow,
  sortKey: CriticalStockSortKey,
  sortDirection: CriticalStockSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'name'){
    result = first.stockName.localeCompare(second.stockName, 'tr-TR')
  } else {
    result = first[sortKey] - second[sortKey]
  }

  if(result === 0){
    result = first.stockName.localeCompare(second.stockName, 'tr-TR')
  }

  return result * directionMultiplier
}

const getSeverityScore = (status: CriticalStockStatus) => {
  if(status === 'out') return 3
  if(status === 'very-critical') return 2
  return 1
}

const buildRows = ({
  stockItems,
  categories,
  movements,
  filters,
  sortKey,
  sortDirection
}: UseCriticalStockReportArgs) => {
  const categoryMap = buildCategoryMap(categories)
  const lastMovementByStockItem = buildLastMovementMap(movements)
  const searchText = normalizeText(filters.search)

  return stockItems
    .filter(item => isCriticalStock(item))
    .filter(item => filters.categoryId === 'all' || item.categoryId === filters.categoryId)
    .filter(item => filters.stockItemId === 'all' || item.id === filters.stockItemId)
    .map<CriticalStockReportRow>(item => {
      const category = categoryMap.get(item.categoryId)
      const lastMovement = lastMovementByStockItem.get(item.id)
      const lastMovementDate = lastMovement?.movementDate || lastMovement?.createdAt
      const averageCost = getStockAverageCost(item)
      const currency = getStockCurrency(item)
      const status = getCriticalStatus(item)

      return {
        stockItemId: item.id,
        stockName: item.name,
        categoryId: item.categoryId,
        categoryName: category?.name || 'Kategori yok',
        sku: item.sku || '',
        unit: item.unit,
        currentQty: item.currentQty,
        minQty: item.minQty,
        shortage: getCriticalShortage(item),
        ...status,
        lastMovementDate,
        lastMovementLabel: formatDateTime(lastMovementDate),
        sortTime: getTime(lastMovementDate),
        averageCost,
        estimatedValue: roundCost(item.currentQty * averageCost),
        currency
      }
    })
    .filter(row => filters.criticalStatus === 'all' || row.status === filters.criticalStatus)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.categoryName).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildRecentCriticalCount = (rows: CriticalStockReportRow[], criticalEvents: CriticalStockEvent[]) => {
  const visibleStockIds = new Set(rows.map(row => row.stockItemId))
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

  return new Set(
    criticalEvents
      .filter(event => event.eventType === 'entered')
      .filter(event => visibleStockIds.has(event.stockItemId))
      .filter(event => getTime(event.timestamp) >= sevenDaysAgo)
      .map(event => event.stockItemId)
  ).size
}

const getMostCriticalRow = (rows: CriticalStockReportRow[]) => {
  return [...rows].sort((first, second) => {
    const shortageDiff = second.shortage - first.shortage
    if(shortageDiff !== 0) return shortageDiff

    const severityDiff = getSeverityScore(second.status) - getSeverityScore(first.status)
    if(severityDiff !== 0) return severityDiff

    return first.stockName.localeCompare(second.stockName, 'tr-TR')
  })[0]
}

const buildKpis = (rows: CriticalStockReportRow[], criticalEvents: CriticalStockEvent[]): ReportKpi[] => {
  const belowCriticalLevelCount = rows.filter(row => row.currentQty < row.minQty).length
  const outOfStockCount = rows.filter(row => row.status === 'out').length
  const totalEstimatedValue = rows.reduce((sum, row) => sum + row.estimatedValue, 0)
  const mostCriticalRow = getMostCriticalRow(rows)
  const recentCriticalCount = buildRecentCriticalCount(rows, criticalEvents)

  return [
    { label: 'Kritik Ürün Sayısı', value: formatNumber(rows.length), detail: 'Kritik seviyede veya altında' },
    { label: 'Kritik Seviyenin Altındaki Ürün Sayısı', value: formatNumber(belowCriticalLevelCount), detail: 'Mevcut miktar kritik seviyenin altında' },
    { label: 'Stokta Olmayan Ürün Sayısı', value: formatNumber(outOfStockCount), detail: 'Mevcut miktarı 0 veya altı' },
    { label: 'Kritik Stok Toplam Değeri', value: formatStockMoney(totalEstimatedValue, DEFAULT_STOCK_CURRENCY), detail: 'Mevcut miktar x ortalama maliyet' },
    {
      label: 'En Kritik Ürün',
      value: mostCriticalRow?.stockName || '-',
      detail: mostCriticalRow ? `${formatStockQuantity(mostCriticalRow.shortage, mostCriticalRow.unit)} eksik` : 'Kritik ürün yok'
    },
    { label: 'Son 7 Günde Kritik Stoka Düşen Ürün Sayısı', value: formatNumber(recentCriticalCount), detail: 'Kritik stok olay kayıtlarına göre' }
  ]
}

export const useCriticalStockReport = (args: UseCriticalStockReportArgs): CriticalStockReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args)
    return {
      rows,
      kpis: buildKpis(rows, args.criticalEvents)
    }
  }, [
    args.stockItems,
    args.categories,
    args.movements,
    args.criticalEvents,
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

const getCriticalStatusFilterLabel = (value: ReportCriticalStatusFilter) => {
  return reportCriticalStatusOptions.find(option => option.value === value)?.label || 'Tüm durumlar'
}

const getSortLabel = (sortKey: CriticalStockSortKey, sortDirection: CriticalStockSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Ürün adına göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportCriticalStockReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  sortKey,
  sortDirection
}: {
  report: CriticalStockReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  sortKey: CriticalStockSortKey
  sortDirection: CriticalStockSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Kritik Stok Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Durum', getCriticalStatusFilterLabel(filters.criticalStatus)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine([
      'Ürün',
      'Kategori',
      'Birim',
      'Mevcut Miktar',
      'Kritik Seviye',
      'Eksik Miktar',
      'Durum',
      'Son Hareket Tarihi',
      'Tahmini Değer'
    ]),
    ...report.rows.map(row => csvLine([
      row.stockName,
      row.categoryName,
      row.unit,
      formatStockQuantity(row.currentQty, row.unit),
      formatStockQuantity(row.minQty, row.unit),
      formatStockQuantity(row.shortage, row.unit),
      row.statusLabel,
      row.lastMovementLabel,
      formatStockMoney(row.estimatedValue, row.currency)
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `kritik-stok-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function CriticalStockReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: CriticalStockReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Kritik Stok</h3>
          <p className="muted">Kritik seviyedeki aktif stok kartları, eksik miktarlar ve ortalama maliyete göre değerleri.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} kritik stok kaydı listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as CriticalStockSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as CriticalStockSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table critical-stock-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Birim</th>
              <th>Mevcut Miktar</th>
              <th>Kritik Seviye</th>
              <th>Eksik Miktar</th>
              <th>Durum</th>
              <th>Son Hareket Tarihi</th>
              <th>Tahmini Değer</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-cell">Bu filtrelere uygun kritik stok kaydı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.stockItemId}>
                <td>
                  <strong>{row.stockName}</strong>
                  {row.sku && <div className="muted small-text">Kod: {row.sku}</div>}
                </td>
                <td>{row.categoryName}</td>
                <td>{row.unit}</td>
                <td>{formatStockQuantity(row.currentQty, row.unit)}</td>
                <td>{formatStockQuantity(row.minQty, row.unit)}</td>
                <td>{formatStockQuantity(row.shortage, row.unit)}</td>
                <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
                <td>{row.lastMovementLabel}</td>
                <td>{formatStockMoney(row.estimatedValue, row.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
