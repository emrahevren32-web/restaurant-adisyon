import React from 'react'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { QualityFormService } from '../quality-forms/quality-form.service'
import { loadEmployeePerformances, loadEmployees } from '../storage'
import type { User } from '../types'
import { WasteService } from '../waste-management/waste.service'

type WeeklyProductionShift = 'Sabah' | 'Akşam' | 'Gece' | 'Tam Gün'
type WeeklyProductionStatus = 'Hedef Üstü' | 'Plan Dahilinde' | 'Riskli' | 'Kritik'

type WeeklyProductionFilters = {
  startDate: string
  endDate: string
  branchId: string
  workCenter: string
  lineId: string
  machineId: string
  productId: string
  operatorId: string
  recipeId: string
  shift: WeeklyProductionShift | 'all'
  search: string
}

type PoolProduct = {
  id: string
  name: string
  unit: string
  stockItemId: string
}

type PoolRecipe = {
  id: string
  code: string
  name: string
  productName: string
  firePercent: number
}

type PoolLine = {
  id: string
  code: string
  name: string
  workCenter: string
  branchId: string
  capacity: number
  utilization: number
}

type PoolMachine = {
  id: string
  code: string
  name: string
  lineId: string
  capacityPerHour: number
  maintenanceMinutes: number
}

type PoolOperator = {
  id: string
  name: string
  title: string
  performanceScore: number
}

type WeeklyDailyRecord = {
  id: string
  date: string
  weekStart: string
  weekEnd: string
  weekLabel: string
  workOrderNo: string
  branchId: string
  branchName: string
  productId: string
  productName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  workCenter: string
  lineId: string
  lineName: string
  machineId: string
  machineCode: string
  machineName: string
  operatorId: string
  operatorName: string
  operatorTitle: string
  shift: WeeklyProductionShift
  plannedProduction: number
  actualProduction: number
  waste: number
  wasteReason: string
  downtimeMinutes: number
  machineUtilization: number
  operatorPerformance: number
  availability: number
  performance: number
  quality: number
  efficiency: number
  oee: number
  capacityUtilization: number
  qualityResult: 'PASS' | 'CONDITIONAL' | 'FAIL'
  haccpResult: 'PASS' | 'FAIL'
  unit: string
  status: WeeklyProductionStatus
}

type WeeklyProductionRecord = {
  id: string
  week: string
  weekStart: string
  weekEnd: string
  branchId: string
  branchName: string
  productId: string
  productName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  workCenter: string
  lineId: string
  lineName: string
  machineId: string
  machineCode: string
  machineName: string
  operatorId: string
  operatorName: string
  shift: WeeklyProductionShift
  plannedProduction: number
  actualProduction: number
  waste: number
  wasteRate: number
  efficiency: number
  oee: number
  capacityUtilization: number
  downtimeMinutes: number
  completedWorkOrders: number
  qualityPassCount: number
  qualityFailCount: number
  haccpFailCount: number
  criticalAlertCount: number
  status: WeeklyProductionStatus
  unit: string
  sourceDailyIds: string[]
  wasteReasons: Array<{ reason: string; quantity: number }>
}

type WeeklyKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type WeeklyModel = {
  sourceData: KpiSourceData
  dailyRecords: WeeklyDailyRecord[]
  weeklyRecords: WeeklyProductionRecord[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const DAILY_RECORD_COUNT = 600
const WEEKLY_RECORD_COUNT = 52
const SHIFT_OPTIONS: WeeklyProductionShift[] = ['Sabah', 'Akşam', 'Gece', 'Tam Gün']
const WASTE_REASONS = [
  'Hazırlık fire kaybı',
  'Pişirme gramaj kaybı',
  'Makine ayar sapması',
  'Kalite ayrımı',
  'Ambalaj hasarı',
  'Soğutma sonrası fire',
  'Lot kalite farkı',
  'Operatör yeniden işleme'
]
const FALLBACK_PRODUCTS = [
  'Izgara Tavuk Fileto',
  'Dana Kavurma',
  'Etli Nohut',
  'Zeytinyağlı Taze Fasulye',
  'Mercimek Çorbası',
  'Sebzeli Bulgur Pilavı',
  'Pirinç Pilavı',
  'Fırın Köfte',
  'Tavuk Sote',
  'Dana Tas Kebabı',
  'Mevsim Salata',
  'Peynirli Börek',
  'Ispanak Graten',
  'Sebzeli Makarna',
  'Ayran Dolum',
  'Sütlaç',
  'Kuru Fasulye',
  'Barbunya Pilaki',
  'Fırın Tavuk But',
  'Paketli Sandviç',
  'Tavuk Döner Harcı',
  'Dana Rosto',
  'Çoban Salata',
  'Limonata Bazı',
  'Kremalı Mantar Çorbası',
  'Sebzeli Hindi',
  'Elmalı Kurabiye',
  'Kabak Tatlısı',
  'Domates Sos',
  'Et Suyu Bazı',
  'Sebze Garnitür',
  'Mantar Sote',
  'Kırmızı Mercimek Köftesi',
  'Tavuk Haşlama',
  'Patates Püresi',
  'Yoğurtlu Semizotu',
  'Kakaolu Puding',
  'Komposto',
  'Vakum Pişmiş Et',
  'Diyet Menü Seti'
]
const FALLBACK_LINE_NAMES = [
  'Sıcak Yemek Hattı 1',
  'Sıcak Yemek Hattı 2',
  'Et Hazırlık Hattı',
  'Tavuk Hazırlık Hattı',
  'Sebze Hazırlık Hattı',
  'Çorba Hattı',
  'Tatlı Hattı',
  'Soğuk Mutfak Hattı',
  'Paketleme Hattı 1',
  'Paketleme Hattı 2',
  'Diyet Menü Hattı',
  'Vakum Paketleme',
  'Fırın Hattı',
  'Blast Chiller Hattı',
  'Garnitür Hattı',
  'Sos Hazırlık Hattı',
  'Kahvaltı Hazırlık Hattı',
  'Etiketleme Hattı',
  'Porsiyonlama Hattı',
  'Sevkiyat Hazırlık Hattı'
]
const FALLBACK_OPERATORS = [
  'Ayşe Demir',
  'Mehmet Kaya',
  'Zeynep Şahin',
  'Murat Yıldız',
  'Elif Arslan',
  'Can Özkan',
  'Fatma Çelik',
  'Ali Koç',
  'Derya Aydın',
  'Hakan Polat',
  'Selin Aksoy',
  'Emre Güneş',
  'Buse Kılıç',
  'Kerem Yalçın',
  'Seda Kaplan',
  'Onur Eren',
  'Gizem Taş',
  'Serkan Uçar',
  'Nazlı Kurt',
  'Burak İnce',
  'Melis Ceylan',
  'Tolga Sarı',
  'Ece Tekin',
  'Sinan Yılmaz',
  'Nermin Bulut',
  'Uğur Keskin',
  'Pelin Aslan',
  'Okan Çetin',
  'Ceren Korkmaz',
  'Barış Er',
  'Aslı Durmaz',
  'Volkan Ergin',
  'İrem Çakır',
  'Tuna Bilgin',
  'Merve Solak',
  'Levent Acar',
  'Dilan Bozkurt',
  'Kadir Aksu',
  'Sibel Tan',
  'Eren Karaca',
  'Gül Özdemir',
  'Alper Doğan',
  'Neslihan Avcı',
  'Cem Uslu',
  'Duygu Eker',
  'Fırat Şen',
  'Başak Oral',
  'Mert Ates',
  'İlknur Güler',
  'Ozan Mete',
  'Deniz Kara',
  'Gökhan Erol',
  'Mine Tuncel',
  'Yasin Ünal',
  'Ebru Sezer',
  'Kaan Yüce',
  'Sevgi Oral',
  'Arda Baş',
  'Nilay Çınar',
  'Cihan Soylu'
]

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clampValue = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) => (
  Math.min(max, Math.max(min, toFiniteNumber(value)))
)

const padNumber = (value: number) => String(value).padStart(2, '0')

const toDateKey = (value?: string | Date) => {
  if(!value) return ''
  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(!trimmed) return ''
    if(/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value?: string | Date) => {
  if(!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  nextDate.setHours(12, 0, 0, 0)
  return nextDate
}

const getWeekStart = (value: string | Date) => {
  const date = parseSafeDate(value) || new Date()
  date.setHours(12, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(date, diff)
}

const getWeekEnd = (weekStart: Date) => addDays(weekStart, 6)

const createWeekLabel = (weekStart: string, weekEnd: string) => `${formatDate(weekStart)} - ${formatDate(weekEnd)}`

const formatDate = (value?: string | Date) => {
  const dateKey = toDateKey(value)
  if(!dateKey) return '-'
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('tr-TR')
}

const formatDateTime = (value?: string | Date) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    : '-'
}

const formatMinutes = (value: number) => {
  const minutes = Math.max(0, Math.round(value))
  if(minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours} sa` : `${hours} sa ${remainder} dk`
}

const formatQualityResult = (value: string) => {
  if(value === 'PASS') return 'Uygun'
  if(value === 'CONDITIONAL') return 'Koşullu Uygun'
  if(value === 'FAIL') return 'Uygunsuz'
  return value || '-'
}

const formatHaccpResult = (value: string) => value === 'PASS' ? 'Uygun' : value === 'FAIL' ? 'Uygunsuz' : value || '-'

const getBranchName = (sourceData: KpiSourceData, branchId: string) => (
  sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || 'Merkez'
)

const createDefaultFilters = (): WeeklyProductionFilters => {
  const weekStart = getWeekStart(new Date())
  return {
    startDate: toDateKey(addDays(weekStart, -51 * 7)),
    endDate: toDateKey(getWeekEnd(weekStart)),
    branchId: ALL_FILTER,
    workCenter: ALL_FILTER,
    lineId: ALL_FILTER,
    machineId: ALL_FILTER,
    productId: ALL_FILTER,
    operatorId: ALL_FILTER,
    recipeId: ALL_FILTER,
    shift: ALL_FILTER,
    search: ''
  }
}

const createProductPool = (sourceData: KpiSourceData): PoolProduct[] => {
  const productMap = new Map<string, PoolProduct>()
  sourceData.productRefs.forEach(product => {
    productMap.set(product.id, {
      id: product.id,
      name: product.name,
      unit: product.unit,
      stockItemId: product.stockItemId || ''
    })
  })
  sourceData.stockItems.forEach(item => {
    if(productMap.size >= 40 && productMap.has(item.id)) return
    productMap.set(item.id, {
      id: item.id,
      name: item.name,
      unit: item.unit,
      stockItemId: item.id
    })
  })
  FALLBACK_PRODUCTS.forEach((name, index) => {
    if(productMap.size >= 40) return
    productMap.set(`weekly-product-${index + 1}`, {
      id: `weekly-product-${index + 1}`,
      name,
      unit: index % 6 === 0 ? 'lt' : index % 7 === 0 ? 'adet' : 'kg',
      stockItemId: ''
    })
  })
  return Array.from(productMap.values()).slice(0, 40)
}

const createRecipePool = (
  sourceData: KpiSourceData,
  products: PoolProduct[]
): PoolRecipe[] => {
  const recipes = sourceData.recipeRecords.map((recipe, index) => ({
    id: recipe.id,
    code: recipe.code,
    name: recipe.recipeName,
    productName: recipe.productName || products[index % products.length]?.name || recipe.recipeName,
    firePercent: clampValue(recipe.firePercent, 0.5, 12)
  }))
  const nextRecipes = [...recipes]
  products.forEach((product, index) => {
    if(nextRecipes.length >= 40) return
    nextRecipes.push({
      id: `weekly-recipe-${index + 1}`,
      code: `RC-WA-${String(index + 1).padStart(3, '0')}`,
      name: `${product.name} Haftalık Reçete`,
      productName: product.name,
      firePercent: roundKpi(1.7 + (index % 10) * 0.38)
    })
  })
  return nextRecipes
}

const createLinePool = (sourceData: KpiSourceData): PoolLine[] => {
  const branchIds = sourceData.branches.length > 0 ? sourceData.branches.map(branch => branch.id) : ['main-branch']
  const lines = sourceData.productionLines.map((line, index) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    workCenter: line.type,
    branchId: branchIds[index % branchIds.length],
    capacity: clampValue(line.capacity, 120, 2200),
    utilization: clampValue(line.estimatedUtilization, 30, 100)
  }))
  const nextLines = [...lines]
  FALLBACK_LINE_NAMES.forEach((name, index) => {
    if(nextLines.length >= 20) return
    nextLines.push({
      id: `weekly-line-${index + 1}`,
      code: `HAT-W${String(index + 1).padStart(2, '0')}`,
      name,
      workCenter: index % 4 === 0 ? 'Paketleme' : index % 4 === 1 ? 'Et' : index % 4 === 2 ? 'Sebze' : 'Genel',
      branchId: branchIds[index % branchIds.length],
      capacity: 460 + index * 48,
      utilization: 56 + index % 38
    })
  })
  return nextLines.slice(0, 20)
}

const createMachinePool = (lines: PoolLine[]): PoolMachine[] => (
  Array.from({ length: 35 }, (_, index) => {
    const line = lines[index % lines.length]
    return {
      id: `weekly-machine-${index + 1}`,
      code: `${line.code}-M${String(index % 4 + 1).padStart(2, '0')}`,
      name: `${line.name} Makine ${index % 4 + 1}`,
      lineId: line.id,
      capacityPerHour: roundKpi(75 + index % 9 * 10 + line.capacity / 45),
      maintenanceMinutes: index % 11 === 0 ? 55 : index % 7 === 0 ? 24 : 0
    }
  })
)

const createOperatorPool = (): PoolOperator[] => {
  const employees = loadEmployees()
  const performances = loadEmployeePerformances()
  const rows = employees.map((employee, index) => {
    const performanceRows = performances.filter(performance => performance.employeeId === employee.id)
    return {
      id: employee.id,
      name: employee.fullName,
      title: employee.position || 'Üretim Operatörü',
      performanceScore: performanceRows.length > 0 ? averageBy(performanceRows, performance => performance.performanceScore) : 70 + index % 25
    }
  })
  const nextRows = [...rows]
  FALLBACK_OPERATORS.forEach((name, index) => {
    if(nextRows.length >= 60) return
    nextRows.push({
      id: `weekly-operator-${index + 1}`,
      name,
      title: index % 5 === 0 ? 'Hat Sorumlusu' : index % 3 === 0 ? 'Makine Operatörü' : 'Üretim Operatörü',
      performanceScore: 67 + index % 31
    })
  })
  return nextRows.slice(0, 60)
}

const resolveRecipe = (
  product: PoolProduct,
  recipes: PoolRecipe[],
  index: number
) => {
  const productSearch = normalizeSearchText(product.name)
  return recipes.find(recipe => normalizeSearchText(recipe.productName).includes(productSearch) || productSearch.includes(normalizeSearchText(recipe.productName)))
    || recipes[index % recipes.length]
}

const getStatus = (efficiency: number, oee: number, haccpFailCount = 0): WeeklyProductionStatus => {
  if(haccpFailCount > 0 || oee < 58 || efficiency < 68) return 'Kritik'
  if(oee < 68 || efficiency < 78) return 'Riskli'
  if(oee >= 78 && efficiency >= 92) return 'Hedef Üstü'
  return 'Plan Dahilinde'
}

const createDailyRecords = (sourceData: KpiSourceData): WeeklyDailyRecord[] => {
  const products = createProductPool(sourceData)
  const recipes = createRecipePool(sourceData, products)
  const lines = createLinePool(sourceData)
  const machines = createMachinePool(lines)
  const operators = createOperatorPool()
  const qualityForms = QualityFormService.createReadModelRecords(sourceData)
  const wasteRecords = WasteService.createReadModelRecords(sourceData)
  const branchIds = sourceData.branches.length > 0 ? sourceData.branches.map(branch => branch.id) : ['main-branch']
  const currentWeekStart = getWeekStart(new Date())

  return Array.from({ length: DAILY_RECORD_COUNT }, (_, index) => {
    const weekIndex = index % WEEKLY_RECORD_COUNT
    const weekStartDate = addDays(currentWeekStart, -weekIndex * 7)
    const date = toDateKey(addDays(weekStartDate, index % 7))
    const weekStart = toDateKey(weekStartDate)
    const weekEnd = toDateKey(getWeekEnd(weekStartDate))
    const product = products[index % products.length]
    const recipe = resolveRecipe(product, recipes, index)
    const line = lines[index % lines.length]
    const lineMachines = machines.filter(machine => machine.lineId === line.id)
    const machine = lineMachines[index % Math.max(1, lineMachines.length)] || machines[index % machines.length]
    const operator = operators[index % operators.length]
    const shift = SHIFT_OPTIONS[index % SHIFT_OPTIONS.length]
    const branchId = line.branchId || branchIds[index % branchIds.length]
    const sourceOrder = sourceData.productionOrders[index % Math.max(1, sourceData.productionOrders.length)]
    const plannedProduction = roundKpi(Math.max(80, sourceOrder?.lines?.[index % Math.max(1, sourceOrder.lines.length)]?.quantity || 130 + index % 16 * 18))
    const qualityForm = qualityForms[index % Math.max(1, qualityForms.length)]
    const qualityResult: WeeklyDailyRecord['qualityResult'] = qualityForm?.result === 'FAIL'
      ? 'FAIL'
      : qualityForm?.result === 'CONDITIONAL'
        ? 'CONDITIONAL'
        : index % 31 === 0
          ? 'FAIL'
          : index % 12 === 0
            ? 'CONDITIONAL'
            : 'PASS'
    const haccpRecords = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
    const haccpResult: WeeklyDailyRecord['haccpResult'] = haccpRecords[index % Math.max(1, haccpRecords.length)]?.result || (index % 27 === 0 ? 'FAIL' : 'PASS')
    const wasteRecord = wasteRecords[index % Math.max(1, wasteRecords.length)]
    const baseWasteRate = clampValue(recipe.firePercent + (index % 7) * 0.24 + (qualityResult === 'FAIL' ? 1.3 : 0), 0.4, 14)
    const downtimeMinutes = machine.maintenanceMinutes + (index % 13 === 0 ? 35 + index % 22 : index % 9 === 0 ? 12 : 0)
    const operatorPerformance = clampValue(operator.performanceScore + index % 9 - 4, 48, 99)
    const actualProduction = roundKpi(plannedProduction * clampValue(0.91 + index % 11 * 0.012 - baseWasteRate / 180 - downtimeMinutes / 1400, 0.58, 1.08))
    const waste = roundKpi(actualProduction * baseWasteRate / Math.max(1, 100 - baseWasteRate))
    const availability = roundKpi(clampValue(100 - downtimeMinutes / 5.8, 48, 99))
    const performance = roundKpi(clampValue(percent(actualProduction, plannedProduction) * operatorPerformance / 92, 52, 116))
    const quality = roundKpi(clampValue(100 - baseWasteRate * 1.3 - (qualityResult === 'FAIL' ? 7 : qualityResult === 'CONDITIONAL' ? 3 : 0) - (haccpResult === 'FAIL' ? 5 : 0), 66, 99))
    const efficiency = roundKpi(clampValue(percent(actualProduction, plannedProduction), 55, 112))
    const oee = roundKpi(availability * performance * quality / 10000)
    const capacityUtilization = roundKpi(clampValue(percent(actualProduction, Math.max(1, line.capacity)), 15, 100))
    const status = getStatus(efficiency, oee, haccpResult === 'FAIL' ? 1 : 0)

    return {
      id: `weekly-daily-${weekStart}-${index + 1}`,
      date,
      weekStart,
      weekEnd,
      weekLabel: createWeekLabel(weekStart, weekEnd),
      workOrderNo: `WO-WA-${String(index % 150 + 1).padStart(4, '0')}`,
      branchId,
      branchName: getBranchName(sourceData, branchId),
      productId: product.id,
      productName: product.name,
      recipeId: recipe.id,
      recipeCode: recipe.code,
      recipeName: recipe.name,
      workCenter: line.workCenter,
      lineId: line.id,
      lineName: line.name,
      machineId: machine.id,
      machineCode: machine.code,
      machineName: machine.name,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorTitle: operator.title,
      shift,
      plannedProduction,
      actualProduction,
      waste,
      wasteReason: wasteRecord?.wasteReason || WASTE_REASONS[index % WASTE_REASONS.length],
      downtimeMinutes,
      machineUtilization: roundKpi(clampValue(percent(actualProduction, machine.capacityPerHour * 8), 12, 100)),
      operatorPerformance,
      availability,
      performance,
      quality,
      efficiency,
      oee,
      capacityUtilization,
      qualityResult,
      haccpResult,
      unit: product.unit || 'kg',
      status
    }
  })
}

const mostFrequent = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string,
  getLabel: (record: TRecord) => string
) => {
  const rows = records.reduce<Map<string, { label: string; count: number }>>((map, record) => {
    const key = getKey(record)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(record),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())
  return Array.from(rows.entries()).sort((first, second) => second[1].count - first[1].count)[0]
}

const createWasteReasons = (records: WeeklyDailyRecord[]) => Array.from(records.reduce<Map<string, number>>((map, record) => {
  map.set(record.wasteReason, roundKpi((map.get(record.wasteReason) || 0) + record.waste))
  return map
}, new Map()).entries())
  .map(([reason, quantity]) => ({ reason, quantity }))
  .sort((first, second) => second.quantity - first.quantity)
  .slice(0, 5)

const createWeeklyRecords = (
  dailyRecords: WeeklyDailyRecord[],
  sourceData: KpiSourceData
): WeeklyProductionRecord[] => {
  const alerts = CriticalAlertService.evaluate(sourceData, [], 'Haftalık Üretim Analizi')
  const weekGroups = dailyRecords.reduce<Map<string, WeeklyDailyRecord[]>>((map, record) => {
    map.set(record.weekStart, [...(map.get(record.weekStart) || []), record])
    return map
  }, new Map())

  return Array.from(weekGroups.entries())
    .sort((first, second) => second[0].localeCompare(first[0]))
    .slice(0, WEEKLY_RECORD_COUNT)
    .map(([weekStart, records]) => {
      const weekEnd = records[0]?.weekEnd || toDateKey(getWeekEnd(new Date(`${weekStart}T12:00:00`)))
      const product = mostFrequent(records, record => record.productId, record => record.productName)
      const recipe = mostFrequent(records, record => record.recipeId, record => `${record.recipeCode}|${record.recipeName}`)
      const branch = mostFrequent(records, record => record.branchId, record => record.branchName)
      const workCenter = mostFrequent(records, record => record.workCenter, record => record.workCenter)
      const line = mostFrequent(records, record => record.lineId, record => record.lineName)
      const machine = mostFrequent(records, record => record.machineId, record => `${record.machineCode}|${record.machineName}`)
      const operator = mostFrequent(records, record => record.operatorId, record => record.operatorName)
      const shift = mostFrequent(records, record => record.shift, record => record.shift)
      const plannedProduction = sumBy(records, record => record.plannedProduction)
      const actualProduction = sumBy(records, record => record.actualProduction)
      const waste = sumBy(records, record => record.waste)
      const efficiency = percent(actualProduction, plannedProduction)
      const oee = averageBy(records, record => record.oee)
      const haccpFailCount = records.filter(record => record.haccpResult === 'FAIL').length
      const weekAlerts = alerts.filter(alert => alert.createdAt.slice(0, 10) >= weekStart && alert.createdAt.slice(0, 10) <= weekEnd)
      const recipeParts = (recipe?.[1].label || '').split('|')
      const machineParts = (machine?.[1].label || '').split('|')

      return {
        id: `weekly-production-${weekStart}`,
        week: createWeekLabel(weekStart, weekEnd),
        weekStart,
        weekEnd,
        branchId: branch?.[0] || '',
        branchName: branch?.[1].label || 'Merkez',
        productId: product?.[0] || '',
        productName: product?.[1].label || 'Ürün',
        recipeId: recipe?.[0] || '',
        recipeCode: recipeParts[0] || '',
        recipeName: recipeParts[1] || recipeParts[0] || 'Reçete',
        workCenter: workCenter?.[1].label || 'Genel',
        lineId: line?.[0] || '',
        lineName: line?.[1].label || 'Hat',
        machineId: machine?.[0] || '',
        machineCode: machineParts[0] || '',
        machineName: machineParts[1] || machineParts[0] || 'Makine',
        operatorId: operator?.[0] || '',
        operatorName: operator?.[1].label || 'Operatör',
        shift: (shift?.[1].label || 'Sabah') as WeeklyProductionShift,
        plannedProduction,
        actualProduction,
        waste,
        wasteRate: percent(waste, actualProduction + waste),
        efficiency,
        oee,
        capacityUtilization: averageBy(records, record => record.capacityUtilization),
        downtimeMinutes: sumBy(records, record => record.downtimeMinutes),
        completedWorkOrders: new Set(records.map(record => record.workOrderNo)).size,
        qualityPassCount: records.filter(record => record.qualityResult === 'PASS').length,
        qualityFailCount: records.filter(record => record.qualityResult === 'FAIL').length,
        haccpFailCount,
        criticalAlertCount: weekAlerts.filter(alert => alert.level === 'CRITICAL' || alert.level === 'HIGH').length,
        status: getStatus(efficiency, oee, haccpFailCount),
        unit: records[0]?.unit || 'kg',
        sourceDailyIds: records.map(record => record.id),
        wasteReasons: createWasteReasons(records)
      }
    })
}

const createModel = (): WeeklyModel => {
  const sourceData = loadKpiSourceData()
  const dailyRecords = createDailyRecords(sourceData)
  return {
    sourceData,
    dailyRecords,
    weeklyRecords: createWeeklyRecords(dailyRecords, sourceData),
    generatedAt: new Date().toISOString()
  }
}

const matchesWeeklyFilter = (record: WeeklyProductionRecord, filters: WeeklyProductionFilters) => {
  const search = normalizeSearchText(filters.search)
  const matchesSearch = !search || [
    record.week,
    record.productName,
    record.recipeName,
    record.workCenter,
    record.lineName,
    record.machineCode,
    record.machineName,
    record.operatorName,
    record.branchName,
    record.status
  ].some(value => normalizeSearchText(value).includes(search))

  return matchesSearch
    && (!filters.startDate || record.weekEnd >= filters.startDate)
    && (!filters.endDate || record.weekStart <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.workCenter === ALL_FILTER || record.workCenter === filters.workCenter)
    && (filters.lineId === ALL_FILTER || record.lineId === filters.lineId)
    && (filters.machineId === ALL_FILTER || record.machineId === filters.machineId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.operatorId === ALL_FILTER || record.operatorId === filters.operatorId)
    && (filters.recipeId === ALL_FILTER || record.recipeId === filters.recipeId)
    && (filters.shift === ALL_FILTER || record.shift === filters.shift)
}

const matchesDailyFilter = (record: WeeklyDailyRecord, filters: WeeklyProductionFilters) => {
  const search = normalizeSearchText(filters.search)
  const matchesSearch = !search || [
    record.workOrderNo,
    record.productName,
    record.recipeName,
    record.lineName,
    record.machineCode,
    record.machineName,
    record.operatorName,
    record.branchName,
    record.shift
  ].some(value => normalizeSearchText(value).includes(search))

  return matchesSearch
    && (!filters.startDate || record.date >= filters.startDate)
    && (!filters.endDate || record.date <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.workCenter === ALL_FILTER || record.workCenter === filters.workCenter)
    && (filters.lineId === ALL_FILTER || record.lineId === filters.lineId)
    && (filters.machineId === ALL_FILTER || record.machineId === filters.machineId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.operatorId === ALL_FILTER || record.operatorId === filters.operatorId)
    && (filters.recipeId === ALL_FILTER || record.recipeId === filters.recipeId)
    && (filters.shift === ALL_FILTER || record.shift === filters.shift)
}

const createKpis = (
  weeklyRecords: WeeklyProductionRecord[],
  dailyRecords: WeeklyDailyRecord[]
): WeeklyKpi[] => {
  const totalProduction = sumBy(weeklyRecords, record => record.actualProduction)
  const completedWorkOrders = sumBy(weeklyRecords, record => record.completedWorkOrders)
  const distinctDays = new Set(dailyRecords.map(record => record.date)).size
  const averageDailyProduction = distinctDays > 0 ? roundKpi(totalProduction / distinctDays) : 0
  const averageOee = averageBy(weeklyRecords, record => record.oee)
  const waste = sumBy(weeklyRecords, record => record.waste)
  const wasteRate = percent(waste, totalProduction + waste)
  const productivityScore = roundKpi((averageBy(weeklyRecords, record => record.efficiency) * 0.45) + (averageOee * 0.35) + (averageBy(weeklyRecords, record => record.capacityUtilization) * 0.2))

  return [
    {
      id: 'weekly-total-production',
      label: 'Haftalık Toplam Üretim',
      value: `${formatNumber(totalProduction, 1)} birim`,
      detail: `${formatNumber(weeklyRecords.length)} hafta kaydı`,
      tone: totalProduction > 0 ? 'success' : 'warning'
    },
    {
      id: 'completed-work-orders',
      label: 'Tamamlanan İş Emirleri',
      value: formatNumber(completedWorkOrders),
      detail: `${formatNumber(new Set(dailyRecords.map(record => record.workOrderNo)).size)} benzersiz iş emri`,
      tone: completedWorkOrders > 0 ? 'success' : 'neutral'
    },
    {
      id: 'average-daily-production',
      label: 'Ortalama Günlük Üretim',
      value: `${formatNumber(averageDailyProduction, 1)} birim`,
      detail: `${formatNumber(distinctDays)} üretim günü`,
      tone: averageDailyProduction > 0 ? 'success' : 'warning'
    },
    {
      id: 'average-oee',
      label: 'Ortalama OEE',
      value: formatPercent(averageOee),
      detail: 'Availability x Performance x Quality',
      tone: averageOee >= 75 ? 'success' : averageOee >= 60 ? 'warning' : 'danger'
    },
    {
      id: 'weekly-waste-rate',
      label: 'Haftalık Fire Oranı',
      value: formatPercent(wasteRate),
      detail: `${formatNumber(waste, 1)} birim fire`,
      tone: wasteRate >= 7 ? 'danger' : wasteRate >= 4 ? 'warning' : 'success'
    },
    {
      id: 'weekly-productivity-score',
      label: 'Haftalık Verimlilik Skoru',
      value: formatPercent(productivityScore),
      detail: 'Verim, OEE ve kapasite bileşik skoru',
      tone: productivityScore >= 82 ? 'success' : productivityScore >= 68 ? 'warning' : 'danger'
    }
  ]
}

const aggregateRows = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string,
  getLabel: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  formatter: (value: number) => string,
  detail: string,
  limit = 8
): BarChartRow[] => {
  const map = records.reduce<Map<string, { label: string; value: number; count: number }>>((rows, record) => {
    const key = getKey(record)
    if(!key) return rows
    const previous = rows.get(key)
    rows.set(key, {
      label: previous?.label || getLabel(record),
      value: roundKpi((previous?.value || 0) + clampValue(getValue(record))),
      count: (previous?.count || 0) + 1
    })
    return rows
  }, new Map())

  return Array.from(map.entries())
    .sort((first, second) => second[1].value - first[1].value || first[1].label.localeCompare(second[1].label, 'tr-TR'))
    .slice(0, limit)
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: row.value,
      formattedValue: formatter(row.value),
      detail: `${formatNumber(row.count)} kayıt / ${detail}`
    }))
}

const averageRows = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string,
  getLabel: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  formatter: (value: number) => string,
  detail: string,
  limit = 8
): BarChartRow[] => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((rows, record) => {
    const key = getKey(record)
    if(!key) return rows
    const previous = rows.get(key)
    rows.set(key, {
      label: previous?.label || getLabel(record),
      total: roundKpi((previous?.total || 0) + clampValue(getValue(record))),
      count: (previous?.count || 0) + 1
    })
    return rows
  }, new Map())

  return Array.from(map.entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: roundKpi(row.count > 0 ? row.total / row.count : 0),
      formattedValue: formatter(row.count > 0 ? row.total / row.count : 0),
      detail: `${formatNumber(row.count)} kayıt / ${detail}`
    }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, limit)
}

const createDayRows = (records: WeeklyDailyRecord[]) => (
  aggregateRows(records, record => record.date, record => formatDate(record.date), record => record.actualProduction, value => `${formatNumber(value, 1)} birim`, 'gün bazlı üretim', 14)
    .sort((first, second) => first.id.localeCompare(second.id))
)

const createWasteRows = (records: WeeklyDailyRecord[]) => (
  aggregateRows(records, record => record.wasteReason, record => record.wasteReason, record => record.waste, value => `${formatNumber(value, 1)} birim`, 'fire')
)

const createOeeTrendRows = (records: WeeklyProductionRecord[]) => (
  records
    .slice()
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart))
    .slice(-12)
    .map(record => ({
      id: record.id,
      label: record.weekStart.slice(5),
      value: record.oee,
      formattedValue: formatPercent(record.oee),
      detail: record.week
    }))
)

const createCapacityRows = (records: WeeklyProductionRecord[]) => (
  records
    .slice()
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart))
    .slice(-12)
    .map(record => ({
      id: `${record.id}-capacity`,
      label: record.weekStart.slice(5),
      value: record.capacityUtilization,
      formattedValue: formatPercent(record.capacityUtilization),
      detail: 'Haftalık kapasite kullanımı'
    }))
)

const createChartGroups = (
  weeklyRecords: WeeklyProductionRecord[],
  dailyRecords: WeeklyDailyRecord[]
) => [
  { id: 'day-production', title: 'Gün Bazlı Üretim', rows: createDayRows(dailyRecords) },
  {
    id: 'line-production',
    title: 'Hat Bazlı Üretim',
    rows: aggregateRows(weeklyRecords, record => record.lineId, record => record.lineName, record => record.actualProduction, value => `${formatNumber(value, 1)} birim`, 'üretim')
  },
  {
    id: 'machine-utilization',
    title: 'Makine Kullanım Oranı',
    rows: averageRows(dailyRecords, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`, record => record.machineUtilization, formatPercent, 'ortalama kullanım')
  },
  {
    id: 'operator-performance',
    title: 'Operatör Performansı',
    rows: averageRows(dailyRecords, record => record.operatorId, record => record.operatorName, record => record.operatorPerformance, formatPercent, 'ortalama performans')
  },
  { id: 'waste-analysis', title: 'Fire Analizi', rows: createWasteRows(dailyRecords) },
  { id: 'oee-trend', title: 'OEE Trendi', rows: createOeeTrendRows(weeklyRecords) },
  { id: 'capacity-utilization', title: 'Haftalık Kapasite Kullanımı', rows: createCapacityRows(weeklyRecords) },
  {
    id: 'product-production',
    title: 'Ürün Bazlı Üretim',
    rows: aggregateRows(weeklyRecords, record => record.productId, record => record.productName, record => record.actualProduction, value => `${formatNumber(value, 1)} birim`, 'üretim')
  }
]

const createOptions = <TRecord,>(
  records: TRecord[],
  getId: (record: TRecord) => string,
  getLabel: (record: TRecord) => string
) => Array.from(new Map(records.map(record => [getId(record), getLabel(record)])))
  .filter(([id]) => Boolean(id))
  .map(([id, label]) => ({ id, label }))
  .sort((first, second) => first.label.localeCompare(second.label, 'tr-TR'))

const mapRowsForOutput = (rows: WeeklyProductionRecord[]) => rows.map(row => ({
  Hafta: row.week,
  Ürün: row.productName,
  Reçete: row.recipeName,
  Şube: row.branchName,
  'Üretim Merkezi': row.workCenter,
  Hat: row.lineName,
  Makine: `${row.machineCode} / ${row.machineName}`,
  Operatör: row.operatorName,
  Vardiya: row.shift,
  'Planlanan Üretim': `${formatNumber(row.plannedProduction, 1)} ${row.unit}`,
  'Gerçekleşen Üretim': `${formatNumber(row.actualProduction, 1)} ${row.unit}`,
  Fire: `${formatNumber(row.waste, 1)} ${row.unit}`,
  Verim: formatPercent(row.efficiency),
  OEE: formatPercent(row.oee),
  Durum: row.status
}))

const exportFilteredRows = (rows: WeeklyProductionRecord[]) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'production-planning',
    moduleLabel: 'Haftalik Uretim Analizi',
    sheetName: 'Haftalık Üretim',
    fileNamePrefix: 'haftalik-uretim-analizi-filtreli',
    fileName: `haftalik-uretim-analizi-filtreli-${toDateKey(new Date())}.xlsx`,
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const escapeHtml = (value: unknown) => normalizeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const openPrintWindow = (
  rows: WeeklyProductionRecord[],
  kpis: WeeklyKpi[],
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if(!printWindow) return
  const kpiHtml = kpis.map(kpi => `
    <article>
      <span>${escapeHtml(kpi.label)}</span>
      <strong>${escapeHtml(kpi.value)}</strong>
      <small>${escapeHtml(kpi.detail)}</small>
    </article>
  `).join('')
  const tableRows = rows.slice(0, 80).map(row => `
    <tr>
      <td>${escapeHtml(row.week)}</td>
      <td>${escapeHtml(row.productName)}</td>
      <td>${escapeHtml(row.lineName)}</td>
      <td>${escapeHtml(row.machineCode)}</td>
      <td>${escapeHtml(row.operatorName)}</td>
      <td>${escapeHtml(formatNumber(row.actualProduction, 1))} ${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(formatNumber(row.waste, 1))} ${escapeHtml(row.unit)}</td>
      <td>${escapeHtml(formatPercent(row.efficiency))}</td>
      <td>${escapeHtml(formatPercent(row.oee))}</td>
      <td>${escapeHtml(row.status)}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Haftalık Üretim Analizi ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:28px; color:#0f172a; font-family:Arial, sans-serif; background:#fff; }
          h1 { margin:0; font-size:24px; }
          p { margin:6px 0 18px; color:#475569; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; }
          article { border:1px solid #cbd5e1; border-radius:8px; padding:12px; page-break-inside:avoid; }
          article span, article small { display:block; color:#475569; font-size:12px; font-weight:700; }
          article strong { display:block; margin:6px 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:11px; }
          th, td { border:1px solid #cbd5e1; padding:7px; text-align:left; vertical-align:top; }
          th { background:#f8fafc; }
          @media print { body { padding:16px; } }
        </style>
      </head>
      <body>
        <h1>Haftalık Üretim Analizi</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Hafta</th><th>Ürün</th><th>Hat</th><th>Makine</th><th>Operatör</th><th>Üretim</th><th>Fire</th><th>Verim</th><th>OEE</th><th>Durum</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="10">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

const createWeekDetail = (
  selectedRecord: WeeklyProductionRecord | undefined,
  weeklyRecords: WeeklyProductionRecord[],
  dailyRecords: WeeklyDailyRecord[]
) => {
  if(!selectedRecord) return null
  const weekRows = weeklyRecords.filter(record => record.weekStart === selectedRecord.weekStart)
  const weekDailyRows = dailyRecords.filter(record => record.weekStart === selectedRecord.weekStart)
  const bestLine = averageRows(weekDailyRows, record => record.lineId, record => record.lineName, record => record.efficiency, formatPercent, 'verim', 1)[0]
  const bestMachine = averageRows(weekDailyRows, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`, record => record.machineUtilization, formatPercent, 'kullanım', 1)[0]
  const bestOperator = averageRows(weekDailyRows, record => record.operatorId, record => record.operatorName, record => record.operatorPerformance, formatPercent, 'performans', 1)[0]
  const wasteReasons = createWasteReasons(weekDailyRows)
  const qualityPass = weekDailyRows.filter(record => record.qualityResult === 'PASS').length
  const qualityConditional = weekDailyRows.filter(record => record.qualityResult === 'CONDITIONAL').length
  const qualityFail = weekDailyRows.filter(record => record.qualityResult === 'FAIL').length
  const haccpFail = weekDailyRows.filter(record => record.haccpResult === 'FAIL').length
  const criticalWarnings = [
    ...weekRows.filter(record => record.status === 'Kritik').map(record => `${record.productName} için kritik OEE/verim sinyali.`),
    ...weekRows.filter(record => record.criticalAlertCount > 0).map(record => `${record.criticalAlertCount} kritik karar destek alarmı izlendi.`),
    ...weekRows.filter(record => record.wasteRate >= 7).map(record => `${record.productName} fire oranı ${formatPercent(record.wasteRate)}.`)
  ].slice(0, 6)

  return {
    bestLine,
    bestMachine,
    bestOperator,
    wasteReasons,
    qualityPass,
    qualityConditional,
    qualityFail,
    haccpFail,
    criticalWarnings,
    weeklyProduction: sumBy(weekRows, record => record.actualProduction),
    weeklyPlanned: sumBy(weekRows, record => record.plannedProduction),
    weeklyWaste: sumBy(weekRows, record => record.waste),
    averageOee: averageBy(weekRows, record => record.oee),
    averageEfficiency: averageBy(weekRows, record => record.efficiency),
    completedWorkOrders: sumBy(weekRows, record => record.completedWorkOrders),
    downtimeMinutes: sumBy(weekRows, record => record.downtimeMinutes)
  }
}

export default function WeeklyProductionAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<WeeklyProductionFilters>(() => createDefaultFilters())
  const [selectedId, setSelectedId] = React.useState('')
  const filteredWeeklyRecords = React.useMemo(
    () => model.weeklyRecords.filter(record => matchesWeeklyFilter(record, filters)),
    [filters, model.weeklyRecords]
  )
  const filteredDailyRecords = React.useMemo(
    () => model.dailyRecords.filter(record => matchesDailyFilter(record, filters)),
    [filters, model.dailyRecords]
  )
  const selectedRecord = filteredWeeklyRecords.find(record => record.id === selectedId) || filteredWeeklyRecords[0]
  const weekDetail = React.useMemo(
    () => createWeekDetail(selectedRecord, filteredWeeklyRecords, filteredDailyRecords),
    [filteredDailyRecords, filteredWeeklyRecords, selectedRecord]
  )
  const kpis = React.useMemo(() => createKpis(filteredWeeklyRecords, filteredDailyRecords), [filteredDailyRecords, filteredWeeklyRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredWeeklyRecords, filteredDailyRecords), [filteredDailyRecords, filteredWeeklyRecords])
  const branchOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.branchId, record => record.branchName), [model.weeklyRecords])
  const workCenterOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.workCenter, record => record.workCenter), [model.weeklyRecords])
  const lineOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.lineId, record => record.lineName), [model.weeklyRecords])
  const machineOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`), [model.weeklyRecords])
  const productOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.productId, record => record.productName), [model.weeklyRecords])
  const recipeOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.recipeId, record => `${record.recipeCode} / ${record.recipeName}`), [model.weeklyRecords])
  const operatorOptions = React.useMemo(() => createOptions(model.weeklyRecords, record => record.operatorId, record => record.operatorName), [model.weeklyRecords])

  const updateFilter = <TKey extends keyof WeeklyProductionFilters>(key: TKey, value: WeeklyProductionFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page weekly-production-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Haftalık Üretim Analizi</h2>
          <p className="muted">Günlük üretim kayıtları, üretim emirleri, hat, makine, operatör, vardiya, fire, lot, kalite ve HACCP sonuçlarından haftalık performans analizi üretir.</p>
        </div>
        <div className="daily-production-actions">
          <button className="btn" type="button" onClick={() => exportFilteredRows(filteredWeeklyRecords)}>Filtreli Excel</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredWeeklyRecords, kpis, 'PDF')}>Filtreli PDF</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredWeeklyRecords, kpis, 'PRINT')}>Filtreli Yazdır</button>
        </div>
      </div>

      <div className="daily-production-meta">
        <span>Analiz: {formatDateTime(model.generatedAt)}</span>
        <span>Kullanıcı: {currentUser.fullName || currentUser.username}</span>
        <span>{formatNumber(model.weeklyRecords.length)} haftalık kayıt / {formatNumber(model.dailyRecords.length)} günlük kaynak kayıt</span>
      </div>

      <div className="metric-grid daily-production-metric-grid">
        {kpis.map(kpi => (
          <div className={`metric-card kpi-card daily-production-metric ${kpi.tone}`} key={kpi.id}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.detail}</small>
          </div>
        ))}
      </div>

      <section className="card daily-production-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredWeeklyRecords.length)} haftalık kayıt listeleniyor. Bu ekran üretim planı, stok veya muhasebe kaydı oluşturmaz.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters())}>Reset</button>
        </div>
        <div className="daily-production-filter-grid">
          <label className="form-field">
            <span>Başlangıç Tarihi</span>
            <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitiş Tarihi</span>
            <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          <FilterSelect label="Şube" value={filters.branchId} options={branchOptions} onChange={value => updateFilter('branchId', value)} />
          <FilterSelect label="Üretim Merkezi" value={filters.workCenter} options={workCenterOptions} onChange={value => updateFilter('workCenter', value)} />
          <FilterSelect label="Hat" value={filters.lineId} options={lineOptions} onChange={value => updateFilter('lineId', value)} />
          <FilterSelect label="Makine" value={filters.machineId} options={machineOptions} onChange={value => updateFilter('machineId', value)} />
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Operatör" value={filters.operatorId} options={operatorOptions} onChange={value => updateFilter('operatorId', value)} />
          <FilterSelect label="Reçete" value={filters.recipeId} options={recipeOptions} onChange={value => updateFilter('recipeId', value)} />
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value as WeeklyProductionFilters['shift'])}>
              <option value={ALL_FILTER}>Tüm Vardiyalar</option>
              {SHIFT_OPTIONS.map(shift => <option value={shift} key={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Hafta, ürün, reçete, hat, makine, operatör..." />
          </label>
        </div>
      </section>

      <section className="daily-production-chart-grid">
        {chartGroups.map(chart => <BarChartCard key={chart.id} title={chart.title} rows={chart.rows} />)}
      </section>

      <section className="daily-production-layout split-layout">
        <div className="card table-card daily-production-table-wrap">
          <div className="section-header compact">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Hafta, ürün, reçete, üretim merkezi, hat, makine, operatör, üretim, fire, verim ve OEE detayları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table weekly-production-table">
              <thead>
                <tr>
                  <th>Hafta</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Üretim Merkezi</th>
                  <th>Hat</th>
                  <th>Makine</th>
                  <th>Operatör</th>
                  <th>Planlanan Üretim</th>
                  <th>Gerçekleşen Üretim</th>
                  <th>Fire</th>
                  <th>Verim</th>
                  <th>OEE</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredWeeklyRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={13}>Filtrelere uygun haftalık üretim kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredWeeklyRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Hafta"><strong>{record.week}</strong><span>{formatNumber(record.completedWorkOrders)} iş emri</span></td>
                    <td data-label="Ürün"><strong>{record.productName}</strong><span>{record.branchName}</span></td>
                    <td data-label="Reçete">{record.recipeName}</td>
                    <td data-label="Üretim Merkezi">{record.workCenter}</td>
                    <td data-label="Hat">{record.lineName}</td>
                    <td data-label="Makine"><strong>{record.machineCode}</strong><span>{record.machineName}</span></td>
                    <td data-label="Operatör">{record.operatorName}</td>
                    <td data-label="Planlanan Üretim">{formatNumber(record.plannedProduction, 1)} {record.unit}</td>
                    <td data-label="Gerçekleşen Üretim">{formatNumber(record.actualProduction, 1)} {record.unit}</td>
                    <td data-label="Fire">{formatNumber(record.waste, 1)} {record.unit}</td>
                    <td data-label="Verim"><span className={`status-pill ${record.efficiency >= 88 ? 'success' : record.efficiency >= 76 ? 'warning' : 'danger'}`}>{formatPercent(record.efficiency)}</span></td>
                    <td data-label="OEE"><span className={`status-pill ${record.oee >= 75 ? 'success' : record.oee >= 60 ? 'warning' : 'danger'}`}>{formatPercent(record.oee)}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${record.status === 'Hedef Üstü' || record.status === 'Plan Dahilinde' ? 'success' : record.status === 'Riskli' ? 'warning' : 'danger'}`}>{record.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <WeeklyDetailPanel detail={weekDetail} record={selectedRecord} />
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string
  value: string
  options: Array<{ id: string; label: string }>
  onChange: (value: string) => void
}){
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value={ALL_FILTER}>Tümü</option>
        {options.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
      </select>
    </label>
  )
}

function BarChartCard({
  rows,
  title
}: {
  rows: BarChartRow[]
  title: string
}){
  const chartValues = rows.map(row => Math.max(0, toFiniteNumber(row.value)))
  const maxValue = Math.max(1, ...chartValues)

  return (
    <section className="card kpi-chart-card daily-production-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kırılım</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayıt bulunamadı.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (Math.max(0, toFiniteNumber(row.value)) / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function WeeklyDetailPanel({
  detail,
  record
}: {
  detail: ReturnType<typeof createWeekDetail>
  record?: WeeklyProductionRecord
}){
  if(!record || !detail){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-cell">Detay için bir hafta seçin.</div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Sağ Panel</h3>
            <p className="muted">{record.week}</p>
          </div>
          <span className={`status-pill ${record.status === 'Hedef Üstü' || record.status === 'Plan Dahilinde' ? 'success' : record.status === 'Riskli' ? 'warning' : 'danger'}`}>{record.status}</span>
        </div>
        <div className="daily-production-detail-grid">
          <div><span>Haftalık Üretim Özeti</span><strong>{formatNumber(detail.weeklyProduction, 1)} {record.unit}</strong><small>Plan: {formatNumber(detail.weeklyPlanned, 1)} {record.unit}</small></div>
          <div><span>Tamamlanan İş Emirleri</span><strong>{formatNumber(detail.completedWorkOrders)}</strong><small>Duruş: {formatMinutes(detail.downtimeMinutes)}</small></div>
          <div><span>Ortalama Verim</span><strong>{formatPercent(detail.averageEfficiency)}</strong><small>OEE: {formatPercent(detail.averageOee)}</small></div>
          <div><span>Haftalık Fire</span><strong>{formatNumber(detail.weeklyWaste, 1)} {record.unit}</strong><small>{formatPercent(percent(detail.weeklyWaste, detail.weeklyProduction + detail.weeklyWaste))}</small></div>
          <div><span>En Verimli Hat</span><strong>{detail.bestLine?.label || '-'}</strong><small>{detail.bestLine?.formattedValue || '-'}</small></div>
          <div><span>En Verimli Makine</span><strong>{detail.bestMachine?.label || '-'}</strong><small>{detail.bestMachine?.formattedValue || '-'}</small></div>
          <div><span>En Verimli Operatör</span><strong>{detail.bestOperator?.label || '-'}</strong><small>{detail.bestOperator?.formattedValue || '-'}</small></div>
          <div><span>HACCP Durumu</span><strong>{detail.haccpFail > 0 ? 'Uygunsuzluk Var' : 'Uygun'}</strong><small>{formatNumber(detail.haccpFail)} kritik sapma</small></div>
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Fire Sebepleri</h3>
            <p className="muted">Haftalık fire kırılımı.</p>
          </div>
        </div>
        <div className="daily-production-module-list">
          {detail.wasteReasons.length === 0 && <div className="empty-cell">Fire kaydı bulunamadı.</div>}
          {detail.wasteReasons.map(reason => (
            <div key={reason.reason}>
              <strong>{reason.reason}</strong>
              <span>{formatNumber(reason.quantity, 1)} {record.unit}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Kalite, HACCP ve Kritik Uyarılar</h3>
            <p className="muted">Seçilen haftanın kalite karar destek sinyalleri.</p>
          </div>
        </div>
        <div className="daily-production-module-list">
          <div>
            <strong>Kalite Sonuçları</strong>
            <span>{formatQualityResult('PASS')}: {formatNumber(detail.qualityPass)} / {formatQualityResult('CONDITIONAL')}: {formatNumber(detail.qualityConditional)} / {formatQualityResult('FAIL')}: {formatNumber(detail.qualityFail)}</span>
          </div>
          <div>
            <strong>HACCP Durumu</strong>
            <span>{detail.haccpFail > 0 ? `${formatNumber(detail.haccpFail)} uygunsuz kritik kontrol sonucu` : formatHaccpResult('PASS')}</span>
          </div>
          <div>
            <strong>Kritik Uyarılar</strong>
            {detail.criticalWarnings.length === 0 && <span>Kritik uyarı bulunmuyor.</span>}
            {detail.criticalWarnings.map((warning, index) => <span key={`${warning}-${index}`}>{warning}</span>)}
          </div>
        </div>
      </section>
    </aside>
  )
}
