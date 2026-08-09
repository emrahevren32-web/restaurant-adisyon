import React from 'react'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import type { BarcodeGenerateInput } from '../barcode-engine/barcode.types'
import BarcodePreviewModal from '../components/BarcodePreviewModal'
import QRPreviewModal from '../components/QRPreviewModal'
import { loadFinalProducts } from '../final-products/final-product.mock'
import type { FinalProduct } from '../final-products/final-product.types'
import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import { loadLotSystemInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
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
import { QRIntegrationService } from '../qr-engine/qr-integration.service'
import type { QRGenerateInput } from '../qr-engine/qr.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import type { Branch, StockItem, StockUnit, User } from '../types'
import {
  WITNESS_SAMPLE_STATUS_LABELS,
  WITNESS_SAMPLE_STATUSES,
  createWitnessSampleRecord,
  getNextWitnessSampleNo,
  loadWitnessSampleRecords,
  saveWitnessSampleRecords,
  validateWitnessSampleInput
} from '../witness-samples/witness-sample.mock'
import type { WitnessSampleInput } from '../witness-samples/witness-sample.mock'
import type {
  WitnessSample,
  WitnessSampleStatus
} from '../witness-samples/witness-sample.types'

type FilterValue = 'all'
type WitnessStatusFilter = WitnessSampleStatus | FilterValue
type WitnessFormMode = 'create' | 'edit'

type WitnessInitialData = {
  branches: Branch[]
  inventoryLots: InventoryLot[]
  productRefs: InventoryLotProductReference[]
  productionOrders: ProductionWorkOrder[]
  qualitySamples: QualitySample[]
  stockItems: StockItem[]
  witnessSamples: WitnessSample[]
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

const getStatusClass = (status: WitnessSampleStatus) => {
  if(status === 'ACTIVE') return 'success'
  if(status === 'STORED') return 'info-pill'
  if(status === 'EXPIRED' || status === 'DISPOSED') return 'danger-pill'
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

const getSampleLabel = (qualitySampleId: string, sampleMap: Map<string, QualitySample>) => (
  sampleMap.get(qualitySampleId)?.sampleNo || 'Quality Sample bulunamadı'
)

const getLotFromWitness = (
  witness: WitnessSample | null,
  sampleMap: Map<string, QualitySample>,
  lotMap: Map<string, InventoryLot>
) => {
  if(!witness) return null
  const sample = sampleMap.get(witness.qualitySampleId)
  return sample ? lotMap.get(sample.inventoryLotId) || null : null
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

const getSampleLotLabel = (
  sample: QualitySample | null,
  lotMap: Map<string, InventoryLot>
) => (
  sample ? lotMap.get(sample.inventoryLotId)?.lotNo || 'Lot bulunamadı' : 'Lot bulunamadı'
)

const loadInitialData = (): WitnessInitialData => {
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
  const qualitySamples = loadQualitySampleRecords(inventoryLots)
  const witnessSamples = loadWitnessSampleRecords(qualitySamples)

  return {
    branches,
    inventoryLots,
    productRefs,
    productionOrders,
    qualitySamples,
    stockItems,
    witnessSamples
  }
}

const getSafeStorageStartDate = (sample: QualitySample | null) => {
  const today = todayKey()
  if(!sample?.sampleDate) return today
  return sample.sampleDate > today ? sample.sampleDate : today
}

const createEmptyForm = (
  witnessSamples: WitnessSample[],
  qualitySamples: QualitySample[],
  currentUser: User
): WitnessSampleInput => {
  const sample = qualitySamples[0] || null
  const storageStartDate = getSafeStorageStartDate(sample)

  return {
    witnessNo: getNextWitnessSampleNo(witnessSamples),
    qualitySampleId: sample?.id || '',
    storageLocation: '',
    storageStartDate,
    storageEndDate: addDays(storageStartDate, 30),
    status: 'STORED',
    responsiblePerson: getUserName(currentUser),
    notes: ''
  }
}

const createFormFromWitness = (sample: WitnessSample): WitnessSampleInput => ({
  witnessNo: sample.witnessNo,
  qualitySampleId: sample.qualitySampleId,
  storageLocation: sample.storageLocation,
  storageStartDate: sample.storageStartDate,
  storageEndDate: sample.storageEndDate,
  status: sample.status,
  responsiblePerson: sample.responsiblePerson,
  notes: sample.notes
})

export default function WitnessSamples({ currentUser }: { currentUser: User }){
  const initialData = React.useMemo(loadInitialData, [])
  const [records, setRecords] = React.useState<WitnessSample[]>(initialData.witnessSamples)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<WitnessStatusFilter>('all')
  const [storageLocationFilter, setStorageLocationFilter] = React.useState('all')
  const [storageEndDateFilter, setStorageEndDateFilter] = React.useState('')
  const [formMode, setFormMode] = React.useState<WitnessFormMode>('create')
  const [form, setForm] = React.useState<WitnessSampleInput>(() => (
    createEmptyForm(initialData.witnessSamples, initialData.qualitySamples, currentUser)
  ))
  const [formError, setFormError] = React.useState('')
  const [barcodePreviewRequest, setBarcodePreviewRequest] = React.useState<BarcodeGenerateInput | null>(null)
  const [qrPreviewRequest, setQrPreviewRequest] = React.useState<QRGenerateInput | null>(null)

  const { branches, inventoryLots, productRefs, productionOrders, qualitySamples, stockItems } = initialData
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const lotMap = React.useMemo(() => new Map(inventoryLots.map(lot => [lot.id, lot])), [inventoryLots])
  const productMap = React.useMemo(() => new Map(productRefs.map(product => [product.id, product])), [productRefs])
  const productionOrderMap = React.useMemo(() => (
    new Map(productionOrders.map(order => [order.id, order]))
  ), [productionOrders])
  const sampleMap = React.useMemo(() => new Map(qualitySamples.map(sample => [sample.id, sample])), [qualitySamples])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const storageLocations = React.useMemo(() => (
    Array.from(new Set(records.map(record => record.storageLocation).filter(Boolean)))
  ), [records])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const sample = sampleMap.get(record.qualitySampleId) || null
      const lot = getLotFromWitness(record, sampleMap, lotMap)
      const productLabel = getProductLabel(lot, productMap, stockItemMap)
      const searchFields = [
        record.witnessNo,
        sample?.sampleNo || '',
        lot?.lotNo || '',
        productLabel
      ]

      const matchesSearch = !normalizedSearch || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesStorageLocation = storageLocationFilter === 'all' || record.storageLocation === storageLocationFilter
      const matchesStorageEndDate = !storageEndDateFilter || record.storageEndDate === storageEndDateFilter

      return matchesSearch && matchesStatus && matchesStorageLocation && matchesStorageEndDate
    })
  }, [lotMap, productMap, records, sampleMap, search, statusFilter, stockItemMap, storageEndDateFilter, storageLocationFilter])

  const storedCount = records.filter(record => record.status === 'STORED').length
  const activeCount = records.filter(record => record.status === 'ACTIVE').length
  const expiredCount = records.filter(record => record.status === 'EXPIRED').length
  const disposedCount = records.filter(record => record.status === 'DISPOSED').length

  const commitRecords = (nextRecords: WitnessSample[]) => {
    setRecords(nextRecords)
    saveWitnessSampleRecords(nextRecords)
  }

  const startCreate = () => {
    setFormMode('create')
    setFormError('')
    setForm(createEmptyForm(records, qualitySamples, currentUser))
  }

  const startEdit = (record: WitnessSample) => {
    setFormMode('edit')
    setFormError('')
    setSelectedRecordId(record.id)
    setForm(createFormFromWitness(record))
  }

  const handleSampleChange = (qualitySampleId: string) => {
    const sample = sampleMap.get(qualitySampleId) || null

    setForm(prev => {
      const storageStartDate = sample?.sampleDate && prev.storageStartDate < sample.sampleDate
        ? sample.sampleDate
        : prev.storageStartDate
      const storageEndDate = prev.storageEndDate < storageStartDate
        ? addDays(storageStartDate, 30)
        : prev.storageEndDate

      return {
        ...prev,
        qualitySampleId,
        storageStartDate,
        storageEndDate
      }
    })
  }

  const handleStorageStartDateChange = (storageStartDate: string) => {
    setForm(prev => ({
      ...prev,
      storageStartDate,
      storageEndDate: prev.storageEndDate && prev.storageEndDate >= storageStartDate
        ? prev.storageEndDate
        : addDays(storageStartDate, 30)
    }))
  }

  const saveForm = () => {
    const validationError = validateWitnessSampleInput(
      form,
      sampleMap,
      records,
      formMode === 'edit' ? selectedRecord?.id || '' : ''
    )
    if(validationError){
      setFormError(validationError)
      return
    }

    const nextRecord = createWitnessSampleRecord(
      form,
      formMode === 'edit' ? selectedRecord || undefined : undefined
    )
    const nextRecords = formMode === 'edit' && selectedRecord
      ? records.map(record => record.id === selectedRecord.id ? nextRecord : record)
      : [nextRecord, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecord.id)
    setFormMode('edit')
    setForm(createFormFromWitness(nextRecord))
    setFormError('')
  }

  const updateStatus = (record: WitnessSample, status: WitnessSampleStatus) => {
    const nextRecord = createWitnessSampleRecord({ ...createFormFromWitness(record), status }, record)
    commitRecords(records.map(item => item.id === record.id ? nextRecord : item))
    setSelectedRecordId(record.id)
    if(formMode === 'edit' && form.witnessNo === record.witnessNo) setForm(createFormFromWitness(nextRecord))
  }

  return (
    <div className="witness-sample-page">
      <div className="page-header">
        <div>
          <h2>Şahit Numune</h2>
          <p className="muted">Resmi saklama amacıyla ayrılan şahit numuneleri Quality Sample üzerinden izleyin.</p>
        </div>
        <div className="witness-sample-header-actions">
          <span className="muted">Sorumlu: {getUserName(currentUser)}</span>
          <button className="btn primary" type="button" onClick={startCreate}>Yeni Şahit Numune</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Saklanıyor</span>
          <strong>{storedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Süresi Doldu</span>
          <strong>{expiredCount}</strong>
        </div>
        <div className="metric-card">
          <span>İmha Edildi</span>
          <strong>{disposedCount}</strong>
        </div>
      </div>

      <div className="product-layout witness-sample-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Şahit Numune Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
          </div>

          <div className="witness-sample-toolbar">
            <input
              type="search"
              placeholder="Witness No, Sample No, Lot No veya Product ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as WitnessStatusFilter)}>
              <option value="all">Tüm Status</option>
              {WITNESS_SAMPLE_STATUSES.map(status => (
                <option key={status} value={status}>{WITNESS_SAMPLE_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={storageLocationFilter} onChange={event => setStorageLocationFilter(event.target.value)}>
              <option value="all">Tüm Storage Location</option>
              {storageLocations.map(location => <option key={location} value={location}>{location}</option>)}
            </select>
            <input
              type="date"
              aria-label="Storage End Date filtresi"
              value={storageEndDateFilter}
              onChange={event => setStorageEndDateFilter(event.target.value)}
            />
          </div>

          <div className="table-wrap witness-sample-table-wrap">
            <table className="data-table witness-sample-table">
              <thead>
                <tr>
                  <th>Witness No</th>
                  <th>Sample No</th>
                  <th>Lot No</th>
                  <th>Product</th>
                  <th>Storage Location</th>
                  <th>Storage End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun şahit numune bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const sample = sampleMap.get(record.qualitySampleId) || null
                  const lot = getLotFromWitness(record, sampleMap, lotMap)

                  return (
                    <tr
                      key={record.id}
                      className={selectedRecord?.id === record.id ? 'selected' : ''}
                      tabIndex={0}
                      onClick={() => setSelectedRecordId(record.id)}
                      onKeyDown={event => {
                        if(event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelectedRecordId(record.id)
                      }}
                    >
                      <td data-label="Witness No"><strong>{record.witnessNo}</strong></td>
                      <td data-label="Sample No">{sample?.sampleNo || 'Sample bulunamadı'}</td>
                      <td data-label="Lot No">{lot?.lotNo || 'Lot bulunamadı'}</td>
                      <td data-label="Product">{getProductLabel(lot, productMap, stockItemMap)}</td>
                      <td data-label="Storage Location">{record.storageLocation}</td>
                      <td data-label="Storage End Date">{formatDate(record.storageEndDate)}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${getStatusClass(record.status)}`}>
                          {WITNESS_SAMPLE_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side witness-sample-side">
          <WitnessDetailPanel
            branchMap={branchMap}
            lotMap={lotMap}
            productMap={productMap}
            productionOrderMap={productionOrderMap}
            sampleMap={sampleMap}
            record={selectedRecord}
            stockItemMap={stockItemMap}
            onEdit={startEdit}
            onPreviewBarcode={record => setBarcodePreviewRequest(BarcodeIntegrationService.fromWitnessSample(
              record,
              sampleMap.get(record.qualitySampleId) || null,
              getLotFromWitness(record, sampleMap, lotMap)
            ))}
            onPreviewQR={record => setQrPreviewRequest(QRIntegrationService.fromWitnessSample(
              record,
              sampleMap.get(record.qualitySampleId) || null,
              getLotFromWitness(record, sampleMap, lotMap)
            ))}
            onStatusChange={updateStatus}
          />
          <WitnessFormPanel
            form={form}
            formError={formError}
            formMode={formMode}
            lotMap={lotMap}
            productMap={productMap}
            qualitySamples={qualitySamples}
            stockItemMap={stockItemMap}
            onCancel={startCreate}
            onChange={setForm}
            onSampleChange={handleSampleChange}
            onSave={saveForm}
            onStorageStartDateChange={handleStorageStartDateChange}
          />
        </aside>
      </div>
      <BarcodePreviewModal
        request={barcodePreviewRequest}
        bulkRequests={visibleRecords.map(record => BarcodeIntegrationService.fromWitnessSample(
          record,
          sampleMap.get(record.qualitySampleId) || null,
          getLotFromWitness(record, sampleMap, lotMap)
        ))}
        userName={getUserName(currentUser)}
        onClose={() => setBarcodePreviewRequest(null)}
      />
      <QRPreviewModal
        request={qrPreviewRequest}
        bulkRequests={visibleRecords.map(record => QRIntegrationService.fromWitnessSample(
          record,
          sampleMap.get(record.qualitySampleId) || null,
          getLotFromWitness(record, sampleMap, lotMap)
        ))}
        userName={getUserName(currentUser)}
        onClose={() => setQrPreviewRequest(null)}
      />
    </div>
  )
}

function WitnessDetailPanel({
  branchMap,
  lotMap,
  productMap,
  productionOrderMap,
  record,
  sampleMap,
  stockItemMap,
  onEdit,
  onPreviewBarcode,
  onPreviewQR,
  onStatusChange
}: {
  branchMap: Map<string, Branch>
  lotMap: Map<string, InventoryLot>
  productMap: Map<string, InventoryLotProductReference>
  productionOrderMap: Map<string, ProductionWorkOrder>
  record: WitnessSample | null
  sampleMap: Map<string, QualitySample>
  stockItemMap: Map<string, StockItem>
  onEdit: (record: WitnessSample) => void
  onPreviewBarcode: (record: WitnessSample) => void
  onPreviewQR: (record: WitnessSample) => void
  onStatusChange: (record: WitnessSample, status: WitnessSampleStatus) => void
}){
  if(!record){
    return (
      <section className="card witness-sample-detail-card">
        <div className="section-header compact">
          <h3>Şahit Numune Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir şahit numune seçin.</p>
      </section>
    )
  }

  const sample = sampleMap.get(record.qualitySampleId) || null
  const lot = getLotFromWitness(record, sampleMap, lotMap)

  return (
    <>
      <section className="card witness-sample-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.witnessNo}</h3>
            <p className="muted">{sample?.sampleNo || 'Sample bulunamadı'}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>
            {WITNESS_SAMPLE_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="witness-sample-side-actions">
          <select value={record.status} onChange={event => onStatusChange(record, event.target.value as WitnessSampleStatus)}>
            {WITNESS_SAMPLE_STATUSES.map(status => (
              <option key={status} value={status}>{WITNESS_SAMPLE_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={() => onPreviewBarcode(record)}>Barkod Önizle</button>
          <button className="btn secondary" type="button" onClick={() => onPreviewQR(record)}>QR Önizle</button>
          <button className="btn secondary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
        </div>
      </section>

      <section className="card witness-sample-detail-card">
        <h3>Detay</h3>
        <div className="witness-sample-detail-grid">
          <div><span>Quality Sample</span><strong>{getSampleLabel(record.qualitySampleId, sampleMap)}</strong></div>
          <div><span>Inventory Lot</span><strong>{getSampleLotLabel(sample, lotMap)}</strong></div>
          <div><span>Product</span><strong>{getProductLabel(lot, productMap, stockItemMap)}</strong></div>
          <div><span>Production Order</span><strong>{getProductionOrderLabel(lot, productionOrderMap)}</strong></div>
          <div><span>Warehouse</span><strong>{getWarehouseLabel(lot, branchMap)}</strong></div>
          <div><span>Storage Location</span><strong>{record.storageLocation}</strong></div>
          <div><span>Storage Start Date</span><strong>{formatDate(record.storageStartDate)}</strong></div>
          <div><span>Storage End Date</span><strong>{formatDate(record.storageEndDate)}</strong></div>
          <div><span>Responsible Person</span><strong>{record.responsiblePerson}</strong></div>
          <div><span>Status</span><strong>{WITNESS_SAMPLE_STATUS_LABELS[record.status]}</strong></div>
        </div>
      </section>

      <section className="card witness-sample-detail-card">
        <h3>Notlar</h3>
        <p className="witness-sample-notes">{record.notes || '-'}</p>
      </section>
    </>
  )
}

function WitnessFormPanel({
  form,
  formError,
  formMode,
  lotMap,
  productMap,
  qualitySamples,
  stockItemMap,
  onCancel,
  onChange,
  onSampleChange,
  onSave,
  onStorageStartDateChange
}: {
  form: WitnessSampleInput
  formError: string
  formMode: WitnessFormMode
  lotMap: Map<string, InventoryLot>
  productMap: Map<string, InventoryLotProductReference>
  qualitySamples: QualitySample[]
  stockItemMap: Map<string, StockItem>
  onCancel: () => void
  onChange: React.Dispatch<React.SetStateAction<WitnessSampleInput>>
  onSampleChange: (qualitySampleId: string) => void
  onSave: () => void
  onStorageStartDateChange: (storageStartDate: string) => void
}){
  return (
    <section className="card witness-sample-form">
      <div className="section-header compact">
        <div>
          <h3>{formMode === 'edit' ? 'Şahit Numune Düzenle' : 'Şahit Numune Oluştur'}</h3>
          <p className="muted">Şahit numune kaydı yalnızca Quality Sample ID ile ilişkilendirilir.</p>
        </div>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <div className="witness-sample-form-grid">
        <label className="form-field">
          <span>Witness No</span>
          <input
            value={form.witnessNo}
            onChange={event => onChange(prev => ({ ...prev, witnessNo: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Status</span>
          <select value={form.status} onChange={event => onChange(prev => ({ ...prev, status: event.target.value as WitnessSampleStatus }))}>
            {WITNESS_SAMPLE_STATUSES.map(status => (
              <option key={status} value={status}>{WITNESS_SAMPLE_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="form-field witness-sample-form-wide">
          <span>Quality Sample</span>
          <select value={form.qualitySampleId} onChange={event => onSampleChange(event.target.value)}>
            {qualitySamples.map(sample => {
              const lot = lotMap.get(sample.inventoryLotId) || null
              return (
                <option key={sample.id} value={sample.id}>
                  {sample.sampleNo} - {lot?.lotNo || 'Lot bulunamadı'} - {getProductLabel(lot, productMap, stockItemMap)}
                </option>
              )
            })}
          </select>
        </label>
        <label className="form-field witness-sample-form-wide">
          <span>Storage Location</span>
          <input
            value={form.storageLocation}
            onChange={event => onChange(prev => ({ ...prev, storageLocation: event.target.value }))}
          />
        </label>
        <label className="form-field">
          <span>Storage Start Date</span>
          <input
            type="date"
            value={form.storageStartDate}
            onChange={event => onStorageStartDateChange(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Storage End Date</span>
          <input
            type="date"
            value={form.storageEndDate}
            onChange={event => onChange(prev => ({ ...prev, storageEndDate: event.target.value }))}
          />
        </label>
        <label className="form-field witness-sample-form-wide">
          <span>Responsible Person</span>
          <input
            value={form.responsiblePerson}
            onChange={event => onChange(prev => ({ ...prev, responsiblePerson: event.target.value }))}
          />
        </label>
        <label className="form-field witness-sample-form-wide">
          <span>Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={event => onChange(prev => ({ ...prev, notes: event.target.value }))}
          />
        </label>
      </div>

      <div className="witness-sample-side-actions">
        <button className="btn primary" type="button" onClick={onSave}>
          {formMode === 'edit' ? 'Güncelle' : 'Oluştur'}
        </button>
        {formMode === 'edit' && (
          <button className="btn secondary" type="button" onClick={onCancel}>Yeni Şahit Numune</button>
        )}
      </div>
    </section>
  )
}
