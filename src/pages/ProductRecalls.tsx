import React from 'react'
import * as XLSX from 'xlsx'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import {
  PRODUCT_RECALL_ACTION_LABELS,
  PRODUCT_RECALL_ACTION_TYPES,
  PRODUCT_RECALL_PRIORITIES,
  PRODUCT_RECALL_PRIORITY_LABELS,
  PRODUCT_RECALL_REASON_LABELS,
  PRODUCT_RECALL_REASONS,
  PRODUCT_RECALL_RISK_LEVEL_LABELS,
  PRODUCT_RECALL_RISK_LEVELS,
  PRODUCT_RECALL_STATUS_LABELS,
  PRODUCT_RECALL_STATUSES,
  PRODUCT_RECALL_TIMELINE_LABELS,
  PRODUCT_RECALL_TYPE_LABELS,
  PRODUCT_RECALL_TYPES,
  createProductRecallRecord,
  getNextProductRecallNo,
  loadProductRecallRecords,
  saveProductRecallRecords,
  validateProductRecallInput
} from '../product-recalls/product-recall.mock'
import type { ProductRecallInput } from '../product-recalls/product-recall.mock'
import type {
  ProductRecall,
  ProductRecallActionLog,
  ProductRecallActionType,
  ProductRecallImpactAnalysis,
  ProductRecallPriority,
  ProductRecallReason,
  ProductRecallRelatedRecord,
  ProductRecallRiskLevel,
  ProductRecallStatus,
  ProductRecallTimelineEvent,
  ProductRecallTimelineStage,
  ProductRecallTraceability,
  ProductRecallType
} from '../product-recalls/product-recall.types'
import type { Branch, StockUnit, User } from '../types'

type RecallFilters = {
  status: ProductRecallStatus | 'all'
  recallType: ProductRecallType | 'all'
  riskLevel: ProductRecallRiskLevel | 'all'
  productId: string
  lotId: string
  branchId: string
  warehouseId: string
  customerId: string
  date: string
  search: string
}

type Message = {
  type: 'success' | 'error'
  text: string
}

type RecallRow = {
  record: ProductRecall
  traceability: ProductRecallTraceability
  impact: ProductRecallImpactAnalysis
  lot: InventoryLot | null
  productName: string
  branchName: string
  warehouseName: string
  customerNames: string
}

type ChartRow = {
  id: string
  label: string
  value: number
  formattedValue: string
  detail: string
}

type TrendPoint = {
  id: string
  label: string
  value: number
}

type ActionForm = {
  actionType: ProductRecallActionType
  actorName: string
  actionDate: string
  actionTime: string
  description: string
}

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const CLOSED_STATUSES: ProductRecallStatus[] = ['COMPLETED', 'CANCELLED']

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const toSearchText = (value: unknown) => String(value || '')
  .trim()
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const parseSafeDate = (value: string) => {
  if(!value) return null
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const formatDate = (value: string) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '-'
}

const formatDateTime = (value: string) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    : '-'
}

const formatQuantity = (value: number, unit: string) => (
  `${formatNumber(Number.isFinite(value) ? value : 0, 3)} ${unit}`
)

const escapeHtml = (value: string | number | boolean) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const createRelatedRecord = (
  type: ProductRecallRelatedRecord['type'],
  id: string,
  no: string,
  name: string,
  detail = '',
  status = ''
): ProductRecallRelatedRecord => ({ id, type, no, name, detail, status })

const uniqueById = <T extends { id: string; no?: string }>(items: T[]) => {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.id || item.no || ''
    if(!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const emptyTraceability = (): ProductRecallTraceability => ({
  products: [],
  lots: [],
  subLots: [],
  rawMaterials: [],
  recipes: [],
  productionOrders: [],
  productionCenters: [],
  branches: [],
  warehouses: [],
  shipments: [],
  deliveries: [],
  customers: [],
  samples: [],
  witnessSamples: [],
  qualityForms: [],
  haccpRecords: []
})

const getBranchName = (branchMap: Map<string, Branch>, branchId: string, fallback = '-') => (
  branchMap.get(branchId)?.name || fallback
)

const getProductName = (
  lot: InventoryLot | null,
  sourceData: KpiSourceData
) => {
  if(!lot) return '-'
  return sourceData.productRefs.find(product => product.id === lot.productId)?.name
    || sourceData.stockItems.find(item => item.id === lot.stockItemId)?.name
    || lot.productId
    || lot.stockItemId
    || '-'
}

const createTraceabilityView = (
  record: ProductRecall,
  sourceData: KpiSourceData
) => {
  const base = record.traceability || emptyTraceability()
  const branchMap = new Map(sourceData.branches.map(branch => [branch.id, branch]))
  const lot = sourceData.inventoryLots.find(item => item.id === record.inventoryLotId) || null
  const productName = getProductName(lot, sourceData)
  const relatedShipments = sourceData.shipments.filter(shipment => (
    shipment.items.some(item => item.inventoryLotId === record.inventoryLotId)
  ))
  const shipmentRecords = relatedShipments.map(shipment => createRelatedRecord(
    'SHIPMENT',
    shipment.id,
    shipment.shipmentNo,
    shipment.shipmentNo,
    `${formatDate(shipment.shipmentDate)} / ${getBranchName(branchMap, shipment.destinationBranchId, shipment.destinationBranchId)}`,
    shipment.status
  ))
  const customerRecords = relatedShipments.map(shipment => createRelatedRecord(
    'CUSTOMER',
    shipment.destinationBranchId,
    shipment.destinationBranchId,
    getBranchName(branchMap, shipment.destinationBranchId, shipment.destinationBranchId),
    'Sevkiyat hedef müşterisi',
    shipment.status
  ))
  const deliveryRecords = relatedShipments.map(shipment => createRelatedRecord(
    'DELIVERY',
    `delivery_${shipment.id}`,
    `TES-${shipment.shipmentNo}`,
    getBranchName(branchMap, shipment.destinationBranchId, 'Teslimat'),
    formatDate(shipment.plannedDeliveryDate),
    shipment.status
  ))
  const relatedSamples = sourceData.qualitySamples.filter(sample => sample.inventoryLotId === record.inventoryLotId)
  const sampleIds = new Set(relatedSamples.map(sample => sample.id))
  const witnessSamples = sourceData.witnessSamples.filter(sample => sampleIds.has(sample.qualitySampleId))
  const haccpRecords = sourceData.haccpRecords.flatMap(plan => (
    plan.monitoringRecords
      .filter(monitoring => monitoring.inventoryLotId === record.inventoryLotId || monitoring.productionOrderId === lot?.productionOrderId)
      .map(monitoring => createRelatedRecord(
        'HACCP_RECORD',
        monitoring.id,
        plan.code,
        plan.name,
        `${monitoring.criticalLimit} / ${formatDateTime(monitoring.checkedAt)}`,
        monitoring.result
      ))
  ))
  const recipes = sourceData.recipeRecords
    .filter(recipe => toSearchText(recipe.productName).includes(toSearchText(productName)) || toSearchText(productName).includes(toSearchText(recipe.productName)))
    .slice(0, 3)
    .map(recipe => createRelatedRecord('RECIPE', recipe.id, recipe.code, recipe.recipeName, `${recipe.portions} porsiyon`, recipe.status))
  const productionOrder = lot?.productionOrderId
    ? sourceData.productionOrders.find(order => order.id === lot.productionOrderId) || null
    : null

  return {
    products: uniqueById([
      ...base.products,
      ...(lot ? [createRelatedRecord('PRODUCT', lot.productId || lot.stockItemId, lot.productId || lot.stockItemId, productName, 'Lot ürün bağlantısı', 'Etkilendi')] : [])
    ]),
    lots: uniqueById([
      ...base.lots,
      ...(lot ? [createRelatedRecord('LOT', lot.id, lot.lotNo, lot.lotNo, `${formatQuantity(lot.remainingQuantity || lot.quantity || 0, lot.unit)} kalan`, lot.status)] : [])
    ]),
    subLots: uniqueById(base.subLots),
    rawMaterials: uniqueById(base.rawMaterials),
    recipes: uniqueById([...base.recipes, ...recipes]),
    productionOrders: uniqueById([
      ...base.productionOrders,
      ...(productionOrder ? [createRelatedRecord('PRODUCTION_ORDER', productionOrder.id, productionOrder.workOrderNo, productionOrder.workOrderNo, productionOrder.description, productionOrder.status)] : [])
    ]),
    productionCenters: uniqueById(base.productionCenters),
    branches: uniqueById([
      ...base.branches,
      ...(record.branchId ? [createRelatedRecord('BRANCH', record.branchId, record.branchId, getBranchName(branchMap, record.branchId, record.branchId), 'Recall operasyon şubesi', 'Aktif')] : [])
    ]),
    warehouses: uniqueById([
      ...base.warehouses,
      ...(record.warehouseId ? [createRelatedRecord('WAREHOUSE', record.warehouseId, record.warehouseId, getBranchName(branchMap, record.warehouseId, record.warehouseId), 'Depo / karantina lokasyonu', lot?.status || '')] : [])
    ]),
    shipments: uniqueById([...base.shipments, ...shipmentRecords]),
    deliveries: uniqueById([...base.deliveries, ...deliveryRecords]),
    customers: uniqueById([...base.customers, ...customerRecords]),
    samples: uniqueById([
      ...base.samples,
      ...relatedSamples.map(sample => createRelatedRecord('SAMPLE', sample.id, sample.sampleNo, sample.sampleNo, `${formatDate(sample.sampleDate)} / ${sample.takenBy}`, sample.status))
    ]),
    witnessSamples: uniqueById([
      ...base.witnessSamples,
      ...witnessSamples.map(sample => createRelatedRecord('WITNESS_SAMPLE', sample.id, sample.witnessNo, sample.witnessNo, `${sample.storageLocation} / ${formatDate(sample.storageEndDate)}`, sample.status))
    ]),
    qualityForms: uniqueById(base.qualityForms),
    haccpRecords: uniqueById([...base.haccpRecords, ...haccpRecords])
  }
}

const createImpactView = (
  record: ProductRecall,
  traceability: ProductRecallTraceability
): ProductRecallImpactAnalysis => ({
  affectedProductCount: Math.max(record.impactAnalysis.affectedProductCount, traceability.products.length),
  affectedLotCount: Math.max(record.impactAnalysis.affectedLotCount, traceability.lots.length + traceability.subLots.length),
  affectedCustomerCount: Math.max(record.impactAnalysis.affectedCustomerCount, traceability.customers.length),
  affectedShipmentCount: Math.max(record.impactAnalysis.affectedShipmentCount, traceability.shipments.length),
  affectedWarehouseCount: Math.max(record.impactAnalysis.affectedWarehouseCount, traceability.warehouses.length),
  affectedProductionOrderCount: Math.max(record.impactAnalysis.affectedProductionOrderCount, traceability.productionOrders.length),
  affectedRecipeCount: Math.max(record.impactAnalysis.affectedRecipeCount, traceability.recipes.length),
  averageCompletionDays: record.impactAnalysis.averageCompletionDays,
  successRate: record.impactAnalysis.successRate
})

const createRows = (
  records: ProductRecall[],
  sourceData: KpiSourceData
): RecallRow[] => {
  const branchMap = new Map(sourceData.branches.map(branch => [branch.id, branch]))
  return records.map(record => {
    const lot = sourceData.inventoryLots.find(item => item.id === record.inventoryLotId) || null
    const traceability = createTraceabilityView(record, sourceData)
    const impact = createImpactView(record, traceability)
    return {
      record,
      traceability,
      impact,
      lot,
      productName: traceability.products[0]?.name || getProductName(lot, sourceData),
      branchName: getBranchName(branchMap, record.branchId, traceability.branches[0]?.name || '-'),
      warehouseName: getBranchName(branchMap, record.warehouseId, traceability.warehouses[0]?.name || '-'),
      customerNames: traceability.customers.map(customer => customer.name).join(', ')
    }
  })
}

const getStatusClass = (status: ProductRecallStatus) => {
  if(status === 'COMPLETED') return 'success'
  if(status === 'CANCELLED') return 'muted-pill'
  if(status === 'DRAFT') return 'info-pill'
  if(status === 'REVIEWING' || status === 'APPROVED') return 'warning-pill'
  return 'danger-pill'
}

const getRiskClass = (riskLevel: ProductRecallRiskLevel) => {
  if(riskLevel === 'CRITICAL') return 'danger-pill'
  if(riskLevel === 'HIGH') return 'warning-pill'
  if(riskLevel === 'MEDIUM') return 'info-pill'
  return 'muted-pill'
}

const getPriorityClass = (priority: ProductRecallPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'info-pill'
  return 'muted-pill'
}

const createEmptyForm = (
  records: ProductRecall[],
  sourceData: KpiSourceData,
  currentUser: User
): ProductRecallInput => {
  const lot = sourceData.inventoryLots[0] || null
  const userName = getUserName(currentUser)
  const quantity = Math.max(0.001, Math.round(((lot?.remainingQuantity || lot?.quantity || 1) * 0.12) * 1000) / 1000)
  const reportedDate = todayKey()

  return {
    recallNo: getNextProductRecallNo(records),
    recallType: 'LOT',
    inventoryLotId: lot?.id || '',
    reason: 'OTHER',
    riskLevel: 'MEDIUM',
    priority: 'NORMAL',
    status: 'DRAFT',
    affectedQuantity: quantity,
    unit: lot?.unit || 'adet',
    reportedDate,
    startedAt: `${reportedDate}T09:00:00`,
    targetCompletionDate: addDays(reportedDate, 5),
    resolvedDate: '',
    description: '',
    riskAnalysis: '',
    initiatedBy: userName,
    responsiblePerson: userName,
    createdBy: userName,
    branchId: lot?.warehouseId || '',
    warehouseId: lot?.warehouseId || '',
    supplierId: lot?.supplierId || ''
  }
}

const addDays = (dateValue: string, dayCount: number) => {
  const date = parseSafeDate(dateValue) || new Date()
  date.setDate(date.getDate() + dayCount)
  return date.toLocaleDateString('sv-SE')
}

const createFormFromRecall = (record: ProductRecall): ProductRecallInput => ({
  recallNo: record.recallNo,
  recallType: record.recallType,
  inventoryLotId: record.inventoryLotId,
  reason: record.reason,
  riskLevel: record.riskLevel,
  priority: record.priority,
  status: record.status,
  affectedQuantity: record.affectedQuantity,
  unit: record.unit,
  reportedDate: record.reportedDate,
  startedAt: record.startedAt,
  targetCompletionDate: record.targetCompletionDate,
  resolvedDate: record.resolvedDate,
  description: record.description,
  riskAnalysis: record.riskAnalysis,
  initiatedBy: record.initiatedBy,
  responsiblePerson: record.responsiblePerson,
  createdBy: record.createdBy,
  branchId: record.branchId,
  warehouseId: record.warehouseId,
  supplierId: record.supplierId
})

const createDefaultFilters = (): RecallFilters => ({
  status: ALL_FILTER,
  recallType: ALL_FILTER,
  riskLevel: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  customerId: ALL_FILTER,
  date: '',
  search: ''
})

const createDefaultActionForm = (userName: string): ActionForm => {
  const now = new Date()
  return {
    actionType: 'QUARANTINED',
    actorName: userName,
    actionDate: now.toLocaleDateString('sv-SE'),
    actionTime: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    description: ''
  }
}

const getTimelineStageForStatus = (status: ProductRecallStatus): ProductRecallTimelineStage => {
  if(status === 'REVIEWING') return 'SENT_FOR_APPROVAL'
  if(status === 'APPROVED') return 'APPROVED'
  if(status === 'IN_OPERATION') return 'OPERATION_STARTED'
  if(status === 'COMPLETED' || status === 'CANCELLED') return 'CLOSED'
  return 'CREATED'
}

const createTimelineEvent = (
  recallId: string,
  status: ProductRecallStatus,
  actorName: string,
  description: string
): ProductRecallTimelineEvent => {
  const stage = getTimelineStageForStatus(status)
  return {
    id: `${recallId}_timeline_${Date.now()}`,
    recallId,
    stage,
    title: PRODUCT_RECALL_TIMELINE_LABELS[stage],
    description,
    actorName,
    occurredAt: new Date().toISOString()
  }
}

const isClosed = (status: ProductRecallStatus) => CLOSED_STATUSES.includes(status)

const aggregateRows = (
  rows: RecallRow[],
  getKey: (row: RecallRow) => string,
  getLabel: (row: RecallRow) => string,
  getValue: (row: RecallRow) => number = () => 1,
  formatter: (value: number) => string = value => formatNumber(value)
): ChartRow[] => {
  const groups = rows.reduce<Map<string, { label: string; value: number }>>((map, row) => {
    const key = getKey(row)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(row),
      value: (previous?.value || 0) + getValue(row)
    })
    return map
  }, new Map())

  return Array.from(groups.entries())
    .map(([id, group]) => ({
      id,
      label: group.label,
      value: group.value,
      formattedValue: formatter(group.value),
      detail: `${formatter(group.value)} kayıt`
    }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, 8)
}

const createTrendRows = (rows: RecallRow[]): TrendPoint[] => {
  const groups = rows.reduce<Map<string, number>>((map, row) => {
    const key = (row.record.reportedDate || row.record.createdAt || '').slice(0, 7) || 'Tarihsiz'
    map.set(key, (map.get(key) || 0) + 1)
    return map
  }, new Map())

  return Array.from(groups.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([id, value]) => ({ id, label: id, value }))
}

const getAverage = (values: number[]) => {
  const validValues = values.filter(value => Number.isFinite(value))
  if(validValues.length === 0) return 0
  return validValues.reduce((total, value) => total + value, 0) / validValues.length
}

const mapRowsForOutput = (rows: RecallRow[]) => rows.map(row => ({
  'Recall No': row.record.recallNo,
  'Recall Türü': PRODUCT_RECALL_TYPE_LABELS[row.record.recallType],
  Başlatan: row.record.initiatedBy,
  'Başlatılma Tarihi': formatDate(row.record.reportedDate),
  Öncelik: PRODUCT_RECALL_PRIORITY_LABELS[row.record.priority],
  Durum: PRODUCT_RECALL_STATUS_LABELS[row.record.status],
  'Risk Seviyesi': PRODUCT_RECALL_RISK_LEVEL_LABELS[row.record.riskLevel],
  Ürün: row.productName,
  Lot: row.lot?.lotNo || row.record.inventoryLotId,
  Şube: row.branchName,
  Depo: row.warehouseName,
  'Etkilenen Müşteri Sayısı': row.impact.affectedCustomerCount,
  'Etkilenen Sevkiyat Sayısı': row.impact.affectedShipmentCount,
  Sebep: PRODUCT_RECALL_REASON_LABELS[row.record.reason],
  Açıklama: row.record.description,
  'Risk Analizi': row.record.riskAnalysis,
  Sorumlu: row.record.responsiblePerson,
  'Açık Aksiyon': row.record.actionLogs.filter(action => action.isOpen).length,
  'Son İşlem': row.record.lastActionSummary,
  'Hedef Tamamlanma': formatDate(row.record.targetCompletionDate),
  'Tamamlanma': formatDate(row.record.resolvedDate)
}))

const exportRowsToExcel = (rows: RecallRow[]) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(mapRowsForOutput(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtreli Recall')
  XLSX.writeFile(workbook, `recall-management-filtreli-${todayKey()}.xlsx`)
}

const createPrintHtml = (rows: RecallRow[], mode: 'A4' | 'PDF') => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Recall Management - Filtreli Liste</title>
  <style>
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:#111827; font-family:Inter, Arial, sans-serif; background:#f8fafc; }
    .sheet { max-width:1320px; margin:0 auto; padding:22px; border:1px solid #d1d5db; border-radius:8px; background:#fff; }
    .header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:14px; margin-bottom:16px; }
    h1 { margin:0; font-size:22px; line-height:1.2; }
    .muted { color:#64748b; font-size:12px; font-weight:700; }
    .pill { display:inline-block; border:1px solid #d1d5db; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; }
    table { width:100%; border-collapse:collapse; font-size:10.5px; }
    th, td { border:1px solid #e5e7eb; padding:7px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; font-weight:900; }
    @media print {
      body { background:#fff; padding:0; }
      .sheet { border:0; border-radius:0; max-width:none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <span class="muted">Kalite ve İzlenebilirlik</span>
        <h1>Recall Management - Filtreli Liste</h1>
        <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
      <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazırlık' : `${rows.length} kayıt`)}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Recall No</th><th>Tür</th><th>Başlatan</th><th>Tarih</th><th>Öncelik</th><th>Durum</th><th>Risk</th><th>Ürün</th><th>Lot</th><th>Şube</th><th>Depo</th><th>Müşteri</th><th>Sevkiyat</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.record.recallNo)}</td>
            <td>${escapeHtml(PRODUCT_RECALL_TYPE_LABELS[row.record.recallType])}</td>
            <td>${escapeHtml(row.record.initiatedBy)}</td>
            <td>${escapeHtml(formatDate(row.record.reportedDate))}</td>
            <td>${escapeHtml(PRODUCT_RECALL_PRIORITY_LABELS[row.record.priority])}</td>
            <td>${escapeHtml(PRODUCT_RECALL_STATUS_LABELS[row.record.status])}</td>
            <td>${escapeHtml(PRODUCT_RECALL_RISK_LEVEL_LABELS[row.record.riskLevel])}</td>
            <td>${escapeHtml(row.productName)}</td>
            <td>${escapeHtml(row.lot?.lotNo || row.record.inventoryLotId)}</td>
            <td>${escapeHtml(row.branchName)}</td>
            <td>${escapeHtml(row.warehouseName)}</td>
            <td>${escapeHtml(row.impact.affectedCustomerCount)}</td>
            <td>${escapeHtml(row.impact.affectedShipmentCount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`

const openPrintWindow = (rows: RecallRow[], mode: 'A4' | 'PDF') => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900')
  if(!popup) throw new Error('Çıktı penceresi açılamadı. Tarayıcı pop-up iznini kontrol edin.')
  popup.document.write(createPrintHtml(rows, mode))
  popup.document.close()
  popup.focus()
  popup.print()
}

export default function ProductRecalls({ currentUser }: { currentUser: User }){
  const sourceData = React.useMemo(() => loadKpiSourceData(), [])
  const userName = getUserName(currentUser)
  const [records, setRecords] = React.useState<ProductRecall[]>(() => loadProductRecallRecords(sourceData.inventoryLots))
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [filters, setFilters] = React.useState<RecallFilters>(() => createDefaultFilters())
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create')
  const [form, setForm] = React.useState<ProductRecallInput>(() => createEmptyForm(records, sourceData, currentUser))
  const [formError, setFormError] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [actionForm, setActionForm] = React.useState<ActionForm>(() => createDefaultActionForm(userName))

  const branchMap = React.useMemo(() => new Map(sourceData.branches.map(branch => [branch.id, branch])), [sourceData])
  const lotMap = React.useMemo(() => new Map(sourceData.inventoryLots.map(lot => [lot.id, lot])), [sourceData])
  const allRows = React.useMemo(() => createRows(records, sourceData), [records, sourceData])
  const visibleRows = React.useMemo(() => {
    const search = toSearchText(filters.search)
    return allRows.filter(row => {
      const record = row.record
      const productIds = row.traceability.products.map(product => product.id)
      const lotIds = [...row.traceability.lots, ...row.traceability.subLots].map(lot => lot.id)
      const branchIds = row.traceability.branches.map(branch => branch.id)
      const warehouseIds = row.traceability.warehouses.map(warehouse => warehouse.id)
      const customerIds = row.traceability.customers.map(customer => customer.id)
      const searchFields = [
        record.recallNo,
        PRODUCT_RECALL_TYPE_LABELS[record.recallType],
        PRODUCT_RECALL_REASON_LABELS[record.reason],
        PRODUCT_RECALL_STATUS_LABELS[record.status],
        PRODUCT_RECALL_RISK_LEVEL_LABELS[record.riskLevel],
        row.productName,
        row.lot?.lotNo || record.inventoryLotId,
        row.branchName,
        row.warehouseName,
        row.customerNames,
        record.description,
        record.riskAnalysis,
        record.initiatedBy,
        record.responsiblePerson
      ]

      return (filters.status === ALL_FILTER || record.status === filters.status)
        && (filters.recallType === ALL_FILTER || record.recallType === filters.recallType)
        && (filters.riskLevel === ALL_FILTER || record.riskLevel === filters.riskLevel)
        && (filters.productId === ALL_FILTER || productIds.includes(filters.productId))
        && (filters.lotId === ALL_FILTER || lotIds.includes(filters.lotId) || record.inventoryLotId === filters.lotId)
        && (filters.branchId === ALL_FILTER || branchIds.includes(filters.branchId) || record.branchId === filters.branchId)
        && (filters.warehouseId === ALL_FILTER || warehouseIds.includes(filters.warehouseId) || record.warehouseId === filters.warehouseId)
        && (filters.customerId === ALL_FILTER || customerIds.includes(filters.customerId))
        && (!filters.date || record.reportedDate === filters.date || record.createdAt.slice(0, 10) === filters.date)
        && (!search || searchFields.some(field => toSearchText(field).includes(search)))
    })
  }, [allRows, filters])

  const selectedRow = React.useMemo(() => (
    visibleRows.find(row => row.record.id === selectedRecordId)
    || allRows.find(row => row.record.id === selectedRecordId)
    || visibleRows[0]
    || allRows[0]
    || null
  ), [allRows, selectedRecordId, visibleRows])
  const selectedRecord = selectedRow?.record || null

  React.useEffect(() => {
    if(selectedRecordId && allRows.some(row => row.record.id === selectedRecordId)) return
    setSelectedRecordId(allRows[0]?.record.id || '')
  }, [allRows, selectedRecordId])

  const productOptions = React.useMemo(() => uniqueById(allRows.flatMap(row => row.traceability.products)), [allRows])
  const lotOptions = React.useMemo(() => uniqueById(allRows.flatMap(row => [...row.traceability.lots, ...row.traceability.subLots])), [allRows])
  const branchOptions = React.useMemo(() => uniqueById(allRows.flatMap(row => row.traceability.branches)), [allRows])
  const warehouseOptions = React.useMemo(() => uniqueById(allRows.flatMap(row => row.traceability.warehouses)), [allRows])
  const customerOptions = React.useMemo(() => uniqueById(allRows.flatMap(row => row.traceability.customers)), [allRows])

  const stats = React.useMemo(() => {
    const completedRows = visibleRows.filter(row => row.record.status === 'COMPLETED')
    const closedRows = visibleRows.filter(row => row.record.status === 'COMPLETED' || row.record.status === 'CANCELLED')
    const totalCustomerCount = new Set(visibleRows.flatMap(row => row.traceability.customers.map(customer => customer.id))).size
    const totalLotCount = new Set(visibleRows.flatMap(row => [...row.traceability.lots, ...row.traceability.subLots].map(lot => lot.id))).size
    return {
      totalRecall: visibleRows.length,
      openRecall: visibleRows.filter(row => !isClosed(row.record.status)).length,
      completedRecall: completedRows.length,
      criticalRecall: visibleRows.filter(row => row.record.riskLevel === 'CRITICAL').length,
      affectedCustomer: totalCustomerCount,
      affectedLot: totalLotCount,
      averageCompletionDays: getAverage(completedRows.map(row => row.impact.averageCompletionDays)),
      successRate: closedRows.length > 0 ? (completedRows.length / closedRows.length) * 100 : 0
    }
  }, [visibleRows])

  const chartData = React.useMemo(() => ({
    typeRows: aggregateRows(visibleRows, row => row.record.recallType, row => PRODUCT_RECALL_TYPE_LABELS[row.record.recallType]),
    riskRows: aggregateRows(visibleRows, row => row.record.riskLevel, row => PRODUCT_RECALL_RISK_LEVEL_LABELS[row.record.riskLevel]),
    statusRows: aggregateRows(visibleRows, row => row.record.status, row => PRODUCT_RECALL_STATUS_LABELS[row.record.status]),
    productRows: aggregateRows(visibleRows, row => row.traceability.products[0]?.id || row.productName, row => row.productName),
    lotRows: aggregateRows(visibleRows, row => row.lot?.id || row.record.inventoryLotId, row => row.lot?.lotNo || row.record.inventoryLotId),
    completionRows: aggregateRows(
      visibleRows.filter(row => row.impact.averageCompletionDays > 0),
      row => row.record.recallType,
      row => PRODUCT_RECALL_TYPE_LABELS[row.record.recallType],
      row => row.impact.averageCompletionDays,
      value => `${formatNumber(value, 1)} gün`
    ),
    successRows: [
      {
        id: 'completed',
        label: 'Başarılı',
        value: visibleRows.filter(row => row.record.status === 'COMPLETED').length,
        formattedValue: formatNumber(visibleRows.filter(row => row.record.status === 'COMPLETED').length),
        detail: 'Tamamlanan recall'
      },
      {
        id: 'cancelled',
        label: 'İptal',
        value: visibleRows.filter(row => row.record.status === 'CANCELLED').length,
        formattedValue: formatNumber(visibleRows.filter(row => row.record.status === 'CANCELLED').length),
        detail: 'İptal edilen recall'
      },
      {
        id: 'active',
        label: 'Açık',
        value: visibleRows.filter(row => !isClosed(row.record.status)).length,
        formattedValue: formatNumber(visibleRows.filter(row => !isClosed(row.record.status)).length),
        detail: 'Devam eden süreç'
      }
    ],
    monthlyTrend: createTrendRows(visibleRows)
  }), [visibleRows])

  const commitRecords = (nextRecords: ProductRecall[], nextSelectedId = selectedRecordId) => {
    setRecords(nextRecords)
    saveProductRecallRecords(nextRecords)
    setSelectedRecordId(nextSelectedId)
  }

  const updateFilter = <TKey extends keyof RecallFilters>(key: TKey, value: RecallFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const startCreate = () => {
    setFormMode('create')
    setFormError('')
    setMessage(null)
    setForm(createEmptyForm(records, sourceData, currentUser))
  }

  const startEdit = (record: ProductRecall) => {
    setFormMode('edit')
    setFormError('')
    setMessage(null)
    setSelectedRecordId(record.id)
    setForm(createFormFromRecall(record))
  }

  const handleLotChange = (inventoryLotId: string) => {
    const lot = lotMap.get(inventoryLotId) || null
    setForm(prev => ({
      ...prev,
      inventoryLotId,
      affectedQuantity: prev.affectedQuantity > 0 ? prev.affectedQuantity : Math.max(0.001, (lot?.remainingQuantity || lot?.quantity || 1) * 0.12),
      unit: lot?.unit || prev.unit,
      branchId: lot?.warehouseId || prev.branchId,
      warehouseId: lot?.warehouseId || prev.warehouseId,
      supplierId: lot?.supplierId || prev.supplierId
    }))
  }

  const saveForm = () => {
    const validationError = validateProductRecallInput(
      form,
      lotMap,
      records,
      formMode === 'edit' ? selectedRecord?.id || '' : ''
    )
    if(validationError){
      setFormError(validationError)
      return
    }

    const nextRecord = createProductRecallRecord(form, formMode === 'edit' ? selectedRecord || undefined : undefined)
    const nextRecords = formMode === 'edit' && selectedRecord
      ? records.map(record => record.id === selectedRecord.id ? nextRecord : record)
      : [nextRecord, ...records]

    commitRecords(nextRecords, nextRecord.id)
    setFormMode('edit')
    setForm(createFormFromRecall(nextRecord))
    setFormError('')
    setMessage({ type: 'success', text: `${nextRecord.recallNo} recall kaydı ${formMode === 'edit' ? 'güncellendi' : 'oluşturuldu'}.` })
  }

  const changeStatus = (record: ProductRecall, status: ProductRecallStatus) => {
    const resolvedDate = status === 'COMPLETED' && !record.resolvedDate ? todayKey() : record.resolvedDate
    const timelineEvent = createTimelineEvent(record.id, status, userName, `${record.recallNo} ${PRODUCT_RECALL_STATUS_LABELS[status]} durumuna alındı.`)
    const nextRecord: ProductRecall = {
      ...record,
      status,
      resolvedDate,
      timeline: [...record.timeline, timelineEvent],
      impactAnalysis: {
        ...record.impactAnalysis,
        averageCompletionDays: status === 'COMPLETED' ? Math.max(1, record.impactAnalysis.averageCompletionDays || 1) : record.impactAnalysis.averageCompletionDays,
        successRate: status === 'COMPLETED' ? 100 : status === 'CANCELLED' ? 0 : record.impactAnalysis.successRate
      },
      lastActionSummary: timelineEvent.description,
      updatedAt: new Date().toISOString()
    }
    const nextRecords = records.map(item => item.id === record.id ? nextRecord : item)
    commitRecords(nextRecords, record.id)
    if(formMode === 'edit' && form.recallNo === record.recallNo) setForm(createFormFromRecall(nextRecord))
    setMessage({ type: 'success', text: `${record.recallNo} durumu ${PRODUCT_RECALL_STATUS_LABELS[status]} olarak güncellendi.` })
  }

  const addActionLog = () => {
    if(!selectedRecord) return
    const log: ProductRecallActionLog = {
      id: `${selectedRecord.id}_action_${Date.now()}`,
      recallId: selectedRecord.id,
      actionType: actionForm.actionType,
      actorName: actionForm.actorName.trim() || userName,
      actionDate: actionForm.actionDate || todayKey(),
      actionTime: actionForm.actionTime || '09:00',
      description: actionForm.description.trim() || PRODUCT_RECALL_ACTION_LABELS[actionForm.actionType],
      isOpen: false,
      createdAt: `${actionForm.actionDate || todayKey()}T${actionForm.actionTime || '09:00'}:00.000Z`
    }
    const timelineEvent = createTimelineEvent(selectedRecord.id, selectedRecord.status, log.actorName, log.description)
    const nextRecord: ProductRecall = {
      ...selectedRecord,
      actionLogs: [log, ...selectedRecord.actionLogs],
      timeline: [...selectedRecord.timeline, timelineEvent],
      lastActionSummary: log.description,
      updatedAt: new Date().toISOString()
    }
    commitRecords(records.map(record => record.id === selectedRecord.id ? nextRecord : record), selectedRecord.id)
    setActionForm(createDefaultActionForm(userName))
    setMessage({ type: 'success', text: `${selectedRecord.recallNo} için aksiyon loglandı.` })
  }

  const outputRows = (action: 'EXCEL' | 'PDF' | 'PRINTED') => {
    try{
      if(action === 'EXCEL') exportRowsToExcel(visibleRows)
      if(action === 'PDF') openPrintWindow(visibleRows, 'PDF')
      if(action === 'PRINTED') openPrintWindow(visibleRows, 'A4')
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${formatNumber(visibleRows.length)} satırlık filtreli liste Excel çıktısına aktarıldı.`
          : `${formatNumber(visibleRows.length)} satırlık filtreli liste çıktı penceresinde açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Çıktı alınamadı.' })
    }
  }

  return (
    <div className="product-recall-page">
      <div className="page-header">
        <div>
          <h2>Geri Çağırma (Recall Management)</h2>
          <p className="muted">Kalite ve İzlenebilirlik sistemi recall süreçlerini izler ve yönetir; otomatik stok hareketi, muhasebe kaydı veya sevkiyat iptali oluşturmaz.</p>
        </div>
        <div className="product-recall-header-actions">
          <span className="status-pill warning-pill">Süreç yönetimi</span>
          <button className="btn primary" type="button" onClick={startCreate}>Yeni Recall</button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid product-recall-metric-grid">
        <div className="metric-card"><span>Toplam Recall</span><strong>{formatNumber(stats.totalRecall)}</strong><small>Filtrelenmiş kayıt</small></div>
        <div className="metric-card warning"><span>Açık Recall</span><strong>{formatNumber(stats.openRecall)}</strong><small>Tamamlanmamış süreç</small></div>
        <div className="metric-card success"><span>Tamamlanan Recall</span><strong>{formatNumber(stats.completedRecall)}</strong><small>Başarıyla kapatılan</small></div>
        <div className="metric-card danger"><span>Kritik Recall</span><strong>{formatNumber(stats.criticalRecall)}</strong><small>CRITICAL risk</small></div>
        <div className="metric-card"><span>Etkilenen Müşteri</span><strong>{formatNumber(stats.affectedCustomer)}</strong><small>İzlenebilirlik ağından</small></div>
        <div className="metric-card"><span>Etkilenen Lot</span><strong>{formatNumber(stats.affectedLot)}</strong><small>Lot ve alt lot</small></div>
        <div className="metric-card"><span>Ortalama Tamamlama Süresi</span><strong>{formatNumber(stats.averageCompletionDays, 1)} gün</strong><small>Tamamlanan kayıtlar</small></div>
        <div className="metric-card success"><span>Recall Başarı Oranı</span><strong>{formatPercent(stats.successRate)}</strong><small>Tamamlandı / kapandı</small></div>
      </div>

      <section className="card product-recall-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler ve Çıktılar</h3>
            <p className="muted">Filtreli Excel, PDF, yazdır ve liste çıktıları yalnızca raporlama sağlar.</p>
          </div>
          <div className="product-recall-output-actions">
            <button className="btn" type="button" onClick={() => outputRows('EXCEL')}>Excel</button>
            <button className="btn" type="button" onClick={() => outputRows('PDF')}>PDF</button>
            <button className="btn" type="button" onClick={() => outputRows('PRINTED')}>Yazdır</button>
            <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters())}>Temizle</button>
          </div>
        </div>
        <div className="product-recall-filter-grid">
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as RecallFilters['status'])}>
              <option value={ALL_FILTER}>Tüm Durumlar</option>
              {PRODUCT_RECALL_STATUSES.map(status => <option key={status} value={status}>{PRODUCT_RECALL_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Recall Türü</span>
            <select value={filters.recallType} onChange={event => updateFilter('recallType', event.target.value as RecallFilters['recallType'])}>
              <option value={ALL_FILTER}>Tüm Türler</option>
              {PRODUCT_RECALL_TYPES.map(type => <option key={type} value={type}>{PRODUCT_RECALL_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.riskLevel} onChange={event => updateFilter('riskLevel', event.target.value as RecallFilters['riskLevel'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {PRODUCT_RECALL_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{PRODUCT_RECALL_RISK_LEVEL_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Ürün</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Ürünler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Lotlar</option>
              {lotOptions.map(option => <option key={option.id} value={option.id}>{option.no || option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Müşteri</span>
            <select value={filters.customerId} onChange={event => updateFilter('customerId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Müşteriler</option>
              {customerOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field product-recall-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Recall no, ürün, lot, müşteri, sebep, risk analizi" />
          </label>
        </div>
      </section>

      <div className="product-recall-chart-grid">
        <BarChartCard title="Recall Türü Dağılımı" rows={chartData.typeRows} />
        <BarChartCard title="Risk Dağılımı" rows={chartData.riskRows} />
        <BarChartCard title="Durum Dağılımı" rows={chartData.statusRows} />
        <TrendChartCard title="Aylık Recall Trendleri" rows={chartData.monthlyTrend} />
        <BarChartCard title="Etkilenen Ürünler" rows={chartData.productRows} />
        <BarChartCard title="Etkilenen Lotlar" rows={chartData.lotRows} />
        <BarChartCard title="Ortalama Tamamlama Süresi" rows={chartData.completionRows} />
        <BarChartCard title="Recall Başarı Oranı" rows={chartData.successRows} />
      </div>

      <div className="product-layout product-recall-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Recall Listesi</h3>
              <p className="muted">{formatNumber(visibleRows.length)} kayıt gösteriliyor. Kayıtlar otomatik stok/sevkiyat/muhasebe hareketi oluşturmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(records.length)} toplam seed/kayıt</span>
          </div>
          <div className="table-wrap product-recall-table-wrap">
            <table className="data-table product-recall-table">
              <thead>
                <tr>
                  <th>Recall No</th>
                  <th>Recall Türü</th>
                  <th>Başlatan</th>
                  <th>Başlatılma Tarihi</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>Risk Seviyesi</th>
                  <th>Ürün</th>
                  <th>Lot</th>
                  <th>Şube</th>
                  <th>Depo</th>
                  <th>Etkilenen Müşteri</th>
                  <th>Etkilenen Sevkiyat</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr><td colSpan={13} className="empty-cell">Filtrelere uygun recall kaydı bulunamadı.</td></tr>
                )}
                {visibleRows.map(row => (
                  <tr
                    key={row.record.id}
                    aria-selected={selectedRecord?.id === row.record.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRecordId(row.record.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(row.record.id)
                    }}
                  >
                    <td data-label="Recall No"><strong>{row.record.recallNo}</strong><span>{PRODUCT_RECALL_REASON_LABELS[row.record.reason]}</span></td>
                    <td data-label="Recall Türü">{PRODUCT_RECALL_TYPE_LABELS[row.record.recallType]}</td>
                    <td data-label="Başlatan">{row.record.initiatedBy}</td>
                    <td data-label="Başlatılma Tarihi">{formatDate(row.record.reportedDate)}</td>
                    <td data-label="Öncelik"><span className={`status-pill ${getPriorityClass(row.record.priority)}`}>{PRODUCT_RECALL_PRIORITY_LABELS[row.record.priority]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.record.status)}`}>{PRODUCT_RECALL_STATUS_LABELS[row.record.status]}</span></td>
                    <td data-label="Risk Seviyesi"><span className={`status-pill ${getRiskClass(row.record.riskLevel)}`}>{PRODUCT_RECALL_RISK_LEVEL_LABELS[row.record.riskLevel]}</span></td>
                    <td data-label="Ürün"><strong>{row.productName}</strong><span>{formatQuantity(row.record.affectedQuantity, row.record.unit)}</span></td>
                    <td data-label="Lot">{row.lot?.lotNo || row.record.inventoryLotId}</td>
                    <td data-label="Şube">{row.branchName}</td>
                    <td data-label="Depo">{row.warehouseName}</td>
                    <td data-label="Etkilenen Müşteri">{formatNumber(row.impact.affectedCustomerCount)}</td>
                    <td data-label="Etkilenen Sevkiyat">{formatNumber(row.impact.affectedShipmentCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side product-recall-side">
          {selectedRow ? (
            <RecallDetailPanel
              actionForm={actionForm}
              row={selectedRow}
              onActionFormChange={setActionForm}
              onAddAction={addActionLog}
              onEdit={startEdit}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card product-recall-detail-card">
              <h3>Recall Detayı</h3>
              <p className="muted">Detay görüntülemek için bir recall kaydı seçin.</p>
            </section>
          )}
          <RecallFormPanel
            branchMap={branchMap}
            form={form}
            formError={formError}
            formMode={formMode}
            lotMap={lotMap}
            sourceData={sourceData}
            onCancel={startCreate}
            onChange={setForm}
            onLotChange={handleLotChange}
            onSave={saveForm}
          />
        </aside>
      </div>
    </div>
  )
}

function RecallDetailPanel({
  actionForm,
  row,
  onActionFormChange,
  onAddAction,
  onEdit,
  onStatusChange
}: {
  actionForm: ActionForm
  row: RecallRow
  onActionFormChange: React.Dispatch<React.SetStateAction<ActionForm>>
  onAddAction: () => void
  onEdit: (record: ProductRecall) => void
  onStatusChange: (record: ProductRecall, status: ProductRecallStatus) => void
}){
  const record = row.record
  const openActions = record.actionLogs.filter(action => action.isOpen)
  const lastAction = record.actionLogs[0] || null

  return (
    <>
      <section className="card product-recall-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.recallNo}</h3>
            <p className="muted">{PRODUCT_RECALL_TYPE_LABELS[record.recallType]} / {row.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>{PRODUCT_RECALL_STATUS_LABELS[record.status]}</span>
        </div>
        <div className="product-recall-status-actions">
          {PRODUCT_RECALL_STATUSES.map(status => (
            <button
              className="btn"
              disabled={record.status === status}
              key={status}
              type="button"
              onClick={() => onStatusChange(record, status)}
            >
              {PRODUCT_RECALL_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <button className="btn secondary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
      </section>

      <section className="card product-recall-detail-card">
        <h3>Genel Bilgiler</h3>
        <div className="product-recall-detail-grid">
          <div><span>Recall No</span><strong>{record.recallNo}</strong></div>
          <div><span>Başlatan</span><strong>{record.initiatedBy}</strong></div>
          <div><span>Başlangıç Tarihi</span><strong>{formatDate(record.reportedDate)}</strong></div>
          <div><span>Hedef Tamamlanma</span><strong>{formatDate(record.targetCompletionDate)}</strong></div>
          <div><span>Öncelik</span><strong>{PRODUCT_RECALL_PRIORITY_LABELS[record.priority]}</strong></div>
          <div><span>Risk</span><strong>{PRODUCT_RECALL_RISK_LEVEL_LABELS[record.riskLevel]}</strong></div>
          <div><span>Durum</span><strong>{PRODUCT_RECALL_STATUS_LABELS[record.status]}</strong></div>
          <div><span>Sorumlu</span><strong>{record.responsiblePerson}</strong></div>
        </div>
      </section>

      <DetailTextCard title="Sebep" primary={PRODUCT_RECALL_REASON_LABELS[record.reason]} secondary={record.description} />
      <DetailTextCard title="Risk Analizi" primary={record.riskAnalysis} secondary="Bu analiz stok hareketi, sevkiyat iptali veya muhasebe kaydı oluşturmaz." />

      <section className="card product-recall-detail-card">
        <h3>Etki Analizi</h3>
        <div className="product-recall-impact-grid">
          <div><span>Ürün</span><strong>{formatNumber(row.impact.affectedProductCount)}</strong></div>
          <div><span>Lot</span><strong>{formatNumber(row.impact.affectedLotCount)}</strong></div>
          <div><span>Müşteri</span><strong>{formatNumber(row.impact.affectedCustomerCount)}</strong></div>
          <div><span>Sevkiyat</span><strong>{formatNumber(row.impact.affectedShipmentCount)}</strong></div>
          <div><span>Depo</span><strong>{formatNumber(row.impact.affectedWarehouseCount)}</strong></div>
          <div><span>Üretim Emri</span><strong>{formatNumber(row.impact.affectedProductionOrderCount)}</strong></div>
          <div><span>Reçete</span><strong>{formatNumber(row.impact.affectedRecipeCount)}</strong></div>
          <div><span>Başarı</span><strong>{formatPercent(row.impact.successRate)}</strong></div>
        </div>
      </section>

      <TraceabilityTree traceability={row.traceability} />

      <section className="card product-recall-detail-card">
        <h3>Aksiyon Takibi</h3>
        <div className="product-recall-action-form">
          <label className="form-field">
            <span>Aksiyon</span>
            <select value={actionForm.actionType} onChange={event => onActionFormChange(prev => ({ ...prev, actionType: event.target.value as ProductRecallActionType }))}>
              {PRODUCT_RECALL_ACTION_TYPES.map(action => <option key={action} value={action}>{PRODUCT_RECALL_ACTION_LABELS[action]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Kim Yaptı</span>
            <input value={actionForm.actorName} onChange={event => onActionFormChange(prev => ({ ...prev, actorName: event.target.value }))} />
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={actionForm.actionDate} onChange={event => onActionFormChange(prev => ({ ...prev, actionDate: event.target.value }))} />
          </label>
          <label className="form-field">
            <span>Saat</span>
            <input type="time" value={actionForm.actionTime} onChange={event => onActionFormChange(prev => ({ ...prev, actionTime: event.target.value }))} />
          </label>
          <label className="form-field product-recall-wide">
            <span>Açıklama</span>
            <textarea rows={2} value={actionForm.description} onChange={event => onActionFormChange(prev => ({ ...prev, description: event.target.value }))} />
          </label>
          <button className="btn primary" type="button" onClick={onAddAction}>Aksiyon Logla</button>
        </div>
        <div className="product-recall-related-list">
          {record.actionLogs.slice(0, 8).map(action => (
            <div key={action.id} className="product-recall-related-row">
              <strong>{PRODUCT_RECALL_ACTION_LABELS[action.actionType]} / {action.actorName}</strong>
              <span>{formatDate(action.actionDate)} {action.actionTime} / {action.isOpen ? 'Açık' : 'Tamamlandı'}</span>
              <p>{action.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card product-recall-detail-card">
        <h3>Sağ Panel Özeti</h3>
        <div className="product-recall-related-list">
          <div className="product-recall-related-row"><strong>Etkilenen Kayıtlar</strong><span>{formatNumber(row.impact.affectedLotCount)} lot / {formatNumber(row.impact.affectedShipmentCount)} sevkiyat / {formatNumber(row.impact.affectedCustomerCount)} müşteri</span></div>
          <div className="product-recall-related-row"><strong>Açık Aksiyonlar</strong><span>{formatNumber(openActions.length)} açık aksiyon</span></div>
          <div className="product-recall-related-row"><strong>Son İşlem</strong><span>{lastAction ? `${PRODUCT_RECALL_ACTION_LABELS[lastAction.actionType]} / ${lastAction.actorName}` : record.lastActionSummary}</span></div>
          <div className="product-recall-related-row"><strong>Sorumlu</strong><span>{record.responsiblePerson}</span></div>
        </div>
      </section>

      <TimelineCard events={record.timeline} />
      <DocumentCard documents={record.documents} />
    </>
  )
}

function DetailTextCard({
  primary,
  secondary,
  title
}: {
  primary: string
  secondary?: string
  title: string
}){
  return (
    <section className="card product-recall-detail-card">
      <h3>{title}</h3>
      <p className="product-recall-notes">{primary || '-'}</p>
      {secondary && <p className="product-recall-notes muted-note">{secondary}</p>}
    </section>
  )
}

function TraceabilityTree({ traceability }: { traceability: ProductRecallTraceability }){
  const groups: Array<{ title: string; items: ProductRecallRelatedRecord[] }> = [
    { title: 'Ürün', items: traceability.products },
    { title: 'Lot', items: traceability.lots },
    { title: 'Alt Lotlar', items: traceability.subLots },
    { title: 'Hammadde', items: traceability.rawMaterials },
    { title: 'Reçete', items: traceability.recipes },
    { title: 'Üretim Emri', items: traceability.productionOrders },
    { title: 'Üretim Merkezi', items: traceability.productionCenters },
    { title: 'Şube', items: traceability.branches },
    { title: 'Depo', items: traceability.warehouses },
    { title: 'Sevkiyat', items: traceability.shipments },
    { title: 'Teslimat', items: traceability.deliveries },
    { title: 'Müşteri', items: traceability.customers },
    { title: 'Numune', items: traceability.samples },
    { title: 'Şahit Numune', items: traceability.witnessSamples },
    { title: 'Kalite Formları', items: traceability.qualityForms },
    { title: 'HACCP Kayıtları', items: traceability.haccpRecords }
  ]

  return (
    <section className="card product-recall-detail-card">
      <h3>İzlenebilirlik Ağı</h3>
      <div className="product-recall-trace-grid">
        {groups.map(group => (
          <div key={group.title} className="product-recall-trace-group">
            <strong>{group.title}</strong>
            {group.items.length === 0 && <span>Kayıt yok</span>}
            {group.items.slice(0, 4).map(item => (
              <span key={`${group.title}:${item.id}:${item.no}`}>
                {item.no || item.name} / {item.name}{item.status ? ` / ${item.status}` : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function TimelineCard({ events }: { events: ProductRecallTimelineEvent[] }){
  return (
    <section className="card product-recall-detail-card">
      <h3>Timeline</h3>
      <div className="product-recall-timeline">
        {[...events].sort((first, second) => first.occurredAt.localeCompare(second.occurredAt)).map(event => (
          <div key={event.id}>
            <strong>{event.title}</strong>
            <span>{formatDateTime(event.occurredAt)} / {event.actorName}</span>
            <p>{event.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function DocumentCard({ documents }: { documents: ProductRecall['documents'] }){
  return (
    <section className="card product-recall-detail-card">
      <h3>İlgili Dokümanlar</h3>
      <div className="product-recall-related-list">
        {documents.length === 0 && <p className="muted">Doküman bulunamadı.</p>}
        {documents.map(document => (
          <div key={document.id} className="product-recall-related-row">
            <strong>{document.documentNo} / {document.title}</strong>
            <span>{document.documentType} / {document.owner} / {formatDateTime(document.createdAt)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecallFormPanel({
  branchMap,
  form,
  formError,
  formMode,
  lotMap,
  sourceData,
  onCancel,
  onChange,
  onLotChange,
  onSave
}: {
  branchMap: Map<string, Branch>
  form: ProductRecallInput
  formError: string
  formMode: 'create' | 'edit'
  lotMap: Map<string, InventoryLot>
  sourceData: KpiSourceData
  onCancel: () => void
  onChange: React.Dispatch<React.SetStateAction<ProductRecallInput>>
  onLotChange: (inventoryLotId: string) => void
  onSave: () => void
}){
  const lots = sourceData.inventoryLots

  return (
    <section className="card product-recall-form">
      <div className="section-header compact">
        <div>
          <h3>{formMode === 'edit' ? 'Recall Düzenle' : 'Recall Oluştur'}</h3>
          <p className="muted">Kayıt yalnızca süreç yönetimi sağlar; stok veya sevkiyat hareketi üretmez.</p>
        </div>
      </div>
      {formError && <div className="form-error">{formError}</div>}
      <div className="product-recall-form-grid">
        <label className="form-field">
          <span>Recall No</span>
          <input value={form.recallNo} onChange={event => onChange(prev => ({ ...prev, recallNo: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Durum</span>
          <select value={form.status} onChange={event => onChange(prev => ({ ...prev, status: event.target.value as ProductRecallStatus }))}>
            {PRODUCT_RECALL_STATUSES.map(status => <option key={status} value={status}>{PRODUCT_RECALL_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Recall Türü</span>
          <select value={form.recallType} onChange={event => onChange(prev => ({ ...prev, recallType: event.target.value as ProductRecallType }))}>
            {PRODUCT_RECALL_TYPES.map(type => <option key={type} value={type}>{PRODUCT_RECALL_TYPE_LABELS[type]}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Sebep</span>
          <select value={form.reason} onChange={event => onChange(prev => ({ ...prev, reason: event.target.value as ProductRecallReason }))}>
            {PRODUCT_RECALL_REASONS.map(reason => <option key={reason} value={reason}>{PRODUCT_RECALL_REASON_LABELS[reason]}</option>)}
          </select>
        </label>
        <label className="form-field product-recall-wide">
          <span>Lot</span>
          <select value={form.inventoryLotId} onChange={event => onLotChange(event.target.value)}>
            {lots.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNo} / {getProductName(lot, sourceData)} / {getBranchName(branchMap, lot.warehouseId, lot.warehouseId)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Risk</span>
          <select value={form.riskLevel} onChange={event => onChange(prev => ({ ...prev, riskLevel: event.target.value as ProductRecallRiskLevel }))}>
            {PRODUCT_RECALL_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{PRODUCT_RECALL_RISK_LEVEL_LABELS[risk]}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Öncelik</span>
          <select value={form.priority} onChange={event => onChange(prev => ({ ...prev, priority: event.target.value as ProductRecallPriority }))}>
            {PRODUCT_RECALL_PRIORITIES.map(priority => <option key={priority} value={priority}>{PRODUCT_RECALL_PRIORITY_LABELS[priority]}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Etkilenen Miktar</span>
          <input min="0" step="0.001" type="number" value={form.affectedQuantity} onChange={event => onChange(prev => ({ ...prev, affectedQuantity: Number(event.target.value) }))} />
        </label>
        <label className="form-field">
          <span>Birim</span>
          <select value={form.unit} onChange={event => onChange(prev => ({ ...prev, unit: event.target.value as StockUnit }))}>
            {STOCK_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Başlatılma Tarihi</span>
          <input type="date" value={form.reportedDate} onChange={event => onChange(prev => ({ ...prev, reportedDate: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Hedef Tamamlanma</span>
          <input type="date" value={form.targetCompletionDate} onChange={event => onChange(prev => ({ ...prev, targetCompletionDate: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Tamamlanma</span>
          <input type="date" value={form.resolvedDate} onChange={event => onChange(prev => ({ ...prev, resolvedDate: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Başlatan</span>
          <input value={form.initiatedBy} onChange={event => onChange(prev => ({ ...prev, initiatedBy: event.target.value }))} />
        </label>
        <label className="form-field">
          <span>Sorumlu</span>
          <input value={form.responsiblePerson} onChange={event => onChange(prev => ({ ...prev, responsiblePerson: event.target.value }))} />
        </label>
        <label className="form-field product-recall-wide">
          <span>Açıklama</span>
          <textarea rows={3} value={form.description} onChange={event => onChange(prev => ({ ...prev, description: event.target.value }))} />
        </label>
        <label className="form-field product-recall-wide">
          <span>Risk Analizi</span>
          <textarea rows={3} value={form.riskAnalysis} onChange={event => onChange(prev => ({ ...prev, riskAnalysis: event.target.value }))} />
        </label>
      </div>
      <div className="product-recall-side-actions">
        <button className="btn primary" type="button" onClick={onSave}>{formMode === 'edit' ? 'Güncelle' : 'Oluştur'}</button>
        {formMode === 'edit' && <button className="btn secondary" type="button" onClick={onCancel}>Yeni Recall</button>}
      </div>
      <p className="product-recall-notes muted-note">Seçili lot: {lotMap.get(form.inventoryLotId)?.lotNo || '-'}</p>
    </section>
  )
}

function BarChartCard({ rows, title }: { rows: ChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))
  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kırılım</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayıt bulunamadı.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div><strong>{row.label}</strong><span>{row.detail}</span></div>
            <div className="kpi-bar-track"><span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} /></div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrendChartCard({ rows, title }: { rows: TrendPoint[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))
  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} ay</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {rows.map(row => (
          <div className="kpi-line-point" key={row.id}>
            <span style={{ height: `${Math.max(4, (row.value / maxValue) * 100)}%` }} />
            <strong>{formatNumber(row.value)}</strong>
            <small>{row.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
