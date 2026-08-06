import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { StockUnit } from '../types'
import type {
  ProductRecall,
  ProductRecallActionLog,
  ProductRecallActionType,
  ProductRecallDocument,
  ProductRecallImpactAnalysis,
  ProductRecallPriority,
  ProductRecallReason,
  ProductRecallRelatedRecord,
  ProductRecallRiskLevel,
  ProductRecallStatus,
  ProductRecallTimelineEvent,
  ProductRecallTimelineStage,
  ProductRecallTraceability,
  ProductRecallType
} from './product-recall.types'

export const PRODUCT_RECALL_STORAGE_KEY = 'ra_product_recalls'

export const PRODUCT_RECALL_TYPES: ProductRecallType[] = [
  'PRODUCT',
  'LOT',
  'RAW_MATERIAL',
  'SUPPLIER',
  'QUALITY',
  'HACCP',
  'EXPIRY',
  'LABEL',
  'ALLERGEN'
]

export const PRODUCT_RECALL_REASONS: ProductRecallReason[] = [
  'MICROBIOLOGICAL',
  'CHEMICAL',
  'PHYSICAL',
  'ALLERGEN',
  'PACKAGING_DEFECT',
  'LABEL_ERROR',
  'FOREIGN_OBJECT',
  'EXPIRY_RISK',
  'HACCP_DEVIATION',
  'SUPPLIER_NONCONFORMITY',
  'OTHER'
]

export const PRODUCT_RECALL_RISK_LEVELS: ProductRecallRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const PRODUCT_RECALL_PRIORITIES: ProductRecallPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PRODUCT_RECALL_STATUSES: ProductRecallStatus[] = [
  'DRAFT',
  'REVIEWING',
  'APPROVED',
  'IN_OPERATION',
  'COMPLETED',
  'CANCELLED'
]

export const PRODUCT_RECALL_ACTION_TYPES: ProductRecallActionType[] = [
  'QUARANTINED',
  'SHIPMENT_STOPPED',
  'CUSTOMER_NOTIFIED',
  'SUPPLIER_NOTIFIED',
  'QUALITY_REVIEW_STARTED',
  'SAMPLE_TAKEN',
  'WITNESS_SAMPLE_REVIEWED',
  'DISPOSED',
  'REPRODUCTION_REQUIRED'
]

export const PRODUCT_RECALL_TYPE_LABELS: Record<ProductRecallType, string> = {
  PRODUCT: 'Ürün Recall',
  LOT: 'Lot Recall',
  RAW_MATERIAL: 'Hammadde Recall',
  SUPPLIER: 'Tedarikçi Recall',
  QUALITY: 'Kalite Recall',
  HACCP: 'HACCP Recall',
  EXPIRY: 'SKT Recall',
  LABEL: 'Etiket Recall',
  ALLERGEN: 'Alerjen Recall'
}

export const PRODUCT_RECALL_REASON_LABELS: Record<ProductRecallReason, string> = {
  MICROBIOLOGICAL: 'Mikrobiyolojik',
  CHEMICAL: 'Kimyasal',
  PHYSICAL: 'Fiziksel',
  ALLERGEN: 'Alerjen',
  PACKAGING_DEFECT: 'Ambalaj Hatası',
  LABEL_ERROR: 'Etiket Hatası',
  FOREIGN_OBJECT: 'Yabancı Madde',
  EXPIRY_RISK: 'SKT Riski',
  HACCP_DEVIATION: 'HACCP Sapması',
  SUPPLIER_NONCONFORMITY: 'Tedarikçi Uygunsuzluğu',
  OTHER: 'Diğer'
}

export const PRODUCT_RECALL_RISK_LEVEL_LABELS: Record<ProductRecallRiskLevel, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const PRODUCT_RECALL_PRIORITY_LABELS: Record<ProductRecallPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const PRODUCT_RECALL_STATUS_LABELS: Record<ProductRecallStatus, string> = {
  DRAFT: 'Taslak',
  REVIEWING: 'İnceleniyor',
  APPROVED: 'Onaylandı',
  IN_OPERATION: 'Operasyonda',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  OPEN: 'Taslak',
  UNDER_INVESTIGATION: 'İnceleniyor',
  IN_PROGRESS: 'Operasyonda'
}

export const PRODUCT_RECALL_ACTION_LABELS: Record<ProductRecallActionType, string> = {
  QUARANTINED: 'Ürün karantinaya alındı',
  SHIPMENT_STOPPED: 'Sevkiyat durduruldu',
  CUSTOMER_NOTIFIED: 'Müşteri bilgilendirildi',
  SUPPLIER_NOTIFIED: 'Tedarikçi bilgilendirildi',
  QUALITY_REVIEW_STARTED: 'Kalite incelemesi başlatıldı',
  SAMPLE_TAKEN: 'Numune alındı',
  WITNESS_SAMPLE_REVIEWED: 'Şahit numune incelendi',
  DISPOSED: 'İmha edildi',
  REPRODUCTION_REQUIRED: 'Yeniden üretilecek'
}

export const PRODUCT_RECALL_TIMELINE_LABELS: Record<ProductRecallTimelineStage, string> = {
  CREATED: 'Oluşturuldu',
  SENT_FOR_APPROVAL: 'Onaya gönderildi',
  APPROVED: 'Onaylandı',
  OPERATION_STARTED: 'Operasyon başladı',
  NOTIFICATION_SENT: 'Bildirim gönderildi',
  CLOSED: 'Kapatıldı'
}

export type ProductRecallInput = {
  recallNo: string
  recallType: ProductRecallType
  inventoryLotId: string
  reason: ProductRecallReason
  riskLevel: ProductRecallRiskLevel
  priority: ProductRecallPriority
  status: ProductRecallStatus
  affectedQuantity: number
  unit: StockUnit
  reportedDate: string
  startedAt: string
  targetCompletionDate: string
  resolvedDate: string
  description: string
  riskAnalysis: string
  initiatedBy: string
  responsiblePerson: string
  createdBy: string
  branchId: string
  warehouseId: string
  supplierId: string
}

type RawProductRecallRecord = Partial<ProductRecall> & Record<string, unknown>

const DEFAULT_TYPE: ProductRecallType = 'LOT'
const DEFAULT_REASON: ProductRecallReason = 'OTHER'
const DEFAULT_RISK_LEVEL: ProductRecallRiskLevel = 'LOW'
const DEFAULT_PRIORITY: ProductRecallPriority = 'NORMAL'
const DEFAULT_STATUS: ProductRecallStatus = 'DRAFT'
const DEFAULT_UNIT: StockUnit = 'adet'
const SEED_RECALL_COUNT = 120
const QUANTITY_ROUNDING_FACTOR = 1000
const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const TYPE_ROTATION: ProductRecallType[] = [
  'PRODUCT',
  'LOT',
  'RAW_MATERIAL',
  'SUPPLIER',
  'QUALITY',
  'HACCP',
  'EXPIRY',
  'LABEL',
  'ALLERGEN'
]

const REASON_ROTATION: ProductRecallReason[] = [
  'MICROBIOLOGICAL',
  'ALLERGEN',
  'HACCP_DEVIATION',
  'LABEL_ERROR',
  'EXPIRY_RISK',
  'SUPPLIER_NONCONFORMITY',
  'PACKAGING_DEFECT',
  'CHEMICAL',
  'PHYSICAL',
  'FOREIGN_OBJECT'
]

const STATUS_ROTATION: ProductRecallStatus[] = [
  'DRAFT',
  'REVIEWING',
  'APPROVED',
  'IN_OPERATION',
  'COMPLETED',
  'IN_OPERATION',
  'REVIEWING',
  'CANCELLED'
]

const INITIATORS = [
  'Kalite Güvence Müdürü',
  'Gıda Güvenliği Sorumlusu',
  'HACCP Koordinatörü',
  'Depo Kalite Uzmanı',
  'Üretim Kalite Lideri',
  'Sevkiyat Operasyon Sorumlusu'
]

const RESPONSIBLES = [
  'Ayşe Demir',
  'Mert Yalçın',
  'Selin Acar',
  'Kerem Uslu',
  'Deniz Koç',
  'Nesrin Arslan'
]

const CUSTOMER_NAMES = [
  'Merkez Hastane Mutfağı',
  'Anadolu Catering Kampüsü',
  'Kuzey Otel Zinciri',
  'Marmara Okul Yemekhanesi',
  'Ege Toplu Yemek Operasyonu',
  'Trakya Fabrika Kantini',
  'Başkent Lojistik Müşterisi',
  'Akdeniz Klinik Mutfağı',
  'Uludağ Turizm Tesisi',
  'Körfez Kurumsal Yemekhane'
]

const INDUSTRIAL_NOTES = [
  'soğuk zincir sıcaklık sapması',
  'alerjen beyanı kontrol uyumsuzluğu',
  'HACCP kritik limit aşımı',
  'etiket lot/SKT uyumsuzluğu',
  'tedarikçi kalite sertifikası uygunsuzluğu',
  'ambalaj sızdırmazlık riski',
  'mikrobiyolojik hızlı test şüphesi',
  'yabancı madde kontrol alarmı'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawProductRecallRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizePositiveNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const parseSafeDate = (value: unknown, fallback = getTodayKey()) => {
  const text = normalizeText(value)
  const fallbackText = normalizeText(fallback) || getTodayKey()
  const candidate = text
    ? new Date(text.includes('T') ? text : `${text.slice(0, 10)}T00:00:00`)
    : new Date(`${fallbackText.slice(0, 10)}T00:00:00`)

  if(!Number.isNaN(candidate.getTime())) return candidate

  const fallbackDate = new Date(fallbackText.includes('T') ? fallbackText : `${fallbackText.slice(0, 10)}T00:00:00`)
  return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate
}

const toDateKey = (value: unknown, fallback = getTodayKey()) => parseSafeDate(value, fallback).toLocaleDateString('sv-SE')

const toDateTimeIso = (value: unknown, fallback = getTodayKey()) => parseSafeDate(value, fallback).toISOString()

const addDays = (dateValue: string, days: number) => {
  const date = parseSafeDate(dateValue)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addHoursIso = (dateValue: string, hours: number) => {
  const date = parseSafeDate(dateValue)
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

const diffDays = (startValue: string, endValue: string) => {
  const start = parseSafeDate(startValue)
  const end = parseSafeDate(endValue || startValue)
  const diff = end.getTime() - start.getTime()
  return Number.isFinite(diff) && diff >= 0 ? Math.round(diff / 86400000) : 0
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const normalizeType = (value: unknown): ProductRecallType => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_TYPES.includes(normalized as ProductRecallType)
    ? normalized as ProductRecallType
    : DEFAULT_TYPE
}

const normalizeReason = (value: unknown): ProductRecallReason => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_REASONS.includes(normalized as ProductRecallReason)
    ? normalized as ProductRecallReason
    : DEFAULT_REASON
}

const normalizeRiskLevel = (value: unknown): ProductRecallRiskLevel => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_RISK_LEVELS.includes(normalized as ProductRecallRiskLevel)
    ? normalized as ProductRecallRiskLevel
    : DEFAULT_RISK_LEVEL
}

const normalizePriority = (value: unknown, riskLevel: ProductRecallRiskLevel = DEFAULT_RISK_LEVEL): ProductRecallPriority => {
  const normalized = normalizeText(value).toUpperCase()
  if(PRODUCT_RECALL_PRIORITIES.includes(normalized as ProductRecallPriority)) return normalized as ProductRecallPriority
  if(riskLevel === 'CRITICAL') return 'URGENT'
  if(riskLevel === 'HIGH') return 'HIGH'
  if(riskLevel === 'MEDIUM') return 'NORMAL'
  return DEFAULT_PRIORITY
}

const normalizeStatus = (value: unknown): ProductRecallStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(normalized === 'OPEN') return 'DRAFT'
  if(normalized === 'UNDER_INVESTIGATION') return 'REVIEWING'
  if(normalized === 'IN_PROGRESS') return 'IN_OPERATION'
  return PRODUCT_RECALL_STATUSES.includes(normalized as ProductRecallStatus)
    ? normalized as ProductRecallStatus
    : DEFAULT_STATUS
}

const normalizeUnit = (value: unknown): StockUnit => {
  const normalized = normalizeText(value)
  return STOCK_UNITS.includes(normalized as StockUnit) ? normalized as StockUnit : DEFAULT_UNIT
}

const isClosedStatus = (status: ProductRecallStatus) => status === 'COMPLETED' || status === 'CANCELLED'

const createRelatedRecord = (
  type: ProductRecallRelatedRecord['type'],
  id: string,
  no: string,
  name: string,
  detail = '',
  status = ''
): ProductRecallRelatedRecord => ({
  id: id || `${type.toLocaleLowerCase('tr-TR')}_${normalizeSearchKey(no || name).replace(/\s+/g, '_')}`,
  type,
  no,
  name,
  detail,
  status
})

const emptyTraceability = (): ProductRecallTraceability => ({
  products: [],
  lots: [],
  subLots: [],
  rawMaterials: [],
  recipes: [],
  productionOrders: [],
  productionCenters: [],
  branches: [],
  warehouses: [],
  shipments: [],
  deliveries: [],
  customers: [],
  samples: [],
  witnessSamples: [],
  qualityForms: [],
  haccpRecords: []
})

const normalizeRelatedRecords = (
  value: unknown,
  type: ProductRecallRelatedRecord['type'],
  fallback: ProductRecallRelatedRecord[] = []
) => {
  if(!Array.isArray(value)) return fallback
  const records = value
    .filter(item => Boolean(item) && typeof item === 'object')
    .map((item, index) => {
      const record = item as Partial<ProductRecallRelatedRecord> & Record<string, unknown>
      return createRelatedRecord(
        type,
        normalizeText(record.id) || `${type}_${index}`,
        normalizeText(record.no) || normalizeText(record.name) || `${type}-${index + 1}`,
        normalizeText(record.name) || normalizeText(record.no) || `${type}-${index + 1}`,
        normalizeText(record.detail),
        normalizeText(record.status)
      )
    })

  return records.length > 0 ? records : fallback
}

const createFallbackLot = (index = 0): InventoryLot => ({
  id: `fallback_lot_${index + 1}`,
  lotNo: `LOT-FB-${String(index + 1).padStart(4, '0')}`,
  productionOrderId: `fallback_work_order_${index + 1}`,
  productId: `fallback_product_${index + 1}`,
  warehouseId: `branch_${(index % 6) + 1}`,
  productionDate: addDays(getTodayKey(), -20 - index),
  expiryDate: addDays(getTodayKey(), 20 + index),
  quantity: 500 + index * 12,
  unit: 'kg',
  status: index % 5 === 0 ? 'QUARANTINE' : 'ACTIVE',
  notes: 'Recall seed lotu',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stockItemId: `fallback_stock_${index + 1}`,
  goodsReceiptId: `fallback_receipt_${index + 1}`,
  supplierId: `supplier_${(index % 8) + 1}`,
  receivedQuantity: 500 + index * 12,
  remainingQuantity: 420 + index * 10
})

const getSourceLots = (inventoryLots: InventoryLot[]) => {
  if(inventoryLots.length > 0) return inventoryLots
  return Array.from({ length: 72 }, (_, index) => createFallbackLot(index))
}

const createSeedTraceability = (
  lot: InventoryLot,
  index: number,
  shipmentCount: number,
  customerCount: number
): ProductRecallTraceability => {
  const productName = `Endüstriyel Mutfak Ürünü ${String((index % 24) + 1).padStart(2, '0')}`
  const branchNo = String((index % 8) + 1).padStart(2, '0')
  const rawMaterialCount = 1 + (index % 3)
  const subLotCount = index % 2 === 0 ? 2 : 1
  const shipments = Array.from({ length: shipmentCount }, (_, shipmentIndex) => createRelatedRecord(
    'SHIPMENT',
    `seed_shipment_${index}_${shipmentIndex}`,
    `SVK-${String(index + 1).padStart(5, '0')}-${shipmentIndex + 1}`,
    `Sevkiyat Planı ${shipmentIndex + 1}`,
    `${35 + (index % 9) * 6} kg ürün sevkiyat etkisi`,
    shipmentIndex % 3 === 0 ? 'Durduruldu' : 'İzlemede'
  ))
  const customers = Array.from({ length: customerCount }, (_, customerIndex) => createRelatedRecord(
    'CUSTOMER',
    `seed_customer_${index}_${customerIndex}`,
    `MUS-${String(((index + customerIndex) % 60) + 1).padStart(4, '0')}`,
    CUSTOMER_NAMES[(index + customerIndex) % CUSTOMER_NAMES.length],
    'Müşteri bilgilendirme listesinde',
    customerIndex % 2 === 0 ? 'Bilgilendirildi' : 'Bekliyor'
  ))

  return {
    products: [
      createRelatedRecord('PRODUCT', lot.productId || `product_${index}`, `URN-${String((index % 48) + 1).padStart(4, '0')}`, productName, 'Recall kapsamındaki ürün', 'Etkilendi')
    ],
    lots: [
      createRelatedRecord('LOT', lot.id, lot.lotNo, lot.lotNo, `${roundQuantity(lot.remainingQuantity || lot.quantity || 1)} ${lot.unit} izleniyor`, lot.status)
    ],
    subLots: Array.from({ length: subLotCount }, (_, subIndex) => createRelatedRecord(
      'SUB_LOT',
      `${lot.id}_sub_${subIndex + 1}`,
      `${lot.lotNo}-ALT-${subIndex + 1}`,
      `${productName} alt lot ${subIndex + 1}`,
      'Dağıtım kırılımı',
      'İzlemede'
    )),
    rawMaterials: Array.from({ length: rawMaterialCount }, (_, materialIndex) => createRelatedRecord(
      'RAW_MATERIAL',
      `${lot.stockItemId || 'raw'}_${materialIndex}`,
      `HM-${String((index + materialIndex) % 90).padStart(4, '0')}`,
      ['Pastörize süt', 'Tavuk göğüs', 'Pirinç', 'Krema', 'Un', 'Baharat karışımı'][materialIndex % 6],
      'Reçete bileşeni',
      materialIndex % 2 === 0 ? 'Kontrol edildi' : 'Bekliyor'
    )),
    recipes: [
      createRelatedRecord('RECIPE', `recipe_${index % 30}`, `REC-${String((index % 30) + 1).padStart(4, '0')}`, `${productName} reçetesi`, 'Birincil reçete', 'Aktif')
    ],
    productionOrders: [
      createRelatedRecord('PRODUCTION_ORDER', lot.productionOrderId || `po_${index}`, `UE-${String((index % 80) + 1).padStart(5, '0')}`, 'Üretim emri', 'Recall kaynak üretim partisi', 'İnceleniyor')
    ],
    productionCenters: [
      createRelatedRecord('PRODUCTION_CENTER', `line_${(index % 6) + 1}`, `HAT-${(index % 6) + 1}`, ['Sıcak Üretim', 'Soğuk Üretim', 'Paketleme', 'Etiketleme', 'Şoklama', 'Hazırlık'][index % 6], 'Üretim merkezi', 'Aktif')
    ],
    branches: [
      createRelatedRecord('BRANCH', lot.warehouseId || `branch_${branchNo}`, `SUBE-${branchNo}`, ['Merkez Mutfak', 'Avrupa Depo', 'Anadolu Sevkiyat', 'Gebze Üretim', 'Bursa Dağıtım', 'Ankara Operasyon'][index % 6], 'Recall operasyon şubesi', 'Aktif')
    ],
    warehouses: [
      createRelatedRecord('WAREHOUSE', lot.warehouseId || `warehouse_${branchNo}`, `DEP-${branchNo}`, ['Soğuk Depo', 'Kuru Depo', 'Sevkiyat Deposu', 'Karantina Alanı'][index % 4], 'Depo stok görünümü', index % 3 === 0 ? 'Karantina' : 'İzlemede')
    ],
    shipments,
    deliveries: shipments.map((shipment, shipmentIndex) => createRelatedRecord(
      'DELIVERY',
      `delivery_${shipment.id}`,
      `TES-${String(index + 1).padStart(5, '0')}-${shipmentIndex + 1}`,
      `Teslimat ${shipmentIndex + 1}`,
      shipment.name,
      shipment.status
    )),
    customers,
    samples: [
      createRelatedRecord('SAMPLE', `sample_${index}`, `NUM-${String(index + 1).padStart(5, '0')}`, 'Kalite numunesi', 'Recall inceleme numunesi', 'İncelemede')
    ],
    witnessSamples: [
      createRelatedRecord('WITNESS_SAMPLE', `witness_${index}`, `SN-${String(index + 1).padStart(5, '0')}`, 'Şahit numune', 'Şahit numune doğrulama', index % 4 === 0 ? 'İncelendi' : 'Saklanıyor')
    ],
    qualityForms: [
      createRelatedRecord('QUALITY_FORM', `quality_form_${index}`, `KF-${String(index + 1).padStart(5, '0')}`, 'Kalite kontrol formu', 'Recall kalite kayıt bağlantısı', index % 5 === 0 ? 'Uygunsuz' : 'Koşullu')
    ],
    haccpRecords: [
      createRelatedRecord('HACCP_RECORD', `haccp_record_${index}`, `HACCP-${String(index + 1).padStart(5, '0')}`, 'HACCP kritik nokta kaydı', INDUSTRIAL_NOTES[index % INDUSTRIAL_NOTES.length], index % 4 === 0 ? 'Fail' : 'İzlemede')
    ]
  }
}

const countUnique = (records: ProductRecallRelatedRecord[]) => new Set(records.map(record => record.id || record.no)).size

const calculateImpact = (
  traceability: ProductRecallTraceability,
  status: ProductRecallStatus,
  reportedDate: string,
  resolvedDate: string
): ProductRecallImpactAnalysis => {
  const completed = status === 'COMPLETED'
  const cancelled = status === 'CANCELLED'
  return {
    affectedProductCount: countUnique(traceability.products),
    affectedLotCount: countUnique([...traceability.lots, ...traceability.subLots]),
    affectedCustomerCount: countUnique(traceability.customers),
    affectedShipmentCount: countUnique(traceability.shipments),
    affectedWarehouseCount: countUnique(traceability.warehouses),
    affectedProductionOrderCount: countUnique(traceability.productionOrders),
    affectedRecipeCount: countUnique(traceability.recipes),
    averageCompletionDays: completed || cancelled ? diffDays(reportedDate, resolvedDate || getTodayKey()) : 0,
    successRate: completed ? 100 : cancelled ? 0 : 65
  }
}

const createActionLogs = (
  recallId: string,
  status: ProductRecallStatus,
  actorName: string,
  reportedDate: string,
  index: number
): ProductRecallActionLog[] => {
  const actionCount = 5
  return Array.from({ length: actionCount }, (_, actionIndex) => {
    const actionType = PRODUCT_RECALL_ACTION_TYPES[(index + actionIndex) % PRODUCT_RECALL_ACTION_TYPES.length]
    const actionDate = addDays(reportedDate, actionIndex)
    const actionTime = `${String(8 + ((index + actionIndex) % 9)).padStart(2, '0')}:${String((index * 7 + actionIndex * 11) % 60).padStart(2, '0')}`
    const isOpen = !isClosedStatus(status) && actionIndex >= 3
    return {
      id: `${recallId}_log_${actionIndex + 1}`,
      recallId,
      actionType,
      actorName: RESPONSIBLES[(index + actionIndex) % RESPONSIBLES.length],
      actionDate,
      actionTime,
      description: `${PRODUCT_RECALL_ACTION_LABELS[actionType]} aksiyonu ${actorName} koordinasyonunda loglandı.`,
      isOpen,
      createdAt: `${actionDate}T${actionTime}:00.000Z`
    }
  })
}

const getTimelineStages = (status: ProductRecallStatus): ProductRecallTimelineStage[] => {
  if(status === 'DRAFT') return ['CREATED']
  if(status === 'REVIEWING') return ['CREATED', 'SENT_FOR_APPROVAL']
  if(status === 'APPROVED') return ['CREATED', 'SENT_FOR_APPROVAL', 'APPROVED']
  if(status === 'IN_OPERATION') return ['CREATED', 'SENT_FOR_APPROVAL', 'APPROVED', 'OPERATION_STARTED', 'NOTIFICATION_SENT']
  return ['CREATED', 'SENT_FOR_APPROVAL', 'APPROVED', 'OPERATION_STARTED', 'NOTIFICATION_SENT', 'CLOSED']
}

const createTimeline = (
  recallId: string,
  status: ProductRecallStatus,
  actorName: string,
  reportedDate: string,
  index: number
): ProductRecallTimelineEvent[] => getTimelineStages(status).map((stage, stageIndex) => ({
  id: `${recallId}_timeline_${stageIndex + 1}`,
  recallId,
  stage,
  title: PRODUCT_RECALL_TIMELINE_LABELS[stage],
  description: `${PRODUCT_RECALL_TIMELINE_LABELS[stage]} adımı ${PRODUCT_RECALL_TYPE_LABELS[TYPE_ROTATION[index % TYPE_ROTATION.length]]} kapsamında kaydedildi.`,
  actorName: RESPONSIBLES[(index + stageIndex) % RESPONSIBLES.length] || actorName,
  occurredAt: addHoursIso(`${addDays(reportedDate, Math.min(stageIndex, 4))}T09:00:00`, stageIndex * 2)
}))

const createDocuments = (
  recallId: string,
  index: number,
  reportedDate: string
): ProductRecallDocument[] => [
  {
    id: `${recallId}_doc_root`,
    documentNo: `RCL-DOC-${String(index + 1).padStart(5, '0')}`,
    title: 'Recall değerlendirme formu',
    documentType: 'PDF',
    owner: 'Kalite Güvence',
    createdAt: `${reportedDate}T10:30:00.000Z`
  },
  {
    id: `${recallId}_doc_trace`,
    documentNo: `TRACE-${String(index + 1).padStart(5, '0')}`,
    title: 'İzlenebilirlik ağı çıktısı',
    documentType: 'Excel',
    owner: 'İzlenebilirlik Ekibi',
    createdAt: `${reportedDate}T11:15:00.000Z`
  }
]

export const getNextProductRecallNo = (records: ProductRecall[], offset = 0) => {
  const maxNo = records.reduce((max, recall) => {
    const match = recall.recallNo.match(/RCL-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RCL-${String(maxNo + 1 + offset).padStart(6, '0')}`
}

export const validateProductRecallInput = (
  input: ProductRecallInput,
  inventoryLotMap: Map<string, InventoryLot>,
  existingRecalls: ProductRecall[],
  currentRecallId = ''
) => {
  if(!input.inventoryLotId.trim()) return 'Lot zorunludur.'
  if(!input.recallNo.trim()) return 'Recall No zorunludur.'
  if(!input.recallType.trim()) return 'Recall türü zorunludur.'
  if(!input.reason.trim()) return 'Sebep zorunludur.'
  if(!input.riskLevel.trim()) return 'Risk seviyesi zorunludur.'
  if(!input.priority.trim()) return 'Öncelik zorunludur.'
  if(!input.status.trim()) return 'Durum zorunludur.'
  if(!input.reportedDate.trim()) return 'Başlatılma tarihi zorunludur.'
  if(!input.targetCompletionDate.trim()) return 'Hedef tamamlanma tarihi zorunludur.'
  if(!Number.isFinite(input.affectedQuantity)) return 'Etkilenen miktar geçerli sayı olmalıdır.'
  if(input.affectedQuantity <= 0) return 'Etkilenen miktar 0’dan büyük olmalıdır.'
  if(!input.initiatedBy.trim()) return 'Başlatan zorunludur.'
  if(!input.responsiblePerson.trim()) return 'Sorumlu zorunludur.'
  if(!inventoryLotMap.has(input.inventoryLotId)) return 'Lot bulunamadı.'
  if(input.targetCompletionDate && input.targetCompletionDate < input.reportedDate) return 'Hedef tamamlanma tarihi başlangıçtan önce olamaz.'
  if(input.resolvedDate && input.resolvedDate < input.reportedDate) return 'Tamamlanma tarihi başlangıçtan önce olamaz.'

  const normalizedRecallNo = normalizeSearchKey(input.recallNo)
  const duplicateRecall = existingRecalls.find(recall => (
    recall.id !== currentRecallId && normalizeSearchKey(recall.recallNo) === normalizedRecallNo
  ))

  return duplicateRecall ? 'Recall No benzersiz olmalıdır.' : ''
}

export const createProductRecallRecord = (
  input: ProductRecallInput,
  existingRecall?: ProductRecall
): ProductRecall => {
  const now = new Date().toISOString()
  const createdAt = existingRecall?.createdAt || now
  const riskLevel = normalizeRiskLevel(input.riskLevel)
  const status = normalizeStatus(input.status)
  const recallId = existingRecall?.id || createId('product_recall')
  const lot = createFallbackLot(0)
  const seedTraceability = createSeedTraceability({
    ...lot,
    id: input.inventoryLotId,
    lotNo: input.inventoryLotId,
    warehouseId: input.warehouseId || input.branchId || lot.warehouseId,
    supplierId: input.supplierId,
    unit: input.unit
  }, 0, 1, 1)
  const traceability = existingRecall?.traceability || seedTraceability
  const reportedDate = toDateKey(input.reportedDate)
  const resolvedDate = input.resolvedDate
    ? toDateKey(input.resolvedDate, reportedDate)
    : status === 'COMPLETED'
      ? getTodayKey()
      : ''
  const impactAnalysis = calculateImpact(traceability, status, reportedDate, resolvedDate)
  const actionLogs = existingRecall?.actionLogs?.length
    ? existingRecall.actionLogs
    : createActionLogs(recallId, status, input.initiatedBy || input.createdBy, reportedDate, 0)
  const timeline = existingRecall?.timeline?.length
    ? existingRecall.timeline
    : createTimeline(recallId, status, input.initiatedBy || input.createdBy, reportedDate, 0)
  const documents = existingRecall?.documents?.length
    ? existingRecall.documents
    : createDocuments(recallId, 0, reportedDate)

  return {
    id: recallId,
    recallNo: input.recallNo.trim(),
    recallType: normalizeType(input.recallType),
    inventoryLotId: input.inventoryLotId,
    reason: normalizeReason(input.reason),
    riskLevel,
    priority: normalizePriority(input.priority, riskLevel),
    status,
    affectedQuantity: roundQuantity(input.affectedQuantity),
    unit: normalizeUnit(input.unit),
    reportedDate,
    startedAt: toDateTimeIso(input.startedAt || input.reportedDate, reportedDate),
    targetCompletionDate: toDateKey(input.targetCompletionDate, addDays(reportedDate, 5)),
    resolvedDate,
    description: input.description.trim(),
    riskAnalysis: input.riskAnalysis.trim() || `${PRODUCT_RECALL_RISK_LEVEL_LABELS[riskLevel]} risk seviyesi için etki analizi başlatıldı.`,
    initiatedBy: input.initiatedBy.trim(),
    responsiblePerson: input.responsiblePerson.trim(),
    branchId: input.branchId,
    warehouseId: input.warehouseId || input.branchId,
    supplierId: input.supplierId,
    affectedCustomerCount: impactAnalysis.affectedCustomerCount,
    affectedShipmentCount: impactAnalysis.affectedShipmentCount,
    traceability,
    impactAnalysis,
    actionLogs,
    timeline,
    documents,
    lastActionSummary: actionLogs[0]?.description || 'Recall kaydı oluşturuldu.',
    createdBy: input.createdBy.trim(),
    createdAt,
    updatedAt: now
  }
}

export const createProductRecallMockData = (
  inventoryLots: InventoryLot[],
  existingRecalls: ProductRecall[] = []
): ProductRecall[] => {
  const sourceLots = getSourceLots(inventoryLots)
  const recallNos = new Set(existingRecalls.map(recall => normalizeSearchKey(recall.recallNo)))
  const recallIds = new Set(existingRecalls.map(recall => recall.id))

  return Array.from({ length: SEED_RECALL_COUNT }, (_, index) => {
    const lot = sourceLots[index % sourceLots.length]
    const recallType = TYPE_ROTATION[index % TYPE_ROTATION.length]
    const reason = REASON_ROTATION[index % REASON_ROTATION.length]
    const riskLevel: ProductRecallRiskLevel = index < 40
      ? 'CRITICAL'
      : PRODUCT_RECALL_RISK_LEVELS[(index + 1) % PRODUCT_RECALL_RISK_LEVELS.length]
    const priority = normalizePriority('', riskLevel)
    const status = STATUS_ROTATION[index % STATUS_ROTATION.length]
    const reportedDate = addDays(lot.productionDate || getTodayKey(), 2 + (index % 15))
    const targetCompletionDate = addDays(reportedDate, riskLevel === 'CRITICAL' ? 3 : 5 + (index % 5))
    const resolvedDate = status === 'COMPLETED'
      ? addDays(reportedDate, 2 + (index % 4))
      : status === 'CANCELLED'
        ? addDays(reportedDate, 1 + (index % 3))
        : ''
    let sequence = index + 1
    let recallNo = `RCL-${String(sequence).padStart(6, '0')}`
    let recallId = `product_recall_${String(index + 1).padStart(3, '0')}`

    while(recallNos.has(normalizeSearchKey(recallNo))){
      sequence += 1
      recallNo = `RCL-${String(sequence).padStart(6, '0')}`
    }
    recallNos.add(normalizeSearchKey(recallNo))

    while(recallIds.has(recallId)){
      sequence += 1
      recallId = `product_recall_${String(sequence).padStart(3, '0')}`
    }
    recallIds.add(recallId)

    const sourceQuantity = lot.remainingQuantity || lot.quantity || lot.receivedQuantity || 1
    const affectedQuantity = roundQuantity(Math.max(0.001, sourceQuantity * (0.1 + (index % 6) * 0.045)))
    const shipmentCount = index < 80 ? 1 + (index % 3) : (index % 6 === 0 ? 1 : 0)
    const customerCount = index < 50 ? 1 + (index % 4) : (shipmentCount > 0 ? 1 : 0)
    const traceability = createSeedTraceability(lot, index, shipmentCount, customerCount)
    const impactAnalysis = calculateImpact(traceability, status, reportedDate, resolvedDate)
    const initiatedBy = INITIATORS[index % INITIATORS.length]
    const actionLogs = createActionLogs(recallId, status, initiatedBy, reportedDate, index)
    const timeline = createTimeline(recallId, status, initiatedBy, reportedDate, index)
    const documents = createDocuments(recallId, index, reportedDate)
    const createdAt = `${reportedDate}T${String(8 + (index % 8)).padStart(2, '0')}:${String((index * 5) % 60).padStart(2, '0')}:00.000Z`

    return {
      id: recallId,
      recallNo,
      recallType,
      inventoryLotId: lot.id,
      reason,
      riskLevel,
      priority,
      status,
      affectedQuantity,
      unit: lot.unit,
      reportedDate,
      startedAt: createdAt,
      targetCompletionDate,
      resolvedDate,
      description: `${PRODUCT_RECALL_TYPE_LABELS[recallType]} için ${PRODUCT_RECALL_REASON_LABELS[reason]} kaynaklı süreç yönetimi başlatıldı. Gerçek stok hareketi veya sevkiyat iptali oluşturulmaz.`,
      riskAnalysis: `${INDUSTRIAL_NOTES[index % INDUSTRIAL_NOTES.length]} nedeniyle ${PRODUCT_RECALL_RISK_LEVEL_LABELS[riskLevel]} risk izleniyor. Etkilenen lot, müşteri ve sevkiyat ilişkileri karar destek için analiz edildi.`,
      initiatedBy,
      responsiblePerson: RESPONSIBLES[index % RESPONSIBLES.length],
      branchId: lot.warehouseId,
      warehouseId: lot.warehouseId,
      supplierId: lot.supplierId,
      affectedCustomerCount: impactAnalysis.affectedCustomerCount,
      affectedShipmentCount: impactAnalysis.affectedShipmentCount,
      traceability,
      impactAnalysis,
      actionLogs,
      timeline,
      documents,
      lastActionSummary: actionLogs[0]?.description || 'Recall kaydı oluşturuldu.',
      createdBy: initiatedBy,
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeTraceability = (
  value: unknown,
  fallback: ProductRecallTraceability
): ProductRecallTraceability => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<keyof ProductRecallTraceability, unknown>>
    : {}

  return {
    products: normalizeRelatedRecords(record.products, 'PRODUCT', fallback.products),
    lots: normalizeRelatedRecords(record.lots, 'LOT', fallback.lots),
    subLots: normalizeRelatedRecords(record.subLots, 'SUB_LOT', fallback.subLots),
    rawMaterials: normalizeRelatedRecords(record.rawMaterials, 'RAW_MATERIAL', fallback.rawMaterials),
    recipes: normalizeRelatedRecords(record.recipes, 'RECIPE', fallback.recipes),
    productionOrders: normalizeRelatedRecords(record.productionOrders, 'PRODUCTION_ORDER', fallback.productionOrders),
    productionCenters: normalizeRelatedRecords(record.productionCenters, 'PRODUCTION_CENTER', fallback.productionCenters),
    branches: normalizeRelatedRecords(record.branches, 'BRANCH', fallback.branches),
    warehouses: normalizeRelatedRecords(record.warehouses, 'WAREHOUSE', fallback.warehouses),
    shipments: normalizeRelatedRecords(record.shipments, 'SHIPMENT', fallback.shipments),
    deliveries: normalizeRelatedRecords(record.deliveries, 'DELIVERY', fallback.deliveries),
    customers: normalizeRelatedRecords(record.customers, 'CUSTOMER', fallback.customers),
    samples: normalizeRelatedRecords(record.samples, 'SAMPLE', fallback.samples),
    witnessSamples: normalizeRelatedRecords(record.witnessSamples, 'WITNESS_SAMPLE', fallback.witnessSamples),
    qualityForms: normalizeRelatedRecords(record.qualityForms, 'QUALITY_FORM', fallback.qualityForms),
    haccpRecords: normalizeRelatedRecords(record.haccpRecords, 'HACCP_RECORD', fallback.haccpRecords)
  }
}

const normalizeActionLogs = (
  value: unknown,
  recallId: string,
  status: ProductRecallStatus,
  actorName: string,
  reportedDate: string,
  index: number
) => {
  if(!Array.isArray(value)) return createActionLogs(recallId, status, actorName, reportedDate, index)
  const normalized = value
    .filter(item => Boolean(item) && typeof item === 'object')
    .map((item, actionIndex) => {
      const record = item as Partial<ProductRecallActionLog> & Record<string, unknown>
      const actionType = PRODUCT_RECALL_ACTION_TYPES.includes(normalizeText(record.actionType).toUpperCase() as ProductRecallActionType)
        ? normalizeText(record.actionType).toUpperCase() as ProductRecallActionType
        : PRODUCT_RECALL_ACTION_TYPES[(index + actionIndex) % PRODUCT_RECALL_ACTION_TYPES.length]
      const actionDate = toDateKey(record.actionDate, reportedDate)
      const actionTime = /^\d{2}:\d{2}$/.test(normalizeText(record.actionTime)) ? normalizeText(record.actionTime) : '09:00'
      return {
        id: normalizeText(record.id) || `${recallId}_log_${actionIndex + 1}`,
        recallId,
        actionType,
        actorName: normalizeText(record.actorName) || RESPONSIBLES[(index + actionIndex) % RESPONSIBLES.length],
        actionDate,
        actionTime,
        description: normalizeText(record.description) || PRODUCT_RECALL_ACTION_LABELS[actionType],
        isOpen: Boolean(record.isOpen),
        createdAt: toDateTimeIso(record.createdAt, `${actionDate}T${actionTime}:00`)
      }
    })

  return normalized.length >= 5 ? normalized : createActionLogs(recallId, status, actorName, reportedDate, index)
}

const normalizeTimeline = (
  value: unknown,
  recallId: string,
  status: ProductRecallStatus,
  actorName: string,
  reportedDate: string,
  index: number
) => {
  if(!Array.isArray(value)) return createTimeline(recallId, status, actorName, reportedDate, index)
  const normalized = value
    .filter(item => Boolean(item) && typeof item === 'object')
    .map((item, eventIndex) => {
      const record = item as Partial<ProductRecallTimelineEvent> & Record<string, unknown>
      const stageText = normalizeText(record.stage).toUpperCase() as ProductRecallTimelineStage
      const stage = Object.keys(PRODUCT_RECALL_TIMELINE_LABELS).includes(stageText) ? stageText : getTimelineStages(status)[Math.min(eventIndex, getTimelineStages(status).length - 1)]
      return {
        id: normalizeText(record.id) || `${recallId}_timeline_${eventIndex + 1}`,
        recallId,
        stage,
        title: normalizeText(record.title) || PRODUCT_RECALL_TIMELINE_LABELS[stage],
        description: normalizeText(record.description) || `${PRODUCT_RECALL_TIMELINE_LABELS[stage]} adımı kaydedildi.`,
        actorName: normalizeText(record.actorName) || actorName,
        occurredAt: toDateTimeIso(record.occurredAt, reportedDate)
      }
    })

  return normalized.length >= 1 ? normalized : createTimeline(recallId, status, actorName, reportedDate, index)
}

const normalizeDocuments = (
  value: unknown,
  recallId: string,
  index: number,
  reportedDate: string
) => {
  if(!Array.isArray(value)) return createDocuments(recallId, index, reportedDate)
  const normalized = value
    .filter(item => Boolean(item) && typeof item === 'object')
    .map((item, documentIndex) => {
      const record = item as Partial<ProductRecallDocument> & Record<string, unknown>
      return {
        id: normalizeText(record.id) || `${recallId}_doc_${documentIndex + 1}`,
        documentNo: normalizeText(record.documentNo) || `RCL-DOC-${String(index + documentIndex + 1).padStart(5, '0')}`,
        title: normalizeText(record.title) || 'Recall dokümanı',
        documentType: normalizeText(record.documentType) || 'PDF',
        owner: normalizeText(record.owner) || 'Kalite Güvence',
        createdAt: toDateTimeIso(record.createdAt, reportedDate)
      }
    })

  return normalized.length > 0 ? normalized : createDocuments(recallId, index, reportedDate)
}

const normalizeProductRecall = (
  item: RawProductRecallRecord,
  index: number,
  inventoryLots: InventoryLot[] = []
): ProductRecall => {
  const sourceLots = getSourceLots(inventoryLots)
  const lot = sourceLots.find(record => record.id === normalizeText(item.inventoryLotId)) || sourceLots[index % sourceLots.length]
  const id = normalizeText(item.id) || `product_recall_${Date.now()}_${index}`
  const recallNo = normalizeText(item.recallNo) || `RCL-${String(index + 1).padStart(6, '0')}`
  const recallType = normalizeType(item.recallType)
  const reason = normalizeReason(item.reason)
  const riskLevel = normalizeRiskLevel(item.riskLevel)
  const priority = normalizePriority(item.priority, riskLevel)
  const status = normalizeStatus(item.status)
  const reportedDate = toDateKey(item.reportedDate, lot.productionDate || getTodayKey())
  const targetCompletionDate = toDateKey(item.targetCompletionDate, addDays(reportedDate, riskLevel === 'CRITICAL' ? 3 : 6))
  const resolvedDate = normalizeText(item.resolvedDate) ? toDateKey(item.resolvedDate, reportedDate) : ''
  const shipmentCount = index < 80 ? 1 + (index % 3) : 0
  const customerCount = index < 50 ? 1 + (index % 4) : shipmentCount > 0 ? 1 : 0
  const fallbackTraceability = createSeedTraceability(lot, index, shipmentCount, customerCount)
  const traceability = normalizeTraceability(item.traceability, fallbackTraceability)
  const impactAnalysis = calculateImpact(traceability, status, reportedDate, resolvedDate)
  const initiatedBy = normalizeText(item.initiatedBy) || normalizeText(item.createdBy) || INITIATORS[index % INITIATORS.length]
  const actionLogs = normalizeActionLogs(item.actionLogs, id, status, initiatedBy, reportedDate, index)
  const timeline = normalizeTimeline(item.timeline, id, status, initiatedBy, reportedDate, index)
  const documents = normalizeDocuments(item.documents, id, index, reportedDate)
  const affectedQuantity = roundQuantity(normalizePositiveNumber(item.affectedQuantity, Math.max(0.001, (lot.remainingQuantity || lot.quantity || 1) * 0.1)))

  return {
    id,
    recallNo,
    recallType,
    inventoryLotId: normalizeText(item.inventoryLotId) || lot.id,
    reason,
    riskLevel,
    priority,
    status,
    affectedQuantity,
    unit: normalizeUnit(item.unit || lot.unit),
    reportedDate,
    startedAt: toDateTimeIso(item.startedAt || item.createdAt || reportedDate, reportedDate),
    targetCompletionDate,
    resolvedDate,
    description: normalizeText(item.description) || `${PRODUCT_RECALL_TYPE_LABELS[recallType]} için ${PRODUCT_RECALL_REASON_LABELS[reason]} kaynaklı süreç yönetimi başlatıldı.`,
    riskAnalysis: normalizeText(item.riskAnalysis) || `${PRODUCT_RECALL_RISK_LEVEL_LABELS[riskLevel]} risk seviyesi için etki analizi otomatik hesaplandı.`,
    initiatedBy,
    responsiblePerson: normalizeText(item.responsiblePerson) || RESPONSIBLES[index % RESPONSIBLES.length],
    branchId: normalizeText(item.branchId) || lot.warehouseId,
    warehouseId: normalizeText(item.warehouseId) || lot.warehouseId,
    supplierId: normalizeText(item.supplierId) || lot.supplierId,
    affectedCustomerCount: impactAnalysis.affectedCustomerCount,
    affectedShipmentCount: impactAnalysis.affectedShipmentCount,
    traceability,
    impactAnalysis,
    actionLogs,
    timeline,
    documents,
    lastActionSummary: normalizeText(item.lastActionSummary) || actionLogs[0]?.description || 'Recall kaydı oluşturuldu.',
    createdBy: normalizeText(item.createdBy) || initiatedBy,
    createdAt: toDateTimeIso(item.createdAt, reportedDate),
    updatedAt: toDateTimeIso(item.updatedAt || item.createdAt, reportedDate)
  }
}

export const saveProductRecallRecords = (records: ProductRecall[]) => {
  if(!isBrowserStorageAvailable()) return
  try{
    localStorage.setItem(PRODUCT_RECALL_STORAGE_KEY, JSON.stringify(records.map((record, index) => normalizeProductRecall(record, index))))
  } catch {
    localStorage.removeItem(PRODUCT_RECALL_STORAGE_KEY)
  }
}

const hasSeedCoverage = (records: ProductRecall[]) => (
  records.length >= SEED_RECALL_COUNT
  && records.filter(record => record.riskLevel === 'CRITICAL').length >= 40
  && new Set(records.flatMap(record => [...record.traceability.lots, ...record.traceability.subLots].map(lot => lot.id))).size >= 60
  && records.reduce((total, record) => total + record.impactAnalysis.affectedShipmentCount, 0) >= 80
  && records.reduce((total, record) => total + record.impactAnalysis.affectedCustomerCount, 0) >= 50
  && records.reduce((total, record) => total + record.timeline.length, 0) >= 300
  && records.reduce((total, record) => total + record.actionLogs.length, 0) >= 500
)

const ensureProductRecallSeeds = (
  records: ProductRecall[],
  inventoryLots: InventoryLot[]
) => {
  if(hasSeedCoverage(records)) return records

  const seedRecords = createProductRecallMockData(inventoryLots, records)
    .slice(0, Math.max(0, SEED_RECALL_COUNT - records.length))
  const mergedRecords = [...seedRecords, ...records]
  return mergedRecords
}

export const loadProductRecallRecords = (inventoryLots: InventoryLot[]) => {
  const seedRecords = createProductRecallMockData(inventoryLots)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PRODUCT_RECALL_STORAGE_KEY)

  if(!storedRecords){
    saveProductRecallRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeProductRecall(record, index, inventoryLots))
      const migratedRecords = ensureProductRecallSeeds(normalizedRecords, inventoryLots)
      saveProductRecallRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    saveProductRecallRecords(seedRecords)
    return seedRecords
  }

  saveProductRecallRecords(seedRecords)
  return seedRecords
}
