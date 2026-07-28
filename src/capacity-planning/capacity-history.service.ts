import type {
  CapacityHistory,
  CapacityHistoryAction,
  CapacityPlan
} from './capacity-planning.types'

const createId = (
  planId: string,
  action: CapacityHistoryAction
) => `${planId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createCapacityHistory = (
  planId: string,
  action: CapacityHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): CapacityHistory => ({
  id: createId(planId, action),
  planId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendCapacityHistory = (
  plan: CapacityPlan,
  action: CapacityHistoryAction,
  actorName: string,
  description: string
): CapacityPlan => {
  const revisionNo = action === 'REVISED'
    ? plan.revisionNo + 1
    : plan.revisionNo

  return {
    ...plan,
    revisionNo,
    history: [
      ...plan.history,
      createCapacityHistory(plan.id, action, actorName, description, revisionNo)
    ],
    updatedAt: new Date().toISOString()
  }
}

export const CapacityHistoryService = {
  create: createCapacityHistory,
  append: appendCapacityHistory
}
