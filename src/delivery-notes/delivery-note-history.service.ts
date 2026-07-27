import type {
  DeliveryNote,
  DeliveryNoteHistory,
  DeliveryNoteHistoryAction
} from './delivery-note.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDeliveryNoteHistory = (
  deliveryNoteId: string,
  action: DeliveryNoteHistoryAction,
  actorName: string,
  description: string,
  createdAt = new Date().toISOString()
): DeliveryNoteHistory => ({
  id: createId('delivery_note_history'),
  deliveryNoteId,
  action,
  actorName: actorName.trim() || 'System',
  description: description.trim(),
  createdAt
})

export const appendDeliveryNoteHistory = (
  record: DeliveryNote,
  action: DeliveryNoteHistoryAction,
  actorName: string,
  description: string
): DeliveryNote => ({
  ...record,
  history: [
    ...record.history,
    createDeliveryNoteHistory(record.id, action, actorName, description)
  ],
  updatedAt: new Date().toISOString()
})

export const DeliveryNoteHistoryService = {
  create: createDeliveryNoteHistory,
  append: appendDeliveryNoteHistory
}
