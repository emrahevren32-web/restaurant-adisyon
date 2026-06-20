import React from 'react'
import { SystemUsageLog, UserActivitySummary } from '../types'
import { calculateUserActivitySummaries, loadBranches, loadSystemUsageLogs, loadUsers } from '../storage'

type ActivityStatus = 'Aktif' | 'Pasif' | 'Riskli'

type StatRow = {
  key: string
  label: string
  count: number
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

const formatDateTime = (createdAt: string) => {
  if(!createdAt) return '-'
  const date = new Date(createdAt)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatAverage = (value: number) => value.toLocaleString('tr-TR', {
  minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  maximumFractionDigits: 1
})

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

const getActivityStatus = (summary: UserActivitySummary, today: Date): ActivityStatus => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(dayDiff <= 7) return 'Aktif'
  if(dayDiff > 60) return 'Riskli'
  return 'Pasif'
}

const getStatusClassName = (status: ActivityStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Riskli') return 'danger-pill'
  return 'warning-pill'
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
    <section className="card user-activity-analysis-card">
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
                <span>{formatNumber(row.count)} {countLabel}</span>
              </div>
              <div>
                <span className="status-pill info-pill">%{percentage}</span>
                <div className="system-usage-bar"><span style={{ width: `${Math.min(100, percentage)}%` }} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function UserActivityTracking(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [users] = React.useState(() => loadUsers())
  const [branches] = React.useState(() => loadBranches())
  const [userFilter, setUserFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | ActivityStatus>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [selectedUserId, setSelectedUserId] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getDateKey(today.toISOString()), [today])
  const branchNameMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch.name])), [branches])

  const userOptions = React.useMemo(() => {
    const fromUsers = users.map(user => ({ id: user.id, name: user.fullName || user.username }))
    const fromLogs = logs.map(log => ({ id: log.userId, name: log.userName }))
    const unique = new Map([...fromUsers, ...fromLogs].filter(user => user.id).map(user => [user.id, user]))
    return Array.from(unique.values()).sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
  }, [logs, users])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesUser = userFilter === 'all' || log.userId === userFilter
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesUser && matchesBranch && matchesStart && matchesEnd
    })
  }, [branchFilter, endDate, logs, startDate, userFilter])

  const summaries = React.useMemo(() => {
    return calculateUserActivitySummaries(filteredLogs, users)
  }, [filteredLogs, users])

  const filteredSummaries = React.useMemo(() => {
    return summaries.filter(summary => {
      const status = getActivityStatus(summary, today)
      const matchesUser = userFilter === 'all' || summary.userId === userFilter
      const matchesBranch = branchFilter === 'all' || summary.branchId === branchFilter
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      return matchesUser && matchesBranch && matchesStatus
    })
  }, [branchFilter, summaries, statusFilter, today, userFilter])

  const selectedSummary = React.useMemo(() => {
    return filteredSummaries.find(summary => summary.userId === selectedUserId) || filteredSummaries[0]
  }, [filteredSummaries, selectedUserId])

  const totalUsers = filteredSummaries.length
  const activeUsers = filteredSummaries.filter(summary => getActivityStatus(summary, today) === 'Aktif').length
  const passiveUsers = filteredSummaries.filter(summary => getActivityStatus(summary, today) === 'Pasif').length
  const todayLoginUsers = new Set(filteredLogs
    .filter(log => log.actionType === 'Giriş Yapma' && getDateKey(log.createdAt) === todayKey)
    .map(log => log.userId)
    .filter(Boolean)).size
  const totalLogins = filteredSummaries.reduce((sum, summary) => sum + summary.totalLogins, 0)
  const totalActions = filteredSummaries.reduce((sum, summary) => sum + summary.totalActions, 0)
  const totalActiveDays = filteredSummaries.reduce((sum, summary) => sum + summary.activeDays, 0)
  const averageDailyActions = totalActiveDays > 0 ? Math.round((totalActions / totalActiveDays + Number.EPSILON) * 10) / 10 : 0
  const mostActiveUser = [...filteredSummaries].sort((first, second) => {
    const actionDiff = second.totalActions - first.totalActions
    if(actionDiff !== 0) return actionDiff
    return first.userName.localeCompare(second.userName, 'tr-TR')
  })[0]

  const mostActiveRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.totalActions - first.totalActions || first.userName.localeCompare(second.userName, 'tr-TR'))
      .map(summary => ({ key: summary.userId, label: summary.userName, count: summary.totalActions }))
  }, [filteredSummaries])

  const leastActiveRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => first.totalActions - second.totalActions || getDayDiff(second.lastActivityAt, today) - getDayDiff(first.lastActivityAt, today))
      .map(summary => ({ key: summary.userId, label: summary.userName, count: summary.totalActions }))
  }, [filteredSummaries, today])

  const moduleStats = React.useMemo(() => buildStats(filteredLogs, log => log.moduleName), [filteredLogs])
  const dayStats = React.useMemo(() => buildStats(filteredLogs, log => getDateKey(log.createdAt), key => {
    const date = new Date(`${key}T00:00:00`)
    return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString('tr-TR')
  }), [filteredLogs])

  return (
    <div className="user-activity-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Kullanıcı Aktivite Takibi</h2>
          <p className="muted">Kullanıcıların sistem kullanım alışkanlıklarını analiz edin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Kullanıcı" value={formatNumber(totalUsers)} detail={`${formatNumber(users.length)} kayıtlı kullanıcı`} />
        <KpiCard label="Aktif Kullanıcı" value={formatNumber(activeUsers)} detail="Son 7 gün içinde işlem" />
        <KpiCard label="Pasif Kullanıcı" value={formatNumber(passiveUsers)} detail="Düşük veya eski aktivite" />
        <KpiCard label="Bugün Giriş Yapanlar" value={formatNumber(todayLoginUsers)} detail={todayKey} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Toplam Giriş" value={formatNumber(totalLogins)} detail="Giriş Yapma kayıtları" />
        <KpiCard label="Toplam İşlem" value={formatNumber(totalActions)} detail="Filtreli kullanım kaydı" />
        <KpiCard label="Ortalama Günlük İşlem" value={formatAverage(averageDailyActions)} detail="Aktif gün başına" />
        <KpiCard label="En Aktif Kullanıcı" value={mostActiveUser?.userName || '-'} detail={mostActiveUser ? `${formatNumber(mostActiveUser.totalActions)} işlem` : 'Veri yok'} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Kullanıcı, şube, durum ve tarih aralığına göre aktivite özetlerini süzün.</p>
          </div>
          <div className="toolbar-controls user-activity-filters">
            <select value={userFilter} onChange={event => setUserFilter(event.target.value)}>
              <option value="all">Tüm Kullanıcılar</option>
              {userOptions.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | ActivityStatus)}>
              <option value="all">Tüm Durumlar</option>
              <option value="Aktif">Aktif</option>
              <option value="Pasif">Pasif</option>
              <option value="Riskli">Riskli</option>
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>
      </section>

      <div className="user-activity-analysis-grid">
        <AnalysisCard title="En Aktif Kullanıcılar" rows={mostActiveRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Az Aktif Kullanıcılar" rows={leastActiveRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Çok Kullanılan Modüller" rows={moduleStats} total={filteredLogs.length} />
        <AnalysisCard title="En Yoğun Kullanım Günleri" rows={dayStats} total={filteredLogs.length} />
      </div>

      <div className="user-activity-detail-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Kullanıcı Aktivite Tablosu</h3>
              <p className="muted">{formatNumber(filteredSummaries.length)} kullanıcı listeleniyor.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table user-activity-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Şube</th>
                  <th>Son Giriş</th>
                  <th>Son Aktivite</th>
                  <th>Toplam Giriş</th>
                  <th>Aktif Gün</th>
                  <th>Toplam İşlem</th>
                  <th>En Çok Kullanılan Modül</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">Filtrelere uygun kullanıcı aktivitesi bulunamadı.</td></tr>
                )}
                {filteredSummaries.map(summary => {
                  const status = getActivityStatus(summary, today)
                  return (
                    <tr key={summary.id} className={selectedSummary?.userId === summary.userId ? 'selected-row' : ''} onClick={() => setSelectedUserId(summary.userId)}>
                      <td><strong>{summary.userName}</strong></td>
                      <td>{branchNameMap.get(summary.branchId) || summary.branchId || '-'}</td>
                      <td>{formatDateTime(summary.lastLoginAt)}</td>
                      <td>{formatDateTime(summary.lastActivityAt)}</td>
                      <td>{formatNumber(summary.totalLogins)}</td>
                      <td>{formatNumber(summary.activeDays)}</td>
                      <td>{formatNumber(summary.totalActions)}</td>
                      <td>{summary.mostUsedModule || '-'}</td>
                      <td><span className={`status-pill ${getStatusClassName(status)}`}>{status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card user-activity-detail-card">
          <div className="section-header compact">
            <div>
              <h3>Kullanıcı Detayı</h3>
              <p className="muted">{selectedSummary ? selectedSummary.userName : 'Kullanıcı seçilmedi.'}</p>
            </div>
          </div>
          {selectedSummary ? (
            <div className="financial-summary-values user-activity-detail-values">
              <div>
                <span>Son Giriş Tarihi</span>
                <strong>{formatDateTime(selectedSummary.lastLoginAt)}</strong>
              </div>
              <div>
                <span>Son Aktivite Tarihi</span>
                <strong>{formatDateTime(selectedSummary.lastActivityAt)}</strong>
              </div>
              <div>
                <span>Toplam Giriş Sayısı</span>
                <strong>{formatNumber(selectedSummary.totalLogins)}</strong>
              </div>
              <div>
                <span>Toplam İşlem Sayısı</span>
                <strong>{formatNumber(selectedSummary.totalActions)}</strong>
              </div>
              <div>
                <span>En Çok Kullanılan Modül</span>
                <strong>{selectedSummary.mostUsedModule || '-'}</strong>
              </div>
              <div>
                <span>Aktif Gün Sayısı</span>
                <strong>{formatNumber(selectedSummary.activeDays)}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Detay göstermek için kullanıcı bulunamadı.</p>
          )}
        </section>
      </div>
    </div>
  )
}
