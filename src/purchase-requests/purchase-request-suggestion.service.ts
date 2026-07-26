import type { StockItem, StockUnit, StockWasteRecord } from '../types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { RecipeIngredient, RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestReadModelContext,
  PurchaseRequestSource,
  PurchaseRequestSuggestion
} from './purchase-request.types'
import { getOpenRequestNosForStockItem } from './purchase-request-validation.service'

const CRITICAL_RATIO = 0.5
const DEFAULT_REPLENISH_MULTIPLIER = 2
const MAX_SUGGESTIONS_PER_SOURCE = 12

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const normalizeText = (value: unknown) => (
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
)

const getRequestPriceFallback = (stockItem: StockItem) => (
  stockItem.lastPurchasePrice
  || stockItem.unitPurchasePrice
  || stockItem.averageCost
  || 1
)

const isActiveSupplier = (supplier: Supplier) => (
  supplier.status === 'ACTIVE'
  && supplier.approvalStatus === 'APPROVED'
  && supplier.workingStatus !== 'STOPPED'
  && supplier.workingStatus !== 'ON_HOLD'
)

const isActiveSupplierProduct = (
  supplierProduct: SupplierProduct,
  supplierMap: Map<string, Supplier>
) => {
  const supplier = supplierMap.get(supplierProduct.supplierId)
  return supplierProduct.status === 'ACTIVE' && Boolean(supplier && isActiveSupplier(supplier))
}

const getUnitPriceFromSupplierProduct = (supplierProduct: SupplierProduct | undefined) => {
  if(!supplierProduct) return 0
  if(supplierProduct.packageQuantity > 0){
    return roundMoney(supplierProduct.defaultUnitPrice / supplierProduct.packageQuantity)
  }
  return supplierProduct.defaultUnitPrice
}

const resolveSupplierProduct = (
  stockItemId: string,
  supplierProducts: SupplierProduct[],
  supplierMap: Map<string, Supplier>
) => supplierProducts
  .filter(product => product.stockItemId === stockItemId && isActiveSupplierProduct(product, supplierMap))
  .sort((first, second) => {
    if(first.isPreferred !== second.isPreferred) return first.isPreferred ? -1 : 1
    const priceDiff = getUnitPriceFromSupplierProduct(first) - getUnitPriceFromSupplierProduct(second)
    if(priceDiff !== 0) return priceDiff
    return first.leadTimeDays - second.leadTimeDays
  })[0]

const createSuggestion = ({
  records,
  source,
  stockItem,
  requestedQuantity,
  priority,
  department,
  branchId,
  warehouseId,
  reason,
  sourceReference,
  supplierProduct,
  supplier
}: {
  records: PurchaseRequestRecord[]
  source: PurchaseRequestSource
  stockItem: StockItem
  requestedQuantity: number
  priority: PurchaseRequestPriority
  department: PurchaseRequestDepartment
  branchId: string
  warehouseId: string
  reason: string
  sourceReference: string
  supplierProduct?: SupplierProduct
  supplier?: Supplier
}): PurchaseRequestSuggestion => {
  const quantity = Math.max(roundQuantity(requestedQuantity), 0.001)
  const unitPrice = getUnitPriceFromSupplierProduct(supplierProduct) || getRequestPriceFallback(stockItem)

  return {
    id: `purchase_request_suggestion_${source}_${stockItem.id}_${sourceReference}`.replace(/[^a-zA-Z0-9_]+/g, '_'),
    source,
    stockItemId: stockItem.id,
    categoryId: stockItem.categoryId,
    requestedQuantity: quantity,
    unit: stockItem.unit,
    currentStock: stockItem.currentQty,
    minimumStock: stockItem.minQty,
    estimatedUnitPrice: roundMoney(unitPrice),
    estimatedTotalPrice: roundMoney(quantity * unitPrice),
    priority,
    department,
    branchId,
    warehouseId,
    reason,
    sourceReference,
    suggestedSupplierId: supplier?.id,
    supplierName: supplier?.name,
    openRequestNos: getOpenRequestNosForStockItem(records, stockItem.id)
  }
}

const getDefaultBranchId = (
  stockItem: StockItem,
  context: PurchaseRequestReadModelContext
) => {
  if(stockItem.branchId && context.branches.some(branch => branch.id === stockItem.branchId && branch.isActive)){
    return stockItem.branchId
  }
  return context.branches.find(branch => branch.isActive)?.id || context.branches[0]?.id || ''
}

const createStockLevelSuggestions = (
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext
) => {
  const supplierMap = new Map(context.suppliers.map(supplier => [supplier.id, supplier]))

  return context.stockItems
    .filter(stockItem => stockItem.active && stockItem.minQty > 0 && stockItem.currentQty < stockItem.minQty)
    .map(stockItem => {
      const source: PurchaseRequestSource = stockItem.currentQty <= stockItem.minQty * CRITICAL_RATIO
        ? 'CRITICAL_STOCK'
        : 'MINIMUM_STOCK'
      const shortage = Math.max(stockItem.minQty - stockItem.currentQty, 0)
      const requestedQuantity = Math.max(shortage, stockItem.minQty * DEFAULT_REPLENISH_MULTIPLIER - stockItem.currentQty)
      const supplierProduct = resolveSupplierProduct(stockItem.id, context.supplierProducts, supplierMap)
      const supplier = supplierProduct ? supplierMap.get(supplierProduct.supplierId) : undefined
      const branchId = getDefaultBranchId(stockItem, context)

      return createSuggestion({
        records,
        source,
        stockItem,
        requestedQuantity,
        priority: source === 'CRITICAL_STOCK' ? 'URGENT' : 'HIGH',
        department: 'WAREHOUSE',
        branchId,
        warehouseId: branchId,
        reason: source === 'CRITICAL_STOCK'
          ? `${stockItem.name} kritik stok seviyesinin altında.`
          : `${stockItem.name} minimum stok seviyesinin altında.`,
        sourceReference: 'stock-status',
        supplierProduct,
        supplier
      })
    })
    .sort((first, second) => {
      const priorityDiff = Number(second.priority === 'URGENT') - Number(first.priority === 'URGENT')
      if(priorityDiff !== 0) return priorityDiff
      return second.estimatedTotalPrice - first.estimatedTotalPrice
    })
    .slice(0, MAX_SUGGESTIONS_PER_SOURCE)
}

const getActiveRecipesForProduct = (
  productName: string,
  recipes: RecipeManagementRecord[]
) => {
  const normalizedProductName = normalizeText(productName)
  return recipes.filter(recipe => (
    recipe.status === 'Aktif'
    && (
      normalizeText(recipe.productName) === normalizedProductName
      || normalizeText(recipe.recipeName).includes(normalizedProductName)
      || normalizedProductName.includes(normalizeText(recipe.productName))
    )
  ))
}

const findStockItemForIngredient = (
  ingredient: RecipeIngredient,
  stockItems: StockItem[]
) => {
  const materialName = normalizeText(ingredient.materialName)
  return stockItems.find(stockItem => (
    stockItem.active
    && (
      normalizeText(stockItem.name) === materialName
      || normalizeText(stockItem.name).includes(materialName)
      || materialName.includes(normalizeText(stockItem.name))
    )
  ))
}

const convertIngredientToStockUnit = (
  ingredient: RecipeIngredient,
  stockUnit: StockUnit
) => {
  if(ingredient.unit === stockUnit) return ingredient.quantity
  if(ingredient.baseUnit === 'gr' && stockUnit === 'kg') return ingredient.baseQuantity / 1000
  if(ingredient.baseUnit === 'gr' && stockUnit === 'gr') return ingredient.baseQuantity
  if(ingredient.baseUnit === 'ml' && stockUnit === 'lt') return ingredient.baseQuantity / 1000
  if(ingredient.baseUnit === 'ml' && stockUnit === 'ml') return ingredient.baseQuantity
  if(ingredient.baseUnit === stockUnit) return ingredient.baseQuantity
  return ingredient.quantity
}

const isProductionOrderDemandSource = (order: ProductionWorkOrder) => (
  !normalizeText(order.status).includes('tamam')
  && !normalizeText(order.status).includes('iptal')
)

const getProductionSuggestionSource = (order: ProductionWorkOrder): PurchaseRequestSource => (
  order.status === 'Taslak' || order.status === 'Bekliyor'
    ? 'PLANNED_PRODUCTION'
    : 'PRODUCTION_ORDER'
)

const normalizeProductionPriority = (priority: ProductionWorkOrder['priority']): PurchaseRequestPriority => {
  const normalizedPriority = normalizeText(priority)
  if(normalizedPriority.includes('acil')) return 'URGENT'
  if(normalizedPriority.includes('yüksek') || normalizedPriority.includes('yuksek') || normalizedPriority.includes('yã¼ksek')) return 'HIGH'
  if(normalizedPriority.includes('düşük') || normalizedPriority.includes('dusuk') || normalizedPriority.includes('dã¼')) return 'LOW'
  return 'NORMAL'
}

const createProductionSuggestions = (
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext
) => {
  const supplierMap = new Map(context.suppliers.map(supplier => [supplier.id, supplier]))
  const aggregated = new Map<string, {
    stockItem: StockItem
    source: PurchaseRequestSource
    quantity: number
    priority: PurchaseRequestPriority
    branchId: string
    references: string[]
  }>()

  context.productionWorkOrders
    .filter(isProductionOrderDemandSource)
    .forEach(order => {
      const source = getProductionSuggestionSource(order)
      const orderPriority = normalizeProductionPriority(order.priority)

      order.lines.forEach(line => {
        const recipes = getActiveRecipesForProduct(line.productName, context.recipes)
        recipes.forEach(recipe => {
          const productionRatio = recipe.portions > 0 ? Math.max(line.quantity, 1) / recipe.portions : 1
          recipe.ingredients.forEach(ingredient => {
            const stockItem = findStockItemForIngredient(ingredient, context.stockItems)
            if(!stockItem) return

            const requiredQuantity = roundQuantity(convertIngredientToStockUnit(ingredient, stockItem.unit) * productionRatio)
            const shortage = Math.max(0, requiredQuantity - stockItem.currentQty)
            if(shortage <= 0) return

            const branchId = getDefaultBranchId(stockItem, context)
            const key = `${source}:${stockItem.id}:${branchId}`
            const current = aggregated.get(key)

            if(current){
              current.quantity = roundQuantity(current.quantity + shortage)
              current.references.push(order.workOrderNo)
              if(orderPriority === 'URGENT' || (orderPriority === 'HIGH' && current.priority !== 'URGENT')){
                current.priority = orderPriority
              }
              return
            }

            aggregated.set(key, {
              stockItem,
              source,
              quantity: shortage,
              priority: orderPriority,
              branchId,
              references: [order.workOrderNo]
            })
          })
        })
      })
    })

  return Array.from(aggregated.values())
    .map(item => {
      const supplierProduct = resolveSupplierProduct(item.stockItem.id, context.supplierProducts, supplierMap)
      const supplier = supplierProduct ? supplierMap.get(supplierProduct.supplierId) : undefined
      const reference = Array.from(new Set(item.references)).slice(0, 3).join(', ')

      return createSuggestion({
        records,
        source: item.source,
        stockItem: item.stockItem,
        requestedQuantity: item.quantity,
        priority: item.priority,
        department: 'PRODUCTION',
        branchId: item.branchId,
        warehouseId: item.branchId,
        reason: `${reference} üretim ihtiyacı için reçete hammadde açığı.`,
        sourceReference: reference || 'production',
        supplierProduct,
        supplier
      })
    })
    .sort((first, second) => second.estimatedTotalPrice - first.estimatedTotalPrice)
    .slice(0, MAX_SUGGESTIONS_PER_SOURCE)
}

const getWasteSource = (record: StockWasteRecord): PurchaseRequestSource => {
  const text = normalizeText(`${record.reasonCategory} ${record.reasonNote || ''}`)
  return text.includes('kalite') || text.includes('red')
    ? 'QUALITY_REJECTION'
    : 'WASTE'
}

const createWasteSuggestions = (
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext
) => {
  const supplierMap = new Map(context.suppliers.map(supplier => [supplier.id, supplier]))

  return context.stockWasteRecords
    .filter(record => record.status === 'active')
    .map(record => {
      const stockItem = context.stockItems.find(item => item.id === record.stockItemId && item.active)
      if(!stockItem) return null

      const source = getWasteSource(record)
      const supplierProduct = resolveSupplierProduct(stockItem.id, context.supplierProducts, supplierMap)
      const supplier = supplierProduct ? supplierMap.get(supplierProduct.supplierId) : undefined
      const branchId = getDefaultBranchId(stockItem, context)

      return createSuggestion({
        records,
        source,
        stockItem,
        requestedQuantity: Math.max(record.qty, stockItem.minQty > 0 ? stockItem.minQty * 0.25 : record.qty),
        priority: source === 'QUALITY_REJECTION' ? 'HIGH' : 'NORMAL',
        department: source === 'QUALITY_REJECTION' ? 'QUALITY' : 'WAREHOUSE',
        branchId,
        warehouseId: branchId,
        reason: `${record.stockItemName} için ${record.reasonCategory} kaynaklı eksik oluştu.`,
        sourceReference: record.id,
        supplierProduct,
        supplier
      })
    })
    .filter((suggestion): suggestion is PurchaseRequestSuggestion => Boolean(suggestion))
    .sort((first, second) => second.estimatedTotalPrice - first.estimatedTotalPrice)
    .slice(0, MAX_SUGGESTIONS_PER_SOURCE)
}

export const createPurchaseRequestSuggestions = (
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext
) => {
  const suggestions = [
    ...createStockLevelSuggestions(records, context),
    ...createProductionSuggestions(records, context),
    ...createWasteSuggestions(records, context)
  ]
  const uniqueSuggestions = new Map<string, PurchaseRequestSuggestion>()

  suggestions.forEach(suggestion => {
    const key = `${suggestion.source}:${suggestion.stockItemId}:${suggestion.sourceReference}`
    if(uniqueSuggestions.has(key)) return
    uniqueSuggestions.set(key, suggestion)
  })

  return Array.from(uniqueSuggestions.values())
}
