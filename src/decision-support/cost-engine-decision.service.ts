import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import type { CostEngine } from '../cost-engine/cost-engine.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatPercent,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const limitByRisk = (records: CostEngine[], getRiskValue: (record: CostEngine) => number) => (
  [...records]
    .sort((first, second) => getRiskValue(second) - getRiskValue(first))
    .slice(0, 6)
)

const getRawMaterialIncreasePercent = (record: CostEngine) => (
  roundKpi(Math.max(record.breakdown.purchasePercent, percent(record.purchaseImpact, record.standardCost)))
)

const createRawMaterialIncreaseSuggestions = (
  records: CostEngine[]
): DecisionSuggestion[] => limitByRisk(
  records.filter(record => getRawMaterialIncreasePercent(record) >= 18),
  getRawMaterialIncreasePercent
).map(record => {
  const increasePercent = getRawMaterialIncreasePercent(record)

  return createDecisionSuggestion({
    category: 'Production',
    title: `${record.productName} hammadde maliyeti artti`,
    description: 'Cost Engine satin alma ve hammadde fiyat etkisini yuksek buldu.',
    reason: `Hammadde maliyeti ${formatPercent(increasePercent)} artti; satin alma etkisi ${formatCurrency(record.purchaseImpact)}.`,
    ruleId: 'cost-engine-raw-material-increase',
    relatedEntityType: 'CostEngine',
    relatedEntityId: record.id,
    relatedLotId: record.lotId,
    relatedProductId: record.productId,
    branchId: record.branchId,
    warehouseId: record.warehouseId,
    evidenceScore: Math.min(30, increasePercent),
    createdAt: record.calculationDate,
    recommendationAction: 'Alternatif tedarikci, fiyat kilitleme veya recete ikamesi icin satin alma analizi baslat.',
    expectedImpact: 'Hammadde maliyet artisinin urun birim maliyetine etkisini dusurur.',
    ownerRole: 'Uretim ve Satin Alma'
  })
})

const createRecipeRevisionSuggestions = (
  records: CostEngine[]
): DecisionSuggestion[] => limitByRisk(
  records.filter(record => record.firePercent >= 5 || record.breakdown.firePercent >= 7),
  record => Math.max(record.firePercent, record.breakdown.firePercent)
).map(record => {
  const evidence = Math.max(record.firePercent, record.breakdown.firePercent)

  return createDecisionSuggestion({
    category: 'Production',
    title: `${record.productName} recetesi revize edilmeli`,
    description: 'Cost Engine recete fire veya maliyet payini yuksek buldu.',
    reason: `Bu urunun recetesi revize edilmeli; fire etkisi ${formatPercent(record.breakdown.firePercent)}, standart fire ${formatPercent(record.firePercent)}.`,
    ruleId: 'cost-engine-recipe-revision',
    relatedEntityType: 'CostEngine',
    relatedEntityId: record.id,
    relatedLotId: record.lotId,
    relatedProductId: record.productId,
    branchId: record.branchId,
    warehouseId: record.warehouseId,
    evidenceScore: Math.min(30, evidence * 2),
    createdAt: record.calculationDate,
    recommendationAction: 'Recete gramaji, fire toleransi ve proses adimlarini uretim sorumlusu ile yeniden degerlendir.',
    expectedImpact: 'Fire kaynakli maliyet sapmasini ve kg maliyetini azaltir.',
    ownerRole: 'Uretim'
  })
})

const createFireCostSuggestions = (
  records: CostEngine[]
): DecisionSuggestion[] => limitByRisk(
  records.filter(record => record.breakdown.firePercent >= 7),
  record => record.breakdown.firePercent
).map(record => createDecisionSuggestion({
  category: 'Production',
  title: `${record.productName} fire maliyet etkisi yuksek`,
  description: 'Cost Engine fire component payini karar destek esiginin uzerinde buldu.',
  reason: `Fire nedeniyle maliyet ${formatPercent(record.breakdown.firePercent)} yukseldi; fire etkisi ${formatCurrency(record.fireImpact)}.`,
  ruleId: 'cost-engine-fire-cost',
  relatedEntityType: 'CostEngine',
  relatedEntityId: record.id,
  relatedLotId: record.lotId,
  relatedProductId: record.productId,
  branchId: record.branchId,
  warehouseId: record.warehouseId,
  evidenceScore: Math.min(30, record.breakdown.firePercent * 2),
  createdAt: record.calculationDate,
  recommendationAction: 'Fire kok neden analizi ac ve operator, lot, recete sapmasi kirilimini kontrol et.',
  expectedImpact: 'Fire maliyet payini dusurerek toplam urun maliyetini stabilize eder.',
  ownerRole: 'Uretim'
}))

export const createCostEngineDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const view = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const records = view.records

  return [
    ...createRawMaterialIncreaseSuggestions(records),
    ...createRecipeRevisionSuggestions(records),
    ...createFireCostSuggestions(records)
  ]
}
