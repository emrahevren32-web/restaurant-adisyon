import type {
  QualityForm,
  QualityHistory,
  QualityHistoryAction
} from './quality-form.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createQualityHistory = (
  formId: string,
  action: QualityHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): QualityHistory => ({
  id: createId(`quality_form_history_${action.toLocaleLowerCase('tr-TR')}`),
  formId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendQualityHistory = (
  form: QualityForm,
  action: QualityHistoryAction,
  actorName: string,
  description: string
): QualityForm => ({
  ...form,
  revisionNo: action === 'REVISED' ? form.revisionNo + 1 : form.revisionNo,
  history: [
    ...form.history,
    createQualityHistory(
      form.id,
      action,
      actorName,
      description,
      action === 'REVISED' ? form.revisionNo + 1 : form.revisionNo
    )
  ],
  updatedAt: new Date().toISOString()
})

export const QualityFormHistoryService = {
  create: createQualityHistory,
  append: appendQualityHistory
}
