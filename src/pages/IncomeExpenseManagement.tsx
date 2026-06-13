import React from 'react'
import {
  ActionLogType,
  IncomeExpense,
  IncomeExpensePaymentMethod,
  IncomeExpenseType,
  User
} from '../types'
import { addActionLog, loadIncomeExpenses, saveIncomeExpenses } from '../storage'
import { formatCurrency } from '../billing'

type Props = { currentUser: User }
type TypeFilter = IncomeExpenseType | 'all'
type CategoryFilter = string

type IncomeExpenseFormValues = {
  type: IncomeExpenseType
  category: string
  paymentMethod: IncomeExpensePaymentMethod
  date: string
  amount: string
  description: string
}

const incomeCategories = ['Ürün Satışı', 'Hizmet Geliri', 'Ek Gelir', 'Diğer Gelir']
const expenseCategories = ['Kira', 'Elektrik', 'Su', 'Doğalgaz', 'Personel', 'Muhasebe', 'Vergi', 'Temizlik', 'Bakım Onarım', 'Yakıt', 'Diğer Gider']
const paymentMethods: IncomeExpensePaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const transactionTypes: IncomeExpenseType[] = ['Gelir', 'Gider']
const createId = (prefix: string) => `${prefix}_${Date.now()}`

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMonthKey = (dateKey: string) => dateKey.slice(0, 7)
const roundMoney = (value: number) => Math.round(value * 100) / 100

const getCategoriesByType = (type: IncomeExpenseType) => type === 'Gelir' ? incomeCategories : expenseCategories
const allCategories = [...incomeCategories, ...expenseCategories]

const toFormValues = (record: IncomeExpense | null): IncomeExpenseFormValues => ({
  type: record?.type || 'Gelir',
  category: record?.category || incomeCategories[0],
  paymentMethod: record?.paymentMethod || 'Nakit',
  date: record?.date || getLocalDateKey(new Date()),
  amount: record ? String(record.amount) : '',
  description: record?.description || ''
})

const getCreateLogType = (type: IncomeExpenseType): ActionLogType => (
  type === 'Gelir' ? 'Gelir kaydı oluşturuldu' : 'Gider kaydı oluşturuldu'
)

const getUpdateLogType = (type: IncomeExpenseType): ActionLogType => (
  type === 'Gelir' ? 'Gelir kaydı güncellendi' : 'Gider kaydı güncellendi'
)

const getDeleteLogType = (type: IncomeExpenseType): ActionLogType => (
  type === 'Gelir' ? 'Gelir kaydı silindi' : 'Gider kaydı silindi'
)

export default function IncomeExpenseManagement({ currentUser }: Props){
  const [records, setRecords] = React.useState<IncomeExpense[]>(() => loadIncomeExpenses())
  const [editingRecord, setEditingRecord] = React.useState<IncomeExpense | null>(null)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveIncomeExpenses(records)
  }, [records])

  const categoryOptions = React.useMemo(() => {
    if(typeFilter === 'Gelir') return incomeCategories
    if(typeFilter === 'Gider') return expenseCategories
    return allCategories
  }, [typeFilter])

  React.useEffect(() => {
    if(categoryFilter !== 'all' && !categoryOptions.includes(categoryFilter)){
      setCategoryFilter('all')
    }
  }, [categoryFilter, categoryOptions])

  const sortedRecords = React.useMemo(() => {
    return [...records].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if(dateDiff !== 0) return dateDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [records])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortedRecords.filter(record => {
      const matchesSearch = !normalizedSearch
        || record.type.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.category.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.paymentMethod.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.description.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || String(record.amount).includes(normalizedSearch)

      const matchesType = typeFilter === 'all' || record.type === typeFilter
      const matchesCategory = categoryFilter === 'all' || record.category === categoryFilter
      const matchesStartDate = !startDate || record.date >= startDate
      const matchesEndDate = !endDate || record.date <= endDate

      return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate
    })
  }, [categoryFilter, endDate, search, sortedRecords, startDate, typeFilter])

  const currentMonth = getMonthKey(getLocalDateKey(new Date()))
  const incomeRecords = records.filter(record => record.type === 'Gelir')
  const expenseRecords = records.filter(record => record.type === 'Gider')
  const totalIncome = incomeRecords.reduce((sum, record) => sum + record.amount, 0)
  const totalExpense = expenseRecords.reduce((sum, record) => sum + record.amount, 0)
  const netResult = totalIncome - totalExpense
  const monthIncome = records
    .filter(record => record.type === 'Gelir' && getMonthKey(record.date) === currentMonth)
    .reduce((sum, record) => sum + record.amount, 0)
  const monthExpense = records
    .filter(record => record.type === 'Gider' && getMonthKey(record.date) === currentMonth)
    .reduce((sum, record) => sum + record.amount, 0)
  const monthResult = monthIncome - monthExpense
  const biggestIncome = incomeRecords.reduce((max, record) => Math.max(max, record.amount), 0)
  const biggestExpense = expenseRecords.reduce((max, record) => Math.max(max, record.amount), 0)

  const startEdit = (record: IncomeExpense) => {
    setEditingRecord(record)
    setFormError('')
  }

  const saveRecord = (values: IncomeExpenseFormValues) => {
    const amount = Number(values.amount)
    const category = values.category.trim()
    const description = values.description.trim()

    if(!values.type){
      setFormError('Tür zorunludur.')
      return false
    }

    if(!category){
      setFormError('Kategori zorunludur.')
      return false
    }

    if(!values.date){
      setFormError('Tarih zorunludur.')
      return false
    }

    if(!Number.isFinite(amount) || amount <= 0){
      setFormError('Tutar sıfırdan büyük olmalıdır.')
      return false
    }

    const now = new Date().toISOString()
    const normalizedAmount = roundMoney(amount)

    if(editingRecord){
      const updatedRecord: IncomeExpense = {
        ...editingRecord,
        type: values.type,
        category,
        amount: normalizedAmount,
        paymentMethod: values.paymentMethod,
        date: values.date,
        description,
        updatedAt: now
      }

      setRecords(prev => prev.map(record => record.id === editingRecord.id ? updatedRecord : record))
      setEditingRecord(null)
      setFormError('')
      addActionLog({
        operationType: getUpdateLogType(updatedRecord.type),
        user: currentUser,
        description: `${updatedRecord.type} kaydı güncellendi. Kategori: ${updatedRecord.category}. Tutar: ${formatCurrency(updatedRecord.amount)}.`
      })
      return true
    }

    const record: IncomeExpense = {
      id: createId('income_expense'),
      type: values.type,
      category,
      amount: normalizedAmount,
      paymentMethod: values.paymentMethod,
      date: values.date,
      description,
      createdAt: now,
      updatedAt: now
    }

    setRecords(prev => [record, ...prev])
    setFormError('')
    addActionLog({
      operationType: getCreateLogType(record.type),
      user: currentUser,
      description: `${record.type} kaydı oluşturuldu. Kategori: ${record.category}. Tutar: ${formatCurrency(record.amount)}. Ödeme türü: ${record.paymentMethod}.`
    })
    return true
  }

  const deleteRecord = (record: IncomeExpense) => {
    if(!confirm(`${record.category} ${record.type.toLocaleLowerCase('tr-TR')} kaydı silinecek. Emin misiniz?`)) return

    setRecords(prev => prev.filter(item => item.id !== record.id))
    if(editingRecord?.id === record.id) setEditingRecord(null)
    addActionLog({
      operationType: getDeleteLogType(record.type),
      user: currentUser,
      description: `${record.type} kaydı silindi. Kategori: ${record.category}. Tutar: ${formatCurrency(record.amount)}.`
    })
  }

  return (
    <div className="income-expense-page">
      <div className="page-title">
        <div>
          <h2>Gelir Gider Yönetimi</h2>
          <p className="muted">İşletmenin gelir ve gider kayıtlarını yönetin.</p>
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
          <span>Net Sonuç</span>
          <strong>{formatCurrency(netResult)}</strong>
        </div>
        <div className="metric-card">
          <span>Bu Ay Sonuç</span>
          <strong>{formatCurrency(monthResult)}</strong>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Gelir İşlem Sayısı</span>
          <strong>{incomeRecords.length}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Gider İşlem Sayısı</span>
          <strong>{expenseRecords.length}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>En Büyük Gider</span>
          <strong>{formatCurrency(biggestExpense)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>En Büyük Gelir</span>
          <strong>{formatCurrency(biggestIncome)}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Kayıt Listesi</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls income-expense-filters">
              <input
                type="search"
                placeholder="Tür, kategori, ödeme türü veya açıklama ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TypeFilter)}>
                <option value="all">Tümü</option>
                {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="all">Tüm kategoriler</option>
                {categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table income-expense-table">
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
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun gelir gider kaydı bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>
                      <span className={`status-pill ${record.type === 'Gelir' ? 'success' : 'danger-pill'}`}>
                        {record.type}
                      </span>
                    </td>
                    <td><strong>{record.category}</strong></td>
                    <td>{record.paymentMethod}</td>
                    <td><strong>{formatCurrency(record.amount)}</strong></td>
                    <td>{record.description || '-'}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(record)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => deleteRecord(record)}>Sil</button>
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
              <h3>{editingRecord ? 'Kayıt Düzenle' : 'Yeni Kayıt'}</h3>
              {editingRecord && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <IncomeExpenseForm
              record={editingRecord}
              onSave={saveRecord}
              onCancel={editingRecord ? () => {
                setEditingRecord(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function IncomeExpenseForm({
  record,
  onSave,
  onCancel
}: {
  record: IncomeExpense | null
  onSave: (values: IncomeExpenseFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<IncomeExpenseFormValues>(() => toFormValues(record))

  React.useEffect(() => {
    setValues(toFormValues(record))
  }, [record])

  const formCategories = getCategoriesByType(values.type)

  const updateField = <K extends keyof IncomeExpenseFormValues>(key: K, value: IncomeExpenseFormValues[K]) => {
    setValues(prev => {
      if(key === 'type'){
        const nextType = value as IncomeExpenseType
        return {
          ...prev,
          type: nextType,
          category: getCategoriesByType(nextType)[0]
        }
      }

      return { ...prev, [key]: value }
    })
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const saved = onSave(values)
    if(saved && !record) setValues(toFormValues(null))
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Tür</label>
        <select value={values.type} onChange={event => updateField('type', event.target.value as IncomeExpenseType)} required>
          {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Kategori</label>
        <select value={values.category} onChange={event => updateField('category', event.target.value)} required>
          {formCategories.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Ödeme Türü</label>
        <select value={values.paymentMethod} onChange={event => updateField('paymentMethod', event.target.value as IncomeExpensePaymentMethod)} required>
          {paymentMethods.map(method => <option key={method} value={method}>{method}</option>)}
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
        <textarea rows={4} value={values.description} onChange={event => updateField('description', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
