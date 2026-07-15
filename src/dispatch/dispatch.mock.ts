import type {
  DispatchProcess,
  DispatchStatus
} from './dispatch.types'

const DISPATCH_STORAGE_KEY = 'ra_dispatch'

export const DISPATCH_STATUSES: DispatchStatus[] = [
  'Hazırlanıyor',
  'Yolda',
  'Teslim Edildi',
  'İptal'
]

export const DISPATCH_CUSTOMERS = [
  'Merkez Hastane',
  'Belediye Yemekhanesi',
  'ABC Fabrikası',
  'XYZ Okulu',
  'Merkez Şube',
  'Batı Şube',
  'Doğu Şube',
  'Personel Yemekhanesi',
  'Lojistik Deposu',
  'Havalimanı Catering'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeStatus = (value: unknown): DispatchStatus => (
  DISPATCH_STATUSES.includes(value as DispatchStatus)
    ? value as DispatchStatus
    : 'Hazırlanıyor'
)

const isDateTimeValue = (value: string) => !Number.isNaN(new Date(value).getTime())

const normalizeDateTime = (value: unknown, fallback: string) => {
  const nextValue = String(value || '').trim()
  return isDateTimeValue(nextValue) ? nextValue : fallback
}

const normalizeStoredDispatch = (
  item: Partial<DispatchProcess>,
  index: number
): DispatchProcess => {
  const departureDate = normalizeDateTime(item.departureDate, '2026-07-15T08:00:00.000Z')
  const estimatedDeliveryDate = normalizeDateTime(item.estimatedDeliveryDate, departureDate)
  const actualDeliveryDate = item.actualDeliveryDate
    ? normalizeDateTime(item.actualDeliveryDate, '')
    : ''
  const totalProducts = Number(item.totalProducts)
  const totalQuantity = Number(item.totalQuantity)
  const createdAt = String(item.createdAt || departureDate)

  return {
    id: String(item.id || `dsp_${String(index + 1).padStart(3, '0')}`),
    dispatchNo: String(item.dispatchNo || `DS-${String(index + 1).padStart(3, '0')}`).trim(),
    customerName: String(item.customerName || DISPATCH_CUSTOMERS[0]).trim() || DISPATCH_CUSTOMERS[0],
    vehicle: String(item.vehicle || '').trim(),
    driverName: String(item.driverName || '').trim(),
    departureDate,
    estimatedDeliveryDate,
    actualDeliveryDate,
    totalProducts: Number.isFinite(totalProducts) ? totalProducts : 0,
    totalQuantity: Number.isFinite(totalQuantity) ? totalQuantity : 0,
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    linkedLabeling: String(item.linkedLabeling || '').trim(),
    linkedWaybill: String(item.linkedWaybill || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const dispatch = (
  id: string,
  dispatchNo: string,
  customerName: string,
  vehicle: string,
  driverName: string,
  departureDate: string,
  estimatedDeliveryDate: string,
  actualDeliveryDate: string,
  totalProducts: number,
  totalQuantity: number,
  status: DispatchStatus,
  description: string
): DispatchProcess => normalizeStoredDispatch({
  id,
  dispatchNo,
  customerName,
  vehicle,
  driverName,
  departureDate,
  estimatedDeliveryDate,
  actualDeliveryDate,
  totalProducts,
  totalQuantity,
  status,
  description,
  linkedLabeling: '',
  linkedWaybill: '',
  createdAt: departureDate,
  updatedAt: departureDate
}, 0)

export const createDispatchMockData = (): DispatchProcess[] => [
  dispatch('dsp_001', 'DS-001', 'Merkez Hastane', '34 ABC 101', 'Murat Kaya', '2026-07-15T06:30:00.000Z', '2026-07-15T08:30:00.000Z', '2026-07-15T08:20:00.000Z', 8, 420, 'Teslim Edildi', 'Sabah kahvaltı ve öğle üretimi hastane mutfağına teslim edildi.'),
  dispatch('dsp_002', 'DS-002', 'Belediye Yemekhanesi', '34 DEF 202', 'Selin Acar', '2026-07-15T07:15:00.000Z', '2026-07-15T09:00:00.000Z', '', 6, 315, 'Yolda', 'Sıcak ürün kasaları sevkiyat aracına yüklendi.'),
  dispatch('dsp_003', 'DS-003', 'ABC Fabrikası', '34 GHI 303', 'Onur Şahin', '2026-07-15T09:00:00.000Z', '2026-07-15T11:00:00.000Z', '', 5, 260, 'Hazırlanıyor', 'Etiket kontrolü tamamlanan ürünler yükleme alanında bekliyor.'),
  dispatch('dsp_004', 'DS-004', 'XYZ Okulu', '34 JKL 404', 'Derya Demir', '2026-07-15T10:20:00.000Z', '2026-07-15T12:15:00.000Z', '', 7, 340, 'Hazırlanıyor', 'Okul yemekhane dağıtımı için koli sayımı yapılıyor.'),
  dispatch('dsp_005', 'DS-005', 'Merkez Şube', '34 MNO 505', 'Burak Can', '2026-07-15T11:00:00.000Z', '2026-07-15T12:00:00.000Z', '2026-07-15T11:50:00.000Z', 4, 180, 'Teslim Edildi', 'Merkez şube günlük üretim transferi tamamlandı.'),
  dispatch('dsp_006', 'DS-006', 'Batı Şube', '34 PRS 606', 'Ayşe Arslan', '2026-07-15T12:30:00.000Z', '2026-07-15T14:00:00.000Z', '', 6, 295, 'Yolda', 'Batı şube soğuk zincir taşıma süreci devam ediyor.'),
  dispatch('dsp_007', 'DS-007', 'Doğu Şube', '34 TUV 707', 'Ece Yılmaz', '2026-07-15T13:15:00.000Z', '2026-07-15T15:10:00.000Z', '', 5, 240, 'Hazırlanıyor', 'Doğu şube için son koli kontrolü bekleniyor.'),
  dispatch('dsp_008', 'DS-008', 'Personel Yemekhanesi', '34 YZ 808', 'Mert Öztürk', '2026-07-15T08:10:00.000Z', '2026-07-15T09:20:00.000Z', '2026-07-15T09:15:00.000Z', 3, 150, 'Teslim Edildi', 'Personel yemekhanesi sevkiyatı teslim alındı.'),
  dispatch('dsp_009', 'DS-009', 'Lojistik Deposu', '34 KLM 909', 'Nesrin Koç', '2026-07-15T14:00:00.000Z', '2026-07-15T16:00:00.000Z', '', 9, 520, 'İptal', 'Araç planı değiştiği için sevkiyat iptal edildi.'),
  dispatch('dsp_010', 'DS-010', 'Havalimanı Catering', '34 NOP 010', 'Kerem Yıldız', '2026-07-15T15:30:00.000Z', '2026-07-15T17:45:00.000Z', '', 8, 460, 'Hazırlanıyor', 'Uçuş catering sevkiyatı için mühürlü kasa hazırlığı sürüyor.')
]

export const saveDispatchProcesses = (processes: DispatchProcess[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(processes.map(normalizeStoredDispatch)))
}

export const loadDispatchProcesses = () => {
  const seedProcesses = createDispatchMockData()
  if(!isBrowserStorageAvailable()) return seedProcesses

  const storedProcesses = localStorage.getItem(DISPATCH_STORAGE_KEY)
  if(storedProcesses === null){
    saveDispatchProcesses(seedProcesses)
    return seedProcesses
  }

  try {
    const parsed = JSON.parse(storedProcesses)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredDispatch)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  saveDispatchProcesses(seedProcesses)
  return seedProcesses
}
