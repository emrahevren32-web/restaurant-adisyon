import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  RecipeCostSimulationService
} from '../recipe-management/recipe-cost-simulation.service'
import type { RecipeCostSimulation } from '../recipe-management/recipe-cost-simulation.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const MAX_SIMULATION_SUGGESTIONS = 6

const getTopSimulations = (
  simulations: RecipeCostSimulation[],
  predicate: (simulation: RecipeCostSimulation) => boolean,
  getScore: (simulation: RecipeCostSimulation) => number
) => simulations
  .filter(predicate)
  .sort((first, second) => getScore(second) - getScore(first))
  .slice(0, MAX_SIMULATION_SUGGESTIONS)

const createSavingsSuggestions = (
  simulations: RecipeCostSimulation[]
): DecisionSuggestion[] => getTopSimulations(
  simulations,
  simulation => simulation.output.savingsOpportunity >= 500 || simulation.output.differencePercent <= -4,
  simulation => Math.abs(simulation.output.differencePercent) + (simulation.output.savingsOpportunity / 1000)
).map(simulation => createDecisionSuggestion({
  category: 'Production',
  title: `${simulation.productName || simulation.recipeName} simülasyon tasarruf fırsatı`,
  description: 'Recipe Cost Simulation what-if sonucu manuel tasarruf fırsatı üretti.',
  reason: `Simülasyon farkı ${formatCurrency(simulation.output.difference)}, tasarruf potansiyeli ${formatCurrency(simulation.output.savingsOpportunity)}, fark ${formatPercent(simulation.output.differencePercent)}.`,
  ruleId: 'recipe-cost-simulation-savings',
  relatedEntityType: 'RecipeCostSimulation',
  relatedEntityId: simulation.id,
  relatedProductId: simulation.recipeVersionId,
  evidenceScore: Math.min(30, Math.max(8, Math.abs(simulation.output.differencePercent) + simulation.output.savingsOpportunity / 1000)),
  createdAt: simulation.createdDate,
  recommendationAction: 'Simülasyon sonucunu reçete sahibi, satın alma ve maliyet kontrol ile manuel değerlendir.',
  expectedImpact: 'Gerçek reçete veya stok verisini değiştirmeden tasarruf senaryosunu karar destek seviyesinde görünür kılar.',
  ownerRole: 'Maliyet Kontrol'
}))

const createCostIncreaseSuggestions = (
  simulations: RecipeCostSimulation[]
): DecisionSuggestion[] => getTopSimulations(
  simulations,
  simulation => simulation.output.differencePercent >= 8 || simulation.output.difference >= 1000,
  simulation => simulation.output.differencePercent + simulation.output.difference / 1000
).map(simulation => createDecisionSuggestion({
  category: 'Production',
  title: `${simulation.productName || simulation.recipeName} simülasyon maliyet artışı`,
  description: 'Recipe Cost Simulation what-if sonucu kritik maliyet artışı gösterdi.',
  reason: `Simülasyon yeni maliyeti ${formatCurrency(simulation.output.simulatedTotalCost)}, mevcut maliyet ${formatCurrency(simulation.output.currentTotalCost)}, fark ${formatPercent(simulation.output.differencePercent)}.`,
  ruleId: 'recipe-cost-simulation-cost-increase',
  relatedEntityType: 'RecipeCostSimulation',
  relatedEntityId: simulation.id,
  relatedProductId: simulation.recipeVersionId,
  evidenceScore: Math.min(30, Math.max(10, simulation.output.differencePercent + simulation.output.difference / 1000)),
  createdAt: simulation.createdDate,
  recommendationAction: 'Maliyet artışı senaryosunu üretim, satın alma ve fiyatlama etkisi açısından manuel incele.',
  expectedImpact: 'Olası maliyet artışını gerçek üretim veya satın alma akışı başlamadan görünür kılar.',
  ownerRole: 'Maliyet Kontrol'
}))

export const createRecipeCostSimulationDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const simulations = RecipeCostSimulationService.load(sourceData.recipeRecords)

  return [
    ...createSavingsSuggestions(simulations),
    ...createCostIncreaseSuggestions(simulations)
  ]
}
