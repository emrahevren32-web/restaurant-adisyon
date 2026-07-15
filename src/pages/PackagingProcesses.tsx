import React from 'react'
import {
  PACKAGE_TYPES,
  PACKAGING_PRODUCTS,
  PACKAGING_STATUSES,
  PACKAGING_UNITS,
  loadPackagingProcesses,
  savePackagingProcesses
} from '../packaging/packaging.mock'
import type {
  PackageType,
  PackagingProcess,
  PackagingStatus,
  PackagingUnit
} from '../packaging/packaging.types'

type StatusFilter = PackagingStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type PackagingFormState = {
  packagingNo: string
  productName: string
  packageType: PackageType
  quantity: string
  unit: PackagingUnit
  startedAt: string
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

const formatQuantity = (process: PackagingProcess) => `${formatNumber(process.quantity)} ${process.unit}`

const getStatusClass = (status: PackagingStatus) => {
  if(status === 'Tamamlandı') return 'success'
  if(status === 'Paketleniyor') return 'info-pill'
  if(status === 'Bekliyor') return 'warning-pill'
  return 'danger-pill'
}

const getNextPackagingNo = (processes: PackagingProcess[]) => {
  const maxNo = processes.reduce((max, process) => {
    const match = process.packagingNo.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PK-${String(maxNo + 1).padStart(3, '0')}`
}

const createInitialForm = (processes: PackagingProcess[]): PackagingFormState => ({
  packagingNo: getNextPackagingNo(processes),
  productName: PACKAGING_PRODUCTS[0],
  packageType: PACKAGE_TYPES[0],
  quantity: '1',
  unit: 'kg',
  startedAt: createNowInputValue(),
  operatorName: '',
  description: ''
})

const createFormFromProcess = (process: PackagingProcess): PackagingFormState => ({
  packagingNo: process.packagingNo,
  productName: process.productName,
  packageType: process.packageType,
  quantity: String(process.quantity),
  unit: process.unit,
  startedAt: toDateTimeInputValue(process.startedAt),
  operatorName: process.operatorName,
  description: process.description
})

const validateForm = (
  form: PackagingFormState,
  processes: PackagingProcess[],
  editingProcessId: string
) => {
  if(!form.packagingNo.trim()) return 'Paketleme no zorunludur.'
  if(!form.productName.trim()) return 'Ürün zorunludur.'
  if(!form.packageType.trim()) return 'Paket tipi zorunludur.'
  if(!form.operatorName.trim()) return 'Operatör zorunludur.'
  if(!form.startedAt.trim()) return 'Başlangıç tarihi zorunludur.'
  if(!parseDateTimeInput(form.startedAt)) return 'Geçerli bir başlangıç tarihi girilmelidir.'

  const quantity = Number(form.quantity)
  if(!form.quantity.trim()) return 'Miktar boş bırakılamaz.'
  if(!Number.isFinite(quantity)) return 'Miktar için geçerli bir sayı girilmelidir.'
  if(quantity <= 0) return 'Miktar 0 veya negatif olamaz.'

  const normalizedPackagingNo = form.packagingNo.trim().toLocaleLowerCase('tr-TR')
  const duplicatePackagingNo = processes.some(process => (
    process.id !== editingProcessId
    && process.packagingNo.trim().toLocaleLowerCase('tr-TR') === normalizedPackagingNo
  ))
  if(duplicatePackagingNo) return 'Bu paketleme no zaten kullanılıyor.'

  return ''
}

export default function PackagingProcesses(){
  const [processes, setProcesses] = React.useState<PackagingProcess[]>(() => loadPackagingProcesses())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedProcessId, setSelectedProcessId] = React.useState('pkg_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingProcessId, setEditingProcessId] = React.useState('')
  const [form, setForm] = React.useState<PackagingFormState>(() => createInitialForm(loadPackagingProcesses()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitProcesses = React.useCallback((updater: React.SetStateAction<PackagingProcess[]>) => {
    setProcesses(prev => {
      const nextProcesses = typeof updater === 'function'
        ? (updater as (current: PackagingProcess[]) => PackagingProcess[])(prev)
        : updater
      savePackagingProcesses(nextProcesses)
      return nextProcesses
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('pkg_toast'),
      text,
      tone
    })
  }, [])

  const visibleProcesses = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return processes.filter(process => {
      const matchesSearch = !normalizedSearch
        || process.packagingNo.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || process.packageType.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
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
  const packagingProcesses = processes.filter(process => process.status === 'Paketleniyor').length
  const completedProcesses = processes.filter(process => process.status === 'Tamamlandı').length

  const startNewProcess = () => {
    setPanelMode('form')
    setEditingProcessId('')
    setForm(createInitialForm(processes))
    setFormError('')
    setToast(null)
  }

  const startEditProcess = (process: PackagingProcess) => {
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

  const updateForm = <TKey extends keyof PackagingFormState>(
    key: TKey,
    value: PackagingFormState[TKey]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteProcess = (process: PackagingProcess) => {
    if(!window.confirm('Bu paketleme kaydını silmek istediğinize emin misiniz?')) return

    const nextProcesses = processes.filter(item => item.id !== process.id)
    commitProcesses(nextProcesses)
    setSelectedProcessId(nextProcesses[0]?.id || '')
    setPanelMode('summary')

    if(editingProcessId === process.id){
      setEditingProcessId('')
      setForm(createInitialForm(nextProcesses))
      setFormError('')
    }

    showToast('Paketleme kaydı silindi.')
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
    const startedAt = parseDateTimeInput(form.startedAt)
    const normalizedPackagingNo = form.packagingNo.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingProcess = processes.find(process => process.id === editingProcessId)
      if(!existingProcess){
        setFormError('Düzenlenecek paketleme kaydı bulunamadı.')
        return
      }

      const updatedProcess: PackagingProcess = {
        ...existingProcess,
        packagingNo: normalizedPackagingNo,
        productName: form.productName.trim(),
        packageType: form.packageType,
        quantity,
        unit: form.unit,
        startedAt,
        operatorName: form.operatorName.trim(),
        description: form.description.trim(),
        updatedAt: now
      }

      commitProcesses(prev => prev.map(process => process.id === updatedProcess.id ? updatedProcess : process))
      setSelectedProcessId(updatedProcess.id)
      setPanelMode('summary')
      setEditingProcessId('')
      setForm(createInitialForm(processes))
      setFormError('')
      showToast('Paketleme kaydı güncellendi.')
      return
    }

    const newProcess: PackagingProcess = {
      id: createId('pkg'),
      packagingNo: normalizedPackagingNo,
      productName: form.productName.trim(),
      packageType: form.packageType,
      quantity,
      unit: form.unit,
      startedAt,
      operatorName: form.operatorName.trim(),
      status: 'Bekliyor',
      description: form.description.trim(),
      linkedBlastChiller: '',
      linkedShipment: '',
      createdAt: now,
      updatedAt: now
    }

    commitProcesses(prev => [newProcess, ...prev])
    setSelectedProcessId(newProcess.id)
    setPanelMode('summary')
    setForm(createInitialForm([newProcess, ...processes]))
    setFormError('')
    showToast('Paketleme kaydı oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Paketleme Düzenle' : 'Yeni Paketleme'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form packaging-form" onSubmit={submitForm}>
        <div className="form-field">
          <label>Paketleme No</label>
          <input value={form.packagingNo} readOnly />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Ürün</label>
            <select value={form.productName} onChange={event => updateForm('productName', event.target.value)}>
              {PACKAGING_PRODUCTS.map(product => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Paket Tipi</label>
            <select value={form.packageType} onChange={event => updateForm('packageType', event.target.value as PackageType)}>
              {PACKAGE_TYPES.map(packageType => (
                <option key={packageType} value={packageType}>{packageType}</option>
              ))}
            </select>
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
            <select value={form.unit} onChange={event => updateForm('unit', event.target.value as PackagingUnit)}>
              {PACKAGING_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Başlangıç Tarihi</label>
            <input
              type="datetime-local"
              value={form.startedAt}
              onChange={event => updateForm('startedAt', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Operatör</label>
            <input value={form.operatorName} onChange={event => updateForm('operatorName', event.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Paketleme süreci veya ürün notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Paketleme Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => {
    if(!selectedProcess){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir paketleme kaydı seçin.</div>
        </section>
      )
    }

    return (
      <section className="card packaging-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedProcess.packagingNo}</h3>
            <p className="muted">{selectedProcess.productName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedProcess.status)}`}>{selectedProcess.status}</span>
        </div>

        <div className="packaging-summary-grid">
          <div><span>Paketleme No</span><strong>{selectedProcess.packagingNo}</strong></div>
          <div><span>Ürün</span><strong>{selectedProcess.productName}</strong></div>
          <div><span>Paket Tipi</span><strong>{selectedProcess.packageType}</strong></div>
          <div><span>Miktar</span><strong>{formatQuantity(selectedProcess)}</strong></div>
          <div><span>Birim</span><strong>{selectedProcess.unit}</strong></div>
          <div><span>Başlangıç Tarihi</span><strong>{formatDateTime(selectedProcess.startedAt)}</strong></div>
          <div><span>Operatör</span><strong>{selectedProcess.operatorName || '-'}</strong></div>
          <div><span>Durum</span><strong>{selectedProcess.status}</strong></div>
          <div><span>Açıklama</span><strong>{selectedProcess.description || '-'}</strong></div>
        </div>

        <div className="packaging-linked-list">
          <span className="small-label">Bağlı Şoklama</span>
          <div>
            <strong>{selectedProcess.linkedBlastChiller || 'Henüz bağlı değil.'}</strong>
            <small>Şoklama bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
          <span className="small-label">Bağlı Sevkiyat</span>
          <div>
            <strong>{selectedProcess.linkedShipment || 'Henüz bağlı değil.'}</strong>
            <small>Sevkiyat bağlantısı sonraki fazlarda kurulacak.</small>
          </div>
        </div>

        <div className="packaging-side-actions">
          <button className="btn primary" type="button" onClick={() => startEditProcess(selectedProcess)}>Düzenle</button>
          <button className="btn danger" type="button" onClick={() => deleteProcess(selectedProcess)}>Sil</button>
        </div>
      </section>
    )
  }

  return (
    <div className="packaging-page">
      <div className="page-title">
        <div>
          <h2>Paketleme</h2>
          <p className="muted">Şoklaması tamamlanan ürünlerin paketleme ve sevkiyata hazırlık süreçlerini takip edin.</p>
        </div>
      </div>

      {toast && (
        <div className={`packaging-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Paketleme</span>
          <strong>{totalProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bekleyen</span>
          <strong>{waitingProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Paketleniyor</span>
          <strong>{packagingProcesses}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Tamamlanan</span>
          <strong>{completedProcesses}</strong>
        </div>
      </div>

      <div className="product-layout packaging-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Paketleme Listesi</h3>
              <p className="muted">{visibleProcesses.length} paketleme kaydı gösteriliyor.</p>
            </div>
            <div className="packaging-toolbar">
              <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Paketleme</button>
              <input
                type="search"
                placeholder="Paketleme no, ürün veya paket tipi ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {PACKAGING_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table packaging-table">
              <colgroup>
                <col className="pkg-col-no" />
                <col className="pkg-col-product" />
                <col className="pkg-col-type" />
                <col className="pkg-col-quantity" />
                <col className="pkg-col-unit" />
                <col className="pkg-col-start" />
                <col className="pkg-col-status" />
                <col className="pkg-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Paketleme No</th>
                  <th>Ürün</th>
                  <th>Paket Tipi</th>
                  <th>Miktar</th>
                  <th>Birim</th>
                  <th>Başlangıç</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="packaging-empty-list">
                        <strong>Henüz paketleme kaydı bulunmuyor.</strong>
                        <span>İlk paketleme kaydını oluşturmak için "Yeni Paketleme" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewProcess}>Yeni Paketleme</button>
                      </div>
                    </td>
                  </tr>
                )}
                {processes.length > 0 && visibleProcesses.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun paketleme kaydı bulunamadı.</td></tr>
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
                    <td><strong>{process.packagingNo}</strong></td>
                    <td>
                      <strong>{process.productName}</strong>
                      {process.description && <div className="muted small-text">{process.description}</div>}
                    </td>
                    <td>{process.packageType}</td>
                    <td>{formatNumber(process.quantity)}</td>
                    <td>{process.unit}</td>
                    <td>{formatDateTime(process.startedAt)}</td>
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

        <aside className="product-side packaging-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
