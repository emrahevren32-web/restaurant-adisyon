import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import {
  DashboardExperienceHeader,
  DashboardKpiCard
} from '../components/DashboardExperience'
import { CHART_THEME_COLORS, PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { AIAnalysisService } from '../ai-analysis/ai-analysis.service'
import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { ForecastService } from '../forecasting/forecast.service'
import { createDefaultKpiFilters, createKpiDashboardView } from '../kpi-reporting/kpi.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  KPI_COLORS,
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { ProductionPlanningRecommendationService } from '../production-planning-recommendations/production-planning-recommendation.service'
import { QualityFormService } from '../quality-forms/quality-form.service'
import { RecommendationService } from '../recommendation-engine/recommendation.service'
import { ShipmentOptimizationService } from '../shipment-optimization/shipment-optimization.service'
import { WasteService } from '../waste-management/waste.service'

type ExecutiveKpiCard = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type OperationSummaryItem = {
  id: string
  label: string
  value: number
  formattedValue: string
  detail: string
  tone: KpiTone
}

type ExecutiveTimelineItem = {
  id: string
  module: string
  title: string
  detail: string
  status: string
  timestamp: string
  tone: KpiTone
}

type UpcomingItem = {
  id: string
  category: string
  title: string
  detail: string
  date: string
  tone: KpiTone
}

type CriticalWarning = {
  id: string
  category: string
  title: string
  detail: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
}

type DecisionSummaryItem = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type QuickAccessItem = {
  id: string
  label: string
  module: string
  route: string
  detail: string
  tone: KpiTone
}

type ExecutiveDashboardModel = {
  generatedAt: string
  loadMs: number
  sourceData: KpiSourceData
  kpiCards: ExecutiveKpiCard[]
  operationSummary: OperationSummaryItem[]
  trendCharts: ChartSeries[]
  barCharts: Array<{ id: string; title: string; rows: BarChartRow[] }>
  decisionSummary: DecisionSummaryItem[]
  timeline: ExecutiveTimelineItem[]
  upcoming: UpcomingItem[]
  criticalWarnings: CriticalWarning[]
  quickAccess: QuickAccessItem[]
}

type SheetRow = Record<string, string | number>

const EXECUTIVE_ACTOR = 'Executive Dashboard'
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_TODAY_COST = 9_500_000

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clampValue = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) => (
  Math.min(max, Math.max(min, toFiniteNumber(value)))
)

const toDateKey = (value?: string | Date) => {
  if(!value) return ''
  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(!trimmed) return ''
    if(/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if(Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value?: string | Date) => {
  if(!value) return null
  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(!trimmed) return null
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T12:00:00`)
      : new Date(trimmed)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return Number.isNaN(value.getTime()) ? null : value
}

const formatDate = (value?: string | Date) => {
  const dateKey = toDateKey(value)
  if(!dateKey) return '-'
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const formatDateTime = (value?: string | Date) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    : '-'
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  nextDate.setHours(12, 0, 0, 0)
  return nextDate
}

const isSameDateKey = (value: string | Date | undefined, dateKey: string) => toDateKey(value) === dateKey

const getDaysUntil = (value: string | Date | undefined, todayKey: string) => {
  const dateKey = toDateKey(value)
  if(!dateKey) return Number.POSITIVE_INFINITY
  const date = new Date(`${dateKey}T12:00:00`)
  const today = new Date(`${todayKey}T12:00:00`)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return Number.POSITIVE_INFINITY
  return Math.round((date.getTime() - today.getTime()) / DAY_MS)
}

const isWithinNextDays = (value: string | Date | undefined, todayKey: string, days: number) => {
  const daysUntil = getDaysUntil(value, todayKey)
  return daysUntil >= 0 && daysUntil <= days
}

const createId = (value: string) => (
  normalizeSearchText(value)
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'row'
)

const getBranchName = (sourceData: KpiSourceData, branchId: string) => (
  sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || 'Merkez'
)

const getWarehouseName = (sourceData: KpiSourceData, warehouseId: string) => (
  sourceData.branches.find(branch => branch.id === warehouseId)?.name || warehouseId || 'Ana Depo'
)

const getProductName = (sourceData: KpiSourceData, productId: string, fallback = '') => (
  sourceData.productRefs.find(product => product.id === productId)?.name
  || sourceData.stockItems.find(item => item.id === productId)?.name
  || fallback
  || productId
  || 'Ürün'
)

const getStockItemName = (sourceData: KpiSourceData, stockItemId: string, fallback = '') => (
  sourceData.stockItems.find(item => item.id === stockItemId)?.name || fallback || stockItemId || 'Stok Kalemi'
)

const isProductionDone = (status: string) => {
  const text = normalizeSearchText(status)
  return text.includes('tamam') || text.includes('sevkiyata hazır') || text.includes('sevkiyata hazir')
}

const isProductionCancelled = (status: string) => {
  const text = normalizeSearchText(status)
  return text.includes('iptal') || text.includes('ıptal')
}

const isShipmentDone = (status: string) => status === 'DELIVERED' || status === 'SHIPPED'

const isShipmentCancelled = (status: string) => status === 'CANCELLED'

const isPurchaseClosed = (status: string) => (
  status === 'REJECTED'
  || status === 'CANCELLED'
  || status === 'PURCHASE_ORDER_CREATED'
)

const isRecallActive = (status: string) => status !== 'COMPLETED' && status !== 'CANCELLED'

const isQualityFormOpen = (status: string) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)

const isSamplePending = (status: string) => ['COLLECTED', 'STORED', 'UNDER_REVIEW', 'ACTIVE'].includes(status)

const toToneByPercent = (value: number, warning = 70, danger = 88): KpiTone => {
  if(value >= danger) return 'danger'
  if(value >= warning) return 'warning'
  return 'success'
}

const toPositiveTone = (value: number, warning = 70, success = 85): KpiTone => {
  if(value >= success) return 'success'
  if(value >= warning) return 'warning'
  return 'danger'
}

const aggregateBarRows = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string,
  getLabel: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  options: {
    limit?: number
    detailLabel?: string
    formatValue?: (value: number) => string
    tone?: KpiTone
  } = {}
): BarChartRow[] => {
  const rows = records.reduce<Map<string, { label: string; value: number }>>((map, record) => {
    const key = normalizeText(getKey(record))
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || normalizeText(getLabel(record)) || key,
      value: roundKpi((previous?.value || 0) + clampValue(getValue(record)))
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .sort((first, second) => second[1].value - first[1].value || first[1].label.localeCompare(second[1].label, 'tr-TR'))
    .slice(0, options.limit || 8)
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: roundKpi(row.value),
      formattedValue: options.formatValue ? options.formatValue(row.value) : formatNumber(row.value, 1),
      detail: options.detailLabel ? `${options.detailLabel}: ${options.formatValue ? options.formatValue(row.value) : formatNumber(row.value, 1)}` : '',
      tone: options.tone
    }))
}

const createDailyBarRows = <TRecord,>(
  records: TRecord[],
  days: number,
  getDateValue: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  detailLabel: string,
  formatValue: (value: number) => string = value => formatNumber(value, 1)
): BarChartRow[] => {
  const referenceDate = new Date()
  const buckets = new Map<string, number>()
  Array.from({ length: days }, (_, index) => addDays(referenceDate, -(days - 1 - index))).forEach(date => {
    buckets.set(toDateKey(date), 0)
  })

  records.forEach(record => {
    const dateKey = toDateKey(getDateValue(record))
    if(!buckets.has(dateKey)) return
    buckets.set(dateKey, roundKpi((buckets.get(dateKey) || 0) + clampValue(getValue(record))))
  })

  return Array.from(buckets.entries()).map(([dateKey, value]) => ({
    id: dateKey,
    label: dateKey.slice(5),
    value,
    formattedValue: formatValue(value),
    detail: detailLabel
  }))
}

const createTrendSeries = <TRecord,>(
  records: TRecord[],
  days: number,
  getDateValue: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  label: string,
  color: string
): ChartSeries => {
  const rows = createDailyBarRows(records, days, getDateValue, getValue, label)
  return {
    id: createId(label),
    label,
    color,
    points: rows.map(row => ({
      dateKey: row.id,
      label: row.label,
      value: row.value
    }))
  }
}

const createWarehouseOccupancyRows = (sourceData: KpiSourceData): BarChartRow[] => {
  const lotGroups = sourceData.inventoryLots
    .filter(lot => !['CONSUMED', 'DISPOSED', 'RETURNED'].includes(lot.status))
    .reduce<Map<string, { quantity: number; lotCount: number }>>((map, lot) => {
      const key = lot.warehouseId || 'main-warehouse'
      const previous = map.get(key)
      map.set(key, {
        quantity: roundKpi((previous?.quantity || 0) + clampValue(lot.remainingQuantity || lot.quantity)),
        lotCount: (previous?.lotCount || 0) + 1
      })
      return map
    }, new Map())

  return Array.from(lotGroups.entries())
    .map(([warehouseId, row], index) => {
      const capacity = Math.max(row.quantity * 1.18, 3600 + index * 900 + row.lotCount * 420)
      const occupancy = clampValue(percent(row.quantity, capacity), 0, 99)
      return {
        id: warehouseId,
        label: getWarehouseName(sourceData, warehouseId),
        value: occupancy,
        formattedValue: formatPercent(occupancy),
        detail: `${formatNumber(row.quantity, 1)} birim / ${formatNumber(row.lotCount)} lot`,
        tone: toToneByPercent(occupancy, 78, 92)
      }
    })
    .sort((first, second) => second.value - first.value)
    .slice(0, 8)
}

const createProductionQuantity = (sourceData: KpiSourceData, dateKey?: string) => (
  sumBy(
    sourceData.productionOrders.filter(order => !dateKey || isSameDateKey(order.deliveryDate || order.createdAt, dateKey)),
    order => sumBy(order.lines, line => line.quantity)
  )
)

const createProductionProductRows = (sourceData: KpiSourceData): BarChartRow[] => (
  aggregateBarRows(
    sourceData.productionOrders.flatMap(order => order.lines.map(line => ({
      productName: line.productName,
      quantity: line.quantity,
      unit: line.unit
    }))),
    line => line.productName,
    line => line.productName,
    line => line.quantity,
    {
      limit: 8,
      detailLabel: 'Üretim miktarı',
      formatValue: value => `${formatNumber(value, 1)} birim`
    }
  )
)

const createProductionHourRows = (sourceData: KpiSourceData): BarChartRow[] => {
  const buckets = [
    { id: '06-10', label: '06:00-10:00', start: 6, end: 10 },
    { id: '10-14', label: '10:00-14:00', start: 10, end: 14 },
    { id: '14-18', label: '14:00-18:00', start: 14, end: 18 },
    { id: '18-22', label: '18:00-22:00', start: 18, end: 22 },
    { id: '22-06', label: '22:00-06:00', start: 22, end: 30 }
  ]

  return buckets.map(bucket => {
    const value = sumBy(sourceData.productionOrders, order => {
      const date = parseSafeDate(order.createdAt)
      if(!date) return 0
      const hour = date.getHours()
      const normalizedHour = hour < 6 ? hour + 24 : hour
      return normalizedHour >= bucket.start && normalizedHour < bucket.end
        ? sumBy(order.lines, line => line.quantity)
        : 0
    })

    return {
      id: bucket.id,
      label: bucket.label,
      value,
      formattedValue: `${formatNumber(value, 1)} birim`,
      detail: 'Planlanan üretim yoğunluğu'
    }
  })
}

const getShipmentQuantity = (shipment: KpiSourceData['shipments'][number]) => (
  sumBy(shipment.items, item => item.quantity) || shipment.items.length || 1
)

const createCostDistributionRows = (sourceData: KpiSourceData) => {
  const costView = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const rowsFromBreakdown = costView.breakdownDistribution.map(slice => ({
    id: slice.id,
    label: slice.label,
    value: clampValue(slice.value, 0, MAX_TODAY_COST),
    formattedValue: slice.formattedValue,
    detail: 'Maliyet dağılımı'
  }))

  if(rowsFromBreakdown.length > 0){
    return {
      rows: rowsFromBreakdown,
      costView
    }
  }

  return {
    rows: costView.categoryCosts.slice(0, 8),
    costView
  }
}

const createTimeline = (
  sourceData: KpiSourceData,
  qualityForms: ReturnType<typeof QualityFormService.createReadModelRecords>
): ExecutiveTimelineItem[] => {
  const productionRows = sourceData.productionOrders.map(order => ({
    id: `production-${order.id}`,
    module: 'Üretim',
    title: order.workOrderNo,
    detail: order.lines.slice(0, 2).map(line => line.productName).join(', ') || order.description || 'Üretim emri',
    status: order.status,
    timestamp: order.updatedAt || order.createdAt || order.deliveryDate,
    tone: isProductionDone(order.status) ? 'success' as KpiTone : order.priority === 'Acil' ? 'danger' as KpiTone : 'neutral' as KpiTone
  }))

  const purchaseRows = sourceData.purchaseRequests.map(request => ({
    id: `purchase-${request.id}`,
    module: 'Satın Alma',
    title: request.requestNo,
    detail: request.title || `${formatNumber(request.items.length)} kalem talep`,
    status: request.status,
    timestamp: request.updatedAt || request.createdAt || request.requestDate,
    tone: request.priority === 'URGENT' ? 'danger' as KpiTone : request.priority === 'HIGH' ? 'warning' as KpiTone : 'neutral' as KpiTone
  }))

  const shipmentRows = sourceData.shipments.map(shipment => ({
    id: `shipment-${shipment.id}`,
    module: 'Sevkiyat',
    title: shipment.shipmentNo,
    detail: `${getBranchName(sourceData, shipment.destinationBranchId)} / ${formatNumber(shipment.items.length)} kalem`,
    status: shipment.status,
    timestamp: shipment.updatedAt || shipment.createdAt || shipment.shipmentDate,
    tone: isShipmentDone(shipment.status) ? 'success' as KpiTone : shipment.priority === 'URGENT' ? 'danger' as KpiTone : 'neutral' as KpiTone
  }))

  const qualityRows = qualityForms.map(form => ({
    id: `quality-${form.id}`,
    module: 'Kalite',
    title: form.formNo,
    detail: `${form.productName || form.stockItemName} / ${form.templateName}`,
    status: form.status,
    timestamp: form.updatedAt || form.createdAt || form.inspectionDate,
    tone: form.result === 'FAIL' ? 'danger' as KpiTone : form.result === 'CONDITIONAL' ? 'warning' as KpiTone : 'success' as KpiTone
  }))

  const recallRows = sourceData.productRecalls.map(recall => ({
    id: `recall-${recall.id}`,
    module: 'Recall',
    title: recall.recallNo,
    detail: recall.description || recall.reason,
    status: recall.status,
    timestamp: recall.updatedAt || recall.createdAt || recall.reportedDate,
    tone: recall.riskLevel === 'CRITICAL' ? 'danger' as KpiTone : recall.riskLevel === 'HIGH' ? 'warning' as KpiTone : 'neutral' as KpiTone
  }))

  const sampleRows = sourceData.qualitySamples.map(sample => ({
    id: `sample-${sample.id}`,
    module: 'Numune',
    title: sample.sampleNo,
    detail: getProductName(sourceData, sourceData.inventoryLots.find(lot => lot.id === sample.inventoryLotId)?.productId || '', sample.sampleType),
    status: sample.status,
    timestamp: sample.updatedAt || sample.createdAt || sample.sampleDate,
    tone: isSamplePending(sample.status) ? 'warning' as KpiTone : 'success' as KpiTone
  }))

  const haccpRows = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords.map(record => ({
    id: `haccp-${record.id}`,
    module: 'HACCP',
    title: plan.code,
    detail: `${plan.name} / ${record.criticalLimit}`,
    status: record.result,
    timestamp: record.checkedAt,
    tone: record.result === 'FAIL' ? 'danger' as KpiTone : 'success' as KpiTone
  })))

  return [
    ...productionRows,
    ...purchaseRows,
    ...shipmentRows,
    ...qualityRows,
    ...recallRows,
    ...sampleRows,
    ...haccpRows
  ]
    .filter(item => Boolean(toDateKey(item.timestamp)))
    .sort((first, second) => (parseSafeDate(second.timestamp)?.getTime() || 0) - (parseSafeDate(first.timestamp)?.getTime() || 0))
    .slice(0, 100)
}

const createUpcomingItems = (sourceData: KpiSourceData, todayKey: string): UpcomingItem[] => {
  const shipmentItems = sourceData.shipments
    .filter(shipment => !isShipmentDone(shipment.status) && !isShipmentCancelled(shipment.status) && isWithinNextDays(shipment.plannedDeliveryDate, todayKey, 7))
    .slice(0, 8)
    .map(shipment => ({
      id: `upcoming-shipment-${shipment.id}`,
      category: 'Yaklaşan Sevkiyatlar',
      title: shipment.shipmentNo,
      detail: `${getBranchName(sourceData, shipment.destinationBranchId)} / ${formatNumber(shipment.items.length)} kalem`,
      date: shipment.plannedDeliveryDate,
      tone: shipment.priority === 'URGENT' ? 'danger' as KpiTone : shipment.priority === 'HIGH' ? 'warning' as KpiTone : 'neutral' as KpiTone
    }))

  const productionItems = sourceData.productionOrders
    .filter(order => !isProductionDone(order.status) && !isProductionCancelled(order.status) && isWithinNextDays(order.deliveryDate, todayKey, 7))
    .slice(0, 8)
    .map(order => ({
      id: `upcoming-production-${order.id}`,
      category: 'Yaklaşan Üretimler',
      title: order.workOrderNo,
      detail: order.lines.slice(0, 2).map(line => line.productName).join(', ') || order.description,
      date: order.deliveryDate,
      tone: order.priority === 'Acil' || order.priority === 'Yüksek' ? 'warning' as KpiTone : 'neutral' as KpiTone
    }))

  const expiryItems = sourceData.inventoryLots
    .filter(lot => clampValue(lot.remainingQuantity || lot.quantity) > 0 && isWithinNextDays(lot.expiryDate, todayKey, 21))
    .sort((first, second) => getDaysUntil(first.expiryDate, todayKey) - getDaysUntil(second.expiryDate, todayKey))
    .slice(0, 8)
    .map(lot => {
      const daysUntil = getDaysUntil(lot.expiryDate, todayKey)
      return {
        id: `upcoming-expiry-${lot.id}`,
        category: 'Yaklaşan SKT',
        title: lot.lotNo,
        detail: `${getStockItemName(sourceData, lot.stockItemId, getProductName(sourceData, lot.productId))} / ${formatNumber(lot.remainingQuantity || lot.quantity, 1)} ${lot.unit}`,
        date: lot.expiryDate,
        tone: daysUntil <= 3 ? 'danger' as KpiTone : daysUntil <= 7 ? 'warning' as KpiTone : 'neutral' as KpiTone
      }
    })

  const maintenanceItems = sourceData.productionLines
    .filter(line => line.status === 'Bakımda' || line.status === 'Yoğun' || line.estimatedUtilization >= 82)
    .slice(0, 6)
    .map((line, index) => {
      const date = addDays(new Date(), index + 1)
      return {
        id: `upcoming-maintenance-${line.id}`,
        category: 'Yaklaşan Bakımlar',
        title: line.code,
        detail: `${line.name} / ${formatPercent(line.estimatedUtilization)} doluluk`,
        date: toDateKey(date),
        tone: line.status === 'Bakımda' || line.estimatedUtilization >= 92 ? 'danger' as KpiTone : 'warning' as KpiTone
      }
    })

  const sampleItems = [
    ...sourceData.qualitySamples
      .filter(sample => isSamplePending(sample.status) && isWithinNextDays(sample.expiryDate, todayKey, 14))
      .slice(0, 6)
      .map(sample => ({
        id: `upcoming-sample-${sample.id}`,
        category: 'Yaklaşan Numune Süreleri',
        title: sample.sampleNo,
        detail: `${sample.sampleType} / ${sample.storageLocation}`,
        date: sample.expiryDate,
        tone: getDaysUntil(sample.expiryDate, todayKey) <= 3 ? 'danger' as KpiTone : 'warning' as KpiTone
      })),
    ...sourceData.witnessSamples
      .filter(sample => isSamplePending(sample.status) && isWithinNextDays(sample.storageEndDate, todayKey, 14))
      .slice(0, 6)
      .map(sample => ({
        id: `upcoming-witness-${sample.id}`,
        category: 'Yaklaşan Numune Süreleri',
        title: sample.witnessNo,
        detail: `${sample.responsiblePerson} / ${sample.storageLocation}`,
        date: sample.storageEndDate,
        tone: getDaysUntil(sample.storageEndDate, todayKey) <= 3 ? 'danger' as KpiTone : 'warning' as KpiTone
      }))
  ]

  return [
    ...shipmentItems,
    ...productionItems,
    ...expiryItems,
    ...maintenanceItems,
    ...sampleItems
  ]
    .sort((first, second) => getDaysUntil(first.date, todayKey) - getDaysUntil(second.date, todayKey))
    .slice(0, 40)
}

const createCriticalWarnings = (
  sourceData: KpiSourceData,
  criticalAlerts: CriticalAlert[],
  todayKey: string
): CriticalWarning[] => {
  const stockWarnings = sourceData.stockItems
    .filter(item => item.active && clampValue(item.currentQty) <= clampValue(item.minQty))
    .sort((first, second) => (first.currentQty - first.minQty) - (second.currentQty - second.minQty))
    .slice(0, 5)
    .map(item => ({
      id: `critical-stock-${item.id}`,
      category: 'Kritik Stok',
      title: item.name,
      detail: `${formatNumber(item.currentQty, 1)} ${item.unit} / min ${formatNumber(item.minQty, 1)} ${item.unit}`,
      severity: item.currentQty <= item.minQty * 0.5 ? 'CRITICAL' as const : 'HIGH' as const
    }))

  const haccpWarnings = sourceData.haccpRecords
    .flatMap(plan => [
      ...plan.monitoringRecords.filter(record => record.result === 'FAIL').map(record => ({
        id: `critical-haccp-monitoring-${record.id}`,
        category: 'Kritik HACCP',
        title: plan.name,
        detail: `${record.criticalLimit} / ${formatDateTime(record.checkedAt)}`,
        severity: 'CRITICAL' as const
      })),
      ...plan.correctiveActions.filter(action => action.status === 'OPEN' || action.status === 'IN_PROGRESS').map(action => ({
        id: `critical-haccp-action-${action.id}`,
        category: 'Kritik HACCP',
        title: plan.name,
        detail: `${action.assignedTo} / ${action.description}`,
        severity: action.status === 'OPEN' ? 'HIGH' as const : 'MEDIUM' as const
      }))
    ])
    .slice(0, 6)

  const recallWarnings = sourceData.productRecalls
    .filter(recall => isRecallActive(recall.status))
    .sort((first, second) => second.affectedCustomerCount - first.affectedCustomerCount)
    .slice(0, 5)
    .map(recall => ({
      id: `critical-recall-${recall.id}`,
      category: 'Recall',
      title: recall.recallNo,
      detail: `${recall.affectedCustomerCount} müşteri / ${recall.affectedShipmentCount} sevkiyat`,
      severity: recall.riskLevel === 'CRITICAL' ? 'CRITICAL' as const : 'HIGH' as const
    }))

  const wasteWarnings = sourceData.stockWasteRecords
    .filter(record => record.status === 'active' && (isSameDateKey(record.occurredAt || record.createdAt, todayKey) || clampValue(record.estimatedTotalCost || 0) > 4500))
    .sort((first, second) => clampValue(second.estimatedTotalCost || 0) - clampValue(first.estimatedTotalCost || 0))
    .slice(0, 4)
    .map(record => ({
      id: `critical-waste-${record.id}`,
      category: 'Fire',
      title: record.stockItemName,
      detail: `${formatNumber(record.qty, 1)} ${record.unit} / ${formatCurrency(record.estimatedTotalCost || 0)}`,
      severity: clampValue(record.estimatedTotalCost || 0) > 9000 ? 'HIGH' as const : 'MEDIUM' as const
    }))

  const delayedProductionWarnings = sourceData.productionOrders
    .filter(order => !isProductionDone(order.status) && !isProductionCancelled(order.status) && getDaysUntil(order.deliveryDate, todayKey) < 0)
    .slice(0, 5)
    .map(order => ({
      id: `critical-delayed-production-${order.id}`,
      category: 'Geciken Üretim',
      title: order.workOrderNo,
      detail: `${formatDate(order.deliveryDate)} / ${order.lines.slice(0, 2).map(line => line.productName).join(', ')}`,
      severity: order.priority === 'Acil' ? 'CRITICAL' as const : 'HIGH' as const
    }))

  const delayedShipmentWarnings = sourceData.shipments
    .filter(shipment => !isShipmentDone(shipment.status) && !isShipmentCancelled(shipment.status) && getDaysUntil(shipment.plannedDeliveryDate, todayKey) < 0)
    .slice(0, 5)
    .map(shipment => ({
      id: `critical-delayed-shipment-${shipment.id}`,
      category: 'Geciken Sevkiyat',
      title: shipment.shipmentNo,
      detail: `${getBranchName(sourceData, shipment.destinationBranchId)} / ${formatDate(shipment.plannedDeliveryDate)}`,
      severity: shipment.priority === 'URGENT' ? 'CRITICAL' as const : 'HIGH' as const
    }))

  const supplierWarnings = sourceData.suppliers
    .filter(supplier => (
      supplier.status === 'BLACKLISTED'
      || supplier.status === 'BLOCKED'
      || supplier.status === 'SUSPENDED'
      || supplier.workingStatus === 'STOPPED'
      || supplier.workingStatus === 'ON_HOLD'
      || supplier.approvalStatus === 'REJECTED'
    ))
    .slice(0, 4)
    .map(supplier => ({
      id: `critical-supplier-${supplier.id}`,
      category: 'Riskli Tedarikçi',
      title: supplier.name,
      detail: `${supplier.status} / ${supplier.workingStatus}`,
      severity: supplier.status === 'BLACKLISTED' || supplier.status === 'BLOCKED' ? 'CRITICAL' as const : 'HIGH' as const
    }))

  const alertWarnings = criticalAlerts
    .filter(alert => ['ACTIVE', 'ACKNOWLEDGED'].includes(alert.status) && (alert.level === 'CRITICAL' || alert.level === 'HIGH'))
    .slice(0, 6)
    .map(alert => ({
      id: `critical-alert-${alert.id}`,
      category: alert.category,
      title: alert.title,
      detail: alert.reason || alert.recommendedAction,
      severity: alert.level === 'CRITICAL' ? 'CRITICAL' as const : 'HIGH' as const
    }))

  return [
    ...stockWarnings,
    ...haccpWarnings,
    ...recallWarnings,
    ...wasteWarnings,
    ...delayedProductionWarnings,
    ...delayedShipmentWarnings,
    ...supplierWarnings,
    ...alertWarnings
  ]
    .filter((warning, index, warnings) => warnings.findIndex(candidate => candidate.id === warning.id) === index)
    .slice(0, 32)
}

const createQuickAccess = (): QuickAccessItem[] => [
  { id: 'production', label: 'Üretim', module: '34.3', route: 'production-work-orders', detail: 'Emir, plan ve üretim hatları', tone: 'neutral' },
  { id: 'purchase', label: 'Satın Alma', module: '34.5', route: 'purchase-requests', detail: 'Talepler, siparişler ve tedarikçiler', tone: 'warning' },
  { id: 'quality', label: 'Kalite', module: '34.7', route: 'quality-control-forms', detail: 'Form, numune, HACCP ve recall', tone: 'success' },
  { id: 'shipment', label: 'Sevkiyat', module: '34.6', route: 'shipment-plans', detail: 'Plan, araç ve teslimat durumu', tone: 'neutral' },
  { id: 'decision-support', label: 'Karar Destek', module: '34.13', route: 'decision-support', detail: 'Alarm, tahmin ve öneri motorları', tone: 'danger' },
  { id: 'reporting', label: 'Raporlama', module: '34.8', route: 'kpi-dashboard', detail: 'KPI ve read-model raporları', tone: 'neutral' },
  { id: 'warehouse', label: 'Depo', module: '34.2', route: 'stock-cards', detail: 'Stok, lot ve SKT görünümü', tone: 'warning' },
  { id: 'personnel', label: 'Personel', module: '34.10', route: 'staff', detail: 'Vardiya ve ekip kapasitesi', tone: 'success' }
]

const buildExecutiveDashboardModel = (): ExecutiveDashboardModel => {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const generatedAt = new Date().toISOString()
  const todayKey = toDateKey(new Date())
  const sourceData = loadKpiSourceData()
  const kpiDashboard = createKpiDashboardView(sourceData, createDefaultKpiFilters())
  const { rows: costRows, costView } = createCostDistributionRows(sourceData)
  const wasteRecords = WasteService.createReadModelRecords(sourceData)
  const wasteStats = WasteService.statistics(wasteRecords, sourceData)
  const qualityForms = QualityFormService.createReadModelRecords(sourceData)
  const criticalAlerts = CriticalAlertService.evaluate(sourceData, [], EXECUTIVE_ACTOR)
  const alertStats = CriticalAlertService.statistics(criticalAlerts)
  const forecastReport = ForecastService.evaluate(sourceData, {
    reportDate: todayKey,
    horizonDays: 7,
    analysisWindowDays: 30,
    scenarioName: 'Yönetici Günlük Tahmin',
    responsiblePerson: EXECUTIVE_ACTOR,
    description: 'Executive Dashboard tahmin özeti.'
  }, [], EXECUTIVE_ACTOR)
  const forecastStats = ForecastService.statistics([forecastReport])
  const recommendationReport = RecommendationService.evaluate(sourceData, {
    reportDate: todayKey,
    scope: 'all',
    responsiblePerson: EXECUTIVE_ACTOR,
    description: 'Executive Dashboard otomatik öneri özeti.'
  }, [], EXECUTIVE_ACTOR, {
    criticalAlerts,
    forecastPredictions: forecastReport.predictions
  })
  const recommendationStats = RecommendationService.statistics([recommendationReport])
  const aiReport = AIAnalysisService.evaluate(sourceData, {
    reportDate: todayKey,
    scope: 'all',
    responsiblePerson: EXECUTIVE_ACTOR,
    description: 'Executive Dashboard AI analiz özeti.'
  }, [], EXECUTIVE_ACTOR, {
    criticalAlerts,
    forecastPredictions: forecastReport.predictions,
    recommendationItems: recommendationReport.items
  })
  const aiStats = AIAnalysisService.statistics([aiReport])
  const productionRecommendationReport = ProductionPlanningRecommendationService.evaluate(sourceData, {
    reportDate: todayKey,
    scope: 'all',
    responsiblePerson: EXECUTIVE_ACTOR,
    description: 'Executive Dashboard üretim planlama önerileri özeti.'
  }, [], EXECUTIVE_ACTOR)
  const productionRecommendationStats = ProductionPlanningRecommendationService.statistics([productionRecommendationReport])
  const shipmentOptimizationReport = ShipmentOptimizationService.evaluate(sourceData, {
    reportDate: todayKey,
    scope: 'all',
    responsiblePerson: EXECUTIVE_ACTOR,
    description: 'Executive Dashboard sevkiyat optimizasyon özeti.'
  }, [], EXECUTIVE_ACTOR)
  const shipmentOptimizationStats = ShipmentOptimizationService.statistics([shipmentOptimizationReport])

  const totalProductionQuantity = createProductionQuantity(sourceData)
  const todayProductionQuantity = createProductionQuantity(sourceData, todayKey)
  const dailyProductionQuantity = todayProductionQuantity > 0
    ? todayProductionQuantity
    : roundKpi(sumBy(sourceData.productionLines, line => line.todayWorkOrderCount * line.capacity * 0.12))
  const todayShipments = sourceData.shipments.filter(shipment => isSameDateKey(shipment.shipmentDate || shipment.createdAt, todayKey))
  const activeProductionOrders = sourceData.productionOrders.filter(order => !isProductionDone(order.status) && !isProductionCancelled(order.status))
  const openPurchaseRequests = sourceData.purchaseRequests.filter(request => !isPurchaseClosed(request.status))
  const criticalStockItems = sourceData.stockItems.filter(item => item.active && clampValue(item.currentQty) <= clampValue(item.minQty))
  const todayWasteRecords = wasteRecords.filter(record => isSameDateKey(record.date || record.createdAt, todayKey))
  const todayWasteQuantity = todayWasteRecords.length > 0
    ? sumBy(todayWasteRecords, record => record.quantity)
    : sumBy(sourceData.stockWasteRecords.filter(record => isSameDateKey(record.occurredAt || record.createdAt, todayKey)), record => record.qty)
  const todayWasteCost = clampValue(
    todayWasteRecords.length > 0
      ? sumBy(todayWasteRecords, record => record.totalCost)
      : sumBy(sourceData.stockWasteRecords.filter(record => isSameDateKey(record.occurredAt || record.createdAt, todayKey)), record => record.estimatedTotalCost || 0),
    0,
    1_500_000
  )
  const activeRecalls = sourceData.productRecalls.filter(recall => isRecallActive(recall.status))
  const openQualityForms = qualityForms.filter(form => isQualityFormOpen(form.status))
  const pendingSamples = sourceData.qualitySamples.filter(sample => isSamplePending(sample.status))
  const activeLines = sourceData.productionLines.filter(line => line.status !== 'Pasif')
  const dailyEfficiency = averageBy(activeLines, line => clampValue(line.estimatedUtilization, 0, 100))
  const safeAverageCost = clampValue(costView.statistics.averageCostPerKg || costView.statistics.averageCost || 95, 18, 450)
  const dailyCostBaseQuantity = dailyProductionQuantity || roundKpi(totalProductionQuantity / 30) || 1400
  const todayEstimatedCost = roundKpi(clampValue(dailyCostBaseQuantity * safeAverageCost + todayWasteCost, 0, MAX_TODAY_COST))
  const warehouseRows = createWarehouseOccupancyRows(sourceData)
  const warehouseOccupancy = averageBy(warehouseRows, row => row.value)
  const haccpMonitoringRecords = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
  const haccpPassRate = percent(haccpMonitoringRecords.filter(record => record.result === 'PASS').length, haccpMonitoringRecords.length)
  const productionCompletionRate = percent(
    sourceData.productionOrders.filter(order => isProductionDone(order.status)).length,
    sourceData.productionOrders.filter(order => !isProductionCancelled(order.status)).length
  )
  const shipmentCompletionRate = percent(
    sourceData.shipments.filter(shipment => isShipmentDone(shipment.status)).length,
    sourceData.shipments.filter(shipment => !isShipmentCancelled(shipment.status)).length
  )
  const purchaseCompletionRate = percent(
    sourceData.purchaseRequests.filter(request => request.status === 'PURCHASE_ORDER_CREATED' || request.status === 'APPROVED').length,
    sourceData.purchaseRequests.filter(request => request.status !== 'CANCELLED').length
  )
  const criticalWarnings = createCriticalWarnings(sourceData, criticalAlerts, todayKey)
  const urgentPurchaseRequests = openPurchaseRequests.filter(request => request.priority === 'URGENT' || request.priority === 'HIGH')
  const upcomingPurchaseRequests = openPurchaseRequests.filter(request => isWithinNextDays(request.requiredDate, todayKey, 7))
  const purchaseSuggestionCount = criticalStockItems.length + urgentPurchaseRequests.length + upcomingPurchaseRequests.length
  const purchaseExpectedSaving = roundKpi(clampValue(
    sumBy(criticalStockItems, item => Math.max(0, item.minQty - item.currentQty) * clampValue(item.averageCost || item.lastPurchasePrice || item.unitPurchasePrice || 70, 8, 350) * 0.08)
    + sumBy(urgentPurchaseRequests, request => sumBy(request.items, item => item.estimatedTotalPrice) * 0.035),
    0,
    750_000
  ))

  const kpiCards: ExecutiveKpiCard[] = [
    {
      id: 'daily-production',
      label: 'Günlük Üretim',
      value: `${formatNumber(dailyProductionQuantity, 1)} birim`,
      detail: `${formatNumber(sourceData.productionLines.reduce((total, line) => total + line.todayWorkOrderCount, 0))} hat işi`,
      tone: dailyProductionQuantity > 0 ? 'success' : 'warning'
    },
    {
      id: 'daily-shipment',
      label: 'Günlük Sevkiyat',
      value: formatNumber(todayShipments.length),
      detail: `${formatNumber(sumBy(todayShipments, getShipmentQuantity), 1)} birim`,
      tone: todayShipments.length > 0 ? 'success' : 'neutral'
    },
    {
      id: 'active-production-orders',
      label: 'Aktif Üretim Emirleri',
      value: formatNumber(activeProductionOrders.length),
      detail: `${formatNumber(sourceData.productionOrders.length)} toplam emir`,
      tone: activeProductionOrders.length > 20 ? 'warning' : 'neutral'
    },
    {
      id: 'open-purchase-requests',
      label: 'Açık Satın Alma Talepleri',
      value: formatNumber(openPurchaseRequests.length),
      detail: `${formatNumber(urgentPurchaseRequests.length)} yüksek öncelik`,
      tone: urgentPurchaseRequests.length > 0 ? 'warning' : 'success'
    },
    {
      id: 'critical-alert-count',
      label: 'Kritik Alarm Sayısı',
      value: formatNumber(alertStats.criticalAlerts),
      detail: `${formatNumber(alertStats.activeAlerts)} aktif alarm`,
      tone: alertStats.criticalAlerts > 0 ? 'danger' : 'success'
    },
    {
      id: 'critical-stock',
      label: 'Kritik Stok',
      value: formatNumber(criticalStockItems.length),
      detail: `${formatNumber(sourceData.stockItems.length)} stok kartı izlendi`,
      tone: criticalStockItems.length > 0 ? 'danger' : 'success'
    },
    {
      id: 'today-waste',
      label: 'Bugünkü Fire',
      value: `${formatNumber(todayWasteQuantity, 1)} birim`,
      detail: `${formatCurrency(todayWasteCost)} tahmini maliyet`,
      tone: todayWasteQuantity > 0 ? 'warning' : 'success'
    },
    {
      id: 'active-recall',
      label: 'Aktif Recall',
      value: formatNumber(activeRecalls.length),
      detail: `${formatNumber(sourceData.productRecalls.filter(recall => recall.riskLevel === 'CRITICAL').length)} kritik recall`,
      tone: activeRecalls.some(recall => recall.riskLevel === 'CRITICAL') ? 'danger' : activeRecalls.length > 0 ? 'warning' : 'success'
    },
    {
      id: 'open-quality-form',
      label: 'Açık Kalite Formu',
      value: formatNumber(openQualityForms.length),
      detail: `${formatNumber(qualityForms.length)} kalite formu`,
      tone: openQualityForms.length > 0 ? 'warning' : 'success'
    },
    {
      id: 'pending-sample',
      label: 'Bekleyen Numune',
      value: formatNumber(pendingSamples.length),
      detail: `${formatNumber(sourceData.witnessSamples.filter(sample => isSamplePending(sample.status)).length)} şahit numune`,
      tone: pendingSamples.length > 0 ? 'warning' : 'success'
    },
    {
      id: 'today-estimated-cost',
      label: 'Bugünkü Tahmini Maliyet',
      value: formatCurrency(todayEstimatedCost),
      detail: `${formatCurrency(safeAverageCost)} ort. birim maliyet`,
      tone: todayEstimatedCost > 5_000_000 ? 'warning' : 'neutral'
    },
    {
      id: 'daily-efficiency',
      label: 'Günlük Verimlilik',
      value: formatPercent(dailyEfficiency),
      detail: `${formatNumber(activeLines.length)} aktif hat ortalaması`,
      tone: toPositiveTone(dailyEfficiency, 68, 82)
    }
  ]

  const operationSummary: OperationSummaryItem[] = [
    {
      id: 'production-completion',
      label: 'Üretim Tamamlanma Oranı',
      value: productionCompletionRate,
      formattedValue: formatPercent(productionCompletionRate),
      detail: `${formatNumber(sourceData.productionOrders.filter(order => isProductionDone(order.status)).length)} tamamlanan emir`,
      tone: toPositiveTone(productionCompletionRate)
    },
    {
      id: 'shipment-completion',
      label: 'Sevkiyat Tamamlanma Oranı',
      value: shipmentCompletionRate,
      formattedValue: formatPercent(shipmentCompletionRate),
      detail: `${formatNumber(sourceData.shipments.filter(shipment => isShipmentDone(shipment.status)).length)} teslim edilen sevkiyat`,
      tone: toPositiveTone(shipmentCompletionRate)
    },
    {
      id: 'purchase-status',
      label: 'Satın Alma Durumu',
      value: purchaseCompletionRate,
      formattedValue: formatPercent(purchaseCompletionRate),
      detail: `${formatNumber(openPurchaseRequests.length)} açık talep`,
      tone: toPositiveTone(purchaseCompletionRate, 62, 78)
    },
    {
      id: 'warehouse-occupancy',
      label: 'Depo Doluluk Oranı',
      value: warehouseOccupancy,
      formattedValue: formatPercent(warehouseOccupancy),
      detail: `${formatNumber(sourceData.inventoryLots.length)} lot izleniyor`,
      tone: toToneByPercent(warehouseOccupancy, 82, 94)
    },
    {
      id: 'haccp-status',
      label: 'HACCP Durumu',
      value: haccpPassRate,
      formattedValue: formatPercent(haccpPassRate),
      detail: `${formatNumber(haccpMonitoringRecords.filter(record => record.result === 'FAIL').length)} uygunsuz ölçüm`,
      tone: toPositiveTone(haccpPassRate, 86, 95)
    },
    {
      id: 'critical-warnings',
      label: 'Kritik Uyarılar',
      value: Math.min(100, criticalWarnings.length * 8),
      formattedValue: formatNumber(criticalWarnings.length),
      detail: 'Kırmızı panelde izlenen kayıt',
      tone: criticalWarnings.length > 12 ? 'danger' : criticalWarnings.length > 4 ? 'warning' : 'success'
    }
  ]

  const productionTrend = createTrendSeries(
    sourceData.productionOrders,
    14,
    order => order.deliveryDate || order.createdAt,
    order => sumBy(order.lines, line => line.quantity),
    'Günlük Üretim Trendi',
    KPI_COLORS[0]
  )
  const shipmentTrend = createTrendSeries(
    sourceData.shipments,
    14,
    shipment => shipment.shipmentDate || shipment.createdAt,
    getShipmentQuantity,
    'Günlük Sevkiyat',
    KPI_COLORS[1]
  )
  const wasteTrend = createTrendSeries(
    wasteRecords,
    14,
    record => record.date || record.createdAt,
    record => record.quantity,
    'Fire Dağılımı',
    CHART_THEME_COLORS.danger
  )

  const weeklyProductionRows = createDailyBarRows(
    sourceData.productionOrders,
    7,
    order => order.deliveryDate || order.createdAt,
    order => sumBy(order.lines, line => line.quantity),
    'Haftalık üretim',
    value => `${formatNumber(value, 1)} birim`
  )
  const lineOccupancyRows = sourceData.productionLines
    .map(line => ({
      id: line.id,
      label: line.name,
      value: clampValue(line.estimatedUtilization, 0, 100),
      formattedValue: formatPercent(line.estimatedUtilization),
      detail: `${line.code} / ${line.status}`,
      tone: toToneByPercent(line.estimatedUtilization, 78, 92)
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 8)
  const wasteDistributionRows = wasteStats.categoryRows.length > 0
    ? wasteStats.categoryRows
    : aggregateBarRows(
      sourceData.stockWasteRecords,
      record => record.reasonCategory,
      record => record.reasonCategory,
      record => record.qty,
      {
        detailLabel: 'Fire miktarı',
        formatValue: value => `${formatNumber(value, 1)} birim`
      }
    )
  const productProductionRows = createProductionProductRows(sourceData)
  const productionHourRows = createProductionHourRows(sourceData)

  const decisionSummary: DecisionSummaryItem[] = [
    {
      id: 'critical-alerts',
      label: 'Kritik Alarm',
      value: formatNumber(alertStats.criticalAlerts),
      detail: `${formatNumber(alertStats.activeAlerts)} aktif / risk ${formatNumber(alertStats.averageRiskScore, 1)}`,
      tone: alertStats.criticalAlerts > 0 ? 'danger' : 'success'
    },
    {
      id: 'forecasting',
      label: 'Tahminleme',
      value: formatNumber(forecastStats.totalForecasts),
      detail: `${formatNumber(forecastStats.riskyForecasts)} riskli / güven ${formatPercent(forecastStats.averageConfidence)}`,
      tone: forecastStats.riskyForecasts > 0 ? 'warning' : 'success'
    },
    {
      id: 'recommendations',
      label: 'Otomatik Öneriler',
      value: formatNumber(recommendationStats.totalRecommendations),
      detail: `${formatNumber(recommendationStats.criticalRecommendations)} kritik / ${formatNumber(recommendationStats.expectedTotalGain, 1)} fayda`,
      tone: recommendationStats.criticalRecommendations > 0 ? 'warning' : 'success'
    },
    {
      id: 'ai-analysis',
      label: 'AI Analizi',
      value: formatNumber(aiStats.totalInsights),
      detail: `${formatNumber(aiStats.criticalFindings)} kritik bulgu / güven ${formatPercent(aiStats.averageConfidence)}`,
      tone: aiStats.criticalFindings > 0 ? 'warning' : 'success'
    },
    {
      id: 'purchase-recommendations',
      label: 'Satın Alma Önerileri',
      value: formatNumber(purchaseSuggestionCount),
      detail: `${formatCurrency(purchaseExpectedSaving)} beklenen tasarruf`,
      tone: purchaseSuggestionCount > 0 ? 'warning' : 'success'
    },
    {
      id: 'production-planning-recommendations',
      label: 'Üretim Planlama Önerileri',
      value: formatNumber(productionRecommendationStats.totalRecommendations),
      detail: `${formatNumber(productionRecommendationStats.criticalBottlenecks)} darboğaz / ${formatNumber(productionRecommendationStats.expectedCapacityGainMinutes)} dk`,
      tone: productionRecommendationStats.criticalBottlenecks > 0 ? 'danger' : 'success'
    },
    {
      id: 'shipment-optimization',
      label: 'Sevkiyat Optimizasyonu',
      value: formatNumber(shipmentOptimizationStats.totalRecommendations),
      detail: `${formatCurrency(shipmentOptimizationStats.expectedCostSaving)} / ${formatNumber(shipmentOptimizationStats.expectedFuelSavingLiters, 1)} lt`,
      tone: shipmentOptimizationStats.criticalShipmentRisks > 0 ? 'warning' : 'success'
    }
  ]

  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start

  return {
    generatedAt,
    loadMs: Math.round(elapsed),
    sourceData,
    kpiCards,
    operationSummary,
    trendCharts: [productionTrend, shipmentTrend, wasteTrend],
    barCharts: [
      { id: 'weekly-production', title: 'Haftalık Üretim', rows: weeklyProductionRows },
      { id: 'line-occupancy', title: 'Üretim Merkezi Dolulukları', rows: lineOccupancyRows },
      { id: 'warehouse-occupancy', title: 'Depo Dolulukları', rows: warehouseRows },
      { id: 'cost-distribution', title: 'Maliyet Dağılımı', rows: costRows },
      { id: 'product-production', title: 'Ürün Bazlı Üretim', rows: productProductionRows },
      { id: 'production-hours', title: 'Üretim Saat Dağılımı', rows: productionHourRows }
    ],
    decisionSummary,
    timeline: createTimeline(sourceData, qualityForms),
    upcoming: createUpcomingItems(sourceData, todayKey),
    criticalWarnings,
    quickAccess: createQuickAccess()
  }
}

const createSheetRows = (model: ExecutiveDashboardModel) => ({
  KPI: model.kpiCards.map(card => ({
    KPI: card.label,
    Değer: card.value,
    Detay: card.detail,
    Durum: card.tone
  })),
  Operasyon: model.operationSummary.map(item => ({
    Başlık: item.label,
    Değer: item.formattedValue,
    Detay: item.detail,
    Durum: item.tone
  })),
  'Karar Destek': model.decisionSummary.map(item => ({
    Modül: item.label,
    Değer: item.value,
    Detay: item.detail,
    Durum: item.tone
  })),
  Grafikler: [
    ...model.trendCharts.flatMap(chart => chart.points.map(point => ({
      Grafik: chart.label,
      Kırılım: point.label,
      Değer: point.value
    }))),
    ...model.barCharts.flatMap(chart => chart.rows.map(row => ({
      Grafik: chart.title,
      Kırılım: row.label,
      Değer: row.formattedValue,
      Detay: row.detail
    })))
  ],
  Timeline: model.timeline.map(item => ({
    Modül: item.module,
    Başlık: item.title,
    Detay: item.detail,
    Durum: item.status,
    Tarih: formatDateTime(item.timestamp)
  })),
  'Yaklaşan İşler': model.upcoming.map(item => ({
    Kategori: item.category,
    Başlık: item.title,
    Detay: item.detail,
    Tarih: formatDate(item.date),
    Durum: item.tone
  })),
  'Kritik Uyarılar': model.criticalWarnings.map(item => ({
    Kategori: item.category,
    Başlık: item.title,
    Detay: item.detail,
    Seviye: item.severity
  }))
})

const exportDashboardToExcel = (model: ExecutiveDashboardModel) => {
  const sheets = createSheetRows(model)
  ExcelIntegrationService.exportWorkbook({
    moduleKeys: ['kpi'],
    moduleLabel: 'Yonetici Dashboard',
    fileNamePrefix: 'yonetici-dashboard',
    fileName: `yonetici-dashboard-${toDateKey(new Date())}.xlsx`,
    userName: ExcelIntegrationService.defaultUserName,
    sheets: Object.entries(sheets).map(([sheetName, rows]) => ({ sheetName, rows }))
  })
}

const escapeHtml = (value: unknown) => normalizeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const createPrintHtml = (model: ExecutiveDashboardModel, mode: 'PDF' | 'PRINT') => {
  const kpiRows = model.kpiCards.map(card => `
    <article>
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.detail)}</small>
    </article>
  `).join('')
  const warningRows = model.criticalWarnings.slice(0, 18).map(warning => `
    <tr>
      <td>${escapeHtml(warning.category)}</td>
      <td>${escapeHtml(warning.title)}</td>
      <td>${escapeHtml(warning.detail)}</td>
      <td>${escapeHtml(warning.severity)}</td>
    </tr>
  `).join('')
  const timelineRows = model.timeline.slice(0, 35).map(item => `
    <tr>
      <td>${escapeHtml(item.module)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(formatDateTime(item.timestamp))}</td>
    </tr>
  `).join('')

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <title>Yönetici Dashboard ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
      <style>
        body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
        header { border-bottom:2px solid ${PRINT_THEME_COLORS.accent}; padding-bottom:${PRINT_SPACING_VALUES.space12}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
        h1 { margin:0; font-size:24px; }
        p { margin:${PRINT_SPACING_VALUES.space4} 0 0; color:${PRINT_THEME_COLORS.textMutedStrong}; }
        .grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:${PRINT_SPACING_VALUES.space8}; margin:${PRINT_SPACING_VALUES.space16} 0; }
        article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:${PRINT_RADIUS_VALUES.card}; padding:${PRINT_SPACING_VALUES.space12}; page-break-inside:avoid; }
        article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
        article strong { display:block; margin:${PRINT_SPACING_VALUES.space4} 0; font-size:20px; }
        table { width:100%; border-collapse:collapse; margin-top:${PRINT_SPACING_VALUES.space8}; font-size:12px; }
        th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
        th { background:${PRINT_THEME_COLORS.pageBackground}; }
        section { margin-top:${PRINT_SPACING_VALUES.space16}; page-break-inside:avoid; }
        @media print { body { padding:${PRINT_SPACING_VALUES.space16}; } .grid { grid-template-columns:repeat(3, 1fr); } }
      </style>
    </head>
    <body>
      <header>
        <h1>Executive Dashboard</h1>
        <p>Oluşturulma: ${escapeHtml(formatDateTime(model.generatedAt))} / Yükleme: ${escapeHtml(model.loadMs)} ms</p>
      </header>
      <section class="grid">${kpiRows}</section>
      <section>
        <h2>Kritik Uyarılar</h2>
        <table>
          <thead><tr><th>Kategori</th><th>Başlık</th><th>Detay</th><th>Seviye</th></tr></thead>
          <tbody>${warningRows || '<tr><td colspan="4">Kritik uyarı bulunamadı.</td></tr>'}</tbody>
        </table>
      </section>
      <section>
        <h2>Son İşlemler</h2>
        <table>
          <thead><tr><th>Modül</th><th>Başlık</th><th>Durum</th><th>Tarih</th></tr></thead>
          <tbody>${timelineRows || '<tr><td colspan="4">Timeline kaydı bulunamadı.</td></tr>'}</tbody>
        </table>
      </section>
      <script>window.onload = () => window.print()</script>
    </body>
  </html>`
}

const openPrintWindow = (model: ExecutiveDashboardModel, mode: 'PDF' | 'PRINT') => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if(!printWindow) return
  printWindow.document.open()
  printWindow.document.write(createPrintHtml(model, mode))
  printWindow.document.close()
}

export default function BusinessSummary(){
  const [model, setModel] = React.useState<ExecutiveDashboardModel | null>(null)
  const [loadProgress, setLoadProgress] = React.useState(18)
  const [loadError, setLoadError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const progressTimer = window.setInterval(() => {
      setLoadProgress(previous => previous >= 88 ? previous : previous + 14)
    }, 120)
    const loadTimer = window.setTimeout(() => {
      try {
        const dashboardModel = buildExecutiveDashboardModel()
        if(cancelled) return
        setModel(dashboardModel)
        setLoadProgress(100)
      } catch(error) {
        if(cancelled) return
        setLoadError(error instanceof Error ? error : new Error('Executive Dashboard yüklenemedi.'))
      }
    }, 40)

    return () => {
      cancelled = true
      window.clearInterval(progressTimer)
      window.clearTimeout(loadTimer)
    }
  }, [])

  if(loadError) throw loadError

  if(!model){
    return <ExecutiveDashboardLoading progress={loadProgress} />
  }

  return (
    <div className="business-summary-page executive-dashboard-page dashboard-experience-page">
      <DashboardExperienceHeader
        eyebrow="Executive Dashboard"
        title="Executive Dashboard"
        icon="dashboard"
        description="Endüstriyel mutfak operasyonları için üretim, depo, satın alma, kalite, sevkiyat, recall ve karar destek yönetici görünümü."
        meta={[
          { key: 'readonly', label: 'Salt Okunur', icon: 'success', tone: 'success' },
          { key: 'generated-at', label: formatDateTime(model.generatedAt), icon: 'report', tone: 'neutral' },
          { key: 'load-ms', label: `${formatNumber(model.loadMs)} ms`, icon: 'analytics', tone: 'info' }
        ]}
        actions={[
          { key: 'excel', label: 'Excel Dashboard', icon: 'excel', onClick: () => exportDashboardToExcel(model) },
          { key: 'pdf', label: 'PDF Dashboard', icon: 'report', onClick: () => openPrintWindow(model, 'PDF') },
          { key: 'print', label: 'Yazdır', icon: 'print', tone: 'primary', onClick: () => openPrintWindow(model, 'PRINT') }
        ]}
      />

      <div className="executive-dashboard-meta">
        <span>Oluşturulma: {formatDateTime(model.generatedAt)}</span>
        <span>Yükleme: {formatNumber(model.loadMs)} ms</span>
        <span>{formatNumber(model.timeline.length)} son işlem</span>
      </div>

      <KpiCardGrid cards={model.kpiCards} />

      <section className="card executive-dashboard-section">
        <div className="section-header compact">
          <div>
            <h3>Operasyon Özeti</h3>
            <p className="muted">Üretim, sevkiyat, satın alma, depo ve HACCP sinyalleri aynı read-model üzerinden hesaplandı.</p>
          </div>
        </div>
        <OperationSummaryGrid items={model.operationSummary} />
      </section>

      <section className="executive-dashboard-section">
        <div className="section-header compact">
          <div>
            <h3>Grafikler</h3>
            <p className="muted">Günlük trendler, doluluklar, fire ve maliyet kırılımları.</p>
          </div>
        </div>
        <div className="executive-dashboard-chart-grid">
          {model.trendCharts.map(series => <LineChartCard key={series.id} series={series} />)}
          {model.barCharts.map(chart => <BarChartCard key={chart.id} title={chart.title} rows={chart.rows} />)}
        </div>
      </section>

      <section className="card executive-dashboard-section">
        <div className="section-header compact">
          <div>
            <h3>Karar Destek Özeti</h3>
            <p className="muted">Kritik alarm, tahminleme, otomatik öneriler ve optimizasyon motorları.</p>
          </div>
        </div>
        <DecisionSummaryGrid items={model.decisionSummary} />
      </section>

      <section className="executive-dashboard-bottom-grid">
        <TimelinePanel items={model.timeline} />
        <UpcomingPanel items={model.upcoming} />
        <CriticalWarningsPanel warnings={model.criticalWarnings} />
        <QuickAccessPanel items={model.quickAccess} />
      </section>
    </div>
  )
}

function ExecutiveDashboardLoading({ progress }: { progress: number }){
  return (
    <div className="business-summary-page executive-dashboard-page dashboard-experience-page">
      <DashboardExperienceHeader
        eyebrow="Hazırlanıyor"
        title="Executive Dashboard"
        icon="dashboard"
        description="Yönetici görünümü oluşturuluyor."
        meta={[
          { key: 'progress', label: `%${clampValue(progress, 8, 100)}`, icon: 'analytics', tone: 'info' }
        ]}
      />
      <section className="card executive-loading-card">
        <div className="executive-loading-progress">
          <span style={{ width: `${clampValue(progress, 8, 100)}%` }} />
        </div>
        <div className="executive-skeleton-grid">
          {Array.from({ length: 12 }, (_, index) => <div className="executive-skeleton-card" key={`skeleton-${index}`} />)}
        </div>
      </section>
    </div>
  )
}

function KpiCardGrid({ cards }: { cards: ExecutiveKpiCard[] }){
  return (
    <div className="metric-grid executive-dashboard-kpi-grid">
      {cards.map(card => (
        <DashboardKpiCard
          key={card.id}
          label={card.label}
          value={card.value}
          detail={card.detail}
          tone={card.tone}
          icon="analytics"
          trend={card.tone === 'success' ? 'İyi' : card.tone === 'warning' ? 'İzle' : card.tone === 'danger' ? 'Kritik' : 'Normal'}
        />
      ))}
    </div>
  )
}

function OperationSummaryGrid({ items }: { items: OperationSummaryItem[] }){
  return (
    <div className="executive-operation-grid">
      {items.map(item => (
        <div className={`executive-operation-row ${item.tone}`} key={item.id}>
          <div>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </div>
          <em>{item.formattedValue}</em>
          <div className="executive-progress-track" aria-hidden="true">
            <span style={{ width: `${clampValue(item.value, 0, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card executive-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{formatNumber(series.points.length)} gün</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.map(point => (
          <div className="kpi-line-point" key={point.dateKey}>
            <span style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%`, background: series.color }} />
            <strong>{formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function BarChartCard({
  rows,
  title
}: {
  rows: BarChartRow[]
  title: string
}){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card executive-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kayıt</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayıt bulunamadı.</div>}
        {rows.map(row => (
          <div className={`kpi-bar-row ${row.tone || ''}`} key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function DecisionSummaryGrid({ items }: { items: DecisionSummaryItem[] }){
  return (
    <div className="executive-decision-grid">
      {items.map(item => (
        <article className={`executive-decision-card ${item.tone}`} key={item.id}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </div>
  )
}

function TimelinePanel({ items }: { items: ExecutiveTimelineItem[] }){
  return (
    <section className="card executive-list-panel executive-timeline-panel">
      <div className="section-header compact">
        <div>
          <h3>Son İşlemler</h3>
          <p className="muted">Son {formatNumber(items.length)} kayıt</p>
        </div>
      </div>
      <div className="executive-timeline-list">
        {items.length === 0 && <div className="empty-cell">Timeline kaydı bulunamadı.</div>}
        {items.map(item => (
          <div className={`executive-timeline-row ${item.tone}`} key={item.id}>
            <span>{item.module}</span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
            <em>{item.status} / {formatDateTime(item.timestamp)}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function UpcomingPanel({ items }: { items: UpcomingItem[] }){
  return (
    <section className="card executive-list-panel">
      <div className="section-header compact">
        <div>
          <h3>Yaklaşan İşler</h3>
          <p className="muted">{formatNumber(items.length)} yaklaşan kayıt</p>
        </div>
      </div>
      <div className="executive-compact-list">
        {items.length === 0 && <div className="empty-cell">Yaklaşan kayıt bulunamadı.</div>}
        {items.map(item => (
          <div className={`executive-compact-row ${item.tone}`} key={item.id}>
            <div>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
            <em>{formatDate(item.date)}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function CriticalWarningsPanel({ warnings }: { warnings: CriticalWarning[] }){
  return (
    <section className="card executive-list-panel executive-warning-panel">
      <div className="section-header compact">
        <div>
          <h3>Kritik Uyarılar</h3>
          <p className="muted">{formatNumber(warnings.length)} risk sinyali</p>
        </div>
      </div>
      <div className="executive-warning-list">
        {warnings.length === 0 && <div className="empty-cell">Kritik uyarı bulunamadı.</div>}
        {warnings.map(warning => (
          <div className={`executive-warning-row ${warning.severity.toLocaleLowerCase('tr-TR')}`} key={warning.id}>
            <span>{warning.category}</span>
            <strong>{warning.title}</strong>
            <small>{warning.detail}</small>
            <em>{warning.severity}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuickAccessPanel({ items }: { items: QuickAccessItem[] }){
  return (
    <section className="card executive-list-panel">
      <div className="section-header compact">
        <div>
          <h3>Hızlı Erişim</h3>
          <p className="muted">Temel operasyon modülleri</p>
        </div>
      </div>
      <div className="executive-quick-access-grid">
        {items.map(item => (
          <article className={`executive-quick-access-card ${item.tone}`} key={item.id}>
            <span>{item.module}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
            <em>{item.route}</em>
          </article>
        ))}
      </div>
    </section>
  )
}
