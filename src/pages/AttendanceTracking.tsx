import React from 'react'
import { Attendance, AttendanceStatus, Employee, Shift, User } from '../types'
import { addActionLog, loadAttendances, loadEmployees, loadShifts, saveAttendances } from '../storage'

type Props = { currentUser: User }
type EmployeeFilter = string
type AttendanceStatusFilter = AttendanceStatus | 'all'

type AttendanceFormValues = {
  employeeId: string
  workDate: string
  checkInTime: string
  checkOutTime: string
  note: string
}

type AttendanceCalculation = {
  workedMinutes: number
  overtimeMinutes: number
  status: AttendanceStatus
}

const attendanceStatuses: AttendanceStatus[] = ['Normal', 'Eksik Mesai', 'Fazla Mesai', 'Devamsız']

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const createEmptyValues = (employees: Employee[]): AttendanceFormValues => {
  const firstActiveEmployee = employees.find(employee => employee.isActive)

  return {
    employeeId: firstActiveEmployee?.id || '',
    workDate: getLocalDateKey(new Date()),
    checkInTime: '',
    checkOutTime: '',
    note: ''
  }
}

const toFormValues = (attendance: Attendance | null, employees: Employee[]): AttendanceFormValues => {
  if(!attendance) return createEmptyValues(employees)

  return {
    employeeId: attendance.employeeId,
    workDate: attendance.workDate,
    checkInTime: attendance.checkInTime,
    checkOutTime: attendance.checkOutTime,
    note: attendance.note
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

const isOvernightShift = (shift?: Shift) => {
  if(!shift) return false
  const start = timeToMinutes(shift.startTime)
  const end = timeToMinutes(shift.endTime)
  return Number.isFinite(start) && Number.isFinite(end) && end <= start
}

const findPlannedShift = (shifts: Shift[], employeeId: string, workDate: string) => {
  return [...shifts]
    .filter(shift => shift.status !== 'İptal' && shift.employeeId === employeeId && shift.workDate === workDate)
    .sort((first, second) => first.startTime.localeCompare(second.startTime))[0]
}

const getPlannedMinutes = (shift?: Shift) => {
  if(!shift) return 0
  const range = getTimeRange(shift.startTime, shift.endTime)
  if(!Number.isFinite(range.start) || !Number.isFinite(range.end)) return 0
  return Math.max(0, range.end - range.start)
}

const getWorkedMinutes = (checkInTime: string, checkOutTime: string, allowOvernight: boolean) => {
  const start = timeToMinutes(checkInTime)
  const rawEnd = timeToMinutes(checkOutTime)
  if(!Number.isFinite(start) || !Number.isFinite(rawEnd)) return 0

  const end = allowOvernight && rawEnd < start ? rawEnd + 1440 : rawEnd
  return Math.max(0, end - start)
}

const calculateAttendance = (values: AttendanceFormValues, shifts: Shift[]): AttendanceCalculation => {
  const plannedShift = findPlannedShift(shifts, values.employeeId, values.workDate)
  const hasCheckIn = Boolean(values.checkInTime)
  const hasCheckOut = Boolean(values.checkOutTime)

  if(!hasCheckIn && !hasCheckOut){
    return { workedMinutes: 0, overtimeMinutes: 0, status: 'Devamsız' }
  }

  const workedMinutes = getWorkedMinutes(values.checkInTime, values.checkOutTime, isOvernightShift(plannedShift))
  const plannedMinutes = getPlannedMinutes(plannedShift)

  if(plannedMinutes <= 0){
    return { workedMinutes, overtimeMinutes: 0, status: 'Normal' }
  }

  if(workedMinutes === plannedMinutes){
    return { workedMinutes, overtimeMinutes: 0, status: 'Normal' }
  }

  if(workedMinutes < plannedMinutes){
    return { workedMinutes, overtimeMinutes: 0, status: 'Eksik Mesai' }
  }

  return {
    workedMinutes,
    overtimeMinutes: workedMinutes - plannedMinutes,
    status: 'Fazla Mesai'
  }
}

const formatMinutes = (value: number) => {
  if(value <= 0) return '0 dk'
  const hours = Math.floor(value / 60)
  const minutes = value % 60

  if(hours === 0) return `${minutes} dk`
  if(minutes === 0) return `${hours} sa`
  return `${hours} sa ${minutes} dk`
}

const getEmployeeName = (employeeMap: Map<string, Employee>, employeeId: string) => {
  return employeeMap.get(employeeId)?.fullName || 'Personel bulunamadı'
}

const getStatusPillClass = (status: AttendanceStatus) => {
  if(status === 'Normal') return 'success'
  if(status === 'Fazla Mesai') return 'info-pill'
  if(status === 'Eksik Mesai') return 'warning-pill'
  return 'danger-pill'
}

const sortAttendances = (items: Attendance[]) => {
  return [...items].sort((first, second) => {
    const dateDiff = second.workDate.localeCompare(first.workDate)
    if(dateDiff !== 0) return dateDiff
    return first.checkInTime.localeCompare(second.checkInTime)
  })
}

export default function AttendanceTracking({ currentUser }: Props){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [shifts] = React.useState<Shift[]>(() => loadShifts())
  const [attendances, setAttendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [editingAttendance, setEditingAttendance] = React.useState<Attendance | null>(null)
  const [dateFilter, setDateFilter] = React.useState('')
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<AttendanceStatusFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveAttendances(attendances)
  }, [attendances])

  const employeeMap = React.useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const activeEmployees = React.useMemo(() => employees.filter(employee => employee.isActive), [employees])
  const today = getLocalDateKey(new Date())

  const visibleAttendances = React.useMemo(() => {
    return sortAttendances(attendances).filter(attendance => {
      const matchesDate = !dateFilter || attendance.workDate === dateFilter
      const matchesEmployee = employeeFilter === 'all' || attendance.employeeId === employeeFilter
      const matchesStatus = statusFilter === 'all' || attendance.status === statusFilter

      return matchesDate && matchesEmployee && matchesStatus
    })
  }, [attendances, dateFilter, employeeFilter, statusFilter])

  const todayPersonCount = new Set(attendances.filter(item => item.workDate === today).map(item => item.employeeId)).size
  const totalOvertimeMinutes = attendances.reduce((sum, item) => sum + item.overtimeMinutes, 0)
  const absentCount = attendances.filter(item => item.status === 'Devamsız').length
  const normalCount = attendances.filter(item => item.status === 'Normal').length
  const shortCount = attendances.filter(item => item.status === 'Eksik Mesai').length
  const overtimeCount = attendances.filter(item => item.status === 'Fazla Mesai').length
  const totalWorkedMinutes = attendances.reduce((sum, item) => sum + item.workedMinutes, 0)

  const startEdit = (attendance: Attendance) => {
    setEditingAttendance(attendance)
    setFormError('')
  }

  const saveAttendance = (values: AttendanceFormValues) => {
    if(!values.employeeId){
      setFormError('Personel seçimi zorunludur.')
      return false
    }

    if(!values.workDate){
      setFormError('Tarih zorunludur.')
      return false
    }

    const hasCheckIn = Boolean(values.checkInTime)
    const hasCheckOut = Boolean(values.checkOutTime)
    if(hasCheckIn !== hasCheckOut){
      setFormError('Giriş ve çıkış saatleri birlikte girilmelidir.')
      return false
    }

    const plannedShift = findPlannedShift(shifts, values.employeeId, values.workDate)
    if(hasCheckIn && hasCheckOut){
      const start = timeToMinutes(values.checkInTime)
      const end = timeToMinutes(values.checkOutTime)
      if(!Number.isFinite(start) || !Number.isFinite(end)){
        setFormError('Giriş ve çıkış saatleri geçerli olmalıdır.')
        return false
      }

      if(end < start && !isOvernightShift(plannedShift)){
        setFormError('Çıkış saati giriş saatinden önce olamaz.')
        return false
      }
    }

    const duplicate = attendances.find(attendance => {
      if(attendance.id === editingAttendance?.id) return false
      return attendance.employeeId === values.employeeId && attendance.workDate === values.workDate
    })

    if(duplicate){
      setFormError(`${getEmployeeName(employeeMap, values.employeeId)} için ${values.workDate} tarihinde zaten puantaj kaydı var.`)
      return false
    }

    const now = new Date().toISOString()
    const employeeName = getEmployeeName(employeeMap, values.employeeId)
    const calculation = calculateAttendance(values, shifts)

    if(editingAttendance){
      const updatedAttendance: Attendance = {
        ...editingAttendance,
        employeeId: values.employeeId,
        workDate: values.workDate,
        checkInTime: values.checkInTime,
        checkOutTime: values.checkOutTime,
        workedMinutes: calculation.workedMinutes,
        overtimeMinutes: calculation.overtimeMinutes,
        status: calculation.status,
        note: values.note.trim(),
        updatedAt: now
      }

      setAttendances(prev => prev.map(attendance => attendance.id === editingAttendance.id ? updatedAttendance : attendance))
      setEditingAttendance(null)
      setFormError('')
      addActionLog({
        operationType: 'Puantaj güncellendi',
        user: currentUser,
        description: `${employeeName} için ${updatedAttendance.workDate} tarihli puantaj kaydı güncellendi. Çalışma: ${formatMinutes(updatedAttendance.workedMinutes)}. Durum: ${updatedAttendance.status}.`
      })
      return true
    }

    const attendance: Attendance = {
      id: createId('attendance'),
      employeeId: values.employeeId,
      workDate: values.workDate,
      checkInTime: values.checkInTime,
      checkOutTime: values.checkOutTime,
      workedMinutes: calculation.workedMinutes,
      overtimeMinutes: calculation.overtimeMinutes,
      status: calculation.status,
      note: values.note.trim(),
      createdAt: now,
      updatedAt: now
    }

    setAttendances(prev => [attendance, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Puantaj oluşturuldu',
      user: currentUser,
      description: `${employeeName} için ${attendance.workDate} tarihli puantaj kaydı oluşturuldu. Çalışma: ${formatMinutes(attendance.workedMinutes)}. Mesai: ${formatMinutes(attendance.overtimeMinutes)}.`
    })
    return true
  }

  const deleteAttendance = (attendance: Attendance) => {
    const employeeName = getEmployeeName(employeeMap, attendance.employeeId)
    if(!confirm(`${employeeName} için ${attendance.workDate} tarihli puantaj kaydı silinecek. Emin misiniz?`)) return

    setAttendances(prev => prev.filter(item => item.id !== attendance.id))
    if(editingAttendance?.id === attendance.id) setEditingAttendance(null)
    addActionLog({
      operationType: 'Puantaj silindi',
      user: currentUser,
      description: `${employeeName} için ${attendance.workDate} tarihli puantaj kaydı silindi.`
    })
  }

  return (
    <div className="attendance-tracking-page">
      <div className="page-title">
        <div>
          <h2>Puantaj ve Mesai Takibi</h2>
          <p className="muted">Personel çalışma sürelerini ve mesai bilgilerini yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Kayıt</span>
          <strong>{attendances.length}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Personel</span>
          <strong>{todayPersonCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Mesai</span>
          <strong>{formatMinutes(totalOvertimeMinutes)}</strong>
        </div>
        <div className="metric-card">
          <span>Devamsız Sayısı</span>
          <strong>{absentCount}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Normal Çalışma</span>
          <strong>{normalCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Eksik Mesai</span>
          <strong>{shortCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Fazla Mesai</span>
          <strong>{overtimeCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Çalışma Süresi</span>
          <strong>{formatMinutes(totalWorkedMinutes)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Puantaj Listesi</h3>
              <p className="muted">{visibleAttendances.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls attendance-filters">
              <input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
              <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
                <option value="all">Tüm personeller</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as AttendanceStatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {attendanceStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table attendance-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Personel</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Çalışma Süresi</th>
                  <th>Mesai</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleAttendances.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun puantaj kaydı bulunamadı.</td></tr>
                )}
                {visibleAttendances.map(attendance => (
                  <tr key={attendance.id}>
                    <td>{attendance.workDate}</td>
                    <td>
                      <strong>{getEmployeeName(employeeMap, attendance.employeeId)}</strong>
                      {attendance.note && <div className="muted small-text">{attendance.note}</div>}
                    </td>
                    <td>{attendance.checkInTime || '-'}</td>
                    <td>{attendance.checkOutTime || '-'}</td>
                    <td>{formatMinutes(attendance.workedMinutes)}</td>
                    <td>{formatMinutes(attendance.overtimeMinutes)}</td>
                    <td>
                      <span className={`status-pill ${getStatusPillClass(attendance.status)}`}>
                        {attendance.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(attendance)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => deleteAttendance(attendance)}>Sil</button>
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
              <h3>{editingAttendance ? 'Puantaj Düzenle' : 'Yeni Puantaj Kaydı'}</h3>
              {editingAttendance && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <AttendanceForm
              employees={activeEmployees}
              attendance={editingAttendance}
              onSave={saveAttendance}
              onCancel={editingAttendance ? () => {
                setEditingAttendance(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function AttendanceForm({
  employees,
  attendance,
  onSave,
  onCancel
}: {
  employees: Employee[]
  attendance: Attendance | null
  onSave: (values: AttendanceFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<AttendanceFormValues>(() => toFormValues(attendance, employees))

  React.useEffect(() => {
    setValues(toFormValues(attendance, employees))
  }, [attendance, employees])

  const updateField = <K extends keyof AttendanceFormValues>(key: K, value: AttendanceFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !attendance) setValues(createEmptyValues(employees))
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
        <label>Giriş Saati</label>
        <input type="time" value={values.checkInTime} onChange={event => updateField('checkInTime', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Çıkış Saati</label>
        <input type="time" value={values.checkOutTime} onChange={event => updateField('checkOutTime', event.target.value)} />
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
