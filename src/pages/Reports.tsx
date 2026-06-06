import React from 'react'
import { ClosedBill, PaymentMethod, Product, StockItem } from '../types'
import {
  loadClosed,
  loadCriticalStockEvents,
  loadProducts,
  loadSettings,
  loadStockCategories,
  loadStockExpiryEvents,
  loadStockExpiryLots,
  loadStockItems,
  loadStockMovements
} from '../storage'
import {
  calculateDiscountTotal,
  calculateOrderOriginalTotal,
  calculateOrderPayableTotal,
  calculateSubtotal,
  formatCurrency,
  getBillPayments,
  isRevenueBill,
  roundCurrency
} from '../billing'
import { formatStockQuantity, getCriticalShortage, isCriticalStock, isOutOfStock, sortCriticalStockFirst } from '../criticalStock'
import {
  formatExpiryDate,
  formatExpiryQuantity,
  formatExpiryStatusLabel,
  getExpiryStatus,
  getExpiryStatusClass,
  getExpiryWarningDays,
  isExpiryTracked,
  sortLotsFefo
} from '../expiryStock'

type PeriodFilter = 'today' | '7days' | '30days' | 'all'
type CriticalReportStatusFilter = 'critical' | 'out' | 'healthy' | 'history' | 'all'
type CriticalReportUnitFilter = 'all' | StockItem['unit']
type ExpiryReportStatusFilter = 'alerts' | 'expired' | 'near_expiry' | 'valid' | 'unknown' | 'depleted' | 'all'

type ProductMetric = {
  productId: string
  name: string
  soldQty: number
  salesTotal: number
  giftQty: number
  giftTotal: number
  discountTotal: number
}

type StaffMetric = {
  userId: string
  name: string
  closedBillCount: number
  totalSales: number
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: '7days', label: 'Son 7 Gün' },
  { value: '30days', label: 'Son 30 Gün' },
  { value: 'all', label: 'Tümü' }
]

const paymentMethods: PaymentMethod[] = ['Nakit', 'Kart', 'Diğer']
const stockUnits: StockItem['unit'][] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']

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

  return new Date(timestamp) >= startDate
}

const getBillSubtotal = (bill: ClosedBill, products: Product[]) => {
  return bill.subtotal ?? calculateSubtotal(bill.orders, products)
}

const getBillDiscount = (bill: ClosedBill, products: Product[]) => {
  const subtotal = getBillSubtotal(bill, products)
  return bill.discountTotal ?? calculateDiscountTotal(bill.discount, subtotal)
}

const getProductName = (productId: string, fallback: string | undefined, products: Product[]) => {
  return fallback || products.find(product => product.id === productId)?.name || 'Bilinmeyen Ürün'
}

const getOrCreateProductMetric = (
  metrics: Map<string, ProductMetric>,
  productId: string,
  name: string
) => {
  const existing = metrics.get(productId)
  if(existing) return existing

  const metric: ProductMetric = {
    productId,
    name,
    soldQty: 0,
    salesTotal: 0,
    giftQty: 0,
    giftTotal: 0,
    discountTotal: 0
  }
  metrics.set(productId, metric)
  return metric
}

const getProductMetrics = (bills: ClosedBill[], products: Product[]) => {
  const metrics = new Map<string, ProductMetric>()

  bills.forEach(bill => {
    const subtotal = getBillSubtotal(bill, products)
    const discountTotal = getBillDiscount(bill, products)

    bill.orders.forEach(order => {
      const metric = getOrCreateProductMetric(
        metrics,
        order.productId,
        getProductName(order.productId, order.productName, products)
      )

      if(order.isGift){
        metric.giftQty += order.qty
        metric.giftTotal += calculateOrderOriginalTotal(order, products)
        return
      }

      const orderTotal = calculateOrderPayableTotal(order, products)
      metric.soldQty += order.qty
      metric.salesTotal += orderTotal

      if(subtotal > 0 && discountTotal > 0){
        metric.discountTotal += discountTotal * (orderTotal / subtotal)
      }
    })
  })

  return Array.from(metrics.values()).map(metric => ({
    ...metric,
    salesTotal: roundCurrency(metric.salesTotal),
    giftTotal: roundCurrency(metric.giftTotal),
    discountTotal: roundCurrency(metric.discountTotal)
  }))
}

const getPaymentTotals = (bills: ClosedBill[]) => {
  return paymentMethods.map(method => ({
    method,
    total: roundCurrency(bills.reduce((sum, bill) => {
      const methodTotal = getBillPayments(bill)
        .filter(payment => payment.method === method)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0)

      return sum + methodTotal
    }, 0))
  }))
}

const getStaffMetrics = (bills: ClosedBill[]) => {
  const metrics = new Map<string, StaffMetric>()

  bills.forEach(bill => {
    const userId = bill.closedByUserId || `unknown_${bill.closedByFullName || 'personel'}`
    const existing = metrics.get(userId)
    const metric = existing || {
      userId,
      name: bill.closedByFullName || 'Bilinmeyen Personel',
      closedBillCount: 0,
      totalSales: 0
    }

    metric.closedBillCount += 1
    metric.totalSales += bill.total
    metrics.set(userId, metric)
  })

  return Array.from(metrics.values())
    .map(metric => ({ ...metric, totalSales: roundCurrency(metric.totalSales) }))
    .sort((a, b) => {
      if(b.totalSales !== a.totalSales) return b.totalSales - a.totalSales
      return b.closedBillCount - a.closedBillCount
    })
}

const getRevenue = (bills: ClosedBill[], period: PeriodFilter) => {
  return roundCurrency(bills
    .filter(bill => isRevenueBill(bill) && isInPeriod(bill.timestamp, period))
    .reduce((sum, bill) => sum + bill.total, 0))
}

const getVatSummary = (grossTotal: number, vatRate: number) => {
  const normalizedGross = roundCurrency(Math.max(0, grossTotal))
  const normalizedRate = Math.max(0, Number(vatRate) || 0) / 100

  if(normalizedGross <= 0 || normalizedRate <= 0){
    return {
      gross: normalizedGross,
      net: normalizedGross,
      vat: 0
    }
  }

  const net = roundCurrency(normalizedGross / (1 + normalizedRate))
  return {
    gross: normalizedGross,
    net,
    vat: roundCurrency(normalizedGross - net)
  }
}

const findTopStaff = (items: StaffMetric[], key: keyof Pick<StaffMetric, 'totalSales' | 'closedBillCount'>) => {
  return items.reduce<StaffMetric | null>((top, item) => {
    if(!top || item[key] > top[key]) return item
    return top
  }, null)
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatExpiryEventType = (eventType: string) => {
  if(eventType === 'lot_created') return 'Lot oluşturuldu'
  if(eventType === 'lot_consumed') return 'Lot tüketildi'
  if(eventType === 'lot_returned') return 'Lot iade edildi'
  if(eventType === 'near_expiry') return 'Yaklaşan uyarı'
  if(eventType === 'expired') return 'Tarihi geçti'
  if(eventType === 'allocation_missing') return 'Eşleşme yok'
  return 'Lot güncellendi'
}

const getLotConsumptionPercent = (initialQty: number, remainingQty: number) => {
  if(initialQty <= 0) return 0

  const consumedQty = Math.max(0, initialQty - remainingQty)
  return Math.min(100, Math.round((consumedQty / initialQty) * 100))
}

export default function Reports(){
  const [period, setPeriod] = React.useState<PeriodFilter>('today')
  const [closedBills] = React.useState<ClosedBill[]>(() => loadClosed())
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [settings] = React.useState(() => loadSettings())
  const [stockItems] = React.useState(() => loadStockItems())
  const [stockCategories] = React.useState(() => loadStockCategories())
  const [stockMovements] = React.useState(() => loadStockMovements())
  const [criticalStockEvents] = React.useState(() => loadCriticalStockEvents())
  const [expiryLots] = React.useState(() => loadStockExpiryLots())
  const [expiryEvents] = React.useState(() => loadStockExpiryEvents())
  const [criticalStatusFilter, setCriticalStatusFilter] = React.useState<CriticalReportStatusFilter>('critical')
  const [criticalCategoryFilter, setCriticalCategoryFilter] = React.useState('all')
  const [criticalUnitFilter, setCriticalUnitFilter] = React.useState<CriticalReportUnitFilter>('all')
  const [criticalSearch, setCriticalSearch] = React.useState('')
  const [expiryStatusFilter, setExpiryStatusFilter] = React.useState<ExpiryReportStatusFilter>('alerts')
  const [expiryCategoryFilter, setExpiryCategoryFilter] = React.useState('all')
  const [expirySearch, setExpirySearch] = React.useState('')
  const [dayEndPrintedAt, setDayEndPrintedAt] = React.useState(() => new Date())
  const [isDayEndPrintActive, setIsDayEndPrintActive] = React.useState(false)

  React.useEffect(() => {
    const clearPrintMode = () => {
      document.body.classList.remove('printing')
      setIsDayEndPrintActive(false)
    }

    window.addEventListener('afterprint', clearPrintMode)
    return () => {
      window.removeEventListener('afterprint', clearPrintMode)
      document.body.classList.remove('printing')
    }
  }, [])

  const filteredBills = React.useMemo(() => {
    return closedBills.filter(bill => isRevenueBill(bill) && isInPeriod(bill.timestamp, period))
  }, [closedBills, period])
  const dayEndBills = React.useMemo(() => {
    return closedBills.filter(bill => isRevenueBill(bill) && isInPeriod(bill.timestamp, 'today'))
  }, [closedBills])

  const totalRevenue = filteredBills.reduce((sum, bill) => sum + bill.total, 0)
  const averageBill = filteredBills.length > 0 ? totalRevenue / filteredBills.length : 0
  const productMetrics = React.useMemo(() => getProductMetrics(filteredBills, products), [filteredBills, products])
  const paymentTotals = React.useMemo(() => getPaymentTotals(filteredBills), [filteredBills])
  const staffMetrics = React.useMemo(() => getStaffMetrics(filteredBills), [filteredBills])
  const dayEndProductMetrics = React.useMemo(() => getProductMetrics(dayEndBills, products), [dayEndBills, products])
  const dayEndPaymentTotals = React.useMemo(() => getPaymentTotals(dayEndBills), [dayEndBills])
  const dayEndStaffMetrics = React.useMemo(() => getStaffMetrics(dayEndBills), [dayEndBills])
  const topSeller = findTopStaff(staffMetrics, 'totalSales')
  const topCloser = findTopStaff(staffMetrics, 'closedBillCount')
  const dayEndRevenue = dayEndBills.reduce((sum, bill) => sum + bill.total, 0)
  const dayEndDiscount = dayEndBills.reduce((sum, bill) => sum + getBillDiscount(bill, products), 0)
  const dayEndGift = dayEndProductMetrics.reduce((sum, item) => sum + item.giftTotal, 0)
  const dayEndTopProduct = dayEndProductMetrics
    .filter(item => item.soldQty > 0)
    .sort((a, b) => {
      if(b.soldQty !== a.soldQty) return b.soldQty - a.soldQty
      return b.salesTotal - a.salesTotal
    })[0] || null
  const dayEndTopSeller = findTopStaff(dayEndStaffMetrics, 'totalSales')
  const dayEndTopCloser = findTopStaff(dayEndStaffMetrics, 'closedBillCount')
  const dayEndDate = dayEndPrintedAt.toLocaleDateString('tr-TR')
  const dayEndTime = dayEndPrintedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dayEndVatSummary = getVatSummary(dayEndRevenue, settings.vatRate)
  const getDayEndPaymentTotal = (method: PaymentMethod) => {
    return dayEndPaymentTotals.find(item => item.method === method)?.total || 0
  }
  const stockCategoryMap = React.useMemo(() => new Map(stockCategories.map(category => [category.id, category])), [stockCategories])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(item => [item.id, item])), [stockItems])
  const latestCriticalEventByStockId = React.useMemo(() => {
    const map = new Map<string, typeof criticalStockEvents[number]>()
    ;[...criticalStockEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .forEach(event => {
        if(!map.has(event.stockItemId)) map.set(event.stockItemId, event)
      })
    return map
  }, [criticalStockEvents])
  const latestMovementByStockId = React.useMemo(() => {
    const map = new Map<string, typeof stockMovements[number]>()
    ;[...stockMovements]
      .sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime())
      .forEach(movement => {
        if(!map.has(movement.stockItemId)) map.set(movement.stockItemId, movement)
      })
    return map
  }, [stockMovements])
  const criticalEventsInPeriod = React.useMemo(() => {
    return criticalStockEvents
      .filter(event => isInPeriod(event.timestamp, period))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [criticalStockEvents, period])
  const expiryEventsInPeriod = React.useMemo(() => {
    return expiryEvents
      .filter(event => isInPeriod(event.timestamp, period))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [expiryEvents, period])
  const currentCriticalStockItems = React.useMemo(() => sortCriticalStockFirst(stockItems.filter(isCriticalStock)), [stockItems])
  const outOfStockItems = React.useMemo(() => stockItems.filter(isOutOfStock), [stockItems])
  const expiryReportRows = React.useMemo(() => {
    const normalizedSearch = expirySearch.trim().toLocaleLowerCase('tr-TR')

    return sortLotsFefo(expiryLots).map(lot => {
      const item = stockItemMap.get(lot.stockItemId)
      const category = item ? stockCategoryMap.get(item.categoryId) : undefined
      const status = getExpiryStatus(lot, getExpiryWarningDays(item))

      return { lot, item, category, status }
    }).filter(row => {
      const matchesStatus = expiryStatusFilter === 'all'
        || (expiryStatusFilter === 'alerts' && (row.status === 'expired' || row.status === 'near_expiry'))
        || row.status === expiryStatusFilter
      const matchesCategory = expiryCategoryFilter === 'all' || row.item?.categoryId === expiryCategoryFilter
      const matchesSearch = !normalizedSearch
        || row.lot.stockItemName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || row.lot.lotCode.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (row.lot.supplierName || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (row.lot.invoiceNo || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (row.category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      return matchesStatus && matchesCategory && matchesSearch
    })
  }, [expiryCategoryFilter, expiryLots, expirySearch, expiryStatusFilter, stockCategoryMap, stockItemMap])
  const activeExpiryLots = React.useMemo(() => {
    return expiryLots.filter(lot => {
      const item = stockItemMap.get(lot.stockItemId)
      return lot.remainingQty > 0 && item?.active && isExpiryTracked(item)
    })
  }, [expiryLots, stockItemMap])
  const expiredExpiryLots = React.useMemo(() => activeExpiryLots.filter(lot => getExpiryStatus(lot, getExpiryWarningDays(stockItemMap.get(lot.stockItemId))) === 'expired'), [activeExpiryLots, stockItemMap])
  const nearExpiryLots = React.useMemo(() => activeExpiryLots.filter(lot => getExpiryStatus(lot, getExpiryWarningDays(stockItemMap.get(lot.stockItemId))) === 'near_expiry'), [activeExpiryLots, stockItemMap])
  const unknownExpiryLots = React.useMemo(() => activeExpiryLots.filter(lot => getExpiryStatus(lot, getExpiryWarningDays(stockItemMap.get(lot.stockItemId))) === 'unknown'), [activeExpiryLots, stockItemMap])
  const criticalReportRows = React.useMemo(() => {
    const normalizedSearch = criticalSearch.trim().toLocaleLowerCase('tr-TR')

    return sortCriticalStockFirst(stockItems).filter(item => {
      const category = stockCategoryMap.get(item.categoryId)
      const hasHistory = criticalStockEvents.some(event => event.stockItemId === item.id)
      const matchesStatus = criticalStatusFilter === 'all'
        || (criticalStatusFilter === 'critical' && isCriticalStock(item))
        || (criticalStatusFilter === 'out' && isOutOfStock(item))
        || (criticalStatusFilter === 'healthy' && item.active && !isCriticalStock(item))
        || (criticalStatusFilter === 'history' && hasHistory)
      const matchesCategory = criticalCategoryFilter === 'all' || item.categoryId === criticalCategoryFilter
      const matchesUnit = criticalUnitFilter === 'all' || item.unit === criticalUnitFilter
      const matchesSearch = !normalizedSearch
        || item.name.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.sku || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (item.barcode || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || (category?.name || '').toLocaleLowerCase('tr-TR').includes(normalizedSearch)

      return matchesStatus && matchesCategory && matchesUnit && matchesSearch
    })
  }, [criticalCategoryFilter, criticalSearch, criticalStatusFilter, criticalStockEvents, criticalUnitFilter, stockCategoryMap, stockItems])

  const printDayEnd = () => {
    setDayEndPrintedAt(new Date())
    setIsDayEndPrintActive(true)
    document.body.classList.add('printing')
    window.setTimeout(() => window.print(), 50)
  }

  const topSellingProducts = productMetrics
    .filter(item => item.soldQty > 0)
    .sort((a, b) => {
      if(b.soldQty !== a.soldQty) return b.soldQty - a.soldQty
      return b.salesTotal - a.salesTotal
    })
    .slice(0, 10)

  const topGiftProducts = productMetrics
    .filter(item => item.giftQty > 0)
    .sort((a, b) => {
      if(b.giftQty !== a.giftQty) return b.giftQty - a.giftQty
      return b.giftTotal - a.giftTotal
    })
    .slice(0, 10)

  const topDiscountedProducts = productMetrics
    .filter(item => item.discountTotal > 0)
    .sort((a, b) => b.discountTotal - a.discountTotal)
    .slice(0, 10)

  return (
    <div className="reports-page">
      <div className="page-title">
        <div>
          <h2>Raporlama</h2>
          <p className="muted">Ciro, ürün, ödeme ve personel performansını adisyon geçmişinden hesaplayın.</p>
        </div>
        <select className="period-select" value={period} onChange={e=>setPeriod(e.target.value as PeriodFilter)}>
          {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="metric-grid report-metric-grid">
        <div className="metric-card">
          <span>Günlük Ciro</span>
          <strong>{formatCurrency(getRevenue(closedBills, 'today'))}</strong>
          <p className="muted">Bugün</p>
        </div>
        <div className="metric-card">
          <span>Haftalık Ciro</span>
          <strong>{formatCurrency(getRevenue(closedBills, '7days'))}</strong>
          <p className="muted">Son 7 gün</p>
        </div>
        <div className="metric-card">
          <span>Aylık Ciro</span>
          <strong>{formatCurrency(getRevenue(closedBills, '30days'))}</strong>
          <p className="muted">Son 30 gün</p>
        </div>
        <div className="metric-card">
          <span>Toplam Ciro</span>
          <strong>{formatCurrency(getRevenue(closedBills, 'all'))}</strong>
          <p className="muted">Tüm zamanlar</p>
        </div>
        <div className="metric-card">
          <span>Toplam Adisyon</span>
          <strong>{filteredBills.length}</strong>
          <p className="muted">{periodOptions.find(option => option.value === period)?.label}</p>
        </div>
        <div className="metric-card">
          <span>Ortalama Adisyon Tutarı</span>
          <strong>{formatCurrency(averageBill)}</strong>
          <p className="muted">{periodOptions.find(option => option.value === period)?.label}</p>
        </div>
      </div>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Gün Sonu Raporu</h3>
            <p className="muted">Bugünün kapanan adisyonlarından hesaplanır.</p>
          </div>
          <button className="btn" type="button" onClick={printDayEnd}>Gün Sonu Yazdır</button>
        </div>
        <div className="metric-grid report-metric-grid">
          <div className="metric-card">
            <span>Toplam Satış</span>
            <strong>{formatCurrency(dayEndVatSummary.gross)}</strong>
            <p className="muted">KDV dahil satış tutarı</p>
          </div>
          <div className="metric-card">
            <span>KDV Hariç Satış</span>
            <strong>{formatCurrency(dayEndVatSummary.net)}</strong>
            <p className="muted">%{settings.vatRate} KDV oranı ile</p>
          </div>
          <div className="metric-card">
            <span>KDV Tutarı</span>
            <strong>{formatCurrency(dayEndVatSummary.vat)}</strong>
            <p className="muted">Toplam satıştan ayrıştırıldı</p>
          </div>
          <div className="metric-card">
            <span>Toplam İndirim</span>
            <strong>{formatCurrency(dayEndDiscount)}</strong>
            <p className="muted">Bugün</p>
          </div>
          <div className="metric-card">
            <span>Toplam İkram</span>
            <strong>{formatCurrency(dayEndGift)}</strong>
            <p className="muted">Bugün</p>
          </div>
          <div className="metric-card">
            <span>En Çok Satan Ürün</span>
            <strong>{dayEndTopProduct ? dayEndTopProduct.name : '-'}</strong>
            <p className="muted">{dayEndTopProduct ? `${dayEndTopProduct.soldQty} adet` : 'Satış yok'}</p>
          </div>
          <div className="metric-card">
            <span>En Çok Satış Yapan Personel</span>
            <strong>{dayEndTopSeller && dayEndTopSeller.totalSales > 0 ? dayEndTopSeller.name : '-'}</strong>
            <p className="muted">{dayEndTopSeller ? formatCurrency(dayEndTopSeller.totalSales) : formatCurrency(0)}</p>
          </div>
          <div className="metric-card">
            <span>En Çok Hesap Kapatan Personel</span>
            <strong>{dayEndTopCloser && dayEndTopCloser.closedBillCount > 0 ? dayEndTopCloser.name : '-'}</strong>
            <p className="muted">{dayEndTopCloser?.closedBillCount || 0} adisyon</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header compact">
          <h3>Ürün Raporları</h3>
          <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
        </div>
        <div className="report-panel-grid three">
          <div className="report-panel">
            <h4>En Çok Satan 10 Ürün</h4>
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr><th>Ürün</th><th>Adet</th><th>Ciro</th></tr>
                </thead>
                <tbody>
                  {topSellingProducts.length === 0 && <tr><td colSpan={3} className="empty-cell">Satış kaydı yok.</td></tr>}
                  {topSellingProducts.map(item => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{item.soldQty}</td>
                      <td>{formatCurrency(item.salesTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-panel">
            <h4>En Çok İkram Edilen Ürünler</h4>
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr><th>Ürün</th><th>Adet</th><th>Değer</th></tr>
                </thead>
                <tbody>
                  {topGiftProducts.length === 0 && <tr><td colSpan={3} className="empty-cell">İkram kaydı yok.</td></tr>}
                  {topGiftProducts.map(item => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{item.giftQty}</td>
                      <td>{formatCurrency(item.giftTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-panel">
            <h4>En Çok İndirim Uygulanan Ürünler</h4>
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr><th>Ürün</th><th>Satış</th><th>İndirim</th></tr>
                </thead>
                <tbody>
                  {topDiscountedProducts.length === 0 && <tr><td colSpan={3} className="empty-cell">İndirim kaydı yok.</td></tr>}
                  {topDiscountedProducts.map(item => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{item.soldQty}</td>
                      <td>{formatCurrency(item.discountTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Stok Raporları</h3>
            <p className="muted">Kritik stok, stokta yok ve kritik stok olaylarını takip edin.</p>
          </div>
          <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
        </div>

        <div className="metric-grid report-metric-grid">
          <div className="metric-card">
            <span>Kritik Stok</span>
            <strong>{currentCriticalStockItems.length}</strong>
            <p className="muted">Anlık aktif kart</p>
          </div>
          <div className="metric-card">
            <span>Stokta Yok</span>
            <strong>{outOfStockItems.length}</strong>
            <p className="muted">0 veya negatif stok</p>
          </div>
          <div className="metric-card">
            <span>Dönem Kritik Olayı</span>
            <strong>{criticalEventsInPeriod.filter(event => event.eventType === 'entered').length}</strong>
            <p className="muted">Kritik seviyeye düşen</p>
          </div>
          <div className="metric-card">
            <span>Dönem Çıkış Olayı</span>
            <strong>{criticalEventsInPeriod.filter(event => event.eventType === 'resolved').length}</strong>
            <p className="muted">Kritikten çıkan</p>
          </div>
        </div>

        <div className="stock-report-filters">
          <input type="search" placeholder="Stok, kod, barkod veya kategori ara" value={criticalSearch} onChange={event => setCriticalSearch(event.target.value)} />
          <select value={criticalStatusFilter} onChange={event => setCriticalStatusFilter(event.target.value as CriticalReportStatusFilter)}>
            <option value="critical">Kritik stok</option>
            <option value="out">Stokta yok</option>
            <option value="healthy">Sağlıklı stok</option>
            <option value="history">Kritik geçmişi olanlar</option>
            <option value="all">Tüm stoklar</option>
          </select>
          <select value={criticalCategoryFilter} onChange={event => setCriticalCategoryFilter(event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {stockCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={criticalUnitFilter} onChange={event => setCriticalUnitFilter(event.target.value as CriticalReportUnitFilter)}>
            <option value="all">Tüm birimler</option>
            {stockUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>

        <div className="report-layout stock-report-layout">
          <div className="table-wrap">
            <table className="data-table report-table">
              <thead>
                <tr>
                  <th>Stok Kartı</th>
                  <th>Kategori</th>
                  <th>Mevcut</th>
                  <th>Kritik</th>
                  <th>Eksik</th>
                  <th>Durum</th>
                  <th>Son Hareket</th>
                  <th>Son Kritik Olay</th>
                </tr>
              </thead>
              <tbody>
                {criticalReportRows.length === 0 && <tr><td colSpan={8} className="empty-cell">Filtrelere uygun stok kaydı yok.</td></tr>}
                {criticalReportRows.map(item => {
                  const category = stockCategoryMap.get(item.categoryId)
                  const critical = isCriticalStock(item)
                  const latestEvent = latestCriticalEventByStockId.get(item.id)
                  const latestMovement = latestMovementByStockId.get(item.id)

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {(item.sku || item.barcode) && <div className="muted small-text">{[item.sku && `Kod: ${item.sku}`, item.barcode && `Barkod: ${item.barcode}`].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td>{category?.name || 'Kategori yok'}</td>
                      <td>{formatStockQuantity(item.currentQty, item.unit)}</td>
                      <td>{formatStockQuantity(item.minQty, item.unit)}</td>
                      <td>{critical ? formatStockQuantity(getCriticalShortage(item), item.unit) : '-'}</td>
                      <td>
                        {!item.active ? (
                          <span className="status-pill muted-pill">Pasif</span>
                        ) : critical ? (
                          <span className="status-pill danger-pill">Kritik</span>
                        ) : (
                          <span className="status-pill success">Sağlıklı</span>
                        )}
                      </td>
                      <td>{latestMovement ? `${latestMovement.type} · ${formatDateTime(latestMovement.movementDate)}` : '-'}</td>
                      <td>{latestEvent ? `${latestEvent.eventType === 'entered' ? 'Kritik oldu' : 'Çıktı'} · ${formatDateTime(latestEvent.timestamp)}` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="report-panel">
            <h4>Kritik Stok Olayları</h4>
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr><th>Tarih</th><th>Stok</th><th>Olay</th><th>Stok</th></tr>
                </thead>
                <tbody>
                  {criticalEventsInPeriod.length === 0 && <tr><td colSpan={4} className="empty-cell">Bu dönem kritik stok olayı yok.</td></tr>}
                  {criticalEventsInPeriod.slice(0, 12).map(event => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.timestamp)}</td>
                      <td>{event.stockItemName}</td>
                      <td>
                        <span className={`status-pill ${event.eventType === 'entered' ? 'danger-pill' : 'success'}`}>
                          {event.eventType === 'entered' ? 'Kritik oldu' : 'Çıktı'}
                        </span>
                        <div className="muted small-text">{event.trigger}</div>
                      </td>
                      <td>{formatStockQuantity(event.previousQty, event.unit)} → {formatStockQuantity(event.nextQty, event.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>SKT Raporu</h3>
            <p className="muted">Lot, parti ve son kullanma tarihi durumlarını izleyin.</p>
          </div>
          <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
        </div>

        <div className="metric-grid report-metric-grid">
          <div className="metric-card">
            <span>Aktif SKT Lotu</span>
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
            <strong>{expiredExpiryLots.length}</strong>
            <p className="muted">FEFO tüketimde atlanır</p>
          </div>
          <div className="metric-card">
            <span>SKT Eksik</span>
            <strong>{unknownExpiryLots.length}</strong>
            <p className="muted">Tarih girilmemiş lot</p>
          </div>
        </div>

        <div className="stock-report-filters expiry-report-filters">
          <input type="search" placeholder="Stok, lot, tedarikçi, fatura veya kategori ara" value={expirySearch} onChange={event => setExpirySearch(event.target.value)} />
          <select value={expiryStatusFilter} onChange={event => setExpiryStatusFilter(event.target.value as ExpiryReportStatusFilter)}>
            <option value="alerts">SKT uyarıları</option>
            <option value="expired">Tarihi geçmiş</option>
            <option value="near_expiry">Yaklaşan SKT</option>
            <option value="valid">Geçerli lotlar</option>
            <option value="unknown">SKT girilmemiş</option>
            <option value="depleted">Tükenmiş lotlar</option>
            <option value="all">Tüm lotlar</option>
          </select>
          <select value={expiryCategoryFilter} onChange={event => setExpiryCategoryFilter(event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {stockCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>

        <div className="report-layout stock-report-layout">
          <div className="table-wrap">
            <table className="data-table report-table">
              <thead>
                <tr>
                  <th>Stok</th>
                  <th>Lot No</th>
                  <th>Kategori</th>
                  <th>SKT</th>
                  <th>İlk Miktar</th>
                  <th>Kalan Miktar</th>
                  <th>Tüketim Yüzdesi</th>
                  <th>Durum</th>
                  <th>Giriş Bilgisi</th>
                </tr>
              </thead>
              <tbody>
                {expiryReportRows.length === 0 && <tr><td colSpan={9} className="empty-cell">Filtrelere uygun SKT lotu yok.</td></tr>}
                {expiryReportRows.map(({ lot, category, status }) => (
                  <tr key={lot.id}>
                    <td>
                      <strong>{lot.stockItemName}</strong>
                    </td>
                    <td>{lot.lotCode}</td>
                    <td>{category?.name || 'Kategori yok'}</td>
                    <td>{formatExpiryDate(lot.expiryDate)}</td>
                    <td>{formatExpiryQuantity(lot.initialQty, lot.unit)}</td>
                    <td>{formatExpiryQuantity(lot.remainingQty, lot.unit)}</td>
                    <td>
                      <strong>%{getLotConsumptionPercent(lot.initialQty, lot.remainingQty)}</strong>
                      <div className="lot-consumption-bar" aria-label="Tüketim yüzdesi">
                        <span style={{ width: `${getLotConsumptionPercent(lot.initialQty, lot.remainingQty)}%` }} />
                      </div>
                    </td>
                    <td><span className={`status-pill ${getExpiryStatusClass(status)}`}>{formatExpiryStatusLabel(status)}</span></td>
                    <td>
                      <strong>{formatDateTime(lot.receivedAt)}</strong>
                      <div className="muted small-text">{[lot.supplierName && `Tedarikçi: ${lot.supplierName}`, lot.invoiceNo && `Fatura: ${lot.invoiceNo}`].filter(Boolean).join(' · ') || '-'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-panel">
            <h4>SKT Olayları</h4>
            <div className="table-wrap">
              <table className="data-table report-table">
                <thead>
                  <tr><th>Tarih</th><th>Stok</th><th>Olay</th><th>Lot</th></tr>
                </thead>
                <tbody>
                  {expiryEventsInPeriod.length === 0 && <tr><td colSpan={4} className="empty-cell">Bu dönem SKT olayı yok.</td></tr>}
                  {expiryEventsInPeriod.slice(0, 12).map(event => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.timestamp)}</td>
                      <td>{event.stockItemName}</td>
                      <td>
                        <span className={`status-pill ${event.eventType === 'expired' || event.eventType === 'allocation_missing' ? 'danger-pill' : event.eventType === 'near_expiry' ? 'warning-pill' : 'success'}`}>
                          {formatExpiryEventType(event.eventType)}
                        </span>
                        <div className="muted small-text">{event.trigger}</div>
                      </td>
                      <td>
                        <strong>{event.lotCode || '-'}</strong>
                        <div className="muted small-text">{event.qty !== undefined ? formatExpiryQuantity(event.qty, event.unit) : '-'} · {formatExpiryDate(event.expiryDate)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <div className="report-layout">
        <section className="card">
          <div className="section-header compact">
            <h3>Ödeme Raporları</h3>
            <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
          </div>
          <div className="payment-breakdown">
            {paymentTotals.map(item => (
              <div className="payment-row" key={item.method}>
                <span>{item.method} toplamı</span>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Personel Raporları</h3>
            <span className="status-pill">{periodOptions.find(option => option.value === period)?.label}</span>
          </div>
          <div className="report-highlight-grid">
            <div className="report-highlight">
              <span>En çok satış yapan personel</span>
              <strong>{topSeller && topSeller.totalSales > 0 ? topSeller.name : '-'}</strong>
              <small>{topSeller ? formatCurrency(topSeller.totalSales) : formatCurrency(0)}</small>
            </div>
            <div className="report-highlight">
              <span>En çok hesap kapatan personel</span>
              <strong>{topCloser && topCloser.closedBillCount > 0 ? topCloser.name : '-'}</strong>
              <small>{topCloser?.closedBillCount || 0} adisyon</small>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table report-table">
              <thead>
                <tr><th>Personel</th><th>Satış</th><th>Kapattığı Hesap</th></tr>
              </thead>
              <tbody>
                {staffMetrics.length === 0 && <tr><td colSpan={3} className="empty-cell">Personel satış kaydı yok.</td></tr>}
                {staffMetrics.map(item => (
                  <tr key={item.userId}>
                    <td>{item.name}</td>
                    <td>{formatCurrency(item.totalSales)}</td>
                    <td>{item.closedBillCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className={`print-only ${isDayEndPrintActive ? 'print-active' : ''}`}>
        <div className="print-document">
          <div className="print-header">
            <h2>{settings.restaurantName}</h2>
            <p>Gün Sonu Raporu</p>
          </div>
          <div className="print-meta-grid">
            <div>
              <span>Tarih</span>
              <strong>{dayEndDate}</strong>
            </div>
            <div>
              <span>Saat</span>
              <strong>{dayEndTime}</strong>
            </div>
          </div>
          <div className="print-summary-list">
            <div><span>Toplam Satış</span><strong>{formatCurrency(dayEndVatSummary.gross)}</strong></div>
            <div><span>KDV Hariç Satış</span><strong>{formatCurrency(dayEndVatSummary.net)}</strong></div>
            <div><span>KDV Tutarı (%{settings.vatRate})</span><strong>{formatCurrency(dayEndVatSummary.vat)}</strong></div>
            <div><span>Toplam Adisyon</span><strong>{dayEndBills.length}</strong></div>
            <div><span>Nakit Toplamı</span><strong>{formatCurrency(getDayEndPaymentTotal('Nakit'))}</strong></div>
            <div><span>Kart Toplamı</span><strong>{formatCurrency(getDayEndPaymentTotal('Kart'))}</strong></div>
            <div><span>Diğer Ödeme Toplamı</span><strong>{formatCurrency(getDayEndPaymentTotal('Diğer'))}</strong></div>
            <div><span>Toplam İndirim</span><strong>{formatCurrency(dayEndDiscount)}</strong></div>
            <div><span>Toplam İkram</span><strong>{formatCurrency(dayEndGift)}</strong></div>
            <div><span>En Çok Satan Ürün</span><strong>{dayEndTopProduct ? `${dayEndTopProduct.name} (${dayEndTopProduct.soldQty} adet)` : '-'}</strong></div>
            <div><span>En Çok Satış Yapan Personel</span><strong>{dayEndTopSeller && dayEndTopSeller.totalSales > 0 ? dayEndTopSeller.name : '-'}</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}
