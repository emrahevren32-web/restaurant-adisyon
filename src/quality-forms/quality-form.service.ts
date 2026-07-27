import type { MonitoringRecord } from '../haccp/haccp.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { StockItem, StockUnit } from '../types'
import { WasteService } from '../waste-management/waste.service'
import {
  QualityDecisionService,
  createQualityDecision,
  getQualityStatusFromResult,
  mapCriterionStatusToResult
} from './quality-decision.service'
import { appendQualityHistory, createQualityHistory } from './quality-form-history.service'
import { createQualityFormStatistics } from './quality-form-statistics.service'
import { validateQualityForm } from './quality-form-validation.service'
import type {
  QualityCriterionKey,
  QualityCriterionStatus,
  QualityDecision,
  QualityForm,
  QualityFormCreateInput,
  QualityFormFilters,
  QualityFormStatus,
  QualityFormTemplate,
  QualityFormTemplateCriterion,
  QualityFormType,
  QualityHistory,
  QualityHistoryAction,
  QualityInspection,
  QualityInspectionResult
} from './quality-form.types'

export const QUALITY_FORM_STORAGE_KEY = 'ra_quality_forms_records'
export const QUALITY_FORM_TEMPLATE_STORAGE_KEY = 'ra_quality_forms_templates'

export const QUALITY_FORM_TYPES: QualityFormType[] = [
  'GOODS_RECEIPT_CONTROL',
  'PRODUCTION_CONTROL',
  'INTERMEDIATE_PRODUCT_CONTROL',
  'FINAL_PRODUCT_CONTROL',
  'MICROBIOLOGICAL_CONTROL',
  'CHEMICAL_ANALYSIS',
  'PHYSICAL_CONTROL',
  'SENSORY_ANALYSIS',
  'RELEASE_FORM',
  'CAPA_FORM'
]

export const QUALITY_FORM_TYPE_LABELS: Record<QualityFormType, string> = {
  GOODS_RECEIPT_CONTROL: 'Mal Kabul Kontrol Formu',
  PRODUCTION_CONTROL: 'Uretim Kontrol Formu',
  INTERMEDIATE_PRODUCT_CONTROL: 'Ara Urun Kontrol Formu',
  FINAL_PRODUCT_CONTROL: 'Son Urun Kontrol Formu',
  MICROBIOLOGICAL_CONTROL: 'Mikrobiyolojik Kontrol',
  CHEMICAL_ANALYSIS: 'Kimyasal Analiz',
  PHYSICAL_CONTROL: 'Fiziksel Kontrol',
  SENSORY_ANALYSIS: 'Duyusal Analiz',
  RELEASE_FORM: 'Serbest Birakma Formu',
  CAPA_FORM: 'CAPA Formu'
}

export const QUALITY_FORM_STATUSES: QualityFormStatus[] = [
  'DRAFT',
  'INSPECTING',
  'APPROVED',
  'CONDITIONAL_APPROVED',
  'REJECTED',
  'CANCELLED'
]

export const QUALITY_FORM_STATUS_LABELS: Record<QualityFormStatus, string> = {
  DRAFT: 'Taslak',
  INSPECTING: 'Kontrol Ediliyor',
  APPROVED: 'Onaylandi',
  CONDITIONAL_APPROVED: 'Sartli Onay',
  REJECTED: 'Reddedildi',
  CANCELLED: 'Iptal'
}

export const QUALITY_INSPECTION_RESULTS: QualityInspectionResult[] = [
  'PASS',
  'CONDITIONAL',
  'FAIL'
]

export const QUALITY_INSPECTION_RESULT_LABELS: Record<QualityInspectionResult, string> = {
  PASS: 'PASS',
  CONDITIONAL: 'CONDITIONAL',
  FAIL: 'FAIL'
}

export const QUALITY_CRITERION_STATUSES: QualityCriterionStatus[] = [
  'PASS',
  'WARNING',
  'FAIL',
  'NOT_APPLICABLE'
]

export const QUALITY_STATUS_LABELS: Record<QualityCriterionStatus, string> = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'N/A'
}

export const QUALITY_CRITERION_LABELS: Record<QualityCriterionKey, string> = {
  TEMPERATURE: 'Sicaklik',
  WEIGHT: 'Agirlik',
  COLOR: 'Renk',
  SMELL: 'Koku',
  TASTE: 'Tat',
  PACKAGING: 'Ambalaj',
  LABEL: 'Etiket',
  MOISTURE: 'Nem',
  PH: 'pH',
  BRIX: 'Brix',
  MICROBIOLOGICAL: 'Mikrobiyolojik Sonuc',
  CHEMICAL: 'Kimyasal Sonuc',
  VISUAL: 'Gorsel Kontrol'
}

type CriterionSeed = {
  key: QualityCriterionKey
  limit: string
  required?: boolean
}

type RawQualityForm = Partial<Record<keyof QualityForm, unknown>> & Record<string, unknown>
type RawQualityInspection = Partial<Record<keyof QualityInspection, unknown>> & Record<string, unknown>
type RawQualityDecision = Partial<Record<keyof QualityDecision, unknown>> & Record<string, unknown>
type RawQualityHistory = Partial<Record<keyof QualityHistory, unknown>> & Record<string, unknown>
type RawQualityTemplate = Partial<Record<keyof QualityFormTemplate, unknown>> & Record<string, unknown>

const DEFAULT_TEMPLATE_CRITERIA: Record<QualityFormType, CriterionSeed[]> = {
  GOODS_RECEIPT_CONTROL: [
    { key: 'TEMPERATURE', limit: '0-4 C soguk zincir' },
    { key: 'PACKAGING', limit: 'Hasarsiz ambalaj' },
    { key: 'LABEL', limit: 'Lot ve SKT okunabilir' },
    { key: 'VISUAL', limit: 'Yabanci madde yok' },
    { key: 'SMELL', limit: 'Uygunsuz koku yok' }
  ],
  PRODUCTION_CONTROL: [
    { key: 'TEMPERATURE', limit: 'Proses kritik limiti' },
    { key: 'WEIGHT', limit: 'Recete gramaji toleransi' },
    { key: 'VISUAL', limit: 'Gorsel kalite uygun' },
    { key: 'LABEL', limit: 'Uretim emri ve lot dogru' }
  ],
  INTERMEDIATE_PRODUCT_CONTROL: [
    { key: 'WEIGHT', limit: 'Ara urun gramaj toleransi' },
    { key: 'COLOR', limit: 'Standart renk' },
    { key: 'SMELL', limit: 'Uygun koku' },
    { key: 'PH', limit: 'Recete pH araligi', required: false }
  ],
  FINAL_PRODUCT_CONTROL: [
    { key: 'WEIGHT', limit: 'Net agirlik toleransi' },
    { key: 'TASTE', limit: 'Duyusal kabul' },
    { key: 'PACKAGING', limit: 'Paket butunlugu' },
    { key: 'LABEL', limit: 'Etiket dogrulama' },
    { key: 'VISUAL', limit: 'Gorsel kalite' }
  ],
  MICROBIOLOGICAL_CONTROL: [
    { key: 'MICROBIOLOGICAL', limit: 'Limit ici sonuc' },
    { key: 'TEMPERATURE', limit: 'Numune saklama sicakligi', required: false },
    { key: 'VISUAL', limit: 'Numune kabulu' }
  ],
  CHEMICAL_ANALYSIS: [
    { key: 'CHEMICAL', limit: 'Limit ici sonuc' },
    { key: 'PH', limit: 'pH limit araligi' },
    { key: 'BRIX', limit: 'Brix hedef araligi', required: false }
  ],
  PHYSICAL_CONTROL: [
    { key: 'WEIGHT', limit: 'Agirlik toleransi' },
    { key: 'MOISTURE', limit: 'Nem toleransi', required: false },
    { key: 'VISUAL', limit: 'Fiziksel uygunsuzluk yok' }
  ],
  SENSORY_ANALYSIS: [
    { key: 'COLOR', limit: 'Standart renk' },
    { key: 'SMELL', limit: 'Uygun koku' },
    { key: 'TASTE', limit: 'Uygun tat' },
    { key: 'VISUAL', limit: 'Gorsel kabul' }
  ],
  RELEASE_FORM: [
    { key: 'LABEL', limit: 'Serbest birakma etiketi uygun' },
    { key: 'PACKAGING', limit: 'Ambalaj uygun' },
    { key: 'VISUAL', limit: 'Son kontrol uygun' }
  ],
  CAPA_FORM: [
    { key: 'VISUAL', limit: 'Uygunsuzluk dogrulama' },
    { key: 'CHEMICAL', limit: 'Gerekiyorsa analiz sonucu', required: false },
    { key: 'MICROBIOLOGICAL', limit: 'Gerekiyorsa mikrobiyoloji', required: false }
  ]
}

const FORM_NO_PREFIX = 'QF'
const FORM_NO_PADDING = 6
const SCORE_ROUNDING_FACTOR = 100

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round((parsed + Number.EPSILON) * 1000) / 1000
    : 0
}

const normalizeScore = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(Math.min(100, parsed) * SCORE_ROUNDING_FACTOR) / SCORE_ROUNDING_FACTOR
    : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultQualityFormFilters = (): QualityFormFilters => ({
  formType: ALL_FILTER,
  status: ALL_FILTER,
  result: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  date: '',
  search: ''
})

export const getNextQualityFormNo = (
  records: Pick<QualityForm, 'formNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${FORM_NO_PREFIX}-${year}-(\\d{${FORM_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.formNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${FORM_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(FORM_NO_PADDING, '0')}`
}

const createTemplateCriterion = (
  templateId: string,
  seed: CriterionSeed,
  index: number
): QualityFormTemplateCriterion => ({
  id: `${templateId}_criterion_${String(index + 1).padStart(2, '0')}`,
  templateId,
  criterionKey: seed.key,
  label: QUALITY_CRITERION_LABELS[seed.key],
  limit: seed.limit,
  required: seed.required !== false,
  displayOrder: index + 1
})

export const createDefaultQualityFormTemplates = (): QualityFormTemplate[] => {
  const now = '2026-07-28T08:00:00.000Z'

  return QUALITY_FORM_TYPES.map((formType, index) => {
    const templateId = `quality_form_template_${formType.toLocaleLowerCase('tr-TR')}`
    return {
      id: templateId,
      formType,
      name: QUALITY_FORM_TYPE_LABELS[formType],
      version: `v${index + 1}.0`,
      description: `${QUALITY_FORM_TYPE_LABELS[formType]} icin standart kalite kriterleri.`,
      isActive: true,
      criteria: DEFAULT_TEMPLATE_CRITERIA[formType].map((criterion, criterionIndex) => (
        createTemplateCriterion(templateId, criterion, criterionIndex)
      )),
      createdAt: now,
      updatedAt: now
    }
  })
}

const getTemplateForType = (
  formType: QualityFormType,
  templates: QualityFormTemplate[]
) => templates.find(template => template.formType === formType && template.isActive)
  || templates.find(template => template.formType === formType)
  || createDefaultQualityFormTemplates().find(template => template.formType === formType)
  || createDefaultQualityFormTemplates()[0]

const getBranchName = (
  branchId: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || '-'

const getStockItem = (
  stockItemId: string,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getProductName = (
  productId: string,
  stockItem: StockItem | null,
  sourceData: KpiSourceData
) => sourceData.productRefs.find(product => product.id === productId || product.stockItemId === stockItem?.id)?.name
  || stockItem?.name
  || productId
  || '-'

const getSupplierName = (
  supplierId: string,
  sourceData: KpiSourceData
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId || ''

const getRecipe = (
  productName: string,
  stockItemName: string,
  sourceData: KpiSourceData
): RecipeManagementRecord | null => {
  const productKey = normalizeSearchText(productName)
  const stockKey = normalizeSearchText(stockItemName)

  return sourceData.recipeRecords.find(recipe => (
    normalizeSearchText(recipe.productName) === productKey
    || normalizeSearchText(recipe.recipeName).includes(productKey)
    || recipe.ingredients.some(ingredient => normalizeSearchText(ingredient.materialName) === stockKey)
  )) || null
}

const getProductionOrderNo = (
  productionOrderId: string,
  sourceData: KpiSourceData
) => sourceData.productionOrders.find(order => order.id === productionOrderId)?.workOrderNo || productionOrderId || ''

const getHaccpReference = (
  lotId: string,
  productionOrderId: string,
  sourceData: KpiSourceData
) => {
  const plan = sourceData.haccpRecords.find(record => (
    record.monitoringRecords.some(item => item.inventoryLotId === lotId || item.productionOrderId === productionOrderId)
  ))
  if(!plan) return ''
  const monitoring = plan.monitoringRecords.find(item => item.inventoryLotId === lotId || item.productionOrderId === productionOrderId)
  return `${plan.name}${monitoring ? ` / ${monitoring.result}` : ''}`
}

const getSampleForLot = (
  lotId: string,
  sourceData: KpiSourceData
) => sourceData.qualitySamples.find(sample => sample.inventoryLotId === lotId) || null

const getWitnessForSample = (
  sampleId: string,
  sourceData: KpiSourceData
) => sourceData.witnessSamples.find(sample => sample.qualitySampleId === sampleId) || null

const mapCriterionStatus = (
  value: unknown,
  fallback: QualityCriterionStatus = 'PASS'
): QualityCriterionStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_CRITERION_STATUSES.includes(normalized as QualityCriterionStatus)
    ? normalized as QualityCriterionStatus
    : fallback
}

const mapInspectionResult = (
  value: unknown,
  fallback: QualityInspectionResult = 'PASS'
): QualityInspectionResult => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_INSPECTION_RESULTS.includes(normalized as QualityInspectionResult)
    ? normalized as QualityInspectionResult
    : fallback
}

const mapFormType = (
  value: unknown,
  fallback: QualityFormType = 'GOODS_RECEIPT_CONTROL'
): QualityFormType => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_FORM_TYPES.includes(normalized as QualityFormType)
    ? normalized as QualityFormType
    : fallback
}

const mapStatus = (
  value: unknown,
  fallback: QualityFormStatus = 'DRAFT'
): QualityFormStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_FORM_STATUSES.includes(normalized as QualityFormStatus)
    ? normalized as QualityFormStatus
    : fallback
}

const statusFromLegacyInspection = (
  status: unknown
): QualityCriterionStatus => {
  const normalized = normalizeText(status).toUpperCase()
  if(normalized === 'FAIL') return 'FAIL'
  if(normalized === 'WARNING' || normalized === 'CONDITIONAL') return 'WARNING'
  if(normalized === 'NOT_APPLICABLE') return 'NOT_APPLICABLE'
  return 'PASS'
}

const getDefaultCriterionStatus = (
  result: QualityInspectionResult
): QualityCriterionStatus => {
  if(result === 'FAIL') return 'FAIL'
  if(result === 'CONDITIONAL') return 'WARNING'
  return 'PASS'
}

const createInspections = (
  formId: string,
  template: QualityFormTemplate,
  result: QualityInspectionResult,
  overrides: Partial<Record<QualityCriterionKey, {
    status?: QualityCriterionStatus
    value?: string
    notes?: string
  }>> = {}
): QualityInspection[] => template.criteria
  .sort((first, second) => first.displayOrder - second.displayOrder)
  .map((criterion, index) => {
    const override = overrides[criterion.criterionKey] || {}
    const status = override.status || getDefaultCriterionStatus(result)
    return {
      id: `${formId}_inspection_${String(index + 1).padStart(2, '0')}`,
      formId,
      criterionKey: criterion.criterionKey,
      label: criterion.label,
      value: override.value || '',
      unit: criterion.limit,
      status,
      result: mapCriterionStatusToResult(status),
      notes: override.notes || ''
    }
  })

const createBaseForm = (
  source: {
    id: string
    formNo: string
    formType: QualityFormType
    status?: QualityFormStatus
    result: QualityInspectionResult
    lot: InventoryLot
    productId: string
    productName: string
    stockItem: StockItem | null
    supplierId: string
    warehouseId: string
    branchId: string
    productionOrderId: string
    productionOrderNo?: string
    goodsReceiptId?: string
    goodsReceiptNo?: string
    recipe?: RecipeManagementRecord | null
    inspectionDate: string
    inspector: string
    quantity?: number
    unit?: StockUnit
    description: string
    sourceType: QualityForm['sourceType']
    sourceId: string
    template: QualityFormTemplate
    inspections: QualityInspection[]
    sampleId?: string
    sampleNo?: string
    witnessSampleId?: string
    witnessNo?: string
    haccpReference?: string
    createdAt?: string
    updatedAt?: string
  },
  sourceData: KpiSourceData
): QualityForm => {
  const result = source.result
  const score = QualityDecisionService.calculateScore(source.inspections)
  const status = source.status || getQualityStatusFromResult(result)
  const decision = createQualityDecision(
    source.id,
    result,
    source.inspector,
    `${source.inspectionDate}T10:00:00.000Z`
  )
  const stockItemName = source.stockItem?.name || source.productName
  const supplierName = getSupplierName(source.supplierId, sourceData)
  const createdAt = source.createdAt || `${source.inspectionDate}T10:00:00.000Z`

  return {
    id: source.id,
    formNo: source.formNo,
    formType: source.formType,
    status,
    templateId: source.template.id,
    templateName: source.template.name,
    templateVersion: source.template.version,
    productId: source.productId,
    productName: source.productName,
    stockItemId: source.stockItem?.id || source.lot.stockItemId,
    stockItemName,
    lotId: source.lot.id,
    lotNo: source.lot.lotNo,
    batchNo: source.lot.lotNo,
    supplierId: source.supplierId,
    supplierName,
    warehouseId: source.warehouseId,
    warehouseName: getBranchName(source.warehouseId, sourceData),
    branchId: source.branchId,
    branchName: getBranchName(source.branchId, sourceData),
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo || getProductionOrderNo(source.productionOrderId, sourceData),
    goodsReceiptId: source.goodsReceiptId || source.lot.goodsReceiptId,
    goodsReceiptNo: source.goodsReceiptNo || '',
    recipeId: source.recipe?.id || '',
    recipeName: source.recipe?.recipeName || '',
    sampleId: source.sampleId || '',
    sampleNo: source.sampleNo || '',
    witnessSampleId: source.witnessSampleId || '',
    witnessNo: source.witnessNo || '',
    haccpReference: source.haccpReference || getHaccpReference(source.lot.id, source.productionOrderId, sourceData),
    inspectionDate: source.inspectionDate,
    inspector: source.inspector,
    quantity: source.quantity ?? source.lot.remainingQuantity,
    unit: source.unit || source.lot.unit,
    description: source.description,
    result,
    score,
    decision,
    inspections: source.inspections,
    history: [
      createQualityHistory(source.id, 'CREATED', source.inspector || 'System', `${source.formNo} read-model kalite formu olusturuldu.`)
    ],
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    revisionNo: 1,
    createdBy: source.inspector || 'System',
    createdAt,
    updatedAt: source.updatedAt || createdAt
  }
}

export const loadQualityFormTemplates = () => {
  const defaultTemplates = createDefaultQualityFormTemplates()
  if(!isBrowserStorageAvailable()) return defaultTemplates

  const storedTemplates = localStorage.getItem(QUALITY_FORM_TEMPLATE_STORAGE_KEY)
  if(!storedTemplates){
    localStorage.setItem(QUALITY_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(defaultTemplates))
    return defaultTemplates
  }

  try{
    const parsed = JSON.parse(storedTemplates)
    if(Array.isArray(parsed)){
      const templates = parsed
        .filter(isRecord)
        .map((template, index) => normalizeTemplate(template as RawQualityTemplate, index))
      const storedIds = new Set(templates.map(template => template.id))
      const nextTemplates = [
        ...templates,
        ...defaultTemplates.filter(template => !storedIds.has(template.id))
      ]
      localStorage.setItem(QUALITY_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates))
      return nextTemplates
    }
  } catch {
    localStorage.setItem(QUALITY_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(defaultTemplates))
  }

  return defaultTemplates
}

const normalizeTemplate = (
  template: RawQualityTemplate,
  index: number
): QualityFormTemplate => {
  const formType = mapFormType(template.formType, QUALITY_FORM_TYPES[index % QUALITY_FORM_TYPES.length])
  const templateId = normalizeText(template.id) || `quality_form_template_${formType.toLocaleLowerCase('tr-TR')}`
  const defaultTemplate = createDefaultQualityFormTemplates().find(item => item.formType === formType)

  return {
    id: templateId,
    formType,
    name: normalizeText(template.name) || QUALITY_FORM_TYPE_LABELS[formType],
    version: normalizeText(template.version) || defaultTemplate?.version || 'v1.0',
    description: normalizeText(template.description) || defaultTemplate?.description || '',
    isActive: typeof template.isActive === 'boolean' ? template.isActive : true,
    criteria: Array.isArray(template.criteria)
      ? template.criteria.filter(isRecord).map((criterion, criterionIndex) => {
        const criterionKey = normalizeText(criterion.criterionKey).toUpperCase() as QualityCriterionKey
        const fallback = defaultTemplate?.criteria[criterionIndex]
        const key = Object.keys(QUALITY_CRITERION_LABELS).includes(criterionKey) ? criterionKey : fallback?.criterionKey || 'VISUAL'
        return {
          id: normalizeText(criterion.id) || `${templateId}_criterion_${criterionIndex + 1}`,
          templateId,
          criterionKey: key,
          label: normalizeText(criterion.label) || QUALITY_CRITERION_LABELS[key],
          limit: normalizeText(criterion.limit) || fallback?.limit || '',
          required: typeof criterion.required === 'boolean' ? criterion.required : fallback?.required !== false,
          displayOrder: normalizeNonNegativeNumber(criterion.displayOrder) || criterionIndex + 1
        }
      })
      : defaultTemplate?.criteria || [],
    createdAt: normalizeText(template.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(template.updatedAt) || normalizeText(template.createdAt) || new Date().toISOString()
  }
}

export const createQualityFormReadModelRecords = (
  sourceData: KpiSourceData
): QualityForm[] => {
  const templates = loadQualityFormTemplates()
  const lotById = new Map(sourceData.inventoryLots.map(lot => [lot.id, lot]))
  const formsFromGoodsReceipt = sourceData.goodsReceipts.flatMap((receipt, receiptIndex) => (
    receipt.items.slice(0, 3).map((item, itemIndex) => {
      const lot = sourceData.inventoryLots.find(sourceLot => (
        sourceLot.id === item.lotId
        || sourceLot.lotNo === item.lotNo
        || (sourceLot.goodsReceiptId === receipt.id && sourceLot.stockItemId === item.stockItemId)
      ))
      if(!lot) return null

      const formType: QualityFormType = 'GOODS_RECEIPT_CONTROL'
      const template = getTemplateForType(formType, templates)
      const stockItem = getStockItem(item.stockItemId, sourceData)
      const productId = lot.productId || stockItem?.id || item.stockItemId
      const productName = item.productName || item.stockItemName || getProductName(productId, stockItem, sourceData)
      const result = receipt.inspection?.result || (item.rejectedQuantity > 0 ? 'FAIL' : 'PASS')
      const formId = `quality_form_goods_receipt_${receipt.id}_${item.id}`
      const inspectionOverrides = {
        TEMPERATURE: {
          status: receipt.inspection ? statusFromLegacyInspection(receipt.inspection.result === 'CONDITIONAL' ? 'WARNING' : receipt.inspection.result) : getDefaultCriterionStatus(result),
          value: receipt.inspection?.temperatureC ? `${receipt.inspection.temperatureC}` : '',
          notes: receipt.inspection?.haccpTemperatureRecord || ''
        },
        PACKAGING: { status: statusFromLegacyInspection(receipt.inspection?.packagingCheck) },
        LABEL: { status: statusFromLegacyInspection(receipt.inspection?.labelCheck) },
        VISUAL: { status: statusFromLegacyInspection(receipt.inspection?.visualCheck) },
        SMELL: { status: statusFromLegacyInspection(receipt.inspection?.hygieneCheck) }
      } satisfies Partial<Record<QualityCriterionKey, { status?: QualityCriterionStatus; value?: string; notes?: string }>>
      const inspections = createInspections(formId, template, result, inspectionOverrides)
      const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)

      return createBaseForm({
        id: formId,
        formNo: getNextQualityFormNo([], receipt.receiptDate, receiptIndex + itemIndex),
        formType,
        result,
        lot,
        productId,
        productName,
        stockItem,
        supplierId: receipt.supplierId || lot.supplierId,
        warehouseId: receipt.warehouseId || lot.warehouseId,
        branchId: receipt.warehouseId || lot.warehouseId,
        productionOrderId: lot.productionOrderId,
        productionOrderNo: getProductionOrderNo(lot.productionOrderId, sourceData),
        goodsReceiptId: receipt.id,
        goodsReceiptNo: receipt.receiptNo,
        recipe,
        inspectionDate: receipt.receiptDate,
        inspector: receipt.inspection?.checkedBy || receipt.receivedByName || receipt.receivedBy || 'Mal Kabul Kalite',
        quantity: item.receivedQuantity || item.acceptedQuantity || lot.remainingQuantity,
        unit: item.unit,
        description: receipt.inspection?.notes || receipt.notes || 'Mal kabul kalite formu read-model.',
        sourceType: 'GoodsReceipt',
        sourceId: receipt.id,
        template,
        inspections,
        haccpReference: receipt.inspection?.haccpTemperatureRecord || getHaccpReference(lot.id, lot.productionOrderId, sourceData),
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt
      }, sourceData)
    }).filter((form): form is QualityForm => Boolean(form))
  ))

  const formsFromHaccp = sourceData.haccpRecords.flatMap(plan => (
    plan.monitoringRecords.slice(0, 8).map((monitoring, index) => createFormFromMonitoring(plan.name, monitoring, index, templates, sourceData, lotById))
  )).filter((form): form is QualityForm => Boolean(form))

  const formsFromSamples = sourceData.qualitySamples.slice(0, 12).map((sample, index) => {
    const lot = lotById.get(sample.inventoryLotId)
    if(!lot) return null
    const formType: QualityFormType = sample.sampleType === 'RAW_MATERIAL' ? 'MICROBIOLOGICAL_CONTROL' : 'FINAL_PRODUCT_CONTROL'
    const template = getTemplateForType(formType, templates)
    const stockItem = getStockItem(lot.stockItemId, sourceData)
    const productId = lot.productId || stockItem?.id || lot.stockItemId
    const productName = getProductName(productId, stockItem, sourceData)
    const result: QualityInspectionResult = sample.status === 'DISCARDED' ? 'FAIL' : sample.status === 'UNDER_REVIEW' ? 'CONDITIONAL' : 'PASS'
    const formId = `quality_form_sample_${sample.id}`
    const inspections = createInspections(formId, template, result, {
      MICROBIOLOGICAL: { status: getDefaultCriterionStatus(result), value: sample.status, notes: sample.notes },
      VISUAL: { status: getDefaultCriterionStatus(result), value: sample.storageLocation }
    })
    const witness = getWitnessForSample(sample.id, sourceData)
    const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)

    return createBaseForm({
      id: formId,
      formNo: getNextQualityFormNo(formsFromGoodsReceipt, sample.sampleDate, index),
      formType,
      result,
      lot,
      productId,
      productName,
      stockItem,
      supplierId: lot.supplierId,
      warehouseId: lot.warehouseId,
      branchId: lot.warehouseId,
      productionOrderId: lot.productionOrderId,
      recipe,
      inspectionDate: sample.sampleDate,
      inspector: sample.takenBy,
      description: sample.notes || 'Sample Tracking kaynakli kalite formu.',
      sourceType: 'Sample',
      sourceId: sample.id,
      template,
      inspections,
      sampleId: sample.id,
      sampleNo: sample.sampleNo,
      witnessSampleId: witness?.id || '',
      witnessNo: witness?.witnessNo || '',
      createdAt: sample.createdAt,
      updatedAt: sample.updatedAt
    }, sourceData)
  }).filter((form): form is QualityForm => Boolean(form))

  const formsFromWaste = WasteService.list(sourceData)
    .filter(record => record.status !== 'CANCELLED' && (record.status === 'UNDER_REVIEW' || record.wasteType === 'QUALITY_REJECTION'))
    .slice(0, 10)
    .map((wasteRecord, index) => {
      const lot = lotById.get(wasteRecord.lotId)
      if(!lot) return null
      const formType: QualityFormType = 'CAPA_FORM'
      const template = getTemplateForType(formType, templates)
      const stockItem = getStockItem(wasteRecord.stockItemId, sourceData)
      const result: QualityInspectionResult = wasteRecord.status === 'UNDER_REVIEW' ? 'CONDITIONAL' : 'FAIL'
      const formId = `quality_form_waste_${wasteRecord.id}`
      const inspections = createInspections(formId, template, result, {
        VISUAL: { status: getDefaultCriterionStatus(result), value: wasteRecord.wasteReason, notes: wasteRecord.description },
        CHEMICAL: { status: 'NOT_APPLICABLE' },
        MICROBIOLOGICAL: { status: 'NOT_APPLICABLE' }
      })

      return createBaseForm({
        id: formId,
        formNo: getNextQualityFormNo([...formsFromGoodsReceipt, ...formsFromSamples], wasteRecord.date, index),
        formType,
        result,
        lot,
        productId: wasteRecord.productId || lot.productId || wasteRecord.stockItemId,
        productName: wasteRecord.productName || wasteRecord.stockItemName,
        stockItem,
        supplierId: wasteRecord.supplierId || lot.supplierId,
        warehouseId: wasteRecord.warehouseId || lot.warehouseId,
        branchId: wasteRecord.branchId || lot.warehouseId,
        productionOrderId: wasteRecord.productionOrderId || lot.productionOrderId,
        productionOrderNo: wasteRecord.productionOrderNo,
        goodsReceiptId: lot.goodsReceiptId,
        recipe: sourceData.recipeRecords.find(recipe => recipe.id === wasteRecord.recipeId) || null,
        inspectionDate: wasteRecord.date,
        inspector: wasteRecord.createdBy || 'Kalite',
        quantity: wasteRecord.quantity,
        unit: wasteRecord.unit,
        description: `Waste Management kaynakli CAPA formu: ${wasteRecord.description}`,
        sourceType: 'Waste',
        sourceId: wasteRecord.id,
        template,
        inspections,
        haccpReference: wasteRecord.haccpReference,
        createdAt: wasteRecord.createdAt,
        updatedAt: wasteRecord.updatedAt
      }, sourceData)
    }).filter((form): form is QualityForm => Boolean(form))

  const generatedForms = [
    ...formsFromGoodsReceipt,
    ...formsFromHaccp,
    ...formsFromSamples,
    ...formsFromWaste
  ]

  return generatedForms.map((form, index) => ({
    ...form,
    formNo: getNextQualityFormNo(generatedForms.slice(0, index), form.inspectionDate)
  }))
}

const createFormFromMonitoring = (
  planName: string,
  monitoring: MonitoringRecord,
  index: number,
  templates: QualityFormTemplate[],
  sourceData: KpiSourceData,
  lotById: Map<string, InventoryLot>
) => {
  const lot = lotById.get(monitoring.inventoryLotId)
  if(!lot) return null
  const formType: QualityFormType = 'PRODUCTION_CONTROL'
  const template = getTemplateForType(formType, templates)
  const stockItem = getStockItem(lot.stockItemId, sourceData)
  const productId = lot.productId || stockItem?.id || lot.stockItemId
  const productName = getProductName(productId, stockItem, sourceData)
  const result: QualityInspectionResult = monitoring.result === 'FAIL' ? 'FAIL' : 'PASS'
  const formId = `quality_form_haccp_${monitoring.id}`
  const inspections = createInspections(formId, template, result, {
    TEMPERATURE: {
      status: monitoring.result === 'FAIL' ? 'FAIL' : 'PASS',
      value: `${monitoring.measuredValue}`,
      notes: monitoring.criticalLimit
    },
    VISUAL: { status: monitoring.result === 'FAIL' ? 'WARNING' : 'PASS', notes: monitoring.notes },
    LABEL: { status: 'PASS' }
  })
  const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)

  return createBaseForm({
    id: formId,
    formNo: getNextQualityFormNo([], monitoring.checkedAt.slice(0, 10), index),
    formType,
    result,
    lot,
    productId,
    productName,
    stockItem,
    supplierId: lot.supplierId,
    warehouseId: lot.warehouseId,
    branchId: lot.warehouseId,
    productionOrderId: monitoring.productionOrderId || lot.productionOrderId,
    recipe,
    inspectionDate: monitoring.checkedAt.slice(0, 10),
    inspector: monitoring.checkedBy,
    description: monitoring.notes || 'HACCP monitoring kaynakli kalite formu.',
    sourceType: 'HACCP',
    sourceId: monitoring.id,
    template,
    inspections,
    sampleId: monitoring.qualitySampleId,
    sampleNo: sourceData.qualitySamples.find(sample => sample.id === monitoring.qualitySampleId)?.sampleNo || '',
    haccpReference: `${planName} / ${monitoring.result}`,
    createdAt: monitoring.checkedAt,
    updatedAt: monitoring.checkedAt
  }, sourceData)
}

const normalizeInspection = (
  inspection: RawQualityInspection,
  formId: string,
  index: number
): QualityInspection => {
  const criterionKey = normalizeText(inspection.criterionKey).toUpperCase() as QualityCriterionKey
  const key = Object.keys(QUALITY_CRITERION_LABELS).includes(criterionKey) ? criterionKey : 'VISUAL'
  const status = mapCriterionStatus(inspection.status)

  return {
    id: normalizeText(inspection.id) || `${formId}_inspection_${index + 1}`,
    formId,
    criterionKey: key,
    label: normalizeText(inspection.label) || QUALITY_CRITERION_LABELS[key],
    value: normalizeText(inspection.value),
    unit: normalizeText(inspection.unit),
    status,
    result: mapInspectionResult(inspection.result, mapCriterionStatusToResult(status)),
    notes: normalizeText(inspection.notes)
  }
}

const normalizeHistory = (
  value: unknown,
  formId: string,
  actorName: string
): QualityHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [createQualityHistory(formId, 'CREATED', actorName, 'Quality Form read-model kaydi olusturuldu.')]
  }

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${formId}_history_${index + 1}`,
    formId,
    action: normalizeText(history.action).toUpperCase() as QualityHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    revisionNo: normalizeNonNegativeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeDecision = (
  value: unknown,
  formId: string,
  result: QualityInspectionResult,
  actorName: string,
  dateValue: string
): QualityDecision => {
  if(!isRecord(value)) return createQualityDecision(formId, result, actorName, dateValue)
  const decision = value as RawQualityDecision

  return {
    id: normalizeText(decision.id) || `${formId}_decision`,
    formId,
    result: mapInspectionResult(decision.result, result),
    decisionType: normalizeText(decision.decisionType) as QualityDecision['decisionType'] || QualityDecisionService.getDecisionType(result),
    summary: normalizeText(decision.summary),
    decidedBy: normalizeText(decision.decidedBy) || actorName,
    decidedAt: normalizeText(decision.decidedAt) || dateValue
  }
}

const normalizeQualityForm = (
  record: RawQualityForm,
  index: number,
  sourceData: KpiSourceData
): QualityForm => {
  const now = new Date().toISOString()
  const formType = mapFormType(record.formType)
  const status = mapStatus(record.status)
  const result = mapInspectionResult(record.result)
  const formId = normalizeText(record.id) || `quality_form_${Date.now()}_${index}`
  const inspector = normalizeText(record.inspector) || 'Kalite'
  const inspectionDate = normalizeText(record.inspectionDate) || getTodayKey()
  const lot = sourceData.inventoryLots.find(item => item.id === normalizeText(record.lotId)) || null
  const stockItem = getStockItem(normalizeText(record.stockItemId) || lot?.stockItemId || '', sourceData)
  const templates = loadQualityFormTemplates()
  const template = templates.find(item => item.id === normalizeText(record.templateId)) || getTemplateForType(formType, templates)
  const inspections = Array.isArray(record.inspections) && record.inspections.length > 0
    ? record.inspections.filter(isRecord).map((inspection, inspectionIndex) => normalizeInspection(inspection as RawQualityInspection, formId, inspectionIndex))
    : createInspections(formId, template, result)
  const score = normalizeScore(record.score) || QualityDecisionService.calculateScore(inspections)
  const productId = normalizeText(record.productId) || lot?.productId || stockItem?.id || ''
  const productName = normalizeText(record.productName) || getProductName(productId, stockItem, sourceData)
  const createdAt = normalizeText(record.createdAt) || now

  return {
    id: formId,
    formNo: normalizeText(record.formNo) || getNextQualityFormNo([], inspectionDate, index),
    formType,
    status,
    templateId: template.id,
    templateName: normalizeText(record.templateName) || template.name,
    templateVersion: normalizeText(record.templateVersion) || template.version,
    productId,
    productName,
    stockItemId: normalizeText(record.stockItemId) || lot?.stockItemId || stockItem?.id || '',
    stockItemName: normalizeText(record.stockItemName) || stockItem?.name || productName,
    lotId: lot?.id || normalizeText(record.lotId),
    lotNo: normalizeText(record.lotNo) || lot?.lotNo || '',
    batchNo: normalizeText(record.batchNo) || lot?.lotNo || '',
    supplierId: normalizeText(record.supplierId) || lot?.supplierId || '',
    supplierName: normalizeText(record.supplierName) || getSupplierName(normalizeText(record.supplierId) || lot?.supplierId || '', sourceData),
    warehouseId: normalizeText(record.warehouseId) || lot?.warehouseId || '',
    warehouseName: normalizeText(record.warehouseName) || getBranchName(normalizeText(record.warehouseId) || lot?.warehouseId || '', sourceData),
    branchId: normalizeText(record.branchId) || lot?.warehouseId || '',
    branchName: normalizeText(record.branchName) || getBranchName(normalizeText(record.branchId) || lot?.warehouseId || '', sourceData),
    productionOrderId: normalizeText(record.productionOrderId) || lot?.productionOrderId || '',
    productionOrderNo: normalizeText(record.productionOrderNo) || getProductionOrderNo(normalizeText(record.productionOrderId) || lot?.productionOrderId || '', sourceData),
    goodsReceiptId: normalizeText(record.goodsReceiptId) || lot?.goodsReceiptId || '',
    goodsReceiptNo: normalizeText(record.goodsReceiptNo),
    recipeId: normalizeText(record.recipeId),
    recipeName: normalizeText(record.recipeName),
    sampleId: normalizeText(record.sampleId),
    sampleNo: normalizeText(record.sampleNo),
    witnessSampleId: normalizeText(record.witnessSampleId),
    witnessNo: normalizeText(record.witnessNo),
    haccpReference: normalizeText(record.haccpReference),
    inspectionDate,
    inspector,
    quantity: normalizeNonNegativeNumber(record.quantity),
    unit: normalizeText(record.unit) as StockUnit || lot?.unit || 'adet',
    description: normalizeText(record.description),
    result,
    score,
    decision: normalizeDecision(record.decision, formId, result, inspector, createdAt),
    inspections,
    history: normalizeHistory(record.history, formId, inspector),
    sourceType: normalizeText(record.sourceType) as QualityForm['sourceType'] || 'ManualReadModel',
    sourceId: normalizeText(record.sourceId),
    revisionNo: normalizeNonNegativeNumber(record.revisionNo) || 1,
    createdBy: normalizeText(record.createdBy) || inspector,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }
}

export const saveQualityForms = (
  records: QualityForm[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QUALITY_FORM_STORAGE_KEY, JSON.stringify(records))
}

export const loadQualityForms = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createQualityFormReadModelRecords(sourceData)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(QUALITY_FORM_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveQualityForms(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeQualityForm(record as RawQualityForm, index, sourceData))
      const storedIds = new Set(normalizedRecords.map(record => record.id))
      const nextRecords = [
        ...normalizedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ]

      saveQualityForms(nextRecords)
      return nextRecords
    }
  } catch {
    if(seedRecords.length > 0) saveQualityForms(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveQualityForms(seedRecords)
  return seedRecords
}

export const filterQualityForms = (
  forms: QualityForm[],
  filters: QualityFormFilters
) => forms.filter(form => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    form.formNo,
    form.productName,
    form.stockItemName,
    form.lotNo,
    form.batchNo,
    form.supplierName,
    form.goodsReceiptNo,
    form.productionOrderNo,
    form.description
  ].join(' ')

  return (
    (filters.formType === ALL_FILTER || form.formType === filters.formType)
    && (filters.status === ALL_FILTER || form.status === filters.status)
    && (filters.result === ALL_FILTER || form.result === filters.result)
    && (filters.productId === ALL_FILTER || form.productId === filters.productId || form.stockItemId === filters.productId)
    && (filters.lotId === ALL_FILTER || form.lotId === filters.lotId)
    && (filters.supplierId === ALL_FILTER || form.supplierId === filters.supplierId)
    && (filters.branchId === ALL_FILTER || form.branchId === filters.branchId)
    && (filters.warehouseId === ALL_FILTER || form.warehouseId === filters.warehouseId)
    && (!filters.date || form.inspectionDate === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

export const addQualityFormFromLot = (
  input: QualityFormCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadQualityForms(sourceData)
  const templates = loadQualityFormTemplates()
  const lot = sourceData.inventoryLots.find(item => item.id === input.lotId)
  if(!lot) throw new Error('Lot kaydi bulunamadi.')
  const formType = input.formType
  const template = getTemplateForType(formType, templates)
  const stockItem = getStockItem(lot.stockItemId, sourceData)
  const productId = lot.productId || stockItem?.id || lot.stockItemId
  const productName = getProductName(productId, stockItem, sourceData)
  const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)
  const sample = getSampleForLot(lot.id, sourceData)
  const witness = sample ? getWitnessForSample(sample.id, sourceData) : null
  const formId = createId('quality_form_manual')
  const inspectionDate = input.inspectionDate || getTodayKey()
  const inspections = createInspections(
    formId,
    template,
    input.result,
    Object.fromEntries(template.criteria.map(criterion => [
      criterion.criterionKey,
      {
        status: input.inspectionStatuses[criterion.criterionKey] || getDefaultCriterionStatus(input.result),
        notes: input.inspectionNotes[criterion.criterionKey] || ''
      }
    ])) as Partial<Record<QualityCriterionKey, { status?: QualityCriterionStatus; notes?: string }>>
  )
  const result = QualityDecisionService.getOverallResult(inspections, input.result)
  const form = createBaseForm({
    id: formId,
    formNo: getNextQualityFormNo(records, inspectionDate),
    formType,
    status: 'DRAFT',
    result,
    lot,
    productId,
    productName,
    stockItem,
    supplierId: lot.supplierId,
    warehouseId: lot.warehouseId,
    branchId: lot.warehouseId,
    productionOrderId: lot.productionOrderId,
    recipe,
    inspectionDate,
    inspector: input.inspector || actorName,
    description: input.description || 'Manuel read-model kalite formu.',
    sourceType: 'ManualReadModel',
    sourceId: lot.id,
    template,
    inspections,
    sampleId: sample?.id,
    sampleNo: sample?.sampleNo,
    witnessSampleId: witness?.id,
    witnessNo: witness?.witnessNo
  }, sourceData)
  const validation = validateQualityForm(form, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveQualityForms([form, ...records])
  return form
}

const upsertForm = (
  forms: QualityForm[],
  form: QualityForm
) => forms.some(record => record.id === form.id)
  ? forms.map(record => record.id === form.id ? form : record)
  : [form, ...forms]

export const updateQualityFormStatus = (
  formId: string,
  status: QualityFormStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadQualityForms(sourceData)
  const form = records.find(record => record.id === formId)
  if(!form) throw new Error('Kalite formu bulunamadi.')
  if(form.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('Iptal edilmis kalite formu tekrar acilamaz.')
  if(form.status === status) return form

  const actionByStatus: Record<QualityFormStatus, QualityHistoryAction> = {
    DRAFT: 'UPDATED',
    INSPECTING: 'INSPECTION_STARTED',
    APPROVED: 'APPROVED',
    CONDITIONAL_APPROVED: 'CONDITIONAL_APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
  }
  const nextResult = status === 'APPROVED'
    ? 'PASS'
    : status === 'CONDITIONAL_APPROVED'
      ? 'CONDITIONAL'
      : status === 'REJECTED'
        ? 'FAIL'
        : form.result
  const nextFormBase = {
    ...form,
    status,
    result: nextResult,
    decision: createQualityDecision(form.id, nextResult, actorName, new Date().toISOString())
  }
  const nextForm = appendQualityHistory(
    nextFormBase,
    actionByStatus[status],
    actorName,
    `${form.formNo} ${QUALITY_FORM_STATUS_LABELS[status]} durumuna alindi.`
  )
  const validation = validateQualityForm(nextForm, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveQualityForms(upsertForm(records, nextForm))
  return nextForm
}

export const recordQualityFormOutput = (
  formId: string,
  action: Extract<QualityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadQualityForms(sourceData)
  const form = records.find(record => record.id === formId)
  if(!form) throw new Error('Kalite formu bulunamadi.')
  const nextForm = appendQualityHistory(
    form,
    action,
    actorName,
    action === 'EXCEL' ? `${form.formNo} Excel export edildi.` : `${form.formNo} cikti penceresi acildi.`
  )
  saveQualityForms(upsertForm(records, nextForm))
  return nextForm
}

export const QualityFormService = {
  createDefaultFilters: createDefaultQualityFormFilters,
  getNextNo: getNextQualityFormNo,
  list: loadQualityForms,
  save: saveQualityForms,
  filter: filterQualityForms,
  templates: loadQualityFormTemplates,
  createReadModelRecords: createQualityFormReadModelRecords,
  addFromLot: addQualityFormFromLot,
  updateStatus: updateQualityFormStatus,
  recordOutput: recordQualityFormOutput,
  statistics: createQualityFormStatistics,
  validate: validateQualityForm
}
