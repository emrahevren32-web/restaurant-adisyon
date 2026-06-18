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
import { formatCurrency } from '../billing'

type DateRangeMode = 'month' | 'year' | 'all' | 'custom'
type EmployeeFilter = string

type EmployeeReportRow = {
  employee: Employee
  shiftCount: number
  workedMinutes: number
  overtimeMinutes: number
  absenceCount: number
  performanceScore: number
  performanceRecordCount: number
  averagePerformance: number
  bonusAmount: number
  auditCount: number
  rewardCount: number
  warningCount: number
  criticalAuditCount: number
  highWarningCount: number
}

const lowPerformanceThreshold = 50

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
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

  if(mode === 'month'){
    return {
      startDate: getMonthStart(today),
      endDate: todayKey,
      label: 'Bu ay'
    }
  }

  if(mode === 'year'){
    return {
      startDate: getYearStart(today),
      endDate: todayKey,
      label: 'Bu yıl'
    }
  }

  if(mode === 'custom'){
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      label: 'Özel tarih'
    }
  }

  return {
    startDate: '',
    endDate: '',
    label: 'Tümü'
  }
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

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

const buildEmployeeReportRows = ({
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
}): EmployeeReportRow[] => {
  return employees.map(employee => {
    const employeeShifts = shifts.filter(shift => shift.employeeId === employee.id)
    const employeeAttendances = attendances.filter(attendance => attendance.employeeId === employee.id)
    const employeePerformances = performances.filter(performance => performance.employeeId === employee.id)
    const employeeBonuses = bonuses.filter(bonus => bonus.employeeId === employee.id && bonus.status !== 'İptal')
    const employeeAudits = audits.filter(audit => audit.employeeId === employee.id)
    const performanceScore = employeePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
    const performanceRecordCount = employeePerformances.length

    return {
      employee,
      shiftCount: employeeShifts.length,
      workedMinutes: employeeAttendances.reduce((sum, attendance) => sum + attendance.workedMinutes, 0),
      overtimeMinutes: employeeAttendances.reduce((sum, attendance) => sum + attendance.overtimeMinutes, 0),
      absenceCount: employeeAttendances.filter(attendance => attendance.status === 'Devamsız').length,
      performanceScore,
      performanceRecordCount,
      averagePerformance: performanceRecordCount > 0 ? Math.round(performanceScore / performanceRecordCount) : 0,
      bonusAmount: roundMoney(employeeBonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0)),
      auditCount: employeeAudits.length,
      rewardCount: employeeAudits.filter(audit => audit.recordType === 'Ödül').length,
      warningCount: employeeAudits.filter(audit => audit.recordType === 'Uyarı').length,
      criticalAuditCount: employeeAudits.filter(audit => audit.severity === 'Kritik').length,
      highWarningCount: employeeAudits.filter(audit => audit.recordType === 'Uyarı' && (audit.severity === 'Yüksek' || audit.severity === 'Kritik')).length
    }
  })
}

const sortByName = (first: EmployeeReportRow, second: EmployeeReportRow) => {
  return first.employee.fullName.localeCompare(second.employee.fullName, 'tr-TR')
}

const getTopRow = (rows: EmployeeReportRow[], getValue: (row: EmployeeReportRow) => number) => {
  const sortedRows = [...rows].sort((first, second) => {
    const valueDiff = getValue(second) - getValue(first)
    if(valueDiff !== 0) return valueDiff
    return sortByName(first, second)
  })

  return sortedRows[0]
}

export default function EmployeeReports(){
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [shifts] = React.useState<Shift[]>(() => loadShifts())
  const [attendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [performances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [bonuses] = React.useState<EmployeeBonus[]>(() => loadEmployeeBonuses())
  const [audits] = React.useState<EmployeeAudit[]>(() => loadEmployeeAudits())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [employeeFilter, setEmployeeFilter] = React.useState<EmployeeFilter>('all')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')

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
    return attendances.filter(attendance => scopedEmployeeIds.has(attendance.employeeId) && isDateInRange(attendance.workDate, range.startDate, range.endDate))
  }, [attendances, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredPerformances = React.useMemo(() => {
    return performances.filter(performance => scopedEmployeeIds.has(performance.employeeId) && isDateInRange(performance.workDate, range.startDate, range.endDate))
  }, [performances, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredBonuses = React.useMemo(() => {
    return bonuses.filter(bonus => scopedEmployeeIds.has(bonus.employeeId) && isPeriodInRange(bonus.period, range.startDate, range.endDate))
  }, [bonuses, range.endDate, range.startDate, scopedEmployeeIds])

  const filteredAudits = React.useMemo(() => {
    return audits.filter(audit => scopedEmployeeIds.has(audit.employeeId) && isDateInRange(audit.date, range.startDate, range.endDate))
  }, [audits, range.endDate, range.startDate, scopedEmployeeIds])

  const rows = React.useMemo(() => buildEmployeeReportRows({
    employees: scopedEmployees,
    shifts: filteredShifts,
    attendances: filteredAttendances,
    performances: filteredPerformances,
    bonuses: filteredBonuses,
    audits: filteredAudits
  }), [filteredAttendances, filteredAudits, filteredBonuses, filteredPerformances, filteredShifts, scopedEmployees])

  const totalPersonnel = scopedEmployees.length
  const activePersonnel = scopedEmployees.filter(employee => employee.isActive).length
  const totalOvertimeMinutes = rows.reduce((sum, row) => sum + row.overtimeMinutes, 0)
  const totalBonus = roundMoney(rows.reduce((sum, row) => sum + row.bonusAmount, 0))
  const totalPerformanceScore = filteredPerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
  const averagePerformance = filteredPerformances.length > 0 ? Math.round(totalPerformanceScore / filteredPerformances.length) : 0
  const totalAuditCount = filteredAudits.length
  const totalRewardCount = filteredAudits.filter(audit => audit.recordType === 'Ödül').length
  const totalWarningCount = filteredAudits.filter(audit => audit.recordType === 'Uyarı').length

  const highestPerformanceRow = getTopRow(rows.filter(row => row.performanceScore > 0), row => row.performanceScore)
  const mostOvertimeRow = getTopRow(rows.filter(row => row.overtimeMinutes > 0), row => row.overtimeMinutes)
  const highestBonusRow = getTopRow(rows.filter(row => row.bonusAmount > 0), row => row.bonusAmount)
  const leastAbsenceRow = [...rows]
    .filter(row => row.employee.isActive)
    .sort((first, second) => {
      const absenceDiff = first.absenceCount - second.absenceCount
      if(absenceDiff !== 0) return absenceDiff
      const workedDiff = second.workedMinutes - first.workedMinutes
      if(workedDiff !== 0) return workedDiff
      const performanceDiff = second.performanceScore - first.performanceScore
      if(performanceDiff !== 0) return performanceDiff
      return sortByName(first, second)
    })[0]

  const criticalDisciplineRows = rows
    .filter(row => row.criticalAuditCount > 0)
    .sort((first, second) => second.criticalAuditCount - first.criticalAuditCount || sortByName(first, second))
  const highWarningRows = rows
    .filter(row => row.highWarningCount > 0)
    .sort((first, second) => second.highWarningCount - first.highWarningCount || sortByName(first, second))
  const lowPerformanceRows = rows
    .filter(row => row.employee.isActive && row.averagePerformance < lowPerformanceThreshold)
    .sort((first, second) => first.averagePerformance - second.averagePerformance || sortByName(first, second))
  const passiveRows = rows.filter(row => !row.employee.isActive).sort(sortByName)
  const topPerformanceRows = [...rows]
    .sort((first, second) => {
      const performanceDiff = second.performanceScore - first.performanceScore
      if(performanceDiff !== 0) return performanceDiff
      const overtimeDiff = second.overtimeMinutes - first.overtimeMinutes
      if(overtimeDiff !== 0) return overtimeDiff
      const bonusDiff = second.bonusAmount - first.bonusAmount
      if(bonusDiff !== 0) return bonusDiff
      return sortByName(first, second)
    })
    .slice(0, 10)

  return (
    <div className="employee-reports-page">
      <div className="page-title">
        <div>
          <h2>Personel Raporları</h2>
          <p className="muted">Personel performans ve denetim verilerini analiz edin.</p>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{range.label} verileri gösteriliyor.</p>
          </div>
          <div className="toolbar-controls employee-report-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="all">Tümü</option>
              <option value="custom">Özel Tarih</option>
            </select>
            <select value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)}>
              <option value="all">Tüm personeller</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
            </select>
            <input
              type="date"
              value={customStartDate}
              onChange={event => setCustomStartDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <input
              type="date"
              value={customEndDate}
              onChange={event => setCustomEndDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Personel</span>
          <strong>{totalPersonnel}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Personel</span>
          <strong>{activePersonnel}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Mesai</span>
          <strong>{formatMinutes(totalOvertimeMinutes)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Prim</span>
          <strong>{formatCurrency(totalBonus)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Ortalama Performans</span>
          <strong>{formatScore(averagePerformance)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Disiplin Kaydı</span>
          <strong>{totalAuditCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Ödül</span>
          <strong>{totalRewardCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Uyarı</span>
          <strong>{totalWarningCount}</strong>
        </div>
      </div>

      <section className="employee-report-summary-grid">
        <EmployeeSummaryCard
          title="En Yüksek Performanslı Personel"
          row={highestPerformanceRow}
          value={highestPerformanceRow ? formatScore(highestPerformanceRow.performanceScore) : '-'}
          meta={highestPerformanceRow ? `${highestPerformanceRow.performanceRecordCount} performans kaydı` : ''}
          emptyText="Performans kaydı bulunamadı."
        />
        <EmployeeSummaryCard
          title="En Çok Mesai Yapan Personel"
          row={mostOvertimeRow}
          value={mostOvertimeRow ? formatMinutes(mostOvertimeRow.overtimeMinutes) : '-'}
          meta={mostOvertimeRow ? `${formatMinutes(mostOvertimeRow.workedMinutes)} çalışma` : ''}
          emptyText="Mesai kaydı bulunamadı."
        />
        <EmployeeSummaryCard
          title="En Yüksek Prim Alan Personel"
          row={highestBonusRow}
          value={highestBonusRow ? formatCurrency(highestBonusRow.bonusAmount) : '-'}
          meta={highestBonusRow ? `${highestBonusRow.performanceRecordCount} performans kaydı` : ''}
          emptyText="Prim kaydı bulunamadı."
        />
        <EmployeeSummaryCard
          title="En Az Devamsızlık Yapan Personel"
          row={leastAbsenceRow}
          value={leastAbsenceRow ? `${leastAbsenceRow.absenceCount} devamsızlık` : '-'}
          meta={leastAbsenceRow ? `${formatMinutes(leastAbsenceRow.workedMinutes)} çalışma` : ''}
          emptyText="Aktif personel bulunamadı."
        />
      </section>

      <section className="employee-report-risk-grid">
        <EmployeeRiskCard
          title="Kritik Disiplin Kaydı Olanlar"
          rows={criticalDisciplineRows}
          getValue={row => `${row.criticalAuditCount} kritik kayıt`}
          emptyText="Kritik disiplin kaydı bulunamadı."
        />
        <EmployeeRiskCard
          title="Yüksek Uyarı Alanlar"
          rows={highWarningRows}
          getValue={row => `${row.highWarningCount} yüksek uyarı`}
          emptyText="Yüksek veya kritik uyarı bulunamadı."
        />
        <EmployeeRiskCard
          title="Düşük Performanslı Personeller"
          rows={lowPerformanceRows}
          getValue={row => `Ort. ${formatScore(row.averagePerformance)}`}
          emptyText="Düşük performanslı personel bulunamadı."
        />
        <EmployeeRiskCard
          title="Pasif Personeller"
          rows={passiveRows}
          getValue={() => 'Pasif'}
          emptyText="Pasif personel bulunamadı."
        />
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>En İyi Performans Listesi</h3>
            <p className="muted">İlk 10 personel performans, mesai ve prim değerlerine göre sıralanır.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table employee-report-table">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Performans</th>
                <th>Mesai</th>
                <th>Prim</th>
              </tr>
            </thead>
            <tbody>
              {topPerformanceRows.length === 0 && (
                <tr><td colSpan={4} className="empty-cell">Bu filtrelere uygun personel raporu bulunamadı.</td></tr>
              )}
              {topPerformanceRows.map(row => (
                <tr key={row.employee.id}>
                  <td>
                    <strong>{row.employee.fullName}</strong>
                    <div className="muted small-text">
                      {row.employee.position} / {row.shiftCount} vardiya / {row.employee.isActive ? 'Aktif' : 'Pasif'}
                    </div>
                  </td>
                  <td>
                    <strong>{formatScore(row.performanceScore)}</strong>
                    <div className="muted small-text">Ortalama {formatScore(row.averagePerformance)}</div>
                  </td>
                  <td>
                    <strong>{formatMinutes(row.overtimeMinutes)}</strong>
                    <div className="muted small-text">Çalışma {formatMinutes(row.workedMinutes)}</div>
                  </td>
                  <td><strong>{formatCurrency(row.bonusAmount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function EmployeeSummaryCard({
  title,
  row,
  value,
  meta,
  emptyText
}: {
  title: string
  row?: EmployeeReportRow
  value: string
  meta: string
  emptyText: string
}){
  return (
    <section className="card employee-report-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      {row ? (
        <div className="current-report-mini-row">
          <div>
            <strong>{getEmployeeName(row.employee)}</strong>
            <span>{row.employee.position} · {meta}</span>
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

function EmployeeRiskCard({
  title,
  rows,
  getValue,
  emptyText
}: {
  title: string
  rows: EmployeeReportRow[]
  getValue: (row: EmployeeReportRow) => string
  emptyText: string
}){
  return (
    <section className="card employee-report-card">
      <div className="section-header compact">
        <h3>{title}</h3>
        <span className={`status-pill ${rows.length > 0 ? 'warning-pill' : 'success'}`}>{rows.length}</span>
      </div>
      <div className="current-report-mini-list">
        {rows.length === 0 && <p className="muted">{emptyText}</p>}
        {rows.slice(0, 5).map(row => (
          <div className="current-report-mini-row" key={`${title}_${row.employee.id}`}>
            <div>
              <strong>{row.employee.fullName}</strong>
              <span>{row.employee.position} · {row.auditCount} denetim kaydı</span>
            </div>
            <div>
              <span>Durum</span>
              <strong>{getValue(row)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
