import type {
  Label,
  LabelHistory,
  LabelHistoryAction
} from './label.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createLabelHistory = (
  labelId: string,
  action: LabelHistoryAction,
  actorName: string,
  description: string,
  quantity = 1,
  createdAt = new Date().toISOString()
): LabelHistory => ({
  id: createId('label_history'),
  labelId,
  action,
  actorName: actorName.trim() || 'System',
  quantity,
  description: description.trim(),
  createdAt
})

export const appendLabelHistory = (
  label: Label,
  action: LabelHistoryAction,
  actorName: string,
  description: string,
  quantity = 1
): Label => ({
  ...label,
  history: [
    ...label.history,
    createLabelHistory(label.id, action, actorName, description, quantity)
  ],
  updatedAt: new Date().toISOString()
})

export const LabelHistoryService = {
  create: createLabelHistory,
  append: appendLabelHistory
}
