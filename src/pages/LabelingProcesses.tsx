import React from 'react'
import {
  LABELING_PRODUCTS,
  LABELING_STATUSES,
  loadLabelingRecords,
  saveLabelingRecords
} from '../labeling/labeling.mock'
import type {
  LabelingRecord,
  LabelingStatus
} from '../labeling/labeling.types'

type StatusFilter = LabelingStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type LabelingFormState = {
  labelNo: string
  productName: string
  lotNo: string
  barcode: string
  productionDate: string
  expiryDate: string
  operatorName: string
  description: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const pad = (value: number) => String(value).padStart(2, '0')

const toDateKey = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
)

const todayKey = () => toDateKey(new Date())

const addDaysKey = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return value

  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const getStatusClass = (status: LabelingStatus) => {
  if(status === 'Yazdırıldı') return 'success'
  if(status === 'Bekliyor') return 'warning-pill'
  return 'danger-pill'
}

const getNextLabelNo = (records: LabelingRecord[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.labelNo.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `LB-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (records: LabelingRecord[]): LabelingFormState => {
  const productionDate = todayKey()

  return {
    labelNo: getNextLabelNo(records),
    productName: LABELING_PRODUCTS[0],
    lotNo: '',
    barcode: '',
    productionDate,
    expiryDate: addDaysKey(productionDate, 7),
    operatorName: '',
    description: ''
  }
}

const createFormFromRecord = (record: LabelingRecord): LabelingFormState => ({
  labelNo: record.labelNo,
  productName: record.productName,
  lotNo: record.lotNo,
  barcode: record.barcode,
  productionDate: record.productionDate,
  expiryDate: record.expiryDate,
  operatorName: record.operatorName,
  description: record.description
})

const validateForm = (
  form: LabelingFormState,
  records: LabelingRecord[],
  editingRecordId: string
) => {
  if(!form.labelNo.trim()) return 'Etiket no zorunludur.'
  if(!form.productName.trim()) return 'Ürün zorunludur.'
  if(!form.lotNo.trim()) return 'Lot No zorunludur.'
  if(!form.barcode.trim()) return 'Barkod zorunludur.'
  if(!form.productionDate.trim()) return 'Üretim tarihi zorunludur.'
  if(!form.expiryDate.trim()) return 'Son tüketim tarihi zorunludur.'
  if(form.expiryDate < form.productionDate) return 'SKT, üretim tarihinden önce olamaz.'

  const normalizedLabelNo = form.labelNo.trim().toLocaleLowerCase('tr-TR')
  const duplicateLabelNo = records.some(record => (
    record.id !== editingRecordId
    && record.labelNo.trim().toLocaleLowerCase('tr-TR') === normalizedLabelNo
  ))
  if(duplicateLabelNo) return 'Bu etiket no zaten kullanılıyor.'

  const normalizedBarcode = form.barcode.trim().toLocaleLowerCase('tr-TR')
  const duplicateBarcode = records.some(record => (
    record.id !== editingRecordId
    && record.barcode.trim().toLocaleLowerCase('tr-TR') === normalizedBarcode
  ))
  if(duplicateBarcode) return 'Bu barkod zaten kullanılıyor.'

  return ''
}

export default function LabelingProcesses(){
  const [records, setRecords] = React.useState<LabelingRecord[]>(() => loadLabelingRecords())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedRecordId, setSelectedRecordId] = React.useState('lbl_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<LabelingFormState>(() => createInitialForm(loadLabelingRecords()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitRecords = React.useCallback((updater: React.SetStateAction<LabelingRecord[]>) => {
    setRecords(prev => {
      const nextRecords = typeof updater === 'function'
        ? (updater as (current: LabelingRecord[]) => LabelingRecord[])(prev)
        : updater
      saveLabelingRecords(nextRecords)
      return nextRecords
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('lbl_toast'),
      text,
      tone
    })
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return records.filter(record => {
      const matchesSearch = !normalizedSearch
        || record.labelNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.lotNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.barcode.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [records, search, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form') return
    if(visibleRecords.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(visibleRecords[0]?.id || '')
  }, [panelMode, selectedRecordId, visibleRecords])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedRecord = records.find(record => record.id === selectedRecordId) || null
  const isEditing = Boolean(editingRecordId)
  const totalRecords = records.length
  const waitingRecords = records.filter(record => record.status === 'Bekliyor').length
  const printedRecords = records.filter(record => record.status === 'Yazdırıldı').length
  const cancelledRecords = records.filter(record => record.status === 'İptal').length

  const startNewRecord = () => {
    setPanelMode('form')
    setEditingRecordId('')
    setForm(createInitialForm(records))
    setFormError('')
    setToast(null)
  }

  const startEditRecord = (record: LabelingRecord) => {
    setSelectedRecordId(record.id)
    setPanelMode('form')
    setEditingRecordId(record.id)
    setForm(createFormFromRecord(record))
    setFormError('')
    setToast(null)
  }

  const cancelForm = () => {
    setPanelMode('summary')
    setEditingRecordId('')
    setForm(createInitialForm(records))
    setFormError('')
  }

  const updateForm = <TKey extends keyof LabelingFormState>(
    key: TKey,
    value: LabelingFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteRecord = (record: LabelingRecord) => {
    if(!window.confirm('Bu etiket kaydını silmek istediğinize emin misiniz?')) return

    const nextRecords = records.filter(item => item.id !== record.id)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
    setPanelMode('summary')

    if(editingRecordId === record.id){
      setEditingRecordId('')
      setForm(createInitialForm(nextRecords))
      setFormError('')
    }

    showToast('Etiket kaydı silindi.')
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form, records, editingRecordId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const normalizedLabelNo = form.labelNo.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingRecord = records.find(record => record.id === editingRecordId)
      if(!existingRecord){
        setFormError('Düzenlenecek etiket kaydı bulunamadı.')
        return
      }

      const updatedRecord: LabelingRecord = {
        ...existingRecord,
        labelNo: normalizedLabelNo,
        productName: form.productName.trim(),
        lotNo: form.lotNo.trim(),
        barcode: form.barcode.trim(),
        productionDate: form.productionDate,
        expiryDate: form.expiryDate,
        operatorName: form.operatorName.trim(),
        description: form.description.trim(),
        updatedAt: now
      }

      commitRecords(prev => prev.map(record => record.id === updatedRecord.id ? updatedRecord : record))
      setSelectedRecordId(updatedRecord.id)
      setPanelMode('summary')
      setEditingRecordId('')
      setForm(createInitialForm(records))
      setFormError('')
      showToast('Etiket kaydı güncellendi.')
      return
    }

    const newRecord: LabelingRecord = {
      id: createId('lbl'),
      labelNo: normalizedLabelNo,
      productName: form.productName.trim(),
      lotNo: form.lotNo.trim(),
      barcode: form.barcode.trim(),
      productionDate: form.productionDate,
      expiryDate: form.expiryDate,
      status: 'Bekliyor',
      operatorName: form.operatorName.trim(),
      description: form.description.trim(),
      linkedPackaging: '',
      linkedShipment: '',
      createdAt: now,
      updatedAt: now
    }

    commitRecords(prev => [newRecord, ...prev])
    setSelectedRecordId(newRecord.id)
    setPanelMode('summary')
    setForm(createInitialForm([newRecord, ...records]))
    setFormError('')
    showToast('Etiket kaydı oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Etiket Düzenle' : 'Yeni Etiket'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form labeling-form" onSubmit={submitForm}>
        <div className="form-field">
          <label>Etiket No</label>
          <input value={form.labelNo} readOnly />
        </div>

        <div className="form-field">
          <label>Ürün</label>
          <select value={form.productName} onChange={event => updateForm('productName', event.target.value)}>
            {LABELING_PRODUCTS.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Lot No</label>
            <input value={form.lotNo} onChange={event => updateForm('lotNo', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Barkod</label>
            <input value={form.barcode} onChange={event => updateForm('barcode', event.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Üretim Tarihi</label>
            <input
              type="date"
              value={form.productionDate}
              onChange={event => updateForm('productionDate', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Son Tüketim Tarihi</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={event => updateForm('expiryDate', event.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Yazdıran Operatör</label>
          <input value={form.operatorName} onChange={event => updateForm('operatorName', event.target.value)} />
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Etiket veya sevkiyat öncesi kontrol notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Etiket Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedRecord){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir etiket kaydı seçin.</div>
        </section>
      )
    }

    return (
      <section className="card labeling-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedRecord.labelNo}</h3>
            <p className="muted">{selectedRecord.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{selectedRecord.status}</span>
        </div>

        <div className="labeling-summary-grid">
          <div><span>Etiket No</span><strong>{selectedRecord.labelNo}</strong></div>
          <div><span>Ürün</span><strong>{selectedRecord.productName}</strong></div>
          <div><span>Lot No</span><strong>{selectedRecord.lotNo}</strong></div>
          <div><span>Barkod</span><strong>{selectedRecord.barcode}</strong></div>
          <div><span>Üretim Tarihi</span><strong>{formatDate(selectedRecord.productionDate)}</strong></div>
          <div><span>Son Tüketim Tarihi (SKT)</span><strong>{formatDate(selectedRecord.expiryDate)}</strong></div>
          <div><span>Durum</span><strong>{selectedRecord.status}</strong></div>
          <div><span>Yazdıran Operatör</span><strong>{selectedRecord.operatorName || '-'}</strong></div>
          <div><span>Açıklama</span><strong>{selectedRecord.description || '-'}</strong></div>
        </div>

        <div className="labeling-linked-list">
          <span className="small-label">Bağlı Paketleme</span>
          <div>
            <strong>{selectedRecord.linkedPackaging || 'Henüz bağlı değil.'}</strong>
            <small>Paketleme bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı Sevkiyat</span>
          <div>
            <strong>{selectedRecord.linkedShipment || 'Henüz bağlı değil.'}</strong>
            <small>Sevkiyat bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="labeling-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditRecord(selectedRecord)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteRecord(selectedRecord)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="labeling-page">
      <div className="page-title">
        <div>
          <h2>Etiketleme</h2>
          <p className="muted">Paketlenmiş ürünlerin etiket, lot ve barkod süreçlerini sevkiyat öncesi takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`labeling-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Etiket</span>
          <strong>{totalRecords}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bekleyen</span>
          <strong>{waitingRecords}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Yazdırıldı</span>
          <strong>{printedRecords}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>İptal</span>
          <strong>{cancelledRecords}</strong>
        </div>
      </div>

      <div className="product-layout labeling-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Etiket Listesi</h3>
              <p className="muted">{visibleRecords.length} etiket kaydı gösteriliyor.</p>
            </div>
            <div className="labeling-toolbar">
              <button className="btn primary" type="button" onClick={startNewRecord}>Yeni Etiket</button>
              <input
                type="search"
                placeholder="Etiket no, ürün, lot no veya barkod ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {LABELING_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table labeling-table">
              <colgroup>
                <col className="lbl-col-no" />
                <col className="lbl-col-product" />
                <col className="lbl-col-lot" />
                <col className="lbl-col-barcode" />
                <col className="lbl-col-production" />
                <col className="lbl-col-expiry" />
                <col className="lbl-col-status" />
                <col className="lbl-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Etiket No</th>
                  <th>Ürün</th>
                  <th>Lot No</th>
                  <th>Barkod</th>
                  <th>Üretim Tarihi</th>
                  <th>SKT</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="labeling-empty-list">
                        <strong>Henüz etiket kaydı bulunmuyor.</strong>
                        <span>İlk etiket kaydını oluşturmak için "Yeni Etiket" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewRecord}>Yeni Etiket</button>
                      </div>
                    </td>
                  </tr>
                )}
                {records.length > 0 && visibleRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun etiket kaydı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr
                    key={record.id}
                    className={record.id === selectedRecordId ? 'selected-row' : ''}
                    onClick={() => {
                      setSelectedRecordId(record.id)
                      setPanelMode('summary')
                    }}
                  >
                    <td><strong>{record.labelNo}</strong></td>
                    <td>
                      <strong>{record.productName}</strong>
                      {record.description && <div className="muted small-text">{record.description}</div>}
                    </td>
                    <td>{record.lotNo}</td>
                    <td>{record.barcode}</td>
                    <td>{formatDate(record.productionDate)}</td>
                    <td>{formatDate(record.expiryDate)}</td>
                    <td><span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span></td>
                    <td className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          startEditRecord(record)
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          deleteRecord(record)
                        }}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side labeling-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
