import { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
import { GoodsReceiptService } from '../goods-receipts/goods-receipt.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { ProductionLine } from '../production-lines/production-line.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { StockItem, StockUnit } from '../types'
import { WasteService } from '../waste-management/waste.service'
import { createPlanningHistory, appendPlanningHistory } from './planning-history.service'
import { PlanningRecommendationService } from './planning-recommendation.service'
import { createProductionPlanningStatistics } from './planning-statistics.service'
import {
  validateProductionPlan,
  validateProductionPlanCreateInput
} from './planning-validation.service'
import {
  PRODUCTION_PLAN_PRIORITIES,
  PRODUCTION_PLAN_PRIORITY_LABELS,
  PRODUCTION_PLAN_STATUSES,
  PRODUCTION_PLAN_STATUS_LABELS,
  PRODUCTION_PLAN_TYPES,
  PRODUCTION_PLAN_TYPE_LABELS
} from './production-planning.constants'
import type {
  ProductionDemand,
  ProductionPlan,
  ProductionPlanCreateInput,
  ProductionPlanItem,
  ProductionPlanningFilters,
  ProductionPlanningHistory,
  ProductionPlanningHistoryAction,
  ProductionPlanPriority,
  ProductionPlanStatus,
  ProductionPlanType,
  ProductionSupply
} from './production-planning.types'

export {
  PRODUCTION_PLAN_PRIORITIES,
  PRODUCTION_PLAN_PRIORITY_LABELS,
  PRODUCTION_PLAN_STATUSES,
  PRODUCTION_PLAN_STATUS_LABELS,
  PRODUCTION_PLAN_TYPES,
  PRODUCTION_PLAN_TYPE_LABELS
} from './production-planning.constants'

export const PRODUCTION_PLANNING_STORAGE_KEY = 'ra_production_planning_records'

type ProductCatalogItem = {
  productId: string
  productName: string
  productCode: string
  recipe: RecipeManagementRecord
  stockItem: StockItem | null
  unit: StockUnit
}

type DemandContext = {
  sourceData: KpiSourceData
  branchId: string
  planType: ProductionPlanType
  startDate: string
  endDate: string
}

type RawProductionPlan = Partial<Record<keyof ProductionPlan, unknown>> & Record<string, unknown>

const PLAN_NO_PREFIX = 'PP'
const PLAN_NO_PADDING = 6
const MINUTES_PER_SHIFT = 480
const QUANTITY_ROUNDING_FACTOR = 100

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeQuantity = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round((parsed + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
    : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const isDateWithin = (
  value: string,
  startDate: string,
  endDate: string
) => {
  const key = getDateKey(value)
  return Boolean(key) && key >= startDate && key <= endDate
}

const getNextProductionPlanNo = (
  records: Pick<ProductionPlan, 'planNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${PLAN_NO_PREFIX}-${year}-(\\d{${PLAN_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.planNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PLAN_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(PLAN_NO_PADDING, '0')}`
}

export const createDefaultProductionPlanningFilters = (): ProductionPlanningFilters => ({
  planType: ALL_FILTER,
  branchId: ALL_FILTER,
  shift: ALL_FILTER,
  status: ALL_FILTER,
  date: '',
  search: ''
})

const mapPlanType = (value: unknown): ProductionPlanType => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanType
  return PRODUCTION_PLAN_TYPES.includes(normalized) ? normalized : 'DAILY'
}

const mapPlanStatus = (value: unknown): ProductionPlanStatus => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanStatus
  return PRODUCTION_PLAN_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapPlanPriority = (value: unknown): ProductionPlanPriority => {
  const normalized = normalizeText(value).toUpperCase() as ProductionPlanPriority
  return PRODUCTION_PLAN_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = normalizeText(value)
  return ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli'].includes(unit) ? unit as StockUnit : 'kg'
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

const getPrimaryFacility = (
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => normalizeSearchText(branch.name).includes('uretim'))
  || sourceData.branches[0]
  || null

const productMatches = (
  candidate: string,
  target: string
) => {
  const candidateKey = normalizeSearchText(candidate)
  const targetKey = normalizeSearchText(target)
  return candidateKey === targetKey
    || candidateKey.includes(targetKey)
    || targetKey.includes(candidateKey)
}

const getRecipeForProduct = (
  productName: string,
  sourceData: KpiSourceData
) => sourceData.recipeRecords.find(recipe => (
  normalizeSearchText(recipe.status) !== 'pasif'
  && normalizeSearchText(recipe.recipeRole) === 'primary'
  && productMatches(recipe.productName, productName)
)) || sourceData.recipeRecords.find(recipe => (
  normalizeSearchText(recipe.status) !== 'pasif'
  && (productMatches(recipe.productName, productName) || productMatches(recipe.recipeName, productName))
)) || null

const getStockItemForProduct = (
  productName: string,
  sourceData: KpiSourceData,
  stockItemId = ''
) => sourceData.stockItems.find(item => item.id === stockItemId)
  || sourceData.stockItems.find(item => productMatches(item.name, productName))
  || null

const getCatalog = (
  sourceData: KpiSourceData
) => {
  const catalog = new Map<string, ProductCatalogItem>()

  const addProduct = (
    productName: string,
    productId = '',
    productCode = '',
    unit?: StockUnit,
    stockItemId = ''
  ) => {
    const recipe = getRecipeForProduct(productName, sourceData)
    if(!recipe) return
    const stockItem = getStockItemForProduct(productName, sourceData, stockItemId)
    const id = productId || sourceData.productRefs.find(product => productMatches(product.name, productName))?.id || stockItem?.id || recipe.id
    const key = normalizeSearchText(recipe.productName || productName)
    if(catalog.has(key)) return
    catalog.set(key, {
      productId: id,
      productName: recipe.productName || productName,
      productCode: productCode || recipe.code || stockItem?.sku || id,
      recipe,
      stockItem,
      unit: unit || sourceData.productRefs.find(product => product.id === id)?.unit || stockItem?.unit || 'kg'
    })
  }

  sourceData.recipeRecords.forEach(recipe => addProduct(recipe.productName, recipe.id, recipe.code))
  sourceData.productRefs.forEach(product => addProduct(product.name, product.id, product.stockItemId || '', product.unit, product.stockItemId || ''))
  sourceData.productionOrders.flatMap(order => order.lines).forEach(line => addProduct(line.productName, '', '', normalizeUnit(line.unit)))

  return Array.from(catalog.values())
}

const getLineQuantityForProduct = (
  order: ProductionWorkOrder,
  productName: string
) => sumBy(order.lines.filter(line => productMatches(line.productName, productName)), line => line.quantity)

const isCancelledOrder = (
  order: ProductionWorkOrder
) => normalizeSearchText(order.status).includes('iptal')

const isCompletedOrder = (
  order: ProductionWorkOrder
) => normalizeSearchText(order.status).includes('tamam')

const getPendingProductionQuantity = (
  productName: string,
  context: DemandContext
) => sumBy(context.sourceData.productionOrders.filter(order => (
  !isCancelledOrder(order)
  && !isCompletedOrder(order)
  && (context.branchId === ALL_FILTER || getBranchIdByName(order.branch, context.sourceData) === context.branchId || order.branch === context.branchId)
)), order => getLineQuantityForProduct(order, productName))

const getPendingOrderQuantity = (
  productName: string,
  context: DemandContext
) => sumBy(context.sourceData.productionOrders.filter(order => (
  !isCancelledOrder(order)
  && !isCompletedOrder(order)
  && isDateWithin(order.deliveryDate || order.createdAt, context.startDate, context.endDate)
  && (context.branchId === ALL_FILTER || getBranchIdByName(order.branch, context.sourceData) === context.branchId || order.branch === context.branchId)
)), order => getLineQuantityForProduct(order, productName))

const getDeliveryNoteDemand = (
  productName: string,
  context: DemandContext
) => sumBy(DeliveryNoteService.list(context.sourceData).filter(note => (
  note.status !== 'CANCELLED'
  && note.status !== 'DELIVERED'
  && isDateWithin(note.date, context.startDate, context.endDate)
  && (context.branchId === ALL_FILTER || note.branchId === context.branchId || note.customerId === context.branchId)
)), note => sumBy(note.items.filter(item => productMatches(item.productName || item.stockItemName, productName)), item => item.quantity))

const getShipmentDemand = (
  productName: string,
  context: DemandContext
) => sumBy(context.sourceData.shipments.filter(shipment => (
  shipment.status !== 'CANCELLED'
  && shipment.status !== 'DELIVERED'
  && isDateWithin(shipment.plannedDeliveryDate || shipment.shipmentDate, context.startDate, context.endDate)
  && (context.branchId === ALL_FILTER || shipment.destinationBranchId === context.branchId)
)), shipment => sumBy(shipment.items.filter(item => {
  const lot = context.sourceData.inventoryLots.find(record => record.id === item.inventoryLotId)
  const productRef = context.sourceData.productRefs.find(product => product.id === lot?.productId || product.stockItemId === item.stockItemId)
  const stockItem = context.sourceData.stockItems.find(record => record.id === item.stockItemId)
  return productMatches(productRef?.name || stockItem?.name || '', productName)
}), item => item.quantity))

const getForecastQuantity = (
  productName: string,
  context: DemandContext
) => {
  const completedQuantity = sumBy(context.sourceData.productionOrders.filter(order => (
    !isCancelledOrder(order)
    && isCompletedOrder(order)
  )), order => getLineQuantityForProduct(order, productName))
  const activeQuantity = sumBy(context.sourceData.productionOrders.filter(order => !isCancelledOrder(order)), order => getLineQuantityForProduct(order, productName))
  const horizonDays = context.planType === 'MONTHLY' ? 30 : context.planType === 'WEEKLY' ? 7 : 1
  const baseline = Math.max(completedQuantity / 14, activeQuantity / 21, 0)

  return roundKpi(baseline * horizonDays)
}

const getCurrentStock = (
  product: ProductCatalogItem,
  sourceData: KpiSourceData
) => {
  const lotQuantity = sumBy(sourceData.inventoryLots.filter(lot => (
    lot.productId === product.productId
    || lot.productId === product.recipe.id
    || lot.stockItemId === product.stockItem?.id
  )), lot => lot.remainingQuantity || lot.quantity)
  const stockQuantity = product.stockItem?.currentQty || 0

  return roundKpi(Math.max(lotQuantity, stockQuantity))
}

const getGoodsReceiptSupply = (
  product: ProductCatalogItem,
  sourceData: KpiSourceData
) => sumBy(GoodsReceiptService.list(sourceData).filter(receipt => receipt.status !== 'CANCELLED' && receipt.status !== 'REJECTED'), receipt => (
  sumBy(receipt.items.filter(item => (
    item.stockItemId === product.stockItem?.id
    || productMatches(item.productName || item.stockItemName || '', product.productName)
  )), item => item.acceptedQuantity || item.receivedQuantity)
))

const getWastePercent = (
  product: ProductCatalogItem,
  sourceData: KpiSourceData
) => {
  const recipeFire = product.recipe.firePercent || 0
  const wasteQuantity = sumBy(WasteService.list(sourceData).filter(record => (
    record.status !== 'CANCELLED'
    && (record.productId === product.productId || productMatches(record.productName || record.stockItemName, product.productName))
  )), record => record.quantity)
  const productionQuantity = sumBy(sourceData.productionOrders.filter(order => !isCancelledOrder(order)), order => getLineQuantityForProduct(order, product.productName))
  const actualWastePercent = percent(wasteQuantity, productionQuantity + wasteQuantity)

  return roundKpi(Math.max(recipeFire, actualWastePercent))
}

const selectProductionLine = (
  product: ProductCatalogItem,
  sourceData: KpiSourceData,
  index: number
) => {
  const productKey = normalizeSearchText(`${product.productName} ${product.recipe.recipeName}`)
  const lines = sourceData.productionLines
  const preferred = lines.find(line => {
    const typeKey = normalizeSearchText(line.type)
    const lineKey = normalizeSearchText(`${line.name} ${line.type}`)
    return (
      (productKey.includes('corba') || productKey.includes('soup')) && (typeKey.includes('orba') || lineKey.includes('orba'))
    ) || (
      (productKey.includes('et') || productKey.includes('kofte') || productKey.includes('doner')) && (typeKey.includes('et') || lineKey.includes('et'))
    ) || (
      (productKey.includes('marine') || productKey.includes('marinasyon')) && (typeKey.includes('marine') || lineKey.includes('marine'))
    ) || (
      productKey.includes('paket') && (typeKey.includes('paket') || lineKey.includes('paket'))
    )
  })

  return preferred || lines[index % Math.max(lines.length, 1)] || null
}

const getPriority = (
  produceQuantity: number,
  currentStock: number,
  minimumStock: number,
  demandQuantity: number,
  wastePercent: number
): ProductionPlanPriority => {
  if(currentStock <= minimumStock || produceQuantity >= demandQuantity * 0.65 || wastePercent >= 10) return 'CRITICAL'
  if(produceQuantity > 0 || wastePercent >= 6) return 'HIGH'
  if(currentStock > demandQuantity * 1.5 && demandQuantity > 0) return 'LOW'
  return 'NORMAL'
}

const createDemandSupplyForProduct = (
  product: ProductCatalogItem,
  context: DemandContext,
  planId: string
) => {
  const pendingProduction = getPendingProductionQuantity(product.productName, context)
  const pendingOrderQuantity = getPendingOrderQuantity(product.productName, context)
  const branchDemandQuantity = getShipmentDemand(product.productName, context)
  const customerOrderQuantity = getDeliveryNoteDemand(product.productName, context)
  const forecastQuantity = getForecastQuantity(product.productName, context)
  const minimumStockQuantity = product.stockItem?.minQty || Math.max(10, forecastQuantity * 0.25)
  const safetyStockQuantity = Math.max(minimumStockQuantity * 0.5, forecastQuantity * 0.1)
  const wastePercent = getWastePercent(product, context.sourceData)
  const grossDemand = Math.max(
    pendingOrderQuantity + branchDemandQuantity + customerOrderQuantity,
    forecastQuantity,
    minimumStockQuantity + safetyStockQuantity
  )
  const wasteAllowanceQuantity = roundKpi(grossDemand * (wastePercent / 100))
  const totalDemand = roundKpi(grossDemand + wasteAllowanceQuantity)
  const currentStock = getCurrentStock(product, context.sourceData)
  const goodsReceiptSupply = getGoodsReceiptSupply(product, context.sourceData)
  const availableSupply = roundKpi(currentStock + pendingProduction + goodsReceiptSupply)
  const shortageQuantity = Math.max(0, roundKpi(totalDemand - availableSupply))
  const surplusRiskQuantity = Math.max(0, roundKpi(availableSupply - totalDemand * 1.5))
  const demand: ProductionDemand = {
    id: `${planId}_${product.productId}_demand`,
    planId,
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    branchId: context.branchId === ALL_FILTER ? '' : context.branchId,
    branchName: context.branchId === ALL_FILTER ? 'Tum Subeler' : getBranchName(context.branchId, context.sourceData),
    pendingProductionQuantity: pendingProduction,
    pendingOrderQuantity,
    branchDemandQuantity,
    customerOrderQuantity,
    forecastQuantity,
    minimumStockQuantity,
    safetyStockQuantity,
    wasteAllowanceQuantity,
    totalDemand,
    unit: product.unit,
    sourceSummary: 'Production Orders, shipment/delivery demand, stock minimum, forecast and waste read-model.'
  }
  const supply: ProductionSupply = {
    id: `${planId}_${product.productId}_supply`,
    planId,
    productId: product.productId,
    productName: product.productName,
    currentStock,
    pendingProduction,
    goodsReceiptSupply,
    availableSupply,
    minimumStock: minimumStockQuantity,
    safetyStock: safetyStockQuantity,
    shortageQuantity,
    surplusRiskQuantity,
    unit: product.unit
  }

  return { demand, supply, wastePercent }
}

const createPlanItem = (
  product: ProductCatalogItem,
  demand: ProductionDemand,
  supply: ProductionSupply,
  wastePercent: number,
  sourceData: KpiSourceData,
  planId: string,
  shift: string,
  index: number
): ProductionPlanItem => {
  const produceQuantity = Math.max(0, roundKpi(demand.totalDemand - supply.currentStock - supply.pendingProduction - supply.goodsReceiptSupply))
  const line = selectProductionLine(product, sourceData, index)
  const capacity = line?.capacity && line.capacity > 0 ? line.capacity : 480
  const estimatedMinutes = produceQuantity > 0
    ? Math.max(20, roundKpi((produceQuantity / capacity) * MINUTES_PER_SHIFT + product.recipe.ingredients.length * 4))
    : 0
  const priority = getPriority(produceQuantity, supply.currentStock, supply.minimumStock, demand.totalDemand, wastePercent)
  const item: ProductionPlanItem = {
    id: `${planId}_item_${index + 1}`,
    planId,
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    recipeId: product.recipe.id,
    recipeName: product.recipe.recipeName,
    demandQuantity: demand.totalDemand,
    currentStock: supply.currentStock,
    minimumStock: supply.minimumStock,
    safetyStock: supply.safetyStock,
    pendingProduction: supply.pendingProduction,
    pendingOrderQuantity: demand.pendingOrderQuantity,
    branchDemandQuantity: demand.branchDemandQuantity,
    customerOrderQuantity: demand.customerOrderQuantity,
    forecastQuantity: demand.forecastQuantity,
    wastePercent,
    produceQuantity,
    unit: product.unit,
    priority,
    estimatedMinutes,
    productionLineId: line?.id || '',
    productionLineName: line?.name || 'Genel Uretim',
    shift,
    capacityUsagePercent: roundKpi(percent(estimatedMinutes, MINUTES_PER_SHIFT)),
    recommendations: []
  }

  return {
    ...item,
    recommendations: PlanningRecommendationService.createItemRecommendations(item)
  }
}

const getPlanStatusForType = (
  planType: ProductionPlanType
): ProductionPlanStatus => {
  if(planType === 'URGENT') return 'READY'
  if(planType === 'DAILY') return 'PREPARING'
  if(planType === 'BRANCH_BASED') return 'READY'
  return 'DRAFT'
}

const getPlanRange = (
  planType: ProductionPlanType,
  planDate: string
) => {
  if(planType === 'MONTHLY') return { startDate: planDate, endDate: addDays(planDate, 29) }
  if(planType === 'WEEKLY') return { startDate: planDate, endDate: addDays(planDate, 6) }
  return { startDate: planDate, endDate: planDate }
}

const createPlanFromContext = ({
  actorName,
  branchId,
  description,
  facilityId,
  planDate,
  planNo,
  planType,
  shift,
  sourceData,
  status
}: {
  actorName: string
  branchId: string
  description: string
  facilityId: string
  planDate: string
  planNo: string
  planType: ProductionPlanType
  shift: string
  sourceData: KpiSourceData
  status?: ProductionPlanStatus
}) => {
  const { startDate, endDate } = getPlanRange(planType, planDate)
  const planId = `production_plan_${planType.toLocaleLowerCase('tr-TR')}_${branchId || 'all'}_${planDate.replace(/-/g, '')}`
  const catalog = getCatalog(sourceData)
  const context: DemandContext = {
    sourceData,
    branchId,
    planType,
    startDate,
    endDate
  }
  const demandSupplyRows = catalog.map(product => ({
    product,
    ...createDemandSupplyForProduct(product, context, planId)
  }))
  const rowsForPlan = demandSupplyRows
    .filter(row => planType !== 'URGENT' || row.supply.shortageQuantity > 0 || row.wastePercent >= 7)
    .filter(row => row.demand.totalDemand > 0 || row.supply.shortageQuantity > 0)
    .sort((first, second) => second.supply.shortageQuantity - first.supply.shortageQuantity || second.demand.totalDemand - first.demand.totalDemand)
    .slice(0, planType === 'MONTHLY' ? 12 : 8)
  const demands = rowsForPlan.map(row => row.demand)
  const supplies = rowsForPlan.map(row => row.supply)
  const items = rowsForPlan.map((row, index) => createPlanItem(
    row.product,
    row.demand,
    row.supply,
    row.wastePercent,
    sourceData,
    planId,
    shift,
    index
  ))
  const facilityName = facilityId === ALL_FILTER ? 'Merkez Uretim' : getBranchName(facilityId, sourceData)
  const branchName = branchId === ALL_FILTER ? 'Tum Subeler' : getBranchName(branchId, sourceData)
  const createdAt = new Date().toISOString()
  const plan: ProductionPlan = {
    id: planId,
    planNo,
    planType,
    status: status || getPlanStatusForType(planType),
    planDate,
    startDate,
    endDate,
    branchId,
    branchName,
    facilityId,
    facilityName,
    shift,
    responsiblePerson: actorName,
    description,
    items,
    demands,
    supplies,
    recommendations: [],
    history: [
      createPlanningHistory(planId, 'CREATED', actorName, `${PRODUCTION_PLAN_TYPE_LABELS[planType]} read-model plan kaydi olusturuldu.`)
    ],
    sourceType: 'ReadModel',
    sourceId: `${planType}:${branchId}:${planDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }

  return {
    ...plan,
    recommendations: PlanningRecommendationService.createPlanRecommendations(plan)
  }
}

export const createProductionPlanningReadModelRecords = (
  sourceData: KpiSourceData
): ProductionPlan[] => {
  const today = getTodayKey()
  const facility = getPrimaryFacility(sourceData)
  const branchDemandMap = new Map<string, number>()
  sourceData.productionOrders
    .filter(order => !isCancelledOrder(order))
    .forEach(order => {
      const branchId = getBranchIdByName(order.branch, sourceData)
      branchDemandMap.set(branchId, (branchDemandMap.get(branchId) || 0) + sumBy(order.lines, line => line.quantity))
    })
  const topBranchId = Array.from(branchDemandMap.entries()).sort((first, second) => second[1] - first[1])[0]?.[0]
    || sourceData.branches[0]?.id
    || ALL_FILTER
  const seedPlans = [
    createPlanFromContext({
      actorName: 'Uretim Planlama',
      branchId: ALL_FILTER,
      description: 'Gunluk talep, stok ve fire etkisine gore otomatik uretim planlama read-modeli.',
      facilityId: facility?.id || ALL_FILTER,
      planDate: today,
      planNo: '',
      planType: 'DAILY',
      shift: 'Sabah',
      sourceData
    }),
    createPlanFromContext({
      actorName: 'Uretim Planlama',
      branchId: ALL_FILTER,
      description: 'Haftalik uretim kapasitesi ve sube talepleri icin planlama read-modeli.',
      facilityId: facility?.id || ALL_FILTER,
      planDate: today,
      planNo: '',
      planType: 'WEEKLY',
      shift: 'Haftalik',
      sourceData
    }),
    createPlanFromContext({
      actorName: 'Uretim Planlama',
      branchId: ALL_FILTER,
      description: 'Aylik forecast, minimum stok ve guvenlik stogu analiz plani.',
      facilityId: facility?.id || ALL_FILTER,
      planDate: today,
      planNo: '',
      planType: 'MONTHLY',
      shift: 'Aylik',
      sourceData
    }),
    createPlanFromContext({
      actorName: 'Uretim Planlama',
      branchId: ALL_FILTER,
      description: 'Kritik stok ve karsilanamayan talep icin acil uretim planlama read-modeli.',
      facilityId: facility?.id || ALL_FILTER,
      planDate: today,
      planNo: '',
      planType: 'URGENT',
      shift: 'Acil',
      sourceData,
      status: 'READY'
    }),
    createPlanFromContext({
      actorName: 'Sube Operasyon',
      branchId: topBranchId,
      description: `${getBranchName(topBranchId, sourceData)} talepleri icin sube bazli uretim planlama read-modeli.`,
      facilityId: facility?.id || ALL_FILTER,
      planDate: today,
      planNo: '',
      planType: 'BRANCH_BASED',
      shift: 'Sabah',
      sourceData,
      status: 'READY'
    })
  ]

  return seedPlans.map((plan, index) => ({
    ...plan,
    planNo: getNextProductionPlanNo(seedPlans.slice(0, index), plan.planDate)
  }))
}

const normalizeDemand = (
  value: unknown,
  planId: string
): ProductionDemand[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${planId}_demand_${index + 1}`,
    planId,
    productId: normalizeText(item.productId),
    productName: normalizeText(item.productName),
    productCode: normalizeText(item.productCode),
    branchId: normalizeText(item.branchId),
    branchName: normalizeText(item.branchName),
    pendingProductionQuantity: normalizeQuantity(item.pendingProductionQuantity),
    pendingOrderQuantity: normalizeQuantity(item.pendingOrderQuantity),
    branchDemandQuantity: normalizeQuantity(item.branchDemandQuantity),
    customerOrderQuantity: normalizeQuantity(item.customerOrderQuantity),
    forecastQuantity: normalizeQuantity(item.forecastQuantity),
    minimumStockQuantity: normalizeQuantity(item.minimumStockQuantity),
    safetyStockQuantity: normalizeQuantity(item.safetyStockQuantity),
    wasteAllowanceQuantity: normalizeQuantity(item.wasteAllowanceQuantity),
    totalDemand: normalizeQuantity(item.totalDemand),
    unit: normalizeUnit(item.unit),
    sourceSummary: normalizeText(item.sourceSummary)
  }))
}

const normalizeSupply = (
  value: unknown,
  planId: string
): ProductionSupply[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${planId}_supply_${index + 1}`,
    planId,
    productId: normalizeText(item.productId),
    productName: normalizeText(item.productName),
    currentStock: normalizeQuantity(item.currentStock),
    pendingProduction: normalizeQuantity(item.pendingProduction),
    goodsReceiptSupply: normalizeQuantity(item.goodsReceiptSupply),
    availableSupply: normalizeQuantity(item.availableSupply),
    minimumStock: normalizeQuantity(item.minimumStock),
    safetyStock: normalizeQuantity(item.safetyStock),
    shortageQuantity: normalizeQuantity(item.shortageQuantity),
    surplusRiskQuantity: normalizeQuantity(item.surplusRiskQuantity),
    unit: normalizeUnit(item.unit)
  }))
}

const normalizeItems = (
  value: unknown,
  planId: string
): ProductionPlanItem[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((item, index) => ({
    id: normalizeText(item.id) || `${planId}_item_${index + 1}`,
    planId,
    productId: normalizeText(item.productId),
    productName: normalizeText(item.productName),
    productCode: normalizeText(item.productCode),
    recipeId: normalizeText(item.recipeId),
    recipeName: normalizeText(item.recipeName),
    demandQuantity: normalizeQuantity(item.demandQuantity),
    currentStock: normalizeQuantity(item.currentStock),
    minimumStock: normalizeQuantity(item.minimumStock),
    safetyStock: normalizeQuantity(item.safetyStock),
    pendingProduction: normalizeQuantity(item.pendingProduction),
    pendingOrderQuantity: normalizeQuantity(item.pendingOrderQuantity),
    branchDemandQuantity: normalizeQuantity(item.branchDemandQuantity),
    customerOrderQuantity: normalizeQuantity(item.customerOrderQuantity),
    forecastQuantity: normalizeQuantity(item.forecastQuantity),
    wastePercent: normalizeQuantity(item.wastePercent),
    produceQuantity: normalizeQuantity(item.produceQuantity),
    unit: normalizeUnit(item.unit),
    priority: mapPlanPriority(item.priority),
    estimatedMinutes: normalizeQuantity(item.estimatedMinutes),
    productionLineId: normalizeText(item.productionLineId),
    productionLineName: normalizeText(item.productionLineName),
    shift: normalizeText(item.shift),
    capacityUsagePercent: normalizeQuantity(item.capacityUsagePercent),
    recommendations: Array.isArray(item.recommendations) ? item.recommendations.map(normalizeText).filter(Boolean) : []
  }))
}

const normalizeHistory = (
  value: unknown,
  planId: string,
  actorName: string
): ProductionPlanningHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [createPlanningHistory(planId, 'CREATED', actorName, 'Production Planning read-model kaydi olusturuldu.')]
  }

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${planId}_history_${index + 1}`,
    planId,
    action: normalizeText(history.action).toUpperCase() as ProductionPlanningHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    revisionNo: Number(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizePlan = (
  record: RawProductionPlan,
  index: number
): ProductionPlan => {
  const planType = mapPlanType(record.planType)
  const planDate = normalizeText(record.planDate) || getTodayKey()
  const planId = normalizeText(record.id) || `production_plan_${Date.now()}_${index}`
  const createdBy = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Uretim Planlama'
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()

  return {
    id: planId,
    planNo: normalizeText(record.planNo) || getNextProductionPlanNo([], planDate, index),
    planType,
    status: mapPlanStatus(record.status),
    planDate,
    startDate: normalizeText(record.startDate) || planDate,
    endDate: normalizeText(record.endDate) || planDate,
    branchId: normalizeText(record.branchId) || ALL_FILTER,
    branchName: normalizeText(record.branchName) || 'Tum Subeler',
    facilityId: normalizeText(record.facilityId) || '',
    facilityName: normalizeText(record.facilityName) || 'Merkez Uretim',
    shift: normalizeText(record.shift) || 'Sabah',
    responsiblePerson: normalizeText(record.responsiblePerson) || createdBy,
    description: normalizeText(record.description),
    items: normalizeItems(record.items, planId),
    demands: normalizeDemand(record.demands, planId),
    supplies: normalizeSupply(record.supplies, planId),
    recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(normalizeText).filter(Boolean) : [],
    history: normalizeHistory(record.history, planId, createdBy),
    sourceType: normalizeText(record.sourceType) as ProductionPlan['sourceType'] || 'ManualReadModel',
    sourceId: normalizeText(record.sourceId),
    revisionNo: Number(record.revisionNo) || 1,
    createdBy,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }
}

export const saveProductionPlans = (
  records: ProductionPlan[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PRODUCTION_PLANNING_STORAGE_KEY, JSON.stringify(records))
}

export const loadProductionPlans = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createProductionPlanningReadModelRecords(sourceData)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PRODUCTION_PLANNING_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveProductionPlans(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed.filter(isRecord).map((record, index) => normalizePlan(record as RawProductionPlan, index))
      const storedIds = new Set(normalizedRecords.map(record => record.id))
      const nextRecords = [
        ...normalizedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ]
      saveProductionPlans(nextRecords)
      return nextRecords
    }
  } catch {
    if(seedRecords.length > 0) saveProductionPlans(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveProductionPlans(seedRecords)
  return seedRecords
}

export const filterProductionPlans = (
  plans: ProductionPlan[],
  filters: ProductionPlanningFilters
) => plans.filter(plan => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    plan.planNo,
    plan.branchName,
    plan.responsiblePerson,
    plan.items.map(item => `${item.productName} ${item.recipeName} ${item.productionLineName}`).join(' ')
  ].join(' ')

  return (
    (filters.planType === ALL_FILTER || plan.planType === filters.planType)
    && (filters.branchId === ALL_FILTER || plan.branchId === filters.branchId)
    && (filters.shift === ALL_FILTER || plan.shift === filters.shift)
    && (filters.status === ALL_FILTER || plan.status === filters.status)
    && (!filters.date || plan.planDate === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

const upsertPlan = (
  plans: ProductionPlan[],
  plan: ProductionPlan
) => plans.some(record => record.id === plan.id)
  ? plans.map(record => record.id === plan.id ? plan : record)
  : [plan, ...plans]

export const addProductionPlan = (
  input: ProductionPlanCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateProductionPlanCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  const records = loadProductionPlans(sourceData)
  const plan = createPlanFromContext({
    actorName,
    branchId: input.branchId,
    description: input.description || 'Manuel read-model uretim plani.',
    facilityId: input.facilityId,
    planDate: input.planDate,
    planNo: getNextProductionPlanNo(records, input.planDate),
    planType: input.planType,
    shift: input.shift,
    sourceData,
    status: 'DRAFT'
  })
  const nextPlanId = createId('production_plan_manual')
  const nextPlan = {
    ...plan,
    id: nextPlanId,
    startDate: input.startDate,
    endDate: input.endDate,
    sourceType: 'ManualReadModel' as const,
    responsiblePerson: input.responsiblePerson,
    items: plan.items.map((item, index) => ({ ...item, id: `${nextPlanId}_item_${index + 1}`, planId: nextPlanId })),
    demands: plan.demands.map((demand, index) => ({ ...demand, id: `${nextPlanId}_demand_${index + 1}`, planId: nextPlanId })),
    supplies: plan.supplies.map((supply, index) => ({ ...supply, id: `${nextPlanId}_supply_${index + 1}`, planId: nextPlanId })),
    history: plan.history.map(history => ({ ...history, planId: nextPlanId }))
  }
  const nextValidation = validateProductionPlan(nextPlan, sourceData)
  if(!nextValidation.valid) throw new Error(nextValidation.errors.join(' '))
  saveProductionPlans([nextPlan, ...records])
  return nextPlan
}

export const updateProductionPlanStatus = (
  planId: string,
  status: ProductionPlanStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadProductionPlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Uretim plani bulunamadi.')
  if(plan.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('Iptal edilmis uretim plani tekrar acilamaz.')
  if(plan.status === status) return plan

  const actionByStatus: Record<ProductionPlanStatus, ProductionPlanningHistoryAction> = {
    DRAFT: 'UPDATED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextPlan = appendPlanningHistory(
    { ...plan, status },
    actionByStatus[status],
    actorName,
    `${plan.planNo} ${PRODUCTION_PLAN_STATUS_LABELS[status]} durumuna alindi.`
  )
  const validation = validateProductionPlan(nextPlan, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveProductionPlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const recordProductionPlanOutput = (
  planId: string,
  action: Extract<ProductionPlanningHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadProductionPlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Uretim plani bulunamadi.')
  const nextPlan = appendPlanningHistory(
    plan,
    action,
    actorName,
    action === 'EXCEL' ? `${plan.planNo} Excel export edildi.` : `${plan.planNo} cikti penceresi acildi.`
  )
  saveProductionPlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const getLineCapacitySummary = (
  line: ProductionLine | null
) => line ? `${line.name} / ${line.capacity} ${line.capacityUnit} / ${line.estimatedUtilization}%` : 'Genel Uretim'

export const ProductionPlanningService = {
  createDefaultFilters: createDefaultProductionPlanningFilters,
  getNextNo: getNextProductionPlanNo,
  list: loadProductionPlans,
  save: saveProductionPlans,
  filter: filterProductionPlans,
  createReadModelRecords: createProductionPlanningReadModelRecords,
  add: addProductionPlan,
  updateStatus: updateProductionPlanStatus,
  recordOutput: recordProductionPlanOutput,
  statistics: createProductionPlanningStatistics,
  validate: validateProductionPlan,
  validateCreateInput: validateProductionPlanCreateInput,
  recommendations: PlanningRecommendationService,
  getCatalog
}
