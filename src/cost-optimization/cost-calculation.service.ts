import { roundKpi } from '../kpi-reporting/kpi.utils'
import type {
  CostOptimizationPriority,
  CostOptimizationRisk
} from './cost-optimization.types'

const clamp = (
  value: number,
  min = 0,
  max = 100
) => Math.max(min, Math.min(max, value))

export const mapCostRisk = (
  riskScore: number
): CostOptimizationRisk => {
  if(riskScore >= 85) return 'CRITICAL'
  if(riskScore >= 65) return 'HIGH'
  if(riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

export const mapCostPriority = (
  riskScore: number,
  savingPotential: number,
  confidenceScore: number
): CostOptimizationPriority => {
  const score = riskScore * 0.45 + Math.min(100, savingPotential / 1000) * 0.35 + confidenceScore * 0.2
  if(score >= 82) return 'URGENT'
  if(score >= 62) return 'HIGH'
  if(score >= 35) return 'NORMAL'
  return 'LOW'
}

export const calculateSavingPotential = (
  baselineCost: number,
  savingRate: number,
  minimumSaving = 0
) => roundKpi(Math.max(minimumSaving, Math.max(0, baselineCost) * clamp(savingRate, 0, 80) / 100))

export const calculateRoiEstimate = (
  annualGain: number,
  implementationCost: number
) => {
  if(implementationCost <= 0) return annualGain > 0 ? 100 : 0
  return roundKpi(Math.max(0, (annualGain - implementationCost) / implementationCost * 100))
}

export const calculateCostRiskScore = (
  costWeight: number,
  trendScore: number,
  volatilityScore = 0
) => roundKpi(clamp(costWeight * 0.5 + trendScore * 0.35 + volatilityScore * 0.15))

export const calculateConfidenceScore = (
  sourceCount: number,
  evidenceScore: number,
  sampleSize = 1
) => roundKpi(clamp(48 + Math.min(22, sourceCount * 4) + Math.min(18, sampleSize * 1.4) + Math.min(12, evidenceScore * 0.18)))

export const CostCalculationService = {
  mapRisk: mapCostRisk,
  mapPriority: mapCostPriority,
  calculateSavingPotential,
  calculateRoiEstimate,
  calculateRiskScore: calculateCostRiskScore,
  calculateConfidenceScore
}
