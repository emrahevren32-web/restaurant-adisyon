import React from 'react'
import { formatStockQuantity } from '../../criticalStock'
import { DEFAULT_STOCK_CURRENCY, formatStockMoney, getStockAverageCost, roundCost } from '../../stockCost'
import { StockCategory, StockDeductionBatch, StockItem, StockMovement, StockUnit } from '../../types'
import { ReportFiltersValue } from './ReportFilters'
import { ReportKpi } from './ReportKpis'

export type RecipeConsumptionSortKey = 'ingredient' | 'consumedQty' | 'averageCost' | 'totalCost'
export type RecipeConsumptionSortDirection = 'asc' | 'desc'

type SourceBatchRef = {
  batchId: string
  recipeQty: number
}

type ConsumptionEvent = {
  batchId: string
  batchRecipeQty: number
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  unit: StockUnit
  qty: number
  unitCost: number
  totalCost: number
  consumptionDate: string
  consumptionTime: number
}

export type RecipeConsumptionReportRow = {
  rowId: string
  stockItemId: string
  stockName: string
  categoryId: string
  categoryName: string
  unit: StockUnit
  consumedQty: number
  averageCost: number
  totalCost: number
  currency: string
  lastConsumptionDate?: string
  lastConsumptionLabel: string
  sourceBatches: SourceBatchRef[]
}

export type RecipeConsumptionReportResult = {
  rows: RecipeConsumptionReportRow[]
  kpis: ReportKpi[]
}

type UseRecipeConsumptionReportArgs = {
  deductionBatches: StockDeductionBatch[]
  stockItems: StockItem[]
  categories: StockCategory[]
  movements: StockMovement[]
  filters: ReportFiltersValue
  sortKey: RecipeConsumptionSortKey
  sortDirection: RecipeConsumptionSortDirection
}

type RecipeConsumptionReportProps = {
  report: RecipeConsumptionReportResult
  sortKey: RecipeConsumptionSortKey
  sortDirection: RecipeConsumptionSortDirection
  onSortKeyChange: (sortKey: RecipeConsumptionSortKey) => void
  onSortDirectionChange: (sortDirection: RecipeConsumptionSortDirection) => void
}

const sortOptions: { value: RecipeConsumptionSortKey; label: string }[] = [
  { value: 'ingredient', label: 'Hammaddeye göre' },
  { value: 'consumedQty', label: 'Tüketilen miktara göre' },
  { value: 'averageCost', label: 'Ortalama maliyete göre' },
  { value: 'totalCost', label: 'Toplam tüketim maliyetine göre' }
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

const roundQty = (value: number) => {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000
}

const toCostNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
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

const getMovementUnitCost = (movement?: StockMovement) => {
  if(!movement) return undefined

  const unitCost = toCostNumber(movement.unitCost)
  if(unitCost !== undefined) return unitCost

  const totalCost = toCostNumber(movement.totalCost)
  const qty = toCostNumber(movement.qty)
  if(totalCost !== undefined && qty && qty > 0) return roundCost(totalCost / qty)

  return undefined
}

const getConsumptionUnitCost = (stockItem?: StockItem, movement?: StockMovement) => {
  const averageCost = getStockAverageCost(stockItem)
  if(averageCost > 0) return averageCost

  return getMovementUnitCost(movement) || 0
}

const getBatchRemainingRecipeQty = (batch: StockDeductionBatch) => {
  if(batch.status === 'reversed' || batch.status === 'failed' || batch.status === 'missing_recipe') return 0
  if(batch.movementIds.length === 0) return 0

  const remainingQty = Number(batch.remainingQty)
  if(!Number.isFinite(remainingQty) || remainingQty <= 0) return 0

  const originalQty = Number(batch.qty)
  if(Number.isFinite(originalQty) && originalQty > 0) return Math.min(remainingQty, originalQty)

  return remainingQty
}

const getBatchScale = (batch: StockDeductionBatch, remainingRecipeQty: number) => {
  const originalQty = Number(batch.qty)
  if(!Number.isFinite(originalQty) || originalQty <= 0) return 1

  return remainingRecipeQty / originalQty
}

const matchesDateFilters = (consumptionDate: string, filters: ReportFiltersValue) => {
  if(!filters.startDate && !filters.endDate) return true

  const dateKey = getDateKey(consumptionDate)
  if(!dateKey) return false

  if(filters.startDate && dateKey < filters.startDate) return false
  if(filters.endDate && dateKey > filters.endDate) return false

  return true
}

const buildConsumptionEvents = ({
  deductionBatches,
  stockItems,
  categories,
  movements
}: Pick<UseRecipeConsumptionReportArgs, 'deductionBatches' | 'stockItems' | 'categories' | 'movements'>) => {
  const stockItemMap = buildStockItemMap(stockItems)
  const categoryMap = buildCategoryMap(categories)
  const movementMap = buildMovementMap(movements)

  return deductionBatches.flatMap<ConsumptionEvent>(batch => {
    const remainingRecipeQty = getBatchRemainingRecipeQty(batch)
    if(remainingRecipeQty <= 0) return []

    const scale = getBatchScale(batch, remainingRecipeQty)

    return batch.lines
      .map<ConsumptionEvent | undefined>(line => {
        const consumedQty = roundQty((Number(line.qty) || 0) * scale)
        if(consumedQty <= 0 || line.error) return undefined

        const stockItem = stockItemMap.get(line.stockItemId)
        const movement = movementMap.get(line.movementId || '')
        const category = stockItem ? categoryMap.get(stockItem.categoryId) : undefined
        const unitCost = getConsumptionUnitCost(stockItem, movement)
        const consumptionDate = movement?.movementDate || movement?.createdAt || batch.createdAt

        return {
          batchId: batch.id,
          batchRecipeQty: remainingRecipeQty,
          stockItemId: line.stockItemId,
          stockName: stockItem?.name || line.stockItemName || 'Stok Kartı',
          categoryId: stockItem?.categoryId || '',
          categoryName: category?.name || 'Kategori yok',
          unit: stockItem?.unit || line.unit,
          qty: consumedQty,
          unitCost,
          totalCost: roundCost(consumedQty * unitCost),
          consumptionDate,
          consumptionTime: getTime(consumptionDate)
        }
      })
      .filter((event): event is ConsumptionEvent => Boolean(event))
  })
}

const applyFilters = (events: ConsumptionEvent[], filters: ReportFiltersValue) => {
  const searchText = normalizeText(filters.search)

  return events
    .filter(event => matchesDateFilters(event.consumptionDate, filters))
    .filter(event => filters.categoryId === 'all' || event.categoryId === filters.categoryId)
    .filter(event => filters.stockItemId === 'all' || event.stockItemId === filters.stockItemId)
    .filter(event => {
      if(!searchText) return true

      return normalizeText(event.stockName).includes(searchText)
        || normalizeText(event.categoryName).includes(searchText)
    })
}

const buildRows = (events: ConsumptionEvent[]) => {
  const rowMap = events.reduce<Map<string, RecipeConsumptionReportRow>>((acc, event) => {
    const rowKey = `${event.stockItemId}_${event.unit}`
    const existing = acc.get(rowKey)
    const existingBatchIndex = existing?.sourceBatches.findIndex(batch => batch.batchId === event.batchId) ?? -1

    if(existing){
      const consumedQty = roundQty(existing.consumedQty + event.qty)
      const totalCost = roundCost(existing.totalCost + event.totalCost)
      const sourceBatches = existingBatchIndex >= 0
        ? existing.sourceBatches
        : [...existing.sourceBatches, { batchId: event.batchId, recipeQty: event.batchRecipeQty }]

      acc.set(rowKey, {
        ...existing,
        consumedQty,
        averageCost: consumedQty > 0 ? roundCost(totalCost / consumedQty) : 0,
        totalCost,
        lastConsumptionDate: event.consumptionTime > getTime(existing.lastConsumptionDate) ? event.consumptionDate : existing.lastConsumptionDate,
        lastConsumptionLabel: event.consumptionTime > getTime(existing.lastConsumptionDate) ? formatDateTime(event.consumptionDate) : existing.lastConsumptionLabel,
        sourceBatches
      })
      return acc
    }

    acc.set(rowKey, {
      rowId: rowKey,
      stockItemId: event.stockItemId,
      stockName: event.stockName,
      categoryId: event.categoryId,
      categoryName: event.categoryName,
      unit: event.unit,
      consumedQty: event.qty,
      averageCost: event.unitCost,
      totalCost: event.totalCost,
      currency: DEFAULT_STOCK_CURRENCY,
      lastConsumptionDate: event.consumptionDate,
      lastConsumptionLabel: formatDateTime(event.consumptionDate),
      sourceBatches: [{ batchId: event.batchId, recipeQty: event.batchRecipeQty }]
    })

    return acc
  }, new Map())

  return [...rowMap.values()]
}

const compareRows = (
  first: RecipeConsumptionReportRow,
  second: RecipeConsumptionReportRow,
  sortKey: RecipeConsumptionSortKey,
  sortDirection: RecipeConsumptionSortDirection
) => {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1
  let result = 0

  if(sortKey === 'ingredient'){
    result = first.stockName.localeCompare(second.stockName, 'tr-TR')
  } else if(sortKey === 'consumedQty'){
    result = first.consumedQty - second.consumedQty
  } else if(sortKey === 'averageCost'){
    result = first.averageCost - second.averageCost
  } else {
    result = first.totalCost - second.totalCost
  }

  const directedResult = result * directionMultiplier
  if(directedResult !== 0) return directedResult

  return first.stockName.localeCompare(second.stockName, 'tr-TR')
}

const getTotalRecipeConsumption = (rows: RecipeConsumptionReportRow[]) => {
  const batchMap = rows.reduce<Map<string, number>>((acc, row) => {
    row.sourceBatches.forEach(batch => {
      if(!acc.has(batch.batchId)){
        acc.set(batch.batchId, batch.recipeQty)
      }
    })

    return acc
  }, new Map())

  return roundQty([...batchMap.values()].reduce((sum, qty) => sum + qty, 0))
}

const buildKpis = (rows: RecipeConsumptionReportRow[]): ReportKpi[] => {
  const ingredientCount = new Set(rows.map(row => row.stockItemId)).size
  const totalCost = roundCost(rows.reduce((sum, row) => sum + row.totalCost, 0))
  const totalRecipeConsumption = getTotalRecipeConsumption(rows)
  const averageRecipeCost = totalRecipeConsumption > 0 ? roundCost(totalCost / totalRecipeConsumption) : 0
  const mostConsumedIngredient = [...rows]
    .sort((first, second) => second.consumedQty - first.consumedQty || second.totalCost - first.totalCost)[0]
  const highestCostIngredient = [...rows]
    .sort((first, second) => second.totalCost - first.totalCost || second.consumedQty - first.consumedQty)[0]

  return [
    { label: 'Toplam Tüketilen Hammadde Sayısı', value: formatNumber(ingredientCount), detail: 'Filtrelenen benzersiz hammaddeler' },
    { label: 'Toplam Tüketim Maliyeti', value: formatStockMoney(totalCost, DEFAULT_STOCK_CURRENCY), detail: 'Tüketilen miktar x ortalama maliyet' },
    {
      label: 'En Çok Tüketilen Hammadde',
      value: mostConsumedIngredient?.stockName || '-',
      detail: mostConsumedIngredient ? formatStockQuantity(mostConsumedIngredient.consumedQty, mostConsumedIngredient.unit) : 'Tüketim yok'
    },
    {
      label: 'En Yüksek Maliyetli Hammadde',
      value: highestCostIngredient?.stockName || '-',
      detail: highestCostIngredient ? formatStockMoney(highestCostIngredient.totalCost, highestCostIngredient.currency) : 'Tüketim yok'
    },
    { label: 'Toplam Reçete Tüketimi', value: formatNumber(totalRecipeConsumption), detail: 'Satış kaynaklı reçete porsiyonları' },
    { label: 'Ortalama Reçete Maliyeti', value: formatStockMoney(averageRecipeCost, DEFAULT_STOCK_CURRENCY), detail: 'Toplam maliyet / reçete tüketimi' }
  ]
}

export const useRecipeConsumptionReport = (args: UseRecipeConsumptionReportArgs): RecipeConsumptionReportResult => {
  return React.useMemo(() => {
    const events = applyFilters(buildConsumptionEvents(args), args.filters)
    const rows = buildRows(events).sort((first, second) => compareRows(first, second, args.sortKey, args.sortDirection))

    return {
      rows,
      kpis: buildKpis(rows)
    }
  }, [
    args.deductionBatches,
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

const getSortLabel = (sortKey: RecipeConsumptionSortKey, sortDirection: RecipeConsumptionSortDirection) => {
  const sortLabel = sortOptions.find(option => option.value === sortKey)?.label || 'Toplam tüketim maliyetine göre'
  return `${sortLabel} - ${sortDirection === 'asc' ? 'Artan' : 'Azalan'}`
}

export const exportRecipeConsumptionReportCsv = ({
  report,
  filters,
  categories,
  stockItems,
  sortKey,
  sortDirection
}: {
  report: RecipeConsumptionReportResult
  filters: ReportFiltersValue
  categories: StockCategory[]
  stockItems: StockItem[]
  sortKey: RecipeConsumptionSortKey
  sortDirection: RecipeConsumptionSortDirection
}) => {
  const generatedAt = new Date()
  const lines = [
    csvLine(['Rapor', 'Reçete Tüketim ve Maliyet Raporu']),
    csvLine(['Tarih', generatedAt.toLocaleString('tr-TR')]),
    csvLine(['Başlangıç Tarihi', filters.startDate || 'Tümü']),
    csvLine(['Bitiş Tarihi', filters.endDate || 'Tümü']),
    csvLine(['Kategori', getFilterLabel(filters.categoryId, categories, 'Tüm kategoriler')]),
    csvLine(['Hammadde', getFilterLabel(filters.stockItemId, stockItems, 'Tüm hammaddeler')]),
    csvLine(['Arama', filters.search || 'Yok']),
    csvLine(['Sıralama', getSortLabel(sortKey, sortDirection)]),
    csvLine(['Satır Sayısı', report.rows.length]),
    '',
    csvLine(['KPI Özeti']),
    ...report.kpis.map(kpi => csvLine([kpi.label, kpi.value, kpi.detail])),
    '',
    csvLine([
      'Hammadde',
      'Kategori',
      'Birim',
      'Tüketilen Miktar',
      'Ortalama Maliyet',
      'Toplam Tüketim Maliyeti',
      'Son Tüketim Tarihi'
    ]),
    ...report.rows.map(row => csvLine([
      row.stockName,
      row.categoryName,
      row.unit,
      formatNumber(row.consumedQty),
      formatStockMoney(row.averageCost, row.currency),
      formatStockMoney(row.totalCost, row.currency),
      row.lastConsumptionLabel
    ]))
  ]

  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `recete-tuketim-maliyet-raporu-${generatedAt.toLocaleDateString('sv-SE')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function RecipeConsumptionReport({
  report,
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionChange
}: RecipeConsumptionReportProps){
  return (
    <section className="card report-center-card">
      <div className="section-header compact">
        <div>
          <h3>Reçete Tüketim ve Maliyet</h3>
          <p className="muted">Satış kaynaklı otomatik stok düşümleri hammadde ve maliyet kırılımıyla listelenir.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-table-toolbar">
        <div className="muted small-text">{report.rows.length} hammadde tüketimi listeleniyor.</div>
        <div className="report-sort-controls">
          <select value={sortKey} onChange={event => onSortKeyChange(event.target.value as RecipeConsumptionSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={sortDirection} onChange={event => onSortDirectionChange(event.target.value as RecipeConsumptionSortDirection)}>
            <option value="asc">Artan</option>
            <option value="desc">Azalan</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-table recipe-consumption-report-table">
          <thead>
            <tr>
              <th>Hammadde</th>
              <th>Kategori</th>
              <th>Birim</th>
              <th>Tüketilen Miktar</th>
              <th>Ortalama Maliyet</th>
              <th>Toplam Tüketim Maliyeti</th>
              <th>Son Tüketim Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-cell">Bu filtrelere uygun reçete tüketimi bulunamadı.</td>
              </tr>
            )}
            {report.rows.map(row => (
              <tr key={row.rowId}>
                <td><strong>{row.stockName}</strong></td>
                <td>{row.categoryName}</td>
                <td>{row.unit}</td>
                <td>{formatNumber(row.consumedQty)}</td>
                <td>{formatStockMoney(row.averageCost, row.currency)}</td>
                <td>{formatStockMoney(row.totalCost, row.currency)}</td>
                <td>{row.lastConsumptionLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
