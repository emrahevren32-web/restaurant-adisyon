import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { Branch, StockItem, StockUnit } from '../types'
import type { WitnessSample } from '../witness-samples/witness-sample.types'
import { createLabelHistory, appendLabelHistory } from './label-history.service'
import { getLabelTemplate, LABEL_TYPE_LABELS, LABEL_TEMPLATES } from './label-template.service'
import { validateLabel, validatePrintQuantity } from './label-validation.service'
import type {
  Label,
  LabelCreateInput,
  LabelFilters,
  LabelHistory,
  LabelHistoryAction,
  LabelPrintJob,
  LabelPrintMode,
  LabelStatistics,
  LabelStatus,
  LabelType
} from './label.types'

export const LABEL_STORAGE_KEY = 'ra_label_management_labels'
export const LABEL_PRINT_JOB_STORAGE_KEY = 'ra_label_management_print_jobs'

export const LABEL_STATUSES: LabelStatus[] = ['DRAFT', 'READY', 'PRINTED', 'CANCELLED']

export const LABEL_STATUS_LABELS: Record<LabelStatus, string> = {
  DRAFT: 'Taslak',
  READY: 'Hazir',
  PRINTED: 'Basildi',
  CANCELLED: 'Iptal'
}

const DEFAULT_UNIT: StockUnit = 'adet'
const LABEL_NO_PADDING = 6
const LABEL_SEED_COUNT = 14
const QUANTITY_ROUNDING_FACTOR = 1000

type RawLabel = Partial<Record<keyof Label, unknown>> & Record<string, unknown>
type RawLabelHistory = Partial<Record<keyof LabelHistory, unknown>> & Record<string, unknown>
type RawLabelPrintJob = Partial<Record<keyof LabelPrintJob, unknown>> & Record<string, unknown>

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawLabel => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHistoryRecord = (value: unknown): value is RawLabelHistory => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isPrintJobRecord = (value: unknown): value is RawLabelPrintJob => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStringArray = (value: unknown) => (
  Array.isArray(value) ? value.map(item => normalizeText(item)).filter(Boolean) : []
)

const normalizeStatus = (value: unknown): LabelStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return LABEL_STATUSES.includes(normalized as LabelStatus) ? normalized as LabelStatus : 'READY'
}

const normalizeUnit = (value: unknown, fallback: StockUnit = DEFAULT_UNIT): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : fallback
}

const normalizeLabelType = (value: unknown): LabelType => {
  const normalized = normalizeText(value).toUpperCase()
  const types: LabelType[] = ['PRODUCT', 'LOT', 'BOX', 'PALLET', 'BLAST_CHILLING', 'SAMPLE', 'WITNESS_SAMPLE', 'WAREHOUSE_SHELF', 'SHIPMENT']
  return types.includes(normalized as LabelType) ? normalized as LabelType : 'PRODUCT'
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createMap = <TRecord extends { id: string }>(records: TRecord[]) => (
  new Map(records.map(record => [record.id, record]))
)

export const createDefaultLabelFilters = (): LabelFilters => ({
  branchId: 'all',
  warehouseId: 'all',
  labelType: 'all',
  date: '',
  search: ''
})

export const getNextLabelNo = (
  records: Pick<Label, 'labelNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^LBL-${year}-(\\d{${LABEL_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.labelNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `LBL-${year}-${String(maxNo + 1 + offset).padStart(LABEL_NO_PADDING, '0')}`
}

const getBranchName = (
  branchId: string,
  branches: Branch[]
) => branches.find(branch => branch.id === branchId)?.name || branchId || '-'

const getStockItem = (
  lot: InventoryLot,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => item.id === lot.stockItemId) || null

const getProductName = (
  lot: InventoryLot,
  stockItem: StockItem | null,
  sourceData: KpiSourceData
) => {
  const productRef = sourceData.productRefs.find(product => (
    product.id === lot.productId || product.stockItemId === lot.stockItemId
  ))

  return productRef?.name || stockItem?.name || lot.productId || '-'
}

const getProductCode = (
  lot: InventoryLot,
  stockItem: StockItem | null
) => stockItem?.sku || stockItem?.barcode || lot.productId || lot.stockItemId || lot.lotNo

const getProductionOrderNo = (
  productionOrderId: string,
  sourceData: KpiSourceData
) => sourceData.productionOrders.find(order => order.id === productionOrderId)?.workOrderNo || productionOrderId || ''

const getRecipe = (
  productName: string,
  sourceData: KpiSourceData
): RecipeManagementRecord | null => {
  const normalizedProductName = normalizeSearchText(productName)
  return sourceData.recipeRecords.find(recipe => (
    recipe.status === 'Aktif'
    && normalizeSearchText(recipe.productName) === normalizedProductName
  )) || sourceData.recipeRecords.find(recipe => (
    recipe.status === 'Aktif'
    && normalizeSearchText(recipe.recipeName).includes(normalizedProductName)
  )) || null
}

const getShipment = (
  lot: InventoryLot,
  sourceData: KpiSourceData
): ShipmentRecord | null => sourceData.shipments.find(shipment => (
  shipment.items.some(item => item.inventoryLotId === lot.id || item.stockItemId === lot.stockItemId)
)) || null

const getSample = (
  lotId: string,
  sourceData: KpiSourceData
): QualitySample | null => sourceData.qualitySamples.find(sample => sample.inventoryLotId === lotId) || null

const getWitnessSample = (
  sampleId: string,
  sourceData: KpiSourceData
): WitnessSample | null => sourceData.witnessSamples.find(sample => sample.qualitySampleId === sampleId) || null

const getHaccpPlan = (
  lot: InventoryLot,
  sourceData: KpiSourceData
) => sourceData.haccpRecords.find(record => (
  record.monitoringRecords.some(item => (
    item.inventoryLotId === lot.id || item.productionOrderId === lot.productionOrderId
  ))
)) || null

const getPallet = (
  lot: InventoryLot,
  sourceData: KpiSourceData
) => sourceData.shipmentPallets.find(pallet => (
  pallet.items.some(item => item.inventoryLotId === lot.id || item.stockItemId === lot.stockItemId)
)) || null

const quantityToKg = (
  quantity: number,
  unit: StockUnit
) => {
  if(unit === 'kg') return quantity
  if(unit === 'gr') return quantity / 1000
  return quantity
}

export const createLabelQrPayload = (
  label: Pick<Label, 'lotNo' | 'productName' | 'productionDate' | 'expiryDate' | 'id' | 'labelNo'>
) => JSON.stringify({
  lot: label.lotNo,
  product: label.productName,
  productionDate: label.productionDate,
  expiryDate: label.expiryDate,
  erpId: label.id,
  labelNo: label.labelNo
})

const createBarcodeValue = (
  labelNo: string,
  lotNo: string,
  productCode: string
) => `${labelNo}|${lotNo}|${productCode}`.replace(/\s+/g, '-').slice(0, 80)

const getTemplateForCreate = (
  labelType: LabelType,
  templateId: string
) => {
  const selectedTemplate = getLabelTemplate(templateId)
  if(selectedTemplate.supportedTypes.includes(labelType)) return selectedTemplate
  return LABEL_TEMPLATES.find(template => template.supportedTypes.includes(labelType)) || selectedTemplate
}

export const createLabelFromLot = (
  input: LabelCreateInput,
  sourceData: KpiSourceData,
  existingLabels: Label[] = loadLabelRecords(sourceData)
): Label => {
  const lot = sourceData.inventoryLots.find(record => record.id === input.lotId)
  if(!lot) throw new Error('Lot kaydi bulunamadi.')

  const stockItem = getStockItem(lot, sourceData)
  const productName = getProductName(lot, stockItem, sourceData)
  const productCode = getProductCode(lot, stockItem)
  const recipe = getRecipe(productName, sourceData)
  const shipment = getShipment(lot, sourceData)
  const sample = getSample(lot.id, sourceData)
  const witness = sample ? getWitnessSample(sample.id, sourceData) : null
  const haccpPlan = getHaccpPlan(lot, sourceData)
  const pallet = getPallet(lot, sourceData)
  const template = getTemplateForCreate(input.labelType, input.templateId)
  const productionOrderNo = getProductionOrderNo(lot.productionOrderId, sourceData) || lot.productionOrderId || `WO-${lot.lotNo.replace(/\D/g, '').slice(-6).padStart(6, '0')}`
  const recipeName = recipe?.recipeName || `${productName} Standart`
  const now = new Date().toISOString()
  const labelNo = getNextLabelNo(existingLabels, getTodayKey())
  const id = createId('label')
  const netWeight = roundQuantity(quantityToKg(input.quantity || lot.remainingQuantity || lot.quantity, lot.unit))
  const label: Label = {
    id,
    labelNo,
    labelType: input.labelType,
    status: 'READY',
    templateId: template.id,
    templateName: template.name,
    templateSize: template.size,
    barcodeType: 'CODE_128',
    barcodeValue: createBarcodeValue(labelNo, lot.lotNo, productCode),
    qrPayload: '',
    dataMatrixPayload: `DMX-PREP|${labelNo}|${lot.lotNo}|${productCode}`,
    productId: lot.productId || stockItem?.id || '',
    productCode,
    productName,
    lotId: lot.id,
    lotNo: lot.lotNo,
    batchNo: lot.lotNo,
    productionDate: lot.productionDate,
    expiryDate: lot.expiryDate,
    netWeight,
    grossWeight: roundQuantity(netWeight * 1.04),
    unit: lot.unit,
    warehouseId: lot.warehouseId,
    warehouseName: getBranchName(lot.warehouseId, sourceData.branches),
    branchId: shipment?.destinationBranchId || lot.warehouseId,
    branchName: getBranchName(shipment?.destinationBranchId || lot.warehouseId, sourceData.branches),
    productionOrderId: lot.productionOrderId,
    productionOrderNo,
    recipeId: recipe?.id || '',
    recipeCode: recipe?.code || '',
    recipeName,
    shipmentId: shipment?.id || '',
    shipmentNo: shipment?.shipmentNo || '',
    customerId: shipment?.destinationBranchId || '',
    customerName: getBranchName(shipment?.destinationBranchId || '', sourceData.branches),
    sampleId: sample?.id || '',
    sampleNo: sample?.sampleNo || '',
    witnessSampleId: witness?.id || '',
    witnessNo: witness?.witnessNo || '',
    haccpPlanId: haccpPlan?.id || '',
    haccpPlanName: haccpPlan?.name || '',
    palletId: pallet?.id || '',
    palletNo: pallet?.palletNo || '',
    description: `${LABEL_TYPE_LABELS[input.labelType]} ${lot.lotNo} lotu icin read modelden olusturuldu.`,
    createdBy: input.actorName,
    createdAt: now,
    updatedAt: now,
    history: [createLabelHistory(id, 'CREATED', input.actorName, `${LABEL_TYPE_LABELS[input.labelType]} olusturuldu.`, 1, now)]
  }
  const labelWithQr = {
    ...label,
    qrPayload: createLabelQrPayload(label)
  }
  const validation = validateLabel(labelWithQr, existingLabels)
  if(!validation.valid) throw new Error(validation.errors[0] || 'Etiket dogrulamasi basarisiz.')

  return labelWithQr
}

const normalizeHistory = (
  item: RawLabelHistory,
  labelId: string,
  index: number
): LabelHistory => ({
  id: normalizeText(item.id) || `label_history_${labelId}_${index + 1}`,
  labelId: normalizeText(item.labelId) || labelId,
  action: normalizeText(item.action).toUpperCase() as LabelHistoryAction || 'UPDATED',
  actorName: normalizeText(item.actorName) || 'System',
  quantity: normalizePositiveNumber(item.quantity),
  description: normalizeText(item.description),
  createdAt: normalizeText(item.createdAt) || new Date().toISOString()
})

const normalizeLabel = (
  item: RawLabel,
  index: number,
  sourceData: KpiSourceData
): Label => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `label_${index + 1}`
  const labelType = normalizeLabelType(item.labelType)
  const template = getLabelTemplate(normalizeText(item.templateId))
  const lotId = normalizeText(item.lotId)
  const lot = sourceData.inventoryLots.find(record => record.id === lotId)
  const stockItem = lot ? getStockItem(lot, sourceData) : null
  const productName = normalizeText(item.productName) || (lot ? getProductName(lot, stockItem, sourceData) : '-')
  const productCode = normalizeText(item.productCode) || (lot ? getProductCode(lot, stockItem) : id)
  const fallbackRecipe = lot ? getRecipe(productName, sourceData) : null
  const labelNo = normalizeText(item.labelNo) || getNextLabelNo([], getTodayKey(), index)
  const barcodeValue = normalizeText(item.barcodeValue) || createBarcodeValue(labelNo, normalizeText(item.lotNo) || lot?.lotNo || '', productCode)
  const rawHistory = Array.isArray(item.history) ? item.history.filter(isHistoryRecord) : []
  const productionDate = normalizeText(item.productionDate) || lot?.productionDate || getTodayKey()
  const expiryDate = normalizeText(item.expiryDate) || lot?.expiryDate || addDays(productionDate, 3)
  const label: Label = {
    id,
    labelNo,
    labelType,
    status: normalizeStatus(item.status),
    templateId: normalizeText(item.templateId) || template.id,
    templateName: normalizeText(item.templateName) || template.name,
    templateSize: template.size,
    barcodeType: 'CODE_128',
    barcodeValue,
    qrPayload: normalizeText(item.qrPayload),
    dataMatrixPayload: normalizeText(item.dataMatrixPayload) || `DMX-PREP|${labelNo}`,
    productId: normalizeText(item.productId) || lot?.productId || stockItem?.id || '',
    productCode,
    productName,
    lotId,
    lotNo: normalizeText(item.lotNo) || lot?.lotNo || '',
    batchNo: normalizeText(item.batchNo) || lot?.lotNo || '',
    productionDate,
    expiryDate,
    netWeight: normalizeNonNegativeNumber(item.netWeight) || normalizeNonNegativeNumber(lot?.remainingQuantity),
    grossWeight: normalizeNonNegativeNumber(item.grossWeight) || normalizeNonNegativeNumber(lot?.remainingQuantity) * 1.04,
    unit: normalizeUnit(item.unit, lot?.unit || stockItem?.unit || DEFAULT_UNIT),
    warehouseId: normalizeText(item.warehouseId) || lot?.warehouseId || '',
    warehouseName: normalizeText(item.warehouseName) || getBranchName(normalizeText(item.warehouseId) || lot?.warehouseId || '', sourceData.branches),
    branchId: normalizeText(item.branchId) || lot?.warehouseId || '',
    branchName: normalizeText(item.branchName) || getBranchName(normalizeText(item.branchId) || lot?.warehouseId || '', sourceData.branches),
    productionOrderId: normalizeText(item.productionOrderId) || lot?.productionOrderId || '',
    productionOrderNo: normalizeText(item.productionOrderNo) || getProductionOrderNo(lot?.productionOrderId || '', sourceData) || (lot ? `WO-${lot.lotNo.replace(/\D/g, '').slice(-6).padStart(6, '0')}` : ''),
    recipeId: normalizeText(item.recipeId),
    recipeCode: normalizeText(item.recipeCode),
    recipeName: normalizeText(item.recipeName) || fallbackRecipe?.recipeName || (lot ? `${productName} Standart` : ''),
    shipmentId: normalizeText(item.shipmentId),
    shipmentNo: normalizeText(item.shipmentNo),
    customerId: normalizeText(item.customerId),
    customerName: normalizeText(item.customerName),
    sampleId: normalizeText(item.sampleId),
    sampleNo: normalizeText(item.sampleNo),
    witnessSampleId: normalizeText(item.witnessSampleId),
    witnessNo: normalizeText(item.witnessNo),
    haccpPlanId: normalizeText(item.haccpPlanId),
    haccpPlanName: normalizeText(item.haccpPlanName),
    palletId: normalizeText(item.palletId),
    palletNo: normalizeText(item.palletNo),
    description: normalizeText(item.description),
    createdBy: normalizeText(item.createdBy) || 'System',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    history: rawHistory.length > 0
      ? rawHistory.map((history, historyIndex) => normalizeHistory(history, id, historyIndex))
      : [createLabelHistory(id, 'CREATED', normalizeText(item.createdBy) || 'System', 'Etiket read model kaydi olusturuldu.', 1, createdAt)]
  }

  return {
    ...label,
    qrPayload: label.qrPayload || createLabelQrPayload(label)
  }
}

const createSeedLabels = (
  sourceData: KpiSourceData
): Label[] => {
  const candidateLots = sourceData.inventoryLots
    .filter(lot => lot.lotNo && lot.quantity > 0)
    .slice(0, LABEL_SEED_COUNT)
  const labelTypes: LabelType[] = ['PRODUCT', 'LOT', 'BOX', 'PALLET', 'BLAST_CHILLING', 'SAMPLE', 'WITNESS_SAMPLE', 'WAREHOUSE_SHELF', 'SHIPMENT']

  return candidateLots.map((lot, index) => {
    const labelType = labelTypes[index % labelTypes.length]
    const template = LABEL_TEMPLATES.find(item => item.supportedTypes.includes(labelType)) || LABEL_TEMPLATES[0]
    const label = createLabelFromLot({
      lotId: lot.id,
      labelType,
      templateId: template.id,
      quantity: Math.max(1, Math.min(lot.remainingQuantity || lot.quantity, 48)),
      actorName: 'Kalite Ekibi'
    }, sourceData, [])
    const date = index === 0 ? getTodayKey() : addDays(getTodayKey(), -index)
    const status: LabelStatus = index % 4 === 0 ? 'PRINTED' : 'READY'

    return {
      ...label,
      id: `label_management_${index + 1}`,
      labelNo: getNextLabelNo([], date, index),
      status,
      createdAt: `${date}T08:00:00.000Z`,
      updatedAt: `${date}T09:00:00.000Z`,
      history: [
        createLabelHistory(`label_management_${index + 1}`, 'CREATED', 'Kalite Ekibi', `${LABEL_TYPE_LABELS[labelType]} olusturuldu.`, 1, `${date}T08:00:00.000Z`),
        ...(status === 'PRINTED'
          ? [createLabelHistory(`label_management_${index + 1}`, 'PRINTED', 'Kalite Ekibi', 'Etiket yazdirildi.', 2 + (index % 5), `${date}T09:00:00.000Z`)]
          : [])
      ]
    }
  }).map(label => ({
    ...label,
    barcodeValue: createBarcodeValue(label.labelNo, label.lotNo, label.productCode),
    qrPayload: createLabelQrPayload(label)
  }))
}

export const saveLabelRecords = (
  labels: Label[],
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedLabels = labels.map((label, index) => normalizeLabel(label, index, sourceData))
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(normalizedLabels))
}

export const loadLabelRecords = (
  sourceData: KpiSourceData
) => {
  const seedLabels = createSeedLabels(sourceData)
  if(!isBrowserStorageAvailable()) return seedLabels

  const storedLabels = localStorage.getItem(LABEL_STORAGE_KEY)
  if(!storedLabels){
    if(seedLabels.length > 0) saveLabelRecords(seedLabels, sourceData)
    return seedLabels
  }

  try{
    const parsed = JSON.parse(storedLabels)
    if(Array.isArray(parsed)){
      const normalizedLabels = parsed
        .filter(isRecord)
        .map((label, index) => normalizeLabel(label, index, sourceData))
      saveLabelRecords(normalizedLabels, sourceData)
      return normalizedLabels
    }
  } catch {
    if(seedLabels.length > 0) saveLabelRecords(seedLabels, sourceData)
    return seedLabels
  }

  if(seedLabels.length > 0) saveLabelRecords(seedLabels, sourceData)
  return seedLabels
}

const normalizePrintMode = (value: unknown): LabelPrintMode => {
  const normalized = normalizeText(value).toUpperCase()
  const modes: LabelPrintMode[] = ['SINGLE', 'BULK', 'LOT', 'PRODUCTION_ORDER', 'PALLET']
  return modes.includes(normalized as LabelPrintMode) ? normalized as LabelPrintMode : 'SINGLE'
}

const normalizePrintJob = (
  item: RawLabelPrintJob,
  index: number
): LabelPrintJob => ({
  id: normalizeText(item.id) || `label_print_job_${index + 1}`,
  labelIds: normalizeStringArray(item.labelIds),
  labelNos: normalizeStringArray(item.labelNos),
  templateId: normalizeText(item.templateId),
  templateName: normalizeText(item.templateName),
  printMode: normalizePrintMode(item.printMode),
  quantity: normalizePositiveNumber(item.quantity),
  actorName: normalizeText(item.actorName) || 'System',
  printedAt: normalizeText(item.printedAt) || new Date().toISOString(),
  status: normalizeText(item.status).toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
  message: normalizeText(item.message)
})

const createSeedPrintJobs = (
  labels: Label[]
): LabelPrintJob[] => labels
  .filter(label => label.status === 'PRINTED')
  .map((label, index) => ({
    id: `label_print_job_${index + 1}`,
    labelIds: [label.id],
    labelNos: [label.labelNo],
    templateId: label.templateId,
    templateName: label.templateName,
    printMode: 'SINGLE',
    quantity: 2 + (index % 5),
    actorName: 'Kalite Ekibi',
    printedAt: label.updatedAt,
    status: 'SUCCESS',
    message: `${label.labelNo} yazdirildi.`
  }))

export const saveLabelPrintJobs = (jobs: LabelPrintJob[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(LABEL_PRINT_JOB_STORAGE_KEY, JSON.stringify(jobs.map(normalizePrintJob)))
}

export const loadLabelPrintJobs = (
  labels: Label[] = []
) => {
  const seedJobs = createSeedPrintJobs(labels)
  if(!isBrowserStorageAvailable()) return seedJobs

  const storedJobs = localStorage.getItem(LABEL_PRINT_JOB_STORAGE_KEY)
  if(!storedJobs){
    if(seedJobs.length > 0) saveLabelPrintJobs(seedJobs)
    return seedJobs
  }

  try{
    const parsed = JSON.parse(storedJobs)
    if(Array.isArray(parsed)){
      const normalizedJobs = parsed.filter(isPrintJobRecord).map(normalizePrintJob)
      saveLabelPrintJobs(normalizedJobs)
      return normalizedJobs
    }
  } catch {
    if(seedJobs.length > 0) saveLabelPrintJobs(seedJobs)
    return seedJobs
  }

  if(seedJobs.length > 0) saveLabelPrintJobs(seedJobs)
  return seedJobs
}

export const addLabelFromLot = (
  input: LabelCreateInput,
  sourceData: KpiSourceData
) => {
  const labels = loadLabelRecords(sourceData)
  const label = createLabelFromLot(input, sourceData, labels)
  const nextLabels = [label, ...labels]
  saveLabelRecords(nextLabels, sourceData)
  return label
}

const matchesFilter = (
  selectedValue: string,
  candidateValue: string
) => selectedValue === 'all' || !selectedValue || selectedValue === candidateValue

export const filterLabels = (
  labels: Label[],
  filters: LabelFilters
) => {
  const search = normalizeSearchText(filters.search)

  return labels.filter(label => {
    const searchable = [
      label.labelNo,
      label.productName,
      label.productCode,
      label.lotNo,
      label.batchNo,
      label.productionOrderNo,
      label.recipeName,
      label.barcodeValue,
      label.palletNo,
      label.shipmentNo,
      label.sampleNo,
      label.witnessNo
    ].map(normalizeSearchText).join(' ')

    return (
      matchesFilter(filters.branchId, label.branchId)
      && matchesFilter(filters.warehouseId, label.warehouseId)
      && (filters.labelType === 'all' || label.labelType === filters.labelType)
      && (!filters.date || label.createdAt.slice(0, 10) === filters.date || label.productionDate === filters.date)
      && (!search || searchable.includes(search))
    )
  })
}

export const recordLabelPrint = (
  labelsToPrint: Label[],
  printMode: LabelPrintMode,
  quantity: number,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const quantityValidation = validatePrintQuantity(quantity)
  if(!quantityValidation.valid) throw new Error(quantityValidation.errors[0] || 'Yazdirma adedi gecersiz.')
  if(labelsToPrint.length === 0) throw new Error('Yazdirilacak etiket bulunamadi.')

  const labels = loadLabelRecords(sourceData)
  const targetIds = new Set(labelsToPrint.map(label => label.id))
  const printedAt = new Date().toISOString()
  const updatedLabels = labels.map(label => {
    if(!targetIds.has(label.id)) return label
    return appendLabelHistory(
      { ...label, status: 'PRINTED', updatedAt: printedAt },
      printMode === 'SINGLE' ? 'PRINTED' : 'BULK_PRINTED',
      actorName,
      `${label.labelNo} ${quantity} adet yazdirildi.`,
      quantity
    )
  })
  const firstTemplate = labelsToPrint[0]
  const job: LabelPrintJob = {
    id: createId('label_print_job'),
    labelIds: labelsToPrint.map(label => label.id),
    labelNos: labelsToPrint.map(label => label.labelNo),
    templateId: firstTemplate.templateId,
    templateName: firstTemplate.templateName,
    printMode,
    quantity: labelsToPrint.length * quantity,
    actorName,
    printedAt,
    status: 'SUCCESS',
    message: `${labelsToPrint.length} etiket, ${quantity} adet olarak yazdirildi.`
  }

  saveLabelRecords(updatedLabels, sourceData)
  saveLabelPrintJobs([job, ...loadLabelPrintJobs(updatedLabels)])
  return { job, labels: updatedLabels.filter(label => targetIds.has(label.id)) }
}

export const recordLabelOutput = (
  labelId: string,
  action: Extract<LabelHistoryAction, 'EXCEL' | 'CANCELLED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const labels = loadLabelRecords(sourceData)
  const label = labels.find(item => item.id === labelId)
  if(!label) throw new Error('Etiket bulunamadi.')
  const nextLabel = appendLabelHistory(
    {
      ...label,
      status: action === 'CANCELLED' ? 'CANCELLED' : label.status,
      updatedAt: new Date().toISOString()
    },
    action,
    actorName,
    action === 'EXCEL' ? `${label.labelNo} Excel export edildi.` : `${label.labelNo} iptal edildi.`,
    1
  )
  const validation = validateLabel(nextLabel, labels.filter(item => item.id !== label.id))
  if(!validation.valid) throw new Error(validation.errors[0] || 'Etiket dogrulamasi basarisiz.')
  const nextLabels = labels.map(item => item.id === labelId ? nextLabel : item)
  saveLabelRecords(nextLabels, sourceData)
  return nextLabel
}

export const createLabelStatistics = (
  labels: Label[],
  printJobs: LabelPrintJob[]
): LabelStatistics => {
  const today = getTodayKey()
  const productPrints = new Map<string, number>()
  const lotPrints = new Map<string, number>()
  const labelById = createMap(labels)

  for(const job of printJobs.filter(item => item.status === 'SUCCESS')){
    for(const labelId of job.labelIds){
      const label = labelById.get(labelId)
      if(!label) continue
      productPrints.set(label.productName, (productPrints.get(label.productName) || 0) + job.quantity)
      lotPrints.set(label.lotNo, (lotPrints.get(label.lotNo) || 0) + job.quantity)
    }
  }

  const topProduct = [...productPrints.entries()].sort((first, second) => second[1] - first[1])[0]
  const topLot = [...lotPrints.entries()].sort((first, second) => second[1] - first[1])[0]

  return {
    todayPrinted: printJobs
      .filter(job => job.status === 'SUCCESS' && job.printedAt.slice(0, 10) === today)
      .reduce((total, job) => total + job.quantity, 0),
    totalPrinted: printJobs
      .filter(job => job.status === 'SUCCESS')
      .reduce((total, job) => total + job.quantity, 0),
    totalLabels: labels.length,
    readyLabels: labels.filter(label => label.status === 'READY').length,
    printedLabels: labels.filter(label => label.status === 'PRINTED').length,
    topPrintedProduct: topProduct ? `${topProduct[0]} (${topProduct[1]})` : '-',
    topPrintedLot: topLot ? `${topLot[0]} (${topLot[1]})` : '-',
    totalTemplates: LABEL_TEMPLATES.length
  }
}

export const LabelService = {
  statuses: LABEL_STATUSES,
  statusLabels: LABEL_STATUS_LABELS,
  createDefaultFilters: createDefaultLabelFilters,
  getNextLabelNo,
  createQrPayload: createLabelQrPayload,
  createFromLot: createLabelFromLot,
  addFromLot: addLabelFromLot,
  list: loadLabelRecords,
  save: saveLabelRecords,
  filter: filterLabels,
  validate: validateLabel,
  recordPrint: recordLabelPrint,
  recordOutput: recordLabelOutput,
  listPrintJobs: loadLabelPrintJobs,
  savePrintJobs: saveLabelPrintJobs,
  statistics: createLabelStatistics
}
