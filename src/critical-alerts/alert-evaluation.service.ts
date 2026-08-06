import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import { flattenHACCPMonitoringRecords } from '../haccp/haccp.mock'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { ChecklistService } from '../operation-checklists/checklist.service'
import { QualityFormService } from '../quality-forms/quality-form.service'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { GoodsReceiptService } from '../goods-receipts/goods-receipt.service'
import { createAlertHistory } from './alert-history.service'
import { getAlertRule } from './alert-rule.service'
import type {
  AlertCategory,
  AlertLevel,
  AlertPriority,
  AlertRule,
  AlertSourceModule,
  CriticalAlert
} from './critical-alert.types'

type AlertEvaluationInput = {
  sourceData: KpiSourceData
  getAlertNo: (index: number) => string
  actorName: string
  bottleneckReports?: ReturnType<typeof BottleneckAnalysisService.list>
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  improvementReports?: ReturnType<typeof ContinuousImprovementService.list>
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}

const DAY_MS = 86400000

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const daysUntil = (
  value: string
) => {
  const date = new Date(`${getDateKey(value)}T00:00:00`)
  if(Number.isNaN(date.getTime())) return 999
  const today = new Date(`${getTodayKey()}T00:00:00`)
  return Math.ceil((date.getTime() - today.getTime()) / DAY_MS)
}

const getBranchName = (
  sourceData: KpiSourceData,
  branchId: string
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId

const getLotNo = (
  sourceData: KpiSourceData,
  lotId: string
) => sourceData.inventoryLots.find(lot => lot.id === lotId)?.lotNo || lotId

const getPriorityFromLevel = (
  level: AlertLevel,
  riskScore: number
): AlertPriority => {
  if(level === 'CRITICAL' || riskScore >= 90) return 'URGENT'
  if(level === 'HIGH' || riskScore >= 70) return 'HIGH'
  if(level === 'WARNING' || riskScore >= 45) return 'NORMAL'
  return 'LOW'
}

const getImpactScore = ({
  level,
  repeatCount,
  riskScore
}: {
  level: AlertLevel
  repeatCount: number
  riskScore: number
}) => {
  const levelScore: Record<AlertLevel, number> = {
    INFO: 15,
    WARNING: 35,
    HIGH: 65,
    CRITICAL: 90
  }
  return Math.max(0, Math.min(100, roundKpi(
    levelScore[level] * 0.55
    + riskScore * 0.4
    + Math.min(15, repeatCount * 3)
  )))
}

const createAlert = ({
  actorName,
  alertNo,
  branchId = '',
  branchName = '',
  category,
  description,
  employeeId = '',
  employeeName = '',
  expectedImpact,
  level,
  lotId = '',
  lotNo = '',
  machineCode = '',
  machineId = '',
  machineName = '',
  productionLineId = '',
  productionLineName = '',
  reason,
  recommendedAction,
  relatedEntityId,
  relatedEntityName,
  relatedEntityType,
  riskScore,
  rule,
  sourceId,
  sourceModule,
  sourceNo,
  title
}: {
  actorName: string
  alertNo: string
  rule: AlertRule
  level?: AlertLevel
  category?: AlertCategory
  title?: string
  description?: string
  reason: string
  recommendedAction: string
  expectedImpact: string
  riskScore: number
  sourceModule?: AlertSourceModule
  sourceId: string
  sourceNo: string
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  branchId?: string
  branchName?: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  employeeId?: string
  employeeName?: string
  lotId?: string
  lotNo?: string
}): CriticalAlert => {
  const now = new Date().toISOString()
  const alertLevel = level || rule.level
  const repeatCount = 1
  const id = `critical_alert_${rule.code}_${relatedEntityId}_${sourceId}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  return {
    id,
    alertNo,
    ruleId: rule.id,
    status: 'ACTIVE',
    level: alertLevel,
    category: category || rule.category,
    priority: getPriorityFromLevel(alertLevel, riskScore),
    title: title || rule.title,
    description: description || rule.description,
    reason,
    recommendedAction,
    expectedImpact,
    riskScore: roundKpi(Math.max(0, Math.min(100, riskScore))),
    impactScore: getImpactScore({ level: alertLevel, repeatCount, riskScore }),
    durationMinutes: 0,
    repeatCount,
    sourceModule: sourceModule || rule.sourceModule,
    sourceId,
    sourceNo,
    relatedEntityType,
    relatedEntityId,
    relatedEntityName,
    branchId,
    branchName,
    productionLineId,
    productionLineName,
    machineId,
    machineCode,
    machineName,
    employeeId,
    employeeName,
    lotId,
    lotNo,
    createdAt: now,
    updatedAt: now,
    firstDetectedAt: now,
    lastDetectedAt: now,
    history: [
      createAlertHistory(id, 'CREATED', actorName, `${rule.title} alarmi uretildi.`)
    ]
  }
}

const withRule = (
  ruleId: string,
  callback: (rule: AlertRule) => CriticalAlert[]
) => {
  const rule = getAlertRule(ruleId)
  return rule?.enabled ? callback(rule) : []
}

const createStockAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const negativeRuleAlerts = withRule('alert-rule-negative-stock-risk', rule => input.sourceData.stockItems
    .filter(item => item.active && item.currentQty <= 0)
    .map(item => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'CRITICAL',
      reason: `${item.name} stogu ${item.currentQty} ${item.unit}; negatif veya sifir stok riski var.`,
      recommendedAction: 'Kritik stok nedeniyle satin alma veya depo transfer ihtiyaci manuel olarak degerlendirilmeli.',
      expectedImpact: 'Uretim durusu ve malzeme yoklugu riskini azaltir.',
      riskScore: 95,
      sourceId: item.id,
      sourceNo: item.sku || item.id,
      relatedEntityType: 'StockItem',
      relatedEntityId: item.id,
      relatedEntityName: item.name,
      branchId: item.branchId,
      branchName: getBranchName(input.sourceData, item.branchId)
    })))
  const criticalRuleAlerts = withRule('alert-rule-critical-stock', rule => input.sourceData.stockItems
    .filter(item => item.active && item.currentQty > 0 && item.currentQty <= item.minQty)
    .map(item => {
      const shortagePercent = percent(item.minQty - item.currentQty, item.minQty || 1)
      return createAlert({
        actorName: input.actorName,
        alertNo: input.getAlertNo(index++),
        rule,
        level: shortagePercent >= 50 ? 'CRITICAL' : 'HIGH',
        reason: `${item.name} mevcut ${item.currentQty} ${item.unit}, minimum ${item.minQty} ${item.unit}.`,
        recommendedAction: 'Kritik stok nedeniyle satin alma baslatilmali veya mevcut depo stoklari manuel kontrol edilmeli.',
        expectedImpact: 'Malzeme yoklugu ve uretim gecikmesi riskini dusurur.',
        riskScore: Math.min(100, 70 + shortagePercent / 2),
        sourceId: item.id,
        sourceNo: item.sku || item.id,
        relatedEntityType: 'StockItem',
        relatedEntityId: item.id,
        relatedEntityName: item.name,
        branchId: item.branchId,
        branchName: getBranchName(input.sourceData, item.branchId)
      })
    }))

  return [...negativeRuleAlerts, ...criticalRuleAlerts]
}

const createLotAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const expiryAlerts = withRule('alert-rule-expiry-near', rule => input.sourceData.inventoryLots
    .filter(lot => lot.status !== 'CONSUMED' && lot.status !== 'DISPOSED' && lot.status !== 'EXPIRED')
    .map(lot => ({ lot, days: daysUntil(lot.expiryDate) }))
    .filter(row => row.days <= 14)
    .map(({ lot, days }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: days <= 0 ? 'CRITICAL' : days <= 7 ? 'HIGH' : 'WARNING',
      reason: `${lot.lotNo} SKT ${lot.expiryDate}; ${days <= 0 ? 'suresi doldu' : `${days} gun kaldi`}.`,
      recommendedAction: 'Lot FEFO, kalite ve sevkiyat uygunlugu manuel olarak kontrol edilmeli.',
      expectedImpact: 'SKT kaynakli kalite, fire ve sevkiyat riskini azaltir.',
      riskScore: days <= 0 ? 95 : days <= 7 ? 78 : 55,
      sourceId: lot.id,
      sourceNo: lot.lotNo,
      relatedEntityType: 'InventoryLot',
      relatedEntityId: lot.id,
      relatedEntityName: lot.lotNo,
      branchId: lot.warehouseId,
      branchName: getBranchName(input.sourceData, lot.warehouseId),
      lotId: lot.id,
      lotNo: lot.lotNo
    })))
  const recallAlerts = withRule('alert-rule-recall-risk', rule => input.sourceData.productRecalls
    .filter(recall => recall.status !== 'COMPLETED' && recall.status !== 'CANCELLED')
    .map(recall => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: recall.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      reason: `${getLotNo(input.sourceData, recall.inventoryLotId)} icin ${recall.recallNo} aktif recall kaydi var.`,
      recommendedAction: 'Lot geri cagirma sureci kalite, depo ve sevkiyat tarafinda manuel olarak koordine edilmeli.',
      expectedImpact: 'Riskli lotun musteriye/sevkiyata etkisini sinirlar.',
      riskScore: recall.riskLevel === 'CRITICAL' ? 95 : 82,
      sourceId: recall.id,
      sourceNo: recall.recallNo,
      relatedEntityType: 'ProductRecall',
      relatedEntityId: recall.id,
      relatedEntityName: getLotNo(input.sourceData, recall.inventoryLotId),
      lotId: recall.inventoryLotId,
      lotNo: getLotNo(input.sourceData, recall.inventoryLotId)
    })))

  return [...expiryAlerts, ...recallAlerts]
}

const createHaccpAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  return withRule('alert-rule-haccp-fail', rule => flattenHACCPMonitoringRecords(input.sourceData.haccpRecords)
    .filter(record => record.result === 'FAIL')
    .slice(0, 20)
    .map(record => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'CRITICAL',
      reason: `HACCP izleme başarısız: ölçülen ${record.measuredValue}, limit ${record.criticalLimit}.`,
      recommendedAction: 'HACCP kritik limit asimi icin corrective action ve kalite izolasyonu manuel degerlendirilmeli.',
      expectedImpact: 'Gida guvenligi ve izlenebilirlik riskini azaltir.',
      riskScore: 96,
      sourceId: record.id,
      sourceNo: record.ccpId,
      relatedEntityType: 'HACCPMonitoring',
      relatedEntityId: record.id,
      relatedEntityName: record.ccpId,
      lotId: record.inventoryLotId,
      lotNo: getLotNo(input.sourceData, record.inventoryLotId)
    })))
}

const createQualityAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const qualityAlerts = withRule('alert-rule-quality-fail', rule => QualityFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .filter(form => form.result === 'FAIL' || form.inspections.some(inspection => inspection.status === 'FAIL'))
    .map(form => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: form.result === 'FAIL' ? 'CRITICAL' : 'HIGH',
      reason: `${form.formNo} kalite formunda başarısız sonuç veya kriter tespit edildi.`,
      recommendedAction: 'Kalite başarısızlık oranı kritik seviyeye ulaştı; lot, ürün ve tedarikçi etkisi manuel incelenmeli.',
      expectedImpact: 'Kalite uygunsuzluklarinin sevkiyat ve uretim etkisini azaltir.',
      riskScore: form.result === 'FAIL' ? 92 : 78,
      sourceModule: 'QualityForms',
      sourceId: form.id,
      sourceNo: form.formNo,
      relatedEntityType: 'QualityForm',
      relatedEntityId: form.id,
      relatedEntityName: form.productName || form.stockItemName || form.formNo,
      branchId: form.branchId,
      branchName: form.branchName,
      lotId: form.lotId,
      lotNo: form.lotNo
    })))
  const checklistAlerts = withRule('alert-rule-quality-fail', rule => ChecklistService.list(input.sourceData)
    .filter(record => record.status !== 'CANCELLED')
    .filter(record => record.execution.failCount > 0 || record.execution.completionRate < 80)
    .map(record => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: record.execution.failCount > 0 ? 'HIGH' : 'WARNING',
      category: 'QUALITY',
      title: 'Operasyon kontrol listesi başarısız',
      reason: `${record.checklistNo} kontrol listesi ${record.execution.failCount} başarısız madde ve ${record.execution.completionRate}% tamamlanma ile alarm üretir.`,
      recommendedAction: 'Operations checklist uygunsuzluklari kalite ve operasyon sorumlusu tarafindan manuel kapatilmali.',
      expectedImpact: 'Operasyon standardi ve HACCP uygulama riskini azaltir.',
      riskScore: Math.min(100, 55 + record.execution.failCount * 12 + (100 - record.execution.completionRate) / 2),
      sourceModule: 'OperationsChecklists',
      sourceId: record.id,
      sourceNo: record.checklistNo,
      relatedEntityType: 'OperationChecklist',
      relatedEntityId: record.id,
      relatedEntityName: record.templateName,
      branchId: record.branchId,
      branchName: record.branchName
    })))
  const shipmentFormAlerts = withRule('alert-rule-quality-fail', rule => ShipmentFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .filter(form => form.checklist.some(item => item.status === 'FAIL') || form.temperatureLogs.some(log => log.result === 'FAIL'))
    .map(form => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'HIGH',
      category: 'SHIPMENT',
      title: 'Sevkiyat formu başarısız',
      reason: `${form.formNo} sevkiyat formunda kontrol listesi veya sıcaklık başarısız sonucu var.`,
      recommendedAction: 'Sevkiyat soguk zincir, arac ve yukleme kontrolleri manuel degerlendirilmeli.',
      expectedImpact: 'Sevkiyat kalite ve teslimat riskini azaltir.',
      riskScore: 82,
      sourceModule: 'ShipmentForms',
      sourceId: form.id,
      sourceNo: form.formNo,
      relatedEntityType: 'ShipmentForm',
      relatedEntityId: form.id,
      relatedEntityName: form.shipmentNo || form.deliveryNoteNo || form.formNo,
      branchId: form.branchId,
      branchName: form.branchName
    })))

  return [...qualityAlerts, ...checklistAlerts, ...shipmentFormAlerts]
}

const createPlanningAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const capacityPlans = input.capacityPlans || CapacityPlanningService.list(input.sourceData)
  const machineSchedules = input.machineSchedules || MachineSchedulingService.list(input.sourceData)
  const workforcePlans = input.workforcePlans || WorkforcePlanningService.list(input.sourceData)

  const capacityAlerts = withRule('alert-rule-capacity-full', rule => capacityPlans
    .filter(plan => plan.status !== 'CANCELLED')
    .flatMap(plan => plan.productionCapacities.map(capacity => ({ plan, capacity })))
    .filter(row => row.capacity.utilizationPercent >= 100 || row.capacity.overloadMinutes > 0)
    .map(({ plan, capacity }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: capacity.utilizationPercent >= 110 ? 'CRITICAL' : 'HIGH',
      reason: `${capacity.productionLineName} kapasitesi ${capacity.utilizationPercent}% ve asiri yuk ${capacity.overloadMinutes} dk.`,
      recommendedAction: 'Hat kapasitesi %100; ek vardiya veya alternatif hat manuel olarak degerlendirilmeli.',
      expectedImpact: 'Uretim gecikmesi ve asiri kapasite riskini azaltir.',
      riskScore: Math.min(100, capacity.utilizationPercent + capacity.overloadMinutes / 20),
      sourceId: plan.id,
      sourceNo: plan.capacityPlanNo,
      relatedEntityType: 'ProductionLine',
      relatedEntityId: capacity.productionLineId,
      relatedEntityName: capacity.productionLineName,
      productionLineId: capacity.productionLineId,
      productionLineName: capacity.productionLineName
    })))
  const machineAlerts = withRule('alert-rule-machine-conflict', rule => machineSchedules
    .filter(schedule => schedule.status !== 'CANCELLED')
    .flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(row => row.queue.conflictCount > 0)
    .map(({ schedule, queue }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'HIGH',
      reason: `${queue.machineCode} uzerinde ${queue.conflictCount} cizelge cakismasi tespit edildi.`,
      recommendedAction: 'Makine cizelgesi manuel olarak kontrol edilmeli; otomatik yeniden planlama uygulanmaz.',
      expectedImpact: 'Makine bekleme ve gecikme zinciri riskini azaltir.',
      riskScore: Math.min(100, 70 + queue.conflictCount * 8),
      sourceId: schedule.id,
      sourceNo: schedule.scheduleNo,
      relatedEntityType: 'MachineQueue',
      relatedEntityId: queue.id,
      relatedEntityName: queue.machineName,
      productionLineId: queue.productionLineId,
      productionLineName: queue.productionLineName,
      machineId: queue.machineId,
      machineCode: queue.machineCode,
      machineName: queue.machineName
    })))
  const waitingAlerts = withRule('alert-rule-waiting-critical', rule => machineSchedules
    .filter(schedule => schedule.status !== 'CANCELLED')
    .flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(row => row.queue.totalWaitingMinutes >= 180)
    .map(({ schedule, queue }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: queue.totalWaitingMinutes >= 360 ? 'CRITICAL' : 'HIGH',
      reason: `${queue.machineCode} kuyruk beklemesi ${queue.totalWaitingMinutes} dk.`,
      recommendedAction: 'Bekleme suresi kritik; hat, makine ve vardiya etkisi manuel analiz edilmeli.',
      expectedImpact: 'Bekleme kaynakli uretim gecikmesini azaltir.',
      riskScore: Math.min(100, 65 + queue.totalWaitingMinutes / 12),
      sourceModule: 'MachineScheduling',
      sourceId: schedule.id,
      sourceNo: schedule.scheduleNo,
      relatedEntityType: 'MachineQueue',
      relatedEntityId: queue.id,
      relatedEntityName: queue.machineName,
      productionLineId: queue.productionLineId,
      productionLineName: queue.productionLineName,
      machineId: queue.machineId,
      machineCode: queue.machineCode,
      machineName: queue.machineName
    })))
  const setupAlerts = withRule('alert-rule-setup-critical', rule => machineSchedules
    .filter(schedule => schedule.status !== 'CANCELLED')
    .flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(row => row.queue.totalSetupMinutes + row.queue.totalCleaningMinutes >= 60)
    .map(({ schedule, queue }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: queue.totalSetupMinutes >= 120 ? 'HIGH' : 'WARNING',
      reason: `${queue.machineCode} setup/temizlik toplam ${queue.totalSetupMinutes + queue.totalCleaningMinutes} dk.`,
      recommendedAction: 'Setup suresi kritik; recete bloklama ve temizlik sirasi manuel gozden gecirilmeli.',
      expectedImpact: 'Net uretim suresini artirir.',
      riskScore: Math.min(100, 45 + (queue.totalSetupMinutes + queue.totalCleaningMinutes) / 3),
      sourceId: schedule.id,
      sourceNo: schedule.scheduleNo,
      relatedEntityType: 'MachineQueue',
      relatedEntityId: queue.id,
      relatedEntityName: queue.machineName,
      productionLineId: queue.productionLineId,
      productionLineName: queue.productionLineName,
      machineId: queue.machineId,
      machineCode: queue.machineCode,
      machineName: queue.machineName
    })))
  const personnelAlerts = withRule('alert-rule-personnel-gap', rule => workforcePlans
    .filter(plan => plan.status !== 'CANCELLED')
    .flatMap(plan => plan.shiftAssignments.map(assignment => ({ plan, assignment })))
    .filter(row => row.assignment.missingEmployeeCount > 0 || row.assignment.conflictCount > 0)
    .map(({ plan, assignment }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: assignment.missingEmployeeCount > 1 ? 'CRITICAL' : 'HIGH',
      reason: `${assignment.shiftName} vardiyasinda ${assignment.missingEmployeeCount} eksik personel ve ${assignment.conflictCount} cakisma var.`,
      recommendedAction: 'Personel eksikligi ve vardiya cakismasi manuel personel planlama tarafindan degerlendirilmeli.',
      expectedImpact: 'Vardiya baslama gecikmesi ve uretim kapasite kaybini azaltir.',
      riskScore: Math.min(100, 70 + assignment.missingEmployeeCount * 10 + assignment.conflictCount * 8),
      sourceId: plan.id,
      sourceNo: plan.planNo,
      relatedEntityType: 'ShiftAssignment',
      relatedEntityId: assignment.id,
      relatedEntityName: assignment.shiftName,
      productionLineId: plan.productionLineId,
      productionLineName: plan.productionLineName
    })))

  return [...capacityAlerts, ...machineAlerts, ...waitingAlerts, ...setupAlerts, ...personnelAlerts]
}

const createBottleneckAndImprovementAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const bottleneckReports = input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData)
  const improvementReports = input.improvementReports || ContinuousImprovementService.list(input.sourceData)

  const bottleneckAlerts = withRule('alert-rule-waiting-critical', rule => bottleneckReports
    .filter(report => report.status !== 'CANCELLED')
    .flatMap(report => report.items.map(item => ({ report, item })))
    .filter(row => row.item.riskLevel === 'CRITICAL' || row.item.waitingMinutes >= 180)
    .map(({ report, item }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: item.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      category: item.bottleneckType === 'PERSONNEL' ? 'PERSONNEL' : item.bottleneckType === 'MAINTENANCE' ? 'MAINTENANCE' : 'PRODUCTION',
      title: 'Bottleneck kritik alarm',
      reason: `${item.entityName} bottleneck risk skoru ${item.riskScore}; bekleme ${item.waitingMinutes} dk.`,
      recommendedAction: 'Bottleneck Analysis detaylari manuel olarak incelenmeli; otomatik optimizasyon uygulanmaz.',
      expectedImpact: 'Kritik darbogaz kaynakli gecikme riskini azaltir.',
      riskScore: item.riskScore,
      sourceModule: 'BottleneckAnalysis',
      sourceId: report.id,
      sourceNo: report.reportNo,
      relatedEntityType: 'BottleneckItem',
      relatedEntityId: item.id,
      relatedEntityName: item.entityName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      employeeId: item.employeeId,
      employeeName: item.employeeName
    })))
  const maintenanceAlerts = withRule('alert-rule-maintenance-impact', rule => improvementReports
    .filter(report => report.status !== 'CANCELLED')
    .flatMap(report => report.opportunities.map(opportunity => ({ report, opportunity })))
    .filter(row => row.opportunity.area === 'MAINTENANCE' && row.opportunity.priority === 'URGENT')
    .map(({ report, opportunity }) => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'HIGH',
      reason: `${opportunity.entityName} bakim etkisi ${opportunity.maintenanceMinutes} dk ve acil iyilestirme firsati.`,
      recommendedAction: 'Hat-3 bakim planina alinmali veya bakim penceresi manuel degerlendirilmeli.',
      expectedImpact: 'Bakim kaynakli kapasite kaybini azaltir.',
      riskScore: opportunity.expectedBenefitScore,
      sourceModule: 'ContinuousImprovement',
      sourceId: report.id,
      sourceNo: report.reportNo,
      relatedEntityType: 'ImprovementOpportunity',
      relatedEntityId: opportunity.id,
      relatedEntityName: opportunity.entityName,
      productionLineId: opportunity.productionLineId,
      productionLineName: opportunity.productionLineName,
      machineId: opportunity.machineId,
      machineCode: opportunity.machineCode,
      machineName: opportunity.machineName
    })))

  return [...bottleneckAlerts, ...maintenanceAlerts]
}

const createShipmentAndReceiptAlerts = (
  input: AlertEvaluationInput,
  startIndex: number
) => {
  let index = startIndex
  const shipmentAlerts = withRule('alert-rule-shipment-delay', rule => input.sourceData.shipmentPlans
    .filter(plan => plan.status !== 'COMPLETED' && plan.status !== 'CANCELLED' && getDateKey(plan.planDate) < getTodayKey())
    .map(plan => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: 'HIGH',
      reason: `${plan.shipmentPlanNo} plan tarihi ${plan.planDate}; sevkiyat tamamlanmamis.`,
      recommendedAction: 'Sevkiyat gecikmesi rota, arac ve teslimat ekipleriyle manuel degerlendirilmeli.',
      expectedImpact: 'Geciken sevkiyatlarin musteri ve sube etkisini azaltir.',
      riskScore: 80,
      sourceId: plan.id,
      sourceNo: plan.shipmentPlanNo,
      relatedEntityType: 'ShipmentPlan',
      relatedEntityId: plan.id,
      relatedEntityName: plan.shipmentPlanNo
    })))
  const receiptAlerts = withRule('alert-rule-goods-receipt-reject', rule => GoodsReceiptService.list(input.sourceData)
    .filter(receipt => receipt.status === 'REJECTED' || receipt.status === 'PARTIAL_ACCEPTED')
    .map(receipt => createAlert({
      actorName: input.actorName,
      alertNo: input.getAlertNo(index++),
      rule,
      level: receipt.status === 'REJECTED' ? 'CRITICAL' : 'HIGH',
      reason: `${receipt.receiptNo} mal kabul durumu ${receipt.status}; red miktari ${receipt.items.reduce((total, item) => total + item.rejectedQuantity, 0)}.`,
      recommendedAction: 'Mal kabul red riski tedarikçi, kalite ve satın alma tarafında manuel incelenmeli.',
      expectedImpact: 'Uygunsuz hammadde ve tedarikçi riskini azaltır.',
      riskScore: receipt.status === 'REJECTED' ? 92 : 78,
      sourceId: receipt.id,
      sourceNo: receipt.receiptNo,
      relatedEntityType: 'GoodsReceipt',
      relatedEntityId: receipt.id,
      relatedEntityName: receipt.supplierName || receipt.supplierId || receipt.receiptNo,
      branchId: receipt.warehouseId,
      branchName: receipt.warehouseName
    })))

  return [...shipmentAlerts, ...receiptAlerts]
}

const createEvaluationContext = (
  input: AlertEvaluationInput
): AlertEvaluationInput => {
  const capacityPlans = input.capacityPlans || CapacityPlanningService.list(input.sourceData)
  const machineSchedules = input.machineSchedules || MachineSchedulingService.list(input.sourceData)
  const workforcePlans = input.workforcePlans || WorkforcePlanningService.list(input.sourceData, { machineSchedules })
  const bottleneckReports = input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData, {
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const improvementReports = input.improvementReports || ContinuousImprovementService.list(input.sourceData, {
    bottleneckReports,
    capacityPlans,
    machineSchedules,
    workforcePlans
  })

  return {
    ...input,
    bottleneckReports,
    capacityPlans,
    improvementReports,
    machineSchedules,
    workforcePlans
  }
}

const ensureUniqueAlertIds = (
  alerts: CriticalAlert[]
) => {
  const seen = new Map<string, number>()

  return alerts.map(alert => {
    const currentCount = seen.get(alert.id) || 0
    seen.set(alert.id, currentCount + 1)
    if(currentCount === 0) return alert

    const uniqueId = `${alert.id}_${currentCount + 1}`
    return {
      ...alert,
      id: uniqueId,
      history: alert.history.map(history => ({
        ...history,
        id: history.id.replace(alert.id, uniqueId),
        alertId: uniqueId
      }))
    }
  })
}

export const evaluateCriticalAlerts = (
  input: AlertEvaluationInput
) => {
  const context = createEvaluationContext(input)
  const buckets: CriticalAlert[][] = []
  let index = 0
  const append = (records: CriticalAlert[]) => {
    buckets.push(records)
    index += records.length
  }

  append(createStockAlerts(context, index))
  append(createLotAlerts(context, index))
  append(createHaccpAlerts(context, index))
  append(createQualityAlerts(context, index))
  append(createPlanningAlerts(context, index))
  append(createBottleneckAndImprovementAlerts(context, index))
  append(createShipmentAndReceiptAlerts(context, index))

  const sortedAlerts = buckets.flat().sort((first, second) => (
    second.riskScore - first.riskScore
    || first.category.localeCompare(second.category)
    || first.title.localeCompare(second.title, 'tr-TR')
  ))

  return ensureUniqueAlertIds(sortedAlerts)
}

export const AlertEvaluationService = {
  evaluate: evaluateCriticalAlerts
}
