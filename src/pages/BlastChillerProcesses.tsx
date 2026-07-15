import React from 'react'
import {
  BLAST_CHILLER_PRODUCTS,
  BLAST_CHILLER_STATUSES,
  BLAST_CHILLER_UNITS,
  loadBlastChillerProcesses,
  saveBlastChillerProcesses
} from '../blast-chiller/blast-chiller.mock'
import type {
  BlastChillerProcess,
  BlastChillerStatus,
  BlastChillerUnit
} from '../blast-chiller/blast-chiller.types'

type StatusFilter = BlastChillerStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type BlastChillerFormState = {
  processNo: string
  productName: string
  batchNo: string
  quantity: string
  unit: BlastChillerUnit
  startedAt: string
  estimatedMinutes: string
  description: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const pad = (value: number) => String(value).padStart(2, '0')

const toDateTimeInputValue = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const createNowInputValue = () => toDateTimeInputValue(new Date().toISOString())

const parseDateTimeInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const addMinutes = (value: string, minutes: number) => (
  new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString()
)

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDuration = (minutes: number) => {
  if(minutes <= 0) return '-'
  if(minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours} sa ${remainingMinutes} dk` : `${hours} sa`
}

const formatQuantity = (process: BlastChillerProcess) => `${formatNumber(process.quantity)} ${process.unit}`

const getStatusClass = (status: BlastChillerStatus) => {
  if(status === 'Tamamlandı') return 'success'
  if(status === 'Şoklanıyor') return 'info-pill'
  if(status === 'Bekliyor') return 'warning-pill'
  return 'danger-pill'
}

const getNextProcessNo = (processes: BlastChillerProcess[]) => {
  const maxNo = processes.reduce((max, process) => {
    const match = process.processNo.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `BC-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (processes: BlastChillerProcess[]): BlastChillerFormState => ({
  processNo: getNextProcessNo(processes),
  productName: BLAST_CHILLER_PRODUCTS[0],
  batchNo: '',
  quantity: '1',
  unit: 'kg',
  startedAt: createNowInputValue(),
  estimatedMinutes: '90',
  description: ''
})

const createFormFromProcess = (process: BlastChillerProcess): BlastChillerFormState => ({
  processNo: process.processNo,
  productName: process.productName,
  batchNo: process.batchNo,
  quantity: String(process.quantity),
  unit: process.unit,
  startedAt: toDateTimeInputValue(process.startedAt),
  estimatedMinutes: String(process.estimatedMinutes),
  description: process.description
})

const validateForm = (
  form: BlastChillerFormState,
  processes: BlastChillerProcess[],
  editingProcessId: string
) => {
  if(!form.processNo.trim()) return 'Şoklama no zorunludur.'
  if(!form.productName.trim()) return 'Ürün zorunludur.'
  if(!form.batchNo.trim()) return 'Parti no zorunludur.'
  if(!form.startedAt.trim()) return 'Başlangıç tarihi zorunludur.'
  if(!parseDateTimeInput(form.startedAt)) return 'Geçerli bir başlangıç tarihi girilmelidir.'

  const quantity = Number(form.quantity)
  if(!form.quantity.trim()) return 'Miktar boş bırakılamaz.'
  if(!Number.isFinite(quantity)) return 'Miktar için geçerli bir sayı girilmelidir.'
  if(quantity <= 0) return 'Miktar 0 veya negatif olamaz.'

  const estimatedMinutes = Number(form.estimatedMinutes)
  if(!form.estimatedMinutes.trim()) return 'Tahmini süre boş bırakılamaz.'
  if(!Number.isFinite(estimatedMinutes)) return 'Tahmini süre için geçerli bir sayı girilmelidir.'
  if(estimatedMinutes <= 0) return 'Tahmini süre 0 veya negatif olamaz.'

  const normalizedProcessNo = form.processNo.trim().toLocaleLowerCase('tr-TR')
  const duplicateProcessNo = processes.some(process => (
    process.id !== editingProcessId
    && process.processNo.trim().toLocaleLowerCase('tr-TR') === normalizedProcessNo
  ))
  if(duplicateProcessNo) return 'Bu şoklama no zaten kullanılıyor.'

  return ''
}

export default function BlastChillerProcesses(){
  const [processes, setProcesses] = React.useState<BlastChillerProcess[]>(() => loadBlastChillerProcesses())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedProcessId, setSelectedProcessId] = React.useState('bc_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingProcessId, setEditingProcessId] = React.useState('')
  const [form, setForm] = React.useState<BlastChillerFormState>(() => createInitialForm(loadBlastChillerProcesses()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitProcesses = React.useCallback((updater: React.SetStateAction<BlastChillerProcess[]>) => {
    setProcesses(prev => {
      const nextProcesses = typeof updater === 'function'
        ? (updater as (current: BlastChillerProcess[]) => BlastChillerProcess[])(prev)
        : updater
      saveBlastChillerProcesses(nextProcesses)
      return nextProcesses
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('bc_toast'),
      text,
      tone
    })
  }, [])

  const visibleProcesses = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return processes.filter(process => {
      const matchesSearch = !normalizedSearch
        || process.processNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.batchNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || process.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [processes, search, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form') return
    if(visibleProcesses.some(process => process.id === selectedProcessId)) return
    setSelectedProcessId(visibleProcesses[0]?.id || '')
  }, [panelMode, selectedProcessId, visibleProcesses])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedProcess = processes.find(process => process.id === selectedProcessId) || null
  const isEditing = Boolean(editingProcessId)
  const totalProcesses = processes.length
  const waitingProcesses = processes.filter(process => process.status === 'Bekliyor').length
  const chillingProcesses = processes.filter(process => process.status === 'Şoklanıyor').length
  const completedProcesses = processes.filter(process => process.status === 'Tamamlandı').length

  const startNewProcess = () => {
    setPanelMode('form')
    setEditingProcessId('')
    setForm(createInitialForm(processes))
    setFormError('')
    setToast(null)
  }

  const startEditProcess = (process: BlastChillerProcess) => {
    setSelectedProcessId(process.id)
    setPanelMode('form')
    setEditingProcessId(process.id)
    setForm(createFormFromProcess(process))
    setFormError('')
    setToast(null)
  }

  const cancelForm = () => {
    setPanelMode('summary')
    setEditingProcessId('')
    setForm(createInitialForm(processes))
    setFormError('')
  }

  const updateForm = <TKey extends keyof BlastChillerFormState>(
    key: TKey,
    value: BlastChillerFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteProcess = (process: BlastChillerProcess) => {
    if(!window.confirm('Bu şoklama kaydını silmek istediğinize emin misiniz?')) return

    const nextProcesses = processes.filter(item => item.id !== process.id)
    commitProcesses(nextProcesses)
    setSelectedProcessId(nextProcesses[0]?.id || '')
    setPanelMode('summary')

    if(editingProcessId === process.id){
      setEditingProcessId('')
      setForm(createInitialForm(nextProcesses))
      setFormError('')
    }

    showToast('Şoklama kaydı silindi.')
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form, processes, editingProcessId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const quantity = Number(form.quantity)
    const estimatedMinutes = Number(form.estimatedMinutes)
    const startedAt = parseDateTimeInput(form.startedAt)
    const estimatedEndAt = addMinutes(startedAt, estimatedMinutes)
    const normalizedProcessNo = form.processNo.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingProcess = processes.find(process => process.id === editingProcessId)
      if(!existingProcess){
        setFormError('Düzenlenecek şoklama kaydı bulunamadı.')
        return
      }

      const updatedProcess: BlastChillerProcess = {
        ...existingProcess,
        processNo: normalizedProcessNo,
        productName: form.productName.trim(),
        batchNo: form.batchNo.trim(),
        quantity,
        unit: form.unit,
        startedAt,
        estimatedEndAt,
        estimatedMinutes,
        description: form.description.trim(),
        updatedAt: now
      }

      commitProcesses(prev => prev.map(process => process.id === updatedProcess.id ? updatedProcess : process))
      setSelectedProcessId(updatedProcess.id)
      setPanelMode('summary')
      setEditingProcessId('')
      setForm(createInitialForm(processes))
      setFormError('')
      showToast('Şoklama kaydı güncellendi.')
      return
    }

    const newProcess: BlastChillerProcess = {
      id: createId('bc'),
      processNo: normalizedProcessNo,
      productName: form.productName.trim(),
      batchNo: form.batchNo.trim(),
      quantity,
      unit: form.unit,
      startedAt,
      estimatedEndAt,
      estimatedMinutes,
      actualMinutes: 0,
      status: 'Bekliyor',
      description: form.description.trim(),
      linkedFinalProduct: '',
      linkedPackaging: '',
      createdAt: now,
      updatedAt: now
    }

    commitProcesses(prev => [newProcess, ...prev])
    setSelectedProcessId(newProcess.id)
    setPanelMode('summary')
    setForm(createInitialForm([newProcess, ...processes]))
    setFormError('')
    showToast('Şoklama kaydı oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Şoklama Düzenle' : 'Yeni Şoklama'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form blast-chiller-form" onSubmit={submitForm}>
        <div className="form-field">
          <label>Şoklama No</label>
          <input value={form.processNo} readOnly />
        </div>

        <div className="form-field">
          <label>Ürün</label>
          <select value={form.productName} onChange={event => updateForm('productName', event.target.value)}>
            {BLAST_CHILLER_PRODUCTS.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Parti No</label>
            <input value={form.batchNo} onChange={event => updateForm('batchNo', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Başlangıç Tarihi</label>
            <input
              type="datetime-local"
              value={form.startedAt}
              onChange={event => updateForm('startedAt', event.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Miktar</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.quantity}
              onChange={event => updateForm('quantity', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Birim</label>
            <select value={form.unit} onChange={event => updateForm('unit', event.target.value as BlastChillerUnit)}>
              {BLAST_CHILLER_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Tahmini Süre (dk)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.estimatedMinutes}
            onChange={event => updateForm('estimatedMinutes', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Şoklama süreci veya ürün notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Şoklama Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedProcess){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir şoklama kaydı seçin.</div>
        </section>
      )
    }

    return (
      <section className="card blast-chiller-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedProcess.processNo}</h3>
            <p className="muted">{selectedProcess.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedProcess.status)}`}>{selectedProcess.status}</span>
        </div>

        <div className="blast-chiller-summary-grid">
          <div><span>Şoklama No</span><strong>{selectedProcess.processNo}</strong></div>
          <div><span>Ürün</span><strong>{selectedProcess.productName}</strong></div>
          <div><span>Parti No</span><strong>{selectedProcess.batchNo}</strong></div>
          <div><span>Miktar</span><strong>{formatQuantity(selectedProcess)}</strong></div>
          <div><span>Birim</span><strong>{selectedProcess.unit}</strong></div>
          <div><span>Başlangıç Tarihi</span><strong>{formatDateTime(selectedProcess.startedAt)}</strong></div>
          <div><span>Tahmini Bitiş</span><strong>{formatDateTime(selectedProcess.estimatedEndAt)}</strong></div>
          <div><span>Tahmini Süre</span><strong>{formatDuration(selectedProcess.estimatedMinutes)}</strong></div>
          <div><span>Gerçek Süre</span><strong>{formatDuration(selectedProcess.actualMinutes)}</strong></div>
          <div><span>Durum</span><strong>{selectedProcess.status}</strong></div>
          <div><span>Açıklama</span><strong>{selectedProcess.description || '-'}</strong></div>
        </div>

        <div className="blast-chiller-linked-list">
          <span className="small-label">Bağlı Son Ürün</span>
          <div>
            <strong>{selectedProcess.linkedFinalProduct || 'Henüz bağlı değil.'}</strong>
            <small>Son ürün bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı Paketleme</span>
          <div>
            <strong>{selectedProcess.linkedPackaging || 'Henüz bağlı değil.'}</strong>
            <small>Paketleme bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="blast-chiller-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditProcess(selectedProcess)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteProcess(selectedProcess)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="blast-chiller-page">
      <div className="page-title">
        <div>
          <h2>Şoklama Süreçleri</h2>
          <p className="muted">Pişmiş ürünlerin paketleme öncesi hızlı soğutma süreçlerini takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`blast-chiller-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Şoklama</span>
          <strong>{totalProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bekleyen</span>
          <strong>{waitingProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Şoklanıyor</span>
          <strong>{chillingProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Tamamlanan</span>
          <strong>{completedProcesses}</strong>
        </div>
      </div>

      <div className="product-layout blast-chiller-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Şoklama Listesi</h3>
              <p className="muted">{visibleProcesses.length} şoklama kaydı gösteriliyor.</p>
            </div>
            <div className="blast-chiller-toolbar">
              <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Şoklama</button>
              <input
                type="search"
                placeholder="Şoklama no, ürün veya parti no ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {BLAST_CHILLER_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table blast-chiller-table">
              <colgroup>
                <col className="bc-col-no" />
                <col className="bc-col-product" />
                <col className="bc-col-batch" />
                <col className="bc-col-start" />
                <col className="bc-col-end" />
                <col className="bc-col-duration" />
                <col className="bc-col-status" />
                <col className="bc-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Şoklama No</th>
                  <th>Ürün</th>
                  <th>Parti No</th>
                  <th>Başlangıç</th>
                  <th>Tahmini Bitiş</th>
                  <th>Süre</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="blast-chiller-empty-list">
                        <strong>Henüz şoklama kaydı bulunmuyor.</strong>
                        <span>İlk şoklama kaydını oluşturmak için "Yeni Şoklama" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Şoklama</button>
                      </div>
                    </td>
                  </tr>
                )}
                {processes.length > 0 && visibleProcesses.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun şoklama kaydı bulunamadı.</td></tr>
                )}
                {visibleProcesses.map(process => (
                  <tr
                    key={process.id}
                    className={process.id === selectedProcessId ? 'selected-row' : ''}
                    onClick={() => {
                      setSelectedProcessId(process.id)
                      setPanelMode('summary')
                    }}
                  >
                    <td><strong>{process.processNo}</strong></td>
                    <td>
                      <strong>{process.productName}</strong>
                      {process.description && <div className="muted small-text">{process.description}</div>}
                    </td>
                    <td>{process.batchNo}</td>
                    <td>{formatDateTime(process.startedAt)}</td>
                    <td>{formatDateTime(process.estimatedEndAt)}</td>
                    <td>{formatDuration(process.estimatedMinutes)}</td>
                    <td><span className={`status-pill ${getStatusClass(process.status)}`}>{process.status}</span></td>
                    <td className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          startEditProcess(process)
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          deleteProcess(process)
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

        <aside className="product-side blast-chiller-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
