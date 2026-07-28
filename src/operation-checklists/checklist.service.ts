import { GoodsReceiptService } from '../goods-receipts/goods-receipt.service'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { MonitoringRecord } from '../haccp/haccp.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import type { ProductionLine } from '../production-lines/production-line.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import { QualityFormService } from '../quality-forms/quality-form.service'
import type { QualityForm } from '../quality-forms/quality-form.types'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import type { ShipmentForm } from '../shipment-forms/shipment-form.types'
import type { Branch } from '../types'
import { appendChecklistHistory, createChecklistHistory } from './checklist-history.service'
import { createChecklistStatistics } from './checklist-statistics.service'
import {
  CHECKLIST_ITEM_STATUS_LABELS,
  CHECKLIST_ITEM_STATUSES,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUSES,
  CHECKLIST_TEMPLATE_STORAGE_KEY,
  CHECKLIST_TYPE_LABELS,
  CHECKLIST_TYPES,
  ChecklistTemplateService
} from './checklist-template.service'
import {
  validateChecklist,
  validateChecklistCreateInput
} from './checklist-validation.service'
import type {
  Checklist,
  ChecklistCreateInput,
  ChecklistExecution,
  ChecklistFilters,
  ChecklistHistory,
  ChecklistHistoryAction,
  ChecklistItem,
  ChecklistItemStatus,
  ChecklistSourceType,
  ChecklistStatus,
  ChecklistTemplate,
  ChecklistType,
  ChecklistUpdateInput
} from './operation-checklist.types'

export {
  CHECKLIST_ITEM_STATUS_LABELS,
  CHECKLIST_ITEM_STATUSES,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUSES,
  CHECKLIST_TEMPLATE_STORAGE_KEY,
  CHECKLIST_TYPE_LABELS,
  CHECKLIST_TYPES
} from './checklist-template.service'

export const CHECKLIST_STORAGE_KEY = 'ra_operation_checklists_records'

type RawChecklist = Partial<Record<keyof Checklist, unknown>> & Record<string, unknown>

const CHECKLIST_NO_PREFIX = 'CL'
const CHECKLIST_NO_PADDING = 6
const DAY_MS = 86400000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')
const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getDateDaysAgo = (days: number, hour = 8) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getBranchName = (
  branchId: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || 'Merkez'

const getBranchIdByName = (
  branchName: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => normalizeSearchText(branch.name) === normalizeSearchText(branchName))?.id
  || sourceData.branches[0]?.id
  || ''

const getLot = (
  lotId: string,
  sourceData: KpiSourceData
) => sourceData.inventoryLots.find(lot => lot.id === lotId)

const getPrimaryLot = (
  lotIds: string[],
  sourceData: KpiSourceData
) => lotIds.map(lotId => getLot(lotId, sourceData)).find((lot): lot is InventoryLot => Boolean(lot))

const mapChecklistType = (value: unknown): ChecklistType => {
  const normalized = normalizeText(value).toUpperCase() as ChecklistType
  return CHECKLIST_TYPES.includes(normalized) ? normalized : 'OPENING_CONTROL'
}

const mapChecklistStatus = (value: unknown): ChecklistStatus => {
  const normalized = normalizeText(value).toUpperCase() as ChecklistStatus
  return CHECKLIST_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapItemStatus = (value: unknown): ChecklistItemStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(normalized === 'N/A' || normalized === 'NA') return 'NOT_APPLICABLE'
  return CHECKLIST_ITEM_STATUS_LABELS[normalized as ChecklistItemStatus]
    ? normalized as ChecklistItemStatus
    : 'NOT_APPLICABLE'
}

const getNextChecklistNo = (
  records: Pick<Checklist, 'checklistNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${CHECKLIST_NO_PREFIX}-${year}-(\\d{${CHECKLIST_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.checklistNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${CHECKLIST_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(CHECKLIST_NO_PADDING, '0')}`
}

export const createDefaultChecklistFilters = (): ChecklistFilters => ({
  checklistType: ALL_FILTER,
  department: ALL_FILTER,
  branchId: ALL_FILTER,
  status: ALL_FILTER,
  shift: ALL_FILTER,
  date: '',
  search: ''
})

const getTemplate = (
  checklistType: ChecklistType,
  templates: ChecklistTemplate[]
) => ChecklistTemplateService.getForType(checklistType, templates)

const createItemsFromTemplate = (
  checklistId: string,
  template: ChecklistTemplate,
  getStatus: (itemTitle: string, index: number) => ChecklistItemStatus = () => 'PASS',
  getNote: (itemTitle: string, index: number) => string = () => '',
  getCorrectiveAction: (itemTitle: string, index: number) => string = () => ''
): ChecklistItem[] => template.items
  .sort((first, second) => first.displayOrder - second.displayOrder)
  .map((templateItem, index) => {
    const status = getStatus(templateItem.title, index)

    return {
      id: `${checklistId}_item_${index + 1}`,
      checklistId,
      templateItemId: templateItem.id,
      title: templateItem.title,
      description: templateItem.description,
      status,
      required: templateItem.required,
      note: getNote(templateItem.title, index),
      photoPlaceholder: templateItem.photoFieldReady ? 'Foto alanı hazır' : '',
      correctiveAction: status === 'FAIL' ? getCorrectiveAction(templateItem.title, index) : '',
      completedBy: '',
      completedAt: ''
    }
  })

const createExecution = (
  checklistId: string,
  items: ChecklistItem[],
  startedAt: string,
  completedAt: string,
  responsiblePerson: string
): ChecklistExecution => {
  const completedItems = items.filter(item => item.status !== 'NOT_APPLICABLE').length
  const failCount = items.filter(item => item.status === 'FAIL').length
  const warningCount = items.filter(item => item.status === 'WARNING').length
  const passCount = items.filter(item => item.status === 'PASS').length

  return {
    id: `${checklistId}_execution`,
    checklistId,
    startedAt,
    completedAt,
    responsiblePerson,
    completionRate: percent(completedItems, items.length),
    failCount,
    warningCount,
    passCount
  }
}

const resolveStatusFromItems = (
  items: ChecklistItem[],
  fallback: ChecklistStatus = 'COMPLETED'
): ChecklistStatus => {
  if(items.length === 0) return 'DRAFT'
  const hasMissingRequired = items.some(item => item.required && item.status === 'NOT_APPLICABLE')
  return hasMissingRequired ? 'IN_PROGRESS' : fallback
}

const createChecklist = ({
  actorName,
  branchId,
  branchName,
  checklistNo,
  checklistType,
  createdAt,
  department,
  description,
  endAt,
  equipmentId = '',
  equipmentName = '',
  goodsReceiptId = '',
  haccpReference = '',
  itemCorrectiveAction,
  itemNote,
  itemStatus,
  productionOrderId = '',
  qualityFormId = '',
  shift,
  shipmentId = '',
  sourceId,
  sourceNo,
  sourceType,
  startAt,
  status,
  templates,
  warehouseId,
  warehouseName
}: {
  actorName: string
  branchId: string
  branchName: string
  checklistNo: string
  checklistType: ChecklistType
  createdAt: string
  department: string
  description: string
  endAt: string
  equipmentId?: string
  equipmentName?: string
  goodsReceiptId?: string
  haccpReference?: string
  itemCorrectiveAction?: (itemTitle: string, index: number) => string
  itemNote?: (itemTitle: string, index: number) => string
  itemStatus?: (itemTitle: string, index: number) => ChecklistItemStatus
  productionOrderId?: string
  qualityFormId?: string
  shift: string
  shipmentId?: string
  sourceId: string
  sourceNo: string
  sourceType: ChecklistSourceType
  startAt: string
  status?: ChecklistStatus
  templates: ChecklistTemplate[]
  warehouseId: string
  warehouseName: string
}): Checklist => {
  const template = getTemplate(checklistType, templates)
  const checklistId = `operation_checklist_${sourceType.toLocaleLowerCase('tr-TR')}_${checklistType.toLocaleLowerCase('tr-TR')}_${sourceId || checklistNo}`
  const items = createItemsFromTemplate(
    checklistId,
    template,
    itemStatus,
    itemNote,
    itemCorrectiveAction
  )
  const resolvedStatus = status || resolveStatusFromItems(items)
  const completedAt = resolvedStatus === 'COMPLETED' ? (endAt || startAt) : ''
  const history = [
    createChecklistHistory(checklistId, 'CREATED', actorName, `${CHECKLIST_TYPE_LABELS[checklistType]} read-model checklist kaydi olusturuldu.`)
  ]

  if(resolvedStatus === 'COMPLETED'){
    history.push(createChecklistHistory(checklistId, 'COMPLETED', actorName, `${checklistNo} tamamlandi.`))
  }

  return {
    id: checklistId,
    checklistNo,
    checklistType,
    status: resolvedStatus,
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version,
    branchId,
    branchName,
    warehouseId,
    warehouseName,
    department,
    shift,
    responsiblePerson: actorName,
    startAt,
    endAt: completedAt || endAt,
    description,
    sourceType,
    sourceId,
    sourceNo,
    haccpReference,
    qualityFormId,
    goodsReceiptId,
    productionOrderId,
    shipmentId,
    equipmentId,
    equipmentName,
    items,
    execution: createExecution(checklistId, items, startAt, completedAt, actorName),
    history,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

const createBranchDailyChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => {
  const branchSeeds = sourceData.branches.length > 0 ? sourceData.branches.slice(0, 4) : [{
    id: 'branch_merkez',
    name: 'Merkez',
    code: 'MRK',
    phone: '',
    email: '',
    address: '',
    city: '',
    managerName: 'Operasyon',
    isActive: true,
    createdAt: '',
    updatedAt: ''
  } as Branch]

  return branchSeeds.flatMap((branch, branchIndex) => {
    const dayOffset = branchIndex % 3
    const common = {
      actorName: branch.managerName || 'Vardiya Sorumlusu',
      branchId: branch.id,
      branchName: branch.name,
      warehouseId: branch.id,
      warehouseName: branch.name,
      templates
    }

    return [
      createChecklist({
        ...common,
        checklistNo: '',
        checklistType: 'OPENING_CONTROL',
        createdAt: getDateDaysAgo(dayOffset, 7),
        department: 'Operasyon',
        description: `${branch.name} acilis vardiya kontrolu.`,
        endAt: getDateDaysAgo(dayOffset, 8),
        shift: 'Sabah',
        sourceId: `${branch.id}_opening_${dayOffset}`,
        sourceNo: branch.code || branch.name,
        sourceType: 'Warehouse',
        startAt: getDateDaysAgo(dayOffset, 7),
        status: 'COMPLETED',
        itemStatus: (_title, index) => index === 2 && branchIndex === 1 ? 'WARNING' : 'PASS',
        itemNote: (_title, index) => index === 2 && branchIndex === 1 ? 'Ekipman isinma suresi takip ediliyor.' : ''
      }),
      createChecklist({
        ...common,
        checklistNo: '',
        checklistType: 'CLOSING_CONTROL',
        createdAt: getDateDaysAgo(dayOffset, 22),
        department: 'Operasyon',
        description: `${branch.name} kapanis vardiya kontrolu.`,
        endAt: dayOffset === 0 ? '' : getDateDaysAgo(dayOffset, 23),
        shift: 'Aksam',
        sourceId: `${branch.id}_closing_${dayOffset}`,
        sourceNo: branch.code || branch.name,
        sourceType: 'Warehouse',
        startAt: getDateDaysAgo(dayOffset, 22),
        status: dayOffset === 0 ? 'IN_PROGRESS' : 'COMPLETED',
        itemStatus: (_title, index) => dayOffset === 0 && index > 1 ? 'NOT_APPLICABLE' : 'PASS'
      }),
      createChecklist({
        ...common,
        checklistNo: '',
        checklistType: 'PERSONNEL_HYGIENE_CONTROL',
        createdAt: getDateDaysAgo(dayOffset, 9),
        department: 'IK / Kalite',
        description: `${branch.name} personel hijyen kontrolu.`,
        endAt: getDateDaysAgo(dayOffset, 9),
        shift: 'Sabah',
        sourceId: `${branch.id}_hygiene_${dayOffset}`,
        sourceNo: branch.code || branch.name,
        sourceType: 'Cleaning',
        startAt: getDateDaysAgo(dayOffset, 9),
        status: 'COMPLETED',
        itemStatus: (_title, index) => index === 0 && branchIndex === 2 ? 'WARNING' : 'PASS',
        itemNote: (_title, index) => index === 0 && branchIndex === 2 ? 'El hijyeni hatirlatmasi yapildi.' : ''
      })
    ]
  })
}

const createHaccpChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => sourceData.haccpRecords.flatMap(plan => (
  plan.monitoringRecords.slice(0, 4).map((monitoring, index) => {
    const lot = getLot(monitoring.inventoryLotId, sourceData)
    const branchId = lot?.warehouseId || sourceData.branches[index % Math.max(1, sourceData.branches.length)]?.id || ''
    const fail = monitoring.result === 'FAIL'

    return createChecklist({
      actorName: monitoring.checkedBy || 'Kalite',
      branchId,
      branchName: getBranchName(branchId, sourceData),
      checklistNo: '',
      checklistType: 'HACCP_DAILY_CONTROL',
      createdAt: monitoring.checkedAt || getDateDaysAgo(index + 1, 10),
      department: 'Kalite',
      description: `${plan.name} CCP gunluk kontrolu. Kritik limit: ${monitoring.criticalLimit}.`,
      endAt: monitoring.checkedAt || getDateDaysAgo(index + 1, 11),
      haccpReference: `${plan.code} / ${monitoring.ccpId}`,
      shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
      sourceId: monitoring.id,
      sourceNo: plan.code,
      sourceType: 'HACCP',
      startAt: monitoring.checkedAt || getDateDaysAgo(index + 1, 10),
      status: 'COMPLETED',
      templates,
      warehouseId: lot?.warehouseId || branchId,
      warehouseName: getBranchName(lot?.warehouseId || branchId, sourceData),
      itemStatus: title => {
        if(fail && normalizeSearchText(title).includes('sapma')) return 'FAIL'
        if(fail && normalizeSearchText(title).includes('ccp')) return 'WARNING'
        return 'PASS'
      },
      itemNote: title => normalizeSearchText(title).includes('ccp')
        ? `${monitoring.measuredValue} / ${monitoring.criticalLimit}`
        : monitoring.notes,
      itemCorrectiveAction: () => fail ? 'HACCP duzeltici faaliyet kaydi kontrol edilecek.' : ''
    })
  })
))

const createQualityFormChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => QualityFormService.list(sourceData).slice(0, 10).map((form, index) => {
  const failCount = form.inspections.filter(inspection => inspection.status === 'FAIL').length
  const warningCount = form.inspections.filter(inspection => inspection.status === 'WARNING').length
  const checklistType: ChecklistType = form.haccpReference ? 'HACCP_DAILY_CONTROL' : 'PRODUCTION_LINE_CONTROL'

  return createChecklist({
    actorName: form.inspector || 'Kalite',
    branchId: form.branchId,
    branchName: form.branchName,
    checklistNo: '',
    checklistType,
    createdAt: form.inspectionDate || form.createdAt,
    department: 'Kalite',
    description: `${form.formNo} kalite formundan operasyon checklist read-modeli.`,
    endAt: form.updatedAt,
    haccpReference: form.haccpReference,
    qualityFormId: form.id,
    shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
    sourceId: form.id,
    sourceNo: form.formNo,
    sourceType: 'QualityForm',
    startAt: form.inspectionDate || form.createdAt,
    status: form.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
    templates,
    warehouseId: form.warehouseId,
    warehouseName: form.warehouseName,
    itemStatus: (_title, itemIndex) => {
      if(failCount > 0 && itemIndex === 1) return 'FAIL'
      if(warningCount > 0 && itemIndex === 2) return 'WARNING'
      return 'PASS'
    },
    itemNote: () => `Quality sonucu: ${form.result}. Skor: ${roundKpi(form.score)}.`,
    itemCorrectiveAction: () => 'Kalite kok neden ve CAPA sureci takip edilecek.'
  })
})

const getGoodsReceiptFailure = (
  receipt: GoodsReceiptRecord
) => receipt.status === 'REJECTED'
  || receipt.inspection?.result === 'FAIL'
  || receipt.inspection?.packagingCheck === 'FAIL'
  || receipt.inspection?.labelCheck === 'FAIL'
  || receipt.inspection?.lotCheck === 'FAIL'

const createGoodsReceiptChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => GoodsReceiptService.list(sourceData).slice(0, 10).map((receipt, index) => {
  const fail = getGoodsReceiptFailure(receipt)
  const warning = receipt.status === 'PARTIAL_ACCEPTED' || receipt.inspection?.result === 'CONDITIONAL'

  return createChecklist({
    actorName: receipt.receivedByName || receipt.receivedBy || 'Mal Kabul',
    branchId: receipt.warehouseId,
    branchName: receipt.warehouseName || getBranchName(receipt.warehouseId, sourceData),
    checklistNo: '',
    checklistType: index % 2 === 0 ? 'WAREHOUSE_CONTROL' : 'COLD_ROOM_CONTROL',
    createdAt: receipt.receiptDate,
    department: 'Depo',
    description: `${receipt.goodsReceiptNo || receipt.receiptNo} mal kabul operasyon kontrolu.`,
    endAt: receipt.updatedAt,
    goodsReceiptId: receipt.id,
    shift: 'Mal Kabul',
    sourceId: receipt.id,
    sourceNo: receipt.goodsReceiptNo || receipt.receiptNo,
    sourceType: 'GoodsReceipt',
    startAt: receipt.receiptDate,
    status: receipt.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
    templates,
    warehouseId: receipt.warehouseId,
    warehouseName: receipt.warehouseName || getBranchName(receipt.warehouseId, sourceData),
    itemStatus: (_title, itemIndex) => {
      if(fail && itemIndex === 2) return 'FAIL'
      if(warning && itemIndex === 1) return 'WARNING'
      return 'PASS'
    },
    itemNote: () => receipt.inspection
      ? `Sicaklik ${receipt.inspection.temperatureC} C / ${receipt.inspection.result}`
      : receipt.notes,
    itemCorrectiveAction: () => 'Mal kabul red veya sartli kabul aksiyonu kalite ekibiyle kapatilacak.'
  })
})

const createProductionChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => sourceData.productionOrders.slice(0, 10).flatMap((order, index) => {
  const branchId = getBranchIdByName(order.branch, sourceData)
  const branchName = getBranchName(branchId, sourceData)
  const isPending = normalizeSearchText(order.status).includes('bekliyor') || normalizeSearchText(order.status).includes('taslak')
  const common = {
    actorName: order.requester || 'Uretim',
    branchId,
    branchName,
    createdAt: order.updatedAt || order.createdAt,
    productionOrderId: order.id,
    shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
    sourceId: order.id,
    sourceNo: order.workOrderNo,
    sourceType: 'Production' as ChecklistSourceType,
    startAt: order.createdAt,
    status: isPending ? 'IN_PROGRESS' as ChecklistStatus : 'COMPLETED' as ChecklistStatus,
    templates,
    warehouseId: branchId,
    warehouseName: branchName
  }

  return [
    createChecklist({
      ...common,
      checklistNo: '',
      checklistType: 'PRODUCTION_LINE_CONTROL',
      department: 'Uretim',
      description: `${order.workOrderNo} uretim hatti operasyon kontrolu.`,
      endAt: isPending ? '' : order.updatedAt || order.createdAt,
      itemStatus: (_title, itemIndex) => isPending && itemIndex > 1 ? 'NOT_APPLICABLE' : 'PASS'
    }),
    createChecklist({
      ...common,
      checklistNo: '',
      checklistType: 'BLAST_CHILLING_CONTROL',
      department: 'Uretim',
      description: `${order.workOrderNo} soklama hazirlik ve cikis kontrolu.`,
      endAt: isPending ? '' : order.updatedAt || order.createdAt,
      itemStatus: (_title, itemIndex) => {
        if(isPending && itemIndex > 1) return 'NOT_APPLICABLE'
        if(index % 5 === 0 && itemIndex === 2) return 'WARNING'
        return 'PASS'
      },
      itemNote: (_title, itemIndex) => index % 5 === 0 && itemIndex === 2 ? 'Cikis sicakligi tekrar olculdu.' : ''
    })
  ]
})

const createShipmentChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => ShipmentFormService.list(sourceData).slice(0, 10).map((form, index) => {
  const hasColdChainWarning = form.temperatureLogs.some(log => log.result === 'WARNING' || log.result === 'FAIL')
  const hasChecklistFail = form.checklist.some(item => item.status === 'FAIL')

  return createChecklist({
    actorName: form.driverName || 'Sevkiyat',
    branchId: form.branchId,
    branchName: form.branchName,
    checklistNo: '',
    checklistType: 'SHIPMENT_CONTROL',
    createdAt: form.loadingDate,
    department: 'Sevkiyat',
    description: `${form.formNo} sevkiyat operasyon kontrolu.`,
    endAt: form.deliveryDate,
    shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
    shipmentId: form.shipmentId,
    sourceId: form.id,
    sourceNo: form.formNo,
    sourceType: 'Shipment',
    startAt: form.loadingDate,
    status: form.status === 'CANCELLED' ? 'CANCELLED' : form.status === 'DELIVERED' ? 'COMPLETED' : 'IN_PROGRESS',
    templates,
    warehouseId: form.warehouseId,
    warehouseName: form.warehouseName,
    itemStatus: title => {
      const normalized = normalizeSearchText(title)
      if(hasChecklistFail && normalized.includes('lot')) return 'FAIL'
      if(hasColdChainWarning && normalized.includes('soguk')) return 'WARNING'
      return form.status === 'DRAFT' ? 'NOT_APPLICABLE' : 'PASS'
    },
    itemNote: title => normalizeSearchText(title).includes('soguk')
      ? `${form.temperatureLogs.length} sicaklik logu izlendi.`
      : `${form.deliveryNoteNo} / ${form.vehicleNo}`,
    itemCorrectiveAction: () => 'Sevkiyat kalite ve soguk zincir kayitlari tekrar kontrol edilecek.'
  })
})

const createEquipmentChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => sourceData.productionLines.slice(0, 8).flatMap((line, index) => {
  const branch = sourceData.branches[index % Math.max(1, sourceData.branches.length)]
  const branchId = branch?.id || ''
  const branchName = branch?.name || 'Merkez'
  const maintenanceRisk = normalizeSearchText(line.status).includes('bak')
  const common = {
    actorName: line.responsible || line.activeOperator || 'Bakim',
    branchId,
    branchName,
    createdAt: line.updatedAt || line.createdAt,
    equipmentId: line.id,
    equipmentName: line.name,
    shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
    sourceId: line.id,
    sourceNo: line.code,
    startAt: line.updatedAt || line.createdAt,
    templates,
    warehouseId: branchId,
    warehouseName: branchName
  }

  return [
    createChecklist({
      ...common,
      checklistNo: '',
      checklistType: 'MACHINE_CONTROL',
      department: 'Bakim',
      description: `${line.name} makine kontrolu.`,
      endAt: line.updatedAt || line.createdAt,
      sourceType: 'Equipment',
      status: 'COMPLETED',
      itemStatus: (_title, itemIndex) => maintenanceRisk && itemIndex === 0 ? 'FAIL' : itemIndex === 2 && line.estimatedUtilization > 85 ? 'WARNING' : 'PASS',
      itemNote: () => `${line.status} / kapasite kullanim ${line.estimatedUtilization}%.`,
      itemCorrectiveAction: () => 'Bakim kontrol listesi acildi ve tekrar test planlandi.'
    }),
    createChecklist({
      ...common,
      checklistNo: '',
      checklistType: 'MAINTENANCE_CONTROL',
      department: 'Bakim',
      description: `${line.name} planli bakim izleme kontrolu.`,
      endAt: maintenanceRisk ? '' : line.updatedAt || line.createdAt,
      sourceType: 'Maintenance',
      status: maintenanceRisk ? 'IN_PROGRESS' : 'COMPLETED',
      itemStatus: (_title, itemIndex) => maintenanceRisk && itemIndex > 1 ? 'NOT_APPLICABLE' : 'PASS'
    })
  ]
})

const createCleaningChecklists = (
  sourceData: KpiSourceData,
  templates: ChecklistTemplate[]
) => sourceData.branches.slice(0, 4).map((branch, index) => createChecklist({
  actorName: branch.managerName || 'Temizlik',
  branchId: branch.id,
  branchName: branch.name,
  checklistNo: '',
  checklistType: 'CLEANING_CONTROL',
  createdAt: getDateDaysAgo(index, 14),
  department: 'Temizlik',
  description: `${branch.name} gunluk temizlik kontrolu.`,
  endAt: index === 0 ? '' : getDateDaysAgo(index, 15),
  shift: index % 2 === 0 ? 'Sabah' : 'Aksam',
  sourceId: `${branch.id}_cleaning_${index}`,
  sourceNo: branch.code || branch.name,
  sourceType: 'Cleaning',
  startAt: getDateDaysAgo(index, 14),
  status: index === 0 ? 'IN_PROGRESS' : 'COMPLETED',
  templates,
  warehouseId: branch.id,
  warehouseName: branch.name,
  itemStatus: (_title, itemIndex) => index === 0 && itemIndex > 1 ? 'NOT_APPLICABLE' : itemIndex === 2 && index === 2 ? 'WARNING' : 'PASS',
  itemNote: (_title, itemIndex) => itemIndex === 2 && index === 2 ? 'Gorsel tekrar kontrol istendi.' : ''
}))

export const createChecklistReadModelRecords = (
  sourceData: KpiSourceData
): Checklist[] => {
  const templates = ChecklistTemplateService.list()
  const generatedRecords = [
    ...createBranchDailyChecklists(sourceData, templates),
    ...createCleaningChecklists(sourceData, templates),
    ...createHaccpChecklists(sourceData, templates),
    ...createQualityFormChecklists(sourceData, templates),
    ...createGoodsReceiptChecklists(sourceData, templates),
    ...createProductionChecklists(sourceData, templates),
    ...createShipmentChecklists(sourceData, templates),
    ...createEquipmentChecklists(sourceData, templates)
  ]

  return generatedRecords.map((record, index) => ({
    ...record,
    checklistNo: getNextChecklistNo(generatedRecords.slice(0, index), record.startAt)
  }))
}

const normalizeItems = (
  value: unknown,
  checklistId: string,
  template: ChecklistTemplate
): ChecklistItem[] => {
  if(!Array.isArray(value) || value.length === 0){
    return createItemsFromTemplate(checklistId, template, () => 'NOT_APPLICABLE')
  }

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${checklistId}_item_${index + 1}`,
    checklistId,
    templateItemId: normalizeText(item.templateItemId) || template.items[index]?.id || '',
    title: normalizeText(item.title) || template.items[index]?.title || `Kontrol ${index + 1}`,
    description: normalizeText(item.description) || template.items[index]?.description || '',
    status: mapItemStatus(item.status),
    required: typeof item.required === 'boolean' ? item.required : template.items[index]?.required !== false,
    note: normalizeText(item.note),
    photoPlaceholder: normalizeText(item.photoPlaceholder),
    correctiveAction: normalizeText(item.correctiveAction),
    completedBy: normalizeText(item.completedBy),
    completedAt: normalizeText(item.completedAt)
  }))
}

const normalizeHistory = (
  value: unknown,
  checklistId: string,
  actorName: string
): ChecklistHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [createChecklistHistory(checklistId, 'CREATED', actorName, 'Operations Checklist read-model kaydi olusturuldu.')]
  }

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${checklistId}_history_${index + 1}`,
    checklistId,
    action: normalizeText(history.action).toUpperCase() as ChecklistHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    revisionNo: Number(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeSourceType = (value: unknown): ChecklistSourceType => {
  const normalized = normalizeText(value)
  const validSourceTypes: ChecklistSourceType[] = [
    'Warehouse',
    'Production',
    'Shipment',
    'QualityForm',
    'GoodsReceipt',
    'HACCP',
    'Equipment',
    'Maintenance',
    'Cleaning',
    'ManualReadModel'
  ]

  return validSourceTypes.includes(normalized as ChecklistSourceType)
    ? normalized as ChecklistSourceType
    : 'ManualReadModel'
}

const normalizeChecklist = (
  record: RawChecklist,
  index: number
): Checklist => {
  const templates = ChecklistTemplateService.list()
  const checklistType = mapChecklistType(record.checklistType)
  const template = templates.find(item => item.id === normalizeText(record.templateId)) || getTemplate(checklistType, templates)
  const checklistId = normalizeText(record.id) || `operation_checklist_${Date.now()}_${index}`
  const startAt = normalizeText(record.startAt) || getDateDaysAgo(0, 8)
  const createdBy = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Operasyon'
  const createdAt = normalizeText(record.createdAt) || startAt
  const items = normalizeItems(record.items, checklistId, template)
  const status = mapChecklistStatus(record.status)
  const completedAt = status === 'COMPLETED'
    ? normalizeText(record.endAt) || normalizeText(record.execution && isRecord(record.execution) ? record.execution.completedAt : '') || new Date().toISOString()
    : normalizeText(record.endAt)
  const responsiblePerson = normalizeText(record.responsiblePerson) || createdBy

  return {
    id: checklistId,
    checklistNo: normalizeText(record.checklistNo) || getNextChecklistNo([], startAt, index),
    checklistType,
    status,
    templateId: template.id,
    templateName: normalizeText(record.templateName) || template.name,
    templateVersion: normalizeText(record.templateVersion) || template.version,
    branchId: normalizeText(record.branchId),
    branchName: normalizeText(record.branchName),
    warehouseId: normalizeText(record.warehouseId),
    warehouseName: normalizeText(record.warehouseName),
    department: normalizeText(record.department) || template.department,
    shift: normalizeText(record.shift) || 'Genel',
    responsiblePerson,
    startAt,
    endAt: completedAt,
    description: normalizeText(record.description),
    sourceType: normalizeSourceType(record.sourceType),
    sourceId: normalizeText(record.sourceId),
    sourceNo: normalizeText(record.sourceNo),
    haccpReference: normalizeText(record.haccpReference),
    qualityFormId: normalizeText(record.qualityFormId),
    goodsReceiptId: normalizeText(record.goodsReceiptId),
    productionOrderId: normalizeText(record.productionOrderId),
    shipmentId: normalizeText(record.shipmentId),
    equipmentId: normalizeText(record.equipmentId),
    equipmentName: normalizeText(record.equipmentName),
    items,
    execution: createExecution(checklistId, items, startAt, completedAt, responsiblePerson),
    history: normalizeHistory(record.history, checklistId, createdBy),
    revisionNo: Number(record.revisionNo) || 1,
    createdBy,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }
}

export const saveChecklists = (
  records: Checklist[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(records))
}

export const loadChecklists = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createChecklistReadModelRecords(sourceData)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(CHECKLIST_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveChecklists(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeChecklist(record as RawChecklist, index))
      const storedIds = new Set(normalizedRecords.map(record => record.id))
      const nextRecords = [
        ...normalizedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ]
      saveChecklists(nextRecords)
      return nextRecords
    }
  } catch {
    if(seedRecords.length > 0) saveChecklists(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveChecklists(seedRecords)
  return seedRecords
}

export const filterChecklists = (
  checklists: Checklist[],
  filters: ChecklistFilters
) => checklists.filter(checklist => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    checklist.checklistNo,
    checklist.templateName,
    checklist.department,
    checklist.branchName,
    checklist.warehouseName,
    checklist.sourceNo,
    checklist.equipmentName,
    checklist.items.map(item => `${item.title} ${item.note} ${item.correctiveAction}`).join(' ')
  ].join(' ')

  return (
    (filters.checklistType === ALL_FILTER || checklist.checklistType === filters.checklistType)
    && (filters.department === ALL_FILTER || checklist.department === filters.department)
    && (filters.branchId === ALL_FILTER || checklist.branchId === filters.branchId)
    && (filters.status === ALL_FILTER || checklist.status === filters.status)
    && (filters.shift === ALL_FILTER || checklist.shift === filters.shift)
    && (!filters.date || getDateKey(checklist.startAt) === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

const upsertChecklist = (
  checklists: Checklist[],
  checklist: Checklist
) => checklists.some(record => record.id === checklist.id)
  ? checklists.map(record => record.id === checklist.id ? checklist : record)
  : [checklist, ...checklists]

export const addChecklist = (
  input: ChecklistCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateChecklistCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadChecklists(sourceData)
  const templates = ChecklistTemplateService.list()
  const template = templates.find(item => item.id === input.templateId)
  if(!template) throw new Error('Checklist sablonu bulunamadi.')
  const branchName = getBranchName(input.branchId, sourceData)
  const warehouseName = getBranchName(input.warehouseId || input.branchId, sourceData)
  const checklist = createChecklist({
    actorName,
    branchId: input.branchId,
    branchName,
    checklistNo: getNextChecklistNo(records, input.startAt),
    checklistType: template.checklistType,
    createdAt: new Date().toISOString(),
    department: input.department || template.department,
    description: input.description || 'Manuel read-model operasyon checklist kaydi.',
    endAt: input.endAt,
    shift: input.shift,
    sourceId: createId('manual_checklist'),
    sourceNo: template.name,
    sourceType: 'ManualReadModel',
    startAt: input.startAt || new Date().toISOString(),
    status: 'DRAFT',
    templates,
    warehouseId: input.warehouseId || input.branchId,
    warehouseName,
    itemStatus: () => 'NOT_APPLICABLE'
  })
  const nextValidation = validateChecklist(checklist)
  if(!nextValidation.valid) throw new Error(nextValidation.errors.join(' '))
  saveChecklists([checklist, ...records])
  return checklist
}

export const updateChecklistItems = (
  checklistId: string,
  input: ChecklistUpdateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadChecklists(sourceData)
  const checklist = records.find(record => record.id === checklistId)
  if(!checklist) throw new Error('Checklist bulunamadi.')
  if(checklist.status === 'CANCELLED') throw new Error('Iptal edilmis checklist guncellenemez.')

  const updatedAt = new Date().toISOString()
  const nextItems = checklist.items.map(item => {
    const status = input.itemStatuses[item.id] || item.status
    const completedAt = status === 'NOT_APPLICABLE' ? '' : (item.completedAt || updatedAt)

    return {
      ...item,
      status,
      note: input.itemNotes[item.id] ?? item.note,
      correctiveAction: input.correctiveActions[item.id] ?? item.correctiveAction,
      completedBy: status === 'NOT_APPLICABLE' ? '' : actorName,
      completedAt
    }
  })
  const nextChecklist = appendChecklistHistory(
    {
      ...checklist,
      status: checklist.status === 'DRAFT' ? 'IN_PROGRESS' : checklist.status,
      items: nextItems,
      execution: createExecution(checklist.id, nextItems, checklist.startAt, checklist.endAt, checklist.responsiblePerson)
    },
    'UPDATED',
    actorName,
    `${checklist.checklistNo} maddeleri guncellendi.`
  )

  saveChecklists(upsertChecklist(records, nextChecklist))
  return nextChecklist
}

export const completeChecklist = (
  checklistId: string,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadChecklists(sourceData)
  const checklist = records.find(record => record.id === checklistId)
  if(!checklist) throw new Error('Checklist bulunamadi.')
  if(checklist.status === 'CANCELLED') throw new Error('Iptal edilmis checklist tamamlanamaz.')
  const completedAt = new Date().toISOString()
  const nextChecklist = appendChecklistHistory(
    {
      ...checklist,
      status: 'COMPLETED',
      endAt: completedAt,
      execution: createExecution(checklist.id, checklist.items, checklist.startAt, completedAt, checklist.responsiblePerson)
    },
    'COMPLETED',
    actorName,
    `${checklist.checklistNo} tamamlandi.`
  )
  const validation = validateChecklist(nextChecklist)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveChecklists(upsertChecklist(records, nextChecklist))
  return nextChecklist
}

export const reviseChecklist = (
  checklistId: string,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadChecklists(sourceData)
  const checklist = records.find(record => record.id === checklistId)
  if(!checklist) throw new Error('Checklist bulunamadi.')
  if(checklist.status === 'CANCELLED') throw new Error('Iptal edilmis checklist revize edilemez.')

  const nextChecklist = appendChecklistHistory(
    {
      ...checklist,
      status: 'REVISED'
    },
    'REVISED',
    actorName,
    `${checklist.checklistNo} revize edildi.`
  )
  saveChecklists(upsertChecklist(records, nextChecklist))
  return nextChecklist
}

export const cancelChecklist = (
  checklistId: string,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadChecklists(sourceData)
  const checklist = records.find(record => record.id === checklistId)
  if(!checklist) throw new Error('Checklist bulunamadi.')

  const nextChecklist = appendChecklistHistory(
    {
      ...checklist,
      status: 'CANCELLED'
    },
    'CANCELLED',
    actorName,
    `${checklist.checklistNo} iptal edildi.`
  )
  saveChecklists(upsertChecklist(records, nextChecklist))
  return nextChecklist
}

export const recordChecklistOutput = (
  checklistId: string,
  action: Extract<ChecklistHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadChecklists(sourceData)
  const checklist = records.find(record => record.id === checklistId)
  if(!checklist) throw new Error('Checklist bulunamadi.')
  const nextChecklist = appendChecklistHistory(
    checklist,
    action,
    actorName,
    action === 'EXCEL' ? `${checklist.checklistNo} Excel export edildi.` : `${checklist.checklistNo} cikti penceresi acildi.`
  )
  saveChecklists(upsertChecklist(records, nextChecklist))
  return nextChecklist
}

export const getChecklistSourceSummary = (
  checklist: Checklist,
  sourceData: KpiSourceData
) => {
  if(checklist.sourceType === 'QualityForm'){
    const form = QualityFormService.list(sourceData).find(record => record.id === checklist.qualityFormId) as QualityForm | undefined
    return form ? `${form.formNo} / ${form.result}` : checklist.sourceNo
  }

  if(checklist.sourceType === 'GoodsReceipt'){
    const receipt = GoodsReceiptService.list(sourceData).find(record => record.id === checklist.goodsReceiptId) as GoodsReceiptRecord | undefined
    return receipt ? `${receipt.goodsReceiptNo || receipt.receiptNo} / ${receipt.supplierName || '-'}` : checklist.sourceNo
  }

  if(checklist.sourceType === 'Production'){
    const order = sourceData.productionOrders.find(record => record.id === checklist.productionOrderId) as ProductionWorkOrder | undefined
    return order ? `${order.workOrderNo} / ${order.status}` : checklist.sourceNo
  }

  if(checklist.sourceType === 'Shipment'){
    const form = ShipmentFormService.list(sourceData).find(record => record.id === checklist.sourceId) as ShipmentForm | undefined
    return form ? `${form.formNo} / ${form.deliveryNoteNo}` : checklist.sourceNo
  }

  if(checklist.sourceType === 'HACCP'){
    const monitoring = sourceData.haccpRecords
      .flatMap(record => record.monitoringRecords)
      .find(record => record.id === checklist.sourceId) as MonitoringRecord | undefined
    return monitoring ? `${checklist.haccpReference} / ${monitoring.result}` : checklist.sourceNo
  }

  if(checklist.sourceType === 'Equipment' || checklist.sourceType === 'Maintenance'){
    const line = sourceData.productionLines.find(record => record.id === checklist.equipmentId) as ProductionLine | undefined
    return line ? `${line.code} / ${line.status}` : checklist.sourceNo
  }

  return checklist.sourceNo || checklist.sourceType
}

export const ChecklistService = {
  createDefaultFilters: createDefaultChecklistFilters,
  getNextNo: getNextChecklistNo,
  list: loadChecklists,
  save: saveChecklists,
  filter: filterChecklists,
  templates: ChecklistTemplateService.list,
  createReadModelRecords: createChecklistReadModelRecords,
  add: addChecklist,
  updateItems: updateChecklistItems,
  complete: completeChecklist,
  revise: reviseChecklist,
  cancel: cancelChecklist,
  recordOutput: recordChecklistOutput,
  statistics: createChecklistStatistics,
  validate: validateChecklist,
  validateCreateInput: validateChecklistCreateInput,
  sourceSummary: getChecklistSourceSummary
}
