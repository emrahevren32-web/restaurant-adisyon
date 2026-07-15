import type {
  PackageType,
  PackagingProcess,
  PackagingStatus,
  PackagingUnit
} from './packaging.types'

const PACKAGING_STORAGE_KEY = 'ra_packaging'

export const PACKAGING_STATUSES: PackagingStatus[] = [
  'Bekliyor',
  'Paketleniyor',
  'Tamamlandı',
  'İptal'
]

export const PACKAGING_UNITS: PackagingUnit[] = [
  'kg',
  'lt',
  'adet',
  'koli',
  'tepsi'
]

export const PACKAGE_TYPES: PackageType[] = [
  'Vakum',
  'Termobox',
  'GN Küvet',
  'Plastik Kap',
  'Koli',
  'Tepsi',
  'Poşet'
]

export const PACKAGING_PRODUCTS = [
  'Mercimek Çorbası',
  'Tavuk Döner',
  'Et Döner',
  'Patates Püresi',
  'Köfte',
  'Pizza',
  'Lazanya',
  'Pilav',
  'Domates Sosu',
  'Marine Tavuk'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeStatus = (value: unknown): PackagingStatus => (
  PACKAGING_STATUSES.includes(value as PackagingStatus)
    ? value as PackagingStatus
    : 'Bekliyor'
)

const normalizeUnit = (value: unknown): PackagingUnit => (
  PACKAGING_UNITS.includes(value as PackagingUnit)
    ? value as PackagingUnit
    : 'kg'
)

const normalizePackageType = (value: unknown): PackageType => (
  PACKAGE_TYPES.includes(value as PackageType)
    ? value as PackageType
    : 'Plastik Kap'
)

const normalizeStoredProcess = (
  item: Partial<PackagingProcess>,
  index: number
): PackagingProcess => {
  const quantity = Number(item.quantity)
  const startedAt = String(item.startedAt || new Date().toISOString())
  const createdAt = String(item.createdAt || startedAt)

  return {
    id: String(item.id || `pkg_${String(index + 1).padStart(3, '0')}`),
    packagingNo: String(item.packagingNo || `PK-${String(index + 1).padStart(3, '0')}`).trim(),
    productName: String(item.productName || PACKAGING_PRODUCTS[0]).trim() || PACKAGING_PRODUCTS[0],
    packageType: normalizePackageType(item.packageType),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: normalizeUnit(item.unit),
    startedAt,
    operatorName: String(item.operatorName || '').trim(),
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    linkedBlastChiller: String(item.linkedBlastChiller || '').trim(),
    linkedShipment: String(item.linkedShipment || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const process = (
  id: string,
  packagingNo: string,
  productName: string,
  packageType: PackageType,
  quantity: number,
  unit: PackagingUnit,
  startedAt: string,
  operatorName: string,
  status: PackagingStatus,
  description: string
): PackagingProcess => normalizeStoredProcess({
  id,
  packagingNo,
  productName,
  packageType,
  quantity,
  unit,
  startedAt,
  operatorName,
  status,
  description,
  linkedBlastChiller: '',
  linkedShipment: '',
  createdAt: startedAt,
  updatedAt: startedAt
}, 0)

export const createPackagingMockData = (): PackagingProcess[] => [
  process('pkg_001', 'PK-001', 'Mercimek Çorbası', 'Termobox', 180, 'lt', '2026-07-15T09:10:00.000Z', 'Derya Kaya', 'Tamamlandı', 'Çorba termobox dolum sonrası sevkiyat alanına alınacak.'),
  process('pkg_002', 'PK-002', 'Tavuk Döner', 'Vakum', 120, 'kg', '2026-07-15T10:05:00.000Z', 'Murat Demir', 'Paketleniyor', 'Dilimlenmiş döner vakum paketleme hattında.'),
  process('pkg_003', 'PK-003', 'Et Döner', 'Vakum', 82, 'kg', '2026-07-15T10:35:00.000Z', 'Selin Acar', 'Bekliyor', 'Et döner paketleme sırasına alındı.'),
  process('pkg_004', 'PK-004', 'Patates Püresi', 'GN Küvet', 96, 'kg', '2026-07-15T08:20:00.000Z', 'Ece Yılmaz', 'Tamamlandı', 'GN küvet kapaklama ve etiketleme tamamlandı.'),
  process('pkg_005', 'PK-005', 'Köfte', 'Koli', 64, 'kg', '2026-07-15T11:20:00.000Z', 'Onur Şahin', 'Bekliyor', 'Koli içi porsiyon dizilimi bekleniyor.'),
  process('pkg_006', 'PK-006', 'Pizza', 'Koli', 48, 'adet', '2026-07-15T12:00:00.000Z', 'Ayşe Arslan', 'İptal', 'Kalite kontrol kararıyla paketleme iptal edildi.'),
  process('pkg_007', 'PK-007', 'Lazanya', 'Tepsi', 12, 'tepsi', '2026-07-15T12:45:00.000Z', 'Burak Can', 'Paketleniyor', 'Tepsi bazlı kapatma işlemi devam ediyor.'),
  process('pkg_008', 'PK-008', 'Pilav', 'Plastik Kap', 110, 'kg', '2026-07-15T07:35:00.000Z', 'Derya Kaya', 'Tamamlandı', 'Plastik kap porsiyonlama tamamlandı.'),
  process('pkg_009', 'PK-009', 'Domates Sosu', 'Poşet', 75, 'kg', '2026-07-15T13:10:00.000Z', 'Murat Demir', 'Bekliyor', 'Sos dolum poşetleri paketleme alanında bekliyor.'),
  process('pkg_010', 'PK-010', 'Marine Tavuk', 'Vakum', 90, 'kg', '2026-07-15T09:45:00.000Z', 'Selin Acar', 'Tamamlandı', 'Marine tavuk vakum paketleme tamamlandı.')
]

export const savePackagingProcesses = (processes: PackagingProcess[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PACKAGING_STORAGE_KEY, JSON.stringify(processes.map(normalizeStoredProcess)))
}

export const loadPackagingProcesses = () => {
  const seedProcesses = createPackagingMockData()
  if(!isBrowserStorageAvailable()) return seedProcesses

  const storedProcesses = localStorage.getItem(PACKAGING_STORAGE_KEY)
  if(storedProcesses === null){
    savePackagingProcesses(seedProcesses)
    return seedProcesses
  }

  try {
    const parsed = JSON.parse(storedProcesses)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredProcess)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  savePackagingProcesses(seedProcesses)
  return seedProcesses
}
