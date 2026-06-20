import React from 'react'
import { Branch, BranchPermission, User } from '../types'
import { addActionLog, loadBranches, loadBranchPermissions, loadUsers, saveBranchPermissions } from '../storage'

type Props = {
  currentUser: User
}

type PermissionFormValues = {
  userId: string
  branchId: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

const createId = () => `branch_permission_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getUserName = (users: User[], userId: string) => {
  const user = users.find(item => item.id === userId)
  return user ? user.fullName || user.username : userId
}

const getBranchName = (branches: Branch[], branchId: string) => {
  return branches.find(item => item.id === branchId)?.name || branchId
}

const sortPermissions = (permissions: BranchPermission[], users: User[], branches: Branch[]) => {
  return [...permissions].sort((first, second) => {
    const userDiff = getUserName(users, first.userId).localeCompare(getUserName(users, second.userId), 'tr-TR')
    if(userDiff !== 0) return userDiff
    return getBranchName(branches, first.branchId).localeCompare(getBranchName(branches, second.branchId), 'tr-TR')
  })
}

const createEmptyValues = (users: User[], branches: Branch[]): PermissionFormValues => ({
  userId: users[0]?.id || '',
  branchId: branches[0]?.id || '',
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false
})

const toFormValues = (permission: BranchPermission | null, users: User[], branches: Branch[]): PermissionFormValues => {
  if(!permission) return createEmptyValues(users, branches)

  return {
    userId: permission.userId,
    branchId: permission.branchId,
    canView: permission.canView,
    canCreate: permission.canCreate,
    canEdit: permission.canEdit,
    canDelete: permission.canDelete
  }
}

const PermissionBadge = ({ value }: { value: boolean }) => {
  return <span className={`status-pill ${value ? 'success' : 'muted-pill'}`}>{value ? 'Var' : 'Yok'}</span>
}

export default function BranchPermissions({ currentUser }: Props){
  const [users] = React.useState<User[]>(() => loadUsers())
  const [branches] = React.useState<Branch[]>(() => loadBranches())
  const [permissions, setPermissions] = React.useState<BranchPermission[]>(() => loadBranchPermissions())
  const [editingPermission, setEditingPermission] = React.useState<BranchPermission | null>(null)
  const [values, setValues] = React.useState<PermissionFormValues>(() => createEmptyValues(loadUsers(), loadBranches()))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [userFilter, setUserFilter] = React.useState('all')
  const [branchFilter, setBranchFilter] = React.useState('all')

  const activeUsers = React.useMemo(() => users.filter(user => user.active), [users])
  const activeBranches = React.useMemo(() => branches.filter(branch => branch.isActive), [branches])

  const visiblePermissions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return sortPermissions(permissions.filter(permission => {
      const userName = getUserName(users, permission.userId)
      const branchName = getBranchName(branches, permission.branchId)
      const matchesSearch = !normalizedSearch
        || userName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || branchName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesUser = userFilter === 'all' || permission.userId === userFilter
      const matchesBranch = branchFilter === 'all' || permission.branchId === branchFilter

      return matchesSearch && matchesUser && matchesBranch
    }), users, branches)
  }, [branchFilter, branches, permissions, search, userFilter, users])

  const authorizedUserCount = React.useMemo(() => {
    return new Set(permissions.filter(permission => permission.canView).map(permission => permission.userId)).size
  }, [permissions])

  React.useEffect(() => {
    saveBranchPermissions(permissions)
  }, [permissions])

  React.useEffect(() => {
    if(!values.userId && activeUsers[0]){
      setValues(prev => ({ ...prev, userId: activeUsers[0].id }))
    }
  }, [activeUsers, values.userId])

  React.useEffect(() => {
    if(!values.branchId && activeBranches[0]){
      setValues(prev => ({ ...prev, branchId: activeBranches[0].id }))
    }
  }, [activeBranches, values.branchId])

  const updateField = <K extends keyof PermissionFormValues>(key: K, value: PermissionFormValues[K]) => {
    setValues(prev => {
      const next = { ...prev, [key]: value }
      if((key === 'canCreate' || key === 'canEdit' || key === 'canDelete') && value === true){
        next.canView = true
      }
      return next
    })
    setFormError('')
  }

  const resetForm = () => {
    setEditingPermission(null)
    setValues(createEmptyValues(activeUsers, activeBranches))
    setFormError('')
  }

  const startEdit = (permission: BranchPermission) => {
    setEditingPermission(permission)
    setValues(toFormValues(permission, activeUsers, activeBranches))
    setFormError('')
  }

  const savePermission = (event: React.FormEvent) => {
    event.preventDefault()

    if(!values.userId){
      setFormError('Kullanıcı zorunludur.')
      return
    }

    if(!values.branchId){
      setFormError('Şube zorunludur.')
      return
    }

    const duplicate = permissions.some(permission => {
      const samePair = permission.userId === values.userId && permission.branchId === values.branchId
      const sameItem = editingPermission && permission.id === editingPermission.id
      return samePair && !sameItem
    })

    if(duplicate){
      setFormError('Aynı kullanıcı için aynı şubede ikinci yetki kaydı oluşturulamaz.')
      return
    }

    const now = new Date().toISOString()
    const normalizedValues = {
      ...values,
      canView: values.canView || values.canCreate || values.canEdit || values.canDelete
    }
    const userName = getUserName(users, normalizedValues.userId)
    const branchName = getBranchName(branches, normalizedValues.branchId)

    if(editingPermission){
      const updatedPermission: BranchPermission = {
        ...editingPermission,
        ...normalizedValues,
        updatedAt: now
      }
      const nextPermissions = permissions.map(permission => permission.id === editingPermission.id ? updatedPermission : permission)

      setPermissions(nextPermissions)
      setEditingPermission(null)
      setValues(createEmptyValues(activeUsers, activeBranches))
      addActionLog({
        operationType: 'Şube yetkisi güncellendi',
        user: currentUser,
        description: `${userName} kullanıcısının ${branchName} şube yetkisi güncellendi.`
      })
      return
    }

    const permission: BranchPermission = {
      id: createId(),
      ...normalizedValues,
      createdAt: now,
      updatedAt: now
    }
    const nextPermissions = [permission, ...permissions]

    setPermissions(nextPermissions)
    setValues(createEmptyValues(activeUsers, activeBranches))
    addActionLog({
      operationType: 'Şube yetkisi oluşturuldu',
      user: currentUser,
      description: `${userName} kullanıcısına ${branchName} şubesi için yetki verildi.`
    })
  }

  const deletePermission = (permission: BranchPermission) => {
    const userName = getUserName(users, permission.userId)
    const branchName = getBranchName(branches, permission.branchId)

    if(!confirm(`${userName} kullanıcısının ${branchName} yetkisi silinecek. Emin misiniz?`)) return

    const nextPermissions = permissions.filter(item => item.id !== permission.id)
    setPermissions(nextPermissions)
    if(editingPermission?.id === permission.id) resetForm()
    addActionLog({
      operationType: 'Şube yetkisi silindi',
      user: currentUser,
      description: `${userName} kullanıcısının ${branchName} şube yetkisi silindi.`
    })
  }

  return (
    <div className="branch-permissions-page">
      <div className="page-title">
        <div>
          <h2>Şube Yetkilendirme</h2>
          <p className="muted">Kullanıcıların şube erişim ve yetkilerini yönetin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Kullanıcı</span>
          <strong>{users.length}</strong>
        </div>
        <div className="metric-card">
          <span>Yetkili Kullanıcı</span>
          <strong>{authorizedUserCount}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Şube</span>
          <strong>{branches.length}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Yetki Kaydı</span>
          <strong>{permissions.length}</strong>
        </div>
      </div>

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Yetki Tablosu</h3>
              <p className="muted">{visiblePermissions.length} yetki kaydı gösteriliyor.</p>
            </div>
            <div className="toolbar-controls branch-permission-filters">
              <input
                type="search"
                placeholder="Kullanıcı veya şube ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={userFilter} onChange={event => setUserFilter(event.target.value)}>
                <option value="all">Tüm kullanıcılar</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
              </select>
              <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
                <option value="all">Tüm şubeler</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table branch-permission-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Şube</th>
                  <th>Görüntüleme</th>
                  <th>Ekleme</th>
                  <th>Düzenleme</th>
                  <th>Silme</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visiblePermissions.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Yetki kaydı bulunmuyor.</td></tr>
                )}
                {visiblePermissions.map(permission => (
                  <tr key={permission.id}>
                    <td><strong>{getUserName(users, permission.userId)}</strong></td>
                    <td>{getBranchName(branches, permission.branchId)}</td>
                    <td><PermissionBadge value={permission.canView} /></td>
                    <td><PermissionBadge value={permission.canCreate} /></td>
                    <td><PermissionBadge value={permission.canEdit} /></td>
                    <td><PermissionBadge value={permission.canDelete} /></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => startEdit(permission)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => deletePermission(permission)}>Sil</button>
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
              <div>
                <h3>{editingPermission ? 'Yetki Düzenle' : 'Yeni Yetki Formu'}</h3>
                <p className="muted">Kullanıcıyı bir şubeye atayın.</p>
              </div>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <form className="stacked-form" onSubmit={savePermission}>
              <div className="form-field">
                <label>Kullanıcı</label>
                <select value={values.userId} onChange={event => updateField('userId', event.target.value)} required>
                  {activeUsers.map(user => <option key={user.id} value={user.id}>{user.fullName || user.username}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Şube</label>
                <select value={values.branchId} onChange={event => updateField('branchId', event.target.value)} required>
                  {activeBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={values.canView} onChange={event => updateField('canView', event.target.checked)} />
                <span>Görüntüleme Yetkisi</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={values.canCreate} onChange={event => updateField('canCreate', event.target.checked)} />
                <span>Ekleme Yetkisi</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={values.canEdit} onChange={event => updateField('canEdit', event.target.checked)} />
                <span>Düzenleme Yetkisi</span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={values.canDelete} onChange={event => updateField('canDelete', event.target.checked)} />
                <span>Silme Yetkisi</span>
              </label>
              <div className="form-actions">
                {editingPermission && <button className="btn" type="button" onClick={resetForm}>Vazgeç</button>}
                <button className="btn primary" type="submit" disabled={activeUsers.length === 0 || activeBranches.length === 0}>Kaydet</button>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  )
}
