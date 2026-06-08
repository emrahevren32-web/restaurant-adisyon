import React from 'react'
import { formatStockQuantity } from '../../criticalStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockConsumptionUnitCost, roundCost } from '../../stockCost'
import { StockCategory, StockItem, StockMovement, StockUnit } from '../../types'
import { ReportFiltersValue, ReportTurnoverStatusFilter, reportTurnoverStatusOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type StockTurnoverSortKey = 'turnoverRate' | 'consumptionCost' | 'consumedQty'
export type StockTurnoverSortDirection = 'asc' | 'desc'
type StockTurnoverStatus = Exclude<ReportTurnoverStatusFilter, 'all'>

export type StockTurnoverReportRow = {
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  unit: StockUnit
  averageStockQty: number
  consumedQty: number
  turnoverRate: number
  lastConsumptionDate?: string
  lastConsumptionLabel: string
  consumptionCost: number
  last30ConsumedQty: number
  last30ConsumptionCost: number
  status: StockTurnoverStatus
  statusLabel: string
  statusClassName: string
  currency: string
}

export type StockTurnoverReportResult = {
  rows: StockTurnoverReportRow[]
  kpis: ReportKpi[]
}

type UseStockTurnoverReportArgs = {
  stockItems: StockItem[]
  categories: StockCategory[]
  movements: StockMovement[]
  filters: ReportFiltersValue
  sortKey: StockTurnoverSortKey
  sortDirection: StockTurnoverSortDirection
}

type StockTurnoverReportProps = {
  report: StockTurnoverReportResult
  sortKey: StockTurnoverSortKey
  sortDirection: StockTurnoverSortDirection
  onSortKeyChange: (sortKey: StockTurnoverSortKey) => void
  onSortDirectionChange: (sortDirection: StockTurnoverSortDirection) => void
}

const sortOptions: { value: StockTurnoverSortKey; label: string }[] = [
  { value: 'turnoverRate', label: 'Devir hızına göre' },
  { value: 'consumptionCost', label: 'Tüketim maliyetine göre' },
  { value: 'consumedQty', label: 'Tüketilen miktara göre' }
]

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

const formatRate = (value: number) => {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}

const normalizeText = (value?: string) => {
  return (value || '').trim().toLocaleLowerCase('tr-TR')
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

const roundQty = (value: number) => {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000
}

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const getMovementDate = (movement: StockMovement) => {
  return movement.movementDate || movement.createdAt
}

const isEntryMovementType = (value: string) => value.includes('Giri')
const isCountMovementType = (value: string) => value.includes('Say')

const isReverseMovement = (movement: StockMovement) => {
  return Boolean(movement.reversesMovementId || movement.reverseOfBatchId || movement.reason === 'Ters Hareket')
}

const isConsumptionMovement = (movement: StockMovement) => {
  return !isEntryMovementType(movement.type) && !isCountMovementType(movement.type) && !isReverseMovement(movement)
}

const buildCategoryMap = (categories: StockCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const buildMovementsByStockItem = (movements: StockMovement[]) => {
  return movements.reduce<Map<string, StockMovement[]>>((acc, movement) => {
    acc.set(movement.stockItemId, [...(acc.get(movement.stockItemId) || []), movement])
    return acc
  }, new Map())
}

const matchesDateFilters = (dateValue: string | undefined, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const dateKey = getDateKey(dateValue)
  if(!dateKey) return false

  if(filters.startDate && dateKey < filters.startDate) return false
  if(filters.endDate && dateKey > filters.endDate) return false

  return true
}

const getLast30StartKey = () => {
  const start = new Date()
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return getDateKey(start)
}

const getTodayKey = () => getDateKey(new Date())

const getMovementQty = (movement: StockMovement) => {
  return toPositiveNumber(movement.qty) || 0
}

const getMovementUnitCost = (movement: StockMovement, stockItem: StockItem) => {
  const movementUnitCost = toPositiveNumber(movement.unitCost)
  if(movementUnitCost !== undefined) return movementUnitCost

  const totalCost = toPositiveNumber(movement.totalCost)
  const qty = getMovementQty(movement)
  if(totalCost !== undefined && qty > 0) return roundCost(totalCost / qty)

  return getStockConsumptionUnitCost(stockItem)
}

const getMovementCost = (movement: StockMovement, stockItem: StockItem) => {
  const totalCost = toPositiveNumber(movement.totalCost)
  if(totalCost !== undefined) return totalCost

  return roundCost(getMovementQty(movement) * getMovementUnitCost(movement, stockItem))
}

const getAverageStockQty = (stockItem: StockItem, movements: StockMovement[], filters: ReportFiltersValue) => {
  const periodConsumptionMovements = movements
    .filter(movement => isConsumptionMovement(movement))
    .filter(movement => matchesDateFilters(getMovementDate(movement), filters))
    .sort((first, second) => getTime(getMovementDate(first)) - getTime(getMovementDate(second)))

  if(periodConsumptionMovements.length === 0) return Math.max(0, stockItem.currentQty)

  const firstMovement = periodConsumptionMovements[0]
  const lastMovement = periodConsumptionMovements[periodConsumptionMovements.length - 1]
  const startQty = toPositiveNumber(firstMovement.previousQty) ?? Math.max(0, stockItem.currentQty)
  const endQty = toPositiveNumber(lastMovement.nextQty) ?? Math.max(0, stockItem.currentQty)

  return roundQty(Math.max(0, (startQty + endQty) / 2))
}

const getStatusMeta = (turnoverRate: number): Pick<StockTurnoverReportRow, 'status' | 'statusLabel' | 'statusClassName'> => {
  if(turnoverRate > 5){
    return { status: 'fast', statusLabel: 'Hızlı', statusClassName: 'success' }
  }

  if(turnoverRate >= 1){
    return { status: 'normal', statusLabel: 'Normal', statusClassName: '' }
  }

  return { status: 'slow', statusLabel: 'Yavaş', statusClassName: 'warning-pill' }
}

const buildRows = ({
  stockItems,
  categories,
  movements,
  filters
}: Pick<UseStockTurnoverReportArgs, 'stockItems' | 'categories' | 'movements' | 'filters'>) => {
  const categoryMap = buildCategoryMap(categories)
  const movementsByStockItem = buildMovementsByStockItem(movements)
  const searchText = normalizeText(filters.search)
  const last30StartKey = getLast30StartKey()
  const todayKey = getTodayKey()

  return stockItems
    .filter(item => item.active)
    .filter(item => filters.categoryId === 'all' || item.categoryId === filters.categoryId)
    .filter(item => filters.stockItemId === 'all' || item.id === filters.stockItemId)
    .map<StockTurnoverReportRow>(item => {
      const itemMovements = movementsByStockItem.get(item.id) || []
      const category = categoryMap.get(item.categoryId)
      const consumptionMovements = itemMovements.filter(movement => isConsumptionMovement(movement))
      const filteredConsumptionMovements = consumptionMovements.filter(movement => matchesDateFilters(getMovementDate(movement), filters))
      const last30ConsumptionMovements = consumptionMovements.filter(movement => {
        const dateKey = getDateKey(getMovementDate(movement))
        return Boolean(dateKey && dateKey >= last30StartKey && dateKey <= todayKey)
      })
      const averageStockQty = getAverageStockQty(item, itemMovements, filters)
      const consumedQty = roundQty(filteredConsumptionMovements.reduce((sum, movement) => sum + getMovementQty(movement), 0))
      const consumptionCost = roundCost(filteredConsumptionMovements.reduce((sum, movement) => sum + getMovementCost(movement, item), 0))
      const turnoverRate = averageStockQty > 0 ? roundQty(consumedQty / averageStockQty) : 0
      const lastConsumption = [...filteredConsumptionMovements].sort((first, second) => getTime(getMovementDate(second)) - getTime(getMovementDate(first)))[0]
      const last30ConsumedQty = roundQty(last30ConsumptionMovements.reduce((sum, movement) => sum + getMovementQty(movement), 0))
      const last30ConsumptionCost = roundCost(last30ConsumptionMovements.reduce((sum, movement) => sum + getMovementCost(movement, item), 0))
      const statusMeta = getStatusMeta(turnoverRate)

      return {
        stockItemId: item.id,
        stockName: item.name,
        categoryId: item.categoryId,
        categoryName: category?.name || 'Kategori yok',
        unit: item.unit,
        averageStockQty,
        consumedQty,
        turnoverRate,
        lastConsumptionDate: lastConsumption ? getMovementDate(lastConsumption) : undefined,
        lastConsumptionLabel: formatDateTime(lastConsumption ? getMovementDate(lastConsumption) : undefined),
        consumptionCost,
        last30ConsumedQty,
        last30ConsumptionCost,
        ...statusMeta,
        currency: item.currency || DEFAULT_STOCK_CURRENCY
      }
    })
    .filter(row => filters.turnoverStatus === 'all' || row.status === filters.turnoverStatus)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.categoryName).includes(searchText)
    })
}

const compareRows = (
  first: StockTurnoverReportRow,
  second: StockTurnoverReportRow,
  sortKey: StockTurnoverSortKey,
  sortDirection: StockTurnoverSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  const result = (first[sortKey] - second[sortKey]) * directionMultiplier
  if(result !== 0) return result

  return first.stockName.localeCompare(second.stockName, 'tr-TR')
}

const buildKpis = (rows: StockTurnoverReportRow[]): ReportKpi[] => {
  const totalAverageStock = rows.reduce((sum, row) => sum + row.averageStockQty, 0)
  const totalConsumedQty = rows.reduce((sum, row) => sum + row.consumedQty, 0)
  const averageTurnoverRate = totalAverageStock > 0 ? roundQty(totalConsumedQty / totalAverageStock) : 0
  const fastestProduct = [...rows].sort((first, second) => second.turnoverRate - first.turnoverRate || second.consumedQty - first.consumedQty)[0]
  const slowestProduct = [...rows].sort((first, second) => first.turnoverRate - second.turnoverRate || second.averageStockQty - first.averageStockQty)[0]
  const last30ConsumptionCost = roundCost(rows.reduce((sum, row) => sum + row.last30ConsumptionCost, 0))
  const last30ConsumedProductCount = rows.filter(row => row.last30ConsumedQty > 0).length
  const riskySlowProductCount = rows.filter(row => row.status === 'slow' && row.averageStockQty > 0).length

  return [
    { label: 'Ortalama Stok Devir Hızı', value: formatRate(averageTurnoverRate), detail: 'Toplam tüketim / ortalama stok' },
    {
      label: 'En Hızlı Dönen Ürün',
      value: fastestProduct?.stockName || '-',
      detail: fastestProduct ? `${formatRate(fastestProduct.turnoverRate)} devir` : 'Tüketim yok'
    },
    {
      label: 'En Yavaş Dönen Ürün',
      value: slowestProduct?.stockName || '-',
      detail: slowestProduct ? `${formatRate(slowestProduct.turnoverRate)} devir` : 'Stok kartı yok'
    },
    { label: 'Son 30 Gün Tüketim Maliyeti', value: formatStockMoney(last30ConsumptionCost, DEFAULT_STOCK_CURRENCY), detail: 'Bugünden geriye 30 günlük çıkış maliyeti' },
    { label: 'Son 30 Gün Tüketilen Ürün Sayısı', value: formatNumber(last30ConsumedProductCount), detail: 'Son 30 günde tüketimi olan stok kartı' },
    { label: 'Riskli Yavaş Dönen Ürün Sayısı', value: formatNumber(riskySlowProductCount), detail: 'Devir hızı 1 altında ve stokta mevcut' }
  ]
}

export const useStockTurnoverReport = (args: UseStockTurnoverReportArgs): StockTurnoverReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args).sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.stockItems,
    args.categories,
    args.movements,
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

const getTurnoverStatusFilterLabel = (value: ReportTurnoverStatusFilter) => {
  return reportTurnoverStatusOptions.find(option => option.value === value)?.label || 'Tüm durumlar'
}

const getSortLabel = (sortKey: StockTurnoverSortKey, sortDirection: StockTurnoverSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Devir hızına göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportStockTurnoverReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  sortKey,
  sortDirection
}: {
  report: StockTurnoverReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  sortKey: StockTurnoverSortKey
  sortDirection: StockTurnoverSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Stok Devir Hızı Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Durum', getTurnoverStatusFilterLabel(filters.turnoverStatus)]),
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
      'Birim',
      'Ortalama Stok',
      'Tüketilen Miktar',
      'Devir Hızı',
      'Son Tüketim Tarihi',
      'Tüketim Maliyeti',
      'Durum'
    ]),
    ...report.rows.map(row => csvLine([
      row.stockName,
      row.categoryName,
      row.unit,
      formatStockQuantity(row.averageStockQty, row.unit),
      formatStockQuantity(row.consumedQty, row.unit),
      formatRate(row.turnoverRate),
      row.lastConsumptionLabel,
      formatStockMoney(row.consumptionCost, row.currency),
      row.statusLabel
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stok-devir-hizi-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function StockTurnoverReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: StockTurnoverReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Stok Devir Hızı</h3>
          <p className="muted">Stok kartlarının tüketim miktarı, ortalama stok seviyesi ve devir hızına göre analizi.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} stok kartı listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as StockTurnoverSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as StockTurnoverSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table stock-turnover-report-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Kategori</th>
              <th>Birim</th>
              <th>Ortalama Stok</th>
              <th>Tüketilen Miktar</th>
              <th>Devir Hızı</th>
              <th>Son Tüketim Tarihi</th>
              <th>Tüketim Maliyeti</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-cell">Bu filtrelere uygun stok devir hızı kaydı bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.stockItemId}>
                <td><strong>{row.stockName}</strong></td>
                <td>{row.categoryName}</td>
                <td>{row.unit}</td>
                <td>{formatStockQuantity(row.averageStockQty, row.unit)}</td>
                <td>{formatStockQuantity(row.consumedQty, row.unit)}</td>
                <td>{formatRate(row.turnoverRate)}</td>
                <td>{row.lastConsumptionLabel}</td>
                <td>{formatStockMoney(row.consumptionCost, row.currency)}</td>
                <td><span className={`status-pill ${row.statusClassName}`}>{row.statusLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
