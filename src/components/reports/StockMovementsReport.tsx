import React from 'react'
import { formatStockQuantity } from '../../criticalStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, roundCost } from '../../stockCost'
import { StockCategory, StockItem, StockMovement, User } from '../../types'
import { ReportFiltersValue, ReportMovementTypeFilter, reportMovementTypeOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type StockMovementsSortKey = 'date' | 'product' | 'qty' | 'amount'
export type StockMovementsSortDirection = 'asc' | 'desc'
type StockMovementOperationType = Exclude<ReportMovementTypeFilter, 'all'>

export type StockMovementReportRow = {
  id: string
  movementDate: string
  movementDateLabel: string
  sortTime: number
  stockItemId: string
  stockName: string
  categoryId: string
  operationType: StockMovementOperationType
  operationLabel: string
  operationClassName: string
  source: string
  reason: string
  qty: number
  unit: StockMovement['unit']
  unitCost: number
  movementAmount: number
  currency: string
  userId: string
  userName: string
  description: string
}

export type StockMovementsReportResult = {
  rows: StockMovementReportRow[]
  kpis: ReportKpi[]
}

type UseStockMovementsReportArgs = {
  movements: StockMovement[]
  stockItems: StockItem[]
  filters: ReportFiltersValue
  sortKey: StockMovementsSortKey
  sortDirection: StockMovementsSortDirection
}

type StockMovementsReportProps = {
  report: StockMovementsReportResult
  sortKey: StockMovementsSortKey
  sortDirection: StockMovementsSortDirection
  onSortKeyChange: (sortKey: StockMovementsSortKey) => void
  onSortDirectionChange: (sortDirection: StockMovementsSortDirection) => void
}

const sortOptions: { value: StockMovementsSortKey; label: string }[] = [
  { value: 'date', label: 'Tarihe göre' },
  { value: 'product', label: 'Ürüne göre' },
  { value: 'qty', label: 'Miktara göre' },
  { value: 'amount', label: 'Hareket tutarına göre' }
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

const getOperationLabel = (operationType: StockMovementOperationType) => {
  return reportMovementTypeOptions.find(option => option.value === operationType)?.label || '-'
}

const getOperationClassName = (operationType: StockMovementOperationType) => {
  if(operationType === 'entry') return 'success'
  if(operationType === 'exit') return 'danger-pill'
  if(operationType === 'waste') return 'warning-pill'
  if(operationType === 'reverse') return 'muted-pill'
  return ''
}

const isEntryMovementType = (value: string) => value.includes('Giri')
const isCountMovementType = (value: string) => value.includes('Say')

const getOperationType = (movement: StockMovement): StockMovementOperationType => {
  if(movement.reversesMovementId || movement.reverseOfBatchId || movement.reason === 'Ters Hareket'){
    return 'reverse'
  }

  if(movement.source === 'Fire' || movement.reason === 'Fire' || movement.sourceEntityType === 'Fire' || movement.wasteRecordId){
    return 'waste'
  }

  if(isCountMovementType(movement.type)) return 'count'
  if(isEntryMovementType(movement.type)) return 'entry'

  return 'exit'
}

const toCostNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const getMovementUnitCost = (movement: StockMovement) => {
  const unitCost = toCostNumber(movement.unitCost)
  if(unitCost !== undefined) return unitCost

  const purchasePrice = toCostNumber(movement.purchasePrice)
  if(purchasePrice !== undefined) return purchasePrice

  const totalCost = toCostNumber(movement.totalCost)
  const qty = toCostNumber(movement.qty)
  if(totalCost !== undefined && qty && qty > 0) return roundCost(totalCost / qty)

  return 0
}

const buildStockItemMap = (items: StockItem[]) => {
  return new Map(items.map(item => [item.id, item]))
}

const matchesDateFilters = (movementDate: string, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const movementDateKey = getDateKey(movementDate)
  if(!movementDateKey) return false

  if(filters.startDate && movementDateKey < filters.startDate) return false
  if(filters.endDate && movementDateKey > filters.endDate) return false

  return true
}

const compareRows = (
  first: StockMovementReportRow,
  second: StockMovementReportRow,
  sortKey: StockMovementsSortKey,
  sortDirection: StockMovementsSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'date'){
    result = first.sortTime - second.sortTime
  } else if(sortKey === 'product'){
    result = first.stockName.localeCompare(second.stockName, 'tr-TR')
  } else if(sortKey === 'qty'){
    result = first.qty - second.qty
  } else {
    result = first.movementAmount - second.movementAmount
  }

  if(result === 0){
    result = second.sortTime - first.sortTime
  }

  return result * directionMultiplier
}

const buildRows = ({
  movements,
  stockItems,
  filters,
  sortKey,
  sortDirection
}: UseStockMovementsReportArgs) => {
  const stockItemMap = buildStockItemMap(stockItems)
  const searchText = normalizeText(filters.search)

  return movements
    .map<StockMovementReportRow>(movement => {
      const stockItem = stockItemMap.get(movement.stockItemId)
      const operationType = getOperationType(movement)
      const movementDate = movement.movementDate || movement.createdAt
      const unitCost = getMovementUnitCost(movement)
      const qty = Number.isFinite(Number(movement.qty)) ? Math.max(0, Number(movement.qty)) : 0

      return {
        id: movement.id,
        movementDate,
        movementDateLabel: formatDateTime(movementDate),
        sortTime: getTime(movementDate),
        stockItemId: movement.stockItemId,
        stockName: movement.stockItemName || stockItem?.name || 'Stok Kartı',
        categoryId: stockItem?.categoryId || '',
        operationType,
        operationLabel: getOperationLabel(operationType),
        operationClassName: getOperationClassName(operationType),
        source: movement.source || '-',
        reason: movement.reason || '-',
        qty,
        unit: movement.unit,
        unitCost,
        movementAmount: roundCost(qty * unitCost),
        currency: movement.currency || DEFAULT_STOCK_CURRENCY,
        userId: movement.createdByUserId,
        userName: movement.createdByFullName || 'Bilinmeyen Kullanıcı',
        description: movement.description || ''
      }
    })
    .filter(row => matchesDateFilters(row.movementDate, filters))
    .filter(row => filters.categoryId === 'all' || row.categoryId === filters.categoryId)
    .filter(row => filters.stockItemId === 'all' || row.stockItemId === filters.stockItemId)
    .filter(row => filters.personnelId === 'all' || row.userId === filters.personnelId)
    .filter(row => filters.movementType === 'all' || row.operationType === filters.movementType)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.description).includes(searchText)
        || normalizeText(row.source).includes(searchText)
        || normalizeText(row.userName).includes(searchText)
        || normalizeText(row.reason).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildKpis = (rows: StockMovementReportRow[]): ReportKpi[] => {
  const countByType = (operationType: StockMovementOperationType) => {
    return rows.filter(row => row.operationType === operationType).length
  }

  const fireCost = rows
    .filter(row => row.operationType === 'waste')
    .reduce((sum, row) => sum + row.movementAmount, 0)

  return [
    { label: 'Toplam Giriş Hareketi', value: formatNumber(countByType('entry')), detail: 'Filtrelenen giriş kayıtları' },
    { label: 'Toplam Çıkış Hareketi', value: formatNumber(countByType('exit')), detail: 'Fire ve ters hareket hariç çıkışlar' },
    { label: 'Toplam Fire Hareketi', value: formatNumber(countByType('waste')), detail: 'Fire kaynaklı hareketler' },
    { label: 'Toplam Fire Maliyeti', value: formatStockMoney(fireCost, DEFAULT_STOCK_CURRENCY), detail: 'Fire miktarı x birim maliyet' },
    { label: 'Sayım Düzeltme Sayısı', value: formatNumber(countByType('count')), detail: 'Sayım düzeltme kayıtları' },
    { label: 'Ters Hareket Sayısı', value: formatNumber(countByType('reverse')), detail: 'Ters kayıt ve iade hareketleri' }
  ]
}

export const useStockMovementsReport = (args: UseStockMovementsReportArgs): StockMovementsReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args)
    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.movements,
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

const getMovementTypeFilterLabel = (value: ReportMovementTypeFilter) => {
  return reportMovementTypeOptions.find(option => option.value === value)?.label || 'Tüm işlem tipleri'
}

const getSortLabel = (sortKey: StockMovementsSortKey, sortDirection: StockMovementsSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Tarihe göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportStockMovementsReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  users,
  sortKey,
  sortDirection
}: {
  report: StockMovementsReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  users: User[]
  sortKey: StockMovementsSortKey
  sortDirection: StockMovementsSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Stok Hareketleri Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['İşlem Tipi', getMovementTypeFilterLabel(filters.movementType)]),
    csvLine(['Kullanıcı', getFilterLabel(filters.personnelId, users, 'Tüm personel', user => user.fullName || user.username)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine([
      'Tarih',
      'Ürün',
      'İşlem Tipi',
      'Kaynak',
      'Miktar',
      'Birim Maliyet',
      'Hareket Tutarı',
      'Kullanıcı'
    ]),
    ...report.rows.map(row => csvLine([
      row.movementDateLabel,
      row.stockName,
      row.operationLabel,
      row.source,
      formatStockQuantity(row.qty, row.unit),
      formatStockMoney(row.unitCost, row.currency),
      formatStockMoney(row.movementAmount, row.currency),
      row.userName
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stok-hareketleri-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function StockMovementsReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: StockMovementsReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Stok Hareketleri</h3>
          <p className="muted">Giriş, çıkış, fire, sayım ve ters hareket kayıtları maliyetleriyle listelenir.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} stok hareketi listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as StockMovementsSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as StockMovementsSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table stock-movements-report-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Ürün</th>
              <th>İşlem Tipi</th>
              <th>Kaynak</th>
              <th>Miktar</th>
              <th>Birim Maliyet</th>
              <th>Hareket Tutarı</th>
              <th>Kullanıcı</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-cell">Bu filtrelere uygun stok hareketi bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.id}>
                <td>{row.movementDateLabel}</td>
                <td><strong>{row.stockName}</strong></td>
                <td><span className={`status-pill ${row.operationClassName}`}>{row.operationLabel}</span></td>
                <td>
                  <strong>{row.source}</strong>
                  {(row.reason || row.description) && (
                    <div className="muted small-text">
                      {[row.reason, row.description].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </td>
                <td>{formatStockQuantity(row.qty, row.unit)}</td>
                <td>{formatStockMoney(row.unitCost, row.currency)}</td>
                <td>{formatStockMoney(row.movementAmount, row.currency)}</td>
                <td>{row.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
