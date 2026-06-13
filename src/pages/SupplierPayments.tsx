import React from 'react'
import { CurrentAccount, SupplierDebt, SupplierPayment, SupplierPaymentMethod, User } from '../types'
import {
  addActionLog,
  loadCurrentAccounts,
  loadSupplierDebts,
  loadSupplierPayments,
  saveSupplierDebts,
  saveSupplierPayments
} from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type PaymentMethodFilter = SupplierPaymentMethod | 'all'

type SupplierPaymentFormValues = {
  currentAccountId: string
  supplierDebtId: string
  date: string
  amount: string
  paymentMethod: SupplierPaymentMethod
  note: string
}

const paymentMethods: SupplierPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7)
const roundMoney = (value: number) => Math.round(value * 100) / 100

const calculateDebtState = (amountValue: number, paidValue: number) => {
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

const getSupplierDisplayName = (supplier?: CurrentAccount) => {
  if(!supplier) return 'Tedarikçi bulunamadı'
  return `${supplier.code} · ${supplier.name}`
}

const getDebtDisplayName = (debt?: SupplierDebt) => {
  if(!debt) return 'Borç kaydı bulunamadı'
  return `${debt.invoiceNumber || debt.id} · ${formatCurrency(debt.remainingAmount)} kalan`
}

const getInitialFormValues = (suppliers: CurrentAccount[], debts: SupplierDebt[]): SupplierPaymentFormValues => {
  const firstSupplierId = suppliers[0]?.id || ''
  const firstDebt = debts.find(debt => debt.currentAccountId === firstSupplierId)

  return {
    currentAccountId: firstSupplierId,
    supplierDebtId: firstDebt?.id || '',
    date: getLocalDateKey(new Date()),
    amount: '',
    paymentMethod: 'Havale/EFT',
    note: ''
  }
}

export default function SupplierPayments({ currentUser }: Props){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [debts, setDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [payments, setPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [detailPayment, setDetailPayment] = React.useState<SupplierPayment | null>(null)
  const [search, setSearch] = React.useState('')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = React.useState<PaymentMethodFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveSupplierPayments(payments)
  }, [payments])

  React.useEffect(() => {
    saveSupplierDebts(debts)
  }, [debts])

  const suppliers = React.useMemo(() => accounts.filter(account => account.type === 'Tedarikçi'), [accounts])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const supplierIds = React.useMemo(() => new Set(suppliers.map(supplier => supplier.id)), [suppliers])
  const supplierDebtMap = React.useMemo(() => new Map(debts.map(debt => [debt.id, debt])), [debts])

  const supplierDebts = React.useMemo(() => {
    return debts.filter(debt => supplierIds.has(debt.currentAccountId))
  }, [debts, supplierIds])

  const payableDebts = React.useMemo(() => {
    return supplierDebts.filter(debt => debt.remainingAmount > 0)
  }, [supplierDebts])

  const supplierPayments = React.useMemo(() => {
    return payments.filter(payment => supplierIds.has(payment.currentAccountId))
  }, [payments, supplierIds])

  const sortedPayments = React.useMemo(() => {
    return [...supplierPayments].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if(dateDiff !== 0) return dateDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [supplierPayments])

  const visiblePayments = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedPayments.filter(payment => {
      const supplier = supplierMap.get(payment.currentAccountId)
      const debt = supplierDebtMap.get(payment.supplierDebtId)
      const matchesSearch = !normalizedSearch
        || (supplier?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (supplier?.code || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (debt?.invoiceNumber || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || payment.paymentMethod.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || payment.note.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(payment.amount).includes(normalizedSearch)

      const matchesSupplier = supplierFilter === 'all' || payment.currentAccountId === supplierFilter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || payment.paymentMethod === paymentMethodFilter
      const matchesStartDate = !startDate || payment.date >= startDate
      const matchesEndDate = !endDate || payment.date <= endDate

      return matchesSearch && matchesSupplier && matchesPaymentMethod && matchesStartDate && matchesEndDate
    })
  }, [endDate, paymentMethodFilter, search, sortedPayments, startDate, supplierDebtMap, supplierFilter, supplierMap])

  const today = getLocalDateKey(new Date())
  const currentMonth = getMonthKey(today)
  const totalPayment = supplierPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const monthPayment = supplierPayments
    .filter(payment => getMonthKey(payment.date) === currentMonth)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const cashPayment = supplierPayments
    .filter(payment => payment.paymentMethod === 'Nakit')
    .reduce((sum, payment) => sum + payment.amount, 0)
  const bankCardPayment = supplierPayments
    .filter(payment => payment.paymentMethod === 'Kart' || payment.paymentMethod === 'Havale/EFT')
    .reduce((sum, payment) => sum + payment.amount, 0)

  const savePayment = (values: SupplierPaymentFormValues) => {
    const amount = Number(values.amount)
    const currentAccountId = values.currentAccountId
    const supplierDebtId = values.supplierDebtId
    const date = values.date
    const paymentMethod = values.paymentMethod
    const note = values.note.trim()
    const supplier = supplierMap.get(currentAccountId)
    const debt = supplierDebtMap.get(supplierDebtId)

    if(!currentAccountId || !supplier){
      setFormError('Tedarikçi seçimi zorunludur.')
      return false
    }

    if(!supplierDebtId || !debt || debt.currentAccountId !== currentAccountId){
      setFormError('Geçerli bir tedarikçi borç kaydı seçin.')
      return false
    }

    if(!date){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Ödeme tutarı sıfırdan büyük olmalıdır.')
      return false
    }

    if(amount > debt.remainingAmount){
      setFormError('Ödeme tutarı kalan borçtan büyük olamaz.')
      return false
    }

    const now = new Date().toISOString()
    const normalizedAmount = roundMoney(amount)
    const payment: SupplierPayment = {
      id: createId('supplier_payment'),
      supplierDebtId,
      currentAccountId,
      date,
      amount: normalizedAmount,
      paymentMethod,
      note,
      createdAt: now
    }
    const updatedDebt: SupplierDebt = {
      ...debt,
      ...calculateDebtState(debt.amount, debt.paidAmount + normalizedAmount),
      updatedAt: now
    }

    setPayments(prev => [payment, ...prev])
    setDebts(prev => prev.map(item => item.id === debt.id ? updatedDebt : item))
    setFormError('')
    addActionLog({
      operationType: 'Tedarikçi ödemesi oluşturuldu',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} için ${formatCurrency(payment.amount)} tedarikçi ödemesi oluşturuldu. Borç kaydı: ${debt.invoiceNumber || debt.id}. Ödeme türü: ${payment.paymentMethod}. Kalan: ${formatCurrency(updatedDebt.remainingAmount)}.`
    })
    return true
  }

  const deletePayment = (payment: SupplierPayment) => {
    const supplier = supplierMap.get(payment.currentAccountId)
    const debt = supplierDebtMap.get(payment.supplierDebtId)
    if(!confirm(`${getSupplierDisplayName(supplier)} tedarikçi ödeme kaydı silinecek. Emin misiniz?`)) return

    const now = new Date().toISOString()
    setPayments(prev => prev.filter(item => item.id !== payment.id))

    if(debt){
      const updatedDebt: SupplierDebt = {
        ...debt,
        ...calculateDebtState(debt.amount, debt.paidAmount - payment.amount),
        updatedAt: now
      }

      setDebts(prev => prev.map(item => item.id === debt.id ? updatedDebt : item))
    }

    if(detailPayment?.id === payment.id) setDetailPayment(null)
    addActionLog({
      operationType: 'Tedarikçi ödemesi silindi',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} tedarikçi ödeme kaydı silindi. Tutar: ${formatCurrency(payment.amount)}. Borç kaydı: ${debt?.invoiceNumber || payment.supplierDebtId}.`
    })
  }

  return (
    <div className="supplier-payments-page">
      <div className="page-title">
        <div>
          <h2>Tedarikçi Ödeme İşlemleri</h2>
          <p className="muted">Tedarikçilere yapılan ödemeleri görüntüleyin ve yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Ödeme</span>
          <strong>{formatCurrency(totalPayment)}</strong>
        </div>
        <div className="metric-card">
          <span>Bu Ay Ödeme</span>
          <strong>{formatCurrency(monthPayment)}</strong>
        </div>
        <div className="metric-card">
          <span>Nakit Ödeme</span>
          <strong>{formatCurrency(cashPayment)}</strong>
        </div>
        <div className="metric-card">
          <span>Banka/Kart Ödeme</span>
          <strong>{formatCurrency(bankCardPayment)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Ödeme Listesi</h3>
              <p className="muted">{visiblePayments.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls supplier-payment-filters">
              <input
                type="search"
                placeholder="Tedarikçi, fatura no, ödeme türü veya açıklama ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
                <option value="all">Tüm tedarikçiler</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
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
            <table className="data-table supplier-payment-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi</th>
                  <th>Borç Kaydı</th>
                  <th>Ödeme Türü</th>
                  <th>Tutar</th>
                  <th>Açıklama</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun tedarikçi ödemesi bulunamadı.</td></tr>
                )}
                {visiblePayments.map(payment => {
                  const supplier = supplierMap.get(payment.currentAccountId)
                  const debt = supplierDebtMap.get(payment.supplierDebtId)

                  return (
                    <tr key={payment.id}>
                      <td>{payment.date}</td>
                      <td>
                        <strong>{supplier?.name || 'Tedarikçi bulunamadı'}</strong>
                        <div className="muted small-text">{supplier?.code || payment.currentAccountId}</div>
                      </td>
                      <td>
                        <strong>{debt?.invoiceNumber || payment.supplierDebtId}</strong>
                        {debt && <div className="muted small-text">Kalan: {formatCurrency(debt.remainingAmount)}</div>}
                      </td>
                      <td>{payment.paymentMethod}</td>
                      <td><strong>{formatCurrency(payment.amount)}</strong></td>
                      <td>{payment.note || '-'}</td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => setDetailPayment(payment)}>Detay Gör</button>
                        <button className="btn" type="button" onClick={() => deletePayment(payment)}>Sil</button>
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
              <h3>Yeni Ödeme</h3>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <SupplierPaymentForm
              suppliers={suppliers}
              debts={payableDebts}
              onSave={savePayment}
            />
          </section>
        </aside>
      </div>

      {detailPayment && (
        <SupplierPaymentDetail
          payment={detailPayment}
          supplier={supplierMap.get(detailPayment.currentAccountId)}
          debt={supplierDebtMap.get(detailPayment.supplierDebtId)}
          onClose={() => setDetailPayment(null)}
        />
      )}
    </div>
  )
}

function SupplierPaymentForm({
  suppliers,
  debts,
  onSave
}: {
  suppliers: CurrentAccount[]
  debts: SupplierDebt[]
  onSave: (values: SupplierPaymentFormValues) => boolean
}){
  const [values, setValues] = React.useState<SupplierPaymentFormValues>(() => getInitialFormValues(suppliers, debts))

  React.useEffect(() => {
    setValues(prev => {
      const supplierExists = suppliers.some(supplier => supplier.id === prev.currentAccountId)
      const currentAccountId = supplierExists ? prev.currentAccountId : suppliers[0]?.id || ''
      const debtExists = debts.some(debt => debt.id === prev.supplierDebtId && debt.currentAccountId === currentAccountId)
      const supplierDebtId = debtExists
        ? prev.supplierDebtId
        : debts.find(debt => debt.currentAccountId === currentAccountId)?.id || ''

      return { ...prev, currentAccountId, supplierDebtId }
    })
  }, [debts, suppliers])

  const selectedDebts = debts.filter(debt => debt.currentAccountId === values.currentAccountId)
  const selectedDebt = selectedDebts.find(debt => debt.id === values.supplierDebtId)

  const updateField = <K extends keyof SupplierPaymentFormValues>(key: K, value: SupplierPaymentFormValues[K]) => {
    setValues(prev => {
      if(key === 'currentAccountId'){
        const supplierDebtId = debts.find(debt => debt.currentAccountId === value)?.id || ''
        return { ...prev, currentAccountId: String(value), supplierDebtId }
      }

      return { ...prev, [key]: value }
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved){
      setValues(prev => {
        const supplierDebtId = debts.find(debt => debt.currentAccountId === prev.currentAccountId && debt.id !== prev.supplierDebtId)?.id
          || debts.find(debt => debt.currentAccountId === prev.currentAccountId)?.id
          || ''

        return {
          ...prev,
          supplierDebtId,
          amount: '',
          note: ''
        }
      })
    }
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Tedarikçi</label>
        <select value={values.currentAccountId} onChange={event => updateField('currentAccountId', event.target.value)} required>
          {suppliers.length === 0 && <option value="">Tedarikçi cari yok</option>}
          {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Borç Kaydı</label>
        <select value={values.supplierDebtId} onChange={event => updateField('supplierDebtId', event.target.value)} required>
          {selectedDebts.length === 0 && <option value="">Ödenebilir borç yok</option>}
          {selectedDebts.map(debt => <option key={debt.id} value={debt.id}>{getDebtDisplayName(debt)}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tarih</label>
        <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Ödeme Türü</label>
        <select value={values.paymentMethod} onChange={event => updateField('paymentMethod', event.target.value as SupplierPaymentMethod)} required>
          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Tutar</label>
        <input
          type="number"
          min="0"
          max={selectedDebt?.remainingAmount || undefined}
          step="0.01"
          value={values.amount}
          onChange={event => updateField('amount', event.target.value)}
          required
        />
        {selectedDebt && <p className="muted small-text">Kalan borç: {formatCurrency(selectedDebt.remainingAmount)}</p>}
      </div>
      <div className="form-field">
        <label>Açıklama</label>
        <textarea rows={4} value={values.note} onChange={event => updateField('note', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
      </div>
    </form>
  )
}

function SupplierPaymentDetail({
  payment,
  supplier,
  debt,
  onClose
}: {
  payment: SupplierPayment
  supplier?: CurrentAccount
  debt?: SupplierDebt
  onClose: () => void
}){
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Tedarikçi ödeme detayı">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Ödeme Detayı</h3>
            <p className="muted">{getSupplierDisplayName(supplier)}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="supplier-payment-detail-grid">
          <div>
            <span>Tarih</span>
            <strong>{payment.date}</strong>
          </div>
          <div>
            <span>Borç Kaydı</span>
            <strong>{debt?.invoiceNumber || payment.supplierDebtId}</strong>
          </div>
          <div>
            <span>Ödeme Türü</span>
            <strong>{payment.paymentMethod}</strong>
          </div>
          <div>
            <span>Tutar</span>
            <strong>{formatCurrency(payment.amount)}</strong>
          </div>
          <div>
            <span>Borç Tutarı</span>
            <strong>{debt ? formatCurrency(debt.amount) : '-'}</strong>
          </div>
          <div>
            <span>Kalan Borç</span>
            <strong>{debt ? formatCurrency(debt.remainingAmount) : '-'}</strong>
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <p className="muted">{payment.note || '-'}</p>
        </div>
      </div>
    </div>
  )
}
