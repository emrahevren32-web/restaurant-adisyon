import type { Branch, StockItem, StockUnit } from '../types'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestStatus
} from './purchase-request.types'

export const PURCHASE_REQUEST_STORAGE_KEY = 'ra_purchase_requests'

export const PURCHASE_REQUEST_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
]

export const PURCHASE_REQUEST_PRIORITIES: PurchaseRequestPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PURCHASE_REQUEST_DEPARTMENTS: PurchaseRequestDepartment[] = [
  'PRODUCTION',
  'WAREHOUSE',
  'QUALITY',
  'PACKAGING',
  'SHIPPING',
  'ADMINISTRATION'
]

export const PURCHASE_REQUEST_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Gonderildi',
  APPROVED: 'Onaylandi',
  REJECTED: 'Reddedildi',
  CANCELLED: 'Iptal'
}

export const PURCHASE_REQUEST_PRIORITY_LABELS: Record<PurchaseRequestPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}

export const PURCHASE_REQUEST_DEPARTMENT_LABELS: Record<PurchaseRequestDepartment, string> = {
  PRODUCTION: 'Uretim',
  WAREHOUSE: 'Depo',
  QUALITY: 'Kalite',
  PACKAGING: 'Paketleme',
  SHIPPING: 'Sevkiyat',
  ADMINISTRATION: 'Yonetim'
}

type RawPurchaseRequestRecord = Partial<Record<keyof PurchaseRequestRecord, unknown>> & Record<string, unknown>
type RawPurchaseRequestItem = Partial<Record<keyof PurchaseRequestItem, unknown>> & Record<string, unknown>

type PurchaseRequestSeedItem = {
  stockSearchName: string
  quantity: number
  estimatedUnitPrice: number
  notes: string
}

type PurchaseRequestSeed = {
  requestNo: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  department: PurchaseRequestDepartment
  requester: string
  priority: PurchaseRequestPriority
  status: PurchaseRequestStatus
  branchIndex: number
  notes: string
  items: PurchaseRequestSeedItem[]
}

const DEFAULT_STATUS: PurchaseRequestStatus = 'DRAFT'
const DEFAULT_PRIORITY: PurchaseRequestPriority = 'NORMAL'
const DEFAULT_DEPARTMENT: PurchaseRequestDepartment = 'PRODUCTION'
const DEFAULT_UNIT: StockUnit = 'adet'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawPurchaseRequestRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawPurchaseRequestItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeStatus = (value: unknown): PurchaseRequestStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_STATUSES.includes(normalized as PurchaseRequestStatus)
    ? normalized as PurchaseRequestStatus
    : DEFAULT_STATUS
}

const normalizePriority = (value: unknown): PurchaseRequestPriority => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_PRIORITIES.includes(normalized as PurchaseRequestPriority)
    ? normalized as PurchaseRequestPriority
    : DEFAULT_PRIORITY
}

const normalizeDepartment = (value: unknown): PurchaseRequestDepartment => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_DEPARTMENTS.includes(normalized as PurchaseRequestDepartment)
    ? normalized as PurchaseRequestDepartment
    : DEFAULT_DEPARTMENT
}

const normalizeDate = (value: unknown, fallback: string) => {
  const normalized = normalizeText(value)
  return normalized || fallback
}

const normalizeMatchKey = (value: string) => (
  value.trim().toLocaleLowerCase('tr-TR')
)

const findStockItem = (stockItems: StockItem[], searchName: string, fallbackIndex: number) => {
  const normalizedSearchName = normalizeMatchKey(searchName)
  return stockItems.find(stockItem => normalizeMatchKey(stockItem.name).includes(normalizedSearchName))
    || stockItems[fallbackIndex % stockItems.length]
}

const roundPrice = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const buildItem = (
  requestId: string,
  stockItem: StockItem,
  seed: PurchaseRequestSeedItem,
  index: number
): PurchaseRequestItem => ({
  id: `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
  requestId,
  stockItemId: stockItem.id,
  quantity: seed.quantity,
  unit: stockItem.unit,
  estimatedUnitPrice: seed.estimatedUnitPrice,
  estimatedTotalPrice: roundPrice(seed.quantity * seed.estimatedUnitPrice),
  notes: seed.notes
})

const createSeedRecords = (): PurchaseRequestSeed[] => [
  {
    requestNo: 'PR-000001',
    title: 'Pizza Hamuru uretim ihtiyaci',
    description: 'Haftalik pizza hamuru uretimi icin temel hammadde talebi.',
    requestDate: '2026-07-12',
    requiredDate: '2026-07-15',
    department: 'PRODUCTION',
    requester: 'Uretim Planlama',
    priority: 'HIGH',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Hamur uretimi baslamadan depoya alinmali.',
    items: [
      { stockSearchName: 'Un', quantity: 100, estimatedUnitPrice: 32, notes: 'Endustriyel un.' },
      { stockSearchName: 'Yag', quantity: 20, estimatedUnitPrice: 95, notes: 'Hamur recetesi icin.' },
      { stockSearchName: 'Maya', quantity: 15, estimatedUnitPrice: 68, notes: 'Taze maya tercih edilir.' }
    ]
  },
  {
    requestNo: 'PR-000002',
    title: 'Izgara et grubu hazirligi',
    description: 'Izgara uretim hattinda kullanilacak et ve baharat ihtiyaci.',
    requestDate: '2026-07-12',
    requiredDate: '2026-07-14',
    department: 'PRODUCTION',
    requester: 'Izgara Sefi',
    priority: 'URGENT',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Et grubu teslimi sabah vardiyasindan once bekleniyor.',
    items: [
      { stockSearchName: 'Dana Eti', quantity: 50, estimatedUnitPrice: 520, notes: 'Vakumlu urun.' },
      { stockSearchName: 'Baharat', quantity: 20, estimatedUnitPrice: 180, notes: 'Izgara marinasyon karisimi.' }
    ]
  },
  {
    requestNo: 'PR-000003',
    title: 'Temizlik sarf malzemeleri',
    description: 'Mutfak ve depo hijyen stoklari icin talep.',
    requestDate: '2026-07-13',
    requiredDate: '2026-07-17',
    department: 'WAREHOUSE',
    requester: 'Depo Sorumlusu',
    priority: 'NORMAL',
    status: 'DRAFT',
    branchIndex: 0,
    notes: 'Aylik sarf ihtiyaci.',
    items: [
      { stockSearchName: 'Deterjan', quantity: 100, estimatedUnitPrice: 42, notes: 'Endustriyel yuzey temizleyici.' },
      { stockSearchName: 'Eldiven', quantity: 200, estimatedUnitPrice: 18, notes: 'Paket eldiven.' }
    ]
  },
  {
    requestNo: 'PR-000004',
    title: 'Sos uretim domates grubu',
    description: 'Domates sosu ve ara urun hazirligi icin ihtiyac.',
    requestDate: '2026-07-13',
    requiredDate: '2026-07-16',
    department: 'PRODUCTION',
    requester: 'Sos Hatti',
    priority: 'HIGH',
    status: 'APPROVED',
    branchIndex: 0,
    notes: 'Salca kalite kontrol onayi ile teslim alinacak.',
    items: [
      { stockSearchName: 'Domates Salcasi', quantity: 40, estimatedUnitPrice: 118, notes: '5 kg ambalaj olabilir.' },
      { stockSearchName: 'Tuz', quantity: 8, estimatedUnitPrice: 12, notes: 'Rafine tuz.' },
      { stockSearchName: 'Su', quantity: 120, estimatedUnitPrice: 1, notes: 'Uretim suyu.' }
    ]
  },
  {
    requestNo: 'PR-000005',
    title: 'Paketleme kaplari',
    description: 'Paket servis yogunlugu icin ambalaj stok talebi.',
    requestDate: '2026-07-14',
    requiredDate: '2026-07-20',
    department: 'PACKAGING',
    requester: 'Paketleme Sorumlusu',
    priority: 'NORMAL',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Sicak yemek kapak uyumu kontrol edilecek.',
    items: [
      { stockSearchName: 'Ambalaj', quantity: 60, estimatedUnitPrice: 125, notes: 'Sicak yemek kabi.' },
      { stockSearchName: 'Kapak', quantity: 60, estimatedUnitPrice: 75, notes: 'Kap uyumlu kapak.' }
    ]
  },
  {
    requestNo: 'PR-000006',
    title: 'Sut urunleri haftalik talep',
    description: 'Corba ve tatli uretimlerinde kullanilacak sut urunleri.',
    requestDate: '2026-07-14',
    requiredDate: '2026-07-18',
    department: 'WAREHOUSE',
    requester: 'Soguk Depo',
    priority: 'HIGH',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Soguk zincir korunmali.',
    items: [
      { stockSearchName: 'Sut', quantity: 80, estimatedUnitPrice: 34, notes: 'Pastorize sut.' },
      { stockSearchName: 'Krema', quantity: 30, estimatedUnitPrice: 95, notes: 'Yemeklik krema.' },
      { stockSearchName: 'Tereyagi', quantity: 20, estimatedUnitPrice: 260, notes: 'Blok tereyagi.' }
    ]
  },
  {
    requestNo: 'PR-000007',
    title: 'Kalite kontrol numune sarflari',
    description: 'Kalite laboratuvari sarf malzeme talebi.',
    requestDate: '2026-07-15',
    requiredDate: '2026-07-22',
    department: 'QUALITY',
    requester: 'Kalite Uzmani',
    priority: 'LOW',
    status: 'DRAFT',
    branchIndex: 0,
    notes: 'Acil olmayan kalite sarflari.',
    items: [
      { stockSearchName: 'Eldiven', quantity: 40, estimatedUnitPrice: 18, notes: 'Numune alma icin.' },
      { stockSearchName: 'Temizlik', quantity: 15, estimatedUnitPrice: 82, notes: 'Laboratuvar temizligi.' }
    ]
  },
  {
    requestNo: 'PR-000008',
    title: 'Sevkiyat kolileme ihtiyaci',
    description: 'Sube sevkiyatlari icin koli ve etiket sarfi.',
    requestDate: '2026-07-15',
    requiredDate: '2026-07-19',
    department: 'SHIPPING',
    requester: 'Sevkiyat Planlama',
    priority: 'NORMAL',
    status: 'CANCELLED',
    branchIndex: 0,
    notes: 'Talep rota degisikligi nedeniyle iptal edildi.',
    items: [
      { stockSearchName: 'Koli', quantity: 150, estimatedUnitPrice: 16, notes: 'Sevkiyat kolisi.' },
      { stockSearchName: 'Etiket', quantity: 20, estimatedUnitPrice: 65, notes: 'Termal etiket.' }
    ]
  },
  {
    requestNo: 'PR-000009',
    title: 'Depo kritik stok tamamlamasi',
    description: 'Minimum seviye altina yaklasan temel stoklar.',
    requestDate: '2026-07-16',
    requiredDate: '2026-07-21',
    department: 'WAREHOUSE',
    requester: 'Merkez Depo',
    priority: 'HIGH',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Kritik stok raporundan olusturuldu.',
    items: [
      { stockSearchName: 'Sogan', quantity: 70, estimatedUnitPrice: 21, notes: 'Kuru sogan.' },
      { stockSearchName: 'Havuc', quantity: 45, estimatedUnitPrice: 19, notes: 'Corba hazirligi.' },
      { stockSearchName: 'Seker', quantity: 60, estimatedUnitPrice: 38, notes: 'Tatli ve sos uretimi.' }
    ]
  },
  {
    requestNo: 'PR-000010',
    title: 'Yonetim ofis sarflari',
    description: 'Satinalma ve idari ofis icin sarf talepleri.',
    requestDate: '2026-07-16',
    requiredDate: '2026-07-25',
    department: 'ADMINISTRATION',
    requester: 'Idari Isler',
    priority: 'LOW',
    status: 'REJECTED',
    branchIndex: 0,
    notes: 'Butce revizyonu sonrasi tekrar degerlendirilecek.',
    items: [
      { stockSearchName: 'Ambalaj', quantity: 10, estimatedUnitPrice: 125, notes: 'Ornek ofis sarfi referansi.' }
    ]
  },
  {
    requestNo: 'PR-000011',
    title: 'Tavuk marinasyon hattı',
    description: 'Tavuk uretim planina gore hammadde talebi.',
    requestDate: '2026-07-17',
    requiredDate: '2026-07-19',
    department: 'PRODUCTION',
    requester: 'Marinasyon Ekibi',
    priority: 'URGENT',
    status: 'SUBMITTED',
    branchIndex: 0,
    notes: 'Aksam vardiyasi oncesi stoklanmali.',
    items: [
      { stockSearchName: 'Tavuk But', quantity: 90, estimatedUnitPrice: 185, notes: 'Tavuk but.' },
      { stockSearchName: 'Yag', quantity: 18, estimatedUnitPrice: 95, notes: 'Marinasyon yagi.' },
      { stockSearchName: 'Baharat', quantity: 12, estimatedUnitPrice: 180, notes: 'Karisik baharat.' }
    ]
  },
  {
    requestNo: 'PR-000012',
    title: 'Gunluk icecek ve su takviyesi',
    description: 'Personel ve uretim alanlari icin su/icecek takviyesi.',
    requestDate: '2026-07-17',
    requiredDate: '2026-07-18',
    department: 'WAREHOUSE',
    requester: 'Depo Operasyon',
    priority: 'NORMAL',
    status: 'DRAFT',
    branchIndex: 0,
    notes: 'Gunluk tuketime gore miktar revize edilebilir.',
    items: [
      { stockSearchName: 'Su', quantity: 60, estimatedUnitPrice: 24, notes: 'Damacana/koli su.' },
      { stockSearchName: 'Icecek', quantity: 30, estimatedUnitPrice: 36, notes: 'Personel icecek stogu.' }
    ]
  }
]

export const getNextPurchaseRequestNo = (records: PurchaseRequestRecord[]) => {
  const maxNo = records.reduce((max, request) => {
    const match = request.requestNo.match(/PR-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PR-${String(maxNo + 1).padStart(6, '0')}`
}

export const createPurchaseRequestMockData = (
  stockItems: StockItem[],
  branches: Branch[]
): PurchaseRequestRecord[] => {
  if(stockItems.length === 0) return []

  const defaultBranchId = branches[0]?.id || ''

  return createSeedRecords().map((seed, requestIndex) => {
    const requestId = `purchase_request_${String(requestIndex + 1).padStart(3, '0')}`
    const branch = branches[seed.branchIndex % Math.max(branches.length, 1)]
    const createdAt = `${seed.requestDate}T08:${String(requestIndex * 3).padStart(2, '0')}:00.000Z`
    const items = seed.items.map((seedItem, itemIndex) => (
      buildItem(
        requestId,
        findStockItem(stockItems, seedItem.stockSearchName, requestIndex + itemIndex),
        seedItem,
        itemIndex
      )
    ))

    return {
      id: requestId,
      requestNo: seed.requestNo,
      title: seed.title,
      description: seed.description,
      requestDate: seed.requestDate,
      requiredDate: seed.requiredDate,
      department: seed.department,
      requester: seed.requester,
      priority: seed.priority,
      status: seed.status,
      branchId: branch?.id || defaultBranchId,
      notes: seed.notes,
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

const normalizeItem = (
  item: RawPurchaseRequestItem,
  requestId: string,
  index: number,
  stockItems: StockItem[]
): PurchaseRequestItem => {
  const requestedStockItemId = normalizeText(item.stockItemId)
  const fallbackStockItem = stockItems[index % Math.max(stockItems.length, 1)]
  const stockItem = stockItems.find(record => record.id === requestedStockItemId) || fallbackStockItem
  const quantity = normalizePositiveNumber(item.quantity)
  const estimatedUnitPrice = normalizeNonNegativeNumber(item.estimatedUnitPrice)

  return {
    id: normalizeText(item.id) || `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
    requestId,
    stockItemId: stockItem?.id || requestedStockItemId || '',
    quantity,
    unit: stockItem?.unit || item.unit as StockUnit || DEFAULT_UNIT,
    estimatedUnitPrice,
    estimatedTotalPrice: roundPrice(quantity * estimatedUnitPrice),
    notes: normalizeText(item.notes)
  }
}

const normalizePurchaseRequest = (
  item: RawPurchaseRequestRecord,
  index: number,
  stockItems: StockItem[],
  branches: Branch[]
): PurchaseRequestRecord => {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const id = normalizeText(item.id) || `purchase_request_${Date.now()}_${index}`
  const branchIds = new Set(branches.map(branch => branch.id))
  const requestedBranchId = normalizeText(item.branchId)
  const rawItems = Array.isArray(item.items)
    ? item.items
    : Array.isArray(item.requestItems)
      ? item.requestItems
      : []

  const requestNo = normalizeText(item.requestNo) || `PR-${String(index + 1).padStart(6, '0')}`
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id,
    requestNo,
    title: normalizeText(item.title) || `Satinalma Talebi ${index + 1}`,
    description: normalizeText(item.description),
    requestDate: normalizeDate(item.requestDate, today),
    requiredDate: normalizeDate(item.requiredDate, today),
    department: normalizeDepartment(item.department),
    requester: normalizeText(item.requester) || 'Talep Eden',
    priority: normalizePriority(item.priority),
    status: normalizeStatus(item.status),
    branchId: branchIds.has(requestedBranchId) ? requestedBranchId : branches[0]?.id || requestedBranchId || '',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: rawItems
      .filter(isItemRecord)
      .map((record, itemIndex) => normalizeItem(record, id, itemIndex, stockItems))
  }
}

export const savePurchaseRequestRecords = (records: PurchaseRequestRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PURCHASE_REQUEST_STORAGE_KEY, JSON.stringify(records))
}

export const loadPurchaseRequestRecords = (
  stockItems: StockItem[],
  branches: Branch[]
) => {
  const seedRecords = createPurchaseRequestMockData(stockItems, branches)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PURCHASE_REQUEST_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePurchaseRequest(record, index, stockItems, branches))

      savePurchaseRequestRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
  return seedRecords
}
