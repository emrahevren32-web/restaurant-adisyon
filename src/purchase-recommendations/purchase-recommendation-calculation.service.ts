import type { AIAnalysisReport, AIInsight } from '../ai-analysis/ai-analysis.types'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import type { CostOptimizationItem, CostOptimizationReport } from '../cost-optimization/cost-optimization.types'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import type { ForecastPrediction, ForecastReport } from '../forecasting/forecasting.types'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { RecommendationItem, RecommendationReport } from '../recommendation-engine/recommendation-engine.types'
import type { StockItem, StockMovement, StockWasteRecord } from '../types'
import type { WasteRecord } from '../waste-management/waste.types'
import {
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'
import { createPurchaseRecommendationHistory } from './purchase-recommendation-history.service'
import { listPurchaseRecommendationRules } from './purchase-recommendation-rule.service'
import type {
  PurchaseRecommendationItem,
  PurchaseRecommendationPriority,
  PurchaseRecommendationReport,
  PurchaseRecommendationReportCreateInput,
  PurchaseRecommendationRisk,
  PurchaseRecommendationSourceModule,
  PurchaseRecommendationType
} from './purchase-recommendation.types'

type PurchaseRecommendationCalculationInput = PurchaseRecommendationReportCreateInput & {
  sourceData: KpiSourceData
  actorName: string
  getReportNo: () => string
  forecastReport?: ForecastReport
  costOptimizationReport?: CostOptimizationReport
  recommendationReport?: RecommendationReport
  aiAnalysisReport?: AIAnalysisReport
  criticalAlerts?: CriticalAlert[]
  goodsReceipts?: GoodsReceiptRecord[]
  wasteRecords?: WasteRecord[]
  decisionSuggestions?: DecisionSuggestion[]
}

type PurchaseCandidate = Partial<PurchaseRecommendationItem> & {
  recommendationType: PurchaseRecommendationType
  ruleId: string
  title: string
  reason: string
  action: string
  expectedImpact: string
  riskScore: number
}

type SourceMaps = {
  branchNameById: Map<string, string>
  stockById: Map<string, StockItem>
  supplierNameById: Map<string, string>
  productByStockId: Map<string, { id: string; name: string }>
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clamp = (
  value: number,
  min = 0,
  max = 100
) => Math.min(max, Math.max(min, value))

const toNonNegative = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundKpi(parsed) : 0
}

const addDaysToKey = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + Math.max(0, Math.ceil(days)))
  return date.toLocaleDateString('sv-SE')
}

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const isRecentDate = (
  value: string,
  days = 30
) => {
  const dateKey = getDateKey(value)
  if(!dateKey) return false
  const date = new Date(`${dateKey}T00:00:00`)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= days
}

const riskFromScore = (score: number): PurchaseRecommendationRisk => {
  if(score >= 85) return 'CRITICAL'
  if(score >= 65) return 'HIGH'
  if(score >= 35) return 'MEDIUM'
  return 'LOW'
}

const priorityFromRisk = (
  risk: PurchaseRecommendationRisk,
  score: number,
  coverageDays = 999
): PurchaseRecommendationPriority => {
  if(risk === 'CRITICAL' || score >= 85 || coverageDays <= 3) return 'URGENT'
  if(risk === 'HIGH' || score >= 65 || coverageDays <= 7) return 'HIGH'
  if(risk === 'MEDIUM') return 'NORMAL'
  return 'LOW'
}

const createMaps = (sourceData: KpiSourceData): SourceMaps => ({
  branchNameById: new Map(sourceData.branches.map(branch => [branch.id, branch.name])),
  stockById: new Map(sourceData.stockItems.map(item => [item.id, item])),
  supplierNameById: new Map(sourceData.suppliers.map(supplier => [supplier.id, supplier.name])),
  productByStockId: new Map(sourceData.productRefs
    .filter(product => product.stockItemId)
    .map(product => [product.stockItemId || '', { id: product.id, name: product.name }]))
})

const getBranchName = (
  branchId: string,
  maps: SourceMaps
) => maps.branchNameById.get(branchId) || branchId || '-'

const getStockItem = (
  sourceData: KpiSourceData,
  stockItemId = ''
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getSupplierProductOptions = (
  sourceData: KpiSourceData,
  stockItemId: string
) => sourceData.supplierProducts
  .filter(product => product.stockItemId === stockItemId && product.status !== 'PASSIVE')
  .sort((first, second) => (
    Number(second.isPreferred) - Number(first.isPreferred)
    || first.defaultUnitPrice - second.defaultUnitPrice
    || first.leadTimeDays - second.leadTimeDays
  ))

const getReceiptUnitCost = (
  sourceData: KpiSourceData,
  stockItemId: string
) => {
  const receiptCosts = sourceData.goodsReceipts
    .flatMap(receipt => receipt.items)
    .filter(item => item.stockItemId === stockItemId)
    .map(item => item.unitCost || (item.totalCost && item.acceptedQuantity ? item.totalCost / item.acceptedQuantity : 0))
    .filter(value => value > 0)

  return receiptCosts.length > 0
    ? roundKpi(sumBy(receiptCosts, value => value) / receiptCosts.length)
    : 0
}

const getUnitCost = (
  sourceData: KpiSourceData,
  stockItem: StockItem | null,
  stockItemId: string
) => {
  const supplierProduct = getSupplierProductOptions(sourceData, stockItemId)[0]
  return toNonNegative(stockItem?.averageCost)
    || toNonNegative(stockItem?.lastPurchasePrice)
    || toNonNegative(stockItem?.unitPurchasePrice)
    || toNonNegative(supplierProduct?.defaultUnitPrice)
    || getReceiptUnitCost(sourceData, stockItemId)
}

const getPreferredSupplier = (
  sourceData: KpiSourceData,
  stockItemId: string,
  maps: SourceMaps
) => {
  const options = getSupplierProductOptions(sourceData, stockItemId)
  const preferred = options.find(option => option.isPreferred) || options[0]
  if(!preferred) return null
  return {
    supplierId: preferred.supplierId,
    supplierName: maps.supplierNameById.get(preferred.supplierId) || preferred.supplierProductName || preferred.supplierId,
    unitCost: preferred.defaultUnitPrice,
    minimumOrderQuantity: preferred.minimumOrderQuantity || 0,
    leadTimeDays: preferred.leadTimeDays || 0
  }
}

const getAlternativeSupplier = (
  sourceData: KpiSourceData,
  stockItemId: string,
  currentSupplierId: string,
  currentUnitCost: number,
  maps: SourceMaps
) => {
  const alternatives = getSupplierProductOptions(sourceData, stockItemId)
    .filter(option => option.supplierId !== currentSupplierId && option.defaultUnitPrice > 0)
    .sort((first, second) => first.defaultUnitPrice - second.defaultUnitPrice)
  const candidate = alternatives[0]
  if(!candidate) return null
  const savingPercent = currentUnitCost > 0
    ? (currentUnitCost - candidate.defaultUnitPrice) / currentUnitCost * 100
    : 0

  return savingPercent >= 5
    ? {
      supplierId: candidate.supplierId,
      supplierName: maps.supplierNameById.get(candidate.supplierId) || candidate.supplierProductName || candidate.supplierId,
      unitCost: candidate.defaultUnitPrice,
      savingPercent: roundKpi(savingPercent)
    }
    : null
}

const isOutgoingMovement = (movement: StockMovement) => {
  const search = normalizeSearchText(`${movement.type} ${movement.source} ${movement.reason}`)
  return movement.nextQty < movement.previousQty
    || search.includes('cikis')
    || search.includes('fire')
    || search.includes('kullanim')
    || search.includes('recete')
}

const estimateDailyUsage = (
  sourceData: KpiSourceData,
  stockItem: StockItem
) => {
  const movementUsage = sourceData.stockMovements
    .filter(movement => movement.stockItemId === stockItem.id && isRecentDate(movement.movementDate, 30) && isOutgoingMovement(movement))
    .reduce((total, movement) => total + Math.abs(movement.qty), 0)
  const wasteUsage = sourceData.stockWasteRecords
    .filter(record => record.stockItemId === stockItem.id && record.status !== 'reversed' && isRecentDate(record.occurredAt, 30))
    .reduce((total, record) => total + Math.abs(record.qty), 0)
  const usage = roundKpi((movementUsage + wasteUsage) / 30)
  return usage > 0 ? usage : roundKpi(Math.max(stockItem.minQty / 10, stockItem.currentQty / 30, 1))
}

const calculateCoverageDays = (
  currentStock: number,
  dailyUsage: number
) => dailyUsage > 0 ? roundKpi(currentStock / dailyUsage) : 999

const calculateRecommendedQuantity = (
  stockItem: StockItem | null,
  dailyUsage: number,
  coverageDays = 14,
  minimumOrderQuantity = 0
) => {
  const minQty = toNonNegative(stockItem?.minQty)
  const currentQty = toNonNegative(stockItem?.currentQty)
  const targetStock = Math.max(minQty * 2, dailyUsage * coverageDays, minimumOrderQuantity)
  return roundKpi(Math.max(0, targetStock - currentQty, minimumOrderQuantity && currentQty <= minQty ? minimumOrderQuantity : 0))
}

const getEntityStock = (
  sourceData: KpiSourceData,
  stockItemId: string,
  entityName = ''
) => {
  const direct = getStockItem(sourceData, stockItemId)
  if(direct) return direct
  const entityKey = normalizeSearchText(entityName)
  return sourceData.stockItems.find(item => normalizeSearchText(item.name) === entityKey) || null
}

const createItem = (
  candidate: PurchaseCandidate,
  reportId: string,
  reportNo: string,
  index: number,
  maps: SourceMaps
): PurchaseRecommendationItem => {
  const riskScore = clamp(candidate.riskScore)
  const currentStock = toNonNegative(candidate.currentStock)
  const minimumStock = toNonNegative(candidate.minimumStock)
  const dailyUsageEstimate = toNonNegative(candidate.dailyUsageEstimate)
  const estimatedCoverageDays = candidate.estimatedCoverageDays === 999
    ? 999
    : roundKpi(Number(candidate.estimatedCoverageDays ?? calculateCoverageDays(currentStock, dailyUsageEstimate)))
  const risk = candidate.risk || riskFromScore(riskScore)
  const priority = candidate.priority || priorityFromRisk(risk, riskScore, estimatedCoverageDays)
  const createdAt = candidate.createdAt || new Date().toISOString()
  const productFromStock = candidate.stockItemId ? maps.productByStockId.get(candidate.stockItemId) : null
  const branchName = candidate.branchName || getBranchName(candidate.branchId || '', maps)
  const relatedEntityName = candidate.relatedEntityName
    || candidate.stockItemName
    || candidate.productName
    || candidate.supplierName
    || PURCHASE_RECOMMENDATION_TYPE_LABELS[candidate.recommendationType]

  return {
    id: candidate.id || `${reportId}_purchase_item_${index + 1}`,
    reportId,
    reportNo,
    ruleId: candidate.ruleId,
    recommendationType: candidate.recommendationType,
    priority,
    risk,
    title: candidate.title,
    description: candidate.description || candidate.title,
    reason: candidate.reason,
    action: candidate.action,
    expectedImpact: candidate.expectedImpact,
    ownerRole: candidate.ownerRole || 'Satin Alma',
    recommendedOrderQuantity: toNonNegative(candidate.recommendedOrderQuantity),
    currentStock,
    minimumStock,
    dailyUsageEstimate,
    estimatedCoverageDays,
    estimatedStockoutDate: candidate.estimatedStockoutDate || (estimatedCoverageDays < 999 ? addDaysToKey(createdAt.slice(0, 10), estimatedCoverageDays) : ''),
    expectedCost: toNonNegative(candidate.expectedCost),
    expectedSaving: toNonNegative(candidate.expectedSaving),
    unitCost: toNonNegative(candidate.unitCost),
    riskScore,
    confidenceScore: clamp(Number(candidate.confidenceScore ?? 70)),
    sourceModule: candidate.sourceModule || 'ReadModel',
    sourceId: candidate.sourceId || candidate.relatedEntityId || candidate.ruleId,
    sourceNo: candidate.sourceNo || candidate.ruleId,
    relatedModules: Array.from(new Set([
      candidate.sourceModule || 'ReadModel',
      ...(candidate.relatedModules || [])
    ].filter(Boolean))) as PurchaseRecommendationSourceModule[],
    relatedEntityType: candidate.relatedEntityType || 'ReadModel',
    relatedEntityId: candidate.relatedEntityId || candidate.stockItemId || candidate.productId || candidate.supplierId || candidate.ruleId,
    relatedEntityName,
    productId: candidate.productId || productFromStock?.id || candidate.stockItemId || '',
    productName: candidate.productName || productFromStock?.name || candidate.stockItemName || relatedEntityName,
    stockItemId: candidate.stockItemId || '',
    stockItemName: candidate.stockItemName || candidate.productName || relatedEntityName,
    categoryId: candidate.categoryId || '',
    categoryName: candidate.categoryName || candidate.categoryId || 'Satin Alma',
    branchId: candidate.branchId || '',
    branchName,
    warehouseId: candidate.warehouseId || candidate.branchId || '',
    warehouseName: candidate.warehouseName || branchName,
    supplierId: candidate.supplierId || '',
    supplierName: candidate.supplierName || (candidate.supplierId ? maps.supplierNameById.get(candidate.supplierId) || candidate.supplierId : ''),
    alternativeSupplierId: candidate.alternativeSupplierId || '',
    alternativeSupplierName: candidate.alternativeSupplierName || '',
    createdAt
  }
}

const createStockCandidates = (
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => sourceData.stockItems
  .filter(item => item.active !== false && item.minQty > 0)
  .flatMap(stockItem => {
    const dailyUsage = estimateDailyUsage(sourceData, stockItem)
    const coverageDays = calculateCoverageDays(stockItem.currentQty, dailyUsage)
    const shortagePercent = stockItem.minQty > 0
      ? Math.max(0, (stockItem.minQty - stockItem.currentQty) / stockItem.minQty * 100)
      : 0
    if(stockItem.currentQty > stockItem.minQty * 1.25 && coverageDays > 10) return []

    const preferredSupplier = getPreferredSupplier(sourceData, stockItem.id, maps)
    const unitCost = getUnitCost(sourceData, stockItem, stockItem.id)
    const recommendedQuantity = calculateRecommendedQuantity(stockItem, dailyUsage, 14, preferredSupplier?.minimumOrderQuantity || 0)
    const alternative = getAlternativeSupplier(sourceData, stockItem.id, preferredSupplier?.supplierId || '', unitCost, maps)
    const expectedSaving = alternative
      ? roundKpi((unitCost - alternative.unitCost) * recommendedQuantity)
      : 0
    const riskScore = clamp(45 + shortagePercent * 0.8 + Math.max(0, 10 - coverageDays) * 4)
    const recommendationType: PurchaseRecommendationType = stockItem.currentQty <= stockItem.minQty
      ? 'CRITICAL_STOCK'
      : 'STOCKOUT_SOON'

    return [{
      recommendationType,
      ruleId: recommendationType === 'CRITICAL_STOCK'
        ? 'purchase-recommendation-critical-stock'
        : 'purchase-recommendation-stockout-soon',
      title: `${stockItem.name} icin satin alma onerisi`,
      description: 'Stok seviyesi ve tuketim hizi satin alma ihtiyaci olarak analiz edildi.',
      reason: `${stockItem.name} mevcut stok ${formatNumber(stockItem.currentQty, 2)} ${stockItem.unit}; minimum ${formatNumber(stockItem.minQty, 2)} ${stockItem.unit}; tahmini kapsama ${formatNumber(coverageDays, 1)} gun.`,
      action: 'Satin alma ekibi manuel siparis miktari ve tedarikci kosullarini degerlendirmeli.',
      expectedImpact: 'Stok tukenmesi ve uretim kesintisi riski azalir.',
      recommendedOrderQuantity: recommendedQuantity,
      currentStock: stockItem.currentQty,
      minimumStock: stockItem.minQty,
      dailyUsageEstimate: dailyUsage,
      estimatedCoverageDays: coverageDays,
      estimatedStockoutDate: coverageDays < 999 ? addDaysToKey(getTodayKey(), coverageDays) : '',
      expectedCost: roundKpi(recommendedQuantity * unitCost),
      expectedSaving,
      unitCost,
      riskScore,
      confidenceScore: clamp(65 + (sourceData.stockMovements.some(movement => movement.stockItemId === stockItem.id) ? 15 : 0) + (preferredSupplier ? 8 : 0)),
      sourceModule: 'Stock',
      sourceId: stockItem.id,
      sourceNo: stockItem.sku || stockItem.barcode || stockItem.id,
      relatedModules: ['Stock', 'Warehouse', 'Suppliers', 'KPIDashboard'],
      relatedEntityType: 'StockItem',
      relatedEntityId: stockItem.id,
      relatedEntityName: stockItem.name,
      stockItemId: stockItem.id,
      stockItemName: stockItem.name,
      categoryId: stockItem.categoryId,
      categoryName: stockItem.categoryId || 'Stok',
      branchId: stockItem.branchId,
      branchName: getBranchName(stockItem.branchId, maps),
      warehouseId: stockItem.branchId,
      warehouseName: getBranchName(stockItem.branchId, maps),
      supplierId: preferredSupplier?.supplierId || '',
      supplierName: preferredSupplier?.supplierName || stockItem.lastSupplierName || '',
      alternativeSupplierId: alternative?.supplierId || '',
      alternativeSupplierName: alternative?.supplierName || ''
    }]
  })

const createForecastCandidates = (
  forecastReport: ForecastReport | undefined,
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => (forecastReport?.predictions || [])
  .filter(prediction => (
    prediction.forecastType === 'PURCHASING'
    || prediction.forecastType === 'STOCK'
    || prediction.forecastType === 'DEMAND'
    || prediction.forecastType === 'WASTE'
  ))
  .filter(prediction => (
    prediction.riskLevel === 'HIGH'
    || prediction.riskLevel === 'CRITICAL'
    || prediction.daysToCritical <= 10
    || prediction.growthPercent >= 10
    || prediction.seasonalityScore >= 25
  ))
  .slice(0, 12)
  .map(prediction => {
    const stockItem = getEntityStock(sourceData, prediction.stockItemId, prediction.stockItemName || prediction.entityName)
    const preferredSupplier = getPreferredSupplier(sourceData, stockItem?.id || prediction.stockItemId, maps)
    const unitCost = getUnitCost(sourceData, stockItem, stockItem?.id || prediction.stockItemId)
    const dailyUsage = stockItem ? estimateDailyUsage(sourceData, stockItem) : Math.max(1, prediction.expectedDemand / 7)
    const recommendedQuantity = Math.max(
      calculateRecommendedQuantity(stockItem, dailyUsage, 14, preferredSupplier?.minimumOrderQuantity || 0),
      prediction.expectedDemand || prediction.expectedValue || dailyUsage * 7
    )
    const type: PurchaseRecommendationType = prediction.seasonalityScore >= 25
      ? 'SEASONAL_PURCHASE'
      : prediction.daysToCritical <= 7
        ? 'STOCKOUT_SOON'
        : 'FORECAST_ORDER'
    const coverageDays = stockItem ? calculateCoverageDays(stockItem.currentQty, dailyUsage) : prediction.daysToCritical

    return {
      recommendationType: type,
      ruleId: type === 'SEASONAL_PURCHASE'
        ? 'purchase-recommendation-seasonal-purchase'
        : type === 'STOCKOUT_SOON'
          ? 'purchase-recommendation-stockout-soon'
          : 'purchase-recommendation-forecast-order',
      title: `${prediction.entityName} tahmin kaynaklı satın alma`,
      description: 'Tahminleme Motoru çıktısı satın alma ihtiyacına çevrildi.',
      reason: prediction.evidence || `${prediction.entityName} beklenen deger ${formatNumber(prediction.expectedValue, 1)}, buyume ${formatNumber(prediction.growthPercent, 1)}%.`,
      action: prediction.recommendation || 'Forecast sonucuna gore satin alma miktari ve teslim tarihi manuel planlanmali.',
      expectedImpact: 'Tahmin edilen talep artisi stok kesintisine donusmeden yonetilir.',
      recommendedOrderQuantity: roundKpi(recommendedQuantity),
      currentStock: stockItem?.currentQty || prediction.expectedStock,
      minimumStock: stockItem?.minQty || prediction.minimumValue,
      dailyUsageEstimate: roundKpi(dailyUsage),
      estimatedCoverageDays: coverageDays,
      estimatedStockoutDate: prediction.daysToCritical < 999 ? addDaysToKey(forecastReport?.reportDate || getTodayKey(), prediction.daysToCritical) : '',
      expectedCost: roundKpi(recommendedQuantity * unitCost),
      expectedSaving: roundKpi((prediction.riskScore * 12) + (prediction.growthPercent > 0 ? prediction.growthPercent * 20 : 0)),
      unitCost,
      riskScore: prediction.riskScore,
      confidenceScore: prediction.confidenceScore,
      sourceModule: 'Forecasting',
      sourceId: prediction.id,
      sourceNo: prediction.reportNo,
      relatedModules: ['Forecasting', 'Stock', 'Suppliers'],
      relatedEntityType: prediction.entityType || 'ForecastPrediction',
      relatedEntityId: prediction.entityId || prediction.id,
      relatedEntityName: prediction.entityName,
      productId: prediction.productId,
      productName: prediction.productName,
      stockItemId: stockItem?.id || prediction.stockItemId,
      stockItemName: stockItem?.name || prediction.stockItemName || prediction.entityName,
      categoryId: prediction.categoryId,
      categoryName: prediction.categoryName || prediction.forecastType,
      branchId: prediction.branchId || stockItem?.branchId || '',
      branchName: prediction.branchName || getBranchName(stockItem?.branchId || '', maps),
      warehouseId: prediction.branchId || stockItem?.branchId || '',
      warehouseName: prediction.branchName || getBranchName(stockItem?.branchId || '', maps),
      supplierId: prediction.supplierId || preferredSupplier?.supplierId || '',
      supplierName: prediction.supplierName || preferredSupplier?.supplierName || ''
    }
  })

const createCostCandidates = (
  costReport: CostOptimizationReport | undefined
): PurchaseCandidate[] => (costReport?.items || [])
  .filter(item => (
    item.savingPotential > 0
    && (
      item.category === 'RAW_MATERIAL'
      || item.category === 'WASTE'
      || item.category === 'STORAGE'
      || item.sourceModule === 'PurchaseOrders'
      || item.supplierId
    )
  ))
  .slice(0, 10)
  .map(item => ({
    recommendationType: item.supplierId ? 'ALTERNATIVE_SUPPLIER' : 'COST_ADVANTAGE',
    ruleId: item.supplierId
      ? 'purchase-recommendation-alternative-supplier'
      : 'purchase-recommendation-cost-advantage',
    title: `${item.title} satin alma etkisi`,
    description: 'Maliyet Optimizasyonu çıktısı satın alma karar sinyaline çevrildi.',
    reason: item.reason,
    action: item.action || 'Tedarikci fiyatlari, alis miktari ve teslim sartlari karsilastirilmali.',
    expectedImpact: item.expectedImpact || 'Beklenen satin alma maliyeti azalabilir.',
    recommendedOrderQuantity: Math.max(1, item.savingPotential / Math.max(1, item.unitCost || 1)),
    currentStock: 0,
    minimumStock: 0,
    dailyUsageEstimate: 0,
    estimatedCoverageDays: 999,
    expectedCost: item.baselineCost || item.totalCost,
    expectedSaving: item.savingPotential,
    unitCost: item.unitCost,
    riskScore: item.riskScore,
    confidenceScore: item.confidenceScore,
    sourceModule: 'CostOptimization',
    sourceId: item.id,
    sourceNo: item.reportNo,
    relatedModules: ['CostOptimization', 'CostEngine', 'PurchaseOrders', 'DecisionSupport'],
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
    relatedEntityName: item.relatedEntityName,
    productId: item.productId,
    productName: item.productName,
    branchId: item.branchId,
    branchName: item.branchName,
    warehouseId: item.warehouseId,
    warehouseName: item.warehouseName,
    supplierId: item.supplierId,
    supplierName: item.supplierName,
    categoryId: item.category,
    categoryName: item.category
  }))

const createRecommendationEngineCandidates = (
  recommendationReport: RecommendationReport | undefined
): PurchaseCandidate[] => (recommendationReport?.items || [])
  .filter(item => (
    item.recommendationType === 'PURCHASING'
    || item.recommendationType === 'STOCK'
    || item.recommendationType === 'WASTE'
    || item.ruleId.includes('purchase')
    || item.ruleId.includes('stock')
  ))
  .filter(item => item.risk === 'HIGH' || item.risk === 'CRITICAL' || item.priority === 'URGENT')
  .slice(0, 10)
  .map(item => ({
    recommendationType: item.recommendationType === 'WASTE'
      ? 'WASTE_REPLENISHMENT'
      : item.recommendationType === 'STOCK'
        ? 'STOCKOUT_SOON'
        : 'FORECAST_ORDER',
    ruleId: item.recommendationType === 'WASTE'
      ? 'purchase-recommendation-waste-replenishment'
      : 'purchase-recommendation-forecast-order',
    title: `${item.title} satin alma onerisi`,
    description: 'Öneri Motoru çıktısı satın alma ekip aksiyonuna çevrildi.',
    reason: item.reason,
    action: item.action,
    expectedImpact: item.expectedImpact,
    recommendedOrderQuantity: Math.max(1, item.expectedCostImpact / 100),
    expectedCost: item.expectedCostImpact,
    expectedSaving: item.expectedBenefitScore * 10,
    riskScore: item.riskScore,
    confidenceScore: item.confidenceScore,
    sourceModule: 'RecommendationEngine',
    sourceId: item.id,
    sourceNo: item.reportNo,
    relatedModules: ['RecommendationEngine', 'DecisionSupport'],
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
    relatedEntityName: item.relatedEntityName,
    productId: item.productId,
    productName: item.productName,
    stockItemId: item.stockItemId,
    stockItemName: item.stockItemName,
    branchId: item.branchId,
    branchName: item.branchName,
    supplierId: item.supplierId,
    supplierName: item.supplierName
  }))

const createAICandidates = (
  aiReport: AIAnalysisReport | undefined
): PurchaseCandidate[] => (aiReport?.insights || [])
  .filter((insight: AIInsight) => (
    insight.analysisTitle === 'STOCK'
    || insight.analysisTitle === 'WASTE'
    || insight.sourceModule === 'PurchaseOrders'
    || insight.sourceModule === 'GoodsReceipt'
    || insight.sourceModule === 'Stock'
  ))
  .filter(insight => insight.severity === 'HIGH' || insight.severity === 'CRITICAL' || insight.riskScore >= 65)
  .slice(0, 8)
  .map(insight => ({
    recommendationType: insight.analysisTitle === 'WASTE' ? 'WASTE_REPLENISHMENT' : 'FORECAST_ORDER',
    ruleId: insight.analysisTitle === 'WASTE'
      ? 'purchase-recommendation-waste-replenishment'
      : 'purchase-recommendation-forecast-order',
    title: `${insight.title} satin alma sinyali`,
    description: 'AI Analysis read-model insight satin alma onerisine cevrildi.',
    reason: insight.evidence || insight.summary,
    action: insight.recommendedAction || 'Satin alma ekip degerlendirmesine alinmali.',
    expectedImpact: insight.expectedImpact,
    recommendedOrderQuantity: Math.max(1, insight.impactScore / 5),
    expectedCost: insight.impactScore * 250,
    expectedSaving: insight.expectedGainScore * 40,
    riskScore: insight.riskScore,
    confidenceScore: insight.confidenceScore,
    sourceModule: 'AIAnalysis',
    sourceId: insight.id,
    sourceNo: insight.reportNo,
    relatedModules: ['AIAnalysis', 'RecommendationEngine', 'Forecasting'],
    relatedEntityType: insight.relatedEntityType,
    relatedEntityId: insight.relatedEntityId,
    relatedEntityName: insight.relatedEntityName,
    branchId: insight.branchId,
    branchName: insight.branchName,
    categoryId: insight.categoryId,
    categoryName: insight.categoryName
  }))

const createAlertCandidates = (
  alerts: CriticalAlert[] | undefined,
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => (alerts || [])
  .filter(alert => alert.status === 'ACTIVE')
  .filter(alert => (
    alert.category === 'STOCK'
    || alert.category === 'GOODS_RECEIPT'
    || alert.sourceModule === 'Stock'
    || alert.sourceModule === 'GoodsReceipt'
    || normalizeSearchText(`${alert.title} ${alert.reason}`).includes('stok')
    || normalizeSearchText(`${alert.title} ${alert.reason}`).includes('satin')
  ))
  .slice(0, 10)
  .map(alert => {
    const stockItem = getEntityStock(sourceData, alert.relatedEntityId, alert.relatedEntityName)
    const dailyUsage = stockItem ? estimateDailyUsage(sourceData, stockItem) : 0
    const recommendedQuantity = stockItem ? calculateRecommendedQuantity(stockItem, dailyUsage, 10) : Math.max(1, alert.riskScore / 8)
    const unitCost = getUnitCost(sourceData, stockItem, stockItem?.id || '')

    return {
      recommendationType: alert.category === 'GOODS_RECEIPT' ? 'ALTERNATIVE_SUPPLIER' : 'CRITICAL_STOCK',
      ruleId: alert.category === 'GOODS_RECEIPT'
        ? 'purchase-recommendation-alternative-supplier'
        : 'purchase-recommendation-critical-stock',
      title: `${alert.title} icin satin alma kontrolu`,
      description: 'Kritik Alarm sinyali satın alma takip önerisine çevrildi.',
      reason: alert.reason,
      action: alert.recommendedAction || 'Satin alma sorumlusu kritik alarmi incelemeli.',
      expectedImpact: alert.expectedImpact || 'Kritik stok ve tedarik riski dusurulur.',
      recommendedOrderQuantity: recommendedQuantity,
      currentStock: stockItem?.currentQty || 0,
      minimumStock: stockItem?.minQty || 0,
      dailyUsageEstimate: dailyUsage,
      estimatedCoverageDays: stockItem ? calculateCoverageDays(stockItem.currentQty, dailyUsage) : 999,
      expectedCost: roundKpi(recommendedQuantity * unitCost),
      expectedSaving: alert.impactScore * 20,
      unitCost,
      riskScore: alert.riskScore,
      confidenceScore: clamp(70 + alert.repeatCount * 4),
      sourceModule: 'CriticalAlerts',
      sourceId: alert.id,
      sourceNo: alert.alertNo,
      relatedModules: ['CriticalAlerts', 'Stock', 'GoodsReceipt'],
      relatedEntityType: alert.relatedEntityType,
      relatedEntityId: alert.relatedEntityId,
      relatedEntityName: alert.relatedEntityName,
      stockItemId: stockItem?.id || '',
      stockItemName: stockItem?.name || alert.relatedEntityName,
      branchId: alert.branchId || stockItem?.branchId || '',
      branchName: alert.branchName || getBranchName(stockItem?.branchId || '', maps),
      warehouseId: alert.branchId || stockItem?.branchId || '',
      warehouseName: alert.branchName || getBranchName(stockItem?.branchId || '', maps)
    }
  })

const createGoodsReceiptCandidates = (
  receipts: GoodsReceiptRecord[] | undefined,
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => (receipts || [])
  .filter(receipt => receipt.status === 'REJECTED' || receipt.status === 'PARTIAL_ACCEPTED')
  .flatMap(receipt => receipt.items
    .filter(item => item.rejectedQuantity > 0 || receipt.status === 'REJECTED')
    .slice(0, 4)
    .map(item => {
      const stockItem = getStockItem(sourceData, item.stockItemId)
      const unitCost = item.unitCost || getUnitCost(sourceData, stockItem, item.stockItemId)
      const rejectedQuantity = item.rejectedQuantity || Math.max(0, item.receivedQuantity - item.acceptedQuantity)
      const alternative = getAlternativeSupplier(sourceData, item.stockItemId, receipt.supplierId, unitCost, maps)
      const riskScore = clamp(60 + (rejectedQuantity / Math.max(1, item.receivedQuantity || item.orderedQuantity)) * 45)

      return {
        recommendationType: alternative ? 'ALTERNATIVE_SUPPLIER' : 'WASTE_REPLENISHMENT',
        ruleId: alternative
          ? 'purchase-recommendation-alternative-supplier'
          : 'purchase-recommendation-waste-replenishment',
        title: `${item.stockItemName || item.productName || item.stockItemId} mal kabul sonrasi satin alma`,
        description: 'Mal kabul red/kismi kabul sonucu satin alma yenileme onerisine cevrildi.',
        reason: `${receipt.receiptNo} kaydinda ${formatNumber(rejectedQuantity, 2)} ${item.unit} red/kabul disi miktar var.`,
        action: alternative
          ? 'Alternatif tedarikci fiyat ve kalite kosullari karsilastirilmali.'
          : 'Eksilen miktar icin satin alma ihtiyaci manuel degerlendirilmeli.',
        expectedImpact: 'Kalite reddi kaynakli stok acigi azalir.',
        recommendedOrderQuantity: roundKpi(rejectedQuantity),
        currentStock: stockItem?.currentQty || 0,
        minimumStock: stockItem?.minQty || 0,
        dailyUsageEstimate: stockItem ? estimateDailyUsage(sourceData, stockItem) : 0,
        estimatedCoverageDays: stockItem ? calculateCoverageDays(stockItem.currentQty, estimateDailyUsage(sourceData, stockItem)) : 999,
        expectedCost: roundKpi(rejectedQuantity * unitCost),
        expectedSaving: alternative ? roundKpi((unitCost - alternative.unitCost) * rejectedQuantity) : 0,
        unitCost,
        riskScore,
        confidenceScore: 82,
        sourceModule: 'GoodsReceipt',
        sourceId: receipt.id,
        sourceNo: receipt.receiptNo,
        relatedModules: ['GoodsReceipt', 'Suppliers', 'Stock', 'WasteManagement'],
        relatedEntityType: 'GoodsReceiptItem',
        relatedEntityId: item.id,
        relatedEntityName: item.stockItemName || item.productName || item.stockItemId,
        stockItemId: item.stockItemId,
        stockItemName: item.stockItemName || item.productName || stockItem?.name || item.stockItemId,
        productName: item.productName || item.stockItemName,
        branchId: stockItem?.branchId || '',
        branchName: getBranchName(stockItem?.branchId || '', maps),
        warehouseId: receipt.warehouseId || stockItem?.branchId || '',
        warehouseName: receipt.warehouseName || getBranchName(stockItem?.branchId || '', maps),
        supplierId: receipt.supplierId,
        supplierName: receipt.supplierName || maps.supplierNameById.get(receipt.supplierId) || '',
        alternativeSupplierId: alternative?.supplierId || '',
        alternativeSupplierName: alternative?.supplierName || ''
      }
    }))

const createWasteCandidates = (
  wasteRecords: WasteRecord[] | undefined,
  sourceWasteRecords: StockWasteRecord[],
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => {
  const aggregates = new Map<string, {
    stockItemId: string
    stockItemName: string
    productId: string
    productName: string
    branchId: string
    warehouseId: string
    warehouseName: string
    supplierId: string
    supplierName: string
    quantity: number
    cost: number
    latestDate: string
  }>()

  const addWaste = (
    stockItemId: string,
    stockItemName: string,
    quantity: number,
    cost: number,
    dateValue: string,
    partial: Partial<{ productId: string; productName: string; branchId: string; warehouseId: string; warehouseName: string; supplierId: string; supplierName: string }>
  ) => {
    if(quantity <= 0) return
    const stockItem = getStockItem(sourceData, stockItemId)
    const key = stockItemId || stockItemName
    if(!key) return
    const previous = aggregates.get(key)
    aggregates.set(key, {
      stockItemId,
      stockItemName: stockItemName || stockItem?.name || key,
      productId: partial.productId || previous?.productId || '',
      productName: partial.productName || previous?.productName || stockItemName,
      branchId: partial.branchId || previous?.branchId || stockItem?.branchId || '',
      warehouseId: partial.warehouseId || previous?.warehouseId || stockItem?.branchId || '',
      warehouseName: partial.warehouseName || previous?.warehouseName || getBranchName(stockItem?.branchId || '', maps),
      supplierId: partial.supplierId || previous?.supplierId || '',
      supplierName: partial.supplierName || previous?.supplierName || '',
      quantity: roundKpi((previous?.quantity || 0) + quantity),
      cost: roundKpi((previous?.cost || 0) + cost),
      latestDate: previous?.latestDate && previous.latestDate > dateValue ? previous.latestDate : dateValue
    })
  }

  ;(wasteRecords || [])
    .filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED')
    .forEach(record => {
      addWaste(record.stockItemId, record.stockItemName, record.quantity, record.totalCost, record.date, record)
    })

  sourceWasteRecords
    .filter(record => record.status !== 'reversed')
    .forEach(record => {
      addWaste(record.stockItemId, record.stockItemName, record.qty, record.estimatedTotalCost || 0, record.occurredAt, {
        branchId: record.branchId
      })
    })

  return Array.from(aggregates.values())
    .filter(row => row.quantity > 0)
    .sort((first, second) => second.cost - first.cost || second.quantity - first.quantity)
    .slice(0, 8)
    .map(row => {
      const stockItem = getStockItem(sourceData, row.stockItemId)
      const dailyUsage = stockItem ? estimateDailyUsage(sourceData, stockItem) : row.quantity / 30
      const unitCost = getUnitCost(sourceData, stockItem, row.stockItemId) || (row.cost / Math.max(1, row.quantity))
      const recommendedQuantity = roundKpi(Math.max(row.quantity * 1.1, dailyUsage * 3))
      const riskScore = clamp(55 + row.quantity * 1.5 + row.cost / 500)

      return {
        recommendationType: 'WASTE_REPLENISHMENT',
        ruleId: 'purchase-recommendation-waste-replenishment',
        title: `${row.stockItemName} fire kaynakli yenileme`,
        description: 'Fire kayitlari satin alma yenileme ihtiyacina cevrildi.',
        reason: `${row.stockItemName} icin ${formatNumber(row.quantity, 2)} fire ve ${formatCurrency(row.cost)} maliyet etkisi tespit edildi.`,
        action: 'Fire nedeniyle eksilen miktar satin alma planina manuel eklenmeli.',
        expectedImpact: 'Fire kaynakli stok acigi ve uretim gecikmesi riski azalir.',
        recommendedOrderQuantity: recommendedQuantity,
        currentStock: stockItem?.currentQty || 0,
        minimumStock: stockItem?.minQty || 0,
        dailyUsageEstimate: dailyUsage,
        estimatedCoverageDays: stockItem ? calculateCoverageDays(stockItem.currentQty, dailyUsage) : 999,
        expectedCost: roundKpi(recommendedQuantity * unitCost),
        expectedSaving: roundKpi(row.cost * 0.15),
        unitCost,
        riskScore,
        confidenceScore: 76,
        sourceModule: 'WasteManagement',
        sourceId: row.stockItemId || row.stockItemName,
        sourceNo: 'WasteManagement',
        relatedModules: ['WasteManagement', 'Stock', 'GoodsReceipt'],
        relatedEntityType: 'WasteRecord',
        relatedEntityId: row.stockItemId || row.stockItemName,
        relatedEntityName: row.stockItemName,
        productId: row.productId,
        productName: row.productName,
        stockItemId: row.stockItemId,
        stockItemName: row.stockItemName,
        branchId: row.branchId,
        branchName: getBranchName(row.branchId, maps),
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        supplierId: row.supplierId,
        supplierName: row.supplierName
      }
    })
}

const createSupplierOpportunityCandidates = (
  sourceData: KpiSourceData,
  maps: SourceMaps
): PurchaseCandidate[] => sourceData.supplierProducts
  .filter(product => product.status !== 'PASSIVE' && product.minimumOrderQuantity > 0 && product.defaultUnitPrice > 0)
  .map<PurchaseCandidate | null>(product => {
    const stockItem = getStockItem(sourceData, product.stockItemId)
    if(!stockItem || stockItem.currentQty > stockItem.minQty * 3) return null
    const dailyUsage = estimateDailyUsage(sourceData, stockItem)
    const recommendedQuantity = Math.max(product.minimumOrderQuantity, calculateRecommendedQuantity(stockItem, dailyUsage, 21, product.minimumOrderQuantity))
    if(recommendedQuantity <= 0) return null
    const expectedCost = roundKpi(recommendedQuantity * product.defaultUnitPrice)
    const expectedSaving = roundKpi(expectedCost * (product.isPreferred ? 0.04 : 0.02))

    return {
      recommendationType: 'BULK_BUY',
      ruleId: 'purchase-recommendation-bulk-buy',
      title: `${stockItem.name} icin toplu alim firsati`,
      description: 'Supplier MOQ ve stok ihtiyaci birlikte degerlendirildi.',
      reason: `${product.minimumOrderQuantity} ${product.purchaseUnit} minimum siparis kosulu ile ${formatCurrency(expectedSaving)} potansiyel avantaj hesaplandi.`,
      action: 'Toplu alim fiyati ve depo kapasitesi manuel karsilastirilmali.',
      expectedImpact: 'Birim satin alma maliyeti ve acil siparis riski azalabilir.',
      recommendedOrderQuantity: roundKpi(recommendedQuantity),
      currentStock: stockItem.currentQty,
      minimumStock: stockItem.minQty,
      dailyUsageEstimate: dailyUsage,
      estimatedCoverageDays: calculateCoverageDays(stockItem.currentQty, dailyUsage),
      expectedCost,
      expectedSaving,
      unitCost: product.defaultUnitPrice,
      riskScore: clamp(40 + Math.max(0, stockItem.minQty * 3 - stockItem.currentQty) / Math.max(1, stockItem.minQty) * 12),
      confidenceScore: 72,
      sourceModule: 'Suppliers',
      sourceId: product.id,
      sourceNo: product.supplierSku,
      relatedModules: ['Suppliers', 'Stock', 'PurchaseOrders'],
      relatedEntityType: 'SupplierProduct',
      relatedEntityId: product.id,
      relatedEntityName: stockItem.name,
      stockItemId: stockItem.id,
      stockItemName: stockItem.name,
      categoryId: stockItem.categoryId || product.categoryId || '',
      categoryName: stockItem.categoryId || product.categoryId || 'Supplier',
      branchId: stockItem.branchId,
      branchName: getBranchName(stockItem.branchId, maps),
      warehouseId: stockItem.branchId,
      warehouseName: getBranchName(stockItem.branchId, maps),
      supplierId: product.supplierId,
      supplierName: maps.supplierNameById.get(product.supplierId) || product.supplierProductName || product.supplierId
    }
  })
  .filter((item): item is PurchaseCandidate => Boolean(item))
  .sort((first, second) => (second.expectedSaving || 0) - (first.expectedSaving || 0))
  .slice(0, 8)

const createDecisionCandidates = (
  decisionSuggestions: DecisionSuggestion[] | undefined
): PurchaseCandidate[] => (decisionSuggestions || [])
  .filter(suggestion => (
    suggestion.category === 'Purchasing'
    || suggestion.ruleId.includes('purchase')
    || suggestion.ruleId.includes('stock')
    || suggestion.ruleId.includes('forecast')
    || suggestion.ruleId.includes('waste')
  ))
  .slice(0, 8)
  .map(suggestion => ({
    recommendationType: suggestion.ruleId.includes('waste')
      ? 'WASTE_REPLENISHMENT'
      : suggestion.ruleId.includes('stock')
        ? 'CRITICAL_STOCK'
        : 'FORECAST_ORDER',
    ruleId: 'purchase-recommendation-forecast-order',
    title: `${suggestion.title} satin alma karar sinyali`,
    description: 'Karar Destek önerisi satın alma önerisi analiz modeli formatına çevrildi.',
    reason: suggestion.reason,
    action: suggestion.recommendation.action,
    expectedImpact: suggestion.recommendation.expectedImpact,
    recommendedOrderQuantity: Math.max(1, suggestion.riskScore / 10),
    expectedCost: suggestion.riskScore * 200,
    expectedSaving: suggestion.riskScore * 18,
    riskScore: suggestion.riskScore,
    confidenceScore: 74,
    sourceModule: 'DecisionSupport',
    sourceId: suggestion.id,
    sourceNo: suggestion.ruleId,
    relatedModules: ['DecisionSupport'],
    relatedEntityType: suggestion.relatedEntityType,
    relatedEntityId: suggestion.relatedEntityId,
    relatedEntityName: suggestion.title,
    productId: suggestion.relatedProductId,
    stockItemId: suggestion.relatedProductId,
    branchId: suggestion.branchId,
    warehouseId: suggestion.warehouseId,
    supplierId: suggestion.relatedSupplierId
  }))

const dedupeCandidates = (
  items: PurchaseRecommendationItem[]
) => Array.from(items.reduce<Map<string, PurchaseRecommendationItem>>((map, item) => {
  const key = [
    item.recommendationType,
    item.stockItemId || item.productId || item.relatedEntityId,
    item.supplierId,
    item.alternativeSupplierId
  ].join('|')
  const previous = map.get(key)
  if(!previous || item.riskScore + item.expectedSaving / 100 > previous.riskScore + previous.expectedSaving / 100){
    map.set(key, item)
  }
  return map
}, new Map()).values())
  .sort((first, second) => (
    second.riskScore - first.riskScore
    || second.expectedSaving - first.expectedSaving
    || first.title.localeCompare(second.title, 'tr-TR')
  ))
  .slice(0, 48)
  .map((item, index) => ({ ...item, id: `${item.reportId}_purchase_item_${index + 1}` }))

export const calculatePurchaseRecommendationReport = (
  input: PurchaseRecommendationCalculationInput
): PurchaseRecommendationReport => {
  const reportNo = input.getReportNo()
  const reportId = `purchase_recommendation_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()
  const maps = createMaps(input.sourceData)
  const candidates = [
    ...createStockCandidates(input.sourceData, maps),
    ...createForecastCandidates(input.forecastReport, input.sourceData, maps),
    ...createCostCandidates(input.costOptimizationReport),
    ...createRecommendationEngineCandidates(input.recommendationReport),
    ...createAICandidates(input.aiAnalysisReport),
    ...createAlertCandidates(input.criticalAlerts, input.sourceData, maps),
    ...createGoodsReceiptCandidates(input.goodsReceipts, input.sourceData, maps),
    ...createWasteCandidates(input.wasteRecords, input.sourceData.stockWasteRecords, input.sourceData, maps),
    ...createSupplierOpportunityCandidates(input.sourceData, maps),
    ...createDecisionCandidates(input.decisionSuggestions)
  ]
  const scopedCandidates = input.scope === 'all'
    ? candidates
    : candidates.filter(candidate => candidate.recommendationType === input.scope)
  const items = dedupeCandidates(scopedCandidates.map((candidate, index) => createItem(candidate, reportId, reportNo, index, maps)))

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate || getTodayKey(),
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || input.actorName,
    description: input.description || 'Tahminleme, Maliyet Optimizasyonu, Öneri Motoru, Yapay Zeka Analizi, Kritik Alarmlar, Stok, Mal Kabul ve Fire analiz modeli verilerinden satın alma önerileri üretildi.',
    items,
    rules: listPurchaseRecommendationRules(),
    history: [
      createPurchaseRecommendationHistory(reportId, 'CREATED', input.actorName, `${reportNo} purchase recommendation read-model olarak olusturuldu.`),
      createPurchaseRecommendationHistory(reportId, 'CALCULATED', input.actorName, `${items.length} satin alma onerisi hesaplandi.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'purchase-recommendation-engine',
    revisionNo: 1,
    createdBy: input.actorName,
    createdAt,
    updatedAt: createdAt
  }
}

export const PurchaseRecommendationCalculationService = {
  calculate: calculatePurchaseRecommendationReport
}
