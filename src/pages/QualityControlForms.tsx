import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import { QualityFormPrintService } from '../quality-forms/quality-form-print.service'
import {
  QUALITY_CRITERION_STATUSES,
  QUALITY_FORM_STATUSES,
  QUALITY_FORM_STATUS_LABELS,
  QUALITY_FORM_TYPES,
  QUALITY_FORM_TYPE_LABELS,
  QUALITY_INSPECTION_RESULTS,
  QUALITY_INSPECTION_RESULT_LABELS,
  QUALITY_STATUS_LABELS,
  QualityFormService
} from '../quality-forms/quality-form.service'
import type {
  QualityCriterionKey,
  QualityCriterionStatus,
  QualityForm,
  QualityFormCreateInput,
  QualityFormFilters,
  QualityFormStatus,
  QualityHistoryAction,
  QualityInspectionResult
} from '../quality-forms/quality-form.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateFormState = {
  lotId: string
  formType: QualityFormCreateInput['formType']
  inspectionDate: string
  inspector: string
  result: QualityInspectionResult
  description: string
  inspectionStatuses: Partial<Record<QualityCriterionKey, QualityCriterionStatus>>
  inspectionNotes: Partial<Record<QualityCriterionKey, string>>
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
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

const getStatusClass = (status: QualityFormStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'CONDITIONAL_APPROVED' || status === 'INSPECTING') return 'warning-pill'
  if(status === 'REJECTED' || status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getResultClass = (result: QualityInspectionResult) => {
  if(result === 'PASS') return 'success'
  if(result === 'CONDITIONAL') return 'warning-pill'
  return 'danger-pill'
}

const getHistoryLabel = (action: QualityHistoryAction) => {
  const labels: Record<QualityHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    INSPECTION_STARTED: 'Kontrol Ediliyor',
    APPROVED: 'Onaylandi',
    CONDITIONAL_APPROVED: 'Sartli Onay',
    REJECTED: 'Reddedildi',
    CANCELLED: 'Iptal',
    REVISED: 'Revizyon',
    PRINTED: 'Yazdirildi',
    PDF: 'PDF',
    EXCEL: 'Excel',
    VALIDATION: 'Validation'
  }

  return labels[action] || action
}

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name || record.id])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getDefaultCriterionStatus = (
  result: QualityInspectionResult
): QualityCriterionStatus => {
  if(result === 'FAIL') return 'FAIL'
  if(result === 'CONDITIONAL') return 'WARNING'
  return 'PASS'
}

const createInitialForm = (
  inspector: string,
  lotId = ''
): CreateFormState => ({
  lotId,
  formType: 'GOODS_RECEIPT_CONTROL',
  inspectionDate: getTodayKey(),
  inspector,
  result: 'PASS',
  description: '',
  inspectionStatuses: {},
  inspectionNotes: {}
})

const getActionDisabled = (
  record: QualityForm | null,
  status: QualityFormStatus
) => {
  if(!record) return true
  if(record.status === 'CANCELLED') return true
  return record.status === status
}

export default function QualityControlForms({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const templates = React.useMemo(() => QualityFormService.templates(), [])
  const lotOptions = React.useMemo(() => sourceData.inventoryLots
    .filter(lot => lot.status !== 'DISPOSED' && lot.status !== 'RETURNED')
    .slice(0, 120), [sourceData])
  const [records, setRecords] = React.useState<QualityForm[]>(() => QualityFormService.list(sourceData))
  const [filters, setFilters] = React.useState<QualityFormFilters>(() => QualityFormService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [form, setForm] = React.useState<CreateFormState>(() => createInitialForm(userName, lotOptions[0]?.id || ''))
  const [message, setMessage] = React.useState<Message | null>(null)
  const filteredRecords = React.useMemo(() => QualityFormService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => QualityFormService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const selectedTemplate = React.useMemo(() => templates.find(template => template.formType === form.formType) || templates[0], [form.formType, templates])
  const branchOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.branchId, name: record.branchName }))), [records])
  const warehouseOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.warehouseId, name: record.warehouseName }))), [records])
  const productOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.productId || record.stockItemId, name: record.productName || record.stockItemName }))), [records])
  const lotFilterOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.lotId, name: record.lotNo }))), [records])
  const supplierOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.supplierId, name: record.supplierName }))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    if(form.lotId || lotOptions.length === 0) return
    setForm(prev => ({ ...prev, lotId: lotOptions[0]?.id || '' }))
  }, [form.lotId, lotOptions])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = QualityFormService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof QualityFormFilters>(key: TKey, value: QualityFormFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateFormState>(key: TKey, value: CreateFormState[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateCriterionStatus = (criterionKey: QualityCriterionKey, status: QualityCriterionStatus) => {
    setForm(prev => ({
      ...prev,
      inspectionStatuses: {
        ...prev.inspectionStatuses,
        [criterionKey]: status
      }
    }))
  }

  const updateCriterionNote = (criterionKey: QualityCriterionKey, note: string) => {
    setForm(prev => ({
      ...prev,
      inspectionNotes: {
        ...prev.inspectionNotes,
        [criterionKey]: note
      }
    }))
  }

  const changeResult = (result: QualityInspectionResult) => {
    const defaultStatus = getDefaultCriterionStatus(result)
    setForm(prev => ({
      ...prev,
      result,
      inspectionStatuses: Object.fromEntries((selectedTemplate?.criteria || []).map(criterion => [
        criterion.criterionKey,
        prev.inspectionStatuses[criterion.criterionKey] || defaultStatus
      ]))
    }))
  }

  const createQualityForm = () => {
    try{
      const record = QualityFormService.addFromLot({
        lotId: form.lotId,
        formType: form.formType,
        inspectionDate: form.inspectionDate,
        inspector: form.inspector,
        result: form.result,
        description: form.description,
        inspectionStatuses: form.inspectionStatuses,
        inspectionNotes: form.inspectionNotes
      }, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(userName, form.lotId))
      setMessage({ type: 'success', text: `${record.formNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Kalite formu olusturulamadi.' })
    }
  }

  const changeStatus = (status: QualityFormStatus) => {
    if(!selectedRecord) return
    try{
      const record = QualityFormService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.formNo} ${QUALITY_FORM_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<QualityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') QualityFormPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') QualityFormPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['quality'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = QualityFormService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.formNo} Excel export edildi.`
          : `${record.formNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="quality-form-page">
      <div className="page-header">
        <div>
          <h2>Kalite Formlari</h2>
          <p className="muted">Goods Receipt, Production, Lot, HACCP, Sample, Witness Sample ve Waste verilerini standart kalite formlarinda birlestirir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid quality-form-metric-grid">
        <div className="metric-card">
          <span>Bugunku Kontroller</span>
          <strong>{formatNumber(statistics.todayControls)}</strong>
          <small>Bugun kontrol edilen formlar</small>
        </div>
        <div className="metric-card">
          <span>Basarili</span>
          <strong>{formatNumber(statistics.passed)}</strong>
          <small>PASS orani {formatPercent(statistics.passRate)}</small>
        </div>
        <div className="metric-card warning">
          <span>Sartli Onay</span>
          <strong>{formatNumber(statistics.conditionalApproved)}</strong>
          <small>Takip gerektiren formlar</small>
        </div>
        <div className="metric-card danger">
          <span>Basarisiz</span>
          <strong>{formatNumber(statistics.failed)}</strong>
          <small>FAIL orani {formatPercent(statistics.failRate)}</small>
        </div>
        <div className="metric-card">
          <span>Bekleyen</span>
          <strong>{formatNumber(statistics.pending)}</strong>
          <small>Taslak / kontrol edilen</small>
        </div>
      </div>

      <section className="card quality-form-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Form</h3>
            <p className="muted">Lot kaynakli read-model kalite formu olusturur; stok hareketi veya resmi dokuman uretmez.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.lotId} onClick={createQualityForm}>Form Olustur</button>
        </div>
        <div className="quality-form-create-grid">
          <label className="form-field">
            <span>Lot</span>
            <select value={form.lotId} onChange={event => updateForm('lotId', event.target.value)}>
              {lotOptions.length === 0 && <option value="">Uygun lot yok</option>}
              {lotOptions.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Form Turu</span>
            <select value={form.formType} onChange={event => updateForm('formType', event.target.value as CreateFormState['formType'])}>
              {QUALITY_FORM_TYPES.map(type => <option key={type} value={type}>{QUALITY_FORM_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Kontrol Tarihi</span>
            <input type="date" value={form.inspectionDate} onChange={event => updateForm('inspectionDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kontrol Personeli</span>
            <input value={form.inspector} onChange={event => updateForm('inspector', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Sonuc</span>
            <select value={form.result} onChange={event => changeResult(event.target.value as QualityInspectionResult)}>
              {QUALITY_INSPECTION_RESULTS.map(result => <option key={result} value={result}>{QUALITY_INSPECTION_RESULT_LABELS[result]}</option>)}
            </select>
          </label>
          <label className="form-field quality-form-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Kontrol notu" />
          </label>
        </div>
        <div className="quality-form-checklist">
          {(selectedTemplate?.criteria || []).map(criterion => (
            <div className="quality-form-checklist-item" key={criterion.id}>
              <div>
                <strong>{criterion.label}</strong>
                <span>{criterion.limit}</span>
                {criterion.required && <small>Zorunlu</small>}
              </div>
              <label>
                <span>Durum</span>
                <select value={form.inspectionStatuses[criterion.criterionKey] || getDefaultCriterionStatus(form.result)} onChange={event => updateCriterionStatus(criterion.criterionKey, event.target.value as QualityCriterionStatus)}>
                  {QUALITY_CRITERION_STATUSES.map(status => <option key={status} value={status}>{QUALITY_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="quality-form-item-notes">
                <span>Not</span>
                <input value={form.inspectionNotes[criterion.criterionKey] || ''} onChange={event => updateCriterionNote(criterion.criterionKey, event.target.value)} />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="card quality-form-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} kalite formu listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(QualityFormService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="quality-form-filter-grid">
          <label className="form-field">
            <span>Form Turu</span>
            <select value={filters.formType} onChange={event => updateFilter('formType', event.target.value as QualityFormFilters['formType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {QUALITY_FORM_TYPES.map(type => <option key={type} value={type}>{QUALITY_FORM_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as QualityFormFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {QUALITY_FORM_STATUSES.map(status => <option key={status} value={status}>{QUALITY_FORM_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sonuc</span>
            <select value={filters.result} onChange={event => updateFilter('result', event.target.value as QualityFormFilters['result'])}>
              <option value={ALL_FILTER}>Tum Sonuclar</option>
              {QUALITY_INSPECTION_RESULTS.map(result => <option key={result} value={result}>{QUALITY_INSPECTION_RESULT_LABELS[result]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Urun</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Urunler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Lotlar</option>
              {lotFilterOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Supplier</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Supplier</option>
              {supplierOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Subeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Depolar</option>
              {warehouseOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Form No, urun, lot, batch" />
          </label>
        </div>
      </section>

      <div className="quality-form-chart-grid">
        <BarChartCard title="Urun Bazli" rows={statistics.productRows} />
        <BarChartCard title="Supplier Bazli" rows={statistics.supplierRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Form Turu Bazli" rows={statistics.typeRows} />
        <BarChartCard title="Sonuc Bazli" rows={statistics.resultRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout quality-form-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Quality Form Listesi</h3>
              <p className="muted">Standart ve versiyonlu kalite formlari read-model olarak izlenir.</p>
            </div>
            <span className="status-pill">{formatNumber(templates.length)} template</span>
          </div>
          <div className="table-wrap quality-form-table-wrap">
            <table className="data-table quality-form-table">
              <thead>
                <tr>
                  <th>Form No</th>
                  <th>Tarih</th>
                  <th>Form Turu</th>
                  <th>Urun / Lot</th>
                  <th>Supplier</th>
                  <th>Skor</th>
                  <th>Sonuc</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun kalite formu bulunamadi.</td></tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    aria-selected={selectedRecord?.id === record.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(record.id)
                    }}
                  >
                    <td data-label="Form No"><strong>{record.formNo}</strong><span>Rev {record.revisionNo}</span></td>
                    <td data-label="Tarih">{formatDate(record.inspectionDate)}</td>
                    <td data-label="Form Turu"><strong>{QUALITY_FORM_TYPE_LABELS[record.formType]}</strong><span>{record.sourceType}</span></td>
                    <td data-label="Urun / Lot"><strong>{record.productName || record.stockItemName}</strong><span>{record.lotNo || record.batchNo}</span></td>
                    <td data-label="Supplier">{record.supplierName || '-'}</td>
                    <td data-label="Skor">{formatNumber(record.score, 1)}</td>
                    <td data-label="Sonuc"><span className={`status-pill ${getResultClass(record.result)}`}>{QUALITY_INSPECTION_RESULT_LABELS[record.result]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{QUALITY_FORM_STATUS_LABELS[record.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side quality-form-side">
          {selectedRecord ? (
            <QualityFormDetailPanel
              record={selectedRecord}
              onStatusChange={changeStatus}
              onOutput={recordOutput}
            />
          ) : (
            <section className="card quality-form-detail-card">
              <h3>Form Detayi</h3>
              <p className="muted">Detay gormek icin bir kalite formu secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function QualityFormDetailPanel({
  onOutput,
  onStatusChange,
  record
}: {
  onOutput: (action: Extract<QualityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: QualityFormStatus) => void
  record: QualityForm
}){
  return (
    <>
      <section className="card quality-form-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.formNo}</h3>
            <p className="muted">{QUALITY_FORM_TYPE_LABELS[record.formType]} / {record.templateVersion}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>{QUALITY_FORM_STATUS_LABELS[record.status]}</span>
        </div>

        <div className="quality-form-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="quality-form-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(record, 'INSPECTING')} onClick={() => onStatusChange('INSPECTING')}>Kontrol</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'APPROVED')} onClick={() => onStatusChange('APPROVED')}>Onayla</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'CONDITIONAL_APPROVED')} onClick={() => onStatusChange('CONDITIONAL_APPROVED')}>Sartli</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'REJECTED')} onClick={() => onStatusChange('REJECTED')}>Reddet</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="quality-form-detail-grid">
          <div><span>Urun</span><strong>{record.productName || record.stockItemName}</strong></div>
          <div><span>Lot / Batch</span><strong>{record.lotNo || '-'} / {record.batchNo || '-'}</strong></div>
          <div><span>Supplier</span><strong>{record.supplierName || '-'}</strong></div>
          <div><span>Depo / Sube</span><strong>{record.warehouseName} / {record.branchName}</strong></div>
          <div><span>Uretim Emri</span><strong>{record.productionOrderNo || '-'}</strong></div>
          <div><span>Goods Receipt</span><strong>{record.goodsReceiptNo || record.goodsReceiptId || '-'}</strong></div>
          <div><span>Kontrol Personeli</span><strong>{record.inspector}</strong></div>
          <div><span>Skor / Sonuc</span><strong>{formatNumber(record.score, 1)} / {record.result}</strong></div>
        </div>
        <p className="quality-form-notes">{record.description || '-'}</p>
      </section>

      <section className="card quality-form-detail-card">
        <h3>Inspection</h3>
        <div className="quality-form-result-list">
          {record.inspections.map(inspection => (
            <div className="quality-form-result-row" key={inspection.id}>
              <div>
                <strong>{inspection.label}</strong>
                <span>{inspection.unit || '-'}</span>
              </div>
              <span className={`status-pill ${inspection.status === 'PASS' ? 'success' : inspection.status === 'FAIL' ? 'danger-pill' : 'warning-pill'}`}>{QUALITY_STATUS_LABELS[inspection.status]}</span>
              <div>
                <strong>{inspection.value || '-'}</strong>
                <span>{inspection.result}</span>
              </div>
              {inspection.notes && <p>{inspection.notes}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="card quality-form-detail-card">
        <h3>Entegrasyonlar</h3>
        <div className="quality-form-detail-grid">
          <div><span>Recipe</span><strong>{record.recipeName || '-'}</strong></div>
          <div><span>HACCP</span><strong>{record.haccpReference || '-'}</strong></div>
          <div><span>Sample</span><strong>{record.sampleNo || '-'}</strong></div>
          <div><span>Witness Sample</span><strong>{record.witnessNo || '-'}</strong></div>
        </div>
      </section>

      <section className="card quality-form-detail-card">
        <h3>Decision</h3>
        <div className="quality-form-result-list">
          <div className="quality-form-result-row">
            <div>
              <strong>{record.decision.decisionType}</strong>
              <span>{record.decision.decidedBy} / {formatDateTime(record.decision.decidedAt)}</span>
            </div>
            <span className={`status-pill ${getResultClass(record.decision.result)}`}>{record.decision.result}</span>
            <p>{record.decision.summary}</p>
          </div>
        </div>
      </section>

      <section className="card quality-form-detail-card">
        <h3>History</h3>
        <div className="quality-form-result-list">
          {[...record.history].reverse().map(history => (
            <div className="quality-form-result-row" key={history.id}>
              <div>
                <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
                <span>{formatDateTime(history.createdAt)} / Rev {history.revisionNo}</span>
              </div>
              <p>{history.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kirilim</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayit bulunamadi.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{formatNumber(series.points.length)} period</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.map(point => (
          <div className="kpi-line-point" key={point.dateKey}>
            <span style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%`, background: series.color }} />
            <strong>{formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
