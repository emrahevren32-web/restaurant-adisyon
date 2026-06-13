import React from 'react'
import { CollectionTransaction, CreditTransaction, CurrentAccount } from '../types'
import { loadCollectionTransactions, loadCreditTransactions, loadCurrentAccounts } from '../storage'
import { formatCurrency } from '../billing'

type MovementTypeFilter = 'all' | 'debt' | 'collection'

type CurrentMovement = {
  id: string
  currentAccountId: string
  date: string
  type: 'Borç' | 'Tahsilat'
  description: string
  debit: number
  credit: number
  sortOrder: number
}

type CurrentMovementRow = CurrentMovement & {
  balance: number
}

const getAccountDisplayName = (account?: CurrentAccount) => {
  if(!account) return 'Cari bulunamadı'
  return `${account.code} · ${account.name}`
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const toDateValue = (dateKey: string, sortOrder: number) => {
  const parsed = new Date(dateKey).getTime()
  return Number.isNaN(parsed) ? sortOrder : parsed
}

const createDebtMovement = (transaction: CreditTransaction, index: number): CurrentMovement => ({
  id: `debt_${transaction.id}`,
  currentAccountId: transaction.currentAccountId,
  date: transaction.date,
  type: 'Borç',
  description: transaction.note || 'Veresiye kaydı',
  debit: transaction.amount,
  credit: 0,
  sortOrder: index
})

const createCollectionMovement = (transaction: CollectionTransaction, index: number): CurrentMovement => ({
  id: `collection_${transaction.id}`,
  currentAccountId: transaction.currentAccountId,
  date: transaction.date,
  type: 'Tahsilat',
  description: transaction.note || `${transaction.paymentMethod} tahsilat`,
  debit: 0,
  credit: transaction.amount,
  sortOrder: index
})

const buildMovementRows = (movements: CurrentMovement[]): CurrentMovementRow[] => {
  let balance = 0

  return movements.map(movement => {
    balance = roundMoney(balance + movement.debit - movement.credit)
    return {
      ...movement,
      balance
    }
  })
}

export default function CurrentAccountMovements(){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [accountFilter, setAccountFilter] = React.useState('all')
  const [movementTypeFilter, setMovementTypeFilter] = React.useState<MovementTypeFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')

  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])

  const allMovements = React.useMemo(() => {
    const debtMovements = credits.map(createDebtMovement)
    const collectionMovements = collections.map(createCollectionMovement)

    return [...debtMovements, ...collectionMovements].sort((a, b) => {
      const dateDiff = toDateValue(a.date, a.sortOrder) - toDateValue(b.date, b.sortOrder)
      if(dateDiff !== 0) return dateDiff

      return a.sortOrder - b.sortOrder
    })
  }, [collections, credits])

  const visibleMovements = React.useMemo(() => {
    return allMovements.filter(movement => {
      const matchesAccount = accountFilter === 'all' || movement.currentAccountId === accountFilter
      const matchesType = movementTypeFilter === 'all'
        || (movementTypeFilter === 'debt' && movement.type === 'Borç')
        || (movementTypeFilter === 'collection' && movement.type === 'Tahsilat')
      const matchesStartDate = !startDate || movement.date >= startDate
      const matchesEndDate = !endDate || movement.date <= endDate

      return matchesAccount && matchesType && matchesStartDate && matchesEndDate
    })
  }, [accountFilter, allMovements, endDate, movementTypeFilter, startDate])

  const rows = React.useMemo(() => buildMovementRows(visibleMovements), [visibleMovements])
  const selectedAccount = accountFilter === 'all' ? undefined : accountMap.get(accountFilter)

  const totalDebt = rows.reduce((sum, movement) => sum + movement.debit, 0)
  const totalCollection = rows.reduce((sum, movement) => sum + movement.credit, 0)
  const netBalance = roundMoney(totalDebt - totalCollection)

  const selectedAccountAllMovements = React.useMemo(() => {
    if(!selectedAccount) return []
    return allMovements.filter(movement => movement.currentAccountId === selectedAccount.id)
  }, [allMovements, selectedAccount])

  const selectedAccountDebt = selectedAccountAllMovements.reduce((sum, movement) => sum + movement.debit, 0)
  const selectedAccountCollection = selectedAccountAllMovements.reduce((sum, movement) => sum + movement.credit, 0)
  const selectedAccountBalance = roundMoney(selectedAccountDebt - selectedAccountCollection)

  return (
    <div className="current-account-movements-page">
      <div className="page-title">
        <div>
          <h2>Cari Hareketleri</h2>
          <p className="muted">Cari hesapların borç ve tahsilat hareketlerini inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Borç</span>
          <strong>{formatCurrency(totalDebt)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Tahsilat</span>
          <strong>{formatCurrency(totalCollection)}</strong>
        </div>
        <div className="metric-card">
          <span>Kalan Bakiye</span>
          <strong>{formatCurrency(netBalance)}</strong>
        </div>
        <div className="metric-card">
          <span>Hareket Sayısı</span>
          <strong>{rows.length}</strong>
        </div>
      </div>

      {selectedAccount && (
        <section className="card current-account-summary-card">
          <div className="section-header compact">
            <div>
              <h3>{selectedAccount.name}</h3>
              <p className="muted">{selectedAccount.code} · {selectedAccount.type}</p>
            </div>
            <span className={`status-pill ${selectedAccount.isActive ? 'success' : 'muted-pill'}`}>
              {selectedAccount.isActive ? 'Aktif' : 'Pasif'}
            </span>
          </div>

          <div className="current-account-summary-grid">
            <div>
              <span>Cari Adı</span>
              <strong>{selectedAccount.name}</strong>
            </div>
            <div>
              <span>Cari Türü</span>
              <strong>{selectedAccount.type}</strong>
            </div>
            <div>
              <span>Telefon</span>
              <strong>{selectedAccount.phone || '-'}</strong>
            </div>
            <div>
              <span>Yetkili</span>
              <strong>{selectedAccount.authorizedPerson || '-'}</strong>
            </div>
            <div>
              <span>Toplam Borç</span>
              <strong>{formatCurrency(selectedAccountDebt)}</strong>
            </div>
            <div>
              <span>Toplam Tahsilat</span>
              <strong>{formatCurrency(selectedAccountCollection)}</strong>
            </div>
            <div>
              <span>Net Bakiye</span>
              <strong>{formatCurrency(selectedAccountBalance)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Cari Ekstresi</h3>
            <p className="muted">{rows.length} hareket gösteriliyor. En eski kayıt üstte, en yeni kayıt altta.</p>
          </div>
          <div className="toolbar-controls current-account-movement-filters">
            <select value={accountFilter} onChange={event => setAccountFilter(event.target.value)}>
              <option value="all">Tüm cariler</option>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            <select value={movementTypeFilter} onChange={event => setMovementTypeFilter(event.target.value as MovementTypeFilter)}>
              <option value="all">Tümü</option>
              <option value="debt">Borç</option>
              <option value="collection">Tahsilat</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table current-account-movement-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Cari</th>
                <th>Hareket Türü</th>
                <th>Açıklama</th>
                <th>Borç</th>
                <th>Alacak</th>
                <th>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun cari hareketi bulunamadı.</td></tr>
              )}
              {rows.map(movement => {
                const account = accountMap.get(movement.currentAccountId)

                return (
                  <tr key={movement.id}>
                    <td>{movement.date}</td>
                    <td>
                      <strong>{account?.name || 'Cari bulunamadı'}</strong>
                      <div className="muted small-text">{account?.code || movement.currentAccountId}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${movement.type === 'Borç' ? 'warning-pill' : 'success'}`}>
                        {movement.type}
                      </span>
                    </td>
                    <td>{movement.description}</td>
                    <td>{movement.debit > 0 ? formatCurrency(movement.debit) : '-'}</td>
                    <td>{movement.credit > 0 ? formatCurrency(movement.credit) : '-'}</td>
                    <td><strong>{formatCurrency(movement.balance)}</strong></td>
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
