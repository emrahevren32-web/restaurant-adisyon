import React from 'react'
import { Attendance, Employee, EmployeeAudit, EmployeeBonus, EmployeePerformance, Shift } from '../types'
import {
  loadAttendances,
  loadEmployeeAudits,
  loadEmployeeBonuses,
  loadEmployeePerformances,
  loadEmployees,
  loadShifts
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'
type EmployeeFilter = string

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type SummaryItem = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}

type PersonnelPerformanceRow = {
  employee: Employee
  shiftCount: number
  attendanceRecordCount: number
  workDayCount: number
  workedMinutes: number
  overtimeMinutes: number
  absenceCount: number
  servedTableCount: number
  approvedOrderCount: number
  qrOrderCount: number
  customerCallCount: number
  performanceScore: number
  performanceRecordCount: number
  averagePerformance: number
  bonusAmount: number
  bonusCount: number
  averageBonus: number
  auditCount: number
  warningCount: number
  reportCount: number
  rewardCount: number
  criticalAuditCount: number
  highSeverityWarningCount: number
}

type RiskListItem = {
  id: string
  title: string
  detail: string
  value: React.ReactNode
}

const LOW_PERFORMANCE_THRESHOLD = 50
const HIGH_WARNING_THRESHOLD = 2

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getWeekStart = (today: Date) => {
  const date = new Date(today)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return getLocalDateKey(date)
}

const getMonthStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
}

const getYearStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), 0, 1))
}

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const isPeriodInRange = (period: string, startDate: string, endDate: string) => {
  const normalizedPeriod = period.slice(0, 7)
  const startPeriod = startDate ? startDate.slice(0, 7) : ''
  const endPeriod = endDate ? endDate.slice(0, 7) : ''

  if(startPeriod && normalizedPeriod < startPeriod) return false
  if(endPeriod && normalizedPeriod > endPeriod) return false
  return true
}

const getRangeDates = ({
  mode,
  customStartDate,
  customEndDate,
  today
}: {
  mode: DateRangeMode
  customStartDate: string
  customEndDate: string
  today: Date
}) => {
  const todayKey = getLocalDateKey(today)

  if(mode === 'today') return { startDate: todayKey, endDate: todayKey, label: 'Bugün' }
  if(mode === 'week') return { startDate: getWeekStart(today), endDate: todayKey, label: 'Bu hafta' }
  if(mode === 'month') return { startDate: getMonthStart(today), endDate: todayKey, label: 'Bu ay' }
  if(mode === 'year') return { startDate: getYearStart(today), endDate: todayKey, label: 'Bu yıl' }

  return {
    startDate: customStartDate,
    endDate: customEndDate,
    label: customStartDate || customEndDate ? 'Özel tarih aralığı' : 'Özel tarih'
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatScore = (value: number) => {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('tr-TR') : '0'
}

const formatMinutes = (value: number) => {
  const normalizedValue = Math.max(0, Math.round(value))
  if(normalizedValue === 0) return '0 dk'

  const hours = Math.floor(normalizedValue / 60)
  const minutes = normalizedValue % 60

  if(hours === 0) return `${minutes} dk`
  if(minutes === 0) return `${hours} sa`
  return `${hours} sa ${minutes} dk`
}

const getEmployeeName = (employee?: Employee) => employee?.fullName || 'Personel bulunamadı'

const getBonusPool = (bonuses: EmployeeBonus[]) => {
  return bonuses.filter(bonus => bonus.status !== 'İptal')
}

const buildPersonnelRows = ({
  employees,
  shifts,
  attendances,
  performances,
  bonuses,
  audits
}: {
  employees: Employee[]
  shifts: Shift[]
  attendances: Attendance[]
  performances: EmployeePerformance[]
  bonuses: EmployeeBonus[]
  audits: EmployeeAudit[]
}): PersonnelPerformanceRow[] => {
  return employees.map(employee => {
    const employeeShifts = shifts.filter(shift => shift.employeeId === employee.id)
    const employeeAttendances = attendances.filter(attendance => attendance.employeeId === employee.id)
    const employeePerformances = performances.filter(performance => performance.employeeId === employee.id)
    const employeeBonuses = getBonusPool(bonuses.filter(bonus => bonus.employeeId === employee.id))
    const employeeAudits = audits.filter(audit => audit.employeeId === employee.id)
    const performanceScore = employeePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
    const bonusAmount = roundCurrency(employeeBonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0))
    const workDayCount = employeeAttendances.filter(attendance => attendance.status !== 'Devamsız' && attendance.workedMinutes > 0).length
    const warningCount = employeeAudits.filter(audit => audit.recordType === 'Uyarı').length

    return {
      employee,
      shiftCount: employeeShifts.length,
      attendanceRecordCount: employeeAttendances.length,
      workDayCount,
      workedMinutes: employeeAttendances.reduce((sum, attendance) => sum + attendance.workedMinutes, 0),
      overtimeMinutes: employeeAttendances.reduce((sum, attendance) => sum + attendance.overtimeMinutes, 0),
      absenceCount: employeeAttendances.filter(attendance => attendance.status === 'Devamsız').length,
      servedTableCount: employeePerformances.reduce((sum, performance) => sum + performance.servedTableCount, 0),
      approvedOrderCount: employeePerformances.reduce((sum, performance) => sum + performance.approvedOrderCount, 0),
      qrOrderCount: employeePerformances.reduce((sum, performance) => sum + performance.qrOrderCount, 0),
      customerCallCount: employeePerformances.reduce((sum, performance) => sum + performance.customerCallCount, 0),
      performanceScore,
      performanceRecordCount: employeePerformances.length,
      averagePerformance: employeePerformances.length > 0 ? Math.round(performanceScore / employeePerformances.length) : 0,
      bonusAmount,
      bonusCount: employeeBonuses.length,
      averageBonus: employeeBonuses.length > 0 ? roundCurrency(bonusAmount / employeeBonuses.length) : 0,
      auditCount: employeeAudits.length,
      warningCount,
      reportCount: employeeAudits.filter(audit => audit.recordType === 'Tutanak').length,
      rewardCount: employeeAudits.filter(audit => audit.recordType === 'Ödül').length,
      criticalAuditCount: employeeAudits.filter(audit => audit.severity === 'Kritik').length,
      highSeverityWarningCount: employeeAudits.filter(audit => {
        return audit.recordType === 'Uyarı' && (audit.severity === 'Yüksek' || audit.severity === 'Kritik')
      }).length
    }
  })
}

const sortByName = (first: PersonnelPerformanceRow, second: PersonnelPerformanceRow) => {
  return first.employee.fullName.localeCompare(second.employee.fullName, 'tr-TR')
}

const getTopRow = (rows: PersonnelPerformanceRow[], getValue: (row: PersonnelPerformanceRow) => number) => {
  return [...rows].sort((first, second) => {
    const valueDiff = getValue(second) - getValue(first)
    if(valueDiff !== 0) return valueDiff
    return sortByName(first, second)
  })[0]
}

function KpiCard({ label, value, detail, compact = false }: KpiCardProps){
  return (
    <div className={`metric-card dashboard-kpi-card ${compact ? 'compact compact-metric-card' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function SummaryPanel({
  title,
  description,
  badge,
  items
}: {
  title: string
  description: string
  badge: React.ReactNode
  items: SummaryItem[]
}){
  return (
    <section className="card financial-summary-card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        {badge}
      </div>
      <div className="financial-summary-values">
        {items.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail && <p className="muted small-text">{item.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function PersonnelSummaryCard({
  title,
  row,
  value,
  meta,
  emptyText
}: {
  title: string
  row?: PersonnelPerformanceRow
  value: React.ReactNode
  meta: React.ReactNode
  emptyText: string
}){
  return (
    <section className="card personnel-performance-card">
      <div className="section-header compact dashboard-panel-header">
        <h3>{title}</h3>
      </div>
      {row ? (
        <div className="current-report-mini-row">
          <div>
            <strong>{getEmployeeName(row.employee)}</strong>
            <span>{row.employee.position} / {meta}</span>
          </div>
          <div>
            <span>Değer</span>
            <strong>{value}</strong>
          </div>
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </section>
  )
}

function RiskList({ title, items, emptyText }: { title: string; items: RiskListItem[]; emptyText: string }){
  return (
    <section className="card personnel-performance-card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
        </div>
        <span className={`status-pill ${items.length > 0 ? 'warning-pill' : 'success'}`}>
          {items.length > 0 ? `${formatNumber(items.length)} personel` : 'Temiz'}
        </span>
      </div>
      <div className="current-report-mini-list">
        {items.length === 0 && <p className="muted">{emptyText}</p>}
        {items.slice(0, 5).map(item => (
          <div className="current-report-mini-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <div>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function PersonnelPerformanceCenter(){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [attendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [performances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [bonuses] = React.useState<EmployeeBonus[]>(() => loadEmployeeBonuses())
  const [audits] = React.useState<EmployeeAudit[]>(() => loadEmployeeAudits())
  const [shifts] = React.useState<Shift[]>(() => loadShifts())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')

  const today = React.useMemo(() => new Date(), [])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])

  const scopedEmployees = React.useMemo(() => {
    return employees.filter(employee => employeeFilter === 'all' || employee.id === employeeFilter)
  }, [employeeFilter, employees])

  const scopedEmployeeIds = React.useMemo(() => {
    return new Set(scopedEmployees.map(employee => employee.id))
  }, [scopedEmployees])

  const filteredShifts = React.useMemo(() => {
    return shifts.filter(shift => scopedEmployeeIds.has(shift.employeeId) && isDateInRange(shift.workDate, range.startDate, range.endDate))
  }, [range.endDate, range.startDate, scopedEmployeeIds, shifts])

  const filteredAttendances = React.useMemo(() => {
    return attendances.filter(attendance => {
      return scopedEmployeeIds.has(attendance.employeeId) && isDateInRange(attendance.workDate, range.startDate, range.endDate)
    })
  }, [attendances, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredPerformances = React.useMemo(() => {
    return performances.filter(performance => {
      return scopedEmployeeIds.has(performance.employeeId) && isDateInRange(performance.workDate, range.startDate, range.endDate)
    })
  }, [performances, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredBonuses = React.useMemo(() => {
    return bonuses.filter(bonus => {
      return scopedEmployeeIds.has(bonus.employeeId) && isPeriodInRange(bonus.period, range.startDate, range.endDate)
    })
  }, [bonuses, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredAudits = React.useMemo(() => {
    return audits.filter(audit => scopedEmployeeIds.has(audit.employeeId) && isDateInRange(audit.date, range.startDate, range.endDate))
  }, [audits, range.endDate, range.startDate, scopedEmployeeIds])

  const bonusPool = React.useMemo(() => getBonusPool(filteredBonuses), [filteredBonuses])

  const rows = React.useMemo(() => buildPersonnelRows({
    employees: scopedEmployees,
    shifts: filteredShifts,
    attendances: filteredAttendances,
    performances: filteredPerformances,
    bonuses: filteredBonuses,
    audits: filteredAudits
  }), [filteredAttendances, filteredAudits, filteredBonuses, filteredPerformances, filteredShifts, scopedEmployees])

  const totalPersonnel = scopedEmployees.length
  const activePersonnel = scopedEmployees.filter(employee => employee.isActive).length
  const totalPerformanceScore = filteredPerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
  const averagePerformance = filteredPerformances.length > 0 ? Math.round(totalPerformanceScore / filteredPerformances.length) : 0
  const totalBonus = roundCurrency(bonusPool.reduce((sum, bonus) => sum + bonus.bonusAmount, 0))
  const totalOvertimeMinutes = filteredAttendances.reduce((sum, attendance) => sum + attendance.overtimeMinutes, 0)
  const totalAuditCount = filteredAudits.length
  const totalRewardCount = filteredAudits.filter(audit => audit.recordType === 'Ödül').length
  const totalWarningCount = filteredAudits.filter(audit => audit.recordType === 'Uyarı').length
  const totalReportCount = filteredAudits.filter(audit => audit.recordType === 'Tutanak').length
  const criticalAuditCount = filteredAudits.filter(audit => audit.severity === 'Kritik').length

  const performanceLeaders = [...rows]
    .filter(row => row.performanceRecordCount > 0)
    .sort((first, second) => {
      const performanceDiff = second.averagePerformance - first.averagePerformance
      if(performanceDiff !== 0) return performanceDiff
      const orderDiff = second.approvedOrderCount - first.approvedOrderCount
      if(orderDiff !== 0) return orderDiff
      return sortByName(first, second)
    })
    .slice(0, 10)

  const overtimeLeaders = [...rows]
    .filter(row => row.overtimeMinutes > 0 || row.attendanceRecordCount > 0)
    .sort((first, second) => {
      const overtimeDiff = second.overtimeMinutes - first.overtimeMinutes
      if(overtimeDiff !== 0) return overtimeDiff
      const workDayDiff = second.workDayCount - first.workDayCount
      if(workDayDiff !== 0) return workDayDiff
      return sortByName(first, second)
    })
    .slice(0, 10)

  const bonusLeaders = [...rows]
    .filter(row => row.bonusAmount > 0)
    .sort((first, second) => second.bonusAmount - first.bonusAmount || second.bonusCount - first.bonusCount || sortByName(first, second))
    .slice(0, 10)

  const topPerformanceRow = getTopRow(rows.filter(row => row.performanceRecordCount > 0), row => row.averagePerformance)
  const topOvertimeRow = getTopRow(rows.filter(row => row.overtimeMinutes > 0), row => row.overtimeMinutes)
  const topBonusRow = getTopRow(rows.filter(row => row.bonusAmount > 0), row => row.bonusAmount)
  const mostDisciplinedRow = [...rows]
    .filter(row => row.employee.isActive)
    .sort((first, second) => {
      const criticalDiff = first.criticalAuditCount - second.criticalAuditCount
      if(criticalDiff !== 0) return criticalDiff
      const warningDiff = first.warningCount - second.warningCount
      if(warningDiff !== 0) return warningDiff
      const auditDiff = first.auditCount - second.auditCount
      if(auditDiff !== 0) return auditDiff
      const performanceDiff = second.averagePerformance - first.averagePerformance
      if(performanceDiff !== 0) return performanceDiff
      return sortByName(first, second)
    })[0]

  const disciplineSummaryItems: SummaryItem[] = [
    { label: 'Uyarılar', value: formatNumber(totalWarningCount), detail: `${formatNumber(rows.reduce((sum, row) => sum + row.highSeverityWarningCount, 0))} yüksek/kritik uyarı` },
    { label: 'Tutanaklar', value: formatNumber(totalReportCount), detail: `${formatNumber(totalAuditCount)} toplam disiplin kaydı` },
    { label: 'Kritik Kayıtlar', value: formatNumber(criticalAuditCount), detail: criticalAuditCount > 0 ? 'Acil izleme gerektirir' : 'Kritik kayıt yok' },
    { label: 'Ödüller', value: formatNumber(totalRewardCount), detail: `${formatNumber(scopedEmployees.length)} personel içinde` }
  ]

  const lowPerformanceItems: RiskListItem[] = rows
    .filter(row => row.employee.isActive && row.performanceRecordCount > 0 && row.averagePerformance < LOW_PERFORMANCE_THRESHOLD)
    .sort((first, second) => first.averagePerformance - second.averagePerformance || sortByName(first, second))
    .map(row => ({
      id: `low_performance_${row.employee.id}`,
      title: row.employee.fullName,
      detail: `${row.employee.position} / ${formatNumber(row.performanceRecordCount)} performans kaydı`,
      value: `Ort. ${formatScore(row.averagePerformance)}`
    }))

  const highWarningItems: RiskListItem[] = rows
    .filter(row => row.warningCount >= HIGH_WARNING_THRESHOLD || row.highSeverityWarningCount > 0)
    .sort((first, second) => {
      const highDiff = second.highSeverityWarningCount - first.highSeverityWarningCount
      if(highDiff !== 0) return highDiff
      const warningDiff = second.warningCount - first.warningCount
      if(warningDiff !== 0) return warningDiff
      return sortByName(first, second)
    })
    .map(row => ({
      id: `high_warning_${row.employee.id}`,
      title: row.employee.fullName,
      detail: `${row.employee.position} / ${formatNumber(row.highSeverityWarningCount)} yüksek-kritik`,
      value: `${formatNumber(row.warningCount)} uyarı`
    }))

  const criticalAuditItems: RiskListItem[] = rows
    .filter(row => row.criticalAuditCount > 0)
    .sort((first, second) => second.criticalAuditCount - first.criticalAuditCount || sortByName(first, second))
    .map(row => ({
      id: `critical_audit_${row.employee.id}`,
      title: row.employee.fullName,
      detail: `${row.employee.position} / ${formatNumber(row.auditCount)} disiplin kaydı`,
      value: `${formatNumber(row.criticalAuditCount)} kritik`
    }))

  const absenceRiskItems: RiskListItem[] = rows
    .filter(row => row.employee.isActive && row.absenceCount > 0)
    .sort((first, second) => second.absenceCount - first.absenceCount || first.workDayCount - second.workDayCount || sortByName(first, second))
    .map(row => ({
      id: `absence_${row.employee.id}`,
      title: row.employee.fullName,
      detail: `${row.employee.position} / ${formatNumber(row.workDayCount)} çalışma günü`,
      value: `${formatNumber(row.absenceCount)} devamsızlık`
    }))

  return (
    <div className="personnel-performance-center-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Personel Performans Merkezi</h2>
          <p className="muted">Personel performans ve verimlilik analizlerini inceleyin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">{range.label}</span>
          <span className="dashboard-date-pill">{range.startDate || '-'} / {range.endDate || '-'}</span>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Tarih aralığı veya personel değiştiğinde tüm KPI, liderlik, prim, mesai, disiplin ve risk analizleri güncellenir.</p>
          </div>
          <div className="toolbar-controls personnel-performance-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input
              type="date"
              value={rangeMode === 'custom' ? customStartDate : range.startDate}
              onChange={event => setCustomStartDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <input
              type="date"
              value={rangeMode === 'custom' ? customEndDate : range.endDate}
              onChange={event => setCustomEndDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
              <option value="all">Tüm personeller</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Personel" value={formatNumber(totalPersonnel)} detail={`${formatNumber(activePersonnel)} aktif personel`} />
        <KpiCard label="Aktif Personel" value={formatNumber(activePersonnel)} detail={`${formatNumber(totalPersonnel - activePersonnel)} pasif personel`} />
        <KpiCard label="Ortalama Performans" value={formatScore(averagePerformance)} detail={`${formatNumber(filteredPerformances.length)} performans kaydı`} />
        <KpiCard label="Toplam Prim" value={formatCurrency(totalBonus)} detail={`${formatNumber(bonusPool.length)} geçerli prim kaydı`} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid personnel-performance-extra-grid">
        <KpiCard compact label="Toplam Mesai" value={formatMinutes(totalOvertimeMinutes)} detail={`${formatNumber(filteredAttendances.length)} puantaj kaydı`} />
        <KpiCard compact label="Toplam Disiplin Kaydı" value={formatNumber(totalAuditCount)} detail={`${formatNumber(criticalAuditCount)} kritik kayıt`} />
        <KpiCard compact label="Toplam Ödül" value={formatNumber(totalRewardCount)} detail="Ödül türündeki denetim kayıtları" />
        <KpiCard compact label="Toplam Uyarı" value={formatNumber(totalWarningCount)} detail={`${formatNumber(rows.reduce((sum, row) => sum + row.highSeverityWarningCount, 0))} yüksek/kritik uyarı`} />
      </div>

      <section className="personnel-section-stack">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Personel Özeti</h3>
            <p className="muted">Başarı, mesai, prim ve disiplin açısından öne çıkan personeller.</p>
          </div>
          <span className="status-pill info-pill">{formatNumber(rows.length)} personel</span>
        </div>
        <div className="personnel-summary-grid">
          <PersonnelSummaryCard
            title="En Başarılı Personel"
            row={topPerformanceRow}
            value={topPerformanceRow ? formatScore(topPerformanceRow.averagePerformance) : '-'}
            meta={topPerformanceRow ? `${formatNumber(topPerformanceRow.performanceRecordCount)} performans kaydı` : ''}
            emptyText="Performans kaydı bulunamadı."
          />
          <PersonnelSummaryCard
            title="En Çok Mesai Yapan"
            row={topOvertimeRow}
            value={topOvertimeRow ? formatMinutes(topOvertimeRow.overtimeMinutes) : '-'}
            meta={topOvertimeRow ? `${formatNumber(topOvertimeRow.workDayCount)} çalışma günü` : ''}
            emptyText="Mesai kaydı bulunamadı."
          />
          <PersonnelSummaryCard
            title="En Çok Prim Alan"
            row={topBonusRow}
            value={topBonusRow ? formatCurrency(topBonusRow.bonusAmount) : '-'}
            meta={topBonusRow ? `${formatNumber(topBonusRow.bonusCount)} prim kaydı` : ''}
            emptyText="Prim kaydı bulunamadı."
          />
          <PersonnelSummaryCard
            title="En Disiplinli Personel"
            row={mostDisciplinedRow}
            value={mostDisciplinedRow ? `${formatNumber(mostDisciplinedRow.warningCount)} uyarı` : '-'}
            meta={mostDisciplinedRow ? `${formatNumber(mostDisciplinedRow.auditCount)} disiplin kaydı` : ''}
            emptyText="Aktif personel bulunamadı."
          />
        </div>
      </section>

      <section className="personnel-performance-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Performans Liderleri</h3>
              <p className="muted">İlk 10 personel ortalama performans puanına göre sıralanır.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(performanceLeaders.length)} personel</span>
          </div>
          <div className="table-wrap">
            <table className="data-table personnel-performance-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Performans Puanı</th>
                  <th>Masa Sayısı</th>
                  <th>Sipariş Sayısı</th>
                  <th>QR Sipariş</th>
                </tr>
              </thead>
              <tbody>
                {performanceLeaders.length === 0 && <tr><td className="empty-cell" colSpan={5}>Performans kaydı bulunamadı.</td></tr>}
                {performanceLeaders.map(row => (
                  <tr key={row.employee.id}>
                    <td>
                      <strong>{row.employee.fullName}</strong>
                      <div className="muted small-text">{row.employee.position} / {formatNumber(row.shiftCount)} vardiya</div>
                    </td>
                    <td>
                      <strong>{formatScore(row.averagePerformance)}</strong>
                      <div className="muted small-text">Toplam {formatScore(row.performanceScore)}</div>
                    </td>
                    <td>{formatNumber(row.servedTableCount)}</td>
                    <td>{formatNumber(row.approvedOrderCount)}</td>
                    <td>{formatNumber(row.qrOrderCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Mesai Analizi</h3>
              <p className="muted">En çok mesai yapan personeller çalışma günü ve devamsızlık ile izlenir.</p>
            </div>
            <span className="status-pill info-pill">{formatMinutes(totalOvertimeMinutes)}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table personnel-attendance-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Mesai Süresi</th>
                  <th>Çalışma Günü</th>
                  <th>Devamsızlık</th>
                </tr>
              </thead>
              <tbody>
                {overtimeLeaders.length === 0 && <tr><td className="empty-cell" colSpan={4}>Puantaj veya mesai kaydı bulunamadı.</td></tr>}
                {overtimeLeaders.map(row => (
                  <tr key={row.employee.id}>
                    <td>
                      <strong>{row.employee.fullName}</strong>
                      <div className="muted small-text">{formatMinutes(row.workedMinutes)} toplam çalışma</div>
                    </td>
                    <td><strong>{formatMinutes(row.overtimeMinutes)}</strong></td>
                    <td>{formatNumber(row.workDayCount)}</td>
                    <td>{formatNumber(row.absenceCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="personnel-performance-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Prim Analizi</h3>
              <p className="muted">En yüksek prim alan personeller toplam ve ortalama prim değerleriyle sıralanır.</p>
            </div>
            <span className="status-pill success">{formatCurrency(totalBonus)}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table personnel-bonus-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Toplam Prim</th>
                  <th>Prim Sayısı</th>
                  <th>Ortalama Prim</th>
                </tr>
              </thead>
              <tbody>
                {bonusLeaders.length === 0 && <tr><td className="empty-cell" colSpan={4}>Geçerli prim kaydı bulunamadı.</td></tr>}
                {bonusLeaders.map(row => (
                  <tr key={row.employee.id}>
                    <td>
                      <strong>{row.employee.fullName}</strong>
                      <div className="muted small-text">{row.employee.position}</div>
                    </td>
                    <td><strong>{formatCurrency(row.bonusAmount)}</strong></td>
                    <td>{formatNumber(row.bonusCount)}</td>
                    <td>{formatCurrency(row.averageBonus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <SummaryPanel
          title="Disiplin Analizi"
          description="Uyarı, tutanak, kritik kayıt ve ödül dağılımı."
          badge={<span className={`status-pill ${criticalAuditCount > 0 ? 'warning-pill' : 'success'}`}>{criticalAuditCount > 0 ? 'Risk var' : 'Temiz'}</span>}
          items={disciplineSummaryItems}
        />
      </section>

      <section className="personnel-section-stack">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Personel Risk Analizi</h3>
            <p className="muted">Düşük performans, uyarı yoğunluğu, kritik disiplin ve devamsızlık riskleri.</p>
          </div>
          <span className={`status-pill ${lowPerformanceItems.length + highWarningItems.length + criticalAuditItems.length + absenceRiskItems.length > 0 ? 'warning-pill' : 'success'}`}>
            {formatNumber(lowPerformanceItems.length + highWarningItems.length + criticalAuditItems.length + absenceRiskItems.length)} risk
          </span>
        </div>
        <div className="personnel-risk-grid">
          <RiskList
            title="Düşük Performanslı Personeller"
            items={lowPerformanceItems}
            emptyText="Düşük performans eşiğinde personel bulunmuyor."
          />
          <RiskList
            title="Yüksek Uyarı Alanlar"
            items={highWarningItems}
            emptyText="Yüksek uyarı riski olan personel bulunmuyor."
          />
          <RiskList
            title="Kritik Disiplin Kaydı Olanlar"
            items={criticalAuditItems}
            emptyText="Kritik disiplin kaydı bulunan personel yok."
          />
          <RiskList
            title="Devamsızlık Riski Olanlar"
            items={absenceRiskItems}
            emptyText="Devamsızlık riski bulunan personel yok."
          />
        </div>
      </section>
    </div>
  )
}
