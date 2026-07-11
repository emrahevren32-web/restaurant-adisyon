import type { Sector } from '../types'

export const SECTOR_ID_PREFIX = 'sector_'

export const SECTOR_CODES = {
  RESTAURANT: 'restaurant',
  CAFE: 'cafe',
  PATISSERIE: 'patisserie',
  INDUSTRIAL_KITCHEN: 'industrial-kitchen',
  HOTEL: 'hotel',
  HAIRDRESSER: 'hairdresser',
  BEAUTY_CENTER: 'beauty-center',
  FOOTBALL_FIELD: 'football-field',
  AUTO_SERVICE: 'auto-service',
  MARKET: 'market',
  CLINIC: 'clinic',
  VETERINARY: 'veterinary',
  GENERAL_BUSINESS: 'general-business'
} as const

export type SectorCode = typeof SECTOR_CODES[keyof typeof SECTOR_CODES]

export const DEFAULT_SECTOR_CODE = SECTOR_CODES.GENERAL_BUSINESS

export const FALLBACK_SECTOR_ICON = 'SC'
export const FALLBACK_SECTOR_SORT_ORDER = 999

export const createSectorId = (code: SectorCode | string) => (
  `${SECTOR_ID_PREFIX}${String(code).replace(/[^a-z0-9]+/gi, '_')}`
)

export const DEFAULT_SECTOR_ID = createSectorId(DEFAULT_SECTOR_CODE)

export const DEFAULT_SECTORS: Sector[] = [
  {
    id: createSectorId(SECTOR_CODES.RESTAURANT),
    code: SECTOR_CODES.RESTAURANT,
    name: 'Restaurant',
    description: 'Masa, sipariş, mutfak ve servis odaklı yiyecek içecek işletmeleri.',
    icon: 'RS',
    color: '#2563eb',
    isActive: true,
    sortOrder: 10
  },
  {
    id: createSectorId(SECTOR_CODES.CAFE),
    code: SECTOR_CODES.CAFE,
    name: 'Cafe',
    description: 'Kahve, içecek, hafif yiyecek ve hızlı servis odaklı işletmeler.',
    icon: 'CF',
    color: '#0891b2',
    isActive: true,
    sortOrder: 20
  },
  {
    id: createSectorId(SECTOR_CODES.PATISSERIE),
    code: SECTOR_CODES.PATISSERIE,
    name: 'Pastane',
    description: 'Pasta, tatlı, fırın ve üretim destekli satış işletmeleri.',
    icon: 'PS',
    color: '#db2777',
    isActive: true,
    sortOrder: 30
  },
  {
    id: createSectorId(SECTOR_CODES.INDUSTRIAL_KITCHEN),
    code: SECTOR_CODES.INDUSTRIAL_KITCHEN,
    name: 'Endüstriyel Mutfak',
    description: 'Toplu üretim, yemekhane ve merkezi mutfak operasyonları.',
    icon: 'EM',
    color: '#ea580c',
    isActive: true,
    sortOrder: 40
  },
  {
    id: createSectorId(SECTOR_CODES.HOTEL),
    code: SECTOR_CODES.HOTEL,
    name: 'Otel',
    description: 'Konaklama, yiyecek içecek ve çok bölümlü tesis işletmeleri.',
    icon: 'OT',
    color: '#7c3aed',
    isActive: true,
    sortOrder: 50
  },
  {
    id: createSectorId(SECTOR_CODES.HAIRDRESSER),
    code: SECTOR_CODES.HAIRDRESSER,
    name: 'Kuaför',
    description: 'Randevu, hizmet ve personel odaklı kuaför işletmeleri.',
    icon: 'KF',
    color: '#be123c',
    isActive: true,
    sortOrder: 60
  },
  {
    id: createSectorId(SECTOR_CODES.BEAUTY_CENTER),
    code: SECTOR_CODES.BEAUTY_CENTER,
    name: 'Güzellik Merkezi',
    description: 'Randevu, hizmet paketleri ve müşteri takip odaklı merkezler.',
    icon: 'GM',
    color: '#c026d3',
    isActive: true,
    sortOrder: 70
  },
  {
    id: createSectorId(SECTOR_CODES.FOOTBALL_FIELD),
    code: SECTOR_CODES.FOOTBALL_FIELD,
    name: 'Halı Saha',
    description: 'Rezervasyon, saha kullanımı ve tesis operasyonları.',
    icon: 'HS',
    color: '#16a34a',
    isActive: true,
    sortOrder: 80
  },
  {
    id: createSectorId(SECTOR_CODES.AUTO_SERVICE),
    code: SECTOR_CODES.AUTO_SERVICE,
    name: 'Oto Servis',
    description: 'Servis kabul, iş emri, parça ve araç takip operasyonları.',
    icon: 'OS',
    color: '#475569',
    isActive: true,
    sortOrder: 90
  },
  {
    id: createSectorId(SECTOR_CODES.MARKET),
    code: SECTOR_CODES.MARKET,
    name: 'Market',
    description: 'Perakende satış, stok ve kasa odaklı işletmeler.',
    icon: 'MK',
    color: '#65a30d',
    isActive: true,
    sortOrder: 100
  },
  {
    id: createSectorId(SECTOR_CODES.CLINIC),
    code: SECTOR_CODES.CLINIC,
    name: 'Klinik',
    description: 'Randevu, hasta ve hizmet takip odaklı sağlık işletmeleri.',
    icon: 'KL',
    color: '#0d9488',
    isActive: true,
    sortOrder: 110
  },
  {
    id: createSectorId(SECTOR_CODES.VETERINARY),
    code: SECTOR_CODES.VETERINARY,
    name: 'Veteriner',
    description: 'Muayene, hasta sahibi, hayvan kartı ve hizmet takip işletmeleri.',
    icon: 'VT',
    color: '#059669',
    isActive: true,
    sortOrder: 120
  },
  {
    id: DEFAULT_SECTOR_ID,
    code: DEFAULT_SECTOR_CODE,
    name: 'Genel İşletme',
    description: 'Sektörü henüz netleşmemiş veya genel operasyon yapısına sahip işletmeler.',
    icon: 'GI',
    color: '#64748b',
    isActive: true,
    sortOrder: FALLBACK_SECTOR_SORT_ORDER
  }
]

export const getDefaultSectors = (): Sector[] => DEFAULT_SECTORS.map(sector => ({ ...sector }))
