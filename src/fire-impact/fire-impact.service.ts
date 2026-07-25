import { calculateRecipeCost } from '../recipe-management/recipe-cost-engine'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatPercent,
  formatQuantity,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { ProductionLine } from '../production-lines/production-line.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { StockItem, StockWasteRecord } from '../types'
import { calculateFireCost } from './fire-cost.service'
import type { FireCategory, FireImpact, FireReason } from './fire-impact.types'

export const FIRE_CATEGORIES: FireCategory[] = [
  'Uretim',
  'Hazirlik',
  'Pisirme',
  'Soklama',
  'Paketleme',
  'Depolama',
  'Sevkiyat',
  'Iade',
  'Kalite'
]

export const FIRE_REASONS: FireReason[] = [
  'Yanlis Gramaj',
  'Yanlis Recete',
  'Operator Hatasi',
  'Makine Arizasi',
  'Soklama Problemi',
  'Ambalaj Problemi',
  'Etiket Hatasi',
  'SKT',
  'Tasima Hasari',
  'Kalite Reddi',
  'Diger'
]

const normalizeText = (value: unknown) => (
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
)

const resolveCategoryAndReason = (record: StockWasteRecord): { category: FireCategory; reason: FireReason; department: string } => {
  const text = normalizeText(`${record.reasonCategory} ${record.reasonNote || ''}`)

  if(text.includes('skt') || text.includes('gec') || text.includes('son kullan')){
    return { category: 'Depolama', reason: 'SKT', department: 'Depolama' }
  }
  if(text.includes('haz')){
    return { category: 'Hazirlik', reason: 'Operator Hatasi', department: 'Hazirlik' }
  }
  if(text.includes('uretim') || text.includes('recete') || text.includes('gramaj')){
    return { category: 'Uretim', reason: text.includes('recete') ? 'Yanlis Recete' : 'Yanlis Gramaj', department: 'Uretim' }
  }
  if(text.includes('iade') || text.includes('musteri')){
    return { category: 'Iade', reason: 'Tasima Hasari', department: 'Iade' }
  }
  if(text.includes('ambalaj') || text.includes('paket')){
    return { category: 'Paketleme', reason: 'Ambalaj Problemi', department: 'Paketleme' }
  }
  if(text.includes('etiket')){
    return { category: 'Paketleme', reason: 'Etiket Hatasi', department: 'Paketleme' }
  }
  if(text.includes('kalite') || text.includes('red')){
    return { category: 'Kalite', reason: 'Kalite Reddi', department: 'Kalite' }
  }
  if(text.includes('tasima') || text.includes('sevkiyat')){
    return { category: 'Sevkiyat', reason: 'Tasima Hasari', department: 'Sevkiyat' }
  }
  if(text.includes('sok')){
    return { category: 'Soklama', reason: 'Soklama Problemi', department: 'Soklama' }
  }
  if(text.includes('pisir')){
    return { category: 'Pisirme', reason: 'Makine Arizasi', department: 'Pisirme' }
  }

  return { category: 'Uretim', reason: 'Diger', department: 'Uretim' }
}

const getProductReference = (
  stockItem: StockItem | undefined,
  sourceData: KpiSourceData
) => {
  if(!stockItem) return undefined
  return sourceData.productRefs.find(product => product.stockItemId === stockItem.id)
    || sourceData.productRefs.find(product => normalizeText(product.name) === normalizeText(stockItem.name))
}

const resolveLot = (
  record: StockWasteRecord,
  stockItem: StockItem | undefined,
  productId: string,
  sourceData: KpiSourceData
): InventoryLot | undefined => {
  const allocationLotCodes = (record.expiryAllocations || [])
    .map(allocation => normalizeText(allocation.lotCode))
    .filter(Boolean)
  const allocationLotIds = (record.expiryAllocations || [])
    .map(allocation => allocation.lotId)
    .filter(Boolean)

  const allocatedLot = sourceData.inventoryLots.find(lot => (
    allocationLotIds.includes(lot.id)
    || allocationLotCodes.includes(normalizeText(lot.lotNo))
  ))
  if(allocatedLot) return allocatedLot

  return sourceData.inventoryLots
    .filter(lot => (
      (stockItem?.id && lot.stockItemId === stockItem.id)
      || (productId && lot.productId === productId)
    ))
    .sort((first, second) => second.productionDate.localeCompare(first.productionDate))
    [0]
}

const resolveProductionOrder = (
  record: StockWasteRecord,
  stockItem: StockItem | undefined,
  productName: string,
  lot: InventoryLot | undefined,
  sourceData: KpiSourceData
): ProductionWorkOrder | undefined => {
  if(lot?.productionOrderId){
    const lotOrder = sourceData.productionOrders.find(order => order.id === lot.productionOrderId)
    if(lotOrder) return lotOrder
  }

  const occurredKey = (record.occurredAt || record.createdAt).slice(0, 10)
  const nameKey = normalizeText(productName || stockItem?.name)

  return sourceData.productionOrders
    .filter(order => order.createdAt.slice(0, 10) <= occurredKey || order.deliveryDate >= occurredKey)
    .find(order => order.lines.some(line => normalizeText(line.productName) === nameKey || normalizeText(line.productName).includes(nameKey)))
}

export const resolveProductionLine = (
  productionOrder: ProductionWorkOrder | undefined,
  sourceData: KpiSourceData
): ProductionLine | undefined => {
  if(!productionOrder) return undefined
  return sourceData.productionLines.find(line => (
    line.linkedWorkOrders.includes(productionOrder.workOrderNo)
    || line.linkedWorkOrders.includes(productionOrder.id)
  ))
}

const getRecipeMatches = (
  stockItem: StockItem | undefined,
  productName: string,
  sourceData: KpiSourceData
) => {
  const stockName = normalizeText(stockItem?.name)
  const productNameKey = normalizeText(productName)

  return (sourceData.recipeRecords || []).filter((recipe: RecipeManagementRecord) => (
    normalizeText(recipe.productName) === productNameKey
    || normalizeText(recipe.recipeName).includes(productNameKey)
    || recipe.ingredients.some(ingredient => normalizeText(ingredient.materialName) === stockName)
  ))
}

const getRecipeFire = (
  recipes: RecipeManagementRecord[]
) => {
  if(recipes.length === 0){
    return { firePercent: 0, fireCost: 0 }
  }

  const firePercent = roundKpi(sumBy(recipes, recipe => recipe.firePercent) / recipes.length)
  const fireCost = roundKpi(sumBy(recipes, recipe => calculateRecipeCost(recipe).fireAmount) / recipes.length)

  return { firePercent, fireCost }
}

const calculateImpactScore = (
  record: StockWasteRecord,
  cost: number,
  recipeVariancePercent: number,
  category: FireCategory
) => {
  const categoryWeight = category === 'Kalite' ? 18 : category === 'Uretim' ? 14 : category === 'Depolama' ? 12 : 8
  const quantityScore = Math.min(22, record.qty * 2)
  const costScore = Math.min(35, cost / 100)
  const recipeScore = Math.min(15, Math.max(0, recipeVariancePercent) * 3)

  return Math.min(100, Math.round(categoryWeight + quantityScore + costScore + recipeScore))
}

export const createFireImpacts = (
  sourceData: KpiSourceData
): FireImpact[] => sourceData.stockWasteRecords
  .filter(record => record.status === 'active')
  .map(record => {
    const stockItem = sourceData.stockItems.find(item => item.id === record.stockItemId)
    const productRef = getProductReference(stockItem, sourceData)
    const productId = productRef?.id || stockItem?.id || record.stockItemId
    const productName = productRef?.name || stockItem?.name || record.stockItemName
    const lot = resolveLot(record, stockItem, productId, sourceData)
    const productionOrder = resolveProductionOrder(record, stockItem, productName, lot, sourceData)
    const productionLine = resolveProductionLine(productionOrder, sourceData)
    const cost = calculateFireCost(record, sourceData)
    const categoryResult = resolveCategoryAndReason(record)
    const recipes = getRecipeMatches(stockItem, productName, sourceData)
    const recipeFire = getRecipeFire(recipes)
    const productionQuantity = productionOrder ? sumBy(productionOrder.lines, line => line.quantity) : 0
    const recordFirePercent = productionQuantity > 0 ? roundKpi((record.qty / productionQuantity) * 100) : 0
    const recipeVariancePercent = roundKpi(recordFirePercent - recipeFire.firePercent)
    const impactScore = calculateImpactScore(record, cost.totalCost, recipeVariancePercent, categoryResult.category)
    const operator = record.responsibleFullName || record.createdByFullName || ALL_FILTER

    return {
      id: `fire-impact-${record.id}`,
      stockWasteRecordId: record.id,
      stockMovementId: record.stockMovementId,
      stockItemId: record.stockItemId,
      stockItemName: record.stockItemName,
      productId,
      productName,
      lotId: lot?.id || '',
      lotNo: lot?.lotNo || (record.expiryAllocations?.[0]?.lotCode || ''),
      branchId: record.branchId,
      warehouseId: lot?.warehouseId || record.branchId,
      productionOrderId: productionOrder?.id || '',
      workOrderNo: productionOrder?.workOrderNo || '',
      category: categoryResult.category,
      reason: categoryResult.reason,
      department: productionLine?.name || categoryResult.department,
      operator,
      quantity: record.qty,
      unit: record.unit,
      cost,
      recipeFirePercent: recipeFire.firePercent,
      recipeFireCost: recipeFire.fireCost,
      recipeVariancePercent,
      occurredAt: record.occurredAt || record.createdAt,
      impactScore,
      stockImpact: `${formatQuantity(record.qty, record.unit)} stok kaybi read-model olarak analiz edildi; yeni stok hareketi olusturulmadi.`,
      productionImpact: productionOrder
        ? `${productionOrder.workOrderNo} uretim emrinde ${formatPercent(recordFirePercent)} fiili fire etkisi gorunuyor.`
        : 'Uretim emri dogrudan eslesmedi; fire stok karti ve tarih uzerinden analiz edildi.',
      recipeImpact: recipes.length > 0
        ? `${recipes.length} recete ile eslesti; standart fire ${formatPercent(recipeFire.firePercent)}, sapma ${formatPercent(recipeVariancePercent)}.`
        : 'Eslesen recete bulunamadi; recete etkisi yalniz stok kaydi uzerinden yorumlandi.',
      profitabilityImpact: `${formatCurrency(cost.totalCost, cost.currency)} tahmini kar/maliyet etkisi hesaplandi.`,
      kpiImpact: 'Toplam fire, fire %, urun/lot/kategori/departman ve maliyet KPI kirilimlarina dahil edildi.',
      decisionSupportImpact: impactScore >= 65
        ? 'Decision Support icin yuksek riskli kok neden analizi adayi.'
        : 'Decision Support tarafinda trend esigi asilirsa oneriye donusebilir.',
      notes: record.reasonNote || ''
    }
  })
