import type { QualitySample } from '../quality-samples/quality-sample.types'
import type {
  WitnessSample,
  WitnessSampleStatus
} from './witness-sample.types'

export const WITNESS_SAMPLE_STORAGE_KEY = 'ra_witness_samples'

export const WITNESS_SAMPLE_STATUSES: WitnessSampleStatus[] = [
  'STORED',
  'ACTIVE',
  'EXPIRED',
  'DISPOSED'
]

export const WITNESS_SAMPLE_STATUS_LABELS: Record<WitnessSampleStatus, string> = {
  STORED: 'Saklanıyor',
  ACTIVE: 'Aktif',
  EXPIRED: 'Süresi Doldu',
  DISPOSED: 'İmha Edildi'
}

export type WitnessSampleInput = {
  witnessNo: string
  qualitySampleId: string
  storageLocation: string
  storageStartDate: string
  storageEndDate: string
  status: WitnessSampleStatus
  responsiblePerson: string
  notes: string
}

type RawWitnessSampleRecord = Partial<Record<keyof WitnessSample, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: WitnessSampleStatus = 'STORED'

const WITNESS_STATUS_ROTATION: WitnessSampleStatus[] = [
  'STORED',
  'ACTIVE',
  'EXPIRED',
  'DISPOSED',
  'ACTIVE',
  'STORED'
]

const STORAGE_LOCATIONS = [
  'Şahit Numune Dolabı A-01',
  'Soğuk Oda Şahit Rafı B-02',
  'Karantina Numune Rafı C-03',
  'Kalite Arşiv Dolabı D-04',
  'Üretim Şahit Numune Alanı'
]

const RESPONSIBLE_PEOPLE = [
  'Kalite Şefi',
  'Gıda Mühendisi',
  'Kalite Uzmanı',
  'Üretim Sorumlusu',
  'Vardiya Kalite Ekibi'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawWitnessSampleRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeStatus = (value: unknown): WitnessSampleStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return WITNESS_SAMPLE_STATUSES.includes(normalized as WitnessSampleStatus)
    ? normalized as WitnessSampleStatus
    : DEFAULT_STATUS
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue || getTodayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const resolveWitnessSampleStatus = (
  status: WitnessSampleStatus,
  storageEndDate: string
): WitnessSampleStatus => {
  if(status === 'DISPOSED') return 'DISPOSED'
  if(storageEndDate && storageEndDate < getTodayKey()) return 'EXPIRED'
  if(status === 'EXPIRED') return 'ACTIVE'
  return status
}

export const getNextWitnessSampleNo = (records: WitnessSample[], offset = 0) => {
  const maxNo = records.reduce((max, sample) => {
    const match = sample.witnessNo.match(/WSP-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `WSP-${String(maxNo + 1 + offset).padStart(6, '0')}`
}

export const validateWitnessSampleInput = (
  input: WitnessSampleInput,
  qualitySampleMap: Map<string, QualitySample>,
  existingSamples: WitnessSample[],
  currentWitnessSampleId = ''
) => {
  if(!input.qualitySampleId.trim()) return 'Quality Sample zorunludur.'
  if(!input.storageLocation.trim()) return 'Storage Location zorunludur.'
  if(!input.storageStartDate.trim()) return 'Storage Start Date zorunludur.'
  if(!input.storageEndDate.trim()) return 'Storage End Date zorunludur.'
  if(!input.responsiblePerson.trim()) return 'Responsible Person zorunludur.'
  if(!input.witnessNo.trim()) return 'Witness No zorunludur.'
  if(!qualitySampleMap.has(input.qualitySampleId)) return 'Quality Sample bulunamadı.'
  if(input.storageEndDate < input.storageStartDate){
    return 'Storage End Date, Storage Start Date değerinden küçük olamaz.'
  }

  const normalizedWitnessNo = normalizeSearchKey(input.witnessNo)
  const duplicateRecord = existingSamples.find(sample => (
    sample.id !== currentWitnessSampleId && normalizeSearchKey(sample.witnessNo) === normalizedWitnessNo
  ))

  return duplicateRecord ? 'Witness No benzersiz olmalıdır.' : ''
}

export const createWitnessSampleRecord = (
  input: WitnessSampleInput,
  existingSample?: WitnessSample
): WitnessSample => {
  const now = new Date().toISOString()
  const createdAt = existingSample?.createdAt || now

  return {
    id: existingSample?.id || createId('witness_sample'),
    witnessNo: input.witnessNo.trim(),
    qualitySampleId: input.qualitySampleId,
    storageLocation: input.storageLocation.trim(),
    storageStartDate: input.storageStartDate,
    storageEndDate: input.storageEndDate,
    status: resolveWitnessSampleStatus(input.status, input.storageEndDate),
    responsiblePerson: input.responsiblePerson.trim(),
    notes: input.notes.trim(),
    createdAt,
    updatedAt: now
  }
}

export const createWitnessSampleMockData = (
  qualitySamples: QualitySample[],
  existingSamples: WitnessSample[] = []
): WitnessSample[] => {
  const sourceSamples = qualitySamples.slice(0, 20)
  const witnessNos = new Set(existingSamples.map(sample => normalizeSearchKey(sample.witnessNo)))
  const witnessIds = new Set(existingSamples.map(sample => sample.id))

  return sourceSamples.map((sample, index) => {
    const status = WITNESS_STATUS_ROTATION[index % WITNESS_STATUS_ROTATION.length]
    const storageStartDate = addDays(sample.sampleDate || getTodayKey(), index % 3)
    const storageEndDate = status === 'EXPIRED'
      ? addDays(getTodayKey(), -1 - index)
      : addDays(storageStartDate, 30 + (index % 5) * 15)
    let sequence = index + 1
    let witnessNo = `WSP-${String(sequence).padStart(6, '0')}`
    let witnessId = `witness_sample_${String(index + 1).padStart(3, '0')}`

    while(witnessNos.has(normalizeSearchKey(witnessNo))){
      sequence += 1
      witnessNo = `WSP-${String(sequence).padStart(6, '0')}`
    }
    witnessNos.add(normalizeSearchKey(witnessNo))

    while(witnessIds.has(witnessId)){
      sequence += 1
      witnessId = `witness_sample_${String(sequence).padStart(3, '0')}`
    }
    witnessIds.add(witnessId)

    const createdAt = `${storageStartDate}T${String(10 + (index % 6)).padStart(2, '0')}:${String(index * 2).padStart(2, '0')}:00.000Z`

    return {
      id: witnessId,
      witnessNo,
      qualitySampleId: sample.id,
      storageLocation: STORAGE_LOCATIONS[index % STORAGE_LOCATIONS.length],
      storageStartDate,
      storageEndDate,
      status: resolveWitnessSampleStatus(status, storageEndDate),
      responsiblePerson: RESPONSIBLE_PEOPLE[index % RESPONSIBLE_PEOPLE.length],
      notes: 'Resmi saklama amacıyla ayrılan şahit numune.',
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeWitnessSample = (item: RawWitnessSampleRecord, index: number): WitnessSample => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const storageStartDate = normalizeText(item.storageStartDate) || getTodayKey()
  const rawStorageEndDate = normalizeText(item.storageEndDate) || addDays(storageStartDate, 30)
  const storageEndDate = rawStorageEndDate < storageStartDate ? storageStartDate : rawStorageEndDate

  return {
    id: normalizeText(item.id) || `witness_sample_${Date.now()}_${index}`,
    witnessNo: normalizeText(item.witnessNo) || `WSP-${String(index + 1).padStart(6, '0')}`,
    qualitySampleId: normalizeText(item.qualitySampleId),
    storageLocation: normalizeText(item.storageLocation),
    storageStartDate,
    storageEndDate,
    status: resolveWitnessSampleStatus(normalizeStatus(item.status), storageEndDate),
    responsiblePerson: normalizeText(item.responsiblePerson) || 'Kalite Ekibi',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveWitnessSampleRecords = (records: WitnessSample[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(WITNESS_SAMPLE_STORAGE_KEY, JSON.stringify(records.map(normalizeWitnessSample)))
}

const ensureWitnessSampleSeeds = (
  records: WitnessSample[],
  qualitySamples: QualitySample[]
) => {
  if(records.length >= 20) return records

  const seedRecords = createWitnessSampleMockData(qualitySamples, records).slice(0, 20 - records.length)
  return seedRecords.length > 0 ? [...seedRecords, ...records] : records
}

export const loadWitnessSampleRecords = (qualitySamples: QualitySample[]) => {
  const seedRecords = createWitnessSampleMockData(qualitySamples)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(WITNESS_SAMPLE_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveWitnessSampleRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeWitnessSample)
      const migratedRecords = ensureWitnessSampleSeeds(normalizedRecords, qualitySamples)

      saveWitnessSampleRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveWitnessSampleRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveWitnessSampleRecords(seedRecords)
  return seedRecords
}
