import type {
  RecipeIngredientBaseUnit,
  RecipeIngredientUnit
} from './recipe-management.types'

export type IngredientSnapshot = {
  id: string
  snapshotId: string
  ingredientId: string
  materialId: string
  materialCode: string
  materialName: string
  quantity: number
  unit: RecipeIngredientUnit
  baseQuantity: number
  baseUnit: RecipeIngredientBaseUnit
  wastePercent: number
  yieldPercent: number
  unitCost: number
  totalCost: number
}

export type RecipeSnapshot = {
  id: string
  snapshotNo: string
  recipeMasterId: string
  recipeVersionId: string
  versionNo: number
  recipeCode: string
  recipeName: string
  productName: string
  productionOrderId: string
  productionOrderNo: string
  snapshotDate: string
  createdBy: string
  firePercent: number
  yieldPercent: number
  preparationMinutes: number
  cookingMinutes: number
  restingMinutes: number
  totalMinutes: number
  totalCost: number
  ingredients: IngredientSnapshot[]
  immutable: true
}

export type RecipeSnapshotCreateInput = {
  productionOrderId: string
  productionOrderNo?: string
  snapshotDate?: string
  createdBy?: string
}

export type RecipeSnapshotDiffRow = {
  area: string
  item: string
  sourceValue: string
  targetValue: string
  difference: string
}
