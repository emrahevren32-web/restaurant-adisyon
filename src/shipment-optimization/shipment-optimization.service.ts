import type { KpiSourceData, BarChartRow } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  averageBy,
  createTrend,
  formatCurrency,
  formatNumber,
  formatPercent,
  getDateKey,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  getDecisionIndexedRecord,
  setDecisionIndexedRecord
} from '../read-model/decision-indexed-storage.service'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type {
  ShipmentOptimizationAlternative,
  ShipmentOptimizationFilters,
  ShipmentOptimizationHistory,
  ShipmentOptimizationHistoryAction,
  ShipmentOptimizationItem,
  ShipmentOptimizationPriority,
  ShipmentOptimizationReport,
  ShipmentOptimizationReportCreateInput,
  ShipmentOptimizationRisk,
  ShipmentOptimizationStatus,
  ShipmentOptimizationStatistics,
  ShipmentOptimizationType
} from './shipment-optimization.types'

export const SHIPMENT_OPTIMIZATION_STORAGE_KEY = 'decision_shipment_optimization_reports'

export const SHIPMENT_OPTIMIZATION_TYPES: ShipmentOptimizationType[] = [
  'ADVANCE_SHIPMENT',
  'POSTPONE_SHIPMENT',
  'CHANGE_VEHICLE',
  'COMBINE_VEHICLES',
  'OPTIMIZE_ROUTE',
  'CHANGE_DELIVERY_SEQUENCE',
  'INCREASE_VEHICLE_OCCUPANCY',
  'PRIORITIZE_COLD_CHAIN',
  'GROUP_SAME_REGION',
  'SUGGEST_EXTRA_VEHICLE',
  'REDUCE_FUEL_COST',
  'NO_SHIPMENT_RISK'
]

export const SHIPMENT_OPTIMIZATION_TYPE_LABELS: Record<ShipmentOptimizationType, string> = {
  ADVANCE_SHIPMENT: 'Sevkiyatı Öne Al',
  POSTPONE_SHIPMENT: 'Sevkiyatı Ertele',
  CHANGE_VEHICLE: 'Araç Değiştir',
  COMBINE_VEHICLES: 'Araçları Birleştir',
  OPTIMIZE_ROUTE: 'Rotayı Optimize Et',
  CHANGE_DELIVERY_SEQUENCE: 'Teslimat Sırasını Değiştir',
  INCREASE_VEHICLE_OCCUPANCY: 'Araç Doluluğunu Artır',
  PRIORITIZE_COLD_CHAIN: 'Soğuk Zincir Önceliği Ver',
  GROUP_SAME_REGION: 'Aynı Bölge Teslimatlarını Grupla',
  SUGGEST_EXTRA_VEHICLE: 'Ek Araç Öner',
  REDUCE_FUEL_COST: 'Yakıt Maliyetini Azalt',
  NO_SHIPMENT_RISK: 'Sevkiyat Riski Bulunmuyor'
}

export const SHIPMENT_OPTIMIZATION_RISKS: ShipmentOptimizationRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export const SHIPMENT_OPTIMIZATION_RISK_LABELS: Record<ShipmentOptimizationRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const SHIPMENT_OPTIMIZATION_PRIORITIES: ShipmentOptimizationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

export const SHIPMENT_OPTIMIZATION_PRIORITY_LABELS: Record<ShipmentOptimizationPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const SHIPMENT_OPTIMIZATION_STATUS_LABELS: Record<ShipmentOptimizationReport['status'], string> = {
  GENERATED: 'Oluşturuldu',
  REVIEWED: 'İncelendi',
  ARCHIVED: 'Arşivlendi'
}

type RawReport = Partial<ShipmentOptimizationReport> & Record<string, unknown>
type RawItem = Partial<ShipmentOptimizationItem> & Record<string, unknown>
type RawHistory = Partial<ShipmentOptimizationHistory> & Record<string, unknown>
type Scenario = {
  type: ShipmentOptimizationType
  fuelSavingScenario: boolean
  vehicleOccupancyScenario: boolean
  coldChainScenario: boolean
}
type ShipmentOptimizationContext = {
  plan: ShipmentPlanRecord | null
  shipment: ShipmentRecord | null
  vehicle: ShipmentVehicleRecord
  branchId: string
  branchName: string
  deliveryRegion: string
  plannedDepartureAt: string
  plannedArrivalAt: string
  stopCount: number
  utilizationPercent: number
  trafficDurationMinutes: number
  routeDistanceKm: number
  fuelPrice: number
  coldChainRequired: boolean
  shipmentPriority: string
}

const SEED_RECOMMENDATION_COUNT = 150
const REPORT_NO_PREFIX = 'SO'
const REPORT_NO_PADDING = 6
const REGION_FALLBACKS = [
  'İstanbul Avrupa',
  'İstanbul Anadolu',
  'Gebze Organize',
  'Kocaeli Körfez',
  'Bursa Merkez',
  'Tekirdağ Çorlu',
  'Sakarya Kuzey',
  'Ankara Batı'
]
const DRIVER_FALLBACKS = ['Selin Acar', 'Mert Öztürk', 'Nesrin Koç', 'Kerem Yıldız', 'Ahmet Kaya', 'Deniz Uslu']
const COLD_CHAIN_KEYWORDS = ['süt', 'yoğurt', 'ayran', 'et', 'tavuk', 'balık', 'donuk', 'soğuk', 'şarküteri']

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined'
  && typeof indexedDB !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const normalizeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value: number, min = 0, max = 100) => (
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
)

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const parseSafeDate = (value: unknown, fallback = getTodayKey()) => {
  const text = normalizeText(value)
  const fallbackText = normalizeText(fallback) || getTodayKey()
  const candidate = text
    ? new Date(text.includes('T') ? text : `${text}T00:00:00`)
    : new Date(`${fallbackText.slice(0, 10)}T00:00:00`)

  if(!Number.isNaN(candidate.getTime())) return candidate

  const fallbackDate = new Date(fallbackText.includes('T') ? fallbackText : `${fallbackText.slice(0, 10)}T00:00:00`)
  return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate
}

const toDateKey = (value: unknown, fallback = getTodayKey()) => getDateKey(parseSafeDate(value, fallback)) || getTodayKey()

const toDateTimeIso = (value: unknown, fallback = getTodayKey()) => parseSafeDate(value, fallback).toISOString()

const createDateTime = (dateKey: string, timeValue: string, fallbackTime = '08:00') => {
  const time = /^\d{2}:\d{2}/.test(timeValue) ? timeValue.slice(0, 5) : fallbackTime
  return parseSafeDate(`${toDateKey(dateKey)}T${time}:00`).toISOString()
}

const addMinutes = (value: string, minutes: number) => {
  const date = parseSafeDate(value)
  date.setMinutes(date.getMinutes() + Math.round(normalizeNumber(minutes)))
  return date.toISOString()
}

const minuteOfDay = (timeValue: string) => {
  const [hourValue, minuteValue] = normalizeText(timeValue).split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0
}

const diffTimeMinutes = (startTime: string, endTime: string, fallback = 180) => {
  const start = minuteOfDay(startTime)
  const end = minuteOfDay(endTime)
  const diff = end >= start ? end - start : end + 1440 - start
  return diff > 0 ? diff : fallback
}

const createHistory = (
  reportId: string,
  action: ShipmentOptimizationHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ShipmentOptimizationHistory => ({
  id: `${reportId}_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

const appendHistory = (
  report: ShipmentOptimizationReport,
  action: ShipmentOptimizationHistoryAction,
  actorName: string,
  description: string
): ShipmentOptimizationReport => {
  const revisionNo = report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

const mapType = (value: unknown): ShipmentOptimizationType => {
  const normalized = normalizeText(value).toUpperCase() as ShipmentOptimizationType
  return SHIPMENT_OPTIMIZATION_TYPES.includes(normalized) ? normalized : 'OPTIMIZE_ROUTE'
}

const mapRisk = (value: unknown): ShipmentOptimizationRisk => {
  const normalized = normalizeText(value).toUpperCase() as ShipmentOptimizationRisk
  return SHIPMENT_OPTIMIZATION_RISKS.includes(normalized) ? normalized : 'LOW'
}

const mapPriority = (value: unknown): ShipmentOptimizationPriority => {
  const normalized = normalizeText(value).toUpperCase() as ShipmentOptimizationPriority
  return SHIPMENT_OPTIMIZATION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const getPriorityFromRisk = (
  risk: ShipmentOptimizationRisk,
  type: ShipmentOptimizationType
): ShipmentOptimizationPriority => {
  if(risk === 'CRITICAL') return 'URGENT'
  if(risk === 'HIGH' || type === 'SUGGEST_EXTRA_VEHICLE') return 'HIGH'
  if(risk === 'MEDIUM') return 'NORMAL'
  return 'LOW'
}

const getRiskFromScore = (score: number): ShipmentOptimizationRisk => {
  if(score >= 82) return 'CRITICAL'
  if(score >= 62) return 'HIGH'
  if(score >= 38) return 'MEDIUM'
  return 'LOW'
}

const normalizeAlternative = (
  value: unknown,
  index: number,
  prefix = 'alternative'
): ShipmentOptimizationAlternative => {
  const record = isRecord(value) ? value : {}
  return {
    id: normalizeText(record.id) || `${prefix}_${index + 1}`,
    no: normalizeText(record.no),
    name: normalizeText(record.name) || normalizeText(record.no) || 'Alternatif',
    detail: normalizeText(record.detail),
    expectedUtilizationPercent: normalizeNumber(record.expectedUtilizationPercent),
    expectedTimeGainMinutes: normalizeNumber(record.expectedTimeGainMinutes),
    expectedFuelSavingLiters: normalizeNumber(record.expectedFuelSavingLiters)
  }
}

const normalizeAlternatives = (
  value: unknown,
  prefix = 'alternative'
) => {
  if(!Array.isArray(value)) return []
  const seen = new Map<string, number>()

  return value.map((record, index) => normalizeAlternative(record, index, prefix)).map(alternative => {
    const count = seen.get(alternative.id) || 0
    seen.set(alternative.id, count + 1)
    return count === 0 ? alternative : { ...alternative, id: `${alternative.id}_${count + 1}` }
  })
}

const normalizeLinkedEntities = (
  value: unknown
) => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((record, index) => ({
    id: normalizeText(record.id) || `linked_${index + 1}`,
    no: normalizeText(record.no),
    name: normalizeText(record.name) || normalizeText(record.no) || 'Bağlı kayıt',
    detail: normalizeText(record.detail)
  }))
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): ShipmentOptimizationHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((record, index) => ({
    id: normalizeText(record.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(record.action).toUpperCase() as ShipmentOptimizationHistoryAction,
    actorName: normalizeText(record.actorName) || actorName,
    description: normalizeText(record.description) || 'Sevkiyat optimizasyon raporu güncellendi.',
    revisionNo: normalizeNumber(record.revisionNo, 1),
    createdAt: toDateTimeIso(record.createdAt)
  }))
}

const normalizeItem = (
  value: RawItem,
  reportId: string,
  reportNo: string,
  index: number
): ShipmentOptimizationItem => ({
  id: normalizeText(value.id) || `${reportId}_item_${index + 1}`,
  reportId,
  reportNo,
  recommendationNo: normalizeText(value.recommendationNo) || `${reportNo}-${String(index + 1).padStart(3, '0')}`,
  recommendationType: mapType(value.recommendationType),
  shipmentPlanId: normalizeText(value.shipmentPlanId),
  shipmentPlanNo: normalizeText(value.shipmentPlanNo),
  shipmentId: normalizeText(value.shipmentId),
  shipmentNo: normalizeText(value.shipmentNo),
  vehicleId: normalizeText(value.vehicleId),
  vehicleNo: normalizeText(value.vehicleNo),
  vehiclePlate: normalizeText(value.vehiclePlate),
  vehicleName: normalizeText(value.vehicleName),
  vehicleType: normalizeText(value.vehicleType),
  driverName: normalizeText(value.driverName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  deliveryRegion: normalizeText(value.deliveryRegion),
  plannedDepartureAt: toDateTimeIso(value.plannedDepartureAt),
  plannedArrivalAt: toDateTimeIso(value.plannedArrivalAt, value.plannedDepartureAt),
  stopCount: Math.max(0, normalizeNumber(value.stopCount)),
  currentVehicleUtilizationPercent: normalizeNumber(value.currentVehicleUtilizationPercent),
  targetVehicleUtilizationPercent: normalizeNumber(value.targetVehicleUtilizationPercent),
  trafficDurationMinutes: normalizeNumber(value.trafficDurationMinutes),
  coldChainRequired: value.coldChainRequired === true,
  fuelSavingScenario: value.fuelSavingScenario === true,
  vehicleOccupancyScenario: value.vehicleOccupancyScenario === true,
  coldChainScenario: value.coldChainScenario === true,
  risk: mapRisk(value.risk),
  priority: mapPriority(value.priority),
  riskScore: normalizeNumber(value.riskScore),
  confidenceScore: normalizeNumber(value.confidenceScore),
  expectedTimeGainMinutes: normalizeNumber(value.expectedTimeGainMinutes),
  expectedFuelSavingLiters: normalizeNumber(value.expectedFuelSavingLiters),
  expectedCostSaving: Math.max(0, normalizeNumber(value.expectedCostSaving)),
  expectedSavingSummary: normalizeText(value.expectedSavingSummary),
  reason: normalizeText(value.reason),
  analysisResult: normalizeText(value.analysisResult),
  riskExplanation: normalizeText(value.riskExplanation),
  recommendedAction: normalizeText(value.recommendedAction),
  affectedShipments: normalizeLinkedEntities(value.affectedShipments),
  alternativeVehicles: normalizeAlternatives(value.alternativeVehicles, 'vehicle'),
  alternativeDeliveryPlan: normalizeAlternatives(value.alternativeDeliveryPlan, 'delivery_plan'),
  sourceModules: Array.isArray(value.sourceModules)
    ? value.sourceModules.map(normalizeText).filter(Boolean)
    : [],
  createdAt: toDateTimeIso(value.createdAt)
})

const normalizeReport = (
  value: RawReport,
  index: number
): ShipmentOptimizationReport => {
  const reportDate = toDateKey(value.reportDate)
  const reportNo = normalizeText(value.reportNo) || getNextShipmentOptimizationNo([], reportDate, index)
  const id = normalizeText(value.id) || `shipment_optimization_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const actorName = normalizeText(value.responsiblePerson) || 'Sevkiyat Optimizasyon Motoru'
  const createdAt = toDateTimeIso(value.createdAt)
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawItem, id, reportNo, itemIndex))
    : []
  const history = normalizeHistory(value.history, id, actorName)
  const scopeText = normalizeText(value.scope)

  return {
    id,
    reportNo,
    status: normalizeText(value.status) === 'REVIEWED' || normalizeText(value.status) === 'ARCHIVED'
      ? normalizeText(value.status) as ShipmentOptimizationStatus
      : 'GENERATED',
    reportDate,
    scope: scopeText === ALL_FILTER || scopeText === '' ? 'all' : mapType(scopeText),
    responsiblePerson: actorName,
    description: normalizeText(value.description),
    items,
    history: history.length > 0
      ? history
      : [createHistory(id, 'CREATED', actorName, `${reportNo} sevkiyat optimizasyon raporu oluşturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'shipment-optimization-engine',
    revisionNo: normalizeNumber(value.revisionNo, 1),
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: toDateTimeIso(value.updatedAt, createdAt)
  }
}

const getBranchName = (
  sourceData: KpiSourceData,
  branchId: string,
  fallback = 'Merkez Şube'
) => sourceData.branches.find(branch => branch.id === branchId)?.name || fallback

const getBranchRegion = (
  sourceData: KpiSourceData,
  branchId: string,
  index: number
) => {
  const branch = sourceData.branches.find(item => item.id === branchId)
  return [branch?.city, branch?.district].filter(Boolean).join(' / ') || REGION_FALLBACKS[index % REGION_FALLBACKS.length]
}

const createFallbackVehicle = (index = 0): ShipmentVehicleRecord => ({
  id: `shipment_vehicle_fallback_${index + 1}`,
  vehicleNo: `VH-${String(index + 1).padStart(6, '0')}`,
  plateNumber: `34 RC ${String(index + 1).padStart(3, '0')}`,
  vehicleName: ['Soğutmalı Kamyon', 'Dağıtım Van', 'Paletli Kamyon'][index % 3],
  vehicleType: index % 3 === 0 ? 'REFRIGERATED' : index % 3 === 1 ? 'VAN' : 'TRUCK',
  maxWeight: [2200, 950, 3200][index % 3],
  currentWeight: [1520, 520, 2100][index % 3],
  status: 'READY',
  driverName: DRIVER_FALLBACKS[index % DRIVER_FALLBACKS.length],
  notes: 'Sevkiyat optimizasyon seed aracı.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  loads: []
})

const getVehicleUtilization = (
  vehicle: ShipmentVehicleRecord
) => percent(vehicle.currentWeight, vehicle.maxWeight)

const findShipmentForPlan = (
  sourceData: KpiSourceData,
  plan: ShipmentPlanRecord | null,
  index: number
) => {
  const branchIds = new Set((plan?.stops || []).map(stop => stop.branchId).filter(Boolean))
  return sourceData.shipments.find(shipment => branchIds.has(shipment.destinationBranchId))
    || sourceData.shipments[index % Math.max(1, sourceData.shipments.length)]
    || null
}

const getColdChainRequired = (
  sourceData: KpiSourceData,
  shipment: ShipmentRecord | null,
  vehicle: ShipmentVehicleRecord,
  index: number
) => {
  if(vehicle.vehicleType === 'REFRIGERATED') return true
  const stockItemMap = new Map(sourceData.stockItems.map(item => [item.id, item.name]))
  const lotMap = new Map(sourceData.inventoryLots.map(lot => [lot.id, lot]))
  const itemNames = (shipment?.items || []).map(item => (
    stockItemMap.get(item.stockItemId)
    || stockItemMap.get(lotMap.get(item.inventoryLotId)?.stockItemId || '')
    || item.notes
  ))
  const search = normalizeSearchText(itemNames.join(' '))
  return COLD_CHAIN_KEYWORDS.some(keyword => search.includes(normalizeSearchText(keyword))) || index % 5 === 0
}

const getFuelRate = (
  vehicleType: string
) => {
  if(vehicleType === 'VAN') return 0.16
  if(vehicleType === 'REFRIGERATED') return 0.28
  if(vehicleType === 'SEMI_TRAILER') return 0.42
  return 0.31
}

const createContexts = (
  sourceData: KpiSourceData
): ShipmentOptimizationContext[] => {
  const vehicles = sourceData.shipmentVehicles.length > 0
    ? sourceData.shipmentVehicles
    : Array.from({ length: 6 }, (_, index) => createFallbackVehicle(index))
  const plans = sourceData.shipmentPlans.length > 0 ? sourceData.shipmentPlans : []
  const source = plans.length > 0
    ? plans
    : vehicles.map((vehicle, index): ShipmentPlanRecord => ({
      id: `shipment_plan_fallback_${index + 1}`,
      shipmentPlanNo: `SP-${String(index + 1).padStart(6, '0')}`,
      vehicleId: vehicle.id,
      planDate: getTodayKey(),
      plannedDepartureTime: `${String(7 + index % 6).padStart(2, '0')}:30`,
      plannedArrivalTime: `${String(10 + index % 6).padStart(2, '0')}:20`,
      plannedReturnTime: `${String(14 + index % 6).padStart(2, '0')}:00`,
      status: 'PLANNED',
      driverName: vehicle.driverName,
      notes: 'Sevkiyat optimizasyon seed planı.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stops: []
    }))

  return source.map((plan, index) => {
    const vehicle = vehicles.find(record => record.id === plan.vehicleId) || vehicles[index % vehicles.length] || createFallbackVehicle(index)
    const shipment = findShipmentForPlan(sourceData, plan, index)
    const stop = plan.stops[0]
    const branchId = stop?.branchId || shipment?.destinationBranchId || sourceData.branches[index % Math.max(1, sourceData.branches.length)]?.id || ''
    const stopCount = Math.max(1, plan.stops.length || 2 + index % 5)
    const planDate = toDateKey(plan.planDate)
    const plannedDepartureAt = createDateTime(planDate, plan.plannedDepartureTime, '08:00')
    const plannedArrivalAt = createDateTime(planDate, plan.plannedArrivalTime, '11:00')
    const travelWindowMinutes = diffTimeMinutes(plan.plannedDepartureTime, plan.plannedArrivalTime, 150)
    const utilizationPercent = getVehicleUtilization(vehicle)
    const routeDistanceKm = roundKpi(18 + stopCount * 14 + (index % 9) * 5 + Math.max(0, travelWindowMinutes - 120) * 0.18)
    const trafficDurationMinutes = roundKpi(18 + stopCount * 8 + (index % 6) * 9 + (plan.status === 'IN_PROGRESS' ? 14 : 0))

    return {
      plan,
      shipment,
      vehicle,
      branchId,
      branchName: getBranchName(sourceData, branchId, getBranchRegion(sourceData, branchId, index)),
      deliveryRegion: getBranchRegion(sourceData, branchId, index),
      plannedDepartureAt,
      plannedArrivalAt,
      stopCount,
      utilizationPercent,
      trafficDurationMinutes,
      routeDistanceKm,
      fuelPrice: 39 + (index % 6) * 1.7,
      coldChainRequired: getColdChainRequired(sourceData, shipment, vehicle, index),
      shipmentPriority: shipment?.priority || (index % 11 === 0 ? 'URGENT' : index % 4 === 0 ? 'HIGH' : 'NORMAL')
    }
  })
}

const getScenario = (
  index: number
): Scenario => {
  if(index < 30){
    return {
      type: index % 2 === 0 ? 'REDUCE_FUEL_COST' : 'OPTIMIZE_ROUTE',
      fuelSavingScenario: true,
      vehicleOccupancyScenario: false,
      coldChainScenario: false
    }
  }
  if(index < 60){
    return {
      type: index % 2 === 0 ? 'INCREASE_VEHICLE_OCCUPANCY' : 'COMBINE_VEHICLES',
      fuelSavingScenario: false,
      vehicleOccupancyScenario: true,
      coldChainScenario: false
    }
  }
  if(index < 80){
    return {
      type: 'PRIORITIZE_COLD_CHAIN',
      fuelSavingScenario: false,
      vehicleOccupancyScenario: false,
      coldChainScenario: true
    }
  }

  const cycle: ShipmentOptimizationType[] = [
    'ADVANCE_SHIPMENT',
    'POSTPONE_SHIPMENT',
    'CHANGE_VEHICLE',
    'OPTIMIZE_ROUTE',
    'CHANGE_DELIVERY_SEQUENCE',
    'GROUP_SAME_REGION',
    'SUGGEST_EXTRA_VEHICLE',
    'REDUCE_FUEL_COST',
    'NO_SHIPMENT_RISK'
  ]
  const type = cycle[index % cycle.length]

  return {
    type,
    fuelSavingScenario: type === 'REDUCE_FUEL_COST' || type === 'OPTIMIZE_ROUTE',
    vehicleOccupancyScenario: type === 'CHANGE_VEHICLE' || type === 'COMBINE_VEHICLES' || type === 'INCREASE_VEHICLE_OCCUPANCY',
    coldChainScenario: type === 'PRIORITIZE_COLD_CHAIN'
  }
}

const getRiskScore = (
  context: ShipmentOptimizationContext,
  scenario: Scenario,
  index: number
) => {
  if(scenario.type === 'NO_SHIPMENT_RISK') return 18 + index % 12
  const utilizationRisk = context.utilizationPercent >= 95 ? 24 : context.utilizationPercent <= 55 ? 16 : context.utilizationPercent <= 70 ? 10 : 4
  const trafficRisk = context.trafficDurationMinutes >= 72 ? 20 : context.trafficDurationMinutes >= 52 ? 12 : 5
  const coldRisk = context.coldChainRequired && context.vehicle.vehicleType !== 'REFRIGERATED' ? 28 : scenario.coldChainScenario ? 16 : 0
  const priorityRisk = context.shipmentPriority === 'URGENT' ? 18 : context.shipmentPriority === 'HIGH' ? 10 : 0
  const statusRisk = context.plan?.status === 'CANCELLED' ? 26 : context.plan?.status === 'DEPARTED' || context.plan?.status === 'IN_PROGRESS' ? 10 : 0
  return clamp(22 + utilizationRisk + trafficRisk + coldRisk + priorityRisk + statusRisk + index % 9, 0, 98)
}

const getTimeGain = (
  context: ShipmentOptimizationContext,
  scenario: Scenario,
  index: number
) => {
  if(scenario.type === 'NO_SHIPMENT_RISK') return 0
  if(scenario.type === 'CHANGE_DELIVERY_SEQUENCE') return 18 + context.stopCount * 6 + index % 10
  if(scenario.type === 'OPTIMIZE_ROUTE') return 26 + context.stopCount * 5 + index % 14
  if(scenario.type === 'GROUP_SAME_REGION') return 20 + context.stopCount * 4
  if(scenario.type === 'SUGGEST_EXTRA_VEHICLE') return 45 + index % 20
  if(scenario.coldChainScenario) return 14 + index % 12
  return 10 + context.stopCount * 3 + index % 12
}

const getFuelSaving = (
  context: ShipmentOptimizationContext,
  scenario: Scenario,
  timeGainMinutes: number,
  index: number
) => {
  if(scenario.type === 'NO_SHIPMENT_RISK') return 0
  const baseFuel = context.routeDistanceKm * getFuelRate(context.vehicle.vehicleType)
  const routeFactor = scenario.fuelSavingScenario ? 0.16 : scenario.vehicleOccupancyScenario ? 0.11 : 0.06
  const trafficFactor = Math.min(0.08, timeGainMinutes / 900)
  return roundKpi(Math.max(0, baseFuel * (routeFactor + trafficFactor) + (index % 4) * 0.35))
}

const getReasonText = (
  context: ShipmentOptimizationContext,
  scenario: Scenario
) => {
  const base = `${context.plan?.shipmentPlanNo || context.shipment?.shipmentNo || 'Sevkiyat planı'} için ${context.deliveryRegion} bölgesi, ${formatPercent(context.utilizationPercent)} araç doluluğu ve ${formatNumber(context.trafficDurationMinutes, 0)} dk trafik süresi birlikte değerlendirildi.`
  if(scenario.type === 'PRIORITIZE_COLD_CHAIN') return `${base} Soğuk zincir gereksinimi teslimat sırası ve araç tipi riskini artırıyor.`
  if(scenario.type === 'COMBINE_VEHICLES') return `${base} Aynı bölgeye giden düşük doluluklu araç yükleri birleştirilebilir.`
  if(scenario.type === 'REDUCE_FUEL_COST') return `${base} Rota mesafesi ve yakıt maliyeti seed verisi tasarruf fırsatı gösteriyor.`
  if(scenario.type === 'SUGGEST_EXTRA_VEHICLE') return `${base} Zaman penceresi ve kapasite baskısı ek araç senaryosu gerektiriyor.`
  if(scenario.type === 'NO_SHIPMENT_RISK') return `${base} Kritik risk sinyali bulunmadı; plan izleme modunda tutulabilir.`
  return base
}

const getActionText = (
  context: ShipmentOptimizationContext,
  scenario: Scenario
) => {
  if(scenario.type === 'ADVANCE_SHIPMENT') return `${context.shipment?.shipmentNo || context.plan?.shipmentPlanNo || 'Sevkiyat'} yükleme penceresini üretim tamamlanma saatine göre öne çek.`
  if(scenario.type === 'POSTPONE_SHIPMENT') return 'Üretim/depo hazırlığı tamamlanana kadar sevkiyat saatini manuel yeniden değerlendir.'
  if(scenario.type === 'CHANGE_VEHICLE') return 'Daha uygun kapasite ve soğuk zincir profiline sahip alternatif aracı değerlendir.'
  if(scenario.type === 'COMBINE_VEHICLES') return 'Aynı bölge teslimatlarını tek rota altında birleştirme senaryosunu incele.'
  if(scenario.type === 'OPTIMIZE_ROUTE') return 'Teslimat sırası ve trafik süresi seed değerleriyle kısa rota senaryosunu uygula.'
  if(scenario.type === 'CHANGE_DELIVERY_SEQUENCE') return 'Müşteri teslim saatlerine göre durak sırasını manuel optimize et.'
  if(scenario.type === 'INCREASE_VEHICLE_OCCUPANCY') return 'Araç doluluğunu hedef banda taşımak için uygun palet/teslimat ekle.'
  if(scenario.type === 'PRIORITIZE_COLD_CHAIN') return 'Soğuk zincir ürünlerini ilk teslimat penceresine al ve sıcaklık kontrol sıklığını artır.'
  if(scenario.type === 'GROUP_SAME_REGION') return 'Aynı bölgedeki teslimatları tek sevkiyat penceresinde grupla.'
  if(scenario.type === 'SUGGEST_EXTRA_VEHICLE') return 'Kritik teslimat penceresi için ek araç kapasitesi planla.'
  if(scenario.type === 'REDUCE_FUEL_COST') return 'Yakıt maliyeti yüksek rotayı alternatif güzergah ve araç tipiyle karşılaştır.'
  return 'Mevcut sevkiyat planını izlemeye devam et; otomatik değişiklik yapılmayacak.'
}

const createAffectedShipments = (
  sourceData: KpiSourceData,
  context: ShipmentOptimizationContext
) => {
  const related = sourceData.shipments
    .filter(shipment => (
      shipment.id === context.shipment?.id
      || shipment.destinationBranchId === context.branchId
      || shipment.plannedDeliveryDate === context.plan?.planDate
    ))
    .slice(0, 5)

  const rows = related.length > 0 ? related : context.shipment ? [context.shipment] : []
  return rows.map(shipment => ({
    id: shipment.id,
    no: shipment.shipmentNo,
    name: getBranchName(sourceData, shipment.destinationBranchId, context.deliveryRegion),
    detail: `${shipment.priority} öncelik / ${shipment.status} / ${toDateKey(shipment.plannedDeliveryDate)}`
  }))
}

const createAlternativeVehicles = (
  sourceData: KpiSourceData,
  context: ShipmentOptimizationContext,
  timeGain: number,
  fuelSaving: number
): ShipmentOptimizationAlternative[] => {
  const alternatives = sourceData.shipmentVehicles
    .filter(vehicle => vehicle.id !== context.vehicle.id && vehicle.status !== 'MAINTENANCE')
    .sort((first, second) => getVehicleUtilization(first) - getVehicleUtilization(second))
    .slice(0, 4)
    .map((vehicle, index) => ({
      id: vehicle.id,
      no: vehicle.plateNumber || vehicle.vehicleNo,
      name: vehicle.vehicleName || vehicle.vehicleNo,
      detail: `${vehicle.vehicleType} / ${formatPercent(getVehicleUtilization(vehicle))} doluluk / ${vehicle.driverName || 'Şoför atanmalı'}`,
      expectedUtilizationPercent: clamp(Math.max(getVehicleUtilization(vehicle), 70 + index * 4), 0, 98),
      expectedTimeGainMinutes: roundKpi(Math.max(0, timeGain - index * 3)),
      expectedFuelSavingLiters: roundKpi(Math.max(0, fuelSaving - index * 0.8))
    }))

  return alternatives.length > 0
    ? alternatives
    : [context.vehicle].map(vehicle => ({
      id: `${vehicle.id}_current_review`,
      no: vehicle.plateNumber || vehicle.vehicleNo,
      name: `${vehicle.vehicleName || vehicle.vehicleNo} kapasite kontrolü`,
      detail: 'Alternatif araç yok; mevcut araç için yük/rota kontrolü önerilir.',
      expectedUtilizationPercent: clamp(context.utilizationPercent + 8, 0, 98),
      expectedTimeGainMinutes: timeGain,
      expectedFuelSavingLiters: fuelSaving
    }))
}

const createAlternativeDeliveryPlan = (
  context: ShipmentOptimizationContext,
  scenario: Scenario,
  timeGain: number,
  fuelSaving: number
): ShipmentOptimizationAlternative[] => {
  const labels = [
    'Erken teslimat penceresi',
    'Bölge gruplanmış rota',
    'Soğuk zincir öncelikli sıra'
  ]

  return labels.map((label, index) => ({
    id: `${context.plan?.id || context.shipment?.id || 'shipment'}_delivery_plan_${index + 1}`,
    no: `Rota-${index + 1}`,
    name: label,
    detail: `${context.deliveryRegion} / ${scenario.type === 'PRIORITIZE_COLD_CHAIN' ? 'Sıcaklık kontrol önceliği' : 'Trafik seed optimizasyonu'}`,
    expectedUtilizationPercent: clamp(context.utilizationPercent + 6 + index * 3, 0, 98),
    expectedTimeGainMinutes: roundKpi(Math.max(0, timeGain - index * 4)),
    expectedFuelSavingLiters: roundKpi(Math.max(0, fuelSaving - index * 0.5))
  }))
}

const createItem = (
  sourceData: KpiSourceData,
  context: ShipmentOptimizationContext,
  scenario: Scenario,
  reportId: string,
  reportNo: string,
  index: number
): ShipmentOptimizationItem => {
  const timeGain = getTimeGain(context, scenario, index)
  const fuelSaving = getFuelSaving(context, scenario, timeGain, index)
  const costSaving = roundKpi(Math.max(0, fuelSaving * context.fuelPrice + timeGain * 9.5))
  const riskScore = getRiskScore(context, scenario, index)
  const risk = getRiskFromScore(riskScore)
  const priority = getPriorityFromRisk(risk, scenario.type)
  const confidenceScore = roundKpi(clamp(64 + sourceData.shipmentPlans.length * 0.6 + sourceData.shipmentVehicles.length * 0.5 + (scenario.type === 'NO_SHIPMENT_RISK' ? 4 : 0) + index % 11, 55, 98))
  const targetVehicleUtilizationPercent = scenario.vehicleOccupancyScenario
    ? clamp(Math.max(context.utilizationPercent + 18, 82), 0, 98)
    : clamp(Math.max(context.utilizationPercent + 6, 72), 0, 98)
  const shipmentNo = context.shipment?.shipmentNo || context.plan?.shipmentPlanNo || `SHP-DS-${String(index + 1).padStart(4, '0')}`

  return {
    id: `${reportId}_item_${index + 1}`,
    reportId,
    reportNo,
    recommendationNo: `${reportNo}-${String(index + 1).padStart(3, '0')}`,
    recommendationType: scenario.type,
    shipmentPlanId: context.plan?.id || '',
    shipmentPlanNo: context.plan?.shipmentPlanNo || '',
    shipmentId: context.shipment?.id || '',
    shipmentNo,
    vehicleId: context.vehicle.id,
    vehicleNo: context.vehicle.vehicleNo,
    vehiclePlate: context.vehicle.plateNumber,
    vehicleName: context.vehicle.vehicleName || context.vehicle.vehicleNo,
    vehicleType: context.vehicle.vehicleType,
    driverName: context.plan?.driverName || context.vehicle.driverName || DRIVER_FALLBACKS[index % DRIVER_FALLBACKS.length],
    branchId: context.branchId,
    branchName: context.branchName,
    deliveryRegion: context.deliveryRegion,
    plannedDepartureAt: context.plannedDepartureAt,
    plannedArrivalAt: context.plannedArrivalAt,
    stopCount: context.stopCount,
    currentVehicleUtilizationPercent: context.utilizationPercent,
    targetVehicleUtilizationPercent,
    trafficDurationMinutes: context.trafficDurationMinutes,
    coldChainRequired: context.coldChainRequired,
    fuelSavingScenario: scenario.fuelSavingScenario,
    vehicleOccupancyScenario: scenario.vehicleOccupancyScenario,
    coldChainScenario: scenario.coldChainScenario,
    risk,
    priority,
    riskScore,
    confidenceScore,
    expectedTimeGainMinutes: timeGain,
    expectedFuelSavingLiters: fuelSaving,
    expectedCostSaving: costSaving,
    expectedSavingSummary: `${formatNumber(timeGain, 0)} dk / ${formatNumber(fuelSaving, 1)} lt / ${formatCurrency(costSaving)}`,
    reason: getReasonText(context, scenario),
    analysisResult: `${SHIPMENT_OPTIMIZATION_TYPE_LABELS[scenario.type]} önerisi; sevkiyat planı, araç kapasitesi, teslimat rotası, müşteri teslim saati, soğuk zincir, depo ve üretim hazırlık sinyalleri birlikte analiz edilerek üretildi.`,
    riskExplanation: `${SHIPMENT_OPTIMIZATION_RISK_LABELS[risk]} risk; doluluk ${formatPercent(context.utilizationPercent)}, hedef ${formatPercent(targetVehicleUtilizationPercent)}, trafik ${formatNumber(context.trafficDurationMinutes, 0)} dk, soğuk zincir ${context.coldChainRequired ? 'gerekli' : 'standart'}.`,
    recommendedAction: getActionText(context, scenario),
    affectedShipments: createAffectedShipments(sourceData, context),
    alternativeVehicles: createAlternativeVehicles(sourceData, context, timeGain, fuelSaving),
    alternativeDeliveryPlan: createAlternativeDeliveryPlan(context, scenario, timeGain, fuelSaving),
    sourceModules: [
      'ShipmentPlans',
      'ShipmentVehicles',
      'Shipments',
      'ProductionPlanning',
      'WastePrediction',
      'ProductionPlanningRecommendations',
      'KPI',
      'InventoryLots'
    ],
    createdAt: addMinutes(createDateTime(getTodayKey(), '07:00'), index * 9)
  }
}

const getNextShipmentOptimizationNo = (
  reports: Pick<ShipmentOptimizationReport, 'reportNo'>[],
  reportDate = getTodayKey(),
  offset = 0
) => {
  const year = toDateKey(reportDate).slice(0, 4) || String(new Date().getFullYear())
  const pattern = new RegExp(`${REPORT_NO_PREFIX}-${year}-(\\d+)$`)
  const maxNo = reports.reduce((max, report) => {
    const match = report.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${REPORT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(REPORT_NO_PADDING, '0')}`
}

export const createDefaultShipmentOptimizationFilters = (): ShipmentOptimizationFilters => ({
  branchId: ALL_FILTER,
  vehicleId: ALL_FILTER,
  driverName: ALL_FILTER,
  deliveryRegion: ALL_FILTER,
  risk: ALL_FILTER,
  priority: ALL_FILTER,
  recommendationType: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultShipmentOptimizationInput = (
  responsiblePerson = 'Sevkiyat Optimizasyon Motoru'
): ShipmentOptimizationReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: 'Sevkiyat planı, araç kapasitesi, rota ve soğuk zincir karar destek analizi.'
})

export const evaluateShipmentOptimizationReport = (
  sourceData: KpiSourceData,
  input: ShipmentOptimizationReportCreateInput = createDefaultShipmentOptimizationInput(),
  existingReports: ShipmentOptimizationReport[] = [],
  actorName = input.responsiblePerson || 'Sevkiyat Optimizasyon Motoru'
): ShipmentOptimizationReport => {
  const reportDate = toDateKey(input.reportDate)
  const reportNo = getNextShipmentOptimizationNo(existingReports, reportDate)
  const reportId = `shipment_optimization_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const contexts = createContexts(sourceData)
  const sourceContexts = contexts.length > 0 ? contexts : [createContexts({ ...sourceData, shipmentVehicles: [createFallbackVehicle()] })[0]]
  const items = Array.from({ length: SEED_RECOMMENDATION_COUNT }, (_, index) => createItem(
    sourceData,
    sourceContexts[index % sourceContexts.length],
    getScenario(index),
    reportId,
    reportNo,
    index
  )).filter(item => input.scope === ALL_FILTER || input.scope === 'all' || item.recommendationType === input.scope)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate,
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || actorName,
    description: input.description,
    items,
    history: [
      createHistory(reportId, 'CREATED', actorName, `${reportNo} sevkiyat optimizasyon raporu read-model olarak oluşturuldu.`),
      createHistory(reportId, 'CALCULATED', actorName, `${formatNumber(items.length)} sevkiyat optimizasyon önerisi üretildi.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'shipment-optimization-engine',
    revisionNo: 1,
    createdBy: actorName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

const hasSeedCoverage = (
  reports: ShipmentOptimizationReport[]
) => {
  const items = reports.flatMap(report => report.items)
  return items.length >= 150
    && items.filter(item => item.fuelSavingScenario || item.recommendationType === 'REDUCE_FUEL_COST' || item.recommendationType === 'OPTIMIZE_ROUTE').length >= 30
    && items.filter(item => item.vehicleOccupancyScenario || item.recommendationType === 'INCREASE_VEHICLE_OCCUPANCY' || item.recommendationType === 'COMBINE_VEHICLES').length >= 30
    && items.filter(item => item.coldChainScenario || item.recommendationType === 'PRIORITIZE_COLD_CHAIN').length >= 20
}

const ensureSeedCoverage = (
  reports: ShipmentOptimizationReport[],
  sourceData: KpiSourceData
) => {
  if(hasSeedCoverage(reports)) return reports

  const seedReport = evaluateShipmentOptimizationReport(sourceData, {
    reportDate: getTodayKey(),
    scope: 'all',
    responsiblePerson: 'Sevkiyat Optimizasyon Motoru',
    description: 'Faz 34.13.9 seed kapsamı için sevkiyat optimizasyon önerileri üretildi.'
  }, reports, 'Sevkiyat Optimizasyon Motoru')
  const nextReports = [seedReport, ...reports]
    .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))

  saveShipmentOptimizationReports(nextReports)
  return nextReports
}

export const saveShipmentOptimizationReports = (
  reports: ShipmentOptimizationReport[]
) => {
  if(!isBrowserStorageAvailable()) return
  setDecisionIndexedRecord(SHIPMENT_OPTIMIZATION_STORAGE_KEY, reports)
}

export const loadShipmentOptimizationReports = (
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()){
    return [evaluateShipmentOptimizationReport(sourceData)]
  }

  const stored = getDecisionIndexedRecord<RawReport[]>(SHIPMENT_OPTIMIZATION_STORAGE_KEY)
  if(stored === null){
    const defaultReport = evaluateShipmentOptimizationReport(sourceData)
    const reports = ensureSeedCoverage([defaultReport], sourceData)
    saveShipmentOptimizationReports(reports)
    return reports
  }

  try {
    if(Array.isArray(stored)){
      const reports = stored
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      if(reports.length > 0) return ensureSeedCoverage(reports, sourceData)
    }
  } catch {
    // Bozuk yerel sevkiyat optimizasyon cache kaydı taze read-model raporuyla değiştirilir.
  }

  const defaultReport = evaluateShipmentOptimizationReport(sourceData)
  saveShipmentOptimizationReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: ShipmentOptimizationReport[],
  nextReport: ShipmentOptimizationReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addShipmentOptimizationReport = (
  input: ShipmentOptimizationReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadShipmentOptimizationReports(sourceData)
  const report = evaluateShipmentOptimizationReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveShipmentOptimizationReports(nextReports)
  return report
}

export const filterShipmentOptimizationReports = (
  reports: ShipmentOptimizationReport[],
  filters: ShipmentOptimizationFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredItems = report.items.filter(item => {
      const matchesSearch = !search || [
        report.reportNo,
        item.recommendationNo,
        item.shipmentPlanNo,
        item.shipmentNo,
        item.vehicleNo,
        item.vehiclePlate,
        item.vehicleName,
        item.driverName,
        item.branchName,
        item.deliveryRegion,
        item.reason,
        item.analysisResult,
        item.riskExplanation,
        item.recommendedAction
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.vehicleId === ALL_FILTER || item.vehicleId === filters.vehicleId)
        && (filters.driverName === ALL_FILTER || item.driverName === filters.driverName)
        && (filters.deliveryRegion === ALL_FILTER || item.deliveryRegion === filters.deliveryRegion)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (filters.recommendationType === ALL_FILTER || item.recommendationType === filters.recommendationType)
        && (!filters.date || report.reportDate === filters.date || toDateKey(item.createdAt) === filters.date)
    })

    return {
      ...report,
      items: filteredItems
    }
  }).filter(report => report.items.length > 0)
}

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>
): BarChartRow[] => rows
  .filter(row => row.id && row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatNumber(row.value, 1),
    detail: row.detail
  }))

const aggregateCount = (
  items: ShipmentOptimizationItem[],
  getKey: (item: ShipmentOptimizationItem) => string,
  getLabel: (item: ShipmentOptimizationItem) => string,
  detailSuffix = 'öneri'
) => {
  const rows = items.reduce<Map<string, { label: string; count: number; gain: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      count: (previous?.count || 0) + 1,
      gain: roundKpi((previous?.gain || 0) + item.expectedTimeGainMinutes)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} ${detailSuffix} / ${formatNumber(row.gain, 0)} dk`
  })))
}

const aggregateAverage = (
  items: ShipmentOptimizationItem[],
  getKey: (item: ShipmentOptimizationItem) => string,
  getLabel: (item: ShipmentOptimizationItem) => string,
  getValue: (item: ShipmentOptimizationItem) => number,
  formatter: (value: number) => string,
  detailSuffix: string
) => {
  const rows = items.reduce<Map<string, { label: string; total: number; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      total: (previous?.total || 0) + getValue(item),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries()).map(([id, row]) => {
    const average = row.count > 0 ? row.total / row.count : 0
    return {
      id,
      label: row.label,
      value: roundKpi(average),
      formattedValue: formatter(average),
      detail: `${formatNumber(row.count)} kayıt / ${detailSuffix}`
    }
  }).sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR')).slice(0, 8)
}

const aggregateSum = (
  items: ShipmentOptimizationItem[],
  getKey: (item: ShipmentOptimizationItem) => string,
  getLabel: (item: ShipmentOptimizationItem) => string,
  getValue: (item: ShipmentOptimizationItem) => number,
  formatter: (value: number) => string,
  detailSuffix: string
) => {
  const rows = items.reduce<Map<string, { label: string; total: number; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      total: roundKpi((previous?.total || 0) + getValue(item)),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    formattedValue: formatter(row.total),
    detail: `${formatNumber(row.count)} kayıt / ${detailSuffix}`
  })).filter(row => row.value > 0)
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, 8)
}

export const createShipmentOptimizationStatistics = (
  reports: ShipmentOptimizationReport[]
): ShipmentOptimizationStatistics => {
  const items = reports.flatMap(report => report.items)

  return {
    totalRecommendations: items.length,
    criticalShipmentRisks: items.filter(item => item.risk === 'CRITICAL').length,
    expectedFuelSavingLiters: roundKpi(sumBy(items, item => item.expectedFuelSavingLiters)),
    expectedTimeGainMinutes: roundKpi(sumBy(items, item => item.expectedTimeGainMinutes)),
    expectedCostSaving: roundKpi(sumBy(items, item => item.expectedCostSaving)),
    averageVehicleUtilizationPercent: averageBy(items, item => item.currentVehicleUtilizationPercent),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    regionShipmentRows: aggregateCount(items, item => item.deliveryRegion, item => item.deliveryRegion, 'sevkiyat önerisi'),
    vehicleUtilizationRows: aggregateAverage(
      items,
      item => item.vehicleId,
      item => [item.vehiclePlate, item.vehicleName].filter(Boolean).join(' / ') || item.vehicleNo,
      item => item.currentVehicleUtilizationPercent,
      formatPercent,
      'ortalama araç doluluğu'
    ),
    fuelSavingRows: aggregateSum(
      items,
      item => item.deliveryRegion,
      item => item.deliveryRegion,
      item => item.expectedFuelSavingLiters,
      value => `${formatNumber(value, 1)} lt`,
      'yakıt tasarrufu'
    ),
    deliveryTimeRows: aggregateSum(
      items,
      item => item.deliveryRegion,
      item => item.deliveryRegion,
      item => item.expectedTimeGainMinutes,
      value => `${formatNumber(value, 0)} dk`,
      'süre kazancı'
    ),
    riskRows: aggregateCount(items, item => item.risk, item => SHIPMENT_OPTIMIZATION_RISK_LABELS[item.risk], 'risk sinyali'),
    vehicleTypeRows: aggregateCount(items, item => item.vehicleType, item => item.vehicleType, 'araç tipi önerisi'),
    costSavingRows: aggregateSum(
      items,
      item => item.deliveryRegion,
      item => item.deliveryRegion,
      item => item.expectedCostSaving,
      formatCurrency,
      'maliyet tasarrufu'
    ),
    dailyTrend: createTrend(items, 'MONTH', item => item.createdAt, () => 1, 'Günlük Sevkiyat Trendleri', '#0f766e')
  }
}

export const updateShipmentOptimizationReportStatus = (
  reportId: string,
  status: Extract<ShipmentOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadShipmentOptimizationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Sevkiyat optimizasyon raporu bulunamadı.')

  const updatedReport = appendHistory({
    ...report,
    status
  }, status, actorName, `${report.reportNo} ${SHIPMENT_OPTIMIZATION_STATUS_LABELS[status]} durumuna alındı.`)
  const nextReports = reports.map(record => record.id === reportId ? updatedReport : record)
  saveShipmentOptimizationReports(nextReports)
  return updatedReport
}

export const recordShipmentOptimizationOutput = (
  reportId: string,
  action: Extract<ShipmentOptimizationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadShipmentOptimizationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Sevkiyat optimizasyon raporu bulunamadı.')

  const updatedReport = appendHistory(report, action, actorName, `${report.reportNo} ${action} çıktısı alındı.`)
  const nextReports = reports.map(record => record.id === reportId ? updatedReport : record)
  saveShipmentOptimizationReports(nextReports)
  return updatedReport
}

export const ShipmentOptimizationService = {
  add: addShipmentOptimizationReport,
  createDefaultFilters: createDefaultShipmentOptimizationFilters,
  createDefaultInput: createDefaultShipmentOptimizationInput,
  evaluate: evaluateShipmentOptimizationReport,
  filter: filterShipmentOptimizationReports,
  list: loadShipmentOptimizationReports,
  recordOutput: recordShipmentOptimizationOutput,
  statistics: createShipmentOptimizationStatistics,
  updateStatus: updateShipmentOptimizationReportStatus
}
