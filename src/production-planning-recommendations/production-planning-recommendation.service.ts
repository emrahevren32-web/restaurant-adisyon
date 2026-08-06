import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type { MachineCapacity } from '../capacity-planning/capacity-planning.types'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import {
  getDecisionIndexedRecord,
  setDecisionIndexedRecord
} from '../read-model/decision-indexed-storage.service'
import { loadEmployees } from '../storage'
import type { Branch, Employee } from '../types'
import {
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES,
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISKS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUSES,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPES,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS
} from './production-planning-recommendation.constants'
import {
  appendProductionPlanningRecommendationHistory,
  createProductionPlanningRecommendationHistory
} from './production-planning-recommendation-history.service'
import { createProductionPlanningRecommendationStatistics } from './production-planning-recommendation-statistics.service'
import type {
  ProductionPlanningRecommendationAlternative,
  ProductionPlanningRecommendationFilters,
  ProductionPlanningRecommendationHistory,
  ProductionPlanningRecommendationHistoryAction,
  ProductionPlanningRecommendationItem,
  ProductionPlanningRecommendationLinkedEntity,
  ProductionPlanningRecommendationPriority,
  ProductionPlanningRecommendationReport,
  ProductionPlanningRecommendationReportCreateInput,
  ProductionPlanningRecommendationRisk,
  ProductionPlanningRecommendationRule,
  ProductionPlanningRecommendationSourceModule,
  ProductionPlanningRecommendationStatus,
  ProductionPlanningRecommendationType
} from './production-planning-recommendation.types'

export {
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES,
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISKS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUSES,
  PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPES,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS
} from './production-planning-recommendation.constants'

export const PRODUCTION_PLANNING_RECOMMENDATION_STORAGE_KEY = 'ra_production_planning_recommendation_records'

type RawProductionPlanningRecommendationReport = Partial<Record<keyof ProductionPlanningRecommendationReport, unknown>> & Record<string, unknown>
type RawProductionPlanningRecommendationItem = Partial<Record<keyof ProductionPlanningRecommendationItem, unknown>> & Record<string, unknown>
type RawProductionPlanningRecommendationRule = Partial<Record<keyof ProductionPlanningRecommendationRule, unknown>> & Record<string, unknown>

type RecommendationContext = {
  sourceNo: string
  workOrderId: string
  workOrderNo: string
  productId: string
  productName: string
  recipeId: string
  recipeName: string
  branchId: string
  branchName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  plannedQuantity: number
  unit: string
  estimatedMinutes: number
  currentLineUtilizationPercent: number
  currentMachineUtilizationPercent: number
  fireRiskPercent: number
  lotSktSummary: string
  haccpCriticalPoint: string
  baseDate: string
}

const REPORT_NO_PREFIX = 'PPR'
const REPORT_NO_PADDING = 6
const SEED_RECOMMENDATION_COUNT = 160

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

const parseSafeDate = (
  value: unknown,
  fallbackValue: unknown = getTodayKey()
) => {
  const text = normalizeText(value)
  const fallbackText = normalizeText(fallbackValue) || getTodayKey()
  const textDateKey = text && /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
  const fallbackDateKey = /^\d{4}-\d{2}-\d{2}/.test(fallbackText) ? fallbackText.slice(0, 10) : ''
  const candidates = [
    text,
    text && !text.includes('T') ? `${text}T00:00:00` : '',
    textDateKey ? `${textDateKey}T00:00:00` : '',
    fallbackText,
    fallbackText && !fallbackText.includes('T') ? `${fallbackText}T00:00:00` : '',
    fallbackDateKey ? `${fallbackDateKey}T00:00:00` : '',
    `${getTodayKey()}T00:00:00`
  ].filter(Boolean)

  for(const candidate of candidates){
    const date = new Date(candidate)
    if(!Number.isNaN(date.getTime())) return date
  }

  return new Date()
}

const toDateKey = (
  value: unknown,
  fallbackValue: unknown = getTodayKey()
) => parseSafeDate(value, fallbackValue).toLocaleDateString('sv-SE')

const toDateTimeIso = (
  value: unknown,
  fallbackValue: unknown = getTodayKey()
) => parseSafeDate(value, fallbackValue).toISOString()

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = parseSafeDate(dateValue)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addMinutes = (
  value: string,
  minutes: number
) => {
  const date = parseSafeDate(value)
  date.setMinutes(date.getMinutes() + Math.max(15, Math.round(minutes)))
  return date.toISOString()
}

const createDateTime = (
  dateValue: string,
  index: number
) => {
  const date = parseSafeDate(dateValue)
  date.setHours(6 + (index % 12), (index % 4) * 15, 0, 0)
  return date.toISOString()
}

const getNextProductionPlanningRecommendationNo = (
  records: Pick<ProductionPlanningRecommendationReport, 'reportNo'>[],
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

const isMaintenanceStatus = (
  value: string | undefined
) => normalizeSearchText(value).includes('bak')

const isBusyStatus = (
  value: string | undefined
) => normalizeSearchText(value).includes('yo')

const isPassiveStatus = (
  value: string | undefined
) => normalizeSearchText(value).includes('pas')

const mapType = (value: unknown): ProductionPlanningRecommendationType => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanningRecommendationType
  return PRODUCTION_PLANNING_RECOMMENDATION_TYPES.includes(normalized) ? normalized : 'BALANCE_CAPACITY'
}

const mapStatus = (value: unknown): ProductionPlanningRecommendationStatus => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanningRecommendationStatus
  return PRODUCTION_PLANNING_RECOMMENDATION_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapPriority = (value: unknown): ProductionPlanningRecommendationPriority => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanningRecommendationPriority
  return PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const mapRisk = (value: unknown): ProductionPlanningRecommendationRisk => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanningRecommendationRisk
  return PRODUCTION_PLANNING_RECOMMENDATION_RISKS.includes(normalized) ? normalized : 'LOW'
}

export const createDefaultProductionPlanningRecommendationFilters = (): ProductionPlanningRecommendationFilters => ({
  branchId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  productId: ALL_FILTER,
  recipeId: ALL_FILTER,
  workOrderId: ALL_FILTER,
  risk: ALL_FILTER,
  priority: ALL_FILTER,
  recommendationType: ALL_FILTER,
  employeeId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultProductionPlanningRecommendationReportInput = (
  responsiblePerson = 'Üretim Planlama Öneri Motoru'
): ProductionPlanningRecommendationReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

export const listProductionPlanningRecommendationRules = (): ProductionPlanningRecommendationRule[] => (
  PRODUCTION_PLANNING_RECOMMENDATION_TYPES.map(type => ({
    id: `production-planning-recommendation-${type.toLocaleLowerCase('en-US').replace(/_/g, '-')}`,
    code: `PPR-${type}`,
    type,
    title: PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type],
    description: `${PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type]} karar destek kuralı.`,
    sourceModule: getSourceModuleForType(type),
    baseRisk: getBaseRiskForType(type),
    priority: getPriorityFromRisk(getBaseRiskForType(type), type),
    thresholdLabel: getThresholdLabelForType(type),
    enabled: true
  }))
)

const getSourceModuleForType = (
  type: ProductionPlanningRecommendationType
): ProductionPlanningRecommendationSourceModule => {
  if(type === 'WAIT_PURCHASE') return 'PurchaseRecommendations'
  if(type === 'WAIT_SHIPMENT') return 'ShipmentPlanning'
  if(type === 'ALTERNATIVE_RECIPE') return 'Recipe'
  if(type === 'REPLAN_WASTE_RISK') return 'Quality'
  if(type === 'CHANGE_MACHINE') return 'MachineScheduling'
  if(type === 'REALLOCATE_PERSONNEL' || type === 'CHANGE_SHIFT') return 'WorkforcePlanning'
  if(type === 'CHANGE_LINE' || type === 'BALANCE_CAPACITY' || type === 'ALTERNATIVE_WORK_CENTER') return 'CapacityPlanning'
  return 'ProductionPlanning'
}

const getBaseRiskForType = (
  type: ProductionPlanningRecommendationType
): ProductionPlanningRecommendationRisk => {
  if(type === 'STOP_PRODUCTION') return 'CRITICAL'
  if(type === 'WAIT_PURCHASE' || type === 'REPLAN_WASTE_RISK') return 'HIGH'
  if(type === 'BALANCE_CAPACITY' || type === 'CHANGE_MACHINE' || type === 'CHANGE_LINE') return 'HIGH'
  if(type === 'POSTPONE_PRODUCTION' || type === 'WAIT_SHIPMENT') return 'MEDIUM'
  return 'LOW'
}

const getPriorityFromRisk = (
  risk: ProductionPlanningRecommendationRisk,
  type: ProductionPlanningRecommendationType
): ProductionPlanningRecommendationPriority => {
  if(risk === 'CRITICAL' || type === 'STOP_PRODUCTION') return 'URGENT'
  if(risk === 'HIGH') return 'HIGH'
  if(risk === 'MEDIUM') return 'NORMAL'
  return 'LOW'
}

const getThresholdLabelForType = (
  type: ProductionPlanningRecommendationType
) => {
  if(type === 'BALANCE_CAPACITY') return 'Hat doluluğu %90 üzeri veya boş kapasite farkı %20 üzeri'
  if(type === 'REDUCE_SETUP_TIME') return 'Setup süresi 20 dk üzeri veya aynı ürün ardışıklığı mümkün'
  if(type === 'CHANGE_LINE') return 'Alternatif hatta en az 60 dk boş kapasite'
  if(type === 'WAIT_PURCHASE') return 'Hammadde stok veya açık satın alma sinyali'
  if(type === 'WAIT_SHIPMENT') return 'Sevkiyat planı üretim teslim tarihinden sapıyor'
  if(type === 'REPLAN_WASTE_RISK') return 'Fire/SKT/HACCP risk skoru yüksek'
  return 'Read-model üretim planlama sinyali'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): ProductionPlanningRecommendationHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as ProductionPlanningRecommendationHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Üretim planlama öneri raporu güncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: toDateTimeIso(history.createdAt)
  }))
}

const normalizeLinkedEntities = (
  value: unknown
): ProductionPlanningRecommendationLinkedEntity[] => {
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
): ProductionPlanningRecommendationAlternative[] => {
  if(!Array.isArray(value)) return []

  return ensureUniqueAlternativeIds(value.filter(isRecord).map((record, index) => ({
    id: normalizeText(record.id) || `alternative_${index + 1}`,
    code: normalizeText(record.code),
    name: normalizeText(record.name) || normalizeText(record.code) || 'Alternatif',
    currentUtilizationPercent: normalizeNumber(record.currentUtilizationPercent),
    expectedUtilizationPercent: normalizeNumber(record.expectedUtilizationPercent),
    availableMinutes: normalizeNumber(record.availableMinutes),
    reason: normalizeText(record.reason)
  })))
}

function ensureUniqueAlternativeIds(
  alternatives: ProductionPlanningRecommendationAlternative[],
  prefix = 'alternative'
): ProductionPlanningRecommendationAlternative[] {
  const seen = new Map<string, number>()

  return alternatives.map((alternative, index) => {
    const baseId = normalizeText(alternative.id) || `${prefix}_${index + 1}`
    const count = seen.get(baseId) || 0
    seen.set(baseId, count + 1)

    if(count === 0) return { ...alternative, id: baseId }

    return {
      ...alternative,
      id: `${baseId}_${count + 1}`
    }
  })
}

const normalizeRule = (
  value: RawProductionPlanningRecommendationRule,
  index: number
): ProductionPlanningRecommendationRule => ({
  id: normalizeText(value.id) || `production_planning_recommendation_rule_${index + 1}`,
  code: normalizeText(value.code) || `PPR-RULE-${index + 1}`,
  type: mapType(value.type),
  title: normalizeText(value.title) || 'Üretim Planlama Öneri Kuralı',
  description: normalizeText(value.description),
  sourceModule: normalizeText(value.sourceModule) as ProductionPlanningRecommendationSourceModule || 'ReadModel',
  baseRisk: mapRisk(value.baseRisk),
  priority: mapPriority(value.priority),
  thresholdLabel: normalizeText(value.thresholdLabel),
  enabled: value.enabled !== false
})

const normalizeItem = (
  value: RawProductionPlanningRecommendationItem,
  reportId: string,
  reportNo: string,
  index: number
): ProductionPlanningRecommendationItem => ({
  id: normalizeText(value.id) || `${reportId}_item_${index + 1}`,
  reportId,
  reportNo,
  recommendationNo: normalizeText(value.recommendationNo) || `${reportNo}-${String(index + 1).padStart(3, '0')}`,
  ruleId: normalizeText(value.ruleId),
  recommendationType: mapType(value.recommendationType),
  priority: mapPriority(value.priority),
  risk: mapRisk(value.risk),
  title: normalizeText(value.title) || 'Üretim planlama önerisi',
  description: normalizeText(value.description),
  reason: normalizeText(value.reason),
  analysisResult: normalizeText(value.analysisResult),
  riskExplanation: normalizeText(value.riskExplanation),
  action: normalizeText(value.action),
  expectedGain: normalizeText(value.expectedGain),
  expectedImpact: normalizeText(value.expectedImpact),
  ownerRole: normalizeText(value.ownerRole) || 'Üretim Planlama',
  workOrderId: normalizeText(value.workOrderId),
  workOrderNo: normalizeText(value.workOrderNo),
  productId: normalizeText(value.productId),
  productName: normalizeText(value.productName),
  recipeId: normalizeText(value.recipeId),
  recipeName: normalizeText(value.recipeName),
  productionLineId: normalizeText(value.productionLineId),
  productionLineName: normalizeText(value.productionLineName),
  machineId: normalizeText(value.machineId),
  machineCode: normalizeText(value.machineCode),
  machineName: normalizeText(value.machineName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  employeeId: normalizeText(value.employeeId),
  employeeName: normalizeText(value.employeeName),
  plannedStartAt: toDateTimeIso(value.plannedStartAt),
  plannedEndAt: toDateTimeIso(value.plannedEndAt, value.plannedStartAt),
  plannedQuantity: Math.max(0, normalizeNumber(value.plannedQuantity)),
  unit: normalizeText(value.unit) || 'kg',
  currentLineUtilizationPercent: normalizeNumber(value.currentLineUtilizationPercent),
  expectedLineUtilizationPercent: normalizeNumber(value.expectedLineUtilizationPercent),
  currentMachineUtilizationPercent: normalizeNumber(value.currentMachineUtilizationPercent),
  expectedCapacityGainPercent: normalizeNumber(value.expectedCapacityGainPercent),
  expectedCapacityGainMinutes: normalizeNumber(value.expectedCapacityGainMinutes),
  expectedTimeGainMinutes: normalizeNumber(value.expectedTimeGainMinutes),
  setupTimeGainMinutes: normalizeNumber(value.setupTimeGainMinutes),
  wasteReductionPercent: normalizeNumber(value.wasteReductionPercent),
  fireRiskPercent: normalizeNumber(value.fireRiskPercent),
  bottleneck: value.bottleneck === true,
  lineBalancingScenario: value.lineBalancingScenario === true,
  setupOptimizationScenario: value.setupOptimizationScenario === true,
  alternativeLineScenario: value.alternativeLineScenario === true,
  delayedProduction: value.delayedProduction === true,
  riskScore: normalizeNumber(value.riskScore),
  confidenceScore: normalizeNumber(value.confidenceScore),
  sourceModules: Array.isArray(value.sourceModules)
    ? value.sourceModules.map(module => normalizeText(module) as ProductionPlanningRecommendationSourceModule).filter(Boolean)
    : [],
  sourceNo: normalizeText(value.sourceNo),
  affectedWorkOrders: normalizeLinkedEntities(value.affectedWorkOrders),
  affectedMachines: normalizeLinkedEntities(value.affectedMachines),
  affectedPersonnel: normalizeLinkedEntities(value.affectedPersonnel),
  alternativeLines: normalizeAlternatives(value.alternativeLines),
  alternativeMachines: normalizeAlternatives(value.alternativeMachines),
  lotSktSummary: normalizeText(value.lotSktSummary),
  haccpCriticalPoint: normalizeText(value.haccpCriticalPoint),
  createdAt: toDateTimeIso(value.createdAt)
})

const normalizeReport = (
  value: RawProductionPlanningRecommendationReport,
  index: number
): ProductionPlanningRecommendationReport => {
  const reportDate = toDateKey(value.reportDate)
  const reportNo = normalizeText(value.reportNo) || getNextProductionPlanningRecommendationNo([], reportDate, index)
  const id = normalizeText(value.id) || `production_planning_recommendation_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = toDateTimeIso(value.createdAt)
  const actorName = normalizeText(value.responsiblePerson) || 'Üretim Planlama Öneri Motoru'
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawProductionPlanningRecommendationItem, id, reportNo, itemIndex))
    : []
  const rules = Array.isArray(value.rules)
    ? value.rules.filter(isRecord).map((rule, ruleIndex) => normalizeRule(rule as RawProductionPlanningRecommendationRule, ruleIndex))
    : listProductionPlanningRecommendationRules()
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
      : [createProductionPlanningRecommendationHistory(id, 'CREATED', actorName, `${reportNo} üretim planlama öneri read-model olarak oluşturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'production-planning-recommendation-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: toDateTimeIso(value.updatedAt, createdAt)
  }
}

const getBranchForName = (
  branches: Branch[],
  branchName: string
) => branches.find(branch => matchesName(branch.name, branchName)) || branches[0]

const getProductId = (
  sourceData: KpiSourceData,
  productName: string,
  fallbackId: string
) => sourceData.productRefs.find(product => matchesName(product.name, productName))?.id || fallbackId

const getRecipeForProduct = (
  sourceData: KpiSourceData,
  productName: string,
  index: number
) => sourceData.recipeRecords.find(recipe => matchesName(recipe.productName, productName) || matchesName(recipe.recipeName, productName))
  || sourceData.recipeRecords[index % Math.max(1, sourceData.recipeRecords.length)]

const getLineForProduct = (
  sourceData: KpiSourceData,
  productName: string,
  index: number
) => sourceData.productionLines.find(line => matchesName(line.type, productName) || matchesName(line.name, productName))
  || sourceData.productionLines[index % Math.max(1, sourceData.productionLines.length)]

const createFallbackMachine = (
  sourceData: KpiSourceData,
  index: number
): MachineCapacity => {
  const line = sourceData.productionLines[index % Math.max(1, sourceData.productionLines.length)]
  return {
    id: `fallback_machine_${index + 1}`,
    planId: 'fallback_capacity_plan',
    machineId: `machine_${line?.id || index + 1}`,
    machineCode: `${line?.code || 'M'}-${index % 3 + 1}`,
    machineName: `${line?.name || 'Üretim'} Makinesi ${index % 3 + 1}`,
    productionLineId: line?.id || '',
    productionLineName: line?.name || 'Üretim Hattı',
    workCenterId: line?.id ? `${line.id}_wc` : 'work_center',
    workCenterName: `${line?.name || 'Üretim'} Merkezi`,
    shift: 'Sabah',
    active: true,
    maintenanceClosed: isMaintenanceStatus(line?.status),
    workingMinutes: 480,
    availableMinutes: 420,
    plannedProductionMinutes: 280,
    recipePreparationMinutes: 20,
    setupMinutes: 22,
    cleaningMinutes: 14,
    warehousePreparationMinutes: 10,
    maintenanceMinutes: isMaintenanceStatus(line?.status) ? 80 : 0,
    netProductionMinutes: 280,
    totalLoadMinutes: 326,
    idleMinutes: 94,
    overloadMinutes: isBusyStatus(line?.status) ? 40 : 0,
    utilizationPercent: line?.estimatedUtilization || 72,
    bottleneck: isBusyStatus(line?.status),
    riskLevel: isBusyStatus(line?.status) ? 'HIGH' : 'NORMAL',
    recommendations: []
  }
}

const getMachineForLine = (
  machines: MachineCapacity[],
  sourceData: KpiSourceData,
  lineId: string,
  index: number
) => machines.find(machine => machine.productionLineId === lineId)
  || machines[index % Math.max(1, machines.length)]
  || createFallbackMachine(sourceData, index)

const getEmployee = (
  employees: Employee[],
  branchId: string,
  index: number
) => employees.find(employee => employee.branchId === branchId && employee.isActive)
  || employees.filter(employee => employee.isActive)[index % Math.max(1, employees.filter(employee => employee.isActive).length)]
  || employees[index % Math.max(1, employees.length)]
  || null

const createLotSummary = (
  sourceData: KpiSourceData,
  productId: string,
  productName: string,
  index: number
) => {
  const lots = sourceData.inventoryLots.filter(lot => (
    lot.productId === productId
    || sourceData.productRefs.some(product => product.id === lot.productId && matchesName(product.name, productName))
  ))
  const lot = lots[index % Math.max(1, lots.length)]
  if(!lot) return 'Lot / SKT riski izleniyor.'

  const date = new Date(`${lot.expiryDate}T00:00:00`)
  const today = new Date(`${getTodayKey()}T00:00:00`)
  const dayDiff = Number.isNaN(date.getTime()) ? 999 : Math.ceil((date.getTime() - today.getTime()) / 86400000)
  return `${lot.lotNo} / ${formatNumber(lot.remainingQuantity, 1)} ${lot.unit} / SKT ${lot.expiryDate}${dayDiff <= 7 ? ' kritik' : ''}`
}

const createHaccpPoint = (
  sourceData: KpiSourceData,
  index: number
) => {
  const ccp = sourceData.haccpRecords.flatMap(record => record.criticalControlPoints)[index % Math.max(1, sourceData.haccpRecords.flatMap(record => record.criticalControlPoints).length)]
  return ccp ? `${ccp.name} / ${ccp.criticalLimit}` : 'HACCP kritik noktası takipte.'
}

const createContextsFromPlanning = (
  sourceData: KpiSourceData,
  machines: MachineCapacity[],
  employees: Employee[]
): RecommendationContext[] => {
  const planningPlans = ProductionPlanningService.list(sourceData)

  return planningPlans.flatMap(plan => plan.items.map((item, index) => {
    const line = sourceData.productionLines.find(record => record.id === item.productionLineId) || getLineForProduct(sourceData, item.productName, index)
    const machine = getMachineForLine(machines, sourceData, item.productionLineId || line?.id || '', index)
    const workOrder = sourceData.productionOrders.find(order => order.lines.some(lineItem => matchesName(lineItem.productName, item.productName)))
    const employee = getEmployee(employees, plan.branchId, index)
    const productId = getProductId(sourceData, item.productName, item.productId)

    return {
      sourceNo: plan.planNo,
      workOrderId: workOrder?.id || plan.id,
      workOrderNo: workOrder?.workOrderNo || plan.planNo,
      productId,
      productName: item.productName,
      recipeId: item.recipeId,
      recipeName: item.recipeName,
      branchId: plan.branchId,
      branchName: plan.branchName,
      productionLineId: item.productionLineId || line?.id || '',
      productionLineName: item.productionLineName || line?.name || 'Üretim Hattı',
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      employeeId: employee?.id || '',
      employeeName: employee?.fullName || line?.activeOperator || 'Vardiya Ekibi',
      plannedQuantity: item.produceQuantity,
      unit: item.unit,
      estimatedMinutes: item.estimatedMinutes,
      currentLineUtilizationPercent: item.capacityUsagePercent || line?.estimatedUtilization || machine.utilizationPercent,
      currentMachineUtilizationPercent: machine.utilizationPercent || item.capacityUsagePercent,
      fireRiskPercent: item.wastePercent,
      lotSktSummary: createLotSummary(sourceData, productId, item.productName, index),
      haccpCriticalPoint: createHaccpPoint(sourceData, index),
      baseDate: plan.planDate
    }
  }))
}

const createContextsFromWorkOrders = (
  sourceData: KpiSourceData,
  machines: MachineCapacity[],
  employees: Employee[],
  offset: number
): RecommendationContext[] => sourceData.productionOrders.flatMap((order, orderIndex) => order.lines.map((lineItem, lineIndex) => {
  const index = offset + orderIndex + lineIndex
  const recipe = getRecipeForProduct(sourceData, lineItem.productName, index)
  const line = getLineForProduct(sourceData, lineItem.productName, index)
  const machine = getMachineForLine(machines, sourceData, line?.id || '', index)
  const branch = getBranchForName(sourceData.branches, order.branch)
  const employee = getEmployee(employees, branch?.id || '', index)
  const productId = getProductId(sourceData, lineItem.productName, lineItem.id)

  return {
    sourceNo: order.workOrderNo,
    workOrderId: order.id,
    workOrderNo: order.workOrderNo,
    productId,
    productName: lineItem.productName,
    recipeId: recipe?.id || '',
    recipeName: recipe?.recipeName || 'Standart Reçete',
    branchId: branch?.id || '',
    branchName: branch?.name || order.branch || 'Merkez',
    productionLineId: line?.id || machine.productionLineId,
    productionLineName: line?.name || machine.productionLineName || 'Üretim Hattı',
    machineId: machine.machineId,
    machineCode: machine.machineCode,
    machineName: machine.machineName,
    employeeId: employee?.id || '',
    employeeName: employee?.fullName || line?.activeOperator || 'Vardiya Ekibi',
    plannedQuantity: lineItem.quantity,
    unit: lineItem.unit,
    estimatedMinutes: order.estimatedMinutes || 90,
    currentLineUtilizationPercent: line?.estimatedUtilization || machine.utilizationPercent || 70,
    currentMachineUtilizationPercent: machine.utilizationPercent || line?.estimatedUtilization || 70,
    fireRiskPercent: recipe?.firePercent || 4,
    lotSktSummary: createLotSummary(sourceData, productId, lineItem.productName, index),
    haccpCriticalPoint: createHaccpPoint(sourceData, index),
    baseDate: order.deliveryDate || getTodayKey()
  }
}))

const createFallbackContexts = (
  sourceData: KpiSourceData,
  machines: MachineCapacity[],
  employees: Employee[]
): RecommendationContext[] => {
  const branch = sourceData.branches[0]

  return sourceData.recipeRecords.slice(0, 12).map((recipe, index) => {
    const line = getLineForProduct(sourceData, recipe.productName, index)
    const machine = getMachineForLine(machines, sourceData, line?.id || '', index)
    const employee = getEmployee(employees, branch?.id || '', index)
    const productId = getProductId(sourceData, recipe.productName, recipe.id)

    return {
      sourceNo: recipe.code,
      workOrderId: `fallback_work_order_${index + 1}`,
      workOrderNo: `WO-READ-${String(index + 1).padStart(4, '0')}`,
      productId,
      productName: recipe.productName,
      recipeId: recipe.id,
      recipeName: recipe.recipeName,
      branchId: branch?.id || '',
      branchName: branch?.name || 'Merkez',
      productionLineId: line?.id || machine.productionLineId,
      productionLineName: line?.name || machine.productionLineName,
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      employeeId: employee?.id || '',
      employeeName: employee?.fullName || line?.activeOperator || 'Vardiya Ekibi',
      plannedQuantity: recipe.portions || 100,
      unit: 'kg',
      estimatedMinutes: 80 + index * 4,
      currentLineUtilizationPercent: line?.estimatedUtilization || 68,
      currentMachineUtilizationPercent: machine.utilizationPercent || line?.estimatedUtilization || 70,
      fireRiskPercent: recipe.firePercent || 4,
      lotSktSummary: createLotSummary(sourceData, productId, recipe.productName, index),
      haccpCriticalPoint: createHaccpPoint(sourceData, index),
      baseDate: addDays(getTodayKey(), index % 7)
    }
  })
}

const createSourceContexts = (
  sourceData: KpiSourceData
) => {
  const capacityPlans = CapacityPlanningService.list(sourceData)
  const machines = capacityPlans.flatMap(plan => plan.machineCapacities)
  const employees = loadEmployees()
  const planningContexts = createContextsFromPlanning(sourceData, machines, employees)
  const workOrderContexts = createContextsFromWorkOrders(sourceData, machines, employees, planningContexts.length)
  const fallbackContexts = createFallbackContexts(sourceData, machines, employees)

  return [...planningContexts, ...workOrderContexts, ...fallbackContexts].filter(context => context.productName)
}

const getScenario = (
  index: number
) => {
  if(index < 25){
    const bottleneckTypes: ProductionPlanningRecommendationType[] = ['BALANCE_CAPACITY', 'CHANGE_MACHINE', 'CHANGE_LINE', 'CHANGE_SHIFT', 'SPLIT_PRODUCTION']
    return {
      type: bottleneckTypes[index % bottleneckTypes.length],
      bottleneck: true,
      lineBalancingScenario: false,
      setupOptimizationScenario: false,
      alternativeLineScenario: false
    }
  }

  if(index < 55){
    return {
      type: 'BALANCE_CAPACITY' as ProductionPlanningRecommendationType,
      bottleneck: index % 5 === 0,
      lineBalancingScenario: true,
      setupOptimizationScenario: false,
      alternativeLineScenario: false
    }
  }

  if(index < 75){
    return {
      type: 'REDUCE_SETUP_TIME' as ProductionPlanningRecommendationType,
      bottleneck: false,
      lineBalancingScenario: false,
      setupOptimizationScenario: true,
      alternativeLineScenario: false
    }
  }

  if(index < 95){
    return {
      type: (index % 2 === 0 ? 'CHANGE_LINE' : 'ALTERNATIVE_WORK_CENTER') as ProductionPlanningRecommendationType,
      bottleneck: index % 4 === 0,
      lineBalancingScenario: false,
      setupOptimizationScenario: false,
      alternativeLineScenario: true
    }
  }

  const type = PRODUCTION_PLANNING_RECOMMENDATION_TYPES[index % PRODUCTION_PLANNING_RECOMMENDATION_TYPES.length]
  return {
    type,
    bottleneck: type === 'STOP_PRODUCTION' || type === 'BALANCE_CAPACITY',
    lineBalancingScenario: type === 'BALANCE_CAPACITY',
    setupOptimizationScenario: type === 'REDUCE_SETUP_TIME' || type === 'GROUP_SAME_PRODUCTS',
    alternativeLineScenario: type === 'CHANGE_LINE' || type === 'ALTERNATIVE_WORK_CENTER'
  }
}

const getRisk = (
  scenario: ReturnType<typeof getScenario>,
  context: RecommendationContext,
  index: number
): ProductionPlanningRecommendationRisk => {
  if(scenario.bottleneck && index < 25) return 'CRITICAL'
  if(scenario.type === 'STOP_PRODUCTION') return 'CRITICAL'
  if(context.currentLineUtilizationPercent >= 96 || context.currentMachineUtilizationPercent >= 96) return 'CRITICAL'
  if(scenario.type === 'WAIT_PURCHASE' || scenario.type === 'REPLAN_WASTE_RISK') return index % 3 === 0 ? 'CRITICAL' : 'HIGH'
  if(scenario.lineBalancingScenario || scenario.alternativeLineScenario) return index % 4 === 0 ? 'CRITICAL' : 'HIGH'
  if(scenario.setupOptimizationScenario) return 'MEDIUM'
  return getBaseRiskForType(scenario.type)
}

const getActionText = (
  type: ProductionPlanningRecommendationType,
  context: RecommendationContext,
  alternativeLineName: string,
  alternativeMachineName: string
) => {
  if(type === 'ADVANCE_PRODUCTION') return `${context.productName} üretimini ilk uygun vardiya penceresine öne al.`
  if(type === 'POSTPONE_PRODUCTION') return `${context.productName} üretimini hammadde ve sevkiyat sinyali netleşene kadar ertele.`
  if(type === 'CHANGE_LINE') return `${context.productionLineName} yerine ${alternativeLineName || 'alternatif hat'} üzerinde manuel planlama değerlendir.`
  if(type === 'CHANGE_MACHINE') return `${context.machineName} yükünü ${alternativeMachineName || 'alternatif makine'} ile karşılaştır.`
  if(type === 'CHANGE_SHIFT') return `${context.productName} işini yoğun vardiyadan daha boş vardiyaya kaydır.`
  if(type === 'SPLIT_PRODUCTION') return `${context.productName} üretimini iki partiye böl ve darboğaz süresini azalt.`
  if(type === 'GROUP_SAME_PRODUCTS') return `${context.recipeName} kullanan benzer ürünleri aynı blokta grupla.`
  if(type === 'REDUCE_SETUP_TIME') return `${context.recipeName} setup adımlarını ardışık üretimle kısalt.`
  if(type === 'BALANCE_CAPACITY') return `${context.productionLineName} yükünü alternatif hat ve vardiya kapasitesiyle dengele.`
  if(type === 'REALLOCATE_PERSONNEL') return `${context.employeeName} ve vardiya ekibi görev dağılımını yeniden dengele.`
  if(type === 'ALTERNATIVE_RECIPE') return `${context.productName} için aktif alternatif reçete uygunluğunu kontrol et.`
  if(type === 'ALTERNATIVE_WORK_CENTER') return `${context.productName} için alternatif üretim merkezi kapasitesini karşılaştır.`
  if(type === 'STOP_PRODUCTION') return `${context.productName} üretimini kalite, SKT veya HACCP riski çözülene kadar durdurmayı değerlendir.`
  if(type === 'WAIT_PURCHASE') return `${context.productName} üretimini kritik hammadde satın alma sonucu gelene kadar beklet.`
  if(type === 'WAIT_SHIPMENT') return `${context.productName} üretimini sevkiyat hazırlığıyla senkronize et.`
  return `${context.productName} üretimini fire riski nedeniyle yeniden planla.`
}

const getReasonText = (
  type: ProductionPlanningRecommendationType,
  context: RecommendationContext,
  risk: ProductionPlanningRecommendationRisk
) => {
  const base = `${context.workOrderNo} için ${context.productionLineName} doluluğu ${formatPercent(context.currentLineUtilizationPercent)}, ${context.machineCode} makine kullanımı ${formatPercent(context.currentMachineUtilizationPercent)}.`
  if(type === 'WAIT_PURCHASE') return `${base} Reçete ve stok sinyalleri satın alma bekleme kararını güçlendiriyor.`
  if(type === 'WAIT_SHIPMENT') return `${base} Sevkiyat planı ile üretim bitiş aralığı aynı güne sıkışıyor.`
  if(type === 'REPLAN_WASTE_RISK') return `${base} Fire tahmini ${formatPercent(context.fireRiskPercent)} ve ${context.lotSktSummary}.`
  if(type === 'STOP_PRODUCTION') return `${base} Risk seviyesi ${PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[risk]}; HACCP kritik noktası: ${context.haccpCriticalPoint}.`
  return base
}

const getAnalysisText = (
  type: ProductionPlanningRecommendationType,
  context: RecommendationContext,
  expectedCapacityGainPercent: number,
  expectedTimeGainMinutes: number
) => `${PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type]} önerisi; üretim emri, kapasite planı, hat/makine doluluğu, reçete, stok, lot/SKT, HACCP ve sevkiyat sinyalleri birlikte değerlendirilerek üretildi. Beklenen kapasite kazancı ${formatPercent(expectedCapacityGainPercent)}, beklenen süre kazancı ${formatNumber(expectedTimeGainMinutes, 0)} dk.`

const createAlternativeLines = (
  sourceData: KpiSourceData,
  context: RecommendationContext,
  index: number
): ProductionPlanningRecommendationAlternative[] => ensureUniqueAlternativeIds(sourceData.productionLines
  .filter(line => line.id !== context.productionLineId && !isPassiveStatus(line.status))
  .sort((first, second) => first.estimatedUtilization - second.estimatedUtilization)
  .slice(0, 3)
  .map((line, alternativeIndex) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    currentUtilizationPercent: line.estimatedUtilization,
    expectedUtilizationPercent: clamp(line.estimatedUtilization + 6 + alternativeIndex * 2),
    availableMinutes: Math.max(0, roundKpi(480 - line.estimatedUtilization / 100 * 480 - (index % 3) * 12)),
    reason: `${line.type} hattı / ${line.status} / ${formatPercent(line.estimatedUtilization)} doluluk`
  })), 'line_option')

const createAlternativeMachines = (
  sourceData: KpiSourceData,
  context: RecommendationContext,
  machines: MachineCapacity[],
  index: number
): ProductionPlanningRecommendationAlternative[] => {
  const alternatives = machines
    .filter(machine => machine.machineId !== context.machineId && !machine.maintenanceClosed && machine.active)
    .sort((first, second) => first.utilizationPercent - second.utilizationPercent)
    .slice(0, 3)
    .map((machine, alternativeIndex) => ({
      id: machine.machineId,
      code: machine.machineCode,
      name: machine.machineName,
      currentUtilizationPercent: machine.utilizationPercent,
      expectedUtilizationPercent: clamp(machine.utilizationPercent + 5 + alternativeIndex * 2),
      availableMinutes: Math.max(0, machine.idleMinutes || machine.availableMinutes - machine.totalLoadMinutes),
      reason: `${machine.productionLineName} / ${formatPercent(machine.utilizationPercent)} kullanım`
    }))

  if(alternatives.length > 0) return ensureUniqueAlternativeIds(alternatives, 'machine_option')

  return ensureUniqueAlternativeIds(createAlternativeLines(sourceData, context, index).map((line, alternativeIndex) => ({
    ...line,
    id: `${line.id}_machine_option`,
    code: `${line.code}-M${alternativeIndex + 1}`,
    name: `${line.name} Alternatif Makine ${alternativeIndex + 1}`
  })), 'machine_option')
}

const createItem = ({
  context,
  index,
  machines,
  reportId,
  reportNo,
  sourceData
}: {
  context: RecommendationContext
  index: number
  machines: MachineCapacity[]
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
}): ProductionPlanningRecommendationItem => {
  const scenario = getScenario(index)
  const risk = getRisk(scenario, context, index)
  const priority = getPriorityFromRisk(risk, scenario.type)
  const startAt = createDateTime(context.baseDate || getTodayKey(), index)
  const expectedTimeGainMinutes = roundKpi(
    scenario.bottleneck
      ? 45 + (index % 7) * 8
      : scenario.lineBalancingScenario
        ? 32 + (index % 6) * 6
        : scenario.setupOptimizationScenario
          ? 18 + (index % 5) * 5
          : scenario.alternativeLineScenario
            ? 38 + (index % 5) * 7
            : 12 + (index % 6) * 4
  )
  const setupTimeGainMinutes = scenario.setupOptimizationScenario
    ? roundKpi(16 + (index % 6) * 4)
    : scenario.type === 'GROUP_SAME_PRODUCTS'
      ? roundKpi(12 + (index % 5) * 3)
      : 0
  const expectedCapacityGainPercent = roundKpi(
    scenario.bottleneck
      ? 8 + (index % 6)
      : scenario.lineBalancingScenario
        ? 6 + (index % 5)
        : scenario.alternativeLineScenario
          ? 7 + (index % 4)
          : scenario.setupOptimizationScenario
            ? 3 + (index % 4)
            : 2 + (index % 5)
  )
  const expectedCapacityGainMinutes = roundKpi(expectedTimeGainMinutes * (1.1 + expectedCapacityGainPercent / 100))
  const wasteReductionPercent = scenario.type === 'REPLAN_WASTE_RISK' || context.fireRiskPercent >= 7
    ? roundKpi(Math.min(12, Math.max(2, context.fireRiskPercent * 0.45 + index % 3)))
    : scenario.setupOptimizationScenario
      ? roundKpi(1 + (index % 3))
      : 0
  const currentLineUtilizationPercent = clamp(
    scenario.bottleneck
      ? Math.max(context.currentLineUtilizationPercent, 94 + index % 6)
      : scenario.lineBalancingScenario
        ? Math.max(context.currentLineUtilizationPercent, 86 + index % 8)
        : context.currentLineUtilizationPercent
  )
  const expectedLineUtilizationPercent = clamp(currentLineUtilizationPercent - expectedCapacityGainPercent + (scenario.type === 'WAIT_PURCHASE' ? 0 : 2))
  const currentMachineUtilizationPercent = clamp(
    scenario.bottleneck
      ? Math.max(context.currentMachineUtilizationPercent, 93 + index % 7)
      : context.currentMachineUtilizationPercent
  )
  const riskScore = clamp(
    risk === 'CRITICAL' ? 88 + index % 12 : risk === 'HIGH' ? 68 + index % 17 : risk === 'MEDIUM' ? 42 + index % 18 : 18 + index % 20
  )
  const confidenceScore = clamp(72 + expectedCapacityGainPercent * 1.4 + (scenario.bottleneck ? 5 : 0) - (risk === 'LOW' ? 2 : 0), 55, 98)
  const alternativeLines = createAlternativeLines(sourceData, context, index)
  const alternativeMachines = createAlternativeMachines(sourceData, context, machines, index)
  const action = getActionText(scenario.type, context, alternativeLines[0]?.name || '', alternativeMachines[0]?.name || '')
  const reason = getReasonText(scenario.type, context, risk)
  const delayedProduction = ['POSTPONE_PRODUCTION', 'WAIT_PURCHASE', 'WAIT_SHIPMENT', 'STOP_PRODUCTION', 'REPLAN_WASTE_RISK'].includes(scenario.type)
  const affectedWorkOrders = createAffectedWorkOrders(sourceData, context)

  return {
    id: `${reportId}_item_${index + 1}`,
    reportId,
    reportNo,
    recommendationNo: `${reportNo}-${String(index + 1).padStart(3, '0')}`,
    ruleId: `production-planning-recommendation-${scenario.type.toLocaleLowerCase('en-US').replace(/_/g, '-')}`,
    recommendationType: scenario.type,
    priority,
    risk,
    title: `${context.productName} için ${PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[scenario.type]}`,
    description: 'Karar Destek Motoru üretim emri, kapasite, vardiya, makine, reçete, stok, satın alma, tahminleme, fire, sevkiyat, lot/SKT ve HACCP sinyallerini birlikte değerlendirdi.',
    reason,
    analysisResult: getAnalysisText(scenario.type, context, expectedCapacityGainPercent, expectedTimeGainMinutes),
    riskExplanation: `${PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[risk]} risk; hat ${formatPercent(currentLineUtilizationPercent)}, makine ${formatPercent(currentMachineUtilizationPercent)}, fire ${formatPercent(context.fireRiskPercent)}. ${context.lotSktSummary}`,
    action,
    expectedGain: `${formatPercent(expectedCapacityGainPercent)} kapasite / ${formatNumber(expectedTimeGainMinutes, 0)} dk süre kazancı`,
    expectedImpact: 'Planlama ekibi manuel inceleme ile kapasite kullanımını iyileştirebilir ve gecikme riskini azaltabilir.',
    ownerRole: scenario.type === 'WAIT_PURCHASE'
      ? 'Satın Alma ve Üretim Planlama'
      : scenario.type === 'REPLAN_WASTE_RISK' || scenario.type === 'STOP_PRODUCTION'
        ? 'Üretim ve Kalite'
        : 'Üretim Planlama',
    workOrderId: context.workOrderId,
    workOrderNo: context.workOrderNo,
    productId: context.productId,
    productName: context.productName,
    recipeId: context.recipeId,
    recipeName: context.recipeName,
    productionLineId: context.productionLineId,
    productionLineName: context.productionLineName,
    machineId: context.machineId,
    machineCode: context.machineCode,
    machineName: context.machineName,
    branchId: context.branchId,
    branchName: context.branchName,
    employeeId: context.employeeId,
    employeeName: context.employeeName,
    plannedStartAt: startAt,
    plannedEndAt: addMinutes(startAt, Math.max(30, context.estimatedMinutes)),
    plannedQuantity: roundKpi(context.plannedQuantity),
    unit: context.unit,
    currentLineUtilizationPercent,
    expectedLineUtilizationPercent,
    currentMachineUtilizationPercent,
    expectedCapacityGainPercent,
    expectedCapacityGainMinutes,
    expectedTimeGainMinutes,
    setupTimeGainMinutes,
    wasteReductionPercent,
    fireRiskPercent: context.fireRiskPercent,
    bottleneck: scenario.bottleneck,
    lineBalancingScenario: scenario.lineBalancingScenario,
    setupOptimizationScenario: scenario.setupOptimizationScenario,
    alternativeLineScenario: scenario.alternativeLineScenario,
    delayedProduction,
    riskScore,
    confidenceScore: roundKpi(confidenceScore),
    sourceModules: Array.from(new Set<ProductionPlanningRecommendationSourceModule>([
      'ProductionPlanning',
      'CapacityPlanning',
      'MachineScheduling',
      'WorkforcePlanning',
      'Recipe',
      'Stock',
      'PurchaseRecommendations',
      'Forecasting',
      'ShipmentPlanning',
      'InventoryLots',
      'HACCP',
      getSourceModuleForType(scenario.type)
    ])),
    sourceNo: context.sourceNo,
    affectedWorkOrders,
    affectedMachines: [
      {
        id: context.machineId,
        no: context.machineCode,
        name: context.machineName,
        detail: `${context.productionLineName} / ${formatPercent(currentMachineUtilizationPercent)} kullanım`
      },
      ...alternativeMachines.slice(0, 2).map(machine => ({
        id: machine.id,
        no: machine.code,
        name: machine.name,
        detail: machine.reason
      }))
    ],
    affectedPersonnel: context.employeeId
      ? [{
          id: context.employeeId,
          no: context.employeeId,
          name: context.employeeName,
          detail: `${context.branchName} / ${context.productionLineName}`
        }]
      : [],
    alternativeLines,
    alternativeMachines,
    lotSktSummary: context.lotSktSummary,
    haccpCriticalPoint: context.haccpCriticalPoint,
    createdAt: addMinutes(new Date(`${getTodayKey()}T07:00:00`).toISOString(), index * 11)
  }
}

const createAffectedWorkOrders = (
  sourceData: KpiSourceData,
  context: RecommendationContext
): ProductionPlanningRecommendationLinkedEntity[] => {
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
        id: context.workOrderId,
        no: context.workOrderNo,
        name: context.productName,
        detail: `${context.productionLineName} / ${formatNumber(context.plannedQuantity, 1)} ${context.unit}`
      }]
}

const createProductionPlanningRecommendationItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => {
  const contexts = createSourceContexts(sourceData)
  const capacityPlans = CapacityPlanningService.list(sourceData)
  const machines = capacityPlans.flatMap(plan => plan.machineCapacities)
  const fallbackContexts = contexts.length > 0 ? contexts : createFallbackContexts(sourceData, machines, loadEmployees())

  return Array.from({ length: SEED_RECOMMENDATION_COUNT }).map((_, index) => createItem({
    context: fallbackContexts[index % fallbackContexts.length],
    index,
    machines,
    reportId,
    reportNo,
    sourceData
  }))
}

export const evaluateProductionPlanningRecommendationReport = (
  sourceData: KpiSourceData,
  input: Partial<ProductionPlanningRecommendationReportCreateInput> = {},
  existingReports: ProductionPlanningRecommendationReport[] = [],
  actorName = 'Üretim Planlama Öneri Motoru'
): ProductionPlanningRecommendationReport => {
  const createInput = {
    ...createDefaultProductionPlanningRecommendationReportInput(actorName),
    ...input
  }
  createInput.reportDate = toDateKey(createInput.reportDate)
  const reportNo = getNextProductionPlanningRecommendationNo(existingReports, createInput.reportDate)
  const reportId = `production_planning_recommendation_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()
  const allItems = createProductionPlanningRecommendationItems(sourceData, reportId, reportNo)
  const items = createInput.scope === 'all'
    ? allItems
    : allItems.filter(item => item.recommendationType === createInput.scope)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: createInput.reportDate || getTodayKey(),
    scope: createInput.scope,
    responsiblePerson: createInput.responsiblePerson || actorName,
    description: createInput.description || 'Üretim emirleri, kapasite planı, vardiyalar, makine durumu, reçeteler, stok, satın alma önerileri, tahminleme, fire, sevkiyat planı, lot/SKT ve HACCP kritik noktalarından üretim planlama önerileri üretildi.',
    items,
    rules: listProductionPlanningRecommendationRules(),
    history: [
      createProductionPlanningRecommendationHistory(reportId, 'CREATED', actorName, `${reportNo} üretim planlama öneri read-model olarak oluşturuldu.`),
      createProductionPlanningRecommendationHistory(reportId, 'CALCULATED', actorName, `${items.length} üretim planlama önerisi hesaplandı. Otomatik üretim emri veya plan değişikliği yapılmadı.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'production-planning-recommendation-engine',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

const hasProductionPlanningRecommendationSeedCoverage = (
  reports: ProductionPlanningRecommendationReport[]
) => {
  const items = reports.flatMap(report => report.items)
  const criticalBottlenecks = items.filter(item => item.bottleneck && item.risk === 'CRITICAL').length
  const lineBalancingScenarios = items.filter(item => item.lineBalancingScenario || item.recommendationType === 'BALANCE_CAPACITY').length
  const setupOptimizations = items.filter(item => item.setupOptimizationScenario || item.recommendationType === 'REDUCE_SETUP_TIME').length
  const alternativeLineScenarios = items.filter(item => item.alternativeLineScenario || item.recommendationType === 'CHANGE_LINE' || item.recommendationType === 'ALTERNATIVE_WORK_CENTER').length

  return items.length >= 150
    && criticalBottlenecks >= 25
    && lineBalancingScenarios >= 30
    && setupOptimizations >= 20
    && alternativeLineScenarios >= 20
}

const ensureProductionPlanningRecommendationSeedCoverage = (
  reports: ProductionPlanningRecommendationReport[],
  sourceData: KpiSourceData
) => {
  if(hasProductionPlanningRecommendationSeedCoverage(reports)) return reports

  const seedReport = evaluateProductionPlanningRecommendationReport(sourceData, {
    reportDate: getTodayKey(),
    scope: 'all',
    responsiblePerson: 'Üretim Planlama Öneri Motoru',
    description: 'Faz 34.13.7 seed kapsamı için read-model üretim planlama önerileri üretildi.'
  }, reports, 'Üretim Planlama Öneri Motoru')
  const nextReports = [seedReport, ...reports]
    .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))

  saveProductionPlanningRecommendationReports(nextReports)
  return nextReports
}

export const saveProductionPlanningRecommendationReports = (
  reports: ProductionPlanningRecommendationReport[]
) => {
  if(!isBrowserStorageAvailable()) return
  setDecisionIndexedRecord(PRODUCTION_PLANNING_RECOMMENDATION_STORAGE_KEY, reports)
}

export const loadProductionPlanningRecommendationReports = (
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()){
    return [evaluateProductionPlanningRecommendationReport(sourceData)]
  }

  const stored = getDecisionIndexedRecord<RawProductionPlanningRecommendationReport[]>(PRODUCTION_PLANNING_RECOMMENDATION_STORAGE_KEY)
  if(stored === null){
    const defaultReport = evaluateProductionPlanningRecommendationReport(sourceData)
    const reports = ensureProductionPlanningRecommendationSeedCoverage([defaultReport], sourceData)
    saveProductionPlanningRecommendationReports(reports)
    return reports
  }

  try {
    if(Array.isArray(stored)){
      const reports = stored
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawProductionPlanningRecommendationReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      if(reports.length > 0) return ensureProductionPlanningRecommendationSeedCoverage(reports, sourceData)
    }
  } catch {
    // Corrupt local recommendation cache is replaced with a fresh read-model report.
  }

  const defaultReport = evaluateProductionPlanningRecommendationReport(sourceData)
  saveProductionPlanningRecommendationReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: ProductionPlanningRecommendationReport[],
  nextReport: ProductionPlanningRecommendationReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addProductionPlanningRecommendationReport = (
  input: ProductionPlanningRecommendationReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadProductionPlanningRecommendationReports(sourceData)
  const report = evaluateProductionPlanningRecommendationReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveProductionPlanningRecommendationReports(nextReports)
  return report
}

export const filterProductionPlanningRecommendationReports = (
  reports: ProductionPlanningRecommendationReport[],
  filters: ProductionPlanningRecommendationFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredItems = report.items.filter(item => {
      const matchesSearch = !search || [
        report.reportNo,
        item.recommendationNo,
        item.title,
        item.description,
        item.reason,
        item.analysisResult,
        item.riskExplanation,
        item.expectedGain,
        item.action,
        item.workOrderNo,
        item.productName,
        item.recipeName,
        item.productionLineName,
        item.machineCode,
        item.machineName,
        item.branchName,
        item.employeeName,
        item.lotSktSummary,
        item.haccpCriticalPoint
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.productionLineId === ALL_FILTER || item.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || item.machineId === filters.machineId)
        && (filters.productId === ALL_FILTER || item.productId === filters.productId)
        && (filters.recipeId === ALL_FILTER || item.recipeId === filters.recipeId)
        && (filters.workOrderId === ALL_FILTER || item.workOrderId === filters.workOrderId)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (filters.recommendationType === ALL_FILTER || item.recommendationType === filters.recommendationType)
        && (filters.employeeId === ALL_FILTER || item.employeeId === filters.employeeId)
        && (!filters.date || item.plannedStartAt.slice(0, 10) === filters.date || report.reportDate === filters.date)
    })

    return {
      ...report,
      items: filteredItems
    }
  }).filter(report => report.items.length > 0)
}

export const updateProductionPlanningRecommendationReportStatus = (
  reportId: string,
  status: Extract<ProductionPlanningRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadProductionPlanningRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Üretim planlama öneri raporu bulunamadı.')
  const actionByStatus: Record<Extract<ProductionPlanningRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>, ProductionPlanningRecommendationHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendProductionPlanningRecommendationHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS[status]} durumuna alındı.`
  )
  saveProductionPlanningRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordProductionPlanningRecommendationOutput = (
  reportId: string,
  action: Extract<ProductionPlanningRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadProductionPlanningRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Üretim planlama öneri raporu bulunamadı.')
  const nextReport = appendProductionPlanningRecommendationHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} çıktı penceresi açıldı.`
  )
  saveProductionPlanningRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const ProductionPlanningRecommendationService = {
  createDefaultFilters: createDefaultProductionPlanningRecommendationFilters,
  createDefaultInput: createDefaultProductionPlanningRecommendationReportInput,
  getNextNo: getNextProductionPlanningRecommendationNo,
  save: saveProductionPlanningRecommendationReports,
  list: loadProductionPlanningRecommendationReports,
  evaluate: evaluateProductionPlanningRecommendationReport,
  add: addProductionPlanningRecommendationReport,
  filter: filterProductionPlanningRecommendationReports,
  updateStatus: updateProductionPlanningRecommendationReportStatus,
  recordOutput: recordProductionPlanningRecommendationOutput,
  statistics: createProductionPlanningRecommendationStatistics,
  rules: {
    list: listProductionPlanningRecommendationRules
  }
}
