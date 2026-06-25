import React from 'react'
import {
  Company,
  CompanyLicense,
  CompanyUser,
  CompanyUserRole,
  CompanyUserStatus,
  LicensePackage,
  User,
  UserSubscription,
  UserSubscriptionStatus
} from '../types'
import {
  addActionLog,
  checkCompanyUserLicenseLimit,
  generateTemporaryCompanyPassword,
  getCompanyLicenseRuntimeStatus,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanyUsers,
  loadLicensePackages,
  loadUserSubscriptions,
  loadUsers,
  saveCompanyUsers,
  saveUserSubscriptions,
  saveUsers
} from '../storage'

type Props = {
  currentUser: User
}

type CompanyFilter = string | 'all'
type RoleFilter = CompanyUserRole | 'all'
type UserStatusFilter = CompanyUserStatus | 'all'
type SubscriptionFilter = UserSubscriptionStatus | 'all' | 'none'

type UserFormValues = {
  id: string
  companyId: string
  fullName: string
  username: string
  email: string
  phone: string
  role: CompanyUserRole
  temporaryPassword: string
  status: CompanyUserStatus
}

const companyUserRoles: CompanyUserRole[] = ['Firma Sahibi', 'Admin', 'Müdür', 'Kasiyer', 'Garson', 'Mutfak', 'Kurye', 'Muhasebe']
const companyUserStatuses: CompanyUserStatus[] = ['Aktif', 'Pasif', 'Askıya Alındı', 'Silindi']
const subscriptionStatuses: UserSubscriptionStatus[] = ['Aktif', 'Pasif', 'Beklemede', 'Süresi Doldu']

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
const todayKey = () => new Date().toLocaleDateString('sv-SE')

const getDaysRemaining = (dateKey: string) => {
  if(!dateKey) return 0
  const target = new Date(`${dateKey}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  if(Number.isNaN(target.getTime())) return 0
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T12:00:00`)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const getLicenseDeadline = (license?: CompanyLicense) => {
  if(!license) return ''
  return license.isTrial ? license.trialEndDate || license.endDate : license.endDate
}

const getStatusClassName = (status: CompanyUserStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Pasif') return 'muted-pill'
  if(status === 'Askıya Alındı') return 'warning-pill'
  return 'danger-pill'
}

const getSubscriptionClassName = (status?: UserSubscriptionStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Beklemede') return 'warning-pill'
  if(status === 'Süresi Doldu') return 'danger-pill'
  return 'muted-pill'
}

const getRuntimeSubscriptionStatus = (subscription?: UserSubscription): UserSubscriptionStatus | undefined => {
  if(!subscription) return undefined
  if(subscription.status === 'Aktif' && subscription.expiresAt && subscription.expiresAt < todayKey()) return 'Süresi Doldu'
  return subscription.status
}

const createEmptyForm = (companies: Company[]): UserFormValues => ({
  id: '',
  companyId: companies[0]?.id || '',
  fullName: '',
  username: '',
  email: '',
  phone: '',
  role: 'Garson',
  temporaryPassword: generateTemporaryCompanyPassword(),
  status: 'Aktif'
})

const toFormValues = (user: CompanyUser, companies: Company[]): UserFormValues => ({
  id: user.id,
  companyId: user.companyId || companies[0]?.id || '',
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  phone: user.phone,
  role: user.role,
  temporaryPassword: generateTemporaryCompanyPassword(),
  status: user.status
})

const normalizeSearch = (value: string) => value.toLocaleLowerCase('tr-TR')

const mapCompanyRoleToSystemRole = (role: CompanyUserRole): User['role'] => {
  return role === 'Firma Sahibi' || role === 'Admin' || role === 'Müdür' || role === 'Muhasebe'
    ? 'Admin'
    : 'Garson'
}

export default function UserSubscriptionManagement({ currentUser }: Props){
  const initialData = React.useMemo(() => ({
    companies: loadCompanies(),
    companyUsers: loadCompanyUsers(),
    subscriptions: loadUserSubscriptions(),
    licenses: loadCompanyLicenses(),
    packages: loadLicensePackages()
  }), [])

  const [companies] = React.useState<Company[]>(initialData.companies)
  const [companyUsers, setCompanyUsers] = React.useState<CompanyUser[]>(initialData.companyUsers)
  const [subscriptions, setSubscriptions] = React.useState<UserSubscription[]>(initialData.subscriptions)
  const [licenses] = React.useState<CompanyLicense[]>(initialData.licenses)
  const [packages] = React.useState<LicensePackage[]>(initialData.packages)
  const [selectedUserId, setSelectedUserId] = React.useState(initialData.companyUsers[0]?.id || '')
  const [formValues, setFormValues] = React.useState<UserFormValues>(() => createEmptyForm(initialData.companies))
  const [companyFilter, setCompanyFilter] = React.useState<CompanyFilter>('all')
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<UserStatusFilter>('all')
  const [subscriptionFilter, setSubscriptionFilter] = React.useState<SubscriptionFilter>('all')
  const [lastLoginFilter, setLastLoginFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [formError, setFormError] = React.useState('')
  const [formMessage, setFormMessage] = React.useState('')

  React.useEffect(() => {
    saveCompanyUsers(companyUsers)
  }, [companyUsers])

  React.useEffect(() => {
    saveUserSubscriptions(subscriptions)
  }, [subscriptions])

  const companyMap = React.useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])
  const licenseMap = React.useMemo(() => new Map(licenses.map(license => [license.id, {
    ...license,
    status: getCompanyLicenseRuntimeStatus(license)
  }])), [licenses])
  const packageMap = React.useMemo(() => new Map(packages.map(packageItem => [packageItem.id, packageItem])), [packages])

  const getSubscriptionForUser = React.useCallback((userId: string) => {
    return [...subscriptions]
      .filter(subscription => subscription.userId === userId)
      .sort((first, second) => second.assignedAt.localeCompare(first.assignedAt))[0]
  }, [subscriptions])

  const getActiveLicenseForCompany = React.useCallback((companyId: string) => {
    return licenses
      .map(license => ({ ...license, status: getCompanyLicenseRuntimeStatus(license) }))
      .filter(license => license.companyId === companyId && (
        license.status === 'Aktif'
        || license.status === 'Deneme'
        || license.status === 'Süresi Yaklaşıyor'
      ))
      .sort((first, second) => second.startDate.localeCompare(first.startDate))[0]
  }, [licenses])

  const getCompanyUsage = React.useCallback((companyId: string) => {
    return companyUsers.filter(user => user.companyId === companyId && user.status !== 'Silindi').length
  }, [companyUsers])

  const visibleUsers = React.useMemo(() => {
    const query = normalizeSearch(search.trim())

    return [...companyUsers]
      .sort((first, second) => {
        const companyDiff = (companyMap.get(first.companyId)?.companyName || '').localeCompare(companyMap.get(second.companyId)?.companyName || '', 'tr-TR')
        if(companyDiff !== 0) return companyDiff
        return first.fullName.localeCompare(second.fullName, 'tr-TR')
      })
      .filter(user => {
        const subscription = getSubscriptionForUser(user.id)
        const subscriptionStatus = getRuntimeSubscriptionStatus(subscription)
        const matchesCompany = companyFilter === 'all' || user.companyId === companyFilter
        const matchesRole = roleFilter === 'all' || user.role === roleFilter
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter
        const matchesSubscription = subscriptionFilter === 'all'
          || (subscriptionFilter === 'none' ? !subscription : subscriptionStatus === subscriptionFilter)
        const matchesLastLogin = !lastLoginFilter || (user.lastLogin && user.lastLogin >= lastLoginFilter)
        const matchesSearch = !query
          || normalizeSearch(user.fullName).includes(query)
          || normalizeSearch(user.username).includes(query)
          || normalizeSearch(user.email).includes(query)
          || normalizeSearch(companyMap.get(user.companyId)?.companyName || '').includes(query)

        return matchesCompany && matchesRole && matchesStatus && matchesSubscription && matchesLastLogin && matchesSearch
      })
  }, [companyFilter, companyMap, companyUsers, getSubscriptionForUser, lastLoginFilter, roleFilter, search, statusFilter, subscriptionFilter])

  const activeUsers = companyUsers.filter(user => user.status === 'Aktif')
  const passiveUsers = companyUsers.filter(user => user.status === 'Pasif')
  const licensedUsers = companyUsers.filter(user => getRuntimeSubscriptionStatus(getSubscriptionForUser(user.id)) === 'Aktif')
  const last30Start = React.useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toLocaleDateString('sv-SE')
  }, [])
  const today = todayKey()
  const expiringUsers = companyUsers.filter(user => {
    const subscription = getSubscriptionForUser(user.id)
    const days = getDaysRemaining(subscription?.expiresAt || '')
    return getRuntimeSubscriptionStatus(subscription) === 'Aktif' && days >= 0 && days <= 30
  })
  const limitFullCompanies = companies.filter(company => {
    const license = getActiveLicenseForCompany(company.id)
    const packageItem = license ? packageMap.get(license.packageId) : undefined
    return Boolean(packageItem && packageItem.maxUsers > 0 && getCompanyUsage(company.id) >= packageItem.maxUsers)
  })

  const selectedUser = selectedUserId ? companyUsers.find(user => user.id === selectedUserId) : undefined
  const selectedSubscription = selectedUser ? getSubscriptionForUser(selectedUser.id) : undefined
  const selectedLicense = selectedSubscription ? licenseMap.get(selectedSubscription.companyLicenseId) : undefined
  const selectedPackage = selectedLicense ? packageMap.get(selectedLicense.packageId) : undefined

  const metrics = [
    { label: 'Toplam Kullanıcı', value: formatNumber(companyUsers.filter(user => user.status !== 'Silindi').length) },
    { label: 'Aktif Kullanıcı', value: formatNumber(activeUsers.length) },
    { label: 'Pasif Kullanıcı', value: formatNumber(passiveUsers.length) },
    { label: 'Lisanslı Kullanıcı', value: formatNumber(licensedUsers.length) },
    { label: 'Son 30 Gün Giriş Yapan', value: formatNumber(companyUsers.filter(user => user.lastLogin >= last30Start).length) },
    { label: 'Bugün Giriş Yapan', value: formatNumber(companyUsers.filter(user => user.lastLogin === today).length) },
    { label: 'Aboneliği Bitecek Kullanıcı', value: formatNumber(expiringUsers.length) },
    { label: 'Kullanıcı Limiti Dolan Firmalar', value: formatNumber(limitFullCompanies.length) }
  ]

  const startNewUser = () => {
    setFormValues(createEmptyForm(companies))
    setSelectedUserId('')
    setFormError('')
    setFormMessage('Yeni kullanıcı bilgilerini girin.')
  }

  const editUser = (user: CompanyUser) => {
    setSelectedUserId(user.id)
    setFormValues(toFormValues(user, companies))
    setFormError('')
    setFormMessage('')
  }

  const updateForm = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  const syncSystemUser = (companyUser: CompanyUser, password?: string) => {
    const systemUsers = loadUsers()
    const existingUser = systemUsers.find(user => user.id === companyUser.id)
    const nextUser: User = {
      id: companyUser.id,
      companyId: companyUser.companyId,
      fullName: companyUser.fullName,
      username: companyUser.username,
      password: password || existingUser?.password || generateTemporaryCompanyPassword(),
      role: mapCompanyRoleToSystemRole(companyUser.role),
      active: companyUser.status === 'Aktif'
    }

    saveUsers(existingUser
      ? systemUsers.map(user => user.id === companyUser.id ? nextUser : user)
      : [nextUser, ...systemUsers]
    )
  }

  const validateUserForm = () => {
    const normalizedUsername = formValues.username.trim().toLocaleLowerCase('tr-TR')
    if(!formValues.companyId) return 'Firma seçimi zorunludur.'
    if(!formValues.fullName.trim()) return 'Ad Soyad zorunludur.'
    if(!normalizedUsername) return 'Kullanıcı adı zorunludur.'

    const duplicateCompanyUser = companyUsers.some(user => (
      user.id !== formValues.id
      && user.status !== 'Silindi'
      && user.username.trim().toLocaleLowerCase('tr-TR') === normalizedUsername
    ))
    const duplicateSystemUser = loadUsers().some(user => (
      user.id !== formValues.id
      && user.username.trim().toLocaleLowerCase('tr-TR') === normalizedUsername
    ))

    if(duplicateCompanyUser || duplicateSystemUser) return 'Kullanıcı adı benzersiz olmalıdır.'
    if(!formValues.id && !formValues.temporaryPassword.trim()) return 'Geçici şifre zorunludur.'
    return ''
  }

  const saveUser = () => {
    const validationError = validateUserForm()
    if(validationError){
      setFormError(validationError)
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const existingUser = formValues.id ? companyUsers.find(user => user.id === formValues.id) : undefined
    const isEditing = Boolean(existingUser)

    if(!isEditing){
      const limitCheck = checkCompanyUserLicenseLimit(formValues.companyId)
      if(!limitCheck.allowed){
        setFormError(limitCheck.message)
        setFormMessage('')
        return
      }
    }

    if(isEditing && existingUser && existingUser.companyId !== formValues.companyId){
      const nextUsage = getCompanyUsage(formValues.companyId) + 1
      const limitCheck = checkCompanyUserLicenseLimit(formValues.companyId, nextUsage)
      if(!limitCheck.allowed){
        setFormError(limitCheck.message)
        setFormMessage('')
        return
      }
    }

    const nextUser: CompanyUser = {
      id: existingUser?.id || createId('company_user'),
      companyId: formValues.companyId,
      fullName: formValues.fullName.trim(),
      username: formValues.username.trim(),
      email: formValues.email.trim(),
      phone: formValues.phone.trim(),
      role: formValues.role,
      status: formValues.status,
      lastLogin: existingUser?.lastLogin || '',
      createdAt: existingUser?.createdAt || now,
      updatedAt: now
    }

    setCompanyUsers(prev => isEditing
      ? prev.map(user => user.id === nextUser.id ? nextUser : user)
      : [nextUser, ...prev]
    )
    syncSystemUser(nextUser, isEditing ? undefined : formValues.temporaryPassword.trim())
    setSelectedUserId(nextUser.id)
    setFormValues(toFormValues(nextUser, companies))
    setFormError('')
    setFormMessage(isEditing ? `${nextUser.fullName} kullanıcısı güncellendi.` : `${nextUser.fullName} kullanıcısı oluşturuldu. Geçici şifre: ${formValues.temporaryPassword}`)
    addActionLog({
      operationType: isEditing ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu',
      user: currentUser,
      description: `${companyMap.get(nextUser.companyId)?.companyName || 'Firma'} için ${nextUser.fullName} kullanıcısı ${isEditing ? 'güncellendi' : 'oluşturuldu'}.`
    })
  }

  const updateUserStatus = (targetUser: CompanyUser, status: CompanyUserStatus) => {
    const now = new Date().toISOString()
    const nextUser = { ...targetUser, status, updatedAt: now }
    setCompanyUsers(prev => prev.map(user => user.id === targetUser.id ? nextUser : user))
    syncSystemUser(nextUser)
    if(status === 'Silindi'){
      setSubscriptions(prev => prev.map(subscription => subscription.userId === targetUser.id ? {
        ...subscription,
        status: 'Pasif',
        updatedAt: now
      } : subscription))
    }

    setSelectedUserId(targetUser.id)
    setFormValues(toFormValues(nextUser, companies))
    setFormError('')
    setFormMessage(`${targetUser.fullName} durumu ${status} olarak güncellendi.`)
    addActionLog({
      operationType: status === 'Silindi'
        ? 'Kullanıcı silindi'
        : status === 'Pasif'
          ? 'Kullanıcı pasife alındı'
          : status === 'Aktif'
            ? 'Kullanıcı aktif yapıldı'
            : 'Kullanıcı güncellendi',
      user: currentUser,
      description: `${companyMap.get(targetUser.companyId)?.companyName || 'Firma'} / ${targetUser.fullName} durumu ${status} olarak güncellendi.`
    })
  }

  const resetPassword = (targetUser: CompanyUser) => {
    const temporaryPassword = generateTemporaryCompanyPassword()
    syncSystemUser(targetUser, temporaryPassword)
    setFormError('')
    setFormMessage(`${targetUser.fullName} için geçici şifre oluşturuldu: ${temporaryPassword}`)
    addActionLog({
      operationType: 'Şifre sıfırlandı',
      user: currentUser,
      description: `${companyMap.get(targetUser.companyId)?.companyName || 'Firma'} / ${targetUser.fullName} kullanıcısı için geçici şifre oluşturuldu.`
    })
  }

  const assignLicenseToUser = (targetUser: CompanyUser) => {
    if(targetUser.status === 'Silindi'){
      setFormError('Silinen kullanıcıya lisans atanamaz.')
      setFormMessage('')
      return
    }

    const activeLicense = getActiveLicenseForCompany(targetUser.companyId)
    if(!activeLicense){
      setFormError('Firmaya ait aktif lisans bulunamadı.')
      setFormMessage('')
      return
    }

    const packageItem = packageMap.get(activeLicense.packageId)
    const currentSubscription = getSubscriptionForUser(targetUser.id)
    const activeSubscriptionCount = subscriptions.filter(subscription => {
      if(subscription.userId === targetUser.id) return false
      if(subscription.companyLicenseId !== activeLicense.id) return false
      return getRuntimeSubscriptionStatus(subscription) === 'Aktif'
    }).length

    if(packageItem && packageItem.maxUsers > 0 && activeSubscriptionCount >= packageItem.maxUsers){
      setFormError('Paketinizde tanımlı maksimum kullanıcı sayısına ulaştınız.')
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const assignedAt = todayKey()
    const nextSubscription: UserSubscription = {
      id: currentSubscription?.id || createId('user_subscription'),
      userId: targetUser.id,
      companyLicenseId: activeLicense.id,
      status: 'Aktif',
      assignedAt,
      expiresAt: getLicenseDeadline(activeLicense),
      createdAt: currentSubscription?.createdAt || now,
      updatedAt: now
    }

    setSubscriptions(prev => currentSubscription
      ? prev.map(subscription => subscription.id === currentSubscription.id ? nextSubscription : subscription)
      : [nextSubscription, ...prev]
    )
    setSelectedUserId(targetUser.id)
    setFormError('')
    setFormMessage(`${targetUser.fullName} kullanıcısına ${packageItem?.name || 'lisans'} atandı.`)
    addActionLog({
      operationType: 'Lisans kullanıcıya atandı',
      user: currentUser,
      description: `${companyMap.get(targetUser.companyId)?.companyName || 'Firma'} / ${targetUser.fullName} kullanıcısına ${packageItem?.name || 'lisans'} atandı.`
    })
  }

  return (
    <div className="user-subscription-page">
      <div className="page-title">
        <div>
          <h2>Kullanıcı ve Abonelik Yönetimi</h2>
          <p className="muted">Firma kullanıcılarını ve abonelik durumlarını yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startNewUser}>Yeni Kullanıcı</button>
      </div>

      <div className="metric-grid">
        {metrics.map(metric => (
          <div className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      {formMessage && <div className="form-success">{formMessage}</div>}
      {formError && <div className="form-error user-subscription-error">{formError}</div>}

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Kullanıcı Listesi</h3>
            <p className="muted">{formatNumber(visibleUsers.length)} kullanıcı gösteriliyor.</p>
          </div>
          <div className="toolbar-controls user-subscription-filters">
            <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value as CompanyFilter)}>
              <option value="all">Tüm firmalar</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as RoleFilter)}>
              <option value="all">Tüm roller</option>
              {companyUserRoles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as UserStatusFilter)}>
              <option value="all">Tüm durumlar</option>
              {companyUserStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={subscriptionFilter} onChange={event => setSubscriptionFilter(event.target.value as SubscriptionFilter)}>
              <option value="all">Tüm abonelikler</option>
              {subscriptionStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              <option value="none">Abonelik yok</option>
            </select>
            <input type="date" value={lastLoginFilter} onChange={event => setLastLoginFilter(event.target.value)} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Kullanıcı veya firma ara" />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table user-subscription-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Ad Soyad</th>
                <th>Kullanıcı Adı</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Son Giriş</th>
                <th>Abonelik</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 && (
                <tr><td colSpan={8} className="empty-cell">Filtrelere uygun kullanıcı bulunamadı.</td></tr>
              )}
              {visibleUsers.map(user => {
                const subscription = getSubscriptionForUser(user.id)
                const subscriptionStatus = getRuntimeSubscriptionStatus(subscription)
                const license = subscription ? licenseMap.get(subscription.companyLicenseId) : undefined
                const packageItem = license ? packageMap.get(license.packageId) : undefined
                const rowSelected = selectedUserId === user.id

                return (
                  <tr key={user.id} className={rowSelected ? 'selected-row' : ''}>
                    <td>{companyMap.get(user.companyId)?.companyName || '-'}</td>
                    <td>
                      <strong>{user.fullName}</strong>
                      <div className="muted small-text">{user.email || '-'}</div>
                    </td>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td><span className={`status-pill ${getStatusClassName(user.status)}`}>{user.status}</span></td>
                    <td>{formatDate(user.lastLogin)}</td>
                    <td>
                      <span className={`status-pill ${getSubscriptionClassName(subscriptionStatus)}`}>{subscriptionStatus || 'Yok'}</span>
                      <div className="muted small-text">{packageItem?.name || '-'}</div>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => editUser(user)}>Düzenle</button>
                      {user.status === 'Aktif'
                        ? <button className="btn" type="button" onClick={() => updateUserStatus(user, 'Pasif')}>Pasife Al</button>
                        : <button className="btn" type="button" disabled={user.status === 'Silindi'} onClick={() => updateUserStatus(user, 'Aktif')}>Aktif Et</button>}
                      <button className="btn" type="button" disabled={user.status === 'Silindi'} onClick={() => updateUserStatus(user, 'Silindi')}>Sil</button>
                      <button className="btn" type="button" disabled={user.status === 'Silindi'} onClick={() => resetPassword(user)}>Şifre Sıfırla</button>
                      <button className="btn" type="button" disabled={user.status === 'Silindi'} onClick={() => assignLicenseToUser(user)}>Lisans Ata</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="user-subscription-detail-grid">
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>{formValues.id ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Formu'}</h3>
              <p className="muted">Geçici şifre firma kullanıcısı için sistem hesabına yazılır.</p>
            </div>
          </div>

          <form className="stacked-form" onSubmit={event => {
            event.preventDefault()
            saveUser()
          }}>
            <div className="form-field">
              <label>Firma</label>
              <select value={formValues.companyId} onChange={event => updateForm('companyId', event.target.value)}>
                <option value="">Firma seçin</option>
                {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
              </select>
            </div>
            <div className="user-subscription-form-grid">
              <div className="form-field">
                <label>Ad Soyad</label>
                <input value={formValues.fullName} onChange={event => updateForm('fullName', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Kullanıcı Adı</label>
                <input value={formValues.username} onChange={event => updateForm('username', event.target.value)} />
              </div>
              <div className="form-field">
                <label>E-posta</label>
                <input value={formValues.email} onChange={event => updateForm('email', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Telefon</label>
                <input value={formValues.phone} onChange={event => updateForm('phone', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Rol</label>
                <select value={formValues.role} onChange={event => updateForm('role', event.target.value as CompanyUserRole)}>
                  {companyUserRoles.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Durum</label>
                <select value={formValues.status} onChange={event => updateForm('status', event.target.value as CompanyUserStatus)}>
                  {companyUserStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Geçici Şifre</label>
                <input value={formValues.temporaryPassword} onChange={event => updateForm('temporaryPassword', event.target.value)} />
              </div>
              <button className="btn user-subscription-password-btn" type="button" onClick={() => updateForm('temporaryPassword', generateTemporaryCompanyPassword())}>
                Geçici Şifre Oluştur
              </button>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">Kaydet</button>
              <button className="btn" type="button" onClick={startNewUser}>Yeni Kullanıcı</button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Abonelik Bilgisi</h3>
              <p className="muted">{selectedUser ? selectedUser.fullName : 'Kullanıcı seçilmedi.'}</p>
            </div>
            <span className={`status-pill ${getSubscriptionClassName(getRuntimeSubscriptionStatus(selectedSubscription))}`}>
              {getRuntimeSubscriptionStatus(selectedSubscription) || 'Yok'}
            </span>
          </div>

          <div className="financial-summary-values user-subscription-summary">
            <div>
              <span>Bağlı Paket</span>
              <strong>{selectedPackage?.name || '-'}</strong>
            </div>
            <div>
              <span>Lisans Durumu</span>
              <strong>{selectedLicense?.status || '-'}</strong>
            </div>
            <div>
              <span>Başlangıç</span>
              <strong>{formatDate(selectedSubscription?.assignedAt || '')}</strong>
            </div>
            <div>
              <span>Bitiş</span>
              <strong>{formatDate(selectedSubscription?.expiresAt || '')}</strong>
            </div>
            <div>
              <span>Kalan Gün</span>
              <strong>{selectedSubscription?.expiresAt ? `${formatNumber(Math.max(0, getDaysRemaining(selectedSubscription.expiresAt)))} gün` : '-'}</strong>
            </div>
            <div>
              <span>Lisans Anahtarı</span>
              <strong className="license-key">{selectedLicense?.licenseKey || '-'}</strong>
            </div>
          </div>

          {selectedUser && (
            <div className="form-actions">
              <button className="btn primary" type="button" disabled={selectedUser.status === 'Silindi'} onClick={() => assignLicenseToUser(selectedUser)}>
                Lisans Ata
              </button>
              <button className="btn" type="button" disabled={selectedUser.status === 'Silindi'} onClick={() => resetPassword(selectedUser)}>
                Şifre Sıfırla
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Kullanıcı Limiti</h3>
              <p className="muted">Firmaların paket limitleri ve mevcut kullanıcı sayıları.</p>
            </div>
          </div>

          <div className="user-subscription-limit-list">
            {companies.map(company => {
              const license = getActiveLicenseForCompany(company.id)
              const packageItem = license ? packageMap.get(license.packageId) : undefined
              const usage = getCompanyUsage(company.id)
              const limit = packageItem?.maxUsers || 0
              const full = limit > 0 && usage >= limit

              return (
                <div key={company.id}>
                  <span>{company.companyName}</span>
                  <strong>{formatNumber(usage)} / {limit <= 0 ? 'Sınırsız' : formatNumber(limit)}</strong>
                  <em className={`status-pill ${full ? 'warning-pill' : 'success'}`}>{full ? 'Limit dolu' : 'Uygun'}</em>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
