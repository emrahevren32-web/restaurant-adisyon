import type {
  WasteHistory,
  WasteHistoryAction,
  WasteRecord
} from './waste.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createWasteHistory = (
  wasteRecordId: string,
  action: WasteHistoryAction,
  actorName: string,
  description: string,
  createdAt = new Date().toISOString()
): WasteHistory => ({
  id: createId('waste_history'),
  wasteRecordId,
  action,
  actorName: actorName.trim() || 'System',
  description: description.trim(),
  createdAt
})

export const appendWasteHistory = (
  record: WasteRecord,
  action: WasteHistoryAction,
  actorName: string,
  description: string
): WasteRecord => ({
  ...record,
  history: [
    ...record.history,
    createWasteHistory(record.id, action, actorName, description)
  ],
  updatedAt: new Date().toISOString()
})

export const WasteHistoryService = {
  create: createWasteHistory,
  append: appendWasteHistory
}
