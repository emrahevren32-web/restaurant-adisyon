import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadHACCPRecords } from '../haccp/haccp.mock'
import {
  isProductionInventoryLot,
  loadLotSystemInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLotProductReference } from '../inventory-lots/inventory-lot.mock'
import { loadIntermediateProducts } from '../intermediate-products/intermediate-product.mock'
import type { IntermediateProduct } from '../intermediate-products/intermediate-product.types'
import { loadProductionLines } from '../production-lines/production-line.mock'
import { loadProductionWorkOrders } from '../production-work-orders/production-work-order.mock'
import { loadProductRecallRecords } from '../product-recalls/product-recall.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadQualitySampleRecords } from '../quality-samples/quality-sample.mock'
import { loadRecipeManagementRecords } from '../recipe-management/recipe-management.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadShipmentExecutionRecords } from '../shipment-executions/shipment-execution.mock'
import { loadShipmentPalletRecords } from '../shipment-pallets/shipment-pallet.mock'
import { loadShipmentPlanRecords } from '../shipment-plans/shipment-plan.mock'
import { loadShipmentReturnRecords } from '../shipment-returns/shipment-return.mock'
import { loadShipmentVehicleRecords } from '../shipment-vehicles/shipment-vehicle.mock'
import { loadShipmentWaybillRecords } from '../shipment-waybills/shipment-waybill.mock'
import { loadShipmentWorkOrderRecords } from '../shipment-work-orders/shipment-work-order.mock'
import { loadShipmentRecords } from '../shipments/shipment.mock'
import { loadBranches, loadStockItems, loadStockMovements, loadStockWasteRecords } from '../storage'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { StockItem, StockUnit } from '../types'
import { loadWitnessSampleRecords } from '../witness-samples/witness-sample.mock'
import type { KpiSourceData } from './kpi.types'

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const normalizeSearchText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const createProductRefs = (
  finalProducts: FinalProduct[],
  intermediateProducts: IntermediateProduct[],
  stockItems: StockItem[]
): InventoryLotProductReference[] => {
  const stockItemByName = new Map(stockItems.map(item => [normalizeSearchText(item.name), item]))
  const seenIds = new Set<string>()

  const fromProduct = (product: FinalProduct | IntermediateProduct): InventoryLotProductReference => {
    const stockItem = stockItemByName.get(normalizeSearchText(product.name))
    return {
      id: product.id,
      name: product.name,
      unit: normalizeUnit(product.unit),
      stockItemId: stockItem?.id
    }
  }

  return [...finalProducts.map(fromProduct), ...intermediateProducts.map(fromProduct)]
    .filter(product => {
      if(seenIds.has(product.id)) return false
      seenIds.add(product.id)
      return true
    })
}

const getTraceableLots = (sourceLots: ReturnType<typeof loadLotSystemInventoryLotRecords>) => {
  const productionLots = sourceLots.filter(isProductionInventoryLot)
  return productionLots.length > 0 ? productionLots : sourceLots
}

export const loadKpiSourceData = (): KpiSourceData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const stockMovements = loadStockMovements()
  const stockWasteRecords = loadStockWasteRecords()
  const recipeRecords = loadRecipeManagementRecords()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const productionOrders = loadProductionWorkOrders()
  const productionLines = loadProductionLines()
  const finalProducts = loadFinalProducts()
  const intermediateProducts = loadIntermediateProducts()
  const productRefs = createProductRefs(finalProducts, intermediateProducts, stockItems)
  const inventoryLots = getTraceableLots(loadLotSystemInventoryLotRecords(goodsReceipts, productionOrders, branches, productRefs))
  const traceableLotIds = new Set(inventoryLots.map(lot => lot.id))
  const qualitySamples = loadQualitySampleRecords(inventoryLots)
    .filter(sample => traceableLotIds.has(sample.inventoryLotId))
  const witnessSamples = loadWitnessSampleRecords(qualitySamples)
  const productRecalls = loadProductRecallRecords(inventoryLots)
  const haccpRecords = loadHACCPRecords(productionOrders, inventoryLots, qualitySamples)
  const shipments = loadShipmentRecords(inventoryLots, branches)
  const shipmentExecutions = loadShipmentExecutionRecords(shipments)
  const shipmentWorkOrders = loadShipmentWorkOrderRecords(inventoryLots, branches, shipments)
  const shipmentPallets = loadShipmentPalletRecords(shipmentWorkOrders)
  const shipmentVehicles = loadShipmentVehicleRecords(shipmentPallets)
  const shipmentPlans = loadShipmentPlanRecords(shipmentVehicles, shipmentPallets, shipmentWorkOrders)
  const shipmentReturns = loadShipmentReturnRecords(shipmentPlans, shipmentVehicles, shipmentPallets)
  const shipmentWaybills = loadShipmentWaybillRecords(shipmentPlans, shipmentVehicles, shipmentPallets, shipmentReturns)

  return {
    branches,
    stockItems,
    stockMovements,
    stockWasteRecords,
    recipeRecords,
    productRefs,
    purchaseRequests,
    suppliers,
    supplierProducts,
    rfqRecords,
    approvalRecords,
    purchaseOrders,
    goodsReceipts,
    productionOrders,
    productionLines,
    inventoryLots,
    qualitySamples,
    witnessSamples,
    productRecalls,
    haccpRecords,
    shipments,
    shipmentExecutions,
    shipmentWorkOrders,
    shipmentPallets,
    shipmentVehicles,
    shipmentPlans,
    shipmentReturns,
    shipmentWaybills
  }
}
