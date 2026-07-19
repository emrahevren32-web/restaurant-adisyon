import type { InventoryLot, InventoryLotStatus } from '../inventory-lots/inventory-lot.types'
import type {
  QualityControl,
  QualityControlDecision,
  QualityControlStatus
} from './quality-control.types'

export const QUALITY_CONTROL_STORAGE_KEY = 'ra_quality_controls'

export const QUALITY_CONTROL_DECISIONS: QualityControlDecision[] = [
  'APPROVED',
  'REJECTED',
  'QUARANTINE'
]

export const QUALITY_CONTROL_STATUSES: QualityControlStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED'
]

export const QUALITY_CONTROL_DECISION_LABELS: Record<QualityControlDecision, string> = {
  APPROVED: 'Kabul',
  REJECTED: 'Red',
  QUARANTINE: 'Karantina'
}

export const QUALITY_CONTROL_STATUS_LABELS: Record<QualityControlStatus, string> = {
  PENDING: 'Bekliyor',
  IN_PROGRESS: 'Kontrolde',
  COMPLETED: 'Tamamlandı'
}

type RawQualityControlRecord = Partial<Record<keyof QualityControl, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: QualityControlStatus = 'PENDING'
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawQualityControlRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeDecision = (value: unknown): QualityControlDecision | '' => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_CONTROL_DECISIONS.includes(normalized as QualityControlDecision)
    ? normalized as QualityControlDecision
    : ''
}

const normalizeStatus = (value: unknown): QualityControlStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_CONTROL_STATUSES.includes(normalized as QualityControlStatus)
    ? normalized as QualityControlStatus
    : DEFAULT_STATUS
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

export const getNextQualityControlNo = (records: QualityControl[]) => {
  const maxNo = records.reduce((max, qc) => {
    const match = qc.qcNo.match(/QC-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `QC-${String(maxNo + 1).padStart(6, '0')}`
}

export const hasActiveQualityControl = (
  records: QualityControl[],
  inventoryLotId: string,
  excludedQualityControlId = ''
) => (
  records.some(record => (
    record.id !== excludedQualityControlId
    && record.inventoryLotId === inventoryLotId
    && record.status !== 'COMPLETED'
  ))
)

export const getQualityDecisionLotStatus = (
  decision: QualityControlDecision
): InventoryLotStatus => {
  if(decision === 'APPROVED') return 'ACTIVE'
  if(decision === 'REJECTED') return 'BLOCKED'
  return 'QUARANTINE'
}

export const applyQualityDecisionToLot = (
  lot: InventoryLot,
  decision: QualityControlDecision
): InventoryLot => {
  const status = getQualityDecisionLotStatus(decision)

  return {
    ...lot,
    status,
    updatedAt: new Date().toISOString()
  }
}

export const applyCompletedQualityControlsToInventoryLots = (
  inventoryLots: InventoryLot[],
  records: QualityControl[]
) => {
  const completedRecordsByLot = new Map<string, QualityControl>()

  records.forEach(record => {
    if(record.status === 'COMPLETED' && record.decision){
      completedRecordsByLot.set(record.inventoryLotId, record)
    }
  })

  return inventoryLots.map(lot => {
    const completedRecord = completedRecordsByLot.get(lot.id)
    if(!completedRecord || !completedRecord.decision) return lot

    const nextStatus = getQualityDecisionLotStatus(completedRecord.decision)
    return lot.status === nextStatus ? lot : applyQualityDecisionToLot(lot, completedRecord.decision)
  })
}

const createSeedRecords = () => [
  { decision: 'APPROVED' as const, status: 'COMPLETED' as const, inspector: 'Kalite Uzmanı', sampleRate: 0.02, note: 'Duyusal kontrol uygun.' },
  { decision: 'REJECTED' as const, status: 'COMPLETED' as const, inspector: 'Gıda Mühendisi', sampleRate: 0.03, note: 'Ambalaj ve koku uygunsuzluğu.' },
  { decision: 'QUARANTINE' as const, status: 'COMPLETED' as const, inspector: 'Kalite Şefi', sampleRate: 0.025, note: 'Ek kontrol için karantinaya alındı.' },
  { decision: 'APPROVED' as const, status: 'COMPLETED' as const, inspector: 'Kalite Uzmanı', sampleRate: 0.015, note: 'Sıcaklık ve fiziksel kontrol uygun.' },
  { decision: 'QUARANTINE' as const, status: 'COMPLETED' as const, inspector: 'Mal Kabul Kalite', sampleRate: 0.02, note: 'Etiket doğrulaması bekleniyor.' },
  { decision: 'REJECTED' as const, status: 'COMPLETED' as const, inspector: 'Gıda Mühendisi', sampleRate: 0.02, note: 'Numune görünümü uygun değil.' },
  { decision: 'APPROVED' as const, status: 'COMPLETED' as const, inspector: 'Kalite Uzmanı', sampleRate: 0.018, note: 'Standart kabul kriterlerini karşıladı.' },
  { decision: '' as const, status: 'IN_PROGRESS' as const, inspector: 'Kalite Ekibi', sampleRate: 0.02, note: 'Kontrol devam ediyor.' },
  { decision: '' as const, status: 'PENDING' as const, inspector: 'Kalite Ekibi', sampleRate: 0.01, note: 'Numune bekleniyor.' },
  { decision: 'APPROVED' as const, status: 'COMPLETED' as const, inspector: 'Kalite Şefi', sampleRate: 0.022, note: 'Lot üretim için uygun.' },
  { decision: 'REJECTED' as const, status: 'COMPLETED' as const, inspector: 'Gıda Mühendisi', sampleRate: 0.03, note: 'Tedarikçi bilgilendirilecek.' },
  { decision: 'QUARANTINE' as const, status: 'COMPLETED' as const, inspector: 'Kalite Uzmanı', sampleRate: 0.02, note: 'Karantina alanında tutulacak.' },
  { decision: 'APPROVED' as const, status: 'COMPLETED' as const, inspector: 'Mal Kabul Kalite', sampleRate: 0.015, note: 'Belge kontrolü uygun.' },
  { decision: 'REJECTED' as const, status: 'COMPLETED' as const, inspector: 'Kalite Şefi', sampleRate: 0.025, note: 'Parti kabul edilmedi.' },
  { decision: 'QUARANTINE' as const, status: 'COMPLETED' as const, inspector: 'Gıda Mühendisi', sampleRate: 0.02, note: 'Laboratuvar dışı gözlem bekleniyor.' }
]

export const createQualityControlMockData = (
  inventoryLots: InventoryLot[]
): QualityControl[] => {
  const sourceLots = inventoryLots.slice(0, 15)

  return createSeedRecords()
    .slice(0, sourceLots.length)
    .map((seed, index) => {
      const lot = sourceLots[index]
      const inspectionDate = `2026-07-${String(22 + (index % 6)).padStart(2, '0')}`
      const createdAt = `${inspectionDate}T14:${String(index * 3).padStart(2, '0')}:00.000Z`
      const sampleQuantity = roundQuantity(Math.min(
        lot.remainingQuantity,
        Math.max(0.001, lot.remainingQuantity * seed.sampleRate)
      ))

      return {
        id: `quality_control_${String(index + 1).padStart(3, '0')}`,
        qcNo: `QC-${String(index + 1).padStart(6, '0')}`,
        inventoryLotId: lot.id,
        goodsReceiptId: lot.goodsReceiptId,
        stockItemId: lot.stockItemId,
        supplierId: lot.supplierId,
        warehouseId: lot.warehouseId,
        inspectionDate,
        inspector: seed.inspector,
        sampleQuantity,
        decision: seed.decision,
        status: seed.status,
        notes: seed.note,
        createdAt,
        updatedAt: createdAt
      }
    })
}

const normalizeQualityControl = (item: RawQualityControlRecord, index: number): QualityControl => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const status = normalizeStatus(item.status)
  const decision = normalizeDecision(item.decision)
  const normalizedStatus = status === 'COMPLETED' && !decision ? DEFAULT_STATUS : status

  return {
    id: normalizeText(item.id) || `quality_control_${Date.now()}_${index}`,
    qcNo: normalizeText(item.qcNo) || `QC-${String(index + 1).padStart(6, '0')}`,
    inventoryLotId: normalizeText(item.inventoryLotId),
    goodsReceiptId: normalizeText(item.goodsReceiptId),
    stockItemId: normalizeText(item.stockItemId),
    supplierId: normalizeText(item.supplierId),
    warehouseId: normalizeText(item.warehouseId),
    inspectionDate: normalizeText(item.inspectionDate) || new Date().toLocaleDateString('sv-SE'),
    inspector: normalizeText(item.inspector) || 'Kalite Kontrol',
    sampleQuantity: normalizeNonNegativeNumber(item.sampleQuantity),
    decision,
    status: normalizedStatus,
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveQualityControlRecords = (records: QualityControl[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QUALITY_CONTROL_STORAGE_KEY, JSON.stringify(records))
}

export const loadQualityControlRecords = (inventoryLots: InventoryLot[]) => {
  const seedRecords = createQualityControlMockData(inventoryLots)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(QUALITY_CONTROL_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveQualityControlRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeQualityControl)

      saveQualityControlRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveQualityControlRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveQualityControlRecords(seedRecords)
  return seedRecords
}
