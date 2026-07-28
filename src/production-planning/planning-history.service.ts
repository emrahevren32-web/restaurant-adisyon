import type {
  ProductionPlan,
  ProductionPlanningHistory,
  ProductionPlanningHistoryAction
} from './production-planning.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createPlanningHistory = (
  planId: string,
  action: ProductionPlanningHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ProductionPlanningHistory => ({
  id: createId('planning_history'),
  planId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendPlanningHistory = <TPlan extends ProductionPlan>(
  plan: TPlan,
  action: ProductionPlanningHistoryAction,
  actorName: string,
  description: string
): TPlan => {
  const revisionNo = action === 'REVISED' ? plan.revisionNo + 1 : plan.revisionNo

  return {
    ...plan,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...plan.history,
      createPlanningHistory(plan.id, action, actorName, description, revisionNo)
    ]
  }
}

export const PlanningHistoryService = {
  create: createPlanningHistory,
  append: appendPlanningHistory
}
