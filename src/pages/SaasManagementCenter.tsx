import React from 'react'
import {
  Branch,
  ApplicationStatus,
  BusinessApplication,
  BusinessRegistration,
  BusinessRegistrationStatus,
  Company,
  CompanyLicense,
  CompanySetup,
  CompanyStatus,
  CompanyUser,
  LicenseModuleKey,
  LicensePackage,
  LicenseStatus,
  PackageModule,
  PlatformModuleStatus,
  PlatformSettings,
  PlatformSupportTicket,
  PlatformSupportTicketStatus,
  Tenant,
  User,
  UserSubscription,
  UserSubscriptionStatus
} from '../types'
import {
  LICENSE_MODULE_CATALOG,
  addActionLog,
  addApplicationNote,
  approveBusinessApplication,
  completeCompanySetupFromRegistration,
  loadActionLogs,
  loadBusinessApplications,
  loadBranches,
  loadBusinessRegistrations,
  loadClosed,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanySetups,
  loadCompanyUsers,
  loadLicenseModules,
  loadLicensePackages,
  loadPlatformModules,
  loadPlatformSettings,
  loadPlatformSupportTickets,
  loadSystemUsageLogs,
  loadTenantSettings,
  loadTenants,
  loadUserSubscriptions,
  loadUsers,
  markBusinessApplicationInReview,
  rejectBusinessApplication,
  saveActionLogs,
  saveBranches,
  saveBusinessRegistrations,
  saveCompanies,
  saveCompanyLicenses,
  saveCompanySetups,
  saveCompanyUsers,
  saveLicenseModules,
  saveLicensePackages,
  savePlatformModules,
  savePlatformSettings,
  savePlatformSupportTickets,
  saveTenantSettings,
  saveTenants,
  saveUserSubscriptions,
  saveUsers
} from '../storage'
import { createTenantStorageId } from '../tenant'

export type SaasManagementView =
  | 'dashboard'
  | 'applications'
  | 'companies'
  | 'packages'
  | 'modules'
  | 'licenses'
  | 'subscriptions'
  | 'users'
  | 'support'
  | 'stats'
  | 'settings'

type Props = {
  currentUser: User
  view: SaasManagementView
}

type PackageFormValues = {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  maxUsers: number
  maxBranches: number
  maxTables: number
  maxStorageGB: number
  trialDays: number
  isActive: boolean
  modules: Record<LicenseModuleKey, boolean>
}

const companyStatuses: CompanyStatus[] = ['Aktif', 'Pasif', 'Askıda', 'Silindi']
const applicationStatuses: ApplicationStatus[] = ['Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi']
const licenseStatuses: LicenseStatus[] = ['Deneme', 'Aktif', 'Süresi Yaklaşıyor', 'Süresi Doldu', 'Askıya Alındı', 'İptal Edildi']
const subscriptionStatuses: UserSubscriptionStatus[] = ['Aktif', 'Pasif', 'Beklemede', 'Süresi Doldu']
const ticketStatuses: PlatformSupportTicketStatus[] = ['Açık', 'İnceleniyor', 'Çözüldü']

// TODO: "İnceleniyor" durumu müşteriye gösterilecek süreç bilgisidir.
// TODO: Firma durumu ileride dropdown üzerinden yönetilecek.
// TODO: Abonelik yönetimi satır içi düzenlenebilir hale getirilecek.
// TODO: Paket sistemi gelecekte Module Based License Engine'e dönüştürülecek.
// TODO: Modül fiyatları EVREN360 üzerinden yönetilebilir olacaktır.
const viewCopy: Record<SaasManagementView, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Platform sağlığını, firma durumlarını ve son hareketleri tek ekranda izleyin.'
  },
  applications: {
    title: 'Başvurular',
    description: 'Bekleyen işletme başvurularını onaylayın, reddedin veya operasyon notu ekleyin.'
  },
  companies: {
    title: 'Firmalar',
    description: 'Tenant, paket, durum, kullanıcı ve şube bilgilerini platform düzeyinde yönetin.'
  },
  packages: {
    title: 'Paketler',
    description: 'Paketleri ve paketlere bağlı modül kapsamlarını yönetin.'
  },
  modules: {
    title: 'Modüller',
    description: 'Platform genelindeki modülleri aktif veya pasif hale getirin.'
  },
  licenses: {
    title: 'Lisanslar',
    description: 'Firmaların lisans paketlerini ve lisans durumlarını manuel olarak yönetin.'
  },
  subscriptions: {
    title: 'Abonelikler',
    description: 'Ödeme sistemi olmadan, abonelik başlangıç ve bitiş süreçlerini elle takip edin.'
  },
  users: {
    title: 'Kullanıcılar',
    description: 'Platformdaki tüm kullanıcıları firma filtresiyle görüntüleyin.'
  },
  support: {
    title: 'Destek Talepleri',
    description: 'Firmalardan gelen destek taleplerinin durumlarını takip edin.'
  },
  stats: {
    title: 'İstatistikler',
    description: 'Platform geneli firma, kullanıcı, şube, sipariş ve aktif kullanıcı özetlerini görün.'
  },
  settings: {
    title: 'Sistem Ayarları',
    description: 'EVREN360 platform varsayılanlarını yönetin.'
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatMoney = (value: number) => value <= 0
  ? 'Teklif'
  : value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return formatDate(value)
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

const getDaysUntil = (value: string) => {
  if(!value) return 0
  const target = new Date(`${value}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  if(Number.isNaN(target.getTime())) return 0
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

const getStatusClassName = (status: string) => {
  if(['Aktif', 'Onaylandı', 'Çözüldü'].includes(status)) return 'success'
  if(['Pasif', 'Reddedildi', 'Silindi', 'İptal Edildi'].includes(status)) return 'muted-pill'
  if(['Askıda', 'Askıya Alındı', 'İnceleniyor', 'Süresi Yaklaşıyor', 'Beklemede', 'Deneme'].includes(status)) return 'warning-pill'
  if(['Süresi Doldu', 'Açık'].includes(status)) return 'danger-pill'
  return 'info-pill'
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const addYears = (dateKey: string, years: number) => {
  const date = new Date(`${dateKey}T12:00:00`)
  if(Number.isNaN(date.getTime())) return todayKey()
  date.setFullYear(date.getFullYear() + years)
  return date.toLocaleDateString('sv-SE')
}

const createTenantCode = (companyName: string, tenants: Tenant[]) => {
  const compact = normalizeLookup(companyName).toLocaleUpperCase('tr-TR')
  const prefix = (compact || 'TNT').slice(0, 3).padEnd(3, 'X')
  const existingCodes = new Set(tenants.map(tenant => tenant.tenantCode.toLocaleUpperCase('tr-TR')))
  let index = 1
  let code = `${prefix}${String(index).padStart(3, '0')}`

  while(existingCodes.has(code)){
    index += 1
    code = `${prefix}${String(index).padStart(3, '0')}`
  }

  return code
}

const createLicenseKey = (company: Company, packageItem: LicensePackage) => {
  const companyPart = normalizeLookup(company.companyName).slice(0, 6).toLocaleUpperCase('tr-TR').padEnd(6, 'X')
  const packagePart = normalizeLookup(packageItem.name).slice(0, 4).toLocaleUpperCase('tr-TR').padEnd(4, 'X')
  const randomPart = Math.random().toString(36).slice(2, 8).toLocaleUpperCase('tr-TR').padEnd(6, '0')
  return `EV-${companyPart}-${packagePart}-${randomPart}`
}

const findPackageForRegistration = (registration: BusinessRegistration, packages: LicensePackage[]) => {
  const requested = normalizeLookup(registration.requestedPackage)
  return packages.find(packageItem => normalizeLookup(packageItem.name) === requested)
    || packages.find(packageItem => normalizeLookup(packageItem.name) === 'baslangic')
    || packages[0]
}

const createModuleSelection = (enabledKeys: LicenseModuleKey[] = []) => {
  const enabledSet = new Set(enabledKeys)
  return LICENSE_MODULE_CATALOG.reduce((selection, module) => {
    selection[module.key] = enabledSet.has(module.key)
    return selection
  }, {} as Record<LicenseModuleKey, boolean>)
}

const createPackageForm = (packageItem?: LicensePackage, modules: PackageModule[] = []): PackageFormValues => {
  const enabledKeys = packageItem
    ? modules.filter(module => module.packageId === packageItem.id && module.enabled).map(module => module.moduleKey)
    : ['adisyon', 'qr-menu'] as LicenseModuleKey[]

  return {
    id: packageItem?.id || '',
    name: packageItem?.name || '',
    description: packageItem?.description || '',
    monthlyPrice: packageItem?.monthlyPrice || 0,
    yearlyPrice: packageItem?.yearlyPrice || 0,
    maxUsers: packageItem?.maxUsers || 0,
    maxBranches: packageItem?.maxBranches || 0,
    maxTables: packageItem?.maxTables || 0,
    maxStorageGB: packageItem?.maxStorageGB || 0,
    trialDays: packageItem?.trialDays || 14,
    isActive: packageItem?.isActive !== false,
    modules: createModuleSelection(enabledKeys)
  }
}

const getPackageLabel = (packageItem?: LicensePackage) => packageItem?.name || '-'

export default function SaasManagementCenter({ currentUser, view }: Props){
  const initialData = React.useMemo(() => ({
    applications: loadBusinessApplications(),
    registrations: loadBusinessRegistrations(),
    companies: loadCompanies(),
    setups: loadCompanySetups(),
    tenants: loadTenants(),
    packages: loadLicensePackages(),
    packageModules: loadLicenseModules(),
    licenses: loadCompanyLicenses(),
    companyUsers: loadCompanyUsers(),
    subscriptions: loadUserSubscriptions(),
    platformModules: loadPlatformModules(),
    supportTickets: loadPlatformSupportTickets(),
    platformSettings: loadPlatformSettings(),
    branches: loadBranches(),
    appUsers: loadUsers({ allTenants: true }),
    closedBills: loadClosed(),
    systemUsageLogs: loadSystemUsageLogs()
  }), [])

  const [applications, setApplications] = React.useState<BusinessApplication[]>(initialData.applications)
  const [registrations, setRegistrations] = React.useState<BusinessRegistration[]>(initialData.registrations)
  const [companies, setCompanies] = React.useState<Company[]>(initialData.companies)
  const [setups, setSetups] = React.useState<CompanySetup[]>(initialData.setups)
  const [tenants, setTenants] = React.useState<Tenant[]>(initialData.tenants)
  const [packages, setPackages] = React.useState<LicensePackage[]>(initialData.packages)
  const [packageModules, setPackageModules] = React.useState<PackageModule[]>(initialData.packageModules)
  const [licenses, setLicenses] = React.useState<CompanyLicense[]>(initialData.licenses)
  const [companyUsers, setCompanyUsers] = React.useState<CompanyUser[]>(initialData.companyUsers)
  const [subscriptions, setSubscriptions] = React.useState<UserSubscription[]>(initialData.subscriptions)
  const [platformModules, setPlatformModules] = React.useState<PlatformModuleStatus[]>(initialData.platformModules)
  const [supportTickets, setSupportTickets] = React.useState<PlatformSupportTicket[]>(initialData.supportTickets)
  const [platformSettings, setPlatformSettingsState] = React.useState<PlatformSettings>(initialData.platformSettings)
  const [branches, setBranches] = React.useState<Branch[]>(initialData.branches)
  const [appUsers, setAppUsers] = React.useState<User[]>(initialData.appUsers)
  const [companyFilter, setCompanyFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(initialData.companies[0]?.id || '')
  const [selectedPackageId, setSelectedPackageId] = React.useState(initialData.packages[0]?.id || '')
  const [selectedLicenseId, setSelectedLicenseId] = React.useState(initialData.licenses[0]?.id || '')
  const [selectedSubscriptionId, setSelectedSubscriptionId] = React.useState(initialData.subscriptions[0]?.id || '')
  const [packageForm, setPackageForm] = React.useState<PackageFormValues>(() => createPackageForm(initialData.packages[0], initialData.packageModules))
  const [formMessage, setFormMessage] = React.useState('')
  const [formError, setFormError] = React.useState('')

  React.useEffect(() => {
    setCompanyFilter('all')
    setStatusFilter('all')
    setFormMessage('')
    setFormError('')
  }, [view])

  const companyMap = React.useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])
  const tenantMapByCompany = React.useMemo(() => new Map(tenants.map(tenant => [tenant.companyId, tenant])), [tenants])
  const packageMap = React.useMemo(() => new Map(packages.map(packageItem => [packageItem.id, packageItem])), [packages])
  const licenseMap = React.useMemo(() => new Map(licenses.map(license => [license.id, license])), [licenses])
  const companyUserMap = React.useMemo(() => new Map(companyUsers.map(user => [user.id, user])), [companyUsers])
  const activeCompanies = companies.filter(company => company.status !== 'Silindi')
  const selectedCompany = companies.find(company => company.id === selectedCompanyId)
  const selectedPackage = packages.find(packageItem => packageItem.id === selectedPackageId)
  const selectedLicense = licenses.find(license => license.id === selectedLicenseId)
  const selectedSubscription = subscriptions.find(subscription => subscription.id === selectedSubscriptionId)
  const today = todayKey()

  const logPlatformAction = (operationType: Parameters<typeof addActionLog>[0]['operationType'], description: string, tableId?: string, tableName?: string, tenantId?: string) => {
    addActionLog({ operationType, user: currentUser, tenantId, tableId, tableName, description })
  }

  const refreshSaasData = () => {
    const nextApplications = loadBusinessApplications()
    const nextRegistrations = loadBusinessRegistrations()
    const nextCompanies = loadCompanies()
    const nextSetups = loadCompanySetups()
    const nextTenants = loadTenants()
    const nextLicenses = loadCompanyLicenses()
    const nextCompanyUsers = loadCompanyUsers()
    const nextSubscriptions = loadUserSubscriptions()
    const nextBranches = loadBranches()
    const nextAppUsers = loadUsers({ allTenants: true })

    setApplications(nextApplications)
    setRegistrations(nextRegistrations)
    setCompanies(nextCompanies)
    setSetups(nextSetups)
    setTenants(nextTenants)
    setLicenses(nextLicenses)
    setCompanyUsers(nextCompanyUsers)
    setSubscriptions(nextSubscriptions)
    setBranches(nextBranches)
    setAppUsers(nextAppUsers)

    return {
      applications: nextApplications,
      registrations: nextRegistrations,
      companies: nextCompanies,
      setups: nextSetups,
      tenants: nextTenants,
      licenses: nextLicenses,
      companyUsers: nextCompanyUsers,
      subscriptions: nextSubscriptions,
      branches: nextBranches,
      appUsers: nextAppUsers
    }
  }

  const ensureTenantForCompany = (company: Company, now: string) => {
    const latestTenants = loadTenants()
    const existingTenant = latestTenants.find(tenant => tenant.companyId === company.id)

    if(existingTenant){
      saveTenantSettings(loadTenantSettings())
      return existingTenant
    }

    const tenant: Tenant = {
      id: createTenantStorageId('tenant'),
      tenantCode: createTenantCode(company.companyName, latestTenants),
      companyId: company.id,
      companyName: company.companyName,
      status: 'Aktif',
      createdAt: now,
      updatedAt: now
    }

    saveTenants([tenant, ...latestTenants])
    saveTenantSettings(loadTenantSettings())
    logPlatformAction('Tenant oluşturuldu', `${company.companyName} için ${tenant.tenantCode} tenant oluşturuldu.`, tenant.id, company.companyName, tenant.id)
    return tenant
  }

  const attachTenantToCompanyRecords = (company: Company, setup: CompanySetup, tenant: Tenant, now: string) => {
    saveCompanies(loadCompanies().map(item => item.id === company.id
      ? { ...item, tenantId: tenant.id, updatedAt: now }
      : item))
    saveBranches(loadBranches().map(branch => (
      branch.companyId === company.id || branch.id === setup.branchId
        ? { ...branch, companyId: branch.companyId || company.id, tenantId: tenant.id, updatedAt: now }
        : branch
    )))
    saveUsers(loadUsers({ allTenants: true }).map(user => (
      user.companyId === company.id || user.id === setup.adminUserId
        ? { ...user, companyId: user.companyId || company.id, tenantId: tenant.id }
        : user
    )))
    saveCompanySetups(loadCompanySetups().map(item => item.companyId === company.id
      ? { ...item, tenantId: tenant.id, updatedAt: now }
      : item))
  }

  const moveLifecycleLogsToTenant = (company: Company, tenant: Tenant) => {
    const lifecycleOperations = new Set([
      'Firma oluşturuldu',
      'Şube oluşturuldu',
      'Admin kullanıcı oluşturuldu',
      'Kurulum tamamlandı'
    ])
    let changed = false
    const nextLogs = loadActionLogs().map(log => {
      const belongsToCompanyLifecycle = lifecycleOperations.has(log.operationType)
        && log.description.includes(company.companyName)

      if(!belongsToCompanyLifecycle || log.tenantId === tenant.id) return log
      changed = true
      return { ...log, tenantId: tenant.id }
    })

    if(changed) saveActionLogs(nextLogs)
  }

  const ensureCompanyUserForLifecycle = (
    company: Company,
    setup: CompanySetup,
    tenant: Tenant,
    registration: BusinessRegistration,
    now: string
  ) => {
    const latestUsers = loadUsers({ allTenants: true })
    const adminUser = latestUsers.find(user => user.id === setup.adminUserId)
    const latestCompanyUsers = loadCompanyUsers()
    const existingCompanyUser = latestCompanyUsers.find(user => (
      user.companyId === company.id
      && (
        user.username === adminUser?.username
        || user.email === registration.email
        || user.id === `company_user_${setup.adminUserId}`
      )
    ))

    const companyUser: CompanyUser = existingCompanyUser
      ? {
          ...existingCompanyUser,
          tenantId: tenant.id,
          companyId: company.id,
          fullName: existingCompanyUser.fullName || adminUser?.fullName || registration.ownerName,
          username: existingCompanyUser.username || adminUser?.username || normalizeLookup(registration.businessName),
          email: existingCompanyUser.email || registration.email,
          phone: existingCompanyUser.phone || registration.phone,
          updatedAt: now
        }
      : {
          id: `company_user_${setup.adminUserId}`,
          tenantId: tenant.id,
          companyId: company.id,
          fullName: adminUser?.fullName || registration.ownerName,
          username: adminUser?.username || normalizeLookup(registration.businessName),
          email: registration.email,
          phone: registration.phone,
          role: 'Firma Sahibi',
          status: 'Aktif',
          lastLogin: '',
          createdAt: now,
          updatedAt: now
        }

    const nextCompanyUsers = existingCompanyUser
      ? latestCompanyUsers.map(user => user.id === companyUser.id ? companyUser : user)
      : [companyUser, ...latestCompanyUsers]

    saveCompanyUsers(nextCompanyUsers)
    return companyUser
  }

  const ensureCompanyLicenseForLifecycle = (
    company: Company,
    tenant: Tenant,
    registration: BusinessRegistration,
    packageItem: LicensePackage,
    now: string
  ) => {
    const latestLicenses = loadCompanyLicenses()
    const existingLicense = latestLicenses.find(license => license.companyId === company.id && license.status !== 'İptal Edildi')
    const startDate = todayKey()
    const endDate = addYears(startDate, 1)
    const license: CompanyLicense = existingLicense
      ? { ...existingLicense, tenantId: tenant.id, updatedAt: now }
      : {
          id: createId('company_license'),
          tenantId: tenant.id,
          companyId: company.id,
          packageId: packageItem.id,
          licenseKey: createLicenseKey(company, packageItem),
          status: 'Aktif',
          startDate,
          endDate,
          isTrial: false,
          trialEndDate: '',
          lastRenewalDate: startDate,
          nextRenewalDate: endDate,
          createdAt: now,
          updatedAt: now
        }

    const nextLicenses = existingLicense
      ? latestLicenses.map(item => item.id === license.id ? license : item)
      : [license, ...latestLicenses]

    saveCompanyLicenses(nextLicenses)
    if(!existingLicense){
      logPlatformAction('Lisans atandı', `${company.companyName} için ${packageItem.name} lisansı atandı.`, license.id, company.companyName, tenant.id)
    }
    return license
  }

  const ensureSubscriptionForLifecycle = (
    companyUser: CompanyUser,
    license: CompanyLicense,
    tenant: Tenant,
    company: Company,
    now: string
  ) => {
    const latestSubscriptions = loadUserSubscriptions()
    const existingSubscription = latestSubscriptions.find(subscription => (
      subscription.userId === companyUser.id
      && subscription.companyLicenseId === license.id
    ))
    const subscription: UserSubscription = existingSubscription
      ? { ...existingSubscription, tenantId: tenant.id, updatedAt: now }
      : {
          id: createId('user_subscription'),
          tenantId: tenant.id,
          userId: companyUser.id,
          companyLicenseId: license.id,
          status: 'Aktif',
          assignedAt: license.startDate,
          expiresAt: license.isTrial ? license.trialEndDate || license.endDate : license.endDate,
          createdAt: now,
          updatedAt: now
        }

    const nextSubscriptions = existingSubscription
      ? latestSubscriptions.map(item => item.id === subscription.id ? subscription : item)
      : [subscription, ...latestSubscriptions]

    saveUserSubscriptions(nextSubscriptions)
    if(!existingSubscription){
      logPlatformAction('Lisans kullanıcıya atandı', `${company.companyName} firma sahibi aboneliği oluşturuldu.`, subscription.id, companyUser.fullName, tenant.id)
    }
    return subscription
  }

  const completeRegistrationLifecycle = (registration: BusinessRegistration) => {
    try {
      setFormError('')
      const now = new Date().toISOString()
      const nextRegistrations = registrations.map(item => item.id === registration.id
        ? {
            ...item,
            status: 'Onaylandı' as BusinessRegistrationStatus,
            approvedBy: currentUser.fullName || currentUser.username,
            approvedAt: item.approvedAt || now,
            updatedAt: now
          }
        : item)
      saveBusinessRegistrations(nextRegistrations)
      setRegistrations(nextRegistrations)

      let setup = loadCompanySetups().find(item => item.registrationId === registration.id && item.setupCompleted)
      let company = setup ? loadCompanies().find(item => item.id === setup?.companyId) : undefined

      if(!setup || !company){
        const result = completeCompanySetupFromRegistration({
          registrationId: registration.id,
          adminFullName: registration.ownerName,
          adminEmail: registration.email,
          username: registration.email.split('@')[0] || registration.businessName,
          user: currentUser
        })
        setup = result.setup
        company = result.company
      }

      const tenant = ensureTenantForCompany(company, now)
      attachTenantToCompanyRecords(company, setup, tenant, now)
      moveLifecycleLogsToTenant(company, tenant)
      const packageItem = findPackageForRegistration(registration, loadLicensePackages())
      if(!packageItem) throw new Error('Lisans paketi bulunamadı.')

      const companyUser = ensureCompanyUserForLifecycle(company, setup, tenant, registration, now)
      const license = ensureCompanyLicenseForLifecycle(company, tenant, registration, packageItem, now)
      const subscription = ensureSubscriptionForLifecycle(companyUser, license, tenant, company, now)
      refreshSaasData()
      setSelectedCompanyId(company.id)
      setSelectedLicenseId(license.id)
      setSelectedSubscriptionId(subscription.id)
      setFormMessage(`${company.companyName} için Firma → Tenant → Paket → Modül → Abonelik yaşam döngüsü tamamlandı.`)
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Başvuru yaşam döngüsü tamamlanamadı.')
    }
  }

  const getBranchCountForCompany = (companyId: string) => {
    const branchIds = new Set<string>()
    branches.forEach(branch => {
      if(branch.companyId === companyId) branchIds.add(branch.id)
    })
    setups.forEach(setup => {
      if(setup.companyId === companyId && setup.branchId) branchIds.add(setup.branchId)
    })
    return branchIds.size
  }

  const getUserCountForCompany = (companyId: string) => {
    return companyUsers.filter(user => user.companyId === companyId && user.status !== 'Silindi').length
  }

  const getLastLoginForCompany = (companyId: string) => {
    return companyUsers
      .filter(user => user.companyId === companyId && user.lastLogin)
      .map(user => user.lastLogin)
      .sort()
      .reverse()[0] || ''
  }

  const getActiveLicenseForCompany = (companyId: string) => {
    return licenses
      .filter(license => license.companyId === companyId && license.status !== 'İptal Edildi')
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0]
  }

  const dashboardStats = React.useMemo(() => {
    const nonDeletedCompanies = companies.filter(company => company.status !== 'Silindi')
    const expiringLicenses = licenses.filter(license => {
      const days = getDaysUntil(license.isTrial ? license.trialEndDate || license.endDate : license.endDate)
      return days >= 0 && days <= 30 && !['İptal Edildi', 'Askıya Alındı'].includes(license.status)
    })

    return {
      totalCompanies: nonDeletedCompanies.length,
      activeCompanies: nonDeletedCompanies.filter(company => company.status === 'Aktif').length,
      passiveCompanies: nonDeletedCompanies.filter(company => company.status === 'Pasif').length,
      suspendedCompanies: nonDeletedCompanies.filter(company => company.status === 'Askıda').length,
      totalUsers: companyUsers.filter(user => user.status !== 'Silindi').length + appUsers.filter(user => !user.companyId).length,
      activeSubscriptions: subscriptions.filter(subscription => subscription.status === 'Aktif').length,
      expiringSoon: expiringLicenses.length,
      openSupport: supportTickets.filter(ticket => ticket.status !== 'Çözüldü').length
    }
  }, [appUsers, companies, companyUsers, licenses, subscriptions, supportTickets])

  const recentApplications = [...applications]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)
  const recentCompanies = [...activeCompanies]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)

  const filteredCompanies = activeCompanies.filter(company => {
    const matchesCompany = companyFilter === 'all' || company.id === companyFilter
    const matchesStatus = statusFilter === 'all' || company.status === statusFilter
    return matchesCompany && matchesStatus
  })

  const filteredUsers = companyUsers.filter(user => (
    (companyFilter === 'all' || user.companyId === companyFilter)
    && user.status !== 'Silindi'
  ))

  const filteredTickets = supportTickets.filter(ticket => (
    (companyFilter === 'all' || ticket.companyId === companyFilter)
    && (statusFilter === 'all' || ticket.status === statusFilter)
  ))

  const filteredApplications = applications.filter(application => (
    statusFilter === 'all' || application.status === statusFilter
  ))

  const updateRegistrationStatus = (registration: BusinessRegistration, status: BusinessRegistrationStatus) => {
    if(status === 'Onaylandı'){
      completeRegistrationLifecycle(registration)
      return
    }

    const now = new Date().toISOString()
    const next = registrations.map(item => item.id === registration.id
      ? {
          ...item,
          status,
          approvedBy: status === 'Onaylandı' ? currentUser.fullName || currentUser.username : item.approvedBy,
          approvedAt: status === 'Onaylandı' ? now : item.approvedAt,
          rejectedReason: status === 'Reddedildi' ? item.rejectedReason || 'Platform yöneticisi tarafından reddedildi.' : item.rejectedReason,
          updatedAt: now
        }
      : item)
    setRegistrations(next)
    saveBusinessRegistrations(next)
    logPlatformAction(
      status === 'Onaylandı' ? 'İşletme başvurusu onaylandı' : 'İşletme başvurusu reddedildi',
      `${registration.businessName} başvurusu ${status.toLocaleLowerCase('tr-TR')}.`,
      registration.id,
      registration.businessName,
      registration.tenantId
    )
    setFormMessage(`${registration.businessName} başvurusu güncellendi.`)
  }

  const addRegistrationNote = (registration: BusinessRegistration) => {
    const note = window.prompt('Başvuru notu', registration.notes || '')
    if(note === null) return

    const now = new Date().toISOString()
    const next = registrations.map(item => item.id === registration.id
      ? { ...item, notes: note.trim(), updatedAt: now }
      : item)
    setRegistrations(next)
    saveBusinessRegistrations(next)
    logPlatformAction('EVREN360 başvuru notu eklendi', `${registration.businessName} başvurusuna not eklendi.`, registration.id, registration.businessName, registration.tenantId)
    setFormMessage('Başvuru notu kaydedildi.')
  }

  const inspectApplication = (application: BusinessApplication) => {
    try {
      setFormError('')
      setFormMessage('')
      const updated = markBusinessApplicationInReview(application.id, currentUser)
      refreshSaasData()
      setFormMessage(`${updated.companyName} başvurusu incelemeye alındı.`)
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Başvuru incelemeye alınamadı.')
    }
  }

  const approveApplication = (application: BusinessApplication) => {
    try {
      setFormError('')
      setFormMessage('')
      const result = approveBusinessApplication(application.id, '', currentUser)
      refreshSaasData()
      setSelectedCompanyId(result.company.id)
      setSelectedLicenseId(result.license.id)
      setSelectedSubscriptionId(result.subscription.id)
      setFormMessage(`${result.company.companyName} onaylandı. Tenant: ${result.tenant.tenantCode}.`)
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Başvuru onaylanamadı.')
    }
  }

  const rejectApplication = (application: BusinessApplication) => {
    const reason = window.prompt('Red sebebi')
    if(reason === null) return
    if(!reason.trim()){
      setFormError('Red sebebi zorunludur.')
      return
    }

    try {
      setFormError('')
      setFormMessage('')
      const updated = rejectBusinessApplication(application.id, reason.trim(), currentUser)
      refreshSaasData()
      setFormMessage(`${updated.companyName} başvurusu reddedildi.`)
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Başvuru reddedilemedi.')
    }
  }

  const addNoteToApplication = (application: BusinessApplication) => {
    const note = window.prompt('Başvuru notu')
    if(note === null) return
    if(!note.trim()){
      setFormError('Not zorunludur.')
      return
    }

    try {
      setFormError('')
      setFormMessage('')
      addApplicationNote(application.id, note.trim(), currentUser)
      refreshSaasData()
      setFormMessage('Başvuru notu kaydedildi.')
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Başvuru notu eklenemedi.')
    }
  }

  const updateCompanyStatus = (company: Company, status: CompanyStatus) => {
    const now = new Date().toISOString()
    const next = companies.map(item => item.id === company.id ? { ...item, status, updatedAt: now } : item)
    setCompanies(next)
    saveCompanies(next)
    const operationType = status === 'Pasif'
      ? 'EVREN360 firma pasife alındı'
      : status === 'Askıda'
        ? 'EVREN360 firma askıya alındı'
        : status === 'Silindi'
          ? 'EVREN360 firma silindi'
          : 'EVREN360 firma güncellendi'
    logPlatformAction(operationType, `${company.companyName} firma durumu ${status} olarak güncellendi.`, company.id, company.companyName, company.tenantId)
    setFormMessage(`${company.companyName} durumu ${status} oldu.`)
  }

  const saveCompanyEdit = () => {
    if(!selectedCompany) return
    const nameInput = document.querySelector<HTMLInputElement>('[data-evren360-company-name]')
    const phoneInput = document.querySelector<HTMLInputElement>('[data-evren360-company-phone]')
    const emailInput = document.querySelector<HTMLInputElement>('[data-evren360-company-email]')
    const statusInput = document.querySelector<HTMLSelectElement>('[data-evren360-company-status]')
    const companyName = nameInput?.value.trim() || selectedCompany.companyName
    const now = new Date().toISOString()
    const next = companies.map(company => company.id === selectedCompany.id
      ? {
          ...company,
          companyName,
          phone: phoneInput?.value.trim() || company.phone,
          email: emailInput?.value.trim() || company.email,
          status: (statusInput?.value || company.status) as CompanyStatus,
          updatedAt: now
        }
      : company)
    setCompanies(next)
    saveCompanies(next)
    logPlatformAction('EVREN360 firma güncellendi', `${companyName} firma bilgileri güncellendi.`, selectedCompany.id, companyName, selectedCompany.tenantId)
    setFormMessage('Firma bilgileri kaydedildi.')
  }

  const selectPackage = (packageId: string) => {
    const packageItem = packages.find(item => item.id === packageId)
    setSelectedPackageId(packageId)
    setPackageForm(createPackageForm(packageItem, packageModules))
    setFormError('')
  }

  const resetPackageForm = () => {
    setSelectedPackageId('')
    setPackageForm(createPackageForm(undefined, packageModules))
    setFormError('')
  }

  const savePackage = () => {
    const name = packageForm.name.trim()
    if(!name){
      setFormError('Paket adı zorunludur.')
      return
    }

    const now = new Date().toISOString()
    const packageId = packageForm.id || createId('license_package')
    const nextPackage: LicensePackage = {
      id: packageId,
      name,
      description: packageForm.description.trim(),
      monthlyPrice: Number(packageForm.monthlyPrice) || 0,
      yearlyPrice: Number(packageForm.yearlyPrice) || 0,
      maxUsers: Number(packageForm.maxUsers) || 0,
      maxBranches: Number(packageForm.maxBranches) || 0,
      maxTables: Number(packageForm.maxTables) || 0,
      maxStorageGB: Number(packageForm.maxStorageGB) || 0,
      trialDays: Number(packageForm.trialDays) || 0,
      isActive: packageForm.isActive,
      createdAt: packages.find(item => item.id === packageId)?.createdAt || now,
      updatedAt: now
    }
    const nextPackages = packages.some(item => item.id === packageId)
      ? packages.map(item => item.id === packageId ? nextPackage : item)
      : [nextPackage, ...packages]
    const otherModules = packageModules.filter(module => module.packageId !== packageId)
    const nextModules = LICENSE_MODULE_CATALOG.map(module => ({
      id: `license_module_${packageId}_${module.key}`,
      packageId,
      moduleKey: module.key,
      moduleName: module.name,
      enabled: packageForm.modules[module.key] === true,
      createdAt: packageModules.find(item => item.packageId === packageId && item.moduleKey === module.key)?.createdAt || now,
      updatedAt: now
    }))

    setPackages(nextPackages)
    setPackageModules([...otherModules, ...nextModules])
    setSelectedPackageId(packageId)
    saveLicensePackages(nextPackages)
    saveLicenseModules([...otherModules, ...nextModules])
    logPlatformAction(packageForm.id ? 'Paket güncellendi' : 'Paket oluşturuldu', `${name} paketi kaydedildi.`, packageId, name)
    setFormMessage(`${name} paketi kaydedildi.`)
    setFormError('')
  }

  const deletePackage = (packageItem: LicensePackage) => {
    const inUse = licenses.some(license => license.packageId === packageItem.id)
    if(inUse){
      setFormError('Bu paket aktif lisanslarda kullanıldığı için silinemez. Önce lisansları başka pakete taşıyın.')
      return
    }
    const nextPackages = packages.filter(item => item.id !== packageItem.id)
    const nextModules = packageModules.filter(module => module.packageId !== packageItem.id)
    setPackages(nextPackages)
    setPackageModules(nextModules)
    saveLicensePackages(nextPackages)
    saveLicenseModules(nextModules)
    if(selectedPackageId === packageItem.id) resetPackageForm()
    logPlatformAction('EVREN360 paket silindi', `${packageItem.name} paketi silindi.`, packageItem.id, packageItem.name)
    setFormMessage(`${packageItem.name} paketi silindi.`)
  }

  const updatePlatformModule = (moduleItem: PlatformModuleStatus) => {
    const now = new Date().toISOString()
    const next = platformModules.map(item => item.moduleKey === moduleItem.moduleKey
      ? { ...item, active: !item.active, updatedAt: now }
      : item)
    setPlatformModules(next)
    savePlatformModules(next)
    logPlatformAction('EVREN360 modül durumu güncellendi', `${moduleItem.moduleName} modülü ${moduleItem.active ? 'pasif' : 'aktif'} edildi.`, moduleItem.moduleKey, moduleItem.moduleName)
  }

  const updateLicense = () => {
    if(!selectedLicense) return
    const packageInput = document.querySelector<HTMLSelectElement>('[data-evren360-license-package]')
    const statusInput = document.querySelector<HTMLSelectElement>('[data-evren360-license-status]')
    const startInput = document.querySelector<HTMLInputElement>('[data-evren360-license-start]')
    const endInput = document.querySelector<HTMLInputElement>('[data-evren360-license-end]')
    const now = new Date().toISOString()
    const next = licenses.map(license => license.id === selectedLicense.id
      ? {
          ...license,
          packageId: packageInput?.value || license.packageId,
          status: (statusInput?.value || license.status) as LicenseStatus,
          startDate: startInput?.value || license.startDate,
          endDate: endInput?.value || license.endDate,
          nextRenewalDate: endInput?.value || license.nextRenewalDate,
          updatedAt: now
        }
      : license)
    setLicenses(next)
    saveCompanyLicenses(next)
    const company = companyMap.get(selectedLicense.companyId)
    logPlatformAction('Lisans yenilendi', `${company?.companyName || 'Firma'} lisansı güncellendi.`, selectedLicense.id, company?.companyName || selectedLicense.companyId, selectedLicense.tenantId)
    setFormMessage('Lisans güncellendi.')
  }

  const updateSubscription = () => {
    if(!selectedSubscription) return
    const statusInput = document.querySelector<HTMLSelectElement>('[data-evren360-subscription-status]')
    const expiresInput = document.querySelector<HTMLInputElement>('[data-evren360-subscription-expires]')
    const now = new Date().toISOString()
    const next = subscriptions.map(subscription => subscription.id === selectedSubscription.id
      ? {
          ...subscription,
          status: (statusInput?.value || subscription.status) as UserSubscriptionStatus,
          expiresAt: expiresInput?.value || subscription.expiresAt,
          updatedAt: now
        }
      : subscription)
    setSubscriptions(next)
    saveUserSubscriptions(next)
    logPlatformAction('EVREN360 abonelik güncellendi', 'Kullanıcı aboneliği manuel olarak güncellendi.', selectedSubscription.id, selectedSubscription.userId, selectedSubscription.tenantId)
    setFormMessage('Abonelik güncellendi.')
  }

  const updateTicketStatus = (ticket: PlatformSupportTicket, status: PlatformSupportTicketStatus) => {
    const now = new Date().toISOString()
    const next = supportTickets.map(item => item.id === ticket.id ? { ...item, status, updatedAt: now } : item)
    setSupportTickets(next)
    savePlatformSupportTickets(next)
    logPlatformAction('EVREN360 destek talebi güncellendi', `${ticket.subject} destek talebi ${status} oldu.`, ticket.id, ticket.subject, ticket.tenantId)
    setFormMessage('Destek talebi güncellendi.')
  }

  const saveSettings = () => {
    const now = new Date().toISOString()
    const next = { ...platformSettings, updatedAt: now }
    setPlatformSettingsState(next)
    savePlatformSettings(next)
    logPlatformAction('EVREN360 sistem ayarı güncellendi', 'Platform sistem ayarları güncellendi.', next.id, 'Platform Ayarları')
    setFormMessage('Sistem ayarları kaydedildi.')
  }

  const renderKpi = (label: string, value: string | number, detail: string, tone = '') => (
    <article className={`evren360-kpi ${tone}`} key={label}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
      <p>{detail}</p>
    </article>
  )

  const renderDashboard = () => (
    <>
      <section className="evren360-kpi-grid">
        {renderKpi('Toplam Firma', dashboardStats.totalCompanies, 'Silinmemiş firma sayısı')}
        {renderKpi('Aktif Firma', dashboardStats.activeCompanies, 'Operasyon erişimi açık', 'success')}
        {renderKpi('Pasif Firma', dashboardStats.passiveCompanies, 'Erişimi pasife alınmış', 'muted')}
        {renderKpi('Askıda Firma', dashboardStats.suspendedCompanies, 'İnceleme veya risk durumu', 'warning')}
        {renderKpi('Toplam Kullanıcı', dashboardStats.totalUsers, 'Firma ve platform kullanıcıları')}
        {renderKpi('Aktif Abonelik', dashboardStats.activeSubscriptions, 'Manuel yönetilen abonelikler', 'success')}
        {renderKpi('Yaklaşan Süre Bitimleri', dashboardStats.expiringSoon, '30 gün içinde biten lisanslar', 'warning')}
        {renderKpi('Açık Destek', dashboardStats.openSupport, 'Çözüm bekleyen talepler', 'danger')}
      </section>

      <section className="evren360-split-grid">
        <div className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Son Başvurular</h3>
              <p>Platforma gelen en yeni işletme başvuruları.</p>
            </div>
          </div>
          <div className="evren360-list">
            {recentApplications.map(application => (
              <div className="evren360-list-row" key={application.id}>
                <div>
                  <strong>{application.companyName}</strong>
                  <span>{application.ownerName} · {application.city}</span>
                </div>
                <span className={`status-pill ${getStatusClassName(application.status)}`}>{application.status}</span>
              </div>
            ))}
            {recentApplications.length === 0 && <p className="muted">Başvuru kaydı bulunamadı.</p>}
          </div>
        </div>
        <div className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Son Oluşturulan Firmalar</h3>
              <p>Tenant ve lisans ilişkisi kurulmuş son firmalar.</p>
            </div>
          </div>
          <div className="evren360-list">
            {recentCompanies.map(company => {
              const tenant = tenantMapByCompany.get(company.id)
              const license = getActiveLicenseForCompany(company.id)
              return (
                <div className="evren360-list-row" key={company.id}>
                  <div>
                    <strong>{company.companyName}</strong>
                    <span>{tenant?.tenantCode || 'Tenant yok'} · {getPackageLabel(packageMap.get(license?.packageId || ''))}</span>
                  </div>
                  <span className={`status-pill ${getStatusClassName(company.status)}`}>{company.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )

  const renderApplications = () => (
    <section className="evren360-panel">
      <div className="evren360-toolbar">
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Tüm durumlar</option>
            {applicationStatuses.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table evren360-table">
          <thead>
            <tr>
              <th>Firma</th>
              <th>Yetkili</th>
              <th>Telefon</th>
              <th>Paket</th>
              <th>Durum</th>
              <th>Başvuru Tarihi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map(application => (
              <tr key={application.id}>
                <td><strong>{application.companyName}</strong><span className="muted small-text">{application.email}</span></td>
                <td>{application.ownerName}</td>
                <td>{application.phone}</td>
                <td><span className="status-pill info-pill">{application.requestedPackage}</span></td>
                <td><span className={`status-pill ${getStatusClassName(application.status)}`}>{application.status}</span></td>
                <td>{formatDateTime(application.createdAt)}</td>
                <td className="actions-cell">
                  <button className="btn" type="button" onClick={() => inspectApplication(application)}>İncele</button>
                  <button className="btn" type="button" onClick={() => approveApplication(application)}>Onayla</button>
                  <button className="btn" type="button" onClick={() => rejectApplication(application)}>Reddet</button>
                  <button className="btn" type="button" onClick={() => addNoteToApplication(application)}>Not Ekle</button>
                </td>
              </tr>
            ))}
            {filteredApplications.length === 0 && (
              <tr><td className="empty-cell" colSpan={7}>Başvuru kaydı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderCompanyEditor = () => {
    if(!selectedCompany) return null
    return (
      <div className="evren360-panel evren360-editor-panel" key={selectedCompany.id}>
        <div className="evren360-panel-header">
          <div>
            <h3>Firma Düzenle</h3>
            <p>{selectedCompany.companyName} için temel platform bilgileri.</p>
          </div>
        </div>
        <div className="evren360-form-grid">
          <label>
            <span>Firma Adı</span>
            <input data-evren360-company-name defaultValue={selectedCompany.companyName} />
          </label>
          <label>
            <span>Telefon</span>
            <input data-evren360-company-phone defaultValue={selectedCompany.phone} />
          </label>
          <label>
            <span>E-posta</span>
            <input data-evren360-company-email defaultValue={selectedCompany.email} />
          </label>
          <label>
            <span>Durum</span>
            <select data-evren360-company-status defaultValue={selectedCompany.status}>
              {companyStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <div className="evren360-action-row">
          <button className="btn primary" type="button" onClick={saveCompanyEdit}>Düzenle</button>
          <button className="btn" type="button" onClick={() => updateCompanyStatus(selectedCompany, 'Pasif')}>Pasife Al</button>
          <button className="btn" type="button" onClick={() => updateCompanyStatus(selectedCompany, 'Askıda')}>Askıya Al</button>
          <button className="btn" type="button" onClick={() => updateCompanyStatus(selectedCompany, 'Silindi')}>Sil</button>
        </div>
      </div>
    )
  }

  const renderCompanies = () => (
    <>
      <section className="evren360-panel">
        <div className="evren360-toolbar">
          <label>
            <span>Firma</span>
            <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}>
              <option value="all">Tüm firmalar</option>
              {activeCompanies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
          </label>
          <label>
            <span>Durum</span>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">Tüm durumlar</option>
              {companyStatuses.filter(status => status !== 'Silindi').map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table className="data-table evren360-table">
            <thead>
              <tr>
                <th>Firma Adı</th>
                <th>Tenant</th>
                <th>Paket</th>
                <th>Durum</th>
                <th>Kuruluş Tarihi</th>
                <th>Son Giriş</th>
                <th>Şube Sayısı</th>
                <th>Kullanıcı Sayısı</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(company => {
                const tenant = tenantMapByCompany.get(company.id)
                const license = getActiveLicenseForCompany(company.id)
                const packageItem = license ? packageMap.get(license.packageId) : undefined
                return (
                  <tr key={company.id} aria-selected={company.id === selectedCompanyId}>
                    <td><strong>{company.companyName}</strong><span className="muted small-text">{company.email}</span></td>
                    <td>{tenant?.tenantCode || '-'}</td>
                    <td>{getPackageLabel(packageItem)}</td>
                    <td><span className={`status-pill ${getStatusClassName(company.status)}`}>{company.status}</span></td>
                    <td>{formatDateTime(company.createdAt)}</td>
                    <td>{formatDate(getLastLoginForCompany(company.id))}</td>
                    <td>{formatNumber(getBranchCountForCompany(company.id))}</td>
                    <td>{formatNumber(getUserCountForCompany(company.id))}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => setSelectedCompanyId(company.id)}>Görüntüle</button>
                      <button className="btn" type="button" onClick={() => setSelectedCompanyId(company.id)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => updateCompanyStatus(company, 'Pasif')}>Pasife Al</button>
                      <button className="btn" type="button" onClick={() => updateCompanyStatus(company, 'Askıda')}>Askıya Al</button>
                      <button className="btn" type="button" onClick={() => updateCompanyStatus(company, 'Silindi')}>Sil</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {renderCompanyEditor()}
    </>
  )

  const renderPackages = () => (
    <section className="evren360-detail-grid">
      <div className="evren360-panel" key={selectedLicense?.id || 'license-editor'}>
        <div className="evren360-panel-header">
          <div>
            <h3>Paket Listesi</h3>
            <p>Başlangıç, Standart, Premium ve özel paketler.</p>
          </div>
          <button className="btn primary" type="button" onClick={resetPackageForm}>Paket Oluştur</button>
        </div>
        <div className="evren360-list">
          {packages.map(packageItem => {
            const enabledCount = packageModules.filter(module => module.packageId === packageItem.id && module.enabled).length
            return (
              <button className={`evren360-select-row ${packageItem.id === selectedPackageId ? 'active' : ''}`} key={packageItem.id} type="button" onClick={() => selectPackage(packageItem.id)}>
                <div>
                  <strong>{packageItem.name}</strong>
                  <span>{formatMoney(packageItem.monthlyPrice)} / ay · {enabledCount} modül</span>
                </div>
                <span className={`status-pill ${packageItem.isActive ? 'success' : 'muted-pill'}`}>{packageItem.isActive ? 'Aktif' : 'Pasif'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="evren360-panel" key={selectedSubscription?.id || 'subscription-editor'}>
        <div className="evren360-panel-header">
          <div>
            <h3>{packageForm.id ? 'Paket Düzenle' : 'Paket Oluştur'}</h3>
            <p>Paket limitleri ve modül kapsamı.</p>
          </div>
        </div>
        <div className="evren360-form-grid">
          <label><span>Paket Adı</span><input value={packageForm.name} onChange={event => setPackageForm(current => ({ ...current, name: event.target.value }))} /></label>
          <label><span>Aylık Fiyat</span><input type="number" value={packageForm.monthlyPrice} onChange={event => setPackageForm(current => ({ ...current, monthlyPrice: Number(event.target.value) }))} /></label>
          <label><span>Yıllık Fiyat</span><input type="number" value={packageForm.yearlyPrice} onChange={event => setPackageForm(current => ({ ...current, yearlyPrice: Number(event.target.value) }))} /></label>
          <label><span>Deneme Günü</span><input type="number" value={packageForm.trialDays} onChange={event => setPackageForm(current => ({ ...current, trialDays: Number(event.target.value) }))} /></label>
          <label><span>Maks. Kullanıcı</span><input type="number" value={packageForm.maxUsers} onChange={event => setPackageForm(current => ({ ...current, maxUsers: Number(event.target.value) }))} /></label>
          <label><span>Maks. Şube</span><input type="number" value={packageForm.maxBranches} onChange={event => setPackageForm(current => ({ ...current, maxBranches: Number(event.target.value) }))} /></label>
          <label><span>Maks. Masa</span><input type="number" value={packageForm.maxTables} onChange={event => setPackageForm(current => ({ ...current, maxTables: Number(event.target.value) }))} /></label>
          <label><span>Depolama GB</span><input type="number" value={packageForm.maxStorageGB} onChange={event => setPackageForm(current => ({ ...current, maxStorageGB: Number(event.target.value) }))} /></label>
          <label className="evren360-wide-field"><span>Açıklama</span><textarea rows={3} value={packageForm.description} onChange={event => setPackageForm(current => ({ ...current, description: event.target.value }))} /></label>
          <label className="evren360-check-row"><input type="checkbox" checked={packageForm.isActive} onChange={event => setPackageForm(current => ({ ...current, isActive: event.target.checked }))} /> <span>Paket aktif</span></label>
        </div>
        <div className="evren360-module-grid">
          {LICENSE_MODULE_CATALOG.map(module => (
            <label className="evren360-check-row" key={module.key}>
              <input
                type="checkbox"
                checked={packageForm.modules[module.key] === true}
                onChange={event => setPackageForm(current => ({
                  ...current,
                  modules: { ...current.modules, [module.key]: event.target.checked }
                }))}
              />
              <span>{module.name}</span>
            </label>
          ))}
        </div>
        <div className="evren360-action-row">
          <button className="btn primary" type="button" onClick={savePackage}>{packageForm.id ? 'Paket Düzenle' : 'Paket Oluştur'}</button>
          {selectedPackage && <button className="btn" type="button" onClick={() => deletePackage(selectedPackage)}>Paket Sil</button>}
        </div>
      </div>
    </section>
  )

  const renderModules = () => (
    <section className="evren360-panel">
      <div className="evren360-module-status-grid">
        {platformModules.map(moduleItem => (
          <article className="evren360-module-card" key={moduleItem.moduleKey}>
            <div>
              <strong>{moduleItem.moduleName}</strong>
              <span>{moduleItem.moduleKey}</span>
            </div>
            <span className={`status-pill ${moduleItem.active ? 'success' : 'muted-pill'}`}>{moduleItem.active ? 'Aktif' : 'Pasif'}</span>
            <button className="btn" type="button" onClick={() => updatePlatformModule(moduleItem)}>{moduleItem.active ? 'Pasif Yap' : 'Aktif Yap'}</button>
          </article>
        ))}
      </div>
    </section>
  )

  const renderLicenses = () => (
    <section className="evren360-detail-grid">
      <div className="evren360-panel">
        <div className="table-scroll">
          <table className="data-table evren360-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Lisans</th>
                <th>Paket</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map(license => (
                <tr key={license.id} aria-selected={license.id === selectedLicenseId}>
                  <td>{companyMap.get(license.companyId)?.companyName || '-'}</td>
                  <td><strong>{license.licenseKey}</strong></td>
                  <td>{getPackageLabel(packageMap.get(license.packageId))}</td>
                  <td>{formatDate(license.startDate)}</td>
                  <td>{formatDate(license.isTrial ? license.trialEndDate || license.endDate : license.endDate)}</td>
                  <td><span className={`status-pill ${getStatusClassName(license.status)}`}>{license.status}</span></td>
                  <td className="actions-cell"><button className="btn" type="button" onClick={() => setSelectedLicenseId(license.id)}>Görüntüle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="evren360-panel">
        <div className="evren360-panel-header"><div><h3>Lisans Düzenle</h3><p>Başlangıç, Standart veya Premium kapsamına manuel geçiş yapılabilir.</p></div></div>
        {selectedLicense ? (
          <>
            <div className="evren360-form-grid">
              <label><span>Paket</span><select data-evren360-license-package defaultValue={selectedLicense.packageId}>{packages.map(packageItem => <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>)}</select></label>
              <label><span>Durum</span><select data-evren360-license-status defaultValue={selectedLicense.status}>{licenseStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
              <label><span>Başlangıç Tarihi</span><input data-evren360-license-start type="date" defaultValue={selectedLicense.startDate} /></label>
              <label><span>Bitiş Tarihi</span><input data-evren360-license-end type="date" defaultValue={selectedLicense.endDate} /></label>
            </div>
            <div className="evren360-action-row"><button className="btn primary" type="button" onClick={updateLicense}>Lisansı Kaydet</button></div>
          </>
        ) : <p className="muted">Lisans seçin.</p>}
      </div>
    </section>
  )

  const renderSubscriptions = () => (
    <section className="evren360-detail-grid">
      <div className="evren360-panel">
        <div className="table-scroll">
          <table className="data-table evren360-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Firma</th>
                <th>Başlangıç Tarihi</th>
                <th>Bitiş Tarihi</th>
                <th>Durumu</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(subscription => {
                const user = companyUserMap.get(subscription.userId)
                const license = licenseMap.get(subscription.companyLicenseId)
                const company = license ? companyMap.get(license.companyId) : undefined
                return (
                  <tr key={subscription.id} aria-selected={subscription.id === selectedSubscriptionId}>
                    <td><strong>{user?.fullName || subscription.userId}</strong><span className="muted small-text">{user?.role || '-'}</span></td>
                    <td>{company?.companyName || '-'}</td>
                    <td>{formatDate(subscription.assignedAt)}</td>
                    <td>{formatDate(subscription.expiresAt)}</td>
                    <td><span className={`status-pill ${getStatusClassName(subscription.status)}`}>{subscription.status}</span></td>
                    <td className="actions-cell"><button className="btn" type="button" onClick={() => setSelectedSubscriptionId(subscription.id)}>Görüntüle</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="evren360-panel">
        <div className="evren360-panel-header"><div><h3>Abonelik Düzenle</h3><p>Ödeme altyapısı yok; durum manuel yönetilir.</p></div></div>
        {selectedSubscription ? (
          <>
            <div className="evren360-form-grid">
              <label><span>Durum</span><select data-evren360-subscription-status defaultValue={selectedSubscription.status}>{subscriptionStatuses.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
              <label><span>Bitiş Tarihi</span><input data-evren360-subscription-expires type="date" defaultValue={selectedSubscription.expiresAt} /></label>
            </div>
            <div className="evren360-action-row"><button className="btn primary" type="button" onClick={updateSubscription}>Aboneliği Kaydet</button></div>
          </>
        ) : <p className="muted">Abonelik seçin.</p>}
      </div>
    </section>
  )

  const renderUsers = () => (
    <section className="evren360-panel">
      <div className="evren360-toolbar">
        <label>
          <span>Firma</span>
          <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}>
            <option value="all">Tüm firmalar</option>
            {activeCompanies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table evren360-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Firma</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Son Giriş</th>
              <th>Oluşturulma</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td><strong>{user.fullName}</strong><span className="muted small-text">{user.email}</span></td>
                <td>{companyMap.get(user.companyId)?.companyName || '-'}</td>
                <td>{user.role}</td>
                <td><span className={`status-pill ${getStatusClassName(user.status)}`}>{user.status}</span></td>
                <td>{formatDate(user.lastLogin)}</td>
                <td>{formatDateTime(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderSupport = () => (
    <section className="evren360-panel">
      <div className="evren360-toolbar">
        <label>
          <span>Firma</span>
          <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}>
            <option value="all">Tüm firmalar</option>
            {activeCompanies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">Tüm durumlar</option>
            {ticketStatuses.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <div className="evren360-support-grid">
        {filteredTickets.map(ticket => (
          <article className="evren360-ticket" key={ticket.id}>
            <div>
              <strong>{ticket.subject}</strong>
              <span>{companyMap.get(ticket.companyId)?.companyName || '-'} · {formatDateTime(ticket.createdAt)}</span>
            </div>
            <p>{ticket.message}</p>
            <div className="evren360-ticket-footer">
              <span className={`status-pill ${getStatusClassName(ticket.status)}`}>{ticket.status}</span>
              <span className="status-pill info-pill">{ticket.priority}</span>
              <button className="btn" type="button" onClick={() => updateTicketStatus(ticket, 'İnceleniyor')}>İnceleniyor</button>
              <button className="btn" type="button" onClick={() => updateTicketStatus(ticket, 'Çözüldü')}>Çözüldü</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderStats = () => {
    const activeLogUsers = new Set(initialData.systemUsageLogs.filter(log => log.date === today).map(log => log.userId).filter(Boolean))
    const stats = [
      ['Toplam Firma', activeCompanies.length, 'Silinmemiş firma'],
      ['Toplam Kullanıcı', dashboardStats.totalUsers, 'Firma ve platform kullanıcıları'],
      ['Toplam Şube', branches.length, 'Kayıtlı şube'],
      ['Toplam Sipariş', initialData.closedBills.length, 'Kapanmış adisyon'],
      ['Günlük Aktif Kullanıcı', activeLogUsers.size, 'Bugünkü işlem loglarından']
    ] as const
    return (
      <section className="evren360-kpi-grid evren360-stats-grid">
        {stats.map(item => renderKpi(item[0], item[1], item[2], item[0] === 'Günlük Aktif Kullanıcı' ? 'success' : ''))}
        {renderKpi('Aktif Modül', platformModules.filter(module => module.active).length, 'Platform genelinde aktif', 'success')}
        {renderKpi('Çözülen Destek', supportTickets.filter(ticket => ticket.status === 'Çözüldü').length, 'Kapanmış destek talebi')}
        {renderKpi('Bugünkü Başvuru', applications.filter(application => getDateKey(application.createdAt) === today).length, 'Bugün gelen başvurular')}
      </section>
    )
  }

  const renderSettings = () => (
    <section className="evren360-panel evren360-settings-panel">
      <div className="evren360-form-grid">
        <label>
          <span>Varsayılan Para Birimi</span>
          <input value={platformSettings.defaultCurrency} onChange={event => setPlatformSettingsState(current => ({ ...current, defaultCurrency: event.target.value }))} />
        </label>
        <label>
          <span>Varsayılan Dil</span>
          <input value={platformSettings.defaultLanguage} onChange={event => setPlatformSettingsState(current => ({ ...current, defaultLanguage: event.target.value }))} />
        </label>
        <label>
          <span>Varsayılan Tema</span>
          <input value={platformSettings.defaultTheme} onChange={event => setPlatformSettingsState(current => ({ ...current, defaultTheme: event.target.value }))} />
        </label>
        <label className="evren360-check-row">
          <input type="checkbox" checked={platformSettings.maintenanceMode} onChange={event => setPlatformSettingsState(current => ({ ...current, maintenanceMode: event.target.checked }))} />
          <span>Sistem Bakım Modu</span>
        </label>
      </div>
      <div className="evren360-action-row">
        <button className="btn primary" type="button" onClick={saveSettings}>Sistem Ayarlarını Kaydet</button>
      </div>
    </section>
  )

  const renderContent = () => {
    if(view === 'dashboard') return renderDashboard()
    if(view === 'applications') return renderApplications()
    if(view === 'companies') return renderCompanies()
    if(view === 'packages') return renderPackages()
    if(view === 'modules') return renderModules()
    if(view === 'licenses') return renderLicenses()
    if(view === 'subscriptions') return renderSubscriptions()
    if(view === 'users') return renderUsers()
    if(view === 'support') return renderSupport()
    if(view === 'stats') return renderStats()
    return renderSettings()
  }

  const copy = viewCopy[view]

  return (
    <div className="evren360-page">
      <section className="evren360-hero">
        <div>
          <span>EVREN360 Yönetici Paneli</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>Super Admin</strong>
          <span>{currentUser.fullName || currentUser.username}</span>
        </div>
      </section>

      {(formMessage || formError) && (
        <div className={`evren360-feedback ${formError ? 'error' : ''}`}>
          {formError || formMessage}
        </div>
      )}

      {renderContent()}
    </div>
  )
}
