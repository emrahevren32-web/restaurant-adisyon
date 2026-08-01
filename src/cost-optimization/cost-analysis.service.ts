import type { AIAnalysisReport } from '../ai-analysis/ai-analysis.types'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import type { CostEngine } from '../cost-engine/cost-engine.types'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { ForecastService } from '../forecasting/forecast.service'
import type { ForecastPrediction } from '../forecasting/forecasting.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { calculateRecommendationReport } from '../recommendation-engine/recommendation-calculation.service'
import type {
  RecommendationItem,
  RecommendationReport
} from '../recommendation-engine/recommendation-engine.types'
import { WasteService } from '../waste-management/waste.service'
import { createCostHistory } from './cost-history.service'
import {
  calculateConfidenceScore,
  calculateCostRiskScore,
  calculateRoiEstimate,
  calculateSavingPotential,
  mapCostPriority,
  mapCostRisk
} from './cost-calculation.service'
import type {
  CostOptimizationCategory,
  CostOptimizationItem,
  CostOptimizationReport,
  CostOptimizationReportCreateInput,
  CostOptimizationSourceModule,
  CostOpportunity
} from './cost-optimization.types'

type CostAnalysisInput = CostOptimizationReportCreateInput & {
  sourceData: KpiSourceData
  decisionSuggestions?: DecisionSuggestion[]
  recommendationReport?: RecommendationReport
  aiAnalysisReport?: AIAnalysisReport
  getReportNo: () => string
  actorName: string
}

type CostItemInput = {
  reportId: string
  reportNo: string
  category: CostOptimizationCategory
  title: string
  description: string
  reason: string
  action: string
  expectedImpact: string
  ownerRole: string
  unitCost?: number
  totalCost: number
  baselineCost?: number
  savingPotential: number
  implementationCost?: number
  riskScore: number
  confidenceScore?: number
  sourceModule: CostOptimizationSourceModule
  sourceId: string
  sourceNo: string
  relatedModules?: CostOptimizationSourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  productId?: string
  productName?: string
  branchId?: string
  branchName?: string
  warehouseId?: string
  warehouseName?: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  supplierId?: string
  supplierName?: string
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')

const createCostItem = (
  input: CostItemInput
): CostOptimizationItem => {
  const savingPotential = roundKpi(Math.max(0, input.savingPotential))
  const baselineCost = roundKpi(Math.max(input.baselineCost ?? input.totalCost, savingPotential))
  const optimizedCost = roundKpi(Math.max(0, baselineCost - savingPotential))
  const expectedMonthlyGain = savingPotential
  const expectedAnnualGain = roundKpi(expectedMonthlyGain * 12)
  const confidenceScore = roundKpi(Math.max(0, Math.min(100, input.confidenceScore ?? calculateConfidenceScore((input.relatedModules || []).length + 1, input.riskScore))))
  const riskScore = roundKpi(Math.max(0, Math.min(100, input.riskScore)))
  const priority = mapCostPriority(riskScore, savingPotential, confidenceScore)
  const id = `cost_optimization_${input.reportNo}_${input.category}_${input.sourceModule}_${input.relatedEntityId || input.sourceId}`.replace(/[^a-zA-Z0-9_]+/g, '_')

  return {
    id,
    reportId: input.reportId,
    reportNo: input.reportNo,
    category: input.category,
    priority,
    risk: mapCostRisk(riskScore),
    title: input.title,
    description: input.description,
    reason: input.reason,
    action: input.action,
    expectedImpact: input.expectedImpact,
    ownerRole: input.ownerRole,
    unitCost: roundKpi(Math.max(0, input.unitCost || 0)),
    totalCost: roundKpi(Math.max(0, input.totalCost)),
    baselineCost,
    optimizedCost,
    savingPotential,
    expectedMonthlyGain,
    expectedAnnualGain,
    roiEstimate: calculateRoiEstimate(expectedAnnualGain, input.implementationCost ?? Math.max(1000, savingPotential * 1.8)),
    riskScore,
    confidenceScore,
    sourceModule: input.sourceModule,
    sourceId: input.sourceId,
    sourceNo: input.sourceNo,
    relatedModules: Array.from(new Set([input.sourceModule, ...(input.relatedModules || [])])),
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityName: input.relatedEntityName,
    productId: input.productId || '',
    productName: input.productName || '',
    branchId: input.branchId || '',
    branchName: input.branchName || '',
    warehouseId: input.warehouseId || '',
    warehouseName: input.warehouseName || '',
    productionLineId: input.productionLineId || '',
    productionLineName: input.productionLineName || '',
    machineId: input.machineId || '',
    machineCode: input.machineCode || '',
    machineName: input.machineName || '',
    supplierId: input.supplierId || '',
    supplierName: input.supplierName || '',
    createdAt: new Date().toISOString()
  }
}

const toOpportunity = (
  item: CostOptimizationItem
): CostOpportunity => ({
  id: `${item.id}_opportunity`,
  itemId: item.id,
  category: item.category,
  title: item.title,
  description: item.description,
  expectedSaving: item.savingPotential,
  expectedMonthlyGain: item.expectedMonthlyGain,
  expectedAnnualGain: item.expectedAnnualGain,
  roiEstimate: item.roiEstimate,
  confidenceScore: item.confidenceScore,
  riskScore: item.riskScore,
  priority: item.priority,
  action: item.action,
  ownerRole: item.ownerRole,
  sourceModule: item.sourceModule
})

const getSupplierName = (
  sourceData: KpiSourceData,
  supplierId: string
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId

const createRecipeCostItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => {
  const view = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const averageTotalCost = averageBy(view.records, record => record.totalCost)
  const items: CostOptimizationItem[] = []

  view.records.forEach(record => {
    const purchasePercent = record.totalCost > 0 ? record.purchaseImpact / record.totalCost * 100 : 0
    const rawMaterialPercent = record.breakdown.rawMaterialPercent + record.breakdown.purchasePercent
    const firePercent = Math.max(record.firePercent, record.breakdown.firePercent)

    if(rawMaterialPercent >= 35 || purchasePercent >= 10 || record.totalCost >= averageTotalCost * 1.2){
      const savingRate = Math.min(14, Math.max(4, rawMaterialPercent * 0.16 + purchasePercent * 0.2))
      const saving = calculateSavingPotential(record.totalCost, savingRate, record.purchaseImpact * 0.18)
      items.push(createCostItem({
        reportId,
        reportNo,
        category: 'RAW_MATERIAL',
        title: `${record.productName} hammadde maliyeti optimize edilebilir`,
        description: 'Recipe Cost ve Cost Engine maliyet dagilimi hammadde/satin alma etkisini yuksek gosteriyor.',
        reason: `Hammadde+satin alma payi ${formatPercent(rawMaterialPercent)}, satin alma etkisi ${formatCurrency(record.purchaseImpact)}.`,
        action: 'Alternatif tedarikci, fiyat farki ve recete toleransi manuel olarak karsilastirilmali.',
        expectedImpact: `${formatCurrency(saving)} aylik tasarruf potansiyeli olusabilir.`,
        ownerRole: 'Satin Alma ve Uretim',
        unitCost: record.costPerUnit,
        totalCost: record.totalCost,
        savingPotential: saving,
        riskScore: calculateCostRiskScore(rawMaterialPercent, purchasePercent + (record.totalCost >= averageTotalCost * 1.2 ? 18 : 0), firePercent),
        confidenceScore: calculateConfidenceScore(3, rawMaterialPercent, 4),
        sourceModule: 'RecipeCost',
        sourceId: record.id,
        sourceNo: record.recipeCode,
        relatedModules: ['CostEngine', 'PurchaseOrders', 'DecisionSupport'],
        relatedEntityType: 'CostEngine',
        relatedEntityId: record.id,
        relatedEntityName: record.productName,
        productId: record.productId,
        productName: record.productName,
        branchId: record.branchId,
        branchName: record.branchName,
        warehouseId: record.warehouseId,
        warehouseName: record.warehouseName
      }))
    }

    if(firePercent >= 5 || record.fireImpact > 0){
      const saving = calculateSavingPotential(Math.max(record.fireImpact, record.totalCost * firePercent / 100), 38)
      items.push(createCostItem({
        reportId,
        reportNo,
        category: 'WASTE',
        title: `${record.productName} fire maliyeti azaltilabilir`,
        description: 'Fire etkisi urun maliyetinde belirgin pay olusturuyor.',
        reason: `Fire payi ${formatPercent(firePercent)}, fire etkisi ${formatCurrency(record.fireImpact)}.`,
        action: 'Fire kok nedeni, lot, proses ve operator etkisi manuel analiz edilmeli.',
        expectedImpact: `${formatCurrency(saving)} aylik fire tasarrufu potansiyeli.`,
        ownerRole: 'Uretim ve Kalite',
        unitCost: record.costPerKg,
        totalCost: record.totalCost,
        baselineCost: Math.max(record.fireImpact, record.totalCost * firePercent / 100),
        savingPotential: saving,
        riskScore: calculateCostRiskScore(firePercent * 8, firePercent * 5, record.fireImpact > 0 ? 18 : 0),
        confidenceScore: calculateConfidenceScore(3, firePercent * 8, 3),
        sourceModule: 'WasteManagement',
        sourceId: record.id,
        sourceNo: record.lotNo,
        relatedModules: ['CostEngine', 'RecipeCost', 'WasteManagement'],
        relatedEntityType: 'CostEngine',
        relatedEntityId: record.id,
        relatedEntityName: record.productName,
        productId: record.productId,
        productName: record.productName,
        branchId: record.branchId,
        branchName: record.branchName,
        warehouseId: record.warehouseId,
        warehouseName: record.warehouseName
      }))
    }

    const storageShipmentPercent = record.breakdown.storagePercent + record.breakdown.shipmentPercent
    if(storageShipmentPercent >= 9){
      const saving = calculateSavingPotential(record.totalCost * storageShipmentPercent / 100, 22)
      items.push(createCostItem({
        reportId,
        reportNo,
        category: record.breakdown.shipmentPercent >= record.breakdown.storagePercent ? 'SHIPMENT' : 'STORAGE',
        title: `${record.productName} depolama/lojistik maliyeti incelenmeli`,
        description: 'Depolama ve sevkiyat payi maliyet dagiliminda ortalamanin uzerinde.',
        reason: `Depolama+sevkiyat payi ${formatPercent(storageShipmentPercent)}.`,
        action: 'Depo bekleme, sevkiyat parti buyuklugu ve rota maliyeti manuel karsilastirilmali.',
        expectedImpact: `${formatCurrency(saving)} lojistik/depolama tasarrufu potansiyeli.`,
        ownerRole: 'Depo ve Sevkiyat',
        unitCost: record.costPerUnit,
        totalCost: record.totalCost,
        baselineCost: record.totalCost * storageShipmentPercent / 100,
        savingPotential: saving,
        riskScore: calculateCostRiskScore(storageShipmentPercent * 6, storageShipmentPercent * 4, 10),
        confidenceScore: calculateConfidenceScore(2, storageShipmentPercent * 6, 2),
        sourceModule: 'CostEngine',
        sourceId: record.id,
        sourceNo: record.recipeCode,
        relatedModules: ['RecipeCost', 'Warehouse', 'ShipmentForms'],
        relatedEntityType: 'CostEngine',
        relatedEntityId: record.id,
        relatedEntityName: record.productName,
        productId: record.productId,
        productName: record.productName,
        branchId: record.branchId,
        branchName: record.branchName,
        warehouseId: record.warehouseId,
        warehouseName: record.warehouseName
      }))
    }
  })

  return items
}

const createWasteItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => WasteService.list(sourceData)
  .filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED' && record.totalCost > 0)
  .sort((first, second) => second.totalCost - first.totalCost)
  .slice(0, 8)
  .map(record => {
    const saving = calculateSavingPotential(record.totalCost, 35)
    return createCostItem({
      reportId,
      reportNo,
      category: 'WASTE',
      title: `${record.productName || record.stockItemName} fire azaltma firsati`,
      description: 'Waste Management kaydi maliyet optimizasyon listesine fire azaltma firsati olarak tasindi.',
      reason: `${record.wasteNo} toplam fire maliyeti ${formatCurrency(record.totalCost)}, miktar ${formatNumber(record.quantity, 1)} ${record.unit}.`,
      action: 'Fire nedeni, kalite karari ve lot/proses baglantisi manuel incelenmeli.',
      expectedImpact: `${formatCurrency(saving)} aylik tasarruf potansiyeli.`,
      ownerRole: 'Uretim ve Kalite',
      unitCost: record.unitCost,
      totalCost: record.totalCost,
      savingPotential: saving,
      riskScore: calculateCostRiskScore(Math.min(100, record.totalCost / 1000), 58, record.quantity),
      confidenceScore: calculateConfidenceScore(2, Math.min(100, record.totalCost / 1000), record.items.length || 1),
      sourceModule: 'WasteManagement',
      sourceId: record.id,
      sourceNo: record.wasteNo,
      relatedModules: ['WasteManagement', 'QualityForms', 'RecipeCost'],
      relatedEntityType: 'WasteRecord',
      relatedEntityId: record.id,
      relatedEntityName: record.productName || record.stockItemName,
      productId: record.productId || record.stockItemId,
      productName: record.productName || record.stockItemName,
      branchId: record.branchId,
      branchName: record.branchName,
      warehouseId: record.warehouseId,
      warehouseName: record.warehouseName,
      supplierId: record.supplierId,
      supplierName: record.supplierName
    })
  })

const createPurchaseItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => {
  const activeOrders = sourceData.purchaseOrders.filter(order => order.status !== 'CANCELLED' && order.grandTotal > 0)
  const averageOrderCost = averageBy(activeOrders, order => order.grandTotal)

  return activeOrders
    .filter(order => order.grandTotal >= averageOrderCost * 1.15)
    .sort((first, second) => second.grandTotal - first.grandTotal)
    .slice(0, 8)
    .map(order => {
      const saving = calculateSavingPotential(order.grandTotal, 8)
      return createCostItem({
        reportId,
        reportNo,
        category: 'RAW_MATERIAL',
        title: `${getSupplierName(sourceData, order.supplierId)} alternatif tedarik maliyeti`,
        description: 'Purchase Orders toplam tutari ortalamanin uzerinde; alternatif tedarikci veya fiyat kosulu incelenebilir.',
        reason: `${order.orderNo} tutari ${formatCurrency(order.grandTotal)}, ortalama PO ${formatCurrency(averageOrderCost)}.`,
    action: 'Alternatif tedarikçi, teslim koşulu ve fiyat geçerlilikleri manuel karşılaştırılmalı.',
        expectedImpact: `${formatCurrency(saving)} aylik hammadde/satin alma tasarrufu potansiyeli.`,
        ownerRole: 'Satin Alma',
        totalCost: order.grandTotal,
        savingPotential: saving,
        riskScore: calculateCostRiskScore(Math.min(100, order.grandTotal / Math.max(1, averageOrderCost) * 45), 42, 16),
        confidenceScore: calculateConfidenceScore(2, 70, activeOrders.length),
        sourceModule: 'PurchaseOrders',
        sourceId: order.id,
        sourceNo: order.orderNo,
        relatedModules: ['PurchaseOrders', 'GoodsReceipt', 'DecisionSupport'],
        relatedEntityType: 'PurchaseOrder',
        relatedEntityId: order.id,
        relatedEntityName: getSupplierName(sourceData, order.supplierId),
        supplierId: order.supplierId,
        supplierName: getSupplierName(sourceData, order.supplierId)
      })
    })
}

const createGoodsReceiptItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => sourceData.goodsReceipts
  .flatMap(receipt => receipt.items.map(item => ({ receipt, item })))
  .filter(row => (row.item.rejectedQuantity > 0 || row.receipt.status === 'REJECTED') && (row.item.totalCost || 0) > 0)
  .slice(0, 8)
  .map(row => {
    const rejectedCost = row.item.totalCost || row.item.rejectedQuantity * (row.item.unitCost || 0)
    const saving = calculateSavingPotential(rejectedCost, 45)
    return createCostItem({
      reportId,
      reportNo,
      category: 'RAW_MATERIAL',
      title: `${row.item.productName || row.item.stockItemName} mal kabul red maliyeti`,
      description: 'Goods Receipt red/kismi kabul verisi tedarik ve kalite maliyet firsati olusturuyor.',
      reason: `${row.receipt.receiptNo} reddedilen miktar ${formatNumber(row.item.rejectedQuantity, 1)} ${row.item.unit}, maliyet ${formatCurrency(rejectedCost)}.`,
      action: 'Supplier kalite kosullari, kabul kriterleri ve lot bazli red nedenleri manuel karsilastirilmali.',
      expectedImpact: `${formatCurrency(saving)} aylik red maliyeti azaltma potansiyeli.`,
      ownerRole: 'Kalite ve Satin Alma',
      unitCost: row.item.unitCost || 0,
      totalCost: rejectedCost,
      savingPotential: saving,
      riskScore: calculateCostRiskScore(Math.min(100, rejectedCost / 800), 66, row.item.rejectedQuantity * 4),
      confidenceScore: calculateConfidenceScore(3, 72, 2),
      sourceModule: 'GoodsReceipt',
      sourceId: row.receipt.id,
      sourceNo: row.receipt.goodsReceiptNo || row.receipt.receiptNo,
      relatedModules: ['GoodsReceipt', 'PurchaseOrders', 'QualityForms'],
      relatedEntityType: 'GoodsReceiptItem',
      relatedEntityId: row.item.id,
      relatedEntityName: row.item.productName || row.item.stockItemName || row.receipt.receiptNo,
      productId: row.item.stockItemId,
      productName: row.item.productName || row.item.stockItemName || '',
      warehouseId: row.receipt.warehouseId,
      warehouseName: row.receipt.warehouseName || '',
      supplierId: row.receipt.supplierId,
      supplierName: row.receipt.supplierName || getSupplierName(sourceData, row.receipt.supplierId)
    })
  })

const createCapacityItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => CapacityPlanningService.list(sourceData)
  .flatMap(plan => plan.machineCapacities.map(capacity => ({ plan, capacity })))
  .filter(row => row.capacity.idleMinutes >= 90 || row.capacity.overloadMinutes > 0 || row.capacity.maintenanceMinutes >= 90 || row.capacity.utilizationPercent < 45)
  .slice(0, 10)
  .map(row => {
    const idleSaving = Math.max(0, row.capacity.idleMinutes) * 18
    const overloadSaving = Math.max(0, row.capacity.overloadMinutes) * 28
    const maintenanceSaving = Math.max(0, row.capacity.maintenanceMinutes - 60) * 22
    const saving = roundKpi(Math.max(idleSaving, overloadSaving, maintenanceSaving, 1200))
    const category: CostOptimizationCategory = row.capacity.maintenanceMinutes >= 90
      ? 'MAINTENANCE'
      : row.capacity.idleMinutes >= 90 || row.capacity.utilizationPercent < 45
        ? 'ENERGY'
        : 'MACHINE'

    return createCostItem({
      reportId,
      reportNo,
      category,
      title: `${row.capacity.machineCode || row.capacity.machineName} kullanim maliyeti optimize edilebilir`,
      description: 'Capacity Planning makine bos sure, overload veya bakim surelerinden maliyet firsati uretir.',
      reason: `Bos sure ${formatNumber(row.capacity.idleMinutes)} dk, overload ${formatNumber(row.capacity.overloadMinutes)} dk, bakim ${formatNumber(row.capacity.maintenanceMinutes)} dk.`,
      action: 'Hat dagilimi, enerji bekleme modu ve bakim penceresi manuel olarak yeniden degerlendirilmeli.',
      expectedImpact: `${formatCurrency(saving)} aylik makine/enerji tasarrufu potansiyeli.`,
      ownerRole: category === 'MAINTENANCE' ? 'Bakim' : 'Uretim Planlama',
      totalCost: row.capacity.totalLoadMinutes * 24,
      baselineCost: row.capacity.totalLoadMinutes * 24,
      savingPotential: saving,
      riskScore: calculateCostRiskScore(row.capacity.utilizationPercent, row.capacity.overloadMinutes / 4 + row.capacity.maintenanceMinutes / 5, row.capacity.idleMinutes / 8),
      confidenceScore: calculateConfidenceScore(2, row.capacity.utilizationPercent, 2),
      sourceModule: 'CapacityPlanning',
      sourceId: row.capacity.id,
      sourceNo: row.plan.capacityPlanNo,
      relatedModules: ['CapacityPlanning', 'MachineScheduling', 'Energy', 'Maintenance'],
      relatedEntityType: 'MachineCapacity',
      relatedEntityId: row.capacity.machineId,
      relatedEntityName: row.capacity.machineName,
      productionLineId: row.capacity.productionLineId,
      productionLineName: row.capacity.productionLineName,
      machineId: row.capacity.machineId,
      machineCode: row.capacity.machineCode,
      machineName: row.capacity.machineName
    })
  })

const mapForecastCategory = (
  prediction: ForecastPrediction
): CostOptimizationCategory => {
  if(prediction.forecastType === 'WASTE') return 'WASTE'
  if(prediction.forecastType === 'PURCHASING' || prediction.forecastType === 'STOCK') return 'RAW_MATERIAL'
  if(prediction.forecastType === 'SHIPMENT') return 'SHIPMENT'
  if(prediction.forecastType === 'PERSONNEL') return 'PERSONNEL'
  return 'PRODUCTION'
}

const createForecastItems = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => ForecastService.evaluate(sourceData).predictions
  .filter(prediction => prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'CRITICAL' || prediction.expectedWaste > 0 || prediction.growthPercent >= 12)
  .slice(0, 8)
  .map(prediction => {
    const category = mapForecastCategory(prediction)
    const costBase = Math.max(
      prediction.expectedWaste * 450,
      Math.max(0, -prediction.expectedStock) * 300,
      Math.max(1, prediction.expectedValue) * 90
    )
    const saving = calculateSavingPotential(costBase, category === 'WASTE' ? 32 : 10)

    return createCostItem({
      reportId,
      reportNo,
      category,
      title: `${prediction.entityName} tahmin kaynakli maliyet firsati`,
  description: 'Tahminleme Motoru riskli trendleri maliyet optimizasyon veri setine taşır.',
      reason: `${prediction.evidence} Buyume ${formatPercent(prediction.growthPercent)}, risk ${formatNumber(prediction.riskScore, 1)}.`,
      action: prediction.recommendation,
      expectedImpact: `${formatCurrency(saving)} tahmini aylik maliyet etkisi azaltabilir.`,
      ownerRole: category === 'RAW_MATERIAL' ? 'Satin Alma' : 'Operasyon',
      unitCost: costBase / Math.max(1, prediction.expectedValue),
      totalCost: costBase,
      savingPotential: saving,
      riskScore: prediction.riskScore,
      confidenceScore: prediction.confidenceScore,
      sourceModule: 'Forecasting',
      sourceId: prediction.id,
      sourceNo: prediction.reportNo,
      relatedModules: ['Forecasting', 'DecisionSupport'],
      relatedEntityType: prediction.entityType,
      relatedEntityId: prediction.entityId,
      relatedEntityName: prediction.entityName,
      productId: prediction.productId || prediction.stockItemId,
      productName: prediction.productName || prediction.stockItemName,
      branchId: prediction.branchId,
      branchName: prediction.branchName,
      productionLineId: prediction.productionLineId,
      productionLineName: prediction.productionLineName,
      machineId: prediction.machineId,
      machineCode: prediction.machineCode,
      machineName: prediction.machineName,
      supplierId: prediction.supplierId,
      supplierName: prediction.supplierName
    })
  })

const mapRecommendationCategory = (
  item: RecommendationItem
): CostOptimizationCategory => {
  if(item.recommendationType === 'WASTE') return 'WASTE'
  if(item.recommendationType === 'PURCHASING' || item.recommendationType === 'STOCK') return 'RAW_MATERIAL'
  if(item.recommendationType === 'PERSONNEL') return 'PERSONNEL'
  if(item.recommendationType === 'ENERGY') return 'ENERGY'
  if(item.recommendationType === 'MAINTENANCE') return 'MAINTENANCE'
  if(item.recommendationType === 'MACHINE') return 'MACHINE'
  if(item.recommendationType === 'SHIPMENT') return 'SHIPMENT'
  return 'PRODUCTION'
}

const createRecommendationItems = (
  recommendationReport: RecommendationReport,
  reportId: string,
  reportNo: string
) => recommendationReport.items
  .filter(item => item.expectedCostImpact > 0 || item.expectedBenefitScore >= 65 || item.risk === 'HIGH' || item.risk === 'CRITICAL')
  .slice(0, 10)
  .map(item => {
    const category = mapRecommendationCategory(item)
    const costBase = Math.max(item.expectedCostImpact, item.expectedBenefitScore * 450)
    const saving = calculateSavingPotential(costBase, 18)
    return createCostItem({
      reportId,
      reportNo,
      category,
      title: `${item.title} maliyet firsati`,
    description: 'Öneri Motoru önerisi maliyet optimizasyon potansiyeline çevrildi.',
      reason: `${item.reason} Maliyet etkisi ${formatCurrency(item.expectedCostImpact)}, fayda ${formatNumber(item.expectedBenefitScore, 1)}.`,
      action: item.action,
      expectedImpact: item.expectedImpact,
      ownerRole: item.ownerRole,
      unitCost: item.expectedCostImpact / Math.max(1, item.expectedBenefitScore),
      totalCost: costBase,
      savingPotential: saving,
      riskScore: item.riskScore,
      confidenceScore: item.confidenceScore,
      sourceModule: 'RecommendationEngine',
      sourceId: item.id,
      sourceNo: item.reportNo,
      relatedModules: ['RecommendationEngine', ...item.relatedModules.map(module => module as CostOptimizationSourceModule)],
      relatedEntityType: item.relatedEntityType,
      relatedEntityId: item.relatedEntityId,
      relatedEntityName: item.relatedEntityName,
      productId: item.productId || item.stockItemId,
      productName: item.productName || item.stockItemName,
      branchId: item.branchId,
      branchName: item.branchName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      supplierId: item.supplierId,
      supplierName: item.supplierName
    })
  })

const createAIAnalysisItems = (
  aiAnalysisReport: AIAnalysisReport | undefined,
  reportId: string,
  reportNo: string
) => (aiAnalysisReport?.insights || [])
  .filter(insight => !insight.sourceNo.startsWith('cost-optimization-') && (insight.expectedGainScore >= 45 || insight.impactScore >= 65 || insight.riskScore >= 65))
  .slice(0, 10)
  .map(insight => {
    const category: CostOptimizationCategory = insight.analysisTitle === 'WASTE'
      ? 'WASTE'
      : insight.analysisTitle === 'ENERGY'
        ? 'ENERGY'
        : insight.analysisTitle === 'MAINTENANCE'
          ? 'MAINTENANCE'
          : insight.analysisTitle === 'MACHINE'
            ? 'MACHINE'
            : insight.analysisTitle === 'PERSONNEL'
              ? 'PERSONNEL'
              : insight.analysisTitle === 'SHIPMENT'
                ? 'SHIPMENT'
                : insight.analysisTitle === 'STOCK'
                  ? 'RAW_MATERIAL'
                  : 'PRODUCTION'
    const costBase = Math.max(1500, insight.expectedGainScore * 900, insight.impactScore * 550)
    const saving = calculateSavingPotential(costBase, 16)

    return createCostItem({
      reportId,
      reportNo,
      category,
      title: `${insight.title} maliyet optimizasyon baglami`,
      description: 'AI Analysis insight maliyet optimizasyon veri setine maliyet odakli firsat olarak tasindi.',
      reason: `${insight.evidence} AI gain ${formatNumber(insight.expectedGainScore, 1)}, impact ${formatNumber(insight.impactScore, 1)}.`,
      action: insight.recommendedAction,
      expectedImpact: insight.expectedImpact,
      ownerRole: 'Operasyon Muduru',
      totalCost: costBase,
      savingPotential: saving,
      riskScore: insight.riskScore,
      confidenceScore: insight.confidenceScore,
      sourceModule: 'AIAnalysis',
      sourceId: insight.id,
      sourceNo: insight.reportNo,
      relatedModules: ['AIAnalysis', ...insight.relatedModules.map(module => module as CostOptimizationSourceModule)],
      relatedEntityType: insight.relatedEntityType,
      relatedEntityId: insight.relatedEntityId,
      relatedEntityName: insight.relatedEntityName,
      branchId: insight.branchId,
      branchName: insight.branchName,
      productionLineId: insight.productionLineId,
      productionLineName: insight.productionLineName,
      machineId: insight.machineId,
      machineCode: insight.machineCode,
      machineName: insight.machineName
    })
  })

const createDecisionItems = (
  decisionSuggestions: DecisionSuggestion[],
  reportId: string,
  reportNo: string
) => decisionSuggestions
  .filter(suggestion => (
    !suggestion.ruleId.startsWith('cost-optimization-')
    && (
      suggestion.ruleId.includes('cost')
      || suggestion.ruleId.includes('waste')
      || suggestion.ruleId.includes('purchase')
      || suggestion.category === 'Purchasing'
      || suggestion.risk === 'CRITICAL'
    )
  ))
  .slice(0, 8)
  .map(suggestion => {
    const category: CostOptimizationCategory = suggestion.ruleId.includes('waste') || suggestion.ruleId.includes('fire')
      ? 'WASTE'
      : suggestion.category === 'Purchasing' || suggestion.ruleId.includes('purchase')
        ? 'RAW_MATERIAL'
        : suggestion.ruleId.includes('shipment')
          ? 'SHIPMENT'
          : 'PRODUCTION'
    const costBase = Math.max(1200, suggestion.riskScore * 700)
    const saving = calculateSavingPotential(costBase, 12)

    return createCostItem({
      reportId,
      reportNo,
      category,
      title: `${suggestion.title} maliyet etkisi`,
      description: 'Karar Destek önerisi maliyet optimizasyon bağlamına çevrildi.',
      reason: suggestion.reason,
      action: suggestion.recommendation.action,
      expectedImpact: suggestion.recommendation.expectedImpact,
      ownerRole: suggestion.recommendation.ownerRole,
      totalCost: costBase,
      savingPotential: saving,
      riskScore: suggestion.riskScore,
      confidenceScore: calculateConfidenceScore(2, suggestion.riskScore, 1),
      sourceModule: 'DecisionSupport',
      sourceId: suggestion.id,
      sourceNo: suggestion.ruleId,
      relatedModules: ['DecisionSupport'],
      relatedEntityType: suggestion.relatedEntityType,
      relatedEntityId: suggestion.relatedEntityId,
      relatedEntityName: suggestion.title,
      productId: suggestion.relatedProductId,
      branchId: suggestion.branchId,
      productionLineId: suggestion.warehouseId,
      supplierId: suggestion.relatedSupplierId
    })
  })

const dedupeItems = (
  items: CostOptimizationItem[]
) => Array.from(new Map(items.map(item => [
  [
    item.category,
    item.sourceModule,
    item.relatedEntityId || item.relatedEntityName,
    item.productId,
    item.machineId
  ].join('|'),
  item
])).values())
  .sort((first, second) => (
    second.savingPotential - first.savingPotential
    || second.riskScore - first.riskScore
    || first.title.localeCompare(second.title, 'tr-TR')
  ))

const filterByScope = (
  items: CostOptimizationItem[],
  scope: CostOptimizationCategory | 'all'
) => scope === ALL_FILTER
  ? items
  : items.filter(item => item.category === scope)

export const calculateCostOptimizationReport = (
  input: CostAnalysisInput
): CostOptimizationReport => {
  const reportNo = input.getReportNo()
  const reportId = `cost_optimization_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const recommendationReport = input.recommendationReport || calculateRecommendationReport({
    reportDate: input.reportDate,
    scope: 'all',
    responsiblePerson: 'Maliyet Optimizasyon Motoru',
    description: 'Maliyet optimizasyonu analiz modeli öneri kaynağı.',
    sourceData: input.sourceData,
    decisionSuggestions: input.decisionSuggestions || [],
    actorName: input.actorName,
    getReportNo: () => `RC-${new Date().getFullYear()}-000000`
  })
  const items = filterByScope(dedupeItems([
    ...createRecipeCostItems(input.sourceData, reportId, reportNo),
    ...createWasteItems(input.sourceData, reportId, reportNo),
    ...createPurchaseItems(input.sourceData, reportId, reportNo),
    ...createGoodsReceiptItems(input.sourceData, reportId, reportNo),
    ...createCapacityItems(input.sourceData, reportId, reportNo),
    ...createForecastItems(input.sourceData, reportId, reportNo),
    ...createRecommendationItems(recommendationReport, reportId, reportNo),
    ...createAIAnalysisItems(input.aiAnalysisReport, reportId, reportNo),
    ...createDecisionItems(input.decisionSuggestions || [], reportId, reportNo)
  ]), input.scope)
  const finalItems = items.length > 0
    ? items
    : [
      createCostItem({
        reportId,
        reportNo,
        category: 'PRODUCTION',
        title: 'Maliyet optimizasyon veri seti hazir',
        description: 'Read-model kaynaklar maliyet optimizasyon formatina donusturuldu.',
        reason: 'Kritik maliyet sinyali bulunmadigi icin dusuk riskli izleme kaydi olusturuldu.',
        action: 'Maliyet sinyallerini periyodik olarak izlemeye devam et.',
        expectedImpact: 'Gelecek fazlardaki satin alma, fire ve sevkiyat optimizasyonlari icin veri zemini saglar.',
        ownerRole: 'Operasyon Muduru',
        totalCost: 0,
        savingPotential: 0,
        riskScore: 10,
        confidenceScore: 68,
        sourceModule: 'ReadModel',
        sourceId: 'cost-optimization-read-model',
        sourceNo: reportNo,
        relatedModules: ['ReadModel'],
        relatedEntityType: 'CostOptimization',
        relatedEntityId: reportId,
      relatedEntityName: 'Maliyet Optimizasyon Motoru'
      })
    ]
  const opportunities = finalItems.map(toOpportunity)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate || getTodayKey(),
    scope: input.scope,
    responsiblePerson: input.responsiblePerson,
    description: input.description,
    items: finalItems,
    opportunities,
    history: [
      createCostHistory(reportId, 'CREATED', input.actorName, `${reportNo} cost optimization read-model olarak olusturuldu.`),
      createCostHistory(reportId, 'ANALYZED', input.actorName, `${formatNumber(finalItems.length)} optimizasyon kalemi ve ${formatCurrency(sumBy(finalItems, item => item.savingPotential))} tasarruf potansiyeli hesaplandi.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'cost-optimization-engine',
    revisionNo: 1,
    createdBy: input.actorName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export const CostAnalysisService = {
  calculate: calculateCostOptimizationReport,
  summarizePotential: (records: CostEngine[]) => ({
    totalCost: sumBy(records, record => record.totalCost),
    fireImpact: sumBy(records, record => record.fireImpact),
    purchaseImpact: sumBy(records, record => record.purchaseImpact)
  })
}
