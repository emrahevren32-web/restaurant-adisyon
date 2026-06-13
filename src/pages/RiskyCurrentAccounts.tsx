import React from 'react'
import { CollectionTransaction, CreditTransaction, CurrentAccount, CurrentAccountType } from '../types'
import { loadCollectionTransactions, loadCreditTransactions, loadCurrentAccounts } from '../storage'
import { formatCurrency } from '../billing'

type RiskLevel = 'Yüksek' | 'Orta' | 'Düşük'
type RiskFilter = RiskLevel | 'all'
type AccountTypeFilter = CurrentAccountType | 'all'

type RiskyCurrentRow = {
  account: CurrentAccount
  totalDebt: number
  totalCollection: number
  netBalance: number
  lastCollectionDate: string
  daysSinceLastCollection?: number
  riskLevel: RiskLevel
  riskReason: string
  riskScore: number
}

const accountTypes: CurrentAccountType[] = ['Müşteri', 'Firma', 'Personel', 'Tedarikçi']
const riskLevels: RiskLevel[] = ['Yüksek', 'Orta', 'Düşük']
const HIGH_RISK_BALANCE = 10000
const MEDIUM_RISK_BALANCE = 5000
const HIGH_RISK_DAYS = 60
const MEDIUM_RISK_DAYS = 30

const roundMoney = (value: number) => Math.round(value * 100) / 100

const getDateKey = (value: Date) => value.toLocaleDateString('sv-SE')

const getLastDate = (dates: string[]) => {
  return dates.reduce((latest, date) => {
    if(!latest) return date
    return date > latest ? date : latest
  }, '')
}

const getDaysSince = (dateKey: string, todayKey: string) => {
  if(!dateKey) return undefined

  const date = new Date(dateKey)
  const today = new Date(todayKey)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return undefined

  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

const getRiskPillClass = (riskLevel: RiskLevel) => {
  if(riskLevel === 'Yüksek') return 'danger-pill'
  if(riskLevel === 'Orta') return 'warning-pill'
  return 'success'
}

const getRiskSortScore = (riskLevel: RiskLevel) => {
  if(riskLevel === 'Yüksek') return 3
  if(riskLevel === 'Orta') return 2
  return 1
}

const calculateRiskBalance = (totalDebt: number, totalCollection: number) => {
  const currentBalance = roundMoney(Math.max(0, totalDebt - totalCollection))
  return totalDebt >= HIGH_RISK_BALANCE ? roundMoney(totalDebt) : currentBalance
}

const getRiskResult = (netBalance: number, daysSinceLastCollection?: number) => {
  const highReasons: string[] = []
  const mediumReasons: string[] = []

  if(netBalance >= HIGH_RISK_BALANCE) highReasons.push('Yüksek Bakiye')
  if(daysSinceLastCollection !== undefined && daysSinceLastCollection >= HIGH_RISK_DAYS){
    highReasons.push('60+ Gün Tahsilat Yok')
  }

  if(highReasons.length > 0){
    return {
      riskLevel: 'Yüksek' as const,
      riskReason: highReasons.join(' · ')
    }
  }

  if(netBalance >= MEDIUM_RISK_BALANCE) mediumReasons.push('Orta Bakiye')
  if(daysSinceLastCollection !== undefined && daysSinceLastCollection >= MEDIUM_RISK_DAYS){
    mediumReasons.push('30+ Gün Tahsilat Yok')
  }

  if(mediumReasons.length > 0){
    return {
      riskLevel: 'Orta' as const,
      riskReason: mediumReasons.join(' · ')
    }
  }

  return {
    riskLevel: 'Düşük' as const,
    riskReason: 'Düşük Risk'
  }
}

const buildRiskRows = ({
  accounts,
  credits,
  collections,
  todayKey
}: {
  accounts: CurrentAccount[]
  credits: CreditTransaction[]
  collections: CollectionTransaction[]
  todayKey: string
}): RiskyCurrentRow[] => {
  return accounts.map(account => {
    const accountCredits = credits.filter(transaction => transaction.currentAccountId === account.id)
    const accountCollections = collections.filter(transaction => transaction.currentAccountId === account.id)
    const totalDebt = roundMoney(accountCredits.reduce((sum, transaction) => sum + transaction.amount, 0))
    const totalCollection = roundMoney(accountCollections.reduce((sum, transaction) => sum + transaction.amount, 0))
    const netBalance = calculateRiskBalance(totalDebt, totalCollection)
    const lastCollectionDate = getLastDate(accountCollections.map(transaction => transaction.date))
    const daysSinceLastCollection = getDaysSince(lastCollectionDate, todayKey)
    const risk = getRiskResult(netBalance, daysSinceLastCollection)
    const riskScore = getRiskSortScore(risk.riskLevel) * 100000000
      + netBalance
      + (daysSinceLastCollection || 0)

    return {
      account,
      totalDebt,
      totalCollection,
      netBalance,
      lastCollectionDate,
      daysSinceLastCollection,
      riskLevel: risk.riskLevel,
      riskReason: risk.riskReason,
      riskScore
    }
  }).sort((first, second) => {
    if(second.riskScore !== first.riskScore) return second.riskScore - first.riskScore
    return first.account.name.localeCompare(second.account.name, 'tr-TR')
  })
}

export default function RiskyCurrentAccounts(){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [riskFilter, setRiskFilter] = React.useState<RiskFilter>('all')
  const [typeFilter, setTypeFilter] = React.useState<AccountTypeFilter>('all')

  const todayKey = React.useMemo(() => getDateKey(new Date()), [])
  const rows = React.useMemo(() => buildRiskRows({
    accounts,
    credits,
    collections,
    todayKey
  }), [accounts, collections, credits, todayKey])

  const visibleRows = React.useMemo(() => {
    return rows.filter(row => {
      const matchesRisk = riskFilter === 'all' || row.riskLevel === riskFilter
      const matchesType = typeFilter === 'all' || row.account.type === typeFilter
      return matchesRisk && matchesType
    })
  }, [riskFilter, rows, typeFilter])

  const highRiskCount = visibleRows.filter(row => row.riskLevel === 'Yüksek').length
  const mediumRiskCount = visibleRows.filter(row => row.riskLevel === 'Orta').length
  const lowRiskCount = visibleRows.filter(row => row.riskLevel === 'Düşük').length
  const totalRiskAmount = visibleRows.reduce((sum, row) => sum + Math.max(0, row.netBalance), 0)
  const topRiskRows = visibleRows.slice(0, 10)

  return (
    <div className="risky-current-page">
      <div className="page-title">
        <div>
          <h2>Riskli Cari</h2>
          <p className="muted">Tahsilat riski taşıyan cari hesapları inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Yüksek Riskli Cari</span>
          <strong>{highRiskCount}</strong>
        </div>
        <div className="metric-card">
          <span>Orta Riskli Cari</span>
          <strong>{mediumRiskCount}</strong>
        </div>
        <div className="metric-card">
          <span>Düşük Riskli Cari</span>
          <strong>{lowRiskCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Risk Tutarı</span>
          <strong>{formatCurrency(totalRiskAmount)}</strong>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Risk seviyesi ve cari türüne göre listeyi daraltın.</p>
          </div>
          <div className="toolbar-controls risky-current-filters">
            <select value={riskFilter} onChange={event => setRiskFilter(event.target.value as RiskFilter)}>
              <option value="all">Tüm risk seviyeleri</option>
              {riskLevels.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as AccountTypeFilter)}>
              <option value="all">Tüm cari türleri</option>
              {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="risky-current-summary-grid">
        <section className="card current-report-list-card">
          <div className="section-header compact">
            <h3>En Riskli 10 Cari</h3>
          </div>
          <div className="current-report-mini-list">
            {topRiskRows.length === 0 && <p className="muted">Risk kriterlerine uygun cari bulunamadı.</p>}
            {topRiskRows.map(row => (
              <div className="current-report-mini-row" key={`risk_${row.account.id}`}>
                <div>
                  <strong>{row.account.name}</strong>
                  <span>{row.account.code} · {row.account.type}</span>
                </div>
                <div>
                  <span>{row.riskLevel} Risk</span>
                  <strong>{formatCurrency(row.netBalance)}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card risky-current-total-card">
          <div className="section-header compact">
            <h3>Toplam Risk Tutarı</h3>
          </div>
          <strong>{formatCurrency(totalRiskAmount)}</strong>
          <p className="muted">{visibleRows.length} cari üzerinden hesaplandı.</p>
        </section>

        <section className="card risky-current-distribution-card">
          <div className="section-header compact">
            <h3>Risk Dağılımı</h3>
          </div>
          <div className="risk-distribution-list">
            <div>
              <span className="status-pill danger-pill">Yüksek</span>
              <strong>{highRiskCount}</strong>
            </div>
            <div>
              <span className="status-pill warning-pill">Orta</span>
              <strong>{mediumRiskCount}</strong>
            </div>
            <div>
              <span className="status-pill success">Düşük</span>
              <strong>{lowRiskCount}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Riskli Cari Listesi</h3>
            <p className="muted">{visibleRows.length} cari gösteriliyor.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table risky-current-table">
            <thead>
              <tr>
                <th>Cari</th>
                <th>Tür</th>
                <th>Net Bakiye</th>
                <th>Son Tahsilat</th>
                <th>Risk Seviyesi</th>
                <th>Risk Nedeni</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">Bu filtrelere uygun riskli cari bulunamadı.</td></tr>
              )}
              {visibleRows.map(row => (
                <tr key={row.account.id}>
                  <td>
                    <strong>{row.account.name}</strong>
                    <div className="muted small-text">{row.account.code}</div>
                  </td>
                  <td>{row.account.type}</td>
                  <td><strong>{formatCurrency(row.netBalance)}</strong></td>
                  <td>
                    {row.lastCollectionDate || '-'}
                    {row.daysSinceLastCollection !== undefined && (
                      <div className="muted small-text">{row.daysSinceLastCollection} gün önce</div>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${getRiskPillClass(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                  <td>{row.riskReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
