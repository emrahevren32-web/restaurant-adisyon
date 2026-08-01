import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  percent,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { createDecisionSuggestion } from './recommendation-engine.service'
import type { DecisionSuggestion } from './decision-support.types'
import {
  getDaysBetween,
  getSupplierName
} from './decision-support.utils'

const MAX_ENTITY_SUGGESTIONS = 8

const getSupplierOrders = (
  supplierId: string,
  purchaseOrders: PurchaseOrder[]
) => purchaseOrders.filter(order => order.supplierId === supplierId && order.status !== 'CANCELLED')

const getSupplierReceipts = (
  supplierId: string,
  goodsReceipts: GoodsReceiptRecord[]
) => goodsReceipts.filter(receipt => receipt.supplierId === supplierId && receipt.status !== 'CANCELLED')

const createLateSupplierSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.suppliers
  .map(supplier => {
    const supplierReceipts = getSupplierReceipts(supplier.id, sourceData.goodsReceipts)
    const averageDeliveryDays = averageBy(supplierReceipts, receipt => {
      const order = sourceData.purchaseOrders.find(record => record.id === receipt.purchaseOrderId)
      return order ? getDaysBetween(order.orderDate, receipt.receiptDate) : supplier.leadTimeDays
    })
    return { supplier, supplierReceipts, averageDeliveryDays }
  })
  .filter(record => record.supplierReceipts.length > 0 && record.averageDeliveryDays > record.supplier.leadTimeDays + 2)
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(record => createDecisionSuggestion({
    category: 'Purchasing',
    title: `Teslim suresi uzadi: ${record.supplier.name}`,
    description: 'Tedarikci ortalama teslim suresi beklenen lead time uzerinde.',
    reason: `Ortalama ${record.averageDeliveryDays} gün, teslim süresi ${record.supplier.leadTimeDays} gün.`,
    ruleId: 'purchasing-late-supplier',
    relatedEntityType: 'Supplier',
    relatedEntityId: record.supplier.id,
    relatedSupplierId: record.supplier.id,
    evidenceScore: Math.min(30, (record.averageDeliveryDays - record.supplier.leadTimeDays) * 4),
    recommendationAction: 'Alternatif tedarikçi kısa listesi oluştur ve kritik kalemlerde ikinci kaynak aç.',
    expectedImpact: 'Mal kabul gecikmelerini ve uretim kesinti riskini azaltir.',
    ownerRole: 'Satin Alma'
  }))

const createRejectionRiskSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.suppliers
  .map(supplier => {
    const supplierReceipts = getSupplierReceipts(supplier.id, sourceData.goodsReceipts)
    const items = supplierReceipts.flatMap(receipt => receipt.items)
    const receivedQuantity = sumBy(items, item => item.receivedQuantity)
    const rejectedQuantity = sumBy(items, item => item.rejectedQuantity)
    const rejectionRate = percent(rejectedQuantity, receivedQuantity)
    return { supplier, rejectionRate, rejectedQuantity, receivedQuantity }
  })
  .filter(record => record.rejectionRate > 5)
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(record => createDecisionSuggestion({
    category: 'Purchasing',
    title: `Tedarikçi riski: ${record.supplier.name}`,
    description: 'Mal kabul red orani tedarikci risk esigini asti.',
    reason: `Red orani ${record.rejectionRate.toLocaleString('tr-TR')}%, red ${record.rejectedQuantity}, kabul ${record.receivedQuantity}.`,
    ruleId: 'purchasing-rejection-risk',
    relatedEntityType: 'Supplier',
    relatedEntityId: record.supplier.id,
    relatedSupplierId: record.supplier.id,
    evidenceScore: Math.min(30, record.rejectionRate * 2),
    recommendationAction: 'Tedarikçi kalite görüşmesi, şartname kontrolü ve alternatif tedarikçi değerlendirmesi yap.',
    expectedImpact: 'Mal kabul redlerini ve iade surecini azaltir.',
    ownerRole: 'Satin Alma'
  }))

const createSingleSupplierSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const activeOrders = sourceData.purchaseOrders.filter(order => order.status !== 'CANCELLED')
  const totalVolume = sumBy(activeOrders, order => order.grandTotal)
  if(totalVolume <= 0) return []

  const supplierVolumes = new Map<string, number>()
  activeOrders.forEach(order => {
    supplierVolumes.set(order.supplierId, (supplierVolumes.get(order.supplierId) || 0) + order.grandTotal)
  })

  return Array.from(supplierVolumes.entries())
    .map(([supplierId, volume]) => ({ supplierId, volume, share: percent(volume, totalVolume) }))
    .filter(record => record.share > 50)
    .slice(0, 3)
    .map(record => createDecisionSuggestion({
      category: 'Purchasing',
      title: `Tek tedarikçi yoğunluğu: ${getSupplierName(sourceData, record.supplierId)}`,
      description: 'Alim hacminin buyuk bolumu tek tedarikcide toplanmis.',
      reason: `Tedarikçi payı ${record.share.toLocaleString('tr-TR')}%, hacim ${record.volume.toLocaleString('tr-TR')}.`,
      ruleId: 'purchasing-single-supplier',
      relatedEntityType: 'Supplier',
      relatedEntityId: record.supplierId,
      relatedSupplierId: record.supplierId,
      evidenceScore: Math.min(30, record.share - 45),
      recommendationAction: 'İkinci tedarikçi belirle ve kritik kalemlerde çift kaynak stratejisi uygula.',
      expectedImpact: 'Tedarik surekliligi ve pazarlik gucunu iyilestirir.',
      ownerRole: 'Satin Alma Muduru'
    }))
}

export const createPurchasingDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => [
  ...createLateSupplierSuggestions(sourceData),
  ...createRejectionRiskSuggestions(sourceData),
  ...createSingleSupplierSuggestions(sourceData)
]
