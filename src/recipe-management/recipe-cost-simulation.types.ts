import type { CostSnapshotCurrency } from './recipe-cost-snapshot.types'

export type RecipeCostSimulationStatus =
  | 'Taslak'
  | 'Kaydedildi'
  | 'İncelemede'
  | 'Arşiv'

export type RecipeCostScenarioType =
  | 'Hammadde fiyatı arttı'
  | 'Hammadde fiyatı düştü'
  | 'Alternatif hammadde kullanıldı'
  | 'Fire oranı değişti'
  | 'Yield değişti'
  | 'İşçilik maliyeti değişti'
  | 'Enerji maliyeti değişti'
  | 'Paketleme maliyeti değişti'
  | 'Genel gider değişti'

export type RecipeCostScenario = {
  id: string
  simulationId: string
  type: RecipeCostScenarioType
  ingredientId?: string
  materialId?: string
  materialName?: string
  alternativeMaterialId?: string
  alternativeMaterialName?: string
  changePercent?: number
  targetValue?: number
  multiplier?: number
  notes: string
}

export type RecipeCostSimulationBreakdown = {
  id: string
  label: string
  value: number
  percent: number
}

export type RecipeCostSimulationMaterialBreakdown = {
  ingredientId: string
  materialName: string
  currentCost: number
  simulatedCost: number
  difference: number
  differencePercent: number
}

export type RecipeCostSimulationOutput = {
  currentUnitCost: number
  simulatedUnitCost: number
  currentTotalCost: number
  simulatedTotalCost: number
  difference: number
  differencePercent: number
  expectedProfitability: number
  expectedFireImpact: number
  expectedYield: number
  savingsOpportunity: number
  simulatedMaterialCost: number
  simulatedLaborCost: number
  simulatedEnergyCost: number
  simulatedPackagingCost: number
  simulatedLogisticsCost: number
  simulatedWasteCost: number
  simulatedOverheadCost: number
  materialBreakdown: RecipeCostSimulationMaterialBreakdown[]
  costDistribution: RecipeCostSimulationBreakdown[]
}

export type RecipeCostSimulation = {
  id: string
  recipeMasterId: string
  recipeVersionId: string
  recipeCode: string
  recipeName: string
  productName: string
  baselineCostSnapshotId: string
  simulationName: string
  createdBy: string
  createdDate: string
  status: RecipeCostSimulationStatus
  notes: string
  currency: CostSnapshotCurrency
  scenarios: RecipeCostScenario[]
  output: RecipeCostSimulationOutput
}

export type RecipeCostSimulationCreateInput = {
  simulationName: string
  createdBy?: string
  createdDate?: string
  status?: RecipeCostSimulationStatus
  notes?: string
  scenarios: Array<Omit<RecipeCostScenario, 'id' | 'simulationId'>>
}

export type RecipeCostSimulationCompareRow = {
  area: string
  currentValue: string
  simulatedValue: string
  difference: string
  differencePercent: string
  tone: 'success' | 'danger' | 'neutral'
}

export type RecipeCostSimulationTrendPoint = {
  label: string
  dateKey: string
  value: number
  formattedValue: string
}
