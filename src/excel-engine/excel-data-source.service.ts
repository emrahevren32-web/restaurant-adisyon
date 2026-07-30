import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import { DeliveryNoteService, DELIVERY_NOTE_STATUS_LABELS } from '../delivery-notes/delivery-note.service'
import {
  GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS,
  GoodsReceiptService
} from '../goods-receipts/goods-receipt.service'
import { LabelService, LABEL_STATUS_LABELS } from '../label-management/label.service'
import { LABEL_TYPE_LABELS } from '../label-management/label-template.service'
import { createKpiDashboardView, createDefaultKpiFilters } from '../kpi-reporting/kpi.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import {
  formatCurrency,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  loadCategories,
  loadProducts,
  loadStockCategories,
  loadStockItems
} from '../storage'
import {
  QUALITY_FORM_STATUS_LABELS,
  QUALITY_FORM_TYPE_LABELS,
  QUALITY_INSPECTION_RESULT_LABELS,
  QUALITY_STATUS_LABELS,
  QualityFormService
} from '../quality-forms/quality-form.service'
import { SHIPMENT_TEMPERATURE_STAGE_LABELS } from '../shipment-forms/shipment-checklist.service'
import {
  SHIPMENT_CHECKLIST_STATUS_LABELS,
  SHIPMENT_FORM_STATUS_LABELS,
  SHIPMENT_FORM_TYPE_LABELS,
  ShipmentFormService
} from '../shipment-forms/shipment-form.service'
import {
  CHECKLIST_ITEM_STATUS_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_TYPE_LABELS,
  ChecklistService
} from '../operation-checklists/checklist.service'
import {
  PRODUCTION_PLAN_PRIORITY_LABELS,
  PRODUCTION_PLAN_STATUS_LABELS,
  PRODUCTION_PLAN_TYPE_LABELS,
  ProductionPlanningService
} from '../production-planning/production-planning.service'
import {
  CAPACITY_PLAN_STATUS_LABELS,
  CAPACITY_RISK_LABELS,
  CapacityPlanningService
} from '../capacity-planning/capacity-planning.service'
import {
  MACHINE_SCHEDULE_ITEM_STATUS_LABELS,
  MACHINE_SCHEDULE_STATUS_LABELS,
  MachineSchedulingService
} from '../machine-scheduling/machine-scheduling.service'
import {
  WORKFORCE_PLAN_ITEM_STATUS_LABELS,
  WORKFORCE_PLAN_STATUS_LABELS,
  WorkforcePlanningService
} from '../workforce-planning/workforce-planning.service'
import {
  BottleneckAnalysisService,
  BOTTLENECK_REPORT_STATUS_LABELS,
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_TYPE_LABELS
} from '../bottleneck-analysis/bottleneck-analysis.service'
import {
  WASTE_REASON_LABELS,
  WASTE_STATUS_LABELS,
  WASTE_TYPE_LABELS,
  WasteService
} from '../waste-management/waste.service'
import type { ExcelDataSet, ExcelExportOptions, ExcelModuleKey, ExcelRow } from './excel-engine.types'
import {
  EXCEL_MODULE_LABELS,
  getExcelTemplate
} from './excel-template.service'

const normalizeText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const getCategoryName = (
  categoryId: string,
  categories: Array<{ id: string; name: string }>
) => categories.find(category => category.id === categoryId)?.name || categoryId

const getSupplierName = (
  supplierId: string,
  suppliers: Array<{ id: string; name: string }>
) => suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId

const getStockItemName = (
  stockItemId: string,
  stockItems: Array<{ id: string; name: string }>
) => stockItems.find(item => item.id === stockItemId)?.name || stockItemId

const createDataSet = (
  moduleKey: ExcelModuleKey,
  rows: ExcelRow[]
): ExcelDataSet => ({
  moduleKey,
  moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
  columns: getExcelTemplate(moduleKey).columns,
  rows
})

const getProductRows = (): ExcelRow[] => {
  const categories = loadCategories()

  return loadProducts().map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    categoryName: getCategoryName(product.categoryId, categories),
    branchName: product.branchId,
    active: product.active,
    calories: product.calories,
    description: product.description || ''
  }))
}

const getStockRows = (): ExcelRow[] => {
  const categories = loadStockCategories()

  return loadStockItems().map(item => ({
    id: item.id,
    name: item.name,
    categoryName: getCategoryName(item.categoryId, categories),
    unit: item.unit,
    currentQty: item.currentQty,
    minQty: item.minQty,
    sku: item.sku || '',
    barcode: item.barcode || '',
    unitPurchasePrice: item.unitPurchasePrice || item.lastPurchasePrice || item.averageCost || 0,
    averageCost: item.averageCost || 0,
    lastPurchasePrice: item.lastPurchasePrice || 0,
    supplierName: item.lastSupplierName || '',
    active: item.active
  }))
}

const getRecipeRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.recipeRecords.flatMap(recipe => recipe.ingredients.map(ingredient => ({
    id: `${recipe.id}-${ingredient.id}`,
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    recipeType: recipe.recipeType,
    productName: recipe.productName,
    portions: recipe.portions,
    firePercent: recipe.firePercent,
    ingredientName: ingredient.materialName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    unitCost: ingredient.unitCost
  })))
}

const getSupplierRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.suppliers.map(supplier => ({
    id: supplier.id,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    tradeName: supplier.tradeName,
    type: supplier.type,
    companyType: supplier.companyType,
    contactName: supplier.contactName,
    contactPhone: supplier.contactPhone,
    contactEmail: supplier.contactEmail,
    city: supplier.city,
    leadTimeDays: supplier.leadTimeDays,
    paymentTermDays: supplier.paymentTermDays
  }))
}

const getPurchaseRequestRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.purchaseRequests.flatMap(record => record.items.map(item => ({
    id: `${record.id}-${item.id}`,
    requestNo: record.requestNo,
    title: record.title,
    requester: record.requester,
    branchName: sourceData.branches.find(branch => branch.id === record.branchId)?.name || record.branchId,
    warehouseName: sourceData.branches.find(branch => branch.id === record.warehouseId)?.name || record.warehouseId,
    department: record.department,
    priority: record.priority,
    requiredDate: record.requiredDate,
    stockItemName: getStockItemName(item.stockItemId, sourceData.stockItems),
    quantity: item.quantity,
    estimatedUnitPrice: item.estimatedUnitPrice,
    notes: item.notes || record.notes
  })))
}

const getPurchaseOrderRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.purchaseOrders.map(order => ({
    id: order.id,
    orderNo: order.orderNo,
    supplierName: getSupplierName(order.supplierId, sourceData.suppliers),
    orderDate: order.orderDate,
    status: order.status,
    grandTotal: order.grandTotal
  }))
}

const getGoodsReceiptRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const records = GoodsReceiptService.list(sourceData)

  return records.flatMap(record => {
    if(record.items.length === 0){
      return [{
        id: record.id,
        receiptNo: record.receiptNo,
        receiptDate: record.receiptDate,
        purchaseOrderNo: record.purchaseOrderNo || record.purchaseOrderId,
        supplierName: record.supplierName || record.supplierId,
        warehouseName: record.warehouseName || record.warehouseId,
        vehiclePlate: record.vehiclePlate || '',
        deliveredBy: record.deliveredBy || '',
        receivedByName: record.receivedByName || record.receivedBy,
        status: GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[record.status as keyof typeof GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS] || record.status,
        productName: '',
        lotNo: '',
        batchNo: '',
        receivedQuantity: 0,
        acceptedQuantity: 0,
        rejectedQuantity: 0,
        unit: '',
        packageType: '',
        netWeight: 0,
        grossWeight: 0,
        temperatureC: record.inspection?.temperatureC || 0,
        inspectionResult: record.inspection?.result || '',
        correctiveActionNote: record.inspection?.correctiveActionNote || '',
        totalCost: 0
      }]
    }

    return record.items.map(item => ({
      id: record.id,
      lineId: item.id,
      receiptNo: record.receiptNo,
      receiptDate: record.receiptDate,
      purchaseOrderNo: record.purchaseOrderNo || record.purchaseOrderId,
      supplierName: record.supplierName || record.supplierId,
      warehouseName: record.warehouseName || record.warehouseId,
      vehiclePlate: record.vehiclePlate || '',
      deliveredBy: record.deliveredBy || '',
      receivedByName: record.receivedByName || record.receivedBy,
      status: GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[record.status as keyof typeof GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS] || record.status,
      productName: item.productName || item.stockItemName || item.stockItemId,
      lotNo: item.lotNo || item.lotId || '',
      batchNo: item.batchNo || '',
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      unit: item.unit,
      packageType: item.packageType || '',
      netWeight: item.netWeight || 0,
      grossWeight: item.grossWeight || 0,
      temperatureC: record.inspection?.temperatureC || 0,
      inspectionResult: record.inspection?.result || '',
      correctiveActionNote: record.inspection?.correctiveActionNote || '',
      totalCost: item.totalCost || 0
    }))
  })
}

const getLotRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.inventoryLots.map(lot => ({
    id: lot.id,
    lotNo: lot.lotNo,
    productName: sourceData.productRefs.find(product => product.id === lot.productId)?.name || getStockItemName(lot.stockItemId, sourceData.stockItems),
    warehouseId: lot.warehouseId,
    quantity: lot.quantity,
    remainingQuantity: lot.remainingQuantity,
    expiryDate: lot.expiryDate
  }))
}

const getWasteRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const records = WasteService.list(sourceData)

  return records.flatMap(record => {
    const baseRow = {
      id: record.id,
      wasteNo: record.wasteNo,
      date: record.date,
      status: WASTE_STATUS_LABELS[record.status],
      wasteType: WASTE_TYPE_LABELS[record.wasteType],
      wasteReason: WASTE_REASON_LABELS[record.wasteReason],
      productName: record.productName || record.stockItemName,
      lotNo: record.lotNo,
      batchNo: record.batchNo,
      quantity: record.quantity,
      unit: record.unit,
      warehouseName: record.warehouseName,
      branchName: record.branchName,
      productionOrderNo: record.productionOrderNo,
      recipeName: record.recipeName,
      supplierName: record.supplierName,
      qualityDecision: record.qualityDecision,
      haccpReference: record.haccpReference,
      correctiveAction: record.correctiveAction,
      totalCost: record.totalCost,
      sourceType: record.sourceType
    }

    if(record.items.length === 0) return [baseRow]

    return record.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      productName: item.productName || baseRow.productName,
      lotNo: item.lotNo || baseRow.lotNo,
      batchNo: item.batchNo || baseRow.batchNo,
      quantity: item.quantity,
      unit: item.unit,
      totalCost: item.totalCost
    }))
  })
}

const getProductionOrderRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.productionOrders.flatMap(order => order.lines.map(line => ({
    id: `${order.id}-${line.id}`,
    workOrderNo: order.workOrderNo,
    branch: order.branch,
    status: order.status,
    productName: line.productName,
    quantity: line.quantity
  })))
}

const getProductionPlanningRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const plans = ProductionPlanningService.list(sourceData)

  return plans.flatMap(plan => {
    const baseRow = {
      id: plan.id,
      planNo: plan.planNo,
      planType: PRODUCTION_PLAN_TYPE_LABELS[plan.planType],
      status: PRODUCTION_PLAN_STATUS_LABELS[plan.status],
      planDate: plan.planDate,
      startDate: plan.startDate,
      endDate: plan.endDate,
      branchName: plan.branchName,
      facilityName: plan.facilityName,
      shift: plan.shift,
      responsiblePerson: plan.responsiblePerson,
      recommendationCount: plan.recommendations.length,
      sourceType: plan.sourceType
    }

    if(plan.items.length === 0) return [baseRow]

    return plan.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      productName: item.productName,
      productCode: item.productCode,
      recipeName: item.recipeName,
      demandQuantity: item.demandQuantity,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock,
      safetyStock: item.safetyStock,
      pendingProduction: item.pendingProduction,
      pendingOrderQuantity: item.pendingOrderQuantity,
      branchDemandQuantity: item.branchDemandQuantity,
      customerOrderQuantity: item.customerOrderQuantity,
      forecastQuantity: item.forecastQuantity,
      wastePercent: item.wastePercent,
      produceQuantity: item.produceQuantity,
      unit: item.unit,
      priority: PRODUCTION_PLAN_PRIORITY_LABELS[item.priority],
      estimatedMinutes: item.estimatedMinutes,
      productionLineName: item.productionLineName,
      capacityUsagePercent: item.capacityUsagePercent,
      recommendations: item.recommendations.join(' | ')
    }))
  })
}

const getCapacityPlanningRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const plans = CapacityPlanningService.list(sourceData)

  return plans.flatMap(plan => {
    const baseRow = {
      id: plan.id,
      capacityPlanNo: plan.capacityPlanNo,
      status: CAPACITY_PLAN_STATUS_LABELS[plan.status],
      planDate: plan.planDate,
      startDate: plan.startDate,
      endDate: plan.endDate,
      productionLineName: plan.productionLineName,
      workCenterName: plan.workCenterName,
      shift: plan.shift,
      responsiblePerson: plan.responsiblePerson,
      recommendationCount: plan.recommendations.length,
      sourceType: plan.sourceType
    }

    if(plan.items.length === 0){
      return plan.productionCapacities.map(capacity => ({
        ...baseRow,
        lineId: capacity.productionLineId,
        productionLineName: capacity.productionLineName,
        workCenterName: capacity.workCenterName,
        workingMinutes: capacity.workingMinutes,
        availableMinutes: capacity.availableMinutes,
        plannedProductionMinutes: capacity.plannedProductionMinutes,
        recipePreparationMinutes: capacity.recipePreparationMinutes,
        setupMinutes: capacity.setupMinutes,
        cleaningMinutes: capacity.cleaningMinutes,
        warehousePreparationMinutes: capacity.warehousePreparationMinutes,
        maintenanceMinutes: capacity.maintenanceMinutes,
        netProductionMinutes: capacity.netProductionMinutes,
        totalLoadMinutes: capacity.totalLoadMinutes,
        idleMinutes: capacity.idleMinutes,
        overloadMinutes: capacity.overloadMinutes,
        utilizationPercent: capacity.utilizationPercent,
        riskLevel: CAPACITY_RISK_LABELS[capacity.riskLevel],
        bottleneck: capacity.bottleneck,
        maintenanceClosed: capacity.maintenanceClosed,
        recommendations: capacity.recommendations.join(' | ')
      }))
    }

    return plan.items.map(item => {
      const machine = plan.machineCapacities.find(record => record.machineId === item.machineId)
      return {
        ...baseRow,
        lineId: item.id,
        sourceNo: item.sourceNo,
        productName: item.productName,
        recipeName: item.recipeName,
        plannedQuantity: item.plannedQuantity,
        unit: item.unit,
        productionLineName: item.productionLineName,
        workCenterName: item.workCenterName,
        machineCode: item.machineCode,
        machineName: item.machineName,
        workingMinutes: machine?.workingMinutes || 0,
        availableMinutes: item.availableMinutes,
        plannedProductionMinutes: item.plannedProductionMinutes,
        recipePreparationMinutes: item.recipePreparationMinutes,
        setupMinutes: item.setupMinutes,
        cleaningMinutes: item.cleaningMinutes,
        warehousePreparationMinutes: item.warehousePreparationMinutes,
        maintenanceMinutes: item.maintenanceMinutes,
        netProductionMinutes: item.netProductionMinutes,
        totalLoadMinutes: item.totalLoadMinutes,
        idleMinutes: item.idleMinutes,
        overloadMinutes: item.overloadMinutes,
        utilizationPercent: item.utilizationPercent,
        riskLevel: CAPACITY_RISK_LABELS[item.riskLevel],
        bottleneck: item.overloadMinutes > 0 || item.utilizationPercent >= 95,
        maintenanceClosed: machine?.maintenanceClosed || false,
        recommendations: item.recommendations.join(' | ')
      }
    })
  })
}

const getMachineSchedulingRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const schedules = MachineSchedulingService.list(sourceData)

  return schedules.flatMap((schedule): ExcelRow[] => {
    const baseRow: ExcelRow = {
      id: schedule.id,
      scheduleNo: schedule.scheduleNo,
      status: MACHINE_SCHEDULE_STATUS_LABELS[schedule.status],
      scheduleDate: schedule.scheduleDate,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      machineCode: schedule.machineCode,
      machineName: schedule.machineName,
      productionLineName: schedule.productionLineName,
      workCenterName: schedule.workCenterName,
      shift: schedule.shift,
      responsiblePerson: schedule.responsiblePerson,
      itemCount: schedule.items.length,
      queueCount: schedule.queues.length,
      timelineCount: schedule.timelines.length,
      conflictCount: schedule.items.filter(item => item.conflict).length,
      sourceType: schedule.sourceType,
      sourceCapacityPlanIds: schedule.sourceCapacityPlanIds.join(' | '),
      sourceProductionPlanIds: schedule.sourceProductionPlanIds.join(' | '),
      recommendations: schedule.recommendations.join(' | ')
    }

    if(schedule.items.length === 0){
      return schedule.timelines.map(timeline => ({
        ...baseRow,
        lineId: timeline.id,
        machineCode: timeline.machineCode,
        machineName: timeline.machineName,
        productionLineName: timeline.productionLineName,
        workCenterName: timeline.workCenterName,
        availableStartAt: timeline.availableStartAt,
        availableEndAt: timeline.availableEndAt,
        availableMinutes: timeline.availableMinutes,
        totalWorkingMinutes: timeline.busyMinutes,
        idleBeforeMinutes: timeline.idleMinutes,
        utilizationPercent: timeline.utilizationPercent,
        conflict: timeline.segments.some(segment => segment.conflict),
        itemStatus: 'Timeline'
      }))
    }

    return schedule.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      sourceCapacityPlanNo: item.sourceCapacityPlanNo,
      productName: item.productName,
      recipeName: item.recipeName,
      plannedQuantity: item.plannedQuantity,
      unit: item.unit,
      machineCode: item.machineCode,
      machineName: item.machineName,
      productionLineName: item.productionLineName,
      workCenterName: item.workCenterName,
      startAt: item.startAt,
      endAt: item.endAt,
      estimatedMinutes: item.estimatedMinutes,
      setupMinutes: item.setupMinutes,
      cleaningMinutes: item.cleaningMinutes,
      waitingMinutes: item.waitingMinutes,
      totalWorkingMinutes: item.totalWorkingMinutes,
      idleBeforeMinutes: item.idleBeforeMinutes,
      conflict: item.conflict,
      conflictReason: item.conflictReason,
      itemStatus: MACHINE_SCHEDULE_ITEM_STATUS_LABELS[item.status],
      sequenceNo: item.sequenceNo,
      recommendations: item.recommendations.length > 0 ? item.recommendations.join(' | ') : schedule.recommendations.join(' | ')
    }))
  })
}

const getWorkforcePlanningRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const plans = WorkforcePlanningService.list(sourceData)

  return plans.flatMap((plan): ExcelRow[] => {
    const baseRow: ExcelRow = {
      id: plan.id,
      planNo: plan.planNo,
      status: WORKFORCE_PLAN_STATUS_LABELS[plan.status],
      planDate: plan.planDate,
      startDate: plan.startDate,
      endDate: plan.endDate,
      employeeName: plan.employeeName,
      department: plan.department,
      shiftName: plan.shiftName,
      productionLineName: plan.productionLineName,
      machineCode: plan.machineCode,
      machineName: plan.machineName,
      responsiblePerson: plan.responsiblePerson,
      itemCount: plan.items.length,
      assignmentCount: plan.employeeAssignments.filter(assignment => assignment.assignmentCount > 0).length,
      missingEmployeeCount: plan.shiftAssignments.reduce((total, assignment) => total + assignment.missingEmployeeCount, 0),
      conflictCount: plan.items.filter(item => item.conflict).length,
      sourceType: plan.sourceType,
      sourceMachineScheduleIds: plan.sourceMachineScheduleIds.join(' | '),
      sourceCapacityPlanIds: plan.sourceCapacityPlanIds.join(' | '),
      sourceProductionPlanIds: plan.sourceProductionPlanIds.join(' | '),
      recommendations: plan.recommendations.join(' | ')
    }

    if(plan.items.length === 0){
      return plan.employeeAssignments.map(assignment => ({
        ...baseRow,
        lineId: assignment.id,
        employeeCode: assignment.employeeCode,
        employeeName: assignment.employeeName,
        department: assignment.department,
        shiftName: assignment.shiftName,
        workingMinutes: assignment.totalWorkingMinutes,
        idleMinutes: assignment.idleMinutes,
        utilizationPercent: assignment.utilizationPercent,
        conflict: assignment.conflictCount > 0,
        itemStatus: 'Assignment'
      }))
    }

    return plan.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      sourceMachineScheduleNo: item.sourceMachineScheduleNo,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      department: item.department,
      shiftName: item.shiftName,
      machineCode: item.machineCode,
      machineName: item.machineName,
      productionLineName: item.productionLineName,
      workCenterName: item.workCenterName,
      taskName: item.taskName,
      productName: item.productName,
      recipeName: item.recipeName,
      startAt: item.startAt,
      endAt: item.endAt,
      estimatedMinutes: item.estimatedMinutes,
      workingMinutes: item.workingMinutes,
      idleMinutes: item.idleMinutes,
      conflict: item.conflict,
      conflictReason: item.conflictReason,
      itemStatus: WORKFORCE_PLAN_ITEM_STATUS_LABELS[item.status],
      sequenceNo: item.sequenceNo,
      recommendations: item.recommendations.length > 0 ? item.recommendations.join(' | ') : plan.recommendations.join(' | ')
    }))
  })
}

const getBottleneckAnalysisRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const reports = BottleneckAnalysisService.list(sourceData)

  return reports.flatMap((report): ExcelRow[] => {
    const baseRow: ExcelRow = {
      id: report.id,
      reportNo: report.reportNo,
      status: BOTTLENECK_REPORT_STATUS_LABELS[report.status],
      reportDate: report.reportDate,
      startDate: report.startDate,
      endDate: report.endDate,
      productionLineName: report.productionLineName,
      machineCode: report.machineCode,
      machineName: report.machineName,
      employeeName: report.employeeName,
      workCenterName: report.workCenterName,
      riskLevel: report.riskLevel === 'all' ? 'Tum Riskler' : BOTTLENECK_RISK_LABELS[report.riskLevel],
      itemCount: report.items.length,
      criticalCount: report.items.filter(item => item.riskLevel === 'CRITICAL').length,
      recommendations: report.recommendations.join(' | ')
    }

    if(report.items.length === 0){
      return report.constraints.map(constraint => ({
        ...baseRow,
        lineId: constraint.id,
        bottleneckType: BOTTLENECK_TYPE_LABELS[constraint.entityType],
        entityName: constraint.entityName,
        riskLevel: BOTTLENECK_RISK_LABELS[constraint.riskLevel],
        utilizationPercent: constraint.utilizationPercent,
        waitingMinutes: constraint.waitingMinutes,
        setupMinutes: constraint.setupMinutes,
        cleaningMinutes: constraint.cleaningMinutes,
        workingMinutes: constraint.workingMinutes,
        idleMinutes: constraint.idleMinutes,
        sourceNo: constraint.sourceNo
      }))
    }

    return report.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      bottleneckType: BOTTLENECK_TYPE_LABELS[item.bottleneckType],
      riskLevel: BOTTLENECK_RISK_LABELS[item.riskLevel],
      riskScore: item.riskScore,
      entityCode: item.entityCode,
      entityName: item.entityName,
      productionLineName: item.productionLineName,
      machineCode: item.machineCode,
      machineName: item.machineName,
      employeeName: item.employeeName,
      workCenterName: item.workCenterName,
      shiftName: item.shiftName,
      utilizationPercent: item.utilizationPercent,
      waitingMinutes: item.waitingMinutes,
      setupMinutes: item.setupMinutes,
      cleaningMinutes: item.cleaningMinutes,
      workingMinutes: item.workingMinutes,
      idleMinutes: item.idleMinutes,
      overloadMinutes: item.overloadMinutes,
      maintenanceMinutes: item.maintenanceMinutes,
      missingPersonnel: item.missingPersonnel,
      sourceType: item.sourceType,
      sourceNo: item.sourceNo,
      recommendation: item.recommendation,
      reasons: item.reasons.map(reason => `${reason.label}: ${reason.value} ${reason.unit}`).join(' | ')
    }))
  })
}

const getQualityRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const qualityFormRows = QualityFormService.list(sourceData).flatMap(form => {
    const baseRow = {
      id: form.id,
      formNo: form.formNo,
      formType: QUALITY_FORM_TYPE_LABELS[form.formType],
      status: QUALITY_FORM_STATUS_LABELS[form.status],
      result: QUALITY_INSPECTION_RESULT_LABELS[form.result],
      inspectionDate: form.inspectionDate,
      inspector: form.inspector,
      productName: form.productName || form.stockItemName,
      lotNo: form.lotNo,
      batchNo: form.batchNo,
      supplierName: form.supplierName,
      warehouseName: form.warehouseName,
      branchName: form.branchName,
      productionOrderNo: form.productionOrderNo,
      goodsReceiptNo: form.goodsReceiptNo,
      recipeName: form.recipeName,
      sampleNo: form.sampleNo,
      witnessNo: form.witnessNo,
      haccpReference: form.haccpReference,
      score: form.score,
      decisionSummary: form.decision.summary,
      module: 'Quality Form'
    }

    if(form.inspections.length === 0) return [baseRow]

    return form.inspections.map(inspection => ({
      ...baseRow,
      lineId: inspection.id,
      criterionLabel: inspection.label,
      criterionStatus: QUALITY_STATUS_LABELS[inspection.status],
      criterionValue: inspection.value,
      criterionNotes: inspection.notes
    }))
  })
  const sampleRows = sourceData.qualitySamples.map(sample => ({
    id: sample.id,
    formNo: sample.sampleNo,
    formType: 'Quality Sample',
    module: 'Quality Sample',
    status: sample.status,
    result: sample.status === 'DISCARDED' ? 'FAIL' : sample.status === 'UNDER_REVIEW' ? 'CONDITIONAL' : 'PASS',
    inspectionDate: sample.sampleDate || sample.createdAt,
    inspector: sample.takenBy,
    productName: sourceData.inventoryLots.find(lot => lot.id === sample.inventoryLotId)?.lotNo || sample.inventoryLotId
  }))
  const recallRows = sourceData.productRecalls.map(recall => ({
    id: recall.id,
    formNo: recall.recallNo,
    formType: 'Product Recall',
    module: 'Product Recall',
    status: recall.status,
    result: recall.status === 'CANCELLED' || recall.status === 'COMPLETED' ? 'PASS' : 'CONDITIONAL',
    inspectionDate: recall.reportedDate || recall.createdAt,
    inspector: recall.createdBy,
    productName: sourceData.inventoryLots.find(lot => lot.id === recall.inventoryLotId)?.lotNo || recall.inventoryLotId
  }))

  return [...qualityFormRows, ...sampleRows, ...recallRows]
}

const getShipmentRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()

  return sourceData.shipments.flatMap(shipment => {
    if(shipment.items.length === 0){
      return [{
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        shipmentDate: shipment.shipmentDate,
        status: shipment.status,
        quantity: 0
      }]
    }

    return shipment.items.map(item => ({
      id: `${shipment.id}-${item.id}`,
      shipmentNo: shipment.shipmentNo,
      shipmentDate: shipment.shipmentDate,
      status: shipment.status,
      quantity: item.quantity
    }))
  })
}

const getDeliveryNoteRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const records = DeliveryNoteService.list(sourceData)

  return records.flatMap(record => {
    if(record.items.length === 0){
      return [{
        id: record.id,
        deliveryNoteNo: record.deliveryNoteNo,
        date: record.date,
        customerName: record.customerName,
        branchName: record.branchName,
        warehouseName: record.warehouseName,
        vehicleNo: record.vehicleNo,
        driverName: record.driverName,
        shipmentPlanNo: record.shipmentPlanNo,
        status: DELIVERY_NOTE_STATUS_LABELS[record.status],
        productName: '',
        lotNo: '',
        quantity: 0,
        unit: '',
        boxCount: 0,
        palletCount: 0,
        netWeight: 0,
        grossWeight: 0,
        totalCost: 0
      }]
    }

    return record.items.map(item => ({
      id: record.id,
      lineId: item.id,
      deliveryNoteNo: record.deliveryNoteNo,
      date: record.date,
      customerName: record.customerName,
      branchName: record.branchName,
      warehouseName: record.warehouseName,
      vehicleNo: `${record.vehicleNo} ${record.vehiclePlate}`.trim(),
      driverName: record.driverName,
      shipmentPlanNo: record.shipmentPlanNo,
      status: DELIVERY_NOTE_STATUS_LABELS[record.status],
      productName: item.productName,
      lotNo: item.lotNo,
      quantity: item.quantity,
      unit: item.unit,
      boxCount: item.boxCount,
      palletCount: item.palletCount,
      netWeight: item.netWeight,
      grossWeight: item.grossWeight,
      totalCost: item.totalCost
    }))
  })
}

const getShipmentFormRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const records = ShipmentFormService.list(sourceData)

  return records.flatMap(record => {
    const baseRow = {
      id: record.id,
      formNo: record.formNo,
      formType: SHIPMENT_FORM_TYPE_LABELS[record.formType],
      status: SHIPMENT_FORM_STATUS_LABELS[record.status],
      shipmentNo: record.shipmentNo,
      deliveryNoteNo: record.deliveryNoteNo,
      shipmentPlanNo: record.shipmentPlanNo,
      vehicleNo: record.vehicleNo,
      vehiclePlate: record.vehiclePlate,
      driverName: record.driverName,
      warehouseName: record.warehouseName,
      branchName: record.branchName,
      customerName: record.customerName,
      loadingDate: record.loadingDate,
      deliveryDate: record.deliveryDate,
      sourceType: record.sourceType
    }
    const itemRows = record.items.length > 0
      ? record.items.map(item => ({
        ...baseRow,
        lineId: item.id,
        productName: item.productName || item.stockItemName,
        lotNo: item.lotNo,
        labelNo: item.labelNo,
        quantity: item.quantity,
        unit: item.unit,
        boxCount: item.boxCount,
        palletCount: item.palletCount
      }))
      : [baseRow]
    const checklistRows = record.checklist.map(item => ({
      ...baseRow,
      lineId: item.id,
      checklistLabel: item.label,
      checklistStatus: SHIPMENT_CHECKLIST_STATUS_LABELS[item.status],
      checklistNotes: item.notes || item.description
    }))
    const temperatureRows = record.temperatureLogs.map(log => ({
      ...baseRow,
      lineId: log.id,
      temperatureStage: SHIPMENT_TEMPERATURE_STAGE_LABELS[log.stage],
      temperatureC: log.temperatureC,
      temperatureResult: SHIPMENT_CHECKLIST_STATUS_LABELS[log.result],
      temperatureNotes: log.notes
    }))

    return [...itemRows, ...checklistRows, ...temperatureRows]
  })
}

const getOperationChecklistRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const records = ChecklistService.list(sourceData)

  return records.flatMap(record => {
    const baseRow = {
      id: record.id,
      checklistNo: record.checklistNo,
      checklistType: CHECKLIST_TYPE_LABELS[record.checklistType],
      status: CHECKLIST_STATUS_LABELS[record.status],
      templateName: record.templateName,
      templateVersion: record.templateVersion,
      branchName: record.branchName,
      warehouseName: record.warehouseName,
      department: record.department,
      shift: record.shift,
      responsiblePerson: record.responsiblePerson,
      startAt: record.startAt,
      endAt: record.endAt,
      sourceType: record.sourceType,
      sourceNo: record.sourceNo,
      haccpReference: record.haccpReference,
      equipmentName: record.equipmentName,
      completionRate: record.execution.completionRate,
      completionRateText: formatPercent(record.execution.completionRate),
      failCount: record.execution.failCount,
      warningCount: record.execution.warningCount,
      passCount: record.execution.passCount
    }

    if(record.items.length === 0) return [baseRow]

    return record.items.map(item => ({
      ...baseRow,
      lineId: item.id,
      itemTitle: item.title,
      itemStatus: CHECKLIST_ITEM_STATUS_LABELS[item.status],
      itemNote: item.note,
      photoPlaceholder: item.photoPlaceholder,
      correctiveAction: item.correctiveAction
    }))
  })
}

const getLabelRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const labels = LabelService.list(sourceData)

  return labels.map(label => ({
    id: label.id,
    labelNo: label.labelNo,
    labelType: LABEL_TYPE_LABELS[label.labelType],
    status: LABEL_STATUS_LABELS[label.status],
    templateName: label.templateName,
    productName: label.productName,
    productCode: label.productCode,
    lotNo: label.lotNo,
    batchNo: label.batchNo,
    productionDate: label.productionDate,
    expiryDate: label.expiryDate,
    netWeight: label.netWeight,
    grossWeight: label.grossWeight,
    unit: label.unit,
    warehouseName: label.warehouseName,
    branchName: label.branchName,
    productionOrderNo: label.productionOrderNo,
    recipeName: label.recipeName,
    shipmentNo: label.shipmentNo,
    sampleNo: label.sampleNo,
    witnessNo: label.witnessNo,
    haccpPlanName: label.haccpPlanName,
    barcodeValue: label.barcodeValue,
    qrPayload: label.qrPayload
  }))
}

const getKpiRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const dashboard = createKpiDashboardView(sourceData, createDefaultKpiFilters())
  const groups = [
    ['Executive', dashboard.executive.cards],
    ['Production', dashboard.production.cards],
    ['Inventory', dashboard.inventory.cards],
    ['Quality', dashboard.quality.cards],
    ['Purchasing', dashboard.purchasing.cards],
    ['Shipment', dashboard.shipment.cards]
  ] as const

  return groups.flatMap(([area, cards]) => cards.map(card => ({
    id: `${area}-${card.id}`,
    area,
    metric: card.label,
    value: card.value,
    detail: card.detail
  })))
}

const getCostEngineRows = (): ExcelRow[] => {
  const sourceData = loadKpiSourceData()
  const view = createCostEngineView(sourceData, createDefaultCostEngineFilters())

  return view.records.map(record => ({
    id: record.id,
    productName: record.productName,
    recipeName: record.recipeName,
    totalCost: record.totalCost,
    costPerKg: record.costPerKg,
    fireImpact: record.fireImpact,
    purchaseImpact: record.purchaseImpact
  }))
}

const getRowsForModule = (
  moduleKey: ExcelModuleKey
): ExcelRow[] => {
  if(moduleKey === 'products') return getProductRows()
  if(moduleKey === 'recipes') return getRecipeRows()
  if(moduleKey === 'raw-materials') return getStockRows()
  if(moduleKey === 'suppliers') return getSupplierRows()
  if(moduleKey === 'purchase-requests') return getPurchaseRequestRows()
  if(moduleKey === 'purchase-orders') return getPurchaseOrderRows()
  if(moduleKey === 'goods-receipts') return getGoodsReceiptRows()
  if(moduleKey === 'stock') return getStockRows()
  if(moduleKey === 'lots') return getLotRows()
  if(moduleKey === 'waste') return getWasteRows()
  if(moduleKey === 'production-planning') return getProductionPlanningRows()
  if(moduleKey === 'capacity-planning') return getCapacityPlanningRows()
  if(moduleKey === 'machine-scheduling') return getMachineSchedulingRows()
  if(moduleKey === 'workforce-planning') return getWorkforcePlanningRows()
  if(moduleKey === 'bottleneck-analysis') return getBottleneckAnalysisRows()
  if(moduleKey === 'production-orders') return getProductionOrderRows()
  if(moduleKey === 'quality') return getQualityRows()
  if(moduleKey === 'shipments') return getShipmentRows()
  if(moduleKey === 'shipment-forms') return getShipmentFormRows()
  if(moduleKey === 'operation-checklists') return getOperationChecklistRows()
  if(moduleKey === 'delivery-notes') return getDeliveryNoteRows()
  if(moduleKey === 'labels') return getLabelRows()
  if(moduleKey === 'kpi') return getKpiRows()
  if(moduleKey === 'cost-engine') return getCostEngineRows()
  return []
}

const matchesFilter = (
  row: ExcelRow,
  filterText: string
) => {
  if(!filterText.trim()) return true
  const search = normalizeText(filterText)
  return Object.values(row).some(value => normalizeText(value).includes(search))
}

const applyExportScope = (
  rows: ExcelRow[],
  options: ExcelExportOptions
) => {
  const filteredRows = options.scope === 'ALL'
    ? rows
    : rows.filter(row => matchesFilter(row, options.filterText))

  if(options.scope !== 'SELECTED') return filteredRows

  const selectedIds = new Set(options.selectedRecordIds)
  return filteredRows.filter(row => selectedIds.has(String(row.id || '')))
}

export const ExcelDataSourceService = {
  getDataSet: (moduleKey: ExcelModuleKey, options?: ExcelExportOptions) => {
    const rows = getRowsForModule(moduleKey)
    return createDataSet(moduleKey, options ? applyExportScope(rows, options) : rows)
  },

  getDataSets: (options: ExcelExportOptions) => (
    options.moduleKeys.map(moduleKey => ExcelDataSourceService.getDataSet(moduleKey, options))
  ),

  summarizeRows: (moduleKey: ExcelModuleKey) => {
    const rows = getRowsForModule(moduleKey)
    const numericTotal = rows.reduce((total, row) => {
      const costValue = Number(row.totalCost || row.grandTotal || row.estimatedTotalCost || row.price || 0)
      return total + (Number.isFinite(costValue) ? costValue : 0)
    }, 0)

    return {
      moduleKey,
      moduleLabel: EXCEL_MODULE_LABELS[moduleKey],
      rowCount: rows.length,
      total: numericTotal > 0 ? formatCurrency(numericTotal) : formatNumber(rows.length),
      percent: rows.length > 0 ? formatPercent(100) : formatPercent(0)
    }
  }
}
