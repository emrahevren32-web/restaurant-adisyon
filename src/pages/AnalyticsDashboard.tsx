import React from 'react'
import { BusinessUsageSummary, ModuleUsageSummary, SystemUsageLog, UserActivitySummary, UsagePerformanceSummary } from '../types'
import {
  calculateBusinessUsageSummaries,
  calculateModuleUsageSummaries,
  calculateUsagePerformanceSummaries,
  calculateUserActivitySummaries,
  loadBranches,
  loadSystemUsageLogs,
  loadUsers
} from '../storage'

type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'custom'

type StatRow = {
  key: string
  label: string
  count: number
  detail?: string
}

type TrendRow = {
  key: string
  label: string
  current: number
  previous: number
  change: number
}

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}

const getDateKey = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getHour = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? -1 : date.getHours()
}

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

const getDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString('tr-TR')
}

const getHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`

const getDayDiff = (createdAt: string, today: Date) => {
  if(!createdAt) return Number.POSITIVE_INFINITY
  const date = new Date(createdAt)
  if(Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  return Math.floor((end.getTime() - start.getTime()) / 86400000)
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatAverage = (value: number) => value.toLocaleString('tr-TR', {
  minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  maximumFractionDigits: 1
})

const calculateTrendChange = (current: number, previous: number) => {
  if(previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

const sumActionsBetween = (logs: SystemUsageLog[], startKey: string, endKey: string) => logs.filter(log => {
  const dateKey = getDateKey(log.createdAt)
  return dateKey >= startKey && dateKey <= endKey
}).length

const getPeriodRange = (period: PeriodFilter, today: Date, customStart: string, customEnd: string) => {
  if(period === 'custom') return { start: customStart, end: customEnd }
  if(period === 'today'){
    const todayKey = toDateKey(today)
    return { start: todayKey, end: todayKey }
  }
  if(period === 'week'){
    return { start: toDateKey(getStartOfWeek(today)), end: toDateKey(today) }
  }
  if(period === 'month'){
    return { start: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: toDateKey(today) }
  }
  return { start: toDateKey(new Date(today.getFullYear(), 0, 1)), end: toDateKey(today) }
}

const getUserStatus = (summary: UserActivitySummary, today: Date) => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(summary.totalActions === 0 || dayDiff > 60) return 'Riskli'
  if(dayDiff <= 7) return 'Aktif'
  return 'Pasif'
}

const getModuleStatus = (summary: ModuleUsageSummary, today: Date) => {
  const dayDiff = getDayDiff(summary.lastUsedAt, today)
  if(summary.totalUsageCount === 0 || dayDiff > 60) return 'Pasif'
  if(dayDiff <= 7) return 'Aktif'
  return 'Az Kullanılan'
}

const getBusinessStatus = (summary: BusinessUsageSummary, today: Date) => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(summary.totalActions === 0 || dayDiff > 60) return 'Riskli'
  if(dayDiff <= 7) return 'Aktif'
  return 'Pasif'
}

const sortByCountDesc = (first: StatRow, second: StatRow) => {
  const countDiff = second.count - first.count
  if(countDiff !== 0) return countDiff
  return first.label.localeCompare(second.label, 'tr-TR')
}

const buildDailyRows = (logs: SystemUsageLog[]): StatRow[] => {
  const counts = new Map<string, number>()
  logs.forEach(log => {
    const key = getDateKey(log.createdAt)
    if(!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: getDateLabel(key), count }))
    .sort(sortByCountDesc)
}

const buildHourlyRows = (logs: SystemUsageLog[]): StatRow[] => {
  const counts = new Map<number, number>()
  logs.forEach(log => {
    const hour = getHour(log.createdAt)
    if(hour < 0) return
    counts.set(hour, (counts.get(hour) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([hour, count]) => ({ key: String(hour), label: getHourLabel(hour), count }))
    .sort(sortByCountDesc)
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

function SummaryCard({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode; detail?: React.ReactNode }[] }){
  return (
    <section className="card analytics-dashboard-summary-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">Filtreli döneme göre hesaplandı.</p>
        </div>
      </div>
      <div className="financial-summary-values analytics-dashboard-summary-values">
        {rows.map(row => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            {row.detail && <small>{row.detail}</small>}
          </div>
        ))}
      </div>
    </section>
  )
}

function DetailCard({
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
    <section className="card analytics-dashboard-detail-card">
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

function TrendSummaryCard({ trends }: { trends: TrendRow[] }){
  return (
    <section className="card analytics-dashboard-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Trend Özeti</h3>
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

export default function AnalyticsDashboard(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [branches] = React.useState(() => loadBranches())
  const [users] = React.useState(() => loadUsers())
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => toDateKey(today), [today])
  const yesterdayKey = React.useMemo(() => toDateKey(addDays(today, -1)), [today])
  const activeRange = React.useMemo(() => getPeriodRange(periodFilter, today, customStartDate, customEndDate), [customEndDate, customStartDate, periodFilter, today])

  const visibleBranches = React.useMemo(() => {
    return branchFilter === 'all' ? branches : branches.filter(branch => branch.id === branchFilter)
  }, [branchFilter, branches])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesStart = !activeRange.start || dateKey >= activeRange.start
      const matchesEnd = !activeRange.end || dateKey <= activeRange.end
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      return matchesStart && matchesEnd && matchesBranch
    })
  }, [activeRange.end, activeRange.start, branchFilter, logs])

  const userSummaries = React.useMemo<UserActivitySummary[]>(() => calculateUserActivitySummaries(filteredLogs, users), [filteredLogs, users])
  const moduleSummaries = React.useMemo<ModuleUsageSummary[]>(() => calculateModuleUsageSummaries(filteredLogs), [filteredLogs])
  const businessSummaries = React.useMemo<BusinessUsageSummary[]>(() => calculateBusinessUsageSummaries(filteredLogs, visibleBranches), [filteredLogs, visibleBranches])
  const performanceSummaries = React.useMemo<UsagePerformanceSummary[]>(() => calculateUsagePerformanceSummaries(filteredLogs), [filteredLogs])
  const dailyRows = React.useMemo(() => buildDailyRows(filteredLogs), [filteredLogs])
  const hourlyRows = React.useMemo(() => buildHourlyRows(filteredLogs), [filteredLogs])

  const totalActions = filteredLogs.length
  const totalUsers = branchFilter === 'all'
    ? new Set([...users.map(user => user.id), ...filteredLogs.map(log => log.userId).filter(Boolean)]).size
    : new Set(filteredLogs.map(log => log.userId || log.userName).filter(Boolean)).size
  const totalBusinesses = businessSummaries.length
  const totalModules = moduleSummaries.length
  const activeUsers = userSummaries.filter(summary => summary.totalActions > 0 && getUserStatus(summary, today) === 'Aktif').length
  const activeBusinesses = businessSummaries.filter(summary => getBusinessStatus(summary, today) === 'Aktif').length
  const activeModules = moduleSummaries.filter(summary => getModuleStatus(summary, today) === 'Aktif').length
  const passiveModules = moduleSummaries.filter(summary => getModuleStatus(summary, today) === 'Pasif').length
  const riskyUsers = userSummaries.filter(summary => getUserStatus(summary, today) === 'Riskli').length
  const riskyBusinesses = businessSummaries.filter(summary => getBusinessStatus(summary, today) === 'Riskli').length
  const todayLoginUsers = new Set(filteredLogs
    .filter(log => log.actionType === 'Giriş Yapma' && getDateKey(log.createdAt) === todayKey)
    .map(log => log.userId || log.userName)
    .filter(Boolean)).size

  const mostActiveUser = [...userSummaries].sort((first, second) => second.totalActions - first.totalActions || first.userName.localeCompare(second.userName, 'tr-TR'))[0]
  const leastActiveUser = [...userSummaries].sort((first, second) => first.totalActions - second.totalActions || first.userName.localeCompare(second.userName, 'tr-TR'))[0]
  const mostUsedModule = [...moduleSummaries].sort((first, second) => second.totalUsageCount - first.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))[0]
  const leastUsedModule = [...moduleSummaries].sort((first, second) => first.totalUsageCount - second.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))[0]
  const mostActiveBusiness = [...businessSummaries].sort((first, second) => second.totalActions - first.totalActions || second.usageScore - first.usageScore || first.branchName.localeCompare(second.branchName, 'tr-TR'))[0]
  const leastActiveBusiness = [...businessSummaries].sort((first, second) => first.totalActions - second.totalActions || first.usageScore - second.usageScore || first.branchName.localeCompare(second.branchName, 'tr-TR'))[0]
  const busiestDay = dailyRows[0]
  const busiestHour = hourlyRows[0]
  const maxPeakScore = Math.max(0, ...performanceSummaries.map(summary => summary.peakUsageScore))
  const activeDayCount = new Set(filteredLogs.map(log => getDateKey(log.createdAt)).filter(Boolean)).size
  const averageDailyActions = activeDayCount > 0 ? Math.round((totalActions / activeDayCount + Number.EPSILON) * 10) / 10 : 0
  const averageBusinessScore = businessSummaries.length > 0
    ? Math.round((businessSummaries.reduce((sum, summary) => sum + summary.usageScore, 0) / businessSummaries.length + Number.EPSILON) * 10) / 10
    : 0

  const trendRows = React.useMemo<TrendRow[]>(() => {
    const weekStart = getStartOfWeek(today)
    const previousWeekStart = addDays(weekStart, -7)
    const previousWeekEnd = addDays(weekStart, -1)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
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

  const activeUserRows = React.useMemo<StatRow[]>(() => userSummaries
    .filter(summary => summary.totalActions > 0)
    .map(summary => ({ key: summary.userId, label: summary.userName, count: summary.totalActions }))
    .sort(sortByCountDesc), [userSummaries])

  const activeBusinessRows = React.useMemo<StatRow[]>(() => businessSummaries
    .filter(summary => summary.totalActions > 0)
    .map(summary => ({ key: summary.branchId, label: summary.branchName, count: summary.totalActions, detail: `${formatNumber(summary.totalActions)} işlem · ${formatNumber(summary.usageScore)} skor` }))
    .sort(sortByCountDesc), [businessSummaries])

  const moduleRows = React.useMemo<StatRow[]>(() => moduleSummaries
    .filter(summary => summary.totalUsageCount > 0)
    .map(summary => ({ key: summary.moduleName, label: summary.moduleName, count: summary.totalUsageCount }))
    .sort(sortByCountDesc), [moduleSummaries])

  const hourRows = React.useMemo<StatRow[]>(() => hourlyRows.map(row => ({
    ...row,
    detail: `${formatNumber(row.count)} işlem`
  })), [hourlyRows])

  const dayRows = React.useMemo<StatRow[]>(() => dailyRows.map(row => ({
    ...row,
    detail: `${formatNumber(row.count)} işlem`
  })), [dailyRows])

  return (
    <div className="analytics-dashboard-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Analitik Kontrol Paneli</h2>
          <p className="muted">Sistem kullanım verilerini ve analitik sonuçları tek ekrandan yönetin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam İşlem" value={formatNumber(totalActions)} detail="Filtreli kullanım kaydı" />
        <KpiCard label="Toplam Kullanıcı" value={formatNumber(totalUsers)} detail="Kayıtlı ve log kaynaklı kullanıcı" />
        <KpiCard label="Toplam İşletme" value={formatNumber(totalBusinesses)} detail="Filtreye dahil şube" />
        <KpiCard label="Toplam Modül" value={formatNumber(totalModules)} detail="İzlenen modül sayısı" />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Aktif Kullanıcı" value={formatNumber(activeUsers)} detail="Son 7 gün içinde işlem" />
        <KpiCard label="Aktif İşletme" value={formatNumber(activeBusinesses)} detail="Son 7 gün içinde işlem" />
        <KpiCard label="En Aktif Modül" value={mostUsedModule?.moduleName || '-'} detail={mostUsedModule ? `${formatNumber(mostUsedModule.totalUsageCount)} işlem` : 'Veri yok'} />
        <KpiCard label="Ortalama Kullanım Skoru" value={formatAverage(averageBusinessScore)} detail="İşletme skoru ortalaması" />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Dönem ve şubeye göre tüm dashboard hesaplarını güncelleyin.</p>
          </div>
          <div className="toolbar-controls analytics-dashboard-filters">
            <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value as PeriodFilter)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} disabled={periodFilter !== 'custom'} />
            <input type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} disabled={periodFilter !== 'custom'} />
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="analytics-dashboard-summary-grid">
        <SummaryCard
          title="Kullanıcı Aktivite Özeti"
          rows={[
            { label: 'En Aktif Kullanıcı', value: mostActiveUser?.userName || '-', detail: mostActiveUser ? `${formatNumber(mostActiveUser.totalActions)} işlem` : 'Veri yok' },
            { label: 'En Az Aktif Kullanıcı', value: leastActiveUser?.userName || '-', detail: leastActiveUser ? `${formatNumber(leastActiveUser.totalActions)} işlem` : 'Veri yok' },
            { label: 'Bugün Giriş Yapanlar', value: formatNumber(todayLoginUsers), detail: todayKey },
            { label: 'Riskli Kullanıcı Sayısı', value: formatNumber(riskyUsers), detail: 'Son 60 gün içinde işlem yok' }
          ]}
        />
        <SummaryCard
          title="Modül Kullanım Özeti"
          rows={[
            { label: 'En Çok Kullanılan Modül', value: mostUsedModule?.moduleName || '-', detail: mostUsedModule ? `${formatNumber(mostUsedModule.totalUsageCount)} işlem` : 'Veri yok' },
            { label: 'En Az Kullanılan Modül', value: leastUsedModule?.moduleName || '-', detail: leastUsedModule ? `${formatNumber(leastUsedModule.totalUsageCount)} işlem` : 'Veri yok' },
            { label: 'Pasif Modül Sayısı', value: formatNumber(passiveModules), detail: 'Son 60 gün içinde kullanım yok' },
            { label: 'Aktif Modül Sayısı', value: formatNumber(activeModules), detail: 'Son 7 gün içinde kullanım' }
          ]}
        />
        <SummaryCard
          title="İşletme Kullanım Özeti"
          rows={[
            { label: 'En Aktif İşletme', value: mostActiveBusiness?.branchName || '-', detail: mostActiveBusiness ? `${formatNumber(mostActiveBusiness.totalActions)} işlem` : 'Veri yok' },
            { label: 'En Pasif İşletme', value: leastActiveBusiness?.branchName || '-', detail: leastActiveBusiness ? `${formatNumber(leastActiveBusiness.totalActions)} işlem` : 'Veri yok' },
            { label: 'Riskli İşletme Sayısı', value: formatNumber(riskyBusinesses), detail: 'Son 60 gün içinde işlem yok' },
            { label: 'Ortalama İşletme Skoru', value: formatAverage(averageBusinessScore), detail: '0-100 arası skor' }
          ]}
        />
        <SummaryCard
          title="Performans ve Yoğunluk Özeti"
          rows={[
            { label: 'En Yoğun Gün', value: busiestDay?.label || '-', detail: busiestDay ? `${formatNumber(busiestDay.count)} işlem` : 'Veri yok' },
            { label: 'En Yoğun Saat', value: busiestHour?.label || '-', detail: busiestHour ? `${formatNumber(busiestHour.count)} işlem` : 'Veri yok' },
            { label: 'Maksimum Yoğunluk Skoru', value: formatNumber(maxPeakScore), detail: '0-100 arası tepe skor' },
            { label: 'Ortalama Günlük İşlem', value: formatAverage(averageDailyActions), detail: `${formatNumber(activeDayCount)} aktif gün` }
          ]}
        />
      </div>

      <div className="analytics-dashboard-trend-grid">
        <TrendSummaryCard trends={trendRows} />
        <SummaryCard
          title="Trend Kısa Özeti"
          rows={trendRows.map(trend => ({
            label: trend.label,
            value: `${trend.change >= 0 ? '+' : ''}${trend.change}%`,
            detail: `${formatNumber(trend.current)} / ${formatNumber(trend.previous)} işlem`
          }))}
        />
      </div>

      <div className="analytics-dashboard-detail-grid">
        <DetailCard title="En Aktif Kullanıcılar" rows={activeUserRows} total={Math.max(1, totalActions)} />
        <DetailCard title="En Aktif İşletmeler" rows={activeBusinessRows} total={Math.max(1, totalActions)} />
        <DetailCard title="En Çok Kullanılan Modüller" rows={moduleRows} total={Math.max(1, totalActions)} />
        <DetailCard title="En Yoğun Saatler" rows={hourRows} total={Math.max(1, totalActions)} />
        <DetailCard title="En Yoğun Günler" rows={dayRows} total={Math.max(1, totalActions)} />
      </div>
    </div>
  )
}
