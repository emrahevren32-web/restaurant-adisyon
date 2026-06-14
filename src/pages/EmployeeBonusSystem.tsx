import React from 'react'
import { Attendance, Employee, EmployeeBonus, EmployeeBonusStatus, EmployeePerformance, User } from '../types'
import {
  addActionLog,
  loadAttendances,
  loadEmployeeBonuses,
  loadEmployeePerformances,
  loadEmployees,
  saveEmployeeBonuses
} from '../storage'

type Props = { currentUser: User }
type EmployeeFilter = string
type BonusStatusFilter = EmployeeBonusStatus | 'all'

type BonusFormValues = {
  employeeId: string
  period: string
  performanceScore: string
  bonusRate: string
  note: string
}

type AttendancePeriodSummary = {
  recordCount: number
  overtimeMinutes: number
}

const bonusStatuses: EmployeeBonusStatus[] = ['Hesaplandı', 'Onaylandı', 'Ödendi', 'İptal']
const defaultBonusRate = 5

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getCurrentPeriod = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)

const normalizeNumberInput = (value: string) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0
}

const normalizeScoreInput = (value: string) => {
  return Math.round(normalizeNumberInput(value))
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const calculateBonusAmount = (performanceScore: number, bonusRate: number) => {
  return roundMoney(Math.max(0, performanceScore) * Math.max(0, bonusRate))
}

const formatMoney = (value: number) => {
  return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
}

const formatScore = (value: number) => {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('tr-TR') : '0'
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

const getStatusPillClass = (status: EmployeeBonusStatus) => {
  if(status === 'Ödendi') return 'success'
  if(status === 'Onaylandı') return 'info-pill'
  if(status === 'İptal') return 'danger-pill'
  return 'warning-pill'
}

const getSuggestedPerformanceScore = (performances: EmployeePerformance[], employeeId: string, period: string) => {
  return performances
    .filter(performance => performance.employeeId === employeeId && performance.workDate.startsWith(period))
    .reduce((sum, performance) => sum + performance.performanceScore, 0)
}

const getAttendancePeriodSummary = (attendances: Attendance[], employeeId: string, period: string): AttendancePeriodSummary => {
  return attendances
    .filter(attendance => attendance.employeeId === employeeId && attendance.workDate.startsWith(period))
    .reduce<AttendancePeriodSummary>((summary, attendance) => ({
      recordCount: summary.recordCount + 1,
      overtimeMinutes: summary.overtimeMinutes + attendance.overtimeMinutes
    }), { recordCount: 0, overtimeMinutes: 0 })
}

const createEmptyValues = (employees: Employee[], performances: EmployeePerformance[]): BonusFormValues => {
  const firstActiveEmployee = employees.find(employee => employee.isActive)
  const period = getCurrentPeriod()
  const employeeId = firstActiveEmployee?.id || ''

  return {
    employeeId,
    period,
    performanceScore: String(getSuggestedPerformanceScore(performances, employeeId, period)),
    bonusRate: String(defaultBonusRate),
    note: ''
  }
}

const toFormValues = (bonus: EmployeeBonus | null, employees: Employee[], performances: EmployeePerformance[]): BonusFormValues => {
  if(!bonus) return createEmptyValues(employees, performances)

  return {
    employeeId: bonus.employeeId,
    period: bonus.period,
    performanceScore: String(bonus.performanceScore),
    bonusRate: String(bonus.bonusRate),
    note: bonus.note
  }
}

const sortBonuses = (bonuses: EmployeeBonus[]) => {
  return [...bonuses].sort((first, second) => {
    const periodDiff = second.period.localeCompare(first.period)
    if(periodDiff !== 0) return periodDiff
    return second.bonusAmount - first.bonusAmount
  })
}

export default function EmployeeBonusSystem({ currentUser }: Props){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [performances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [attendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [bonuses, setBonuses] = React.useState<EmployeeBonus[]>(() => loadEmployeeBonuses())
  const [editingBonus, setEditingBonus] = React.useState<EmployeeBonus | null>(null)
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [periodFilter, setPeriodFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<BonusStatusFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveEmployeeBonuses(bonuses)
  }, [bonuses])

  const employeeMap = React.useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const activeEmployees = React.useMemo(() => employees.filter(employee => employee.isActive), [employees])
  const currentPeriod = getCurrentPeriod()

  const visibleBonuses = React.useMemo(() => {
    return sortBonuses(bonuses).filter(bonus => {
      const matchesEmployee = employeeFilter === 'all' || bonus.employeeId === employeeFilter
      const matchesPeriod = !periodFilter || bonus.period === periodFilter
      const matchesStatus = statusFilter === 'all' || bonus.status === statusFilter

      return matchesEmployee && matchesPeriod && matchesStatus
    })
  }, [bonuses, employeeFilter, periodFilter, statusFilter])

  const totalBonus = bonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0)
  const thisMonthBonus = bonuses
    .filter(bonus => bonus.period === currentPeriod)
    .reduce((sum, bonus) => sum + bonus.bonusAmount, 0)
  const bonusEmployeeCount = new Set(bonuses.filter(bonus => bonus.bonusAmount > 0).map(bonus => bonus.employeeId)).size
  const averageBonus = bonuses.length > 0 ? roundMoney(totalBonus / bonuses.length) : 0
  const highestBonus = bonuses.reduce((highest, bonus) => Math.max(highest, bonus.bonusAmount), 0)
  const paidBonus = bonuses
    .filter(bonus => bonus.status === 'Ödendi')
    .reduce((sum, bonus) => sum + bonus.bonusAmount, 0)
  const pendingBonus = bonuses
    .filter(bonus => bonus.status === 'Hesaplandı' || bonus.status === 'Onaylandı')
    .reduce((sum, bonus) => sum + bonus.bonusAmount, 0)

  const startEdit = (bonus: EmployeeBonus) => {
    setEditingBonus(bonus)
    setFormError('')
  }

  const saveBonus = (values: BonusFormValues) => {
    if(!values.employeeId){
      setFormError('Personel seçimi zorunludur.')
      return false
    }

    if(!values.period){
      setFormError('Dönem zorunludur.')
      return false
    }

    const bonusRate = normalizeNumberInput(values.bonusRate)
    if(bonusRate <= 0){
      setFormError('Prim katsayısı 0’dan büyük olmalıdır.')
      return false
    }

    const performanceScore = normalizeScoreInput(values.performanceScore)
    const bonusAmount = calculateBonusAmount(performanceScore, bonusRate)
    const now = new Date().toISOString()
    const employeeName = getEmployeeName(employeeMap, values.employeeId)

    if(editingBonus){
      const updatedBonus: EmployeeBonus = {
        ...editingBonus,
        employeeId: values.employeeId,
        period: values.period,
        performanceScore,
        bonusRate,
        bonusAmount,
        note: values.note.trim(),
        updatedAt: now
      }

      setBonuses(prev => prev.map(bonus => bonus.id === editingBonus.id ? updatedBonus : bonus))
      setEditingBonus(null)
      setFormError('')
      addActionLog({
        operationType: 'Prim güncellendi',
        user: currentUser,
        description: `${employeeName} için ${updatedBonus.period} dönemi primi güncellendi. Tutar: ${formatMoney(updatedBonus.bonusAmount)}.`
      })
      return true
    }

    const bonus: EmployeeBonus = {
      id: createId('employee_bonus'),
      employeeId: values.employeeId,
      period: values.period,
      performanceScore,
      bonusRate,
      bonusAmount,
      status: 'Hesaplandı',
      note: values.note.trim(),
      createdAt: now,
      updatedAt: now
    }

    setBonuses(prev => [bonus, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Prim oluşturuldu',
      user: currentUser,
      description: `${employeeName} için ${bonus.period} dönemi primi oluşturuldu. Skor: ${bonus.performanceScore}. Katsayı: ${bonus.bonusRate}. Tutar: ${formatMoney(bonus.bonusAmount)}.`
    })
    return true
  }

  const updateBonusStatus = (bonus: EmployeeBonus, status: EmployeeBonusStatus) => {
    if(bonus.status === status) return

    const updatedBonus: EmployeeBonus = {
      ...bonus,
      status,
      updatedAt: new Date().toISOString()
    }

    setBonuses(prev => prev.map(item => item.id === bonus.id ? updatedBonus : item))
    if(editingBonus?.id === bonus.id) setEditingBonus(updatedBonus)

    const operationType = status === 'Onaylandı'
      ? 'Prim onaylandı'
      : status === 'Ödendi'
        ? 'Prim ödendi'
        : 'Prim iptal edildi'

    addActionLog({
      operationType,
      user: currentUser,
      description: `${getEmployeeName(employeeMap, bonus.employeeId)} için ${bonus.period} dönemi primi ${status.toLocaleLowerCase('tr-TR')}. Tutar: ${formatMoney(bonus.bonusAmount)}.`
    })
  }

  const deleteBonus = (bonus: EmployeeBonus) => {
    const employeeName = getEmployeeName(employeeMap, bonus.employeeId)
    if(!confirm(`${employeeName} için ${bonus.period} dönemi primi silinecek. Emin misiniz?`)) return

    setBonuses(prev => prev.filter(item => item.id !== bonus.id))
    if(editingBonus?.id === bonus.id) setEditingBonus(null)
    addActionLog({
      operationType: 'Prim silindi',
      user: currentUser,
      description: `${employeeName} için ${bonus.period} dönemi primi silindi.`
    })
  }

  return (
    <div className="employee-bonus-page">
      <div className="page-title">
        <div>
          <h2>Prim Sistemi</h2>
          <p className="muted">Personel prim hesaplarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Prim</span>
          <strong>{formatMoney(totalBonus)}</strong>
        </div>
        <div className="metric-card">
          <span>Bu Ay Prim</span>
          <strong>{formatMoney(thisMonthBonus)}</strong>
        </div>
        <div className="metric-card">
          <span>Prim Alan Personel</span>
          <strong>{bonusEmployeeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Ortalama Prim</span>
          <strong>{formatMoney(averageBonus)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>En Yüksek Prim</span>
          <strong>{formatMoney(highestBonus)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Ödenen Prim</span>
          <strong>{formatMoney(paidBonus)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bekleyen Prim</span>
          <strong>{formatMoney(pendingBonus)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Prim Havuzu</span>
          <strong>{formatMoney(totalBonus)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Prim Listesi</h3>
              <p className="muted">{visibleBonuses.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls employee-bonus-filters">
              <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
                <option value="all">Tüm personeller</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
              <input type="month" value={periodFilter} onChange={event => setPeriodFilter(event.target.value)} />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as BonusStatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {bonusStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table employee-bonus-table">
              <thead>
                <tr>
                  <th>Dönem</th>
                  <th>Personel</th>
                  <th>Performans</th>
                  <th>Prim Katsayısı</th>
                  <th>Prim Tutarı</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleBonuses.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun prim kaydı bulunamadı.</td></tr>
                )}
                {visibleBonuses.map(bonus => {
                  const attendanceSummary = getAttendancePeriodSummary(attendances, bonus.employeeId, bonus.period)

                  return (
                    <tr key={bonus.id}>
                      <td>{bonus.period}</td>
                      <td>
                        <strong>{getEmployeeName(employeeMap, bonus.employeeId)}</strong>
                        <div className="muted small-text">
                          {attendanceSummary.recordCount} puantaj / {formatMinutes(attendanceSummary.overtimeMinutes)} mesai
                        </div>
                        {bonus.note && <div className="muted small-text">{bonus.note}</div>}
                      </td>
                      <td>{formatScore(bonus.performanceScore)}</td>
                      <td>{formatMoney(bonus.bonusRate)}</td>
                      <td><strong>{formatMoney(bonus.bonusAmount)}</strong></td>
                      <td>
                        <span className={`status-pill ${getStatusPillClass(bonus.status)}`}>
                          {bonus.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEdit(bonus)}>Düzenle</button>
                        <button
                          className="btn"
                          type="button"
                          disabled={bonus.status === 'Onaylandı'}
                          onClick={() => updateBonusStatus(bonus, 'Onaylandı')}
                        >
                          Onayla
                        </button>
                        <button
                          className="btn"
                          type="button"
                          disabled={bonus.status === 'Ödendi'}
                          onClick={() => updateBonusStatus(bonus, 'Ödendi')}
                        >
                          Ödendi Yap
                        </button>
                        <button
                          className="btn"
                          type="button"
                          disabled={bonus.status === 'İptal'}
                          onClick={() => updateBonusStatus(bonus, 'İptal')}
                        >
                          İptal Et
                        </button>
                        <button className="btn" type="button" onClick={() => deleteBonus(bonus)}>Sil</button>
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
              <h3>{editingBonus ? 'Prim Düzenle' : 'Yeni Prim Kaydı'}</h3>
              {editingBonus && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <BonusForm
              employees={activeEmployees}
              performances={performances}
              attendances={attendances}
              bonus={editingBonus}
              onSave={saveBonus}
              onCancel={editingBonus ? () => {
                setEditingBonus(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function BonusForm({
  employees,
  performances,
  attendances,
  bonus,
  onSave,
  onCancel
}: {
  employees: Employee[]
  performances: EmployeePerformance[]
  attendances: Attendance[]
  bonus: EmployeeBonus | null
  onSave: (values: BonusFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<BonusFormValues>(() => toFormValues(bonus, employees, performances))

  React.useEffect(() => {
    setValues(toFormValues(bonus, employees, performances))
  }, [bonus, employees, performances])

  const performanceScore = normalizeScoreInput(values.performanceScore)
  const bonusRate = normalizeNumberInput(values.bonusRate)
  const previewAmount = calculateBonusAmount(performanceScore, bonusRate)
  const attendanceSummary = getAttendancePeriodSummary(attendances, values.employeeId, values.period)

  const updateField = <K extends keyof BonusFormValues>(key: K, value: BonusFormValues[K]) => {
    setValues(prev => {
      const next = { ...prev, [key]: value }

      if(!bonus && (key === 'employeeId' || key === 'period')){
        const nextEmployeeId = key === 'employeeId' ? String(value) : next.employeeId
        const nextPeriod = key === 'period' ? String(value) : next.period
        next.performanceScore = String(getSuggestedPerformanceScore(performances, nextEmployeeId, nextPeriod))
      }

      return next
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !bonus) setValues(createEmptyValues(employees, performances))
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
        <label>Dönem</label>
        <input type="month" value={values.period} onChange={event => updateField('period', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Performans Puanı</label>
        <input type="number" min="0" step="1" value={values.performanceScore} onChange={event => updateField('performanceScore', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Prim Katsayısı</label>
        <input type="number" min="0.01" step="0.01" value={values.bonusRate} onChange={event => updateField('bonusRate', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Prim Tutarı</label>
        <input value={formatMoney(previewAmount)} readOnly />
      </div>
      <div className="bonus-context-box">
        <span>Puantaj</span>
        <strong>{attendanceSummary.recordCount} kayıt</strong>
        <span>Mesai</span>
        <strong>{formatMinutes(attendanceSummary.overtimeMinutes)}</strong>
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
