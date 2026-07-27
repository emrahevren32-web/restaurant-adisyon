import type {
  LabelTemplate,
  LabelTemplateSize,
  LabelType
} from './label.types'

export const LABEL_TYPE_LABELS: Record<LabelType, string> = {
  PRODUCT: 'Urun Etiketi',
  LOT: 'Lot Etiketi',
  BOX: 'Koli Etiketi',
  PALLET: 'Palet Etiketi',
  BLAST_CHILLING: 'Soklama Etiketi',
  SAMPLE: 'Numune Etiketi',
  WITNESS_SAMPLE: 'Sahit Numune Etiketi',
  WAREHOUSE_SHELF: 'Depo Raf Etiketi',
  SHIPMENT: 'Sevkiyat Etiketi'
}

export const LABEL_TEMPLATE_SIZE_LABELS: Record<LabelTemplateSize, string> = {
  A4: 'A4',
  MM_50_30: '50x30 mm',
  MM_70_50: '70x50 mm',
  MM_100_100: '100x100 mm',
  CUSTOM: 'Ozel Sablon'
}

export const LABEL_TYPES: LabelType[] = [
  'PRODUCT',
  'LOT',
  'BOX',
  'PALLET',
  'BLAST_CHILLING',
  'SAMPLE',
  'WITNESS_SAMPLE',
  'WAREHOUSE_SHELF',
  'SHIPMENT'
]

const allTypes = () => [...LABEL_TYPES]

export const LABEL_TEMPLATES: LabelTemplate[] = [
  {
    id: 'label-template-a4',
    name: 'A4 Kurumsal Etiket',
    size: 'A4',
    widthMm: 210,
    heightMm: 297,
    columns: 2,
    rows: 4,
    description: 'A4 uzerinde toplu lot, sevkiyat ve depo etiketleri.',
    supportedTypes: allTypes(),
    active: true
  },
  {
    id: 'label-template-50-30',
    name: '50x30 Urun/Lot',
    size: 'MM_50_30',
    widthMm: 50,
    heightMm: 30,
    columns: 1,
    rows: 1,
    description: 'Kucuk urun, lot ve numune etiketleri.',
    supportedTypes: ['PRODUCT', 'LOT', 'SAMPLE', 'WITNESS_SAMPLE'],
    active: true
  },
  {
    id: 'label-template-70-50',
    name: '70x50 Koli',
    size: 'MM_70_50',
    widthMm: 70,
    heightMm: 50,
    columns: 1,
    rows: 1,
    description: 'Koli, soklama ve sevkiyat etiketleri.',
    supportedTypes: ['BOX', 'BLAST_CHILLING', 'SHIPMENT', 'PRODUCT', 'LOT'],
    active: true
  },
  {
    id: 'label-template-100-100',
    name: '100x100 Palet',
    size: 'MM_100_100',
    widthMm: 100,
    heightMm: 100,
    columns: 1,
    rows: 1,
    description: 'Palet, depo raf ve buyuk izlenebilirlik etiketleri.',
    supportedTypes: ['PALLET', 'WAREHOUSE_SHELF', 'SHIPMENT', 'LOT'],
    active: true
  },
  {
    id: 'label-template-custom',
    name: 'Ozel Sablon',
    size: 'CUSTOM',
    widthMm: 85,
    heightMm: 55,
    columns: 1,
    rows: 1,
    description: 'Ileride endustriyel yazici suruculeri ile eslenecek ozel sablon.',
    supportedTypes: allTypes(),
    active: true
  }
]

export const getLabelTemplates = () => LABEL_TEMPLATES.filter(template => template.active)

export const getLabelTemplate = (templateId: string) => (
  getLabelTemplates().find(template => template.id === templateId) || getLabelTemplates()[0]
)

export const getTemplatesForLabelType = (labelType: LabelType) => (
  getLabelTemplates().filter(template => template.supportedTypes.includes(labelType))
)

export const LabelTemplateService = {
  labels: LABEL_TYPE_LABELS,
  sizeLabels: LABEL_TEMPLATE_SIZE_LABELS,
  types: LABEL_TYPES,
  list: getLabelTemplates,
  get: getLabelTemplate,
  listForType: getTemplatesForLabelType
}
