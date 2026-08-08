import {
  ApprovedAlternativeMaterialService
} from '../approved-alternative-materials/approved-alternative-material.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type { StockItem } from '../types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const MAX_SUGGESTIONS_PER_BUCKET = 6

const isMaterialAtRisk = (
  item: StockItem
) => item.active && item.currentQty <= Math.max(item.minQty, 0)

const getStockGap = (
  item: StockItem
) => Math.max(0, item.minQty - item.currentQty)

export const createApprovedAlternativeMaterialDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const context = {
    stockItems: sourceData.stockItems,
    suppliers: sourceData.suppliers,
    supplierProducts: sourceData.supplierProducts
  }
  const records = ApprovedAlternativeMaterialService.load(context)
  const riskyMaterials = sourceData.stockItems.filter(isMaterialAtRisk)

  const availableSuggestions = riskyMaterials
    .flatMap(item => {
      const usableAlternatives = ApprovedAlternativeMaterialService.getForMaterial(item.id, records, context, true)
      const bestAlternative = usableAlternatives[0]
      if(!bestAlternative) return []

      return [createDecisionSuggestion({
        category: 'Purchasing',
        title: `Muadil kullanılabilir: ${item.name}`,
        description: 'Kritik veya stokta olmayan hammadde için kalite onaylı muadil ürün mevcut.',
        reason: `${item.name} mevcut ${item.currentQty} ${item.unit}, minimum ${item.minQty} ${item.unit}. ${bestAlternative.alternativeMaterialName} kalite onaylı muadil olarak izleniyor.`,
        ruleId: 'approved-alternative-material-available',
        relatedEntityType: 'ApprovedAlternativeMaterial',
        relatedEntityId: bestAlternative.id,
        relatedProductId: item.id,
        relatedSupplierId: bestAlternative.preferredSupplierId,
        branchId: item.branchId,
        evidenceScore: Math.min(30, Math.max(8, getStockGap(item) + usableAlternatives.length * 3)),
        recommendationAction: 'Onaylı muadil ürün listesini satın alma, kalite ve reçete sahibiyle manuel değerlendir.',
        expectedImpact: 'Tedarik kesinti riskini azaltır; satın alma, stok veya reçete otomatik değiştirilmez.',
        ownerRole: 'Satın Alma'
      })]
    })
    .slice(0, MAX_SUGGESTIONS_PER_BUCKET)

  const riskySuggestions = riskyMaterials
    .flatMap(item => {
      const allAlternatives = ApprovedAlternativeMaterialService.getForMaterial(item.id, records, context)
      const usableAlternatives = allAlternatives.filter(record => record.usable)
      const riskyAlternative = allAlternatives.find(record => !record.usable)
      if(usableAlternatives.length > 0 || !riskyAlternative) return []

      return [createDecisionSuggestion({
        category: 'Purchasing',
        title: `Muadil riskli: ${item.name}`,
        description: 'Hammadde için muadil kaydı var ancak öneri koşullarını sağlamıyor.',
        reason: `${riskyAlternative.alternativeMaterialName} durumu: ${riskyAlternative.unusableReason}. Aktif, onaylı ve süresi geçmemiş kayıt olmadan önerilemez.`,
        ruleId: 'approved-alternative-material-risky',
        relatedEntityType: 'ApprovedAlternativeMaterial',
        relatedEntityId: riskyAlternative.id,
        relatedProductId: item.id,
        relatedSupplierId: riskyAlternative.preferredSupplierId,
        branchId: item.branchId,
        evidenceScore: Math.min(30, Math.max(10, getStockGap(item) + allAlternatives.length)),
        recommendationAction: 'Kalite onayını, geçerlilik tarihini ve tedarikçi uygunluğunu manuel yeniden kontrol et.',
        expectedImpact: 'Onaysız veya süresi dolmuş muadil kullanım riskini azaltır.',
        ownerRole: 'Kalite Güvence'
      })]
    })
    .slice(0, MAX_SUGGESTIONS_PER_BUCKET)

  const missingSuggestions = riskyMaterials
    .filter(item => ApprovedAlternativeMaterialService.getForMaterial(item.id, records, context).length === 0)
    .slice(0, MAX_SUGGESTIONS_PER_BUCKET)
    .map(item => createDecisionSuggestion({
      category: 'Purchasing',
      title: `Muadil bulunamadı: ${item.name}`,
      description: 'Kritik hammadde için onaylı muadil master data kaydı bulunmuyor.',
      reason: `${item.name} mevcut ${item.currentQty} ${item.unit}, minimum ${item.minQty} ${item.unit}. Onaylı muadil listesi boş.`,
      ruleId: 'approved-alternative-material-missing',
      relatedEntityType: 'StockItem',
      relatedEntityId: item.id,
      relatedProductId: item.id,
      branchId: item.branchId,
      evidenceScore: Math.min(30, Math.max(8, getStockGap(item))),
      recommendationAction: 'Kalite ve satın alma ile muadil ürün master data değerlendirme süreci başlat.',
      expectedImpact: 'Tek kaynak ve stok yokluğu riskini erken görünür kılar.',
      ownerRole: 'Satın Alma'
    }))

  return [
    ...availableSuggestions,
    ...riskySuggestions,
    ...missingSuggestions
  ]
}
