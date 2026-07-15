import {
  getBusinessWorkspaceModuleByCode
} from '../modules/business-workspace.registry'
import {
  SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES,
  getSectorTemplateAssignableModuleCodes,
  getSectorTemplateModuleMetadata,
  type SectorTemplateAssignableModuleCode
} from '../modules/module-code.registry'
import { getWorkspaceTemplates } from '../workspace-template/workspace-template.service'
import type {
  SectorManagementCatalogs,
  SectorManagementSector,
  SectorManagementStatus,
  SectorManagementTemplateOption
} from './sector-management.types'
import { SECTOR_MANAGEMENT_STATUSES } from './sector-management.types'

const STORAGE_KEY = 'miyop_sector_management_mock_repository'
const SYSTEM_USER = 'EVREN360'

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

export const createSectorManagementSlug = (value: string) => (
  String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'sector'
)

const createOption = (
  id: string,
  type: SectorManagementTemplateOption['type'],
  name: string,
  description: string
): SectorManagementTemplateOption => ({ id, type, name, description })

export const getSectorManagementCatalogs = (): SectorManagementCatalogs => {
  const workspaceTemplateOptions = getWorkspaceTemplates().map(template => createOption(
    template.id,
    'workspace',
    template.name,
    template.description
  ))

  const dashboardTemplates = [
    ...getWorkspaceTemplates().map(template => createOption(
      `dashboard_${template.id}`,
      'dashboard',
      template.dashboardTemplate.title,
      template.dashboardTemplate.description
    )),
    createOption('dashboard_hotel_operations', 'dashboard', 'Hotel Operations Dashboard', 'Konaklama, doluluk ve servis operasyonları için panel.'),
    createOption('dashboard_bar_service', 'dashboard', 'Bar Service Dashboard', 'Bar siparişleri, stok ve servis yoğunluğu için panel.'),
    createOption('dashboard_bakery_production', 'dashboard', 'Bakery Production Dashboard', 'Fırın üretimi, tezgah satışı ve stok için panel.')
  ]

  const widgetTemplates = [
    createOption('widget_restaurant_operations', 'widget', 'Restaurant Widget Pack', 'Masa, adisyon, QR ve ciro widget grubu.'),
    createOption('widget_cafe_counter', 'widget', 'Cafe Counter Pack', 'Kasa, hızlı satış ve içecek akışı widget grubu.'),
    createOption('widget_hotel_frontdesk', 'widget', 'Hotel Frontdesk Pack', 'Doluluk, oda servisi ve günlük gelir widget grubu.'),
    createOption('widget_industrial_kitchen', 'widget', 'Industrial Kitchen Pack', 'Üretim, stok, sevkiyat ve reçete widget grubu.'),
    createOption('widget_bakery_production', 'widget', 'Bakery Production Pack', 'Üretim, raf, fire ve günlük satış widget grubu.'),
    createOption('widget_general_empty', 'widget', 'General Empty Pack', 'Genel işletme başlangıç widget grubu.')
  ]

  const menuTemplates = [
    createOption('menu_restaurant', 'menu', 'Restaurant Menu Template', 'Adisyon, ürün, QR ve cari odaklı menü.'),
    createOption('menu_cafe', 'menu', 'Cafe Menu Template', 'Hızlı servis, ürün ve kasa odaklı menü.'),
    createOption('menu_hotel', 'menu', 'Hotel Menu Template', 'Ön büro, servis ve gelir ekranları için menü.'),
    createOption('menu_industrial_kitchen', 'menu', 'Industrial Kitchen Menu Template', 'Depo, stok, reçete ve üretim odaklı menü.'),
    createOption('menu_bakery', 'menu', 'Bakery Menu Template', 'Üretim, ürün, stok ve kasa odaklı menü.'),
    createOption('menu_general', 'menu', 'General Menu Template', 'Sadece çekirdek çalışma alanı menüsü.')
  ]

  const themeTemplates = [
    createOption('theme_miyop_default', 'theme', 'MIYOP Default Theme', 'Varsayılan MIYOP arayüz renkleri.'),
    createOption('theme_food_service', 'theme', 'Food Service Theme', 'Yiyecek içecek işletmeleri için canlı vurgu renkleri.'),
    createOption('theme_hospitality', 'theme', 'Hospitality Theme', 'Otel ve konaklama işletmeleri için sakin tema.'),
    createOption('theme_production', 'theme', 'Production Theme', 'Üretim ve depo odaklı işletmeler için operasyon teması.')
  ]

  const installationWizards = [
    createOption('wizard_business_setup_v2', 'installation', 'Business Setup Wizard v2', 'Sektör, şube, modül ve özet akışını kullanan wizard.'),
    createOption('wizard_restaurant_fast_start', 'installation', 'Restaurant Fast Start', 'Restaurant işletmeleri için kısaltılmış kurulum akışı.'),
    createOption('wizard_production_setup', 'installation', 'Production Setup', 'Üretim, stok ve depo ihtiyacı olan sektörler için akış.'),
    createOption('wizard_general_workspace', 'installation', 'General Workspace Setup', 'Sadece çekirdek çalışma alanı hazırlayan akış.')
  ]

  const moduleOptions = getSectorTemplateAssignableModuleCodes().map(code => {
    const registeredModule = getBusinessWorkspaceModuleByCode(code)
    const metadata = getSectorTemplateModuleMetadata(code)

    return {
      code,
      name: registeredModule?.name || metadata?.name || code,
      description: registeredModule?.description || metadata?.description || 'Mock sektör modülü.',
      icon: registeredModule?.icon || metadata?.icon || 'MD',
      registered: Boolean(registeredModule)
    }
  }).sort((first, second) => first.name.localeCompare(second.name, 'tr'))

  const widgetOptions = [
    createOption('open-tables', 'widget', 'Açık Masalar', 'Restaurant masa durumu widget alanı.'),
    createOption('active-bills', 'widget', 'Aktif Adisyonlar', 'Devam eden adisyon özetleri.'),
    createOption('daily-revenue', 'widget', 'Günlük Ciro', 'Günlük gelir ve tahsilat özeti.'),
    createOption('critical-stock', 'widget', 'Kritik Stoklar', 'Minimum seviyeye yaklaşan stoklar.'),
    createOption('production-today', 'widget', 'Bugünkü Üretim', 'Günün üretim iş akışı özeti.'),
    createOption('frontdesk-status', 'widget', 'Ön Büro Durumu', 'Konaklama operasyon durumu.'),
    createOption('welcome', 'widget', 'Hoş Geldiniz', 'Genel başlangıç bilgilendirmesi.')
  ]

  const menuOptions = [
    createOption('dashboard', 'menu', 'Kontrol Paneli', 'Dashboard açılış menüsü.'),
    createOption('products', 'menu', 'Ürünler', 'Ürün ve katalog ekranları.'),
    createOption('tables-management', 'menu', 'Masa Yönetimi', 'Adisyon ve masa operasyonu.'),
    createOption('stock-cards', 'menu', 'Stok Kartları', 'Stok yönetimi ekranları.'),
    createOption('recipes', 'menu', 'Reçeteler', 'Reçete ve üretim hazırlığı.'),
    createOption('current-accounts', 'menu', 'Cari Hesaplar', 'Müşteri ve tedarikçi cari ekranları.'),
    createOption('marketplace', 'menu', 'Modül Mağazası', 'Marketplace başlangıç ekranı.')
  ]

  const quickActionOptions = [
    createOption('add-widget', 'workspace', 'Widget Ekle', 'Kontrol paneline widget ekleme aksiyonu.'),
    createOption('module-store', 'workspace', 'Modül Mağazası', 'Modül keşif aksiyonu.'),
    createOption('workspace-settings', 'workspace', 'Çalışma Alanı', 'Çalışma alanı ayarlarına geçiş.'),
    createOption('create-product', 'workspace', 'Ürün Oluştur', 'İlk ürün kaydına yönlendirme.'),
    createOption('create-stock-card', 'workspace', 'Stok Kartı Oluştur', 'İlk stok kaydına yönlendirme.')
  ]

  const installationStepOptions = [
    createOption('default', 'installation', 'Varsayılan', 'Standart Business Setup v2 adımı.'),
    createOption('compact', 'installation', 'Kompakt', 'Daha kısa açıklamalı adım.'),
    createOption('guided', 'installation', 'Rehberli', 'Kullanıcıyı daha fazla yönlendiren adım.'),
    createOption('skip', 'installation', 'Atlanabilir', 'Zorunlu olmayan adım.')
  ]

  return {
    dashboardTemplates,
    workspaceTemplates: workspaceTemplateOptions,
    widgetTemplates,
    menuTemplates,
    themeTemplates,
    installationWizards,
    moduleOptions,
    widgetOptions,
    menuOptions,
    quickActionOptions,
    installationStepOptions
  }
}

const defaultTemplates = (slug: string) => {
  const catalogs = getSectorManagementCatalogs()
  const workspaceTemplate = catalogs.workspaceTemplates.find(template => template.id.includes(slug.replace(/-/g, '_')))
    || catalogs.workspaceTemplates[0]

  return {
    dashboardTemplateId: catalogs.dashboardTemplates.find(template => template.id.includes(slug.replace(/-/g, '_')))?.id || catalogs.dashboardTemplates[0]?.id || '',
    workspaceTemplateId: workspaceTemplate?.id || '',
    widgetTemplateId: catalogs.widgetTemplates.find(template => template.id.includes(slug.replace(/-/g, '_')))?.id || catalogs.widgetTemplates[0]?.id || '',
    menuTemplateId: catalogs.menuTemplates.find(template => template.id.includes(slug.replace(/-/g, '_')))?.id || catalogs.menuTemplates[0]?.id || '',
    themeTemplateId: catalogs.themeTemplates[0]?.id || '',
    installationWizardId: catalogs.installationWizards[0]?.id || ''
  }
}

const createSector = (input: {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  primaryColor: string
  secondaryColor: string
  status?: SectorManagementStatus
  ordering: number
  version?: string
  defaultModuleCodes?: SectorTemplateAssignableModuleCode[]
  optionalModuleCodes?: SectorTemplateAssignableModuleCode[]
  dashboardTemplateId?: string
  workspaceTemplateId?: string
  widgetTemplateId?: string
  menuTemplateId?: string
  themeTemplateId?: string
  installationWizardId?: string
  widgetIds?: string[]
  menuIds?: string[]
  quickActionIds?: string[]
  notes?: string
}, now: string): SectorManagementSector => {
  const templates = defaultTemplates(input.slug)

  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    icon: input.icon,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    status: input.status || SECTOR_MANAGEMENT_STATUSES.ACTIVE,
    version: input.version || '1.0.0',
    visible: true,
    ordering: input.ordering,
    templates: {
      ...templates,
      dashboardTemplateId: input.dashboardTemplateId || templates.dashboardTemplateId,
      workspaceTemplateId: input.workspaceTemplateId || templates.workspaceTemplateId,
      widgetTemplateId: input.widgetTemplateId || templates.widgetTemplateId,
      menuTemplateId: input.menuTemplateId || templates.menuTemplateId,
      themeTemplateId: input.themeTemplateId || templates.themeTemplateId,
      installationWizardId: input.installationWizardId || templates.installationWizardId
    },
    modules: {
      defaultModuleCodes: input.defaultModuleCodes || [],
      optionalModuleCodes: input.optionalModuleCodes || []
    },
    dashboard: {
      defaultWidgetIds: input.widgetIds || ['welcome'],
      widgetOrder: input.widgetIds || ['welcome'],
      widgetGroups: ['Operasyon', 'Finans', 'Başlangıç'],
      defaultLayout: 'standard'
    },
    workspace: {
      defaultMenuId: input.menuTemplateId || templates.menuTemplateId,
      defaultLandingPage: 'summary',
      pinnedScreens: (input.menuIds || ['dashboard']) as SectorManagementSector['workspace']['pinnedScreens'],
      quickActionIds: input.quickActionIds || ['add-widget', 'module-store']
    },
    theme: {
      primary: input.primaryColor,
      secondary: input.secondaryColor,
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      background: '#f8fafc',
      logo: '',
      loginBackground: ''
    },
    installation: {
      welcomeScreen: 'guided',
      businessInfoStep: 'default',
      recommendationStep: 'default',
      optionalModulesStep: 'default',
      summaryStep: 'default',
      onboardingFlow: 'guided'
    },
    metadata: {
      createdBy: SYSTEM_USER,
      createdAt: now,
      updatedBy: SYSTEM_USER,
      updatedAt: now,
      internalNotes: input.notes || 'Mock repository kaydı. Gerçek repository bağlantısı sonraki fazda eklenecek.'
    }
  }
}

const createSeedSectors = (): SectorManagementSector[] => {
  const now = new Date().toISOString()
  const moduleCodes = SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES

  return [
    createSector({
      id: 'managed_sector_restaurant',
      name: 'Restaurant',
      slug: 'restaurant',
      description: 'Masa, adisyon, QR menü ve cari odaklı yiyecek içecek sektörü.',
      icon: 'RS',
      primaryColor: '#2563eb',
      secondaryColor: '#0f766e',
      ordering: 10,
      defaultModuleCodes: [moduleCodes.PRODUCT, moduleCodes.ADISYON, moduleCodes.QR_MENU, moduleCodes.CURRENT],
      optionalModuleCodes: [moduleCodes.PERSONNEL, moduleCodes.CRM, moduleCodes.CAMPAIGN, moduleCodes.LOYALTY, moduleCodes.COURIER, moduleCodes.MULTI_BRANCH],
      widgetIds: ['open-tables', 'active-bills', 'daily-revenue'],
      menuIds: ['dashboard', 'tables-management', 'products', 'current-accounts']
    }, now),
    createSector({
      id: 'managed_sector_cafe',
      name: 'Cafe',
      slug: 'cafe',
      description: 'Kahve, hızlı servis, ürün ve kasa odaklı işletme sektörü.',
      icon: 'CF',
      primaryColor: '#0891b2',
      secondaryColor: '#65a30d',
      ordering: 20,
      defaultModuleCodes: [moduleCodes.PRODUCT, moduleCodes.ADISYON, moduleCodes.QR_MENU, moduleCodes.CURRENT],
      optionalModuleCodes: [moduleCodes.PERSONNEL, moduleCodes.CRM, moduleCodes.CAMPAIGN, moduleCodes.LOYALTY],
      widgetIds: ['active-bills', 'daily-revenue', 'welcome'],
      menuIds: ['dashboard', 'products', 'tables-management']
    }, now),
    createSector({
      id: 'managed_sector_hotel',
      name: 'Hotel',
      slug: 'hotel',
      description: 'Konaklama, ön büro, servis ve çoklu operasyon yapısı.',
      icon: 'HT',
      primaryColor: '#7c3aed',
      secondaryColor: '#0f766e',
      ordering: 30,
      defaultModuleCodes: [moduleCodes.PRODUCT, moduleCodes.CURRENT, moduleCodes.MULTI_BRANCH],
      optionalModuleCodes: [moduleCodes.PERSONNEL, moduleCodes.CRM, moduleCodes.CAMPAIGN, moduleCodes.LOYALTY],
      dashboardTemplateId: 'dashboard_hotel_operations',
      widgetTemplateId: 'widget_hotel_frontdesk',
      menuTemplateId: 'menu_hotel',
      themeTemplateId: 'theme_hospitality',
      widgetIds: ['frontdesk-status', 'daily-revenue', 'welcome'],
      menuIds: ['dashboard', 'current-accounts', 'marketplace']
    }, now),
    createSector({
      id: 'managed_sector_industrial_kitchen',
      name: 'Industrial Kitchen',
      slug: 'industrial-kitchen',
      description: 'Depo, stok, reçete, üretim ve satın alma odaklı mutfak operasyonu.',
      icon: 'IK',
      primaryColor: '#ea580c',
      secondaryColor: '#475569',
      ordering: 40,
      defaultModuleCodes: [moduleCodes.WAREHOUSE, moduleCodes.STOCK, moduleCodes.RECIPE, moduleCodes.PRODUCTION, moduleCodes.CURRENT, moduleCodes.PURCHASE],
      optionalModuleCodes: [moduleCodes.PERSONNEL, moduleCodes.CRM, moduleCodes.QUALITY, moduleCodes.MAINTENANCE, moduleCodes.MULTI_BRANCH],
      widgetIds: ['critical-stock', 'production-today', 'daily-revenue'],
      menuIds: ['dashboard', 'stock-cards', 'recipes', 'current-accounts'],
      themeTemplateId: 'theme_production'
    }, now),
    createSector({
      id: 'managed_sector_bar',
      name: 'Bar',
      slug: 'bar',
      description: 'Bar servis, stok, hızlı ürün ve kampanya odaklı işletme sektörü.',
      icon: 'BR',
      primaryColor: '#be123c',
      secondaryColor: '#7c2d12',
      ordering: 50,
      defaultModuleCodes: [moduleCodes.PRODUCT, moduleCodes.ADISYON, moduleCodes.STOCK, moduleCodes.CURRENT],
      optionalModuleCodes: [moduleCodes.CAMPAIGN, moduleCodes.LOYALTY, moduleCodes.PERSONNEL, moduleCodes.CRM],
      dashboardTemplateId: 'dashboard_bar_service',
      widgetIds: ['active-bills', 'critical-stock', 'daily-revenue'],
      menuIds: ['dashboard', 'products', 'stock-cards']
    }, now),
    createSector({
      id: 'managed_sector_bakery',
      name: 'Bakery',
      slug: 'bakery',
      description: 'Fırın, pastane üretimi, raf satışı ve stok takibi.',
      icon: 'BK',
      primaryColor: '#db2777',
      secondaryColor: '#d97706',
      ordering: 60,
      defaultModuleCodes: [moduleCodes.PRODUCT, moduleCodes.STOCK, moduleCodes.RECIPE, moduleCodes.PRODUCTION, moduleCodes.CURRENT],
      optionalModuleCodes: [moduleCodes.PERSONNEL, moduleCodes.CRM, moduleCodes.CAMPAIGN, moduleCodes.MULTI_BRANCH],
      dashboardTemplateId: 'dashboard_bakery_production',
      widgetTemplateId: 'widget_bakery_production',
      menuTemplateId: 'menu_bakery',
      widgetIds: ['production-today', 'critical-stock', 'daily-revenue'],
      menuIds: ['dashboard', 'products', 'stock-cards', 'recipes']
    }, now)
  ]
}

const normalizeSector = (sector: SectorManagementSector): SectorManagementSector => ({
  ...sector,
  slug: createSectorManagementSlug(sector.slug || sector.name),
  icon: String(sector.icon || 'SC').trim().slice(0, 3).toLocaleUpperCase('tr-TR') || 'SC',
  status: Object.values(SECTOR_MANAGEMENT_STATUSES).includes(sector.status)
    ? sector.status
    : SECTOR_MANAGEMENT_STATUSES.DRAFT,
  version: sector.version || '1.0.0',
  ordering: Number.isFinite(Number(sector.ordering)) ? Number(sector.ordering) : 999,
  modules: {
    defaultModuleCodes: Array.from(new Set(sector.modules.defaultModuleCodes)),
    optionalModuleCodes: Array.from(new Set(sector.modules.optionalModuleCodes))
      .filter(code => !sector.modules.defaultModuleCodes.includes(code))
  },
  dashboard: {
    ...sector.dashboard,
    widgetOrder: sector.dashboard.widgetOrder.length
      ? sector.dashboard.widgetOrder
      : sector.dashboard.defaultWidgetIds
  },
  metadata: {
    ...sector.metadata,
    internalNotes: sector.metadata.internalNotes || ''
  }
})

const readSectors = (): SectorManagementSector[] | null => {
  if(!isBrowser()) return null

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '')
    return Array.isArray(parsed) ? parsed.map(normalizeSector) : null
  } catch {
    return null
  }
}

const writeSectors = (sectors: SectorManagementSector[]) => {
  if(!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sectors.map(normalizeSector)))
}

export const loadSectorManagementSectors = (): SectorManagementSector[] => {
  const stored = readSectors()
  const sectors = stored || createSeedSectors()
  if(!stored) writeSectors(sectors)

  return sectors
    .map(normalizeSector)
    .sort((first, second) => first.ordering - second.ordering || first.name.localeCompare(second.name, 'tr'))
}

export const cloneSectorManagementSector = (sector: SectorManagementSector): SectorManagementSector => (
  JSON.parse(JSON.stringify(sector)) as SectorManagementSector
)

const createUniqueSlug = (name: string, sectors: SectorManagementSector[], currentId?: string) => {
  const baseSlug = createSectorManagementSlug(name)
  const existingSlugs = new Set(sectors.filter(sector => sector.id !== currentId).map(sector => sector.slug))
  let slug = baseSlug
  let index = 2

  while(existingSlugs.has(slug)){
    slug = `${baseSlug}-${index}`
    index += 1
  }

  return slug
}

export const createSectorManagementSector = (userName = SYSTEM_USER): SectorManagementSector => {
  const sectors = loadSectorManagementSectors()
  const now = new Date().toISOString()
  const slug = createUniqueSlug('New Sector', sectors)
  const sector = createSector({
    id: createId('managed_sector'),
    name: 'New Sector',
    slug,
    description: 'Yeni sektör konfigürasyonu.',
    icon: 'NS',
    primaryColor: '#2563eb',
    secondaryColor: '#0f766e',
    status: SECTOR_MANAGEMENT_STATUSES.DRAFT,
    ordering: Math.max(0, ...sectors.map(item => item.ordering)) + 10
  }, now)

  sector.metadata.createdBy = userName
  sector.metadata.updatedBy = userName
  writeSectors([sector, ...sectors])
  return cloneSectorManagementSector(sector)
}

export const saveSectorManagementSector = (
  sector: SectorManagementSector,
  userName = SYSTEM_USER
) => {
  const sectors = loadSectorManagementSectors()
  const now = new Date().toISOString()
  const normalized = normalizeSector({
    ...sector,
    slug: createUniqueSlug(sector.slug || sector.name, sectors, sector.id),
    metadata: {
      ...sector.metadata,
      updatedBy: userName,
      updatedAt: now
    }
  })
  const exists = sectors.some(item => item.id === normalized.id)
  const nextSectors = exists
    ? sectors.map(item => item.id === normalized.id ? normalized : item)
    : [normalized, ...sectors]

  writeSectors(nextSectors)
  return cloneSectorManagementSector(normalized)
}

export const updateSectorManagementStatus = (
  sectorId: string,
  status: SectorManagementStatus,
  userName = SYSTEM_USER
) => {
  const sector = loadSectorManagementSectors().find(item => item.id === sectorId)
  if(!sector) return null
  return saveSectorManagementSector({ ...sector, status }, userName)
}
