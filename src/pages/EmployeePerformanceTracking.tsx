import React from 'react'
import { Employee, EmployeePerformance, User } from '../types'
import { addActionLog, loadEmployeePerformances, loadEmployees, saveEmployeePerformances } from '../storage'

type Props = { currentUser: User }
type EmployeeFilter = string

type PerformanceFormValues = {
  employeeId: string
  workDate: string
  servedTableCount: string
  approvedOrderCount: string
  qrOrderCount: string
  customerCallCount: string
  note: string
}

type PerformanceCounts = Pick<EmployeePerformance, 'servedTableCount' | 'approvedOrderCount' | 'qrOrderCount' | 'customerCallCount'>

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const createEmptyValues = (employees: Employee[]): PerformanceFormValues => {
  const firstActiveEmployee = employees.find(employee => employee.isActive)

  return {
    employeeId: firstActiveEmployee?.id || '',
    workDate: getLocalDateKey(new Date()),
    servedTableCount: '0',
    approvedOrderCount: '0',
    qrOrderCount: '0',
    customerCallCount: '0',
    note: ''
  }
}

const toFormValues = (performance: EmployeePerformance | null, employees: Employee[]): PerformanceFormValues => {
  if(!performance) return createEmptyValues(employees)

  return {
    employeeId: performance.employeeId,
    workDate: performance.workDate,
    servedTableCount: String(performance.servedTableCount),
    approvedOrderCount: String(performance.approvedOrderCount),
    qrOrderCount: String(performance.qrOrderCount),
    customerCallCount: String(performance.customerCallCount),
    note: performance.note
  }
}

const normalizeCountInput = (value: string) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0
}

const getPerformanceCounts = (values: PerformanceFormValues): PerformanceCounts => ({
  servedTableCount: normalizeCountInput(values.servedTableCount),
  approvedOrderCount: normalizeCountInput(values.approvedOrderCount),
  qrOrderCount: normalizeCountInput(values.qrOrderCount),
  customerCallCount: normalizeCountInput(values.customerCallCount)
})

const calculatePerformanceScore = (counts: PerformanceCounts) => {
  return counts.servedTableCount + counts.approvedOrderCount + counts.qrOrderCount + counts.customerCallCount
}

const formatScore = (value: number) => {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('tr-TR') : '0'
}

const getEmployeeName = (employeeMap: Map<string, Employee>, employeeId: string) => {
  return employeeMap.get(employeeId)?.fullName || 'Personel bulunamadı'
}

const sortPerformances = (items: EmployeePerformance[]) => {
  return [...items].sort((first, second) => {
    const dateDiff = second.workDate.localeCompare(first.workDate)
    if(dateDiff !== 0) return dateDiff
    return second.performanceScore - first.performanceScore
  })
}

export default function EmployeePerformanceTracking({ currentUser }: Props){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [performances, setPerformances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [editingPerformance, setEditingPerformance] = React.useState<EmployeePerformance | null>(null)
  const [dateFilter, setDateFilter] = React.useState('')
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveEmployeePerformances(performances)
  }, [performances])

  const employeeMap = React.useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const activeEmployees = React.useMemo(() => employees.filter(employee => employee.isActive), [employees])
  const today = getLocalDateKey(new Date())

  const visiblePerformances = React.useMemo(() => {
    return sortPerformances(performances).filter(performance => {
      const matchesDate = !dateFilter || performance.workDate === dateFilter
      const matchesEmployee = employeeFilter === 'all' || performance.employeeId === employeeFilter

      return matchesDate && matchesEmployee
    })
  }, [dateFilter, employeeFilter, performances])

  const totalPerformanceScore = performances.reduce((sum, item) => sum + item.performanceScore, 0)
  const highestPerformanceScore = performances.reduce((highest, item) => Math.max(highest, item.performanceScore), 0)
  const averagePerformanceScore = performances.length > 0 ? Math.round(totalPerformanceScore / performances.length) : 0
  const todayPerformanceScore = performances
    .filter(item => item.workDate === today)
    .reduce((sum, item) => sum + item.performanceScore, 0)
  const totalServedTables = performances.reduce((sum, item) => sum + item.servedTableCount, 0)
  const totalApprovedOrders = performances.reduce((sum, item) => sum + item.approvedOrderCount, 0)
  const totalQrOrders = performances.reduce((sum, item) => sum + item.qrOrderCount, 0)
  const totalCustomerCalls = performances.reduce((sum, item) => sum + item.customerCallCount, 0)

  const startEdit = (performance: EmployeePerformance) => {
    setEditingPerformance(performance)
    setFormError('')
  }

  const savePerformance = (values: PerformanceFormValues) => {
    if(!values.employeeId){
      setFormError('Personel seçimi zorunludur.')
      return false
    }

    if(!values.workDate){
      setFormError('Tarih zorunludur.')
      return false
    }

    const rawValues = [
      values.servedTableCount,
      values.approvedOrderCount,
      values.qrOrderCount,
      values.customerCallCount
    ].map(Number)

    if(rawValues.some(value => !Number.isFinite(value) || value < 0)){
      setFormError('Performans sayı alanları 0 veya daha büyük olmalıdır.')
      return false
    }

    const duplicate = performances.find(performance => {
      if(performance.id === editingPerformance?.id) return false
      return performance.employeeId === values.employeeId && performance.workDate === values.workDate
    })

    if(duplicate){
      setFormError(`${getEmployeeName(employeeMap, values.employeeId)} için ${values.workDate} tarihinde zaten performans kaydı var.`)
      return false
    }

    const now = new Date().toISOString()
    const employeeName = getEmployeeName(employeeMap, values.employeeId)
    const counts = getPerformanceCounts(values)
    const performanceScore = calculatePerformanceScore(counts)

    if(editingPerformance){
      const updatedPerformance: EmployeePerformance = {
        ...editingPerformance,
        employeeId: values.employeeId,
        workDate: values.workDate,
        ...counts,
        performanceScore,
        note: values.note.trim(),
        updatedAt: now
      }

      setPerformances(prev => prev.map(performance => performance.id === editingPerformance.id ? updatedPerformance : performance))
      setEditingPerformance(null)
      setFormError('')
      addActionLog({
        operationType: 'Performans kaydı güncellendi',
        user: currentUser,
        description: `${employeeName} için ${updatedPerformance.workDate} tarihli performans kaydı güncellendi. Skor: ${updatedPerformance.performanceScore}.`
      })
      return true
    }

    const performance: EmployeePerformance = {
      id: createId('employee_performance'),
      employeeId: values.employeeId,
      workDate: values.workDate,
      ...counts,
      performanceScore,
      note: values.note.trim(),
      createdAt: now,
      updatedAt: now
    }

    setPerformances(prev => [performance, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Performans kaydı oluşturuldu',
      user: currentUser,
      description: `${employeeName} için ${performance.workDate} tarihli performans kaydı oluşturuldu. Skor: ${performance.performanceScore}.`
    })
    return true
  }

  const deletePerformance = (performance: EmployeePerformance) => {
    const employeeName = getEmployeeName(employeeMap, performance.employeeId)
    if(!confirm(`${employeeName} için ${performance.workDate} tarihli performans kaydı silinecek. Emin misiniz?`)) return

    setPerformances(prev => prev.filter(item => item.id !== performance.id))
    if(editingPerformance?.id === performance.id) setEditingPerformance(null)
    addActionLog({
      operationType: 'Performans kaydı silindi',
      user: currentUser,
      description: `${employeeName} için ${performance.workDate} tarihli performans kaydı silindi.`
    })
  }

  return (
    <div className="employee-performance-page">
      <div className="page-title">
        <div>
          <h2>Personel Performans Takibi</h2>
          <p className="muted">Personel performans verilerini görüntüleyin ve yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Personel Performansı</span>
          <strong>{formatScore(totalPerformanceScore)}</strong>
        </div>
        <div className="metric-card">
          <span>En Yüksek Performans</span>
          <strong>{formatScore(highestPerformanceScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Ortalama Performans</span>
          <strong>{formatScore(averagePerformanceScore)}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Performans</span>
          <strong>{formatScore(todayPerformanceScore)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Masa Hizmeti</span>
          <strong>{formatScore(totalServedTables)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Sipariş</span>
          <strong>{formatScore(totalApprovedOrders)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam QR Siparişi</span>
          <strong>{formatScore(totalQrOrders)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Garson Çağrısı</span>
          <strong>{formatScore(totalCustomerCalls)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Performans Listesi</h3>
              <p className="muted">{visiblePerformances.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls employee-performance-filters">
              <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
              <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
                <option value="all">Tüm personeller</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table employee-performance-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Personel</th>
                  <th>Masa</th>
                  <th>Sipariş</th>
                  <th>QR Sipariş</th>
                  <th>Garson Çağrısı</th>
                  <th>Performans</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visiblePerformances.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun performans kaydı bulunamadı.</td></tr>
                )}
                {visiblePerformances.map(performance => (
                  <tr key={performance.id}>
                    <td>{performance.workDate}</td>
                    <td>
                      <strong>{getEmployeeName(employeeMap, performance.employeeId)}</strong>
                      {performance.note && <div className="muted small-text">{performance.note}</div>}
                    </td>
                    <td>{performance.servedTableCount}</td>
                    <td>{performance.approvedOrderCount}</td>
                    <td>{performance.qrOrderCount}</td>
                    <td>{performance.customerCallCount}</td>
                    <td><strong>{performance.performanceScore}</strong></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(performance)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => deletePerformance(performance)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingPerformance ? 'Performans Düzenle' : 'Yeni Performans Kaydı'}</h3>
              {editingPerformance && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <PerformanceForm
              employees={activeEmployees}
              performance={editingPerformance}
              onSave={savePerformance}
              onCancel={editingPerformance ? () => {
                setEditingPerformance(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function PerformanceForm({
  employees,
  performance,
  onSave,
  onCancel
}: {
  employees: Employee[]
  performance: EmployeePerformance | null
  onSave: (values: PerformanceFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<PerformanceFormValues>(() => toFormValues(performance, employees))

  React.useEffect(() => {
    setValues(toFormValues(performance, employees))
  }, [employees, performance])

  const counts = getPerformanceCounts(values)
  const previewScore = calculatePerformanceScore(counts)

  const updateField = <K extends keyof PerformanceFormValues>(key: K, value: PerformanceFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !performance) setValues(createEmptyValues(employees))
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
        <input type="date" value={values.workDate} onChange={event => updateField('workDate', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Masa Sayısı</label>
        <input type="number" min="0" step="1" value={values.servedTableCount} onChange={event => updateField('servedTableCount', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Sipariş Sayısı</label>
        <input type="number" min="0" step="1" value={values.approvedOrderCount} onChange={event => updateField('approvedOrderCount', event.target.value)} />
      </div>
      <div className="form-field">
        <label>QR Sipariş Sayısı</label>
        <input type="number" min="0" step="1" value={values.qrOrderCount} onChange={event => updateField('qrOrderCount', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Garson Çağrısı</label>
        <input type="number" min="0" step="1" value={values.customerCallCount} onChange={event => updateField('customerCallCount', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Performans Skoru</label>
        <input value={previewScore} readOnly />
      </div>
      <div className="form-field">
        <label>Not</label>
        <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
