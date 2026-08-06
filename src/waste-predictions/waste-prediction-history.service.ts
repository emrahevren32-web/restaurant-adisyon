import type {
  WastePredictionHistory,
  WastePredictionHistoryAction,
  WastePredictionReport
} from './waste-prediction.types'

export const createWastePredictionHistory = (
  reportId: string,
  action: WastePredictionHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): WastePredictionHistory => ({
  id: `${reportId}_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendWastePredictionHistory = (
  report: WastePredictionReport,
  action: WastePredictionHistoryAction,
  actorName: string,
  description: string
): WastePredictionReport => {
  const revisionNo = report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createWastePredictionHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

export const WastePredictionHistoryService = {
  create: createWastePredictionHistory,
  append: appendWastePredictionHistory
}
