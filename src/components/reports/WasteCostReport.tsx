import React from 'react'
import { formatStockQuantity } from '../../criticalStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockAverageCost, roundCost } from '../../stockCost'
import { StockCategory, StockItem, StockMovement, StockUnit, StockWasteRecord, User } from '../../types'
import { ReportFiltersValue, ReportWasteReasonFilter, reportWasteReasonOptions } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type WasteCostSortKey = 'date' | 'qty' | 'totalCost'
export type WasteCostSortDirection = 'asc' | 'desc'
type WasteReasonBucket = Exclude<ReportWasteReasonFilter, 'all'>

export type WasteReasonSummary = {
  reason: WasteReasonBucket
  label: string
  count: number
  totalCost: number
}

export type WasteCostReportRow = {
  id: string
  occurredAt: string
  occurredAtLabel: string
  sortTime: number
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  reason: WasteReasonBucket
  reasonLabel: string
  originalReason: string
  reasonNote: string
  qty: number
  unit: StockUnit
  unitCost: number
  totalCost: number
  currency: string
  userId: string
  userName: string
  responsibleUserId?: string
  responsibleName: string
}

export type WasteCostReportResult = {
  rows: WasteCostReportRow[]
  kpis: ReportKpi[]
  reasonSummaries: WasteReasonSummary[]
}

type UseWasteCostReportArgs = {
  wasteRecords: StockWasteRecord[]
  movements: StockMovement[]
  stockItems: StockItem[]
  categories: StockCategory[]
  filters: ReportFiltersValue
  sortKey: WasteCostSortKey
  sortDirection: WasteCostSortDirection
}

type WasteCostReportProps = {
  report: WasteCostReportResult
  sortKey: WasteCostSortKey
  sortDirection: WasteCostSortDirection
  onSortKeyChange: (sortKey: WasteCostSortKey) => void
  onSortDirectionChange: (sortDirection: WasteCostSortDirection) => void
}

const sortOptions: { value: WasteCostSortKey; label: string }[] = [
  { value: 'date', label: 'Tarihe göre' },
  { value: 'qty', label: 'Miktara göre' },
  { value: 'totalCost', label: 'Toplam maliyete göre' }
]

const reasonDefinitions: Array<{ value: WasteReasonBucket; label: string }> = [
  { value: 'spoilage', label: 'Bozulma' },
  { value: 'breakage', label: 'Kırılma' },
  { value: 'wrong-production', label: 'Yanlış Üretim' },
  { value: 'expiry', label: 'Son Kullanma Tarihi' },
  { value: 'count-difference', label: 'Sayım Farkı' },
  { value: 'other', label: 'Diğer' }
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

const toCostNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const getMovementUnitCost = (movement?: StockMovement) => {
  if(!movement) return undefined

  const unitCost = toCostNumber(movement.unitCost)
  if(unitCost !== undefined) return unitCost

  const purchasePrice = toCostNumber(movement.purchasePrice)
  if(purchasePrice !== undefined) return purchasePrice

  const totalCost = toCostNumber(movement.totalCost)
  const qty = toCostNumber(movement.qty)
  if(totalCost !== undefined && qty && qty > 0) return roundCost(totalCost / qty)

  return undefined
}

const getReasonBucket = (reasonCategory?: string): WasteReasonBucket => {
  if(reasonCategory === 'Bozulma') return 'spoilage'
  if(reasonCategory === 'Dökülme' || reasonCategory === 'Kırılma') return 'breakage'
  if(reasonCategory === 'Üretim Hatası' || reasonCategory === 'Yanlış Sipariş' || reasonCategory === 'Yanlış Üretim') return 'wrong-production'
  if(reasonCategory === 'SKT Geçmesi' || reasonCategory === 'Son Kullanma Tarihi') return 'expiry'
  if(reasonCategory === 'Sayım Farkı') return 'count-difference'

  return 'other'
}

const getReasonLabel = (reason: WasteReasonBucket) => {
  return reasonDefinitions.find(item => item.value === reason)?.label || 'Diğer'
}

const buildStockItemMap = (items: StockItem[]) => {
  return new Map(items.map(item => [item.id, item]))
}

const buildCategoryMap = (categories: StockCategory[]) => {
  return new Map(categories.map(category => [category.id, category]))
}

const buildMovementMap = (movements: StockMovement[]) => {
  return new Map(movements.map(movement => [movement.id, movement]))
}

const matchesDateFilters = (occurredAt: string, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const dateKey = getDateKey(occurredAt)
  if(!dateKey) return false

  if(filters.startDate && dateKey < filters.startDate) return false
  if(filters.endDate && dateKey > filters.endDate) return false

  return true
}

const getRecordUnitCost = (record: StockWasteRecord, stockItem?: StockItem, movement?: StockMovement) => {
  const averageCost = getStockAverageCost(stockItem)
  if(averageCost > 0) return averageCost

  const estimatedUnitCost = toCostNumber(record.estimatedUnitCost)
  if(estimatedUnitCost !== undefined) return estimatedUnitCost

  const movementUnitCost = getMovementUnitCost(movement)
  if(movementUnitCost !== undefined) return movementUnitCost

  const estimatedTotalCost = toCostNumber(record.estimatedTotalCost)
  const qty = toCostNumber(record.qty)
  if(estimatedTotalCost !== undefined && qty && qty > 0) return roundCost(estimatedTotalCost / qty)

  return 0
}

const compareRows = (
  first: WasteCostReportRow,
  second: WasteCostReportRow,
  sortKey: WasteCostSortKey,
  sortDirection: WasteCostSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'date'){
    result = first.sortTime - second.sortTime
  } else if(sortKey === 'qty'){
    result = first.qty - second.qty
  } else {
    result = first.totalCost - second.totalCost
  }

  const directedResult = result * directionMultiplier
  if(directedResult !== 0) return directedResult

  const dateTieBreaker = second.sortTime - first.sortTime
  if(dateTieBreaker !== 0) return dateTieBreaker

  return first.stockName.localeCompare(second.stockName, 'tr-TR')
}

const buildRows = ({
  wasteRecords,
  movements,
  stockItems,
  categories,
  filters,
  sortKey,
  sortDirection
}: UseWasteCostReportArgs) => {
  const stockItemMap = buildStockItemMap(stockItems)
  const categoryMap = buildCategoryMap(categories)
  const movementMap = buildMovementMap(movements)
  const searchText = normalizeText(filters.search)

  return wasteRecords
    .filter(record => record.status === 'active')
    .map<WasteCostReportRow>(record => {
      const stockItem = stockItemMap.get(record.stockItemId)
      const movement = movementMap.get(record.stockMovementId)
      const category = stockItem ? categoryMap.get(stockItem.categoryId) : undefined
      const qty = Number.isFinite(Number(record.qty)) ? Math.max(0, Number(record.qty)) : 0
      const unitCost = getRecordUnitCost(record, stockItem, movement)
      const reason = getReasonBucket(record.reasonCategory)
      const currency = stockItem?.currency || movement?.currency || DEFAULT_STOCK_CURRENCY

      return {
        id: record.id,
        occurredAt: record.occurredAt || record.createdAt,
        occurredAtLabel: formatDateTime(record.occurredAt || record.createdAt),
        sortTime: getTime(record.occurredAt || record.createdAt),
        stockItemId: record.stockItemId,
        stockName: stockItem?.name || record.stockItemName || 'Stok Kartı',
        categoryId: stockItem?.categoryId || '',
        categoryName: category?.name || 'Kategori yok',
        reason,
        reasonLabel: getReasonLabel(reason),
        originalReason: record.reasonCategory,
        reasonNote: record.reasonNote || '',
        qty,
        unit: record.unit,
        unitCost,
        totalCost: roundCost(qty * unitCost),
        currency,
        userId: record.createdByUserId,
        userName: record.createdByFullName || 'Bilinmeyen Kullanıcı',
        responsibleUserId: record.responsibleUserId,
        responsibleName: record.responsibleFullName || ''
      }
    })
    .filter(row => matchesDateFilters(row.occurredAt, filters))
    .filter(row => filters.categoryId === 'all' || row.categoryId === filters.categoryId)
    .filter(row => filters.stockItemId === 'all' || row.stockItemId === filters.stockItemId)
    .filter(row => filters.personnelId === 'all' || row.userId === filters.personnelId)
    .filter(row => filters.wasteReason === 'all' || row.reason === filters.wasteReason)
    .filter(row => {
      if(!searchText) return true

      return normalizeText(row.stockName).includes(searchText)
        || normalizeText(row.reasonLabel).includes(searchText)
        || normalizeText(row.originalReason).includes(searchText)
        || normalizeText(row.reasonNote).includes(searchText)
        || normalizeText(row.userName).includes(searchText)
        || normalizeText(row.responsibleName).includes(searchText)
    })
    .sort((first, second) => compareRows(first, second, sortKey, sortDirection))
}

const buildReasonSummaries = (rows: WasteCostReportRow[]): WasteReasonSummary[] => {
  return reasonDefinitions.map(definition => {
    const reasonRows = rows.filter(row => row.reason === definition.value)

    return {
      reason: definition.value,
      label: definition.label,
      count: reasonRows.length,
      totalCost: roundCost(reasonRows.reduce((sum, row) => sum + row.totalCost, 0))
    }
  })
}

const buildKpis = (rows: WasteCostReportRow[]): ReportKpi[] => {
  const totalQty = rows.reduce((sum, row) => sum + row.qty, 0)
  const totalCost = roundCost(rows.reduce((sum, row) => sum + row.totalCost, 0))
  const averageCost = rows.length > 0 ? roundCost(totalCost / rows.length) : 0
  const productTotals = new Map<string, { stockName: string; qty: number; unit: StockUnit; totalCost: number }>()

  rows.forEach(row => {
    const existing = productTotals.get(row.stockItemId)
    if(existing){
      productTotals.set(row.stockItemId, {
        ...existing,
        qty: existing.qty + row.qty,
        totalCost: existing.totalCost + row.totalCost
      })
      return
    }

    productTotals.set(row.stockItemId, {
      stockName: row.stockName,
      qty: row.qty,
      unit: row.unit,
      totalCost: row.totalCost
    })
  })

  const mostWastedProduct = [...productTotals.values()]
    .sort((first, second) => second.qty - first.qty || second.totalCost - first.totalCost)[0]
  const highestCostWaste = rows.reduce<WasteCostReportRow | undefined>((highest, row) => {
    if(!highest) return row
    return row.totalCost > highest.totalCost ? row : highest
  }, undefined)

  return [
    { label: 'Toplam Fire Kaydı', value: formatNumber(rows.length), detail: 'Filtrelenen aktif fire kayıtları' },
    { label: 'Toplam Fire Miktarı', value: formatNumber(totalQty), detail: 'Birimler karma toplam' },
    { label: 'Toplam Fire Maliyeti', value: formatStockMoney(totalCost, DEFAULT_STOCK_CURRENCY), detail: 'Miktar x ortalama maliyet' },
    { label: 'Ortalama Fire Maliyeti', value: formatStockMoney(averageCost, DEFAULT_STOCK_CURRENCY), detail: 'Kayıt başına ortalama kayıp' },
    {
      label: 'En Çok Fire Veren Ürün',
      value: mostWastedProduct?.stockName || '-',
      detail: mostWastedProduct
        ? `${formatStockQuantity(mostWastedProduct.qty, mostWastedProduct.unit)} · ${formatStockMoney(mostWastedProduct.totalCost, DEFAULT_STOCK_CURRENCY)}`
        : 'Fire kaydı yok'
    },
    {
      label: 'En Yüksek Maliyetli Fire',
      value: highestCostWaste ? formatStockMoney(highestCostWaste.totalCost, highestCostWaste.currency) : '-',
      detail: highestCostWaste ? `${highestCostWaste.stockName} · ${highestCostWaste.reasonLabel}` : 'Fire kaydı yok'
    }
  ]
}

export const useWasteCostReport = (args: UseWasteCostReportArgs): WasteCostReportResult => {
  return React.useMemo(() => {
    const rows = buildRows(args)

    return {
      rows,
      kpis: buildKpis(rows),
      reasonSummaries: buildReasonSummaries(rows)
    }
  }, [
    args.wasteRecords,
    args.movements,
    args.stockItems,
    args.categories,
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

const getWasteReasonFilterLabel = (value: ReportWasteReasonFilter) => {
  return reportWasteReasonOptions.find(option => option.value === value)?.label || 'Tüm fire sebepleri'
}

const getSortLabel = (sortKey: WasteCostSortKey, sortDirection: WasteCostSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Toplam maliyete göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportWasteCostReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  users,
  sortKey,
  sortDirection
}: {
  report: WasteCostReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  users: User[]
  sortKey: WasteCostSortKey
  sortDirection: WasteCostSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Fire ve Kayıp Maliyet Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Ürün', getFilterLabel(filters.stockItemId, stockItems, 'Tüm ürünler')]),
    csvLine(['Fire Sebebi', getWasteReasonFilterLabel(filters.wasteReason)]),
    csvLine(['Kullanıcı', getFilterLabel(filters.personnelId, users, 'Tüm personel', user => user.fullName || user.username)]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine(['KPI Özeti']),
    ...report.kpis.map(kpi => csvLine([kpi.label, kpi.value, kpi.detail])),
    '',
    csvLine(['Fire Sebebi Özeti']),
    csvLine(['Fire Sebebi', 'Adet', 'Maliyet']),
    ...report.reasonSummaries.map(summary => csvLine([
      summary.label,
      summary.count,
      formatStockMoney(summary.totalCost, DEFAULT_STOCK_CURRENCY)
    ])),
    '',
    csvLine([
      'Tarih',
      'Ürün',
      'Kategori',
      'Fire Sebebi',
      'Miktar',
      'Birim',
      'Birim Maliyet',
      'Toplam Maliyet',
      'Kullanıcı'
    ]),
    ...report.rows.map(row => csvLine([
      row.occurredAtLabel,
      row.stockName,
      row.categoryName,
      row.reasonLabel,
      formatNumber(row.qty),
      row.unit,
      formatStockMoney(row.unitCost, row.currency),
      formatStockMoney(row.totalCost, row.currency),
      row.userName
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fire-kayip-maliyet-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function WasteCostReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: WasteCostReportProps){
  return (
    <>
      <section className="waste-reason-summary-section">
        <div className="section-header compact">
          <div>
            <h3>Fire Sebepleri Analizi</h3>
            <p className="muted">Filtrelenen fire kayıtları sebep ve maliyet kırılımıyla özetlenir.</p>
          </div>
        </div>
        <div className="waste-reason-summary-grid">
          {report.reasonSummaries.map(summary => (
            <div className="waste-reason-summary-tile" key={summary.reason}>
              <span>{summary.label}</span>
              <strong>{formatNumber(summary.count)} adet</strong>
              <p>{formatStockMoney(summary.totalCost, DEFAULT_STOCK_CURRENCY)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card report-center-card">
        <div className="section-header compact">
          <div>
            <h3>Fire ve Kayıp Maliyet</h3>
            <p className="muted">Aktif fire kayıtları ürün, sebep, kullanıcı ve maliyet kırılımıyla listelenir.</p>
          </div>
          <span className="status-pill success">Gerçek Veri</span>
        </div>

        <div className="report-table-toolbar">
          <div className="muted small-text">{report.rows.length} fire kaydı listeleniyor.</div>
          <div className="report-sort-controls">
            <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as WasteCostSortKey)}>
              {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as WasteCostSortDirection)}>
              <option value="asc">Artan</option>
              <option value="desc">Azalan</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-table waste-cost-report-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Kategori</th>
                <th>Fire Sebebi</th>
                <th>Miktar</th>
                <th>Birim</th>
                <th>Birim Maliyet</th>
                <th>Toplam Maliyet</th>
                <th>Kullanıcı</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-cell">Bu filtrelere uygun fire kaydı bulunamadı.</td>
                </tr>
              )}
              {report.rows.map(row => (
                <tr key={row.id}>
                  <td>{row.occurredAtLabel}</td>
                  <td><strong>{row.stockName}</strong></td>
                  <td>{row.categoryName}</td>
                  <td>
                    <span className="status-pill warning-pill">{row.reasonLabel}</span>
                    {(row.originalReason !== row.reasonLabel || row.reasonNote) && (
                      <div className="muted small-text">
                        {[row.originalReason !== row.reasonLabel ? row.originalReason : '', row.reasonNote].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td>{formatNumber(row.qty)}</td>
                  <td>{row.unit}</td>
                  <td>{formatStockMoney(row.unitCost, row.currency)}</td>
                  <td>{formatStockMoney(row.totalCost, row.currency)}</td>
                  <td>
                    {row.userName}
                    {row.responsibleName && <div className="muted small-text">Sorumlu: {row.responsibleName}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
