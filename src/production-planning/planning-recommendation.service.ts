import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type {
  ProductionPlan,
  ProductionPlanItem
} from './production-planning.types'

const SHORTAGE_THRESHOLD = 0.01

export const createPlanItemRecommendations = (
  item: ProductionPlanItem
) => {
  const recommendations: string[] = []
  const requiredWithSafety = item.demandQuantity + item.safetyStock
  const shortage = Math.max(0, requiredWithSafety - item.currentStock - item.pendingProduction)

  if(shortage > SHORTAGE_THRESHOLD){
    recommendations.push(`${item.productName} icin ${formatNumber(shortage, 1)} ${item.unit} eksik uretim planlanmali.`)
  }

  if(item.currentStock > requiredWithSafety * 1.6 && requiredWithSafety > 0){
    recommendations.push(`${item.productName} icin fazla uretim riski var; mevcut stok talebin uzerinde.`)
  }

  if(item.wastePercent >= 7){
    recommendations.push(`Fire orani ${formatPercent(item.wastePercent)} oldugu icin planlanan uretim revize edilmeli.`)
  }

  if(item.capacityUsagePercent >= 90){
    recommendations.push(`${item.productionLineName} kapasite kullanimi yuksek; sonraki faz kapasite planlama icin izlenmeli.`)
  }

  if(item.produceQuantity > 0 && item.priority === 'CRITICAL'){
    recommendations.push(`${item.productName} kritik oncelikte uretilmeli.`)
  }

  return recommendations
}

export const createPlanRecommendations = (
  plan: ProductionPlan
) => {
  const recommendations = new Set<string>()
  const criticalItems = plan.items.filter(item => item.priority === 'CRITICAL')
  const highWasteItems = plan.items.filter(item => item.wastePercent >= 7)
  const unplannedDemand = plan.items.filter(item => item.produceQuantity <= 0 && item.demandQuantity > item.currentStock + item.pendingProduction)

  if(criticalItems.length > 0){
    recommendations.add(`${formatNumber(criticalItems.length)} kritik stok icin uretim onceligi verilmeli.`)
  }

  if(highWasteItems.length > 0){
    recommendations.add(`${formatNumber(highWasteItems.length)} urunde fire orani plan miktarini etkiliyor.`)
  }

  if(unplannedDemand.length > 0){
    recommendations.add(`${unplannedDemand[0].productName} talebi mevcut plana gore karsilanamiyor.`)
  }

  plan.items.flatMap(item => item.recommendations).forEach(recommendation => recommendations.add(recommendation))

  return Array.from(recommendations).slice(0, 8)
}

export const PlanningRecommendationService = {
  createItemRecommendations: createPlanItemRecommendations,
  createPlanRecommendations
}
