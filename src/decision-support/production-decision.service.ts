import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { percent, sumBy } from '../kpi-reporting/kpi.utils'
import { createDecisionSuggestion } from './recommendation-engine.service'
import type { DecisionSuggestion } from './decision-support.types'
import {
  getDateKey,
  getProductLabel,
  getTodayKey,
  isCancelledProductionOrder,
  isCompletedProductionOrder
} from './decision-support.utils'

const MAX_ENTITY_SUGGESTIONS = 6

const getOrderQuantity = (order: KpiSourceData['productionOrders'][number]) => (
  sumBy(order.lines, line => line.quantity)
)

const isWithinLastDays = (dateValue: string, days: number) => {
  const dateKey = getDateKey(dateValue)
  if(!dateKey) return false
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return dateKey >= start.toLocaleDateString('sv-SE') && dateKey <= getTodayKey()
}

const createDelayedProductionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.productionOrders
  .filter(order => (
    !isCompletedProductionOrder(order)
    && !isCancelledProductionOrder(order)
    && getDateKey(order.deliveryDate) < getTodayKey()
  ))
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(order => createDecisionSuggestion({
    category: 'Production',
    title: `Geciken uretim emri: ${order.workOrderNo}`,
    description: `${order.branch} icin planlanan uretim teslim tarihi gecti.`,
    reason: `Delivery date ${order.deliveryDate}, status ${order.status}, estimated ${order.estimatedMinutes} dk.`,
    ruleId: 'production-delay-shift',
    relatedEntityType: 'ProductionWorkOrder',
    relatedEntityId: order.id,
    relatedWorkOrderId: order.id,
    branchId: sourceData.branches.find(branch => branch.name === order.branch)?.id || '',
    evidenceScore: Math.min(30, 10 + order.lines.length * 2),
    createdAt: order.deliveryDate || order.createdAt,
    recommendationAction: 'Ek vardiya veya alternatif hatta aktarim planla.',
    expectedImpact: 'Geciken uretim emirlerinin teslim riskini azaltir.',
    ownerRole: 'Uretim Muduru'
  }))

const createHighProductionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const recentOrders = sourceData.productionOrders.filter(order => (
    !isCancelledProductionOrder(order)
    && isWithinLastDays(order.createdAt || order.deliveryDate, 7)
  ))
  const productBuckets = new Map<string, number>()

  recentOrders.forEach(order => {
    order.lines.forEach(line => {
      productBuckets.set(line.productName, (productBuckets.get(line.productName) || 0) + line.quantity)
    })
  })

  const values = Array.from(productBuckets.values())
  const averageQuantity = values.length > 0 ? sumBy(values, value => value) / values.length : 0

  return Array.from(productBuckets.entries())
    .filter(([, quantity]) => quantity > Math.max(averageQuantity * 1.3, 20))
    .slice(0, 3)
    .map(([productName, quantity]) => createDecisionSuggestion({
      category: 'Production',
      title: `Ara stok onerisi: ${productName}`,
      description: 'Son 7 gunde ayni urun yogun uretildi.',
      reason: `${productName} son 7 gunde ${quantity.toLocaleString('tr-TR')} uretim miktarina ulasti.`,
      ruleId: 'production-buffer-stock',
      relatedEntityType: 'Product',
      relatedEntityId: productName,
      relatedProductId: sourceData.productRefs.find(product => product.name === productName)?.id || '',
      evidenceScore: Math.min(30, quantity / Math.max(averageQuantity || 1, 1) * 6),
      recommendationAction: 'Ara stok hedef seviyesi ve FEFO kullanim plani olustur.',
      expectedImpact: 'Tekrarlayan uretim baskisini ve ani sevkiyat riskini azaltir.',
      ownerRole: 'Uretim Planlama'
    }))
}

const createCapacitySuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.productionLines
  .filter(line => line.estimatedUtilization >= 95)
  .map(line => createDecisionSuggestion({
    category: 'Production',
    title: `Kapasite riski: ${line.name}`,
    description: `${line.name} hatti %95 uzerinde kullanimda.`,
    reason: `Estimated utilization ${line.estimatedUtilization}%, active work order ${line.activeWorkOrderCount}.`,
    ruleId: 'production-capacity-line',
    relatedEntityType: 'ProductionLine',
    relatedEntityId: line.id,
    evidenceScore: Math.min(30, line.estimatedUtilization - 80),
    createdAt: line.updatedAt || line.createdAt,
    recommendationAction: 'Yeni uretim hatti, ekipman kapasitesi veya vardiya artisi degerlendir.',
    expectedImpact: 'Darbogaz kaynakli gecikme ve kalite riskini dusurur.',
    ownerRole: 'Operasyon Muduru'
  }))

const createFireSuggestion = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const recentWaste = sourceData.stockWasteRecords.filter(record => record.status === 'active' && isWithinLastDays(record.occurredAt || record.createdAt, 30))
  const recentProduction = sourceData.productionOrders.filter(order => isWithinLastDays(order.createdAt || order.deliveryDate, 30))
  const wasteQuantity = sumBy(recentWaste, record => record.qty)
  const productionQuantity = sumBy(recentProduction, getOrderQuantity)
  const fireRate = percent(wasteQuantity, productionQuantity)

  if(fireRate <= 3) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: 'Fire orani icin kok neden analizi',
    description: 'Son 30 gunde fire orani uretim miktarina gore yuksek.',
    reason: `Fire orani ${fireRate.toLocaleString('tr-TR')}%, fire miktari ${wasteQuantity.toLocaleString('tr-TR')}.`,
    ruleId: 'production-fire-root-cause',
    relatedEntityType: 'StockWasteRecord',
    relatedEntityId: recentWaste[0]?.id || 'stock-waste',
    branchId: recentWaste[0]?.branchId || '',
    evidenceScore: Math.min(30, fireRate * 3),
    createdAt: recentWaste[0]?.occurredAt || new Date().toISOString(),
    recommendationAction: 'Recete, operator, proses sicakligi ve paketleme kayiplarini birlikte analiz et.',
    expectedImpact: 'Fire maliyetini ve tekrar eden proses hatalarini azaltir.',
    ownerRole: 'Uretim Muduru'
  })]
}

export const createProductionDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => [
  ...createDelayedProductionSuggestions(sourceData),
  ...createHighProductionSuggestions(sourceData),
  ...createCapacitySuggestions(sourceData),
  ...createFireSuggestion(sourceData)
]
