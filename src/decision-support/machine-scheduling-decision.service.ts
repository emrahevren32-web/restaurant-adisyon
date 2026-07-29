import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import type { MachineSchedule } from '../machine-scheduling/machine-scheduling.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activeSchedules = (
  sourceData: KpiSourceData
) => MachineSchedulingService.list(sourceData).filter(schedule => schedule.status !== 'CANCELLED')

const createConflictSuggestion = (
  schedules: MachineSchedule[]
): DecisionSuggestion[] => {
  const row = schedules.flatMap(schedule => schedule.items.map(item => ({ schedule, item })))
    .filter(record => record.item.conflict)
    .sort((first, second) => second.item.totalWorkingMinutes - first.item.totalWorkingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.machineCode} uzerinde makine zaman cakismasi var`,
    description: 'Machine Scheduling read-modeli makine uygunlugu ve gorev zaman penceresini kontrol eder.',
    reason: `${row.item.productName} gorevi ${row.item.machineCode} icin ${row.item.conflictReason || 'uygun zaman disina tasiyor'}.`,
    ruleId: 'machine-scheduling-conflict',
    relatedEntityType: 'MachineSchedule',
    relatedEntityId: row.schedule.id,
    relatedWorkOrderId: row.item.sourceItemId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(18, row.item.totalWorkingMinutes / 15)),
    createdAt: row.schedule.updatedAt || row.schedule.createdAt,
    recommendationAction: 'Cakisan gorevi alternatif makine veya daha genis vardiya penceresinde manuel olarak yeniden degerlendir.',
    expectedImpact: 'Makine uzerindeki teslim gecikmesi ve bekleme zinciri riskini azaltir.',
    ownerRole: 'Makine Cizelgeleme'
  })]
}

const createWaitingSuggestion = (
  schedules: MachineSchedule[]
): DecisionSuggestion[] => {
  const row = schedules.flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(record => record.queue.totalWaitingMinutes >= 180)
    .sort((first, second) => second.queue.totalWaitingMinutes - first.queue.totalWaitingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.queue.productionLineName} bekleme suresi yuksek`,
    description: 'Machine Scheduling kuyruk analizi makine bazli toplam bekleme suresini gorunur kilar.',
    reason: `${row.queue.machineCode} kuyrugunda ${formatNumber(row.queue.totalWaitingMinutes)} dk bekleme ve ${formatNumber(row.queue.pendingItemCount)} bekleyen is var.`,
    ruleId: 'machine-scheduling-waiting',
    relatedEntityType: 'MachineSchedule',
    relatedEntityId: row.schedule.id,
    warehouseId: row.queue.productionLineId,
    evidenceScore: Math.min(30, Math.max(14, row.queue.totalWaitingMinutes / 45)),
    createdAt: row.schedule.updatedAt || row.schedule.createdAt,
    recommendationAction: 'Bekleyen isleri vardiya, makine veya hazirlik sirasi acisindan manuel olarak gozden gecir.',
    expectedImpact: 'Makine kuyrugunu kisaltir ve uretim plani akisini dengeler.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createSetupSuggestion = (
  schedules: MachineSchedule[]
): DecisionSuggestion[] => {
  const row = schedules.flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(record => (
      record.queue.totalWorkingMinutes > 0
      && (record.queue.totalSetupMinutes + record.queue.totalCleaningMinutes) / record.queue.totalWorkingMinutes >= 0.25
    ))
    .sort((first, second) => (
      (second.queue.totalSetupMinutes + second.queue.totalCleaningMinutes)
      - (first.queue.totalSetupMinutes + first.queue.totalCleaningMinutes)
    ))[0]
  if(!row) return []

  const setupLoad = row.queue.totalSetupMinutes + row.queue.totalCleaningMinutes
  const setupPercent = row.queue.totalWorkingMinutes > 0 ? (setupLoad / row.queue.totalWorkingMinutes) * 100 : 0

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.queue.machineCode} setup ve temizlik yuku maliyeti artiriyor`,
    description: 'Machine Scheduling setup ve temizlik surelerinin toplam calisma suresindeki payini izler.',
    reason: `${row.queue.machineName} icin setup/temizlik payi ${formatPercent(setupPercent)}, toplam ${formatNumber(setupLoad)} dk.`,
    ruleId: 'machine-scheduling-setup-heavy',
    relatedEntityType: 'MachineSchedule',
    relatedEntityId: row.schedule.id,
    warehouseId: row.queue.productionLineId,
    evidenceScore: Math.min(30, Math.max(12, setupPercent - 20)),
    createdAt: row.schedule.updatedAt || row.schedule.createdAt,
    recommendationAction: 'Benzer receteleri ayni blokta toplama veya temizlik araliklarini manuel senaryo olarak degerlendir.',
    expectedImpact: 'Hazirlik kayiplarini azaltir ve ayni makinede daha fazla net uretim zamani acabilir.',
    ownerRole: 'Operasyon Muduru'
  })]
}

const createIdleSuggestion = (
  schedules: MachineSchedule[]
): DecisionSuggestion[] => {
  const row = schedules.flatMap(schedule => schedule.timelines.map(timeline => ({ schedule, timeline })))
    .filter(record => record.timeline.availableMinutes > 0 && record.timeline.idleMinutes / record.timeline.availableMinutes >= 0.25)
    .sort((first, second) => second.timeline.idleMinutes - first.timeline.idleMinutes)[0]
  if(!row) return []

  const idlePercent = row.timeline.availableMinutes > 0 ? (row.timeline.idleMinutes / row.timeline.availableMinutes) * 100 : 0

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.timeline.machineCode} gunun onemli bolumunde bos kaliyor`,
    description: 'Machine Scheduling timeline analizi makine bos zamanini hesaplar.',
    reason: `${row.timeline.machineName} icin bos zaman ${formatPercent(idlePercent)} (${formatNumber(row.timeline.idleMinutes)} dk).`,
    ruleId: 'machine-scheduling-idle-machine',
    relatedEntityType: 'MachineSchedule',
    relatedEntityId: row.schedule.id,
    warehouseId: row.timeline.productionLineId,
    evidenceScore: Math.min(30, Math.max(10, idlePercent - 20)),
    createdAt: row.schedule.updatedAt || row.schedule.createdAt,
    recommendationAction: 'Dusuk doluluktaki makineye uygun hazirlik veya dusuk riskli uretim islerini manuel olarak kaydir.',
    expectedImpact: 'Makine kullanim oranini artirir ve kapasite maliyetini dusurur.',
    ownerRole: 'Kapasite Planlama'
  })]
}

export const createMachineSchedulingDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const schedules = activeSchedules(sourceData)
  if(schedules.length === 0) return []

  return [
    ...createConflictSuggestion(schedules),
    ...createWaitingSuggestion(schedules),
    ...createSetupSuggestion(schedules),
    ...createIdleSuggestion(schedules)
  ].slice(0, 8)
}
