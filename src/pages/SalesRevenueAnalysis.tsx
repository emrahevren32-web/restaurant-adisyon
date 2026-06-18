import React from 'react'
import {
  CashTransaction,
  ClosedBill,
  CollectionTransaction,
  Order,
  PaymentMethod,
  Product,
  TableState
} from '../types'
import {
  loadCashTransactions,
  loadClosed,
  loadCollectionTransactions,
  loadProducts,
  loadTables
} from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill, roundCurrency } from '../billing'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'
type PaymentAnalysisKey = 'cash' | 'card' | 'split' | 'credit'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type DailyRevenueRow = {
  date: string
  billCount: number
  orderCount: number
  revenue: number
}

type HourlyRevenueRow = {
  hour: number
  label: string
  billCount: number
  orderCount: number
  revenue: number
}

type PaymentAnalysisRow = {
  key: PaymentAnalysisKey
  label: string
  count: number
  total: number
  percent: number
}

type TableAnalysisRow = {
  tableId: string
  tableName: string
  revenue: number
  orderCount: number
  billCount: number
}

type TrendRow = {
  title: string
  currentLabel: string
  previousLabel: string
  currentRevenue: number
  previousRevenue: number
  changePercent: number
}

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getWeekStart = (today: Date) => {
  const date = new Date(today)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return getLocalDateKey(date)
}

const getMonthStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
}

const getYearStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), 0, 1))
}

const addDays = (dateKey: string, dayCount: number) => {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + dayCount)
  return getLocalDateKey(date)
}

const getDaysBetween = (startDate: string, endDate: string) => {
  if(!startDate || !endDate) return 0

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
}

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const getRangeDates = ({
  mode,
  customStartDate,
  customEndDate,
  today
}: {
  mode: DateRangeMode
  customStartDate: string
  customEndDate: string
  today: Date
}) => {
  const todayKey = getLocalDateKey(today)

  if(mode === 'today'){
    return {
      startDate: todayKey,
      endDate: todayKey,
      label: 'Bugün'
    }
  }

  if(mode === 'week'){
    return {
      startDate: getWeekStart(today),
      endDate: todayKey,
      label: 'Bu hafta'
    }
  }

  if(mode === 'month'){
    return {
      startDate: getMonthStart(today),
      endDate: todayKey,
      label: 'Bu ay'
    }
  }

  if(mode === 'year'){
    return {
      startDate: getYearStart(today),
      endDate: todayKey,
      label: 'Bu yıl'
    }
  }

  return {
    startDate: customStartDate,
    endDate: customEndDate,
    label: customStartDate || customEndDate ? 'Özel tarih aralığı' : 'Özel tarih'
  }
}

const sumMoney = (values: number[]) => roundCurrency(values.reduce((sum, value) => sum + value, 0))
const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const countOrders = (orders: Order[]) => {
  return orders.reduce((sum, order) => sum + Math.max(0, Number(order.qty) || 0), 0)
}

const getBillDateKey = (bill: ClosedBill) => getLocalDateKey(bill.timestamp)

const getBillHour = (bill: ClosedBill) => {
  const date = new Date(bill.timestamp)
  return Number.isNaN(date.getTime()) ? 0 : date.getHours()
}

const getRangeBills = (bills: ClosedBill[], startDate: string, endDate: string) => {
  return bills.filter(bill => isDateInRange(getBillDateKey(bill), startDate, endDate))
}

const getRangeCollections = (collections: CollectionTransaction[], startDate: string, endDate: string) => {
  return collections.filter(collection => isDateInRange(collection.date, startDate, endDate))
}

const getRangeCashIncome = (transactions: CashTransaction[], startDate: string, endDate: string) => {
  return transactions.filter(transaction => {
    return transaction.type === 'Gelir' && isDateInRange(transaction.date, startDate, endDate)
  })
}

const getRevenue = (bills: ClosedBill[]) => sumMoney(bills.map(bill => bill.total))

const getAverageBill = (bills: ClosedBill[]) => {
  return bills.length > 0 ? roundCurrency(getRevenue(bills) / bills.length) : 0
}

const getPreviousRange = (startDate: string, endDate: string) => {
  const dayCount = getDaysBetween(startDate, endDate)
  if(dayCount <= 0) return { startDate: '', endDate: '' }

  const previousEndDate = addDays(startDate, -1)
  return {
    startDate: addDays(previousEndDate, -(dayCount - 1)),
    endDate: previousEndDate
  }
}

const getMonthToDatePreviousRange = (today: Date) => {
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate()
  const previousEndDay = Math.min(today.getDate(), previousMonthLastDay)
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth() - 1, previousEndDay)

  return {
    startDate: getLocalDateKey(previousMonthStart),
    endDate: getLocalDateKey(previousMonthEnd)
  }
}

const getTrendPercent = (currentRevenue: number, previousRevenue: number) => {
  if(previousRevenue === 0) return currentRevenue > 0 ? 100 : 0
  return Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
}

const formatTrend = (value: number) => {
  if(value > 0) return `+%${formatNumber(value)}`
  if(value < 0) return `-%${formatNumber(Math.abs(value))}`
  return '%0'
}

const getTrendClass = (value: number) => {
  if(value > 0) return 'success'
  if(value < 0) return 'danger-pill'
  return 'muted-pill'
}

const buildDailyRows = (bills: ClosedBill[], startDate: string, endDate: string): DailyRevenueRow[] => {
  const groupedRows = bills.reduce<Map<string, DailyRevenueRow>>((map, bill) => {
    const date = getBillDateKey(bill)
    const current = map.get(date) || {
      date,
      billCount: 0,
      orderCount: 0,
      revenue: 0
    }

    current.billCount += 1
    current.orderCount += countOrders(bill.orders)
    current.revenue = roundCurrency(current.revenue + bill.total)
    map.set(date, current)
    return map
  }, new Map())

  const dayCount = getDaysBetween(startDate, endDate)
  if(startDate && endDate && dayCount > 0 && dayCount <= 366){
    const rows: DailyRevenueRow[] = []
    for(let index = 0; index < dayCount; index += 1){
      const date = addDays(startDate, index)
      rows.push(groupedRows.get(date) || {
        date,
        billCount: 0,
        orderCount: 0,
        revenue: 0
      })
    }

    return rows.sort((first, second) => second.date.localeCompare(first.date))
  }

  return Array.from(groupedRows.values()).sort((first, second) => second.date.localeCompare(first.date))
}

const buildHourlyRows = (bills: ClosedBill[]): HourlyRevenueRow[] => {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59`,
    billCount: 0,
    orderCount: 0,
    revenue: 0
  }))

  bills.forEach(bill => {
    const row = rows[getBillHour(bill)]
    row.billCount += 1
    row.orderCount += countOrders(bill.orders)
    row.revenue = roundCurrency(row.revenue + bill.total)
  })

  return rows
}

const isSplitPaymentBill = (bill: ClosedBill) => {
  return bill.splitPayment === true || getBillPayments(bill).length > 1
}

const getPaymentCategory = (bill: ClosedBill): PaymentAnalysisKey => {
  if(isSplitPaymentBill(bill)) return 'split'

  const method = getBillPayments(bill)[0]?.method || bill.paymentMethod || 'Nakit'
  if(method === 'Kart') return 'card'
  if(method === 'Nakit') return 'cash'
  return 'credit'
}

const applyPaymentAmount = (rows: Map<PaymentAnalysisKey, PaymentAnalysisRow>, key: PaymentAnalysisKey, total: number) => {
  const row = rows.get(key)
  if(!row) return

  row.count += 1
  row.total = roundCurrency(row.total + total)
}

const buildPaymentRows = ({
  bills,
  collections,
  cashIncome
}: {
  bills: ClosedBill[]
  collections: CollectionTransaction[]
  cashIncome: CashTransaction[]
}): PaymentAnalysisRow[] => {
  const rows = new Map<PaymentAnalysisKey, PaymentAnalysisRow>([
    ['cash', { key: 'cash', label: 'Nakit', count: 0, total: 0, percent: 0 }],
    ['card', { key: 'card', label: 'Kart', count: 0, total: 0, percent: 0 }],
    ['split', { key: 'split', label: 'Parçalı Ödeme', count: 0, total: 0, percent: 0 }],
    ['credit', { key: 'credit', label: 'Veresiye', count: 0, total: 0, percent: 0 }]
  ])

  bills.forEach(bill => {
    applyPaymentAmount(rows, getPaymentCategory(bill), bill.total)
  })

  cashIncome.forEach(transaction => {
    if(transaction.paymentMethod === 'Nakit') applyPaymentAmount(rows, 'cash', transaction.amount)
    if(transaction.paymentMethod === 'Kart') applyPaymentAmount(rows, 'card', transaction.amount)
  })

  collections.forEach(collection => {
    applyPaymentAmount(rows, 'credit', collection.amount)
  })

  const total = sumMoney(Array.from(rows.values()).map(row => row.total))

  return Array.from(rows.values()).map(row => ({
    ...row,
    percent: total > 0 ? Math.round((row.total / total) * 100) : 0
  }))
}

const buildTableRows = (tables: TableState[], bills: ClosedBill[]): TableAnalysisRow[] => {
  const rows = new Map<string, TableAnalysisRow>()

  tables.forEach(table => {
    rows.set(table.id, {
      tableId: table.id,
      tableName: table.name,
      revenue: 0,
      orderCount: 0,
      billCount: 0
    })
  })

  bills.forEach(bill => {
    const row = rows.get(bill.tableId) || {
      tableId: bill.tableId,
      tableName: bill.tableName,
      revenue: 0,
      orderCount: 0,
      billCount: 0
    }

    row.revenue = roundCurrency(row.revenue + bill.total)
    row.orderCount += countOrders(bill.orders)
    row.billCount += 1
    rows.set(bill.tableId, row)
  })

  return Array.from(rows.values()).sort((first, second) => first.tableName.localeCompare(second.tableName, 'tr-TR'))
}

const getTopRow = <T,>(rows: T[], getValue: (row: T) => number, getName: (row: T) => string) => {
  return [...rows].sort((first, second) => {
    const diff = getValue(second) - getValue(first)
    if(diff !== 0) return diff
    return getName(first).localeCompare(getName(second), 'tr-TR')
  })[0]
}

const getLeastUsedTable = (rows: TableAnalysisRow[]) => {
  return [...rows].sort((first, second) => {
    const billDiff = first.billCount - second.billCount
    if(billDiff !== 0) return billDiff
    const orderDiff = first.orderCount - second.orderCount
    if(orderDiff !== 0) return orderDiff
    const revenueDiff = first.revenue - second.revenue
    if(revenueDiff !== 0) return revenueDiff
    return first.tableName.localeCompare(second.tableName, 'tr-TR')
  })[0]
}

const getRowName = (row?: TableAnalysisRow) => row?.tableName || '-'

const getProductVariantCount = (bills: ClosedBill[], productMap: Map<string, Product>) => {
  const productIds = new Set<string>()

  bills.forEach(bill => {
    bill.orders.forEach(order => {
      if(productMap.has(order.productId)) productIds.add(order.productId)
    })
  })

  return productIds.size
}

function KpiCard({ label, value, detail, compact = false }: KpiCardProps){
  return (
    <div className={`metric-card dashboard-kpi-card ${compact ? 'compact compact-metric-card' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

export default function SalesRevenueAnalysis(){
  const [closedBills] = React.useState<ClosedBill[]>(() => loadClosed())
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [tables] = React.useState<TableState[]>(() => loadTables())
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const weekStart = React.useMemo(() => getWeekStart(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const yearStart = React.useMemo(() => getYearStart(today), [today])
  const productMap = React.useMemo(() => new Map(products.map(product => [product.id, product])), [products])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])

  const revenueBills = React.useMemo(() => closedBills.filter(isRevenueBill), [closedBills])
  const filteredBills = React.useMemo(() => getRangeBills(revenueBills, range.startDate, range.endDate), [range.endDate, range.startDate, revenueBills])
  const filteredCollections = React.useMemo(() => getRangeCollections(collections, range.startDate, range.endDate), [collections, range.endDate, range.startDate])
  const filteredCashIncome = React.useMemo(() => getRangeCashIncome(cashTransactions, range.startDate, range.endDate), [cashTransactions, range.endDate, range.startDate])

  const todayBills = getRangeBills(revenueBills, todayKey, todayKey)
  const weekBills = getRangeBills(revenueBills, weekStart, todayKey)
  const monthBills = getRangeBills(revenueBills, monthStart, todayKey)
  const last30Start = addDays(todayKey, -29)
  const last30Bills = getRangeBills(revenueBills, last30Start, todayKey)

  const filteredRevenue = getRevenue(filteredBills)
  const filteredOrderCount = filteredBills.reduce((sum, bill) => sum + countOrders(bill.orders), 0)
  const filteredProductVariantCount = getProductVariantCount(filteredBills, productMap)
  const averageBill = getAverageBill(filteredBills)
  const dailyRows = React.useMemo(() => buildDailyRows(filteredBills, range.startDate, range.endDate), [filteredBills, range.endDate, range.startDate])
  const highestDailyRow = getTopRow(dailyRows, row => row.revenue, row => row.date)
  const hourlyRows = React.useMemo(() => buildHourlyRows(filteredBills), [filteredBills])
  const busiestHour = getTopRow(hourlyRows, row => row.orderCount, row => row.label)
  const maxHourlyRevenue = Math.max(...hourlyRows.map(row => row.revenue), 0)
  const paymentRows = React.useMemo(() => buildPaymentRows({
    bills: filteredBills,
    collections: filteredCollections,
    cashIncome: filteredCashIncome
  }), [filteredBills, filteredCashIncome, filteredCollections])
  const tableRows = React.useMemo(() => buildTableRows(tables, filteredBills), [filteredBills, tables])
  const topRevenueTable = getTopRow(tableRows, row => row.revenue, row => row.tableName)
  const topOrderTable = getTopRow(tableRows, row => row.orderCount, row => row.tableName)
  const leastUsedTable = getLeastUsedTable(tableRows)

  const previousSelectedRange = getPreviousRange(range.startDate, range.endDate)
  const selectedPreviousBills = getRangeBills(revenueBills, previousSelectedRange.startDate, previousSelectedRange.endDate)
  const selectedPreviousRevenue = getRevenue(selectedPreviousBills)
  const selectedRangeChange = getTrendPercent(filteredRevenue, selectedPreviousRevenue)

  const yesterdayKey = addDays(todayKey, -1)
  const previousWeekRange = getPreviousRange(weekStart, todayKey)
  const previousMonthRange = getMonthToDatePreviousRange(today)
  const trendRows: TrendRow[] = [
    {
      title: 'Bugün vs Dün',
      currentLabel: todayKey,
      previousLabel: yesterdayKey,
      currentRevenue: getRevenue(todayBills),
      previousRevenue: getRevenue(getRangeBills(revenueBills, yesterdayKey, yesterdayKey)),
      changePercent: getTrendPercent(getRevenue(todayBills), getRevenue(getRangeBills(revenueBills, yesterdayKey, yesterdayKey)))
    },
    {
      title: 'Bu Hafta vs Geçen Hafta',
      currentLabel: `${weekStart} - ${todayKey}`,
      previousLabel: `${previousWeekRange.startDate} - ${previousWeekRange.endDate}`,
      currentRevenue: getRevenue(weekBills),
      previousRevenue: getRevenue(getRangeBills(revenueBills, previousWeekRange.startDate, previousWeekRange.endDate)),
      changePercent: getTrendPercent(getRevenue(weekBills), getRevenue(getRangeBills(revenueBills, previousWeekRange.startDate, previousWeekRange.endDate)))
    },
    {
      title: 'Bu Ay vs Geçen Ay',
      currentLabel: `${monthStart} - ${todayKey}`,
      previousLabel: `${previousMonthRange.startDate} - ${previousMonthRange.endDate}`,
      currentRevenue: getRevenue(monthBills),
      previousRevenue: getRevenue(getRangeBills(revenueBills, previousMonthRange.startDate, previousMonthRange.endDate)),
      changePercent: getTrendPercent(getRevenue(monthBills), getRevenue(getRangeBills(revenueBills, previousMonthRange.startDate, previousMonthRange.endDate)))
    }
  ]

  const revenueAnalysisItems = [
    { label: 'Günlük Ciro Listesi', value: formatCurrency(filteredRevenue), detail: `${formatNumber(dailyRows.length)} gün / ${range.label}` },
    { label: 'Bu Hafta Satışları', value: formatCurrency(getRevenue(weekBills)), detail: `${formatNumber(weekBills.length)} kapanan adisyon` },
    { label: 'Bu Ay Satışları', value: formatCurrency(getRevenue(monthBills)), detail: `${formatNumber(monthBills.length)} kapanan adisyon` },
    { label: 'Son 30 Günlük Ciro Özeti', value: formatCurrency(getRevenue(last30Bills)), detail: `${formatNumber(last30Bills.length)} kapanan adisyon` }
  ]

  return (
    <div className="sales-analysis-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Satış ve Ciro Analizleri</h2>
          <p className="muted">Satış performansınızı ve gelir dağılımınızı analiz edin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">{range.label}</span>
          <span className="dashboard-date-pill">{range.startDate || '-'} / {range.endDate || '-'}</span>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Seçili aralık değiştiğinde satış, saat, ödeme, masa ve trend kırılımları güncellenir.</p>
          </div>
          <div className="toolbar-controls sales-analysis-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input
              type="date"
              value={rangeMode === 'custom' ? customStartDate : range.startDate}
              onChange={event => setCustomStartDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <input
              type="date"
              value={rangeMode === 'custom' ? customEndDate : range.endDate}
              onChange={event => setCustomEndDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Bugünkü Ciro" value={formatCurrency(getRevenue(todayBills))} detail={`${formatNumber(todayBills.length)} kapanan adisyon`} />
        <KpiCard label="Bu Haftaki Ciro" value={formatCurrency(getRevenue(weekBills))} detail={`${weekStart} - ${todayKey}`} />
        <KpiCard label="Bu Aylık Ciro" value={formatCurrency(getRevenue(monthBills))} detail={`${monthStart} - ${todayKey}`} />
        <KpiCard label="Toplam Satış Adedi" value={formatNumber(filteredOrderCount)} detail={`${formatNumber(filteredProductVariantCount)} ürün çeşidi / ${range.label}`} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid sales-analysis-extra-grid">
        <KpiCard compact label="Ortalama Adisyon Tutarı" value={formatCurrency(averageBill)} detail={`${formatNumber(filteredBills.length)} adisyon`} />
        <KpiCard compact label="En Yüksek Günlük Ciro" value={formatCurrency(highestDailyRow?.revenue || 0)} detail={highestDailyRow?.date || 'Kayıt yok'} />
        <KpiCard compact label="En Yoğun Saat" value={busiestHour?.label || '-'} detail={busiestHour ? `${formatNumber(busiestHour.orderCount)} satış / ${formatCurrency(busiestHour.revenue)}` : 'Kayıt yok'} />
        <KpiCard compact label="Kapanan Adisyon Sayısı" value={formatNumber(filteredBills.length)} detail={`${formatCurrency(filteredRevenue)} seçili ciro`} />
      </div>

      <section className="card">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Ciro Analizleri</h3>
            <p className="muted">Günlük liste, hafta, ay ve son 30 günlük satış özeti.</p>
          </div>
          <span className={`status-pill ${selectedRangeChange >= 0 ? 'success' : 'danger-pill'}`}>Seçili aralık {formatTrend(selectedRangeChange)}</span>
        </div>
        <div className="financial-summary-values sales-analysis-summary-values">
          {revenueAnalysisItems.map(item => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p className="muted small-text">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="table-wrap sales-analysis-table-wrap">
          <table className="data-table sales-analysis-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Adisyon</th>
                <th>Satış Adedi</th>
                <th>Ciro</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={4}>Seçili aralıkta satış kaydı yok.</td>
                </tr>
              )}
              {dailyRows.slice(0, 12).map(row => (
                <tr key={row.date}>
                  <td><strong>{row.date}</strong></td>
                  <td>{formatNumber(row.billCount)}</td>
                  <td>{formatNumber(row.orderCount)}</td>
                  <td>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sales-analysis-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Saatlik Satış Analizi</h3>
              <p className="muted">00:00 - 23:59 saat bazında satış sayısı ve ciro.</p>
            </div>
            <span className="status-pill warning-pill">{busiestHour?.label || '-'}</span>
          </div>
          <div className="sales-hour-list">
            {hourlyRows.map(row => (
              <div className="sales-hour-row" key={row.hour}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{formatNumber(row.orderCount)} satış / {formatNumber(row.billCount)} adisyon</span>
                </div>
                <div>
                  <strong>{formatCurrency(row.revenue)}</strong>
                  <span className="sales-bar-track" aria-hidden="true">
                    <span style={{ width: `${maxHourlyRevenue > 0 ? Math.max(4, Math.round((row.revenue / maxHourlyRevenue) * 100)) : 0}%` }}></span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Ödeme Analizi</h3>
              <p className="muted">Nakit, kart, parçalı ödeme ve veresiye dağılımı.</p>
            </div>
            <span className="status-pill info-pill">{formatCurrency(sumMoney(paymentRows.map(row => row.total)))}</span>
          </div>
          <div className="payment-analysis-list">
            {paymentRows.map(row => (
              <div className="payment-analysis-row" key={row.key}>
                <div>
                  <strong>{row.label}</strong>
                  <span>{formatNumber(row.count)} işlem</span>
                </div>
                <div>
                  <strong>{formatCurrency(row.total)}</strong>
                  <span>%{formatNumber(row.percent)}</span>
                </div>
                <span className="sales-bar-track" aria-hidden="true">
                  <span style={{ width: `${row.percent}%` }}></span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="sales-analysis-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Masa Analizi</h3>
              <p className="muted">Masa bazında ciro, sipariş ve kullanım durumu.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(tableRows.length)} masa</span>
          </div>
          <div className="financial-summary-values">
            <div>
              <span>En Çok Ciro Üreten Masa</span>
              <strong>{getRowName(topRevenueTable)}</strong>
              <p className="muted small-text">{formatCurrency(topRevenueTable?.revenue || 0)}</p>
            </div>
            <div>
              <span>En Çok Sipariş Alan Masa</span>
              <strong>{getRowName(topOrderTable)}</strong>
              <p className="muted small-text">{formatNumber(topOrderTable?.orderCount || 0)} satış</p>
            </div>
            <div>
              <span>En Az Kullanılan Masa</span>
              <strong>{getRowName(leastUsedTable)}</strong>
              <p className="muted small-text">{formatNumber(leastUsedTable?.billCount || 0)} adisyon</p>
            </div>
            <div>
              <span>Seçili Aralık Cirosu</span>
              <strong>{formatCurrency(filteredRevenue)}</strong>
              <p className="muted small-text">{range.label}</p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Trend Analizi</h3>
              <p className="muted">Bugün, hafta ve ay bazında yüzdelik değişim.</p>
            </div>
            <span className={`status-pill ${getTrendClass(selectedRangeChange)}`}>Seçili {formatTrend(selectedRangeChange)}</span>
          </div>
          <div className="trend-analysis-list">
            {trendRows.map(row => (
              <div className="trend-analysis-row" key={row.title}>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.currentLabel} / {row.previousLabel}</span>
                </div>
                <div>
                  <strong>{formatCurrency(row.currentRevenue)}</strong>
                  <span>Önceki {formatCurrency(row.previousRevenue)}</span>
                </div>
                <span className={`status-pill ${getTrendClass(row.changePercent)}`}>{formatTrend(row.changePercent)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
