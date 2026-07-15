import React from 'react'
import type { User } from '../types'
import {
  PRODUCTION_LINE_STATUSES,
  PRODUCTION_LINE_TYPES,
  loadProductionLines,
  normalizeProductionLineStatus,
  saveProductionLines
} from '../production-lines/production-line.mock'
import type {
  ProductionLine,
  ProductionLineStatus,
  ProductionLineType
} from '../production-lines/production-line.types'

type Props = { currentUser: User }
type StatusFilter = ProductionLineStatus | 'all'
type PanelMode = 'summary' | 'form'
type ToastTone = 'success' | 'info'

type ProductionLineFormState = {
  code: string
  name: string
  type: ProductionLineType
  status: ProductionLineStatus
  capacity: string
  responsible: string
  description: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatCapacity = (line: ProductionLine) => `${formatNumber(line.capacity)} ${line.capacityUnit}`

const getStatusClass = (status: ProductionLineStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Yoğun') return 'warning-pill'
  if(status === 'Bakımda') return 'info-pill'
  return 'muted-pill'
}

const getNextLineCode = (lines: ProductionLine[]) => {
  const maxNo = lines.reduce((max, line) => {
    const match = line.code.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `HAT-${String(maxNo + 1).padStart(2, '0')}`
}

const createInitialForm = (currentUser: User, lines: ProductionLine[]): ProductionLineFormState => ({
  code: getNextLineCode(lines),
  name: '',
  type: 'Genel',
  status: 'Aktif',
  capacity: '100',
  responsible: currentUser.fullName || currentUser.username || '',
  description: ''
})

const createFormFromLine = (line: ProductionLine): ProductionLineFormState => ({
  code: line.code,
  name: line.name,
  type: line.type,
  status: line.status,
  capacity: String(line.capacity),
  responsible: line.responsible,
  description: line.description
})

const validateForm = (
  form: ProductionLineFormState,
  lines: ProductionLine[],
  editingLineId: string
) => {
  if(!form.code.trim()) return 'Hat kodu zorunludur.'
  if(!form.name.trim()) return 'Hat adı zorunludur.'
  if(!form.capacity.trim()) return 'Kapasite zorunludur.'

  const capacity = Number(form.capacity)
  if(!Number.isFinite(capacity)) return 'Kapasite için geçerli bir sayı girilmelidir.'
  if(capacity <= 0) return 'Kapasite 0 veya negatif olamaz.'
  if(!form.responsible.trim()) return 'Sorumlu kişi zorunludur.'

  const normalizedCode = form.code.trim().toLocaleLowerCase('tr-TR')
  const duplicateCode = lines.some(line => (
    line.id !== editingLineId
    && line.code.trim().toLocaleLowerCase('tr-TR') === normalizedCode
  ))
  if(duplicateCode) return 'Bu hat kodu zaten kullanılıyor.'

  return ''
}

export default function ProductionLines({ currentUser }: Props){
  const [lines, setLines] = React.useState<ProductionLine[]>(() => loadProductionLines())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [selectedLineId, setSelectedLineId] = React.useState('pline_001')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [editingLineId, setEditingLineId] = React.useState('')
  const [form, setForm] = React.useState<ProductionLineFormState>(() => createInitialForm(currentUser, loadProductionLines()))
  const [formError, setFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)

  const commitLines = React.useCallback((updater: React.SetStateAction<ProductionLine[]>) => {
    setLines(prev => {
      const nextLines = typeof updater === 'function'
        ? (updater as (current: ProductionLine[]) => ProductionLine[])(prev)
        : updater
      saveProductionLines(nextLines)
      return nextLines
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('pline_toast'),
      text,
      tone
    })
  }, [])

  const visibleLines = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
    const normalizedStatusFilter = statusFilter === 'all'
      ? 'all'
      : normalizeProductionLineStatus(statusFilter)

    return lines.filter(line => {
      const matchesSearch = !normalizedSearch
        || line.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesStatus = normalizedStatusFilter === 'all'
        || normalizeProductionLineStatus(line.status) === normalizedStatusFilter

      return matchesSearch && matchesStatus
    })
  }, [lines, search, statusFilter])

  React.useEffect(() => {
    if(panelMode === 'form') return
    if(visibleLines.some(line => line.id === selectedLineId)) return
    setSelectedLineId(visibleLines[0]?.id || '')
  }, [panelMode, selectedLineId, visibleLines])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedLine = lines.find(line => line.id === selectedLineId) || null
  const isEditing = Boolean(editingLineId)
  const totalLines = lines.length
  const activeLines = lines.filter(line => line.status === 'Aktif').length
  const busyLines = lines.filter(line => line.status === 'Yoğun').length
  const totalCapacity = lines.reduce((sum, line) => sum + line.capacity, 0)

  const startNewLine = () => {
    setPanelMode('form')
    setEditingLineId('')
    setForm(createInitialForm(currentUser, lines))
    setFormError('')
    setToast(null)
  }

  const startEditLine = (line: ProductionLine) => {
    setSelectedLineId(line.id)
    setPanelMode('form')
    setEditingLineId(line.id)
    setForm(createFormFromLine(line))
    setFormError('')
    setToast(null)
  }

  const cancelForm = () => {
    setPanelMode('summary')
    setEditingLineId('')
    setForm(createInitialForm(currentUser, lines))
    setFormError('')
  }

  const updateForm = <TKey extends keyof ProductionLineFormState>(key: TKey, value: ProductionLineFormState[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const deleteLine = (line: ProductionLine) => {
    if(!window.confirm('Bu üretim hattını silmek istediğinize emin misiniz?')) return

    const nextLines = lines.filter(item => item.id !== line.id)
    commitLines(nextLines)
    setSelectedLineId(nextLines[0]?.id || '')
    setPanelMode('summary')

    if(editingLineId === line.id){
      setEditingLineId('')
      setForm(createInitialForm(currentUser, nextLines))
      setFormError('')
    }

    showToast('Üretim hattı silindi.')
  }

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(form, lines, editingLineId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const capacity = Number(form.capacity)
    const normalizedCode = form.code.trim().toLocaleUpperCase('tr-TR')

    if(isEditing){
      const existingLine = lines.find(line => line.id === editingLineId)
      if(!existingLine){
        setFormError('Düzenlenecek üretim hattı bulunamadı.')
        return
      }

      const updatedLine: ProductionLine = {
        ...existingLine,
        code: normalizedCode,
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        capacity,
        responsible: form.responsible.trim(),
        description: form.description.trim(),
        updatedAt: now
      }

      commitLines(prev => prev.map(line => line.id === updatedLine.id ? updatedLine : line))
      setSelectedLineId(updatedLine.id)
      setPanelMode('summary')
      setEditingLineId('')
      setForm(createInitialForm(currentUser, lines))
      setFormError('')
      showToast('Üretim hattı güncellendi.')
      return
    }

    const newLine: ProductionLine = {
      id: createId('pline'),
      code: normalizedCode,
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      capacity,
      capacityUnit: 'kg/gün',
      activeWorkOrderCount: 0,
      responsible: form.responsible.trim(),
      activeOperator: 'Atanmadı',
      todayWorkOrderCount: 0,
      estimatedUtilization: 0,
      linkedWorkOrders: [],
      description: form.description.trim(),
      createdAt: now,
      updatedAt: now
    }

    commitLines(prev => [newLine, ...prev])
    setSelectedLineId(newLine.id)
    setPanelMode('summary')
    setForm(createInitialForm(currentUser, [newLine, ...lines]))
    setFormError('')
    showToast('Üretim hattı oluşturuldu.')
  }

  const renderFormPanel = () => (
    <section className="card">
      <div className="section-header compact">
        <h3>{isEditing ? 'Üretim Hattı Düzenle' : 'Yeni Hat'}</h3>
        <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
      </div>

      {formError && <div className="form-error">{formError}</div>}

      <form className="stacked-form production-line-form" onSubmit={submitForm}>
        <div className="form-row">
          <div className="form-field">
            <label>Hat Kodu</label>
            <input value={form.code} onChange={event => updateForm('code', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Hat Adı</label>
            <input value={form.name} onChange={event => updateForm('name', event.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Hat Tipi</label>
            <select value={form.type} onChange={event => updateForm('type', event.target.value as ProductionLineType)}>
              {PRODUCTION_LINE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Durum</label>
            <select value={form.status} onChange={event => updateForm('status', event.target.value as ProductionLineStatus)}>
              {PRODUCTION_LINE_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Kapasite</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.capacity}
              onChange={event => updateForm('capacity', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Sorumlu Kişi</label>
            <input value={form.responsible} onChange={event => updateForm('responsible', event.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={event => updateForm('description', event.target.value)}
            placeholder="Hat kullanım alanı veya operasyon notu"
          />
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{isEditing ? 'Değişiklikleri Kaydet' : 'Hat Oluştur'}</button>
        </div>
      </form>
    </section>
  )

  const renderSummaryPanel = () => (
    <section className="card production-line-summary">
      {selectedLine ? (
        <>
          <div className="section-header compact">
            <div>
              <h3>{selectedLine.code}</h3>
              <p className="muted">{selectedLine.name}</p>
            </div>
            <span className={`status-pill ${getStatusClass(selectedLine.status)}`}>{selectedLine.status}</span>
          </div>

          <div className="production-line-summary-grid">
            <div>
              <span>Hat Bilgileri</span>
              <strong>{selectedLine.type} · {selectedLine.responsible || '-'}</strong>
            </div>
            <div>
              <span>Kapasite</span>
              <strong>{formatCapacity(selectedLine)}</strong>
            </div>
            <div>
              <span>Bugünkü İş Emri</span>
              <strong>{selectedLine.todayWorkOrderCount}</strong>
            </div>
            <div>
              <span>Aktif Operatör</span>
              <strong>{selectedLine.activeOperator || '-'}</strong>
            </div>
            <div>
              <span>Tahmini Doluluk</span>
              <strong>%{formatNumber(selectedLine.estimatedUtilization)}</strong>
            </div>
            <div>
              <span>Aktif İş Emirleri</span>
              <strong>{selectedLine.activeWorkOrderCount}</strong>
            </div>
          </div>

          <div className="production-line-linked-list">
            <span className="small-label">Bağlı İş Emirleri</span>
            {selectedLine.linkedWorkOrders.length > 0 ? selectedLine.linkedWorkOrders.map(workOrderNo => (
              <div key={workOrderNo}>
                <strong>{workOrderNo}</strong>
                <small>Dummy bağlantı</small>
              </div>
            )) : (
              <div>
                <strong>Bağlı iş emri yok</strong>
                <small>Gerçek bağlantı sonraki fazlarda kurulacak.</small>
              </div>
            )}
          </div>

          {selectedLine.description && <p className="production-line-notes">{selectedLine.description}</p>}

          <div className="production-line-side-actions">
            <button className="btn primary" type="button" onClick={() => startEditLine(selectedLine)}>Düzenle</button>
            <button className="btn danger" type="button" onClick={() => deleteLine(selectedLine)}>Sil</button>
          </div>
        </>
      ) : (
        <div className="empty-state">Detay için bir üretim hattı seçin.</div>
      )}
    </section>
  )

  return (
    <div className="production-lines-page">
      <div className="page-title">
        <div>
          <h2>Üretim Hatları</h2>
          <p className="muted">Endüstriyel mutfak üretim kapasitesini hat, durum ve sorumlu bazında yönetin.</p>
        </div>
      </div>

      {toast && (
        <div className={`production-line-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Hat</span>
          <strong>{totalLines}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Hat</span>
          <strong>{activeLines}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Yoğun Hat</span>
          <strong>{busyLines}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Kapasite</span>
          <strong>{formatNumber(totalCapacity)} kg/gün</strong>
        </div>
      </div>

      <div className="product-layout production-line-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Üretim Hatları Listesi</h3>
              <p className="muted">{visibleLines.length} üretim hattı gösteriliyor.</p>
            </div>
            <div className="production-line-toolbar">
              <button className="btn primary" type="button" onClick={startNewLine}>Yeni Hat</button>
              <input
                type="search"
                placeholder="Hat adına göre ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {PRODUCTION_LINE_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table production-line-table">
              <colgroup>
                <col className="pline-col-code" />
                <col className="pline-col-name" />
                <col className="pline-col-type" />
                <col className="pline-col-status" />
                <col className="pline-col-capacity" />
                <col className="pline-col-active" />
                <col className="pline-col-responsible" />
                <col className="pline-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Hat Kodu</th>
                  <th>Hat Adı</th>
                  <th>Hat Tipi</th>
                  <th>Durum</th>
                  <th>Kapasite</th>
                  <th>Aktif İş Emirleri</th>
                  <th>Sorumlu</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      <div className="production-line-empty-list">
                        <strong>Henüz üretim hattı bulunmuyor.</strong>
                        <span>İlk üretim hattını oluşturmak için "Yeni Hat" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewLine}>Yeni Hat</button>
                      </div>
                    </td>
                  </tr>
                )}
                {lines.length > 0 && visibleLines.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun üretim hattı bulunamadı.</td></tr>
                )}
                {visibleLines.map(line => (
                  <tr
                    key={line.id}
                    className={line.id === selectedLineId ? 'selected-row' : ''}
                    onClick={() => {
                      setSelectedLineId(line.id)
                      setPanelMode('summary')
                    }}
                  >
                    <td><strong>{line.code}</strong></td>
                    <td>
                      <strong>{line.name}</strong>
                      {line.description && <div className="muted small-text">{line.description}</div>}
                    </td>
                    <td>{line.type}</td>
                    <td><span className={`status-pill ${getStatusClass(line.status)}`}>{line.status}</span></td>
                    <td>{formatCapacity(line)}</td>
                    <td>{line.activeWorkOrderCount}</td>
                    <td>{line.responsible || '-'}</td>
                    <td className="actions-cell">
                      <button
                        className="btn"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          startEditLine(line)
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          deleteLine(line)
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

        <aside className="product-side production-line-side">
          {panelMode === 'form' ? renderFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
