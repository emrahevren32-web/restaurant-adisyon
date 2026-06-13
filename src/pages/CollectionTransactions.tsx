import React from 'react'
import { CollectionPaymentMethod, CollectionTransaction, CreditTransaction, CurrentAccount, User } from '../types'
import {
  addActionLog,
  loadCollectionTransactions,
  loadCreditTransactions,
  loadCurrentAccounts,
  saveCollectionTransactions
} from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type PaymentMethodFilter = CollectionPaymentMethod | 'all'

type CollectionFormValues = {
  currentAccountId: string
  date: string
  amount: string
  paymentMethod: CollectionPaymentMethod
  note: string
}

const paymentMethods: CollectionPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT', 'Diğer']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7)
const roundMoney = (value: number) => Math.round(value * 100) / 100

const toFormValues = (transaction: CollectionTransaction | null, accounts: CurrentAccount[]): CollectionFormValues => ({
  currentAccountId: transaction?.currentAccountId || accounts[0]?.id || '',
  date: transaction?.date || getLocalDateKey(new Date()),
  amount: transaction ? String(transaction.amount) : '',
  paymentMethod: transaction?.paymentMethod || 'Nakit',
  note: transaction?.note || ''
})

const getAccountDisplayName = (account?: CurrentAccount) => {
  if(!account) return 'Cari bulunamadı'
  return `${account.code} · ${account.name}`
}

const getOpenDebtByAccount = (credits: CreditTransaction[]) => {
  return credits.reduce<Record<string, number>>((acc, credit) => {
    if(credit.status !== 'Açık') return acc

    acc[credit.currentAccountId] = (acc[credit.currentAccountId] || 0) + credit.remainingAmount
    return acc
  }, {})
}

export default function CollectionTransactions({ currentUser }: Props){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [transactions, setTransactions] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [editingTransaction, setEditingTransaction] = React.useState<CollectionTransaction | null>(null)
  const [search, setSearch] = React.useState('')
  const [accountFilter, setAccountFilter] = React.useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = React.useState<PaymentMethodFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveCollectionTransactions(transactions)
  }, [transactions])

  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])
  const openDebtByAccount = React.useMemo(() => getOpenDebtByAccount(credits), [credits])

  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions])

  const visibleTransactions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedTransactions.filter(transaction => {
      const account = accountMap.get(transaction.currentAccountId)
      const dateKey = transaction.date
      const matchesSearch = !normalizedSearch
        || (account?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (account?.code || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || transaction.paymentMethod.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || transaction.note.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(transaction.amount).includes(normalizedSearch)

      const matchesAccount = accountFilter === 'all' || transaction.currentAccountId === accountFilter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || transaction.paymentMethod === paymentMethodFilter
      const matchesStartDate = !startDate || dateKey >= startDate
      const matchesEndDate = !endDate || dateKey <= endDate

      return matchesSearch && matchesAccount && matchesPaymentMethod && matchesStartDate && matchesEndDate
    })
  }, [accountFilter, accountMap, endDate, paymentMethodFilter, search, sortedTransactions, startDate])

  const today = getLocalDateKey(new Date())
  const currentMonth = getMonthKey(today)
  const totalCollection = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const todayCollection = transactions
    .filter(transaction => transaction.date === today)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthCollection = transactions
    .filter(transaction => getMonthKey(transaction.date) === currentMonth)
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const startEdit = (transaction: CollectionTransaction) => {
    setEditingTransaction(transaction)
    setFormError('')
  }

  const saveTransaction = (values: CollectionFormValues) => {
    const amount = Number(values.amount)
    const currentAccountId = values.currentAccountId
    const date = values.date
    const paymentMethod = values.paymentMethod
    const note = values.note.trim()

    if(!currentAccountId){
      setFormError('Cari seçimi zorunludur.')
      return false
    }

    if(!date){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Tutar sıfırdan büyük olmalıdır.')
      return false
    }

    const now = new Date().toISOString()
    const normalizedAmount = roundMoney(amount)
    const account = accountMap.get(currentAccountId)

    if(editingTransaction){
      const updatedTransaction: CollectionTransaction = {
        ...editingTransaction,
        currentAccountId,
        date,
        amount: normalizedAmount,
        paymentMethod,
        note,
        updatedAt: now
      }

      setTransactions(prev => prev.map(transaction => transaction.id === editingTransaction.id ? updatedTransaction : transaction))
      setEditingTransaction(null)
      setFormError('')
      addActionLog({
        operationType: 'Tahsilat güncellendi',
        user: currentUser,
        description: `${getAccountDisplayName(account)} tahsilat kaydı güncellendi. Tutar: ${formatCurrency(updatedTransaction.amount)}.`
      })
      return true
    }

    const transaction: CollectionTransaction = {
      id: createId('tahsilat'),
      currentAccountId,
      date,
      amount: normalizedAmount,
      paymentMethod,
      note,
      createdAt: now,
      updatedAt: now
    }

    setTransactions(prev => [transaction, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Tahsilat oluşturuldu',
      user: currentUser,
      description: `${getAccountDisplayName(account)} için ${formatCurrency(transaction.amount)} tahsilat oluşturuldu. Ödeme türü: ${transaction.paymentMethod}.`
    })
    return true
  }

  const deleteTransaction = (transaction: CollectionTransaction) => {
    if(!confirm(`${getAccountDisplayName(accountMap.get(transaction.currentAccountId))} tahsilat kaydı silinecek. Emin misiniz?`)) return

    const account = accountMap.get(transaction.currentAccountId)
    setTransactions(prev => prev.filter(item => item.id !== transaction.id))
    if(editingTransaction?.id === transaction.id) setEditingTransaction(null)
    addActionLog({
      operationType: 'Tahsilat silindi',
      user: currentUser,
      description: `${getAccountDisplayName(account)} tahsilat kaydı silindi. Tutar: ${formatCurrency(transaction.amount)}.`
    })
  }

  return (
    <div className="collection-transactions-page">
      <div className="page-title">
        <div>
          <h2>Tahsilat İşlemleri</h2>
          <p className="muted">Cari hesaplardan alınan tahsilat kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Tahsilat</span>
          <strong>{formatCurrency(totalCollection)}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Tahsilat</span>
          <strong>{formatCurrency(todayCollection)}</strong>
        </div>
        <div className="metric-card">
          <span>Bu Ay Tahsilat</span>
          <strong>{formatCurrency(monthCollection)}</strong>
        </div>
        <div className="metric-card">
          <span>İşlem Sayısı</span>
          <strong>{transactions.length}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Tahsilat Listesi</h3>
              <p className="muted">{visibleTransactions.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls collection-transaction-filters">
              <input
                type="search"
                placeholder="Cari, kod, ödeme türü veya açıklama ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={accountFilter} onChange={event => setAccountFilter(event.target.value)}>
                <option value="all">Tüm cariler</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <select value={paymentMethodFilter} onChange={event => setPaymentMethodFilter(event.target.value as PaymentMethodFilter)}>
                <option value="all">Tüm ödeme türleri</option>
                {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
              </select>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table collection-transaction-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Tutar</th>
                  <th>Ödeme Türü</th>
                  <th>Açıklama</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.length === 0 && (
                  <tr><td colSpan={6} className="empty-cell">Bu filtrelere uygun tahsilat kaydı bulunamadı.</td></tr>
                )}
                {visibleTransactions.map(transaction => {
                  const account = accountMap.get(transaction.currentAccountId)
                  const openDebt = openDebtByAccount[transaction.currentAccountId] || 0

                  return (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td>
                      <td>
                        <strong>{account?.name || 'Cari bulunamadı'}</strong>
                        <div className="muted small-text">{account?.code || transaction.currentAccountId}</div>
                        {openDebt > 0 && <div className="muted small-text">Açık veresiye: {formatCurrency(openDebt)}</div>}
                      </td>
                      <td><strong>{formatCurrency(transaction.amount)}</strong></td>
                      <td>{transaction.paymentMethod}</td>
                      <td>{transaction.note || '-'}</td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEdit(transaction)}>Düzenle</button>
                        <button className="btn" type="button" onClick={() => deleteTransaction(transaction)}>Sil</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>{editingTransaction ? 'Tahsilat Düzenle' : 'Yeni Tahsilat'}</h3>
              {editingTransaction && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <CollectionTransactionForm
              accounts={accounts}
              transaction={editingTransaction}
              onSave={saveTransaction}
              onCancel={editingTransaction ? () => {
                setEditingTransaction(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function CollectionTransactionForm({
  accounts,
  transaction,
  onSave,
  onCancel
}: {
  accounts: CurrentAccount[]
  transaction: CollectionTransaction | null
  onSave: (values: CollectionFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<CollectionFormValues>(() => toFormValues(transaction, accounts))

  React.useEffect(() => {
    setValues(toFormValues(transaction, accounts))
  }, [accounts, transaction])

  const updateField = <K extends keyof CollectionFormValues>(key: K, value: CollectionFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !transaction) setValues(toFormValues(null, accounts))
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Cari</label>
        <select value={values.currentAccountId} onChange={event => updateField('currentAccountId', event.target.value)} required>
          {accounts.length === 0 && <option value="">Cari kaydı yok</option>}
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tarih</label>
        <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Tutar</label>
        <input type="number" min="0" step="0.01" value={values.amount} onChange={event => updateField('amount', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Ödeme Türü</label>
        <select value={values.paymentMethod} onChange={event => updateField('paymentMethod', event.target.value as CollectionPaymentMethod)} required>
          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
