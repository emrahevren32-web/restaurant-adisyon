import React from 'react'
import {
  CashPaymentMethod,
  CashTransaction,
  CashTransactionType,
  CollectionTransaction,
  CurrentAccount,
  SupplierDebt,
  SupplierPayment,
  User
} from '../types'
import {
  addActionLog,
  loadCashTransactions,
  loadCollectionTransactions,
  loadCurrentAccounts,
  loadSupplierDebts,
  loadSupplierPayments,
  saveCashTransactions
} from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type CashTypeFilter = CashTransactionType | 'all'
type PaymentMethodFilter = CashPaymentMethod | 'all'
type CashSource = 'auto' | 'manual'

type CashMovement = CashTransaction & {
  source: CashSource
  sourceLabel: 'Otomatik' | 'Manuel'
}

type CashFormValues = {
  type: CashTransactionType
  category: string
  paymentMethod: CashPaymentMethod
  amount: string
  date: string
  description: string
}

const paymentMethods: CashPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const transactionTypes: CashTransactionType[] = ['Gelir', 'Gider']
const cashCategories = ['Müşteri Tahsilatı', 'Tedarikçi Ödemesi', 'Kasa Girişi', 'Kasa Çıkışı', 'Diğer']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const normalizePaymentMethod = (value: unknown): CashPaymentMethod => {
  return paymentMethods.includes(value as CashPaymentMethod) ? value as CashPaymentMethod : 'Nakit'
}

const getAccountDisplayName = (account?: CurrentAccount) => {
  if(!account) return 'Cari bulunamadı'
  return `${account.code} · ${account.name}`
}

const getDebtDisplayName = (debt?: SupplierDebt) => {
  if(!debt) return 'Borç kaydı bulunamadı'
  return debt.invoiceNumber || debt.id
}

const buildCollectionMovement = (
  transaction: CollectionTransaction,
  accountMap: Map<string, CurrentAccount>
): CashMovement => {
  const account = accountMap.get(transaction.currentAccountId)

  return {
    id: `auto_collection_${transaction.id}`,
    date: transaction.date,
    type: 'Gelir',
    category: 'Müşteri Tahsilatı',
    amount: transaction.amount,
    paymentMethod: normalizePaymentMethod(transaction.paymentMethod),
    referenceId: transaction.id,
    description: `${getAccountDisplayName(account)} tahsilatı.${transaction.note ? ` ${transaction.note}` : ''}`,
    createdAt: transaction.createdAt,
    source: 'auto',
    sourceLabel: 'Otomatik'
  }
}

const buildSupplierPaymentMovement = (
  payment: SupplierPayment,
  accountMap: Map<string, CurrentAccount>,
  debtMap: Map<string, SupplierDebt>
): CashMovement => {
  const account = accountMap.get(payment.currentAccountId)
  const debt = debtMap.get(payment.supplierDebtId)

  return {
    id: `auto_supplier_payment_${payment.id}`,
    date: payment.date,
    type: 'Gider',
    category: 'Tedarikçi Ödemesi',
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    referenceId: payment.id,
    description: `${getAccountDisplayName(account)} tedarikçi ödemesi. Borç kaydı: ${getDebtDisplayName(debt)}.${payment.note ? ` ${payment.note}` : ''}`,
    createdAt: payment.createdAt,
    source: 'auto',
    sourceLabel: 'Otomatik'
  }
}

const buildManualMovement = (transaction: CashTransaction): CashMovement => ({
  ...transaction,
  source: 'manual',
  sourceLabel: 'Manuel'
})

const toFormDefaults = (): CashFormValues => ({
  type: 'Gelir',
  category: 'Kasa Girişi',
  paymentMethod: 'Nakit',
  amount: '',
  date: getLocalDateKey(new Date()),
  description: ''
})

export default function CashTransactions({ currentUser }: Props){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [supplierPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [supplierDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [manualTransactions, setManualTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [detailMovement, setDetailMovement] = React.useState<CashMovement | null>(null)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<CashTypeFilter>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = React.useState<PaymentMethodFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveCashTransactions(manualTransactions)
  }, [manualTransactions])

  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])
  const debtMap = React.useMemo(() => new Map(supplierDebts.map(debt => [debt.id, debt])), [supplierDebts])

  const movements = React.useMemo<CashMovement[]>(() => {
    const automaticIncome = collections.map(transaction => buildCollectionMovement(transaction, accountMap))
    const automaticExpense = supplierPayments.map(payment => buildSupplierPaymentMovement(payment, accountMap, debtMap))
    const manual = manualTransactions.map(buildManualMovement)

    return [...automaticIncome, ...automaticExpense, ...manual].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if(dateDiff !== 0) return dateDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [accountMap, collections, debtMap, manualTransactions, supplierPayments])

  const visibleMovements = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return movements.filter(movement => {
      const matchesSearch = !normalizedSearch
        || movement.type.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.category.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.paymentMethod.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.referenceId.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || movement.description.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(movement.amount).includes(normalizedSearch)

      const matchesType = typeFilter === 'all' || movement.type === typeFilter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || movement.paymentMethod === paymentMethodFilter
      const matchesStartDate = !startDate || movement.date >= startDate
      const matchesEndDate = !endDate || movement.date <= endDate

      return matchesSearch && matchesType && matchesPaymentMethod && matchesStartDate && matchesEndDate
    })
  }, [endDate, movements, paymentMethodFilter, search, startDate, typeFilter])

  const today = getLocalDateKey(new Date())
  const totalIncome = movements.filter(movement => movement.type === 'Gelir').reduce((sum, movement) => sum + movement.amount, 0)
  const totalExpense = movements.filter(movement => movement.type === 'Gider').reduce((sum, movement) => sum + movement.amount, 0)
  const netCash = totalIncome - totalExpense
  const todayMovementCount = movements.filter(movement => movement.date === today).length

  const saveManualTransaction = (values: CashFormValues) => {
    const amount = Number(values.amount)
    const date = values.date
    const category = values.category.trim() || 'Diğer'
    const description = values.description.trim()

    if(!date){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Tutar sıfırdan büyük olmalıdır.')
      return false
    }

    const now = new Date().toISOString()
    const transaction: CashTransaction = {
      id: createId('cash'),
      date,
      type: values.type,
      category,
      amount: roundMoney(amount),
      paymentMethod: values.paymentMethod,
      referenceId: '',
      description,
      createdAt: now
    }

    setManualTransactions(prev => [transaction, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Kasa hareketi oluşturuldu',
      user: currentUser,
      description: `${transaction.type} kasa hareketi oluşturuldu. Kategori: ${transaction.category}. Tutar: ${formatCurrency(transaction.amount)}. Ödeme türü: ${transaction.paymentMethod}.`
    })
    return true
  }

  const deleteManualTransaction = (movement: CashMovement) => {
    if(movement.source !== 'manual') return
    if(!confirm(`${movement.category} kasa hareketi silinecek. Emin misiniz?`)) return

    setManualTransactions(prev => prev.filter(transaction => transaction.id !== movement.id))
    if(detailMovement?.id === movement.id) setDetailMovement(null)
    addActionLog({
      operationType: 'Kasa hareketi silindi',
      user: currentUser,
      description: `${movement.type} kasa hareketi silindi. Kategori: ${movement.category}. Tutar: ${formatCurrency(movement.amount)}.`
    })
  }

  return (
    <div className="cash-transactions-page">
      <div className="page-title">
        <div>
          <h2>Kasa Hareketleri</h2>
          <p className="muted">Kasaya giren ve çıkan tüm finansal hareketleri inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Gelir</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Gider</span>
          <strong>{formatCurrency(totalExpense)}</strong>
        </div>
        <div className="metric-card">
          <span>Net Kasa</span>
          <strong>{formatCurrency(netCash)}</strong>
        </div>
        <div className="metric-card">
          <span>Bugünkü Hareket</span>
          <strong>{todayMovementCount}</strong>
          <p className="muted">Bugünkü kayıt</p>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Hareket Listesi</h3>
              <p className="muted">{visibleMovements.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls cash-transaction-filters">
              <input
                type="search"
                placeholder="Kategori, açıklama, referans veya tutar ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as CashTypeFilter)}>
                <option value="all">Tüm hareketler</option>
                {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
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
            <table className="data-table cash-transaction-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tür</th>
                  <th>Kategori</th>
                  <th>Ödeme Türü</th>
                  <th>Tutar</th>
                  <th>Açıklama</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleMovements.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun kasa hareketi bulunamadı.</td></tr>
                )}
                {visibleMovements.map(movement => (
                  <tr key={movement.id}>
                    <td>{movement.date}</td>
                    <td>
                      <span className={`status-pill ${movement.type === 'Gelir' ? 'success' : 'danger-pill'}`}>
                        {movement.type}
                      </span>
                    </td>
                    <td>
                      <strong>{movement.category}</strong>
                      <div className="cash-source-line">
                        <span className={`status-pill ${movement.source === 'auto' ? 'muted-pill' : ''}`}>{movement.sourceLabel}</span>
                        {movement.referenceId && <span className="muted small-text">{movement.referenceId}</span>}
                      </div>
                    </td>
                    <td>{movement.paymentMethod}</td>
                    <td><strong>{formatCurrency(movement.amount)}</strong></td>
                    <td>{movement.description || '-'}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setDetailMovement(movement)}>Detay Gör</button>
                      <button
                        className="btn"
                        type="button"
                        disabled={movement.source === 'auto'}
                        title={movement.source === 'auto' ? 'Otomatik kayıtlar kendi modülünden yönetilir.' : undefined}
                        onClick={() => deleteManualTransaction(movement)}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>Yeni Manuel Hareket</h3>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <CashTransactionForm onSave={saveManualTransaction} />
          </section>
        </aside>
      </div>

      {detailMovement && (
        <CashTransactionDetail
          movement={detailMovement}
          onClose={() => setDetailMovement(null)}
        />
      )}
    </div>
  )
}

function CashTransactionForm({ onSave }: { onSave: (values: CashFormValues) => boolean }){
  const [values, setValues] = React.useState<CashFormValues>(() => toFormDefaults())

  const updateField = <K extends keyof CashFormValues>(key: K, value: CashFormValues[K]) => {
    setValues(prev => {
      if(key === 'type'){
        return {
          ...prev,
          type: value as CashTransactionType,
          category: value === 'Gelir' ? 'Kasa Girişi' : 'Kasa Çıkışı'
        }
      }

      return { ...prev, [key]: value }
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved) setValues(toFormDefaults())
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Tür</label>
        <select value={values.type} onChange={event => updateField('type', event.target.value as CashTransactionType)} required>
          {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Kategori</label>
        <select value={values.category} onChange={event => updateField('category', event.target.value)} required>
          {cashCategories.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Ödeme Türü</label>
        <select value={values.paymentMethod} onChange={event => updateField('paymentMethod', event.target.value as CashPaymentMethod)} required>
          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tutar</label>
        <input type="number" min="0" step="0.01" value={values.amount} onChange={event => updateField('amount', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Tarih</label>
        <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={4} value={values.description} onChange={event => updateField('description', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
      </div>
    </form>
  )
}

function CashTransactionDetail({
  movement,
  onClose
}: {
  movement: CashMovement
  onClose: () => void
}){
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Kasa hareketi detayı">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Kasa Hareketi Detayı</h3>
            <p className="muted">{movement.category}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="supplier-payment-detail-grid">
          <div>
            <span>Tarih</span>
            <strong>{movement.date}</strong>
          </div>
          <div>
            <span>Kaynak</span>
            <strong>{movement.sourceLabel}</strong>
          </div>
          <div>
            <span>Tür</span>
            <strong>{movement.type}</strong>
          </div>
          <div>
            <span>Ödeme Türü</span>
            <strong>{movement.paymentMethod}</strong>
          </div>
          <div>
            <span>Tutar</span>
            <strong>{formatCurrency(movement.amount)}</strong>
          </div>
          <div>
            <span>Referans</span>
            <strong>{movement.referenceId || '-'}</strong>
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <p className="muted">{movement.description || '-'}</p>
        </div>
      </div>
    </div>
  )
}
