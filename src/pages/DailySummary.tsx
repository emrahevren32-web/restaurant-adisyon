import React from 'react'
import { ClosedBill, PaymentMethod } from '../types'
import { loadClosed } from '../storage'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY'
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('sv-SE')
}

const paymentMethods: PaymentMethod[] = ['Nakit', 'Kart', 'Diğer']

export default function DailySummary(){
  const [closed] = React.useState<ClosedBill[]>(() => loadClosed())
  const today = getLocalDateKey(new Date())
  const todays = closed.filter(bill => getLocalDateKey(bill.timestamp) === today)
  const total = todays.reduce((sum,bill)=> sum + bill.total, 0)
  const paymentTotals = paymentMethods.map(method => ({
    method,
    total: todays
      .filter(bill => (bill.paymentMethod || 'Nakit') === method)
      .reduce((sum, bill) => sum + bill.total, 0)
  }))

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
                    <td>{bill.paymentMethod || 'Nakit'}</td>
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
