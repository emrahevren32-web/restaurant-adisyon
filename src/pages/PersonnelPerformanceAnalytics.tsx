import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  addDays,
  averageBy,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { QualityFormService } from '../quality-forms/quality-form.service'
import type { QualityForm } from '../quality-forms/quality-form.types'
import {
  loadAttendances,
  loadEmployeeAudits,
  loadEmployeePerformances,
  loadEmployees,
  loadShifts
} from '../storage'
import type {
  Attendance,
  Employee,
  EmployeeAudit,
  EmployeePerformance,
  Shift,
  User
} from '../types'
import { WasteService } from '../waste-management/waste.service'
import type { WasteRecord } from '../waste-management/waste.types'

type PersonnelRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type PersonnelPerformanceBand = 'Yüksek' | 'Orta' | 'Düşük'
type PersonnelShiftName = 'Sabah' | 'Akşam' | 'Gece' | 'Tam Gün'

type PersonnelPerformanceFilters = {
  startDate: string
  endDate: string
  branchId: string
  department: string
  position: string
  employeeId: string
  shift: PersonnelShiftName | 'all'
  risk: PersonnelRisk | 'all'
  performance: PersonnelPerformanceBand | 'all'
  search: string
}

type OptionItem = {
  id: string
  name: string
}

type PersonnelOption = {
  id: string
  code: string
  fullName: string
  branchId: string
  branchName: string
  department: string
  position: string
  startDate: string
  isActive: boolean
}

type PersonnelTrainingRecord = {
  id: string
  title: string
  status: 'Tamamlandı' | 'Planlandı' | 'Gecikti'
  score: number
  completedAt: string
}

type PersonnelHistoryItem = {
  id: string
  label: string
  detail: string
  date: string
}

type PersonnelPerformanceRecord = {
  id: string
  date: string
  employeeId: string
  employeeName: string
  personnelCode: string
  branchId: string
  branchName: string
  department: string
  position: string
  shift: PersonnelShiftName
  productionOrderCount: number
  completedJobCount: number
  wasteRate: number
  wasteQuantityKg: number
  qualitySuccessRate: number
  qualityRecordCount: number
  averageProductionMinutes: number
  overtimeHours: number
  absenteeismDays: number
  productivityScore: number
  performanceScore: number
  performanceBand: PersonnelPerformanceBand
  risk: PersonnelRisk
  riskScore: number
  haccpPassRate: number
  machineUtilization: number
  trainingScore: number
  trainingRecords: PersonnelTrainingRecord[]
  productionHistory: PersonnelHistoryItem[]
  completedJobs: PersonnelHistoryItem[]
  qualityResults: PersonnelHistoryItem[]
  haccpHistory: PersonnelHistoryItem[]
  wasteAnalysis: PersonnelHistoryItem[]
  developmentSuggestions: string[]
  sourceSummary: string
}

type PersonnelPerformanceKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type PersonnelPerformanceModel = {
  sourceData: KpiSourceData
  employees: PersonnelOption[]
  shifts: Shift[]
  attendances: Attendance[]
  employeePerformances: EmployeePerformance[]
  employeeAudits: EmployeeAudit[]
  qualityForms: QualityForm[]
  wasteRecords: WasteRecord[]
  decisionSuggestions: DecisionSuggestion[]
  records: PersonnelPerformanceRecord[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const RECORD_COUNT = 500
const EMPLOYEE_COUNT = 80
const PRODUCTION_ORDER_COUNT = 200
const DEPARTMENT_COUNT = 12
const SHIFT_COUNT = 4
const QUALITY_RECORD_COUNT = 300
const WASTE_RECORD_COUNT = 250
const TRAINING_RECORD_COUNT = 150

const RISK_LABELS: Record<PersonnelRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

const PERFORMANCE_OPTIONS: PersonnelPerformanceBand[] = ['Yüksek', 'Orta', 'Düşük']
const SHIFT_OPTIONS: PersonnelShiftName[] = ['Sabah', 'Akşam', 'Gece', 'Tam Gün']

const DEPARTMENTS = [
  'Sıcak Mutfak',
  'Soğuk Mutfak',
  'Hazırlık',
  'Paketleme',
  'Sevkiyat Hazırlık',
  'Kalite',
  'Depo',
  'Mal Kabul',
  'Bakım',
  'Planlama',
  'Temizlik',
  'Operasyon Yönetimi'
]

const POSITIONS = [
  'Üretim Operatörü',
  'Hat Sorumlusu',
  'Makine Operatörü',
  'Paketleme Operatörü',
  'Kalite Kontrol Uzmanı',
  'Depo Elemanı',
  'Mal Kabul Sorumlusu',
  'Vardiya Amiri',
  'HACCP Kontrol Sorumlusu',
  'Hazırlık Personeli',
  'Sevkiyat Hazırlık Personeli',
  'Bakım Teknisyeni'
]

const PERSONNEL_NAMES = [
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
  'Buse Kaplan',
  'Okan Yalçın',
  'Seda Keskin',
  'Tuna Ergin',
  'İrem Doğan',
  'Burcu Yılmaz',
  'Kerem Uslu',
  'Nesrin Acar',
  'Ahmet Öztürk',
  'Deniz Korkmaz',
  'Gizem Taş',
  'Onur Bilgin',
  'Ceren Kurt',
  'Barış Eren',
  'Merve Aslan',
  'Serkan Tetik',
  'Yasemin Gür',
  'Tolga Altın'
]

const TRAINING_TITLES = [
  'HACCP Kritik Kontrol Noktaları',
  'Soğuk Zincir ve SKT Yönetimi',
  'Alerjen Farkındalığı',
  'Makine Güvenliği',
  'Fire Azaltma Teknikleri',
  'Hijyen ve Sanitasyon',
  'Lot İzlenebilirliği',
  'Verimli Hat Çalışması'
]

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(toFiniteNumber(value, min), min), max)

const toDateKey = (value: unknown, fallback = '') => {
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('sv-SE')
  const text = normalizeText(value)
  if(!text) return fallback
  if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value: unknown, fallback?: unknown) => {
  const parseCandidate = (candidate: unknown) => {
    if(candidate instanceof Date) return Number.isNaN(candidate.getTime()) ? null : candidate
    const text = normalizeText(candidate)
    if(!text) return null
    const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return parseCandidate(value) || parseCandidate(fallback)
}

const formatDate = (value: unknown) => {
  const date = parseSafeDate(value)
  return date ? date.toLocaleDateString('tr-TR') : '-'
}

const formatDateTime = (value: unknown) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '-'
}

const formatMinutes = (value: number) => `${formatNumber(value, 0)} dk`
const formatHours = (value: number) => `${formatNumber(value, 1)} saat`

const createUniqueOptions = (options: OptionItem[]) => {
  const seen = new Set<string>()
  return options
    .filter(option => option.id && option.name)
    .filter(option => {
      if(seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
    .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const safeList = <T,>(factory: () => T[]) => {
  try {
    return factory()
  } catch {
    return []
  }
}

const getBranch = (sourceData: KpiSourceData, branchId: string, index: number) => (
  sourceData.branches.find(branch => branch.id === branchId)
  || sourceData.branches[index % Math.max(sourceData.branches.length, 1)]
  || { id: `branch-${index + 1}`, name: `Şube ${index + 1}` }
)

const inferDepartment = (position: string, index: number) => {
  const normalized = normalizeSearchText(position)
  if(normalized.includes('kalite') || normalized.includes('haccp')) return 'Kalite'
  if(normalized.includes('depo')) return 'Depo'
  if(normalized.includes('paket')) return 'Paketleme'
  if(normalized.includes('sevkiyat')) return 'Sevkiyat Hazırlık'
  if(normalized.includes('makine') || normalized.includes('hat')) return 'Sıcak Mutfak'
  if(normalized.includes('bakım')) return 'Bakım'
  if(normalized.includes('hazırlık')) return 'Hazırlık'
  return DEPARTMENTS[index % DEPARTMENT_COUNT]
}

const normalizeShiftName = (value: unknown, index: number): PersonnelShiftName => {
  const text = normalizeSearchText(value)
  if(text.includes('ak')) return 'Akşam'
  if(text.includes('gece')) return 'Gece'
  if(text.includes('tam')) return 'Tam Gün'
  if(text.includes('sabah')) return 'Sabah'
  return SHIFT_OPTIONS[index % SHIFT_OPTIONS.length]
}

const createPersonnelPool = (
  sourceData: KpiSourceData,
  employees: Employee[]
): PersonnelOption[] => {
  const rows: PersonnelOption[] = employees.map((employee, index) => {
    const branch = getBranch(sourceData, employee.branchId, index)
    const position = employee.position || POSITIONS[index % POSITIONS.length]
    return {
      id: employee.id,
      code: employee.code || `SCL-${String(index + 1).padStart(4, '0')}`,
      fullName: employee.fullName,
      branchId: branch.id,
      branchName: branch.name,
      department: inferDepartment(position, index),
      position,
      startDate: employee.startDate || toDateKey(addDays(new Date(), -365 - index * 12)),
      isActive: employee.isActive
    }
  })

  Array.from({ length: EMPLOYEE_COUNT }).forEach((_, index) => {
    if(rows.length > index) return
    const branch = getBranch(sourceData, '', index)
    const position = POSITIONS[index % POSITIONS.length]
    rows.push({
      id: `personnel-performance-employee-${index + 1}`,
      code: `SCL-${String(index + 1).padStart(4, '0')}`,
      fullName: `${PERSONNEL_NAMES[index % PERSONNEL_NAMES.length]} ${Math.floor(index / PERSONNEL_NAMES.length) + 1}`,
      branchId: branch.id,
      branchName: branch.name,
      department: inferDepartment(position, index),
      position,
      startDate: toDateKey(addDays(new Date(), -240 - index * 9)),
      isActive: true
    })
  })

  return rows.slice(0, EMPLOYEE_COUNT)
}

const createTrainingRecords = (
  employee: PersonnelOption,
  index: number
): PersonnelTrainingRecord[] => (
  Array.from({ length: 2 + index % 3 }).map((_, trainingIndex) => {
    const score = clamp(72 + ((index + trainingIndex * 5) % 27), 45, 100)
    const status: PersonnelTrainingRecord['status'] = score < 70
      ? 'Gecikti'
      : trainingIndex === 0 || score > 84
        ? 'Tamamlandı'
        : 'Planlandı'
    return {
      id: `${employee.id}-training-${trainingIndex + 1}`,
      title: TRAINING_TITLES[(index + trainingIndex) % TRAINING_TITLES.length],
      status,
      score,
      completedAt: status === 'Tamamlandı' ? toDateKey(addDays(new Date(), -(index + trainingIndex * 11) % 120)) : ''
    }
  })
)

const getMatchingShift = (
  shifts: Shift[],
  employee: PersonnelOption,
  date: string,
  index: number
) => shifts.find(shift => shift.employeeId === employee.id && toDateKey(shift.workDate) === date)
  || shifts.find(shift => shift.employeeId === employee.id)
  || shifts[index % Math.max(shifts.length, 1)]

const getMatchingAttendance = (
  attendances: Attendance[],
  employee: PersonnelOption,
  date: string,
  index: number
) => attendances.find(attendance => attendance.employeeId === employee.id && toDateKey(attendance.workDate) === date)
  || attendances.find(attendance => attendance.employeeId === employee.id)
  || attendances[index % Math.max(attendances.length, 1)]

const getPerformanceRows = (
  performanceRows: EmployeePerformance[],
  employee: PersonnelOption
) => performanceRows.filter(performance => performance.employeeId === employee.id)

const getQualityRows = (
  qualityForms: QualityForm[],
  employee: PersonnelOption,
  index: number
) => {
  const matched = qualityForms.filter(form => normalizeSearchText(form.inspector).includes(normalizeSearchText(employee.fullName)))
  if(matched.length > 0) return matched
  const start = (index * 3) % Math.max(qualityForms.length, 1)
  return qualityForms.slice(start, start + 5)
}

const getWasteRows = (
  wasteRecords: WasteRecord[],
  employee: PersonnelOption,
  index: number
) => {
  const matched = wasteRecords.filter(record => normalizeSearchText(record.createdBy).includes(normalizeSearchText(employee.fullName)))
  if(matched.length > 0) return matched
  const start = (index * 5) % Math.max(wasteRecords.length, 1)
  return wasteRecords.slice(start, start + 4)
}

const createHistory = (
  employee: PersonnelOption,
  date: string,
  labelPrefix: string,
  count: number,
  index: number
): PersonnelHistoryItem[] => (
  Array.from({ length: count }).map((_, itemIndex) => ({
    id: `${employee.id}-${labelPrefix}-${index}-${itemIndex + 1}`,
    label: `${labelPrefix} ${String((index + itemIndex) % PRODUCTION_ORDER_COUNT + 1).padStart(4, '0')}`,
    detail: itemIndex % 2 === 0 ? `${employee.department} / ${employee.position}` : `${employee.branchName} / ${SHIFT_OPTIONS[(index + itemIndex) % SHIFT_OPTIONS.length]}`,
    date: toDateKey(addDays(new Date(`${date}T12:00:00`), -itemIndex))
  }))
)

const createQualityHistory = (
  qualityForms: QualityForm[],
  employee: PersonnelOption,
  date: string,
  qualitySuccessRate: number,
  index: number
): PersonnelHistoryItem[] => {
  const rows = getQualityRows(qualityForms, employee, index).slice(0, 4)
  if(rows.length > 0){
    return rows.map(form => ({
      id: form.id,
      label: `${form.formNo} / ${form.result}`,
      detail: `${form.productName || form.stockItemName || 'Ürün'} / ${formatPercent(form.score || qualitySuccessRate)}`,
      date: form.inspectionDate || form.createdAt
    }))
  }

  return createHistory(employee, date, 'Kalite Kontrol', 3, index)
}

const createHaccpHistory = (
  sourceData: KpiSourceData,
  employee: PersonnelOption,
  date: string,
  index: number
): PersonnelHistoryItem[] => {
  const monitoringRows = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
  const matched = monitoringRows.filter(record => normalizeSearchText(record.checkedBy).includes(normalizeSearchText(employee.fullName)))
  const source = matched.length > 0 ? matched : monitoringRows.slice((index * 2) % Math.max(monitoringRows.length, 1), (index * 2) % Math.max(monitoringRows.length, 1) + 3)

  return source.slice(0, 3).map((record, itemIndex) => ({
    id: record.id || `${employee.id}-haccp-${itemIndex}`,
    label: `HACCP ${record.result || (itemIndex % 3 === 0 ? 'FAIL' : 'PASS')}`,
    detail: `${record.criticalLimit || 'Kritik limit'} / ölçüm ${formatNumber(record.measuredValue || 0, 1)}`,
    date: record.checkedAt || date
  }))
}

const createWasteAnalysis = (
  wasteRows: WasteRecord[],
  employee: PersonnelOption,
  date: string,
  index: number
): PersonnelHistoryItem[] => {
  if(wasteRows.length > 0){
    return wasteRows.slice(0, 4).map(record => ({
      id: record.id,
      label: `${record.wasteNo} / ${record.productName || record.stockItemName}`,
      detail: `${formatNumber(record.quantity || sumBy(record.items, item => item.quantity), 1)} ${record.unit} / ${record.wasteReason}`,
      date: record.date || record.createdAt
    }))
  }

  return createHistory(employee, date, 'Fire Analizi', 3, index)
}

const createSuggestions = (
  employee: PersonnelOption,
  performanceScore: number,
  wasteRate: number,
  qualitySuccessRate: number,
  absenteeismDays: number,
  decisionSuggestions: DecisionSuggestion[]
) => {
  const matched = decisionSuggestions
    .filter(suggestion => (
      suggestion.category === 'Production'
      || suggestion.category === 'Quality'
      || suggestion.ruleId.includes('workforce')
      || suggestion.recommendation.ownerRole.includes('Personel')
    ))
    .slice(0, 3)
    .map(suggestion => suggestion.recommendation.action || suggestion.title)
  const fallback = [
    performanceScore < 72
      ? `${employee.fullName} için vardiya hedefi, iş yükü ve üretim süresi birlikte gözden geçirilmeli.`
      : `${employee.fullName} performansı hedef seviyede; mevcut görev dağılımı korunabilir.`,
    wasteRate > 4
      ? 'Fire oranı yüksek; reçete standardı, lot kullanımı ve operatör eğitim kaydı birlikte incelenmeli.'
      : 'Fire oranı kabul edilebilir aralıkta.',
    qualitySuccessRate < 90
      ? 'Kalite başarı oranı için kontrol listesi ve HACCP eğitim tazelemesi planlanmalı.'
      : 'Kalite sonuçları hedef seviyede.',
    absenteeismDays > 1
      ? 'Devamsızlık etkisi vardiya planlama ekibiyle manuel değerlendirilmeli.'
      : 'Devamsızlık kaynaklı kapasite riski düşük.',
    'Bu ekran yalnızca analiz sağlar; personel, vardiya, maaş veya PDKS kaydı oluşturmaz.'
  ]

  return [...matched, ...fallback].filter(Boolean).slice(0, 5)
}

const getRisk = (
  performanceScore: number,
  wasteRate: number,
  qualitySuccessRate: number,
  absenteeismDays: number,
  overtimeHours: number
): { risk: PersonnelRisk; riskScore: number } => {
  const performancePenalty = performanceScore < 62 ? 32 : performanceScore < 74 ? 21 : performanceScore < 84 ? 10 : 2
  const wastePenalty = wasteRate > 5 ? 23 : wasteRate > 3 ? 14 : wasteRate > 1.5 ? 7 : 1
  const qualityPenalty = qualitySuccessRate < 86 ? 24 : qualitySuccessRate < 92 ? 14 : qualitySuccessRate < 96 ? 6 : 1
  const absencePenalty = absenteeismDays >= 3 ? 16 : absenteeismDays >= 1 ? 8 : 1
  const overtimePenalty = overtimeHours > 14 ? 8 : overtimeHours > 8 ? 4 : 1
  const riskScore = clamp(performancePenalty + wastePenalty + qualityPenalty + absencePenalty + overtimePenalty, 0, 100)

  if(riskScore >= 78) return { risk: 'CRITICAL', riskScore }
  if(riskScore >= 56) return { risk: 'HIGH', riskScore }
  if(riskScore >= 32) return { risk: 'MEDIUM', riskScore }
  return { risk: 'LOW', riskScore }
}

const getPerformanceBand = (score: number): PersonnelPerformanceBand => {
  if(score >= 86) return 'Yüksek'
  if(score >= 72) return 'Orta'
  return 'Düşük'
}

const createRecords = (
  sourceData: KpiSourceData,
  personnel: PersonnelOption[],
  shifts: Shift[],
  attendances: Attendance[],
  employeePerformances: EmployeePerformance[],
  employeeAudits: EmployeeAudit[],
  qualityForms: QualityForm[],
  wasteRecords: WasteRecord[],
  decisionSuggestions: DecisionSuggestion[]
): PersonnelPerformanceRecord[] => (
  Array.from({ length: RECORD_COUNT }).map((_, index) => {
    const employee = personnel[index % personnel.length]
    const date = toDateKey(addDays(new Date(), -(index % 60)))
    const shift = getMatchingShift(shifts, employee, date, index)
    const attendance = getMatchingAttendance(attendances, employee, date, index)
    const performanceRows = getPerformanceRows(employeePerformances, employee)
    const qualityRows = getQualityRows(qualityForms, employee, index)
    const wasteRows = getWasteRows(wasteRecords, employee, index)
    const sourceOrder = sourceData.productionOrders[index % Math.max(sourceData.productionOrders.length, 1)]
    const productionOrderCount = 1 + (index % 4) + (sourceOrder?.status?.includes('Üretimde') ? 1 : 0)
    const completedRate = clamp(82 + (index % 15) - (attendance?.status?.includes('Devams') ? 12 : 0), 48, 100)
    const completedJobCount = Math.max(0, Math.round(productionOrderCount * completedRate / 100))
    const basePerformance = performanceRows.length > 0 ? averageBy(performanceRows, item => item.performanceScore) : 70 + (index % 24)
    const qualitySuccessRate = roundKpi(clamp(
      qualityRows.length > 0
        ? percent(qualityRows.filter(form => form.result === 'PASS' || form.status === 'APPROVED').length, qualityRows.length)
        : 88 + (index % 11),
      62,
      100
    ))
    const wasteQuantityKg = roundKpi(clamp(sumBy(wasteRows, record => record.quantity || sumBy(record.items, item => item.quantity)) * (0.2 + (index % 5) * 0.08), 0.2, 240))
    const productionQuantity = clamp(sumBy(sourceOrder?.lines || [], line => line.quantity) || 140 + (index % 18) * 16, 60, 3600)
    const wasteRate = roundKpi(clamp(percent(wasteQuantityKg, productionQuantity + wasteQuantityKg), 0.1, 8.8))
    const overtimeHours = roundKpi(clamp((attendance?.overtimeMinutes || (index % 7 === 0 ? 95 : index % 5 === 0 ? 35 : 0)) / 60, 0, 18))
    const absenteeismDays = attendance?.status?.includes('Devams')
      ? 1 + index % 2
      : index % 37 === 0 ? 1 : 0
    const averageProductionMinutes = roundKpi(clamp((sourceOrder?.estimatedMinutes || 180 + (index % 12) * 18) / Math.max(productionOrderCount, 1), 35, 540))
    const haccpHistory = createHaccpHistory(sourceData, employee, date, index)
    const haccpPassRate = roundKpi(percent(haccpHistory.filter(item => !item.label.includes('FAIL')).length, haccpHistory.length || 1))
    const machineUtilization = roundKpi(clamp(62 + (index % 20) * 1.3 + completedJobCount * 2 - wasteRate, 38, 99))
    const trainingRecords = createTrainingRecords(employee, index)
    const trainingScore = averageBy(trainingRecords, item => item.score)
    const auditPenalty = employeeAudits.filter(audit => audit.employeeId === employee.id && ['Yüksek', 'Kritik'].includes(audit.severity)).length * 2
    const productivityScore = roundKpi(clamp(percent(completedJobCount, Math.max(productionOrderCount, 1)) * 0.64 + machineUtilization * 0.24 + (100 - averageProductionMinutes / 6) * 0.12, 45, 110))
    const performanceScore = roundKpi(clamp(
      basePerformance * 0.24
      + productivityScore * 0.24
      + qualitySuccessRate * 0.18
      + haccpPassRate * 0.1
      + trainingScore * 0.1
      + (100 - wasteRate * 8) * 0.1
      - absenteeismDays * 3
      - auditPenalty,
      35,
      99
    ))
    const performanceBand = getPerformanceBand(performanceScore)
    const { risk, riskScore } = getRisk(performanceScore, wasteRate, qualitySuccessRate, absenteeismDays, overtimeHours)
    const qualityHistory = createQualityHistory(qualityForms, employee, date, qualitySuccessRate, index)
    const productionHistory = createHistory(employee, date, 'Üretim Emri', Math.min(4, productionOrderCount), index)
    const completedJobs = createHistory(employee, date, 'Tamamlanan İş', Math.min(4, completedJobCount), index)
    const wasteAnalysis = createWasteAnalysis(wasteRows, employee, date, index)

    return {
      id: `personnel-performance-${index + 1}`,
      date,
      employeeId: employee.id,
      employeeName: employee.fullName,
      personnelCode: employee.code,
      branchId: employee.branchId,
      branchName: employee.branchName,
      department: employee.department,
      position: employee.position,
      shift: normalizeShiftName(shift?.shiftName, index),
      productionOrderCount,
      completedJobCount,
      wasteRate,
      wasteQuantityKg,
      qualitySuccessRate,
      qualityRecordCount: Math.max(qualityRows.length, index % 4 + 1),
      averageProductionMinutes,
      overtimeHours,
      absenteeismDays,
      productivityScore,
      performanceScore,
      performanceBand,
      risk,
      riskScore,
      haccpPassRate,
      machineUtilization,
      trainingScore,
      trainingRecords,
      productionHistory,
      completedJobs,
      qualityResults: qualityHistory,
      haccpHistory,
      wasteAnalysis,
      developmentSuggestions: createSuggestions(employee, performanceScore, wasteRate, qualitySuccessRate, absenteeismDays, decisionSuggestions),
      sourceSummary: `${sourceOrder?.workOrderNo || `UE-${String(index % PRODUCTION_ORDER_COUNT + 1).padStart(4, '0')}`} / ${employee.department}`
    }
  })
)

const createModel = (): PersonnelPerformanceModel => {
  const sourceData = loadKpiSourceData()
  const employees = safeList(() => loadEmployees())
  const shifts = safeList(() => loadShifts())
  const attendances = safeList(() => loadAttendances())
  const employeePerformances = safeList(() => loadEmployeePerformances())
  const employeeAudits = safeList(() => loadEmployeeAudits())
  const qualityForms = safeList(() => QualityFormService.createReadModelRecords(sourceData)).slice(0, QUALITY_RECORD_COUNT)
  const wasteRecords = safeList(() => WasteService.createReadModelRecords(sourceData)).slice(0, WASTE_RECORD_COUNT)
  const decisionSuggestions = safeList(() => createDecisionSuggestions(sourceData))
  const personnel = createPersonnelPool(sourceData, employees)
  const records = createRecords(
    sourceData,
    personnel,
    shifts,
    attendances,
    employeePerformances,
    employeeAudits,
    qualityForms,
    wasteRecords,
    decisionSuggestions
  )

  return {
    sourceData,
    employees: personnel,
    shifts,
    attendances,
    employeePerformances,
    employeeAudits,
    qualityForms,
    wasteRecords,
    decisionSuggestions,
    records,
    generatedAt: new Date().toISOString()
  }
}

const createDefaultFilters = (records: PersonnelPerformanceRecord[]): PersonnelPerformanceFilters => {
  const dates = records.map(record => record.date).filter(Boolean).sort()
  const today = toDateKey(new Date())

  return {
    startDate: dates[0] || today,
    endDate: dates[dates.length - 1] || today,
    branchId: ALL_FILTER,
    department: ALL_FILTER,
    position: ALL_FILTER,
    employeeId: ALL_FILTER,
    shift: ALL_FILTER,
    risk: ALL_FILTER,
    performance: ALL_FILTER,
    search: ''
  }
}

const matchesFilter = (record: PersonnelPerformanceRecord, filters: PersonnelPerformanceFilters) => {
  const search = normalizeSearchText(filters.search)
  const searchable = [
    record.employeeName,
    record.personnelCode,
    record.department,
    record.position,
    record.branchName,
    record.shift,
    record.performanceBand,
    RISK_LABELS[record.risk],
    record.sourceSummary
  ].map(normalizeSearchText).join(' ')

  return (
    (!filters.startDate || record.date >= filters.startDate)
    && (!filters.endDate || record.date <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.department === ALL_FILTER || record.department === filters.department)
    && (filters.position === ALL_FILTER || record.position === filters.position)
    && (filters.employeeId === ALL_FILTER || record.employeeId === filters.employeeId)
    && (filters.shift === ALL_FILTER || record.shift === filters.shift)
    && (filters.risk === ALL_FILTER || record.risk === filters.risk)
    && (filters.performance === ALL_FILTER || record.performanceBand === filters.performance)
    && (!search || searchable.includes(search))
  )
}

const createKpis = (records: PersonnelPerformanceRecord[]): PersonnelPerformanceKpi[] => {
  const uniquePersonnelCount = new Set(records.map(record => record.employeeId)).size
  const averagePerformance = averageBy(records, record => record.performanceScore)
  const averageProductivity = averageBy(records, record => record.productivityScore)
  const completedJobs = sumBy(records, record => record.completedJobCount)
  const averageWasteRate = averageBy(records, record => record.wasteRate)
  const qualitySuccessRate = averageBy(records, record => record.qualitySuccessRate)

  return [
    {
      id: 'total-personnel',
      label: 'Toplam Personel',
      value: formatNumber(uniquePersonnelCount),
      detail: `${formatNumber(records.length)} performans kaydı`,
      tone: 'neutral'
    },
    {
      id: 'average-performance',
      label: 'Ortalama Performans Skoru',
      value: formatPercent(averagePerformance),
      detail: `${formatNumber(records.filter(record => record.performanceBand === 'Yüksek').length)} yüksek performans`,
      tone: averagePerformance >= 86 ? 'success' : averagePerformance >= 74 ? 'warning' : 'danger'
    },
    {
      id: 'average-productivity',
      label: 'Ortalama Verimlilik',
      value: formatPercent(averageProductivity),
      detail: 'tamamlanan iş ve üretim süresi etkisi',
      tone: averageProductivity >= 88 ? 'success' : averageProductivity >= 76 ? 'warning' : 'danger'
    },
    {
      id: 'completed-work-orders',
      label: 'Tamamlanan İş Emirleri',
      value: formatNumber(completedJobs),
      detail: `${formatNumber(sumBy(records, record => record.productionOrderCount))} planlı iş`,
      tone: 'success'
    },
    {
      id: 'average-waste-rate',
      label: 'Ortalama Fire Oranı',
      value: formatPercent(averageWasteRate),
      detail: `${formatNumber(sumBy(records, record => record.wasteQuantityKg), 1)} kg fire etkisi`,
      tone: averageWasteRate > 4 ? 'danger' : averageWasteRate > 2.2 ? 'warning' : 'success'
    },
    {
      id: 'quality-success',
      label: 'Kalite Başarı Oranı',
      value: formatPercent(qualitySuccessRate),
      detail: `${formatNumber(sumBy(records, record => record.qualityRecordCount))} kalite kaydı`,
      tone: qualitySuccessRate >= 95 ? 'success' : qualitySuccessRate >= 90 ? 'warning' : 'danger'
    }
  ]
}

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string; formatter: (value: number) => string; tone?: KpiTone }>,
  limit = 8
): BarChartRow[] => rows
  .filter(row => row.id && row.label)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formatter(row.value),
    detail: row.detail,
    tone: row.tone
  }))

const averageRows = (
  records: PersonnelPerformanceRecord[],
  getKey: (record: PersonnelPerformanceRecord) => string,
  getLabel: (record: PersonnelPerformanceRecord) => string,
  getValue: (record: PersonnelPerformanceRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: (previous?.total || 0) + getValue(record),
      count: (previous?.count || 0) + 1
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => {
    const average = row.count > 0 ? row.total / row.count : 0
    return {
      id,
      label: row.label,
      value: average,
      detail: `${formatNumber(row.count)} kayıt / ${detailLabel}`,
      formatter,
      tone: average >= 88 ? 'success' as KpiTone : average >= 74 ? 'warning' as KpiTone : 'danger' as KpiTone
    }
  }))
}

const sumRows = (
  records: PersonnelPerformanceRecord[],
  getKey: (record: PersonnelPerformanceRecord) => string,
  getLabel: (record: PersonnelPerformanceRecord) => string,
  getValue: (record: PersonnelPerformanceRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: roundKpi((previous?.total || 0) + getValue(record)),
      count: (previous?.count || 0) + 1
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    detail: `${formatNumber(row.count)} kayıt / ${detailLabel}`,
    formatter
  })))
}

const createPerformanceDistributionRows = (records: PersonnelPerformanceRecord[]) => {
  const buckets = [
    { id: 'high', label: 'Yüksek', min: 86, max: 100 },
    { id: 'mid', label: 'Orta', min: 72, max: 85.99 },
    { id: 'low', label: 'Düşük', min: 0, max: 71.99 }
  ]

  return toBarRows(buckets.map(bucket => {
    const count = records.filter(record => record.performanceScore >= bucket.min && record.performanceScore <= bucket.max).length
    return {
      id: bucket.id,
      label: bucket.label,
      value: count,
      detail: `${formatNumber(count)} performans kaydı`,
      formatter: value => formatNumber(value),
      tone: bucket.id === 'high' ? 'success' as KpiTone : bucket.id === 'mid' ? 'warning' as KpiTone : 'danger' as KpiTone
    }
  }), buckets.length)
}

const createTrendRows = (records: PersonnelPerformanceRecord[]) => {
  const map = records.reduce<Map<string, { total: number; count: number }>>((acc, record) => {
    const previous = acc.get(record.date) || { total: 0, count: 0 }
    acc.set(record.date, {
      total: previous.total + record.performanceScore,
      count: previous.count + 1
    })
    return acc
  }, new Map())

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([date, row]) => {
      const value = row.count > 0 ? row.total / row.count : 0
      return {
        id: `personnel-trend-${date}`,
        label: formatDate(date),
        value,
        formattedValue: formatPercent(value),
        detail: `${formatNumber(row.count)} personel performans kaydı`
      }
    })
}

const createChartGroups = (records: PersonnelPerformanceRecord[]) => [
  {
    id: 'performance-distribution',
    title: 'Personel Performans Dağılımı',
    rows: createPerformanceDistributionRows(records)
  },
  {
    id: 'department-performance',
    title: 'Departman Performansı',
    rows: averageRows(records, record => record.department, record => record.department, record => record.performanceScore, formatPercent, 'ortalama performans')
  },
  {
    id: 'shift-performance',
    title: 'Vardiya Performansı',
    rows: averageRows(records, record => record.shift, record => record.shift, record => record.performanceScore, formatPercent, 'vardiya performansı')
  },
  {
    id: 'waste-distribution',
    title: 'Fire Dağılımı',
    rows: averageRows(records, record => record.department, record => record.department, record => record.wasteRate, formatPercent, 'ortalama fire oranı')
  },
  {
    id: 'quality-success',
    title: 'Kalite Başarı Oranı',
    rows: averageRows(records, record => record.employeeId, record => record.employeeName, record => record.qualitySuccessRate, formatPercent, 'kalite başarısı')
  },
  {
    id: 'overtime-analysis',
    title: 'Fazla Mesai Analizi',
    rows: sumRows(records, record => record.department, record => record.department, record => record.overtimeHours, formatHours, 'toplam fazla mesai')
  },
  {
    id: 'absence-analysis',
    title: 'Devamsızlık Analizi',
    rows: sumRows(records, record => record.department, record => record.department, record => record.absenteeismDays, value => `${formatNumber(value)} gün`, 'devamsızlık')
  },
  {
    id: 'performance-trends',
    title: 'Performans Trendleri',
    rows: createTrendRows(records)
  }
]

const createOptions = (
  records: PersonnelPerformanceRecord[],
  getId: (record: PersonnelPerformanceRecord) => string,
  getName: (record: PersonnelPerformanceRecord) => string
) => createUniqueOptions(records.map(record => ({ id: getId(record), name: getName(record) })))

const mapRowsForOutput = (rows: PersonnelPerformanceRecord[]) => rows.map(row => ({
  Tarih: formatDate(row.date),
  Personel: row.employeeName,
  'Sicil No': row.personnelCode,
  Şube: row.branchName,
  Departman: row.department,
  Pozisyon: row.position,
  Vardiya: row.shift,
  'Üretim Emri Sayısı': row.productionOrderCount,
  'Tamamlanan İş': row.completedJobCount,
  'Fire Oranı': row.wasteRate,
  'Kalite Başarı Oranı': row.qualitySuccessRate,
  'Ortalama Üretim Süresi': row.averageProductionMinutes,
  'Fazla Mesai': row.overtimeHours,
  Devamsızlık: row.absenteeismDays,
  Verimlilik: row.productivityScore,
  'Performans Skoru': row.performanceScore,
  Risk: RISK_LABELS[row.risk]
}))

const exportFilteredRows = (rows: PersonnelPerformanceRecord[]) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'workforce-planning',
    moduleLabel: 'Personel Performansi',
    sheetName: 'Personel Performansı',
    fileNamePrefix: 'personel-performansi-filtreli',
    fileName: `personel-performansi-filtreli-${toDateKey(new Date())}.xlsx`,
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const openPrintWindow = (
  rows: PersonnelPerformanceRecord[],
  kpis: PersonnelPerformanceKpi[],
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
  const tableRows = rows.slice(0, 140).map(row => `
    <tr>
      <td>${escapeHtml(row.employeeName)}</td>
      <td>${escapeHtml(row.personnelCode)}</td>
      <td>${escapeHtml(row.department)}</td>
      <td>${escapeHtml(row.position)}</td>
      <td>${escapeHtml(row.shift)}</td>
      <td>${escapeHtml(formatNumber(row.productionOrderCount))}</td>
      <td>${escapeHtml(formatNumber(row.completedJobCount))}</td>
      <td>${escapeHtml(formatPercent(row.wasteRate))}</td>
      <td>${escapeHtml(formatPercent(row.qualitySuccessRate))}</td>
      <td>${escapeHtml(formatMinutes(row.averageProductionMinutes))}</td>
      <td>${escapeHtml(formatHours(row.overtimeHours))}</td>
      <td>${escapeHtml(formatNumber(row.absenteeismDays))}</td>
      <td>${escapeHtml(formatPercent(row.performanceScore))}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Personel Performansı ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
          h1 { margin:0; font-size:24px; }
          p { margin:${PRINT_SPACING_VALUES.space4} 0 ${PRINT_SPACING_VALUES.space16}; color:${PRINT_THEME_COLORS.textMutedStrong}; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:${PRINT_SPACING_VALUES.space8}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
          article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:8px; padding:${PRINT_SPACING_VALUES.space12}; page-break-inside:avoid; }
          article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
          article strong { display:block; margin:${PRINT_SPACING_VALUES.space4} 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:10.5px; }
          th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
          th { background:${PRINT_THEME_COLORS.pageBackground}; }
          @media print { body { padding:${PRINT_SPACING_VALUES.space16}; } }
        </style>
      </head>
      <body>
        <h1>Personel Performansı</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Personel</th><th>Sicil No</th><th>Departman</th><th>Pozisyon</th><th>Vardiya</th><th>Üretim Emri</th><th>Tamamlanan</th><th>Fire</th><th>Kalite</th><th>Üretim Süresi</th><th>Fazla Mesai</th><th>Devamsızlık</th><th>Skor</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="13">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function PersonnelPerformanceAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<PersonnelPerformanceFilters>(() => createDefaultFilters(model.records))
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const departmentOptions = React.useMemo(() => createOptions(model.records, record => record.department, record => record.department), [model.records])
  const positionOptions = React.useMemo(() => createOptions(model.records, record => record.position, record => record.position), [model.records])
  const employeeOptions = React.useMemo(() => createOptions(model.records, record => record.employeeId, record => `${record.personnelCode} / ${record.employeeName}`), [model.records])

  const updateFilter = <TKey extends keyof PersonnelPerformanceFilters>(key: TKey, value: PersonnelPerformanceFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page personnel-performance-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Personel Performansı</h2>
          <p className="muted">Personel, üretim emirleri, operasyon kayıtları, vardiyalar, fire, kalite, HACCP, üretim süreleri, makine kullanımı, devamsızlık, fazla mesai, eğitim ve karar destek verilerini tek yönetici ekranında analiz eder.</p>
        </div>
        <div className="daily-production-actions">
          <button className="btn" type="button" onClick={() => exportFilteredRows(filteredRecords)}>Filtreli Excel</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PDF')}>Filtreli PDF</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PRINT')}>Filtreli Yazdır</button>
        </div>
      </div>

      <div className="daily-production-meta">
        <span>Analiz: {formatDateTime(model.generatedAt)}</span>
        <span>Kullanıcı: {currentUser.fullName || currentUser.username}</span>
        <span>{formatNumber(RECORD_COUNT)} performans kaydı / {formatNumber(EMPLOYEE_COUNT)} personel</span>
        <span>{formatNumber(PRODUCTION_ORDER_COUNT)} üretim emri / {formatNumber(DEPARTMENT_COUNT)} departman / {formatNumber(SHIFT_COUNT)} vardiya</span>
        <span>{formatNumber(QUALITY_RECORD_COUNT)} kalite / {formatNumber(WASTE_RECORD_COUNT)} fire / {formatNumber(TRAINING_RECORD_COUNT)} eğitim kaydı</span>
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
            <p className="muted">{formatNumber(filteredRecords.length)} kayıt listeleniyor. Bu ekran personel, vardiya, maaş veya PDKS işlemi oluşturmaz.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters(model.records))}>Reset</button>
        </div>
        <div className="daily-production-filter-grid">
          <label className="form-field">
            <span>Başlangıç</span>
            <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitiş</span>
            <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          <FilterSelect label="Şube" value={filters.branchId} options={branchOptions} onChange={value => updateFilter('branchId', value)} />
          <FilterSelect label="Departman" value={filters.department} options={departmentOptions} onChange={value => updateFilter('department', value)} />
          <FilterSelect label="Pozisyon" value={filters.position} options={positionOptions} onChange={value => updateFilter('position', value)} />
          <FilterSelect label="Personel" value={filters.employeeId} options={employeeOptions} onChange={value => updateFilter('employeeId', value)} />
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value as PersonnelPerformanceFilters['shift'])}>
              <option value={ALL_FILTER}>Tüm Vardiyalar</option>
              {SHIFT_OPTIONS.map(shift => <option value={shift} key={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as PersonnelPerformanceFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Performans</span>
            <select value={filters.performance} onChange={event => updateFilter('performance', event.target.value as PersonnelPerformanceFilters['performance'])}>
              <option value={ALL_FILTER}>Tüm Performans</option>
              {PERFORMANCE_OPTIONS.map(option => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Personel, sicil no, departman, pozisyon, vardiya, risk..." />
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
              <p className="muted">Personel, sicil, departman, pozisyon, vardiya, üretim emri, tamamlanan iş, fire, kalite, üretim süresi, fazla mesai, devamsızlık ve performans skoru.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table personnel-performance-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Sicil No</th>
                  <th>Departman</th>
                  <th>Pozisyon</th>
                  <th>Vardiya</th>
                  <th>Üretim Emri Sayısı</th>
                  <th>Tamamlanan İş</th>
                  <th>Fire Oranı</th>
                  <th>Kalite Başarı Oranı</th>
                  <th>Ortalama Üretim Süresi</th>
                  <th>Fazla Mesai</th>
                  <th>Devamsızlık</th>
                  <th>Verimlilik</th>
                  <th>Performans Skoru</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={15}>Filtrelere uygun personel performans kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Personel"><strong>{record.employeeName}</strong><span>{record.sourceSummary}</span></td>
                    <td data-label="Sicil No">{record.personnelCode}</td>
                    <td data-label="Departman">{record.department}</td>
                    <td data-label="Pozisyon">{record.position}</td>
                    <td data-label="Vardiya">{record.shift}</td>
                    <td data-label="Üretim Emri">{formatNumber(record.productionOrderCount)}</td>
                    <td data-label="Tamamlanan İş">{formatNumber(record.completedJobCount)}</td>
                    <td data-label="Fire Oranı">{formatPercent(record.wasteRate)}</td>
                    <td data-label="Kalite">{formatPercent(record.qualitySuccessRate)}</td>
                    <td data-label="Üretim Süresi">{formatMinutes(record.averageProductionMinutes)}</td>
                    <td data-label="Fazla Mesai">{formatHours(record.overtimeHours)}</td>
                    <td data-label="Devamsızlık">{formatNumber(record.absenteeismDays)} gün</td>
                    <td data-label="Verimlilik">{formatPercent(record.productivityScore)}</td>
                    <td data-label="Performans"><span className={`status-pill ${getScoreClass(record.performanceScore)}`}>{formatPercent(record.performanceScore)}</span></td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <PersonnelDetailPanel record={selectedRecord} />
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: OptionItem[]
  onChange: (value: string) => void
}){
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value={ALL_FILTER}>Tümü</option>
        {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function BarChartCard({
  title,
  rows
}: {
  title: string
  rows: BarChartRow[]
}){
  const chartValues = rows.map(row => Math.max(0, toFiniteNumber(row.value)))
  const maxValue = Math.max(...chartValues, 1)

  return (
    <section className="card kpi-chart-card daily-production-chart-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <p className="muted">Grafik için uygun kayıt bulunamadı.</p>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <em>{row.formattedValue}</em>
            <div className="kpi-bar-track">
              <span style={{ width: `${clamp(percent(toFiniteNumber(row.value), maxValue), 4, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PersonnelDetailPanel({
  record
}: {
  record: PersonnelPerformanceRecord | undefined
}){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-state">Detay için bir personel kaydı seçin.</div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Personel Özeti</h3>
            <p className="muted">{record.personnelCode} / {record.employeeName}</p>
          </div>
          <span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Performans Skoru" value={formatPercent(record.performanceScore)} detail={record.performanceBand} />
          <DetailMetric label="Verimlilik" value={formatPercent(record.productivityScore)} detail={`${record.department} / ${record.shift}`} />
          <DetailMetric label="Tamamlanan İş" value={formatNumber(record.completedJobCount)} detail={`${formatNumber(record.productionOrderCount)} planlı iş`} />
          <DetailMetric label="Kalite Başarısı" value={formatPercent(record.qualitySuccessRate)} detail={`${formatNumber(record.qualityRecordCount)} kalite kaydı`} />
          <DetailMetric label="Fire Oranı" value={formatPercent(record.wasteRate)} detail={`${formatNumber(record.wasteQuantityKg, 1)} kg etki`} />
          <DetailMetric label="Devamsızlık" value={`${formatNumber(record.absenteeismDays)} gün`} detail={`${formatHours(record.overtimeHours)} fazla mesai`} />
        </div>
      </section>

      <DetailList title="Üretim Geçmişi" items={record.productionHistory} />
      <DetailList title="Tamamlanan İşler" items={record.completedJobs} />
      <DetailList title="Fire Analizi" items={record.wasteAnalysis} />
      <DetailList title="Kalite Sonuçları" items={record.qualityResults} />
      <DetailList title="HACCP Geçmişi" items={record.haccpHistory} />

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Eğitim Durumu</h3>
        </div>
        <div className="daily-production-module-list">
          {record.trainingRecords.map(training => (
            <div key={`${record.id}-training-${training.id}`}>
              <strong>{training.title}</strong>
              <span>{training.status} / {formatPercent(training.score)}{training.completedAt ? ` / ${formatDate(training.completedAt)}` : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Gelişim Önerileri</h3>
        </div>
        <div className="daily-production-module-list">
          {record.developmentSuggestions.map((suggestion, index) => (
            <div key={`${record.id}-suggestion-${index}`}>
              <strong>Öneri {index + 1}</strong>
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function DetailList({
  title,
  items
}: {
  title: string
  items: PersonnelHistoryItem[]
}){
  return (
    <section className="card daily-production-detail-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="daily-production-module-list">
        {items.length === 0 && (
          <div>
            <strong>Kayıt yok</strong>
            <span>Seçilen personel için yakın read-model kaydı bulunamadı.</span>
          </div>
        )}
        {items.map(item => (
          <div key={`${title}-${item.id}`}>
            <strong>{item.label}</strong>
            <span>{item.detail} / {formatDate(item.date)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function DetailMetric({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}){
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

const getRiskClass = (risk: PersonnelRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning'
  if(risk === 'MEDIUM') return 'warning'
  return 'success'
}

const getScoreClass = (score: number) => {
  if(score >= 86) return 'success'
  if(score >= 72) return 'warning'
  return 'danger-pill'
}
