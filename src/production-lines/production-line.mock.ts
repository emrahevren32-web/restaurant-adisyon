import type {
  ProductionLine,
  ProductionLineStatus,
  ProductionLineType
} from './production-line.types'

const PRODUCTION_LINE_STORAGE_KEY = 'ra_production_lines'

export const PRODUCTION_LINE_TYPES: ProductionLineType[] = [
  'Çorba',
  'Et',
  'Sebze',
  'Marine',
  'Paketleme',
  'Genel'
]

export const PRODUCTION_LINE_STATUSES: ProductionLineStatus[] = [
  'Aktif',
  'Bakımda',
  'Pasif',
  'Yoğun'
]

const normalizeStatusKey = (value: unknown) => (
  String(value || '').trim().toLocaleLowerCase('tr-TR')
)

const PRODUCTION_LINE_STATUS_ALIASES: Record<string, ProductionLineStatus> = {
  aktif: 'Aktif',
  bakım: 'Bakımda',
  bakim: 'Bakımda',
  bakımda: 'Bakımda',
  bakimda: 'Bakımda',
  pasif: 'Pasif',
  yoğun: 'Yoğun',
  yogun: 'Yoğun'
}

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeType = (value: unknown): ProductionLineType => (
  PRODUCTION_LINE_TYPES.includes(value as ProductionLineType)
    ? value as ProductionLineType
    : 'Genel'
)

export const normalizeProductionLineStatus = (value: unknown): ProductionLineStatus => (
  PRODUCTION_LINE_STATUSES.includes(value as ProductionLineStatus)
    ? value as ProductionLineStatus
    : PRODUCTION_LINE_STATUS_ALIASES[normalizeStatusKey(value)] || 'Aktif'
)

const normalizeStoredLine = (item: Partial<ProductionLine>, index: number): ProductionLine => {
  const capacity = Number(item.capacity)
  const activeWorkOrderCount = Number(item.activeWorkOrderCount)
  const todayWorkOrderCount = Number(item.todayWorkOrderCount)
  const estimatedUtilization = Number(item.estimatedUtilization)
  const createdAt = String(item.createdAt || new Date().toISOString())

  return {
    id: String(item.id || `pline_${String(index + 1).padStart(3, '0')}`),
    code: String(item.code || `HAT-${String(index + 1).padStart(2, '0')}`).trim(),
    name: String(item.name || 'Üretim Hattı').trim() || 'Üretim Hattı',
    type: normalizeType(item.type),
    status: normalizeProductionLineStatus(item.status),
    capacity: Number.isFinite(capacity) ? capacity : 0,
    capacityUnit: String(item.capacityUnit || 'kg/gün').trim() || 'kg/gün',
    activeWorkOrderCount: Number.isFinite(activeWorkOrderCount) ? activeWorkOrderCount : 0,
    responsible: String(item.responsible || '').trim(),
    activeOperator: String(item.activeOperator || '').trim(),
    todayWorkOrderCount: Number.isFinite(todayWorkOrderCount) ? todayWorkOrderCount : 0,
    estimatedUtilization: Number.isFinite(estimatedUtilization) ? estimatedUtilization : 0,
    linkedWorkOrders: Array.isArray(item.linkedWorkOrders)
      ? item.linkedWorkOrders.map(value => String(value).trim()).filter(Boolean)
      : [],
    description: String(item.description || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const line = (
  id: string,
  code: string,
  name: string,
  type: ProductionLineType,
  status: ProductionLineStatus,
  capacity: number,
  activeWorkOrderCount: number,
  responsible: string,
  activeOperator: string,
  todayWorkOrderCount: number,
  estimatedUtilization: number,
  linkedWorkOrders: string[],
  description: string,
  createdAt: string
): ProductionLine => ({
  id,
  code,
  name,
  type,
  status,
  capacity,
  capacityUnit: 'kg/gün',
  activeWorkOrderCount,
  responsible,
  activeOperator,
  todayWorkOrderCount,
  estimatedUtilization,
  linkedWorkOrders,
  description,
  createdAt,
  updatedAt: createdAt
})

export const createProductionLineMockData = (): ProductionLine[] => [
  line(
    'pline_001',
    'HAT-01',
    'Çorba Hattı',
    'Çorba',
    'Aktif',
    620,
    4,
    'Derya Kaya',
    'Sabah Vardiyası',
    6,
    72,
    ['UE-2026-0341', 'UE-2026-0346', 'UE-2026-0351'],
    'Sıcak dolum ve çorba üretimi için ana hat.',
    '2026-07-10T07:30:00.000Z'
  ),
  line(
    'pline_002',
    'HAT-02',
    'Et Hazırlık',
    'Et',
    'Yoğun',
    520,
    5,
    'Murat Demir',
    'Et Hazırlık Ekibi',
    7,
    88,
    ['UE-2026-0344', 'UE-2026-0348', 'UE-2026-0350'],
    'Köfte harcı, döner ve et suyu ön hazırlıkları.',
    '2026-07-10T08:15:00.000Z'
  ),
  line(
    'pline_003',
    'HAT-03',
    'Marine',
    'Marine',
    'Aktif',
    360,
    3,
    'Selin Acar',
    'Marine Operatörü',
    4,
    61,
    ['UE-2026-0342', 'UE-2026-0350'],
    'Tavuk marinasyonu ve sos bekletme işlemleri.',
    '2026-07-11T09:05:00.000Z'
  ),
  line(
    'pline_004',
    'HAT-04',
    'Porsiyonlama',
    'Genel',
    'Bakımda',
    480,
    1,
    'Ece Yılmaz',
    'Bakım Ekibi',
    1,
    34,
    ['UE-2026-0345'],
    'Porsiyonlama ve ara ürün hazırlık alanı.',
    '2026-07-11T10:20:00.000Z'
  ),
  line(
    'pline_005',
    'HAT-05',
    'Paketleme',
    'Paketleme',
    'Aktif',
    900,
    6,
    'Onur Şahin',
    'Paketleme Vardiyası',
    8,
    79,
    ['UE-2026-0341', 'UE-2026-0344', 'UE-2026-0348', 'UE-2026-0352'],
    'Koli, etiketleme ve sevkiyat öncesi paketleme hattı.',
    '2026-07-12T06:45:00.000Z'
  )
]

export const saveProductionLines = (lines: ProductionLine[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PRODUCTION_LINE_STORAGE_KEY, JSON.stringify(lines.map(normalizeStoredLine)))
}

export const loadProductionLines = () => {
  const seedLines = createProductionLineMockData()
  if(!isBrowserStorageAvailable()) return seedLines

  const storedLines = localStorage.getItem(PRODUCTION_LINE_STORAGE_KEY)
  if(storedLines === null){
    saveProductionLines(seedLines)
    return seedLines
  }

  try {
    const parsed = JSON.parse(storedLines)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredLine)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  saveProductionLines(seedLines)
  return seedLines
}
