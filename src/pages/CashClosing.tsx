import React from 'react'
import {
  CashClosing,
  CashTransaction,
  CollectionTransaction,
  IncomeExpense,
  SupplierPayment,
  User
} from '../types'
import {
  addActionLog,
  loadCashClosings,
  loadCashTransactions,
  loadCollectionTransactions,
  loadIncomeExpenses,
  loadSupplierPayments,
  saveCashClosings
} from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type ClosingStatus = 'Dengeli' | 'Fazla' | 'Eksik'

type ClosingFormValues = {
  date: string
  openingBalance: string
  actualBalance: string
  note: string
}

type DailySummary = {
  totalIncome: number
  totalExpense: number
  movementCount: number
  classificationCount: number
}

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const getUserName = (user: User) => user.fullName || user.username

const getClosingStatus = (difference: number): ClosingStatus => {
  const roundedDifference = roundMoney(difference)
  if(roundedDifference === 0) return 'Dengeli'
  return roundedDifference > 0 ? 'Fazla' : 'Eksik'
}

const getStatusClassName = (status: ClosingStatus) => {
  if(status === 'Dengeli') return 'success'
  if(status === 'Fazla') return 'warning-pill'
  return 'danger-pill'
}

const getClosingTotals = ({
  date,
  collections,
  supplierPayments,
  cashTransactions,
  incomeExpenses
}: {
  date: string
  collections: CollectionTransaction[]
  supplierPayments: SupplierPayment[]
  cashTransactions: CashTransaction[]
  incomeExpenses: IncomeExpense[]
}): DailySummary => {
  const collectionIncome = collections
    .filter(transaction => transaction.date === date)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const supplierExpense = supplierPayments
    .filter(payment => payment.date === date)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const manualIncome = cashTransactions
    .filter(transaction => transaction.date === date && transaction.type === 'Gelir')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const manualExpense = cashTransactions
    .filter(transaction => transaction.date === date && transaction.type === 'Gider')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const movementCount = collections.filter(transaction => transaction.date === date).length
    + supplierPayments.filter(payment => payment.date === date).length
    + cashTransactions.filter(transaction => transaction.date === date).length

  return {
    totalIncome: roundMoney(collectionIncome + manualIncome),
    totalExpense: roundMoney(supplierExpense + manualExpense),
    movementCount,
    classificationCount: incomeExpenses.filter(record => record.date === date).length
  }
}

export default function CashClosingPage({ currentUser }: Props){
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [supplierPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [incomeExpenses] = React.useState<IncomeExpense[]>(() => loadIncomeExpenses())
  const [closings, setClosings] = React.useState<CashClosing[]>(() => loadCashClosings())
  const [values, setValues] = React.useState<ClosingFormValues>(() => ({
    date: getLocalDateKey(new Date()),
    openingBalance: '1000',
    actualBalance: '',
    note: ''
  }))
  const [actualTouched, setActualTouched] = React.useState(false)
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveCashClosings(closings)
  }, [closings])

  const dailySummary = React.useMemo(() => getClosingTotals({
    date: values.date,
    collections,
    supplierPayments,
    cashTransactions,
    incomeExpenses
  }), [cashTransactions, collections, incomeExpenses, supplierPayments, values.date])

  const openingBalance = Number(values.openingBalance)
  const normalizedOpeningBalance = Number.isFinite(openingBalance) ? roundMoney(openingBalance) : 0
  const expectedBalance = roundMoney(normalizedOpeningBalance + dailySummary.totalIncome - dailySummary.totalExpense)
  const actualBalance = Number(values.actualBalance)
  const normalizedActualBalance = Number.isFinite(actualBalance) ? roundMoney(actualBalance) : 0
  const difference = roundMoney(normalizedActualBalance - expectedBalance)
  const status = getClosingStatus(difference)
  const closedRecordForDate = closings.find(closing => closing.date === values.date)

  React.useEffect(() => {
    if(!actualTouched){
      setValues(prev => ({ ...prev, actualBalance: String(expectedBalance) }))
    }
  }, [actualTouched, expectedBalance])

  const sortedClosings = React.useMemo(() => {
    return [...closings].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if(dateDiff !== 0) return dateDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [closings])

  const updateField = <K extends keyof ClosingFormValues>(key: K, value: ClosingFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
    if(key === 'actualBalance') setActualTouched(true)
    if(key === 'date'){
      setActualTouched(false)
      setFormError('')
    }
  }

  const closeDay = (event: React.FormEvent) => {
    event.preventDefault()

    if(!values.date){
      setFormError('Tarih zorunludur.')
      return
    }

    if(closedRecordForDate){
      setFormError('Bu tarih için gün sonu kapanışı daha önce oluşturulmuş.')
      return
    }

    if(!Number.isFinite(openingBalance)){
      setFormError('Açılış bakiyesi geçerli bir tutar olmalıdır.')
      return
    }

    if(!Number.isFinite(actualBalance)){
      setFormError('Fiili kasa geçerli bir tutar olmalıdır.')
      return
    }

    const now = new Date().toISOString()
    const closing: CashClosing = {
      id: createId('cash_closing'),
      date: values.date,
      openingBalance: normalizedOpeningBalance,
      totalIncome: dailySummary.totalIncome,
      totalExpense: dailySummary.totalExpense,
      expectedBalance,
      actualBalance: normalizedActualBalance,
      difference,
      note: values.note.trim(),
      closedBy: getUserName(currentUser),
      createdAt: now
    }

    setClosings(prev => [closing, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Gün sonu kasa kapatıldı',
      user: currentUser,
      description: `${closing.date} gün sonu kasa kapatıldı. Açılış: ${formatCurrency(closing.openingBalance)}. Gelir: ${formatCurrency(closing.totalIncome)}. Gider: ${formatCurrency(closing.totalExpense)}. Beklenen: ${formatCurrency(closing.expectedBalance)}. Fiili: ${formatCurrency(closing.actualBalance)}. Fark: ${formatCurrency(closing.difference)}. Durum: ${getClosingStatus(closing.difference)}. Sınıflandırma kaydı: ${dailySummary.classificationCount}.`
    })
  }

  return (
    <div className="cash-closing-page">
      <div className="page-title">
        <div>
          <h2>Gün Sonu Kasa Kapatma</h2>
          <p className="muted">Günlük kasa hareketlerini kapatın ve kasa balansını doğrulayın.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Açılış Bakiyesi</span>
          <strong>{formatCurrency(normalizedOpeningBalance)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Gelir</span>
          <strong>{formatCurrency(dailySummary.totalIncome)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Gider</span>
          <strong>{formatCurrency(dailySummary.totalExpense)}</strong>
        </div>
        <div className="metric-card">
          <span>Beklenen Kasa</span>
          <strong>{formatCurrency(expectedBalance)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Fiili Kasa</span>
          <strong>{formatCurrency(normalizedActualBalance)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Kasa Farkı</span>
          <strong>{formatCurrency(difference)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Bugünkü Hareket Sayısı</span>
          <strong>{dailySummary.movementCount}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Durum</span>
          <strong className="status-kpi-text">{status}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Geçmiş Kapatmalar</h3>
              <p className="muted">{sortedClosings.length} kapanış kaydı gösteriliyor.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table cash-closing-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açılış</th>
                  <th>Gelir</th>
                  <th>Gider</th>
                  <th>Beklenen</th>
                  <th>Fiili</th>
                  <th>Fark</th>
                  <th>Durum</th>
                  <th>Kapatan Kullanıcı</th>
                </tr>
              </thead>
              <tbody>
                {sortedClosings.length === 0 && (
                  <tr><td colSpan={9} className="empty-cell">Henüz gün sonu kapanışı bulunmuyor.</td></tr>
                )}
                {sortedClosings.map(closing => {
                  const closingStatus = getClosingStatus(closing.difference)

                  return (
                    <tr key={closing.id}>
                      <td>{closing.date}</td>
                      <td>{formatCurrency(closing.openingBalance)}</td>
                      <td>{formatCurrency(closing.totalIncome)}</td>
                      <td>{formatCurrency(closing.totalExpense)}</td>
                      <td><strong>{formatCurrency(closing.expectedBalance)}</strong></td>
                      <td>{formatCurrency(closing.actualBalance)}</td>
                      <td><strong>{formatCurrency(closing.difference)}</strong></td>
                      <td>
                        <span className={`status-pill ${getStatusClassName(closingStatus)}`}>
                          {closingStatus}
                        </span>
                      </td>
                      <td>
                        <strong>{closing.closedBy || '-'}</strong>
                        {closing.note && <div className="muted small-text">{closing.note}</div>}
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
              <h3>Gün Sonu Formu</h3>
              <span className={`status-pill ${getStatusClassName(status)}`}>{status}</span>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            {closedRecordForDate && (
              <p className="muted small-text">Bu tarih kapatılmış. Geçmiş kayıtlar salt okunur.</p>
            )}
            <form className="stacked-form" onSubmit={closeDay}>
              <div className="form-field">
                <label>Tarih</label>
                <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
              </div>
              <div className="form-field">
                <label>Açılış Bakiyesi</label>
                <input
                  type="number"
                  step="0.01"
                  value={values.openingBalance}
                  onChange={event => updateField('openingBalance', event.target.value)}
                  disabled={!!closedRecordForDate}
                  required
                />
              </div>
              <div className="form-field">
                <label>Fiili Kasa</label>
                <input
                  type="number"
                  step="0.01"
                  value={values.actualBalance}
                  onChange={event => updateField('actualBalance', event.target.value)}
                  disabled={!!closedRecordForDate}
                  required
                />
              </div>
              <div className="cash-closing-preview">
                <div>
                  <span>Beklenen</span>
                  <strong>{formatCurrency(expectedBalance)}</strong>
                </div>
                <div>
                  <span>Fark</span>
                  <strong>{formatCurrency(difference)}</strong>
                </div>
              </div>
              <div className="form-field">
                <label>Not</label>
                <textarea
                  rows={4}
                  value={values.note}
                  onChange={event => updateField('note', event.target.value)}
                  disabled={!!closedRecordForDate}
                />
              </div>
              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={!!closedRecordForDate}>Kapat</button>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  )
}
