import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  RecipeCostSnapshotService
} from '../recipe-management/recipe-cost-snapshot.service'
import type { HistoricalCostSnapshot } from '../recipe-management/recipe-cost-snapshot.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const MAX_COST_SUGGESTIONS = 6

const groupByRecipeMaster = (
  snapshots: HistoricalCostSnapshot[]
) => {
  const groups = new Map<string, HistoricalCostSnapshot[]>()

  snapshots.forEach(snapshot => {
    const key = snapshot.recipeMasterId || snapshot.recipeVersionId || snapshot.recipeCode
    const current = groups.get(key) || []
    current.push(snapshot)
    groups.set(key, current)
  })

  return Array.from(groups.values())
}

const getLatestSnapshot = (
  snapshots: HistoricalCostSnapshot[]
) => RecipeCostSnapshotService.sortDesc(snapshots)[0] || null

const createCostTrendSuggestions = (
  groups: HistoricalCostSnapshot[][]
): DecisionSuggestion[] => groups
  .map(snapshots => {
    const latestSnapshot = getLatestSnapshot(snapshots)
    if(!latestSnapshot) return null

    const trend = RecipeCostSnapshotService.buildTrendSummary(snapshots)
    const latestVsAveragePercent = trend.averageCost > 0
      ? ((trend.latestCost - trend.averageCost) / trend.averageCost) * 100
      : 0
    const evidence = Math.max(trend.last30DayChangePercent, latestVsAveragePercent)

    return {
      snapshots,
      latestSnapshot,
      trend,
      evidence
    }
  })
  .filter((item): item is NonNullable<typeof item> => Boolean(item))
  .filter(item => item.evidence >= 10)
  .sort((first, second) => second.evidence - first.evidence)
  .slice(0, MAX_COST_SUGGESTIONS)
  .map(item => createDecisionSuggestion({
    category: 'Production',
    title: `${item.latestSnapshot.productName || item.latestSnapshot.recipeName} maliyet trendi artıyor`,
    description: 'Historical Cost Snapshot son maliyet ve ortalama maliyet arasinda anlamli artis tespit etti.',
    reason: `Son maliyet ${formatCurrency(item.trend.latestCost)}, ortalama ${formatCurrency(item.trend.averageCost)}, son 30 gun degisimi ${formatPercent(item.trend.last30DayChangePercent)}.`,
    ruleId: 'historical-cost-snapshot-trend',
    relatedEntityType: 'HistoricalCostSnapshot',
    relatedEntityId: item.latestSnapshot.id,
    relatedProductId: item.latestSnapshot.recipeVersionId,
    relatedWorkOrderId: item.latestSnapshot.productionOrderId,
    evidenceScore: Math.min(30, Math.max(8, item.evidence)),
    createdAt: item.latestSnapshot.snapshotDate,
    recommendationAction: 'Hammadde, iscilik, enerji ve fire bilesenlerini maliyet kontrol toplantisinda manuel incele.',
    expectedImpact: 'Gecmis maliyet snapshotlari degismeden kalirken yeni fiyat etkisinin karar destek seviyesinde izlenmesini saglar.',
    ownerRole: 'Maliyet Kontrol'
  }))

const createCriticalDeviationSuggestions = (
  groups: HistoricalCostSnapshot[][]
): DecisionSuggestion[] => groups
  .map(snapshots => {
    const latestSnapshot = getLatestSnapshot(snapshots)
    if(!latestSnapshot) return null

    const trend = RecipeCostSnapshotService.buildTrendSummary(snapshots)
    const deviationPercent = trend.averageCost > 0
      ? ((trend.latestCost - trend.averageCost) / trend.averageCost) * 100
      : 0

    return {
      latestSnapshot,
      trend,
      deviationPercent
    }
  })
  .filter((item): item is NonNullable<typeof item> => Boolean(item))
  .filter(item => item.deviationPercent >= 22 || item.trend.last30DayChangePercent >= 18)
  .sort((first, second) => Math.max(second.deviationPercent, second.trend.last30DayChangePercent) - Math.max(first.deviationPercent, first.trend.last30DayChangePercent))
  .slice(0, MAX_COST_SUGGESTIONS)
  .map(item => createDecisionSuggestion({
    category: 'Production',
    title: `${item.latestSnapshot.productName || item.latestSnapshot.recipeName} kritik maliyet sapması`,
    description: 'Historical Cost Snapshot ortalamaya gore kritik maliyet sapmasi tespit etti.',
    reason: `Son maliyet ${formatCurrency(item.trend.latestCost)}, ortalama ${formatCurrency(item.trend.averageCost)}, sapma ${formatPercent(item.deviationPercent)}.`,
    ruleId: 'historical-cost-critical-deviation',
    relatedEntityType: 'HistoricalCostSnapshot',
    relatedEntityId: item.latestSnapshot.id,
    relatedProductId: item.latestSnapshot.recipeVersionId,
    relatedWorkOrderId: item.latestSnapshot.productionOrderId,
    evidenceScore: Math.min(30, Math.max(12, item.deviationPercent, item.trend.last30DayChangePercent)),
    createdAt: item.latestSnapshot.snapshotDate,
    recommendationAction: 'Yeni uretim planlari icin maliyet sapmasini manuel onay surecine tasimadan once bilesen bazli analiz et.',
    expectedImpact: 'Kritik maliyet sapmalarinin raporlari geriye donuk bozmadan erken gorunmesini saglar.',
    ownerRole: 'Maliyet Kontrol'
  }))

export const createHistoricalCostDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const snapshots = RecipeCostSnapshotService.load(sourceData.recipeRecords)
  const groups = groupByRecipeMaster(snapshots).filter(group => group.length >= 2)

  return [
    ...createCostTrendSuggestions(groups),
    ...createCriticalDeviationSuggestions(groups)
  ]
}
