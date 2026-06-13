import React from 'react'
import { Employee, Shift, ShiftName, ShiftStatus, User } from '../types'
import { addActionLog, loadEmployees, loadShifts, saveShifts } from '../storage'

type Props = { currentUser: User }
type EmployeeFilter = string
type ShiftNameFilter = ShiftName | 'all'
type ShiftStatusFilter = ShiftStatus | 'all'

type ShiftFormValues = {
  employeeId: string
  shiftName: ShiftName
  workDate: string
  startTime: string
  endTime: string
  note: string
}

const shiftNames: ShiftName[] = ['Sabah', 'Akşam', 'Tam Gün', 'Gece']
const shiftStatuses: ShiftStatus[] = ['Planlandı', 'Tamamlandı', 'İptal']
const shiftTimeDefaults: Record<ShiftName, { startTime: string; endTime: string }> = {
  Sabah: { startTime: '08:00', endTime: '16:00' },
  Akşam: { startTime: '16:00', endTime: '00:00' },
  'Tam Gün': { startTime: '09:00', endTime: '18:00' },
  Gece: { startTime: '00:00', endTime: '08:00' }
}

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const createEmptyValues = (employees: Employee[]): ShiftFormValues => {
  const firstActiveEmployee = employees.find(employee => employee.isActive)

  return {
    employeeId: firstActiveEmployee?.id || '',
    shiftName: 'Sabah',
    workDate: getLocalDateKey(new Date()),
    startTime: shiftTimeDefaults.Sabah.startTime,
    endTime: shiftTimeDefaults.Sabah.endTime,
    note: ''
  }
}

const toFormValues = (shift: Shift | null, employees: Employee[]): ShiftFormValues => {
  if(!shift) return createEmptyValues(employees)

  return {
    employeeId: shift.employeeId,
    shiftName: shift.shiftName,
    workDate: shift.workDate,
    startTime: shift.startTime,
    endTime: shift.endTime,
    note: shift.note
  }
}

const timeToMinutes = (value: string) => {
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if(!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN
  return hour * 60 + minute
}

const getTimeRange = (startTime: string, endTime: string) => {
  const start = timeToMinutes(startTime)
  const rawEnd = timeToMinutes(endTime)
  const end = rawEnd <= start ? rawEnd + 1440 : rawEnd

  return { start, end }
}

const hasTimeOverlap = (first: Pick<Shift, 'startTime' | 'endTime'>, second: Pick<Shift, 'startTime' | 'endTime'>) => {
  const firstRange = getTimeRange(first.startTime, first.endTime)
  const secondRange = getTimeRange(second.startTime, second.endTime)

  if(!Number.isFinite(firstRange.start) || !Number.isFinite(firstRange.end)) return false
  if(!Number.isFinite(secondRange.start) || !Number.isFinite(secondRange.end)) return false

  return firstRange.start < secondRange.end && secondRange.start < firstRange.end
}

const findShiftConflict = ({
  shifts,
  employeeId,
  workDate,
  startTime,
  endTime,
  ignoreShiftId
}: {
  shifts: Shift[]
  employeeId: string
  workDate: string
  startTime: string
  endTime: string
  ignoreShiftId?: string
}) => {
  return shifts.find(shift => {
    if(shift.id === ignoreShiftId) return false
    if(shift.status === 'İptal') return false
    if(shift.employeeId !== employeeId) return false
    if(shift.workDate !== workDate) return false

    return hasTimeOverlap(shift, { startTime, endTime })
  })
}

const getEmployeeName = (employeeMap: Map<string, Employee>, employeeId: string) => {
  return employeeMap.get(employeeId)?.fullName || 'Personel bulunamadı'
}

const getStatusPillClass = (status: ShiftStatus) => {
  if(status === 'Tamamlandı') return 'success'
  if(status === 'İptal') return 'danger-pill'
  return 'warning-pill'
}

const sortShifts = (shifts: Shift[]) => {
  return [...shifts].sort((first, second) => {
    const dateDiff = second.workDate.localeCompare(first.workDate)
    if(dateDiff !== 0) return dateDiff
    return first.startTime.localeCompare(second.startTime)
  })
}

export default function ShiftManagement({ currentUser }: Props){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [shifts, setShifts] = React.useState<Shift[]>(() => loadShifts())
  const [editingShift, setEditingShift] = React.useState<Shift | null>(null)
  const [dateFilter, setDateFilter] = React.useState('')
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [shiftNameFilter, setShiftNameFilter] = React.useState<ShiftNameFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<ShiftStatusFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveShifts(shifts)
  }, [shifts])

  const employeeMap = React.useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const activeEmployees = React.useMemo(() => employees.filter(employee => employee.isActive), [employees])
  const visibleShifts = React.useMemo(() => {
    return sortShifts(shifts).filter(shift => {
      const matchesDate = !dateFilter || shift.workDate === dateFilter
      const matchesEmployee = employeeFilter === 'all' || shift.employeeId === employeeFilter
      const matchesShiftName = shiftNameFilter === 'all' || shift.shiftName === shiftNameFilter
      const matchesStatus = statusFilter === 'all' || shift.status === statusFilter

      return matchesDate && matchesEmployee && matchesShiftName && matchesStatus
    })
  }, [dateFilter, employeeFilter, shiftNameFilter, shifts, statusFilter])

  const today = getLocalDateKey(new Date())
  const totalShiftCount = shifts.length
  const todayShiftCount = shifts.filter(shift => shift.workDate === today).length
  const completedShiftCount = shifts.filter(shift => shift.status === 'Tamamlandı').length

  const startEdit = (shift: Shift) => {
    setEditingShift(shift)
    setFormError('')
  }

  const saveShift = (values: ShiftFormValues) => {
    if(!values.employeeId){
      setFormError('Personel seçimi zorunludur.')
      return false
    }

    if(!values.workDate){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!values.startTime){
      setFormError('Başlangıç saati zorunludur.')
      return false
    }

    if(!values.endTime){
      setFormError('Bitiş saati zorunludur.')
      return false
    }

    const conflict = findShiftConflict({
      shifts,
      employeeId: values.employeeId,
      workDate: values.workDate,
      startTime: values.startTime,
      endTime: values.endTime,
      ignoreShiftId: editingShift?.id
    })

    if(conflict){
      setFormError(`${getEmployeeName(employeeMap, values.employeeId)} için ${values.workDate} tarihinde ${conflict.startTime}-${conflict.endTime} aralığıyla çakışan vardiya var.`)
      return false
    }

    const now = new Date().toISOString()
    const employeeName = getEmployeeName(employeeMap, values.employeeId)

    if(editingShift){
      const updatedShift: Shift = {
        ...editingShift,
        employeeId: values.employeeId,
        shiftName: values.shiftName,
        workDate: values.workDate,
        startTime: values.startTime,
        endTime: values.endTime,
        note: values.note.trim(),
        updatedAt: now
      }

      setShifts(prev => prev.map(shift => shift.id === editingShift.id ? updatedShift : shift))
      setEditingShift(null)
      setFormError('')
      addActionLog({
        operationType: 'Vardiya güncellendi',
        user: currentUser,
        description: `${employeeName} için ${updatedShift.workDate} ${updatedShift.startTime}-${updatedShift.endTime} vardiyası güncellendi.`
      })
      return true
    }

    const shift: Shift = {
      id: createId('shift'),
      employeeId: values.employeeId,
      shiftName: values.shiftName,
      workDate: values.workDate,
      startTime: values.startTime,
      endTime: values.endTime,
      status: 'Planlandı',
      note: values.note.trim(),
      createdAt: now,
      updatedAt: now
    }

    setShifts(prev => [shift, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Vardiya oluşturuldu',
      user: currentUser,
      description: `${employeeName} için ${shift.workDate} ${shift.startTime}-${shift.endTime} ${shift.shiftName} vardiyası oluşturuldu.`
    })
    return true
  }

  const updateShiftStatus = (shift: Shift, status: ShiftStatus) => {
    if(shift.status === status) return

    const updatedShift: Shift = {
      ...shift,
      status,
      updatedAt: new Date().toISOString()
    }

    setShifts(prev => prev.map(item => item.id === shift.id ? updatedShift : item))
    if(editingShift?.id === shift.id) setEditingShift(updatedShift)

    addActionLog({
      operationType: status === 'Tamamlandı' ? 'Vardiya tamamlandı' : 'Vardiya iptal edildi',
      user: currentUser,
      description: `${getEmployeeName(employeeMap, shift.employeeId)} için ${shift.workDate} ${shift.startTime}-${shift.endTime} vardiyası ${status.toLocaleLowerCase('tr-TR')}.`
    })
  }

  const deleteShift = (shift: Shift) => {
    if(!confirm(`${getEmployeeName(employeeMap, shift.employeeId)} vardiyası silinecek. Emin misiniz?`)) return

    setShifts(prev => prev.filter(item => item.id !== shift.id))
    if(editingShift?.id === shift.id) setEditingShift(null)
    addActionLog({
      operationType: 'Vardiya silindi',
      user: currentUser,
      description: `${getEmployeeName(employeeMap, shift.employeeId)} için ${shift.workDate} ${shift.startTime}-${shift.endTime} vardiyası silindi.`
    })
  }

  return (
    <div className="shift-management-page">
      <div className="page-title">
        <div>
          <h2>Vardiya Yönetimi</h2>
          <p className="muted">Personel vardiyalarını planlayın ve takip edin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Vardiya</span>
          <strong>{totalShiftCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Vardiya</span>
          <strong>{todayShiftCount}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Personel</span>
          <strong>{activeEmployees.length}</strong>
        </div>
        <div className="metric-card">
          <span>Tamamlanan Vardiya</span>
          <strong>{completedShiftCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Vardiya Listesi</h3>
              <p className="muted">{visibleShifts.length} vardiya gösteriliyor.</p>
            </div>
            <div className="toolbar-controls shift-filters">
              <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
              <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
                <option value="all">Tüm personeller</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
              <select value={shiftNameFilter} onChange={event => setShiftNameFilter(event.target.value as ShiftNameFilter)}>
                <option value="all">Tüm vardiyalar</option>
                {shiftNames.map(shiftName => <option key={shiftName} value={shiftName}>{shiftName}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as ShiftStatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {shiftStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table shift-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Personel</th>
                  <th>Vardiya</th>
                  <th>Başlangıç</th>
                  <th>Bitiş</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleShifts.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun vardiya bulunamadı.</td></tr>
                )}
                {visibleShifts.map(shift => (
                  <tr key={shift.id}>
                    <td>{shift.workDate}</td>
                    <td>
                      <strong>{getEmployeeName(employeeMap, shift.employeeId)}</strong>
                      {shift.note && <div className="muted small-text">{shift.note}</div>}
                    </td>
                    <td>{shift.shiftName}</td>
                    <td>{shift.startTime}</td>
                    <td>{shift.endTime}</td>
                    <td>
                      <span className={`status-pill ${getStatusPillClass(shift.status)}`}>
                        {shift.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(shift)}>Düzenle</button>
                      <button
                        className="btn"
                        type="button"
                        disabled={shift.status === 'Tamamlandı'}
                        onClick={() => updateShiftStatus(shift, 'Tamamlandı')}
                      >
                        Tamamlandı Yap
                      </button>
                      <button
                        className="btn"
                        type="button"
                        disabled={shift.status === 'İptal'}
                        onClick={() => updateShiftStatus(shift, 'İptal')}
                      >
                        İptal Et
                      </button>
                      <button className="btn" type="button" onClick={() => deleteShift(shift)}>Sil</button>
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
              <h3>{editingShift ? 'Vardiya Düzenle' : 'Yeni Vardiya'}</h3>
              {editingShift && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <ShiftForm
              employees={activeEmployees}
              shift={editingShift}
              onSave={saveShift}
              onCancel={editingShift ? () => {
                setEditingShift(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function ShiftForm({
  employees,
  shift,
  onSave,
  onCancel
}: {
  employees: Employee[]
  shift: Shift | null
  onSave: (values: ShiftFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<ShiftFormValues>(() => toFormValues(shift, employees))

  React.useEffect(() => {
    setValues(toFormValues(shift, employees))
  }, [employees, shift])

  const updateField = <K extends keyof ShiftFormValues>(key: K, value: ShiftFormValues[K]) => {
    setValues(prev => {
      if(key === 'shiftName'){
        const shiftName = value as ShiftName
        return {
          ...prev,
          shiftName,
          ...shiftTimeDefaults[shiftName]
        }
      }

      return { ...prev, [key]: value }
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !shift) setValues(createEmptyValues(employees))
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
        <label>Vardiya Türü</label>
        <select value={values.shiftName} onChange={event => updateField('shiftName', event.target.value as ShiftName)} required>
          {shiftNames.map(shiftName => <option key={shiftName} value={shiftName}>{shiftName}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tarih</label>
        <input type="date" value={values.workDate} onChange={event => updateField('workDate', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Başlangıç Saati</label>
        <input type="time" value={values.startTime} onChange={event => updateField('startTime', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Bitiş Saati</label>
        <input type="time" value={values.endTime} onChange={event => updateField('endTime', event.target.value)} required />
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
