import React from 'react'
import { BusinessUsageSummary, SystemUsageLog } from '../types'
import {
  calculateBusinessUsageSummaries,
  calculateModuleUsageSummaries,
  calculateUserActivitySummaries,
  loadBranches,
  loadSystemUsageLogs,
  loadUsers
} from '../storage'

type BusinessStatus = 'Aktif' | 'Pasif' | 'Riskli'

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

const getBusinessStatus = (summary: BusinessUsageSummary, today: Date): BusinessStatus => {
  const dayDiff = getDayDiff(summary.lastActivityAt, today)
  if(dayDiff <= 7) return 'Aktif'
  if(dayDiff > 60) return 'Riskli'
  return 'Pasif'
}

const getStatusClassName = (status: BusinessStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Riskli') return 'danger-pill'
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
  countLabel = 'işlem'
}: {
  title: string
  rows: StatRow[]
  total: number
  countLabel?: string
}){
  const topRows = rows.slice(0, 5)

  return (
    <section className="card business-usage-analysis-card">
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

export default function BusinessUsageStats(){
  const [logs] = React.useState<SystemUsageLog[]>(() => loadSystemUsageLogs())
  const [branches] = React.useState(() => loadBranches())
  const [users] = React.useState(() => loadUsers())
  const [branchFilter, setBranchFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | BusinessStatus>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [selectedBranchId, setSelectedBranchId] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const branchNameMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch.name])), [branches])

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const dateKey = getDateKey(log.createdAt)
      const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate
      return matchesBranch && matchesStart && matchesEnd
    })
  }, [branchFilter, endDate, logs, startDate])

  const visibleBranches = React.useMemo(() => {
    return branchFilter === 'all'
      ? branches
      : branches.filter(branch => branch.id === branchFilter)
  }, [branchFilter, branches])

  const summaries = React.useMemo(() => {
    return calculateBusinessUsageSummaries(filteredLogs, visibleBranches)
  }, [filteredLogs, visibleBranches])

  const filteredSummaries = React.useMemo(() => {
    return summaries.filter(summary => {
      const status = getBusinessStatus(summary, today)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      return matchesStatus
    })
  }, [statusFilter, summaries, today])

  const selectedSummary = React.useMemo(() => {
    return filteredSummaries.find(summary => summary.branchId === selectedBranchId) || filteredSummaries[0]
  }, [filteredSummaries, selectedBranchId])

  const userSummaries = React.useMemo(() => calculateUserActivitySummaries(filteredLogs, users), [filteredLogs, users])
  const moduleSummaries = React.useMemo(() => calculateModuleUsageSummaries(filteredLogs), [filteredLogs])

  const totalBusinesses = filteredSummaries.length
  const activeBusinesses = filteredSummaries.filter(summary => getBusinessStatus(summary, today) === 'Aktif').length
  const passiveBusinesses = filteredSummaries.filter(summary => getBusinessStatus(summary, today) === 'Pasif').length
  const riskyBusinesses = filteredSummaries.filter(summary => getBusinessStatus(summary, today) === 'Riskli').length
  const totalUsers = new Set(filteredLogs.map(log => log.userId || log.userName).filter(Boolean)).size
  const totalActions = filteredSummaries.reduce((sum, summary) => sum + summary.totalActions, 0)
  const averageUsageScore = filteredSummaries.length > 0
    ? Math.round((filteredSummaries.reduce((sum, summary) => sum + summary.usageScore, 0) / filteredSummaries.length + Number.EPSILON) * 10) / 10
    : 0
  const mostActiveBusiness = [...filteredSummaries].sort((first, second) => {
    const scoreDiff = second.usageScore - first.usageScore
    if(scoreDiff !== 0) return scoreDiff
    const actionDiff = second.totalActions - first.totalActions
    if(actionDiff !== 0) return actionDiff
    return first.branchName.localeCompare(second.branchName, 'tr-TR')
  })[0]

  const mostActiveRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.totalActions - first.totalActions || second.usageScore - first.usageScore || first.branchName.localeCompare(second.branchName, 'tr-TR'))
      .map(summary => ({ key: summary.branchId, label: summary.branchName, count: summary.totalActions }))
  }, [filteredSummaries])

  const passiveRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => {
        const actionDiff = first.totalActions - second.totalActions
        if(actionDiff !== 0) return actionDiff
        const dayDiff = getDayDiff(second.lastActivityAt, today) - getDayDiff(first.lastActivityAt, today)
        if(dayDiff !== 0) return dayDiff
        return first.branchName.localeCompare(second.branchName, 'tr-TR')
      })
      .map(summary => ({ key: summary.branchId, label: summary.branchName, count: summary.totalActions }))
  }, [filteredSummaries, today])

  const moduleRows = React.useMemo<StatRow[]>(() => {
    return moduleSummaries
      .filter(summary => summary.totalUsageCount > 0)
      .map(summary => ({ key: summary.moduleName, label: summary.moduleName, count: summary.totalUsageCount }))
  }, [moduleSummaries])

  const branchComparisonRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.averageDailyActions - first.averageDailyActions || second.totalActions - first.totalActions)
      .map(summary => ({ key: summary.branchId, label: summary.branchName, count: Math.round(summary.averageDailyActions) }))
  }, [filteredSummaries])

  const usageScoreRows = React.useMemo<StatRow[]>(() => {
    return [...filteredSummaries]
      .sort((first, second) => second.usageScore - first.usageScore || first.branchName.localeCompare(second.branchName, 'tr-TR'))
      .map(summary => ({ key: summary.branchId, label: summary.branchName, count: summary.usageScore }))
  }, [filteredSummaries])

  const moduleTotal = moduleRows.reduce((sum, row) => sum + row.count, 0)
  const maxAverageDailyActions = Math.max(1, ...branchComparisonRows.map(row => row.count))
  const totalKnownUserActions = userSummaries.reduce((sum, summary) => sum + summary.totalActions, 0)

  return (
    <div className="business-usage-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>İşletme Kullanım İstatistikleri</h2>
          <p className="muted">İşletmelerin sistem kullanım yoğunluklarını ve aktiflik seviyelerini analiz edin.</p>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam İşletme" value={formatNumber(totalBusinesses)} detail="İzlenen şube/işletme sayısı" />
        <KpiCard label="Aktif İşletme" value={formatNumber(activeBusinesses)} detail="Son 7 gün içinde işlem" />
        <KpiCard label="Pasif İşletme" value={formatNumber(passiveBusinesses)} detail="Düşük veya eski aktivite" />
        <KpiCard label="Riskli İşletme" value={formatNumber(riskyBusinesses)} detail="Son 60 gün içinde işlem yok" />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Toplam Kullanıcı" value={formatNumber(totalUsers)} detail={`${formatNumber(totalKnownUserActions)} kullanıcı işlemi`} />
        <KpiCard label="Toplam İşlem" value={formatNumber(totalActions)} detail="Filtreli kullanım kaydı" />
        <KpiCard label="Ortalama Kullanım Skoru" value={formatAverage(averageUsageScore)} detail="0-100 arası sağlık skoru" />
        <KpiCard label="En Aktif İşletme" value={mostActiveBusiness?.branchName || '-'} detail={mostActiveBusiness ? `${formatNumber(mostActiveBusiness.usageScore)} skor` : 'Veri yok'} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">İşletme, durum ve tarih aralığına göre kullanım istatistiklerini süzün.</p>
          </div>
          <div className="toolbar-controls business-usage-filters">
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm İşletmeler</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | BusinessStatus)}>
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

      <div className="business-usage-analysis-grid">
        <AnalysisCard title="En Aktif İşletmeler" rows={mostActiveRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Pasif İşletmeler" rows={passiveRows} total={Math.max(1, totalActions)} />
        <AnalysisCard title="En Çok Kullanılan Modüller" rows={moduleRows} total={Math.max(1, moduleTotal)} />
        <AnalysisCard title="Şube Karşılaştırmaları" rows={branchComparisonRows} total={maxAverageDailyActions} countLabel="ort. işlem" />
        <AnalysisCard title="Kullanım Skoru Sıralaması" rows={usageScoreRows} total={100} countLabel="skor" />
      </div>

      <div className="business-usage-detail-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <h3>İşletme İstatistik Tablosu</h3>
              <p className="muted">{formatNumber(filteredSummaries.length)} işletme listeleniyor.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table business-usage-table">
              <thead>
                <tr>
                  <th>İşletme</th>
                  <th>Aktif Kullanıcı</th>
                  <th>Son Aktivite</th>
                  <th>Toplam Giriş</th>
                  <th>Toplam İşlem</th>
                  <th>Aktif Gün</th>
                  <th>En Çok Kullanılan Modül</th>
                  <th>Kullanım Skoru</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">Filtrelere uygun işletme kullanımı bulunamadı.</td></tr>
                )}
                {filteredSummaries.map(summary => {
                  const status = getBusinessStatus(summary, today)
                  return (
                    <tr key={summary.id} className={selectedSummary?.branchId === summary.branchId ? 'selected-row' : ''} onClick={() => setSelectedBranchId(summary.branchId)}>
                      <td><strong>{branchNameMap.get(summary.branchId) || summary.branchName}</strong></td>
                      <td>{formatNumber(summary.activeUserCount)}</td>
                      <td>{formatDateTime(summary.lastActivityAt)}</td>
                      <td>{formatNumber(summary.totalLogins)}</td>
                      <td>{formatNumber(summary.totalActions)}</td>
                      <td>{formatNumber(summary.activeDays)}</td>
                      <td>{summary.mostUsedModule || '-'}</td>
                      <td><span className="status-pill info-pill">{formatNumber(summary.usageScore)}</span></td>
                      <td><span className={`status-pill ${getStatusClassName(status)}`}>{status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card business-usage-detail-card">
          <div className="section-header compact">
            <div>
              <h3>İşletme Detayı</h3>
              <p className="muted">{selectedSummary ? selectedSummary.branchName : 'İşletme seçilmedi.'}</p>
            </div>
          </div>
          {selectedSummary ? (
            <div className="financial-summary-values business-usage-detail-values">
              <div>
                <span>Son Aktivite Tarihi</span>
                <strong>{formatDateTime(selectedSummary.lastActivityAt)}</strong>
              </div>
              <div>
                <span>Aktif Kullanıcı Sayısı</span>
                <strong>{formatNumber(selectedSummary.activeUserCount)}</strong>
              </div>
              <div>
                <span>Toplam Giriş</span>
                <strong>{formatNumber(selectedSummary.totalLogins)}</strong>
              </div>
              <div>
                <span>Toplam İşlem</span>
                <strong>{formatNumber(selectedSummary.totalActions)}</strong>
              </div>
              <div>
                <span>En Çok Kullanılan Modül</span>
                <strong>{selectedSummary.mostUsedModule || '-'}</strong>
              </div>
              <div>
                <span>Kullanım Skoru</span>
                <strong>{formatNumber(selectedSummary.usageScore)}</strong>
              </div>
              <div>
                <span>Aktif Gün Sayısı</span>
                <strong>{formatNumber(selectedSummary.activeDays)}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Detay göstermek için işletme bulunamadı.</p>
          )}
        </section>
      </div>
    </div>
  )
}
