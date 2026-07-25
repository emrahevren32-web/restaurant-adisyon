import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type {
  CorrectiveAction,
  CriticalControlPoint,
  HACCPPlanRecord,
  MonitoringRecord,
  VerificationRecord
} from '../haccp/haccp.types'
import type { ProductionWorkOrder, ProductionWorkOrderLine } from '../production-work-orders/production-work-order.types'
import type { ProductRecall } from '../product-recalls/product-recall.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { WitnessSample } from '../witness-samples/witness-sample.types'
import type {
  ProductHistoryBuildInput,
  ProductHistoryBuildResult,
  ProductHistoryEvent,
  ProductHistoryEventType,
  ProductHistoryIndex,
  ProductHistoryProductReference
} from './product-history.types'

export const PRODUCT_HISTORY_EVENT_TYPES: ProductHistoryEventType[] = [
  'PRODUCTION_ORDER',
  'LOT_CREATED',
  'SAMPLE_COLLECTED',
  'WITNESS_SAMPLE_CREATED',
  'RECALL_OPENED',
  'HACCP_MONITORING',
  'HACCP_FAILURE',
  'HACCP_CORRECTIVE_ACTION',
  'HACCP_VERIFIED'
]

export const PRODUCT_HISTORY_EVENT_TYPE_LABELS: Record<ProductHistoryEventType, string> = {
  PRODUCTION_ORDER: 'Production Order',
  LOT_CREATED: 'Lot',
  SAMPLE_COLLECTED: 'Numune',
  WITNESS_SAMPLE_CREATED: 'Şahit Numune',
  RECALL_OPENED: 'Recall',
  HACCP_MONITORING: 'HACCP Monitoring',
  HACCP_FAILURE: 'HACCP Failure',
  HACCP_CORRECTIVE_ACTION: 'HACCP Corrective Action',
  HACCP_VERIFIED: 'HACCP Verification'
}

export const PRODUCT_HISTORY_EVENT_TYPE_CLASS_NAMES: Record<ProductHistoryEventType, string> = {
  PRODUCTION_ORDER: 'production-order',
  LOT_CREATED: 'lot-created',
  SAMPLE_COLLECTED: 'sample-collected',
  WITNESS_SAMPLE_CREATED: 'witness-sample-created',
  RECALL_OPENED: 'recall-opened',
  HACCP_MONITORING: 'haccp-monitoring',
  HACCP_FAILURE: 'haccp-failure',
  HACCP_CORRECTIVE_ACTION: 'haccp-corrective-action',
  HACCP_VERIFIED: 'haccp-verified'
}

const normalizeText = (value: unknown) => String(value || '').trim()

export const normalizeProductHistorySearchText = (value: unknown) => (
  normalizeText(value).toLocaleLowerCase('tr-TR')
)

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

const groupBy = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string
) => records.reduce((groups, record) => {
  const key = getKey(record)
  if(!key) return groups
  const currentRecords = groups.get(key) || []
  currentRecords.push(record)
  groups.set(key, currentRecords)
  return groups
}, new Map<string, TRecord[]>())

const normalizeDateKey = (value: string) => {
  const rawValue = normalizeText(value)
  if(!rawValue) return ''

  const dateKeyMatch = rawValue.match(/^\d{4}-\d{2}-\d{2}/)
  if(dateKeyMatch) return dateKeyMatch[0]

  const date = new Date(rawValue)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const toOccurrenceIso = (
  primaryDateTime: string,
  fallbackDate: string,
  fallbackHour: number
) => {
  const primaryValue = normalizeText(primaryDateTime)
  if(primaryValue){
    const normalizedValue = primaryValue.includes('T')
      ? primaryValue
      : `${primaryValue}T00:00:00.000Z`
    const primaryDate = new Date(normalizedValue)
    if(!Number.isNaN(primaryDate.getTime())) return primaryDate.toISOString()
  }

  const dateKey = normalizeDateKey(fallbackDate) || '1970-01-01'
  return `${dateKey}T${String(fallbackHour).padStart(2, '0')}:00:00.000Z`
}

const getDateKeyFromIso = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? normalizeDateKey(value) : date.toISOString().slice(0, 10)
}

const getTimeKeyFromIso = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--:--' : date.toISOString().slice(11, 16)
}

const formatQuantity = (quantity: number, unit: string) => (
  `${quantity.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const createProductOption = (
  id: string,
  name: string,
  stockItemId = ''
): ProductHistoryProductReference => ({
  id,
  name: name || 'Product bulunamadı',
  stockItemId
})

const createIndex = ({
  productionOrders,
  inventoryLots,
  qualitySamples,
  witnessSamples,
  recalls,
  haccpRecords,
  products,
  stockItems
}: ProductHistoryBuildInput): ProductHistoryIndex => ({
  productionOrderMap: new Map(productionOrders.map(order => [order.id, order])),
  lotsByProductionOrderId: groupBy(inventoryLots, lot => lot.productionOrderId),
  lotMap: new Map(inventoryLots.map(lot => [lot.id, lot])),
  samplesByLotId: groupBy(qualitySamples, sample => sample.inventoryLotId),
  sampleMap: new Map(qualitySamples.map(sample => [sample.id, sample])),
  witnessSamplesBySampleId: groupBy(witnessSamples, sample => sample.qualitySampleId),
  witnessSampleMap: new Map(witnessSamples.map(sample => [sample.id, sample])),
  recallsByLotId: groupBy(recalls, recall => recall.inventoryLotId),
  recallMap: new Map(recalls.map(recall => [recall.id, recall])),
  haccpPlanMap: new Map(haccpRecords.map(plan => [plan.id, plan])),
  productMap: new Map(products.map(product => [product.id, product])),
  stockItemMap: new Map(stockItems.map(item => [item.id, item]))
})

const createProductByNameMap = (
  products: ProductHistoryProductReference[]
) => new Map(products.map(product => [normalizeProductHistorySearchText(product.name), product]))

const getLineProductId = (
  line: ProductionWorkOrderLine,
  productByNameMap: Map<string, ProductHistoryProductReference>
) => productByNameMap.get(normalizeProductHistorySearchText(line.productName))?.id || ''

const getProductName = (
  productId: string,
  index: ProductHistoryIndex,
  fallbackName = ''
) => (
  index.productMap.get(productId)?.name
  || index.stockItemMap.get(productId)?.name
  || fallbackName
  || 'Product bulunamadı'
)

const getLotProductName = (
  lot: InventoryLot | null,
  index: ProductHistoryIndex
) => {
  if(!lot) return 'Product bulunamadı'
  return getProductName(
    lot.productId || lot.stockItemId,
    index,
    index.stockItemMap.get(lot.stockItemId)?.name
  )
}

const getOrderProductIds = (
  order: ProductionWorkOrder,
  relatedLots: InventoryLot[],
  productByNameMap: Map<string, ProductHistoryProductReference>
) => unique([
  ...relatedLots.map(lot => lot.productId || lot.stockItemId),
  ...order.lines.map(line => getLineProductId(line, productByNameMap))
])

const getOrderProductName = (
  order: ProductionWorkOrder,
  productIds: string[],
  index: ProductHistoryIndex
) => {
  const productNames = unique(productIds.map(productId => getProductName(productId, index, '')))
  const fallbackNames = unique(order.lines.map(line => normalizeText(line.productName)))
  const names = productNames.length > 0 ? productNames : fallbackNames
  if(names.length === 0) return 'Product bulunamadı'
  if(names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
}

const createEvent = (
  event: Omit<ProductHistoryEvent, 'dateKey' | 'timeKey' | 'searchText'>
): ProductHistoryEvent => {
  const dateKey = getDateKeyFromIso(event.occurredAt)
  const timeKey = getTimeKeyFromIso(event.occurredAt)
  const searchFields = [
    PRODUCT_HISTORY_EVENT_TYPE_LABELS[event.eventType],
    event.referenceNo,
    event.productName,
    event.productionOrderNo,
    event.lotNo,
    event.sampleNo,
    event.witnessNo,
    event.recallNo,
    event.haccpPlanId || '',
    event.criticalControlPointId || '',
    event.monitoringRecordId || '',
    event.correctiveActionId || '',
    event.verificationRecordId || '',
    event.description
  ]

  return {
    ...event,
    productIds: unique(event.productIds),
    dateKey,
    timeKey,
    searchText: normalizeProductHistorySearchText(searchFields.join(' '))
  }
}

const createProductionOrderEvent = (
  order: ProductionWorkOrder,
  index: ProductHistoryIndex,
  productByNameMap: Map<string, ProductHistoryProductReference>
) => {
  const relatedLots = index.lotsByProductionOrderId.get(order.id) || []
  const productIds = getOrderProductIds(order, relatedLots, productByNameMap)

  return createEvent({
    id: `product_history_production_order_${order.id}`,
    eventType: 'PRODUCTION_ORDER',
    occurredAt: toOccurrenceIso(order.createdAt, order.deliveryDate, 8),
    referenceNo: order.workOrderNo,
    productIds,
    productName: getOrderProductName(order, productIds, index),
    productionOrderId: order.id,
    productionOrderNo: order.workOrderNo,
    inventoryLotId: '',
    lotNo: '',
    qualitySampleId: '',
    sampleNo: '',
    witnessSampleId: '',
    witnessNo: '',
    recallId: '',
    recallNo: '',
    description: `Production Order oluşturuldu. ${order.lines.length} ürün satırı planlandı.`
  })
}

const createLotEvent = (
  lot: InventoryLot,
  index: ProductHistoryIndex
) => {
  const productionOrder = index.productionOrderMap.get(lot.productionOrderId) || null

  return createEvent({
    id: `product_history_lot_${lot.id}`,
    eventType: 'LOT_CREATED',
    occurredAt: toOccurrenceIso(lot.createdAt, lot.productionDate, 9),
    referenceNo: lot.lotNo,
    productIds: unique([lot.productId || lot.stockItemId]),
    productName: getLotProductName(lot, index),
    productionOrderId: lot.productionOrderId,
    productionOrderNo: productionOrder?.workOrderNo || '',
    inventoryLotId: lot.id,
    lotNo: lot.lotNo,
    qualitySampleId: '',
    sampleNo: '',
    witnessSampleId: '',
    witnessNo: '',
    recallId: '',
    recallNo: '',
    description: `Lot oluşturuldu. ${formatQuantity(lot.quantity || lot.receivedQuantity, lot.unit)} kabul edildi.`
  })
}

const createSampleEvent = (
  sample: QualitySample,
  index: ProductHistoryIndex
) => {
  const lot = index.lotMap.get(sample.inventoryLotId) || null
  const productionOrder = lot ? index.productionOrderMap.get(lot.productionOrderId) || null : null

  return createEvent({
    id: `product_history_sample_${sample.id}`,
    eventType: 'SAMPLE_COLLECTED',
    occurredAt: toOccurrenceIso(sample.createdAt, sample.sampleDate, 10),
    referenceNo: sample.sampleNo,
    productIds: lot ? unique([lot.productId || lot.stockItemId]) : [],
    productName: getLotProductName(lot, index),
    productionOrderId: lot?.productionOrderId || '',
    productionOrderNo: productionOrder?.workOrderNo || '',
    inventoryLotId: lot?.id || sample.inventoryLotId,
    lotNo: lot?.lotNo || '',
    qualitySampleId: sample.id,
    sampleNo: sample.sampleNo,
    witnessSampleId: '',
    witnessNo: '',
    recallId: '',
    recallNo: '',
    description: `Numune alındı. Tip: ${sample.sampleType}, durum: ${sample.status}.`
  })
}

const createWitnessSampleEvent = (
  witnessSample: WitnessSample,
  index: ProductHistoryIndex
) => {
  const sample = index.sampleMap.get(witnessSample.qualitySampleId) || null
  const lot = sample ? index.lotMap.get(sample.inventoryLotId) || null : null
  const productionOrder = lot ? index.productionOrderMap.get(lot.productionOrderId) || null : null

  return createEvent({
    id: `product_history_witness_${witnessSample.id}`,
    eventType: 'WITNESS_SAMPLE_CREATED',
    occurredAt: toOccurrenceIso(witnessSample.createdAt, witnessSample.storageStartDate, 11),
    referenceNo: witnessSample.witnessNo,
    productIds: lot ? unique([lot.productId || lot.stockItemId]) : [],
    productName: getLotProductName(lot, index),
    productionOrderId: lot?.productionOrderId || '',
    productionOrderNo: productionOrder?.workOrderNo || '',
    inventoryLotId: lot?.id || sample?.inventoryLotId || '',
    lotNo: lot?.lotNo || '',
    qualitySampleId: sample?.id || witnessSample.qualitySampleId,
    sampleNo: sample?.sampleNo || '',
    witnessSampleId: witnessSample.id,
    witnessNo: witnessSample.witnessNo,
    recallId: '',
    recallNo: '',
    description: `Şahit Numune oluşturuldu. Lokasyon: ${witnessSample.storageLocation}.`
  })
}

const createRecallEvent = (
  recall: ProductRecall,
  index: ProductHistoryIndex
) => {
  const lot = index.lotMap.get(recall.inventoryLotId) || null
  const productionOrder = lot ? index.productionOrderMap.get(lot.productionOrderId) || null : null

  return createEvent({
    id: `product_history_recall_${recall.id}`,
    eventType: 'RECALL_OPENED',
    occurredAt: toOccurrenceIso(recall.createdAt, recall.reportedDate, 13),
    referenceNo: recall.recallNo,
    productIds: lot ? unique([lot.productId || lot.stockItemId]) : [],
    productName: getLotProductName(lot, index),
    productionOrderId: lot?.productionOrderId || '',
    productionOrderNo: productionOrder?.workOrderNo || '',
    inventoryLotId: lot?.id || recall.inventoryLotId,
    lotNo: lot?.lotNo || '',
    qualitySampleId: '',
    sampleNo: '',
    witnessSampleId: '',
    witnessNo: '',
    recallId: recall.id,
    recallNo: recall.recallNo,
    description: `Recall başlatıldı. ${formatQuantity(recall.affectedQuantity, recall.unit)} etkilendi.`
  })
}

const flattenHACCPCCPs = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.criticalControlPoints.map(ccp => ({ plan: record, ccp })))

const flattenHACCPMonitoringRecords = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.monitoringRecords)

const flattenHACCPCorrectiveActions = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.correctiveActions)

const flattenHACCPVerificationRecords = (
  records: HACCPPlanRecord[]
) => records.flatMap(record => record.verificationRecords)

const createHACCPMaps = (
  records: HACCPPlanRecord[]
) => {
  const ccpEntries = flattenHACCPCCPs(records)
  const ccpMap = new Map<string, CriticalControlPoint>()
  const ccpPlanMap = new Map<string, HACCPPlanRecord>()

  ccpEntries.forEach(({ plan, ccp }) => {
    ccpMap.set(ccp.id, ccp)
    ccpPlanMap.set(ccp.id, plan)
  })

  return {
    ccpMap,
    ccpPlanMap,
    monitoringMap: new Map(flattenHACCPMonitoringRecords(records).map(record => [record.id, record])),
    correctiveActionMap: new Map(flattenHACCPCorrectiveActions(records).map(record => [record.id, record])),
    verificationMap: new Map(flattenHACCPVerificationRecords(records).map(record => [record.id, record]))
  }
}

const getHACCPProductIds = (
  monitoringRecord: MonitoringRecord,
  index: ProductHistoryIndex
) => {
  const lot = index.lotMap.get(monitoringRecord.inventoryLotId) || null
  return lot ? unique([lot.productId || lot.stockItemId]) : []
}

const createHACCPBaseFields = (
  monitoringRecord: MonitoringRecord,
  ccp: CriticalControlPoint | null,
  plan: HACCPPlanRecord | null,
  index: ProductHistoryIndex
) => {
  const lot = index.lotMap.get(monitoringRecord.inventoryLotId) || null
  const productionOrder = monitoringRecord.productionOrderId
    ? index.productionOrderMap.get(monitoringRecord.productionOrderId) || null
    : lot ? index.productionOrderMap.get(lot.productionOrderId) || null : null

  return {
    productIds: getHACCPProductIds(monitoringRecord, index),
    productName: getLotProductName(lot, index),
    productionOrderId: monitoringRecord.productionOrderId || lot?.productionOrderId || '',
    productionOrderNo: productionOrder?.workOrderNo || '',
    inventoryLotId: lot?.id || monitoringRecord.inventoryLotId,
    lotNo: lot?.lotNo || '',
    qualitySampleId: monitoringRecord.qualitySampleId,
    sampleNo: monitoringRecord.qualitySampleId ? index.sampleMap.get(monitoringRecord.qualitySampleId)?.sampleNo || '' : '',
    witnessSampleId: '',
    witnessNo: '',
    recallId: '',
    recallNo: '',
    haccpPlanId: plan?.id || '',
    criticalControlPointId: ccp?.id || '',
    monitoringRecordId: monitoringRecord.id
  }
}

const createHACCPMonitoringEvent = (
  monitoringRecord: MonitoringRecord,
  ccp: CriticalControlPoint | null,
  plan: HACCPPlanRecord | null,
  index: ProductHistoryIndex
) => createEvent({
  id: `product_history_haccp_monitoring_${monitoringRecord.id}`,
  eventType: 'HACCP_MONITORING',
  occurredAt: toOccurrenceIso(monitoringRecord.checkedAt, monitoringRecord.checkedAt, 12),
  referenceNo: monitoringRecord.id,
  ...createHACCPBaseFields(monitoringRecord, ccp, plan, index),
  description: `${ccp?.name || 'CCP'} monitoring kaydı oluşturuldu. Ölçüm: ${monitoringRecord.measuredValue}, limit: ${monitoringRecord.criticalLimit}, sonuç: ${monitoringRecord.result}.`
})

const createHACCPFailureEvent = (
  monitoringRecord: MonitoringRecord,
  ccp: CriticalControlPoint | null,
  plan: HACCPPlanRecord | null,
  index: ProductHistoryIndex
) => createEvent({
  id: `product_history_haccp_failure_${monitoringRecord.id}`,
  eventType: 'HACCP_FAILURE',
  occurredAt: toOccurrenceIso(monitoringRecord.checkedAt, monitoringRecord.checkedAt, 12),
  referenceNo: monitoringRecord.id,
  ...createHACCPBaseFields(monitoringRecord, ccp, plan, index),
  description: `${ccp?.name || 'CCP'} kritik limit sapması tespit edildi. Corrective Action zorunlu.`
})

const createHACCPCorrectiveActionEvent = (
  action: CorrectiveAction,
  monitoringRecord: MonitoringRecord,
  ccp: CriticalControlPoint | null,
  plan: HACCPPlanRecord | null,
  index: ProductHistoryIndex
) => createEvent({
  id: `product_history_haccp_action_${action.id}`,
  eventType: 'HACCP_CORRECTIVE_ACTION',
  occurredAt: toOccurrenceIso(action.completedAt, monitoringRecord.checkedAt, 14),
  referenceNo: action.id,
  ...createHACCPBaseFields(monitoringRecord, ccp, plan, index),
  correctiveActionId: action.id,
  description: `Corrective Action ${action.status}: ${action.description}`
})

const createHACCPVerificationEvent = (
  verificationRecord: VerificationRecord,
  monitoringRecord: MonitoringRecord,
  ccp: CriticalControlPoint | null,
  plan: HACCPPlanRecord | null,
  index: ProductHistoryIndex
) => createEvent({
  id: `product_history_haccp_verification_${verificationRecord.id}`,
  eventType: 'HACCP_VERIFIED',
  occurredAt: toOccurrenceIso(verificationRecord.verifiedAt, verificationRecord.verifiedAt, 15),
  referenceNo: verificationRecord.id,
  ...createHACCPBaseFields(monitoringRecord, ccp, plan, index),
  verificationRecordId: verificationRecord.id,
  description: `HACCP verification ${verificationRecord.result}: ${verificationRecord.notes || ccp?.name || 'CCP'}`
})

const createHACCPEvents = (
  records: HACCPPlanRecord[],
  index: ProductHistoryIndex
) => {
  const haccpMaps = createHACCPMaps(records)
  const events: ProductHistoryEvent[] = []

  flattenHACCPMonitoringRecords(records).forEach(monitoringRecord => {
    const ccp = haccpMaps.ccpMap.get(monitoringRecord.ccpId) || null
    const plan = ccp ? haccpMaps.ccpPlanMap.get(ccp.id) || null : null
    events.push(createHACCPMonitoringEvent(monitoringRecord, ccp, plan, index))
    if(monitoringRecord.result === 'FAIL'){
      events.push(createHACCPFailureEvent(monitoringRecord, ccp, plan, index))
    }
  })

  flattenHACCPCorrectiveActions(records).forEach(action => {
    const monitoringRecord = haccpMaps.monitoringMap.get(action.monitoringRecordId)
    if(!monitoringRecord) return
    const ccp = haccpMaps.ccpMap.get(monitoringRecord.ccpId) || null
    const plan = ccp ? haccpMaps.ccpPlanMap.get(ccp.id) || null : null
    events.push(createHACCPCorrectiveActionEvent(action, monitoringRecord, ccp, plan, index))
  })

  flattenHACCPVerificationRecords(records).forEach(verificationRecord => {
    const monitoringRecord = haccpMaps.monitoringMap.get(verificationRecord.monitoringRecordId)
    if(!monitoringRecord) return
    const ccp = haccpMaps.ccpMap.get(monitoringRecord.ccpId) || null
    const plan = ccp ? haccpMaps.ccpPlanMap.get(ccp.id) || null : null
    events.push(createHACCPVerificationEvent(verificationRecord, monitoringRecord, ccp, plan, index))
  })

  return events
}

const sortEvents = (events: ProductHistoryEvent[]) => (
  [...events].sort((firstEvent, secondEvent) => {
    const firstTime = new Date(firstEvent.occurredAt).getTime()
    const secondTime = new Date(secondEvent.occurredAt).getTime()
    if(firstTime !== secondTime) return firstTime - secondTime
    return firstEvent.referenceNo.localeCompare(secondEvent.referenceNo, 'tr')
  })
)

const createProductOptions = (
  events: ProductHistoryEvent[],
  index: ProductHistoryIndex
) => {
  const optionMap = new Map<string, ProductHistoryProductReference>()

  events.forEach(event => {
    event.productIds.forEach(productId => {
      if(optionMap.has(productId)) return
      optionMap.set(productId, createProductOption(productId, getProductName(productId, index, event.productName)))
    })
  })

  return Array.from(optionMap.values())
    .sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name, 'tr'))
}

export const buildProductHistoryTimeline = (
  input: ProductHistoryBuildInput
): ProductHistoryBuildResult => {
  const index = createIndex(input)
  const productByNameMap = createProductByNameMap(input.products)
  const events = sortEvents([
    ...input.productionOrders.map(order => createProductionOrderEvent(order, index, productByNameMap)),
    ...input.inventoryLots.map(lot => createLotEvent(lot, index)),
    ...input.qualitySamples.map(sample => createSampleEvent(sample, index)),
    ...input.witnessSamples.map(witnessSample => createWitnessSampleEvent(witnessSample, index)),
    ...input.recalls.map(recall => createRecallEvent(recall, index)),
    ...createHACCPEvents(input.haccpRecords, index)
  ])

  return {
    events,
    index,
    productOptions: createProductOptions(events, index)
  }
}
