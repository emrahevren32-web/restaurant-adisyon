import {
  flattenHACCPCorrectiveActions,
  flattenHACCPCCPs,
  flattenHACCPMonitoringRecords
} from '../haccp/haccp.mock'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { percent } from '../kpi-reporting/kpi.utils'
import { createDecisionSuggestion } from './recommendation-engine.service'
import type { DecisionSuggestion } from './decision-support.types'
import {
  getAgeDays,
  getLotProductId
} from './decision-support.utils'

const MAX_ENTITY_SUGGESTIONS = 8

const getCcpPlanId = (
  sourceData: KpiSourceData,
  ccpId: string
) => sourceData.haccpRecords.find(plan => plan.criticalControlPoints.some(ccp => ccp.id === ccpId))?.id || ''

const createCcpFailureSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const ccps = flattenHACCPCCPs(sourceData.haccpRecords)
  const ccpMap = new Map(ccps.map(ccp => [ccp.id, ccp]))
  const monitoringRecords = flattenHACCPMonitoringRecords(sourceData.haccpRecords)
  const failBuckets = new Map<string, number>()

  monitoringRecords
    .filter(record => record.result === 'FAIL')
    .forEach(record => failBuckets.set(record.ccpId, (failBuckets.get(record.ccpId) || 0) + 1))

  return Array.from(failBuckets.entries())
    .filter(([, count]) => count >= 3)
    .slice(0, MAX_ENTITY_SUGGESTIONS)
    .map(([ccpId, count]) => {
      const ccp = ccpMap.get(ccpId)
      const latestRecord = [...monitoringRecords].reverse().find(record => record.ccpId === ccpId && record.result === 'FAIL')
      const lot = latestRecord ? sourceData.inventoryLots.find(record => record.id === latestRecord.inventoryLotId) || null : null
      return createDecisionSuggestion({
        category: 'Quality',
        title: `Riskli CCP: ${ccp?.name || ccpId}`,
        description: 'Aynı kritik kontrol noktası tekrarlayan başarısız sonuç üretti.',
        reason: `${count} başarısız kayıt. Kritik limit: ${ccp?.criticalLimit || '-'}.`,
        ruleId: 'quality-ccp-failure-risk',
        relatedEntityType: 'CriticalControlPoint',
        relatedEntityId: ccpId,
        relatedLotId: latestRecord?.inventoryLotId || '',
        relatedProductId: getLotProductId(lot),
        warehouseId: lot?.warehouseId || '',
        evidenceScore: Math.min(30, count * 5),
        createdAt: latestRecord?.checkedAt || new Date().toISOString(),
        recommendationAction: 'CCP monitoring frekansini artir, kalibrasyon ve proses parametrelerini kontrol et.',
        expectedImpact: 'Tekrarlayan uygunsuzluk ve recall riskini azaltir.',
        ownerRole: 'Kalite Sorumlusu'
      })
    })
}

const createHaccpSuccessSuggestion = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const monitoringRecords = flattenHACCPMonitoringRecords(sourceData.haccpRecords)
  const passCount = monitoringRecords.filter(record => record.result === 'PASS').length
  const passRate = percent(passCount, monitoringRecords.length)
  if(monitoringRecords.length === 0 || passRate >= 90) return []

  return [createDecisionSuggestion({
    category: 'Quality',
    title: 'HACCP basari orani dusuk',
    description: 'PASS orani yonetim hedefinin altinda.',
    reason: `PASS rate ${passRate.toLocaleString('tr-TR')}%, toplam monitoring ${monitoringRecords.length}.`,
    ruleId: 'quality-haccp-meeting',
    relatedEntityType: 'HACCPPlan',
    relatedEntityId: sourceData.haccpRecords[0]?.id || 'haccp',
    evidenceScore: Math.min(30, 90 - passRate),
    recommendationAction: 'Kalite, uretim ve depo ekipleriyle HACCP degerlendirme toplantisi planla.',
    expectedImpact: 'Kritik limit sapmalarini ve uygunsuz uretim riskini azaltir.',
    ownerRole: 'Kalite Muduru'
  })]
}

const createRecallSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const activeRecalls = sourceData.productRecalls.filter(recall => (
    recall.status !== 'COMPLETED' && recall.status !== 'CANCELLED'
  ))
  if(activeRecalls.length < 2) return []

  const firstRecall = activeRecalls[0]
  const lot = sourceData.inventoryLots.find(record => record.id === firstRecall.inventoryLotId) || null

  return [createDecisionSuggestion({
    category: 'Quality',
    title: 'Aktif recall artisi',
    description: 'Birden fazla aktif recall yonetici dikkati gerektiriyor.',
    reason: `${activeRecalls.length} aktif recall kaydi mevcut.`,
    ruleId: 'quality-recall-management-alert',
    relatedEntityType: 'ProductRecall',
    relatedEntityId: firstRecall.id,
    relatedLotId: firstRecall.inventoryLotId,
    relatedProductId: getLotProductId(lot),
    relatedSupplierId: lot?.supplierId || '',
    warehouseId: lot?.warehouseId || '',
    evidenceScore: Math.min(30, activeRecalls.length * 6),
    createdAt: firstRecall.reportedDate || firstRecall.createdAt,
    recommendationAction: 'Yönetici uyarısı aç, lot ve tedarikçi kök neden analizi başlat.',
    expectedImpact: 'Geri cagirma kapsam kontrolunu ve marka riskini iyilestirir.',
    ownerRole: 'Yonetici'
  })]
}

const createOpenCorrectiveActionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const monitoringRecords = flattenHACCPMonitoringRecords(sourceData.haccpRecords)
  const monitoringMap = new Map(monitoringRecords.map(record => [record.id, record]))

  return flattenHACCPCorrectiveActions(sourceData.haccpRecords)
    .filter(action => action.status === 'OPEN' || action.status === 'IN_PROGRESS')
    .slice(0, MAX_ENTITY_SUGGESTIONS)
    .map(action => {
      const monitoringRecord = monitoringMap.get(action.monitoringRecordId)
      const lot = monitoringRecord ? sourceData.inventoryLots.find(record => record.id === monitoringRecord.inventoryLotId) || null : null
      const ageDays = getAgeDays(monitoringRecord?.checkedAt || action.completedAt || new Date().toISOString())
      return createDecisionSuggestion({
        category: 'Quality',
        title: `Acik Corrective Action: ${action.assignedTo}`,
        description: action.description,
        reason: `${action.status} durumunda, yaklasik ${ageDays} gun acik.`,
        ruleId: 'quality-open-corrective-action',
        relatedEntityType: 'CorrectiveAction',
        relatedEntityId: action.id,
        relatedLotId: monitoringRecord?.inventoryLotId || '',
        relatedProductId: getLotProductId(lot),
        warehouseId: lot?.warehouseId || '',
        evidenceScore: Math.min(30, 8 + ageDays * 2),
        createdAt: monitoringRecord?.checkedAt || new Date().toISOString(),
        recommendationAction: 'Sorumlu kisiye eskalasyon yap ve kapama kriterlerini netlestir.',
        expectedImpact: 'Verification oncesi kalite aksiyon kapanisini hizlandirir.',
        ownerRole: 'Kalite Sorumlusu'
      })
    })
}

export const createQualityDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => [
  ...createCcpFailureSuggestions(sourceData),
  ...createHaccpSuccessSuggestion(sourceData),
  ...createRecallSuggestions(sourceData),
  ...createOpenCorrectiveActionSuggestions(sourceData)
]
