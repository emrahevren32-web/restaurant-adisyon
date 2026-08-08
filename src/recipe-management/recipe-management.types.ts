export type RecipeManagementType =
  | 'Ana Ürün'
  | 'Ara Ürün'

export type RecipeManagementStatus =
  | 'Aktif'
  | 'Pasif'

export type RecipeMasterStatus =
  | 'Aktif'
  | 'Pasif'
  | 'Arşiv'

export type RecipeVersionStatus =
  | 'Taslak'
  | 'İncelemede'
  | 'Onaylandı'
  | 'Aktif'
  | 'Arşiv'

export type RecipeManagementRole =
  | 'PRIMARY'
  | 'ALTERNATIVE'

export type RecipeIngredientUnit =
  | 'gr'
  | 'kg'
  | 'ml'
  | 'lt'
  | 'adet'
  | 'paket'
  | 'koli'
  | 'çuval'
  | 'kasa'

export type RecipeIngredientBaseUnit =
  | 'gr'
  | 'ml'
  | 'adet'
  | 'paket'
  | 'koli'
  | 'çuval'
  | 'kasa'

export type RecipeIngredient = {
  id: string
  materialName: string
  quantity: number
  unit: RecipeIngredientUnit
  baseQuantity: number
  baseUnit: RecipeIngredientBaseUnit
  unitCost: number
}

export type RecipeMaster = {
  id: string
  code: string
  name: string
  status: RecipeMasterStatus
  createdAt: string
  updatedAt?: string
}

export type RecipeVersion = {
  id: string
  masterId: string
  versionNo: number
  status: RecipeVersionStatus
  description: string
  createdAt: string
  createdBy: string
  publishedAt?: string
  isActive: boolean
  revisionNote: string
  archivedAt?: string
}

export type RecipeManagementRecord = {
  id: string
  code: string
  recipeName: string
  recipeType: RecipeManagementType
  recipeRole: RecipeManagementRole
  parentRecipeId?: string
  productName: string
  portions: number
  firePercent: number
  status: RecipeManagementStatus
  description: string
  ingredients: RecipeIngredient[]
  createdAt: string
  updatedAt?: string
  masterId?: string
  masterCode?: string
  masterName?: string
  masterStatus?: RecipeMasterStatus
  versionNo?: number
  versionStatus?: RecipeVersionStatus
  versionDescription?: string
  createdBy?: string
  publishedAt?: string
  isActiveVersion?: boolean
  revisionNote?: string
  archivedAt?: string
  preparationMinutes?: number
  cookingMinutes?: number
  restingMinutes?: number
  totalMinutes?: number
  yieldPercent?: number
}
