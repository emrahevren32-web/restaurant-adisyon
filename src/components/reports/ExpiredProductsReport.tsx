import React from 'react'
import { formatExpiryDate, getDaysUntilExpiry, isExpiryTracked } from '../../expiryStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockAverageCost, getStockCurrency, roundCost } from '../../stockCost'
import { StockCategory, StockExpiryLot, StockItem, StockUnit } from '../../types'
import { ReportExpiredStatusFilter, ReportFiltersValue, reportExpiredStatusOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type ExpiredProductsSortKey = 'expiryDate' | 'daysPast' | 'qty' | 'riskValue'
export type ExpiredProductsSortDirection = 'asc' | 'desc'
type ExpiredProductsStatus = Exclude<ReportExpiredStatusFilter, 'all'>

export type ExpiredProductsReportRow = {
  lotId: string
  lotCode: string
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  unit: StockUnit
  expiryDate?: string
  expiryDateLabel: string
  daysPast: number
  qty: number
  averageCost: number
  riskValue: number
  currency: string
  status: ExpiredProductsStatus
  statusLabel: string
  statusClassName: string
}

export type ExpiredProductsReportResult = {
  rows: ExpiredProductsReportRow[]
  kpis: ReportKpi[]
}

type UseExpiredProductsReportArgs = {
  stockItems: StockItem[]
  categories: StockCategory[]
  expiryLots: StockExpiryLot[]
  filters: ReportFiltersValue
  sortKey: ExpiredProductsSortKey
  sortDirection: ExpiredProductsSortDirection
}

type ExpiredProductsReportProps = {
  report: ExpiredProductsReportResult
  sortKey: ExpiredProductsSortKey
  sortDirection: ExpiredProductsSortDirection
  onSortKeyChange: (sortKey: ExpiredProductsSortKey) => void
  onSortDirectionChange: (sortDirection: ExpiredProductsSortDirection) => void
}

const sortOptions: { value: ExpiredProductsSortKey; label: string }[] = [
  { value: 'expiryDate', label: 'SKT tarihine göre' },
  { value: 'daysPast', label: 'Kaç gün geçtiğine göre' },
  { value: 'qty', label: 'Miktara göre' },
  { value: 'riskValue', label: 'Riskli değere göre' }
]

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
}

const buildStockItemMap = (items: StockItem[]) => {
  return new Map(items.map(item => [item.id, item]))
}

const buildCategoryMap = (categories: StockCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const getExpiredStatus = (daysPast: number): Pick<ExpiredProductsReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(daysPast <= 7){
    return { status: 'newly-expired', statusLabel: 'Yeni Geçmiş', statusClassName: 'warning-pill' }
  }

  if(daysPast <= 30){
    return { status: 'critical', statusLabel: 'Kritik', statusClassName: 'danger-pill' }
  }

  return { status: 'dispose', statusLabel: 'İmha Edilmeli', statusClassName: 'danger-pill' }
}

const getExpiryTime = (value?: string) => {
  if(!value) return Number.MAX_SAFE_INTEGER

  const time = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

const compareRows = (
  first: ExpiredProductsReportRow,
  second: ExpiredProductsReportRow,
  sortKey: ExpiredProductsSortKey,
  sortDirection: ExpiredProductsSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'expiryDate'){
    result = getExpiryTime(first.expiryDate) - getExpiryTime(second.expiryDate)
  } else {
    result = first[sortKey] - second[sortKey]
  }

  if(result === 0){
    result = first.stockName.localeCompare(second.stockName, 'tr-TR')
  }

  if(result === 0){
    result = first.lotCode.localeCompare(second.lotCode, 'tr-TR')
  }

  return result * directionMultiplier
}

const buildRows = ({
  stockItems,
  categories,
  expiryLots,
  filters,
  sortKey,
  sortDirection
}: UseExpiredProductsReportArgs) => {
  const stockItemMap = buildStockItemMap(stockItems)
  const categoryMap = buildCategoryMap(categories)
  const searchText = normalizeText(filters.search)

  return expiryLots
    .map<ExpiredProductsReportRow | undefined>(lot => {
      const stockItem = stockItemMap.get(lot.stockItemId)
      if(!stockItem || !stockItem.active || !isExpiryTracked(stockItem)) return undefined
      if(lot.remainingQty <= 0) return undefined

      const daysLeft = getDaysUntilExpiry(lot.expiryDate)
      if(daysLeft === null || daysLeft >= 0) return undefined

      const daysPast = Math.abs(daysLeft)
      const category = categoryMap.get(stockItem.categoryId)
      const averageCost = getStockAverageCost(stockItem)
      const currency = getStockCurrency(stockItem)
      const status = getExpiredStatus(daysPast)

      return {
        lotId: lot.id,
        lotCode: lot.lotCode,
        stockItemId: stockItem.id,
        stockName: stockItem.name,
        categoryId: stockItem.categoryId,
        categoryName: category?.name || 'Kategori yok',
        unit: lot.unit || stockItem.unit,
        expiryDate: lot.expiryDate,
        expiryDateLabel: formatExpiryDate(lot.expiryDate),
        daysPast,
        qty: lot.remainingQty,
        averageCost,
        riskValue: roundCost(lot.remainingQty * averageCost),
        currency,
        ...status
      }
    })
    .filter((row): row is ExpiredProductsReportRow => Boolean(row))
    .filter(row => filters.categoryId === 'all' || row.categoryId === filters.categoryId)
    .filter(row => filters.stockItemId === 'all' || row.stockItemId === filters.stockItemId)
    .filter(row => filters.expiredStatus === 'all' || row.status === filters.expiredStatus)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.lotCode).includes(searchText)
        || normalizeText(row.categoryName).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildKpis = (rows: ExpiredProductsReportRow[]): ReportKpi[] => {
  const productCount = new Set(rows.map(row => row.stockItemId)).size
  const totalExpiredQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalRiskValue = rows.reduce((sum, row) => sum + row.riskValue, 0)
  const oldestRow = rows.reduce<ExpiredProductsReportRow | undefined>((oldest, row) => {
    if(!oldest) return row
    return getExpiryTime(row.expiryDate) < getExpiryTime(oldest.expiryDate) ? row : oldest
  }, undefined)
  const recentExpiredProductCount = new Set(
    rows
      .filter(row => row.daysPast <= 7)
      .map(row => row.stockItemId)
  ).size

  return [
    { label: 'SKT Geçmiş Ürün Sayısı', value: formatNumber(productCount), detail: 'Filtrelenen benzersiz ürünler' },
    { label: 'SKT Geçmiş Lot Sayısı', value: formatNumber(rows.length), detail: 'SKT tarihi bugünden eski lotlar' },
    { label: 'Toplam Geçmiş Miktar', value: formatNumber(totalExpiredQty), detail: 'Birimler karma toplam' },
    { label: 'Toplam Riskli Stok Değeri', value: formatStockMoney(totalRiskValue, DEFAULT_STOCK_CURRENCY), detail: 'Miktar x ortalama maliyet' },
    {
      label: 'En Eski Geçmiş SKT',
      value: oldestRow?.expiryDateLabel || '-',
      detail: oldestRow ? `${oldestRow.stockName} · ${oldestRow.daysPast} gün geçti` : 'SKT geçmiş lot yok'
    },
    { label: "Son 7 Günde SKT'si Geçen Ürün Sayısı", value: formatNumber(recentExpiredProductCount), detail: 'Son 7 gün içinde tarihi geçenler' }
  ]
}

export const useExpiredProductsReport = (args: UseExpiredProductsReportArgs): ExpiredProductsReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args)
    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.stockItems,
    args.categories,
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

const getExpiredStatusFilterLabel = (value: ReportExpiredStatusFilter) => {
  return reportExpiredStatusOptions.find(option => option.value === value)?.label || 'Tüm durumlar'
}

const getSortLabel = (sortKey: ExpiredProductsSortKey, sortDirection: ExpiredProductsSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'SKT tarihine göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportExpiredProductsReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  sortKey,
  sortDirection
}: {
  report: ExpiredProductsReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  sortKey: ExpiredProductsSortKey
  sortDirection: ExpiredProductsSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'SKT Geçmiş Ürünler Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Kapsam', 'SKT tarihi bugünden eski lotlar']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Durum', getExpiredStatusFilterLabel(filters.expiredStatus)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine([
      'Ürün',
      'Lot No',
      'Kategori',
      'SKT',
      'Kaç Gün Geçti',
      'Miktar',
      'Birim',
      'Ortalama Maliyet',
      'Riskli Değer',
      'Durum'
    ]),
    ...report.rows.map(row => csvLine([
      row.stockName,
      row.lotCode,
      row.categoryName,
      row.expiryDateLabel,
      row.daysPast,
      formatNumber(row.qty),
      row.unit,
      formatStockMoney(row.averageCost, row.currency),
      formatStockMoney(row.riskValue, row.currency),
      row.statusLabel
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `skt-gecmis-urunler-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExpiredProductsReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: ExpiredProductsReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>SKT Geçmiş Ürünler</h3>
          <p className="muted">Son kullanma tarihi bugünden eski, tükenmemiş lotlar.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} SKT geçmiş lot listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as ExpiredProductsSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as ExpiredProductsSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table expired-products-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Lot No</th>
              <th>Kategori</th>
              <th>SKT</th>
              <th>Kaç Gün Geçti</th>
              <th>Miktar</th>
              <th>Birim</th>
              <th>Ortalama Maliyet</th>
              <th>Riskli Değer</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-cell">Bu filtrelere uygun SKT geçmiş lot bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.lotId}>
                <td><strong>{row.stockName}</strong></td>
                <td>{row.lotCode}</td>
                <td>{row.categoryName}</td>
                <td>{row.expiryDateLabel}</td>
                <td>{row.daysPast}</td>
                <td>{formatNumber(row.qty)}</td>
                <td>{row.unit}</td>
                <td>{formatStockMoney(row.averageCost, row.currency)}</td>
                <td>{formatStockMoney(row.riskValue, row.currency)}</td>
                <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
