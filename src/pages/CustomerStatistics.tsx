import React from 'react'
import {
  LICENSE_MODULE_CATALOG,
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanyUsers,
  loadLicenseModules,
  loadLicensePackages
} from '../storage'
import { Branch, Company, CompanyLicense, CompanyUser, LicenseModule, LicenseModuleKey, LicensePackage } from '../types'

type CustomerStatus = 'Aktif' | 'Pasif' | 'Askıda' | 'Deneme'
type StatusFilter = CustomerStatus | 'all'

type CustomerStatRow = {
  company: Company
  license?: CompanyLicense
  packageName: string
  packageId: string
  status: CustomerStatus
  branchCount: number
  userCount: number
  mrr: number
}

type DistributionItem = {
  label: string
  count: number
  color: string
}

const customerStatuses: CustomerStatus[] = ['Aktif', 'Pasif', 'Askıda', 'Deneme']
const distributionColors = ['#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#475569']
const moduleLabels: Partial<Record<LicenseModuleKey, string>> = {
  adisyon: 'RestaurantOS',
  'qr-menu': 'QR Menü',
  stock: 'Stok',
  current: 'Cari',
  finance: 'Finans',
  personnel: 'Personel'
}

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatMoney = (value: number) => value.toLocaleString('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0
})

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

const getLatestLicenseForCompany = (licenses: CompanyLicense[], companyId: string) => {
  return licenses
    .filter(license => license.companyId === companyId && !normalizeLookup(license.status).includes('iptal'))
    .sort((first, second) => {
      const firstDate = first.updatedAt || first.createdAt || first.startDate
      const secondDate = second.updatedAt || second.createdAt || second.startDate
      return secondDate.localeCompare(firstDate)
    })[0]
}

const getCustomerStatus = (company: Company, license?: CompanyLicense): CustomerStatus => {
  const companyStatus = normalizeLookup(company.status)
  const licenseStatus = normalizeLookup(license?.status || '')

  if(companyStatus.startsWith('ask')) return 'Askıda'
  if(companyStatus.includes('pasif') || companyStatus.includes('silindi')) return 'Pasif'
  if(license?.isTrial || licenseStatus.includes('deneme')) return 'Deneme'
  return 'Aktif'
}

const getBranchCount = (companyId: string, branches: Branch[]) => {
  return branches.filter(branch => branch.companyId === companyId).length
}

const getUserCount = (companyId: string, users: CompanyUser[]) => {
  return users.filter(user => (
    user.companyId === companyId
    && !normalizeLookup(user.status).includes('silindi')
  )).length
}

const buildConicGradient = (items: DistributionItem[]) => {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  if(total === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)'

  let start = 0
  const segments = items.map(item => {
    const end = start + (item.count / total) * 360
    const segment = `${item.color} ${start}deg ${end}deg`
    start = end
    return segment
  })
  return `conic-gradient(${segments.join(', ')})`
}

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const getCurrentYearMonths = () => {
  const year = new Date().getFullYear()
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1)
    return {
      key: getMonthKey(date),
      label: date.toLocaleDateString('tr-TR', { month: 'short' })
    }
  })
}

const getEnabledModuleCountForLicense = (
  license: CompanyLicense | undefined,
  modules: LicenseModule[],
  moduleKey: LicenseModuleKey
) => {
  if(!license) return false
  if(moduleKey === 'adisyon') return true
  return modules.some(module => module.packageId === license.packageId && module.moduleKey === moduleKey && module.enabled)
}

export default function CustomerStatistics(){
  const data = React.useMemo(() => {
    const packages = loadLicensePackages()
    return {
      companies: loadCompanies(),
      branches: loadBranches(),
      licenses: loadCompanyLicenses(),
      users: loadCompanyUsers(),
      packages,
      packageMap: new Map(packages.map(packageItem => [packageItem.id, packageItem])),
      modules: loadLicenseModules()
    }
  }, [])

  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [packageFilter, setPackageFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const rows = React.useMemo<CustomerStatRow[]>(() => {
    return data.companies
      .filter(company => !normalizeLookup(company.status).includes('silindi'))
      .map(company => {
        const license = getLatestLicenseForCompany(data.licenses, company.id)
        const packageItem = license ? data.packageMap.get(license.packageId) : undefined
        const status = getCustomerStatus(company, license)
        return {
          company,
          license,
          packageName: packageItem?.name || '-',
          packageId: packageItem?.id || '',
          status,
          branchCount: getBranchCount(company.id, data.branches),
          userCount: getUserCount(company.id, data.users),
          mrr: status === 'Aktif' || status === 'Deneme' ? packageItem?.monthlyPrice || 0 : 0
        }
      })
  }, [data])

  const filteredRows = React.useMemo(() => {
    return rows.filter(row => {
      const createdKey = getDateKey(row.company.createdAt)
      const matchesStart = !startDate || createdKey >= startDate
      const matchesEnd = !endDate || createdKey <= endDate
      const matchesPackage = packageFilter === 'all' || row.packageId === packageFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      return matchesStart && matchesEnd && matchesPackage && matchesStatus
    })
  }, [endDate, packageFilter, rows, startDate, statusFilter])

  const summary = React.useMemo(() => ({
    totalCustomers: filteredRows.length,
    activeCustomers: filteredRows.filter(row => row.status === 'Aktif').length,
    passiveCustomers: filteredRows.filter(row => row.status === 'Pasif').length,
    trialCustomers: filteredRows.filter(row => row.status === 'Deneme').length,
    totalBranches: filteredRows.reduce((sum, row) => sum + row.branchCount, 0),
    totalUsers: filteredRows.reduce((sum, row) => sum + row.userCount, 0),
    mrr: filteredRows.reduce((sum, row) => sum + row.mrr, 0)
  }), [filteredRows])

  const growthItems = React.useMemo(() => {
    const months = getCurrentYearMonths()
    const counts = new Map(months.map(month => [month.key, 0]))
    filteredRows.forEach(row => {
      const date = new Date(row.company.createdAt)
      if(Number.isNaN(date.getTime())) return
      const key = getMonthKey(date)
      if(counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1)
    })
    const maxCount = Math.max(1, ...Array.from(counts.values()))
    return months.map(month => ({
      ...month,
      count: counts.get(month.key) || 0,
      percent: ((counts.get(month.key) || 0) / maxCount) * 100
    }))
  }, [filteredRows])

  const packageDistribution = React.useMemo<DistributionItem[]>(() => {
    const counts = filteredRows.reduce<Record<string, number>>((acc, row) => {
      const label = row.packageName === '-' ? 'Paket Yok' : row.packageName
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .sort((first, second) => second[1] - first[1])
      .map(([label, count], index) => ({ label, count, color: distributionColors[index % distributionColors.length] }))
  }, [filteredRows])

  const statusDistribution = React.useMemo<DistributionItem[]>(() => {
    return customerStatuses.map((status, index) => ({
      label: status,
      count: filteredRows.filter(row => row.status === status).length,
      color: distributionColors[index % distributionColors.length]
    }))
  }, [filteredRows])

  const moduleUsage = React.useMemo(() => {
    const keys = (['adisyon', 'qr-menu', 'stock', 'current', 'finance', 'personnel'] as LicenseModuleKey[])
    return keys
      .map(moduleKey => {
        const catalogName = LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)?.name || moduleKey
        const count = filteredRows.filter(row => getEnabledModuleCountForLicense(row.license, data.modules, moduleKey)).length
        return {
          key: moduleKey,
          label: moduleLabels[moduleKey] || catalogName,
          count
        }
      })
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'tr-TR'))
  }, [data.modules, filteredRows])

  const maxModuleCount = Math.max(1, ...moduleUsage.map(module => module.count))
  const largestBusinesses = [...filteredRows]
    .sort((first, second) => second.branchCount - first.branchCount || second.userCount - first.userCount || first.company.companyName.localeCompare(second.company.companyName, 'tr-TR'))
    .slice(0, 10)
  const recentBusinesses = [...filteredRows]
    .sort((first, second) => second.company.createdAt.localeCompare(first.company.createdAt))
    .slice(0, 6)

  return (
    <div className="customer-statistics-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Müşteri İstatistikleri</h2>
          <p>Müşteri büyümesini, paket dağılımını, kullanım yoğunluğunu ve gelir metriklerini merkezi olarak analiz edin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{formatMoney(summary.mrr)}</strong>
          <span>Aylık Tekrar Eden Gelir</span>
        </div>
      </div>

      <section className="evren360-panel customer-statistics-filter-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Filtreler</h3>
            <p>Tarih aralığı, paket ve müşteri durumuna göre istatistikleri daraltın.</p>
          </div>
          <div className="customer-statistics-filters">
            <label>
              <span>Başlangıç</span>
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            </label>
            <label>
              <span>Bitiş</span>
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
            </label>
            <label>
              <span>Paket</span>
              <select value={packageFilter} onChange={event => setPackageFilter(event.target.value)}>
                <option value="all">Tüm paketler</option>
                {data.packages.map(packageItem => <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>)}
              </select>
            </label>
            <label>
              <span>Durum</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {customerStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="evren360-kpi-grid customer-statistics-kpi-grid">
        <div className="evren360-kpi"><span>Toplam Müşteri</span><strong>{formatNumber(summary.totalCustomers)}</strong><p>Filtre kapsamındaki firmalar.</p></div>
        <div className="evren360-kpi success"><span>Aktif Müşteri</span><strong>{formatNumber(summary.activeCustomers)}</strong><p>Kullanıma açık müşteriler.</p></div>
        <div className="evren360-kpi muted"><span>Pasif Müşteri</span><strong>{formatNumber(summary.passiveCustomers)}</strong><p>Pasife alınan kayıtlar.</p></div>
        <div className="evren360-kpi warning"><span>Deneme Hesabı</span><strong>{formatNumber(summary.trialCustomers)}</strong><p>Deneme lisanslı müşteriler.</p></div>
        <div className="evren360-kpi"><span>Toplam Şube</span><strong>{formatNumber(summary.totalBranches)}</strong><p>Müşteri şubeleri toplamı.</p></div>
        <div className="evren360-kpi"><span>Toplam Kullanıcı</span><strong>{formatNumber(summary.totalUsers)}</strong><p>Silinmiş kullanıcılar hariç.</p></div>
        <div className="evren360-kpi success customer-statistics-mrr-card"><span>MRR</span><strong>{formatMoney(summary.mrr)}</strong><p>Aylık tekrar eden gelir.</p></div>
      </div>

      <div className="customer-statistics-chart-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Müşteri Büyümesi</h3>
              <p>Aylara göre yeni müşteri kazanımı.</p>
            </div>
          </div>
          <div className="customer-growth-chart">
            {growthItems.map(item => (
              <div className="customer-growth-column" key={item.key}>
                <div className="customer-growth-value">{formatNumber(item.count)}</div>
                <div className="customer-growth-track">
                  <div className="customer-growth-bar" style={{ height: `${item.count > 0 ? Math.max(8, item.percent) : 0}%` }} />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Paket Dağılımı</h3>
              <p>Başlangıç, Pro, Premium ve diğer paketlerin dağılımı.</p>
            </div>
          </div>
          <div className="customer-statistics-donut-layout">
            <div className="customer-statistics-donut" style={{ background: buildConicGradient(packageDistribution) }}>
              <div><strong>{formatNumber(filteredRows.length)}</strong><span>müşteri</span></div>
            </div>
            <div className="customer-statistics-legend">
              {packageDistribution.map(item => (
                <div key={item.label}><span style={{ background: item.color }} /><strong>{item.label}</strong><em>{formatNumber(item.count)}</em></div>
              ))}
              {packageDistribution.length === 0 && <p className="muted">Paket verisi bulunamadı.</p>}
            </div>
          </div>
        </section>
      </div>

      <div className="customer-statistics-chart-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Müşteri Durumu</h3>
              <p>Aktif, pasif, askıda ve deneme dağılımı.</p>
            </div>
          </div>
          <div className="customer-statistics-donut-layout">
            <div className="customer-statistics-donut" style={{ background: buildConicGradient(statusDistribution) }}>
              <div><strong>{formatNumber(filteredRows.length)}</strong><span>kayıt</span></div>
            </div>
            <div className="customer-statistics-legend">
              {statusDistribution.map(item => (
                <div key={item.label}><span style={{ background: item.color }} /><strong>{item.label}</strong><em>{formatNumber(item.count)}</em></div>
              ))}
            </div>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Modül Kullanımı</h3>
              <p>En çok kullanılan ana modüller.</p>
            </div>
          </div>
          <div className="customer-module-usage-list">
            {moduleUsage.map(module => (
              <div key={module.key}>
                <div>
                  <strong>{module.label}</strong>
                  <span>{formatNumber(module.count)} müşteri</span>
                </div>
                <div className="customer-module-usage-bar"><span style={{ width: `${(module.count / maxModuleCount) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="customer-statistics-table-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>En Büyük İşletmeler</h3>
              <p>En fazla şubeye sahip ilk 10 firma.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table customer-statistics-largest-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Şube Sayısı</th>
                  <th>Kullanıcı Sayısı</th>
                  <th>Paket</th>
                </tr>
              </thead>
              <tbody>
                {largestBusinesses.map(row => (
                  <tr key={row.company.id}>
                    <td><strong>{row.company.companyName}</strong><span className="muted small-text">{row.company.city} / {row.company.district}</span></td>
                    <td>{formatNumber(row.branchCount)}</td>
                    <td>{formatNumber(row.userCount)}</td>
                    <td>{row.packageName}</td>
                  </tr>
                ))}
                {largestBusinesses.length === 0 && <tr><td className="empty-cell" colSpan={4}>İşletme kaydı bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Son Eklenen İşletmeler</h3>
              <p>En yeni müşteri kayıtları.</p>
            </div>
          </div>
          <div className="customer-recent-business-list">
            {recentBusinesses.map(row => (
              <div key={row.company.id}>
                <div>
                  <strong>{row.company.companyName}</strong>
                  <span>{formatDate(row.company.createdAt)}</span>
                </div>
                <span className="status-pill info-pill">{row.packageName}</span>
              </div>
            ))}
            {recentBusinesses.length === 0 && <p className="muted">Yeni işletme kaydı bulunamadı.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
