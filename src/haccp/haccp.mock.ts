import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type {
  CorrectiveAction,
  CriticalControlPoint,
  CriticalControlPointStatus,
  HACCPActionStatus,
  HACCPMonitoringResult,
  HACCPPlan,
  HACCPPlanRecord,
  HACCPPlanStatus,
  HACCPProductionStage,
  HACCPRiskLevel,
  HACCPVerificationResult,
  Hazard,
  HazardType,
  MonitoringRecord,
  VerificationRecord
} from './haccp.types'

export const HACCP_STORAGE_KEY = 'ra_haccp_records'

export const HACCP_PLAN_STATUSES: HACCPPlanStatus[] = [
  'DRAFT',
  'ACTIVE',
  'UNDER_REVIEW',
  'ARCHIVED'
]

export const HACCP_CCP_STATUSES: CriticalControlPointStatus[] = [
  'ACTIVE',
  'PASSIVE',
  'SUSPENDED'
]

export const HACCP_PRODUCTION_STAGES: HACCPProductionStage[] = [
  'RECEIVING',
  'STORAGE',
  'PREPARATION',
  'COOKING',
  'BLAST_CHILLING',
  'PACKAGING',
  'LABELING',
  'DISPATCH'
]

export const HACCP_HAZARD_TYPES: HazardType[] = [
  'BIOLOGICAL',
  'CHEMICAL',
  'PHYSICAL',
  'ALLERGEN'
]

export const HACCP_RISK_LEVELS: HACCPRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const HACCP_MONITORING_RESULTS: HACCPMonitoringResult[] = [
  'PASS',
  'FAIL'
]

export const HACCP_ACTION_STATUSES: HACCPActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]

export const HACCP_VERIFICATION_RESULTS: HACCPVerificationResult[] = [
  'PASS',
  'FAIL'
]

export const HACCP_PLAN_STATUS_LABELS: Record<HACCPPlanStatus, string> = {
  DRAFT: 'Taslak',
  ACTIVE: 'Aktif',
  UNDER_REVIEW: 'İncelemede',
  ARCHIVED: 'Arşivlendi'
}

export const HACCP_CCP_STATUS_LABELS: Record<CriticalControlPointStatus, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  SUSPENDED: 'Askıda'
}

export const HACCP_PRODUCTION_STAGE_LABELS: Record<HACCPProductionStage, string> = {
  RECEIVING: 'Mal Kabul',
  STORAGE: 'Depolama',
  PREPARATION: 'Hazırlık',
  COOKING: 'Pişirme',
  BLAST_CHILLING: 'Şoklama',
  PACKAGING: 'Paketleme',
  LABELING: 'Etiketleme',
  DISPATCH: 'Sevkiyat'
}

export const HACCP_HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  BIOLOGICAL: 'Biyolojik',
  CHEMICAL: 'Kimyasal',
  PHYSICAL: 'Fiziksel',
  ALLERGEN: 'Alerjen'
}

export const HACCP_RISK_LEVEL_LABELS: Record<HACCPRiskLevel, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const HACCP_ACTION_STATUS_LABELS: Record<HACCPActionStatus, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

export const HACCP_VERIFICATION_RESULT_LABELS: Record<HACCPVerificationResult, string> = {
  PASS: 'Uygun',
  FAIL: 'Uygun Değil'
}

export type HACCPMonitoringInput = {
  ccpId: string
  productionOrderId: string
  inventoryLotId: string
  qualitySampleId: string
  measuredValue: number
  checkedBy: string
  checkedAt: string
  notes: string
}

export type HACCPVerificationInput = {
  planId: string
  monitoringRecordId: string
  verifiedBy: string
  verifiedAt: string
  result: HACCPVerificationResult
  notes: string
}

type RawHACCPPlanRecord = Partial<Record<keyof HACCPPlanRecord, unknown>> & Record<string, unknown>
type RawCriticalControlPoint = Partial<Record<keyof CriticalControlPoint, unknown>> & Record<string, unknown>
type RawHazard = Partial<Record<keyof Hazard, unknown>> & Record<string, unknown>
type RawMonitoringRecord = Partial<Record<keyof MonitoringRecord, unknown>> & Record<string, unknown>
type RawCorrectiveAction = Partial<Record<keyof CorrectiveAction, unknown>> & Record<string, unknown>
type RawVerificationRecord = Partial<Record<keyof VerificationRecord, unknown>> & Record<string, unknown>

const HACCP_PLAN_SEED_COUNT = 3
const CCP_SEED_COUNT = 12
const HAZARD_SEED_COUNT = 20
const MONITORING_SEED_COUNT = 60
const CORRECTIVE_ACTION_SEED_COUNT = 15
const VERIFICATION_SEED_COUNT = 10
const QUANTITY_ROUNDING_FACTOR = 100
const DEFAULT_PLAN_STATUS: HACCPPlanStatus = 'ACTIVE'
const DEFAULT_CCP_STATUS: CriticalControlPointStatus = 'ACTIVE'
const DEFAULT_STAGE: HACCPProductionStage = 'RECEIVING'
const DEFAULT_HAZARD_TYPE: HazardType = 'BIOLOGICAL'
const DEFAULT_RISK_LEVEL: HACCPRiskLevel = 'MEDIUM'
const DEFAULT_ACTION_STATUS: HACCPActionStatus = 'OPEN'
const DEFAULT_VERIFICATION_RESULT: HACCPVerificationResult = 'PASS'

const PLAN_SEEDS = [
  {
    id: 'haccp_plan_001',
    code: 'HCP-000001',
    name: 'Soğuk Zincir ve Mal Kabul HACCP Planı',
    description: 'Mal kabul, soğuk depolama ve ilk kalite kontrol kritik noktalarını yönetir.',
    status: 'ACTIVE' as HACCPPlanStatus
  },
  {
    id: 'haccp_plan_002',
    code: 'HCP-000002',
    name: 'Üretim ve Pişirme HACCP Planı',
    description: 'Hazırlık, pişirme ve proses içi sıcaklık kontrollerini kapsar.',
    status: 'ACTIVE' as HACCPPlanStatus
  },
  {
    id: 'haccp_plan_003',
    code: 'HCP-000003',
    name: 'Şoklama, Paketleme ve Sevkiyat HACCP Planı',
    description: 'Şoklama, paketleme, etiketleme ve sevkiyat öncesi gıda güvenliği kontrollerini yönetir.',
    status: 'UNDER_REVIEW' as HACCPPlanStatus
  }
]

const CCP_SEEDS: Array<Omit<CriticalControlPoint, 'id' | 'planId' | 'status'> & {
  limitValue: number
  planIndex: number
}> = [
  {
    planIndex: 0,
    name: 'Mal Kabul Sıcaklık Kontrolü',
    description: 'Soğuk zincirde gelen ürünlerin kabul sıcaklığı ölçülür.',
    productionStage: 'RECEIVING',
    criticalLimit: '<= 5 °C',
    limitValue: 5,
    monitoringMethod: 'Kalibre prob termometre',
    monitoringFrequency: 'Her teslimat',
    responsibleRole: 'Kalite Sorumlusu'
  },
  {
    planIndex: 0,
    name: 'Soğuk Depo Sıcaklık Kontrolü',
    description: 'Soğuk oda sıcaklık sürekliliği izlenir.',
    productionStage: 'STORAGE',
    criticalLimit: '<= 4 °C',
    limitValue: 4,
    monitoringMethod: 'Dijital sıcaklık kayıt cihazı',
    monitoringFrequency: 'Saatlik',
    responsibleRole: 'Depo Sorumlusu'
  },
  {
    planIndex: 0,
    name: 'Ambalaj Bütünlüğü Kontrolü',
    description: 'Gelen ürün ambalajında delinme, sızıntı ve kontaminasyon riski aranır.',
    productionStage: 'RECEIVING',
    criticalLimit: '<= 1 uygunsuzluk',
    limitValue: 1,
    monitoringMethod: 'Görsel kontrol',
    monitoringFrequency: 'Her parti',
    responsibleRole: 'Mal Kabul Ekibi'
  },
  {
    planIndex: 0,
    name: 'Alerjen Ayrıştırma Kontrolü',
    description: 'Alerjen içeren stokların çapraz bulaşma riski ayrıştırılır.',
    productionStage: 'STORAGE',
    criticalLimit: '<= 0 uygunsuzluk',
    limitValue: 0,
    monitoringMethod: 'Raf ve etiket kontrolü',
    monitoringFrequency: 'Vardiya başı',
    responsibleRole: 'Kalite Sorumlusu'
  },
  {
    planIndex: 1,
    name: 'Hazırlık Alanı Hijyen Kontrolü',
    description: 'Hazırlık öncesi yüzey ve ekipman hijyeni doğrulanır.',
    productionStage: 'PREPARATION',
    criticalLimit: '<= 2 ATP RLU',
    limitValue: 2,
    monitoringMethod: 'ATP swab ölçümü',
    monitoringFrequency: 'Vardiya başı',
    responsibleRole: 'Üretim Şefi'
  },
  {
    planIndex: 1,
    name: 'Pişirme Merkez Sıcaklığı',
    description: 'Ürün merkez sıcaklığı güvenli pişirme limitine göre kontrol edilir.',
    productionStage: 'COOKING',
    criticalLimit: '>= 75 °C',
    limitValue: 75,
    monitoringMethod: 'Prob termometre',
    monitoringFrequency: 'Her kazan',
    responsibleRole: 'Üretim Operatörü'
  },
  {
    planIndex: 1,
    name: 'Pişirme Süresi Sapması',
    description: 'Planlanan proses süresinden sapmalar takip edilir.',
    productionStage: 'COOKING',
    criticalLimit: '<= 10 dk sapma',
    limitValue: 10,
    monitoringMethod: 'Proses zaman kaydı',
    monitoringFrequency: 'Her üretim emri',
    responsibleRole: 'Üretim Müdürü'
  },
  {
    planIndex: 1,
    name: 'Çapraz Bulaşma Kontrolü',
    description: 'Hazırlık ekipmanında ürünler arası çapraz bulaşma riski gözlenir.',
    productionStage: 'PREPARATION',
    criticalLimit: '<= 0 uygunsuzluk',
    limitValue: 0,
    monitoringMethod: 'Kontrol listesi',
    monitoringFrequency: 'Ürün geçişlerinde',
    responsibleRole: 'Kalite Sorumlusu'
  },
  {
    planIndex: 2,
    name: 'Şoklama Çıkış Sıcaklığı',
    description: 'Şoklama sonrası ürün güvenli sıcaklık bandına indirilir.',
    productionStage: 'BLAST_CHILLING',
    criticalLimit: '<= 3 °C',
    limitValue: 3,
    monitoringMethod: 'Prob termometre',
    monitoringFrequency: 'Her batch',
    responsibleRole: 'Şoklama Operatörü'
  },
  {
    planIndex: 2,
    name: 'Paketleme Alanı Sıcaklığı',
    description: 'Paketleme sırasında ortam sıcaklığı kontrol edilir.',
    productionStage: 'PACKAGING',
    criticalLimit: '<= 12 °C',
    limitValue: 12,
    monitoringMethod: 'Ortam termometresi',
    monitoringFrequency: 'Saatlik',
    responsibleRole: 'Paketleme Sorumlusu'
  },
  {
    planIndex: 2,
    name: 'Etiket Lot ve SKT Doğrulama',
    description: 'Etiket üzerindeki lot ve son kullanma tarihi doğrulanır.',
    productionStage: 'LABELING',
    criticalLimit: '<= 0 hatalı etiket',
    limitValue: 0,
    monitoringMethod: 'Çift göz kontrolü',
    monitoringFrequency: 'Her etiket serisi',
    responsibleRole: 'Kalite Sorumlusu'
  },
  {
    planIndex: 2,
    name: 'Sevkiyat Öncesi Araç Isısı',
    description: 'Yükleme öncesinde araç kasa sıcaklığı kontrol edilir.',
    productionStage: 'DISPATCH',
    criticalLimit: '<= 5 °C',
    limitValue: 5,
    monitoringMethod: 'Araç sıcaklık göstergesi',
    monitoringFrequency: 'Her araç',
    responsibleRole: 'Sevkiyat Sorumlusu'
  }
]

const HAZARD_ROTATION: Array<Omit<Hazard, 'id' | 'ccpId'>> = [
  {
    type: 'BIOLOGICAL',
    description: 'Sıcaklık sapması nedeniyle mikrobiyal çoğalma riski.',
    riskLevel: 'CRITICAL',
    preventiveMeasure: 'Sıcaklık kontrolü, hızlı kabul ve karantina prosedürü.'
  },
  {
    type: 'CHEMICAL',
    description: 'Kimyasal kalıntı veya temizlik maddesi bulaşma riski.',
    riskLevel: 'HIGH',
    preventiveMeasure: 'Kimyasal ayrıştırma ve durulama doğrulaması.'
  },
  {
    type: 'PHYSICAL',
    description: 'Yabancı cisim veya ambalaj hasarı kaynaklı fiziksel tehlike.',
    riskLevel: 'MEDIUM',
    preventiveMeasure: 'Görsel kontrol ve hasarlı ambalaj red süreci.'
  },
  {
    type: 'ALLERGEN',
    description: 'Alerjen çapraz bulaşma riski.',
    riskLevel: 'HIGH',
    preventiveMeasure: 'Alerjen raf ayrımı ve ekipman sanitasyon kontrolü.'
  }
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawHACCPPlanRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isCCPRecord = (value: unknown): value is RawCriticalControlPoint => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHazardRecord = (value: unknown): value is RawHazard => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isMonitoringRecord = (value: unknown): value is RawMonitoringRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isCorrectiveActionRecord = (value: unknown): value is RawCorrectiveAction => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isVerificationRecord = (value: unknown): value is RawVerificationRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const roundMeasuredValue = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const normalizePlanStatus = (value: unknown): HACCPPlanStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_PLAN_STATUSES.includes(normalized as HACCPPlanStatus)
    ? normalized as HACCPPlanStatus
    : DEFAULT_PLAN_STATUS
}

const normalizeCCPStatus = (value: unknown): CriticalControlPointStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_CCP_STATUSES.includes(normalized as CriticalControlPointStatus)
    ? normalized as CriticalControlPointStatus
    : DEFAULT_CCP_STATUS
}

const normalizeStage = (value: unknown): HACCPProductionStage => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_PRODUCTION_STAGES.includes(normalized as HACCPProductionStage)
    ? normalized as HACCPProductionStage
    : DEFAULT_STAGE
}

const normalizeHazardType = (value: unknown): HazardType => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_HAZARD_TYPES.includes(normalized as HazardType)
    ? normalized as HazardType
    : DEFAULT_HAZARD_TYPE
}

const normalizeRiskLevel = (value: unknown): HACCPRiskLevel => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_RISK_LEVELS.includes(normalized as HACCPRiskLevel)
    ? normalized as HACCPRiskLevel
    : DEFAULT_RISK_LEVEL
}

const normalizeMonitoringResult = (value: unknown): HACCPMonitoringResult => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_MONITORING_RESULTS.includes(normalized as HACCPMonitoringResult)
    ? normalized as HACCPMonitoringResult
    : 'PASS'
}

const normalizeActionStatus = (value: unknown): HACCPActionStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_ACTION_STATUSES.includes(normalized as HACCPActionStatus)
    ? normalized as HACCPActionStatus
    : DEFAULT_ACTION_STATUS
}

const normalizeVerificationResult = (value: unknown): HACCPVerificationResult => {
  const normalized = normalizeText(value).toUpperCase()
  return HACCP_VERIFICATION_RESULTS.includes(normalized as HACCPVerificationResult)
    ? normalized as HACCPVerificationResult
    : DEFAULT_VERIFICATION_RESULT
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue || getTodayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

export const getCriticalLimitValue = (
  criticalLimit: string
) => {
  const match = criticalLimit.match(/-?\d+([.,]\d+)?/)
  return match ? Number(match[0].replace(',', '.')) : 0
}

export const isCriticalLimitMinimum = (
  criticalLimit: string
) => criticalLimit.includes('>=')

export const resolveMonitoringResult = (
  criticalLimit: string,
  measuredValue: number
): HACCPMonitoringResult => {
  const limitValue = getCriticalLimitValue(criticalLimit)
  if(isCriticalLimitMinimum(criticalLimit)) return measuredValue >= limitValue ? 'PASS' : 'FAIL'
  return measuredValue <= limitValue ? 'PASS' : 'FAIL'
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const flattenHACCPCCPs = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.criticalControlPoints)

export const flattenHACCPHazards = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.hazards)

export const flattenHACCPMonitoringRecords = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.monitoringRecords)

export const flattenHACCPCorrectiveActions = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.correctiveActions)

export const flattenHACCPVerificationRecords = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.verificationRecords)

const getSampleForLot = (
  lotId: string,
  qualitySamples: QualitySample[]
) => qualitySamples.find(sample => sample.inventoryLotId === lotId) || null

const getLotForMonitoring = (
  index: number,
  inventoryLots: InventoryLot[]
) => inventoryLots[index % Math.max(inventoryLots.length, 1)] || null

const getProductionOrderForMonitoring = (
  lot: InventoryLot | null,
  productionOrders: ProductionWorkOrder[],
  index: number
) => (
  lot?.productionOrderId
  || productionOrders[index % Math.max(productionOrders.length, 1)]?.id
  || ''
)

const createMeasuredValue = (
  ccp: CriticalControlPoint,
  index: number,
  shouldFail: boolean
) => {
  const limitValue = getCriticalLimitValue(ccp.criticalLimit)
  if(isCriticalLimitMinimum(ccp.criticalLimit)){
    return shouldFail
      ? roundMeasuredValue(Math.max(0, limitValue - 6 - (index % 3)))
      : roundMeasuredValue(limitValue + 3 + (index % 4))
  }

  return shouldFail
    ? roundMeasuredValue(limitValue + 1 + (index % 4))
    : roundMeasuredValue(Math.max(0, limitValue - 0.5 - (index % 3) * 0.25))
}

export const createHACCPMockData = (
  productionOrders: ProductionWorkOrder[],
  inventoryLots: InventoryLot[],
  qualitySamples: QualitySample[]
): HACCPPlanRecord[] => {
  const createdBaseDate = addDays(getTodayKey(), -12)
  const plans: HACCPPlanRecord[] = PLAN_SEEDS.map((plan, index) => {
    const createdAt = `${addDays(createdBaseDate, index)}T07:0${index}:00.000Z`
    return {
      ...plan,
      createdAt,
      updatedAt: createdAt,
      criticalControlPoints: [],
      hazards: [],
      monitoringRecords: [],
      correctiveActions: [],
      verificationRecords: []
    }
  })

  const ccps: CriticalControlPoint[] = CCP_SEEDS.map((ccp, index) => {
    const plan = plans[ccp.planIndex]
    const record: CriticalControlPoint = {
      id: `haccp_ccp_${String(index + 1).padStart(3, '0')}`,
      planId: plan.id,
      name: ccp.name,
      description: ccp.description,
      productionStage: ccp.productionStage,
      criticalLimit: ccp.criticalLimit,
      monitoringMethod: ccp.monitoringMethod,
      monitoringFrequency: ccp.monitoringFrequency,
      responsibleRole: ccp.responsibleRole,
      status: 'ACTIVE'
    }
    plan.criticalControlPoints.push(record)
    return record
  })

  Array.from({ length: HAZARD_SEED_COUNT }).forEach((_, index) => {
    const ccp = ccps[index % ccps.length]
    const hazardSeed = HAZARD_ROTATION[index % HAZARD_ROTATION.length]
    const hazard: Hazard = {
      id: `haccp_hazard_${String(index + 1).padStart(3, '0')}`,
      ccpId: ccp.id,
      ...hazardSeed
    }
    const plan = plans.find(record => record.id === ccp.planId)
    if(plan) plan.hazards.push(hazard)
  })

  const failMonitoringRecords: MonitoringRecord[] = []
  const passMonitoringRecords: MonitoringRecord[] = []

  Array.from({ length: MONITORING_SEED_COUNT }).forEach((_, index) => {
    const ccp = ccps[index % ccps.length]
    const plan = plans.find(record => record.id === ccp.planId)
    const lot = getLotForMonitoring(index, inventoryLots)
    const qualitySample = lot ? getSampleForLot(lot.id, qualitySamples) : null
    const shouldFail = index % 4 === 0
    const measuredValue = createMeasuredValue(ccp, index, shouldFail)
    const result = resolveMonitoringResult(ccp.criticalLimit, measuredValue)
    const checkedDate = index < 12 ? getTodayKey() : addDays(getTodayKey(), -1 - (index % 9))
    const monitoringRecord: MonitoringRecord = {
      id: `haccp_monitoring_${String(index + 1).padStart(3, '0')}`,
      ccpId: ccp.id,
      productionOrderId: getProductionOrderForMonitoring(lot, productionOrders, index),
      inventoryLotId: lot?.id || '',
      qualitySampleId: qualitySample?.id || '',
      measuredValue,
      criticalLimit: ccp.criticalLimit,
      result,
      checkedBy: ccp.responsibleRole,
      checkedAt: `${checkedDate}T${String(7 + (index % 10)).padStart(2, '0')}:${String((index * 3) % 60).padStart(2, '0')}:00.000Z`,
      notes: result === 'FAIL'
        ? 'Kritik limit sapması tespit edildi, düzeltici faaliyet açıldı.'
        : 'Kritik limit içinde kontrol tamamlandı.'
    }

    if(result === 'FAIL') failMonitoringRecords.push(monitoringRecord)
    else passMonitoringRecords.push(monitoringRecord)
    plan?.monitoringRecords.push(monitoringRecord)
  })

  failMonitoringRecords.slice(0, CORRECTIVE_ACTION_SEED_COUNT).forEach((monitoringRecord, index) => {
    const ccp = ccps.find(record => record.id === monitoringRecord.ccpId)
    const plan = ccp ? plans.find(record => record.id === ccp.planId) : null
    const status: HACCPActionStatus = index % 5 === 0 ? 'COMPLETED' : index % 3 === 0 ? 'IN_PROGRESS' : 'OPEN'
    const correctiveAction: CorrectiveAction = {
      id: `haccp_action_${String(index + 1).padStart(3, '0')}`,
      monitoringRecordId: monitoringRecord.id,
      description: `${ccp?.name || 'CCP'} için kritik limit sapması sonrası izolasyon, yeniden ölçüm ve sorumlu bilgilendirme aksiyonu.`,
      assignedTo: ccp?.responsibleRole || 'Kalite Sorumlusu',
      status,
      completedAt: status === 'COMPLETED' ? `${addDays(getTodayKey(), -1)}T16:${String(index).padStart(2, '0')}:00.000Z` : ''
    }
    plan?.correctiveActions.push(correctiveAction)
  })

  passMonitoringRecords.slice(0, VERIFICATION_SEED_COUNT).forEach((monitoringRecord, index) => {
    const ccp = ccps.find(record => record.id === monitoringRecord.ccpId)
    const plan = ccp ? plans.find(record => record.id === ccp.planId) : null
    const verifiedDate = index < 4 ? getTodayKey() : addDays(getTodayKey(), -2 - (index % 5))
    const verificationRecord: VerificationRecord = {
      id: `haccp_verification_${String(index + 1).padStart(3, '0')}`,
      planId: plan?.id || '',
      monitoringRecordId: monitoringRecord.id,
      verifiedBy: 'Kalite Müdürü',
      verifiedAt: `${verifiedDate}T15:${String(index * 4).padStart(2, '0')}:00.000Z`,
      result: 'PASS',
      notes: 'Monitoring kaydı ve kritik limit uygunluğu doğrulandı.'
    }
    plan?.verificationRecords.push(verificationRecord)
  })

  return plans
}

const normalizeCCP = (
  item: RawCriticalControlPoint,
  planId: string,
  index: number
): CriticalControlPoint => ({
  id: normalizeText(item.id) || `haccp_ccp_${Date.now()}_${index}`,
  planId: normalizeText(item.planId) || planId,
  name: normalizeText(item.name) || `CCP ${index + 1}`,
  description: normalizeText(item.description),
  productionStage: normalizeStage(item.productionStage),
  criticalLimit: normalizeText(item.criticalLimit) || '<= 5 °C',
  monitoringMethod: normalizeText(item.monitoringMethod) || 'Manuel kontrol',
  monitoringFrequency: normalizeText(item.monitoringFrequency) || 'Vardiya başı',
  responsibleRole: normalizeText(item.responsibleRole) || 'Kalite Sorumlusu',
  status: normalizeCCPStatus(item.status)
})

const normalizeHazard = (
  item: RawHazard,
  index: number
): Hazard => ({
  id: normalizeText(item.id) || `haccp_hazard_${Date.now()}_${index}`,
  ccpId: normalizeText(item.ccpId),
  type: normalizeHazardType(item.type),
  description: normalizeText(item.description) || 'HACCP tehlike tanımı.',
  riskLevel: normalizeRiskLevel(item.riskLevel),
  preventiveMeasure: normalizeText(item.preventiveMeasure) || 'Önleyici faaliyet uygulanır.'
})

const normalizeMonitoring = (
  item: RawMonitoringRecord,
  index: number
): MonitoringRecord => ({
  id: normalizeText(item.id) || `haccp_monitoring_${Date.now()}_${index}`,
  ccpId: normalizeText(item.ccpId),
  productionOrderId: normalizeText(item.productionOrderId),
  inventoryLotId: normalizeText(item.inventoryLotId),
  qualitySampleId: normalizeText(item.qualitySampleId),
  measuredValue: roundMeasuredValue(normalizeNonNegativeNumber(item.measuredValue)),
  criticalLimit: normalizeText(item.criticalLimit) || '<= 5 °C',
  result: normalizeMonitoringResult(item.result),
  checkedBy: normalizeText(item.checkedBy) || 'Kalite Sorumlusu',
  checkedAt: normalizeText(item.checkedAt) || new Date().toISOString(),
  notes: normalizeText(item.notes)
})

const normalizeCorrectiveAction = (
  item: RawCorrectiveAction,
  index: number
): CorrectiveAction => ({
  id: normalizeText(item.id) || `haccp_action_${Date.now()}_${index}`,
  monitoringRecordId: normalizeText(item.monitoringRecordId),
  description: normalizeText(item.description) || 'Düzeltici faaliyet açıklaması.',
  assignedTo: normalizeText(item.assignedTo) || 'Kalite Sorumlusu',
  status: normalizeActionStatus(item.status),
  completedAt: normalizeText(item.completedAt)
})

const normalizeVerification = (
  item: RawVerificationRecord,
  planId: string,
  index: number
): VerificationRecord => ({
  id: normalizeText(item.id) || `haccp_verification_${Date.now()}_${index}`,
  planId: normalizeText(item.planId) || planId,
  monitoringRecordId: normalizeText(item.monitoringRecordId),
  verifiedBy: normalizeText(item.verifiedBy) || 'Kalite Müdürü',
  verifiedAt: normalizeText(item.verifiedAt) || new Date().toISOString(),
  result: normalizeVerificationResult(item.result),
  notes: normalizeText(item.notes)
})

const normalizePlan = (
  item: RawHACCPPlanRecord,
  index: number
): HACCPPlanRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const planId = normalizeText(item.id) || `haccp_plan_${Date.now()}_${index}`

  return {
    id: planId,
    code: normalizeText(item.code) || `HCP-${String(index + 1).padStart(6, '0')}`,
    name: normalizeText(item.name) || `HACCP Plan ${index + 1}`,
    description: normalizeText(item.description),
    status: normalizePlanStatus(item.status),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    criticalControlPoints: Array.isArray(item.criticalControlPoints)
      ? item.criticalControlPoints.filter(isCCPRecord).map((ccp, ccpIndex) => normalizeCCP(ccp, planId, ccpIndex))
      : [],
    hazards: Array.isArray(item.hazards)
      ? item.hazards.filter(isHazardRecord).map(normalizeHazard)
      : [],
    monitoringRecords: Array.isArray(item.monitoringRecords)
      ? item.monitoringRecords.filter(isMonitoringRecord).map(normalizeMonitoring)
      : [],
    correctiveActions: Array.isArray(item.correctiveActions)
      ? item.correctiveActions.filter(isCorrectiveActionRecord).map(normalizeCorrectiveAction)
      : [],
    verificationRecords: Array.isArray(item.verificationRecords)
      ? item.verificationRecords.filter(isVerificationRecord).map((verification, verificationIndex) => (
        normalizeVerification(verification, planId, verificationIndex)
      ))
      : []
  }
}

const mergeById = <TRecord extends { id: string }>(
  currentRecords: TRecord[],
  seedRecords: TRecord[]
) => {
  const currentIds = new Set(currentRecords.map(record => record.id))
  return [
    ...currentRecords,
    ...seedRecords.filter(record => !currentIds.has(record.id))
  ]
}

const ensureHACCPSeeds = (
  records: HACCPPlanRecord[],
  productionOrders: ProductionWorkOrder[],
  inventoryLots: InventoryLot[],
  qualitySamples: QualitySample[]
) => {
  const planCount = records.length
  const ccpCount = flattenHACCPCCPs(records).length
  const hazardCount = flattenHACCPHazards(records).length
  const monitoringCount = flattenHACCPMonitoringRecords(records).length
  const actionCount = flattenHACCPCorrectiveActions(records).length
  const verificationCount = flattenHACCPVerificationRecords(records).length

  if(
    planCount >= HACCP_PLAN_SEED_COUNT
    && ccpCount >= CCP_SEED_COUNT
    && hazardCount >= HAZARD_SEED_COUNT
    && monitoringCount >= MONITORING_SEED_COUNT
    && actionCount >= CORRECTIVE_ACTION_SEED_COUNT
    && verificationCount >= VERIFICATION_SEED_COUNT
  ) return records

  const seedRecords = createHACCPMockData(productionOrders, inventoryLots, qualitySamples)
  const recordMap = new Map(records.map(record => [record.id, record]))

  seedRecords.forEach(seedRecord => {
    const existingRecord = recordMap.get(seedRecord.id)
    if(!existingRecord){
      recordMap.set(seedRecord.id, seedRecord)
      return
    }

    recordMap.set(seedRecord.id, {
      ...existingRecord,
      criticalControlPoints: mergeById(existingRecord.criticalControlPoints, seedRecord.criticalControlPoints),
      hazards: mergeById(existingRecord.hazards, seedRecord.hazards),
      monitoringRecords: mergeById(existingRecord.monitoringRecords, seedRecord.monitoringRecords),
      correctiveActions: mergeById(existingRecord.correctiveActions, seedRecord.correctiveActions),
      verificationRecords: mergeById(existingRecord.verificationRecords, seedRecord.verificationRecords)
    })
  })

  return Array.from(recordMap.values())
}

export const saveHACCPRecords = (records: HACCPPlanRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(HACCP_STORAGE_KEY, JSON.stringify(records.map(normalizePlan)))
}

export const loadHACCPRecords = (
  productionOrders: ProductionWorkOrder[],
  inventoryLots: InventoryLot[],
  qualitySamples: QualitySample[]
) => {
  const seedRecords = createHACCPMockData(productionOrders, inventoryLots, qualitySamples)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(HACCP_STORAGE_KEY)

  if(!storedRecords){
    saveHACCPRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizePlan)
      const migratedRecords = ensureHACCPSeeds(normalizedRecords, productionOrders, inventoryLots, qualitySamples)

      saveHACCPRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    saveHACCPRecords(seedRecords)
    return seedRecords
  }

  saveHACCPRecords(seedRecords)
  return seedRecords
}

export const createMonitoringRecord = (
  input: HACCPMonitoringInput,
  ccp: CriticalControlPoint,
  monitoringRecords: MonitoringRecord[]
) => {
  const result = resolveMonitoringResult(ccp.criticalLimit, input.measuredValue)
  const record: MonitoringRecord = {
    id: createId('haccp_monitoring'),
    ccpId: input.ccpId,
    productionOrderId: input.productionOrderId,
    inventoryLotId: input.inventoryLotId,
    qualitySampleId: input.qualitySampleId,
    measuredValue: roundMeasuredValue(input.measuredValue),
    criticalLimit: ccp.criticalLimit,
    result,
    checkedBy: input.checkedBy.trim(),
    checkedAt: input.checkedAt,
    notes: input.notes.trim()
  }
  const correctiveAction: CorrectiveAction | null = result === 'FAIL'
    ? {
      id: createId('haccp_action'),
      monitoringRecordId: record.id,
      description: `${ccp.name} kritik limit sapması için düzeltici faaliyet açıldı.`,
      assignedTo: ccp.responsibleRole,
      status: 'OPEN',
      completedAt: ''
    }
    : null

  return {
    record,
    correctiveAction,
    nextMonitoringRecords: [record, ...monitoringRecords]
  }
}

export const createVerificationRecord = (
  input: HACCPVerificationInput
): VerificationRecord => ({
  id: createId('haccp_verification'),
  planId: input.planId,
  monitoringRecordId: input.monitoringRecordId,
  verifiedBy: input.verifiedBy.trim(),
  verifiedAt: input.verifiedAt,
  result: input.result,
  notes: input.notes.trim()
})

export const validateMonitoringInput = (
  input: HACCPMonitoringInput,
  ccpMap: Map<string, CriticalControlPoint>,
  productionOrderMap: Map<string, ProductionWorkOrder>,
  lotMap: Map<string, InventoryLot>,
  sampleMap: Map<string, QualitySample>
) => {
  if(!input.ccpId.trim()) return 'CCP zorunludur.'
  if(!ccpMap.has(input.ccpId)) return 'CCP kaydı bulunamadı.'
  if(!input.productionOrderId.trim()) return 'Production Order zorunludur.'
  if(!productionOrderMap.has(input.productionOrderId)) return 'Production Order bulunamadı.'
  if(!input.inventoryLotId.trim()) return 'Inventory Lot zorunludur.'
  if(!lotMap.has(input.inventoryLotId)) return 'Inventory Lot bulunamadı.'
  if(input.qualitySampleId && !sampleMap.has(input.qualitySampleId)) return 'Quality Sample bulunamadı.'
  if(!Number.isFinite(input.measuredValue) || input.measuredValue < 0) return 'Measured Value geçerli sayı olmalıdır.'
  if(!input.checkedBy.trim()) return 'Checked By zorunludur.'
  if(!input.checkedAt.trim()) return 'Checked At zorunludur.'
  return ''
}

export const validateVerificationInput = (
  input: HACCPVerificationInput,
  planMap: Map<string, HACCPPlanRecord>,
  monitoringMap: Map<string, MonitoringRecord>,
  actionMap: Map<string, CorrectiveAction>
) => {
  if(!input.planId.trim()) return 'Plan zorunludur.'
  if(!planMap.has(input.planId)) return 'Plan bulunamadı.'
  if(!input.monitoringRecordId.trim()) return 'Monitoring Record zorunludur.'
  const monitoringRecord = monitoringMap.get(input.monitoringRecordId)
  if(!monitoringRecord) return 'Monitoring Record bulunamadı.'
  if(monitoringRecord.result !== 'PASS') return 'Verification sadece PASS Monitoring kayıtları üzerinde yapılabilir.'

  const openAction = Array.from(actionMap.values()).find(action => (
    action.monitoringRecordId === monitoringRecord.id
    && action.status !== 'COMPLETED'
    && action.status !== 'CANCELLED'
  ))
  if(openAction) return 'Açık Corrective Action kapanmadan verification yapılamaz.'
  if(!input.verifiedBy.trim()) return 'Verified By zorunludur.'
  if(!input.verifiedAt.trim()) return 'Verified At zorunludur.'
  return ''
}
