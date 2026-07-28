import {
  CHECKLIST_ITEM_STATUS_LABELS,
  ChecklistTemplateService
} from './checklist-template.service'
import type {
  Checklist,
  ChecklistCreateInput,
  ChecklistValidationResult
} from './operation-checklist.types'

const isMissing = (value: string) => !String(value || '').trim()

export const validateChecklistCreateInput = (
  input: ChecklistCreateInput
): ChecklistValidationResult => {
  const errors: string[] = []

  if(isMissing(input.templateId)) errors.push('Sablon zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu kisi zorunlu.')
  if(isMissing(input.branchId)) errors.push('Sube zorunlu.')
  if(isMissing(input.department)) errors.push('Departman zorunlu.')
  if(isMissing(input.shift)) errors.push('Vardiya zorunlu.')
  if(input.templateId && !ChecklistTemplateService.list().some(template => template.id === input.templateId)){
    errors.push('Gecersiz checklist sablonu.')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateChecklist = (
  checklist: Checklist
): ChecklistValidationResult => {
  const errors: string[] = []

  if(isMissing(checklist.templateId)) errors.push('Sablon zorunlu.')
  if(isMissing(checklist.responsiblePerson)) errors.push('Sorumlu kisi zorunlu.')
  if(isMissing(checklist.branchId)) errors.push('Sube zorunlu.')
  if(isMissing(checklist.department)) errors.push('Departman zorunlu.')
  if(isMissing(checklist.shift)) errors.push('Vardiya zorunlu.')

  if(checklist.status === 'COMPLETED'){
    const incompleteRequiredItems = checklist.items.filter(item => (
      item.required && item.status === 'NOT_APPLICABLE'
    ))
    if(incompleteRequiredItems.length > 0){
      errors.push(`Eksik checklist tamamlanamaz: ${incompleteRequiredItems.map(item => item.title).join(', ')}.`)
    }

    const missingCorrectiveActions = checklist.items.filter(item => (
      item.status === 'FAIL' && !item.correctiveAction.trim()
    ))
    if(missingCorrectiveActions.length > 0){
      errors.push(`FAIL maddeleri icin duzeltici faaliyet zorunlu: ${missingCorrectiveActions.map(item => item.title).join(', ')}.`)
    }
  }

  const invalidStatuses = checklist.items.filter(item => !CHECKLIST_ITEM_STATUS_LABELS[item.status])
  if(invalidStatuses.length > 0) errors.push('Gecersiz checklist madde sonucu var.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const ChecklistValidationService = {
  validateCreateInput: validateChecklistCreateInput,
  validate: validateChecklist
}
