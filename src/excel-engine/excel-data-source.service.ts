import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import { createKpiDashboardView, createDefaultKpiFilters } from '../kpi-reporting/kpi.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import {
  formatCurrency,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  loadCategories,
  loadProducts,
  loadStockCategories,
  loadStockItems
} from '../storage'
import type { ExcelDataSet, ExcelExportOptions, ExcelModuleKey, ExcelRow } from './excel-engine.types'
import {
  EXCEL_MODULE_LABELS,
  getExcelTemplate
} from './excel-template.service'

const normalizeText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const getCategoryName = (
  categoryId: string,
  categories: Array<{ id: string; name: string }>
) => categories.find(category => category.id === categoryId)?.name || categoryId

const getSupplierName = (
  supplierId: string,
  suppliers: Array<{ id: string; name: string }>
) => suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId

const getStockItemName = (
  stockItemId: string,
  stockItems: Array<{ id: string; name: string }>
) => stockItems.find(item => item.id === stockItemId)?.name || stockItemId

const createDataSet = (
  moduleKey: ExcelModuleKey,
  rows: ExcelRow[]
): ExcelDataSet => ({
  moduleKey,
  moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
  columns: getExcelTemplate(moduleKey).columns,
  rows
})

const getProductRows = (): ExcelRow[] => {
  const categories = loadCategories()

  return loadProducts().map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    categoryName: getCategoryName(product.categoryId, categories),
    branchName: product.branchId,
    active: product.active,
    calories: product.calories,
    description: product.description || ''
  }))
}

const getStockRows = (): ExcelRow[] => {
  const categories = loadStockCategories()

  return loadStockItems().map(item => ({
    id: item.id,
    name: item.name,
    categoryName: getCategoryName(item.categoryId, categories),
    unit: item.unit,
    currentQty: item.currentQty,
    minQty: item.minQty,
    sku: item.sku || '',
    barcode: item.barcode || '',
    unitPurchasePrice: item.unitPurchasePrice || item.lastPurchasePrice || item.averageCost || 0,
    averageCost: item.averageCost || 0,
    lastPurchasePrice: item.lastPurchasePrice || 0,
    supplierName: item.lastSupplierName || '',
    active: item.active
  }))
}

const getRecipeRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.recipeRecords.flatMap(recipe => recipe.ingredients.map(ingredient => ({
    id: `${recipe.id}-${ingredient.id}`,
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    recipeType: recipe.recipeType,
    productName: recipe.productName,
    portions: recipe.portions,
    firePercent: recipe.firePercent,
    ingredientName: ingredient.materialName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    unitCost: ingredient.unitCost
  })))
}

const getSupplierRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.suppliers.map(supplier => ({
    id: supplier.id,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    tradeName: supplier.tradeName,
    type: supplier.type,
    companyType: supplier.companyType,
    contactName: supplier.contactName,
    contactPhone: supplier.contactPhone,
    contactEmail: supplier.contactEmail,
    city: supplier.city,
    leadTimeDays: supplier.leadTimeDays,
    paymentTermDays: supplier.paymentTermDays
  }))
}

const getPurchaseRequestRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.purchaseRequests.flatMap(record => record.items.map(item => ({
    id: `${record.id}-${item.id}`,
    requestNo: record.requestNo,
    title: record.title,
    requester: record.requester,
    branchName: sourceData.branches.find(branch => branch.id === record.branchId)?.name || record.branchId,
    warehouseName: sourceData.branches.find(branch => branch.id === record.warehouseId)?.name || record.warehouseId,
    department: record.department,
    priority: record.priority,
    requiredDate: record.requiredDate,
    stockItemName: getStockItemName(item.stockItemId, sourceData.stockItems),
    quantity: item.quantity,
    estimatedUnitPrice: item.estimatedUnitPrice,
    notes: item.notes || record.notes
  })))
}

const getPurchaseOrderRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.purchaseOrders.map(order => ({
    id: order.id,
    orderNo: order.orderNo,
    supplierName: getSupplierName(order.supplierId, sourceData.suppliers),
    orderDate: order.orderDate,
    status: order.status,
    grandTotal: order.grandTotal
  }))
}

const getLotRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.inventoryLots.map(lot => ({
    id: lot.id,
    lotNo: lot.lotNo,
    productName: sourceData.productRefs.find(product => product.id === lot.productId)?.name || getStockItemName(lot.stockItemId, sourceData.stockItems),
    warehouseId: lot.warehouseId,
    quantity: lot.quantity,
    remainingQuantity: lot.remainingQuantity,
    expiryDate: lot.expiryDate
  }))
}

const getWasteRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.stockWasteRecords.map(record => ({
    id: record.id,
    stockItemName: record.stockItemName,
    qty: record.qty,
    unit: record.unit,
    reasonCategory: record.reasonCategory,
    estimatedTotalCost: record.estimatedTotalCost || 0
  }))
}

const getProductionOrderRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.productionOrders.flatMap(order => order.lines.map(line => ({
    id: `${order.id}-${line.id}`,
    workOrderNo: order.workOrderNo,
    branch: order.branch,
    status: order.status,
    productName: line.productName,
    quantity: line.quantity
  })))
}

const getQualityRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const sampleRows = sourceData.qualitySamples.map(sample => ({
    id: sample.id,
    recordNo: sample.sampleNo,
    module: 'Quality Sample',
    status: sample.status,
    date: sample.sampleDate || sample.createdAt,
    productName: sourceData.inventoryLots.find(lot => lot.id === sample.inventoryLotId)?.lotNo || sample.inventoryLotId
  }))
  const recallRows = sourceData.productRecalls.map(recall => ({
    id: recall.id,
    recordNo: recall.recallNo,
    module: 'Product Recall',
    status: recall.status,
    date: recall.reportedDate || recall.createdAt,
    productName: sourceData.inventoryLots.find(lot => lot.id === recall.inventoryLotId)?.lotNo || recall.inventoryLotId
  }))

  return [...sampleRows, ...recallRows]
}

const getShipmentRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.shipments.flatMap(shipment => {
    if(shipment.items.length === 0){
      return [{
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        shipmentDate: shipment.shipmentDate,
        status: shipment.status,
        quantity: 0
      }]
    }

    return shipment.items.map(item => ({
      id: `${shipment.id}-${item.id}`,
      shipmentNo: shipment.shipmentNo,
      shipmentDate: shipment.shipmentDate,
      status: shipment.status,
      quantity: item.quantity
    }))
  })
}

const getKpiRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const dashboard = createKpiDashboardView(sourceData, createDefaultKpiFilters())
  const groups = [
    ['Executive', dashboard.executive.cards],
    ['Production', dashboard.production.cards],
    ['Inventory', dashboard.inventory.cards],
    ['Quality', dashboard.quality.cards],
    ['Purchasing', dashboard.purchasing.cards],
    ['Shipment', dashboard.shipment.cards]
  ] as const

  return groups.flatMap(([area, cards]) => cards.map(card => ({
    id: `${area}-${card.id}`,
    area,
    metric: card.label,
    value: card.value,
    detail: card.detail
  })))
}

const getCostEngineRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const view = createCostEngineView(sourceData, createDefaultCostEngineFilters())

  return view.records.map(record => ({
    id: record.id,
    productName: record.productName,
    recipeName: record.recipeName,
    totalCost: record.totalCost,
    costPerKg: record.costPerKg,
    fireImpact: record.fireImpact,
    purchaseImpact: record.purchaseImpact
  }))
}

const getRowsForModule = (
  moduleKey: ExcelModuleKey
): ExcelRow[] => {
  if(moduleKey === 'products') return getProductRows()
  if(moduleKey === 'recipes') return getRecipeRows()
  if(moduleKey === 'raw-materials') return getStockRows()
  if(moduleKey === 'suppliers') return getSupplierRows()
  if(moduleKey === 'purchase-requests') return getPurchaseRequestRows()
  if(moduleKey === 'purchase-orders') return getPurchaseOrderRows()
  if(moduleKey === 'stock') return getStockRows()
  if(moduleKey === 'lots') return getLotRows()
  if(moduleKey === 'waste') return getWasteRows()
  if(moduleKey === 'production-orders') return getProductionOrderRows()
  if(moduleKey === 'quality') return getQualityRows()
  if(moduleKey === 'shipments') return getShipmentRows()
  if(moduleKey === 'kpi') return getKpiRows()
  if(moduleKey === 'cost-engine') return getCostEngineRows()
  return []
}

const matchesFilter = (
  row: ExcelRow,
  filterText: string
) => {
  if(!filterText.trim()) return true
  const search = normalizeText(filterText)
  return Object.values(row).some(value => normalizeText(value).includes(search))
}

const applyExportScope = (
  rows: ExcelRow[],
  options: ExcelExportOptions
) => {
  const filteredRows = options.scope === 'ALL'
    ? rows
    : rows.filter(row => matchesFilter(row, options.filterText))

  if(options.scope !== 'SELECTED') return filteredRows

  const selectedIds = new Set(options.selectedRecordIds)
  return filteredRows.filter(row => selectedIds.has(String(row.id || '')))
}

export const ExcelDataSourceService = {
  getDataSet: (moduleKey: ExcelModuleKey, options?: ExcelExportOptions) => {
    const rows = getRowsForModule(moduleKey)
    return createDataSet(moduleKey, options ? applyExportScope(rows, options) : rows)
  },

  getDataSets: (options: ExcelExportOptions) => (
    options.moduleKeys.map(moduleKey => ExcelDataSourceService.getDataSet(moduleKey, options))
  ),

  summarizeRows: (moduleKey: ExcelModuleKey) => {
    const rows = getRowsForModule(moduleKey)
    const numericTotal = rows.reduce((total, row) => {
      const costValue = Number(row.totalCost || row.grandTotal || row.estimatedTotalCost || row.price || 0)
      return total + (Number.isFinite(costValue) ? costValue : 0)
    }, 0)

    return {
      moduleKey,
      moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
      rowCount: rows.length,
      total: numericTotal > 0 ? formatCurrency(numericTotal) : formatNumber(rows.length),
      percent: rows.length > 0 ? formatPercent(100) : formatPercent(0)
    }
  }
}
