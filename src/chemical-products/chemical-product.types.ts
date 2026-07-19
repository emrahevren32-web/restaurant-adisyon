export type ChemicalProductCategory =
  | 'DETERGENT'
  | 'DISINFECTANT'
  | 'DEGREASER'
  | 'DESCALER'
  | 'SANITIZER'
  | 'MAINTENANCE'
  | 'OTHER'

export type ChemicalProductHazardClass =
  | 'NONE'
  | 'IRRITANT'
  | 'CORROSIVE'
  | 'FLAMMABLE'
  | 'OXIDIZER'
  | 'TOXIC'
  | 'OTHER'

export type ChemicalProductPhysicalState =
  | 'LIQUID'
  | 'POWDER'
  | 'GEL'
  | 'SPRAY'
  | 'FOAM'
  | 'OTHER'

export type ChemicalProductStorageCondition =
  | 'ROOM_TEMPERATURE'
  | 'COOL'
  | 'VENTILATED'
  | 'LOCKED_CABINET'
  | 'FLAMMABLE_STORAGE'
  | 'OTHER'

export type ChemicalProductStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DISCONTINUED'

export type ChemicalProduct = {
  id: string
  chemicalCode: string
  name: string
  brand: string
  supplierId: string
  stockItemId: string
  category: ChemicalProductCategory
  hazardClass: ChemicalProductHazardClass
  physicalState: ChemicalProductPhysicalState
  storageCondition: ChemicalProductStorageCondition
  usageArea: string
  requiredPPE: string
  msdsDocumentNumber: string
  usageInstruction: string
  status: ChemicalProductStatus
  notes: string
  createdAt: string
  updatedAt: string
}
