import {
  KPI_COLORS,
  createBarRows,
  createTrend,
  formatCurrency,
  formatPercent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import type {
  WasteAnalysis,
  WasteRecord
} from './waste.types'

const activeRecords = (
  records: WasteRecord[]
) => records.filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED')

const createGroupedRows = (
  records: WasteRecord[],
  getKey: (record: WasteRecord) => string,
  getLabel: (record: WasteRecord) => string,
  metric: 'quantity' | 'cost' = 'quantity'
) => createBarRows(
  Array.from(records.reduce<Map<string, { label: string; quantity: number; cost: number; count: number }>>((map, record) => {
    const key = getKey(record)
    if(!key) return map
    const current = map.get(key) || { label: getLabel(record), quantity: 0, cost: 0, count: 0 }
    map.set(key, {
      label: current.label,
      quantity: roundKpi(current.quantity + record.quantity),
      cost: roundKpi(current.cost + record.totalCost),
      count: current.count + 1
    })
    return map
  }, new Map()).entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: metric === 'cost' ? row.cost : row.quantity,
      detail: `${formatCurrency(row.cost)} / ${row.count} kayit`
    })),
  8
)

const createRecommendations = (
  records: WasteRecord[],
  analysis: Pick<WasteAnalysis, 'topProducts' | 'topRecipes' | 'topSuppliers' | 'costRows'>
) => {
  const recommendations: string[] = []
  const totalCost = records.reduce((total, record) => total + record.totalCost, 0)
  const blastChillingCount = records.filter(record => record.wasteType === 'BLAST_CHILLING').length
  const warehouseLeader = createGroupedRows(records, record => record.warehouseId, record => record.warehouseName)[0]

  if(analysis.topProducts[0]){
    recommendations.push(`${analysis.topProducts[0].label} urununde fire trendi izlenmeli.`)
  }
  if(analysis.topRecipes[0]){
    recommendations.push(`${analysis.topRecipes[0].label} recetesi fire toleransi acisindan revize edilmeli.`)
  }
  if(analysis.topSuppliers[0]){
    recommendations.push(`${analysis.topSuppliers[0].label} supplier kaynakli fire icin kalite gorusmesi acilmali.`)
  }
  if(totalCost > 0){
    recommendations.push(`Fire maliyet etkisi ${formatCurrency(totalCost)} seviyesinde; Cost Engine bileseni izlenmeli.`)
  }
  if(blastChillingCount > 0){
    recommendations.push('Soklama sureci sicaklik ve bekleme suresi acisindan gozden gecirilmeli.')
  }
  if(warehouseLeader){
    recommendations.push(`${warehouseLeader.label} deposunda fire orani ortalamanin uzerinde olabilir.`)
  }

  return recommendations.slice(0, 6)
}

export const createWasteAnalysis = (
  records: WasteRecord[],
  productionQuantity: number
): WasteAnalysis => {
  const usableRecords = activeRecords(records)
  const topProducts = createGroupedRows(usableRecords, record => record.productId || record.stockItemId, record => record.productName || record.stockItemName)
  const topRecipes = createGroupedRows(usableRecords, record => record.recipeId || record.recipeName, record => record.recipeName || 'Recete Yok')
  const topSuppliers = createGroupedRows(usableRecords, record => record.supplierId || record.supplierName, record => record.supplierName || 'Supplier Yok')
  const costRows = createGroupedRows(usableRecords, record => record.wasteType, record => record.wasteType, 'cost')
  const trend = createTrend(usableRecords, 'YEAR', record => record.date, record => record.quantity, 'Fire Trend', KPI_COLORS[4])
  const totalQuantity = usableRecords.reduce((total, record) => total + record.quantity, 0)
  const wasteRate = productionQuantity > 0 ? (totalQuantity / productionQuantity) * 100 : 0
  const analysis = {
    topProducts,
    topRecipes,
    topSuppliers,
    costRows,
    trend,
    recommendations: [] as string[]
  }

  return {
    ...analysis,
    recommendations: [
      ...createRecommendations(usableRecords, analysis),
      `Fire orani ${formatPercent(wasteRate)} olarak hesaplandi.`
    ].slice(0, 7)
  }
}

export const WasteAnalysisService = {
  create: createWasteAnalysis
}
