import type {
  WorkforceHistory,
  WorkforceHistoryAction,
  WorkforcePlan
} from './workforce-planning.types'

const createId = (
  planId: string,
  action: WorkforceHistoryAction
) => `${planId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createWorkforceHistory = (
  planId: string,
  action: WorkforceHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): WorkforceHistory => ({
  id: createId(planId, action),
  planId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendWorkforceHistory = (
  plan: WorkforcePlan,
  action: WorkforceHistoryAction,
  actorName: string,
  description: string
): WorkforcePlan => {
  const revisionNo = action === 'REVISED'
    ? plan.revisionNo + 1
    : plan.revisionNo

  return {
    ...plan,
    revisionNo,
    history: [
      ...plan.history,
      createWorkforceHistory(plan.id, action, actorName, description, revisionNo)
    ],
    updatedAt: new Date().toISOString()
  }
}

export const WorkforceHistoryService = {
  create: createWorkforceHistory,
  append: appendWorkforceHistory
}
