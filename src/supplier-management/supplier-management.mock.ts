import type {
  Supplier,
  SupplierApprovalStatus,
  SupplierCompanyType,
  SupplierStatus
} from './supplier-management.types'

export const SUPPLIER_MANAGEMENT_STORAGE_KEY = 'ra_suppliers'

export const SUPPLIER_STATUSES: SupplierStatus[] = [
  'ACTIVE',
  'PASSIVE',
  'BLOCKED'
]

export const SUPPLIER_APPROVAL_STATUSES: SupplierApprovalStatus[] = [
  'APPROVED',
  'PENDING',
  'REJECTED'
]

export const SUPPLIER_COMPANY_TYPES: SupplierCompanyType[] = [
  'MANUFACTURER',
  'WHOLESALER',
  'DISTRIBUTOR',
  'LOCAL_SUPPLIER'
]

export const SUPPLIER_CURRENCIES = ['TRY', 'USD', 'EUR'] as const

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  BLOCKED: 'Blokeli'
}

export const SUPPLIER_APPROVAL_STATUS_LABELS: Record<SupplierApprovalStatus, string> = {
  APPROVED: 'Onaylı',
  PENDING: 'Bekliyor',
  REJECTED: 'Reddedildi'
}

export const SUPPLIER_COMPANY_TYPE_LABELS: Record<SupplierCompanyType, string> = {
  MANUFACTURER: 'Üretici',
  WHOLESALER: 'Toptancı',
  DISTRIBUTOR: 'Distribütör',
  LOCAL_SUPPLIER: 'Yerel Tedarikçi'
}

type RawSupplierRecord = Partial<Record<keyof Supplier, unknown>> & Record<string, unknown>

const DEFAULT_COUNTRY = 'Türkiye'
const DEFAULT_CURRENCY = 'TRY'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawSupplierRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeStatus = (value: unknown): SupplierStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(SUPPLIER_STATUSES.includes(normalized as SupplierStatus)) return normalized as SupplierStatus

  if(value === false) return 'PASSIVE'
  return 'ACTIVE'
}

const normalizeApprovalStatus = (value: unknown): SupplierApprovalStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(SUPPLIER_APPROVAL_STATUSES.includes(normalized as SupplierApprovalStatus)){
    return normalized as SupplierApprovalStatus
  }

  if(value === true) return 'APPROVED'
  return 'PENDING'
}

const normalizeCompanyType = (value: unknown): SupplierCompanyType => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_COMPANY_TYPES.includes(normalized as SupplierCompanyType)
    ? normalized as SupplierCompanyType
    : 'LOCAL_SUPPLIER'
}

const normalizeCurrency = (value: unknown) => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_CURRENCIES.includes(normalized as typeof SUPPLIER_CURRENCIES[number])
    ? normalized
    : DEFAULT_CURRENCY
}

const createSupplierCode = (index: number) => `TD-${String(index + 1).padStart(3, '0')}`

const supplier = (
  id: string,
  supplierCode: string,
  name: string,
  tradeName: string,
  sectorNote: string,
  companyType: SupplierCompanyType,
  status: SupplierStatus,
  approvalStatus: SupplierApprovalStatus,
  city: string,
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  leadTimeDays: number,
  paymentTermDays: number,
  minimumOrderAmount: number,
  createdAt: string
): Supplier => ({
  id,
  supplierCode,
  name,
  tradeName,
  taxOffice: `${city} Vergi Dairesi`,
  taxNumber: `TR${supplierCode.replace(/\D/g, '').padStart(8, '0')}`,
  companyType,
  status,
  approvalStatus,
  defaultCurrency: DEFAULT_CURRENCY,
  paymentTermDays,
  leadTimeDays,
  minimumOrderAmount,
  contactName,
  contactPhone,
  contactEmail,
  website: `https://www.${name.toLocaleLowerCase('tr-TR').replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
  address: `${city} Organize Gıda Bölgesi No: ${supplierCode.replace(/\D/g, '') || '1'}`,
  city,
  country: DEFAULT_COUNTRY,
  notes: sectorNote,
  createdAt,
  updatedAt: createdAt
})

export const createSupplierManagementMockData = (): Supplier[] => [
  supplier('supplier_001', 'TD-001', 'Anadolu Et Tedarik', 'Anadolu Et Gıda A.Ş.', 'Et tedariki için onaylı ana tedarikçi.', 'MANUFACTURER', 'ACTIVE', 'APPROVED', 'İstanbul', 'Murat Yılmaz', '0212 555 10 01', 'murat.yilmaz@anadoluet.com', 2, 15, 25000, '2026-07-10T08:00:00.000Z'),
  supplier('supplier_002', 'TD-002', 'Beyaz Kanat Gıda', 'Beyaz Kanat Tavukçuluk Ltd.', 'Tavuk ve hindi ürünlerinde düzenli teslimat sağlar.', 'DISTRIBUTOR', 'ACTIVE', 'APPROVED', 'Bursa', 'Selin Kara', '0224 555 10 02', 'selin.kara@beyazkanat.com', 1, 10, 15000, '2026-07-10T08:20:00.000Z'),
  supplier('supplier_003', 'TD-003', 'Yeşilova Sebze', 'Yeşilova Hal Tedarik', 'Günlük sebze ve yeşillik alımları için yerel tedarikçi.', 'LOCAL_SUPPLIER', 'ACTIVE', 'PENDING', 'Antalya', 'Hasan Demir', '0242 555 10 03', 'hasan.demir@yesilova.com', 1, 7, 5000, '2026-07-10T08:40:00.000Z'),
  supplier('supplier_004', 'TD-004', 'Ege Meyve Hal', 'Ege Meyve ve Narenciye', 'Mevsimlik meyve ve narenciye tedariki.', 'WHOLESALER', 'ACTIVE', 'APPROVED', 'İzmir', 'Aylin Eren', '0232 555 10 04', 'aylin.eren@egemeyve.com', 2, 14, 8000, '2026-07-10T09:00:00.000Z'),
  supplier('supplier_005', 'TD-005', 'Marmara Süt Ürünleri', 'Marmara Süt Sanayi A.Ş.', 'Süt, yoğurt, krema ve peynir grubu için ana tedarikçi.', 'MANUFACTURER', 'ACTIVE', 'APPROVED', 'Balıkesir', 'Kerem Öz', '0266 555 10 05', 'kerem.oz@marmarasut.com', 2, 21, 18000, '2026-07-10T09:20:00.000Z'),
  supplier('supplier_006', 'TD-006', 'Doğu Baharat', 'Doğu Baharat ve Kuruyemiş', 'Baharat, kuru ot ve özel karışımlar için toptancı.', 'WHOLESALER', 'ACTIVE', 'APPROVED', 'Gaziantep', 'Zeynep Aksoy', '0342 555 10 06', 'zeynep.aksoy@dogubaharat.com', 3, 30, 7000, '2026-07-10T09:40:00.000Z'),
  supplier('supplier_007', 'TD-007', 'Serin İçecek Dağıtım', 'Serin İçecek Pazarlama', 'Su, meşrubat ve sıcak içecek sarf ürünleri.', 'DISTRIBUTOR', 'PASSIVE', 'PENDING', 'Ankara', 'Okan Çelik', '0312 555 10 07', 'okan.celik@serinicecek.com', 2, 14, 10000, '2026-07-10T10:00:00.000Z'),
  supplier('supplier_008', 'TD-008', 'Hijyen Pro Temizlik', 'Hijyen Pro Endüstriyel', 'Temizlik kimyasalları ve hijyen sarf malzemeleri.', 'DISTRIBUTOR', 'ACTIVE', 'APPROVED', 'Kocaeli', 'Elif Şahin', '0262 555 10 08', 'elif.sahin@hijyenpro.com', 4, 30, 12000, '2026-07-10T10:20:00.000Z'),
  supplier('supplier_009', 'TD-009', 'Paket Ambalaj', 'Paket Ambalaj Çözümleri', 'Paketleme, kap, streç ve etiket sarf ürünleri.', 'MANUFACTURER', 'ACTIVE', 'APPROVED', 'İstanbul', 'Burak Arslan', '0216 555 10 09', 'burak.arslan@paketambalaj.com', 5, 30, 20000, '2026-07-10T10:40:00.000Z'),
  supplier('supplier_010', 'TD-010', 'Bereket Unlu Mamuller', 'Bereket Unlu Mamuller Ltd.', 'Un, hamur, ekmek ve unlu mamul ürünleri.', 'LOCAL_SUPPLIER', 'BLOCKED', 'REJECTED', 'Konya', 'Derya Koç', '0332 555 10 10', 'derya.koc@bereketunlu.com', 2, 7, 6000, '2026-07-10T11:00:00.000Z')
]

const normalizeSupplier = (item: RawSupplierRecord, index: number): Supplier => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const supplierCode = normalizeText(item.supplierCode || item.code) || createSupplierCode(index)
  const name = normalizeText(item.name || item.companyName || item.tradeName) || `Tedarikçi ${index + 1}`

  return {
    id: normalizeText(item.id) || `supplier_${Date.now()}_${index}`,
    supplierCode,
    name,
    tradeName: normalizeText(item.tradeName),
    taxOffice: normalizeText(item.taxOffice),
    taxNumber: normalizeText(item.taxNumber),
    companyType: normalizeCompanyType(item.companyType || item.type),
    status: normalizeStatus(item.status ?? item.isActive),
    approvalStatus: normalizeApprovalStatus(item.approvalStatus ?? item.approved),
    defaultCurrency: normalizeCurrency(item.defaultCurrency),
    paymentTermDays: normalizeNonNegativeNumber(item.paymentTermDays),
    leadTimeDays: normalizeNonNegativeNumber(item.leadTimeDays),
    minimumOrderAmount: normalizeNonNegativeNumber(item.minimumOrderAmount),
    contactName: normalizeText(item.contactName || item.authorizedPerson),
    contactPhone: normalizeText(item.contactPhone || item.phone),
    contactEmail: normalizeText(item.contactEmail || item.email),
    website: normalizeText(item.website),
    address: normalizeText(item.address),
    city: normalizeText(item.city),
    country: normalizeText(item.country) || DEFAULT_COUNTRY,
    notes: normalizeText(item.notes || item.note),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveSupplierManagementRecords = (records: Supplier[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(SUPPLIER_MANAGEMENT_STORAGE_KEY, JSON.stringify(records))
}

export const loadSupplierManagementRecords = () => {
  const seedRecords = createSupplierManagementMockData()

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SUPPLIER_MANAGEMENT_STORAGE_KEY)

  if(!storedRecords){
    saveSupplierManagementRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeSupplier)

      saveSupplierManagementRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    saveSupplierManagementRecords(seedRecords)
    return seedRecords
  }

  saveSupplierManagementRecords(seedRecords)
  return seedRecords
}
