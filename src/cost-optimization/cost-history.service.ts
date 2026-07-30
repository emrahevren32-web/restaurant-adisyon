import type {
  CostHistory,
  CostHistoryAction,
  CostOptimizationReport
} from './cost-optimization.types'

const createId = (
  reportId: string,
  action: CostHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createCostHistory = (
  reportId: string,
  action: CostHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): CostHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendCostHistory = (
  report: CostOptimizationReport,
  action: CostHistoryAction,
  actorName: string,
  description: string
): CostOptimizationReport => {
  const outputAction = action === 'PRINTED' || action === 'PDF' || action === 'EXCEL'
  const revisionNo = outputAction ? report.revisionNo : report.revisionNo + 1

  return {
    ...report,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...report.history,
      createCostHistory(report.id, action, actorName, description, revisionNo)
    ]
  }
}

export const CostHistoryService = {
  create: createCostHistory,
  append: appendCostHistory
}
