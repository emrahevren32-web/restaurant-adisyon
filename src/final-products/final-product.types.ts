export type FinalProductCategory =
  | 'Çorba'
  | 'Et'
  | 'Tavuk'
  | 'Sebze'
  | 'Hamur'
  | 'Pizza'
  | 'Makarna'
  | 'Tatlı'
  | 'Genel'

export type FinalProductUnit =
  | 'kg'
  | 'lt'
  | 'adet'
  | 'koli'
  | 'tepsi'

export type FinalProductStatus =
  | 'Aktif'
  | 'Kritik'
  | 'Pasif'

export type FinalProduct = {
  id: string
  code: string
  name: string
  category: FinalProductCategory
  unit: FinalProductUnit
  currentStock: number
  minimumStock: number
  status: FinalProductStatus
  description: string
  linkedIntermediateProducts: string[]
  linkedPackaging: string
  createdAt: string
  updatedAt?: string
}
