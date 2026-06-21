import React from 'react'
import {
  BusinessUsageSummary,
  ModuleUsageSummary,
  SystemHealthMetric,
  SystemHealthMetricStatus,
  SystemUsageLog,
  UserActivitySummary,
  UsagePerformanceSummary
} from '../types'
import {
  calculateBusinessUsageSummaries,
  calculateModuleUsageSummaries,
  calculateSystemHealthMetrics,
  calculateUsagePerformanceSummaries,
  calculateUserActivitySummaries,
  loadActionLogs,
  loadBranches,
  loadSystemUsageLogs,
  loadUsers
} from '../storage'

type PeriodFilter = 'today' | 'week' | 'month' | 'year'

type StatRow = {
  key: string
  label: string
  count: number
  detail?: string
  status?: SystemHealthMetricStatus
}

type TelemetryItem = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  status?: SystemHealthMetricStatus
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

const getDateLabel = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString('tr-TR')
}

const getPeriodRange = (period: PeriodFilter, today: Date) => {
  if(period === 'today'){
    const todayKey = toDateKey(today)
    return { start: todayKey, end: todayKey }
  }
  if(period === 'week') return { start: toDateKey(getStartOfWeek(today)), end: toDateKey(today) }
  if(period === 'month') return { start: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: toDateKey(today) }
  return { start: toDateKey(new Date(today.getFullYear(), 0, 1)), end: toDateKey(today) }
}

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

const getUserStatus = (summary: UserActivitySummary, today: Date): SystemHealthMetricStatus => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(summary.totalActions === 0 || dayDiff > 60) return 'Kritik'
  if(dayDiff > 30) return 'Uyarı'
  return 'Sağlıklı'
}

const getBusinessStatus = (summary: BusinessUsageSummary, today: Date): SystemHealthMetricStatus => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(summary.totalActions === 0 || dayDiff > 60) return 'Kritik'
  if(dayDiff > 30) return 'Uyarı'
  return 'Sağlıklı'
}

const getModuleStatus = (summary: ModuleUsageSummary, today: Date): SystemHealthMetricStatus => {
  const dayDiff = getDayDiff(summary.lastUsedAt, today)
  if(summary.totalUsageCount === 0 || dayDiff > 60) return 'Kritik'
  if(dayDiff > 7) return 'Uyarı'
  return 'Sağlıklı'
}

const getStatusClassName = (status: SystemHealthMetricStatus) => {
  if(status === 'Sağlıklı') return 'success'
  if(status === 'Uyarı') return 'warning-pill'
  return 'danger-pill'
}

const getHealthScoreStatus = (score: number): SystemHealthMetricStatus => {
  if(score >= 80) return 'Sağlıklı'
  if(score >= 50) return 'Uyarı'
  return 'Kritik'
}

const calculateTrendChange = (current: number, previous: number) => {
  if(previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

const sumActionsBetween = (logs: SystemUsageLog[], startKey: string, endKey: string) => logs.filter(log => {
  const dateKey = getDateKey(log.createdAt)
  return dateKey >= startKey && dateKey <= endKey
}).length

const buildDailyRows = (logs: SystemUsageLog[]) => {
  const counts = new Map<string, number>()
  logs.forEach(log => {
    const key = getDateKey(log.createdAt)
    if(!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: getDateLabel(key), count }))
    .sort((first, second) => second.count - first.count || second.key.localeCompare(first.key))
}

const buildHourlyRows = (logs: SystemUsageLog[]) => {
  const counts = new Map<number, number>()
  logs.forEach(log => {
    const hour = getHour(log.createdAt)
    if(hour < 0) return
    counts.set(hour, (counts.get(hour) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([hour, count]) => ({ key: String(hour), label: getHourLabel(hour), count }))
    .sort((first, second) => second.count - first.count || Number(first.key) - Number(second.key))
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

function TelemetryCard({ title, status, items }: { title: string; status: SystemHealthMetricStatus; items: TelemetryItem[] }){
  return (
    <section className="card system-health-telemetry-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">Anlık sağlık metriği.</p>
        </div>
        <span className={`status-pill ${getStatusClassName(status)}`}>{status}</span>
      </div>
      <div className="financial-summary-values system-health-values">
        {items.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail && <small>{item.detail}</small>}
            {item.status && <em className={`status-pill ${getStatusClassName(item.status)}`}>{item.status}</em>}
          </div>
        ))}
      </div>
    </section>
  )
}

function RiskCard({ title, rows, total, emptyText }: { title: string; rows: StatRow[]; total: number; emptyText: string }){
  const topRows = rows.slice(0, 5)

  return (
    <section className="card system-health-risk-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{topRows.length > 0 ? 'Öncelikli 5 kayıt gösteriliyor.' : emptyText}</p>
        </div>
      </div>
      <div className="system-usage-analysis-list">
        {topRows.length === 0 && <p className="muted">{emptyText}</p>}
        {topRows.map(row => {
          const percentage = total > 0 ? Math.round((row.count / total) * 100) : 0
          return (
            <div key={row.key}>
              <div>
                <strong>{row.label}</strong>
                <span>{row.detail || `${formatNumber(row.count)} kayıt`}</span>
              </div>
              <div>
                {row.status && <span className={`status-pill ${getStatusClassName(row.status)}`}>{row.status}</span>}
                {!row.status && <span className="status-pill info-pill">%{Math.min(100, percentage)}</span>}
                <div className="system-usage-bar"><span style={{ width: `${Math.min(100, Math.max(percentage, row.status ? 100 : 0))}%` }} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function SystemHealthTelemetry(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [users] = React.useState(() => loadUsers())
  const [branches] = React.useState(() => loadBranches())
  const [actionLogs] = React.useState(() => loadActionLogs())
  const [periodFilter, setPeriodFilter] = React.useState<PeriodFilter>('month')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const today = React.useMemo(() => new Date(), [])
  const activeRange = React.useMemo(() => getPeriodRange(periodFilter, today), [periodFilter, today])
  const visibleBranches = React.useMemo(() => branchFilter === 'all' ? branches : branches.filter(branch => branch.id === branchFilter), [branchFilter, branches])

  const filteredLogs = React.useMemo(() => logs.filter(log => {
    const dateKey = getDateKey(log.createdAt)
    const matchesStart = !activeRange.start || dateKey >= activeRange.start
    const matchesEnd = !activeRange.end || dateKey <= activeRange.end
    const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
    return matchesStart && matchesEnd && matchesBranch
  }), [activeRange.end, activeRange.start, branchFilter, logs])

  const userSummaries = React.useMemo<UserActivitySummary[]>(() => calculateUserActivitySummaries(filteredLogs, users), [filteredLogs, users])
  const moduleSummaries = React.useMemo<ModuleUsageSummary[]>(() => calculateModuleUsageSummaries(filteredLogs), [filteredLogs])
  const businessSummaries = React.useMemo<BusinessUsageSummary[]>(() => calculateBusinessUsageSummaries(filteredLogs, visibleBranches), [filteredLogs, visibleBranches])
  const performanceSummaries = React.useMemo<UsagePerformanceSummary[]>(() => calculateUsagePerformanceSummaries(filteredLogs), [filteredLogs])
  const healthMetrics = React.useMemo<SystemHealthMetric[]>(() => calculateSystemHealthMetrics(filteredLogs, users, visibleBranches, actionLogs), [actionLogs, filteredLogs, users, visibleBranches])
  const dailyRows = React.useMemo(() => buildDailyRows(filteredLogs), [filteredLogs])
  const hourlyRows = React.useMemo(() => buildHourlyRows(filteredLogs), [filteredLogs])

  const metricMap = React.useMemo(() => new Map(healthMetrics.map(metric => [metric.metricName, metric])), [healthMetrics])
  const healthScore = metricMap.get('Sistem Sağlık Skoru')?.metricValue || 0
  const healthStatus = getHealthScoreStatus(healthScore)
  const totalActions = filteredLogs.length
  const activeUsers = userSummaries.filter(summary => summary.totalActions > 0 && getUserStatus(summary, today) === 'Sağlıklı').length
  const warningUsers = userSummaries.filter(summary => getUserStatus(summary, today) === 'Uyarı').length
  const riskyUsers = userSummaries.filter(summary => getUserStatus(summary, today) === 'Kritik').length
  const activeBusinesses = businessSummaries.filter(summary => getBusinessStatus(summary, today) === 'Sağlıklı').length
  const warningBusinesses = businessSummaries.filter(summary => getBusinessStatus(summary, today) === 'Uyarı').length
  const riskyBusinesses = businessSummaries.filter(summary => getBusinessStatus(summary, today) === 'Kritik').length
  const activeModules = moduleSummaries.filter(summary => getModuleStatus(summary, today) === 'Sağlıklı').length
  const lowUsageModules = moduleSummaries.filter(summary => getModuleStatus(summary, today) === 'Uyarı').length
  const passiveModules = moduleSummaries.filter(summary => getModuleStatus(summary, today) === 'Kritik').length
  const mostUsedModule = [...moduleSummaries].sort((first, second) => second.totalUsageCount - first.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))[0]
  const maxPeakScore = Math.max(0, ...performanceSummaries.map(summary => summary.peakUsageScore))
  const activeDayCount = new Set(filteredLogs.map(log => getDateKey(log.createdAt)).filter(Boolean)).size
  const averageDailyActions = activeDayCount > 0 ? Math.round((totalActions / activeDayCount + Number.EPSILON) * 10) / 10 : 0
  const busiestDay = dailyRows[0]
  const busiestHour = hourlyRows[0]
  const averageBusinessScore = businessSummaries.length > 0
    ? Math.round((businessSummaries.reduce((sum, summary) => sum + summary.usageScore, 0) / businessSummaries.length + Number.EPSILON) * 10) / 10
    : 0

  const thirtyDaysAgo = React.useMemo(() => toDateKey(addDays(today, -29)), [today])
  const previousThirtyStart = React.useMemo(() => toDateKey(addDays(today, -59)), [today])
  const previousThirtyEnd = React.useMemo(() => toDateKey(addDays(today, -30)), [today])
  const last30Actions = sumActionsBetween(filteredLogs, thirtyDaysAgo, toDateKey(today))
  const previous30Actions = sumActionsBetween(filteredLogs, previousThirtyStart, previousThirtyEnd)
  const last30Trend = calculateTrendChange(last30Actions, previous30Actions)

  const dataWarningMetrics = healthMetrics.filter(metric => metric.metricCategory === 'Veri' && metric.metricName !== 'Veri Bütünlüğü')
  const dataWarnings = dataWarningMetrics.reduce((sum, metric) => sum + metric.metricValue, 0)
  const dataHealthMetric = metricMap.get('Veri Bütünlüğü')

  const riskyUserRows = userSummaries
    .filter(summary => getUserStatus(summary, today) === 'Kritik')
    .map(summary => ({
      key: summary.userId,
      label: summary.userName,
      count: summary.totalActions,
      detail: summary.lastActivityAt ? `${formatNumber(summary.totalActions)} işlem · son aktivite ${getDateLabel(getDateKey(summary.lastActivityAt))}` : 'Kullanım kaydı yok',
      status: 'Kritik' as SystemHealthMetricStatus
    }))
    .sort((first, second) => first.count - second.count || first.label.localeCompare(second.label, 'tr-TR'))

  const riskyBusinessRows = businessSummaries
    .filter(summary => getBusinessStatus(summary, today) === 'Kritik')
    .map(summary => ({
      key: summary.branchId,
      label: summary.branchName,
      count: summary.totalActions,
      detail: `${formatNumber(summary.totalActions)} işlem · ${formatNumber(summary.usageScore)} skor`,
      status: 'Kritik' as SystemHealthMetricStatus
    }))
    .sort((first, second) => first.count - second.count || first.label.localeCompare(second.label, 'tr-TR'))

  const passiveModuleRows = moduleSummaries
    .filter(summary => getModuleStatus(summary, today) === 'Kritik')
    .map(summary => ({
      key: summary.moduleName,
      label: summary.moduleName,
      count: summary.totalUsageCount,
      detail: summary.lastUsedAt ? `${formatNumber(summary.totalUsageCount)} kullanım · son kullanım ${getDateLabel(getDateKey(summary.lastUsedAt))}` : 'Kullanım kaydı yok',
      status: 'Kritik' as SystemHealthMetricStatus
    }))
    .sort((first, second) => first.count - second.count || first.label.localeCompare(second.label, 'tr-TR'))

  const dataWarningRows = dataWarningMetrics
    .filter(metric => metric.metricValue > 0)
    .map(metric => ({
      key: metric.id,
      label: metric.metricName,
      count: metric.metricValue,
      detail: metric.description,
      status: metric.status
    }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'tr-TR'))

  return (
    <div className="system-health-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Sistem Sağlığı ve Telemetri</h2>
          <p className="muted">Sistem sağlığını, kullanım durumunu ve operasyonel riskleri izleyin.</p>
        </div>
        <span className={`status-pill ${getStatusClassName(healthStatus)}`}>{healthStatus}</span>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Sistem Sağlık Skoru" value={formatNumber(healthScore)} detail="0-100 arası genel skor" />
        <KpiCard label="Aktif Kullanıcı" value={formatNumber(activeUsers)} detail={`${formatNumber(userSummaries.length)} toplam kullanıcı`} />
        <KpiCard label="Aktif İşletme" value={formatNumber(activeBusinesses)} detail={`${formatNumber(businessSummaries.length)} toplam işletme`} />
        <KpiCard label="Toplam İşlem" value={formatNumber(totalActions)} detail="Filtreli kullanım kaydı" />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Riskli Kullanıcı" value={formatNumber(riskyUsers)} detail="Son 60 gün içinde işlem yok" />
        <KpiCard label="Riskli İşletme" value={formatNumber(riskyBusinesses)} detail="Son 60 gün içinde işlem yok" />
        <KpiCard label="Pasif Modül" value={formatNumber(passiveModules)} detail="Son 60 gün içinde kullanım yok" />
        <KpiCard label="Veri Uyarısı" value={formatNumber(dataWarnings)} detail="Veri bütünlüğü kontrolleri" />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Dönem ve şubeye göre sağlık metriklerini güncelleyin.</p>
          </div>
          <div className="toolbar-controls system-health-filters">
            <select value={periodFilter} onChange={event => setPeriodFilter(event.target.value as PeriodFilter)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Sağlık Durumları</h3>
            <p className="muted">Yeşil sağlıklı, sarı uyarı, kırmızı kritik durumları gösterir.</p>
          </div>
        </div>
        <div className="system-health-status-grid">
          <span className="status-pill success">Sağlıklı</span>
          <span className="status-pill warning-pill">Uyarı</span>
          <span className="status-pill danger-pill">Kritik</span>
        </div>
      </section>

      <div className="system-health-telemetry-grid">
        <TelemetryCard
          title="Kullanıcı Sağlığı"
          status={getHealthScoreStatus(metricMap.get('Aktif Kullanıcı Oranı')?.metricValue || 0)}
          items={[
            { label: 'Aktif Kullanıcı Sayısı', value: formatNumber(activeUsers), detail: 'Son 30 gün içinde aktif' },
            { label: 'Pasif Kullanıcı Sayısı', value: formatNumber(warningUsers), detail: '30-60 gün arası düşük kullanım', status: warningUsers > 0 ? 'Uyarı' : 'Sağlıklı' },
            { label: 'Riskli Kullanıcı Sayısı', value: formatNumber(riskyUsers), detail: '60 gün üzeri veya hiç kullanım yok', status: riskyUsers > 0 ? 'Kritik' : 'Sağlıklı' },
            { label: 'Son 30 Gün Kullanım Trendi', value: `${last30Trend >= 0 ? '+' : ''}${last30Trend}%`, detail: `${formatNumber(last30Actions)} / ${formatNumber(previous30Actions)} işlem` }
          ]}
        />
        <TelemetryCard
          title="İşletme Sağlığı"
          status={getHealthScoreStatus(metricMap.get('Aktif İşletme Oranı')?.metricValue || 0)}
          items={[
            { label: 'Aktif İşletme Sayısı', value: formatNumber(activeBusinesses), detail: 'Son 30 gün içinde aktif' },
            { label: 'Pasif İşletme Sayısı', value: formatNumber(warningBusinesses), detail: '30-60 gün arası düşük kullanım', status: warningBusinesses > 0 ? 'Uyarı' : 'Sağlıklı' },
            { label: 'Riskli İşletme Sayısı', value: formatNumber(riskyBusinesses), detail: '60 gün üzeri veya hiç kullanım yok', status: riskyBusinesses > 0 ? 'Kritik' : 'Sağlıklı' },
            { label: 'Ortalama Kullanım Skoru', value: formatAverage(averageBusinessScore), detail: 'İşletme skoru ortalaması' }
          ]}
        />
        <TelemetryCard
          title="Modül Sağlığı"
          status={getHealthScoreStatus(metricMap.get('Modül Kullanım Oranı')?.metricValue || 0)}
          items={[
            { label: 'Aktif Modüller', value: formatNumber(activeModules), detail: 'Son 7 gün içinde kullanım' },
            { label: 'Az Kullanılan Modüller', value: formatNumber(lowUsageModules), detail: '7-60 gün arası düşük kullanım', status: lowUsageModules > 0 ? 'Uyarı' : 'Sağlıklı' },
            { label: 'Pasif Modüller', value: formatNumber(passiveModules), detail: '60 gün üzeri veya hiç kullanım yok', status: passiveModules > 0 ? 'Kritik' : 'Sağlıklı' },
            { label: 'En Çok Kullanılan Modül', value: mostUsedModule?.moduleName || '-', detail: mostUsedModule ? `${formatNumber(mostUsedModule.totalUsageCount)} işlem` : 'Veri yok' }
          ]}
        />
        <TelemetryCard
          title="Performans Sağlığı"
          status={getHealthScoreStatus(metricMap.get('Kullanım Yoğunluğu')?.metricValue || 0)}
          items={[
            { label: 'En Yoğun Gün', value: busiestDay?.label || '-', detail: busiestDay ? `${formatNumber(busiestDay.count)} işlem` : 'Veri yok' },
            { label: 'En Yoğun Saat', value: busiestHour?.label || '-', detail: busiestHour ? `${formatNumber(busiestHour.count)} işlem` : 'Veri yok' },
            { label: 'Ortalama Günlük İşlem', value: formatAverage(averageDailyActions), detail: `${formatNumber(activeDayCount)} aktif gün` },
            { label: 'Maksimum Yoğunluk Skoru', value: formatNumber(maxPeakScore), detail: '0-100 arası tepe skor' }
          ]}
        />
        <TelemetryCard
          title="Veri Sağlığı"
          status={dataHealthMetric?.status || 'Sağlıklı'}
          items={dataWarningMetrics.map(metric => ({
            label: metric.metricName,
            value: formatNumber(metric.metricValue),
            detail: metric.description,
            status: metric.status
          }))}
        />
      </div>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Sağlık Metrikleri</h3>
            <p className="muted">Faz 19 verilerinden üretilen telemetri metrikleri.</p>
          </div>
        </div>
        <div className="system-health-metric-grid">
          {healthMetrics.slice(0, 6).map(metric => (
            <div key={metric.id}>
              <span>{metric.metricCategory}</span>
              <strong>{metric.metricName}</strong>
              <p>{formatNumber(metric.metricValue)}</p>
              <em className={`status-pill ${getStatusClassName(metric.status)}`}>{metric.status}</em>
            </div>
          ))}
        </div>
      </section>

      <div className="system-health-risk-grid">
        <RiskCard title="Riskli Kullanıcılar" rows={riskyUserRows} total={Math.max(1, userSummaries.length)} emptyText="Riskli kullanıcı yok." />
        <RiskCard title="Riskli İşletmeler" rows={riskyBusinessRows} total={Math.max(1, businessSummaries.length)} emptyText="Riskli işletme yok." />
        <RiskCard title="Pasif Modüller" rows={passiveModuleRows} total={Math.max(1, moduleSummaries.length)} emptyText="Pasif modül yok." />
        <RiskCard title="Veri Uyarıları" rows={dataWarningRows} total={Math.max(1, dataWarnings)} emptyText="Veri uyarısı yok." />
      </div>
    </div>
  )
}
