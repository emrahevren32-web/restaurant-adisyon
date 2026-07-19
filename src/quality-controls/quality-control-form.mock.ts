import type { QualityControl } from './quality-control.types'
import type {
  QualityControlFormItem,
  QualityControlFormRecord,
  QualityControlFormResult,
  QualityControlTemplateItem,
  QualityControlTemplateRecord
} from './quality-control-form.types'

export const QUALITY_CONTROL_TEMPLATE_STORAGE_KEY = 'ra_quality_control_templates'
export const QUALITY_CONTROL_FORM_STORAGE_KEY = 'ra_quality_control_forms'

export const QUALITY_CONTROL_FORM_RESULTS: QualityControlFormResult[] = [
  'PASS',
  'FAIL',
  'NOT_APPLICABLE'
]

export const QUALITY_CONTROL_FORM_RESULT_LABELS: Record<QualityControlFormResult, string> = {
  PASS: 'Geçti',
  FAIL: 'Kaldı',
  NOT_APPLICABLE: 'Uygulanmaz'
}

const PASS_SCORE = 100
const FAIL_SCORE = 0
const SCORE_ROUNDING_FACTOR = 100
const DEFAULT_TEMPLATE_ID = 'quality_control_template_general'

type RawQualityControlTemplateRecord =
  Partial<Record<keyof QualityControlTemplateRecord, unknown>>
  & Record<string, unknown>

type RawQualityControlTemplateItem =
  Partial<Record<keyof QualityControlTemplateItem, unknown>>
  & Record<string, unknown>

type RawQualityControlFormRecord =
  Partial<Record<keyof QualityControlFormRecord, unknown>>
  & Record<string, unknown>

type RawQualityControlFormItem =
  Partial<Record<keyof QualityControlFormItem, unknown>>
  & Record<string, unknown>

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeBoolean = (value: unknown, fallback = false) => (
  typeof value === 'boolean' ? value : fallback
)

const normalizePositiveOrder = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeResult = (value: unknown): QualityControlFormResult => {
  const normalized = normalizeText(value).toUpperCase()
  return QUALITY_CONTROL_FORM_RESULTS.includes(normalized as QualityControlFormResult)
    ? normalized as QualityControlFormResult
    : 'NOT_APPLICABLE'
}

const roundScore = (value: number) => (
  Math.round((value + Number.EPSILON) * SCORE_ROUNDING_FACTOR) / SCORE_ROUNDING_FACTOR
)

export const calculateQualityControlOverallScore = (
  items: Pick<QualityControlFormItem, 'result'>[]
) => {
  const scoreItems = items.filter(item => item.result !== 'NOT_APPLICABLE')
  if(scoreItems.length === 0) return 0

  const totalScore = scoreItems.reduce((total, item) => (
    total + (item.result === 'PASS' ? PASS_SCORE : FAIL_SCORE)
  ), 0)

  return roundScore(totalScore / scoreItems.length)
}

export const formatQualityControlScore = (score: number) => (
  `${score.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
)

export const getQualityControlFormDisplayNo = (
  records: Pick<QualityControlFormRecord, 'id' | 'createdAt'>[],
  formId: string
) => {
  const sortedRecords = [...records].sort((first, second) => {
    const dateCompare = first.createdAt.localeCompare(second.createdAt)
    return dateCompare !== 0 ? dateCompare : first.id.localeCompare(second.id)
  })
  const index = sortedRecords.findIndex(record => record.id === formId)

  return `QCF-${String(index + 1).padStart(6, '0')}`
}

const createTemplateItem = (
  templateId: string,
  index: number,
  title: string,
  description: string,
  isRequired = true
): QualityControlTemplateItem => ({
  id: `${templateId}_item_${String(index + 1).padStart(2, '0')}`,
  templateId,
  title,
  description,
  displayOrder: index + 1,
  isRequired
})

export const createQualityControlTemplateMockData = (): QualityControlTemplateRecord[] => {
  const createdAt = '2026-07-19T08:00:00.000Z'
  const templateInputs = [
    {
      id: 'quality_control_template_chicken_receipt',
      name: 'Tavuk Mal Kabul',
      description: 'Tavuk ürünleri için sıcaklık, ambalaj ve duyusal kabul kontrol listesi.',
      items: [
        ['Ambalaj sağlam mı?', 'Koli, vakum veya paket bütünlüğü kontrol edilir.', true],
        ['Etiket uygun mu?', 'Ürün adı, parti ve son kullanma tarihi okunabilir olmalıdır.', true],
        ['Sıcaklık uygun mu?', 'Soğuk zincir kabul sıcaklığı kontrol edilir.', true],
        ['Ürün kokusu uygun mu?', 'Uygunsuz koku bulunmamalıdır.', true],
        ['Fiziksel hasar var mı?', 'Ezilme, sızıntı veya kontaminasyon bulgusu değerlendirilir.', false]
      ]
    },
    {
      id: 'quality_control_template_meat_receipt',
      name: 'Et Mal Kabul',
      description: 'Kırmızı et ve işlenmiş et ürünleri için duyusal ve lojistik kontrol listesi.',
      items: [
        ['Araç hijyenik mi?', 'Teslimat aracının taşıma alanı hijyenik olmalıdır.', true],
        ['Sıcaklık uygun mu?', 'Ürün sıcaklığı kabul kriterlerine göre ölçülür.', true],
        ['Renk uygun mu?', 'Ürün rengi standart dışı olmamalıdır.', true],
        ['Ürün kokusu uygun mu?', 'Bozulma belirtisi olabilecek koku olmamalıdır.', true],
        ['Son Kullanma Tarihi uygun mu?', 'Kabul eşiğinin altında kalan ürün reddedilir.', true]
      ]
    },
    {
      id: 'quality_control_template_dairy',
      name: 'Süt Ürünleri',
      description: 'Süt, yoğurt, peynir ve benzeri ürünler için soğuk zincir ve etiket kontrolü.',
      items: [
        ['Sıcaklık uygun mu?', 'Soğuk zincir sıcaklığı kayıt altına alınır.', true],
        ['Ambalaj sağlam mı?', 'Şişme, sızıntı veya ezilme olmamalıdır.', true],
        ['Etiket uygun mu?', 'Ürün ve lot bilgisi doğrulanır.', true],
        ['Son Kullanma Tarihi uygun mu?', 'SKT kabul kriterini karşılamalıdır.', true],
        ['Fiziksel hasar var mı?', 'Hasarlı ürünler ayrıştırılır.', false]
      ]
    },
    {
      id: 'quality_control_template_produce',
      name: 'Sebze Meyve',
      description: 'Taze sebze ve meyve ürünleri için görsel kalite ve hijyen kontrol listesi.',
      items: [
        ['Ürün kokusu uygun mu?', 'Çürüme veya fermantasyon kokusu olmamalıdır.', true],
        ['Renk uygun mu?', 'Ürün doğal rengine uygun görünmelidir.', true],
        ['Fiziksel hasar var mı?', 'Ezilme, küflenme ve darbe izleri kontrol edilir.', true],
        ['Araç hijyenik mi?', 'Taşıma kasası ve araç temizliği değerlendirilir.', false],
        ['Etiket uygun mu?', 'Kasa veya irsaliye ürün bilgisi doğrulanır.', false]
      ]
    },
    {
      id: 'quality_control_template_dry_goods',
      name: 'Kuru Gıda',
      description: 'Bakliyat, un, baharat ve kuru gıda ürünleri için ambalaj ve SKT kontrol listesi.',
      items: [
        ['Ambalaj sağlam mı?', 'Yırtık, delik veya nem belirtisi olmamalıdır.', true],
        ['Etiket uygun mu?', 'Ürün, gramaj, lot ve SKT bilgileri okunabilir olmalıdır.', true],
        ['Son Kullanma Tarihi uygun mu?', 'Minimum raf ömrü kriteri sağlanmalıdır.', true],
        ['Fiziksel hasar var mı?', 'Yabancı madde, topaklanma veya zararlı izi değerlendirilir.', true],
        ['Araç hijyenik mi?', 'Kuru taşıma koşulları kontrol edilir.', false]
      ]
    }
  ] as const

  return templateInputs.map((template, templateIndex) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
    items: template.items.map((item, itemIndex) => (
      createTemplateItem(template.id, itemIndex, item[0], item[1], item[2])
    )),
    displayOrder: templateIndex + 1
  })).map(({ displayOrder: _displayOrder, ...template }) => template)
}

const createFormItems = (
  formId: string,
  template: QualityControlTemplateRecord,
  offset: number
): QualityControlFormItem[] => {
  const patterns: QualityControlFormResult[][] = [
    ['PASS', 'PASS', 'PASS', 'PASS', 'NOT_APPLICABLE'],
    ['PASS', 'PASS', 'FAIL', 'PASS', 'PASS'],
    ['PASS', 'FAIL', 'PASS', 'PASS', 'NOT_APPLICABLE'],
    ['FAIL', 'PASS', 'FAIL', 'PASS', 'PASS'],
    ['PASS', 'PASS', 'PASS', 'NOT_APPLICABLE', 'PASS']
  ]
  const pattern = patterns[offset % patterns.length]

  return template.items.map((item, index) => ({
    id: `${formId}_item_${String(index + 1).padStart(2, '0')}`,
    formId,
    templateItemId: item.id,
    result: pattern[index] || 'PASS',
    notes: pattern[index] === 'FAIL'
      ? 'Kontrol kriteri için uygunsuzluk not edildi.'
      : ''
  }))
}

export const createQualityControlFormMockData = (
  qualityControls: QualityControl[],
  templates: QualityControlTemplateRecord[]
): QualityControlFormRecord[] => {
  const activeTemplates = templates.filter(template => template.isActive)
  if(activeTemplates.length === 0) return []

  return qualityControls.slice(0, 15).map((qualityControl, index) => {
    const template = activeTemplates[index % activeTemplates.length]
    const formId = `quality_control_form_${String(index + 1).padStart(3, '0')}`
    const createdAt = `2026-07-${String(14 + (index % 5)).padStart(2, '0')}T10:${String(index * 3).padStart(2, '0')}:00.000Z`
    const items = createFormItems(formId, template, index)

    return {
      id: formId,
      qualityControlId: qualityControl.id,
      templateId: template.id,
      overallScore: calculateQualityControlOverallScore(items),
      notes: index % 4 === 0 ? 'Standart kontrol formu tamamlandı.' : '',
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

const normalizeTemplateItem = (
  item: RawQualityControlTemplateItem,
  templateId: string,
  index: number
): QualityControlTemplateItem => ({
  id: normalizeText(item.id) || `${templateId}_item_${String(index + 1).padStart(2, '0')}`,
  templateId,
  title: normalizeText(item.title) || 'Genel kontrol maddesi',
  description: normalizeText(item.description),
  displayOrder: normalizePositiveOrder(item.displayOrder, index + 1),
  isRequired: normalizeBoolean(item.isRequired, true)
})

const normalizeTemplate = (
  item: RawQualityControlTemplateRecord,
  index: number
): QualityControlTemplateRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const templateId = normalizeText(item.id) || `${DEFAULT_TEMPLATE_ID}_${index + 1}`
  const rawItems = Array.isArray(item.items) ? item.items : []
  const normalizedItems = rawItems
    .filter(isRecord)
    .map((templateItem, itemIndex) => normalizeTemplateItem(templateItem, templateId, itemIndex))
    .sort((first, second) => first.displayOrder - second.displayOrder)

  return {
    id: templateId,
    name: normalizeText(item.name) || `Kalite Kontrol Şablonu ${index + 1}`,
    description: normalizeText(item.description),
    isActive: item.isActive === undefined ? true : normalizeBoolean(item.isActive, true),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: normalizedItems.length > 0
      ? normalizedItems
      : [createTemplateItem(templateId, 0, 'Genel kontrol maddesi', '', true)]
  }
}

const normalizeFormItem = (
  item: RawQualityControlFormItem,
  formId: string,
  index: number
): QualityControlFormItem => ({
  id: normalizeText(item.id) || `${formId}_item_${String(index + 1).padStart(2, '0')}`,
  formId,
  templateItemId: normalizeText(item.templateItemId),
  result: normalizeResult(item.result),
  notes: normalizeText(item.notes)
})

const normalizeForm = (
  item: RawQualityControlFormRecord,
  index: number
): QualityControlFormRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const formId = normalizeText(item.id) || `quality_control_form_${Date.now()}_${index}`
  const rawItems = Array.isArray(item.items) ? item.items : []
  const normalizedItems = rawItems
    .filter(isRecord)
    .map((formItem, itemIndex) => normalizeFormItem(formItem, formId, itemIndex))

  return {
    id: formId,
    qualityControlId: normalizeText(item.qualityControlId),
    templateId: normalizeText(item.templateId),
    overallScore: calculateQualityControlOverallScore(normalizedItems),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: normalizedItems
  }
}

export const saveQualityControlTemplateRecords = (records: QualityControlTemplateRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QUALITY_CONTROL_TEMPLATE_STORAGE_KEY, JSON.stringify(records))
}

export const loadQualityControlTemplateRecords = () => {
  const seedRecords = createQualityControlTemplateMockData()

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(QUALITY_CONTROL_TEMPLATE_STORAGE_KEY)
  if(!storedRecords){
    saveQualityControlTemplateRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeTemplate)

      saveQualityControlTemplateRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    saveQualityControlTemplateRecords(seedRecords)
    return seedRecords
  }

  saveQualityControlTemplateRecords(seedRecords)
  return seedRecords
}

export const saveQualityControlFormRecords = (records: QualityControlFormRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(QUALITY_CONTROL_FORM_STORAGE_KEY, JSON.stringify(records))
}

export const loadQualityControlFormRecords = (
  qualityControls: QualityControl[],
  templates: QualityControlTemplateRecord[]
) => {
  const seedRecords = createQualityControlFormMockData(qualityControls, templates)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(QUALITY_CONTROL_FORM_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveQualityControlFormRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeForm)

      saveQualityControlFormRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveQualityControlFormRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveQualityControlFormRecords(seedRecords)
  return seedRecords
}
