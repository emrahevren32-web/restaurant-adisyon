import React from 'react'
import { CollectionTransaction, CreditTransaction, CurrentAccount, CurrentAccountType } from '../types'
import { loadCollectionTransactions, loadCreditTransactions, loadCurrentAccounts } from '../storage'
import { formatCurrency } from '../billing'

type AccountTypeFilter = CurrentAccountType | 'all'

type CurrentReportRow = {
  account: CurrentAccount
  totalDebt: number
  totalCollection: number
  netBalance: number
  lastTransactionDate: string
  openCreditCount: number
  closedCreditCount: number
}

const accountTypes: CurrentAccountType[] = ['Müşteri', 'Firma', 'Personel', 'Tedarikçi']

const roundMoney = (value: number) => Math.round(value * 100) / 100

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const getLastDate = (dates: string[]) => {
  return dates.reduce((latest, date) => {
    if(!latest) return date
    return date > latest ? date : latest
  }, '')
}

const sumAmounts = <T extends { amount: number }>(items: T[]) => {
  return roundMoney(items.reduce((sum, item) => sum + item.amount, 0))
}

const buildCurrentReportRows = ({
  accounts,
  credits,
  collections,
  typeFilter,
  startDate,
  endDate
}: {
  accounts: CurrentAccount[]
  credits: CreditTransaction[]
  collections: CollectionTransaction[]
  typeFilter: AccountTypeFilter
  startDate: string
  endDate: string
}): CurrentReportRow[] => {
  const typeFilteredAccounts = accounts.filter(account => typeFilter === 'all' || account.type === typeFilter)
  const accountIds = new Set(typeFilteredAccounts.map(account => account.id))
  const dateFilteredCredits = credits.filter(transaction => {
    return accountIds.has(transaction.currentAccountId) && isDateInRange(transaction.date, startDate, endDate)
  })
  const dateFilteredCollections = collections.filter(transaction => {
    return accountIds.has(transaction.currentAccountId) && isDateInRange(transaction.date, startDate, endDate)
  })
  const hasDateFilter = Boolean(startDate || endDate)
  const accountIdsWithMovement = new Set([
    ...dateFilteredCredits.map(transaction => transaction.currentAccountId),
    ...dateFilteredCollections.map(transaction => transaction.currentAccountId)
  ])
  const reportAccounts = hasDateFilter
    ? typeFilteredAccounts.filter(account => accountIdsWithMovement.has(account.id))
    : typeFilteredAccounts

  return reportAccounts.map(account => {
    const accountCredits = dateFilteredCredits.filter(transaction => transaction.currentAccountId === account.id)
    const accountCollections = dateFilteredCollections.filter(transaction => transaction.currentAccountId === account.id)
    const totalDebt = sumAmounts(accountCredits)
    const totalCollection = sumAmounts(accountCollections)
    const netBalance = roundMoney(totalDebt - totalCollection)
    const lastTransactionDate = getLastDate([
      ...accountCredits.map(transaction => transaction.date),
      ...accountCollections.map(transaction => transaction.date)
    ])

    return {
      account,
      totalDebt,
      totalCollection,
      netBalance,
      lastTransactionDate,
      openCreditCount: accountCredits.filter(transaction => transaction.status === 'Açık').length,
      closedCreditCount: accountCredits.filter(transaction => transaction.status === 'Kapandı').length
    }
  }).sort((first, second) => {
    if(second.netBalance !== first.netBalance) return second.netBalance - first.netBalance
    return first.account.name.localeCompare(second.account.name, 'tr-TR')
  })
}

export default function CurrentReport(){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [typeFilter, setTypeFilter] = React.useState<AccountTypeFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')

  const rows = React.useMemo(() => buildCurrentReportRows({
    accounts,
    credits,
    collections,
    typeFilter,
    startDate,
    endDate
  }), [accounts, collections, credits, endDate, startDate, typeFilter])

  const totalDebt = rows.reduce((sum, row) => sum + row.totalDebt, 0)
  const totalCollection = rows.reduce((sum, row) => sum + row.totalCollection, 0)
  const totalBalance = roundMoney(totalDebt - totalCollection)
  const openCreditCount = rows.reduce((sum, row) => sum + row.openCreditCount, 0)
  const closedCreditCount = rows.reduce((sum, row) => sum + row.closedCreditCount, 0)
  const debtorAccountCount = rows.filter(row => row.netBalance > 0).length
  const zeroBalanceAccountCount = rows.filter(row => row.netBalance === 0).length
  const highestDebtors = rows.filter(row => row.netBalance > 0).slice(0, 5)
  const topCollections = [...rows]
    .filter(row => row.totalCollection > 0)
    .sort((first, second) => second.totalCollection - first.totalCollection)
    .slice(0, 5)
  const recentAccounts = [...rows]
    .filter(row => row.lastTransactionDate)
    .sort((first, second) => second.lastTransactionDate.localeCompare(first.lastTransactionDate))
    .slice(0, 10)

  return (
    <div className="current-report-page">
      <div className="page-title">
        <div>
          <h2>Cari Raporu</h2>
          <p className="muted">Cari hesapların borç, tahsilat ve bakiye durumlarını analiz edin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Cari</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Borç</span>
          <strong>{formatCurrency(totalDebt)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Tahsilat</span>
          <strong>{formatCurrency(totalCollection)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Bakiye</span>
          <strong>{formatCurrency(totalBalance)}</strong>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Açık Veresiye</span>
          <strong>{openCreditCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kapalı Veresiye</span>
          <strong>{closedCreditCount}</strong>
        </div>
        <div className="metric-card">
          <span>Borçlu Cari Sayısı</span>
          <strong>{debtorAccountCount}</strong>
        </div>
        <div className="metric-card">
          <span>Sıfır Bakiyeli Cari Sayısı</span>
          <strong>{zeroBalanceAccountCount}</strong>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Cari türü ve tarih aralığına göre rapor verilerini daraltın.</p>
          </div>
          <div className="toolbar-controls current-report-filters">
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as AccountTypeFilter)}>
              <option value="all">Tüm cari türleri</option>
              {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="current-report-summary-grid">
        <CurrentReportListCard
          title="En Yüksek Borçlu 5 Cari"
          rows={highestDebtors}
          valueLabel="Net Bakiye"
          getValue={row => row.netBalance}
          emptyText="Borçlu cari bulunamadı."
        />
        <CurrentReportListCard
          title="En Çok Tahsilat Yapılan 5 Cari"
          rows={topCollections}
          valueLabel="Toplam Tahsilat"
          getValue={row => row.totalCollection}
          emptyText="Tahsilat yapılan cari bulunamadı."
        />
        <CurrentReportListCard
          title="En Son İşlem Yapılan 10 Cari"
          rows={recentAccounts}
          valueLabel="Son İşlem"
          getTextValue={row => row.lastTransactionDate}
          emptyText="İşlem yapılan cari bulunamadı."
        />
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Cari Bakiye Raporu</h3>
            <p className="muted">{rows.length} cari gösteriliyor.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table current-report-table">
            <thead>
              <tr>
                <th>Cari</th>
                <th>Tür</th>
                <th>Toplam Borç</th>
                <th>Toplam Tahsilat</th>
                <th>Net Bakiye</th>
                <th>Son İşlem Tarihi</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun cari rapor kaydı bulunamadı.</td></tr>
              )}
              {rows.map(row => {
                const status = row.netBalance > 0 ? 'Borçlu' : 'Temiz'

                return (
                  <tr key={row.account.id}>
                    <td>
                      <strong>{row.account.name}</strong>
                      <div className="muted small-text">{row.account.code}</div>
                    </td>
                    <td>{row.account.type}</td>
                    <td>{formatCurrency(row.totalDebt)}</td>
                    <td>{formatCurrency(row.totalCollection)}</td>
                    <td><strong>{formatCurrency(row.netBalance)}</strong></td>
                    <td>{row.lastTransactionDate || '-'}</td>
                    <td>
                      <span className={`status-pill ${status === 'Borçlu' ? 'warning-pill' : 'success'}`}>
                        {status}
                      </span>
                    </td>
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

function CurrentReportListCard({
  title,
  rows,
  valueLabel,
  getValue,
  getTextValue,
  emptyText
}: {
  title: string
  rows: CurrentReportRow[]
  valueLabel: string
  getValue?: (row: CurrentReportRow) => number
  getTextValue?: (row: CurrentReportRow) => string
  emptyText: string
}){
  return (
    <section className="card current-report-list-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>

      <div className="current-report-mini-list">
        {rows.length === 0 && <p className="muted">{emptyText}</p>}
        {rows.map(row => (
          <div className="current-report-mini-row" key={`${title}_${row.account.id}`}>
            <div>
              <strong>{row.account.name}</strong>
              <span>{row.account.code} · {row.account.type}</span>
            </div>
            <div>
              <span>{valueLabel}</span>
              <strong>{getValue ? formatCurrency(getValue(row)) : getTextValue?.(row) || '-'}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
