import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import {
  CHECKLIST_ITEM_STATUSES,
  CHECKLIST_ITEM_STATUS_LABELS,
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_TYPES,
  CHECKLIST_TYPE_LABELS,
  ChecklistService
} from '../operation-checklists/checklist.service'
import { ChecklistPrintService } from '../operation-checklists/checklist-print.service'
import type {
  Checklist,
  ChecklistFilters,
  ChecklistHistoryAction,
  ChecklistItemStatus,
  ChecklistStatus,
  ChecklistUpdateInput
} from '../operation-checklists/operation-checklist.types'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type CreateChecklistState = {
  templateId: string
  branchId: string
  warehouseId: string
  department: string
  shift: string
  responsiblePerson: string
  startAt: string
  endAt: string
  description: string
}

const getLocalDateTimeValue = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

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

const getStatusClass = (
  checklist: Pick<Checklist, 'status' | 'items'>
) => {
  if(checklist.status === 'CANCELLED') return 'danger-pill'
  if(checklist.items.some(item => item.status === 'FAIL')) return 'danger-pill'
  if(checklist.items.some(item => item.status === 'WARNING')) return 'warning-pill'
  if(checklist.status === 'COMPLETED') return 'success'
  return 'muted-pill'
}

const getItemStatusClass = (status: ChecklistItemStatus) => {
  if(status === 'PASS') return 'success'
  if(status === 'FAIL') return 'danger-pill'
  if(status === 'WARNING') return 'warning-pill'
  return 'muted-pill'
}

const getHistoryLabel = (action: ChecklistHistoryAction) => {
  const labels: Record<ChecklistHistoryAction, string> = {
    CREATED: 'Olusturuldu',
    UPDATED: 'Guncellendi',
    STARTED: 'Baslatildi',
    COMPLETED: 'Tamamlandi',
    REVISED: 'Revize Edildi',
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
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name || record.id])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createInitialForm = (
  templateId = '',
  branchId = ''
): CreateChecklistState => ({
  templateId,
  branchId,
  warehouseId: branchId,
  department: '',
  shift: 'Sabah',
  responsiblePerson: '',
  startAt: getLocalDateTimeValue(),
  endAt: '',
  description: ''
})

const getActionDisabled = (
  checklist: Checklist | null,
  status: ChecklistStatus
) => {
  if(!checklist) return true
  if(checklist.status === 'CANCELLED') return true
  return checklist.status === status
}

export default function OperationChecklists({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const templates = React.useMemo(() => ChecklistService.templates(), [])
  const branchOptions = React.useMemo(() => sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })), [sourceData])
  const [records, setRecords] = React.useState<Checklist[]>(() => ChecklistService.list(sourceData))
  const [filters, setFilters] = React.useState<ChecklistFilters>(() => ChecklistService.createDefaultFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<CreateChecklistState>(() => createInitialForm(templates[0]?.id || '', branchOptions[0]?.id || ''))
  const filteredRecords = React.useMemo(() => ChecklistService.filter(records, filters), [records, filters])
  const statistics = React.useMemo(() => ChecklistService.statistics(records), [records])
  const selectedRecord = filteredRecords.find(record => record.id === selectedRecordId)
    || records.find(record => record.id === selectedRecordId)
    || filteredRecords[0]
    || records[0]
    || null
  const departmentOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.department, name: record.department }))), [records])
  const shiftOptions = React.useMemo(() => uniqueOptions(records.map(record => ({ id: record.shift, name: record.shift }))), [records])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(filteredRecords[0]?.id || records[0]?.id || '')
  }, [filteredRecords, records, selectedRecordId])

  React.useEffect(() => {
    const template = templates.find(item => item.id === form.templateId)
    if(!template) return
    if(form.department) return
    setForm(prev => ({ ...prev, department: template.department }))
  }, [form.department, form.templateId, templates])

  const refreshRecords = (targetRecordId?: string) => {
    const nextRecords = ChecklistService.list(sourceData)
    setRecords(nextRecords)
    if(targetRecordId) setSelectedRecordId(targetRecordId)
  }

  const updateFilter = <TKey extends keyof ChecklistFilters>(key: TKey, value: ChecklistFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof CreateChecklistState>(key: TKey, value: CreateChecklistState[TKey]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if(key === 'branchId' && !prev.warehouseId) next.warehouseId = value
      if(key === 'templateId'){
        const template = templates.find(item => item.id === value)
        next.department = template?.department || prev.department
      }
      return next
    })
  }

  const createChecklist = () => {
    try{
      const record = ChecklistService.add({
        ...form,
        responsiblePerson: form.responsiblePerson || userName
      }, sourceData, userName)
      refreshRecords(record.id)
      setForm(createInitialForm(form.templateId, form.branchId))
      setMessage({ type: 'success', text: `${record.checklistNo} olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Checklist olusturulamadi.' })
    }
  }

  const saveItems = (input: ChecklistUpdateInput) => {
    if(!selectedRecord) return
    try{
      const record = ChecklistService.updateItems(selectedRecord.id, input, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.checklistNo} maddeleri guncellendi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Checklist maddeleri guncellenemedi.' })
    }
  }

  const completeChecklist = () => {
    if(!selectedRecord) return
    try{
      const record = ChecklistService.complete(selectedRecord.id, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.checklistNo} tamamlandi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Checklist tamamlanamadi.' })
    }
  }

  const changeStatus = (status: Extract<ChecklistStatus, 'REVISED' | 'CANCELLED'>) => {
    if(!selectedRecord) return
    try{
      const record = status === 'REVISED'
        ? ChecklistService.revise(selectedRecord.id, sourceData, userName)
        : ChecklistService.cancel(selectedRecord.id, sourceData, userName)
      refreshRecords(record.id)
      setMessage({ type: 'success', text: `${record.checklistNo} ${CHECKLIST_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Durum guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ChecklistHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedRecord) return

    try{
      if(action === 'PRINTED') ChecklistPrintService.openPrintWindow(selectedRecord, 'A4')
      if(action === 'PDF') ChecklistPrintService.openPrintWindow(selectedRecord, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['operation-checklists'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedRecord.id],
          userName
        })
      }

      const record = ChecklistService.recordOutput(selectedRecord.id, action, sourceData, userName)
      refreshRecords(record.id)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${record.checklistNo} Excel export edildi.`
          : `${record.checklistNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Cikti alinamadi.' })
    }
  }

  return (
    <div className="operation-checklist-page">
      <div className="page-header">
        <div>
          <h2>Operasyon Kontrol Listeleri</h2>
          <p className="muted">Gunluk operasyon, vardiya, temizlik, HACCP, depo, uretim, sevkiyat ve bakim kontrollerini tek read-model merkezinde izler.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid operation-checklist-metric-grid">
        <div className="metric-card">
          <span>Bugunku Checklist</span>
          <strong>{formatNumber(statistics.todayChecklists)}</strong>
          <small>Bugun baslayan kontroller</small>
        </div>
        <div className="metric-card">
          <span>Tamamlanan</span>
          <strong>{formatNumber(statistics.completed)}</strong>
          <small>Tamamlanma {formatPercent(statistics.completionRate)}</small>
        </div>
        <div className="metric-card warning">
          <span>Bekleyen</span>
          <strong>{formatNumber(statistics.pending)}</strong>
          <small>Taslak / devam ediyor</small>
        </div>
        <div className="metric-card danger">
          <span>FAIL</span>
          <strong>{formatNumber(statistics.fail)}</strong>
          <small>FAIL orani {formatPercent(statistics.failRate)}</small>
        </div>
        <div className="metric-card warning">
          <span>WARNING</span>
          <strong>{formatNumber(statistics.warning)}</strong>
          <small>Uyari iceren kontrol</small>
        </div>
      </div>

      <section className="card operation-checklist-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Checklist</h3>
            <p className="muted">Sablon bazli operasyon checklist kaydi olusturur; foto yukleme, QR/NFC ve IoT dogrulama bu fazda yoktur.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.templateId || !form.branchId} onClick={createChecklist}>Checklist Olustur</button>
        </div>
        <div className="operation-checklist-create-grid">
          <label className="form-field">
            <span>Sablon</span>
            <select value={form.templateId} onChange={event => updateForm('templateId', event.target.value)}>
              {templates.map(template => <option key={template.id} value={template.id}>{template.name} {template.version}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sube</span>
            <select value={form.branchId} onChange={event => updateForm('branchId', event.target.value)}>
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={form.warehouseId} onChange={event => updateForm('warehouseId', event.target.value)}>
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Departman</span>
            <input value={form.department} onChange={event => updateForm('department', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Vardiya</span>
            <select value={form.shift} onChange={event => updateForm('shift', event.target.value)}>
              {['Sabah', 'Aksam', 'Gece', 'Mal Kabul', 'Genel'].map(shift => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu Personel</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} placeholder={userName} />
          </label>
          <label className="form-field">
            <span>Baslangic</span>
            <input type="datetime-local" value={form.startAt} onChange={event => updateForm('startAt', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitis</span>
            <input type="datetime-local" value={form.endAt} onChange={event => updateForm('endAt', event.target.value)} />
          </label>
          <label className="form-field operation-checklist-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Operasyon notu" />
          </label>
        </div>
      </section>

      <section className="card operation-checklist-template-card">
        <div className="section-header compact">
          <div>
            <h3>Checklist Templates</h3>
            <p className="muted">{formatNumber(templates.length)} aktif sablon, versiyonlu madde yapisi.</p>
          </div>
          <span className="status-pill">v1.0</span>
        </div>
        <div className="operation-checklist-template-grid">
          {templates.map(template => (
            <div key={template.id}>
              <strong>{template.name}</strong>
              <span>{template.department} / {template.version}</span>
              <em>{formatNumber(template.items.length)} madde</em>
            </div>
          ))}
        </div>
      </section>

      <section className="card operation-checklist-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} / {formatNumber(records.length)} checklist listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(ChecklistService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="operation-checklist-filter-grid">
          <label className="form-field">
            <span>Checklist Turu</span>
            <select value={filters.checklistType} onChange={event => updateFilter('checklistType', event.target.value as ChecklistFilters['checklistType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {CHECKLIST_TYPES.map(type => <option key={type} value={type}>{CHECKLIST_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Departman</span>
            <select value={filters.department} onChange={event => updateFilter('department', event.target.value)}>
              <option value={ALL_FILTER}>Tum Departmanlar</option>
              {departmentOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <span>Durum</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value as ChecklistFilters['status'])}>
              <option value={ALL_FILTER}>Tum Durumlar</option>
              {CHECKLIST_STATUSES.map(status => <option key={status} value={status}>{CHECKLIST_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Vardiya</span>
            <select value={filters.shift} onChange={event => updateFilter('shift', event.target.value)}>
              <option value={ALL_FILTER}>Tum Vardiyalar</option>
              {shiftOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Checklist no, ad, departman, sube" />
          </label>
        </div>
      </section>

      <div className="operation-checklist-chart-grid">
        <BarChartCard title="Departman Bazli" rows={statistics.departmentRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Checklist Turu Bazli" rows={statistics.typeRows} />
        <BarChartCard title="Durum Bazli" rows={statistics.statusRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout operation-checklist-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Checklist Listesi</h3>
              <p className="muted">Operasyon kontrolleri read-model olarak izlenir; foto, QR/NFC ve IoT sensor otomasyonu bu fazda yoktur.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.totalChecklists)} checklist</span>
          </div>
          <div className="table-wrap operation-checklist-table-wrap">
            <table className="data-table operation-checklist-table">
              <thead>
                <tr>
                  <th>Checklist No</th>
                  <th>Baslangic</th>
                  <th>Tur / Sablon</th>
                  <th>Sube / Departman</th>
                  <th>Vardiya</th>
                  <th>Kaynak</th>
                  <th>Tamamlanma</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun checklist bulunamadi.</td></tr>
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
                    <td data-label="Checklist No"><strong>{record.checklistNo}</strong><span>{record.sourceType}</span></td>
                    <td data-label="Baslangic">{formatDateTime(record.startAt)}</td>
                    <td data-label="Tur / Sablon"><strong>{CHECKLIST_TYPE_LABELS[record.checklistType]}</strong><span>{record.templateVersion}</span></td>
                    <td data-label="Sube / Departman"><strong>{record.branchName}</strong><span>{record.department}</span></td>
                    <td data-label="Vardiya">{record.shift}</td>
                    <td data-label="Kaynak"><strong>{record.sourceNo || '-'}</strong><span>{record.equipmentName || record.haccpReference || '-'}</span></td>
                    <td data-label="Tamamlanma">{formatPercent(record.execution.completionRate)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(record)}`}>{CHECKLIST_STATUS_LABELS[record.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side operation-checklist-side">
          {selectedRecord ? (
            <ChecklistDetailPanel
              record={selectedRecord}
              onComplete={completeChecklist}
              onOutput={recordOutput}
              onSaveItems={saveItems}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card operation-checklist-detail-card">
              <h3>Checklist Detayi</h3>
              <p className="muted">Detay gormek icin bir checklist secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ChecklistDetailPanel({
  onComplete,
  onOutput,
  onSaveItems,
  onStatusChange,
  record
}: {
  onComplete: () => void
  onOutput: (action: Extract<ChecklistHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onSaveItems: (input: ChecklistUpdateInput) => void
  onStatusChange: (status: Extract<ChecklistStatus, 'REVISED' | 'CANCELLED'>) => void
  record: Checklist
}){
  const [itemStatuses, setItemStatuses] = React.useState<Record<string, ChecklistItemStatus>>({})
  const [itemNotes, setItemNotes] = React.useState<Record<string, string>>({})
  const [correctiveActions, setCorrectiveActions] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setItemStatuses(Object.fromEntries(record.items.map(item => [item.id, item.status])))
    setItemNotes(Object.fromEntries(record.items.map(item => [item.id, item.note])))
    setCorrectiveActions(Object.fromEntries(record.items.map(item => [item.id, item.correctiveAction])))
  }, [record.id, record.items])

  return (
    <>
      <section className="card operation-checklist-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.checklistNo}</h3>
            <p className="muted">{CHECKLIST_TYPE_LABELS[record.checklistType]} / {record.templateName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(record)}`}>{CHECKLIST_STATUS_LABELS[record.status]}</span>
        </div>

        <div className="operation-checklist-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="operation-checklist-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(record, 'COMPLETED')} onClick={onComplete}>Tamamla</button>
          <button className="btn" type="button" disabled={getActionDisabled(record, 'REVISED')} onClick={() => onStatusChange('REVISED')}>Revize</button>
          <button className="btn danger" type="button" disabled={getActionDisabled(record, 'CANCELLED')} onClick={() => onStatusChange('CANCELLED')}>Iptal</button>
        </div>

        <div className="operation-checklist-detail-grid">
          <div><span>Sube</span><strong>{record.branchName}</strong></div>
          <div><span>Depo</span><strong>{record.warehouseName}</strong></div>
          <div><span>Departman</span><strong>{record.department}</strong></div>
          <div><span>Vardiya</span><strong>{record.shift}</strong></div>
          <div><span>Sorumlu</span><strong>{record.responsiblePerson}</strong></div>
          <div><span>Kaynak</span><strong>{record.sourceNo || record.sourceType}</strong></div>
          <div><span>Baslangic</span><strong>{formatDateTime(record.startAt)}</strong></div>
          <div><span>Bitis</span><strong>{formatDateTime(record.endAt)}</strong></div>
          <div><span>HACCP</span><strong>{record.haccpReference || '-'}</strong></div>
          <div><span>Tamamlanma</span><strong>{formatPercent(record.execution.completionRate)}</strong></div>
        </div>
        <p className="operation-checklist-notes">{record.description || '-'}</p>
      </section>

      <section className="card operation-checklist-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Checklist Maddeleri</h3>
            <p className="muted">{formatNumber(record.items.length)} kontrol maddesi.</p>
          </div>
          <button
            className="btn"
            type="button"
            disabled={record.status === 'CANCELLED'}
            onClick={() => onSaveItems({ itemStatuses, itemNotes, correctiveActions })}
          >
            Maddeleri Kaydet
          </button>
        </div>
        <div className="operation-checklist-item-list">
          {record.items.map(item => (
            <div className="operation-checklist-item-row" key={item.id}>
              <div className="operation-checklist-item-title">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
              <label className="form-field">
                <span>Sonuc</span>
                <select value={itemStatuses[item.id] || item.status} onChange={event => setItemStatuses(prev => ({ ...prev, [item.id]: event.target.value as ChecklistItemStatus }))}>
                  {CHECKLIST_ITEM_STATUSES.map(status => <option key={status} value={status}>{CHECKLIST_ITEM_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Not</span>
                <input value={itemNotes[item.id] ?? item.note} onChange={event => setItemNotes(prev => ({ ...prev, [item.id]: event.target.value }))} placeholder="Kontrol notu" />
              </label>
              <label className="form-field operation-checklist-wide">
                <span>Duzeltici Faaliyet</span>
                <input value={correctiveActions[item.id] ?? item.correctiveAction} onChange={event => setCorrectiveActions(prev => ({ ...prev, [item.id]: event.target.value }))} placeholder="FAIL varsa aksiyon" />
              </label>
              <span className={`status-pill ${getItemStatusClass(itemStatuses[item.id] || item.status)}`}>{CHECKLIST_ITEM_STATUS_LABELS[itemStatuses[item.id] || item.status]}</span>
              <em>{item.photoPlaceholder || 'Foto hazirlik'}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="card operation-checklist-detail-card">
        <h3>Execution</h3>
        <div className="operation-checklist-detail-grid">
          <div><span>PASS</span><strong>{formatNumber(record.execution.passCount)}</strong></div>
          <div><span>WARNING</span><strong>{formatNumber(record.execution.warningCount)}</strong></div>
          <div><span>FAIL</span><strong>{formatNumber(record.execution.failCount)}</strong></div>
          <div><span>Tamamlanma</span><strong>{formatPercent(record.execution.completionRate)}</strong></div>
        </div>
      </section>

      <section className="card operation-checklist-detail-card">
        <h3>History</h3>
        <div className="operation-checklist-history-list">
          {[...record.history].reverse().map(history => (
            <div key={history.id}>
              <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
              <span>{formatDateTime(history.createdAt)} / Rev {history.revisionNo}</span>
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
