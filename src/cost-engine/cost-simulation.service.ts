import { percent, roundKpi, sumBy } from '../kpi-reporting/kpi.utils'
import type {
  CostComponent,
  CostComponentType,
  CostScenario,
  CostScenarioType
} from './cost-engine.types'

const SCENARIO_COMPONENTS: Record<CostScenarioType, CostComponentType[]> = {
  FIRE_INCREASE: ['WASTE'],
  PURCHASE_INCREASE: ['PURCHASING', 'RAW_MATERIAL', 'INTERMEDIATE_PRODUCT', 'FINAL_PRODUCT'],
  RAW_MATERIAL_PRICE_CHANGE: ['RAW_MATERIAL', 'INTERMEDIATE_PRODUCT', 'FINAL_PRODUCT'],
  RECIPE_CHANGE: ['RAW_MATERIAL', 'INTERMEDIATE_PRODUCT', 'FINAL_PRODUCT', 'WASTE'],
  BLAST_CHILLING_INCREASE: ['BLAST_CHILLING']
}

const SCENARIO_LABELS: Record<CostScenarioType, string> = {
  FIRE_INCREASE: 'Fire %5 artarsa',
  PURCHASE_INCREASE: 'Satin alma %10 artarsa',
  RAW_MATERIAL_PRICE_CHANGE: 'Hammadde fiyati degisirse',
  RECIPE_CHANGE: 'Recete degisirse',
  BLAST_CHILLING_INCREASE: 'Soklama maliyeti artarsa'
}

const SCENARIO_DESCRIPTIONS: Record<CostScenarioType, string> = {
  FIRE_INCREASE: 'Fire bilesenini ve fireye bagli toplam maliyeti simule eder.',
  PURCHASE_INCREASE: 'Satin alma ve stok fiyat etkisi artisi urun maliyetine yansitilir.',
  RAW_MATERIAL_PRICE_CHANGE: 'Hammadde, ara urun ve son urun girdileri ayni oranda degistirilir.',
  RECIPE_CHANGE: 'Recete girdileri ve fire tabani birlikte degistirilir.',
  BLAST_CHILLING_INCREASE: 'Soklama sureci maliyetindeki artis toplam maliyete uygulanir.'
}

const getAffectedAmount = (
  components: CostComponent[],
  affectedTypes: CostComponentType[]
) => sumBy(
  components.filter(component => affectedTypes.includes(component.type)),
  component => component.amount
)

export const createCostScenario = (
  scenarioType: CostScenarioType,
  components: CostComponent[],
  baseCost: number,
  changePercent: number
): CostScenario => {
  const affectedComponentTypes = SCENARIO_COMPONENTS[scenarioType]
  const affectedAmount = getAffectedAmount(components, affectedComponentTypes)
  const deltaAmount = roundKpi(affectedAmount * Math.max(-100, changePercent) / 100)
  const simulatedCost = roundKpi(Math.max(0, baseCost + deltaAmount))

  return {
    id: `cost-scenario-${scenarioType.toLocaleLowerCase('tr-TR')}`,
    type: scenarioType,
    label: SCENARIO_LABELS[scenarioType],
    description: SCENARIO_DESCRIPTIONS[scenarioType],
    changePercent,
    baseCost: roundKpi(baseCost),
    simulatedCost,
    deltaAmount,
    deltaPercent: percent(deltaAmount, baseCost),
    affectedComponentTypes
  }
}

export const createDefaultCostScenarios = (
  components: CostComponent[],
  baseCost: number
): CostScenario[] => [
  createCostScenario('FIRE_INCREASE', components, baseCost, 5),
  createCostScenario('PURCHASE_INCREASE', components, baseCost, 10),
  createCostScenario('RAW_MATERIAL_PRICE_CHANGE', components, baseCost, 8),
  createCostScenario('RECIPE_CHANGE', components, baseCost, -4),
  createCostScenario('BLAST_CHILLING_INCREASE', components, baseCost, 12)
]
