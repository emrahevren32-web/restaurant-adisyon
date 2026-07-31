import type {
  PurchaseRecommendationHistory,
  PurchaseRecommendationHistoryAction,
  PurchaseRecommendationReport
} from './purchase-recommendation.types'

export const createPurchaseRecommendationHistory = (
  reportId: string,
  action: PurchaseRecommendationHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): PurchaseRecommendationHistory => ({
  id: `${reportId}_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendPurchaseRecommendationHistory = (
  report: PurchaseRecommendationReport,
  action: PurchaseRecommendationHistoryAction,
  actorName: string,
  description: string
): PurchaseRecommendationReport => ({
  ...report,
  revisionNo: report.revisionNo + 1,
  updatedAt: new Date().toISOString(),
  history: [
    ...report.history,
    createPurchaseRecommendationHistory(report.id, action, actorName, description, report.revisionNo + 1)
  ]
})

export const PurchaseRecommendationHistoryService = {
  create: createPurchaseRecommendationHistory,
  append: appendPurchaseRecommendationHistory
}
