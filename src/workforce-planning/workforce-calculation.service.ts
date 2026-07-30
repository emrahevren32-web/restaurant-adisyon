import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import type { MachineSchedule, MachineScheduleItem } from '../machine-scheduling/machine-scheduling.types'
import { loadEmployees, loadShifts } from '../storage'
import type { Employee, Shift } from '../types'
import type {
  EmployeeAssignment,
  ShiftAssignment,
  WorkforcePlanItem
} from './workforce-planning.types'

type WorkforceCalculationInput = {
  planId: string
  planNo: string
  sourceData: KpiSourceData
  startDate: string
  endDate: string
  employeeId: string
  department: string
  shiftName: string
  productionLineId: string
  machineId: string
}

export type WorkforceCalculationResult = {
  items: WorkforcePlanItem[]
  employeeAssignments: EmployeeAssignment[]
  shiftAssignments: ShiftAssignment[]
  recommendations: string[]
  sourceMachineScheduleIds: string[]
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

const createDateTime = (
  dateKey: string,
  timeValue: string
) => `${dateKey}T${timeValue || '08:00'}:00.000`

const diffMinutes = (
  startAt: string,
  endAt: string
) => roundKpi(Math.max(0, (new Date(endAt).getTime() - new Date(startAt).getTime()) / MINUTE_MS))

const overlaps = (
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string
) => firstStart < secondEnd && secondStart < firstEnd

const normalizeShiftName = (
  value: string
) => {
  const text = normalizeSearchText(value)
  if(text.includes('aksam') || text.startsWith('ak')) return 'Aksam'
  if(text.includes('tam')) return 'Tam Gun'
  if(text.includes('gece')) return 'Gece'
  if(text.includes('hafta')) return 'Haftalik'
  if(text.includes('ay')) return 'Aylik'
  return 'Sabah'
}

const getDepartmentForEmployee = (
  employee: Employee | null
) => {
  const position = normalizeText(employee?.position)
  const search = normalizeSearchText(position)
  if(search.includes('depo') || search.includes('warehouse')) return 'Depo'
  if(search.includes('bakim') || search.includes('maintenance')) return 'Bakim'
  if(search.includes('kalite') || search.includes('quality')) return 'Kalite'
  if(search.includes('lojistik') || search.includes('sevkiyat')) return 'Lojistik'
  if(search.includes('yonet') || search.includes('manager')) return 'Yonetim'
  if(search.includes('operasyon')) return 'Operasyon'
  return position || 'Uretim'
}

const getShiftStartAt = (
  shift: Shift
) => createDateTime(shift.workDate, shift.startTime)

const getShiftEndAt = (
  shift: Shift
) => {
  const startAt = getShiftStartAt(shift)
  const rawEndAt = createDateTime(shift.workDate, shift.endTime)
  if(rawEndAt > startAt) return rawEndAt
  return new Date(new Date(rawEndAt).getTime() + 24 * 60 * MINUTE_MS).toISOString()
}

const getShiftMinutes = (
  shift: Shift
) => diffMinutes(getShiftStartAt(shift), getShiftEndAt(shift))

const matchesRange = (
  dateValue: string,
  input: WorkforceCalculationInput
) => {
  const dateKey = getDateKey(dateValue)
  return dateKey >= input.startDate && dateKey <= input.endDate
}

const matchesMachineSchedule = (
  schedule: MachineSchedule,
  input: WorkforceCalculationInput
) => schedule.status !== 'CANCELLED'
  && schedule.startDate <= input.endDate
  && schedule.endDate >= input.startDate

const matchesMachineItem = (
  item: MachineScheduleItem,
  input: WorkforceCalculationInput
) => (
  (input.machineId === ALL_FILTER || item.machineId === input.machineId)
  && (input.productionLineId === ALL_FILTER || item.productionLineId === input.productionLineId)
)

const matchesEmployee = (
  employee: Employee,
  input: WorkforceCalculationInput
) => (
  (input.employeeId === ALL_FILTER || employee.id === input.employeeId)
  && (input.department === ALL_FILTER || getDepartmentForEmployee(employee) === input.department)
)

const matchesShift = (
  shift: Shift,
  input: WorkforceCalculationInput
) => (
  !normalizeSearchText(shift.status).includes('ptal')
  && matchesRange(shift.workDate, input)
  && (input.shiftName === ALL_FILTER || normalizeShiftName(shift.shiftName) === normalizeShiftName(input.shiftName))
)

const getShiftForTask = (
  shifts: Shift[],
  employeeId: string,
  task: MachineScheduleItem
) => shifts.find(shift => (
  shift.employeeId === employeeId
  && overlaps(getShiftStartAt(shift), getShiftEndAt(shift), task.startAt, task.endAt)
)) || null

const getCandidateRows = (
  input: WorkforceCalculationInput
) => {
  const employees = loadEmployees().filter(employee => matchesEmployee(employee, input))
  const activeEmployees = employees.filter(employee => employee.isActive)
  const shifts = loadShifts().filter(shift => matchesShift(shift, input))
  const schedules = MachineSchedulingService.list(input.sourceData).filter(schedule => matchesMachineSchedule(schedule, input))
  const tasks = schedules.flatMap(schedule => schedule.items.map(item => ({ schedule, item })))
    .filter(row => matchesMachineItem(row.item, input))
    .sort((first, second) => (
      first.item.startAt.localeCompare(second.item.startAt)
      || first.item.machineCode.localeCompare(second.item.machineCode, 'tr-TR')
      || first.item.sequenceNo - second.item.sequenceNo
    ))

  return {
    employees,
    activeEmployees,
    shifts,
    schedules,
    tasks
  }
}

const selectEmployeeForTask = (
  activeEmployees: Employee[],
  shifts: Shift[],
  assignmentLoad: Map<string, number>,
  task: MachineScheduleItem,
  fallbackIndex: number
) => {
  const shiftedEmployees = activeEmployees.filter(employee => getShiftForTask(shifts, employee.id, task))
  const pool = shiftedEmployees.length > 0 ? shiftedEmployees : activeEmployees
  if(pool.length === 0) return null

  return [...pool].sort((first, second) => (
    (assignmentLoad.get(first.id) || 0) - (assignmentLoad.get(second.id) || 0)
    || first.fullName.localeCompare(second.fullName, 'tr-TR')
  ))[fallbackIndex % pool.length] || pool[0]
}

const hasEmployeeConflict = (
  items: WorkforcePlanItem[],
  employeeId: string,
  startAt: string,
  endAt: string
) => items.some(item => (
  item.employeeId === employeeId
  && item.status !== 'CANCELLED'
  && overlaps(item.startAt, item.endAt, startAt, endAt)
))

const createPlanItems = (
  input: WorkforceCalculationInput
) => {
  const { activeEmployees, employees, schedules, shifts, tasks } = getCandidateRows(input)
  const assignmentLoad = new Map<string, number>()
  const items: WorkforcePlanItem[] = []

  tasks.forEach(({ schedule, item }, index) => {
    const employee = selectEmployeeForTask(activeEmployees, shifts, assignmentLoad, item, index)
    const shift = employee ? getShiftForTask(shifts, employee.id, item) : null
    const department = employee ? getDepartmentForEmployee(employee) : input.department === ALL_FILTER ? 'Uretim' : input.department
    const missingEmployee = !employee
    const passiveEmployee = Boolean(employee && !employee.isActive)
    const shiftMissing = !shift
    const overlapConflict = employee ? hasEmployeeConflict(items, employee.id, item.startAt, item.endAt) : false
    const conflict = missingEmployee || passiveEmployee || shiftMissing || overlapConflict
    const conflictReason = missingEmployee
      ? 'Uygun aktif personel bulunamadi.'
      : passiveEmployee
        ? 'Pasif personel atanamaz.'
        : shiftMissing
          ? 'Gorev saatini kapsayan vardiya bulunamadi.'
          : overlapConflict
            ? 'Ayni personele cakisan gorev atanmis.'
            : ''
    const workingMinutes = item.totalWorkingMinutes || item.estimatedMinutes
    if(employee) assignmentLoad.set(employee.id, (assignmentLoad.get(employee.id) || 0) + workingMinutes)
    const recommendations: string[] = []
    if(shiftMissing) recommendations.push(`${item.machineCode} icin vardiya kapsami kontrol edilmeli.`)
    if(missingEmployee) recommendations.push(`${item.productionLineName} icin operator sayisi yetersiz.`)
    if(overlapConflict) recommendations.push(`${employee?.fullName || 'Personel'} icin cakisan gorev var.`)

    items.push({
      id: `${input.planId}_item_${index + 1}`,
      planId: input.planId,
      planNo: input.planNo,
      sourceMachineScheduleId: schedule.id,
      sourceMachineScheduleNo: schedule.scheduleNo,
      sourceMachineScheduleItemId: item.id,
      employeeId: employee?.id || 'missing_employee',
      employeeCode: employee?.code || 'N/A',
      employeeName: employee?.fullName || 'Personel Eksik',
      employeeActive: employee?.isActive ?? false,
      department,
      shiftId: shift?.id || '',
      shiftName: shift ? normalizeShiftName(shift.shiftName) : normalizeShiftName(schedule.shift),
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      workCenterId: item.workCenterId,
      workCenterName: item.workCenterName,
      taskName: `${item.productName} uretim gorevi`,
      productName: item.productName,
      recipeName: item.recipeName,
      startAt: item.startAt,
      endAt: item.endAt,
      estimatedMinutes: item.estimatedMinutes,
      workingMinutes,
      idleMinutes: 0,
      conflict,
      conflictReason,
      status: conflict ? missingEmployee ? 'MISSING' : 'CONFLICT' : index === 0 ? 'ACTIVE' : 'ASSIGNED',
      sequenceNo: index + 1,
      recommendations
    })
  })

  return {
    employees,
    activeEmployees,
    shifts,
    schedules,
    items
  }
}

const createEmployeeAssignments = (
  planId: string,
  items: WorkforcePlanItem[],
  employees: Employee[],
  shifts: Shift[]
): EmployeeAssignment[] => {
  const employeeMap = new Map(employees.map(employee => [employee.id, employee]))
  const employeeIds = new Set([...employees.map(employee => employee.id), ...items.map(item => item.employeeId).filter(id => id !== 'missing_employee')])

  return Array.from(employeeIds).map(employeeId => {
    const employee = employeeMap.get(employeeId)
    const employeeItems = items.filter(item => item.employeeId === employeeId)
    const totalWorkingMinutes = sumBy(employeeItems, item => item.workingMinutes)
    const employeeShiftMinutes = sumBy(shifts.filter(shift => shift.employeeId === employeeId), getShiftMinutes)
    const availableMinutes = employeeShiftMinutes || totalWorkingMinutes
    const sortedItems = [...employeeItems].sort((first, second) => first.startAt.localeCompare(second.startAt))

    return {
      id: `${planId}_employee_${employeeId}`,
      planId,
      employeeId,
      employeeCode: employee?.code || employeeItems[0]?.employeeCode || 'N/A',
      employeeName: employee?.fullName || employeeItems[0]?.employeeName || employeeId,
      department: getDepartmentForEmployee(employee || null),
      shiftName: normalizeShiftName(shifts.find(shift => shift.employeeId === employeeId)?.shiftName || employeeItems[0]?.shiftName || 'Sabah'),
      isActive: employee?.isActive ?? false,
      assignmentCount: employeeItems.length,
      totalWorkingMinutes,
      idleMinutes: Math.max(0, roundKpi(availableMinutes - totalWorkingMinutes)),
      utilizationPercent: percent(totalWorkingMinutes, availableMinutes),
      conflictCount: employeeItems.filter(item => item.conflict).length,
      firstStartAt: sortedItems[0]?.startAt || '',
      lastEndAt: sortedItems[sortedItems.length - 1]?.endAt || ''
    }
  })
}

const createShiftAssignments = (
  planId: string,
  items: WorkforcePlanItem[],
  employees: Employee[],
  shifts: Shift[],
  input: WorkforceCalculationInput
): ShiftAssignment[] => {
  const shiftKeys = new Set([
    ...shifts.map(shift => `${normalizeShiftName(shift.shiftName)}_${shift.workDate}`),
    ...items.map(item => `${item.shiftName}_${getDateKey(item.startAt)}`)
  ])

  return Array.from(shiftKeys).map(key => {
    const [shiftName, workDate] = key.split('_')
    const shiftRows = shifts.filter(shift => normalizeShiftName(shift.shiftName) === shiftName && shift.workDate === workDate)
    const activeEmployeeIds = new Set(shiftRows.map(shift => shift.employeeId))
    const shiftItems = items.filter(item => item.shiftName === shiftName && getDateKey(item.startAt) === workDate)
    const assignedEmployeeIds = new Set(shiftItems.map(item => item.employeeId).filter(id => id !== 'missing_employee'))
    const availableMinutes = sumBy(shiftRows, getShiftMinutes)
    const totalWorkingMinutes = sumBy(shiftItems, item => item.workingMinutes)
    const targetEmployees = Math.max(1, Math.ceil(totalWorkingMinutes / 360))

    return {
      id: `${planId}_shift_${shiftName}_${workDate}`,
      planId,
      shiftName,
      workDate,
      totalEmployees: employees.length,
      activeEmployees: activeEmployeeIds.size,
      assignedEmployees: assignedEmployeeIds.size,
      idleEmployees: Math.max(0, activeEmployeeIds.size - assignedEmployeeIds.size),
      availableMinutes,
      totalWorkingMinutes,
      utilizationPercent: percent(totalWorkingMinutes, availableMinutes),
      missingEmployeeCount: Math.max(0, targetEmployees - assignedEmployeeIds.size),
      conflictCount: shiftItems.filter(item => item.conflict).length
    }
  }).filter(row => (
    !input.shiftName || input.shiftName === ALL_FILTER || row.shiftName === normalizeShiftName(input.shiftName)
  ))
}

const createRecommendations = (
  items: WorkforcePlanItem[],
  employeeAssignments: EmployeeAssignment[],
  shiftAssignments: ShiftAssignment[]
) => {
  const recommendations = new Set<string>()
  const missingShift = shiftAssignments.find(shift => shift.missingEmployeeCount > 0)
  const lineGap = items.find(item => item.status === 'MISSING')
  const machineGap = items.find(item => item.conflictReason.includes('vardiya'))
  const conflictItem = items.find(item => item.conflictReason.includes('cakisan'))
  const idleEmployee = [...employeeAssignments].sort((first, second) => second.idleMinutes - first.idleMinutes)[0]

  if(missingShift) recommendations.add(`${missingShift.shiftName} vardiyasinda ${missingShift.missingEmployeeCount} personel eksik.`)
  if(lineGap) recommendations.add(`${lineGap.productionLineName} icin operator sayisi yetersiz.`)
  if(machineGap) recommendations.add(`${machineGap.machineCode} icin yetkili vardiya kapsami bulunamadi.`)
  if(conflictItem) recommendations.add(`${conflictItem.employeeName} icin cakisan gorev atanmis.`)
  if(idleEmployee && idleEmployee.idleMinutes > 180) recommendations.add(`${idleEmployee.employeeName} icin bos sure ${idleEmployee.idleMinutes} dk.`)

  return Array.from(recommendations)
}

export const calculateWorkforcePlanning = (
  input: WorkforceCalculationInput
): WorkforceCalculationResult => {
  const { employees, items, schedules, shifts } = createPlanItems(input)
  const employeeAssignments = createEmployeeAssignments(input.planId, items, employees, shifts)
  const shiftAssignments = createShiftAssignments(input.planId, items, employees, shifts, input)

  return {
    items,
    employeeAssignments,
    shiftAssignments,
    recommendations: createRecommendations(items, employeeAssignments, shiftAssignments),
    sourceMachineScheduleIds: schedules.map(schedule => schedule.id),
    sourceCapacityPlanIds: Array.from(new Set(schedules.flatMap(schedule => schedule.sourceCapacityPlanIds))),
    sourceProductionPlanIds: Array.from(new Set(schedules.flatMap(schedule => schedule.sourceProductionPlanIds)))
  }
}

export const WorkforceCalculationService = {
  calculate: calculateWorkforcePlanning,
  normalizeShiftName,
  departmentForEmployee: getDepartmentForEmployee
}
