import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type {
  CapacityPlan,
  MachineCapacity,
  ProductionCapacity,
  WorkCenterCapacity
} from '../capacity-planning/capacity-planning.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import type { MachineQueue, MachineSchedule, MachineTimeline } from '../machine-scheduling/machine-scheduling.types'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import type { EmployeeAssignment, ShiftAssignment, WorkforcePlan } from '../workforce-planning/workforce-planning.types'
import type {
  BottleneckItem,
  BottleneckReason,
  BottleneckRiskLevel,
  BottleneckType,
  ProductionConstraint
} from './bottleneck-analysis.types'

type BottleneckCalculationInput = {
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
  startDate: string
  endDate: string
  productionLineId: string
  machineId: string
  employeeId: string
  workCenterId: string
  riskLevel: BottleneckRiskLevel | 'all'
  capacityPlans?: CapacityPlan[]
  machineSchedules?: MachineSchedule[]
  workforcePlans?: WorkforcePlan[]
}

export type BottleneckCalculationResult = {
  items: BottleneckItem[]
  constraints: ProductionConstraint[]
  reasons: BottleneckReason[]
  recommendations: string[]
  sourceCapacityPlanIds: string[]
  sourceMachineScheduleIds: string[]
  sourceWorkforcePlanIds: string[]
  sourceProductionPlanIds: string[]
}

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const isInDateRange = (
  startDate: string,
  endDate: string,
  input: BottleneckCalculationInput
) => startDate <= input.endDate && endDate >= input.startDate

const getRiskLevel = (
  score: number
): BottleneckRiskLevel => {
  if(score >= 90) return 'CRITICAL'
  if(score >= 75) return 'HIGH'
  if(score >= 55) return 'MEDIUM'
  return 'LOW'
}

const createScore = ({
  cleaningMinutes = 0,
  conflictCount = 0,
  idleMinutes = 0,
  maintenanceMinutes = 0,
  missingPersonnel = 0,
  overloadMinutes = 0,
  setupMinutes = 0,
  utilizationPercent = 0,
  waitingMinutes = 0,
  workingMinutes = 0
}: {
  utilizationPercent?: number
  waitingMinutes?: number
  setupMinutes?: number
  cleaningMinutes?: number
  workingMinutes?: number
  idleMinutes?: number
  overloadMinutes?: number
  maintenanceMinutes?: number
  missingPersonnel?: number
  conflictCount?: number
}) => {
  const setupPercent = percent(setupMinutes, workingMinutes || setupMinutes)
  const cleaningPercent = percent(cleaningMinutes, workingMinutes || cleaningMinutes)
  const waitingPercent = percent(waitingMinutes, workingMinutes + waitingMinutes)
  const idlePenalty = idleMinutes <= 30 && workingMinutes > 0 ? 8 : 0
  return Math.max(0, Math.min(100, roundKpi(
    utilizationPercent * 0.65
    + setupPercent * 0.35
    + cleaningPercent * 0.25
    + waitingPercent * 0.35
    + Math.min(18, overloadMinutes / 20)
    + Math.min(16, maintenanceMinutes / 20)
    + Math.min(18, missingPersonnel * 8)
    + Math.min(18, conflictCount * 8)
    + idlePenalty
  )))
}

const createReason = (
  itemId: string,
  type: BottleneckType,
  label: string,
  value: number,
  unit: string,
  impactPercent: number,
  description: string
): BottleneckReason => ({
  id: `${itemId}_reason_${type}_${label.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_')}`,
  itemId,
  type,
  label,
  value: roundKpi(value),
  unit,
  impactPercent: roundKpi(impactPercent),
  description
})

const createConstraint = (
  itemId: string,
  type: BottleneckType,
  entityId: string,
  entityName: string,
  constraintType: string,
  riskLevel: BottleneckRiskLevel,
  values: {
    utilizationPercent?: number
    waitingMinutes?: number
    setupMinutes?: number
    cleaningMinutes?: number
    workingMinutes?: number
    idleMinutes?: number
    sourceNo?: string
  }
): ProductionConstraint => ({
  id: `${itemId}_constraint_${constraintType.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_')}`,
  itemId,
  entityType: type,
  entityId,
  entityName,
  constraintType,
  riskLevel,
  utilizationPercent: roundKpi(values.utilizationPercent || 0),
  waitingMinutes: roundKpi(values.waitingMinutes || 0),
  setupMinutes: roundKpi(values.setupMinutes || 0),
  cleaningMinutes: roundKpi(values.cleaningMinutes || 0),
  workingMinutes: roundKpi(values.workingMinutes || 0),
  idleMinutes: roundKpi(values.idleMinutes || 0),
  sourceNo: values.sourceNo || ''
})

const createItem = ({
  bottleneckType,
  cleaningMinutes = 0,
  employeeId = '',
  employeeName = '',
  entityCode = '',
  entityId,
  entityName,
  machineCode = '',
  machineId = '',
  machineName = '',
  maintenanceMinutes = 0,
  missingPersonnel = 0,
  overloadMinutes = 0,
  productionLineId = '',
  productionLineName = '',
  reportId,
  reportNo,
  setupMinutes = 0,
  shiftName = '',
  sourceId,
  sourceNo,
  sourceType,
  utilizationPercent = 0,
  waitingMinutes = 0,
  workCenterId = '',
  workCenterName = '',
  workingMinutes = 0,
  idleMinutes = 0,
  conflictCount = 0
}: {
  reportId: string
  reportNo: string
  bottleneckType: BottleneckType
  entityId: string
  entityCode?: string
  entityName: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  employeeId?: string
  employeeName?: string
  workCenterId?: string
  workCenterName?: string
  shiftName?: string
  utilizationPercent?: number
  waitingMinutes?: number
  setupMinutes?: number
  cleaningMinutes?: number
  workingMinutes?: number
  idleMinutes?: number
  overloadMinutes?: number
  maintenanceMinutes?: number
  missingPersonnel?: number
  conflictCount?: number
  sourceType: BottleneckItem['sourceType']
  sourceId: string
  sourceNo: string
}): BottleneckItem => {
  const itemId = `${reportId}_item_${sourceType}_${bottleneckType}_${entityId}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const riskScore = createScore({
    cleaningMinutes,
    conflictCount,
    idleMinutes,
    maintenanceMinutes,
    missingPersonnel,
    overloadMinutes,
    setupMinutes,
    utilizationPercent,
    waitingMinutes,
    workingMinutes
  })
  const riskLevel = getRiskLevel(riskScore)
  const reasons: BottleneckReason[] = []

  if(utilizationPercent >= 85) reasons.push(createReason(itemId, bottleneckType, 'Doluluk', utilizationPercent, '%', utilizationPercent, 'Kapasite kullanim orani yuksek.'))
  if(waitingMinutes > 0) reasons.push(createReason(itemId, 'MACHINE', 'Bekleme', waitingMinutes, 'dk', percent(waitingMinutes, workingMinutes + waitingMinutes), 'Bekleme suresi uretim akisini yavaslatiyor.'))
  if(setupMinutes > 0) reasons.push(createReason(itemId, 'SETUP', 'Setup', setupMinutes, 'dk', percent(setupMinutes, workingMinutes || setupMinutes), 'Setup suresi toplam calisma surecine etki ediyor.'))
  if(cleaningMinutes > 0) reasons.push(createReason(itemId, 'CLEANING', 'Temizlik', cleaningMinutes, 'dk', percent(cleaningMinutes, workingMinutes || cleaningMinutes), 'Temizlik suresi kapasite penceresini daraltiyor.'))
  if(maintenanceMinutes > 0) reasons.push(createReason(itemId, 'MAINTENANCE', 'Bakim', maintenanceMinutes, 'dk', percent(maintenanceMinutes, workingMinutes + maintenanceMinutes), 'Bakim sinyali kullanilabilir kapasiteyi dusuruyor.'))
  if(missingPersonnel > 0) reasons.push(createReason(itemId, 'PERSONNEL', 'Eksik Personel', missingPersonnel, 'adet', missingPersonnel * 10, 'Personel eksikligi kapasiteyi dusuruyor.'))
  if(overloadMinutes > 0) reasons.push(createReason(itemId, bottleneckType, 'Asiri Yuk', overloadMinutes, 'dk', percent(overloadMinutes, workingMinutes + overloadMinutes), 'Planlanan yuk kullanilabilir kapasiteyi asiyor.'))
  if(conflictCount > 0) reasons.push(createReason(itemId, bottleneckType, 'Cakisma', conflictCount, 'adet', conflictCount * 10, 'Plan veya kaynak cakismasi tespit edildi.'))

  const constraints = [
    createConstraint(itemId, bottleneckType, entityId, entityName, 'Primary Constraint', riskLevel, {
      cleaningMinutes,
      idleMinutes,
      setupMinutes,
      sourceNo,
      utilizationPercent,
      waitingMinutes,
      workingMinutes
    })
  ]
  const recommendation = riskLevel === 'CRITICAL'
    ? `${entityName} kritik darbogaz seviyesinde; manuel kapasite, bakim veya personel senaryosu incelenmeli.`
    : riskLevel === 'HIGH'
      ? `${entityName} yuksek riskli darbogaz; siralama ve kaynak uygunlugu kontrol edilmeli.`
      : `${entityName} izleme listesinde tutulmali.`

  return {
    id: itemId,
    reportId,
    reportNo,
    bottleneckType,
    entityId,
    entityCode,
    entityName,
    productionLineId,
    productionLineName,
    machineId,
    machineCode,
    machineName,
    employeeId,
    employeeName,
    workCenterId,
    workCenterName,
    shiftName,
    utilizationPercent: roundKpi(utilizationPercent),
    waitingMinutes: roundKpi(waitingMinutes),
    setupMinutes: roundKpi(setupMinutes),
    cleaningMinutes: roundKpi(cleaningMinutes),
    workingMinutes: roundKpi(workingMinutes),
    idleMinutes: roundKpi(idleMinutes),
    overloadMinutes: roundKpi(overloadMinutes),
    maintenanceMinutes: roundKpi(maintenanceMinutes),
    missingPersonnel: roundKpi(missingPersonnel),
    riskScore,
    riskLevel,
    critical: riskLevel === 'CRITICAL',
    reasons,
    constraints,
    recommendation,
    sourceType,
    sourceId,
    sourceNo,
    detectedAt: new Date().toISOString()
  }
}

const isClosedLine = (
  value: string
) => {
  const search = normalizeSearchText(value)
  return search.includes('pasif') || search.includes('kapali') || search.includes('closed')
}

const matchesScope = (
  row: {
    productionLineId?: string
    machineId?: string
    employeeId?: string
    workCenterId?: string
  },
  input: BottleneckCalculationInput
) => (
  (input.productionLineId === ALL_FILTER || row.productionLineId === input.productionLineId)
  && (input.machineId === ALL_FILTER || row.machineId === input.machineId)
  && (input.employeeId === ALL_FILTER || row.employeeId === input.employeeId)
  && (input.workCenterId === ALL_FILTER || row.workCenterId === input.workCenterId)
)

const createLineItems = (
  input: BottleneckCalculationInput,
  plans: CapacityPlan[]
) => plans.flatMap(plan => plan.productionCapacities.map(capacity => ({ plan, capacity })))
  .filter(row => matchesScope(row.capacity, input))
  .filter(row => !isClosedLine(row.capacity.lineStatus))
  .filter(row => row.capacity.utilizationPercent >= 85 || row.capacity.overloadMinutes > 0 || row.capacity.bottleneck)
  .map(({ plan, capacity }) => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: 'LINE',
    entityId: capacity.productionLineId,
    entityCode: capacity.productionLineCode,
    entityName: capacity.productionLineName,
    productionLineId: capacity.productionLineId,
    productionLineName: capacity.productionLineName,
    workCenterId: capacity.workCenterId,
    workCenterName: capacity.workCenterName,
    shiftName: capacity.shift,
    utilizationPercent: capacity.utilizationPercent,
    setupMinutes: capacity.setupMinutes,
    cleaningMinutes: capacity.cleaningMinutes,
    workingMinutes: capacity.totalLoadMinutes,
    idleMinutes: capacity.idleMinutes,
    overloadMinutes: capacity.overloadMinutes,
    maintenanceMinutes: capacity.maintenanceMinutes,
    sourceType: 'CapacityPlanning',
    sourceId: plan.id,
    sourceNo: plan.capacityPlanNo
  }))

const createMachineCapacityItems = (
  input: BottleneckCalculationInput,
  plans: CapacityPlan[]
) => plans.flatMap(plan => plan.machineCapacities.map(machine => ({ plan, machine })))
  .filter(row => matchesScope(row.machine, input))
  .filter(row => row.machine.active)
  .filter(row => row.machine.utilizationPercent >= 85 || row.machine.overloadMinutes > 0 || row.machine.bottleneck || row.machine.maintenanceClosed)
  .map(({ plan, machine }) => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: machine.maintenanceClosed ? 'MAINTENANCE' : 'MACHINE',
    entityId: machine.machineId,
    entityCode: machine.machineCode,
    entityName: machine.machineName,
    productionLineId: machine.productionLineId,
    productionLineName: machine.productionLineName,
    machineId: machine.machineId,
    machineCode: machine.machineCode,
    machineName: machine.machineName,
    workCenterId: machine.workCenterId,
    workCenterName: machine.workCenterName,
    shiftName: machine.shift,
    utilizationPercent: machine.utilizationPercent,
    setupMinutes: machine.setupMinutes,
    cleaningMinutes: machine.cleaningMinutes,
    workingMinutes: machine.totalLoadMinutes,
    idleMinutes: machine.idleMinutes,
    overloadMinutes: machine.overloadMinutes,
    maintenanceMinutes: machine.maintenanceMinutes,
    sourceType: 'CapacityPlanning',
    sourceId: plan.id,
    sourceNo: plan.capacityPlanNo
  }))

const createWorkCenterItems = (
  input: BottleneckCalculationInput,
  plans: CapacityPlan[]
) => plans.flatMap(plan => plan.workCenterCapacities.map(workCenter => ({ plan, workCenter })))
  .filter(row => matchesScope(row.workCenter, input))
  .filter(row => row.workCenter.utilizationPercent >= 85 || row.workCenter.overloadMinutes > 0 || row.workCenter.bottleneckCount > 0)
  .map(({ plan, workCenter }) => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: 'WORK_CENTER',
    entityId: workCenter.workCenterId,
    entityName: workCenter.workCenterName,
    workCenterId: workCenter.workCenterId,
    workCenterName: workCenter.workCenterName,
    utilizationPercent: workCenter.utilizationPercent,
    workingMinutes: workCenter.totalLoadMinutes,
    idleMinutes: workCenter.idleMinutes,
    overloadMinutes: workCenter.overloadMinutes,
    conflictCount: workCenter.bottleneckCount,
    sourceType: 'CapacityPlanning',
    sourceId: plan.id,
    sourceNo: plan.capacityPlanNo
  }))

const createMachineQueueItems = (
  input: BottleneckCalculationInput,
  schedules: MachineSchedule[]
) => schedules
  .filter(schedule => schedule.status !== 'CANCELLED' && isInDateRange(schedule.startDate, schedule.endDate, input))
  .flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
  .filter(row => matchesScope(row.queue, input))
  .filter(row => {
    const setupPercent = percent(row.queue.totalSetupMinutes, row.queue.totalWorkingMinutes)
    const cleaningPercent = percent(row.queue.totalCleaningMinutes, row.queue.totalWorkingMinutes)
    return row.queue.utilizationPercent >= 85
      || row.queue.totalWaitingMinutes >= 90
      || setupPercent >= 18
      || cleaningPercent >= 15
      || row.queue.conflictCount > 0
  })
  .map(({ schedule, queue }) => {
    const setupPercent = percent(queue.totalSetupMinutes, queue.totalWorkingMinutes)
    const cleaningPercent = percent(queue.totalCleaningMinutes, queue.totalWorkingMinutes)
    const bottleneckType: BottleneckType = setupPercent >= 18
      ? 'SETUP'
      : cleaningPercent >= 15
        ? 'CLEANING'
        : 'MACHINE'

    return createItem({
      reportId: input.reportId,
      reportNo: input.reportNo,
      bottleneckType,
      entityId: queue.machineId,
      entityCode: queue.machineCode,
      entityName: queue.machineName,
      productionLineId: queue.productionLineId,
      productionLineName: queue.productionLineName,
      machineId: queue.machineId,
      machineCode: queue.machineCode,
      machineName: queue.machineName,
      workCenterId: queue.workCenterId,
      workCenterName: queue.workCenterName,
      utilizationPercent: queue.utilizationPercent,
      waitingMinutes: queue.totalWaitingMinutes,
      setupMinutes: queue.totalSetupMinutes,
      cleaningMinutes: queue.totalCleaningMinutes,
      workingMinutes: queue.totalWorkingMinutes,
      idleMinutes: queue.idleMinutes,
      conflictCount: queue.conflictCount,
      sourceType: 'MachineScheduling',
      sourceId: schedule.id,
      sourceNo: schedule.scheduleNo
    })
  })

const createTimelineIdleItems = (
  input: BottleneckCalculationInput,
  schedules: MachineSchedule[]
) => schedules
  .filter(schedule => schedule.status !== 'CANCELLED' && isInDateRange(schedule.startDate, schedule.endDate, input))
  .flatMap(schedule => schedule.timelines.map(timeline => ({ schedule, timeline })))
  .filter(row => matchesScope(row.timeline, input))
  .filter(row => row.timeline.availableMinutes > 0 && row.timeline.utilizationPercent >= 95)
  .map(({ schedule, timeline }) => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: 'MACHINE',
    entityId: timeline.machineId,
    entityCode: timeline.machineCode,
    entityName: timeline.machineName,
    productionLineId: timeline.productionLineId,
    productionLineName: timeline.productionLineName,
    machineId: timeline.machineId,
    machineCode: timeline.machineCode,
    machineName: timeline.machineName,
    workCenterId: timeline.workCenterId,
    workCenterName: timeline.workCenterName,
    utilizationPercent: timeline.utilizationPercent,
    workingMinutes: timeline.busyMinutes,
    idleMinutes: timeline.idleMinutes,
    sourceType: 'MachineScheduling',
    sourceId: schedule.id,
    sourceNo: schedule.scheduleNo
  }))

const createPersonnelItems = (
  input: BottleneckCalculationInput,
  plans: WorkforcePlan[]
) => plans
  .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  .flatMap(plan => [
    ...plan.shiftAssignments.map(assignment => ({ plan, assignment, kind: 'SHIFT' as const })),
    ...plan.employeeAssignments.map(assignment => ({ plan, assignment, kind: 'EMPLOYEE' as const }))
  ])
  .filter(row => row.kind === 'SHIFT'
    ? matchesScope({ productionLineId: row.plan.productionLineId }, input)
    : matchesScope({ employeeId: (row.assignment as EmployeeAssignment).employeeId }, input)
  )
  .filter(row => {
    if(row.kind === 'SHIFT'){
      const assignment = row.assignment as ShiftAssignment
      return assignment.utilizationPercent >= 90 || assignment.missingEmployeeCount > 0 || assignment.conflictCount > 0
    }
    const assignment = row.assignment as EmployeeAssignment
    return assignment.utilizationPercent >= 95 || assignment.conflictCount > 0
  })
  .map(row => {
    if(row.kind === 'SHIFT'){
      const assignment = row.assignment as ShiftAssignment
      return createItem({
        reportId: input.reportId,
        reportNo: input.reportNo,
        bottleneckType: 'PERSONNEL',
        entityId: assignment.id,
        entityName: `${assignment.shiftName} vardiyasi`,
        productionLineId: row.plan.productionLineId,
        productionLineName: row.plan.productionLineName,
        employeeId: '',
        employeeName: '',
        shiftName: assignment.shiftName,
        utilizationPercent: assignment.utilizationPercent,
        workingMinutes: assignment.totalWorkingMinutes,
        idleMinutes: assignment.idleEmployees * 480,
        missingPersonnel: assignment.missingEmployeeCount,
        conflictCount: assignment.conflictCount,
        sourceType: 'WorkforcePlanning',
        sourceId: row.plan.id,
        sourceNo: row.plan.planNo
      })
    }

    const assignment = row.assignment as EmployeeAssignment
    return createItem({
      reportId: input.reportId,
      reportNo: input.reportNo,
      bottleneckType: 'PERSONNEL',
      entityId: assignment.employeeId,
      entityCode: assignment.employeeCode,
      entityName: assignment.employeeName,
      employeeId: assignment.employeeId,
      employeeName: assignment.employeeName,
      shiftName: assignment.shiftName,
      utilizationPercent: assignment.utilizationPercent,
      workingMinutes: assignment.totalWorkingMinutes,
      idleMinutes: assignment.idleMinutes,
      conflictCount: assignment.conflictCount,
      sourceType: 'WorkforcePlanning',
      sourceId: row.plan.id,
      sourceNo: row.plan.planNo
    })
  })

const createWarehouseItems = (
  input: BottleneckCalculationInput,
  plans: CapacityPlan[]
) => plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
  .filter(row => matchesScope(row.item, input))
  .filter(row => row.item.warehousePreparationMinutes >= 30)
  .map(({ plan, item }) => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: 'WAREHOUSE',
    entityId: item.productionLineId,
    entityName: `${item.productionLineName} depo hazirligi`,
    productionLineId: item.productionLineId,
    productionLineName: item.productionLineName,
    machineId: item.machineId,
    machineCode: item.machineCode,
    machineName: item.machineName,
    workCenterId: item.workCenterId,
    workCenterName: item.workCenterName,
    shiftName: item.shift,
    utilizationPercent: item.utilizationPercent,
    workingMinutes: item.totalLoadMinutes,
    idleMinutes: item.idleMinutes,
    waitingMinutes: item.warehousePreparationMinutes,
    sourceType: 'CapacityPlanning',
    sourceId: plan.id,
    sourceNo: plan.capacityPlanNo
  }))

const createMaterialItems = (
  input: BottleneckCalculationInput
) => input.sourceData.stockItems
  .filter(item => item.currentQty <= item.minQty)
  .slice(0, 6)
  .map(item => createItem({
    reportId: input.reportId,
    reportNo: input.reportNo,
    bottleneckType: 'MATERIAL',
    entityId: item.id,
    entityCode: item.sku || item.id,
    entityName: item.name,
    utilizationPercent: percent(item.minQty - item.currentQty, item.minQty || 1) + 70,
    missingPersonnel: 0,
    workingMinutes: 0,
    idleMinutes: 0,
    overloadMinutes: Math.max(0, item.minQty - item.currentQty),
    sourceType: 'Inventory',
    sourceId: item.id,
    sourceNo: item.sku || item.id
  }))

const dedupeItems = (
  items: BottleneckItem[]
) => Array.from(new Map(items.map(item => [`${item.bottleneckType}_${item.entityId}_${item.sourceType}_${item.sourceId}`, item])).values())

const filterByRisk = (
  items: BottleneckItem[],
  input: BottleneckCalculationInput
) => input.riskLevel === ALL_FILTER
  ? items
  : items.filter(item => item.riskLevel === input.riskLevel)

const createRecommendations = (
  items: BottleneckItem[]
) => {
  const recommendations = new Set<string>()
  const topLine = items.filter(item => item.bottleneckType === 'LINE').sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0]
  const topMachine = items.filter(item => item.bottleneckType === 'MACHINE' || item.bottleneckType === 'MAINTENANCE').sort((first, second) => second.riskScore - first.riskScore)[0]
  const setupItem = items.filter(item => item.setupMinutes > 0).sort((first, second) => second.setupMinutes - first.setupMinutes)[0]
  const personnelItem = items.filter(item => item.bottleneckType === 'PERSONNEL').sort((first, second) => second.missingPersonnel - first.missingPersonnel || second.riskScore - first.riskScore)[0]
  const maintenanceItem = items.find(item => item.bottleneckType === 'MAINTENANCE')

  if(topLine) recommendations.add(`${topLine.productionLineName || topLine.entityName} kapasitesi ${topLine.utilizationPercent}% seviyesinde.`)
  if(topMachine) recommendations.add(`${topMachine.machineCode || topMachine.entityCode} uretimin en buyuk makine darbogazi olabilir.`)
  if(setupItem) recommendations.add(`Setup sureleri ${setupItem.entityName} uzerinde ${setupItem.setupMinutes} dk etkisi olusturuyor.`)
  if(personnelItem && personnelItem.missingPersonnel > 0) recommendations.add(`Personel eksikligi nedeniyle ${personnelItem.entityName} risk olusturuyor.`)
  if(maintenanceItem) recommendations.add(`${maintenanceItem.entityName} bakim sinyali darbogazi artiriyor.`)

  return Array.from(recommendations)
}

export const calculateBottleneckAnalysis = (
  input: BottleneckCalculationInput
): BottleneckCalculationResult => {
  const capacityPlans = (input.capacityPlans || CapacityPlanningService.list(input.sourceData))
    .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  const machineSchedules = (input.machineSchedules || MachineSchedulingService.list(input.sourceData))
    .filter(schedule => schedule.status !== 'CANCELLED' && isInDateRange(schedule.startDate, schedule.endDate, input))
  const workforcePlans = (input.workforcePlans || WorkforcePlanningService.list(input.sourceData))
    .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  const items = filterByRisk(dedupeItems([
    ...createLineItems(input, capacityPlans),
    ...createMachineCapacityItems(input, capacityPlans),
    ...createWorkCenterItems(input, capacityPlans),
    ...createMachineQueueItems(input, machineSchedules),
    ...createTimelineIdleItems(input, machineSchedules),
    ...createPersonnelItems(input, workforcePlans),
    ...createWarehouseItems(input, capacityPlans),
    ...createMaterialItems(input)
  ]).sort((first, second) => second.riskScore - first.riskScore || first.entityName.localeCompare(second.entityName, 'tr-TR')), input)
  const constraints = items.flatMap(item => item.constraints)
  const reasons = items.flatMap(item => item.reasons)

  return {
    items,
    constraints,
    reasons,
    recommendations: createRecommendations(items),
    sourceCapacityPlanIds: capacityPlans.map(plan => plan.id),
    sourceMachineScheduleIds: machineSchedules.map(schedule => schedule.id),
    sourceWorkforcePlanIds: workforcePlans.map(plan => plan.id),
    sourceProductionPlanIds: Array.from(new Set([
      ...capacityPlans.flatMap(plan => plan.sourcePlanningPlanIds),
      ...machineSchedules.flatMap(schedule => schedule.sourceProductionPlanIds),
      ...workforcePlans.flatMap(plan => plan.sourceProductionPlanIds)
    ]))
  }
}

export const BottleneckCalculationService = {
  calculate: calculateBottleneckAnalysis,
  riskLevel: getRiskLevel
}
