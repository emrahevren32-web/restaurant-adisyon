import React from 'react'
import { Employee, EmployeePosition, User } from '../types'
import { addActionLog, loadEmployees, saveEmployees } from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type StatusFilter = 'active' | 'inactive' | 'all'
type PositionFilter = EmployeePosition | 'all'

type EmployeeFormValues = {
  fullName: string
  position: EmployeePosition
  phone: string
  email: string
  startDate: string
  salary: string
  note: string
}

const employeePositions: EmployeePosition[] = ['Garson', 'Kasiyer', 'Aşçı', 'Kurye', 'Yönetici', 'Diğer']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const createEmptyValues = (): EmployeeFormValues => ({
  fullName: '',
  position: 'Garson',
  phone: '',
  email: '',
  startDate: getLocalDateKey(new Date()),
  salary: '',
  note: ''
})

const toFormValues = (employee: Employee | null): EmployeeFormValues => {
  if(!employee) return createEmptyValues()

  return {
    fullName: employee.fullName,
    position: employee.position,
    phone: employee.phone,
    email: employee.email,
    startDate: employee.startDate,
    salary: employee.salary ? String(employee.salary) : '',
    note: employee.note
  }
}

const createEmployeeCode = (items: Employee[]) => {
  const maxCode = items.reduce((max, item) => {
    const match = item.code.match(/^PER-(\d+)$/)
    if(!match) return max

    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return `PER-${String(maxCode + 1).padStart(3, '0')}`
}

const normalizeFormValues = (values: EmployeeFormValues) => ({
  fullName: values.fullName.trim(),
  position: values.position,
  phone: values.phone.trim(),
  email: values.email.trim(),
  startDate: values.startDate,
  salary: Number(values.salary),
  note: values.note.trim()
})

export default function EmployeeCards({ currentUser }: Props){
  const [items, setItems] = React.useState<Employee[]>(() => loadEmployees())
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | null>(null)
  const [search, setSearch] = React.useState('')
  const [positionFilter, setPositionFilter] = React.useState<PositionFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveEmployees(items)
  }, [items])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return items.filter(item => {
      const matchesSearch = !normalizedSearch
        || item.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.fullName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.position.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.phone.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.email.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.note.toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesPosition = positionFilter === 'all' || item.position === positionFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && item.isActive)
        || (statusFilter === 'inactive' && !item.isActive)

      return matchesSearch && matchesPosition && matchesStatus
    })
  }, [items, positionFilter, search, statusFilter])

  const activeCount = items.filter(item => item.isActive).length
  const inactiveCount = items.filter(item => !item.isActive).length
  const managerCount = items.filter(item => item.position === 'Yönetici').length

  const startEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormError('')
  }

  const saveEmployee = (values: EmployeeFormValues) => {
    const normalized = normalizeFormValues(values)

    if(!normalized.fullName){
      setFormError('Ad Soyad zorunludur.')
      return false
    }

    if(!normalized.position){
      setFormError('Pozisyon zorunludur.')
      return false
    }

    if(!normalized.startDate){
      setFormError('İşe giriş tarihi zorunludur.')
      return false
    }

    if(values.salary.trim() && (!Number.isFinite(normalized.salary) || normalized.salary < 0)){
      setFormError('Maaş geçerli bir tutar olmalıdır.')
      return false
    }

    const now = new Date().toISOString()
    const salary = values.salary.trim() ? roundMoney(normalized.salary) : 0

    if(editingEmployee){
      const updatedEmployee: Employee = {
        ...editingEmployee,
        fullName: normalized.fullName,
        position: normalized.position,
        phone: normalized.phone,
        email: normalized.email,
        startDate: normalized.startDate,
        salary,
        note: normalized.note,
        updatedAt: now
      }

      setItems(prev => prev.map(item => item.id === editingEmployee.id ? updatedEmployee : item))
      setEditingEmployee(null)
      setFormError('')
      addActionLog({
        operationType: 'Personel güncellendi',
        user: currentUser,
        description: `${updatedEmployee.code} kodlu ${updatedEmployee.fullName} personel kartı güncellendi.`
      })
      return true
    }

    const employee: Employee = {
      id: createId('employee'),
      code: createEmployeeCode(items),
      fullName: normalized.fullName,
      position: normalized.position,
      phone: normalized.phone,
      email: normalized.email,
      startDate: normalized.startDate,
      salary,
      isActive: true,
      note: normalized.note,
      createdAt: now,
      updatedAt: now
    }

    setItems(prev => [employee, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Personel oluşturuldu',
      user: currentUser,
      description: `${employee.code} kodlu ${employee.fullName} personel kartı oluşturuldu. Pozisyon: ${employee.position}.`
    })
    return true
  }

  const makePassive = (employee: Employee) => {
    if(!employee.isActive) return

    const updatedEmployee: Employee = {
      ...employee,
      isActive: false,
      updatedAt: new Date().toISOString()
    }

    setItems(prev => prev.map(item => item.id === employee.id ? updatedEmployee : item))
    if(editingEmployee?.id === employee.id) setEditingEmployee(updatedEmployee)
    addActionLog({
      operationType: 'Personel pasif yapıldı',
      user: currentUser,
      description: `${employee.code} kodlu ${employee.fullName} personel kartı pasif yapıldı.`
    })
  }

  const deleteEmployee = (employee: Employee) => {
    if(!confirm(`${employee.fullName} personel kartı silinecek. Emin misiniz?`)) return

    setItems(prev => prev.filter(item => item.id !== employee.id))
    if(editingEmployee?.id === employee.id) setEditingEmployee(null)
    addActionLog({
      operationType: 'Personel silindi',
      user: currentUser,
      description: `${employee.code} kodlu ${employee.fullName} personel kartı silindi.`
    })
  }

  return (
    <div className="employee-cards-page">
      <div className="page-title">
        <div>
          <h2>Personel Kartları</h2>
          <p className="muted">İşletmede çalışan personelleri yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Personel</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Personel</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Pasif Personel</span>
          <strong>{inactiveCount}</strong>
        </div>
        <div className="metric-card">
          <span>Yönetici Sayısı</span>
          <strong>{managerCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Personel Listesi</h3>
              <p className="muted">{visibleItems.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls employee-filters">
              <input
                type="search"
                placeholder="Kod, ad soyad, pozisyon veya telefon ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={positionFilter} onChange={event => setPositionFilter(event.target.value as PositionFilter)}>
                <option value="all">Tüm pozisyonlar</option>
                {employeePositions.map(position => <option key={position} value={position}>{position}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
                <option value="all">Tümü</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table employee-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Ad Soyad</th>
                  <th>Pozisyon</th>
                  <th>Telefon</th>
                  <th>İşe Giriş</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun personel kartı bulunamadı.</td></tr>
                )}
                {visibleItems.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong></td>
                    <td>
                      <strong>{item.fullName}</strong>
                      {(item.email || item.salary > 0 || item.note) && (
                        <div className="muted small-text">
                          {[item.email, item.salary > 0 && `Maaş: ${formatCurrency(item.salary)}`, item.note].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{item.position}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.startDate || '-'}</td>
                    <td>
                      <span className={`status-pill ${item.isActive ? 'success' : 'muted-pill'}`}>
                        {item.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(item)}>Düzenle</button>
                      <button className="btn" type="button" disabled={!item.isActive} onClick={() => makePassive(item)}>
                        {item.isActive ? 'Pasif Yap' : 'Pasif'}
                      </button>
                      <button className="btn" type="button" onClick={() => deleteEmployee(item)}>Sil</button>
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
              <h3>{editingEmployee ? 'Personel Düzenle' : 'Yeni Personel'}</h3>
              {editingEmployee && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <EmployeeForm
              employee={editingEmployee}
              onSave={saveEmployee}
              onCancel={editingEmployee ? () => {
                setEditingEmployee(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function EmployeeForm({
  employee,
  onSave,
  onCancel
}: {
  employee: Employee | null
  onSave: (values: EmployeeFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<EmployeeFormValues>(() => toFormValues(employee))

  React.useEffect(() => {
    setValues(toFormValues(employee))
  }, [employee])

  const updateField = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !employee) setValues(createEmptyValues())
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Ad Soyad</label>
        <input value={values.fullName} onChange={event => updateField('fullName', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Pozisyon</label>
        <select value={values.position} onChange={event => updateField('position', event.target.value as EmployeePosition)} required>
          {employeePositions.map(position => <option key={position} value={position}>{position}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Telefon</label>
        <input value={values.phone} onChange={event => updateField('phone', event.target.value)} />
      </div>
      <div className="form-field">
        <label>E-posta</label>
        <input type="email" value={values.email} onChange={event => updateField('email', event.target.value)} />
      </div>
      <div className="form-field">
        <label>İşe Giriş Tarihi</label>
        <input type="date" value={values.startDate} onChange={event => updateField('startDate', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Maaş</label>
        <input type="number" min="0" step="0.01" value={values.salary} onChange={event => updateField('salary', event.target.value)} />
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
