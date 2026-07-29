import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type { CapacityPlan, CapacityPlanItem, MachineCapacity } from '../capacity-planning/capacity-planning.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  SCHEDULING_SHIFT_START_TIMES
} from './machine-scheduling.constants'
import type {
  MachineQueue,
  MachineScheduleItem,
  MachineTimeline,
  MachineTimelineSegment
} from './machine-scheduling.types'

type SchedulingCalculationInput = {
  scheduleId: string
  scheduleNo: string
  sourceData: KpiSourceData
  startDate: string
  endDate: string
  machineId: string
  productionLineId: string
  workCenterId: string
  shift: string
}

export type SchedulingCalculationResult = {
  items: MachineScheduleItem[]
  queues: MachineQueue[]
  timelines: MachineTimeline[]
  recommendations: string[]
  sourceCapacityPlanIds: string[]
  sourceProductionPlanIds: string[]
}

const MINUTE_MS = 60000

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const isPlanInRange = (
  plan: CapacityPlan,
  startDate: string,
  endDate: string
) => plan.startDate <= endDate && plan.endDate >= startDate

const getShiftStartTime = (shift: string) => {
  const shiftKey = normalizeSearchText(shift)
  if(shiftKey === 'aksam' || shiftKey === 'aksam vardiyasi') return SCHEDULING_SHIFT_START_TIMES.Aksam
  if(shiftKey === 'gece') return SCHEDULING_SHIFT_START_TIMES.Gece
  if(shiftKey === 'haftalik') return SCHEDULING_SHIFT_START_TIMES.Haftalik
  if(shiftKey === 'aylik') return SCHEDULING_SHIFT_START_TIMES.Aylik
  if(shiftKey === 'acil') return SCHEDULING_SHIFT_START_TIMES.Acil
  if(shiftKey === 'tam gun') return SCHEDULING_SHIFT_START_TIMES['Tam Gun']
  return SCHEDULING_SHIFT_START_TIMES.Sabah
}

const createDateTime = (
  dateKey: string,
  shift: string
) => `${dateKey || getDateKey(new Date().toISOString())}T${getShiftStartTime(shift)}:00.000`

const addMinutes = (
  value: string,
  minutes: number
) => new Date(new Date(value).getTime() + minutes * MINUTE_MS).toISOString()

const diffMinutes = (
  startAt: string,
  endAt: string
) => roundKpi(Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / MINUTE_MS))

const getMachineAvailableStart = (
  machine: MachineCapacity,
  input: SchedulingCalculationInput
) => createDateTime(input.startDate, input.shift || machine.shift)

const getMachineAvailableEnd = (
  machine: MachineCapacity,
  input: SchedulingCalculationInput
) => addMinutes(getMachineAvailableStart(machine, input), machine.availableMinutes)

const matchesCapacityPlan = (
  plan: CapacityPlan,
  input: SchedulingCalculationInput
) => {
  const shiftKey = normalizeSearchText(input.shift)
  const matchesShift = input.shift === ALL_FILTER
    || shiftKey === 'haftalik'
    || shiftKey === 'aylik'
    || normalizeSearchText(plan.shift) === shiftKey
  return plan.status !== 'CANCELLED'
    && isPlanInRange(plan, input.startDate, input.endDate)
    && matchesShift
}

const matchesItemScope = (
  item: CapacityPlanItem,
  input: SchedulingCalculationInput
) => (
  (input.machineId === ALL_FILTER || item.machineId === input.machineId)
  && (input.productionLineId === ALL_FILTER || item.productionLineId === input.productionLineId)
  && (input.workCenterId === ALL_FILTER || item.workCenterId === input.workCenterId)
)

const matchesMachineScope = (
  machine: MachineCapacity,
  input: SchedulingCalculationInput
) => (
  (input.machineId === ALL_FILTER || machine.machineId === input.machineId)
  && (input.productionLineId === ALL_FILTER || machine.productionLineId === input.productionLineId)
  && (input.workCenterId === ALL_FILTER || machine.workCenterId === input.workCenterId)
)

const getMachineForItem = (
  item: CapacityPlanItem,
  machines: MachineCapacity[]
) => machines.find(machine => machine.machineId === item.machineId)
  || machines.find(machine => machine.productionLineId === item.productionLineId)
  || null

const dedupeMachines = (
  machines: MachineCapacity[]
) => Array.from(new Map(machines.map(machine => [machine.machineId, machine])).values())

const getSourceRows = (
  input: SchedulingCalculationInput
) => {
  const capacityPlans = CapacityPlanningService.list(input.sourceData).filter(plan => matchesCapacityPlan(plan, input))
  const machines = capacityPlans.flatMap(plan => plan.machineCapacities.map(machine => ({ ...machine, sourceCapacityPlanId: plan.id })))
    .filter(machine => matchesMachineScope(machine, input))
  const machineIds = new Set(machines.map(machine => machine.machineId))
  const rows = capacityPlans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(row => matchesItemScope(row.item, input))
    .filter(row => machineIds.size === 0 || machineIds.has(row.item.machineId))
    .sort((first, second) => (
      first.item.machineCode.localeCompare(second.item.machineCode, 'tr-TR')
      || second.item.totalLoadMinutes - first.item.totalLoadMinutes
      || first.item.productName.localeCompare(second.item.productName, 'tr-TR')
    ))

  return {
    capacityPlans,
    machines,
    rows
  }
}

const createScheduleItems = (
  input: SchedulingCalculationInput
) => {
  const { capacityPlans, machines, rows } = getSourceRows(input)
  const cursorByMachine = new Map<string, string>()
  const sequenceByMachine = new Map<string, number>()
  const availableEndByMachine = new Map<string, string>()

  machines.forEach(machine => {
    cursorByMachine.set(machine.machineId, getMachineAvailableStart(machine, input))
    availableEndByMachine.set(machine.machineId, getMachineAvailableEnd(machine, input))
  })

  const items: MachineScheduleItem[] = rows.map(({ plan, item }, index) => {
    const machine = getMachineForItem(item, machines)
    const machineId = machine?.machineId || item.machineId
    const machineCode = machine?.machineCode || item.machineCode
    const machineName = machine?.machineName || item.machineName
    const availableStartAt = machine ? getMachineAvailableStart(machine, input) : createDateTime(input.startDate, input.shift)
    const availableEndAt = machine ? getMachineAvailableEnd(machine, input) : availableStartAt
    const cursor = cursorByMachine.get(machineId) || availableStartAt
    const estimatedMinutes = roundKpi(item.plannedProductionMinutes + item.recipePreparationMinutes + item.warehousePreparationMinutes)
    const setupMinutes = roundKpi(item.setupMinutes)
    const cleaningMinutes = roundKpi(item.cleaningMinutes)
    const totalWorkingMinutes = roundKpi(estimatedMinutes + setupMinutes + cleaningMinutes)
    const startAt = cursor
    const endAt = addMinutes(startAt, totalWorkingMinutes)
    const waitingMinutes = diffMinutes(availableStartAt, startAt)
    const sequenceNo = (sequenceByMachine.get(machineId) || 0) + 1
    sequenceByMachine.set(machineId, sequenceNo)
    cursorByMachine.set(machineId, endAt)
    const machineUnavailable = !machine || !machine.active || machine.maintenanceClosed || machine.availableMinutes <= 0
    const outsideWindow = endAt > availableEndAt
    const conflict = machineUnavailable || outsideWindow
    const conflictReason = machineUnavailable
      ? 'Makine pasif, bakimda veya kullanilamaz.'
      : outsideWindow
        ? 'Gorev kullanilabilir makine zamaninin disina tasiyor.'
        : ''
    const recommendations: string[] = []
    if(waitingMinutes > 120) recommendations.push(`${machineCode} uzerinde bekleme suresi ${waitingMinutes} dk.`)
    if(setupMinutes + cleaningMinutes > estimatedMinutes * 0.25) recommendations.push('Setup ve temizlik suresi toplam uretim suresini belirgin artiriyor.')
    if(conflict) recommendations.push(conflictReason)

    return {
      id: `${input.scheduleId}_item_${index + 1}`,
      scheduleId: input.scheduleId,
      scheduleNo: input.scheduleNo,
      sourceCapacityPlanId: plan.id,
      sourceCapacityPlanNo: plan.capacityPlanNo,
      sourceItemId: item.id,
      machineId,
      machineCode,
      machineName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      workCenterId: item.workCenterId,
      workCenterName: item.workCenterName,
      productName: item.productName,
      recipeId: item.recipeId,
      recipeName: item.recipeName,
      plannedQuantity: item.plannedQuantity,
      unit: item.unit,
      startAt,
      endAt,
      estimatedMinutes,
      setupMinutes,
      cleaningMinutes,
      waitingMinutes,
      totalWorkingMinutes,
      idleBeforeMinutes: sequenceNo === 1 ? 0 : 0,
      conflict,
      conflictReason,
      status: conflict ? 'CONFLICT' : index === 0 ? 'READY' : 'SCHEDULED',
      sequenceNo,
      recommendations
    }
  })

  return {
    capacityPlans,
    machines,
    items
  }
}

const createQueues = (
  scheduleId: string,
  items: MachineScheduleItem[],
  machines: MachineCapacity[]
): MachineQueue[] => {
  const rows = new Map<string, MachineScheduleItem[]>()
  items.forEach(item => rows.set(item.machineId, [...(rows.get(item.machineId) || []), item]))

  return Array.from(rows.entries()).map(([machineId, machineItems]) => {
    const machine = machines.find(record => record.machineId === machineId)
    const totalWorkingMinutes = sumBy(machineItems, item => item.totalWorkingMinutes)
    const availableMinutes = machine?.availableMinutes || totalWorkingMinutes
    const firstStartAt = [...machineItems].sort((first, second) => first.startAt.localeCompare(second.startAt))[0]?.startAt || ''
    const lastEndAt = [...machineItems].sort((first, second) => second.endAt.localeCompare(first.endAt))[0]?.endAt || ''

    return {
      id: `${scheduleId}_queue_${machineId}`,
      scheduleId,
      machineId,
      machineCode: machine?.machineCode || machineItems[0]?.machineCode || machineId,
      machineName: machine?.machineName || machineItems[0]?.machineName || machineId,
      productionLineId: machine?.productionLineId || machineItems[0]?.productionLineId || '',
      productionLineName: machine?.productionLineName || machineItems[0]?.productionLineName || '',
      workCenterId: machine?.workCenterId || machineItems[0]?.workCenterId || '',
      workCenterName: machine?.workCenterName || machineItems[0]?.workCenterName || '',
      itemCount: machineItems.length,
      pendingItemCount: machineItems.filter(item => item.status === 'QUEUED' || item.status === 'SCHEDULED' || item.status === 'CONFLICT').length,
      totalWaitingMinutes: sumBy(machineItems, item => item.waitingMinutes),
      totalSetupMinutes: sumBy(machineItems, item => item.setupMinutes),
      totalCleaningMinutes: sumBy(machineItems, item => item.cleaningMinutes),
      totalWorkingMinutes,
      idleMinutes: Math.max(0, roundKpi(availableMinutes - totalWorkingMinutes)),
      utilizationPercent: percent(totalWorkingMinutes, availableMinutes),
      conflictCount: machineItems.filter(item => item.conflict).length,
      firstStartAt,
      lastEndAt
    }
  })
}

const createTimelines = (
  input: SchedulingCalculationInput,
  items: MachineScheduleItem[],
  machines: MachineCapacity[]
): MachineTimeline[] => {
  const itemsByMachine = new Map<string, MachineScheduleItem[]>()
  items.forEach(item => itemsByMachine.set(item.machineId, [...(itemsByMachine.get(item.machineId) || []), item]))

  const timelineMachines = machines

  return timelineMachines.map(machine => {
    const machineItems = [...(itemsByMachine.get(machine.machineId) || [])].sort((first, second) => first.startAt.localeCompare(second.startAt))
    const segments: MachineTimelineSegment[] = machineItems.map(item => ({
      id: `${item.id}_segment`,
      itemId: item.id,
      label: item.productName,
      startAt: item.startAt,
      endAt: item.endAt,
      durationMinutes: item.totalWorkingMinutes,
      status: item.status,
      conflict: item.conflict
    }))
    const busyMinutes = sumBy(segments, segment => segment.durationMinutes)

    return {
      id: `${input.scheduleId}_timeline_${machine.machineId}`,
      scheduleId: input.scheduleId,
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      productionLineId: machine.productionLineId,
      productionLineName: machine.productionLineName,
      workCenterId: machine.workCenterId,
      workCenterName: machine.workCenterName,
      availableStartAt: getMachineAvailableStart(machine, input),
      availableEndAt: getMachineAvailableEnd(machine, input),
      availableMinutes: machine.availableMinutes,
      busyMinutes,
      idleMinutes: Math.max(0, roundKpi(machine.availableMinutes - busyMinutes)),
      utilizationPercent: percent(busyMinutes, machine.availableMinutes),
      segments
    }
  })
}

const createRecommendations = (
  queues: MachineQueue[],
  timelines: MachineTimeline[],
  items: MachineScheduleItem[]
) => {
  const recommendations = new Set<string>()
  const conflictItem = items.find(item => item.conflict)
  const highWaitQueue = [...queues].sort((first, second) => second.totalWaitingMinutes - first.totalWaitingMinutes)[0]
  const setupHeavyQueue = [...queues].sort((first, second) => second.totalSetupMinutes - first.totalSetupMinutes)[0]
  const idleTimeline = [...timelines].sort((first, second) => second.idleMinutes - first.idleMinutes)[0]

  if(conflictItem) recommendations.add(`${conflictItem.machineCode} uzerinde zaman cakismasi veya uygunluk problemi var.`)
  if(highWaitQueue && highWaitQueue.totalWaitingMinutes > 120) recommendations.add(`${highWaitQueue.productionLineName} uzerinde bekleme suresi yuksek.`)
  if(setupHeavyQueue && setupHeavyQueue.totalSetupMinutes > setupHeavyQueue.totalWorkingMinutes * 0.2) recommendations.add('Setup sureleri toplam uretim suresini artiriyor.')
  if(idleTimeline && idleTimeline.idleMinutes > idleTimeline.availableMinutes * 0.25) recommendations.add(`${idleTimeline.machineCode} gunun onemli bolumunde bos kaliyor.`)

  return Array.from(recommendations)
}

export const calculateMachineScheduling = (
  input: SchedulingCalculationInput
): SchedulingCalculationResult => {
  const { capacityPlans, machines, items } = createScheduleItems(input)
  const scopedMachines = dedupeMachines(machines.length > 0 ? machines : capacityPlans.flatMap(plan => plan.machineCapacities).filter(machine => matchesMachineScope(machine, input)))
  const queues = createQueues(input.scheduleId, items, scopedMachines)
  const timelines = createTimelines(input, items, scopedMachines)

  return {
    items,
    queues,
    timelines,
    recommendations: createRecommendations(queues, timelines, items),
    sourceCapacityPlanIds: capacityPlans.map(plan => plan.id),
    sourceProductionPlanIds: Array.from(new Set(capacityPlans.flatMap(plan => plan.sourcePlanningPlanIds)))
  }
}

export const SchedulingCalculationService = {
  calculate: calculateMachineScheduling,
  shiftStartTime: getShiftStartTime
}
