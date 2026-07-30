import type {
  ForecastHistory,
  ForecastHistoryAction,
  ForecastReport
} from './forecasting.types'

const createId = (
  reportId: string,
  action: ForecastHistoryAction
) => `${reportId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createForecastHistory = (
  reportId: string,
  action: ForecastHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ForecastHistory => ({
  id: createId(reportId, action),
  reportId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendForecastHistory = (
  report: ForecastReport,
  action: ForecastHistoryAction,
  actorName: string,
  description: string
): ForecastReport => ({
  ...report,
  revisionNo: action === 'PRINTED' || action === 'PDF' || action === 'EXCEL'
    ? report.revisionNo
    : report.revisionNo + 1,
  updatedAt: new Date().toISOString(),
  history: [
    ...report.history,
    createForecastHistory(
      report.id,
      action,
      actorName,
      description,
      action === 'PRINTED' || action === 'PDF' || action === 'EXCEL'
        ? report.revisionNo
        : report.revisionNo + 1
    )
  ]
})

export const ForecastHistoryService = {
  create: createForecastHistory,
  append: appendForecastHistory
}
