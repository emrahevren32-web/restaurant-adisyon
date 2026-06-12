import React from 'react'
import { CurrentAccount, CurrentAccountType, User } from '../types'
import { addActionLog, loadCurrentAccounts, saveCurrentAccounts } from '../storage'

type Props = { currentUser: User }
type StatusFilter = 'active' | 'inactive' | 'all'
type TypeFilter = CurrentAccountType | 'all'

type CurrentAccountFormValues = {
  name: string
  type: CurrentAccountType
  phone: string
  email: string
  taxNumber: string
  authorizedPerson: string
  address: string
  note: string
}

const currentAccountTypes: CurrentAccountType[] = ['Müşteri', 'Firma', 'Personel', 'Tedarikçi']

const createId = (prefix: string) => `${prefix}_${Date.now()}`

const createEmptyValues = (): CurrentAccountFormValues => ({
  name: '',
  type: 'Müşteri',
  phone: '',
  email: '',
  taxNumber: '',
  authorizedPerson: '',
  address: '',
  note: ''
})

const toFormValues = (account: CurrentAccount | null): CurrentAccountFormValues => {
  if(!account) return createEmptyValues()

  return {
    name: account.name,
    type: account.type,
    phone: account.phone,
    email: account.email,
    taxNumber: account.taxNumber,
    authorizedPerson: account.authorizedPerson,
    address: account.address,
    note: account.note
  }
}

const createCurrentAccountCode = (items: CurrentAccount[]) => {
  const maxCode = items.reduce((max, item) => {
    const match = item.code.match(/^CARI-(\d+)$/)
    if(!match) return max

    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return `CARI-${String(maxCode + 1).padStart(3, '0')}`
}

const normalizeFormValues = (values: CurrentAccountFormValues): CurrentAccountFormValues => ({
  name: values.name.trim(),
  type: values.type,
  phone: values.phone.trim(),
  email: values.email.trim(),
  taxNumber: values.taxNumber.trim(),
  authorizedPerson: values.authorizedPerson.trim(),
  address: values.address.trim(),
  note: values.note.trim()
})

export default function CurrentAccounts({ currentUser }: Props){
  const [items, setItems] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [editingAccount, setEditingAccount] = React.useState<CurrentAccount | null>(null)
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    saveCurrentAccounts(items)
  }, [items])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return items.filter(item => {
      const matchesSearch = !normalizedSearch
        || item.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.phone.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.email.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.taxNumber.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.authorizedPerson.toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesType = typeFilter === 'all' || item.type === typeFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && item.isActive)
        || (statusFilter === 'inactive' && !item.isActive)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [items, search, statusFilter, typeFilter])

  const activeCount = items.filter(item => item.isActive).length
  const customerCount = items.filter(item => item.type === 'Müşteri').length
  const supplierCount = items.filter(item => item.type === 'Tedarikçi').length

  const startEdit = (account: CurrentAccount) => {
    setEditingAccount(account)
    setFormError('')
  }

  const saveAccount = (values: CurrentAccountFormValues) => {
    const normalized = normalizeFormValues(values)

    if(!normalized.name){
      setFormError('Cari adı zorunludur.')
      return false
    }

    if(!normalized.type){
      setFormError('Cari türü zorunludur.')
      return false
    }

    const now = new Date().toISOString()

    if(editingAccount){
      const updatedAccount: CurrentAccount = {
        ...editingAccount,
        ...normalized,
        updatedAt: now
      }

      setItems(prev => prev.map(item => item.id === editingAccount.id ? updatedAccount : item))
      setEditingAccount(null)
      setFormError('')
      addActionLog({
        operationType: 'Cari güncellendi',
        user: currentUser,
        description: `${updatedAccount.code} kodlu ${updatedAccount.name} cari kartı güncellendi.`
      })
      return true
    }

    const account: CurrentAccount = {
      id: createId('cari'),
      code: createCurrentAccountCode(items),
      ...normalized,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    setItems(prev => [account, ...prev])
    setFormError('')
    addActionLog({
      operationType: 'Cari oluşturuldu',
      user: currentUser,
      description: `${account.code} kodlu ${account.name} cari kartı oluşturuldu.`
    })
    return true
  }

  const toggleAccountStatus = (account: CurrentAccount) => {
    const updatedAccount = {
      ...account,
      isActive: !account.isActive,
      updatedAt: new Date().toISOString()
    }

    setItems(prev => prev.map(item => item.id === account.id ? updatedAccount : item))
    if(editingAccount?.id === account.id) setEditingAccount(updatedAccount)

    addActionLog({
      operationType: account.isActive ? 'Cari pasif yapıldı' : 'Cari aktif yapıldı',
      user: currentUser,
      description: `${account.code} kodlu ${account.name} cari kartı ${account.isActive ? 'pasif' : 'aktif'} yapıldı.`
    })
  }

  const deleteAccount = (account: CurrentAccount) => {
    if(!confirm(`${account.name} cari kartı silinecek. Emin misiniz?`)) return

    setItems(prev => prev.filter(item => item.id !== account.id))
    if(editingAccount?.id === account.id) setEditingAccount(null)
    addActionLog({
      operationType: 'Cari silindi',
      user: currentUser,
      description: `${account.code} kodlu ${account.name} cari kartı silindi.`
    })
  }

  return (
    <div className="current-accounts-page">
      <div className="page-title">
        <div>
          <h2>Cari Kartları</h2>
          <p className="muted">Müşteri, firma, personel ve tedarikçi kayıtlarını yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Cari</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Cari</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Müşteri Sayısı</span>
          <strong>{customerCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tedarikçi Sayısı</span>
          <strong>{supplierCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Cari Listesi</h3>
              <p className="muted">{visibleItems.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls current-account-filters">
              <input
                type="search"
                placeholder="Kod, cari adı, telefon veya yetkili ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as TypeFilter)}>
                <option value="all">Tümü</option>
                {currentAccountTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
                <option value="all">Tümü</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table current-account-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Cari Adı</th>
                  <th>Tür</th>
                  <th>Telefon</th>
                  <th>Yetkili</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun cari kartı bulunamadı.</td></tr>
                )}
                {visibleItems.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong></td>
                    <td>
                      <strong>{item.name}</strong>
                      {(item.email || item.taxNumber || item.note) && (
                        <div className="muted small-text">
                          {[item.email, item.taxNumber && `Vergi No: ${item.taxNumber}`, item.note].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{item.type}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.authorizedPerson || '-'}</td>
                    <td>
                      <span className={`status-pill ${item.isActive ? 'success' : 'muted-pill'}`}>
                        {item.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(item)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => toggleAccountStatus(item)}>
                        {item.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                      <button className="btn" type="button" onClick={() => deleteAccount(item)}>Sil</button>
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
              <h3>{editingAccount ? 'Cari Düzenle' : 'Yeni Cari'}</h3>
              {editingAccount && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <CurrentAccountForm
              account={editingAccount}
              onSave={saveAccount}
              onCancel={editingAccount ? () => {
                setEditingAccount(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function CurrentAccountForm({
  account,
  onSave,
  onCancel
}: {
  account: CurrentAccount | null
  onSave: (values: CurrentAccountFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<CurrentAccountFormValues>(() => toFormValues(account))

  React.useEffect(() => {
    setValues(toFormValues(account))
  }, [account])

  const updateField = <K extends keyof CurrentAccountFormValues>(key: K, value: CurrentAccountFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const saved = onSave(values)
    if(saved && !account) setValues(createEmptyValues())
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Cari Adı</label>
        <input value={values.name} onChange={event => updateField('name', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Tür</label>
        <select value={values.type} onChange={event => updateField('type', event.target.value as CurrentAccountType)} required>
          {currentAccountTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Telefon</label>
        <input value={values.phone} onChange={event => updateField('phone', event.target.value)} />
      </div>
      <div className="form-field">
        <label>E-posta</label>
        <input type="email" value={values.email} onChange={event => updateField('email', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Vergi No</label>
        <input value={values.taxNumber} onChange={event => updateField('taxNumber', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Yetkili Kişi</label>
        <input value={values.authorizedPerson} onChange={event => updateField('authorizedPerson', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Adres</label>
        <textarea rows={3} value={values.address} onChange={event => updateField('address', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Not</label>
        <textarea rows={3} value={values.note} onChange={event => updateField('note', event.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
