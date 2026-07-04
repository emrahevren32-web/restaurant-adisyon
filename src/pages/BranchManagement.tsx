import React from 'react'
import { Branch, User } from '../types'
import {
  addActionLog,
  checkUserLicenseLimit,
  getCompanyIdForUser,
  getVisibleBranchesForUser,
  loadBranches,
  saveBranches
} from '../storage'

type Props = {
  currentUser: User
  onBranchesChange?: (branches: Branch[]) => void
}
type StatusFilter = 'all' | 'active' | 'inactive'

type BranchFormValues = {
  code: string
  name: string
  phone: string
  email: string
  city: string
  address: string
  managerName: string
  isActive: boolean
}

const createId = () => `branch_${Date.now()}_${Math.random().toString(16).slice(2)}`

const createBranchCode = (items: Branch[]) => {
  const maxCode = items.reduce((max, item) => {
    const match = item.code.match(/^SUBE-(\d+)$/i)
    if(!match) return max

    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return `SUBE-${String(maxCode + 1).padStart(3, '0')}`
}

const createEmptyValues = (items: Branch[]): BranchFormValues => ({
  code: createBranchCode(items),
  name: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  managerName: '',
  isActive: true
})

const toFormValues = (branch: Branch | null, items: Branch[]): BranchFormValues => {
  if(!branch) return createEmptyValues(items)

  return {
    code: branch.code,
    name: branch.name,
    phone: branch.phone,
    email: branch.email,
    city: branch.city,
    address: branch.address,
    managerName: branch.managerName,
    isActive: branch.isActive
  }
}

const normalizeFormValues = (values: BranchFormValues): BranchFormValues => ({
  code: values.code.trim().toLocaleUpperCase('tr-TR'),
  name: values.name.trim(),
  phone: values.phone.trim(),
  email: values.email.trim(),
  city: values.city.trim(),
  address: values.address.trim(),
  managerName: values.managerName.trim(),
  isActive: values.isActive
})

const sortBranches = (branches: Branch[]) => {
  return [...branches].sort((first, second) => {
    const codeDiff = first.code.localeCompare(second.code, 'tr-TR', { numeric: true })
    if(codeDiff !== 0) return codeDiff
    return first.name.localeCompare(second.name, 'tr-TR')
  })
}

export default function BranchManagement({ currentUser, onBranchesChange }: Props){
  const [items, setItems] = React.useState<Branch[]>(() => getVisibleBranchesForUser(currentUser))
  const [editingBranch, setEditingBranch] = React.useState<Branch | null>(null)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    setItems(getVisibleBranchesForUser(currentUser))
    setEditingBranch(null)
  }, [currentUser])

  const persistScopedBranches = (nextItems: Branch[]) => {
    const companyId = getCompanyIdForUser(currentUser)
    const otherTenantBranches = loadBranches().filter(branch => branch.companyId !== companyId)
    saveBranches([...nextItems, ...otherTenantBranches])
    onBranchesChange?.(nextItems)
  }

  const cityOptions = React.useMemo(() => {
    return Array.from(new Set(items.map(item => item.city).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [items])

  const visibleItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortBranches(items.filter(item => {
      const matchesSearch = !normalizedSearch
        || item.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.city.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.phone.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.email.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || item.managerName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && item.isActive)
        || (statusFilter === 'inactive' && !item.isActive)
      const matchesCity = cityFilter === 'all' || item.city === cityFilter

      return matchesSearch && matchesStatus && matchesCity
    }))
  }, [cityFilter, items, search, statusFilter])

  const activeCount = items.filter(item => item.isActive).length
  const passiveCount = items.length - activeCount
  const cityCount = cityOptions.length

  const startEdit = (branch: Branch) => {
    setEditingBranch(branch)
    setFormError('')
  }

  const saveBranch = (values: BranchFormValues) => {
    const normalized = normalizeFormValues(values)

    if(!normalized.code){
      setFormError('Şube kodu zorunludur.')
      return false
    }

    if(!normalized.name){
      setFormError('Şube adı zorunludur.')
      return false
    }

    if(!normalized.city){
      setFormError('Şehir zorunludur.')
      return false
    }

    const duplicatedCode = items.some(item => {
      const sameCode = item.code.toLocaleLowerCase('tr-TR') === normalized.code.toLocaleLowerCase('tr-TR')
      const sameItem = editingBranch && item.id === editingBranch.id
      return sameCode && !sameItem
    })

    if(duplicatedCode){
      setFormError('Şube kodu benzersiz olmalıdır.')
      return false
    }

    const now = new Date().toISOString()

    if(editingBranch){
      const updatedBranch: Branch = {
        ...editingBranch,
        ...normalized,
        updatedAt: now
      }

      const nextItems = items.map(item => item.id === editingBranch.id ? updatedBranch : item)
      setItems(nextItems)
      persistScopedBranches(nextItems)
      setEditingBranch(null)
      setFormError('')
      addActionLog({
        operationType: 'Şube güncellendi',
        user: currentUser,
        description: `${updatedBranch.code} kodlu ${updatedBranch.name} şubesi güncellendi.`
      })
      return true
    }

    const limitCheck = checkUserLicenseLimit(currentUser, 'branches')
    if(!limitCheck.allowed){
      setFormError(limitCheck.message)
      return false
    }

    const branch: Branch = {
      id: createId(),
      tenantId: currentUser.tenantId,
      companyId: limitCheck.companyId || getCompanyIdForUser(currentUser) || undefined,
      ...normalized,
      createdAt: now,
      updatedAt: now
    }

    const nextItems = [branch, ...items]
    setItems(nextItems)
    persistScopedBranches(nextItems)
    setFormError('')
    addActionLog({
      operationType: 'Şube oluşturuldu',
      user: currentUser,
      description: `${branch.code} kodlu ${branch.name} şubesi oluşturuldu.`
    })
    return true
  }

  const toggleBranchStatus = (branch: Branch) => {
    const updatedBranch: Branch = {
      ...branch,
      isActive: !branch.isActive,
      updatedAt: new Date().toISOString()
    }

    const nextItems = items.map(item => item.id === branch.id ? updatedBranch : item)
    setItems(nextItems)
    persistScopedBranches(nextItems)
    if(editingBranch?.id === branch.id) setEditingBranch(updatedBranch)

    addActionLog({
      operationType: branch.isActive ? 'Şube pasif yapıldı' : 'Şube aktif yapıldı',
      user: currentUser,
      description: `${branch.code} kodlu ${branch.name} şubesi ${branch.isActive ? 'pasif' : 'aktif'} yapıldı.`
    })
  }

  const deleteBranch = (branch: Branch) => {
    if(!confirm(`${branch.name} şubesi silinecek. Emin misiniz?`)) return

    const nextItems = items.filter(item => item.id !== branch.id)
    setItems(nextItems)
    persistScopedBranches(nextItems)
    if(editingBranch?.id === branch.id) setEditingBranch(null)
    addActionLog({
      operationType: 'Şube silindi',
      user: currentUser,
      description: `${branch.code} kodlu ${branch.name} şubesi silindi.`
    })
  }

  return (
    <div className="branch-management-page">
      <div className="page-title">
        <div>
          <h2>Şube Yönetimi</h2>
          <p className="muted">İşletmenize ait şubeleri yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Şube</span>
          <strong>{items.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Şube</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Pasif Şube</span>
          <strong>{passiveCount}</strong>
        </div>
        <div className="metric-card">
          <span>Şehir Sayısı</span>
          <strong>{cityCount}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Şube Listesi</h3>
              <p className="muted">{visibleItems.length} kayıt gösteriliyor.</p>
            </div>
            <div className="toolbar-controls branch-filters">
              <input
                type="search"
                placeholder="Kod, şube adı, şehir veya müdür ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tümü</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
              <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
                <option value="all">Tüm şehirler</option>
                {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table branch-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Şube Adı</th>
                  <th>Şehir</th>
                  <th>Telefon</th>
                  <th>Şube Müdürü</th>
                  <th>Durum</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Bu filtrelere uygun şube bulunamadı.</td></tr>
                )}
                {visibleItems.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong></td>
                    <td>
                      <strong>{item.name}</strong>
                      {(item.email || item.address) && (
                        <div className="muted small-text">
                          {[item.email, item.address].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{item.city}</td>
                    <td>{item.phone || '-'}</td>
                    <td>{item.managerName || '-'}</td>
                    <td>
                      <span className={`status-pill ${item.isActive ? 'success' : 'muted-pill'}`}>
                        {item.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(item)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => toggleBranchStatus(item)}>
                        {item.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                      <button className="btn" type="button" onClick={() => deleteBranch(item)}>Sil</button>
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
              <h3>{editingBranch ? 'Şube Düzenle' : 'Yeni Şube'}</h3>
              {editingBranch && <span className="status-pill">Düzenleme</span>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <BranchForm
              branch={editingBranch}
              branches={items}
              onSave={saveBranch}
              onCancel={editingBranch ? () => {
                setEditingBranch(null)
                setFormError('')
              } : undefined}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}

function BranchForm({
  branch,
  branches,
  onSave,
  onCancel
}: {
  branch: Branch | null
  branches: Branch[]
  onSave: (values: BranchFormValues) => boolean
  onCancel?: () => void
}){
  const [values, setValues] = React.useState<BranchFormValues>(() => toFormValues(branch, branches))

  React.useEffect(() => {
    setValues(toFormValues(branch, branches))
  }, [branch, branches])

  const updateField = <K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const saved = onSave(values)
    if(saved && !branch) setValues(createEmptyValues(branches))
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <div className="form-field">
        <label>Şube Kodu</label>
        <input value={values.code} onChange={event => updateField('code', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Şube Adı</label>
        <input value={values.name} onChange={event => updateField('name', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Telefon</label>
        <input value={values.phone} onChange={event => updateField('phone', event.target.value)} />
      </div>
      <div className="form-field">
        <label>E-Posta</label>
        <input type="email" value={values.email} onChange={event => updateField('email', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Şehir</label>
        <input value={values.city} onChange={event => updateField('city', event.target.value)} required />
      </div>
      <div className="form-field">
        <label>Adres</label>
        <textarea rows={3} value={values.address} onChange={event => updateField('address', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Şube Müdürü</label>
        <input value={values.managerName} onChange={event => updateField('managerName', event.target.value)} />
      </div>
      <label className="check-row form-check-field">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={event => updateField('isActive', event.target.checked)}
        />
        Aktif
      </label>
      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>İptal</button>}
      </div>
    </form>
  )
}
