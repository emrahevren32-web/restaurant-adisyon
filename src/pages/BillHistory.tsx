import React from 'react'
import { ClosedBill, PaymentMethod, Product } from '../types'
import { loadClosed, loadProducts } from '../storage'
import {
  calculateDiscountTotal,
  calculateGiftTotal,
  calculateOrderOriginalTotal,
  calculateOrderPayableTotal,
  calculateSubtotal,
  formatCurrency
} from '../billing'

type PaymentFilter = 'all' | PaymentMethod

const paymentOptions: PaymentFilter[] = ['all', 'Nakit', 'Kart', 'Diğer']

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getBillSubtotal = (bill: ClosedBill, products: Product[]) => bill.subtotal ?? calculateSubtotal(bill.orders, products)
const getBillDiscount = (bill: ClosedBill, products: Product[]) => bill.discountTotal ?? calculateDiscountTotal(bill.discount, getBillSubtotal(bill, products))

export default function BillHistory(){
  const [closed] = React.useState<ClosedBill[]>(() => loadClosed())
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [search, setSearch] = React.useState('')
  const [paymentFilter, setPaymentFilter] = React.useState<PaymentFilter>('all')

  const filteredBills = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return closed.filter(bill => {
      const matchesPayment = paymentFilter === 'all' || (bill.paymentMethod || 'Nakit') === paymentFilter
      const matchesSearch = !normalizedSearch
        || bill.tableName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (bill.closedByFullName || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (bill.note || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      return matchesPayment && matchesSearch
    })
  }, [closed, paymentFilter, search])

  const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0)
  const totalDiscount = filteredBills.reduce((sum, bill) => sum + getBillDiscount(bill, products), 0)
  const totalGift = filteredBills.reduce((sum, bill) => sum + calculateGiftTotal(bill.orders, products), 0)

  return (
    <div className="history-page">
      <div className="page-title">
        <div>
          <h2>Adisyon Geçmişi</h2>
          <p className="muted">Kapanan hesapları not, indirim, ikram ve kalem detaylarıyla inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Kapanan Adisyon</span>
          <strong>{filteredBills.length}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Ciro</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam İndirim</span>
          <strong>{formatCurrency(totalDiscount)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam İkram</span>
          <strong>{formatCurrency(totalGift)}</strong>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Geçmiş Kayıtlar</h3>
            <p className="muted">{filteredBills.length} kayıt gösteriliyor.</p>
          </div>
          <div className="history-controls">
            <input type="search" placeholder="Masa, kapatan veya not ara" value={search} onChange={e=>setSearch(e.target.value)} />
            <select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value as PaymentFilter)}>
              {paymentOptions.map(option => (
                <option key={option} value={option}>{option === 'all' ? 'Tüm ödemeler' : option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="history-list">
          {filteredBills.length === 0 && <div className="empty-state">Filtrelere uygun adisyon bulunamadı.</div>}
          {filteredBills.map(bill => {
            const subtotal = getBillSubtotal(bill, products)
            const discountTotal = getBillDiscount(bill, products)
            const giftTotal = calculateGiftTotal(bill.orders, products)

            return (
              <details className="history-card" key={bill.id}>
                <summary>
                  <span>
                    <strong>{bill.tableName}</strong>
                    <small>{formatDateTime(bill.timestamp)} · {bill.closedByFullName || 'Kapatan yok'}</small>
                  </span>
                  <span className="history-summary-values">
                    <b>{formatCurrency(bill.total)}</b>
                    <small>{bill.paymentMethod || 'Nakit'}</small>
                  </span>
                </summary>

                <div className="history-detail-grid">
                  <div>
                    <span>Ara Toplam</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  <div>
                    <span>İndirim</span>
                    <strong>{formatCurrency(discountTotal)}</strong>
                  </div>
                  <div>
                    <span>İkram</span>
                    <strong>{formatCurrency(giftTotal)}</strong>
                  </div>
                  <div>
                    <span>Ödenen</span>
                    <strong>{formatCurrency(bill.total)}</strong>
                  </div>
                </div>

                {bill.note && <div className="bill-note">Not: {bill.note}</div>}

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Ürün</th><th>Adet</th><th>Durum</th><th>Tutar</th></tr>
                    </thead>
                    <tbody>
                      {bill.orders.map(order => (
                        <tr key={order.id}>
                          <td>{order.productName || products.find(product => product.id === order.productId)?.name || 'Bilinmiyor'}</td>
                          <td>{order.qty}</td>
                          <td>{order.isGift ? 'İkram' : 'Satış'}</td>
                          <td>{formatCurrency(order.isGift ? calculateOrderOriginalTotal(order, products) : calculateOrderPayableTotal(order, products))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}
