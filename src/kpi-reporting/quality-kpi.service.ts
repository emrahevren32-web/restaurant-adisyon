import {
  flattenHACCPCorrectiveActions,
  flattenHACCPCCPs,
  flattenHACCPMonitoringRecords,
  flattenHACCPVerificationRecords
} from '../haccp/haccp.mock'
import type { MonitoringRecord } from '../haccp/haccp.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiFilters, KpiSourceData, QualityKpiView } from './kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  createBarRows,
  createCard,
  createPieSlices,
  createTrend,
  formatNumber,
  formatPercent,
  matchesOptionalFilter,
  matchesPeriod,
  percent
} from './kpi.utils'

const getLot = (
  inventoryLotMap: Map<string, InventoryLot>,
  inventoryLotId: string
) => inventoryLotMap.get(inventoryLotId) || null

const getLotProductId = (lot: InventoryLot | null) => lot?.productId || lot?.stockItemId || ''

const matchesMonitoringFilters = (
  record: MonitoringRecord,
  lotMap: Map<string, InventoryLot>,
  filters: KpiFilters
) => {
  const lot = getLot(lotMap, record.inventoryLotId)
  return (
    matchesPeriod(record.checkedAt, filters.period)
    && matchesOptionalFilter(filters.lotId, record.inventoryLotId)
    && matchesOptionalFilter(filters.warehouseId, lot?.warehouseId || '')
    && (filters.productId === ALL_FILTER || getLotProductId(lot) === filters.productId)
    && (filters.operator === ALL_FILTER || record.checkedBy === filters.operator)
  )
}

const matchesRecallFilters = (
  recall: KpiSourceData['productRecalls'][number],
  lotMap: Map<string, InventoryLot>,
  filters: KpiFilters
) => {
  const lot = getLot(lotMap, recall.inventoryLotId)
  return (
    matchesPeriod(recall.reportedDate || recall.createdAt, filters.period)
    && matchesOptionalFilter(filters.lotId, recall.inventoryLotId)
    && matchesOptionalFilter(filters.warehouseId, lot?.warehouseId || '')
    && (filters.productId === ALL_FILTER || getLotProductId(lot) === filters.productId)
  )
}

export const createQualityKpiView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): QualityKpiView => {
  const lotMap = new Map(sourceData.inventoryLots.map(lot => [lot.id, lot]))
  const ccpMap = new Map(flattenHACCPCCPs(sourceData.haccpRecords).map(ccp => [ccp.id, ccp]))
  const monitoringRecords = flattenHACCPMonitoringRecords(sourceData.haccpRecords)
    .filter(record => matchesMonitoringFilters(record, lotMap, filters))
  const correctiveActions = flattenHACCPCorrectiveActions(sourceData.haccpRecords)
  const verificationRecords = flattenHACCPVerificationRecords(sourceData.haccpRecords)
  const monitoringIds = new Set(monitoringRecords.map(record => record.id))
  const filteredCorrectiveActions = correctiveActions.filter(action => monitoringIds.has(action.monitoringRecordId))
  const filteredVerificationRecords = verificationRecords.filter(record => (
    matchesPeriod(record.verifiedAt, filters.period)
    && monitoringIds.has(record.monitoringRecordId)
  ))
  const filteredSamples = sourceData.qualitySamples.filter(sample => {
    const lot = lotMap.get(sample.inventoryLotId)
    return (
      matchesPeriod(sample.sampleDate || sample.createdAt, filters.period)
      && matchesOptionalFilter(filters.lotId, sample.inventoryLotId)
      && matchesOptionalFilter(filters.warehouseId, lot?.warehouseId || '')
      && (filters.productId === ALL_FILTER || getLotProductId(lot || null) === filters.productId)
      && (filters.operator === ALL_FILTER || sample.takenBy === filters.operator)
    )
  })
  const sampleIds = new Set(filteredSamples.map(sample => sample.id))
  const filteredWitnessSamples = sourceData.witnessSamples.filter(sample => (
    matchesPeriod(sample.storageStartDate || sample.createdAt, filters.period)
    && sampleIds.has(sample.qualitySampleId)
  ))
  const filteredRecalls = sourceData.productRecalls.filter(recall => matchesRecallFilters(recall, lotMap, filters))
  const passRecords = monitoringRecords.filter(record => record.result === 'PASS')
  const failRecords = monitoringRecords.filter(record => record.result === 'FAIL')
  const passRate = percent(passRecords.length, monitoringRecords.length)
  const failRate = percent(failRecords.length, monitoringRecords.length)
  const ccpFailureBuckets = new Map<string, number>()

  failRecords.forEach(record => {
    const ccp = ccpMap.get(record.ccpId)
    const label = ccp?.name || record.ccpId || 'CCP'
    ccpFailureBuckets.set(label, (ccpFailureBuckets.get(label) || 0) + 1)
  })

  const mostProblematicCcp = [...ccpFailureBuckets.entries()]
    .sort((first, second) => second[1] - first[1])[0]

  return {
    cards: [
      createCard('quality-monitoring-total', 'Toplam Monitoring', formatNumber(monitoringRecords.length), 'HACCP izleme kayitlari', 'neutral'),
      createCard('quality-pass', 'PASS', formatNumber(passRecords.length), formatPercent(passRate), 'success'),
      createCard('quality-fail', 'FAIL', formatNumber(failRecords.length), formatPercent(failRate), failRecords.length > 0 ? 'danger' : 'success'),
      createCard('quality-pass-rate', 'PASS %', formatPercent(passRate), 'Basarili monitoring orani', passRate >= 90 ? 'success' : 'warning'),
      createCard('quality-fail-rate', 'FAIL %', formatPercent(failRate), 'Basarisiz monitoring orani', failRate > 10 ? 'danger' : 'success'),
      createCard('quality-samples', 'Toplam Sample', formatNumber(filteredSamples.length), 'Quality Sample kayitlari', 'neutral'),
      createCard('quality-witness', 'Toplam Witness Sample', formatNumber(filteredWitnessSamples.length), 'Sahit numune kayitlari', 'neutral'),
      createCard('quality-recalls', 'Recall Sayisi', formatNumber(filteredRecalls.length), 'Product Recall kayitlari', filteredRecalls.some(recall => recall.status !== 'COMPLETED' && recall.status !== 'CANCELLED') ? 'danger' : 'neutral'),
      createCard('quality-actions', 'Corrective Action', formatNumber(filteredCorrectiveActions.length), 'FAIL kayitlarina bagli faaliyetler', filteredCorrectiveActions.some(action => action.status !== 'COMPLETED' && action.status !== 'CANCELLED') ? 'warning' : 'success'),
      createCard('quality-verification', 'Verification', formatNumber(filteredVerificationRecords.length), 'Dogrulama kayitlari', 'success'),
      createCard('quality-problem-ccp', 'En Problemli CCP', mostProblematicCcp?.[0] || '-', mostProblematicCcp ? `${formatNumber(mostProblematicCcp[1])} FAIL` : 'FAIL kaydi yok', mostProblematicCcp ? 'danger' : 'success')
    ],
    monitoringTrend: createTrend(
      monitoringRecords,
      filters.period,
      record => record.checkedAt,
      () => 1,
      'Monitoring Trend',
      KPI_COLORS[0]
    ),
    recallTrend: createTrend(
      filteredRecalls,
      filters.period,
      recall => recall.reportedDate || recall.createdAt,
      () => 1,
      'Recall Trend',
      KPI_COLORS[4]
    ),
    ccpFailures: createBarRows(
      Array.from(ccpFailureBuckets.entries()).map(([label, value]) => ({
        id: label,
        label,
        value,
        tone: 'danger' as const
      })),
      8
    ),
    qualityStatus: createPieSlices([
      { id: 'pass', label: 'PASS', value: passRecords.length },
      { id: 'fail', label: 'FAIL', value: failRecords.length },
      { id: 'corrective-action', label: 'Corrective Action', value: filteredCorrectiveActions.length },
      { id: 'verification', label: 'Verification', value: filteredVerificationRecords.length },
      { id: 'recall', label: 'Recall', value: filteredRecalls.length }
    ])
  }
}
