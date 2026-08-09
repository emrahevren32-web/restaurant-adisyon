import React from 'react'
import { CHART_THEME_COLORS, DISTRIBUTION_CHART_COLORS } from '../design-system/ThemeColors'
import {
  BILLING_COLLECTION_STATUSES,
  BILLING_FOUNDATION_SERVICES,
  BILLING_INVOICE_STATUSES,
  buildBillingManagementSnapshot
} from '../platform-billing/billing-foundation.service'
import {
  BillingCollectionStatus,
  BillingDistributionPoint,
  BillingInvoice,
  BillingInvoiceStatus,
  BillingPaymentChannel
} from '../platform-billing/billing-foundation.types'
import { loadCompanies, loadCompanyLicenses, loadLicensePackages, loadUserSubscriptions } from '../storage'

type InvoiceStatusFilter = BillingInvoiceStatus | 'all'
type CollectionStatusFilter = BillingCollectionStatus | 'all'

const paymentChannels: BillingPaymentChannel[] = ['Kredi Kartı', 'Banka Transferi', 'Manuel Tahsilat', 'Havale/EFT']
const distributionColors = [...DISTRIBUTION_CHART_COLORS]

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
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
  const date = new Date(`${value}T12:00:00`)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const getCurrentMonthKey = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)

const getStatusClassName = (status: string) => {
  const normalized = normalizeLookup(status)
  if(normalized.includes('odendi') || normalized.includes('tahsiledildi') || normalized.includes('aktif')) return 'success'
  if(normalized.includes('bekliyor')) return 'warning-pill'
  if(normalized.includes('gecikti') || normalized.includes('iptal')) return 'danger-pill'
  if(normalized.includes('deneme')) return 'info-pill'
  return 'muted-pill'
}

const buildConicGradient = (items: BillingDistributionPoint[]) => {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  if(total <= 0) return `conic-gradient(${CHART_THEME_COLORS.empty} 0deg 360deg)`

  let start = 0
  const segments = items.map(item => {
    const end = start + (item.amount / total) * 360
    const segment = `${item.color} ${start}deg ${end}deg`
    start = end
    return segment
  })
  return `conic-gradient(${segments.join(', ')})`
}

const sumInvoices = (invoices: BillingInvoice[]) => invoices.reduce((sum, invoice) => sum + invoice.amount, 0)

const buildDistribution = (
  labels: string[],
  amountForLabel: (label: string) => number
): BillingDistributionPoint[] => labels.map((label, index) => ({
  label,
  amount: amountForLabel(label),
  color: distributionColors[index % distributionColors.length]
}))

export default function BillingManagement(){
  const data = React.useMemo(() => ({
    companies: loadCompanies(),
    licenses: loadCompanyLicenses(),
    packages: loadLicensePackages(),
    subscriptions: loadUserSubscriptions()
  }), [])

  const snapshot = React.useMemo(() => buildBillingManagementSnapshot(data), [data])
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [packageFilter, setPackageFilter] = React.useState('all')
  const [invoiceStatus, setInvoiceStatus] = React.useState<InvoiceStatusFilter>('all')
  const [collectionStatus, setCollectionStatus] = React.useState<CollectionStatusFilter>('all')
  const [message, setMessage] = React.useState('')

  const allowedCollectionCompanyIds = React.useMemo(() => new Set(
    snapshot.collections
      .filter(collection => collectionStatus === 'all' || collection.status === collectionStatus)
      .map(collection => collection.companyId)
  ), [collectionStatus, snapshot.collections])

  const visibleInvoices = React.useMemo(() => {
    return snapshot.invoices.filter(invoice => {
      const matchesStart = !startDate || invoice.issuedAt >= startDate
      const matchesEnd = !endDate || invoice.issuedAt <= endDate
      const matchesPackage = packageFilter === 'all' || invoice.packageId === packageFilter
      const matchesInvoiceStatus = invoiceStatus === 'all' || invoice.status === invoiceStatus
      const matchesCollectionStatus = collectionStatus === 'all' || allowedCollectionCompanyIds.has(invoice.companyId)
      return matchesStart && matchesEnd && matchesPackage && matchesInvoiceStatus && matchesCollectionStatus
    })
  }, [allowedCollectionCompanyIds, collectionStatus, endDate, invoiceStatus, packageFilter, snapshot.invoices, startDate])

  const visibleCompanyIds = React.useMemo(() => new Set(visibleInvoices.map(invoice => invoice.companyId)), [visibleInvoices])

  const visibleCollections = React.useMemo(() => snapshot.collections.filter(collection => (
    visibleCompanyIds.has(collection.companyId)
    && (collectionStatus === 'all' || collection.status === collectionStatus)
  )), [collectionStatus, snapshot.collections, visibleCompanyIds])

  const visibleUpcomingLicenses = React.useMemo(() => snapshot.upcomingLicenseExpiries.filter(license => (
    (packageFilter === 'all' || license.packageId === packageFilter)
    && (visibleCompanyIds.size === 0 || visibleCompanyIds.has(license.companyId))
  )), [packageFilter, snapshot.upcomingLicenseExpiries, visibleCompanyIds])

  const visibleRiskCustomers = React.useMemo(() => snapshot.riskCustomers.filter(customer => (
    (packageFilter === 'all' || customer.packageId === packageFilter)
    && (visibleCompanyIds.size === 0 || visibleCompanyIds.has(customer.companyId))
  )), [packageFilter, snapshot.riskCustomers, visibleCompanyIds])

  const summary = React.useMemo(() => {
    const paidThisMonth = visibleInvoices.filter(invoice => invoice.status === 'Ödendi' && invoice.paidAt.slice(0, 7) === getCurrentMonthKey())
    const pendingInvoices = visibleInvoices.filter(invoice => invoice.status === 'Bekliyor')
    const overdueInvoices = visibleInvoices.filter(invoice => invoice.status === 'Gecikti')

    return {
      activeSubscriptions: visibleCollections.length,
      collectedThisMonth: sumInvoices(paidThisMonth),
      pendingCollection: sumInvoices(pendingInvoices),
      overduePaymentAmount: sumInvoices(overdueInvoices),
      overduePaymentCount: overdueInvoices.length,
      upcomingLicenseExpiryCount: visibleUpcomingLicenses.length,
      mrr: visibleCollections.reduce((sum, collection) => sum + collection.monthlyAmount, 0)
    }
  }, [visibleCollections, visibleInvoices, visibleUpcomingLicenses.length])

  const monthlyRevenue = React.useMemo(() => {
    const ratio = snapshot.summary.mrr > 0 ? summary.mrr / snapshot.summary.mrr : 0
    return snapshot.monthlyRevenue.map(item => ({
      ...item,
      amount: Math.round(item.amount * ratio)
    }))
  }, [snapshot.monthlyRevenue, snapshot.summary.mrr, summary.mrr])

  const packageRevenue = React.useMemo(() => {
    const labels = Array.from(new Set(visibleCollections.map(collection => collection.packageName)))
    return buildDistribution(labels, label => (
      visibleCollections
        .filter(collection => collection.packageName === label)
        .reduce((sum, collection) => sum + collection.monthlyAmount, 0)
    )).sort((first, second) => second.amount - first.amount)
  }, [visibleCollections])

  const collectionDistribution = React.useMemo(() => buildDistribution(BILLING_INVOICE_STATUSES, label => (
    visibleInvoices
      .filter(invoice => invoice.status === label)
      .reduce((sum, invoice) => sum + invoice.amount, 0)
  )), [visibleInvoices])

  const paymentDistribution = React.useMemo(() => buildDistribution(paymentChannels, label => (
    visibleInvoices
      .filter(invoice => invoice.paymentChannel === label)
      .reduce((sum, invoice) => sum + invoice.amount, 0)
  )), [visibleInvoices])

  const triggerPlaceholder = (label: string) => {
    setMessage(`${label} işlemi ödeme sağlayıcı entegrasyonu fazı için placeholder olarak hazırlandı.`)
  }

  const maxMonthlyRevenue = Math.max(1, ...monthlyRevenue.map(item => item.amount))
  const maxPackageRevenue = Math.max(1, ...packageRevenue.map(item => item.amount))
  const totalCollectionDistribution = collectionDistribution.reduce((sum, item) => sum + item.amount, 0)
  const totalPaymentDistribution = paymentDistribution.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="billing-management-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Fatura ve Tahsilat Takibi</h2>
          <p>Abonelik, fatura, tahsilat, lisans bitişi ve ödeme risklerini tek finans yönetim merkezinde izleyin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{formatMoney(summary.mrr)}</strong>
          <span>Toplam Aylık Gelir</span>
        </div>
      </div>

      {message && <div className="evren360-feedback">{message}</div>}

      <section className="evren360-panel billing-management-filter-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Filtreler</h3>
            <p>Tarih, paket, fatura durumu ve tahsilat durumuna göre finans görünümünü daraltın.</p>
          </div>
          <div className="billing-management-filters">
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
              <span>Fatura Durumu</span>
              <select value={invoiceStatus} onChange={event => setInvoiceStatus(event.target.value as InvoiceStatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {BILLING_INVOICE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              <span>Tahsilat Durumu</span>
              <select value={collectionStatus} onChange={event => setCollectionStatus(event.target.value as CollectionStatusFilter)}>
                <option value="all">Tüm durumlar</option>
                {BILLING_COLLECTION_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="evren360-kpi-grid billing-management-kpi-grid">
        <div className="evren360-kpi"><span>Aktif Abonelik</span><strong>{formatNumber(summary.activeSubscriptions)}</strong><p>Filtre kapsamındaki işletmeler.</p></div>
        <div className="evren360-kpi success"><span>Bu Ay Tahsil Edilen</span><strong>{formatMoney(summary.collectedThisMonth)}</strong><p>Ödenen faturalar.</p></div>
        <div className="evren360-kpi warning"><span>Bekleyen Tahsilat</span><strong>{formatMoney(summary.pendingCollection)}</strong><p>Son ödeme tarihi gelmemiş kayıtlar.</p></div>
        <div className="evren360-kpi muted"><span>Geciken Ödeme</span><strong>{formatMoney(summary.overduePaymentAmount)}</strong><p>{formatNumber(summary.overduePaymentCount)} gecikmiş fatura.</p></div>
        <div className="evren360-kpi warning"><span>Yaklaşan Lisans Bitişi</span><strong>{formatNumber(summary.upcomingLicenseExpiryCount)}</strong><p>Önümüzdeki 30 gün.</p></div>
        <div className="evren360-kpi success"><span>Toplam Aylık Gelir</span><strong>{formatMoney(summary.mrr)}</strong><p>MRR tahmini.</p></div>
      </div>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Fatura Listesi</h3>
            <p>Firma, paket, tutar ve ödeme durumları.</p>
          </div>
          <strong>{formatNumber(visibleInvoices.length)} kayıt</strong>
        </div>
        <div className="table-scroll">
          <table className="data-table billing-management-invoice-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Fatura No</th>
                <th>Paket</th>
                <th>Tutar</th>
                <th>Kesim Tarihi</th>
                <th>Son Ödeme Tarihi</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map(invoice => (
                <tr key={invoice.id}>
                  <td><strong>{invoice.companyName}</strong><span className="muted small-text">{invoice.paymentChannel || 'Tahsilat bekleniyor'}</span></td>
                  <td>{invoice.invoiceNo}</td>
                  <td>{invoice.packageName}</td>
                  <td>{formatMoney(invoice.amount)}</td>
                  <td>{formatDate(invoice.issuedAt)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td><span className={`status-pill ${getStatusClassName(invoice.status)}`}>{invoice.status}</span></td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => triggerPlaceholder('Görüntüle')}>Görüntüle</button>
                    <button className="btn" type="button" onClick={() => triggerPlaceholder('Faturayı Aç')}>Faturayı Aç</button>
                    <button className="btn" type="button" onClick={() => triggerPlaceholder('Tahsilat Geçmişi')}>Tahsilat Geçmişi</button>
                    <button className="btn" type="button" onClick={() => triggerPlaceholder('Hatırlatma Gönder')}>Hatırlatma Gönder</button>
                  </td>
                </tr>
              ))}
              {visibleInvoices.length === 0 && <tr><td className="empty-cell" colSpan={8}>Fatura kaydı bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="billing-management-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Tahsilat Takibi</h3>
              <p>Tahsil edilen, bekleyen ve sonraki ödeme bilgileri.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table billing-management-collection-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Tahsil Edilen Tutar</th>
                  <th>Bekleyen Tutar</th>
                  <th>Son Tahsilat Tarihi</th>
                  <th>Sonraki Ödeme</th>
                </tr>
              </thead>
              <tbody>
                {visibleCollections.map(collection => (
                  <tr key={collection.companyId}>
                    <td><strong>{collection.companyName}</strong><span className={`status-pill ${getStatusClassName(collection.status)}`}>{collection.status}</span></td>
                    <td>{formatMoney(collection.collectedAmount)}</td>
                    <td>{formatMoney(collection.pendingAmount)}</td>
                    <td>{formatDate(collection.lastCollectionDate)}</td>
                    <td>{formatDate(collection.nextPaymentDate)}</td>
                  </tr>
                ))}
                {visibleCollections.length === 0 && <tr><td className="empty-cell" colSpan={5}>Tahsilat kaydı bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Yaklaşan Lisans Bitişleri</h3>
              <p>Önümüzdeki 30 gün içinde bitecek lisanslar.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table billing-management-license-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Paket</th>
                  <th>Bitiş Tarihi</th>
                  <th>Kalan Gün</th>
                </tr>
              </thead>
              <tbody>
                {visibleUpcomingLicenses.map(license => (
                  <tr key={`${license.companyId}-${license.endDate}`}>
                    <td><strong>{license.companyName}</strong></td>
                    <td>{license.packageName}</td>
                    <td>{formatDate(license.endDate)}</td>
                    <td><span className="status-pill warning-pill">{formatNumber(license.remainingDays)} gün</span></td>
                  </tr>
                ))}
                {visibleUpcomingLicenses.length === 0 && <tr><td className="empty-cell" colSpan={4}>Yaklaşan lisans bitişi bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="billing-management-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Riskli Müşteriler</h3>
              <p>Ödeme gecikmesi bulunan işletmeler.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table billing-management-risk-table">
              <thead>
                <tr>
                  <th>Firma</th>
                  <th>Gecikme Süresi</th>
                  <th>Borç</th>
                  <th>Paket</th>
                </tr>
              </thead>
              <tbody>
                {visibleRiskCustomers.map(customer => (
                  <tr key={customer.companyId}>
                    <td><strong>{customer.companyName}</strong></td>
                    <td><span className="status-pill danger-pill">{formatNumber(customer.overdueDays)} gün</span></td>
                    <td>{formatMoney(customer.debt)}</td>
                    <td>{customer.packageName}</td>
                  </tr>
                ))}
                {visibleRiskCustomers.length === 0 && <tr><td className="empty-cell" colSpan={4}>Riskli müşteri bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Billing Foundation</h3>
              <p>İleride bağlanacak finans servisleri için hazırlanan katman.</p>
            </div>
          </div>
          <div className="billing-management-foundation-grid">
            {BILLING_FOUNDATION_SERVICES.map(service => (
              <div key={service}>
                <strong>{service}</strong>
                <span>Hazır</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Gelir Analizi</h3>
            <p>MRR, paket geliri, tahsilat durumu ve ödeme dağılımı.</p>
          </div>
        </div>
        <div className="billing-management-chart-grid">
          <div className="billing-management-chart-card">
            <h4>Aylık Gelir (MRR)</h4>
            <div className="billing-management-bar-list">
              {monthlyRevenue.map(item => (
                <div className="billing-management-bar-row" key={item.label}>
                  <div><strong>{item.label}</strong><span>{formatMoney(item.amount)}</span></div>
                  <div className="billing-management-bar"><span style={{ width: `${(item.amount / maxMonthlyRevenue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="billing-management-chart-card">
            <h4>Paket Bazlı Gelir</h4>
            <div className="billing-management-bar-list">
              {packageRevenue.map(item => (
                <div className="billing-management-bar-row" key={item.label}>
                  <div><strong>{item.label}</strong><span>{formatMoney(item.amount)}</span></div>
                  <div className="billing-management-bar"><span style={{ width: `${(item.amount / maxPackageRevenue) * 100}%`, background: item.color }} /></div>
                </div>
              ))}
              {packageRevenue.length === 0 && <p className="muted">Paket geliri bulunamadı.</p>}
            </div>
          </div>

          <div className="billing-management-chart-card">
            <h4>Tahsilat Durumu</h4>
            <div className="billing-management-donut-layout">
              <div className="billing-management-donut" style={{ background: buildConicGradient(collectionDistribution) }}>
                <div><strong>{formatMoney(totalCollectionDistribution)}</strong><span>toplam</span></div>
              </div>
              <div className="billing-management-legend">
                {collectionDistribution.map(item => (
                  <div key={item.label}><span style={{ background: item.color }} /><strong>{item.label}</strong><em>{formatMoney(item.amount)}</em></div>
                ))}
              </div>
            </div>
          </div>

          <div className="billing-management-chart-card">
            <h4>Ödeme Dağılımı</h4>
            <div className="billing-management-donut-layout">
              <div className="billing-management-donut" style={{ background: buildConicGradient(paymentDistribution) }}>
                <div><strong>{formatMoney(totalPaymentDistribution)}</strong><span>tahsilat</span></div>
              </div>
              <div className="billing-management-legend">
                {paymentDistribution.map(item => (
                  <div key={item.label}><span style={{ background: item.color }} /><strong>{item.label}</strong><em>{formatMoney(item.amount)}</em></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
