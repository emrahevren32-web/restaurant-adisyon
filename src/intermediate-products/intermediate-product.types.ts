export type IntermediateProductCategory =
  | 'Marine'
  | 'Sos'
  | 'Et'
  | 'Sebze'
  | 'Baz'
  | 'Hamur'
  | 'Genel'

export type IntermediateProductUnit =
  | 'kg'
  | 'lt'
  | 'adet'
  | 'koli'

export type IntermediateProductStatus =
  | 'Aktif'
  | 'Kritik'
  | 'Pasif'

export type IntermediateProduct = {
  id: string
  code: string
  name: string
  category: IntermediateProductCategory
  unit: IntermediateProductUnit
  currentStock: number
  minimumStock: number
  status: IntermediateProductStatus
  description: string
  linkedRecipe: string
  linkedFinalProducts: string[]
  createdAt: string
  updatedAt?: string
}
