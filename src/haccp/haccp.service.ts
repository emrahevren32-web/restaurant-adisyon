import type {
  CorrectiveAction,
  CriticalControlPoint,
  HACCPActionStatus,
  HACCPPlanRecord,
  MonitoringRecord,
  VerificationRecord
} from './haccp.types'
import {
  flattenHACCPCorrectiveActions,
  flattenHACCPCCPs,
  flattenHACCPHazards,
  flattenHACCPMonitoringRecords,
  flattenHACCPVerificationRecords
} from './haccp.mock'

export type HACCPDashboardSummary = {
  todayMonitoringCount: number
  successfulMonitoringCount: number
  failedMonitoringCount: number
  openCorrectiveActionCount: number
  todayVerificationCount: number
}

export type HACCPDataIndex = {
  ccpMap: Map<string, CriticalControlPoint>
  ccpPlanMap: Map<string, HACCPPlanRecord>
  monitoringMap: Map<string, MonitoringRecord>
  correctiveActionMap: Map<string, CorrectiveAction>
  correctiveActionsByMonitoringId: Map<string, CorrectiveAction[]>
  verificationsByMonitoringId: Map<string, VerificationRecord[]>
}

const getDateKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const groupBy = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string
) => records.reduce((groups, record) => {
  const key = getKey(record)
  if(!key) return groups
  const currentRecords = groups.get(key) || []
  currentRecords.push(record)
  groups.set(key, currentRecords)
  return groups
}, new Map<string, TRecord[]>())

export const createHACCPDataIndex = (
  records: HACCPPlanRecord[]
): HACCPDataIndex => {
  const ccps = flattenHACCPCCPs(records)
  const monitoringRecords = flattenHACCPMonitoringRecords(records)
  const correctiveActions = flattenHACCPCorrectiveActions(records)
  const verificationRecords = flattenHACCPVerificationRecords(records)
  const ccpPlanMap = new Map<string, HACCPPlanRecord>()

  records.forEach(plan => {
    plan.criticalControlPoints.forEach(ccp => ccpPlanMap.set(ccp.id, plan))
  })

  return {
    ccpMap: new Map(ccps.map(ccp => [ccp.id, ccp])),
    ccpPlanMap,
    monitoringMap: new Map(monitoringRecords.map(record => [record.id, record])),
    correctiveActionMap: new Map(correctiveActions.map(action => [action.id, action])),
    correctiveActionsByMonitoringId: groupBy(correctiveActions, action => action.monitoringRecordId),
    verificationsByMonitoringId: groupBy(verificationRecords, record => record.monitoringRecordId)
  }
}

export const calculateHACCPDashboardSummary = (
  records: HACCPPlanRecord[]
): HACCPDashboardSummary => {
  const monitoringRecords = flattenHACCPMonitoringRecords(records)
  const correctiveActions = flattenHACCPCorrectiveActions(records)
  const verificationRecords = flattenHACCPVerificationRecords(records)
  const today = todayKey()

  return {
    todayMonitoringCount: monitoringRecords.filter(record => getDateKey(record.checkedAt) === today).length,
    successfulMonitoringCount: monitoringRecords.filter(record => record.result === 'PASS').length,
    failedMonitoringCount: monitoringRecords.filter(record => record.result === 'FAIL').length,
    openCorrectiveActionCount: correctiveActions.filter(action => (
      action.status === 'OPEN' || action.status === 'IN_PROGRESS'
    )).length,
    todayVerificationCount: verificationRecords.filter(record => getDateKey(record.verifiedAt) === today).length
  }
}

export const getPlanForCCP = (
  records: HACCPPlanRecord[],
  ccpId: string
) => records.find(record => record.criticalControlPoints.some(ccp => ccp.id === ccpId)) || null

export const replacePlanRecord = (
  records: HACCPPlanRecord[],
  nextPlan: HACCPPlanRecord
) => records.map(record => record.id === nextPlan.id ? nextPlan : record)

export const addMonitoringToPlan = (
  records: HACCPPlanRecord[],
  planId: string,
  monitoringRecord: MonitoringRecord,
  correctiveAction: CorrectiveAction | null
) => records.map(record => {
  if(record.id !== planId) return record

  return {
    ...record,
    monitoringRecords: [monitoringRecord, ...record.monitoringRecords],
    correctiveActions: correctiveAction
      ? [correctiveAction, ...record.correctiveActions]
      : record.correctiveActions,
    updatedAt: new Date().toISOString()
  }
})

export const updateCorrectiveActionStatus = (
  records: HACCPPlanRecord[],
  actionId: string,
  status: HACCPActionStatus
) => records.map(record => ({
  ...record,
  correctiveActions: record.correctiveActions.map(action => {
    if(action.id !== actionId) return action
    return {
      ...action,
      status,
      completedAt: status === 'COMPLETED' ? new Date().toISOString() : status === 'CANCELLED' ? action.completedAt : ''
    }
  })
}))

export const addVerificationToPlan = (
  records: HACCPPlanRecord[],
  verificationRecord: VerificationRecord
) => records.map(record => {
  if(record.id !== verificationRecord.planId) return record
  return {
    ...record,
    verificationRecords: [verificationRecord, ...record.verificationRecords],
    updatedAt: new Date().toISOString()
  }
})

export const getHACCPCounts = (
  records: HACCPPlanRecord[]
) => ({
  plans: records.length,
  ccps: flattenHACCPCCPs(records).length,
  hazards: flattenHACCPHazards(records).length,
  monitoringRecords: flattenHACCPMonitoringRecords(records).length,
  correctiveActions: flattenHACCPCorrectiveActions(records).length,
  verificationRecords: flattenHACCPVerificationRecords(records).length
})
