import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { percent } from '../kpi-reporting/kpi.utils'
import { createDecisionSuggestion } from './recommendation-engine.service'
import type { DecisionSuggestion } from './decision-support.types'
import {
  getDateKey,
  getTodayKey,
  isActiveShipmentPlan
} from './decision-support.utils'

const MAX_ENTITY_SUGGESTIONS = 8

const getVehicleUtilization = (vehicle: ShipmentVehicleRecord) => (
  vehicle.maxWeight > 0 ? percent(vehicle.currentWeight, vehicle.maxWeight) : 0
)

const createLowUtilizationSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.shipmentVehicles
  .filter(vehicle => vehicle.loads.length > 0 && getVehicleUtilization(vehicle) < 50)
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(vehicle => {
    const utilization = getVehicleUtilization(vehicle)
    return createDecisionSuggestion({
      category: 'Shipment',
      title: `Dusuk arac dolulugu: ${vehicle.vehicleNo}`,
      description: 'Arac doluluk orani verimsiz sevkiyat seviyesinde.',
      reason: `Doluluk ${utilization.toLocaleString('tr-TR')}%, yuk ${vehicle.currentWeight} / ${vehicle.maxWeight} kg.`,
      ruleId: 'shipment-low-utilization',
      relatedEntityType: 'ShipmentVehicle',
      relatedEntityId: vehicle.id,
      evidenceScore: Math.min(30, 50 - utilization),
      createdAt: vehicle.updatedAt || vehicle.createdAt,
      recommendationAction: 'Ayni rota veya sube icin arac birlestirme ve palet konsolidasyonu degerlendir.',
      expectedImpact: 'Sevkiyat maliyetini ve dusuk kapasite kullanimini azaltir.',
      ownerRole: 'Sevkiyat'
    })
  })

const createDelayedShipmentSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.shipmentPlans
  .filter(plan => isActiveShipmentPlan(plan) && getDateKey(plan.planDate) < getTodayKey())
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(plan => createDecisionSuggestion({
    category: 'Shipment',
    title: `Geciken sevkiyat plani: ${plan.shipmentPlanNo}`,
    description: 'Plan tarihi gecmis ve sevkiyat halen aktif durumda.',
    reason: `Plan date ${plan.planDate}, status ${plan.status}, stop count ${plan.stops.length}.`,
    ruleId: 'shipment-delay-revision',
    relatedEntityType: 'ShipmentPlan',
    relatedEntityId: plan.id,
    branchId: plan.stops[0]?.branchId || '',
    evidenceScore: Math.min(30, 10 + plan.stops.length * 2),
    createdAt: plan.updatedAt || plan.createdAt,
    recommendationAction: 'Plan saatlerini, arac uygunlugunu ve durak siralamasini revize et.',
    expectedImpact: 'Teslim gecikmesini ve iade/iptal riskini azaltir.',
    ownerRole: 'Sevkiyat Planlama'
  }))

const createReturnRateSuggestion = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const completedPlans = sourceData.shipmentPlans.filter(plan => plan.status === 'COMPLETED')
  const returnRate = percent(sourceData.shipmentReturns.length, completedPlans.length)
  if(returnRate <= 15 || sourceData.shipmentReturns.length === 0) return []

  const latestReturn = sourceData.shipmentReturns[0]
  return [createDecisionSuggestion({
    category: 'Shipment',
    title: 'Iade orani yuksek',
    description: 'Tamamlanan sevkiyatlara gore iade sayisi yuksek.',
    reason: `Iade orani ${returnRate.toLocaleString('tr-TR')}%, return count ${sourceData.shipmentReturns.length}, completed shipment ${completedPlans.length}.`,
    ruleId: 'shipment-return-quality-analysis',
    relatedEntityType: 'ShipmentReturn',
    relatedEntityId: latestReturn.id,
    branchId: '',
    evidenceScore: Math.min(30, returnRate),
    createdAt: latestReturn.returnDate || latestReturn.createdAt,
    recommendationAction: 'Paketleme, soguk zincir, teslim kosulu ve sube bazli iade nedenlerini analiz et.',
    expectedImpact: 'Tekrarlayan iade ve musteri/sube memnuniyetsizligi riskini azaltir.',
    ownerRole: 'Sevkiyat ve Kalite'
  })]
}

export const createShipmentDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => [
  ...createLowUtilizationSuggestions(sourceData),
  ...createDelayedShipmentSuggestions(sourceData),
  ...createReturnRateSuggestion(sourceData)
]
