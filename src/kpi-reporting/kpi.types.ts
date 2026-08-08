import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { HACCPPlanRecord } from '../haccp/haccp.types'
import type { InventoryLotProductReference } from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ProductRecall } from '../product-recalls/product-recall.types'
import type { ProductionLine } from '../production-lines/production-line.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { PurchaseApproval } from '../purchase-approvals/purchase-approval.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import type { ShipmentExecutionRecord } from '../shipment-executions/shipment-execution.types'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentReturnRecord } from '../shipment-returns/shipment-return.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentWaybillRecord } from '../shipment-waybills/shipment-waybill.types'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import type { Branch, StockItem, StockMovement, StockWasteRecord } from '../types'
import type { WitnessSample } from '../witness-samples/witness-sample.types'

export type KpiPeriodFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
export type KpiDashboardTab = 'EXECUTIVE' | 'PRODUCTION' | 'INVENTORY' | 'QUALITY' | 'PURCHASING' | 'SHIPMENT'
export type KpiExportFormat = 'EXCEL' | 'PDF' | 'PRINT'
export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger'

export type KpiFilters = {
  period: KpiPeriodFilter
  branchId: string
  warehouseId: string
  productId: string
  lotId: string
  supplierId: string
  operator: string
}

export type KPICard = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

export type DashboardMetric = {
  id: string
  label: string
  value: number
  formattedValue: string
  unit: string
  detail: string
  tone: KpiTone
}

export type TrendPoint = {
  label: string
  dateKey: string
  value: number
}

export type ChartSeries = {
  id: string
  label: string
  color: string
  points: TrendPoint[]
}

export type BarChartRow = {
  id: string
  label: string
  value: number
  formattedValue: string
  detail: string
  tone?: KpiTone
}

export type PieChartSlice = {
  id: string
  label: string
  value: number
  formattedValue: string
  color: string
}

export type KpiReportDefinition = {
  id: string
  title: string
  description: string
  owner: string
}

export type ExecutiveSummary = {
  cards: KPICard[]
  lineCharts: ChartSeries[]
  barCharts: {
    topProducts: BarChartRow[]
    topSuppliers: BarChartRow[]
    topWarehouses: BarChartRow[]
    topCcpFailures: BarChartRow[]
  }
  pieCharts: {
    inventoryDistribution: PieChartSlice[]
    productionDistribution: PieChartSlice[]
    shipmentStatus: PieChartSlice[]
    qualityStatus: PieChartSlice[]
  }
}

export type ProductionKpiView = {
  cards: KPICard[]
  productionTrend: ChartSeries
  productProduction: BarChartRow[]
  lineProduction: BarChartRow[]
  operatorProduction: BarChartRow[]
}

export type InventoryKpiView = {
  cards: KPICard[]
  inventoryTrend: ChartSeries
  warehouseOccupancy: BarChartRow[]
  mostUsedRawMaterials: BarChartRow[]
  inventoryDistribution: PieChartSlice[]
}

export type QualityKpiView = {
  cards: KPICard[]
  monitoringTrend: ChartSeries
  recallTrend: ChartSeries
  ccpFailures: BarChartRow[]
  qualityStatus: PieChartSlice[]
}

export type PurchasingKpiView = {
  cards: KPICard[]
  supplierPerformance: BarChartRow[]
  topSuppliers: BarChartRow[]
}

export type ShipmentKpiView = {
  cards: KPICard[]
  shipmentTrend: ChartSeries
  vehicleUtilization: BarChartRow[]
  shipmentStatus: PieChartSlice[]
}

export type KpiDashboardView = {
  generatedAt: string
  filters: KpiFilters
  executive: ExecutiveSummary
  production: ProductionKpiView
  inventory: InventoryKpiView
  quality: QualityKpiView
  purchasing: PurchasingKpiView
  shipment: ShipmentKpiView
  reports: KpiReportDefinition[]
}

export type KpiSourceData = {
  branches: Branch[]
  stockItems: StockItem[]
  stockMovements: StockMovement[]
  stockWasteRecords: StockWasteRecord[]
  recipeRecords: RecipeManagementRecord[]
  productRefs: InventoryLotProductReference[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  approvalRecords: PurchaseApproval[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  productionOrders: ProductionWorkOrder[]
  productionLines: ProductionLine[]
  inventoryLots: InventoryLot[]
  qualitySamples: QualitySample[]
  witnessSamples: WitnessSample[]
  productRecalls: ProductRecall[]
  haccpRecords: HACCPPlanRecord[]
  shipments: ShipmentRecord[]
  shipmentExecutions: ShipmentExecutionRecord[]
  shipmentWorkOrders: ShipmentWorkOrderRecord[]
  shipmentPallets: ShipmentPalletRecord[]
  shipmentVehicles: ShipmentVehicleRecord[]
  shipmentPlans: ShipmentPlanRecord[]
  shipmentReturns: ShipmentReturnRecord[]
  shipmentWaybills: ShipmentWaybillRecord[]
}
