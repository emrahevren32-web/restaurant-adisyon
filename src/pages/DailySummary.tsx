import React from 'react'
import { ClosedBill, PaymentMethod, User } from '../types'
import { loadClosed, loadCriticalStockEvents, loadStockExpiryLots, loadStockItems, loadStockWasteRecords, syncStockExpiryStatusEvents } from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill } from '../billing'
import { formatStockQuantity, getCriticalShortage, isCriticalStock, isOutOfStock, sortCriticalStockFirst } from '../criticalStock'
import { formatExpiryDate, formatExpiryQuantity, formatExpiryStatusLabel, getExpiryStatus, getExpiryStatusClass, getExpiryWarningDays, isExpiryTracked, sortLotsFefo } from '../expiryStock'

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
  const [expiryLots, setExpiryLots] = React.useState(() => loadStockExpiryLots())
  const [wasteRecords] = React.useState(() => loadStockWasteRecords())

  React.useEffect(() => {
    if(currentUser.role !== 'Admin') return

    syncStockExpiryStatusEvents(currentUser)
    setExpiryLots(loadStockExpiryLots())
  }, [currentUser])

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
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])
  const activeExpiryLots = React.useMemo(() => {
    return sortLotsFefo(expiryLots.filter(lot => {
      const item = stockItemMap.get(lot.stockItemId)
      return lot.remainingQty > 0 && item?.active && isExpiryTracked(item)
    }))
  }, [expiryLots, stockItemMap])
  const expiryRows = React.useMemo(() => {
    return activeExpiryLots.map(lot => {
      const item = stockItemMap.get(lot.stockItemId)
      const status = getExpiryStatus(lot, getExpiryWarningDays(item))
      return { lot, item, status }
    })
  }, [activeExpiryLots, stockItemMap])
  const expiredLots = expiryRows.filter(row => row.status === 'expired')
  const nearExpiryLots = expiryRows.filter(row => row.status === 'near_expiry')
  const unknownExpiryLots = expiryRows.filter(row => row.status === 'unknown')
  const expiryAlertRows = [...expiredLots, ...nearExpiryLots].slice(0, 5)
  const todaysWasteRecords = React.useMemo(() => {
    return wasteRecords.filter(record => record.status === 'active' && getLocalDateKey(record.occurredAt) === today)
  }, [today, wasteRecords])
  const todayWasteCost = todaysWasteRecords.reduce((sum, record) => sum + (record.estimatedTotalCost || 0), 0)
  const sktWasteCount = todaysWasteRecords.filter(record => record.reasonCategory === 'SKT Geçmesi').length
  const topWasteReason = React.useMemo(() => {
    const counts = todaysWasteRecords.reduce<Map<string, number>>((map, record) => {
      map.set(record.reasonCategory, (map.get(record.reasonCategory) || 0) + 1)
      return map
    }, new Map())

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
  }, [todaysWasteRecords])
  const wasteAlertRows = [...todaysWasteRecords]
    .sort((a, b) => (b.estimatedTotalCost || 0) - (a.estimatedTotalCost || 0))
    .slice(0, 5)

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

      {canSeeStockSummary && (
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>SKT Özeti</h3>
              <p className="muted">Lot bazlı son kullanma tarihi uyarıları.</p>
            </div>
            <span className={`status-pill ${expiredLots.length > 0 ? 'danger-pill' : nearExpiryLots.length > 0 ? 'warning-pill' : 'success'}`}>
              {expiredLots.length > 0 ? `${expiredLots.length} tarihi geçmiş` : nearExpiryLots.length > 0 ? `${nearExpiryLots.length} yaklaşıyor` : 'SKT sağlıklı'}
            </span>
          </div>

          <div className="metric-grid report-metric-grid">
            <div className="metric-card">
              <span>SKT Takipli Lot</span>
              <strong>{activeExpiryLots.length}</strong>
              <p className="muted">Kalan miktarı olan</p>
            </div>
            <div className="metric-card">
              <span>Yaklaşan SKT</span>
              <strong>{nearExpiryLots.length}</strong>
              <p className="muted">Uyarı günü içinde</p>
            </div>
            <div className="metric-card">
              <span>Tarihi Geçmiş</span>
              <strong>{expiredLots.length}</strong>
              <p className="muted">FEFO tüketimde atlanır</p>
            </div>
            <div className="metric-card">
              <span>SKT Eksik Lot</span>
              <strong>{unknownExpiryLots.length}</strong>
              <p className="muted">Tarih girilmemiş</p>
            </div>
          </div>

          <div className="critical-stock-list">
            {expiryAlertRows.length === 0 && <div className="empty-state">SKT uyarısı bulunmuyor.</div>}
            {expiryAlertRows.map(({ lot, status }) => (
              <div className="critical-stock-row expiry-stock-row" key={lot.id}>
                <div>
                  <strong>{lot.stockItemName}</strong>
                  <span>{lot.lotCode} · SKT {formatExpiryDate(lot.expiryDate)} · Kalan {formatExpiryQuantity(lot.remainingQty, lot.unit)}</span>
                </div>
                <span className={`status-pill ${getExpiryStatusClass(status)}`}>
                  {formatExpiryStatusLabel(status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {canSeeStockSummary && (
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Fire Özeti</h3>
              <p className="muted">Bugünkü aktif fire kayıtları ve tahmini maliyet etkisi.</p>
            </div>
            <span className={`status-pill ${todaysWasteRecords.length > 0 ? 'warning-pill' : 'success'}`}>
              {todaysWasteRecords.length > 0 ? `${todaysWasteRecords.length} fire` : 'Fire yok'}
            </span>
          </div>

          <div className="metric-grid report-metric-grid">
            <div className="metric-card">
              <span>Bugünkü Fire</span>
              <strong>{todaysWasteRecords.length}</strong>
              <p className="muted">Aktif kayıt</p>
            </div>
            <div className="metric-card">
              <span>Tahmini Maliyet</span>
              <strong>{formatCurrency(todayWasteCost)}</strong>
              <p className="muted">Son alış fiyatına göre</p>
            </div>
            <div className="metric-card">
              <span>En Sık Neden</span>
              <strong>{topWasteReason}</strong>
              <p className="muted">Bugün</p>
            </div>
            <div className="metric-card">
              <span>SKT Kaynaklı</span>
              <strong>{sktWasteCount}</strong>
              <p className="muted">SKT geçmesi</p>
            </div>
          </div>

          <div className="critical-stock-list">
            {wasteAlertRows.length === 0 && <div className="empty-state">Bugün fire kaydı bulunmuyor.</div>}
            {wasteAlertRows.map(record => (
              <div className="critical-stock-row expiry-stock-row" key={record.id}>
                <div>
                  <strong>{record.stockItemName}</strong>
                  <span>{record.reasonCategory} · {formatExpiryQuantity(record.qty, record.unit)} · {record.responsibleFullName || 'Sorumlu yok'}</span>
                </div>
                <span className="status-pill warning-pill">
                  {formatCurrency(record.estimatedTotalCost || 0)}
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
