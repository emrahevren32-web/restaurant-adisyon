import React from 'react'
import { formatStockQuantity, isCriticalStock, isOutOfStock } from '../../criticalStock'
import { getExpiryStatus, getExpiryWarningDays, isExpiryTracked, sortLotsFefo } from '../../expiryStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockCurrency, getStockLastPurchasePrice } from '../../stockCost'
import { StockCategory, StockExpiryLot, StockItem, StockMovement, StockUnit } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type StockStatusSortKey = 'name' | 'currentQty' | 'minQty' | 'estimatedValue'
export type StockStatusSortDirection = 'asc' | 'desc'
type StockStatus = 'healthy' | 'critical' | 'out'
type StockExpiryReportStatus = 'valid' | 'near_expiry' | 'expired' | 'none'

export type StockStatusReportRow = {
  stockItemId: string
  stockName: string
  categoryName: string
  sku: string
  unit: StockUnit
  currentQty: number
  minQty: number
  status: StockStatus
  statusLabel: string
  statusClassName: string
  expiryStatus: StockExpiryReportStatus
  expiryStatusLabel: string
  expiryStatusClassName: string
  lastMovementDate?: string
  lastMovementLabel: string
  currency: string
  estimatedValue: number
}

export type StockStatusReportResult = {
  rows: StockStatusReportRow[]
  kpis: ReportKpi[]
}

type UseStockStatusReportArgs = {
  stockItems: StockItem[]
  categories: StockCategory[]
  movements: StockMovement[]
  expiryLots: StockExpiryLot[]
  filters: ReportFiltersValue
  sortKey: StockStatusSortKey
  sortDirection: StockStatusSortDirection
}

type StockStatusReportProps = {
  report: StockStatusReportResult
  sortKey: StockStatusSortKey
  sortDirection: StockStatusSortDirection
  onSortKeyChange: (sortKey: StockStatusSortKey) => void
  onSortDirectionChange: (sortDirection: StockStatusSortDirection) => void
}

const sortOptions: { value: StockStatusSortKey; label: string }[] = [
  { value: 'name', label: 'Stok adına göre' },
  { value: 'currentQty', label: 'Mevcut miktara göre' },
  { value: 'minQty', label: 'Kritik seviyeye göre' },
  { value: 'estimatedValue', label: 'Tahmini değere göre' }
]

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const getDateKey = (value?: string) => {
  if(!value) return ''

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('sv-SE')
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

const getMovementTime = (movement: StockMovement) => {
  const time = new Date(movement.movementDate || movement.createdAt).getTime()
  return Number.isNaN(time) ? 0 : time
}

const isEntryMovementType = (value: string) => value.includes('Giri')

const buildCategoryMap = (categories: StockCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const buildLastMovementMap = (movements: StockMovement[]) => {
  return movements.reduce<Map<string, StockMovement>>((acc, movement) => {
    const current = acc.get(movement.stockItemId)
    if(!current || getMovementTime(movement) > getMovementTime(current)){
      acc.set(movement.stockItemId, movement)
    }

    return acc
  }, new Map())
}

const buildLastPurchasePriceMap = (movements: StockMovement[]) => {
  return movements.reduce<Map<string, { price: number; time: number }>>((acc, movement) => {
    if(!isEntryMovementType(movement.type) || movement.purchasePrice === undefined) return acc

    const price = Number(movement.purchasePrice)
    if(!Number.isFinite(price) || price < 0) return acc

    const time = getMovementTime(movement)
    const current = acc.get(movement.stockItemId)
    if(!current || time > current.time){
      acc.set(movement.stockItemId, { price, time })
    }

    return acc
  }, new Map())
}

const buildActiveLotsMap = (lots: StockExpiryLot[]) => {
  return lots.reduce<Map<string, StockExpiryLot[]>>((acc, lot) => {
    if(lot.remainingQty <= 0) return acc

    acc.set(lot.stockItemId, [...(acc.get(lot.stockItemId) || []), lot])
    return acc
  }, new Map())
}

const getItemStatus = (item: StockItem): Pick<StockStatusReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(isOutOfStock(item)){
    return { status: 'out', statusLabel: 'Stok Yok', statusClassName: 'danger-pill' }
  }

  if(isCriticalStock(item)){
    return { status: 'critical', statusLabel: 'Kritik', statusClassName: 'warning-pill' }
  }

  return { status: 'healthy', statusLabel: 'Sağlıklı', statusClassName: 'success' }
}

const getItemExpiryReportStatus = (
  item: StockItem,
  lots: StockExpiryLot[]
): Pick<StockStatusReportRow, 'expiryStatus' | 'expiryStatusLabel' | 'expiryStatusClassName'> => {
  if(!isExpiryTracked(item)){
    return { expiryStatus: 'none', expiryStatusLabel: 'SKT Yok', expiryStatusClassName: 'muted-pill' }
  }

  const activeLots = sortLotsFefo(lots)
  if(activeLots.length === 0){
    return { expiryStatus: 'none', expiryStatusLabel: 'SKT Yok', expiryStatusClassName: 'muted-pill' }
  }

  const warningDays = getExpiryWarningDays(item)
  const statuses = activeLots.map(lot => getExpiryStatus(lot, warningDays))

  if(statuses.includes('expired')){
    return { expiryStatus: 'expired', expiryStatusLabel: 'Geçmiş', expiryStatusClassName: 'danger-pill' }
  }

  if(statuses.includes('near_expiry')){
    return { expiryStatus: 'near_expiry', expiryStatusLabel: 'Yaklaşıyor', expiryStatusClassName: 'warning-pill' }
  }

  if(statuses.includes('valid')){
    return { expiryStatus: 'valid', expiryStatusLabel: 'Geçerli', expiryStatusClassName: 'success' }
  }

  return { expiryStatus: 'none', expiryStatusLabel: 'SKT Yok', expiryStatusClassName: 'muted-pill' }
}

const getLatestUnitPrice = (
  item: StockItem,
  lastPurchasePriceByStockItem: Map<string, { price: number; time: number }>
) => {
  const itemPrice = getStockLastPurchasePrice(item)
  if(itemPrice > 0 || item.lastPurchasePrice !== undefined) return itemPrice

  return lastPurchasePriceByStockItem.get(item.id)?.price || 0
}

const matchesDateFilters = (lastMovementDate: string | undefined, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const movementDateKey = getDateKey(lastMovementDate)
  if(!movementDateKey) return false

  if(filters.startDate && movementDateKey < filters.startDate) return false
  if(filters.endDate && movementDateKey > filters.endDate) return false

  return true
}

const compareRows = (
  first: StockStatusReportRow,
  second: StockStatusReportRow,
  sortKey: StockStatusSortKey,
  sortDirection: StockStatusSortDirection
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

const buildRows = ({
  stockItems,
  categories,
  movements,
  expiryLots,
  filters,
  sortKey,
  sortDirection
}: UseStockStatusReportArgs) => {
  const categoryMap = buildCategoryMap(categories)
  const lastMovementByStockItem = buildLastMovementMap(movements)
  const lastPurchasePriceByStockItem = buildLastPurchasePriceMap(movements)
  const activeLotsByStockItem = buildActiveLotsMap(expiryLots)
  const searchText = normalizeText(filters.search)

  return stockItems
    .filter(item => item.active)
    .filter(item => filters.categoryId === 'all' || item.categoryId === filters.categoryId)
    .filter(item => filters.stockItemId === 'all' || item.id === filters.stockItemId)
    .map<StockStatusReportRow>(item => {
      const category = categoryMap.get(item.categoryId)
      const lastMovement = lastMovementByStockItem.get(item.id)
      const lastMovementDate = lastMovement?.movementDate || lastMovement?.createdAt
      const unitPrice = getLatestUnitPrice(item, lastPurchasePriceByStockItem)
      const currency = getStockCurrency(item)
      const itemStatus = getItemStatus(item)
      const expiryStatus = getItemExpiryReportStatus(item, activeLotsByStockItem.get(item.id) || [])

      return {
        stockItemId: item.id,
        stockName: item.name,
        categoryName: category?.name || 'Kategori yok',
        sku: item.sku || '',
        unit: item.unit,
        currentQty: item.currentQty,
        minQty: item.minQty,
        ...itemStatus,
        ...expiryStatus,
        lastMovementDate,
        lastMovementLabel: formatDateTime(lastMovementDate),
        currency,
        estimatedValue: Math.max(0, item.currentQty) * unitPrice
      }
    })
    .filter(row => matchesDateFilters(row.lastMovementDate, filters))
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.categoryName).includes(searchText)
        || normalizeText(row.sku).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildKpis = (rows: StockStatusReportRow[]): ReportKpi[] => {
  const totalStockQty = rows.reduce((sum, row) => sum + row.currentQty, 0)
  const criticalCount = rows.filter(row => row.status === 'critical' || row.status === 'out').length
  const outOfStockCount = rows.filter(row => row.status === 'out').length
  const expiryRiskCount = rows.filter(row => row.expiryStatus === 'near_expiry' || row.expiryStatus === 'expired').length
  const totalEstimatedValue = rows.reduce((sum, row) => sum + row.estimatedValue, 0)

  return [
    { label: 'Toplam Aktif Stok Kartı', value: formatNumber(rows.length), detail: 'Filtrelenen aktif kartlar' },
    { label: 'Toplam Stok Miktarı', value: formatNumber(totalStockQty), detail: 'Birimler karma toplam' },
    { label: 'Kritik Stoktaki Ürün Sayısı', value: formatNumber(criticalCount), detail: 'Kritik eşik veya altında' },
    { label: 'Stokta Olmayan Ürün Sayısı', value: formatNumber(outOfStockCount), detail: 'Mevcut miktarı 0 veya altı' },
    { label: 'SKT Riskli Ürün Sayısı', value: formatNumber(expiryRiskCount), detail: 'Yaklaşan veya geçmiş SKT' },
    { label: 'Toplam Tahmini Stok Değeri', value: formatStockMoney(totalEstimatedValue, DEFAULT_STOCK_CURRENCY), detail: 'Mevcut miktar x son alış fiyatı' }
  ]
}

export const useStockStatusReport = (args: UseStockStatusReportArgs): StockStatusReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args)
    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.stockItems,
    args.categories,
    args.movements,
    args.expiryLots,
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

export const exportStockStatusReportCsv = ({
  report,
  filters,
  categories,
  stockItems
}: {
  report: StockStatusReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Stok Durum Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine([
      'Stok Adı',
      'Kategori',
      'Birim',
      'Mevcut Miktar',
      'Kritik Seviye',
      'Durum',
      'SKT Durumu',
      'Son Hareket Tarihi',
      'Tahmini Stok Değeri'
    ]),
    ...report.rows.map(row => csvLine([
      row.stockName,
      row.categoryName,
      row.unit,
      formatStockQuantity(row.currentQty, row.unit),
      formatStockQuantity(row.minQty, row.unit),
      row.statusLabel,
      row.expiryStatusLabel,
      row.lastMovementLabel,
      formatStockMoney(row.estimatedValue, row.currency)
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stok-durum-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function StockStatusReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: StockStatusReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Stok Durum</h3>
          <p className="muted">Aktif stok kartları, güncel miktarlar, kritik durumlar ve tahmini stok değeri.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} stok kartı listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as StockStatusSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as StockStatusSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table stock-status-report-table">
          <thead>
            <tr>
              <th>Stok Adı</th>
              <th>Kategori</th>
              <th>Birim</th>
              <th>Mevcut Miktar</th>
              <th>Kritik Seviye</th>
              <th>Durum</th>
              <th>SKT Durumu</th>
              <th>Son Hareket Tarihi</th>
              <th>Tahmini Stok Değeri</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-cell">Bu filtrelere uygun stok kartı bulunamadı.</td>
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
                <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
                <td><span className={`status-pill ${row.expiryStatusClassName}`}>{row.expiryStatusLabel}</span></td>
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
