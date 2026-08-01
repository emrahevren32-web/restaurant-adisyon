import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import {
  CHECKLIST_TYPE_LABELS,
  ChecklistService
} from '../operation-checklists/checklist.service'
import type { Checklist } from '../operation-checklists/operation-checklist.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const getTime = (value: string) => {
  if(!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.getTime()
}

const activeChecklists = (
  sourceData: KpiSourceData
) => ChecklistService.list(sourceData).filter(checklist => checklist.status !== 'CANCELLED')

const groupBy = (
  checklists: Checklist[],
  getKey: (checklist: Checklist) => string
) => checklists.reduce<Map<string, Checklist[]>>((map, checklist) => {
  const key = getKey(checklist)
  if(!key) return map
  map.set(key, [...(map.get(key) || []), checklist])
  return map
}, new Map())

const hasProblem = (
  checklist: Checklist
) => checklist.items.some(item => item.status === 'FAIL' || item.status === 'WARNING')

const createEquipmentFailSuggestions = (
  checklists: Checklist[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(15)
  const equipmentChecklists = checklists.filter(checklist => (
    (checklist.checklistType === 'MACHINE_CONTROL' || checklist.checklistType === 'MAINTENANCE_CONTROL')
    && getTime(checklist.startAt) >= recentStart
    && checklist.equipmentId
  ))

  return Array.from(groupBy(equipmentChecklists, checklist => checklist.equipmentId).entries()).flatMap(([, group]) => {
    const failCount = group.filter(checklist => checklist.items.some(item => item.status === 'FAIL')).length
    const failRate = percent(failCount, group.length)
    if(group.length < 2 || failRate < 25) return []

    const leadChecklist = group.find(checklist => checklist.items.some(item => item.status === 'FAIL')) || group[0]

    return [createDecisionSuggestion({
      category: 'Production',
    title: `${leadChecklist.equipmentName || leadChecklist.sourceNo} ekipmanında başarısızlık oranı yükseldi`,
    description: 'Operasyon Kontrolleri ekipman ve bakım kontrollerinde tekrar eden başarısız sinyal buldu.',
    reason: `Son 15 günde ${formatNumber(group.length)} ekipman kontrol listesinden ${formatNumber(failCount)} tanesi başarısız madde içeriyor; oran ${formatPercent(failRate)}.`,
      ruleId: 'operation-checklist-equipment-fail-increase',
      relatedEntityType: 'Checklist',
      relatedEntityId: leadChecklist.id,
      relatedWorkOrderId: leadChecklist.productionOrderId,
      branchId: leadChecklist.branchId,
      warehouseId: leadChecklist.warehouseId,
      evidenceScore: Math.min(35, failRate),
      createdAt: leadChecklist.updatedAt || leadChecklist.createdAt,
      recommendationAction: 'Ekipman bakim planini one cek, son checklist notlari ve ariza belirtilerini bakim ekibiyle incele.',
      expectedImpact: 'Plansiz durus ve uretim gecikmesi riskini azaltir.',
      ownerRole: 'Bakim ve Uretim'
    })]
  }).slice(0, 6)
}

const createCleaningCompletionSuggestions = (
  checklists: Checklist[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(15)
  const cleaningChecklists = checklists.filter(checklist => (
    checklist.checklistType === 'CLEANING_CONTROL'
    && getTime(checklist.startAt) >= recentStart
  ))
  if(cleaningChecklists.length < 3) return []

  return Array.from(groupBy(cleaningChecklists, checklist => checklist.branchId).entries()).flatMap(([, group]) => {
    const completed = group.filter(checklist => checklist.status === 'COMPLETED').length
    const averageCompletion = group.length > 0
      ? roundKpi(group.reduce((total, checklist) => total + checklist.execution.completionRate, 0) / group.length)
      : 0
    const completedRate = percent(completed, group.length)
    if(completedRate >= 80 && averageCompletion >= 90) return []

    const leadChecklist = group.find(checklist => checklist.status !== 'COMPLETED') || group[0]

    return [createDecisionSuggestion({
      category: 'Quality',
      title: `${leadChecklist.branchName} temizlik checklistleri duzenli tamamlanmiyor`,
      description: 'Operations Checklists temizlik kontrol tamamlama oraninda dusukluk tespit etti.',
      reason: `Son 15 gunde temizlik checklist tamamlama orani ${formatPercent(completedRate)}, ortalama madde tamamlama ${formatPercent(averageCompletion)}.`,
      ruleId: 'operation-checklist-cleaning-incomplete',
      relatedEntityType: 'Checklist',
      relatedEntityId: leadChecklist.id,
      branchId: leadChecklist.branchId,
      warehouseId: leadChecklist.warehouseId,
      evidenceScore: Math.min(35, 100 - Math.min(completedRate, averageCompletion)),
      createdAt: leadChecklist.updatedAt || leadChecklist.createdAt,
      recommendationAction: 'Temizlik vardiya sorumlulugunu netlestir, kapanis kontrolunde eksik temizlik maddelerini zorunlu takip et.',
      expectedImpact: 'Hijyen uygunsuzlugu ve kalite red riskini azaltir.',
      ownerRole: 'Kalite ve Operasyon'
    })]
  }).slice(0, 6)
}

const createColdRoomDeviationSuggestions = (
  checklists: Checklist[]
): DecisionSuggestion[] => {
  const recentStart = daysAgo(30)
  const coldRoomChecklists = checklists.filter(checklist => (
    checklist.checklistType === 'COLD_ROOM_CONTROL'
    && getTime(checklist.startAt) >= recentStart
    && hasProblem(checklist)
  ))

  if(coldRoomChecklists.length < 2) return []

  const leadChecklist = coldRoomChecklists.find(checklist => checklist.items.some(item => item.status === 'FAIL')) || coldRoomChecklists[0]

  return [createDecisionSuggestion({
    category: 'Quality',
    title: 'Soguk oda kontrollerinde sicaklik sapmalari artiyor',
    description: 'Operasyon Kontrolleri soğuk oda kontrol maddelerinde uyarı/başarısızlık sapmaları yakaladı.',
    reason: `Son 30 gunde ${formatNumber(coldRoomChecklists.length)} soguk oda checklisti sapma iceriyor.`,
    ruleId: 'operation-checklist-cold-room-deviation',
    relatedEntityType: 'Checklist',
    relatedEntityId: leadChecklist.id,
    branchId: leadChecklist.branchId,
    warehouseId: leadChecklist.warehouseId,
    evidenceScore: Math.min(35, coldRoomChecklists.length * 5),
    createdAt: leadChecklist.updatedAt || leadChecklist.createdAt,
    recommendationAction: 'Soguk oda kapilari, conta, defrost ve sicaklik takip rutini kalite ekibiyle yeniden gozden gecir.',
    expectedImpact: 'Soguk zincir kaynakli kalite riski ve fire maliyetini azaltir.',
    ownerRole: 'Depo ve Kalite'
  })]
}

export const createOperationChecklistDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const checklists = activeChecklists(sourceData)
  if(checklists.length === 0) return []

  return [
    ...createEquipmentFailSuggestions(checklists),
    ...createCleaningCompletionSuggestions(checklists),
    ...createColdRoomDeviationSuggestions(checklists)
  ].map(suggestion => ({
    ...suggestion,
    description: `${suggestion.description} Kaynak: ${CHECKLIST_TYPE_LABELS[checklists.find(checklist => checklist.id === suggestion.relatedEntityId)?.checklistType || 'OPENING_CONTROL']}.`
  }))
}
