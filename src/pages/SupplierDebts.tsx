import React from 'react'
import { CurrentAccount, SupplierDebt, User } from '../types'
import { addActionLog, loadCurrentAccounts, loadSupplierDebts, saveSupplierDebts } from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type StatusFilter = 'all' | 'Açık' | 'Kapandı'

type SupplierDebtFormValues = {
  currentAccountId: string
  date: string
  invoiceNumber: string
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

const toFormValues = (debt: SupplierDebt | null, suppliers: CurrentAccount[]): SupplierDebtFormValues => ({
  currentAccountId: debt?.currentAccountId || suppliers[0]?.id || '',
  date: debt?.date || getLocalDateKey(new Date()),
  invoiceNumber: debt?.invoiceNumber || '',
  amount: debt ? String(debt.amount) : '',
  note: debt?.note || ''
})

const getSupplierDisplayName = (supplier?: CurrentAccount) => {
  if(!supplier) return 'Tedarikçi bulunamadı'
  return `${supplier.code} · ${supplier.name}`
}

export default function SupplierDebts({ currentUser }: Props){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [debts, setDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [editingDebt, setEditingDebt] = React.useState<SupplierDebt | null>(null)
  const [paymentDebt, setPaymentDebt] = React.useState<SupplierDebt | null>(null)
  const [search, setSearch] = React.useState('')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [formError, setFormError] = React.useState('')
  const [paymentError, setPaymentError] = React.useState('')

  React.useEffect(() => {
    saveSupplierDebts(debts)
  }, [debts])

  const suppliers = React.useMemo(() => accounts.filter(account => account.type === 'Tedarikçi'), [accounts])
  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const supplierIds = React.useMemo(() => new Set(suppliers.map(supplier => supplier.id)), [suppliers])

  const supplierDebts = React.useMemo(() => {
    return debts.filter(debt => supplierIds.has(debt.currentAccountId))
  }, [debts, supplierIds])

  const sortedDebts = React.useMemo(() => {
    return [...supplierDebts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [supplierDebts])

  const visibleDebts = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedDebts.filter(debt => {
      const supplier = supplierMap.get(debt.currentAccountId)
      const matchesSearch = !normalizedSearch
        || (supplier?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (supplier?.code || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || debt.invoiceNumber.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || debt.note.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(debt.amount).includes(normalizedSearch)

      const matchesSupplier = supplierFilter === 'all' || debt.currentAccountId === supplierFilter
      const matchesStatus = statusFilter === 'all' || debt.status === statusFilter

      return matchesSearch && matchesSupplier && matchesStatus
    })
  }, [search, sortedDebts, statusFilter, supplierFilter, supplierMap])

  const totalDebt = supplierDebts.reduce((sum, debt) => sum + debt.amount, 0)
  const openDebtCount = supplierDebts.filter(debt => debt.status === 'Açık').length
  const paidTotal = supplierDebts.reduce((sum, debt) => sum + debt.paidAmount, 0)
  const remainingTotal = supplierDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0)

  const startEdit = (debt: SupplierDebt) => {
    setEditingDebt(debt)
    setFormError('')
  }

  const saveDebt = (values: SupplierDebtFormValues) => {
    const amount = Number(values.amount)
    const currentAccountId = values.currentAccountId
    const date = values.date
    const invoiceNumber = values.invoiceNumber.trim()
    const note = values.note.trim()

    if(!currentAccountId || !supplierMap.has(currentAccountId)){
      setFormError('Sadece tedarikçi tipindeki cari kartlar seçilebilir.')
      return false
    }

    if(!date){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Borç tutarı sıfırdan büyük olmalıdır.')
      return false
    }

    if(editingDebt && amount < editingDebt.paidAmount){
      setFormError('Borç tutarı, ödenen tutardan küçük olamaz.')
      return false
    }

    const now = new Date().toISOString()
    const supplier = supplierMap.get(currentAccountId)

    if(editingDebt){
      const amounts = calculateDebtState(amount, editingDebt.paidAmount)
      const updatedDebt: SupplierDebt = {
        ...editingDebt,
        currentAccountId,
        date,
        invoiceNumber,
        note,
        ...amounts,
        updatedAt: now
      }

      setDebts(prev => prev.map(debt => debt.id === editingDebt.id ? updatedDebt : debt))
      setEditingDebt(null)
      setFormError('')
      addActionLog({
        operationType: 'Tedarikçi borcu güncellendi',
        user: currentUser,
        description: `${getSupplierDisplayName(supplier)} tedarikçi borcu güncellendi. Borç: ${formatCurrency(updatedDebt.amount)}. Fatura: ${invoiceNumber || '-'}.`
      })
      return true
    }

    const amounts = calculateDebtState(amount, 0)
    const debt: SupplierDebt = {
      id: createId('supplier_debt'),
      currentAccountId,
      date,
      invoiceNumber,
      note,
      ...amounts,
      createdAt: now,
      updatedAt: now
    }

    setDebts(prev => [debt, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Tedarikçi borcu oluşturuldu',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} için ${formatCurrency(debt.amount)} tedarikçi borcu oluşturuldu. Fatura: ${invoiceNumber || '-'}.`
    })
    return true
  }

  const savePayment = (values: PaymentFormValues) => {
    if(!paymentDebt) return false

    const paymentAmount = Number(values.amount)
    const paymentNote = values.note.trim()

    if(!Number.isFinite(paymentAmount) || paymentAmount <= 0){
      setPaymentError('Ödeme tutarı sıfırdan büyük olmalıdır.')
      return false
    }

    if(paymentAmount > paymentDebt.remainingAmount){
      setPaymentError('Ödeme tutarı kalan borçtan büyük olamaz.')
      return false
    }

    const now = new Date().toISOString()
    const amounts = calculateDebtState(paymentDebt.amount, paymentDebt.paidAmount + paymentAmount)
    const updatedNote = paymentNote
      ? [paymentDebt.note, `Ödeme: ${paymentNote}`].filter(Boolean).join('\n')
      : paymentDebt.note
    const updatedDebt: SupplierDebt = {
      ...paymentDebt,
      ...amounts,
      note: updatedNote,
      updatedAt: now
    }
    const supplier = supplierMap.get(paymentDebt.currentAccountId)

    setDebts(prev => prev.map(debt => debt.id === paymentDebt.id ? updatedDebt : debt))
    if(editingDebt?.id === paymentDebt.id) setEditingDebt(updatedDebt)
    setPaymentDebt(null)
    setPaymentError('')
    addActionLog({
      operationType: 'Tedarikçi ödemesi girildi',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} tedarikçi borcuna ${formatCurrency(paymentAmount)} ödeme girildi. Kalan: ${formatCurrency(updatedDebt.remainingAmount)}.`
    })
    return true
  }

  const closeDebt = (debt: SupplierDebt) => {
    if(debt.status === 'Kapandı') return
    if(!confirm(`${getSupplierDisplayName(supplierMap.get(debt.currentAccountId))} tedarikçi borcu kapatılacak. Devam etmek istiyor musunuz?`)) return

    const now = new Date().toISOString()
    const amounts = calculateDebtState(debt.amount, debt.amount)
    const updatedDebt: SupplierDebt = {
      ...debt,
      ...amounts,
      updatedAt: now
    }
    const supplier = supplierMap.get(debt.currentAccountId)

    setDebts(prev => prev.map(item => item.id === debt.id ? updatedDebt : item))
    if(editingDebt?.id === debt.id) setEditingDebt(updatedDebt)
    addActionLog({
      operationType: 'Tedarikçi borcu kapatıldı',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} tedarikçi borcu kapatıldı. Fatura: ${debt.invoiceNumber || '-'}.`
    })
  }

  const deleteDebt = (debt: SupplierDebt) => {
    if(!confirm(`${getSupplierDisplayName(supplierMap.get(debt.currentAccountId))} tedarikçi borcu silinecek. Emin misiniz?`)) return

    const supplier = supplierMap.get(debt.currentAccountId)
    setDebts(prev => prev.filter(item => item.id !== debt.id))
    if(editingDebt?.id === debt.id) setEditingDebt(null)
    if(paymentDebt?.id === debt.id) setPaymentDebt(null)
    addActionLog({
      operationType: 'Tedarikçi borcu silindi',
      user: currentUser,
      description: `${getSupplierDisplayName(supplier)} tedarikçi borcu silindi. Borç: ${formatCurrency(debt.amount)}. Fatura: ${debt.invoiceNumber || '-'}.`
    })
  }

  return (
    <div className="supplier-debts-page">
      <div className="page-title">
        <div>
          <h2>Tedarikçi Borçları</h2>
          <p className="muted">Tedarikçilere olan açık ve kapatılmış borç kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Borç</span>
          <strong>{formatCurrency(totalDebt)}</strong>
        </div>
        <div className="metric-card">
          <span>Açık Borç</span>
          <strong>{openDebtCount}</strong>
          <p className="muted">Açık kayıt</p>
        </div>
        <div className="metric-card">
          <span>Ödenen Tutar</span>
          <strong>{formatCurrency(paidTotal)}</strong>
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
              <h3>Borç Listesi</h3>
              <p className="muted">{visibleDebts.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls supplier-debt-filters">
              <input
                type="search"
                placeholder="Tedarikçi, fatura no, açıklama veya tutar ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
                <option value="all">Tüm tedarikçiler</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tümü</option>
                <option value="Açık">Açık</option>
                <option value="Kapandı">Kapandı</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table supplier-debt-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tedarikçi</th>
                  <th>Fatura No</th>
                  <th>Borç</th>
                  <th>Ödenen</th>
                  <th>Kalan</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleDebts.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Bu filtrelere uygun tedarikçi borcu bulunamadı.</td></tr>
                )}
                {visibleDebts.map(debt => {
                  const supplier = supplierMap.get(debt.currentAccountId)

                  return (
                    <tr key={debt.id}>
                      <td>{debt.date}</td>
                      <td>
                        <strong>{supplier?.name || 'Tedarikçi bulunamadı'}</strong>
                        <div className="muted small-text">{supplier?.code || debt.currentAccountId}</div>
                        {debt.note && <div className="muted small-text">{debt.note}</div>}
                      </td>
                      <td>{debt.invoiceNumber || '-'}</td>
                      <td>{formatCurrency(debt.amount)}</td>
                      <td>{formatCurrency(debt.paidAmount)}</td>
                      <td><strong>{formatCurrency(debt.remainingAmount)}</strong></td>
                      <td>
                        <span className={`status-pill ${debt.status === 'Açık' ? 'warning-pill' : 'success'}`}>
                          {debt.status}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="btn" type="button" onClick={() => startEdit(debt)}>Düzenle</button>
                        <button className="btn" type="button" disabled={debt.status === 'Kapandı'} onClick={() => {
                          setPaymentDebt(debt)
                          setPaymentError('')
                        }}>
                          Ödeme Gir
                        </button>
                        <button className="btn" type="button" disabled={debt.status === 'Kapandı'} onClick={() => closeDebt(debt)}>Kapat</button>
                        <button className="btn" type="button" onClick={() => deleteDebt(debt)}>Sil</button>
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
              <h3>{editingDebt ? 'Borç Düzenle' : 'Yeni Borç'}</h3>
              {editingDebt && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <SupplierDebtForm
              suppliers={suppliers}
              debt={editingDebt}
              onSave={saveDebt}
              onCancel={editingDebt ? () => {
                setEditingDebt(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>

      {paymentDebt && (
        <PaymentModal
          debt={paymentDebt}
          supplier={supplierMap.get(paymentDebt.currentAccountId)}
          error={paymentError}
          onSave={savePayment}
          onClose={() => {
            setPaymentDebt(null)
            setPaymentError('')
          }}
        />
      )}
    </div>
  )
}

function SupplierDebtForm({
  suppliers,
  debt,
  onSave,
  onCancel
}: {
  suppliers: CurrentAccount[]
  debt: SupplierDebt | null
  onSave: (values: SupplierDebtFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<SupplierDebtFormValues>(() => toFormValues(debt, suppliers))

  React.useEffect(() => {
    setValues(toFormValues(debt, suppliers))
  }, [debt, suppliers])

  const updateField = <K extends keyof SupplierDebtFormValues>(key: K, value: SupplierDebtFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !debt) setValues(toFormValues(null, suppliers))
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
        <label>Tarih</label>
        <input type="date" value={values.date} onChange={event => updateField('date', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Fatura No</label>
        <input value={values.invoiceNumber} onChange={event => updateField('invoiceNumber', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Borç Tutarı</label>
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
  debt,
  supplier,
  error,
  onSave,
  onClose
}: {
  debt: SupplierDebt
  supplier?: CurrentAccount
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Ödeme gir">
      <div className="credit-payment-modal">
        <div className="section-header compact">
          <div>
            <h3>Ödeme Gir</h3>
            <p className="muted">{getSupplierDisplayName(supplier)}</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Kapat</button>
        </div>

        <div className="credit-payment-summary">
          <div>
            <span>Borç</span>
            <strong>{formatCurrency(debt.amount)}</strong>
          </div>
          <div>
            <span>Ödenen</span>
            <strong>{formatCurrency(debt.paidAmount)}</strong>
          </div>
          <div>
            <span>Kalan</span>
            <strong>{formatCurrency(debt.remainingAmount)}</strong>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form className="stacked-form" onSubmit={submit}>
          <div className="form-field">
            <label>Ödeme Tutarı</label>
            <input
              type="number"
              min="0"
              max={debt.remainingAmount}
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
