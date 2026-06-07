import React from 'react'
import { DEFAULT_EXPIRY_WARNING_DAYS, formatExpiryDate, getDaysUntilExpiry, isExpiryTracked } from '../../expiryStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockAverageCost, getStockCurrency, roundCost } from '../../stockCost'
import { StockCategory, StockExpiryLot, StockItem, StockUnit } from '../../types'
import { ReportExpiryStatusFilter, ReportFiltersValue, reportExpiryStatusOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type ExpiringProductsSortKey = 'expiryDate' | 'daysLeft' | 'qty' | 'riskValue'
export type ExpiringProductsSortDirection = 'asc' | 'desc'
type ExpiringProductsStatus = Exclude<ReportExpiryStatusFilter, 'all'>

export type ExpiringProductsReportRow = {
  lotId: string
  lotCode: string
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  unit: StockUnit
  expiryDate?: string
  expiryDateLabel: string
  daysLeft: number
  qty: number
  averageCost: number
  riskValue: number
  currency: string
  status: ExpiringProductsStatus
  statusLabel: string
  statusClassName: string
}

export type ExpiringProductsReportResult = {
  rows: ExpiringProductsReportRow[]
  kpis: ReportKpi[]
}

type UseExpiringProductsReportArgs = {
  stockItems: StockItem[]
  categories: StockCategory[]
  expiryLots: StockExpiryLot[]
  filters: ReportFiltersValue
  sortKey: ExpiringProductsSortKey
  sortDirection: ExpiringProductsSortDirection
}

type ExpiringProductsReportProps = {
  report: ExpiringProductsReportResult
  sortKey: ExpiringProductsSortKey
  sortDirection: ExpiringProductsSortDirection
  onSortKeyChange: (sortKey: ExpiringProductsSortKey) => void
  onSortDirectionChange: (sortDirection: ExpiringProductsSortDirection) => void
}

const sortOptions: { value: ExpiringProductsSortKey; label: string }[] = [
  { value: 'expiryDate', label: 'SKT tarihine göre' },
  { value: 'daysLeft', label: 'Kalan güne göre' },
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

const getExpiryStatus = (daysLeft: number): Pick<ExpiringProductsReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(daysLeft <= 2){
    return { status: 'urgent', statusLabel: 'Acil', statusClassName: 'danger-pill' }
  }

  if(daysLeft <= 5){
    return { status: 'approaching', statusLabel: 'Yaklaşıyor', statusClassName: 'warning-pill' }
  }

  return { status: 'watch', statusLabel: 'Takip Et', statusClassName: 'muted-pill' }
}

const getExpiryTime = (value?: string) => {
  if(!value) return Number.MAX_SAFE_INTEGER

  const time = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

const compareRows = (
  first: ExpiringProductsReportRow,
  second: ExpiringProductsReportRow,
  sortKey: ExpiringProductsSortKey,
  sortDirection: ExpiringProductsSortDirection
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
}: UseExpiringProductsReportArgs) => {
  const stockItemMap = buildStockItemMap(stockItems)
  const categoryMap = buildCategoryMap(categories)
  const searchText = normalizeText(filters.search)

  return expiryLots
    .map<ExpiringProductsReportRow | undefined>(lot => {
      const stockItem = stockItemMap.get(lot.stockItemId)
      if(!stockItem || !stockItem.active || !isExpiryTracked(stockItem)) return undefined
      if(lot.remainingQty <= 0) return undefined

      const daysLeft = getDaysUntilExpiry(lot.expiryDate)
      if(daysLeft === null || daysLeft < 0 || daysLeft > DEFAULT_EXPIRY_WARNING_DAYS) return undefined

      const category = categoryMap.get(stockItem.categoryId)
      const averageCost = getStockAverageCost(stockItem)
      const currency = getStockCurrency(stockItem)
      const status = getExpiryStatus(daysLeft)

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
        daysLeft,
        qty: lot.remainingQty,
        averageCost,
        riskValue: roundCost(lot.remainingQty * averageCost),
        currency,
        ...status
      }
    })
    .filter((row): row is ExpiringProductsReportRow => Boolean(row))
    .filter(row => filters.categoryId === 'all' || row.categoryId === filters.categoryId)
    .filter(row => filters.stockItemId === 'all' || row.stockItemId === filters.stockItemId)
    .filter(row => filters.expiryStatus === 'all' || row.status === filters.expiryStatus)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.lotCode).includes(searchText)
        || normalizeText(row.categoryName).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildKpis = (rows: ExpiringProductsReportRow[]): ReportKpi[] => {
  const productCount = new Set(rows.map(row => row.stockItemId)).size
  const totalRiskQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalRiskValue = rows.reduce((sum, row) => sum + row.riskValue, 0)
  const nearestRow = rows.reduce<ExpiringProductsReportRow | undefined>((nearest, row) => {
    if(!nearest) return row
    return row.daysLeft < nearest.daysLeft ? row : nearest
  }, undefined)
  const todayWarningProductCount = new Set(
    rows
      .filter(row => row.daysLeft === DEFAULT_EXPIRY_WARNING_DAYS)
      .map(row => row.stockItemId)
  ).size

  return [
    { label: 'Yaklaşan SKT Ürün Sayısı', value: formatNumber(productCount), detail: 'Filtrelenen benzersiz ürünler' },
    { label: 'Yaklaşan SKT Lot Sayısı', value: formatNumber(rows.length), detail: '0-7 gün içinde SKT lotları' },
    { label: 'Toplam Riskli Miktar', value: formatNumber(totalRiskQty), detail: 'Birimler karma toplam' },
    { label: 'Toplam Riskli Stok Değeri', value: formatStockMoney(totalRiskValue, DEFAULT_STOCK_CURRENCY), detail: 'Miktar x ortalama maliyet' },
    {
      label: 'En Yakın SKT',
      value: nearestRow?.expiryDateLabel || '-',
      detail: nearestRow ? `${nearestRow.stockName} · ${nearestRow.daysLeft} gün kaldı` : 'Yaklaşan SKT yok'
    },
    { label: 'Bugün Uyarı Veren Ürün Sayısı', value: formatNumber(todayWarningProductCount), detail: 'Bugün 7 günlük uyarı aralığına girenler' }
  ]
}

export const useExpiringProductsReport = (args: UseExpiringProductsReportArgs): ExpiringProductsReportResult => {
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

const getExpiryStatusFilterLabel = (value: ReportExpiryStatusFilter) => {
  return reportExpiryStatusOptions.find(option => option.value === value)?.label || 'Tüm durumlar'
}

const getSortLabel = (sortKey: ExpiringProductsSortKey, sortDirection: ExpiringProductsSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'SKT tarihine göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportExpiringProductsReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  sortKey,
  sortDirection
}: {
  report: ExpiringProductsReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  sortKey: ExpiringProductsSortKey
  sortDirection: ExpiringProductsSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'SKT Yaklaşan Ürünler Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Uyarı Eşiği', `${DEFAULT_EXPIRY_WARNING_DAYS} gün`]),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Durum', getExpiryStatusFilterLabel(filters.expiryStatus)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine([
      'Ürün',
      'Lot No',
      'Kategori',
      'SKT',
      'Kalan Gün',
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
      row.daysLeft,
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
  link.download = `skt-yaklasan-urunler-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExpiringProductsReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: ExpiringProductsReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>SKT Yaklaşan Ürünler</h3>
          <p className="muted">Son kullanma tarihi 0-7 gün içinde olan, tükenmemiş ve tarihi geçmemiş lotlar.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} yaklaşan SKT lotu listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as ExpiringProductsSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as ExpiringProductsSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table expiring-products-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Lot No</th>
              <th>Kategori</th>
              <th>SKT</th>
              <th>Kalan Gün</th>
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
                <td colSpan={10} className="empty-cell">Bu filtrelere uygun yaklaşan SKT lotu bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.lotId}>
                <td><strong>{row.stockName}</strong></td>
                <td>{row.lotCode}</td>
                <td>{row.categoryName}</td>
                <td>{row.expiryDateLabel}</td>
                <td>{row.daysLeft}</td>
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
