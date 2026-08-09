import * as QRCode from 'qrcode'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { WasteRecord } from '../waste-management/waste.types'
import { WasteService } from '../waste-management/waste.service'
import type { WitnessSample } from '../witness-samples/witness-sample.types'
import type {
  QRDecodeResult,
  QREntityType,
  QRGenerateInput,
  QRJob,
  QRJobOperation,
  QRJobStatus,
  QRMetadata,
  QRModuleKey,
  QRPreviewResult,
  QRPrintInput,
  QRRecord,
  QRValidationResult
} from './qr.types'

const QR_RECORD_STORAGE_KEY = 'ra_qr_integration_records'
const QR_JOB_STORAGE_KEY = 'ra_qr_integration_jobs'
const DEFAULT_USER_NAME = 'Sistem'
const QR_ENGINE = 'IKERP_QR' as const

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 220
}

const QR_MODULE_LABELS: Record<QRModuleKey, string> = {
  lots: 'Lot Takibi',
  'production-orders': 'Uretim Emirleri',
  samples: 'Numune Takibi',
  'witness-samples': 'Sahit Numune',
  shipments: 'Sevkiyat',
  waste: 'Fire Kayitlari',
  recipes: 'Receteler'
}

const QR_ENTITY_LABELS: Record<QREntityType, string> = {
  LOT: 'Lot',
  PRODUCTION_ORDER: 'Uretim Emri',
  QUALITY_SAMPLE: 'Numune',
  WITNESS_SAMPLE: 'Sahit Numune',
  SHIPMENT: 'Sevkiyat',
  WASTE_RECORD: 'Fire Kaydi',
  RECIPE: 'Recete'
}

const MODULE_BY_ENTITY: Record<QREntityType, QRModuleKey> = {
  LOT: 'lots',
  PRODUCTION_ORDER: 'production-orders',
  QUALITY_SAMPLE: 'samples',
  WITNESS_SAMPLE: 'witness-samples',
  SHIPMENT: 'shipments',
  WASTE_RECORD: 'waste',
  RECIPE: 'recipes'
}

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const normalizeDate = (value: unknown) => {
  const text = normalizeText(value)
  if(!text) return new Date().toLocaleDateString('sv-SE')
  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toLocaleDateString('sv-SE')
}

const normalizeVersion = (value: unknown) => {
  const text = normalizeText(value)
  return text || '1'
}

const isSupportedModuleKey = (value: unknown): value is QRModuleKey => {
  const text = normalizeText(value)
  return Object.keys(QR_MODULE_LABELS).includes(text)
}

const isSupportedEntityType = (value: unknown): value is QREntityType => {
  const text = normalizeText(value)
  return Object.keys(QR_ENTITY_LABELS).includes(text)
}

const normalizeModuleKey = (value: unknown): QRModuleKey => {
  return isSupportedModuleKey(value) ? normalizeText(value) as QRModuleKey : 'lots'
}

const normalizeEntityType = (value: unknown): QREntityType => {
  return isSupportedEntityType(value) ? normalizeText(value) as QREntityType : 'LOT'
}

const createValidationResult = (errors: string[]): QRValidationResult => ({
  valid: errors.length === 0,
  errors
})

const createMetadata = (input: QRGenerateInput): QRMetadata => ({
  engine: QR_ENGINE,
  moduleKey: input.moduleKey,
  entityType: input.entityType,
  entityId: normalizeText(input.entityId),
  code: normalizeText(input.code),
  lotNo: normalizeText(input.lotNo),
  batch: normalizeText(input.batch),
  date: normalizeDate(input.date),
  version: normalizeVersion(input.version)
})

const stringifyMetadata = (metadata: QRMetadata) => JSON.stringify(metadata)

const createPayload = (input: QRGenerateInput) => stringifyMetadata(createMetadata(input))

const parseMetadata = (payload: string): QRMetadata | null => {
  const text = normalizeText(payload)
  if(!text) return null

  try{
    const parsed = JSON.parse(text) as Partial<QRMetadata>
    if(parsed.engine !== QR_ENGINE) return null
    if(!isSupportedEntityType(parsed.entityType)) return null
    const entityType = normalizeText(parsed.entityType) as QREntityType
    const rawModuleKey = parsed.moduleKey || MODULE_BY_ENTITY[entityType]
    if(!isSupportedModuleKey(rawModuleKey)) return null
    const moduleKey = normalizeText(rawModuleKey) as QRModuleKey
    return {
      engine: QR_ENGINE,
      moduleKey,
      entityType,
      entityId: normalizeText(parsed.entityId),
      code: normalizeText(parsed.code),
      lotNo: normalizeText(parsed.lotNo),
      batch: normalizeText(parsed.batch),
      date: normalizeDate(parsed.date),
      version: normalizeVersion(parsed.version)
    }
  } catch {
    return null
  }
}

const createRecordFromInput = (
  input: QRGenerateInput,
  userName: string
): QRRecord => {
  const metadata = createMetadata(input)
  return {
    id: createId('qr'),
    moduleKey: metadata.moduleKey,
    moduleLabel: QR_MODULE_LABELS[metadata.moduleKey],
    entityType: metadata.entityType,
    entityLabel: QR_ENTITY_LABELS[metadata.entityType],
    entityId: metadata.entityId,
    code: metadata.code,
    lotNo: metadata.lotNo,
    batch: metadata.batch,
    date: metadata.date,
    version: metadata.version,
    payload: stringifyMetadata(metadata),
    title: normalizeText(input.title) || metadata.code,
    description: normalizeText(input.description),
    immutable: true,
    createdBy: userName || DEFAULT_USER_NAME,
    createdAt: new Date().toISOString()
  }
}

const createJob = (
  operation: QRJobOperation,
  status: QRJobStatus,
  record: Pick<QRRecord, 'moduleKey' | 'moduleLabel' | 'entityType' | 'entityId' | 'code'>,
  userName: string,
  recordCount: number,
  message: string
): QRJob => ({
  id: createId('qr_job'),
  operation,
  status,
  userName: userName || DEFAULT_USER_NAME,
  moduleKey: record.moduleKey,
  moduleLabel: record.moduleLabel,
  entityType: record.entityType,
  entityId: record.entityId,
  code: record.code,
  recordCount,
  createdAt: new Date().toISOString(),
  message
})

const fallbackRecord = (payload = ''): QRRecord => ({
  id: createId('qr_fallback'),
  moduleKey: 'lots',
  moduleLabel: QR_MODULE_LABELS.lots,
  entityType: 'LOT',
  entityLabel: QR_ENTITY_LABELS.LOT,
  entityId: 'unknown',
  code: normalizeText(payload) || 'unknown',
  lotNo: '',
  batch: '',
  date: new Date().toLocaleDateString('sv-SE'),
  version: '1',
  payload: normalizeText(payload),
  title: 'QR',
  description: '',
  immutable: true,
  createdBy: DEFAULT_USER_NAME,
  createdAt: new Date().toISOString()
})

const normalizeRecord = (value: Partial<QRRecord>): QRRecord => {
  const entityType = normalizeEntityType(value.entityType)
  const moduleKey = normalizeModuleKey(value.moduleKey || MODULE_BY_ENTITY[entityType])
  const metadata = parseMetadata(normalizeText(value.payload)) || {
    engine: QR_ENGINE,
    moduleKey,
    entityType,
    entityId: normalizeText(value.entityId),
    code: normalizeText(value.code),
    lotNo: normalizeText(value.lotNo),
    batch: normalizeText(value.batch),
    date: normalizeDate(value.date),
    version: normalizeVersion(value.version)
  }

  return {
    id: normalizeText(value.id) || createId('qr'),
    moduleKey: metadata.moduleKey,
    moduleLabel: QR_MODULE_LABELS[metadata.moduleKey],
    entityType: metadata.entityType,
    entityLabel: QR_ENTITY_LABELS[metadata.entityType],
    entityId: metadata.entityId,
    code: metadata.code,
    lotNo: metadata.lotNo,
    batch: metadata.batch,
    date: metadata.date,
    version: metadata.version,
    payload: stringifyMetadata(metadata),
    title: normalizeText(value.title) || metadata.code,
    description: normalizeText(value.description),
    immutable: true,
    createdBy: normalizeText(value.createdBy) || DEFAULT_USER_NAME,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString()
  }
}

const normalizeJob = (value: Partial<QRJob>): QRJob => {
  const entityType = normalizeEntityType(value.entityType)
  const moduleKey = normalizeModuleKey(value.moduleKey || MODULE_BY_ENTITY[entityType])
  return {
    id: normalizeText(value.id) || createId('qr_job'),
    operation: normalizeText(value.operation).toUpperCase() as QRJobOperation || 'GENERATE',
    status: normalizeText(value.status).toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
    userName: normalizeText(value.userName) || DEFAULT_USER_NAME,
    moduleKey,
    moduleLabel: QR_MODULE_LABELS[moduleKey],
    entityType,
    entityId: normalizeText(value.entityId),
    code: normalizeText(value.code),
    recordCount: Number(value.recordCount) || 1,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString(),
    message: normalizeText(value.message)
  }
}

const createSeedInputs = (): QRGenerateInput[] => {
  const sourceData = loadKpiSourceData()
  const lot = sourceData.inventoryLots[0]
  const productionOrder = sourceData.productionOrders[0]
  const sample = sourceData.qualitySamples[0]
  const sampleLot = sample ? sourceData.inventoryLots.find(item => item.id === sample.inventoryLotId) || null : null
  const witness = sourceData.witnessSamples[0]
  const witnessSample = witness ? sourceData.qualitySamples.find(item => item.id === witness.qualitySampleId) || null : null
  const witnessLot = witnessSample ? sourceData.inventoryLots.find(item => item.id === witnessSample.inventoryLotId) || null : null
  const shipment = sourceData.shipments[0]
  const waste = WasteService.list(sourceData)[0]
  const recipe = sourceData.recipeRecords[0]

  return [
    lot ? QRIntegrationService.fromLot(lot) : null,
    productionOrder ? QRIntegrationService.fromProductionOrder(productionOrder) : null,
    sample ? QRIntegrationService.fromQualitySample(sample, sampleLot) : null,
    witness ? QRIntegrationService.fromWitnessSample(witness, witnessSample, witnessLot) : null,
    shipment ? QRIntegrationService.fromShipment(shipment) : null,
    waste ? QRIntegrationService.fromWasteRecord(waste) : null,
    recipe ? QRIntegrationService.fromRecipe(recipe) : null
  ].filter((input): input is QRGenerateInput => Boolean(input))
}

const createSeedRecords = () => (
  createSeedInputs().map((input, index) => normalizeRecord({
    ...createRecordFromInput(input, 'Seed'),
    id: `qr_seed_${index + 1}`,
    createdAt: `2026-08-09T09:${String(index).padStart(2, '0')}:00.000Z`
  }))
)

const saveRecords = (records: QRRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QR_RECORD_STORAGE_KEY, JSON.stringify(records.map(normalizeRecord)))
}

const loadRecords = () => {
  if(!isBrowserStorageAvailable()) return createSeedRecords()

  const stored = localStorage.getItem(QR_RECORD_STORAGE_KEY)
  if(!stored){
    const seeds = createSeedRecords()
    saveRecords(seeds)
    return seeds
  }

  try{
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const records = parsed
        .filter(item => item && typeof item === 'object')
        .map(item => normalizeRecord(item as Partial<QRRecord>))
      saveRecords(records)
      return records
    }
  } catch {
    const seeds = createSeedRecords()
    saveRecords(seeds)
    return seeds
  }

  const seeds = createSeedRecords()
  saveRecords(seeds)
  return seeds
}

const saveJobs = (jobs: QRJob[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QR_JOB_STORAGE_KEY, JSON.stringify(jobs.map(normalizeJob)))
}

const loadJobs = () => {
  if(!isBrowserStorageAvailable()) return []
  const stored = localStorage.getItem(QR_JOB_STORAGE_KEY)
  if(!stored) return []

  try{
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)) return parsed
      .filter(item => item && typeof item === 'object')
      .map(item => normalizeJob(item as Partial<QRJob>))
  } catch {
    return []
  }

  return []
}

const addJob = (job: QRJob) => {
  const jobs = [job, ...loadJobs()]
  saveJobs(jobs)
  return job
}

const createEntityKey = (entityType: QREntityType, entityId: string) => (
  `${entityType}:${entityId}`.toLocaleLowerCase('tr-TR')
)

const entityExists = (metadata: QRMetadata) => {
  const sourceData = loadKpiSourceData()
  if(metadata.entityType === 'LOT') return sourceData.inventoryLots.some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'PRODUCTION_ORDER') return sourceData.productionOrders.some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'QUALITY_SAMPLE') return sourceData.qualitySamples.some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'WITNESS_SAMPLE') return sourceData.witnessSamples.some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'SHIPMENT') return sourceData.shipments.some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'WASTE_RECORD') return WasteService.list(sourceData).some(item => item.id === metadata.entityId)
  if(metadata.entityType === 'RECIPE') return sourceData.recipeRecords.some(item => item.id === metadata.entityId)
  return false
}

const validateMetadata = (
  metadata: QRMetadata | null,
  payload: string,
  checkEntity = true
) => {
  const errors: string[] = []
  if(!normalizeText(payload)) errors.push('Gecersiz QR.')
  if(!metadata) {
    errors.push('Bozuk QR icerik.')
    try{
      const parsed = JSON.parse(normalizeText(payload)) as Partial<QRMetadata>
      if(parsed.engine === QR_ENGINE && parsed.entityType && !isSupportedEntityType(parsed.entityType)) errors.push('Desteklenmeyen Entity.')
    } catch {
      // JSON parse hatasi zaten bozuk icerik olarak raporlanir.
    }
  }
  if(metadata && !Object.keys(QR_ENTITY_LABELS).includes(metadata.entityType)) errors.push('Desteklenmeyen Entity.')
  if(metadata && !metadata.entityId) errors.push('Entity Id zorunludur.')
  if(metadata && !metadata.code) errors.push('Kod zorunludur.')
  if(metadata && checkEntity && !entityExists(metadata)) errors.push('Silinmis kayit.')
  return createValidationResult(errors)
}

const validateRecord = (
  record: QRRecord,
  existingRecords: QRRecord[] = loadRecords(),
  checkEntity = true
) => {
  const metadata = parseMetadata(record.payload)
  const result = validateMetadata(metadata, record.payload, checkEntity)
  const errors = [...result.errors]

  const duplicate = existingRecords.find(item => (
    item.payload === record.payload
    && createEntityKey(item.entityType, item.entityId) !== createEntityKey(record.entityType, record.entityId)
  ))
  if(duplicate) errors.push('Ayni QR iki farkli kayit icin kullanilamaz.')

  const sameEntity = existingRecords.find(item => (
    createEntityKey(item.entityType, item.entityId) === createEntityKey(record.entityType, record.entityId)
    && item.payload !== record.payload
  ))
  if(sameEntity) errors.push('QR immutable oldugu icin mevcut kaydin QR icerigi degistirilemez.')

  return createValidationResult(errors)
}

const createDecodeResult = (
  errors: string[],
  metadata: QRMetadata | null,
  record: QRRecord | null,
  exists: boolean
): QRDecodeResult => ({
  valid: errors.length === 0,
  errors,
  metadata,
  record,
  moduleLabel: metadata ? QR_MODULE_LABELS[metadata.moduleKey] : '',
  entityLabel: metadata ? QR_ENTITY_LABELS[metadata.entityType] : '',
  entityExists: exists
})

const createDataUrl = (
  payload: string,
  options: Partial<typeof QR_OPTIONS> = {}
) => QRCode.toDataURL(payload, { ...QR_OPTIONS, ...options })

const resolveRecordForPrint = (
  record: QRRecord | QRGenerateInput,
  userName: string
) => 'payload' in record
  ? record
  : QRIntegrationService.generate(record, userName)

const createPrintCardHtml = (
  record: QRRecord,
  imageDataUrl: string,
  labelMode: boolean
) => `
  <article class="${labelMode ? 'qr-label-card' : 'qr-print-card'}">
    <header>
      <strong>${escapeHtml(record.title)}</strong>
      <span>${escapeHtml(record.moduleLabel)} / ${escapeHtml(record.entityLabel)}</span>
    </header>
    <img src="${imageDataUrl}" alt="QR" />
    <div class="qr-print-meta">
      <div><span>Entity</span><strong>${escapeHtml(record.entityType)}</strong></div>
      <div><span>Entity Id</span><strong>${escapeHtml(record.entityId)}</strong></div>
      <div><span>Kod</span><strong>${escapeHtml(record.code)}</strong></div>
      <div><span>Lot No</span><strong>${escapeHtml(record.lotNo || '-')}</strong></div>
      <div><span>Batch</span><strong>${escapeHtml(record.batch || '-')}</strong></div>
      <div><span>Versiyon</span><strong>${escapeHtml(record.version)}</strong></div>
    </div>
  </article>`

const createPrintHtml = async (
  records: QRRecord[],
  mode: QRPrintInput['mode']
) => {
  const labelMode = mode === 'LABEL'
  const cards = await Promise.all(records.map(async record => (
    createPrintCardHtml(record, await createDataUrl(record.payload, { width: labelMode ? 180 : 240 }), labelMode)
  )))

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>QR Print</title>
  <style>
    @page { size: ${labelMode ? '80mm 50mm' : 'A4'}; margin: ${labelMode ? '0' : '12mm'}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: fixed; right: 16px; top: 16px; z-index: 2; }
    .toolbar button { padding: 8px 12px; font-weight: 700; }
    .qr-sheet { display: grid; grid-template-columns: ${labelMode ? '1fr' : 'repeat(2, minmax(0, 1fr))'}; gap: ${labelMode ? '0' : '8mm'}; }
    .qr-print-card, .qr-label-card { page-break-inside: avoid; overflow: hidden; border: 1px solid #111827; background: #fff; }
    .qr-print-card { min-height: 120mm; padding: 7mm; }
    .qr-label-card { width: 80mm; height: 50mm; padding: 4mm; page-break-after: always; }
    header { display: grid; gap: 2px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-bottom: 6px; }
    header strong { font-size: ${labelMode ? '12px' : '16px'}; overflow-wrap: anywhere; }
    header span { color: #6b7280; font-size: ${labelMode ? '9px' : '11px'}; overflow-wrap: anywhere; }
    img { display: block; width: ${labelMode ? '22mm' : '48mm'}; height: ${labelMode ? '22mm' : '48mm'}; margin: ${labelMode ? '2mm 0' : '6mm auto'}; }
    .qr-print-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${labelMode ? '2px' : '6px'}; }
    .qr-print-meta span { display: block; color: #6b7280; font-size: ${labelMode ? '6px' : '9px'}; font-weight: 700; text-transform: uppercase; }
    .qr-print-meta strong { display: block; font-size: ${labelMode ? '8px' : '11px'}; overflow-wrap: anywhere; }
    @media print { .toolbar { display: none; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Yazdir</button></div>
  <main class="qr-sheet" data-mode="${escapeHtml(mode)}">${cards.join('')}</main>
</body>
</html>`
}

export const QRIntegrationService = {
  defaultUserName: DEFAULT_USER_NAME,
  moduleLabels: QR_MODULE_LABELS,
  entityLabels: QR_ENTITY_LABELS,

  createDataUrl,
  createPayload,
  parseMetadata,

  fromLot: (lot: InventoryLot): QRGenerateInput => ({
    moduleKey: 'lots',
    entityType: 'LOT',
    entityId: lot.id,
    code: lot.lotNo,
    lotNo: lot.lotNo,
    batch: '',
    date: lot.productionDate || lot.createdAt,
    version: lot.updatedAt || '1',
    title: lot.lotNo,
    description: 'Lot QR referansi'
  }),

  fromProductionOrder: (order: ProductionWorkOrder): QRGenerateInput => ({
    moduleKey: 'production-orders',
    entityType: 'PRODUCTION_ORDER',
    entityId: order.id,
    code: order.workOrderNo,
    lotNo: '',
    batch: order.linkedShipmentNo || '',
    date: order.deliveryDate || order.createdAt,
    version: order.updatedAt || '1',
    title: order.workOrderNo,
    description: 'Uretim emri QR referansi'
  }),

  fromQualitySample: (sample: QualitySample, lot?: InventoryLot | null): QRGenerateInput => ({
    moduleKey: 'samples',
    entityType: 'QUALITY_SAMPLE',
    entityId: sample.id,
    code: sample.sampleNo,
    lotNo: lot?.lotNo || sample.inventoryLotId,
    batch: '',
    date: sample.sampleDate || sample.createdAt,
    version: sample.updatedAt || '1',
    title: sample.sampleNo,
    description: 'Numune QR referansi'
  }),

  fromWitnessSample: (
    witness: WitnessSample,
    sample?: QualitySample | null,
    lot?: InventoryLot | null
  ): QRGenerateInput => ({
    moduleKey: 'witness-samples',
    entityType: 'WITNESS_SAMPLE',
    entityId: witness.id,
    code: witness.witnessNo,
    lotNo: lot?.lotNo || sample?.sampleNo || witness.qualitySampleId,
    batch: '',
    date: witness.storageStartDate || witness.createdAt,
    version: witness.updatedAt || '1',
    title: witness.witnessNo,
    description: 'Sahit numune QR referansi'
  }),

  fromShipment: (shipment: ShipmentRecord): QRGenerateInput => ({
    moduleKey: 'shipments',
    entityType: 'SHIPMENT',
    entityId: shipment.id,
    code: shipment.shipmentNo,
    lotNo: shipment.items[0]?.inventoryLotId || '',
    batch: '',
    date: shipment.shipmentDate || shipment.createdAt,
    version: shipment.updatedAt || '1',
    title: shipment.shipmentNo,
    description: 'Sevkiyat QR referansi'
  }),

  fromWasteRecord: (record: WasteRecord): QRGenerateInput => ({
    moduleKey: 'waste',
    entityType: 'WASTE_RECORD',
    entityId: record.id,
    code: record.wasteNo,
    lotNo: record.lotNo || '',
    batch: record.batchNo || '',
    date: record.date || record.createdAt,
    version: record.updatedAt || '1',
    title: record.wasteNo,
    description: 'Fire kaydi QR referansi'
  }),

  fromRecipe: (record: RecipeManagementRecord): QRGenerateInput => ({
    moduleKey: 'recipes',
    entityType: 'RECIPE',
    entityId: record.id,
    code: record.code,
    lotNo: '',
    batch: record.masterCode || record.masterId || '',
    date: record.updatedAt || record.createdAt,
    version: record.versionNo || 1,
    title: record.recipeName,
    description: 'Recete QR referansi'
  }),

  validate: (input: QRGenerateInput, existingRecords: QRRecord[] = loadRecords()): QRValidationResult => {
    const record = createRecordFromInput(input, DEFAULT_USER_NAME)
    const result = validateRecord(record, existingRecords)
    addJob(createJob('VALIDATE', result.valid ? 'SUCCESS' : 'FAILED', record, DEFAULT_USER_NAME, 1, result.valid ? 'QR dogrulandi.' : result.errors.join(' ')))
    return result
  },

  generate: (input: QRGenerateInput, userName = DEFAULT_USER_NAME): QRRecord => {
    const records = loadRecords()
    const candidate = createRecordFromInput(input, userName)
    const entityKey = createEntityKey(candidate.entityType, candidate.entityId)
    const existingRecord = records.find(record => createEntityKey(record.entityType, record.entityId) === entityKey)

    if(existingRecord) return existingRecord

    const validation = validateRecord(candidate, records)
    if(!validation.valid){
      addJob(createJob('GENERATE', 'FAILED', candidate, userName, 1, validation.errors.join(' ')))
      throw new Error(validation.errors[0] || 'QR dogrulamasi basarisiz.')
    }

    saveRecords([candidate, ...records])
    addJob(createJob('GENERATE', 'SUCCESS', candidate, userName, 1, `${candidate.moduleLabel} icin QR olusturuldu.`))
    return candidate
  },

  decode: (payload: string, userName = DEFAULT_USER_NAME): QRDecodeResult => {
    const metadata = parseMetadata(payload)
    const record = metadata
      ? loadRecords().find(item => item.payload === stringifyMetadata(metadata)) || null
      : null
    const exists = metadata ? entityExists(metadata) : false
    const validation = validateMetadata(metadata, payload, true)
    const result = createDecodeResult(validation.errors, metadata, record, exists)
    const logRecord = record || (metadata ? normalizeRecord({
      moduleKey: metadata.moduleKey,
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      code: metadata.code,
      payload: stringifyMetadata(metadata)
    }) : fallbackRecord(payload))

    addJob(createJob('DECODE', result.valid ? 'SUCCESS' : 'FAILED', logRecord, userName, result.record ? 1 : 0, result.valid ? 'QR decode edildi.' : result.errors.join(' ')))
    return result
  },

  createPreview: async (input: QRGenerateInput, userName = DEFAULT_USER_NAME): Promise<QRPreviewResult> => {
    const record = QRIntegrationService.generate(input, userName)
    const validation = validateRecord(record, loadRecords().filter(item => item.id !== record.id))
    const imageDataUrl = await createDataUrl(record.payload)
    const decode = QRIntegrationService.decode(record.payload, userName)

    return {
      record,
      imageDataUrl,
      validation,
      decode
    }
  },

  createPrintHtml,

  openPrintWindow: async (input: QRPrintInput) => {
    if(typeof window === 'undefined') return false
    const quantity = Math.max(1, Math.min(500, Math.floor(input.quantity || 1)))
    const records = input.records.map(record => resolveRecordForPrint(record, input.userName))
    if(records.length === 0) throw new Error('Yazdirilacak QR bulunamadi.')

    const printableRecords = input.mode === 'MULTIPLE'
      ? Array.from({ length: quantity }, () => records[0])
      : input.mode === 'SINGLE'
        ? [records[0]]
        : records

    const html = await createPrintHtml(printableRecords, input.mode)
    const printWindow = window.open('', '_blank', 'width=960,height=1200')
    if(!printWindow) return false
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 450)

    addJob(createJob('PRINT', 'SUCCESS', printableRecords[0], input.userName, printableRecords.length, `${printableRecords.length} QR yazdirma penceresi acildi.`))
    return true
  },

  list: loadRecords,
  save: saveRecords,
  history: {
    list: loadJobs,
    add: addJob
  },
  metadata: {
    create: createMetadata,
    parse: parseMetadata,
    validate: (payload: string) => validateMetadata(parseMetadata(payload), payload)
  }
}
