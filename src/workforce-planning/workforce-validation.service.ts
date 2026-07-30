import {
  WORKFORCE_PLAN_STATUSES
} from './workforce-planning.constants'
import type {
  WorkforcePlan,
  WorkforcePlanCreateInput,
  WorkforceValidationResult
} from './workforce-planning.types'

const isMissing = (value: unknown) => String(value || '').trim().length === 0

export const validateWorkforcePlanCreateInput = (
  input: WorkforcePlanCreateInput
): WorkforceValidationResult => {
  const errors: string[] = []

  if(isMissing(input.planDate)) errors.push('Plan tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic tarihi zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis tarihi zorunlu.')
  if(isMissing(input.employeeId)) errors.push('Personel zorunlu.')
  if(isMissing(input.department)) errors.push('Departman zorunlu.')
  if(isMissing(input.shiftName)) errors.push('Vardiya zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')
  if(input.startDate && input.endDate && input.startDate > input.endDate) errors.push('Bitis tarihi baslangictan once olamaz.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateWorkforcePlan = (
  plan: WorkforcePlan
): WorkforceValidationResult => {
  const errors: string[] = []

  if(isMissing(plan.planNo)) errors.push('Plan no zorunlu.')
  if(!WORKFORCE_PLAN_STATUSES.includes(plan.status)) errors.push('Gecersiz plan durumu.')

  plan.items.forEach((item, index) => {
    const rowNo = index + 1
    if(isMissing(item.employeeId)) errors.push(`${rowNo}. satirda personel zorunlu.`)
    if(isMissing(item.department)) errors.push(`${rowNo}. satirda departman zorunlu.`)
    if(isMissing(item.shiftName)) errors.push(`${rowNo}. satirda vardiya zorunlu.`)
    if(!item.employeeActive && item.employeeId !== 'missing_employee') errors.push(`${rowNo}. satirda pasif personel atanamaz.`)
    if(item.status !== 'CANCELLED' && item.conflict) errors.push(`${rowNo}. satirda vardiya veya gorev cakismasi var.`)
  })

  plan.employeeAssignments.forEach(assignment => {
    if(!assignment.isActive && assignment.assignmentCount > 0){
      errors.push(`${assignment.employeeName} pasif personel olarak atanamaz.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const WorkforceValidationService = {
  validateCreateInput: validateWorkforcePlanCreateInput,
  validate: validateWorkforcePlan
}
