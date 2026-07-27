import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import type { ShipmentForm } from '../shipment-forms/shipment-form.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const getTime = (value: string) => {
  if(!value) return 0
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.getTime()
}

const activeForms = (
  sourceData: KpiSourceData
) => ShipmentFormService.list(sourceData).filter(form => form.status !== 'CANCELLED')

const groupBy = (
  forms: ShipmentForm[],
  getKey: (form: ShipmentForm) => string
) => forms.reduce<Map<string, ShipmentForm[]>>((map, form) => {
  const key = getKey(form)
  if(!key) return map
  map.set(key, [...(map.get(key) || []), form])
  return map
}, new Map())

const createVehicleReturnIncreaseSuggestions = (
  forms: ShipmentForm[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(30)
  const previousStart = daysAgo(60)

  return Array.from(groupBy(forms, form => form.vehicleId).entries()).flatMap(([, vehicleForms]) => {
    const recentForms = vehicleForms.filter(form => getTime(form.loadingDate) >= recentStart)
    const previousForms = vehicleForms.filter(form => {
      const time = getTime(form.loadingDate)
      return time >= previousStart && time < recentStart
    })
    const recentReturnRate = percent(recentForms.filter(form => form.status === 'RETURNED').length, recentForms.length)
    const previousReturnRate = percent(previousForms.filter(form => form.status === 'RETURNED').length, previousForms.length)
    const increase = previousForms.length > 0 ? roundKpi(recentReturnRate - previousReturnRate) : recentReturnRate

    if(recentForms.length < 2 || increase < 10) return []

    const leadForm = recentForms.find(form => form.status === 'RETURNED') || recentForms[0]

    return [createDecisionSuggestion({
      category: 'Shipment',
      title: `${leadForm.vehicleNo} aracinda iade orani artti`,
      description: 'Shipment Forms arac bazli iade trendinde karar destek esigini asan artis buldu.',
      reason: `Son 30 gunde ${leadForm.vehicleNo} ile yapilan sevkiyatlarda iade orani ${formatPercent(recentReturnRate)}; artis ${formatPercent(increase)}.`,
      ruleId: 'shipment-form-vehicle-return-increase',
      relatedEntityType: 'ShipmentForm',
      relatedEntityId: leadForm.id,
      relatedLotId: leadForm.items[0]?.lotId || '',
      relatedProductId: leadForm.items[0]?.productId || leadForm.items[0]?.stockItemId || '',
      branchId: leadForm.branchId,
      warehouseId: leadForm.warehouseId,
      evidenceScore: Math.min(30, increase),
      createdAt: leadForm.updatedAt || leadForm.createdAt,
      recommendationAction: 'Arac bazli iade nedenlerini rota, palet sabitleme ve teslim checklist kayitlariyla karsilastir.',
      expectedImpact: 'Tekrarlayan iade ve teslim riski kaynaklarini azaltir.',
      ownerRole: 'Sevkiyat'
    })]
  }).slice(0, 6)
}

const createColdChainDeviationSuggestions = (
  forms: ShipmentForm[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(30)
  const recentForms = forms.filter(form => getTime(form.loadingDate) >= recentStart)
  const deviationLogs = recentForms.flatMap(form => (
    form.temperatureLogs
      .filter(log => log.result === 'WARNING' || log.result === 'FAIL')
      .map(log => ({ form, log }))
  ))

  if(deviationLogs.length < 2) return []

  const lead = deviationLogs[0]

  return [createDecisionSuggestion({
    category: 'Shipment',
    title: 'Soguk zincir sicaklik sapmalari artiyor',
    description: 'Shipment Forms sicaklik loglari soguk zincir sapmasi sinyali uretti.',
    reason: `Son 30 gunde ${formatNumber(deviationLogs.length)} sicaklik sapmasi kaydedildi. Son deger ${formatNumber(lead.log.temperatureC, 1)} C.`,
    ruleId: 'shipment-form-cold-chain-deviation',
    relatedEntityType: 'ShipmentForm',
    relatedEntityId: lead.form.id,
    relatedLotId: lead.form.items[0]?.lotId || '',
    relatedProductId: lead.form.items[0]?.productId || lead.form.items[0]?.stockItemId || '',
    branchId: lead.form.branchId,
    warehouseId: lead.form.warehouseId,
    evidenceScore: Math.min(30, deviationLogs.length * 4),
    createdAt: lead.form.updatedAt || lead.form.createdAt,
    recommendationAction: 'Sogutucu sistem, kapi acik kalma ve yukleme sonrasi sicaklik kayitlarini kalite ekibiyle incele.',
    expectedImpact: 'Soguk zincir kaynakli kalite reddi ve iade riskini azaltir.',
    ownerRole: 'Sevkiyat ve Kalite'
  })]
}

const createDriverDelaySuggestions = (
  forms: ShipmentForm[]
): DecisionSuggestion[] => {
  const deliveredForms = forms.filter(form => form.deliveryDate && form.loadingDate && form.status === 'DELIVERED')
  const delayByForm = deliveredForms.map(form => {
    const loading = getTime(form.loadingDate)
    const delivery = getTime(form.deliveryDate)
    const delayDays = loading > 0 && delivery > 0 ? Math.max(0, Math.round((delivery - loading) / 86400000)) : 0
    return { form, delayDays }
  })
  const averageDelay = delayByForm.length > 0
    ? delayByForm.reduce((total, row) => total + row.delayDays, 0) / delayByForm.length
    : 0

  return Array.from(groupBy(deliveredForms, form => form.driverName).entries()).flatMap(([, driverForms]) => {
    const driverRows = delayByForm.filter(row => driverForms.some(form => form.id === row.form.id))
    const driverAverage = driverRows.length > 0
      ? driverRows.reduce((total, row) => total + row.delayDays, 0) / driverRows.length
      : 0

    if(driverRows.length < 2 || driverAverage <= averageDelay + 0.5) return []

    const leadForm = driverRows.sort((first, second) => second.delayDays - first.delayDays)[0].form

    return [createDecisionSuggestion({
      category: 'Shipment',
      title: `${leadForm.driverName} teslim gecikmeleri ortalamanin uzerinde`,
      description: 'Shipment Forms sofor bazli teslim surelerinde ortalama uzeri gecikme buldu.',
      reason: `${leadForm.driverName} ortalama ${formatNumber(driverAverage, 1)} gun, genel ortalama ${formatNumber(averageDelay, 1)} gun.`,
      ruleId: 'shipment-form-driver-delay',
      relatedEntityType: 'ShipmentForm',
      relatedEntityId: leadForm.id,
      relatedLotId: leadForm.items[0]?.lotId || '',
      relatedProductId: leadForm.items[0]?.productId || leadForm.items[0]?.stockItemId || '',
      branchId: leadForm.branchId,
      warehouseId: leadForm.warehouseId,
      evidenceScore: Math.min(30, (driverAverage - averageDelay) * 8),
      createdAt: leadForm.updatedAt || leadForm.createdAt,
      recommendationAction: 'Sofor teslim rotasi, durak sirasi ve teslim checklist gecmisini revize et.',
      expectedImpact: 'Gecikme kaynakli iade, soguk zincir ve musteri memnuniyeti riskini azaltir.',
      ownerRole: 'Sevkiyat Planlama'
    })]
  }).slice(0, 6)
}

export const createShipmentFormDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const forms = activeForms(sourceData)
  if(forms.length === 0) return []

  return [
    ...createVehicleReturnIncreaseSuggestions(forms),
    ...createColdChainDeviationSuggestions(forms),
    ...createDriverDelaySuggestions(forms)
  ]
}
