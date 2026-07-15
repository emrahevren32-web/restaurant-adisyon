import type {
  ProductionWorkOrder,
  ProductionWorkOrderHistoryEvent,
  ProductionWorkOrderHistoryType,
  ProductionWorkOrderLine,
  ProductionWorkOrderPriority,
  ProductionWorkOrderStatus,
  ProductionWorkOrderUnit
} from './production-work-order.types'

const PRODUCTION_WORK_ORDER_STORAGE_KEY = 'ra_production_work_orders'
const HISTORY_TYPES: ProductionWorkOrderHistoryType[] = [
  'Oluşturuldu',
  'Düzenlendi',
  'Durum Değişti',
  'Ürün Eklendi',
  'Ürün Silindi'
]

export const PRODUCTION_WORK_ORDER_STATUSES: ProductionWorkOrderStatus[] = [
  'Taslak',
  'Bekliyor',
  'Üretimde',
  'Tamamlandı',
  'Sevkiyata Hazır',
  'İptal'
]

export const PRODUCTION_WORK_ORDER_PRIORITIES: ProductionWorkOrderPriority[] = [
  'Düşük',
  'Normal',
  'Yüksek',
  'Acil'
]

export const PRODUCTION_WORK_ORDER_UNITS: ProductionWorkOrderUnit[] = [
  'kg',
  'lt',
  'adet',
  'tepsi',
  'koli'
]

export const PRODUCTION_WORK_ORDER_PRODUCTS = [
  'Mercimek Çorbası',
  'Tavuk Suyu',
  'Domates Sosu',
  'Patates Püresi',
  'Tavuk Döner',
  'Lazanya Sosu',
  'Beşamel Sos',
  'Köfte Harcı',
  'Et Suyu',
  'Tavuk Marinasyonu'
]

export const PRODUCTION_WORK_ORDER_BRANCHES = [
  'Merkez Üretim',
  'Kadıköy Şube',
  'Maslak Şube',
  'Ataşehir Şube',
  'Toplu Yemek Operasyonu'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeStatus = (value: unknown): ProductionWorkOrderStatus => (
  PRODUCTION_WORK_ORDER_STATUSES.includes(value as ProductionWorkOrderStatus)
    ? value as ProductionWorkOrderStatus
    : 'Taslak'
)

const normalizePriority = (value: unknown): ProductionWorkOrderPriority => (
  PRODUCTION_WORK_ORDER_PRIORITIES.includes(value as ProductionWorkOrderPriority)
    ? value as ProductionWorkOrderPriority
    : 'Normal'
)

const normalizeUnit = (value: unknown): ProductionWorkOrderUnit => (
  PRODUCTION_WORK_ORDER_UNITS.includes(value as ProductionWorkOrderUnit)
    ? value as ProductionWorkOrderUnit
    : 'kg'
)

const normalizeHistoryType = (value: unknown): ProductionWorkOrderHistoryType => (
  HISTORY_TYPES.includes(value as ProductionWorkOrderHistoryType)
    ? value as ProductionWorkOrderHistoryType
    : 'Düzenlendi'
)

const normalizeStoredLine = (item: Partial<ProductionWorkOrderLine>, index: number): ProductionWorkOrderLine => {
  const quantity = Number(item.quantity)

  return {
    id: String(item.id || `pwo_line_${index + 1}`),
    productName: String(item.productName || PRODUCTION_WORK_ORDER_PRODUCTS[0]).trim() || PRODUCTION_WORK_ORDER_PRODUCTS[0],
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: normalizeUnit(item.unit),
    note: String(item.note || '').trim()
  }
}

const normalizeStoredHistory = (
  item: Partial<ProductionWorkOrderHistoryEvent>,
  index: number,
  fallbackCreatedAt: string
): ProductionWorkOrderHistoryEvent => ({
  id: String(item.id || `pwo_history_${index + 1}`),
  type: normalizeHistoryType(item.type),
  description: String(item.description || 'İş emri güncellendi.').trim() || 'İş emri güncellendi.',
  createdAt: String(item.createdAt || fallbackCreatedAt),
  actorName: String(item.actorName || 'MIYOP Demo').trim() || 'MIYOP Demo'
})

const normalizeStoredOrder = (item: Partial<ProductionWorkOrder>, index: number): ProductionWorkOrder => {
  const createdAt = String(item.createdAt || new Date().toISOString())
  const estimatedMinutes = Number(item.estimatedMinutes)

  return {
    id: String(item.id || `pwo_${String(index + 1).padStart(3, '0')}`),
    workOrderNo: String(item.workOrderNo || `UE-2026-${String(index + 1).padStart(4, '0')}`),
    requester: String(item.requester || '').trim(),
    branch: String(item.branch || PRODUCTION_WORK_ORDER_BRANCHES[0]).trim() || PRODUCTION_WORK_ORDER_BRANCHES[0],
    deliveryDate: String(item.deliveryDate || ''),
    priority: normalizePriority(item.priority),
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    notes: String(item.notes || '').trim(),
    lines: Array.isArray(item.lines)
      ? item.lines.map(normalizeStoredLine)
      : [],
    history: Array.isArray(item.history)
      ? item.history.map((event, eventIndex) => normalizeStoredHistory(event, eventIndex, createdAt))
      : [],
    estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : 45,
    linkedShipmentNo: String(item.linkedShipmentNo || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt,
    createdByUserId: String(item.createdByUserId || '').trim()
  }
}

const line = (
  id: string,
  productName: string,
  quantity: number,
  unit: ProductionWorkOrderUnit,
  note = ''
): ProductionWorkOrderLine => ({
  id,
  productName,
  quantity,
  unit,
  note
})

const addMinutes = (value: string, minutes: number) => (
  new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString()
)

const history = (
  orderId: string,
  createdAt: string,
  status: ProductionWorkOrderStatus,
  editDescription = ''
): ProductionWorkOrderHistoryEvent[] => {
  const events: ProductionWorkOrderHistoryEvent[] = [
    {
      id: `${orderId}_history_created`,
      type: 'Oluşturuldu',
      description: 'İş emri oluşturuldu.',
      createdAt,
      actorName: 'MIYOP Demo'
    }
  ]

  if(editDescription){
    events.push({
      id: `${orderId}_history_edited`,
      type: 'Düzenlendi',
      description: editDescription,
      createdAt: addMinutes(createdAt, 24),
      actorName: 'Operasyon Planlama'
    })
  }

  if(status !== 'Taslak'){
    events.push({
      id: `${orderId}_history_status`,
      type: 'Durum Değişti',
      description: `Durum ${status} olarak güncellendi.`,
      createdAt: addMinutes(createdAt, 48),
      actorName: 'Üretim Planlama'
    })
  }

  return events
}

export const createProductionWorkOrderMockData = (): ProductionWorkOrder[] => [
  {
    id: 'pwo_001',
    workOrderNo: 'UE-2026-0341',
    requester: 'Operasyon Planlama',
    branch: 'Merkez Üretim',
    deliveryDate: '2026-07-15',
    priority: 'Acil',
    status: 'Üretimde',
    description: 'Öğle sevkiyatı için sıcak ürün hazırlığı.',
    notes: 'Çorba ve püre aynı dolum hattında bekletilmeden paketlenecek.',
    estimatedMinutes: 260,
    linkedShipmentNo: 'SVK-2026-188',
    createdAt: '2026-07-14T08:20:00.000Z',
    history: history('pwo_001', '2026-07-14T08:20:00.000Z', 'Üretimde', 'Dilimleme notu ürün satırına eklendi.'),
    lines: [
      line('pwo_001_1', 'Mercimek Çorbası', 180, 'kg', 'Termobox dolumuna uygun'),
      line('pwo_001_2', 'Patates Püresi', 95, 'kg'),
      line('pwo_001_3', 'Tavuk Döner', 120, 'kg', 'Dilimlenmiş')
    ]
  },
  {
    id: 'pwo_002',
    workOrderNo: 'UE-2026-0342',
    requester: 'Satış Operasyon',
    branch: 'Kadıköy Şube',
    deliveryDate: '2026-07-16',
    priority: 'Yüksek',
    status: 'Bekliyor',
    description: 'Şube haftalık sos ve marinasyon ihtiyacı.',
    notes: 'Kadıköy sevkiyatına göre hazırlık önceliği yüksek tutulacak.',
    estimatedMinutes: 190,
    linkedShipmentNo: '',
    createdAt: '2026-07-14T09:45:00.000Z',
    history: history('pwo_002', '2026-07-14T09:45:00.000Z', 'Bekliyor', 'Marinasyon miktarı şube talebine göre güncellendi.'),
    lines: [
      line('pwo_002_1', 'Domates Sosu', 80, 'kg', 'Baharat seviyesi standart'),
      line('pwo_002_2', 'Tavuk Marinasyonu', 55, 'kg')
    ]
  },
  {
    id: 'pwo_003',
    workOrderNo: 'UE-2026-0343',
    requester: 'Kurumsal Müşteri Ekibi',
    branch: 'Toplu Yemek Operasyonu',
    deliveryDate: '2026-07-17',
    priority: 'Normal',
    status: 'Taslak',
    description: 'Hafta sonu etkinliği için hazırlık planı.',
    notes: 'Etkinlik kişi sayısı kesinleşince miktarlar tekrar kontrol edilecek.',
    estimatedMinutes: 330,
    linkedShipmentNo: '',
    createdAt: '2026-07-14T11:10:00.000Z',
    history: history('pwo_003', '2026-07-14T11:10:00.000Z', 'Taslak'),
    lines: [
      line('pwo_003_1', 'Lazanya Sosu', 110, 'kg'),
      line('pwo_003_2', 'Beşamel Sos', 70, 'kg'),
      line('pwo_003_3', 'Et Suyu', 140, 'lt')
    ]
  },
  {
    id: 'pwo_004',
    workOrderNo: 'UE-2026-0344',
    requester: 'Şube Müdürü',
    branch: 'Maslak Şube',
    deliveryDate: '2026-07-15',
    priority: 'Yüksek',
    status: 'Sevkiyata Hazır',
    description: 'Akşam vardiyası öncesi şube hazırlığı.',
    notes: 'Sevkiyat etiketi hazır, araç yükleme saatine kadar soğuk alanda bekletilecek.',
    estimatedMinutes: 220,
    linkedShipmentNo: 'SVK-2026-191',
    createdAt: '2026-07-13T15:35:00.000Z',
    history: history('pwo_004', '2026-07-13T15:35:00.000Z', 'Sevkiyata Hazır', 'Tavuk suyu satırı sonradan eklendi.'),
    lines: [
      line('pwo_004_1', 'Köfte Harcı', 130, 'kg', 'Porsiyonlama öncesi'),
      line('pwo_004_2', 'Domates Sosu', 45, 'kg'),
      line('pwo_004_3', 'Tavuk Suyu', 90, 'lt')
    ]
  },
  {
    id: 'pwo_005',
    workOrderNo: 'UE-2026-0345',
    requester: 'Merkez Planlama',
    branch: 'Merkez Üretim',
    deliveryDate: '2026-07-14',
    priority: 'Normal',
    status: 'Tamamlandı',
    description: 'Tamamlanan günlük temel hazırlık.',
    notes: 'Tamamlanan ürünler vardiya kapanışında sevkiyat alanına devredildi.',
    estimatedMinutes: 180,
    linkedShipmentNo: 'SVK-2026-176',
    createdAt: '2026-07-13T07:55:00.000Z',
    history: history('pwo_005', '2026-07-13T07:55:00.000Z', 'Tamamlandı'),
    lines: [
      line('pwo_005_1', 'Tavuk Suyu', 160, 'lt'),
      line('pwo_005_2', 'Patates Püresi', 75, 'kg')
    ]
  },
  {
    id: 'pwo_006',
    workOrderNo: 'UE-2026-0346',
    requester: 'Ataşehir Operasyon',
    branch: 'Ataşehir Şube',
    deliveryDate: '2026-07-18',
    priority: 'Düşük',
    status: 'Bekliyor',
    description: 'Haftalık ara stok tamamlaması.',
    notes: 'Öncelik düşük, üretim boşluğunda planlanacak.',
    estimatedMinutes: 145,
    linkedShipmentNo: '',
    createdAt: '2026-07-14T13:05:00.000Z',
    history: history('pwo_006', '2026-07-14T13:05:00.000Z', 'Bekliyor'),
    lines: [
      line('pwo_006_1', 'Beşamel Sos', 40, 'kg'),
      line('pwo_006_2', 'Mercimek Çorbası', 60, 'kg')
    ]
  },
  {
    id: 'pwo_007',
    workOrderNo: 'UE-2026-0347',
    requester: 'Kalite Ekibi',
    branch: 'Merkez Üretim',
    deliveryDate: '2026-07-16',
    priority: 'Normal',
    status: 'İptal',
    description: 'Müşteri planı değiştiği için iptal edildi.',
    notes: 'İptal bilgisi kalite ekibi tarafından bildirildi.',
    estimatedMinutes: 120,
    linkedShipmentNo: '',
    createdAt: '2026-07-12T16:25:00.000Z',
    history: history('pwo_007', '2026-07-12T16:25:00.000Z', 'İptal', 'Müşteri talebi iptal edildi.'),
    lines: [
      line('pwo_007_1', 'Tavuk Döner', 80, 'kg'),
      line('pwo_007_2', 'Tavuk Marinasyonu', 35, 'kg')
    ]
  },
  {
    id: 'pwo_008',
    workOrderNo: 'UE-2026-0348',
    requester: 'Kurumsal Satış',
    branch: 'Toplu Yemek Operasyonu',
    deliveryDate: '2026-07-19',
    priority: 'Acil',
    status: 'Üretimde',
    description: 'Ek sipariş nedeniyle hızlandırılmış üretim.',
    notes: 'Toplu yemek operasyonu için yükleme sırası öne alınacak.',
    estimatedMinutes: 390,
    linkedShipmentNo: 'SVK-2026-203',
    createdAt: '2026-07-15T06:40:00.000Z',
    history: history('pwo_008', '2026-07-15T06:40:00.000Z', 'Üretimde', 'Ek sipariş sonrası patates püresi satırı artırıldı.'),
    lines: [
      line('pwo_008_1', 'Köfte Harcı', 210, 'kg'),
      line('pwo_008_2', 'Et Suyu', 120, 'lt'),
      line('pwo_008_3', 'Domates Sosu', 90, 'kg'),
      line('pwo_008_4', 'Patates Püresi', 150, 'kg')
    ]
  },
  {
    id: 'pwo_009',
    workOrderNo: 'UE-2026-0349',
    requester: 'Maslak Şube',
    branch: 'Maslak Şube',
    deliveryDate: '2026-07-20',
    priority: 'Normal',
    status: 'Taslak',
    description: 'Yeni menü hazırlık denemesi.',
    notes: 'Deneme üretimi için kalite tadım notları ayrıca alınacak.',
    estimatedMinutes: 210,
    linkedShipmentNo: '',
    createdAt: '2026-07-15T09:15:00.000Z',
    history: history('pwo_009', '2026-07-15T09:15:00.000Z', 'Taslak'),
    lines: [
      line('pwo_009_1', 'Lazanya Sosu', 65, 'kg'),
      line('pwo_009_2', 'Beşamel Sos', 55, 'kg')
    ]
  },
  {
    id: 'pwo_010',
    workOrderNo: 'UE-2026-0350',
    requester: 'Merkez Üretim',
    branch: 'Merkez Üretim',
    deliveryDate: '2026-07-21',
    priority: 'Yüksek',
    status: 'Bekliyor',
    description: 'Haftalık döner ve marinasyon üretim bloğu.',
    notes: 'Döner ve marinasyon aynı vardiya içinde tamamlanacak.',
    estimatedMinutes: 300,
    linkedShipmentNo: '',
    createdAt: '2026-07-15T10:30:00.000Z',
    history: history('pwo_010', '2026-07-15T10:30:00.000Z', 'Bekliyor', 'Tavuk suyu miktarı üretim planına eklendi.'),
    lines: [
      line('pwo_010_1', 'Tavuk Döner', 180, 'kg'),
      line('pwo_010_2', 'Tavuk Marinasyonu', 90, 'kg'),
      line('pwo_010_3', 'Tavuk Suyu', 110, 'lt')
    ]
  }
]

export const saveProductionWorkOrders = (orders: ProductionWorkOrder[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PRODUCTION_WORK_ORDER_STORAGE_KEY, JSON.stringify(orders.map(normalizeStoredOrder)))
}

export const loadProductionWorkOrders = () => {
  const seedOrders = createProductionWorkOrderMockData()
  if(!isBrowserStorageAvailable()) return seedOrders

  const storedOrders = localStorage.getItem(PRODUCTION_WORK_ORDER_STORAGE_KEY)
  if(storedOrders === null){
    saveProductionWorkOrders(seedOrders)
    return seedOrders
  }

  try {
    const parsed = JSON.parse(storedOrders)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredOrder)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  saveProductionWorkOrders(seedOrders)
  return seedOrders
}
