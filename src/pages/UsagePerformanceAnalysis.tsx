import React from 'react'
import { SystemUsageLog, SystemUsageModuleName, UsagePerformanceSummary } from '../types'
import {
  calculateBusinessUsageSummaries,
  calculateModuleUsageSummaries,
  calculateUsagePerformanceSummaries,
  calculateUserActivitySummaries,
  loadBranches,
  loadSystemUsageLogs,
  loadUsers
} from '../storage'

type StatRow = {
  key: string
  label: string
  count: number
  detail?: string
}

type DensityRow = {
  key: string
  label: string
  totalActions: number
  activeUsers: number
  activeBranches: number
  peakUsageScore: number
}

type TrendRow = {
  key: string
  label: string
  current: number
  previous: number
  change: number
}

type DetailTarget =
  | { type: 'day'; key: string }
  | { type: 'hour'; key: string }

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}

const moduleNames: SystemUsageModuleName[] = [
  'İşlem Yönetimi',
  'Alan Yönetimi',
  'Ürün / Hizmet Yönetimi',
  'Stok Yönetimi',
  'Cari Yönetimi',
  'Finans Yönetimi',
  'Personel Yönetimi',
  'Yönetici Merkezi',
  'Çoklu Şube Yönetimi',
  'Üretim Tanımı',
  'Sistem'
]

const getDateKey = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getHour = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? -1 : date.getHours()
}

const getHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`

const toDateKey = (date: Date) => date.toLocaleDateString('sv-SE')

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const getStartOfWeek = (date: Date) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const getPreviousMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth() - 1, 1)

const getPreviousMonthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 0)

const getWeekKey = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  if(Number.isNaN(date.getTime())) return ''
  return toDateKey(getStartOfWeek(date))
}

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7)

const getDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString('tr-TR')
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatAverage = (value: number) => value.toLocaleString('tr-TR', {
  minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  maximumFractionDigits: 1
})

const calculateDensityScore = (totalActions: number, activeUsers: number, activeBranches: number) => {
  const actionScore = Math.min(55, totalActions * 2)
  const userScore = Math.min(25, activeUsers * 5)
  const branchScore = Math.min(20, activeBranches * 10)
  return Math.min(100, Math.round(actionScore + userScore + branchScore))
}

const calculateTrendChange = (current: number, previous: number) => {
  if(previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

const sumActionsBetween = (logs: SystemUsageLog[], startKey: string, endKey: string) => logs.filter(log => {
  const dateKey = getDateKey(log.createdAt)
  return dateKey >= startKey && dateKey <= endKey
}).length

const getMostUsedModule = (logs: SystemUsageLog[]) => {
  const counts = new Map<string, number>()
  logs.forEach(log => {
    if(!log.moduleName) return
    counts.set(log.moduleName, (counts.get(log.moduleName) || 0) + 1)
  })
  return Array.from(counts.entries()).sort((first, second) => {
    const countDiff = second[1] - first[1]
    if(countDiff !== 0) return countDiff
    return first[0].localeCompare(second[0], 'tr-TR')
  })[0]?.[0] || '-'
}

const buildStats = (
  logs: SystemUsageLog[],
  getKey: (log: SystemUsageLog) => string,
  getLabel: (key: string) => string = key => key
) => {
  const counts = new Map<string, number>()
  logs.forEach(log => {
    const key = getKey(log)
    if(!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: getLabel(key), count }))
    .sort((first, second) => {
      const countDiff = second.count - first.count
      if(countDiff !== 0) return countDiff
      return first.label.localeCompare(second.label, 'tr-TR')
    })
}

const buildDailyRows = (logs: SystemUsageLog[]): DensityRow[] => {
  const groupedLogs = new Map<string, SystemUsageLog[]>()
  logs.forEach(log => {
    const key = getDateKey(log.createdAt)
    if(!key) return
    groupedLogs.set(key, [...(groupedLogs.get(key) || []), log])
  })

  return Array.from(groupedLogs.entries()).map(([dateKey, dayLogs]) => {
    const activeUsers = new Set(dayLogs.map(log => log.userId || log.userName).filter(Boolean)).size
    const activeBranches = new Set(dayLogs.map(log => log.branchId).filter(Boolean)).size
    return {
      key: dateKey,
      label: getDateLabel(dateKey),
      totalActions: dayLogs.length,
      activeUsers,
      activeBranches,
      peakUsageScore: calculateDensityScore(dayLogs.length, activeUsers, activeBranches)
    }
  }).sort((first, second) => second.key.localeCompare(first.key))
}

const buildHourlyRows = (logs: SystemUsageLog[]): DensityRow[] => {
  return Array.from({ length: 24 }, (_, hour) => {
    const hourLogs = logs.filter(log => getHour(log.createdAt) === hour)
    const activeUsers = new Set(hourLogs.map(log => log.userId || log.userName).filter(Boolean)).size
    const activeBranches = new Set(hourLogs.map(log => log.branchId).filter(Boolean)).size
    return {
      key: String(hour),
      label: getHourLabel(hour),
      totalActions: hourLogs.length,
      activeUsers,
      activeBranches,
      peakUsageScore: calculateDensityScore(hourLogs.length, activeUsers, activeBranches)
    }
  })
}

const buildPeriodStats = (
  logs: SystemUsageLog[],
  getKey: (dateKey: string) => string,
  getLabel: (key: string) => string
) => {
  const counts = new Map<string, number>()
  logs.forEach(log => {
    const dateKey = getDateKey(log.createdAt)
    const key = dateKey ? getKey(dateKey) : ''
    if(!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: getLabel(key), count }))
    .sort((first, second) => second.key.localeCompare(first.key))
}

function KpiCard({ label, value, detail }: KpiCardProps){
  return (
    <div className="metric-card dashboard-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function AnalysisCard({
  title,
  rows,
  total,
  countLabel = 'işlem'
}: {
  title: string
  rows: StatRow[]
  total: number
  countLabel?: string
}){
  const topRows = rows.slice(0, 5)

  return (
    <section className="card usage-performance-analysis-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{topRows.length > 0 ? 'İlk 5 kayıt gösteriliyor.' : 'Analiz için kayıt yok.'}</p>
        </div>
      </div>
      <div className="system-usage-analysis-list">
        {topRows.length === 0 && <p className="muted">Filtrelere uygun veri bulunamadı.</p>}
        {topRows.map(row => {
          const percentage = total > 0 ? Math.round((row.count / total) * 100) : 0
          return (
            <div key={row.key}>
              <div>
                <strong>{row.label}</strong>
                <span>{row.detail || `${formatNumber(row.count)} ${countLabel}`}</span>
              </div>
              <div>
                <span className="status-pill info-pill">%{Math.min(100, percentage)}</span>
                <div className="system-usage-bar"><span style={{ width: `${Math.min(100, percentage)}%` }} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TrendCard({ trends }: { trends: TrendRow[] }){
  return (
    <section className="card usage-performance-analysis-card">
      <div className="section-header compact">
        <div>
          <h3>Kullanım Trendleri</h3>
          <p className="muted">Önceki dönemlerle yüzdelik değişim.</p>
        </div>
      </div>
      <div className="usage-performance-trend-list">
        {trends.map(trend => (
          <div key={trend.key}>
            <div>
              <strong>{trend.label}</strong>
              <span>{formatNumber(trend.current)} / {formatNumber(trend.previous)} işlem</span>
            </div>
            <span className={`status-pill ${trend.change >= 0 ? 'success' : 'danger-pill'}`}>
              {trend.change >= 0 ? '+' : ''}{trend.change}%
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function UsagePerformanceAnalysis(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [branches] = React.useState(() => loadBranches())
  const [users] = React.useState(() => loadUsers())
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [userFilter, setUserFilter] = React.useState('all')
  const [moduleFilter, setModuleFilter] = React.useState<'all' | SystemUsageModuleName>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [selectedTarget, setSelectedTarget] = React.useState<DetailTarget | null>(null)

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => toDateKey(today), [today])
  const yesterdayKey = React.useMemo(() => toDateKey(addDays(today, -1)), [today])

  const userOptions = React.useMemo(() => {
    const fromUsers = users.map(user => ({ id: user.id, name: user.fullName || user.username }))
    const fromLogs = logs.map(log => ({ id: log.userId, name: log.userName }))
    const unique = new Map([...fromUsers, ...fromLogs].filter(user => user.id).map(user => [user.id, user]))
    return Array.from(unique.values()).sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
  }, [logs, users])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      const matchesUser = userFilter === 'all' || log.userId === userFilter
      const matchesModule = moduleFilter === 'all' || log.moduleName === moduleFilter
      return matchesStart && matchesEnd && matchesBranch && matchesUser && matchesModule
    })
  }, [branchFilter, endDate, logs, moduleFilter, startDate, userFilter])

  const performanceSummaries = React.useMemo<UsagePerformanceSummary[]>(() => {
    return calculateUsagePerformanceSummaries(filteredLogs)
  }, [filteredLogs])

  const userSummaries = React.useMemo(() => calculateUserActivitySummaries(filteredLogs, users), [filteredLogs, users])
  const businessSummaries = React.useMemo(() => calculateBusinessUsageSummaries(filteredLogs, branches), [branches, filteredLogs])
  const moduleSummaries = React.useMemo(() => calculateModuleUsageSummaries(filteredLogs), [filteredLogs])

  const dailyRows = React.useMemo(() => buildDailyRows(filteredLogs), [filteredLogs])
  const hourlyRows = React.useMemo(() => buildHourlyRows(filteredLogs), [filteredLogs])
  const weeklyRows = React.useMemo(() => buildPeriodStats(filteredLogs, getWeekKey, key => `${getDateLabel(key)} haftası`), [filteredLogs])
  const monthlyRows = React.useMemo(() => buildPeriodStats(filteredLogs, getMonthKey, key => {
    const date = new Date(`${key}-01T00:00:00`)
    return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  }), [filteredLogs])

  const totalActions = filteredLogs.length
  const activeUsers = new Set(filteredLogs.map(log => log.userId || log.userName).filter(Boolean)).size
  const activeBranches = new Set(filteredLogs.map(log => log.branchId).filter(Boolean)).size
  const totalActiveDays = new Set(filteredLogs.map(log => getDateKey(log.createdAt)).filter(Boolean)).size
  const totalActiveHours = performanceSummaries.length
  const averageDailyActions = totalActiveDays > 0 ? Math.round((totalActions / totalActiveDays + Number.EPSILON) * 10) / 10 : 0
  const averageHourlyActions = totalActiveHours > 0 ? Math.round((totalActions / totalActiveHours + Number.EPSILON) * 10) / 10 : 0
  const busiestDay = [...dailyRows].sort((first, second) => second.totalActions - first.totalActions || second.peakUsageScore - first.peakUsageScore)[0]
  const busiestHour = [...hourlyRows].sort((first, second) => second.totalActions - first.totalActions || second.peakUsageScore - first.peakUsageScore)[0]
  const maxPeakScore = Math.max(0, ...performanceSummaries.map(summary => summary.peakUsageScore), ...dailyRows.map(row => row.peakUsageScore))

  const busiestDayRows = React.useMemo<StatRow[]>(() => {
    return [...dailyRows]
      .sort((first, second) => second.totalActions - first.totalActions || second.peakUsageScore - first.peakUsageScore)
      .map(row => ({ key: row.key, label: row.label, count: row.totalActions, detail: `${formatNumber(row.totalActions)} işlem · ${formatNumber(row.peakUsageScore)} skor` }))
  }, [dailyRows])

  const busiestHourRows = React.useMemo<StatRow[]>(() => {
    return [...hourlyRows]
      .sort((first, second) => second.totalActions - first.totalActions || second.peakUsageScore - first.peakUsageScore || Number(first.key) - Number(second.key))
      .map(row => ({ key: row.key, label: row.label, count: row.totalActions, detail: `${formatNumber(row.totalActions)} işlem · ${formatNumber(row.activeUsers)} kullanıcı` }))
  }, [hourlyRows])

  const activeUserRows = React.useMemo<StatRow[]>(() => {
    return userSummaries
      .filter(summary => summary.totalActions > 0)
      .sort((first, second) => second.totalActions - first.totalActions || first.userName.localeCompare(second.userName, 'tr-TR'))
      .map(summary => ({ key: summary.userId, label: summary.userName, count: summary.totalActions }))
  }, [userSummaries])

  const activeBranchRows = React.useMemo<StatRow[]>(() => {
    return businessSummaries
      .filter(summary => summary.totalActions > 0)
      .sort((first, second) => second.totalActions - first.totalActions || first.branchName.localeCompare(second.branchName, 'tr-TR'))
      .map(summary => ({ key: summary.branchId, label: summary.branchName, count: summary.totalActions }))
  }, [businessSummaries])

  const trendRows = React.useMemo<TrendRow[]>(() => {
    const weekStart = getStartOfWeek(today)
    const previousWeekStart = addDays(weekStart, -7)
    const previousWeekEnd = addDays(weekStart, -1)
    const monthStart = getMonthStart(today)
    const previousMonthStart = getPreviousMonthStart(today)
    const previousMonthEnd = getPreviousMonthEnd(today)
    const todayActions = sumActionsBetween(filteredLogs, todayKey, todayKey)
    const yesterdayActions = sumActionsBetween(filteredLogs, yesterdayKey, yesterdayKey)
    const weekActions = sumActionsBetween(filteredLogs, toDateKey(weekStart), todayKey)
    const previousWeekActions = sumActionsBetween(filteredLogs, toDateKey(previousWeekStart), toDateKey(previousWeekEnd))
    const monthActions = sumActionsBetween(filteredLogs, toDateKey(monthStart), todayKey)
    const previousMonthActions = sumActionsBetween(filteredLogs, toDateKey(previousMonthStart), toDateKey(previousMonthEnd))

    return [
      { key: 'today', label: 'Bugün vs Dün', current: todayActions, previous: yesterdayActions, change: calculateTrendChange(todayActions, yesterdayActions) },
      { key: 'week', label: 'Bu Hafta vs Geçen Hafta', current: weekActions, previous: previousWeekActions, change: calculateTrendChange(weekActions, previousWeekActions) },
      { key: 'month', label: 'Bu Ay vs Geçen Ay', current: monthActions, previous: previousMonthActions, change: calculateTrendChange(monthActions, previousMonthActions) }
    ]
  }, [filteredLogs, today, todayKey, yesterdayKey])

  const selectedDetail = React.useMemo(() => {
    const target = selectedTarget || (busiestDay ? { type: 'day' as const, key: busiestDay.key } : null)
    if(!target) return null
    const targetLogs = filteredLogs.filter(log => {
      if(target.type === 'day') return getDateKey(log.createdAt) === target.key
      return getHour(log.createdAt) === Number(target.key)
    })
    const activeDetailUsers = new Set(targetLogs.map(log => log.userId || log.userName).filter(Boolean)).size
    const activeDetailBranches = new Set(targetLogs.map(log => log.branchId).filter(Boolean)).size
    const score = calculateDensityScore(targetLogs.length, activeDetailUsers, activeDetailBranches)
    return {
      title: target.type === 'day' ? getDateLabel(target.key) : getHourLabel(Number(target.key)),
      totalActions: targetLogs.length,
      activeUsers: activeDetailUsers,
      activeBranches: activeDetailBranches,
      peakUsageScore: score,
      mostUsedModule: getMostUsedModule(targetLogs)
    }
  }, [busiestDay, filteredLogs, selectedTarget])

  const moduleTotal = moduleSummaries.reduce((sum, summary) => sum + summary.totalUsageCount, 0)

  return (
    <div className="usage-performance-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Performans ve Yoğunluk Analizleri</h2>
          <p className="muted">Sistem kullanım yoğunluklarını ve performans eğilimlerini analiz edin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam İşlem" value={formatNumber(totalActions)} detail="Filtreli kullanım kaydı" />
        <KpiCard label="Aktif Kullanıcı" value={formatNumber(activeUsers)} detail="Seçili aralıkta işlem yapan" />
        <KpiCard label="En Yoğun Gün" value={busiestDay?.label || '-'} detail={busiestDay ? `${formatNumber(busiestDay.totalActions)} işlem` : 'Veri yok'} />
        <KpiCard label="En Yoğun Saat" value={busiestHour?.label || '-'} detail={busiestHour ? `${formatNumber(busiestHour.totalActions)} işlem` : 'Veri yok'} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Ortalama Günlük İşlem" value={formatAverage(averageDailyActions)} detail={`${formatNumber(totalActiveDays)} aktif gün`} />
        <KpiCard label="Ortalama Saatlik İşlem" value={formatAverage(averageHourlyActions)} detail={`${formatNumber(totalActiveHours)} aktif saat`} />
        <KpiCard label="Maksimum Yoğunluk Skoru" value={formatNumber(maxPeakScore)} detail="0-100 arası tepe skor" />
        <KpiCard label="Aktif Şube Sayısı" value={formatNumber(activeBranches)} detail="Seçili aralıkta işlem yapan" />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Tarih aralığı, şube, kullanıcı ve modüle göre yoğunluk analizlerini süzün.</p>
          </div>
          <div className="toolbar-controls usage-performance-filters">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={userFilter} onChange={event => setUserFilter(event.target.value)}>
              <option value="all">Tüm Kullanıcılar</option>
              {userOptions.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value as 'all' | SystemUsageModuleName)}>
              <option value="all">Tüm Modüller</option>
              {moduleNames.map(moduleName => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="usage-performance-density-grid">
        <AnalysisCard title="Günlük Kullanım Yoğunluğu" rows={dailyRows.map(row => ({ key: row.key, label: row.label, count: row.totalActions, detail: `${formatNumber(row.totalActions)} işlem · ${formatNumber(row.peakUsageScore)} skor` }))} total={Math.max(1, totalActions)} />
        <AnalysisCard title="Saatlik Kullanım Yoğunluğu" rows={busiestHourRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="Haftalık Kullanım Yoğunluğu" rows={weeklyRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="Aylık Kullanım Yoğunluğu" rows={monthlyRows} total={Math.max(1, totalActions)} />
      </div>

      <div className="usage-performance-analysis-grid">
        <AnalysisCard title="En Yoğun Günler" rows={busiestDayRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Yoğun Saatler" rows={busiestHourRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Aktif Kullanıcılar" rows={activeUserRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Aktif Şubeler" rows={activeBranchRows} total={Math.max(1, totalActions)} />
        <TrendCard trends={trendRows} />
      </div>

      <div className="usage-performance-detail-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Saatlik Analiz</h3>
              <p className="muted">00:00 - 23:59 arası işlem, kullanıcı ve şube yoğunluğu.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table usage-performance-hour-table">
              <thead>
                <tr>
                  <th>Saat</th>
                  <th>İşlem Sayısı</th>
                  <th>Aktif Kullanıcı</th>
                  <th>Aktif Şube</th>
                  <th>Yoğunluk Skoru</th>
                </tr>
              </thead>
              <tbody>
                {hourlyRows.map(row => (
                  <tr key={row.key} className={selectedTarget?.type === 'hour' && selectedTarget.key === row.key ? 'selected-row' : ''} onClick={() => setSelectedTarget({ type: 'hour', key: row.key })}>
                    <td><strong>{row.label}</strong></td>
                    <td>{formatNumber(row.totalActions)}</td>
                    <td>{formatNumber(row.activeUsers)}</td>
                    <td>{formatNumber(row.activeBranches)}</td>
                    <td><span className="status-pill info-pill">{formatNumber(row.peakUsageScore)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h3>Günlük Analiz</h3>
              <p className="muted">{formatNumber(dailyRows.length)} gün listeleniyor.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table usage-performance-day-table">
              <thead>
                <tr>
                  <th>Gün</th>
                  <th>İşlem Sayısı</th>
                  <th>Aktif Kullanıcı</th>
                  <th>Aktif Şube</th>
                  <th>Yoğunluk Skoru</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.length === 0 && (
                  <tr><td colSpan={5} className="empty-cell">Filtrelere uygun günlük kullanım kaydı bulunamadı.</td></tr>
                )}
                {dailyRows.map(row => (
                  <tr key={row.key} className={(selectedTarget?.type === 'day' && selectedTarget.key === row.key) || (!selectedTarget && busiestDay?.key === row.key) ? 'selected-row' : ''} onClick={() => setSelectedTarget({ type: 'day', key: row.key })}>
                    <td><strong>{row.label}</strong></td>
                    <td>{formatNumber(row.totalActions)}</td>
                    <td>{formatNumber(row.activeUsers)}</td>
                    <td>{formatNumber(row.activeBranches)}</td>
                    <td><span className="status-pill info-pill">{formatNumber(row.peakUsageScore)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="usage-performance-summary-grid">
        <section className="card usage-performance-detail-card">
          <div className="section-header compact">
            <div>
              <h3>Detay Paneli</h3>
              <p className="muted">{selectedDetail ? selectedDetail.title : 'Gün veya saat seçilmedi.'}</p>
            </div>
          </div>
          {selectedDetail ? (
            <div className="financial-summary-values usage-performance-detail-values">
              <div>
                <span>Toplam İşlem</span>
                <strong>{formatNumber(selectedDetail.totalActions)}</strong>
              </div>
              <div>
                <span>Aktif Kullanıcı</span>
                <strong>{formatNumber(selectedDetail.activeUsers)}</strong>
              </div>
              <div>
                <span>Aktif Şube</span>
                <strong>{formatNumber(selectedDetail.activeBranches)}</strong>
              </div>
              <div>
                <span>Yoğunluk Skoru</span>
                <strong>{formatNumber(selectedDetail.peakUsageScore)}</strong>
              </div>
              <div>
                <span>En Aktif Modül</span>
                <strong>{selectedDetail.mostUsedModule}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Detay göstermek için kullanım kaydı bulunamadı.</p>
          )}
        </section>

        <section className="card usage-performance-detail-card">
          <div className="section-header compact">
            <div>
              <h3>Modül Yükü</h3>
              <p className="muted">Filtreli dönemde modül bazlı kullanım yükü.</p>
            </div>
          </div>
          <div className="system-usage-analysis-list">
            {moduleSummaries.filter(summary => summary.totalUsageCount > 0).slice(0, 5).map(summary => {
              const percentage = moduleTotal > 0 ? Math.round((summary.totalUsageCount / moduleTotal) * 100) : 0
              return (
                <div key={summary.moduleName}>
                  <div>
                    <strong>{summary.moduleName}</strong>
                    <span>{formatNumber(summary.totalUsageCount)} işlem</span>
                  </div>
                  <div>
                    <span className="status-pill info-pill">%{percentage}</span>
                    <div className="system-usage-bar"><span style={{ width: `${Math.min(100, percentage)}%` }} /></div>
                  </div>
                </div>
              )
            })}
            {moduleTotal === 0 && <p className="muted">Filtrelere uygun modül yükü bulunamadı.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
