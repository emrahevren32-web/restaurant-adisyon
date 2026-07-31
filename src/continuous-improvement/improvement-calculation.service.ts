import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import type { BottleneckItem, BottleneckReport } from '../bottleneck-analysis/bottleneck-analysis.types'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type { CapacityPlan } from '../capacity-planning/capacity-planning.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import type { MachineSchedule } from '../machine-scheduling/machine-scheduling.types'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import type {
  EmployeeAssignment,
  ShiftAssignment,
  WorkforcePlan
} from '../workforce-planning/workforce-planning.types'
import type {
  ImprovementArea,
  ImprovementOpportunity,
  ImprovementPriority,
  ImprovementRecommendation,
  ImprovementRiskLevel,
  ImprovementSourceType
} from './continuous-improvement.types'

type ImprovementCalculationInput = {
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
  startDate: string
  endDate: string
  area: ImprovementArea | 'all'
  productionLineId: string
  machineId: string
  employeeId: string
  bottleneckReports?: BottleneckReport[]
  capacityPlans?: CapacityPlan[]
  machineSchedules?: MachineSchedule[]
  workforcePlans?: WorkforcePlan[]
}

export type ImprovementCalculationResult = {
  opportunities: ImprovementOpportunity[]
  recommendations: ImprovementRecommendation[]
  sourceBottleneckReportIds: string[]
  sourceCapacityPlanIds: string[]
  sourceMachineScheduleIds: string[]
  sourceWorkforcePlanIds: string[]
  sourceProductionPlanIds: string[]
}

const isInDateRange = (
  startDate: string,
  endDate: string,
  input: ImprovementCalculationInput
) => startDate <= input.endDate && endDate >= input.startDate

const getRiskLevel = (
  score: number
): ImprovementRiskLevel => {
  if(score >= 90) return 'CRITICAL'
  if(score >= 70) return 'HIGH'
  if(score >= 45) return 'MEDIUM'
  return 'LOW'
}

const getPriority = (
  riskLevel: ImprovementRiskLevel,
  benefitScore: number
): ImprovementPriority => {
  if(riskLevel === 'CRITICAL' || benefitScore >= 85) return 'URGENT'
  if(riskLevel === 'HIGH' || benefitScore >= 70) return 'HIGH'
  if(riskLevel === 'MEDIUM' || benefitScore >= 40) return 'NORMAL'
  return 'LOW'
}

const getBenefitScore = ({
  expectedGainMinutes,
  expectedGainPercent,
  riskScore,
  utilizationPercent
}: {
  expectedGainMinutes: number
  expectedGainPercent: number
  riskScore: number
  utilizationPercent: number
}) => Math.max(0, Math.min(100, roundKpi(
  riskScore * 0.45
  + expectedGainPercent * 0.4
  + Math.min(25, expectedGainMinutes / 12)
  + Math.max(0, utilizationPercent - 80) * 0.2
)))

const mapBottleneckArea = (
  item: BottleneckItem
): ImprovementArea => {
  if(item.bottleneckType === 'PERSONNEL' && item.shiftName && !item.employeeId) return 'SHIFT'
  if(item.bottleneckType === 'WORK_CENTER') return 'LINE'
  if(item.bottleneckType === 'MACHINE') return 'MACHINE'
  if(item.bottleneckType === 'LINE') return 'LINE'
  if(item.bottleneckType === 'PERSONNEL') return 'PERSONNEL'
  if(item.bottleneckType === 'WAREHOUSE') return 'WAREHOUSE'
  if(item.bottleneckType === 'MATERIAL') return 'MATERIAL'
  if(item.bottleneckType === 'SETUP') return 'SETUP'
  if(item.bottleneckType === 'CLEANING') return 'CLEANING'
  return 'MAINTENANCE'
}

const matchesScope = (
  row: {
    area?: ImprovementArea
    productionLineId?: string
    machineId?: string
    employeeId?: string
  },
  input: ImprovementCalculationInput
) => (
  (input.area === ALL_FILTER || row.area === input.area)
  && (input.productionLineId === ALL_FILTER || row.productionLineId === input.productionLineId)
  && (input.machineId === ALL_FILTER || row.machineId === input.machineId)
  && (input.employeeId === ALL_FILTER || row.employeeId === input.employeeId)
)

const getSummary = (
  area: ImprovementArea,
  entityName: string,
  expectedGainPercent: number
) => {
  if(area === 'SETUP') return `${entityName} setup suresi ${expectedGainPercent}% azaltilebilir.`
  if(area === 'CLEANING') return `${entityName} temizlik penceresi iyilestirilebilir.`
  if(area === 'LINE') return `${entityName} hat yuku dengelenebilir.`
  if(area === 'MACHINE') return `${entityName} daha verimli kullanilabilir.`
  if(area === 'PERSONNEL') return `${entityName} personel dagilimi iyilestirilebilir.`
  if(area === 'SHIFT') return `${entityName} vardiya dagilimi beklemeyi azaltabilir.`
  if(area === 'MAINTENANCE') return `${entityName} bakim plani guncellenirse kapasite artabilir.`
  if(area === 'WAREHOUSE') return `${entityName} depo hazirlik akisi hizlandirilabilir.`
  if(area === 'MATERIAL') return `${entityName} malzeme bulunurlugu uretim beklemesini azaltabilir.`
  return `${entityName} enerji ve bos sure etkisi azaltilabilir.`
}

const getRecommendationText = (
  area: ImprovementArea
) => {
  if(area === 'SETUP') return 'Setup surelerini azalt'
  if(area === 'CLEANING') return 'Temizlik surelerini azalt'
  if(area === 'LINE') return 'Hat yukunu dengele'
  if(area === 'MACHINE') return 'Makine kullanimini artir'
  if(area === 'PERSONNEL' || area === 'SHIFT') return 'Personel dagilimini iyilestir'
  if(area === 'MAINTENANCE') return 'Bakim zamanini optimize et'
  if(area === 'WAREHOUSE') return 'Depo hazirlik akisini iyilestir'
  if(area === 'MATERIAL') return 'Malzeme uygunlugunu iyilestir'
  return 'Enerji ve bos sure kaybini azalt'
}

const getOwnerRole = (
  area: ImprovementArea
) => {
  if(area === 'PERSONNEL' || area === 'SHIFT') return 'Personel Planlama'
  if(area === 'MAINTENANCE') return 'Bakim ve Uretim'
  if(area === 'WAREHOUSE' || area === 'MATERIAL') return 'Depo ve Uretim'
  if(area === 'MACHINE') return 'Makine Cizelgeleme'
  return 'Uretim Planlama'
}

const createOpportunity = ({
  area,
  capacityUtilizationPercent = 0,
  cleaningMinutes = 0,
  department = '',
  employeeId = '',
  employeeName = '',
  entityCode = '',
  entityId,
  entityName,
  idleMinutes = 0,
  machineCode = '',
  machineId = '',
  machineName = '',
  maintenanceMinutes = 0,
  personnelUtilizationPercent = 0,
  productionLineId = '',
  productionLineName = '',
  reportId,
  reportNo,
  riskScore = 0,
  setupMinutes = 0,
  shiftName = '',
  sourceId,
  sourceNo,
  sourceType,
  utilizationPercent = 0,
  waitingMinutes = 0
}: {
  reportId: string
  reportNo: string
  area: ImprovementArea
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
  department?: string
  shiftName?: string
  waitingMinutes?: number
  idleMinutes?: number
  utilizationPercent?: number
  setupMinutes?: number
  cleaningMinutes?: number
  maintenanceMinutes?: number
  capacityUtilizationPercent?: number
  personnelUtilizationPercent?: number
  riskScore?: number
  sourceType: ImprovementSourceType
  sourceId: string
  sourceNo: string
}): ImprovementOpportunity => {
  const lossMinutes = waitingMinutes + idleMinutes + setupMinutes + cleaningMinutes + maintenanceMinutes
  const expectedGainMinutes = roundKpi(
    waitingMinutes * 0.35
    + idleMinutes * 0.2
    + setupMinutes * 0.22
    + cleaningMinutes * 0.18
    + maintenanceMinutes * 0.2
  )
  const expectedGainPercent = percent(expectedGainMinutes, Math.max(1, lossMinutes + expectedGainMinutes))
  const benefitScore = getBenefitScore({
    expectedGainMinutes,
    expectedGainPercent,
    riskScore,
    utilizationPercent
  })
  const riskLevel = getRiskLevel(Math.max(riskScore, benefitScore))
  const priority = getPriority(riskLevel, benefitScore)
  const opportunityId = `${reportId}_opp_${sourceType}_${area}_${entityId}_${sourceNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')

  return {
    id: opportunityId,
    reportId,
    reportNo,
    area,
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
    department,
    shiftName,
    waitingMinutes: roundKpi(waitingMinutes),
    idleMinutes: roundKpi(idleMinutes),
    utilizationPercent: roundKpi(utilizationPercent),
    setupMinutes: roundKpi(setupMinutes),
    cleaningMinutes: roundKpi(cleaningMinutes),
    maintenanceMinutes: roundKpi(maintenanceMinutes),
    capacityUtilizationPercent: roundKpi(capacityUtilizationPercent || utilizationPercent),
    personnelUtilizationPercent: roundKpi(personnelUtilizationPercent),
    expectedGainMinutes,
    expectedGainPercent,
    expectedBenefitScore: benefitScore,
    riskLevel,
    priority,
    summary: getSummary(area, entityName, expectedGainPercent),
    sourceType,
    sourceId,
    sourceNo,
    detectedAt: new Date().toISOString()
  }
}

const createRecommendation = (
  opportunity: ImprovementOpportunity
): ImprovementRecommendation => ({
  id: `${opportunity.id}_recommendation`,
  opportunityId: opportunity.id,
  area: opportunity.area,
  title: opportunity.summary,
  description: `${opportunity.sourceNo} kaynagindan hesaplanan read-model iyilestirme firsati.`,
  action: getRecommendationText(opportunity.area),
  expectedImpact: `${opportunity.expectedGainMinutes} dk beklenen kazanc, ${opportunity.expectedGainPercent}% potansiyel iyilesme.`,
  ownerRole: getOwnerRole(opportunity.area),
  priority: opportunity.priority
})

const createBottleneckOpportunities = (
  input: ImprovementCalculationInput,
  reports: BottleneckReport[]
) => reports
  .filter(report => report.status !== 'CANCELLED' && isInDateRange(report.startDate, report.endDate, input))
  .flatMap(report => report.items.map(item => ({ report, item })))
  .map(({ report, item }) => {
    const area = mapBottleneckArea(item)
    return createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area,
      entityId: item.entityId,
      entityCode: item.entityCode,
      entityName: item.entityName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      shiftName: item.shiftName,
      waitingMinutes: item.waitingMinutes,
      idleMinutes: item.idleMinutes,
      utilizationPercent: item.utilizationPercent,
      setupMinutes: item.setupMinutes,
      cleaningMinutes: item.cleaningMinutes,
      maintenanceMinutes: item.maintenanceMinutes,
      capacityUtilizationPercent: item.utilizationPercent,
      personnelUtilizationPercent: area === 'PERSONNEL' || area === 'SHIFT' ? item.utilizationPercent : 0,
      riskScore: item.riskScore,
      sourceType: 'BottleneckAnalysis',
      sourceId: report.id,
      sourceNo: report.reportNo
    })
  })
  .filter(opportunity => matchesScope(opportunity, input))

const createCapacityOpportunities = (
  input: ImprovementCalculationInput,
  plans: CapacityPlan[]
) => {
  const lineRows = plans.flatMap(plan => plan.productionCapacities.map(capacity => ({ plan, capacity })))
    .filter(row => row.capacity.totalLoadMinutes > 0 && (row.capacity.utilizationPercent >= 90 || row.capacity.idleMinutes >= 120))
    .map(({ plan, capacity }) => createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area: capacity.utilizationPercent >= 90 ? 'LINE' : 'ENERGY',
      entityId: capacity.productionLineId,
      entityCode: capacity.productionLineCode,
      entityName: capacity.productionLineName,
      productionLineId: capacity.productionLineId,
      productionLineName: capacity.productionLineName,
      shiftName: capacity.shift,
      waitingMinutes: capacity.overloadMinutes,
      idleMinutes: capacity.idleMinutes,
      utilizationPercent: capacity.utilizationPercent,
      setupMinutes: capacity.setupMinutes,
      cleaningMinutes: capacity.cleaningMinutes,
      maintenanceMinutes: capacity.maintenanceMinutes,
      capacityUtilizationPercent: capacity.utilizationPercent,
      riskScore: capacity.utilizationPercent,
      sourceType: 'CapacityPlanning',
      sourceId: plan.id,
      sourceNo: plan.capacityPlanNo
    }))

  const machineRows = plans.flatMap(plan => plan.machineCapacities.map(machine => ({ plan, machine })))
    .filter(row => row.machine.active && (row.machine.utilizationPercent < 60 || row.machine.utilizationPercent >= 90 || row.machine.maintenanceMinutes > 0))
    .map(({ plan, machine }) => createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area: machine.maintenanceMinutes > 0 ? 'MAINTENANCE' : machine.utilizationPercent < 60 ? 'MACHINE' : 'MACHINE',
      entityId: machine.machineId,
      entityCode: machine.machineCode,
      entityName: machine.machineName,
      productionLineId: machine.productionLineId,
      productionLineName: machine.productionLineName,
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      shiftName: machine.shift,
      waitingMinutes: machine.overloadMinutes,
      idleMinutes: machine.idleMinutes,
      utilizationPercent: machine.utilizationPercent,
      setupMinutes: machine.setupMinutes,
      cleaningMinutes: machine.cleaningMinutes,
      maintenanceMinutes: machine.maintenanceMinutes,
      capacityUtilizationPercent: machine.utilizationPercent,
      riskScore: machine.utilizationPercent < 60 ? 65 - machine.utilizationPercent : machine.utilizationPercent,
      sourceType: 'CapacityPlanning',
      sourceId: plan.id,
      sourceNo: plan.capacityPlanNo
    }))

  const warehouseRows = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(row => row.item.warehousePreparationMinutes >= 20)
    .map(({ plan, item }) => createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area: 'WAREHOUSE',
      entityId: item.productionLineId,
      entityName: `${item.productionLineName} depo hazirligi`,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      shiftName: item.shift,
      waitingMinutes: item.warehousePreparationMinutes,
      idleMinutes: item.idleMinutes,
      utilizationPercent: item.utilizationPercent,
      capacityUtilizationPercent: item.utilizationPercent,
      riskScore: Math.min(100, 55 + item.warehousePreparationMinutes / 2),
      sourceType: 'CapacityPlanning',
      sourceId: plan.id,
      sourceNo: plan.capacityPlanNo
    }))

  return [...lineRows, ...machineRows, ...warehouseRows]
    .filter(opportunity => matchesScope(opportunity, input))
}

const createSchedulingOpportunities = (
  input: ImprovementCalculationInput,
  schedules: MachineSchedule[]
) => schedules
  .filter(schedule => schedule.status !== 'CANCELLED' && isInDateRange(schedule.startDate, schedule.endDate, input))
  .flatMap(schedule => [
    ...schedule.queues.map(queue => {
      const setupShare = percent(queue.totalSetupMinutes + queue.totalCleaningMinutes, queue.totalWorkingMinutes)
      const area: ImprovementArea = setupShare >= 18 ? 'SETUP' : queue.totalCleaningMinutes >= queue.totalSetupMinutes ? 'CLEANING' : 'MACHINE'
      return createOpportunity({
        reportId: input.reportId,
        reportNo: input.reportNo,
        area,
        entityId: queue.machineId,
        entityCode: queue.machineCode,
        entityName: queue.machineName,
        productionLineId: queue.productionLineId,
        productionLineName: queue.productionLineName,
        machineId: queue.machineId,
        machineCode: queue.machineCode,
        machineName: queue.machineName,
        waitingMinutes: queue.totalWaitingMinutes,
        idleMinutes: queue.idleMinutes,
        utilizationPercent: queue.utilizationPercent,
        setupMinutes: queue.totalSetupMinutes,
        cleaningMinutes: queue.totalCleaningMinutes,
        capacityUtilizationPercent: queue.utilizationPercent,
        riskScore: queue.utilizationPercent + Math.min(20, queue.totalWaitingMinutes / 30),
        sourceType: 'MachineScheduling',
        sourceId: schedule.id,
        sourceNo: schedule.scheduleNo
      })
    }),
    ...schedule.timelines
      .filter(timeline => timeline.idleMinutes >= 120)
      .map(timeline => createOpportunity({
        reportId: input.reportId,
        reportNo: input.reportNo,
        area: 'ENERGY',
        entityId: timeline.machineId,
        entityCode: timeline.machineCode,
        entityName: timeline.machineName,
        productionLineId: timeline.productionLineId,
        productionLineName: timeline.productionLineName,
        machineId: timeline.machineId,
        machineCode: timeline.machineCode,
        machineName: timeline.machineName,
        idleMinutes: timeline.idleMinutes,
        utilizationPercent: timeline.utilizationPercent,
        capacityUtilizationPercent: timeline.utilizationPercent,
        riskScore: Math.min(100, 45 + timeline.idleMinutes / 10),
        sourceType: 'MachineScheduling',
        sourceId: schedule.id,
        sourceNo: schedule.scheduleNo
      }))
  ])
  .filter(opportunity => opportunity.expectedGainMinutes >= 10)
  .filter(opportunity => matchesScope(opportunity, input))

const createWorkforceOpportunities = (
  input: ImprovementCalculationInput,
  plans: WorkforcePlan[]
) => plans
  .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  .flatMap(plan => [
    ...plan.shiftAssignments.map((assignment: ShiftAssignment) => createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area: 'SHIFT',
      entityId: assignment.id,
      entityName: `${assignment.shiftName} vardiyasi`,
      productionLineId: plan.productionLineId,
      productionLineName: plan.productionLineName,
      shiftName: assignment.shiftName,
      waitingMinutes: assignment.missingEmployeeCount * 90,
      idleMinutes: assignment.idleEmployees * 120,
      utilizationPercent: assignment.utilizationPercent,
      personnelUtilizationPercent: assignment.utilizationPercent,
      riskScore: assignment.utilizationPercent + assignment.missingEmployeeCount * 12 + assignment.conflictCount * 10,
      sourceType: 'WorkforcePlanning',
      sourceId: plan.id,
      sourceNo: plan.planNo
    })),
    ...plan.employeeAssignments.map((assignment: EmployeeAssignment) => createOpportunity({
      reportId: input.reportId,
      reportNo: input.reportNo,
      area: 'PERSONNEL',
      entityId: assignment.employeeId,
      entityCode: assignment.employeeCode,
      entityName: assignment.employeeName,
      employeeId: assignment.employeeId,
      employeeName: assignment.employeeName,
      department: assignment.department,
      shiftName: assignment.shiftName,
      idleMinutes: assignment.idleMinutes,
      utilizationPercent: assignment.utilizationPercent,
      personnelUtilizationPercent: assignment.utilizationPercent,
      riskScore: assignment.conflictCount > 0 ? 85 : assignment.utilizationPercent < 50 ? 65 - assignment.utilizationPercent : assignment.utilizationPercent,
      sourceType: 'WorkforcePlanning',
      sourceId: plan.id,
      sourceNo: plan.planNo
    }))
  ])
  .filter(opportunity => opportunity.expectedGainMinutes >= 10)
  .filter(opportunity => matchesScope(opportunity, input))

const createMaterialOpportunities = (
  input: ImprovementCalculationInput
) => input.sourceData.stockItems
  .filter(item => item.currentQty <= item.minQty)
  .slice(0, 8)
  .map(item => createOpportunity({
    reportId: input.reportId,
    reportNo: input.reportNo,
    area: 'MATERIAL',
    entityId: item.id,
    entityCode: item.sku || item.id,
    entityName: item.name,
    waitingMinutes: Math.max(30, (item.minQty - item.currentQty) * 10),
    utilizationPercent: percent(item.currentQty, item.minQty || 1),
    riskScore: Math.min(100, 70 + percent(item.minQty - item.currentQty, item.minQty || 1) / 2),
    sourceType: 'Inventory',
    sourceId: item.id,
    sourceNo: item.sku || item.id
  }))
  .filter(opportunity => matchesScope(opportunity, input))

const dedupeOpportunities = (
  opportunities: ImprovementOpportunity[]
) => Array.from(opportunities.reduce<Map<string, ImprovementOpportunity>>((map, opportunity) => {
  const key = `${opportunity.area}_${opportunity.entityId}_${opportunity.sourceType}_${opportunity.sourceNo}`
  const previous = map.get(key)
  if(!previous || opportunity.expectedBenefitScore > previous.expectedBenefitScore) map.set(key, opportunity)
  return map
}, new Map()).values())

export const calculateImprovementOpportunities = (
  input: ImprovementCalculationInput
): ImprovementCalculationResult => {
  const capacityPlans = (input.capacityPlans || CapacityPlanningService.list(input.sourceData))
    .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  const machineSchedules = (input.machineSchedules || MachineSchedulingService.list(input.sourceData))
    .filter(schedule => schedule.status !== 'CANCELLED' && isInDateRange(schedule.startDate, schedule.endDate, input))
  const workforcePlans = (input.workforcePlans || WorkforcePlanningService.list(input.sourceData))
    .filter(plan => plan.status !== 'CANCELLED' && isInDateRange(plan.startDate, plan.endDate, input))
  const bottleneckReports = (input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData))
    .filter(report => report.status !== 'CANCELLED' && isInDateRange(report.startDate, report.endDate, input))
  const opportunities = dedupeOpportunities([
    ...createBottleneckOpportunities(input, bottleneckReports),
    ...createCapacityOpportunities(input, capacityPlans),
    ...createSchedulingOpportunities(input, machineSchedules),
    ...createWorkforceOpportunities(input, workforcePlans),
    ...createMaterialOpportunities(input)
  ])
    .filter(opportunity => opportunity.expectedGainMinutes > 0 || opportunity.expectedBenefitScore >= 45)
    .sort((first, second) => (
      second.expectedBenefitScore - first.expectedBenefitScore
      || second.expectedGainMinutes - first.expectedGainMinutes
      || first.entityName.localeCompare(second.entityName, 'tr-TR')
    ))
  const recommendations = opportunities.map(createRecommendation)

  return {
    opportunities,
    recommendations,
    sourceBottleneckReportIds: bottleneckReports.map(report => report.id),
    sourceCapacityPlanIds: capacityPlans.map(plan => plan.id),
    sourceMachineScheduleIds: machineSchedules.map(schedule => schedule.id),
    sourceWorkforcePlanIds: workforcePlans.map(plan => plan.id),
    sourceProductionPlanIds: Array.from(new Set([
      ...capacityPlans.flatMap(plan => plan.sourcePlanningPlanIds),
      ...machineSchedules.flatMap(schedule => schedule.sourceProductionPlanIds),
      ...workforcePlans.flatMap(plan => plan.sourceProductionPlanIds),
      ...bottleneckReports.flatMap(report => report.sourceProductionPlanIds)
    ]))
  }
}

export const ImprovementCalculationService = {
  calculate: calculateImprovementOpportunities,
  riskLevel: getRiskLevel,
  priority: getPriority,
  totalExpectedGain: (opportunities: ImprovementOpportunity[]) => sumBy(opportunities, opportunity => opportunity.expectedGainMinutes)
}
