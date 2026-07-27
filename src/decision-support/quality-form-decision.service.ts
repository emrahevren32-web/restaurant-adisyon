import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatPercent,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { QualityFormService } from '../quality-forms/quality-form.service'
import type { QualityForm } from '../quality-forms/quality-form.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const getTime = (value: string) => {
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
) => QualityFormService.list(sourceData).filter(form => form.status !== 'CANCELLED')

const groupBy = (
  forms: QualityForm[],
  getKey: (form: QualityForm) => string
) => forms.reduce<Map<string, QualityForm[]>>((map, form) => {
  const key = getKey(form)
  if(!key) return map
  map.set(key, [...(map.get(key) || []), form])
  return map
}, new Map())

const createProductFailIncreaseSuggestions = (
  forms: QualityForm[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(30)
  const previousStart = daysAgo(60)

  return Array.from(groupBy(forms, form => form.productId || form.stockItemId).entries()).flatMap(([, productForms]) => {
    const recentForms = productForms.filter(form => getTime(form.inspectionDate) >= recentStart)
    const previousForms = productForms.filter(form => {
      const time = getTime(form.inspectionDate)
      return time >= previousStart && time < recentStart
    })
    const recentFailRate = percent(recentForms.filter(form => form.result === 'FAIL').length, recentForms.length)
    const previousFailRate = percent(previousForms.filter(form => form.result === 'FAIL').length, previousForms.length)
    const increase = previousForms.length > 0
      ? roundKpi(recentFailRate - previousFailRate)
      : recentFailRate

    if(recentForms.length < 2 || increase < 10) return []

    const leadForm = recentForms.find(form => form.result === 'FAIL') || recentForms[0]

    return [createDecisionSuggestion({
      category: 'Quality',
      title: `${leadForm.productName || leadForm.stockItemName} FAIL orani artti`,
      description: 'Quality Forms sonuclari ayni urunde artan FAIL trendi gosteriyor.',
      reason: `Son 30 gunde ayni urunde FAIL orani ${formatPercent(recentFailRate)}; artis ${formatPercent(increase)}.`,
      ruleId: 'quality-form-product-fail-increase',
      relatedEntityType: 'QualityForm',
      relatedEntityId: leadForm.id,
      relatedLotId: leadForm.lotId,
      relatedProductId: leadForm.productId || leadForm.stockItemId,
      relatedSupplierId: leadForm.supplierId,
      relatedWorkOrderId: leadForm.productionOrderId,
      branchId: leadForm.branchId,
      warehouseId: leadForm.warehouseId,
      evidenceScore: Math.min(30, increase),
      createdAt: leadForm.updatedAt || leadForm.createdAt,
      recommendationAction: 'Urun bazli kalite kok neden analizi ac ve son FAIL formlarinin inspection kriterlerini karsilastir.',
      expectedImpact: 'Tekrarlayan kalite uygunsuzlugunu erken yakalayarak waste ve recall riskini dusurur.',
      ownerRole: 'Kalite'
    })]
  }).slice(0, 6)
}

const createSupplierProblemSuggestions = (
  forms: QualityForm[]
): DecisionSuggestion[] => (
  Array.from(groupBy(forms.filter(form => form.sourceType === 'GoodsReceipt'), form => form.supplierId).entries())
    .flatMap(([, supplierForms]) => {
      const latestFive = [...supplierForms]
        .sort((first, second) => getTime(second.inspectionDate) - getTime(first.inspectionDate))
        .slice(0, 5)
      const problemForms = latestFive.filter(form => form.result === 'FAIL' || form.result === 'CONDITIONAL')
      if(latestFive.length < 5 || problemForms.length < 3) return []

      const leadForm = problemForms[0]

      return [createDecisionSuggestion({
        category: 'Quality',
        title: `${leadForm.supplierName} kalite problemi olusturuyor`,
        description: 'Quality Forms mal kabul kayitlari supplier bazli tekrar eden kalite problemi gosteriyor.',
        reason: `Ayni supplier son 5 teslimatta ${problemForms.length} kalite problemi olusturdu.`,
        ruleId: 'quality-form-supplier-problem',
        relatedEntityType: 'QualityForm',
        relatedEntityId: leadForm.id,
        relatedLotId: leadForm.lotId,
        relatedProductId: leadForm.productId || leadForm.stockItemId,
        relatedSupplierId: leadForm.supplierId,
        branchId: leadForm.branchId,
        warehouseId: leadForm.warehouseId,
        evidenceScore: Math.min(30, problemForms.length * 6),
        createdAt: leadForm.updatedAt || leadForm.createdAt,
        recommendationAction: 'Supplier kalite gorusmesi ac, mal kabul kriterlerini siki takip et ve alternatif tedarik planini kontrol et.',
        expectedImpact: 'Mal kabul kaynakli red, sartli onay ve waste maliyetini azaltir.',
        ownerRole: 'Kalite ve Satin Alma'
      })]
    })
).slice(0, 6)

const createConditionalApprovalSuggestions = (
  forms: QualityForm[]
): DecisionSuggestion[] => {
  const conditionalForms = forms.filter(form => form.result === 'CONDITIONAL' || form.status === 'CONDITIONAL_APPROVED')
  if(conditionalForms.length === 0) return []

  const leadForm = conditionalForms
    .sort((first, second) => getTime(second.inspectionDate) - getTime(first.inspectionDate))[0]

  return [createDecisionSuggestion({
    category: 'Quality',
    title: 'Sartli onay verilen urunler incelenmeli',
    description: 'Quality Forms sartli onay kayitlari takip aksiyonu gerektiriyor.',
    reason: `${conditionalForms.length} form CONDITIONAL veya Sartli Onay durumunda.`,
    ruleId: 'quality-form-conditional-review',
    relatedEntityType: 'QualityForm',
    relatedEntityId: leadForm.id,
    relatedLotId: leadForm.lotId,
    relatedProductId: leadForm.productId || leadForm.stockItemId,
    relatedSupplierId: leadForm.supplierId,
    relatedWorkOrderId: leadForm.productionOrderId,
    branchId: leadForm.branchId,
    warehouseId: leadForm.warehouseId,
    evidenceScore: Math.min(30, conditionalForms.length * 3),
    createdAt: leadForm.updatedAt || leadForm.createdAt,
    recommendationAction: 'Sartli onayli lotlari HACCP, Sample ve Witness Sample kayitlariyla birlikte tekrar degerlendir.',
    expectedImpact: 'Serbest birakma oncesi kalite riskini dusurur ve izlenebilirligi guclendirir.',
    ownerRole: 'Kalite'
  })]
}

export const createQualityFormDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const forms = activeForms(sourceData)
  if(forms.length === 0) return []

  return [
    ...createProductFailIncreaseSuggestions(forms),
    ...createSupplierProblemSuggestions(forms),
    ...createConditionalApprovalSuggestions(forms)
  ]
}
