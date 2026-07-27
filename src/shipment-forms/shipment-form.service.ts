import { DeliveryNoteService, DELIVERY_NOTE_STATUS_LABELS } from '../delivery-notes/delivery-note.service'
import type { DeliveryNote, DeliveryNoteItem } from '../delivery-notes/delivery-note.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { LabelService } from '../label-management/label.service'
import type { Label } from '../label-management/label.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentReturnRecord } from '../shipment-returns/shipment-return.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { StockItem, StockUnit } from '../types'
import {
  SHIPMENT_CHECKLIST_LABELS,
  ShipmentChecklistService,
  createShipmentChecklist,
  createShipmentTemperatureLogs
} from './shipment-checklist.service'
import { appendShipmentHistory, createShipmentHistory } from './shipment-form-history.service'
import { createShipmentFormStatistics } from './shipment-form-statistics.service'
import { validateShipmentForm } from './shipment-form-validation.service'
import type {
  ShipmentChecklist,
  ShipmentChecklistKey,
  ShipmentChecklistStatus,
  ShipmentForm,
  ShipmentFormCreateInput,
  ShipmentFormFilters,
  ShipmentFormItem,
  ShipmentFormStatus,
  ShipmentFormTemplate,
  ShipmentFormTemplateChecklist,
  ShipmentFormType,
  ShipmentHistory,
  ShipmentHistoryAction,
  ShipmentTemperatureLog
} from './shipment-form.types'

export const SHIPMENT_FORM_STORAGE_KEY = 'ra_shipment_forms_records'
export const SHIPMENT_FORM_TEMPLATE_STORAGE_KEY = 'ra_shipment_forms_templates'

export const SHIPMENT_FORM_TYPES: ShipmentFormType[] = [
  'VEHICLE_CONTROL',
  'LOADING_CONTROL',
  'COLD_CHAIN',
  'VEHICLE_TEMPERATURE',
  'DELIVERY',
  'DRIVER_HANDOVER',
  'SHIPMENT_APPROVAL',
  'RETURN_DELIVERY'
]

export const SHIPMENT_FORM_TYPE_LABELS: Record<ShipmentFormType, string> = {
  VEHICLE_CONTROL: 'Arac Kontrol Formu',
  LOADING_CONTROL: 'Yukleme Kontrol Formu',
  COLD_CHAIN: 'Soguk Zincir Formu',
  VEHICLE_TEMPERATURE: 'Arac Sicaklik Formu',
  DELIVERY: 'Teslim Formu',
  DRIVER_HANDOVER: 'Sofor Teslim Formu',
  SHIPMENT_APPROVAL: 'Sevkiyat Onay Formu',
  RETURN_DELIVERY: 'Iade Teslim Formu'
}

export const SHIPMENT_FORM_STATUSES: ShipmentFormStatus[] = [
  'DRAFT',
  'PREPARING',
  'LOADING',
  'ON_ROUTE',
  'DELIVERED',
  'RETURNED',
  'CANCELLED'
]

export const SHIPMENT_FORM_STATUS_LABELS: Record<ShipmentFormStatus, string> = {
  DRAFT: 'Taslak',
  PREPARING: 'Hazirlaniyor',
  LOADING: 'Yukleniyor',
  ON_ROUTE: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  RETURNED: 'Iade',
  CANCELLED: 'Iptal'
}

export const SHIPMENT_CHECKLIST_STATUSES: ShipmentChecklistStatus[] = [
  'PASS',
  'WARNING',
  'FAIL',
  'NOT_APPLICABLE'
]

export const SHIPMENT_CHECKLIST_STATUS_LABELS: Record<ShipmentChecklistStatus, string> = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'N/A'
}

type ChecklistSeed = {
  key: ShipmentChecklistKey
  description: string
  required?: boolean
}

type RawShipmentForm = Partial<Record<keyof ShipmentForm, unknown>> & Record<string, unknown>
type RawShipmentChecklist = Partial<Record<keyof ShipmentChecklist, unknown>> & Record<string, unknown>
type RawShipmentHistory = Partial<Record<keyof ShipmentHistory, unknown>> & Record<string, unknown>
type RawShipmentTemperatureLog = Partial<Record<keyof ShipmentTemperatureLog, unknown>> & Record<string, unknown>
type RawShipmentFormItem = Partial<Record<keyof ShipmentFormItem, unknown>> & Record<string, unknown>
type RawShipmentFormTemplate = Partial<Record<keyof ShipmentFormTemplate, unknown>> & Record<string, unknown>

const FORM_NO_PREFIX = 'SF'
const FORM_NO_PADDING = 6

const TEMPLATE_CHECKLIST: Record<ShipmentFormType, ChecklistSeed[]> = {
  VEHICLE_CONTROL: [
    { key: 'VEHICLE_CLEANING', description: 'Arac kasasi temiz ve hijyenik.' },
    { key: 'VEHICLE_DOCUMENTS', description: 'Arac evraklari ve operasyon kayitlari uygun.' },
    { key: 'FUEL_CHECK', description: 'Yakit seviyesi operasyon icin yeterli.' },
    { key: 'COOLING_SYSTEM', description: 'Sogutucu sistem calisir durumda.' },
    { key: 'DOOR_LOCK', description: 'Kapilar ve kilit sistemi uygun.' }
  ],
  LOADING_CONTROL: [
    { key: 'PRODUCT_PLACEMENT', description: 'Urunler rota ve agirlik dengesine uygun yerlestirildi.' },
    { key: 'PALLET_FIXING', description: 'Paletler sabitlendi.' },
    { key: 'LABEL_VERIFICATION', description: 'Etiketler sevkiyat formuyla eslesti.' },
    { key: 'LOT_VERIFICATION', description: 'Lotlar dogrulandi.' },
    { key: 'DELIVERY_NOTE_VERIFICATION', description: 'Irsaliye kalemleri kontrol edildi.' }
  ],
  COLD_CHAIN: [
    { key: 'COOLING_SYSTEM', description: 'Soguk zincir sistemi aktif.' },
    { key: 'PRODUCT_PLACEMENT', description: 'Urunler sicaklik akisini bozmayacak sekilde yerlestirildi.' },
    { key: 'DOOR_LOCK', description: 'Kapi kapama ve izolasyon kontrol edildi.' },
    { key: 'LABEL_VERIFICATION', description: 'Soguk zincir etiketleri dogrulandi.' }
  ],
  VEHICLE_TEMPERATURE: [
    { key: 'COOLING_SYSTEM', description: 'Arac sicakligi izleme icin hazir.' },
    { key: 'DOOR_LOCK', description: 'Kapi acik kalma riski kontrol edildi.' },
    { key: 'VEHICLE_DOCUMENTS', description: 'Sicaklik formu ve cihaz kaydi kontrol edildi.' }
  ],
  DELIVERY: [
    { key: 'DELIVERY_NOTE_VERIFICATION', description: 'Irsaliye teslimde dogrulandi.' },
    { key: 'LABEL_VERIFICATION', description: 'Etiketler teslim kalemleriyle eslesti.' },
    { key: 'LOT_VERIFICATION', description: 'Lot teslim teyidi alindi.' },
    { key: 'DELIVERY_SIGNATURE', description: 'Teslim imzasi alani hazir.', required: false }
  ],
  DRIVER_HANDOVER: [
    { key: 'VEHICLE_DOCUMENTS', description: 'Sofor evrak ve teslim formunu aldi.' },
    { key: 'DELIVERY_NOTE_VERIFICATION', description: 'Irsaliye sofore teslim edildi.' },
    { key: 'DOOR_LOCK', description: 'Kapilar cikis oncesi kontrol edildi.' }
  ],
  SHIPMENT_APPROVAL: [
    { key: 'VEHICLE_CLEANING', description: 'Arac kalite onayi uygun.' },
    { key: 'COOLING_SYSTEM', description: 'Sogutucu sistem onayi uygun.' },
    { key: 'LABEL_VERIFICATION', description: 'Etiket onayi uygun.' },
    { key: 'DELIVERY_NOTE_VERIFICATION', description: 'Irsaliye onayi uygun.' }
  ],
  RETURN_DELIVERY: [
    { key: 'DELIVERY_NOTE_VERIFICATION', description: 'Iade teslim kaydi dogrulandi.' },
    { key: 'LOT_VERIFICATION', description: 'Iade lotlari dogrulandi.' },
    { key: 'PRODUCT_PLACEMENT', description: 'Iade urunleri ayrildi.' },
    { key: 'DELIVERY_SIGNATURE', description: 'Iade teslim teyidi alindi.', required: false }
  ]
}

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
  return Number.isFinite(parsed) && parsed >= 0 ? roundKpi(parsed) : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultShipmentFormFilters = (): ShipmentFormFilters => ({
  status: ALL_FILTER,
  formType: ALL_FILTER,
  vehicleId: ALL_FILTER,
  driverName: ALL_FILTER,
  branchId: ALL_FILTER,
  customerId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  date: '',
  search: ''
})

export const getNextShipmentFormNo = (
  records: Pick<ShipmentForm, 'formNo'>[],
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

const createTemplateChecklist = (
  templateId: string,
  seed: ChecklistSeed,
  index: number
): ShipmentFormTemplateChecklist => ({
  id: `${templateId}_checklist_${String(index + 1).padStart(2, '0')}`,
  templateId,
  checklistKey: seed.key,
  label: SHIPMENT_CHECKLIST_LABELS[seed.key],
  description: seed.description,
  required: seed.required !== false,
  displayOrder: index + 1
})

export const createDefaultShipmentFormTemplates = (): ShipmentFormTemplate[] => {
  const now = '2026-07-28T08:00:00.000Z'

  return SHIPMENT_FORM_TYPES.map((formType, index) => {
    const templateId = `shipment_form_template_${formType.toLocaleLowerCase('tr-TR')}`
    return {
      id: templateId,
      formType,
      name: SHIPMENT_FORM_TYPE_LABELS[formType],
      version: `v${index + 1}.0`,
      description: `${SHIPMENT_FORM_TYPE_LABELS[formType]} icin standart operasyon checklist seti.`,
      isActive: true,
      checklist: TEMPLATE_CHECKLIST[formType].map((item, itemIndex) => createTemplateChecklist(templateId, item, itemIndex)),
      createdAt: now,
      updatedAt: now
    }
  })
}

const mapFormType = (
  value: unknown,
  fallback: ShipmentFormType = 'LOADING_CONTROL'
): ShipmentFormType => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_FORM_TYPES.includes(normalized as ShipmentFormType) ? normalized as ShipmentFormType : fallback
}

const mapFormStatus = (
  value: unknown,
  fallback: ShipmentFormStatus = 'DRAFT'
): ShipmentFormStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_FORM_STATUSES.includes(normalized as ShipmentFormStatus) ? normalized as ShipmentFormStatus : fallback
}

const mapChecklistStatus = (
  value: unknown,
  fallback: ShipmentChecklistStatus = 'PASS'
): ShipmentChecklistStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_CHECKLIST_STATUSES.includes(normalized as ShipmentChecklistStatus) ? normalized as ShipmentChecklistStatus : fallback
}

const getTemplateForType = (
  formType: ShipmentFormType,
  templates: ShipmentFormTemplate[]
) => templates.find(template => template.formType === formType && template.isActive)
  || templates.find(template => template.formType === formType)
  || createDefaultShipmentFormTemplates().find(template => template.formType === formType)
  || createDefaultShipmentFormTemplates()[0]

const normalizeTemplate = (
  template: RawShipmentFormTemplate,
  index: number
): ShipmentFormTemplate => {
  const formType = mapFormType(template.formType, SHIPMENT_FORM_TYPES[index % SHIPMENT_FORM_TYPES.length])
  const templateId = normalizeText(template.id) || `shipment_form_template_${formType.toLocaleLowerCase('tr-TR')}`
  const defaultTemplate = createDefaultShipmentFormTemplates().find(item => item.formType === formType)

  return {
    id: templateId,
    formType,
    name: normalizeText(template.name) || SHIPMENT_FORM_TYPE_LABELS[formType],
    version: normalizeText(template.version) || defaultTemplate?.version || 'v1.0',
    description: normalizeText(template.description) || defaultTemplate?.description || '',
    isActive: typeof template.isActive === 'boolean' ? template.isActive : true,
    checklist: Array.isArray(template.checklist)
      ? template.checklist.filter(isRecord).map((item, itemIndex) => {
        const key = normalizeText(item.checklistKey).toUpperCase() as ShipmentChecklistKey
        const fallback = defaultTemplate?.checklist[itemIndex]
        const checklistKey = Object.keys(SHIPMENT_CHECKLIST_LABELS).includes(key) ? key : fallback?.checklistKey || 'VEHICLE_CLEANING'
        return {
          id: normalizeText(item.id) || `${templateId}_checklist_${itemIndex + 1}`,
          templateId,
          checklistKey,
          label: normalizeText(item.label) || SHIPMENT_CHECKLIST_LABELS[checklistKey],
          description: normalizeText(item.description) || fallback?.description || '',
          required: typeof item.required === 'boolean' ? item.required : fallback?.required !== false,
          displayOrder: normalizeNonNegativeNumber(item.displayOrder) || itemIndex + 1
        }
      })
      : defaultTemplate?.checklist || [],
    createdAt: normalizeText(template.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(template.updatedAt) || normalizeText(template.createdAt) || new Date().toISOString()
  }
}

export const loadShipmentFormTemplates = () => {
  const defaultTemplates = createDefaultShipmentFormTemplates()
  if(!isBrowserStorageAvailable()) return defaultTemplates

  const storedTemplates = localStorage.getItem(SHIPMENT_FORM_TEMPLATE_STORAGE_KEY)
  if(!storedTemplates){
    localStorage.setItem(SHIPMENT_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(defaultTemplates))
    return defaultTemplates
  }

  try{
    const parsed = JSON.parse(storedTemplates)
    if(Array.isArray(parsed)){
      const templates = parsed.filter(isRecord).map((template, index) => normalizeTemplate(template as RawShipmentFormTemplate, index))
      const storedIds = new Set(templates.map(template => template.id))
      const nextTemplates = [
        ...templates,
        ...defaultTemplates.filter(template => !storedIds.has(template.id))
      ]
      localStorage.setItem(SHIPMENT_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates))
      return nextTemplates
    }
  } catch {
    localStorage.setItem(SHIPMENT_FORM_TEMPLATE_STORAGE_KEY, JSON.stringify(defaultTemplates))
  }

  return defaultTemplates
}

const getStockItem = (
  stockItemId: string,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getProductName = (
  item: DeliveryNoteItem,
  stockItem: StockItem | null
) => item.productName || item.stockItemName || stockItem?.name || item.productId || item.stockItemId || '-'

const getLabel = (
  item: DeliveryNoteItem,
  labels: Label[]
) => labels.find(label => (
  label.lotId === item.lotId
  || label.lotNo === item.lotNo
  || label.palletId === item.palletId
  || label.shipmentId === item.shipmentId
)) || null

const createFormItems = (
  formId: string,
  items: DeliveryNoteItem[],
  labels: Label[],
  sourceData: KpiSourceData
): ShipmentFormItem[] => items.map((item, index) => {
  const stockItem = getStockItem(item.stockItemId, sourceData)
  const label = getLabel(item, labels)

  return {
    id: `${formId}_item_${String(index + 1).padStart(2, '0')}`,
    formId,
    productId: item.productId || item.stockItemId,
    productName: getProductName(item, stockItem),
    stockItemId: item.stockItemId,
    stockItemName: item.stockItemName || stockItem?.name || getProductName(item, stockItem),
    lotId: item.lotId,
    lotNo: item.lotNo,
    batchNo: item.lotNo,
    labelId: label?.id || '',
    labelNo: label?.labelNo || '',
    quantity: item.quantity,
    unit: item.unit,
    boxCount: item.boxCount,
    palletCount: item.palletCount
  }
})

const mapDeliveryNoteStatusToFormStatus = (
  deliveryNote: DeliveryNote
): ShipmentFormStatus => {
  if(deliveryNote.status === 'CANCELLED') return 'CANCELLED'
  if(deliveryNote.status === 'DELIVERED') return 'DELIVERED'
  if(deliveryNote.status === 'LOADED') return 'LOADING'
  if(deliveryNote.status === 'PRINTED') return 'ON_ROUTE'
  if(deliveryNote.status === 'READY') return 'PREPARING'
  return 'DRAFT'
}

const getFormTypeFromDeliveryNote = (
  deliveryNote: DeliveryNote
): ShipmentFormType => {
  if(deliveryNote.status === 'DELIVERED') return 'DELIVERY'
  if(deliveryNote.status === 'LOADED') return 'LOADING_CONTROL'
  if(deliveryNote.status === 'PRINTED') return 'DRIVER_HANDOVER'
  if(deliveryNote.status === 'READY') return 'SHIPMENT_APPROVAL'
  return 'VEHICLE_CONTROL'
}

const getVehicle = (
  vehicleId: string,
  sourceData: KpiSourceData
) => sourceData.shipmentVehicles.find(vehicle => vehicle.id === vehicleId) || null

const getShipment = (
  shipmentId: string,
  sourceData: KpiSourceData
) => sourceData.shipments.find(shipment => shipment.id === shipmentId) || null

const getPlan = (
  shipmentPlanId: string,
  sourceData: KpiSourceData
) => sourceData.shipmentPlans.find(plan => plan.id === shipmentPlanId) || null

const createFormFromDeliveryNote = (
  deliveryNote: DeliveryNote,
  index: number,
  templates: ShipmentFormTemplate[],
  labels: Label[],
  sourceData: KpiSourceData,
  override?: Partial<Pick<ShipmentForm, 'formType' | 'loadingDate' | 'deliveryDate' | 'description' | 'status' | 'createdBy'>>
): ShipmentForm => {
  const formType = override?.formType || getFormTypeFromDeliveryNote(deliveryNote)
  const template = getTemplateForType(formType, templates)
  const formId = override ? createId('shipment_form_manual') : `shipment_form_delivery_note_${deliveryNote.id}`
  const vehicle = getVehicle(deliveryNote.vehicleId, sourceData)
  const plan = getPlan(deliveryNote.shipmentPlanId, sourceData)
  const shipment = getShipment(deliveryNote.shipmentId, sourceData)
  const loadingDate = override?.loadingDate || deliveryNote.date || shipment?.shipmentDate || plan?.planDate || getTodayKey()
  const deliveryDate = override?.deliveryDate || (deliveryNote.status === 'DELIVERED' ? deliveryNote.updatedAt.slice(0, 10) : shipment?.plannedDeliveryDate || '')
  const items = createFormItems(formId, deliveryNote.items, labels, sourceData)
  const refrigerated = vehicle?.vehicleType === 'REFRIGERATED' || formType === 'COLD_CHAIN' || formType === 'VEHICLE_TEMPERATURE'
  const checklist = createShipmentChecklist(formId, template, deliveryNote.status === 'CANCELLED' ? 'NOT_APPLICABLE' : 'PASS')
  const temperatureLogs = createShipmentTemperatureLogs(formId, loadingDate, index, refrigerated)
  const createdBy = override?.createdBy || deliveryNote.createdBy || 'Sevkiyat'

  return {
    id: formId,
    formNo: getNextShipmentFormNo([], loadingDate, index),
    formType,
    status: override?.status || mapDeliveryNoteStatusToFormStatus(deliveryNote),
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    shipmentId: deliveryNote.shipmentId,
    shipmentNo: deliveryNote.shipmentNo,
    deliveryNoteId: deliveryNote.id,
    deliveryNoteNo: deliveryNote.deliveryNoteNo,
    shipmentPlanId: deliveryNote.shipmentPlanId,
    shipmentPlanNo: deliveryNote.shipmentPlanNo,
    vehicleId: deliveryNote.vehicleId,
    vehicleNo: deliveryNote.vehicleNo || vehicle?.vehicleNo || '',
    vehiclePlate: deliveryNote.vehiclePlate || vehicle?.plateNumber || '',
    driverName: deliveryNote.driverName || vehicle?.driverName || plan?.driverName || '',
    warehouseId: deliveryNote.warehouseId,
    warehouseName: deliveryNote.warehouseName,
    branchId: deliveryNote.branchId,
    branchName: deliveryNote.branchName,
    customerId: deliveryNote.customerId,
    customerName: deliveryNote.customerName,
    loadingDate,
    deliveryDate,
    description: override?.description || deliveryNote.description || `${DELIVERY_NOTE_STATUS_LABELS[deliveryNote.status]} irsaliye kaynakli sevkiyat formu.`,
    items,
    checklist,
    temperatureLogs,
    history: [
      createShipmentHistory(formId, 'CREATED', createdBy, `${deliveryNote.deliveryNoteNo} kaynakli sevkiyat formu olusturuldu.`)
    ],
    sourceType: 'DeliveryNote',
    sourceId: deliveryNote.id,
    createdBy,
    createdAt: deliveryNote.createdAt,
    updatedAt: deliveryNote.updatedAt
  }
}

const createFormFromReturn = (
  returnRecord: ShipmentReturnRecord,
  index: number,
  deliveryNotes: DeliveryNote[],
  templates: ShipmentFormTemplate[],
  labels: Label[],
  sourceData: KpiSourceData
): ShipmentForm | null => {
  const deliveryNote = deliveryNotes.find(note => note.shipmentPlanId === returnRecord.shipmentPlanId || note.id === returnRecord.deliveryId) || null
  const vehicle = getVehicle(returnRecord.vehicleId, sourceData)
  const plan = getPlan(returnRecord.shipmentPlanId, sourceData)
  const template = getTemplateForType('RETURN_DELIVERY', templates)
  const formId = `shipment_form_return_${returnRecord.id}`
  const items: ShipmentFormItem[] = returnRecord.items.map((item, itemIndex) => {
    const lot = sourceData.inventoryLots.find(sourceLot => sourceLot.id === item.inventoryLotId) || null
    const stockItem = getStockItem(item.stockItemId, sourceData)
    const label = labels.find(record => record.lotId === item.inventoryLotId || record.lotNo === lot?.lotNo) || null

    return {
      id: `${formId}_item_${String(itemIndex + 1).padStart(2, '0')}`,
      formId,
      productId: lot?.productId || item.stockItemId,
      productName: stockItem?.name || lot?.productId || item.stockItemId,
      stockItemId: item.stockItemId,
      stockItemName: stockItem?.name || item.stockItemId,
      lotId: item.inventoryLotId,
      lotNo: lot?.lotNo || item.inventoryLotId,
      batchNo: lot?.lotNo || '',
      labelId: label?.id || '',
      labelNo: label?.labelNo || '',
      quantity: item.quantity,
      unit: item.unit,
      boxCount: item.returnType === 'PACKAGE' ? item.quantity : 0,
      palletCount: item.returnType === 'PALLET' ? item.quantity : 0
    }
  })

  return {
    id: formId,
    formNo: getNextShipmentFormNo(deliveryNotes.map((note, noteIndex) => ({
      formNo: getNextShipmentFormNo([], note.date, noteIndex)
    })), returnRecord.returnDate, index),
    formType: 'RETURN_DELIVERY',
    status: 'RETURNED',
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    shipmentId: deliveryNote?.shipmentId || '',
    shipmentNo: deliveryNote?.shipmentNo || '',
    deliveryNoteId: deliveryNote?.id || returnRecord.deliveryId,
    deliveryNoteNo: deliveryNote?.deliveryNoteNo || returnRecord.deliveryId,
    shipmentPlanId: returnRecord.shipmentPlanId,
    shipmentPlanNo: plan?.shipmentPlanNo || returnRecord.shipmentPlanId,
    vehicleId: returnRecord.vehicleId,
    vehicleNo: vehicle?.vehicleNo || returnRecord.vehicleId,
    vehiclePlate: vehicle?.plateNumber || '',
    driverName: returnRecord.driverName || vehicle?.driverName || plan?.driverName || '',
    warehouseId: deliveryNote?.warehouseId || '',
    warehouseName: deliveryNote?.warehouseName || '',
    branchId: deliveryNote?.branchId || '',
    branchName: deliveryNote?.branchName || '',
    customerId: deliveryNote?.customerId || '',
    customerName: deliveryNote?.customerName || '',
    loadingDate: returnRecord.returnDate,
    deliveryDate: returnRecord.returnDate,
    description: returnRecord.notes || 'Iade teslim formu read-model.',
    items,
    checklist: createShipmentChecklist(formId, template, 'PASS'),
    temperatureLogs: createShipmentTemperatureLogs(formId, returnRecord.returnDate, index, vehicle?.vehicleType === 'REFRIGERATED'),
    history: [
      createShipmentHistory(formId, 'CREATED', returnRecord.driverName || 'Sevkiyat', `${returnRecord.returnNo} kaynakli iade teslim formu olusturuldu.`)
    ],
    sourceType: 'Return',
    sourceId: returnRecord.id,
    createdBy: returnRecord.driverName || 'Sevkiyat',
    createdAt: returnRecord.createdAt,
    updatedAt: returnRecord.updatedAt
  }
}

export const createShipmentFormReadModelRecords = (
  sourceData: KpiSourceData
): ShipmentForm[] => {
  const templates = loadShipmentFormTemplates()
  const labels = LabelService.list(sourceData)
  const deliveryNotes = DeliveryNoteService.list(sourceData)
  const deliveryNoteForms = deliveryNotes.map((note, index) => createFormFromDeliveryNote(note, index, templates, labels, sourceData))
  const returnForms = sourceData.shipmentReturns
    .map((record, index) => createFormFromReturn(record, index, deliveryNotes, templates, labels, sourceData))
    .filter((form): form is ShipmentForm => Boolean(form))
  const generatedForms = [...deliveryNoteForms, ...returnForms]

  return generatedForms.map((form, index) => ({
    ...form,
    formNo: getNextShipmentFormNo(generatedForms.slice(0, index), form.loadingDate)
  }))
}

const normalizeChecklist = (
  value: unknown,
  formId: string,
  template: ShipmentFormTemplate
): ShipmentChecklist[] => {
  if(!Array.isArray(value) || value.length === 0) return createShipmentChecklist(formId, template)

  return value.filter(isRecord).map((item, index) => {
    const key = normalizeText(item.checklistKey).toUpperCase() as ShipmentChecklistKey
    const checklistKey = Object.keys(SHIPMENT_CHECKLIST_LABELS).includes(key) ? key : template.checklist[index]?.checklistKey || 'VEHICLE_CLEANING'
    return {
      id: normalizeText(item.id) || `${formId}_checklist_${index + 1}`,
      formId,
      checklistKey,
      label: normalizeText(item.label) || SHIPMENT_CHECKLIST_LABELS[checklistKey],
      description: normalizeText(item.description) || template.checklist[index]?.description || '',
      status: mapChecklistStatus(item.status),
      notes: normalizeText(item.notes),
      required: typeof item.required === 'boolean' ? item.required : template.checklist[index]?.required !== false
    }
  })
}

const normalizeTemperatureLogs = (
  value: unknown,
  formId: string,
  loadingDate: string
): ShipmentTemperatureLog[] => {
  if(!Array.isArray(value) || value.length === 0) return createShipmentTemperatureLogs(formId, loadingDate)

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${formId}_temperature_${index + 1}`,
    formId,
    stage: normalizeText(item.stage).toUpperCase() as ShipmentTemperatureLog['stage'] || 'START',
    label: normalizeText(item.label) || `Sicaklik ${index + 1}`,
    temperatureC: normalizeNonNegativeNumber(item.temperatureC),
    loggedAt: normalizeText(item.loggedAt) || `${loadingDate}T08:00:00.000Z`,
    result: mapChecklistStatus(item.result),
    notes: normalizeText(item.notes)
  }))
}

const normalizeItems = (
  value: unknown,
  formId: string
): ShipmentFormItem[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${formId}_item_${index + 1}`,
    formId,
    productId: normalizeText(item.productId),
    productName: normalizeText(item.productName) || '-',
    stockItemId: normalizeText(item.stockItemId),
    stockItemName: normalizeText(item.stockItemName),
    lotId: normalizeText(item.lotId),
    lotNo: normalizeText(item.lotNo),
    batchNo: normalizeText(item.batchNo),
    labelId: normalizeText(item.labelId),
    labelNo: normalizeText(item.labelNo),
    quantity: normalizeNonNegativeNumber(item.quantity),
    unit: normalizeText(item.unit) as StockUnit || 'adet',
    boxCount: normalizeNonNegativeNumber(item.boxCount),
    palletCount: normalizeNonNegativeNumber(item.palletCount)
  }))
}

const normalizeHistory = (
  value: unknown,
  formId: string,
  actorName: string
): ShipmentHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [createShipmentHistory(formId, 'CREATED', actorName, 'Shipment Form read-model kaydi olusturuldu.')]
  }

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${formId}_history_${index + 1}`,
    formId,
    action: normalizeText(history.action).toUpperCase() as ShipmentHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeShipmentForm = (
  record: RawShipmentForm,
  index: number
): ShipmentForm => {
  const formType = mapFormType(record.formType)
  const templates = loadShipmentFormTemplates()
  const template = templates.find(item => item.id === normalizeText(record.templateId)) || getTemplateForType(formType, templates)
  const formId = normalizeText(record.id) || `shipment_form_${Date.now()}_${index}`
  const loadingDate = normalizeText(record.loadingDate) || getTodayKey()
  const createdBy = normalizeText(record.createdBy) || 'Sevkiyat'
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()

  return {
    id: formId,
    formNo: normalizeText(record.formNo) || getNextShipmentFormNo([], loadingDate, index),
    formType,
    status: mapFormStatus(record.status),
    templateId: template.id,
    templateName: normalizeText(record.templateName) || template.name,
    templateVersion: normalizeText(record.templateVersion) || template.version,
    shipmentId: normalizeText(record.shipmentId),
    shipmentNo: normalizeText(record.shipmentNo),
    deliveryNoteId: normalizeText(record.deliveryNoteId),
    deliveryNoteNo: normalizeText(record.deliveryNoteNo),
    shipmentPlanId: normalizeText(record.shipmentPlanId),
    shipmentPlanNo: normalizeText(record.shipmentPlanNo),
    vehicleId: normalizeText(record.vehicleId),
    vehicleNo: normalizeText(record.vehicleNo),
    vehiclePlate: normalizeText(record.vehiclePlate),
    driverName: normalizeText(record.driverName),
    warehouseId: normalizeText(record.warehouseId),
    warehouseName: normalizeText(record.warehouseName),
    branchId: normalizeText(record.branchId),
    branchName: normalizeText(record.branchName),
    customerId: normalizeText(record.customerId),
    customerName: normalizeText(record.customerName),
    loadingDate,
    deliveryDate: normalizeText(record.deliveryDate),
    description: normalizeText(record.description),
    items: normalizeItems(record.items, formId),
    checklist: normalizeChecklist(record.checklist, formId, template),
    temperatureLogs: normalizeTemperatureLogs(record.temperatureLogs, formId, loadingDate),
    history: normalizeHistory(record.history, formId, createdBy),
    sourceType: normalizeText(record.sourceType) as ShipmentForm['sourceType'] || 'ManualReadModel',
    sourceId: normalizeText(record.sourceId),
    createdBy,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }
}

export const saveShipmentForms = (
  records: ShipmentForm[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(SHIPMENT_FORM_STORAGE_KEY, JSON.stringify(records))
}

export const loadShipmentForms = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createShipmentFormReadModelRecords(sourceData)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_FORM_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentForms(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeShipmentForm(record as RawShipmentForm, index))
      const storedIds = new Set(normalizedRecords.map(record => record.id))
      const nextRecords = [
        ...normalizedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ]
      saveShipmentForms(nextRecords)
      return nextRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentForms(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentForms(seedRecords)
  return seedRecords
}

export const filterShipmentForms = (
  forms: ShipmentForm[],
  filters: ShipmentFormFilters
) => forms.filter(form => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    form.formNo,
    form.shipmentNo,
    form.deliveryNoteNo,
    form.vehicleNo,
    form.vehiclePlate,
    form.driverName,
    form.customerName,
    form.items.map(item => `${item.productName} ${item.lotNo} ${item.labelNo}`).join(' ')
  ].join(' ')

  return (
    (filters.status === ALL_FILTER || form.status === filters.status)
    && (filters.formType === ALL_FILTER || form.formType === filters.formType)
    && (filters.vehicleId === ALL_FILTER || form.vehicleId === filters.vehicleId)
    && (filters.driverName === ALL_FILTER || form.driverName === filters.driverName)
    && (filters.branchId === ALL_FILTER || form.branchId === filters.branchId)
    && (filters.customerId === ALL_FILTER || form.customerId === filters.customerId)
    && (filters.warehouseId === ALL_FILTER || form.warehouseId === filters.warehouseId)
    && (!filters.date || form.loadingDate === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

export const addShipmentFormFromDeliveryNote = (
  input: ShipmentFormCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadShipmentForms(sourceData)
  const deliveryNote = DeliveryNoteService.list(sourceData).find(note => note.id === input.deliveryNoteId)
  if(!deliveryNote) throw new Error('Delivery Note bulunamadi.')
  const templates = loadShipmentFormTemplates()
  const labels = LabelService.list(sourceData)
  const form = createFormFromDeliveryNote(deliveryNote, records.length, templates, labels, sourceData, {
    formType: input.formType,
    loadingDate: input.loadingDate,
    deliveryDate: input.deliveryDate,
    description: input.description || 'Manuel read-model sevkiyat formu.',
    status: 'DRAFT',
    createdBy: actorName
  })
  const nextForm = {
    ...form,
    formNo: getNextShipmentFormNo(records, input.loadingDate || deliveryNote.date)
  }
  const validation = validateShipmentForm(nextForm, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveShipmentForms([nextForm, ...records])
  return nextForm
}

const upsertForm = (
  forms: ShipmentForm[],
  form: ShipmentForm
) => forms.some(record => record.id === form.id)
  ? forms.map(record => record.id === form.id ? form : record)
  : [form, ...forms]

export const updateShipmentFormStatus = (
  formId: string,
  status: ShipmentFormStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadShipmentForms(sourceData)
  const form = records.find(record => record.id === formId)
  if(!form) throw new Error('Sevkiyat formu bulunamadi.')
  if(form.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('Iptal edilmis sevkiyat formu tekrar acilamaz.')
  if(form.status === status) return form

  const actionByStatus: Record<ShipmentFormStatus, ShipmentHistoryAction> = {
    DRAFT: 'UPDATED',
    PREPARING: 'PREPARING',
    LOADING: 'LOADING',
    ON_ROUTE: 'ON_ROUTE',
    DELIVERED: 'DELIVERED',
    RETURNED: 'RETURNED',
    CANCELLED: 'CANCELLED'
  }
  const nextForm = appendShipmentHistory(
    { ...form, status },
    actionByStatus[status],
    actorName,
    `${form.formNo} ${SHIPMENT_FORM_STATUS_LABELS[status]} durumuna alindi.`
  )
  const validation = validateShipmentForm(nextForm, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveShipmentForms(upsertForm(records, nextForm))
  return nextForm
}

export const recordShipmentFormOutput = (
  formId: string,
  action: Extract<ShipmentHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadShipmentForms(sourceData)
  const form = records.find(record => record.id === formId)
  if(!form) throw new Error('Sevkiyat formu bulunamadi.')
  const nextForm = appendShipmentHistory(
    form,
    action,
    actorName,
    action === 'EXCEL' ? `${form.formNo} Excel export edildi.` : `${form.formNo} cikti penceresi acildi.`
  )
  saveShipmentForms(upsertForm(records, nextForm))
  return nextForm
}

export const ShipmentFormService = {
  createDefaultFilters: createDefaultShipmentFormFilters,
  getNextNo: getNextShipmentFormNo,
  list: loadShipmentForms,
  save: saveShipmentForms,
  filter: filterShipmentForms,
  templates: loadShipmentFormTemplates,
  createReadModelRecords: createShipmentFormReadModelRecords,
  addFromDeliveryNote: addShipmentFormFromDeliveryNote,
  updateStatus: updateShipmentFormStatus,
  recordOutput: recordShipmentFormOutput,
  statistics: createShipmentFormStatistics,
  validate: validateShipmentForm,
  checklist: ShipmentChecklistService
}
