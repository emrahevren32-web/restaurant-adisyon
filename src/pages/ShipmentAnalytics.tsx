import React from 'react'
import * as XLSX from 'xlsx'
import { DeliveryNoteService } from '../delivery-notes/delivery-note.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import { ShipmentOptimizationService } from '../shipment-optimization/shipment-optimization.service'
import type { ShipmentOptimizationItem } from '../shipment-optimization/shipment-optimization.types'
import type { User } from '../types'

type ShipmentAnalyticsStatus = 'Teslim Edildi' | 'Yolda' | 'Yüklendi' | 'Planlandı' | 'Gecikti' | 'İptal'

type ShipmentAnalyticsFilters = {
  startDate: string
  endDate: string
  branchId: string
  vehicleId: string
  driverId: string
  customerId: string
  routeId: string
  status: ShipmentAnalyticsStatus | 'all'
  productId: string
  lotId: string
  search: string
}

type ShipmentVehicleOption = {
  id: string
  vehicleNo: string
  plateNumber: string
  vehicleName: string
  vehicleType: string
  capacityKg: number
  driverId: string
  driverName: string
}

type ShipmentDriverOption = {
  id: string
  name: string
  title: string
  shift: string
  performanceScore: number
}

type ShipmentCustomerOption = {
  id: string
  name: string
  segment: string
  deliveryWindow: string
}

type ShipmentRouteOption = {
  id: string
  name: string
  region: string
  distanceKm: number
  baseMinutes: number
}

type ShipmentProductOption = {
  id: string
  name: string
  unit: string
}

type ShipmentTemperaturePoint = {
  label: string
  time: string
  temperatureC: number
  result: 'Uygun' | 'Uyarı' | 'Kritik'
}

type ShipmentDeliveryProof = {
  label: string
  value: string
  result: 'Tamam' | 'Eksik' | 'Uyarı'
}

type ShipmentAnalyticsRecord = {
  id: string
  shipmentNo: string
  shipmentDate: string
  plannedDeliveryAt: string
  actualDeliveryAt: string
  departureAt: string
  vehicleId: string
  vehicleNo: string
  vehiclePlate: string
  vehicleName: string
  vehicleType: string
  driverId: string
  driverName: string
  driverTitle: string
  customerId: string
  customerName: string
  branchId: string
  branchName: string
  routeId: string
  routeName: string
  region: string
  loadingMinutes: number
  waitingMinutes: number
  deliveryMinutes: number
  status: ShipmentAnalyticsStatus
  delayMinutes: number
  cost: number
  fuelCost: number
  routeDistanceKm: number
  vehicleUtilization: number
  plannedQuantity: number
  deliveredQuantity: number
  unit: string
  deliveryPointCount: number
  performanceScore: number
  onTime: boolean
  inFull: boolean
  otif: boolean
  coldChainRequired: boolean
  minTemperatureC: number
  maxTemperatureC: number
  averageTemperatureC: number
  temperatureHistory: ShipmentTemperaturePoint[]
  productId: string
  productName: string
  lotId: string
  lotNo: string
  haccpResult: 'Uygun' | 'Uyarı' | 'Kritik'
  haccpControls: ShipmentDeliveryProof[]
  deliveryProofs: ShipmentDeliveryProof[]
  criticalWarnings: string[]
  shipmentPlanNo: string
  deliveryNoteNo: string
  shipmentFormNo: string
  sourceSummary: string
  createdAt: string
}

type ShipmentAnalyticsKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type ShipmentAnalyticsModel = {
  sourceData: KpiSourceData
  records: ShipmentAnalyticsRecord[]
  optimizationItems: ShipmentOptimizationItem[]
  generatedAt: string
}

type OptionItem = {
  id: string
  name: string
}

const ALL_FILTER = 'all'
const RECORD_COUNT = 600
const VEHICLE_COUNT = 80
const DRIVER_COUNT = 120
const CUSTOMER_COUNT = 250
const COLD_CHAIN_MIN_COUNT = 300
const DELAY_SCENARIO_COUNT = 150
const OTIF_VIOLATION_COUNT = 80
const STATUS_OPTIONS: ShipmentAnalyticsStatus[] = ['Teslim Edildi', 'Yolda', 'Yüklendi', 'Planlandı', 'Gecikti', 'İptal']

const DRIVER_NAMES = [
  'Ayhan Demir',
  'Selin Acar',
  'Mert Öztürk',
  'Nesrin Koç',
  'Kerem Yıldız',
  'Ahmet Kaya',
  'Deniz Uslu',
  'Seda Arslan',
  'Murat Çelik',
  'Elif Şahin',
  'Can Polat',
  'Fatma Aydın',
  'Ali Koç',
  'Derya Aksoy',
  'Hakan Güneş',
  'Zeynep Kaplan',
  'Okan Yalçın',
  'Burcu Keskin',
  'Tuna Ergin',
  'İrem Doğan'
]

const CUSTOMER_NAMES = [
  'Anadolu Üniversite Kampüsü',
  'Marmara Kurumsal Yemekhane',
  'Kuzey Özel Hastane',
  'Batı Lojistik Deposu',
  'Merkez Fabrika Yemekhanesi',
  'Organize Sanayi Catering Noktası',
  'Avrupa Bölge Dağıtım Merkezi',
  'Anadolu Bölge Dağıtım Merkezi',
  'Kocaeli Üretim Tesisi',
  'Bursa Kamu Yemek Hizmeti',
  'Tekirdağ Endüstriyel Mutfak',
  'Sakarya Eğitim Kampüsü',
  'Ankara Kamu Kurumu',
  'Ege Lojistik Aktarma',
  'Trakya Hastane Grubu',
  'İstanbul Toplu Yemek Tesisi'
]

const ROUTE_TEMPLATES = [
  { name: 'İstanbul Avrupa Sabah Rotası', region: 'İstanbul Avrupa', distanceKm: 42, baseMinutes: 126 },
  { name: 'İstanbul Anadolu Hastane Rotası', region: 'İstanbul Anadolu', distanceKm: 55, baseMinutes: 148 },
  { name: 'Gebze Organize Sanayi Rotası', region: 'Gebze Organize', distanceKm: 68, baseMinutes: 166 },
  { name: 'Kocaeli Körfez Dağıtımı', region: 'Kocaeli Körfez', distanceKm: 83, baseMinutes: 184 },
  { name: 'Bursa Merkez Kurumsal Rota', region: 'Bursa Merkez', distanceKm: 112, baseMinutes: 230 },
  { name: 'Tekirdağ Çorlu Gece Rotası', region: 'Tekirdağ Çorlu', distanceKm: 119, baseMinutes: 242 },
  { name: 'Sakarya Kuzey Sevkiyat Rotası', region: 'Sakarya Kuzey', distanceKm: 98, baseMinutes: 210 },
  { name: 'Ankara Batı Aktarma Rotası', region: 'Ankara Batı', distanceKm: 318, baseMinutes: 420 },
  { name: 'Edirne Kamu Teslimat Rotası', region: 'Edirne Merkez', distanceKm: 235, baseMinutes: 330 },
  { name: 'Yalova Soğuk Zincir Rotası', region: 'Yalova Merkez', distanceKm: 92, baseMinutes: 205 },
  { name: 'Balıkesir Kampüs Rotası', region: 'Balıkesir Merkez', distanceKm: 188, baseMinutes: 296 },
  { name: 'İzmit Acil Teslimat Rotası', region: 'İzmit Merkez', distanceKm: 76, baseMinutes: 174 }
]

const VEHICLE_TYPES = ['Panelvan', 'Kamyon', 'Soğutmalı', 'Yarı Römork', 'Karma Dağıtım']
const PRODUCT_FALLBACKS = [
  'Izgara Tavuk Fileto',
  'Dana Kavurma',
  'Etli Nohut',
  'Mercimek Çorbası',
  'Sebzeli Bulgur Pilavı',
  'Pirinç Pilavı',
  'Fırın Köfte',
  'Tavuk Sote',
  'Mevsim Salata',
  'Ayran Dolum',
  'Sütlaç',
  'Paketli Sandviç',
  'Vakum Pişmiş Et',
  'Diyet Menü Seti',
  'Yoğurtlu Semizotu',
  'Kremalı Mantar Çorbası'
]
const COLD_CHAIN_KEYWORDS = ['süt', 'yoğurt', 'ayran', 'et', 'tavuk', 'donuk', 'soğuk', 'şarküteri', 'balık']

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const clamp = (value: number, min = 0, max = 100) => (
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
)

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toDateKey = (value: unknown, fallback = new Date().toLocaleDateString('sv-SE')) => {
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('sv-SE')
  const text = normalizeText(value)
  if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = text ? new Date(text) : new Date(`${fallback}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value: unknown, fallback = new Date().toISOString()) => {
  const text = normalizeText(value)
  const date = text
    ? new Date(text.includes('T') ? text : `${text}T00:00:00`)
    : new Date(fallback)
  if(!Number.isNaN(date.getTime())) return date

  const fallbackDate = new Date(fallback)
  return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate
}

const addDays = (dateKey: string, days: number) => {
  const date = parseSafeDate(`${toDateKey(dateKey)}T00:00:00`)
  date.setDate(date.getDate() + Math.round(safeNumber(days)))
  return date.toLocaleDateString('sv-SE')
}

const createDateTime = (dateKey: string, hour: number, minute = 0) => {
  const date = parseSafeDate(`${toDateKey(dateKey)}T00:00:00`)
  date.setHours(clamp(Math.round(hour), 0, 23), clamp(Math.round(minute), 0, 59), 0, 0)
  return date.toISOString()
}

const addMinutes = (value: string, minutes: number) => {
  const date = parseSafeDate(value)
  date.setMinutes(date.getMinutes() + Math.round(safeNumber(minutes)))
  return date.toISOString()
}

const diffMinutes = (start: string, end: string) => {
  const startMs = parseSafeDate(start).getTime()
  const endMs = parseSafeDate(end).getTime()
  const diff = (endMs - startMs) / 60000
  return Number.isFinite(diff) && diff > 0 ? roundKpi(diff) : 0
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = parseSafeDate(value)
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = parseSafeDate(value)
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatMinutes = (value: number) => `${formatNumber(toFiniteNumber(value), 0)} dk`

const escapeHtml = (value: unknown) => normalizeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const getStatusClass = (status: ShipmentAnalyticsStatus) => {
  if(status === 'Teslim Edildi') return 'success'
  if(status === 'Gecikti' || status === 'İptal') return 'danger-pill'
  if(status === 'Yolda' || status === 'Yüklendi') return 'warning-pill'
  return 'muted-pill'
}

const getScoreClass = (score: number) => {
  if(score >= 85) return 'success'
  if(score >= 70) return 'warning-pill'
  return 'danger-pill'
}

const getResultClass = (result: string) => {
  if(result === 'Uygun' || result === 'Tamam') return 'success'
  if(result === 'Kritik' || result === 'Eksik') return 'danger-pill'
  return 'warning-pill'
}

const createIdFromName = (prefix: string, name: string, index: number) => (
  `${prefix}_${normalizeSearchText(name).replace(/[^a-z0-9]+/gi, '_') || index + 1}_${index + 1}`
)

const createUniqueOptions = (
  options: OptionItem[]
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createDrivers = (sourceData: KpiSourceData): ShipmentDriverOption[] => {
  const sourceNames = Array.from(new Set([
    ...sourceData.shipmentVehicles.map(vehicle => vehicle.driverName),
    ...sourceData.shipmentPlans.map(plan => plan.driverName)
  ].map(normalizeText).filter(Boolean)))

  return Array.from({ length: DRIVER_COUNT }, (_, index) => {
    const name = sourceNames[index] || `${DRIVER_NAMES[index % DRIVER_NAMES.length]} ${String(Math.floor(index / DRIVER_NAMES.length) + 1).padStart(2, '0')}`
    return {
      id: createIdFromName('driver', name, index),
      name,
      title: index % 5 === 0 ? 'Kıdemli Sevkiyat Şoförü' : index % 3 === 0 ? 'Soğuk Zincir Şoförü' : 'Sevkiyat Şoförü',
      shift: index % 3 === 0 ? 'Gece' : index % 3 === 1 ? 'Sabah' : 'Akşam',
      performanceScore: clamp(72 + (index % 24) + (index % 7) * 0.3, 55, 99)
    }
  })
}

const createVehicles = (
  sourceData: KpiSourceData,
  drivers: ShipmentDriverOption[]
): ShipmentVehicleOption[] => Array.from({ length: VEHICLE_COUNT }, (_, index) => {
  const sourceVehicle = index < sourceData.shipmentVehicles.length ? sourceData.shipmentVehicles[index] : null
  const driver = drivers[index % Math.max(drivers.length, 1)]
  const vehicleType = normalizeText(sourceVehicle?.vehicleType) || VEHICLE_TYPES[index % VEHICLE_TYPES.length]
  const capacityKg = safeNumber(sourceVehicle?.maxWeight, [950, 1800, 2400, 3200, 4200, 8500][index % 6])

  return {
    id: sourceVehicle?.id || `analytics_vehicle_${String(index + 1).padStart(3, '0')}`,
    vehicleNo: sourceVehicle?.vehicleNo || `VH-A-${String(index + 1).padStart(3, '0')}`,
    plateNumber: sourceVehicle?.plateNumber || `34 SA ${String(100 + index).padStart(3, '0')}`,
    vehicleName: sourceVehicle?.vehicleName || (index % 3 === 0 ? `Soğuk Zincir Araç ${index + 1}` : `Bölge Dağıtım Araç ${index + 1}`),
    vehicleType,
    capacityKg,
    driverId: driver?.id || `driver_${index + 1}`,
    driverName: normalizeText(sourceVehicle?.driverName) || driver?.name || 'Sevkiyat Şoförü'
  }
})

const createCustomers = (sourceData: KpiSourceData): ShipmentCustomerOption[] => {
  const deliveryNotes = DeliveryNoteService.list(sourceData)
  const forms = ShipmentFormService.list(sourceData)
  const sourceNames = Array.from(new Set([
    ...deliveryNotes.map(note => note.customerName),
    ...forms.map(form => form.customerName)
  ].map(normalizeText).filter(Boolean)))

  return Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const name = sourceNames[index] || `${CUSTOMER_NAMES[index % CUSTOMER_NAMES.length]} ${String(Math.floor(index / CUSTOMER_NAMES.length) + 1).padStart(2, '0')}`
    return {
      id: createIdFromName('customer', name, index),
      name,
      segment: index % 4 === 0 ? 'Hastane' : index % 4 === 1 ? 'Kurumsal Yemekhane' : index % 4 === 2 ? 'Kamu' : 'Eğitim',
      deliveryWindow: index % 3 === 0 ? '06:00-09:00' : index % 3 === 1 ? '09:00-12:00' : '13:00-16:00'
    }
  })
}

const createRoutes = (): ShipmentRouteOption[] => (
  Array.from({ length: 32 }, (_, index) => {
    const template = ROUTE_TEMPLATES[index % ROUTE_TEMPLATES.length]
    return {
      id: `route_${String(index + 1).padStart(3, '0')}`,
      name: index < ROUTE_TEMPLATES.length ? template.name : `${template.region} Dağıtım Rotası ${Math.floor(index / ROUTE_TEMPLATES.length) + 1}`,
      region: template.region,
      distanceKm: roundKpi(template.distanceKm + (index % 5) * 7.5),
      baseMinutes: Math.round(template.baseMinutes + (index % 4) * 18)
    }
  })
)

const createProducts = (sourceData: KpiSourceData): ShipmentProductOption[] => {
  const productRefs = sourceData.productRefs.map(product => ({
    id: product.id || product.stockItemId || product.name,
    name: product.name,
    unit: product.unit || 'kg'
  }))
  const stockProducts = sourceData.stockItems.map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit || 'kg'
  }))
  const fallbackProducts = PRODUCT_FALLBACKS.map((name, index) => ({
    id: `fallback_product_${index + 1}`,
    name,
    unit: index % 5 === 0 ? 'lt' : index % 4 === 0 ? 'adet' : 'kg'
  }))

  return createUniqueOptions([...productRefs, ...stockProducts, ...fallbackProducts].map(product => ({
    id: product.id,
    name: product.name
  }))).map(option => {
    const product = [...productRefs, ...stockProducts, ...fallbackProducts].find(item => item.id === option.id)
    return {
      id: option.id,
      name: option.name,
      unit: product?.unit || 'kg'
    }
  })
}

const isColdChainProduct = (productName: string) => {
  const normalized = normalizeSearchText(productName)
  return COLD_CHAIN_KEYWORDS.some(keyword => normalized.includes(normalizeSearchText(keyword)))
}

const getSourceProduct = (
  index: number,
  sourceData: KpiSourceData,
  products: ShipmentProductOption[]
) => {
  const lot = sourceData.inventoryLots[index % Math.max(sourceData.inventoryLots.length, 1)]
  const productFromLot = lot
    ? sourceData.productRefs.find(product => product.id === lot.productId || product.stockItemId === lot.stockItemId)
    : null
  const stockItem = lot ? sourceData.stockItems.find(item => item.id === lot.stockItemId) : null
  const fallback = products[index % Math.max(products.length, 1)]

  return {
    productId: productFromLot?.id || stockItem?.id || fallback?.id || `product_${index + 1}`,
    productName: productFromLot?.name || stockItem?.name || fallback?.name || PRODUCT_FALLBACKS[index % PRODUCT_FALLBACKS.length],
    unit: productFromLot?.unit || stockItem?.unit || fallback?.unit || 'kg',
    lotId: lot?.id || `analytics_lot_${String(index + 1).padStart(4, '0')}`,
    lotNo: lot?.lotNo || `LOT-${String(2026000 + index + 1)}`
  }
}

const getBranch = (
  sourceData: KpiSourceData,
  branchId: string,
  index: number
) => {
  const branch = sourceData.branches.find(item => item.id === branchId)
    || sourceData.branches[index % Math.max(sourceData.branches.length, 1)]
  return {
    id: branch?.id || `branch_${index + 1}`,
    name: branch?.name || `Operasyon Şubesi ${index + 1}`
  }
}

const getDeliverySource = (
  index: number,
  sourceData: KpiSourceData
) => {
  const deliveryNotes = DeliveryNoteService.list(sourceData)
  const forms = ShipmentFormService.list(sourceData)
  const plan = sourceData.shipmentPlans[index % Math.max(sourceData.shipmentPlans.length, 1)] || null
  const shipment = sourceData.shipments[index % Math.max(sourceData.shipments.length, 1)] || null
  const execution = sourceData.shipmentExecutions[index % Math.max(sourceData.shipmentExecutions.length, 1)] || null
  const note = deliveryNotes[index % Math.max(deliveryNotes.length, 1)] || null
  const form = forms[index % Math.max(forms.length, 1)] || null

  return { plan, shipment, execution, note, form }
}

const createTemperatureHistory = (
  departureAt: string,
  coldChainRequired: boolean,
  violation: boolean,
  index: number
): ShipmentTemperaturePoint[] => {
  const base = coldChainRequired ? 2.4 + (index % 5) * 0.55 : 10 + (index % 6) * 0.8
  const stages = [
    { label: 'Yükleme Öncesi', offset: -30 },
    { label: 'Yükleme Sonrası', offset: 0 },
    { label: 'Ara Teslimat', offset: 92 },
    { label: 'Teslim Anı', offset: 168 }
  ]

  return stages.map((stage, stageIndex) => {
    const drift = stageIndex * 0.45 + (index % 3) * 0.18
    const temperatureC = roundKpi(base + drift + (violation && stageIndex >= 2 ? 4.6 : 0))
    const result: ShipmentTemperaturePoint['result'] = !coldChainRequired
      ? 'Uygun'
      : temperatureC > 8
        ? 'Kritik'
        : temperatureC > 6
          ? 'Uyarı'
          : 'Uygun'
    return {
      label: stage.label,
      time: addMinutes(departureAt, stage.offset),
      temperatureC,
      result
    }
  })
}

const createProofs = (
  recordIndex: number,
  otifViolation: boolean,
  coldChainViolation: boolean
): ShipmentDeliveryProof[] => [
  {
    label: 'Teslim imzası',
    value: otifViolation && recordIndex % 5 === 0 ? 'Eksik imza bekliyor' : 'Dijital imza alındı',
    result: otifViolation && recordIndex % 5 === 0 ? 'Eksik' : 'Tamam'
  },
  {
    label: 'İrsaliye teyidi',
    value: otifViolation && recordIndex % 7 === 0 ? 'Miktar farkı kontrol ediliyor' : 'İrsaliye kalemleri eşleşti',
    result: otifViolation && recordIndex % 7 === 0 ? 'Uyarı' : 'Tamam'
  },
  {
    label: 'Sıcaklık kanıtı',
    value: coldChainViolation ? 'Limit dışı sıcaklık sinyali var' : 'Sıcaklık aralığı uygun',
    result: coldChainViolation ? 'Uyarı' : 'Tamam'
  }
]

const createHaccpControls = (
  coldChainViolation: boolean,
  delayMinutes: number,
  index: number
): ShipmentDeliveryProof[] => [
  {
    label: 'Araç hijyen kontrolü',
    value: index % 37 === 0 ? 'Tekrar kontrol notu açıldı' : 'Uygun',
    result: index % 37 === 0 ? 'Uyarı' : 'Tamam'
  },
  {
    label: 'Soğuk zincir CCP',
    value: coldChainViolation ? 'Kritik limit aşıldı' : 'Kritik limit içinde',
    result: coldChainViolation ? 'Eksik' : 'Tamam'
  },
  {
    label: 'Teslim bekleme süresi',
    value: delayMinutes > 60 ? 'Bekleme süresi kritik' : 'Bekleme süresi kabul edilebilir',
    result: delayMinutes > 60 ? 'Uyarı' : 'Tamam'
  }
]

const createCriticalWarnings = ({
  delayMinutes,
  vehicleUtilization,
  coldChainViolation,
  otif,
  cost,
  status
}: {
  delayMinutes: number
  vehicleUtilization: number
  coldChainViolation: boolean
  otif: boolean
  cost: number
  status: ShipmentAnalyticsStatus
}) => {
  const warnings: string[] = []
  if(status === 'İptal') warnings.push('Sevkiyat iptal durumunda; yalnızca raporlama için izleniyor.')
  if(delayMinutes > 0) warnings.push(`${formatMinutes(delayMinutes)} gecikme tespit edildi.`)
  if(vehicleUtilization < 55) warnings.push('Araç doluluğu düşük; rota konsolidasyonu değerlendirilmeli.')
  if(vehicleUtilization > 96) warnings.push('Araç doluluğu kritik sınıra yakın.')
  if(coldChainViolation) warnings.push('Soğuk zincir sıcaklık limiti aşıldı.')
  if(!otif) warnings.push('OTIF kriteri sağlanmadı.')
  if(cost > 15500) warnings.push('Sevkiyat maliyeti rota ortalamasının üzerinde.')
  return warnings
}

const createShipmentRecords = (
  sourceData: KpiSourceData,
  vehicles: ShipmentVehicleOption[],
  drivers: ShipmentDriverOption[],
  customers: ShipmentCustomerOption[],
  routes: ShipmentRouteOption[],
  products: ShipmentProductOption[]
): ShipmentAnalyticsRecord[] => {
  const today = toDateKey(new Date())

  return Array.from({ length: RECORD_COUNT }, (_, index) => {
    const source = getDeliverySource(index, sourceData)
    const vehicle = vehicles.find(item => item.id === source.plan?.vehicleId || item.id === source.note?.vehicleId || item.id === source.form?.vehicleId)
      || vehicles[index % Math.max(vehicles.length, 1)]
    const driver = drivers.find(item => item.name === vehicle?.driverName)
      || drivers[index % Math.max(drivers.length, 1)]
    const customer = customers[index % Math.max(customers.length, 1)]
    const route = routes[index % Math.max(routes.length, 1)]
    const product = getSourceProduct(index, sourceData, products)
    const sourceDate = source.note?.date || source.form?.loadingDate || source.plan?.planDate || source.shipment?.shipmentDate || addDays(today, -(index % 45))
    const shipmentDate = toDateKey(sourceDate, addDays(today, -(index % 45)))
    const departureAt = createDateTime(shipmentDate, 5 + (index % 11), (index * 7) % 60)
    const isDelayScenario = index < DELAY_SCENARIO_COUNT || index % 4 === 0
    const delayMinutes = isDelayScenario ? 12 + ((index * 11) % 108) : 0
    const loadingMinutes = 22 + (index % 8) * 6 + (index % 17 === 0 ? 18 : 0)
    const waitingMinutes = 8 + (index % 6) * 5 + (delayMinutes > 0 ? Math.round(delayMinutes * 0.35) : 0)
    const deliveryMinutes = route.baseMinutes + waitingMinutes + Math.round(delayMinutes * 0.65)
    const plannedDeliveryAt = addMinutes(departureAt, route.baseMinutes + loadingMinutes)
    const actualDeliveryAt = addMinutes(departureAt, loadingMinutes + deliveryMinutes)
    const branch = getBranch(
      sourceData,
      source.note?.branchId || source.form?.branchId || source.plan?.stops[0]?.branchId || source.shipment?.destinationBranchId || '',
      index
    )
    const deliveryPointCount = index < 400 ? 2 : 1
    const coldChainRequired = index < COLD_CHAIN_MIN_COUNT || isColdChainProduct(product.productName)
    const coldChainViolation = coldChainRequired && (index % 19 === 0 || (delayMinutes > 70 && index % 3 === 0))
    const otifViolation = index < OTIF_VIOLATION_COUNT || delayMinutes > 0
    const onTime = delayMinutes === 0 && index >= OTIF_VIOLATION_COUNT
    const inFull = !otifViolation || index % 3 !== 0
    const otif = onTime && inFull
    const plannedQuantity = 180 + (index % 12) * 42 + deliveryPointCount * 18
    const deliveredQuantity = roundKpi(inFull ? plannedQuantity : plannedQuantity * (0.88 + (index % 5) * 0.018))
    const utilizationBase = percent(deliveredQuantity, safeNumber(vehicle?.capacityKg, 1800))
    const vehicleUtilization = clamp(52 + utilizationBase * 0.42 + (index % 14), 34, 99)
    const routeDistanceKm = roundKpi(route.distanceKm + (index % 7) * 2.5)
    const fuelCost = roundKpi(routeDistanceKm * (vehicle?.vehicleType === 'Soğutmalı' ? 18.4 : 15.8))
    const cost = roundKpi(clamp(
      fuelCost + routeDistanceKm * 21 + loadingMinutes * 11 + waitingMinutes * 16 + deliveryPointCount * 275 + deliveredQuantity * 0.38,
      850,
      18500
    ))
    const performanceScore = roundKpi(clamp(
      98
      - delayMinutes * 0.16
      - waitingMinutes * 0.08
      - (coldChainViolation ? 14 : 0)
      - (!inFull ? 9 : 0)
      - (vehicleUtilization < 60 ? 5 : 0),
      38,
      99
    ))
    const status: ShipmentAnalyticsStatus = source.note?.status === 'CANCELLED' || source.shipment?.status === 'CANCELLED'
      ? 'İptal'
      : delayMinutes > 0
        ? 'Gecikti'
        : index % 11 === 0
          ? 'Yolda'
          : index % 13 === 0
            ? 'Yüklendi'
            : index % 17 === 0
              ? 'Planlandı'
              : 'Teslim Edildi'
    const temperatureHistory = createTemperatureHistory(departureAt, coldChainRequired, coldChainViolation, index)
    const averageTemperatureC = averageBy(temperatureHistory, item => item.temperatureC)
    const minTemperatureC = Math.min(...temperatureHistory.map(item => item.temperatureC))
    const maxTemperatureC = Math.max(...temperatureHistory.map(item => item.temperatureC))
    const haccpControls = createHaccpControls(coldChainViolation, delayMinutes, index)
    const haccpResult: ShipmentAnalyticsRecord['haccpResult'] = haccpControls.some(item => item.result === 'Eksik')
      ? 'Kritik'
      : haccpControls.some(item => item.result === 'Uyarı')
        ? 'Uyarı'
        : 'Uygun'
    const deliveryProofs = createProofs(index, otifViolation, coldChainViolation)
    const record: ShipmentAnalyticsRecord = {
      id: `shipment_analytics_${String(index + 1).padStart(4, '0')}`,
      shipmentNo: source.note?.shipmentNo || source.form?.shipmentNo || source.shipment?.shipmentNo || `SHP-A-${String(index + 1).padStart(6, '0')}`,
      shipmentDate,
      plannedDeliveryAt,
      actualDeliveryAt,
      departureAt,
      vehicleId: vehicle?.id || `vehicle_${index + 1}`,
      vehicleNo: vehicle?.vehicleNo || `VH-A-${index + 1}`,
      vehiclePlate: vehicle?.plateNumber || '',
      vehicleName: vehicle?.vehicleName || 'Sevkiyat Aracı',
      vehicleType: vehicle?.vehicleType || VEHICLE_TYPES[index % VEHICLE_TYPES.length],
      driverId: driver?.id || `driver_${index + 1}`,
      driverName: vehicle?.driverName || driver?.name || 'Sevkiyat Şoförü',
      driverTitle: driver?.title || 'Sevkiyat Şoförü',
      customerId: customer?.id || `customer_${index + 1}`,
      customerName: source.note?.customerName || source.form?.customerName || customer?.name || `Müşteri ${index + 1}`,
      branchId: branch.id,
      branchName: branch.name,
      routeId: route.id,
      routeName: route.name,
      region: route.region,
      loadingMinutes,
      waitingMinutes,
      deliveryMinutes,
      status,
      delayMinutes,
      cost,
      fuelCost,
      routeDistanceKm,
      vehicleUtilization,
      plannedQuantity,
      deliveredQuantity,
      unit: product.unit,
      deliveryPointCount,
      performanceScore,
      onTime,
      inFull,
      otif,
      coldChainRequired,
      minTemperatureC,
      maxTemperatureC,
      averageTemperatureC,
      temperatureHistory,
      productId: product.productId,
      productName: product.productName,
      lotId: product.lotId,
      lotNo: product.lotNo,
      haccpResult,
      haccpControls,
      deliveryProofs,
      criticalWarnings: [],
      shipmentPlanNo: source.note?.shipmentPlanNo || source.form?.shipmentPlanNo || source.plan?.shipmentPlanNo || `SP-A-${String(index + 1).padStart(6, '0')}`,
      deliveryNoteNo: source.note?.deliveryNoteNo || source.form?.deliveryNoteNo || `DN-A-${String(index + 1).padStart(6, '0')}`,
      shipmentFormNo: source.form?.formNo || `SF-A-${String(index + 1).padStart(6, '0')}`,
      sourceSummary: [
        source.shipment ? 'Sevkiyat' : '',
        source.plan ? 'Plan' : '',
        source.note ? 'İrsaliye' : '',
        source.form ? 'Sevkiyat Formu' : ''
      ].filter(Boolean).join(' + ') || 'Analitik read-model',
      createdAt: addMinutes(departureAt, -90)
    }

    return {
      ...record,
      criticalWarnings: createCriticalWarnings({
        delayMinutes: record.delayMinutes,
        vehicleUtilization: record.vehicleUtilization,
        coldChainViolation,
        otif: record.otif,
        cost: record.cost,
        status: record.status
      })
    }
  })
}

const createModel = (): ShipmentAnalyticsModel => {
  const sourceData = loadKpiSourceData()
  const drivers = createDrivers(sourceData)
  const vehicles = createVehicles(sourceData, drivers)
  const customers = createCustomers(sourceData)
  const routes = createRoutes()
  const products = createProducts(sourceData)
  const records = createShipmentRecords(sourceData, vehicles, drivers, customers, routes, products)
  const optimizationItems = ShipmentOptimizationService.list(sourceData).flatMap(report => report.items)

  return {
    sourceData,
    records,
    optimizationItems,
    generatedAt: new Date().toISOString()
  }
}

const createDefaultFilters = (records: ShipmentAnalyticsRecord[] = []): ShipmentAnalyticsFilters => {
  const dates = records.map(record => record.shipmentDate).filter(Boolean).sort()
  return {
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
    branchId: ALL_FILTER,
    vehicleId: ALL_FILTER,
    driverId: ALL_FILTER,
    customerId: ALL_FILTER,
    routeId: ALL_FILTER,
    status: ALL_FILTER,
    productId: ALL_FILTER,
    lotId: ALL_FILTER,
    search: ''
  }
}

const matchesFilter = (
  record: ShipmentAnalyticsRecord,
  filters: ShipmentAnalyticsFilters
) => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    record.shipmentNo,
    record.shipmentPlanNo,
    record.deliveryNoteNo,
    record.shipmentFormNo,
    record.vehicleNo,
    record.vehiclePlate,
    record.driverName,
    record.customerName,
    record.branchName,
    record.routeName,
    record.region,
    record.productName,
    record.lotNo,
    record.status
  ].join(' ')

  return (
    (!filters.startDate || record.shipmentDate >= filters.startDate)
    && (!filters.endDate || record.shipmentDate <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.vehicleId === ALL_FILTER || record.vehicleId === filters.vehicleId)
    && (filters.driverId === ALL_FILTER || record.driverId === filters.driverId)
    && (filters.customerId === ALL_FILTER || record.customerId === filters.customerId)
    && (filters.routeId === ALL_FILTER || record.routeId === filters.routeId)
    && (filters.status === ALL_FILTER || record.status === filters.status)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.lotId === ALL_FILTER || record.lotId === filters.lotId)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
}

const createKpis = (records: ShipmentAnalyticsRecord[]): ShipmentAnalyticsKpi[] => {
  const totalShipments = records.length
  const onTimeRate = percent(records.filter(record => record.onTime).length, totalShipments)
  const averageDeliveryMinutes = averageBy(records, record => record.deliveryMinutes)
  const averageCost = averageBy(records, record => record.cost)
  const otifRate = percent(records.filter(record => record.otif).length, totalShipments)
  const performanceScore = averageBy(records, record => record.performanceScore)

  return [
    {
      id: 'total-shipments',
      label: 'Toplam Sevkiyat',
      value: formatNumber(totalShipments),
      detail: 'Filtrelenmiş sevkiyat read-model kaydı',
      tone: 'neutral'
    },
    {
      id: 'on-time-delivery',
      label: 'Zamanında Teslimat Oranı',
      value: formatPercent(onTimeRate),
      detail: `${formatNumber(records.filter(record => record.onTime).length)} zamanında teslimat`,
      tone: onTimeRate >= 88 ? 'success' : onTimeRate >= 76 ? 'warning' : 'danger'
    },
    {
      id: 'average-delivery-time',
      label: 'Ortalama Teslim Süresi',
      value: formatMinutes(averageDeliveryMinutes),
      detail: 'Yükleme, bekleme ve rota süresi dahil',
      tone: averageDeliveryMinutes <= 220 ? 'success' : averageDeliveryMinutes <= 320 ? 'warning' : 'danger'
    },
    {
      id: 'average-shipment-cost',
      label: 'Ortalama Sevkiyat Maliyeti',
      value: formatCurrency(averageCost),
      detail: 'Yakıt, rota, yükleme ve teslimat maliyeti',
      tone: averageCost <= 7600 ? 'success' : averageCost <= 11800 ? 'warning' : 'danger'
    },
    {
      id: 'otif',
      label: 'Tam Zamanında Teslim (OTIF)',
      value: formatPercent(otifRate),
      detail: 'On-time ve in-full teslimat oranı',
      tone: otifRate >= 86 ? 'success' : otifRate >= 72 ? 'warning' : 'danger'
    },
    {
      id: 'shipment-performance-score',
      label: 'Sevkiyat Performans Skoru',
      value: formatPercent(performanceScore),
      detail: 'Gecikme, maliyet, doluluk ve kalite etkileri',
      tone: performanceScore >= 85 ? 'success' : performanceScore >= 70 ? 'warning' : 'danger'
    }
  ]
}

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string; formatter?: (value: number) => string; tone?: KpiTone }>,
  limit = 8
): BarChartRow[] => rows
  .filter(row => row.id && Number.isFinite(row.value))
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formatter ? row.formatter(row.value) : formatNumber(row.value, 1),
    detail: row.detail,
    tone: row.tone
  }))

const aggregateCountRows = (
  records: ShipmentAnalyticsRecord[],
  getKey: (record: ShipmentAnalyticsRecord) => string,
  getLabel: (record: ShipmentAnalyticsRecord) => string,
  detailSuffix: string
) => {
  const map = records.reduce<Map<string, { label: string; count: number; cost: number }>>((acc, record) => {
    const key = getKey(record)
    if(!key) return acc
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      count: (previous?.count || 0) + 1,
      cost: roundKpi((previous?.cost || 0) + record.cost)
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} ${detailSuffix} / ${formatCurrency(row.cost)}`,
    formatter: value => formatNumber(value)
  })))
}

const aggregateAverageRows = (
  records: ShipmentAnalyticsRecord[],
  getKey: (record: ShipmentAnalyticsRecord) => string,
  getLabel: (record: ShipmentAnalyticsRecord) => string,
  getValue: (record: ShipmentAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    if(!key) return acc
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
      tone: average >= 85 ? 'success' as KpiTone : average >= 70 ? 'warning' as KpiTone : 'danger' as KpiTone
    }
  }))
}

const aggregateSumRows = (
  records: ShipmentAnalyticsRecord[],
  getKey: (record: ShipmentAnalyticsRecord) => string,
  getLabel: (record: ShipmentAnalyticsRecord) => string,
  getValue: (record: ShipmentAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    if(!key) return acc
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

const createDailyRows = (
  records: ShipmentAnalyticsRecord[],
  metric: 'count' | 'onTimeRate'
) => {
  const map = records.reduce<Map<string, ShipmentAnalyticsRecord[]>>((acc, record) => {
    acc.set(record.shipmentDate, [...(acc.get(record.shipmentDate) || []), record])
    return acc
  }, new Map())

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([date, items]) => {
      const value = metric === 'count'
        ? items.length
        : percent(items.filter(item => item.onTime).length, items.length)
      return {
        id: `${metric}-${date}`,
        label: formatDate(date),
        value,
        formattedValue: metric === 'count' ? formatNumber(value) : formatPercent(value),
        detail: metric === 'count'
          ? `${formatNumber(sumBy(items, item => item.deliveryPointCount))} teslimat noktası`
          : `${formatNumber(items.filter(item => item.onTime).length)} zamanında / ${formatNumber(items.length)} sevkiyat`,
        tone: metric === 'onTimeRate'
          ? value >= 88 ? 'success' as KpiTone : value >= 76 ? 'warning' as KpiTone : 'danger' as KpiTone
          : undefined
      }
    })
}

const createDeliveryTimeDistribution = (records: ShipmentAnalyticsRecord[]) => {
  const buckets = [
    { id: '0-120', label: '0-120 dk', min: 0, max: 120 },
    { id: '121-180', label: '121-180 dk', min: 121, max: 180 },
    { id: '181-240', label: '181-240 dk', min: 181, max: 240 },
    { id: '241-320', label: '241-320 dk', min: 241, max: 320 },
    { id: '321+', label: '321+ dk', min: 321, max: Number.POSITIVE_INFINITY }
  ]

  return toBarRows(buckets.map(bucket => {
    const count = records.filter(record => record.deliveryMinutes >= bucket.min && record.deliveryMinutes <= bucket.max).length
    return {
      id: bucket.id,
      label: bucket.label,
      value: count,
      detail: `${formatNumber(count)} sevkiyat`,
      formatter: value => formatNumber(value)
    }
  }), buckets.length)
}

const createChartGroups = (records: ShipmentAnalyticsRecord[]) => [
  {
    id: 'daily-shipment-count',
    title: 'Günlük Sevkiyat Sayısı',
    rows: createDailyRows(records, 'count')
  },
  {
    id: 'on-time-trends',
    title: 'Zamanında Teslimat Trendleri',
    rows: createDailyRows(records, 'onTimeRate')
  },
  {
    id: 'vehicle-utilization',
    title: 'Araç Doluluk Oranları',
    rows: aggregateAverageRows(records, record => record.vehicleId, record => `${record.vehicleNo} / ${record.vehiclePlate}`, record => record.vehicleUtilization, formatPercent, 'ortalama doluluk')
  },
  {
    id: 'vehicle-performance',
    title: 'Araç Bazlı Performans',
    rows: aggregateAverageRows(records, record => record.vehicleId, record => record.vehicleName, record => record.performanceScore, formatPercent, 'ortalama performans')
  },
  {
    id: 'driver-performance',
    title: 'Şoför Performansı',
    rows: aggregateAverageRows(records, record => record.driverId, record => record.driverName, record => record.performanceScore, formatPercent, 'ortalama skor')
  },
  {
    id: 'route-performance',
    title: 'Rota Performansı',
    rows: aggregateAverageRows(records, record => record.routeId, record => record.routeName, record => record.performanceScore, formatPercent, 'rota performansı')
  },
  {
    id: 'delivery-time-distribution',
    title: 'Teslim Süresi Dağılımı',
    rows: createDeliveryTimeDistribution(records)
  },
  {
    id: 'shipment-cost-analysis',
    title: 'Sevkiyat Maliyet Analizi',
    rows: aggregateSumRows(records, record => record.region, record => record.region, record => record.cost, formatCurrency, 'toplam maliyet')
  }
]

const createOptions = (
  records: ShipmentAnalyticsRecord[],
  getId: (record: ShipmentAnalyticsRecord) => string,
  getName: (record: ShipmentAnalyticsRecord) => string
) => createUniqueOptions(records.map(record => ({ id: getId(record), name: getName(record) })))

const mapRowsForOutput = (rows: ShipmentAnalyticsRecord[]) => rows.map(row => ({
  'Sevkiyat No': row.shipmentNo,
  'Sevkiyat Tarihi': formatDate(row.shipmentDate),
  Araç: `${row.vehicleNo} / ${row.vehiclePlate} / ${row.vehicleName}`,
  Şoför: row.driverName,
  Müşteri: row.customerName,
  Şube: row.branchName,
  Rota: row.routeName,
  Bölge: row.region,
  'Yükleme Süresi': row.loadingMinutes,
  'Teslim Süresi': row.deliveryMinutes,
  Durum: row.status,
  Gecikme: row.delayMinutes,
  Maliyet: row.cost,
  'Performans Skoru': row.performanceScore,
  OTIF: row.otif ? 'Evet' : 'Hayır',
  'Araç Doluluk (%)': row.vehicleUtilization,
  Ürün: row.productName,
  Lot: row.lotNo,
  'Soğuk Zincir': row.coldChainRequired ? 'Gerekli' : 'Gerekli Değil',
  'Ortalama Sıcaklık': row.averageTemperatureC,
  HACCP: row.haccpResult
}))

const exportFilteredRows = (rows: ShipmentAnalyticsRecord[]) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(mapRowsForOutput(rows))
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sevkiyat Analizi')
  XLSX.writeFile(workbook, `sevkiyat-analizi-filtreli-${toDateKey(new Date())}.xlsx`)
}

const openPrintWindow = (
  rows: ShipmentAnalyticsRecord[],
  kpis: ShipmentAnalyticsKpi[],
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
      <td>${escapeHtml(row.shipmentNo)}</td>
      <td>${escapeHtml(formatDate(row.shipmentDate))}</td>
      <td>${escapeHtml(row.vehicleNo)} / ${escapeHtml(row.vehiclePlate)}</td>
      <td>${escapeHtml(row.driverName)}</td>
      <td>${escapeHtml(row.customerName)}</td>
      <td>${escapeHtml(row.routeName)}</td>
      <td>${escapeHtml(formatMinutes(row.deliveryMinutes))}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(formatMinutes(row.delayMinutes))}</td>
      <td>${escapeHtml(formatCurrency(row.cost))}</td>
      <td>${escapeHtml(formatPercent(row.performanceScore))}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Sevkiyat Analizi ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
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
        <h1>Sevkiyat Analizi</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Sevkiyat No</th><th>Tarih</th><th>Araç</th><th>Şoför</th><th>Müşteri</th><th>Rota</th><th>Teslim Süresi</th><th>Durum</th><th>Gecikme</th><th>Maliyet</th><th>Skor</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="11">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function ShipmentAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<ShipmentAnalyticsFilters>(() => createDefaultFilters(model.records))
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const vehicleOptions = React.useMemo(() => createOptions(model.records, record => record.vehicleId, record => `${record.vehicleNo} / ${record.vehiclePlate}`), [model.records])
  const driverOptions = React.useMemo(() => createOptions(model.records, record => record.driverId, record => record.driverName), [model.records])
  const customerOptions = React.useMemo(() => createOptions(model.records, record => record.customerId, record => record.customerName), [model.records])
  const routeOptions = React.useMemo(() => createOptions(model.records, record => record.routeId, record => record.routeName), [model.records])
  const productOptions = React.useMemo(() => createOptions(model.records, record => record.productId, record => record.productName), [model.records])
  const lotOptions = React.useMemo(() => createOptions(model.records, record => record.lotId, record => record.lotNo), [model.records])
  const deliveryCount = React.useMemo(() => sumBy(model.records, record => record.deliveryPointCount), [model.records])
  const coldChainCount = React.useMemo(() => model.records.filter(record => record.coldChainRequired).length, [model.records])
  const delayCount = React.useMemo(() => model.records.filter(record => record.delayMinutes > 0).length, [model.records])
  const otifViolationCount = React.useMemo(() => model.records.filter(record => !record.otif).length, [model.records])

  const updateFilter = <TKey extends keyof ShipmentAnalyticsFilters>(key: TKey, value: ShipmentAnalyticsFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page shipment-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Sevkiyat Analizi</h2>
          <p className="muted">Sevkiyat emirleri, teslimat kayıtları, araçlar, şoförler, rotalar, soğuk zincir, lot ve HACCP kontrollerini tek yönetici ekranında analiz eder.</p>
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
        <span>{formatNumber(model.records.length)} sevkiyat kaydı</span>
        <span>{formatNumber(VEHICLE_COUNT)} araç / {formatNumber(DRIVER_COUNT)} şoför / {formatNumber(CUSTOMER_COUNT)} müşteri</span>
        <span>{formatNumber(deliveryCount)} teslimat / {formatNumber(coldChainCount)} soğuk zincir / {formatNumber(delayCount)} gecikme / {formatNumber(otifViolationCount)} OTIF ihlali</span>
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
            <p className="muted">{formatNumber(filteredRecords.length)} kayıt listeleniyor. Bu ekran sevkiyat oluşturmaz, plan değiştirmez veya araç ataması yapmaz.</p>
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
          <FilterSelect label="Araç" value={filters.vehicleId} options={vehicleOptions} onChange={value => updateFilter('vehicleId', value)} />
          <FilterSelect label="Şoför" value={filters.driverId} options={driverOptions} onChange={value => updateFilter('driverId', value)} />
          <FilterSelect label="Müşteri" value={filters.customerId} options={customerOptions} onChange={value => updateFilter('customerId', value)} />
          <FilterSelect label="Rota" value={filters.routeId} options={routeOptions} onChange={value => updateFilter('routeId', value)} />
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as ShipmentAnalyticsFilters['status'])}>
              <option value={ALL_FILTER}>Tüm Durumlar</option>
              {STATUS_OPTIONS.map(status => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Lot" value={filters.lotId} options={lotOptions} onChange={value => updateFilter('lotId', value)} />
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Sevkiyat no, araç, şoför, müşteri, rota, ürün, lot..." />
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
              <p className="muted">Sevkiyat, araç, şoför, müşteri, rota, süre, gecikme, maliyet ve performans skorları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table shipment-analytics-table">
              <thead>
                <tr>
                  <th>Sevkiyat No</th>
                  <th>Tarih</th>
                  <th>Araç</th>
                  <th>Şoför</th>
                  <th>Müşteri</th>
                  <th>Şube</th>
                  <th>Rota</th>
                  <th>Yükleme Süresi</th>
                  <th>Teslim Süresi</th>
                  <th>Durum</th>
                  <th>Gecikme</th>
                  <th>Maliyet</th>
                  <th>OTIF</th>
                  <th>Doluluk</th>
                  <th>Performans</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={15}>Filtrelere uygun sevkiyat kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Sevkiyat No"><strong>{record.shipmentNo}</strong><span>{record.shipmentPlanNo}</span></td>
                    <td data-label="Tarih">{formatDate(record.shipmentDate)}</td>
                    <td data-label="Araç"><strong>{record.vehicleNo}</strong><span>{record.vehiclePlate}</span></td>
                    <td data-label="Şoför">{record.driverName}</td>
                    <td data-label="Müşteri"><strong>{record.customerName}</strong><span>{record.deliveryPointCount} teslimat noktası</span></td>
                    <td data-label="Şube">{record.branchName}</td>
                    <td data-label="Rota"><strong>{record.routeName}</strong><span>{record.region}</span></td>
                    <td data-label="Yükleme Süresi">{formatMinutes(record.loadingMinutes)}</td>
                    <td data-label="Teslim Süresi">{formatMinutes(record.deliveryMinutes)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span></td>
                    <td data-label="Gecikme">{record.delayMinutes > 0 ? formatMinutes(record.delayMinutes) : '-'}</td>
                    <td data-label="Maliyet">{formatCurrency(record.cost)}</td>
                    <td data-label="OTIF"><span className={`status-pill ${record.otif ? 'success' : 'danger-pill'}`}>{record.otif ? 'Evet' : 'Hayır'}</span></td>
                    <td data-label="Doluluk">{formatPercent(record.vehicleUtilization)}</td>
                    <td data-label="Performans"><span className={`status-pill ${getScoreClass(record.performanceScore)}`}>{formatPercent(record.performanceScore)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ShipmentDetailPanel record={selectedRecord} optimizationItems={model.optimizationItems} />
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
        {options.map(option => (
          <option value={option.id} key={option.id}>{option.name}</option>
        ))}
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

function ShipmentDetailPanel({
  record,
  optimizationItems
}: {
  record: ShipmentAnalyticsRecord | undefined
  optimizationItems: ShipmentOptimizationItem[]
}){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-state">Detay için bir sevkiyat kaydı seçin.</div>
        </section>
      </aside>
    )
  }

  const relatedOptimizationItems = optimizationItems
    .filter(item => (
      item.shipmentNo === record.shipmentNo
      || item.shipmentPlanNo === record.shipmentPlanNo
      || item.vehicleId === record.vehicleId
      || item.driverName === record.driverName
    ))
    .slice(0, 4)

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Sevkiyat Özeti</h3>
            <p className="muted">{record.shipmentNo} / {record.routeName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Müşteri" value={record.customerName} detail={record.branchName} />
          <DetailMetric label="Teslim Performansı" value={formatPercent(record.performanceScore)} detail={record.otif ? 'OTIF sağlandı' : 'OTIF ihlali var'} />
          <DetailMetric label="Planlanan Teslim" value={formatDateTime(record.plannedDeliveryAt)} detail={`Çıkış: ${formatDateTime(record.departureAt)}`} />
          <DetailMetric label="Gerçekleşen Teslim" value={formatDateTime(record.actualDeliveryAt)} detail={record.delayMinutes > 0 ? formatMinutes(record.delayMinutes) : 'Gecikme yok'} />
          <DetailMetric label="Teslim Süresi" value={formatMinutes(record.deliveryMinutes)} detail={`Bekleme: ${formatMinutes(record.waitingMinutes)}`} />
          <DetailMetric label="Maliyet" value={formatCurrency(record.cost)} detail={`Yakıt: ${formatCurrency(record.fuelCost)}`} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Araç ve Şoför Bilgileri</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Araç" value={`${record.vehicleNo} / ${record.vehiclePlate}`} detail={record.vehicleName} />
          <DetailMetric label="Araç Tipi" value={record.vehicleType} detail={`Doluluk: ${formatPercent(record.vehicleUtilization)}`} />
          <DetailMetric label="Şoför" value={record.driverName} detail={record.driverTitle} />
          <DetailMetric label="Rota Mesafesi" value={`${formatNumber(record.routeDistanceKm, 1)} km`} detail={record.region} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Sıcaklık Geçmişi</h3>
        </div>
        <div className="daily-production-module-list">
          {record.temperatureHistory.map(point => (
            <div key={`${record.id}-${point.label}`}>
              <strong>{point.label} <span className={`status-pill ${getResultClass(point.result)}`}>{point.result}</span></strong>
              <span>{formatDateTime(point.time)} / {formatNumber(point.temperatureC, 1)} °C</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Lot ve HACCP</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Ürün" value={record.productName} detail={record.unit} />
          <DetailMetric label="Lot" value={record.lotNo} detail={record.coldChainRequired ? 'Soğuk zincir gerekli' : 'Standart taşıma'} />
          <DetailMetric label="Sıcaklık Aralığı" value={`${formatNumber(record.minTemperatureC, 1)} - ${formatNumber(record.maxTemperatureC, 1)} °C`} detail={`Ortalama ${formatNumber(record.averageTemperatureC, 1)} °C`} />
          <DetailMetric label="HACCP" value={record.haccpResult} detail={`${record.haccpControls.length} kontrol`} />
        </div>
        <div className="daily-production-module-list" style={{ marginTop: 10 }}>
          {record.haccpControls.map(control => (
            <div key={`${record.id}-haccp-${control.label}`}>
              <strong>{control.label} <span className={`status-pill ${getResultClass(control.result)}`}>{control.result}</span></strong>
              <span>{control.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Teslim Kanıtları</h3>
        </div>
        <div className="daily-production-module-list">
          {record.deliveryProofs.map(proof => (
            <div key={`${record.id}-proof-${proof.label}`}>
              <strong>{proof.label} <span className={`status-pill ${getResultClass(proof.result)}`}>{proof.result}</span></strong>
              <span>{proof.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Kritik Uyarılar</h3>
        </div>
        <div className="daily-production-module-list">
          {record.criticalWarnings.length === 0 && (
            <div>
              <strong>Kritik uyarı yok</strong>
              <span>Sevkiyat performansı ve kalite sinyalleri kabul edilebilir aralıkta.</span>
            </div>
          )}
          {record.criticalWarnings.map((warning, index) => (
            <div key={`${record.id}-warning-${index}`}>
              <strong>Uyarı {index + 1}</strong>
              <span>{warning}</span>
            </div>
          ))}
          {relatedOptimizationItems.map(item => (
            <div key={item.id}>
              <strong>Karar Destek Önerisi</strong>
              <span>{item.recommendedAction || item.analysisResult}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
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
