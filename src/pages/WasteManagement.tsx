import React from 'react'
import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import type { BarcodeGenerateInput } from '../barcode-engine/barcode.types'
import BarcodePreviewModal from '../components/BarcodePreviewModal'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'
import { WastePrintService } from '../waste-management/waste-print.service'
import {
  WASTE_REASONS,
  WASTE_REASON_LABELS,
  WASTE_STATUSES,
  WASTE_STATUS_LABELS,
  WASTE_TYPES,
  WASTE_TYPE_LABELS,
  WasteService
} from '../waste-management/waste.service'
import type {
  WasteCreateInput,
  WasteFilters,
  WasteHistoryAction,
  WasteRecord,
  WasteStatus
} from '../waste-management/waste.types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateFormState = {
  lotId: string
  wasteType: WasteCreateInput['wasteType']
  wasteReason: WasteCreateInput['wasteReason']
  quantity: string
  date: string
  description: string
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

const getStatusClass = (status: WasteStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'UNDER_REVIEW') return 'warning-pill'
  if(status === 'REJECTED' || status === 'CANCELLED') return 'danger-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: WasteHistoryAction) => {
  const labels: Record<WasteHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    UNDER_REVIEW: 'Incelemede',
    APPROVED: 'Onaylandi',
    REJECTED: 'Reddedildi',
    CANCELLED: 'Iptal',
    PRINTED: 'Yazdirildi',
    PDF: 'PDF',
    EXCEL: 'Excel',
    VALIDATION: 'Validation'
  }

  return labels[action] || action
}

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createInitialForm = (
  lotId = ''
): CreateFormState => ({
  lotId,
  wasteType: 'PRODUCTION',
  wasteReason: 'PRODUCTION_ERROR',
  quantity: '1',
  date: getTodayKey(),
  description: ''
})

const getActionDisabled = (
  record: WasteRecord | null,
  status: WasteStatus
) => {
  if(!record) return true
  if(record.status === 'CANCELLED') return true
  if(record.status === status) return true
  return false
}

export default function WasteManagement({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const lotOptions = React.useMemo(() => sourceData.inventoryLots
    .filter(lot => lot.status !== 'DISPOSED' && lot.status !== 'BLOCKED')
    .slice(0, 80), [sourceData])
  const [records, setRecords] = React.useState<WasteRecord[]>(() => WasteService.list(sourceData))
  const [filters, setFilters] = React.useState<WasteFilters>(() => WasteService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [form, setForm] = React.useState<CreateFormState>(() => createInitialForm(lotOptions[0]?.id || ''))
  const [message, setMessage] = React.useState<Message | null>(null)
  const [barcodePreviewRequest, setBarcodePreviewRequest] = React.useState<BarcodeGenerateInput | null>(null)
  const filteredRecords = React.useMemo(() => WasteService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => WasteService.statistics(records, sourceData), [records, sourceData])
  const analysis = React.useMemo(() => WasteService.analysis(records, sourceData), [records, sourceData])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const branchOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.branchId, name: record.branchName }))), [records])
  const warehouseOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.warehouseId, name: record.warehouseName }))), [records])
  const productOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.productId || record.stockItemId, name: record.productName || record.stockItemName }))), [records])
  const recordLotOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.lotId, name: record.lotNo }))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    if(form.lotId || lotOptions.length === 0) return
    setForm(prev => ({ ...prev, lotId: lotOptions[0]?.id || '' }))
  }, [form.lotId, lotOptions])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = WasteService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof WasteFilters>(key: TKey, value: WasteFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateFormState>(key: TKey, value: CreateFormState[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createWasteRecord = () => {
    try{
      const quantity = Number(form.quantity)
      const record = WasteService.addFromLot({
        lotId: form.lotId,
        wasteType: form.wasteType,
        wasteReason: form.wasteReason,
        quantity,
        date: form.date,
        description: form.description
      }, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(form.lotId))
      setMessage({ type: 'success', text: `${record.wasteNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fire kaydi olusturulamadi.' })
    }
  }

  const changeStatus = (status: WasteStatus) => {
    if(!selectedRecord) return
    try{
      const record = WasteService.updateStatus(selectedRecord.id, status, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.wasteNo} ${WASTE_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<WasteHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') WastePrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') WastePrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
          moduleKeys: ['waste'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = WasteService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.wasteNo} Excel export edildi.`
          : `${record.wasteNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  const exportFilteredWasteRows = () => {
    ExcelIntegrationService.exportModuleView({
      moduleKey: 'waste',
      rows: filteredRecords,
      userName,
      fileNamePrefix: 'fire-listesi',
      filterText: filters.search,
      sortLabel: 'Mevcut liste sirasi',
      columns: [
        { key: 'wasteNo', header: 'Fire No', value: record => record.wasteNo },
        { key: 'date', header: 'Tarih', value: record => record.date },
        { key: 'wasteType', header: 'Tur', value: record => WASTE_TYPE_LABELS[record.wasteType] },
        { key: 'wasteReason', header: 'Neden', value: record => WASTE_REASON_LABELS[record.wasteReason] },
        { key: 'productName', header: 'Urun', value: record => record.productName || record.stockItemName },
        { key: 'lotNo', header: 'Lot', value: record => record.lotNo || record.batchNo || '-' },
        { key: 'warehouseName', header: 'Depo', value: record => record.warehouseName || '-' },
        { key: 'quantity', header: 'Miktar', type: 'number', value: record => record.quantity },
        { key: 'unit', header: 'Birim', value: record => record.unit },
        { key: 'totalCost', header: 'Maliyet', value: record => formatCurrency(record.totalCost, record.currency) },
        { key: 'status', header: 'Durum', value: record => WASTE_STATUS_LABELS[record.status] }
      ]
    })
    setMessage({ type: 'success', text: `${formatNumber(filteredRecords.length)} fire kaydi Excel'e aktarildi.` })
  }

  return (
    <div className="fire-analysis-page waste-management-page">
      <div className="page-header">
        <div>
          <h2>Fire Yonetimi</h2>
          <p className="muted">Uretim, depo, soklama, paketleme, sevkiyat, mal kabul, kalite ve HACCP kaynakli fireleri read-model olarak yonetir.</p>
        </div>
        <div className="waste-create-actions">
          <select value={form.lotId} onChange={event => updateForm('lotId', event.target.value)}>
            {lotOptions.length === 0 && <option value="">Uygun lot yok</option>}
            {lotOptions.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
          </select>
          <select value={form.wasteType} onChange={event => updateForm('wasteType', event.target.value as CreateFormState['wasteType'])}>
            {WASTE_TYPES.map(type => <option key={type} value={type}>{WASTE_TYPE_LABELS[type]}</option>)}
          </select>
          <select value={form.wasteReason} onChange={event => updateForm('wasteReason', event.target.value as CreateFormState['wasteReason'])}>
            {WASTE_REASONS.map(reason => <option key={reason} value={reason}>{WASTE_REASON_LABELS[reason]}</option>)}
          </select>
          <input type="number" min="0" step="0.001" value={form.quantity} onChange={event => updateForm('quantity', event.target.value)} />
          <input type="date" value={form.date} onChange={event => updateForm('date', event.target.value)} />
          <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Aciklama" />
          <button className="primary-button" type="button" disabled={!form.lotId} onClick={createWasteRecord}>Fire Kaydi</button>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid fire-card-grid">
        <div className="metric-card fire-card">
          <span>Bugunku Fire</span>
          <strong>{formatNumber(statistics.todayWaste)}</strong>
          <small>Bugun kaydedilen fire</small>
        </div>
        <div className="metric-card fire-card">
          <span>Toplam Fire</span>
          <strong>{formatNumber(statistics.totalWaste)}</strong>
          <small>{formatQuantity(statistics.totalQuantity)}</small>
        </div>
        <div className="metric-card fire-card warning">
          <span>Toplam Fire Maliyeti</span>
          <strong>{formatCurrency(statistics.totalWasteCost)}</strong>
          <small>Cost Engine fire girdisi</small>
        </div>
        <div className="metric-card fire-card">
          <span>En Cok Fire Veren Urun</span>
          <strong>{statistics.topProductName}</strong>
          <small>{formatNumber(statistics.productCount)} urun</small>
        </div>
        <div className="metric-card fire-card">
          <span>En Cok Fire Veren Depo</span>
          <strong>{statistics.topWarehouseName}</strong>
          <small>Fire orani {formatPercent(statistics.wasteRate)}</small>
        </div>
      </div>

      <section className="card fire-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} fire kaydi listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(WasteService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="fire-filter-grid waste-filter-grid">
          <label className="form-field">
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as WasteFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {WASTE_STATUSES.map(status => <option key={status} value={status}>{WASTE_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Fire Turu</span>
            <select value={filters.wasteType} onChange={event => updateFilter('wasteType', event.target.value as WasteFilters['wasteType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {WASTE_TYPES.map(type => <option key={type} value={type}>{WASTE_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Fire Nedeni</span>
            <select value={filters.wasteReason} onChange={event => updateFilter('wasteReason', event.target.value as WasteFilters['wasteReason'])}>
              <option value={ALL_FILTER}>Tum Nedenler</option>
              {WASTE_REASONS.map(reason => <option key={reason} value={reason}>{WASTE_REASON_LABELS[reason]}</option>)}
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
              {recordLotOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Fire No, urun, lot, batch" />
          </label>
        </div>
      </section>

      <div className="fire-insight-grid">
        <BarChartCard title="Urun Bazli Fire" rows={statistics.productRows} />
        <BarChartCard title="Kategori Bazli" rows={statistics.categoryRows} />
        <BarChartCard title="Depo Bazli" rows={statistics.warehouseRows} />
        <BarChartCard title="Fire Nedeni Bazli" rows={statistics.reasonRows} />
        <LineChartCard series={statistics.monthlyTrend} />
        <BarChartCard title="Fire Maliyet Analizi" rows={analysis.costRows} currency />
      </div>

      <div className="product-layout fire-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Fire Listesi</h3>
              <p className="muted">Fire kayitlari read-model olarak yonetilir; stok transaction veya muhasebe fisi yazilmaz.</p>
            </div>
            <div className="waste-list-actions">
              <button className="btn" type="button" onClick={exportFilteredWasteRows}>Excel'e Aktar</button>
              <span className="status-pill">{formatNumber(analysis.recommendations.length)} DSS sinyali</span>
            </div>
          </div>
          <div className="table-wrap fire-table-wrap">
            <table className="data-table fire-table waste-table">
              <thead>
                <tr>
                  <th>Fire No</th>
                  <th>Tarih</th>
                  <th>Tur / Neden</th>
                  <th>Urun / Lot</th>
                  <th>Depo</th>
                  <th>Miktar</th>
                  <th>Maliyet</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun fire kaydi bulunamadi.</td></tr>
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
                    <td data-label="Fire No"><strong>{record.wasteNo}</strong><span>{record.sourceType}</span></td>
                    <td data-label="Tarih">{formatDate(record.date)}</td>
                    <td data-label="Tur / Neden"><strong>{WASTE_TYPE_LABELS[record.wasteType]}</strong><span>{WASTE_REASON_LABELS[record.wasteReason]}</span></td>
                    <td data-label="Urun / Lot"><strong>{record.productName || record.stockItemName}</strong><span>{record.lotNo || record.batchNo}</span></td>
                    <td data-label="Depo">{record.warehouseName || '-'}</td>
                    <td data-label="Miktar">{formatQuantity(record.quantity, record.unit)}</td>
                    <td data-label="Maliyet">{formatCurrency(record.totalCost, record.currency)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record.status)}`}>{WASTE_STATUS_LABELS[record.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side fire-side">
          {selectedRecord ? (
            <WasteDetailPanel
              record={selectedRecord}
              analysis={analysis}
              onPreviewBarcode={record => setBarcodePreviewRequest(BarcodeIntegrationService.fromWasteRecord(record))}
              onStatusChange={changeStatus}
              onOutput={recordOutput}
            />
          ) : (
            <section className="card fire-detail-card">
              <h3>Fire Detayi</h3>
              <p className="muted">Detay gormek icin bir fire kaydi secin.</p>
            </section>
          )}
        </aside>
      </div>
      <BarcodePreviewModal
        request={barcodePreviewRequest}
        bulkRequests={filteredRecords.map(record => BarcodeIntegrationService.fromWasteRecord(record))}
        userName={userName}
        onClose={() => setBarcodePreviewRequest(null)}
      />
    </div>
  )
}

function WasteDetailPanel({
  analysis,
  onOutput,
  onPreviewBarcode,
  onStatusChange,
  record
}: {
  analysis: ReturnType<typeof WasteService.analysis>
  onOutput: (action: Extract<WasteHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onPreviewBarcode: (record: WasteRecord) => void
  onStatusChange: (status: WasteStatus) => void
  record: WasteRecord
}){
  return (
    <>
      <section className="card fire-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.wasteNo}</h3>
            <p className="muted">{WASTE_TYPE_LABELS[record.wasteType]} / {WASTE_REASON_LABELS[record.wasteReason]}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record.status)}`}>{WASTE_STATUS_LABELS[record.status]}</span>
        </div>

        <div className="waste-output-actions">
          <button className="btn" type="button" onClick={() => onPreviewBarcode(record)}>Barkod Önizle</button>
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="waste-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(record, 'UNDER_REVIEW')} onClick={() => onStatusChange('UNDER_REVIEW')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'APPROVED')} onClick={() => onStatusChange('APPROVED')}>Onayla</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'REJECTED')} onClick={() => onStatusChange('REJECTED')}>Reddet</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="fire-detail-grid">
          <div><span>Urun</span><strong>{record.productName || record.stockItemName}</strong></div>
          <div><span>Lot / Batch</span><strong>{record.lotNo || '-'} / {record.batchNo || '-'}</strong></div>
          <div><span>Miktar</span><strong>{formatQuantity(record.quantity, record.unit)}</strong></div>
          <div><span>Maliyet</span><strong>{formatCurrency(record.totalCost, record.currency)}</strong></div>
          <div><span>Depo</span><strong>{record.warehouseName}</strong></div>
          <div><span>Sube</span><strong>{record.branchName}</strong></div>
          <div><span>Uretim Emri</span><strong>{record.productionOrderNo || '-'}</strong></div>
          <div><span>Recipe</span><strong>{record.recipeName || '-'}</strong></div>
        </div>
        <p className="shipment-notes">{record.description || '-'}</p>
      </section>

      <section className="card fire-detail-card">
        <h3>Kalite ve HACCP</h3>
        <div className="fire-impact-list">
          <div><strong>Kalite Karari</strong><span>{record.qualityDecision || '-'}</span></div>
          <div><strong>HACCP Referansi</strong><span>{record.haccpReference || '-'}</span></div>
          <div><strong>Duzeltici Faaliyet</strong><span>{record.correctiveAction || '-'}</span></div>
          <div><strong>Fotograf Notu</strong><span>{record.photoNote || 'Hazirlik alani'}</span></div>
        </div>
      </section>

      <section className="card fire-detail-card">
        <h3>Analizler</h3>
        <div className="fire-impact-list">
          {analysis.recommendations.map(item => (
            <div key={item}><strong>Decision Support</strong><span>{item}</span></div>
          ))}
        </div>
      </section>

      <section className="card fire-detail-card">
        <h3>History</h3>
        <div className="fire-impact-list">
          {[...record.history].reverse().map(history => (
            <div key={history.id}>
              <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
              <span>{formatDateTime(history.createdAt)}</span>
              <p>{history.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function BarChartCard({ currency = false, rows, title }: { currency?: boolean; rows: BarChartRow[]; title: string }){
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
            <em>{currency ? formatCurrency(row.value) : row.formattedValue}</em>
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
