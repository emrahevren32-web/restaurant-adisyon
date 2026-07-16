export type RecipeManagementType =
  | 'Ana Ürün'
  | 'Ara Ürün'

export type RecipeManagementStatus =
  | 'Aktif'
  | 'Pasif'

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

export type RecipeIngredient = {
  id: string
  materialName: string
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
