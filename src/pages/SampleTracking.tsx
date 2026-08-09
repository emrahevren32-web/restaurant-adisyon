import React from 'react'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import type { BarcodeGenerateInput } from '../barcode-engine/barcode.types'
import BarcodePreviewModal from '../components/BarcodePreviewModal'
import QRPreviewModal from '../components/QRPreviewModal'
import PrintPreviewModal from '../components/PrintPreviewModal'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
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
import {
  QUALITY_SAMPLE_STATUS_LABELS,
  QUALITY_SAMPLE_STATUSES,
  QUALITY_SAMPLE_TYPE_LABELS,
  QUALITY_SAMPLE_TYPES,
  createQualitySampleRecord,
  getNextQualitySampleNo,
  loadQualitySampleRecords,
  saveQualitySampleRecords,
  validateQualitySampleInput
} from '../quality-samples/quality-sample.mock'
import type { QualitySampleInput } from '../quality-samples/quality-sample.mock'
import type {
  QualitySample,
  QualitySampleStatus,
  QualitySampleType
} from '../quality-samples/quality-sample.types'
import type { PrintDocumentInput } from '../print-engine/print.types'
import { QRIntegrationService } from '../qr-engine/qr-integration.service'
import type { QRGenerateInput } from '../qr-engine/qr.types'
import { loadBranches, loadStockItems } from '../storage'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Branch, StockItem, StockUnit, User } from '../types'

type FilterValue = 'all'
type SampleTypeFilter = QualitySampleType | FilterValue
type SampleStatusFilter = QualitySampleStatus | FilterValue
type SampleFormMode = 'create' | 'edit'

type SampleTrackingInitialData = {
  branches: Branch[]
  inventoryLots: InventoryLot[]
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  samples: QualitySample[]
  stockItems: StockItem[]
}

const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue || todayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const normalizeUnit = (value: unknown): StockUnit => {
  const unit = String(value || '').trim()
  return STOCK_UNITS.includes(unit as StockUnit) ? unit as StockUnit : 'adet'
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const getStatusClass = (status: QualitySampleStatus) => {
  if(status === 'RELEASED') return 'success'
  if(status === 'UNDER_REVIEW') return 'warning-pill'
  if(status === 'DISCARDED') return 'danger-pill'
  if(status === 'STORED') return 'info-pill'
  return 'muted-pill'
}

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

const getLotLabel = (inventoryLotId: string, lotMap: Map<string, InventoryLot>) => (
  lotMap.get(inventoryLotId)?.lotNo || 'Lot bulunamadı'
)

const getProductionOrderLabel = (
  lot: InventoryLot | null,
  productionOrderMap: Map<string, ProductionWorkOrder>
) => {
  if(!lot?.productionOrderId) return '-'
  return productionOrderMap.get(lot.productionOrderId)?.workOrderNo || 'Production Order bulunamadı'
}

const getWarehouseLabel = (lot: InventoryLot | null, branchMap: Map<string, Branch>) => {
  if(!lot) return '-'
  return branchMap.get(lot.warehouseId)?.name || 'Warehouse bulunamadı'
}

const loadInitialData = (): SampleTrackingInitialData => {
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
  const inventoryLots = loadLotSystemInventoryLotRecords(goodsReceipts, productionOrders, branches, productRefs)
  const samples = loadQualitySampleRecords(inventoryLots)

  return {
    branches,
    inventoryLots,
    productRefs,
    productionOrders,
    samples,
    stockItems
  }
}

const getAvailableLots = (inventoryLots: InventoryLot[]) => {
  const productionLots = inventoryLots.filter(isProductionInventoryLot)
  return productionLots.length > 0 ? productionLots : inventoryLots
}

const getSafeSampleDate = (lot: InventoryLot | null) => {
  const today = todayKey()
  if(!lot?.productionDate) return today
  return lot.productionDate > today ? lot.productionDate : today
}

const createEmptyForm = (
  samples: QualitySample[],
  inventoryLots: InventoryLot[],
  currentUser: User
): QualitySampleInput => {
  const lot = getAvailableLots(inventoryLots)[0] || null
  const sampleDate = getSafeSampleDate(lot)

  return {
    sampleNo: getNextQualitySampleNo(samples),
    inventoryLotId: lot?.id || '',
    sampleType: 'FINISHED_PRODUCT',
    sampleDate,
    expiryDate: addDays(sampleDate, 7),
    status: 'COLLECTED',
    takenBy: getUserName(currentUser),
    storageLocation: '',
    notes: ''
  }
}

const createFormFromSample = (sample: QualitySample): QualitySampleInput => ({
  sampleNo: sample.sampleNo,
  inventoryLotId: sample.inventoryLotId,
  sampleType: sample.sampleType,
  sampleDate: sample.sampleDate,
  expiryDate: sample.expiryDate,
  status: sample.status,
  takenBy: sample.takenBy,
  storageLocation: sample.storageLocation,
  notes: sample.notes
})

export default function SampleTracking({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const [samples, setSamples] = React.useState<QualitySample[]>(initialData.samples)
  const [selectedSampleId, setSelectedSampleId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [sampleTypeFilter, setSampleTypeFilter] = React.useState<SampleTypeFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<SampleStatusFilter>('all')
  const [sampleDateFilter, setSampleDateFilter] = React.useState('')
  const [formMode, setFormMode] = React.useState<SampleFormMode>('create')
  const [form, setForm] = React.useState<QualitySampleInput>(() => (
    createEmptyForm(initialData.samples, initialData.inventoryLots, currentUser)
  ))
  const [formError, setFormError] = React.useState('')
  const [barcodePreviewRequest, setBarcodePreviewRequest] = React.useState<BarcodeGenerateInput | null>(null)
  const [qrPreviewRequest, setQrPreviewRequest] = React.useState<QRGenerateInput | null>(null)
  const [printDocuments, setPrintDocuments] = React.useState<PrintDocumentInput[]>([])

  const { branches, inventoryLots, productRefs, productionOrders, stockItems } = initialData
  const availableLots = React.useMemo(() => getAvailableLots(inventoryLots), [inventoryLots])
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const productMap = React.useMemo(() => new Map(productRefs.map(product => [product.id, product])), [productRefs])
  const productionOrderMap = React.useMemo(() => (
    new Map(productionOrders.map(order => [order.id, order]))
  ), [productionOrders])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])

  const selectedSample = React.useMemo(() => (
    samples.find(sample => sample.id === selectedSampleId) || samples[0] || null
  ), [samples, selectedSampleId])

  React.useEffect(() => {
    if(selectedSampleId && samples.some(sample => sample.id === selectedSampleId)) return
    setSelectedSampleId(samples[0]?.id || '')
  }, [samples, selectedSampleId])

  const visibleSamples = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return samples.filter(sample => {
      const lot = lotMap.get(sample.inventoryLotId) || null
      const productLabel = getProductLabel(lot, productMap, stockItemMap)
      const searchFields = [
        sample.sampleNo,
        lot?.lotNo || '',
        productLabel
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesSampleType = sampleTypeFilter === 'all' || sample.sampleType === sampleTypeFilter
      const matchesStatus = statusFilter === 'all' || sample.status === statusFilter
      const matchesSampleDate = !sampleDateFilter || sample.sampleDate === sampleDateFilter

      return matchesSearch && matchesSampleType && matchesStatus && matchesSampleDate
    })
  }, [lotMap, productMap, sampleDateFilter, sampleTypeFilter, samples, search, statusFilter, stockItemMap])

  const exportVisibleSamples = () => {
    ExcelIntegrationService.exportModuleView({
      moduleKey: 'samples',
      rows: visibleSamples,
      userName: getUserName(currentUser),
      fileNamePrefix: 'numune-takibi',
      filterText: search,
      sortLabel: 'Mevcut liste sirasi',
      columns: [
        { key: 'sampleNo', header: 'Sample No', value: sample => sample.sampleNo },
        { key: 'lotNo', header: 'Lot No', value: sample => lotMap.get(sample.inventoryLotId)?.lotNo || 'Lot bulunamadi' },
        { key: 'productName', header: 'Product', value: sample => getProductLabel(lotMap.get(sample.inventoryLotId) || null, productMap, stockItemMap) },
        { key: 'sampleType', header: 'Sample Type', value: sample => QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType] },
        { key: 'sampleDate', header: 'Sample Date', value: sample => sample.sampleDate },
        { key: 'expiryDate', header: 'Expiry Date', value: sample => sample.expiryDate },
        { key: 'status', header: 'Status', value: sample => QUALITY_SAMPLE_STATUS_LABELS[sample.status] },
        { key: 'takenBy', header: 'Taken By', value: sample => sample.takenBy },
        { key: 'storageLocation', header: 'Storage Location', value: sample => sample.storageLocation || '-' }
      ]
    })
  }

  const createSamplePrintDocument = (sample: QualitySample): PrintDocumentInput => {
    const lot = lotMap.get(sample.inventoryLotId) || null
    const lotNo = lot?.lotNo || sample.inventoryLotId
    const productName = getProductLabel(lot, productMap, stockItemMap)

    return {
      moduleKey: 'samples',
      entityId: sample.id,
      entityCode: sample.sampleNo,
      title: sample.sampleNo,
      subtitle: productName,
      fields: [
        { label: 'Lot', value: lotNo },
        { label: 'Product', value: productName },
        { label: 'Production Order', value: getProductionOrderLabel(lot, productionOrderMap) },
        { label: 'Warehouse', value: getWarehouseLabel(lot, branchMap) },
        { label: 'Sample Type', value: QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType] },
        { label: 'Sample Date', value: formatDate(sample.sampleDate) },
        { label: 'Expiry Date', value: formatDate(sample.expiryDate) },
        { label: 'Status', value: QUALITY_SAMPLE_STATUS_LABELS[sample.status] },
        { label: 'Taken By', value: sample.takenBy },
        { label: 'Storage', value: sample.storageLocation || '-' }
      ],
      notes: sample.notes,
      barcodeValue: sample.sampleNo,
      qrPayload: QRIntegrationService.createPayload(QRIntegrationService.fromQualitySample(sample, lot))
    }
  }

  const collectedCount = samples.filter(sample => sample.status === 'COLLECTED').length
  const storedCount = samples.filter(sample => sample.status === 'STORED').length
  const reviewCount = samples.filter(sample => sample.status === 'UNDER_REVIEW').length
  const releasedCount = samples.filter(sample => sample.status === 'RELEASED').length

  const commitSamples = (nextSamples: QualitySample[]) => {
    setSamples(nextSamples)
    saveQualitySampleRecords(nextSamples)
  }

  const startCreate = () => {
    setFormMode('create')
    setFormError('')
    setForm(createEmptyForm(samples, inventoryLots, currentUser))
  }

  const startEdit = (sample: QualitySample) => {
    setFormMode('edit')
    setFormError('')
    setSelectedSampleId(sample.id)
    setForm(createFormFromSample(sample))
  }

  const handleLotChange = (inventoryLotId: string) => {
    const lot = lotMap.get(inventoryLotId) || null

    setForm(prev => {
      const sampleDate = lot?.productionDate && prev.sampleDate < lot.productionDate
        ? lot.productionDate
        : prev.sampleDate
      const expiryDate = prev.expiryDate < sampleDate ? addDays(sampleDate, 7) : prev.expiryDate

      return {
        ...prev,
        inventoryLotId,
        sampleDate,
        expiryDate
      }
    })
  }

  const handleSampleDateChange = (sampleDate: string) => {
    setForm(prev => ({
      ...prev,
      sampleDate,
      expiryDate: prev.expiryDate && prev.expiryDate >= sampleDate ? prev.expiryDate : addDays(sampleDate, 7)
    }))
  }

  const saveForm = () => {
    const validationError = validateQualitySampleInput(
      form,
      lotMap,
      samples,
      formMode === 'edit' ? selectedSample?.id || '' : ''
    )
    if(validationError){
      setFormError(validationError)
      return
    }

    const nextSample = createQualitySampleRecord(
      form,
      formMode === 'edit' ? selectedSample || undefined : undefined
    )
    const nextSamples = formMode === 'edit' && selectedSample
      ? samples.map(sample => sample.id === selectedSample.id ? nextSample : sample)
      : [nextSample, ...samples]

    commitSamples(nextSamples)
    setSelectedSampleId(nextSample.id)
    setFormMode('edit')
    setForm(createFormFromSample(nextSample))
    setFormError('')
  }

  const updateStatus = (sample: QualitySample, status: QualitySampleStatus) => {
    const nextSample = createQualitySampleRecord({ ...createFormFromSample(sample), status }, sample)
    commitSamples(samples.map(record => record.id === sample.id ? nextSample : record))
    setSelectedSampleId(sample.id)
    if(formMode === 'edit' && form.sampleNo === sample.sampleNo) setForm(createFormFromSample(nextSample))
  }

  return (
    <div className="sample-tracking-page">
      <div className="page-header">
        <div>
          <h2>Numune Takibi</h2>
          <p className="muted">Üretim sırasında alınan kalite numunelerini Inventory Lot üzerinden izleyin.</p>
        </div>
        <div className="sample-tracking-header-actions">
          <span className="muted">Operatör: {getUserName(currentUser)}</span>
          <button className="btn" type="button" onClick={() => setPrintDocuments(visibleSamples.map(createSamplePrintDocument))}>Toplu Yazdır</button>
          <button className="btn" type="button" onClick={exportVisibleSamples}>Excel'e Aktar</button>
          <button className="btn primary" type="button" onClick={startCreate}>Yeni Numune</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Alındı</span>
          <strong>{collectedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Saklanıyor</span>
          <strong>{storedCount}</strong>
        </div>
        <div className="metric-card">
          <span>İncelemede</span>
          <strong>{reviewCount}</strong>
        </div>
        <div className="metric-card">
          <span>Serbest</span>
          <strong>{releasedCount}</strong>
        </div>
      </div>

      <div className="product-layout sample-tracking-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Numune Listesi</h3>
              <p className="muted">{visibleSamples.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="sample-tracking-toolbar">
            <input
              type="search"
              placeholder="Sample No, Lot No veya Product ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={sampleTypeFilter} onChange={event => setSampleTypeFilter(event.target.value as SampleTypeFilter)}>
              <option value="all">Tüm Sample Type</option>
              {QUALITY_SAMPLE_TYPES.map(sampleType => (
                <option key={sampleType} value={sampleType}>{QUALITY_SAMPLE_TYPE_LABELS[sampleType]}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as SampleStatusFilter)}>
              <option value="all">Tüm Status</option>
              {QUALITY_SAMPLE_STATUSES.map(status => (
                <option key={status} value={status}>{QUALITY_SAMPLE_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Sample Date filtresi"
              value={sampleDateFilter}
              onChange={event => setSampleDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap sample-tracking-table-wrap">
            <table className="data-table sample-tracking-table">
              <thead>
                <tr>
                  <th>Sample No</th>
                  <th>Lot No</th>
                  <th>Product</th>
                  <th>Sample Type</th>
                  <th>Sample Date</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSamples.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun numune bulunamadı.</td></tr>
                )}
                {visibleSamples.map(sample => {
                  const lot = lotMap.get(sample.inventoryLotId) || null

                  return (
                    <tr
                      key={sample.id}
                      className={selectedSample?.id === sample.id ? 'selected' : ''}
                      tabIndex={0}
                      onClick={() => setSelectedSampleId(sample.id)}
                      onKeyDown={event => {
                        if(event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelectedSampleId(sample.id)
                      }}
                    >
                      <td data-label="Sample No"><strong>{sample.sampleNo}</strong></td>
                      <td data-label="Lot No">{lot?.lotNo || 'Lot bulunamadı'}</td>
                      <td data-label="Product">{getProductLabel(lot, productMap, stockItemMap)}</td>
                      <td data-label="Sample Type">{QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType]}</td>
                      <td data-label="Sample Date">{formatDate(sample.sampleDate)}</td>
                      <td data-label="Expiry Date">{formatDate(sample.expiryDate)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(sample.status)}`}>
                          {QUALITY_SAMPLE_STATUS_LABELS[sample.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side sample-tracking-side">
          <SampleDetailPanel
            branchMap={branchMap}
            lotMap={lotMap}
            productMap={productMap}
            productionOrderMap={productionOrderMap}
            sample={selectedSample}
            stockItemMap={stockItemMap}
            onEdit={startEdit}
            onPreviewBarcode={sample => setBarcodePreviewRequest(BarcodeIntegrationService.fromQualitySample(sample, lotMap.get(sample.inventoryLotId) || null))}
            onPreviewQR={sample => setQrPreviewRequest(QRIntegrationService.fromQualitySample(sample, lotMap.get(sample.inventoryLotId) || null))}
            onPrint={sample => setPrintDocuments([createSamplePrintDocument(sample)])}
            onStatusChange={updateStatus}
          />
          <SampleFormPanel
            availableLots={availableLots}
            form={form}
            formError={formError}
            formMode={formMode}
            lotMap={lotMap}
            productMap={productMap}
            stockItemMap={stockItemMap}
            onCancel={startCreate}
            onChange={setForm}
            onLotChange={handleLotChange}
            onSampleDateChange={handleSampleDateChange}
            onSave={saveForm}
          />
        </aside>
      </div>
      <BarcodePreviewModal
        request={barcodePreviewRequest}
        bulkRequests={visibleSamples.map(sample => BarcodeIntegrationService.fromQualitySample(sample, lotMap.get(sample.inventoryLotId) || null))}
        userName={getUserName(currentUser)}
        onClose={() => setBarcodePreviewRequest(null)}
      />
      <QRPreviewModal
        request={qrPreviewRequest}
        bulkRequests={visibleSamples.map(sample => QRIntegrationService.fromQualitySample(sample, lotMap.get(sample.inventoryLotId) || null))}
        userName={getUserName(currentUser)}
        onClose={() => setQrPreviewRequest(null)}
      />
      <PrintPreviewModal
        moduleKey="samples"
        documents={printDocuments}
        userName={getUserName(currentUser)}
        onClose={() => setPrintDocuments([])}
      />
    </div>
  )
}

function SampleDetailPanel({
  branchMap,
  lotMap,
  productMap,
  productionOrderMap,
  sample,
  stockItemMap,
  onEdit,
  onPreviewBarcode,
  onPreviewQR,
  onPrint,
  onStatusChange
}: {
  branchMap: Map<string, Branch>
  lotMap: Map<string, InventoryLot>
  productMap: Map<string, InventoryLotProductReference>
  productionOrderMap: Map<string, ProductionWorkOrder>
  sample: QualitySample | null
  stockItemMap: Map<string, StockItem>
  onEdit: (sample: QualitySample) => void
  onPreviewBarcode: (sample: QualitySample) => void
  onPreviewQR: (sample: QualitySample) => void
  onPrint: (sample: QualitySample) => void
  onStatusChange: (sample: QualitySample, status: QualitySampleStatus) => void
}){
  if(!sample){
    return (
      <section className="card sample-tracking-detail-card">
        <div className="section-header compact">
          <h3>Numune Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir numune seçin.</p>
      </section>
    )
  }

  const lot = lotMap.get(sample.inventoryLotId) || null

  return (
    <>
      <section className="card sample-tracking-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{sample.sampleNo}</h3>
            <p className="muted">{lot?.lotNo || 'Lot bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(sample.status)}`}>
            {QUALITY_SAMPLE_STATUS_LABELS[sample.status]}
          </span>
        </div>
        <div className="sample-tracking-side-actions">
          <button className="btn secondary" type="button" onClick={() => onPrint(sample)}>Yazdır</button>
          <select value={sample.status} onChange={event => onStatusChange(sample, event.target.value as QualitySampleStatus)}>
            {QUALITY_SAMPLE_STATUSES.map(status => (
              <option key={status} value={status}>{QUALITY_SAMPLE_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={() => onPreviewBarcode(sample)}>Barkod Önizle</button>
          <button className="btn secondary" type="button" onClick={() => onPreviewQR(sample)}>QR Önizle</button>
          <button className="btn secondary" type="button" onClick={() => onEdit(sample)}>Düzenle</button>
        </div>
      </section>

      <section className="card sample-tracking-detail-card">
        <h3>Detay</h3>
        <div className="sample-tracking-detail-grid">
          <div><span>Inventory Lot</span><strong>{getLotLabel(sample.inventoryLotId, lotMap)}</strong></div>
          <div><span>Product</span><strong>{getProductLabel(lot, productMap, stockItemMap)}</strong></div>
          <div><span>Production Order</span><strong>{getProductionOrderLabel(lot, productionOrderMap)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot, branchMap)}</strong></div>
          <div><span>Sample Type</span><strong>{QUALITY_SAMPLE_TYPE_LABELS[sample.sampleType]}</strong></div>
          <div><span>Sample Date</span><strong>{formatDate(sample.sampleDate)}</strong></div>
          <div><span>Expiry Date</span><strong>{formatDate(sample.expiryDate)}</strong></div>
          <div><span>Taken By</span><strong>{sample.takenBy}</strong></div>
          <div><span>Storage Location</span><strong>{sample.storageLocation || '-'}</strong></div>
          <div><span>Status</span><strong>{QUALITY_SAMPLE_STATUS_LABELS[sample.status]}</strong></div>
        </div>
      </section>

      <section className="card sample-tracking-detail-card">
        <h3>Notlar</h3>
        <p className="sample-tracking-notes">{sample.notes || '-'}</p>
      </section>
    </>
  )
}

function SampleFormPanel({
  availableLots,
  form,
  formError,
  formMode,
  lotMap,
  productMap,
  stockItemMap,
  onCancel,
  onChange,
  onLotChange,
  onSampleDateChange,
  onSave
}: {
  availableLots: InventoryLot[]
  form: QualitySampleInput
  formError: string
  formMode: SampleFormMode
  lotMap: Map<string, InventoryLot>
  productMap: Map<string, InventoryLotProductReference>
  stockItemMap: Map<string, StockItem>
  onCancel: () => void
  onChange: React.Dispatch<React.SetStateAction<QualitySampleInput>>
  onLotChange: (inventoryLotId: string) => void
  onSampleDateChange: (sampleDate: string) => void
  onSave: () => void
}){
  return (
    <section className="card sample-tracking-form">
      <div className="section-header compact">
        <div>
          <h3>{formMode === 'edit' ? 'Numune Düzenle' : 'Numune Oluştur'}</h3>
          <p className="muted">Numune kaydı yalnızca Inventory Lot ID ile ilişkilendirilir.</p>
        </div>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <div className="sample-tracking-form-grid">
        <label className="form-field">
          <span>Sample No</span>
          <input
            value={form.sampleNo}
            onChange={event => onChange(prev => ({ ...prev, sampleNo: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Status</span>
          <select value={form.status} onChange={event => onChange(prev => ({ ...prev, status: event.target.value as QualitySampleStatus }))}>
            {QUALITY_SAMPLE_STATUSES.map(status => (
              <option key={status} value={status}>{QUALITY_SAMPLE_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="form-field sample-tracking-form-wide">
          <span>Inventory Lot</span>
          <select value={form.inventoryLotId} onChange={event => onLotChange(event.target.value)}>
            {availableLots.map(lot => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNo} - {getProductLabel(lot, productMap, stockItemMap)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Sample Type</span>
          <select value={form.sampleType} onChange={event => onChange(prev => ({ ...prev, sampleType: event.target.value as QualitySampleType }))}>
            {QUALITY_SAMPLE_TYPES.map(sampleType => (
              <option key={sampleType} value={sampleType}>{QUALITY_SAMPLE_TYPE_LABELS[sampleType]}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Taken By</span>
          <input
            value={form.takenBy}
            onChange={event => onChange(prev => ({ ...prev, takenBy: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Sample Date</span>
          <input
            type="date"
            value={form.sampleDate}
            onChange={event => onSampleDateChange(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Expiry Date</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={event => onChange(prev => ({ ...prev, expiryDate: event.target.value }))}
          />
        </label>
        <label className="form-field sample-tracking-form-wide">
          <span>Storage Location</span>
          <input
            value={form.storageLocation}
            onChange={event => onChange(prev => ({ ...prev, storageLocation: event.target.value }))}
          />
        </label>
        <label className="form-field sample-tracking-form-wide">
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={event => onChange(prev => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </div>

      <div className="sample-tracking-side-actions">
        <button className="btn primary" type="button" onClick={onSave}>
          {formMode === 'edit' ? 'Güncelle' : 'Oluştur'}
        </button>
        {formMode === 'edit' && (
          <button className="btn secondary" type="button" onClick={onCancel}>Yeni Numune</button>
        )}
      </div>
    </section>
  )
}
