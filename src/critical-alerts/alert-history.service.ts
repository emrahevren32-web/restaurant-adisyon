import type {
  AlertHistory,
  AlertHistoryAction,
  CriticalAlert
} from './critical-alert.types'

const createId = (
  alertId: string,
  action: AlertHistoryAction
) => `${alertId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createAlertHistory = (
  alertId: string,
  action: AlertHistoryAction,
  actorName: string,
  description: string
): AlertHistory => ({
  id: createId(alertId, action),
  alertId,
  action,
  actorName,
  description,
  createdAt: new Date().toISOString()
})

export const appendAlertHistory = (
  alert: CriticalAlert,
  action: AlertHistoryAction,
  actorName: string,
  description: string
): CriticalAlert => ({
  ...alert,
  history: [
    ...alert.history,
    createAlertHistory(alert.id, action, actorName, description)
  ],
  updatedAt: new Date().toISOString()
})

export const AlertHistoryService = {
  create: createAlertHistory,
  append: appendAlertHistory
}
