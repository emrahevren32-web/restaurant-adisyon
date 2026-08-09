import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { StockItem, StockWasteRecord } from '../types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { WasteRecord } from '../waste-management/waste.types'
import type { WitnessSample } from '../witness-samples/witness-sample.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import { QRIntegrationService } from '../qr-engine/qr-integration.service'
import type {
  BarcodeEntityType,
  BarcodeGenerateInput,
  BarcodeJob,
  BarcodeJobOperation,
  BarcodeJobStatus,
  BarcodeModuleKey,
  BarcodePreviewResult,
  BarcodePrintInput,
  BarcodeReadResult,
  BarcodeRecord,
  BarcodeType,
  BarcodeValidationResult
} from './barcode.types'

const BARCODE_RECORD_STORAGE_KEY = 'ra_barcode_engine_records'
const BARCODE_JOB_STORAGE_KEY = 'ra_barcode_engine_jobs'
const DEFAULT_USER_NAME = 'Sistem'
const ENGINE_PREFIX = 'IKERP'

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
}

const EAN_LEFT_ODD: Record<string, string> = {
  '0': '0001101',
  '1': '0011001',
  '2': '0010011',
  '3': '0111101',
  '4': '0100011',
  '5': '0110001',
  '6': '0101111',
  '7': '0111011',
  '8': '0110111',
  '9': '0001011'
}

const EAN_LEFT_EVEN: Record<string, string> = {
  '0': '0100111',
  '1': '0110011',
  '2': '0011011',
  '3': '0100001',
  '4': '0011101',
  '5': '0111001',
  '6': '0000101',
  '7': '0010001',
  '8': '0001001',
  '9': '0010111'
}

const EAN_RIGHT: Record<string, string> = {
  '0': '1110010',
  '1': '1100110',
  '2': '1101100',
  '3': '1000010',
  '4': '1011100',
  '5': '1001110',
  '6': '1010000',
  '7': '1000100',
  '8': '1001000',
  '9': '1110100'
}

const EAN_PARITY: Record<string, string> = {
  '0': 'OOOOOO',
  '1': 'OOEOEE',
  '2': 'OOEEOE',
  '3': 'OOEEEO',
  '4': 'OEOOEE',
  '5': 'OEEOOE',
  '6': 'OEEEOO',
  '7': 'OEOEOE',
  '8': 'OEOEEO',
  '9': 'OEEOEO'
}

const BARCODE_MODULE_LABELS: Record<BarcodeModuleKey, string> = {
  'raw-materials': 'Hammaddeler',
  lots: 'Lotlar',
  'production-orders': 'Uretim Emirleri',
  shipments: 'Sevkiyat',
  samples: 'Numune Takibi',
  'witness-samples': 'Sahit Numune',
  waste: 'Fire Kayitlari'
}

const BARCODE_ENTITY_LABELS: Record<BarcodeEntityType, string> = {
  RAW_MATERIAL: 'Hammadde',
  LOT: 'Lot',
  PRODUCTION_ORDER: 'Uretim Emri',
  SHIPMENT: 'Sevkiyat',
  QUALITY_SAMPLE: 'Numune',
  WITNESS_SAMPLE: 'Sahit Numune',
  WASTE_RECORD: 'Fire Kaydi'
}

const SUPPORTED_TYPES: BarcodeType[] = ['CODE128', 'CODE39', 'EAN13', 'QR']

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeAscii = (value: unknown) => normalizeText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7F]/g, '-')
  .replace(/\s+/g, '-')

const normalizeDate = (value: unknown) => {
  const text = normalizeText(value)
  if(!text) return new Date().toLocaleDateString('sv-SE')
  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toLocaleDateString('sv-SE')
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const normalizeBarcodeType = (value: unknown): BarcodeType => {
  const normalized = normalizeText(value).toUpperCase().replace(/[_\-\s]/g, '')
  if(normalized === 'CODE39') return 'CODE39'
  if(normalized === 'EAN13') return 'EAN13'
  if(normalized === 'QR' || normalized === 'QRCODE') return 'QR'
  return 'CODE128'
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createEntityKey = (
  entityType: BarcodeEntityType,
  entityId: string,
  barcodeType: BarcodeType
) => `${entityType}:${entityId}:${barcodeType}`.toLocaleLowerCase('tr-TR')

const createQrReference = (
  input: Pick<BarcodeRecord, 'entityType' | 'entityId' | 'code' | 'lot' | 'date' | 'barcodeValue'>
) => JSON.stringify({
  engine: ENGINE_PREFIX,
  entityType: input.entityType,
  entityId: input.entityId,
  code: input.code,
  lot: input.lot,
  date: input.date,
  barcode: input.barcodeValue
})

const calculateEan13CheckDigit = (value12: string) => {
  const total = value12.split('').reduce((sum, digit, index) => (
    sum + Number(digit) * (index % 2 === 0 ? 1 : 3)
  ), 0)
  return String((10 - (total % 10)) % 10)
}

const normalizeEan13 = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if(digits.length >= 13) return digits.slice(0, 13)
  if(digits.length === 12) return `${digits}${calculateEan13CheckDigit(digits)}`
  const padded = digits.padStart(12, '0').slice(-12)
  return `${padded}${calculateEan13CheckDigit(padded)}`
}

const createNumericHash = (value: string) => {
  const seed = value.split('').reduce((hash, character) => (
    (hash * 31 + character.charCodeAt(0)) % 1000000000000
  ), 97)
  return String(seed).padStart(12, '0').slice(-12)
}

const createCode39Value = (
  input: BarcodeGenerateInput
) => [
  ENGINE_PREFIX,
  input.entityType.replace(/_/g, '-'),
  input.entityId,
  input.code,
  input.lot || 'NOLOT',
  normalizeDate(input.date).replace(/\D/g, '')
]
  .map(value => normalizeAscii(value).toUpperCase().replace(/[^A-Z0-9 .$/+%-]/g, '-'))
  .join('-')
  .replace(/-+/g, '-')
  .slice(0, 80)

const createCode128Value = (
  input: BarcodeGenerateInput
) => [
  ENGINE_PREFIX,
  input.entityType,
  input.entityId,
  input.code,
  input.lot || '-',
  normalizeDate(input.date)
]
  .map(normalizeAscii)
  .join('|')
  .slice(0, 80)

const createBarcodeValue = (
  input: BarcodeGenerateInput,
  barcodeType: BarcodeType
) => {
  if(barcodeType === 'CODE39') return createCode39Value(input)
  if(barcodeType === 'EAN13') return normalizeEan13(input.code.match(/^\d{12,13}$/) ? input.code : createNumericHash(`${input.entityType}|${input.entityId}|${input.code}`))
  if(barcodeType === 'QR') return createQrReference({
    entityType: input.entityType,
    entityId: input.entityId,
    code: input.code,
    lot: input.lot || '',
    date: normalizeDate(input.date),
    barcodeValue: createCode128Value(input)
  } as Pick<BarcodeRecord, 'entityType' | 'entityId' | 'code' | 'lot' | 'date' | 'barcodeValue'>)
  return createCode128Value(input)
}

const isEan13Valid = (value: string) => {
  if(!/^\d{13}$/.test(value)) return false
  return calculateEan13CheckDigit(value.slice(0, 12)) === value[12]
}

const createValidationResult = (errors: string[]): BarcodeValidationResult => ({
  valid: errors.length === 0,
  errors
})

const createRecordFromInput = (
  input: BarcodeGenerateInput,
  userName: string
): BarcodeRecord => {
  const barcodeType = normalizeBarcodeType(input.barcodeType)
  const barcodeValue = createBarcodeValue(input, barcodeType)
  const date = normalizeDate(input.date)
  const record: Omit<BarcodeRecord, 'qrReference'> = {
    id: createId('barcode'),
    moduleKey: input.moduleKey,
    moduleLabel: BARCODE_MODULE_LABELS[input.moduleKey],
    entityType: input.entityType,
    entityLabel: BARCODE_ENTITY_LABELS[input.entityType],
    entityId: normalizeText(input.entityId),
    barcodeType,
    barcodeValue,
    code: normalizeText(input.code),
    lot: normalizeText(input.lot),
    date,
    title: normalizeText(input.title) || normalizeText(input.code),
    description: normalizeText(input.description),
    immutable: true,
    createdBy: userName || DEFAULT_USER_NAME,
    createdAt: new Date().toISOString()
  }

  return {
    ...record,
    qrReference: createQrReference(record)
  }
}

const createJob = (
  operation: BarcodeJobOperation,
  status: BarcodeJobStatus,
  record: Pick<BarcodeRecord, 'barcodeType' | 'moduleKey' | 'moduleLabel' | 'entityType' | 'entityId' | 'barcodeValue'>,
  userName: string,
  recordCount: number,
  message: string
): BarcodeJob => ({
  id: createId('barcode_job'),
  operation,
  status,
  userName: userName || DEFAULT_USER_NAME,
  barcodeType: record.barcodeType,
  moduleKey: record.moduleKey,
  moduleLabel: record.moduleLabel,
  entityType: record.entityType,
  entityId: record.entityId,
  barcodeValue: record.barcodeValue,
  recordCount,
  createdAt: new Date().toISOString(),
  message
})

const normalizeRecord = (
  value: Partial<BarcodeRecord>
): BarcodeRecord => {
  const moduleKey = (Object.keys(BARCODE_MODULE_LABELS).includes(normalizeText(value.moduleKey)) ? value.moduleKey : 'raw-materials') as BarcodeModuleKey
  const entityType = (Object.keys(BARCODE_ENTITY_LABELS).includes(normalizeText(value.entityType)) ? value.entityType : 'RAW_MATERIAL') as BarcodeEntityType
  const barcodeType = normalizeBarcodeType(value.barcodeType)
  const record: Omit<BarcodeRecord, 'qrReference'> = {
    id: normalizeText(value.id) || createId('barcode'),
    moduleKey,
    moduleLabel: BARCODE_MODULE_LABELS[moduleKey],
    entityType,
    entityLabel: BARCODE_ENTITY_LABELS[entityType],
    entityId: normalizeText(value.entityId),
    barcodeType,
    barcodeValue: normalizeText(value.barcodeValue),
    code: normalizeText(value.code),
    lot: normalizeText(value.lot),
    date: normalizeDate(value.date),
    title: normalizeText(value.title),
    description: normalizeText(value.description),
    immutable: true,
    createdBy: normalizeText(value.createdBy) || DEFAULT_USER_NAME,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString()
  }

  return {
    ...record,
    qrReference: normalizeText(value.qrReference) || createQrReference(record)
  }
}

const normalizeJob = (
  value: Partial<BarcodeJob>
): BarcodeJob => {
  const moduleKey = (Object.keys(BARCODE_MODULE_LABELS).includes(normalizeText(value.moduleKey)) ? value.moduleKey : 'raw-materials') as BarcodeModuleKey
  const entityType = (Object.keys(BARCODE_ENTITY_LABELS).includes(normalizeText(value.entityType)) ? value.entityType : 'RAW_MATERIAL') as BarcodeEntityType
  return {
    id: normalizeText(value.id) || createId('barcode_job'),
    operation: normalizeText(value.operation).toUpperCase() as BarcodeJobOperation || 'GENERATE',
    status: normalizeText(value.status).toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
    userName: normalizeText(value.userName) || DEFAULT_USER_NAME,
    barcodeType: normalizeBarcodeType(value.barcodeType),
    moduleKey,
    moduleLabel: BARCODE_MODULE_LABELS[moduleKey],
    entityType,
    entityId: normalizeText(value.entityId),
    barcodeValue: normalizeText(value.barcodeValue),
    recordCount: Number(value.recordCount) || 1,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString(),
    message: normalizeText(value.message)
  }
}

const createSeedInputs = (): BarcodeGenerateInput[] => {
  const sourceData = loadKpiSourceData()
  const stockItem = sourceData.stockItems[0]
  const lot = sourceData.inventoryLots[0]
  const productionOrder = sourceData.productionOrders[0]
  const shipment = sourceData.shipments[0]
  const sample = sourceData.qualitySamples[0]
  const sampleLot = sample ? sourceData.inventoryLots.find(item => item.id === sample.inventoryLotId) || null : null
  const witness = sourceData.witnessSamples[0]
  const witnessSample = witness ? sourceData.qualitySamples.find(item => item.id === witness.qualitySampleId) || null : null
  const witnessLot = witnessSample ? sourceData.inventoryLots.find(item => item.id === witnessSample.inventoryLotId) || null : null
  const waste = sourceData.stockWasteRecords[0]

  return [
    stockItem ? BarcodeIntegrationService.fromRawMaterial(stockItem) : null,
    lot ? BarcodeIntegrationService.fromLot(lot) : null,
    productionOrder ? BarcodeIntegrationService.fromProductionOrder(productionOrder) : null,
    shipment ? BarcodeIntegrationService.fromShipment(shipment) : null,
    sample ? BarcodeIntegrationService.fromQualitySample(sample, sampleLot) : null,
    witness ? BarcodeIntegrationService.fromWitnessSample(witness, witnessSample, witnessLot) : null,
    waste ? BarcodeIntegrationService.fromStockWasteRecord(waste) : null
  ].filter((input): input is BarcodeGenerateInput => Boolean(input))
}

const createSeedRecords = () => (
  createSeedInputs().map((input, index) => normalizeRecord({
    ...createRecordFromInput(input, 'Seed'),
    id: `barcode_seed_${index + 1}`,
    createdAt: `2026-08-09T08:${String(index).padStart(2, '0')}:00.000Z`
  }))
)

const saveRecords = (records: BarcodeRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(BARCODE_RECORD_STORAGE_KEY, JSON.stringify(records.map(normalizeRecord)))
}

const loadRecords = () => {
  if(!isBrowserStorageAvailable()) return createSeedRecords()

  const stored = localStorage.getItem(BARCODE_RECORD_STORAGE_KEY)
  if(!stored){
    const seedRecords = createSeedRecords()
    saveRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const records = parsed
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeRecord(item as Partial<BarcodeRecord>))
      saveRecords(records)
      return records
    }
  } catch {
    const seedRecords = createSeedRecords()
    saveRecords(seedRecords)
    return seedRecords
  }

  const seedRecords = createSeedRecords()
  saveRecords(seedRecords)
  return seedRecords
}

const saveJobs = (jobs: BarcodeJob[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(BARCODE_JOB_STORAGE_KEY, JSON.stringify(jobs.map(normalizeJob)))
}

const loadJobs = () => {
  if(!isBrowserStorageAvailable()) return []
  const stored = localStorage.getItem(BARCODE_JOB_STORAGE_KEY)
  if(!stored) return []

  try{
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)) return parsed
      .filter(item => item && typeof item === 'object')
      .map(item => normalizeJob(item as Partial<BarcodeJob>))
  } catch {
    return []
  }

  return []
}

const addJob = (job: BarcodeJob) => {
  const jobs = [job, ...loadJobs()]
  saveJobs(jobs)
  return job
}

const validateRecord = (
  record: BarcodeRecord,
  existingRecords: BarcodeRecord[] = loadRecords()
) => {
  const errors: string[] = []

  if(!record.code.trim()) errors.push('Bos kod barkod olusturamaz.')
  if(!SUPPORTED_TYPES.includes(record.barcodeType)) errors.push('Desteklenmeyen barkod tipi.')
  if(!record.barcodeValue.trim()) errors.push('Barkod degeri bos olamaz.')

  if(record.barcodeType === 'CODE128' && !/^[\x20-\x7F]{1,80}$/.test(record.barcodeValue)){
    errors.push('Code128 barkod formati gecersiz.')
  }
  if(record.barcodeType === 'CODE39' && !/^[A-Z0-9 .$/+%-]{1,80}$/.test(record.barcodeValue)){
    errors.push('Code39 barkod formati gecersiz.')
  }
  if(record.barcodeType === 'EAN13' && !isEan13Valid(record.barcodeValue)){
    errors.push('EAN13 barkod formati gecersiz.')
  }
  if(record.barcodeType === 'QR' && !record.qrReference.trim()){
    errors.push('QR referansi bos olamaz.')
  }

  const duplicateValue = existingRecords.find(item => (
    item.barcodeValue === record.barcodeValue
    && (item.entityType !== record.entityType || item.entityId !== record.entityId)
  ))
  if(duplicateValue) errors.push('Ayni barkod iki farkli kayit icin kullanilamaz.')

  const sameEntity = existingRecords.find(item => (
    createEntityKey(item.entityType, item.entityId, item.barcodeType) === createEntityKey(record.entityType, record.entityId, record.barcodeType)
    && item.barcodeValue !== record.barcodeValue
  ))
  if(sameEntity) errors.push('Barkodlar immutable oldugu icin mevcut kaydin barkodu degistirilemez.')

  return createValidationResult(errors)
}

const normalizeCode128Text = (value: string) => value
  .split('')
  .map(character => {
    const code = character.charCodeAt(0)
    return code >= 32 && code <= 127 ? character : '-'
  })
  .join('')
  .slice(0, 80)

const getCode128Values = (value: string) => {
  const normalizedValue = normalizeCode128Text(value)
  const dataValues = normalizedValue.split('').map(character => character.charCodeAt(0) - 32)
  const checksum = dataValues.reduce((total, code, index) => total + code * (index + 1), 104) % 103
  return [104, ...dataValues, checksum, 106]
}

const createCode128Svg = (
  value: string,
  width = 320,
  height = 82
) => {
  const values = getCode128Values(value)
  const moduleCount = values.reduce((total, code) => (
    total + (CODE128_PATTERNS[code] || '').split('').reduce((sum, digit) => sum + Number(digit), 0)
  ), 0)
  const quietZone = 10
  const moduleWidth = (width - quietZone * 2) / moduleCount
  let x = quietZone
  const bars: string[] = []

  for(const code of values){
    const pattern = CODE128_PATTERNS[code] || ''
    for(const [index, digit] of pattern.split('').entries()){
      const barWidth = Number(digit) * moduleWidth
      if(index % 2 === 0){
        bars.push(`<rect x="${x.toFixed(2)}" y="6" width="${barWidth.toFixed(2)}" height="${height - 28}" fill="#111827" />`)
      }
      x += barWidth
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Code 128">
    <rect width="100%" height="100%" fill="#ffffff" />
    ${bars.join('')}
    <text x="${width / 2}" y="${height - 7}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#111827">${escapeHtml(value)}</text>
  </svg>`
}

const createCode39Svg = (
  value: string,
  width = 320,
  height = 82
) => {
  const encoded = `*${value.toUpperCase()}*`
  const narrow = 2
  const wide = 5
  const gap = 2
  const totalWidth = encoded.split('').reduce((sum, character) => {
    const pattern = CODE39_PATTERNS[character] || CODE39_PATTERNS['-']
    return sum + pattern.split('').reduce((patternSum, part) => patternSum + (part === 'w' ? wide : narrow), 0) + gap
  }, 20)
  const scale = Math.min(1, (width - 20) / totalWidth)
  let x = 10
  const bars: string[] = []

  for(const character of encoded){
    const pattern = CODE39_PATTERNS[character] || CODE39_PATTERNS['-']
    pattern.split('').forEach((part, index) => {
      const partWidth = (part === 'w' ? wide : narrow) * scale
      if(index % 2 === 0){
        bars.push(`<rect x="${x.toFixed(2)}" y="6" width="${partWidth.toFixed(2)}" height="${height - 28}" fill="#111827" />`)
      }
      x += partWidth
    })
    x += gap * scale
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Code 39">
    <rect width="100%" height="100%" fill="#ffffff" />
    ${bars.join('')}
    <text x="${width / 2}" y="${height - 7}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#111827">${escapeHtml(value)}</text>
  </svg>`
}

const createEan13Svg = (
  value: string,
  width = 320,
  height = 82
) => {
  const normalized = normalizeEan13(value)
  const first = normalized[0]
  const left = normalized.slice(1, 7)
  const right = normalized.slice(7)
  const parity = EAN_PARITY[first]
  const pattern = [
    '101',
    ...left.split('').map((digit, index) => (parity[index] === 'E' ? EAN_LEFT_EVEN : EAN_LEFT_ODD)[digit]),
    '01010',
    ...right.split('').map(digit => EAN_RIGHT[digit]),
    '101'
  ].join('')
  const quietZone = 14
  const moduleWidth = (width - quietZone * 2) / pattern.length
  const bars = pattern.split('').map((bit, index) => (
    bit === '1'
      ? `<rect x="${(quietZone + index * moduleWidth).toFixed(2)}" y="6" width="${Math.ceil(moduleWidth * 100) / 100}" height="${height - 28}" fill="#111827" />`
      : ''
  )).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="EAN13">
    <rect width="100%" height="100%" fill="#ffffff" />
    ${bars}
    <text x="${width / 2}" y="${height - 7}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#111827">${escapeHtml(normalized)}</text>
  </svg>`
}

const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

const createBarcodeSvg = (
  value: string,
  barcodeType: BarcodeType,
  width = 320,
  height = 82
) => {
  if(barcodeType === 'CODE39') return createCode39Svg(value, width, height)
  if(barcodeType === 'EAN13') return createEan13Svg(value, width, height)
  return createCode128Svg(value, width, height)
}

const createBarcodeDataUrl = (
  value: string,
  barcodeType: BarcodeType = 'CODE128',
  width = 320,
  height = 82
) => svgToDataUrl(createBarcodeSvg(value, barcodeType, width, height))

const createQrDataUrl = async (payload: string) => QRIntegrationService.createDataUrl(payload, { width: 180 })

const createPrintCardHtml = (
  record: BarcodeRecord,
  barcodeImage: string,
  qrImage: string
) => `
  <article class="barcode-print-card">
    <header>
      <div>
        <h2>${escapeHtml(record.title)}</h2>
        <span>${escapeHtml(record.entityLabel)} / ${escapeHtml(record.moduleLabel)}</span>
      </div>
      <strong>${escapeHtml(record.barcodeType)}</strong>
    </header>
    <img class="barcode-main-image" src="${barcodeImage}" alt="${escapeHtml(record.barcodeType)}" />
    <div class="barcode-print-meta">
      <div><span>Entity</span><strong>${escapeHtml(record.entityType)}</strong></div>
      <div><span>Entity Id</span><strong>${escapeHtml(record.entityId)}</strong></div>
      <div><span>Kod</span><strong>${escapeHtml(record.code)}</strong></div>
      <div><span>Lot</span><strong>${escapeHtml(record.lot || '-')}</strong></div>
      <div><span>Tarih</span><strong>${escapeHtml(formatDate(record.date))}</strong></div>
    </div>
    <img class="barcode-qr-reference" src="${qrImage}" alt="QR Referans" />
  </article>`

const createPrintHtml = async (
  records: BarcodeRecord[],
  mode: BarcodePrintInput['mode']
) => {
  const cards = await Promise.all(records.map(async record => {
    const barcodeImage = record.barcodeType === 'QR'
      ? await createQrDataUrl(record.qrReference)
      : createBarcodeDataUrl(record.barcodeValue, record.barcodeType, 360, 90)
    const qrImage = await createQrDataUrl(record.qrReference)
    return createPrintCardHtml(record, barcodeImage, qrImage)
  }))

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Barcode Print</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: fixed; right: 16px; top: 16px; z-index: 2; }
    .toolbar button { padding: ${PRINT_SPACING_VALUES.space8} ${PRINT_SPACING_VALUES.space12}; font-weight: 700; }
    .sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8mm; align-items: start; }
    .barcode-print-card { min-height: 72mm; border: 1px solid #111827; padding: 5mm; page-break-inside: avoid; overflow: hidden; }
    .barcode-print-card header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: ${PRINT_SPACING_VALUES.space8}; align-items: start; border-bottom: 1px solid #d1d5db; padding-bottom: ${PRINT_SPACING_VALUES.space4}; margin-bottom: ${PRINT_SPACING_VALUES.space4}; }
    .barcode-print-card h2 { margin: 0; font-size: 15px; line-height: 1.15; overflow-wrap: anywhere; }
    .barcode-print-card header span, .barcode-print-card header strong { display: block; font-size: 10px; }
    .barcode-main-image { display: block; width: 100%; height: 24mm; object-fit: fill; }
    .barcode-print-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${PRINT_SPACING_VALUES.space2} ${PRINT_SPACING_VALUES.space4}; margin-top: ${PRINT_SPACING_VALUES.space4}; }
    .barcode-print-meta span { display: block; color: #6b7280; font-size: 8px; font-weight: 700; text-transform: uppercase; }
    .barcode-print-meta strong { display: block; font-size: 10px; line-height: 1.15; overflow-wrap: anywhere; }
    .barcode-qr-reference { display: block; width: 21mm; height: 21mm; margin-top: ${PRINT_SPACING_VALUES.space4}; }
    @media print { .toolbar { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Yazdir</button></div>
  <main class="sheet" data-print-mode="${escapeHtml(mode)}">
    ${cards.join('')}
  </main>
</body>
</html>`
}

const resolveRecordForPrint = (
  record: BarcodeRecord | BarcodeGenerateInput,
  userName: string
) => 'barcodeValue' in record
  ? record
  : BarcodeIntegrationService.generate(record, userName)

const parseKnownPayload = (barcodeValue: string) => {
  if(barcodeValue.startsWith(`${ENGINE_PREFIX}|`)){
    const [, entityType, entityId, code, lot, date] = barcodeValue.split('|')
    return {
      entityType: entityType as BarcodeEntityType,
      entityId,
      code,
      lot,
      date
    }
  }

  try{
    const parsed = JSON.parse(barcodeValue)
    if(parsed?.engine === ENGINE_PREFIX){
      return {
        entityType: parsed.entityType as BarcodeEntityType,
        entityId: normalizeText(parsed.entityId),
        code: normalizeText(parsed.code),
        lot: normalizeText(parsed.lot),
        date: normalizeText(parsed.date)
      }
    }
  } catch {
    return null
  }

  return null
}

const createReadResult = (
  errors: string[],
  record: BarcodeRecord | null,
  parsed: BarcodeReadResult['parsed']
): BarcodeReadResult => ({
  valid: errors.length === 0,
  errors,
  record,
  parsed
})

export const BarcodeIntegrationService = {
  defaultUserName: DEFAULT_USER_NAME,
  supportedTypes: SUPPORTED_TYPES,
  moduleLabels: BARCODE_MODULE_LABELS,
  entityLabels: BARCODE_ENTITY_LABELS,

  fromRawMaterial: (item: StockItem): BarcodeGenerateInput => ({
    moduleKey: 'raw-materials',
    entityType: 'RAW_MATERIAL',
    entityId: item.id,
    code: item.sku || item.barcode || item.id,
    lot: '',
    date: item.updatedAt || item.createdAt,
    barcodeType: 'CODE128',
    title: item.name,
    description: `${item.unit} hammadde karti`
  }),

  fromLot: (lot: InventoryLot): BarcodeGenerateInput => ({
    moduleKey: 'lots',
    entityType: 'LOT',
    entityId: lot.id,
    code: lot.lotNo,
    lot: lot.lotNo,
    date: lot.productionDate || lot.createdAt,
    barcodeType: 'CODE128',
    title: lot.lotNo,
    description: `${lot.remainingQuantity} ${lot.unit} kalan lot`
  }),

  fromProductionOrder: (order: ProductionWorkOrder): BarcodeGenerateInput => ({
    moduleKey: 'production-orders',
    entityType: 'PRODUCTION_ORDER',
    entityId: order.id,
    code: order.workOrderNo,
    lot: order.linkedShipmentNo || '',
    date: order.deliveryDate || order.createdAt,
    barcodeType: 'CODE128',
    title: order.workOrderNo,
    description: `${order.branch} uretim emri`
  }),

  fromShipment: (shipment: ShipmentRecord): BarcodeGenerateInput => ({
    moduleKey: 'shipments',
    entityType: 'SHIPMENT',
    entityId: shipment.id,
    code: shipment.shipmentNo,
    lot: shipment.items[0]?.inventoryLotId || '',
    date: shipment.shipmentDate || shipment.createdAt,
    barcodeType: 'CODE128',
    title: shipment.shipmentNo,
    description: `${shipment.items.length} kalem sevkiyat`
  }),

  fromQualitySample: (sample: QualitySample, lot?: InventoryLot | null): BarcodeGenerateInput => ({
    moduleKey: 'samples',
    entityType: 'QUALITY_SAMPLE',
    entityId: sample.id,
    code: sample.sampleNo,
    lot: lot?.lotNo || sample.inventoryLotId,
    date: sample.sampleDate || sample.createdAt,
    barcodeType: 'CODE128',
    title: sample.sampleNo,
    description: `${sample.sampleType} numune`
  }),

  fromWitnessSample: (
    witness: WitnessSample,
    sample?: QualitySample | null,
    lot?: InventoryLot | null
  ): BarcodeGenerateInput => ({
    moduleKey: 'witness-samples',
    entityType: 'WITNESS_SAMPLE',
    entityId: witness.id,
    code: witness.witnessNo,
    lot: lot?.lotNo || sample?.sampleNo || witness.qualitySampleId,
    date: witness.storageStartDate || witness.createdAt,
    barcodeType: 'CODE128',
    title: witness.witnessNo,
    description: `${witness.storageLocation} sahit numune`
  }),

  fromWasteRecord: (record: WasteRecord): BarcodeGenerateInput => ({
    moduleKey: 'waste',
    entityType: 'WASTE_RECORD',
    entityId: record.id,
    code: record.wasteNo,
    lot: record.lotNo || record.batchNo,
    date: record.date || record.createdAt,
    barcodeType: 'CODE128',
    title: record.wasteNo,
    description: `${record.productName || record.stockItemName} fire kaydi`
  }),

  fromStockWasteRecord: (record: StockWasteRecord): BarcodeGenerateInput => ({
    moduleKey: 'waste',
    entityType: 'WASTE_RECORD',
    entityId: record.id,
    code: record.stockMovementId || record.id,
    lot: record.expiryAllocations?.[0]?.lotCode || '',
    date: record.occurredAt || record.createdAt,
    barcodeType: 'CODE128',
    title: record.stockItemName,
    description: `${record.qty} ${record.unit} stok fire kaydi`
  }),

  validate: (input: BarcodeGenerateInput, existingRecords: BarcodeRecord[] = loadRecords()): BarcodeValidationResult => {
    const record = createRecordFromInput(input, DEFAULT_USER_NAME)
    const result = validateRecord(record, existingRecords)
    addJob(createJob('VALIDATE', result.valid ? 'SUCCESS' : 'FAILED', record, DEFAULT_USER_NAME, 1, result.valid ? 'Barkod dogrulandi.' : result.errors.join(' ')))
    return result
  },

  validateValue: (barcodeValue: string, barcodeType: BarcodeType = 'CODE128'): BarcodeValidationResult => {
    const record = normalizeRecord({
      moduleKey: 'raw-materials',
      entityType: 'RAW_MATERIAL',
      entityId: 'validation',
      code: barcodeValue,
      barcodeType,
      barcodeValue,
      title: 'Validation',
      date: new Date().toLocaleDateString('sv-SE')
    })
    return validateRecord(record, [])
  },

  generate: (input: BarcodeGenerateInput, userName = DEFAULT_USER_NAME): BarcodeRecord => {
    const records = loadRecords()
    const candidate = createRecordFromInput(input, userName)
    const entityKey = createEntityKey(candidate.entityType, candidate.entityId, candidate.barcodeType)
    const existingRecord = records.find(record => (
      createEntityKey(record.entityType, record.entityId, record.barcodeType) === entityKey
    ))

    if(existingRecord) return existingRecord

    const validation = validateRecord(candidate, records)
    if(!validation.valid){
      addJob(createJob('GENERATE', 'FAILED', candidate, userName, 1, validation.errors.join(' ')))
      throw new Error(validation.errors[0] || 'Barkod dogrulamasi basarisiz.')
    }

    const nextRecords = [candidate, ...records]
    saveRecords(nextRecords)
    addJob(createJob('GENERATE', 'SUCCESS', candidate, userName, 1, `${candidate.moduleLabel} icin ${candidate.barcodeType} barkod olusturuldu.`))
    return candidate
  },

  read: (barcodeValue: string, userName = DEFAULT_USER_NAME): BarcodeReadResult => {
    const normalizedValue = normalizeText(barcodeValue)
    const fallbackRecord = normalizeRecord({
      moduleKey: 'raw-materials',
      entityType: 'RAW_MATERIAL',
      entityId: 'read',
      code: normalizedValue,
      barcodeType: 'CODE128',
      barcodeValue: normalizedValue,
      title: 'Read',
      date: new Date().toLocaleDateString('sv-SE')
    })

    if(!normalizedValue){
      addJob(createJob('READ', 'FAILED', fallbackRecord, userName, 0, 'Bos barkod okunamaz.'))
      return createReadResult(['Bos barkod okunamaz.'], null, null)
    }

    const record = loadRecords().find(item => item.barcodeValue === normalizedValue || item.qrReference === normalizedValue) || null
    const parsed = record
      ? {
        entityType: record.entityType,
        entityId: record.entityId,
        code: record.code,
        lot: record.lot,
        date: record.date
      }
      : parseKnownPayload(normalizedValue)
    const result = parsed
      ? createReadResult([], record, parsed)
      : createReadResult(['Barkod kaydi bulunamadi veya format gecersiz.'], null, null)

    addJob(createJob('READ', result.valid ? 'SUCCESS' : 'FAILED', record || fallbackRecord, userName, record ? 1 : 0, result.valid ? 'Barkod okundu.' : result.errors.join(' ')))
    return result
  },

  createPreview: async (input: BarcodeGenerateInput, userName = DEFAULT_USER_NAME): Promise<BarcodePreviewResult> => {
    const record = BarcodeIntegrationService.generate(input, userName)
    const validation = validateRecord(record, loadRecords().filter(item => item.id !== record.id))
    const imageDataUrl = record.barcodeType === 'QR'
      ? await createQrDataUrl(record.qrReference)
      : createBarcodeDataUrl(record.barcodeValue, record.barcodeType)
    const qrDataUrl = await createQrDataUrl(record.qrReference)

    return {
      record,
      imageDataUrl,
      qrDataUrl,
      validation
    }
  },

  createBarcodeSvg,
  createBarcodeDataUrl,
  createQrDataUrl,

  createPrintHtml,

  openPrintWindow: async (input: BarcodePrintInput) => {
    if(typeof window === 'undefined') return false
    const quantity = Math.max(1, Math.min(500, Math.floor(input.quantity || 1)))
    const records = input.records.map(record => resolveRecordForPrint(record, input.userName))
    if(records.length === 0) throw new Error('Yazdirilacak barkod bulunamadi.')

    const printableRecords = input.mode === 'SINGLE'
      ? [records[0]]
      : records.flatMap(record => Array.from({ length: input.mode === 'MULTIPLE' ? quantity : 1 }, () => record))
    const html = await createPrintHtml(printableRecords, input.mode)
    const printWindow = window.open('', '_blank', 'width=960,height=1200')
    if(!printWindow) return false
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 450)

    addJob(createJob('PRINT', 'SUCCESS', records[0], input.userName, printableRecords.length, `${printableRecords.length} barkod yazdirma penceresi acildi.`))
    return true
  },

  list: loadRecords,
  save: saveRecords,
  history: {
    list: loadJobs,
    add: addJob
  }
}
