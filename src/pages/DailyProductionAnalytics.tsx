import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { createDefaultKpiFilters, createKpiDashboardView } from '../kpi-reporting/kpi.service'
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

type DailyProductionStatus = 'Tamamlandı' | 'Devam Ediyor' | 'Planlandı' | 'Duruşta' | 'Kalite Bekliyor'
type DailyProductionShift = 'Sabah' | 'Akşam' | 'Gece' | 'Tam Gün'

type ProductionAnalyticsFilters = {
  date: string
  branchId: string
  workCenter: string
  lineId: string
  machineId: string
  productId: string
  recipeId: string
  operatorId: string
  shift: DailyProductionShift | 'all'
  status: DailyProductionStatus | 'all'
  search: string
}

type ProductOption = {
  id: string
  name: string
  unit: string
  stockItemId: string
}

type RecipeOption = {
  id: string
  code: string
  name: string
  productName: string
  firePercent: number
  ingredients: Array<{ materialName: string; quantity: number; unit: string }>
}

type LineOption = {
  id: string
  code: string
  name: string
  workCenter: string
  status: string
  capacity: number
  capacityUnit: string
  estimatedUtilization: number
  branchId: string
}

type MachineOption = {
  id: string
  code: string
  name: string
  lineId: string
  lineName: string
  workCenter: string
  capacityPerHour: number
  plannedMaintenanceMinutes: number
  status: string
}

type OperatorOption = {
  id: string
  name: string
  title: string
  shift: DailyProductionShift
  performanceScore: number
}

type UsedLot = {
  lotNo: string
  productName: string
  quantity: number
  unit: string
  expiryDate: string
}

type ProductionHistoryItem = {
  label: string
  timestamp: string
  detail: string
}

type DailyProductionRecord = {
  id: string
  date: string
  workOrderNo: string
  productId: string
  productName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  branchId: string
  branchName: string
  workCenter: string
  lineId: string
  lineName: string
  machineId: string
  machineCode: string
  machineName: string
  operatorId: string
  operatorName: string
  operatorTitle: string
  shift: DailyProductionShift
  startAt: string
  endAt: string
  plannedMinutes: number
  actualMinutes: number
  downtimeMinutes: number
  plannedQuantity: number
  producedQuantity: number
  unit: string
  wasteQuantity: number
  wasteRate: number
  wasteReason: string
  efficiency: number
  availability: number
  performance: number
  quality: number
  oee: number
  machineUtilization: number
  status: DailyProductionStatus
  qualityResult: string
  haccpResult: string
  usedLots: UsedLot[]
  recipeIngredients: Array<{ materialName: string; quantity: number; unit: string }>
  history: ProductionHistoryItem[]
}

type DailyProductionKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type DailyProductionModel = {
  sourceData: KpiSourceData
  records: DailyProductionRecord[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const RECORD_COUNT = 500
const TODAY_KEY = () => toDateKey(new Date())
const SHIFT_OPTIONS: DailyProductionShift[] = ['Sabah', 'Akşam', 'Gece', 'Tam Gün']
const STATUS_OPTIONS: DailyProductionStatus[] = ['Tamamlandı', 'Devam Ediyor', 'Planlandı', 'Duruşta', 'Kalite Bekliyor']
const WASTE_REASONS = [
  'Porsiyon gramaj sapması',
  'Isıl işlem fire kaybı',
  'Ambalaj hasarı',
  'Soğutma sonrası kalite ayrımı',
  'Hazırlık fire kaybı',
  'Makine ayar sapması',
  'Hammadde kalite ayrımı',
  'Etiketleme tekrar işleme'
]

const WASTE_REASON_LABELS: Record<string, string> = {
  PRODUCTION_ERROR: 'Üretim hatası',
  TEMPERATURE_ISSUE: 'Sıcaklık sapması',
  DAMAGED_PACKAGING: 'Ambalaj hasarı',
  EXPIRED: 'SKT / raf ömrü riski',
  TRANSPORT_DAMAGE: 'Taşıma hasarı',
  QUALITY_REJECTION: 'Kalite reddi',
  HUMAN_ERROR: 'Operasyonel hata',
  MACHINE_FAILURE: 'Makine arızası',
  OTHER: 'Diğer fire nedeni'
}

const FALLBACK_PRODUCTS = [
  'Izgara Tavuk Fileto',
  'Dana Kavurma',
  'Etli Nohut',
  'Zeytinyağlı Taze Fasulye',
  'Mercimek Çorbası',
  'Ezogelin Çorbası',
  'Sebzeli Bulgur Pilavı',
  'Pirinç Pilavı',
  'Fırın Köfte',
  'Patates Püresi',
  'Tavuk Sote',
  'Dana Tas Kebabı',
  'Mevsim Salata',
  'Yoğurtlu Semizotu',
  'Peynirli Börek',
  'Ispanak Graten',
  'Karnıyarık',
  'Sebzeli Makarna',
  'Domates Sos',
  'Tavuk Haşlama',
  'Et Suyu Bazı',
  'Sebze Garnitür',
  'Mantar Sote',
  'Kırmızı Mercimek Köftesi',
  'Tavuk Döner Harcı',
  'Dana Rosto',
  'Çoban Salata',
  'Ayran Dolum',
  'Sütlaç',
  'Kakaolu Puding',
  'Komposto',
  'Kremalı Mantar Çorbası',
  'Fırın Tavuk But',
  'Sebzeli Hindi',
  'Kuru Fasulye',
  'Barbunya Pilaki',
  'Elmalı Kurabiye',
  'Kabak Tatlısı',
  'Limonata Bazı',
  'Paketli Sandviç'
]

const FALLBACK_LINE_NAMES = [
  'Sıcak Yemek Hattı 1',
  'Sıcak Yemek Hattı 2',
  'Et Hazırlık Hattı',
  'Tavuk Hazırlık Hattı',
  'Sebze Hazırlık Hattı',
  'Çorba Hattı',
  'Pasta ve Tatlı Hattı',
  'Soğuk Mutfak Hattı',
  'Paketleme Hattı 1',
  'Paketleme Hattı 2',
  'Diyet Menü Hattı',
  'Vakum Paketleme',
  'Fırın Hattı',
  'Blast Chiller Hattı',
  'Garnitür Hattı'
]

const FALLBACK_OPERATOR_NAMES = [
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
  'Ozan Mete'
]

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clampValue = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) => (
  Math.min(max, Math.max(min, toFiniteNumber(value)))
)

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
  return nextDate
}

const addMinutes = (value: string, minutes: number) => {
  const date = parseSafeDate(value)
  if(!date) return ''
  date.setMinutes(date.getMinutes() + minutes)
  return toLocalDateTime(date)
}

const padNumber = (value: number) => String(value).padStart(2, '0')

const toLocalDateTime = (date: Date) => (
  `${date.toLocaleDateString('sv-SE')}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:00`
)

const createLocalDateTime = (dateKey: string, hour: number, minute: number) => (
  `${dateKey}T${padNumber(hour)}:${padNumber(minute)}:00`
)

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

const formatWasteReason = (value: string) => WASTE_REASON_LABELS[value] || value || 'Fire nedeni izlenmedi'

const formatQualityResult = (value: string) => {
  if(value === 'PASS') return 'Uygun'
  if(value === 'CONDITIONAL') return 'Koşullu Uygun'
  if(value === 'FAIL') return 'Uygunsuz'
  return value || '-'
}

const formatHaccpResult = (value: string) => value === 'PASS' ? 'Uygun' : value === 'FAIL' ? 'Uygunsuz' : value || '-'

const createId = (value: string) => (
  normalizeSearchText(value)
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'row'
)

const getBranchName = (sourceData: KpiSourceData, branchId: string) => (
  sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || 'Merkez'
)

const createDefaultFilters = (): ProductionAnalyticsFilters => ({
  date: TODAY_KEY(),
  branchId: ALL_FILTER,
  workCenter: ALL_FILTER,
  lineId: ALL_FILTER,
  machineId: ALL_FILTER,
  productId: ALL_FILTER,
  recipeId: ALL_FILTER,
  operatorId: ALL_FILTER,
  shift: ALL_FILTER,
  status: ALL_FILTER,
  search: ''
})

const createProductPool = (sourceData: KpiSourceData): ProductOption[] => {
  const map = new Map<string, ProductOption>()
  sourceData.productRefs.forEach(product => {
    map.set(product.id, {
      id: product.id,
      name: product.name,
      unit: product.unit,
      stockItemId: product.stockItemId || ''
    })
  })
  sourceData.stockItems.forEach(item => {
    if(map.size >= 40 && map.has(item.id)) return
    map.set(item.id, {
      id: item.id,
      name: item.name,
      unit: item.unit,
      stockItemId: item.id
    })
  })
  FALLBACK_PRODUCTS.forEach((name, index) => {
    if(map.size >= 40) return
    map.set(`daily-product-${index + 1}`, {
      id: `daily-product-${index + 1}`,
      name,
      unit: index % 5 === 0 ? 'lt' : index % 7 === 0 ? 'adet' : 'kg',
      stockItemId: ''
    })
  })

  return Array.from(map.values()).slice(0, Math.max(40, map.size))
}

const createRecipePool = (
  sourceData: KpiSourceData,
  products: ProductOption[]
): RecipeOption[] => {
  const recipes = sourceData.recipeRecords.map((recipe, index) => ({
    id: recipe.id,
    code: recipe.code,
    name: recipe.recipeName,
    productName: recipe.productName || products[index % products.length]?.name || recipe.recipeName,
    firePercent: clampValue(recipe.firePercent, 0.5, 12),
    ingredients: recipe.ingredients.map(ingredient => ({
      materialName: ingredient.materialName,
      quantity: ingredient.quantity,
      unit: ingredient.unit
    }))
  }))

  const nextRecipes = [...recipes]
  products.forEach((product, index) => {
    if(nextRecipes.length >= 40) return
    nextRecipes.push({
      id: `daily-recipe-${index + 1}`,
      code: `RC-DA-${String(index + 1).padStart(3, '0')}`,
      name: `${product.name} Standart Reçete`,
      productName: product.name,
      firePercent: roundKpi(1.8 + (index % 9) * 0.45),
      ingredients: [
        { materialName: product.name.includes('Tavuk') ? 'Tavuk Fileto' : product.name.includes('Dana') ? 'Dana Eti' : 'Ana Hammadde', quantity: 12 + index % 8, unit: 'kg' },
        { materialName: 'Sebze Hazırlık Karışımı', quantity: 4 + index % 5, unit: 'kg' },
        { materialName: 'Baharat ve Yardımcı Malzeme', quantity: 0.8 + index % 3, unit: 'kg' }
      ]
    })
  })

  return nextRecipes
}

const createLinePool = (sourceData: KpiSourceData): LineOption[] => {
  const branchIds = sourceData.branches.length > 0 ? sourceData.branches.map(branch => branch.id) : ['main-branch']
  const lines = sourceData.productionLines.map((line, index) => ({
    id: line.id,
    code: line.code,
    name: line.name,
    workCenter: line.type,
    status: line.status,
    capacity: clampValue(line.capacity, 120, 1800),
    capacityUnit: line.capacityUnit || 'kg/gün',
    estimatedUtilization: clampValue(line.estimatedUtilization, 0, 100),
    branchId: branchIds[index % branchIds.length]
  }))

  const nextLines = [...lines]
  FALLBACK_LINE_NAMES.forEach((name, index) => {
    if(nextLines.length >= 15) return
    nextLines.push({
      id: `daily-line-${index + 1}`,
      code: `HAT-${String(index + 1).padStart(2, '0')}`,
      name,
      workCenter: index % 4 === 0 ? 'Paketleme' : index % 4 === 1 ? 'Et' : index % 4 === 2 ? 'Sebze' : 'Genel',
      status: index % 11 === 0 ? 'Yoğun' : 'Aktif',
      capacity: 420 + index * 55,
      capacityUnit: 'kg/gün',
      estimatedUtilization: 58 + index % 35,
      branchId: branchIds[index % branchIds.length]
    })
  })

  return nextLines
}

const createMachinePool = (lines: LineOption[]): MachineOption[] => (
  Array.from({ length: 30 }, (_, index) => {
    const line = lines[index % lines.length]
    return {
      id: `daily-machine-${index + 1}`,
      code: `${line.code}-M${String(index % 3 + 1).padStart(2, '0')}`,
      name: `${line.name} Makine ${index % 3 + 1}`,
      lineId: line.id,
      lineName: line.name,
      workCenter: line.workCenter,
      capacityPerHour: roundKpi(70 + index % 8 * 12 + line.capacity / 40),
      plannedMaintenanceMinutes: index % 10 === 0 ? 45 : index % 6 === 0 ? 20 : 0,
      status: index % 10 === 0 ? 'Bakım Bekliyor' : index % 8 === 0 ? 'Yoğun' : 'Aktif'
    }
  })
)

const createOperatorPool = (): OperatorOption[] => {
  const employees = loadEmployees()
  const performances = loadEmployeePerformances()
  const rows = employees.map((employee, index) => {
    const employeePerformance = performances.filter(performance => performance.employeeId === employee.id)
    return {
      id: employee.id,
      name: employee.fullName,
      title: employee.position || 'Üretim Operatörü',
      shift: SHIFT_OPTIONS[index % SHIFT_OPTIONS.length],
      performanceScore: employeePerformance.length > 0
        ? averageBy(employeePerformance, performance => performance.performanceScore)
        : 72 + index % 24
    }
  })

  const nextRows = [...rows]
  FALLBACK_OPERATOR_NAMES.forEach((name, index) => {
    if(nextRows.length >= 50) return
    nextRows.push({
      id: `daily-operator-${index + 1}`,
      name,
      title: index % 5 === 0 ? 'Hat Sorumlusu' : index % 3 === 0 ? 'Makine Operatörü' : 'Üretim Operatörü',
      shift: SHIFT_OPTIONS[index % SHIFT_OPTIONS.length],
      performanceScore: 68 + index % 29
    })
  })

  return nextRows.slice(0, 50)
}

const resolveRecipeForProduct = (
  product: ProductOption,
  recipes: RecipeOption[],
  index: number
) => {
  const productSearch = normalizeSearchText(product.name)
  return recipes.find(recipe => normalizeSearchText(recipe.productName).includes(productSearch) || productSearch.includes(normalizeSearchText(recipe.productName)))
    || recipes[index % recipes.length]
}

const getUsedLots = (
  sourceData: KpiSourceData,
  product: ProductOption,
  producedQuantity: number,
  index: number
): UsedLot[] => {
  const relatedLots = sourceData.inventoryLots
    .filter(lot => (
      lot.productId === product.id
      || lot.stockItemId === product.stockItemId
      || normalizeSearchText(product.name).includes(normalizeSearchText(sourceData.stockItems.find(item => item.id === lot.stockItemId)?.name))
    ))
    .slice(0, 3)

  if(relatedLots.length > 0){
    return relatedLots.map((lot, lotIndex) => ({
      lotNo: lot.lotNo,
      productName: sourceData.stockItems.find(item => item.id === lot.stockItemId)?.name || product.name,
      quantity: roundKpi(Math.max(1, producedQuantity * (0.08 + lotIndex * 0.04))),
      unit: lot.unit,
      expiryDate: lot.expiryDate
    }))
  }

  return [
    {
      lotNo: `LOT-DA-${String(index + 1).padStart(4, '0')}`,
      productName: product.name,
      quantity: roundKpi(Math.max(1, producedQuantity * 0.12)),
      unit: product.unit,
      expiryDate: toDateKey(addDays(new Date(), 12 + index % 21))
    }
  ]
}

const getQualityResult = (
  qualityForms: ReturnType<typeof QualityFormService.createReadModelRecords>,
  product: ProductOption,
  index: number
) => {
  const productSearch = normalizeSearchText(product.name)
  const form = qualityForms.find(record => (
    record.productId === product.id
    || record.stockItemId === product.stockItemId
    || normalizeSearchText(record.productName).includes(productSearch)
    || productSearch.includes(normalizeSearchText(record.productName))
  ))
  if(form) return form.result
  if(index % 29 === 0) return 'FAIL'
  if(index % 11 === 0) return 'CONDITIONAL'
  return 'PASS'
}

const getHaccpResult = (
  sourceData: KpiSourceData,
  index: number
) => {
  const monitoringRecords = sourceData.haccpRecords.flatMap(plan => plan.monitoringRecords)
  const record = monitoringRecords[index % Math.max(1, monitoringRecords.length)]
  if(record) return record.result
  return index % 23 === 0 ? 'FAIL' : 'PASS'
}

const createHistory = (
  startAt: string,
  endAt: string,
  status: DailyProductionStatus,
  operatorName: string,
  machineCode: string
): ProductionHistoryItem[] => {
  const rows: ProductionHistoryItem[] = [
    { label: 'Başladı', timestamp: startAt, detail: `${operatorName} ${machineCode} üzerinde üretimi başlattı.` },
    { label: 'Ara Kontrol', timestamp: addMinutes(startAt, 35), detail: 'Hat verimliliği ve kritik kontrol noktaları izlendi.' }
  ]
  if(status === 'Duruşta'){
    rows.push({ label: 'Duruş', timestamp: addMinutes(startAt, 62), detail: 'Makine ayar ve bakım kontrolü için planlı duruş kaydı izlendi.' })
  }
  if(status === 'Kalite Bekliyor'){
    rows.push({ label: 'Kalite Bekliyor', timestamp: addMinutes(startAt, 78), detail: 'Numune ve kalite kontrol sonucu bekleniyor.' })
  }
  if(endAt){
    rows.push({ label: 'Tamamlandı', timestamp: endAt, detail: 'Üretim çıktısı analiz read-modeline yansıdı.' })
  }
  return rows
}

const createDailyProductionRecords = (sourceData: KpiSourceData): DailyProductionRecord[] => {
  const products = createProductPool(sourceData)
  const recipes = createRecipePool(sourceData, products)
  const lines = createLinePool(sourceData)
  const machines = createMachinePool(lines)
  const operators = createOperatorPool()
  const qualityForms = QualityFormService.createReadModelRecords(sourceData)
  const wasteRecords = WasteService.createReadModelRecords(sourceData)
  const kpiDashboard = createKpiDashboardView(sourceData, createDefaultKpiFilters())
  const branchIds = sourceData.branches.length > 0 ? sourceData.branches.map(branch => branch.id) : ['main-branch']
  const productionOrders = sourceData.productionOrders
  const referenceDate = new Date()

  return Array.from({ length: RECORD_COUNT }, (_, index) => {
    const sourceOrder = productionOrders[index % Math.max(1, productionOrders.length)]
    const sourceOrderLines = sourceOrder?.lines || []
    const sourceLine = sourceOrderLines[index % Math.max(1, sourceOrderLines.length)]
    const product = products.find(row => row.name === sourceLine?.productName) || products[index % products.length]
    const recipe = resolveRecipeForProduct(product, recipes, index)
    const line = lines[index % lines.length]
    const lineMachines = machines.filter(machine => machine.lineId === line.id)
    const machine = lineMachines[index % Math.max(1, lineMachines.length)] || machines[index % machines.length]
    const operator = operators[index % operators.length]
    const branchId = sourceOrder?.branch || line.branchId || branchIds[index % branchIds.length]
    const daysBack = index % 7
    const date = toDateKey(addDays(referenceDate, -daysBack))
    const shift = SHIFT_OPTIONS[index % SHIFT_OPTIONS.length]
    const baseHour = shift === 'Sabah' ? 6 : shift === 'Akşam' ? 14 : shift === 'Gece' ? 22 : 8
    const startHour = (baseHour + Math.floor((index % 8) / 2)) % 24
    const startMinute = (index * 13) % 60
    const startAt = createLocalDateTime(date, startHour, startMinute)
    const dateIsToday = date === TODAY_KEY()
    const plannedQuantity = roundKpi(Math.max(60, sourceLine?.quantity || 110 + index % 14 * 24 + (index % 5) * 11))
    const plannedMinutes = Math.max(45, Math.round(plannedQuantity / Math.max(1, machine.capacityPerHour) * 60 + 35 + index % 38))
    const baseStatus: DailyProductionStatus = dateIsToday && index % 11 === 0
      ? 'Devam Ediyor'
      : dateIsToday && index % 37 === 0
        ? 'Duruşta'
        : index % 29 === 0
          ? 'Kalite Bekliyor'
          : index % 43 === 0
            ? 'Planlandı'
            : 'Tamamlandı'
    const downtimeMinutes = baseStatus === 'Duruşta'
      ? 22 + index % 38
      : machine.plannedMaintenanceMinutes > 0
        ? Math.round(machine.plannedMaintenanceMinutes * 0.45)
        : index % 13 === 0
          ? 8 + index % 17
          : 0
    const actualMinutes = baseStatus === 'Planlandı'
      ? 0
      : baseStatus === 'Devam Ediyor'
        ? Math.round(plannedMinutes * (0.45 + index % 4 * 0.08))
        : Math.max(20, Math.round(plannedMinutes * (0.88 + (index % 9) * 0.035) + downtimeMinutes))
    const endAt = baseStatus === 'Devam Ediyor' || baseStatus === 'Planlandı' || baseStatus === 'Duruşta'
      ? ''
      : addMinutes(startAt, actualMinutes)
    const recipeWaste = clampValue(recipe.firePercent, 0.5, 12)
    const sourceWaste = wasteRecords[index % Math.max(1, wasteRecords.length)]
    const wasteRate = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue(recipeWaste + (index % 6) * 0.28 + (sourceWaste?.wasteReason === 'MACHINE_FAILURE' ? 1.1 : 0), 0.2, 14))
    const producedQuantity = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(plannedQuantity * (baseStatus === 'Devam Ediyor' ? 0.58 : baseStatus === 'Duruşta' ? 0.42 : 1 - wasteRate / 100 + (index % 5) * 0.006))
    const wasteQuantity = roundKpi(producedQuantity * wasteRate / Math.max(1, 100 - wasteRate))
    const qualityResult = getQualityResult(qualityForms, product, index)
    const haccpResult = getHaccpResult(sourceData, index)
    const operatorPerformance = clampValue(operator.performanceScore + (index % 7) - 3, 45, 99)
    const availability = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue(percent(Math.max(0, actualMinutes - downtimeMinutes), Math.max(1, actualMinutes)), 42, 99))
    const performance = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue((producedQuantity / Math.max(1, plannedQuantity)) * 100 * (operatorPerformance / 92), 45, 118))
    const quality = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue(100 - wasteRate * 1.35 - (qualityResult === 'FAIL' ? 8 : qualityResult === 'CONDITIONAL' ? 3 : 0) - (haccpResult === 'FAIL' ? 5 : 0), 68, 99.5))
    const oee = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(availability * performance * quality / 10000)
    const efficiency = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue(percent(producedQuantity, plannedQuantity), 50, 110))
    const machineUtilization = baseStatus === 'Planlandı'
      ? 0
      : roundKpi(clampValue(percent(actualMinutes, shift === 'Tam Gün' ? 720 : 480), 8, 100))
    const workOrderNo = sourceOrder?.workOrderNo
      ? `${sourceOrder.workOrderNo}-GA-${String(index % 120 + 1).padStart(3, '0')}`
      : `WO-GA-${date.slice(0, 4)}-${String(index % 120 + 1).padStart(4, '0')}`

    return {
      id: `daily-production-${date}-${index + 1}`,
      date,
      workOrderNo,
      productId: product.id,
      productName: product.name,
      recipeId: recipe.id,
      recipeCode: recipe.code,
      recipeName: recipe.name,
      branchId,
      branchName: getBranchName(sourceData, branchId),
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
      startAt,
      endAt,
      plannedMinutes,
      actualMinutes,
      downtimeMinutes,
      plannedQuantity,
      producedQuantity,
      unit: product.unit || 'kg',
      wasteQuantity,
      wasteRate,
      wasteReason: sourceWaste?.wasteReason ? formatWasteReason(sourceWaste.wasteReason) : WASTE_REASONS[index % WASTE_REASONS.length],
      efficiency,
      availability,
      performance,
      quality,
      oee: roundKpi((oee + averageBy(kpiDashboard.production.lineProduction.slice(0, 3), row => row.value > 0 ? Math.min(3, row.value / 1000) : 0)) / 1.02),
      machineUtilization,
      status: baseStatus,
      qualityResult,
      haccpResult,
      usedLots: getUsedLots(sourceData, product, producedQuantity, index),
      recipeIngredients: recipe.ingredients,
      history: createHistory(startAt, endAt, baseStatus, operator.name, machine.code)
    }
  })
}

const createModel = (): DailyProductionModel => {
  const sourceData = loadKpiSourceData()
  return {
    sourceData,
    records: createDailyProductionRecords(sourceData),
    generatedAt: new Date().toISOString()
  }
}

const matchesFilter = (record: DailyProductionRecord, filters: ProductionAnalyticsFilters) => {
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
    record.status,
    record.shift
  ].some(value => normalizeSearchText(value).includes(search))

  return matchesSearch
    && (!filters.date || record.date === filters.date)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.workCenter === ALL_FILTER || record.workCenter === filters.workCenter)
    && (filters.lineId === ALL_FILTER || record.lineId === filters.lineId)
    && (filters.machineId === ALL_FILTER || record.machineId === filters.machineId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.recipeId === ALL_FILTER || record.recipeId === filters.recipeId)
    && (filters.operatorId === ALL_FILTER || record.operatorId === filters.operatorId)
    && (filters.shift === ALL_FILTER || record.shift === filters.shift)
    && (filters.status === ALL_FILTER || record.status === filters.status)
}

const createKpis = (records: DailyProductionRecord[]): DailyProductionKpi[] => {
  const completed = records.filter(record => record.status === 'Tamamlandı')
  const ongoing = records.filter(record => record.status === 'Devam Ediyor' || record.status === 'Duruşta')
  const productionQuantity = sumBy(records, record => record.producedQuantity)
  const totalWaste = sumBy(records, record => record.wasteQuantity)
  const wasteRate = percent(totalWaste, productionQuantity + totalWaste)
  const averageEfficiency = averageBy(records.filter(record => record.status !== 'Planlandı'), record => record.efficiency)
  const averageOee = averageBy(records.filter(record => record.status !== 'Planlandı'), record => record.oee)

  return [
    {
      id: 'daily-production-quantity',
      label: 'Günlük Üretim Miktarı',
      value: `${formatNumber(productionQuantity, 1)} birim`,
      detail: `${formatNumber(records.length)} üretim kaydı`,
      tone: productionQuantity > 0 ? 'success' : 'warning'
    },
    {
      id: 'completed-work-orders',
      label: 'Tamamlanan İş Emirleri',
      value: formatNumber(new Set(completed.map(record => record.workOrderNo)).size),
      detail: `${formatNumber(completed.length)} tamamlanan satır`,
      tone: completed.length > 0 ? 'success' : 'neutral'
    },
    {
      id: 'ongoing-productions',
      label: 'Devam Eden Üretimler',
      value: formatNumber(ongoing.length),
      detail: `${formatNumber(records.filter(record => record.status === 'Duruşta').length)} duruş izleniyor`,
      tone: records.some(record => record.status === 'Duruşta') ? 'warning' : 'neutral'
    },
    {
      id: 'average-line-efficiency',
      label: 'Ortalama Hat Verimliliği',
      value: formatPercent(averageEfficiency),
      detail: 'Planlanan / gerçekleşen üretim oranı',
      tone: averageEfficiency >= 85 ? 'success' : averageEfficiency >= 70 ? 'warning' : 'danger'
    },
    {
      id: 'waste-rate',
      label: 'Fire Oranı',
      value: formatPercent(wasteRate),
      detail: `${formatNumber(totalWaste, 1)} birim fire`,
      tone: wasteRate >= 7 ? 'danger' : wasteRate >= 4 ? 'warning' : 'success'
    },
    {
      id: 'oee',
      label: 'OEE',
      value: formatPercent(averageOee),
      detail: 'Availability x Performance x Quality',
      tone: averageOee >= 75 ? 'success' : averageOee >= 60 ? 'warning' : 'danger'
    }
  ]
}

const aggregateRows = (
  records: DailyProductionRecord[],
  getKey: (record: DailyProductionRecord) => string,
  getLabel: (record: DailyProductionRecord) => string,
  getValue: (record: DailyProductionRecord) => number,
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

const averageRows = (
  records: DailyProductionRecord[],
  getKey: (record: DailyProductionRecord) => string,
  getLabel: (record: DailyProductionRecord) => string,
  getValue: (record: DailyProductionRecord) => number,
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

const createHourlyRows = (records: DailyProductionRecord[]): BarChartRow[] => {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    id: `hour-${hour}`,
    label: `${padNumber(hour)}:00`,
    value: 0
  }))

  records.forEach(record => {
    const date = parseSafeDate(record.startAt)
    if(!date) return
    const row = buckets[date.getHours()]
    row.value = roundKpi(row.value + record.producedQuantity)
  })

  return buckets
    .filter(row => row.value > 0)
    .map(row => ({
      ...row,
      formattedValue: `${formatNumber(row.value, 1)} birim`,
      detail: 'Saatlik üretim'
    }))
}

const createWasteRows = (records: DailyProductionRecord[]) => (
  aggregateRows(
    records,
    record => record.wasteReason,
    record => record.wasteReason,
    record => record.wasteQuantity,
    value => `${formatNumber(value, 1)} birim`,
    'fire'
  )
)

const createOeeRows = (records: DailyProductionRecord[]): BarChartRow[] => {
  const buckets = [
    { id: 'oee-80', label: '80%+', min: 80, max: 101 },
    { id: 'oee-70', label: '70-79%', min: 70, max: 80 },
    { id: 'oee-60', label: '60-69%', min: 60, max: 70 },
    { id: 'oee-0', label: '0-59%', min: 0, max: 60 }
  ]

  return buckets.map(bucket => {
    const count = records.filter(record => record.oee >= bucket.min && record.oee < bucket.max).length
    return {
      id: bucket.id,
      label: bucket.label,
      value: count,
      formattedValue: formatNumber(count),
      detail: 'OEE dağılımı'
    }
  })
}

const createChartGroups = (records: DailyProductionRecord[]) => [
  { id: 'hourly-production', title: 'Saatlik Üretim', rows: createHourlyRows(records) },
  {
    id: 'line-production',
    title: 'Hat Bazlı Üretim',
    rows: aggregateRows(records, record => record.lineId, record => record.lineName, record => record.producedQuantity, value => `${formatNumber(value, 1)} birim`, 'üretim')
  },
  {
    id: 'product-production',
    title: 'Ürün Bazlı Üretim',
    rows: aggregateRows(records, record => record.productId, record => record.productName, record => record.producedQuantity, value => `${formatNumber(value, 1)} birim`, 'üretim')
  },
  {
    id: 'machine-utilization',
    title: 'Makine Kullanım Oranı',
    rows: averageRows(records, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`, record => record.machineUtilization, formatPercent, 'ortalama kullanım')
  },
  {
    id: 'operator-performance',
    title: 'Operatör Performansı',
    rows: averageRows(records, record => record.operatorId, record => record.operatorName, record => record.performance, formatPercent, 'ortalama performans')
  },
  { id: 'waste-distribution', title: 'Fire Dağılımı', rows: createWasteRows(records) },
  { id: 'oee-distribution', title: 'OEE Dağılımı', rows: createOeeRows(records) },
  {
    id: 'shift-performance',
    title: 'Vardiya Performansı',
    rows: averageRows(records, record => record.shift, record => record.shift, record => record.efficiency, formatPercent, 'ortalama verim', 4)
  }
]

const createOptions = (
  records: DailyProductionRecord[],
  getId: (record: DailyProductionRecord) => string,
  getLabel: (record: DailyProductionRecord) => string
) => Array.from(new Map(records.map(record => [getId(record), getLabel(record)])))
  .filter(([id]) => Boolean(id))
  .map(([id, label]) => ({ id, label }))
  .sort((first, second) => first.label.localeCompare(second.label, 'tr-TR'))

const mapRowsForOutput = (rows: DailyProductionRecord[]) => rows.map(row => ({
  'İş Emri No': row.workOrderNo,
  Ürün: row.productName,
  Reçete: row.recipeName,
  Şube: row.branchName,
  'Üretim Merkezi': row.workCenter,
  Hat: row.lineName,
  Makine: `${row.machineCode} / ${row.machineName}`,
  Operatör: row.operatorName,
  Vardiya: row.shift,
  Başlangıç: formatDateTime(row.startAt),
  Bitiş: formatDateTime(row.endAt),
  'Planlanan Süre': formatMinutes(row.plannedMinutes),
  'Gerçekleşen Süre': formatMinutes(row.actualMinutes),
  'Üretilen Miktar': `${formatNumber(row.producedQuantity, 1)} ${row.unit}`,
  Fire: `${formatNumber(row.wasteQuantity, 1)} ${row.unit}`,
  Verim: formatPercent(row.efficiency),
  OEE: formatPercent(row.oee),
  Durum: row.status
}))

const exportFilteredRows = (rows: DailyProductionRecord[]) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'production-planning',
    moduleLabel: 'Gunluk Uretim Analizi',
    sheetName: 'Günlük Üretim',
    fileNamePrefix: 'gunluk-uretim-analizi-filtreli',
    fileName: `gunluk-uretim-analizi-filtreli-${TODAY_KEY()}.xlsx`,
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
  rows: DailyProductionRecord[],
  kpis: DailyProductionKpi[],
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
  const tableRows = rows.slice(0, 120).map(row => `
    <tr>
      <td>${escapeHtml(row.workOrderNo)}</td>
      <td>${escapeHtml(row.productName)}</td>
      <td>${escapeHtml(row.lineName)}</td>
      <td>${escapeHtml(row.machineCode)}</td>
      <td>${escapeHtml(row.operatorName)}</td>
      <td>${escapeHtml(formatDateTime(row.startAt))}</td>
      <td>${escapeHtml(formatNumber(row.producedQuantity, 1))} ${escapeHtml(row.unit)}</td>
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
        <title>Günlük Üretim Analizi ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:28px; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
          h1 { margin:0; font-size:24px; }
          p { margin:6px 0 18px; color:${PRINT_THEME_COLORS.textMutedStrong}; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; }
          article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:8px; padding:12px; page-break-inside:avoid; }
          article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
          article strong { display:block; margin:6px 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:11px; }
          th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:7px; text-align:left; vertical-align:top; }
          th { background:${PRINT_THEME_COLORS.pageBackground}; }
          @media print { body { padding:16px; } }
        </style>
      </head>
      <body>
        <h1>Günlük Üretim Analizi</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>İş Emri</th><th>Ürün</th><th>Hat</th><th>Makine</th><th>Operatör</th><th>Başlangıç</th><th>Miktar</th><th>Verim</th><th>OEE</th><th>Durum</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="10">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function DailyProductionAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<ProductionAnalyticsFilters>(() => createDefaultFilters())
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const workCenterOptions = React.useMemo(() => createOptions(model.records, record => record.workCenter, record => record.workCenter), [model.records])
  const lineOptions = React.useMemo(() => createOptions(model.records, record => record.lineId, record => record.lineName), [model.records])
  const machineOptions = React.useMemo(() => createOptions(model.records, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`), [model.records])
  const productOptions = React.useMemo(() => createOptions(model.records, record => record.productId, record => record.productName), [model.records])
  const recipeOptions = React.useMemo(() => createOptions(model.records, record => record.recipeId, record => `${record.recipeCode} / ${record.recipeName}`), [model.records])
  const operatorOptions = React.useMemo(() => createOptions(model.records, record => record.operatorId, record => record.operatorName), [model.records])
  const dateOptions = React.useMemo(() => Array.from(new Set(model.records.map(record => record.date))).sort().reverse(), [model.records])

  const updateFilter = <TKey extends keyof ProductionAnalyticsFilters>(key: TKey, value: ProductionAnalyticsFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Günlük Üretim Analizi</h2>
          <p className="muted">Üretim emirleri, hat performansı, makine kullanımı, personel, reçete, fire, lot, kalite ve HACCP sonuçlarını tek ekranda analiz eder.</p>
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
        <span>{formatNumber(model.records.length)} seed/read-model üretim kaydı</span>
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
            <p className="muted">{formatNumber(filteredRecords.length)} kayıt listeleniyor. Bu ekran kayıt oluşturmaz veya üretim/stok değiştirmez.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters())}>Reset</button>
        </div>
        <div className="daily-production-filter-grid">
          <label className="form-field">
            <span>Tarih</span>
            <select value={filters.date} onChange={event => updateFilter('date', event.target.value)}>
              <option value="">Tüm Tarihler</option>
              {dateOptions.map(date => <option value={date} key={date}>{formatDate(date)}</option>)}
            </select>
          </label>
          <FilterSelect label="Şube" value={filters.branchId} options={branchOptions} onChange={value => updateFilter('branchId', value)} />
          <FilterSelect label="Üretim Merkezi" value={filters.workCenter} options={workCenterOptions} onChange={value => updateFilter('workCenter', value)} />
          <FilterSelect label="Hat" value={filters.lineId} options={lineOptions} onChange={value => updateFilter('lineId', value)} />
          <FilterSelect label="Makine" value={filters.machineId} options={machineOptions} onChange={value => updateFilter('machineId', value)} />
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Reçete" value={filters.recipeId} options={recipeOptions} onChange={value => updateFilter('recipeId', value)} />
          <FilterSelect label="Operatör" value={filters.operatorId} options={operatorOptions} onChange={value => updateFilter('operatorId', value)} />
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value as ProductionAnalyticsFilters['shift'])}>
              <option value={ALL_FILTER}>Tüm Vardiyalar</option>
              {SHIFT_OPTIONS.map(shift => <option value={shift} key={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as ProductionAnalyticsFilters['status'])}>
              <option value={ALL_FILTER}>Tüm Durumlar</option>
              {STATUS_OPTIONS.map(status => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="İş emri, ürün, hat, makine, operatör..." />
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
              <p className="muted">İş emri, ürün, hat, makine, operatör, süre, fire, verim ve OEE detayları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table">
              <thead>
                <tr>
                  <th>İş Emri No</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Hat</th>
                  <th>Makine</th>
                  <th>Operatör</th>
                  <th>Başlangıç</th>
                  <th>Bitiş</th>
                  <th>Planlanan Süre</th>
                  <th>Gerçekleşen Süre</th>
                  <th>Üretilen Miktar</th>
                  <th>Fire</th>
                  <th>Verim</th>
                  <th>OEE</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={15}>Filtrelere uygun üretim kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="İş Emri No"><strong>{record.workOrderNo}</strong><span>{record.shift}</span></td>
                    <td data-label="Ürün"><strong>{record.productName}</strong><span>{record.branchName}</span></td>
                    <td data-label="Reçete">{record.recipeName}</td>
                    <td data-label="Hat">{record.lineName}</td>
                    <td data-label="Makine"><strong>{record.machineCode}</strong><span>{record.machineName}</span></td>
                    <td data-label="Operatör">{record.operatorName}</td>
                    <td data-label="Başlangıç">{formatDateTime(record.startAt)}</td>
                    <td data-label="Bitiş">{formatDateTime(record.endAt)}</td>
                    <td data-label="Planlanan Süre">{formatMinutes(record.plannedMinutes)}</td>
                    <td data-label="Gerçekleşen Süre">{record.actualMinutes > 0 ? formatMinutes(record.actualMinutes) : '-'}</td>
                    <td data-label="Üretilen Miktar">{formatNumber(record.producedQuantity, 1)} {record.unit}</td>
                    <td data-label="Fire">{formatNumber(record.wasteQuantity, 1)} {record.unit}</td>
                    <td data-label="Verim"><span className={`status-pill ${record.efficiency >= 85 ? 'success' : record.efficiency >= 70 ? 'warning' : 'danger'}`}>{formatPercent(record.efficiency)}</span></td>
                    <td data-label="OEE"><span className={`status-pill ${record.oee >= 75 ? 'success' : record.oee >= 60 ? 'warning' : 'danger'}`}>{formatPercent(record.oee)}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${record.status === 'Tamamlandı' ? 'success' : record.status === 'Duruşta' ? 'danger' : 'warning'}`}>{record.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DailyProductionDetailPanel record={selectedRecord} />
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

function DailyProductionDetailPanel({ record }: { record?: DailyProductionRecord }){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-cell">Detay için bir üretim kaydı seçin.</div>
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
            <p className="muted">{record.workOrderNo} / {record.productName}</p>
          </div>
          <span className={`status-pill ${record.status === 'Tamamlandı' ? 'success' : record.status === 'Duruşta' ? 'danger' : 'warning'}`}>{record.status}</span>
        </div>

        <div className="daily-production-detail-grid">
          <div><span>İş Emri Özeti</span><strong>{record.workOrderNo}</strong><small>{record.branchName} / {record.shift}</small></div>
          <div><span>Üretim Geçmişi</span><strong>{formatDateTime(record.startAt)}</strong><small>{record.endAt ? formatDateTime(record.endAt) : 'Devam ediyor'}</small></div>
          <div><span>Kullanılan Reçete</span><strong>{record.recipeCode}</strong><small>{record.recipeName}</small></div>
          <div><span>Operatör Bilgisi</span><strong>{record.operatorName}</strong><small>{record.operatorTitle}</small></div>
          <div><span>Makine Bilgisi</span><strong>{record.machineCode}</strong><small>{record.machineName}</small></div>
          <div><span>OEE</span><strong>{formatPercent(record.oee)}</strong><small>A {formatPercent(record.availability)} / P {formatPercent(record.performance)} / Q {formatPercent(record.quality)}</small></div>
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Üretim Geçmişi</h3>
            <p className="muted">Read-model işlem akışı.</p>
          </div>
        </div>
        <div className="daily-production-timeline">
          {record.history.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              <strong>{item.label}</strong>
              <span>{formatDateTime(item.timestamp)}</span>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Lot, Fire ve Kalite</h3>
            <p className="muted">Kullanılan lotlar, fire sebepleri, kalite ve HACCP sonuçları.</p>
          </div>
        </div>
        <div className="daily-production-module-list">
          <div>
            <strong>Kullanılan Lotlar</strong>
            {record.usedLots.map(lot => (
              <span key={lot.lotNo}>{lot.lotNo} / {lot.productName} / {formatNumber(lot.quantity, 1)} {lot.unit} / SKT {formatDate(lot.expiryDate)}</span>
            ))}
          </div>
          <div>
            <strong>Fire Sebepleri</strong>
            <span>{record.wasteReason} / {formatNumber(record.wasteQuantity, 1)} {record.unit} / {formatPercent(record.wasteRate)}</span>
          </div>
          <div>
            <strong>Kalite Sonuçları</strong>
            <span>{formatQualityResult(record.qualityResult)} / kalite etkisi {formatPercent(record.quality)}</span>
          </div>
          <div>
            <strong>HACCP Sonuçları</strong>
            <span>{formatHaccpResult(record.haccpResult)} / kritik kontrol noktaları analiz edildi.</span>
          </div>
          <div>
            <strong>Kullanılan Reçete</strong>
            {record.recipeIngredients.slice(0, 5).map(ingredient => (
              <span key={`${record.id}-${ingredient.materialName}`}>{ingredient.materialName}: {formatNumber(ingredient.quantity, 2)} {ingredient.unit}</span>
            ))}
          </div>
        </div>
      </section>
    </aside>
  )
}
