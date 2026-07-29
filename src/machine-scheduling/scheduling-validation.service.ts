import {
  MACHINE_SCHEDULE_STATUSES
} from './machine-scheduling.constants'
import type {
  MachineSchedule,
  MachineScheduleCreateInput,
  SchedulingValidationResult
} from './machine-scheduling.types'

const isMissing = (value: unknown) => String(value || '').trim().length === 0

export const validateMachineScheduleCreateInput = (
  input: MachineScheduleCreateInput
): SchedulingValidationResult => {
  const errors: string[] = []

  if(isMissing(input.scheduleDate)) errors.push('Cizelge tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic tarihi zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis tarihi zorunlu.')
  if(isMissing(input.machineId)) errors.push('Makine zorunlu.')
  if(isMissing(input.productionLineId)) errors.push('Hat zorunlu.')
  if(isMissing(input.workCenterId)) errors.push('Work Center zorunlu.')
  if(isMissing(input.shift)) errors.push('Vardiya zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')
  if(input.startDate && input.endDate && input.startDate > input.endDate) errors.push('Bitis tarihi baslangictan once olamaz.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateMachineSchedule = (
  schedule: MachineSchedule
): SchedulingValidationResult => {
  const errors: string[] = []

  if(isMissing(schedule.scheduleNo)) errors.push('Cizelge no zorunlu.')
  if(!MACHINE_SCHEDULE_STATUSES.includes(schedule.status)) errors.push('Gecersiz cizelge durumu.')

  schedule.items.forEach((item, index) => {
    const rowNo = index + 1
    if(isMissing(item.machineId)) errors.push(`${rowNo}. satirda makine zorunlu.`)
    if(isMissing(item.productionLineId)) errors.push(`${rowNo}. satirda hat zorunlu.`)
    if(isMissing(item.workCenterId)) errors.push(`${rowNo}. satirda Work Center zorunlu.`)
    if(item.status !== 'CANCELLED' && item.conflict) errors.push(`${rowNo}. satirda zaman cakismasi var.`)
  })

  schedule.queues.forEach(queue => {
    const items = schedule.items
      .filter(item => item.machineId === queue.machineId && item.status !== 'CANCELLED')
      .sort((first, second) => first.startAt.localeCompare(second.startAt))

    items.forEach((item, index) => {
      const previous = items[index - 1]
      if(previous && previous.endAt > item.startAt){
        errors.push(`${queue.machineCode} uzerinde ${previous.productName} ile ${item.productName} cakisiyor.`)
      }
    })
  })

  schedule.timelines.forEach(timeline => {
    if(timeline.availableMinutes <= 0 && timeline.segments.length > 0){
      errors.push(`${timeline.machineCode} pasif veya kullanilamaz makineye gorev atanamaz.`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const SchedulingValidationService = {
  validateCreateInput: validateMachineScheduleCreateInput,
  validate: validateMachineSchedule
}
