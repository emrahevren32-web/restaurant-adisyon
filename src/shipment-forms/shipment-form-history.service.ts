import type {
  ShipmentForm,
  ShipmentHistory,
  ShipmentHistoryAction
} from './shipment-form.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createShipmentHistory = (
  formId: string,
  action: ShipmentHistoryAction,
  actorName: string,
  description: string
): ShipmentHistory => ({
  id: createId(`shipment_form_history_${action.toLocaleLowerCase('tr-TR')}`),
  formId,
  action,
  actorName,
  description,
  createdAt: new Date().toISOString()
})

export const appendShipmentHistory = (
  form: ShipmentForm,
  action: ShipmentHistoryAction,
  actorName: string,
  description: string
): ShipmentForm => ({
  ...form,
  history: [
    ...form.history,
    createShipmentHistory(form.id, action, actorName, description)
  ],
  updatedAt: new Date().toISOString()
})

export const ShipmentFormHistoryService = {
  create: createShipmentHistory,
  append: appendShipmentHistory
}
