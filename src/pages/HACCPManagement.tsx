import React from 'react'
import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import {
  isProductionInventoryLot,
  loadLotSystemInventoryLotRecords
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLotProductReference } from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import { loadIntermediateProducts } from '../intermediate-products/intermediate-product.mock'
import type { IntermediateProduct } from '../intermediate-products/intermediate-product.types'
import { loadProductionWorkOrders } from '../production-work-orders/production-work-order.mock'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import { loadQualitySampleRecords } from '../quality-samples/quality-sample.mock'
import type { QualitySample } from '../quality-samples/quality-sample.types'
import { loadBranches, loadStockItems } from '../storage'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Branch, StockItem, StockUnit, User } from '../types'
import {
  HACCP_ACTION_STATUSES,
  HACCP_ACTION_STATUS_LABELS,
  HACCP_CCP_STATUS_LABELS,
  HACCP_PLAN_STATUS_LABELS,
  HACCP_PRODUCTION_STAGE_LABELS,
  HACCP_RISK_LEVEL_LABELS,
  HACCP_VERIFICATION_RESULT_LABELS,
  createMonitoringRecord,
  createVerificationRecord,
  flattenHACCPCorrectiveActions,
  flattenHACCPCCPs,
  flattenHACCPHazards,
  flattenHACCPMonitoringRecords,
  flattenHACCPVerificationRecords,
  loadHACCPRecords,
  resolveMonitoringResult,
  saveHACCPRecords,
  validateMonitoringInput,
  validateVerificationInput
} from '../haccp/haccp.mock'
import type {
  CorrectiveAction,
  CriticalControlPoint,
  HACCPActionStatus,
  HACCPMonitoringResult,
  HACCPPlanRecord,
  MonitoringRecord,
  VerificationRecord
} from '../haccp/haccp.types'
import type {
  HACCPMonitoringInput,
  HACCPVerificationInput
} from '../haccp/haccp.mock'
import {
  addMonitoringToPlan,
  addVerificationToPlan,
  calculateHACCPDashboardSummary,
  createHACCPDataIndex,
  getHACCPCounts,
  getPlanForCCP,
  updateCorrectiveActionStatus
} from '../haccp/haccp.service'

type FilterValue = 'all'
type HACCPTab = 'plans' | 'ccps' | 'monitoring' | 'actions' | 'verification'
type ResultFilter = HACCPMonitoringResult | FilterValue

type HACCPInitialData = {
  branches: Branch[]
  inventoryLots: InventoryLot[]
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  qualitySamples: QualitySample[]
  stockItems: StockItem[]
  haccpRecords: HACCPPlanRecord[]
}

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const toSearchText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

const todayDateTimeLocal = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())){
    const dateOnly = new Date(`${value.slice(0, 10)}T00:00:00`)
    return Number.isNaN(dateOnly.getTime()) ? value : dateOnly.toLocaleDateString('tr-TR')
  }
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getDateKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10)
}

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const createProductRefs = (
  finalProducts: FinalProduct[],
  intermediateProducts: IntermediateProduct[],
  stockItems: StockItem[]
): InventoryLotProductReference[] => {
  const stockItemByName = new Map(stockItems.map(item => [toSearchText(item.name), item]))
  const seenIds = new Set<string>()

  const fromProduct = (product: FinalProduct | IntermediateProduct): InventoryLotProductReference => {
    const stockItem = stockItemByName.get(toSearchText(product.name))
    return {
      id: product.id,
      name: product.name,
      unit: normalizeUnit(product.unit),
      stockItemId: stockItem?.id
    }
  }

  return [...finalProducts.map(fromProduct), ...intermediateProducts.map(fromProduct)]
    .filter(product => {
      if(seenIds.has(product.id)) return false
      seenIds.add(product.id)
      return true
    })
}

const getTraceableLots = (inventoryLots: InventoryLot[]) => {
  const productionLots = inventoryLots.filter(isProductionInventoryLot)
  return productionLots.length > 0 ? productionLots : inventoryLots
}

const loadInitialData = (): HACCPInitialData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const productionOrders = loadProductionWorkOrders()
  const finalProducts = loadFinalProducts()
  const intermediateProducts = loadIntermediateProducts()
  const productRefs = createProductRefs(finalProducts, intermediateProducts, stockItems)
  const inventoryLots = getTraceableLots(loadLotSystemInventoryLotRecords(goodsReceipts, productionOrders, branches, productRefs))
  const traceableLotIds = new Set(inventoryLots.map(lot => lot.id))
  const qualitySamples = loadQualitySampleRecords(inventoryLots)
    .filter(sample => traceableLotIds.has(sample.inventoryLotId))
  const haccpRecords = loadHACCPRecords(productionOrders, inventoryLots, qualitySamples)

  return {
    branches,
    inventoryLots,
    productRefs,
    productionOrders,
    qualitySamples,
    stockItems,
    haccpRecords
  }
}

const getProductLabel = (
  lot: InventoryLot | null,
  productMap: Map<string, InventoryLotProductReference>,
  stockItemMap: Map<string, StockItem>
) => {
  if(!lot) return 'Product bulunamadı'
  return productMap.get(lot.productId)?.name
    || stockItemMap.get(lot.stockItemId)?.name
    || 'Product bulunamadı'
}

const getProductionOrderLabel = (
  productionOrderId: string,
  productionOrderMap: Map<string, ProductionWorkOrder>
) => productionOrderMap.get(productionOrderId)?.workOrderNo || 'Production Order bulunamadı'

const getLotLabel = (
  inventoryLotId: string,
  lotMap: Map<string, InventoryLot>
) => lotMap.get(inventoryLotId)?.lotNo || 'Lot bulunamadı'

const getSampleForLot = (
  lotId: string,
  qualitySamples: QualitySample[]
) => qualitySamples.find(sample => sample.inventoryLotId === lotId) || null

const createEmptyMonitoringForm = (
  ccps: CriticalControlPoint[],
  inventoryLots: InventoryLot[],
  qualitySamples: QualitySample[],
  productionOrders: ProductionWorkOrder[],
  currentUser: User
): HACCPMonitoringInput => {
  const lot = inventoryLots[0] || null
  const sample = lot ? getSampleForLot(lot.id, qualitySamples) : null

  return {
    ccpId: ccps[0]?.id || '',
    productionOrderId: lot?.productionOrderId || productionOrders[0]?.id || '',
    inventoryLotId: lot?.id || '',
    qualitySampleId: sample?.id || '',
    measuredValue: 0,
    checkedBy: getUserName(currentUser),
    checkedAt: todayDateTimeLocal(),
    notes: ''
  }
}

const createEmptyVerificationForm = (
  records: HACCPPlanRecord[],
  currentUser: User
): HACCPVerificationInput => {
  const firstPassMonitoring = flattenHACCPMonitoringRecords(records).find(record => record.result === 'PASS') || null
  const plan = firstPassMonitoring ? getPlanForCCP(records, firstPassMonitoring.ccpId) : records[0] || null

  return {
    planId: plan?.id || '',
    monitoringRecordId: firstPassMonitoring?.id || '',
    verifiedBy: getUserName(currentUser),
    verifiedAt: todayDateTimeLocal(),
    result: 'PASS',
    notes: ''
  }
}

const getStatusClass = (status: string) => {
  if(status === 'ACTIVE' || status === 'PASS' || status === 'COMPLETED') return 'success'
  if(status === 'FAIL' || status === 'CRITICAL' || status === 'OPEN') return 'danger-pill'
  if(status === 'UNDER_REVIEW' || status === 'IN_PROGRESS' || status === 'HIGH') return 'warning-pill'
  return 'muted-pill'
}

export default function HACCPManagement({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<HACCPPlanRecord[]>(initialData.haccpRecords)
  const [activeTab, setActiveTab] = React.useState<HACCPTab>('plans')
  const [selectedPlanId, setSelectedPlanId] = React.useState(initialData.haccpRecords[0]?.id || '')
  const [search, setSearch] = React.useState('')
  const [planFilter, setPlanFilter] = React.useState('all')
  const [ccpFilter, setCcpFilter] = React.useState('all')
  const [lotFilter, setLotFilter] = React.useState('all')
  const [productionOrderFilter, setProductionOrderFilter] = React.useState('all')
  const [productFilter, setProductFilter] = React.useState('all')
  const [dateFilter, setDateFilter] = React.useState('')
  const [resultFilter, setResultFilter] = React.useState<ResultFilter>('all')
  const [responsibleFilter, setResponsibleFilter] = React.useState('all')
  const [monitoringForm, setMonitoringForm] = React.useState<HACCPMonitoringInput>(() => (
    createEmptyMonitoringForm(
      flattenHACCPCCPs(initialData.haccpRecords),
      initialData.inventoryLots,
      initialData.qualitySamples,
      initialData.productionOrders,
      currentUser
    )
  ))
  const [verificationForm, setVerificationForm] = React.useState<HACCPVerificationInput>(() => (
    createEmptyVerificationForm(initialData.haccpRecords, currentUser)
  ))
  const [formError, setFormError] = React.useState('')

  const { inventoryLots, productRefs, productionOrders, qualitySamples, stockItems } = initialData
  const ccps = React.useMemo(() => flattenHACCPCCPs(records), [records])
  const hazards = React.useMemo(() => flattenHACCPHazards(records), [records])
  const monitoringRecords = React.useMemo(() => flattenHACCPMonitoringRecords(records), [records])
  const correctiveActions = React.useMemo(() => flattenHACCPCorrectiveActions(records), [records])
  const verificationRecords = React.useMemo(() => flattenHACCPVerificationRecords(records), [records])
  const index = React.useMemo(() => createHACCPDataIndex(records), [records])
  const summary = React.useMemo(() => calculateHACCPDashboardSummary(records), [records])
  const counts = React.useMemo(() => getHACCPCounts(records), [records])
  const productMap = React.useMemo(() => new Map(productRefs.map(product => [product.id, product])), [productRefs])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])
  const productionOrderMap = React.useMemo(() => new Map(productionOrders.map(order => [order.id, order])), [productionOrders])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const sampleMap = React.useMemo(() => new Map(qualitySamples.map(sample => [sample.id, sample])), [qualitySamples])
  const planMap = React.useMemo(() => new Map(records.map(record => [record.id, record])), [records])
  const selectedPlan = planMap.get(selectedPlanId) || records[0] || null
  const productOptions = React.useMemo(() => {
    const optionMap = new Map<string, string>()
    inventoryLots.forEach(lot => optionMap.set(lot.productId || lot.stockItemId, getProductLabel(lot, productMap, stockItemMap)))
    return Array.from(optionMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) => first.name.localeCompare(second.name, 'tr'))
  }, [inventoryLots, productMap, stockItemMap])
  const responsibleOptions = React.useMemo(() => (
    Array.from(new Set(ccps.map(ccp => ccp.responsibleRole).filter(Boolean))).sort((first, second) => first.localeCompare(second, 'tr'))
  ), [ccps])

  React.useEffect(() => {
    if(selectedPlanId && records.some(record => record.id === selectedPlanId)) return
    setSelectedPlanId(records[0]?.id || '')
  }, [records, selectedPlanId])

  const commitRecords = (nextRecords: HACCPPlanRecord[]) => {
    setRecords(nextRecords)
    saveHACCPRecords(nextRecords)
  }

  const getMonitoringMeta = (record: MonitoringRecord) => {
    const ccp = index.ccpMap.get(record.ccpId) || null
    const plan = ccp ? index.ccpPlanMap.get(ccp.id) || null : null
    const lot = lotMap.get(record.inventoryLotId) || null
    const productLabel = getProductLabel(lot, productMap, stockItemMap)

    return { ccp, plan, lot, productLabel }
  }

  const matchesCommonFilters = (
    record: MonitoringRecord
  ) => {
    const meta = getMonitoringMeta(record)
    const productId = meta.lot?.productId || meta.lot?.stockItemId || ''

    return (
      (planFilter === 'all' || meta.plan?.id === planFilter)
      && (ccpFilter === 'all' || record.ccpId === ccpFilter)
      && (lotFilter === 'all' || record.inventoryLotId === lotFilter)
      && (productionOrderFilter === 'all' || record.productionOrderId === productionOrderFilter)
      && (productFilter === 'all' || productId === productFilter)
      && (!dateFilter || getDateKey(record.checkedAt) === dateFilter)
      && (resultFilter === 'all' || record.result === resultFilter)
      && (responsibleFilter === 'all' || meta.ccp?.responsibleRole === responsibleFilter || record.checkedBy === responsibleFilter)
    )
  }

  const normalizedSearch = toSearchText(search)
  const visiblePlans = records.filter(plan => {
    const searchFields = [plan.code, plan.name, plan.description]
    const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
    return matchesSearch && (planFilter === 'all' || plan.id === planFilter)
  })
  const visibleCCPs = ccps.filter(ccp => {
    const plan = index.ccpPlanMap.get(ccp.id) || null
    const searchFields = [ccp.name, ccp.description, plan?.code || '', plan?.name || '']
    return (
      (!normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch)))
      && (planFilter === 'all' || ccp.planId === planFilter)
      && (ccpFilter === 'all' || ccp.id === ccpFilter)
      && (responsibleFilter === 'all' || ccp.responsibleRole === responsibleFilter)
    )
  })
  const visibleMonitoringRecords = monitoringRecords.filter(record => {
    const meta = getMonitoringMeta(record)
    const searchFields = [
      meta.plan?.code || '',
      meta.ccp?.name || '',
      getLotLabel(record.inventoryLotId, lotMap),
      getProductionOrderLabel(record.productionOrderId, productionOrderMap),
      meta.productLabel,
      record.checkedBy
    ]

    return (!normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch)))
      && matchesCommonFilters(record)
  })
  const visibleCorrectiveActions = correctiveActions.filter(action => {
    const monitoringRecord = index.monitoringMap.get(action.monitoringRecordId)
    const meta = monitoringRecord ? getMonitoringMeta(monitoringRecord) : null
    const searchFields = [action.description, action.assignedTo, meta?.ccp?.name || '', meta?.plan?.code || '']

    return (
      (!normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch)))
      && (!monitoringRecord || matchesCommonFilters(monitoringRecord))
      && (responsibleFilter === 'all' || action.assignedTo === responsibleFilter)
    )
  })
  const visibleVerificationRecords = verificationRecords.filter(record => {
    const plan = planMap.get(record.planId) || null
    const monitoringRecord = index.monitoringMap.get(record.monitoringRecordId)
    const meta = monitoringRecord ? getMonitoringMeta(monitoringRecord) : null
    const searchFields = [plan?.code || '', plan?.name || '', meta?.ccp?.name || '', record.verifiedBy]

    return (
      (!normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch)))
      && (planFilter === 'all' || record.planId === planFilter)
      && (!monitoringRecord || matchesCommonFilters(monitoringRecord))
    )
  })

  const verifiableMonitoringRecords = monitoringRecords.filter(record => {
    const actions = index.correctiveActionsByMonitoringId.get(record.id) || []
    return record.result === 'PASS' && actions.every(action => action.status === 'COMPLETED' || action.status === 'CANCELLED')
  })

  const handleMonitoringLotChange = (inventoryLotId: string) => {
    const lot = lotMap.get(inventoryLotId) || null
    const sample = lot ? getSampleForLot(lot.id, qualitySamples) : null
    setMonitoringForm(prev => ({
      ...prev,
      inventoryLotId,
      productionOrderId: lot?.productionOrderId || prev.productionOrderId,
      qualitySampleId: sample?.id || ''
    }))
  }

  const saveMonitoring = () => {
    const validationError = validateMonitoringInput(
      monitoringForm,
      index.ccpMap,
      productionOrderMap,
      lotMap,
      sampleMap
    )
    if(validationError){
      setFormError(validationError)
      return
    }

    const ccp = index.ccpMap.get(monitoringForm.ccpId)
    const plan = ccp ? getPlanForCCP(records, ccp.id) : null
    if(!ccp || !plan){
      setFormError('Plan veya CCP bulunamadı.')
      return
    }

    const { record, correctiveAction } = createMonitoringRecord(monitoringForm, ccp, plan.monitoringRecords)
    const nextRecords = addMonitoringToPlan(records, plan.id, record, correctiveAction)
    commitRecords(nextRecords)
    setSelectedPlanId(plan.id)
    setActiveTab(record.result === 'FAIL' ? 'actions' : 'monitoring')
    setMonitoringForm(createEmptyMonitoringForm(ccps, inventoryLots, qualitySamples, productionOrders, currentUser))
    setFormError('')
  }

  const saveVerification = () => {
    const plan = planMap.get(verificationForm.planId)
    const monitoringRecord = index.monitoringMap.get(verificationForm.monitoringRecordId)
    const actionMap = index.correctiveActionMap
    const validationError = validateVerificationInput(verificationForm, planMap, index.monitoringMap, actionMap)
    if(validationError){
      setFormError(validationError)
      return
    }
    if(!plan || !monitoringRecord){
      setFormError('Plan veya Monitoring Record bulunamadı.')
      return
    }

    const verificationRecord = createVerificationRecord(verificationForm)
    commitRecords(addVerificationToPlan(records, verificationRecord))
    setSelectedPlanId(plan.id)
    setActiveTab('verification')
    setVerificationForm(createEmptyVerificationForm(records, currentUser))
    setFormError('')
  }

  const handleActionStatusChange = (action: CorrectiveAction, status: HACCPActionStatus) => {
    commitRecords(updateCorrectiveActionStatus(records, action.id, status))
  }

  return (
    <div className="haccp-page">
      <div className="page-header">
        <div>
          <h2>HACCP</h2>
          <p className="muted">Kritik kontrol noktaları, monitoring kayıtları, düzeltici faaliyetler ve doğrulama süreci.</p>
        </div>
        <div className="haccp-header-actions">
          <span className="muted">Responsible: {getUserName(currentUser)}</span>
        </div>
      </div>

      <div className="metric-grid haccp-metrics">
        <div className="metric-card"><span>Bugünkü Monitoring</span><strong>{summary.todayMonitoringCount}</strong></div>
        <div className="metric-card"><span>Başarılı Kontrol</span><strong>{summary.successfulMonitoringCount}</strong></div>
        <div className="metric-card"><span>Başarısız Kontrol</span><strong>{summary.failedMonitoringCount}</strong></div>
        <div className="metric-card"><span>Açık Corrective Action</span><strong>{summary.openCorrectiveActionCount}</strong></div>
        <div className="metric-card"><span>Bugünkü Verification</span><strong>{summary.todayVerificationCount}</strong></div>
      </div>

      <div className="haccp-tabs" role="tablist" aria-label="HACCP listeleri">
        {([
          ['plans', `Planlar (${counts.plans})`],
          ['ccps', `CCP (${counts.ccps})`],
          ['monitoring', `Monitoring (${counts.monitoringRecords})`],
          ['actions', `Corrective Actions (${counts.correctiveActions})`],
          ['verification', `Verification (${counts.verificationRecords})`]
        ] as Array<[HACCPTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="haccp-toolbar">
        <input
          type="search"
          placeholder="Plan, Lot, Production Order, Product veya CCP ara"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <select value={planFilter} onChange={event => setPlanFilter(event.target.value)}>
          <option value="all">Tüm Planlar</option>
          {records.map(plan => <option key={plan.id} value={plan.id}>{plan.code}</option>)}
        </select>
        <select value={ccpFilter} onChange={event => setCcpFilter(event.target.value)}>
          <option value="all">Tüm CCP</option>
          {ccps.map(ccp => <option key={ccp.id} value={ccp.id}>{ccp.name}</option>)}
        </select>
        <select value={lotFilter} onChange={event => setLotFilter(event.target.value)}>
          <option value="all">Tüm Lotlar</option>
          {inventoryLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
        </select>
        <select value={productionOrderFilter} onChange={event => setProductionOrderFilter(event.target.value)}>
          <option value="all">Tüm Production Order</option>
          {productionOrders.map(order => <option key={order.id} value={order.id}>{order.workOrderNo}</option>)}
        </select>
        <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
          <option value="all">Tüm Ürünler</option>
          {productOptions.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <input
          type="date"
          aria-label="Tarih filtresi"
          value={dateFilter}
          onChange={event => setDateFilter(event.target.value)}
        />
        <select value={resultFilter} onChange={event => setResultFilter(event.target.value as ResultFilter)}>
          <option value="all">Tüm Result</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
        </select>
        <select value={responsibleFilter} onChange={event => setResponsibleFilter(event.target.value)}>
          <option value="all">Tüm Responsible</option>
          {responsibleOptions.map(responsible => <option key={responsible} value={responsible}>{responsible}</option>)}
        </select>
      </div>

      <div className="product-layout haccp-layout">
        <section className="product-main card">
          {activeTab === 'plans' && (
            <HACCPPlanTable
              records={visiblePlans}
              onSelect={setSelectedPlanId}
              selectedPlanId={selectedPlan?.id || ''}
            />
          )}
          {activeTab === 'ccps' && (
            <HACCPCCPTable
              ccpPlanMap={index.ccpPlanMap}
              ccps={visibleCCPs}
              hazards={hazards}
              onSelectPlan={setSelectedPlanId}
            />
          )}
          {activeTab === 'monitoring' && (
            <HACCPMonitoringTable
              monitoringRecords={visibleMonitoringRecords}
              ccpMap={index.ccpMap}
              ccpPlanMap={index.ccpPlanMap}
              lotMap={lotMap}
              productionOrderMap={productionOrderMap}
              productMap={productMap}
              stockItemMap={stockItemMap}
              onSelectPlan={setSelectedPlanId}
            />
          )}
          {activeTab === 'actions' && (
            <HACCPCorrectiveActionTable
              actions={visibleCorrectiveActions}
              ccpMap={index.ccpMap}
              monitoringMap={index.monitoringMap}
              onStatusChange={handleActionStatusChange}
            />
          )}
          {activeTab === 'verification' && (
            <HACCPVerificationTable
              ccpMap={index.ccpMap}
              monitoringMap={index.monitoringMap}
              records={visibleVerificationRecords}
              planMap={planMap}
            />
          )}
        </section>

        <aside className="product-side haccp-side">
          <HACCPDetailPanel
            actions={correctiveActions}
            hazards={hazards}
            monitoringRecords={monitoringRecords}
            plan={selectedPlan}
            verificationRecords={verificationRecords}
          />
          <HACCPMonitoringFormPanel
            ccps={ccps}
            form={monitoringForm}
            formError={formError}
            inventoryLots={inventoryLots}
            lotMap={lotMap}
            productionOrders={productionOrders}
            qualitySamples={qualitySamples}
            onChange={setMonitoringForm}
            onLotChange={handleMonitoringLotChange}
            onSave={saveMonitoring}
          />
          <HACCPVerificationFormPanel
            form={verificationForm}
            monitoringRecords={verifiableMonitoringRecords}
            planMap={planMap}
            onChange={setVerificationForm}
            onSave={saveVerification}
          />
        </aside>
      </div>
    </div>
  )
}

function HACCPPlanTable({
  records,
  selectedPlanId,
  onSelect
}: {
  records: HACCPPlanRecord[]
  selectedPlanId: string
  onSelect: (planId: string) => void
}){
  return (
    <>
      <div className="section-header">
        <div>
          <h3>HACCP Planları</h3>
          <p className="muted">{records.length} plan gösteriliyor.</p>
        </div>
      </div>
      <div className="table-wrap haccp-table-wrap">
        <table className="data-table haccp-table">
          <thead>
            <tr>
              <th>Plan Kodu</th>
              <th>Plan</th>
              <th>CCP</th>
              <th>Monitoring</th>
              <th>Verification</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan={6} className="empty-cell">Plan bulunamadı.</td></tr>}
            {records.map(plan => (
              <tr
                key={plan.id}
                className={selectedPlanId === plan.id ? 'selected' : ''}
                tabIndex={0}
                onClick={() => onSelect(plan.id)}
                onKeyDown={event => {
                  if(event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelect(plan.id)
                }}
              >
                <td data-label="Plan Kodu"><strong>{plan.code}</strong></td>
                <td data-label="Plan">{plan.name}</td>
                <td data-label="CCP">{plan.criticalControlPoints.length}</td>
                <td data-label="Monitoring">{plan.monitoringRecords.length}</td>
                <td data-label="Verification">{plan.verificationRecords.length}</td>
                <td data-label="Status">
                  <span className={`status-pill ${getStatusClass(plan.status)}`}>{HACCP_PLAN_STATUS_LABELS[plan.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function HACCPCCPTable({
  ccpPlanMap,
  ccps,
  hazards,
  onSelectPlan
}: {
  ccpPlanMap: Map<string, HACCPPlanRecord>
  ccps: CriticalControlPoint[]
  hazards: ReturnType<typeof flattenHACCPHazards>
  onSelectPlan: (planId: string) => void
}){
  return (
    <>
      <div className="section-header">
        <div>
          <h3>CCP Listesi</h3>
          <p className="muted">{ccps.length} kritik kontrol noktası gösteriliyor.</p>
        </div>
      </div>
      <div className="table-wrap haccp-table-wrap">
        <table className="data-table haccp-table">
          <thead>
            <tr>
              <th>CCP</th>
              <th>Plan</th>
              <th>Stage</th>
              <th>Critical Limit</th>
              <th>Hazard</th>
              <th>Responsible</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ccps.length === 0 && <tr><td colSpan={7} className="empty-cell">CCP bulunamadı.</td></tr>}
            {ccps.map(ccp => {
              const plan = ccpPlanMap.get(ccp.id) || null
              const hazardCount = hazards.filter(hazard => hazard.ccpId === ccp.id).length
              return (
                <tr key={ccp.id} tabIndex={0} onClick={() => plan && onSelectPlan(plan.id)}>
                  <td data-label="CCP"><strong>{ccp.name}</strong></td>
                  <td data-label="Plan">{plan?.code || '-'}</td>
                  <td data-label="Stage">{HACCP_PRODUCTION_STAGE_LABELS[ccp.productionStage]}</td>
                  <td data-label="Critical Limit">{ccp.criticalLimit}</td>
                  <td data-label="Hazard">{hazardCount}</td>
                  <td data-label="Responsible">{ccp.responsibleRole}</td>
                  <td data-label="Status">
                    <span className={`status-pill ${getStatusClass(ccp.status)}`}>{HACCP_CCP_STATUS_LABELS[ccp.status]}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function HACCPMonitoringTable({
  monitoringRecords,
  ccpMap,
  ccpPlanMap,
  lotMap,
  productionOrderMap,
  productMap,
  stockItemMap,
  onSelectPlan
}: {
  monitoringRecords: MonitoringRecord[]
  ccpMap: Map<string, CriticalControlPoint>
  ccpPlanMap: Map<string, HACCPPlanRecord>
  lotMap: Map<string, InventoryLot>
  productionOrderMap: Map<string, ProductionWorkOrder>
  productMap: Map<string, InventoryLotProductReference>
  stockItemMap: Map<string, StockItem>
  onSelectPlan: (planId: string) => void
}){
  return (
    <>
      <div className="section-header">
        <div>
          <h3>Monitoring Records</h3>
          <p className="muted">{monitoringRecords.length} kayıt gösteriliyor.</p>
        </div>
      </div>
      <div className="table-wrap haccp-table-wrap">
        <table className="data-table haccp-table">
          <thead>
            <tr>
              <th>Checked At</th>
              <th>CCP</th>
              <th>Lot</th>
              <th>Production Order</th>
              <th>Ürün</th>
              <th>Measured</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {monitoringRecords.length === 0 && <tr><td colSpan={7} className="empty-cell">Monitoring kaydı bulunamadı.</td></tr>}
            {monitoringRecords.map(record => {
              const ccp = ccpMap.get(record.ccpId) || null
              const plan = ccp ? ccpPlanMap.get(ccp.id) || null : null
              const lot = lotMap.get(record.inventoryLotId) || null
              return (
                <tr key={record.id} tabIndex={0} onClick={() => plan && onSelectPlan(plan.id)}>
                  <td data-label="Checked At">{formatDateTime(record.checkedAt)}</td>
                  <td data-label="CCP"><strong>{ccp?.name || 'CCP bulunamadı'}</strong></td>
                  <td data-label="Lot">{lot?.lotNo || 'Lot bulunamadı'}</td>
                  <td data-label="Production Order">{getProductionOrderLabel(record.productionOrderId, productionOrderMap)}</td>
                  <td data-label="Ürün">{getProductLabel(lot, productMap, stockItemMap)}</td>
                  <td data-label="Measured">{record.measuredValue} / {record.criticalLimit}</td>
                  <td data-label="Result">
                    <span className={`status-pill ${getStatusClass(record.result)}`}>{record.result}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function HACCPCorrectiveActionTable({
  actions,
  ccpMap,
  monitoringMap,
  onStatusChange
}: {
  actions: CorrectiveAction[]
  ccpMap: Map<string, CriticalControlPoint>
  monitoringMap: Map<string, MonitoringRecord>
  onStatusChange: (action: CorrectiveAction, status: HACCPActionStatus) => void
}){
  return (
    <>
      <div className="section-header">
        <div>
          <h3>Corrective Actions</h3>
          <p className="muted">{actions.length} düzeltici faaliyet gösteriliyor.</p>
        </div>
      </div>
      <div className="table-wrap haccp-table-wrap">
        <table className="data-table haccp-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>CCP</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Completed At</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 && <tr><td colSpan={5} className="empty-cell">Corrective Action bulunamadı.</td></tr>}
            {actions.map(action => {
              const monitoringRecord = monitoringMap.get(action.monitoringRecordId)
              const ccp = monitoringRecord ? ccpMap.get(monitoringRecord.ccpId) || null : null
              return (
                <tr key={action.id}>
                  <td data-label="Action"><strong>{action.description}</strong></td>
                  <td data-label="CCP">{ccp?.name || '-'}</td>
                  <td data-label="Assigned To">{action.assignedTo}</td>
                  <td data-label="Status">
                    <select value={action.status} onChange={event => onStatusChange(action, event.target.value as HACCPActionStatus)}>
                      {HACCP_ACTION_STATUSES.map(status => (
                        <option key={status} value={status}>{HACCP_ACTION_STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Completed At">{formatDateTime(action.completedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function HACCPVerificationTable({
  ccpMap,
  monitoringMap,
  planMap,
  records
}: {
  ccpMap: Map<string, CriticalControlPoint>
  monitoringMap: Map<string, MonitoringRecord>
  planMap: Map<string, HACCPPlanRecord>
  records: VerificationRecord[]
}){
  return (
    <>
      <div className="section-header">
        <div>
          <h3>Verification Records</h3>
          <p className="muted">{records.length} doğrulama kaydı gösteriliyor.</p>
        </div>
      </div>
      <div className="table-wrap haccp-table-wrap">
        <table className="data-table haccp-table">
          <thead>
            <tr>
              <th>Verified At</th>
              <th>Plan</th>
              <th>CCP</th>
              <th>Result</th>
              <th>Verified By</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan={6} className="empty-cell">Verification kaydı bulunamadı.</td></tr>}
            {records.map(record => {
              const monitoringRecord = monitoringMap.get(record.monitoringRecordId)
              const ccp = monitoringRecord ? ccpMap.get(monitoringRecord.ccpId) || null : null
              const plan = planMap.get(record.planId) || null
              return (
                <tr key={record.id}>
                  <td data-label="Verified At">{formatDateTime(record.verifiedAt)}</td>
                  <td data-label="Plan"><strong>{plan?.code || '-'}</strong></td>
                  <td data-label="CCP">{ccp?.name || '-'}</td>
                  <td data-label="Result">
                    <span className={`status-pill ${getStatusClass(record.result)}`}>{HACCP_VERIFICATION_RESULT_LABELS[record.result]}</span>
                  </td>
                  <td data-label="Verified By">{record.verifiedBy}</td>
                  <td data-label="Notes">{record.notes || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function HACCPDetailPanel({
  actions,
  hazards,
  monitoringRecords,
  plan,
  verificationRecords
}: {
  actions: CorrectiveAction[]
  hazards: ReturnType<typeof flattenHACCPHazards>
  monitoringRecords: MonitoringRecord[]
  plan: HACCPPlanRecord | null
  verificationRecords: VerificationRecord[]
}){
  if(!plan){
    return (
      <section className="card haccp-detail-card">
        <h3>Plan Detayı</h3>
        <p className="muted">Detay görmek için bir HACCP planı seçin.</p>
      </section>
    )
  }

  const ccpIds = new Set(plan.criticalControlPoints.map(ccp => ccp.id))
  const planHazards = hazards.filter(hazard => ccpIds.has(hazard.ccpId))
  const planMonitoring = monitoringRecords.filter(record => ccpIds.has(record.ccpId))
  const monitoringIds = new Set(planMonitoring.map(record => record.id))
  const planActions = actions.filter(action => monitoringIds.has(action.monitoringRecordId))
  const planVerifications = verificationRecords.filter(record => record.planId === plan.id)

  return (
    <section className="card haccp-detail-card">
      <div className="section-header compact">
        <div>
          <h3>{plan.code}</h3>
          <p className="muted">{plan.name}</p>
        </div>
        <span className={`status-pill ${getStatusClass(plan.status)}`}>{HACCP_PLAN_STATUS_LABELS[plan.status]}</span>
      </div>
      <div className="haccp-detail-grid">
        <div><span>CCP</span><strong>{plan.criticalControlPoints.length}</strong></div>
        <div><span>Hazard</span><strong>{planHazards.length}</strong></div>
        <div><span>Monitoring</span><strong>{planMonitoring.length}</strong></div>
        <div><span>Corrective Action</span><strong>{planActions.length}</strong></div>
        <div><span>Verification</span><strong>{planVerifications.length}</strong></div>
      </div>
      <div className="haccp-related-list">
        {plan.criticalControlPoints.slice(0, 4).map(ccp => (
          <div key={ccp.id} className="haccp-related-row">
            <strong>{ccp.name}</strong>
            <span>{HACCP_PRODUCTION_STAGE_LABELS[ccp.productionStage]} · {ccp.criticalLimit} · {ccp.monitoringFrequency}</span>
          </div>
        ))}
      </div>
      <h4>Hazards</h4>
      <div className="haccp-related-list">
        {planHazards.slice(0, 5).map(hazard => (
          <div key={hazard.id} className="haccp-related-row">
            <strong>{hazard.description}</strong>
            <span>{HACCP_RISK_LEVEL_LABELS[hazard.riskLevel]} · {hazard.preventiveMeasure}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function HACCPMonitoringFormPanel({
  ccps,
  form,
  formError,
  inventoryLots,
  lotMap,
  productionOrders,
  qualitySamples,
  onChange,
  onLotChange,
  onSave
}: {
  ccps: CriticalControlPoint[]
  form: HACCPMonitoringInput
  formError: string
  inventoryLots: InventoryLot[]
  lotMap: Map<string, InventoryLot>
  productionOrders: ProductionWorkOrder[]
  qualitySamples: QualitySample[]
  onChange: React.Dispatch<React.SetStateAction<HACCPMonitoringInput>>
  onLotChange: (inventoryLotId: string) => void
  onSave: () => void
}){
  const selectedCCP = ccps.find(ccp => ccp.id === form.ccpId) || null
  const previewResult = selectedCCP ? resolveMonitoringResult(selectedCCP.criticalLimit, form.measuredValue) : 'PASS'
  const selectedLot = lotMap.get(form.inventoryLotId) || null

  return (
    <section className="card haccp-form-card">
      <div className="section-header compact">
        <div>
          <h3>Monitoring Kaydı</h3>
          <p className="muted">Critical Limit aşılırsa sonuç FAIL olur ve Corrective Action otomatik açılır.</p>
        </div>
        <span className={`status-pill ${getStatusClass(previewResult)}`}>{previewResult}</span>
      </div>
      {formError && <div className="form-error">{formError}</div>}
      <div className="haccp-form-grid">
        <label className="form-field haccp-form-wide">
          <span>CCP</span>
          <select value={form.ccpId} onChange={event => onChange(prev => ({ ...prev, ccpId: event.target.value }))}>
            {ccps.map(ccp => <option key={ccp.id} value={ccp.id}>{ccp.name}</option>)}
          </select>
        </label>
        <label className="form-field haccp-form-wide">
          <span>Inventory Lot</span>
          <select value={form.inventoryLotId} onChange={event => onLotChange(event.target.value)}>
            {inventoryLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Production Order</span>
          <select value={form.productionOrderId} onChange={event => onChange(prev => ({ ...prev, productionOrderId: event.target.value }))}>
            {productionOrders.map(order => <option key={order.id} value={order.id}>{order.workOrderNo}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Quality Sample</span>
          <select value={form.qualitySampleId} onChange={event => onChange(prev => ({ ...prev, qualitySampleId: event.target.value }))}>
            <option value="">Sample yok</option>
            {qualitySamples
              .filter(sample => !selectedLot || sample.inventoryLotId === selectedLot.id)
              .map(sample => <option key={sample.id} value={sample.id}>{sample.sampleNo}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Measured Value</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.measuredValue}
            onChange={event => onChange(prev => ({ ...prev, measuredValue: Number(event.target.value) }))}
          />
        </label>
        <label className="form-field">
          <span>Checked At</span>
          <input
            type="datetime-local"
            value={form.checkedAt}
            onChange={event => onChange(prev => ({ ...prev, checkedAt: event.target.value }))}
          />
        </label>
        <label className="form-field haccp-form-wide">
          <span>Checked By</span>
          <input value={form.checkedBy} onChange={event => onChange(prev => ({ ...prev, checkedBy: event.target.value }))} />
        </label>
        <label className="form-field haccp-form-wide">
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={event => onChange(prev => ({ ...prev, notes: event.target.value }))} />
        </label>
      </div>
      <button className="btn primary" type="button" onClick={onSave}>Monitoring Oluştur</button>
    </section>
  )
}

function HACCPVerificationFormPanel({
  form,
  monitoringRecords,
  planMap,
  onChange,
  onSave
}: {
  form: HACCPVerificationInput
  monitoringRecords: MonitoringRecord[]
  planMap: Map<string, HACCPPlanRecord>
  onChange: React.Dispatch<React.SetStateAction<HACCPVerificationInput>>
  onSave: () => void
}){
  return (
    <section className="card haccp-form-card">
      <div className="section-header compact">
        <div>
          <h3>Verification</h3>
          <p className="muted">Verification sadece PASS Monitoring kayıtları üzerinde yapılır.</p>
        </div>
      </div>
      <div className="haccp-form-grid">
        <label className="form-field haccp-form-wide">
          <span>Plan</span>
          <select value={form.planId} onChange={event => onChange(prev => ({ ...prev, planId: event.target.value }))}>
            {Array.from(planMap.values()).map(plan => <option key={plan.id} value={plan.id}>{plan.code}</option>)}
          </select>
        </label>
        <label className="form-field haccp-form-wide">
          <span>Monitoring Record</span>
          <select value={form.monitoringRecordId} onChange={event => onChange(prev => ({ ...prev, monitoringRecordId: event.target.value }))}>
            {monitoringRecords.map(record => (
              <option key={record.id} value={record.id}>
                {record.id} · {formatDateTime(record.checkedAt)} · {record.result}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Verified At</span>
          <input
            type="datetime-local"
            value={form.verifiedAt}
            onChange={event => onChange(prev => ({ ...prev, verifiedAt: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Result</span>
          <select value={form.result} onChange={event => onChange(prev => ({ ...prev, result: event.target.value as 'PASS' | 'FAIL' }))}>
            <option value="PASS">PASS</option>
            <option value="FAIL">FAIL</option>
          </select>
        </label>
        <label className="form-field haccp-form-wide">
          <span>Verified By</span>
          <input value={form.verifiedBy} onChange={event => onChange(prev => ({ ...prev, verifiedBy: event.target.value }))} />
        </label>
        <label className="form-field haccp-form-wide">
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={event => onChange(prev => ({ ...prev, notes: event.target.value }))} />
        </label>
      </div>
      <button className="btn secondary" type="button" onClick={onSave}>Verification Oluştur</button>
    </section>
  )
}
