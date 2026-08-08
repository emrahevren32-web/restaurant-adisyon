import type { RecipeIngredientBaseUnit } from './recipe-management.types'

export type CostSnapshotCurrency =
  | 'TRY'
  | 'USD'
  | 'EUR'

export type IngredientCostSnapshot = {
  id: string
  costSnapshotId: string
  ingredientId: string
  materialId: string
  materialCode: string
  materialName: string
  quantity: number
  unit: RecipeIngredientBaseUnit
  unitPrice: number
  currency: CostSnapshotCurrency
  lineTotal: number
  supplier: string
  priceDate: string
}

export type HistoricalCostSnapshot = {
  id: string
  snapshotNo: string
  recipeSnapshotId: string
  recipeMasterId: string
  recipeVersionId: string
  versionNo: number
  recipeCode: string
  recipeName: string
  productName: string
  productionOrderId: string
  productionOrderNo: string
  snapshotDate: string
  currency: CostSnapshotCurrency
  totalMaterialCost: number
  totalLaborCost: number
  totalEnergyCost: number
  totalPackagingCost: number
  totalLogisticsCost: number
  totalWasteCost: number
  totalOverheadCost: number
  grandTotalCost: number
  unitCost: number
  createdBy: string
  ingredients: IngredientCostSnapshot[]
  immutable: true
}

export type HistoricalCostSnapshotCreateInput = {
  snapshotDate?: string
  createdBy?: string
  currency?: CostSnapshotCurrency
}

export type HistoricalCostSnapshotDiffRow = {
  area: string
  sourceValue: string
  targetValue: string
  absoluteDifference: string
  percentDifference: string
}

export type HistoricalCostTrendPoint = {
  label: string
  dateKey: string
  value: number
  formattedValue: string
}

export type HistoricalCostTrendSummary = {
  latestCost: number
  averageCost: number
  highestCost: number
  lowestCost: number
  latestUnitCost: number
  averageUnitCost: number
  last30DayChangePercent: number
  daily: HistoricalCostTrendPoint[]
  weekly: HistoricalCostTrendPoint[]
  monthly: HistoricalCostTrendPoint[]
}
