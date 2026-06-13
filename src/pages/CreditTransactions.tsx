import React from 'react'
import { CreditTransaction, CurrentAccount, User } from '../types'
import { addActionLog, loadCreditTransactions, loadCurrentAccounts, saveCreditTransactions } from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type StatusFilter = 'all' | 'Açık' | 'Kapandı'

type CreditFormValues = {
  currentAccountId: string
  date: string
  amount: string
  note: string
}

type PaymentFormValues = {
  amount: string
  note: string
}

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const calculateCreditState = (amountValue: number, paidValue: number) => {
  const amount = Math.max(0, roundMoney(amountValue))
  const paidAmount = Math.min(amount, Math.max(0, roundMoney(paidValue)))
  const remainingAmount = roundMoney(Math.max(0, amount - paidAmount))

  return {
    amount,
    paidAmount,
    remainingAmount,
    status: remainingAmount > 0 ? 'Açık' as const : 'Kapandı' as const
  }
}

const toFormValues = (transaction: CreditTransaction | null, accounts: CurrentAccount[]): CreditFormValues => ({
  currentAccountId: transaction?.currentAccountId || accounts[0]?.id || '',
  date: transaction?.date || getLocalDateKey(new Date()),
  amount: transaction ? String(transaction.amount) : '',
  note: transaction?.note || ''
})

const getAccountDisplayName = (account?: CurrentAccount) => {
  if(!account) return 'Cari bulunamadı'
  return `${account.code} · ${account.name}`
}

export default function CreditTransactions({ currentUser }: Props){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [transactions, setTransactions] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [editingTransaction, setEditingTransaction] = React.useState<CreditTransaction | null>(null)
  const [paymentTransaction, setPaymentTransaction] = React.useState<CreditTransaction | null>(null)
  const [search, setSearch] = React.useState('')
  const [accountFilter, setAccountFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [formError, setFormError] = React.useState('')
  const [paymentError, setPaymentError] = React.useState('')

  React.useEffect(() => {
    saveCreditTransactions(transactions)
  }, [transactions])

  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])

  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions])

  const visibleTransactions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedTransactions.filter(transaction => {
      const account = accountMap.get(transaction.currentAccountId)
      const accountName = account?.name || ''
      const accountCode = account?.code || ''
      const matchesSearch = !normalizedSearch
        || accountName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || accountCode.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || transaction.note.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(transaction.amount).includes(normalizedSearch)

      const matchesAccount = accountFilter === 'all' || transaction.currentAccountId === accountFilter
      const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter

      return matchesSearch && matchesAccount && matchesStatus
    })
  }, [accountFilter, accountMap, search, sortedTransactions, statusFilter])

  const totalCredit = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const openCreditCount = transactions.filter(transaction => transaction.status === 'Açık').length
  const collectedTotal = transactions.reduce((sum, transaction) => sum + transaction.paidAmount, 0)
  const remainingTotal = transactions.reduce((sum, transaction) => sum + transaction.remainingAmount, 0)

  const startEdit = (transaction: CreditTransaction) => {
    setEditingTransaction(transaction)
    setFormError('')
  }

  const saveTransaction = (values: CreditFormValues) => {
    const amount = Number(values.amount)
    const currentAccountId = values.currentAccountId
    const date = values.date || getLocalDateKey(new Date())
    const note = values.note.trim()

    if(!currentAccountId){
      setFormError('Cari seçimi zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Tutar sıfırdan büyük olmalıdır.')
      return false
    }

    if(editingTransaction && amount < editingTransaction.paidAmount){
      setFormError('Tutar, tahsil edilen tutardan küçük olamaz.')
      return false
    }

    const now = new Date().toISOString()
    const account = accountMap.get(currentAccountId)

    if(editingTransaction){
      const amounts = calculateCreditState(amount, editingTransaction.paidAmount)
      const updatedTransaction: CreditTransaction = {
        ...editingTransaction,
        currentAccountId,
        date,
        note,
        ...amounts,
        updatedAt: now
      }

      setTransactions(prev => prev.map(transaction => transaction.id === editingTransaction.id ? updatedTransaction : transaction))
      setEditingTransaction(null)
      setFormError('')
      addActionLog({
        operationType: 'Veresiye güncellendi',
        user: currentUser,
        description: `${getAccountDisplayName(account)} veresiye kaydı güncellendi. Tutar: ${formatCurrency(amounts.amount)}.`
      })
      return true
    }

    const amounts = calculateCreditState(amount, 0)
    const transaction: CreditTransaction = {
      id: createId('veresiye'),
      currentAccountId,
      date,
      note,
      ...amounts,
      createdAt: now,
      updatedAt: now
    }

    setTransactions(prev => [transaction, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Veresiye oluşturuldu',
      user: currentUser,
      description: `${getAccountDisplayName(account)} için ${formatCurrency(transaction.amount)} veresiye kaydı oluşturuldu.`
    })
    return true
  }

  const savePayment = (values: PaymentFormValues) => {
    if(!paymentTransaction) return false

    const paymentAmount = Number(values.amount)
    const paymentNote = values.note.trim()

    if(!Number.isFinite(paymentAmount) || paymentAmount <= 0){
      setPaymentError('Tahsilat tutarı sıfırdan büyük olmalıdır.')
      return false
    }

    if(paymentAmount > paymentTransaction.remainingAmount){
      setPaymentError('Tahsilat tutarı kalan borçtan büyük olamaz.')
      return false
    }

    const now = new Date().toISOString()
    const amounts = calculateCreditState(paymentTransaction.amount, paymentTransaction.paidAmount + paymentAmount)
    const updatedNote = paymentNote
      ? [paymentTransaction.note, `Tahsilat: ${paymentNote}`].filter(Boolean).join('\n')
      : paymentTransaction.note
    const updatedTransaction: CreditTransaction = {
      ...paymentTransaction,
      ...amounts,
      note: updatedNote,
      updatedAt: now
    }
    const account = accountMap.get(paymentTransaction.currentAccountId)

    setTransactions(prev => prev.map(transaction => transaction.id === paymentTransaction.id ? updatedTransaction : transaction))
    if(editingTransaction?.id === paymentTransaction.id) setEditingTransaction(updatedTransaction)
    setPaymentTransaction(null)
    setPaymentError('')
    addActionLog({
      operationType: 'Tahsilat girildi',
      user: currentUser,
      description: `${getAccountDisplayName(account)} veresiye kaydına ${formatCurrency(paymentAmount)} tahsilat girildi. Kalan: ${formatCurrency(updatedTransaction.remainingAmount)}.`
    })
    return true
  }

  const closeTransaction = (transaction: CreditTransaction) => {
    if(transaction.status === 'Kapandı') return
    if(!confirm(`${getAccountDisplayName(accountMap.get(transaction.currentAccountId))} veresiye kaydı kapatılacak. Devam etmek istiyor musunuz?`)) return

    const now = new Date().toISOString()
    const amounts = calculateCreditState(transaction.amount, transaction.amount)
    const updatedTransaction: CreditTransaction = {
      ...transaction,
      ...amounts,
      updatedAt: now
    }
    const account = accountMap.get(transaction.currentAccountId)

    setTransactions(prev => prev.map(item => item.id === transaction.id ? updatedTransaction : item))
    if(editingTransaction?.id === transaction.id) setEditingTransaction(updatedTransaction)
    addActionLog({
      operationType: 'Veresiye kapatıldı',
      user: currentUser,
      description: `${getAccountDisplayName(account)} veresiye kaydı kapatıldı.`
    })
  }

  const deleteTransaction = (transaction: CreditTransaction) => {
    if(!confirm(`${getAccountDisplayName(accountMap.get(transaction.currentAccountId))} veresiye kaydı silinecek. Emin misiniz?`)) return

    const account = accountMap.get(transaction.currentAccountId)
    setTransactions(prev => prev.filter(item => item.id !== transaction.id))
    if(editingTransaction?.id === transaction.id) setEditingTransaction(null)
    if(paymentTransaction?.id === transaction.id) setPaymentTransaction(null)
    addActionLog({
      operationType: 'Veresiye silindi',
      user: currentUser,
      description: `${getAccountDisplayName(account)} veresiye kaydı silindi.`
    })
  }

  return (
    <div className="credit-transactions-page">
      <div className="page-title">
        <div>
          <h2>Veresiye İşlemleri</h2>
          <p className="muted">Cari hesaplara ait açık ve kapatılmış veresiye kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Veresiye</span>
          <strong>{formatCurrency(totalCredit)}</strong>
        </div>
        <div className="metric-card">
          <span>Açık Veresiye</span>
          <strong>{openCreditCount}</strong>
          <p className="muted">Açık kayıt</p>
        </div>
        <div className="metric-card">
          <span>Tahsil Edilen</span>
          <strong>{formatCurrency(collectedTotal)}</strong>
        </div>
        <div className="metric-card">
          <span>Kalan Borç</span>
          <strong>{formatCurrency(remainingTotal)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Veresiye Listesi</h3>
              <p className="muted">{visibleTransactions.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls credit-transaction-filters">
              <input
                type="search"
                placeholder="Cari, kod, açıklama veya tutar ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={accountFilter} onChange={event => setAccountFilter(event.target.value)}>
                <option value="all">Tüm cariler</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tümü</option>
                <option value="Açık">Açık</option>
                <option value="Kapandı">Kapandı</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table credit-transaction-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Cari</th>
                  <th>Tutar</th>
                  <th>Tahsil Edilen</th>
                  <th>Kalan</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun veresiye kaydı bulunamadı.</td></tr>
                )}
                {visibleTransactions.map(transaction => {
                  const account = accountMap.get(transaction.currentAccountId)

                  return (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td>
                      <td>
                        <strong>{account?.name || 'Cari bulunamadı'}</strong>
                        <div className="muted small-text">{account?.code || transaction.currentAccountId}</div>
                        {transaction.note && <div className="muted small-text">{transaction.note}</div>}
                      </td>
                      <td>{formatCurrency(transaction.amount)}</td>
                      <td>{formatCurrency(transaction.paidAmount)}</td>
                      <td><strong>{formatCurrency(transaction.remainingAmount)}</strong></td>
                      <td>
                        <span className={`status-pill ${transaction.status === 'Açık' ? 'warning-pill' : 'success'}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEdit(transaction)}>Düzenle</button>
                        <button className="btn" type="button" disabled={transaction.status === 'Kapandı'} onClick={() => {
                          setPaymentTransaction(transaction)
                          setPaymentError('')
                        }}>
                          Tahsilat Gir
                        </button>
                        <button className="btn" type="button" disabled={transaction.status === 'Kapandı'} onClick={() => closeTransaction(transaction)}>Kapat</button>
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
              <h3>{editingTransaction ? 'Veresiye Düzenle' : 'Yeni Veresiye'}</h3>
              {editingTransaction && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <CreditTransactionForm
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

      {paymentTransaction && (
        <PaymentModal
          transaction={paymentTransaction}
          account={accountMap.get(paymentTransaction.currentAccountId)}
          error={paymentError}
          onSave={savePayment}
          onClose={() => {
            setPaymentTransaction(null)
            setPaymentError('')
          }}
        />
      )}
    </div>
  )
}

function CreditTransactionForm({
  accounts,
  transaction,
  onSave,
  onCancel
}: {
  accounts: CurrentAccount[]
  transaction: CreditTransaction | null
  onSave: (values: CreditFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<CreditFormValues>(() => toFormValues(transaction, accounts))

  React.useEffect(() => {
    setValues(toFormValues(transaction, accounts))
  }, [accounts, transaction])

  const updateField = <K extends keyof CreditFormValues>(key: K, value: CreditFormValues[K]) => {
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

function PaymentModal({
  transaction,
  account,
  error,
  onSave,
  onClose
}: {
  transaction: CreditTransaction
  account?: CurrentAccount
  error: string
  onSave: (values: PaymentFormValues) => boolean
  onClose: () => void
}){
  const [values, setValues] = React.useState<PaymentFormValues>({ amount: '', note: '' })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved) setValues({ amount: '', note: '' })
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Tahsilat gir">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Tahsilat Gir</h3>
            <p className="muted">{getAccountDisplayName(account)}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="credit-payment-summary">
          <div>
            <span>Tutar</span>
            <strong>{formatCurrency(transaction.amount)}</strong>
          </div>
          <div>
            <span>Tahsil Edilen</span>
            <strong>{formatCurrency(transaction.paidAmount)}</strong>
          </div>
          <div>
            <span>Kalan</span>
            <strong>{formatCurrency(transaction.remainingAmount)}</strong>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form className="stacked-form" onSubmit={submit}>
          <div className="form-field">
            <label>Tahsilat Tutarı</label>
            <input
              type="number"
              min="0"
              max={transaction.remainingAmount}
              step="0.01"
              value={values.amount}
              onChange={event => setValues(prev => ({ ...prev, amount: event.target.value }))}
              required
            />
          </div>
          <div className="form-field">
            <label>Açıklama</label>
            <textarea rows={3} value={values.note} onChange={event => setValues(prev => ({ ...prev, note: event.target.value }))} />
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">Kaydet</button>
            <button className="btn" type="button" onClick={onClose}>İptal</button>
          </div>
        </form>
      </div>
    </div>
  )
}
