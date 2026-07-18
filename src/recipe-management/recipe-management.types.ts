export type RecipeManagementType =
  | 'Ana Ürün'
  | 'Ara Ürün'

export type RecipeManagementStatus =
  | 'Aktif'
  | 'Pasif'

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
}
