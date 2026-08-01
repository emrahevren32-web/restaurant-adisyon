import { calculatePurchaseRecommendationReport } from '../purchase-recommendations/purchase-recommendation-calculation.service'
import type { PurchaseRecommendationItem } from '../purchase-recommendations/purchase-recommendation.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const ruleIdByType: Record<PurchaseRecommendationItem['recommendationType'], string> = {
  CRITICAL_STOCK: 'purchase-recommendation-critical-stock',
  STOCKOUT_SOON: 'purchase-recommendation-stockout-soon',
  FORECAST_ORDER: 'purchase-recommendation-forecast-order',
  BULK_BUY: 'purchase-recommendation-bulk-buy',
  ALTERNATIVE_SUPPLIER: 'purchase-recommendation-alternative-supplier',
  COST_ADVANTAGE: 'purchase-recommendation-cost-advantage',
  WASTE_REPLENISHMENT: 'purchase-recommendation-waste-replenishment',
  SEASONAL_PURCHASE: 'purchase-recommendation-seasonal-purchase'
}

export const createPurchaseRecommendationDecisionSuggestions = (
  sourceData: KpiSourceData
) => {
  const report = calculatePurchaseRecommendationReport({
    reportDate: new Date().toLocaleDateString('sv-SE'),
    scope: 'all',
    responsiblePerson: 'Karar Destek Merkezi',
    description: 'Karar Destek satın alma önerisi kaynağı.',
    sourceData,
    actorName: 'Karar Destek Merkezi',
    decisionSuggestions: [],
    getReportNo: () => `PR-REC-${new Date().getFullYear()}-000000`
  })

  return report.items
    .filter(item => item.risk === 'HIGH' || item.risk === 'CRITICAL' || item.priority === 'URGENT' || item.expectedSaving > 0)
    .slice(0, 10)
    .map(item => createDecisionSuggestion({
      category: 'Purchasing',
      title: item.title,
      description: item.description,
      reason: item.reason,
      ruleId: ruleIdByType[item.recommendationType],
      relatedEntityType: item.relatedEntityType,
      relatedEntityId: item.relatedEntityId,
      relatedProductId: item.stockItemId || item.productId,
      relatedSupplierId: item.supplierId || item.alternativeSupplierId,
      branchId: item.branchId,
      warehouseId: item.warehouseId,
      evidenceScore: Math.max(0, Math.min(30, item.riskScore - 55)),
      createdAt: item.createdAt,
      recommendationAction: item.action,
      expectedImpact: item.expectedImpact,
      ownerRole: item.ownerRole
    }))
}
