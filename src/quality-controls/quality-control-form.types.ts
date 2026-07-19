export type QualityControlFormResult =
  | 'PASS'
  | 'FAIL'
  | 'NOT_APPLICABLE'

export type QualityControlTemplate = {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type QualityControlTemplateItem = {
  id: string
  templateId: string
  title: string
  description: string
  displayOrder: number
  isRequired: boolean
}

export type QualityControlForm = {
  id: string
  qualityControlId: string
  templateId: string
  overallScore: number
  notes: string
  createdAt: string
  updatedAt: string
}

export type QualityControlFormItem = {
  id: string
  formId: string
  templateItemId: string
  result: QualityControlFormResult
  notes: string
}

export type QualityControlTemplateRecord = QualityControlTemplate & {
  items: QualityControlTemplateItem[]
}

export type QualityControlFormRecord = QualityControlForm & {
  items: QualityControlFormItem[]
}
