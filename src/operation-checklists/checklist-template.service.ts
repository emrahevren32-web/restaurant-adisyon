import type {
  ChecklistItemStatus,
  ChecklistStatus,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistType
} from './operation-checklist.types'

export const CHECKLIST_TEMPLATE_STORAGE_KEY = 'ra_operation_checklist_templates'

export const CHECKLIST_TYPES: ChecklistType[] = [
  'OPENING_CONTROL',
  'CLOSING_CONTROL',
  'CLEANING_CONTROL',
  'HACCP_DAILY_CONTROL',
  'COLD_ROOM_CONTROL',
  'BLAST_CHILLING_CONTROL',
  'WAREHOUSE_CONTROL',
  'PRODUCTION_LINE_CONTROL',
  'SHIPMENT_CONTROL',
  'MACHINE_CONTROL',
  'MAINTENANCE_CONTROL',
  'PERSONNEL_HYGIENE_CONTROL'
]

export const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
  OPENING_CONTROL: 'Acilis Kontrolu',
  CLOSING_CONTROL: 'Kapanis Kontrolu',
  CLEANING_CONTROL: 'Temizlik Kontrolu',
  HACCP_DAILY_CONTROL: 'HACCP Gunluk Kontrolu',
  COLD_ROOM_CONTROL: 'Soguk Oda Kontrolu',
  BLAST_CHILLING_CONTROL: 'Soklama Kontrolu',
  WAREHOUSE_CONTROL: 'Depo Kontrolu',
  PRODUCTION_LINE_CONTROL: 'Uretim Hatti Kontrolu',
  SHIPMENT_CONTROL: 'Sevkiyat Kontrolu',
  MACHINE_CONTROL: 'Makine Kontrolu',
  MAINTENANCE_CONTROL: 'Bakim Kontrolu',
  PERSONNEL_HYGIENE_CONTROL: 'Personel Hijyen Kontrolu'
}

export const CHECKLIST_STATUSES: ChecklistStatus[] = [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'REVISED',
  'CANCELLED'
]

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  DRAFT: 'Taslak',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandi',
  REVISED: 'Revize Edildi',
  CANCELLED: 'Iptal'
}

export const CHECKLIST_ITEM_STATUSES: ChecklistItemStatus[] = [
  'PASS',
  'WARNING',
  'FAIL',
  'NOT_APPLICABLE'
]

export const CHECKLIST_ITEM_STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'N/A'
}

type TemplateItemSeed = {
  title: string
  description: string
  required?: boolean
  photoFieldReady?: boolean
  correctiveActionRequiredOnFail?: boolean
}

type TemplateSeed = {
  type: ChecklistType
  department: string
  description: string
  items: TemplateItemSeed[]
}

const DEFAULT_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    type: 'OPENING_CONTROL',
    department: 'Operasyon',
    description: 'Vardiya baslangici icin genel operasyon hazirlik kontrolleri.',
    items: [
      { title: 'Vardiya ekibi hazir', description: 'Planlanan ekip vardiya alaninda ve gorev dagilimi yapildi.' },
      { title: 'Uretim alanlari acilis kontrolu', description: 'Alanlar temiz, kuru ve operasyon icin hazir.' },
      { title: 'Ekipman calisir durumda', description: 'Kritik ekipmanlar baslangic oncesi kontrol edildi.', correctiveActionRequiredOnFail: true },
      { title: 'Gunluk HACCP formlari hazir', description: 'Gunluk kritik kontrol noktasi kayit seti acildi.' }
    ]
  },
  {
    type: 'CLOSING_CONTROL',
    department: 'Operasyon',
    description: 'Vardiya kapanisinda alan, ekipman ve kayit kapanis kontrolleri.',
    items: [
      { title: 'Uretim alanlari kapatildi', description: 'Hatlar temizlendi ve guvenli sekilde kapatildi.' },
      { title: 'Son urun ve ara urunler aktarildi', description: 'Urunler uygun depo veya sevkiyat alanina alindi.' },
      { title: 'Kapanis sayimi yapildi', description: 'Kalan stok, fire ve bekleyen isler kontrol edildi.' },
      { title: 'Kritik kayitlar tamamlandi', description: 'Eksik operasyon, kalite veya HACCP kaydi kalmadi.', correctiveActionRequiredOnFail: true }
    ]
  },
  {
    type: 'CLEANING_CONTROL',
    department: 'Temizlik',
    description: 'Temizlik ve sanitasyon sureclerinin gunluk kontrolu.',
    items: [
      { title: 'Temizlik planina uyuldu', description: 'Planlanan alanlar belirlenen sira ile temizlendi.' },
      { title: 'Kimyasal kullanim kaydi uygun', description: 'Kimyasal ad, doz ve uygulama bilgisi kontrol edildi.' },
      { title: 'Gorsel temizlik uygun', description: 'Zemin, tezgah ve ekipman yuzeyleri kontrol edildi.', photoFieldReady: true },
      { title: 'Duzeltici faaliyet kaydi', description: 'Uygunsuzluk varsa sorumlu ve termin belirtildi.', required: false, correctiveActionRequiredOnFail: true }
    ]
  },
  {
    type: 'HACCP_DAILY_CONTROL',
    department: 'Kalite',
    description: 'HACCP kritik kontrol noktalarinin gunluk operasyon kontrolu.',
    items: [
      { title: 'CCP olcumleri tamamlandi', description: 'Gunluk CCP olcumleri kritik limitlere gore kontrol edildi.' },
      { title: 'Sapma kaydi incelendi', description: 'FAIL kayitlar icin duzeltici faaliyet acildi.', correctiveActionRequiredOnFail: true },
      { title: 'Dogrulama kaydi mevcut', description: 'Kalite sorumlusu dogrulama kaydini isledi.' },
      { title: 'Urun ve lot izlenebilirligi uygun', description: 'HACCP kaydi ilgili lot ve uretim emrine baglandi.' }
    ]
  },
  {
    type: 'COLD_ROOM_CONTROL',
    department: 'Depo',
    description: 'Soguk oda sicaklik, hijyen ve stok duzeni kontrolleri.',
    items: [
      { title: 'Sicaklik limiti uygun', description: 'Soguk oda sicakligi belirlenen limitte.', correctiveActionRequiredOnFail: true },
      { title: 'Kapi ve conta kontrolu', description: 'Kapi kapanisi, conta ve izolasyon kontrol edildi.' },
      { title: 'FIFO/FEFO duzeni uygun', description: 'Stok yerlesimi ve SKT onceligi dogru.' },
      { title: 'Oda hijyeni uygun', description: 'Raf, zemin ve drenaj alani temiz.' }
    ]
  },
  {
    type: 'BLAST_CHILLING_CONTROL',
    department: 'Uretim',
    description: 'Soklama sureci baslangic, bitis ve sicaklik kontrolu.',
    items: [
      { title: 'Soklama cihazi hazir', description: 'Cihaz calisma durumu ve program secimi kontrol edildi.' },
      { title: 'Urun giris sicakligi kaydedildi', description: 'Baslangic sicakligi kalite limitine gore kaydedildi.' },
      { title: 'Cikis sicakligi uygun', description: 'Soklama sonrasi hedef sicaklik saglandi.', correctiveActionRequiredOnFail: true },
      { title: 'Lot etiketi dogrulandi', description: 'Urun lot ve etiket bilgisi kontrol edildi.' }
    ]
  },
  {
    type: 'WAREHOUSE_CONTROL',
    department: 'Depo',
    description: 'Depo alanlari, lot duzeni ve stok guvenligi kontrolu.',
    items: [
      { title: 'Depo raf duzeni uygun', description: 'Raflar, lokasyonlar ve ayristirma alanlari kontrol edildi.' },
      { title: 'Lot ve SKT takibi uygun', description: 'Lotlar izlenebilir ve SKT riski gorunur durumda.' },
      { title: 'Hasarli urun ayristirildi', description: 'Hasarli veya blokeli urunler karantina alaninda.' },
      { title: 'Depo hijyeni uygun', description: 'Depo genel temizlik ve zararlilarla mucadele kontrol edildi.' }
    ]
  },
  {
    type: 'PRODUCTION_LINE_CONTROL',
    department: 'Uretim',
    description: 'Uretim hatti hazirlik, proses ve kapanis kontrolleri.',
    items: [
      { title: 'Hat temiz ve hazir', description: 'Hat baslangic temizligi ve ekipman durumu kontrol edildi.' },
      { title: 'Recete ve uretim emri dogru', description: 'Aktif uretim emri, urun ve recete eslesmesi kontrol edildi.' },
      { title: 'Operator atamasi yapildi', description: 'Sorumlu operator ve vardiya bilgisi kayitli.' },
      { title: 'Proses kritik limitleri izlendi', description: 'Sicaklik, sure veya diger kritik limitler takip edildi.', correctiveActionRequiredOnFail: true }
    ]
  },
  {
    type: 'SHIPMENT_CONTROL',
    department: 'Sevkiyat',
    description: 'Yukleme, arac, etiket, lot ve irsaliye kontrolleri.',
    items: [
      { title: 'Irsaliye ve sevkiyat eslesti', description: 'Delivery Note, shipment plan ve yuklenen kalemler dogru.' },
      { title: 'Arac hijyeni uygun', description: 'Arac kasa temizligi ve sogutma uygunlugu kontrol edildi.' },
      { title: 'Lot ve etiket dogrulandi', description: 'Urun lotlari ve etiketleri sevkiyat listesiyle eslesti.' },
      { title: 'Soguk zincir kaydi uygun', description: 'Yukleme sicakligi hedef aralikta.', correctiveActionRequiredOnFail: true }
    ]
  },
  {
    type: 'MACHINE_CONTROL',
    department: 'Bakim',
    description: 'Makine calisirlik, guvenlik ve temizlik kontrolu.',
    items: [
      { title: 'Makine calisir durumda', description: 'Makine baslangic testi basarili.' },
      { title: 'Koruyucu ekipman uygun', description: 'Muhafaza, acil stop ve guvenlik elemanlari kontrol edildi.' },
      { title: 'Gorsel ariza yok', description: 'Kablo, baglanti ve mekanik parcalarda uygunsuzluk yok.', photoFieldReady: true },
      { title: 'Bakim ihtiyaci kaydi', description: 'Ariza veya risk varsa bakim aksiyonu acildi.', required: false, correctiveActionRequiredOnFail: true }
    ]
  },
  {
    type: 'MAINTENANCE_CONTROL',
    department: 'Bakim',
    description: 'Planli bakim ve revizyon izleme kontrolleri.',
    items: [
      { title: 'Planli bakim tamamlandi', description: 'Bakim talimatindaki adimlar tamamlandi.' },
      { title: 'Yedek parca ve sarf kaydi uygun', description: 'Kullanilan parca ve sarf malzeme kaydedildi.' },
      { title: 'Test calismasi basarili', description: 'Bakim sonrasi test uretimi veya bos calisma uygun.' },
      { title: 'Revizyon notu girildi', description: 'Gereken revizyon veya takip notu kaydedildi.', required: false }
    ]
  },
  {
    type: 'PERSONNEL_HYGIENE_CONTROL',
    department: 'IK / Kalite',
    description: 'Personel hijyen, kiyafet ve alana giris kontrolleri.',
    items: [
      { title: 'Kisisel hijyen uygun', description: 'El hijyeni, tirnak ve kisisel koruyucu ekipman kontrol edildi.' },
      { title: 'Kiyafet ve bone uygun', description: 'Uretim alani kiyafet kurallari saglandi.' },
      { title: 'Saglik beyan riski yok', description: 'Uygunsuz saglik beyan veya belirti yok.' },
      { title: 'Egitim farkindaligi uygun', description: 'Personel gunluk hijyen hatirlatmasini aldi.' }
    ]
  }
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const createTemplateItem = (
  templateId: string,
  seed: TemplateItemSeed,
  index: number
): ChecklistTemplateItem => ({
  id: `${templateId}_item_${index + 1}`,
  templateId,
  title: seed.title,
  description: seed.description,
  required: seed.required !== false,
  photoFieldReady: seed.photoFieldReady === true,
  correctiveActionRequiredOnFail: seed.correctiveActionRequiredOnFail === true,
  displayOrder: index + 1
})

export const createDefaultChecklistTemplates = (): ChecklistTemplate[] => {
  const now = new Date().toISOString()

  return DEFAULT_TEMPLATE_SEEDS.map(seed => {
    const templateId = `checklist_template_${seed.type.toLocaleLowerCase('tr-TR')}`

    return {
      id: templateId,
      checklistType: seed.type,
      name: CHECKLIST_TYPE_LABELS[seed.type],
      version: 'v1.0',
      description: seed.description,
      department: seed.department,
      isActive: true,
      items: seed.items.map((item, index) => createTemplateItem(templateId, item, index)),
      createdAt: now,
      updatedAt: now
    }
  })
}

const normalizeTemplateItem = (
  value: Record<string, unknown>,
  templateId: string,
  index: number
): ChecklistTemplateItem => ({
  id: normalizeText(value.id) || `${templateId}_item_${index + 1}`,
  templateId,
  title: normalizeText(value.title) || `Kontrol ${index + 1}`,
  description: normalizeText(value.description),
  required: typeof value.required === 'boolean' ? value.required : true,
  photoFieldReady: value.photoFieldReady === true,
  correctiveActionRequiredOnFail: value.correctiveActionRequiredOnFail === true,
  displayOrder: Number(value.displayOrder) || index + 1
})

const normalizeTemplate = (
  value: Record<string, unknown>,
  index: number
): ChecklistTemplate => {
  const type = CHECKLIST_TYPES.includes(normalizeText(value.checklistType) as ChecklistType)
    ? normalizeText(value.checklistType) as ChecklistType
    : CHECKLIST_TYPES[index % CHECKLIST_TYPES.length]
  const id = normalizeText(value.id) || `checklist_template_${type.toLocaleLowerCase('tr-TR')}`
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeTemplateItem(item, id, itemIndex))
    : []

  return {
    id,
    checklistType: type,
    name: normalizeText(value.name) || CHECKLIST_TYPE_LABELS[type],
    version: normalizeText(value.version) || 'v1.0',
    description: normalizeText(value.description),
    department: normalizeText(value.department) || 'Operasyon',
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    items,
    createdAt: normalizeText(value.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(value.updatedAt) || new Date().toISOString()
  }
}

export const saveChecklistTemplates = (
  templates: ChecklistTemplate[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CHECKLIST_TEMPLATE_STORAGE_KEY, JSON.stringify(templates))
}

export const loadChecklistTemplates = () => {
  const defaults = createDefaultChecklistTemplates()
  if(!isBrowserStorageAvailable()) return defaults

  const storedTemplates = localStorage.getItem(CHECKLIST_TEMPLATE_STORAGE_KEY)
  if(!storedTemplates){
    saveChecklistTemplates(defaults)
    return defaults
  }

  try{
    const parsed = JSON.parse(storedTemplates)
    if(Array.isArray(parsed)){
      const normalized = parsed
        .filter(isRecord)
        .map(normalizeTemplate)
        .filter(template => template.items.length > 0)
      const normalizedIds = new Set(normalized.map(template => template.id))
      const nextTemplates = [
        ...normalized,
        ...defaults.filter(template => !normalizedIds.has(template.id))
      ]
      saveChecklistTemplates(nextTemplates)
      return nextTemplates
    }
  } catch {
    saveChecklistTemplates(defaults)
    return defaults
  }

  saveChecklistTemplates(defaults)
  return defaults
}

export const getChecklistTemplateForType = (
  checklistType: ChecklistType,
  templates = loadChecklistTemplates()
) => templates.find(template => template.checklistType === checklistType && template.isActive)
  || templates.find(template => template.checklistType === checklistType)
  || templates[0]

export const ChecklistTemplateService = {
  list: loadChecklistTemplates,
  save: saveChecklistTemplates,
  getForType: getChecklistTemplateForType,
  createDefaults: createDefaultChecklistTemplates
}
