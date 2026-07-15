export type RecipeManagementType =
  | 'Ana Ürün'
  | 'Ara Ürün'

export type RecipeManagementStatus =
  | 'Aktif'
  | 'Pasif'

export type RecipeIngredientUnit =
  | 'kg'
  | 'gr'
  | 'lt'
  | 'ml'
  | 'adet'
  | 'paket'
  | 'koli'

export type RecipeIngredient = {
  id: string
  rawMaterial: string
  quantity: number
  unit: RecipeIngredientUnit
}

export type RecipeManagementRecord = {
  id: string
  code: string
  recipeName: string
  recipeType: RecipeManagementType
  productName: string
  portions: number
  status: RecipeManagementStatus
  description: string
  ingredients: RecipeIngredient[]
  createdAt: string
  updatedAt?: string
}
