import React from 'react'
import {
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanySetups,
  loadCompanyUsers,
  loadLicensePackages
} from '../storage'
import { Branch, Company, CompanyLicense, CompanySetup, CompanyUser, LicensePackage } from '../types'

type CustomerStatus = 'Aktif' | 'Pasif' | 'Deneme' | 'Askıda'
type SortKey = 'companyName' | 'createdAt' | 'package'
type SortDirection = 'asc' | 'desc'

type CustomerRow = {
  company: Company
  packageName: string
  status: CustomerStatus
  branchCount: number
  userCount: number
}

type Props = {
  onOpenCustomerDetail: (companyId: string) => void
}

const customerStatuses: CustomerStatus[] = ['Aktif', 'Pasif', 'Deneme', 'Askıda']

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const getStatusClassName = (status: CustomerStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Pasif') return 'muted-pill'
  if(status === 'Deneme') return 'info-pill'
  return 'warning-pill'
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

const getPackageName = (
  license: CompanyLicense | undefined,
  packages: LicensePackage[]
) => {
  if(!license) return '-'
  return packages.find(packageItem => packageItem.id === license.packageId)?.name || '-'
}

const getCustomerStatus = (company: Company, license?: CompanyLicense): CustomerStatus => {
  const companyStatus = normalizeLookup(company.status)
  const licenseStatus = normalizeLookup(license?.status || '')

  if(companyStatus.startsWith('ask')) return 'Askıda'
  if(companyStatus.includes('pasif') || companyStatus.includes('silindi')) return 'Pasif'
  if(license?.isTrial || licenseStatus.includes('deneme')) return 'Deneme'
  return 'Aktif'
}

const getBranchCountForCompany = (
  companyId: string,
  branches: Branch[],
  setups: CompanySetup[]
) => {
  const branchIds = new Set<string>()
  branches
    .filter(branch => branch.companyId === companyId)
    .forEach(branch => branchIds.add(branch.id))
  setups
    .filter(setup => setup.companyId === companyId && setup.branchId)
    .forEach(setup => branchIds.add(setup.branchId))
  return branchIds.size
}

const getUserCountForCompany = (companyId: string, users: CompanyUser[]) => {
  return users.filter(user => (
    user.companyId === companyId
    && !normalizeLookup(user.status).includes('silindi')
  )).length
}

export default function CustomerList({ onOpenCustomerDetail }: Props){
  const [search, setSearch] = React.useState('')
  const [packageFilter, setPackageFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [sortKey, setSortKey] = React.useState<SortKey>('companyName')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc')

  const data = React.useMemo(() => ({
    companies: loadCompanies(),
    packages: loadLicensePackages(),
    licenses: loadCompanyLicenses(),
    users: loadCompanyUsers(),
    branches: loadBranches(),
    setups: loadCompanySetups()
  }), [])

  const rows = React.useMemo<CustomerRow[]>(() => {
    return data.companies
      .filter(company => !normalizeLookup(company.status).includes('silindi'))
      .map(company => {
        const license = getLatestLicenseForCompany(data.licenses, company.id)
        return {
          company,
          packageName: getPackageName(license, data.packages),
          status: getCustomerStatus(company, license),
          branchCount: getBranchCountForCompany(company.id, data.branches, data.setups),
          userCount: getUserCountForCompany(company.id, data.users)
        }
      })
  }, [data])

  const packageOptions = React.useMemo(() => {
    return Array.from(new Set(rows.map(row => row.packageName).filter(packageName => packageName !== '-')))
      .sort((first, second) => first.localeCompare(second, 'tr'))
  }, [rows])

  const summary = React.useMemo(() => ({
    total: rows.length,
    active: rows.filter(row => row.status === 'Aktif').length,
    trial: rows.filter(row => row.status === 'Deneme').length,
    suspended: rows.filter(row => row.status === 'Askıda').length
  }), [rows])

  const visibleRows = React.useMemo(() => {
    const searchValue = normalizeLookup(search)
    return rows
      .filter(row => {
        const company = row.company
        const matchesSearch = !searchValue || [
          company.companyName,
          company.ownerName,
          company.email
        ].some(value => normalizeLookup(value).includes(searchValue))
        const matchesPackage = packageFilter === 'all' || row.packageName === packageFilter
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter
        return matchesSearch && matchesPackage && matchesStatus
      })
      .sort((first, second) => {
        const direction = sortDirection === 'asc' ? 1 : -1
        if(sortKey === 'createdAt'){
          return first.company.createdAt.localeCompare(second.company.createdAt) * direction
        }
        const firstValue = sortKey === 'package' ? first.packageName : first.company.companyName
        const secondValue = sortKey === 'package' ? second.packageName : second.company.companyName
        return firstValue.localeCompare(secondValue, 'tr') * direction
      })
  }, [packageFilter, rows, search, sortDirection, sortKey, statusFilter])

  return (
    <div className="customer-list-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Müşteri Listesi</h2>
          <p>Platform müşterilerini paket, durum, şube ve kullanıcı özetleriyle merkezi olarak görüntüleyin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{formatNumber(visibleRows.length)} kayıt</strong>
          <span>Liste görünümü</span>
        </div>
      </div>

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi">
          <span>Toplam Müşteri</span>
          <strong>{formatNumber(summary.total)}</strong>
          <p>Silinmiş firmalar hariç.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Aktif Müşteri</span>
          <strong>{formatNumber(summary.active)}</strong>
          <p>Kullanıma açık hesaplar.</p>
        </div>
        <div className="evren360-kpi warning">
          <span>Deneme Hesabı</span>
          <strong>{formatNumber(summary.trial)}</strong>
          <p>Deneme lisansı bulunan hesaplar.</p>
        </div>
        <div className="evren360-kpi danger">
          <span>Askıda Hesap</span>
          <strong>{formatNumber(summary.suspended)}</strong>
          <p>Geçici olarak durdurulan hesaplar.</p>
        </div>
      </div>

      <section className="evren360-panel customer-list-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Müşteriler</h3>
            <p>Firma, yetkili, paket ve kullanım kapsamı.</p>
          </div>
          <div className="customer-list-controls">
            <label>
              <span>Arama</span>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Firma, yetkili veya e-posta"
              />
            </label>
            <label>
              <span>Paket</span>
              <select value={packageFilter} onChange={event => setPackageFilter(event.target.value)}>
                <option value="all">Tüm paketler</option>
                {packageOptions.map(packageName => <option key={packageName} value={packageName}>{packageName}</option>)}
              </select>
            </label>
            <label>
              <span>Durum</span>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">Tüm durumlar</option>
                {customerStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Sıralama</span>
              <select value={sortKey} onChange={event => setSortKey(event.target.value as SortKey)}>
                <option value="companyName">Firma Adı</option>
                <option value="createdAt">Kayıt Tarihi</option>
                <option value="package">Paket</option>
              </select>
            </label>
            <label>
              <span>Yön</span>
              <select value={sortDirection} onChange={event => setSortDirection(event.target.value as SortDirection)}>
                <option value="asc">Artan</option>
                <option value="desc">Azalan</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table customer-list-table">
            <thead>
              <tr>
                <th>Firma Adı</th>
                <th>Yetkili</th>
                <th>E-posta</th>
                <th>Telefon</th>
                <th>Paket</th>
                <th>Durum</th>
                <th>Şube Sayısı</th>
                <th>Kullanıcı Sayısı</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => (
                <tr key={row.company.id}>
                  <td><strong>{row.company.companyName}</strong><span className="muted small-text">{row.company.city} / {row.company.district}</span></td>
                  <td>{row.company.ownerName}</td>
                  <td>{row.company.email}</td>
                  <td>{row.company.phone}</td>
                  <td>{row.packageName}</td>
                  <td><span className={`status-pill ${getStatusClassName(row.status)}`}>{row.status}</span></td>
                  <td>{formatNumber(row.branchCount)}</td>
                  <td>{formatNumber(row.userCount)}</td>
                  <td>{formatDate(row.company.createdAt)}</td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => onOpenCustomerDetail(row.company.id)}>Detay</button>
                    <button className="btn" type="button">Düzenle</button>
                    <button className="btn" type="button">Lisans</button>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={10}>Kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
