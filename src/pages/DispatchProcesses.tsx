import React from 'react'
import {
  DISPATCH_CUSTOMERS,
  DISPATCH_STATUSES,
  loadDispatchProcesses,
  saveDispatchProcesses
} from '../dispatch/dispatch.mock'
import type {
  DispatchProcess,
  DispatchStatus
} from '../dispatch/dispatch.types'

type StatusFilter = DispatchStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type DispatchFormState = {
  dispatchNo: string
  customerName: string
  vehicle: string
  driverName: string
  departureDate: string
  estimatedDeliveryDate: string
  totalProducts: string
  totalQuantity: string
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

const addHoursInputValue = (value: string, hours: number) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value

  date.setHours(date.getHours() + hours)
  return toDateTimeInputValue(date.toISOString())
}

const parseDateTimeInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

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

const getStatusClass = (status: DispatchStatus) => {
  if(status === 'Teslim Edildi') return 'success'
  if(status === 'Yolda') return 'info-pill'
  if(status === 'Hazırlanıyor') return 'warning-pill'
  return 'danger-pill'
}

const getNextDispatchNo = (processes: DispatchProcess[]) => {
  const maxNo = processes.reduce((max, process) => {
    const match = process.dispatchNo.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `DS-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (processes: DispatchProcess[]): DispatchFormState => {
  const departureDate = createNowInputValue()

  return {
    dispatchNo: getNextDispatchNo(processes),
    customerName: DISPATCH_CUSTOMERS[0],
    vehicle: '',
    driverName: '',
    departureDate,
    estimatedDeliveryDate: addHoursInputValue(departureDate, 2),
    totalProducts: '1',
    totalQuantity: '1',
    description: ''
  }
}

const createFormFromProcess = (process: DispatchProcess): DispatchFormState => ({
  dispatchNo: process.dispatchNo,
  customerName: process.customerName,
  vehicle: process.vehicle,
  driverName: process.driverName,
  departureDate: toDateTimeInputValue(process.departureDate),
  estimatedDeliveryDate: toDateTimeInputValue(process.estimatedDeliveryDate),
  totalProducts: String(process.totalProducts),
  totalQuantity: String(process.totalQuantity),
  description: process.description
})

const validateForm = (
  form: DispatchFormState,
  processes: DispatchProcess[],
  editingProcessId: string
) => {
  if(!form.dispatchNo.trim()) return 'Sevkiyat no zorunludur.'
  if(!form.customerName.trim()) return 'Müşteri / Şube zorunludur.'
  if(!form.vehicle.trim()) return 'Araç zorunludur.'
  if(!form.driverName.trim()) return 'Şoför zorunludur.'
  if(!form.departureDate.trim()) return 'Çıkış tarihi zorunludur.'
  if(!parseDateTimeInput(form.departureDate)) return 'Geçerli bir çıkış tarihi girilmelidir.'
  if(!form.estimatedDeliveryDate.trim()) return 'Tahmini teslim tarihi zorunludur.'
  if(!parseDateTimeInput(form.estimatedDeliveryDate)) return 'Geçerli bir tahmini teslim tarihi girilmelidir.'
  if(parseDateTimeInput(form.estimatedDeliveryDate) < parseDateTimeInput(form.departureDate)){
    return 'Tahmini teslim tarihi, çıkış tarihinden önce olamaz.'
  }

  const totalProducts = Number(form.totalProducts)
  if(!form.totalProducts.trim()) return 'Toplam ürün boş bırakılamaz.'
  if(!Number.isFinite(totalProducts)) return 'Toplam ürün için geçerli bir sayı girilmelidir.'
  if(totalProducts <= 0) return 'Toplam ürün 0 veya negatif olamaz.'

  const totalQuantity = Number(form.totalQuantity)
  if(!form.totalQuantity.trim()) return 'Toplam miktar boş bırakılamaz.'
  if(!Number.isFinite(totalQuantity)) return 'Toplam miktar için geçerli bir sayı girilmelidir.'
  if(totalQuantity <= 0) return 'Toplam miktar 0 veya negatif olamaz.'

  const normalizedDispatchNo = form.dispatchNo.trim().toLocaleLowerCase('tr-TR')
  const duplicateDispatchNo = processes.some(process => (
    process.id !== editingProcessId
    && process.dispatchNo.trim().toLocaleLowerCase('tr-TR') === normalizedDispatchNo
  ))
  if(duplicateDispatchNo) return 'Bu sevkiyat no zaten kullanılıyor.'

  return ''
}

const getTableDeliveryDate = (process: DispatchProcess) => (
  process.actualDeliveryDate || process.estimatedDeliveryDate
)

export default function DispatchProcesses(){
  const [processes, setProcesses] = React.useState<DispatchProcess[]>(() => loadDispatchProcesses())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedProcessId, setSelectedProcessId] = React.useState('dsp_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingProcessId, setEditingProcessId] = React.useState('')
  const [form, setForm] = React.useState<DispatchFormState>(() => createInitialForm(loadDispatchProcesses()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitProcesses = React.useCallback((updater: React.SetStateAction<DispatchProcess[]>) => {
    setProcesses(prev => {
      const nextProcesses = typeof updater === 'function'
        ? (updater as (current: DispatchProcess[]) => DispatchProcess[])(prev)
        : updater
      saveDispatchProcesses(nextProcesses)
      return nextProcesses
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('dsp_toast'),
      text,
      tone
    })
  }, [])

  const visibleProcesses = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return processes.filter(process => {
      const matchesSearch = !normalizedSearch
        || process.dispatchNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.customerName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.vehicle.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.driverName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
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
  const preparingProcesses = processes.filter(process => process.status === 'Hazırlanıyor').length
  const onRoadProcesses = processes.filter(process => process.status === 'Yolda').length
  const deliveredProcesses = processes.filter(process => process.status === 'Teslim Edildi').length

  const startNewProcess = () => {
    setPanelMode('form')
    setEditingProcessId('')
    setForm(createInitialForm(processes))
    setFormError('')
    setToast(null)
  }

  const startEditProcess = (process: DispatchProcess) => {
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

  const updateForm = <TKey extends keyof DispatchFormState>(
    key: TKey,
    value: DispatchFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteProcess = (process: DispatchProcess) => {
    if(!window.confirm('Bu sevkiyat kaydını silmek istediğinize emin misiniz?')) return

    const nextProcesses = processes.filter(item => item.id !== process.id)
    commitProcesses(nextProcesses)
    setSelectedProcessId(nextProcesses[0]?.id || '')
    setPanelMode('summary')

    if(editingProcessId === process.id){
      setEditingProcessId('')
      setForm(createInitialForm(nextProcesses))
      setFormError('')
    }

    showToast('Sevkiyat kaydı silindi.')
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form, processes, editingProcessId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const totalProducts = Number(form.totalProducts)
    const totalQuantity = Number(form.totalQuantity)
    const departureDate = parseDateTimeInput(form.departureDate)
    const estimatedDeliveryDate = parseDateTimeInput(form.estimatedDeliveryDate)
    const normalizedDispatchNo = form.dispatchNo.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingProcess = processes.find(process => process.id === editingProcessId)
      if(!existingProcess){
        setFormError('Düzenlenecek sevkiyat kaydı bulunamadı.')
        return
      }

      const updatedProcess: DispatchProcess = {
        ...existingProcess,
        dispatchNo: normalizedDispatchNo,
        customerName: form.customerName.trim(),
        vehicle: form.vehicle.trim(),
        driverName: form.driverName.trim(),
        departureDate,
        estimatedDeliveryDate,
        totalProducts,
        totalQuantity,
        description: form.description.trim(),
        updatedAt: now
      }

      commitProcesses(prev => prev.map(process => process.id === updatedProcess.id ? updatedProcess : process))
      setSelectedProcessId(updatedProcess.id)
      setPanelMode('summary')
      setEditingProcessId('')
      setForm(createInitialForm(processes))
      setFormError('')
      showToast('Sevkiyat kaydı güncellendi.')
      return
    }

    const newProcess: DispatchProcess = {
      id: createId('dsp'),
      dispatchNo: normalizedDispatchNo,
      customerName: form.customerName.trim(),
      vehicle: form.vehicle.trim(),
      driverName: form.driverName.trim(),
      departureDate,
      estimatedDeliveryDate,
      actualDeliveryDate: '',
      totalProducts,
      totalQuantity,
      status: 'Hazırlanıyor',
      description: form.description.trim(),
      linkedLabeling: '',
      linkedWaybill: '',
      createdAt: now,
      updatedAt: now
    }

    commitProcesses(prev => [newProcess, ...prev])
    setSelectedProcessId(newProcess.id)
    setPanelMode('summary')
    setForm(createInitialForm([newProcess, ...processes]))
    setFormError('')
    showToast('Sevkiyat kaydı oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Sevkiyat Düzenle' : 'Yeni Sevkiyat'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form dispatch-form" onSubmit={submitForm}>
        <div className="form-field">
          <label>Sevkiyat No</label>
          <input value={form.dispatchNo} readOnly />
        </div>

        <div className="form-field">
          <label>Müşteri / Şube</label>
          <input
            list="dispatch-customer-options"
            value={form.customerName}
            onChange={event => updateForm('customerName', event.target.value)}
          />
          <datalist id="dispatch-customer-options">
            {DISPATCH_CUSTOMERS.map(customer => (
              <option key={customer} value={customer} />
            ))}
          </datalist>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Araç</label>
            <input value={form.vehicle} onChange={event => updateForm('vehicle', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Şoför</label>
            <input value={form.driverName} onChange={event => updateForm('driverName', event.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Çıkış Tarihi</label>
            <input
              type="datetime-local"
              value={form.departureDate}
              onChange={event => updateForm('departureDate', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Tahmini Teslim Tarihi</label>
            <input
              type="datetime-local"
              value={form.estimatedDeliveryDate}
              onChange={event => updateForm('estimatedDeliveryDate', event.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Toplam Ürün</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.totalProducts}
              onChange={event => updateForm('totalProducts', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Toplam Miktar</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.totalQuantity}
              onChange={event => updateForm('totalQuantity', event.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Sevkiyat, yükleme veya teslim notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Sevkiyat Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedProcess){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir sevkiyat kaydı seçin.</div>
        </section>
      )
    }

    return (
      <section className="card dispatch-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedProcess.dispatchNo}</h3>
            <p className="muted">{selectedProcess.customerName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedProcess.status)}`}>{selectedProcess.status}</span>
        </div>

        <div className="dispatch-summary-grid">
          <div><span>Sevkiyat No</span><strong>{selectedProcess.dispatchNo}</strong></div>
          <div><span>Müşteri / Şube</span><strong>{selectedProcess.customerName}</strong></div>
          <div><span>Araç</span><strong>{selectedProcess.vehicle}</strong></div>
          <div><span>Şoför</span><strong>{selectedProcess.driverName}</strong></div>
          <div><span>Çıkış Tarihi</span><strong>{formatDateTime(selectedProcess.departureDate)}</strong></div>
          <div><span>Tahmini Teslim</span><strong>{formatDateTime(selectedProcess.estimatedDeliveryDate)}</strong></div>
          <div><span>Gerçek Teslim</span><strong>{formatDateTime(selectedProcess.actualDeliveryDate)}</strong></div>
          <div><span>Toplam Ürün</span><strong>{formatNumber(selectedProcess.totalProducts)}</strong></div>
          <div><span>Toplam Miktar</span><strong>{formatNumber(selectedProcess.totalQuantity)}</strong></div>
          <div><span>Durum</span><strong>{selectedProcess.status}</strong></div>
          <div><span>Açıklama</span><strong>{selectedProcess.description || '-'}</strong></div>
        </div>

        <div className="dispatch-linked-list">
          <span className="small-label">Bağlı Etiketleme</span>
          <div>
            <strong>{selectedProcess.linkedLabeling || 'Henüz bağlı değil.'}</strong>
            <small>Etiketleme bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı İrsaliye</span>
          <div>
            <strong>{selectedProcess.linkedWaybill || 'Henüz bağlı değil.'}</strong>
            <small>İrsaliye bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="dispatch-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditProcess(selectedProcess)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteProcess(selectedProcess)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="dispatch-page">
      <div className="page-title">
        <div>
          <h2>Sevkiyat</h2>
          <p className="muted">Etiketlenmiş ürünlerin müşterilere ve şubelere çıkış, teslim ve taşıma durumlarını takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`dispatch-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Sevkiyat</span>
          <strong>{totalProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Hazırlanıyor</span>
          <strong>{preparingProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Yolda</span>
          <strong>{onRoadProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Teslim Edildi</span>
          <strong>{deliveredProcesses}</strong>
        </div>
      </div>

      <div className="product-layout dispatch-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Sevkiyat Listesi</h3>
              <p className="muted">{visibleProcesses.length} sevkiyat kaydı gösteriliyor.</p>
            </div>
            <div className="dispatch-toolbar">
              <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Sevkiyat</button>
              <input
                type="search"
                placeholder="Sevkiyat no, müşteri, araç veya şoför ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {DISPATCH_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table dispatch-table">
              <colgroup>
                <col className="dsp-col-no" />
                <col className="dsp-col-customer" />
                <col className="dsp-col-vehicle" />
                <col className="dsp-col-departure" />
                <col className="dsp-col-delivery" />
                <col className="dsp-col-products" />
                <col className="dsp-col-status" />
                <col className="dsp-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sevkiyat No</th>
                  <th>Müşteri / Şube</th>
                  <th>Araç</th>
                  <th>Çıkış Tarihi</th>
                  <th>Teslim Tarihi</th>
                  <th>Toplam Ürün</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="dispatch-empty-list">
                        <strong>Henüz sevkiyat kaydı bulunmuyor.</strong>
                        <span>İlk sevkiyat kaydını oluşturmak için "Yeni Sevkiyat" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Sevkiyat</button>
                      </div>
                    </td>
                  </tr>
                )}
                {processes.length > 0 && visibleProcesses.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun sevkiyat kaydı bulunamadı.</td></tr>
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
                    <td><strong>{process.dispatchNo}</strong></td>
                    <td>
                      <strong>{process.customerName}</strong>
                      <div className="muted small-text">{process.driverName}</div>
                    </td>
                    <td>{process.vehicle}</td>
                    <td>{formatDateTime(process.departureDate)}</td>
                    <td>{formatDateTime(getTableDeliveryDate(process))}</td>
                    <td>{formatNumber(process.totalProducts)}</td>
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

        <aside className="product-side dispatch-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
