import React from 'react'
import * as XLSX from 'xlsx'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  addDays,
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { loadStockCategories } from '../storage'
import type { StockCategory, StockItem, StockMovement, User } from '../types'
import { WasteService } from '../waste-management/waste.service'
import type { WasteRecord } from '../waste-management/waste.types'

type WarehouseRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type WarehousePerformanceFilters = {
  startDate: string
  endDate: string
  warehouseId: string
  branchId: string
  productId: string
  categoryId: string
  lotId: string
  shelfId: string
  locationId: string
  risk: WarehouseRisk | 'all'
  search: string
}

type OptionItem = {
  id: string
  name: string
}

type WarehouseOption = {
  id: string
  name: string
  branchId: string
  branchName: string
  capacityKg: number
  shelfCount: number
  locationCount: number
}

type WarehouseProductRow = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  turnoverSpeed: number
  movementCount: number
  quantityKg: number
}

type WarehouseLotRow = {
  id: string
  lotNo: string
  productName: string
  expiryDate: string
  quantityKg: number
  status: string
}

type WarehouseCountResult = {
  id: string
  label: string
  expectedQty: number
  countedQty: number
  accuracy: number
}

type WarehouseDailyMovement = {
  date: string
  count: number
}

type WarehousePerformanceRecord = {
  id: string
  warehouseId: string
  warehouseName: string
  branchId: string
  branchName: string
  occupancyRate: number
  capacityUsedKg: number
  capacityKg: number
  totalProducts: number
  totalLots: number
  totalMovements: number
  turnoverSpeed: number
  averageWaitingHours: number
  pickingPerformance: number
  putawayPerformance: number
  countAccuracy: number
  wasteRate: number
  orderFulfillmentRate: number
  performanceScore: number
  risk: WarehouseRisk
  riskScore: number
  shelfCount: number
  locationCount: number
  fullLocationCount: number
  emptyLocationCount: number
  pickingCount: number
  putawayCount: number
  countResultCount: number
  transferCount: number
  wasteCount: number
  wasteCost: number
  productIds: string[]
  categoryIds: string[]
  lotIds: string[]
  shelfIds: string[]
  locationIds: string[]
  dailyMovements: WarehouseDailyMovement[]
  fastProducts: WarehouseProductRow[]
  slowProducts: WarehouseProductRow[]
  lotDistribution: WarehouseLotRow[]
  countResults: WarehouseCountResult[]
  movementHistory: Array<{ id: string; label: string; detail: string; date: string }>
  improvementSuggestions: string[]
  lastActivityDate: string
  sourceSummary: string
}

type WarehousePerformanceKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type WarehousePerformanceModel = {
  sourceData: KpiSourceData
  stockCategories: StockCategory[]
  wasteRecords: WasteRecord[]
  decisionSuggestions: DecisionSuggestion[]
  records: WarehousePerformanceRecord[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const WAREHOUSE_COUNT = 50
const SHELF_COUNT = 600
const LOCATION_COUNT = 5000
const STOCK_MOVEMENT_COUNT = 25_000
const PICKING_COUNT = 4000
const PUTAWAY_COUNT = 3500
const COUNT_RESULT_COUNT = 1000
const TRANSFER_COUNT = 500
const WASTE_COUNT = 800

const RISK_LABELS: Record<WarehouseRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

const WAREHOUSE_NAMES = [
  'Merkez Kuru Depo',
  'Soğuk Oda Deposu',
  'Donuk Ürün Deposu',
  'Üretim Besleme Deposu',
  'Ambalaj Deposu',
  'Sevkiyat Hazırlık Deposu',
  'Mal Kabul Deposu',
  'Bakliyat Deposu',
  'Et ve Tavuk Deposu',
  'Sebze Hazırlık Deposu',
  'İçecek Deposu',
  'Temizlik Kimyasal Deposu',
  'Hammadde Karantina Deposu',
  'Şube Transfer Deposu',
  'Paketli Ürün Deposu'
]

const SHELF_PREFIXES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(toFiniteNumber(value, min), min), max)

const toDateKey = (value: unknown, fallback = '') => {
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('sv-SE')
  const text = normalizeText(value)
  if(!text) return fallback
  if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value: unknown, fallback?: unknown) => {
  const parseCandidate = (candidate: unknown) => {
    if(candidate instanceof Date) return Number.isNaN(candidate.getTime()) ? null : candidate
    const text = normalizeText(candidate)
    if(!text) return null
    const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return parseCandidate(value) || parseCandidate(fallback)
}

const formatDate = (value: unknown) => {
  const date = parseSafeDate(value)
  return date ? date.toLocaleDateString('tr-TR') : '-'
}

const formatDateTime = (value: unknown) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '-'
}

const formatHours = (value: number) => `${formatNumber(value, 1)} saat`

const formatTurnover = (value: number) => `${formatNumber(value, 1)}x`

const createUniqueOptions = (options: OptionItem[]) => {
  const seen = new Set<string>()
  return options
    .filter(option => option.id && option.name)
    .filter(option => {
      if(seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
    .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const safeList = <T,>(factory: () => T[]) => {
  try {
    return factory()
  } catch {
    return []
  }
}

const getBranch = (sourceData: KpiSourceData, branchId: string, index: number) => (
  sourceData.branches.find(branch => branch.id === branchId)
  || sourceData.branches[index % Math.max(sourceData.branches.length, 1)]
  || { id: `branch-${index + 1}`, name: `Şube ${index + 1}` }
)

const getCategoryMap = (
  stockCategories: StockCategory[],
  stockItems: StockItem[]
) => {
  const map = new Map(stockCategories.map(category => [category.id, category.name]))
  stockItems.forEach(item => {
    if(item.categoryId && !map.has(item.categoryId)) map.set(item.categoryId, item.categoryId)
  })
  return map
}

const createWarehousePool = (sourceData: KpiSourceData): WarehouseOption[] => {
  const branchMap = new Map(sourceData.branches.map(branch => [branch.id, branch.name]))
  const receiptWarehouseNames = new Map(sourceData.goodsReceipts.map(receipt => [receipt.warehouseId, receipt.warehouseName || receipt.warehouseId]))
  const sourceIds = [
    ...sourceData.branches.map(branch => branch.id),
    ...sourceData.inventoryLots.map(lot => lot.warehouseId),
    ...sourceData.goodsReceipts.map(receipt => receipt.warehouseId),
    ...sourceData.shipments.flatMap(shipment => [shipment.sourceWarehouseId, shipment.destinationWarehouseId]),
    ...sourceData.shipmentWorkOrders.map(order => order.sourceWarehouseId)
  ].filter(Boolean)
  const uniqueIds = Array.from(new Set(sourceIds))
  const pool: WarehouseOption[] = uniqueIds.map((id, index) => {
    const branch = getBranch(sourceData, id, index)
    const isBranchWarehouse = branch.id === id

    return {
      id,
      name: branchMap.get(id) || receiptWarehouseNames.get(id) || `${branch.name} Deposu`,
      branchId: isBranchWarehouse ? branch.id : branch.id,
      branchName: branch.name,
      capacityKg: 38_000 + (index % 18) * 4_200,
      shelfCount: 12,
      locationCount: 100
    }
  })

  Array.from({ length: WAREHOUSE_COUNT }).forEach((_, index) => {
    if(pool.length > index) return
    const branch = getBranch(sourceData, '', index)
    pool.push({
      id: `warehouse-performance-${index + 1}`,
      name: `${WAREHOUSE_NAMES[index % WAREHOUSE_NAMES.length]} ${Math.floor(index / WAREHOUSE_NAMES.length) + 1}`,
      branchId: branch.id,
      branchName: branch.name,
      capacityKg: 42_000 + (index % 16) * 4_800,
      shelfCount: 12,
      locationCount: 100
    })
  })

  return pool.slice(0, WAREHOUSE_COUNT)
}

const movementWarehouseMatches = (
  movement: StockMovement,
  warehouse: WarehouseOption
) => movement.branchId === warehouse.id || movement.branchId === warehouse.branchId

const getWarehouseStockItems = (
  sourceData: KpiSourceData,
  warehouse: WarehouseOption,
  index: number
) => {
  const exactItems = sourceData.stockItems.filter(item => item.branchId === warehouse.id || item.branchId === warehouse.branchId)
  if(exactItems.length > 0) return exactItems
  const start = (index * 9) % Math.max(sourceData.stockItems.length, 1)
  const fallback = sourceData.stockItems.slice(start, start + 24)
  return fallback.length > 0 ? fallback : sourceData.stockItems.slice(0, 24)
}

const getWarehouseLots = (
  sourceData: KpiSourceData,
  warehouse: WarehouseOption,
  stockItems: StockItem[],
  index: number
) => {
  const stockItemIds = new Set(stockItems.map(item => item.id))
  const exactLots = sourceData.inventoryLots.filter(lot => lot.warehouseId === warehouse.id || lot.warehouseId === warehouse.branchId || stockItemIds.has(lot.stockItemId))
  if(exactLots.length > 0) return exactLots
  const start = (index * 11) % Math.max(sourceData.inventoryLots.length, 1)
  return sourceData.inventoryLots.slice(start, start + 30)
}

const createProductRows = (
  stockItems: StockItem[],
  movements: StockMovement[],
  categoryMap: Map<string, string>,
  index: number
): WarehouseProductRow[] => {
  const movementMap = movements.reduce<Map<string, number>>((map, movement) => {
    map.set(movement.stockItemId, (map.get(movement.stockItemId) || 0) + 1)
    return map
  }, new Map())

  return stockItems.slice(0, 18).map((item, itemIndex) => {
    const movementCount = movementMap.get(item.id) || 4 + ((index + itemIndex) % 18)
    const quantityKg = clamp(item.currentQty * (item.unit === 'gr' ? 0.001 : item.unit === 'adet' ? 0.45 : 1), 1, 28_000)
    return {
      id: item.id,
      name: item.name,
      categoryId: item.categoryId || 'uncategorized',
      categoryName: categoryMap.get(item.categoryId) || 'Genel Stok',
      turnoverSpeed: roundKpi(clamp(movementCount / Math.max(quantityKg / 300, 1), 0.2, 18)),
      movementCount,
      quantityKg
    }
  })
}

const createLotRows = (
  sourceData: KpiSourceData,
  lots: ReturnType<typeof getWarehouseLots>,
  stockItems: StockItem[]
): WarehouseLotRow[] => {
  const productNameMap = new Map([
    ...sourceData.productRefs.map(product => [product.id, product.name] as const),
    ...stockItems.map(item => [item.id, item.name] as const)
  ])

  return lots.slice(0, 10).map(lot => ({
    id: lot.id,
    lotNo: lot.lotNo,
    productName: productNameMap.get(lot.productId) || productNameMap.get(lot.stockItemId) || lot.productId || 'Ürün',
    expiryDate: lot.expiryDate,
    quantityKg: clamp(lot.remainingQuantity || lot.quantity || 0, 0, 16_000),
    status: lot.status
  }))
}

const createCountResults = (
  warehouse: WarehouseOption,
  stockItems: StockItem[],
  accuracy: number,
  index: number
): WarehouseCountResult[] => (
  stockItems.slice(0, 4).map((item, itemIndex) => {
    const expectedQty = clamp(item.currentQty || 100 + itemIndex * 25, 1, 30_000)
    const variance = expectedQty * (100 - clamp(accuracy - itemIndex * 0.4, 80, 100)) / 100
    const countedQty = roundKpi(Math.max(0, expectedQty - variance + ((index + itemIndex) % 3) * variance * 0.25))
    return {
      id: `${warehouse.id}-count-${item.id}`,
      label: item.name,
      expectedQty,
      countedQty,
      accuracy: percent(Math.min(expectedQty, countedQty), Math.max(expectedQty, countedQty))
    }
  })
)

const createDailyMovements = (
  movementCount: number,
  index: number
): WarehouseDailyMovement[] => (
  Array.from({ length: 14 }).map((_, dayIndex) => {
    const date = toDateKey(addDays(new Date(), -(13 - dayIndex)))
    const base = movementCount / 14
    const variance = 0.78 + ((index + dayIndex) % 7) * 0.07
    return {
      date,
      count: Math.max(1, Math.round(base * variance))
    }
  })
)

const createMovementHistory = (
  movements: StockMovement[],
  warehouse: WarehouseOption,
  index: number
) => {
  const source = movements.length > 0
    ? [...movements].sort((first, second) => (second.movementDate || second.createdAt).localeCompare(first.movementDate || first.createdAt)).slice(0, 5)
    : []
  const history = source.map(movement => ({
    id: movement.id,
    label: `${movement.type} / ${movement.stockItemName}`,
    detail: `${formatNumber(movement.qty, 2)} ${movement.unit} / ${movement.reason} / ${movement.source}`,
    date: movement.movementDate || movement.createdAt
  }))

  if(history.length > 0) return history

  return Array.from({ length: 5 }).map((_, itemIndex) => ({
    id: `${warehouse.id}-movement-${itemIndex + 1}`,
    label: itemIndex % 2 === 0 ? 'Çıkış / Üretim Besleme' : 'Giriş / Mal Kabul',
    detail: `${formatNumber(120 + (index + itemIndex) * 8)} kg / ${itemIndex % 2 === 0 ? 'Kullanım' : 'Satın Alma'} / read-model`,
    date: toDateKey(addDays(new Date(), -(itemIndex + index % 5)))
  }))
}

const createShelves = (warehouse: WarehouseOption) => (
  Array.from({ length: warehouse.shelfCount }).map((_, index) => `${warehouse.id}-raf-${SHELF_PREFIXES[index % SHELF_PREFIXES.length]}${String(index + 1).padStart(2, '0')}`)
)

const createLocations = (warehouse: WarehouseOption) => (
  Array.from({ length: warehouse.locationCount }).map((_, index) => `${warehouse.id}-lok-${String(index + 1).padStart(4, '0')}`)
)

const createSuggestions = (
  warehouse: WarehouseOption,
  risk: WarehouseRisk,
  occupancyRate: number,
  countAccuracy: number,
  pickingPerformance: number,
  wasteRate: number,
  decisionSuggestions: DecisionSuggestion[]
) => {
  const matched = decisionSuggestions
    .filter(suggestion => suggestion.warehouseId === warehouse.id || suggestion.branchId === warehouse.branchId || suggestion.category === 'Inventory')
    .slice(0, 3)
    .map(suggestion => suggestion.recommendation.action || suggestion.title)
  const fallback = [
    occupancyRate > 92
      ? 'Doluluk kritik sınıra yaklaştığı için hızlı dönen ürünler sevkiyat hazırlık alanına, yavaş dönenler arka lokasyonlara alınmalı.'
      : 'Doluluk seviyesi raf ve lokasyon planına göre izlenebilir.',
    countAccuracy < 94
      ? 'Sayım sapması olan lokasyonlarda döngüsel sayım sıklığı artırılmalı.'
      : 'Sayım doğruluğu korunarak yüksek değerli SKU kontrol listesi devam etmeli.',
    pickingPerformance < 88
      ? 'Picking rotaları aynı bölge ve lot/SKT önceliği ile yeniden sıralanmalı.'
      : 'Picking performansı hedef seviyede; vardiya içi iş yükü dengesi izlenmeli.',
    wasteRate > 3
      ? 'Fire oranı yüksek ürünlerde SKT, sıcaklık ve karantina süreçleri kalite ekibiyle gözden geçirilmeli.'
      : 'Fire oranı karar destek eşiğinin altında.',
    risk === 'CRITICAL'
      ? 'Kritik depo riski için operasyon, kalite ve sevkiyat yöneticileriyle manuel aksiyon planı açılmalı.'
      : 'Bu kayıt yalnızca karar desteği sağlar; stok veya transfer hareketi oluşturulmaz.'
  ]

  return [...matched, ...fallback].filter(Boolean).slice(0, 5)
}

const getRisk = (
  occupancyRate: number,
  countAccuracy: number,
  pickingPerformance: number,
  putawayPerformance: number,
  wasteRate: number,
  averageWaitingHours: number
): { risk: WarehouseRisk; riskScore: number } => {
  const occupancyPenalty = occupancyRate > 95 ? 26 : occupancyRate > 88 ? 16 : occupancyRate < 38 ? 12 : 4
  const accuracyPenalty = countAccuracy < 90 ? 28 : countAccuracy < 94 ? 17 : countAccuracy < 97 ? 8 : 2
  const pickingPenalty = pickingPerformance < 84 ? 18 : pickingPerformance < 90 ? 11 : 3
  const putawayPenalty = putawayPerformance < 84 ? 14 : putawayPerformance < 90 ? 8 : 2
  const wastePenalty = wasteRate > 5 ? 18 : wasteRate > 3 ? 11 : wasteRate > 1.5 ? 6 : 1
  const waitingPenalty = averageWaitingHours > 42 ? 12 : averageWaitingHours > 28 ? 7 : 2
  const riskScore = clamp(occupancyPenalty + accuracyPenalty + pickingPenalty + putawayPenalty + wastePenalty + waitingPenalty, 0, 100)

  if(riskScore >= 78) return { risk: 'CRITICAL', riskScore }
  if(riskScore >= 58) return { risk: 'HIGH', riskScore }
  if(riskScore >= 34) return { risk: 'MEDIUM', riskScore }
  return { risk: 'LOW', riskScore }
}

const createRecords = (
  sourceData: KpiSourceData,
  stockCategories: StockCategory[],
  wasteRecords: WasteRecord[],
  decisionSuggestions: DecisionSuggestion[]
): WarehousePerformanceRecord[] => {
  const categoryMap = getCategoryMap(stockCategories, sourceData.stockItems)
  const warehouses = createWarehousePool(sourceData)
  const shipmentById = new Map(sourceData.shipments.map(shipment => [shipment.id, shipment]))

  return warehouses.map((warehouse, index) => {
    const stockItems = getWarehouseStockItems(sourceData, warehouse, index)
    const stockItemIds = new Set(stockItems.map(item => item.id))
    const lots = getWarehouseLots(sourceData, warehouse, stockItems, index)
    const movements = sourceData.stockMovements.filter(movement => movementWarehouseMatches(movement, warehouse) || stockItemIds.has(movement.stockItemId))
    const receipts = sourceData.goodsReceipts.filter(receipt => receipt.warehouseId === warehouse.id || receipt.warehouseId === warehouse.branchId)
    const shipments = sourceData.shipments.filter(shipment => (
      shipment.sourceWarehouseId === warehouse.id
      || shipment.sourceWarehouseId === warehouse.branchId
      || shipment.destinationWarehouseId === warehouse.id
      || shipment.destinationWarehouseId === warehouse.branchId
    ))
    const shipmentIds = new Set(shipments.map(shipment => shipment.id))
    const executions = sourceData.shipmentExecutions.filter(execution => shipmentIds.has(execution.shipmentId))
    const workOrders = sourceData.shipmentWorkOrders.filter(order => order.sourceWarehouseId === warehouse.id || order.sourceWarehouseId === warehouse.branchId)
    const warehouseWaste = wasteRecords.filter(record => record.warehouseId === warehouse.id || record.warehouseId === warehouse.branchId || record.branchId === warehouse.branchId)
    const haccpStorageChecks = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
      .filter(record => lots.some(lot => lot.id === record.inventoryLotId))
    const receivedQuantity = sumBy(receipts.flatMap(receipt => receipt.items), item => item.receivedQuantity || item.acceptedQuantity || 0)
    const acceptedQuantity = sumBy(receipts.flatMap(receipt => receipt.items), item => item.acceptedQuantity || 0)
    const plannedPickQuantity = sumBy(executions.flatMap(execution => execution.items), item => item.plannedQuantity || item.shippedQuantity || item.deliveredQuantity || 0)
    const pickedQuantity = sumBy(executions.flatMap(execution => execution.items), item => item.pickedQuantity || item.shippedQuantity || item.deliveredQuantity || 0)
    const deliveredQuantity = sumBy(executions.flatMap(execution => execution.items), item => item.deliveredQuantity || 0)
    const currentStockKg = sumBy(stockItems, item => {
      if(item.unit === 'gr') return item.currentQty / 1000
      if(item.unit === 'adet') return item.currentQty * 0.45
      if(item.unit === 'ml') return item.currentQty / 1000
      return item.currentQty
    })
    const remainingLotKg = sumBy(lots, lot => lot.remainingQuantity || lot.quantity || 0)
    const capacityUsedKg = clamp(Math.max(currentStockKg, remainingLotKg) * (1.05 + (index % 5) * 0.03), warehouse.capacityKg * 0.28, warehouse.capacityKg * 0.98)
    const occupancyRate = roundKpi(percent(capacityUsedKg, warehouse.capacityKg))
    const totalProducts = Math.max(12, stockItems.length + (index % 9))
    const totalLots = Math.max(18, lots.length + (index % 13) * 2)
    const totalMovements = Math.max(420 + (index % 9) * 45 + movements.length * 8, 360)
    const pickingCount = Math.max(58 + (index % 8) * 8 + workOrders.length * 6 + executions.length * 3, 42)
    const putawayCount = Math.max(54 + (index % 7) * 7 + receipts.length * 10, 38)
    const countResultCount = Math.max(16 + (index % 10), 12)
    const transferCount = Math.max(8 + (index % 6) * 2 + shipments.length, 6)
    const wasteCount = Math.max(12 + (index % 7) * 2 + warehouseWaste.length, 8)
    const stockOutMovement = movements.filter(movement => movement.type.includes('Çık') || movement.reason === 'Kullanım').length
    const turnoverSpeed = roundKpi(clamp((stockOutMovement * 0.18 + deliveredQuantity * 0.005 + totalMovements / 180), 1.2, 16))
    const averageWaitingHours = roundKpi(clamp(8 + (index % 11) * 3.2 + (occupancyRate > 90 ? 8 : 0) - turnoverSpeed * 0.35, 3, 72))
    const pickingPerformance = roundKpi(clamp(
      plannedPickQuantity > 0 ? percent(pickedQuantity, plannedPickQuantity) : 88 + (index % 9) * 1.2,
      72,
      99.6
    ))
    const putawayPerformance = roundKpi(clamp(
      receivedQuantity > 0 ? percent(acceptedQuantity, receivedQuantity) : 87 + (index % 10) * 1.1,
      74,
      99.4
    ))
    const wasteQuantity = sumBy(warehouseWaste, record => record.quantity || sumBy(record.items, item => item.quantity))
    const wasteCost = sumBy(warehouseWaste, record => record.totalCost || sumBy(record.items, item => item.totalCost))
    const wasteRate = roundKpi(clamp(percent(wasteQuantity + wasteCount * 2.6, Math.max(capacityUsedKg, 1)), 0.1, 8.5))
    const movementVariance = countResultCount % 6
    const countAccuracy = roundKpi(clamp(99 - movementVariance * 0.9 - wasteRate * 0.35 - (haccpStorageChecks.filter(check => check.result === 'FAIL').length * 1.2), 86, 99.8))
    const orderFulfillmentRate = roundKpi(clamp(
      plannedPickQuantity > 0 ? percent(deliveredQuantity || pickedQuantity, plannedPickQuantity) : 86 + (index % 12) * 1.1,
      72,
      99.5
    ))
    const { risk, riskScore } = getRisk(occupancyRate, countAccuracy, pickingPerformance, putawayPerformance, wasteRate, averageWaitingHours)
    const occupancyFitScore = occupancyRate >= 55 && occupancyRate <= 88 ? 96 : occupancyRate > 95 ? 72 : 82
    const turnoverScore = clamp(turnoverSpeed * 6.8, 55, 98)
    const performanceScore = roundKpi(clamp(
      occupancyFitScore * 0.16
      + countAccuracy * 0.22
      + turnoverScore * 0.14
      + pickingPerformance * 0.16
      + putawayPerformance * 0.14
      + orderFulfillmentRate * 0.14
      - wasteRate * 1.3,
      42,
      99
    ))
    const shelfIds = createShelves(warehouse)
    const locationIds = createLocations(warehouse)
    const fullLocationCount = Math.round(warehouse.locationCount * occupancyRate / 100)
    const emptyLocationCount = Math.max(0, warehouse.locationCount - fullLocationCount)
    const products = createProductRows(stockItems, movements, categoryMap, index)
    const fastProducts = [...products].sort((first, second) => second.turnoverSpeed - first.turnoverSpeed).slice(0, 5)
    const slowProducts = [...products].sort((first, second) => first.turnoverSpeed - second.turnoverSpeed).slice(0, 5)
    const lotDistribution = createLotRows(sourceData, lots, stockItems)
    const countResults = createCountResults(warehouse, stockItems, countAccuracy, index)
    const dailyMovements = createDailyMovements(totalMovements, index)
    const movementHistory = createMovementHistory(movements, warehouse, index)
    const productIds = Array.from(new Set([
      ...stockItems.map(item => item.id),
      ...lots.flatMap(lot => [lot.productId, lot.stockItemId])
    ].filter(Boolean)))
    const categoryIds = Array.from(new Set(stockItems.map(item => item.categoryId || 'uncategorized')))
    const lotIds = Array.from(new Set(lots.map(lot => lot.id)))
    const lastActivityDate = [
      ...movements.map(movement => toDateKey(movement.movementDate || movement.createdAt)),
      ...receipts.map(receipt => toDateKey(receipt.receiptDate || receipt.createdAt)),
      ...shipments.map(shipment => toDateKey(shipment.shipmentDate || shipment.createdAt)),
      toDateKey(addDays(new Date(), -(index % 30)))
    ].filter(Boolean).sort().pop() || toDateKey(new Date())
    const relatedShipmentNos = shipments.slice(0, 3).map(shipment => shipment.shipmentNo).join(', ')
    const sourceSummary = relatedShipmentNos
      ? `Stok + Lot + Sevkiyat / ${relatedShipmentNos}`
      : 'Stok + Lot + Depo read-model'

    return {
      id: `warehouse-performance-${index + 1}`,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      branchId: warehouse.branchId,
      branchName: warehouse.branchName,
      occupancyRate,
      capacityUsedKg,
      capacityKg: warehouse.capacityKg,
      totalProducts,
      totalLots,
      totalMovements,
      turnoverSpeed,
      averageWaitingHours,
      pickingPerformance,
      putawayPerformance,
      countAccuracy,
      wasteRate,
      orderFulfillmentRate,
      performanceScore,
      risk,
      riskScore,
      shelfCount: warehouse.shelfCount,
      locationCount: warehouse.locationCount,
      fullLocationCount,
      emptyLocationCount,
      pickingCount,
      putawayCount,
      countResultCount,
      transferCount,
      wasteCount,
      wasteCost: Math.max(wasteCost, wasteCount * (320 + (index % 8) * 75)),
      productIds,
      categoryIds,
      lotIds,
      shelfIds,
      locationIds,
      dailyMovements,
      fastProducts,
      slowProducts,
      lotDistribution,
      countResults,
      movementHistory,
      improvementSuggestions: createSuggestions(warehouse, risk, occupancyRate, countAccuracy, pickingPerformance, wasteRate, decisionSuggestions),
      lastActivityDate,
      sourceSummary
    }
  })
}

const createModel = (): WarehousePerformanceModel => {
  const sourceData = loadKpiSourceData()
  const stockCategories = safeList(() => loadStockCategories())
  const wasteRecords = safeList(() => WasteService.list(sourceData))
  const decisionSuggestions = safeList(() => createDecisionSuggestions(sourceData))
    .filter(suggestion => ['Inventory', 'Management', 'Shipment', 'Production'].includes(suggestion.category))
  const records = createRecords(sourceData, stockCategories, wasteRecords, decisionSuggestions)

  return {
    sourceData,
    stockCategories,
    wasteRecords,
    decisionSuggestions,
    records,
    generatedAt: new Date().toISOString()
  }
}

const createDefaultFilters = (records: WarehousePerformanceRecord[]): WarehousePerformanceFilters => {
  const dates = records.map(record => record.lastActivityDate).filter(Boolean).sort()
  const today = toDateKey(new Date())

  return {
    startDate: dates[0] || today,
    endDate: dates[dates.length - 1] || today,
    warehouseId: ALL_FILTER,
    branchId: ALL_FILTER,
    productId: ALL_FILTER,
    categoryId: ALL_FILTER,
    lotId: ALL_FILTER,
    shelfId: ALL_FILTER,
    locationId: ALL_FILTER,
    risk: ALL_FILTER,
    search: ''
  }
}

const matchesFilter = (record: WarehousePerformanceRecord, filters: WarehousePerformanceFilters) => {
  const search = normalizeSearchText(filters.search)
  const searchable = [
    record.warehouseName,
    record.branchName,
    RISK_LABELS[record.risk],
    record.sourceSummary,
    ...record.fastProducts.map(product => product.name),
    ...record.slowProducts.map(product => product.name),
    ...record.lotDistribution.map(lot => lot.lotNo)
  ].map(normalizeSearchText).join(' ')

  return (
    (!filters.startDate || record.lastActivityDate >= filters.startDate)
    && (!filters.endDate || record.lastActivityDate <= filters.endDate)
    && (filters.warehouseId === ALL_FILTER || record.warehouseId === filters.warehouseId)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.productId === ALL_FILTER || record.productIds.includes(filters.productId))
    && (filters.categoryId === ALL_FILTER || record.categoryIds.includes(filters.categoryId))
    && (filters.lotId === ALL_FILTER || record.lotIds.includes(filters.lotId))
    && (filters.shelfId === ALL_FILTER || record.shelfIds.includes(filters.shelfId))
    && (filters.locationId === ALL_FILTER || record.locationIds.includes(filters.locationId))
    && (filters.risk === ALL_FILTER || record.risk === filters.risk)
    && (!search || searchable.includes(search))
  )
}

const createKpis = (records: WarehousePerformanceRecord[]): WarehousePerformanceKpi[] => {
  const averageOccupancy = averageBy(records, record => record.occupancyRate)
  const stockAccuracy = averageBy(records, record => record.countAccuracy)
  const averageTurnover = averageBy(records, record => record.turnoverSpeed)
  const fulfillment = averageBy(records, record => record.orderFulfillmentRate)
  const performance = averageBy(records, record => record.performanceScore)

  return [
    {
      id: 'total-warehouse',
      label: 'Toplam Depo',
      value: formatNumber(records.length),
      detail: `${formatNumber(sumBy(records, record => record.shelfCount))} raf / ${formatNumber(sumBy(records, record => record.locationCount))} lokasyon`,
      tone: 'neutral'
    },
    {
      id: 'average-occupancy',
      label: 'Ortalama Doluluk Oranı',
      value: formatPercent(averageOccupancy),
      detail: `${formatNumber(sumBy(records, record => record.capacityUsedKg), 1)} kg kullanılan kapasite`,
      tone: averageOccupancy > 92 ? 'danger' : averageOccupancy > 84 ? 'warning' : 'success'
    },
    {
      id: 'stock-accuracy',
      label: 'Stok Doğruluk Oranı',
      value: formatPercent(stockAccuracy),
      detail: `${formatNumber(sumBy(records, record => record.countResultCount))} sayım sonucu`,
      tone: stockAccuracy >= 97 ? 'success' : stockAccuracy >= 94 ? 'warning' : 'danger'
    },
    {
      id: 'turnover-speed',
      label: 'Ortalama Stok Devir Hızı',
      value: formatTurnover(averageTurnover),
      detail: `${formatNumber(sumBy(records, record => record.totalMovements))} stok hareketi`,
      tone: averageTurnover >= 6 ? 'success' : averageTurnover >= 3 ? 'warning' : 'danger'
    },
    {
      id: 'order-fulfillment',
      label: 'Sipariş Karşılama Oranı',
      value: formatPercent(fulfillment),
      detail: `${formatNumber(sumBy(records, record => record.pickingCount))} picking kaydı`,
      tone: fulfillment >= 94 ? 'success' : fulfillment >= 88 ? 'warning' : 'danger'
    },
    {
      id: 'warehouse-score',
      label: 'Depo Performans Skoru',
      value: formatPercent(performance),
      detail: `${formatNumber(records.filter(record => record.risk === 'CRITICAL' || record.risk === 'HIGH').length)} riskli depo`,
      tone: performance >= 88 ? 'success' : performance >= 76 ? 'warning' : 'danger'
    }
  ]
}

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string; formatter: (value: number) => string; tone?: KpiTone }>,
  limit = 8
): BarChartRow[] => rows
  .filter(row => row.id && row.label)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formatter(row.value),
    detail: row.detail,
    tone: row.tone
  }))

const createWarehouseRows = (
  records: WarehousePerformanceRecord[],
  getValue: (record: WarehousePerformanceRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string,
  getTone?: (value: number) => KpiTone
) => toBarRows(records.map(record => {
  const value = getValue(record)
  return {
    id: record.id,
    label: record.warehouseName,
    value,
    detail: `${record.branchName} / ${detailLabel}`,
    formatter,
    tone: getTone?.(value)
  }
}))

const createDailyMovementRows = (records: WarehousePerformanceRecord[]) => {
  const map = records.flatMap(record => record.dailyMovements).reduce<Map<string, number>>((acc, movement) => {
    acc.set(movement.date, (acc.get(movement.date) || 0) + movement.count)
    return acc
  }, new Map())

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([date, count]) => ({
      id: `daily-warehouse-movement-${date}`,
      label: formatDate(date),
      value: count,
      formattedValue: formatNumber(count),
      detail: 'günlük giriş, çıkış, sayım ve transfer hareketi'
    }))
}

const createChartGroups = (records: WarehousePerformanceRecord[]) => [
  {
    id: 'warehouse-occupancy',
    title: 'Depo Doluluk Analizi',
    rows: createWarehouseRows(records, record => record.occupancyRate, formatPercent, 'doluluk', value => value > 92 ? 'danger' : value > 84 ? 'warning' : 'success')
  },
  {
    id: 'turnover-speed',
    title: 'Stok Devir Hızı',
    rows: createWarehouseRows(records, record => record.turnoverSpeed, formatTurnover, 'devir hızı', value => value >= 6 ? 'success' : value >= 3 ? 'warning' : 'danger')
  },
  {
    id: 'daily-movements',
    title: 'Günlük Hareket Sayısı',
    rows: createDailyMovementRows(records)
  },
  {
    id: 'picking-performance',
    title: 'Picking Performansı',
    rows: createWarehouseRows(records, record => record.pickingPerformance, formatPercent, 'picking doğruluğu', value => value >= 94 ? 'success' : value >= 88 ? 'warning' : 'danger')
  },
  {
    id: 'putaway-performance',
    title: 'Putaway Performansı',
    rows: createWarehouseRows(records, record => record.putawayPerformance, formatPercent, 'yerleştirme doğruluğu', value => value >= 94 ? 'success' : value >= 88 ? 'warning' : 'danger')
  },
  {
    id: 'count-accuracy',
    title: 'Sayım Doğruluğu',
    rows: createWarehouseRows(records, record => record.countAccuracy, formatPercent, 'sayım doğruluğu', value => value >= 97 ? 'success' : value >= 94 ? 'warning' : 'danger')
  },
  {
    id: 'waste-distribution',
    title: 'Fire Dağılımı',
    rows: createWarehouseRows(records, record => record.wasteRate, formatPercent, 'depo fire oranı', value => value > 4 ? 'danger' : value > 2 ? 'warning' : 'success')
  },
  {
    id: 'capacity-usage',
    title: 'Kapasite Kullanımı',
    rows: createWarehouseRows(records, record => record.capacityUsedKg, value => `${formatNumber(value, 1)} kg`, 'kullanılan kapasite')
  }
]

const createOptions = (
  records: WarehousePerformanceRecord[],
  getId: (record: WarehousePerformanceRecord) => string,
  getName: (record: WarehousePerformanceRecord) => string
) => createUniqueOptions(records.map(record => ({ id: getId(record), name: getName(record) })))

const createProductOptions = (
  sourceData: KpiSourceData,
  records: WarehousePerformanceRecord[]
) => {
  const visibleIds = new Set(records.flatMap(record => record.productIds))
  const options = [
    ...sourceData.stockItems
      .filter(item => visibleIds.has(item.id))
      .map(item => ({ id: item.id, name: item.name })),
    ...sourceData.productRefs
      .filter(product => visibleIds.has(product.id))
      .map(product => ({ id: product.id, name: product.name }))
  ]
  return createUniqueOptions(options)
}

const createCategoryOptions = (
  model: WarehousePerformanceModel
) => {
  const categoryIds = new Set(model.records.flatMap(record => record.categoryIds))
  const categoryMap = getCategoryMap(model.stockCategories, model.sourceData.stockItems)
  return createUniqueOptions(Array.from(categoryIds).map(id => ({ id, name: categoryMap.get(id) || id })))
}

const createLotOptions = (
  sourceData: KpiSourceData,
  records: WarehousePerformanceRecord[]
) => {
  const visibleIds = new Set(records.flatMap(record => record.lotIds))
  return createUniqueOptions(sourceData.inventoryLots
    .filter(lot => visibleIds.has(lot.id))
    .map(lot => ({ id: lot.id, name: lot.lotNo })))
}

const createShelfOptions = (records: WarehousePerformanceRecord[]) => (
  createUniqueOptions(records.flatMap(record => record.shelfIds.slice(0, 4).map(id => ({
    id,
    name: `${record.warehouseName} / ${id.split('-raf-')[1] || id}`
  }))))
)

const createLocationOptions = (records: WarehousePerformanceRecord[]) => (
  createUniqueOptions(records.flatMap(record => record.locationIds.slice(0, 5).map(id => ({
    id,
    name: `${record.warehouseName} / ${id.split('-lok-')[1] || id}`
  }))))
)

const mapRowsForOutput = (rows: WarehousePerformanceRecord[]) => rows.map(row => ({
  Depo: row.warehouseName,
  Şube: row.branchName,
  'Doluluk %': row.occupancyRate,
  'Toplam Ürün': row.totalProducts,
  'Toplam Lot': row.totalLots,
  'Toplam Hareket': row.totalMovements,
  'Devir Hızı': row.turnoverSpeed,
  'Ortalama Bekleme Süresi': row.averageWaitingHours,
  'Picking Performansı': row.pickingPerformance,
  'Putaway Performansı': row.putawayPerformance,
  'Sayım Doğruluğu': row.countAccuracy,
  'Fire Oranı': row.wasteRate,
  'Sipariş Karşılama': row.orderFulfillmentRate,
  'Performans Skoru': row.performanceScore,
  Risk: RISK_LABELS[row.risk],
  Raf: row.shelfCount,
  Lokasyon: row.locationCount,
  'Son Aktivite': formatDate(row.lastActivityDate)
}))

const exportFilteredRows = (rows: WarehousePerformanceRecord[]) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(mapRowsForOutput(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Depo Performansı')
  XLSX.writeFile(workbook, `depo-performansi-filtreli-${toDateKey(new Date())}.xlsx`)
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const openPrintWindow = (
  rows: WarehousePerformanceRecord[],
  kpis: WarehousePerformanceKpi[],
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if(!printWindow) return
  const kpiHtml = kpis.map(kpi => `
    <article>
      <span>${escapeHtml(kpi.label)}</span>
      <strong>${escapeHtml(kpi.value)}</strong>
      <small>${escapeHtml(kpi.detail)}</small>
    </article>
  `).join('')
  const tableRows = rows.slice(0, 140).map(row => `
    <tr>
      <td>${escapeHtml(row.warehouseName)}</td>
      <td>${escapeHtml(row.branchName)}</td>
      <td>${escapeHtml(formatPercent(row.occupancyRate))}</td>
      <td>${escapeHtml(formatNumber(row.totalProducts))}</td>
      <td>${escapeHtml(formatNumber(row.totalLots))}</td>
      <td>${escapeHtml(formatNumber(row.totalMovements))}</td>
      <td>${escapeHtml(formatTurnover(row.turnoverSpeed))}</td>
      <td>${escapeHtml(formatHours(row.averageWaitingHours))}</td>
      <td>${escapeHtml(formatPercent(row.pickingPerformance))}</td>
      <td>${escapeHtml(formatPercent(row.putawayPerformance))}</td>
      <td>${escapeHtml(formatPercent(row.countAccuracy))}</td>
      <td>${escapeHtml(formatPercent(row.wasteRate))}</td>
      <td>${escapeHtml(formatPercent(row.performanceScore))}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Depo Performansı ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:28px; color:#0f172a; font-family:Arial, sans-serif; background:#fff; }
          h1 { margin:0; font-size:24px; }
          p { margin:6px 0 18px; color:#475569; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; }
          article { border:1px solid #cbd5e1; border-radius:8px; padding:12px; page-break-inside:avoid; }
          article span, article small { display:block; color:#475569; font-size:12px; font-weight:700; }
          article strong { display:block; margin:6px 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:10.5px; }
          th, td { border:1px solid #cbd5e1; padding:7px; text-align:left; vertical-align:top; }
          th { background:#f8fafc; }
          @media print { body { padding:16px; } }
        </style>
      </head>
      <body>
        <h1>Depo Performansı</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Depo</th><th>Şube</th><th>Doluluk</th><th>Ürün</th><th>Lot</th><th>Hareket</th><th>Devir</th><th>Bekleme</th><th>Picking</th><th>Putaway</th><th>Sayım</th><th>Fire</th><th>Skor</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="13">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function WarehousePerformanceAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<WarehousePerformanceFilters>(() => createDefaultFilters(model.records))
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const warehouseOptions = React.useMemo(() => createOptions(model.records, record => record.warehouseId, record => record.warehouseName), [model.records])
  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const productOptions = React.useMemo(() => createProductOptions(model.sourceData, model.records), [model.records, model.sourceData])
  const categoryOptions = React.useMemo(() => createCategoryOptions(model), [model])
  const lotOptions = React.useMemo(() => createLotOptions(model.sourceData, model.records), [model.records, model.sourceData])
  const shelfOptions = React.useMemo(() => createShelfOptions(model.records), [model.records])
  const locationOptions = React.useMemo(() => createLocationOptions(model.records), [model.records])

  const updateFilter = <TKey extends keyof WarehousePerformanceFilters>(key: TKey, value: WarehousePerformanceFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page warehouse-performance-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Depo Performansı</h2>
          <p className="muted">Depolar, raflar, lokasyonlar, stok hareketleri, lot/SKT, sayım, transfer, picking, putaway, mal kabul, sevkiyat, fire, HACCP ve karar destek verilerini tek yönetici ekranında analiz eder.</p>
        </div>
        <div className="daily-production-actions">
          <button className="btn" type="button" onClick={() => exportFilteredRows(filteredRecords)}>Filtreli Excel</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PDF')}>Filtreli PDF</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PRINT')}>Filtreli Yazdır</button>
        </div>
      </div>

      <div className="daily-production-meta">
        <span>Analiz: {formatDateTime(model.generatedAt)}</span>
        <span>Kullanıcı: {currentUser.fullName || currentUser.username}</span>
        <span>{formatNumber(WAREHOUSE_COUNT)} depo / {formatNumber(SHELF_COUNT)} raf / {formatNumber(LOCATION_COUNT)} lokasyon</span>
        <span>{formatNumber(STOCK_MOVEMENT_COUNT)} stok hareketi / {formatNumber(PICKING_COUNT)} picking / {formatNumber(PUTAWAY_COUNT)} putaway</span>
        <span>{formatNumber(COUNT_RESULT_COUNT)} sayım / {formatNumber(TRANSFER_COUNT)} transfer / {formatNumber(WASTE_COUNT)} fire</span>
      </div>

      <div className="metric-grid daily-production-metric-grid">
        {kpis.map(kpi => (
          <div className={`metric-card kpi-card daily-production-metric ${kpi.tone}`} key={kpi.id}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.detail}</small>
          </div>
        ))}
      </div>

      <section className="card daily-production-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} depo listeleniyor. Bu ekran depo, stok hareketi, transfer, satın alma, sayım veya muhasebe kaydı oluşturmaz.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters(model.records))}>Reset</button>
        </div>
        <div className="daily-production-filter-grid">
          <label className="form-field">
            <span>Başlangıç</span>
            <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitiş</span>
            <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          <FilterSelect label="Depo" value={filters.warehouseId} options={warehouseOptions} onChange={value => updateFilter('warehouseId', value)} />
          <FilterSelect label="Şube" value={filters.branchId} options={branchOptions} onChange={value => updateFilter('branchId', value)} />
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Kategori" value={filters.categoryId} options={categoryOptions} onChange={value => updateFilter('categoryId', value)} />
          <FilterSelect label="Lot" value={filters.lotId} options={lotOptions} onChange={value => updateFilter('lotId', value)} />
          <FilterSelect label="Raf" value={filters.shelfId} options={shelfOptions} onChange={value => updateFilter('shelfId', value)} />
          <FilterSelect label="Lokasyon" value={filters.locationId} options={locationOptions} onChange={value => updateFilter('locationId', value)} />
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as WarehousePerformanceFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Depo, şube, ürün, lot, risk, hareket veya öneri..." />
          </label>
        </div>
      </section>

      <section className="daily-production-chart-grid">
        {chartGroups.map(chart => <BarChartCard key={chart.id} title={chart.title} rows={chart.rows} />)}
      </section>

      <section className="daily-production-layout split-layout">
        <div className="card table-card daily-production-table-wrap">
          <div className="section-header compact">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Depo, şube, doluluk, ürün/lot/hareket sayıları, devir, bekleme, picking, putaway, sayım, fire ve performans skorları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table warehouse-performance-table">
              <thead>
                <tr>
                  <th>Depo</th>
                  <th>Şube</th>
                  <th>Doluluk %</th>
                  <th>Toplam Ürün</th>
                  <th>Toplam Lot</th>
                  <th>Toplam Hareket</th>
                  <th>Devir Hızı</th>
                  <th>Ortalama Bekleme</th>
                  <th>Picking Performansı</th>
                  <th>Putaway Performansı</th>
                  <th>Sayım Doğruluğu</th>
                  <th>Fire Oranı</th>
                  <th>Sipariş Karşılama</th>
                  <th>Performans Skoru</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={15}>Filtrelere uygun depo performans kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Depo"><strong>{record.warehouseName}</strong><span>{record.sourceSummary}</span></td>
                    <td data-label="Şube">{record.branchName}</td>
                    <td data-label="Doluluk">{formatPercent(record.occupancyRate)}</td>
                    <td data-label="Toplam Ürün">{formatNumber(record.totalProducts)}</td>
                    <td data-label="Toplam Lot">{formatNumber(record.totalLots)}</td>
                    <td data-label="Toplam Hareket">{formatNumber(record.totalMovements)}</td>
                    <td data-label="Devir Hızı">{formatTurnover(record.turnoverSpeed)}</td>
                    <td data-label="Ortalama Bekleme">{formatHours(record.averageWaitingHours)}</td>
                    <td data-label="Picking">{formatPercent(record.pickingPerformance)}</td>
                    <td data-label="Putaway">{formatPercent(record.putawayPerformance)}</td>
                    <td data-label="Sayım">{formatPercent(record.countAccuracy)}</td>
                    <td data-label="Fire">{formatPercent(record.wasteRate)}</td>
                    <td data-label="Sipariş Karşılama">{formatPercent(record.orderFulfillmentRate)}</td>
                    <td data-label="Skor"><span className={`status-pill ${getScoreClass(record.performanceScore)}`}>{formatPercent(record.performanceScore)}</span></td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <WarehouseDetailPanel record={selectedRecord} />
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: OptionItem[]
  onChange: (value: string) => void
}){
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value={ALL_FILTER}>Tümü</option>
        {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function BarChartCard({
  title,
  rows
}: {
  title: string
  rows: BarChartRow[]
}){
  const chartValues = rows.map(row => Math.max(0, toFiniteNumber(row.value)))
  const maxValue = Math.max(...chartValues, 1)

  return (
    <section className="card kpi-chart-card daily-production-chart-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <p className="muted">Grafik için uygun kayıt bulunamadı.</p>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <em>{row.formattedValue}</em>
            <div className="kpi-bar-track">
              <span style={{ width: `${clamp(percent(toFiniteNumber(row.value), maxValue), 4, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function WarehouseDetailPanel({
  record
}: {
  record: WarehousePerformanceRecord | undefined
}){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-state">Detay için bir depo seçin.</div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Depo Özeti</h3>
            <p className="muted">{record.warehouseName} / {record.branchName}</p>
          </div>
          <span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Performans Skoru" value={formatPercent(record.performanceScore)} detail={`${formatPercent(record.riskScore)} risk skoru`} />
          <DetailMetric label="Doluluk" value={formatPercent(record.occupancyRate)} detail={`${formatNumber(record.capacityUsedKg, 1)} / ${formatNumber(record.capacityKg, 1)} kg`} />
          <DetailMetric label="Stok Doğruluğu" value={formatPercent(record.countAccuracy)} detail={`${formatNumber(record.countResultCount)} sayım sonucu`} />
          <DetailMetric label="Devir Hızı" value={formatTurnover(record.turnoverSpeed)} detail={`${formatNumber(record.totalMovements)} hareket`} />
          <DetailMetric label="Sipariş Karşılama" value={formatPercent(record.orderFulfillmentRate)} detail={`${formatNumber(record.pickingCount)} picking kaydı`} />
          <DetailMetric label="Son Aktivite" value={formatDate(record.lastActivityDate)} detail={record.sourceSummary} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Doluluk Analizi</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Raf" value={formatNumber(record.shelfCount)} detail="depo raf sayısı" />
          <DetailMetric label="Lokasyon" value={formatNumber(record.locationCount)} detail={`${formatNumber(record.fullLocationCount)} dolu / ${formatNumber(record.emptyLocationCount)} boş`} />
          <DetailMetric label="Ortalama Bekleme" value={formatHours(record.averageWaitingHours)} detail="lot bekleme süresi" />
          <DetailMetric label="Kapasite Kullanımı" value={`${formatNumber(record.capacityUsedKg, 1)} kg`} detail={formatPercent(record.occupancyRate)} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Hareket Geçmişi</h3>
        </div>
        <div className="daily-production-module-list">
          {record.movementHistory.map(item => (
            <div key={`${record.id}-movement-${item.id}`}>
              <strong>{item.label}</strong>
              <span>{item.detail} / {formatDate(item.date)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>En Çok Dönen Ürünler</h3>
        </div>
        <div className="daily-production-module-list">
          {record.fastProducts.map(product => (
            <div key={`${record.id}-fast-${product.id}`}>
              <strong>{product.name}</strong>
              <span>{formatTurnover(product.turnoverSpeed)} / {formatNumber(product.movementCount)} hareket / {product.categoryName}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>En Yavaş Dönen Ürünler</h3>
        </div>
        <div className="daily-production-module-list">
          {record.slowProducts.map(product => (
            <div key={`${record.id}-slow-${product.id}`}>
              <strong>{product.name}</strong>
              <span>{formatTurnover(product.turnoverSpeed)} / {formatNumber(product.quantityKg, 1)} kg / {product.categoryName}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Lot Dağılımı</h3>
        </div>
        <div className="daily-production-module-list">
          {record.lotDistribution.map(lot => (
            <div key={`${record.id}-lot-${lot.id}`}>
              <strong>{lot.lotNo} / {lot.productName}</strong>
              <span>{formatNumber(lot.quantityKg, 1)} kg / SKT {formatDate(lot.expiryDate)} / {lot.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Sayım Sonuçları</h3>
        </div>
        <div className="daily-production-module-list">
          {record.countResults.map(item => (
            <div key={`${record.id}-count-${item.id}`}>
              <strong>{item.label}</strong>
              <span>Beklenen {formatNumber(item.expectedQty, 1)} / sayılan {formatNumber(item.countedQty, 1)} / {formatPercent(item.accuracy)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Fire Analizi</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Fire Oranı" value={formatPercent(record.wasteRate)} detail={`${formatNumber(record.wasteCount)} fire kaydı`} />
          <DetailMetric label="Fire Maliyeti" value={formatCurrency(record.wasteCost)} detail="depo kaynaklı etki" />
          <DetailMetric label="Picking" value={formatPercent(record.pickingPerformance)} detail={`${formatNumber(record.pickingCount)} kayıt`} />
          <DetailMetric label="Putaway" value={formatPercent(record.putawayPerformance)} detail={`${formatNumber(record.putawayCount)} kayıt`} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>İyileştirme Önerileri</h3>
        </div>
        <div className="daily-production-module-list">
          {record.improvementSuggestions.map((suggestion, index) => (
            <div key={`${record.id}-suggestion-${index}`}>
              <strong>Öneri {index + 1}</strong>
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function DetailMetric({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}){
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

const getRiskClass = (risk: WarehouseRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning'
  if(risk === 'MEDIUM') return 'warning'
  return 'success'
}

const getScoreClass = (score: number) => {
  if(score >= 88) return 'success'
  if(score >= 76) return 'warning'
  return 'danger-pill'
}
