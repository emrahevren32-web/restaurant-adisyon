import type {
  RecipeIngredientBaseUnit,
  RecipeIngredientUnit
} from './recipe-management.types'

export type AlternativeMaterialStatus =
  | 'Aktif'
  | 'Pasif'

export type AlternativeMaterialApprovalStatus =
  | 'Taslak'
  | 'İncelemede'
  | 'Onaylandı'
  | 'Reddedildi'

export type AlternativeMaterialSubstitutionMode =
  | 'Aynı Gramaj'
  | 'Katsayılı Gramaj'

export type AlternativeMaterialRule = {
  substitutionMode: AlternativeMaterialSubstitutionMode
  maxUsagePercent: number
  minimumQualityScore: number
  allergenCheck: boolean
  haccpCompliant: boolean
}

export type AlternativeMaterial = {
  id: string
  groupId: string
  ingredientId: string
  materialId: string
  materialCode: string
  materialName: string
  priority: number
  substitutionRatio: number
  unit: RecipeIngredientUnit
  baseUnit: RecipeIngredientBaseUnit
  currentQuantity: number
  alternativeQuantity: number
  currentUnitCost: number
  alternativeUnitCost: number
  currentCost: number
  alternativeCost: number
  costDifference: number
  costDifferencePercent: number
  qualityScore: number
  status: AlternativeMaterialStatus
  approvalStatus: AlternativeMaterialApprovalStatus
  notes: string
  rule: AlternativeMaterialRule
  createdAt: string
  updatedAt?: string
}

export type AlternativeMaterialGroup = {
  id: string
  recipeId: string
  recipeMasterId: string
  recipeVersionId: string
  recipeCode: string
  recipeName: string
  ingredientId: string
  primaryMaterialName: string
  primaryUnit: RecipeIngredientUnit
  primaryBaseUnit: RecipeIngredientBaseUnit
  primaryQuantity: number
  primaryBaseQuantity: number
  primaryUnitCost: number
  primaryCost: number
  status: AlternativeMaterialStatus
  alternatives: AlternativeMaterial[]
  createdAt: string
  updatedAt?: string
}

export type AlternativeMaterialCostComparison = {
  id: string
  groupId: string
  alternativeId: string
  recipeCode: string
  recipeName: string
  primaryMaterialName: string
  alternativeMaterialName: string
  currentCost: number
  alternativeCost: number
  costDifference: number
  costDifferencePercent: number
  qualityScore: number
  approvalStatus: AlternativeMaterialApprovalStatus
}
