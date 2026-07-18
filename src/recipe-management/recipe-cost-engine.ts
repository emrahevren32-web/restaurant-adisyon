import type {
  RecipeIngredient,
  RecipeManagementRecord
} from './recipe-management.types'
import { calculateFireCost } from './recipe-fire-engine'

export type RecipeIngredientCostLine = {
  ingredientId: string
  materialName: string
  baseQuantity: number
  baseUnit: string
  unitCost: number
  cost: number
}

export type RecipeCostCalculation = {
  ingredientCost: RecipeIngredientCostLine[]
  baseRecipeCost: number
  fireAmount: number
  recipeCost: number
  portionCost: number
}

const ZERO_COST = 0
const MONEY_DECIMAL_FACTOR = 100
const TL_SUFFIX = ' TL'

const toNonNegativeNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : ZERO_COST
}

const roundCost = (value: number) => (
  Math.round((value + Number.EPSILON) * MONEY_DECIMAL_FACTOR) / MONEY_DECIMAL_FACTOR
)

const calculateIngredientCost = (ingredient: RecipeIngredient): RecipeIngredientCostLine => {
  const baseQuantity = toNonNegativeNumber(ingredient.baseQuantity)
  const unitCost = toNonNegativeNumber(ingredient.unitCost)

  return {
    ingredientId: ingredient.id,
    materialName: ingredient.materialName,
    baseQuantity,
    baseUnit: ingredient.baseUnit,
    unitCost,
    cost: roundCost(baseQuantity * unitCost)
  }
}

export const calculateRecipeCost = (recipe: RecipeManagementRecord): RecipeCostCalculation => {
  const ingredientCost = recipe.ingredients.map(calculateIngredientCost)
  const baseRecipeCost = roundCost(ingredientCost.reduce((sum, ingredient) => sum + ingredient.cost, ZERO_COST))
  const fireCost = calculateFireCost(baseRecipeCost, recipe.firePercent)
  const recipeCost = fireCost.effectiveCost
  const portions = toNonNegativeNumber(recipe.portions)

  return {
    ingredientCost,
    baseRecipeCost,
    fireAmount: fireCost.fireAmount,
    recipeCost,
    portionCost: portions > ZERO_COST ? roundCost(recipeCost / portions) : ZERO_COST
  }
}

export const formatRecipeCostAmount = (value: number) => {
  const numericValue = Number(value)
  const safeValue = Number.isFinite(numericValue) ? numericValue : ZERO_COST

  return `${safeValue.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}${TL_SUFFIX}`
}
