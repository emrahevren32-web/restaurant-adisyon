import type {
  Supplier,
  SupplierApprovalStatus,
  SupplierCategory,
  SupplierCompanyType,
  SupplierStatus,
  SupplierType,
  SupplierWorkingStatus
} from './supplier-management.types'

export const SUPPLIER_MANAGEMENT_STORAGE_KEY = 'ra_suppliers'

export const SUPPLIER_STATUSES: SupplierStatus[] = [
  'ACTIVE',
  'PASSIVE',
  'PENDING_APPROVAL',
  'SUSPENDED',
  'BLACKLISTED'
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

export const SUPPLIER_TYPES: SupplierType[] = [
  'RAW_MATERIAL',
  'PACKAGING',
  'CLEANING',
  'CONSUMABLE',
  'LOGISTICS',
  'MACHINE',
  'MAINTENANCE',
  'SERVICE',
  'OTHER'
]

export const SUPPLIER_WORKING_STATUSES: SupplierWorkingStatus[] = [
  'ACTIVE_WORKING',
  'LIMITED',
  'ON_HOLD',
  'STOPPED'
]

export const SUPPLIER_CURRENCIES = ['TRY', 'USD', 'EUR'] as const

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  PENDING_APPROVAL: 'Onay Bekliyor',
  SUSPENDED: 'Askıya Alındı',
  BLACKLISTED: 'Kara Liste',
  BLOCKED: 'Kara Liste'
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

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  RAW_MATERIAL: 'Hammadde',
  PACKAGING: 'Ambalaj',
  CLEANING: 'Temizlik',
  CONSUMABLE: 'Sarf Malzeme',
  LOGISTICS: 'Lojistik',
  MACHINE: 'Makine',
  MAINTENANCE: 'Bakım',
  SERVICE: 'Hizmet',
  OTHER: 'Diğer'
}

export const SUPPLIER_WORKING_STATUS_LABELS: Record<SupplierWorkingStatus, string> = {
  ACTIVE_WORKING: 'Çalışılıyor',
  LIMITED: 'Limitli',
  ON_HOLD: 'Beklemede',
  STOPPED: 'Durduruldu'
}

export const SUPPLIER_CATEGORIES: SupplierCategory[] = [
  { id: 'supplier_category_raw_material', name: 'Hammadde', type: 'RAW_MATERIAL', description: 'Et, sebze, süt, bakliyat, yağ ve baharat tedarikçileri.', active: true, sortOrder: 10 },
  { id: 'supplier_category_packaging', name: 'Ambalaj', type: 'PACKAGING', description: 'Kap, film, koli, etiket ve paketleme sarfları.', active: true, sortOrder: 20 },
  { id: 'supplier_category_cleaning', name: 'Temizlik', type: 'CLEANING', description: 'Kimyasal, dezenfektan ve hijyen ürünleri.', active: true, sortOrder: 30 },
  { id: 'supplier_category_consumable', name: 'Sarf Malzeme', type: 'CONSUMABLE', description: 'Tek kullanımlık operasyon sarfları.', active: true, sortOrder: 40 },
  { id: 'supplier_category_logistics', name: 'Lojistik', type: 'LOGISTICS', description: 'Soğuk zincir, taşıma ve dağıtım hizmetleri.', active: true, sortOrder: 50 },
  { id: 'supplier_category_machine', name: 'Makine', type: 'MACHINE', description: 'Endüstriyel mutfak ekipman ve makine tedariki.', active: true, sortOrder: 60 },
  { id: 'supplier_category_maintenance', name: 'Bakım', type: 'MAINTENANCE', description: 'Servis, bakım ve yedek parça hizmetleri.', active: true, sortOrder: 70 },
  { id: 'supplier_category_service', name: 'Hizmet', type: 'SERVICE', description: 'Danışmanlık, analiz, denetim ve dış hizmetler.', active: true, sortOrder: 80 },
  { id: 'supplier_category_other', name: 'Diğer', type: 'OTHER', description: 'Sınıflandırılmamış tedarikçiler.', active: true, sortOrder: 90 }
]

type RawSupplierRecord = Partial<Record<keyof Supplier, unknown>> & Record<string, unknown>

type SupplierSeed = {
  name: string
  tradeName: string
  type: SupplierType
  companyType: SupplierCompanyType
  status: SupplierStatus
  approvalStatus: SupplierApprovalStatus
  workingStatus: SupplierWorkingStatus
  city: string
  district: string
  contactName: string
  phonePrefix: string
  leadTimeDays: number
  paymentTermDays: number
  minimumOrderAmount: number
  notes: string
}

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

const createSupplierCode = (index: number) => `TD-${String(index + 1).padStart(3, '0')}`

const normalizeStatus = (value: unknown): SupplierStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(normalized === 'BLOCKED') return 'BLACKLISTED'
  if(SUPPLIER_STATUSES.includes(normalized as SupplierStatus)) return normalized as SupplierStatus
  if(value === false) return 'PASSIVE'
  return 'ACTIVE'
}

const normalizeApprovalStatus = (value: unknown, status?: SupplierStatus): SupplierApprovalStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(SUPPLIER_APPROVAL_STATUSES.includes(normalized as SupplierApprovalStatus)){
    return normalized as SupplierApprovalStatus
  }
  if(status === 'ACTIVE') return 'APPROVED'
  if(status === 'BLACKLISTED' || status === 'SUSPENDED') return 'REJECTED'
  if(value === true) return 'APPROVED'
  return 'PENDING'
}

const normalizeCompanyType = (value: unknown): SupplierCompanyType => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_COMPANY_TYPES.includes(normalized as SupplierCompanyType)
    ? normalized as SupplierCompanyType
    : 'LOCAL_SUPPLIER'
}

const normalizeSupplierType = (value: unknown): SupplierType => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_TYPES.includes(normalized as SupplierType)
    ? normalized as SupplierType
    : 'RAW_MATERIAL'
}

const normalizeWorkingStatus = (value: unknown, status: SupplierStatus): SupplierWorkingStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(SUPPLIER_WORKING_STATUSES.includes(normalized as SupplierWorkingStatus)){
    return normalized as SupplierWorkingStatus
  }
  if(status === 'ACTIVE') return 'ACTIVE_WORKING'
  if(status === 'PASSIVE') return 'STOPPED'
  return 'ON_HOLD'
}

const normalizeCurrency = (value: unknown) => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_CURRENCIES.includes(normalized as typeof SUPPLIER_CURRENCIES[number])
    ? normalized
    : DEFAULT_CURRENCY
}

const getCategoryIdByType = (type: SupplierType) => (
  SUPPLIER_CATEGORIES.find(category => category.type === type)?.id || 'supplier_category_other'
)

const normalizeCategoryIds = (value: unknown, type: SupplierType) => {
  const ids = Array.isArray(value)
    ? value.map(normalizeText).filter(Boolean)
    : normalizeText(value)
      ? [normalizeText(value)]
      : []

  return ids.length > 0 ? ids : [getCategoryIdByType(type)]
}

const slug = (value: string) => (
  value
    .toLocaleLowerCase('tr-TR')
    .replace(/[ığ]/g, 'i')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '')
)

const supplierSeeds: SupplierSeed[] = [
  { name: 'Anadolu Et Tedarik', tradeName: 'Anadolu Et Gıda A.Ş.', type: 'RAW_MATERIAL', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Tuzla', contactName: 'Murat Yılmaz', phonePrefix: '0212', leadTimeDays: 2, paymentTermDays: 15, minimumOrderAmount: 25000, notes: 'Et tedariki için onaylı ana tedarikçi.' },
  { name: 'Beyaz Kanat Gıda', tradeName: 'Beyaz Kanat Tavukçuluk Ltd.', type: 'RAW_MATERIAL', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Bursa', district: 'Nilüfer', contactName: 'Selin Kara', phonePrefix: '0224', leadTimeDays: 1, paymentTermDays: 10, minimumOrderAmount: 15000, notes: 'Tavuk ve hindi ürünlerinde düzenli teslimat sağlar.' },
  { name: 'Yeşilova Sebze', tradeName: 'Yeşilova Hal Tedarik', type: 'RAW_MATERIAL', companyType: 'LOCAL_SUPPLIER', status: 'PENDING_APPROVAL', approvalStatus: 'PENDING', workingStatus: 'ON_HOLD', city: 'Antalya', district: 'Kepez', contactName: 'Hasan Demir', phonePrefix: '0242', leadTimeDays: 1, paymentTermDays: 7, minimumOrderAmount: 5000, notes: 'Günlük sebze ve yeşillik alımları için aday yerel tedarikçi.' },
  { name: 'Ege Meyve Hal', tradeName: 'Ege Meyve ve Narenciye', type: 'RAW_MATERIAL', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İzmir', district: 'Bornova', contactName: 'Aylin Eren', phonePrefix: '0232', leadTimeDays: 2, paymentTermDays: 14, minimumOrderAmount: 8000, notes: 'Mevsimlik meyve ve narenciye tedariki.' },
  { name: 'Marmara Süt Ürünleri', tradeName: 'Marmara Süt Sanayi A.Ş.', type: 'RAW_MATERIAL', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Balıkesir', district: 'Bandırma', contactName: 'Kerem Öz', phonePrefix: '0266', leadTimeDays: 2, paymentTermDays: 21, minimumOrderAmount: 18000, notes: 'Süt, yoğurt, krema ve peynir grubu için ana tedarikçi.' },
  { name: 'Doğu Baharat', tradeName: 'Doğu Baharat ve Kuruyemiş', type: 'RAW_MATERIAL', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Gaziantep', district: 'Şahinbey', contactName: 'Zeynep Aksoy', phonePrefix: '0342', leadTimeDays: 3, paymentTermDays: 30, minimumOrderAmount: 7000, notes: 'Baharat, kuru ot ve özel karışımlar için toptancı.' },
  { name: 'Serin İçecek Dağıtım', tradeName: 'Serin İçecek Pazarlama', type: 'CONSUMABLE', companyType: 'DISTRIBUTOR', status: 'PASSIVE', approvalStatus: 'PENDING', workingStatus: 'STOPPED', city: 'Ankara', district: 'Etimesgut', contactName: 'Okan Çelik', phonePrefix: '0312', leadTimeDays: 2, paymentTermDays: 14, minimumOrderAmount: 10000, notes: 'Su, meşrubat ve sıcak içecek sarf ürünleri.' },
  { name: 'Hijyen Pro Temizlik', tradeName: 'Hijyen Pro Endüstriyel', type: 'CLEANING', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Kocaeli', district: 'Gebze', contactName: 'Elif Şahin', phonePrefix: '0262', leadTimeDays: 4, paymentTermDays: 30, minimumOrderAmount: 12000, notes: 'Temizlik kimyasalları ve hijyen sarf malzemeleri.' },
  { name: 'Paket Ambalaj', tradeName: 'Paket Ambalaj Çözümleri', type: 'PACKAGING', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Esenyurt', contactName: 'Burak Arslan', phonePrefix: '0216', leadTimeDays: 5, paymentTermDays: 30, minimumOrderAmount: 20000, notes: 'Paketleme, kap, streç ve etiket sarf ürünleri.' },
  { name: 'Bereket Unlu Mamuller', tradeName: 'Bereket Unlu Mamuller Ltd.', type: 'RAW_MATERIAL', companyType: 'LOCAL_SUPPLIER', status: 'BLACKLISTED', approvalStatus: 'REJECTED', workingStatus: 'STOPPED', city: 'Konya', district: 'Selçuklu', contactName: 'Derya Koç', phonePrefix: '0332', leadTimeDays: 2, paymentTermDays: 7, minimumOrderAmount: 6000, notes: 'Kalite reddi nedeniyle kara listeye alınmış un tedarikçisi.' },
  { name: 'Metro Gıda Toptan', tradeName: 'Metro Gıda Toptan Satış', type: 'RAW_MATERIAL', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Bayrampaşa', contactName: 'Emre Kaya', phonePrefix: '0212', leadTimeDays: 2, paymentTermDays: 21, minimumOrderAmount: 30000, notes: 'Genel gıda ve kuru gıda alımlarında yüksek hacimli tedarikçi.' },
  { name: 'Lotus Soğuk Lojistik', tradeName: 'Lotus Lojistik Hizmetleri A.Ş.', type: 'LOGISTICS', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'LIMITED', city: 'İstanbul', district: 'Pendik', contactName: 'Gizem Acar', phonePrefix: '0216', leadTimeDays: 1, paymentTermDays: 30, minimumOrderAmount: 18000, notes: 'Soğuk zincir taşıma ve bölgesel dağıtım hizmeti.' },
  { name: 'Endüstri Mutfak Makina', tradeName: 'Endüstri Mutfak Makina Sanayi', type: 'MACHINE', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İzmir', district: 'Kemalpaşa', contactName: 'Tolga Sönmez', phonePrefix: '0232', leadTimeDays: 14, paymentTermDays: 45, minimumOrderAmount: 75000, notes: 'Endüstriyel fırın, mikser ve pişirme ekipmanı tedariki.' },
  { name: 'Mutfak Teknik Servis', tradeName: 'Mutfak Teknik Bakım Ltd.', type: 'MAINTENANCE', companyType: 'LOCAL_SUPPLIER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Kadıköy', contactName: 'İlker Usta', phonePrefix: '0216', leadTimeDays: 1, paymentTermDays: 15, minimumOrderAmount: 5000, notes: 'Acil bakım, yedek parça ve periyodik servis.' },
  { name: 'Safir Kimya', tradeName: 'Safir Kimya Sanayi A.Ş.', type: 'CLEANING', companyType: 'MANUFACTURER', status: 'PENDING_APPROVAL', approvalStatus: 'PENDING', workingStatus: 'ON_HOLD', city: 'Tekirdağ', district: 'Çorlu', contactName: 'Melis Deniz', phonePrefix: '0282', leadTimeDays: 5, paymentTermDays: 30, minimumOrderAmount: 16000, notes: 'Kimyasal ürün validasyonu bekleyen temizlik tedarikçisi.' },
  { name: 'Trakya Yumurta', tradeName: 'Trakya Yumurta Üretim', type: 'RAW_MATERIAL', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Edirne', district: 'Keşan', contactName: 'Seda Polat', phonePrefix: '0284', leadTimeDays: 2, paymentTermDays: 14, minimumOrderAmount: 9000, notes: 'Yumurta ve sıvı yumurta ürünleri.' },
  { name: 'Karadeniz Balık', tradeName: 'Karadeniz Balıkçılık A.Ş.', type: 'RAW_MATERIAL', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'LIMITED', city: 'Trabzon', district: 'Ortahisar', contactName: 'Tamer Çolak', phonePrefix: '0462', leadTimeDays: 3, paymentTermDays: 21, minimumOrderAmount: 22000, notes: 'Balık ve deniz ürünü tedariği; mevsimsel kapasite sınırlı.' },
  { name: 'İpek Bakliyat', tradeName: 'İpek Bakliyat ve Hububat', type: 'RAW_MATERIAL', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Mersin', district: 'Akdeniz', contactName: 'Nihat Işık', phonePrefix: '0324', leadTimeDays: 3, paymentTermDays: 30, minimumOrderAmount: 14000, notes: 'Pirinç, bulgur, nohut, mercimek ve kuru bakliyat.' },
  { name: 'Akdeniz Zeytinyağı', tradeName: 'Akdeniz Yağ Gıda', type: 'RAW_MATERIAL', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Aydın', district: 'Efeler', contactName: 'Gül Aydın', phonePrefix: '0256', leadTimeDays: 4, paymentTermDays: 30, minimumOrderAmount: 18000, notes: 'Zeytinyağı ve bitkisel yağ tedariği.' },
  { name: 'Nova Paketleme', tradeName: 'Nova Paketleme Teknolojileri', type: 'PACKAGING', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Bursa', district: 'Osmangazi', contactName: 'Caner Tuna', phonePrefix: '0224', leadTimeDays: 4, paymentTermDays: 30, minimumOrderAmount: 15000, notes: 'Vakum poşeti, koli, gıda filmi ve paketleme sarfları.' },
  { name: 'Eko Sarf Market', tradeName: 'Eko Sarf Malzeme Ltd.', type: 'CONSUMABLE', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Ankara', district: 'Sincan', contactName: 'Merve Özkan', phonePrefix: '0312', leadTimeDays: 2, paymentTermDays: 14, minimumOrderAmount: 7000, notes: 'Bone, eldiven, maske ve tek kullanımlık operasyon sarfları.' },
  { name: 'Hızlı Soğuk Nakliye', tradeName: 'Hızlı Soğuk Nakliye Ltd.', type: 'LOGISTICS', companyType: 'LOCAL_SUPPLIER', status: 'SUSPENDED', approvalStatus: 'REJECTED', workingStatus: 'ON_HOLD', city: 'İstanbul', district: 'Sultanbeyli', contactName: 'Fatih Güneş', phonePrefix: '0216', leadTimeDays: 1, paymentTermDays: 15, minimumOrderAmount: 10000, notes: 'Araç sıcaklık sapmaları nedeniyle askıya alınmış lojistik tedarikçi.' },
  { name: 'Anka Etiket', tradeName: 'Anka Etiket ve Baskı', type: 'PACKAGING', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Kağıthane', contactName: 'Nazlı Tetik', phonePrefix: '0212', leadTimeDays: 3, paymentTermDays: 30, minimumOrderAmount: 6000, notes: 'Ürün etiketi, SKT etiketi ve baskılı ambalaj.' },
  { name: 'Kuzey Donuk Gıda', tradeName: 'Kuzey Donuk Gıda A.Ş.', type: 'RAW_MATERIAL', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'LIMITED', city: 'Samsun', district: 'Atakum', contactName: 'Eren Şimşek', phonePrefix: '0362', leadTimeDays: 4, paymentTermDays: 21, minimumOrderAmount: 24000, notes: 'Donuk sebze, donuk meyve ve hazır ara ürün tedariği.' },
  { name: 'Güven Baharat', tradeName: 'Güven Baharat Sanayi', type: 'RAW_MATERIAL', companyType: 'WHOLESALER', status: 'PASSIVE', approvalStatus: 'PENDING', workingStatus: 'STOPPED', city: 'İstanbul', district: 'Fatih', contactName: 'Ali Güven', phonePrefix: '0212', leadTimeDays: 2, paymentTermDays: 7, minimumOrderAmount: 4000, notes: 'Alternatif baharat tedarikçisi; pasif çalışma durumunda.' },
  { name: 'Pratik Servis Hizmetleri', tradeName: 'Pratik Servis ve Danışmanlık', type: 'SERVICE', companyType: 'LOCAL_SUPPLIER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'İstanbul', district: 'Ataşehir', contactName: 'Defne Yalçın', phonePrefix: '0216', leadTimeDays: 2, paymentTermDays: 30, minimumOrderAmount: 9000, notes: 'Personel eğitim, hijyen danışmanlığı ve saha destek hizmetleri.' },
  { name: 'Öz Çelik Raf', tradeName: 'Öz Çelik Raf Sistemleri', type: 'MACHINE', companyType: 'MANUFACTURER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Kayseri', district: 'Melikgazi', contactName: 'Serkan Çelik', phonePrefix: '0352', leadTimeDays: 10, paymentTermDays: 45, minimumOrderAmount: 45000, notes: 'Depo rafı, paslanmaz ekipman ve taşıma arabaları.' },
  { name: 'Kare Kalibrasyon', tradeName: 'Kare Kalibrasyon Hizmetleri', type: 'SERVICE', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Ankara', district: 'Çankaya', contactName: 'Barış Ekinci', phonePrefix: '0312', leadTimeDays: 7, paymentTermDays: 30, minimumOrderAmount: 12000, notes: 'Termometre, tartı ve ölçüm cihazı kalibrasyonu.' },
  { name: 'Yıldız Plastik', tradeName: 'Yıldız Plastik Ambalaj', type: 'PACKAGING', companyType: 'MANUFACTURER', status: 'PENDING_APPROVAL', approvalStatus: 'PENDING', workingStatus: 'ON_HOLD', city: 'Adana', district: 'Seyhan', contactName: 'Pelin Yıldız', phonePrefix: '0322', leadTimeDays: 6, paymentTermDays: 30, minimumOrderAmount: 13000, notes: 'Yeni ambalaj tedarikçisi; numune onayı bekliyor.' },
  { name: 'Tuna Bakım Parça', tradeName: 'Tuna Bakım ve Yedek Parça', type: 'MAINTENANCE', companyType: 'DISTRIBUTOR', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'LIMITED', city: 'İzmir', district: 'Gaziemir', contactName: 'Onur Tuna', phonePrefix: '0232', leadTimeDays: 3, paymentTermDays: 30, minimumOrderAmount: 8500, notes: 'Makine yedek parça ve teknik servis desteği.' },
  { name: 'Delta Genel Tedarik', tradeName: 'Delta Genel Tedarik A.Ş.', type: 'OTHER', companyType: 'WHOLESALER', status: 'ACTIVE', approvalStatus: 'APPROVED', workingStatus: 'ACTIVE_WORKING', city: 'Eskişehir', district: 'Odunpazarı', contactName: 'Sibel Arı', phonePrefix: '0222', leadTimeDays: 3, paymentTermDays: 21, minimumOrderAmount: 11000, notes: 'Çeşitli operasyonel ihtiyaçlar için genel tedarikçi.' }
]

const createSupplierFromSeed = (seed: SupplierSeed, index: number): Supplier => {
  const supplierCode = createSupplierCode(index)
  const numericCode = supplierCode.replace(/\D/g, '').padStart(8, '0')
  const createdAt = `2026-07-${String(5 + (index % 20)).padStart(2, '0')}T${String(8 + (index % 8)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00.000Z`
  const type = seed.type

  return {
    id: `supplier_${String(index + 1).padStart(3, '0')}`,
    supplierCode,
    code: supplierCode,
    name: seed.name,
    tradeName: seed.tradeName,
    taxOffice: `${seed.city} Vergi Dairesi`,
    taxNumber: `TR${numericCode}`,
    companyType: seed.companyType,
    type,
    categoryIds: [getCategoryIdByType(type)],
    status: seed.status,
    approvalStatus: seed.approvalStatus,
    workingStatus: seed.workingStatus,
    defaultCurrency: DEFAULT_CURRENCY,
    paymentTermDays: seed.paymentTermDays,
    leadTimeDays: seed.leadTimeDays,
    minimumOrderAmount: seed.minimumOrderAmount,
    currentAccountCode: `CAR-${numericCode.slice(-5)}`,
    contactName: seed.contactName,
    contactPhone: `${seed.phonePrefix} 555 ${String(10 + index).padStart(2, '0')} ${String(index + 1).padStart(2, '0')}`,
    mobilePhone: `05${String(30 + (index % 50)).padStart(2, '0')} 555 ${String(20 + index).padStart(2, '0')} ${String(index + 11).padStart(2, '0')}`,
    contactEmail: `${slug(seed.contactName)}@${slug(seed.name)}.com`,
    website: `https://www.${slug(seed.name)}.com`,
    address: `${seed.city} ${seed.district} Organize Gıda Bölgesi No: ${index + 12}`,
    city: seed.city,
    district: seed.district,
    postalCode: String(34000 + index * 13).slice(0, 5),
    country: DEFAULT_COUNTRY,
    notes: seed.notes,
    createdAt,
    updatedAt: createdAt
  }
}

export const createSupplierManagementMockData = (): Supplier[] => (
  supplierSeeds.map(createSupplierFromSeed)
)

const normalizeSupplier = (item: RawSupplierRecord, index: number): Supplier => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const supplierCode = normalizeText(item.supplierCode || item.code) || createSupplierCode(index)
  const name = normalizeText(item.name || item.companyName || item.tradeName) || `Tedarikçi ${index + 1}`
  const type = normalizeSupplierType(item.type || item.supplierType)
  const status = normalizeStatus(item.status ?? item.isActive)
  const approvalStatus = normalizeApprovalStatus(item.approvalStatus ?? item.approved, status)
  const workingStatus = normalizeWorkingStatus(item.workingStatus, status)

  return {
    id: normalizeText(item.id) || `supplier_${Date.now()}_${index}`,
    supplierCode,
    code: supplierCode,
    name,
    tradeName: normalizeText(item.tradeName),
    taxOffice: normalizeText(item.taxOffice),
    taxNumber: normalizeText(item.taxNumber),
    companyType: normalizeCompanyType(item.companyType || item.companyKind),
    type,
    categoryIds: normalizeCategoryIds(item.categoryIds || item.categoryId, type),
    status,
    approvalStatus,
    workingStatus,
    defaultCurrency: normalizeCurrency(item.defaultCurrency),
    paymentTermDays: normalizeNonNegativeNumber(item.paymentTermDays),
    leadTimeDays: normalizeNonNegativeNumber(item.leadTimeDays),
    minimumOrderAmount: normalizeNonNegativeNumber(item.minimumOrderAmount),
    currentAccountCode: normalizeText(item.currentAccountCode || item.currentCode),
    contactName: normalizeText(item.contactName || item.authorizedPerson),
    contactPhone: normalizeText(item.contactPhone || item.phone),
    mobilePhone: normalizeText(item.mobilePhone || item.gsm || item.cellPhone),
    contactEmail: normalizeText(item.contactEmail || item.email),
    website: normalizeText(item.website),
    address: normalizeText(item.address),
    city: normalizeText(item.city),
    district: normalizeText(item.district || item.town),
    postalCode: normalizeText(item.postalCode || item.zipCode),
    country: normalizeText(item.country) || DEFAULT_COUNTRY,
    notes: normalizeText(item.notes || item.note),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

const mergeSeedRecords = (records: Supplier[], seedRecords: Supplier[]) => {
  const mergedById = new Map<string, Supplier>()
  const recordsByCode = new Map(records.map(record => [record.supplierCode, record]))

  seedRecords.forEach(seed => {
    const existing = records.find(record => record.id === seed.id) || recordsByCode.get(seed.supplierCode)
    mergedById.set(seed.id, existing ? {
      ...seed,
      ...existing,
      code: existing.supplierCode,
      type: existing.type || seed.type,
      categoryIds: existing.categoryIds?.length ? existing.categoryIds : seed.categoryIds,
      workingStatus: existing.workingStatus || seed.workingStatus,
      mobilePhone: existing.mobilePhone || seed.mobilePhone,
      district: existing.district || seed.district,
      postalCode: existing.postalCode || seed.postalCode,
      currentAccountCode: existing.currentAccountCode || seed.currentAccountCode
    } : seed)
  })

  records.forEach(record => {
    if(mergedById.has(record.id)) return
    mergedById.set(record.id, record)
  })

  return Array.from(mergedById.values())
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
      const migratedRecords = mergeSeedRecords(normalizedRecords, seedRecords)

      saveSupplierManagementRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    saveSupplierManagementRecords(seedRecords)
    return seedRecords
  }

  saveSupplierManagementRecords(seedRecords)
  return seedRecords
}
