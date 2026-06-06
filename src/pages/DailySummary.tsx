import React from 'react'
import { ClosedBill, PaymentMethod, User } from '../types'
import { loadClosed, loadCriticalStockEvents, loadStockItems } from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill } from '../billing'
import { formatStockQuantity, getCriticalShortage, isCriticalStock, isOutOfStock, sortCriticalStockFirst } from '../criticalStock'

type Props = {
  currentUser: User
}

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('sv-SE')
}

const paymentMethods: PaymentMethod[] = ['Nakit', 'Kart', 'Diğer']
const formatPaymentMethods = (bill: ClosedBill) => {
  const payments = getBillPayments(bill)
  if(payments.length === 0) return 'Ödeme yok'

  return payments.map(payment => `${payment.method} ${formatCurrency(payment.amount)}`).join(' + ')
}

export default function DailySummary({ currentUser }: Props){
  const [closed] = React.useState<ClosedBill[]>(() => loadClosed())
  const [stockItems] = React.useState(() => loadStockItems())
  const [criticalEvents] = React.useState(() => loadCriticalStockEvents())
  const today = getLocalDateKey(new Date())
  const todays = closed.filter(bill => isRevenueBill(bill) && getLocalDateKey(bill.timestamp) === today)
  const total = todays.reduce((sum,bill)=> sum + bill.total, 0)
  const paymentTotals = paymentMethods.map(method => ({
    method,
    total: todays
      .reduce((sum, bill) => {
        const methodTotal = getBillPayments(bill)
          .filter(payment => payment.method === method)
          .reduce((paymentSum, payment) => paymentSum + payment.amount, 0)

        return sum + methodTotal
      }, 0)
  }))
  const canSeeStockSummary = currentUser.role === 'Admin'
  const criticalStockItems = sortCriticalStockFirst(stockItems.filter(isCriticalStock))
  const outOfStockCount = stockItems.filter(isOutOfStock).length
  const todayCriticalEnteredCount = criticalEvents.filter(event => event.eventType === 'entered' && getLocalDateKey(event.timestamp) === today).length
  const todayCriticalResolvedCount = criticalEvents.filter(event => event.eventType === 'resolved' && getLocalDateKey(event.timestamp) === today).length

  return (
    <div className="summary-page">
      <div className="page-title">
        <div>
          <h2>Günlük Satışlar</h2>
          <p className="muted">{today} tarihli kapanan hesaplar ve ödeme dağılımı.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Satış</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div className="metric-card">
          <span>Kapanan Hesap</span>
          <strong>{todays.length}</strong>
        </div>
        {paymentTotals.slice(0,2).map(item => (
          <div className="metric-card" key={item.method}>
            <span>{item.method}</span>
            <strong>{formatCurrency(item.total)}</strong>
          </div>
        ))}
      </div>

      {canSeeStockSummary && (
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Kritik Stok Özeti</h3>
              <p className="muted">Aktif stok kartlarındaki kritik eşik durumları.</p>
            </div>
            <span className={`status-pill ${criticalStockItems.length > 0 ? 'danger-pill' : 'success'}`}>
              {criticalStockItems.length > 0 ? `${criticalStockItems.length} kritik` : 'Stok sağlıklı'}
            </span>
          </div>

          <div className="metric-grid report-metric-grid">
            <div className="metric-card">
              <span>Kritik Stok</span>
              <strong>{criticalStockItems.length}</strong>
              <p className="muted">Aktif kartlar</p>
            </div>
            <div className="metric-card">
              <span>Stokta Yok</span>
              <strong>{outOfStockCount}</strong>
              <p className="muted">0 veya negatif stok</p>
            </div>
            <div className="metric-card">
              <span>Bugün Kritik Oldu</span>
              <strong>{todayCriticalEnteredCount}</strong>
              <p className="muted">Durum değişimi</p>
            </div>
            <div className="metric-card">
              <span>Bugün Çıktı</span>
              <strong>{todayCriticalResolvedCount}</strong>
              <p className="muted">Kritikten çıkış</p>
            </div>
          </div>

          <div className="critical-stock-list">
            {criticalStockItems.length === 0 && <div className="empty-state">Kritik stok bulunmuyor.</div>}
            {criticalStockItems.slice(0, 5).map(item => (
              <div className="critical-stock-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Mevcut {formatStockQuantity(item.currentQty, item.unit)} / Kritik {formatStockQuantity(item.minQty, item.unit)}</span>
                </div>
                <span className="status-pill danger-pill">
                  Eksik {formatStockQuantity(getCriticalShortage(item), item.unit)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="summary-layout">
        <section className="card">
          <div className="section-header compact">
            <h3>Satış Detayı</h3>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Masa</th><th>Tutar</th><th>Ödeme</th><th>Kapatan</th><th>Saat</th></tr>
              </thead>
              <tbody>
                {todays.length === 0 && (
                  <tr><td colSpan={5} className="empty-cell">Bugün kapanan hesap bulunmuyor.</td></tr>
                )}
                {todays.map(bill=> (
                  <tr key={bill.id}>
                    <td>{bill.tableName}</td>
                    <td>{formatCurrency(bill.total)}</td>
                    <td>{formatPaymentMethods(bill)}</td>
                    <td>{bill.closedByFullName || '-'}</td>
                    <td>{new Date(bill.timestamp).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Ödeme Dağılımı</h3>
          </div>
          <div className="payment-breakdown">
            {paymentTotals.map(item => (
              <div className="payment-row" key={item.method}>
                <span>{item.method}</span>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
