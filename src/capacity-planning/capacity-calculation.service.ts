import { ChecklistService } from '../operation-checklists/checklist.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { ProductionLine } from '../production-lines/production-line.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import type { ProductionPlan } from '../production-planning/production-planning.types'
import { loadShifts } from '../storage'
import type { Shift } from '../types'
import {
  CAPACITY_SHIFT_MINUTES
} from './capacity-planning.constants'
import type {
  CapacityPlanItem,
  CapacityRiskLevel,
  CapacitySourceType,
  MachineCapacity,
  ProductionCapacity,
  WorkCenterCapacity
} from './capacity-planning.types'

type DerivedMachine = {
  machineId: string
  machineCode: string
  machineName: string
  active: boolean
  maintenanceClosed: boolean
}

type CapacityCalculationInput = {
  planId: string
  sourceData: KpiSourceData
  startDate: string
  endDate: string
  productionLineId: string
  workCenterId: string
  shift: string
}

export type CapacityCalculationResult = {
  items: CapacityPlanItem[]
  productionCapacities: ProductionCapacity[]
  workCenterCapacities: WorkCenterCapacity[]
  machineCapacities: MachineCapacity[]
  recommendations: string[]
  sourcePlanningPlanIds: string[]
}

const MINUTES_PER_DAY = 1440
const FALLBACK_WORKING_MINUTES = 480

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const dayCountInclusive = (
  startDate: string,
  endDate: string
) => {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (MINUTES_PER_DAY * 60 * 1000)) + 1)
}

const isDateWithin = (
  value: string,
  startDate: string,
  endDate: string
) => {
  const key = getDateKey(value)
  return Boolean(key) && key >= startDate && key <= endDate
}

const productMatches = (
  candidate: string,
  target: string
) => {
  const candidateKey = normalizeSearchText(candidate)
  const targetKey = normalizeSearchText(target)
  return candidateKey === targetKey
    || candidateKey.includes(targetKey)
    || targetKey.includes(candidateKey)
}

const normalizeWorkCenterKey = (value: string) => normalizeSearchText(value)
  .replace(/[^a-z0-9]+/gi, '_')
  .replace(/^_+|_+$/g, '')
  || 'genel'

export const getWorkCenterForLine = (line: ProductionLine) => {
  const typeName = normalizeText(line.type) || 'Genel'
  const key = normalizeWorkCenterKey(typeName)
  return {
    workCenterId: `wc_${key}`,
    workCenterName: `${typeName} Work Center`
  }
}

const getLineStatusKey = (line: ProductionLine) => normalizeSearchText(line.status)

const isLinePassive = (line: ProductionLine) => {
  const status = getLineStatusKey(line)
  return status.includes('pasif')
}

const isLineMaintenance = (line: ProductionLine) => {
  const status = getLineStatusKey(line)
  return status.includes('bak') || status.includes('maintenance')
}

const getShiftDuration = (shift: Shift) => {
  const [startHour, startMinute] = shift.startTime.split(':').map(Number)
  const [endHour, endMinute] = shift.endTime.split(':').map(Number)
  if(!Number.isFinite(startHour) || !Number.isFinite(endHour)) return 0
  const start = startHour * 60 + (Number.isFinite(startMinute) ? startMinute : 0)
  let end = endHour * 60 + (Number.isFinite(endMinute) ? endMinute : 0)
  if(end <= start) end += MINUTES_PER_DAY
  return Math.max(0, end - start)
}

const getShiftManagementMinutes = (
  startDate: string,
  endDate: string,
  shift: string
) => {
  let shifts: Shift[] = []
  try {
    shifts = loadShifts()
  } catch {
    shifts = []
  }

  const shiftKey = normalizeSearchText(shift)
  const matchingShifts = shifts.filter(record => {
    const status = normalizeSearchText(record.status)
    const name = normalizeSearchText(record.shiftName)
    const matchesName = shiftKey === 'haftalik'
      || shiftKey === 'aylik'
      || name === shiftKey
      || name.includes(shiftKey)
      || shiftKey.includes(name)

    return status !== 'iptal'
      && isDateWithin(record.workDate, startDate, endDate)
      && matchesName
  })

  if(matchingShifts.length === 0) return 0
  return roundKpi(sumBy(matchingShifts, getShiftDuration) / matchingShifts.length)
}

const getWorkingMinutes = (
  startDate: string,
  endDate: string,
  shift: string
) => {
  const shiftKey = normalizeSearchText(shift)
  const managedMinutes = getShiftManagementMinutes(startDate, endDate, shift)
  if(managedMinutes > 0) return managedMinutes
  if(shiftKey === 'haftalik') return CAPACITY_SHIFT_MINUTES.Haftalik
  if(shiftKey === 'aylik') return CAPACITY_SHIFT_MINUTES.Aylik
  const normalizedKey = shiftKey === 'aksam' || shiftKey === 'aksam vardiyasi'
    ? 'Aksam'
    : shiftKey === 'gece'
      ? 'Gece'
      : shiftKey === 'acil'
        ? 'Acil'
        : shiftKey === 'tam gun'
          ? 'Tam Gun'
          : 'Sabah'

  return (CAPACITY_SHIFT_MINUTES[normalizedKey] || FALLBACK_WORKING_MINUTES) * dayCountInclusive(startDate, endDate)
}

const getMaintenanceLineIds = (sourceData: KpiSourceData) => {
  try {
    return new Set(ChecklistService.list(sourceData)
      .filter(checklist => (
        (checklist.sourceType === 'Maintenance' || checklist.checklistType === 'MAINTENANCE_CONTROL')
        && (checklist.status === 'IN_PROGRESS' || checklist.status === 'REVISED')
      ))
      .map(checklist => checklist.equipmentId)
      .filter(Boolean))
  } catch {
    return new Set<string>()
  }
}

const getMachineCountForLine = (line: ProductionLine) => {
  if(isLinePassive(line)) return 1
  if(line.capacity >= 800) return 2
  return 1
}

const getMachinesForLine = (
  line: ProductionLine,
  maintenanceLineIds: Set<string>
): DerivedMachine[] => {
  const machineCount = getMachineCountForLine(line)
  const maintenanceClosed = isLineMaintenance(line) || maintenanceLineIds.has(line.id)
  const active = !isLinePassive(line)
  const numericCode = line.code.match(/\d+/)?.[0] || '01'

  return Array.from({ length: machineCount }, (_, index) => ({
    machineId: `${line.id}_machine_${index + 1}`,
    machineCode: `M-${numericCode}${machineCount > 1 ? `-${index + 1}` : ''}`,
    machineName: `${line.name} ${machineCount > 1 ? `${index + 1}. Makine` : 'Ana Makine'}`,
    active,
    maintenanceClosed
  }))
}

const selectLineForProduct = (
  productName: string,
  sourceData: KpiSourceData,
  index: number
) => {
  const recipe = sourceData.recipeRecords.find(record => productMatches(record.productName, productName) || productMatches(record.recipeName, productName))
  const recipeKey = normalizeSearchText(`${recipe?.recipeType || ''} ${recipe?.productName || productName}`)
  const matchingLine = sourceData.productionLines.find(line => {
    const lineKey = normalizeSearchText(`${line.type} ${line.name}`)
    return productMatches(lineKey, recipeKey) || productMatches(lineKey, productName)
  })

  return matchingLine || sourceData.productionLines[index % Math.max(1, sourceData.productionLines.length)] || null
}

const getRecipeComplexity = (
  recipeId: string,
  recipeName: string,
  productName: string,
  sourceData: KpiSourceData
) => {
  const recipe = sourceData.recipeRecords.find(record => record.id === recipeId)
    || sourceData.recipeRecords.find(record => productMatches(record.recipeName, recipeName) || productMatches(record.productName, productName))
  return recipe?.ingredients.length || 3
}

const getTimeComponents = ({
  line,
  plannedMinutes,
  productName,
  quantity,
  recipeComplexity
}: {
  line: ProductionLine
  plannedMinutes: number
  productName: string
  quantity: number
  recipeComplexity: number
}) => {
  const lineKey = normalizeSearchText(`${line.type} ${line.name} ${productName}`)
  const recipePreparationMinutes = roundKpi(Math.max(4, recipeComplexity * 3))
  const setupMinutes = roundKpi(10 + recipeComplexity * 1.5)
  const cleaningMinutes = roundKpi(lineKey.includes('et') || lineKey.includes('marine') ? 18 : lineKey.includes('paket') ? 12 : 10)
  const warehousePreparationMinutes = roundKpi(Math.max(6, quantity * 0.03))
  const netProductionMinutes = roundKpi(plannedMinutes)
  const totalLoadMinutes = roundKpi(netProductionMinutes + recipePreparationMinutes + setupMinutes + cleaningMinutes + warehousePreparationMinutes)

  return {
    recipePreparationMinutes,
    setupMinutes,
    cleaningMinutes,
    warehousePreparationMinutes,
    netProductionMinutes,
    totalLoadMinutes
  }
}

const getRiskLevel = (
  utilizationPercent: number,
  overloadMinutes: number,
  maintenanceClosed = false
): CapacityRiskLevel => {
  if(maintenanceClosed && overloadMinutes > 0) return 'CRITICAL'
  if(utilizationPercent >= 110 || overloadMinutes > 120) return 'CRITICAL'
  if(utilizationPercent >= 95 || overloadMinutes > 0) return 'HIGH'
  if(utilizationPercent <= 45) return 'LOW'
  return 'NORMAL'
}

const createItemRecommendations = (
  utilizationPercent: number,
  overloadMinutes: number,
  idleMinutes: number,
  maintenanceClosed: boolean,
  lineName: string,
  machineName: string
) => {
  const recommendations: string[] = []
  if(maintenanceClosed) recommendations.push(`${lineName} maintenance nedeniyle kapasiteyi dusuruyor.`)
  if(overloadMinutes > 0) recommendations.push(`${machineName} uzerinde ${roundKpi(overloadMinutes)} dk asiri yuk var.`)
  if(utilizationPercent >= 100) recommendations.push('Ek vardiya veya alternatif hat analizi gerekli.')
  if(idleMinutes > 180 && utilizationPercent < 50) recommendations.push(`${lineName} dusuk dolulukta; plan kaydirma firsati var.`)
  return recommendations
}

const createPlanningItems = (
  plans: ProductionPlan[],
  sourceData: KpiSourceData,
  planId: string,
  maintenanceLineIds: Set<string>,
  workingMinutes: number
): CapacityPlanItem[] => {
  const lineItemCounters = new Map<string, number>()

  return plans.flatMap(plan => plan.items.map((item, itemIndex) => {
    const line = sourceData.productionLines.find(record => record.id === item.productionLineId)
      || sourceData.productionLines.find(record => productMatches(record.name, item.productionLineName))
      || selectLineForProduct(item.productName, sourceData, itemIndex)
    if(!line) return null

    const machineRows = getMachinesForLine(line, maintenanceLineIds)
    const count = lineItemCounters.get(line.id) || 0
    lineItemCounters.set(line.id, count + 1)
    const machine = machineRows[count % Math.max(1, machineRows.length)]
    const workCenter = getWorkCenterForLine(line)
    const recipeComplexity = getRecipeComplexity(item.recipeId, item.recipeName, item.productName, sourceData)
    const time = getTimeComponents({
      line,
      plannedMinutes: item.estimatedMinutes,
      productName: item.productName,
      quantity: item.produceQuantity,
      recipeComplexity
    })

    const capacityItem: CapacityPlanItem = {
      id: `${planId}_pp_${plan.id}_${item.id}`,
      planId,
      sourceType: 'ProductionPlanning' as CapacitySourceType,
      sourceId: plan.id,
      sourceNo: plan.planNo,
      productName: item.productName,
      recipeId: item.recipeId,
      recipeName: item.recipeName,
      productionLineId: line.id,
      productionLineName: line.name,
      workCenterId: workCenter.workCenterId,
      workCenterName: workCenter.workCenterName,
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      shift: plan.shift || item.shift,
      plannedQuantity: item.produceQuantity,
      unit: item.unit,
      plannedProductionMinutes: roundKpi(item.estimatedMinutes),
      recipePreparationMinutes: time.recipePreparationMinutes,
      setupMinutes: time.setupMinutes,
      cleaningMinutes: time.cleaningMinutes,
      warehousePreparationMinutes: time.warehousePreparationMinutes,
      maintenanceMinutes: 0,
      netProductionMinutes: time.netProductionMinutes,
      availableMinutes: workingMinutes,
      totalLoadMinutes: time.totalLoadMinutes,
      idleMinutes: 0,
      overloadMinutes: 0,
      utilizationPercent: 0,
      riskLevel: 'NORMAL' as CapacityRiskLevel,
      recommendations: []
    }
    return capacityItem
  }).filter((item): item is CapacityPlanItem => Boolean(item)))
}

const createProductionOrderItems = (
  orders: ProductionWorkOrder[],
  sourceData: KpiSourceData,
  planId: string,
  maintenanceLineIds: Set<string>,
  workingMinutes: number
): CapacityPlanItem[] => {
  const lineItemCounters = new Map<string, number>()

  return orders.flatMap((order, orderIndex) => {
    const orderTotalQuantity = Math.max(1, sumBy(order.lines, line => line.quantity))

    return order.lines.map((orderLine, lineIndex) => {
      const line = selectLineForProduct(orderLine.productName, sourceData, orderIndex + lineIndex)
      if(!line) return null
      const machineRows = getMachinesForLine(line, maintenanceLineIds)
      const count = lineItemCounters.get(line.id) || 0
      lineItemCounters.set(line.id, count + 1)
      const machine = machineRows[count % Math.max(1, machineRows.length)]
      const workCenter = getWorkCenterForLine(line)
      const recipeComplexity = getRecipeComplexity('', '', orderLine.productName, sourceData)
      const plannedMinutes = roundKpi(Math.max(20, order.estimatedMinutes * (orderLine.quantity / orderTotalQuantity)))
      const time = getTimeComponents({
        line,
        plannedMinutes,
        productName: orderLine.productName,
        quantity: orderLine.quantity,
        recipeComplexity
      })

      const capacityItem: CapacityPlanItem = {
        id: `${planId}_po_${order.id}_${orderLine.id}`,
        planId,
        sourceType: 'ProductionOrder' as CapacitySourceType,
        sourceId: order.id,
        sourceNo: order.workOrderNo,
        productName: orderLine.productName,
        recipeId: '',
        recipeName: sourceData.recipeRecords.find(record => productMatches(record.productName, orderLine.productName))?.recipeName || 'Production Order',
        productionLineId: line.id,
        productionLineName: line.name,
        workCenterId: workCenter.workCenterId,
        workCenterName: workCenter.workCenterName,
        machineId: machine.machineId,
        machineCode: machine.machineCode,
        machineName: machine.machineName,
        shift: 'Production Order',
        plannedQuantity: orderLine.quantity,
        unit: orderLine.unit,
        plannedProductionMinutes: plannedMinutes,
        recipePreparationMinutes: time.recipePreparationMinutes,
        setupMinutes: time.setupMinutes,
        cleaningMinutes: time.cleaningMinutes,
        warehousePreparationMinutes: time.warehousePreparationMinutes,
        maintenanceMinutes: 0,
        netProductionMinutes: time.netProductionMinutes,
        availableMinutes: workingMinutes,
        totalLoadMinutes: time.totalLoadMinutes,
        idleMinutes: 0,
        overloadMinutes: 0,
        utilizationPercent: 0,
        riskLevel: 'NORMAL' as CapacityRiskLevel,
        recommendations: []
      }
      return capacityItem
    }).filter((item): item is CapacityPlanItem => Boolean(item))
  })
}

const matchesPlanningPlan = (
  plan: ProductionPlan,
  input: CapacityCalculationInput
) => {
  const overlapsDate = plan.startDate <= input.endDate && plan.endDate >= input.startDate
  const shiftKey = normalizeSearchText(input.shift)
  const matchesShift = shiftKey === 'haftalik'
    || shiftKey === 'aylik'
    || normalizeSearchText(plan.shift) === shiftKey
    || input.shift === ALL_FILTER
  return plan.status !== 'CANCELLED' && overlapsDate && matchesShift
}

const matchesOrder = (
  order: ProductionWorkOrder,
  input: CapacityCalculationInput
) => {
  const status = normalizeSearchText(order.status)
  return !status.includes('iptal')
    && !status.includes('tamam')
    && isDateWithin(order.deliveryDate || order.createdAt, input.startDate, input.endDate)
}

const filterItemsByScope = (
  items: CapacityPlanItem[],
  input: CapacityCalculationInput
) => items.filter(item => (
  (input.productionLineId === ALL_FILTER || item.productionLineId === input.productionLineId)
  && (input.workCenterId === ALL_FILTER || item.workCenterId === input.workCenterId)
))

const applyMachineMetricsToItems = (
  items: CapacityPlanItem[],
  machines: MachineCapacity[]
) => items.map(item => {
  const machine = machines.find(record => record.machineId === item.machineId)
  if(!machine) return item
  const idleMinutes = machine.totalLoadMinutes > 0
    ? Math.max(0, machine.availableMinutes - machine.totalLoadMinutes)
    : machine.availableMinutes
  const overloadMinutes = Math.max(0, machine.totalLoadMinutes - machine.availableMinutes)
  const utilizationPercent = percent(item.totalLoadMinutes, Math.max(1, machine.availableMinutes))
  const riskLevel = getRiskLevel(machine.utilizationPercent, overloadMinutes, machine.maintenanceClosed)

  return {
    ...item,
    availableMinutes: machine.availableMinutes,
    maintenanceMinutes: roundKpi(machine.maintenanceMinutes / Math.max(1, items.filter(row => row.machineId === item.machineId).length)),
    idleMinutes: roundKpi(idleMinutes),
    overloadMinutes: roundKpi(overloadMinutes),
    utilizationPercent,
    riskLevel,
    recommendations: createItemRecommendations(machine.utilizationPercent, overloadMinutes, idleMinutes, machine.maintenanceClosed, item.productionLineName, item.machineName)
  }
})

const createMachineCapacities = (
  lines: ProductionLine[],
  items: CapacityPlanItem[],
  maintenanceLineIds: Set<string>,
  workingMinutes: number,
  planId: string
): MachineCapacity[] => lines.flatMap(line => {
  const workCenter = getWorkCenterForLine(line)
  return getMachinesForLine(line, maintenanceLineIds).map(machine => {
    const machineItems = items.filter(item => item.machineId === machine.machineId)
    const plannedProductionMinutes = sumBy(machineItems, item => item.plannedProductionMinutes)
    const recipePreparationMinutes = sumBy(machineItems, item => item.recipePreparationMinutes)
    const setupMinutes = sumBy(machineItems, item => item.setupMinutes)
    const cleaningMinutes = sumBy(machineItems, item => item.cleaningMinutes)
    const warehousePreparationMinutes = sumBy(machineItems, item => item.warehousePreparationMinutes)
    const netProductionMinutes = sumBy(machineItems, item => item.netProductionMinutes)
    const totalLoadMinutes = sumBy(machineItems, item => item.totalLoadMinutes)
    const maintenanceMinutes = machine.maintenanceClosed
      ? workingMinutes
      : line.estimatedUtilization >= 85
        ? roundKpi(workingMinutes * 0.08)
        : roundKpi(workingMinutes * 0.04)
    const availableMinutes = machine.active ? Math.max(0, roundKpi(workingMinutes - maintenanceMinutes)) : 0
    const idleMinutes = Math.max(0, roundKpi(availableMinutes - totalLoadMinutes))
    const overloadMinutes = Math.max(0, roundKpi(totalLoadMinutes - availableMinutes))
    const utilizationPercent = percent(totalLoadMinutes, availableMinutes)
    const riskLevel = getRiskLevel(utilizationPercent, overloadMinutes, machine.maintenanceClosed)

    return {
      id: `${planId}_${machine.machineId}`,
      planId,
      machineId: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      productionLineId: line.id,
      productionLineName: line.name,
      workCenterId: workCenter.workCenterId,
      workCenterName: workCenter.workCenterName,
      shift: '',
      active: machine.active,
      maintenanceClosed: machine.maintenanceClosed,
      workingMinutes,
      availableMinutes,
      plannedProductionMinutes,
      recipePreparationMinutes,
      setupMinutes,
      cleaningMinutes,
      warehousePreparationMinutes,
      maintenanceMinutes,
      netProductionMinutes,
      totalLoadMinutes,
      idleMinutes,
      overloadMinutes,
      utilizationPercent,
      bottleneck: utilizationPercent >= 95 || overloadMinutes > 0,
      riskLevel,
      recommendations: createItemRecommendations(utilizationPercent, overloadMinutes, idleMinutes, machine.maintenanceClosed, line.name, machine.machineName)
    }
  })
})

const createProductionCapacities = (
  lines: ProductionLine[],
  machines: MachineCapacity[],
  planId: string,
  shift: string
): ProductionCapacity[] => lines.map(line => {
  const workCenter = getWorkCenterForLine(line)
  const lineMachines = machines.filter(machine => machine.productionLineId === line.id)
  const workingMinutes = sumBy(lineMachines, machine => machine.workingMinutes)
  const availableMinutes = sumBy(lineMachines, machine => machine.availableMinutes)
  const totalLoadMinutes = sumBy(lineMachines, machine => machine.totalLoadMinutes)
  const idleMinutes = Math.max(0, roundKpi(availableMinutes - totalLoadMinutes))
  const overloadMinutes = Math.max(0, roundKpi(totalLoadMinutes - availableMinutes))
  const utilizationPercent = percent(totalLoadMinutes, availableMinutes)
  const maintenanceClosed = lineMachines.some(machine => machine.maintenanceClosed)
  const riskLevel = getRiskLevel(utilizationPercent, overloadMinutes, maintenanceClosed)

  return {
    id: `${planId}_${line.id}`,
    planId,
    productionLineId: line.id,
    productionLineCode: line.code,
    productionLineName: line.name,
    workCenterId: workCenter.workCenterId,
    workCenterName: workCenter.workCenterName,
    shift,
    lineStatus: line.status,
    machineCount: lineMachines.length,
    workingMinutes,
    availableMinutes,
    plannedProductionMinutes: sumBy(lineMachines, machine => machine.plannedProductionMinutes),
    recipePreparationMinutes: sumBy(lineMachines, machine => machine.recipePreparationMinutes),
    setupMinutes: sumBy(lineMachines, machine => machine.setupMinutes),
    cleaningMinutes: sumBy(lineMachines, machine => machine.cleaningMinutes),
    warehousePreparationMinutes: sumBy(lineMachines, machine => machine.warehousePreparationMinutes),
    maintenanceMinutes: sumBy(lineMachines, machine => machine.maintenanceMinutes),
    netProductionMinutes: sumBy(lineMachines, machine => machine.netProductionMinutes),
    totalLoadMinutes,
    idleMinutes,
    overloadMinutes,
    utilizationPercent,
    bottleneck: lineMachines.some(machine => machine.bottleneck),
    maintenanceClosed,
    riskLevel,
    recommendations: createItemRecommendations(utilizationPercent, overloadMinutes, idleMinutes, maintenanceClosed, line.name, line.name)
  }
})

const createWorkCenterCapacities = (
  productionCapacities: ProductionCapacity[],
  machineCapacities: MachineCapacity[],
  planId: string
): WorkCenterCapacity[] => {
  const rows = productionCapacities.reduce<Map<string, ProductionCapacity[]>>((map, capacity) => {
    map.set(capacity.workCenterId, [...(map.get(capacity.workCenterId) || []), capacity])
    return map
  }, new Map())

  return Array.from(rows.entries()).map(([workCenterId, capacities]) => {
    const availableMinutes = sumBy(capacities, capacity => capacity.availableMinutes)
    const totalLoadMinutes = sumBy(capacities, capacity => capacity.totalLoadMinutes)
    const overloadMinutes = Math.max(0, roundKpi(totalLoadMinutes - availableMinutes))
    const utilizationPercent = percent(totalLoadMinutes, availableMinutes)
    const maintenanceClosed = capacities.some(capacity => capacity.maintenanceClosed)

    return {
      id: `${planId}_${workCenterId}`,
      planId,
      workCenterId,
      workCenterName: capacities[0]?.workCenterName || workCenterId,
      lineCount: capacities.length,
      machineCount: machineCapacities.filter(machine => machine.workCenterId === workCenterId).length,
      workingMinutes: sumBy(capacities, capacity => capacity.workingMinutes),
      availableMinutes,
      totalLoadMinutes,
      idleMinutes: Math.max(0, roundKpi(availableMinutes - totalLoadMinutes)),
      overloadMinutes,
      utilizationPercent,
      bottleneckCount: capacities.filter(capacity => capacity.bottleneck).length,
      riskLevel: getRiskLevel(utilizationPercent, overloadMinutes, maintenanceClosed)
    }
  })
}

const createPlanRecommendations = (
  capacities: ProductionCapacity[],
  machines: MachineCapacity[]
) => {
  const recommendations = new Set<string>()
  const overloadedLine = [...capacities].sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0]
  const maintenanceMachines = machines.filter(machine => machine.maintenanceClosed)
  const lowUsageLine = capacities.find(capacity => capacity.utilizationPercent > 0 && capacity.utilizationPercent < 45)

  if(overloadedLine && overloadedLine.utilizationPercent >= 100){
    recommendations.add(`${overloadedLine.productionLineName} ${overloadedLine.utilizationPercent.toFixed(1)}% kapasiteye ulasiyor.`)
  }
  if(maintenanceMachines.length > 0){
    recommendations.add(`${maintenanceMachines[0].machineCode} maintenance nedeniyle kullanilabilir sureyi dusuruyor.`)
  }
  if(capacities.some(capacity => capacity.overloadMinutes > 0)){
    recommendations.add('Gece veya 3. vardiya acilirsa kapasite problemi azalabilir.')
  }
  if(lowUsageLine){
    recommendations.add(`${lowUsageLine.productionLineName} dusuk dolulukta; plan kaydirma icin uygun.`)
  }

  return Array.from(recommendations)
}

export const calculateCapacityPlan = (
  input: CapacityCalculationInput
): CapacityCalculationResult => {
  const workingMinutes = getWorkingMinutes(input.startDate, input.endDate, input.shift)
  const maintenanceLineIds = getMaintenanceLineIds(input.sourceData)
  const planningPlans = ProductionPlanningService.list(input.sourceData).filter(plan => matchesPlanningPlan(plan, input))
  const productionOrders = input.sourceData.productionOrders.filter(order => matchesOrder(order, input))
  const planningItems = createPlanningItems(planningPlans, input.sourceData, input.planId, maintenanceLineIds, workingMinutes)
  const orderItems = createProductionOrderItems(productionOrders, input.sourceData, input.planId, maintenanceLineIds, workingMinutes)
  const scopedItems = filterItemsByScope([...planningItems, ...orderItems], input)
  const scopedLineIds = new Set(scopedItems.map(item => item.productionLineId))
  const lines = input.sourceData.productionLines.filter(line => (
    (input.productionLineId === ALL_FILTER || line.id === input.productionLineId)
    && (input.workCenterId === ALL_FILTER || getWorkCenterForLine(line).workCenterId === input.workCenterId)
    && (scopedLineIds.size === 0 || scopedLineIds.has(line.id) || input.productionLineId !== ALL_FILTER || input.workCenterId !== ALL_FILTER)
  ))
  const fallbackLines = lines.length > 0 ? lines : input.sourceData.productionLines
  const machineCapacities = createMachineCapacities(fallbackLines, scopedItems, maintenanceLineIds, workingMinutes, input.planId)
  const items = applyMachineMetricsToItems(scopedItems, machineCapacities)
  const productionCapacities = createProductionCapacities(fallbackLines, machineCapacities, input.planId, input.shift)
  const workCenterCapacities = createWorkCenterCapacities(productionCapacities, machineCapacities, input.planId)

  return {
    items,
    productionCapacities,
    workCenterCapacities,
    machineCapacities,
    recommendations: createPlanRecommendations(productionCapacities, machineCapacities),
    sourcePlanningPlanIds: planningPlans.map(plan => plan.id)
  }
}

export const CapacityCalculationService = {
  calculate: calculateCapacityPlan,
  getWorkCenterForLine,
  getWorkingMinutes
}
