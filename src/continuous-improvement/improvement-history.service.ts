import type {
  ImprovementHistory,
  ImprovementHistoryAction,
  ImprovementReport
} from './continuous-improvement.types'

const createId = (
  reportId: string,
  action: ImprovementHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createImprovementHistory = (
  reportId: string,
  action: ImprovementHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ImprovementHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendImprovementHistory = (
  report: ImprovementReport,
  action: ImprovementHistoryAction,
  actorName: string,
  description: string
): ImprovementReport => {
  const revisionNo = action === 'REVISED'
    ? report.revisionNo + 1
    : report.revisionNo

  return {
    ...report,
    revisionNo,
    history: [
      ...report.history,
      createImprovementHistory(report.id, action, actorName, description, revisionNo)
    ],
    updatedAt: new Date().toISOString()
  }
}

export const ImprovementHistoryService = {
  create: createImprovementHistory,
  append: appendImprovementHistory
}
