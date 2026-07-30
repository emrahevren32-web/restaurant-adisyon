import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import { GoodsReceiptService } from '../goods-receipts/goods-receipt.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { QualityFormService } from '../quality-forms/quality-form.service'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import type { StockItem } from '../types'
import { WasteService } from '../waste-management/waste.service'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import { createForecastHistory } from './forecast-history.service'
import type {
  ForecastPrediction,
  ForecastReport,
  ForecastReportCreateInput,
  ForecastRiskLevel,
  ForecastScenario,
  ForecastSourceModule,
  ForecastTrendDirection,
  ForecastType
} from './forecasting.types'

type ForecastCalculationInput = ForecastReportCreateInput & {
  sourceData: KpiSourceData
  getReportNo: () => string
  actorName: string
}

type MetricEvent = {
  date: string
  value: number
  unit: string
  entityId: string
  entityName: string
  productId?: string
  productName?: string
  stockItemId?: string
  stockItemName?: string
  branchId?: string
  branchName?: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  employeeId?: string
  employeeName?: string
  categoryId?: string
  categoryName?: string
  supplierId?: string
  supplierName?: string
  sourceModule: ForecastSourceModule
  sourceId: string
  sourceNo: string
}

type ForecastProfile = {
  baseline7: number
  baseline30: number
  baseline90: number
  baseline365: number
  baselineValue: number
  expectedValue: number
  minimumValue: number
  maximumValue: number
  growthPercent: number
  seasonalityScore: number
  confidenceScore: number
  trendDirection: ForecastTrendDirection
}

const DAY_MS = 86400000

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getDaysBetween = (
  firstDate: string,
  secondDate: string
) => {
  const first = new Date(`${getDateKey(firstDate)}T00:00:00`)
  const second = new Date(`${getDateKey(secondDate)}T00:00:00`)
  if(Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return 999
  return Math.round((second.getTime() - first.getTime()) / DAY_MS)
}

const isWithinLastDays = (
  dateValue: string,
  days: number,
  referenceDate = getTodayKey()
) => {
  const dateKey = getDateKey(dateValue)
  if(!dateKey) return false
  return dateKey <= referenceDate && getDaysBetween(dateKey, referenceDate) <= days - 1
}

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')
const normalizeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundKpi(parsed) : 0
}

const clamp = (
  value: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, value))

const getRiskLevel = (
  riskScore: number
): ForecastRiskLevel => {
  if(riskScore >= 85) return 'CRITICAL'
  if(riskScore >= 65) return 'HIGH'
  if(riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

const getTrendDirection = (
  growthPercent: number,
  seasonalityScore: number
): ForecastTrendDirection => {
  if(Math.abs(seasonalityScore) >= 25) return 'SEASONAL'
  if(growthPercent >= 8) return 'UP'
  if(growthPercent <= -8) return 'DOWN'
  return 'STABLE'
}

const sumEventsWithin = (
  events: MetricEvent[],
  days: number,
  reportDate: string
) => sumBy(
  events.filter(event => isWithinLastDays(event.date, days, reportDate)),
  event => event.value
)

const createProfile = (
  events: MetricEvent[],
  horizonDays: number,
  analysisWindowDays: number,
  reportDate: string,
  fallbackDailyValue = 0
): ForecastProfile => {
  const baseline7 = sumEventsWithin(events, 7, reportDate)
  const baseline30 = sumEventsWithin(events, 30, reportDate)
  const baseline90 = sumEventsWithin(events, 90, reportDate)
  const baseline365 = sumEventsWithin(events, 365, reportDate)
  const selectedTotal = sumEventsWithin(events, analysisWindowDays, reportDate)
  const daily7 = baseline7 / 7
  const daily30 = baseline30 / 30
  const daily90 = baseline90 / 90
  const selectedDaily = selectedTotal > 0 ? selectedTotal / analysisWindowDays : daily30 || daily90 || fallbackDailyValue
  const growthPercent = daily90 > 0 ? percent(daily30 - daily90, daily90) : daily30 > 0 ? 100 : 0
  const seasonalityScore = daily30 > 0 ? percent(daily7 - daily30, daily30) : 0
  const trendDirection = getTrendDirection(growthPercent, seasonalityScore)
  const baselineValue = roundKpi(selectedDaily * horizonDays)
  const expectedValue = roundKpi(Math.max(0, baselineValue * (1 + growthPercent * 0.0035 + seasonalityScore * 0.002)))
  const confidenceScore = roundKpi(clamp(
    45
    + Math.min(22, events.length * 2.2)
    + (baseline30 > 0 ? 15 : 0)
    + (baseline90 > 0 ? 8 : 0)
    - Math.min(18, Math.abs(growthPercent) * 0.08)
    - Math.min(10, Math.abs(seasonalityScore) * 0.05),
    35,
    96
  ))
  const uncertainty = clamp((100 - confidenceScore) / 100, 0.08, 0.45)

  return {
    baseline7: roundKpi(baseline7),
    baseline30: roundKpi(baseline30),
    baseline90: roundKpi(baseline90),
    baseline365: roundKpi(baseline365),
    baselineValue,
    expectedValue,
    minimumValue: roundKpi(Math.max(0, expectedValue * (1 - uncertainty))),
    maximumValue: roundKpi(expectedValue * (1 + uncertainty)),
    growthPercent: roundKpi(growthPercent),
    seasonalityScore: roundKpi(seasonalityScore),
    confidenceScore,
    trendDirection
  }
}

const groupEvents = (
  events: MetricEvent[]
) => events.reduce<Map<string, MetricEvent[]>>((map, event) => {
  const key = event.entityId || normalizeKey(event.entityName)
  if(!key) return map
  map.set(key, [...(map.get(key) || []), event])
  return map
}, new Map())

const firstEvent = (
  events: MetricEvent[]
) => events[0] || null

const getStockItemName = (
  sourceData: KpiSourceData,
  stockItemId: string
) => sourceData.stockItems.find(item => item.id === stockItemId)?.name || stockItemId

const getStockItem = (
  sourceData: KpiSourceData,
  stockItemId: string
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getBranchName = (
  sourceData: KpiSourceData,
  branchId: string
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId

const getSupplierName = (
  sourceData: KpiSourceData,
  supplierId: string
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId

const getProductRef = (
  sourceData: KpiSourceData,
  productName: string
) => sourceData.productRefs.find(product => normalizeKey(product.name) === normalizeKey(productName))

const getAlertBoost = (
  alerts: CriticalAlert[],
  forecastType: ForecastType,
  entityId: string,
  entityName: string
) => {
  const relatedAlerts = alerts.filter(alert => (
    alert.status === 'ACTIVE'
    && (
      alert.relatedEntityId === entityId
      || normalizeKey(alert.relatedEntityName) === normalizeKey(entityName)
      || (forecastType === 'STOCK' && alert.category === 'STOCK')
      || (forecastType === 'QUALITY' && (alert.category === 'QUALITY' || alert.category === 'HACCP' || alert.category === 'LOT'))
      || (forecastType === 'SHIPMENT' && alert.category === 'SHIPMENT')
      || (forecastType === 'PERSONNEL' && alert.category === 'PERSONNEL')
      || (forecastType === 'PRODUCTION' && (alert.category === 'PRODUCTION' || alert.category === 'CAPACITY' || alert.category === 'MACHINE'))
    )
  ))
  if(relatedAlerts.length === 0) return 0

  return clamp(
    relatedAlerts.length * 5 + averageBy(relatedAlerts, alert => alert.riskScore) * 0.12,
    0,
    28
  )
}

const createPrediction = ({
  alerts,
  baseRiskScore,
  event,
  forecastType,
  profile,
  reportId,
  reportNo,
  recommendation,
  evidence,
  expectedDemand = 0,
  expectedProduction = 0,
  expectedStock = 0,
  expectedWaste = 0,
  expectedShipment = 0,
  expectedCapacityPercent = 0,
  expectedPersonnelNeed = 0,
  daysToCritical = 999,
  expectedValue
}: {
  alerts: CriticalAlert[]
  baseRiskScore: number
  event: MetricEvent
  forecastType: ForecastType
  profile: ForecastProfile
  reportId: string
  reportNo: string
  recommendation: string
  evidence: string
  expectedDemand?: number
  expectedProduction?: number
  expectedStock?: number
  expectedWaste?: number
  expectedShipment?: number
  expectedCapacityPercent?: number
  expectedPersonnelNeed?: number
  daysToCritical?: number
  expectedValue?: number
}): ForecastPrediction => {
  const nextExpectedValue = expectedValue ?? profile.expectedValue
  const alertBoost = getAlertBoost(alerts, forecastType, event.entityId, event.entityName)
  const riskScore = roundKpi(clamp(
    baseRiskScore
    + alertBoost
    + Math.max(0, profile.growthPercent) * 0.14
    + Math.max(0, 58 - profile.confidenceScore) * 0.2,
    0,
    100
  ))
  const riskLevel = getRiskLevel(riskScore)

  return {
    id: `forecast_prediction_${reportNo}_${forecastType}_${event.entityId}`.replace(/[^a-zA-Z0-9_]+/g, '_'),
    reportId,
    reportNo,
    forecastType,
    entityType: event.sourceModule,
    entityId: event.entityId,
    entityName: event.entityName,
    productId: event.productId || '',
    productName: event.productName || '',
    stockItemId: event.stockItemId || '',
    stockItemName: event.stockItemName || '',
    branchId: event.branchId || '',
    branchName: event.branchName || '',
    productionLineId: event.productionLineId || '',
    productionLineName: event.productionLineName || '',
    machineId: event.machineId || '',
    machineCode: event.machineCode || '',
    machineName: event.machineName || '',
    employeeId: event.employeeId || '',
    employeeName: event.employeeName || '',
    categoryId: event.categoryId || '',
    categoryName: event.categoryName || '',
    supplierId: event.supplierId || '',
    supplierName: event.supplierName || '',
    sourceModule: event.sourceModule,
    sourceId: event.sourceId,
    sourceNo: event.sourceNo,
    unit: event.unit,
    periodLabel: 'Gelecek tahmin periyodu',
    baseline7: profile.baseline7,
    baseline30: profile.baseline30,
    baseline90: profile.baseline90,
    baseline365: profile.baseline365,
    baselineValue: profile.baselineValue,
    expectedValue: nextExpectedValue,
    minimumValue: profile.minimumValue,
    maximumValue: profile.maximumValue,
    growthPercent: profile.growthPercent,
    seasonalityScore: profile.seasonalityScore,
    confidenceScore: profile.confidenceScore,
    riskScore,
    riskLevel,
    trendDirection: profile.trendDirection,
    expectedDemand,
    expectedProduction,
    expectedStock,
    expectedWaste,
    expectedShipment,
    expectedCapacityPercent,
    expectedPersonnelNeed,
    daysToCritical,
    recommendation,
    evidence,
    createdAt: new Date().toISOString()
  }
}

const createProductionPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const plans = ProductionPlanningService.list(input.sourceData).filter(plan => plan.status !== 'CANCELLED')
  const capacityPlans = CapacityPlanningService.list(input.sourceData).filter(plan => plan.status !== 'CANCELLED')
  const capacityPercent = averageBy(
    capacityPlans.flatMap(plan => plan.productionCapacities),
    capacity => capacity.utilizationPercent
  )
  const planEvents: MetricEvent[] = plans.flatMap(plan => plan.items.map(item => {
    const productRef = getProductRef(input.sourceData, item.productName)
    return {
      date: plan.planDate,
      value: item.produceQuantity,
      unit: item.unit,
      entityId: productRef?.id || normalizeKey(item.productName),
      entityName: item.productName,
      productId: productRef?.id || '',
      productName: item.productName,
      stockItemId: productRef?.stockItemId || '',
      stockItemName: productRef?.stockItemId ? getStockItemName(input.sourceData, productRef.stockItemId) : '',
      branchId: plan.branchId,
      branchName: plan.branchName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      sourceModule: 'ProductionPlanning',
      sourceId: plan.id,
      sourceNo: plan.planNo
    }
  }))
  const orderEvents: MetricEvent[] = input.sourceData.productionOrders.flatMap(order => order.lines.map(line => {
    const productRef = getProductRef(input.sourceData, line.productName)
    return {
      date: order.createdAt || order.deliveryDate,
      value: line.quantity,
      unit: line.unit,
      entityId: productRef?.id || normalizeKey(line.productName),
      entityName: line.productName,
      productId: productRef?.id || '',
      productName: line.productName,
      stockItemId: productRef?.stockItemId || '',
      stockItemName: productRef?.stockItemId ? getStockItemName(input.sourceData, productRef.stockItemId) : '',
      branchName: order.branch,
      sourceModule: 'ReadModel',
      sourceId: order.id,
      sourceNo: order.workOrderNo
    }
  }))

  return Array.from(groupEvents([...planEvents, ...orderEvents]).values())
    .map(events => {
      const event = firstEvent(events)
      if(!event) return null
      const profile = createProfile(events, input.horizonDays, input.analysisWindowDays, input.reportDate)
      const expectedCapacityPercent = averageBy(
        plans.flatMap(plan => plan.items).filter(item => item.productName === event.productName),
        item => item.capacityUsagePercent
      ) || capacityPercent
      const risk = expectedCapacityPercent >= 100
        ? 78
        : profile.growthPercent >= 25
          ? 62
          : 28
      return createPrediction({
        alerts,
        baseRiskScore: risk,
        event,
        forecastType: 'PRODUCTION',
        profile,
        reportId,
        reportNo,
        expectedProduction: profile.expectedValue,
        expectedDemand: profile.expectedValue,
        expectedCapacityPercent,
        recommendation: profile.growthPercent >= 8
          ? `${event.entityName} uretimi gelecek periyotta artisa hazirlanmali.`
          : `${event.entityName} uretim tahmini mevcut kapasiteyle izlenmeli.`,
        evidence: `Son 30 gun ${profile.baseline30} ${event.unit}, buyume ${profile.growthPercent}%.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.riskScore - first.riskScore)
    .slice(0, 12)
}

const createDemandPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const plans = ProductionPlanningService.list(input.sourceData).filter(plan => plan.status !== 'CANCELLED')
  const demandEvents: MetricEvent[] = plans.flatMap(plan => plan.items.map(item => {
    const productRef = getProductRef(input.sourceData, item.productName)
    return {
      date: plan.planDate,
      value: item.demandQuantity + item.branchDemandQuantity + item.customerOrderQuantity + item.forecastQuantity,
      unit: item.unit,
      entityId: productRef?.id || normalizeKey(item.productName),
      entityName: item.productName,
      productId: productRef?.id || '',
      productName: item.productName,
      stockItemId: productRef?.stockItemId || '',
      stockItemName: productRef?.stockItemId ? getStockItemName(input.sourceData, productRef.stockItemId) : '',
      branchId: plan.branchId,
      branchName: plan.branchName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      sourceModule: 'ProductionPlanning',
      sourceId: plan.id,
      sourceNo: plan.planNo
    }
  }))
  const shipmentDemandEvents: MetricEvent[] = ShipmentFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .flatMap(form => form.items.map(item => ({
      date: form.deliveryDate || form.loadingDate,
      value: item.quantity,
      unit: item.unit,
      entityId: item.productId || item.stockItemId || normalizeKey(item.productName || item.stockItemName),
      entityName: item.productName || item.stockItemName,
      productId: item.productId,
      productName: item.productName,
      stockItemId: item.stockItemId,
      stockItemName: item.stockItemName,
      branchId: form.branchId,
      branchName: form.branchName,
      sourceModule: 'ShipmentForms' as const,
      sourceId: form.id,
      sourceNo: form.formNo
    })))

  return Array.from(groupEvents([...demandEvents, ...shipmentDemandEvents]).values())
    .map(events => {
      const event = firstEvent(events)
      if(!event) return null
      const profile = createProfile(events, input.horizonDays, input.analysisWindowDays, input.reportDate)
      return createPrediction({
        alerts,
        baseRiskScore: profile.growthPercent >= 25 ? 68 : profile.growthPercent >= 10 ? 48 : 24,
        event,
        forecastType: 'DEMAND',
        profile,
        reportId,
        reportNo,
        expectedDemand: profile.expectedValue,
        recommendation: profile.growthPercent >= 8
          ? `${event.entityName} talebi icin uretim ve satin alma senaryosu manuel incelenmeli.`
          : `${event.entityName} talebi standart planla izlenebilir.`,
        evidence: `Son 7 gun ${profile.baseline7} ${event.unit}, mevsimsellik ${profile.seasonalityScore}%.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.expectedDemand - first.expectedDemand)
    .slice(0, 10)
}

const createStockPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => input.sourceData.stockItems
  .filter(item => item.active)
  .map(item => {
    const outboundEvents: MetricEvent[] = input.sourceData.stockMovements
      .filter(movement => movement.stockItemId === item.id && movement.previousQty > movement.nextQty)
      .map(movement => ({
        date: movement.movementDate || movement.createdAt,
        value: Math.max(0, movement.previousQty - movement.nextQty || movement.qty),
        unit: movement.unit,
        entityId: item.id,
        entityName: item.name,
        stockItemId: item.id,
        stockItemName: item.name,
        branchId: item.branchId,
        branchName: getBranchName(input.sourceData, item.branchId),
        categoryId: item.categoryId,
        categoryName: item.categoryId,
        sourceModule: 'Stock' as const,
        sourceId: movement.id,
        sourceNo: movement.id
      }))
    const receiptEvents: MetricEvent[] = GoodsReceiptService.list(input.sourceData)
      .flatMap(receipt => receipt.items
        .filter(receiptItem => receiptItem.stockItemId === item.id)
        .map(receiptItem => ({
          date: receipt.receiptDate,
          value: receiptItem.acceptedQuantity,
          unit: receiptItem.unit,
          entityId: item.id,
          entityName: item.name,
          stockItemId: item.id,
          stockItemName: item.name,
          branchId: receipt.warehouseId,
          branchName: receipt.warehouseName || receipt.warehouseId,
          supplierId: receipt.supplierId,
          supplierName: receipt.supplierName || receipt.supplierId,
          sourceModule: 'GoodsReceipt' as const,
          sourceId: receipt.id,
          sourceNo: receipt.receiptNo
        })))
    const profile = createProfile(outboundEvents, input.horizonDays, input.analysisWindowDays, input.reportDate, item.currentQty > 0 ? item.minQty / 30 : 0)
    const receiptProfile = createProfile(receiptEvents, input.horizonDays, input.analysisWindowDays, input.reportDate)
    const expectedConsumption = profile.expectedValue
    const expectedReceipt = receiptProfile.expectedValue * 0.65
    const expectedStock = roundKpi(item.currentQty - expectedConsumption + expectedReceipt)
    const dailyConsumption = profile.baseline30 > 0 ? profile.baseline30 / 30 : expectedConsumption / Math.max(1, input.horizonDays)
    const daysToCritical = dailyConsumption > 0
      ? roundKpi((item.currentQty - item.minQty) / dailyConsumption)
      : 999
    const stockProfile = {
      ...profile,
      expectedValue: expectedStock,
      minimumValue: roundKpi(Math.max(0, expectedStock * 0.88)),
      maximumValue: roundKpi(Math.max(0, expectedStock * 1.12))
    }
    const baseRiskScore = expectedStock <= item.minQty
      ? 86
      : daysToCritical <= 3
        ? 78
        : daysToCritical <= 7
          ? 64
          : 24
    const event = firstEvent(outboundEvents) || {
      date: item.updatedAt || item.createdAt,
      value: item.currentQty,
      unit: item.unit,
      entityId: item.id,
      entityName: item.name,
      stockItemId: item.id,
      stockItemName: item.name,
      branchId: item.branchId,
      branchName: getBranchName(input.sourceData, item.branchId),
      categoryId: item.categoryId,
      categoryName: item.categoryId,
      sourceModule: 'Stock' as const,
      sourceId: item.id,
      sourceNo: item.sku || item.id
    }

    return createPrediction({
      alerts,
      baseRiskScore,
      event,
      forecastType: 'STOCK',
      profile: stockProfile,
      reportId,
      reportNo,
      expectedDemand: expectedConsumption,
      expectedStock,
      expectedValue: expectedStock,
      daysToCritical,
      recommendation: expectedStock <= item.minQty || daysToCritical <= 3
        ? `${item.name} icin satin alma veya depo transferi erkene cekilmeli.`
        : `${item.name} stok projeksiyonu izlenmeli.`,
      evidence: `Mevcut ${item.currentQty} ${item.unit}, beklenen tuketim ${roundKpi(expectedConsumption)} ${item.unit}, kritik gun ${daysToCritical}.`
    })
  })
  .sort((first, second) => second.riskScore - first.riskScore)
  .slice(0, 14)

const createWastePredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const events: MetricEvent[] = WasteService.list(input.sourceData)
    .filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED')
    .map(record => ({
      date: record.date || record.createdAt,
      value: record.quantity,
      unit: record.unit,
      entityId: record.productId || record.stockItemId || normalizeKey(record.productName || record.stockItemName),
      entityName: record.productName || record.stockItemName,
      productId: record.productId,
      productName: record.productName,
      stockItemId: record.stockItemId,
      stockItemName: record.stockItemName,
      branchId: record.branchId,
      branchName: record.branchName,
      categoryId: record.wasteType,
      categoryName: record.wasteReason,
      supplierId: record.supplierId,
      supplierName: record.supplierName,
      sourceModule: 'FireManagement' as const,
      sourceId: record.id,
      sourceNo: record.wasteNo
    }))

  return Array.from(groupEvents(events).values())
    .map(group => {
      const event = firstEvent(group)
      if(!event) return null
      const profile = createProfile(group, input.horizonDays, input.analysisWindowDays, input.reportDate)
      return createPrediction({
        alerts,
        baseRiskScore: profile.growthPercent >= 25 ? 72 : profile.expectedValue > 0 ? 42 : 12,
        event,
        forecastType: 'WASTE',
        profile,
        reportId,
        reportNo,
        expectedWaste: profile.expectedValue,
        recommendation: profile.growthPercent >= 10
          ? `${event.entityName} fire tahmini artiyor; kok neden analizi manuel planlanmali.`
          : `${event.entityName} fire tahmini izleme seviyesinde.`,
        evidence: `Son 30 gun fire ${profile.baseline30} ${event.unit}, buyume ${profile.growthPercent}%.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.riskScore - first.riskScore)
    .slice(0, 10)
}

const createQualityPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const events: MetricEvent[] = QualityFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .map(form => ({
      date: form.inspectionDate || form.createdAt,
      value: form.result === 'FAIL' ? 1 : form.result === 'CONDITIONAL' ? 0.5 : 0.1,
      unit: 'risk',
      entityId: form.productId || form.stockItemId || form.supplierId || normalizeKey(form.productName || form.supplierName || form.formNo),
      entityName: form.productName || form.stockItemName || form.supplierName || form.formNo,
      productId: form.productId,
      productName: form.productName,
      stockItemId: form.stockItemId,
      stockItemName: form.stockItemName,
      branchId: form.branchId,
      branchName: form.branchName,
      supplierId: form.supplierId,
      supplierName: form.supplierName,
      categoryId: form.formType,
      categoryName: form.formType,
      sourceModule: 'QualityForms' as const,
      sourceId: form.id,
      sourceNo: form.formNo
    }))

  return Array.from(groupEvents(events).values())
    .map(group => {
      const event = firstEvent(group)
      if(!event) return null
      const profile = createProfile(group, input.horizonDays, input.analysisWindowDays, input.reportDate)
      return createPrediction({
        alerts,
        baseRiskScore: profile.expectedValue >= 1 ? 70 : profile.growthPercent >= 20 ? 58 : 22,
        event,
        forecastType: 'QUALITY',
        profile,
        reportId,
        reportNo,
        recommendation: profile.expectedValue >= 1
          ? `${event.entityName} icin kalite risk kontrolleri ve numune plani manuel siklastirilmali.`
          : `${event.entityName} kalite tahmini izlenmeli.`,
        evidence: `Beklenen kalite risk adedi ${roundKpi(profile.expectedValue)}, confidence ${profile.confidenceScore}.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.riskScore - first.riskScore)
    .slice(0, 10)
}

const createShipmentPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const formEvents: MetricEvent[] = ShipmentFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .flatMap(form => form.items.map(item => ({
      date: form.deliveryDate || form.loadingDate,
      value: item.quantity,
      unit: item.unit,
      entityId: item.productId || item.stockItemId || form.customerId || normalizeKey(item.productName || item.stockItemName || form.customerName),
      entityName: item.productName || item.stockItemName || form.customerName,
      productId: item.productId,
      productName: item.productName,
      stockItemId: item.stockItemId,
      stockItemName: item.stockItemName,
      branchId: form.branchId,
      branchName: form.branchName,
      sourceModule: 'ShipmentForms' as const,
      sourceId: form.id,
      sourceNo: form.formNo
    })))
  const shipmentEvents: MetricEvent[] = input.sourceData.shipments.flatMap(shipment => shipment.items.map(item => {
    const stockItem = getStockItem(input.sourceData, item.stockItemId)
    return {
      date: shipment.shipmentDate || shipment.createdAt,
      value: item.quantity,
      unit: item.unit,
      entityId: item.stockItemId || shipment.destinationBranchId,
      entityName: stockItem?.name || shipment.shipmentNo,
      stockItemId: item.stockItemId,
      stockItemName: stockItem?.name || '',
      branchId: shipment.destinationBranchId,
      branchName: getBranchName(input.sourceData, shipment.destinationBranchId),
      sourceModule: 'ReadModel' as const,
      sourceId: shipment.id,
      sourceNo: shipment.shipmentNo
    }
  }))

  return Array.from(groupEvents([...formEvents, ...shipmentEvents]).values())
    .map(group => {
      const event = firstEvent(group)
      if(!event) return null
      const profile = createProfile(group, input.horizonDays, input.analysisWindowDays, input.reportDate)
      return createPrediction({
        alerts,
        baseRiskScore: profile.growthPercent >= 25 ? 66 : profile.seasonalityScore >= 30 ? 58 : 24,
        event,
        forecastType: 'SHIPMENT',
        profile,
        reportId,
        reportNo,
        expectedShipment: profile.expectedValue,
        recommendation: profile.trendDirection === 'UP' || profile.trendDirection === 'SEASONAL'
          ? `${event.entityName} sevkiyat hacmi artabilir; arac ve yukleme kapasitesi manuel kontrol edilmeli.`
          : `${event.entityName} sevkiyat tahmini standart seviyede.`,
        evidence: `Beklenen sevkiyat ${profile.expectedValue} ${event.unit}, mevsimsellik ${profile.seasonalityScore}%.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.expectedShipment - first.expectedShipment)
    .slice(0, 10)
}

const createPurchasingPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const events: MetricEvent[] = input.sourceData.purchaseOrders
    .filter(order => order.status !== 'CANCELLED')
    .map(order => ({
      date: order.orderDate || order.createdAt,
      value: order.grandTotal,
      unit: order.currency,
      entityId: order.supplierId,
      entityName: getSupplierName(input.sourceData, order.supplierId),
      supplierId: order.supplierId,
      supplierName: getSupplierName(input.sourceData, order.supplierId),
      sourceModule: 'PurchaseOrders' as const,
      sourceId: order.id,
      sourceNo: order.orderNo
    }))

  return Array.from(groupEvents(events).values())
    .map(group => {
      const event = firstEvent(group)
      if(!event) return null
      const profile = createProfile(group, input.horizonDays, input.analysisWindowDays, input.reportDate)
      const stockAlertBoost = alerts.some(alert => alert.category === 'STOCK' && alert.status === 'ACTIVE') ? 16 : 0
      return createPrediction({
        alerts,
        baseRiskScore: profile.growthPercent >= 20 ? 56 + stockAlertBoost : 26 + stockAlertBoost,
        event,
        forecastType: 'PURCHASING',
        profile,
        reportId,
        reportNo,
        recommendation: stockAlertBoost > 0 || profile.growthPercent >= 15
          ? `${event.entityName} siparis periyodu erkene cekilmeli veya alternatif supplier manuel incelenmeli.`
          : `${event.entityName} satin alma tahmini mevcut akisla izlenebilir.`,
        evidence: `Beklenen satin alma degeri ${roundKpi(profile.expectedValue)} ${event.unit}, kritik stok boost ${stockAlertBoost}.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.riskScore - first.riskScore)
    .slice(0, 8)
}

const createPersonnelPredictions = (
  input: ForecastCalculationInput,
  reportId: string,
  reportNo: string,
  alerts: CriticalAlert[]
) => {
  const workforcePlans = WorkforcePlanningService.list(input.sourceData).filter(plan => plan.status !== 'CANCELLED')
  const bottleneckReports = BottleneckAnalysisService.list(input.sourceData).filter(report => report.status !== 'CANCELLED')
  const improvementReports = ContinuousImprovementService.list(input.sourceData).filter(report => report.status !== 'CANCELLED')
  const machineSchedules = MachineSchedulingService.list(input.sourceData).filter(schedule => schedule.status !== 'CANCELLED')
  const events: MetricEvent[] = workforcePlans.flatMap(plan => plan.shiftAssignments.map(assignment => ({
    date: assignment.workDate || plan.planDate,
    value: assignment.assignedEmployees + assignment.missingEmployeeCount,
    unit: 'personel',
    entityId: `${plan.productionLineId || assignment.shiftName}_${assignment.shiftName}`,
    entityName: plan.productionLineName || assignment.shiftName,
    branchId: '',
    branchName: '',
    productionLineId: plan.productionLineId,
    productionLineName: plan.productionLineName,
    employeeId: plan.employeeId,
    employeeName: plan.employeeName,
    categoryId: plan.department,
    categoryName: plan.department,
    sourceModule: 'WorkforcePlanning' as const,
    sourceId: plan.id,
    sourceNo: plan.planNo
  })))
  const missingPersonnel = sumBy(workforcePlans.flatMap(plan => plan.shiftAssignments), assignment => assignment.missingEmployeeCount)
  const personnelBottleneckBoost = bottleneckReports.flatMap(report => report.items).filter(item => item.bottleneckType === 'PERSONNEL').length * 5
  const improvementBoost = improvementReports.flatMap(report => report.opportunities).filter(opportunity => opportunity.area === 'PERSONNEL' || opportunity.area === 'SHIFT').length * 3
  const scheduleWorkingMinutes = sumBy(machineSchedules.flatMap(schedule => schedule.queues), queue => queue.totalWorkingMinutes)

  return Array.from(groupEvents(events).values())
    .map(group => {
      const event = firstEvent(group)
      if(!event) return null
      const profile = createProfile(group, input.horizonDays, input.analysisWindowDays, input.reportDate, 1)
      const expectedPersonnelNeed = Math.ceil(profile.expectedValue)
      return createPrediction({
        alerts,
        baseRiskScore: clamp(24 + missingPersonnel * 8 + personnelBottleneckBoost + improvementBoost, 0, 88),
        event,
        forecastType: 'PERSONNEL',
        profile,
        reportId,
        reportNo,
        expectedPersonnelNeed,
        recommendation: missingPersonnel > 0 || personnelBottleneckBoost > 0
          ? `${event.entityName} icin vardiya/personel ihtiyaci manuel gozden gecirilmeli.`
          : `${event.entityName} personel tahmini mevcut dagilimla izlenebilir.`,
        evidence: `Beklenen ihtiyac ${expectedPersonnelNeed}, eksik personel ${missingPersonnel}, makine calisma ${roundKpi(scheduleWorkingMinutes)} dk.`
      })
    })
    .filter((prediction): prediction is ForecastPrediction => Boolean(prediction))
    .sort((first, second) => second.riskScore - first.riskScore)
    .slice(0, 8)
}

const createForecastScenarios = (
  reportId: string,
  predictions: ForecastPrediction[]
): ForecastScenario[] => {
  const criticalCount = predictions.filter(prediction => prediction.riskLevel === 'CRITICAL').length
  const highCount = predictions.filter(prediction => prediction.riskLevel === 'HIGH').length
  const riskLevel: ForecastRiskLevel = criticalCount > 0 ? 'CRITICAL' : highCount > 2 ? 'HIGH' : 'MEDIUM'

  return [
    {
      id: `${reportId}_scenario_base`,
      reportId,
      name: 'Baz Tahmin',
      description: 'Gecmis trend, mevsimsellik ve kritik alarm etkisi ile standart tahmin.',
      demandMultiplier: 1,
      wasteMultiplier: 1,
      qualityRiskMultiplier: 1,
      capacityMultiplier: 1,
      expectedImpact: 'Mevcut read-model verisiyle operasyonel gorunurluk saglar.',
      riskLevel
    },
    {
      id: `${reportId}_scenario_demand_plus`,
      reportId,
      name: 'Talep +10',
      description: 'Talep ve sevkiyat hacminin %10 artmasi varsayimi.',
      demandMultiplier: 1.1,
      wasteMultiplier: 1.03,
      qualityRiskMultiplier: 1.02,
      capacityMultiplier: 1.08,
      expectedImpact: 'Uretim, stok ve personel ihtiyacini manuel senaryo olarak gorunur kilar.',
      riskLevel: highCount > 0 ? 'HIGH' : 'MEDIUM'
    },
    {
      id: `${reportId}_scenario_risk`,
      reportId,
      name: 'Riskli Operasyon',
      description: 'Kritik alarm, fire ve kalite riskinin ayni anda arttigi senaryo.',
      demandMultiplier: 1,
      wasteMultiplier: 1.08,
      qualityRiskMultiplier: 1.12,
      capacityMultiplier: 0.94,
      expectedImpact: 'Riskli tahminlerin yonetim tarafindan erken incelenmesini saglar.',
      riskLevel
    }
  ]
}

export const calculateForecastReport = (
  input: ForecastCalculationInput
): ForecastReport => {
  const reportNo = input.getReportNo()
  const reportId = `forecast_report_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const reportDate = input.reportDate || getTodayKey()
  const startDate = addDays(reportDate, 1)
  const endDate = addDays(reportDate, Math.max(1, input.horizonDays))
  const alerts = CriticalAlertService.evaluate(input.sourceData)
  const predictions = [
    ...createStockPredictions(input, reportId, reportNo, alerts),
    ...createDemandPredictions(input, reportId, reportNo, alerts),
    ...createProductionPredictions(input, reportId, reportNo, alerts),
    ...createShipmentPredictions(input, reportId, reportNo, alerts),
    ...createWastePredictions(input, reportId, reportNo, alerts),
    ...createQualityPredictions(input, reportId, reportNo, alerts),
    ...createPurchasingPredictions(input, reportId, reportNo, alerts),
    ...createPersonnelPredictions(input, reportId, reportNo, alerts)
  ].sort((first, second) => (
    second.riskScore - first.riskScore
    || second.expectedValue - first.expectedValue
    || first.entityName.localeCompare(second.entityName, 'tr-TR')
  ))
  const now = new Date().toISOString()
  const scenarios = createForecastScenarios(reportId, predictions)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate,
    startDate,
    endDate,
    horizonDays: Math.max(1, input.horizonDays),
    analysisWindowDays: Math.max(7, input.analysisWindowDays),
    scenarioName: input.scenarioName || 'Baz Tahmin',
    responsiblePerson: input.responsiblePerson,
    description: input.description,
    predictions,
    scenarios,
    history: [
      createForecastHistory(reportId, 'CREATED', input.actorName, `${reportNo} Forecasting Engine read-model raporu olusturuldu.`),
      createForecastHistory(reportId, 'CALCULATED', input.actorName, `${predictions.length} tahmin satiri hesaplandi.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'forecasting-engine',
    revisionNo: 1,
    createdBy: input.actorName,
    createdAt: now,
    updatedAt: now
  }
}

export const ForecastCalculationService = {
  calculate: calculateForecastReport
}
