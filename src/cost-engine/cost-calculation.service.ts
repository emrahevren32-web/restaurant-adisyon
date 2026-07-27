import type { BlastChillerProcess } from '../blast-chiller/blast-chiller.types'
import type { DispatchProcess } from '../dispatch/dispatch.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { roundKpi, sumBy } from '../kpi-reporting/kpi.utils'
import type { PackagingProcess } from '../packaging/packaging.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import { calculateRecipeCost } from '../recipe-management/recipe-cost-engine'
import type { RecipeIngredient, RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import { calculateTotalBaseQuantity } from '../recipe-management/recipe-unit-converter'
import { DEFAULT_STOCK_CURRENCY, getStockConsumptionUnitCost, getStockCurrency } from '../stockCost'
import type { Branch, StockCategory, StockItem, StockUnit } from '../types'
import { WasteService } from '../waste-management/waste.service'
import { createCostBreakdown, createCostComponent } from './cost-breakdown.service'
import { createDefaultCostScenarios } from './cost-simulation.service'
import type {
  CostComponent,
  CostComponentType,
  CostEngine
} from './cost-engine.types'

export type CostCalculationContext = {
  sourceData: KpiSourceData
  stockCategories: StockCategory[]
  blastChillerProcesses: BlastChillerProcess[]
  packagingProcesses: PackagingProcess[]
  dispatchProcesses: DispatchProcess[]
}

type IngredientCostRow = {
  ingredient: RecipeIngredient
  stockItem?: StockItem
  standardCost: number
  actualCost: number
  componentType: CostComponentType
}

const PRODUCT_TYPE_BY_COMPONENT: Partial<Record<CostComponentType, CostEngine['productType']>> = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  INTERMEDIATE_PRODUCT: 'INTERMEDIATE_PRODUCT',
  FINAL_PRODUCT: 'FINAL_PRODUCT'
}

export const normalizeCostText = (value: unknown) => (
  String(value || '').trim().toLocaleLowerCase('tr-TR')
)

const textMatches = (candidate: unknown, search: unknown) => {
  const candidateText = normalizeCostText(candidate)
  const searchText = normalizeCostText(search)
  return Boolean(candidateText && searchText && (
    candidateText === searchText
    || candidateText.includes(searchText)
    || searchText.includes(candidateText)
  ))
}

const roundCost = (value: number) => roundKpi(value)

const convertBaseQuantityToStockUnit = (
  baseQuantity: number,
  baseUnit: string,
  stockUnit: StockUnit
) => {
  if(baseUnit === stockUnit) return baseQuantity
  if(baseUnit === 'gr' && stockUnit === 'kg') return baseQuantity / 1000
  if(baseUnit === 'ml' && stockUnit === 'lt') return baseQuantity / 1000
  if(baseUnit === 'adet' && stockUnit === 'adet') return baseQuantity
  if(baseUnit === 'paket' && stockUnit === 'paket') return baseQuantity
  if(baseUnit === 'koli' && stockUnit === 'koli') return baseQuantity
  return null
}

const getIngredientStockItem = (
  ingredient: RecipeIngredient,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => textMatches(item.name, ingredient.materialName))

const getIngredientComponentType = (
  ingredient: RecipeIngredient,
  sourceData: KpiSourceData
): CostComponentType => {
  const matchedRecipe = sourceData.recipeRecords.find(recipe => textMatches(recipe.productName, ingredient.materialName))
  if(!matchedRecipe) return 'RAW_MATERIAL'

  return normalizeCostText(matchedRecipe.recipeType).includes('ara')
    ? 'INTERMEDIATE_PRODUCT'
    : 'FINAL_PRODUCT'
}

const getProductType = (recipe: RecipeManagementRecord): CostEngine['productType'] => (
  normalizeCostText(recipe.recipeType).includes('ara') ? 'INTERMEDIATE_PRODUCT' : 'FINAL_PRODUCT'
)

const getProductReference = (
  recipe: RecipeManagementRecord,
  sourceData: KpiSourceData
) => sourceData.productRefs.find(product => textMatches(product.name, recipe.productName))
  || sourceData.productRefs.find(product => textMatches(product.name, recipe.recipeName))

const getProductionOrder = (
  recipe: RecipeManagementRecord,
  sourceData: KpiSourceData
) => [...sourceData.productionOrders]
  .filter(order => order.lines.some(line => textMatches(line.productName, recipe.productName)))
  .sort((first, second) => String(second.createdAt || second.deliveryDate).localeCompare(String(first.createdAt || first.deliveryDate)))
  [0]

const getBranch = (
  productionOrder: ProductionWorkOrder | undefined,
  ingredientRows: IngredientCostRow[],
  sourceData: KpiSourceData
): Branch | undefined => {
  const productionBranch = sourceData.branches.find(branch => (
    productionOrder && (branch.id === productionOrder.branch || branch.name === productionOrder.branch)
  ))
  if(productionBranch) return productionBranch

  const branchId = ingredientRows.find(row => row.stockItem?.branchId)?.stockItem?.branchId
  return sourceData.branches.find(branch => branch.id === branchId) || sourceData.branches[0]
}

const getInventoryLot = (
  productId: string,
  ingredientRows: IngredientCostRow[],
  sourceData: KpiSourceData
) => {
  const ingredientStockItemIds = new Set(ingredientRows.map(row => row.stockItem?.id).filter(Boolean))
  return [...sourceData.inventoryLots]
    .filter(lot => (
      lot.productId === productId
      || ingredientStockItemIds.has(lot.stockItemId)
    ))
    .sort((first, second) => String(second.productionDate || second.createdAt).localeCompare(String(first.productionDate || first.createdAt)))
    [0]
}

const getWarehouseName = (
  warehouseId: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => branch.id === warehouseId)?.name || warehouseId || 'Genel Depo'

const getDominantCategory = (
  ingredientRows: IngredientCostRow[],
  recipe: RecipeManagementRecord,
  stockCategories: StockCategory[]
) => {
  const categoryTotals = ingredientRows.reduce<Map<string, number>>((map, row) => {
    const categoryId = row.stockItem?.categoryId || ''
    if(!categoryId) return map
    map.set(categoryId, roundCost((map.get(categoryId) || 0) + row.standardCost))
    return map
  }, new Map())

  const dominantCategory = Array.from(categoryTotals.entries())
    .sort((first, second) => second[1] - first[1])
    [0]
  const categoryId = dominantCategory?.[0] || recipe.recipeType
  const categoryName = stockCategories.find(category => category.id === categoryId)?.name || categoryId

  return { categoryId, categoryName }
}

const createIngredientRows = (
  recipe: RecipeManagementRecord,
  sourceData: KpiSourceData
) => {
  const recipeCost = calculateRecipeCost(recipe)
  const standardCostByIngredientId = new Map(recipeCost.ingredientCost.map(line => [line.ingredientId, line.cost]))

  return recipe.ingredients.map((ingredient): IngredientCostRow => {
    const stockItem = getIngredientStockItem(ingredient, sourceData)
    const convertedQuantity = stockItem
      ? convertBaseQuantityToStockUnit(ingredient.baseQuantity, ingredient.baseUnit, stockItem.unit)
      : null
    const actualCost = stockItem && convertedQuantity !== null
      ? roundCost(convertedQuantity * getStockConsumptionUnitCost(stockItem))
      : standardCostByIngredientId.get(ingredient.id) || 0

    return {
      ingredient,
      stockItem,
      standardCost: standardCostByIngredientId.get(ingredient.id) || 0,
      actualCost,
      componentType: getIngredientComponentType(ingredient, sourceData)
    }
  })
}

const sumIngredientCostByType = (
  rows: IngredientCostRow[],
  type: CostComponentType
) => sumBy(rows.filter(row => row.componentType === type), row => row.standardCost)

const getRelatedWasteCost = (
  recipe: RecipeManagementRecord,
  ingredientRows: IngredientCostRow[],
  sourceData: KpiSourceData
) => {
  const stockItemIds = new Set(ingredientRows.map(row => row.stockItem?.id).filter(Boolean))
  const materialNames = recipe.ingredients.map(ingredient => ingredient.materialName)
  const activeWasteRecords = WasteService.list(sourceData).filter(record => (
    record.status !== 'CANCELLED'
    && record.status !== 'REJECTED'
  ))

  return sumBy(
    activeWasteRecords.filter(record => (
      stockItemIds.has(record.stockItemId)
      || materialNames.some(materialName => textMatches(record.stockItemName, materialName))
      || textMatches(record.productName, recipe.productName)
      || textMatches(record.stockItemName, recipe.productName)
      || textMatches(record.recipeName, recipe.recipeName)
      || record.recipeId === recipe.id
    )),
    record => record.totalCost
  )
}

const getBlastChillingCost = (
  recipe: RecipeManagementRecord,
  productId: string,
  baseCost: number,
  context: CostCalculationContext
) => {
  const matches = context.blastChillerProcesses.filter(process => (
    textMatches(process.productName, recipe.productName)
    || process.linkedFinalProduct === productId
  ))
  const processCost = sumBy(matches, process => (
    Math.max(0, process.actualMinutes || process.estimatedMinutes) * 2.75
    + Math.max(0, process.quantity) * 0.6
  ))

  return matches.length > 0
    ? roundCost(Math.max(processCost, baseCost * 0.015))
    : roundCost(baseCost * (getProductType(recipe) === 'FINAL_PRODUCT' ? 0.012 : 0.006))
}

const getPackagingCost = (
  recipe: RecipeManagementRecord,
  baseCost: number,
  context: CostCalculationContext
) => {
  const matches = context.packagingProcesses.filter(process => textMatches(process.productName, recipe.productName))
  const processCost = sumBy(matches, process => Math.max(0, process.quantity) * 1.25)

  return matches.length > 0
    ? roundCost(Math.max(processCost, baseCost * 0.02))
    : roundCost(baseCost * 0.018)
}

const getStorageCost = (
  lot: InventoryLot | undefined,
  baseCost: number
) => {
  if(!lot) return roundCost(baseCost * 0.012)

  return roundCost(Math.max(
    baseCost * 0.012,
    Math.max(0, lot.remainingQuantity || lot.quantity) * 0.15
  ))
}

const getShipmentCost = (
  lot: InventoryLot | undefined,
  ingredientRows: IngredientCostRow[],
  baseCost: number,
  context: CostCalculationContext
) => {
  const stockItemIds = new Set(ingredientRows.map(row => row.stockItem?.id).filter(Boolean))
  const shipments = context.sourceData.shipments.filter(shipment => (
    shipment.items.some(item => (
      item.inventoryLotId === lot?.id
      || stockItemIds.has(item.stockItemId)
    ))
  ))
  const shipmentCost = sumBy(shipments, shipment => sumBy(shipment.items, item => item.quantity * 0.9))
  const dispatchCost = sumBy(context.dispatchProcesses, process => (
    Math.max(0, process.totalProducts) * 1.4 + Math.max(0, process.totalQuantity) * 0.25
  ))

  return shipments.length > 0
    ? roundCost(Math.max(shipmentCost + dispatchCost * 0.05, baseCost * 0.022))
    : roundCost(baseCost * 0.018)
}

const getLaborCost = (
  productionOrder: ProductionWorkOrder | undefined,
  recipe: RecipeManagementRecord
) => {
  if(productionOrder){
    const productLineQuantity = sumBy(
      productionOrder.lines.filter(line => textMatches(line.productName, recipe.productName)),
      line => line.quantity
    )
    return roundCost(Math.max(0, productionOrder.estimatedMinutes) * 4.5 + productLineQuantity * 0.75)
  }

  return roundCost(Math.max(1, recipe.portions) * 0.35)
}

const getCurrency = (
  ingredientRows: IngredientCostRow[]
) => getStockCurrency(ingredientRows.find(row => row.stockItem)?.stockItem) || DEFAULT_STOCK_CURRENCY

const createComponents = ({
  actualIngredientCost,
  ingredientRows,
  lot,
  productionOrder,
  productId,
  purchaseImpact,
  recipe,
  relatedWasteCost,
  context
}: {
  actualIngredientCost: number
  ingredientRows: IngredientCostRow[]
  lot: InventoryLot | undefined
  productionOrder: ProductionWorkOrder | undefined
  productId: string
  purchaseImpact: number
  recipe: RecipeManagementRecord
  relatedWasteCost: number
  context: CostCalculationContext
}): CostComponent[] => {
  const rawMaterialCost = sumIngredientCostByType(ingredientRows, 'RAW_MATERIAL')
  const intermediateProductCost = sumIngredientCostByType(ingredientRows, 'INTERMEDIATE_PRODUCT')
  const finalProductCost = sumIngredientCostByType(ingredientRows, 'FINAL_PRODUCT')
  const fireCost = roundCost((actualIngredientCost * recipe.firePercent / 100) + relatedWasteCost * 0.12)
  const blastChillingCost = getBlastChillingCost(recipe, productId, actualIngredientCost, context)
  const packagingCost = getPackagingCost(recipe, actualIngredientCost, context)
  const storageCost = getStorageCost(lot, actualIngredientCost)
  const shipmentCost = getShipmentCost(lot, ingredientRows, actualIngredientCost, context)
  const laborCost = getLaborCost(productionOrder, recipe)
  const otherCost = roundCost(actualIngredientCost * 0.01)

  return [
    createCostComponent({
      id: `${recipe.id}-raw-material`,
      type: 'RAW_MATERIAL',
      label: 'Hammadde',
      amount: rawMaterialCost,
      source: 'Recipe',
      sourceId: recipe.id,
      note: 'Recete ingredient standart maliyeti.'
    }),
    createCostComponent({
      id: `${recipe.id}-intermediate-product`,
      type: 'INTERMEDIATE_PRODUCT',
      label: 'Ara Urun',
      amount: intermediateProductCost,
      source: 'Recipe',
      sourceId: recipe.id,
      note: 'Ara urun recetesi ile eslesen ingredient maliyeti.'
    }),
    createCostComponent({
      id: `${recipe.id}-final-product`,
      type: 'FINAL_PRODUCT',
      label: 'Son Urun',
      amount: finalProductCost,
      source: 'Recipe',
      sourceId: recipe.id,
      note: 'Son urun recetesi ile eslesen ingredient maliyeti.'
    }),
    createCostComponent({
      id: `${recipe.id}-purchasing`,
      type: 'PURCHASING',
      label: 'Satin Alma',
      amount: purchaseImpact,
      source: purchaseImpact > 0 ? 'StockItem' : 'Purchase',
      sourceId: recipe.id,
      note: 'Stok ortalama/son alis fiyati ile recete standart fiyat farki.'
    }),
    createCostComponent({
      id: `${recipe.id}-waste`,
      type: 'WASTE',
      label: 'Fire',
      amount: fireCost,
      source: relatedWasteCost > 0 ? 'Waste' : 'Recipe',
      sourceId: recipe.id,
      note: 'Recete fire yuzdesi ve eslesen aktif fire kayitlari etkisi.'
    }),
    createCostComponent({
      id: `${recipe.id}-blast-chilling`,
      type: 'BLAST_CHILLING',
      label: 'Soklama',
      amount: blastChillingCost,
      source: 'Estimated',
      sourceId: productId,
      note: 'Soklama sureci veya urun bazli tahmini sogutma maliyeti.'
    }),
    createCostComponent({
      id: `${recipe.id}-packaging`,
      type: 'PACKAGING',
      label: 'Paketleme',
      amount: packagingCost,
      source: 'Estimated',
      sourceId: productId,
      note: 'Paketleme sureci, miktar veya recete maliyeti uzerinden hesaplandi.'
    }),
    createCostComponent({
      id: `${recipe.id}-storage`,
      type: 'STORAGE',
      label: 'Depolama',
      amount: storageCost,
      source: lot ? 'InventoryLot' : 'Estimated',
      sourceId: lot?.id || productId,
      note: 'Lot kalan miktari ve stoklama katsayisi ile hesaplandi.'
    }),
    createCostComponent({
      id: `${recipe.id}-shipment`,
      type: 'SHIPMENT',
      label: 'Sevkiyat',
      amount: shipmentCost,
      source: 'Shipment',
      sourceId: lot?.id || productId,
      note: 'Sevkiyat itemlari ve dispatch sureci uzerinden hesaplandi.'
    }),
    createCostComponent({
      id: `${recipe.id}-labor`,
      type: 'LABOR',
      label: 'Iscilik',
      amount: laborCost,
      source: productionOrder ? 'Production' : 'Estimated',
      sourceId: productionOrder?.id || recipe.id,
      note: 'Uretim emri estimated minutes ve urun miktari etkisi.'
    }),
    createCostComponent({
      id: `${recipe.id}-other`,
      type: 'OTHER',
      label: 'Diger',
      amount: otherCost,
      source: 'Estimated',
      sourceId: recipe.id,
      note: 'Genel operasyon payi.'
    })
  ]
}

export const calculateCostEngineRecord = (
  recipe: RecipeManagementRecord,
  context: CostCalculationContext,
  index: number
): CostEngine => {
  const recipeCost = calculateRecipeCost(recipe)
  const ingredientRows = createIngredientRows(recipe, context.sourceData)
  const standardIngredientCost = sumBy(ingredientRows, row => row.standardCost)
  const actualIngredientCost = sumBy(ingredientRows, row => row.actualCost)
  const purchaseImpact = roundCost(Math.max(0, actualIngredientCost - standardIngredientCost))
  const productRef = getProductReference(recipe, context.sourceData)
  const productId = productRef?.id || `cost-product-${recipe.id}`
  const productionOrder = getProductionOrder(recipe, context.sourceData)
  const branch = getBranch(productionOrder, ingredientRows, context.sourceData)
  const lot = getInventoryLot(productId, ingredientRows, context.sourceData)
  const category = getDominantCategory(ingredientRows, recipe, context.stockCategories)
  const relatedWasteCost = getRelatedWasteCost(recipe, ingredientRows, context.sourceData)
  const components = createComponents({
    actualIngredientCost,
    ingredientRows,
    lot,
    productionOrder,
    productId,
    purchaseImpact,
    recipe,
    relatedWasteCost,
    context
  })
  const breakdown = createCostBreakdown(components)
  const totalGram = roundCost(calculateTotalBaseQuantity(recipe.ingredients, 'gr'))
  const totalCost = breakdown.totalCost
  const costPerKg = totalGram > 0 ? roundCost((totalCost / totalGram) * 1000) : 0
  const costPerUnit = recipe.portions > 0 ? roundCost(totalCost / recipe.portions) : totalCost
  const variableCost = sumBy(
    breakdown.components.filter(component => component.type !== 'STORAGE' && component.type !== 'OTHER'),
    component => component.amount
  )
  const standardCost = roundCost(recipeCost.recipeCost)
  const actualCost = totalCost
  const estimatedCost = roundCost(actualCost * 1.04)
  const averageCost = roundCost((actualCost + standardCost) / 2)
  const minCost = roundCost(Math.max(0, actualCost - variableCost * 0.08))
  const maxCost = roundCost(actualCost + variableCost * 0.12)
  const dominantComponent = breakdown.components
    .filter(component => component.amount > 0)
    .sort((first, second) => second.amount - first.amount)
    [0]
  const productType = PRODUCT_TYPE_BY_COMPONENT[dominantComponent?.type || ''] || getProductType(recipe)
  const currency = getCurrency(ingredientRows)
  const sourceReferences = [
    `Recipe:${recipe.id}`,
    ...ingredientRows.map(row => row.stockItem ? `StockItem:${row.stockItem.id}` : '').filter(Boolean),
    lot ? `InventoryLot:${lot.id}` : '',
    productionOrder ? `ProductionWorkOrder:${productionOrder.id}` : ''
  ].filter(Boolean)

  return {
    id: `cost-engine-${recipe.id}`,
    productId,
    productName: recipe.productName || recipe.recipeName,
    productType,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    branchId: branch?.id || '',
    branchName: branch?.name || 'Genel Sube',
    warehouseId: lot?.warehouseId || branch?.id || '',
    warehouseName: getWarehouseName(lot?.warehouseId || branch?.id || '', context.sourceData),
    recipeId: recipe.id,
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    lotId: lot?.id || '',
    lotNo: lot?.lotNo || '',
    calculationDate: recipe.updatedAt || recipe.createdAt || new Date(Date.now() - index * 86400000).toISOString(),
    totalGram,
    firePercent: recipe.firePercent,
    fireImpact: breakdown.components.find(component => component.type === 'WASTE')?.amount || 0,
    purchaseImpact,
    totalCost,
    costPerKg,
    costPerUnit,
    actualCost,
    estimatedCost,
    standardCost,
    averageCost,
    minCost,
    maxCost,
    currency,
    breakdown,
    scenarios: createDefaultCostScenarios(breakdown.components, totalCost),
    sourceReferences
  }
}
