import React from 'react'
import { Employee, EmployeeAudit, EmployeeAuditRecordType, EmployeeAuditSeverity, User } from '../types'
import { addActionLog, getActiveBranchId, loadEmployeeAudits, loadEmployees, saveEmployeeAudits } from '../storage'

type Props = { currentUser: User }
type EmployeeFilter = string
type RecordTypeFilter = EmployeeAuditRecordType | 'all'
type SeverityFilter = EmployeeAuditSeverity | 'all'

type AuditFormValues = {
  employeeId: string
  date: string
  recordType: EmployeeAuditRecordType
  severity: EmployeeAuditSeverity
  title: string
  description: string
}

const recordTypes: EmployeeAuditRecordType[] = ['Uyarı', 'Tutanak', 'Ödül', 'Denetim Notu', 'Bilgilendirme']
const severities: EmployeeAuditSeverity[] = ['Düşük', 'Orta', 'Yüksek', 'Kritik']

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getCurrentMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)

const createEmptyValues = (employees: Employee[]): AuditFormValues => {
  const firstActiveEmployee = employees.find(employee => employee.isActive)

  return {
    employeeId: firstActiveEmployee?.id || '',
    date: getLocalDateKey(new Date()),
    recordType: 'Denetim Notu',
    severity: 'Orta',
    title: '',
    description: ''
  }
}

const toFormValues = (audit: EmployeeAudit | null, employees: Employee[]): AuditFormValues => {
  if(!audit) return createEmptyValues(employees)

  return {
    employeeId: audit.employeeId,
    date: audit.date,
    recordType: audit.recordType,
    severity: audit.severity,
    title: audit.title,
    description: audit.description
  }
}

const sortAudits = (items: EmployeeAudit[]) => {
  return [...items].sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return second.updatedAt.localeCompare(first.updatedAt)
  })
}

const getEmployeeName = (employeeMap: Map<string, Employee>, employeeId: string) => {
  return employeeMap.get(employeeId)?.fullName || 'Personel bulunamadı'
}

const getRecordTypePillClass = (recordType: EmployeeAuditRecordType) => {
  if(recordType === 'Ödül') return 'success'
  if(recordType === 'Tutanak') return 'danger-pill'
  if(recordType === 'Uyarı') return 'warning-pill'
  if(recordType === 'Denetim Notu') return 'info-pill'
  return 'muted-pill'
}

const getSeverityPillClass = (severity: EmployeeAuditSeverity) => {
  if(severity === 'Kritik') return 'danger-pill'
  if(severity === 'Yüksek') return 'warning-pill'
  if(severity === 'Orta') return 'info-pill'
  return 'muted-pill'
}

export default function EmployeeAuditRecords({ currentUser }: Props){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [audits, setAudits] = React.useState<EmployeeAudit[]>(() => loadEmployeeAudits())
  const [editingAudit, setEditingAudit] = React.useState<EmployeeAudit | null>(null)
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [recordTypeFilter, setRecordTypeFilter] = React.useState<RecordTypeFilter>('all')
  const [severityFilter, setSeverityFilter] = React.useState<SeverityFilter>('all')
  const [dateFilter, setDateFilter] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveEmployeeAudits(audits)
  }, [audits])

  const employeeMap = React.useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const activeEmployees = React.useMemo(() => employees.filter(employee => employee.isActive), [employees])
  const formEmployees = React.useMemo(() => {
    if(!editingAudit) return activeEmployees
    const editingEmployee = employees.find(employee => employee.id === editingAudit.employeeId)
    if(!editingEmployee || editingEmployee.isActive) return activeEmployees
    return [editingEmployee, ...activeEmployees]
  }, [activeEmployees, editingAudit, employees])
  const currentMonth = getCurrentMonth()

  const visibleAudits = React.useMemo(() => {
    return sortAudits(audits).filter(audit => {
      const matchesEmployee = employeeFilter === 'all' || audit.employeeId === employeeFilter
      const matchesType = recordTypeFilter === 'all' || audit.recordType === recordTypeFilter
      const matchesSeverity = severityFilter === 'all' || audit.severity === severityFilter
      const matchesDate = !dateFilter || audit.date === dateFilter

      return matchesEmployee && matchesType && matchesSeverity && matchesDate
    })
  }, [audits, dateFilter, employeeFilter, recordTypeFilter, severityFilter])

  const warningCount = audits.filter(audit => audit.recordType === 'Uyarı').length
  const reportCount = audits.filter(audit => audit.recordType === 'Tutanak').length
  const rewardCount = audits.filter(audit => audit.recordType === 'Ödül').length
  const criticalCount = audits.filter(audit => audit.severity === 'Kritik').length
  const thisMonthCount = audits.filter(audit => audit.date.startsWith(currentMonth)).length
  const highPriorityCount = audits.filter(audit => audit.severity === 'Yüksek' || audit.severity === 'Kritik').length
  const activeEmployeeRecordCount = audits.filter(audit => employeeMap.get(audit.employeeId)?.isActive).length

  const startEdit = (audit: EmployeeAudit) => {
    setEditingAudit(audit)
    setFormError('')
  }

  const saveAudit = (values: AuditFormValues) => {
    if(!values.employeeId){
      setFormError('Personel seçimi zorunludur.')
      return false
    }

    if(!values.recordType){
      setFormError('Kayıt türü zorunludur.')
      return false
    }

    if(!values.title.trim()){
      setFormError('Başlık zorunludur.')
      return false
    }

    if(!values.description.trim()){
      setFormError('Açıklama zorunludur.')
      return false
    }

    const now = new Date().toISOString()
    const employeeName = getEmployeeName(employeeMap, values.employeeId)

    if(editingAudit){
      const updatedAudit: EmployeeAudit = {
        ...editingAudit,
        employeeId: values.employeeId,
        date: values.date,
        recordType: values.recordType,
        severity: values.severity,
        title: values.title.trim(),
        description: values.description.trim(),
        updatedAt: now
      }

      setAudits(prev => prev.map(audit => audit.id === editingAudit.id ? updatedAudit : audit))
      setEditingAudit(null)
      setFormError('')
      addActionLog({
        operationType: 'Denetim kaydı güncellendi',
        user: currentUser,
        description: `${employeeName} için ${updatedAudit.date} tarihli ${updatedAudit.recordType} kaydı güncellendi. Başlık: ${updatedAudit.title}.`
      })
      return true
    }

    const audit: EmployeeAudit = {
      id: createId('employee_audit'),
      branchId: getActiveBranchId(),
      employeeId: values.employeeId,
      date: values.date,
      recordType: values.recordType,
      severity: values.severity,
      title: values.title.trim(),
      description: values.description.trim(),
      createdBy: currentUser.fullName || currentUser.username,
      createdAt: now,
      updatedAt: now
    }

    setAudits(prev => [audit, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Denetim kaydı oluşturuldu',
      user: currentUser,
      description: `${employeeName} için ${audit.date} tarihli ${audit.recordType} kaydı oluşturuldu. Önem: ${audit.severity}. Başlık: ${audit.title}.`
    })
    return true
  }

  const deleteAudit = (audit: EmployeeAudit) => {
    const employeeName = getEmployeeName(employeeMap, audit.employeeId)
    if(!confirm(`${employeeName} için "${audit.title}" kaydı silinecek. Emin misiniz?`)) return

    setAudits(prev => prev.filter(item => item.id !== audit.id))
    if(editingAudit?.id === audit.id) setEditingAudit(null)
    addActionLog({
      operationType: 'Denetim kaydı silindi',
      user: currentUser,
      description: `${employeeName} için ${audit.date} tarihli ${audit.recordType} kaydı silindi. Başlık: ${audit.title}.`
    })
  }

  return (
    <div className="employee-audit-page">
      <div className="page-title">
        <div>
          <h2>Disiplin ve Denetim Kayıtları</h2>
          <p className="muted">Personel disiplin ve denetim kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Kayıt</span>
          <strong>{audits.length}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Uyarı</span>
          <strong>{warningCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Tutanak</span>
          <strong>{reportCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Ödül</span>
          <strong>{rewardCount}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Kritik Kayıt</span>
          <strong>{criticalCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bu Ay Kayıt</span>
          <strong>{thisMonthCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Yüksek Öncelik</span>
          <strong>{highPriorityCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Personel Kaydı</span>
          <strong>{activeEmployeeRecordCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Denetim Kayıtları</h3>
              <p className="muted">{visibleAudits.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls employee-audit-filters">
              <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
                <option value="all">Tüm personeller</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
              <select value={recordTypeFilter} onChange={event => setRecordTypeFilter(event.target.value as RecordTypeFilter)}>
                <option value="all">Tüm türler</option>
                {recordTypes.map(recordType => <option key={recordType} value={recordType}>{recordType}</option>)}
              </select>
              <select value={severityFilter} onChange={event => setSeverityFilter(event.target.value as SeverityFilter)}>
                <option value="all">Tüm önemler</option>
                {severities.map(severity => <option key={severity} value={severity}>{severity}</option>)}
              </select>
              <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table employee-audit-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Personel</th>
                  <th>Tür</th>
                  <th>Önem</th>
                  <th>Başlık</th>
                  <th>Oluşturan</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleAudits.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun disiplin veya denetim kaydı bulunamadı.</td></tr>
                )}
                {visibleAudits.map(audit => {
                  const employee = employeeMap.get(audit.employeeId)

                  return (
                    <tr key={audit.id}>
                      <td>{audit.date}</td>
                      <td>
                        <strong>{getEmployeeName(employeeMap, audit.employeeId)}</strong>
                        <div className="muted small-text">
                          {employee?.position || '-'} / {employee?.isActive === false ? 'Pasif' : 'Aktif'}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${getRecordTypePillClass(audit.recordType)}`}>
                          {audit.recordType}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${getSeverityPillClass(audit.severity)}`}>
                          {audit.severity}
                        </span>
                      </td>
                      <td>
                        <strong>{audit.title}</strong>
                        <div className="muted small-text">{audit.description}</div>
                      </td>
                      <td>{audit.createdBy || '-'}</td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEdit(audit)}>Düzenle</button>
                        <button className="btn" type="button" onClick={() => deleteAudit(audit)}>Sil</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingAudit ? 'Denetim Kaydı Düzenle' : 'Yeni Denetim Kaydı'}</h3>
              {editingAudit && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <AuditForm
              employees={formEmployees}
              audit={editingAudit}
              onSave={saveAudit}
              onCancel={editingAudit ? () => {
                setEditingAudit(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function AuditForm({
  employees,
  audit,
  onSave,
  onCancel
}: {
  employees: Employee[]
  audit: EmployeeAudit | null
  onSave: (values: AuditFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<AuditFormValues>(() => toFormValues(audit, employees))

  React.useEffect(() => {
    setValues(toFormValues(audit, employees))
  }, [audit, employees])

  const updateField = <K extends keyof AuditFormValues>(key: K, value: AuditFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !audit) setValues(createEmptyValues(employees))
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Personel</label>
        <select value={values.employeeId} onChange={event => updateField('employeeId', event.target.value)} required>
          <option value="">Personel seçin</option>
          {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tarih</label>
        <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Kayıt Türü</label>
        <select value={values.recordType} onChange={event => updateField('recordType', event.target.value as EmployeeAuditRecordType)} required>
          {recordTypes.map(recordType => <option key={recordType} value={recordType}>{recordType}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Önem Seviyesi</label>
        <select value={values.severity} onChange={event => updateField('severity', event.target.value as EmployeeAuditSeverity)} required>
          {severities.map(severity => <option key={severity} value={severity}>{severity}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Başlık</label>
        <input value={values.title} onChange={event => updateField('title', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={5} value={values.description} onChange={event => updateField('description', event.target.value)} required />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
