import type {
  BottleneckHistory,
  BottleneckHistoryAction,
  BottleneckReport
} from './bottleneck-analysis.types'

const createId = (
  reportId: string,
  action: BottleneckHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createBottleneckHistory = (
  reportId: string,
  action: BottleneckHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): BottleneckHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendBottleneckHistory = (
  report: BottleneckReport,
  action: BottleneckHistoryAction,
  actorName: string,
  description: string
): BottleneckReport => {
  const revisionNo = action === 'REVISED'
    ? report.revisionNo + 1
    : report.revisionNo

  return {
    ...report,
    revisionNo,
    history: [
      ...report.history,
      createBottleneckHistory(report.id, action, actorName, description, revisionNo)
    ],
    updatedAt: new Date().toISOString()
  }
}

export const BottleneckHistoryService = {
  create: createBottleneckHistory,
  append: appendBottleneckHistory
}
