import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type { MachineCapacity } from '../capacity-planning/capacity-planning.types'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { PurchaseRecommendationService } from '../purchase-recommendations/purchase-recommendation.service'
import { ProductionPlanningRecommendationService } from '../production-planning-recommendations/production-planning-recommendation.service'
import {
  getDecisionIndexedRecord,
  setDecisionIndexedRecord
} from '../read-model/decision-indexed-storage.service'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import type { Branch, StockItem, StockUnit } from '../types'
import { WasteService } from '../waste-management/waste.service'
import {
  WASTE_PREDICTION_PRIORITIES,
  WASTE_PREDICTION_PRIORITY_LABELS,
  WASTE_PREDICTION_RISKS,
  WASTE_PREDICTION_RISK_LABELS,
  WASTE_PREDICTION_STATUSES,
  WASTE_PREDICTION_STATUS_LABELS,
  WASTE_PREDICTION_TYPES,
  WASTE_PREDICTION_TYPE_LABELS
} from './waste-prediction.constants'
import {
  appendWastePredictionHistory,
  createWastePredictionHistory
} from './waste-prediction-history.service'
import { createWastePredictionStatistics } from './waste-prediction-statistics.service'
import type {
  WastePredictionAlternative,
  WastePredictionFilters,
  WastePredictionHistory,
  WastePredictionHistoryAction,
  WastePredictionItem,
  WastePredictionLinkedEntity,
  WastePredictionPriority,
  WastePredictionReport,
  WastePredictionReportCreateInput,
  WastePredictionRisk,
  WastePredictionRule,
  WastePredictionSourceModule,
  WastePredictionStatus,
  WastePredictionType
} from './waste-prediction.types'

export {
  WASTE_PREDICTION_PRIORITIES,
  WASTE_PREDICTION_PRIORITY_LABELS,
  WASTE_PREDICTION_RISKS,
  WASTE_PREDICTION_RISK_LABELS,
  WASTE_PREDICTION_STATUSES,
  WASTE_PREDICTION_STATUS_LABELS,
  WASTE_PREDICTION_TYPES,
  WASTE_PREDICTION_TYPE_LABELS
} from './waste-prediction.constants'

export const WASTE_PREDICTION_STORAGE_KEY = 'ra_waste_prediction_records'

type RawWastePredictionReport = Partial<Record<keyof WastePredictionReport, unknown>> & Record<string, unknown>
type RawWastePredictionItem = Partial<Record<keyof WastePredictionItem, unknown>> & Record<string, unknown>
type RawWastePredictionRule = Partial<Record<keyof WastePredictionRule, unknown>> & Record<string, unknown>

type PredictionContext = {
  sourceNo: string
  workOrderId: string
  workOrderNo: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  recipeFirePercent: number
  branchId: string
  branchName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  lotId: string
  lotNo: string
  supplierId: string
  supplierName: string
  plannedQuantity: number
  unit: string
  unitCost: number
  baseDate: string
  lotExpiryDate: string
  lotDaysToExpiry: number
  haccpCriticalPoint: string
  qualitySignal: string
  historicalWastePercent: number
  supplierPerformanceScore: number
  lineEfficiencyPercent: number
  capacityUtilizationPercent: number
  machineUtilizationPercent: number
}

type ScenarioDefinition = {
  type: WastePredictionType
  criticalWasteScenario: boolean
  lotRiskScenario: boolean
  alternativeRecipeScenario: boolean
  supplierWasteScenario: boolean
}

const REPORT_NO_PREFIX = 'WPR'
const REPORT_NO_PADDING = 6
const SEED_PREDICTION_COUNT = 190

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')
const normalizeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? roundKpi(parsed) : 0
}

const clamp = (
  value: number,
  min = 0,
  max = 100
) => Math.min(max, Math.max(min, value))

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addMinutes = (
  value: string,
  minutes: number
) => {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() + Math.max(1, Math.round(minutes)))
  return date.toISOString()
}

const differenceInDays = (
  firstDate: string,
  secondDate: string
) => {
  if(!firstDate || !secondDate) return 999
  const first = new Date(`${firstDate.slice(0, 10)}T00:00:00`)
  const second = new Date(`${secondDate.slice(0, 10)}T00:00:00`)
  if(Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return 999
  return Math.round((first.getTime() - second.getTime()) / 86400000)
}

const createDateTime = (
  dateValue: string,
  index: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setHours(7 + (index % 10), (index % 4) * 15, 0, 0)
  return date.toISOString()
}

const getNextWastePredictionNo = (
  records: Pick<WastePredictionReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${REPORT_NO_PREFIX}-${year}-(\\d{${REPORT_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${REPORT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(REPORT_NO_PADDING, '0')}`
}

const matchesName = (
  first: string,
  second: string
) => {
  const firstKey = normalizeSearchText(first)
  const secondKey = normalizeSearchText(second)
  return Boolean(firstKey && secondKey && (firstKey.includes(secondKey) || secondKey.includes(firstKey)))
}

const mapType = (value: unknown): WastePredictionType => {
  const normalized = normalizeText(value).toUpperCase() as WastePredictionType
  return WASTE_PREDICTION_TYPES.includes(normalized) ? normalized : 'HIGH_WASTE_RISK'
}

const mapStatus = (value: unknown): WastePredictionStatus => {
  const normalized = normalizeText(value).toUpperCase() as WastePredictionStatus
  return WASTE_PREDICTION_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapPriority = (value: unknown): WastePredictionPriority => {
  const normalized = normalizeText(value).toUpperCase() as WastePredictionPriority
  return WASTE_PREDICTION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const mapRisk = (value: unknown): WastePredictionRisk => {
  const normalized = normalizeText(value).toUpperCase() as WastePredictionRisk
  return WASTE_PREDICTION_RISKS.includes(normalized) ? normalized : 'LOW'
}

export const createDefaultWastePredictionFilters = (): WastePredictionFilters => ({
  branchId: ALL_FILTER,
  productId: ALL_FILTER,
  recipeId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  risk: ALL_FILTER,
  priority: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultWastePredictionReportInput = (
  responsiblePerson = 'Fire Tahmin Motoru'
): WastePredictionReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

const getSourceModuleForType = (
  type: WastePredictionType
): WastePredictionSourceModule => {
  if(type === 'USE_ALTERNATIVE_RECIPE') return 'Recipe'
  if(type === 'PREFER_ALTERNATIVE_SUPPLIER') return 'SupplierPerformance'
  if(type === 'PRODUCE_AFTER_MAINTENANCE') return 'MachineScheduling'
  if(type === 'CHANGE_LINE') return 'CapacityPlanning'
  if(type === 'CHANGE_PERSONNEL') return 'WorkforcePlanning'
  if(type === 'USE_OLDER_LOT_FIRST' || type === 'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS') return 'InventoryLots'
  if(type === 'INCREASE_QUALITY_CONTROL') return 'Quality'
  if(type === 'NO_WASTE_EXPECTED') return 'KPI'
  return 'WasteManagement'
}

const getBaseRiskForType = (
  type: WastePredictionType
): WastePredictionRisk => {
  if(type === 'HIGH_WASTE_RISK' || type === 'REDUCE_PRODUCTION_QUANTITY') return 'CRITICAL'
  if(type === 'USE_ALTERNATIVE_RECIPE' || type === 'PREFER_ALTERNATIVE_SUPPLIER' || type === 'PRODUCE_AFTER_MAINTENANCE') return 'HIGH'
  if(type === 'USE_OLDER_LOT_FIRST' || type === 'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS' || type === 'INCREASE_QUALITY_CONTROL') return 'HIGH'
  if(type === 'SPLIT_PRODUCTION_BATCH' || type === 'CHANGE_LINE' || type === 'CHANGE_PERSONNEL') return 'MEDIUM'
  return 'LOW'
}

const getPriorityFromRisk = (
  risk: WastePredictionRisk
): WastePredictionPriority => {
  if(risk === 'CRITICAL') return 'URGENT'
  if(risk === 'HIGH') return 'HIGH'
  if(risk === 'MEDIUM') return 'NORMAL'
  return 'LOW'
}

const getThresholdLabelForType = (
  type: WastePredictionType
) => {
  if(type === 'HIGH_WASTE_RISK') return 'Beklenen fire %8 üzeri veya kritik kalite/HACCP sinyali'
  if(type === 'USE_OLDER_LOT_FIRST') return 'Lot yaşı ve SKT yaklaşma riski'
  if(type === 'USE_ALTERNATIVE_RECIPE') return 'Reçete fire yüzdesi veya kalite sapması yüksek'
  if(type === 'PREFER_ALTERNATIVE_SUPPLIER') return 'Tedarikçi kaynaklı kalite red/fire sinyali'
  if(type === 'PRODUCE_AFTER_MAINTENANCE') return 'Makine kullanım/bakım sinyali kritik'
  if(type === 'CHANGE_LINE') return 'Hat verimliliği düşük veya kapasite kullanımı yüksek'
  if(type === 'INCREASE_QUALITY_CONTROL') return 'Kalite kontrol veya HACCP izleme riski'
  if(type === 'NO_WASTE_EXPECTED') return 'Fire ve risk sinyalleri eşik altında'
  return 'Üretim, stok, kalite ve kapasite read-model sinyali'
}

export const listWastePredictionRules = (): WastePredictionRule[] => (
  WASTE_PREDICTION_TYPES.map(type => {
    const risk = getBaseRiskForType(type)
    return {
      id: `waste-prediction-${type.toLocaleLowerCase('en-US').replace(/_/g, '-')}`,
      code: `WPR-${type}`,
      type,
      title: WASTE_PREDICTION_TYPE_LABELS[type],
      description: `${WASTE_PREDICTION_TYPE_LABELS[type]} karar destek kuralı.`,
      sourceModule: getSourceModuleForType(type),
      baseRisk: risk,
      priority: getPriorityFromRisk(risk),
      thresholdLabel: getThresholdLabelForType(type),
      enabled: true
    }
  })
)

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): WastePredictionHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as WastePredictionHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Fire tahmin raporu güncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeLinkedEntities = (
  value: unknown
): WastePredictionLinkedEntity[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((record, index) => ({
    id: normalizeText(record.id) || `linked_entity_${index + 1}`,
    no: normalizeText(record.no),
    name: normalizeText(record.name) || normalizeText(record.no) || 'Bağlı kayıt',
    detail: normalizeText(record.detail)
  }))
}

const normalizeAlternatives = (
  value: unknown
): WastePredictionAlternative[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((record, index) => ({
    id: normalizeText(record.id) || `alternative_${index + 1}`,
    code: normalizeText(record.code),
    name: normalizeText(record.name) || normalizeText(record.code) || 'Alternatif',
    score: normalizeNumber(record.score),
    expectedWastePercent: normalizeNumber(record.expectedWastePercent),
    expectedSaving: normalizeNumber(record.expectedSaving),
    reason: normalizeText(record.reason)
  }))
}

const normalizeRule = (
  value: RawWastePredictionRule,
  index: number
): WastePredictionRule => ({
  id: normalizeText(value.id) || `waste_prediction_rule_${index + 1}`,
  code: normalizeText(value.code) || `WPR-RULE-${index + 1}`,
  type: mapType(value.type),
  title: normalizeText(value.title) || 'Fire Tahmin Kuralı',
  description: normalizeText(value.description),
  sourceModule: normalizeText(value.sourceModule) as WastePredictionSourceModule || 'ReadModel',
  baseRisk: mapRisk(value.baseRisk),
  priority: mapPriority(value.priority),
  thresholdLabel: normalizeText(value.thresholdLabel),
  enabled: value.enabled !== false
})

const normalizeItem = (
  value: RawWastePredictionItem,
  reportId: string,
  reportNo: string,
  index: number
): WastePredictionItem => ({
  id: normalizeText(value.id) || `${reportId}_item_${index + 1}`,
  reportId,
  reportNo,
  predictionNo: normalizeText(value.predictionNo) || `${reportNo}-${String(index + 1).padStart(3, '0')}`,
  ruleId: normalizeText(value.ruleId),
  predictionType: mapType(value.predictionType),
  priority: mapPriority(value.priority),
  risk: mapRisk(value.risk),
  title: normalizeText(value.title) || 'Fire tahmini',
  description: normalizeText(value.description),
  forecastReason: normalizeText(value.forecastReason),
  analysisResult: normalizeText(value.analysisResult),
  riskExplanation: normalizeText(value.riskExplanation),
  riskReason: normalizeText(value.riskReason),
  action: normalizeText(value.action),
  expectedImpact: normalizeText(value.expectedImpact),
  ownerRole: normalizeText(value.ownerRole) || 'Üretim ve Kalite',
  productId: normalizeText(value.productId),
  productName: normalizeText(value.productName),
  stockItemId: normalizeText(value.stockItemId),
  stockItemName: normalizeText(value.stockItemName),
  recipeId: normalizeText(value.recipeId),
  recipeCode: normalizeText(value.recipeCode),
  recipeName: normalizeText(value.recipeName),
  productionLineId: normalizeText(value.productionLineId),
  productionLineName: normalizeText(value.productionLineName),
  machineId: normalizeText(value.machineId),
  machineCode: normalizeText(value.machineCode),
  machineName: normalizeText(value.machineName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  lotId: normalizeText(value.lotId),
  lotNo: normalizeText(value.lotNo),
  supplierId: normalizeText(value.supplierId),
  supplierName: normalizeText(value.supplierName),
  plannedQuantity: Math.max(0, normalizeNumber(value.plannedQuantity)),
  unit: normalizeText(value.unit) || 'kg',
  expectedWastePercent: normalizeNumber(value.expectedWastePercent),
  expectedWasteKg: normalizeNumber(value.expectedWasteKg),
  expectedWasteCost: normalizeNumber(value.expectedWasteCost),
  expectedSaving: normalizeNumber(value.expectedSaving),
  unitCost: normalizeNumber(value.unitCost),
  riskScore: normalizeNumber(value.riskScore),
  confidenceScore: normalizeNumber(value.confidenceScore),
  lotExpiryDate: normalizeText(value.lotExpiryDate),
  lotDaysToExpiry: normalizeNumber(value.lotDaysToExpiry),
  haccpCriticalPoint: normalizeText(value.haccpCriticalPoint),
  qualitySignal: normalizeText(value.qualitySignal),
  supplierPerformanceScore: normalizeNumber(value.supplierPerformanceScore),
  lineEfficiencyPercent: normalizeNumber(value.lineEfficiencyPercent),
  capacityUtilizationPercent: normalizeNumber(value.capacityUtilizationPercent),
  machineUtilizationPercent: normalizeNumber(value.machineUtilizationPercent),
  historicalWastePercent: normalizeNumber(value.historicalWastePercent),
  criticalWasteScenario: value.criticalWasteScenario === true,
  lotRiskScenario: value.lotRiskScenario === true,
  alternativeRecipeScenario: value.alternativeRecipeScenario === true,
  supplierWasteScenario: value.supplierWasteScenario === true,
  sourceModules: Array.isArray(value.sourceModules)
    ? value.sourceModules.map(module => normalizeText(module) as WastePredictionSourceModule).filter(Boolean)
    : [],
  sourceNo: normalizeText(value.sourceNo),
  affectedProductionOrders: normalizeLinkedEntities(value.affectedProductionOrders),
  affectedLots: normalizeLinkedEntities(value.affectedLots),
  alternativeRecipes: normalizeAlternatives(value.alternativeRecipes),
  alternativeSuppliers: normalizeAlternatives(value.alternativeSuppliers),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeReport = (
  value: RawWastePredictionReport,
  index: number
): WastePredictionReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextWastePredictionNo([], reportDate, index)
  const id = normalizeText(value.id) || `waste_prediction_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = normalizeText(value.responsiblePerson) || 'Fire Tahmin Motoru'
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawWastePredictionItem, id, reportNo, itemIndex))
    : []
  const rules = Array.isArray(value.rules)
    ? value.rules.filter(isRecord).map((rule, ruleIndex) => normalizeRule(rule as RawWastePredictionRule, ruleIndex))
    : listWastePredictionRules()
  const scopeText = normalizeText(value.scope)
  const history = normalizeHistory(value.history, id, actorName)

  return {
    id,
    reportNo,
    status: mapStatus(value.status),
    reportDate,
    scope: scopeText === ALL_FILTER || scopeText === '' ? 'all' : mapType(scopeText),
    responsiblePerson: actorName,
    description: normalizeText(value.description),
    items,
    rules,
    history: history.length > 0
      ? history
      : [createWastePredictionHistory(id, 'CREATED', actorName, `${reportNo} fire tahmin read-model olarak oluşturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'waste-prediction-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

const getBranchForName = (
  branches: Branch[],
  branchName: string
) => branches.find(branch => matchesName(branch.name, branchName)) || branches[0] || null

const getStockItemForProduct = (
  sourceData: KpiSourceData,
  productName: string,
  productId = ''
) => {
  const productRef = sourceData.productRefs.find(product => (
    product.id === productId || matchesName(product.name, productName)
  ))
  return sourceData.stockItems.find(item => item.id === productRef?.stockItemId || matchesName(item.name, productName)) || null
}

const getRecipeForProduct = (
  sourceData: KpiSourceData,
  productName: string,
  productId = ''
) => sourceData.recipeRecords.find(recipe => (
  recipe.status === 'Aktif'
  && (recipe.id === productId || matchesName(recipe.productName, productName) || matchesName(recipe.recipeName, productName))
)) || sourceData.recipeRecords.find(recipe => recipe.status === 'Aktif') || null

const getProductId = (
  sourceData: KpiSourceData,
  productName: string,
  stockItem: StockItem | null
) => sourceData.productRefs.find(product => (
  product.stockItemId === stockItem?.id || matchesName(product.name, productName)
))?.id || stockItem?.id || productName

const getSupplierName = (
  sourceData: KpiSourceData,
  supplierId: string
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || ''

const getUnitCost = (
  stockItem: StockItem | null,
  recipe: RecipeManagementRecord | null
) => {
  const recipeCost = recipe ? sumBy(recipe.ingredients, ingredient => ingredient.quantity * ingredient.unitCost) / Math.max(1, recipe.portions || 1) : 0
  return roundKpi(stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || recipeCost || 75)
}

const quantityToKg = (
  quantity: number,
  unit: string
) => {
  if(unit === 'kg') return quantity
  if(unit === 'gr') return quantity / 1000
  if(unit === 'lt') return quantity
  if(unit === 'ml') return quantity / 1000
  return quantity
}

const getLotForContext = (
  sourceData: KpiSourceData,
  context: {
    workOrderId: string
    productId: string
    stockItemId: string
  },
  index: number
) => {
  const matchingLots = sourceData.inventoryLots.filter(lot => (
    lot.productionOrderId === context.workOrderId
    || lot.productId === context.productId
    || lot.stockItemId === context.stockItemId
  ))
  const lots = matchingLots.length > 0 ? matchingLots : sourceData.inventoryLots
  return lots.length > 0 ? lots[index % lots.length] : null
}

const getMachineForContext = (
  machines: MachineCapacity[],
  productionLineId: string,
  index: number
) => {
  const matchingMachines = machines.filter(machine => !productionLineId || machine.productionLineId === productionLineId)
  const candidates = matchingMachines.length > 0 ? matchingMachines : machines
  return candidates.length > 0 ? candidates[index % candidates.length] : null
}

const getSupplierPerformanceScore = (
  sourceData: KpiSourceData,
  supplier: Supplier | null
) => {
  if(!supplier) return 72
  const supplierGoodsReceipts = sourceData.goodsReceipts.filter(receipt => receipt.supplierId === supplier.id)
  const rejectedLines = supplierGoodsReceipts.flatMap(receipt => receipt.items).filter(item => item.rejectedQuantity > 0).length
  const statusPenalty = supplier.status === 'SUSPENDED' || supplier.status === 'BLACKLISTED' || supplier.status === 'BLOCKED'
    ? 24
    : supplier.workingStatus === 'LIMITED' || supplier.workingStatus === 'ON_HOLD'
      ? 12
      : 0

  return clamp(94 - rejectedLines * 5 - statusPenalty - Math.max(0, supplier.leadTimeDays - 2) * 2, 35, 98)
}

const getHistoricalWastePercent = (
  sourceData: KpiSourceData,
  productName: string,
  stockItemId: string,
  plannedQuantityKg: number
) => {
  const wasteRecords = WasteService.list(sourceData)
  const matchingWaste = wasteRecords.filter(record => (
    record.stockItemId === stockItemId || matchesName(record.productName, productName) || matchesName(record.stockItemName, productName)
  ))
  const totalWaste = sumBy(matchingWaste, record => quantityToKg(record.quantity, record.unit))
  return clamp((totalWaste / Math.max(80, plannedQuantityKg * 10)) * 100, 0, 12)
}

const getQualitySignal = (
  sourceData: KpiSourceData,
  lotId: string
) => {
  const samples = sourceData.qualitySamples.filter(sample => sample.inventoryLotId === lotId)
  if(samples.some(sample => sample.status === 'DISCARDED')) return 'Kalite numunesi imha/red sinyali verdi'
  if(samples.some(sample => sample.status === 'UNDER_REVIEW')) return 'Kalite numunesi incelemede'
  if(samples.length > 0) return 'Kalite numunesi izleniyor'
  return 'Kalite sinyali eşik altında'
}

const getHaccpCriticalPoint = (
  sourceData: KpiSourceData,
  lotId: string,
  workOrderId: string
) => {
  const record = sourceData.haccpRecords.find(plan => plan.monitoringRecords.some(item => (
    item.inventoryLotId === lotId || item.productionOrderId === workOrderId
  )))
  if(!record) return 'HACCP kritik sapma yok'
  const monitoring = record.monitoringRecords.find(item => item.inventoryLotId === lotId || item.productionOrderId === workOrderId)
  const ccp = record.criticalControlPoints.find(point => point.id === monitoring?.ccpId)
  return `${record.name}${ccp ? ` / ${ccp.name}` : ''}${monitoring ? ` / ${monitoring.result}` : ''}`
}

const createContextFromPlanningItem = (
  sourceData: KpiSourceData,
  item: ReturnType<typeof ProductionPlanningService.list>[number]['items'][number],
  branchId: string,
  branchName: string,
  machines: MachineCapacity[],
  index: number
): PredictionContext => {
  const stockItem = getStockItemForProduct(sourceData, item.productName, item.productId)
  const recipe = sourceData.recipeRecords.find(record => record.id === item.recipeId) || getRecipeForProduct(sourceData, item.productName, item.productId)
  const productId = item.productId || getProductId(sourceData, item.productName, stockItem)
  const machine = getMachineForContext(machines, item.productionLineId, index)
  const lot = getLotForContext(sourceData, {
    workOrderId: '',
    productId,
    stockItemId: stockItem?.id || ''
  }, index)
  const supplier = sourceData.suppliers.find(record => record.id === lot?.supplierId) || null
  const baseDate = addDays(getTodayKey(), index % 12)
  const plannedQuantityKg = quantityToKg(item.produceQuantity || item.demandQuantity, item.unit)
  const lotDaysToExpiry = differenceInDays(lot?.expiryDate || addDays(baseDate, 18 + index), baseDate)

  return {
    sourceNo: item.productCode || item.productName,
    workOrderId: '',
    workOrderNo: '',
    productId,
    productName: item.productName,
    stockItemId: stockItem?.id || '',
    stockItemName: stockItem?.name || item.productName,
    recipeId: recipe?.id || item.recipeId,
    recipeCode: recipe?.code || '',
    recipeName: recipe?.recipeName || item.recipeName,
    recipeFirePercent: recipe?.firePercent || item.wastePercent || 2,
    branchId,
    branchName,
    productionLineId: item.productionLineId || machine?.productionLineId || '',
    productionLineName: item.productionLineName || machine?.productionLineName || 'Üretim Hattı',
    machineId: machine?.machineId || '',
    machineCode: machine?.machineCode || '',
    machineName: machine?.machineName || 'Makine',
    lotId: lot?.id || '',
    lotNo: lot?.lotNo || '',
    supplierId: supplier?.id || '',
    supplierName: supplier?.name || '',
    plannedQuantity: roundKpi(item.produceQuantity || item.demandQuantity),
    unit: item.unit,
    unitCost: getUnitCost(stockItem, recipe),
    baseDate,
    lotExpiryDate: lot?.expiryDate || addDays(baseDate, 18 + index),
    lotDaysToExpiry,
    haccpCriticalPoint: getHaccpCriticalPoint(sourceData, lot?.id || '', ''),
    qualitySignal: getQualitySignal(sourceData, lot?.id || ''),
    historicalWastePercent: getHistoricalWastePercent(sourceData, item.productName, stockItem?.id || '', plannedQuantityKg),
    supplierPerformanceScore: getSupplierPerformanceScore(sourceData, supplier),
    lineEfficiencyPercent: clamp(100 - item.capacityUsagePercent / 5 + (index % 7), 58, 96),
    capacityUtilizationPercent: item.capacityUsagePercent || machine?.utilizationPercent || 72,
    machineUtilizationPercent: machine?.utilizationPercent || item.capacityUsagePercent || 72
  }
}

const createContextFromWorkOrder = (
  sourceData: KpiSourceData,
  order: KpiSourceData['productionOrders'][number],
  line: KpiSourceData['productionOrders'][number]['lines'][number],
  machines: MachineCapacity[],
  index: number
): PredictionContext => {
  const branch = getBranchForName(sourceData.branches, order.branch)
  const stockItem = getStockItemForProduct(sourceData, line.productName)
  const recipe = getRecipeForProduct(sourceData, line.productName)
  const productId = getProductId(sourceData, line.productName, stockItem)
  const lineRecord = sourceData.productionLines[index % Math.max(1, sourceData.productionLines.length)]
  const machine = getMachineForContext(machines, lineRecord?.id || '', index)
  const lot = getLotForContext(sourceData, {
    workOrderId: order.id,
    productId,
    stockItemId: stockItem?.id || ''
  }, index)
  const supplier = sourceData.suppliers.find(record => record.id === lot?.supplierId) || null
  const baseDate = order.deliveryDate || addDays(getTodayKey(), index % 12)
  const plannedQuantityKg = quantityToKg(line.quantity, line.unit)
  const lotDaysToExpiry = differenceInDays(lot?.expiryDate || addDays(baseDate, 14 + index), baseDate)

  return {
    sourceNo: order.workOrderNo,
    workOrderId: order.id,
    workOrderNo: order.workOrderNo,
    productId,
    productName: line.productName,
    stockItemId: stockItem?.id || '',
    stockItemName: stockItem?.name || line.productName,
    recipeId: recipe?.id || '',
    recipeCode: recipe?.code || '',
    recipeName: recipe?.recipeName || 'Standart reçete',
    recipeFirePercent: recipe?.firePercent || 2,
    branchId: branch?.id || '',
    branchName: branch?.name || order.branch,
    productionLineId: machine?.productionLineId || lineRecord?.id || '',
    productionLineName: machine?.productionLineName || lineRecord?.name || 'Üretim Hattı',
    machineId: machine?.machineId || '',
    machineCode: machine?.machineCode || '',
    machineName: machine?.machineName || 'Makine',
    lotId: lot?.id || '',
    lotNo: lot?.lotNo || '',
    supplierId: supplier?.id || '',
    supplierName: supplier?.name || '',
    plannedQuantity: roundKpi(line.quantity),
    unit: line.unit,
    unitCost: getUnitCost(stockItem, recipe),
    baseDate,
    lotExpiryDate: lot?.expiryDate || addDays(baseDate, 14 + index),
    lotDaysToExpiry,
    haccpCriticalPoint: getHaccpCriticalPoint(sourceData, lot?.id || '', order.id),
    qualitySignal: getQualitySignal(sourceData, lot?.id || ''),
    historicalWastePercent: getHistoricalWastePercent(sourceData, line.productName, stockItem?.id || '', plannedQuantityKg),
    supplierPerformanceScore: getSupplierPerformanceScore(sourceData, supplier),
    lineEfficiencyPercent: clamp(72 + (index % 18), 58, 96),
    capacityUtilizationPercent: machine?.utilizationPercent || 70 + (index % 24),
    machineUtilizationPercent: machine?.utilizationPercent || 68 + (index % 26)
  }
}

const createFallbackContexts = (
  sourceData: KpiSourceData,
  machines: MachineCapacity[]
) => {
  const branch = sourceData.branches[0] || null
  const recipes = sourceData.recipeRecords.length > 0 ? sourceData.recipeRecords : []
  const products = sourceData.productRefs.length > 0 ? sourceData.productRefs : sourceData.stockItems.map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    stockItemId: item.id
  }))
  const fallbackProducts = products.length > 0 ? products : [{ id: 'fallback_product', name: 'Ürün', unit: 'kg' as StockUnit, stockItemId: '' }]

  return fallbackProducts.slice(0, 20).map((product, index): PredictionContext => {
    const stockItem = sourceData.stockItems.find(item => item.id === product.stockItemId) || null
    const recipe = recipes[index % Math.max(1, recipes.length)] || null
    const machine = getMachineForContext(machines, '', index)
    const lot = getLotForContext(sourceData, {
      workOrderId: '',
      productId: product.id,
      stockItemId: stockItem?.id || ''
    }, index)
    const supplier = sourceData.suppliers.find(record => record.id === lot?.supplierId) || null
    const baseDate = addDays(getTodayKey(), index % 12)

    return {
      sourceNo: product.id,
      workOrderId: '',
      workOrderNo: '',
      productId: product.id,
      productName: product.name,
      stockItemId: stockItem?.id || product.stockItemId || '',
      stockItemName: stockItem?.name || product.name,
      recipeId: recipe?.id || '',
      recipeCode: recipe?.code || '',
      recipeName: recipe?.recipeName || 'Standart reçete',
      recipeFirePercent: recipe?.firePercent || 2,
      branchId: branch?.id || '',
      branchName: branch?.name || 'Merkez',
      productionLineId: machine?.productionLineId || '',
      productionLineName: machine?.productionLineName || 'Üretim Hattı',
      machineId: machine?.machineId || '',
      machineCode: machine?.machineCode || '',
      machineName: machine?.machineName || 'Makine',
      lotId: lot?.id || '',
      lotNo: lot?.lotNo || '',
      supplierId: supplier?.id || '',
      supplierName: supplier?.name || '',
      plannedQuantity: 120 + index * 8,
      unit: product.unit || 'kg',
      unitCost: getUnitCost(stockItem, recipe),
      baseDate,
      lotExpiryDate: lot?.expiryDate || addDays(baseDate, 12 + index),
      lotDaysToExpiry: differenceInDays(lot?.expiryDate || addDays(baseDate, 12 + index), baseDate),
      haccpCriticalPoint: getHaccpCriticalPoint(sourceData, lot?.id || '', ''),
      qualitySignal: getQualitySignal(sourceData, lot?.id || ''),
      historicalWastePercent: getHistoricalWastePercent(sourceData, product.name, stockItem?.id || '', 120),
      supplierPerformanceScore: getSupplierPerformanceScore(sourceData, supplier),
      lineEfficiencyPercent: 74 + (index % 16),
      capacityUtilizationPercent: machine?.utilizationPercent || 72 + (index % 18),
      machineUtilizationPercent: machine?.utilizationPercent || 70 + (index % 20)
    }
  })
}

const createSourceContexts = (
  sourceData: KpiSourceData
) => {
  const capacityPlans = CapacityPlanningService.list(sourceData)
  const machines = capacityPlans.flatMap(plan => plan.machineCapacities)
  const planningContexts = ProductionPlanningService.list(sourceData).flatMap((plan, planIndex) => (
    plan.items.map((item, itemIndex) => createContextFromPlanningItem(
      sourceData,
      item,
      plan.branchId,
      plan.branchName,
      machines,
      planIndex * 31 + itemIndex
    ))
  ))
  const orderContexts = sourceData.productionOrders.flatMap((order, orderIndex) => (
    order.lines.map((line, lineIndex) => createContextFromWorkOrder(
      sourceData,
      order,
      line,
      machines,
      orderIndex * 17 + lineIndex
    ))
  ))

  const contexts = [...planningContexts, ...orderContexts]
  return contexts.length > 0 ? contexts : createFallbackContexts(sourceData, machines)
}

const createScenario = (
  index: number
): ScenarioDefinition => {
  if(index < 40){
    return {
      type: index % 3 === 0 ? 'HIGH_WASTE_RISK' : index % 3 === 1 ? 'REDUCE_PRODUCTION_QUANTITY' : 'INCREASE_QUALITY_CONTROL',
      criticalWasteScenario: true,
      lotRiskScenario: index % 5 === 0,
      alternativeRecipeScenario: index % 7 === 0,
      supplierWasteScenario: index % 8 === 0
    }
  }
  if(index < 70){
    return {
      type: index % 2 === 0 ? 'USE_OLDER_LOT_FIRST' : 'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS',
      criticalWasteScenario: false,
      lotRiskScenario: true,
      alternativeRecipeScenario: index % 6 === 0,
      supplierWasteScenario: false
    }
  }
  if(index < 95){
    return {
      type: 'USE_ALTERNATIVE_RECIPE',
      criticalWasteScenario: false,
      lotRiskScenario: index % 5 === 0,
      alternativeRecipeScenario: true,
      supplierWasteScenario: false
    }
  }
  if(index < 115){
    return {
      type: 'PREFER_ALTERNATIVE_SUPPLIER',
      criticalWasteScenario: false,
      lotRiskScenario: false,
      alternativeRecipeScenario: index % 5 === 0,
      supplierWasteScenario: true
    }
  }

  const cycle: WastePredictionType[] = [
    'PRODUCE_AFTER_MAINTENANCE',
    'CHANGE_LINE',
    'CHANGE_PERSONNEL',
    'SPLIT_PRODUCTION_BATCH',
    'NO_WASTE_EXPECTED',
    'HIGH_WASTE_RISK',
    'USE_OLDER_LOT_FIRST',
    'INCREASE_QUALITY_CONTROL'
  ]

  return {
    type: cycle[index % cycle.length],
    criticalWasteScenario: index % 11 === 0,
    lotRiskScenario: index % 7 === 0,
    alternativeRecipeScenario: index % 8 === 0,
    supplierWasteScenario: index % 9 === 0
  }
}

const getRiskFromPercent = (
  percentValue: number,
  scenario: ScenarioDefinition
): WastePredictionRisk => {
  if(scenario.criticalWasteScenario || percentValue >= 10) return 'CRITICAL'
  if(percentValue >= 6.5 || scenario.lotRiskScenario || scenario.supplierWasteScenario || scenario.alternativeRecipeScenario) return 'HIGH'
  if(percentValue >= 3) return 'MEDIUM'
  return 'LOW'
}

const getRiskReason = (
  context: PredictionContext,
  scenario: ScenarioDefinition
) => {
  if(scenario.criticalWasteScenario) return 'Kritik fire skoru'
  if(scenario.lotRiskScenario || context.lotDaysToExpiry <= 7) return 'Lot / SKT riski'
  if(scenario.alternativeRecipeScenario) return 'Reçete fire sapması'
  if(scenario.supplierWasteScenario || context.supplierPerformanceScore < 70) return 'Tedarikçi kalite performansı'
  if(context.machineUtilizationPercent >= 90) return 'Makine kullanım yoğunluğu'
  if(context.capacityUtilizationPercent >= 90) return 'Kapasite baskısı'
  if(normalizeSearchText(context.qualitySignal).includes('inceleme') || normalizeSearchText(context.qualitySignal).includes('red')) return 'Kalite kontrol sinyali'
  return 'Fire beklenen eşik altında'
}

const getExpectedWastePercent = (
  context: PredictionContext,
  scenario: ScenarioDefinition,
  index: number
) => {
  if(scenario.type === 'NO_WASTE_EXPECTED') return roundKpi(0.4 + (index % 5) * 0.18)
  const lotImpact = context.lotDaysToExpiry <= 3 ? 3.2 : context.lotDaysToExpiry <= 7 ? 2.1 : context.lotDaysToExpiry <= 14 ? 0.8 : 0
  const machineImpact = context.machineUtilizationPercent >= 94 ? 2.2 : context.machineUtilizationPercent >= 88 ? 1.2 : 0
  const capacityImpact = context.capacityUtilizationPercent >= 92 ? 1.5 : context.capacityUtilizationPercent >= 84 ? 0.7 : 0
  const qualityImpact = normalizeSearchText(context.qualitySignal).includes('red')
    ? 2.8
    : normalizeSearchText(context.qualitySignal).includes('incele')
      ? 1.6
      : 0
  const supplierImpact = context.supplierPerformanceScore < 60 ? 2.3 : context.supplierPerformanceScore < 75 ? 1.1 : 0
  const scenarioImpact = scenario.criticalWasteScenario
    ? 4.6
    : scenario.lotRiskScenario
      ? 2
      : scenario.alternativeRecipeScenario || scenario.supplierWasteScenario
        ? 1.6
        : 0.4

  return roundKpi(clamp(
    context.recipeFirePercent
      + context.historicalWastePercent * 0.55
      + lotImpact
      + machineImpact
      + capacityImpact
      + qualityImpact
      + supplierImpact
      + scenarioImpact
      + (index % 6) * 0.24,
    0.3,
    22
  ))
}

const getActionText = (
  type: WastePredictionType,
  context: PredictionContext
) => {
  if(type === 'HIGH_WASTE_RISK') return 'Üretim başlamadan önce kalite, lot ve makine sinyalleri manuel incelenmeli.'
  if(type === 'USE_OLDER_LOT_FIRST') return `${context.lotNo || 'Seçili lot'} yerine FEFO sırasındaki eski lot önceliklendirilmeli.`
  if(type === 'USE_ALTERNATIVE_RECIPE') return 'Daha düşük fire yüzdesine sahip alternatif reçete kalite ekibiyle doğrulanmalı.'
  if(type === 'PREFER_ALTERNATIVE_SUPPLIER') return 'Aynı hammadde için daha yüksek performanslı alternatif tedarikçi değerlendirilmeli.'
  if(type === 'PRODUCE_AFTER_MAINTENANCE') return `${context.machineCode || context.machineName} bakımından sonra üretim planı manuel gözden geçirilmeli.`
  if(type === 'CHANGE_LINE') return `${context.productionLineName} yerine uygun doluluğa sahip alternatif hat değerlendirilmeli.`
  if(type === 'CHANGE_PERSONNEL') return 'Vardiya içi personel deneyim dağılımı kalite riski düşecek şekilde manuel incelenmeli.'
  if(type === 'REDUCE_PRODUCTION_QUANTITY') return 'Parti miktarı geçici olarak azaltılıp kalan miktar yeni kalite sinyalinden sonra ele alınmalı.'
  if(type === 'SPLIT_PRODUCTION_BATCH') return 'Üretim iki partiye bölünerek lot ve kalite kontrol etkisi ayrıştırılmalı.'
  if(type === 'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS') return 'SKT yaklaşan hammaddeler kalite onayıyla öncelikli kullanılmalı.'
  if(type === 'INCREASE_QUALITY_CONTROL') return 'Kritik kontrol noktalarında numune alma ve ölçüm sıklığı artırılmalı.'
  return 'Ek aksiyon önerilmedi; fire tahmini izleme listesinde tutulmalı.'
}

const getAnalysisText = (
  context: PredictionContext,
  expectedWastePercent: number,
  expectedWasteKg: number
) => (
  `${context.productName} için reçete fire yüzdesi ${formatPercent(context.recipeFirePercent)}, geçmiş fire ${formatPercent(context.historicalWastePercent)}, hat verimliliği ${formatPercent(context.lineEfficiencyPercent)} ve makine kullanım oranı ${formatPercent(context.machineUtilizationPercent)} birlikte değerlendirildi. Beklenen fire ${formatNumber(expectedWasteKg, 1)} kg / ${formatPercent(expectedWastePercent)}.`
)

const getExpectedImpactText = (
  expectedSaving: number,
  expectedWasteCost: number
) => (
  `${formatCurrency(expectedWasteCost)} beklenen fire maliyetine karşı ${formatCurrency(expectedSaving)} tasarruf potansiyeli oluşur. Bu sonuç gerçek stok veya muhasebe kaydı yaratmaz.`
)

const createAffectedProductionOrders = (
  sourceData: KpiSourceData,
  context: PredictionContext
): WastePredictionLinkedEntity[] => {
  const related = sourceData.productionOrders
    .filter(order => order.id === context.workOrderId || order.lines.some(line => matchesName(line.productName, context.productName)))
    .slice(0, 5)
    .map(order => ({
      id: order.id,
      no: order.workOrderNo,
      name: order.lines.map(line => line.productName).slice(0, 2).join(', ') || context.productName,
      detail: `${order.deliveryDate} / ${order.priority} / ${order.status}`
    }))

  return related.length > 0
    ? related
    : [{
        id: context.workOrderId || context.productId,
        no: context.workOrderNo || context.sourceNo,
        name: context.productName,
        detail: `${context.branchName} / ${formatNumber(context.plannedQuantity, 1)} ${context.unit}`
      }]
}

const createAffectedLots = (
  sourceData: KpiSourceData,
  context: PredictionContext
): WastePredictionLinkedEntity[] => {
  const lots = sourceData.inventoryLots
    .filter(lot => lot.id === context.lotId || lot.productId === context.productId || lot.stockItemId === context.stockItemId)
    .slice(0, 5)
    .map(lot => ({
      id: lot.id,
      no: lot.lotNo,
      name: context.productName,
      detail: `${lot.expiryDate} SKT / ${formatNumber(lot.remainingQuantity || lot.quantity, 1)} ${lot.unit}`
    }))

  return lots.length > 0
    ? lots
    : context.lotId
      ? [{
          id: context.lotId,
          no: context.lotNo,
          name: context.productName,
          detail: `${context.lotExpiryDate} SKT`
        }]
      : []
}

const createAlternativeRecipes = (
  sourceData: KpiSourceData,
  context: PredictionContext,
  expectedWastePercent: number,
  expectedSaving: number
): WastePredictionAlternative[] => {
  const recipes = sourceData.recipeRecords
    .filter(recipe => recipe.id !== context.recipeId && recipe.status === 'Aktif' && (
      recipe.recipeRole === 'ALTERNATIVE'
      || matchesName(recipe.productName, context.productName)
      || matchesName(recipe.recipeName, context.productName)
    ))
  const candidates = recipes.length > 0 ? recipes : sourceData.recipeRecords.filter(recipe => recipe.id !== context.recipeId && recipe.status === 'Aktif')

  return candidates.slice(0, 3).map((recipe, index) => ({
    id: recipe.id,
    code: recipe.code,
    name: recipe.recipeName,
    score: clamp(88 - recipe.firePercent * 2 + index * 2, 55, 96),
    expectedWastePercent: roundKpi(Math.max(0.4, expectedWastePercent - (1.2 + index * 0.35))),
    expectedSaving: roundKpi(expectedSaving * (0.7 + index * 0.12)),
    reason: `${formatPercent(recipe.firePercent)} reçete fire yüzdesi / ${recipe.recipeRole === 'ALTERNATIVE' ? 'alternatif reçete' : 'benzer ürün reçetesi'}`
  }))
}

const createAlternativeSuppliers = (
  sourceData: KpiSourceData,
  context: PredictionContext,
  expectedWastePercent: number,
  expectedSaving: number
): WastePredictionAlternative[] => {
  const supplierProducts = sourceData.supplierProducts
    .filter(mapping => mapping.stockItemId === context.stockItemId && mapping.supplierId !== context.supplierId && mapping.status === 'ACTIVE')
  const candidates = supplierProducts.length > 0 ? supplierProducts : sourceData.supplierProducts.filter(mapping => mapping.supplierId !== context.supplierId && mapping.status === 'ACTIVE')

  return candidates.slice(0, 3).map((mapping, index) => {
    const supplier = sourceData.suppliers.find(record => record.id === mapping.supplierId) || null
    const score = getSupplierPerformanceScore(sourceData, supplier)
    return {
      id: supplier?.id || mapping.supplierId,
      code: supplier?.supplierCode || mapping.supplierSku,
      name: supplier?.name || mapping.supplierProductName,
      score,
      expectedWastePercent: roundKpi(Math.max(0.4, expectedWastePercent - (score >= 85 ? 1.7 : 0.9))),
      expectedSaving: roundKpi(expectedSaving * (score >= 85 ? 0.9 : 0.62) + index * 120),
      reason: `${formatPercent(score)} performans skoru / ${mapping.leadTimeDays} gün termin`
    }
  })
}

const createSourceModules = (
  scenario: ScenarioDefinition
): WastePredictionSourceModule[] => Array.from(new Set<WastePredictionSourceModule>([
  'Production',
  'ProductionPlanning',
  'Recipe',
  'Stock',
  'InventoryLots',
  'WasteManagement',
  'Purchasing',
  'PurchaseRecommendations',
  'SupplierPerformance',
  'CapacityPlanning',
  'MachineScheduling',
  'WorkforcePlanning',
  'Quality',
  'HACCP',
  'ShipmentPlanning',
  'Forecasting',
  'CostOptimization',
  'ProductionPlanningRecommendations',
  getSourceModuleForType(scenario.type)
]))

const createItem = ({
  context,
  index,
  reportId,
  reportNo,
  sourceData
}: {
  context: PredictionContext
  index: number
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
}): WastePredictionItem => {
  const scenario = createScenario(index)
  const expectedWastePercent = getExpectedWastePercent(context, scenario, index)
  const plannedQuantityKg = quantityToKg(context.plannedQuantity, context.unit)
  const expectedWasteKg = roundKpi(Math.max(0.1, plannedQuantityKg * expectedWastePercent / 100))
  const expectedWasteCost = roundKpi(expectedWasteKg * context.unitCost)
  const expectedSaving = roundKpi(expectedWasteCost * (
    scenario.criticalWasteScenario ? 0.42 : scenario.alternativeRecipeScenario ? 0.35 : scenario.supplierWasteScenario ? 0.32 : scenario.lotRiskScenario ? 0.28 : 0.18
  ))
  const risk = getRiskFromPercent(expectedWastePercent, scenario)
  const priority = getPriorityFromRisk(risk)
  const riskReason = getRiskReason(context, scenario)
  const riskScore = clamp(
    risk === 'CRITICAL' ? 88 + index % 12 : risk === 'HIGH' ? 68 + index % 17 : risk === 'MEDIUM' ? 42 + index % 18 : 15 + index % 18
  )
  const confidenceScore = roundKpi(clamp(
    64
      + (context.recipeId ? 7 : 0)
      + (context.lotId ? 7 : 0)
      + (context.haccpCriticalPoint ? 4 : 0)
      + (context.historicalWastePercent > 0 ? 5 : 0)
      + (scenario.criticalWasteScenario ? 5 : 0)
      - (risk === 'LOW' ? 1 : 0),
    52,
    98
  ))
  const alternativeRecipes = createAlternativeRecipes(sourceData, context, expectedWastePercent, expectedSaving)
  const alternativeSuppliers = createAlternativeSuppliers(sourceData, context, expectedWastePercent, expectedSaving)
  const action = getActionText(scenario.type, context)
  const createdAt = addMinutes(new Date(`${getTodayKey()}T07:30:00`).toISOString(), index * 9)

  return {
    id: `${reportId}_item_${index + 1}`,
    reportId,
    reportNo,
    predictionNo: `${reportNo}-${String(index + 1).padStart(3, '0')}`,
    ruleId: `waste-prediction-${scenario.type.toLocaleLowerCase('en-US').replace(/_/g, '-')}`,
    predictionType: scenario.type,
    priority,
    risk,
    title: `${context.productName} için ${WASTE_PREDICTION_TYPE_LABELS[scenario.type]}`,
    description: 'Karar Destek Motoru üretim, reçete, stok, lot/SKT, kalite, satın alma, tedarikçi, kapasite, makine, personel, geçmiş fire, HACCP, sevkiyat ve tahminleme sinyallerini birlikte değerlendirdi.',
    forecastReason: `${riskReason}; ${context.lotNo ? `${context.lotNo} lotu ${context.lotDaysToExpiry} gün SKT penceresinde.` : 'Lot sinyali bulunamadı.'} ${context.qualitySignal}.`,
    analysisResult: getAnalysisText(context, expectedWastePercent, expectedWasteKg),
    riskExplanation: `${WASTE_PREDICTION_RISK_LABELS[risk]} risk; beklenen fire ${formatPercent(expectedWastePercent)}, fire maliyeti ${formatCurrency(expectedWasteCost)}, tedarikçi performansı ${formatPercent(context.supplierPerformanceScore)}. ${context.haccpCriticalPoint}`,
    riskReason,
    action,
    expectedImpact: getExpectedImpactText(expectedSaving, expectedWasteCost),
    ownerRole: scenario.type === 'PREFER_ALTERNATIVE_SUPPLIER'
      ? 'Satın Alma ve Kalite'
      : scenario.type === 'USE_ALTERNATIVE_RECIPE'
        ? 'Ar-Ge, Reçete ve Kalite'
        : scenario.type === 'PRODUCE_AFTER_MAINTENANCE'
          ? 'Bakım ve Üretim'
          : 'Üretim ve Kalite',
    productId: context.productId,
    productName: context.productName,
    stockItemId: context.stockItemId,
    stockItemName: context.stockItemName,
    recipeId: context.recipeId,
    recipeCode: context.recipeCode,
    recipeName: context.recipeName,
    productionLineId: context.productionLineId,
    productionLineName: context.productionLineName,
    machineId: context.machineId,
    machineCode: context.machineCode,
    machineName: context.machineName,
    branchId: context.branchId,
    branchName: context.branchName,
    lotId: context.lotId,
    lotNo: context.lotNo,
    supplierId: context.supplierId,
    supplierName: context.supplierName,
    plannedQuantity: context.plannedQuantity,
    unit: context.unit,
    expectedWastePercent,
    expectedWasteKg,
    expectedWasteCost,
    expectedSaving,
    unitCost: context.unitCost,
    riskScore,
    confidenceScore,
    lotExpiryDate: context.lotExpiryDate,
    lotDaysToExpiry: context.lotDaysToExpiry,
    haccpCriticalPoint: context.haccpCriticalPoint,
    qualitySignal: context.qualitySignal,
    supplierPerformanceScore: context.supplierPerformanceScore,
    lineEfficiencyPercent: context.lineEfficiencyPercent,
    capacityUtilizationPercent: context.capacityUtilizationPercent,
    machineUtilizationPercent: context.machineUtilizationPercent,
    historicalWastePercent: context.historicalWastePercent,
    criticalWasteScenario: scenario.criticalWasteScenario,
    lotRiskScenario: scenario.lotRiskScenario,
    alternativeRecipeScenario: scenario.alternativeRecipeScenario,
    supplierWasteScenario: scenario.supplierWasteScenario,
    sourceModules: createSourceModules(scenario),
    sourceNo: context.sourceNo,
    affectedProductionOrders: createAffectedProductionOrders(sourceData, context),
    affectedLots: createAffectedLots(sourceData, context),
    alternativeRecipes,
    alternativeSuppliers,
    createdAt
  }
}

const createWastePredictionItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => {
  const contexts = createSourceContexts(sourceData)
  const fallbackContexts = contexts.length > 0 ? contexts : createFallbackContexts(sourceData, [])

  // Warm related decision-support read models without mutating production, stock, quality or waste entities.
  PurchaseRecommendationService.list(sourceData)
  ProductionPlanningRecommendationService.list(sourceData)

  return Array.from({ length: SEED_PREDICTION_COUNT }).map((_, index) => createItem({
    context: fallbackContexts[index % fallbackContexts.length],
    index,
    reportId,
    reportNo,
    sourceData
  }))
}

export const evaluateWastePredictionReport = (
  sourceData: KpiSourceData,
  input: Partial<WastePredictionReportCreateInput> = {},
  existingReports: WastePredictionReport[] = [],
  actorName = 'Fire Tahmin Motoru'
): WastePredictionReport => {
  const createInput = {
    ...createDefaultWastePredictionReportInput(actorName),
    ...input
  }
  const reportNo = getNextWastePredictionNo(existingReports, createInput.reportDate)
  const reportId = `waste_prediction_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()
  const allItems = createWastePredictionItems(sourceData, reportId, reportNo)
  const items = createInput.scope === 'all'
    ? allItems
    : allItems.filter(item => item.predictionType === createInput.scope)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: createInput.reportDate || getTodayKey(),
    scope: createInput.scope,
    responsiblePerson: createInput.responsiblePerson || actorName,
    description: createInput.description || 'Üretim, reçete, stok, kalite, satın alma, kapasite, makine, personel, geçmiş fire, lot/SKT, HACCP, sevkiyat ve tahminleme verilerinden fire tahminleri üretildi.',
    items,
    rules: listWastePredictionRules(),
    history: [
      createWastePredictionHistory(reportId, 'CREATED', actorName, `${reportNo} fire tahmin read-model olarak oluşturuldu.`),
      createWastePredictionHistory(reportId, 'CALCULATED', actorName, `${items.length} fire tahmini hesaplandı. Gerçek fire kaydı, stok düşümü veya kalite kaydı oluşturulmadı.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'waste-prediction-engine',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

const hasWastePredictionSeedCoverage = (
  reports: WastePredictionReport[]
) => {
  const items = reports.flatMap(report => report.items)
  return items.length >= 180
    && items.filter(item => item.criticalWasteScenario || item.risk === 'CRITICAL').length >= 40
    && items.filter(item => item.lotRiskScenario).length >= 30
    && items.filter(item => item.alternativeRecipeScenario).length >= 25
    && items.filter(item => item.supplierWasteScenario).length >= 20
}

const ensureWastePredictionSeedCoverage = (
  reports: WastePredictionReport[],
  sourceData: KpiSourceData
) => {
  if(hasWastePredictionSeedCoverage(reports)) return reports

  const seedReport = evaluateWastePredictionReport(sourceData, {
    reportDate: getTodayKey(),
    scope: 'all',
    responsiblePerson: 'Fire Tahmin Motoru',
    description: 'Faz 34.13.8 seed kapsamı için read-model fire tahminleri üretildi.'
  }, reports, 'Fire Tahmin Motoru')
  const nextReports = [seedReport, ...reports]
    .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))

  saveWastePredictionReports(nextReports)
  return nextReports
}

export const saveWastePredictionReports = (
  reports: WastePredictionReport[]
) => {
  if(!isBrowserStorageAvailable()) return
  setDecisionIndexedRecord(WASTE_PREDICTION_STORAGE_KEY, reports)
}

export const loadWastePredictionReports = (
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()){
    return [evaluateWastePredictionReport(sourceData)]
  }

  const stored = getDecisionIndexedRecord<RawWastePredictionReport[]>(WASTE_PREDICTION_STORAGE_KEY)
  if(stored === null){
    const defaultReport = evaluateWastePredictionReport(sourceData)
    const reports = ensureWastePredictionSeedCoverage([defaultReport], sourceData)
    saveWastePredictionReports(reports)
    return reports
  }

  try {
    if(Array.isArray(stored)){
      const reports = stored
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawWastePredictionReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      if(reports.length > 0) return ensureWastePredictionSeedCoverage(reports, sourceData)
    }
  } catch {
    // Corrupt local prediction cache is replaced with a fresh read-model report.
  }

  const defaultReport = evaluateWastePredictionReport(sourceData)
  saveWastePredictionReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: WastePredictionReport[],
  nextReport: WastePredictionReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addWastePredictionReport = (
  input: WastePredictionReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadWastePredictionReports(sourceData)
  const report = evaluateWastePredictionReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveWastePredictionReports(nextReports)
  return report
}

export const filterWastePredictionReports = (
  reports: WastePredictionReport[],
  filters: WastePredictionFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredItems = report.items.filter(item => {
      const matchesSearch = !search || [
        report.reportNo,
        item.predictionNo,
        item.title,
        item.description,
        item.forecastReason,
        item.analysisResult,
        item.riskExplanation,
        item.riskReason,
        item.action,
        item.productName,
        item.stockItemName,
        item.recipeCode,
        item.recipeName,
        item.productionLineName,
        item.machineCode,
        item.machineName,
        item.branchName,
        item.lotNo,
        item.supplierName,
        item.qualitySignal,
        item.haccpCriticalPoint
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.productId === ALL_FILTER || item.productId === filters.productId || item.stockItemId === filters.productId)
        && (filters.recipeId === ALL_FILTER || item.recipeId === filters.recipeId)
        && (filters.productionLineId === ALL_FILTER || item.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || item.machineId === filters.machineId)
        && (filters.lotId === ALL_FILTER || item.lotId === filters.lotId)
        && (filters.supplierId === ALL_FILTER || item.supplierId === filters.supplierId)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (!filters.date || item.createdAt.slice(0, 10) === filters.date || report.reportDate === filters.date)
    })

    return {
      ...report,
      items: filteredItems
    }
  }).filter(report => report.items.length > 0)
}

export const updateWastePredictionReportStatus = (
  reportId: string,
  status: Extract<WastePredictionStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadWastePredictionReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Fire tahmin raporu bulunamadı.')
  const actionByStatus: Record<Extract<WastePredictionStatus, 'REVIEWED' | 'ARCHIVED'>, WastePredictionHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendWastePredictionHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${WASTE_PREDICTION_STATUS_LABELS[status]} durumuna alındı.`
  )
  saveWastePredictionReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordWastePredictionOutput = (
  reportId: string,
  action: Extract<WastePredictionHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadWastePredictionReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Fire tahmin raporu bulunamadı.')
  const nextReport = appendWastePredictionHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} çıktı penceresi açıldı.`
  )
  saveWastePredictionReports(upsertReport(reports, nextReport))
  return nextReport
}

export const WastePredictionService = {
  createDefaultFilters: createDefaultWastePredictionFilters,
  createDefaultInput: createDefaultWastePredictionReportInput,
  getNextNo: getNextWastePredictionNo,
  save: saveWastePredictionReports,
  list: loadWastePredictionReports,
  evaluate: evaluateWastePredictionReport,
  add: addWastePredictionReport,
  filter: filterWastePredictionReports,
  updateStatus: updateWastePredictionReportStatus,
  recordOutput: recordWastePredictionOutput,
  statistics: createWastePredictionStatistics,
  rules: {
    list: listWastePredictionRules
  }
}
