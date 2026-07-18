export type RecipeFireCalculation = {
  effectiveCost: number
  fireAmount: number
}

const ZERO_AMOUNT = 0
const MAX_FIRE_PERCENT = 100
const PERCENT_DIVISOR = 100
const MONEY_DECIMAL_FACTOR = 100

const toNonNegativeNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > ZERO_AMOUNT ? numericValue : ZERO_AMOUNT
}

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * MONEY_DECIMAL_FACTOR) / MONEY_DECIMAL_FACTOR
)

const toFirePercent = (value: unknown) => (
  Math.min(MAX_FIRE_PERCENT, toNonNegativeNumber(value))
)

export const calculateFireCost = (
  baseCost: number,
  firePercent: number
): RecipeFireCalculation => {
  const safeBaseCost = toNonNegativeNumber(baseCost)
  const safeFirePercent = toFirePercent(firePercent)
  const fireAmount = roundMoney(safeBaseCost * (safeFirePercent / PERCENT_DIVISOR))

  return {
    fireAmount,
    effectiveCost: roundMoney(safeBaseCost + fireAmount)
  }
}
