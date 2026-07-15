import {
  SECTOR_TEMPLATE_MODULE_CODES,
  WORKSPACE_MODULE_CODES,
  type ModuleCode
} from '../modules/module-code.registry'
import {
  DEFAULT_SECTOR_ID,
  SECTOR_CODES,
  createSectorId
} from '../sector/sector.registry'
import {
  WORKSPACE_TEMPLATE_ACTION_TYPES,
  WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS,
  type WorkspaceTemplate,
  type WorkspaceTemplateEmptyState,
  type WorkspaceTemplateMenuItem,
  type WorkspaceTemplateQuickAction,
  type WorkspaceTemplateWidget
} from './workspace-template.types'

type WidgetInput = Omit<
  WorkspaceTemplateWidget,
  'defaultVisible' | 'defaultSize' | 'supportedLayouts' | 'renderComponent' | 'emptyTitle' | 'emptyDescription'
> & Partial<Pick<
  WorkspaceTemplateWidget,
  'defaultVisible' | 'defaultSize' | 'supportedLayouts' | 'renderComponent' | 'emptyTitle' | 'emptyDescription'
>>

type WorkspaceTemplateInput = Omit<WorkspaceTemplate, 'id'>

const createWorkspaceTemplateId = (sectorId: string) => (
  `workspace_template_${sectorId.replace(/^sector_/, '').replace(/[^a-z0-9]+/gi, '_')}`
)

const uniqueById = <TItem extends { id: string }>(items: readonly TItem[]) => {
  const itemMap = new Map<string, TItem>()
  items.forEach(item => itemMap.set(item.id, item))
  return Array.from(itemMap.values()).sort((first, second) => (
    ('order' in first && 'order' in second ? Number(first.order) - Number(second.order) : 0)
    || first.id.localeCompare(second.id, 'tr')
  ))
}

const widget = (input: WidgetInput): WorkspaceTemplateWidget => ({
  defaultVisible: true,
  defaultSize: 'medium',
  supportedLayouts: ['standard', 'wide'],
  renderComponent: `workspaceTemplate.${input.id}.placeholder`,
  emptyTitle: 'Henüz canlı veri yok.',
  emptyDescription: 'Kurulum motoru tamamlandığında bu alan ilgili modül verileriyle dolacak.',
  ...input
})

const quickAction = (input: WorkspaceTemplateQuickAction): WorkspaceTemplateQuickAction => input
const menuItem = (input: WorkspaceTemplateMenuItem): WorkspaceTemplateMenuItem => input
const emptyState = (input: WorkspaceTemplateEmptyState): WorkspaceTemplateEmptyState => input

const createTemplate = (input: WorkspaceTemplateInput): WorkspaceTemplate => ({
  ...input,
  id: createWorkspaceTemplateId(input.sectorId),
  defaultWidgets: uniqueById(input.defaultWidgets),
  quickActions: uniqueById(input.quickActions),
  menuItems: uniqueById(input.menuItems),
  emptyStates: input.emptyStates
})

const createTemplateFromBase = (
  sectorId: string,
  baseTemplate: WorkspaceTemplate,
  overrides: Partial<Omit<WorkspaceTemplateInput, 'sectorId'>>
) => createTemplate({
  sectorId,
  name: overrides.name || baseTemplate.name,
  description: overrides.description || baseTemplate.description,
  defaultRoute: overrides.defaultRoute || baseTemplate.defaultRoute,
  defaultNavKey: overrides.defaultNavKey || baseTemplate.defaultNavKey,
  dashboardTemplate: overrides.dashboardTemplate || baseTemplate.dashboardTemplate,
  defaultWidgets: overrides.defaultWidgets || baseTemplate.defaultWidgets,
  quickActions: overrides.quickActions || baseTemplate.quickActions,
  menuItems: overrides.menuItems || baseTemplate.menuItems,
  emptyStates: overrides.emptyStates || baseTemplate.emptyStates
})

const dashboardQuickActions = (): WorkspaceTemplateQuickAction[] => [
  quickAction({
    id: 'add-widget',
    label: 'Widget Ekle',
    description: 'Kontrol paneline yeni bir özet alanı ekleyin.',
    icon: 'WE',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WIDGET_DRAWER,
    route: 'summary',
    navKey: 'dashboard',
    order: 10
  }),
  quickAction({
    id: 'module-store',
    label: 'Modül Mağazası',
    description: 'İşletmenize uygun modülleri keşfedin.',
    icon: 'MP',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE,
    route: 'marketplace',
    navKey: 'marketplace',
    order: 20
  }),
  quickAction({
    id: 'workspace-settings',
    label: 'Çalışma Alanı',
    description: 'Şube, profil ve temel ayarlarınızı düzenleyin.',
    icon: 'WS',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WORKSPACE_SETTINGS,
    route: 'settings',
    navKey: 'workspace',
    order: 30
  })
]

const baseCoreMenuItems = (): WorkspaceTemplateMenuItem[] => [
  menuItem({
    id: 'dashboard',
    label: 'Kontrol Paneli',
    icon: 'DB',
    route: 'summary',
    navKey: 'dashboard',
    order: 10
  }),
  menuItem({
    id: 'workspace',
    label: 'Çalışma Alanı',
    icon: 'WS',
    route: 'settings',
    navKey: 'workspace',
    order: 20
  }),
  menuItem({
    id: 'marketplace',
    label: 'Modül Mağazası',
    icon: 'MP',
    route: 'marketplace',
    navKey: 'marketplace',
    order: 30
  })
]

const baseEmptyStates = (
  dashboardTitle: string,
  dashboardDescription: string,
  menuDescription: string
): WorkspaceTemplateEmptyState[] => [
  emptyState({
    key: WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.DASHBOARD,
    title: dashboardTitle,
    description: dashboardDescription,
    icon: 'KP',
    actionLabel: 'Widget Ekle',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WIDGET_DRAWER,
    route: 'summary',
    navKey: 'dashboard'
  }),
  emptyState({
    key: WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.WIDGET_CATALOG,
    title: 'Widget kataloğu hazırlanıyor.',
    description: 'Sektörünüze uygun widget alanları kurulum motoru tamamlandığında genişleyecek.',
    icon: 'WG',
    actionLabel: 'Modül Mağazasına Git',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE,
    route: 'marketplace',
    navKey: 'marketplace'
  }),
  emptyState({
    key: WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.BUSINESS_MENU,
    title: 'İş modülleri henüz kurulmadı.',
    description: menuDescription,
    icon: 'IM',
    actionLabel: 'Modül Mağazasına Git',
    actionType: WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE,
    route: 'marketplace',
    navKey: 'marketplace'
  }),
  emptyState({
    key: WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.MODULE_EMPTY,
    title: 'Henüz kayıt bulunmuyor.',
    description: 'İlk kaydınızı oluşturduğunuzda bu alan kullanılabilir verilerle dolacak.',
    icon: 'BK'
  })
]

const moduleMenuItem = (
  id: string,
  label: string,
  icon: string,
  route: WorkspaceTemplateMenuItem['route'],
  navKey: WorkspaceTemplateMenuItem['navKey'],
  order: number,
  moduleCode: ModuleCode
) => menuItem({ id, label, icon, route, navKey, order, moduleCode })

const RESTAURANT_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.RESTAURANT),
  name: 'Restaurant Çalışma Alanı',
  description: 'Masa, adisyon, dijital talep ve cari odaklı restaurant çalışma alanı başlangıç şablonu.',
  defaultRoute: 'summary',
  defaultNavKey: 'dashboard',
  dashboardTemplate: {
    title: 'Restaurant Kontrol Paneli',
    description: 'Açık masalar, aktif adisyonlar, dijital talepler ve günlük ciro için hazırlanmış başlangıç görünümü.',
    icon: 'RS'
  },
  defaultWidgets: [
    widget({
      id: 'open-tables',
      title: 'Açık Masalar',
      description: 'Serviste açık duran masa ve alanların izleneceği başlangıç widget alanı.',
      icon: 'AM',
      category: 'Operasyon',
      order: 10,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.ADISYON
    }),
    widget({
      id: 'active-bills',
      title: 'Aktif Adisyonlar',
      description: 'Devam eden adisyon ve işlem akışlarının özetleneceği alan.',
      icon: 'AA',
      category: 'Operasyon',
      order: 20,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.ADISYON
    }),
    widget({
      id: 'pending-digital-requests',
      title: 'Bekleyen Siparişler',
      description: 'Dijital katalogdan gelen bekleyen talep ve siparişlerin izleneceği alan.',
      icon: 'BS',
      category: 'Operasyon',
      order: 30,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.QR_MENU
    }),
    widget({
      id: 'waiter-calls',
      title: 'Garson Çağrıları',
      description: 'Görevli çağrılarının kontrol panelinde takip edileceği alan.',
      icon: 'GC',
      category: 'Operasyon',
      order: 40,
      defaultSize: 'small',
      moduleCode: WORKSPACE_MODULE_CODES.QR_MENU
    }),
    widget({
      id: 'daily-revenue',
      title: 'Günlük Ciro',
      description: 'Günlük tahsilat ve cari hareket özetinin gösterileceği alan.',
      icon: 'GC',
      category: 'Finans',
      order: 50,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.CURRENT
    })
  ],
  quickActions: dashboardQuickActions(),
  menuItems: [
    ...baseCoreMenuItems(),
    moduleMenuItem('tables', 'Alanlar', 'AL', 'tables', 'tables-management', 100, WORKSPACE_MODULE_CODES.ADISYON),
    moduleMenuItem('orders', 'İşlemler', 'IS', 'tables', 'adisyon', 110, WORKSPACE_MODULE_CODES.ADISYON),
    moduleMenuItem('products', 'Ürün / Hizmetler', 'UH', 'products', 'products', 120, WORKSPACE_MODULE_CODES.ADISYON),
    moduleMenuItem('digital-requests', 'Dijital Talepler', 'DT', 'qr-orders', 'qr-orders', 130, WORKSPACE_MODULE_CODES.QR_MENU),
    moduleMenuItem('current-accounts', 'Cari Kartlar', 'CK', 'current-accounts', 'current-accounts', 140, WORKSPACE_MODULE_CODES.CURRENT)
  ],
  emptyStates: baseEmptyStates(
    'Restaurant kontrol paneliniz hazır.',
    'İlk canlı veriler gelene kadar masa, adisyon ve dijital talep alanları şablon olarak gösterilir.',
    'Restaurant iş modülleri kurulduğunda masa, adisyon, dijital talep ve cari menüleri burada görünecek.'
  )
})

const INDUSTRIAL_KITCHEN_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.INDUSTRIAL_KITCHEN),
  name: 'Endüstriyel Mutfak Çalışma Alanı',
  description: 'Stok, reçete, üretim hazırlığı ve satın alma akışları için endüstriyel mutfak başlangıç şablonu.',
  defaultRoute: 'summary',
  defaultNavKey: 'dashboard',
  dashboardTemplate: {
    title: 'Endüstriyel Mutfak Kontrol Paneli',
    description: 'Kritik stoklar, üretim tanımları, mal kabul ve sevkiyat hazırlığı için tasarlanmış başlangıç görünümü.',
    icon: 'EM'
  },
  defaultWidgets: [
    widget({
      id: 'critical-stock',
      title: 'Kritik Stoklar',
      description: 'Kritik seviyeye yaklaşan stok kayıtlarının izleneceği alan.',
      icon: 'KS',
      category: 'Stok',
      order: 10,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.STOCK
    }),
    widget({
      id: 'production-today',
      title: 'Bugünkü Üretim',
      description: 'Üretim planı ve reçete hazırlığının takip edileceği başlangıç alanı.',
      icon: 'BU',
      category: 'Operasyon',
      order: 20,
      defaultSize: 'medium',
      moduleCode: WORKSPACE_MODULE_CODES.RECIPE
    }),
    widget({
      id: 'work-orders',
      title: 'Bekleyen İş Emirleri',
      description: 'Üretim iş emirleri modülü hazır olduğunda görünür olacak plan alanı.',
      icon: 'IE',
      category: 'Operasyon',
      order: 30,
      defaultSize: 'medium',
      moduleCode: SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION
    }),
    widget({
      id: 'goods-receipt',
      title: 'Mal Kabul',
      description: 'Satın alma ve mal kabul kayıtları için ayrılmış gelecek alanı.',
      icon: 'MK',
      category: 'Stok',
      order: 40,
      defaultSize: 'medium',
      moduleCode: SECTOR_TEMPLATE_MODULE_CODES.PURCHASE
    }),
    widget({
      id: 'shipment',
      title: 'Sevkiyat',
      description: 'Sevkiyat operasyonları için ileride canlı veriye bağlanacak alan.',
      icon: 'SV',
      category: 'Operasyon',
      order: 50,
      defaultSize: 'small',
      moduleCode: SECTOR_TEMPLATE_MODULE_CODES.WAREHOUSE
    }),
    widget({
      id: 'cold-storage',
      title: 'Soğuk Hava Depoları',
      description: 'Soğuk depo ve stok lokasyon takipleri için ayrılmış alan.',
      icon: 'SD',
      category: 'Stok',
      order: 60,
      defaultSize: 'small',
      moduleCode: WORKSPACE_MODULE_CODES.STOCK
    })
  ],
  quickActions: dashboardQuickActions(),
  menuItems: [
    ...baseCoreMenuItems(),
    moduleMenuItem('stock-cards', 'Stok Kartları', 'SK', 'stock-cards', 'stock-cards', 100, WORKSPACE_MODULE_CODES.STOCK),
    moduleMenuItem('stock-movements', 'Stok Hareketleri', 'SH', 'stock-movements', 'stock-movements', 110, WORKSPACE_MODULE_CODES.STOCK),
    moduleMenuItem('recipes', 'Üretim Tanımları', 'UT', 'recipes', 'recipes', 120, WORKSPACE_MODULE_CODES.RECIPE),
    moduleMenuItem('production-work-orders', 'Üretim Emirleri', 'UE', 'production-work-orders', 'production-work-orders', 125, SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION),
    moduleMenuItem('current-accounts', 'Cari Kartlar', 'CK', 'current-accounts', 'current-accounts', 130, WORKSPACE_MODULE_CODES.CURRENT)
  ],
  emptyStates: baseEmptyStates(
    'Endüstriyel mutfak çalışma alanınız hazır.',
    'Stok ve üretim odaklı başlangıç alanları canlı veri oluşana kadar şablon olarak gösterilir.',
    'Stok, reçete, üretim ve satın alma modülleri kurulduğunda operasyon menüsü burada açılacak.'
  )
})

const GENERAL_BUSINESS_TEMPLATE = createTemplate({
  sectorId: DEFAULT_SECTOR_ID,
  name: 'Genel İşletme Çalışma Alanı',
  description: 'Henüz iş modülü seçmeyen şirketler için çekirdek çalışma alanı başlangıç şablonu.',
  defaultRoute: 'summary',
  defaultNavKey: 'dashboard',
  dashboardTemplate: {
    title: 'Genel İşletme Kontrol Paneli',
    description: 'Çekirdek sistem, modül mağazası ve ilk kurulum yönlendirmeleri için sade başlangıç görünümü.',
    icon: 'GI'
  },
  defaultWidgets: [
    widget({
      id: 'welcome',
      title: 'Hoş Geldiniz',
      description: 'Çalışma alanınız temel sistem bileşenleriyle kullanıma hazır.',
      icon: 'HG',
      category: 'Sistem',
      order: 10,
      defaultSize: 'medium',
      emptyTitle: 'Çalışma alanınız hazır.',
      emptyDescription: 'İş modülleri kuruldukça kontrol paneliniz sektörünüze göre genişleyecek.'
    }),
    widget({
      id: 'install-first-module',
      title: 'İlk Modülünüzü Kurun',
      description: 'Modül mağazası üzerinden işletmenize uygun ilk iş modülünü seçebilirsiniz.',
      icon: 'IM',
      category: 'Sistem',
      order: 20,
      defaultSize: 'medium',
      emptyTitle: 'İlk modülünüzü seçin.',
      emptyDescription: 'Bu alan 20.14.8 kurulum motoru ile gerçek kurulum akışına bağlanacak.'
    }),
    widget({
      id: 'recent-activity',
      title: 'Son İşlemler',
      description: 'Sistemde oluşan son hareketler ileride bu alanda özetlenecek.',
      icon: 'SI',
      category: 'Sistem',
      order: 30,
      defaultSize: 'medium'
    })
  ],
  quickActions: dashboardQuickActions(),
  menuItems: baseCoreMenuItems(),
  emptyStates: baseEmptyStates(
    'Genel işletme kontrol paneliniz hazır.',
    'İş modülü seçilene kadar çekirdek sistem ve modül mağazası yönlendirmeleri gösterilir.',
    'Genel işletme şablonu iş modülü kurmaz; modül seçtiğinizde menü alanları otomatik genişleyecek.'
  )
})

const CAFE_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.CAFE),
  RESTAURANT_TEMPLATE,
  {
    name: 'Cafe Çalışma Alanı',
    description: 'Cafe işletmeleri için restaurant şablonunu temel alan hızlı servis çalışma alanı.',
    dashboardTemplate: {
      title: 'Cafe Kontrol Paneli',
      description: 'Hızlı servis, dijital talep ve günlük satış akışları için hazırlanmış başlangıç görünümü.',
      icon: 'CF'
    }
  }
)

const PATISSERIE_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.PATISSERIE),
  RESTAURANT_TEMPLATE,
  {
    name: 'Pastane Çalışma Alanı',
    description: 'Satış, reçete ve stok takibini birlikte düşünmeye hazırlanan pastane çalışma alanı.',
    dashboardTemplate: {
      title: 'Pastane Kontrol Paneli',
      description: 'Satış, dijital talep, stok ve reçete hazırlıkları için tasarlanmış başlangıç görünümü.',
      icon: 'PS'
    },
    defaultWidgets: [
      ...RESTAURANT_TEMPLATE.defaultWidgets,
      widget({
        id: 'production-definitions',
        title: 'Üretim Tanımları',
        description: 'Pasta, tatlı ve üretim reçeteleri için ayrılmış başlangıç alanı.',
        icon: 'UT',
        category: 'Operasyon',
        order: 60,
        defaultSize: 'medium',
        moduleCode: WORKSPACE_MODULE_CODES.RECIPE
      }),
      widget({
        id: 'critical-stock',
        title: 'Kritik Stoklar',
        description: 'Üretimde kullanılan stokların kritik seviye takibi için alan.',
        icon: 'KS',
        category: 'Stok',
        order: 70,
        defaultSize: 'medium',
        moduleCode: WORKSPACE_MODULE_CODES.STOCK
      })
    ],
    menuItems: [
      ...RESTAURANT_TEMPLATE.menuItems,
      moduleMenuItem('stock-cards', 'Stok Kartları', 'SK', 'stock-cards', 'stock-cards', 150, WORKSPACE_MODULE_CODES.STOCK),
      moduleMenuItem('recipes', 'Üretim Tanımları', 'UT', 'recipes', 'recipes', 160, WORKSPACE_MODULE_CODES.RECIPE)
    ]
  }
)

const HAIRDRESSER_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.HAIRDRESSER),
  GENERAL_BUSINESS_TEMPLATE,
  {
    name: 'Kuaför Çalışma Alanı',
    description: 'Randevu, müşteri, personel ve kasa modülleri için hazırlık yapan hizmet işletmesi çalışma alanı.',
    dashboardTemplate: {
      title: 'Kuaför Kontrol Paneli',
      description: 'Randevu ve müşteri yönetimi modülleri hazır olduğunda genişleyecek başlangıç görünümü.',
      icon: 'KF'
    },
    defaultWidgets: [
      widget({
        id: 'appointments-today',
        title: 'Bugünkü Randevular',
        description: 'Randevu modülü geliştirildiğinde bugünkü randevular burada görünecek.',
        icon: 'BR',
        category: 'Operasyon',
        order: 10,
        moduleCode: SECTOR_TEMPLATE_MODULE_CODES.APPOINTMENT
      }),
      widget({
        id: 'customer-follow-up',
        title: 'Müşteri Takibi',
        description: 'Müşteri modülü hazır olduğunda takip edilecek kayıtlar burada yer alacak.',
        icon: 'MT',
        category: 'Cari',
        order: 20,
        moduleCode: SECTOR_TEMPLATE_MODULE_CODES.CUSTOMER
      }),
      ...GENERAL_BUSINESS_TEMPLATE.defaultWidgets
    ]
  }
)

const FOOTBALL_FIELD_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.FOOTBALL_FIELD),
  GENERAL_BUSINESS_TEMPLATE,
  {
    name: 'Halı Saha Çalışma Alanı',
    description: 'Rezervasyon, müşteri ve kasa modülleri için hazırlanan tesis çalışma alanı.',
    dashboardTemplate: {
      title: 'Halı Saha Kontrol Paneli',
      description: 'Rezervasyon ve tesis operasyonları hazır olduğunda genişleyecek başlangıç görünümü.',
      icon: 'HS'
    },
    defaultWidgets: [
      widget({
        id: 'reservations-today',
        title: 'Bugünkü Rezervasyonlar',
        description: 'Rezervasyon modülü geliştirildiğinde saha rezervasyonları burada görünecek.',
        icon: 'BR',
        category: 'Operasyon',
        order: 10,
        moduleCode: SECTOR_TEMPLATE_MODULE_CODES.RESERVATION
      }),
      widget({
        id: 'cash-summary',
        title: 'Kasa Özeti',
        description: 'Kasa modülü hazır olduğunda günlük tahsilat özeti burada gösterilecek.',
        icon: 'KO',
        category: 'Finans',
        order: 20,
        moduleCode: SECTOR_TEMPLATE_MODULE_CODES.CASH
      }),
      ...GENERAL_BUSINESS_TEMPLATE.defaultWidgets
    ]
  }
)

export const WORKSPACE_TEMPLATE_REGISTRY: WorkspaceTemplate[] = [
  RESTAURANT_TEMPLATE,
  CAFE_TEMPLATE,
  PATISSERIE_TEMPLATE,
  INDUSTRIAL_KITCHEN_TEMPLATE,
  HAIRDRESSER_TEMPLATE,
  FOOTBALL_FIELD_TEMPLATE,
  GENERAL_BUSINESS_TEMPLATE
]
