import type {
  RecommendationHistory,
  RecommendationHistoryAction,
  RecommendationReport
} from './recommendation-engine.types'

const createId = (
  reportId: string,
  action: RecommendationHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createRecommendationHistory = (
  reportId: string,
  action: RecommendationHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): RecommendationHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendRecommendationHistory = (
  report: RecommendationReport,
  action: RecommendationHistoryAction,
  actorName: string,
  description: string
): RecommendationReport => {
  const outputAction = action === 'PRINTED' || action === 'PDF' || action === 'EXCEL'
  const revisionNo = outputAction ? report.revisionNo : report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createRecommendationHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

export const RecommendationHistoryService = {
  create: createRecommendationHistory,
  append: appendRecommendationHistory
}
