import type {
  ProductionPlanningRecommendationHistory,
  ProductionPlanningRecommendationHistoryAction,
  ProductionPlanningRecommendationReport
} from './production-planning-recommendation.types'

export const createProductionPlanningRecommendationHistory = (
  reportId: string,
  action: ProductionPlanningRecommendationHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ProductionPlanningRecommendationHistory => ({
  id: `${reportId}_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendProductionPlanningRecommendationHistory = (
  report: ProductionPlanningRecommendationReport,
  action: ProductionPlanningRecommendationHistoryAction,
  actorName: string,
  description: string
): ProductionPlanningRecommendationReport => {
  const revisionNo = report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createProductionPlanningRecommendationHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

export const ProductionPlanningRecommendationHistoryService = {
  create: createProductionPlanningRecommendationHistory,
  append: appendProductionPlanningRecommendationHistory
}
