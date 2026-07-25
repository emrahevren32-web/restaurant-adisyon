import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { ProductRecall } from '../product-recalls/product-recall.types'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import type { StockItem } from '../types'
import type { WitnessSample } from '../witness-samples/witness-sample.types'

export type ProductHistoryEventType =
  | 'PRODUCTION_ORDER'
  | 'LOT_CREATED'
  | 'SAMPLE_COLLECTED'
  | 'WITNESS_SAMPLE_CREATED'
  | 'RECALL_OPENED'

export type ProductHistoryProductReference = {
  id: string
  name: string
  stockItemId?: string
}

export type ProductHistoryBuildInput = {
  productionOrders: ProductionWorkOrder[]
  inventoryLots: InventoryLot[]
  qualitySamples: QualitySample[]
  witnessSamples: WitnessSample[]
  recalls: ProductRecall[]
  products: ProductHistoryProductReference[]
  stockItems: Pick<StockItem, 'id' | 'name'>[]
}

export type ProductHistoryEvent = {
  id: string
  eventType: ProductHistoryEventType
  occurredAt: string
  dateKey: string
  timeKey: string
  referenceNo: string
  productIds: string[]
  productName: string
  productionOrderId: string
  productionOrderNo: string
  inventoryLotId: string
  lotNo: string
  qualitySampleId: string
  sampleNo: string
  witnessSampleId: string
  witnessNo: string
  recallId: string
  recallNo: string
  description: string
  searchText: string
}

export type ProductHistoryIndex = {
  productionOrderMap: Map<string, ProductionWorkOrder>
  lotsByProductionOrderId: Map<string, InventoryLot[]>
  lotMap: Map<string, InventoryLot>
  samplesByLotId: Map<string, QualitySample[]>
  sampleMap: Map<string, QualitySample>
  witnessSamplesBySampleId: Map<string, WitnessSample[]>
  witnessSampleMap: Map<string, WitnessSample>
  recallsByLotId: Map<string, ProductRecall[]>
  recallMap: Map<string, ProductRecall>
  productMap: Map<string, ProductHistoryProductReference>
  stockItemMap: Map<string, Pick<StockItem, 'id' | 'name'>>
}

export type ProductHistoryBuildResult = {
  events: ProductHistoryEvent[]
  index: ProductHistoryIndex
  productOptions: ProductHistoryProductReference[]
}
