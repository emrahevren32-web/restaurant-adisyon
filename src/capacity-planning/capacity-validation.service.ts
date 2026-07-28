import {
  CAPACITY_PLAN_STATUSES
} from './capacity-planning.constants'
import type {
  CapacityPlan,
  CapacityPlanCreateInput,
  CapacityValidationResult
} from './capacity-planning.types'

const isMissing = (value: unknown) => String(value || '').trim().length === 0

export const validateCapacityPlanCreateInput = (
  input: CapacityPlanCreateInput
): CapacityValidationResult => {
  const errors: string[] = []

  if(isMissing(input.planDate)) errors.push('Plan tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic tarihi zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis tarihi zorunlu.')
  if(isMissing(input.productionLineId)) errors.push('Uretim hatti zorunlu.')
  if(isMissing(input.shift)) errors.push('Vardiya zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')
  if(input.startDate && input.endDate && input.startDate > input.endDate) errors.push('Bitis tarihi baslangictan once olamaz.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateCapacityPlan = (
  plan: CapacityPlan
): CapacityValidationResult => {
  const errors: string[] = []

  if(isMissing(plan.capacityPlanNo)) errors.push('Plan no zorunlu.')
  if(!CAPACITY_PLAN_STATUSES.includes(plan.status)) errors.push('Gecersiz kapasite plan durumu.')
  if(isMissing(plan.productionLineId)) errors.push('Uretim hatti zorunlu.')

  plan.items.forEach((item, index) => {
    const rowNo = index + 1
    if(isMissing(item.productionLineId)) errors.push(`${rowNo}. satirda uretim hatti zorunlu.`)
    if(isMissing(item.machineId)) errors.push(`${rowNo}. satirda makine zorunlu.`)
    if(item.availableMinutes < 0) errors.push(`${rowNo}. satirda negatif kapasite olamaz.`)
    if(item.totalLoadMinutes < 0) errors.push(`${rowNo}. satirda negatif yuk olamaz.`)
  })

  plan.machineCapacities.forEach(machine => {
    if(!machine.active && machine.totalLoadMinutes > 0){
      errors.push(`${machine.machineCode} pasif oldugu icin kullanilamaz.`)
    }
    if(machine.availableMinutes < 0 || machine.workingMinutes < 0){
      errors.push(`${machine.machineCode} icin negatif kapasite olamaz.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const CapacityValidationService = {
  validateCreateInput: validateCapacityPlanCreateInput,
  validate: validateCapacityPlan
}
