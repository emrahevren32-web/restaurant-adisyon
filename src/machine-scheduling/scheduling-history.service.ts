import type {
  MachineSchedule,
  SchedulingHistory,
  SchedulingHistoryAction
} from './machine-scheduling.types'

const createId = (
  scheduleId: string,
  action: SchedulingHistoryAction
) => `${scheduleId}_history_${action.toLocaleLowerCase('tr-TR')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

export const createSchedulingHistory = (
  scheduleId: string,
  action: SchedulingHistoryAction,
  actorName: string,
  description: string,
  revisionNo = 1
): SchedulingHistory => ({
  id: createId(scheduleId, action),
  scheduleId,
  action,
  actorName,
  description,
  revisionNo,
  createdAt: new Date().toISOString()
})

export const appendSchedulingHistory = (
  schedule: MachineSchedule,
  action: SchedulingHistoryAction,
  actorName: string,
  description: string
): MachineSchedule => {
  const revisionNo = action === 'REVISED'
    ? schedule.revisionNo + 1
    : schedule.revisionNo

  return {
    ...schedule,
    revisionNo,
    history: [
      ...schedule.history,
      createSchedulingHistory(schedule.id, action, actorName, description, revisionNo)
    ],
    updatedAt: new Date().toISOString()
  }
}

export const SchedulingHistoryService = {
  create: createSchedulingHistory,
  append: appendSchedulingHistory
}
