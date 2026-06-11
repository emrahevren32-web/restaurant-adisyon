import React from 'react'
import { ClosedBill, PaymentMethod, User } from '../types'
import { loadClosed, loadCriticalStockEvents, loadStockExpiryLots, loadStockItems, loadStockWasteRecords, syncStockExpiryStatusEvents } from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill } from '../billing'
import { formatStockQuantity, getCriticalShortage, isCriticalStock, isOutOfStock, sortCriticalStockFirst } from '../criticalStock'
import { formatExpiryDate, formatExpiryQuantity, formatExpiryStatusLabel, getExpiryStatus, getExpiryStatusClass, getExpiryWarningDays, isExpiryTracked, sortLotsFefo } from '../expiryStock'

type Props = {
  currentUser: User
}

type DashboardKpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  className?: string
}

type DashboardPanelProps = {
  title: string
  description?: string
  badge?: React.ReactNode
  children: React.ReactNode
}

type DashboardSummaryRowProps = {
  title: React.ReactNode
  detail: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('sv-SE')
}

function DashboardKpiCard({ label, value, detail, className = '' }: DashboardKpiCardProps){
  return (
    <div className={`metric-card dashboard-kpi-card ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function DashboardPanel({ title, description, badge, children }: DashboardPanelProps){
  return (
    <section className="card dashboard-panel">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
          {description && <p className="muted">{description}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  )
}

function DashboardSummaryRow({ title, detail, badge, className = '' }: DashboardSummaryRowProps){
  return (
    <div className={`critical-stock-row dashboard-summary-row ${className}`}>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      {badge}
    </div>
  )
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
  const salesKpis = [
    { label: 'Toplam Satış', value: formatCurrency(total), detail: 'Bugünkü gelir' },
    { label: 'Kapanan Hesap', value: todays.length, detail: 'Bugün kapanan' },
    ...paymentTotals.slice(0, 2).map(item => ({
      label: item.method,
      value: formatCurrency(item.total),
      detail: 'Ödeme toplamı'
    }))
  ]
  const criticalKpis = [
    { label: 'Kritik Stok', value: criticalStockItems.length, detail: 'Aktif kartlar' },
    { label: 'Stokta Yok', value: outOfStockCount, detail: '0 veya negatif stok' },
    { label: 'Bugün Kritik Oldu', value: todayCriticalEnteredCount, detail: 'Durum değişimi' },
    { label: 'Bugün Çıktı', value: todayCriticalResolvedCount, detail: 'Kritikten çıkış' }
  ]
  const expiryKpis = [
    { label: 'SKT Takipli Lot', value: activeExpiryLots.length, detail: 'Kalan miktarı olan' },
    { label: 'Yaklaşan SKT', value: nearExpiryLots.length, detail: 'Uyarı günü içinde' },
    { label: 'Tarihi Geçmiş', value: expiredLots.length, detail: 'FEFO tüketimde atlanır' },
    { label: 'SKT Eksik Lot', value: unknownExpiryLots.length, detail: 'Tarih girilmemiş' }
  ]
  const wasteKpis = [
    { label: 'Bugünkü Fire', value: todaysWasteRecords.length, detail: 'Aktif kayıt' },
    { label: 'Tahmini Maliyet', value: formatCurrency(todayWasteCost), detail: 'Son alış fiyatına göre' },
    { label: 'En Sık Neden', value: topWasteReason, detail: 'Bugün' },
    { label: 'SKT Kaynaklı', value: sktWasteCount, detail: 'SKT geçmesi' }
  ]

  return (
    <div className="summary-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">{today} tarihli satış, stok, SKT ve fire özetleri.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">Bugün</span>
          <span className="dashboard-date-pill">{today}</span>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        {salesKpis.map(item => (
          <DashboardKpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
          />
        ))}
      </div>

      {canSeeStockSummary && (
        <DashboardPanel
          title="Kritik Stok Özeti"
          description="Aktif stok kartlarındaki kritik eşik durumları."
          badge={(
            <span className={`status-pill ${criticalStockItems.length > 0 ? 'danger-pill' : 'success'}`}>
              {criticalStockItems.length > 0 ? `${criticalStockItems.length} kritik` : 'Stok sağlıklı'}
            </span>
          )}
        >

          <div className="metric-grid dashboard-panel-kpi-grid">
            {criticalKpis.map(item => (
              <DashboardKpiCard
                key={item.label}
                className="compact"
                label={item.label}
                value={item.value}
                detail={item.detail}
              />
            ))}
          </div>

          <div className="critical-stock-list">
            {criticalStockItems.length === 0 && <div className="empty-state">Kritik stok bulunmuyor.</div>}
            {criticalStockItems.slice(0, 5).map(item => (
              <DashboardSummaryRow
                key={item.id}
                title={item.name}
                detail={<>Mevcut {formatStockQuantity(item.currentQty, item.unit)} / Kritik {formatStockQuantity(item.minQty, item.unit)}</>}
                badge={(
                  <span className="status-pill danger-pill">
                  Eksik {formatStockQuantity(getCriticalShortage(item), item.unit)}
                  </span>
                )}
              />
            ))}
          </div>
        </DashboardPanel>
      )}

      {canSeeStockSummary && (
        <DashboardPanel
          title="SKT Özeti"
          description="Lot bazlı son kullanma tarihi uyarıları."
          badge={(
            <span className={`status-pill ${expiredLots.length > 0 ? 'danger-pill' : nearExpiryLots.length > 0 ? 'warning-pill' : 'success'}`}>
              {expiredLots.length > 0 ? `${expiredLots.length} tarihi geçmiş` : nearExpiryLots.length > 0 ? `${nearExpiryLots.length} yaklaşıyor` : 'SKT sağlıklı'}
            </span>
          )}
        >

          <div className="metric-grid dashboard-panel-kpi-grid">
            {expiryKpis.map(item => (
              <DashboardKpiCard
                key={item.label}
                className="compact"
                label={item.label}
                value={item.value}
                detail={item.detail}
              />
            ))}
          </div>

          <div className="critical-stock-list">
            {expiryAlertRows.length === 0 && <div className="empty-state">SKT uyarısı bulunmuyor.</div>}
            {expiryAlertRows.map(({ lot, status }) => (
              <DashboardSummaryRow
                key={lot.id}
                className="expiry-stock-row"
                title={lot.stockItemName}
                detail={<>{lot.lotCode} · SKT {formatExpiryDate(lot.expiryDate)} · Kalan {formatExpiryQuantity(lot.remainingQty, lot.unit)}</>}
                badge={(
                  <span className={`status-pill ${getExpiryStatusClass(status)}`}>
                    {formatExpiryStatusLabel(status)}
                  </span>
                )}
              />
            ))}
          </div>
        </DashboardPanel>
      )}

      {canSeeStockSummary && (
        <DashboardPanel
          title="Fire Özeti"
          description="Bugünkü aktif fire kayıtları ve tahmini maliyet etkisi."
          badge={(
            <span className={`status-pill ${todaysWasteRecords.length > 0 ? 'warning-pill' : 'success'}`}>
              {todaysWasteRecords.length > 0 ? `${todaysWasteRecords.length} fire` : 'Fire yok'}
            </span>
          )}
        >

          <div className="metric-grid dashboard-panel-kpi-grid">
            {wasteKpis.map(item => (
              <DashboardKpiCard
                key={item.label}
                className="compact"
                label={item.label}
                value={item.value}
                detail={item.detail}
              />
            ))}
          </div>

          <div className="critical-stock-list">
            {wasteAlertRows.length === 0 && <div className="empty-state">Bugün fire kaydı bulunmuyor.</div>}
            {wasteAlertRows.map(record => (
              <DashboardSummaryRow
                key={record.id}
                className="expiry-stock-row"
                title={record.stockItemName}
                detail={<>{record.reasonCategory} · {formatExpiryQuantity(record.qty, record.unit)} · {record.responsibleFullName || 'Sorumlu yok'}</>}
                badge={(
                  <span className="status-pill warning-pill">
                    {formatCurrency(record.estimatedTotalCost || 0)}
                  </span>
                )}
              />
            ))}
          </div>
        </DashboardPanel>
      )}

      <div className="summary-layout">
        <DashboardPanel
          title="Satış Detayı"
          description="Bugün kapanan hesapların masa ve ödeme özeti."
        >
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
        </DashboardPanel>

        <DashboardPanel
          title="Ödeme Dağılımı"
          description="Nakit, kart ve diğer ödeme toplamları."
        >
          <div className="payment-breakdown">
            {paymentTotals.map(item => (
              <div className="payment-row" key={item.method}>
                <span>{item.method}</span>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </div>
  )
}
