import type {
  Checklist,
  ChecklistHistory,
  ChecklistHistoryAction
} from './operation-checklist.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createChecklistHistory = (
  checklistId: string,
  action: ChecklistHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): ChecklistHistory => ({
  id: createId('checklist_history'),
  checklistId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendChecklistHistory = <TChecklist extends Checklist>(
  checklist: TChecklist,
  action: ChecklistHistoryAction,
  actorName: string,
  description: string
): TChecklist => {
  const revisionNo = action === 'REVISED' ? checklist.revisionNo + 1 : checklist.revisionNo

  return {
    ...checklist,
    revisionNo,
    updatedAt: new Date().toISOString(),
    history: [
      ...checklist.history,
      createChecklistHistory(checklist.id, action, actorName, description, revisionNo)
    ]
  }
}

export const ChecklistHistoryService = {
  create: createChecklistHistory,
  append: appendChecklistHistory
}
