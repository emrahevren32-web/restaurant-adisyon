import type {
  AIAnalysisReport,
  AIHistory,
  AIHistoryAction
} from './ai-analysis.types'

const createId = (
  reportId: string,
  action: AIHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createAIHistory = (
  reportId: string,
  action: AIHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): AIHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendAIHistory = (
  report: AIAnalysisReport,
  action: AIHistoryAction,
  actorName: string,
  description: string
): AIAnalysisReport => {
  const outputAction = action === 'PRINTED' || action === 'PDF' || action === 'EXCEL'
  const revisionNo = outputAction ? report.revisionNo : report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createAIHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

export const AIHistoryService = {
  create: createAIHistory,
  append: appendAIHistory
}
