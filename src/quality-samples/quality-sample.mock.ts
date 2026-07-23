import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type {
  QualitySample,
  QualitySampleStatus,
  QualitySampleType
} from './quality-sample.types'

export const QUALITY_SAMPLE_STORAGE_KEY = 'ra_quality_samples'

export const QUALITY_SAMPLE_TYPES: QualitySampleType[] = [
  'RAW_MATERIAL',
  'SEMI_PRODUCT',
  'FINISHED_PRODUCT',
  'PACKAGING',
  'OTHER'
]

export const QUALITY_SAMPLE_STATUSES: QualitySampleStatus[] = [
  'COLLECTED',
  'STORED',
  'UNDER_REVIEW',
  'RELEASED',
  'DISCARDED'
]

export const QUALITY_SAMPLE_TYPE_LABELS: Record<QualitySampleType, string> = {
  RAW_MATERIAL: 'Hammadde',
  SEMI_PRODUCT: 'Ara Ürün',
  FINISHED_PRODUCT: 'Son Ürün',
  PACKAGING: 'Ambalaj',
  OTHER: 'Diğer'
}

export const QUALITY_SAMPLE_STATUS_LABELS: Record<QualitySampleStatus, string> = {
  COLLECTED: 'Alındı',
  STORED: 'Saklanıyor',
  UNDER_REVIEW: 'İncelemede',
  RELEASED: 'Serbest',
  DISCARDED: 'İmha Edildi'
}

export type QualitySampleInput = {
  sampleNo: string
  inventoryLotId: string
  sampleType: QualitySampleType
  sampleDate: string
  expiryDate: string
  status: QualitySampleStatus
  takenBy: string
  storageLocation: string
  notes: string
}

type RawQualitySampleRecord = Partial<Record<keyof QualitySample, unknown>> & Record<string, unknown>

const DEFAULT_SAMPLE_TYPE: QualitySampleType = 'FINISHED_PRODUCT'
const DEFAULT_SAMPLE_STATUS: QualitySampleStatus = 'COLLECTED'

const SAMPLE_TYPE_ROTATION: QualitySampleType[] = [
  'RAW_MATERIAL',
  'SEMI_PRODUCT',
  'FINISHED_PRODUCT',
  'PACKAGING',
  'OTHER',
  'FINISHED_PRODUCT'
]

const SAMPLE_STATUS_ROTATION: QualitySampleStatus[] = [
  'COLLECTED',
  'STORED',
  'UNDER_REVIEW',
  'RELEASED',
  'DISCARDED',
  'STORED'
]

const SAMPLE_TAKERS = [
  'Kalite Uzmanı',
  'Üretim Şefi',
  'Gıda Mühendisi',
  'Vardiya Sorumlusu',
  'Kalite Ekibi'
]

const STORAGE_LOCATIONS = [
  'Soğuk Oda A-01',
  'Numune Dolabı B-02',
  'Karantina Rafı C-03',
  'Kuru Depo Numune Rafı',
  'Kalite Laboratuvar Dolabı'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawQualitySampleRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeSampleType = (value: unknown): QualitySampleType => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_SAMPLE_TYPES.includes(normalized as QualitySampleType)
    ? normalized as QualitySampleType
    : DEFAULT_SAMPLE_TYPE
}

const normalizeSampleStatus = (value: unknown): QualitySampleStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_SAMPLE_STATUSES.includes(normalized as QualitySampleStatus)
    ? normalized as QualitySampleStatus
    : DEFAULT_SAMPLE_STATUS
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue || getTodayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const getNextQualitySampleNo = (records: QualitySample[], offset = 0) => {
  const maxNo = records.reduce((max, sample) => {
    const match = sample.sampleNo.match(/SMP-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `SMP-${String(maxNo + 1 + offset).padStart(6, '0')}`
}

export const validateQualitySampleInput = (
  input: QualitySampleInput,
  inventoryLotMap: Map<string, InventoryLot>,
  existingSamples: QualitySample[],
  currentSampleId = ''
) => {
  if(!input.inventoryLotId.trim()) return 'Inventory Lot zorunludur.'
  if(!input.sampleType.trim()) return 'Sample Type zorunludur.'
  if(!input.sampleDate.trim()) return 'Sample Date zorunludur.'
  if(!input.expiryDate.trim()) return 'Expiry Date zorunludur.'
  if(!input.takenBy.trim()) return 'Taken By zorunludur.'
  if(!input.sampleNo.trim()) return 'Sample No zorunludur.'

  const lot = inventoryLotMap.get(input.inventoryLotId)
  if(!lot) return 'Inventory Lot bulunamadı.'
  if(lot.productionDate && input.sampleDate < lot.productionDate){
    return 'Sample Date, Lot üretim tarihinden önce olamaz.'
  }
  if(input.expiryDate < input.sampleDate){
    return 'Expiry Date, Sample Date değerinden küçük olamaz.'
  }

  const normalizedSampleNo = normalizeSearchKey(input.sampleNo)
  const duplicateSample = existingSamples.find(sample => (
    sample.id !== currentSampleId && normalizeSearchKey(sample.sampleNo) === normalizedSampleNo
  ))

  return duplicateSample ? 'Sample No benzersiz olmalıdır.' : ''
}

export const createQualitySampleRecord = (
  input: QualitySampleInput,
  existingSample?: QualitySample
): QualitySample => {
  const now = new Date().toISOString()
  const createdAt = existingSample?.createdAt || now

  return {
    id: existingSample?.id || createId('quality_sample'),
    sampleNo: input.sampleNo.trim(),
    inventoryLotId: input.inventoryLotId,
    sampleType: input.sampleType,
    sampleDate: input.sampleDate,
    expiryDate: input.expiryDate,
    status: input.status,
    takenBy: input.takenBy.trim(),
    storageLocation: input.storageLocation.trim(),
    notes: input.notes.trim(),
    createdAt,
    updatedAt: now
  }
}

export const createQualitySampleMockData = (
  inventoryLots: InventoryLot[],
  existingSamples: QualitySample[] = []
): QualitySample[] => {
  const sourceLots = inventoryLots.filter(lot => lot.productionOrderId && lot.productId).slice(0, 20)
  const fallbackLots = sourceLots.length > 0 ? sourceLots : inventoryLots.slice(0, 20)
  const sampleNos = new Set(existingSamples.map(sample => normalizeSearchKey(sample.sampleNo)))
  const sampleIds = new Set(existingSamples.map(sample => sample.id))

  return fallbackLots.map((lot, index) => {
    const sampleType = SAMPLE_TYPE_ROTATION[index % SAMPLE_TYPE_ROTATION.length]
    const status = SAMPLE_STATUS_ROTATION[index % SAMPLE_STATUS_ROTATION.length]
    const sampleDate = addDays(lot.productionDate || getTodayKey(), index % 4)
    const expiryDate = addDays(sampleDate, 5 + (index % 6) * 5)
    let sampleSequence = index + 1
    let sampleNo = `SMP-${String(sampleSequence).padStart(6, '0')}`
    let sampleId = `quality_sample_${String(index + 1).padStart(3, '0')}`

    while(sampleNos.has(normalizeSearchKey(sampleNo))){
      sampleSequence += 1
      sampleNo = `SMP-${String(sampleSequence).padStart(6, '0')}`
    }
    sampleNos.add(normalizeSearchKey(sampleNo))

    while(sampleIds.has(sampleId)){
      sampleSequence += 1
      sampleId = `quality_sample_${String(sampleSequence).padStart(3, '0')}`
    }
    sampleIds.add(sampleId)

    const createdAt = `${sampleDate}T${String(9 + (index % 7)).padStart(2, '0')}:${String(index * 2).padStart(2, '0')}:00.000Z`

    return {
      id: sampleId,
      sampleNo,
      inventoryLotId: lot.id,
      sampleType,
      sampleDate,
      expiryDate,
      status,
      takenBy: SAMPLE_TAKERS[index % SAMPLE_TAKERS.length],
      storageLocation: STORAGE_LOCATIONS[index % STORAGE_LOCATIONS.length],
      notes: 'Üretim sırasında alınan kalite numunesi.',
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeQualitySample = (item: RawQualitySampleRecord, index: number): QualitySample => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const sampleDate = normalizeText(item.sampleDate) || getTodayKey()
  const expiryDate = normalizeText(item.expiryDate) || addDays(sampleDate, 7)

  return {
    id: normalizeText(item.id) || `quality_sample_${Date.now()}_${index}`,
    sampleNo: normalizeText(item.sampleNo) || `SMP-${String(index + 1).padStart(6, '0')}`,
    inventoryLotId: normalizeText(item.inventoryLotId),
    sampleType: normalizeSampleType(item.sampleType),
    sampleDate,
    expiryDate: expiryDate < sampleDate ? sampleDate : expiryDate,
    status: normalizeSampleStatus(item.status),
    takenBy: normalizeText(item.takenBy) || 'Kalite Ekibi',
    storageLocation: normalizeText(item.storageLocation),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveQualitySampleRecords = (records: QualitySample[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QUALITY_SAMPLE_STORAGE_KEY, JSON.stringify(records.map(normalizeQualitySample)))
}

const ensureQualitySampleSeeds = (
  records: QualitySample[],
  inventoryLots: InventoryLot[]
) => {
  if(records.length >= 20) return records

  const seedRecords = createQualitySampleMockData(inventoryLots, records).slice(0, 20 - records.length)
  return seedRecords.length > 0 ? [...seedRecords, ...records] : records
}

export const loadQualitySampleRecords = (inventoryLots: InventoryLot[]) => {
  const seedRecords = createQualitySampleMockData(inventoryLots)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(QUALITY_SAMPLE_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveQualitySampleRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeQualitySample)
      const migratedRecords = ensureQualitySampleSeeds(normalizedRecords, inventoryLots)

      saveQualitySampleRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveQualitySampleRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveQualitySampleRecords(seedRecords)
  return seedRecords
}
