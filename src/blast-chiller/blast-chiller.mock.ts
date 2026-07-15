import type {
  BlastChillerProcess,
  BlastChillerStatus,
  BlastChillerUnit
} from './blast-chiller.types'

const BLAST_CHILLER_STORAGE_KEY = 'ra_blast_chiller'

export const BLAST_CHILLER_STATUSES: BlastChillerStatus[] = [
  'Bekliyor',
  'Şoklanıyor',
  'Tamamlandı',
  'İptal'
]

export const BLAST_CHILLER_UNITS: BlastChillerUnit[] = [
  'kg',
  'lt',
  'adet',
  'koli',
  'tepsi'
]

export const BLAST_CHILLER_PRODUCTS = [
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

const normalizeStatus = (value: unknown): BlastChillerStatus => (
  BLAST_CHILLER_STATUSES.includes(value as BlastChillerStatus)
    ? value as BlastChillerStatus
    : 'Bekliyor'
)

const normalizeUnit = (value: unknown): BlastChillerUnit => (
  BLAST_CHILLER_UNITS.includes(value as BlastChillerUnit)
    ? value as BlastChillerUnit
    : 'kg'
)

const addMinutes = (value: string, minutes: number) => (
  new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString()
)

const normalizeStoredProcess = (
  item: Partial<BlastChillerProcess>,
  index: number
): BlastChillerProcess => {
  const quantity = Number(item.quantity)
  const estimatedMinutes = Number(item.estimatedMinutes)
  const actualMinutes = Number(item.actualMinutes)
  const startedAt = String(item.startedAt || new Date().toISOString())
  const normalizedEstimatedMinutes = Number.isFinite(estimatedMinutes) ? Math.max(0, estimatedMinutes) : 0
  const createdAt = String(item.createdAt || startedAt)

  return {
    id: String(item.id || `bc_${String(index + 1).padStart(3, '0')}`),
    processNo: String(item.processNo || `BC-${String(index + 1).padStart(3, '0')}`).trim(),
    productName: String(item.productName || BLAST_CHILLER_PRODUCTS[0]).trim() || BLAST_CHILLER_PRODUCTS[0],
    batchNo: String(item.batchNo || `PARTI-${String(index + 1).padStart(3, '0')}`).trim(),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit: normalizeUnit(item.unit),
    startedAt,
    estimatedEndAt: String(item.estimatedEndAt || addMinutes(startedAt, normalizedEstimatedMinutes)),
    estimatedMinutes: normalizedEstimatedMinutes,
    actualMinutes: Number.isFinite(actualMinutes) ? Math.max(0, actualMinutes) : 0,
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    linkedFinalProduct: String(item.linkedFinalProduct || '').trim(),
    linkedPackaging: String(item.linkedPackaging || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const process = (
  id: string,
  processNo: string,
  productName: string,
  batchNo: string,
  quantity: number,
  unit: BlastChillerUnit,
  startedAt: string,
  estimatedMinutes: number,
  actualMinutes: number,
  status: BlastChillerStatus,
  description: string
): BlastChillerProcess => normalizeStoredProcess({
  id,
  processNo,
  productName,
  batchNo,
  quantity,
  unit,
  startedAt,
  estimatedEndAt: addMinutes(startedAt, estimatedMinutes),
  estimatedMinutes,
  actualMinutes,
  status,
  description,
  linkedFinalProduct: '',
  linkedPackaging: '',
  createdAt: startedAt,
  updatedAt: startedAt
}, 0)

export const createBlastChillerMockData = (): BlastChillerProcess[] => [
  process('bc_001', 'BC-001', 'Mercimek Çorbası', 'PRT-2026-0715-01', 180, 'lt', '2026-07-15T07:20:00.000Z', 90, 92, 'Tamamlandı', 'Çorba dolum sonrası hızlı soğutmaya alındı.'),
  process('bc_002', 'BC-002', 'Tavuk Döner', 'PRT-2026-0715-02', 120, 'kg', '2026-07-15T08:10:00.000Z', 120, 0, 'Şoklanıyor', 'Dilimlenmiş tavuk döner paketleme öncesi soğutuluyor.'),
  process('bc_003', 'BC-003', 'Et Döner', 'PRT-2026-0715-03', 82, 'kg', '2026-07-15T09:00:00.000Z', 130, 0, 'Bekliyor', 'Et döner tepsileri şoklama sırasına alındı.'),
  process('bc_004', 'BC-004', 'Patates Püresi', 'PRT-2026-0715-04', 96, 'kg', '2026-07-15T06:45:00.000Z', 75, 78, 'Tamamlandı', 'Porsiyonlama öncesi sıcak ürün güvenli dereceye indirildi.'),
  process('bc_005', 'BC-005', 'Köfte', 'PRT-2026-0715-05', 64, 'kg', '2026-07-15T10:20:00.000Z', 105, 0, 'Bekliyor', 'Köfte üretim partisi şoklama dolabı bekleme alanında.'),
  process('bc_006', 'BC-006', 'Pizza', 'PRT-2026-0715-06', 48, 'adet', '2026-07-15T11:00:00.000Z', 70, 0, 'İptal', 'Ürün kalite kontrol kararıyla şoklama iptal edildi.'),
  process('bc_007', 'BC-007', 'Lazanya', 'PRT-2026-0715-07', 12, 'tepsi', '2026-07-15T11:40:00.000Z', 140, 0, 'Şoklanıyor', 'Tepsi bazlı ürünler raf aralığı korunarak yerleştirildi.'),
  process('bc_008', 'BC-008', 'Pilav', 'PRT-2026-0715-08', 110, 'kg', '2026-07-15T05:55:00.000Z', 80, 82, 'Tamamlandı', 'Toplu yemek sevkiyatı için pişmiş pilav soğutuldu.'),
  process('bc_009', 'BC-009', 'Domates Sosu', 'PRT-2026-0715-09', 75, 'kg', '2026-07-15T12:15:00.000Z', 95, 0, 'Bekliyor', 'Sos tankından tepsiye alınan ürün şoklama bekliyor.'),
  process('bc_010', 'BC-010', 'Marine Tavuk', 'PRT-2026-0715-10', 90, 'kg', '2026-07-15T07:55:00.000Z', 100, 101, 'Tamamlandı', 'Marine edilmiş tavuk paketleme öncesi soğutuldu.')
]

export const saveBlastChillerProcesses = (processes: BlastChillerProcess[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(BLAST_CHILLER_STORAGE_KEY, JSON.stringify(processes.map(normalizeStoredProcess)))
}

export const loadBlastChillerProcesses = () => {
  const seedProcesses = createBlastChillerMockData()
  if(!isBrowserStorageAvailable()) return seedProcesses

  const storedProcesses = localStorage.getItem(BLAST_CHILLER_STORAGE_KEY)
  if(storedProcesses === null){
    saveBlastChillerProcesses(seedProcesses)
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

  saveBlastChillerProcesses(seedProcesses)
  return seedProcesses
}
