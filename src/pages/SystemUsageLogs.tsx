import React from 'react'
import { SystemUsageActionType, SystemUsageLog, SystemUsageModuleName } from '../types'
import { loadBranches, loadSystemUsageLogs, loadUsers } from '../storage'

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

const actionTypes: SystemUsageActionType[] = [
  'Görüntüleme',
  'Oluşturma',
  'Güncelleme',
  'Silme',
  'Giriş Yapma',
  'Çıkış Yapma',
  'Onaylama',
  'İptal Etme'
]

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
  const date = new Date(createdAt)
  if(Number.isNaN(date.getTime())) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString('tr-TR'),
    time: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

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
  total
}: {
  title: string
  rows: StatRow[]
  total: number
}){
  const topRows = rows.slice(0, 5)

  return (
    <section className="card system-usage-analysis-card">
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
                <span>{formatNumber(row.count)} işlem</span>
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

export default function SystemUsageLogs(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [branches] = React.useState(() => loadBranches())
  const [users] = React.useState(() => loadUsers())
  const [userFilter, setUserFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [moduleFilter, setModuleFilter] = React.useState<'all' | SystemUsageModuleName>('all')
  const [actionFilter, setActionFilter] = React.useState<'all' | SystemUsageActionType>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')

  const todayKey = React.useMemo(() => getDateKey(new Date().toISOString()), [])
  const branchNameMap = React.useMemo(() => {
    return new Map(branches.map(branch => [branch.id, branch.name]))
  }, [branches])

  const userOptions = React.useMemo(() => {
    const fromUsers = users.map(user => ({ id: user.id, name: user.fullName || user.username }))
    const fromLogs = logs.map(log => ({ id: log.userId, name: log.userName }))
    const unique = new Map([...fromUsers, ...fromLogs].filter(user => user.id).map(user => [user.id, user]))
    return Array.from(unique.values()).sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
  }, [logs, users])

  const branchOptions = React.useMemo(() => {
    const fromBranches = branches.map(branch => ({ id: branch.id, name: branch.name }))
    const fromLogs = logs.map(log => ({ id: log.branchId, name: branchNameMap.get(log.branchId) || log.branchId }))
    const unique = new Map([...fromBranches, ...fromLogs].filter(branch => branch.id).map(branch => [branch.id, branch]))
    return Array.from(unique.values()).sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
  }, [branchNameMap, branches, logs])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesUser = userFilter === 'all' || log.userId === userFilter
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      const matchesModule = moduleFilter === 'all' || log.moduleName === moduleFilter
      const matchesAction = actionFilter === 'all' || log.actionType === actionFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesUser && matchesBranch && matchesModule && matchesAction && matchesStart && matchesEnd
    })
  }, [actionFilter, branchFilter, endDate, logs, moduleFilter, startDate, userFilter])

  const moduleStats = React.useMemo(() => buildStats(filteredLogs, log => log.moduleName), [filteredLogs])
  const userStats = React.useMemo(() => buildStats(filteredLogs, log => log.userId, key => {
    return userOptions.find(user => user.id === key)?.name || key
  }), [filteredLogs, userOptions])
  const dayStats = React.useMemo(() => buildStats(filteredLogs, log => getDateKey(log.createdAt), key => {
    const date = new Date(`${key}T00:00:00`)
    return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString('tr-TR')
  }), [filteredLogs])
  const actionStats = React.useMemo(() => buildStats(filteredLogs, log => log.actionType), [filteredLogs])

  const todaysOperations = filteredLogs.filter(log => getDateKey(log.createdAt) === todayKey).length
  const activeUserCount = new Set(filteredLogs.map(log => log.userId).filter(Boolean)).size
  const mostUsedModule = moduleStats[0]?.label || '-'

  return (
    <div className="system-usage-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Sistem Kullanım Logları</h2>
          <p className="muted">Sistemde gerçekleşen kullanıcı hareketlerini inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Log" value={formatNumber(filteredLogs.length)} detail={`${formatNumber(logs.length)} toplam kayıt`} />
        <KpiCard label="Bugünkü İşlem" value={formatNumber(todaysOperations)} detail={todayKey} />
        <KpiCard label="Aktif Kullanıcı" value={formatNumber(activeUserCount)} detail="Filtreli benzersiz kullanıcı" />
        <KpiCard label="En Çok Kullanılan Modül" value={mostUsedModule} detail={moduleStats[0] ? `${formatNumber(moduleStats[0].count)} işlem` : 'Veri yok'} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Kullanıcı, şube, modül, işlem türü ve tarih aralığına göre logları süzün.</p>
          </div>
          <div className="toolbar-controls system-usage-filters">
            <select value={userFilter} onChange={event => setUserFilter(event.target.value)}>
              <option value="all">Tüm Kullanıcılar</option>
              {userOptions.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value as 'all' | SystemUsageModuleName)}>
              <option value="all">Tüm Modüller</option>
              {moduleNames.map(moduleName => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
            </select>
            <select value={actionFilter} onChange={event => setActionFilter(event.target.value as 'all' | SystemUsageActionType)}>
              <option value="all">Tüm İşlem Türleri</option>
              {actionTypes.map(actionType => <option key={actionType} value={actionType}>{actionType}</option>)}
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>
      </section>

      <div className="system-usage-analysis-grid">
        <AnalysisCard title="En Çok Kullanılan Modüller" rows={moduleStats} total={filteredLogs.length} />
        <AnalysisCard title="En Aktif Kullanıcılar" rows={userStats} total={filteredLogs.length} />
        <AnalysisCard title="En Yoğun Günler" rows={dayStats} total={filteredLogs.length} />
        <AnalysisCard title="En Çok Yapılan İşlemler" rows={actionStats} total={filteredLogs.length} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Log Kayıtları</h3>
            <p className="muted">{formatNumber(filteredLogs.length)} kayıt gösteriliyor.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table system-usage-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>Şube</th>
                <th>Modül</th>
                <th>İşlem</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">Filtrelere uygun kullanım logu bulunamadı.</td></tr>
              )}
              {filteredLogs.map(log => {
                const dateTime = formatDateTime(log.createdAt)
                return (
                  <tr key={log.id}>
                    <td>
                      <strong>{dateTime.date}</strong>
                      <p className="muted small-text">{dateTime.time}</p>
                    </td>
                    <td>{log.userName || '-'}</td>
                    <td>{branchNameMap.get(log.branchId) || log.branchId || '-'}</td>
                    <td><span className="status-pill info-pill">{log.moduleName}</span></td>
                    <td><span className="status-pill">{log.actionType}</span></td>
                    <td>{log.description || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
