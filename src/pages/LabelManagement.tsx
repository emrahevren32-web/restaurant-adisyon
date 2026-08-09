import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { LabelPrintService } from '../label-management/label-print.service'
import {
  LABEL_STATUS_LABELS,
  LabelService
} from '../label-management/label.service'
import {
  LABEL_TEMPLATE_SIZE_LABELS,
  LABEL_TYPE_LABELS,
  LabelTemplateService
} from '../label-management/label-template.service'
import type {
  Label,
  LabelFilters,
  LabelPrintMode,
  LabelTemplate,
  LabelType
} from '../label-management/label.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import {
  formatNumber,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const getStatusClass = (status: Label['status']) => {
  if(status === 'PRINTED') return 'success'
  if(status === 'READY') return 'info-pill'
  if(status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getLotLabel = (
  lot: InventoryLot,
  sourceData: KpiSourceData
) => {
  const product = sourceData.productRefs.find(item => item.id === lot.productId || item.stockItemId === lot.stockItemId)
  const stockItem = sourceData.stockItems.find(item => item.id === lot.stockItemId)
  return `${lot.lotNo} - ${product?.name || stockItem?.name || lot.productId}`
}

const expandLabelsForQuantity = (
  labels: Label[],
  quantity: number
) => labels.flatMap(label => Array.from({ length: quantity }, () => label))

const getTemplateForLabels = (
  labels: Label[]
): LabelTemplate => (
  LabelTemplateService.get(labels[0]?.templateId || LabelTemplateService.list()[0].id)
)

export default function LabelManagement({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [labels, setLabels] = React.useState<Label[]>(() => LabelService.list(sourceData))
  const [printJobs, setPrintJobs] = React.useState(() => LabelService.listPrintJobs(LabelService.list(sourceData)))
  const [filters, setFilters] = React.useState<LabelFilters>(() => LabelService.createDefaultFilters())
  const [selectedLabelId, setSelectedLabelId] = React.useState('')
  const [selectedLotId, setSelectedLotId] = React.useState('')
  const [selectedLabelType, setSelectedLabelType] = React.useState<LabelType>('PRODUCT')
  const [selectedTemplateId, setSelectedTemplateId] = React.useState(LabelTemplateService.listForType('PRODUCT')[0]?.id || LabelTemplateService.list()[0].id)
  const [printQuantity, setPrintQuantity] = React.useState(1)
  const [message, setMessage] = React.useState<Message | null>(null)
  const [qrPreview, setQrPreview] = React.useState('')
  const [barcodePreview, setBarcodePreview] = React.useState('')
  const filteredLabels = React.useMemo(() => LabelService.filter(labels, filters), [filters, labels])
  const statistics = React.useMemo(() => LabelService.statistics(labels, printJobs), [labels, printJobs])
  const selectedLabel = filteredLabels.find(label => label.id === selectedLabelId)
    || labels.find(label => label.id === selectedLabelId)
    || filteredLabels[0]
    || labels[0]
    || null
  const templates = React.useMemo(LabelTemplateService.list, [])
  const labelTypeTemplates = React.useMemo(() => LabelTemplateService.listForType(selectedLabelType), [selectedLabelType])
  const branchOptions = React.useMemo(() => uniqueOptions(labels.map(label => ({ id: label.branchId, name: label.branchName }))), [labels])
  const warehouseOptions = React.useMemo(() => uniqueOptions(labels.map(label => ({ id: label.warehouseId, name: label.warehouseName }))), [labels])
  const lotOptions = React.useMemo(() => sourceData.inventoryLots
    .filter(lot => lot.quantity > 0)
    .slice(0, 60)
    .map(lot => ({ id: lot.id, label: getLotLabel(lot, sourceData) })), [sourceData])

  React.useEffect(() => {
    if(selectedLabelId && labels.some(label => label.id === selectedLabelId)) return
    setSelectedLabelId(filteredLabels[0]?.id || labels[0]?.id || '')
  }, [filteredLabels, labels, selectedLabelId])

  React.useEffect(() => {
    if(selectedLotId && lotOptions.some(lot => lot.id === selectedLotId)) return
    setSelectedLotId(lotOptions[0]?.id || '')
  }, [lotOptions, selectedLotId])

  React.useEffect(() => {
    if(labelTypeTemplates.some(template => template.id === selectedTemplateId)) return
    setSelectedTemplateId(labelTypeTemplates[0]?.id || templates[0]?.id || '')
  }, [labelTypeTemplates, selectedTemplateId, templates])

  React.useEffect(() => {
    let cancelled = false
    setQrPreview('')
    setBarcodePreview('')

    const createPreview = async () => {
      if(!selectedLabel) return
      try{
        const qr = await LabelPrintService.createQrDataUrl(selectedLabel.qrPayload)
        const barcode = LabelPrintService.createCode128DataUrl(selectedLabel.barcodeValue)
        if(!cancelled){
          setQrPreview(qr)
          setBarcodePreview(barcode)
        }
      } catch {
        if(!cancelled) setMessage({ type: 'error', text: 'QR veya barkod onizleme olusturulamadi.' })
      }
    }

    createPreview()
    return () => {
      cancelled = true
    }
  }, [selectedLabel])

  const refresh = (targetLabelId?: string) => {
    const nextLabels = LabelService.list(sourceData)
    setLabels(nextLabels)
    setPrintJobs(LabelService.listPrintJobs(nextLabels))
    if(targetLabelId) setSelectedLabelId(targetLabelId)
  }

  const updateFilter = <TKey extends keyof LabelFilters>(key: TKey, value: LabelFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const createLabel = () => {
    if(!selectedLotId){
      setMessage({ type: 'error', text: 'Lot secilmedi.' })
      return
    }

    try{
      const label = LabelService.addFromLot({
        lotId: selectedLotId,
        labelType: selectedLabelType,
        templateId: selectedTemplateId,
        quantity: 1,
        actorName: userName
      }, sourceData)
      refresh(label.id)
      setMessage({ type: 'success', text: `${label.labelNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Etiket olusturulamadi.' })
    }
  }

  const resolvePrintLabels = (mode: LabelPrintMode) => {
    if(!selectedLabel) return []
    if(mode === 'SINGLE') return [selectedLabel]
    if(mode === 'BULK') return filteredLabels
    if(mode === 'LOT') return labels.filter(label => label.lotId === selectedLabel.lotId)
    if(mode === 'PRODUCTION_ORDER') return labels.filter(label => label.productionOrderId === selectedLabel.productionOrderId)
    if(mode === 'PALLET') return labels.filter(label => label.palletId && label.palletId === selectedLabel.palletId)
    return [selectedLabel]
  }

  const printLabels = async (mode: LabelPrintMode) => {
    const printTargets = resolvePrintLabels(mode)
    if(printTargets.length === 0){
      setMessage({ type: 'error', text: 'Yazdirilacak etiket bulunamadi.' })
      return
    }

    try{
      const template = getTemplateForLabels(printTargets)
      await LabelPrintService.openPrintWindow(expandLabelsForQuantity(printTargets, printQuantity), template, mode)
      const result = LabelService.recordPrint(printTargets, mode, printQuantity, sourceData, userName)
      refresh(result.labels[0]?.id || selectedLabel?.id)
      setMessage({ type: 'success', text: `${result.job.quantity} etiket yazdirma job kaydi olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Etiket yazdirilamadi.' })
    }
  }

  const exportSelectedLabel = () => {
    if(!selectedLabel) return

    try{
      ExcelIntegrationService.exportModules({
        moduleKeys: ['labels'],
        scope: 'SELECTED',
        filterText: '',
        selectedRecordIds: [selectedLabel.id],
        userName
      })
      const label = LabelService.recordOutput(selectedLabel.id, 'EXCEL', sourceData, userName)
      refresh(label.id)
      setMessage({ type: 'success', text: `${label.labelNo} Excel export edildi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Excel export basarisiz.' })
    }
  }

  return (
    <div className="label-management-page">
      <div className="page-header">
        <div>
          <h2>Etiket Yonetimi</h2>
          <p className="muted">Lot, uretim, depo, recete, HACCP, sample, witness sample, sevkiyat ve Excel Engine ile entegre kurumsal barkodlu etiket merkezi.</p>
        </div>
        <div className="label-create-actions">
          <select value={selectedLotId} onChange={event => setSelectedLotId(event.target.value)}>
            {lotOptions.length === 0 && <option value="">Lot yok</option>}
            {lotOptions.map(lot => <option key={lot.id} value={lot.id}>{lot.label}</option>)}
          </select>
          <select value={selectedLabelType} onChange={event => setSelectedLabelType(event.target.value as LabelType)}>
            {LabelTemplateService.types.map(type => <option key={type} value={type}>{LABEL_TYPE_LABELS[type]}</option>)}
          </select>
          <select value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)}>
            {labelTypeTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <button className="primary-button" type="button" onClick={createLabel} disabled={!selectedLotId}>Etiket Olustur</button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid label-card-grid">
        <div className="metric-card"><span>Bugun Basilan</span><strong>{formatNumber(statistics.todayPrinted)}</strong></div>
        <div className="metric-card"><span>Toplam Basilan</span><strong>{formatNumber(statistics.totalPrinted)}</strong></div>
        <div className="metric-card"><span>Toplam Etiket</span><strong>{formatNumber(statistics.totalLabels)}</strong></div>
        <div className="metric-card"><span>En Cok Urun</span><strong>{statistics.topPrintedProduct}</strong></div>
        <div className="metric-card"><span>En Cok Lot</span><strong>{statistics.topPrintedLot}</strong></div>
      </div>

      <div className="product-layout label-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Label List</h3>
              <p className="muted">{formatNumber(filteredLabels.length)} / {formatNumber(labels.length)} etiket listeleniyor.</p>
            </div>
            <button className="btn" type="button" onClick={() => setFilters(LabelService.createDefaultFilters())}>Sifirla</button>
          </div>

          <div className="label-toolbar">
            <input
              type="search"
              placeholder="Lot, urun, etiket no veya batch ara"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value="all">Tum Subeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value="all">Tum Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <select value={filters.labelType} onChange={event => updateFilter('labelType', event.target.value as LabelFilters['labelType'])}>
              <option value="all">Tum Etiket Turleri</option>
              {LabelTemplateService.types.map(type => <option key={type} value={type}>{LABEL_TYPE_LABELS[type]}</option>)}
            </select>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </div>

          <div className="table-wrap label-table-wrap">
            <table className="data-table label-table">
              <thead>
                <tr>
                  <th>Etiket No</th>
                  <th>Tur</th>
                  <th>Urun</th>
                  <th>Lot / Batch</th>
                  <th>Depo</th>
                  <th>Template</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabels.map(label => (
                  <tr
                    key={label.id}
                    aria-selected={selectedLabel?.id === label.id}
                    onClick={() => {
                      setSelectedLabelId(label.id)
                      setMessage(null)
                    }}
                  >
                    <td data-label="Etiket No"><strong>{label.labelNo}</strong><span className="muted">{label.productCode}</span></td>
                    <td data-label="Tur">{LABEL_TYPE_LABELS[label.labelType]}</td>
                    <td data-label="Urun"><strong>{label.productName}</strong><span className="muted">{label.recipeName || '-'}</span></td>
                    <td data-label="Lot / Batch"><strong>{label.lotNo}</strong><span className="muted">{label.batchNo}</span></td>
                    <td data-label="Depo">{label.warehouseName}</td>
                    <td data-label="Template">{label.templateName}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(label.status)}`}>{LABEL_STATUS_LABELS[label.status]}</span></td>
                  </tr>
                ))}
                {filteredLabels.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={7}>Filtrelere uygun etiket bulunamadi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side label-side">
          {selectedLabel ? (
            <section className="card label-detail-card">
              <div className="section-header compact">
                <div>
                  <h3>{selectedLabel.labelNo}</h3>
                  <p className="muted">{LABEL_TYPE_LABELS[selectedLabel.labelType]} - {selectedLabel.productName}</p>
                </div>
                <span className={`status-pill ${getStatusClass(selectedLabel.status)}`}>{LABEL_STATUS_LABELS[selectedLabel.status]}</span>
              </div>

              <div className="label-preview-grid">
                <div className="label-preview-card">
                  <strong>{selectedLabel.productName}</strong>
                  <span>{selectedLabel.lotNo} / {selectedLabel.batchNo}</span>
                  {qrPreview ? <img src={qrPreview} alt="QR Code" /> : <div className="empty-state">QR hazirlaniyor.</div>}
                  {barcodePreview ? <img className="label-barcode-preview" src={barcodePreview} alt="Code 128" /> : null}
                </div>
                <div className="label-preview-meta">
                  <div><span>QR Code</span><strong>{selectedLabel.qrPayload}</strong></div>
                  <div><span>Code-128</span><strong>{selectedLabel.barcodeValue}</strong></div>
                  <div><span>DataMatrix</span><strong>{selectedLabel.dataMatrixPayload}</strong></div>
                </div>
              </div>

              <div className="label-print-actions">
                <label className="form-field">
                  <span>Adet</span>
                  <input type="number" min={1} max={500} value={printQuantity} onChange={event => setPrintQuantity(Number(event.target.value))} />
                </label>
                <button className="btn" type="button" onClick={() => printLabels('SINGLE')}>Tek Etiket</button>
                <button className="btn" type="button" onClick={() => printLabels('BULK')}>Toplu Yazdir</button>
                <button className="btn" type="button" onClick={() => printLabels('LOT')}>Lot Bazli</button>
                <button className="btn" type="button" onClick={() => printLabels('PRODUCTION_ORDER')}>Uretim Emri</button>
                <button className="btn" type="button" onClick={() => printLabels('PALLET')} disabled={!selectedLabel.palletId}>Palet Bazli</button>
                <button className="btn" type="button" onClick={exportSelectedLabel}>Excel Export</button>
              </div>

              <div className="label-detail-section">
                <h4>Etiket Icerigi</h4>
                <div className="label-detail-grid">
                  <div><span>Urun Adi</span><strong>{selectedLabel.productName}</strong></div>
                  <div><span>Urun Kodu</span><strong>{selectedLabel.productCode}</strong></div>
                  <div><span>Lot No</span><strong>{selectedLabel.lotNo}</strong></div>
                  <div><span>Batch No</span><strong>{selectedLabel.batchNo}</strong></div>
                  <div><span>Uretim Tarihi</span><strong>{formatDate(selectedLabel.productionDate)}</strong></div>
                  <div><span>SKT</span><strong>{formatDate(selectedLabel.expiryDate)}</strong></div>
                  <div><span>Net Agirlik</span><strong>{formatQuantity(selectedLabel.netWeight, selectedLabel.unit)}</strong></div>
                  <div><span>Brut Agirlik</span><strong>{formatQuantity(selectedLabel.grossWeight, selectedLabel.unit)}</strong></div>
                  <div><span>Depo</span><strong>{selectedLabel.warehouseName}</strong></div>
                  <div><span>Sube</span><strong>{selectedLabel.branchName}</strong></div>
                  <div><span>Uretim Emri</span><strong>{selectedLabel.productionOrderNo || '-'}</strong></div>
                  <div><span>Recete</span><strong>{selectedLabel.recipeName || '-'}</strong></div>
                </div>
              </div>

              <div className="label-detail-section">
                <h4>Entegrasyonlar</h4>
                <div className="label-detail-grid">
                  <div><span>Shipment</span><strong>{selectedLabel.shipmentNo || '-'}</strong></div>
                  <div><span>Customer</span><strong>{selectedLabel.customerName || '-'}</strong></div>
                  <div><span>Sample</span><strong>{selectedLabel.sampleNo || '-'}</strong></div>
                  <div><span>Witness Sample</span><strong>{selectedLabel.witnessNo || '-'}</strong></div>
                  <div><span>HACCP</span><strong>{selectedLabel.haccpPlanName || '-'}</strong></div>
                  <div><span>Palet</span><strong>{selectedLabel.palletNo || '-'}</strong></div>
                </div>
              </div>

              <div className="label-detail-section">
                <h4>Template Sistem</h4>
                <div className="label-template-list compact">
                  {templates.map(template => (
                    <div key={template.id} aria-selected={template.id === selectedLabel.templateId}>
                      <strong>{template.name}</strong>
                      <span>{LABEL_TEMPLATE_SIZE_LABELS[template.size]} - {template.widthMm}x{template.heightMm} mm</span>
                      <em>{template.supportedTypes.map(type => LABEL_TYPE_LABELS[type]).join(', ')}</em>
                    </div>
                  ))}
                </div>
              </div>

              <div className="label-detail-section">
                <h4>History</h4>
                <div className="label-history-list">
                  {[...selectedLabel.history].reverse().map(history => (
                    <div key={history.id}>
                      <strong>{history.action} - {history.actorName}</strong>
                      <span>{formatDateTime(history.createdAt)} / {formatNumber(history.quantity)} adet</span>
                      <p>{history.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="card label-detail-card">
              <p className="shipment-empty-state">Etiket kaydi bulunamadi.</p>
            </section>
          )}
        </aside>
      </div>

      <section className="card label-template-panel">
        <div className="section-header compact">
          <div>
            <h3>Label Templates</h3>
            <p className="muted">A4, 50x30, 70x50, 100x100 ve ozel sablonlar fiziksel yazici entegrasyonu olmadan read model olarak yonetilir.</p>
          </div>
          <span className="status-pill">{formatNumber(statistics.totalTemplates)} sablon</span>
        </div>
        <div className="label-template-list">
          {templates.map(template => (
            <div key={template.id}>
              <strong>{template.name}</strong>
              <span>{LABEL_TEMPLATE_SIZE_LABELS[template.size]} - {template.widthMm}x{template.heightMm} mm - {template.columns}x{template.rows}</span>
              <p>{template.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card label-print-job-panel">
        <div className="section-header compact">
          <div>
            <h3>Print Jobs</h3>
            <p className="muted">Kim yazdirdi, kac adet yazdirdi ve ne zaman bilgisi burada izlenir.</p>
          </div>
          <span className="status-pill success">{formatNumber(printJobs.reduce((total, job) => total + job.quantity, 0))} toplam adet</span>
        </div>
        <div className="label-print-job-list">
          {printJobs.slice(0, 8).map(job => (
            <div key={job.id}>
              <strong>{job.labelNos.join(', ')}</strong>
              <span>{job.actorName} - {formatDateTime(job.printedAt)} - {formatNumber(job.quantity)} adet</span>
              <p>{job.message}</p>
            </div>
          ))}
          {printJobs.length === 0 && <div><strong>Print job yok</strong><span>Henüz etiket yazdirilmadi.</span></div>}
        </div>
      </section>
    </div>
  )
}
