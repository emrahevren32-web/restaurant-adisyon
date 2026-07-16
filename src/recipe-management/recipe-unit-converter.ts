import type {
  RecipeIngredient,
  RecipeIngredientBaseUnit,
  RecipeIngredientUnit
} from './recipe-management.types'

export type RecipeBaseConversion = {
  baseQuantity: number
  baseUnit: RecipeIngredientBaseUnit
}

const IDENTITY_CONVERSION_FACTOR = 1
const WEIGHT_UNIT_FACTOR = 1000
const VOLUME_UNIT_FACTOR = 1000

const BASE_UNIT_BY_UNIT: Record<RecipeIngredientUnit, RecipeIngredientBaseUnit> = {
  gr: 'gr',
  kg: 'gr',
  ml: 'ml',
  lt: 'ml',
  adet: 'adet',
  paket: 'paket',
  koli: 'koli',
  çuval: 'çuval',
  kasa: 'kasa'
}

const BASE_QUANTITY_FACTOR_BY_UNIT: Record<RecipeIngredientUnit, number> = {
  gr: IDENTITY_CONVERSION_FACTOR,
  kg: WEIGHT_UNIT_FACTOR,
  ml: IDENTITY_CONVERSION_FACTOR,
  lt: VOLUME_UNIT_FACTOR,
  adet: IDENTITY_CONVERSION_FACTOR,
  paket: IDENTITY_CONVERSION_FACTOR,
  koli: IDENTITY_CONVERSION_FACTOR,
  çuval: IDENTITY_CONVERSION_FACTOR,
  kasa: IDENTITY_CONVERSION_FACTOR
}

export const convertToBaseUnit = (
  quantity: number,
  unit: RecipeIngredientUnit
): RecipeBaseConversion => {
  const numericQuantity = Number(quantity)
  const safeQuantity = Number.isFinite(numericQuantity) ? numericQuantity : 0

  return {
    baseQuantity: safeQuantity * BASE_QUANTITY_FACTOR_BY_UNIT[unit],
    baseUnit: BASE_UNIT_BY_UNIT[unit]
  }
}

export const calculateTotalBaseQuantity = (
  ingredients: RecipeIngredient[],
  baseUnit: RecipeIngredientBaseUnit
) => (
  ingredients.reduce((sum, ingredient) => (
    ingredient.baseUnit === baseUnit ? sum + ingredient.baseQuantity : sum
  ), 0)
)
