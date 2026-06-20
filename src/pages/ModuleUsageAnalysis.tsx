import React from 'react'
import { ModuleUsageSummary, SystemUsageLog, SystemUsageModuleName } from '../types'
import { calculateModuleUsageSummaries, loadBranches, loadSystemUsageLogs, loadUsers } from '../storage'

type ModuleStatus = 'Aktif' | 'Az Kullanılan' | 'Pasif'

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

const moduleNames: SystemUsageModuleName[] = [
  'Adisyon',
  'Masa Yönetimi',
  'Ürün Yönetimi',
  'Stok Yönetimi',
  'Cari Yönetimi',
  'Finans Yönetimi',
  'Personel Yönetimi',
  'Patron Dashboard',
  'Çoklu Şube Yönetimi',
  'Sistem'
]

const getDateKey = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
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

const getModuleStatus = (summary: ModuleUsageSummary, today: Date): ModuleStatus => {
  const dayDiff = getDayDiff(summary.lastUsedAt, today)
  if(dayDiff <= 7) return 'Aktif'
  if(dayDiff > 60) return 'Pasif'
  return 'Az Kullanılan'
}

const getStatusClassName = (status: ModuleStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Pasif') return 'danger-pill'
  return 'warning-pill'
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
  countLabel = 'kullanım'
}: {
  title: string
  rows: StatRow[]
  total: number
  countLabel?: string
}){
  const topRows = rows.slice(0, 5)

  return (
    <section className="card module-usage-analysis-card">
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

export default function ModuleUsageAnalysis(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [branches] = React.useState(() => loadBranches())
  const [users] = React.useState(() => loadUsers())
  const [moduleFilter, setModuleFilter] = React.useState<'all' | SystemUsageModuleName>('all')
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | ModuleStatus>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [selectedModuleName, setSelectedModuleName] = React.useState<SystemUsageModuleName | ''>('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getDateKey(today.toISOString()), [today])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesModule = moduleFilter === 'all' || log.moduleName === moduleFilter
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesModule && matchesBranch && matchesStart && matchesEnd
    })
  }, [branchFilter, endDate, logs, moduleFilter, startDate])

  const summaries = React.useMemo(() => {
    return calculateModuleUsageSummaries(filteredLogs)
  }, [filteredLogs])

  const filteredSummaries = React.useMemo(() => {
    return summaries.filter(summary => {
      const status = getModuleStatus(summary, today)
      const matchesModule = moduleFilter === 'all' || summary.moduleName === moduleFilter
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      return matchesModule && matchesStatus
    })
  }, [moduleFilter, statusFilter, summaries, today])

  const selectedSummary = React.useMemo(() => {
    return filteredSummaries.find(summary => summary.moduleName === selectedModuleName) || filteredSummaries[0]
  }, [filteredSummaries, selectedModuleName])

  const totalModules = filteredSummaries.length
  const activeModules = filteredSummaries.filter(summary => getModuleStatus(summary, today) === 'Aktif').length
  const passiveModules = filteredSummaries.filter(summary => getModuleStatus(summary, today) === 'Pasif').length
  const filteredModuleSet = new Set(filteredSummaries.map(summary => summary.moduleName))
  const todayUsedModules = new Set(filteredLogs
    .filter(log => getDateKey(log.createdAt) === todayKey && filteredModuleSet.has(log.moduleName))
    .map(log => log.moduleName)).size
  const totalUsage = filteredSummaries.reduce((sum, summary) => sum + summary.totalUsageCount, 0)
  const totalActiveDays = filteredSummaries.reduce((sum, summary) => sum + summary.activeDayCount, 0)
  const averageDailyUsage = totalActiveDays > 0 ? Math.round((totalUsage / totalActiveDays + Number.EPSILON) * 10) / 10 : 0
  const mostUsedModule = [...filteredSummaries].sort((first, second) => second.totalUsageCount - first.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))[0]
  const leastUsedModule = [...filteredSummaries].sort((first, second) => first.totalUsageCount - second.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))[0]

  const mostUsedRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.totalUsageCount - first.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))
      .map(summary => ({ key: summary.moduleName, label: summary.moduleName, count: summary.totalUsageCount }))
  }, [filteredSummaries])

  const leastUsedRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => first.totalUsageCount - second.totalUsageCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))
      .map(summary => ({ key: summary.moduleName, label: summary.moduleName, count: summary.totalUsageCount }))
  }, [filteredSummaries])

  const userDensityRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.uniqueUserCount - first.uniqueUserCount || first.moduleName.localeCompare(second.moduleName, 'tr-TR'))
      .map(summary => ({ key: summary.moduleName, label: summary.moduleName, count: summary.uniqueUserCount }))
  }, [filteredSummaries])

  const dayStats = React.useMemo(() => buildStats(filteredLogs, log => getDateKey(log.createdAt), key => {
    const date = new Date(`${key}T00:00:00`)
    return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString('tr-TR')
  }), [filteredLogs])

  const distributionRows = React.useMemo(() => {
    return buildStats(filteredLogs, log => log.moduleName)
  }, [filteredLogs])

  return (
    <div className="module-usage-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Modül Kullanım Analizleri</h2>
          <p className="muted">Modüllerin kullanım yoğunluklarını ve kullanıcı davranışlarını analiz edin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Modül" value={formatNumber(totalModules)} detail="İzlenen modül sayısı" />
        <KpiCard label="Aktif Modül" value={formatNumber(activeModules)} detail="Son 7 gün içinde kullanım" />
        <KpiCard label="Pasif Modül" value={formatNumber(passiveModules)} detail="Son 60 gün içinde kullanım yok" />
        <KpiCard label="Bugün Kullanılan Modül" value={formatNumber(todayUsedModules)} detail={todayKey} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Toplam Kullanım" value={formatNumber(totalUsage)} detail="Filtreli log kaydı" />
        <KpiCard label="Ortalama Günlük Kullanım" value={formatAverage(averageDailyUsage)} detail="Aktif gün başına" />
        <KpiCard label="En Çok Kullanılan Modül" value={mostUsedModule?.moduleName || '-'} detail={mostUsedModule ? `${formatNumber(mostUsedModule.totalUsageCount)} kullanım` : 'Veri yok'} />
        <KpiCard label="En Az Kullanılan Modül" value={leastUsedModule?.moduleName || '-'} detail={leastUsedModule ? `${formatNumber(leastUsedModule.totalUsageCount)} kullanım` : 'Veri yok'} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Modül, şube, tarih aralığı ve duruma göre kullanım analizlerini süzün.</p>
          </div>
          <div className="toolbar-controls module-usage-filters">
            <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value as 'all' | SystemUsageModuleName)}>
              <option value="all">Tüm Modüller</option>
              {moduleNames.map(moduleName => <option key={moduleName} value={moduleName}>{moduleName}</option>)}
            </select>
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | ModuleStatus)}>
              <option value="all">Tüm Durumlar</option>
              <option value="Aktif">Aktif</option>
              <option value="Az Kullanılan">Az Kullanılan</option>
              <option value="Pasif">Pasif</option>
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>
      </section>

      <div className="module-usage-analysis-grid">
        <AnalysisCard title="En Çok Kullanılan Modüller" rows={mostUsedRows} total={Math.max(1, totalUsage)} />
        <AnalysisCard title="En Az Kullanılan Modüller" rows={leastUsedRows} total={Math.max(1, totalUsage)} />
        <AnalysisCard title="Kullanıcı Yoğunluğu Analizi" rows={userDensityRows} total={Math.max(1, users.length)} countLabel="kullanıcı" />
        <AnalysisCard title="Günlük Kullanım Trendleri" rows={dayStats} total={filteredLogs.length} />
        <AnalysisCard title="Modül Bazlı Kullanım Dağılımı" rows={distributionRows} total={filteredLogs.length} />
      </div>

      <div className="module-usage-detail-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <h3>Modül Analiz Tablosu</h3>
              <p className="muted">{formatNumber(filteredSummaries.length)} modül listeleniyor.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table module-usage-table">
              <thead>
                <tr>
                  <th>Modül</th>
                  <th>Toplam Kullanım</th>
                  <th>Benzersiz Kullanıcı</th>
                  <th>Aktif Gün</th>
                  <th>Günlük Ortalama</th>
                  <th>Son Kullanım</th>
                  <th>En Aktif Kullanıcı</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Filtrelere uygun modül kullanımı bulunamadı.</td></tr>
                )}
                {filteredSummaries.map(summary => {
                  const status = getModuleStatus(summary, today)
                  return (
                    <tr key={summary.id} className={selectedSummary?.moduleName === summary.moduleName ? 'selected-row' : ''} onClick={() => setSelectedModuleName(summary.moduleName)}>
                      <td><strong>{summary.moduleName}</strong></td>
                      <td>{formatNumber(summary.totalUsageCount)}</td>
                      <td>{formatNumber(summary.uniqueUserCount)}</td>
                      <td>{formatNumber(summary.activeDayCount)}</td>
                      <td>{formatAverage(summary.averageDailyUsage)}</td>
                      <td>{formatDateTime(summary.lastUsedAt)}</td>
                      <td>{summary.mostActiveUser || '-'}</td>
                      <td><span className={`status-pill ${getStatusClassName(status)}`}>{status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card module-usage-detail-card">
          <div className="section-header compact">
            <div>
              <h3>Modül Detayı</h3>
              <p className="muted">{selectedSummary ? selectedSummary.moduleName : 'Modül seçilmedi.'}</p>
            </div>
          </div>
          {selectedSummary ? (
            <div className="financial-summary-values module-usage-detail-values">
              <div>
                <span>Toplam Kullanım Sayısı</span>
                <strong>{formatNumber(selectedSummary.totalUsageCount)}</strong>
              </div>
              <div>
                <span>Benzersiz Kullanıcı Sayısı</span>
                <strong>{formatNumber(selectedSummary.uniqueUserCount)}</strong>
              </div>
              <div>
                <span>Son Kullanım Tarihi</span>
                <strong>{formatDateTime(selectedSummary.lastUsedAt)}</strong>
              </div>
              <div>
                <span>En Aktif Kullanıcı</span>
                <strong>{selectedSummary.mostActiveUser || '-'}</strong>
              </div>
              <div>
                <span>Günlük Ortalama Kullanım</span>
                <strong>{formatAverage(selectedSummary.averageDailyUsage)}</strong>
              </div>
              <div>
                <span>Aktif Gün Sayısı</span>
                <strong>{formatNumber(selectedSummary.activeDayCount)}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Detay göstermek için modül bulunamadı.</p>
          )}
        </section>
      </div>
    </div>
  )
}
