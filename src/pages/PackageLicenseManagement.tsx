import React from 'react'
import {
  Company,
  CompanyLicense,
  LicenseModuleKey,
  LicensePackage,
  LicenseStatus,
  PackageModule,
  User
} from '../types'
import {
  LICENSE_MODULE_CATALOG,
  addActionLog,
  getCompanyLicenseRuntimeStatus,
  getCompanyLicenseUsage,
  loadCompanies,
  loadCompanyLicenses,
  loadLicenseModules,
  loadLicensePackages,
  saveCompanyLicenses,
  saveLicenseModules,
  saveLicensePackages
} from '../storage'

type Props = {
  currentUser: User
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

type LicenseFormValues = {
  companyId: string
  packageId: string
  startDate: string
  endDate: string
  isTrial: boolean
  trialEndDate: string
}

type LicenseFilter = LicenseStatus | 'all'
type TrialFilter = 'all' | 'trial' | 'paid'

const defaultPackageNames = ['Ücretsiz', 'Başlangıç', 'Pro', 'Premium', 'Kurumsal']
const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`)
  if(Number.isNaN(date.getTime())) return todayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addYears = (dateKey: string, years: number) => {
  const date = new Date(`${dateKey}T12:00:00`)
  if(Number.isNaN(date.getTime())) return todayKey()
  date.setFullYear(date.getFullYear() + years)
  return date.toLocaleDateString('sv-SE')
}

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

const formatMoney = (value: number) => {
  if(value <= 0) return 'Teklif'
  return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
}

const formatLimit = (value: number, unit = '') => {
  if(value <= 0) return 'Sınırsız'
  return `${formatNumber(value)}${unit ? ` ${unit}` : ''}`
}

const getLicenseDeadline = (license: CompanyLicense) => {
  return license.isTrial ? license.trialEndDate || license.endDate : license.endDate
}

const generateLicenseKey = (companyId: string, packageId: string) => {
  const companyPart = (companyId || 'company').replace(/[^a-z0-9]/gi, '').slice(-6).toLocaleUpperCase('tr-TR') || 'COMP'
  const packagePart = (packageId || 'package').replace(/[^a-z0-9]/gi, '').slice(-4).toLocaleUpperCase('tr-TR') || 'PKG'
  const randomPart = Math.random().toString(36).slice(2, 8).toLocaleUpperCase('tr-TR').padEnd(6, '0')
  return `RA-${companyPart}-${packagePart}-${randomPart}`
}

const createModuleSelection = (enabledKeys: LicenseModuleKey[] = []) => {
  const enabledSet = new Set(enabledKeys)
  return LICENSE_MODULE_CATALOG.reduce((selection, module) => {
    selection[module.key] = enabledSet.has(module.key)
    return selection
  }, {} as Record<LicenseModuleKey, boolean>)
}

const createPackageFormValues = (
  packageItem?: LicensePackage,
  modules: PackageModule[] = []
): PackageFormValues => {
  if(!packageItem){
    return {
      id: '',
      name: '',
      description: '',
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxUsers: 0,
      maxBranches: 0,
      maxTables: 0,
      maxStorageGB: 0,
      trialDays: 14,
      isActive: true,
      modules: createModuleSelection()
    }
  }

  return {
    id: packageItem.id,
    name: packageItem.name,
    description: packageItem.description,
    monthlyPrice: packageItem.monthlyPrice,
    yearlyPrice: packageItem.yearlyPrice,
    maxUsers: packageItem.maxUsers,
    maxBranches: packageItem.maxBranches,
    maxTables: packageItem.maxTables,
    maxStorageGB: packageItem.maxStorageGB,
    trialDays: packageItem.trialDays,
    isActive: packageItem.isActive,
    modules: createModuleSelection(
      modules
        .filter(module => module.packageId === packageItem.id && module.enabled)
        .map(module => module.moduleKey)
    )
  }
}

const createLicenseFormValues = (
  companies: Company[],
  packages: LicensePackage[],
  baseDate = todayKey()
): LicenseFormValues => {
  const packageItem = packages.find(item => item.isActive) || packages[0]
  const trialDays = packageItem?.trialDays || 14

  return {
    companyId: companies[0]?.id || '',
    packageId: packageItem?.id || '',
    startDate: baseDate,
    endDate: addYears(baseDate, 1),
    isTrial: true,
    trialEndDate: addDays(baseDate, trialDays)
  }
}

const getStatusClassName = (status: LicenseStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Deneme') return 'info-pill'
  if(status === 'Süresi Yaklaşıyor') return 'warning-pill'
  if(status === 'Süresi Doldu') return 'danger-pill'
  if(status === 'Askıya Alındı') return 'warning-pill'
  return 'muted-pill'
}

const normalizeSearch = (value: string) => value.toLocaleLowerCase('tr-TR')

const createLicenseWarnings = (
  licenses: CompanyLicense[],
  companies: Map<string, Company>,
  packages: Map<string, LicensePackage>
) => {
  return licenses.flatMap(license => {
    if(license.status === 'Askıya Alındı' || license.status === 'İptal Edildi') return []

    const deadline = getLicenseDeadline(license)
    if(!deadline) return []

    const daysRemaining = getDaysRemaining(deadline)
    const threshold = daysRemaining < 0 || license.status === 'Süresi Doldu'
      ? 'Süresi doldu'
      : daysRemaining <= 1
        ? '1 gün'
        : daysRemaining <= 7
          ? '7 gün'
          : daysRemaining <= 30
            ? '30 gün'
            : ''

    if(!threshold) return []

    const company = companies.get(license.companyId)
    const packageItem = packages.get(license.packageId)
    const message = threshold === 'Süresi doldu'
      ? `${company?.companyName || 'Firma'} lisansının süresi doldu.`
      : `${company?.companyName || 'Firma'} lisansı ${threshold} eşiğinde yenileme bekliyor.`

    return [{
      id: `license_warning_${license.id}_${threshold.replace(/\s+/g, '_')}`,
      licenseId: license.id,
      companyId: license.companyId,
      companyName: company?.companyName || '-',
      packageName: packageItem?.name || '-',
      threshold,
      daysRemaining,
      message
    }]
  })
}

export default function PackageLicenseManagement({ currentUser }: Props){
  const initialLicenseData = React.useMemo(() => {
    const packages = loadLicensePackages()
    return {
      packages,
      modules: loadLicenseModules(),
      companies: loadCompanies(),
      licenses: loadCompanyLicenses()
    }
  }, [])

  const [packages, setPackages] = React.useState<LicensePackage[]>(initialLicenseData.packages)
  const [packageModules, setPackageModules] = React.useState<PackageModule[]>(initialLicenseData.modules)
  const [companies] = React.useState<Company[]>(initialLicenseData.companies)
  const [licenses, setLicenses] = React.useState<CompanyLicense[]>(initialLicenseData.licenses)
  const [selectedPackageId, setSelectedPackageId] = React.useState(initialLicenseData.packages[0]?.id || '')
  const [selectedLicenseId, setSelectedLicenseId] = React.useState(initialLicenseData.licenses[0]?.id || '')
  const [packageForm, setPackageForm] = React.useState<PackageFormValues>(() => createPackageFormValues(initialLicenseData.packages[0], initialLicenseData.modules))
  const [licenseForm, setLicenseForm] = React.useState<LicenseFormValues>(() => createLicenseFormValues(initialLicenseData.companies, initialLicenseData.packages))
  const [packageFilter, setPackageFilter] = React.useState('all')
  const [licenseStatusFilter, setLicenseStatusFilter] = React.useState<LicenseFilter>('all')
  const [trialFilter, setTrialFilter] = React.useState<TrialFilter>('all')
  const [companyFilter, setCompanyFilter] = React.useState('all')
  const [companySearch, setCompanySearch] = React.useState('')
  const [dateStartFilter, setDateStartFilter] = React.useState('')
  const [dateEndFilter, setDateEndFilter] = React.useState('')
  const [accessCompanyId, setAccessCompanyId] = React.useState(initialLicenseData.companies[0]?.id || '')
  const [formError, setFormError] = React.useState('')
  const [formMessage, setFormMessage] = React.useState('')

  React.useEffect(() => {
    saveLicensePackages(packages)
  }, [packages])

  React.useEffect(() => {
    saveLicenseModules(packageModules)
  }, [packageModules])

  React.useEffect(() => {
    saveCompanyLicenses(licenses)
  }, [licenses])

  const packageMap = React.useMemo(() => new Map(packages.map(packageItem => [packageItem.id, packageItem])), [packages])
  const companyMap = React.useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])

  const licensesWithRuntimeStatus = React.useMemo(() => {
    return licenses.map(license => ({
      ...license,
      status: getCompanyLicenseRuntimeStatus(license)
    }))
  }, [licenses])
  const licenseWarnings = React.useMemo(
    () => createLicenseWarnings(licensesWithRuntimeStatus, companyMap, packageMap),
    [companyMap, licensesWithRuntimeStatus, packageMap]
  )

  const moduleCountMap = React.useMemo(() => {
    return packageModules.reduce((map, module) => {
      if(module.enabled) map.set(module.packageId, (map.get(module.packageId) || 0) + 1)
      return map
    }, new Map<string, number>())
  }, [packageModules])

  const selectedPackage = selectedPackageId ? packageMap.get(selectedPackageId) : undefined
  const selectedLicense = selectedLicenseId ? licensesWithRuntimeStatus.find(license => license.id === selectedLicenseId) : undefined

  const visibleLicenses = React.useMemo(() => {
    const query = normalizeSearch(companySearch.trim())

    return [...licensesWithRuntimeStatus]
      .sort((first, second) => second.startDate.localeCompare(first.startDate))
      .filter(license => {
        const company = companyMap.get(license.companyId)
        const deadline = getLicenseDeadline(license)
        const matchesPackage = packageFilter === 'all' || license.packageId === packageFilter
        const matchesStatus = licenseStatusFilter === 'all' || license.status === licenseStatusFilter
        const matchesTrial = trialFilter === 'all' || (trialFilter === 'trial' ? license.isTrial : !license.isTrial)
        const matchesCompany = companyFilter === 'all' || license.companyId === companyFilter
        const matchesSearch = !query || normalizeSearch(company?.companyName || '').includes(query)
        const matchesStart = !dateStartFilter || license.startDate >= dateStartFilter
        const matchesEnd = !dateEndFilter || deadline <= dateEndFilter
        return matchesPackage && matchesStatus && matchesTrial && matchesCompany && matchesSearch && matchesStart && matchesEnd
      })
  }, [companyFilter, companyMap, companySearch, dateEndFilter, dateStartFilter, licensesWithRuntimeStatus, licenseStatusFilter, packageFilter, trialFilter])

  const activeLicenseCount = licensesWithRuntimeStatus.filter(license => license.status === 'Aktif' || license.status === 'Süresi Yaklaşıyor').length
  const trialLicenseCount = licensesWithRuntimeStatus.filter(license => license.status === 'Deneme').length
  const expiredLicenseCount = licensesWithRuntimeStatus.filter(license => license.status === 'Süresi Doldu').length
  const activeCompanyCount = companies.filter(company => company.status === 'Aktif').length
  const totalMonthlyRevenue = licensesWithRuntimeStatus
    .filter(license => (license.status === 'Aktif' || license.status === 'Süresi Yaklaşıyor') && !license.isTrial)
    .reduce((total, license) => total + (packageMap.get(license.packageId)?.monthlyPrice || 0), 0)
  const totalYearlyRevenue = licensesWithRuntimeStatus
    .filter(license => (license.status === 'Aktif' || license.status === 'Süresi Yaklaşıyor') && !license.isTrial)
    .reduce((total, license) => total + (packageMap.get(license.packageId)?.yearlyPrice || 0), 0)
  const renewalDueCount = licenseWarnings.filter(warning => warning.threshold !== 'Süresi doldu').length

  const activeAccessLicense = React.useMemo(() => {
    return licensesWithRuntimeStatus
      .filter(license => license.companyId === accessCompanyId && (
        license.status === 'Aktif'
        || license.status === 'Deneme'
        || license.status === 'Süresi Yaklaşıyor'
      ))
      .sort((first, second) => second.startDate.localeCompare(first.startDate))[0]
  }, [accessCompanyId, licensesWithRuntimeStatus])

  const selectedAccessPackage = activeAccessLicense ? packageMap.get(activeAccessLicense.packageId) : undefined
  const selectedAccessModules = React.useMemo(() => {
    if(!activeAccessLicense) return []
    return LICENSE_MODULE_CATALOG.map(module => {
      const moduleMatch = packageModules.find(item => (
        item.packageId === activeAccessLicense.packageId
        && item.moduleKey === module.key
      ))

      return {
        ...module,
        enabled: moduleMatch?.enabled === true
      }
    })
  }, [activeAccessLicense, packageModules])
  const selectedAccessUsage = accessCompanyId ? getCompanyLicenseUsage(accessCompanyId) : { users: 0, branches: 0, tables: 0 }

  const defaultPackageCards = React.useMemo(() => {
    return defaultPackageNames
      .map(name => packages.find(packageItem => packageItem.name === name))
      .filter(Boolean) as LicensePackage[]
  }, [packages])

  const selectPackage = (packageItem: LicensePackage | null) => {
    setSelectedPackageId(packageItem?.id || '')
    setPackageForm(createPackageFormValues(packageItem || undefined, packageModules))
    setFormError('')
    setFormMessage('')
  }

  const startNewPackage = () => {
    setSelectedPackageId('')
    setPackageForm(createPackageFormValues())
    setFormError('')
    setFormMessage('Yeni paket bilgilerini girin.')
  }

  const updatePackageForm = <K extends keyof PackageFormValues>(key: K, value: PackageFormValues[K]) => {
    setPackageForm(prev => ({ ...prev, [key]: value }))
  }

  const updatePackageModule = (moduleKey: LicenseModuleKey, enabled: boolean) => {
    setPackageForm(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [moduleKey]: enabled
      }
    }))
  }

  const savePackage = () => {
    const packageName = packageForm.name.trim()
    if(!packageName){
      setFormError('Paket adı zorunludur.')
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const isEditing = Boolean(packageForm.id && packageMap.has(packageForm.id))
    const packageId = isEditing ? packageForm.id : createId('license_package')
    const existingPackage = isEditing ? packageMap.get(packageId) : undefined
    const savedPackage: LicensePackage = {
      id: packageId,
      name: packageName,
      description: packageForm.description.trim(),
      monthlyPrice: Math.max(0, Number(packageForm.monthlyPrice) || 0),
      yearlyPrice: Math.max(0, Number(packageForm.yearlyPrice) || 0),
      maxUsers: Math.max(0, Math.round(Number(packageForm.maxUsers) || 0)),
      maxBranches: Math.max(0, Math.round(Number(packageForm.maxBranches) || 0)),
      maxTables: Math.max(0, Math.round(Number(packageForm.maxTables) || 0)),
      maxStorageGB: Math.max(0, Math.round(Number(packageForm.maxStorageGB) || 0)),
      trialDays: Math.max(0, Math.round(Number(packageForm.trialDays) || 0)),
      isActive: packageForm.isActive,
      createdAt: existingPackage?.createdAt || now,
      updatedAt: now
    }

    const nextModules = LICENSE_MODULE_CATALOG.map(module => {
      const existingModule = packageModules.find(item => item.packageId === packageId && item.moduleKey === module.key)
      return {
        id: existingModule?.id || `license_module_${packageId}_${module.key}`,
        packageId,
        moduleKey: module.key,
        moduleName: module.name,
        enabled: packageForm.modules[module.key] === true,
        createdAt: existingModule?.createdAt || now,
        updatedAt: now
      }
    })

    setPackages(prev => isEditing
      ? prev.map(packageItem => packageItem.id === packageId ? savedPackage : packageItem)
      : [savedPackage, ...prev]
    )
    setPackageModules(prev => [
      ...prev.filter(module => module.packageId !== packageId),
      ...nextModules
    ])
    setSelectedPackageId(packageId)
    setPackageForm(createPackageFormValues(savedPackage, nextModules))
    setFormError('')
    setFormMessage(isEditing ? `${savedPackage.name} paketi güncellendi.` : `${savedPackage.name} paketi oluşturuldu.`)

    const operationType = isEditing && existingPackage?.isActive && !savedPackage.isActive
      ? 'Paket pasife alındı'
      : isEditing ? 'Paket güncellendi' : 'Paket oluşturuldu'

    addActionLog({
      operationType,
      user: currentUser,
      description: `${savedPackage.name} paketi ${operationType === 'Paket oluşturuldu' ? 'oluşturuldu' : operationType === 'Paket pasife alındı' ? 'pasife alındı' : 'güncellendi'}. Modül sayısı: ${nextModules.filter(module => module.enabled).length}.`
    })
  }

  const togglePackageActive = (packageItem: LicensePackage) => {
    const now = new Date().toISOString()
    const nextPackage = { ...packageItem, isActive: !packageItem.isActive, updatedAt: now }
    setPackages(prev => prev.map(item => item.id === packageItem.id ? nextPackage : item))
    if(packageForm.id === packageItem.id) setPackageForm(createPackageFormValues(nextPackage, packageModules))
    setFormMessage(`${packageItem.name} paketi ${nextPackage.isActive ? 'aktife alındı' : 'pasife alındı'}.`)
    setFormError('')
    addActionLog({
      operationType: nextPackage.isActive ? 'Paket güncellendi' : 'Paket pasife alındı',
      user: currentUser,
      description: `${packageItem.name} paketi ${nextPackage.isActive ? 'aktife alındı' : 'pasife alındı'}.`
    })
  }

  const copyPackage = (packageItem: LicensePackage) => {
    const now = new Date().toISOString()
    const newPackageId = createId('license_package')
    const sourceModules = packageModules.filter(module => module.packageId === packageItem.id)
    const copiedPackage: LicensePackage = {
      ...packageItem,
      id: newPackageId,
      name: `${packageItem.name} Kopya`,
      createdAt: now,
      updatedAt: now
    }
    const copiedModules = LICENSE_MODULE_CATALOG.map(module => {
      const sourceModule = sourceModules.find(item => item.moduleKey === module.key)
      return {
        id: `license_module_${newPackageId}_${module.key}`,
        packageId: newPackageId,
        moduleKey: module.key,
        moduleName: module.name,
        enabled: sourceModule?.enabled === true,
        createdAt: now,
        updatedAt: now
      }
    })

    setPackages(prev => [copiedPackage, ...prev])
    setPackageModules(prev => [...prev, ...copiedModules])
    setSelectedPackageId(newPackageId)
    setPackageForm(createPackageFormValues(copiedPackage, copiedModules))
    setFormError('')
    setFormMessage(`${copiedPackage.name} paketi kopyalandı.`)
    addActionLog({
      operationType: 'Paket oluşturuldu',
      user: currentUser,
      description: `${packageItem.name} paketinden ${copiedPackage.name} kopyası oluşturuldu.`
    })
  }

  const updateLicenseForm = <K extends keyof LicenseFormValues>(key: K, value: LicenseFormValues[K]) => {
    setLicenseForm(prev => {
      const next = { ...prev, [key]: value }
      const nextPackage = key === 'packageId' ? packageMap.get(String(value)) : packageMap.get(next.packageId)
      const trialDays = nextPackage?.trialDays || 14

      if(key === 'startDate'){
        next.trialEndDate = addDays(String(value), trialDays)
        next.endDate = prev.isTrial ? next.trialEndDate : addYears(String(value), 1)
      }

      if(key === 'packageId' && next.isTrial){
        next.trialEndDate = addDays(next.startDate, trialDays)
        next.endDate = next.trialEndDate
      }

      if(key === 'isTrial'){
        next.trialEndDate = value ? addDays(prev.startDate, trialDays) : ''
        next.endDate = value ? addDays(prev.startDate, trialDays) : addYears(prev.startDate, 1)
      }

      return next
    })
  }

  const assignLicense = () => {
    if(!licenseForm.companyId){
      setFormError('Lisans atamak için firma seçin.')
      setFormMessage('')
      return
    }

    if(!licenseForm.packageId){
      setFormError('Lisans atamak için paket seçin.')
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const licenseId = createId('company_license')
    const company = companyMap.get(licenseForm.companyId)
    const packageItem = packageMap.get(licenseForm.packageId)
    const endDate = licenseForm.isTrial ? licenseForm.trialEndDate : licenseForm.endDate
    const newLicense: CompanyLicense = {
      id: licenseId,
      companyId: licenseForm.companyId,
      packageId: licenseForm.packageId,
      licenseKey: generateLicenseKey(licenseForm.companyId, licenseForm.packageId),
      status: licenseForm.isTrial ? 'Deneme' : 'Aktif',
      startDate: licenseForm.startDate,
      endDate,
      isTrial: licenseForm.isTrial,
      trialEndDate: licenseForm.isTrial ? licenseForm.trialEndDate : '',
      lastRenewalDate: licenseForm.isTrial ? '' : licenseForm.startDate,
      nextRenewalDate: endDate,
      createdAt: now,
      updatedAt: now
    }

    setLicenses(prev => [
      newLicense,
      ...prev.map(license => {
        const runtimeStatus = getCompanyLicenseRuntimeStatus(license)
        if(license.companyId === newLicense.companyId && (
          runtimeStatus === 'Aktif'
          || runtimeStatus === 'Deneme'
          || runtimeStatus === 'Süresi Yaklaşıyor'
        )){
          return { ...license, status: 'Askıya Alındı' as LicenseStatus, updatedAt: now }
        }
        return { ...license, status: runtimeStatus }
      })
    ])
    setSelectedLicenseId(licenseId)
    setAccessCompanyId(newLicense.companyId)
    setFormError('')
    setFormMessage(`${company?.companyName || 'Firma'} için ${packageItem?.name || 'paket'} lisansı atandı.`)
    addActionLog({
      operationType: 'Lisans atandı',
      user: currentUser,
      description: `${company?.companyName || 'Firma'} için ${packageItem?.name || 'paket'} lisansı atandı. Lisans anahtarı: ${newLicense.licenseKey}. Durum: ${newLicense.status}.`
    })
  }

  const renewLicense = (license: CompanyLicense) => {
    const now = new Date().toISOString()
    const currentEnd = getLicenseDeadline(license) > todayKey() ? getLicenseDeadline(license) : todayKey()
    const renewedEndDate = addYears(currentEnd, 1)
    const company = companyMap.get(license.companyId)

    setLicenses(prev => prev.map(item => {
      const runtimeStatus = getCompanyLicenseRuntimeStatus(item)
      if(item.id === license.id){
        return {
          ...item,
          endDate: renewedEndDate,
          status: 'Aktif',
          isTrial: false,
          trialEndDate: '',
          lastRenewalDate: todayKey(),
          nextRenewalDate: renewedEndDate,
          updatedAt: now
        }
      }

      if(item.companyId === license.companyId && item.id !== license.id && (
        runtimeStatus === 'Aktif'
        || runtimeStatus === 'Deneme'
        || runtimeStatus === 'Süresi Yaklaşıyor'
      )){
        return { ...item, status: 'Askıya Alındı' as LicenseStatus, updatedAt: now }
      }

      return { ...item, status: runtimeStatus }
    }))
    setSelectedLicenseId(license.id)
    setAccessCompanyId(license.companyId)
    setFormError('')
    setFormMessage(`${company?.companyName || 'Firma'} lisansı ${formatDate(renewedEndDate)} tarihine kadar yenilendi.`)
    addActionLog({
      operationType: 'Lisans yenilendi',
      user: currentUser,
      description: `${company?.companyName || 'Firma'} lisansı ${formatDate(renewedEndDate)} tarihine kadar yenilendi.`
    })
  }

  const suspendLicense = (license: CompanyLicense) => {
    const now = new Date().toISOString()
    const company = companyMap.get(license.companyId)

    setLicenses(prev => prev.map(item => item.id === license.id ? {
      ...item,
      status: 'Askıya Alındı',
      updatedAt: now
    } : {
      ...item,
      status: getCompanyLicenseRuntimeStatus(item)
    }))
    setSelectedLicenseId(license.id)
    setFormError('')
    setFormMessage(`${company?.companyName || 'Firma'} lisansı askıya alındı.`)
    addActionLog({
      operationType: 'Lisans askıya alındı',
      user: currentUser,
      description: `${company?.companyName || 'Firma'} lisansı askıya alındı.`
    })
  }

  const cancelLicense = (license: CompanyLicense) => {
    const now = new Date().toISOString()
    const company = companyMap.get(license.companyId)

    setLicenses(prev => prev.map(item => item.id === license.id ? {
      ...item,
      status: 'İptal Edildi',
      updatedAt: now
    } : {
      ...item,
      status: getCompanyLicenseRuntimeStatus(item)
    }))
    setSelectedLicenseId(license.id)
    setFormError('')
    setFormMessage(`${company?.companyName || 'Firma'} lisansı iptal edildi.`)
    addActionLog({
      operationType: 'Lisans iptal edildi',
      user: currentUser,
      description: `${company?.companyName || 'Firma'} lisansı iptal edildi.`
    })
  }

  const metrics = [
    { label: 'Toplam Paket', value: formatNumber(packages.length) },
    { label: 'Aktif Lisans', value: formatNumber(activeLicenseCount) },
    { label: 'Deneme Lisansı', value: formatNumber(trialLicenseCount) },
    { label: 'Süresi Dolan Lisans', value: formatNumber(expiredLicenseCount) },
    { label: 'Toplam Aylık Gelir', value: formatMoney(totalMonthlyRevenue) },
    { label: 'Toplam Yıllık Gelir', value: formatMoney(totalYearlyRevenue) },
    { label: 'Aktif Firma', value: formatNumber(activeCompanyCount) },
    { label: 'Yenileme Bekleyen Lisans', value: formatNumber(renewalDueCount) }
  ]

  return (
    <div className="package-license-page">
      <div className="page-title">
        <div>
          <h2>Paket ve Lisans Yönetimi</h2>
          <p className="muted">İşletmelerin paketlerini, lisanslarını ve modül erişimlerini yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startNewPackage}>Yeni Paket</button>
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
      {formError && <div className="form-error package-license-page-error">{formError}</div>}

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Varsayılan Paketler</h3>
            <p className="muted">Ücretsiz, Başlangıç, Pro, Premium ve Kurumsal paket seti.</p>
          </div>
        </div>

        <div className="package-default-grid">
          {defaultPackageCards.map(packageItem => {
            const enabledModules = packageModules
              .filter(module => module.packageId === packageItem.id && module.enabled)
              .map(module => module.moduleName)

            return (
              <article className="package-default-card" key={packageItem.id}>
                <div>
                  <span className={`status-pill ${packageItem.isActive ? 'success' : 'muted-pill'}`}>{packageItem.isActive ? 'Aktif' : 'Pasif'}</span>
                  <h4>{packageItem.name}</h4>
                  <p>{packageItem.description}</p>
                </div>
                <ul>
                  <li>{formatLimit(packageItem.maxUsers)} Kullanıcı</li>
                  <li>{formatLimit(packageItem.maxBranches)} Şube</li>
                  <li>{formatLimit(packageItem.maxTables)} Masa</li>
                  <li>{formatLimit(packageItem.maxStorageGB, 'GB')} Depolama</li>
                </ul>
                <div className="package-default-modules">
                  {enabledModules.slice(0, 5).map(moduleName => <span key={moduleName}>{moduleName}</span>)}
                  {enabledModules.length > 5 && <span>+{enabledModules.length - 5}</span>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Paket Listesi</h3>
            <p className="muted">{formatNumber(packages.length)} paket tanımlı.</p>
          </div>
          <button className="btn" type="button" onClick={startNewPackage}>Yeni Paket</button>
        </div>

        <div className="table-wrap">
          <table className="data-table package-license-package-table">
            <thead>
              <tr>
                <th>Paket</th>
                <th>Aylık</th>
                <th>Yıllık</th>
                <th>Kullanıcı</th>
                <th>Şube</th>
                <th>Masa</th>
                <th>Depolama</th>
                <th>Deneme</th>
                <th>Modül</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {packages.map(packageItem => {
                const rowSelected = selectedPackageId === packageItem.id

                return (
                  <tr key={packageItem.id} className={rowSelected ? 'selected-row' : ''}>
                    <td>
                      <strong>{packageItem.name}</strong>
                      <div className="muted small-text">{packageItem.description || '-'}</div>
                    </td>
                    <td>{formatMoney(packageItem.monthlyPrice)}</td>
                    <td>{formatMoney(packageItem.yearlyPrice)}</td>
                    <td>{formatLimit(packageItem.maxUsers)}</td>
                    <td>{formatLimit(packageItem.maxBranches)}</td>
                    <td>{formatLimit(packageItem.maxTables)}</td>
                    <td>{formatLimit(packageItem.maxStorageGB, 'GB')}</td>
                    <td>{formatNumber(packageItem.trialDays)} gün</td>
                    <td>{formatNumber(moduleCountMap.get(packageItem.id) || 0)}</td>
                    <td>
                      <span className={`status-pill ${packageItem.isActive ? 'success' : 'muted-pill'}`}>
                        {packageItem.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => selectPackage(packageItem)}>Paket Düzenle</button>
                      <button className="btn" type="button" onClick={() => copyPackage(packageItem)}>Paket Kopyala</button>
                      <button className="btn" type="button" onClick={() => togglePackageActive(packageItem)}>
                        {packageItem.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Firma Lisansları</h3>
            <p className="muted">{formatNumber(visibleLicenses.length)} lisans kaydı gösteriliyor.</p>
          </div>
          <div className="toolbar-controls package-license-filters">
            <select value={packageFilter} onChange={event => setPackageFilter(event.target.value)}>
              <option value="all">Tüm paketler</option>
              {packages.map(packageItem => <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>)}
            </select>
            <select value={licenseStatusFilter} onChange={event => setLicenseStatusFilter(event.target.value as LicenseFilter)}>
              <option value="all">Tüm durumlar</option>
              <option value="Deneme">Deneme</option>
              <option value="Aktif">Aktif</option>
              <option value="Süresi Yaklaşıyor">Süresi Yaklaşıyor</option>
              <option value="Süresi Doldu">Süresi Dolan</option>
              <option value="Askıya Alındı">Askıya Alındı</option>
              <option value="İptal Edildi">İptal Edildi</option>
            </select>
            <select value={trialFilter} onChange={event => setTrialFilter(event.target.value as TrialFilter)}>
              <option value="all">Tüm lisanslar</option>
              <option value="trial">Deneme</option>
              <option value="paid">Ücretli</option>
            </select>
            <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)}>
              <option value="all">Tüm firmalar</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
            <input value={companySearch} onChange={event => setCompanySearch(event.target.value)} placeholder="Firma ara" />
            <input type="date" value={dateStartFilter} onChange={event => setDateStartFilter(event.target.value)} />
            <input type="date" value={dateEndFilter} onChange={event => setDateEndFilter(event.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table package-license-company-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Lisans Anahtarı</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Kalan Gün</th>
                <th>Durum</th>
                <th>Deneme</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleLicenses.length === 0 && (
                <tr><td colSpan={9} className="empty-cell">Filtrelere uygun lisans bulunamadı.</td></tr>
              )}
              {visibleLicenses.map(license => {
                const company = companyMap.get(license.companyId)
                const packageItem = packageMap.get(license.packageId)
                const rowSelected = selectedLicenseId === license.id
                const deadline = getLicenseDeadline(license)
                const remainingDays = getDaysRemaining(deadline)
                const canSuspend = license.status === 'Aktif' || license.status === 'Deneme' || license.status === 'Süresi Yaklaşıyor'
                const canCancel = license.status !== 'İptal Edildi'

                return (
                  <tr key={license.id} className={rowSelected ? 'selected-row' : ''}>
                    <td>
                      <strong>{company?.companyName || '-'}</strong>
                      <div className="muted small-text">{company?.city || '-'} / {company?.ownerName || '-'}</div>
                    </td>
                    <td>{packageItem?.name || '-'}</td>
                    <td><span className="license-key">{license.licenseKey}</span></td>
                    <td>{formatDate(license.startDate)}</td>
                    <td>{formatDate(deadline)}</td>
                    <td>{license.status === 'Süresi Doldu' ? 'Doldu' : `${formatNumber(Math.max(0, remainingDays))} gün`}</td>
                    <td><span className={`status-pill ${getStatusClassName(license.status)}`}>{license.status}</span></td>
                    <td><span className={`status-pill ${license.isTrial ? 'info-pill' : 'muted-pill'}`}>{license.isTrial ? 'Evet' : 'Hayır'}</span></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => {
                        setSelectedLicenseId(license.id)
                        setAccessCompanyId(license.companyId)
                      }}>Detay</button>
                      <button className="btn" type="button" onClick={() => renewLicense(license)}>Lisans Yenile</button>
                      <button className="btn" type="button" disabled={!canSuspend} onClick={() => suspendLicense(license)}>Lisans Askıya Al</button>
                      <button className="btn" type="button" disabled={!canCancel} onClick={() => cancelLicense(license)}>Lisans İptal Et</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="package-license-detail-grid">
        <section className="card package-license-form-card">
          <div className="section-header compact">
            <div>
              <h3>Paket İçeriği</h3>
              <p className="muted">{selectedPackage ? selectedPackage.name : 'Yeni paket'}</p>
            </div>
            <span className={`status-pill ${packageForm.isActive ? 'success' : 'muted-pill'}`}>
              {packageForm.isActive ? 'Aktif' : 'Pasif'}
            </span>
          </div>

          <form className="stacked-form" onSubmit={event => {
            event.preventDefault()
            savePackage()
          }}>
            <div className="form-field">
              <label>Paket Adı</label>
              <input value={packageForm.name} onChange={event => updatePackageForm('name', event.target.value)} required />
            </div>
            <div className="form-field">
              <label>Açıklama</label>
              <textarea rows={3} value={packageForm.description} onChange={event => updatePackageForm('description', event.target.value)} />
            </div>
            <div className="package-license-form-grid">
              <div className="form-field">
                <label>Aylık Ücret</label>
                <input type="number" min="0" value={packageForm.monthlyPrice} onChange={event => updatePackageForm('monthlyPrice', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Yıllık Ücret</label>
                <input type="number" min="0" value={packageForm.yearlyPrice} onChange={event => updatePackageForm('yearlyPrice', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Kullanıcı Limiti</label>
                <input type="number" min="0" value={packageForm.maxUsers} onChange={event => updatePackageForm('maxUsers', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Şube Limiti</label>
                <input type="number" min="0" value={packageForm.maxBranches} onChange={event => updatePackageForm('maxBranches', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Masa Limiti</label>
                <input type="number" min="0" value={packageForm.maxTables} onChange={event => updatePackageForm('maxTables', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Depolama GB</label>
                <input type="number" min="0" value={packageForm.maxStorageGB} onChange={event => updatePackageForm('maxStorageGB', Number(event.target.value))} />
              </div>
              <div className="form-field">
                <label>Deneme Günü</label>
                <input type="number" min="0" value={packageForm.trialDays} onChange={event => updatePackageForm('trialDays', Number(event.target.value))} />
              </div>
              <label className="check-row form-check-field package-license-active-check">
                <input type="checkbox" checked={packageForm.isActive} onChange={event => updatePackageForm('isActive', event.target.checked)} />
                <span>Aktif paket</span>
              </label>
            </div>

            <div className="license-module-grid">
              {LICENSE_MODULE_CATALOG.map(module => (
                <label className="license-module-toggle" key={module.key}>
                  <input
                    type="checkbox"
                    checked={packageForm.modules[module.key] === true}
                    onChange={event => updatePackageModule(module.key, event.target.checked)}
                  />
                  <span>{module.name}</span>
                </label>
              ))}
            </div>

            <div className="form-actions">
              <button className="btn primary" type="submit">Kaydet</button>
              {packageForm.id && <button className="btn" type="button" onClick={startNewPackage}>Yeni Paket</button>}
            </div>
          </form>
        </section>

        <section className="card package-license-form-card">
          <div className="section-header compact">
            <div>
              <h3>Lisans Ata</h3>
              <p className="muted">Deneme süresi seçilen paketten alınır.</p>
            </div>
          </div>

          <form className="stacked-form" onSubmit={event => {
            event.preventDefault()
            assignLicense()
          }}>
            <div className="form-field">
              <label>Firma</label>
              <select value={licenseForm.companyId} onChange={event => updateLicenseForm('companyId', event.target.value)}>
                <option value="">Firma seçin</option>
                {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Paket</label>
              <select value={licenseForm.packageId} onChange={event => updateLicenseForm('packageId', event.target.value)}>
                <option value="">Paket seçin</option>
                {packages.filter(packageItem => packageItem.isActive).map(packageItem => (
                  <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>
                ))}
              </select>
            </div>
            <div className="package-license-form-grid">
              <div className="form-field">
                <label>Başlangıç Tarihi</label>
                <input type="date" value={licenseForm.startDate} onChange={event => updateLicenseForm('startDate', event.target.value)} />
              </div>
              <label className="check-row form-check-field package-license-active-check">
                <input type="checkbox" checked={licenseForm.isTrial} onChange={event => updateLicenseForm('isTrial', event.target.checked)} />
                <span>Deneme lisansı</span>
              </label>
              <div className="form-field">
                <label>{licenseForm.isTrial ? 'Deneme Bitişi' : 'Bitiş Tarihi'}</label>
                <input
                  type="date"
                  value={licenseForm.isTrial ? licenseForm.trialEndDate : licenseForm.endDate}
                  onChange={event => updateLicenseForm(licenseForm.isTrial ? 'trialEndDate' : 'endDate', event.target.value)}
                />
              </div>
            </div>
            <div className="package-license-preview">
              <span>Seçili Paket</span>
              <strong>{packageMap.get(licenseForm.packageId)?.name || '-'}</strong>
              <small>
                {licenseForm.isTrial
                  ? `${formatDate(licenseForm.trialEndDate)} tarihine kadar deneme.`
                  : `${formatDate(licenseForm.endDate)} tarihine kadar aktif lisans.`}
              </small>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">Lisans Ata</button>
            </div>
          </form>
        </section>

        <section className="card package-license-access-card">
          <div className="section-header compact">
            <div>
              <h3>Modül ve Limit Kontrolü</h3>
              <p className="muted">Firma lisansında açık olan modüller ve kullanım limitleri.</p>
            </div>
          </div>

          <div className="form-field">
            <label>Firma</label>
            <select value={accessCompanyId} onChange={event => setAccessCompanyId(event.target.value)}>
              <option value="">Firma seçin</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
          </div>

          <div className="financial-summary-values package-license-access-summary">
            <div>
              <span>Paket</span>
              <strong>{selectedAccessPackage?.name || '-'}</strong>
            </div>
            <div>
              <span>Lisans Durumu</span>
              <strong>{activeAccessLicense?.status || 'Aktif lisans yok'}</strong>
            </div>
            <div>
              <span>Bitiş</span>
              <strong>{activeAccessLicense ? formatDate(getLicenseDeadline(activeAccessLicense)) : '-'}</strong>
            </div>
            <div>
              <span>Modül Sayısı</span>
              <strong>{formatNumber(selectedAccessModules.filter(module => module.enabled).length)}</strong>
            </div>
            <div>
              <span>Kullanıcı</span>
              <strong>{formatNumber(selectedAccessUsage.users)} / {formatLimit(selectedAccessPackage?.maxUsers || 0)}</strong>
            </div>
            <div>
              <span>Şube</span>
              <strong>{formatNumber(selectedAccessUsage.branches)} / {formatLimit(selectedAccessPackage?.maxBranches || 0)}</strong>
            </div>
            <div>
              <span>Masa</span>
              <strong>{formatNumber(selectedAccessUsage.tables)} / {formatLimit(selectedAccessPackage?.maxTables || 0)}</strong>
            </div>
            <div>
              <span>Depolama</span>
              <strong>{formatLimit(selectedAccessPackage?.maxStorageGB || 0, 'GB')}</strong>
            </div>
          </div>

          {!activeAccessLicense && (
            <div className="form-error package-license-page-error">Bu firmada aktif veya deneme lisansı yok. Modül erişimi engellenir.</div>
          )}

          <div className="package-license-access-grid">
            {LICENSE_MODULE_CATALOG.map(module => {
              const accessModule = selectedAccessModules.find(item => item.key === module.key)
              const enabled = accessModule?.enabled === true

              return (
                <div key={module.key} className={enabled ? 'enabled' : 'disabled'}>
                  <span>{module.name}</span>
                  <strong>{enabled ? 'Açık' : 'Kapalı'}</strong>
                </div>
              )
            })}
          </div>

          {selectedLicense && (
            <div className="package-license-selected-license">
              <span>Seçili Lisans</span>
              <strong>{companyMap.get(selectedLicense.companyId)?.companyName || '-'}</strong>
              <small>{packageMap.get(selectedLicense.packageId)?.name || '-'} / {selectedLicense.status}</small>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Lisans Uyarıları</h3>
            <p className="muted">30 gün, 7 gün, 1 gün ve süre dolumu eşikleri.</p>
          </div>
          <span className="status-pill info-pill">{formatNumber(licenseWarnings.length)} uyarı</span>
        </div>

        <div className="table-wrap">
          <table className="data-table package-license-warning-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Eşik</th>
                <th>Kalan Gün</th>
                <th>Uyarı</th>
              </tr>
            </thead>
            <tbody>
              {licenseWarnings.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">Aktif lisans uyarısı bulunmuyor.</td></tr>
              )}
              {licenseWarnings.map(warning => (
                <tr key={warning.id}>
                  <td>{warning.companyName}</td>
                  <td>{warning.packageName}</td>
                  <td><span className={`status-pill ${warning.threshold === 'Süresi doldu' ? 'danger-pill' : 'warning-pill'}`}>{warning.threshold}</span></td>
                  <td>{warning.threshold === 'Süresi doldu' ? 'Doldu' : `${formatNumber(Math.max(0, warning.daysRemaining))} gün`}</td>
                  <td>{warning.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
