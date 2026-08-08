import type { SupplierProduct } from '../supplier-management/supplier-management.types'
import type { StockItem } from '../types'
import type {
  ApprovedAlternativeMaterial,
  ApprovedAlternativeMaterialApprovalStatus,
  ApprovedAlternativeMaterialContext,
  ApprovedAlternativeMaterialFilters,
  ApprovedAlternativeMaterialView
} from './approved-alternative-material.types'

export const APPROVED_ALTERNATIVE_MATERIAL_STORAGE_KEY = 'ra_approved_alternative_materials'
export const APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_MATERIAL_COUNT = 80
export const APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_ALTERNATIVE_COUNT = 240
export const APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_SUPPLIER_COUNT = 20
export const APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_MAPPING_COUNT = 400

export const APPROVED_ALTERNATIVE_MATERIAL_STATUSES: ApprovedAlternativeMaterialApprovalStatus[] = [
  'APPROVED',
  'PENDING',
  'REJECTED'
]

export const APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS: Record<ApprovedAlternativeMaterialApprovalStatus, string> = {
  APPROVED: 'Onaylı',
  PENDING: 'Onay Bekliyor',
  REJECTED: 'Reddedildi'
}

const QUALITY_APPROVERS = [
  'Kalite Güvence Müdürü',
  'HACCP Sorumlusu',
  'Mal Kabul Kalite Uzmanı',
  'Gıda Güvenliği Lideri',
  'Merkez Kalite Ekibi'
]

const REASON_OPTIONS = [
  'Tedarik sürekliliği için kalite tarafından eşdeğer kabul edildi.',
  'Aynı proses toleransı ve HACCP uygunluğu ile manuel kullanım adayı.',
  'Alerjen ve kalite kontrol şartları sağlandığında muadil olarak izlenebilir.',
  'Maliyet ve tedarik riski durumunda satın alma değerlendirmesine alınabilir.',
  'Lot bazlı kalite sonucu uygun olduğunda reçete sahibi tarafından değerlendirilebilir.'
]

const MATERIAL_CATALOG = [
  'Dana Kuşbaşı', 'Dana Kıyma', 'Tavuk But', 'Tavuk Göğüs', 'Hindi Eti',
  'Baldo Pirinç', 'Osmancık Pirinç', 'Pilavlık Bulgur', 'Kırmızı Mercimek', 'Nohut',
  'Endüstriyel Un', 'Mısır Unu', 'Galeta Unu', 'Pizza Hamuru', 'Lazanya Yaprağı',
  'Pastörize Süt', 'Süzme Yoğurt', 'Tereyağı', 'Krema', 'Mozzarella',
  'Kaşar Peyniri', 'Yumurta', 'Pastörize Yumurta', 'Ayçiçek Yağı', 'Zeytinyağı',
  'Kanola Yağı', 'Domates Salçası', 'Domates Püresi', 'Domates Sosu', 'Biber Salçası',
  'Kuru Soğan', 'Sarımsak', 'Patates', 'Havuç', 'Kapya Biber',
  'Yeşil Biber', 'Marul', 'Beyaz Lahana', 'Kırmızı Lahana', 'Konserve Mısır',
  'Dondurulmuş Bezelye', 'Mantar', 'Maydanoz', 'Fesleğen', 'Nane',
  'Kekik', 'Kimyon', 'Karabiber', 'Pul Biber', 'Toz Biber',
  'Tuz', 'Toz Şeker', 'Esmer Şeker', 'Vanilin', 'Tarçın',
  'Mayonez', 'Hardal', 'Ketçap', 'Nar Ekşisi', 'Limon Suyu',
  'Et Suyu', 'Tavuk Suyu', 'Sebze Suyu', 'Sandviç Ekmeği', 'Brioche Ekmeği',
  'Tam Buğday Ekmeği', 'Vakum Poşeti', 'Sıcak Yemek Kabı', 'Alüminyum Kap', 'Streç Film',
  'Koli', 'SKT Etiketi', 'Gıda Etiketi', 'Bone', 'Eldiven',
  'Dezenfektan', 'Endüstriyel Deterjan', 'Kağıt Havlu', 'Soğuk Zincir Jel', 'Termal Kutu'
]

const ALTERNATIVE_CATALOG = [
  'Dana Alternatif Kesim', 'Dana Kontrollü Lot', 'Hindi Kıyma', 'Tavuk But Alternatif Lot',
  'Tavuk Göğüs Premium', 'Hindi Füme', 'Baldo Pirinç Alternatif Tedarikçi', 'Osmancık Pirinç Premium',
  'Kırık Pirinç Kontrollü', 'Pilavlık Bulgur B', 'İnce Bulgur Kontrollü', 'Kinoa Karışımı',
  'Kırmızı Mercimek B', 'Yeşil Mercimek Kontrollü', 'Nohut Premium', 'Haşlanmış Nohut Endüstriyel',
  'Yüksek Proteinli Un', 'Endüstriyel Un B', 'Glutensiz Un Karışımı', 'Galeta Unu B',
  'Pizza Hamuru B', 'Lazanya Yaprağı Premium', 'Pastörize Süt B', 'Laktozsuz Süt',
  'UHT Süt', 'Endüstriyel Yoğurt B', 'Laktozsuz Yoğurt', 'Tereyağı B',
  'Sade Yağ', 'Bitkisel Margarin Kontrollü', 'Krema B', 'Bitkisel Krema',
  'Mozzarella B', 'Mozzarella C', 'Kaşar Peyniri Premium', 'Dil Peyniri',
  'Pastörize Yumurta B', 'Yumurta Tozu Kontrollü', 'Ayçiçek Yağı B', 'Kanola Yağı',
  'Riviera Zeytinyağı', 'Zeytinyağı Kontrollü', 'Domates Salçası B', 'Biber Salçası Kontrollü',
  'Domates Püresi Konsantre', 'Domates Sosu B', 'Kuru Soğan B', 'Dondurulmuş Soğan',
  'Soğan Tozu Kontrollü', 'Sarımsak Püresi', 'Sarımsak Tozu Kontrollü', 'Patates B',
  'Dondurulmuş Patates', 'Patates Püresi Flake', 'Havuç B', 'Dondurulmuş Havuç',
  'Küp Havuç Kontrollü', 'Dondurulmuş Biber', 'Yeşil Biber Kontrollü', 'Atom Marul',
  'Mevsim Yeşilliği', 'Beyaz Lahana B', 'Kırmızı Lahana B', 'Karışık Salata Bazı',
  'Dondurulmuş Mısır', 'Tatlı Mısır Kontrollü', 'Dondurulmuş Bezelye B', 'Mantar Dilimli',
  'Maydanoz B', 'Kuru Fesleğen', 'Kuru Nane Premium', 'Akdeniz Baharat Karışımı',
  'Kimyon B', 'Köfte Baharatı Kontrollü', 'Karabiber B', 'Beyaz Biber',
  'Pul Biber B', 'Toz Biber B', 'İyotlu Tuz B', 'Deniz Tuzu',
  'Pancar Şekeri', 'Esmer Şeker Kontrollü', 'Vanilya Aroma', 'Doğal Vanilya Kontrollü',
  'Çubuk Tarçın Öğütülmüş', 'Tatlı Baharat Karışımı', 'Mayonez B', 'Light Mayonez',
  'Yoğurt Bazlı Sos', 'Hardal B', 'Ketçap B', 'Nar Ekşisi B',
  'Limon Konsantresi', 'Et Suyu Konsantre', 'Tavuk Suyu Konsantre', 'Sebze Suyu Konsantre',
  'Sandviç Ekmeği B', 'Tam Buğday Ekmeği B', 'Brioche Ekmeği Kontrollü', 'Vakum Poşeti B',
  'Sıcak Yemek Kabı B', 'Alüminyum Kap B', 'Gıda Streç Film B', 'Koli B',
  'SKT Etiketi B', 'Gıda Etiketi B', 'Bone B', 'Nitril Eldiven',
  'Dezenfektan B', 'Deterjan B', 'Kağıt Havlu B', 'Soğuk Zincir Jel B',
  'Termal Kutu B'
]

const SYNTHETIC_SUPPLIERS = [
  'Anadolu Et Tedarik', 'Beyaz Kanat Gıda', 'Marmara Süt Ürünleri', 'Doğu Baharat',
  'Metro Gıda Toptan', 'İpek Bakliyat', 'Akdeniz Zeytinyağı', 'Kuzey Donuk Gıda',
  'Paket Ambalaj', 'Nova Paketleme', 'Yeşilova Sebze', 'Ege Meyve Hal',
  'Trakya Yumurta', 'Karadeniz Balık', 'Hijyen Pro Temizlik', 'Anka Etiket',
  'Eko Sarf Market', 'Delta Genel Tedarik', 'Kare Kalibrasyon', 'Lotus Soğuk Lojistik'
]

type MaterialCatalogRecord = {
  id: string
  code: string
  name: string
  unit: string
  price: number
  stockItem?: StockItem
}

type SupplierCatalogRecord = {
  id: string
  name: string
  currency: string
}

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const slugify = (value: string) => normalizeSearchText(value)
  .replace(/[^a-z0-9]+/gi, '_')
  .replace(/^_+|_+$/g, '')

const normalizeNumber = (
  value: unknown,
  fallback = 0
) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const normalizePositiveInteger = (
  value: unknown,
  fallback = 1
) => {
  const numericValue = Math.round(normalizeNumber(value, fallback))
  return numericValue > 0 ? numericValue : fallback
}

const normalizeDate = (
  value: unknown,
  fallback: string
) => {
  const text = normalizeText(value)
  if(!text) return fallback
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

const normalizeApprovalStatus = (value: unknown): ApprovedAlternativeMaterialApprovalStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(normalized === 'ONAYLI' || normalized === 'APPROVED') return 'APPROVED'
  if(normalized === 'REDDEDILDI' || normalized === 'REDDEDİLDİ' || normalized === 'REJECTED') return 'REJECTED'
  if(normalized === 'PENDING' || normalized === 'WAITING' || normalized === 'IN_REVIEW') return 'PENDING'
  return APPROVED_ALTERNATIVE_MATERIAL_STATUSES.includes(normalized as ApprovedAlternativeMaterialApprovalStatus)
    ? normalized as ApprovedAlternativeMaterialApprovalStatus
    : 'PENDING'
}

const normalizeBoolean = (
  value: unknown,
  fallback = true
) => {
  if(typeof value === 'boolean') return value
  if(value === 'false' || value === '0') return false
  if(value === 'true' || value === '1') return true
  return fallback
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(dateValue)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const formatCode = (
  prefix: string,
  index: number
) => `${prefix}-${String(index + 1).padStart(4, '0')}`

const getMaterialPrice = (
  name: string,
  index: number
) => {
  const lower = normalizeSearchText(name)
  if(lower.includes('dana')) return 420 + (index % 8) * 18
  if(lower.includes('tavuk') || lower.includes('hindi')) return 145 + (index % 7) * 10
  if(lower.includes('sut') || lower.includes('peynir') || lower.includes('krema') || lower.includes('yogurt')) return 58 + (index % 9) * 8
  if(lower.includes('yag')) return 92 + (index % 8) * 9
  if(lower.includes('ambalaj') || lower.includes('koli') || lower.includes('etiket') || lower.includes('poset')) return 1.8 + (index % 10) * 0.35
  if(lower.includes('dezenfektan') || lower.includes('deterjan')) return 74 + (index % 6) * 7
  return 22 + (index % 18) * 4.5
}

const getUnitForMaterial = (name: string) => {
  const lower = normalizeSearchText(name)
  if(lower.includes('sut') || lower.includes('krema') || lower.includes('limon') || lower.includes('suyu') || lower.includes('dezenfektan') || lower.includes('deterjan')) return 'lt'
  if(lower.includes('etiket') || lower.includes('bone') || lower.includes('eldiven') || lower.includes('kap') || lower.includes('koli') || lower.includes('kutu')) return 'adet'
  return 'kg'
}

const buildMaterialCatalog = (
  stockItems: StockItem[],
  minimumCount: number,
  prefix: string,
  names: string[]
): MaterialCatalogRecord[] => {
  const bySearch = new Map<string, MaterialCatalogRecord>()
  const addRecord = (record: MaterialCatalogRecord) => {
    const searchKey = normalizeSearchText(record.name)
    if(bySearch.has(searchKey)) return
    bySearch.set(searchKey, record)
  }

  stockItems.forEach((item, index) => {
    addRecord({
      id: item.id,
      code: item.sku || formatCode(prefix, index),
      name: item.name,
      unit: item.unit,
      price: item.lastPurchasePrice || item.unitPurchasePrice || item.averageCost || getMaterialPrice(item.name, index),
      stockItem: item
    })
  })

  names.forEach((name, index) => {
    addRecord({
      id: `${prefix.toLocaleLowerCase('tr-TR')}_${slugify(name)}_${String(index + 1).padStart(3, '0')}`,
      code: formatCode(prefix, index),
      name,
      unit: getUnitForMaterial(name),
      price: getMaterialPrice(name, index)
    })
  })

  const records = Array.from(bySearch.values())
  let index = 0
  while(records.length < minimumCount){
    const name = `${prefix} Endüstriyel Hammadde ${records.length + 1}`
    records.push({
      id: `${prefix.toLocaleLowerCase('tr-TR')}_synthetic_${String(records.length + 1).padStart(3, '0')}`,
      code: formatCode(prefix, records.length),
      name,
      unit: getUnitForMaterial(name),
      price: getMaterialPrice(name, index)
    })
    index += 1
  }

  return records
}

const buildSupplierCatalog = (
  suppliers: ApprovedAlternativeMaterialContext['suppliers']
): SupplierCatalogRecord[] => {
  const eligibleSuppliers = suppliers
    .filter(supplier => (
      (!supplier.status || supplier.status === 'ACTIVE')
      && (!supplier.approvalStatus || supplier.approvalStatus === 'APPROVED')
      && supplier.workingStatus !== 'STOPPED'
      && supplier.workingStatus !== 'ON_HOLD'
    ))
    .map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      currency: supplier.defaultCurrency || 'TRY'
    }))

  const byName = new Map(eligibleSuppliers.map(supplier => [normalizeSearchText(supplier.name), supplier]))
  SYNTHETIC_SUPPLIERS.forEach((name, index) => {
    const key = normalizeSearchText(name)
    if(byName.has(key)) return
    byName.set(key, {
      id: `approved_supplier_seed_${String(index + 1).padStart(3, '0')}`,
      name,
      currency: 'TRY'
    })
  })

  const records = Array.from(byName.values())
  let index = 0
  while(records.length < APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_SUPPLIER_COUNT){
    records.push({
      id: `approved_supplier_seed_extra_${String(index + 1).padStart(3, '0')}`,
      name: `Onaylı Tedarikçi ${index + 1}`,
      currency: 'TRY'
    })
    index += 1
  }

  return records
}

const findSupplierProduct = (
  supplierProducts: SupplierProduct[],
  materialId: string,
  supplierId: string
) => supplierProducts.find(product => (
  product.stockItemId === materialId
  && product.supplierId === supplierId
  && product.status === 'ACTIVE'
))
  || supplierProducts.find(product => product.stockItemId === materialId && product.status === 'ACTIVE')

const createApprovedAlternativeRecord = (
  material: MaterialCatalogRecord,
  alternative: MaterialCatalogRecord,
  supplier: SupplierCatalogRecord,
  supplierProduct: SupplierProduct | undefined,
  index: number
): ApprovedAlternativeMaterial => {
  const createdAt = new Date(Date.UTC(2026, 5 + (index % 2), 1 + (index % 28), 8 + (index % 9), (index * 7) % 60)).toISOString()
  const approvalStatus: ApprovedAlternativeMaterialApprovalStatus = index % 13 === 0
    ? 'REJECTED'
    : index % 7 === 0
      ? 'PENDING'
      : 'APPROVED'
  const isActive = index % 17 !== 0
  const expireDate = index % 19 === 0
    ? addDays(createdAt, 20)
    : addDays(createdAt, 240 + (index % 80))
  const averagePrice = supplierProduct?.defaultUnitPrice || roundMoney(alternative.price * (0.92 + (index % 9) * 0.025))
  const lastPrice = roundMoney(averagePrice * (0.96 + (index % 7) * 0.018))

  return {
    id: `approved_alt_${slugify(material.id)}_${slugify(alternative.id)}_${String(index + 1).padStart(4, '0')}`,
    materialId: material.id,
    alternativeMaterialId: alternative.id,
    approvalStatus,
    qualityApprovedBy: approvalStatus === 'APPROVED' ? QUALITY_APPROVERS[index % QUALITY_APPROVERS.length] : '',
    approvalDate: approvalStatus === 'APPROVED' ? createdAt : '',
    expireDate,
    reason: REASON_OPTIONS[index % REASON_OPTIONS.length],
    notes: approvalStatus === 'APPROVED'
      ? 'Kalite onaylı muadil olarak yalnızca manuel öneri ve değerlendirme amaçlı kullanılır.'
      : 'Kalite onayı tamamlanmadan satın alma veya reçete önerisi olarak kullanılamaz.',
    priority: (index % 5) + 1,
    preferredSupplierId: supplier.id,
    isActive,
    materialCode: material.code,
    materialName: material.name,
    alternativeMaterialCode: alternative.code,
    alternativeMaterialName: alternative.name,
    preferredSupplierName: supplier.name,
    averagePrice,
    lastPrice,
    lastPurchaseDate: addDays(createdAt, 12 + (index % 60))
  }
}

export const createApprovedAlternativeMaterialSeedData = (
  context: ApprovedAlternativeMaterialContext
): ApprovedAlternativeMaterial[] => {
  const stockItems = context.stockItems || []
  const supplierProducts = context.supplierProducts || []
  const materials = buildMaterialCatalog(
    stockItems,
    APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_MATERIAL_COUNT,
    'HM',
    MATERIAL_CATALOG
  )
  const alternatives = buildMaterialCatalog(
    stockItems,
    APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_ALTERNATIVE_COUNT,
    'MU',
    ALTERNATIVE_CATALOG
  )
  const suppliers = buildSupplierCatalog(context.suppliers || [])
  const records: ApprovedAlternativeMaterial[] = []
  const seenPairs = new Set<string>()

  let cursor = 0
  while(records.length < APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_MAPPING_COUNT){
    const material = materials[cursor % materials.length]
    const alternative = alternatives[(cursor * 7 + Math.floor(cursor / materials.length) + 3) % alternatives.length]
    cursor += 1

    if(!material || !alternative || material.id === alternative.id) continue
    const pairKey = `${material.id}__${alternative.id}`
    if(seenPairs.has(pairKey)) continue

    const supplier = suppliers[records.length % suppliers.length]
    const supplierProduct = findSupplierProduct(supplierProducts, alternative.id, supplier.id)
    seenPairs.add(pairKey)
    records.push(createApprovedAlternativeRecord(material, alternative, supplier, supplierProduct, records.length))
  }

  return records
}

const normalizeApprovedAlternativeMaterial = (
  value: Record<string, unknown>,
  index: number,
  context: ApprovedAlternativeMaterialContext
): ApprovedAlternativeMaterial => {
  const seedFallback = createApprovedAlternativeMaterialSeedData(context)[index % APPROVED_ALTERNATIVE_MATERIAL_SEED_MIN_MAPPING_COUNT]
  const materialId = normalizeText(value.materialId) || seedFallback?.materialId || ''
  const alternativeMaterialId = normalizeText(value.alternativeMaterialId) || seedFallback?.alternativeMaterialId || ''
  const preferredSupplierId = normalizeText(value.preferredSupplierId) || seedFallback?.preferredSupplierId || ''
  const approvalStatus = normalizeApprovalStatus(value.approvalStatus)
  const fallbackDate = seedFallback?.approvalDate || new Date().toISOString()

  return {
    id: normalizeText(value.id) || `approved_alt_${Date.now()}_${index}`,
    materialId,
    alternativeMaterialId,
    approvalStatus,
    qualityApprovedBy: normalizeText(value.qualityApprovedBy),
    approvalDate: approvalStatus === 'APPROVED' ? normalizeDate(value.approvalDate, fallbackDate) : normalizeText(value.approvalDate),
    expireDate: normalizeDate(value.expireDate, seedFallback?.expireDate || addDays(fallbackDate, 365)),
    reason: normalizeText(value.reason) || seedFallback?.reason || '',
    notes: normalizeText(value.notes) || seedFallback?.notes || '',
    priority: normalizePositiveInteger(value.priority, seedFallback?.priority || 1),
    preferredSupplierId,
    isActive: normalizeBoolean(value.isActive, seedFallback?.isActive ?? true),
    materialCode: normalizeText(value.materialCode) || seedFallback?.materialCode,
    materialName: normalizeText(value.materialName) || seedFallback?.materialName,
    alternativeMaterialCode: normalizeText(value.alternativeMaterialCode) || seedFallback?.alternativeMaterialCode,
    alternativeMaterialName: normalizeText(value.alternativeMaterialName) || seedFallback?.alternativeMaterialName,
    preferredSupplierName: normalizeText(value.preferredSupplierName) || seedFallback?.preferredSupplierName,
    averagePrice: normalizeNumber(value.averagePrice, seedFallback?.averagePrice || 0),
    lastPrice: normalizeNumber(value.lastPrice, seedFallback?.lastPrice || 0),
    lastPurchaseDate: normalizeDate(value.lastPurchaseDate, seedFallback?.lastPurchaseDate || fallbackDate)
  }
}

const dedupeByPair = (
  records: ApprovedAlternativeMaterial[]
) => {
  const byPair = new Map<string, ApprovedAlternativeMaterial>()
  records
    .sort((first, second) => first.priority - second.priority || first.id.localeCompare(second.id))
    .forEach(record => {
      const pairKey = `${record.materialId}__${record.alternativeMaterialId}`
      if(byPair.has(pairKey)) return
      byPair.set(pairKey, record)
    })
  return Array.from(byPair.values())
}

export const saveApprovedAlternativeMaterials = (
  records: ApprovedAlternativeMaterial[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(APPROVED_ALTERNATIVE_MATERIAL_STORAGE_KEY, JSON.stringify(dedupeByPair(records)))
}

export const loadApprovedAlternativeMaterials = (
  context: ApprovedAlternativeMaterialContext
): ApprovedAlternativeMaterial[] => {
  const seedRecords = createApprovedAlternativeMaterialSeedData(context)
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(APPROVED_ALTERNATIVE_MATERIAL_STORAGE_KEY)
  if(!storedRecords){
    saveApprovedAlternativeMaterials(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = dedupeByPair(parsed
        .filter(isRecord)
        .map((record, index) => normalizeApprovedAlternativeMaterial(record, index, context)))
      const existingPairs = new Set(normalizedRecords.map(record => `${record.materialId}__${record.alternativeMaterialId}`))
      const missingSeedRecords = seedRecords.filter(record => !existingPairs.has(`${record.materialId}__${record.alternativeMaterialId}`))
      const mergedRecords = dedupeByPair([...normalizedRecords, ...missingSeedRecords])

      saveApprovedAlternativeMaterials(mergedRecords)
      return mergedRecords
    }
  } catch {
    saveApprovedAlternativeMaterials(seedRecords)
    return seedRecords
  }

  saveApprovedAlternativeMaterials(seedRecords)
  return seedRecords
}

const buildStockItemMap = (
  stockItems: StockItem[]
) => new Map(stockItems.map(item => [item.id, item]))

const buildSupplierMap = (
  suppliers: ApprovedAlternativeMaterialContext['suppliers']
) => new Map(suppliers.map(supplier => [supplier.id, supplier]))

export const isApprovedAlternativeMaterialExpired = (
  record: Pick<ApprovedAlternativeMaterial, 'expireDate'>,
  now = new Date()
) => {
  const date = new Date(record.expireDate)
  if(Number.isNaN(date.getTime())) return true
  return date.getTime() < now.getTime()
}

export const isApprovedAlternativeMaterialUsable = (
  record: ApprovedAlternativeMaterial,
  now = new Date()
) => (
  record.isActive
  && record.approvalStatus === 'APPROVED'
  && !isApprovedAlternativeMaterialExpired(record, now)
)

export const getApprovedAlternativeMaterialUnusableReason = (
  record: ApprovedAlternativeMaterial,
  now = new Date()
) => {
  if(!record.isActive) return 'Pasif kayıt'
  if(record.approvalStatus !== 'APPROVED') return APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS[record.approvalStatus]
  if(isApprovedAlternativeMaterialExpired(record, now)) return 'Süresi dolmuş'
  return ''
}

export const enrichApprovedAlternativeMaterial = (
  record: ApprovedAlternativeMaterial,
  context: ApprovedAlternativeMaterialContext,
  now = new Date()
): ApprovedAlternativeMaterialView => {
  const stockItemMap = buildStockItemMap(context.stockItems || [])
  const supplierMap = buildSupplierMap(context.suppliers || [])
  const material = stockItemMap.get(record.materialId)
  const alternative = stockItemMap.get(record.alternativeMaterialId)
  const supplier = supplierMap.get(record.preferredSupplierId)
  const supplierProduct = findSupplierProduct(context.supplierProducts || [], record.alternativeMaterialId, record.preferredSupplierId)
  const averagePrice = supplierProduct?.defaultUnitPrice || record.averagePrice || alternative?.averageCost || alternative?.lastPurchasePrice || alternative?.unitPurchasePrice || 0
  const lastPrice = record.lastPrice || supplierProduct?.defaultUnitPrice || alternative?.lastPurchasePrice || averagePrice
  const expired = isApprovedAlternativeMaterialExpired(record, now)
  const usable = isApprovedAlternativeMaterialUsable(record, now)

  return {
    ...record,
    materialName: material?.name || record.materialName || record.materialId,
    materialCode: material?.sku || record.materialCode || record.materialId,
    alternativeMaterialName: alternative?.name || record.alternativeMaterialName || record.alternativeMaterialId,
    alternativeMaterialCode: alternative?.sku || record.alternativeMaterialCode || record.alternativeMaterialId,
    preferredSupplierName: supplier?.name || record.preferredSupplierName || 'Tedarikçi tanımlı değil',
    averagePrice: roundMoney(averagePrice),
    lastPrice: roundMoney(lastPrice),
    lastPurchaseDate: record.lastPurchaseDate || supplierProduct?.updatedAt || supplierProduct?.createdAt || '',
    currency: supplierProduct?.currency || supplier?.defaultCurrency || 'TRY',
    expired,
    usable,
    unusableReason: getApprovedAlternativeMaterialUnusableReason(record, now),
    supplierProduct
  }
}

export const buildApprovedAlternativeMaterialViews = (
  records: ApprovedAlternativeMaterial[],
  context: ApprovedAlternativeMaterialContext
) => records
  .map(record => enrichApprovedAlternativeMaterial(record, context))
  .sort((first, second) => (
    first.materialName.localeCompare(second.materialName, 'tr-TR')
    || first.priority - second.priority
    || first.alternativeMaterialName.localeCompare(second.alternativeMaterialName, 'tr-TR')
  ))

export const getApprovedAlternativesForMaterial = (
  materialId: string,
  records: ApprovedAlternativeMaterial[],
  context: ApprovedAlternativeMaterialContext,
  usableOnly = false
) => buildApprovedAlternativeMaterialViews(
  records.filter(record => record.materialId === materialId),
  context
).filter(record => !usableOnly || record.usable)

export const findApprovedAlternativesByMaterialName = (
  materialName: string,
  records: ApprovedAlternativeMaterial[],
  context: ApprovedAlternativeMaterialContext,
  usableOnly = true
) => {
  const search = normalizeSearchText(materialName)
  if(!search) return []

  return buildApprovedAlternativeMaterialViews(records, context)
    .filter(record => normalizeSearchText(record.materialName).includes(search) || search.includes(normalizeSearchText(record.materialName)))
    .filter(record => !usableOnly || record.usable)
}

export const filterApprovedAlternativeMaterialViews = (
  views: ApprovedAlternativeMaterialView[],
  filters: ApprovedAlternativeMaterialFilters
) => {
  const search = normalizeSearchText(filters.search)

  return views.filter(record => {
    const matchesMaterial = !filters.materialId || filters.materialId === 'all' || record.materialId === filters.materialId
    const matchesAlternative = !filters.alternativeMaterialId || filters.alternativeMaterialId === 'all' || record.alternativeMaterialId === filters.alternativeMaterialId
    const matchesStatus = !filters.approvalStatus || filters.approvalStatus === 'all' || record.approvalStatus === filters.approvalStatus
    const matchesActive = !filters.active
      || filters.active === 'all'
      || (filters.active === 'active' && record.isActive)
      || (filters.active === 'inactive' && !record.isActive)
    const matchesSupplier = !filters.supplierId || filters.supplierId === 'all' || record.preferredSupplierId === filters.supplierId
    const matchesSearch = !search || [
      record.materialName,
      record.materialCode,
      record.alternativeMaterialName,
      record.alternativeMaterialCode,
      record.preferredSupplierName,
      record.reason,
      record.notes
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesMaterial
      && matchesAlternative
      && matchesStatus
      && matchesActive
      && matchesSupplier
      && matchesSearch
  })
}

export const formatApprovedAlternativeMaterialDate = (
  value: string
) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export const formatApprovedAlternativeMaterialCurrency = (
  value: number,
  currency = 'TRY'
) => {
  const safeValue = Number.isFinite(value) ? value : 0
  try{
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeValue)
  } catch {
    return `${safeValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  }
}

export const getApprovedAlternativeMaterialRows = (
  records: ApprovedAlternativeMaterialView[]
) => records.map(record => [
  record.materialCode,
  record.materialName,
  record.alternativeMaterialCode,
  record.alternativeMaterialName,
  record.priority,
  APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS[record.approvalStatus],
  record.isActive ? 'Aktif' : 'Pasif',
  record.qualityApprovedBy || '-',
  formatApprovedAlternativeMaterialDate(record.approvalDate),
  formatApprovedAlternativeMaterialDate(record.expireDate),
  record.expired ? 'Süresi dolmuş' : 'Geçerli',
  record.usable ? 'Önerilebilir' : record.unusableReason,
  record.preferredSupplierName,
  formatApprovedAlternativeMaterialCurrency(record.averagePrice, record.currency),
  formatApprovedAlternativeMaterialCurrency(record.lastPrice, record.currency),
  formatApprovedAlternativeMaterialDate(record.lastPurchaseDate),
  record.reason,
  record.notes
])

export const APPROVED_ALTERNATIVE_MATERIAL_EXPORT_HEADERS = [
  'Ürün Kodu',
  'Ürün',
  'Muadil Kodu',
  'Muadil Ürün',
  'Öncelik',
  'Onay Durumu',
  'Aktiflik',
  'Kalite Onayı',
  'Onay Tarihi',
  'Son Kullanım Tarihi',
  'Geçerlilik',
  'Öneri Durumu',
  'Tedarikçi',
  'Ortalama Fiyat',
  'Son Fiyat',
  'Son Satın Alma Tarihi',
  'Sebep',
  'Notlar'
]

export const ApprovedAlternativeMaterialService = {
  approvalStatusLabels: APPROVED_ALTERNATIVE_MATERIAL_STATUS_LABELS,
  buildViews: buildApprovedAlternativeMaterialViews,
  createSeed: createApprovedAlternativeMaterialSeedData,
  enrich: enrichApprovedAlternativeMaterial,
  exportHeaders: APPROVED_ALTERNATIVE_MATERIAL_EXPORT_HEADERS,
  filterViews: filterApprovedAlternativeMaterialViews,
  findByMaterialName: findApprovedAlternativesByMaterialName,
  formatCurrency: formatApprovedAlternativeMaterialCurrency,
  formatDate: formatApprovedAlternativeMaterialDate,
  getRows: getApprovedAlternativeMaterialRows,
  getForMaterial: getApprovedAlternativesForMaterial,
  isExpired: isApprovedAlternativeMaterialExpired,
  isUsable: isApprovedAlternativeMaterialUsable,
  load: loadApprovedAlternativeMaterials,
  save: saveApprovedAlternativeMaterials,
  statuses: APPROVED_ALTERNATIVE_MATERIAL_STATUSES,
  unusableReason: getApprovedAlternativeMaterialUnusableReason
}
