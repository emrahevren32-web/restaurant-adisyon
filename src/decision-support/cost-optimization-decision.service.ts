import { calculateCostOptimizationReport } from '../cost-optimization/cost-analysis.service'
import type {
  CostOptimizationCategory,
  CostOptimizationItem
} from '../cost-optimization/cost-optimization.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  percent
} from '../kpi-reporting/kpi.utils'
import type { DecisionCategory, DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getActiveCostItems = (
  sourceData: KpiSourceData
) => calculateCostOptimizationReport({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson: 'Karar Destek Merkezi',
  description: 'Karar Destek analiz modeli maliyet optimizasyonu özeti.',
  sourceData,
  decisionSuggestions: [],
  actorName: 'Karar Destek Merkezi',
  getReportNo: () => `CO-${new Date().getFullYear()}-000000`
}).items
  .filter(item => item.savingPotential > 0 || item.risk === 'HIGH' || item.risk === 'CRITICAL')
  .sort((first, second) => (
    second.savingPotential - first.savingPotential
    || second.riskScore - first.riskScore
  ))

const getEntityLabel = (
  item: CostOptimizationItem
) => item.productName
  || item.machineCode
  || item.machineName
  || item.productionLineName
  || item.supplierName
  || item.relatedEntityName
  || item.category

const getEvidenceScore = (
  item: CostOptimizationItem
) => Math.min(30, Math.max(10, item.riskScore * 0.18 + item.confidenceScore * 0.04 + item.savingPotential / 10000))

const toDecisionCategory = (
  category: CostOptimizationCategory
): DecisionCategory => {
  if(category === 'RAW_MATERIAL') return 'Purchasing'
  if(category === 'STORAGE') return 'Inventory'
  if(category === 'LOGISTICS' || category === 'SHIPMENT') return 'Shipment'
  return 'Production'
}

const createCostSuggestion = (
  item: CostOptimizationItem,
  ruleId: string,
  category: DecisionCategory,
  title: string,
  description: string,
  reason: string,
  action?: string,
  expectedImpact?: string
) => createDecisionSuggestion({
  category,
  title,
  description,
  reason,
  ruleId,
  relatedEntityType: item.relatedEntityType || 'CostOptimizationItem',
  relatedEntityId: item.relatedEntityId || item.id,
  relatedProductId: item.productId,
  relatedSupplierId: item.supplierId,
  relatedWorkOrderId: item.sourceId,
  branchId: item.branchId,
  warehouseId: item.warehouseId || item.productionLineId,
  evidenceScore: getEvidenceScore(item),
  createdAt: item.createdAt,
  recommendationAction: action || item.action,
  expectedImpact: expectedImpact || item.expectedImpact,
  ownerRole: item.ownerRole
})

const createRawMaterialSuggestion = (
  items: CostOptimizationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.category === 'RAW_MATERIAL')
  if(!item) return []

  const increaseRate = percent(item.savingPotential, Math.max(item.baselineCost, item.totalCost, 1))
  return [createCostSuggestion(
    item,
    'cost-optimization-raw-material',
    'Purchasing',
    `${getEntityLabel(item)} hammadde maliyeti artti`,
    'Maliyet Optimizasyon Motoru hammadde, satın alma ve reçete maliyeti etkisini Karar Destek için önceliklendirir.',
    `Hammadde maliyeti ${formatPercent(increaseRate)} optimize edilebilir; tasarruf potansiyeli ${formatCurrency(item.savingPotential)}, güven skoru ${formatNumber(item.confidenceScore, 1)}.`,
    'Alternatif tedarikçi, fiyat koşulu ve reçete maliyet etkisi manuel olarak karşılaştırılmalı.',
    'Hammadde maliyet artisinin urun birim maliyetine etkisini azaltabilir.'
  )]
}

const createEnergySuggestion = (
  items: CostOptimizationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.category === 'ENERGY' || (record.category === 'MACHINE' && record.reason.toLocaleLowerCase('tr-TR').includes('bos sure')))
  if(!item) return []

  return [createCostSuggestion(
    item,
    'cost-optimization-energy',
    toDecisionCategory(item.category),
    `${item.productionLineName || item.machineCode || getEntityLabel(item)} enerji maliyeti ortalamanin uzerinde`,
    'Maliyet Optimizasyon Motoru kapasite, makine boş süre ve enerji etkisini maliyet sinyaline çevirir.',
    `${item.reason} Beklenen tasarruf ${formatCurrency(item.expectedMonthlyGain)} / ay.`,
    'Hat yuk dengeleme, bekleme modu ve makine kullanim planlari manuel olarak incelenmeli.',
    'Enerji ve bos kapasite kaynakli maliyet kaybi azalabilir.'
  )]
}

const createMaintenanceSuggestion = (
  items: CostOptimizationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.category === 'MAINTENANCE' || record.sourceModule === 'Maintenance')
  if(!item) return []

  return [createCostSuggestion(
    item,
    'cost-optimization-maintenance',
    'Production',
    `${item.machineCode || item.machineName || getEntityLabel(item)} bakim maliyeti kritik`,
    'Maliyet Optimizasyon Motoru bakım, makine ve kapasite sinyallerinden kritik maliyet kalemi üretir.',
    `${item.reason} Risk skoru ${formatNumber(item.riskScore, 1)}, yillik kazanc ${formatCurrency(item.expectedAnnualGain)}.`,
    'Bakim penceresi, plansiz durus riski ve yedek makine senaryosu manuel olarak degerlendirilmeli.',
    'Bakim kaynakli kapasite kaybi ve maliyet sapmasi azalabilir.'
  )]
}

const createWasteSuggestion = (
  items: CostOptimizationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.category === 'WASTE')
  if(!item) return []

  return [createCostSuggestion(
    item,
    'cost-optimization-waste',
    'Production',
    `${getEntityLabel(item)} fire azaltma tasarrufu`,
    'Maliyet Optimizasyon Motoru fire, kalite, lot ve reçete maliyeti etkisini parasal tasarruf fırsatına çevirir.',
    `Fire azaltilirsa ${formatCurrency(item.expectedMonthlyGain)} / ay, ${formatCurrency(item.expectedAnnualGain)} / yil tasarruf potansiyeli var.`,
    'Fire kok nedeni, lot, proses ve operator etkisi manuel aksiyon listesine alinmali.',
    'Fire nedeniyle olusan maliyet sapmasi azalabilir.'
  )]
}

const createSupplierSuggestion = (
  items: CostOptimizationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.supplierId || record.supplierName || record.sourceModule === 'PurchaseOrders' || record.sourceModule === 'GoodsReceipt')
  if(!item) return []

  return [createCostSuggestion(
    item,
    'cost-optimization-supplier',
    'Purchasing',
    `${item.supplierName || getEntityLabel(item)} alternatif tedarikçi fırsatı`,
    'Maliyet Optimizasyon Motoru satın alma, mal kabul ve kalite maliyetlerini tedarikçi karar sinyaline dönüştürür.',
    `${item.reason} Tasarruf potansiyeli ${formatCurrency(item.savingPotential)}, ROI ${formatNumber(item.roiEstimate, 1)}.`,
    'Alternatif tedarikçi, kalite red maliyeti, teslim koşulu ve fiyat farkı manuel olarak karşılaştırılmalı.',
    'Tedarik maliyeti ve mal kabul red maliyeti dusurulebilir.'
  )]
}

export const createCostOptimizationDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const items = getActiveCostItems(sourceData)
  if(items.length === 0) return []

  return [
    ...createRawMaterialSuggestion(items),
    ...createEnergySuggestion(items),
    ...createMaintenanceSuggestion(items),
    ...createWasteSuggestion(items),
    ...createSupplierSuggestion(items)
  ].slice(0, 8)
}
