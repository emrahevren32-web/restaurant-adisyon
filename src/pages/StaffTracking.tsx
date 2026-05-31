import React from 'react'
import { ActionLog, ClosedBill, Product, Role, User } from '../types'
import { loadActionLogs, loadClosed, loadProducts, loadUsers } from '../storage'
import { calculateDiscountTotal, calculateGiftTotal, calculateSubtotal, formatCurrency } from '../billing'

type PeriodFilter = 'today' | '7days' | '30days' | 'all'

type StaffMetric = {
  userId: string
  name: string
  role: Role | '-'
  openedTableCount: number
  closedBillCount: number
  totalSales: number
  totalDiscount: number
  totalGift: number
  actionCount: number
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: '7days', label: 'Son 7 Gün' },
  { value: '30days', label: 'Son 30 Gün' },
  { value: 'all', label: 'Tümü' }
]

const getStartDate = (period: PeriodFilter) => {
  if(period === 'all') return null

  const date = new Date()
  date.setHours(0, 0, 0, 0)

  if(period === '7days') date.setDate(date.getDate() - 6)
  if(period === '30days') date.setDate(date.getDate() - 29)

  return date
}

const isInPeriod = (timestamp: string, period: PeriodFilter) => {
  const startDate = getStartDate(period)
  if(!startDate) return true

  const date = new Date(timestamp)
  return date >= startDate
}

const getBillDiscount = (bill: ClosedBill, products: Product[]) => {
  const subtotal = bill.subtotal ?? calculateSubtotal(bill.orders, products)
  return bill.discountTotal ?? calculateDiscountTotal(bill.discount, subtotal)
}

const findTopStaff = (items: StaffMetric[], key: keyof Pick<StaffMetric, 'totalSales' | 'closedBillCount' | 'actionCount'>) => {
  return items.reduce<StaffMetric | null>((top, item) => {
    if(!top || item[key] > top[key]) return item
    return top
  }, null)
}

const createEmptyMetric = (userId: string, name: string, role: Role | '-'): StaffMetric => ({
  userId,
  name,
  role,
  openedTableCount: 0,
  closedBillCount: 0,
  totalSales: 0,
  totalDiscount: 0,
  totalGift: 0,
  actionCount: 0
})

export default function StaffTracking(){
  const [period, setPeriod] = React.useState<PeriodFilter>('today')
  const [users] = React.useState<User[]>(() => loadUsers())
  const [logs] = React.useState<ActionLog[]>(() => loadActionLogs())
  const [closedBills] = React.useState<ClosedBill[]>(() => loadClosed())
  const [products] = React.useState<Product[]>(() => loadProducts())

  const staffMetrics = React.useMemo(() => {
    const metrics = new Map<string, StaffMetric>()

    users.forEach(user => {
      metrics.set(user.id, createEmptyMetric(user.id, user.fullName || user.username, user.role))
    })

    logs
      .filter(log => isInPeriod(log.timestamp, period))
      .forEach(log => {
        const metric = metrics.get(log.userId) || createEmptyMetric(log.userId, log.userName, '-')
        metric.actionCount += 1
        if(log.operationType === 'Masa açıldı') metric.openedTableCount += 1
        metrics.set(log.userId, metric)
      })

    closedBills
      .filter(bill => isInPeriod(bill.timestamp, period))
      .forEach(bill => {
        const userId = bill.closedByUserId || 'unknown'
        const metric = metrics.get(userId) || createEmptyMetric(userId, bill.closedByFullName || 'Bilinmeyen Personel', '-')
        metric.closedBillCount += 1
        metric.totalSales += bill.total
        metric.totalDiscount += getBillDiscount(bill, products)
        metric.totalGift += calculateGiftTotal(bill.orders, products)
        metrics.set(userId, metric)
      })

    return Array.from(metrics.values()).sort((a, b) => {
      if(b.totalSales !== a.totalSales) return b.totalSales - a.totalSales
      if(b.closedBillCount !== a.closedBillCount) return b.closedBillCount - a.closedBillCount
      return b.actionCount - a.actionCount
    })
  }, [closedBills, logs, period, products, users])

  const topSales = findTopStaff(staffMetrics, 'totalSales')
  const topCloser = findTopStaff(staffMetrics, 'closedBillCount')
  const topAction = findTopStaff(staffMetrics, 'actionCount')

  return (
    <div className="staff-page">
      <div className="page-title">
        <div>
          <h2>Personel Takibi</h2>
          <p className="muted">Personel performansını işlem logları ve kapanan adisyonlar üzerinden takip edin.</p>
        </div>
        <select className="period-select" value={period} onChange={e=>setPeriod(e.target.value as PeriodFilter)}>
          {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>En yüksek satış</span>
          <strong>{topSales && topSales.totalSales > 0 ? topSales.name : '-'}</strong>
          <p className="muted">{topSales ? formatCurrency(topSales.totalSales) : formatCurrency(0)}</p>
        </div>
        <div className="metric-card">
          <span>En fazla hesap kapatan</span>
          <strong>{topCloser && topCloser.closedBillCount > 0 ? topCloser.name : '-'}</strong>
          <p className="muted">{topCloser?.closedBillCount || 0} hesap</p>
        </div>
        <div className="metric-card">
          <span>En fazla işlem yapan</span>
          <strong>{topAction && topAction.actionCount > 0 ? topAction.name : '-'}</strong>
          <p className="muted">{topAction?.actionCount || 0} işlem</p>
        </div>
        <div className="metric-card">
          <span>Toplam personel</span>
          <strong>{users.length}</strong>
          <p className="muted">{users.filter(user => user.active).length} aktif</p>
        </div>
      </div>

      <section className="card">
        <div className="section-header compact">
          <h3>Personel Performansı</h3>
          <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table staff-table">
            <thead>
              <tr>
                <th>Personel</th>
                <th>Rolü</th>
                <th>Açtığı Masa</th>
                <th>Kapattığı Hesap</th>
                <th>Satış</th>
                <th>İndirim</th>
                <th>İkram</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {staffMetrics.length === 0 && (
                <tr><td colSpan={8} className="empty-cell">Personel kaydı bulunamadı.</td></tr>
              )}
              {staffMetrics.map(item => (
                <tr key={item.userId}>
                  <td>
                    <strong>{item.name}</strong>
                    <div className="muted small-text">
                      Satış: {formatCurrency(item.totalSales)} · Hesap: {item.closedBillCount} · İşlem: {item.actionCount}
                    </div>
                  </td>
                  <td>{item.role}</td>
                  <td>{item.openedTableCount}</td>
                  <td>{item.closedBillCount}</td>
                  <td>{formatCurrency(item.totalSales)}</td>
                  <td>{formatCurrency(item.totalDiscount)}</td>
                  <td>{formatCurrency(item.totalGift)}</td>
                  <td>{item.actionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
