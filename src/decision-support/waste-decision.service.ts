import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatCurrency,
  formatPercent,
  formatQuantity,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  WASTE_REASON_LABELS,
  WASTE_TYPE_LABELS,
  WasteService
} from '../waste-management/waste.service'
import type { WasteRecord } from '../waste-management/waste.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

type WasteGroup = {
  id: string
  label: string
  quantity: number
  cost: number
  records: WasteRecord[]
}

const activeWasteRecords = (
  sourceData: KpiSourceData
) => WasteService.list(sourceData).filter(record => (
  record.status !== 'CANCELLED'
  && record.status !== 'REJECTED'
))

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

const getTime = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const groupWaste = (
  records: WasteRecord[],
  getId: (record: WasteRecord) => string,
  getLabel: (record: WasteRecord) => string
) => Array.from(records.reduce<Map<string, WasteGroup>>((map, record) => {
  const id = getId(record)
  if(!id) return map
  const current = map.get(id) || {
    id,
    label: getLabel(record),
    quantity: 0,
    cost: 0,
    records: []
  }

  map.set(id, {
    ...current,
    quantity: roundKpi(current.quantity + record.quantity),
    cost: roundKpi(current.cost + record.totalCost),
    records: [...current.records, record]
  })

  return map
}, new Map()).values())
  .sort((first, second) => second.quantity - first.quantity || second.cost - first.cost)

const createProductIncreaseSuggestions = (
  records: WasteRecord[]
): DecisionSuggestion[] => {
  const now = new Date()
  const recentStart = daysAgo(30).getTime()
  const previousStart = daysAgo(60).getTime()
  const groups = groupWaste(records, record => record.productId || record.stockItemId, record => record.productName || record.stockItemName)

  return groups.flatMap(group => {
    const recentRecords = group.records.filter(record => {
      const time = getTime(record.date || record.createdAt)
      return time >= recentStart && time <= now.getTime()
    })
    const previousRecords = group.records.filter(record => {
      const time = getTime(record.date || record.createdAt)
      return time >= previousStart && time < recentStart
    })
    const recentQuantity = sumBy(recentRecords, record => record.quantity)
    const previousQuantity = sumBy(previousRecords, record => record.quantity)
    const increasePercent = previousQuantity > 0
      ? roundKpi(((recentQuantity - previousQuantity) / previousQuantity) * 100)
      : recentQuantity > 0 ? 100 : 0

    if(recentQuantity <= 0 || increasePercent < 20) return []

    const leadRecord = recentRecords[0] || group.records[0]

    return [createDecisionSuggestion({
      category: 'Production',
      title: `${group.label} urunlerinde fire artti`,
      description: 'Waste Management urun bazli fire trendinde karar destek esigini asan artis buldu.',
      reason: `Son 30 gunde ${group.label} fire miktari ${formatQuantity(recentQuantity, leadRecord.unit)} oldu; artis ${formatPercent(increasePercent)}.`,
      ruleId: 'waste-product-increase',
      relatedEntityType: 'WasteRecord',
      relatedEntityId: leadRecord.id,
      relatedLotId: leadRecord.lotId,
      relatedProductId: leadRecord.productId || leadRecord.stockItemId,
      relatedSupplierId: leadRecord.supplierId,
      relatedWorkOrderId: leadRecord.productionOrderId,
      branchId: leadRecord.branchId,
      warehouseId: leadRecord.warehouseId,
      evidenceScore: Math.min(30, increasePercent / 3),
      createdAt: leadRecord.updatedAt || leadRecord.createdAt,
      recommendationAction: 'Urun, lot, operator ve recete fire nedenlerini birlikte incele.',
      expectedImpact: 'Tekrarlayan fire kaynaklarini ayirarak Cost Engine fire bilesenini dusurur.',
      ownerRole: 'Uretim'
    })]
  }).slice(0, 5)
}

const createBlastChillingSuggestion = (
  records: WasteRecord[]
) => {
  const blastRecords = records.filter(record => (
    record.wasteType === 'BLAST_CHILLING'
    || record.wasteReason === 'TEMPERATURE_ISSUE'
  ))
  const totalQuantity = sumBy(blastRecords, record => record.quantity)
  if(totalQuantity <= 0) return []

  const leadRecord = blastRecords.sort((first, second) => second.totalCost - first.totalCost)[0]

  return [createDecisionSuggestion({
    category: 'Quality',
    title: 'Soklama sureci gozden gecirilmeli',
    description: 'Waste Management soklama ve sicaklik kaynakli fire sinyali uretti.',
    reason: `${WASTE_TYPE_LABELS[leadRecord.wasteType]} / ${WASTE_REASON_LABELS[leadRecord.wasteReason]} kayitlari ${formatQuantity(totalQuantity, leadRecord.unit)} fire ve ${formatCurrency(sumBy(blastRecords, record => record.totalCost))} maliyet olusturdu.`,
    ruleId: 'waste-blast-chilling-review',
    relatedEntityType: 'WasteRecord',
    relatedEntityId: leadRecord.id,
    relatedLotId: leadRecord.lotId,
    relatedProductId: leadRecord.productId || leadRecord.stockItemId,
    relatedSupplierId: leadRecord.supplierId,
    relatedWorkOrderId: leadRecord.productionOrderId,
    branchId: leadRecord.branchId,
    warehouseId: leadRecord.warehouseId,
    evidenceScore: Math.min(30, totalQuantity * 2),
    createdAt: leadRecord.updatedAt || leadRecord.createdAt,
    recommendationAction: 'Soklama sicaklik kaydi, bekleme suresi ve HACCP monitoring sonucunu birlikte kontrol et.',
    expectedImpact: 'Soguk zincir kaynakli kalite reddini ve fire maliyetini azaltir.',
    ownerRole: 'Kalite'
  })]
}

const createWarehouseAboveAverageSuggestion = (
  records: WasteRecord[]
) => {
  const warehouseGroups = groupWaste(records, record => record.warehouseId, record => record.warehouseName || record.warehouseId)
  const totalQuantity = sumBy(warehouseGroups, group => group.quantity)
  const averageQuantity = warehouseGroups.length > 0 ? totalQuantity / warehouseGroups.length : 0
  const leadGroup = warehouseGroups[0]

  if(!leadGroup || totalQuantity <= 0 || leadGroup.quantity < averageQuantity) return []

  const leadRecord = leadGroup.records[0]
  const share = percent(leadGroup.quantity, totalQuantity)

  return [createDecisionSuggestion({
    category: 'Inventory',
    title: `${leadGroup.label} deposunda fire orani ortalamanin uzerinde`,
    description: 'Waste Management depo bazli fire dagiliminda yogunlasma tespit etti.',
    reason: `${leadGroup.label} deposu toplam fire miktarinin ${formatPercent(share)} payini tasiyor; toplam maliyet ${formatCurrency(leadGroup.cost)}.`,
    ruleId: 'waste-warehouse-above-average',
    relatedEntityType: 'WasteRecord',
    relatedEntityId: leadRecord.id,
    relatedLotId: leadRecord.lotId,
    relatedProductId: leadRecord.productId || leadRecord.stockItemId,
    relatedSupplierId: leadRecord.supplierId,
    relatedWorkOrderId: leadRecord.productionOrderId,
    branchId: leadRecord.branchId,
    warehouseId: leadRecord.warehouseId,
    evidenceScore: Math.min(30, share / 2),
    createdAt: leadRecord.updatedAt || leadRecord.createdAt,
    recommendationAction: 'Depo raf, SKT, FEFO ve ambalaj kontrol adimlarini fire listesiyle karsilastir.',
    expectedImpact: 'Depo kaynakli kayiplarin tekrarlamasini ve maliyet sapmasini azaltir.',
    ownerRole: 'Depo'
  })]
}

export const createWasteDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const records = activeWasteRecords(sourceData)
  if(records.length === 0) return []

  return [
    ...createProductIncreaseSuggestions(records),
    ...createBlastChillingSuggestion(records),
    ...createWarehouseAboveAverageSuggestion(records)
  ]
}
