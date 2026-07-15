import type {
  LabelingRecord,
  LabelingStatus
} from './labeling.types'

const LABELING_STORAGE_KEY = 'ra_labeling'

export const LABELING_STATUSES: LabelingStatus[] = [
  'Bekliyor',
  'Yazdırıldı',
  'İptal'
]

export const LABELING_PRODUCTS = [
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

const normalizeStatus = (value: unknown): LabelingStatus => (
  LABELING_STATUSES.includes(value as LabelingStatus)
    ? value as LabelingStatus
    : 'Bekliyor'
)

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const normalizeDateKey = (value: unknown, fallback: string) => {
  const nextValue = String(value || '').trim()
  return isDateKey(nextValue) ? nextValue : fallback
}

const normalizeStoredLabel = (
  item: Partial<LabelingRecord>,
  index: number
): LabelingRecord => {
  const productionDate = normalizeDateKey(item.productionDate, '2026-07-15')
  const expiryDate = normalizeDateKey(item.expiryDate, productionDate)
  const createdAt = String(item.createdAt || `${productionDate}T08:00:00.000Z`)

  return {
    id: String(item.id || `lbl_${String(index + 1).padStart(3, '0')}`),
    labelNo: String(item.labelNo || `LB-${String(index + 1).padStart(3, '0')}`).trim(),
    productName: String(item.productName || LABELING_PRODUCTS[0]).trim() || LABELING_PRODUCTS[0],
    lotNo: String(item.lotNo || '').trim(),
    barcode: String(item.barcode || '').trim(),
    productionDate,
    expiryDate,
    status: normalizeStatus(item.status),
    operatorName: String(item.operatorName || '').trim(),
    description: String(item.description || '').trim(),
    linkedPackaging: String(item.linkedPackaging || '').trim(),
    linkedShipment: String(item.linkedShipment || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const label = (
  id: string,
  labelNo: string,
  productName: string,
  lotNo: string,
  barcode: string,
  productionDate: string,
  expiryDate: string,
  status: LabelingStatus,
  operatorName: string,
  description: string
): LabelingRecord => normalizeStoredLabel({
  id,
  labelNo,
  productName,
  lotNo,
  barcode,
  productionDate,
  expiryDate,
  status,
  operatorName,
  description,
  linkedPackaging: '',
  linkedShipment: '',
  createdAt: `${productionDate}T08:00:00.000Z`,
  updatedAt: `${productionDate}T08:00:00.000Z`
}, 0)

export const createLabelingMockData = (): LabelingRecord[] => [
  label('lbl_001', 'LB-001', 'Mercimek Çorbası', 'LOT-2026-0715-001', '8680001000011', '2026-07-15', '2026-07-18', 'Yazdırıldı', 'Derya Kaya', 'Termobox sevkiyat etiketi yazdırıldı.'),
  label('lbl_002', 'LB-002', 'Tavuk Döner', 'LOT-2026-0715-002', '8680001000028', '2026-07-15', '2026-07-20', 'Bekliyor', 'Murat Demir', 'Vakum paket etiketi kontrol bekliyor.'),
  label('lbl_003', 'LB-003', 'Et Döner', 'LOT-2026-0715-003', '8680001000035', '2026-07-15', '2026-07-20', 'Bekliyor', 'Selin Acar', 'Lot bilgisi kalite kontrol sonrasında basılacak.'),
  label('lbl_004', 'LB-004', 'Patates Püresi', 'LOT-2026-0715-004', '8680001000042', '2026-07-15', '2026-07-19', 'Yazdırıldı', 'Ece Yılmaz', 'GN küvet etiketleri tamamlandı.'),
  label('lbl_005', 'LB-005', 'Köfte', 'LOT-2026-0715-005', '8680001000059', '2026-07-15', '2026-07-21', 'Bekliyor', 'Onur Şahin', 'Koli etiketi paketleme sonrasında basılacak.'),
  label('lbl_006', 'LB-006', 'Pizza', 'LOT-2026-0715-006', '8680001000066', '2026-07-15', '2026-07-22', 'İptal', 'Ayşe Arslan', 'Paketleme iptali nedeniyle etiket süreci durduruldu.'),
  label('lbl_007', 'LB-007', 'Lazanya', 'LOT-2026-0715-007', '8680001000073', '2026-07-15', '2026-07-19', 'Bekliyor', 'Burak Can', 'Tepsi etiketi operatör onayı bekliyor.'),
  label('lbl_008', 'LB-008', 'Pilav', 'LOT-2026-0715-008', '8680001000080', '2026-07-15', '2026-07-17', 'Yazdırıldı', 'Derya Kaya', 'Porsiyon kap etiketleri hazır.'),
  label('lbl_009', 'LB-009', 'Domates Sosu', 'LOT-2026-0715-009', '8680001000097', '2026-07-15', '2026-07-23', 'Bekliyor', 'Murat Demir', 'Poşet dolum etiketi barkod kontrolünde.'),
  label('lbl_010', 'LB-010', 'Marine Tavuk', 'LOT-2026-0715-010', '8680001000103', '2026-07-15', '2026-07-20', 'Yazdırıldı', 'Selin Acar', 'Vakum paket etiketleri yazdırıldı.')
]

export const saveLabelingRecords = (records: LabelingRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(LABELING_STORAGE_KEY, JSON.stringify(records.map(normalizeStoredLabel)))
}

export const loadLabelingRecords = () => {
  const seedRecords = createLabelingMockData()
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(LABELING_STORAGE_KEY)
  if(storedRecords === null){
    saveLabelingRecords(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredLabel)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  saveLabelingRecords(seedRecords)
  return seedRecords
}
